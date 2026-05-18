import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  INTERNAL_EXECUTION_PHASE,
  EXECUTION_PIPELINE_STAGES,
  EXECUTION_STAGE_TYPES,
  POLICY_EVALUATION_RULES,
  POLICY_EVALUATION_TYPES,
  POLICY_SEVERITY_LEVELS,
  POLICY_FAILURE_DECISIONS,
  RUNTIME_DECISION_TYPES,
  RUNTIME_DECISION_CATEGORIES,
  EXECUTION_TRACE_TEMPLATES,
  EXECUTION_ORCHESTRATION_SAFETY_RULES,
  getPipelineStage,
  getExecutionStageType,
  getPolicyEvaluationType,
  getPolicySeverity,
  getPolicyFailureDecision,
} from "../../lib/internalExecutionOrchestrationConfig";
import {
  getCapabilityByKey,
  getCapabilityCategory,
  getCapabilityRiskLevel,
  getCapabilityDependencies,
  getCapabilityConstraints,
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

// ---------------------------------------------------------------------------
// 1. Pipeline stage flow
// ---------------------------------------------------------------------------
function PipelineFlowSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="pipeline-flow-heading"
    >
      <h2 id="pipeline-flow-heading" className={sectionTitleClass}>
        Pipeline stage flow
      </h2>
      <p className={sectionSubtitleClass}>
        The canonical 13-stage pipeline every future money-moving request
        will pass through. Stages marked{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          blocking_by_default
        </code>{" "}
        halt the pipeline on failure. Stages without that flag are passive
        recording / verdict surfaces.
      </p>
      <ol
        aria-label="Execution pipeline stages"
        className="mt-4 flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto pb-2 sm:gap-3"
      >
        {EXECUTION_PIPELINE_STAGES.map((stage, idx) => {
          const isLast = idx === EXECUTION_PIPELINE_STAGES.length - 1;
          const stageType = getExecutionStageType(stage.stageType);
          return (
            <li
              key={stage.stageKey}
              className="flex shrink-0 snap-start items-stretch"
            >
              <div
                className={`flex w-48 flex-col gap-1.5 rounded-xl border bg-white/80 p-3 sm:w-56 ${
                  stage.blockingByDefault
                    ? "border-rose-200"
                    : "border-slate-200"
                }`}
                style={{
                  borderLeft: `4px solid ${stageType?.accent ?? "#0ea5e9"}`,
                }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    Step {stage.executionOrder}
                  </span>
                  {stage.blockingByDefault ? (
                    <Pill className="border border-rose-200 bg-rose-50 text-rose-900">
                      Blocking
                    </Pill>
                  ) : (
                    <Pill className="border border-slate-200 bg-slate-50 text-slate-600">
                      Passive
                    </Pill>
                  )}
                </div>
                <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
                  {stage.stageKey}
                </code>
                <span className="text-xs font-semibold text-slate-800">
                  {stage.stageLabel}
                </span>
                {stageType ? (
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    {stageType.label}
                  </span>
                ) : null}
                <span className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                  {stage.description}
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
          Stage types
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXECUTION_STAGE_TYPES.map((t) => (
            <li
              key={t.key}
              className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white/80 p-3"
              style={{ borderLeft: `4px solid ${t.accent}` }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold text-slate-900">{t.label}</span>
                <code className="font-mono text-[0.7rem] text-slate-600">
                  {t.key}
                </code>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                {t.description}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Policy evaluation rules
// ---------------------------------------------------------------------------
function PolicyRulesSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="policy-rules-heading"
    >
      <h2 id="policy-rules-heading" className={sectionTitleClass}>
        Policy evaluation rules
      </h2>
      <p className={sectionSubtitleClass}>
        Reusable rule definitions evaluated at{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          policy_evaluated
        </code>{" "}
        and{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          constraint_evaluated
        </code>
        . Phase 2D defines the vocabulary; the evaluator itself ships in a
        later phase.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {POLICY_EVALUATION_RULES.map((rule) => {
          const evalType = getPolicyEvaluationType(rule.evaluationType);
          const severity = getPolicySeverity(rule.severity);
          const decision = getPolicyFailureDecision(rule.decisionIfFailed);
          return (
            <li
              key={rule.ruleKey}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
                  {rule.ruleKey}
                </code>
                <Pill className={evalType.badgeClass} title={evalType.description}>
                  {evalType.label}
                </Pill>
              </div>
              <span className="text-xs font-semibold text-slate-800 sm:text-[0.8125rem]">
                {rule.ruleLabel}
              </span>
              <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                {rule.description}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill className={severity.badgeClass} title={severity.description}>
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${severity.dotClass}`}
                    aria-hidden
                  />
                  Severity: {severity.label}
                </Pill>
                <Pill
                  className={decision.badgeClass}
                  title={decision.description}
                >
                  On fail → {decision.label}
                </Pill>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. Runtime decision outcomes
// ---------------------------------------------------------------------------
function RuntimeDecisionsSection() {
  const grouped = RUNTIME_DECISION_CATEGORIES.map((cat) => ({
    category: cat,
    decisions: RUNTIME_DECISION_TYPES.filter(
      (d) => d.decisionCategory === cat.key,
    ),
  })).filter((g) => g.decisions.length > 0);

  return (
    <section
      className={sectionCardClass}
      aria-labelledby="runtime-decisions-heading"
    >
      <h2 id="runtime-decisions-heading" className={sectionTitleClass}>
        Runtime decision outcomes
      </h2>
      <p className={sectionSubtitleClass}>
        Every verdict a future evaluator may emit. Terminal verdicts end the
        pipeline; non-terminal verdicts feed back into a later stage. Only{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          execution_authorized
        </code>
        ,{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          execution_blocked
        </code>
        , and{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          blocked
        </code>{" "}
        are terminal in Phase 2D.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {grouped.map(({ category, decisions }) => (
          <div
            key={category.key}
            className="rounded-xl border border-slate-200 bg-white/80 p-3"
            style={{ borderLeft: `4px solid ${category.accent}` }}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="flex items-center gap-2">
                <Pill className={category.badgeClass} title={category.description}>
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${category.dotClass}`}
                    aria-hidden
                  />
                  {category.label}
                </Pill>
                <code className="font-mono text-[0.7rem] text-slate-600">
                  {category.key}
                </code>
              </div>
              <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                {decisions.length}{" "}
                {decisions.length === 1 ? "decision" : "decisions"}
              </span>
            </div>
            <ul className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
              {decisions.map((d) => (
                <li
                  key={d.decisionKey}
                  className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60 p-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <code className="font-mono text-[0.75rem] font-semibold text-slate-900">
                      {d.decisionKey}
                    </code>
                    {d.isTerminal ? (
                      <Pill className="border border-rose-200 bg-rose-50 text-rose-900">
                        Terminal
                      </Pill>
                    ) : (
                      <Pill className="border border-slate-200 bg-slate-50 text-slate-600">
                        Non-terminal
                      </Pill>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-slate-800 sm:text-[0.8125rem]">
                    {d.decisionLabel}
                  </span>
                  <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                    {d.description}
                  </p>
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
// 4. Execution trace templates
// ---------------------------------------------------------------------------
function TraceTemplatesSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="trace-templates-heading"
    >
      <h2 id="trace-templates-heading" className={sectionTitleClass}>
        Execution trace templates
      </h2>
      <p className={sectionSubtitleClass}>
        Per-capability blueprint of pipeline stages, decision points, and
        terminal states. Every template is{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          environment=sandbox
        </code>{" "}
        in Phase 2D — live templates are deliberately deferred.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {EXECUTION_TRACE_TEMPLATES.map((template) => {
          const pipelineSet = new Set(template.traceStructure.pipeline);
          const decisionSet = new Set(template.traceStructure.decision_points);
          const terminalSet = new Set(template.traceStructure.terminal_states);
          return (
            <li
              key={template.templateKey}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
                  {template.templateKey}
                </code>
                <EnvironmentChip environment={template.environment} />
              </div>
              <span className="text-xs font-semibold text-slate-800 sm:text-[0.8125rem]">
                {template.templateLabel}
              </span>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 sm:text-[0.8125rem]">
                <span>
                  Capability:{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.75rem] text-slate-800">
                    {template.capabilityKey}
                  </code>
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                {template.description}
              </p>
              <div className="mt-1">
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  Pipeline ({template.traceStructure.pipeline.length} stages)
                </span>
                <ol className="mt-1.5 flex flex-wrap gap-1">
                  {template.traceStructure.pipeline.map((stageKey, idx) => {
                    const isDecision = decisionSet.has(stageKey);
                    const isTerminal = terminalSet.has(stageKey);
                    return (
                      <li key={`${template.templateKey}-${stageKey}`}>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[0.7rem] ${
                            isTerminal
                              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                              : isDecision
                                ? "border-orange-200 bg-orange-50 text-orange-900"
                                : "border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                          title={
                            isTerminal
                              ? "Terminal state"
                              : isDecision
                                ? "Decision point"
                                : "Pass-through stage"
                          }
                        >
                          <span className="font-semibold">{idx + 1}.</span>
                          {stageKey}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-[0.7rem] text-slate-600">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-orange-300" aria-hidden />
                  Decision point ({decisionSet.size})
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400" aria-hidden />
                  Terminal state ({terminalSet.size})
                </span>
                {template.traceStructure.review_states ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-amber-400" aria-hidden />
                    Review states ({template.traceStructure.review_states.length})
                  </span>
                ) : null}
              </div>
              {template.traceStructure.notes ? (
                <p className="mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[0.7rem] leading-relaxed text-amber-950 sm:text-[0.75rem]">
                  <strong className="font-semibold">Notes:</strong>{" "}
                  {template.traceStructure.notes}
                </p>
              ) : null}
              {/* Show the raw JSON for the trace_structure to reinforce that the UI is config-driven. */}
              <details className="mt-1">
                <summary className="cursor-pointer text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
                  Show raw trace_structure JSON
                </summary>
                <code className="mt-1.5 block overflow-x-auto whitespace-pre rounded-md bg-slate-900/95 px-2 py-2 font-mono text-[0.7rem] text-slate-100">
                  {JSON.stringify(template.traceStructure, null, 2)}
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
// 5. Capability orchestration examples
// ---------------------------------------------------------------------------
function CapabilityOrchestrationSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="capability-orchestration-heading"
    >
      <h2
        id="capability-orchestration-heading"
        className={sectionTitleClass}
      >
        Capability orchestration examples
      </h2>
      <p className={sectionSubtitleClass}>
        How Phase 2D composes with the Phase 2C capability registry. Each
        example pulls the live capability definition, its declared
        dependencies, and its operational constraints, then maps them to the
        Phase 2D trace template.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {EXECUTION_TRACE_TEMPLATES.map((template) => {
          const cap = getCapabilityByKey(template.capabilityKey);
          if (!cap) return null;
          const category = getCapabilityCategory(cap.category);
          const risk = getCapabilityRiskLevel(cap.riskLevel);
          const deps = getCapabilityDependencies(cap.capabilityKey);
          const constraints = getCapabilityConstraints(
            cap.capabilityKey,
            template.environment,
          );
          return (
            <article
              key={`${template.templateKey}-orch`}
              className="rounded-xl border border-slate-200 bg-white/80 p-3"
              style={{
                borderLeft: `4px solid ${category?.accent ?? "#0ea5e9"}`,
              }}
              aria-labelledby={`orch-${slug(template.templateKey)}-heading`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  {category ? (
                    <span aria-hidden className="text-lg leading-none">
                      {category.icon}
                    </span>
                  ) : null}
                  <code
                    id={`orch-${slug(template.templateKey)}-heading`}
                    className="font-mono text-[0.8125rem] font-semibold text-slate-900"
                  >
                    {cap.capabilityKey}
                  </code>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <EnvironmentChip environment={template.environment} />
                  <Pill className={risk.badgeClass} title={risk.description}>
                    <span
                      className={`inline-block h-1.5 w-1.5 rounded-full ${risk.dotClass}`}
                      aria-hidden
                    />
                    Risk: {risk.label}
                  </Pill>
                </div>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                {cap.description}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    Phase 2C dependencies ({deps.length})
                  </span>
                  {deps.length === 0 ? (
                    <p className="mt-1 text-xs italic text-slate-500 sm:text-[0.8125rem]">
                      None declared.
                    </p>
                  ) : (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {deps.map((d) => (
                        <li
                          key={`${cap.capabilityKey}-${d.dependencyKey}-${d.dependencyType}`}
                          className="flex flex-wrap items-center gap-1.5"
                        >
                          <Pill className="border border-slate-200 bg-white/80 text-slate-700">
                            {d.dependencyType}
                          </Pill>
                          <code className="font-mono text-[0.7rem] text-slate-800">
                            {d.dependencyKey}
                          </code>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    Phase 2C constraints ({constraints.length})
                  </span>
                  {constraints.length === 0 ? (
                    <p className="mt-1 text-xs italic text-slate-500 sm:text-[0.8125rem]">
                      None for this environment.
                    </p>
                  ) : (
                    <ul className="mt-1.5 flex flex-col gap-1">
                      {constraints.map((c) => (
                        <li
                          key={`${cap.capabilityKey}-${c.constraintKey}-${c.environment}`}
                          className="flex flex-wrap items-center gap-1.5"
                        >
                          <code className="font-mono text-[0.7rem] text-slate-800">
                            {c.constraintKey}
                          </code>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    Phase 2D decision points (
                    {template.traceStructure.decision_points.length})
                  </span>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {template.traceStructure.decision_points.map((stageKey) => {
                      const stage = getPipelineStage(stageKey);
                      return (
                        <li
                          key={`${template.templateKey}-dp-${stageKey}`}
                          className="flex flex-wrap items-center gap-1.5"
                        >
                          <Pill className="border border-orange-200 bg-orange-50 text-orange-900">
                            Step {stage?.executionOrder ?? "?"}
                          </Pill>
                          <code className="font-mono text-[0.7rem] text-slate-800">
                            {stageKey}
                          </code>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
              <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-500 sm:text-[0.75rem]">
                Trace template:{" "}
                <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.7rem] text-slate-800">
                  {template.templateKey}
                </code>
                . See the registry on{" "}
                <Link
                  href="/dev-console/capabilities"
                  className="font-semibold text-blue-700 hover:underline"
                >
                  Capability Registry
                </Link>{" "}
                for the canonical capability definition.
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 6. Environment behavior
// ---------------------------------------------------------------------------
function EnvironmentBehaviorSection() {
  const sandboxTemplates = EXECUTION_TRACE_TEMPLATES.filter(
    (t) => t.environment === "sandbox",
  ).length;
  const liveTemplates = EXECUTION_TRACE_TEMPLATES.filter(
    (t) => t.environment === "live",
  ).length;

  return (
    <section
      className={sectionCardClass}
      aria-labelledby="environment-behavior-heading"
    >
      <h2 id="environment-behavior-heading" className={sectionTitleClass}>
        Environment behavior
      </h2>
      <p className={sectionSubtitleClass}>
        Phase 2D treats sandbox and live as two independent runtime
        environments. Trace templates are environment-scoped so a sandbox
        promotion never silently promotes live.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <li className="flex flex-col gap-1 rounded-xl border border-sky-200 bg-sky-50 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-sky-900">Sandbox</span>
            <span className="font-mono text-base font-bold text-sky-900">
              {sandboxTemplates}{" "}
              {sandboxTemplates === 1 ? "template" : "templates"}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-sky-900 sm:text-[0.8125rem]">
            Sandbox is the only environment with seeded trace templates in
            Phase 2D. Every template runs the full 13-stage pipeline; no real
            money moves.
          </p>
        </li>
        <li className="flex flex-col gap-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-emerald-900">
              Live
            </span>
            <span className="font-mono text-base font-bold text-emerald-900">
              {liveTemplates}{" "}
              {liveTemplates === 1 ? "template" : "templates"}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-emerald-900 sm:text-[0.8125rem]">
            Phase 2D seeds zero live templates. Live trace templates require
            Phase 2B governance promotion, Phase 2C{" "}
            <code className="rounded bg-emerald-100 px-1 py-0.5 font-mono text-[0.7rem] text-emerald-900">
              supports_live
            </code>{" "}
            flip, and a real enforcement code path.
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
// 7. Safety rules
// ---------------------------------------------------------------------------
function SafetyRulesSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="orchestration-safety-rules-heading"
    >
      <h2
        id="orchestration-safety-rules-heading"
        className={sectionTitleClass}
      >
        Orchestration safety rules
      </h2>
      <p className={sectionSubtitleClass}>
        Phase 2D rules — narrow the existing Phase 1.75 platform safety rules
        into orchestration-level checks. Phase 2D defines the pipeline; it
        does not implement it.
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        {EXECUTION_ORCHESTRATION_SAFETY_RULES.map((rule, idx) => (
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
export default function OrchestrationPage() {
  const totalStages = EXECUTION_PIPELINE_STAGES.length;
  const blockingStages = EXECUTION_PIPELINE_STAGES.filter(
    (s) => s.blockingByDefault,
  ).length;
  const terminalDecisions = RUNTIME_DECISION_TYPES.filter(
    (d) => d.isTerminal,
  ).length;

  return (
    <DevConsoleLayout
      title="Execution Orchestration"
      subtitle="The runtime orchestration architecture every future money-moving request will pass through. Phase 2D defines the pipeline, policy vocabulary, runtime decisions, and per-capability trace templates — no executor exists yet."
    >
      <div className={planningBannerClass}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"
          aria-hidden
        >
          🧠
        </span>
        <div className="min-w-0">
          <strong className="block font-semibold text-amber-900">
            Planning only — no execution engine.
          </strong>
          <span className="block">
            Phase{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {INTERNAL_EXECUTION_PHASE}
            </code>
            . Schema lives in{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              supabase/sql/internal_execution_orchestration_phase2d.sql
            </code>
            .{" "}
            {totalStages} pipeline stages defined ({blockingStages} blocking),{" "}
            {POLICY_EVALUATION_RULES.length} policy rules, {RUNTIME_DECISION_TYPES.length}{" "}
            runtime decisions ({terminalDecisions} terminal),{" "}
            {EXECUTION_TRACE_TEMPLATES.length} sandbox trace templates. No
            evaluator, no APIs, no money movement.
          </span>
          <span className="mt-2 block text-slate-700">
            <strong className="font-semibold text-amber-950">Phase 5D — Execution routing (simulation).</strong> After the
            gateway narrates acceptance, the Developer Console&apos;s{" "}
            <Link href="/dev-console/execution-routing" className="font-semibold text-amber-900 underline">
              Execution Routing
            </Link>{" "}
            choreographs sandbox delegate targets, dependency vocabulary, reconciliation posture, and handoffs to Phase 3A/3B
            previews — modeling only (no workloads, routers, or queue workers).
          </span>
        </div>
      </div>

      <PipelineFlowSection />

      <PolicyRulesSection />

      <RuntimeDecisionsSection />

      <TraceTemplatesSection />

      <CapabilityOrchestrationSection />

      <EnvironmentBehaviorSection />

      <LegendBlock
        heading="Policy evaluation type legend"
        items={POLICY_EVALUATION_TYPES}
      />

      <LegendBlock
        heading="Policy severity legend"
        items={POLICY_SEVERITY_LEVELS}
      />

      <LegendBlock
        heading="Policy failure decision legend"
        items={POLICY_FAILURE_DECISIONS}
      />

      <LegendBlock
        heading="Runtime decision category legend"
        items={RUNTIME_DECISION_CATEGORIES}
      />

      <SafetyRulesSection />

      <section
        className={sectionCardClass}
        aria-labelledby="observability-promo-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-xl"
          >
            📡
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="observability-promo-heading"
              className={sectionTitleClass}
            >
              Observability & Runtime Telemetry
            </h2>
            <p className={sectionSubtitleClass}>
              Phase 2E defines execution telemetry, replay templates, metric
              aggregation, and runtime diagnostics planning. The orchestrator
              produces the events; the observability layer turns them into
              sessions, metrics, failures, and replayable traces.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-[0.8125rem]">
              Runtime state and event-store reconstruction are modeled
              separately in Phase 2F — see{" "}
              <Link
                href="/dev-console/runtime-state"
                className="font-semibold text-blue-700 hover:underline"
              >
                Runtime State &amp; Event Store
              </Link>
              .
            </p>
            <Link
              href="/dev-console/observability"
              className="mt-3 inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Open Observability & Runtime Telemetry →
            </Link>
          </div>
        </div>
      </section>

      <section
        className={sectionCardClass}
        aria-labelledby="orchestration-cross-refs-heading"
      >
        <h2
          id="orchestration-cross-refs-heading"
          className={sectionTitleClass}
        >
          Related views
        </h2>
        <p className={sectionSubtitleClass}>
          Orchestration composes with every prior phase: services (2A),
          governance (2B), and capabilities (2C); and feeds Phase 2E
          observability and Phase 2F runtime state. The Phase 3A simulator
          visualizes how a request would walk this pipeline. The blueprint
          narrates everything end-to-end.
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
              href="/dev-console/observability"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Observability & Runtime Telemetry →
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
              href="/dev-console/gateway-simulator"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Gateway Simulator (Phase 5C) →
            </Link>
          </li>
          <li>
            <Link
              href="/dev-console/auth-simulator"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Auth Simulator (Phase 5B) →
            </Link>
          </li>
          <li>
            <Link
              href="/dev-console/execution-routing"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Execution Routing (Phase 5D) →
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
