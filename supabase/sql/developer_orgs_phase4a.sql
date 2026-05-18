-- Tropicash Developer Center — Phase 4A: developer organizations & app registration.
--
-- Persists sandbox-first developer org and app metadata only. Does NOT issue
-- API keys, secrets, webhooks, payment APIs, or any money-movement surfaces.
--
-- Admin gating uses public.tc_is_admin() (see withdrawal_requests.sql /
-- lib/adminAccess.js). If that helper is missing in an environment, use the
-- commented fallback pattern at the bottom of this file (same approach as
-- supabase/sql/developer_center_phase1.sql).

create table if not exists public.developer_organizations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  organization_name text not null,
  organization_type text not null default 'business'
    constraint developer_organizations_organization_type_ck
      check (organization_type in ('individual', 'business', 'platform', 'internal')),
  status text not null default 'pending_review'
    constraint developer_organizations_status_ck
      check (status in ('pending_review', 'approved', 'suspended', 'rejected', 'archived')),
  website_url text,
  contact_email text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists developer_organizations_owner_user_id_idx
  on public.developer_organizations (owner_user_id);

create index if not exists developer_organizations_status_idx
  on public.developer_organizations (status);

comment on table public.developer_organizations is
  'Phase 4A: developer organization registry. Owner-scoped via RLS; admins manage lifecycle.';

create table if not exists public.developer_apps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.developer_organizations (id) on delete cascade,
  owner_user_id uuid not null,
  app_name text not null,
  app_slug text not null,
  environment text not null default 'sandbox'
    constraint developer_apps_environment_ck
      check (environment in ('sandbox', 'live')),
  status text not null default 'draft'
    constraint developer_apps_status_ck
      check (
        status in (
          'draft',
          'pending_review',
          'sandbox_active',
          'live_pending',
          'live_active',
          'suspended',
          'archived'
        )
      ),
  app_type text not null default 'web'
    constraint developer_apps_app_type_ck
      check (app_type in ('web', 'mobile', 'server', 'internal', 'other')),
  description text,
  redirect_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint developer_apps_org_slug_env_unique unique (organization_id, app_slug, environment)
);

create index if not exists developer_apps_organization_id_idx
  on public.developer_apps (organization_id);

create index if not exists developer_apps_owner_user_id_idx
  on public.developer_apps (owner_user_id);

create index if not exists developer_apps_environment_status_idx
  on public.developer_apps (environment, status);

comment on table public.developer_apps is
  'Phase 4A: developer app records per org/environment. No API credentials stored here.';
comment on column public.developer_apps.updated_at is
  'Default now() on insert; bump from the app on meaningful edits (no DB trigger — matches developer_center_phase1).';

alter table public.developer_organizations enable row level security;
alter table public.developer_apps enable row level security;

-- ---------------------------------------------------------------------------
-- developer_organizations: owners read/write own rows; admins read/update/delete
-- all; no anon (no policies for anon).
-- ---------------------------------------------------------------------------

drop policy if exists "developer_organizations_select_owner"
  on public.developer_organizations;
create policy "developer_organizations_select_owner"
  on public.developer_organizations
  for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "developer_organizations_select_admin"
  on public.developer_organizations;
create policy "developer_organizations_select_admin"
  on public.developer_organizations
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "developer_organizations_insert_owner"
  on public.developer_organizations;
create policy "developer_organizations_insert_owner"
  on public.developer_organizations
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists "developer_organizations_update_owner"
  on public.developer_organizations;
create policy "developer_organizations_update_owner"
  on public.developer_organizations
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists "developer_organizations_update_admin"
  on public.developer_organizations;
create policy "developer_organizations_update_admin"
  on public.developer_organizations
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "developer_organizations_delete_admin"
  on public.developer_organizations;
create policy "developer_organizations_delete_admin"
  on public.developer_organizations
  for delete
  to authenticated
  using (public.tc_is_admin());

-- ---------------------------------------------------------------------------
-- developer_apps: same owner pattern; admin full CRUD; org row must belong to
-- owner on insert/update (owners cannot attach apps to another user''s org).
-- ---------------------------------------------------------------------------

drop policy if exists "developer_apps_select_owner"
  on public.developer_apps;
create policy "developer_apps_select_owner"
  on public.developer_apps
  for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists "developer_apps_select_admin"
  on public.developer_apps;
create policy "developer_apps_select_admin"
  on public.developer_apps
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "developer_apps_insert_owner"
  on public.developer_apps;
create policy "developer_apps_insert_owner"
  on public.developer_apps
  for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.developer_organizations o
      where o.id = organization_id
        and o.owner_user_id = auth.uid()
    )
  );

drop policy if exists "developer_apps_insert_admin"
  on public.developer_apps;
create policy "developer_apps_insert_admin"
  on public.developer_apps
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "developer_apps_update_owner"
  on public.developer_apps;
create policy "developer_apps_update_owner"
  on public.developer_apps
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.developer_organizations o
      where o.id = organization_id
        and o.owner_user_id = auth.uid()
    )
  );

drop policy if exists "developer_apps_update_admin"
  on public.developer_apps;
create policy "developer_apps_update_admin"
  on public.developer_apps
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "developer_apps_delete_admin"
  on public.developer_apps;
create policy "developer_apps_delete_admin"
  on public.developer_apps
  for delete
  to authenticated
  using (public.tc_is_admin());

grant select, insert, update, delete on public.developer_organizations to authenticated;
grant select, insert, update, delete on public.developer_apps to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Mirror developer_center_phase1.sql: replace each `using (public.tc_is_admin())`
-- / `with check (public.tc_is_admin())` admin policy with an explicit email
-- allow-list on auth.users, kept in sync with lib/adminAccess.js ADMIN_EMAILS.
-- ---------------------------------------------------------------------------
