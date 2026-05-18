-- Tropicash Developer Platform — Phase 2F:
--   Runtime State & Event Store Blueprint.
--
-- Defines how future Tropicash executions will persist immutable events,
-- mutable state snapshots, event-stream checkpoints, and cross-service
-- correlation. Built on top of Phase 2A (registry), Phase 2B (governance),
-- Phase 2C (capabilities), Phase 2D (orchestration), and Phase 2E
-- (observability).
--
-- This migration is RUNTIME STATE ARCHITECTURE ONLY. It does NOT:
--   • create real event emitters or runtime executors
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
-- A. internal_event_store
-- ---------------------------------------------------------------------------
create table if not exists public.internal_event_store (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  event_type text not null,
  execution_session_id text,
  trace_id text,
  request_id text,
  service_key text not null,
  capability_key text,
  environment text not null default 'sandbox',
  sequence_number bigint not null default 1,
  parent_event_id text,
  causation_id text,
  correlation_id text,
  actor_type text,
  actor_id text,
  subject_type text,
  subject_id text,
  event_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint internal_event_store_env_ck check (
    lower(btrim(environment)) in ('sandbox', 'live')
  ),
  constraint internal_event_store_actor_type_ck check (
    actor_type is null
    or lower(btrim(actor_type)) in ('user', 'admin', 'system', 'service')
  ),
  constraint internal_event_store_trace_seq_uq unique (trace_id, sequence_number)
);

create index if not exists internal_event_store_event_type_idx
  on public.internal_event_store (event_type);

create index if not exists internal_event_store_service_env_idx
  on public.internal_event_store (service_key, environment);

create index if not exists internal_event_store_trace_seq_idx
  on public.internal_event_store (trace_id, sequence_number);

create index if not exists internal_event_store_correlation_idx
  on public.internal_event_store (correlation_id);

create index if not exists internal_event_store_occurred_at_idx
  on public.internal_event_store (occurred_at desc);

comment on table public.internal_event_store is
  'Phase 2F: append-only immutable event log. The future executor writes one row per state-changing event. (trace_id, sequence_number) is unique to enforce per-trace ordering.';
comment on column public.internal_event_store.event_payload is
  'JSONB event body. Must never contain secrets, tokens, customer PII, or wallet balances.';
comment on column public.internal_event_store.metadata is
  'JSONB envelope (source, replay markers, idempotency keys). Same redaction rules as event_payload.';

alter table public.internal_event_store enable row level security;

-- ---------------------------------------------------------------------------
-- B. internal_runtime_state_snapshots
-- ---------------------------------------------------------------------------
create table if not exists public.internal_runtime_state_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_id text not null unique,
  execution_session_id text not null,
  trace_id text not null,
  service_key text not null,
  capability_key text not null,
  environment text not null default 'sandbox',
  current_execution_state text not null default 'planned',
  current_review_state text,
  current_policy_state text,
  last_decision_key text,
  last_stage_key text,
  last_event_id text,
  state_payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_runtime_state_snapshots_env_ck check (
    lower(btrim(environment)) in ('sandbox', 'live')
  ),
  constraint internal_runtime_state_snapshots_state_ck check (
    lower(btrim(current_execution_state)) in (
      'planned',
      'started',
      'in_progress',
      'review_required',
      'authorized',
      'blocked',
      'completed',
      'failed',
      'cancelled'
    )
  )
);

create index if not exists internal_runtime_state_snapshots_session_idx
  on public.internal_runtime_state_snapshots (execution_session_id);

create index if not exists internal_runtime_state_snapshots_trace_idx
  on public.internal_runtime_state_snapshots (trace_id);

create index if not exists internal_runtime_state_snapshots_state_idx
  on public.internal_runtime_state_snapshots (current_execution_state);

comment on table public.internal_runtime_state_snapshots is
  'Phase 2F: derived mutable state snapshot per execution session. Always reconstructable from the immutable event store; the snapshot is a cache.';
comment on column public.internal_runtime_state_snapshots.state_payload is
  'JSONB derived state. Must never carry secrets, tokens, customer PII, or wallet balances.';

alter table public.internal_runtime_state_snapshots enable row level security;

-- ---------------------------------------------------------------------------
-- C. internal_event_stream_checkpoints
-- ---------------------------------------------------------------------------
create table if not exists public.internal_event_stream_checkpoints (
  id uuid primary key default gen_random_uuid(),
  checkpoint_key text not null unique,
  trace_id text not null,
  execution_session_id text,
  service_key text not null,
  capability_key text,
  environment text not null default 'sandbox',
  last_sequence_number bigint not null default 0,
  last_event_id text,
  checkpoint_status text not null default 'current',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_event_stream_checkpoints_env_ck check (
    lower(btrim(environment)) in ('sandbox', 'live')
  ),
  constraint internal_event_stream_checkpoints_status_ck check (
    lower(btrim(checkpoint_status)) in (
      'current',
      'stale',
      'rebuilding',
      'failed',
      'archived'
    )
  )
);

create index if not exists internal_event_stream_checkpoints_trace_idx
  on public.internal_event_stream_checkpoints (trace_id);

create index if not exists internal_event_stream_checkpoints_status_idx
  on public.internal_event_stream_checkpoints (checkpoint_status);

comment on table public.internal_event_stream_checkpoints is
  'Phase 2F: per-trace cursor recording the last consumed (sequence_number, event_id). Snapshot rebuilders advance this cursor when they finish replaying a trace.';

alter table public.internal_event_stream_checkpoints enable row level security;

-- ---------------------------------------------------------------------------
-- D. internal_event_correlation_links
-- ---------------------------------------------------------------------------
create table if not exists public.internal_event_correlation_links (
  id uuid primary key default gen_random_uuid(),
  correlation_id text not null,
  source_service_key text not null,
  target_service_key text not null,
  source_event_id text,
  target_event_id text,
  relation_type text not null,
  environment text not null default 'sandbox',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint internal_event_correlation_links_env_ck check (
    lower(btrim(environment)) in ('sandbox', 'live')
  ),
  constraint internal_event_correlation_links_relation_ck check (
    lower(btrim(relation_type)) in (
      'caused',
      'triggered',
      'mirrored',
      'reconciled',
      'notified',
      'reported'
    )
  )
);

create index if not exists internal_event_correlation_links_correlation_idx
  on public.internal_event_correlation_links (correlation_id);

create index if not exists internal_event_correlation_links_source_target_idx
  on public.internal_event_correlation_links (source_service_key, target_service_key);

comment on table public.internal_event_correlation_links is
  'Phase 2F: cross-service event correlation. Each row links a Tropicash event to a downstream Blue Atlantic service event by correlation_id.';

alter table public.internal_event_correlation_links enable row level security;

-- ---------------------------------------------------------------------------
-- Row-level security — admin-only on all four tables.
-- Requires public.tc_is_admin(); see fallback block at the bottom.
-- ---------------------------------------------------------------------------

-- internal_event_store
drop policy if exists "internal_event_store_select_admin" on public.internal_event_store;
create policy "internal_event_store_select_admin"
  on public.internal_event_store
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_event_store_insert_admin" on public.internal_event_store;
create policy "internal_event_store_insert_admin"
  on public.internal_event_store
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_event_store_update_admin" on public.internal_event_store;
create policy "internal_event_store_update_admin"
  on public.internal_event_store
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_event_store_delete_admin" on public.internal_event_store;
create policy "internal_event_store_delete_admin"
  on public.internal_event_store
  for delete to authenticated using (public.tc_is_admin());

-- internal_runtime_state_snapshots
drop policy if exists "internal_runtime_state_snapshots_select_admin" on public.internal_runtime_state_snapshots;
create policy "internal_runtime_state_snapshots_select_admin"
  on public.internal_runtime_state_snapshots
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_runtime_state_snapshots_insert_admin" on public.internal_runtime_state_snapshots;
create policy "internal_runtime_state_snapshots_insert_admin"
  on public.internal_runtime_state_snapshots
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_runtime_state_snapshots_update_admin" on public.internal_runtime_state_snapshots;
create policy "internal_runtime_state_snapshots_update_admin"
  on public.internal_runtime_state_snapshots
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_runtime_state_snapshots_delete_admin" on public.internal_runtime_state_snapshots;
create policy "internal_runtime_state_snapshots_delete_admin"
  on public.internal_runtime_state_snapshots
  for delete to authenticated using (public.tc_is_admin());

-- internal_event_stream_checkpoints
drop policy if exists "internal_event_stream_checkpoints_select_admin" on public.internal_event_stream_checkpoints;
create policy "internal_event_stream_checkpoints_select_admin"
  on public.internal_event_stream_checkpoints
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_event_stream_checkpoints_insert_admin" on public.internal_event_stream_checkpoints;
create policy "internal_event_stream_checkpoints_insert_admin"
  on public.internal_event_stream_checkpoints
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_event_stream_checkpoints_update_admin" on public.internal_event_stream_checkpoints;
create policy "internal_event_stream_checkpoints_update_admin"
  on public.internal_event_stream_checkpoints
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_event_stream_checkpoints_delete_admin" on public.internal_event_stream_checkpoints;
create policy "internal_event_stream_checkpoints_delete_admin"
  on public.internal_event_stream_checkpoints
  for delete to authenticated using (public.tc_is_admin());

-- internal_event_correlation_links
drop policy if exists "internal_event_correlation_links_select_admin" on public.internal_event_correlation_links;
create policy "internal_event_correlation_links_select_admin"
  on public.internal_event_correlation_links
  for select to authenticated using (public.tc_is_admin());

drop policy if exists "internal_event_correlation_links_insert_admin" on public.internal_event_correlation_links;
create policy "internal_event_correlation_links_insert_admin"
  on public.internal_event_correlation_links
  for insert to authenticated with check (public.tc_is_admin());

drop policy if exists "internal_event_correlation_links_update_admin" on public.internal_event_correlation_links;
create policy "internal_event_correlation_links_update_admin"
  on public.internal_event_correlation_links
  for update to authenticated using (public.tc_is_admin()) with check (public.tc_is_admin());

drop policy if exists "internal_event_correlation_links_delete_admin" on public.internal_event_correlation_links;
create policy "internal_event_correlation_links_delete_admin"
  on public.internal_event_correlation_links
  for delete to authenticated using (public.tc_is_admin());

revoke all on public.internal_event_store from anon, authenticated;
revoke all on public.internal_runtime_state_snapshots from anon, authenticated;
revoke all on public.internal_event_stream_checkpoints from anon, authenticated;
revoke all on public.internal_event_correlation_links from anon, authenticated;
grant select, insert, update, delete on public.internal_event_store to authenticated;
grant select, insert, update, delete on public.internal_runtime_state_snapshots to authenticated;
grant select, insert, update, delete on public.internal_event_stream_checkpoints to authenticated;
grant select, insert, update, delete on public.internal_event_correlation_links to authenticated;

-- ---------------------------------------------------------------------------
-- Seed example immutable events. All sandbox / placeholder. event_payload
-- carries no real user data, balances, secrets, or PII. Re-runnable via
-- ON CONFLICT (event_id) DO NOTHING.
--
-- Trace layout:
--   trace_2f_payment_create_demo  (5 events, sequence 1..5)
--   trace_2f_payout_release_demo  (2 events, sequence 1..2)
--   trace_2f_trading_profit_withdraw_demo  (2 events, sequence 1..2)
--   trace_2f_integration_triton_demo       (1 event,  sequence 1)
--   trace_2f_integration_sentinel_demo     (1 event,  sequence 1)
--   trace_2f_integration_elitehire_demo    (1 event,  sequence 1)
-- 12 events total, covering the 12 spec-listed event types exactly once.
-- ---------------------------------------------------------------------------
insert into public.internal_event_store (
  event_id,
  event_type,
  execution_session_id,
  trace_id,
  request_id,
  service_key,
  capability_key,
  environment,
  sequence_number,
  parent_event_id,
  causation_id,
  correlation_id,
  actor_type,
  actor_id,
  subject_type,
  subject_id,
  event_payload,
  metadata
)
values
  -- payment.create demo trace
  (
    'evt_2f_payment_create_001', 'execution.started',
    'sess_2f_payment_create_demo', 'trace_2f_payment_create_demo',
    'req_2f_payment_create_demo', 'tropicash', 'payment.create', 'sandbox',
    1, null, null, 'corr_2f_payment_create_demo',
    'system', 'tropicash_orchestrator', 'execution_session', 'sess_2f_payment_create_demo',
    '{"source": "phase_2f_seed", "purpose": "Pipeline started for the payment.create demo trace."}'::jsonb,
    '{"phase": "phase_2f_seed", "redaction": "no_pii"}'::jsonb
  ),
  (
    'evt_2f_payment_create_002', 'execution.policy_evaluated',
    'sess_2f_payment_create_demo', 'trace_2f_payment_create_demo',
    'req_2f_payment_create_demo', 'tropicash', 'payment.create', 'sandbox',
    2, 'evt_2f_payment_create_001', 'evt_2f_payment_create_001', 'corr_2f_payment_create_demo',
    'system', 'tropicash_orchestrator', 'execution_session', 'sess_2f_payment_create_demo',
    '{"source": "phase_2f_seed", "purpose": "Phase 2D policy_evaluated stage produced an allowed verdict (placeholder)."}'::jsonb,
    '{"phase": "phase_2f_seed", "stage_key": "policy_evaluated", "decision_key": "allowed"}'::jsonb
  ),
  (
    'evt_2f_payment_create_003', 'execution.review_required',
    'sess_2f_payment_create_demo', 'trace_2f_payment_create_demo',
    'req_2f_payment_create_demo', 'tropicash', 'payment.create', 'sandbox',
    3, 'evt_2f_payment_create_002', 'evt_2f_payment_create_002', 'corr_2f_payment_create_demo',
    'system', 'tropicash_orchestrator', 'execution_session', 'sess_2f_payment_create_demo',
    '{"source": "phase_2f_seed", "purpose": "Fraud stage paused the pipeline pending review (placeholder)."}'::jsonb,
    '{"phase": "phase_2f_seed", "stage_key": "fraud_reviewed", "decision_key": "review_required"}'::jsonb
  ),
  (
    'evt_2f_payment_create_004', 'payment.completed',
    'sess_2f_payment_create_demo', 'trace_2f_payment_create_demo',
    'req_2f_payment_create_demo', 'tropicash', 'payment.create', 'sandbox',
    4, 'evt_2f_payment_create_003', 'evt_2f_payment_create_003', 'corr_2f_payment_create_demo',
    'system', 'tropicash_executor', 'execution_session', 'sess_2f_payment_create_demo',
    '{"source": "phase_2f_seed", "purpose": "Executor reported a completed payment (placeholder; no funds moved)."}'::jsonb,
    '{"phase": "phase_2f_seed", "redaction": "amount_redacted"}'::jsonb
  ),
  (
    'evt_2f_payment_create_005', 'execution.completed',
    'sess_2f_payment_create_demo', 'trace_2f_payment_create_demo',
    'req_2f_payment_create_demo', 'tropicash', 'payment.create', 'sandbox',
    5, 'evt_2f_payment_create_004', 'evt_2f_payment_create_004', 'corr_2f_payment_create_demo',
    'system', 'tropicash_orchestrator', 'execution_session', 'sess_2f_payment_create_demo',
    '{"source": "phase_2f_seed", "purpose": "Pipeline reached the execution_authorized terminal state cleanly."}'::jsonb,
    '{"phase": "phase_2f_seed", "stage_key": "execution_authorized", "decision_key": "execution_authorized"}'::jsonb
  ),
  -- payout.release demo trace
  (
    'evt_2f_payout_release_001', 'payout.requested',
    'sess_2f_payout_release_demo', 'trace_2f_payout_release_demo',
    'req_2f_payout_release_demo', 'tropicash', 'payout.release', 'sandbox',
    1, null, null, 'corr_2f_payout_release_demo',
    'admin', 'tropicash_admin_demo', 'execution_session', 'sess_2f_payout_release_demo',
    '{"source": "phase_2f_seed", "purpose": "An admin queued a payout release (placeholder; no funds moved)."}'::jsonb,
    '{"phase": "phase_2f_seed", "redaction": "amount_redacted"}'::jsonb
  ),
  (
    'evt_2f_payout_release_002', 'execution.blocked',
    'sess_2f_payout_release_demo', 'trace_2f_payout_release_demo',
    'req_2f_payout_release_demo', 'tropicash', 'payout.release', 'sandbox',
    2, 'evt_2f_payout_release_001', 'evt_2f_payout_release_001', 'corr_2f_payout_release_demo',
    'system', 'tropicash_orchestrator', 'execution_session', 'sess_2f_payout_release_demo',
    '{"source": "phase_2f_seed", "purpose": "Pipeline hit a terminal block (placeholder)."}'::jsonb,
    '{"phase": "phase_2f_seed", "stage_key": "execution_authorized", "decision_key": "execution_blocked"}'::jsonb
  ),
  -- trading.profit_withdraw demo trace
  (
    'evt_2f_trading_profit_withdraw_001', 'wallet.funded',
    'sess_2f_trading_profit_withdraw_demo', 'trace_2f_trading_profit_withdraw_demo',
    'req_2f_trading_profit_withdraw_demo', 'tropicash', 'trading.profit_withdraw', 'sandbox',
    1, null, null, 'corr_2f_trading_profit_withdraw_demo',
    'system', 'tropicash_executor', 'execution_session', 'sess_2f_trading_profit_withdraw_demo',
    '{"source": "phase_2f_seed", "purpose": "Wallet credited with trading profit (placeholder; no funds moved)."}'::jsonb,
    '{"phase": "phase_2f_seed", "redaction": "amount_redacted"}'::jsonb
  ),
  (
    'evt_2f_trading_profit_withdraw_002', 'fraud.flagged',
    'sess_2f_trading_profit_withdraw_demo', 'trace_2f_trading_profit_withdraw_demo',
    'req_2f_trading_profit_withdraw_demo', 'tropicash', 'trading.profit_withdraw', 'sandbox',
    2, 'evt_2f_trading_profit_withdraw_001', 'evt_2f_trading_profit_withdraw_001', 'corr_2f_trading_profit_withdraw_demo',
    'system', 'tropicash_fraud_engine', 'execution_session', 'sess_2f_trading_profit_withdraw_demo',
    '{"source": "phase_2f_seed", "purpose": "Fraud engine flagged the trace for human review (placeholder)."}'::jsonb,
    '{"phase": "phase_2f_seed", "stage_key": "fraud_reviewed"}'::jsonb
  ),
  -- integration.* traces (one event each)
  (
    'evt_2f_integration_triton_001', 'integration.triton_transfer_requested',
    null, 'trace_2f_integration_triton_demo',
    'req_2f_integration_triton_demo', 'tropicash', null, 'sandbox',
    1, null, null, 'corr_2f_integration_triton_demo',
    'service', 'triton', 'integration', 'triton',
    '{"source": "phase_2f_seed", "purpose": "Tropicash requested a transfer from Triton (placeholder; no funds moved)."}'::jsonb,
    '{"phase": "phase_2f_seed", "target_service_key": "triton", "redaction": "amount_redacted"}'::jsonb
  ),
  (
    'evt_2f_integration_sentinel_001', 'integration.sentinel_sync_completed',
    null, 'trace_2f_integration_sentinel_demo',
    'req_2f_integration_sentinel_demo', 'tropicash', null, 'sandbox',
    1, null, null, 'corr_2f_integration_sentinel_demo',
    'service', 'sentinel', 'integration', 'sentinel',
    '{"source": "phase_2f_seed", "purpose": "Sentinel reporting sync completed (placeholder; no real data)."}'::jsonb,
    '{"phase": "phase_2f_seed", "target_service_key": "sentinel"}'::jsonb
  ),
  (
    'evt_2f_integration_elitehire_001', 'integration.elitehire_payment_completed',
    null, 'trace_2f_integration_elitehire_demo',
    'req_2f_integration_elitehire_demo', 'tropicash', null, 'sandbox',
    1, null, null, 'corr_2f_integration_elitehire_demo',
    'service', 'elitehire_pro', 'integration', 'elitehire_pro',
    '{"source": "phase_2f_seed", "purpose": "EliteHire Pro reported a completed contractor payment (placeholder; no funds moved)."}'::jsonb,
    '{"phase": "phase_2f_seed", "target_service_key": "elitehire_pro", "redaction": "amount_redacted"}'::jsonb
  )
on conflict (event_id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed example mutable state snapshots — one per high-risk capability. All
-- planned / sandbox. Re-runnable via ON CONFLICT (snapshot_id) DO NOTHING.
-- ---------------------------------------------------------------------------
insert into public.internal_runtime_state_snapshots (
  snapshot_id,
  execution_session_id,
  trace_id,
  service_key,
  capability_key,
  environment,
  current_execution_state,
  current_review_state,
  current_policy_state,
  last_decision_key,
  last_stage_key,
  last_event_id,
  state_payload,
  version
)
values
  (
    'snap_2f_payment_create_demo',
    'sess_2f_payment_create_demo',
    'trace_2f_payment_create_demo',
    'tropicash',
    'payment.create',
    'sandbox',
    'planned',
    null,
    null,
    null,
    null,
    null,
    '{"source": "phase_2f_seed", "purpose": "Initial snapshot for the payment.create demo session — derived from event_store, never authoritative."}'::jsonb,
    1
  ),
  (
    'snap_2f_payout_release_demo',
    'sess_2f_payout_release_demo',
    'trace_2f_payout_release_demo',
    'tropicash',
    'payout.release',
    'sandbox',
    'planned',
    null,
    null,
    null,
    null,
    null,
    '{"source": "phase_2f_seed", "purpose": "Initial snapshot for the payout.release demo session."}'::jsonb,
    1
  ),
  (
    'snap_2f_trading_profit_withdraw_demo',
    'sess_2f_trading_profit_withdraw_demo',
    'trace_2f_trading_profit_withdraw_demo',
    'tropicash',
    'trading.profit_withdraw',
    'sandbox',
    'planned',
    null,
    null,
    null,
    null,
    null,
    '{"source": "phase_2f_seed", "purpose": "Initial snapshot for the trading.profit_withdraw demo session."}'::jsonb,
    1
  )
on conflict (snapshot_id) do nothing;

-- ---------------------------------------------------------------------------
-- Seed checkpoints (one per high-risk capability trace). All status='current'.
-- Re-runnable via ON CONFLICT (checkpoint_key) DO NOTHING.
-- ---------------------------------------------------------------------------
insert into public.internal_event_stream_checkpoints (
  checkpoint_key,
  trace_id,
  execution_session_id,
  service_key,
  capability_key,
  environment,
  last_sequence_number,
  last_event_id,
  checkpoint_status,
  metadata
)
values
  (
    'ckpt_2f_payment_create_demo',
    'trace_2f_payment_create_demo',
    'sess_2f_payment_create_demo',
    'tropicash',
    'payment.create',
    'sandbox',
    5,
    'evt_2f_payment_create_005',
    'current',
    '{"source": "phase_2f_seed", "purpose": "Cursor at the last replayed event in the payment.create demo trace."}'::jsonb
  ),
  (
    'ckpt_2f_payout_release_demo',
    'trace_2f_payout_release_demo',
    'sess_2f_payout_release_demo',
    'tropicash',
    'payout.release',
    'sandbox',
    2,
    'evt_2f_payout_release_002',
    'current',
    '{"source": "phase_2f_seed", "purpose": "Cursor at the last replayed event in the payout.release demo trace."}'::jsonb
  ),
  (
    'ckpt_2f_trading_profit_withdraw_demo',
    'trace_2f_trading_profit_withdraw_demo',
    'sess_2f_trading_profit_withdraw_demo',
    'tropicash',
    'trading.profit_withdraw',
    'sandbox',
    2,
    'evt_2f_trading_profit_withdraw_002',
    'current',
    '{"source": "phase_2f_seed", "purpose": "Cursor at the last replayed event in the trading.profit_withdraw demo trace."}'::jsonb
  )
on conflict (checkpoint_key) do nothing;

-- ---------------------------------------------------------------------------
-- Seed example correlation links — Tropicash → Triton / Sentinel /
-- EliteHire Pro. Note there is no unique key on this table, so we delete
-- prior Phase 2F seed rows first (scoped by metadata.source) and re-insert.
-- This keeps the migration idempotent without affecting any future
-- correlation rows the executor may write.
-- ---------------------------------------------------------------------------
delete from public.internal_event_correlation_links
where metadata @> '{"source": "phase_2f_seed"}'::jsonb;

insert into public.internal_event_correlation_links (
  correlation_id,
  source_service_key,
  target_service_key,
  source_event_id,
  target_event_id,
  relation_type,
  environment,
  metadata
)
values
  (
    'corr_2f_integration_triton_demo',
    'tropicash',
    'triton',
    'evt_2f_payment_create_004',
    'evt_2f_integration_triton_001',
    'triggered',
    'sandbox',
    '{"source": "phase_2f_seed", "purpose": "Tropicash payment.completed triggered a Triton transfer request (placeholder)."}'::jsonb
  ),
  (
    'corr_2f_integration_sentinel_demo',
    'tropicash',
    'sentinel',
    'evt_2f_payment_create_005',
    'evt_2f_integration_sentinel_001',
    'reported',
    'sandbox',
    '{"source": "phase_2f_seed", "purpose": "Tropicash execution.completed was reported into Sentinel (placeholder)."}'::jsonb
  ),
  (
    'corr_2f_integration_elitehire_demo',
    'tropicash',
    'elitehire_pro',
    'evt_2f_payout_release_001',
    'evt_2f_integration_elitehire_001',
    'reconciled',
    'sandbox',
    '{"source": "phase_2f_seed", "purpose": "Tropicash payout.requested was reconciled against EliteHire Pro contractor payment (placeholder)."}'::jsonb
  );

-- ---------------------------------------------------------------------------
-- Fallback note (do NOT uncomment unless public.tc_is_admin() is unavailable):
--
-- If the tc_is_admin() helper has not been created yet (see
-- supabase/sql/withdrawal_requests.sql), replace every admin policy above
-- with an explicit allow-list, e.g.:
--
-- create policy "internal_event_store_select_admin_fallback"
--   on public.internal_event_store
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
