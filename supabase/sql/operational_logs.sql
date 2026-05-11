-- Internal operational telemetry (soft launch). No PII beyond user_id; app must sanitize metadata.
-- Admin read uses public.tc_is_admin() — align with lib/adminAccess.js + withdrawal_requests.sql.

create table if not exists public.operational_logs (
  id uuid primary key default gen_random_uuid(),
  level text not null,
  category text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  user_id uuid references auth.users (id) on delete set null,
  route text,
  created_at timestamptz not null default now()
);

create index if not exists operational_logs_created_at_idx on public.operational_logs (created_at desc);
create index if not exists operational_logs_category_idx on public.operational_logs (category);
create index if not exists operational_logs_level_idx on public.operational_logs (level);

comment on table public.operational_logs is 'Lightweight operational events/errors (RLS: insert own user_id or service role; admin select).';

alter table public.operational_logs enable row level security;

create policy "operational_logs_select_admin"
  on public.operational_logs
  for select
  to authenticated
  using (public.tc_is_admin());

-- Authenticated clients may only insert rows for themselves (no spoofing).
create policy "operational_logs_insert_own"
  on public.operational_logs
  for insert
  to authenticated
  with check (user_id = auth.uid());

grant select on public.operational_logs to authenticated;
grant insert on public.operational_logs to authenticated;
