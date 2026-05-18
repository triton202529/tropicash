/**
 * Phase 3A — Execution Scenario Registry & Simulator Foundation.
 *
 * SIMULATION ONLY. This module:
 *   • does NOT execute money movement, mutate the database, or call any APIs
 *   • does NOT spawn background workers, schedulers, queues, retries,
 *     event emitters, or webhook dispatchers
 *   • does NOT connect Supabase realtime, network sockets, or external
 *     providers
 *   • does NOT touch treasury, wallet, withdrawal, PayPal, payout, or fraud
 *     execution logic — those subsystems are owned by other workstreams and
 *     remain entirely untouched
 *
 * Everything below is a deterministic, replayable, in-memory model. The
 * `build*` helpers consume a scenario seed and return plain JavaScript
 * objects shaped like the rows future Phase 2D/2E/2F infrastructure will
 * eventually persist. The Execution Simulator page renders those objects.
 *
 * Cross-phase references (string keys; no imports — keep this module
 * decoupled and free of circular references):
 *   • Phase 2D pipeline stage keys: identity_verified, environment_checked,
 *     capability_resolved, dependency_checked, policy_evaluated,
 *     constraint_evaluated, idempotency_checked, fraud_reviewed,
 *     audit_logged, execution_authorized, execution_blocked,
 *     post_execution_logged.
 *   • Phase 2E metric keys: latency_ms, policy_eval_time_ms,
 *     fraud_eval_time_ms, dependency_resolution_time_ms,
 *     audit_logging_time_ms, execution_duration_ms,
 *     environment_check_time_ms, policy_rules_evaluated,
 *     fraud_flags_checked, dependencies_resolved.
 *   • Phase 2F runtime execution states: planned, started, in_progress,
 *     review_required, authorized, blocked, completed, failed, cancelled.
 *   • Phase 2F checkpoint statuses: current, stale, rebuilding, failed,
 *     archived.
 */

export const EXECUTION_SCENARIO_PHASE = "phase_3a_execution_simulation";

// Stable simulation anchor. Every "occurred_at" timestamp in a generated
// trace is derived from this base plus the timeline entry's relative offset.
// Keeping it constant is what makes the simulator replayable.
export const EXECUTION_SIMULATION_BASE_TIMESTAMP =
  "2026-05-12T12:00:00.000Z";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export const EXECUTION_SCENARIO_CATEGORIES = [
  {
    key: "wallet",
    label: "Wallet",
    description:
      "Wallet-to-wallet movement, balance changes, and ledger writes.",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
    dotClass: "bg-emerald-500",
  },
  {
    key: "withdrawal",
    label: "Withdrawal",
    description:
      "Outbound transfers from a Tropicash wallet to an external destination.",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
    dotClass: "bg-sky-500",
  },
  {
    key: "trading",
    label: "Trading",
    description:
      "Trading-capital movement: funding, profit withdrawals, reservations.",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
    dotClass: "bg-amber-500",
  },
  {
    key: "merchant",
    label: "Merchant",
    description:
      "Merchant-side settlement and payout flows triggered by partner platforms.",
    badgeClass: "border border-violet-200 bg-violet-50 text-violet-800",
    dotClass: "bg-violet-500",
  },
  {
    key: "fraud",
    label: "Fraud",
    description:
      "Fraud-signal driven decisions: holds, escalations, and reviews.",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-800",
    dotClass: "bg-rose-500",
  },
  {
    key: "api",
    label: "API",
    description:
      "Developer-facing API request behavior — including non-success surfaces.",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
    dotClass: "bg-slate-500",
  },
  {
    key: "orchestration",
    label: "Orchestration",
    description:
      "Pipeline-level outcomes that exercise stages, decisions, and retries.",
    badgeClass: "border border-blue-200 bg-blue-50 text-blue-800",
    dotClass: "bg-blue-500",
  },
  {
    key: "integration",
    label: "Integration",
    description:
      "Cross-service correlation between Tropicash and Blue Atlantic platforms.",
    badgeClass: "border border-teal-200 bg-teal-50 text-teal-800",
    dotClass: "bg-teal-500",
  },
];

// ---------------------------------------------------------------------------
// Final states
// ---------------------------------------------------------------------------
export const EXECUTION_FINAL_STATES = [
  {
    key: "completed",
    label: "Completed",
    description: "Request walked the full pipeline and reached a terminal success.",
    terminal: true,
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
    dotClass: "bg-emerald-500",
  },
  {
    key: "review_required",
    label: "Review required",
    description:
      "Request paused at fraud review. Resumption is manual in the simulator.",
    terminal: false,
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
    dotClass: "bg-amber-500",
  },
  {
    key: "pending_review",
    label: "Pending review",
    description:
      "Request held before authorization. Requires manual approval to proceed.",
    terminal: false,
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
    dotClass: "bg-amber-500",
  },
  {
    key: "delayed",
    label: "Delayed",
    description:
      "Downstream settlement is deferred — request is parked, not failed.",
    terminal: false,
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
    dotClass: "bg-sky-500",
  },
  {
    key: "escalated",
    label: "Escalated",
    description:
      "Fraud signal triggered a human escalation. Pipeline stops mid-flight.",
    terminal: false,
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-800",
    dotClass: "bg-rose-500",
  },
  {
    key: "rate_limited",
    label: "Rate limited",
    description:
      "Caller exceeded an envelope budget. Request rejected at the gateway.",
    terminal: true,
    badgeClass: "border border-purple-200 bg-purple-50 text-purple-800",
    dotClass: "bg-purple-500",
  },
  {
    key: "retryable_failure",
    label: "Retryable failure",
    description:
      "A pipeline stage emitted a transient failure. Idempotency key remains valid.",
    terminal: false,
    badgeClass: "border border-orange-200 bg-orange-50 text-orange-900",
    dotClass: "bg-orange-500",
  },
];

// ---------------------------------------------------------------------------
// Timeline states — the per-step vocabulary for the simulator. These are
// distinct from Phase 2F's snapshot state enum: some Phase 3A states (like
// "resumed" or "synced") are visualization aids that map onto Phase 2F
// snapshot states via `snapshot_state` on each timeline entry.
// ---------------------------------------------------------------------------
export const EXECUTION_TIMELINE_STATES = [
  {
    key: "planned",
    label: "Planned",
    description: "Request envelope received; pipeline has not started.",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
    dotClass: "bg-slate-400",
  },
  {
    key: "authorized",
    label: "Authorized",
    description: "Identity + policy + idempotency checks passed.",
    badgeClass: "border border-blue-200 bg-blue-50 text-blue-800",
    dotClass: "bg-blue-500",
  },
  {
    key: "in_progress",
    label: "In progress",
    description: "Capability execution started.",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
    dotClass: "bg-sky-500",
  },
  {
    key: "review_required",
    label: "Review required",
    description: "Pipeline paused for fraud review.",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
    dotClass: "bg-amber-500",
  },
  {
    key: "resumed",
    label: "Resumed",
    description: "Review cleared; pipeline resumed from the pause point.",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
    dotClass: "bg-emerald-500",
  },
  {
    key: "completed",
    label: "Completed",
    description: "Pipeline reached a terminal success state.",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
    dotClass: "bg-emerald-500",
  },
  {
    key: "failed_retryable",
    label: "Failed (retryable)",
    description: "A stage emitted a transient failure; idempotency key preserved.",
    badgeClass: "border border-orange-200 bg-orange-50 text-orange-900",
    dotClass: "bg-orange-500",
  },
  {
    key: "delayed",
    label: "Delayed",
    description: "Downstream settlement deferred; pipeline parked.",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
    dotClass: "bg-sky-500",
  },
  {
    key: "escalated",
    label: "Escalated",
    description: "Fraud signal escalated for human review; pipeline stopped.",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-800",
    dotClass: "bg-rose-500",
  },
  {
    key: "rate_limited",
    label: "Rate limited",
    description: "Gateway rejected the call before any pipeline stage ran.",
    badgeClass: "border border-purple-200 bg-purple-50 text-purple-800",
    dotClass: "bg-purple-500",
  },
  {
    key: "synced",
    label: "Synced",
    description: "Cross-service reconciliation acknowledged by the downstream peer.",
    badgeClass: "border border-teal-200 bg-teal-50 text-teal-800",
    dotClass: "bg-teal-500",
  },
];

// ---------------------------------------------------------------------------
// Scenarios. Every scenario is fully deterministic — replaying the same
// scenario_key with the same environment always produces the same trace,
// events, snapshots, and checkpoints.
// ---------------------------------------------------------------------------
export const EXECUTION_SCENARIOS = [
  {
    scenario_key: "wallet.transfer.success",
    title: "Wallet transfer — success",
    category: "wallet",
    description:
      "A sandbox wallet-to-wallet transfer walks the full pipeline and settles cleanly.",
    environment: "sandbox",
    execution_duration_ms: 320,
    final_state: "completed",
    requires_review: false,
    emits_events: 6,
    orchestration_stages: [
      "identity_verified",
      "environment_checked",
      "capability_resolved",
      "dependency_checked",
      "policy_evaluated",
      "idempotency_checked",
      "fraud_reviewed",
      "execution_authorized",
      "audit_logged",
      "post_execution_logged",
    ],
    observability_signals: [
      "latency_ms",
      "policy_eval_time_ms",
      "fraud_eval_time_ms",
      "audit_logging_time_ms",
      "execution_duration_ms",
    ],
    checkpoint_progression: ["current", "current", "current"],
    correlation_targets: ["tropicash"],
    timeline: [
      {
        state_key: "planned",
        title: "Request envelope received",
        description:
          "Envelope queued for the pipeline; no stages have run yet.",
        relative_offset_ms: 0,
        emitted_event_types: ["execution.request_received"],
        snapshot_state: "planned",
        checkpoint_status: "current",
      },
      {
        state_key: "authorized",
        title: "Authorization passed",
        description:
          "Identity, environment, capability, policy and idempotency all cleared.",
        relative_offset_ms: 80,
        emitted_event_types: [
          "execution.identity_verified",
          "execution.policy_evaluated",
          "execution.execution_authorized",
        ],
        snapshot_state: "authorized",
        checkpoint_status: "current",
      },
      {
        state_key: "in_progress",
        title: "Execution started",
        description:
          "Wallet ledger move is in-flight (simulated; no real mutation).",
        relative_offset_ms: 180,
        emitted_event_types: ["money_movement.transfer_started"],
        snapshot_state: "in_progress",
        checkpoint_status: "current",
      },
      {
        state_key: "completed",
        title: "Execution completed",
        description:
          "Ledger move acknowledged. Audit row written. Pipeline closed.",
        relative_offset_ms: 320,
        emitted_event_types: [
          "money_movement.transfer_completed",
          "execution.audit_logged",
        ],
        snapshot_state: "completed",
        checkpoint_status: "current",
      },
    ],
  },
  {
    scenario_key: "wallet.transfer.review_required",
    title: "Wallet transfer — review required",
    category: "wallet",
    description:
      "Fraud signal pauses the pipeline mid-flight. Request waits for manual review.",
    environment: "sandbox",
    execution_duration_ms: 380,
    final_state: "review_required",
    requires_review: true,
    emits_events: 5,
    orchestration_stages: [
      "identity_verified",
      "environment_checked",
      "capability_resolved",
      "dependency_checked",
      "policy_evaluated",
      "fraud_reviewed",
    ],
    observability_signals: [
      "latency_ms",
      "policy_eval_time_ms",
      "fraud_eval_time_ms",
      "fraud_flags_checked",
    ],
    checkpoint_progression: ["current", "current", "rebuilding"],
    correlation_targets: ["tropicash"],
    timeline: [
      {
        state_key: "planned",
        title: "Request envelope received",
        description: "Envelope queued for the pipeline.",
        relative_offset_ms: 0,
        emitted_event_types: ["execution.request_received"],
        snapshot_state: "planned",
        checkpoint_status: "current",
      },
      {
        state_key: "authorized",
        title: "Authorization passed",
        description: "Identity and policy cleared.",
        relative_offset_ms: 90,
        emitted_event_types: [
          "execution.identity_verified",
          "execution.policy_evaluated",
        ],
        snapshot_state: "authorized",
        checkpoint_status: "current",
      },
      {
        state_key: "in_progress",
        title: "Pre-execution checks running",
        description: "Fraud evaluation is being performed.",
        relative_offset_ms: 220,
        emitted_event_types: ["fraud.evaluation_started"],
        snapshot_state: "in_progress",
        checkpoint_status: "current",
      },
      {
        state_key: "review_required",
        title: "Fraud review required",
        description:
          "Fraud signal exceeded threshold. Pipeline paused; awaiting reviewer.",
        relative_offset_ms: 380,
        emitted_event_types: ["fraud.review_required"],
        snapshot_state: "review_required",
        checkpoint_status: "rebuilding",
      },
    ],
  },
  {
    scenario_key: "withdrawal.pending_review",
    title: "Withdrawal — pending review",
    category: "withdrawal",
    description:
      "Withdrawal request is held before authorization until an admin approves.",
    environment: "sandbox",
    execution_duration_ms: 240,
    final_state: "pending_review",
    requires_review: true,
    emits_events: 4,
    orchestration_stages: [
      "identity_verified",
      "environment_checked",
      "capability_resolved",
      "policy_evaluated",
      "fraud_reviewed",
    ],
    observability_signals: [
      "latency_ms",
      "policy_eval_time_ms",
      "fraud_eval_time_ms",
    ],
    checkpoint_progression: ["current", "rebuilding"],
    correlation_targets: ["tropicash"],
    timeline: [
      {
        state_key: "planned",
        title: "Withdrawal envelope received",
        description: "Withdrawal request placed; pipeline not started.",
        relative_offset_ms: 0,
        emitted_event_types: ["execution.request_received"],
        snapshot_state: "planned",
        checkpoint_status: "current",
      },
      {
        state_key: "in_progress",
        title: "Policy + fraud checks running",
        description: "Pre-authorization checks are in-flight.",
        relative_offset_ms: 120,
        emitted_event_types: [
          "execution.policy_evaluated",
          "fraud.evaluation_started",
        ],
        snapshot_state: "in_progress",
        checkpoint_status: "current",
      },
      {
        state_key: "review_required",
        title: "Awaiting admin approval",
        description:
          "Withdrawal placed in pending_review state; pipeline parked.",
        relative_offset_ms: 240,
        emitted_event_types: ["fraud.review_required"],
        snapshot_state: "review_required",
        checkpoint_status: "rebuilding",
      },
    ],
  },
  {
    scenario_key: "withdrawal.completed",
    title: "Withdrawal — completed",
    category: "withdrawal",
    description:
      "Approved withdrawal walks the full pipeline and settles to the payout method.",
    environment: "sandbox",
    execution_duration_ms: 460,
    final_state: "completed",
    requires_review: false,
    emits_events: 7,
    orchestration_stages: [
      "identity_verified",
      "environment_checked",
      "capability_resolved",
      "dependency_checked",
      "policy_evaluated",
      "idempotency_checked",
      "fraud_reviewed",
      "execution_authorized",
      "audit_logged",
      "post_execution_logged",
    ],
    observability_signals: [
      "latency_ms",
      "policy_eval_time_ms",
      "fraud_eval_time_ms",
      "dependency_resolution_time_ms",
      "audit_logging_time_ms",
      "execution_duration_ms",
    ],
    checkpoint_progression: ["current", "current", "current", "current"],
    correlation_targets: ["tropicash"],
    timeline: [
      {
        state_key: "planned",
        title: "Withdrawal envelope received",
        description: "Withdrawal request placed; pipeline not started.",
        relative_offset_ms: 0,
        emitted_event_types: ["execution.request_received"],
        snapshot_state: "planned",
        checkpoint_status: "current",
      },
      {
        state_key: "authorized",
        title: "Authorization passed",
        description: "All pre-execution checks cleared.",
        relative_offset_ms: 140,
        emitted_event_types: [
          "execution.identity_verified",
          "execution.policy_evaluated",
          "execution.execution_authorized",
        ],
        snapshot_state: "authorized",
        checkpoint_status: "current",
      },
      {
        state_key: "in_progress",
        title: "Payout dispatched",
        description: "Payout method engaged (simulated).",
        relative_offset_ms: 260,
        emitted_event_types: ["money_movement.withdrawal_started"],
        snapshot_state: "in_progress",
        checkpoint_status: "current",
      },
      {
        state_key: "completed",
        title: "Withdrawal settled",
        description:
          "Settlement acknowledged. Audit row written. Pipeline closed.",
        relative_offset_ms: 460,
        emitted_event_types: [
          "money_movement.withdrawal_completed",
          "execution.audit_logged",
        ],
        snapshot_state: "completed",
        checkpoint_status: "current",
      },
    ],
  },
  {
    // Phase 3B pairs this key with a decision slice that stops at review_required
    // while this execution story still reaches completed — see Phase 3C alignment notes.
    scenario_key: "trading.profit_payout",
    title: "Trading profit payout",
    category: "trading",
    description:
      "Trading profits move from Triton into a Tropicash wallet via the integration bridge.",
    environment: "sandbox",
    execution_duration_ms: 520,
    final_state: "completed",
    requires_review: false,
    emits_events: 8,
    orchestration_stages: [
      "identity_verified",
      "environment_checked",
      "capability_resolved",
      "dependency_checked",
      "policy_evaluated",
      "constraint_evaluated",
      "idempotency_checked",
      "fraud_reviewed",
      "execution_authorized",
      "audit_logged",
      "post_execution_logged",
    ],
    observability_signals: [
      "latency_ms",
      "policy_eval_time_ms",
      "fraud_eval_time_ms",
      "dependency_resolution_time_ms",
      "execution_duration_ms",
      "dependencies_resolved",
    ],
    checkpoint_progression: ["current", "current", "current", "current"],
    correlation_targets: ["tropicash", "triton"],
    timeline: [
      {
        state_key: "planned",
        title: "Profit withdrawal envelope received",
        description: "Triton signals a pending profit withdrawal.",
        relative_offset_ms: 0,
        emitted_event_types: [
          "execution.request_received",
          "integration.triton_signal_received",
        ],
        snapshot_state: "planned",
        checkpoint_status: "current",
      },
      {
        state_key: "authorized",
        title: "Authorization passed",
        description:
          "Identity, policy, capability constraint and idempotency cleared.",
        relative_offset_ms: 160,
        emitted_event_types: [
          "execution.identity_verified",
          "execution.policy_evaluated",
          "execution.execution_authorized",
        ],
        snapshot_state: "authorized",
        checkpoint_status: "current",
      },
      {
        state_key: "in_progress",
        title: "Cross-service transfer in-flight",
        description:
          "Tropicash awaits Triton's transfer acknowledgement (simulated).",
        relative_offset_ms: 320,
        emitted_event_types: [
          "money_movement.transfer_started",
          "integration.triton_transfer_requested",
        ],
        snapshot_state: "in_progress",
        checkpoint_status: "current",
      },
      {
        state_key: "completed",
        title: "Profit settled into wallet",
        description:
          "Triton acknowledged the transfer. Wallet ledger updated. Audit row written.",
        relative_offset_ms: 520,
        emitted_event_types: [
          "money_movement.transfer_completed",
          "execution.audit_logged",
        ],
        snapshot_state: "completed",
        checkpoint_status: "current",
      },
    ],
  },
  {
    scenario_key: "merchant.settlement.delayed",
    title: "Merchant settlement — delayed",
    category: "merchant",
    description:
      "EliteHire Pro settlement is deferred. Tropicash parks the request without failing.",
    environment: "sandbox",
    execution_duration_ms: 420,
    final_state: "delayed",
    requires_review: false,
    emits_events: 5,
    orchestration_stages: [
      "identity_verified",
      "environment_checked",
      "capability_resolved",
      "dependency_checked",
      "policy_evaluated",
      "execution_authorized",
    ],
    observability_signals: [
      "latency_ms",
      "policy_eval_time_ms",
      "dependency_resolution_time_ms",
    ],
    checkpoint_progression: ["current", "current", "stale"],
    correlation_targets: ["tropicash", "elitehire_pro"],
    timeline: [
      {
        state_key: "planned",
        title: "Settlement envelope received",
        description: "EliteHire Pro requested an outbound settlement.",
        relative_offset_ms: 0,
        emitted_event_types: [
          "execution.request_received",
          "integration.elitehire_signal_received",
        ],
        snapshot_state: "planned",
        checkpoint_status: "current",
      },
      {
        state_key: "authorized",
        title: "Authorization passed",
        description: "Identity and policy cleared.",
        relative_offset_ms: 120,
        emitted_event_types: [
          "execution.identity_verified",
          "execution.execution_authorized",
        ],
        snapshot_state: "authorized",
        checkpoint_status: "current",
      },
      {
        state_key: "in_progress",
        title: "Settlement dispatched",
        description: "Outbound settlement requested.",
        relative_offset_ms: 260,
        emitted_event_types: ["money_movement.settlement_started"],
        snapshot_state: "in_progress",
        checkpoint_status: "current",
      },
      {
        state_key: "delayed",
        title: "Settlement delayed",
        description:
          "EliteHire Pro indicated the settlement window will be deferred. Request parked.",
        relative_offset_ms: 420,
        emitted_event_types: ["integration.elitehire_settlement_delayed"],
        snapshot_state: "in_progress",
        checkpoint_status: "stale",
      },
    ],
  },
  {
    scenario_key: "fraud.signal.escalated",
    title: "Fraud signal — escalated",
    category: "fraud",
    description:
      "Sentinel surfaces a high-risk signal mid-flight; the request is escalated.",
    environment: "sandbox",
    execution_duration_ms: 360,
    final_state: "escalated",
    requires_review: true,
    emits_events: 5,
    orchestration_stages: [
      "identity_verified",
      "environment_checked",
      "capability_resolved",
      "policy_evaluated",
      "fraud_reviewed",
      "execution_blocked",
    ],
    observability_signals: [
      "latency_ms",
      "policy_eval_time_ms",
      "fraud_eval_time_ms",
      "fraud_flags_checked",
    ],
    checkpoint_progression: ["current", "current", "failed"],
    correlation_targets: ["tropicash", "sentinel"],
    timeline: [
      {
        state_key: "planned",
        title: "Request envelope received",
        description: "Pipeline kicked off normally.",
        relative_offset_ms: 0,
        emitted_event_types: ["execution.request_received"],
        snapshot_state: "planned",
        checkpoint_status: "current",
      },
      {
        state_key: "in_progress",
        title: "Fraud evaluation in-flight",
        description: "Sentinel signal pulled into the evaluation step.",
        relative_offset_ms: 140,
        emitted_event_types: [
          "execution.policy_evaluated",
          "fraud.evaluation_started",
        ],
        snapshot_state: "in_progress",
        checkpoint_status: "current",
      },
      {
        state_key: "escalated",
        title: "Signal escalated by Sentinel",
        description:
          "High-risk signal acknowledged; request escalated and pipeline blocked.",
        relative_offset_ms: 360,
        emitted_event_types: [
          "fraud.signal_escalated",
          "execution.execution_blocked",
        ],
        snapshot_state: "blocked",
        checkpoint_status: "failed",
      },
    ],
  },
  {
    scenario_key: "api.request.rate_limited",
    title: "API request — rate limited",
    category: "api",
    description:
      "Gateway rejects the call before pipeline entry. No stages run, no events emitted downstream.",
    environment: "sandbox",
    execution_duration_ms: 40,
    final_state: "rate_limited",
    requires_review: false,
    emits_events: 2,
    orchestration_stages: [],
    observability_signals: ["latency_ms"],
    checkpoint_progression: ["current"],
    correlation_targets: ["tropicash"],
    timeline: [
      {
        state_key: "planned",
        title: "Request received at gateway",
        description: "Request envelope reached the gateway.",
        relative_offset_ms: 0,
        emitted_event_types: ["execution.request_received"],
        snapshot_state: "planned",
        checkpoint_status: "current",
      },
      {
        state_key: "rate_limited",
        title: "Rate limit triggered",
        description:
          "Envelope budget exceeded. Request rejected before any stage executed.",
        relative_offset_ms: 40,
        emitted_event_types: ["execution.execution_blocked"],
        snapshot_state: "blocked",
        checkpoint_status: "current",
      },
    ],
  },
  {
    scenario_key: "orchestration.stage.retryable_failure",
    title: "Orchestration stage — retryable failure",
    category: "orchestration",
    description:
      "A pipeline stage emits a transient failure. The idempotency key is preserved for retry.",
    environment: "sandbox",
    execution_duration_ms: 280,
    final_state: "retryable_failure",
    requires_review: false,
    emits_events: 4,
    orchestration_stages: [
      "identity_verified",
      "environment_checked",
      "capability_resolved",
      "dependency_checked",
    ],
    observability_signals: [
      "latency_ms",
      "dependency_resolution_time_ms",
      "dependencies_resolved",
    ],
    checkpoint_progression: ["current", "rebuilding"],
    correlation_targets: ["tropicash"],
    timeline: [
      {
        state_key: "planned",
        title: "Request envelope received",
        description: "Pipeline started.",
        relative_offset_ms: 0,
        emitted_event_types: ["execution.request_received"],
        snapshot_state: "planned",
        checkpoint_status: "current",
      },
      {
        state_key: "in_progress",
        title: "Dependency resolution in-flight",
        description: "Pipeline reached the dependency_checked stage.",
        relative_offset_ms: 140,
        emitted_event_types: ["execution.identity_verified"],
        snapshot_state: "in_progress",
        checkpoint_status: "current",
      },
      {
        state_key: "failed_retryable",
        title: "Transient dependency failure",
        description:
          "Dependency stage failed transiently. Idempotency key remains valid for retry.",
        relative_offset_ms: 280,
        emitted_event_types: ["execution.execution_blocked"],
        snapshot_state: "failed",
        checkpoint_status: "rebuilding",
      },
    ],
  },
  {
    scenario_key: "integration.sync.completed",
    title: "Integration sync — completed",
    category: "integration",
    description:
      "Tropicash reports completed executions into Sentinel and reconciles with Triton.",
    environment: "sandbox",
    execution_duration_ms: 500,
    final_state: "completed",
    requires_review: false,
    emits_events: 7,
    orchestration_stages: [
      "identity_verified",
      "environment_checked",
      "capability_resolved",
      "dependency_checked",
      "policy_evaluated",
      "audit_logged",
      "post_execution_logged",
    ],
    observability_signals: [
      "latency_ms",
      "audit_logging_time_ms",
      "execution_duration_ms",
    ],
    checkpoint_progression: ["current", "current", "current", "archived"],
    correlation_targets: ["tropicash", "triton", "sentinel"],
    timeline: [
      {
        state_key: "planned",
        title: "Sync envelope received",
        description: "Scheduled reconciliation kicked off.",
        relative_offset_ms: 0,
        emitted_event_types: ["execution.request_received"],
        snapshot_state: "planned",
        checkpoint_status: "current",
      },
      {
        state_key: "authorized",
        title: "Authorization passed",
        description: "Internal sync identity and policy cleared.",
        relative_offset_ms: 120,
        emitted_event_types: [
          "execution.identity_verified",
          "execution.policy_evaluated",
        ],
        snapshot_state: "authorized",
        checkpoint_status: "current",
      },
      {
        state_key: "in_progress",
        title: "Cross-service reconciliation in-flight",
        description: "Sentinel + Triton acknowledgements pending.",
        relative_offset_ms: 280,
        emitted_event_types: [
          "integration.triton_reconciliation_started",
          "integration.sentinel_report_started",
        ],
        snapshot_state: "in_progress",
        checkpoint_status: "current",
      },
      {
        state_key: "synced",
        title: "Sync completed",
        description:
          "Both peers acknowledged. Audit row written. Cursor archived.",
        relative_offset_ms: 500,
        emitted_event_types: [
          "integration.sync_completed",
          "execution.audit_logged",
        ],
        snapshot_state: "completed",
        checkpoint_status: "archived",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Safety rules — surfaced on the Execution Simulator page so reviewers can
// confirm what the simulator does NOT do.
// ---------------------------------------------------------------------------
export const EXECUTION_SIMULATION_SAFETY_RULES = [
  "The Execution Simulator is a deterministic, in-memory visualization. It never writes to Supabase, never calls an external service, and never moves real money.",
  "Generating a simulation does not register events, sessions, snapshots, checkpoints, or correlation links in any Phase 2A–2F table.",
  "Replaying a timeline does not retry, dispatch, or repeat any real-world side effect — the only thing that changes is what the page renders.",
  "Resetting a simulation only clears local React state. It cannot affect any other user, environment, or row in the database.",
  "Every timestamp is derived from a fixed base anchor plus a static offset. There is no clock-driven behavior, no Date.now(), no Math.random(), and no network access.",
  "The simulator only operates in the sandbox environment label. Live scenarios are intentionally absent in Phase 3A.",
  "The simulator depends on no real-time, no service worker, no background job, and no long-running process.",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getScenarioCategory(key) {
  return (
    EXECUTION_SCENARIO_CATEGORIES.find((c) => c.key === key) ??
    EXECUTION_SCENARIO_CATEGORIES[EXECUTION_SCENARIO_CATEGORIES.length - 1]
  );
}

export function getFinalState(key) {
  return (
    EXECUTION_FINAL_STATES.find((s) => s.key === key) ??
    EXECUTION_FINAL_STATES[0]
  );
}

export function getTimelineState(key) {
  return (
    EXECUTION_TIMELINE_STATES.find((s) => s.key === key) ??
    EXECUTION_TIMELINE_STATES[0]
  );
}

export function getScenarioByKey(key) {
  return EXECUTION_SCENARIOS.find((s) => s.scenario_key === key) ?? null;
}

export function getScenarioTimeline(scenarioOrKey) {
  const scenario =
    typeof scenarioOrKey === "string"
      ? getScenarioByKey(scenarioOrKey)
      : scenarioOrKey;
  return scenario?.timeline ?? [];
}

/**
 * Derive a deterministic trace envelope for a scenario.
 *
 * The returned shape mirrors what a future Phase 2F event-store row + Phase
 * 2E execution-session row would look like, without persisting anything.
 */
export function buildScenarioTrace(scenarioOrKey, environmentOverride) {
  const scenario =
    typeof scenarioOrKey === "string"
      ? getScenarioByKey(scenarioOrKey)
      : scenarioOrKey;
  if (!scenario) return null;

  const environment = environmentOverride ?? scenario.environment ?? "sandbox";
  const slug = scenario.scenario_key.replace(/\./g, "_");
  const baseMs = Date.parse(EXECUTION_SIMULATION_BASE_TIMESTAMP);

  const started_at = new Date(baseMs).toISOString();
  const completed_at = new Date(
    baseMs + scenario.execution_duration_ms,
  ).toISOString();

  return {
    trace_id: `trace_3a_${slug}_demo`,
    execution_session_id: `sess_3a_${slug}_demo`,
    scenario_key: scenario.scenario_key,
    environment,
    final_state: scenario.final_state,
    requires_review: scenario.requires_review,
    started_at,
    completed_at,
    duration_ms: scenario.execution_duration_ms,
    sequence_count: scenario.timeline.reduce(
      (acc, entry) => acc + (entry.emitted_event_types?.length ?? 0),
      0,
    ),
    orchestration_stages: scenario.orchestration_stages,
    observability_signals: scenario.observability_signals,
    correlation_targets: scenario.correlation_targets,
  };
}

/**
 * Build a deterministic sequence of synthetic events for a scenario. Each
 * event mirrors the shape of a Phase 2F internal_event_store row without
 * touching the database. Sequence numbers start at 1 and increase across
 * the full scenario, matching the (trace_id, sequence_number) uniqueness
 * constraint defined in Phase 2F.
 */
export function buildScenarioEvents(scenarioOrKey, environmentOverride) {
  const scenario =
    typeof scenarioOrKey === "string"
      ? getScenarioByKey(scenarioOrKey)
      : scenarioOrKey;
  if (!scenario) return [];

  const environment = environmentOverride ?? scenario.environment ?? "sandbox";
  const slug = scenario.scenario_key.replace(/\./g, "_");
  const traceId = `trace_3a_${slug}_demo`;
  const correlationId = `corr_3a_${slug}_demo`;
  const baseMs = Date.parse(EXECUTION_SIMULATION_BASE_TIMESTAMP);

  const events = [];
  let sequence = 0;
  let lastEventId = null;

  scenario.timeline.forEach((entry, entryIdx) => {
    const occurredAtMs = baseMs + entry.relative_offset_ms;
    (entry.emitted_event_types ?? []).forEach((eventType, eventIdx) => {
      sequence += 1;
      const eventId = `evt_3a_${slug}_${String(sequence).padStart(3, "0")}`;
      const family = eventType.includes(".") ? eventType.split(".")[0] : "execution";

      events.push({
        event_id: eventId,
        event_type: eventType,
        event_family: family,
        trace_id: traceId,
        sequence_number: sequence,
        parent_event_id: lastEventId,
        correlation_id: correlationId,
        execution_session_id: `sess_3a_${slug}_demo`,
        environment,
        snapshot_state: entry.snapshot_state,
        timeline_state: entry.state_key,
        timeline_entry_index: entryIdx,
        emitted_within_entry_index: eventIdx,
        occurred_at: new Date(occurredAtMs).toISOString(),
        metadata: {
          source: "phase_3a_simulator",
          scenario_key: scenario.scenario_key,
          timeline_title: entry.title,
        },
      });
      lastEventId = eventId;
    });
  });

  return events;
}

/**
 * Build a deterministic sequence of derived state snapshots. Snapshot
 * versions advance per timeline entry. The shape mirrors a Phase 2F
 * internal_runtime_state_snapshots row.
 */
export function buildScenarioSnapshots(scenarioOrKey, environmentOverride) {
  const scenario =
    typeof scenarioOrKey === "string"
      ? getScenarioByKey(scenarioOrKey)
      : scenarioOrKey;
  if (!scenario) return [];

  const environment = environmentOverride ?? scenario.environment ?? "sandbox";
  const slug = scenario.scenario_key.replace(/\./g, "_");
  const traceId = `trace_3a_${slug}_demo`;
  const baseMs = Date.parse(EXECUTION_SIMULATION_BASE_TIMESTAMP);

  return scenario.timeline.map((entry, idx) => {
    const version = idx + 1;
    const occurredAtMs = baseMs + entry.relative_offset_ms;
    return {
      snapshot_id: `snap_3a_${slug}_v${String(version).padStart(2, "0")}`,
      execution_session_id: `sess_3a_${slug}_demo`,
      trace_id: traceId,
      version,
      timeline_state: entry.state_key,
      current_execution_state: entry.snapshot_state,
      environment,
      derived_at: new Date(occurredAtMs).toISOString(),
      timeline_title: entry.title,
      state_payload: {
        source: "phase_3a_simulator",
        scenario_key: scenario.scenario_key,
        timeline_index: idx,
      },
    };
  });
}

/**
 * Build a deterministic sequence of checkpoint cursors that advance with
 * the timeline. Shape mirrors a Phase 2F internal_event_stream_checkpoints
 * row. We emit one checkpoint per timeline entry so the simulator can show
 * cursor movement visually.
 */
export function buildScenarioCheckpoints(scenarioOrKey, environmentOverride) {
  const scenario =
    typeof scenarioOrKey === "string"
      ? getScenarioByKey(scenarioOrKey)
      : scenarioOrKey;
  if (!scenario) return [];

  const environment = environmentOverride ?? scenario.environment ?? "sandbox";
  const slug = scenario.scenario_key.replace(/\./g, "_");
  const traceId = `trace_3a_${slug}_demo`;
  const baseMs = Date.parse(EXECUTION_SIMULATION_BASE_TIMESTAMP);

  let runningSequence = 0;
  let lastEventId = null;

  return scenario.timeline.map((entry, idx) => {
    runningSequence += entry.emitted_event_types?.length ?? 0;
    if (runningSequence > 0) {
      lastEventId = `evt_3a_${slug}_${String(runningSequence).padStart(3, "0")}`;
    }
    const occurredAtMs = baseMs + entry.relative_offset_ms;
    return {
      checkpoint_key: `chk_3a_${slug}_${String(idx + 1).padStart(2, "0")}`,
      trace_id: traceId,
      last_sequence_number: runningSequence,
      last_event_id: lastEventId,
      checkpoint_status: entry.checkpoint_status,
      timeline_state: entry.state_key,
      environment,
      updated_at: new Date(occurredAtMs).toISOString(),
    };
  });
}

/**
 * Convenience helper: produce a full simulation in one call. Returns the
 * trace envelope plus events, snapshots, and checkpoints — all from the
 * same deterministic seed.
 */
export function buildScenarioSimulation(scenarioOrKey, environmentOverride) {
  const scenario =
    typeof scenarioOrKey === "string"
      ? getScenarioByKey(scenarioOrKey)
      : scenarioOrKey;
  if (!scenario) return null;
  return {
    scenario,
    trace: buildScenarioTrace(scenario, environmentOverride),
    events: buildScenarioEvents(scenario, environmentOverride),
    snapshots: buildScenarioSnapshots(scenario, environmentOverride),
    checkpoints: buildScenarioCheckpoints(scenario, environmentOverride),
  };
}

// ---------------------------------------------------------------------------
// Deterministic mock observability values. These are NOT measured — they
// are derived from the scenario's static description so the same scenario
// always reports the same numbers. No clock, no random source, no I/O.
// ---------------------------------------------------------------------------
export function getMockObservabilityForScenario(scenarioOrKey) {
  const scenario =
    typeof scenarioOrKey === "string"
      ? getScenarioByKey(scenarioOrKey)
      : scenarioOrKey;
  if (!scenario) {
    return {
      latency_ms: 0,
      replay_count: 0,
      checkpoint_health: "unknown",
      review_duration_ms: 0,
    };
  }

  const duration = scenario.execution_duration_ms;
  const events = scenario.timeline.reduce(
    (acc, entry) => acc + (entry.emitted_event_types?.length ?? 0),
    0,
  );

  // Replay count = scenario complexity proxy: 1 baseline plus a deterministic
  // bump for review/escalation paths so reviewer-heavy scenarios stand out.
  const replayBump = scenario.requires_review ? 2 : 0;
  const replay_count = 1 + Math.min(events, 6) + replayBump;

  // Checkpoint health = derived from the final checkpoint in the progression.
  const finalCheckpoint =
    scenario.checkpoint_progression?.[
      scenario.checkpoint_progression.length - 1
    ] ?? "current";
  const checkpoint_health =
    finalCheckpoint === "current"
      ? "healthy"
      : finalCheckpoint === "archived"
        ? "archived"
        : finalCheckpoint === "stale"
          ? "stale"
          : finalCheckpoint === "failed"
            ? "needs_attention"
            : "rebuilding";

  // Review duration only applies when a review state appears; otherwise 0.
  const review_duration_ms = scenario.requires_review
    ? Math.max(duration - 80, 0)
    : 0;

  return {
    latency_ms: duration,
    replay_count,
    checkpoint_health,
    review_duration_ms,
  };
}
