import { useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { API_ENVIRONMENTS } from "../../lib/developerCenterConfig";
import {
  RUNTIME_POLICY_GRAPH_PHASE,
  GRAPH_VIEW_MODES,
  GRAPH_RISK_LEVELS,
  POLICY_GRAPH_SAFETY_RULES,
  buildCapabilityDependencyGraph,
  buildPolicyGateGraph,
  buildScenarioRuleGraph,
  buildReviewRoutingGraph,
  buildGraphHealthSummary,
  buildRiskConcentrationSummary,
  buildRulePressureSummary,
  buildCapabilityRiskRows,
} from "../../lib/runtimePolicyGraphConfig";
import { buildSimulationRunHistory, buildReviewRequiredRuns } from "../../lib/simulationRunHistoryConfig";

const planningBannerClass =
  "flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:flex-row sm:items-start sm:gap-4 sm:p-6 sm:text-[0.9375rem]";
const sectionCardClass = "tropicash-surface rounded-2xl p-5 sm:p-6";
const sectionTitleClass = "text-base font-bold text-slate-900 sm:text-lg";
const sectionSubtitleClass =
  "mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]";

const RISK_BADGE = {
  low: "border border-slate-200 bg-slate-50 text-slate-700",
  medium: "border border-sky-200 bg-sky-50 text-sky-800",
  high: "border border-amber-200 bg-amber-50 text-amber-900",
  critical: "border border-rose-200 bg-rose-50 text-rose-800",
};

function riskTone(level) {
  return RISK_BADGE[level] ?? RISK_BADGE.medium;
}

function Pill({ children, className = "", title }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}

function RiskBadge({ level }) {
  const meta = GRAPH_RISK_LEVELS.find((r) => r.key === level);
  return (
    <Pill className={riskTone(level)} title={meta?.description}>
      {meta?.label ?? level}
    </Pill>
  );
}

function groupByField(items, field) {
  const m = new Map();
  for (const item of items) {
    const k = item[field] ?? "unknown";
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

function StatCard({ label, value, hint }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white/80 p-4">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-lg font-bold text-slate-900">{value}</dd>
      {hint ? <p className="text-xs leading-relaxed text-slate-600">{hint}</p> : null}
    </div>
  );
}

function GraphExplorerPanel({ mode, graphs, riskSummary }) {
  const { cap, pol, scen, rev } = graphs;
  const active =
    mode === "capability_dependencies"
      ? cap
      : mode === "policy_gates"
        ? pol
        : mode === "scenario_rules"
          ? scen
          : mode === "review_routing"
            ? rev
            : null;

  if (mode === "risk_concentration") {
    return (
      <div className="mt-4 space-y-4">
        <p className="text-sm text-slate-600">
          This view mode summarizes concentration metrics as grouped cards (no edge list). See the full{" "}
          <strong>Risk concentration</strong> section below for the same data with drivers.
        </p>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="High / critical capabilities" value={riskSummary.high_critical_capabilities} />
          <StatCard label="High / critical rules" value={riskSummary.high_critical_rules} />
          <StatCard label="High / critical constraints" value={riskSummary.high_critical_constraints} />
          <StatCard label="Review-heavy runs" value={riskSummary.review_heavy_runs} />
          <StatCard label="Blocked or paused runs" value={riskSummary.blocked_or_paused_runs} />
        </dl>
      </div>
    );
  }

  if (!active) return null;

  const nodeGroups = groupByField(active.nodes, "type");
  const edgeGroups = groupByField(active.edges, "type");

  return (
    <div className="mt-4 space-y-6">
      {nodeGroups.map(([typeKey, nodes]) => (
        <div key={typeKey}>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            Nodes · {typeKey}{" "}
            <span className="font-mono text-xs font-normal text-slate-500">({nodes.length})</span>
          </h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {nodes.map((n) => (
              <li
                key={n.node_id}
                className="rounded-xl border border-slate-200 bg-white/90 p-3 text-sm shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{n.label}</span>
                  <RiskBadge level={n.risk_level} />
                </div>
                <p className="mt-1 font-mono text-[0.65rem] text-slate-500">{n.node_id}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{n.description}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {edgeGroups.map(([typeKey, edges]) => (
        <div key={`e-${typeKey}`}>
          <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">
            Edges · {typeKey}{" "}
            <span className="font-mono text-xs font-normal text-slate-500">({edges.length})</span>
          </h3>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white/90">
            {edges.map((e) => (
              <li key={e.edge_id} className="flex flex-col gap-1 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <span className="font-mono text-slate-800">
                  {e.source} → {e.target}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={e.risk_level} />
                  <span className="text-slate-600">{e.label}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default function PolicyGraphsPage() {
  const environment = API_ENVIRONMENTS[0] ?? "sandbox";
  const [viewMode, setViewMode] = useState(GRAPH_VIEW_MODES[0].key);

  const graphs = useMemo(
    () => ({
      cap: buildCapabilityDependencyGraph(),
      pol: buildPolicyGateGraph(),
      scen: buildScenarioRuleGraph(),
      rev: buildReviewRoutingGraph(),
    }),
    [],
  );

  const health = useMemo(() => buildGraphHealthSummary(), []);
  const risk = useMemo(() => buildRiskConcentrationSummary(), []);
  const rulePressure = useMemo(() => buildRulePressureSummary(), []);
  const capRows = useMemo(() => buildCapabilityRiskRows(), []);
  const reviewRuns = useMemo(() => buildReviewRequiredRuns(), []);
  const allRuns = useMemo(() => buildSimulationRunHistory(), []);

  return (
    <DevConsoleLayout
      title="Policy Graphs"
      subtitle="Phase 3D static dependency and policy views: grouped nodes and edges derived from capabilities, decision rules, and simulation history — visualization only, no enforcement or runtime execution."
      environment={environment}
    >
      <div className={planningBannerClass} role="status">
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white/80 text-xl"
        >
          ⚠️
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-semibold text-amber-950">Simulation-only surface</p>
          <p>
            Policy graphs are <strong>read-only teaching layouts</strong>. They do not call APIs, write to databases,
            evaluate live traffic, or execute graph engines. All shapes come from pure config helpers in{" "}
            <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-xs">lib/runtimePolicyGraphConfig.js</code>.
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Phase marker: {RUNTIME_POLICY_GRAPH_PHASE}
          </p>
        </div>
      </div>

      <section className={sectionCardClass} aria-labelledby="pg-health-heading">
        <h2 id="pg-health-heading" className={sectionTitleClass}>
          Graph health
        </h2>
        <p className={sectionSubtitleClass}>
          Merged counts across capability, policy gate, scenario, and review-routing graph builders (deduplicated by
          node and edge identifiers).
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Total nodes" value={health.total_nodes} />
          <StatCard label="Total edges" value={health.total_edges} />
          <StatCard label="High-risk nodes" value={health.high_risk_nodes} />
          <StatCard label="Critical nodes" value={health.critical_nodes} />
          <StatCard label="Review routes (edges)" value={health.review_routes} />
          <StatCard
            label="Blocked or paused paths"
            value={health.blocked_or_paused_paths}
            hint="From Phase 3C run ledger outcome groups (not completed)."
          />
          <StatCard label="Unique capabilities" value={health.unique_capabilities} />
          <StatCard label="Unique rules (scenario + policy)" value={health.unique_rules} />
        </dl>
      </section>

      <section className={sectionCardClass} aria-labelledby="pg-mode-heading">
        <h2 id="pg-mode-heading" className={sectionTitleClass}>
          View mode
        </h2>
        <p className={sectionSubtitleClass}>Pick a static layout. Lists and cards only — no canvas graph libraries.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {GRAPH_VIEW_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setViewMode(m.key)}
              className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold transition sm:min-w-[10rem] ${
                viewMode === m.key
                  ? "border-slate-900 bg-slate-900 text-white shadow-md"
                  : "border-slate-200 bg-white/90 text-slate-800 hover:border-slate-300"
              }`}
            >
              <span className="block">{m.label}</span>
              <span className={`mt-0.5 block text-xs font-normal ${viewMode === m.key ? "text-slate-200" : "text-slate-500"}`}>
                {m.description}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="pg-panel-heading">
        <h2 id="pg-panel-heading" className={sectionTitleClass}>
          Main panel · {GRAPH_VIEW_MODES.find((m) => m.key === viewMode)?.label ?? viewMode}
        </h2>
        <p className={sectionSubtitleClass}>
          Nodes and edges grouped by type with risk badges. Content switches with the view mode selector above.
        </p>
        <GraphExplorerPanel mode={viewMode} graphs={graphs} riskSummary={risk} />
      </section>

      <section className={sectionCardClass} aria-labelledby="pg-risk-heading">
        <h2 id="pg-risk-heading" className={sectionTitleClass}>
          Risk concentration
        </h2>
        <p className={sectionSubtitleClass}>Aggregated high/critical surfaces, review-heavy runs, and failure drivers.</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="High / critical capabilities" value={risk.high_critical_capabilities} />
          <StatCard label="High / critical rules" value={risk.high_critical_rules} />
          <StatCard label="High / critical constraints" value={risk.high_critical_constraints} />
          <StatCard label="Review-heavy runs" value={risk.review_heavy_runs} />
          <StatCard label="Blocked or paused runs" value={risk.blocked_or_paused_runs} />
        </dl>
        <h3 className={`mt-6 ${sectionTitleClass} text-sm`}>Top rule failure drivers (decision cases)</h3>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          {risk.top_rule_failure_drivers.slice(0, 12).map((d) => (
            <li key={d.rule_key}>
              <span className="font-mono font-semibold">{d.rule_key}</span> — {d.label}{" "}
              <span className="text-slate-500">({d.failure_count} seeded failures)</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={sectionCardClass} aria-labelledby="pg-pressure-heading">
        <h2 id="pg-pressure-heading" className={sectionTitleClass}>
          Rule pressure
        </h2>
        <p className={sectionSubtitleClass}>
          Per-rule tallies from decision cases and matching simulation runs (appearances in run history use the shared
          scenario key catalog).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rulePressure.map((r) => (
            <article key={r.rule_key} className="rounded-xl border border-slate-200 bg-white/90 p-4 text-sm shadow-sm">
              <p className="font-mono text-xs font-semibold text-slate-800">{r.rule_key}</p>
              <p className="mt-1 font-semibold text-slate-900">{r.label}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">Case appearances</dt>
                  <dd className="font-bold text-slate-900">{r.appearances_in_cases}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Failures</dt>
                  <dd className="font-bold text-slate-900">{r.failures_in_cases}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Review impacts</dt>
                  <dd className="font-bold text-slate-900">{r.review_impacts}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Run touches</dt>
                  <dd className="font-bold text-slate-900">{r.appearances_in_run_history}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Block / delay / retry</dt>
                  <dd className="font-bold text-slate-900">
                    {r.block_impacts} / {r.delay_impacts} / {r.retry_impacts}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="pg-cap-risk-heading">
        <h2 id="pg-cap-risk-heading" className={sectionTitleClass}>
          Capability risk
        </h2>
        <p className={sectionSubtitleClass}>
          Phase 2C registry rows with dependency and constraint counts, environment support flags, and related Phase 3B
          / 3C keys.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Capability</th>
                <th className="px-3 py-2">Risk</th>
                <th className="px-3 py-2">Deps</th>
                <th className="px-3 py-2">Constraints</th>
                <th className="px-3 py-2">Sandbox / live</th>
                <th className="px-3 py-2">Decision cases</th>
                <th className="px-3 py-2">Sim runs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/90">
              {capRows.map((row) => (
                <tr key={row.capability_key}>
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs text-slate-800">{row.capability_key}</div>
                    <div className="text-xs text-slate-600">{row.label}</div>
                  </td>
                  <td className="px-3 py-2">
                    <RiskBadge level={row.risk_level} />
                  </td>
                  <td className="px-3 py-2">{row.dependency_count}</td>
                  <td className="px-3 py-2">{row.constraint_count}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.supports_sandbox ? "Sandbox" : "—"} · {row.supports_live ? "Live" : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.related_decision_cases.length}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-700">{row.related_simulation_runs.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="pg-review-heading">
        <h2 id="pg-review-heading" className={sectionTitleClass}>
          Review routing map
        </h2>
        <p className={sectionSubtitleClass}>
          Runs flagged <code className="rounded bg-slate-100 px-1 font-mono text-xs">review_required</code> in the Phase
          3C merge — static routing to a review queue node then summarized outcome ({reviewRuns.length} of{" "}
          {allRuns.length}).
        </p>
        <ul className="mt-4 space-y-3">
          {reviewRuns.map((r) => (
            <li
              key={r.run_key}
              className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-950 shadow-sm"
            >
              <p className="font-semibold text-slate-900">{r.title}</p>
              <p className="mt-1 font-mono text-xs text-slate-700">
                run <span className="font-semibold">{r.run_key}</span> · scenario{" "}
                <span className="font-semibold">{r.scenario_key}</span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-700">
                <span className="font-semibold">Route:</span> run → review queue → decision outcome{" "}
                <span className="font-mono">({r.decision_outcome})</span> · execution final{" "}
                <span className="font-mono">{r.final_state}</span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="pg-safety-heading">
        <h2 id="pg-safety-heading" className={sectionTitleClass}>
          Safety rules
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          {POLICY_GRAPH_SAFETY_RULES.map((rule, idx) => (
            <li key={idx}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="pg-related-heading">
        <h2 id="pg-related-heading" className={sectionTitleClass}>
          Related views
        </h2>
        <p className={sectionSubtitleClass}>
          Phase 3D composes Phase 2C capabilities, Phase 3B decision rules, and Phase 3C run history. Execution timelines
          and orchestration vocabulary provide upstream context.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm font-semibold sm:text-[0.9375rem]">
          <li>
            <Link
              href="/dev-console/execution-simulator"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Execution Simulator →
            </Link>
          </li>
          <li>
            <Link
              href="/dev-console/capabilities"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Capability Registry →
            </Link>
          </li>
          <li>
            <Link
              href="/dev-console/decision-simulator"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Decision Simulator →
            </Link>
          </li>
          <li>
            <Link
              href="/dev-console/simulation-history"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Simulation Run History →
            </Link>
          </li>
          <li>
            <Link
              href="/dev-console/orchestration"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Execution Orchestration →
            </Link>
          </li>
          <li>
            <Link
              href="/dev-console/observability"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Observability →
            </Link>
          </li>
          <li>
            <Link
              href="/dev-console/runtime-state"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Runtime State →
            </Link>
          </li>
          <li>
            <Link
              href="/dev-console/internal-blueprint"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Internal Platform Blueprint →
            </Link>
          </li>
        </ul>
      </section>
    </DevConsoleLayout>
  );
}
