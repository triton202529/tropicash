-- Tropicash OAuth Platform — Phase 13D: wallet sandbox certification gate views.
--
-- Read-only views for admin gate reporting. Maps Phase 13C certification rows to
-- gate-relevant context (run_id, client, app) without exposing secrets,
-- balances, or tokens.
--
-- Dependencies:
--   • supabase/sql/oauth_wallet_certification_phase13c.sql

-- ===========================================================================
-- Gate row view (extracts safe context from summary JSONB)
-- ===========================================================================

create or replace view public.oauth_wallet_certification_gate_rows as
select
  c.id,
  c.run_id,
  c.user_id,
  c.status as certification_status,
  c.passed_count,
  c.failed_count,
  c.skipped_count,
  c.leak_detected,
  c.certified_at,
  nullif(c.summary->>'developer_app_id', '')::uuid as developer_app_id,
  nullif(c.summary->>'oauth_client_id', '')::uuid as oauth_client_id,
  c.summary->>'phase' as certification_phase,
  c.summary->>'evaluated_at' as evaluated_at
from public.oauth_wallet_test_certifications c;

comment on view public.oauth_wallet_certification_gate_rows is
  'Phase 13D: Safe certification gate rows — no secrets, balances, or raw evidence.';

-- ===========================================================================
-- Latest certification per OAuth client (for progression gate lookups)
-- ===========================================================================

create or replace view public.oauth_wallet_certification_gate_latest_by_client as
select distinct on (g.oauth_client_id)
  g.id,
  g.run_id,
  g.user_id,
  g.certification_status,
  g.passed_count,
  g.failed_count,
  g.skipped_count,
  g.leak_detected,
  g.certified_at,
  g.developer_app_id,
  g.oauth_client_id,
  g.certification_phase,
  g.evaluated_at
from public.oauth_wallet_certification_gate_rows g
where g.oauth_client_id is not null
order by g.oauth_client_id, g.certified_at desc;

comment on view public.oauth_wallet_certification_gate_latest_by_client is
  'Phase 13D: Latest certification per oauth_client_id for sandbox progression gate.';

-- ===========================================================================
-- Latest certification per run_id (run_id is unique; view for gate reporting)
-- ===========================================================================

create or replace view public.oauth_wallet_certification_gate_latest_by_run as
select
  g.id,
  g.run_id,
  g.user_id,
  g.certification_status,
  g.passed_count,
  g.failed_count,
  g.skipped_count,
  g.leak_detected,
  g.certified_at,
  g.developer_app_id,
  g.oauth_client_id,
  g.certification_phase,
  g.evaluated_at
from public.oauth_wallet_certification_gate_rows g;

comment on view public.oauth_wallet_certification_gate_latest_by_run is
  'Phase 13D: Certification gate rows keyed by run_id (one row per harness run).';

-- ===========================================================================
-- Indexes to support gate lookups on summary context
-- ===========================================================================

create index if not exists oauth_wallet_test_certifications_summary_client_idx
  on public.oauth_wallet_test_certifications ((summary->>'oauth_client_id'))
  where (summary->>'oauth_client_id') is not null;

create index if not exists oauth_wallet_test_certifications_summary_app_idx
  on public.oauth_wallet_test_certifications ((summary->>'developer_app_id'))
  where (summary->>'developer_app_id') is not null;

-- ===========================================================================
-- Grants (views inherit underlying table RLS)
-- ===========================================================================

grant select on public.oauth_wallet_certification_gate_rows to authenticated;
grant select on public.oauth_wallet_certification_gate_latest_by_client to authenticated;
grant select on public.oauth_wallet_certification_gate_latest_by_run to authenticated;
