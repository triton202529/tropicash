-- Phase 5: automatic exact-once funding journal posting.
-- Accounting evidence only — never mutates wallets.wallet_balance.
-- Posts only after canonical PayPal funding is completed.
--
-- Live Supabase applied this architecture as three sequential migrations:
--   1) phase5_funding_ledger_posting
--   2) phase5_funding_ledger_credit_integration
--   3) phase5_funding_ledger_posting_draft_fix
-- This repository file is the consolidated final definition that reproduces
-- the same end-state architecture (accounts, constraints, triggers, grants,
-- post_funding_journal, and credit_paypal_funding_order integration).

-- ---------------------------------------------------------------------------
-- 1) Canonical processor clearing account (do not reuse treasury_cash)
-- ---------------------------------------------------------------------------
insert into public.ledger_accounts (code, name, account_type, status, metadata)
values (
  'paypal_processor_clearing',
  'PayPal processor clearing',
  'asset',
  'active',
  jsonb_build_object(
    'phase', 'phase5',
    'role', 'payment_processor_clearing_asset',
    'note', 'Receivable/clearing until PayPal settlement; not treasury cash'
  )
)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Durable posting status on funding orders
-- ---------------------------------------------------------------------------
alter table public.paypal_funding_orders
  add column if not exists ledger_journal_entry_id uuid,
  add column if not exists ledger_posting_status text,
  add column if not exists ledger_posting_error text,
  add column if not exists ledger_posted_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'paypal_funding_orders_ledger_posting_status_ck'
  ) then
    alter table public.paypal_funding_orders
      add constraint paypal_funding_orders_ledger_posting_status_ck
      check (
        ledger_posting_status is null
        or ledger_posting_status in ('pending', 'posted', 'failed')
      );
  end if;
end $$;

comment on column public.paypal_funding_orders.ledger_posting_status is
  'Phase 5: posted|failed|pending for WALLET_FUNDING_COMPLETED journal. Independent of wallet credit.';

-- ---------------------------------------------------------------------------
-- 3) Exact-once uniqueness for funding journals
-- ---------------------------------------------------------------------------
create unique index if not exists journal_entries_wallet_funding_source_uidx
  on public.journal_entries (source_type, source_id)
  where source_type = 'wallet_funding'
    and source_id is not null;

-- ---------------------------------------------------------------------------
-- 4) Immutability for posted journals (no edit/delete; reverse via new entry)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_posted_journal_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'posted' then
      raise exception 'posted_journal_immutable'
        using errcode = '42501';
    end if;
    return old;
  end if;

  if old.status = 'posted' then
    raise exception 'posted_journal_immutable'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_journal_entries_posted_immutable on public.journal_entries;
create trigger trg_journal_entries_posted_immutable
  before update or delete on public.journal_entries
  for each row
  execute function public.enforce_posted_journal_immutability();

create or replace function public.enforce_posted_journal_line_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_status text;
  v_entry_id uuid;
begin
  v_entry_id := coalesce(new.journal_entry_id, old.journal_entry_id);
  select status into v_status
  from public.journal_entries
  where id = v_entry_id;

  if v_status = 'posted' then
    raise exception 'posted_journal_immutable'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_journal_lines_posted_immutable on public.journal_lines;
create trigger trg_journal_lines_posted_immutable
  before insert or update or delete on public.journal_lines
  for each row
  execute function public.enforce_posted_journal_line_immutability();

-- ---------------------------------------------------------------------------
-- 5) Canonical posting authority
-- ---------------------------------------------------------------------------
create or replace function public.post_funding_journal(
  p_transaction_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tx public.transactions%rowtype;
  v_order public.paypal_funding_orders%rowtype;
  v_idem public.funding_idempotency_keys%rowtype;
  v_existing public.journal_entries%rowtype;
  v_entry_id uuid;
  v_debit_account uuid;
  v_credit_account uuid;
  v_amount numeric(18, 2);
  v_currency text;
  v_debit_sum numeric(18, 2);
  v_credit_sum numeric(18, 2);
  v_line_count int;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not_authorized'
      using errcode = '42501';
  end if;

  if p_transaction_id is null then
    raise exception 'funding_transaction_required'
      using errcode = '22023';
  end if;

  select *
  into v_tx
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'funding_transaction_not_found'
      using errcode = 'P0002';
  end if;

  if v_tx.type is distinct from 'fund' then
    raise exception 'funding_transaction_type_invalid'
      using errcode = '42501';
  end if;

  if coalesce(v_tx.status, '') is distinct from 'completed' then
    raise exception 'funding_transaction_not_completed'
      using errcode = '42501';
  end if;

  if coalesce(v_tx.metadata->>'balance_authority', '') is distinct from 'fund_wallet_rpc' then
    raise exception 'funding_balance_authority_invalid'
      using errcode = '42501';
  end if;

  v_amount := round(v_tx.amount::numeric, 2);
  if v_amount is null or v_amount <= 0 then
    raise exception 'funding_amount_invalid'
      using errcode = '22023';
  end if;

  select *
  into v_order
  from public.paypal_funding_orders
  where transaction_id = p_transaction_id
    and provider = 'paypal'
  for update;

  if not found then
    raise exception 'funding_order_not_found'
      using errcode = 'P0002';
  end if;

  if v_order.status is distinct from 'completed' then
    raise exception 'funding_order_not_completed'
      using errcode = '42501';
  end if;

  if round(v_order.amount::numeric, 2) is distinct from v_amount then
    raise exception 'funding_amount_mismatch'
      using errcode = '42501';
  end if;

  if v_order.provider_capture_id is null or btrim(v_order.provider_capture_id) = '' then
    raise exception 'funding_capture_missing'
      using errcode = '42501';
  end if;

  select *
  into v_idem
  from public.funding_idempotency_keys
  where provider = 'paypal'
    and provider_order_id = v_order.provider_order_id
  for update;

  if not found or v_idem.status is distinct from 'completed' then
    raise exception 'funding_idempotency_not_completed'
      using errcode = '42501';
  end if;

  if v_idem.transaction_id is distinct from p_transaction_id then
    raise exception 'funding_idempotency_transaction_mismatch'
      using errcode = '42501';
  end if;

  v_currency := upper(coalesce(v_order.currency, 'USD'));

  select *
  into v_existing
  from public.journal_entries
  where source_type = 'wallet_funding'
    and source_id = p_transaction_id::text
  for update;

  if found then
    select
      coalesce(sum(debit), 0),
      coalesce(sum(credit), 0),
      count(*)::int
    into v_debit_sum, v_credit_sum, v_line_count
    from public.journal_lines
    where journal_entry_id = v_existing.id;

    update public.paypal_funding_orders
    set ledger_journal_entry_id = v_existing.id,
        ledger_posting_status = 'posted',
        ledger_posting_error = null,
        ledger_posted_at = coalesce(ledger_posted_at, v_existing.created_at, now())
    where id = v_order.id;

    return jsonb_build_object(
      'ok', true,
      'already_posted', true,
      'event', 'WALLET_FUNDING_COMPLETED',
      'journal_entry_id', v_existing.id,
      'transaction_id', p_transaction_id,
      'amount', v_amount,
      'currency', v_currency,
      'debit_total', v_debit_sum,
      'credit_total', v_credit_sum,
      'line_count', v_line_count,
      'wallet_mutated', false
    );
  end if;

  select id into v_debit_account
  from public.ledger_accounts
  where code = 'paypal_processor_clearing'
    and status = 'active';

  select id into v_credit_account
  from public.ledger_accounts
  where code = 'user_wallet_liability'
    and status = 'active';

  if v_debit_account is null or v_credit_account is null then
    raise exception 'funding_ledger_accounts_missing'
      using errcode = 'P0002';
  end if;

  update public.paypal_funding_orders
  set ledger_posting_status = 'pending',
      ledger_posting_error = null
  where id = v_order.id;

  begin
    insert into public.journal_entries (
      entry_type,
      source_type,
      source_id,
      description,
      status,
      metadata
    )
    values (
      'wallet_funding',
      'wallet_funding',
      p_transaction_id::text,
      'PayPal wallet funding completed',
      'draft',
      jsonb_build_object(
        'event', 'WALLET_FUNDING_COMPLETED',
        'provider', 'paypal',
        'provider_order_id', v_order.provider_order_id,
        'provider_capture_id', v_order.provider_capture_id,
        'funding_order_id', v_order.id,
        'user_id', v_order.user_id,
        'amount', v_amount,
        'currency', v_currency,
        'balance_authority', 'fund_wallet_rpc',
        'phase', 'phase5'
      )
    )
    returning id into v_entry_id;
  exception
    when unique_violation then
      select *
      into v_existing
      from public.journal_entries
      where source_type = 'wallet_funding'
        and source_id = p_transaction_id::text;

      select
        coalesce(sum(debit), 0),
        coalesce(sum(credit), 0),
        count(*)::int
      into v_debit_sum, v_credit_sum, v_line_count
      from public.journal_lines
      where journal_entry_id = v_existing.id;

      update public.paypal_funding_orders
      set ledger_journal_entry_id = v_existing.id,
          ledger_posting_status = 'posted',
          ledger_posting_error = null,
          ledger_posted_at = coalesce(ledger_posted_at, v_existing.created_at, now())
      where id = v_order.id;

      return jsonb_build_object(
        'ok', true,
        'already_posted', true,
        'event', 'WALLET_FUNDING_COMPLETED',
        'journal_entry_id', v_existing.id,
        'transaction_id', p_transaction_id,
        'amount', v_amount,
        'currency', v_currency,
        'debit_total', v_debit_sum,
        'credit_total', v_credit_sum,
        'line_count', v_line_count,
        'wallet_mutated', false
      );
  end;

  insert into public.journal_lines (
    journal_entry_id,
    account_id,
    debit,
    credit,
    currency,
    user_id,
    metadata
  )
  values
    (
      v_entry_id,
      v_debit_account,
      v_amount,
      0,
      v_currency,
      v_order.user_id,
      jsonb_build_object('side', 'debit', 'account_code', 'paypal_processor_clearing')
    ),
    (
      v_entry_id,
      v_credit_account,
      0,
      v_amount,
      v_currency,
      v_order.user_id,
      jsonb_build_object('side', 'credit', 'account_code', 'user_wallet_liability')
    );

  select
    coalesce(sum(debit), 0),
    coalesce(sum(credit), 0),
    count(*)::int
  into v_debit_sum, v_credit_sum, v_line_count
  from public.journal_lines
  where journal_entry_id = v_entry_id;

  if v_line_count is distinct from 2
     or round(v_debit_sum, 2) is distinct from round(v_credit_sum, 2)
     or round(v_debit_sum, 2) is distinct from v_amount then
    raise exception 'funding_journal_unbalanced'
      using errcode = '42501';
  end if;

  update public.journal_entries
  set status = 'posted'
  where id = v_entry_id
    and status = 'draft';

  update public.paypal_funding_orders
  set ledger_journal_entry_id = v_entry_id,
      ledger_posting_status = 'posted',
      ledger_posting_error = null,
      ledger_posted_at = now()
  where id = v_order.id;

  return jsonb_build_object(
    'ok', true,
    'already_posted', false,
    'event', 'WALLET_FUNDING_COMPLETED',
    'journal_entry_id', v_entry_id,
    'transaction_id', p_transaction_id,
    'amount', v_amount,
    'currency', v_currency,
    'debit_total', v_debit_sum,
    'credit_total', v_credit_sum,
    'line_count', v_line_count,
    'wallet_mutated', false
  );
end;
$$;

comment on function public.post_funding_journal(uuid) is
  'Phase 5: service_role only. Posts exact-once DR paypal_processor_clearing / CR user_wallet_liability for a completed canonical funding transaction. Never mutates wallet balances.';

revoke all on function public.post_funding_journal(uuid) from public;
revoke all on function public.post_funding_journal(uuid) from anon;
revoke all on function public.post_funding_journal(uuid) from authenticated;
grant execute on function public.post_funding_journal(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 6) Integrate after exact-once wallet credit (journal failure must not unwind credit)
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
  v_journal jsonb;
  v_result jsonb;
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
    v_result := jsonb_build_object(
      'ok', true,
      'already_completed', true,
      'transaction_id', v_order.transaction_id,
      'amount', v_order.amount,
      'currency', v_order.currency,
      'order_id', v_order.provider_order_id
    );

    if v_order.transaction_id is not null then
      begin
        v_journal := public.post_funding_journal(v_order.transaction_id);
        v_result := v_result || jsonb_build_object(
          'ledger', v_journal,
          'ledger_posted', coalesce((v_journal->>'ok')::boolean, false)
        );
      exception
        when others then
          update public.paypal_funding_orders
          set ledger_posting_status = 'failed',
              ledger_posting_error = left(sqlerrm, 500)
          where id = v_order.id;
          v_result := v_result || jsonb_build_object(
            'ledger_posted', false,
            'ledger_error', left(sqlerrm, 200)
          );
      end;
    end if;

    return v_result;
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

      v_result := jsonb_build_object(
        'ok', true,
        'already_completed', true,
        'transaction_id', v_idem.transaction_id,
        'amount', v_order.amount,
        'currency', v_order.currency,
        'order_id', v_order.provider_order_id
      );

      if v_idem.transaction_id is not null then
        begin
          v_journal := public.post_funding_journal(v_idem.transaction_id);
          v_result := v_result || jsonb_build_object(
            'ledger', v_journal,
            'ledger_posted', coalesce((v_journal->>'ok')::boolean, false)
          );
        exception
          when others then
            update public.paypal_funding_orders
            set ledger_posting_status = 'failed',
                ledger_posting_error = left(sqlerrm, 500)
            where id = v_order.id;
            v_result := v_result || jsonb_build_object(
              'ledger_posted', false,
              'ledger_error', left(sqlerrm, 200)
            );
        end;
      end if;

      return v_result;
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

    v_result := jsonb_build_object(
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

  -- Journal posting is outside the fund_wallet subtransaction so a ledger
  -- failure cannot unwind a successful wallet credit.
  if v_tx is not null then
    begin
      v_journal := public.post_funding_journal(v_tx);
      v_result := v_result || jsonb_build_object(
        'ledger', v_journal,
        'ledger_posted', coalesce((v_journal->>'ok')::boolean, false)
      );
    exception
      when others then
        update public.paypal_funding_orders
        set ledger_posting_status = 'failed',
            ledger_posting_error = left(sqlerrm, 500)
        where id = v_order.id;
        v_result := v_result || jsonb_build_object(
          'ledger_posted', false,
          'ledger_error', left(sqlerrm, 200)
        );
    end;
  end if;

  return v_result;
end;
$$;

comment on function public.credit_paypal_funding_order(text, uuid, numeric, text, text) is
  'Phase 3/5: service_role only. Posts fund_wallet once for a captured PayPal order, then exact-once funding journal. Journal failure does not reverse wallet credit.';

revoke all on function public.credit_paypal_funding_order(text, uuid, numeric, text, text) from public;
revoke all on function public.credit_paypal_funding_order(text, uuid, numeric, text, text) from anon;
revoke all on function public.credit_paypal_funding_order(text, uuid, numeric, text, text) from authenticated;
grant execute on function public.credit_paypal_funding_order(text, uuid, numeric, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- 7) Grant assertions
-- ---------------------------------------------------------------------------
do $$
begin
  if has_function_privilege('anon', 'public.post_funding_journal(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.post_funding_journal(uuid)', 'execute')
     or not has_function_privilege('service_role', 'public.post_funding_journal(uuid)', 'execute') then
    raise exception 'phase5_post_funding_journal_grants_invalid';
  end if;

  if has_function_privilege('anon', 'public.credit_paypal_funding_order(text,uuid,numeric,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.credit_paypal_funding_order(text,uuid,numeric,text,text)', 'execute')
     or not has_function_privilege('service_role', 'public.credit_paypal_funding_order(text,uuid,numeric,text,text)', 'execute') then
    raise exception 'phase5_credit_paypal_funding_order_grants_invalid';
  end if;
end $$;
