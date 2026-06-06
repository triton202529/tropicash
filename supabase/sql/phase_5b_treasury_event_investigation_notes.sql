-- Phase 5B: Treasury Event Center investigation notes (admin-only append-only).
-- Depends on public.tc_is_admin() from withdrawal_requests.sql.
-- Idempotent: safe to re-run.

create table if not exists public.treasury_event_investigation_notes (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  event_source text,
  event_category text,
  note text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists treasury_event_investigation_notes_event_id_idx
  on public.treasury_event_investigation_notes (event_id, created_at desc);

create index if not exists treasury_event_investigation_notes_created_at_idx
  on public.treasury_event_investigation_notes (created_at desc);

alter table public.treasury_event_investigation_notes enable row level security;

drop policy if exists "treasury_event_investigation_notes_select_admin"
  on public.treasury_event_investigation_notes;
create policy "treasury_event_investigation_notes_select_admin"
  on public.treasury_event_investigation_notes
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "treasury_event_investigation_notes_insert_admin"
  on public.treasury_event_investigation_notes;
create policy "treasury_event_investigation_notes_insert_admin"
  on public.treasury_event_investigation_notes
  for insert
  to authenticated
  with check (public.tc_is_admin());

grant select, insert on public.treasury_event_investigation_notes to authenticated;

comment on table public.treasury_event_investigation_notes is
  'Admin-only investigation notes for Treasury Event Center items. Does not mutate source event tables.';
