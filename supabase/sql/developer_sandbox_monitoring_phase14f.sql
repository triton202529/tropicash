-- Tropicash Developer Platform — Phase 14F: sandbox monitoring & risk control.
--
-- Operational activity logging and risk case queue for approved sandbox developers.
-- Review cases only — no automatic suspension. No secrets, tokens, or payment data.
--
-- Dependencies:
--   • public.tc_is_admin() from withdrawal_requests.sql

-- ===========================================================================
-- developer_sandbox_activity
-- ===========================================================================

create table if not exists public.developer_sandbox_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users (id) on delete cascade,
  developer_app_id uuid,
  activity_type text not null,
  resource text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.developer_sandbox_activity
  drop constraint if exists developer_sandbox_activity_type_ck;

alter table public.developer_sandbox_activity
  add constraint developer_sandbox_activity_type_ck
    check (activity_type in (
      'credential_created',
      'oauth_client_created',
      'oauth_test_run',
      'oauth_wallet_access',
      'api_usage_spike',
      'rate_limit_exceeded',
      'access_denied'
    ));

create index if not exists developer_sandbox_activity_user_id_idx
  on public.developer_sandbox_activity (user_id);

create index if not exists developer_sandbox_activity_app_id_idx
  on public.developer_sandbox_activity (developer_app_id);

create index if not exists developer_sandbox_activity_type_idx
  on public.developer_sandbox_activity (activity_type);

create index if not exists developer_sandbox_activity_created_at_idx
  on public.developer_sandbox_activity (created_at desc);

comment on table public.developer_sandbox_activity is
  'Phase 14F: Sandbox developer activity feed. Metadata only — no secrets or tokens.';

-- ===========================================================================
-- developer_sandbox_risk_cases
-- ===========================================================================

create table if not exists public.developer_sandbox_risk_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users (id) on delete cascade,
  developer_app_id uuid,
  severity text not null,
  reason text not null,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.developer_sandbox_risk_cases
  drop constraint if exists developer_sandbox_risk_cases_severity_ck;

alter table public.developer_sandbox_risk_cases
  add constraint developer_sandbox_risk_cases_severity_ck
    check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

alter table public.developer_sandbox_risk_cases
  drop constraint if exists developer_sandbox_risk_cases_status_ck;

alter table public.developer_sandbox_risk_cases
  add constraint developer_sandbox_risk_cases_status_ck
    check (status in ('open', 'reviewing', 'resolved', 'dismissed'));

create index if not exists developer_sandbox_risk_cases_user_id_idx
  on public.developer_sandbox_risk_cases (user_id);

create index if not exists developer_sandbox_risk_cases_severity_idx
  on public.developer_sandbox_risk_cases (severity);

create index if not exists developer_sandbox_risk_cases_status_idx
  on public.developer_sandbox_risk_cases (status);

create index if not exists developer_sandbox_risk_cases_created_at_idx
  on public.developer_sandbox_risk_cases (created_at desc);

comment on table public.developer_sandbox_risk_cases is
  'Phase 14F: Sandbox risk review queue. Creates cases only — no automatic suspension.';

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.developer_sandbox_activity enable row level security;
alter table public.developer_sandbox_risk_cases enable row level security;

drop policy if exists "developer_sandbox_activity_insert_own"
  on public.developer_sandbox_activity;
create policy "developer_sandbox_activity_insert_own"
  on public.developer_sandbox_activity
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "developer_sandbox_activity_select_own"
  on public.developer_sandbox_activity;
create policy "developer_sandbox_activity_select_own"
  on public.developer_sandbox_activity
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "developer_sandbox_activity_select_admin"
  on public.developer_sandbox_activity;
create policy "developer_sandbox_activity_select_admin"
  on public.developer_sandbox_activity
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "developer_sandbox_risk_cases_select_admin"
  on public.developer_sandbox_risk_cases;
create policy "developer_sandbox_risk_cases_select_admin"
  on public.developer_sandbox_risk_cases
  for select
  to authenticated
  using (public.tc_is_admin());

grant select, insert on public.developer_sandbox_activity to authenticated;
grant select on public.developer_sandbox_risk_cases to authenticated;

-- Risk case inserts use service role (server-side classification). No DELETE policies.
