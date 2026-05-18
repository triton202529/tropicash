/**
 * Tropicash Developer Platform — Phase 2F:
 * Runtime State & Event Store Blueprint config.
 *
 * Pure planning data layered on top of Phase 2A (registry), Phase 2B
 * (governance), Phase 2C (capabilities), Phase 2D (orchestration), and
 * Phase 2E (observability). Mirrors
 * supabase/sql/internal_runtime_state_phase2f.sql.
 *
 * THIS FILE IS RUNTIME-STATE ARCHITECTURE ONLY. It does NOT:
 *   • create real event emitters or runtime executors
 *   • create real public or internal money-moving APIs
 *   • create monitoring daemons / log shippers
 *   • create API keys, service tokens, or secrets
 *   • move money
 *   • modify treasury, wallet, withdrawal, PayPal funding, or fraud logic
 *
 * The canonical narrative lives in docs/internal-service-blueprint.md
 * (Phase 2F section). When the exports below change materially, update
 * that doc and the SQL migration in the same PR.
 */

export const INTERNAL_RUNTIME_STATE_PHASE = "phase_2f_runtime_state";

/**
 * Logical groupings for the seeded event types. The DB's `event_type` is
 * just text; these families exist for the UI's grouping and for narrative
 * docs.
 */
export const EVENT_STORE_EVENT_FAMILIES = [
  {
    key: "execution",
    label: "Execution lifecycle",
    description:
      "Pipeline-level events written by the future orchestrator at every stage transition.",
    accent: "#0ea5e9",
    icon: "⚙️",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
    eventTypes: [
      "execution.started",
      "execution.policy_evaluated",
      "execution.review_required",
      "execution.blocked",
      "execution.completed",
    ],
  },
  {
    key: "money_movement",
    label: "Money movement",
    description:
      "Domain events written by the future executor when wallets, payments, and payouts change state.",
    accent: "#16a34a",
    icon: "💸",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
    eventTypes: ["wallet.funded", "payment.completed", "payout.requested"],
  },
  {
    key: "fraud",
    label: "Fraud signals",
    description:
      "Fraud-engine events surfaced into the event store for forensic replay.",
    accent: "#be123c",
    icon: "🚨",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-900",
    eventTypes: ["fraud.flagged"],
  },
  {
    key: "integration",
    label: "Integration mirror",
    description:
      "Events mirroring outbound calls into the Blue Atlantic family (Triton, Sentinel, EliteHire Pro).",
    accent: "#7c3aed",
    icon: "🌐",
    badgeClass: "border border-violet-200 bg-violet-50 text-violet-900",
    eventTypes: [
      "integration.triton_transfer_requested",
      "integration.sentinel_sync_completed",
      "integration.elitehire_payment_completed",
    ],
  },
];

/**
 * Snapshot execution-state vocabulary. Mirrors the
 * `current_execution_state` check constraint on
 * internal_runtime_state_snapshots. Note this is a snapshot-state
 * vocabulary — it is similar to but NOT identical to Phase 2E's session
 * `execution_status` (snapshot has `authorized`; session has
 * `in_progress` / `started` distinctions handled differently).
 */
export const RUNTIME_EXECUTION_STATES = [
  {
    key: "planned",
    label: "Planned",
    description: "Snapshot reserved; no execution events have arrived yet.",
    dotClass: "bg-sky-500",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    key: "started",
    label: "Started",
    description:
      "First execution event applied; pipeline has been picked up.",
    dotClass: "bg-indigo-500",
    badgeClass: "border border-indigo-200 bg-indigo-50 text-indigo-800",
  },
  {
    key: "in_progress",
    label: "In progress",
    description: "Snapshot is between non-terminal stages.",
    dotClass: "bg-blue-500",
    badgeClass: "border border-blue-200 bg-blue-50 text-blue-800",
  },
  {
    key: "review_required",
    label: "Review required",
    description:
      "Snapshot paused awaiting human or admin review.",
    dotClass: "bg-amber-500",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    key: "authorized",
    label: "Authorized",
    description:
      "Pipeline reached execution_authorized; the executor has been cleared to run the side-effect.",
    dotClass: "bg-emerald-600",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  {
    key: "blocked",
    label: "Blocked",
    description:
      "Pipeline emitted a terminal block (execution_blocked / blocked).",
    dotClass: "bg-red-500",
    badgeClass: "border border-red-200 bg-red-50 text-red-900",
  },
  {
    key: "completed",
    label: "Completed",
    description:
      "Executor finished cleanly; final domain event applied.",
    dotClass: "bg-emerald-500",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    key: "failed",
    label: "Failed",
    description:
      "Executor authorized the call but the call failed during execution.",
    dotClass: "bg-rose-500",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-900",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    description: "Caller or admin cancelled the snapshot.",
    dotClass: "bg-slate-400",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
];

/**
 * Checkpoint statuses. Mirrors the `checkpoint_status` check constraint
 * on internal_event_stream_checkpoints.
 */
export const CHECKPOINT_STATUSES = [
  {
    key: "current",
    label: "Current",
    description:
      "Checkpoint is at the latest replayed (sequence_number, event_id).",
    dotClass: "bg-emerald-500",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    key: "stale",
    label: "Stale",
    description:
      "Newer events exist past the checkpoint; a snapshot rebuild is pending.",
    dotClass: "bg-amber-500",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    key: "rebuilding",
    label: "Rebuilding",
    description:
      "A rebuilder is currently re-deriving the snapshot for this trace.",
    dotClass: "bg-sky-500",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    key: "failed",
    label: "Failed",
    description:
      "The most recent rebuild attempt failed; investigate before resuming.",
    dotClass: "bg-red-500",
    badgeClass: "border border-red-200 bg-red-50 text-red-900",
  },
  {
    key: "archived",
    label: "Archived",
    description:
      "Checkpoint retained for forensics but no longer advanced.",
    dotClass: "bg-slate-400",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
];

/**
 * Cross-service correlation relation types. Mirrors the `relation_type`
 * check constraint on internal_event_correlation_links.
 */
export const CORRELATION_RELATION_TYPES = [
  {
    key: "caused",
    label: "Caused",
    description:
      "Source event directly caused the target (strong causal link).",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-900",
  },
  {
    key: "triggered",
    label: "Triggered",
    description:
      "Source event triggered an outbound call into the target service.",
    badgeClass: "border border-orange-200 bg-orange-50 text-orange-900",
  },
  {
    key: "mirrored",
    label: "Mirrored",
    description:
      "Target event mirrors the source event into another store/log.",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    key: "reconciled",
    label: "Reconciled",
    description:
      "Source and target events were reconciled by an admin or an automated batch.",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    key: "notified",
    label: "Notified",
    description:
      "Target service was notified by the source service (no execution).",
    badgeClass: "border border-violet-200 bg-violet-50 text-violet-900",
  },
  {
    key: "reported",
    label: "Reported",
    description:
      "Source event was reported into the target service for analytics or compliance.",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
];

// ---------------------------------------------------------------------------
// Seeded rows — mirror the SQL seed block.
// ---------------------------------------------------------------------------

/**
 * 12 seeded immutable events grouped into 6 demo traces. Each row
 * matches a row in the SQL `internal_event_store` insert block and
 * keeps payloads as planning placeholders.
 */
export const EVENT_STORE_SEEDS = [
  {
    eventId: "evt_2f_payment_create_001",
    eventType: "execution.started",
    executionSessionId: "sess_2f_payment_create_demo",
    traceId: "trace_2f_payment_create_demo",
    requestId: "req_2f_payment_create_demo",
    serviceKey: "tropicash",
    capabilityKey: "payment.create",
    environment: "sandbox",
    sequenceNumber: 1,
    parentEventId: null,
    causationId: null,
    correlationId: "corr_2f_payment_create_demo",
    actorType: "system",
    actorId: "tropicash_orchestrator",
    subjectType: "execution_session",
    subjectId: "sess_2f_payment_create_demo",
    eventPayload: {
      source: "phase_2f_seed",
      purpose:
        "Pipeline started for the payment.create demo trace.",
    },
    metadata: { phase: "phase_2f_seed", redaction: "no_pii" },
  },
  {
    eventId: "evt_2f_payment_create_002",
    eventType: "execution.policy_evaluated",
    executionSessionId: "sess_2f_payment_create_demo",
    traceId: "trace_2f_payment_create_demo",
    requestId: "req_2f_payment_create_demo",
    serviceKey: "tropicash",
    capabilityKey: "payment.create",
    environment: "sandbox",
    sequenceNumber: 2,
    parentEventId: "evt_2f_payment_create_001",
    causationId: "evt_2f_payment_create_001",
    correlationId: "corr_2f_payment_create_demo",
    actorType: "system",
    actorId: "tropicash_orchestrator",
    subjectType: "execution_session",
    subjectId: "sess_2f_payment_create_demo",
    eventPayload: {
      source: "phase_2f_seed",
      purpose:
        "Phase 2D policy_evaluated stage produced an allowed verdict (placeholder).",
    },
    metadata: {
      phase: "phase_2f_seed",
      stage_key: "policy_evaluated",
      decision_key: "allowed",
    },
  },
  {
    eventId: "evt_2f_payment_create_003",
    eventType: "execution.review_required",
    executionSessionId: "sess_2f_payment_create_demo",
    traceId: "trace_2f_payment_create_demo",
    requestId: "req_2f_payment_create_demo",
    serviceKey: "tropicash",
    capabilityKey: "payment.create",
    environment: "sandbox",
    sequenceNumber: 3,
    parentEventId: "evt_2f_payment_create_002",
    causationId: "evt_2f_payment_create_002",
    correlationId: "corr_2f_payment_create_demo",
    actorType: "system",
    actorId: "tropicash_orchestrator",
    subjectType: "execution_session",
    subjectId: "sess_2f_payment_create_demo",
    eventPayload: {
      source: "phase_2f_seed",
      purpose:
        "Fraud stage paused the pipeline pending review (placeholder).",
    },
    metadata: {
      phase: "phase_2f_seed",
      stage_key: "fraud_reviewed",
      decision_key: "review_required",
    },
  },
  {
    eventId: "evt_2f_payment_create_004",
    eventType: "payment.completed",
    executionSessionId: "sess_2f_payment_create_demo",
    traceId: "trace_2f_payment_create_demo",
    requestId: "req_2f_payment_create_demo",
    serviceKey: "tropicash",
    capabilityKey: "payment.create",
    environment: "sandbox",
    sequenceNumber: 4,
    parentEventId: "evt_2f_payment_create_003",
    causationId: "evt_2f_payment_create_003",
    correlationId: "corr_2f_payment_create_demo",
    actorType: "system",
    actorId: "tropicash_executor",
    subjectType: "execution_session",
    subjectId: "sess_2f_payment_create_demo",
    eventPayload: {
      source: "phase_2f_seed",
      purpose:
        "Executor reported a completed payment (placeholder; no funds moved).",
    },
    metadata: { phase: "phase_2f_seed", redaction: "amount_redacted" },
  },
  {
    eventId: "evt_2f_payment_create_005",
    eventType: "execution.completed",
    executionSessionId: "sess_2f_payment_create_demo",
    traceId: "trace_2f_payment_create_demo",
    requestId: "req_2f_payment_create_demo",
    serviceKey: "tropicash",
    capabilityKey: "payment.create",
    environment: "sandbox",
    sequenceNumber: 5,
    parentEventId: "evt_2f_payment_create_004",
    causationId: "evt_2f_payment_create_004",
    correlationId: "corr_2f_payment_create_demo",
    actorType: "system",
    actorId: "tropicash_orchestrator",
    subjectType: "execution_session",
    subjectId: "sess_2f_payment_create_demo",
    eventPayload: {
      source: "phase_2f_seed",
      purpose:
        "Pipeline reached the execution_authorized terminal state cleanly.",
    },
    metadata: {
      phase: "phase_2f_seed",
      stage_key: "execution_authorized",
      decision_key: "execution_authorized",
    },
  },
  {
    eventId: "evt_2f_payout_release_001",
    eventType: "payout.requested",
    executionSessionId: "sess_2f_payout_release_demo",
    traceId: "trace_2f_payout_release_demo",
    requestId: "req_2f_payout_release_demo",
    serviceKey: "tropicash",
    capabilityKey: "payout.release",
    environment: "sandbox",
    sequenceNumber: 1,
    parentEventId: null,
    causationId: null,
    correlationId: "corr_2f_payout_release_demo",
    actorType: "admin",
    actorId: "tropicash_admin_demo",
    subjectType: "execution_session",
    subjectId: "sess_2f_payout_release_demo",
    eventPayload: {
      source: "phase_2f_seed",
      purpose:
        "An admin queued a payout release (placeholder; no funds moved).",
    },
    metadata: { phase: "phase_2f_seed", redaction: "amount_redacted" },
  },
  {
    eventId: "evt_2f_payout_release_002",
    eventType: "execution.blocked",
    executionSessionId: "sess_2f_payout_release_demo",
    traceId: "trace_2f_payout_release_demo",
    requestId: "req_2f_payout_release_demo",
    serviceKey: "tropicash",
    capabilityKey: "payout.release",
    environment: "sandbox",
    sequenceNumber: 2,
    parentEventId: "evt_2f_payout_release_001",
    causationId: "evt_2f_payout_release_001",
    correlationId: "corr_2f_payout_release_demo",
    actorType: "system",
    actorId: "tropicash_orchestrator",
    subjectType: "execution_session",
    subjectId: "sess_2f_payout_release_demo",
    eventPayload: {
      source: "phase_2f_seed",
      purpose: "Pipeline hit a terminal block (placeholder).",
    },
    metadata: {
      phase: "phase_2f_seed",
      stage_key: "execution_authorized",
      decision_key: "execution_blocked",
    },
  },
  {
    eventId: "evt_2f_trading_profit_withdraw_001",
    eventType: "wallet.funded",
    executionSessionId: "sess_2f_trading_profit_withdraw_demo",
    traceId: "trace_2f_trading_profit_withdraw_demo",
    requestId: "req_2f_trading_profit_withdraw_demo",
    serviceKey: "tropicash",
    capabilityKey: "trading.profit_withdraw",
    environment: "sandbox",
    sequenceNumber: 1,
    parentEventId: null,
    causationId: null,
    correlationId: "corr_2f_trading_profit_withdraw_demo",
    actorType: "system",
    actorId: "tropicash_executor",
    subjectType: "execution_session",
    subjectId: "sess_2f_trading_profit_withdraw_demo",
    eventPayload: {
      source: "phase_2f_seed",
      purpose:
        "Wallet credited with trading profit (placeholder; no funds moved).",
    },
    metadata: { phase: "phase_2f_seed", redaction: "amount_redacted" },
  },
  {
    eventId: "evt_2f_trading_profit_withdraw_002",
    eventType: "fraud.flagged",
    executionSessionId: "sess_2f_trading_profit_withdraw_demo",
    traceId: "trace_2f_trading_profit_withdraw_demo",
    requestId: "req_2f_trading_profit_withdraw_demo",
    serviceKey: "tropicash",
    capabilityKey: "trading.profit_withdraw",
    environment: "sandbox",
    sequenceNumber: 2,
    parentEventId: "evt_2f_trading_profit_withdraw_001",
    causationId: "evt_2f_trading_profit_withdraw_001",
    correlationId: "corr_2f_trading_profit_withdraw_demo",
    actorType: "system",
    actorId: "tropicash_fraud_engine",
    subjectType: "execution_session",
    subjectId: "sess_2f_trading_profit_withdraw_demo",
    eventPayload: {
      source: "phase_2f_seed",
      purpose:
        "Fraud engine flagged the trace for human review (placeholder).",
    },
    metadata: { phase: "phase_2f_seed", stage_key: "fraud_reviewed" },
  },
  {
    eventId: "evt_2f_integration_triton_001",
    eventType: "integration.triton_transfer_requested",
    executionSessionId: null,
    traceId: "trace_2f_integration_triton_demo",
    requestId: "req_2f_integration_triton_demo",
    serviceKey: "tropicash",
    capabilityKey: null,
    environment: "sandbox",
    sequenceNumber: 1,
    parentEventId: null,
    causationId: null,
    correlationId: "corr_2f_integration_triton_demo",
    actorType: "service",
    actorId: "triton",
    subjectType: "integration",
    subjectId: "triton",
    eventPayload: {
      source: "phase_2f_seed",
      purpose:
        "Tropicash requested a transfer from Triton (placeholder; no funds moved).",
    },
    metadata: {
      phase: "phase_2f_seed",
      target_service_key: "triton",
      redaction: "amount_redacted",
    },
  },
  {
    eventId: "evt_2f_integration_sentinel_001",
    eventType: "integration.sentinel_sync_completed",
    executionSessionId: null,
    traceId: "trace_2f_integration_sentinel_demo",
    requestId: "req_2f_integration_sentinel_demo",
    serviceKey: "tropicash",
    capabilityKey: null,
    environment: "sandbox",
    sequenceNumber: 1,
    parentEventId: null,
    causationId: null,
    correlationId: "corr_2f_integration_sentinel_demo",
    actorType: "service",
    actorId: "sentinel",
    subjectType: "integration",
    subjectId: "sentinel",
    eventPayload: {
      source: "phase_2f_seed",
      purpose:
        "Sentinel reporting sync completed (placeholder; no real data).",
    },
    metadata: {
      phase: "phase_2f_seed",
      target_service_key: "sentinel",
    },
  },
  {
    eventId: "evt_2f_integration_elitehire_001",
    eventType: "integration.elitehire_payment_completed",
    executionSessionId: null,
    traceId: "trace_2f_integration_elitehire_demo",
    requestId: "req_2f_integration_elitehire_demo",
    serviceKey: "tropicash",
    capabilityKey: null,
    environment: "sandbox",
    sequenceNumber: 1,
    parentEventId: null,
    causationId: null,
    correlationId: "corr_2f_integration_elitehire_demo",
    actorType: "service",
    actorId: "elitehire_pro",
    subjectType: "integration",
    subjectId: "elitehire_pro",
    eventPayload: {
      source: "phase_2f_seed",
      purpose:
        "EliteHire Pro reported a completed contractor payment (placeholder; no funds moved).",
    },
    metadata: {
      phase: "phase_2f_seed",
      target_service_key: "elitehire_pro",
      redaction: "amount_redacted",
    },
  },
];

/**
 * Snapshot seeds — one per high-risk capability. All planned, sandbox.
 */
export const RUNTIME_STATE_SNAPSHOT_SEEDS = [
  {
    snapshotId: "snap_2f_payment_create_demo",
    executionSessionId: "sess_2f_payment_create_demo",
    traceId: "trace_2f_payment_create_demo",
    serviceKey: "tropicash",
    capabilityKey: "payment.create",
    environment: "sandbox",
    currentExecutionState: "planned",
    currentReviewState: null,
    currentPolicyState: null,
    lastDecisionKey: null,
    lastStageKey: null,
    lastEventId: null,
    statePayload: {
      source: "phase_2f_seed",
      purpose:
        "Initial snapshot for the payment.create demo session — derived from event_store, never authoritative.",
    },
    version: 1,
  },
  {
    snapshotId: "snap_2f_payout_release_demo",
    executionSessionId: "sess_2f_payout_release_demo",
    traceId: "trace_2f_payout_release_demo",
    serviceKey: "tropicash",
    capabilityKey: "payout.release",
    environment: "sandbox",
    currentExecutionState: "planned",
    currentReviewState: null,
    currentPolicyState: null,
    lastDecisionKey: null,
    lastStageKey: null,
    lastEventId: null,
    statePayload: {
      source: "phase_2f_seed",
      purpose:
        "Initial snapshot for the payout.release demo session.",
    },
    version: 1,
  },
  {
    snapshotId: "snap_2f_trading_profit_withdraw_demo",
    executionSessionId: "sess_2f_trading_profit_withdraw_demo",
    traceId: "trace_2f_trading_profit_withdraw_demo",
    serviceKey: "tropicash",
    capabilityKey: "trading.profit_withdraw",
    environment: "sandbox",
    currentExecutionState: "planned",
    currentReviewState: null,
    currentPolicyState: null,
    lastDecisionKey: null,
    lastStageKey: null,
    lastEventId: null,
    statePayload: {
      source: "phase_2f_seed",
      purpose:
        "Initial snapshot for the trading.profit_withdraw demo session.",
    },
    version: 1,
  },
];

/**
 * Checkpoint seeds — one per high-risk capability trace. All `current`.
 */
export const EVENT_STREAM_CHECKPOINT_SEEDS = [
  {
    checkpointKey: "ckpt_2f_payment_create_demo",
    traceId: "trace_2f_payment_create_demo",
    executionSessionId: "sess_2f_payment_create_demo",
    serviceKey: "tropicash",
    capabilityKey: "payment.create",
    environment: "sandbox",
    lastSequenceNumber: 5,
    lastEventId: "evt_2f_payment_create_005",
    checkpointStatus: "current",
    metadata: {
      source: "phase_2f_seed",
      purpose:
        "Cursor at the last replayed event in the payment.create demo trace.",
    },
  },
  {
    checkpointKey: "ckpt_2f_payout_release_demo",
    traceId: "trace_2f_payout_release_demo",
    executionSessionId: "sess_2f_payout_release_demo",
    serviceKey: "tropicash",
    capabilityKey: "payout.release",
    environment: "sandbox",
    lastSequenceNumber: 2,
    lastEventId: "evt_2f_payout_release_002",
    checkpointStatus: "current",
    metadata: {
      source: "phase_2f_seed",
      purpose:
        "Cursor at the last replayed event in the payout.release demo trace.",
    },
  },
  {
    checkpointKey: "ckpt_2f_trading_profit_withdraw_demo",
    traceId: "trace_2f_trading_profit_withdraw_demo",
    executionSessionId: "sess_2f_trading_profit_withdraw_demo",
    serviceKey: "tropicash",
    capabilityKey: "trading.profit_withdraw",
    environment: "sandbox",
    lastSequenceNumber: 2,
    lastEventId: "evt_2f_trading_profit_withdraw_002",
    checkpointStatus: "current",
    metadata: {
      source: "phase_2f_seed",
      purpose:
        "Cursor at the last replayed event in the trading.profit_withdraw demo trace.",
    },
  },
];

/**
 * Correlation link seeds — Tropicash → Triton / Sentinel / EliteHire Pro.
 */
export const EVENT_CORRELATION_LINK_SEEDS = [
  {
    correlationId: "corr_2f_integration_triton_demo",
    sourceServiceKey: "tropicash",
    targetServiceKey: "triton",
    sourceEventId: "evt_2f_payment_create_004",
    targetEventId: "evt_2f_integration_triton_001",
    relationType: "triggered",
    environment: "sandbox",
    metadata: {
      source: "phase_2f_seed",
      purpose:
        "Tropicash payment.completed triggered a Triton transfer request (placeholder).",
    },
  },
  {
    correlationId: "corr_2f_integration_sentinel_demo",
    sourceServiceKey: "tropicash",
    targetServiceKey: "sentinel",
    sourceEventId: "evt_2f_payment_create_005",
    targetEventId: "evt_2f_integration_sentinel_001",
    relationType: "reported",
    environment: "sandbox",
    metadata: {
      source: "phase_2f_seed",
      purpose:
        "Tropicash execution.completed was reported into Sentinel (placeholder).",
    },
  },
  {
    correlationId: "corr_2f_integration_elitehire_demo",
    sourceServiceKey: "tropicash",
    targetServiceKey: "elitehire_pro",
    sourceEventId: "evt_2f_payout_release_001",
    targetEventId: "evt_2f_integration_elitehire_001",
    relationType: "reconciled",
    environment: "sandbox",
    metadata: {
      source: "phase_2f_seed",
      purpose:
        "Tropicash payout.requested was reconciled against EliteHire Pro contractor payment (placeholder).",
    },
  },
];

/**
 * Non-negotiable safety rules. Narrows the existing platform safety rules
 * into runtime-state-level checks.
 */
export const RUNTIME_STATE_SAFETY_RULES = [
  "Phase 2F describes the runtime state and event store; it does not implement them. No code path emits or consumes runtime events today.",
  "internal_event_store is append-only. The future executor MUST NOT update or delete event rows once written.",
  "internal_runtime_state_snapshots is a derived cache. The event store is the source of truth — snapshots must always be reconstructable from the event log.",
  "Per-trace event ordering is enforced by the unique (trace_id, sequence_number) constraint. Future emitters must allocate sequence numbers monotonically per trace.",
  "Event payloads (`event_payload`), state payloads (`state_payload`), checkpoint metadata, and correlation metadata MUST NOT carry secrets, tokens, customer PII, or wallet balances.",
  "Cross-service correlation rows reference downstream Blue Atlantic services by `target_service_key`. They never carry credentials or external API tokens.",
  "Sandbox and live event streams are independent series. Sandbox events must never be aggregated, replayed into, or mirrored to live, and vice versa.",
  "Snapshots are versioned. A rebuild bumps `version` and updates the matching checkpoint; old snapshot rows must remain in place for forensic comparison.",
  "Checkpoints are advisory. A `current` checkpoint does not authorize execution — only the Phase 2D pipeline can.",
  "Phase 2F does not modify the wallet ledger, treasury, withdrawal payouts, PayPal funding, or the fraud engine. It records their planned events; it never replaces them.",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up an event seed by its event_id.
 */
export function getEventSeed(eventId) {
  if (!eventId) return null;
  return EVENT_STORE_SEEDS.find((e) => e.eventId === eventId) ?? null;
}

/**
 * Look up a snapshot seed by its snapshot_id.
 */
export function getSnapshotSeed(snapshotId) {
  if (!snapshotId) return null;
  return (
    RUNTIME_STATE_SNAPSHOT_SEEDS.find((s) => s.snapshotId === snapshotId) ??
    null
  );
}

/**
 * Look up a checkpoint seed by its checkpoint_key.
 */
export function getCheckpointSeed(checkpointKey) {
  if (!checkpointKey) return null;
  return (
    EVENT_STREAM_CHECKPOINT_SEEDS.find(
      (c) => c.checkpointKey === checkpointKey,
    ) ?? null
  );
}

/**
 * Return all correlation links for a given correlation_id, OR — when
 * called with no argument — the full seed list (caller may filter).
 */
export function getCorrelationLinks(correlationId) {
  if (!correlationId) return EVENT_CORRELATION_LINK_SEEDS;
  return EVENT_CORRELATION_LINK_SEEDS.filter(
    (l) => l.correlationId === correlationId,
  );
}

/**
 * Return all event seeds for a given trace_id, in sequence order.
 */
export function getEventsForTrace(traceId) {
  if (!traceId) return [];
  return EVENT_STORE_SEEDS.filter((e) => e.traceId === traceId).sort(
    (a, b) => a.sequenceNumber - b.sequenceNumber,
  );
}

/**
 * Return the family definition that owns a given event_type, or null if
 * the event_type is not yet classified.
 */
export function getEventFamilyForEventType(eventType) {
  if (!eventType) return null;
  return (
    EVENT_STORE_EVENT_FAMILIES.find((f) =>
      f.eventTypes.includes(eventType),
    ) ?? null
  );
}

/**
 * Convenience lookups that fall back to the most conservative entry.
 */
export function getRuntimeExecutionState(key) {
  return (
    RUNTIME_EXECUTION_STATES.find((s) => s.key === key) ??
    RUNTIME_EXECUTION_STATES[0]
  );
}

export function getCheckpointStatus(key) {
  return (
    CHECKPOINT_STATUSES.find((s) => s.key === key) ?? CHECKPOINT_STATUSES[0]
  );
}

export function getCorrelationRelationType(key) {
  return (
    CORRELATION_RELATION_TYPES.find((r) => r.key === key) ??
    CORRELATION_RELATION_TYPES[0]
  );
}
