-- Risk review cases — Phase 2D: intelligent operations workflow (timeline + recommendations).
-- Human review only; no automatic enforcement.
-- Depends on public.risk_review_cases and public.tc_is_admin().
-- Idempotent: safe to re-run.

create table if not exists public.risk_review_case_timeline (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.risk_review_cases (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  event_type text not null,
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint risk_review_case_timeline_event_type_ck check (
    event_type in (
      'case_created',
      'case_assigned',
      'case_status_changed',
      'note_added',
      'recommendation_generated',
      'resolution',
      'repeat_risk_detected',
      'score_changed'
    )
  )
);

create index if not exists risk_review_case_timeline_case_idx
  on public.risk_review_case_timeline (case_id);

create index if not exists risk_review_case_timeline_created_idx
  on public.risk_review_case_timeline (created_at desc);

comment on table public.risk_review_case_timeline is
  'Append-only audit timeline for risk review cases (admin read/insert only; guidance labels, no enforcement).';

alter table public.risk_review_case_timeline enable row level security;

drop policy if exists "risk_review_case_timeline_select_admin" on public.risk_review_case_timeline;
create policy "risk_review_case_timeline_select_admin"
  on public.risk_review_case_timeline
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "risk_review_case_timeline_insert_admin" on public.risk_review_case_timeline;
create policy "risk_review_case_timeline_insert_admin"
  on public.risk_review_case_timeline
  for insert
  to authenticated
  with check (public.tc_is_admin());

grant select, insert on public.risk_review_case_timeline to authenticated;
