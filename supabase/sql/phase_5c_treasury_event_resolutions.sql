-- Phase 5C: Treasury Event Center resolution workflow (admin-only operational tracking).
-- Depends on public.tc_is_admin() from withdrawal_requests.sql.
-- Does NOT mutate source event tables (fraud_logs, security_events, etc.).
-- Idempotent: safe to re-run.

create table if not exists public.treasury_event_resolutions (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_source text,
  event_category text,
  status text not null default 'open',
  resolution_summary text,
  assigned_to uuid references auth.users(id) on delete set null,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treasury_event_resolutions_status_ck check (
    status in ('open', 'reviewing', 'escalated', 'resolved', 'dismissed')
  )
);

create index if not exists treasury_event_resolutions_status_idx
  on public.treasury_event_resolutions (status);

create index if not exists treasury_event_resolutions_updated_at_idx
  on public.treasury_event_resolutions (updated_at desc);

create or replace function public.treasury_event_resolutions_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists treasury_event_resolutions_set_updated_at_trg
  on public.treasury_event_resolutions;
create trigger treasury_event_resolutions_set_updated_at_trg
  before update on public.treasury_event_resolutions
  for each row
  execute function public.treasury_event_resolutions_set_updated_at();

alter table public.treasury_event_resolutions enable row level security;

drop policy if exists "treasury_event_resolutions_select_admin"
  on public.treasury_event_resolutions;
create policy "treasury_event_resolutions_select_admin"
  on public.treasury_event_resolutions
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "treasury_event_resolutions_insert_admin"
  on public.treasury_event_resolutions;
create policy "treasury_event_resolutions_insert_admin"
  on public.treasury_event_resolutions
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "treasury_event_resolutions_update_admin"
  on public.treasury_event_resolutions;
create policy "treasury_event_resolutions_update_admin"
  on public.treasury_event_resolutions
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

grant select, insert, update on public.treasury_event_resolutions to authenticated;

comment on table public.treasury_event_resolutions is
  'Admin-only operational resolution tracking for Treasury Event Center. Separate from source event tables.';
