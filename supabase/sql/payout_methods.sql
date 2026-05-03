-- Payout method placeholders (soft launch). Never store full PAN.
-- Run in Supabase SQL editor or via migration.

create table if not exists public.payout_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null default 'card',
  cardholder_name text,
  last4 text,
  brand text,
  payout_label text,
  is_default boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists payout_methods_user_id_idx on public.payout_methods (user_id);

alter table public.payout_methods enable row level security;

create policy "payout_methods_select_own"
  on public.payout_methods
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "payout_methods_insert_own"
  on public.payout_methods
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "payout_methods_update_own"
  on public.payout_methods
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "payout_methods_delete_own"
  on public.payout_methods
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.payout_methods to authenticated;
