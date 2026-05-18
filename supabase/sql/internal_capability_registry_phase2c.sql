-- Tropicash Developer Platform — Phase 2C:
--   Capability & Operational Constraints Registry.
--
-- Defines the reusable capability model that future integrations, APIs,
-- runtime policies, and permissions will reference. Layered on top of
-- Phase 2A (internal service registry) and Phase 2B (governance) — does
-- NOT replace either.
--
-- This migration is REGISTRY + ARCHITECTURE ONLY. It does NOT:
--   • create live APIs, secrets, service tokens, or API keys
--   • create runtime enforcement code paths
--   • modify treasury, wallet, withdrawal, PayPal funding, or fraud logic
--   • move money
--
-- Admin gating uses public.tc_is_admin() (see withdrawal_requests.sql).
-- If that helper is ever removed, see the commented fallback policy block
-- at the bottom of this file.

-- ---------------------------------------------------------------------------
-- A. internal_capabilities
-- ---------------------------------------------------------------------------
create table if not exists public.internal_capabilities (
  id uuid primary key default gen_random_uuid(),
  capability_key text not null unique,
  capability_label text not null,
  category text not null,
  description text,
  risk_level text not null default 'low',
  lifecycle_status text not null default 'planning',
  supports_sandbox boolean not null default true,
  supports_live boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_capabilities_category_ck check (
    lower(btrim(category)) in (
      'wallet',
      'payments',
      'payouts',
      'treasury',
      'ledger',
      'reporting',
      'trading',
      'developer',
      'admin',
      'fraud',
      'notifications'
    )
  ),
  constraint internal_capabilities_risk_ck check (
    lower(btrim(risk_level)) in ('low', 'medium', 'high', 'critical')
  ),
  constraint internal_capabilities_lifecycle_ck check (
    lower(btrim(lifecycle_status)) in (
      'planning',
      'defined',
      'review',
      'sandbox_ready',
      'live_ready',
      'deprecated',
      'retired'
    )
  )
);

create index if not exists internal_capabilities_category_idx
  on public.internal_capabilities (category);

create index if not exists internal_capabilities_risk_idx
  on public.internal_capabilities (risk_level);

create index if not exists internal_capabilities_lifecycle_idx
  on public.internal_capabilities (lifecycle_status);

comment on table public.internal_capabilities is
  'Phase 2C: reusable capability definitions. Capabilities are referenced by integrations, runtime policies, and (future) APIs. Phase 2C is definition-only — no enforcement.';
comment on column public.internal_capabilities.supports_sandbox is
  'Design-time intent: can this capability ever run in sandbox? Phase 2C defaults to true for all seeded capabilities.';
comment on column public.internal_capabilities.supports_live is
  'Design-time intent: can this capability ever run in live? Phase 2C defaults to false — promotion requires explicit review (see Phase 2B governance).';

alter table public.internal_capabilities enable row level security;

-- ---------------------------------------------------------------------------
-- B. internal_capability_dependencies
-- ---------------------------------------------------------------------------
create table if not exists public.internal_capability_dependencies (
  id uuid primary key default gen_random_uuid(),
  capability_id uuid not null references public.internal_capabilities (id) on delete cascade,
  capability_key text not null,
  dependency_key text not null,
  dependency_type text not null default 'requires',
  description text,
  created_at timestamptz not null default now(),
  constraint internal_capability_dependencies_type_ck check (
    lower(btrim(dependency_type)) in ('requires', 'recommends', 'blocks_without', 'audit_requires')
  ),
  constraint internal_capability_dependencies_unique
    unique (capability_key, dependency_key, dependency_type)
);

create index if not exists internal_capability_dependencies_cap_key_idx
  on public.internal_capability_dependencies (capability_key);

create index if not exists internal_capability_dependencies_dep_key_idx
  on public.internal_capability_dependencies (dependency_key);

comment on table public.internal_capability_dependencies is
  'Phase 2C: directed relationships between capabilities. dependency_type ∈ {requires, recommends, blocks_without, audit_requires}.';
comment on column public.internal_capability_dependencies.dependency_type is
  'requires: hard prerequisite. recommends: soft suggestion. blocks_without: invocation blocked when dependency missing. audit_requires: dependency must be invoked for audit completeness.';

alter table public.internal_capability_dependencies enable row level security;

-- ---------------------------------------------------------------------------
-- C. internal_capability_constraints
-- ---------------------------------------------------------------------------
create table if not exists public.internal_capability_constraints (
  id uuid primary key default gen_random_uuid(),
  capability_id uuid not null references public.internal_capabilities (id) on delete cascade,
  capability_key text not null,
  constraint_key text not null,
  constraint_label text not null,
  constraint_value jsonb not null default '{}'::jsonb,
  environment text not null default 'sandbox',
  risk_level text not null default 'medium',
  enforcement_status text not null default 'planned',
  description text,
  created_at timestamptz not null default now(),
  constraint internal_capability_constraints_env_ck check (
    lower(btrim(environment)) in ('sandbox', 'live')
  ),
  constraint internal_capability_constraints_risk_ck check (
    lower(btrim(risk_level)) in ('low', 'medium', 'high', 'critical')
  ),
  constraint internal_capability_constraints_enforcement_ck check (
    lower(btrim(enforcement_status)) in ('planned', 'monitor_only', 'enforced', 'disabled')
  ),
  constraint internal_capability_constraints_unique
    unique (capability_key, environment, constraint_key)
);

create index if not exists internal_capability_constraints_cap_env_idx
  on public.internal_capability_constraints (capability_key, environment);

create index if not exists internal_capability_constraints_enforcement_idx
  on public.internal_capability_constraints (enforcement_status);

comment on table public.internal_capability_constraints is
  'Phase 2C: per-environment operational constraints for a capability (limits, required checks, sandbox isolation). Phase 2C seeds all rows as enforcement_status=planned.';
comment on column public.internal_capability_constraints.constraint_value is
  'JSONB constraint payload. Must never contain secrets, tokens, or unnecessary PII.';

alter table public.internal_capability_constraints enable row level security;

-- ---------------------------------------------------------------------------
-- Row-level security — admin-only on all three tables.
-- Requires public.tc_is_admin(); see fallback block at the bottom.
-- ---------------------------------------------------------------------------

-- internal_capabilities
drop policy if exists "internal_capabilities_select_admin" on public.internal_capabilities;
create policy "internal_capabilities_select_admin"
  on public.internal_capabilities
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_capabilities_insert_admin" on public.internal_capabilities;
create policy "internal_capabilities_insert_admin"
  on public.internal_capabilities
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_capabilities_update_admin" on public.internal_capabilities;
create policy "internal_capabilities_update_admin"
  on public.internal_capabilities
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_capabilities_delete_admin" on public.internal_capabilities;
create policy "internal_capabilities_delete_admin"
  on public.internal_capabilities
  for delete to authenticated using (public.tc_is_admin());

-- internal_capability_dependencies
drop policy if exists "internal_capability_dependencies_select_admin" on public.internal_capability_dependencies;
create policy "internal_capability_dependencies_select_admin"
  on public.internal_capability_dependencies
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_capability_dependencies_insert_admin" on public.internal_capability_dependencies;
create policy "internal_capability_dependencies_insert_admin"
  on public.internal_capability_dependencies
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_capability_dependencies_update_admin" on public.internal_capability_dependencies;
create policy "internal_capability_dependencies_update_admin"
  on public.internal_capability_dependencies
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_capability_dependencies_delete_admin" on public.internal_capability_dependencies;
create policy "internal_capability_dependencies_delete_admin"
  on public.internal_capability_dependencies
  for delete to authenticated using (public.tc_is_admin());

-- internal_capability_constraints
drop policy if exists "internal_capability_constraints_select_admin" on public.internal_capability_constraints;
create policy "internal_capability_constraints_select_admin"
  on public.internal_capability_constraints
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_capability_constraints_insert_admin" on public.internal_capability_constraints;
create policy "internal_capability_constraints_insert_admin"
  on public.internal_capability_constraints
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_capability_constraints_update_admin" on public.internal_capability_constraints;
create policy "internal_capability_constraints_update_admin"
  on public.internal_capability_constraints
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_capability_constraints_delete_admin" on public.internal_capability_constraints;
create policy "internal_capability_constraints_delete_admin"
  on public.internal_capability_constraints
  for delete to authenticated using (public.tc_is_admin());

revoke all on public.internal_capabilities from anon, authenticated;
revoke all on public.internal_capability_dependencies from anon, authenticated;
revoke all on public.internal_capability_constraints from anon, authenticated;
grant select, insert, update, delete on public.internal_capabilities to authenticated;
grant select, insert, update, delete on public.internal_capability_dependencies to authenticated;
grant select, insert, update, delete on public.internal_capability_constraints to authenticated;

-- ---------------------------------------------------------------------------
-- Seed capabilities. All rows: lifecycle_status='defined' (Phase 2C delivers
-- the *definition*; sandbox/live readiness happens in later phases).
-- supports_sandbox=true, supports_live=false (live readiness requires
-- explicit Phase 2B governance promotion).
-- Re-runnable: ON CONFLICT (capability_key) DO NOTHING.
-- ---------------------------------------------------------------------------
insert into public.internal_capabilities
  (capability_key, capability_label, category, description, risk_level, lifecycle_status, supports_sandbox, supports_live)
values
  -- Wallet
  ('wallet.read',           'Read wallet state',        'wallet',        'Read-only access to wallet balance and metadata.',                                                  'low',      'defined', true, false),
  ('wallet.reserve',        'Reserve wallet funds',     'wallet',        'Place a hold on a portion of available wallet balance.',                                            'high',     'defined', true, false),
  ('wallet.release',        'Release wallet reserve',   'wallet',        'Release a previously placed hold back to available balance.',                                       'medium',   'defined', true, false),
  ('wallet.balance_adjust', 'Adjust wallet balance',    'wallet',        'Direct ledger-level balance mutation. Highest-risk wallet capability.',                             'critical', 'defined', true, false),

  -- Payments
  ('payment.create',        'Create payment',           'payments',      'Initiate an inbound payment intent against a wallet.',                                              'medium',   'defined', true, false),
  ('payment.capture',       'Capture payment',          'payments',      'Settle an authorized payment intent.',                                                              'high',     'defined', true, false),
  ('payment.refund',        'Refund payment',           'payments',      'Reverse a captured payment, returning funds to the payer.',                                         'high',     'defined', true, false),

  -- Payouts
  ('payout.request',        'Request payout',           'payouts',       'Submit an outbound payout request for review.',                                                     'medium',   'defined', true, false),
  ('payout.approve',        'Approve payout',           'payouts',       'Approve a pending payout request.',                                                                 'high',     'defined', true, false),
  ('payout.release',        'Release payout',           'payouts',       'Disburse an approved payout to the destination. Highest-risk payouts capability.',                  'critical', 'defined', true, false),

  -- Treasury
  ('treasury.read_summary', 'Read treasury summary',    'treasury',      'Read-only aggregate treasury liquidity summary.',                                                   'medium',   'defined', true, false),
  ('treasury.reserve_funds','Reserve treasury funds',   'treasury',      'Reserve a tranche of treasury funds for a planned movement.',                                       'high',     'defined', true, false),

  -- Ledger
  ('ledger.export',         'Export ledger records',    'ledger',        'Bulk export of wallet ledger entries for accounting/reporting. Read-only; never modifies ledger.',  'medium',   'defined', true, false),
  ('ledger.statement_generate','Generate ledger statement','ledger',     'Produce a periodic statement for a wallet or treasury account.',                                    'low',      'defined', true, false),

  -- Trading
  ('trading.funding_reserve','Reserve trading funding', 'trading',       'Reserve a portion of wallet balance for trading capital.',                                          'high',     'defined', true, false),
  ('trading.profit_withdraw','Withdraw trading profit', 'trading',       'Move trading profits from a trading platform back into Tropicash wallets.',                         'critical', 'defined', true, false),

  -- Fraud
  ('fraud.review_required', 'Fraud review required',    'fraud',         'Capability dependency marker: caller must pass through the fraud engine decision path.',           'high',     'defined', true, false),

  -- Developer
  ('developer.webhook_manage','Manage developer webhooks','developer',   'Register and manage developer-configured webhook endpoints.',                                       'medium',   'defined', true, false),

  -- Notifications
  ('notification.send',     'Send notification',        'notifications', 'Send an in-app, email, or push notification.',                                                      'low',      'defined', true, false)
on conflict (capability_key) do nothing;

-- ---------------------------------------------------------------------------
-- Seed capability dependencies. dependency_key references another row's
-- capability_key (no FK — capabilities can be referenced by key only).
-- Re-runnable: ON CONFLICT (capability_key, dependency_key, dependency_type) DO NOTHING.
-- ---------------------------------------------------------------------------

-- payment.create
insert into public.internal_capability_dependencies
  (capability_id, capability_key, dependency_key, dependency_type, description)
select c.id, c.capability_key, d.dependency_key, d.dependency_type, d.description
from public.internal_capabilities c
cross join (values
  ('wallet.read',           'requires',       'Payment creation must read wallet state to validate the target.'),
  ('fraud.review_required', 'requires',       'Payment creation must pass through the fraud engine decision path.')
) as d(dependency_key, dependency_type, description)
where c.capability_key = 'payment.create'
on conflict (capability_key, dependency_key, dependency_type) do nothing;

-- payment.capture
insert into public.internal_capability_dependencies
  (capability_id, capability_key, dependency_key, dependency_type, description)
select c.id, c.capability_key, d.dependency_key, d.dependency_type, d.description
from public.internal_capabilities c
cross join (values
  ('payment.create',        'requires',       'A payment intent must exist before it can be captured.')
) as d(dependency_key, dependency_type, description)
where c.capability_key = 'payment.capture'
on conflict (capability_key, dependency_key, dependency_type) do nothing;

-- payment.refund
insert into public.internal_capability_dependencies
  (capability_id, capability_key, dependency_key, dependency_type, description)
select c.id, c.capability_key, d.dependency_key, d.dependency_type, d.description
from public.internal_capabilities c
cross join (values
  ('payment.capture',       'requires',       'A captured payment is required before issuing a refund.'),
  ('ledger.export',         'audit_requires', 'Refunds must be reconcilable via ledger export for audit completeness.')
) as d(dependency_key, dependency_type, description)
where c.capability_key = 'payment.refund'
on conflict (capability_key, dependency_key, dependency_type) do nothing;

-- payout.release
insert into public.internal_capability_dependencies
  (capability_id, capability_key, dependency_key, dependency_type, description)
select c.id, c.capability_key, d.dependency_key, d.dependency_type, d.description
from public.internal_capabilities c
cross join (values
  ('payout.approve',        'requires',       'A payout must be approved before it can be released.'),
  ('fraud.review_required', 'requires',       'Outbound payouts must pass through the fraud engine decision path.'),
  ('treasury.reserve_funds','blocks_without', 'Releasing a payout without a corresponding treasury reservation is blocked.')
) as d(dependency_key, dependency_type, description)
where c.capability_key = 'payout.release'
on conflict (capability_key, dependency_key, dependency_type) do nothing;

-- trading.profit_withdraw
insert into public.internal_capability_dependencies
  (capability_id, capability_key, dependency_key, dependency_type, description)
select c.id, c.capability_key, d.dependency_key, d.dependency_type, d.description
from public.internal_capabilities c
cross join (values
  ('wallet.read',           'requires',       'Profit withdrawal must read wallet state to validate the destination.'),
  ('fraud.review_required', 'requires',       'Trading profit withdrawal must pass through the fraud engine decision path.'),
  ('ledger.export',         'audit_requires', 'Trading profit movements must be reconcilable via ledger export.')
) as d(dependency_key, dependency_type, description)
where c.capability_key = 'trading.profit_withdraw'
on conflict (capability_key, dependency_key, dependency_type) do nothing;

-- ---------------------------------------------------------------------------
-- Seed capability constraints. All rows seeded as enforcement_status='planned'.
-- Constraints that apply identically in sandbox and live are stored as two
-- independent rows (one per environment) so promotions are explicit.
-- Re-runnable: ON CONFLICT (capability_key, environment, constraint_key) DO NOTHING.
-- ---------------------------------------------------------------------------

-- payment.create
insert into public.internal_capability_constraints
  (capability_id, capability_key, constraint_key, constraint_label, constraint_value, environment, risk_level, enforcement_status, description)
select c.id, c.capability_key, k.constraint_key, k.constraint_label, k.constraint_value::jsonb, k.environment, k.risk_level, k.enforcement_status, k.description
from public.internal_capabilities c
cross join (values
  ('max_transaction_amount', 'Max transaction amount', '{"amount": 1000, "currency": "USD"}',                                'sandbox', 'critical', 'planned', 'Hard cap on a single payment in sandbox.'),
  ('max_transaction_amount', 'Max transaction amount', '{"amount": 0, "currency": "USD", "note": "Not approved"}',           'live',    'critical', 'planned', 'Live cap is zero until limits are approved.'),
  ('requires_idempotency',   'Requires idempotency',   '{"required": true}',                                                 'sandbox', 'high',     'planned', 'Sandbox calls must carry an idempotency key.'),
  ('requires_idempotency',   'Requires idempotency',   '{"required": true}',                                                 'live',    'high',     'planned', 'Live calls must carry an idempotency key.')
) as k(constraint_key, constraint_label, constraint_value, environment, risk_level, enforcement_status, description)
where c.capability_key = 'payment.create'
on conflict (capability_key, environment, constraint_key) do nothing;

-- payout.release
insert into public.internal_capability_constraints
  (capability_id, capability_key, constraint_key, constraint_label, constraint_value, environment, risk_level, enforcement_status, description)
select c.id, c.capability_key, k.constraint_key, k.constraint_label, k.constraint_value::jsonb, k.environment, k.risk_level, k.enforcement_status, k.description
from public.internal_capabilities c
cross join (values
  ('requires_manual_review',     'Requires manual review',     '{"required": true}', 'sandbox', 'high',     'planned', 'Sandbox payouts must pass manual review (drill).'),
  ('requires_manual_review',     'Requires manual review',     '{"required": true}', 'live',    'high',     'planned', 'Live payouts must pass manual review before release.'),
  ('requires_treasury_approval', 'Requires treasury approval', '{"required": true}', 'sandbox', 'critical', 'planned', 'Sandbox payouts must obtain treasury approval (drill).'),
  ('requires_treasury_approval', 'Requires treasury approval', '{"required": true}', 'live',    'critical', 'planned', 'Live payouts must obtain treasury approval before release.')
) as k(constraint_key, constraint_label, constraint_value, environment, risk_level, enforcement_status, description)
where c.capability_key = 'payout.release'
on conflict (capability_key, environment, constraint_key) do nothing;

-- trading.profit_withdraw
insert into public.internal_capability_constraints
  (capability_id, capability_key, constraint_key, constraint_label, constraint_value, environment, risk_level, enforcement_status, description)
select c.id, c.capability_key, k.constraint_key, k.constraint_label, k.constraint_value::jsonb, k.environment, k.risk_level, k.enforcement_status, k.description
from public.internal_capabilities c
cross join (values
  ('sandbox_only', 'Sandbox only', '{"enabled": true}',                            'sandbox', 'critical', 'planned', 'Capability is permitted in sandbox.'),
  ('sandbox_only', 'Sandbox only', '{"enabled": true, "blocks_in_live": true}',   'live',    'critical', 'planned', 'Capability is restricted to sandbox; live invocations must be blocked.')
) as k(constraint_key, constraint_label, constraint_value, environment, risk_level, enforcement_status, description)
where c.capability_key = 'trading.profit_withdraw'
on conflict (capability_key, environment, constraint_key) do nothing;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- If the tc_is_admin() helper has not been created yet (see
-- supabase/sql/withdrawal_requests.sql), replace every admin policy above
-- with an explicit allow-list, e.g.:
--
-- create policy "internal_capabilities_select_admin_fallback"
--   on public.internal_capabilities
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
