import { useMemo } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { API_ENVIRONMENTS } from "../../lib/developerCenterConfig";
import { getScenarioCategory, getFinalState } from "../../lib/executionScenarioConfig";
import { getOutcomeMeta } from "../../lib/runtimeDecisionSimulatorConfig";
import {
  SIMULATION_RUN_HISTORY_PHASE,
  SIMULATION_RUN_STATUSES,
  SIMULATION_RUN_OUTCOME_GROUPS,
  SIMULATION_COMPARISON_METRICS,
  SIMULATION_RUN_HISTORY_SAFETY_RULES,
  buildSimulationRunHistory,
  buildSimulationOutcomeDistribution,
  buildSimulationFinalStateDistribution,
  buildReviewRequiredRuns,
  buildBlockedOrPausedRuns,
  buildSimulationComparisonRows,
  buildScenarioDecisionComparison,
  buildSimulationHealthSummary,
} from "../../lib/simulationRunHistoryConfig";
import { RUNTIME_POLICY_GRAPH_PHASE } from "../../lib/runtimePolicyGraphConfig";

const planningBannerClass =
  "flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:flex-row sm:items-start sm:gap-4 sm:p-6 sm:text-[0.9375rem]";
const sectionCardClass = "tropicash-surface rounded-2xl p-5 sm:p-6";
const sectionTitleClass = "text-base font-bold text-slate-900 sm:text-lg";
const sectionSubtitleClass =
  "mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]";

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

function CategoryBadge({ categoryKey }) {
  const c = getScenarioCategory(categoryKey);
  return (
    <Pill className={c.badgeClass} title={c.description}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.dotClass}`} aria-hidden />
      {c.label}
    </Pill>
  );
}

function FinalStateBadge({ stateKey }) {
  const s = getFinalState(stateKey);
  return (
    <Pill className={s.badgeClass} title={s.description}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dotClass}`} aria-hidden />
      {s.label}
    </Pill>
  );
}

function DecisionOutcomeBadge({ outcomeKey }) {
  const o = getOutcomeMeta(outcomeKey);
  const tone =
    outcomeKey === "allowed"
      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
      : outcomeKey === "review_required"
        ? "border border-amber-200 bg-amber-50 text-amber-900"
        : outcomeKey === "rate_limited"
          ? "border border-purple-200 bg-purple-50 text-purple-800"
          : outcomeKey === "delayed"
            ? "border border-sky-200 bg-sky-50 text-sky-800"
            : outcomeKey === "retryable_failure"
              ? "border border-orange-200 bg-orange-50 text-orange-900"
              : "border border-rose-200 bg-rose-50 text-rose-800";
  return (
    <Pill className={tone} title={o?.description}>
      {o?.label ?? outcomeKey}
    </Pill>
  );
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

export default function SimulationHistoryPage() {
  const environment = API_ENVIRONMENTS[0] ?? "sandbox";

  const health = useMemo(() => buildSimulationHealthSummary(), []);
  const runs = useMemo(() => buildSimulationRunHistory(), []);
  const outcomeDist = useMemo(() => buildSimulationOutcomeDistribution(), []);
  const finalStateDist = useMemo(() => buildSimulationFinalStateDistribution(), []);
  const reviewRuns = useMemo(() => buildReviewRequiredRuns(), []);
  const blockedPaused = useMemo(() => buildBlockedOrPausedRuns(), []);
  const comparisonRows = useMemo(() => buildSimulationComparisonRows(), []);
  const scenarioDecision = useMemo(() => buildScenarioDecisionComparison(), []);

  const runStatusMeta = useMemo(
    () => Object.fromEntries(SIMULATION_RUN_STATUSES.map((s) => [s.key, s])),
    [],
  );

  return (
    <DevConsoleLayout
      title="Simulation Run History"
      subtitle="Phase 3C deterministic run ledger: compare execution final states with decision outcomes, scan review-heavy paths, and inspect aggregate health — all from static seeds. No persistence, no APIs."
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
            This page renders <strong>pre-authored, replayable history</strong> merged from{" "}
            <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-xs">EXECUTION_SCENARIOS</code> and{" "}
            <code className="rounded bg-white/80 px-1 py-0.5 font-mono text-xs">evaluateDecisionCase</code>. Nothing is stored,
            streamed, or executed outside the browser.
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Phase marker: {SIMULATION_RUN_HISTORY_PHASE}
          </p>
        </div>
      </div>

      {/* 1) Health summary */}
      <section className={sectionCardClass} aria-labelledby="sim-health-heading">
        <h2 id="sim-health-heading" className={sectionTitleClass}>
          Health summary
        </h2>
        <p className={sectionSubtitleClass}>
          Rollups across the seeded catalog ({health.total_runs} runs). Averages are simple means over that set.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Total runs" value={health.total_runs} />
          <StatCard label="Decision allowed" value={health.allowed_count} />
          <StatCard label="Review flagged" value={health.review_required_count} />
          <StatCard label="Delayed (run status)" value={health.delayed_count} />
          <StatCard label="Rate limited" value={health.rate_limited_count} />
          <StatCard label="Retryable failure" value={health.retryable_failure_count} />
          <StatCard label="Blocked (run status)" value={health.blocked_count} />
          <StatCard
            label="Scenario ↔ decision divergent"
            value={health.divergent_alignment_count}
            hint="Heuristic mismatch between execution story and rule walk."
          />
          <StatCard
            label="Avg duration (ms)"
            value={Math.round(health.avg_simulated_duration_ms)}
          />
          <StatCard
            label="Avg emitted events"
            value={health.avg_emitted_events.toFixed(2)}
          />
          <StatCard label="Failed rules (sum)" value={health.total_failed_rules} />
          <StatCard label="Warning impacts (sum)" value={health.total_warning_rules} />
          <StatCard label="Review pauses (sum)" value={health.total_review_rules} />
        </dl>
      </section>

      {/* 2) Run history */}
      <section className={sectionCardClass} aria-labelledby="sim-runs-heading">
        <h2 id="sim-runs-heading" className={sectionTitleClass}>
          Run history
        </h2>
        <p className={sectionSubtitleClass}>
          One row per shared scenario key. Timestamps are static per seed — not wall-clock driven.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Run</th>
                <th className="px-3 py-2">Scenario</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Exec final</th>
                <th className="px-3 py-2">Decision</th>
                <th className="px-3 py-2">Run status</th>
                <th className="px-3 py-2">Duration</th>
                <th className="px-3 py-2">Events</th>
                <th className="px-3 py-2">Created (sim)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/90">
              {runs.map((r) => (
                <tr key={r.run_key}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-800">{r.run_key}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-800">{r.scenario_key}</td>
                  <td className="px-3 py-2">
                    <CategoryBadge categoryKey={r.category} />
                  </td>
                  <td className="px-3 py-2">
                    <FinalStateBadge stateKey={r.final_state} />
                  </td>
                  <td className="px-3 py-2">
                    <DecisionOutcomeBadge outcomeKey={r.decision_outcome} />
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">
                    {runStatusMeta[r.run_status]?.label ?? r.run_status}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">{r.simulated_duration_ms}</td>
                  <td className="px-3 py-2 text-xs text-slate-700">{r.emitted_event_count}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{r.created_at_simulated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3) Outcome distribution */}
      <section className={sectionCardClass} aria-labelledby="sim-outcome-dist-heading">
        <h2 id="sim-outcome-dist-heading" className={sectionTitleClass}>
          Outcome distribution
        </h2>
        <p className={sectionSubtitleClass}>Counts by Phase 3C outcome group (execution + decision merge).</p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {outcomeDist.map((o) => (
            <li key={o.outcome_group_key} className="rounded-xl border border-slate-200 bg-white/80 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-slate-900">{o.label}</span>
                <span className="text-lg font-bold text-blue-800">{o.count}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{o.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 4) Final state distribution */}
      <section className={sectionCardClass} aria-labelledby="sim-final-dist-heading">
        <h2 id="sim-final-dist-heading" className={sectionTitleClass}>
          Final state distribution
        </h2>
        <p className={sectionSubtitleClass}>Execution-layer final_state keys from Phase 3A scenarios.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {finalStateDist.map((f) => (
            <li key={f.key}>
              <span className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm">
                <FinalStateBadge stateKey={f.key} />
                <span className="font-bold text-slate-900">{f.count}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 5) Category comparison */}
      <section className={sectionCardClass} aria-labelledby="sim-cat-heading">
        <h2 id="sim-cat-heading" className={sectionTitleClass}>
          Category comparison
        </h2>
        <p className={sectionSubtitleClass}>Per-category run counts and mean simulated duration.</p>
        <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {health.by_category.map((c) => (
            <li key={c.category_key} className="rounded-xl border border-slate-200 bg-white/80 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CategoryBadge categoryKey={c.category_key} />
                <span className="text-sm font-semibold text-slate-700">{c.run_count} runs</span>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Avg duration: <strong>{Math.round(c.avg_simulated_duration_ms)} ms</strong>
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* 6) Review-required */}
      <section className={sectionCardClass} aria-labelledby="sim-review-heading">
        <h2 id="sim-review-heading" className={sectionTitleClass}>
          Review-required runs
        </h2>
        <p className={sectionSubtitleClass}>
          Runs where the execution seed marks review, or the decision walk ends in <code className="font-mono">review_required</code>.
        </p>
        <ul className="mt-3 space-y-2">
          {reviewRuns.map((r) => (
            <li key={r.run_key} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-slate-900">{r.scenario_key}</span>
                <FinalStateBadge stateKey={r.final_state} />
                <DecisionOutcomeBadge outcomeKey={r.decision_outcome} />
              </div>
              <p className="mt-1 text-xs text-slate-700">{r.title}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 7) Blocked / paused */}
      <section className={sectionCardClass} aria-labelledby="sim-paused-heading">
        <h2 id="sim-paused-heading" className={sectionTitleClass}>
          Blocked or paused runs
        </h2>
        <p className={sectionSubtitleClass}>
          Every run outside the clean &quot;completed&quot; outcome group (allowed + execution completed). Includes operational pauses,
          reviews, and divergent alignments.
        </p>
        <ul className="mt-3 space-y-2">
          {blockedPaused.map((r) => (
            <li key={r.run_key} className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-semibold text-slate-900">{r.scenario_key}</span>
                <Pill className="border border-slate-200 bg-slate-50 text-slate-700" title={SIMULATION_RUN_OUTCOME_GROUPS.find((g) => g.key === r.outcome_group_key)?.description}>
                  {SIMULATION_RUN_OUTCOME_GROUPS.find((g) => g.key === r.outcome_group_key)?.label ?? r.outcome_group_key}
                </Pill>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 8) Scenario vs decision */}
      <section className={sectionCardClass} aria-labelledby="sim-compare-heading">
        <h2 id="sim-compare-heading" className={sectionTitleClass}>
          Scenario vs decision comparison
        </h2>
        <p className={sectionSubtitleClass}>
          Alignment uses a small heuristic (see <code className="font-mono">buildScenarioDecisionComparison</code>).
          A row marked <strong>no</strong> is often intentional: for example{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-xs">trading.profit_payout</code> shows an execution
          timeline that reaches <code className="font-mono text-xs">completed</code> while the paired decision slice stops at{" "}
          <code className="font-mono text-xs">review_required</code> to illustrate cross-layer tension.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Scenario</th>
                <th className="px-3 py-2">Final state</th>
                <th className="px-3 py-2">Decision</th>
                <th className="px-3 py-2">Aligned</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/90">
              {scenarioDecision.map((row) => (
                <tr key={row.run_key}>
                  <td className="px-3 py-2 font-mono text-xs">{row.scenario_key}</td>
                  <td className="px-3 py-2">
                    <FinalStateBadge stateKey={row.final_state} />
                  </td>
                  <td className="px-3 py-2">
                    <DecisionOutcomeBadge outcomeKey={row.decision_outcome} />
                  </td>
                  <td className="px-3 py-2 text-xs font-semibold text-slate-800">
                    {row.scenario_decision_aligned ? "yes" : "no"}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className={`mt-6 ${sectionTitleClass} text-sm`}>Metric vocabulary</h3>
        <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          {SIMULATION_COMPARISON_METRICS.map((m) => (
            <li key={m.key} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2 text-xs">
              <span className="font-mono font-semibold text-slate-900">{m.key}</span>
              <span className="mx-1 text-slate-400">—</span>
              <span className="font-semibold text-slate-800">{m.label}</span>
              <p className="mt-1 text-slate-600">{m.description}</p>
            </li>
          ))}
        </ul>
        <h3 className={`mt-6 ${sectionTitleClass} text-sm`}>Comparison rows (machine shape)</h3>
        {comparisonRows.length ? (
          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 font-semibold uppercase tracking-wide text-slate-600">
                <tr>
                  {Object.keys(comparisonRows[0]).map((k) => (
                    <th key={k} className="px-2 py-2 font-mono">
                      {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white/90 font-mono">
                {comparisonRows.map((row) => (
                  <tr key={row.run_key}>
                    {Object.keys(comparisonRows[0]).map((k) => {
                      const v = row[k];
                      return (
                        <td key={k} className="px-2 py-2">
                          {typeof v === "boolean" ? (v ? "true" : "false") : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">No comparison rows.</p>
        )}
      </section>

      <section className={sectionCardClass} aria-labelledby="sim-phase3d-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-xl"
          >
            🕸️
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-sky-800">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />
              Phase 3D
            </span>
            <h2 id="sim-phase3d-heading" className={`mt-2 ${sectionTitleClass}`}>
              Policy graphs &amp; dependency views
            </h2>
            <p className={sectionSubtitleClass}>
              Phase 3D layers <strong>static graphs</strong> on the same capability, decision, and run seeds: grouped
              nodes and edges for dependencies, policy gates, scenario walks, review routing, and risk concentration —
              still no enforcement, APIs, or persistence.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-[0.8125rem]">
              Phase marker: <code className="rounded bg-slate-100 px-1 font-mono">{RUNTIME_POLICY_GRAPH_PHASE}</code>
            </p>
            <Link
              href="/dev-console/policy-graphs"
              className="mt-3 inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Open Policy Graphs →
            </Link>
          </div>
        </div>
      </section>

      {/* 9) Safety */}
      <section className={sectionCardClass} aria-labelledby="sim-safety-heading">
        <h2 id="sim-safety-heading" className={sectionTitleClass}>
          Safety rules
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          {SIMULATION_RUN_HISTORY_SAFETY_RULES.map((rule, idx) => (
            <li key={idx}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="sim-cross-heading">
        <h2 id="sim-cross-heading" className={sectionTitleClass}>
          Related views
        </h2>
        <p className={sectionSubtitleClass}>
          Phase 3A timelines and Phase 3B rule walks feed this ledger. Deeper stack context lives in the blueprint and orchestration docs.
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
              href="/dev-console/decision-simulator"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Decision Simulator →
            </Link>
          </li>
          <li>
            <Link
              href="/dev-console/policy-graphs"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Policy Graphs →
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
              href="/dev-console/internal-blueprint"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Internal Platform Blueprint →
            </Link>
          </li>
          <li>
            <Link
              href="/dev-console/capabilities"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Capabilities →
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
        </ul>
      </section>
    </DevConsoleLayout>
  );
}
