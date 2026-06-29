-- TLP-002: Foundation hardening — wallet balance canonicalization, fund_wallet RPC,
-- server-authoritative money RPCs, admin RBAC, fraud_logs RLS.
-- Apply after existing wallet / withdrawal / fraud_logs migrations.

-- ---------------------------------------------------------------------------
-- 1) Canonical wallet_balance column
-- ---------------------------------------------------------------------------

alter table public.wallets
  add column if not exists wallet_balance numeric not null default 0;

-- Backfill wallet_balance from legacy balance column when present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'wallets' and column_name = 'balance'
  ) then
    update public.wallets
    set wallet_balance = coalesce(wallet_balance, balance, 0)
    where wallet_balance is distinct from coalesce(balance, wallet_balance, 0);

    update public.wallets
    set balance = wallet_balance
    where balance is distinct from wallet_balance;
  end if;
end $$;

comment on column public.wallets.wallet_balance is
  'Canonical user wallet balance (USD). Authoritative column for all money RPCs (TLP-002).';

-- ---------------------------------------------------------------------------
-- 2) fund_wallet — service-role only (PayPal capture credits wallet)
-- ---------------------------------------------------------------------------

create or replace function public.fund_wallet(
  p_user_id uuid,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx_id uuid;
  v_new_balance numeric;
begin
  if p_user_id is null then
    raise exception 'invalid_user';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  insert into public.wallets (user_id, wallet_balance)
  values (p_user_id, p_amount)
  on conflict (user_id) do update
  set wallet_balance = coalesce(public.wallets.wallet_balance, 0) + p_amount
  returning wallet_balance into v_new_balance;

  -- Keep legacy balance column in sync when it exists
  begin
    update public.wallets set balance = v_new_balance where user_id = p_user_id;
  exception when undefined_column then
    null;
  end;

  insert into public.transactions (sender_id, amount, type, status, note)
  values (p_user_id, p_amount, 'fund_wallet', 'completed', 'Wallet funding')
  returning id into v_tx_id;

  return jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'wallet_balance', v_new_balance
  );
end;
$$;

revoke all on function public.fund_wallet(uuid, numeric) from public;
grant execute on function public.fund_wallet(uuid, numeric) to service_role;

-- ---------------------------------------------------------------------------
-- 3) transfer_funds — wallet_balance + send_money type; service_role only
-- ---------------------------------------------------------------------------

create or replace function public.transfer_funds(
  sender_id uuid,
  recipient_id uuid,
  amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  v_tx_id uuid;
  v_sender_balance numeric;
begin
  -- Direct authenticated calls revoked (TLP-002). Service role invokes after server API gate.
  if auth.uid() is not null and auth.uid() <> transfer_funds.sender_id then
    raise exception 'not_authorized';
  end if;

  if amount is null or amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  if transfer_funds.sender_id = transfer_funds.recipient_id then
    raise exception 'cannot_send_to_self';
  end if;

  update public.wallets w
  set wallet_balance = coalesce(w.wallet_balance, 0) - transfer_funds.amount
  where w.user_id = transfer_funds.sender_id
    and coalesce(w.wallet_balance, 0) >= transfer_funds.amount;

  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'insufficient_funds';
  end if;

  update public.wallets w
  set wallet_balance = coalesce(w.wallet_balance, 0) + transfer_funds.amount
  where w.user_id = transfer_funds.recipient_id;

  get diagnostics n = row_count;
  if n = 0 then
    insert into public.wallets (user_id, wallet_balance)
    values (transfer_funds.recipient_id, transfer_funds.amount);
  end if;

  -- Sync legacy balance column when present
  begin
    update public.wallets set balance = wallet_balance
    where user_id in (transfer_funds.sender_id, transfer_funds.recipient_id);
  exception when undefined_column then
    null;
  end;

  insert into public.transactions (sender_id, recipient_id, amount, type, status)
  values (
    transfer_funds.sender_id,
    transfer_funds.recipient_id,
    transfer_funds.amount,
    'send_money',
    'completed'
  )
  returning id into v_tx_id;

  select coalesce(wallet_balance, 0) into v_sender_balance
  from public.wallets
  where user_id = transfer_funds.sender_id;

  return jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'sender_balance', v_sender_balance
  );
end;
$$;

revoke all on function public.transfer_funds(uuid, uuid, numeric) from public;
revoke all on function public.transfer_funds(uuid, uuid, numeric) from authenticated;
grant execute on function public.transfer_funds(uuid, uuid, numeric) to service_role;

-- ---------------------------------------------------------------------------
-- 4) create_withdrawal_request — service_role only (server API gate)
-- ---------------------------------------------------------------------------

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
  if auth.uid() is not null and auth.uid() <> p_user_id then
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
  from public.wallets
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'Wallet not found';
  end if;

  if v_wallet_balance < p_amount then
    raise exception 'Insufficient funds';
  end if;

  update public.wallets
  set wallet_balance = coalesce(wallet_balance, 0) - p_amount
  where user_id = p_user_id;

  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'Wallet not found';
  end if;

  begin
    update public.wallets set balance = wallet_balance where user_id = p_user_id;
  exception when undefined_column then
    null;
  end;

  insert into public.withdrawal_requests (
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
    insert into public.transactions (sender_id, amount, type, status, note)
    values (p_user_id, p_amount, 'withdraw_wallet', 'completed', v_desc)
    returning id into v_tx_id;
  exception
    when sqlstate '42703' then
      insert into public.transactions (sender_id, amount, type, status)
      values (p_user_id, p_amount, 'withdraw_wallet', 'completed')
      returning id into v_tx_id;
  end;

  begin
    update public.withdrawal_requests
    set withdrawal_transaction_id = v_tx_id
    where id = v_request_id;
  exception when undefined_column then
    null;
  end;

  return v_request_id;
end;
$$;

revoke all on function public.create_withdrawal_request(uuid, numeric, text) from public;
revoke all on function public.create_withdrawal_request(uuid, numeric, text) from authenticated;
grant execute on function public.create_withdrawal_request(uuid, numeric, text) to service_role;

-- ---------------------------------------------------------------------------
-- 5) Admin RBAC — admin_members table + tc_is_admin()
-- ---------------------------------------------------------------------------

create table if not exists public.admin_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'admin'
    check (lower(btrim(role)) in ('admin', 'ops', 'compliance', 'treasury')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_members_active_role_idx
  on public.admin_members (active, role);

alter table public.admin_members enable row level security;

drop policy if exists "admin_members_select_admin" on public.admin_members;
create policy "admin_members_select_admin"
  on public.admin_members
  for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_members m
      where m.user_id = auth.uid() and m.active = true
    )
  );

drop policy if exists "admin_members_manage_admin" on public.admin_members;
create policy "admin_members_manage_admin"
  on public.admin_members
  for all
  to authenticated
  using (
    exists (
      select 1 from public.admin_members m
      where m.user_id = auth.uid() and m.active = true and lower(m.role) = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.admin_members m
      where m.user_id = auth.uid() and m.active = true and lower(m.role) = 'admin'
    )
  );

-- One-time bootstrap: migrate legacy hardcoded admin into admin_members
insert into public.admin_members (user_id, role, active)
select u.id, 'admin', true
from auth.users u
where lower(coalesce(u.email, '')) = 'akimtropicashad@gmail.com'
on conflict (user_id) do update
set active = true, role = 'admin', updated_at = now();

create or replace function public.tc_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.admin_members m
    where m.user_id = auth.uid()
      and m.active = true
      and lower(m.role) in ('admin', 'ops', 'compliance', 'treasury')
  );
$$;

revoke all on function public.tc_is_admin() from public;
grant execute on function public.tc_is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 6) fraud_logs RLS — admin-only visibility; service role for inserts from jobs
-- ---------------------------------------------------------------------------

alter table public.fraud_logs enable row level security;

drop policy if exists "fraud_logs_select_authenticated" on public.fraud_logs;
drop policy if exists "fraud_logs_insert_authenticated" on public.fraud_logs;
drop policy if exists "fraud_logs_update_authenticated" on public.fraud_logs;

drop policy if exists "fraud_logs_select_admin" on public.fraud_logs;
create policy "fraud_logs_select_admin"
  on public.fraud_logs
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "fraud_logs_update_admin" on public.fraud_logs;
create policy "fraud_logs_update_admin"
  on public.fraud_logs
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

-- Users may insert fraud logs for their own user_id only (client-side fraud service)
drop policy if exists "fraud_logs_insert_own" on public.fraud_logs;
create policy "fraud_logs_insert_own"
  on public.fraud_logs
  for insert
  to authenticated
  with check (auth.uid() is not null and user_id = auth.uid());
