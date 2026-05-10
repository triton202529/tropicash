-- Controlled tester feedback (soft launch). Run after auth.users exists.
-- Admin access uses public.tc_is_admin() — keep emails in sync with lib/adminAccess.js + withdrawal_requests.sql.

create table if not exists public.tester_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  issue_type text not null,
  message text not null,
  rating integer,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tester_feedback_rating_ck check (rating is null or (rating >= 1 and rating <= 5)),
  constraint tester_feedback_status_ck check (lower(btrim(status)) in ('open', 'reviewed', 'closed'))
);

create index if not exists tester_feedback_created_at_idx on public.tester_feedback (created_at desc);
create index if not exists tester_feedback_user_id_idx on public.tester_feedback (user_id);
create index if not exists tester_feedback_status_idx on public.tester_feedback (lower(status));

comment on table public.tester_feedback is 'Structured tester feedback during controlled launch (RLS: own rows + admin).';
comment on column public.tester_feedback.updated_at is 'Set on insert by default; app should set on admin status updates.';

alter table public.tester_feedback enable row level security;

-- Requires public.tc_is_admin() from withdrawal_requests.sql (or equivalent).
create policy "tester_feedback_insert_own"
  on public.tester_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "tester_feedback_select_own"
  on public.tester_feedback
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "tester_feedback_select_admin"
  on public.tester_feedback
  for select
  to authenticated
  using (public.tc_is_admin());

create policy "tester_feedback_update_admin"
  on public.tester_feedback
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

grant select, insert on public.tester_feedback to authenticated;
grant update on public.tester_feedback to authenticated;
