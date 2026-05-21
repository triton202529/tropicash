-- Phase 2b: explainable risk engine columns on public.user_risk_scores.
-- Depends on public.user_risk_scores from user_risk_scores.sql.
-- Idempotent: safe to re-run. No destructive changes.

alter table if exists public.user_risk_scores
  add column if not exists confidence_score integer not null default 50;

alter table if exists public.user_risk_scores
  add column if not exists trust_score integer not null default 0;

alter table if exists public.user_risk_scores
  add column if not exists risk_version text not null default 'phase2b';

alter table if exists public.user_risk_scores
  add column if not exists decay_snapshot jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'user_risk_scores'
      and c.conname = 'user_risk_scores_confidence_ck'
  ) then
    alter table public.user_risk_scores
      add constraint user_risk_scores_confidence_ck
      check (confidence_score >= 0 and confidence_score <= 100);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'user_risk_scores'
      and c.conname = 'user_risk_scores_trust_ck'
  ) then
    alter table public.user_risk_scores
      add constraint user_risk_scores_trust_ck
      check (trust_score >= -100 and trust_score <= 100);
  end if;
end $$;

create index if not exists user_risk_scores_confidence_idx
  on public.user_risk_scores (confidence_score desc);

create index if not exists user_risk_scores_trust_idx
  on public.user_risk_scores (trust_score desc);

comment on column public.user_risk_scores.confidence_score is '0–100 confidence in the risk assessment (data coverage + corroboration).';
comment on column public.user_risk_scores.trust_score is '-100–100 trust offset from stable/clean account signals.';
comment on column public.user_risk_scores.risk_version is 'Scoring engine version identifier (e.g. phase2b).';
comment on column public.user_risk_scores.decay_snapshot is 'Age-decay weight summary for decayed signal categories.';
