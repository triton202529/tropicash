-- Tropicash Developer Center — Phase 4C: sandbox access policies & capability assignment.

--

-- App capability assignments, capability requests, and sandbox access policies.

-- Does NOT issue API keys, secrets, webhooks, payment APIs, or money movement.

--

-- Admin gating uses public.tc_is_admin() (see developer_orgs_phase4a.sql /

-- lib/adminAccess.js). If that helper is missing, use the fallback note at the

-- bottom of this file.



-- Extend Phase 4B lifecycle event types for capability governance notes.

alter table public.developer_app_lifecycle_events

  drop constraint if exists developer_app_lifecycle_events_event_type_ck;



alter table public.developer_app_lifecycle_events

  add constraint developer_app_lifecycle_events_event_type_ck

  check (

    event_type in (

      'review_requested',

      'review_approved',

      'review_rejected',

      'review_needs_changes',

      'review_cancelled',

      'status_transition',

      'status_changed',

      'sandbox_activated',

      'live_pending_set',

      'live_activated',

      'environment_upgraded',

      'suspended',

      'reactivated',

      'archived'

    )

  );



-- ---------------------------------------------------------------------------

-- A. developer_app_capabilities

-- ---------------------------------------------------------------------------



create table if not exists public.developer_app_capabilities (

  id uuid primary key default gen_random_uuid(),

  app_id uuid not null

    references public.developer_apps (id) on delete cascade,

  organization_id uuid not null

    references public.developer_organizations (id) on delete cascade,

  capability_key text not null,

  environment text not null default 'sandbox'

    constraint developer_app_capabilities_environment_ck

      check (environment in ('sandbox', 'live')),

  status text not null default 'assigned'

    constraint developer_app_capabilities_status_ck

      check (

        status in (

          'assigned',

          'pending_review',

          'restricted',

          'revoked',

          'suspended'

        )

      ),

  assigned_by_user_id uuid,

  notes text,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint developer_app_capabilities_app_cap_env_unique

    unique (app_id, capability_key, environment)

);



create index if not exists developer_app_capabilities_app_id_idx

  on public.developer_app_capabilities (app_id);



create index if not exists developer_app_capabilities_organization_id_idx

  on public.developer_app_capabilities (organization_id);



create index if not exists developer_app_capabilities_capability_key_idx

  on public.developer_app_capabilities (capability_key);



create index if not exists developer_app_capabilities_environment_status_idx

  on public.developer_app_capabilities (environment, status);



comment on table public.developer_app_capabilities is

  'Phase 4C: admin-assigned capability grants per app and environment. Owners read-only.';



-- ---------------------------------------------------------------------------

-- B. developer_app_capability_requests

-- ---------------------------------------------------------------------------



create table if not exists public.developer_app_capability_requests (

  id uuid primary key default gen_random_uuid(),

  app_id uuid not null

    references public.developer_apps (id) on delete cascade,

  organization_id uuid not null

    references public.developer_organizations (id) on delete cascade,

  requested_by_user_id uuid not null,

  capability_key text not null,

  requested_environment text not null default 'sandbox'

    constraint developer_app_capability_requests_environment_ck

      check (requested_environment in ('sandbox', 'live')),

  status text not null default 'pending'

    constraint developer_app_capability_requests_status_ck

      check (

        status in (

          'pending',

          'approved',

          'rejected',

          'needs_changes',

          'cancelled'

        )

      ),

  request_reason text,

  reviewer_user_id uuid,

  decision_notes text,

  created_at timestamptz not null default now(),

  reviewed_at timestamptz

);



create index if not exists developer_app_capability_requests_app_id_idx

  on public.developer_app_capability_requests (app_id);



create index if not exists developer_app_capability_requests_status_idx

  on public.developer_app_capability_requests (status);



create index if not exists developer_app_capability_requests_capability_key_idx

  on public.developer_app_capability_requests (capability_key);



comment on table public.developer_app_capability_requests is

  'Phase 4C: owner-submitted capability access requests; admins decide.';



-- ---------------------------------------------------------------------------

-- C. developer_app_access_policies

-- ---------------------------------------------------------------------------



create table if not exists public.developer_app_access_policies (

  id uuid primary key default gen_random_uuid(),

  app_id uuid not null

    references public.developer_apps (id) on delete cascade,

  organization_id uuid not null

    references public.developer_organizations (id) on delete cascade,

  environment text not null default 'sandbox'

    constraint developer_app_access_policies_environment_ck

      check (environment in ('sandbox', 'live')),

  policy_key text not null,

  policy_label text not null,

  policy_value jsonb not null default '{}'::jsonb,

  status text not null default 'planned'

    constraint developer_app_access_policies_status_ck

      check (status in ('planned', 'active', 'restricted', 'disabled')),

  risk_level text not null default 'medium'

    constraint developer_app_access_policies_risk_level_ck

      check (risk_level in ('low', 'medium', 'high', 'critical')),

  notes text,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  constraint developer_app_access_policies_app_env_policy_unique

    unique (app_id, environment, policy_key)

);



create index if not exists developer_app_access_policies_app_id_idx

  on public.developer_app_access_policies (app_id);



create index if not exists developer_app_access_policies_environment_status_idx

  on public.developer_app_access_policies (environment, status);



create index if not exists developer_app_access_policies_policy_key_idx

  on public.developer_app_access_policies (policy_key);



comment on table public.developer_app_access_policies is

  'Phase 4C: sandbox/live access policy metadata per app. Admins manage; owners read.';



alter table public.developer_app_capabilities enable row level security;

alter table public.developer_app_capability_requests enable row level security;

alter table public.developer_app_access_policies enable row level security;



-- ---------------------------------------------------------------------------

-- developer_app_capabilities: owner SELECT only; admin full CRUD.

-- ---------------------------------------------------------------------------



drop policy if exists "developer_app_capabilities_select_owner"

  on public.developer_app_capabilities;

create policy "developer_app_capabilities_select_owner"

  on public.developer_app_capabilities

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



drop policy if exists "developer_app_capabilities_select_admin"

  on public.developer_app_capabilities;

create policy "developer_app_capabilities_select_admin"

  on public.developer_app_capabilities

  for select

  to authenticated

  using (public.tc_is_admin());



drop policy if exists "developer_app_capabilities_insert_admin"

  on public.developer_app_capabilities;

create policy "developer_app_capabilities_insert_admin"

  on public.developer_app_capabilities

  for insert

  to authenticated

  with check (public.tc_is_admin());



drop policy if exists "developer_app_capabilities_update_admin"

  on public.developer_app_capabilities;

create policy "developer_app_capabilities_update_admin"

  on public.developer_app_capabilities

  for update

  to authenticated

  using (public.tc_is_admin())

  with check (public.tc_is_admin());



drop policy if exists "developer_app_capabilities_delete_admin"

  on public.developer_app_capabilities;

create policy "developer_app_capabilities_delete_admin"

  on public.developer_app_capabilities

  for delete

  to authenticated

  using (public.tc_is_admin());



-- ---------------------------------------------------------------------------

-- developer_app_capability_requests: owner SELECT + INSERT; admin all.

-- ---------------------------------------------------------------------------



drop policy if exists "developer_app_capability_requests_select_owner"

  on public.developer_app_capability_requests;

create policy "developer_app_capability_requests_select_owner"

  on public.developer_app_capability_requests

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



drop policy if exists "developer_app_capability_requests_select_admin"

  on public.developer_app_capability_requests;

create policy "developer_app_capability_requests_select_admin"

  on public.developer_app_capability_requests

  for select

  to authenticated

  using (public.tc_is_admin());



drop policy if exists "developer_app_capability_requests_insert_owner"

  on public.developer_app_capability_requests;

create policy "developer_app_capability_requests_insert_owner"

  on public.developer_app_capability_requests

  for insert

  to authenticated

  with check (

    requested_by_user_id = auth.uid()

    and exists (

      select 1

      from public.developer_apps a

      where a.id = app_id

        and a.owner_user_id = auth.uid()

        and a.organization_id = organization_id

    )

  );



drop policy if exists "developer_app_capability_requests_update_admin"

  on public.developer_app_capability_requests;

create policy "developer_app_capability_requests_update_admin"

  on public.developer_app_capability_requests

  for update

  to authenticated

  using (public.tc_is_admin())

  with check (

    public.tc_is_admin()

    and reviewer_user_id is distinct from requested_by_user_id

  );



drop policy if exists "developer_app_capability_requests_delete_admin"

  on public.developer_app_capability_requests;

create policy "developer_app_capability_requests_delete_admin"

  on public.developer_app_capability_requests

  for delete

  to authenticated

  using (public.tc_is_admin());



-- ---------------------------------------------------------------------------

-- developer_app_access_policies: owner SELECT; admin full CRUD.

-- ---------------------------------------------------------------------------



drop policy if exists "developer_app_access_policies_select_owner"

  on public.developer_app_access_policies;

create policy "developer_app_access_policies_select_owner"

  on public.developer_app_access_policies

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



drop policy if exists "developer_app_access_policies_select_admin"

  on public.developer_app_access_policies;

create policy "developer_app_access_policies_select_admin"

  on public.developer_app_access_policies

  for select

  to authenticated

  using (public.tc_is_admin());



drop policy if exists "developer_app_access_policies_insert_admin"

  on public.developer_app_access_policies;

create policy "developer_app_access_policies_insert_admin"

  on public.developer_app_access_policies

  for insert

  to authenticated

  with check (public.tc_is_admin());



drop policy if exists "developer_app_access_policies_update_admin"

  on public.developer_app_access_policies;

create policy "developer_app_access_policies_update_admin"

  on public.developer_app_access_policies

  for update

  to authenticated

  using (public.tc_is_admin())

  with check (public.tc_is_admin());



drop policy if exists "developer_app_access_policies_delete_admin"

  on public.developer_app_access_policies;

create policy "developer_app_access_policies_delete_admin"

  on public.developer_app_access_policies

  for delete

  to authenticated

  using (public.tc_is_admin());



grant select on public.developer_app_capabilities to authenticated;

grant insert, update, delete on public.developer_app_capabilities to authenticated;



grant select, insert on public.developer_app_capability_requests to authenticated;

grant update, delete on public.developer_app_capability_requests to authenticated;



grant select on public.developer_app_access_policies to authenticated;

grant insert, update, delete on public.developer_app_access_policies to authenticated;



-- ---------------------------------------------------------------------------

-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):

--

-- Mirror developer_orgs_phase4a.sql: replace each `using (public.tc_is_admin())`

-- / `with check (public.tc_is_admin())` admin policy with an explicit email

-- allow-list on auth.users, kept in sync with lib/adminAccess.js ADMIN_EMAILS.

-- ---------------------------------------------------------------------------


