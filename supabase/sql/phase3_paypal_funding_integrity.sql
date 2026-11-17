-- Phase 3: bind each PayPal order to the Tropicash user who created it, and
-- credit a captured order at most once. Does not change fund_wallet's body
-- or Phase 1/2 grants. funding_idempotency_keys stays the one-credit lock.
-- paypal_funding_orders is the ownership and lifecycle record.
--
-- Live apply names:
--   phase3_paypal_funding_integrity
--   phase3_paypal_funding_credit
-- Requires auth.users, public.transactions, public.funding_idempotency_keys,
-- and public.fund_wallet(uuid, numeric).

create or replace function public.enforce_paypal_funding_order_integrity()
returns trigger
language plpgsql
as $$
declare
  v_allowed boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.status is distinct from 'created' then
      raise exception 'funding_order_must_start_created'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.provider is distinct from old.provider
     or new.provider_order_id is distinct from old.provider_order_id
     or new.amount is distinct from old.amount
     or new.currency is distinct from old.currency then
    raise exception 'funding_terms_immutable'
      using errcode = '42501';
  end if;

  if old.provider_capture_id is not null
     and new.provider_capture_id is distinct from old.provider_capture_id then
    raise exception 'funding_capture_immutable'
      using errcode = '42501';
  end if;

  if old.status = 'completed' and (
    new.status is distinct from 'completed'
    or new.transaction_id is distinct from old.transaction_id
  ) then
    raise exception 'funding_completed_immutable'
      using errcode = '42501';
  end if;

  if new.status is not distinct from old.status then
    new.updated_at := now();
    return new;
  end if;

  v_allowed := (old.status, new.status) in (
    ('created', 'capture_in_progress'),
    ('capture_in_progress', 'captured'),
    ('capture_in_progress', 'capture_failed'),
    ('capture_failed', 'capture_in_progress'),
    ('captured', 'credit_in_progress'),
    ('captured', 'completed'),
    ('credit_in_progress', 'completed'),
    ('credit_in_progress', 'credit_failed'),
    ('credit_failed', 'credit_in_progress'),
    ('credit_failed', 'completed')
  );

  if not v_allowed then
    raise exception 'funding_status_transition_denied'
      using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

comment on function public.enforce_paypal_funding_order_integrity() is
  'Freezes PayPal funding ownership, amount, and currency, and allows only the funding lifecycle transitions.';

revoke all on function public.enforce_paypal_funding_order_integrity() from public;
grant execute on function public.enforce_paypal_funding_order_integrity() to service_role;

create table if not exists public.paypal_funding_orders (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paypal',
  provider_order_id text not null,
  user_id uuid not null references auth.users (id) on delete restrict,
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  status text not null default 'created',
  provider_capture_id text null,
  provider_status text null,
  transaction_id uuid null references public.transactions (id) on delete restrict,
  last_error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  captured_at timestamptz null,
  completed_at timestamptz null,
  constraint paypal_funding_orders_provider_order_unique unique (provider, provider_order_id),
  constraint paypal_funding_orders_provider_check check (provider = 'paypal'),
  constraint paypal_funding_orders_order_id_present check (char_length(btrim(provider_order_id)) > 0),
  constraint paypal_funding_orders_amount_check check (amount >= 1 and amount <= 1000),
  constraint paypal_funding_orders_currency_check check (currency = 'USD'),
  constraint paypal_funding_orders_status_check check (
    status in (
      'created',
      'capture_in_progress',
      'capture_failed',
      'captured',
      'credit_in_progress',
      'credit_failed',
      'completed'
    )
  )
);

comment on table public.paypal_funding_orders is
  'One PayPal order bound to the Tropicash user who created it. Service role only. Captured means PayPal completed and Tropicash has not yet posted the wallet credit.';

alter table public.paypal_funding_orders enable row level security;

drop trigger if exists trg_paypal_funding_order_integrity on public.paypal_funding_orders;
create trigger trg_paypal_funding_order_integrity
  before insert or update on public.paypal_funding_orders
  for each row
  execute function public.enforce_paypal_funding_order_integrity();

create index if not exists paypal_funding_orders_user_id_idx
  on public.paypal_funding_orders (user_id);

create index if not exists paypal_funding_orders_status_idx
  on public.paypal_funding_orders (status);

revoke all on table public.paypal_funding_orders from public;
revoke all on table public.paypal_funding_orders from anon;
revoke all on table public.paypal_funding_orders from authenticated;
grant select, insert, update on table public.paypal_funding_orders to service_role;
revoke delete, truncate, references, trigger on table public.paypal_funding_orders from service_role;

-- ---------------------------------------------------------------------------
-- One wallet credit for a captured PayPal order. Caller must already have
-- verified PayPal. This function does not talk to PayPal.
-- fund_wallet and the completion mark commit or roll back together.
-- ---------------------------------------------------------------------------

create or replace function public.credit_paypal_funding_order(
  p_provider_order_id text,
  p_user_id uuid,
  p_amount numeric,
  p_currency text,
  p_provider_capture_id text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order public.paypal_funding_orders%rowtype;
  v_idem public.funding_idempotency_keys%rowtype;
  v_credit jsonb;
  v_tx uuid;
  v_idem_id uuid;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  if p_provider_order_id is null or btrim(p_provider_order_id) = '' or p_user_id is null then
    raise exception 'funding_order_not_found'
      using errcode = 'P0002';
  end if;

  select *
  into v_order
  from public.paypal_funding_orders
  where provider = 'paypal'
    and provider_order_id = p_provider_order_id
  for update;

  if not found then
    raise exception 'funding_order_not_found'
      using errcode = 'P0002';
  end if;

  if v_order.user_id is distinct from p_user_id then
    raise exception 'funding_owner_mismatch'
      using errcode = '42501';
  end if;

  if round(v_order.amount, 2) is distinct from round(p_amount, 2)
     or v_order.currency is distinct from upper(coalesce(p_currency, '')) then
    raise exception 'funding_terms_mismatch'
      using errcode = '42501';
  end if;

  if v_order.provider_capture_id is not null
     and p_provider_capture_id is not null
     and v_order.provider_capture_id is distinct from p_provider_capture_id then
    raise exception 'funding_capture_identity_mismatch'
      using errcode = '42501';
  end if;

  if v_order.status = 'completed' then
    return jsonb_build_object(
      'ok', true,
      'already_completed', true,
      'transaction_id', v_order.transaction_id,
      'amount', v_order.amount,
      'currency', v_order.currency,
      'order_id', v_order.provider_order_id
    );
  end if;

  if v_order.status not in ('captured', 'credit_failed', 'credit_in_progress') then
    raise exception 'funding_not_captured'
      using errcode = '42501';
  end if;

  select *
  into v_idem
  from public.funding_idempotency_keys
  where provider = 'paypal'
    and provider_order_id = p_provider_order_id
  for update;

  if found then
    if v_idem.user_id is not null and v_idem.user_id is distinct from v_order.user_id then
      raise exception 'funding_owner_mismatch'
        using errcode = '42501';
    end if;
    if v_idem.amount is not null and round(v_idem.amount, 2) is distinct from round(v_order.amount, 2) then
      raise exception 'funding_terms_mismatch'
        using errcode = '42501';
    end if;

    if v_idem.status = 'completed' then
      update public.paypal_funding_orders
      set status = 'completed',
          transaction_id = v_idem.transaction_id,
          provider_capture_id = coalesce(provider_capture_id, p_provider_capture_id),
          completed_at = coalesce(completed_at, now())
      where id = v_order.id;

      return jsonb_build_object(
        'ok', true,
        'already_completed', true,
        'transaction_id', v_idem.transaction_id,
        'amount', v_order.amount,
        'currency', v_order.currency,
        'order_id', v_order.provider_order_id
      );
    end if;

    if v_idem.status = 'processing' then
      return jsonb_build_object(
        'ok', false,
        'code', 'funding_credit_uncertain',
        'amount', v_order.amount,
        'order_id', v_order.provider_order_id
      );
    end if;

    update public.funding_idempotency_keys
    set status = 'processing',
        user_id = v_order.user_id,
        amount = v_order.amount,
        provider_capture_id = coalesce(provider_capture_id, p_provider_capture_id),
        updated_at = now()
    where id = v_idem.id
      and status = 'failed';

    if not found then
      return jsonb_build_object(
        'ok', false,
        'code', 'funding_credit_uncertain',
        'amount', v_order.amount,
        'order_id', v_order.provider_order_id
      );
    end if;
    v_idem_id := v_idem.id;
  else
    insert into public.funding_idempotency_keys (
      provider,
      provider_order_id,
      provider_capture_id,
      user_id,
      amount,
      status
    )
    values (
      'paypal',
      p_provider_order_id,
      p_provider_capture_id,
      v_order.user_id,
      v_order.amount,
      'processing'
    )
    returning id into v_idem_id;
  end if;

  update public.paypal_funding_orders
  set status = 'credit_in_progress',
      provider_capture_id = coalesce(provider_capture_id, p_provider_capture_id)
  where id = v_order.id
    and status in ('captured', 'credit_failed', 'credit_in_progress');

  begin
    v_credit := public.fund_wallet(v_order.user_id, v_order.amount);
    v_tx := nullif(v_credit->>'transaction_id', '')::uuid;

    update public.funding_idempotency_keys
    set status = 'completed',
        transaction_id = v_tx,
        provider_capture_id = coalesce(provider_capture_id, p_provider_capture_id),
        updated_at = now()
    where id = v_idem_id;

    update public.paypal_funding_orders
    set status = 'completed',
        transaction_id = v_tx,
        provider_capture_id = coalesce(provider_capture_id, p_provider_capture_id),
        provider_status = 'COMPLETED',
        completed_at = now(),
        last_error = null
    where id = v_order.id;

    return jsonb_build_object(
      'ok', true,
      'already_completed', false,
      'transaction_id', v_tx,
      'amount', v_order.amount,
      'currency', v_order.currency,
      'order_id', v_order.provider_order_id
    );
  exception
    when others then
      update public.funding_idempotency_keys
      set status = 'failed',
          raw_response = jsonb_build_object('phase', 'fund_wallet', 'error', left(sqlerrm, 300)),
          updated_at = now()
      where id = v_idem_id;

      update public.paypal_funding_orders
      set status = 'credit_failed',
          last_error = left(sqlerrm, 500)
      where id = v_order.id;

      return jsonb_build_object(
        'ok', false,
        'code', 'credit_failed',
        'amount', v_order.amount,
        'order_id', v_order.provider_order_id
      );
  end;
end;
$$;

comment on function public.credit_paypal_funding_order(text, uuid, numeric, text, text) is
  'Phase 3: service_role only. Posts fund_wallet once for a captured PayPal order owned by p_user_id. A completed order returns the existing credit.';

revoke all on function public.credit_paypal_funding_order(text, uuid, numeric, text, text) from public;
revoke all on function public.credit_paypal_funding_order(text, uuid, numeric, text, text) from anon;
revoke all on function public.credit_paypal_funding_order(text, uuid, numeric, text, text) from authenticated;
grant execute on function public.credit_paypal_funding_order(text, uuid, numeric, text, text) to service_role;

do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'fund_wallet(uuid,numeric)',
    'transfer_funds(uuid,uuid,numeric)',
    'create_withdrawal_request(uuid,numeric,text)',
    'refund_withdrawal_request(uuid,text,uuid)'
  ]
  loop
    if has_function_privilege('anon', 'public.' || v_fn, 'execute')
       or has_function_privilege('authenticated', 'public.' || v_fn, 'execute')
       or not has_function_privilege('service_role', 'public.' || v_fn, 'execute') then
      raise exception 'phase1_money_grant_regressed: %', v_fn
        using errcode = '42501';
    end if;
  end loop;

  if has_function_privilege('anon', 'public.credit_paypal_funding_order(text,uuid,numeric,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.credit_paypal_funding_order(text,uuid,numeric,text,text)', 'execute')
     or not has_function_privilege('service_role', 'public.credit_paypal_funding_order(text,uuid,numeric,text,text)', 'execute') then
    raise exception 'phase3_credit_grant_failed'
      using errcode = '42501';
  end if;
end;
$$;
