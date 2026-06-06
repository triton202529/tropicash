-- Treasury operational events (observability only; append-only admin audit trail).
-- Depends on public.tc_is_admin() from withdrawal_requests.sql.
-- Idempotent: safe to re-run.

create table if not exists public.treasury_operational_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  severity text not null default 'info',
  title text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint treasury_operational_events_severity_ck check (
    severity in ('info', 'low', 'moderate', 'elevated', 'high')
  )
);

create index if not exists treasury_operational_events_created_idx
  on public.treasury_operational_events (created_at desc);

create index if not exists treasury_operational_events_type_idx
  on public.treasury_operational_events (event_type);

create index if not exists treasury_operational_events_severity_idx
  on public.treasury_operational_events (severity);

alter table public.treasury_operational_events enable row level security;

drop policy if exists "treasury_operational_events_select_admin" on public.treasury_operational_events;
create policy "treasury_operational_events_select_admin"
  on public.treasury_operational_events
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "treasury_operational_events_insert_admin" on public.treasury_operational_events;
create policy "treasury_operational_events_insert_admin"
  on public.treasury_operational_events
  for insert
  to authenticated
  with check (public.tc_is_admin());

grant select, insert on public.treasury_operational_events to authenticated;

comment on table public.treasury_operational_events is
  'Admin-only append-only treasury operational monitoring events (read-only observability; no financial mutations).';
