-- Tropicash Developer Platform — Phase 2B:
--   Integration Lifecycle & Runtime Governance.
--
-- Governance schema layered on top of the Phase 2A Internal Service Registry
-- (supabase/sql/internal_service_registry_phase2a.sql). This migration is
-- GOVERNANCE-ONLY. It does NOT create live APIs, secrets, service tokens, or
-- money-movement paths. It does NOT modify treasury, wallet, withdrawal,
-- PayPal funding, or fraud-engine logic — those subsystems are owned by the
-- Treasury workstream and remain untouched.
--
-- Admin gating uses public.tc_is_admin() (defined in withdrawal_requests.sql,
-- kept in sync with lib/adminAccess.js ADMIN_EMAILS). If that helper is ever
-- removed, see the commented fallback policy block at the bottom of this file.

-- ---------------------------------------------------------------------------
-- 1. internal_service_lifecycle_reviews
-- ---------------------------------------------------------------------------
create table if not exists public.internal_service_lifecycle_reviews (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.internal_service_integrations (id) on delete cascade,
  service_key text not null,
  requested_environment text not null default 'sandbox',
  current_status text not null default 'planning',
  requested_status text not null,
  review_status text not null default 'pending',
  risk_level text not null default 'medium',
  requested_by uuid,
  reviewed_by uuid,
  request_reason text,
  review_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint internal_service_lifecycle_reviews_env_ck check (
    lower(btrim(requested_environment)) in ('sandbox', 'live')
  ),
  constraint internal_service_lifecycle_reviews_current_status_ck check (
    lower(btrim(current_status)) in ('planning', 'inactive', 'active', 'suspended', 'retired')
  ),
  constraint internal_service_lifecycle_reviews_requested_status_ck check (
    lower(btrim(requested_status)) in ('planning', 'inactive', 'active', 'suspended', 'retired')
  ),
  constraint internal_service_lifecycle_reviews_review_status_ck check (
    lower(btrim(review_status)) in ('pending', 'approved', 'rejected', 'cancelled')
  ),
  constraint internal_service_lifecycle_reviews_risk_ck check (
    lower(btrim(risk_level)) in ('low', 'medium', 'high', 'critical')
  )
);

create index if not exists internal_service_lifecycle_reviews_svc_created_idx
  on public.internal_service_lifecycle_reviews (service_key, created_at desc);

create index if not exists internal_service_lifecycle_reviews_status_created_idx
  on public.internal_service_lifecycle_reviews (review_status, created_at desc);

comment on table public.internal_service_lifecycle_reviews is
  'Phase 2B governance: approval records for integration lifecycle transitions. Planning-only — no auto-enforcement.';
comment on column public.internal_service_lifecycle_reviews.requested_status is
  'Target lifecycle status (planning|inactive|active|suspended|retired) requested by the submitter.';
comment on column public.internal_service_lifecycle_reviews.review_status is
  'pending|approved|rejected|cancelled. Approval here does NOT mutate the integration row; the registry remains the source of truth.';

alter table public.internal_service_lifecycle_reviews enable row level security;

-- ---------------------------------------------------------------------------
-- 2. internal_service_runtime_policies
-- ---------------------------------------------------------------------------
create table if not exists public.internal_service_runtime_policies (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.internal_service_integrations (id) on delete cascade,
  service_key text not null,
  environment text not null default 'sandbox',
  policy_key text not null,
  policy_label text not null,
  policy_value jsonb not null default '{}'::jsonb,
  risk_level text not null default 'medium',
  enforcement_status text not null default 'planned',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_service_runtime_policies_env_ck check (
    lower(btrim(environment)) in ('sandbox', 'live')
  ),
  constraint internal_service_runtime_policies_risk_ck check (
    lower(btrim(risk_level)) in ('low', 'medium', 'high', 'critical')
  ),
  constraint internal_service_runtime_policies_enforcement_ck check (
    lower(btrim(enforcement_status)) in ('planned', 'monitor_only', 'enforced', 'disabled')
  ),
  constraint internal_service_runtime_policies_unique_per_env unique (integration_id, environment, policy_key)
);

create index if not exists internal_service_runtime_policies_svc_env_idx
  on public.internal_service_runtime_policies (service_key, environment);

create index if not exists internal_service_runtime_policies_enforcement_idx
  on public.internal_service_runtime_policies (enforcement_status);

comment on table public.internal_service_runtime_policies is
  'Phase 2B governance: per-environment runtime policies (limits, required checks, sandbox gates). Phase 2B seeds all rows as enforcement_status=planned; no runtime enforcement yet.';
comment on column public.internal_service_runtime_policies.policy_value is
  'JSONB policy payload. Must never contain secrets, tokens, or unnecessary PII.';
comment on column public.internal_service_runtime_policies.enforcement_status is
  'planned|monitor_only|enforced|disabled. Promotion to enforced requires explicit approval and a working enforcement code path.';

alter table public.internal_service_runtime_policies enable row level security;

-- ---------------------------------------------------------------------------
-- 3. internal_service_environment_gates
-- ---------------------------------------------------------------------------
create table if not exists public.internal_service_environment_gates (
  id uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.internal_service_integrations (id) on delete cascade,
  service_key text not null,
  environment text not null default 'sandbox',
  gate_key text not null,
  gate_label text not null,
  gate_status text not null default 'blocked',
  required_for_live boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_service_environment_gates_env_ck check (
    lower(btrim(environment)) in ('sandbox', 'live')
  ),
  constraint internal_service_environment_gates_status_ck check (
    lower(btrim(gate_status)) in ('blocked', 'pending_review', 'passed', 'waived')
  ),
  constraint internal_service_environment_gates_unique_per_env unique (integration_id, environment, gate_key)
);

create index if not exists internal_service_environment_gates_svc_env_idx
  on public.internal_service_environment_gates (service_key, environment);

create index if not exists internal_service_environment_gates_status_idx
  on public.internal_service_environment_gates (gate_status);

comment on table public.internal_service_environment_gates is
  'Phase 2B governance: per-environment readiness gates (registry, permissions, audit, treasury/fraud/security/admin reviews).';
comment on column public.internal_service_environment_gates.required_for_live is
  'When true, this gate must be passed (or explicitly waived) before the integration can be promoted to live.';

alter table public.internal_service_environment_gates enable row level security;

-- ---------------------------------------------------------------------------
-- Row-level security — admin-only on all three tables.
-- Requires public.tc_is_admin(); fallback block at the bottom of this file.
-- ---------------------------------------------------------------------------

-- internal_service_lifecycle_reviews
drop policy if exists "internal_service_lifecycle_reviews_select_admin"
  on public.internal_service_lifecycle_reviews;
create policy "internal_service_lifecycle_reviews_select_admin"
  on public.internal_service_lifecycle_reviews
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "internal_service_lifecycle_reviews_insert_admin"
  on public.internal_service_lifecycle_reviews;
create policy "internal_service_lifecycle_reviews_insert_admin"
  on public.internal_service_lifecycle_reviews
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "internal_service_lifecycle_reviews_update_admin"
  on public.internal_service_lifecycle_reviews;
create policy "internal_service_lifecycle_reviews_update_admin"
  on public.internal_service_lifecycle_reviews
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "internal_service_lifecycle_reviews_delete_admin"
  on public.internal_service_lifecycle_reviews;
create policy "internal_service_lifecycle_reviews_delete_admin"
  on public.internal_service_lifecycle_reviews
  for delete
  to authenticated
  using (public.tc_is_admin());

-- internal_service_runtime_policies
drop policy if exists "internal_service_runtime_policies_select_admin"
  on public.internal_service_runtime_policies;
create policy "internal_service_runtime_policies_select_admin"
  on public.internal_service_runtime_policies
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "internal_service_runtime_policies_insert_admin"
  on public.internal_service_runtime_policies;
create policy "internal_service_runtime_policies_insert_admin"
  on public.internal_service_runtime_policies
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "internal_service_runtime_policies_update_admin"
  on public.internal_service_runtime_policies;
create policy "internal_service_runtime_policies_update_admin"
  on public.internal_service_runtime_policies
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "internal_service_runtime_policies_delete_admin"
  on public.internal_service_runtime_policies;
create policy "internal_service_runtime_policies_delete_admin"
  on public.internal_service_runtime_policies
  for delete
  to authenticated
  using (public.tc_is_admin());

-- internal_service_environment_gates
drop policy if exists "internal_service_environment_gates_select_admin"
  on public.internal_service_environment_gates;
create policy "internal_service_environment_gates_select_admin"
  on public.internal_service_environment_gates
  for select
  to authenticated
  using (public.tc_is_admin());

drop policy if exists "internal_service_environment_gates_insert_admin"
  on public.internal_service_environment_gates;
create policy "internal_service_environment_gates_insert_admin"
  on public.internal_service_environment_gates
  for insert
  to authenticated
  with check (public.tc_is_admin());

drop policy if exists "internal_service_environment_gates_update_admin"
  on public.internal_service_environment_gates;
create policy "internal_service_environment_gates_update_admin"
  on public.internal_service_environment_gates
  for update
  to authenticated
  using (public.tc_is_admin())
  with check (public.tc_is_admin());

drop policy if exists "internal_service_environment_gates_delete_admin"
  on public.internal_service_environment_gates;
create policy "internal_service_environment_gates_delete_admin"
  on public.internal_service_environment_gates
  for delete
  to authenticated
  using (public.tc_is_admin());

revoke all on public.internal_service_lifecycle_reviews from anon, authenticated;
revoke all on public.internal_service_runtime_policies from anon, authenticated;
revoke all on public.internal_service_environment_gates from anon, authenticated;
grant select, insert, update, delete on public.internal_service_lifecycle_reviews to authenticated;
grant select, insert, update, delete on public.internal_service_runtime_policies to authenticated;
grant select, insert, update, delete on public.internal_service_environment_gates to authenticated;

-- ---------------------------------------------------------------------------
-- Seed: runtime policies for Triton, Sentinel, EliteHire Pro (sandbox).
-- Re-runnable: ON CONFLICT (integration_id, environment, policy_key) DO NOTHING.
-- ---------------------------------------------------------------------------

-- Triton
insert into public.internal_service_runtime_policies
  (integration_id, service_key, environment, policy_key, policy_label, policy_value, risk_level, enforcement_status, description)
select
  i.id,
  i.service_key,
  'sandbox',
  p.policy_key,
  p.policy_label,
  p.policy_value::jsonb,
  p.risk_level,
  p.enforcement_status,
  p.description
from public.internal_service_integrations i
cross join (values
  (
    'max_daily_transfer_amount',
    'Max daily transfer amount',
    '{"amount": 0, "currency": "USD", "note": "Not active yet"}',
    'critical',
    'planned',
    'Cap on the total amount Triton may move on behalf of Tropicash wallets in a 24h window. Sandbox seed is 0 until live limits are approved.'
  ),
  (
    'requires_idempotency',
    'Requires idempotency key',
    '{"required": true}',
    'high',
    'planned',
    'Every money-moving Triton call must carry an idempotency key. Duplicates must return the original result.'
  ),
  (
    'fraud_checks_required',
    'Fraud checks required',
    '{"required": true}',
    'high',
    'planned',
    'Money-moving Triton calls must pass through the existing fraud engine decision path.'
  ),
  (
    'sandbox_only',
    'Sandbox only',
    '{"enabled": true}',
    'medium',
    'planned',
    'Integration is restricted to sandbox until all live gates are passed.'
  )
) as p(policy_key, policy_label, policy_value, risk_level, enforcement_status, description)
where i.service_key = 'triton'
on conflict (integration_id, environment, policy_key) do nothing;

-- Sentinel
insert into public.internal_service_runtime_policies
  (integration_id, service_key, environment, policy_key, policy_label, policy_value, risk_level, enforcement_status, description)
select
  i.id,
  i.service_key,
  'sandbox',
  p.policy_key,
  p.policy_label,
  p.policy_value::jsonb,
  p.risk_level,
  p.enforcement_status,
  p.description
from public.internal_service_integrations i
cross join (values
  (
    'export_requires_audit',
    'Exports require audit',
    '{"required": true}',
    'medium',
    'planned',
    'Bulk ledger exports must emit an audit log row with the requester identity and export scope.'
  ),
  (
    'no_money_movement',
    'No money movement',
    '{"required": true}',
    'high',
    'planned',
    'Sentinel is read-only against the Tropicash ledger. Any write attempt must be rejected.'
  ),
  (
    'sandbox_only',
    'Sandbox only',
    '{"enabled": true}',
    'medium',
    'planned',
    'Sentinel integration is restricted to sandbox until all live gates are passed.'
  )
) as p(policy_key, policy_label, policy_value, risk_level, enforcement_status, description)
where i.service_key = 'sentinel'
on conflict (integration_id, environment, policy_key) do nothing;

-- EliteHire Pro
insert into public.internal_service_runtime_policies
  (integration_id, service_key, environment, policy_key, policy_label, policy_value, risk_level, enforcement_status, description)
select
  i.id,
  i.service_key,
  'sandbox',
  p.policy_key,
  p.policy_label,
  p.policy_value::jsonb,
  p.risk_level,
  p.enforcement_status,
  p.description
from public.internal_service_integrations i
cross join (values
  (
    'payment_requires_idempotency',
    'Payments require idempotency',
    '{"required": true}',
    'high',
    'planned',
    'EliteHire Pro payment creation must carry an idempotency key per request.'
  ),
  (
    'payout_requires_review',
    'Payouts require review',
    '{"required": true}',
    'high',
    'planned',
    'Outbound contractor payouts must pass admin/platform review before execution.'
  ),
  (
    'escrow_not_active',
    'Escrow not active',
    '{"enabled": true}',
    'medium',
    'planned',
    'Escrow flows are planned but not active. Any escrow call must be rejected until escrow ships.'
  ),
  (
    'sandbox_only',
    'Sandbox only',
    '{"enabled": true}',
    'medium',
    'planned',
    'EliteHire Pro integration is restricted to sandbox until all live gates are passed.'
  )
) as p(policy_key, policy_label, policy_value, risk_level, enforcement_status, description)
where i.service_key = 'elitehire_pro'
on conflict (integration_id, environment, policy_key) do nothing;

-- ---------------------------------------------------------------------------
-- Seed: environment gates for every service. Sandbox gates start as passed
-- (because Phase 2A delivered registry + permissions + audit model). Live
-- gates start as blocked and are marked required_for_live = true.
-- Re-runnable: ON CONFLICT (integration_id, environment, gate_key) DO NOTHING.
-- ---------------------------------------------------------------------------

-- Sandbox gates (all three services)
insert into public.internal_service_environment_gates
  (integration_id, service_key, environment, gate_key, gate_label, gate_status, required_for_live, description)
select
  i.id,
  i.service_key,
  'sandbox',
  g.gate_key,
  g.gate_label,
  g.gate_status,
  g.required_for_live,
  g.description
from public.internal_service_integrations i
cross join (values
  ('registry_created',     'Registry created',     'passed', false, 'Integration row exists in internal_service_integrations (Phase 2A).'),
  ('permissions_defined',  'Permissions defined',  'passed', false, 'Planned permissions are recorded in internal_service_permissions (Phase 2A).'),
  ('audit_model_defined',  'Audit model defined',  'passed', false, 'Audit log shape exists in internal_service_audit_logs (Phase 2A).')
) as g(gate_key, gate_label, gate_status, required_for_live, description)
where i.service_key in ('triton', 'sentinel', 'elitehire_pro')
on conflict (integration_id, environment, gate_key) do nothing;

-- Live gates (all three services). All blocked until reviewed.
insert into public.internal_service_environment_gates
  (integration_id, service_key, environment, gate_key, gate_label, gate_status, required_for_live, description)
select
  i.id,
  i.service_key,
  'live',
  g.gate_key,
  g.gate_label,
  g.gate_status,
  g.required_for_live,
  g.description
from public.internal_service_integrations i
cross join (values
  ('treasury_review',  'Treasury review',  'blocked', true, 'Treasury workstream must sign off on live readiness.'),
  ('fraud_review',     'Fraud review',     'blocked', true, 'Fraud engine team must confirm live decision-path coverage.'),
  ('security_review',  'Security review',  'blocked', true, 'Security review must approve auth model, key handling, and audit coverage.'),
  ('admin_approval',   'Admin approval',   'blocked', true, 'Final admin approval recorded in internal_service_lifecycle_reviews.')
) as g(gate_key, gate_label, gate_status, required_for_live, description)
where i.service_key in ('triton', 'sentinel', 'elitehire_pro')
on conflict (integration_id, environment, gate_key) do nothing;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- If the tc_is_admin() helper has not been created yet (see
-- supabase/sql/withdrawal_requests.sql), replace every admin policy above
-- with an explicit allow-list, e.g.:
--
-- create policy "internal_service_runtime_policies_select_admin_fallback"
--   on public.internal_service_runtime_policies
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
