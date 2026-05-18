import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  INTERNAL_OBSERVABILITY_PHASE,
  EXECUTION_STATUS_TYPES,
  EXECUTION_METRIC_CATEGORIES,
  EXECUTION_FAILURE_CATEGORIES,
  EXECUTION_FAILURE_SEVERITIES,
  EXECUTION_REPLAY_SCOPES,
  EXECUTION_SESSION_SEEDS,
  EXECUTION_METRIC_SEEDS,
  EXECUTION_FAILURE_SEEDS,
  EXECUTION_REPLAY_TEMPLATES,
  OBSERVABILITY_DASHBOARD_PREVIEWS,
  OBSERVABILITY_SAFETY_RULES,
  getExecutionStatusType,
  getExecutionFailureSeverity,
  getExecutionReplayScope,
  getMetricsForSession,
  getFailuresForSession,
} from "../../lib/internalObservabilityConfig";
import {
  EXECUTION_PIPELINE_STAGES,
  getPipelineStage,
} from "../../lib/internalExecutionOrchestrationConfig";
import {
  getCapabilityByKey,
  getCapabilityCategory,
  getCapabilityRiskLevel,
} from "../../lib/internalCapabilityConfig";

const planningBannerClass =
  "flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:flex-row sm:items-start sm:gap-4 sm:p-6 sm:text-[0.9375rem]";

const sectionCardClass = "tropicash-surface rounded-2xl p-5 sm:p-6";
const sectionTitleClass = "text-base font-bold text-slate-900 sm:text-lg";
const sectionSubtitleClass =
  "mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]";

const slug = (s) => s.replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "").toLowerCase();

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

function EnvironmentChip({ environment }) {
  if (environment === "live") {
    return (
      <Pill className="border border-emerald-200 bg-emerald-50 text-emerald-800">
        live
      </Pill>
    );
  }
  return (
    <Pill className="border border-sky-200 bg-sky-50 text-sky-800">
      sandbox
    </Pill>
  );
}

function StatusPill({ statusKey }) {
  const s = getExecutionStatusType(statusKey);
  return (
    <Pill className={s.badgeClass} title={s.description}>
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${s.dotClass}`}
        aria-hidden
      />
      {s.label}
    </Pill>
  );
}

function SeverityPill({ severityKey }) {
  const s = getExecutionFailureSeverity(severityKey);
  return (
    <Pill className={s.badgeClass} title={s.description}>
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${s.dotClass}`}
        aria-hidden
      />
      {s.label}
    </Pill>
  );
}

// ---------------------------------------------------------------------------
// 1. Execution session model
// ---------------------------------------------------------------------------
function ExecutionSessionsSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="execution-sessions-heading"
    >
      <h2 id="execution-sessions-heading" className={sectionTitleClass}>
        Execution session model
      </h2>
      <p className={sectionSubtitleClass}>
        Every future orchestrated request opens a session. Each session
        carries a stable{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          execution_session_id
        </code>{" "}
        and a parent{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          trace_id
        </code>{" "}
        so retries and review-required pauses stay attached to the original
        request.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {EXECUTION_SESSION_SEEDS.map((session) => {
          const cap = getCapabilityByKey(session.capabilityKey);
          const category = cap ? getCapabilityCategory(cap.category) : null;
          const risk = cap ? getCapabilityRiskLevel(cap.riskLevel) : null;
          return (
            <li
              key={session.executionSessionId}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
              style={{
                borderLeft: `4px solid ${category?.accent ?? "#0ea5e9"}`,
              }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {category ? (
                    <span aria-hidden className="text-base leading-none">
                      {category.icon}
                    </span>
                  ) : null}
                  <code className="font-mono text-[0.75rem] font-semibold text-slate-900">
                    {session.executionSessionId}
                  </code>
                </div>
                <StatusPill statusKey={session.executionStatus} />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 sm:text-[0.8125rem]">
                <span>
                  Capability:{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.7rem] text-slate-800">
                    {session.capabilityKey}
                  </code>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 sm:text-[0.8125rem]">
                <span>
                  Service:{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.7rem] text-slate-800">
                    {session.serviceKey}
                  </code>
                </span>
                <span className="text-slate-300" aria-hidden>
                  ·
                </span>
                <EnvironmentChip environment={session.environment} />
                {risk ? (
                  <Pill
                    className={risk.badgeClass}
                    title={risk.description}
                  >
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${risk.dotClass}`}
                      aria-hidden
                    />
                    Risk: {risk.label}
                  </Pill>
                ) : null}
              </div>
              <div className="flex flex-col gap-0.5 text-[0.7rem] text-slate-500">
                <span>
                  trace_id:{" "}
                  <code className="font-mono text-[0.7rem] text-slate-700">
                    {session.traceId}
                  </code>
                </span>
                {session.requestId ? (
                  <span>
                    request_id:{" "}
                    <code className="font-mono text-[0.7rem] text-slate-700">
                      {session.requestId}
                    </code>
                  </span>
                ) : null}
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
                  Show metadata JSON
                </summary>
                <code className="mt-1.5 block overflow-x-auto whitespace-pre rounded-md bg-slate-900/95 px-2 py-2 font-mono text-[0.7rem] text-slate-100">
                  {JSON.stringify(session.metadata, null, 2)}
                </code>
              </details>
            </li>
          );
        })}
      </ul>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-slate-900 sm:text-base">
          Session statuses
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {EXECUTION_STATUS_TYPES.map((s) => (
            <li
              key={s.key}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
            >
              <span
                className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${s.badgeClass}`}
              >
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${s.dotClass}`}
                  aria-hidden
                />
                {s.label}
              </span>
              <p className="text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
                {s.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Runtime metrics
// ---------------------------------------------------------------------------
function MetricsSection() {
  const grouped = EXECUTION_METRIC_CATEGORIES.map((cat) => ({
    category: cat,
    metrics: EXECUTION_METRIC_SEEDS.filter(
      (m) => m.metricCategory === cat.key,
    ),
  })).filter((g) => g.metrics.length > 0);

  return (
    <section className={sectionCardClass} aria-labelledby="metrics-heading">
      <h2 id="metrics-heading" className={sectionTitleClass}>
        Runtime metrics
      </h2>
      <p className={sectionSubtitleClass}>
        The canonical metric catalog the future telemetry pipeline will emit
        per session. Phase 2E seeds them with{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          metric_value=0
        </code>{" "}
        — they describe the metric{" "}
        <em>shape</em>, not real measurements.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {grouped.map(({ category, metrics }) => (
          <div
            key={category.key}
            className="rounded-xl border border-slate-200 bg-white/80 p-3"
            style={{ borderLeft: `4px solid ${category.accent}` }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <Pill className={category.badgeClass}>{category.label}</Pill>
                <code className="font-mono text-[0.7rem] text-slate-600">
                  {category.key}
                </code>
              </div>
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                {metrics.length}{" "}
                {metrics.length === 1 ? "metric" : "metrics"}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
              {category.description}
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
              {metrics.map((m) => (
                <li
                  key={m.metricKey}
                  className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60 p-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <code className="font-mono text-[0.75rem] font-semibold text-slate-900">
                      {m.metricKey}
                    </code>
                    <Pill className="border border-slate-200 bg-white/80 text-slate-700">
                      Unit: {m.metricUnit}
                    </Pill>
                  </div>
                  <span className="text-xs font-semibold text-slate-800 sm:text-[0.8125rem]">
                    {m.metricLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. Failure taxonomy
// ---------------------------------------------------------------------------
function FailureTaxonomySection() {
  const groupedByCategory = EXECUTION_FAILURE_CATEGORIES.map((cat) => ({
    category: cat,
    failures: EXECUTION_FAILURE_SEEDS.filter(
      (f) => f.failureCategory === cat.key,
    ),
  })).filter((g) => g.failures.length > 0);

  return (
    <section
      className={sectionCardClass}
      aria-labelledby="failure-taxonomy-heading"
    >
      <h2 id="failure-taxonomy-heading" className={sectionTitleClass}>
        Failure taxonomy
      </h2>
      <p className={sectionSubtitleClass}>
        The canonical set of failure modes the future evaluator may emit.
        Each failure references a Phase 2D{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          stage_key
        </code>{" "}
        and (optionally) a{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          policy_rule_key
        </code>{" "}
        and{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          decision_key
        </code>
        .
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {groupedByCategory.map(({ category, failures }) => (
          <div
            key={category.key}
            className="rounded-xl border border-slate-200 bg-white/80 p-3"
            style={{ borderLeft: `4px solid ${category.accent}` }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <Pill className={category.badgeClass}>{category.label}</Pill>
                <code className="font-mono text-[0.7rem] text-slate-600">
                  {category.key}
                </code>
              </div>
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                {failures.length}{" "}
                {failures.length === 1 ? "failure" : "failures"}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
              {category.description}
            </p>
            <ul className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
              {failures.map((f) => {
                const stage = f.stageKey ? getPipelineStage(f.stageKey) : null;
                return (
                  <li
                    key={f.failureKey}
                    className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 p-2"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <code className="font-mono text-[0.75rem] font-semibold text-slate-900">
                        {f.failureKey}
                      </code>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <SeverityPill severityKey={f.severity} />
                        {f.isTerminal ? (
                          <Pill className="border border-rose-200 bg-rose-50 text-rose-900">
                            Terminal
                          </Pill>
                        ) : (
                          <Pill className="border border-amber-200 bg-amber-50 text-amber-900">
                            Pause
                          </Pill>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-slate-600">
                      {stage ? (
                        <span>
                          stage:{" "}
                          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.7rem] text-slate-800">
                            {stage.stageKey}
                          </code>
                        </span>
                      ) : null}
                      {f.policyRuleKey ? (
                        <span>
                          rule:{" "}
                          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.7rem] text-slate-800">
                            {f.policyRuleKey}
                          </code>
                        </span>
                      ) : null}
                      {f.decisionKey ? (
                        <span>
                          decision:{" "}
                          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.7rem] text-slate-800">
                            {f.decisionKey}
                          </code>
                        </span>
                      ) : null}
                    </div>
                    {f.metadata?.purpose ? (
                      <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                        {f.metadata.purpose}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. Replay templates
// ---------------------------------------------------------------------------
function ReplayTemplatesSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="replay-templates-heading"
    >
      <h2 id="replay-templates-heading" className={sectionTitleClass}>
        Replay templates
      </h2>
      <p className={sectionSubtitleClass}>
        Per-capability blueprint of which stages and events a future replay
        engine may reconstruct from session telemetry. Replay is{" "}
        <strong>side-effect free</strong>: the actual executor side-effect
        is never replayed.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {EXECUTION_REPLAY_TEMPLATES.map((template) => {
          const scope = getExecutionReplayScope(template.replayScope);
          const cap = getCapabilityByKey(template.capabilityKey);
          const category = cap ? getCapabilityCategory(cap.category) : null;
          const replayable = template.replayStructure.replayable_stages ?? [];
          const events = template.replayStructure.reconstructable_events ?? [];
          const terminals = template.replayStructure.terminal_states ?? [];
          const reviews = template.replayStructure.review_states ?? [];
          const redacted = template.replayStructure.redacted_fields ?? [];
          return (
            <li
              key={template.replayKey}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
              style={{
                borderLeft: `4px solid ${category?.accent ?? "#0ea5e9"}`,
              }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
                  {template.replayKey}
                </code>
                <Pill className={scope.badgeClass} title={scope.description}>
                  {scope.label}
                </Pill>
              </div>
              <span className="text-xs font-semibold text-slate-800 sm:text-[0.8125rem]">
                {template.replayLabel}
              </span>
              <span className="text-xs text-slate-600 sm:text-[0.8125rem]">
                Capability:{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.75rem] text-slate-800">
                  {template.capabilityKey}
                </code>
              </span>
              <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                {template.description}
              </p>

              <div className="mt-1">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  Replayable stages ({replayable.length})
                </span>
                <ol className="mt-1.5 flex flex-wrap gap-1">
                  {replayable.map((stageKey, idx) => {
                    const stage = getPipelineStage(stageKey);
                    return (
                      <li key={`${template.replayKey}-rs-${stageKey}`}>
                        <span
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[0.7rem] text-slate-700"
                          title={stage?.stageLabel}
                        >
                          <span className="font-semibold">{idx + 1}.</span>
                          {stageKey}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="mt-1">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  Reconstructable events ({events.length})
                </span>
                <ul className="mt-1.5 flex flex-wrap gap-1">
                  {events.map((ev) => (
                    <li key={`${template.replayKey}-ev-${ev}`}>
                      <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-mono text-[0.7rem] text-indigo-900">
                        {ev}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-1 flex flex-wrap gap-2">
                <div className="min-w-[8rem]">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    Terminal states ({terminals.length})
                  </span>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {terminals.map((t) => (
                      <li key={`${template.replayKey}-t-${t}`}>
                        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[0.7rem] text-emerald-900">
                          {t}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                {reviews.length > 0 ? (
                  <div className="min-w-[8rem]">
                    <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                      Review states ({reviews.length})
                    </span>
                    <ul className="mt-1 flex flex-wrap gap-1">
                      {reviews.map((r) => (
                        <li key={`${template.replayKey}-r-${r}`}>
                          <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[0.7rem] text-amber-900">
                            {r}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {redacted.length > 0 ? (
                <div className="mt-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[0.7rem] leading-relaxed text-rose-900 sm:text-[0.75rem]">
                  <strong className="font-semibold">Redacted on replay:</strong>{" "}
                  {redacted.map((f, idx) => (
                    <span key={f}>
                      <code className="rounded bg-white/70 px-1 py-0.5 font-mono">
                        {f}
                      </code>
                      {idx < redacted.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </div>
              ) : null}

              <details className="mt-1">
                <summary className="cursor-pointer text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
                  Show raw replay_structure JSON
                </summary>
                <code className="mt-1.5 block overflow-x-auto whitespace-pre rounded-md bg-slate-900/95 px-2 py-2 font-mono text-[0.7rem] text-slate-100">
                  {JSON.stringify(template.replayStructure, null, 2)}
                </code>
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 5. Runtime telemetry flow
// ---------------------------------------------------------------------------
const TELEMETRY_FLOW_STEPS = [
  {
    key: "request_arrives",
    label: "Request arrives",
    description:
      "Phase 2D orchestrator opens a session row with execution_status=planned.",
    accent: "#0ea5e9",
  },
  {
    key: "session_started",
    label: "Session started",
    description:
      "Status flips to started; per-stage timers begin emitting latency metrics.",
    accent: "#2563eb",
  },
  {
    key: "stage_telemetry",
    label: "Stage telemetry",
    description:
      "Each pipeline stage emits its category metrics (policy / fraud / dependency / audit / execution / environment).",
    accent: "#7c3aed",
  },
  {
    key: "decision_emitted",
    label: "Decision emitted",
    description:
      "On any non-allowed decision the orchestrator writes a failure row and (if non-terminal) flips status to review_required.",
    accent: "#f97316",
  },
  {
    key: "session_terminal",
    label: "Session terminal",
    description:
      "Terminal verdict (execution_authorized / execution_blocked / blocked) flips status to completed / blocked / failed; completed_at is stamped.",
    accent: "#16a34a",
  },
  {
    key: "replay_available",
    label: "Replay available",
    description:
      "Once completed, the matching replay template can reconstruct every replayable stage. Executor side-effects are never replayed.",
    accent: "#475569",
  },
];

function TelemetryFlowSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="telemetry-flow-heading"
    >
      <h2 id="telemetry-flow-heading" className={sectionTitleClass}>
        Runtime telemetry flow
      </h2>
      <p className={sectionSubtitleClass}>
        How a single request becomes a session, metrics, failures, and
        eventually a replayable trace. Phase 2E describes this flow; no
        code path implements it yet.
      </p>
      <ol
        aria-label="Runtime telemetry flow"
        className="mt-4 flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto pb-2 sm:gap-3"
      >
        {TELEMETRY_FLOW_STEPS.map((step, idx) => {
          const isLast = idx === TELEMETRY_FLOW_STEPS.length - 1;
          return (
            <li
              key={step.key}
              className="flex shrink-0 snap-start items-stretch"
            >
              <div
                className="flex w-48 flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/80 p-3 sm:w-52"
                style={{ borderLeft: `4px solid ${step.accent}` }}
              >
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  Step {idx + 1}
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {step.label}
                </span>
                <span className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                  {step.description}
                </span>
              </div>
              {!isLast ? (
                <span
                  aria-hidden
                  className="self-center px-1 text-slate-400 sm:px-1.5"
                >
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-slate-900 sm:text-base">
          Demo session — telemetry inventory
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
          The Phase 2E seeds attach the canonical metric and failure catalogs
          to{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
            sess_2e_payment_create_demo
          </code>{" "}
          so the inventory shape is queryable today.
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {EXECUTION_SESSION_SEEDS.map((session) => {
            const metrics = getMetricsForSession(session.executionSessionId);
            const failures = getFailuresForSession(
              session.executionSessionId,
            );
            return (
              <li
                key={`${session.executionSessionId}-inventory`}
                className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white/80 p-3"
              >
                <code className="font-mono text-[0.75rem] font-semibold text-slate-900">
                  {session.executionSessionId}
                </code>
                <span className="text-xs text-slate-600 sm:text-[0.8125rem]">
                  Metrics seeded:{" "}
                  <strong className="font-semibold text-slate-800">
                    {metrics.length}
                  </strong>
                </span>
                <span className="text-xs text-slate-600 sm:text-[0.8125rem]">
                  Failures seeded:{" "}
                  <strong className="font-semibold text-slate-800">
                    {failures.length}
                  </strong>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 6. Observability dashboards preview
// ---------------------------------------------------------------------------
function DashboardsPreviewSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="dashboards-preview-heading"
    >
      <h2
        id="dashboards-preview-heading"
        className={sectionTitleClass}
      >
        Observability dashboards preview
      </h2>
      <p className={sectionSubtitleClass}>
        The operational dashboards Phase 2E plans to surface once a real
        telemetry pipeline ships. Each card describes the dashboard's intent
        and data source — the dashboards themselves are{" "}
        <strong>not built yet</strong>.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {OBSERVABILITY_DASHBOARD_PREVIEWS.map((d) => (
          <li
            key={d.key}
            className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/80 p-3"
            style={{ borderLeft: `4px solid ${d.accent}` }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span aria-hidden className="text-base leading-none">
                  {d.icon}
                </span>
                <span className="font-semibold text-slate-900">{d.label}</span>
              </div>
              <Pill className="border border-amber-200 bg-amber-50 text-amber-900">
                Planned
              </Pill>
            </div>
            <code className="font-mono text-[0.7rem] text-slate-600">
              {d.key}
            </code>
            <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
              {d.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 7. Environment telemetry behavior
// ---------------------------------------------------------------------------
function EnvironmentTelemetrySection() {
  const sandboxSessions = EXECUTION_SESSION_SEEDS.filter(
    (s) => s.environment === "sandbox",
  ).length;
  const liveSessions = EXECUTION_SESSION_SEEDS.filter(
    (s) => s.environment === "live",
  ).length;
  const blockingStages = EXECUTION_PIPELINE_STAGES.filter(
    (s) => s.blockingByDefault,
  ).length;

  return (
    <section
      className={sectionCardClass}
      aria-labelledby="environment-telemetry-heading"
    >
      <h2
        id="environment-telemetry-heading"
        className={sectionTitleClass}
      >
        Environment telemetry behavior
      </h2>
      <p className={sectionSubtitleClass}>
        Sandbox and live telemetry are two independent series. Phase 2E
        seeds only sandbox demo sessions; live telemetry shape is identical
        but isolation is enforced at storage and at the (future) query layer.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <li className="flex flex-col gap-1 rounded-xl border border-sky-200 bg-sky-50 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-sky-900">Sandbox</span>
            <span className="font-mono text-base font-bold text-sky-900">
              {sandboxSessions}{" "}
              {sandboxSessions === 1 ? "demo session" : "demo sessions"}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-sky-900 sm:text-[0.8125rem]">
            Sandbox is the only environment with seeded sessions in Phase 2E.
            All {blockingStages} blocking pipeline stages are observable here
            without moving real money.
          </p>
        </li>
        <li className="flex flex-col gap-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-emerald-900">
              Live
            </span>
            <span className="font-mono text-base font-bold text-emerald-900">
              {liveSessions}{" "}
              {liveSessions === 1 ? "demo session" : "demo sessions"}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-emerald-900 sm:text-[0.8125rem]">
            Phase 2E seeds zero live sessions. Live telemetry requires the
            same governance promotions as Phase 2D trace templates plus a
            real telemetry pipeline.
          </p>
        </li>
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Legends
// ---------------------------------------------------------------------------
function LegendBlock({ heading, items }) {
  const headingId = `legend-${slug(heading)}-heading`;
  return (
    <section className={sectionCardClass} aria-labelledby={headingId}>
      <h2 id={headingId} className={sectionTitleClass}>
        {heading}
      </h2>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
          >
            <span
              className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${item.badgeClass}`}
            >
              {item.dotClass ? (
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${item.dotClass}`}
                  aria-hidden
                />
              ) : null}
              {item.label}
            </span>
            <p className="text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
              {item.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 8. Safety rules
// ---------------------------------------------------------------------------
function SafetyRulesSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="observability-safety-rules-heading"
    >
      <h2
        id="observability-safety-rules-heading"
        className={sectionTitleClass}
      >
        Observability safety rules
      </h2>
      <p className={sectionSubtitleClass}>
        Phase 2E rules — narrow the existing Phase 1.75 platform safety
        rules into observability-level checks. Phase 2E describes the
        telemetry; it does not implement it.
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        {OBSERVABILITY_SAFETY_RULES.map((rule, idx) => (
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
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ObservabilityPage() {
  return (
    <DevConsoleLayout
      title="Observability & Runtime Telemetry"
      subtitle="The execution telemetry, replay, metric, and failure architecture every future money-moving request will produce. Phase 2E defines the shape of sessions, metrics, failures, and replay templates — no telemetry pipeline exists yet."
    >
      <div className={planningBannerClass}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"
          aria-hidden
        >
          📡
        </span>
        <div className="min-w-0">
          <strong className="block font-semibold text-amber-900">
            Planning only — no telemetry engine.
          </strong>
          <span className="block">
            Phase{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {INTERNAL_OBSERVABILITY_PHASE}
            </code>
            . Schema lives in{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              supabase/sql/internal_observability_phase2e.sql
            </code>
            . {EXECUTION_SESSION_SEEDS.length} demo sessions,{" "}
            {EXECUTION_METRIC_SEEDS.length} canonical metrics,{" "}
            {EXECUTION_FAILURE_SEEDS.length} failure modes, and{" "}
            {EXECUTION_REPLAY_TEMPLATES.length} replay templates seeded. No
            emitter, no monitoring daemon, no money movement.
          </span>
        </div>
      </div>

      <ExecutionSessionsSection />

      <MetricsSection />

      <FailureTaxonomySection />

      <ReplayTemplatesSection />

      <TelemetryFlowSection />

      <DashboardsPreviewSection />

      <EnvironmentTelemetrySection />

      <LegendBlock
        heading="Failure category legend"
        items={EXECUTION_FAILURE_CATEGORIES.map((c) => ({
          key: c.key,
          label: c.label,
          description: c.description,
          badgeClass: c.badgeClass,
        }))}
      />

      <LegendBlock
        heading="Failure severity legend"
        items={EXECUTION_FAILURE_SEVERITIES}
      />

      <LegendBlock
        heading="Metric category legend"
        items={EXECUTION_METRIC_CATEGORIES.map((c) => ({
          key: c.key,
          label: c.label,
          description: c.description,
          badgeClass: c.badgeClass,
        }))}
      />

      <LegendBlock
        heading="Replay scope legend"
        items={EXECUTION_REPLAY_SCOPES}
      />

      <SafetyRulesSection />

      <section
        className={sectionCardClass}
        aria-labelledby="runtime-state-promo-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-xl"
          >
            🧾
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="runtime-state-promo-heading"
              className={sectionTitleClass}
            >
              Runtime State &amp; Event Store
            </h2>
            <p className={sectionSubtitleClass}>
              Phase 2F defines the immutable event store, derived
              snapshots, per-trace checkpoints, and cross-service
              correlation links that the future executor will produce.
              Observability sessions and metrics roll up from those event
              rows.
            </p>
            <Link
              href="/dev-console/runtime-state"
              className="mt-3 inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Open Runtime State &amp; Event Store →
            </Link>
          </div>
        </div>
      </section>

      <section
        className={sectionCardClass}
        aria-labelledby="observability-cross-refs-heading"
      >
        <h2
          id="observability-cross-refs-heading"
          className={sectionTitleClass}
        >
          Related views
        </h2>
        <p className={sectionSubtitleClass}>
          Observability composes with every prior phase: services (2A),
          governance (2B), capabilities (2C), orchestration (2D), and
          runtime state (2F). The Phase 3A simulator renders the kind of
          telemetry these tables will eventually capture.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm font-semibold sm:text-[0.9375rem]">
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
              href="/dev-console/internal-services"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Internal Service Registry →
            </Link>
          </li>
          <li>
            <Link
              href="/dev-console/internal-governance"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Integration Governance →
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
              href="/dev-console/orchestration"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Execution Orchestration →
            </Link>
          </li>
          <li>
            <Link
              href="/dev-console/runtime-state"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Runtime State &amp; Event Store →
            </Link>
          </li>
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
        </ul>
      </section>
    </DevConsoleLayout>
  );
}
