-- Treasury health snapshots (observability only; no wallet or payout mutations).
-- Depends on public.tc_is_admin() from withdrawal_requests.sql.
-- Idempotent: safe to re-run.

create table if not exists public.treasury_health_snapshots (
  id uuid primary key default gen_random_uuid(),
  health_score integer not null default 100,
  treasury_risk_level text not null default 'low',
  confidence_score integer not null default 50,
  liquidity_score integer not null default 100,
  reconciliation_score integer not null default 100,
  pending_obligation_score integer not null default 100,
  total_wallet_liabilities numeric not null default 0,
  total_funding_volume_24h numeric not null default 0,
  total_withdraw_volume_24h numeric not null default 0,
  total_send_volume_24h numeric not null default 0,
  pending_withdrawal_exposure numeric not null default 0,
  failed_funding_count_24h integer not null default 0,
  reconciliation_mismatch_count integer not null default 0,
  anomaly_count integer not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint treasury_health_score_ck check (health_score >= 0 and health_score <= 100),
  constraint treasury_health_confidence_ck check (confidence_score >= 0 and confidence_score <= 100),
  constraint treasury_health_liquidity_ck check (liquidity_score >= 0 and liquidity_score <= 100),
  constraint treasury_health_reconciliation_ck check (reconciliation_score >= 0 and reconciliation_score <= 100),
  constraint treasury_health_pending_obligation_ck check (
    pending_obligation_score >= 0 and pending_obligation_score <= 100
  ),
  constraint treasury_health_risk_level_ck check (
    treasury_risk_level in ('low', 'medium', 'high', 'critical')
  ),
  constraint treasury_health_reasons_array_ck check (jsonb_typeof(reasons) = 'array')
);

create index if not exists treasury_health_created_idx
  on public.treasury_health_snapshots (created_at desc);

create index if not exists treasury_health_score_idx
  on public.treasury_health_snapshots (health_score desc);

create index if not exists treasury_health_risk_idx
  on public.treasury_health_snapshots (treasury_risk_level);

alter table public.treasury_health_snapshots enable row level security;

drop policy if exists "treasury_health_snapshots_select_admin" on public.treasury_health_snapshots;
create policy "treasury_health_snapshots_select_admin"
  on public.treasury_health_snapshots
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "treasury_health_snapshots_insert_admin" on public.treasury_health_snapshots;
create policy "treasury_health_snapshots_insert_admin"
  on public.treasury_health_snapshots
  for insert
  to authenticated
  with check (public.tc_is_admin());

grant select, insert on public.treasury_health_snapshots to authenticated;

comment on table public.treasury_health_snapshots is
  'Admin-only treasury health score snapshots (read-only observability; no financial mutations).';
