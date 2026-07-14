-- =============================================================================
-- Phase C-002 / D corrective: Option A transaction-type compatibility
-- File: card_funding_fund_wallet_type_compat_option_a_c002.sql
-- Project: Tropicash Supabase ref opbhcndlibbcsmoaeymq
-- =============================================================================
--
-- WHY:
--   C-001 inserted type='fund_wallet' to avoid trg_update_wallet_balance.
--   Compatibility audit found that bypasses lib/fraudService.js (type='fund' only)
--   and splits vocabulary against historical majority type='fund' rows.
--
-- DESIGN (OPTION A):
--   1) Neutralize update_wallet_balance auto-credit (RPC is sole funding authority)
--   2) fund_wallet inserts type='fund' with recipient_id/user_id for UI + fraud continuity
--   3) Credit wallets.wallet_balance exactly once inside fund_wallet
--   4) Do not DROP the trigger object; only remove balance mutation from its function
--
-- SAFETY:
--   * No DROP TABLE / no historical balance rewrite
--   * transfer/withdraw/refund RPCs untouched
--   * Grants remain service_role only for fund_wallet
-- =============================================================================

create or replace function public.update_wallet_balance()
returns trigger
language plpgsql
as $$
begin
  -- C-002 Option A: funding balance mutations are owned solely by public.fund_wallet.
  -- Legacy auto-credit on transactions.type='fund' is intentionally disabled to prevent
  -- double-credit when the RPC inserts a canonical fund row with recipient_id set.
  return NEW;
end;
$$;

comment on function public.update_wallet_balance() is
  'C-002 Option A: no-op. Wallet funding credits are applied only by public.fund_wallet.';

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

  -- Canonical public vocabulary: type='fund' (trigger no longer auto-credits).
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

revoke all on function public.fund_wallet(uuid, numeric) from public;
revoke all on function public.fund_wallet(uuid, numeric) from authenticated;
revoke all on function public.fund_wallet(uuid, numeric) from anon;
grant execute on function public.fund_wallet(uuid, numeric) to service_role;

comment on function public.fund_wallet(uuid, numeric) is
  'C-002 Option A: Credits wallet_balance exactly once; inserts one type=fund transaction; service_role only. Trigger auto-credit disabled.';
