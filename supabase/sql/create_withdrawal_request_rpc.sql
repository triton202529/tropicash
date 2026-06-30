-- DEPRECATED (TLP-004): Superseded by phase_tlp002_foundation_hardening.sql.
-- Do not apply after TLP-002. Canonical RPC definition: phase_tlp002_foundation_hardening.sql.
-- Atomic wallet debit + withdrawal_requests row + withdraw_wallet ledger entry (single transaction).
-- Run in Supabase SQL Editor after public.wallets and public.withdrawal_requests exist.
-- Requires wallets.wallet_balance (numeric). Phase 13D adds withdrawal_transaction_id link.
-- Prefer applying supabase/sql/phase_13d_withdrawal_transaction_ledger.sql for production.

create or replace function public.create_withdrawal_request(
  p_user_id uuid,
  p_amount numeric,
  p_payout_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_balance numeric;
  v_request_id uuid;
  v_tx_id uuid;
  v_email text;
  v_desc text;
  n int;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not_authorized';
  end if;

  v_email := nullif(trim(coalesce(p_payout_email, '')), '');
  if v_email is null then
    raise exception 'payout_email_required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select coalesce(wallet_balance, 0) into v_wallet_balance
  from wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  if v_wallet_balance < p_amount then
    raise exception 'Insufficient funds';
  end if;

  update wallets
  set wallet_balance = coalesce(wallet_balance, 0) - p_amount
  where user_id = p_user_id;

  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Wallet not found';
  end if;

  insert into withdrawal_requests (
    user_id,
    amount,
    status,
    payout_email,
    payout_destination,
    created_at
  )
  values (
    p_user_id,
    p_amount,
    'pending',
    v_email,
    v_email,
    now()
  )
  returning id into v_request_id;

  v_desc := 'Withdrawal request · id ' || v_request_id::text;

  begin
    insert into transactions (sender_id, amount, type, status, note)
    values (p_user_id, p_amount, 'withdraw_wallet', 'completed', v_desc)
    returning id into v_tx_id;
  exception
    when sqlstate '42703' then
      insert into transactions (sender_id, amount, type, status)
      values (p_user_id, p_amount, 'withdraw_wallet', 'completed')
      returning id into v_tx_id;
  end;

  update withdrawal_requests
  set withdrawal_transaction_id = v_tx_id
  where id = v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.create_withdrawal_request(uuid, numeric, text) from public;
revoke all on function public.create_withdrawal_request(uuid, numeric, text) from authenticated;
grant execute on function public.create_withdrawal_request(uuid, numeric, text) to service_role;
