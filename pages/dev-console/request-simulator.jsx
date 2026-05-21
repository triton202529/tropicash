import { useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { DEVELOPER_AUTH_SIMULATION_PHASE } from "../../lib/developerAuthSimulationConfig";
import { DEVELOPER_EXECUTION_ROUTING_PHASE } from "../../lib/developerExecutionRoutingConfig";
import { DEVELOPER_GATEWAY_SIMULATION_PHASE } from "../../lib/developerGatewaySimulationConfig";
import { PRODUCT_ACCESS_PHASE } from "../../lib/developerProductAccessConfig";
import { CREDENTIAL_LIFECYCLE_PHASE } from "../../lib/developerCredentialLifecycleConfig";
import {
  SANDBOX_REQUEST_CASES,
  SANDBOX_REQUEST_FLOW_STAGES,
  SANDBOX_REQUEST_METHODS,
  SANDBOX_REQUEST_OUTCOMES,
  SANDBOX_REQUEST_FAILURE_STATES,
  SANDBOX_REQUEST_SAFETY_RULES,
  SANDBOX_REQUEST_FLOW_PHASE,
  buildSandboxRequestEnvelope,
  buildSandboxRequestStageTrace,
  buildSandboxRequestValidationSummary,
  evaluateSandboxRequestCase,
} from "../../lib/developerSandboxRequestFlowConfig";
import {
  REQUEST_GOVERNANCE_PHASE,
  REQUEST_GOVERNANCE_STATES,
  REQUEST_VISIBILITY_RULES,
  REQUEST_REVIEW_OUTCOMES,
  REQUEST_OBSERVABILITY_SIGNALS,
  REQUEST_GOVERNANCE_SAFETY_RULES,
  getRequestGovernanceOverview,
  buildRequestGovernanceSummary,
  buildRequestVisibilitySummary,
  buildRequestObservabilitySummary,
  buildRequestAuditSummary,
  buildRequestRiskSummary,
  getRequestFailureGovernanceLink,
} from "../../lib/developerRequestGovernanceConfig";

const planningBannerClass =
  "flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:flex-row sm:items-start sm:gap-4 sm:p-6 sm:text-[0.9375rem]";
const sectionCardClass = "tropicash-surface rounded-2xl p-5 sm:p-6";
const sectionTitleClass = "text-base font-bold text-slate-900 sm:text-lg";
const sectionSubtitleClass =
  "mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]";

const REQUEST_UI_ENVIRONMENTS = [
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

function StageResultPill({ result }) {
  const map = {
    passed: "border border-emerald-200 bg-emerald-50 text-emerald-800",
    failed: "border border-rose-200 bg-rose-50 text-rose-800",
    skipped: "border border-slate-200 bg-slate-50 text-slate-600",
    warning: "border border-amber-200 bg-amber-50 text-amber-900",
  };
  return <Pill className={map[result] ?? map.passed}>{result}</Pill>;
}

function OutcomeBadge({ outcomeKey, category }) {
  const tone =
    category === "success"
      ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
      : category === "review"
        ? "border border-amber-200 bg-amber-50 text-amber-900"
        : "border border-rose-200 bg-rose-50 text-rose-800";
  return (
    <Pill className={tone} title={outcomeKey}>
      {(outcomeKey ?? "unset").replace(/_/g, " ")}
    </Pill>
  );
}

function Stat({ label, value, mono }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={`mt-1 break-words text-sm font-semibold text-slate-900 ${mono ? "font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function RequestSimulatorPage() {
  const defaultCaseKey = SANDBOX_REQUEST_CASES[0]?.case_key ?? "";
  const [selectedCaseKey, setSelectedCaseKey] = useState(defaultCaseKey);
  const [environment, setEnvironment] = useState("sandbox");
  const [evaluation, setEvaluation] = useState(null);

  const governanceOverview = useMemo(
    () =>
      getRequestGovernanceOverview({
        linked_case_key: selectedCaseKey,
      }),
    [selectedCaseKey],
  );
  const governanceSummary = buildRequestGovernanceSummary(governanceOverview.seed);
  const visibilitySummary = buildRequestVisibilitySummary();
  const observabilitySummary = buildRequestObservabilitySummary(selectedCaseKey);
  const auditSummary = buildRequestAuditSummary();
  const riskSummary = buildRequestRiskSummary();

  const selectedCase = useMemo(
    () => SANDBOX_REQUEST_CASES.find((c) => c.case_key === selectedCaseKey) ?? null,
    [selectedCaseKey],
  );

  const envelopePreview = useMemo(
    () => buildSandboxRequestEnvelope(selectedCaseKey, environment),
    [selectedCaseKey, environment],
  );

  const stagePreview = useMemo(() => {
    if (!selectedCase) return [];
    return buildSandboxRequestStageTrace(selectedCase, environment);
  }, [selectedCase, environment]);

  const validationPreview = useMemo(() => {
    if (!selectedCase) return null;
    return buildSandboxRequestValidationSummary(selectedCase, environment);
  }, [selectedCase, environment]);

  const handleRun = () => {
    setEvaluation(evaluateSandboxRequestCase(selectedCaseKey, { environment }));
  };

  const handleReset = () => {
    setEvaluation(null);
  };

  const ev = evaluation;

  return (
    <DevConsoleLayout
      title="Request Simulator"
      subtitle="Phase 10A + 10B — Simulation only, metadata only, preview only. Twelve rehearsal stages and Phase 5B/5C/5D delegates return deterministic response previews only — no execution, no live request traffic, no endpoint activation, no auth runtime, webhooks, telemetry emitters, or money movement."
      environment={environment === "live" ? "sandbox" : environment}
    >
      <div className={planningBannerClass}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"
          aria-hidden
        >
          📨
        </span>
        <div className="min-w-0">
          <strong className="block font-semibold text-amber-900">
            Simulation only, metadata only, preview only — no execution, no live request traffic, no endpoint activation,
            and no money movement. No real endpoint, credential, authentication, webhook, telemetry emitter, or audit
            ingestion is active.
          </strong>
          <span className="block break-words">
            Phases{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {SANDBOX_REQUEST_FLOW_PHASE}
            </code>{" "}
            and{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {REQUEST_GOVERNANCE_PHASE}
            </code>
            . Seeds live in{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              lib/developerSandboxRequestFlowConfig.js
            </code>{" "}
            and{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              lib/developerRequestGovernanceConfig.js
            </code>
            ; entitlements align with{" "}
            <Link href="/dev-console/product-access" className="font-semibold text-amber-900 underline">
              Product Access (9A + 9B)
            </Link>
            , credentials with{" "}
            <Link href="/dev-console/credential-lifecycle" className="font-semibold text-amber-900 underline">
              Credential Lifecycle (8A + 8B)
            </Link>
            , and request path delegates with{" "}
            <Link href="/dev-console/auth-simulator" className="font-semibold text-amber-900 underline">
              Auth
            </Link>
            ,{" "}
            <Link href="/dev-console/gateway-simulator" className="font-semibold text-amber-900 underline">
              Gateway
            </Link>
            , and{" "}
            <Link href="/dev-console/execution-routing" className="font-semibold text-amber-900 underline">
              Execution Routing
            </Link>{" "}
            simulators.
          </span>
        </div>
      </div>

      <section className={sectionCardClass} aria-labelledby="req-controls-heading">
        <h2 id="req-controls-heading" className={sectionTitleClass}>
          3. Controls
        </h2>
        <p className={sectionSubtitleClass}>
          Pick a seeded sandbox request case and an environment label. <strong>Live</strong> and{" "}
          <strong>internal</strong> values rehearse isolation drills only — route previews remain labeled preview only and
          never activate HTTP surfaces.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">Request case</span>
            <select
              value={selectedCaseKey}
              onChange={(e) => {
                setSelectedCaseKey(e.target.value);
                handleReset();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              {SANDBOX_REQUEST_CASES.map((c) => (
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
              {REQUEST_UI_ENVIRONMENTS.map((env) => (
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
            onClick={handleRun}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Run Request Simulation
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
            Sections 4–9 preview envelope fields, stage traces, and validation posture. Tap{" "}
            <strong>Run Request Simulation</strong> to pin delegated auth, gateway, and routing evaluations with response
            previews.
          </p>
        ) : null}
      </section>

      <section className={sectionCardClass} aria-labelledby="req-vocab-heading">
        <h2 id="req-vocab-heading" className={sectionTitleClass}>
          Flow vocabulary
        </h2>
        <p className={sectionSubtitleClass}>
          Twelve stages, ten outcomes, ten failure states, and four conceptual HTTP methods — all configuration only.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-xl border border-slate-200 bg-white/80 p-3 text-xs">
            {SANDBOX_REQUEST_FLOW_STAGES.map((s) => (
              <li key={s.stage_key}>
                <code>{s.stage_key}</code> — {s.label}
              </li>
            ))}
          </ul>
          <div className="space-y-3 text-sm">
            <div>
              <h3 className="font-semibold text-slate-900">Methods</h3>
              <p className="mt-1 text-xs text-slate-600">
                {SANDBOX_REQUEST_METHODS.map((m) => m.method).join(", ")} — conceptual only.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Outcomes ({SANDBOX_REQUEST_OUTCOMES.length})</h3>
              <ul className="mt-1 space-y-1 text-xs text-slate-600">
                {SANDBOX_REQUEST_OUTCOMES.map((o) => (
                  <li key={o.outcome_key}>
                    <code>{o.outcome_key}</code> — {o.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="req-envelope-heading">
        <h2 id="req-envelope-heading" className={sectionTitleClass}>
          4. Request envelope
        </h2>
        <p className={sectionSubtitleClass}>
          Method, route preview (preview only — not a registered route), product, capability, credential placeholder status,
          entitlement state, and linked simulation case keys.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Method" value={envelopePreview.method} />
          <Stat label="Route preview" value={envelopePreview.route_preview} mono />
          <Stat label="Product" value={envelopePreview.product_key ?? "—"} mono />
          <Stat label="Capability" value={envelopePreview.capability_key ?? "—"} mono />
          <Stat label="Credential status" value={envelopePreview.credential_status} mono />
          <Stat label="Entitlement" value={envelopePreview.entitlement_state} mono />
          <Stat label="Auth case" value={envelopePreview.auth_case_key ?? "—"} mono />
          <Stat label="Gateway case" value={envelopePreview.gateway_case_key ?? "—"} mono />
          <Stat label="Routing case" value={envelopePreview.routing_case_key ?? "—"} mono />
        </dl>
        <pre className="mt-4 max-h-72 overflow-x-auto break-all rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-emerald-100">
          {JSON.stringify(ev?.request_envelope ?? envelopePreview, null, 2)}
        </pre>
      </section>

      <section className={sectionCardClass} aria-labelledby="req-trace-heading">
        <h2 id="req-trace-heading" className={sectionTitleClass}>
          5. Stage trace
        </h2>
        <p className={sectionSubtitleClass}>
          Twelve ordered surfaces with pass, fail, warning, or skipped results. Blocking stages halt downstream narration.
        </p>
        <ol className="mt-4 flex flex-col gap-2">
          {(ev?.stage_trace ?? stagePreview).map((step, idx) => (
            <li
              key={step.stage_key}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs text-slate-500">{idx + 1}</span>
              <span className="font-semibold text-slate-900">{step.label}</span>
              <code className="text-[0.65rem] text-slate-500">{step.stage_key}</code>
              <StageResultPill result={step.result} />
              {step.blocking ? (
                <Pill className="border border-slate-300 bg-slate-100 text-slate-800">blocking</Pill>
              ) : (
                <Pill className="border border-slate-200 bg-white text-slate-600">non-blocking</Pill>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className={sectionCardClass} aria-labelledby="req-validation-heading">
        <h2 id="req-validation-heading" className={sectionTitleClass}>
          6. Validation summary
        </h2>
        <p className={sectionSubtitleClass}>
          Credential readiness ({CREDENTIAL_LIFECYCLE_PHASE}), entitlement visibility ({PRODUCT_ACCESS_PHASE}), capability
          scope, and auth / gateway / routing link status.
        </p>
        {(() => {
          const v = ev?.validation_summary ?? validationPreview;
          if (!v) return null;
          return (
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat
                label="Credential ready"
                value={v.credential_readiness.ready ? "Yes (placeholder)" : "No"}
              />
              <Stat
                label="Entitlement visible"
                value={v.entitlement_visibility.visible ? "Yes" : "No"}
              />
              <Stat label="Capability scope" value={v.capability_scope.ok ? "OK" : "Blocked"} />
              <Stat label="Auth linked" value={v.auth_link.linked ? (v.auth_link.blocked ? "Blocked" : "OK") : "Missing"} />
              <Stat
                label="Gateway linked"
                value={v.gateway_link.linked ? (v.gateway_link.blocked ? "Blocked" : "OK") : "Missing"}
              />
              <Stat
                label="Routing linked"
                value={v.routing_link.linked ? (v.routing_link.blocked ? "Blocked" : "OK") : "Missing"}
              />
              <Stat label="Payload shape" value={v.payload_shape.ok ? "Valid preview" : "Invalid"} />
              <Stat label="Live blocked" value={v.environment_guard.live_blocked ? "Yes" : "No"} />
              <Stat
                label="Money movement"
                value={v.environment_guard.money_movement_blocked ? "Disabled" : "N/A"}
              />
            </dl>
          );
        })()}
      </section>

      <section className={sectionCardClass} aria-labelledby="req-response-heading">
        <h2 id="req-response-heading" className={sectionTitleClass}>
          7. Response preview
        </h2>
        <p className={sectionSubtitleClass}>
          <strong className="text-rose-900">Preview only</strong> — formatted object for teaching. Not an HTTP response from a
          live endpoint. No secrets, tokens, real balances, or production transaction identifiers.
        </p>
        {ev?.response_preview || selectedCase ? (
          <pre className="mt-4 max-h-80 overflow-x-auto break-all rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-xs text-slate-900">
            {JSON.stringify(
              ev?.response_preview ??
                (selectedCase
                  ? { note: "Run Request Simulation to materialize the pinned preview object." }
                  : {}),
              null,
              2,
            )}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Select a case to preview response shape.</p>
        )}
      </section>

      <section className={sectionCardClass} aria-labelledby="req-failures-heading">
        <h2 id="req-failures-heading" className={sectionTitleClass}>
          8. Failure states
        </h2>
        <p className={sectionSubtitleClass}>Developer-safe messages and operator summaries for seeded failure keys.</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {(ev?.active_failure_states?.length
            ? ev.active_failure_states
            : selectedCase?.failure_state_keys?.length
              ? SANDBOX_REQUEST_FAILURE_STATES.filter((f) =>
                  selectedCase.failure_state_keys.includes(f.failure_key),
                )
              : [
                  {
                    failure_key: "none",
                    developer_message: "No seeded failure keys for this case — run simulation to apply environment guards.",
                    operator_message: "Happy-path rehearsal unless live drill adds live_environment_blocked.",
                    severity: "info",
                    terminal: false,
                  },
                ]
          ).map((f) => (
            <li key={f.failure_key} className="rounded-xl border border-slate-200 bg-white/80 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <code className="text-xs">{f.failure_key}</code>
                {"severity" in f && f.severity ? (
                  <Pill className="border border-slate-200 bg-slate-50 text-slate-700">{f.severity}</Pill>
                ) : null}
              </div>
              <p className="mt-2 font-medium text-slate-900">{f.developer_message}</p>
              <p className="mt-1 text-xs text-slate-600">{f.operator_message}</p>
              {f.failure_key && f.failure_key !== "none" ? (() => {
                const govLink = getRequestFailureGovernanceLink(f.failure_key);
                if (!govLink) return null;
                return (
                  <p className="mt-2 text-xs text-slate-500">
                    <strong className="text-slate-700">10B link:</strong>{" "}
                    {govLink.blocking_model?.label ?? govLink.blocking_model_key} ·{" "}
                    {govLink.rationale?.title ?? govLink.rationale_key}
                  </p>
                );
              })() : null}
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="req-outcome-heading">
        <h2 id="req-outcome-heading" className={sectionTitleClass}>
          9. Outcome summary
        </h2>
        {ev ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <OutcomeBadge
                outcomeKey={ev.outcome_summary.outcome_key}
                category={ev.outcome_summary.category}
              />
              <Pill className="border border-slate-200 bg-slate-50 text-slate-700">
                {ev.outcome_summary.terminal ? "Terminal (preview)" : "Non-terminal preview"}
              </Pill>
              {ev.outcome_summary.matches_expected ? (
                <Pill className="border border-emerald-200 bg-emerald-50 text-emerald-800">Matches expected</Pill>
              ) : (
                <Pill className="border border-amber-200 bg-amber-50 text-amber-900">Expected drift</Pill>
              )}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Expected" value={ev.expected_outcome} mono />
              <Stat label="Resolved" value={ev.outcome_summary.outcome_key} mono />
              <Stat label="Category" value={ev.outcome_summary.category} />
              <Stat
                label="Stage counts"
                value={`${ev.counts.passed} pass · ${ev.counts.failed} fail · ${ev.counts.warning} warn · ${ev.counts.skipped} skip`}
              />
            </dl>
            <p className="mt-4 text-sm text-slate-800">{ev.developer_message}</p>
            <p className="mt-2 text-xs text-slate-600">{ev.operator_summary}</p>
            <p className="mt-3 text-sm text-slate-700">{ev.flow_summary?.explanation}</p>
          </>
        ) : (
          <p className={sectionSubtitleClass}>
            Run the simulation to pin terminal vs non-terminal outcomes, category, and developer / operator copy for case{" "}
            <code className="text-xs">{selectedCaseKey}</code>.
            {selectedCase ? (
              <>
                {" "}
                Seeded expected outcome: <code className="text-xs">{selectedCase.expected_outcome}</code>.
              </>
            ) : null}
          </p>
        )}
      </section>

      <div
        className="flex flex-col gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-relaxed text-sky-950 sm:p-6"
        role="note"
      >
        <strong className="font-semibold text-sky-900">Phase 10B — Request governance & observability (metadata only)</strong>
        <span className="break-words">
          Governance states, visibility rules, observability signals, and audit trail seeds narrate how sandbox requests
          would be reviewed and correlated in a future platform — simulation only, metadata only, preview only; no
          execution, no live request traffic, no endpoint activation, and no money movement. Selected case{" "}
          <code className="rounded bg-sky-100 px-1 font-mono text-xs">{selectedCaseKey}</code> links observability copy
          only.
        </span>
      </div>

      <section className={sectionCardClass} aria-labelledby="req-gov-summary-heading">
        <h2 id="req-gov-summary-heading" className={sectionTitleClass}>
          10B.1 Governance state summary
        </h2>
        <p className={sectionSubtitleClass}>{governanceSummary}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Governance state"
            value={governanceOverview.state?.label ?? governanceOverview.seed.governance_state_key}
          />
          <Stat
            label="Review outcome"
            value={governanceOverview.review_outcome?.label ?? governanceOverview.seed.review_outcome_key}
          />
          <Stat
            label="Visibility rule"
            value={governanceOverview.visibility_rule?.label ?? governanceOverview.seed.visibility_rule_key}
          />
          <Stat label="States modeled" value={String(REQUEST_GOVERNANCE_STATES.length)} />
        </dl>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {REQUEST_GOVERNANCE_STATES.map((s) => (
            <li key={s.state_key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-900">{s.label}</span>
              <p className="mt-1 text-slate-600">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="req-gov-review-heading">
        <h2 id="req-gov-review-heading" className={sectionTitleClass}>
          10B.2 Review outcomes
        </h2>
        <p className={sectionSubtitleClass}>
          Operator review outcomes are placeholder narration — passing review does not enable HTTP traffic, observability
          export, or endpoint activation.
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {REQUEST_REVIEW_OUTCOMES.map((o) => (
            <li key={o.outcome_key} className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-900">{o.label}</span>
              <p className="mt-1 text-slate-600">{o.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="req-gov-visibility-heading">
        <h2 id="req-gov-visibility-heading" className={sectionTitleClass}>
          10B.3 Visibility rules
        </h2>
        <p className={sectionSubtitleClass}>{visibilitySummary}</p>
        <ul className="mt-4 space-y-3">
          {REQUEST_VISIBILITY_RULES.map((rule) => (
            <li key={rule.rule_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{rule.label}</span>
                <Pill className="border border-slate-200 bg-slate-50 text-slate-700">{rule.audience}</Pill>
                <code className="text-[0.65rem] text-slate-500">{rule.rule_key}</code>
              </div>
              <p className="mt-2 text-sm text-slate-600">{rule.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="req-gov-obs-heading">
        <h2 id="req-gov-obs-heading" className={sectionTitleClass}>
          10B.4 Observability signals
        </h2>
        <p className={sectionSubtitleClass}>{observabilitySummary}</p>
        <ul className="mt-4 space-y-3">
          {REQUEST_OBSERVABILITY_SIGNALS.map((sig) => (
            <li key={sig.signal_key} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{sig.label}</span>
                <Pill className="border border-indigo-200 bg-white text-indigo-900">{sig.category}</Pill>
                <code className="text-[0.65rem] text-slate-500">{sig.signal_key}</code>
              </div>
              <p className="mt-2 text-sm text-slate-600">{sig.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                Stage: <code>{sig.correlates_to_stage}</code> · Phase 2E anchor: <code>{sig.phase_2e_anchor}</code>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="req-gov-audit-heading">
        <h2 id="req-gov-audit-heading" className={sectionTitleClass}>
          10B.5 Audit trail seeds
        </h2>
        <p className={sectionSubtitleClass}>{auditSummary}</p>
        <ol className="mt-4 space-y-3">
          {governanceOverview.audit_trail.events.map((evt) => (
            <li key={evt.audit_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Pill className="border border-slate-200 bg-slate-50 text-slate-700">{evt.simulated_step_label}</Pill>
                <span className="font-semibold text-slate-900">{evt.title}</span>
                <Pill>{evt.actor}</Pill>
                <code className="text-[0.65rem] text-slate-500">{evt.governance_state}</code>
              </div>
              <p className="mt-2 text-sm text-slate-600">{evt.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                <strong className="text-slate-700">Visibility:</strong> {evt.visibility}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className={sectionCardClass} aria-labelledby="req-gov-blocking-heading">
        <h2 id="req-gov-blocking-heading" className={sectionTitleClass}>
          10B.6 Blocking models
        </h2>
        <p className={sectionSubtitleClass}>
          Teaching models for entitlement, credential, auth, gateway, routing, and environment blocks — no edge
          enforcement, no workers, no Supabase writes.
        </p>
        <ul className="mt-4 space-y-4">
          {governanceOverview.blocking_models.models.map((model) => (
            <li key={model.model_key} className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{model.label}</span>
                <code className="text-xs text-slate-500">{model.model_key}</code>
              </div>
              <p className="mt-2 text-sm text-slate-700">
                <strong>Trigger:</strong> {model.trigger}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                <strong>Effect:</strong> {model.effect}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                <strong>Recovery:</strong> {model.recovery_path}
              </p>
              <p className="mt-3 text-xs text-slate-600">
                <strong className="text-slate-800">Developer:</strong> {model.developer_message}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                <strong className="text-slate-800">Operator:</strong> {model.operator_message}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="req-gov-rationale-heading">
        <h2 id="req-gov-rationale-heading" className={sectionTitleClass}>
          10B.7 Restriction rationale cards
        </h2>
        <p className={sectionSubtitleClass}>
          Rationale seeds explain why request visibility, review gates, and observability-without-emitters exist — metadata
          only, not enforcement code.
        </p>
        <ul className="mt-4 space-y-4">
          {governanceOverview.restriction_rationales.rationales.map((card) => (
            <li key={card.rationale_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <span className="font-semibold text-slate-900">{card.title}</span>
              <p className="mt-2 text-sm text-slate-600">{card.summary}</p>
              <p className="mt-2 text-xs text-slate-500">Rules: {card.related_rule_keys.join(", ")}</p>
              <p className="mt-1 text-xs text-slate-500">States: {card.related_state_keys.join(", ")}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionCardClass} aria-labelledby="req-gov-risk-heading">
        <h2 id="req-gov-risk-heading" className={sectionTitleClass}>
          10B.8 Governance risk summary
        </h2>
        <p className={sectionSubtitleClass}>{riskSummary.summary}</p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Blocking models" value={String(riskSummary.blocking_model_count)} />
          <Stat label="Observability signals" value={String(riskSummary.observability_signal_count)} />
          <Stat label="Audit seeds" value={String(riskSummary.audit_trail_seed_count)} />
          <Stat label="Live traffic" value={riskSummary.live_traffic_blocked ? "blocked" : "—"} />
          <Stat label="Endpoint risk" value={riskSummary.endpoint_activation_risk} mono />
          <Stat label="Telemetry risk" value={riskSummary.telemetry_emitter_risk} mono />
        </dl>
      </section>

      <section className={sectionCardClass} aria-labelledby="req-related-heading">
        <h2 id="req-related-heading" className={sectionTitleClass}>
          10. Related tools
        </h2>
        <p className={sectionSubtitleClass}>
          Sandbox request simulation (10A) and request governance / observability vocabulary (10B) stitch workspace
          readiness, entitlements, credential placeholders, and Phase 5B/5C/5D delegates — no real endpoint execution, no
          live traffic, no telemetry emitters.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dev-console/product-access"
            className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm hover:bg-emerald-100"
          >
            🎫 Product Access (9A + 9B)
          </Link>
          <Link
            href="/dev-console/credential-lifecycle"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🪪 Credential Lifecycle (8A + 8B)
          </Link>
          <Link
            href="/dev-console/auth-simulator"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🛂 Auth Simulator ({DEVELOPER_AUTH_SIMULATION_PHASE})
          </Link>
          <Link
            href="/dev-console/gateway-simulator"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🚦 Gateway Simulator ({DEVELOPER_GATEWAY_SIMULATION_PHASE})
          </Link>
          <Link
            href="/dev-console/execution-routing"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🧭 Execution Routing ({DEVELOPER_EXECUTION_ROUTING_PHASE})
          </Link>
          <Link
            href="/dev-console/runtime-activation"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🔒 Runtime Activation (Phase 6A)
          </Link>
          <Link
            href="/dev-console/workspace"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🏠 Workspace (Phase 7A + 7B)
          </Link>
          <Link
            href="/dev-console/product-catalog"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            📚 Product Catalog (Phase 4D)
          </Link>
          <Link
            href="/dev-console/app-governance"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            ⚖️ App Governance (Phase 4B)
          </Link>
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="req-safety-heading">
        <h2 id="req-safety-heading" className={sectionTitleClass}>
          Simulation safety rules (10A + 10B)
        </h2>
        <ol className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
          {[...SANDBOX_REQUEST_SAFETY_RULES, ...REQUEST_GOVERNANCE_SAFETY_RULES].map((rule, idx) => (
            <li
              key={`${idx}-${rule.slice(0, 40)}`}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white/80 p-3 text-sm leading-relaxed text-slate-800"
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
