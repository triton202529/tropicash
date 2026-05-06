-- Atomic wallet debit + withdrawal_requests row (single transaction).
-- Run in Supabase SQL Editor after public.wallets and public.withdrawal_requests exist.
-- Requires wallets.wallet_balance (numeric). Adjust column name if your schema uses balance only.

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
  v_email text;
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

  return v_request_id;
end;
$$;

revoke all on function public.create_withdrawal_request(uuid, numeric, text) from public;
grant execute on function public.create_withdrawal_request(uuid, numeric, text) to authenticated;
