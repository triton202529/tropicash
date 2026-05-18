import { useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { API_ENVIRONMENTS } from "../../lib/developerCenterConfig";
import {
  EXECUTION_SCENARIO_PHASE,
  EXECUTION_SCENARIOS,
  EXECUTION_FINAL_STATES,
  EXECUTION_TIMELINE_STATES,
  EXECUTION_SIMULATION_SAFETY_RULES,
  buildScenarioSimulation,
  getMockObservabilityForScenario,
  getScenarioByKey,
  getScenarioCategory,
  getFinalState,
  getTimelineState,
} from "../../lib/executionScenarioConfig";

// ---------------------------------------------------------------------------
// Styling primitives (mirrors orchestration / observability / runtime-state)
// ---------------------------------------------------------------------------
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

function TimelineStateBadge({ stateKey }) {
  const s = getTimelineState(stateKey);
  return (
    <Pill className={s.badgeClass} title={s.description}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dotClass}`} aria-hidden />
      {s.label}
    </Pill>
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

const KNOWN_CORRELATION_LABELS = {
  tropicash: "Tropicash",
  triton: "Triton",
  sentinel: "Sentinel",
  elitehire_pro: "EliteHire Pro",
};

const CHECKPOINT_HEALTH_BADGES = {
  healthy: { label: "Healthy", className: "border border-emerald-200 bg-emerald-50 text-emerald-800", dotClass: "bg-emerald-500" },
  stale: { label: "Stale", className: "border border-sky-200 bg-sky-50 text-sky-800", dotClass: "bg-sky-500" },
  rebuilding: { label: "Rebuilding", className: "border border-amber-200 bg-amber-50 text-amber-900", dotClass: "bg-amber-500" },
  needs_attention: { label: "Needs attention", className: "border border-rose-200 bg-rose-50 text-rose-800", dotClass: "bg-rose-500" },
  archived: { label: "Archived", className: "border border-slate-200 bg-slate-100 text-slate-700", dotClass: "bg-slate-500" },
  unknown: { label: "Unknown", className: "border border-slate-200 bg-slate-50 text-slate-600", dotClass: "bg-slate-400" },
};

function CheckpointHealthBadge({ healthKey }) {
  const h = CHECKPOINT_HEALTH_BADGES[healthKey] ?? CHECKPOINT_HEALTH_BADGES.unknown;
  return (
    <Pill className={h.className}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${h.dotClass}`} aria-hidden />
      {h.label}
    </Pill>
  );
}

const CHECKPOINT_STATUS_BADGES = {
  current: { label: "current", className: "border border-emerald-200 bg-emerald-50 text-emerald-800", dotClass: "bg-emerald-500" },
  stale: { label: "stale", className: "border border-sky-200 bg-sky-50 text-sky-800", dotClass: "bg-sky-500" },
  rebuilding: { label: "rebuilding", className: "border border-amber-200 bg-amber-50 text-amber-900", dotClass: "bg-amber-500" },
  failed: { label: "failed", className: "border border-rose-200 bg-rose-50 text-rose-800", dotClass: "bg-rose-500" },
  archived: { label: "archived", className: "border border-slate-200 bg-slate-100 text-slate-700", dotClass: "bg-slate-500" },
};

function CheckpointStatusBadge({ statusKey }) {
  const s = CHECKPOINT_STATUS_BADGES[statusKey] ?? CHECKPOINT_STATUS_BADGES.current;
  return (
    <Pill className={s.className}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dotClass}`} aria-hidden />
      {s.label}
    </Pill>
  );
}

const EVENT_FAMILY_BADGES = {
  execution: "border border-blue-200 bg-blue-50 text-blue-800",
  money_movement: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  fraud: "border border-rose-200 bg-rose-50 text-rose-800",
  integration: "border border-teal-200 bg-teal-50 text-teal-800",
};

function EventFamilyBadge({ family }) {
  const className =
    EVENT_FAMILY_BADGES[family] ?? "border border-slate-200 bg-slate-50 text-slate-700";
  return <Pill className={className}>{family}</Pill>;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
function ScenarioOptionGroup() {
  // Group scenarios by category for the <select>. Keeps the dropdown
  // organized as scenarios grow.
  const grouped = useMemo(() => {
    const out = {};
    EXECUTION_SCENARIOS.forEach((s) => {
      if (!out[s.category]) out[s.category] = [];
      out[s.category].push(s);
    });
    return out;
  }, []);
  return Object.entries(grouped).map(([categoryKey, scenarios]) => {
    const c = getScenarioCategory(categoryKey);
    return (
      <optgroup key={categoryKey} label={c.label}>
        {scenarios.map((s) => (
          <option key={s.scenario_key} value={s.scenario_key}>
            {s.title}
          </option>
        ))}
      </optgroup>
    );
  });
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------
function ExecutionSummaryCard({ simulation, environment }) {
  const { scenario, trace } = simulation;
  return (
    <section className={sectionCardClass} aria-labelledby="exec-summary-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="exec-summary-heading" className={sectionTitleClass}>
            Execution summary
          </h2>
          <p className={sectionSubtitleClass}>
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.75rem] text-slate-800">
              {scenario.scenario_key}
            </code>{" "}
            — {scenario.description}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <CategoryBadge categoryKey={scenario.category} />
          <EnvironmentChip environment={environment} />
          <FinalStateBadge stateKey={scenario.final_state} />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat
          label="Final state"
          value={getFinalState(scenario.final_state).label}
        />
        <SummaryStat
          label="Review required"
          value={scenario.requires_review ? "Yes" : "No"}
        />
        <SummaryStat
          label="Duration"
          value={`${scenario.execution_duration_ms} ms`}
        />
        <SummaryStat
          label="Events emitted"
          value={`${trace.sequence_count}`}
        />
        <SummaryStat
          label="Trace id"
          mono
          value={trace.trace_id}
        />
        <SummaryStat
          label="Session id"
          mono
          value={trace.execution_session_id}
        />
        <SummaryStat
          label="Started"
          mono
          value={trace.started_at}
        />
        <SummaryStat
          label="Completed"
          mono
          value={trace.completed_at}
        />
      </dl>

      {scenario.orchestration_stages.length > 0 ? (
        <div className="mt-5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
            Orchestration stages touched
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {scenario.orchestration_stages.map((stage) => (
              <li key={stage}>
                <Pill className="border border-slate-200 bg-slate-50 text-slate-700">
                  {stage}
                </Pill>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {scenario.observability_signals.length > 0 ? (
        <div className="mt-4">
          <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
            Observability signals
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {scenario.observability_signals.map((sig) => (
              <li key={sig}>
                <Pill className="border border-blue-200 bg-blue-50 text-blue-800">
                  {sig}
                </Pill>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function SummaryStat({ label, value, mono = false }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white/80 p-3">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd
        className={`break-all text-xs text-slate-800 sm:text-[0.8125rem] ${
          mono ? "font-mono" : "font-semibold"
        }`}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

function TimelinePanel({ simulation, visibleSteps }) {
  const { scenario } = simulation;
  return (
    <section className={sectionCardClass} aria-labelledby="exec-timeline-heading">
      <h2 id="exec-timeline-heading" className={sectionTitleClass}>
        Timeline visualization
      </h2>
      <p className={sectionSubtitleClass}>
        Ordered execution states with deterministic timestamps, emitted
        events, and checkpoint movement. Replay steps reveal the timeline one
        entry at a time.
      </p>
      <ol className="mt-4 flex flex-col gap-3">
        {scenario.timeline.map((entry, idx) => {
          const isVisible = idx < visibleSteps;
          return (
            <li
              key={entry.state_key + "-" + idx}
              className={`flex flex-col gap-2 rounded-xl border p-3 transition ${
                isVisible
                  ? "border-slate-200 bg-white/90"
                  : "border-dashed border-slate-200 bg-white/40 text-slate-400"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold ${
                      isVisible
                        ? "bg-slate-900 text-white"
                        : "bg-slate-200 text-slate-500"
                    }`}
                    aria-hidden
                  >
                    {idx + 1}
                  </span>
                  <span className="text-sm font-bold text-slate-900 sm:text-[0.9375rem]">
                    {entry.title}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <TimelineStateBadge stateKey={entry.state_key} />
                  <CheckpointStatusBadge statusKey={entry.checkpoint_status} />
                </div>
              </div>
              <p className="text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
                {entry.description}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-slate-600 sm:text-xs">
                <span>
                  Offset:{" "}
                  <span className="font-mono">
                    +{entry.relative_offset_ms}ms
                  </span>
                </span>
                <span className="text-slate-300" aria-hidden>
                  ·
                </span>
                <span>
                  Snapshot:{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.7rem] text-slate-800">
                    {entry.snapshot_state}
                  </code>
                </span>
              </div>
              {entry.emitted_event_types?.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5">
                  {entry.emitted_event_types.map((evt) => {
                    const family = evt.includes(".")
                      ? evt.split(".")[0]
                      : "execution";
                    return (
                      <li key={evt} className="flex items-center gap-1">
                        <EventFamilyBadge family={family} />
                        <code className="font-mono text-[0.7rem] text-slate-800 sm:text-[0.75rem]">
                          {evt}
                        </code>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EventStreamPanel({ simulation, visibleSteps }) {
  const { events } = simulation;
  const visibleEvents = events.filter(
    (e) => e.timeline_entry_index < visibleSteps,
  );

  return (
    <section className={sectionCardClass} aria-labelledby="exec-events-heading">
      <h2 id="exec-events-heading" className={sectionTitleClass}>
        Event stream
      </h2>
      <p className={sectionSubtitleClass}>
        Simulated events in sequence order. Same shape as a Phase 2F
        internal_event_store row — but nothing is persisted.
      </p>
      {visibleEvents.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white/40 p-4 text-center text-xs text-slate-500 sm:text-sm">
          No events yet. Generate a simulation or advance the replay.
        </p>
      ) : (
        <ol className="mt-4 flex flex-col gap-2">
          {visibleEvents.map((e) => (
            <li
              key={e.event_id}
              className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/90 p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[0.7rem] font-bold text-white"
                    aria-hidden
                  >
                    {e.sequence_number}
                  </span>
                  <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
                    {e.event_type}
                  </code>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <EventFamilyBadge family={e.event_family} />
                  <Pill className="border border-slate-200 bg-slate-50 text-slate-700">
                    seq {e.sequence_number}
                  </Pill>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-slate-600 sm:text-xs">
                <span>
                  Event id:{" "}
                  <code className="font-mono text-slate-800">{e.event_id}</code>
                </span>
                <span className="text-slate-300" aria-hidden>
                  ·
                </span>
                <span>
                  Trace:{" "}
                  <code className="font-mono text-slate-800">{e.trace_id}</code>
                </span>
                <span className="text-slate-300" aria-hidden>
                  ·
                </span>
                <span>
                  Occurred:{" "}
                  <code className="font-mono text-slate-800">
                    {e.occurred_at}
                  </code>
                </span>
              </div>
              {e.parent_event_id ? (
                <div className="text-[0.7rem] text-slate-500 sm:text-xs">
                  Parent:{" "}
                  <code className="font-mono text-slate-700">
                    {e.parent_event_id}
                  </code>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function SnapshotEvolutionPanel({ simulation, visibleSteps }) {
  const { snapshots } = simulation;
  const visible = snapshots.filter((_, idx) => idx < visibleSteps);
  return (
    <section className={sectionCardClass} aria-labelledby="exec-snapshots-heading">
      <h2 id="exec-snapshots-heading" className={sectionTitleClass}>
        Snapshot evolution
      </h2>
      <p className={sectionSubtitleClass}>
        Derived state versions per timeline entry. Same shape as a Phase 2F
        internal_runtime_state_snapshots row.
      </p>
      {visible.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-white/40 p-4 text-center text-xs text-slate-500 sm:text-sm">
          No snapshots yet.
        </p>
      ) : (
        <ol className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {visible.map((s) => (
            <li
              key={s.snapshot_id}
              className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/90 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
                  {s.snapshot_id}
                </code>
                <Pill className="border border-slate-200 bg-slate-50 text-slate-700">
                  v{s.version}
                </Pill>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <TimelineStateBadge stateKey={s.timeline_state} />
                <Pill className="border border-blue-200 bg-blue-50 text-blue-800">
                  runtime: {s.current_execution_state}
                </Pill>
              </div>
              <p className="text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
                {s.timeline_title}
              </p>
              <div className="text-[0.7rem] text-slate-500 sm:text-xs">
                Derived at:{" "}
                <code className="font-mono text-slate-700">{s.derived_at}</code>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function CorrelationPanel({ simulation, visibleSteps }) {
  const { scenario } = simulation;
  const visible = scenario.timeline.slice(0, visibleSteps);
  const visibleHasIntegrationEvent = visible.some((entry) =>
    (entry.emitted_event_types ?? []).some((t) => t.startsWith("integration.")),
  );
  return (
    <section className={sectionCardClass} aria-labelledby="exec-correlation-heading">
      <h2 id="exec-correlation-heading" className={sectionTitleClass}>
        Cross-service correlation
      </h2>
      <p className={sectionSubtitleClass}>
        Which Blue Atlantic peers this scenario interacts with, plus whether
        the currently visible steps have produced an integration-family event
        yet.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {scenario.correlation_targets.map((target) => {
          const isInvolved = target !== "tropicash";
          const visibleEvent =
            isInvolved && visibleHasIntegrationEvent;
          return (
            <li
              key={target}
              className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/90 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 sm:text-[0.9375rem]">
                  {KNOWN_CORRELATION_LABELS[target] ?? target}
                </span>
                <Pill className="border border-slate-200 bg-slate-50 text-slate-700">
                  {target}
                </Pill>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {target === "tropicash" ? (
                  <Pill className="border border-emerald-200 bg-emerald-50 text-emerald-800">
                    source
                  </Pill>
                ) : (
                  <Pill
                    className={
                      visibleEvent
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                        : "border border-slate-200 bg-slate-50 text-slate-600"
                    }
                  >
                    {visibleEvent ? "linked" : "pending"}
                  </Pill>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ObservabilityPanel({ simulation, visibleSteps }) {
  const { scenario, checkpoints } = simulation;
  const mock = useMemo(
    () => getMockObservabilityForScenario(scenario),
    [scenario],
  );

  // The "live" checkpoint cursor follows the most recently visible timeline
  // entry so users can see cursor movement during a replay.
  const visibleCheckpoint =
    visibleSteps > 0 ? checkpoints[visibleSteps - 1] : null;

  return (
    <section className={sectionCardClass} aria-labelledby="exec-observability-heading">
      <h2 id="exec-observability-heading" className={sectionTitleClass}>
        Observability (mock)
      </h2>
      <p className={sectionSubtitleClass}>
        Deterministic, pre-computed metrics derived from the scenario seed.
        Nothing is measured at runtime — these values are inputs to the UI,
        not telemetry.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryStat label="Mock latency" value={`${mock.latency_ms} ms`} />
        <SummaryStat label="Mock replay count" value={`${mock.replay_count}`} />
        <SummaryStat label="Review duration" value={`${mock.review_duration_ms} ms`} />
        <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white/80 p-3">
          <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
            Checkpoint health
          </dt>
          <dd>
            <CheckpointHealthBadge healthKey={mock.checkpoint_health} />
          </dd>
        </div>
      </dl>

      <div className="mt-5 rounded-xl border border-slate-200 bg-white/80 p-3">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
          Current checkpoint cursor
        </p>
        {visibleCheckpoint ? (
          <div className="mt-2 flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
                {visibleCheckpoint.checkpoint_key}
              </code>
              <CheckpointStatusBadge
                statusKey={visibleCheckpoint.checkpoint_status}
              />
            </div>
            <div className="text-[0.7rem] text-slate-600 sm:text-xs">
              Last sequence:{" "}
              <span className="font-mono text-slate-800">
                {visibleCheckpoint.last_sequence_number}
              </span>
              {visibleCheckpoint.last_event_id ? (
                <>
                  {" · "}Last event:{" "}
                  <code className="font-mono text-slate-800">
                    {visibleCheckpoint.last_event_id}
                  </code>
                </>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-slate-500 sm:text-sm">
            No cursor yet. Advance the replay to show the first checkpoint.
          </p>
        )}
      </div>
    </section>
  );
}

function SafetyConstraintsSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="exec-safety-heading"
    >
      <h2 id="exec-safety-heading" className={sectionTitleClass}>
        Simulation safety constraints
      </h2>
      <p className={sectionSubtitleClass}>
        These constraints are intentional. Phase 3A delivers a visualization
        layer only; it cannot evolve into a runtime engine without an explicit
        future phase.
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        {EXECUTION_SIMULATION_SAFETY_RULES.map((rule, idx) => (
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
export default function ExecutionSimulatorPage() {
  // Default to the first scenario so the UI always has a starting point.
  const defaultScenarioKey = EXECUTION_SCENARIOS[0]?.scenario_key ?? "";

  const [selectedScenarioKey, setSelectedScenarioKey] = useState(
    defaultScenarioKey,
  );
  const [environment, setEnvironment] = useState("sandbox");
  // `simulation` is the active in-memory build. `visibleSteps` is how many
  // timeline entries the user has revealed via Replay Timeline.
  const [simulation, setSimulation] = useState(null);
  const [visibleSteps, setVisibleSteps] = useState(0);

  const selectedScenario = useMemo(
    () => getScenarioByKey(selectedScenarioKey),
    [selectedScenarioKey],
  );
  const timelineLength = selectedScenario?.timeline.length ?? 0;

  const handleGenerate = () => {
    if (!selectedScenario) return;
    const sim = buildScenarioSimulation(selectedScenario, environment);
    setSimulation(sim);
    setVisibleSteps(sim.scenario.timeline.length);
  };

  const handleReplay = () => {
    if (!simulation) {
      // Build first if nothing is generated, then start replay at step 1.
      const sim = buildScenarioSimulation(selectedScenario, environment);
      setSimulation(sim);
      setVisibleSteps(1);
      return;
    }
    // Step forward; wrap back to 1 once we've fully revealed the timeline.
    setVisibleSteps((prev) => {
      if (prev >= timelineLength) return 1;
      return prev + 1;
    });
  };

  const handleReset = () => {
    setSimulation(null);
    setVisibleSteps(0);
  };

  return (
    <DevConsoleLayout
      title="Execution Simulator"
      subtitle="Deterministic, replayable scenarios that visualize how a future Tropicash request would walk the pipeline. Simulation only — no runtime, no money movement, no persistence."
      environment={environment === "live" ? "sandbox" : environment}
    >
      <div className={planningBannerClass}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"
          aria-hidden
        >
          🧪
        </span>
        <div className="min-w-0">
          <strong className="block font-semibold text-amber-900">
            Simulation only — nothing here is real.
          </strong>
          <span className="block">
            Phase{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {EXECUTION_SCENARIO_PHASE}
            </code>
            . Scenarios are rendered from{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              lib/executionScenarioConfig.js
            </code>
            . Generating, replaying, or resetting a simulation only mutates
            local React state — no APIs, no money movement, no persistence.
          </span>
        </div>
      </div>

      {/* Controls */}
      <section className={sectionCardClass} aria-labelledby="exec-controls-heading">
        <h2 id="exec-controls-heading" className={sectionTitleClass}>
          Controls
        </h2>
        <p className={sectionSubtitleClass}>
          Pick a scenario and environment, then generate a deterministic
          simulation. Replay steps through the timeline one entry at a time.
          Reset clears local state only.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
              Scenario
            </span>
            <select
              value={selectedScenarioKey}
              onChange={(e) => {
                setSelectedScenarioKey(e.target.value);
                handleReset();
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              <ScenarioOptionGroup />
            </select>
            {selectedScenario ? (
              <span className="text-[0.7rem] text-slate-500 sm:text-xs">
                {selectedScenario.description}
              </span>
            ) : null}
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
                <option
                  key={env}
                  value={env}
                  disabled={env === "live"}
                >
                  {env}
                  {env === "live" ? " (disabled — Phase 3A is sandbox only)" : ""}
                </option>
              ))}
            </select>
            <span className="text-[0.7rem] text-slate-500 sm:text-xs">
              Live is intentionally disabled — Phase 3A simulations are
              sandbox-only.
            </span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Generate Simulation
          </button>
          <button
            type="button"
            onClick={handleReplay}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
          >
            Replay Timeline
            {simulation && timelineLength > 0
              ? ` (${visibleSteps} / ${timelineLength})`
              : ""}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            disabled={!simulation && visibleSteps === 0}
          >
            Reset Simulation
          </button>
        </div>
      </section>

      {/* Simulation output */}
      {simulation ? (
        <>
          <ExecutionSummaryCard
            simulation={simulation}
            environment={environment}
          />
          <TimelinePanel simulation={simulation} visibleSteps={visibleSteps} />
          <EventStreamPanel
            simulation={simulation}
            visibleSteps={visibleSteps}
          />
          <SnapshotEvolutionPanel
            simulation={simulation}
            visibleSteps={visibleSteps}
          />
          <CorrelationPanel
            simulation={simulation}
            visibleSteps={visibleSteps}
          />
          <ObservabilityPanel
            simulation={simulation}
            visibleSteps={visibleSteps}
          />
        </>
      ) : (
        <section className={sectionCardClass}>
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white"
              aria-hidden
            >
              🧪
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 sm:text-lg">
                No simulation generated yet
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                Click <strong>Generate Simulation</strong> to render a
                deterministic execution trace for the selected scenario.
                Nothing leaves this page.
              </p>
            </div>
          </div>
        </section>
      )}

      <SafetyConstraintsSection />

      {/* Scenario catalog reference */}
      <section
        className={sectionCardClass}
        aria-labelledby="exec-catalog-heading"
      >
        <h2 id="exec-catalog-heading" className={sectionTitleClass}>
          Scenario catalog
        </h2>
        <p className={sectionSubtitleClass}>
          The {EXECUTION_SCENARIOS.length} scenarios seeded in Phase 3A,
          grouped by category. Switching the dropdown above selects one for
          generation.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {EXECUTION_SCENARIOS.map((s) => (
            <li
              key={s.scenario_key}
              className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/90 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
                  {s.scenario_key}
                </code>
                <CategoryBadge categoryKey={s.category} />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <FinalStateBadge stateKey={s.final_state} />
                {s.requires_review ? (
                  <Pill className="border border-amber-200 bg-amber-50 text-amber-900">
                    review required
                  </Pill>
                ) : null}
                <Pill className="border border-slate-200 bg-slate-50 text-slate-700">
                  {s.execution_duration_ms} ms
                </Pill>
              </div>
              <p className="text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
                {s.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Final-state legend */}
      <section className={sectionCardClass} aria-labelledby="exec-legend-heading">
        <h2 id="exec-legend-heading" className={sectionTitleClass}>
          Final state legend
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXECUTION_FINAL_STATES.map((state) => (
            <li
              key={state.key}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
            >
              <FinalStateBadge stateKey={state.key} />
              <p className="text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
                {state.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Timeline-state legend */}
      <section className={sectionCardClass} aria-labelledby="exec-timeline-legend-heading">
        <h2 id="exec-timeline-legend-heading" className={sectionTitleClass}>
          Timeline state legend
        </h2>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXECUTION_TIMELINE_STATES.map((state) => (
            <li
              key={state.key}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
            >
              <TimelineStateBadge stateKey={state.key} />
              <p className="text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
                {state.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        className={sectionCardClass}
        aria-labelledby="exec-decision-sim-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-xl"
          >
            🧭
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-sky-800">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500"
                aria-hidden
              />
              Phase 3B
            </span>
            <h2
              id="exec-decision-sim-heading"
              className={`mt-2 ${sectionTitleClass}`}
            >
              Decision Simulator
            </h2>
            <p className={sectionSubtitleClass}>
              Phase 3B explains <strong>why</strong> each simulated execution is
              allowed, paused for review, blocked, delayed, rate-limited, or
              marked retryable — using a deterministic rule walk, not a live
              policy engine.
            </p>
            <Link
              href="/dev-console/decision-simulator"
              className="mt-3 inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Open Decision Simulator →
            </Link>
          </div>
        </div>
      </section>

      <section
        className={sectionCardClass}
        aria-labelledby="exec-sim-history-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-xl"
          >
            📊
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-sky-800">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500"
                aria-hidden
              />
              Phase 3C
            </span>
            <h2
              id="exec-sim-history-heading"
              className={`mt-2 ${sectionTitleClass}`}
            >
              Simulation Run History
            </h2>
            <p className={sectionSubtitleClass}>
              Phase 3C aggregates the same scenario keys into a deterministic
              run ledger: health rollups, outcome distributions, review scans,
              and scenario-vs-decision alignment — without persisting rows or
              calling APIs.
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

      {/* Related views */}
      <section
        className={sectionCardClass}
        aria-labelledby="exec-cross-refs-heading"
      >
        <h2 id="exec-cross-refs-heading" className={sectionTitleClass}>
          Related views
        </h2>
        <p className={sectionSubtitleClass}>
          The simulator visualizes how Phase 2D orchestration, Phase 2E
          observability, and Phase 2F runtime state compose. Start with the
          blueprint for the high-level narrative.
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
              Observability &amp; Runtime Telemetry →
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
