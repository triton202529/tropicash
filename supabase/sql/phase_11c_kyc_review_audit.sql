-- Phase 11C: KYC review audit trail (append-only review events).
-- Depends on: phase_11a_kyc_foundation.sql, public.tc_is_admin().
-- Idempotent: safe to re-run.

create table if not exists public.kyc_review_events (
  id uuid primary key default gen_random_uuid(),
  kyc_profile_id uuid not null references public.kyc_profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  previous_status text,
  new_status text not null,
  review_notes text,
  reviewed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists kyc_review_events_profile_id_idx
  on public.kyc_review_events (kyc_profile_id, created_at desc);

create index if not exists kyc_review_events_user_id_idx
  on public.kyc_review_events (user_id, created_at desc);

create index if not exists kyc_review_events_created_at_idx
  on public.kyc_review_events (created_at desc);

comment on table public.kyc_review_events is
  'Append-only audit log for KYC status transitions. No update/delete policies.';

alter table public.kyc_review_events enable row level security;

drop policy if exists "kyc_review_events_select_admin" on public.kyc_review_events;
create policy "kyc_review_events_select_admin"
  on public.kyc_review_events
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "kyc_review_events_insert_admin" on public.kyc_review_events;
create policy "kyc_review_events_insert_admin"
  on public.kyc_review_events
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "kyc_review_events_select_own" on public.kyc_review_events;
create policy "kyc_review_events_select_own"
  on public.kyc_review_events
  for select
  to authenticated
  using (auth.uid() = user_id);

grant select, insert on public.kyc_review_events to authenticated;

-- Tighten user self-update: only editable statuses (submitted/under_review locked).
drop policy if exists "kyc_profiles_update_own" on public.kyc_profiles;
create policy "kyc_profiles_update_own"
  on public.kyc_profiles
  for update
  to authenticated
  using (
    auth.uid() = user_id
    and lower(btrim(status)) in ('not_started', 'rejected', 'needs_more_info')
  )
  with check (
    auth.uid() = user_id
    and lower(btrim(status)) in ('not_started', 'rejected', 'needs_more_info', 'submitted')
  );
