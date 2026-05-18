-- Admin-only read policy for public.wallets to power the read-only Treasury
-- dashboard (pages/admin/treasury.jsx via lib/adminTreasury.js).
--
-- Background: wallets has RLS enabled and an existing own-row select policy
-- so user pages (pages/wallet.js, pages/fund-wallet.jsx, pages/withdraw-wallet.jsx)
-- continue to read their own wallet via the anon Supabase client. Admin
-- operators using the same anon client need a separate, admin-gated select
-- policy to roll up wallet liabilities. Without this policy admin reads return
-- "permission denied" and the Treasury "Wallet liabilities" card surfaces a
-- generic "Table not reachable" warning.
--
-- This migration is purely additive:
--   - It does NOT modify or drop any existing policy on public.wallets.
--   - It does NOT grant any insert/update/delete to admins (the dashboard is
--     read-only; wallet mutations stay locked behind existing SECURITY DEFINER
--     RPCs — see supabase/sql/wallet_transfer_withdraw_rpc.sql).
--   - Own-row access from the existing select policy continues to work; when
--     multiple permissive policies exist on the same operation/role, Postgres
--     OR-combines their USING clauses.
--
-- Admin gating reuses public.tc_is_admin() from
-- supabase/sql/withdrawal_requests.sql (kept in sync with lib/adminAccess.js
-- ADMIN_EMAILS). If that helper is unavailable the policy will fail to
-- evaluate for everyone — run withdrawal_requests.sql first.

alter table public.wallets enable row level security;

drop policy if exists "wallets_select_admin" on public.wallets;
create policy "wallets_select_admin"
  on public.wallets
  for select
  to authenticated
  using (public.tc_is_admin());

comment on policy "wallets_select_admin" on public.wallets is
  'Read-only admin access for the Treasury dashboard. Additive: own-row select policy still applies for non-admin users.';
