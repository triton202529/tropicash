-- Tropicash OAuth Platform — Phase 13B: wallet sandbox test evidence.
--
-- Append-only pass/fail evidence for the OAuth Wallet Test Harness. Stores
-- sanitized step outcomes only — never secrets, tokens, authorization codes,
-- wallet balances, transactions, or KYC documents.
--
-- Scope: diagnostics only. Does NOT modify wallets, treasury, fraud, KYC, or
-- enable money movement.
--
-- Dependencies:
--   • supabase/sql/oauth_consent_foundation_phase12k.sql (oauth_clients)
--   • supabase/sql/developer_orgs_phase4a.sql (developer_apps)

-- ===========================================================================
-- oauth_wallet_test_evidence
-- ===========================================================================

create table if not exists public.oauth_wallet_test_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users (id) on delete cascade,
  developer_app_id uuid
    references public.developer_apps (id) on delete set null,
  oauth_client_id uuid
    references public.oauth_clients (id) on delete set null,
  run_id text not null,
  step_key text not null,
  step_label text not null,
  status text not null
    constraint oauth_wallet_test_evidence_status_ck
      check (status in ('passed', 'failed', 'skipped')),
  http_status integer,
  sanitized_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists oauth_wallet_test_evidence_user_id_idx
  on public.oauth_wallet_test_evidence (user_id);

create index if not exists oauth_wallet_test_evidence_run_id_idx
  on public.oauth_wallet_test_evidence (run_id);

create index if not exists oauth_wallet_test_evidence_step_key_idx
  on public.oauth_wallet_test_evidence (step_key);

create index if not exists oauth_wallet_test_evidence_status_idx
  on public.oauth_wallet_test_evidence (status);

create index if not exists oauth_wallet_test_evidence_created_at_idx
  on public.oauth_wallet_test_evidence (created_at desc);

create index if not exists oauth_wallet_test_evidence_run_created_idx
  on public.oauth_wallet_test_evidence (run_id, created_at desc);

comment on table public.oauth_wallet_test_evidence is
  'Phase 13B: sanitized OAuth wallet sandbox harness evidence. Never stores secrets, tokens, codes, or balances.';

-- ===========================================================================
-- Row level security
-- ===========================================================================

alter table public.oauth_wallet_test_evidence enable row level security;

drop policy if exists "oauth_wallet_test_evidence_insert_own"
  on public.oauth_wallet_test_evidence;
create policy "oauth_wallet_test_evidence_insert_own"
  on public.oauth_wallet_test_evidence
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "oauth_wallet_test_evidence_select_own"
  on public.oauth_wallet_test_evidence;
create policy "oauth_wallet_test_evidence_select_own"
  on public.oauth_wallet_test_evidence
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "oauth_wallet_test_evidence_select_admin"
  on public.oauth_wallet_test_evidence;
create policy "oauth_wallet_test_evidence_select_admin"
  on public.oauth_wallet_test_evidence
  for select
  to authenticated
  using (public.tc_is_admin());

grant select, insert on public.oauth_wallet_test_evidence to authenticated;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- Replace each `using (public.tc_is_admin())` admin policy with an explicit
-- email allow-list on auth.users, kept in sync with lib/adminAccess.js
-- ADMIN_EMAILS — same pattern as developer_center_phase1.sql.
-- ---------------------------------------------------------------------------
