-- Phase 13D: Ledger consistency — log withdraw_wallet transaction on withdrawal request creation.
-- Run after phase_13c_withdrawal_refunds.sql and create_withdrawal_request RPC exist.
-- Does not change wallet debit amount, payout execution, or refund eligibility rules.

-- ---------------------------------------------------------------------------
-- 1) Link withdrawal_requests → transactions (debit row)
-- ---------------------------------------------------------------------------
alter table public.withdrawal_requests
  add column if not exists withdrawal_transaction_id uuid references public.transactions (id) on delete set null;

comment on column public.withdrawal_requests.withdrawal_transaction_id is
  'transactions.id for the withdraw_wallet debit when the request was created (Phase 13D).';

create index if not exists withdrawal_requests_withdrawal_transaction_id_idx
  on public.withdrawal_requests (withdrawal_transaction_id)
  where withdrawal_transaction_id is not null;

create unique index if not exists withdrawal_requests_withdrawal_transaction_id_unique
  on public.withdrawal_requests (withdrawal_transaction_id)
  where withdrawal_transaction_id is not null;

-- ---------------------------------------------------------------------------
-- 2) create_withdrawal_request — same signature; adds ledger row in same transaction
-- Duplicate transaction insert prevented: one insert per RPC call; row link via withdrawal_transaction_id.
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

  update public.withdrawal_requests
  set withdrawal_transaction_id = v_tx_id
  where id = v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.create_withdrawal_request(uuid, numeric, text) from public;
grant execute on function public.create_withdrawal_request(uuid, numeric, text) to authenticated;

comment on function public.create_withdrawal_request(uuid, numeric, text) is
  'Debits wallet, creates withdrawal_requests row, and logs withdraw_wallet transaction (Phase 13D).';

-- ---------------------------------------------------------------------------
-- 3) Refund note linkage (display only; no refund eligibility change)
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
  if v_row.withdrawal_transaction_id is not null then
    v_desc := v_desc || ' · debit txn ' || v_row.withdrawal_transaction_id::text;
  end if;
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
    'withdrawal_transaction_id', v_row.withdrawal_transaction_id,
    'refunded_at', now()
  );
exception
  when others then
    return jsonb_build_object('outcome', 'error', 'message', sqlerrm);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Idempotent backfill for historical withdrawal_requests missing ledger rows
-- Run manually: select public.backfill_withdrawal_transaction_ledger(500);
-- ---------------------------------------------------------------------------
create or replace function public.backfill_withdrawal_transaction_ledger(p_limit int default 200)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.withdrawal_requests%rowtype;
  v_tx_id uuid;
  v_desc text;
  v_linked int := 0;
  v_inserted int := 0;
  v_skipped int := 0;
  v_processed int := 0;
  v_limit int;
begin
  v_limit := greatest(coalesce(p_limit, 200), 1);

  for v_row in
    select *
    from public.withdrawal_requests
    where withdrawal_transaction_id is null
    order by created_at asc
    limit v_limit
  loop
    v_processed := v_processed + 1;
    v_tx_id := null;

    select t.id into v_tx_id
    from public.transactions t
    where t.type in ('withdraw_wallet', 'withdraw')
      and t.sender_id = v_row.user_id
      and t.amount = v_row.amount
      and (
        coalesce(t.note, '') like '%' || v_row.id::text || '%'
        or coalesce(t.description, '') like '%' || v_row.id::text || '%'
      )
    order by abs(extract(epoch from (t.created_at - v_row.created_at)))
    limit 1;

    if v_tx_id is null then
      select t.id into v_tx_id
      from public.transactions t
      where t.type in ('withdraw_wallet', 'withdraw')
        and t.sender_id = v_row.user_id
        and t.amount = v_row.amount
        and t.created_at between v_row.created_at - interval '10 minutes' and v_row.created_at + interval '10 minutes'
        and not exists (
          select 1
          from public.withdrawal_requests wr
          where wr.withdrawal_transaction_id = t.id
            and wr.id <> v_row.id
        )
      order by abs(extract(epoch from (t.created_at - v_row.created_at)))
      limit 1;
    end if;

    if v_tx_id is null then
      v_desc := 'Withdrawal request · id ' || v_row.id::text || ' · backfill';
      begin
        insert into public.transactions (sender_id, amount, type, status, note, created_at)
        values (v_row.user_id, v_row.amount, 'withdraw_wallet', 'completed', v_desc, v_row.created_at)
        returning id into v_tx_id;
      exception
        when sqlstate '42703' then
          insert into public.transactions (sender_id, amount, type, status, created_at)
          values (v_row.user_id, v_row.amount, 'withdraw_wallet', 'completed', v_row.created_at)
          returning id into v_tx_id;
      end;
      v_inserted := v_inserted + 1;
    else
      v_linked := v_linked + 1;
    end if;

    update public.withdrawal_requests
    set withdrawal_transaction_id = v_tx_id
    where id = v_row.id
      and withdrawal_transaction_id is null;

    get diagnostics n = row_count;
    if n = 0 then
      v_skipped := v_skipped + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'processed', v_processed,
    'linked_existing', v_linked,
    'inserted', v_inserted,
    'skipped', v_skipped
  );
end;
$$;

revoke all on function public.backfill_withdrawal_transaction_ledger(int) from public;
grant execute on function public.backfill_withdrawal_transaction_ledger(int) to service_role;

comment on function public.backfill_withdrawal_transaction_ledger(int) is
  'Phase 13D: idempotent backfill of withdraw_wallet transactions for legacy withdrawal_requests.';
