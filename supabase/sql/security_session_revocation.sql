-- Session revocation: revoked_by + RLS for user activity/revoke + admin updates.
-- Idempotent. Depends on public.user_sessions and public.tc_is_admin() (withdrawal_requests.sql).
-- Run after security_foundation.sql.

-- 1) Columns (revoked_at may already exist from security_foundation.sql)
alter table public.user_sessions add column if not exists revoked_at timestamptz;
alter table public.user_sessions add column if not exists revoked_by uuid references auth.users (id) on delete set null;

-- Mirrors revoked_at for filters / admin KPIs (no application writes)
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'user_sessions'
      and column_name = 'revoked'
  ) then
    alter table public.user_sessions
      add column revoked boolean generated always as (revoked_at is not null) stored;
  end if;
end
$$;

comment on column public.user_sessions.revoked_by is 'User who recorded revocation (self-service or admin).';

-- 2) RLS: split UPDATE so users can refresh activity on active rows or revoke once; admins can update any row.
drop policy if exists "user_sessions_update_own" on public.user_sessions;

drop policy if exists "user_sessions_update_own_maintain_active" on public.user_sessions;
create policy "user_sessions_update_own_maintain_active"
  on public.user_sessions
  for update
  to authenticated
  using (auth.uid() = user_id and revoked_at is null)
  with check (
    auth.uid() = user_id
    and revoked_at is null
    and revoked_by is null
  );

drop policy if exists "user_sessions_update_own_revoke" on public.user_sessions;
create policy "user_sessions_update_own_revoke"
  on public.user_sessions
  for update
  to authenticated
  using (auth.uid() = user_id and revoked_at is null)
  with check (
    auth.uid() = user_id
    and revoked_at is not null
    and revoked_by is not distinct from auth.uid()
  );

drop policy if exists "user_sessions_update_admin" on public.user_sessions;
create policy "user_sessions_update_admin"
  on public.user_sessions
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());
