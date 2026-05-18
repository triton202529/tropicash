import { useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  AUTH_ENVIRONMENT_SCOPES,
  AUTH_FLOW_STAGES,
  AUTH_REPLAY_PROTECTION_MODELS,
  AUTH_REQUEST_OUTCOMES,
  AUTH_SIMULATION_CASES,
  AUTH_SIMULATION_SAFETY_RULES,
  AUTH_VERIFICATION_POLICIES,
  DEVELOPER_AUTH_SIMULATION_PHASE,
  buildAuthFailureSummary,
  buildAuthFlowTrace,
  buildAuthOutcomeSummary,
  buildEnvironmentScopeSummary,
  buildReplayProtectionSummary,
  evaluateAuthSimulationCase,
} from "../../lib/developerAuthSimulationConfig";
import { DEVELOPER_CREDENTIAL_PHASE } from "../../lib/developerCredentialArchitectureConfig";
import { DEVELOPER_PRODUCT_PHASE } from "../../lib/developerProductCatalogConfig";
import { INTERNAL_CAPABILITY_PHASE } from "../../lib/internalCapabilityConfig";

const planningBannerClass =
  "flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:flex-row sm:items-start sm:gap-4 sm:p-6 sm:text-[0.9375rem]";
const sectionCardClass = "tropicash-surface rounded-2xl p-5 sm:p-6";
const sectionTitleClass = "text-base font-bold text-slate-900 sm:text-lg";
const sectionSubtitleClass =
  "mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]";

const AUTH_UI_ENVIRONMENTS = [
  { value: "sandbox", label: "Sandbox" },
  { value: "live", label: "Live (override drill)" },
  { value: "internal", label: "Internal rehearsal" },
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

function OutcomeBadge({ outcomeKey }) {
  const tone =
    outcomeKey === "allowed"
      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
      : outcomeKey === "review_required"
        ? "border border-amber-200 bg-amber-50 text-amber-900"
        : outcomeKey === "malformed"
          ? "border border-orange-200 bg-orange-50 text-orange-900"
          : outcomeKey === "environment_denied"
            ? "border border-violet-200 bg-violet-50 text-violet-900"
            : outcomeKey === "rejected"
              ? "border border-rose-200 bg-rose-50 text-rose-800"
              : "border border-slate-300 bg-slate-100 text-slate-800";
  return <Pill className={tone}>{outcomeKey.replace(/_/g, " ")}</Pill>;
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

function Stat({ label, value, mono }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

export default function AuthSimulatorPage() {
  const defaultCaseKey = AUTH_SIMULATION_CASES[0]?.case_key ?? "";
  const [selectedCaseKey, setSelectedCaseKey] = useState(defaultCaseKey);
  const [environment, setEnvironment] = useState("sandbox");
  const [evaluation, setEvaluation] = useState(null);

  const flowTracePreview = useMemo(
    () => buildAuthFlowTrace(selectedCaseKey, { environment }),
    [selectedCaseKey, environment],
  );

  const handleEvaluate = () => {
    setEvaluation(evaluateAuthSimulationCase(selectedCaseKey, { environment }));
  };

  const handleReset = () => {
    setEvaluation(null);
  };

  const ev = evaluation;

  return (
    <DevConsoleLayout
      title="Auth Simulator"
      subtitle="Phase 5B — authentication flow modeling and request verification simulation. Static stages, policies, and failure vocabulary only; no headers parsed, no crypto, no APIs."
      environment={environment === "live" ? "sandbox" : environment}
    >
      <div className={planningBannerClass}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"
          aria-hidden
        >
          🛂
        </span>
        <div className="min-w-0">
          <strong className="block font-semibold text-amber-900">
            Simulation only — not an authentication service.
          </strong>
          <span className="block">
            Phase{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {DEVELOPER_AUTH_SIMULATION_PHASE}
            </code>
            . Seeded cases live in{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              lib/developerAuthSimulationConfig.js
            </code>
            . Credential vocabulary references{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {DEVELOPER_CREDENTIAL_PHASE}
            </code>
            ; catalog keys align with{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {DEVELOPER_PRODUCT_PHASE}
            </code>{" "}
            and capability seeds from{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {INTERNAL_CAPABILITY_PHASE}
            </code>
            .
          </span>
        </div>
      </div>

      <section className={sectionCardClass} aria-labelledby="auth-controls-heading">
        <h2 id="auth-controls-heading" className={sectionTitleClass}>
          1. Controls
        </h2>
        <p className={sectionSubtitleClass}>
          Pick a seeded case and an evaluation environment. <strong>Live</strong> and{" "}
          <strong>internal</strong> selections are pure overrides for the walk — identical to Phase 3B&apos;s
          environment drill; they do not open live traffic or internal services.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">Auth case</span>
            <select
              value={selectedCaseKey}
              onChange={(e) => {
                setSelectedCaseKey(e.target.value);
                handleReset();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {AUTH_SIMULATION_CASES.map((c) => (
                <option key={c.case_key} value={c.case_key}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
              Evaluation environment
            </span>
            <select
              value={environment}
              onChange={(e) => {
                setEnvironment(e.target.value);
                handleReset();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {AUTH_UI_ENVIRONMENTS.map((env) => (
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
            The table below shows a <strong>preview trace</strong> for the current dropdown values (same merge rules
            as Run). Click <strong>Run simulation</strong> to pin summaries and failure panels.
          </p>
        ) : null}
      </section>

      <section className={sectionCardClass} aria-labelledby="auth-flow-stages-heading">
        <h2 id="auth-flow-stages-heading" className={sectionTitleClass}>
          2. Auth flow stages (catalog)
        </h2>
        <p className={sectionSubtitleClass}>
          Thirteen ordered stages — each has documentation status (<code className="text-xs">modeled</code>,{" "}
          <code className="text-xs">planned</code>, <code className="text-xs">future</code>) and a default blocking
          posture for the simulator.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {AUTH_FLOW_STAGES.map((s) => (
            <li key={s.stage_key} className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-[0.7rem] text-slate-600">{s.stage_key}</code>
                <Pill className="border border-slate-200 bg-slate-50 text-slate-700">{s.status}</Pill>
                {s.blocking_by_default ? (
                  <Pill className="border border-slate-300 bg-slate-100 text-slate-800">blocking</Pill>
                ) : (
                  <Pill className="border border-slate-200 bg-white text-slate-600">non-blocking</Pill>
                )}
              </div>
              <p className="mt-1 font-semibold text-slate-900">{s.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="auth-policies-heading">
        <h2 id="auth-policies-heading" className={sectionTitleClass}>
          3. Verification policies (reference)
        </h2>
        <p className={sectionSubtitleClass}>
          Nine static policy envelopes tying credential types from Phase 5A to required field names and failure
          vocabulary — teaching data only.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Policy</th>
                <th className="px-3 py-2">Credential</th>
                <th className="px-3 py-2">Env</th>
                <th className="px-3 py-2">Required fields</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white/90">
              {AUTH_VERIFICATION_POLICIES.map((p) => (
                <tr key={p.policy_key} className="text-slate-800">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-slate-900">{p.label}</div>
                    <code className="text-[0.7rem] text-slate-600">{p.policy_key}</code>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{p.credential_type}</td>
                  <td className="px-3 py-2">{p.environment}</td>
                  <td className="px-3 py-2 text-xs">{p.required_fields.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {evaluation ? (
        <>
          <section className={sectionCardClass} aria-labelledby="auth-summary-heading">
            <h2 id="auth-summary-heading" className={sectionTitleClass}>
              4. Simulation summary
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <OutcomeBadge outcomeKey={ev.derived_outcome} />
              <Pill className="border border-slate-200 bg-slate-50 text-slate-700">
                {ev.terminal_failure ? "Terminal (sim)" : "Non-terminal (sim)"}
              </Pill>
              {ev.outcome_matches_expected ? (
                <Pill className="border border-emerald-200 bg-emerald-50 text-emerald-800">Matches expected</Pill>
              ) : (
                <Pill className="border border-amber-200 bg-amber-50 text-amber-900">Expected drift</Pill>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat label="Case" value={ev.title} />
              <Stat label="App (seed)" value={ev.app_label} />
              <Stat label="Product" value={ev.product_key} mono />
              <Stat label="Contract" value={ev.contract_key} mono />
              <Stat label="Capability" value={ev.capability_key} mono />
              <Stat label="Credential type" value={ev.credential_type} mono />
              <Stat label="Case environment" value={ev.environment} />
              <Stat label="Eval environment" value={ev.effective_environment} />
              <Stat
                label="Counts"
                value={`${ev.passed_count} pass · ${ev.failed_count} fail · ${ev.warning_count} warn · ${ev.skipped_count} skip`}
              />
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">
              {buildAuthOutcomeSummary(selectedCaseKey, { environment })}
            </p>
          </section>

          <section className={sectionCardClass} aria-labelledby="auth-trace-heading">
            <h2 id="auth-trace-heading" className={sectionTitleClass}>
              5. Auth flow trace
            </h2>
            <p className={sectionSubtitleClass}>
              Ordered walk with merge rules: base trace, case overrides, optional evaluation overrides, then live
              drill injection for sandbox credentials against sandbox-only contracts.
            </p>
            <ol className="mt-4 flex flex-col gap-2">
              {ev.stages.map((step, idx) => (
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

          <section className={sectionCardClass} aria-labelledby="auth-failure-heading">
            <h2 id="auth-failure-heading" className={sectionTitleClass}>
              6. Failure states &amp; metadata
            </h2>
            <p className={sectionSubtitleClass}>
              {buildAuthFailureSummary(selectedCaseKey)}
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              {ev.failure_details.length ? (
                <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                  <thead className="bg-slate-50 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Failure</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Terminal</th>
                      <th className="px-3 py-2">Developer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white/90">
                    {ev.failure_details.map((f) => (
                      <tr key={f.failure_key} className="align-top text-slate-800">
                        <td className="px-3 py-2 font-mono text-xs">{f.failure_key}</td>
                        <td className="px-3 py-2">{f.category}</td>
                        <td className="px-3 py-2">{f.terminal ? "yes" : "no"}</td>
                        <td className="max-w-md px-3 py-2 text-xs leading-relaxed text-slate-700">
                          {f.developer_message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-4 text-sm text-slate-600">
                  No case-attached failure rows for this run. The catalog of sixteen states is listed in{" "}
                  <code className="rounded bg-slate-100 px-1 text-xs">AUTH_FAILURE_STATES</code> inside the config
                  module.
                </p>
              )}
            </div>
          </section>

          <section className={sectionCardClass} aria-labelledby="auth-outcomes-heading">
            <h2 id="auth-outcomes-heading" className={sectionTitleClass}>
              7. Request outcomes
            </h2>
            <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {AUTH_REQUEST_OUTCOMES.map((o) => (
                <li key={o.key} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3">
                  <OutcomeBadge outcomeKey={o.key} />
                  <p className="text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">{o.description}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className={sectionCardClass} aria-labelledby="auth-replay-env-heading">
            <h2 id="auth-replay-env-heading" className={sectionTitleClass}>
              8. Replay protection &amp; environment scopes
            </h2>
            <p className={`${sectionSubtitleClass} mt-1`}>{buildReplayProtectionSummary()}</p>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">{buildEnvironmentScopeSummary()}</p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-3">
              {AUTH_ENVIRONMENT_SCOPES.map((e) => (
                <li key={e.key} className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm">
                  <span className="font-semibold text-slate-900">{e.label}</span>
                  <p className="mt-1 text-xs text-slate-600">{e.description}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className={sectionCardClass} aria-labelledby="auth-explain-heading">
            <h2 id="auth-explain-heading" className={sectionTitleClass}>
              9. Operator &amp; developer narratives
            </h2>
            <p className="mt-2 text-sm font-semibold text-slate-900">Developer-safe</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{ev.developer_safe_message}</p>
            <p className="mt-4 text-sm font-semibold text-slate-900">Operator</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{ev.operator_summary}</p>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-800">Case explanation:</span> {ev.explanation}
            </p>
          </section>

          <section className={sectionCardClass} aria-labelledby="auth-related-heading">
            <h2 id="auth-related-heading" className={sectionTitleClass}>
              10. Related console tools
            </h2>
            <p className={sectionSubtitleClass}>
              Phase 5B stops at verification modeling. Pair it with credential vocabulary, Phase 5C gateway envelope
              simulations, <strong className="text-slate-800">Phase 5D execution routing</strong> choreography (sandbox delegate narration after the gateway surfaces), catalog alignment,
              and decision simulation for end-to-end teaching.
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm font-semibold text-blue-700">
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
                <Link href="/dev-console/decision-simulator" className="hover:underline">
                  Decision Simulator (Phase 3B) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/gateway-simulator" className="hover:underline">
                  Gateway Simulator (Phase 5C) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/execution-routing" className="hover:underline">
                  Execution Routing (Phase 5D) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/execution-simulator" className="hover:underline">
                  Execution Simulator (Phase 3A) →
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
                <Link href="/dev-console/runtime-activation" className="hover:underline">
                  Runtime Activation (Phase 6A) →
                </Link>
              </li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              <strong className="text-slate-800">Phase 6A — Runtime Activation.</strong> Models activation governance,
              environment isolation, readiness gates, and emergency shutdown before any execution environment exists.
            </p>
          </section>
        </>
      ) : (
        <section className={sectionCardClass} aria-labelledby="auth-trace-preview-heading">
          <h2 id="auth-trace-preview-heading" className={sectionTitleClass}>
            4–10. Run to pin summaries
          </h2>
          <p className={sectionSubtitleClass}>
            Sections 4–10 unlock after <strong>Run simulation</strong>: summary, pinned trace, failure metadata,
            outcomes, replay/environment blurbs, narratives, and related links.
          </p>
          <p className="mt-3 text-sm font-semibold text-slate-800">Live trace preview (unpinned)</p>
          <ol className="mt-2 flex flex-col gap-1.5 text-sm">
            {flowTracePreview.map((step, idx) => (
              <li key={step.stage_key} className="flex flex-wrap items-center gap-2 text-slate-700">
                <span className="font-mono text-xs text-slate-500">{idx + 1}</span>
                <span>{step.label}</span>
                <StageResultPill result={step.result} />
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className={sectionCardClass} aria-labelledby="auth-safety-heading">
        <h2 id="auth-safety-heading" className={sectionTitleClass}>
          Simulation safety rules
        </h2>
        <ol className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {AUTH_SIMULATION_SAFETY_RULES.map((rule, idx) => (
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

      <section className={sectionCardClass} aria-labelledby="auth-replay-models-heading">
        <h2 id="auth-replay-models-heading" className={sectionTitleClass}>
          Replay protection models (static)
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {AUTH_REPLAY_PROTECTION_MODELS.map((m) => (
            <li key={m.key} className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm">
              <span className="font-semibold text-slate-900">{m.label}</span>
              <p className="mt-1 text-xs text-slate-600">{m.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </DevConsoleLayout>
  );
}
