/**
 * Tropicash Developer Platform — Phase 2D:
 * Execution Orchestration & Policy Evaluation Blueprint config.
 *
 * Pure planning data layered on top of Phase 2A (service registry),
 * Phase 2B (governance), and Phase 2C (capability registry). Mirrors
 * supabase/sql/internal_execution_orchestration_phase2d.sql.
 *
 * THIS FILE IS ARCHITECTURE-ONLY. It does NOT:
 *   • create real execution engines or runtime evaluators
 *   • create real public or internal money-moving APIs
 *   • create API keys, service tokens, or secrets
 *   • move money
 *   • modify treasury, wallet, withdrawal, PayPal funding, or fraud logic
 *
 * The canonical narrative lives in docs/internal-service-blueprint.md
 * (Phase 2D section). When the exports below change materially, update
 * that doc and the SQL migration in the same PR.
 */

export const INTERNAL_EXECUTION_PHASE = "phase_2d_orchestration";

/**
 * Stage types. Mirrors the stage_type check constraint on
 * internal_execution_pipeline_stages.
 */
export const EXECUTION_STAGE_TYPES = [
  {
    key: "identity",
    label: "Identity",
    accent: "#2563eb",
    description: "Caller identity resolution & verification.",
  },
  {
    key: "environment",
    label: "Environment",
    accent: "#0ea5e9",
    description: "Sandbox vs live environment resolution & matching.",
  },
  {
    key: "capability",
    label: "Capability",
    accent: "#7c3aed",
    description: "Capability lookup against the Phase 2C registry.",
  },
  {
    key: "dependency",
    label: "Dependency",
    accent: "#f97316",
    description: "Phase 2C dependency resolution.",
  },
  {
    key: "policy",
    label: "Policy",
    accent: "#dc2626",
    description: "Reusable rule evaluation and per-capability constraints.",
  },
  {
    key: "idempotency",
    label: "Idempotency",
    accent: "#0f766e",
    description: "Idempotency key resolution & duplicate short-circuit.",
  },
  {
    key: "fraud",
    label: "Fraud",
    accent: "#be123c",
    description: "Fraud-engine decision path.",
  },
  {
    key: "audit",
    label: "Audit",
    accent: "#475569",
    description: "Pre- and intake-side audit recording.",
  },
  {
    key: "execution",
    label: "Execution",
    accent: "#16a34a",
    description: "Terminal authorize-or-block verdict.",
  },
  {
    key: "post_execution",
    label: "Post-execution",
    accent: "#64748b",
    description: "Post-execution audit & side-effect recording.",
  },
];

/**
 * Seeded pipeline stages. execution_order is dense (1..13). Mirrors the
 * seed block in supabase/sql/internal_execution_orchestration_phase2d.sql.
 */
export const EXECUTION_PIPELINE_STAGES = [
  {
    stageKey: "request_received",
    stageLabel: "Request received",
    executionOrder: 1,
    stageType: "audit",
    lifecycleStatus: "defined",
    blockingByDefault: false,
    description:
      "Initial intake. The orchestrator records the raw request envelope before any validation runs.",
  },
  {
    stageKey: "identity_verified",
    stageLabel: "Identity verified",
    executionOrder: 2,
    stageType: "identity",
    lifecycleStatus: "defined",
    blockingByDefault: true,
    description:
      "Caller identity (service token, admin session, or developer key) is resolved and verified.",
  },
  {
    stageKey: "environment_checked",
    stageLabel: "Environment checked",
    executionOrder: 3,
    stageType: "environment",
    lifecycleStatus: "defined",
    blockingByDefault: true,
    description:
      "Request environment (sandbox vs live) is resolved and matched against the integration's allowed environments.",
  },
  {
    stageKey: "capability_resolved",
    stageLabel: "Capability resolved",
    executionOrder: 4,
    stageType: "capability",
    lifecycleStatus: "defined",
    blockingByDefault: true,
    description:
      "Requested capability is resolved against the Phase 2C capability registry.",
  },
  {
    stageKey: "dependency_checked",
    stageLabel: "Dependency checked",
    executionOrder: 5,
    stageType: "dependency",
    lifecycleStatus: "defined",
    blockingByDefault: true,
    description:
      "Required and blocks_without dependencies declared in Phase 2C are validated.",
  },
  {
    stageKey: "policy_evaluated",
    stageLabel: "Policy evaluated",
    executionOrder: 6,
    stageType: "policy",
    lifecycleStatus: "defined",
    blockingByDefault: true,
    description:
      "Reusable policy rules (idempotency, fraud-review-required, env-match, etc.) are evaluated for this capability.",
  },
  {
    stageKey: "constraint_evaluated",
    stageLabel: "Constraint evaluated",
    executionOrder: 7,
    stageType: "policy",
    lifecycleStatus: "defined",
    blockingByDefault: true,
    description:
      "Per-capability, per-environment operational constraints from Phase 2C are evaluated (limits, sandbox_only, etc.).",
  },
  {
    stageKey: "idempotency_checked",
    stageLabel: "Idempotency checked",
    executionOrder: 8,
    stageType: "idempotency",
    lifecycleStatus: "defined",
    blockingByDefault: true,
    description:
      "Idempotency key is resolved against prior calls. Duplicates short-circuit to the prior result.",
  },
  {
    stageKey: "fraud_reviewed",
    stageLabel: "Fraud reviewed",
    executionOrder: 9,
    stageType: "fraud",
    lifecycleStatus: "defined",
    blockingByDefault: true,
    description:
      "Money-moving capabilities pass through the existing fraud-engine decision path.",
  },
  {
    stageKey: "audit_logged",
    stageLabel: "Audit logged",
    executionOrder: 10,
    stageType: "audit",
    lifecycleStatus: "defined",
    blockingByDefault: false,
    description:
      "Pre-execution audit record is written, including the resolved decision so far.",
  },
  {
    stageKey: "execution_authorized",
    stageLabel: "Execution authorized",
    executionOrder: 11,
    stageType: "execution",
    lifecycleStatus: "defined",
    blockingByDefault: false,
    description:
      "Terminal success path: every gate passed; the request may proceed to capability execution.",
  },
  {
    stageKey: "execution_blocked",
    stageLabel: "Execution blocked",
    executionOrder: 12,
    stageType: "execution",
    lifecycleStatus: "defined",
    blockingByDefault: true,
    description:
      "Terminal block path: a prior stage emitted a terminal block decision; execution does not happen.",
  },
  {
    stageKey: "post_execution_logged",
    stageLabel: "Post-execution logged",
    executionOrder: 13,
    stageType: "post_execution",
    lifecycleStatus: "defined",
    blockingByDefault: false,
    description:
      "Post-execution audit record is written with the final outcome, timing, and any side-effects.",
  },
];

/**
 * Severity scale and decision verdicts for policy evaluation rules.
 * `severityClasses` mirror the Phase 2A/2C risk-level palette so policy
 * severities render consistently with risk badges across the console.
 */
export const POLICY_EVALUATION_TYPES = [
  {
    key: "required",
    label: "Required",
    description: "Rule must pass. Failure halts the pipeline.",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-900",
  },
  {
    key: "optional",
    label: "Optional",
    description: "Rule is evaluated but its outcome does not halt the pipeline.",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    key: "blocking",
    label: "Blocking",
    description: "Rule is hard-blocking and emits a terminal decision on failure.",
    badgeClass: "border border-red-200 bg-red-50 text-red-900",
  },
  {
    key: "audit_only",
    label: "Audit only",
    description:
      "Rule emits an audit record but never halts execution. Used for shadow rollout.",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    key: "monitor_only",
    label: "Monitor only",
    description:
      "Rule is evaluated and logged for observability. Violations do not halt execution.",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
  },
];

export const POLICY_SEVERITY_LEVELS = [
  {
    key: "low",
    label: "Low",
    description: "Default severity for advisory rules.",
    dotClass: "bg-slate-400",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
    order: 1,
  },
  {
    key: "medium",
    label: "Medium",
    description: "Operational rules with audit-level impact.",
    dotClass: "bg-amber-500",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
    order: 2,
  },
  {
    key: "high",
    label: "High",
    description: "Money-moving rules. Failure must block or queue for review.",
    dotClass: "bg-orange-500",
    badgeClass: "border border-orange-200 bg-orange-50 text-orange-900",
    order: 3,
  },
  {
    key: "critical",
    label: "Critical",
    description:
      "Highest severity. Failure halts the pipeline and requires explicit human review.",
    dotClass: "bg-red-500",
    badgeClass: "border border-red-200 bg-red-50 text-red-900",
    order: 4,
  },
];

export const POLICY_FAILURE_DECISIONS = [
  {
    key: "allow",
    label: "Allow",
    description:
      "Failure is tolerated. Used for audit_only / monitor_only rules.",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    key: "block",
    label: "Block",
    description: "Hard block. Pipeline terminates immediately.",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-900",
  },
  {
    key: "review_required",
    label: "Review required",
    description: "Pipeline pauses; request enters a human-review queue.",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    key: "sandbox_only",
    label: "Sandbox only",
    description:
      "Live invocations terminate with execution_blocked; sandbox proceeds.",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    key: "limit_exceeded",
    label: "Limit exceeded",
    description:
      "Quantitative cap (amount, count, frequency) was exceeded.",
    badgeClass: "border border-orange-200 bg-orange-50 text-orange-900",
  },
  {
    key: "dependency_missing",
    label: "Dependency missing",
    description:
      "A Phase 2C requires / blocks_without dependency did not resolve.",
    badgeClass: "border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
  },
  {
    key: "policy_not_satisfied",
    label: "Policy not satisfied",
    description:
      "A required policy rule (idempotency, env-match, audit) did not pass.",
    badgeClass: "border border-red-200 bg-red-50 text-red-900",
  },
];

/**
 * Seeded policy evaluation rules. Mirrors the seed block in
 * supabase/sql/internal_execution_orchestration_phase2d.sql.
 */
export const POLICY_EVALUATION_RULES = [
  {
    ruleKey: "requires_idempotency",
    ruleLabel: "Requires idempotency key",
    evaluationType: "required",
    severity: "high",
    decisionIfFailed: "block",
    lifecycleStatus: "defined",
    description:
      "Every money-moving call must carry an idempotency key. Duplicates must short-circuit to the prior recorded result.",
  },
  {
    ruleKey: "requires_fraud_review",
    ruleLabel: "Requires fraud review",
    evaluationType: "blocking",
    severity: "critical",
    decisionIfFailed: "review_required",
    lifecycleStatus: "defined",
    description:
      "Capabilities that touch wallet, payment, payout, or trading money flows must pass through the fraud engine decision path.",
  },
  {
    ruleKey: "sandbox_only",
    ruleLabel: "Sandbox-only capability",
    evaluationType: "blocking",
    severity: "medium",
    decisionIfFailed: "sandbox_only",
    lifecycleStatus: "defined",
    description:
      "Capability is marked sandbox-only via its Phase 2C constraints. Live invocations must be terminated at environment_checked.",
  },
  {
    ruleKey: "max_transaction_amount",
    ruleLabel: "Max transaction amount",
    evaluationType: "blocking",
    severity: "high",
    decisionIfFailed: "limit_exceeded",
    lifecycleStatus: "defined",
    description:
      "Per-environment cap on a single transaction. Exceeding the cap emits a terminal limit_exceeded decision.",
  },
  {
    ruleKey: "requires_dependency_resolution",
    ruleLabel: "Requires dependency resolution",
    evaluationType: "required",
    severity: "high",
    decisionIfFailed: "dependency_missing",
    lifecycleStatus: "defined",
    description:
      "Every Phase 2C requires / blocks_without dependency must resolve. Missing dependencies emit dependency_missing.",
  },
  {
    ruleKey: "requires_environment_match",
    ruleLabel: "Requires environment match",
    evaluationType: "blocking",
    severity: "medium",
    decisionIfFailed: "sandbox_only",
    lifecycleStatus: "defined",
    description:
      "Integration must be permitted in the requested environment per Phase 2A registry and Phase 2B gates.",
  },
  {
    ruleKey: "requires_audit_record",
    ruleLabel: "Requires audit record",
    evaluationType: "required",
    severity: "low",
    decisionIfFailed: "block",
    lifecycleStatus: "defined",
    description:
      "Every authorized call must have a pre-execution and post-execution audit row. Missing audit aborts the pipeline.",
  },
];

/**
 * Decision categories. Mirrors the decision_category check constraint on
 * internal_runtime_decisions.
 */
export const RUNTIME_DECISION_CATEGORIES = [
  {
    key: "success",
    label: "Success",
    description: "Pipeline can continue or has terminated with authorization.",
    accent: "#16a34a",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
    dotClass: "bg-emerald-500",
  },
  {
    key: "warning",
    label: "Warning",
    description: "Advisory signal. Logged; pipeline continues.",
    accent: "#f59e0b",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
    dotClass: "bg-amber-500",
  },
  {
    key: "review",
    label: "Review",
    description: "Pipeline paused. Awaiting human or admin verdict.",
    accent: "#f97316",
    badgeClass: "border border-orange-200 bg-orange-50 text-orange-900",
    dotClass: "bg-orange-500",
  },
  {
    key: "blocked",
    label: "Blocked",
    description: "Pipeline terminated with a block.",
    accent: "#dc2626",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-900",
    dotClass: "bg-rose-500",
  },
  {
    key: "environment",
    label: "Environment",
    description: "Environment routing decision (e.g. sandbox-only).",
    accent: "#0ea5e9",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
    dotClass: "bg-sky-500",
  },
  {
    key: "dependency",
    label: "Dependency",
    description: "Dependency-resolution decision.",
    accent: "#a21caf",
    badgeClass: "border border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900",
    dotClass: "bg-fuchsia-500",
  },
  {
    key: "policy",
    label: "Policy",
    description: "Policy-rule decision (limit, env-match, idempotency, audit).",
    accent: "#7c3aed",
    badgeClass: "border border-violet-200 bg-violet-50 text-violet-900",
    dotClass: "bg-violet-500",
  },
];

/**
 * Seeded runtime decisions. Mirrors the seed block in
 * supabase/sql/internal_execution_orchestration_phase2d.sql.
 */
export const RUNTIME_DECISION_TYPES = [
  {
    decisionKey: "allowed",
    decisionLabel: "Allowed",
    decisionCategory: "success",
    isTerminal: false,
    description:
      "Intermediate pass. The current stage permitted continuation; later stages may still alter the outcome.",
  },
  {
    decisionKey: "warning",
    decisionLabel: "Warning",
    decisionCategory: "warning",
    isTerminal: false,
    description: "Advisory signal. Logged for observability; does not stop the pipeline.",
  },
  {
    decisionKey: "review_required",
    decisionLabel: "Review required",
    decisionCategory: "review",
    isTerminal: false,
    description:
      "Caller must wait for human or admin review (e.g. payout manual review). Pipeline pauses but is not terminal.",
  },
  {
    decisionKey: "blocked",
    decisionLabel: "Blocked",
    decisionCategory: "blocked",
    isTerminal: true,
    description:
      "Hard block emitted by a policy or constraint. No further evaluation runs.",
  },
  {
    decisionKey: "sandbox_only",
    decisionLabel: "Sandbox only",
    decisionCategory: "environment",
    isTerminal: false,
    description:
      "Capability is restricted to sandbox; live invocations are rerouted to a terminal block, sandbox invocations proceed.",
  },
  {
    decisionKey: "limit_exceeded",
    decisionLabel: "Limit exceeded",
    decisionCategory: "policy",
    isTerminal: false,
    description: "A quantitative policy (amount, count, frequency) was exceeded.",
  },
  {
    decisionKey: "dependency_missing",
    decisionLabel: "Dependency missing",
    decisionCategory: "dependency",
    isTerminal: false,
    description:
      "A Phase 2C requires or blocks_without dependency could not be resolved.",
  },
  {
    decisionKey: "policy_not_satisfied",
    decisionLabel: "Policy not satisfied",
    decisionCategory: "policy",
    isTerminal: false,
    description:
      "A required policy rule did not pass (e.g. missing idempotency key).",
  },
  {
    decisionKey: "execution_authorized",
    decisionLabel: "Execution authorized",
    decisionCategory: "success",
    isTerminal: true,
    description:
      "Terminal success verdict. The request reached execution_authorized and may now invoke the capability.",
  },
  {
    decisionKey: "execution_blocked",
    decisionLabel: "Execution blocked",
    decisionCategory: "blocked",
    isTerminal: true,
    description:
      "Terminal block verdict. A prior stage emitted a terminal block and execution does not happen.",
  },
];

/**
 * Seeded execution trace templates. Mirrors the seed block in
 * supabase/sql/internal_execution_orchestration_phase2d.sql.
 *
 * `traceStructure` is the parsed JSONB payload — kept inline so the UI can
 * render it without a JSON parse step.
 */
export const EXECUTION_TRACE_TEMPLATES = [
  {
    templateKey: "payment_create_sandbox",
    templateLabel: "payment.create (sandbox)",
    capabilityKey: "payment.create",
    environment: "sandbox",
    lifecycleStatus: "defined",
    traceStructure: {
      pipeline: [
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
        "execution_authorized",
      ],
      decision_points: [
        "policy_evaluated",
        "constraint_evaluated",
        "fraud_reviewed",
      ],
      terminal_states: ["execution_authorized", "execution_blocked"],
      notes:
        "Phase 2C requires wallet.read and fraud.review_required. Sandbox cap: max_transaction_amount=1000 USD.",
    },
    description:
      "Sandbox trace template for the payment.create capability. Composed of every Phase 2D pipeline stage; decision points where evaluators may emit a terminal block.",
  },
  {
    templateKey: "payout_release_sandbox",
    templateLabel: "payout.release (sandbox)",
    capabilityKey: "payout.release",
    environment: "sandbox",
    lifecycleStatus: "defined",
    traceStructure: {
      pipeline: [
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
        "execution_authorized",
      ],
      decision_points: [
        "dependency_checked",
        "policy_evaluated",
        "constraint_evaluated",
        "fraud_reviewed",
      ],
      terminal_states: ["execution_authorized", "execution_blocked"],
      review_states: ["review_required"],
      notes:
        "Phase 2C requires payout.approve, fraud.review_required, and blocks_without treasury.reserve_funds. Sandbox constraints: requires_manual_review and requires_treasury_approval — expect a review_required pause before execution_authorized.",
    },
    description:
      "Sandbox trace template for payout.release. Has an extra dependency_checked decision point because blocks_without treasury.reserve_funds can short-circuit the pipeline.",
  },
  {
    templateKey: "trading_profit_withdraw_sandbox",
    templateLabel: "trading.profit_withdraw (sandbox)",
    capabilityKey: "trading.profit_withdraw",
    environment: "sandbox",
    lifecycleStatus: "defined",
    traceStructure: {
      pipeline: [
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
        "execution_authorized",
      ],
      decision_points: [
        "environment_checked",
        "policy_evaluated",
        "fraud_reviewed",
      ],
      terminal_states: ["execution_authorized", "execution_blocked"],
      notes:
        "Phase 2C constraint sandbox_only blocks live invocations at environment_checked. Sandbox path passes wallet.read, fraud.review_required, and audit_requires ledger.export downstream.",
    },
    description:
      "Sandbox trace template for trading.profit_withdraw. environment_checked is a decision point because the sandbox_only constraint terminates live invocations there.",
  },
];

/**
 * Non-negotiable safety rules for the future orchestrator. Narrow the
 * existing Phase 1.75 INTERNAL_SAFETY_RULES into orchestration-level
 * checks.
 */
export const EXECUTION_ORCHESTRATION_SAFETY_RULES = [
  "Phase 2D defines the pipeline; it does not implement it. No code path executes a real money-moving request based on these rows.",
  "The orchestrator must always run in this order: identity → environment → capability → dependency → policy → constraint → idempotency → fraud → audit → execution → post-execution.",
  "Every money-moving capability must reach fraud_reviewed before execution_authorized. Skipping fraud_reviewed is not permitted.",
  "Every authorized call must have a pre-execution (audit_logged) and a post-execution (post_execution_logged) audit row.",
  "Idempotency duplicates must short-circuit to the prior result. Replaying a money-moving call must never produce a second side-effect.",
  "Sandbox and live trace templates are independent rows. Promoting sandbox does not promote live.",
  "Only `execution_authorized`, `execution_blocked`, and `blocked` are terminal verdicts. Every other decision must feed back into a later stage.",
  "Constraints seeded as `planned` in Phase 2C cannot block calls until a real enforcement path is shipped — Phase 2D names the path but does not implement it.",
  "Trace templates (`trace_structure` JSONB) must never contain secrets, tokens, customer PII, or wallet balances.",
  "Phase 2D does not modify the wallet ledger, treasury, withdrawal payouts, PayPal funding, or the fraud engine. It composes with them; it never replaces them.",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return a pipeline stage seed by its stage_key, or null.
 */
export function getPipelineStage(stageKey) {
  if (!stageKey) return null;
  return (
    EXECUTION_PIPELINE_STAGES.find((s) => s.stageKey === stageKey) ?? null
  );
}

/**
 * Return a policy rule seed by its rule_key, or null.
 */
export function getPolicyRule(ruleKey) {
  if (!ruleKey) return null;
  return (
    POLICY_EVALUATION_RULES.find((r) => r.ruleKey === ruleKey) ?? null
  );
}

/**
 * Return a runtime decision seed by its decision_key, or null.
 */
export function getRuntimeDecision(decisionKey) {
  if (!decisionKey) return null;
  return (
    RUNTIME_DECISION_TYPES.find((d) => d.decisionKey === decisionKey) ?? null
  );
}

/**
 * Return a trace template seed by its template_key, or null.
 */
export function getTraceTemplate(templateKey) {
  if (!templateKey) return null;
  return (
    EXECUTION_TRACE_TEMPLATES.find(
      (t) => t.templateKey === templateKey,
    ) ?? null
  );
}

/**
 * Return the trace template(s) for a given capability_key. Optional
 * `environment` filter restricts to one of ('sandbox' | 'live').
 */
export function getTraceTemplatesForCapability(
  capabilityKey,
  environment = null,
) {
  if (!capabilityKey) return [];
  return EXECUTION_TRACE_TEMPLATES.filter((t) => {
    if (t.capabilityKey !== capabilityKey) return false;
    if (environment && t.environment !== environment) return false;
    return true;
  });
}

/**
 * Convenience lookups that fall back to the most conservative entry when
 * an unknown key is supplied.
 */
export function getExecutionStageType(key) {
  return EXECUTION_STAGE_TYPES.find((t) => t.key === key) ?? null;
}

export function getPolicyEvaluationType(key) {
  return (
    POLICY_EVALUATION_TYPES.find((t) => t.key === key) ??
    POLICY_EVALUATION_TYPES[0]
  );
}

export function getPolicySeverity(key) {
  return (
    POLICY_SEVERITY_LEVELS.find((s) => s.key === key) ??
    POLICY_SEVERITY_LEVELS[0]
  );
}

export function getPolicyFailureDecision(key) {
  return (
    POLICY_FAILURE_DECISIONS.find((d) => d.key === key) ??
    POLICY_FAILURE_DECISIONS[0]
  );
}

export function getRuntimeDecisionCategory(key) {
  return (
    RUNTIME_DECISION_CATEGORIES.find((c) => c.key === key) ??
    RUNTIME_DECISION_CATEGORIES[0]
  );
}
