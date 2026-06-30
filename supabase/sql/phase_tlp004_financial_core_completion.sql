-- TLP-004: Financial core completion — transfer/withdrawal idempotency tables,
-- re-assert service_role-only money RPC grants (migration drift protection).
-- Apply after phase_tlp002_foundation_hardening.sql.

-- ---------------------------------------------------------------------------
-- 1) Transfer idempotency keys (POST /api/transfers/send)
-- ---------------------------------------------------------------------------

create table if not exists public.transfer_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  idempotency_key text not null,
  recipient_id uuid null,
  amount numeric null,
  status text not null default 'processing'
    check (status = any (array['processing'::text, 'completed'::text, 'failed'::text])),
  transaction_id uuid null,
  response_payload jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transfer_idempotency_user_key_unique unique (user_id, idempotency_key)
);

create index if not exists transfer_idempotency_keys_user_id_idx
  on public.transfer_idempotency_keys (user_id);

create index if not exists transfer_idempotency_keys_status_idx
  on public.transfer_idempotency_keys (status);

comment on table public.transfer_idempotency_keys is
  'One row per client idempotency key; prevents duplicate P2P transfers under retry/concurrency.';

alter table public.transfer_idempotency_keys enable row level security;

-- ---------------------------------------------------------------------------
-- 2) Withdrawal idempotency keys (POST /api/withdrawals/create)
-- ---------------------------------------------------------------------------

create table if not exists public.withdrawal_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  idempotency_key text not null,
  amount numeric null,
  payout_email text null,
  status text not null default 'processing'
    check (status = any (array['processing'::text, 'completed'::text, 'failed'::text])),
  request_id uuid null,
  response_payload jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint withdrawal_idempotency_user_key_unique unique (user_id, idempotency_key)
);

create index if not exists withdrawal_idempotency_keys_user_id_idx
  on public.withdrawal_idempotency_keys (user_id);

create index if not exists withdrawal_idempotency_keys_status_idx
  on public.withdrawal_idempotency_keys (status);

comment on table public.withdrawal_idempotency_keys is
  'One row per client idempotency key; prevents duplicate withdrawal requests under retry/concurrency.';

alter table public.withdrawal_idempotency_keys enable row level security;

-- ---------------------------------------------------------------------------
-- 3) Re-assert service_role-only grants (idempotent drift guard)
-- ---------------------------------------------------------------------------

revoke all on function public.fund_wallet(uuid, numeric) from public;
revoke all on function public.fund_wallet(uuid, numeric) from authenticated;
grant execute on function public.fund_wallet(uuid, numeric) to service_role;

revoke all on function public.transfer_funds(uuid, uuid, numeric) from public;
revoke all on function public.transfer_funds(uuid, uuid, numeric) from authenticated;
grant execute on function public.transfer_funds(uuid, uuid, numeric) to service_role;

revoke all on function public.create_withdrawal_request(uuid, numeric, text) from public;
revoke all on function public.create_withdrawal_request(uuid, numeric, text) from authenticated;
grant execute on function public.create_withdrawal_request(uuid, numeric, text) to service_role;
