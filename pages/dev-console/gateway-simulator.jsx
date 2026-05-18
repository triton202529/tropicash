import { useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  evaluateAuthSimulationCase,
} from "../../lib/developerAuthSimulationConfig";
import { DEVELOPER_CREDENTIAL_PHASE } from "../../lib/developerCredentialArchitectureConfig";
import {
  GATEWAY_AUDIT_ENVELOPE_FIELDS,
  GATEWAY_CORRELATION_MODELS,
  GATEWAY_ENVELOPE_FIELDS,
  GATEWAY_PROCESSING_STAGES,
  GATEWAY_RATE_LIMIT_MODELS,
  GATEWAY_ROUTING_OUTCOMES,
  GATEWAY_SIMULATION_CASES,
  GATEWAY_SIMULATION_SAFETY_RULES,
  DEVELOPER_GATEWAY_SIMULATION_PHASE,
  buildGatewayEnvelope,
  buildGatewayCorrelationSummary,
  buildGatewayRoutingOutcomeSummary,
  buildGatewayRateLimitSummary,
  buildGatewayStageTrace,
  evaluateGatewaySimulationCase,
} from "../../lib/developerGatewaySimulationConfig";
import { DEVELOPER_PRODUCT_PHASE } from "../../lib/developerProductCatalogConfig";
import { DEVELOPER_SANDBOX_ANALYTICS_PHASE } from "../../lib/developerSandboxAnalyticsConfig";
import { INTERNAL_OBSERVABILITY_PHASE } from "../../lib/internalObservabilityConfig";
import { INTERNAL_RUNTIME_STATE_PHASE } from "../../lib/internalRuntimeStateConfig";

const planningBannerClass =
  "flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:flex-row sm:items-start sm:gap-4 sm:p-6 sm:text-[0.9375rem]";
const sectionCardClass = "tropicash-surface rounded-2xl p-5 sm:p-6";
const sectionTitleClass = "text-base font-bold text-slate-900 sm:text-lg";
const sectionSubtitleClass =
  "mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]";

const GATEWAY_UI_ENVIRONMENTS = [
  { value: "sandbox", label: "Sandbox" },
  { value: "live", label: "Live rehearsal label (drill)" },
  { value: "internal", label: "Internal rehearsal label" },
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

function RouteOutcomeBadge({ outcomeKey }) {
  const tone =
    outcomeKey?.includes?.("accept_preview")
      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
      : outcomeKey?.includes?.("review") || outcomeKey?.includes?.("degraded")
        ? "border border-amber-200 bg-amber-50 text-amber-900"
        : outcomeKey?.includes?.("malformed")
          ? "border border-orange-200 bg-orange-50 text-orange-900"
          : "border border-rose-200 bg-rose-50 text-rose-800";
  return (
    <Pill className={tone}>
      {(outcomeKey ?? "unset").replace(/gateway\.routing\./, "").replace(/_/g, " ")}
    </Pill>
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

function Stat({ label, value, mono }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm font-semibold text-slate-900 ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

export default function GatewaySimulatorPage() {
  const defaultCaseKey = GATEWAY_SIMULATION_CASES[0]?.case_key ?? "";
  const [selectedCaseKey, setSelectedCaseKey] = useState(defaultCaseKey);
  const [environment, setEnvironment] = useState("sandbox");
  const [evaluation, setEvaluation] = useState(null);

  const envelopePreview = useMemo(
    () => buildGatewayEnvelope(selectedCaseKey, environment),
    [selectedCaseKey, environment],
  );

  const authPreview = useMemo(() => {
    const row = GATEWAY_SIMULATION_CASES.find((c) => c.case_key === selectedCaseKey);
    if (!row) return null;
    return evaluateAuthSimulationCase(row.auth_case_key, { environment });
  }, [selectedCaseKey, environment]);

  const stagePreview = useMemo(() => {
    const row = GATEWAY_SIMULATION_CASES.find((c) => c.case_key === selectedCaseKey);
    if (!authPreview || !row) return [];
    const mergedStageOverrides = { ...row.stage_overrides };
    return buildGatewayStageTrace(row, authPreview, mergedStageOverrides);
  }, [selectedCaseKey, authPreview]);

  const handleEvaluate = () => {
    setEvaluation(evaluateGatewaySimulationCase(selectedCaseKey, { environment }));
  };

  const handleReset = () => {
    setEvaluation(null);
  };

  const ev = evaluation;

  return (
    <DevConsoleLayout
      title="Gateway Simulator"
      subtitle="Phase 5C — API gateway and request envelope architecture simulation. Fourteen rehearsal stages, delegated Phase 5B authentication, illustrative routing outcomes only; no gateways, middleware, TLS, quotas, or storage."
      environment={environment === "live" ? "sandbox" : environment}
    >
      <div className={planningBannerClass}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"
          aria-hidden
        >
          🚦
        </span>
        <div className="min-w-0">
          <strong className="block font-semibold text-amber-900">
            Simulation only — not a deployed API gateway.
          </strong>
          <span className="block">
            Phase{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {DEVELOPER_GATEWAY_SIMULATION_PHASE}
            </code>
            . Seeded envelopes live in{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              lib/developerGatewaySimulationConfig.js
            </code>
            ; delegated authentication references{" "}
            <Link href="/dev-console/auth-simulator" className="font-semibold text-amber-900 underline">
              Phase 5B
            </Link>
            , and catalog keys anchor to{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">{DEVELOPER_PRODUCT_PHASE}</code>
            . Post-gateway sandbox delegate narration continues in{" "}
            <Link href="/dev-console/execution-routing" className="font-semibold text-amber-900 underline">
              Phase 5D execution routing
            </Link>
            .
          </span>
        </div>
      </div>

      <section className={sectionCardClass} aria-labelledby="gw-controls-heading">
        <h2 id="gw-controls-heading" className={sectionTitleClass}>
          1. Controls
        </h2>
        <p className={sectionSubtitleClass}>
          Pick a seeded case and an envelope environment label. <strong>Live</strong> and{" "}
          <strong>internal</strong> values are deterministic overrides for narration — identical in spirit to the Auth
          Simulator drills; nothing opens real traffic edges.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">Gateway case</span>
            <select
              value={selectedCaseKey}
              onChange={(e) => {
                setSelectedCaseKey(e.target.value);
                handleReset();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {GATEWAY_SIMULATION_CASES.map((c) => (
                <option key={c.case_key} value={c.case_key}>
                  {c.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
              Envelope environment label
            </span>
            <select
              value={environment}
              onChange={(e) => {
                setEnvironment(e.target.value);
                handleReset();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {GATEWAY_UI_ENVIRONMENTS.map((env) => (
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
            The sections below preview how the envelopes merge across{" "}
            <strong>{INTERNAL_OBSERVABILITY_PHASE}</strong> and{" "}
            <strong>{INTERNAL_RUNTIME_STATE_PHASE}</strong> narration. Tap <strong>Run simulation</strong> to pin routed
            outcomes, audit payloads, correlation blurbs, and delegated auth payloads.
          </p>
        ) : null}
      </section>

      <section className={sectionCardClass} aria-labelledby="gw-catalog-heading">
        <h2 id="gw-catalog-heading" className={sectionTitleClass}>
          2. Gateway processing stages &amp; routing vocabulary
        </h2>
        <p className={sectionSubtitleClass}>
          Fourteen ordered surfaces — statuses follow <code className="text-xs">modeled</code>,{" "}
          <code className="text-xs">planned</code>, or <code className="text-xs">future</code> conventions and pair with ten
          illustrative routing outcomes.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white/80 p-3 text-sm lg:max-h-96">
            {GATEWAY_PROCESSING_STAGES.map((s) => (
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
            {GATEWAY_ROUTING_OUTCOMES.map((o) => (
              <li key={o.outcome_key} className="rounded-xl border border-slate-200 bg-white/80 p-3">
                <RouteOutcomeBadge outcomeKey={o.outcome_key} />
                <span className="ml-2 font-semibold text-slate-900">{o.label}</span>
                <p className="mt-1 text-xs text-slate-600">{o.developer_message}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="gw-envelope-fields-heading">
        <h2 id="gw-envelope-fields-heading" className={sectionTitleClass}>
          3. Envelope schema, correlation, rate-limit &amp; audit previews
        </h2>
        <p className={sectionSubtitleClass}>
          Sandbox analytics phase <code className="text-xs">{DEVELOPER_SANDBOX_ANALYTICS_PHASE}</code> appears only as
          metadata anchors inside <code className="text-xs">request_metadata</code>; credential posture still references{" "}
          <code className="text-xs">{DEVELOPER_CREDENTIAL_PHASE}</code> placeholders.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Envelope field catalog</h3>
            <ul className="mt-2 grid gap-1 text-xs text-slate-700">
              {GATEWAY_ENVELOPE_FIELDS.map((f) => (
                <li key={f.field_key}>
                  <code>{f.field_key}</code>
                  <span className="text-slate-500">
                    {" "}
                    — {f.label}
                    {f.required_hint ? " (required rehearsal hint)" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Correlation models ({GATEWAY_CORRELATION_MODELS.length})</h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {GATEWAY_CORRELATION_MODELS.map((m) => (
                  <li key={m.model_key}>
                    <span className="font-semibold text-slate-800">{m.label}:</span> {m.description}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Rate-limit rehearsals</h3>
              <ul className="mt-2 grid gap-1 text-xs">
                {GATEWAY_RATE_LIMIT_MODELS.map((t) => (
                  <li key={t.tier_key} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <code>{t.tier_key}</code> — {buildGatewayRateLimitSummary(t.tier_key)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-slate-900">Audit envelope field names ({GATEWAY_AUDIT_ENVELOPE_FIELDS.length})</h3>
          <p className="mt-1 text-xs text-slate-600">{GATEWAY_AUDIT_ENVELOPE_FIELDS.join(", ")}</p>
        </div>
      </section>

      {evaluation ? (
        <>
          <section className={sectionCardClass} aria-labelledby="gw-summary-heading">
            <h2 id="gw-summary-heading" className={sectionTitleClass}>
              4. Simulation summary
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RouteOutcomeBadge outcomeKey={ev.routing_outcome.outcome_key} />
              <Pill className="border border-slate-200 bg-slate-50 text-slate-700">
                {ev.terminal_outcome ? "Terminal (preview)" : "Non-terminal preview"}
              </Pill>
              {ev.outcome_matches_expected ? (
                <Pill className="border border-emerald-200 bg-emerald-50 text-emerald-800">Matches expected routing</Pill>
              ) : (
                <Pill className="border border-amber-200 bg-amber-50 text-amber-900">Expected drift</Pill>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat label="Case title" value={ev.case.title} />
              <Stat label="Seed environment" value={ev.case.environment} />
              <Stat label="Envelope label" value={environment} />
              <Stat label="Auth delegate" value={ev.case.auth_case_key} mono />
              <Stat label="Product" value={ev.case.product_key} mono />
              <Stat label="Contract" value={ev.case.contract_key} mono />
              <Stat label="Counts" value={`${ev.counts.passed} pass · ${ev.counts.failed} fail · ${ev.counts.warning} warn · ${ev.counts.skipped} skip`} />
              <Stat
                label="Routing summary"
                value={buildGatewayRoutingOutcomeSummary(ev.routing_outcome.outcome_key)}
              />
            </dl>
          </section>

          <section className={sectionCardClass} aria-labelledby="gw-envelope-heading">
            <h2 id="gw-envelope-heading" className={sectionTitleClass}>
              5. Request envelope (merged)
            </h2>
            <p className={sectionSubtitleClass}>
              <code className="text-xs">credential_reference</code> is always the placeholder label — no handles or secrets
              are materialized.
            </p>
            <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-emerald-100">
              {JSON.stringify(ev.envelope, null, 2)}
            </pre>
          </section>

          <section className={sectionCardClass} aria-labelledby="gw-trace-heading">
            <h2 id="gw-trace-heading" className={sectionTitleClass}>
              6. Gateway stage trace
            </h2>
            <p className={sectionSubtitleClass}>
              Fourteen ordered surfaces with skip propagation after blocking failures. Auth verification delegates into
              Phase 5B outcomes for the selected <code className="text-xs">auth_case_key</code>.
            </p>
            <ol className="mt-4 flex flex-col gap-2">
              {ev.stage_trace.map((step, idx) => (
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

          <section className={sectionCardClass} aria-labelledby="gw-audit-heading">
            <h2 id="gw-audit-heading" className={sectionTitleClass}>
              7. Audit envelope preview &amp; correlation summary
            </h2>
            <p className={sectionSubtitleClass}>{ev.correlation_summary.text}</p>
            <pre className="mt-4 max-h-72 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-900">
              {JSON.stringify(ev.audit_envelope, null, 2)}
            </pre>
          </section>

          <section className={sectionCardClass} aria-labelledby="gw-auth-heading">
            <h2 id="gw-auth-heading" className={sectionTitleClass}>
              8. Delegated Phase 5B authentication trace
            </h2>
            <p className={sectionSubtitleClass}>
              Mirrors the Auth Simulator evaluation for transparency — pairing links below jump to the standalone tool.
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-blue-700">
              <Link href="/dev-console/auth-simulator" className="hover:underline">
                Open Auth Simulator →
              </Link>
            </div>
            <ol className="mt-4 flex flex-col gap-1.5">
              {(ev.delegated_auth_evaluation?.stages ?? []).map((step, idx) => (
                <li key={`${step.stage_key}-${idx}`} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-2 py-1 text-xs text-slate-800">
                  <span>{idx + 1}.</span>
                  <span className="font-semibold">{step.label}</span>
                  <StageResultPill result={step.result} />
                </li>
              ))}
            </ol>
          </section>

          <section className={sectionCardClass} aria-labelledby="gw-rate-heading">
            <h2 id="gw-rate-heading" className={sectionTitleClass}>
              9. Rate-limit narration
            </h2>
            <p className={sectionSubtitleClass}>{ev.rate_limit_summary}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Correlation recap</span>
                <ul className="mt-2 list-disc pl-5">
                  {ev.correlation_summary.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Developer / operator summaries</span>
                <p className="mt-2 leading-relaxed text-slate-800">{ev.developer_message}</p>
                <p className="mt-2 leading-relaxed text-slate-600">{ev.operator_summary}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">{ev.explanation}</p>
          </section>

          <section className={sectionCardClass} aria-labelledby="gw-related-heading">
            <h2 id="gw-related-heading" className={sectionTitleClass}>
              10. Related console previews
            </h2>
            <p className={sectionSubtitleClass}>
              Phase 5C is an envelope choreography layer — credential vocabulary, catalogs, sandbox analytics rehearsals,
              and downstream execution modeling stay separate consoles.
            </p>
            <ul className="mt-4 flex flex-col gap-2 text-sm font-semibold text-blue-700">
              <li>
                <Link href="/dev-console/auth-simulator" className="hover:underline">
                  Auth Simulator (Phase 5B) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/execution-routing" className="hover:underline">
                  Execution Routing (Phase 5D) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/product-catalog" className="hover:underline">
                  Product Catalog (Phase 4D) →
                </Link>
              </li>
              <li>
                <Link href="/dev-console/credential-architecture" className="hover:underline">
                  Credential Architecture (Phase 5A) →
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
              isolation boundaries, readiness gates, and emergency shutdown before any execution environment exists.
            </p>
          </section>
        </>
      ) : (
        <>
          <section className={sectionCardClass} aria-labelledby="gw-unpinned-heading">
            <h2 id="gw-unpinned-heading" className={sectionTitleClass}>
              4–10 Run to pin routed outcomes
            </h2>
            <p className={sectionSubtitleClass}>
              Unpinned previews below reuse the merged envelope, delegated auth simulation, and stage trace merges for
              the current dropdown selections.
            </p>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">Envelope preview</h3>
            <pre className="mt-2 max-h-52 overflow-auto rounded-xl border border-slate-200 bg-slate-900 p-3 text-[0.7rem] text-emerald-100">
              {JSON.stringify(envelopePreview, null, 2)}
            </pre>
            <h3 className="mt-6 text-sm font-semibold text-slate-900">Delegated auth headline</h3>
            <p className="mt-1 text-xs text-slate-600">
              Outcome:<span className="ml-2 font-semibold text-slate-900">{authPreview?.derived_outcome ?? "n/a"}</span>
              {authPreview?.terminal_failure !== undefined ? (
                <span className="ml-3">
                  Terminal in Phase 5B lens:{" "}
                  <strong>{authPreview.terminal_failure ? "yes (sim)" : "no"}</strong>
                </span>
              ) : null}
            </p>
            <h3 className="mt-6 text-sm font-semibold text-slate-900">Correlation summary rehearsal</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">
              {buildGatewayCorrelationSummary(envelopePreview).text}
            </p>
            <h3 className="mt-6 text-sm font-semibold text-slate-900">Gateway stage preview</h3>
            <ol className="mt-2 flex flex-col gap-1.5">
              {(stagePreview ?? []).map((step, idx) => (
                <li key={step.stage_key} className="flex flex-wrap items-center gap-2 text-xs text-slate-700">
                  <span>{idx + 1}.</span>
                  <span>{step.label}</span>
                  <StageResultPill result={step.result} />
                </li>
              ))}
            </ol>
          </section>
        </>
      )}

      <section className={sectionCardClass} aria-labelledby="gw-safety-heading">
        <h2 id="gw-safety-heading" className={sectionTitleClass}>
          Simulation safety rules
        </h2>
        <ol className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {GATEWAY_SIMULATION_SAFETY_RULES.map((rule, idx) => (
            <li
              key={rule}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 text-sm leading-relaxed text-slate-800 sm:text-[0.9375rem]"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[0.7rem] font-bold text-white" aria-hidden>
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
