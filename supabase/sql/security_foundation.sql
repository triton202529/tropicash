-- Security observability: events + device sessions.
-- Depends on public.tc_is_admin() from withdrawal_requests.sql (same admin emails as lib/adminAccess.js).

create table if not exists public.security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  severity text not null default 'info',
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint security_events_severity_ck check (
    lower(btrim(severity)) in ('info', 'warning', 'high', 'critical')
  )
);

create index if not exists security_events_user_created_idx on public.security_events (user_id, created_at desc);
create index if not exists security_events_severity_idx on public.security_events (lower(severity));

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_token text not null default '',
  device_name text not null default '',
  browser text not null default '',
  os text not null default '',
  ip_address text not null default '',
  location text not null default '',
  last_active_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_sessions_user_id_idx on public.user_sessions (user_id);
create index if not exists user_sessions_user_last_active_idx on public.user_sessions (user_id, last_active_at desc);

alter table public.security_events enable row level security;
alter table public.user_sessions enable row level security;

drop policy if exists "security_events_select_own" on public.security_events;
create policy "security_events_select_own"
  on public.security_events
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "security_events_insert_own" on public.security_events;
create policy "security_events_insert_own"
  on public.security_events
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "security_events_select_admin" on public.security_events;
create policy "security_events_select_admin"
  on public.security_events
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "user_sessions_select_own" on public.user_sessions;
create policy "user_sessions_select_own"
  on public.user_sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_sessions_insert_own" on public.user_sessions;
create policy "user_sessions_insert_own"
  on public.user_sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_sessions_update_own" on public.user_sessions;
create policy "user_sessions_update_own"
  on public.user_sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "user_sessions_select_admin" on public.user_sessions;
create policy "user_sessions_select_admin"
  on public.user_sessions
  for select
  to authenticated
  using (public.tc_is_admin());

grant select, insert on public.security_events to authenticated;
grant select, insert, update on public.user_sessions to authenticated;
