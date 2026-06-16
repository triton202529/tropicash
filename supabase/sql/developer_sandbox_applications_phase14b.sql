-- Tropicash Developer Platform — Phase 14B: sandbox application & approval workflow.
--
-- Controlled onboarding for external developers requesting sandbox access.
-- Governance only — no automatic credentials, OAuth clients, or production access.
--
-- Dependencies:
--   • public.tc_is_admin() from withdrawal_requests.sql

-- ===========================================================================
-- developer_sandbox_applications
-- ===========================================================================

create table if not exists public.developer_sandbox_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users (id) on delete cascade,
  organization_name text not null,
  developer_name text not null,
  email text not null,
  website text,
  country text not null,
  use_case text not null,
  requested_capabilities text[] not null default '{}'::text[],
  status text not null default 'pending',
  review_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid
    references auth.users (id) on delete set null
);

alter table public.developer_sandbox_applications
  drop constraint if exists developer_sandbox_applications_status_ck;

alter table public.developer_sandbox_applications
  add constraint developer_sandbox_applications_status_ck
    check (status in ('pending', 'under_review', 'approved', 'rejected'));

create index if not exists developer_sandbox_applications_user_id_idx
  on public.developer_sandbox_applications (user_id);

create index if not exists developer_sandbox_applications_status_idx
  on public.developer_sandbox_applications (status);

create index if not exists developer_sandbox_applications_created_at_idx
  on public.developer_sandbox_applications (created_at desc);

create index if not exists developer_sandbox_applications_email_idx
  on public.developer_sandbox_applications (email);

comment on table public.developer_sandbox_applications is
  'Phase 14B: External developer sandbox access applications. Admin approval is governance only — no auto credentials.';

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.developer_sandbox_applications enable row level security;

drop policy if exists "developer_sandbox_applications_insert_own"
  on public.developer_sandbox_applications;
create policy "developer_sandbox_applications_insert_own"
  on public.developer_sandbox_applications
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "developer_sandbox_applications_select_own"
  on public.developer_sandbox_applications;
create policy "developer_sandbox_applications_select_own"
  on public.developer_sandbox_applications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "developer_sandbox_applications_select_admin"
  on public.developer_sandbox_applications;
create policy "developer_sandbox_applications_select_admin"
  on public.developer_sandbox_applications
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "developer_sandbox_applications_update_admin"
  on public.developer_sandbox_applications;
create policy "developer_sandbox_applications_update_admin"
  on public.developer_sandbox_applications
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

grant select, insert on public.developer_sandbox_applications to authenticated;
grant update on public.developer_sandbox_applications to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Replace each `using (public.tc_is_admin())` admin policy with an explicit
-- email allow-list on auth.users, kept in sync with lib/adminAccess.js
-- ADMIN_EMAILS — same pattern as developer_access_requests.sql.
-- ---------------------------------------------------------------------------
