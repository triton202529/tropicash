-- Phase 1 money-control remediation.
-- Closes direct client execution of balance-changing RPCs, unmarked funding
-- credits, withdrawal-refund fabrication, and world-readable profiles.
-- Does not change PayPal capture flow, payout automation, or Phase 14G/14H.
--
-- Apply after the July card-funding migrations. Do not edit those files.
-- Intended caller: the Tropicash API using the Supabase service role.
--
-- On project opbhcndlibbcsmoaeymq this script was applied as four idempotent
-- migrations that together match this file:
--   phase1_money_control_remediation
--   phase1_money_control_remediation_rpcs
--   phase1_money_control_remediation_withdrawal
--   phase1_money_control_remediation_refund
-- A fresh database should run this file once. Re-running it is safe.

-- ---------------------------------------------------------------------------
-- 1) Funding trigger: never credit a wallet from a transaction insert.
--    fund_wallet remains the only funding balance authority and still stamps
--    metadata.balance_authority = fund_wallet_rpc. This function must not add
--    that amount a second time, and it must not credit unmarked fund rows.
-- ---------------------------------------------------------------------------

create or replace function public.update_wallet_balance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT'
     and new.type = 'fund'
     and new.status = 'completed'
     and coalesce(new.metadata->>'balance_authority', '') = 'fund_wallet_rpc' then
    -- Already credited once inside public.fund_wallet. Do not add p_amount again.
    return new;
  end if;

  -- Unmarked fund inserts and every other transaction type do not change balances.
  return new;
end;
$$;

comment on function public.update_wallet_balance() is
  'Phase 1: no balance mutation. fund_wallet_rpc rows are skipped explicitly so the July single-credit repair cannot regress.';

-- ---------------------------------------------------------------------------
-- 2) Reject client-forged funding, withdrawal, and refund ledger rows.
--    Strip balance_authority from any insert that is not the service role,
--    so a client cannot forge fund_wallet_rpc or withdrawal debit proof.
-- ---------------------------------------------------------------------------

create or replace function public.reject_untrusted_balance_transactions()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_role text := coalesce(auth.role(), '');
  v_type text := lower(coalesce(new.type, ''));
begin
  if v_role is distinct from 'service_role' then
    if v_type in (
      'fund',
      'fund_wallet',
      'wallet_funded',
      'withdraw',
      'withdraw_wallet',
      'withdrawal_refund'
    ) then
      raise exception 'untrusted_balance_transaction'
        using errcode = '42501';
    end if;

    if new.metadata is not null and new.metadata ? 'balance_authority' then
      new.metadata := new.metadata - 'balance_authority';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reject_untrusted_balance_transactions on public.transactions;

create trigger trg_reject_untrusted_balance_transactions
  before insert on public.transactions
  for each row
  execute function public.reject_untrusted_balance_transactions();

comment on function public.reject_untrusted_balance_transactions() is
  'Phase 1: only the service role may insert funding, withdrawal, or refund ledger rows, or stamp balance_authority.';

revoke all on function public.reject_untrusted_balance_transactions() from public;
grant execute on function public.reject_untrusted_balance_transactions() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) fund_wallet: keep the certified single credit. Require service role.
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
  v_row_found boolean := false;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not_authorized';
  end if;

  if p_user_id is null then
    raise exception 'invalid_user';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  perform 1
  from public.wallets
  where user_id = p_user_id
  for update;

  select exists(
    select 1 from public.wallets where user_id = p_user_id
  ) into v_row_found;

  if v_row_found then
    update public.wallets
    set wallet_balance = coalesce(wallet_balance, 0) + p_amount
    where user_id = p_user_id
    returning wallet_balance into v_new_balance;
  else
    insert into public.wallets (user_id, wallet_balance)
    values (p_user_id, p_amount)
    returning wallet_balance into v_new_balance;
  end if;

  begin
    update public.wallets
    set balance = v_new_balance
    where user_id = p_user_id;
  exception
    when undefined_column then
      null;
  end;

  begin
    insert into public.transactions (
      sender_id,
      recipient_id,
      user_id,
      amount,
      type,
      status,
      description,
      metadata
    )
    values (
      null,
      p_user_id,
      p_user_id,
      p_amount,
      'fund',
      'completed',
      'Wallet funding',
      jsonb_build_object(
        'balance_authority', 'fund_wallet_rpc',
        'credited_amount', p_amount
      )
    )
    returning id into v_tx_id;
  exception
    when undefined_column then
      begin
        insert into public.transactions (
          sender_id,
          recipient_id,
          amount,
          type,
          status,
          description
        )
        values (
          null,
          p_user_id,
          p_amount,
          'fund',
          'completed',
          'Wallet funding'
        )
        returning id into v_tx_id;
      exception
        when undefined_column then
          insert into public.transactions (
            sender_id,
            recipient_id,
            amount,
            type,
            status
          )
          values (
            null,
            p_user_id,
            p_amount,
            'fund',
            'completed'
          )
          returning id into v_tx_id;
      end;
  end;

  return jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'wallet_balance', v_new_balance,
    'credited_amount', p_amount,
    'transaction_type', 'fund'
  );
end;
$$;

comment on function public.fund_wallet(uuid, numeric) is
  'Phase 1: service_role only. Credits wallet_balance once by p_amount and inserts one fund row stamped fund_wallet_rpc.';

-- ---------------------------------------------------------------------------
-- 4) transfer_funds: preserve live movement math. Service role only.
-- ---------------------------------------------------------------------------

create or replace function public.transfer_funds(
  sender_id uuid,
  recipient_id uuid,
  amount numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_balance numeric;
  recipient_balance numeric;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not_authorized';
  end if;

  if sender_id is null or recipient_id is null then
    raise exception 'not_authorized';
  end if;

  if sender_id = recipient_id then
    raise exception 'cannot_send_to_self';
  end if;

  if amount is null or amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  select greatest(coalesce(wallet_balance, 0), coalesce(balance, 0))
  into sender_balance
  from public.wallets
  where user_id = sender_id
  for update;

  if sender_balance is null or sender_balance < amount then
    raise exception 'insufficient_funds';
  end if;

  update public.wallets
  set wallet_balance = sender_balance - amount,
      balance = sender_balance - amount
  where user_id = sender_id;

  select greatest(coalesce(wallet_balance, 0), coalesce(balance, 0))
  into recipient_balance
  from public.wallets
  where user_id = recipient_id
  for update;

  if recipient_balance is null then
    insert into public.wallets (user_id, wallet_balance, balance)
    values (recipient_id, amount, amount);
  else
    update public.wallets
    set wallet_balance = recipient_balance + amount,
        balance = recipient_balance + amount
    where user_id = recipient_id;
  end if;

  insert into public.transactions (
    sender_id,
    recipient_id,
    amount,
    type,
    status,
    created_at
  )
  values (
    sender_id,
    recipient_id,
    amount,
    'send_money',
    'completed',
    now()
  );
end;
$$;

comment on function public.transfer_funds(uuid, uuid, numeric) is
  'Phase 1: service_role only. Clients must use the Tropicash transfer API.';

-- ---------------------------------------------------------------------------
-- 5) create_withdrawal_request: service role may debit. Clients may not.
--    The ledger row is the debit proof a later refund must match.
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
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    raise exception 'not_authorized';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  v_email := nullif(trim(coalesce(p_payout_email, '')), '');
  if v_email is null then
    raise exception 'payout_email_required';
  end if;

  select coalesce(wallet_balance, balance)
  into v_wallet_balance
  from public.wallets
  where user_id = p_user_id
  for update;

  if v_wallet_balance is null then
    raise exception 'wallet_not_found';
  end if;

  if v_wallet_balance < p_amount then
    raise exception 'insufficient_funds';
  end if;

  update public.wallets
  set
    wallet_balance = coalesce(wallet_balance, balance) - p_amount,
    balance = coalesce(wallet_balance, balance) - p_amount
  where user_id = p_user_id;

  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'wallet_not_found';
  end if;

  insert into public.withdrawal_requests (
    user_id,
    amount,
    status,
    payout_email,
    payout_destination,
    payout_label,
    created_at
  )
  values (
    p_user_id,
    p_amount,
    'pending',
    v_email,
    v_email,
    'PayPal',
    now()
  )
  returning id into v_request_id;

  v_desc := 'Withdrawal request · id ' || v_request_id::text;

  begin
    insert into public.transactions (
      sender_id,
      user_id,
      amount,
      type,
      status,
      note,
      created_at,
      metadata
    )
    values (
      p_user_id,
      p_user_id,
      p_amount,
      'withdraw_wallet',
      'completed',
      v_desc,
      now(),
      jsonb_build_object(
        'balance_authority', 'create_withdrawal_request_rpc',
        'withdrawal_request_id', v_request_id::text,
        'debited_amount', p_amount
      )
    )
    returning id into v_tx_id;
  exception
    when undefined_column then
      insert into public.transactions (
        sender_id,
        user_id,
        amount,
        type,
        status,
        created_at,
        metadata
      )
      values (
        p_user_id,
        p_user_id,
        p_amount,
        'withdraw_wallet',
        'completed',
        now(),
        jsonb_build_object(
          'balance_authority', 'create_withdrawal_request_rpc',
          'withdrawal_request_id', v_request_id::text,
          'debited_amount', p_amount
        )
      )
      returning id into v_tx_id;
  end;

  update public.withdrawal_requests
  set withdrawal_transaction_id = v_tx_id
  where id = v_request_id;

  return v_request_id;
end;
$$;

comment on function public.create_withdrawal_request(uuid, numeric, text) is
  'Phase 1: service_role only. Debits the wallet and stamps withdrawal debit proof on the ledger row.';

-- ---------------------------------------------------------------------------
-- 6) refund_withdrawal_request: one restoration, only with proven debit.
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
  v_debit public.transactions%rowtype;
  v_amount numeric;
  v_tx_id uuid;
  v_desc text;
  v_status text;
  v_new_balance numeric;
  n int;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    return jsonb_build_object('outcome', 'error', 'message', 'not_authorized');
  end if;

  if p_withdrawal_request_id is null then
    return jsonb_build_object('outcome', 'error', 'message', 'withdrawal_request_id_required');
  end if;

  select *
  into v_row
  from public.withdrawal_requests
  where id = p_withdrawal_request_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'error', 'message', 'withdrawal_not_found');
  end if;

  if v_row.refunded_at is not null or v_row.refund_transaction_id is not null then
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
  if v_amount is null or v_amount <= 0 or v_row.user_id is null then
    return jsonb_build_object('outcome', 'error', 'message', 'invalid_amount');
  end if;

  if v_row.withdrawal_transaction_id is null then
    return jsonb_build_object('outcome', 'error', 'message', 'debit_not_proven');
  end if;

  select *
  into v_debit
  from public.transactions
  where id = v_row.withdrawal_transaction_id;

  if not found
     or lower(coalesce(v_debit.type, '')) not in ('withdraw_wallet', 'withdraw')
     or v_debit.status is distinct from 'completed'
     or v_debit.amount is distinct from v_amount
     or coalesce(v_debit.sender_id, v_debit.user_id) is distinct from v_row.user_id
     or coalesce(v_debit.metadata->>'balance_authority', '')
          is distinct from 'create_withdrawal_request_rpc'
     or coalesce(v_debit.metadata->>'withdrawal_request_id', '')
          is distinct from p_withdrawal_request_id::text
  then
    return jsonb_build_object('outcome', 'error', 'message', 'debit_not_proven');
  end if;

  update public.wallets
  set
    wallet_balance = coalesce(wallet_balance, 0) + v_amount,
    balance = coalesce(wallet_balance, 0) + v_amount
  where user_id = v_row.user_id
  returning wallet_balance into v_new_balance;

  get diagnostics n = row_count;
  if n = 0 then
    insert into public.wallets (user_id, wallet_balance, balance)
    values (v_row.user_id, v_amount, v_amount)
    returning wallet_balance into v_new_balance;
  end if;

  v_desc := 'Withdrawal refund · request ' || p_withdrawal_request_id::text;
  if p_reason is not null and trim(p_reason) <> '' then
    v_desc := v_desc || ' · ' || left(trim(p_reason), 200);
  end if;

  insert into public.transactions (
    recipient_id,
    user_id,
    amount,
    type,
    status,
    description,
    metadata
  )
  values (
    v_row.user_id,
    v_row.user_id,
    v_amount,
    'withdrawal_refund',
    'completed',
    v_desc,
    jsonb_build_object(
      'balance_authority', 'refund_withdrawal_request_rpc',
      'withdrawal_request_id', p_withdrawal_request_id::text,
      'restored_amount', v_amount
    )
  )
  returning id into v_tx_id;

  update public.withdrawal_requests
  set
    refunded_at = now(),
    refund_transaction_id = v_tx_id,
    refund_reason = nullif(trim(coalesce(p_reason, '')), ''),
    refunded_by = p_admin_user_id,
    updated_at = now()
  where id = p_withdrawal_request_id
    and refunded_at is null
    and refund_transaction_id is null;

  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'refund_conflict';
  end if;

  return jsonb_build_object(
    'outcome', 'refunded',
    'withdrawal_request_id', p_withdrawal_request_id,
    'user_id', v_row.user_id,
    'amount', v_amount,
    'transaction_id', v_tx_id,
    'wallet_balance', v_new_balance,
    'refunded_at', now()
  );
exception
  when others then
    return jsonb_build_object(
      'outcome', 'error',
      'message', sqlerrm
    );
end;
$$;

comment on function public.refund_withdrawal_request(uuid, text, uuid) is
  'Phase 1: service_role only. Credits a wallet once, and only when a matching stamped withdrawal debit exists.';

-- ---------------------------------------------------------------------------
-- 7) Grants. Clients cannot execute money RPCs. Service role can.
-- ---------------------------------------------------------------------------

revoke all on function public.fund_wallet(uuid, numeric) from public;
revoke all on function public.fund_wallet(uuid, numeric) from anon;
revoke all on function public.fund_wallet(uuid, numeric) from authenticated;
grant execute on function public.fund_wallet(uuid, numeric) to service_role;

revoke all on function public.transfer_funds(uuid, uuid, numeric) from public;
revoke all on function public.transfer_funds(uuid, uuid, numeric) from anon;
revoke all on function public.transfer_funds(uuid, uuid, numeric) from authenticated;
grant execute on function public.transfer_funds(uuid, uuid, numeric) to service_role;

revoke all on function public.create_withdrawal_request(uuid, numeric, text) from public;
revoke all on function public.create_withdrawal_request(uuid, numeric, text) from anon;
revoke all on function public.create_withdrawal_request(uuid, numeric, text) from authenticated;
grant execute on function public.create_withdrawal_request(uuid, numeric, text) to service_role;

revoke all on function public.refund_withdrawal_request(uuid, text, uuid) from public;
revoke all on function public.refund_withdrawal_request(uuid, text, uuid) from anon;
revoke all on function public.refund_withdrawal_request(uuid, text, uuid) from authenticated;
grant execute on function public.refund_withdrawal_request(uuid, text, uuid) to service_role;

revoke all on function public.credit_wallet(uuid, numeric) from public;
revoke all on function public.credit_wallet(uuid, numeric) from anon;
revoke all on function public.credit_wallet(uuid, numeric) from authenticated;
revoke all on function public.credit_wallet(uuid, numeric) from service_role;

-- ---------------------------------------------------------------------------
-- 8) Client funding inserts are not a balance path.
-- ---------------------------------------------------------------------------

drop policy if exists "Allow user to fund self" on public.transactions;
drop policy if exists "Allow wallet funding" on public.transactions;

-- Clients must not create withdrawal rows that a refund could later misread.
drop policy if exists "insert_own" on public.withdrawal_requests;

-- ---------------------------------------------------------------------------
-- 9) Profiles: own row, or admin. No world read of email, phone, or payout email.
-- ---------------------------------------------------------------------------

drop policy if exists "Allow reading all profiles" on public.profiles;

drop policy if exists "Allow user to read own profile" on public.profiles;
create policy "Allow user to read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles
  for select
  to authenticated
  using (public.tc_is_admin());

-- ---------------------------------------------------------------------------
-- 10) Keep PayPal funding idempotency uniqueness if the table is present.
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('public.funding_idempotency_keys') is not null
     and not exists (
       select 1
       from pg_indexes
       where schemaname = 'public'
         and indexname = 'funding_idempotency_unique_provider_order'
     ) then
    create unique index funding_idempotency_unique_provider_order
      on public.funding_idempotency_keys (provider, provider_order_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 11) Fail closed if the grants did not stick.
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select p.proname,
           has_function_privilege('anon', p.oid, 'execute') as anon_exec,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
           has_function_privilege('service_role', p.oid, 'execute') as service_exec
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'fund_wallet',
        'transfer_funds',
        'create_withdrawal_request',
        'refund_withdrawal_request'
      )
  loop
    if r.anon_exec or r.auth_exec or not r.service_exec then
      raise exception 'money_control_grant_failed: %', r.proname;
    end if;
  end loop;

  if has_function_privilege(
       'authenticated',
       'public.credit_wallet(uuid, numeric)',
       'execute'
     )
     or has_function_privilege(
       'anon',
       'public.credit_wallet(uuid, numeric)',
       'execute'
     )
     or has_function_privilege(
       'service_role',
       'public.credit_wallet(uuid, numeric)',
       'execute'
     ) then
    raise exception 'money_control_grant_failed: credit_wallet';
  end if;
end $$;
