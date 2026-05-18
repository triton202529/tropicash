-- Tropicash Developer Platform — Phase 2E:
--   Observability & Runtime Telemetry Blueprint.
--
-- Defines how Tropicash will observe, trace, diagnose, replay, and monitor
-- future runtime activity across wallets, payments, payouts, and Blue
-- Atlantic integrations. Built on top of Phase 2A (registry), Phase 2B
-- (governance), Phase 2C (capabilities), and Phase 2D (orchestration).
--
-- This migration is OBSERVABILITY ARCHITECTURE ONLY. It does NOT:
--   • create real telemetry pipelines or runtime emitters
--   • create real public or internal money-moving APIs
--   • create monitoring daemons / log shippers
--   • create API keys, service tokens, or secrets
--   • move money
--   • modify treasury, wallet, withdrawal, PayPal funding, or fraud logic
--
-- Admin gating uses public.tc_is_admin() (see withdrawal_requests.sql).
-- If that helper is ever removed, see the commented fallback policy block
-- at the bottom of this file.

-- ---------------------------------------------------------------------------
-- A. internal_execution_sessions
-- ---------------------------------------------------------------------------
create table if not exists public.internal_execution_sessions (
  id uuid primary key default gen_random_uuid(),
  execution_session_id text not null unique,
  trace_id text not null,
  request_id text,
  service_key text not null,
  capability_key text not null,
  environment text not null default 'sandbox',
  execution_status text not null default 'planned',
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint internal_execution_sessions_env_ck check (
    lower(btrim(environment)) in ('sandbox', 'live')
  ),
  constraint internal_execution_sessions_status_ck check (
    lower(btrim(execution_status)) in (
      'planned',
      'started',
      'in_progress',
      'review_required',
      'completed',
      'failed',
      'blocked',
      'cancelled'
    )
  )
);

create index if not exists internal_execution_sessions_service_env_idx
  on public.internal_execution_sessions (service_key, environment);

create index if not exists internal_execution_sessions_status_idx
  on public.internal_execution_sessions (execution_status);

create index if not exists internal_execution_sessions_created_at_idx
  on public.internal_execution_sessions (created_at desc);

comment on table public.internal_execution_sessions is
  'Phase 2E: per-request execution session envelope. The future telemetry pipeline writes one row per orchestrated request. Phase 2E seeds three planned demo sessions only.';
comment on column public.internal_execution_sessions.metadata is
  'JSONB telemetry envelope. Must never contain secrets, tokens, customer PII, or wallet balances.';

alter table public.internal_execution_sessions enable row level security;

-- ---------------------------------------------------------------------------
-- B. internal_execution_metrics
-- ---------------------------------------------------------------------------
create table if not exists public.internal_execution_metrics (
  id uuid primary key default gen_random_uuid(),
  execution_session_id text not null,
  metric_key text not null,
  metric_label text not null,
  metric_value numeric not null default 0,
  metric_unit text not null,
  metric_category text not null,
  environment text not null default 'sandbox',
  created_at timestamptz not null default now(),
  constraint internal_execution_metrics_category_ck check (
    lower(btrim(metric_category)) in (
      'latency',
      'policy',
      'fraud',
      'dependency',
      'execution',
      'audit',
      'environment'
    )
  ),
  constraint internal_execution_metrics_env_ck check (
    lower(btrim(environment)) in ('sandbox', 'live')
  )
);

create index if not exists internal_execution_metrics_session_idx
  on public.internal_execution_metrics (execution_session_id);

create index if not exists internal_execution_metrics_category_idx
  on public.internal_execution_metrics (metric_category);

comment on table public.internal_execution_metrics is
  'Phase 2E: canonical metric definitions emitted per execution session. Phase 2E seeds them with metric_value=0 against the demo session as a metric catalog.';

alter table public.internal_execution_metrics enable row level security;

-- ---------------------------------------------------------------------------
-- C. internal_execution_failures
-- ---------------------------------------------------------------------------
create table if not exists public.internal_execution_failures (
  id uuid primary key default gen_random_uuid(),
  execution_session_id text not null,
  failure_key text not null,
  failure_category text not null,
  severity text not null default 'medium',
  stage_key text,
  policy_rule_key text,
  decision_key text,
  environment text not null default 'sandbox',
  is_terminal boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint internal_execution_failures_category_ck check (
    lower(btrim(failure_category)) in (
      'policy_failure',
      'dependency_failure',
      'environment_failure',
      'fraud_block',
      'idempotency_conflict',
      'constraint_violation',
      'runtime_exception',
      'audit_failure'
    )
  ),
  constraint internal_execution_failures_severity_ck check (
    lower(btrim(severity)) in ('low', 'medium', 'high', 'critical')
  ),
  constraint internal_execution_failures_env_ck check (
    lower(btrim(environment)) in ('sandbox', 'live')
  )
);

create index if not exists internal_execution_failures_session_idx
  on public.internal_execution_failures (execution_session_id);

create index if not exists internal_execution_failures_category_idx
  on public.internal_execution_failures (failure_category);

create index if not exists internal_execution_failures_severity_idx
  on public.internal_execution_failures (severity);

comment on table public.internal_execution_failures is
  'Phase 2E: canonical failure taxonomy. stage_key / policy_rule_key / decision_key reference Phase 2D rows by key (no FK enforced).';

alter table public.internal_execution_failures enable row level security;

-- ---------------------------------------------------------------------------
-- D. internal_execution_replay_templates
-- ---------------------------------------------------------------------------
create table if not exists public.internal_execution_replay_templates (
  id uuid primary key default gen_random_uuid(),
  replay_key text not null unique,
  replay_label text not null,
  capability_key text not null,
  replay_scope text not null,
  replay_structure jsonb not null default '{}'::jsonb,
  lifecycle_status text not null default 'planning',
  description text,
  created_at timestamptz not null default now(),
  constraint internal_execution_replay_templates_scope_ck check (
    lower(btrim(replay_scope)) in (
      'session',
      'trace',
      'pipeline',
      'audit',
      'full_execution'
    )
  ),
  constraint internal_execution_replay_templates_lifecycle_ck check (
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

create index if not exists internal_execution_replay_templates_capability_idx
  on public.internal_execution_replay_templates (capability_key);

comment on table public.internal_execution_replay_templates is
  'Phase 2E: per-capability replay blueprint. Defines which stages and events a future replay engine may reconstruct from session telemetry.';
comment on column public.internal_execution_replay_templates.replay_structure is
  'JSONB replay blueprint: replayable_stages, reconstructable_events, terminal_states. Must never contain secrets or PII.';

alter table public.internal_execution_replay_templates enable row level security;

-- ---------------------------------------------------------------------------
-- Row-level security — admin-only on all four tables.
-- Requires public.tc_is_admin(); see fallback block at the bottom.
-- ---------------------------------------------------------------------------

-- internal_execution_sessions
drop policy if exists "internal_execution_sessions_select_admin" on public.internal_execution_sessions;
create policy "internal_execution_sessions_select_admin"
  on public.internal_execution_sessions
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_execution_sessions_insert_admin" on public.internal_execution_sessions;
create policy "internal_execution_sessions_insert_admin"
  on public.internal_execution_sessions
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_execution_sessions_update_admin" on public.internal_execution_sessions;
create policy "internal_execution_sessions_update_admin"
  on public.internal_execution_sessions
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_execution_sessions_delete_admin" on public.internal_execution_sessions;
create policy "internal_execution_sessions_delete_admin"
  on public.internal_execution_sessions
  for delete to authenticated using (public.tc_is_admin());

-- internal_execution_metrics
drop policy if exists "internal_execution_metrics_select_admin" on public.internal_execution_metrics;
create policy "internal_execution_metrics_select_admin"
  on public.internal_execution_metrics
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_execution_metrics_insert_admin" on public.internal_execution_metrics;
create policy "internal_execution_metrics_insert_admin"
  on public.internal_execution_metrics
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_execution_metrics_update_admin" on public.internal_execution_metrics;
create policy "internal_execution_metrics_update_admin"
  on public.internal_execution_metrics
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_execution_metrics_delete_admin" on public.internal_execution_metrics;
create policy "internal_execution_metrics_delete_admin"
  on public.internal_execution_metrics
  for delete to authenticated using (public.tc_is_admin());

-- internal_execution_failures
drop policy if exists "internal_execution_failures_select_admin" on public.internal_execution_failures;
create policy "internal_execution_failures_select_admin"
  on public.internal_execution_failures
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_execution_failures_insert_admin" on public.internal_execution_failures;
create policy "internal_execution_failures_insert_admin"
  on public.internal_execution_failures
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_execution_failures_update_admin" on public.internal_execution_failures;
create policy "internal_execution_failures_update_admin"
  on public.internal_execution_failures
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_execution_failures_delete_admin" on public.internal_execution_failures;
create policy "internal_execution_failures_delete_admin"
  on public.internal_execution_failures
  for delete to authenticated using (public.tc_is_admin());

-- internal_execution_replay_templates
drop policy if exists "internal_execution_replay_templates_select_admin" on public.internal_execution_replay_templates;
create policy "internal_execution_replay_templates_select_admin"
  on public.internal_execution_replay_templates
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_execution_replay_templates_insert_admin" on public.internal_execution_replay_templates;
create policy "internal_execution_replay_templates_insert_admin"
  on public.internal_execution_replay_templates
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_execution_replay_templates_update_admin" on public.internal_execution_replay_templates;
create policy "internal_execution_replay_templates_update_admin"
  on public.internal_execution_replay_templates
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_execution_replay_templates_delete_admin" on public.internal_execution_replay_templates;
create policy "internal_execution_replay_templates_delete_admin"
  on public.internal_execution_replay_templates
  for delete to authenticated using (public.tc_is_admin());

revoke all on public.internal_execution_sessions from anon, authenticated;
revoke all on public.internal_execution_metrics from anon, authenticated;
revoke all on public.internal_execution_failures from anon, authenticated;
revoke all on public.internal_execution_replay_templates from anon, authenticated;
grant select, insert, update, delete on public.internal_execution_sessions to authenticated;
grant select, insert, update, delete on public.internal_execution_metrics to authenticated;
grant select, insert, update, delete on public.internal_execution_failures to authenticated;
grant select, insert, update, delete on public.internal_execution_replay_templates to authenticated;

-- ---------------------------------------------------------------------------
-- Seed example execution sessions. All `planned` in `sandbox`. service_key
-- references the Phase 2A registry rows; capability_key references the
-- Phase 2C capability registry. Re-runnable: ON CONFLICT (execution_session_id) DO NOTHING.
-- ---------------------------------------------------------------------------
insert into public.internal_execution_sessions
  (execution_session_id, trace_id, request_id, service_key, capability_key, environment, execution_status, metadata)
values
  (
    'sess_2e_payment_create_demo',
    'trace_2e_payment_create_demo',
    'req_2e_payment_create_demo',
    'elitehire_pro',
    'payment.create',
    'sandbox',
    'planned',
    '{"source": "phase_2e_seed", "purpose": "Demo session envelope for the payment.create trace template."}'::jsonb
  ),
  (
    'sess_2e_payout_release_demo',
    'trace_2e_payout_release_demo',
    'req_2e_payout_release_demo',
    'elitehire_pro',
    'payout.release',
    'sandbox',
    'planned',
    '{"source": "phase_2e_seed", "purpose": "Demo session envelope for the payout.release trace template."}'::jsonb
  ),
  (
    'sess_2e_trading_profit_withdraw_demo',
    'trace_2e_trading_profit_withdraw_demo',
    'req_2e_trading_profit_withdraw_demo',
    'triton',
    'trading.profit_withdraw',
    'sandbox',
    'planned',
    '{"source": "phase_2e_seed", "purpose": "Demo session envelope for the trading.profit_withdraw trace template."}'::jsonb
  )
on conflict (execution_session_id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed metric definitions. Phase 2E seeds them with metric_value=0 against
-- the payment.create demo session as a canonical metric catalog. The
-- payout.release / trading.profit_withdraw sessions get the same metric
-- shape via the future telemetry pipeline — Phase 2E does not duplicate
-- the catalog per session.
-- Note: there is no unique key on (execution_session_id, metric_key), so
-- ON CONFLICT cannot be used here. To keep this re-runnable we delete any
-- prior Phase 2E catalog rows first (scoped to the demo session) and then
-- re-insert. This is safe because the future telemetry pipeline never
-- writes against `sess_2e_payment_create_demo`.
-- ---------------------------------------------------------------------------
delete from public.internal_execution_metrics
where execution_session_id = 'sess_2e_payment_create_demo';

insert into public.internal_execution_metrics
  (execution_session_id, metric_key, metric_label, metric_value, metric_unit, metric_category, environment)
values
  ('sess_2e_payment_create_demo', 'latency_ms',                    'Total request latency',          0, 'ms',    'latency',     'sandbox'),
  ('sess_2e_payment_create_demo', 'policy_eval_time_ms',           'Policy evaluation time',         0, 'ms',    'policy',      'sandbox'),
  ('sess_2e_payment_create_demo', 'fraud_eval_time_ms',            'Fraud evaluation time',          0, 'ms',    'fraud',       'sandbox'),
  ('sess_2e_payment_create_demo', 'dependency_resolution_time_ms', 'Dependency resolution time',     0, 'ms',    'dependency',  'sandbox'),
  ('sess_2e_payment_create_demo', 'audit_logging_time_ms',         'Audit logging time',             0, 'ms',    'audit',       'sandbox'),
  ('sess_2e_payment_create_demo', 'execution_duration_ms',         'Execution duration',             0, 'ms',    'execution',   'sandbox'),
  ('sess_2e_payment_create_demo', 'environment_check_time_ms',     'Environment check time',         0, 'ms',    'environment', 'sandbox'),
  ('sess_2e_payment_create_demo', 'policy_rules_evaluated',        'Policy rules evaluated',         0, 'count', 'policy',      'sandbox'),
  ('sess_2e_payment_create_demo', 'fraud_flags_checked',           'Fraud flags checked',            0, 'count', 'fraud',       'sandbox'),
  ('sess_2e_payment_create_demo', 'dependencies_resolved',         'Dependencies resolved',          0, 'count', 'dependency',  'sandbox');

-- ---------------------------------------------------------------------------
-- Seed canonical failure taxonomy. Same re-runnability strategy as the
-- metric catalog — delete prior demo rows then re-insert. stage_key /
-- policy_rule_key / decision_key reference Phase 2D rows by key.
-- ---------------------------------------------------------------------------
delete from public.internal_execution_failures
where execution_session_id = 'sess_2e_payment_create_demo';

insert into public.internal_execution_failures
  (execution_session_id, failure_key, failure_category, severity, stage_key, policy_rule_key, decision_key, environment, is_terminal, metadata)
values
  (
    'sess_2e_payment_create_demo',
    'policy_not_satisfied',
    'policy_failure',
    'high',
    'policy_evaluated',
    'requires_idempotency',
    'policy_not_satisfied',
    'sandbox',
    true,
    '{"source": "phase_2e_seed", "purpose": "Required policy rule did not pass."}'::jsonb
  ),
  (
    'sess_2e_payment_create_demo',
    'dependency_missing',
    'dependency_failure',
    'high',
    'dependency_checked',
    'requires_dependency_resolution',
    'dependency_missing',
    'sandbox',
    true,
    '{"source": "phase_2e_seed", "purpose": "A Phase 2C requires/blocks_without dependency did not resolve."}'::jsonb
  ),
  (
    'sess_2e_payment_create_demo',
    'sandbox_only_block',
    'environment_failure',
    'medium',
    'environment_checked',
    'sandbox_only',
    'sandbox_only',
    'sandbox',
    true,
    '{"source": "phase_2e_seed", "purpose": "Live invocation of a sandbox-only capability terminates at environment_checked."}'::jsonb
  ),
  (
    'sess_2e_payment_create_demo',
    'fraud_review_required',
    'fraud_block',
    'critical',
    'fraud_reviewed',
    'requires_fraud_review',
    'review_required',
    'sandbox',
    false,
    '{"source": "phase_2e_seed", "purpose": "Fraud engine paused the pipeline pending human review."}'::jsonb
  ),
  (
    'sess_2e_payment_create_demo',
    'idempotency_key_conflict',
    'idempotency_conflict',
    'high',
    'idempotency_checked',
    'requires_idempotency',
    'blocked',
    'sandbox',
    true,
    '{"source": "phase_2e_seed", "purpose": "Duplicate idempotency key collided with a divergent payload; pipeline must terminate."}'::jsonb
  ),
  (
    'sess_2e_payment_create_demo',
    'constraint_limit_exceeded',
    'constraint_violation',
    'high',
    'constraint_evaluated',
    'max_transaction_amount',
    'limit_exceeded',
    'sandbox',
    true,
    '{"source": "phase_2e_seed", "purpose": "A Phase 2C operational constraint limit was exceeded."}'::jsonb
  ),
  (
    'sess_2e_payment_create_demo',
    'runtime_processing_exception',
    'runtime_exception',
    'critical',
    'execution_authorized',
    null,
    'execution_blocked',
    'sandbox',
    true,
    '{"source": "phase_2e_seed", "purpose": "Unhandled exception inside the future executor terminated the pipeline."}'::jsonb
  ),
  (
    'sess_2e_payment_create_demo',
    'audit_pipeline_failure',
    'audit_failure',
    'high',
    'audit_logged',
    'requires_audit_record',
    'blocked',
    'sandbox',
    true,
    '{"source": "phase_2e_seed", "purpose": "The pre-execution audit record could not be written; pipeline aborts."}'::jsonb
  );

-- ---------------------------------------------------------------------------
-- Seed replay templates (one per high-risk capability). All
-- lifecycle_status='defined', replay_scope='full_execution'.
-- Re-runnable: ON CONFLICT (replay_key) DO NOTHING.
-- ---------------------------------------------------------------------------
insert into public.internal_execution_replay_templates
  (replay_key, replay_label, capability_key, replay_scope, replay_structure, lifecycle_status, description)
values
  (
    'payment_create_replay',
    'payment.create replay',
    'payment.create',
    'full_execution',
    '{
      "replayable_stages": [
        "request_received",
        "identity_verified",
        "environment_checked",
        "capability_resolved",
        "dependency_checked",
        "policy_evaluated",
        "constraint_evaluated",
        "idempotency_checked",
        "fraud_reviewed",
        "audit_logged"
      ],
      "reconstructable_events": [
        "execution.started",
        "execution.policy_evaluated",
        "execution.constraint_evaluated",
        "execution.fraud_reviewed",
        "execution.audit_logged",
        "execution.completed"
      ],
      "terminal_states": [
        "execution_authorized",
        "execution_blocked"
      ],
      "redacted_fields": ["amount", "wallet_balance", "payer_pii"]
    }'::jsonb,
    'defined',
    'Replay blueprint for payment.create. The future replay engine may reconstruct every stage up to (but not including) execution_authorized; the actual executor side-effect is never replayed.'
  ),
  (
    'payout_release_replay',
    'payout.release replay',
    'payout.release',
    'full_execution',
    '{
      "replayable_stages": [
        "request_received",
        "identity_verified",
        "environment_checked",
        "capability_resolved",
        "dependency_checked",
        "policy_evaluated",
        "constraint_evaluated",
        "idempotency_checked",
        "fraud_reviewed",
        "audit_logged"
      ],
      "reconstructable_events": [
        "execution.started",
        "execution.dependency_checked",
        "execution.policy_evaluated",
        "execution.review_required",
        "execution.fraud_reviewed",
        "execution.audit_logged",
        "execution.completed"
      ],
      "terminal_states": [
        "execution_authorized",
        "execution_blocked"
      ],
      "review_states": ["review_required"],
      "redacted_fields": ["amount", "destination_account", "treasury_balance"]
    }'::jsonb,
    'defined',
    'Replay blueprint for payout.release. Includes a review_required pause because Phase 2C requires manual review and treasury approval.'
  ),
  (
    'trading_profit_withdraw_replay',
    'trading.profit_withdraw replay',
    'trading.profit_withdraw',
    'full_execution',
    '{
      "replayable_stages": [
        "request_received",
        "identity_verified",
        "environment_checked",
        "capability_resolved",
        "dependency_checked",
        "policy_evaluated",
        "constraint_evaluated",
        "idempotency_checked",
        "fraud_reviewed",
        "audit_logged"
      ],
      "reconstructable_events": [
        "execution.started",
        "execution.environment_checked",
        "execution.policy_evaluated",
        "execution.fraud_reviewed",
        "execution.audit_logged",
        "execution.completed"
      ],
      "terminal_states": [
        "execution_authorized",
        "execution_blocked"
      ],
      "redacted_fields": ["amount", "trading_account", "wallet_balance"]
    }'::jsonb,
    'defined',
    'Replay blueprint for trading.profit_withdraw. The Phase 2C sandbox_only constraint is replayable at environment_checked; live invocations are recorded as terminal blocks.'
  )
on conflict (replay_key) do nothing;

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- If the tc_is_admin() helper has not been created yet (see
-- supabase/sql/withdrawal_requests.sql), replace every admin policy above
-- with an explicit allow-list, e.g.:
--
-- create policy "internal_execution_sessions_select_admin_fallback"
--   on public.internal_execution_sessions
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
