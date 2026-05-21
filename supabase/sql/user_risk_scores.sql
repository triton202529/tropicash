-- Unified user risk scores (observability + recommendations only; no enforcement).
-- Depends on public.tc_is_admin() from withdrawal_requests.sql.
-- Idempotent: safe to re-run.

create table if not exists public.user_risk_scores (
  user_id uuid primary key references auth.users (id) on delete cascade,
  risk_score integer not null default 0,
  risk_level text not null default 'low',
  recommended_action text not null default 'allow',
  reasons jsonb not null default '[]'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb,
  last_scored_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint user_risk_scores_score_ck check (risk_score >= 0 and risk_score <= 100),
  constraint user_risk_scores_level_ck check (
    risk_level in ('low', 'medium', 'high', 'critical')
  ),
  constraint user_risk_scores_action_ck check (
    recommended_action in ('allow', 'monitor', 'review', 'restrict', 'freeze_candidate')
  ),
  constraint user_risk_scores_reasons_array_ck check (jsonb_typeof(reasons) = 'array')
);

create index if not exists user_risk_scores_level_idx on public.user_risk_scores (risk_level);
create index if not exists user_risk_scores_score_idx on public.user_risk_scores (risk_score desc);
create index if not exists user_risk_scores_updated_idx on public.user_risk_scores (updated_at desc);

alter table public.user_risk_scores enable row level security;

drop policy if exists "user_risk_scores_select_admin" on public.user_risk_scores;
create policy "user_risk_scores_select_admin"
  on public.user_risk_scores
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "user_risk_scores_insert_admin" on public.user_risk_scores;
create policy "user_risk_scores_insert_admin"
  on public.user_risk_scores
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "user_risk_scores_update_admin" on public.user_risk_scores;
create policy "user_risk_scores_update_admin"
  on public.user_risk_scores
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

grant select, insert, update on public.user_risk_scores to authenticated;

comment on table public.user_risk_scores is 'Admin-only unified risk score snapshots (recommendations only; no automatic enforcement).';
