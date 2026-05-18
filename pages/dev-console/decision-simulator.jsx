import { useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { API_ENVIRONMENTS } from "../../lib/developerCenterConfig";
import { getScenarioByKey } from "../../lib/executionScenarioConfig";
import {
  RUNTIME_DECISION_SIMULATOR_PHASE,
  DECISION_SIMULATION_CASES,
  DECISION_SIMULATION_RULE_TYPES,
  DECISION_SIMULATION_OUTCOMES,
  DECISION_SIMULATION_SAFETY_RULES,
  evaluateDecisionCase,
  buildDecisionTrace,
  buildPolicyResultRows,
  buildDecisionSummary,
  getOutcomeExplanation,
  getOutcomeMeta,
  getSeverityMeta,
  getRuleTypeMeta,
} from "../../lib/runtimeDecisionSimulatorConfig";
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

function OutcomeBadge({ outcomeKey }) {
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

function SeverityBadge({ severityKey }) {
  const s = getSeverityMeta(severityKey);
  return (
    <Pill className={s.badgeClass}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dotClass}`} aria-hidden />
      {s.label}
    </Pill>
  );
}

function ImpactBadge({ impact }) {
  const map = {
    continue: "border border-slate-200 bg-slate-50 text-slate-700",
    warn: "border border-amber-200 bg-amber-50 text-amber-900",
    pause_for_review: "border border-amber-200 bg-amber-50 text-amber-900",
    block: "border border-rose-200 bg-rose-50 text-rose-800",
    retry: "border border-orange-200 bg-orange-50 text-orange-900",
    delay: "border border-sky-200 bg-sky-50 text-sky-800",
  };
  return <Pill className={map[impact] ?? map.continue}>{impact.replace(/_/g, " ")}</Pill>;
}

export default function DecisionSimulatorPage() {
  const defaultCaseKey = DECISION_SIMULATION_CASES[0]?.case_key ?? "";
  const [selectedCaseKey, setSelectedCaseKey] = useState(defaultCaseKey);
  const [environment, setEnvironment] = useState("sandbox");
  const [evaluation, setEvaluation] = useState(null);

  const summary = useMemo(
    () => (evaluation ? buildDecisionSummary(evaluation) : null),
    [evaluation],
  );
  const rows = useMemo(
    () => (evaluation ? buildPolicyResultRows(evaluation) : []),
    [evaluation],
  );
  const trace = useMemo(
    () => (evaluation ? buildDecisionTrace(evaluation) : []),
    [evaluation],
  );

  const relatedScenario = useMemo(
    () => (evaluation ? getScenarioByKey(evaluation.scenario_key) : null),
    [evaluation],
  );

  const handleEvaluate = () => {
    setEvaluation(evaluateDecisionCase(selectedCaseKey, { environment }));
  };

  const handleReset = () => {
    setEvaluation(null);
  };

  return (
    <DevConsoleLayout
      title="Decision Simulator"
      subtitle="Deterministic policy-evaluation simulation: why a request would be allowed, blocked, delayed, rate-limited, sent to review, or marked retryable. Decision simulation only — no enforcement, no APIs, no persistence."
      environment={environment === "live" ? "sandbox" : environment}
    >
      <div className={planningBannerClass}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"
          aria-hidden
        >
          ⚖️
        </span>
        <div className="min-w-0">
          <strong className="block font-semibold text-amber-900">
            Decision simulation only — not a policy engine.
          </strong>
          <span className="block">
            Phase{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {RUNTIME_DECISION_SIMULATOR_PHASE}
            </code>
            . Cases and rules are defined in{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              lib/runtimeDecisionSimulatorConfig.js
            </code>
            . Evaluate and Reset only change local React state.
          </span>
        </div>
      </div>

      <section className={sectionCardClass} aria-labelledby="dec-controls-heading">
        <h2 id="dec-controls-heading" className={sectionTitleClass}>
          Controls
        </h2>
        <p className={sectionSubtitleClass}>
          Select a seeded decision case and environment, then evaluate. The
          walk is pure and deterministic — identical inputs always yield the
          same outcome and counts.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
              Decision case
            </span>
            <select
              value={selectedCaseKey}
              onChange={(e) => {
                setSelectedCaseKey(e.target.value);
                handleReset();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {DECISION_SIMULATION_CASES.map((c) => (
                <option key={c.case_key} value={c.case_key}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
              Environment
            </span>
            <select
              value={environment}
              onChange={(e) => {
                setEnvironment(e.target.value);
                handleReset();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {API_ENVIRONMENTS.map((env) => (
                <option key={env} value={env} disabled={env === "live"}>
                  {env}
                  {env === "live" ? " (disabled — Phase 3B is sandbox only)" : ""}
                </option>
              ))}
            </select>
            <span className="text-[0.7rem] text-slate-500 sm:text-xs">
              Live is disabled; all seeded cases are authored for sandbox review.
            </span>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleEvaluate}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Evaluate Decision
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            disabled={!evaluation}
          >
            Reset
          </button>
        </div>
      </section>

      {evaluation && summary ? (
        <>
          <section className={sectionCardClass} aria-labelledby="dec-summary-heading">
            <h2 id="dec-summary-heading" className={sectionTitleClass}>
              Decision summary
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <OutcomeBadge outcomeKey={summary.final_outcome} />
              <Pill className="border border-slate-200 bg-slate-50 text-slate-700">
                {summary.terminal ? "Terminal (sim)" : "Non-terminal (sim)"}
              </Pill>
              {!evaluation.seeded_matches_derived ? (
                <Pill className="border border-rose-200 bg-rose-50 text-rose-800">
                  Seed mismatch
                </Pill>
              ) : null}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Case" value={summary.headline} />
              <Stat label="Scenario key" value={summary.scenario_key} mono />
              <Stat label="Capability" value={summary.capability_key} mono />
              <Stat label="Environment" value={summary.environment} />
              <Stat label="Amount preview" value={summary.amount_preview} />
              <Stat
                label="Counts"
                value={`${summary.passed_count} pass · ${summary.failed_count} fail · ${summary.review_count} review · ${summary.blocking_count} block · ${summary.warning_count} warn`}
              />
            </dl>
          </section>

          <section className={sectionCardClass} aria-labelledby="dec-rules-heading">
            <h2 id="dec-rules-heading" className={sectionTitleClass}>
              Rule evaluation
            </h2>
            <p className={sectionSubtitleClass}>
              Each row merges the static rule catalog with this case&apos;s
              pass/fail, impact, and message. No live evaluator runs.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Rule</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2">Impact</th>
                    <th className="px-3 py-2">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white/90">
                  {rows.map((row, idx) => {
                    const typeMeta = getRuleTypeMeta(row.type);
                    const passLabel = row.passed ? "Pass" : "Fail";
                    const msg = row.passed ? row.pass_message : row.fail_message;
                    return (
                      <tr key={row.rule_key + idx} className="text-slate-800">
                        <td className="px-3 py-2 font-mono text-xs text-slate-500">
                          {row.evaluation_order}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-900">{row.label}</div>
                          <code className="text-[0.7rem] text-slate-600">{row.rule_key}</code>
                        </td>
                        <td className="px-3 py-2 text-xs" title={typeMeta?.description}>
                          {row.type}
                        </td>
                        <td className="px-3 py-2">
                          <SeverityBadge severityKey={row.severity} />
                        </td>
                        <td className="px-3 py-2">
                          <Pill
                            className={
                              row.passed
                                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                                : "border border-rose-200 bg-rose-50 text-rose-800"
                            }
                          >
                            {passLabel}
                          </Pill>
                        </td>
                        <td className="px-3 py-2">
                          <ImpactBadge impact={row.impact} />
                        </td>
                        <td className="max-w-xs px-3 py-2 text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
                          {row.result_message || msg}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className={sectionCardClass} aria-labelledby="dec-trace-heading">
            <h2 id="dec-trace-heading" className={sectionTitleClass}>
              Decision trace
            </h2>
            <p className={sectionSubtitleClass}>
              Rules in evaluation order. <strong>Pause</strong> marks a
              review hold; <strong>Stop</strong> marks a terminal or
              operational stop (block, retry, delay).
            </p>
            <ol className="mt-4 flex flex-col gap-2">
              {trace.map((step) => (
                <li
                  key={step.order + "-" + step.rule_key}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-slate-500">{step.order}</span>
                  <span className="font-semibold text-slate-900">{step.label}</span>
                  {step.is_pause ? (
                    <Pill className="border border-amber-200 bg-amber-50 text-amber-900">
                      Pause
                    </Pill>
                  ) : null}
                  {step.is_stop ? (
                    <Pill className="border border-rose-200 bg-rose-50 text-rose-800">
                      Stop
                    </Pill>
                  ) : null}
                  {step.passed ? (
                    <Pill className="border border-emerald-200 bg-emerald-50 text-emerald-800">
                      pass
                    </Pill>
                  ) : (
                    <Pill className="border border-rose-200 bg-rose-50 text-rose-800">
                      fail
                    </Pill>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <section className={sectionCardClass} aria-labelledby="dec-explain-heading">
            <h2 id="dec-explain-heading" className={sectionTitleClass}>
              Outcome explanation
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-[0.9375rem]">
              {getOutcomeExplanation(summary.final_outcome)}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-slate-500 sm:text-sm">
              Terminal in this simulator means the decision walk reached a
              state that closes the slice for teaching purposes:{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-[0.75rem]">
                allowed
              </code>
              ,{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-[0.75rem]">
                blocked
              </code>
              ,{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-[0.75rem]">
                policy_not_satisfied
              </code>
              ,{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-[0.75rem]">
                dependency_missing
              </code>
              , or{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-[0.75rem]">
                sandbox_only
              </code>
              . Review, delay, rate limit, and retryable paths remain
              non-terminal here.
            </p>
          </section>

          <section className={sectionCardClass} aria-labelledby="dec-related-heading">
            <h2 id="dec-related-heading" className={sectionTitleClass}>
              Related execution scenario
            </h2>
            <p className={sectionSubtitleClass}>
              Phase 3A&apos;s{" "}
              <Link href="/dev-console/execution-simulator" className="font-semibold text-blue-700 hover:underline">
                Execution Simulator
              </Link>{" "}
              renders the timeline, events, and checkpoints for the same{" "}
              <code className="rounded bg-slate-100 px-1 font-mono text-[0.75rem]">
                scenario_key
              </code>
              . Phase 3B explains <em>why</em> that simulated execution is
              allowed, paused, blocked, delayed, or rate-limited.
            </p>
            {relatedScenario ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white/90 p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {relatedScenario.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
                  {relatedScenario.description}
                </p>
                <Link
                  href="/dev-console/execution-simulator"
                  className="mt-3 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 hover:underline"
                >
                  Open Execution Simulator →
                </Link>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                No matching Phase 3A scenario seed for{" "}
                <code className="font-mono text-xs">{evaluation.scenario_key}</code>.
              </p>
            )}
          </section>
        </>
      ) : (
        <section className={sectionCardClass}>
          <p className="text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
            Click <strong>Evaluate Decision</strong> to run the deterministic
            walk for the selected case.
          </p>
        </section>
      )}

      <section className={sectionCardClass} aria-labelledby="dec-safety-heading">
        <h2 id="dec-safety-heading" className={sectionTitleClass}>
          Simulation safety rules
        </h2>
        <ol className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {DECISION_SIMULATION_SAFETY_RULES.map((rule, idx) => (
            <li
              key={rule}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 text-sm leading-relaxed text-slate-800 sm:text-[0.9375rem]"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[0.7rem] font-bold text-white"
                aria-hidden
              >
                {idx + 1}
              </span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={sectionCardClass} aria-labelledby="dec-catalog-heading">
        <h2 id="dec-catalog-heading" className={sectionTitleClass}>
          Rule type catalog
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DECISION_SIMULATION_RULE_TYPES.map((t) => (
            <li
              key={t.key}
              className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm"
            >
              <span className="font-semibold text-slate-900">{t.label}</span>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{t.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="dec-outcomes-heading">
        <h2 id="dec-outcomes-heading" className={sectionTitleClass}>
          Outcome vocabulary
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DECISION_SIMULATION_OUTCOMES.map((o) => (
            <li key={o.key} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3">
              <OutcomeBadge outcomeKey={o.key} />
              <p className="text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
                {o.description}{" "}
                <span className="font-semibold text-slate-600">
                  ({o.terminalInSim ? "terminal in sim" : "non-terminal in sim"})
                </span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="dec-sim-history-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-xl"
          >
            📊
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-sky-800">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />
              Phase 3C
            </span>
            <h2 id="dec-sim-history-heading" className={`mt-2 ${sectionTitleClass}`}>
              Simulation Run History
            </h2>
            <p className={sectionSubtitleClass}>
              Phase 3C compares every shared scenario&apos;s execution final state with the
              deterministic decision walk: distributions, review-heavy paths, and
              alignment hints — still pure config, still no persistence.
            </p>
            <Link
              href="/dev-console/simulation-history"
              className="mt-3 inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Open Simulation Run History →
            </Link>
          </div>
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="dec-policy-graphs-heading">
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
            <h2 id="dec-policy-graphs-heading" className={`mt-2 ${sectionTitleClass}`}>
              Policy graphs
            </h2>
            <p className={sectionSubtitleClass}>
              Static dependency and policy-gate graphs built from the same rule catalog and capability seeds — grouped
              lists only, no graph execution engine.
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

      <section className={sectionCardClass} aria-labelledby="dec-cross-heading">
        <h2 id="dec-cross-heading" className={sectionTitleClass}>
          Related views
        </h2>
        <p className={sectionSubtitleClass}>
          Decision simulation sits beside orchestration vocabulary, runtime
          telemetry shapes, and execution timeline simulation.
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
              href="/dev-console/simulation-history"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Simulation Run History →
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
          <li>
            <Link
              href="/dev-console/capabilities"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Capabilities →
            </Link>
          </li>
        </ul>
      </section>
    </DevConsoleLayout>
  );
}

function Stat({ label, value, mono = false }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white/80 p-3">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={`text-xs text-slate-900 sm:text-[0.8125rem] ${mono ? "font-mono" : "font-semibold"}`}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}
