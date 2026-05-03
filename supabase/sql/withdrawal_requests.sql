-- Manual beta withdrawal queue. Sync admin emails with lib/adminAccess.js ADMIN_EMAILS.
-- Requires public.payout_methods (see payout_methods.sql).

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric not null,
  payout_method_id uuid references public.payout_methods (id) on delete set null,
  payout_label text,
  status text not null default 'pending',
  admin_note text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint withdrawal_requests_status_ck check (
    lower(btrim(status)) in ('pending', 'processing', 'paid', 'rejected')
  )
);

create index if not exists withdrawal_requests_user_id_idx on public.withdrawal_requests (user_id);
create index if not exists withdrawal_requests_status_idx on public.withdrawal_requests (lower(status));
create index if not exists withdrawal_requests_created_at_idx on public.withdrawal_requests (created_at desc);

alter table public.withdrawal_requests enable row level security;

-- Admin check (must match ADMIN_EMAILS in lib/adminAccess.js)
create or replace function public.tc_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = auth.uid()
      and lower(coalesce(u.email, '')) in ('akimtropicashad@gmail.com')
  );
$$;

revoke all on function public.tc_is_admin() from public;
grant execute on function public.tc_is_admin() to authenticated;

create policy "withdrawal_requests_select_own"
  on public.withdrawal_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "withdrawal_requests_select_admin"
  on public.withdrawal_requests
  for select
  to authenticated
  using (public.tc_is_admin());

create policy "withdrawal_requests_insert_own"
  on public.withdrawal_requests
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "withdrawal_requests_update_admin"
  on public.withdrawal_requests
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

grant select, insert on public.withdrawal_requests to authenticated;
grant update on public.withdrawal_requests to authenticated;
