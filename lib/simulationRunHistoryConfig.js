/**
 * Phase 3C — Simulation Run History & Comparison.
 *
 * SIMULATION ONLY. This module:
 *   • does NOT read/write Supabase, call APIs, or touch the network
 *   • does NOT use Date.now(), Math.random(), workers, queues, schedulers,
 *     webhooks, or event emitters
 *   • does NOT persist runs — all rows are derived in-memory from static
 *     scenario seeds and pure decision evaluation
 *
 * `buildSimulationRunHistory()` merges `SIMULATION_RUN_HISTORY_SEEDS` with
 * `EXECUTION_SCENARIOS` and `evaluateDecisionCase()` so scenario/decision
 * logic is not duplicated.
 *
 * `buildSimulationHealthSummary()` returns a single object with top-level
 * rollups plus nested `by_category`, `by_final_state`, and
 * `by_decision_outcome` summaries (each an array of small aggregate rows).
 */

import { EXECUTION_SCENARIOS, getScenarioByKey, getScenarioCategory } from "./executionScenarioConfig";
import { evaluateDecisionCase } from "./runtimeDecisionSimulatorConfig";

export const SIMULATION_RUN_HISTORY_PHASE = "phase_3c_simulation_history";

export const SIMULATION_RUN_STATUSES = [
  {
    key: "completed",
    label: "Completed",
    description: "Execution reached a terminal success path in the simulator.",
  },
  {
    key: "review_required",
    label: "Review required",
    description: "Human or elevated review is required before proceeding.",
  },
  {
    key: "delayed",
    label: "Delayed",
    description: "Downstream timing deferred completion without failing the envelope.",
  },
  {
    key: "rate_limited",
    label: "Rate limited",
    description: "Caller exceeded an envelope budget at the gateway.",
  },
  {
    key: "retryable_failure",
    label: "Retryable failure",
    description: "Transient failure; idempotency key remains valid for retry.",
  },
  {
    key: "escalated",
    label: "Escalated",
    description: "Fraud or risk signal escalated; pipeline stopped mid-flight.",
  },
  {
    key: "blocked",
    label: "Blocked",
    description: "Hard gate failed; execution must not proceed.",
  },
];

export const SIMULATION_RUN_OUTCOME_GROUPS = [
  {
    key: "allowed",
    label: "Allowed",
    description:
      "Decision slice ended allowed while execution did not land in the completed-success bucket used for Phase 3C rollups.",
  },
  {
    key: "review",
    label: "Review",
    description: "Decision or execution posture requires review, escalation, or manual approval.",
  },
  {
    key: "operational_pause",
    label: "Operational pause",
    description: "Delayed, rate-limited, or retryable-failure style pauses without a clean terminal completion.",
  },
  {
    key: "blocked",
    label: "Blocked",
    description: "Blocked or policy-failure class outcomes on the decision walk.",
  },
  {
    key: "completed",
    label: "Completed",
    description: "Execution final_state is completed and the decision walk is allowed — clean simulator success.",
  },
];

/**
 * One seed per shared scenario (Phase 3A/3B keys). `buildSimulationRunHistory`
 * enriches these rows using execution + decision configs.
 */
export const SIMULATION_RUN_HISTORY_SEEDS = [
  {
    run_key: "sim_run_wallet_transfer_success",
    scenario_key: "wallet.transfer.success",
    created_at_simulated: "2026-05-13T08:00:00.000Z",
  },
  {
    run_key: "sim_run_wallet_transfer_review_required",
    scenario_key: "wallet.transfer.review_required",
    created_at_simulated: "2026-05-13T08:18:22.000Z",
  },
  {
    run_key: "sim_run_withdrawal_pending_review",
    scenario_key: "withdrawal.pending_review",
    created_at_simulated: "2026-05-13T08:36:05.000Z",
  },
  {
    run_key: "sim_run_withdrawal_completed",
    scenario_key: "withdrawal.completed",
    created_at_simulated: "2026-05-13T08:52:41.000Z",
  },
  {
    run_key: "sim_run_trading_profit_payout",
    scenario_key: "trading.profit_payout",
    created_at_simulated: "2026-05-13T09:10:09.000Z",
  },
  {
    run_key: "sim_run_merchant_settlement_delayed",
    scenario_key: "merchant.settlement.delayed",
    created_at_simulated: "2026-05-13T09:28:33.000Z",
  },
  {
    run_key: "sim_run_fraud_signal_escalated",
    scenario_key: "fraud.signal.escalated",
    created_at_simulated: "2026-05-13T09:44:17.000Z",
  },
  {
    run_key: "sim_run_api_request_rate_limited",
    scenario_key: "api.request.rate_limited",
    created_at_simulated: "2026-05-13T10:01:50.000Z",
  },
  {
    run_key: "sim_run_orchestration_stage_retryable_failure",
    scenario_key: "orchestration.stage.retryable_failure",
    created_at_simulated: "2026-05-13T10:19:02.000Z",
  },
  {
    run_key: "sim_run_integration_sync_completed",
    scenario_key: "integration.sync.completed",
    created_at_simulated: "2026-05-13T10:37:44.000Z",
  },
];

export const SIMULATION_COMPARISON_METRICS = [
  { key: "scenario_final_state", label: "Execution final state", description: "Terminal-ish state from Phase 3A scenario seed." },
  { key: "decision_outcome", label: "Decision outcome", description: "Outcome from evaluateDecisionCase (Phase 3B walk)." },
  { key: "scenario_decision_aligned", label: "Scenario ↔ decision aligned", description: "Heuristic agreement between execution story and rule walk." },
  { key: "simulated_duration_ms", label: "Simulated duration (ms)", description: "Scenario.execution_duration_ms." },
  { key: "emitted_event_count", label: "Emitted events (count)", description: "Scenario.emits_events." },
  { key: "failed_rule_count", label: "Failed rules", description: "From evaluateDecisionCase failed_count." },
  { key: "warning_rule_count", label: "Warning impacts", description: "From evaluateDecisionCase warning_count." },
  { key: "review_rule_count", label: "Review pauses (rules)", description: "From evaluateDecisionCase review_count." },
  { key: "checkpoint_final_status", label: "Final checkpoint status", description: "Last timeline entry checkpoint_status." },
  { key: "correlation_target_count", label: "Correlation targets", description: "Len(correlation_targets) on the scenario." },
];

export const SIMULATION_RUN_HISTORY_SAFETY_RULES = [
  "Phase 3C run history is synthesized from static seeds and pure helpers — nothing is written to Supabase or any database.",
  "No API routes, workers, queues, schedulers, webhooks, or event emitters are invoked; there is no network I/O.",
  "Timestamps are fixed per seed (created_at_simulated); the module does not use Date.now() or Math.random().",
  "Treasury, wallet, withdrawal, PayPal, payout, and live fraud execution paths are not imported or executed here.",
];

const BLOCKING_DECISION_OUTCOMES = new Set([
  "blocked",
  "policy_not_satisfied",
  "dependency_missing",
  "sandbox_only",
]);

function mapExecutionFinalStateToRunStatus(finalState) {
  if (finalState === "pending_review") return "review_required";
  const allowed = new Set(SIMULATION_RUN_STATUSES.map((s) => s.key));
  if (allowed.has(finalState)) return finalState;
  return "completed";
}

function lastTimelineCheckpointStatus(scenario) {
  const tl = scenario?.timeline ?? [];
  if (!tl.length) return "unknown";
  return tl[tl.length - 1]?.checkpoint_status ?? "unknown";
}

function deriveOutcomeGroup({ decision_outcome, final_state }) {
  if (BLOCKING_DECISION_OUTCOMES.has(decision_outcome)) return "blocked";
  if (
    decision_outcome === "delayed" ||
    decision_outcome === "rate_limited" ||
    decision_outcome === "retryable_failure" ||
    final_state === "delayed" ||
    final_state === "rate_limited" ||
    final_state === "retryable_failure"
  ) {
    return "operational_pause";
  }
  if (
    decision_outcome === "review_required" ||
    final_state === "review_required" ||
    final_state === "pending_review" ||
    final_state === "escalated"
  ) {
    return "review";
  }
  if (decision_outcome === "allowed" && final_state === "completed") {
    return "completed";
  }
  if (decision_outcome === "allowed") return "allowed";
  return "review";
}

/**
 * Heuristic agreement between Phase 3A execution final_state and Phase 3B
 * evaluateDecisionCase outcome. Some pairs are intentionally divergent for
 * teaching (e.g. trading.profit_payout: timeline completes while the decision
 * slice stops at review_required).
 */
function scenarioDecisionAligned(finalState, decisionOutcome) {
  if (decisionOutcome === "allowed" && finalState === "completed") return true;
  if (
    decisionOutcome === "review_required" &&
    (finalState === "review_required" || finalState === "pending_review" || finalState === "escalated")
  ) {
    return true;
  }
  if (decisionOutcome === "delayed" && finalState === "delayed") return true;
  if (decisionOutcome === "rate_limited" && finalState === "rate_limited") return true;
  if (decisionOutcome === "retryable_failure" && finalState === "retryable_failure") return true;
  return false;
}

function enrichSeed(seed) {
  const scenario = getScenarioByKey(seed.scenario_key);
  if (!scenario) return null;

  const evaluation = evaluateDecisionCase(seed.scenario_key, {
    environment: scenario.environment ?? "sandbox",
  });
  const decision_outcome = evaluation?.final_outcome ?? "blocked";
  const failed_rule_count = evaluation?.failed_count ?? 0;
  const warning_rule_count = evaluation?.warning_count ?? 0;
  const review_rule_count = evaluation?.review_count ?? 0;

  const final_state = scenario.final_state;
  const run_status = mapExecutionFinalStateToRunStatus(final_state);
  const review_required =
    !!scenario.requires_review ||
    decision_outcome === "review_required" ||
    run_status === "review_required";

  const outcome_group_key = deriveOutcomeGroup({
    decision_outcome,
    final_state,
  });

  return {
    run_key: seed.run_key,
    scenario_key: seed.scenario_key,
    decision_case_key: seed.scenario_key,
    title: scenario.title,
    category: scenario.category,
    environment: scenario.environment ?? "sandbox",
    final_state,
    decision_outcome,
    run_status,
    review_required,
    simulated_duration_ms: scenario.execution_duration_ms,
    emitted_event_count: scenario.emits_events,
    failed_rule_count,
    warning_rule_count,
    review_rule_count,
    checkpoint_final_status: lastTimelineCheckpointStatus(scenario),
    correlation_target_count: (scenario.correlation_targets ?? []).length,
    created_at_simulated: seed.created_at_simulated,
    outcome_group_key,
    scenario_decision_aligned: scenarioDecisionAligned(final_state, decision_outcome),
  };
}

export function getSimulationRunByKey(runKey) {
  return buildSimulationRunHistory().find((r) => r.run_key === runKey) ?? null;
}

export function buildSimulationRunHistory() {
  const fromSeeds = SIMULATION_RUN_HISTORY_SEEDS.map(enrichSeed).filter(Boolean);
  const seen = new Set(fromSeeds.map((r) => r.scenario_key));
  const extra = EXECUTION_SCENARIOS.filter((s) => !seen.has(s.scenario_key)).map((s) =>
    enrichSeed({
      run_key: `sim_run_${s.scenario_key.replace(/\./g, "_")}`,
      scenario_key: s.scenario_key,
      created_at_simulated: "1970-01-01T00:00:00.000Z",
    }),
  );
  return [...fromSeeds, ...extra.filter(Boolean)];
}

function countByKey(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const k = keyFn(item);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([key, count]) => ({ key, count }));
}

export function buildSimulationOutcomeDistribution() {
  const runs = buildSimulationRunHistory();
  return SIMULATION_RUN_OUTCOME_GROUPS.map((g) => ({
    outcome_group_key: g.key,
    label: g.label,
    description: g.description,
    count: runs.filter((r) => r.outcome_group_key === g.key).length,
  }));
}

export function buildSimulationFinalStateDistribution() {
  const runs = buildSimulationRunHistory();
  return countByKey(runs, (r) => r.final_state).sort((a, b) => a.key.localeCompare(b.key));
}

export function buildReviewRequiredRuns() {
  return buildSimulationRunHistory().filter((r) => r.review_required);
}

export function buildBlockedOrPausedRuns() {
  return buildSimulationRunHistory().filter((r) => r.outcome_group_key !== "completed");
}

export function buildSimulationComparisonRows() {
  return buildSimulationRunHistory().map((r) => ({
    run_key: r.run_key,
    scenario_key: r.scenario_key,
    scenario_final_state: r.final_state,
    decision_outcome: r.decision_outcome,
    scenario_decision_aligned: r.scenario_decision_aligned,
    simulated_duration_ms: r.simulated_duration_ms,
    emitted_event_count: r.emitted_event_count,
    failed_rule_count: r.failed_rule_count,
    warning_rule_count: r.warning_rule_count,
    review_rule_count: r.review_rule_count,
    checkpoint_final_status: r.checkpoint_final_status,
    correlation_target_count: r.correlation_target_count,
  }));
}

export function buildScenarioDecisionComparison() {
  return buildSimulationRunHistory().map((r) => ({
    scenario_key: r.scenario_key,
    run_key: r.run_key,
    final_state: r.final_state,
    decision_outcome: r.decision_outcome,
    scenario_decision_aligned: r.scenario_decision_aligned,
    notes: r.scenario_decision_aligned
      ? "Execution story and decision walk agree for Phase 3C heuristics."
      : "Execution timeline and decision walk diverge — useful for teaching cross-layer tension.",
  }));
}

/**
 * @returns {{
 *   phase: string,
 *   total_runs: number,
 *   allowed_count: number,
 *   review_required_count: number,
 *   delayed_count: number,
 *   rate_limited_count: number,
 *   retryable_failure_count: number,
 *   blocked_count: number,
 *   avg_simulated_duration_ms: number,
 *   avg_emitted_events: number,
 *   total_failed_rules: number,
 *   total_warning_rules: number,
 *   total_review_rules: number,
 *   unique_categories: string[],
 *   unique_correlation_targets: string[],
 *   divergent_alignment_count: number,
 *   by_category: { category_key: string, label: string, run_count: number, avg_simulated_duration_ms: number }[],
 *   by_final_state: { final_state: string, count: number }[],
 *   by_decision_outcome: { decision_outcome: string, count: number }[],
 * }}
 */
export function buildSimulationHealthSummary() {
  const runs = buildSimulationRunHistory();
  const n = runs.length || 1;

  const allowed_count = runs.filter((r) => r.decision_outcome === "allowed").length;
  const review_required_count = runs.filter((r) => r.review_required).length;
  const delayed_count = runs.filter((r) => r.run_status === "delayed").length;
  const rate_limited_count = runs.filter((r) => r.run_status === "rate_limited").length;
  const retryable_failure_count = runs.filter((r) => r.run_status === "retryable_failure").length;
  const blocked_count = runs.filter((r) => r.run_status === "blocked").length;

  const sumDuration = runs.reduce((a, r) => a + r.simulated_duration_ms, 0);
  const sumEvents = runs.reduce((a, r) => a + r.emitted_event_count, 0);
  const total_failed_rules = runs.reduce((a, r) => a + r.failed_rule_count, 0);
  const total_warning_rules = runs.reduce((a, r) => a + r.warning_rule_count, 0);
  const total_review_rules = runs.reduce((a, r) => a + r.review_rule_count, 0);

  const catKeys = [...new Set(runs.map((r) => r.category))].sort();
  const unique_categories = catKeys;

  const corrSet = new Set();
  for (const r of runs) {
    const sc = getScenarioByKey(r.scenario_key);
    for (const t of sc?.correlation_targets ?? []) corrSet.add(t);
  }
  const unique_correlation_targets = [...corrSet].sort();

  const by_category = catKeys.map((category_key) => {
    const catRuns = runs.filter((r) => r.category === category_key);
    const meta = getScenarioCategory(category_key);
    const avgMs =
      catRuns.reduce((a, r) => a + r.simulated_duration_ms, 0) / (catRuns.length || 1);
    return {
      category_key,
      label: meta.label,
      run_count: catRuns.length,
      avg_simulated_duration_ms: avgMs,
    };
  });

  const by_final_state = countByKey(runs, (r) => r.final_state).map(({ key, count }) => ({
    final_state: key,
    count,
  }));

  const by_decision_outcome = countByKey(runs, (r) => r.decision_outcome).map(({ key, count }) => ({
    decision_outcome: key,
    count,
  }));

  const divergent_alignment_count = runs.filter((r) => !r.scenario_decision_aligned).length;

  return {
    phase: SIMULATION_RUN_HISTORY_PHASE,
    total_runs: runs.length,
    allowed_count,
    review_required_count,
    delayed_count,
    rate_limited_count,
    retryable_failure_count,
    blocked_count,
    avg_simulated_duration_ms: sumDuration / n,
    avg_emitted_events: sumEvents / n,
    total_failed_rules,
    total_warning_rules,
    total_review_rules,
    unique_categories,
    unique_correlation_targets,
    divergent_alignment_count,
    by_category,
    by_final_state,
    by_decision_outcome,
  };
}
