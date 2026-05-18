-- Per-user security preferences (login alerts, 2FA prep — not enforced in app yet).
-- Depends on public.tc_is_admin() from withdrawal_requests.sql.
-- Idempotent: safe to re-run.

create table if not exists public.security_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  login_alerts_enabled boolean not null default true,
  suspicious_login_alerts_enabled boolean not null default true,
  session_revocation_alerts_enabled boolean not null default true,
  two_factor_enabled boolean not null default false,
  two_factor_method text default null,
  trusted_device_review_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint security_settings_two_factor_method_ck check (
    two_factor_method is null
    or two_factor_method in ('email_otp', 'authenticator_app', 'sms_otp')
  )
);

create index if not exists security_settings_updated_idx on public.security_settings (updated_at desc);

alter table public.security_settings enable row level security;

drop policy if exists "security_settings_select_own" on public.security_settings;
create policy "security_settings_select_own"
  on public.security_settings
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "security_settings_insert_own" on public.security_settings;
create policy "security_settings_insert_own"
  on public.security_settings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "security_settings_update_own" on public.security_settings;
create policy "security_settings_update_own"
  on public.security_settings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "security_settings_select_admin" on public.security_settings;
create policy "security_settings_select_admin"
  on public.security_settings
  for select
  to authenticated
  using (public.tc_is_admin());

grant select, insert, update on public.security_settings to authenticated;
