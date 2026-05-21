-- Risk review cases for human admin review (recommendations only; no automatic enforcement).
-- Depends on public.tc_is_admin() from withdrawal_requests.sql.
-- Idempotent: safe to re-run.

create table if not exists public.risk_review_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  risk_score integer not null default 0,
  confidence_score integer not null default 50,
  trust_score integer not null default 0,
  risk_level text not null default 'low',
  recommended_action text not null default 'allow',
  status text not null default 'open',
  priority text not null default 'normal',
  title text,
  summary text,
  reasons jsonb not null default '[]'::jsonb,
  source_snapshot jsonb not null default '{}'::jsonb,
  decay_snapshot jsonb not null default '{}'::jsonb,
  assigned_to uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint risk_review_cases_score_ck check (risk_score >= 0 and risk_score <= 100),
  constraint risk_review_cases_confidence_ck check (confidence_score >= 0 and confidence_score <= 100),
  constraint risk_review_cases_trust_ck check (trust_score >= -100 and trust_score <= 100),
  constraint risk_review_cases_level_ck check (
    risk_level in ('low', 'medium', 'high', 'critical')
  ),
  constraint risk_review_cases_action_ck check (
    recommended_action in ('allow', 'monitor', 'review', 'restrict', 'freeze_candidate')
  ),
  constraint risk_review_cases_status_ck check (
    status in ('open', 'reviewing', 'escalated', 'resolved', 'false_positive')
  ),
  constraint risk_review_cases_priority_ck check (
    priority in ('low', 'normal', 'high', 'critical')
  ),
  constraint risk_review_cases_reasons_array_ck check (jsonb_typeof(reasons) = 'array')
);

create index if not exists risk_review_cases_status_idx on public.risk_review_cases (status);
create index if not exists risk_review_cases_priority_idx on public.risk_review_cases (priority);
create index if not exists risk_review_cases_user_idx on public.risk_review_cases (user_id);
create index if not exists risk_review_cases_updated_idx on public.risk_review_cases (updated_at desc);

create table if not exists public.risk_review_case_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.risk_review_cases (id) on delete cascade,
  author_user_id uuid references auth.users (id) on delete set null,
  note text not null,
  note_type text not null default 'admin_note',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint risk_review_case_notes_type_ck check (
    note_type in ('admin_note', 'status_change', 'system_event', 'resolution')
  )
);

create index if not exists risk_review_case_notes_case_idx on public.risk_review_case_notes (case_id);
create index if not exists risk_review_case_notes_created_idx on public.risk_review_case_notes (created_at desc);

alter table public.risk_review_cases enable row level security;
alter table public.risk_review_case_notes enable row level security;

drop policy if exists "risk_review_cases_select_admin" on public.risk_review_cases;
create policy "risk_review_cases_select_admin"
  on public.risk_review_cases
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "risk_review_cases_insert_admin" on public.risk_review_cases;
create policy "risk_review_cases_insert_admin"
  on public.risk_review_cases
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "risk_review_cases_update_admin" on public.risk_review_cases;
create policy "risk_review_cases_update_admin"
  on public.risk_review_cases
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "risk_review_case_notes_select_admin" on public.risk_review_case_notes;
create policy "risk_review_case_notes_select_admin"
  on public.risk_review_case_notes
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "risk_review_case_notes_insert_admin" on public.risk_review_case_notes;
create policy "risk_review_case_notes_insert_admin"
  on public.risk_review_case_notes
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "risk_review_case_notes_update_admin" on public.risk_review_case_notes;
create policy "risk_review_case_notes_update_admin"
  on public.risk_review_case_notes
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

grant select, insert, update on public.risk_review_cases to authenticated;
grant select, insert, update on public.risk_review_case_notes to authenticated;

comment on table public.risk_review_cases is 'Admin-only human risk review queue (no automatic enforcement).';
comment on table public.risk_review_case_notes is 'Append-only style notes for risk review cases (admin insert/update only; no delete policy).';
