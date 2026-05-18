/**
 * Phase 3B — Runtime Decision Engine Simulator.
 *
 * DECISION SIMULATION ONLY. This module:
 *   • does NOT enforce real policies, run an execution engine, or call APIs
 *   • does NOT read/write Supabase, mutate databases, or touch network I/O
 *   • does NOT move money or touch treasury, wallets, withdrawals, PayPal,
 *     payouts, or fraud execution logic
 *   • does NOT use Date.now(), Math.random(), timers, workers, queues, or
 *     background tasks
 *
 * All exports are static seeds and pure functions. Outcomes are explained
 * from pre-authored rule results — not from a live policy evaluator.
 */

export const RUNTIME_DECISION_SIMULATOR_PHASE = "phase_3b_decision_simulation";

// ---------------------------------------------------------------------------
// Rule types (evaluation categories)
// ---------------------------------------------------------------------------
export const DECISION_SIMULATION_RULE_TYPES = [
  { key: "identity", label: "Identity", description: "Caller and session identity." },
  { key: "environment", label: "Environment", description: "Sandbox vs live and isolation gates." },
  { key: "capability", label: "Capability", description: "Whether the requested capability exists and is enabled." },
  { key: "dependency", label: "Dependency", description: "Upstream capability and data dependencies." },
  { key: "policy", label: "Policy", description: "Business and platform policy checks." },
  { key: "constraint", label: "Constraint", description: "Operational limits and caps." },
  { key: "idempotency", label: "Idempotency", description: "Idempotency key presence and replay semantics." },
  { key: "fraud", label: "Fraud", description: "Fraud signals and review thresholds." },
  { key: "audit", label: "Audit", description: "Audit trail readiness and recording obligations." },
];

// ---------------------------------------------------------------------------
// Outcomes (vocabulary aligned with Phase 2D runtime decisions / simulator)
// ---------------------------------------------------------------------------
export const DECISION_SIMULATION_OUTCOMES = [
  { key: "allowed", label: "Allowed", description: "All evaluated gates passed for this simulation slice.", terminalInSim: true },
  { key: "blocked", label: "Blocked", description: "A hard gate failed; execution must not proceed.", terminalInSim: true },
  { key: "review_required", label: "Review required", description: "Pipeline pauses for human or elevated review.", terminalInSim: false },
  { key: "delayed", label: "Delayed", description: "Downstream timing defers completion without failing the envelope.", terminalInSim: false },
  { key: "rate_limited", label: "Rate limited", description: "Caller exceeded an envelope budget at the gateway.", terminalInSim: false },
  { key: "retryable_failure", label: "Retryable failure", description: "Transient failure; same idempotency key may be retried.", terminalInSim: false },
  { key: "policy_not_satisfied", label: "Policy not satisfied", description: "A policy predicate did not pass.", terminalInSim: true },
  { key: "dependency_missing", label: "Dependency missing", description: "A required upstream dependency is absent or stale.", terminalInSim: true },
  { key: "sandbox_only", label: "Sandbox only", description: "Operation is not permitted outside sandbox for this integration.", terminalInSim: true },
];

// ---------------------------------------------------------------------------
// Severities
// ---------------------------------------------------------------------------
export const DECISION_SIMULATION_SEVERITIES = [
  { key: "low", label: "Low", badgeClass: "border border-slate-200 bg-slate-50 text-slate-700", dotClass: "bg-slate-400" },
  { key: "medium", label: "Medium", badgeClass: "border border-sky-200 bg-sky-50 text-sky-800", dotClass: "bg-sky-500" },
  { key: "high", label: "High", badgeClass: "border border-amber-200 bg-amber-50 text-amber-900", dotClass: "bg-amber-500" },
  { key: "critical", label: "Critical", badgeClass: "border border-rose-200 bg-rose-50 text-rose-800", dotClass: "bg-rose-500" },
];

// ---------------------------------------------------------------------------
// Rule catalog (seeded definitions)
// ---------------------------------------------------------------------------
export const DECISION_SIMULATION_RULES = [
  {
    rule_key: "identity_verified",
    label: "Identity verified",
    type: "identity",
    severity: "low",
    description: "Authenticated subject matches the integration identity model.",
    pass_message: "Caller identity resolved and matches the request envelope.",
    fail_message: "Identity could not be verified for this request.",
    decision_if_failed: "blocked",
  },
  {
    rule_key: "environment_allowed",
    label: "Environment allowed",
    type: "environment",
    severity: "low",
    description: "Request environment matches capability and integration gates.",
    pass_message: "Environment gate passed for the requested operation.",
    fail_message: "Environment is not permitted for this operation shape.",
    decision_if_failed: "blocked",
  },
  {
    rule_key: "capability_supported",
    label: "Capability supported",
    type: "capability",
    severity: "medium",
    description: "Capability key is registered and eligible in this environment.",
    pass_message: "Capability is supported for this environment.",
    fail_message: "Capability is not supported or not enabled.",
    decision_if_failed: "blocked",
  },
  {
    rule_key: "dependencies_resolved",
    label: "Dependencies resolved",
    type: "dependency",
    severity: "medium",
    description: "All declared capability dependencies are satisfied.",
    pass_message: "Dependency graph resolved without missing edges.",
    fail_message: "A required dependency is missing or not ready.",
    decision_if_failed: "dependency_missing",
  },
  {
    rule_key: "requires_idempotency",
    label: "Idempotency key required",
    type: "idempotency",
    severity: "high",
    description: "Money-moving requests must carry a valid idempotency key.",
    pass_message: "Idempotency key present and well-formed.",
    fail_message: "Idempotency key missing or invalid for a mutating request.",
    decision_if_failed: "policy_not_satisfied",
  },
  {
    rule_key: "max_transaction_amount",
    label: "Max transaction amount",
    type: "constraint",
    severity: "high",
    description: "Transaction amount must be within policy caps for the environment.",
    pass_message: "Amount is within the configured policy cap.",
    fail_message: "Amount exceeds the configured policy cap.",
    decision_if_failed: "policy_not_satisfied",
  },
  {
    rule_key: "fraud_review_required",
    label: "Fraud review threshold",
    type: "fraud",
    severity: "critical",
    description: "Fraud signals must clear or pause for review when over threshold.",
    pass_message: "Fraud evaluation cleared without mandatory review.",
    fail_message: "Fraud evaluation requires manual or elevated review.",
    decision_if_failed: "review_required",
  },
  {
    rule_key: "sandbox_only",
    label: "Sandbox-only integration",
    type: "environment",
    severity: "high",
    description: "Integration is restricted to sandbox until live gates pass.",
    pass_message: "Sandbox-only restriction satisfied for sandbox traffic.",
    fail_message: "Integration is sandbox-only; live traffic is blocked.",
    decision_if_failed: "sandbox_only",
  },
  {
    rule_key: "audit_record_required",
    label: "Audit record required",
    type: "audit",
    severity: "medium",
    description: "Mutating requests must emit an audit record plan.",
    pass_message: "Audit obligation satisfied for this request class.",
    fail_message: "Audit record cannot be planned for this request.",
    decision_if_failed: "blocked",
  },
  {
    rule_key: "rate_limit_available",
    label: "Rate limit budget",
    type: "policy",
    severity: "medium",
    description: "Per-caller envelope budget must have remaining capacity.",
    pass_message: "Rate limit budget has remaining capacity.",
    fail_message: "Rate limit budget exhausted for this caller window.",
    decision_if_failed: "rate_limited",
  },
  {
    rule_key: "treasury_gate_required",
    label: "Treasury readiness gate",
    type: "policy",
    severity: "critical",
    description: "Treasury liquidity and governance gates for high-risk flows.",
    pass_message: "Treasury readiness gate cleared for this simulation slice.",
    fail_message: "Treasury readiness gate failed; execution cannot proceed.",
    decision_if_failed: "blocked",
  },
  {
    rule_key: "payout_manual_review_required",
    label: "Payout manual review",
    type: "fraud",
    severity: "high",
    description: "Outbound payouts require manual review before authorization.",
    pass_message: "Payout manual review not required for this path.",
    fail_message: "Payout requires manual review before authorization.",
    decision_if_failed: "review_required",
  },
];

// ---------------------------------------------------------------------------
// Decision cases (deterministic rule_result seeds; must match walk outcome)
// ---------------------------------------------------------------------------
export const DECISION_SIMULATION_CASES = [
  {
    case_key: "wallet.transfer.success",
    scenario_key: "wallet.transfer.success",
    title: "Wallet transfer — success",
    capability_key: "wallet.transfer",
    environment: "sandbox",
    amount_preview: "125.00 USD",
    final_outcome: "allowed",
    rule_results: [
      { rule_key: "identity_verified", passed: true, result_message: "Session matches wallet owner.", impact: "continue", evaluation_order: 1 },
      { rule_key: "environment_allowed", passed: true, result_message: "Sandbox envelope.", impact: "continue", evaluation_order: 2 },
      { rule_key: "capability_supported", passed: true, result_message: "wallet.transfer supported.", impact: "continue", evaluation_order: 3 },
      { rule_key: "dependencies_resolved", passed: true, result_message: "Ledger dependency ready.", impact: "continue", evaluation_order: 4 },
      { rule_key: "requires_idempotency", passed: true, result_message: "Idempotency-Key present.", impact: "continue", evaluation_order: 5 },
      { rule_key: "max_transaction_amount", passed: true, result_message: "Within sandbox cap.", impact: "continue", evaluation_order: 6 },
      { rule_key: "fraud_review_required", passed: true, result_message: "No review threshold crossed.", impact: "continue", evaluation_order: 7 },
      { rule_key: "sandbox_only", passed: true, result_message: "Sandbox traffic only.", impact: "continue", evaluation_order: 8 },
      { rule_key: "audit_record_required", passed: true, result_message: "Audit plan attached.", impact: "continue", evaluation_order: 9 },
    ],
  },
  {
    case_key: "wallet.transfer.review_required",
    scenario_key: "wallet.transfer.review_required",
    title: "Wallet transfer — review required",
    capability_key: "wallet.transfer",
    environment: "sandbox",
    amount_preview: "9,800.00 USD",
    final_outcome: "review_required",
    rule_results: [
      { rule_key: "identity_verified", passed: true, result_message: "Session verified.", impact: "continue", evaluation_order: 1 },
      { rule_key: "environment_allowed", passed: true, result_message: "Sandbox.", impact: "continue", evaluation_order: 2 },
      { rule_key: "capability_supported", passed: true, result_message: "wallet.transfer supported.", impact: "continue", evaluation_order: 3 },
      { rule_key: "dependencies_resolved", passed: true, result_message: "Dependencies OK.", impact: "continue", evaluation_order: 4 },
      { rule_key: "requires_idempotency", passed: true, result_message: "Idempotency OK.", impact: "continue", evaluation_order: 5 },
      { rule_key: "max_transaction_amount", passed: true, result_message: "Within cap.", impact: "warn", evaluation_order: 6 },
      { rule_key: "fraud_review_required", passed: false, result_message: "Velocity + amount pattern triggered review.", impact: "pause_for_review", evaluation_order: 7 },
      { rule_key: "sandbox_only", passed: true, result_message: "Sandbox only OK.", impact: "continue", evaluation_order: 8 },
      { rule_key: "audit_record_required", passed: true, result_message: "Audit plan OK.", impact: "continue", evaluation_order: 9 },
    ],
  },
  {
    case_key: "withdrawal.pending_review",
    scenario_key: "withdrawal.pending_review",
    title: "Withdrawal — pending review",
    capability_key: "wallet.withdraw",
    environment: "sandbox",
    amount_preview: "2,500.00 USD",
    final_outcome: "review_required",
    rule_results: [
      { rule_key: "identity_verified", passed: true, result_message: "Verified.", impact: "continue", evaluation_order: 1 },
      { rule_key: "environment_allowed", passed: true, result_message: "Sandbox.", impact: "continue", evaluation_order: 2 },
      { rule_key: "capability_supported", passed: true, result_message: "wallet.withdraw supported.", impact: "continue", evaluation_order: 3 },
      { rule_key: "dependencies_resolved", passed: true, result_message: "Payout method linked.", impact: "continue", evaluation_order: 4 },
      { rule_key: "requires_idempotency", passed: true, result_message: "Idempotency OK.", impact: "continue", evaluation_order: 5 },
      { rule_key: "payout_manual_review_required", passed: false, result_message: "Sandbox policy: all withdrawals require manual review.", impact: "pause_for_review", evaluation_order: 6 },
      { rule_key: "fraud_review_required", passed: true, result_message: "No additional fraud hold.", impact: "continue", evaluation_order: 7 },
      { rule_key: "audit_record_required", passed: true, result_message: "Audit plan OK.", impact: "continue", evaluation_order: 8 },
    ],
  },
  {
    case_key: "withdrawal.completed",
    scenario_key: "withdrawal.completed",
    title: "Withdrawal — completed",
    capability_key: "wallet.withdraw",
    environment: "sandbox",
    amount_preview: "400.00 USD",
    final_outcome: "allowed",
    rule_results: [
      { rule_key: "identity_verified", passed: true, result_message: "Verified.", impact: "continue", evaluation_order: 1 },
      { rule_key: "environment_allowed", passed: true, result_message: "Sandbox.", impact: "continue", evaluation_order: 2 },
      { rule_key: "capability_supported", passed: true, result_message: "wallet.withdraw supported.", impact: "continue", evaluation_order: 3 },
      { rule_key: "dependencies_resolved", passed: true, result_message: "Payout method ready.", impact: "continue", evaluation_order: 4 },
      { rule_key: "requires_idempotency", passed: true, result_message: "Idempotency OK.", impact: "continue", evaluation_order: 5 },
      { rule_key: "payout_manual_review_required", passed: true, result_message: "Manual review already cleared (simulated).", impact: "continue", evaluation_order: 6 },
      { rule_key: "fraud_review_required", passed: true, result_message: "Fraud cleared.", impact: "continue", evaluation_order: 7 },
      { rule_key: "treasury_gate_required", passed: true, result_message: "Treasury gate OK for sandbox.", impact: "continue", evaluation_order: 8 },
      { rule_key: "audit_record_required", passed: true, result_message: "Audit OK.", impact: "continue", evaluation_order: 9 },
    ],
  },
  {
    case_key: "trading.profit_payout",
    scenario_key: "trading.profit_payout",
    title: "Trading profit payout",
    capability_key: "trading.profit_withdraw",
    environment: "sandbox",
    amount_preview: "18,000.00 USD",
    final_outcome: "review_required",
    rule_results: [
      { rule_key: "identity_verified", passed: true, result_message: "Verified.", impact: "continue", evaluation_order: 1 },
      { rule_key: "environment_allowed", passed: true, result_message: "Sandbox.", impact: "continue", evaluation_order: 2 },
      { rule_key: "capability_supported", passed: true, result_message: "trading.profit_withdraw supported.", impact: "continue", evaluation_order: 3 },
      { rule_key: "dependencies_resolved", passed: true, result_message: "Triton bridge dependency ready.", impact: "continue", evaluation_order: 4 },
      { rule_key: "requires_idempotency", passed: true, result_message: "Idempotency OK.", impact: "continue", evaluation_order: 5 },
      { rule_key: "max_transaction_amount", passed: true, result_message: "Within policy cap.", impact: "warn", evaluation_order: 6 },
      { rule_key: "fraud_review_required", passed: false, result_message: "Profit-withdraw class always requires elevated review in simulation.", impact: "pause_for_review", evaluation_order: 7 },
      { rule_key: "treasury_gate_required", passed: true, result_message: "Treasury gate OK for sandbox slice.", impact: "continue", evaluation_order: 8 },
      { rule_key: "audit_record_required", passed: true, result_message: "Audit OK.", impact: "continue", evaluation_order: 9 },
    ],
  },
  {
    case_key: "merchant.settlement.delayed",
    scenario_key: "merchant.settlement.delayed",
    title: "Merchant settlement — delayed",
    capability_key: "merchant.settlement",
    environment: "sandbox",
    amount_preview: "50,000.00 USD",
    final_outcome: "delayed",
    rule_results: [
      { rule_key: "identity_verified", passed: true, result_message: "Verified.", impact: "continue", evaluation_order: 1 },
      { rule_key: "environment_allowed", passed: true, result_message: "Sandbox.", impact: "continue", evaluation_order: 2 },
      { rule_key: "capability_supported", passed: true, result_message: "merchant.settlement supported.", impact: "continue", evaluation_order: 3 },
      { rule_key: "dependencies_resolved", passed: true, result_message: "EliteHire connector healthy.", impact: "continue", evaluation_order: 4 },
      { rule_key: "requires_idempotency", passed: true, result_message: "Idempotency OK.", impact: "continue", evaluation_order: 5 },
      { rule_key: "max_transaction_amount", passed: true, result_message: "Within cap.", impact: "continue", evaluation_order: 6 },
      { rule_key: "fraud_review_required", passed: true, result_message: "No fraud pause.", impact: "continue", evaluation_order: 7 },
      { rule_key: "audit_record_required", passed: false, result_message: "Partner indicated settlement window slip; audit row deferred.", impact: "delay", evaluation_order: 8 },
    ],
  },
  {
    case_key: "fraud.signal.escalated",
    scenario_key: "fraud.signal.escalated",
    title: "Fraud signal — escalated",
    capability_key: "wallet.payment",
    environment: "sandbox",
    amount_preview: "750.00 USD",
    final_outcome: "review_required",
    rule_results: [
      { rule_key: "identity_verified", passed: true, result_message: "Verified.", impact: "continue", evaluation_order: 1 },
      { rule_key: "environment_allowed", passed: true, result_message: "Sandbox.", impact: "continue", evaluation_order: 2 },
      { rule_key: "capability_supported", passed: true, result_message: "Capability OK.", impact: "continue", evaluation_order: 3 },
      { rule_key: "dependencies_resolved", passed: true, result_message: "Dependencies OK.", impact: "continue", evaluation_order: 4 },
      { rule_key: "requires_idempotency", passed: true, result_message: "Idempotency OK.", impact: "continue", evaluation_order: 5 },
      { rule_key: "fraud_review_required", passed: false, result_message: "Sentinel-originated signal escalated to human review.", impact: "pause_for_review", evaluation_order: 6 },
      { rule_key: "audit_record_required", passed: true, result_message: "Audit plan OK.", impact: "continue", evaluation_order: 7 },
    ],
  },
  {
    case_key: "api.request.rate_limited",
    scenario_key: "api.request.rate_limited",
    title: "API request — rate limited",
    capability_key: "api.request",
    environment: "sandbox",
    amount_preview: "—",
    final_outcome: "rate_limited",
    rule_results: [
      { rule_key: "rate_limit_available", passed: false, result_message: "Caller exceeded requests-per-minute budget.", impact: "block", evaluation_order: 1 },
    ],
  },
  {
    case_key: "orchestration.stage.retryable_failure",
    scenario_key: "orchestration.stage.retryable_failure",
    title: "Orchestration stage — retryable failure",
    capability_key: "wallet.transfer",
    environment: "sandbox",
    amount_preview: "50.00 USD",
    final_outcome: "retryable_failure",
    rule_results: [
      { rule_key: "identity_verified", passed: true, result_message: "Verified.", impact: "continue", evaluation_order: 1 },
      { rule_key: "environment_allowed", passed: true, result_message: "Sandbox.", impact: "continue", evaluation_order: 2 },
      { rule_key: "capability_supported", passed: true, result_message: "Capability OK.", impact: "continue", evaluation_order: 3 },
      { rule_key: "dependencies_resolved", passed: false, result_message: "Downstream ledger read timed out (simulated transient).", impact: "retry", evaluation_order: 4 },
      { rule_key: "requires_idempotency", passed: true, result_message: "Not reached for outcome.", impact: "continue", evaluation_order: 5 },
    ],
  },
  {
    case_key: "integration.sync.completed",
    scenario_key: "integration.sync.completed",
    title: "Integration sync — completed",
    capability_key: "integration.reconcile",
    environment: "sandbox",
    amount_preview: "—",
    final_outcome: "allowed",
    rule_results: [
      { rule_key: "identity_verified", passed: true, result_message: "Internal sync identity OK.", impact: "continue", evaluation_order: 1 },
      { rule_key: "environment_allowed", passed: true, result_message: "Sandbox.", impact: "continue", evaluation_order: 2 },
      { rule_key: "capability_supported", passed: true, result_message: "integration.reconcile supported.", impact: "continue", evaluation_order: 3 },
      { rule_key: "dependencies_resolved", passed: true, result_message: "Triton + Sentinel connectors reachable (simulated).", impact: "continue", evaluation_order: 4 },
      { rule_key: "requires_idempotency", passed: true, result_message: "Idempotency OK.", impact: "continue", evaluation_order: 5 },
      { rule_key: "fraud_review_required", passed: true, result_message: "Read-only reconciliation path.", impact: "continue", evaluation_order: 6 },
      { rule_key: "audit_record_required", passed: true, result_message: "Audit bundle emitted.", impact: "continue", evaluation_order: 7 },
    ],
  },
];

export const DECISION_SIMULATION_SAFETY_RULES = [
  "The Decision Simulator explains outcomes from static seeds — it does not evaluate live traffic and does not call a real policy engine.",
  "evaluateDecisionCase() is a pure function: same case_key always returns the same object. No Date.now(), Math.random(), network, or Supabase.",
  "Rule pass/fail rows are authored for teaching and review. They are not produced by production fraud, treasury, or wallet systems.",
  "Reset and Evaluate only change React local state on the Decision Simulator page. No database writes occur.",
  "No API routes, workers, queues, schedulers, webhooks, or event emitters are introduced by Phase 3B.",
  "Treasury, wallet, withdrawal, PayPal, payout, and fraud execution modules are not imported and not modified.",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RULE_BY_KEY = Object.fromEntries(
  DECISION_SIMULATION_RULES.map((r) => [r.rule_key, r]),
);

export function getRuleByKey(ruleKey) {
  return RULE_BY_KEY[ruleKey] ?? null;
}

export function getRuleTypeMeta(typeKey) {
  return DECISION_SIMULATION_RULE_TYPES.find((t) => t.key === typeKey) ?? null;
}

export function getDecisionCaseByKey(caseKey) {
  return DECISION_SIMULATION_CASES.find((c) => c.case_key === caseKey) ?? null;
}

export function getRulesForCase(caseKey) {
  const c = getDecisionCaseByKey(caseKey);
  if (!c) return [];
  const sorted = [...c.rule_results].sort((a, b) => a.evaluation_order - b.evaluation_order);
  return sorted.map((rr) => {
    const def = getRuleByKey(rr.rule_key);
    return {
      ...rr,
      rule: def,
      type: def?.type ?? "policy",
      severity: def?.severity ?? "medium",
      label: def?.label ?? rr.rule_key,
      pass_message: def?.pass_message ?? "",
      fail_message: def?.fail_message ?? "",
      decision_if_failed: def?.decision_if_failed ?? "blocked",
    };
  });
}

/**
 * Walk sorted rule results to derive the simulated final outcome.
 * Order: first failing rule with block/retry/delay/pause_for_review wins.
 */
export function deriveOutcomeFromSortedResults(sortedResults) {
  let outcome = "allowed";
  for (const rr of sortedResults) {
    if (rr.passed) continue;
    if (rr.impact === "block") {
      const rule = getRuleByKey(rr.rule_key);
      return rule?.decision_if_failed ?? "blocked";
    }
    if (rr.impact === "pause_for_review") {
      return "review_required";
    }
    if (rr.impact === "retry") {
      return "retryable_failure";
    }
    if (rr.impact === "delay") {
      return "delayed";
    }
    if (rr.impact === "warn") {
      outcome = outcome === "allowed" ? "allowed" : outcome;
    }
  }
  return outcome;
}

function isTerminalSimulationOutcome(outcome) {
  const meta = DECISION_SIMULATION_OUTCOMES.find((o) => o.key === outcome);
  if (meta) return !!meta.terminalInSim;
  return outcome === "blocked" || outcome === "policy_not_satisfied" || outcome === "dependency_missing" || outcome === "sandbox_only";
}

/**
 * Full evaluation for a decision case: sorted rules, counts, derived outcome,
 * terminal flag, and consistency with seeded final_outcome.
 */
export function evaluateDecisionCase(caseKey, options = {}) {
  const c = getDecisionCaseByKey(caseKey);
  if (!c) return null;

  const sorted = [...c.rule_results].sort((a, b) => a.evaluation_order - b.evaluation_order);
  const passed_count = sorted.filter((r) => r.passed).length;
  const failed_count = sorted.filter((r) => !r.passed).length;
  const warning_count = sorted.filter((r) => r.impact === "warn").length;
  const blocking_count = sorted.filter((r) => !r.passed && r.impact === "block").length;
  const review_count = sorted.filter((r) => !r.passed && r.impact === "pause_for_review").length;

  const derived_outcome = deriveOutcomeFromSortedResults(sorted);
  const final_outcome = derived_outcome;
  const seeded_matches_derived = final_outcome === c.final_outcome;
  const terminal = isTerminalSimulationOutcome(final_outcome);
  const environment = options.environment ?? c.environment;

  return {
    case_key: c.case_key,
    scenario_key: c.scenario_key,
    title: c.title,
    capability_key: c.capability_key,
    environment,
    amount_preview: c.amount_preview,
    final_outcome,
    seeded_final_outcome: c.final_outcome,
    seeded_matches_derived,
    terminal,
    passed_count,
    failed_count,
    warning_count,
    blocking_count,
    review_count,
    sorted_rule_results: sorted,
  };
}

/**
 * Ordered decision trace with stop/pause markers for UI.
 */
export function buildDecisionTrace(evalResult) {
  if (!evalResult) return [];
  const sorted = evalResult.sorted_rule_results;
  let stopped = false;
  return sorted.map((rr, idx) => {
    const rule = getRuleByKey(rr.rule_key);
    let marker = "continue";
    if (!rr.passed) {
      if (rr.impact === "pause_for_review") marker = "pause";
      else if (rr.impact === "block" || rr.impact === "retry" || rr.impact === "delay") marker = "stop";
      else if (rr.impact === "warn") marker = "warn";
    }
    const isStop = !stopped && marker === "stop";
    const isPause = !stopped && marker === "pause";
    if (isStop || isPause) stopped = true;

    return {
      order: rr.evaluation_order,
      index: idx + 1,
      rule_key: rr.rule_key,
      label: rule?.label ?? rr.rule_key,
      passed: rr.passed,
      impact: rr.impact,
      marker,
      is_stop: isStop,
      is_pause: isPause,
      result_message: rr.result_message,
    };
  });
}

/**
 * Rows for rule evaluation table (merged with rule catalog).
 */
export function buildPolicyResultRows(evalResult) {
  if (!evalResult) return [];
  return getRulesForCase(evalResult.case_key);
}

/**
 * Human-readable summary object for the decision simulator UI.
 */
export function buildDecisionSummary(evalResult) {
  if (!evalResult) return null;
  const outcomeMeta = DECISION_SIMULATION_OUTCOMES.find((o) => o.key === evalResult.final_outcome);
  return {
    headline: evalResult.title,
    scenario_key: evalResult.scenario_key,
    capability_key: evalResult.capability_key,
    environment: evalResult.environment,
    amount_preview: evalResult.amount_preview,
    final_outcome: evalResult.final_outcome,
    final_outcome_label: outcomeMeta?.label ?? evalResult.final_outcome,
    final_outcome_description: outcomeMeta?.description ?? "",
    terminal: evalResult.terminal,
    passed_count: evalResult.passed_count,
    failed_count: evalResult.failed_count,
    warning_count: evalResult.warning_count,
    blocking_count: evalResult.blocking_count,
    review_count: evalResult.review_count,
    seeded_matches_derived: evalResult.seeded_matches_derived,
  };
}

export function getOutcomeMeta(outcomeKey) {
  return DECISION_SIMULATION_OUTCOMES.find((o) => o.key === outcomeKey) ?? null;
}

export function getSeverityMeta(severityKey) {
  return DECISION_SIMULATION_SEVERITIES.find((s) => s.key === severityKey) ?? DECISION_SIMULATION_SEVERITIES[1];
}

export function getOutcomeExplanation(outcomeKey) {
  const explanations = {
    allowed:
      "Every evaluated rule passed, or only produced non-blocking warnings. In this simulation the request would be authorized to proceed to execution (still simulated elsewhere — no real executor runs here).",
    review_required:
      "At least one rule failed with a pause-for-review impact, or a fraud-class rule required elevated review. The pipeline stops for human or elevated review; it is not a terminal failure in the same sense as a hard block.",
    delayed:
      "A rule failed with a delay-class impact: downstream timing or partner acknowledgment deferred completion without rejecting the envelope outright.",
    rate_limited:
      "The gateway-level rate budget rule failed before deeper pipeline rules. The caller is throttled; no money-moving stages are reached in this simulation.",
    retryable_failure:
      "A dependency or transient-stage rule failed with retry-class impact. The idempotency story assumes the same key can be retried after the transient condition clears.",
    blocked:
      "A rule failed with a hard block impact and a terminal decision (e.g. identity or audit hard failure). Execution must not proceed.",
    policy_not_satisfied:
      "A policy or constraint rule failed with a terminal policy outcome — the request does not satisfy a required predicate.",
    dependency_missing:
      "A dependency rule failed terminally — an upstream prerequisite is missing or not ready.",
    sandbox_only:
      "The integration or capability is sandbox-only while live gates are not satisfied; live traffic is rejected.",
  };
  return explanations[outcomeKey] ?? "Outcome derived from the seeded rule walk; see the rule table for specifics.";
}
