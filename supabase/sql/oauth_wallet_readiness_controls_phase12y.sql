-- Tropicash OAuth Platform — Phase 12Y: wallet readiness operational controls.
--
-- Adds OAuth-protected endpoint rate limiting foundation, wallet-read audit
-- event types, and admin review cases for suspicious wallet.read access.
--
-- Scope: operational controls ONLY. Does NOT create wallet endpoints, expose
-- wallet balances, enable money movement, or modify treasury/fraud/KYC state.
--
-- Dependencies:
--   • supabase/sql/oauth_consent_foundation_phase12k.sql
--   • supabase/sql/oauth_authorization_codes_phase12o.sql

-- ===========================================================================
-- 1. oauth_api_usage_logs — append-only OAuth API request log (rate limits).
-- ===========================================================================

create table if not exists public.oauth_api_usage_logs (
  id uuid primary key default gen_random_uuid(),
  access_token_id uuid not null
    references public.oauth_access_tokens (id) on delete cascade,
  client_id uuid
    references public.oauth_clients (id) on delete set null,
  user_id uuid
    references auth.users (id) on delete set null,
  endpoint text not null,
  method text not null,
  status_code integer,
  created_at timestamptz not null default now()
);

create index if not exists oauth_api_usage_logs_access_token_id_idx
  on public.oauth_api_usage_logs (access_token_id);

create index if not exists oauth_api_usage_logs_client_id_idx
  on public.oauth_api_usage_logs (client_id);

create index if not exists oauth_api_usage_logs_user_id_idx
  on public.oauth_api_usage_logs (user_id);

create index if not exists oauth_api_usage_logs_created_at_idx
  on public.oauth_api_usage_logs (created_at desc);

create index if not exists oauth_api_usage_logs_token_created_at_idx
  on public.oauth_api_usage_logs (access_token_id, created_at desc);

comment on table public.oauth_api_usage_logs is
  'Phase 12Y: append-only OAuth protected-API request log. Drives per-token rate limits. Never stores tokens, hashes, or wallet payloads.';

-- ===========================================================================
-- 2. oauth_access_review_cases — admin review queue (no auto enforcement).
-- ===========================================================================

create table if not exists public.oauth_access_review_cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid
    references public.oauth_clients (id) on delete set null,
  user_id uuid
    references auth.users (id) on delete set null,
  access_token_id uuid
    references public.oauth_access_tokens (id) on delete set null,
  reason text not null,
  severity text not null default 'medium'
    constraint oauth_access_review_cases_severity_ck
      check (severity in ('low', 'medium', 'high')),
  status text not null default 'open'
    constraint oauth_access_review_cases_status_ck
      check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists oauth_access_review_cases_status_idx
  on public.oauth_access_review_cases (status);

create index if not exists oauth_access_review_cases_client_id_idx
  on public.oauth_access_review_cases (client_id);

create index if not exists oauth_access_review_cases_created_at_idx
  on public.oauth_access_review_cases (created_at desc);

comment on table public.oauth_access_review_cases is
  'Phase 12Y: admin review queue for suspicious OAuth wallet.read access patterns. Review-only — no automatic account restrictions.';

-- ===========================================================================
-- 3. Expand oauth_audit_events event types (idempotent).
-- ===========================================================================

alter table public.oauth_audit_events drop constraint if exists oauth_audit_events_type_ck;
alter table public.oauth_audit_events
  add constraint oauth_audit_events_type_ck
  check (event_type in (
    'consent_granted',
    'consent_revoked',
    'token_issued',
    'token_revoked',
    'token_refresh_attempt',
    'oauth_client_disabled',
    'suspicious_oauth_activity',
    'authorization_code_issued',
    'token_refreshed',
    'refresh_token_reuse_detected',
    'access_token_validated',
    'access_token_rejected',
    'wallet_read_performed',
    'wallet_read_blocked',
    'wallet_read_suspicious',
    'oauth_rate_limit_exceeded'
  ));

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.oauth_api_usage_logs enable row level security;
alter table public.oauth_access_review_cases enable row level security;

-- oauth_api_usage_logs: service-role insert only (no authenticated insert).
-- Admins read all; users read own rows when user_id matches.

drop policy if exists "oauth_api_usage_logs_select_owner"
  on public.oauth_api_usage_logs;
create policy "oauth_api_usage_logs_select_owner"
  on public.oauth_api_usage_logs
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "oauth_api_usage_logs_select_admin"
  on public.oauth_api_usage_logs;
create policy "oauth_api_usage_logs_select_admin"
  on public.oauth_api_usage_logs
  for select
  to authenticated
  using (public.tc_is_admin());

grant select on public.oauth_api_usage_logs to authenticated;

-- oauth_access_review_cases: admins only (select + update).

drop policy if exists "oauth_access_review_cases_select_admin"
  on public.oauth_access_review_cases;
create policy "oauth_access_review_cases_select_admin"
  on public.oauth_access_review_cases
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "oauth_access_review_cases_update_admin"
  on public.oauth_access_review_cases;
create policy "oauth_access_review_cases_update_admin"
  on public.oauth_access_review_cases
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

grant select, update on public.oauth_access_review_cases to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Replace each `using (public.tc_is_admin())` admin policy with an explicit
-- email allow-list on auth.users, kept in sync with lib/adminAccess.js
-- ADMIN_EMAILS — same pattern as developer_center_phase1.sql.
-- ---------------------------------------------------------------------------
