/**
 * Phase 3D — Runtime Policy Visualization & Dependency Graphs.
 *
 * VISUALIZATION + STATIC ANALYSIS ONLY. This module:
 *   • does NOT enforce policies, execute graphs, or call APIs
 *   • does NOT read/write Supabase, mutate databases, or use the network
 *   • does NOT use Date.now(), Math.random(), timers, workers, or queues
 *   • does NOT import treasury, wallet, withdrawal, PayPal, fraud execution
 *
 * All graph shapes are derived from Phase 2C capabilities, Phase 3B decision
 * simulation seeds, and Phase 3C run history helpers.
 */

import { BLUE_ATLANTIC_SERVICE_SEEDS, INTERNAL_PERMISSION_SEEDS } from "./internalServiceRegistryConfig";
import {
  INTERNAL_CAPABILITY_SEEDS,
  INTERNAL_DEPENDENCY_SEEDS,
  INTERNAL_CONSTRAINT_SEEDS,
  getCapabilityDependencies,
  getCapabilityConstraints,
} from "./internalCapabilityConfig";
import {
  DECISION_SIMULATION_RULES,
  DECISION_SIMULATION_CASES,
  getRuleByKey,
} from "./runtimeDecisionSimulatorConfig";
import { buildSimulationRunHistory } from "./simulationRunHistoryConfig";

export const RUNTIME_POLICY_GRAPH_PHASE = "phase_3d_policy_graphs";

export const GRAPH_NODE_TYPES = [
  {
    key: "capability",
    label: "Capability",
    description: "Registered internal capability from the Phase 2C registry seeds.",
  },
  {
    key: "dependency",
    label: "Dependency",
    description: "A prerequisite edge artifact between capabilities (requires / blocks / audit).",
  },
  {
    key: "rule",
    label: "Rule",
    description: "Decision simulation rule from the Phase 3B catalog.",
  },
  {
    key: "policy",
    label: "Policy",
    description: "Policy-class gate in the decision catalog (subset of rules typed as policy).",
  },
  {
    key: "constraint",
    label: "Constraint",
    description: "Operational constraint attached to a capability (Phase 2C seeds).",
  },
  {
    key: "scenario",
    label: "Scenario",
    description: "Execution or decision scenario context (Phase 3A/3B shared keys).",
  },
  {
    key: "decision",
    label: "Decision outcome",
    description: "Terminal or paused outcome key from the decision vocabulary.",
  },
  {
    key: "review",
    label: "Review",
    description: "Human or elevated review queue node in routing visualizations.",
  },
  {
    key: "environment",
    label: "Environment",
    description: "Sandbox vs live envelope for a decision case.",
  },
  {
    key: "service",
    label: "Service",
    description: "Blue Atlantic internal integration identity (Phase 2A seeds).",
  },
];

export const GRAPH_EDGE_TYPES = [
  { key: "requires", label: "Requires", description: "Hard prerequisite between capabilities." },
  { key: "blocks_without", label: "Blocks without", description: "Invocation blocked until a prerequisite is satisfied." },
  { key: "audit_requires", label: "Audit requires", description: "Downstream audit completeness dependency." },
  { key: "evaluates", label: "Evaluates", description: "Ordered policy or rule evaluation step." },
  { key: "produces", label: "Produces", description: "Produces readiness, outcome, or derived artifact." },
  { key: "routes_to_review", label: "Routes to review", description: "Path pauses for human or elevated review." },
  { key: "delays", label: "Delays", description: "Defers completion without hard-failing the envelope." },
  { key: "rate_limits", label: "Rate limits", description: "Throttle or budget exhaustion path." },
  { key: "escalates", label: "Escalates", description: "Risk or fraud class escalation into review." },
  { key: "correlates", label: "Correlates", description: "Cross-links capabilities, services, or transient correlation." },
];

export const GRAPH_RISK_LEVELS = [
  { key: "low", label: "Low", description: "Read-only or low-sensitivity static visualization." },
  { key: "medium", label: "Medium", description: "Sensitive reads or policy gates with moderate blast radius." },
  { key: "high", label: "High", description: "Money-moving adjacent or review-heavy static paths." },
  { key: "critical", label: "Critical", description: "Highest static risk concentration in the merged graph." },
];

export const GRAPH_VIEW_MODES = [
  {
    key: "capability_dependencies",
    label: "Capability dependencies",
    description: "Phase 2C capabilities, dependency bridges, and internal service correlation.",
  },
  {
    key: "policy_gates",
    label: "Policy gates",
    description: "Phase 3B rule catalog in canonical order with failure routing edges.",
  },
  {
    key: "scenario_rules",
    label: "Scenario rules",
    description: "Per decision case: scenario, environment, ordered rules, and final outcome.",
  },
  {
    key: "review_routing",
    label: "Review routing",
    description: "Simulation runs that require review, routed into review and outcome nodes.",
  },
  {
    key: "risk_concentration",
    label: "Risk concentration",
    description: "Aggregated counts of high/critical surfaces and top failure drivers.",
  },
];

export const POLICY_GRAPH_SAFETY_RULES = [
  "Phase 3D graphs are documentation and teaching artifacts — they do not enforce runtime policy or mutate any system.",
  "All node and edge shapes are built from static seeds and pure helpers; there is no Date.now(), Math.random(), network I/O, or Supabase access in this module.",
  "Graphs are not executed: there is no traversal engine, scheduler, worker, queue, webhook, or emitter.",
  "Treasury, wallet ledger, withdrawal, PayPal, payout, and live fraud execution modules are not imported here and are not modified by this phase.",
  "Decision outcomes shown beside capabilities are simulation-only; they do not reflect production traffic or live policy evaluation.",
  "Service correlation edges are static best-effort joins where internal permission keys match capability keys — not live service mesh discovery.",
];

/** @typedef {{ node_id: string, label: string, type: string, risk_level: string, status: string, description: string, metadata?: Record<string, unknown> }} GraphNode */
/** @typedef {{ edge_id: string, source: string, target: string, type: string, label: string, risk_level: string, description: string }} GraphEdge */

function node(node_id, label, type, risk_level, status, description, metadata = {}) {
  return { node_id, label, type, risk_level, status, description, metadata };
}

function edge(edge_id, source, target, type, label, risk_level, description) {
  return { edge_id, source, target, type, label, risk_level, description };
}

const CAPABILITY_KEYS = new Set(INTERNAL_CAPABILITY_SEEDS.map((c) => c.capabilityKey));

function failureEdgeType(decisionIfFailed) {
  if (decisionIfFailed === "review_required") return "routes_to_review";
  if (decisionIfFailed === "rate_limited") return "rate_limits";
  if (decisionIfFailed === "delayed") return "delays";
  if (decisionIfFailed === "retryable_failure") return "correlates";
  return "blocks_without";
}

function scenarioFailureEdgeType(rr) {
  if (!rr.passed && rr.impact === "pause_for_review") {
    const def = getRuleByKey(rr.rule_key);
    if (def?.type === "fraud") return "escalates";
    return "routes_to_review";
  }
  if (!rr.passed && rr.impact === "block") return "blocks_without";
  if (!rr.passed && rr.impact === "delay") return "delays";
  if (!rr.passed && rr.impact === "retry") return "correlates";
  return "evaluates";
}

/**
 * @returns {{ nodes: GraphNode[], edges: GraphEdge[] }}
 */
export function buildCapabilityDependencyGraph() {
  /** @type {GraphNode[]} */
  const nodes = [];
  /** @type {GraphEdge[]} */
  const edges = [];

  for (const cap of INTERNAL_CAPABILITY_SEEDS) {
    nodes.push(
      node(
        `cap:${cap.capabilityKey}`,
        cap.capabilityLabel,
        "capability",
        cap.riskLevel,
        cap.lifecycleStatus,
        cap.description,
        { capabilityKey: cap.capabilityKey, category: cap.category },
      ),
    );
  }

  for (const cst of INTERNAL_CONSTRAINT_SEEDS) {
    const nid = `cst:${cst.capabilityKey}:${cst.constraintKey}:${cst.environment}`;
    nodes.push(
      node(
        nid,
        cst.constraintLabel,
        "constraint",
        cst.riskLevel,
        cst.enforcementStatus,
        cst.description,
        {
          capabilityKey: cst.capabilityKey,
          constraintKey: cst.constraintKey,
          environment: cst.environment,
        },
      ),
    );
    edges.push(
      edge(
        `e_cst:${cst.capabilityKey}:${cst.constraintKey}:${cst.environment}`,
        `cap:${cst.capabilityKey}`,
        nid,
        "evaluates",
        `Constraint (${cst.environment})`,
        cst.riskLevel,
        "Static link from capability to its operational constraint row.",
      ),
    );
  }

  for (let i = 0; i < INTERNAL_DEPENDENCY_SEEDS.length; i += 1) {
    const dep = INTERNAL_DEPENDENCY_SEEDS[i];
    const depNodeId = `dep:${dep.capabilityKey}:${dep.dependencyKey}:${dep.dependencyType}`;
    nodes.push(
      node(
        depNodeId,
        `${dep.dependencyType}: ${dep.dependencyKey}`,
        "dependency",
        "medium",
        "defined",
        dep.description,
        {
          capabilityKey: dep.capabilityKey,
          dependencyKey: dep.dependencyKey,
          dependencyType: dep.dependencyType,
        },
      ),
    );
    const depType = dep.dependencyType;
    const allowed = new Set(["requires", "blocks_without", "audit_requires"]);
    const edgeType = allowed.has(depType) ? depType : "requires";
    edges.push(
      edge(
        `e_dep_in:${i}`,
        `cap:${dep.capabilityKey}`,
        depNodeId,
        edgeType,
        dep.dependencyType,
        "medium",
        "Dependent capability to dependency bridge.",
      ),
    );
    edges.push(
      edge(
        `e_dep_out:${i}`,
        depNodeId,
        `cap:${dep.dependencyKey}`,
        "produces",
        "Prerequisite capability",
        "low",
        "Bridge resolves to the prerequisite capability node.",
      ),
    );
  }

  for (const svc of BLUE_ATLANTIC_SERVICE_SEEDS) {
    nodes.push(
      node(
        `svc:${svc.serviceKey}`,
        svc.serviceName,
        "service",
        "low",
        svc.status,
        svc.description,
        { serviceKey: svc.serviceKey, platform: svc.platform },
      ),
    );
    const perms = INTERNAL_PERMISSION_SEEDS[svc.serviceKey] ?? [];
    for (const p of perms) {
      if (CAPABILITY_KEYS.has(p.permissionKey)) {
        edges.push(
          edge(
            `e_corr:${svc.serviceKey}:${p.permissionKey}`,
            `cap:${p.permissionKey}`,
            `svc:${svc.serviceKey}`,
            "correlates",
            `Internal permission: ${p.permissionKey}`,
            p.riskLevel ?? "medium",
            "Static correlation where permission key matches a seeded capability key.",
          ),
        );
      }
    }
  }

  return { nodes, edges };
}

/**
 * @returns {{ nodes: GraphNode[], edges: GraphEdge[] }}
 */
export function buildPolicyGateGraph() {
  const nodes = [];
  const edges = [];

  nodes.push(
    node(
      "policy:envelope",
      "Decision simulation gate stack",
      "policy",
      "medium",
      "defined",
      "Canonical catalog order for Phase 3B rules — visualization only.",
      { phase: RUNTIME_POLICY_GRAPH_PHASE },
    ),
  );

  const rules = [...DECISION_SIMULATION_RULES];
  const outcomeKeys = new Set();
  for (const r of rules) {
    outcomeKeys.add(r.decision_if_failed);
  }
  outcomeKeys.add("allowed");

  for (const ok of [...outcomeKeys].sort((a, b) => a.localeCompare(b))) {
    nodes.push(
      node(
        `out:${ok}`,
        ok.replace(/_/g, " "),
        "decision",
        ok === "allowed" ? "low" : "high",
        "terminal",
        `Outcome slice: ${ok}`,
        { outcomeKey: ok },
      ),
    );
  }

  let prevId = "policy:envelope";
  for (let i = 0; i < rules.length; i += 1) {
    const r = rules[i];
    const isPolicyRule = r.type === "policy";
    const nid = `rule:${r.rule_key}`;
    nodes.push(
      node(
        nid,
        r.label,
        isPolicyRule ? "policy" : "rule",
        r.severity ?? "medium",
        "defined",
        r.description,
        { rule_key: r.rule_key, rule_type: r.type, evaluation_index: i },
      ),
    );
    edges.push(
      edge(
        `e_pg_eval:${i}`,
        prevId,
        nid,
        "evaluates",
        i === 0 ? "Enter rule stack" : "Next gate",
        "medium",
        "Ordered evaluation (catalog index).",
      ),
    );
    prevId = nid;

    const ft = failureEdgeType(r.decision_if_failed);
    edges.push(
      edge(
        `e_pg_fail:${r.rule_key}`,
        nid,
        `out:${r.decision_if_failed}`,
        ft,
        `If failed → ${r.decision_if_failed}`,
        r.severity ?? "medium",
        r.fail_message ?? "",
      ),
    );
  }

  edges.push(
    edge(
      "e_pg_all_pass",
      prevId,
      "out:allowed",
      "produces",
      "If all rules pass (not shown per slice)",
      "low",
      "Terminal allowed slice when no failure edge fires first in a real walk.",
    ),
  );

  return { nodes, edges };
}

/**
 * @returns {{ nodes: GraphNode[], edges: GraphEdge[] }}
 */
export function buildScenarioRuleGraph() {
  const nodes = [];
  const edges = [];

  for (const c of DECISION_SIMULATION_CASES) {
    const scenId = `sr_scen:${c.case_key}`;
    const envId = `sr_env:${c.case_key}`;
    const outId = `sr_out:${c.case_key}`;

    nodes.push(
      node(scenId, c.title, "scenario", "medium", "defined", `Case ${c.case_key}`, {
        case_key: c.case_key,
        scenario_key: c.scenario_key,
      }),
    );
    nodes.push(
      node(envId, c.environment, "environment", "low", "defined", "Request environment for this case.", {
        case_key: c.case_key,
      }),
    );
    nodes.push(
      node(
        outId,
        c.final_outcome.replace(/_/g, " "),
        "decision",
        c.final_outcome === "allowed" ? "low" : "high",
        "terminal",
        "Seeded final outcome for this scenario slice.",
        { case_key: c.case_key, final_outcome: c.final_outcome },
      ),
    );

    edges.push(
      edge(`e_sr_se:${c.case_key}`, scenId, envId, "correlates", "Environment envelope", "low", "Case to environment."),
    );

    const sorted = [...c.rule_results].sort((a, b) => a.evaluation_order - b.evaluation_order);
    let prev = envId;
    for (let i = 0; i < sorted.length; i += 1) {
      const rr = sorted[i];
      const def = getRuleByKey(rr.rule_key);
      const rid = `sr_rule:${c.case_key}:${rr.evaluation_order}`;
      nodes.push(
        node(
          rid,
          def?.label ?? rr.rule_key,
          "rule",
          def?.severity ?? "medium",
          rr.passed ? "passed" : "failed",
          rr.result_message,
          { case_key: c.case_key, rule_key: rr.rule_key, passed: rr.passed, impact: rr.impact },
        ),
      );
      edges.push(
        edge(
          `e_sr_ev:${c.case_key}:${rr.evaluation_order}`,
          prev,
          rid,
          "evaluates",
          `Step ${rr.evaluation_order}`,
          def?.severity ?? "medium",
          "Rule step in evaluation order.",
        ),
      );
      prev = rid;

      if (!rr.passed) {
        const et = scenarioFailureEdgeType(rr);
        edges.push(
          edge(
            `e_sr_stop:${c.case_key}:${rr.evaluation_order}`,
            rid,
            outId,
            et,
            `Impact: ${rr.impact}`,
            def?.severity ?? "high",
            rr.result_message,
          ),
        );
        break;
      }
    }

    const last = sorted[sorted.length - 1];
    if (last?.passed) {
      edges.push(
        edge(
          `e_sr_ok:${c.case_key}`,
          `sr_rule:${c.case_key}:${last.evaluation_order}`,
          outId,
          "produces",
          "All evaluated rules passed",
          "low",
          "Walk completes in allowed slice for this case.",
        ),
      );
    }
  }

  return { nodes, edges };
}

/**
 * @returns {{ nodes: GraphNode[], edges: GraphEdge[] }}
 */
export function buildReviewRoutingGraph() {
  const nodes = [];
  const edges = [];
  const runs = buildSimulationRunHistory().filter((r) => r.review_required);

  for (const r of runs) {
    const runN = `rr_run:${r.run_key}`;
    const revN = `rr_review:${r.run_key}`;
    const outN = `rr_out:${r.run_key}`;

    nodes.push(
      node(runN, r.title, "scenario", "medium", r.run_status, `Scenario ${r.scenario_key}`, {
        run_key: r.run_key,
        scenario_key: r.scenario_key,
      }),
    );
    nodes.push(
      node(
        revN,
        "Review queue (simulated)",
        "review",
        "high",
        "review",
        "Elevated or manual review pause derived from Phase 3C seeds.",
        { run_key: r.run_key },
      ),
    );
    nodes.push(
      node(
        outN,
        r.decision_outcome.replace(/_/g, " "),
        "decision",
        r.decision_outcome === "allowed" ? "low" : "high",
        r.run_status,
        "Merged execution + decision posture for this run.",
        { run_key: r.run_key, decision_outcome: r.decision_outcome },
      ),
    );

    edges.push(
      edge(`e_rr_rt:${r.run_key}`, runN, revN, "routes_to_review", "Review required", "high", "Run flagged for review."),
    );
    edges.push(
      edge(`e_rr_ev:${r.run_key}`, revN, outN, "evaluates", "Review disposition", "medium", "Review node to summarized outcome."),
    );
  }

  return { nodes, edges };
}

function ruleFailureCountsFromCases() {
  const map = new Map();
  for (const c of DECISION_SIMULATION_CASES) {
    for (const rr of c.rule_results) {
      if (rr.passed) continue;
      map.set(rr.rule_key, (map.get(rr.rule_key) ?? 0) + 1);
    }
  }
  return map;
}

/**
 * @returns {{
 *   high_critical_capabilities: number,
 *   high_critical_rules: number,
 *   high_critical_constraints: number,
 *   review_heavy_runs: number,
 *   blocked_or_paused_runs: number,
 *   top_rule_failure_drivers: { rule_key: string, label: string, failure_count: number }[],
 * }}
 */
export function buildRiskConcentrationSummary() {
  const hcCap = INTERNAL_CAPABILITY_SEEDS.filter((c) => c.riskLevel === "high" || c.riskLevel === "critical").length;
  const hcRules = DECISION_SIMULATION_RULES.filter((r) => r.severity === "high" || r.severity === "critical").length;
  const hcCst = INTERNAL_CONSTRAINT_SEEDS.filter((c) => c.riskLevel === "high" || c.riskLevel === "critical").length;
  const runs = buildSimulationRunHistory();
  const reviewHeavy = runs.filter((r) => r.review_required || r.review_rule_count > 0).length;
  const blockedPaused = runs.filter((r) => r.outcome_group_key !== "completed").length;
  const failMap = ruleFailureCountsFromCases();
  const top_rule_failure_drivers = [...failMap.entries()]
    .map(([rule_key, failure_count]) => ({
      rule_key,
      label: getRuleByKey(rule_key)?.label ?? rule_key,
      failure_count,
    }))
    .sort((a, b) => b.failure_count - a.failure_count || a.rule_key.localeCompare(b.rule_key));

  return {
    high_critical_capabilities: hcCap,
    high_critical_rules: hcRules,
    high_critical_constraints: hcCst,
    review_heavy_runs: reviewHeavy,
    blocked_or_paused_runs: blockedPaused,
    top_rule_failure_drivers,
  };
}

/**
 * @returns {{
 *   rule_key: string,
 *   label: string,
 *   appearances_in_cases: number,
 *   failures_in_cases: number,
 *   review_impacts: number,
 *   block_impacts: number,
 *   delay_impacts: number,
 *   retry_impacts: number,
 *   appearances_in_run_history: number,
 * }[]}
 */
export function buildRulePressureSummary() {
  const byRule = new Map();

  function bump(key, field, n = 1) {
    if (!byRule.has(key)) {
      byRule.set(key, {
        rule_key: key,
        label: getRuleByKey(key)?.label ?? key,
        appearances_in_cases: 0,
        failures_in_cases: 0,
        review_impacts: 0,
        block_impacts: 0,
        delay_impacts: 0,
        retry_impacts: 0,
        appearances_in_run_history: 0,
      });
    }
    const row = byRule.get(key);
    row[field] += n;
  }

  for (const c of DECISION_SIMULATION_CASES) {
    const seen = new Set();
    for (const rr of c.rule_results) {
      bump(rr.rule_key, "appearances_in_cases");
      if (!rr.passed) bump(rr.rule_key, "failures_in_cases");
      if (!rr.passed && rr.impact === "pause_for_review") bump(rr.rule_key, "review_impacts");
      if (!rr.passed && rr.impact === "block") bump(rr.rule_key, "block_impacts");
      if (!rr.passed && rr.impact === "delay") bump(rr.rule_key, "delay_impacts");
      if (!rr.passed && rr.impact === "retry") bump(rr.rule_key, "retry_impacts");
      seen.add(rr.rule_key);
    }
  }

  const caseByScenario = Object.fromEntries(
    DECISION_SIMULATION_CASES.map((c) => [c.scenario_key, c]),
  );

  for (const run of buildSimulationRunHistory()) {
    const c = caseByScenario[run.scenario_key];
    if (!c) continue;
    const keys = new Set(c.rule_results.map((rr) => rr.rule_key));
    for (const k of keys) bump(k, "appearances_in_run_history");
  }

  return [...byRule.values()].sort((a, b) => {
    if (b.failures_in_cases !== a.failures_in_cases) return b.failures_in_cases - a.failures_in_cases;
    if (b.review_impacts !== a.review_impacts) return b.review_impacts - a.review_impacts;
    return a.rule_key.localeCompare(b.rule_key);
  });
}

/**
 * @returns {{
 *   capability_key: string,
 *   label: string,
 *   dependency_count: number,
 *   constraint_count: number,
 *   risk_level: string,
 *   supports_sandbox: boolean,
 *   supports_live: boolean,
 *   related_decision_cases: string[],
 *   related_simulation_runs: string[],
 * }[]}
 */
export function buildCapabilityRiskRows() {
  const caseByScenario = Object.fromEntries(
    DECISION_SIMULATION_CASES.map((c) => [c.scenario_key, c]),
  );

  return INTERNAL_CAPABILITY_SEEDS.map((cap) => {
    const deps = getCapabilityDependencies(cap.capabilityKey);
    const csts = getCapabilityConstraints(cap.capabilityKey);
    const relatedCases = DECISION_SIMULATION_CASES.filter((c) => c.capability_key === cap.capabilityKey).map(
      (c) => c.case_key,
    );
    const relatedRuns = buildSimulationRunHistory()
      .filter((r) => {
        const c = caseByScenario[r.scenario_key];
        return c?.capability_key === cap.capabilityKey;
      })
      .map((r) => r.run_key);

    return {
      capability_key: cap.capabilityKey,
      label: cap.capabilityLabel,
      dependency_count: deps.length,
      constraint_count: csts.length,
      risk_level: cap.riskLevel,
      supports_sandbox: !!cap.supportsSandbox,
      supports_live: !!cap.supportsLive,
      related_decision_cases: relatedCases,
      related_simulation_runs: relatedRuns,
    };
  }).sort((a, b) => {
    const ra = a.risk_level === "critical" ? 4 : a.risk_level === "high" ? 3 : a.risk_level === "medium" ? 2 : 1;
    const rb = b.risk_level === "critical" ? 4 : b.risk_level === "high" ? 3 : b.risk_level === "medium" ? 2 : 1;
    if (rb !== ra) return rb - ra;
    if (b.dependency_count !== a.dependency_count) return b.dependency_count - a.dependency_count;
    return a.capability_key.localeCompare(b.capability_key);
  });
}

function mergeGraphs(graphs) {
  const nodeMap = new Map();
  const edgeMap = new Map();
  for (const g of graphs) {
    for (const n of g.nodes) nodeMap.set(n.node_id, n);
    for (const e of g.edges) edgeMap.set(e.edge_id, e);
  }
  return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] };
}

/**
 * @returns {{
 *   total_nodes: number,
 *   total_edges: number,
 *   high_risk_nodes: number,
 *   critical_nodes: number,
 *   review_routes: number,
 *   blocked_or_paused_paths: number,
 *   unique_capabilities: number,
 *   unique_rules: number,
 * }}
 */
export function buildGraphHealthSummary() {
  const merged = mergeGraphs([
    buildCapabilityDependencyGraph(),
    buildPolicyGateGraph(),
    buildScenarioRuleGraph(),
    buildReviewRoutingGraph(),
  ]);

  let high_risk_nodes = 0;
  let critical_nodes = 0;
  const capSet = new Set();
  const ruleSet = new Set();

  for (const n of merged.nodes) {
    if (n.risk_level === "high") high_risk_nodes += 1;
    if (n.risk_level === "critical") critical_nodes += 1;
    if (n.type === "capability" && n.metadata?.capabilityKey) capSet.add(String(n.metadata.capabilityKey));
    if ((n.type === "rule" || n.type === "policy") && n.metadata?.rule_key) ruleSet.add(String(n.metadata.rule_key));
  }

  const review_routes = merged.edges.filter((e) => e.type === "routes_to_review").length;
  const risk = buildRiskConcentrationSummary();

  return {
    total_nodes: merged.nodes.length,
    total_edges: merged.edges.length,
    high_risk_nodes,
    critical_nodes,
    review_routes,
    blocked_or_paused_paths: risk.blocked_or_paused_runs,
    unique_capabilities: capSet.size,
    unique_rules: ruleSet.size,
  };
}
