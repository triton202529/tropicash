/**
 * Tropicash Developer Platform — Phase 2E:
 * Observability & Runtime Telemetry Blueprint config.
 *
 * Pure planning data layered on top of Phase 2A (registry), Phase 2B
 * (governance), Phase 2C (capability registry), and Phase 2D (execution
 * orchestration). Mirrors
 * supabase/sql/internal_observability_phase2e.sql.
 *
 * THIS FILE IS OBSERVABILITY ARCHITECTURE ONLY. It does NOT:
 *   • create real telemetry pipelines or runtime emitters
 *   • create real public or internal money-moving APIs
 *   • create monitoring daemons
 *   • create API keys, service tokens, or secrets
 *   • move money
 *   • modify treasury, wallet, withdrawal, PayPal funding, or fraud logic
 *
 * The canonical narrative lives in docs/internal-service-blueprint.md
 * (Phase 2E section). When the exports below change materially, update
 * that doc and the SQL migration in the same PR.
 */

export const INTERNAL_OBSERVABILITY_PHASE = "phase_2e_observability";

/**
 * Execution session statuses. Mirrors the execution_status check
 * constraint on internal_execution_sessions.
 */
export const EXECUTION_STATUS_TYPES = [
  {
    key: "planned",
    label: "Planned",
    description:
      "Session envelope reserved but the orchestrator has not yet started.",
    dotClass: "bg-sky-500",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    key: "started",
    label: "Started",
    description: "Orchestrator picked the session up; first stage is running.",
    dotClass: "bg-indigo-500",
    badgeClass: "border border-indigo-200 bg-indigo-50 text-indigo-800",
  },
  {
    key: "in_progress",
    label: "In progress",
    description: "Pipeline is between non-terminal stages.",
    dotClass: "bg-blue-500",
    badgeClass: "border border-blue-200 bg-blue-50 text-blue-800",
  },
  {
    key: "review_required",
    label: "Review required",
    description:
      "Pipeline paused awaiting human or admin review (e.g. payout manual review).",
    dotClass: "bg-amber-500",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    key: "completed",
    label: "Completed",
    description:
      "Pipeline reached execution_authorized and the executor finished cleanly.",
    dotClass: "bg-emerald-500",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    key: "failed",
    label: "Failed",
    description:
      "Executor authorized the call but it failed during execution.",
    dotClass: "bg-rose-500",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-900",
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
    key: "cancelled",
    label: "Cancelled",
    description:
      "Caller or admin cancelled the session before it could complete.",
    dotClass: "bg-slate-400",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
];

/**
 * Metric categories. Mirrors the metric_category check constraint on
 * internal_execution_metrics.
 */
export const EXECUTION_METRIC_CATEGORIES = [
  {
    key: "latency",
    label: "Latency",
    description: "End-to-end pipeline timing.",
    accent: "#0ea5e9",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    key: "policy",
    label: "Policy",
    description:
      "Policy stage timing and counts (rules evaluated, failures, etc.).",
    accent: "#7c3aed",
    badgeClass: "border border-violet-200 bg-violet-50 text-violet-900",
  },
  {
    key: "fraud",
    label: "Fraud",
    description:
      "Fraud stage timing and counts (flags checked, reviews opened, etc.).",
    accent: "#be123c",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-900",
  },
  {
    key: "dependency",
    label: "Dependency",
    description: "Dependency-resolution timing and counts.",
    accent: "#f97316",
    badgeClass: "border border-orange-200 bg-orange-50 text-orange-900",
  },
  {
    key: "execution",
    label: "Execution",
    description: "Executor invocation timing.",
    accent: "#16a34a",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    key: "audit",
    label: "Audit",
    description: "Audit-stage timing (pre- and post-execution).",
    accent: "#475569",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    key: "environment",
    label: "Environment",
    description: "Environment-resolution timing and routing decisions.",
    accent: "#0f766e",
    badgeClass: "border border-teal-200 bg-teal-50 text-teal-900",
  },
];

/**
 * Failure categories. Mirrors the failure_category check constraint on
 * internal_execution_failures.
 */
export const EXECUTION_FAILURE_CATEGORIES = [
  {
    key: "policy_failure",
    label: "Policy failure",
    description:
      "A required Phase 2D policy rule did not pass at policy_evaluated.",
    accent: "#7c3aed",
    badgeClass: "border border-violet-200 bg-violet-50 text-violet-900",
  },
  {
    key: "dependency_failure",
    label: "Dependency failure",
    description:
      "A Phase 2C requires / blocks_without dependency could not be resolved.",
    accent: "#a21caf",
    badgeClass: "border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
  },
  {
    key: "environment_failure",
    label: "Environment failure",
    description:
      "Environment mismatch or sandbox-only capability invoked in live.",
    accent: "#0ea5e9",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    key: "fraud_block",
    label: "Fraud block",
    description: "Fraud engine emitted a block or review-required verdict.",
    accent: "#be123c",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-900",
  },
  {
    key: "idempotency_conflict",
    label: "Idempotency conflict",
    description:
      "Duplicate idempotency key collided with a divergent payload.",
    accent: "#0f766e",
    badgeClass: "border border-teal-200 bg-teal-50 text-teal-900",
  },
  {
    key: "constraint_violation",
    label: "Constraint violation",
    description:
      "A Phase 2C operational constraint (limit, sandbox_only, manual_review) was violated.",
    accent: "#f97316",
    badgeClass: "border border-orange-200 bg-orange-50 text-orange-900",
  },
  {
    key: "runtime_exception",
    label: "Runtime exception",
    description:
      "Unhandled exception inside the future executor terminated the pipeline.",
    accent: "#dc2626",
    badgeClass: "border border-red-200 bg-red-50 text-red-900",
  },
  {
    key: "audit_failure",
    label: "Audit failure",
    description:
      "Pre- or post-execution audit record could not be written; pipeline aborts.",
    accent: "#475569",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
];

/**
 * Failure severity scale. Same vocabulary as Phase 2A/2C risk levels and
 * Phase 2D policy severities.
 */
export const EXECUTION_FAILURE_SEVERITIES = [
  {
    key: "low",
    label: "Low",
    description: "Recoverable; informational.",
    dotClass: "bg-slate-400",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
    order: 1,
  },
  {
    key: "medium",
    label: "Medium",
    description: "Operational. Worth investigating; pipeline likely terminated.",
    dotClass: "bg-amber-500",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
    order: 2,
  },
  {
    key: "high",
    label: "High",
    description:
      "Money-relevant failure. Pipeline terminated; pages an oncall.",
    dotClass: "bg-orange-500",
    badgeClass: "border border-orange-200 bg-orange-50 text-orange-900",
    order: 3,
  },
  {
    key: "critical",
    label: "Critical",
    description:
      "Highest severity. Halts the pipeline and pages an admin / fraud reviewer.",
    dotClass: "bg-red-500",
    badgeClass: "border border-red-200 bg-red-50 text-red-900",
    order: 4,
  },
];

/**
 * Replay scopes. Mirrors the replay_scope check constraint on
 * internal_execution_replay_templates.
 */
export const EXECUTION_REPLAY_SCOPES = [
  {
    key: "session",
    label: "Session",
    description: "Replays a single execution session by execution_session_id.",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    key: "trace",
    label: "Trace",
    description:
      "Replays every session attached to a single trace_id (e.g. retries).",
    badgeClass: "border border-indigo-200 bg-indigo-50 text-indigo-800",
  },
  {
    key: "pipeline",
    label: "Pipeline",
    description: "Replays only the Phase 2D pipeline stages, not the executor.",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    key: "audit",
    label: "Audit",
    description: "Replays only audit_logged / post_execution_logged stages.",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    key: "full_execution",
    label: "Full execution",
    description:
      "Replays every replayable stage (executor side-effects are NEVER replayed).",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
];

// ---------------------------------------------------------------------------
// Seeded rows — mirror the SQL seed block.
// ---------------------------------------------------------------------------

/**
 * Demo execution sessions. All `planned` in `sandbox`. service_key
 * references the Phase 2A registry; capability_key references the Phase
 * 2C capability registry.
 */
export const EXECUTION_SESSION_SEEDS = [
  {
    executionSessionId: "sess_2e_payment_create_demo",
    traceId: "trace_2e_payment_create_demo",
    requestId: "req_2e_payment_create_demo",
    serviceKey: "elitehire_pro",
    capabilityKey: "payment.create",
    environment: "sandbox",
    executionStatus: "planned",
    metadata: {
      source: "phase_2e_seed",
      purpose:
        "Demo session envelope for the payment.create trace template.",
    },
  },
  {
    executionSessionId: "sess_2e_payout_release_demo",
    traceId: "trace_2e_payout_release_demo",
    requestId: "req_2e_payout_release_demo",
    serviceKey: "elitehire_pro",
    capabilityKey: "payout.release",
    environment: "sandbox",
    executionStatus: "planned",
    metadata: {
      source: "phase_2e_seed",
      purpose:
        "Demo session envelope for the payout.release trace template.",
    },
  },
  {
    executionSessionId: "sess_2e_trading_profit_withdraw_demo",
    traceId: "trace_2e_trading_profit_withdraw_demo",
    requestId: "req_2e_trading_profit_withdraw_demo",
    serviceKey: "triton",
    capabilityKey: "trading.profit_withdraw",
    environment: "sandbox",
    executionStatus: "planned",
    metadata: {
      source: "phase_2e_seed",
      purpose:
        "Demo session envelope for the trading.profit_withdraw trace template.",
    },
  },
];

/**
 * Canonical metric definitions. Phase 2E seeds them with metricValue=0
 * against the payment.create demo session.
 */
export const EXECUTION_METRIC_SEEDS = [
  {
    executionSessionId: "sess_2e_payment_create_demo",
    metricKey: "latency_ms",
    metricLabel: "Total request latency",
    metricValue: 0,
    metricUnit: "ms",
    metricCategory: "latency",
    environment: "sandbox",
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    metricKey: "policy_eval_time_ms",
    metricLabel: "Policy evaluation time",
    metricValue: 0,
    metricUnit: "ms",
    metricCategory: "policy",
    environment: "sandbox",
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    metricKey: "fraud_eval_time_ms",
    metricLabel: "Fraud evaluation time",
    metricValue: 0,
    metricUnit: "ms",
    metricCategory: "fraud",
    environment: "sandbox",
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    metricKey: "dependency_resolution_time_ms",
    metricLabel: "Dependency resolution time",
    metricValue: 0,
    metricUnit: "ms",
    metricCategory: "dependency",
    environment: "sandbox",
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    metricKey: "audit_logging_time_ms",
    metricLabel: "Audit logging time",
    metricValue: 0,
    metricUnit: "ms",
    metricCategory: "audit",
    environment: "sandbox",
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    metricKey: "execution_duration_ms",
    metricLabel: "Execution duration",
    metricValue: 0,
    metricUnit: "ms",
    metricCategory: "execution",
    environment: "sandbox",
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    metricKey: "environment_check_time_ms",
    metricLabel: "Environment check time",
    metricValue: 0,
    metricUnit: "ms",
    metricCategory: "environment",
    environment: "sandbox",
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    metricKey: "policy_rules_evaluated",
    metricLabel: "Policy rules evaluated",
    metricValue: 0,
    metricUnit: "count",
    metricCategory: "policy",
    environment: "sandbox",
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    metricKey: "fraud_flags_checked",
    metricLabel: "Fraud flags checked",
    metricValue: 0,
    metricUnit: "count",
    metricCategory: "fraud",
    environment: "sandbox",
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    metricKey: "dependencies_resolved",
    metricLabel: "Dependencies resolved",
    metricValue: 0,
    metricUnit: "count",
    metricCategory: "dependency",
    environment: "sandbox",
  },
];

/**
 * Canonical failure taxonomy. stageKey / policyRuleKey / decisionKey
 * reference Phase 2D rows by key.
 */
export const EXECUTION_FAILURE_SEEDS = [
  {
    executionSessionId: "sess_2e_payment_create_demo",
    failureKey: "policy_not_satisfied",
    failureCategory: "policy_failure",
    severity: "high",
    stageKey: "policy_evaluated",
    policyRuleKey: "requires_idempotency",
    decisionKey: "policy_not_satisfied",
    environment: "sandbox",
    isTerminal: true,
    metadata: {
      source: "phase_2e_seed",
      purpose: "Required policy rule did not pass.",
    },
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    failureKey: "dependency_missing",
    failureCategory: "dependency_failure",
    severity: "high",
    stageKey: "dependency_checked",
    policyRuleKey: "requires_dependency_resolution",
    decisionKey: "dependency_missing",
    environment: "sandbox",
    isTerminal: true,
    metadata: {
      source: "phase_2e_seed",
      purpose:
        "A Phase 2C requires/blocks_without dependency did not resolve.",
    },
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    failureKey: "sandbox_only_block",
    failureCategory: "environment_failure",
    severity: "medium",
    stageKey: "environment_checked",
    policyRuleKey: "sandbox_only",
    decisionKey: "sandbox_only",
    environment: "sandbox",
    isTerminal: true,
    metadata: {
      source: "phase_2e_seed",
      purpose:
        "Live invocation of a sandbox-only capability terminates at environment_checked.",
    },
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    failureKey: "fraud_review_required",
    failureCategory: "fraud_block",
    severity: "critical",
    stageKey: "fraud_reviewed",
    policyRuleKey: "requires_fraud_review",
    decisionKey: "review_required",
    environment: "sandbox",
    isTerminal: false,
    metadata: {
      source: "phase_2e_seed",
      purpose:
        "Fraud engine paused the pipeline pending human review.",
    },
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    failureKey: "idempotency_key_conflict",
    failureCategory: "idempotency_conflict",
    severity: "high",
    stageKey: "idempotency_checked",
    policyRuleKey: "requires_idempotency",
    decisionKey: "blocked",
    environment: "sandbox",
    isTerminal: true,
    metadata: {
      source: "phase_2e_seed",
      purpose:
        "Duplicate idempotency key collided with a divergent payload; pipeline must terminate.",
    },
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    failureKey: "constraint_limit_exceeded",
    failureCategory: "constraint_violation",
    severity: "high",
    stageKey: "constraint_evaluated",
    policyRuleKey: "max_transaction_amount",
    decisionKey: "limit_exceeded",
    environment: "sandbox",
    isTerminal: true,
    metadata: {
      source: "phase_2e_seed",
      purpose: "A Phase 2C operational constraint limit was exceeded.",
    },
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    failureKey: "runtime_processing_exception",
    failureCategory: "runtime_exception",
    severity: "critical",
    stageKey: "execution_authorized",
    policyRuleKey: null,
    decisionKey: "execution_blocked",
    environment: "sandbox",
    isTerminal: true,
    metadata: {
      source: "phase_2e_seed",
      purpose:
        "Unhandled exception inside the future executor terminated the pipeline.",
    },
  },
  {
    executionSessionId: "sess_2e_payment_create_demo",
    failureKey: "audit_pipeline_failure",
    failureCategory: "audit_failure",
    severity: "high",
    stageKey: "audit_logged",
    policyRuleKey: "requires_audit_record",
    decisionKey: "blocked",
    environment: "sandbox",
    isTerminal: true,
    metadata: {
      source: "phase_2e_seed",
      purpose:
        "The pre-execution audit record could not be written; pipeline aborts.",
    },
  },
];

/**
 * Replay templates. One per high-risk capability. All
 * lifecycleStatus='defined', replayScope='full_execution'. The
 * `replayStructure` is the parsed JSONB payload — kept inline so the UI
 * can render it without a JSON parse step.
 */
export const EXECUTION_REPLAY_TEMPLATES = [
  {
    replayKey: "payment_create_replay",
    replayLabel: "payment.create replay",
    capabilityKey: "payment.create",
    replayScope: "full_execution",
    lifecycleStatus: "defined",
    replayStructure: {
      replayable_stages: [
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
      ],
      reconstructable_events: [
        "execution.started",
        "execution.policy_evaluated",
        "execution.constraint_evaluated",
        "execution.fraud_reviewed",
        "execution.audit_logged",
        "execution.completed",
      ],
      terminal_states: ["execution_authorized", "execution_blocked"],
      redacted_fields: ["amount", "wallet_balance", "payer_pii"],
    },
    description:
      "Replay blueprint for payment.create. The future replay engine may reconstruct every stage up to (but not including) execution_authorized; the actual executor side-effect is never replayed.",
  },
  {
    replayKey: "payout_release_replay",
    replayLabel: "payout.release replay",
    capabilityKey: "payout.release",
    replayScope: "full_execution",
    lifecycleStatus: "defined",
    replayStructure: {
      replayable_stages: [
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
      ],
      reconstructable_events: [
        "execution.started",
        "execution.dependency_checked",
        "execution.policy_evaluated",
        "execution.review_required",
        "execution.fraud_reviewed",
        "execution.audit_logged",
        "execution.completed",
      ],
      terminal_states: ["execution_authorized", "execution_blocked"],
      review_states: ["review_required"],
      redacted_fields: ["amount", "destination_account", "treasury_balance"],
    },
    description:
      "Replay blueprint for payout.release. Includes a review_required pause because Phase 2C requires manual review and treasury approval.",
  },
  {
    replayKey: "trading_profit_withdraw_replay",
    replayLabel: "trading.profit_withdraw replay",
    capabilityKey: "trading.profit_withdraw",
    replayScope: "full_execution",
    lifecycleStatus: "defined",
    replayStructure: {
      replayable_stages: [
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
      ],
      reconstructable_events: [
        "execution.started",
        "execution.environment_checked",
        "execution.policy_evaluated",
        "execution.fraud_reviewed",
        "execution.audit_logged",
        "execution.completed",
      ],
      terminal_states: ["execution_authorized", "execution_blocked"],
      redacted_fields: ["amount", "trading_account", "wallet_balance"],
    },
    description:
      "Replay blueprint for trading.profit_withdraw. The Phase 2C sandbox_only constraint is replayable at environment_checked; live invocations are recorded as terminal blocks.",
  },
];

/**
 * Planned operational dashboards. Phase 2E only describes them; no
 * dashboard backend, query layer, or UI render path exists yet.
 */
export const OBSERVABILITY_DASHBOARD_PREVIEWS = [
  {
    key: "execution_health",
    label: "Execution health",
    description:
      "Per-environment, per-capability success vs. failure rate over the last 1h / 24h / 7d.",
    accent: "#16a34a",
    icon: "❤️",
  },
  {
    key: "policy_failure_trends",
    label: "Policy failure trends",
    description:
      "Top failing policy rules over time, by capability and severity.",
    accent: "#7c3aed",
    icon: "📉",
  },
  {
    key: "fraud_review_queue",
    label: "Fraud review queue",
    description:
      "Open review_required sessions, oldest first, with the triggering policy and severity.",
    accent: "#be123c",
    icon: "🚨",
  },
  {
    key: "runtime_latency",
    label: "Runtime latency",
    description:
      "P50 / P95 / P99 latency by stage and by capability across sandbox and live.",
    accent: "#0ea5e9",
    icon: "⏱️",
  },
  {
    key: "blocked_execution_reasons",
    label: "Blocked execution reasons",
    description:
      "Distribution of execution_blocked outcomes by failure_category and decision_key.",
    accent: "#dc2626",
    icon: "⛔",
  },
  {
    key: "environment_health",
    label: "Environment health",
    description:
      "Per-environment dependency-resolution latency and constraint-violation rate.",
    accent: "#0f766e",
    icon: "🌐",
  },
  {
    key: "capability_usage",
    label: "Capability usage",
    description:
      "Active sessions per capability, broken down by service and lifecycle status.",
    accent: "#f59e0b",
    icon: "📊",
  },
];

/**
 * Non-negotiable safety rules. Narrow the existing Phase 1.75
 * INTERNAL_SAFETY_RULES into observability-level checks.
 */
export const OBSERVABILITY_SAFETY_RULES = [
  "Phase 2E describes the telemetry; it does not implement it. No code path emits or consumes runtime telemetry today.",
  "Telemetry envelopes (`session.metadata`, `failure.metadata`, `replay.replay_structure`) must never carry secrets, tokens, customer PII, or wallet balances.",
  "Replay must be side-effect free. The replay engine may reconstruct any replayable stage up to (but not including) `execution_authorized` — the actual executor side-effect is NEVER replayed.",
  "Money-moving capabilities must declare `redacted_fields` in their replay templates so the future replayer can scrub amounts, account identifiers, and balances.",
  "Sandbox and live telemetry are two independent series. Sandbox aggregates must never be presented as live, and vice versa.",
  "Failure rows reference Phase 2D `stage_key` / `policy_rule_key` / `decision_key` by key. Removing a Phase 2D row never deletes Phase 2E telemetry — the keys are kept for forensic completeness.",
  "Every `failed`, `blocked`, or `cancelled` session must have at least one corresponding `internal_execution_failures` row before its `completed_at` is set.",
  "Dashboards must be admin-only at the storage layer (RLS) AND at the query layer when implemented. No public dashboards.",
  "Telemetry retention must be governed separately. Phase 2E does not define retention; do not assume infinite retention when designing future emitters.",
  "Phase 2E does not modify the wallet ledger, treasury, withdrawal payouts, PayPal funding, or the fraud engine. It observes them; it never replaces them.",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up a metric seed by its metric_key.
 */
export function getExecutionMetric(metricKey) {
  if (!metricKey) return null;
  return (
    EXECUTION_METRIC_SEEDS.find((m) => m.metricKey === metricKey) ?? null
  );
}

/**
 * Look up a failure-taxonomy seed by its failure_key.
 */
export function getFailureDefinition(failureKey) {
  if (!failureKey) return null;
  return (
    EXECUTION_FAILURE_SEEDS.find((f) => f.failureKey === failureKey) ?? null
  );
}

/**
 * Look up a replay template by its replay_key.
 */
export function getReplayTemplate(replayKey) {
  if (!replayKey) return null;
  return (
    EXECUTION_REPLAY_TEMPLATES.find((t) => t.replayKey === replayKey) ?? null
  );
}

/**
 * Look up an execution session seed by its execution_session_id.
 */
export function getExecutionSessionSeed(executionSessionId) {
  if (!executionSessionId) return null;
  return (
    EXECUTION_SESSION_SEEDS.find(
      (s) => s.executionSessionId === executionSessionId,
    ) ?? null
  );
}

/**
 * Return all replay templates for a given capability_key.
 */
export function getReplayTemplatesForCapability(capabilityKey) {
  if (!capabilityKey) return [];
  return EXECUTION_REPLAY_TEMPLATES.filter(
    (t) => t.capabilityKey === capabilityKey,
  );
}

/**
 * Return all failure rows for a given execution_session_id.
 */
export function getFailuresForSession(executionSessionId) {
  if (!executionSessionId) return [];
  return EXECUTION_FAILURE_SEEDS.filter(
    (f) => f.executionSessionId === executionSessionId,
  );
}

/**
 * Return all metric rows for a given execution_session_id.
 */
export function getMetricsForSession(executionSessionId) {
  if (!executionSessionId) return [];
  return EXECUTION_METRIC_SEEDS.filter(
    (m) => m.executionSessionId === executionSessionId,
  );
}

/**
 * Convenience lookups that fall back to the most conservative entry when
 * an unknown key is supplied.
 */
export function getExecutionStatusType(key) {
  return (
    EXECUTION_STATUS_TYPES.find((s) => s.key === key) ??
    EXECUTION_STATUS_TYPES[0]
  );
}

export function getExecutionMetricCategory(key) {
  return (
    EXECUTION_METRIC_CATEGORIES.find((c) => c.key === key) ??
    EXECUTION_METRIC_CATEGORIES[0]
  );
}

export function getExecutionFailureCategory(key) {
  return (
    EXECUTION_FAILURE_CATEGORIES.find((c) => c.key === key) ??
    EXECUTION_FAILURE_CATEGORIES[0]
  );
}

export function getExecutionFailureSeverity(key) {
  return (
    EXECUTION_FAILURE_SEVERITIES.find((s) => s.key === key) ??
    EXECUTION_FAILURE_SEVERITIES[0]
  );
}

export function getExecutionReplayScope(key) {
  return (
    EXECUTION_REPLAY_SCOPES.find((s) => s.key === key) ??
    EXECUTION_REPLAY_SCOPES[0]
  );
}
