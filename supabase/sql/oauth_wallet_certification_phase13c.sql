-- Tropicash OAuth Platform — Phase 13C: wallet sandbox certification records.
--
-- Stores pass/fail/incomplete certification outcomes derived from
-- oauth_wallet_test_evidence. Summary JSON contains no secrets, tokens, or
-- raw balances — only evaluation metadata and leak flags.
--
-- Dependencies:
--   • supabase/sql/oauth_wallet_test_evidence_phase13b.sql

-- ===========================================================================
-- oauth_wallet_test_certifications
-- ===========================================================================

create table if not exists public.oauth_wallet_test_certifications (
  id uuid primary key default gen_random_uuid(),
  run_id text not null,
  user_id uuid not null
    references auth.users (id) on delete cascade,
  status text not null
    constraint oauth_wallet_test_certifications_status_ck
      check (status in ('certified', 'failed', 'incomplete')),
  passed_count integer not null default 0,
  failed_count integer not null default 0,
  skipped_count integer not null default 0,
  leak_detected boolean not null default false,
  summary jsonb not null default '{}'::jsonb,
  certified_at timestamptz not null default now()
);

create unique index if not exists oauth_wallet_test_certifications_run_id_uidx
  on public.oauth_wallet_test_certifications (run_id);

create index if not exists oauth_wallet_test_certifications_user_id_idx
  on public.oauth_wallet_test_certifications (user_id);

create index if not exists oauth_wallet_test_certifications_status_idx
  on public.oauth_wallet_test_certifications (status);

create index if not exists oauth_wallet_test_certifications_certified_at_idx
  on public.oauth_wallet_test_certifications (certified_at desc);

comment on table public.oauth_wallet_test_certifications is
  'Phase 13C: OAuth wallet sandbox certification outcomes per harness run_id. Audit trail only — no secrets or balances.';

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.oauth_wallet_test_certifications enable row level security;

drop policy if exists "oauth_wallet_test_certifications_select_own"
  on public.oauth_wallet_test_certifications;
create policy "oauth_wallet_test_certifications_select_own"
  on public.oauth_wallet_test_certifications
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "oauth_wallet_test_certifications_select_admin"
  on public.oauth_wallet_test_certifications;
create policy "oauth_wallet_test_certifications_select_admin"
  on public.oauth_wallet_test_certifications
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "oauth_wallet_test_certifications_insert_admin"
  on public.oauth_wallet_test_certifications;
create policy "oauth_wallet_test_certifications_insert_admin"
  on public.oauth_wallet_test_certifications
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "oauth_wallet_test_certifications_update_admin"
  on public.oauth_wallet_test_certifications;
create policy "oauth_wallet_test_certifications_update_admin"
  on public.oauth_wallet_test_certifications
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

grant select, insert, update on public.oauth_wallet_test_certifications to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Replace each `using (public.tc_is_admin())` admin policy with an explicit
-- email allow-list on auth.users, kept in sync with lib/adminAccess.js
-- ADMIN_EMAILS — same pattern as developer_center_phase1.sql.
-- ---------------------------------------------------------------------------
