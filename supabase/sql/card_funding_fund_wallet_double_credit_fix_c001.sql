-- NOTE (2026-07-13): Superseded for transaction-type choice by
--   supabase/sql/card_funding_fund_wallet_type_compat_option_a_c002.sql
-- which restores type='fund' and disables trigger auto-credit (Option A).
-- Do not re-apply this C-001 insert-as-fund_wallet path on Tropicash without review.
--
-- ROOT CAUSE (live pg_get_functiondef + trigger inspection, 2026-07-13):
--   * Live public.fund_wallet(uuid, numeric) RETURNS void, SECURITY DEFINER
--   * Body inserts transactions(type='fund', recipient_id=p_user_id, status='completed')
--   * AFTER INSERT trigger trg_update_wallet_balance → update_wallet_balance()
--     credits wallets.wallet_balance by NEW.amount when type='fund' and recipient_id set
--   * Same function then UPDATE wallets SET wallet_balance = wallet_balance + p_amount
--   * Net effect: wallet_balance increases by exactly 2 × p_amount
--
-- DESIGN:
--   * fund_wallet is the SOLE funding balance authority (explicit UPDATE once)
--   * Insert funding transaction as type 'fund_wallet' so the legacy fund trigger
--     does NOT add a second credit (trigger only handles type='fund')
--   * Fallback type='fund' inserts MUST omit recipient_id so the trigger matches
--     zero wallet rows if the check constraint forces that path
--   * Legacy balance column: SET equal to wallet_balance (never add again)
--   * Return jsonb receipt for capture-order callers
--   * service_role execute only
--
-- SAFETY:
--   * DROP then CREATE required: live returns void; replacement returns jsonb
--     (PostgreSQL CREATE OR REPLACE cannot change return type)
--   * No DROP TABLE / no historical balance rewrite
--   * Does not disable trg_update_wallet_balance or other generic triggers
--   * Does not modify transfer_funds / withdrawal / refund RPCs
--   * Tightens EXECUTE grants (revoke anon/authenticated/public)
--
-- APPLY:
--   Prefer Supabase MCP apply_migration for project opbhcndlibbcsmoaeymq
--   Or SQL Editor on the same project after confirming PAYPAL_MODE=sandbox
--
-- ROLLBACK:
--   Restore previous fund_wallet definition from
--   data/results/card_funding_fund_wallet_pre_migration.json
--   Do not re-deploy a 2× credit implementation.
-- =============================================================================

-- Return type changes void → jsonb; DROP is required before recreate.
drop function if exists public.fund_wallet(uuid, numeric);

create function public.fund_wallet(
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
  if p_user_id is null then
    raise exception 'invalid_user';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- Lock existing wallet row when present (serialize concurrent funds).
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

  -- Legacy column: assign equality only (must never add p_amount again).
  begin
    update public.wallets
    set balance = v_new_balance
    where user_id = p_user_id;
  exception
    when undefined_column then
      null;
  end;

  -- Prefer type fund_wallet so trg_update_wallet_balance (fund+recipient_id) does not fire.
  begin
    insert into public.transactions (
      sender_id,
      user_id,
      amount,
      type,
      status,
      description
    )
    values (
      p_user_id,
      p_user_id,
      p_amount,
      'fund_wallet',
      'completed',
      'Wallet funding'
    )
    returning id into v_tx_id;
  exception
    when check_violation then
      -- Fallback type='fund' intentionally omits recipient_id so the legacy
      -- fund trigger cannot credit a second time (it keys off recipient_id).
      insert into public.transactions (
        sender_id,
        user_id,
        amount,
        type,
        status,
        description
      )
      values (
        p_user_id,
        p_user_id,
        p_amount,
        'fund',
        'completed',
        'Wallet funding'
      )
      returning id into v_tx_id;
    when undefined_column then
      -- Minimal insert if user_id / description columns differ in older schemas
      begin
        insert into public.transactions (
          sender_id,
          amount,
          type,
          status
        )
        values (
          p_user_id,
          p_amount,
          'fund_wallet',
          'completed'
        )
        returning id into v_tx_id;
      exception
        when check_violation then
          insert into public.transactions (
            sender_id,
            amount,
            type,
            status
          )
          values (
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
    'credited_amount', p_amount
  );
end;
$$;

revoke all on function public.fund_wallet(uuid, numeric) from public;
revoke all on function public.fund_wallet(uuid, numeric) from authenticated;
revoke all on function public.fund_wallet(uuid, numeric) from anon;
grant execute on function public.fund_wallet(uuid, numeric) to service_role;

comment on function public.fund_wallet(uuid, numeric) is
  'C-002: Credits wallets.wallet_balance exactly once by p_amount; inserts one funding transaction; service_role only.';
