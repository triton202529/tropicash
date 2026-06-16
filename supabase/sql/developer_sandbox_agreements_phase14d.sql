-- Tropicash Developer Platform — Phase 14D: sandbox agreements & acceptance audit trail.
--
-- Immutable agreement acceptance records. Developers must accept current sandbox terms
-- before using approved sandbox capabilities. No production access or money movement.
--
-- Dependencies:
--   • public.developer_sandbox_applications (Phase 14B)
--   • public.tc_is_admin() from withdrawal_requests.sql

-- ===========================================================================
-- developer_sandbox_agreements
-- ===========================================================================

create table if not exists public.developer_sandbox_agreements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users (id) on delete cascade,
  application_id uuid
    references public.developer_sandbox_applications (id) on delete set null,
  agreement_version text not null,
  accepted_at timestamptz not null default now(),
  accepted_ip text,
  accepted_user_agent text,
  created_at timestamptz not null default now()
);

create unique index if not exists developer_sandbox_agreements_user_version_uidx
  on public.developer_sandbox_agreements (user_id, agreement_version);

create index if not exists developer_sandbox_agreements_user_id_idx
  on public.developer_sandbox_agreements (user_id);

create index if not exists developer_sandbox_agreements_application_id_idx
  on public.developer_sandbox_agreements (application_id);

create index if not exists developer_sandbox_agreements_accepted_at_idx
  on public.developer_sandbox_agreements (accepted_at desc);

create index if not exists developer_sandbox_agreements_version_idx
  on public.developer_sandbox_agreements (agreement_version);

comment on table public.developer_sandbox_agreements is
  'Phase 14D: Immutable sandbox agreement acceptance audit trail. One record per user per version.';

-- ===========================================================================
-- Row level security — immutable history (insert + select only for developers)
-- ===========================================================================

alter table public.developer_sandbox_agreements enable row level security;

drop policy if exists "developer_sandbox_agreements_insert_own"
  on public.developer_sandbox_agreements;
create policy "developer_sandbox_agreements_insert_own"
  on public.developer_sandbox_agreements
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "developer_sandbox_agreements_select_own"
  on public.developer_sandbox_agreements;
create policy "developer_sandbox_agreements_select_own"
  on public.developer_sandbox_agreements
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "developer_sandbox_agreements_select_admin"
  on public.developer_sandbox_agreements;
create policy "developer_sandbox_agreements_select_admin"
  on public.developer_sandbox_agreements
  for select
  to authenticated
  using (public.tc_is_admin());

grant select, insert on public.developer_sandbox_agreements to authenticated;

-- No UPDATE or DELETE policies — agreement history is immutable.
