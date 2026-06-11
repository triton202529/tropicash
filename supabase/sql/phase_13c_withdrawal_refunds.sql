-- Phase 13C: Idempotent wallet refund when a withdrawal is rejected or failed.
-- Run after public.withdrawal_requests, public.wallets, and public.transactions exist.
-- Does not change withdrawal creation RPC or PayPal payout execution.

-- ---------------------------------------------------------------------------
-- 1) Refund audit columns on withdrawal_requests
-- ---------------------------------------------------------------------------
alter table public.withdrawal_requests
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_transaction_id uuid references public.transactions (id) on delete set null,
  add column if not exists refund_reason text,
  add column if not exists refunded_by uuid references auth.users (id) on delete set null;

comment on column public.withdrawal_requests.refunded_at is
  'When wallet balance was credited back after rejected/failed withdrawal (Phase 13C).';
comment on column public.withdrawal_requests.refund_transaction_id is
  'transactions.id for withdrawal_refund credit, if logged.';
comment on column public.withdrawal_requests.refund_reason is
  'Admin/system reason for refund (rejection note, failure context, etc.).';
comment on column public.withdrawal_requests.refunded_by is
  'Admin user who triggered the wallet refund.';

create index if not exists withdrawal_requests_refunded_at_idx
  on public.withdrawal_requests (refunded_at)
  where refunded_at is not null;

-- ---------------------------------------------------------------------------
-- 2) Allow withdrawal_refund in transactions.type CHECK (adjust list if your DB differs)
-- ---------------------------------------------------------------------------
alter table public.transactions drop constraint if exists transactions_type_check;

alter table public.transactions
  add constraint transactions_type_check
  check (
    type in (
      'send',
      'receive',
      'withdraw',
      'fund',
      'send_money',
      'receive_money',
      'fund_wallet',
      'withdraw_wallet',
      'wallet_funded',
      'deposit_to_triton',
      'withdrawal_refund'
    )
  );

-- ---------------------------------------------------------------------------
-- 3) Atomic, idempotent refund RPC (service role only)
-- Credits wallets.wallet_balance (same column as create_withdrawal_request).
-- Logs public.transactions when columns allow; otherwise wallet credit still applies.
-- ---------------------------------------------------------------------------
create or replace function public.refund_withdrawal_request(
  p_withdrawal_request_id uuid,
  p_reason text default null,
  p_admin_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.withdrawal_requests%rowtype;
  v_amount numeric;
  v_tx_id uuid;
  v_desc text;
  v_status text;
  n int;
begin
  if p_withdrawal_request_id is null then
    return jsonb_build_object('outcome', 'error', 'message', 'withdrawal_request_id_required');
  end if;

  select * into v_row
  from public.withdrawal_requests
  where id = p_withdrawal_request_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'error', 'message', 'withdrawal_not_found');
  end if;

  if v_row.refunded_at is not null then
    return jsonb_build_object(
      'outcome', 'already_refunded',
      'withdrawal_request_id', p_withdrawal_request_id,
      'refunded_at', v_row.refunded_at,
      'refund_transaction_id', v_row.refund_transaction_id
    );
  end if;

  v_status := lower(trim(coalesce(v_row.status, '')));
  if v_status not in ('rejected', 'failed') then
    return jsonb_build_object(
      'outcome', 'not_refundable',
      'withdrawal_request_id', p_withdrawal_request_id,
      'status', v_row.status
    );
  end if;

  v_amount := v_row.amount;
  if v_amount is null or v_amount <= 0 then
    return jsonb_build_object('outcome', 'error', 'message', 'invalid_amount');
  end if;

  if v_row.user_id is null then
    return jsonb_build_object('outcome', 'error', 'message', 'missing_user_id');
  end if;

  update public.wallets
  set wallet_balance = coalesce(wallet_balance, 0) + v_amount
  where user_id = v_row.user_id;

  get diagnostics n = row_count;
  if n = 0 then
    insert into public.wallets (user_id, wallet_balance)
    values (v_row.user_id, v_amount);
  end if;

  v_desc := 'Withdrawal refund · request ' || p_withdrawal_request_id::text;
  if p_reason is not null and trim(p_reason) <> '' then
    v_desc := v_desc || ' · ' || left(trim(p_reason), 200);
  end if;

  begin
    insert into public.transactions (recipient_id, amount, type, status, note)
    values (v_row.user_id, v_amount, 'withdrawal_refund', 'completed', v_desc)
    returning id into v_tx_id;
  exception
    when sqlstate '42703' then
      insert into public.transactions (recipient_id, amount, type, status)
      values (v_row.user_id, v_amount, 'withdrawal_refund', 'completed')
      returning id into v_tx_id;
  end;

  update public.withdrawal_requests
  set
    refunded_at = now(),
    refund_transaction_id = v_tx_id,
    refund_reason = nullif(trim(coalesce(p_reason, '')), ''),
    refunded_by = p_admin_user_id,
    updated_at = now()
  where id = p_withdrawal_request_id
    and refunded_at is null;

  get diagnostics n = row_count;
  if n <> 1 then
    return jsonb_build_object('outcome', 'already_refunded', 'withdrawal_request_id', p_withdrawal_request_id);
  end if;

  return jsonb_build_object(
    'outcome', 'refunded',
    'withdrawal_request_id', p_withdrawal_request_id,
    'user_id', v_row.user_id,
    'amount', v_amount,
    'transaction_id', v_tx_id,
    'refunded_at', now()
  );
exception
  when others then
    return jsonb_build_object('outcome', 'error', 'message', sqlerrm);
end;
$$;

revoke all on function public.refund_withdrawal_request(uuid, text, uuid) from public;
grant execute on function public.refund_withdrawal_request(uuid, text, uuid) to service_role;

comment on function public.refund_withdrawal_request(uuid, text, uuid) is
  'Phase 13C: credit wallet once for rejected/failed withdrawal_requests. Idempotent via refunded_at.';

-- Fallback note:
-- If transactions insert fails entirely (schema mismatch), apply a local patch to match your
-- transactions columns (e.g. description, user_id) and re-run the function body only.
-- Wallet credit + withdrawal_requests refund fields remain the source of truth.
