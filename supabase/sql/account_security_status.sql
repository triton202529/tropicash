-- Per-user account security status (freeze / restrict foundation — visibility & admin control only).
-- Depends on public.tc_is_admin() from withdrawal_requests.sql.
-- Idempotent: safe to re-run.

create table if not exists public.account_security_status (
  user_id uuid primary key references auth.users (id) on delete cascade,
  status text not null default 'normal',
  risk_level text not null default 'low',
  reason text,
  notes text,
  frozen_at timestamptz,
  frozen_by uuid references auth.users (id) on delete set null,
  unfrozen_at timestamptz,
  unfrozen_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint account_security_status_status_ck check (
    status in ('normal', 'watch', 'restricted', 'frozen')
  ),
  constraint account_security_status_risk_ck check (
    risk_level in ('low', 'medium', 'high', 'critical')
  )
);

create index if not exists account_security_status_status_idx on public.account_security_status (status);
create index if not exists account_security_status_risk_idx on public.account_security_status (risk_level);
create index if not exists account_security_status_updated_idx on public.account_security_status (updated_at desc);

alter table public.account_security_status enable row level security;

drop policy if exists "account_security_status_select_own" on public.account_security_status;
create policy "account_security_status_select_own"
  on public.account_security_status
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "account_security_status_select_admin" on public.account_security_status;
create policy "account_security_status_select_admin"
  on public.account_security_status
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "account_security_status_insert_admin" on public.account_security_status;
create policy "account_security_status_insert_admin"
  on public.account_security_status
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "account_security_status_update_admin" on public.account_security_status;
create policy "account_security_status_update_admin"
  on public.account_security_status
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

grant select on public.account_security_status to authenticated;
grant insert, update on public.account_security_status to authenticated;

-- Allow admins to record security_events for any user when updating account status.
drop policy if exists "security_events_insert_admin" on public.security_events;
create policy "security_events_insert_admin"
  on public.security_events
  for insert
  to authenticated
  with check (public.tc_is_admin());
