import { useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { evaluateAuthSimulationCase, DEVELOPER_AUTH_SIMULATION_PHASE } from "../../lib/developerAuthSimulationConfig";
import {
  EXECUTION_DEPENDENCY_TYPES,
  EXECUTION_ORCHESTRATION_STATES,
  EXECUTION_RECONCILIATION_STATES,
  EXECUTION_ROUTING_CASES,
  EXECUTION_ROUTING_OUTCOMES,
  EXECUTION_ROUTING_SIMULATION_SAFETY_RULES,
  EXECUTION_ROUTING_STAGES,
  EXECUTION_SERVICE_TARGETS,
  DEVELOPER_EXECUTION_ROUTING_PHASE,
  buildExecutionRoutingOutcomeSummary,
  evaluateExecutionRoutingCase,
  getExecutionRoutingCase,
} from "../../lib/developerExecutionRoutingConfig";
import {
  buildGatewayEnvelope,
  DEVELOPER_GATEWAY_SIMULATION_PHASE,
} from "../../lib/developerGatewaySimulationConfig";
import { EXECUTION_SCENARIO_PHASE } from "../../lib/executionScenarioConfig";
import { RUNTIME_DECISION_SIMULATOR_PHASE, evaluateDecisionCase } from "../../lib/runtimeDecisionSimulatorConfig";

const planningBannerClass =
  "flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:flex-row sm:items-start sm:gap-4 sm:p-6 sm:text-[0.9375rem]";
const sectionCardClass = "tropicash-surface rounded-2xl p-5 sm:p-6";
const sectionTitleClass = "text-base font-bold text-slate-900 sm:text-lg";
const sectionSubtitleClass =
  "mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]";

const ROUTING_UI_ENVIRONMENTS = [
  { value: "sandbox", label: "Sandbox" },
  { value: "live", label: "Live rehearsal label (drill)" },
];

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

function StageResultPill({ result }) {
  const map = {
    passed: "border border-emerald-200 bg-emerald-50 text-emerald-800",
    failed: "border border-rose-200 bg-rose-50 text-rose-800",
    skipped: "border border-slate-200 bg-slate-50 text-slate-600",
    warning: "border border-amber-200 bg-amber-50 text-amber-900",
  };
  return <Pill className={map[result] ?? map.passed}>{result}</Pill>;
}

function RoutingOutcomeBadge({ outcome }) {
  const tone =
    outcome?.category === "success"
      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
      : outcome?.category === "review"
        ? "border border-amber-200 bg-amber-50 text-amber-900"
        : outcome?.category === "deferral"
          ? "border border-sky-200 bg-sky-50 text-sky-800"
          : "border border-rose-200 bg-rose-50 text-rose-800";
  return (
    <Pill className={tone} title={outcome?.developer_message}>
      {(outcome?.outcome_key ?? "unset").replace(/^execution_routing\./, "")}
    </Pill>
  );
}

function Stat({ label, value, mono }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

export default function ExecutionRoutingPage() {
  const defaultCaseKey = EXECUTION_ROUTING_CASES[0]?.case_key ?? "";
  const [selectedCaseKey, setSelectedCaseKey] = useState(defaultCaseKey);
  const [environment, setEnvironment] = useState("sandbox");
  const [evaluation, setEvaluation] = useState(null);

  const envelopePreviewGw = useMemo(() => {
    const row = getExecutionRoutingCase(selectedCaseKey);
    if (!row) return {};
    return buildGatewayEnvelope(row.gateway_case_key, environment);
  }, [selectedCaseKey, environment]);

  const routingRow = useMemo(() => getExecutionRoutingCase(selectedCaseKey), [selectedCaseKey]);

  const authPreview = useMemo(() => {
    const row = getExecutionRoutingCase(selectedCaseKey);
    if (!row) return null;
    return evaluateAuthSimulationCase(row.auth_case_key, { environment });
  }, [selectedCaseKey, environment]);

  const decisionPreview = useMemo(() => {
    const row = getExecutionRoutingCase(selectedCaseKey);
    if (!row) return null;
    return evaluateDecisionCase(row.decision_case_key, { environment });
  }, [selectedCaseKey, environment]);

  const handleEvaluate = () => {
    setEvaluation(evaluateExecutionRoutingCase(selectedCaseKey, { environment }));
  };

  const handleReset = () => setEvaluation(null);

  const ev = evaluation;

  return (
    <DevConsoleLayout
      title="Execution Routing"
      subtitle="Phase 5D — execution routing & service orchestration simulation. Twelve post-gateway rehearsal stages, ten sandbox delegate targets, deterministic merges across Phases 5C, 5B, 4D, 3A, and 3B — no live routing, queues, workers, or execution."
      environment={environment === "live" ? "sandbox" : environment}
    >
      <div className={planningBannerClass}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"
          aria-hidden
        >
          🧭
        </span>
        <div className="min-w-0">
          <strong className="block font-semibold text-amber-900">
            Modeling only — not a workload router or service mesh control plane.
          </strong>
          <span className="block">
            Phase{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">{DEVELOPER_EXECUTION_ROUTING_PHASE}</code>{" "}
            seeds live in{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              lib/developerExecutionRoutingConfig.js
            </code>
            — pair with Phase 5C{" "}
            <Link href="/dev-console/gateway-simulator" className="font-semibold text-amber-900 underline">
              Gateway Simulator
            </Link>
            .
          </span>
        </div>
      </div>

      <section className={sectionCardClass} aria-labelledby="er-controls-heading">
        <h2 id="er-controls-heading" className={sectionTitleClass}>
          1. Controls
        </h2>
        <p className={sectionSubtitleClass}>
          Pick a seeded routing narrative and envelope label (sandbox vs live rehearsal).{" "}
          <strong>Run simulation</strong> pins merged envelopes; <strong>Reset</strong> returns to exploratory previews below.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">Execution routing case</span>
            <select
              value={selectedCaseKey}
              onChange={(e) => {
                setSelectedCaseKey(e.target.value);
                handleReset();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {EXECUTION_ROUTING_CASES.map((c) => (
                <option key={c.case_key} value={c.case_key}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">Envelope environment label</span>
            <select
              value={environment}
              onChange={(e) => {
                setEnvironment(e.target.value);
                handleReset();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {ROUTING_UI_ENVIRONMENTS.map((env) => (
                <option key={env.value} value={env.value}>
                  {env.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleEvaluate}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Run simulation
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
        {!evaluation ? (
          <p className="mt-4 text-sm text-slate-600">
            Sections <strong>4–11</strong> stay collapsed until evaluation — below you can skim catalog vocabulary independent of pinning.
          </p>
        ) : null}
      </section>

      <section className={sectionCardClass} aria-labelledby="er-vocab-heading">
        <h2 id="er-vocab-heading" className={sectionTitleClass}>
          2. Routing stages &amp; outcome vocabulary
        </h2>
        <p className={sectionSubtitleClass}>
          Twelve deterministic surfaces between gateway narration and simulated execution summaries — statuses reuse{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-xs">modeled</code>,
          <code className="rounded bg-slate-100 px-1 font-mono text-xs">planned</code>, and{" "}
          <code className="rounded bg-slate-100 px-1 font-mono text-xs">future</code> labels.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white/80 p-3 text-sm lg:max-h-96">
            {EXECUTION_ROUTING_STAGES.map((s) => (
              <li key={s.stage_key} className="rounded-lg border border-slate-100 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <code className="text-[0.68rem] text-slate-600">{s.stage_key}</code>
                  <Pill className="border border-slate-200 bg-slate-50 text-slate-700">{s.status}</Pill>
                  {s.blocking_by_default ? (
                    <Pill className="border border-slate-300 bg-slate-100 text-slate-800">blocking</Pill>
                  ) : (
                    <Pill className="border border-slate-200 bg-white text-slate-600">non-blocking</Pill>
                  )}
                </div>
                <p className="mt-1 font-semibold text-slate-900">{s.label}</p>
                <p className="mt-1 text-xs text-slate-600">{s.description}</p>
              </li>
            ))}
          </ul>
          <ul className="space-y-2 text-sm">
            {EXECUTION_ROUTING_OUTCOMES.map((o) => (
              <li key={o.outcome_key} className="rounded-xl border border-slate-200 bg-white/80 p-3">
                <RoutingOutcomeBadge outcome={o} />
                <span className="ml-2 font-semibold text-slate-900">{o.label}</span>
                <p className="mt-1 text-xs text-slate-600">{o.developer_message}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="er-targets-heading">
        <h2 id="er-targets-heading" className={sectionTitleClass}>
          3. Service targets, dependencies, reconciliation &amp; orchestration states
        </h2>
        <p className={sectionSubtitleClass}>
          Targets are illustrative delegate families aligned with sandbox orchestration narration — compare with Phase 4D capability keys separately.
        </p>
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{EXECUTION_SERVICE_TARGETS.length} service targets</h3>
            <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto text-xs leading-relaxed text-slate-700">
              {EXECUTION_SERVICE_TARGETS.map((t) => (
                <li key={t.target_key} className="rounded-lg border border-slate-100 px-3 py-2">
                  <code>{t.target_key}</code>
                  <div className="font-semibold text-slate-900">{t.label}</div>
                  <div className="text-slate-600">{t.description}</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Dependency vocabulary</h3>
            <ul className="mt-2 space-y-1 text-xs">
              {EXECUTION_DEPENDENCY_TYPES.map((d) => (
                <li key={d.dependency_key} className="rounded-lg bg-slate-50 px-2 py-1">
                  <code>{d.dependency_key}</code> — {d.label}
                  {d.blocking ? " (blocking default)" : " (informational)"}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Reconciliation posture</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {EXECUTION_RECONCILIATION_STATES.map((r) => (
                  <li key={r.reconciliation_key}>
                    <strong>{r.label}</strong> — {r.description}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{EXECUTION_ORCHESTRATION_STATES.length} orchestration states</h3>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                {EXECUTION_ORCHESTRATION_STATES.map((s) => (
                  <li key={s.state_key} className="rounded-lg border border-slate-100 px-2 py-1">
                    <code>{s.state_key}</code>{" "}
                    <span className="text-slate-600">{s.label}</span>
                    <span className="ml-2 text-slate-500">{s.terminal ? "terminal" : "non-terminal"}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {ev ? (
        <>
          <section className={sectionCardClass} aria-labelledby="er-sum-heading">
            <h2 id="er-sum-heading" className={sectionTitleClass}>
              4. Simulation summary
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RoutingOutcomeBadge outcome={ev.routing_outcome} />
              <Pill className="border border-slate-200 bg-slate-50 text-slate-700">
                {ev.terminal_outcome ? "Terminal (routing lens)" : "Non-terminal routing lens"}
              </Pill>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat label="Gateway phase ref" value={DEVELOPER_GATEWAY_SIMULATION_PHASE} />
              <Stat label="Auth phase ref" value={DEVELOPER_AUTH_SIMULATION_PHASE} />
              <Stat label="Scenario phase ref" value={EXECUTION_SCENARIO_PHASE} />
              <Stat label="Decision phase ref" value={RUNTIME_DECISION_SIMULATOR_PHASE} />
              <Stat label="Service target" value={ev.case.selected_service_target} mono />
              <Stat label="Gateway seed" value={ev.case.gateway_case_key} mono />
              <Stat label="Routing trace counts" value={`${ev.counts.routing_stages.passed} pass · ${ev.counts.routing_stages.failed} fail · ${ev.counts.routing_stages.warning} warn · ${ev.counts.routing_stages.skipped} skip`} />
              <Stat label="Outcome summary" value={buildExecutionRoutingOutcomeSummary(ev.routing_outcome.outcome_key)} />
            </dl>
          </section>

          <section className={sectionCardClass} aria-labelledby="er-route-env-heading">
            <h2 id="er-route-env-heading" className={sectionTitleClass}>
              5. Routed envelope (merged)
            </h2>
            <p className={sectionSubtitleClass}>Cross-phase anchors stitched from envelope correlation plus scenario + catalog metadata.</p>
            <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-emerald-100">
              {JSON.stringify(ev.routing_envelope, null, 2)}
            </pre>
          </section>

          <section className={sectionCardClass} aria-labelledby="er-trace-heading">
            <h2 id="er-trace-heading" className={sectionTitleClass}>
              6. Execution routing trace
            </h2>
            <p className={sectionSubtitleClass}>Twelve ordered surfaces layered after Phase 5C output — deterministic pass / fail narration only.</p>
            <ol className="mt-4 flex flex-col gap-2">
              {ev.routing_trace.map((step, idx) => (
                <li
                  key={step.stage_key}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-slate-500">{idx + 1}</span>
                  <span className="font-semibold text-slate-900">{step.label}</span>
                  <code className="text-[0.65rem] text-slate-500">{step.stage_key}</code>
                  <StageResultPill result={step.result} />
                  <Pill className="border border-slate-200 bg-slate-50 text-slate-600">{step.doc_status}</Pill>
                </li>
              ))}
            </ol>
          </section>

          <section className={sectionCardClass} aria-labelledby="er-delegation-heading">
            <h2 id="er-delegation-heading" className={sectionTitleClass}>
              7. Service delegation plan
            </h2>
            <p className={sectionSubtitleClass}>Static narration of delegate binding — no RPCs executed.</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white/85 p-3 text-sm text-slate-800">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Target label</dt>
                <dd className="font-semibold">{ev.service_delegation_plan.target_label}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/85 p-3 text-sm text-slate-800">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Gateway hand-off outcome key</dt>
                <dd className="font-mono text-xs">{ev.service_delegation_plan.gateway_handoff_outcome}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/85 p-3 text-sm text-slate-800 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Orchestration state path</dt>
                <dd className="mt-2 flex flex-wrap gap-2 font-mono text-xs">
                  {(ev.service_delegation_plan.orchestration_state_path ?? []).map((s) => (
                    <span key={s} className="rounded border border-slate-200 px-2 py-1">
                      {s}
                    </span>
                  ))}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/85 p-3 text-sm text-slate-800 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Rationale</dt>
                <dd className="mt-2 leading-relaxed">{ev.service_delegation_plan.rationale}</dd>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/85 p-3 text-xs text-slate-700 sm:col-span-2">
                <dt className="text-xs uppercase tracking-wide text-slate-500">Delegated phase anchors</dt>
                <dd className="mt-2">{(ev.service_delegation_plan.delegated_from_phases ?? []).join(", ")}</dd>
              </div>
            </dl>
          </section>

          <section className={sectionCardClass} aria-labelledby="er-dep-chain-heading">
            <h2 id="er-dep-chain-heading" className={sectionTitleClass}>
              8. Dependency chain
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-800">
              {ev.dependency_chain.map((d) => (
                <li key={d.dependency_key} className="rounded-xl border border-slate-100 bg-white/85 px-3 py-2">
                  <code className="text-xs">{d.dependency_key}</code>
                  <div className="font-semibold">{d.label}</div>
                  <p className="text-xs text-slate-600">{d.description}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className={sectionCardClass} aria-labelledby="er-recon-heading">
            <h2 id="er-recon-heading" className={sectionTitleClass}>
              9. Reconciliation summary
            </h2>
            <p className={sectionSubtitleClass}>{ev.reconciliation_summary.description}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Stat label="Posture label" value={ev.reconciliation_summary.label} />
              <Stat label="Key" value={ev.reconciliation_summary.reconciliation_key} mono />
              <Stat label="Review required (seed)" value={ev.reconciliation_summary.review_required ? "yes" : "no"} />
              <Stat label="Manual intervention required (seed)" value={ev.reconciliation_summary.manual_intervention_required ? "yes" : "no"} />
            </div>
          </section>

          <section className={sectionCardClass} aria-labelledby="er-cross-phase-heading">
            <h2 id="er-cross-phase-heading" className={sectionTitleClass}>
              10. Cross-phase evaluation snapshot (5C • 5B • 3B)
            </h2>
            <p className={sectionSubtitleClass}>
              Mirrors gateway routing output, delegated auth stages, and the paired decision walker for instructional transparency.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white/85 p-3 text-xs">
                <strong className="text-sm text-slate-900">Phase 5C routing outcome</strong>
                <p className="mt-2 font-mono">{ev.gateway_evaluation?.routing_outcome?.outcome_key ?? "n/a"}</p>
                <p className="mt-2 text-slate-600">{ev.gateway_evaluation?.developer_message ?? "Gateway evaluation omitted — check simulateGateway option."}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/85 p-3 text-xs">
                <strong className="text-sm text-slate-900">Phase 5B derived outcome</strong>
                <p className="mt-2 font-mono">{ev.auth_evaluation?.derived_outcome ?? "n/a"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/85 p-3 text-xs lg:col-span-2">
                <strong className="text-sm text-slate-900">Phase 3B decision outcome</strong>
                <p className="mt-2 font-mono">{ev.decision_evaluation?.final_outcome ?? "n/a"}</p>
                <p className="mt-2 font-mono">
                  seeded vs derived match:{" "}
                  <strong>{ev.decision_evaluation ? (ev.decision_evaluation.seeded_matches_derived ? "yes" : "no") : "n/a"}</strong>
                </p>
              </div>
            </div>
            <ol className="mt-4 flex flex-col gap-1">
              {(ev.gateway_evaluation?.stage_trace ?? []).slice(0, 4).map((step, idx) => (
                <li key={step.stage_key} className="flex flex-wrap items-center gap-2 text-xs">
                  Gateway +{idx + 1}: {step.label} <StageResultPill result={step.result} />
                </li>
              ))}
              {ev.gateway_evaluation?.stage_trace && ev.gateway_evaluation.stage_trace.length > 4 ? (
                <li className="text-xs text-slate-500">
                  Trimmed preview ({ev.gateway_evaluation.stage_trace.length} total gateway stages — open simulator for details).
                </li>
              ) : null}
            </ol>
          </section>

          <section className={sectionCardClass} aria-labelledby="er-related-heading">
            <h2 id="er-related-heading" className={sectionTitleClass}>
              11. Related console previews
            </h2>
            <p className={sectionSubtitleClass}>Phase 5D stitches choreography — each upstream console retains its own fidelity.</p>
            <ul className="mt-4 flex flex-col gap-2 text-sm font-semibold text-blue-700">
              <li>
                <Link href="/dev-console/gateway-simulator" className="hover:underline">
                  Gateway Simulator (Phase 5C) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/auth-simulator" className="hover:underline">
                  Auth Simulator (Phase 5B) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/execution-simulator" className="hover:underline">
                  Execution Simulator (Phase 3A) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/decision-simulator" className="hover:underline">
                  Decision Simulator (Phase 3B) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/credential-architecture" className="hover:underline">
                  Credential Architecture (Phase 5A) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/product-catalog" className="hover:underline">
                  Product Catalog (Phase 4D) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/sandbox-analytics" className="hover:underline">
                  Sandbox Analytics (Phase 4E) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/orchestration" className="hover:underline">
                  Orchestration (Phase 2D) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/runtime-state" className="hover:underline">
                  Runtime State (Phase 2F) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/request-simulator" className="hover:underline">
                  Request Simulator (10A + 10B) — sandbox request flow, governance, and observability metadata; no endpoint execution →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/runtime-activation" className="hover:underline">
                  Runtime Activation (Phase 6A) →
                </Link>
              </li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              <strong className="text-slate-800">Phase 6A — Runtime Activation.</strong> Models runtime activation
              governance, environment isolation boundaries, activation readiness gates, and emergency shutdown controls
              before any execution environment exists — simulation only.
            </p>
          </section>

          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white/85 p-4 text-sm leading-relaxed text-slate-800">
            <p>
              <strong>Developer-facing:</strong> {ev.developer_message}
            </p>
            <p>
              <strong>Operator recap:</strong> {ev.operator_summary}
            </p>
            <p className="text-slate-600">{ev.case.explanation}</p>
          </div>
        </>
      ) : (
        <>
          <section className={sectionCardClass} aria-labelledby="er-unpinned-heading">
            <h2 id="er-unpinned-heading" className={sectionTitleClass}>
              4–11 Run to pin execution routing payloads
            </h2>
            <p className={sectionSubtitleClass}>
              Lightweight previews reuse the seeded gateway envelope and supporting evaluations for the dropdown selections —
              pinning adds the merged routed envelope plus twelve-stage narration.
            </p>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">Phase 5C envelope rehearsal</h3>
            <pre className="mt-2 max-h-52 overflow-auto rounded-xl border border-slate-200 bg-slate-900 p-3 text-[0.7rem] text-emerald-100">
              {JSON.stringify(envelopePreviewGw, null, 2)}
            </pre>
            <h3 className="mt-6 text-sm font-semibold text-slate-900">Phase 5B derived outcome</h3>
            <p className="mt-1 text-xs text-slate-600">
              Outcome: <span className="font-semibold text-slate-900">{authPreview?.derived_outcome ?? "n/a"}</span>
            </p>
            <h3 className="mt-6 text-sm font-semibold text-slate-900">Phase 3B seeded decision case</h3>
            <p className="mt-1 text-xs font-mono text-slate-800">{routingRow?.decision_case_key}</p>
            <p className="mt-1 text-xs text-slate-600">Final outcome projection: {decisionPreview?.final_outcome ?? "n/a"}</p>
          </section>
        </>
      )}

      <section className={sectionCardClass} aria-labelledby="er-safety-heading">
        <h2 id="er-safety-heading" className={sectionTitleClass}>
          Simulation safety rules
        </h2>
        <ol className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {EXECUTION_ROUTING_SIMULATION_SAFETY_RULES.map((rule, idx) => (
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
    </DevConsoleLayout>
  );
}
