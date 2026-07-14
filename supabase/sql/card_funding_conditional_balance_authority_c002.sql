-- =============================================================================
-- Phase C-002 / E: Conditional balance authority for fund inserts
-- File: card_funding_conditional_balance_authority_c002.sql
-- Project: Tropicash Supabase ref opbhcndlibbcsmoaeymq
-- =============================================================================
--
-- WHY:
--   Option A made update_wallet_balance() a global no-op. That prevents double
--   credit for public.fund_wallet rows, but also breaks unmarked legacy inserts
--   of type='fund' that historically relied on trg_update_wallet_balance.
--
-- RULE:
--   Skip wallet mutation only when:
--     NEW.type = 'fund'
--     AND coalesce(NEW.metadata->>'balance_authority','') = 'fund_wallet_rpc'
--   Otherwise preserve prior behavior:
--     if type='fund' and status='completed' then credit recipient_id by amount.
--
-- SAFETY:
--   * CREATE OR REPLACE trigger function only — trigger object preserved
--   * No table drops / no historical rewrites / no fund_wallet body change
--   * search_path pinned to public
--   * metadata is jsonb nullable; coalesce handles NULL metadata safely
-- =============================================================================

create or replace function public.update_wallet_balance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.type = 'fund' and new.status = 'completed' then
      -- Canonical RPC already credited wallets.wallet_balance exactly once.
      if coalesce(new.metadata->>'balance_authority', '') = 'fund_wallet_rpc' then
        return new;
      end if;

      -- Legacy unmarked fund inserts: preserve prior trigger credit behavior.
      update public.wallets
      set wallet_balance = coalesce(wallet_balance, 0) + new.amount
      where user_id = new.recipient_id;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.update_wallet_balance() is
  'C-002 E: Credits wallet_balance on unmarked fund inserts; skips when metadata.balance_authority=fund_wallet_rpc (owned by public.fund_wallet).';
