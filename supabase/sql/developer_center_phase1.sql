-- Tropicash Developer Center — Phase 1 (foundation only).
--
-- Captures developer access requests submitted from the public Developer Center
-- (pages/developers/request-access.jsx). Phase 1 does NOT issue API keys, does
-- NOT grant scoped permissions, and does NOT touch wallets, payouts, PayPal
-- funding, or fraud rules. All those live elsewhere and are owned by the
-- Treasury workstream.
--
-- Admin gating uses public.tc_is_admin() (defined in withdrawal_requests.sql,
-- kept in sync with lib/adminAccess.js ADMIN_EMAILS). If that helper is ever
-- removed, see the commented fallback policy block at the bottom of this file.

create table if not exists public.developer_access_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  company_name text,
  email text not null,
  use_case text not null,
  message text,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint developer_access_requests_status_ck check (
    lower(btrim(status)) in ('pending', 'reviewing', 'approved', 'rejected', 'closed')
  )
);

create index if not exists developer_access_requests_created_at_idx
  on public.developer_access_requests (created_at desc);

create index if not exists developer_access_requests_status_idx
  on public.developer_access_requests (lower(status));

create index if not exists developer_access_requests_email_idx
  on public.developer_access_requests (lower(email));

comment on table public.developer_access_requests is
  'Developer Center access requests (Phase 1 foundation). Anonymous + authenticated insert; admin-only read/update/delete.';
comment on column public.developer_access_requests.use_case is
  'Free-form short string matching DEVELOPER_ACCESS_USE_CASES in lib/developerCenterConfig.js.';
comment on column public.developer_access_requests.status is
  'pending | reviewing | approved | rejected | closed. App should bump updated_at on admin status changes.';

alter table public.developer_access_requests enable row level security;

-- Public-facing insert: the request form is reachable without auth, so both
-- anon and authenticated may submit. No select/update/delete granted here.
drop policy if exists "developer_access_requests_insert_anon"
  on public.developer_access_requests;
create policy "developer_access_requests_insert_anon"
  on public.developer_access_requests
  for insert
  to anon
  with check (true);

drop policy if exists "developer_access_requests_insert_authenticated"
  on public.developer_access_requests;
create policy "developer_access_requests_insert_authenticated"
  on public.developer_access_requests
  for insert
  to authenticated
  with check (true);

-- Admin-only read/update/delete via the existing tc_is_admin() helper.
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

grant insert on public.developer_access_requests to anon, authenticated;
grant select, update, delete on public.developer_access_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- If the tc_is_admin() helper has not been created yet (see
-- supabase/sql/withdrawal_requests.sql), replace the three admin policies
-- above with an explicit allow-list, e.g.:
--
-- create policy "developer_access_requests_select_admin_fallback"
--   on public.developer_access_requests
--   for select
--   to authenticated
--   using (
--     lower(coalesce((select email from auth.users where id = auth.uid()), ''))
--       in ('akimtropicashad@gmail.com')
--   );
--
-- Mirror the same predicate for update/delete. Keep the admin email list in
-- sync with lib/adminAccess.js ADMIN_EMAILS.
-- ---------------------------------------------------------------------------
