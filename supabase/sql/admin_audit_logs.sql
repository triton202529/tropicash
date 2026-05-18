-- Admin action audit trail (append-only; admins select/insert via tc_is_admin).
-- Depends on public.tc_is_admin() from withdrawal_requests.sql.
-- Idempotent: safe to re-run.

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  target_user_id uuid references auth.users (id) on delete set null,
  action text not null,
  category text not null default 'security',
  severity text not null default 'info',
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_category_ck;
alter table public.admin_audit_logs
  add constraint admin_audit_logs_category_ck check (
    category in ('security', 'wallet', 'withdrawal', 'payout', 'user_management', 'system')
  );

alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_severity_ck;
alter table public.admin_audit_logs
  add constraint admin_audit_logs_severity_ck check (
    severity in ('info', 'warning', 'high', 'critical')
  );

create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_actor_idx on public.admin_audit_logs (actor_user_id);
create index if not exists admin_audit_logs_target_idx on public.admin_audit_logs (target_user_id);
create index if not exists admin_audit_logs_category_idx on public.admin_audit_logs (category);

alter table public.admin_audit_logs enable row level security;

drop policy if exists "admin_audit_logs_select_admin" on public.admin_audit_logs;
create policy "admin_audit_logs_select_admin"
  on public.admin_audit_logs
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "admin_audit_logs_insert_admin" on public.admin_audit_logs;
create policy "admin_audit_logs_insert_admin"
  on public.admin_audit_logs
  for insert
  to authenticated
  with check (public.tc_is_admin());

grant select, insert on public.admin_audit_logs to authenticated;
