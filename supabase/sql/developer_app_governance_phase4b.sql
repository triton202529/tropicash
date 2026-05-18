-- Tropicash Developer Center — Phase 4B: app governance & review workflow.
--
-- Review requests and append-only lifecycle events for developer_apps.
-- Does NOT issue API keys, secrets, webhooks, payment APIs, or money movement.
--
-- Admin gating uses public.tc_is_admin() (see developer_orgs_phase4a.sql /
-- lib/adminAccess.js). If that helper is missing, use the fallback note at the
-- bottom of this file (same approach as developer_center_phase1.sql).

create table if not exists public.developer_app_reviews (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null
    references public.developer_apps (id) on delete cascade,
  organization_id uuid not null
    references public.developer_organizations (id) on delete cascade,
  requested_by_user_id uuid not null,
  review_type text not null
    constraint developer_app_reviews_review_type_ck
      check (
        review_type in (
          'sandbox_activation',
          'live_access',
          'environment_upgrade',
          'suspension_review',
          'reactivation'
        )
      ),
  requested_environment text not null default 'sandbox'
    constraint developer_app_reviews_requested_environment_ck
      check (requested_environment in ('sandbox', 'live')),
  status text not null default 'pending'
    constraint developer_app_reviews_status_ck
      check (
        status in (
          'pending',
          'approved',
          'rejected',
          'needs_changes',
          'cancelled'
        )
      ),
  reviewer_user_id uuid,
  review_notes text,
  decision_notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists developer_app_reviews_app_id_idx
  on public.developer_app_reviews (app_id);

create index if not exists developer_app_reviews_status_idx
  on public.developer_app_reviews (status);

create index if not exists developer_app_reviews_review_type_idx
  on public.developer_app_reviews (review_type);

comment on table public.developer_app_reviews is
  'Phase 4B: developer app governance review queue. Owners submit; admins decide.';

create table if not exists public.developer_app_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null
    references public.developer_apps (id) on delete cascade,
  organization_id uuid not null
    references public.developer_organizations (id) on delete cascade,
  event_type text not null
    constraint developer_app_lifecycle_events_event_type_ck
      check (
        event_type in (
          'review_requested',
          'review_approved',
          'review_rejected',
          'review_needs_changes',
          'review_cancelled',
          'status_transition',
          'sandbox_activated',
          'live_pending_set',
          'live_activated',
          'environment_upgraded',
          'suspended',
          'reactivated',
          'archived'
        )
      ),
  previous_status text,
  new_status text,
  actor_user_id uuid,
  actor_type text not null default 'user'
    constraint developer_app_lifecycle_events_actor_type_ck
      check (actor_type in ('user', 'admin', 'system')),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists developer_app_lifecycle_events_app_id_idx
  on public.developer_app_lifecycle_events (app_id);

create index if not exists developer_app_lifecycle_events_event_type_idx
  on public.developer_app_lifecycle_events (event_type);

comment on table public.developer_app_lifecycle_events is
  'Phase 4B: append-only lifecycle audit for developer apps (governance metadata only).';

alter table public.developer_app_reviews enable row level security;
alter table public.developer_app_lifecycle_events enable row level security;

-- ---------------------------------------------------------------------------
-- developer_app_reviews: owners read/submit for owned apps; admins full access.
-- ---------------------------------------------------------------------------

drop policy if exists "developer_app_reviews_select_owner"
  on public.developer_app_reviews;
create policy "developer_app_reviews_select_owner"
  on public.developer_app_reviews
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.developer_apps a
      where a.id = app_id
        and a.owner_user_id = auth.uid()
    )
    or exists (
      select 1
      from public.developer_organizations o
      where o.id = organization_id
        and o.owner_user_id = auth.uid()
    )
  );

drop policy if exists "developer_app_reviews_select_admin"
  on public.developer_app_reviews;
create policy "developer_app_reviews_select_admin"
  on public.developer_app_reviews
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "developer_app_reviews_insert_owner"
  on public.developer_app_reviews;
create policy "developer_app_reviews_insert_owner"
  on public.developer_app_reviews
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

drop policy if exists "developer_app_reviews_update_admin"
  on public.developer_app_reviews;
create policy "developer_app_reviews_update_admin"
  on public.developer_app_reviews
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (
    public.tc_is_admin()
    and reviewer_user_id is distinct from requested_by_user_id
  );

drop policy if exists "developer_app_reviews_delete_admin"
  on public.developer_app_reviews;
create policy "developer_app_reviews_delete_admin"
  on public.developer_app_reviews
  for delete
  to authenticated
  using (public.tc_is_admin());

-- ---------------------------------------------------------------------------
-- developer_app_lifecycle_events: owners read; admins full access.
-- ---------------------------------------------------------------------------

drop policy if exists "developer_app_lifecycle_events_select_owner"
  on public.developer_app_lifecycle_events;
create policy "developer_app_lifecycle_events_select_owner"
  on public.developer_app_lifecycle_events
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

drop policy if exists "developer_app_lifecycle_events_select_admin"
  on public.developer_app_lifecycle_events;
create policy "developer_app_lifecycle_events_select_admin"
  on public.developer_app_lifecycle_events
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "developer_app_lifecycle_events_insert_admin"
  on public.developer_app_lifecycle_events;
create policy "developer_app_lifecycle_events_insert_admin"
  on public.developer_app_lifecycle_events
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "developer_app_lifecycle_events_update_admin"
  on public.developer_app_lifecycle_events;
create policy "developer_app_lifecycle_events_update_admin"
  on public.developer_app_lifecycle_events
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "developer_app_lifecycle_events_delete_admin"
  on public.developer_app_lifecycle_events;
create policy "developer_app_lifecycle_events_delete_admin"
  on public.developer_app_lifecycle_events
  for delete
  to authenticated
  using (public.tc_is_admin());

grant select, insert on public.developer_app_reviews to authenticated;
grant update, delete on public.developer_app_reviews to authenticated;
grant select on public.developer_app_lifecycle_events to authenticated;
grant insert, update, delete on public.developer_app_lifecycle_events to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Mirror developer_orgs_phase4a.sql: replace each `using (public.tc_is_admin())`
-- / `with check (public.tc_is_admin())` admin policy with an explicit email
-- allow-list on auth.users, kept in sync with lib/adminAccess.js ADMIN_EMAILS.
-- ---------------------------------------------------------------------------
