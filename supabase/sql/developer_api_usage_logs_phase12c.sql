-- Tropicash Developer Center — Phase 12C: API usage logs & rate limit foundation.
--
-- Append-only request log for the Developer API. Every successfully authenticated
-- + rate-limited request is recorded here (method, endpoint, status, request id,
-- ip). Rate limiting is computed by counting rows in this table per api_key_id
-- inside a rolling window. NO secret keys, secret hashes, or Authorization
-- headers are ever stored.
--
-- Scope: Developer Platform only. Does NOT touch wallets, send money,
-- withdrawals, treasury, fraud, PayPal, or user balances.
--
-- ---------------------------------------------------------------------------
-- Migration order / dependencies
-- ---------------------------------------------------------------------------
--
--   1. `supabase/sql/developer_orgs_phase4a.sql`        — orgs/apps + ownership for RLS.
--   2. `supabase/sql/developer_api_keys_phase12a.sql`   — developer_api_keys (api_key_id FK).
--   3. THIS FILE — `developer_api_usage_logs`.
--
-- Admin gating uses public.tc_is_admin() (see developer_orgs_phase4a.sql /
-- lib/adminAccess.js). Inserts are performed server-side with the service-role
-- key (RLS bypassed); developers only ever read their own org's rows.

create table if not exists public.developer_api_usage_logs (
  id uuid primary key default gen_random_uuid(),
  api_key_id uuid not null
    references public.developer_api_keys (id) on delete cascade,
  organization_id uuid not null
    references public.developer_organizations (id) on delete cascade,
  app_id uuid not null
    references public.developer_apps (id) on delete cascade,
  endpoint text not null,
  method text not null,
  status_code integer,
  request_id text,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists developer_api_usage_logs_api_key_id_idx
  on public.developer_api_usage_logs (api_key_id);

create index if not exists developer_api_usage_logs_organization_id_idx
  on public.developer_api_usage_logs (organization_id);

create index if not exists developer_api_usage_logs_app_id_idx
  on public.developer_api_usage_logs (app_id);

create index if not exists developer_api_usage_logs_created_at_idx
  on public.developer_api_usage_logs (created_at desc);

-- Composite index optimizes the rate-limit window count (per key, recent first).
create index if not exists developer_api_usage_logs_key_created_at_idx
  on public.developer_api_usage_logs (api_key_id, created_at desc);

comment on table public.developer_api_usage_logs is
  'Phase 12C: append-only Developer API request log. Drives rate limiting + usage dashboards. Never stores secrets, hashes, or auth headers.';

-- ---------------------------------------------------------------------------
-- Row level security
--
-- Members (org owners) read usage rows for their organizations; admins read all.
-- Inserts happen exclusively via the server-side service-role client, which
-- bypasses RLS — there is intentionally NO insert policy for authenticated
-- users, so developers cannot forge or tamper with usage logs.
-- ---------------------------------------------------------------------------

alter table public.developer_api_usage_logs enable row level security;

drop policy if exists "developer_api_usage_logs_select_member"
  on public.developer_api_usage_logs;
create policy "developer_api_usage_logs_select_member"
  on public.developer_api_usage_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.developer_organizations o
      where o.id = organization_id
        and o.owner_user_id = auth.uid()
    )
  );

drop policy if exists "developer_api_usage_logs_select_admin"
  on public.developer_api_usage_logs;
create policy "developer_api_usage_logs_select_admin"
  on public.developer_api_usage_logs
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "developer_api_usage_logs_delete_admin"
  on public.developer_api_usage_logs;
create policy "developer_api_usage_logs_delete_admin"
  on public.developer_api_usage_logs
  for delete
  to authenticated
  using (public.tc_is_admin());

grant select on public.developer_api_usage_logs to authenticated;
grant delete on public.developer_api_usage_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Replace each `using (public.tc_is_admin())` admin policy with an explicit
-- email allow-list on auth.users, kept in sync with lib/adminAccess.js
-- ADMIN_EMAILS — same pattern as developer_center_phase1.sql.
-- ---------------------------------------------------------------------------
