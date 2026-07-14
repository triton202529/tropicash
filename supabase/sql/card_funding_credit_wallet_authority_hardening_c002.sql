-- =============================================================================
-- Phase C-002 / F: Harden public.credit_wallet authority
-- File: card_funding_credit_wallet_authority_hardening_c002.sql
-- Project: Tropicash Supabase ref opbhcndlibbcsmoaeymq
-- =============================================================================
--
-- FINDING:
--   Single overload public.credit_wallet(uuid, numeric) RETURNS void
--   SECURITY INVOKER, no search_path, no authz/amount checks, no transaction row.
--   EXECUTE granted to PUBLIC, anon, authenticated, and service_role.
--   No repository or database callers found.
--
-- ACTION:
--   * Recreate with SET search_path = public (body unchanged)
--   * Revoke EXECUTE from PUBLIC, anon, authenticated, service_role
--   * Mark DEPRECATED — canonical funding is public.fund_wallet
--   * Do not DROP (callers reconfirmed absent; keep for emergency owner SQL only)
--
-- ROLLBACK (incident-only; do NOT restore client EXECUTE):
--   -- grant execute on function public.credit_wallet(uuid, numeric) to service_role;
--   -- Prefer migrating any rediscovered caller to public.fund_wallet instead.
-- =============================================================================

create or replace function public.credit_wallet(
  user_id_input uuid,
  amount_input numeric
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- DEPRECATED legacy mutator. Prefer public.fund_wallet for funding credits.
  update public.wallets
  set wallet_balance = wallet_balance + amount_input
  where user_id = user_id_input;
end;
$$;

revoke all on function public.credit_wallet(uuid, numeric) from public;
revoke all on function public.credit_wallet(uuid, numeric) from anon;
revoke all on function public.credit_wallet(uuid, numeric) from authenticated;
revoke all on function public.credit_wallet(uuid, numeric) from service_role;

comment on function public.credit_wallet(uuid, numeric) is
  'DEPRECATED C-002 F: legacy wallet_balance mutator without transaction/ledger. EXECUTE revoked from client and service_role. Use public.fund_wallet for funding.';
