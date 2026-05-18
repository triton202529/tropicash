-- Tropicash Developer Platform — Phase 2D:
--   Execution Orchestration & Policy Evaluation Blueprint.
--
-- Defines the runtime orchestration architecture that future payment,
-- payout, wallet, and integration requests will pass through. Built on
-- top of Phase 2A (service registry), Phase 2B (governance), and Phase 2C
-- (capability registry). Does NOT replace any of them.
--
-- This migration is ORCHESTRATION ARCHITECTURE ONLY. It does NOT:
--   • create real execution engines or runtime evaluators
--   • create real public or internal money-moving APIs
--   • create API keys, service tokens, or secrets
--   • move money
--   • modify treasury, wallet, withdrawal, PayPal funding, or fraud logic
--
-- Admin gating uses public.tc_is_admin() (see withdrawal_requests.sql).
-- If that helper is ever removed, see the commented fallback policy block
-- at the bottom of this file.

-- ---------------------------------------------------------------------------
-- A. internal_execution_pipeline_stages
-- ---------------------------------------------------------------------------
create table if not exists public.internal_execution_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  stage_key text not null unique,
  stage_label text not null,
  execution_order integer not null,
  stage_type text not null,
  lifecycle_status text not null default 'planning',
  blocking_by_default boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  constraint internal_execution_pipeline_stages_type_ck check (
    lower(btrim(stage_type)) in (
      'identity',
      'environment',
      'capability',
      'dependency',
      'policy',
      'idempotency',
      'fraud',
      'audit',
      'execution',
      'post_execution'
    )
  ),
  constraint internal_execution_pipeline_stages_lifecycle_ck check (
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

create index if not exists internal_execution_pipeline_stages_order_idx
  on public.internal_execution_pipeline_stages (execution_order);

create index if not exists internal_execution_pipeline_stages_type_idx
  on public.internal_execution_pipeline_stages (stage_type);

comment on table public.internal_execution_pipeline_stages is
  'Phase 2D: ordered runtime pipeline stages that future requests will pass through. Definition-only — no executor exists yet.';
comment on column public.internal_execution_pipeline_stages.blocking_by_default is
  'If true, a failure at this stage halts the pipeline. Audit / post-execution / intake stages default to false.';

alter table public.internal_execution_pipeline_stages enable row level security;

-- ---------------------------------------------------------------------------
-- B. internal_policy_evaluation_rules
-- ---------------------------------------------------------------------------
create table if not exists public.internal_policy_evaluation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  rule_label text not null,
  evaluation_type text not null,
  severity text not null default 'medium',
  decision_if_failed text not null,
  lifecycle_status text not null default 'planning',
  description text,
  created_at timestamptz not null default now(),
  constraint internal_policy_evaluation_rules_eval_ck check (
    lower(btrim(evaluation_type)) in (
      'required',
      'optional',
      'blocking',
      'audit_only',
      'monitor_only'
    )
  ),
  constraint internal_policy_evaluation_rules_severity_ck check (
    lower(btrim(severity)) in ('low', 'medium', 'high', 'critical')
  ),
  constraint internal_policy_evaluation_rules_decision_ck check (
    lower(btrim(decision_if_failed)) in (
      'allow',
      'block',
      'review_required',
      'sandbox_only',
      'limit_exceeded',
      'dependency_missing',
      'policy_not_satisfied'
    )
  ),
  constraint internal_policy_evaluation_rules_lifecycle_ck check (
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

create index if not exists internal_policy_evaluation_rules_eval_idx
  on public.internal_policy_evaluation_rules (evaluation_type);

create index if not exists internal_policy_evaluation_rules_severity_idx
  on public.internal_policy_evaluation_rules (severity);

comment on table public.internal_policy_evaluation_rules is
  'Phase 2D: reusable rule definitions the future policy stage will evaluate. Definition-only — no evaluator exists yet.';

alter table public.internal_policy_evaluation_rules enable row level security;

-- ---------------------------------------------------------------------------
-- C. internal_runtime_decisions
-- ---------------------------------------------------------------------------
create table if not exists public.internal_runtime_decisions (
  id uuid primary key default gen_random_uuid(),
  decision_key text not null unique,
  decision_label text not null,
  decision_category text not null,
  is_terminal boolean not null default false,
  description text,
  created_at timestamptz not null default now(),
  constraint internal_runtime_decisions_category_ck check (
    lower(btrim(decision_category)) in (
      'success',
      'warning',
      'review',
      'blocked',
      'environment',
      'dependency',
      'policy'
    )
  )
);

create index if not exists internal_runtime_decisions_category_idx
  on public.internal_runtime_decisions (decision_category);

comment on table public.internal_runtime_decisions is
  'Phase 2D: the canonical set of decisions any future runtime evaluator may emit.';
comment on column public.internal_runtime_decisions.is_terminal is
  'If true, the decision ends the pipeline. Non-terminal decisions feed back into later evaluation stages.';

alter table public.internal_runtime_decisions enable row level security;

-- ---------------------------------------------------------------------------
-- D. internal_execution_trace_templates
-- ---------------------------------------------------------------------------
create table if not exists public.internal_execution_trace_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  template_label text not null,
  capability_key text not null,
  environment text not null default 'sandbox',
  trace_structure jsonb not null default '{}'::jsonb,
  lifecycle_status text not null default 'planning',
  description text,
  created_at timestamptz not null default now(),
  constraint internal_execution_trace_templates_env_ck check (
    lower(btrim(environment)) in ('sandbox', 'live')
  ),
  constraint internal_execution_trace_templates_lifecycle_ck check (
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

create index if not exists internal_execution_trace_templates_cap_env_idx
  on public.internal_execution_trace_templates (capability_key, environment);

comment on table public.internal_execution_trace_templates is
  'Phase 2D: per-capability trace template (pipeline + decision points + terminal states). trace_structure is JSONB; must never contain secrets or PII.';

alter table public.internal_execution_trace_templates enable row level security;

-- ---------------------------------------------------------------------------
-- Row-level security — admin-only on all four tables.
-- Requires public.tc_is_admin(); see fallback block at the bottom.
-- ---------------------------------------------------------------------------

-- internal_execution_pipeline_stages
drop policy if exists "internal_execution_pipeline_stages_select_admin" on public.internal_execution_pipeline_stages;
create policy "internal_execution_pipeline_stages_select_admin"
  on public.internal_execution_pipeline_stages
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_execution_pipeline_stages_insert_admin" on public.internal_execution_pipeline_stages;
create policy "internal_execution_pipeline_stages_insert_admin"
  on public.internal_execution_pipeline_stages
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_execution_pipeline_stages_update_admin" on public.internal_execution_pipeline_stages;
create policy "internal_execution_pipeline_stages_update_admin"
  on public.internal_execution_pipeline_stages
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_execution_pipeline_stages_delete_admin" on public.internal_execution_pipeline_stages;
create policy "internal_execution_pipeline_stages_delete_admin"
  on public.internal_execution_pipeline_stages
  for delete to authenticated using (public.tc_is_admin());

-- internal_policy_evaluation_rules
drop policy if exists "internal_policy_evaluation_rules_select_admin" on public.internal_policy_evaluation_rules;
create policy "internal_policy_evaluation_rules_select_admin"
  on public.internal_policy_evaluation_rules
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_policy_evaluation_rules_insert_admin" on public.internal_policy_evaluation_rules;
create policy "internal_policy_evaluation_rules_insert_admin"
  on public.internal_policy_evaluation_rules
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_policy_evaluation_rules_update_admin" on public.internal_policy_evaluation_rules;
create policy "internal_policy_evaluation_rules_update_admin"
  on public.internal_policy_evaluation_rules
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_policy_evaluation_rules_delete_admin" on public.internal_policy_evaluation_rules;
create policy "internal_policy_evaluation_rules_delete_admin"
  on public.internal_policy_evaluation_rules
  for delete to authenticated using (public.tc_is_admin());

-- internal_runtime_decisions
drop policy if exists "internal_runtime_decisions_select_admin" on public.internal_runtime_decisions;
create policy "internal_runtime_decisions_select_admin"
  on public.internal_runtime_decisions
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_runtime_decisions_insert_admin" on public.internal_runtime_decisions;
create policy "internal_runtime_decisions_insert_admin"
  on public.internal_runtime_decisions
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_runtime_decisions_update_admin" on public.internal_runtime_decisions;
create policy "internal_runtime_decisions_update_admin"
  on public.internal_runtime_decisions
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_runtime_decisions_delete_admin" on public.internal_runtime_decisions;
create policy "internal_runtime_decisions_delete_admin"
  on public.internal_runtime_decisions
  for delete to authenticated using (public.tc_is_admin());

-- internal_execution_trace_templates
drop policy if exists "internal_execution_trace_templates_select_admin" on public.internal_execution_trace_templates;
create policy "internal_execution_trace_templates_select_admin"
  on public.internal_execution_trace_templates
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_execution_trace_templates_insert_admin" on public.internal_execution_trace_templates;
create policy "internal_execution_trace_templates_insert_admin"
  on public.internal_execution_trace_templates
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_execution_trace_templates_update_admin" on public.internal_execution_trace_templates;
create policy "internal_execution_trace_templates_update_admin"
  on public.internal_execution_trace_templates
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_execution_trace_templates_delete_admin" on public.internal_execution_trace_templates;
create policy "internal_execution_trace_templates_delete_admin"
  on public.internal_execution_trace_templates
  for delete to authenticated using (public.tc_is_admin());

revoke all on public.internal_execution_pipeline_stages from anon, authenticated;
revoke all on public.internal_policy_evaluation_rules from anon, authenticated;
revoke all on public.internal_runtime_decisions from anon, authenticated;
revoke all on public.internal_execution_trace_templates from anon, authenticated;
grant select, insert, update, delete on public.internal_execution_pipeline_stages to authenticated;
grant select, insert, update, delete on public.internal_policy_evaluation_rules to authenticated;
grant select, insert, update, delete on public.internal_runtime_decisions to authenticated;
grant select, insert, update, delete on public.internal_execution_trace_templates to authenticated;

-- ---------------------------------------------------------------------------
-- Seed pipeline stages. execution_order is dense (1..13). All rows are
-- lifecycle_status='defined'. Intake / audit / post-execution stages are
-- non-blocking; validation / policy / fraud stages are blocking_by_default.
-- Re-runnable: ON CONFLICT (stage_key) DO NOTHING.
-- ---------------------------------------------------------------------------
insert into public.internal_execution_pipeline_stages
  (stage_key, stage_label, execution_order, stage_type, lifecycle_status, blocking_by_default, description)
values
  ('request_received',     'Request received',     1,  'audit',          'defined', false, 'Initial intake. The orchestrator records the raw request envelope before any validation runs.'),
  ('identity_verified',    'Identity verified',    2,  'identity',       'defined', true,  'Caller identity (service token, admin session, or developer key) is resolved and verified.'),
  ('environment_checked',  'Environment checked',  3,  'environment',    'defined', true,  'Request environment (sandbox vs live) is resolved and matched against the integration''s allowed environments.'),
  ('capability_resolved',  'Capability resolved',  4,  'capability',     'defined', true,  'Requested capability is resolved against the Phase 2C capability registry.'),
  ('dependency_checked',   'Dependency checked',   5,  'dependency',     'defined', true,  'Required and blocks_without dependencies declared in Phase 2C are validated.'),
  ('policy_evaluated',     'Policy evaluated',     6,  'policy',         'defined', true,  'Reusable policy rules (idempotency, fraud-review-required, env-match, etc.) are evaluated for this capability.'),
  ('constraint_evaluated', 'Constraint evaluated', 7,  'policy',         'defined', true,  'Per-capability, per-environment operational constraints from Phase 2C are evaluated (limits, sandbox_only, etc.).'),
  ('idempotency_checked',  'Idempotency checked',  8,  'idempotency',    'defined', true,  'Idempotency key is resolved against prior calls. Duplicates short-circuit to the prior result.'),
  ('fraud_reviewed',       'Fraud reviewed',       9,  'fraud',          'defined', true,  'Money-moving capabilities pass through the existing fraud-engine decision path.'),
  ('audit_logged',         'Audit logged',         10, 'audit',          'defined', false, 'Pre-execution audit record is written, including the resolved decision so far.'),
  ('execution_authorized', 'Execution authorized', 11, 'execution',      'defined', false, 'Terminal success path: every gate passed; the request may proceed to capability execution.'),
  ('execution_blocked',    'Execution blocked',    12, 'execution',      'defined', true,  'Terminal block path: a prior stage emitted a terminal block decision; execution does not happen.'),
  ('post_execution_logged','Post-execution logged',13, 'post_execution', 'defined', false, 'Post-execution audit record is written with the final outcome, timing, and any side-effects.')
on conflict (stage_key) do nothing;

-- ---------------------------------------------------------------------------
-- Seed policy evaluation rules. Re-runnable: ON CONFLICT (rule_key) DO NOTHING.
-- All rows are lifecycle_status='defined'.
-- ---------------------------------------------------------------------------
insert into public.internal_policy_evaluation_rules
  (rule_key, rule_label, evaluation_type, severity, decision_if_failed, lifecycle_status, description)
values
  ('requires_idempotency',           'Requires idempotency key',          'required', 'high',     'block',                'defined', 'Every money-moving call must carry an idempotency key. Duplicates must short-circuit to the prior recorded result.'),
  ('requires_fraud_review',          'Requires fraud review',             'blocking', 'critical', 'review_required',      'defined', 'Capabilities that touch wallet, payment, payout, or trading money flows must pass through the fraud engine decision path.'),
  ('sandbox_only',                   'Sandbox-only capability',           'blocking', 'medium',   'sandbox_only',         'defined', 'Capability is marked sandbox-only via its Phase 2C constraints. Live invocations must be terminated at environment_checked.'),
  ('max_transaction_amount',         'Max transaction amount',            'blocking', 'high',     'limit_exceeded',       'defined', 'Per-environment cap on a single transaction. Exceeding the cap emits a terminal limit_exceeded decision.'),
  ('requires_dependency_resolution', 'Requires dependency resolution',    'required', 'high',     'dependency_missing',   'defined', 'Every Phase 2C requires / blocks_without dependency must resolve. Missing dependencies emit dependency_missing.'),
  ('requires_environment_match',     'Requires environment match',        'blocking', 'medium',   'sandbox_only',         'defined', 'Integration must be permitted in the requested environment per Phase 2A registry and Phase 2B gates.'),
  ('requires_audit_record',          'Requires audit record',             'required', 'low',      'block',                'defined', 'Every authorized call must have a pre-execution and post-execution audit row. Missing audit aborts the pipeline.')
on conflict (rule_key) do nothing;

-- ---------------------------------------------------------------------------
-- Seed runtime decisions. Re-runnable: ON CONFLICT (decision_key) DO NOTHING.
-- is_terminal=true only for the three explicit terminal verdicts.
-- ---------------------------------------------------------------------------
insert into public.internal_runtime_decisions
  (decision_key, decision_label, decision_category, is_terminal, description)
values
  ('allowed',                'Allowed',                'success',     false, 'Intermediate pass. The current stage permitted continuation; later stages may still alter the outcome.'),
  ('warning',                'Warning',                'warning',     false, 'Advisory signal. Logged for observability; does not stop the pipeline.'),
  ('review_required',        'Review required',        'review',      false, 'Caller must wait for human or admin review (e.g. payout manual review). Pipeline pauses but is not terminal.'),
  ('blocked',                'Blocked',                'blocked',     true,  'Hard block emitted by a policy or constraint. No further evaluation runs.'),
  ('sandbox_only',           'Sandbox only',           'environment', false, 'Capability is restricted to sandbox; live invocations are rerouted to a terminal block, sandbox invocations proceed.'),
  ('limit_exceeded',         'Limit exceeded',         'policy',      false, 'A quantitative policy (amount, count, frequency) was exceeded.'),
  ('dependency_missing',     'Dependency missing',     'dependency',  false, 'A Phase 2C requires or blocks_without dependency could not be resolved.'),
  ('policy_not_satisfied',   'Policy not satisfied',   'policy',      false, 'A required policy rule did not pass (e.g. missing idempotency key).'),
  ('execution_authorized',   'Execution authorized',   'success',     true,  'Terminal success verdict. The request reached execution_authorized and may now invoke the capability.'),
  ('execution_blocked',      'Execution blocked',      'blocked',     true,  'Terminal block verdict. A prior stage emitted a terminal block and execution does not happen.')
on conflict (decision_key) do nothing;

-- ---------------------------------------------------------------------------
-- Seed execution trace templates for the high-risk capabilities defined in
-- Phase 2C. All templates are environment='sandbox' and
-- lifecycle_status='defined'. trace_structure is JSONB.
-- Re-runnable: ON CONFLICT (template_key) DO NOTHING.
-- ---------------------------------------------------------------------------
insert into public.internal_execution_trace_templates
  (template_key, template_label, capability_key, environment, trace_structure, lifecycle_status, description)
values
  (
    'payment_create_sandbox',
    'payment.create (sandbox)',
    'payment.create',
    'sandbox',
    '{
      "pipeline": [
        "request_received",
        "identity_verified",
        "environment_checked",
        "capability_resolved",
        "dependency_checked",
        "policy_evaluated",
        "constraint_evaluated",
        "idempotency_checked",
        "fraud_reviewed",
        "audit_logged",
        "execution_authorized"
      ],
      "decision_points": [
        "policy_evaluated",
        "constraint_evaluated",
        "fraud_reviewed"
      ],
      "terminal_states": [
        "execution_authorized",
        "execution_blocked"
      ],
      "notes": "Phase 2C requires wallet.read and fraud.review_required. Sandbox cap: max_transaction_amount=1000 USD."
    }'::jsonb,
    'defined',
    'Sandbox trace template for the payment.create capability. Composed of every Phase 2D pipeline stage; decision points where evaluators may emit a terminal block.'
  ),
  (
    'payout_release_sandbox',
    'payout.release (sandbox)',
    'payout.release',
    'sandbox',
    '{
      "pipeline": [
        "request_received",
        "identity_verified",
        "environment_checked",
        "capability_resolved",
        "dependency_checked",
        "policy_evaluated",
        "constraint_evaluated",
        "idempotency_checked",
        "fraud_reviewed",
        "audit_logged",
        "execution_authorized"
      ],
      "decision_points": [
        "dependency_checked",
        "policy_evaluated",
        "constraint_evaluated",
        "fraud_reviewed"
      ],
      "terminal_states": [
        "execution_authorized",
        "execution_blocked"
      ],
      "review_states": [
        "review_required"
      ],
      "notes": "Phase 2C requires payout.approve, fraud.review_required, and blocks_without treasury.reserve_funds. Sandbox constraints: requires_manual_review and requires_treasury_approval — expect a review_required pause before execution_authorized."
    }'::jsonb,
    'defined',
    'Sandbox trace template for payout.release. Has an extra dependency_checked decision point because blocks_without treasury.reserve_funds can short-circuit the pipeline.'
  ),
  (
    'trading_profit_withdraw_sandbox',
    'trading.profit_withdraw (sandbox)',
    'trading.profit_withdraw',
    'sandbox',
    '{
      "pipeline": [
        "request_received",
        "identity_verified",
        "environment_checked",
        "capability_resolved",
        "dependency_checked",
        "policy_evaluated",
        "constraint_evaluated",
        "idempotency_checked",
        "fraud_reviewed",
        "audit_logged",
        "execution_authorized"
      ],
      "decision_points": [
        "environment_checked",
        "policy_evaluated",
        "fraud_reviewed"
      ],
      "terminal_states": [
        "execution_authorized",
        "execution_blocked"
      ],
      "notes": "Phase 2C constraint sandbox_only blocks live invocations at environment_checked. Sandbox path passes wallet.read, fraud.review_required, and audit_requires ledger.export downstream."
    }'::jsonb,
    'defined',
    'Sandbox trace template for trading.profit_withdraw. environment_checked is a decision point because the sandbox_only constraint terminates live invocations there.'
  )
on conflict (template_key) do nothing;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- If the tc_is_admin() helper has not been created yet (see
-- supabase/sql/withdrawal_requests.sql), replace every admin policy above
-- with an explicit allow-list, e.g.:
--
-- create policy "internal_execution_pipeline_stages_select_admin_fallback"
--   on public.internal_execution_pipeline_stages
--   for select
--   to authenticated
--   using (
--     lower(coalesce((select email from auth.users where id = auth.uid()), ''))
--       in ('akimtropicashad@gmail.com')
--   );
--
-- Mirror the same predicate for insert/update/delete on all four tables.
-- Keep the admin email list in sync with lib/adminAccess.js ADMIN_EMAILS.
-- ---------------------------------------------------------------------------
