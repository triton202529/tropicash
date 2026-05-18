import { useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  RUNTIME_ACTIVATION_CASES,
  RUNTIME_ACTIVATION_GATES,
  RUNTIME_ACTIVATION_PHASE,
  RUNTIME_ACTIVATION_SAFETY_RULES,
  RUNTIME_ACTIVATION_STATES,
  RUNTIME_ENVIRONMENT_SCOPES,
  RUNTIME_ISOLATION_RULES,
  RUNTIME_KILL_SWITCH_MODELS,
  RUNTIME_SAFETY_ENVELOPES,
  evaluateRuntimeActivationCase,
} from "../../lib/runtimeActivationGovernanceConfig";

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

function GateResultPill({ result }) {
  const map = {
    passed: "border border-emerald-200 bg-emerald-50 text-emerald-800",
    failed: "border border-rose-200 bg-rose-50 text-rose-800",
    warning: "border border-amber-200 bg-amber-50 text-amber-900",
    skipped: "border border-slate-200 bg-slate-50 text-slate-600",
  };
  return <Pill className={map[result] ?? map.skipped}>{result}</Pill>;
}

function OutcomeBadge({ outcomeKey }) {
  const tone =
    outcomeKey === "activation_ready"
      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
      : outcomeKey === "review_required"
        ? "border border-amber-200 bg-amber-50 text-amber-900"
        : outcomeKey === "isolated"
          ? "border border-violet-200 bg-violet-50 text-violet-900"
          : outcomeKey === "emergency_locked"
            ? "border border-rose-300 bg-rose-100 text-rose-900"
            : outcomeKey === "not_ready"
              ? "border border-sky-200 bg-sky-50 text-sky-800"
              : "border border-rose-200 bg-rose-50 text-rose-800";
  return <Pill className={tone}>{outcomeKey.replace(/_/g, " ")}</Pill>;
}

function Stat({ label, value, mono }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

export default function RuntimeActivationPage() {
  const defaultCaseKey = RUNTIME_ACTIVATION_CASES[0]?.case_key ?? "";
  const [selectedCaseKey, setSelectedCaseKey] = useState(defaultCaseKey);
  const [environmentScope, setEnvironmentScope] = useState(
    RUNTIME_ACTIVATION_CASES[0]?.environment_scope ?? "sandbox",
  );
  const [evaluation, setEvaluation] = useState(null);

  const handleEvaluate = () => {
    setEvaluation(
      evaluateRuntimeActivationCase(selectedCaseKey, { environment_scope: environmentScope }),
    );
  };

  const handleReset = () => {
    setEvaluation(null);
  };

  const ev = evaluation;

  return (
    <DevConsoleLayout
      title="Runtime Activation"
      subtitle="Phase 6A — runtime activation governance and environment isolation blueprint. Activation states, gates, kill switches, and safety envelopes — simulation only; no live runtime, APIs, workers, or execution."
      environment="sandbox"
    >
      <div className={planningBannerClass}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"
          aria-hidden
        >
          🔒
        </span>
        <div className="min-w-0">
          <strong className="block font-semibold text-amber-900">
            Simulation only — no live runtime, API gateway, worker system, or execution environment is active.
          </strong>
          <span className="block">
            Phase{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {RUNTIME_ACTIVATION_PHASE}
            </code>
            . Seeds live in{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              lib/runtimeActivationGovernanceConfig.js
            </code>
            . Rehearse upstream{" "}
            <Link href="/dev-console/credential-architecture" className="font-semibold text-amber-900 underline">
              5A
            </Link>
            ,{" "}
            <Link href="/dev-console/auth-simulator" className="font-semibold text-amber-900 underline">
              5B
            </Link>
            ,{" "}
            <Link href="/dev-console/gateway-simulator" className="font-semibold text-amber-900 underline">
              5C
            </Link>
            , and{" "}
            <Link href="/dev-console/execution-routing" className="font-semibold text-amber-900 underline">
              5D
            </Link>{" "}
            simulators before interpreting activation readiness here.
          </span>
        </div>
      </div>

      <section className={sectionCardClass} aria-labelledby="ra-controls-heading">
        <h2 id="ra-controls-heading" className={sectionTitleClass}>
          1. Controls
        </h2>
        <p className={sectionSubtitleClass}>
          Pick a seeded activation case and an environment scope label. Scope overrides are narration-only — they do
          not open edges or arm infrastructure.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
              Activation case
            </span>
            <select
              value={selectedCaseKey}
              onChange={(e) => {
                setSelectedCaseKey(e.target.value);
                const c = RUNTIME_ACTIVATION_CASES.find((x) => x.case_key === e.target.value);
                if (c) setEnvironmentScope(c.environment_scope);
                handleReset();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {RUNTIME_ACTIVATION_CASES.map((c) => (
                <option key={c.case_key} value={c.case_key}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
              Environment scope
            </span>
            <select
              value={environmentScope}
              onChange={(e) => {
                setEnvironmentScope(e.target.value);
                handleReset();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {RUNTIME_ENVIRONMENT_SCOPES.map((s) => (
                <option key={s.scope_key} value={s.scope_key}>
                  {s.label}
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
            Run Activation Simulation
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
            Run the simulation to pin activation summaries, gate walks, isolation checks, and kill-switch posture for
            the selected case.
          </p>
        ) : null}
      </section>

      <section className={sectionCardClass} aria-labelledby="ra-states-heading">
        <h2 id="ra-states-heading" className={sectionTitleClass}>
          2. Activation states (catalog)
        </h2>
        <p className={sectionSubtitleClass}>
          Ten governance states — including{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">live_enabled_placeholder</code> which explicitly documents
          that no real live runtime exists.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {RUNTIME_ACTIVATION_STATES.map((s) => (
            <li key={s.state_key} className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-[0.7rem] text-slate-600">{s.state_key}</code>
                <Pill className="border border-slate-200 bg-slate-50 text-slate-700">{s.category}</Pill>
              </div>
              <p className="mt-1 font-semibold text-slate-900">{s.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="ra-gates-ref-heading">
        <h2 id="ra-gates-ref-heading" className={sectionTitleClass}>
          3. Activation gates (reference)
        </h2>
        <p className={sectionSubtitleClass}>
          Eleven conceptual gates bridging governance, Phase 5 rehearsal, analytics, observability, and runtime state
          vocabulary.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {RUNTIME_ACTIVATION_GATES.map((g) => (
            <li key={g.gate_key} className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-[0.7rem] text-slate-600">{g.gate_key}</code>
                {g.phase_ref ? (
                  <Pill className="border border-indigo-200 bg-indigo-50 text-indigo-800">Phase {g.phase_ref}</Pill>
                ) : null}
                {g.blocking ? (
                  <Pill className="border border-slate-300 bg-slate-100 text-slate-800">blocking</Pill>
                ) : (
                  <Pill className="border border-slate-200 bg-white text-slate-600">advisory</Pill>
                )}
              </div>
              <p className="mt-1 font-semibold text-slate-900">{g.label}</p>
              <p className="mt-1 text-xs text-slate-600">{g.description}</p>
            </li>
          ))}
        </ul>
      </section>

      {ev ? (
        <>
          <section className={sectionCardClass} aria-labelledby="ra-summary-heading">
            <h2 id="ra-summary-heading" className={sectionTitleClass}>
              4. Activation summary
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <OutcomeBadge outcomeKey={ev.derived_outcome} />
              {ev.outcome_matches_expected ? (
                <Pill className="border border-emerald-200 bg-emerald-50 text-emerald-800">Matches expected</Pill>
              ) : (
                <Pill className="border border-amber-200 bg-amber-50 text-amber-900">Expected drift</Pill>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat label="Activation state" value={ev.activation_state_meta?.label ?? ev.activation_state} />
              <Stat label="Environment scope" value={ev.environment_scope} mono />
              <Stat label="Expected outcome" value={ev.expected_outcome} mono />
              <Stat label="Derived outcome" value={ev.derived_outcome} mono />
              <Stat label="Review required" value={ev.review_required ? "yes" : "no"} />
              <Stat label="Execution allowed (sim)" value={ev.execution_allowed ? "yes" : "no"} />
              <Stat label="External access (sim)" value={ev.external_access_allowed ? "yes" : "no"} />
              <Stat
                label="Gate counts"
                value={`${ev.counts.passed_count} pass · ${ev.counts.failed_count} fail · ${ev.counts.warning_count} warn`}
              />
            </dl>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">{ev.activation_summary}</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{ev.environment_summary}</p>
          </section>

          <section className={sectionCardClass} aria-labelledby="ra-gates-eval-heading">
            <h2 id="ra-gates-eval-heading" className={sectionTitleClass}>
              5. Activation gates
            </h2>
            <p className={sectionSubtitleClass}>{ev.gate_summary}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {ev.gate_evaluations.map((g) => (
                <li
                  key={g.gate_key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-semibold text-slate-900">{g.label}</span>
                    <code className="ml-2 text-[0.7rem] text-slate-500">{g.gate_key}</code>
                    {g.phase_ref ? (
                      <Pill className="ml-2 border border-indigo-200 bg-indigo-50 text-indigo-800">
                        Phase {g.phase_ref}
                      </Pill>
                    ) : null}
                  </div>
                  <GateResultPill result={g.result} />
                </li>
              ))}
            </ul>
          </section>

          <section className={sectionCardClass} aria-labelledby="ra-isolation-heading">
            <h2 id="ra-isolation-heading" className={sectionTitleClass}>
              6. Isolation rules
            </h2>
            <p className={sectionSubtitleClass}>{ev.isolation_summary}</p>
            <ul className="mt-4 flex flex-col gap-2">
              {ev.isolation_evaluations.map((r) => (
                <li
                  key={r.rule_key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-semibold text-slate-900">{r.label}</span>
                    <span className="ml-2 text-xs text-slate-500">scope: {r.enforcement_scope}</span>
                    {r.blocking ? (
                      <Pill className="ml-2 border border-slate-300 bg-slate-100 text-slate-800">blocking</Pill>
                    ) : null}
                  </div>
                  <Pill
                    className={
                      r.satisfied
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border border-rose-200 bg-rose-50 text-rose-800"
                    }
                  >
                    {r.satisfied ? "satisfied" : "violated"}
                  </Pill>
                </li>
              ))}
            </ul>
          </section>

          <section className={sectionCardClass} aria-labelledby="ra-envelopes-heading">
            <h2 id="ra-envelopes-heading" className={sectionTitleClass}>
              7. Safety envelopes
            </h2>
            <p className={sectionSubtitleClass}>{ev.safety_envelope_summary}</p>
            <ul className="mt-4 flex flex-col gap-3">
              {ev.safety_envelope_evaluations.map((e) => (
                <li key={e.envelope_key} className="rounded-xl border border-slate-200 bg-white/80 p-4 text-sm">
                  <p className="font-semibold text-slate-900">{e.label}</p>
                  <p className="mt-1 text-xs text-slate-600">{e.escalation_behavior}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-700">Restrictions</p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                    {e.restrictions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs font-semibold text-slate-700">Required controls</p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                    {e.required_controls.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          <section className={sectionCardClass} aria-labelledby="ra-killswitch-heading">
            <h2 id="ra-killswitch-heading" className={sectionTitleClass}>
              8. Kill-switch architecture
            </h2>
            <p className={sectionSubtitleClass}>
              Conceptual containment models only — engaged switches affect simulation narration, not production
              infrastructure. {ev.kill_switch_summary}
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {ev.kill_switch_evaluations.map((k) => (
                <li
                  key={k.switch_key}
                  className={`rounded-xl border p-3 text-sm ${k.engaged ? "border-rose-200 bg-rose-50/80" : "border-slate-200 bg-white/80"}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{k.label}</span>
                    <Pill className="border border-slate-200 bg-slate-50 text-slate-700">{k.scope}</Pill>
                    {k.engaged ? (
                      <Pill className="border border-rose-300 bg-rose-100 text-rose-900">engaged</Pill>
                    ) : (
                      <Pill className="border border-slate-200 bg-white text-slate-600">idle</Pill>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{k.activation_effect}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    <strong>Recovery:</strong> {k.recovery_requirements}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className={sectionCardClass} aria-labelledby="ra-outcome-heading">
            <h2 id="ra-outcome-heading" className={sectionTitleClass}>
              9. Runtime outcome
            </h2>
            <p className={sectionSubtitleClass}>
              Derived posture for this simulation run — vocabulary includes activation_ready, blocked, review_required,
              isolated, emergency_locked, and not_ready.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                "activation_ready",
                "blocked",
                "review_required",
                "isolated",
                "emergency_locked",
                "not_ready",
              ].map((key) => (
                <OutcomeBadge key={key} outcomeKey={key} />
              ))}
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-900">Active derived outcome</p>
            <p className="mt-1 text-sm text-slate-700">
              <OutcomeBadge outcomeKey={ev.derived_outcome} /> — blocking items:{" "}
              {ev.blocking_failures.length ? ev.blocking_failures.join(", ") : "none"}
            </p>
            <p className="mt-4 text-sm font-semibold text-slate-900">Developer-safe</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{ev.developer_safe_message}</p>
            <p className="mt-4 text-sm font-semibold text-slate-900">Operator</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{ev.operator_summary}</p>
            <p className="mt-4 text-sm text-slate-600">{ev.explanation}</p>
          </section>
        </>
      ) : null}

      <section
        className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6"
        aria-labelledby="ra-safety-heading"
      >
        <h2 id="ra-safety-heading" className={sectionTitleClass}>
          10. Safety notice
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
          {RUNTIME_ACTIVATION_SAFETY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
          <li>No live runtime, execution, public APIs, workers, queues, or money movement in this phase.</li>
          <li>
            Kill-switch and envelope toggles in this console are teaching artifacts — they do not change production
            infrastructure.
          </li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dev-console/execution-routing"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Execution Routing (Phase 5D)
          </Link>
          <Link
            href="/dev-console/gateway-simulator"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Gateway Simulator (Phase 5C)
          </Link>
          <Link
            href="/dev-console/credential-architecture"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Credential Architecture (Phase 5A)
          </Link>
          <Link
            href="/dev-console/auth-simulator"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Auth Simulator (Phase 5B)
          </Link>
          <Link
            href="/dev-console/runtime-state"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Runtime State (Phase 2F)
          </Link>
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="ra-catalog-heading">
        <h2 id="ra-catalog-heading" className={sectionTitleClass}>
          Reference catalogs
        </h2>
        <p className={sectionSubtitleClass}>
          Environment scopes, isolation rules, and kill-switch models available for all cases.
        </p>
        <h3 className="mt-4 text-sm font-bold text-slate-800">Environment scopes</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {RUNTIME_ENVIRONMENT_SCOPES.map((s) => (
            <li key={s.scope_key} className="rounded-lg border border-slate-200 bg-white/80 p-3 text-xs">
              <span className="font-semibold text-slate-900">{s.label}</span> — {s.description}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-bold text-slate-800">Isolation rules</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {RUNTIME_ISOLATION_RULES.map((r) => (
            <li key={r.rule_key} className="rounded-lg border border-slate-200 bg-white/80 p-3 text-xs">
              <span className="font-semibold text-slate-900">{r.label}</span> — {r.description}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-bold text-slate-800">Kill-switch models</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {RUNTIME_KILL_SWITCH_MODELS.map((k) => (
            <li key={k.switch_key} className="rounded-lg border border-slate-200 bg-white/80 p-3 text-xs">
              <span className="font-semibold text-slate-900">{k.label}</span> — {k.description}
            </li>
          ))}
        </ul>
        <h3 className="mt-4 text-sm font-bold text-slate-800">Safety envelopes</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {RUNTIME_SAFETY_ENVELOPES.map((e) => (
            <li key={e.envelope_key} className="rounded-lg border border-slate-200 bg-white/80 p-3 text-xs">
              <span className="font-semibold text-slate-900">{e.label}</span> — {e.description}
            </li>
          ))}
        </ul>
      </section>
    </DevConsoleLayout>
  );
}
