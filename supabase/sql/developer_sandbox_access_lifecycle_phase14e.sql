-- Tropicash Developer Platform — Phase 14E: sandbox access activation & lifecycle.
--
-- Controlled lifecycle for approved developers. Approval + agreement does not auto-activate.
-- Immutable status history audit trail. No production access or money movement.
--
-- Dependencies:
--   • public.developer_sandbox_applications (Phase 14B)
--   • public.developer_sandbox_agreements (Phase 14D)
--   • public.tc_is_admin() from withdrawal_requests.sql

-- ===========================================================================
-- developer_sandbox_access
-- ===========================================================================

create table if not exists public.developer_sandbox_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users (id) on delete cascade,
  application_id uuid
    references public.developer_sandbox_applications (id) on delete set null,
  status text not null default 'pending_activation',
  activated_at timestamptz,
  suspended_at timestamptz,
  expired_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  action_by uuid
    references auth.users (id) on delete set null,
  action_reason text,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.developer_sandbox_access
  drop constraint if exists developer_sandbox_access_status_ck;

alter table public.developer_sandbox_access
  add constraint developer_sandbox_access_status_ck
    check (status in (
      'pending_activation',
      'active',
      'suspended',
      'expired',
      'revoked'
    ));

create unique index if not exists developer_sandbox_access_user_id_uidx
  on public.developer_sandbox_access (user_id);

create index if not exists developer_sandbox_access_status_idx
  on public.developer_sandbox_access (status);

create index if not exists developer_sandbox_access_application_id_idx
  on public.developer_sandbox_access (application_id);

create index if not exists developer_sandbox_access_expires_at_idx
  on public.developer_sandbox_access (expires_at);

comment on table public.developer_sandbox_access is
  'Phase 14E: Developer sandbox access lifecycle. Admin activation required — not automatic.';

-- ===========================================================================
-- developer_sandbox_access_status_history (immutable audit)
-- ===========================================================================

create table if not exists public.developer_sandbox_access_status_history (
  id uuid primary key default gen_random_uuid(),
  access_id uuid not null
    references public.developer_sandbox_access (id) on delete cascade,
  user_id uuid not null
    references auth.users (id) on delete cascade,
  application_id uuid
    references public.developer_sandbox_applications (id) on delete set null,
  from_status text,
  to_status text not null,
  action_by uuid
    references auth.users (id) on delete set null,
  action_reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists developer_sandbox_access_history_access_id_idx
  on public.developer_sandbox_access_status_history (access_id);

create index if not exists developer_sandbox_access_history_user_id_idx
  on public.developer_sandbox_access_status_history (user_id);

create index if not exists developer_sandbox_access_history_created_at_idx
  on public.developer_sandbox_access_status_history (created_at desc);

comment on table public.developer_sandbox_access_status_history is
  'Phase 14E: Immutable sandbox access status transition audit trail.';

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.developer_sandbox_access enable row level security;
alter table public.developer_sandbox_access_status_history enable row level security;

-- developer_sandbox_access — developers read own; admins read/write (no delete)

drop policy if exists "developer_sandbox_access_select_own"
  on public.developer_sandbox_access;
create policy "developer_sandbox_access_select_own"
  on public.developer_sandbox_access
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "developer_sandbox_access_select_admin"
  on public.developer_sandbox_access;
create policy "developer_sandbox_access_select_admin"
  on public.developer_sandbox_access
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "developer_sandbox_access_insert_admin"
  on public.developer_sandbox_access;
create policy "developer_sandbox_access_insert_admin"
  on public.developer_sandbox_access
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "developer_sandbox_access_update_admin"
  on public.developer_sandbox_access;
create policy "developer_sandbox_access_update_admin"
  on public.developer_sandbox_access
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

-- status history — developers read own; admins insert + read (immutable)

drop policy if exists "developer_sandbox_access_history_select_own"
  on public.developer_sandbox_access_status_history;
create policy "developer_sandbox_access_history_select_own"
  on public.developer_sandbox_access_status_history
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "developer_sandbox_access_history_select_admin"
  on public.developer_sandbox_access_status_history;
create policy "developer_sandbox_access_history_select_admin"
  on public.developer_sandbox_access_status_history
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "developer_sandbox_access_history_insert_admin"
  on public.developer_sandbox_access_status_history;
create policy "developer_sandbox_access_history_insert_admin"
  on public.developer_sandbox_access_status_history
  for insert
  to authenticated
  with check (public.tc_is_admin());

grant select on public.developer_sandbox_access to authenticated;
grant insert, update on public.developer_sandbox_access to authenticated;

grant select on public.developer_sandbox_access_status_history to authenticated;
grant insert on public.developer_sandbox_access_status_history to authenticated;

-- No DELETE policies — audit history is preserved.
