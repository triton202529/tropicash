-- Tropicash Developer Center — Phase 5A: sandbox credential architecture & API key vault blueprint.
--
-- Metadata-only tables for credential rows, lifecycle audit, and per-credential access policy
-- attachments. **No plaintext or encrypted secret material** is stored in these tables — only
-- non-sensitive labels, statuses, optional public prefix hints, and opaque correlation references
-- for future vault integration.
--
-- ---------------------------------------------------------------------------
-- Migration order / dependencies (apply after Phase 4A org + app registry)
-- ---------------------------------------------------------------------------
--
--   1. `supabase/sql/developer_orgs_phase4a.sql` — required:
--        `developer_organizations`, `developer_apps` (FK targets for app_id / organization_id).
--   2. `supabase/sql/developer_app_governance_phase4b.sql` — optional but recommended for the
--        same console governance flows that precede any future issuance.
--   3. THIS FILE — `developer_app_credentials`, `developer_credential_lifecycle_events`,
--        `developer_credential_access_policies`.
--
-- Admin gating uses public.tc_is_admin() (see developer_orgs_phase4a.sql / lib/adminAccess.js).
-- If that helper is missing in an environment, use the fallback note at the bottom of this file
-- (same approach as developer_center_phase1.sql).

-- ---------------------------------------------------------------------------
-- A. developer_app_credentials
-- ---------------------------------------------------------------------------

create table if not exists public.developer_app_credentials (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null
    references public.developer_apps (id) on delete cascade,
  organization_id uuid not null
    references public.developer_organizations (id) on delete cascade,
  credential_type text not null
    constraint developer_app_credentials_credential_type_ck
      check (
        credential_type in (
          'sandbox_api_key',
          'live_api_key',
          'webhook_signing_key',
          'service_account_token',
          'oauth_client_credentials'
        )
      ),
  environment text not null default 'sandbox'
    constraint developer_app_credentials_environment_ck
      check (environment in ('sandbox', 'live')),
  lifecycle_status text not null default 'draft'
    constraint developer_app_credentials_lifecycle_status_ck
      check (
        lifecycle_status in (
          'draft',
          'pending_issuance',
          'active',
          'rotation_pending',
          'rotating',
          'suspended',
          'revoked',
          'expired'
        )
      ),
  rotation_status text not null default 'not_started'
    constraint developer_app_credentials_rotation_status_ck
      check (
        rotation_status in (
          'not_started',
          'scheduled',
          'in_progress',
          'completed',
          'failed',
          'cancelled'
        )
      ),
  risk_level text not null default 'medium'
    constraint developer_app_credentials_risk_level_ck
      check (risk_level in ('low', 'medium', 'high', 'critical')),
  display_label text,
  public_prefix_hint text,
  correlation_reference text,
  issued_at timestamptz,
  expires_at timestamptz,
  last_rotated_at timestamptz,
  revoked_at timestamptz,
  revoked_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists developer_app_credentials_app_id_idx
  on public.developer_app_credentials (app_id);

create index if not exists developer_app_credentials_organization_id_idx
  on public.developer_app_credentials (organization_id);

create index if not exists developer_app_credentials_lifecycle_environment_idx
  on public.developer_app_credentials (lifecycle_status, environment);

create index if not exists developer_app_credentials_type_idx
  on public.developer_app_credentials (credential_type);

comment on table public.developer_app_credentials is
  'Phase 5A: non-secret credential metadata per app. Issuance is admin-only via RLS; no secret columns.';

-- ---------------------------------------------------------------------------
-- B. developer_credential_lifecycle_events
-- ---------------------------------------------------------------------------

create table if not exists public.developer_credential_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null
    references public.developer_app_credentials (id) on delete cascade,
  app_id uuid not null
    references public.developer_apps (id) on delete cascade,
  organization_id uuid not null
    references public.developer_organizations (id) on delete cascade,
  event_type text not null
    constraint developer_credential_lifecycle_events_event_type_ck
      check (
        event_type in (
          'credential_created',
          'issuance_requested',
          'issued',
          'activated',
          'rotation_started',
          'rotation_completed',
          'revoked',
          'expired',
          'suspended',
          'resumed',
          'metadata_updated',
          'access_policy_attached',
          'access_policy_detached'
        )
      ),
  actor_type text not null default 'system'
    constraint developer_credential_lifecycle_events_actor_type_ck
      check (actor_type in ('user', 'admin', 'system')),
  actor_user_id uuid,
  previous_lifecycle_status text,
  new_lifecycle_status text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists developer_credential_lifecycle_events_credential_id_idx
  on public.developer_credential_lifecycle_events (credential_id);

create index if not exists developer_credential_lifecycle_events_app_id_idx
  on public.developer_credential_lifecycle_events (app_id);

create index if not exists developer_credential_lifecycle_events_event_type_idx
  on public.developer_credential_lifecycle_events (event_type);

create index if not exists developer_credential_lifecycle_events_created_at_idx
  on public.developer_credential_lifecycle_events (created_at desc);

comment on table public.developer_credential_lifecycle_events is
  'Phase 5A: append-only credential lifecycle audit (metadata only; no secrets).';

-- ---------------------------------------------------------------------------
-- C. developer_credential_access_policies
-- ---------------------------------------------------------------------------

create table if not exists public.developer_credential_access_policies (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null
    references public.developer_app_credentials (id) on delete cascade,
  app_id uuid not null
    references public.developer_apps (id) on delete cascade,
  environment text not null default 'sandbox'
    constraint developer_credential_access_policies_environment_ck
      check (environment in ('sandbox', 'live')),
  policy_key text not null,
  policy_label text,
  policy_value jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    constraint developer_credential_access_policies_status_ck
      check (status in ('draft', 'active', 'deprecated', 'revoked')),
  risk_level text not null default 'medium'
    constraint developer_credential_access_policies_risk_level_ck
      check (risk_level in ('low', 'medium', 'high', 'critical')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists developer_credential_access_policies_credential_id_idx
  on public.developer_credential_access_policies (credential_id);

create index if not exists developer_credential_access_policies_app_id_idx
  on public.developer_credential_access_policies (app_id);

create index if not exists developer_credential_access_policies_policy_key_idx
  on public.developer_credential_access_policies (policy_key);

create index if not exists developer_credential_access_policies_status_idx
  on public.developer_credential_access_policies (status);

comment on table public.developer_credential_access_policies is
  'Phase 5A: JSON policy attachments for credential metadata rows (governance modeling; no secrets).';

alter table public.developer_app_credentials enable row level security;
alter table public.developer_credential_lifecycle_events enable row level security;
alter table public.developer_credential_access_policies enable row level security;

-- ---------------------------------------------------------------------------
-- developer_app_credentials: owner SELECT only; admin full CRUD.
-- Owners cannot self-issue (no INSERT/UPDATE policies for non-admins).
-- ---------------------------------------------------------------------------

drop policy if exists "developer_app_credentials_select_owner"
  on public.developer_app_credentials;
create policy "developer_app_credentials_select_owner"
  on public.developer_app_credentials
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.developer_apps a
      where a.id = app_id
        and a.owner_user_id = auth.uid()
    )
  );

drop policy if exists "developer_app_credentials_select_admin"
  on public.developer_app_credentials;
create policy "developer_app_credentials_select_admin"
  on public.developer_app_credentials
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "developer_app_credentials_insert_admin"
  on public.developer_app_credentials;
create policy "developer_app_credentials_insert_admin"
  on public.developer_app_credentials
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "developer_app_credentials_update_admin"
  on public.developer_app_credentials;
create policy "developer_app_credentials_update_admin"
  on public.developer_app_credentials
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "developer_app_credentials_delete_admin"
  on public.developer_app_credentials;
create policy "developer_app_credentials_delete_admin"
  on public.developer_app_credentials
  for delete
  to authenticated
  using (public.tc_is_admin());

-- ---------------------------------------------------------------------------
-- developer_credential_lifecycle_events: owner SELECT; admin full CRUD.
-- ---------------------------------------------------------------------------

drop policy if exists "developer_credential_lifecycle_events_select_owner"
  on public.developer_credential_lifecycle_events;
create policy "developer_credential_lifecycle_events_select_owner"
  on public.developer_credential_lifecycle_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.developer_app_credentials c
      join public.developer_apps a on a.id = c.app_id
      where c.id = credential_id
        and a.owner_user_id = auth.uid()
    )
  );

drop policy if exists "developer_credential_lifecycle_events_select_admin"
  on public.developer_credential_lifecycle_events;
create policy "developer_credential_lifecycle_events_select_admin"
  on public.developer_credential_lifecycle_events
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "developer_credential_lifecycle_events_insert_admin"
  on public.developer_credential_lifecycle_events;
create policy "developer_credential_lifecycle_events_insert_admin"
  on public.developer_credential_lifecycle_events
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "developer_credential_lifecycle_events_update_admin"
  on public.developer_credential_lifecycle_events;
create policy "developer_credential_lifecycle_events_update_admin"
  on public.developer_credential_lifecycle_events
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "developer_credential_lifecycle_events_delete_admin"
  on public.developer_credential_lifecycle_events;
create policy "developer_credential_lifecycle_events_delete_admin"
  on public.developer_credential_lifecycle_events
  for delete
  to authenticated
  using (public.tc_is_admin());

-- ---------------------------------------------------------------------------
-- developer_credential_access_policies: owner SELECT; admin full CRUD.
-- ---------------------------------------------------------------------------

drop policy if exists "developer_credential_access_policies_select_owner"
  on public.developer_credential_access_policies;
create policy "developer_credential_access_policies_select_owner"
  on public.developer_credential_access_policies
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.developer_app_credentials c
      join public.developer_apps a on a.id = c.app_id
      where c.id = credential_id
        and a.owner_user_id = auth.uid()
    )
  );

drop policy if exists "developer_credential_access_policies_select_admin"
  on public.developer_credential_access_policies;
create policy "developer_credential_access_policies_select_admin"
  on public.developer_credential_access_policies
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "developer_credential_access_policies_insert_admin"
  on public.developer_credential_access_policies;
create policy "developer_credential_access_policies_insert_admin"
  on public.developer_credential_access_policies
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "developer_credential_access_policies_update_admin"
  on public.developer_credential_access_policies;
create policy "developer_credential_access_policies_update_admin"
  on public.developer_credential_access_policies
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "developer_credential_access_policies_delete_admin"
  on public.developer_credential_access_policies;
create policy "developer_credential_access_policies_delete_admin"
  on public.developer_credential_access_policies
  for delete
  to authenticated
  using (public.tc_is_admin());

grant select, insert, update, delete on public.developer_app_credentials to authenticated;
grant select, insert, update, delete on public.developer_credential_lifecycle_events to authenticated;
grant select, insert, update, delete on public.developer_credential_access_policies to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Replace each `using (public.tc_is_admin())` / `with check (public.tc_is_admin())` admin
-- policy with an explicit email allow-list on auth.users, kept in sync with
-- lib/adminAccess.js ADMIN_EMAILS — same pattern as developer_center_phase1.sql.
-- ---------------------------------------------------------------------------
