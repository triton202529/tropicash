-- Tropicash Developer Platform — Phase 2A: Internal Service Registry.
--
-- Governance + registry tables for planned internal Blue Atlantic platform
-- integrations (Triton, Sentinel, EliteHire Pro). This migration is
-- REGISTRY-ONLY. It does NOT create live APIs, secrets, service tokens, or
-- money-movement paths. It does NOT modify treasury, wallet, withdrawal,
-- PayPal funding, or fraud-engine logic — those subsystems are owned by the
-- Treasury workstream and remain untouched.
--
-- Admin gating uses public.tc_is_admin() (defined in withdrawal_requests.sql,
-- kept in sync with lib/adminAccess.js ADMIN_EMAILS). If that helper is ever
-- removed, see the commented fallback policy block at the bottom of this file.

-- ---------------------------------------------------------------------------
-- 1. internal_service_integrations
-- ---------------------------------------------------------------------------
create table if not exists public.internal_service_integrations (
  id uuid primary key default gen_random_uuid(),
  service_key text not null unique,
  service_name text not null,
  platform text not null,
  environment text not null default 'sandbox',
  status text not null default 'planning',
  description text,
  owner_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_service_integrations_environment_ck check (
    lower(btrim(environment)) in ('sandbox', 'live')
  ),
  constraint internal_service_integrations_status_ck check (
    lower(btrim(status)) in ('planning', 'inactive', 'active', 'suspended', 'retired')
  )
);

create index if not exists internal_service_integrations_service_key_idx
  on public.internal_service_integrations (service_key);

create index if not exists internal_service_integrations_env_status_idx
  on public.internal_service_integrations (environment, status);

comment on table public.internal_service_integrations is
  'Phase 2A registry of planned internal Blue Atlantic service integrations (Triton, Sentinel, EliteHire Pro). Planning-only; no execution.';
comment on column public.internal_service_integrations.environment is
  'sandbox | live. Sandbox and live are strictly isolated.';
comment on column public.internal_service_integrations.status is
  'planning | inactive | active | suspended | retired. Phase 2A seeds everything as planning.';

alter table public.internal_service_integrations enable row level security;

-- ---------------------------------------------------------------------------
-- 2. internal_service_permissions
-- ---------------------------------------------------------------------------
create table if not exists public.internal_service_permissions (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.internal_service_integrations (id) on delete cascade,
  permission_key text not null,
  permission_label text not null,
  description text,
  risk_level text not null default 'low',
  created_at timestamptz not null default now(),
  constraint internal_service_permissions_risk_ck check (
    lower(btrim(risk_level)) in ('low', 'medium', 'high', 'critical')
  ),
  constraint internal_service_permissions_unique_per_integration unique (integration_id, permission_key)
);

create index if not exists internal_service_permissions_integration_id_idx
  on public.internal_service_permissions (integration_id);

comment on table public.internal_service_permissions is
  'Planned per-integration permissions with risk classification. Phase 2A: registry-only, no enforcement.';
comment on column public.internal_service_permissions.risk_level is
  'low | medium | high | critical. high/critical require explicit approval before activation.';

alter table public.internal_service_permissions enable row level security;

-- ---------------------------------------------------------------------------
-- 3. internal_service_audit_logs
-- ---------------------------------------------------------------------------
create table if not exists public.internal_service_audit_logs (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid references public.internal_service_integrations (id) on delete set null,
  service_key text,
  environment text not null default 'sandbox',
  event_type text not null,
  request_id text,
  idempotency_key text,
  status text not null default 'recorded',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint internal_service_audit_logs_environment_ck check (
    lower(btrim(environment)) in ('sandbox', 'live')
  ),
  constraint internal_service_audit_logs_status_ck check (
    lower(btrim(status)) in ('recorded', 'allowed', 'blocked', 'failed')
  )
);

create index if not exists internal_service_audit_logs_svc_created_idx
  on public.internal_service_audit_logs (service_key, created_at desc);

create index if not exists internal_service_audit_logs_event_created_idx
  on public.internal_service_audit_logs (event_type, created_at desc);

create index if not exists internal_service_audit_logs_request_id_idx
  on public.internal_service_audit_logs (request_id);

comment on table public.internal_service_audit_logs is
  'Audit log shape for future internal service calls. Phase 2A: schema-only, not yet written to.';
comment on column public.internal_service_audit_logs.metadata is
  'Free-form audit metadata. Must never contain secrets, raw PII beyond necessity, or auth tokens.';

alter table public.internal_service_audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Row-level security — admin-only for all three tables.
-- Requires public.tc_is_admin() (see withdrawal_requests.sql). See fallback
-- block at the bottom of this file if that helper is unavailable.
-- ---------------------------------------------------------------------------

-- internal_service_integrations
drop policy if exists "internal_service_integrations_select_admin"
  on public.internal_service_integrations;
create policy "internal_service_integrations_select_admin"
  on public.internal_service_integrations
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "internal_service_integrations_insert_admin"
  on public.internal_service_integrations;
create policy "internal_service_integrations_insert_admin"
  on public.internal_service_integrations
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "internal_service_integrations_update_admin"
  on public.internal_service_integrations;
create policy "internal_service_integrations_update_admin"
  on public.internal_service_integrations
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "internal_service_integrations_delete_admin"
  on public.internal_service_integrations;
create policy "internal_service_integrations_delete_admin"
  on public.internal_service_integrations
  for delete
  to authenticated
  using (public.tc_is_admin());

-- internal_service_permissions
drop policy if exists "internal_service_permissions_select_admin"
  on public.internal_service_permissions;
create policy "internal_service_permissions_select_admin"
  on public.internal_service_permissions
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "internal_service_permissions_insert_admin"
  on public.internal_service_permissions;
create policy "internal_service_permissions_insert_admin"
  on public.internal_service_permissions
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "internal_service_permissions_update_admin"
  on public.internal_service_permissions;
create policy "internal_service_permissions_update_admin"
  on public.internal_service_permissions
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "internal_service_permissions_delete_admin"
  on public.internal_service_permissions;
create policy "internal_service_permissions_delete_admin"
  on public.internal_service_permissions
  for delete
  to authenticated
  using (public.tc_is_admin());

-- internal_service_audit_logs
drop policy if exists "internal_service_audit_logs_select_admin"
  on public.internal_service_audit_logs;
create policy "internal_service_audit_logs_select_admin"
  on public.internal_service_audit_logs
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "internal_service_audit_logs_insert_admin"
  on public.internal_service_audit_logs;
create policy "internal_service_audit_logs_insert_admin"
  on public.internal_service_audit_logs
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "internal_service_audit_logs_update_admin"
  on public.internal_service_audit_logs;
create policy "internal_service_audit_logs_update_admin"
  on public.internal_service_audit_logs
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "internal_service_audit_logs_delete_admin"
  on public.internal_service_audit_logs;
create policy "internal_service_audit_logs_delete_admin"
  on public.internal_service_audit_logs
  for delete
  to authenticated
  using (public.tc_is_admin());

revoke all on public.internal_service_integrations from anon, authenticated;
revoke all on public.internal_service_permissions from anon, authenticated;
revoke all on public.internal_service_audit_logs from anon, authenticated;
grant select, insert, update, delete on public.internal_service_integrations to authenticated;
grant select, insert, update, delete on public.internal_service_permissions to authenticated;
grant select, insert, update, delete on public.internal_service_audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: planning rows for Triton, Sentinel, EliteHire Pro (sandbox / planning).
-- Re-runnable: ON CONFLICT DO NOTHING.
-- ---------------------------------------------------------------------------
insert into public.internal_service_integrations
  (service_key, service_name, platform, environment, status, description, owner_label)
values
  (
    'triton',
    'Triton funding & withdrawal bridge',
    'Triton',
    'sandbox',
    'planning',
    'Internal connector to Triton for funding trading accounts, withdrawing profits, reserving trading capital, and syncing trade funding records back to Tropicash wallets.',
    'Blue Atlantic · Triton workstream'
  ),
  (
    'sentinel',
    'Sentinel reporting',
    'Sentinel',
    'sandbox',
    'planning',
    'One-way reporting feed into Sentinel: transaction events, ledger exports, treasury reporting, statements, and reconciliation feeds. Sentinel never writes back to Tropicash wallets.',
    'Blue Atlantic · Sentinel workstream'
  ),
  (
    'elitehire_pro',
    'EliteHire Pro payments connector',
    'EliteHire Pro',
    'sandbox',
    'planning',
    'Internal connector for EliteHire Pro employer payments, job posting payments, contractor payouts, future escrow flows, and subscriptions.',
    'Blue Atlantic · EliteHire Pro workstream'
  )
on conflict (service_key) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: per-service planned permissions with risk levels.
-- Re-runnable: ON CONFLICT (integration_id, permission_key) DO NOTHING.
-- ---------------------------------------------------------------------------

-- Triton
insert into public.internal_service_permissions
  (integration_id, permission_key, permission_label, description, risk_level)
select i.id, p.permission_key, p.permission_label, p.description, p.risk_level
from public.internal_service_integrations i
cross join (values
  ('wallet.read', 'Read wallet state', 'Read-only access to wallet balance and metadata required for Triton funding decisions.', 'low'),
  ('trading_funding.reserve', 'Reserve trading capital', 'Reserve a portion of a wallet balance for Triton trading capital. Must respect wallet ledger as source of truth.', 'high'),
  ('trading_funding.release', 'Release trading capital', 'Release previously reserved trading capital back to wallet available balance.', 'medium'),
  ('trading_profit.withdraw', 'Withdraw trading profits', 'Move trading profits from Triton back into Tropicash wallets. Money-moving; requires idempotency, audit, and fraud review.', 'critical'),
  ('treasury.read_summary', 'Read treasury summary', 'Read-only access to aggregated treasury liquidity summary required for funding decisions.', 'medium')
) as p(permission_key, permission_label, description, risk_level)
where i.service_key = 'triton'
on conflict (integration_id, permission_key) do nothing;

-- Sentinel
insert into public.internal_service_permissions
  (integration_id, permission_key, permission_label, description, risk_level)
select i.id, p.permission_key, p.permission_label, p.description, p.risk_level
from public.internal_service_integrations i
cross join (values
  ('ledger.export', 'Export ledger records', 'Bulk export of wallet ledger entries for accounting/reporting. Read-only; never modifies ledger.', 'medium'),
  ('transaction.read', 'Read transaction records', 'Read-only access to transaction records for reporting.', 'low'),
  ('treasury.read_summary', 'Read treasury summary', 'Read-only access to aggregated treasury summary for reconciliation reporting.', 'medium'),
  ('statement.generate', 'Generate statements', 'Generate periodic statements for accounting/audit consumption.', 'low'),
  ('reconciliation.read', 'Read reconciliation feeds', 'Consume Tropicash reconciliation feeds for accounting.', 'low')
) as p(permission_key, permission_label, description, risk_level)
where i.service_key = 'sentinel'
on conflict (integration_id, permission_key) do nothing;

-- EliteHire Pro
insert into public.internal_service_permissions
  (integration_id, permission_key, permission_label, description, risk_level)
select i.id, p.permission_key, p.permission_label, p.description, p.risk_level
from public.internal_service_integrations i
cross join (values
  ('payment.create', 'Create payment', 'Initiate inbound payment intents that settle into Tropicash wallets. Money-moving; requires idempotency and fraud review.', 'medium'),
  ('payment.read', 'Read payment records', 'Read-only access to payment records for EliteHire Pro reconciliation.', 'low'),
  ('payout.create', 'Create payout', 'Initiate contractor payouts from EliteHire Pro flows. Money-moving; requires idempotency, audit, and fraud review.', 'high'),
  ('subscription.create', 'Create subscription', 'Initiate subscription billing intents (recurring). Money-moving; requires idempotency.', 'medium'),
  ('escrow.plan', 'Plan escrow', 'Plan future escrow arrangements (no execution yet). Reserved for future Phase.', 'medium')
) as p(permission_key, permission_label, description, risk_level)
where i.service_key = 'elitehire_pro'
on conflict (integration_id, permission_key) do nothing;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- If the tc_is_admin() helper has not been created yet (see
-- supabase/sql/withdrawal_requests.sql), replace every admin policy above
-- with an explicit allow-list, e.g.:
--
-- create policy "internal_service_integrations_select_admin_fallback"
--   on public.internal_service_integrations
--   for select
--   to authenticated
--   using (
--     lower(coalesce((select email from auth.users where id = auth.uid()), ''))
--       in ('akimtropicashad@gmail.com')
--   );
--
-- Mirror the same predicate for insert/update/delete on all three tables.
-- Keep the admin email list in sync with lib/adminAccess.js ADMIN_EMAILS.
-- ---------------------------------------------------------------------------
