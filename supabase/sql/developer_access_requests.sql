-- Public developer access requests (Developer Center intake).
--
-- Submitted from pages/developers/request-access.jsx without authentication.
-- Admins review on /dev-console/app-governance. Does NOT create orgs/apps or API keys.
--
-- Admin gating uses public.tc_is_admin() (withdrawal_requests.sql / lib/adminAccess.js).
-- Apply after withdrawal_requests.sql so tc_is_admin() exists.
-- Upgrades developer_center_phase1.sql when that migration was applied earlier.

create table if not exists public.developer_access_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company_name text,
  email text not null,
  use_case text,
  message text,
  status text not null default 'pending',
  reviewed_by_user_id uuid,
  review_notes text,
  created_at timestamptz default now(),
  reviewed_at timestamptz
);

-- Phase 1 → current schema (idempotent)
alter table public.developer_access_requests
  add column if not exists reviewed_by_user_id uuid;
alter table public.developer_access_requests
  add column if not exists review_notes text;
alter table public.developer_access_requests
  add column if not exists reviewed_at timestamptz;

alter table public.developer_access_requests
  drop column if exists updated_at;

alter table public.developer_access_requests
  alter column use_case drop not null;

update public.developer_access_requests
set status = case lower(btrim(status))
  when 'reviewing' then 'reviewed'
  when 'closed' then 'archived'
  else status
end
where lower(btrim(status)) not in (
  'pending', 'reviewed', 'approved', 'rejected', 'archived'
);

alter table public.developer_access_requests
  drop constraint if exists developer_access_requests_status_ck;

alter table public.developer_access_requests
  add constraint developer_access_requests_status_ck check (
    status in ('pending', 'reviewed', 'approved', 'rejected', 'archived')
  );

create index if not exists developer_access_requests_status_idx
  on public.developer_access_requests (status);

create index if not exists developer_access_requests_created_at_idx
  on public.developer_access_requests (created_at desc);

create index if not exists developer_access_requests_email_idx
  on public.developer_access_requests (email);

comment on table public.developer_access_requests is
  'Public Developer Center access requests. Anonymous insert only; admin read/update/delete via tc_is_admin().';

alter table public.developer_access_requests enable row level security;

-- Anonymous submit only (public request-access form).
drop policy if exists "developer_access_requests_insert_anon"
  on public.developer_access_requests;
create policy "developer_access_requests_insert_anon"
  on public.developer_access_requests
  for insert
  to anon
  with check ((select auth.role()) = 'anon');

drop policy if exists "developer_access_requests_insert_authenticated"
  on public.developer_access_requests;

-- Admin operators: full read/update/delete (no self-service list for submitters).
-- Signed-in submitters: read own rows by session email (Phase 6C console gate).
drop policy if exists "developer_access_requests_select_own_email"
  on public.developer_access_requests;
create policy "developer_access_requests_select_own_email"
  on public.developer_access_requests
  for select
  to authenticated
  using (
    lower(btrim(email)) = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
  );

drop policy if exists "developer_access_requests_select_admin"
  on public.developer_access_requests;
create policy "developer_access_requests_select_admin"
  on public.developer_access_requests
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "developer_access_requests_update_admin"
  on public.developer_access_requests;
create policy "developer_access_requests_update_admin"
  on public.developer_access_requests
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "developer_access_requests_delete_admin"
  on public.developer_access_requests;
create policy "developer_access_requests_delete_admin"
  on public.developer_access_requests
  for delete
  to authenticated
  using (public.tc_is_admin());

revoke all on public.developer_access_requests from anon, authenticated;
grant insert on public.developer_access_requests to anon;
grant select, update, delete on public.developer_access_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Replace each `using (public.tc_is_admin())` / `with check (public.tc_is_admin())`
-- admin policy with an explicit email allow-list from auth.users, kept in sync
-- with lib/adminAccess.js ADMIN_EMAILS (see developer_center_phase1.sql).
-- ---------------------------------------------------------------------------
