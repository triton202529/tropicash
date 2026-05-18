-- Triton internal transfer request queue (soft launch, phase 1).
-- Request infrastructure only — no automatic wallet mutations and no broker calls in this phase.
-- Admin access uses public.tc_is_admin() — keep emails in sync with lib/adminAccess.js + withdrawal_requests.sql.

create table if not exists public.triton_transfer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  direction text not null,
  amount numeric not null,
  status text not null default 'pending',
  wallet_transaction_id uuid,
  triton_reference text,
  admin_note text,
  processed_by uuid references auth.users (id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint triton_transfer_requests_direction_ck check (
    direction in ('to_triton', 'from_triton')
  ),
  constraint triton_transfer_requests_amount_ck check (amount > 0),
  constraint triton_transfer_requests_status_ck check (
    status in ('pending', 'processing', 'completed', 'rejected', 'cancelled')
  )
);

create index if not exists triton_transfer_requests_user_id_idx on public.triton_transfer_requests (user_id);
create index if not exists triton_transfer_requests_status_idx on public.triton_transfer_requests (status);
create index if not exists triton_transfer_requests_direction_idx on public.triton_transfer_requests (direction);
create index if not exists triton_transfer_requests_created_at_idx on public.triton_transfer_requests (created_at desc);

comment on table public.triton_transfer_requests is
  'Tropicash ↔ Triton internal transfer request queue';
comment on column public.triton_transfer_requests.updated_at is
  'Set on insert by default; app sets it on admin updates (no trigger to keep parity with tester_feedback).';
comment on column public.triton_transfer_requests.wallet_transaction_id is
  'Reserved for a future phase that links a request to a ledger entry. Nullable and unenforced in phase 1.';

alter table public.triton_transfer_requests enable row level security;

-- Requires public.tc_is_admin() from withdrawal_requests.sql (or equivalent).
create policy "triton_transfer_requests_insert_own"
  on public.triton_transfer_requests
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "triton_transfer_requests_select_own"
  on public.triton_transfer_requests
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "triton_transfer_requests_select_admin"
  on public.triton_transfer_requests
  for select
  to authenticated
  using (public.tc_is_admin());

create policy "triton_transfer_requests_update_admin"
  on public.triton_transfer_requests
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

grant select, insert on public.triton_transfer_requests to authenticated;
grant update on public.triton_transfer_requests to authenticated;
