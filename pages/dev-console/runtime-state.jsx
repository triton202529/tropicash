import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  INTERNAL_RUNTIME_STATE_PHASE,
  EVENT_STORE_EVENT_FAMILIES,
  RUNTIME_EXECUTION_STATES,
  CHECKPOINT_STATUSES,
  CORRELATION_RELATION_TYPES,
  EVENT_STORE_SEEDS,
  RUNTIME_STATE_SNAPSHOT_SEEDS,
  EVENT_STREAM_CHECKPOINT_SEEDS,
  EVENT_CORRELATION_LINK_SEEDS,
  RUNTIME_STATE_SAFETY_RULES,
  getRuntimeExecutionState,
  getCheckpointStatus,
  getCorrelationRelationType,
  getEventFamilyForEventType,
  getEventsForTrace,
} from "../../lib/internalRuntimeStateConfig";
import { getExecutionSessionSeed } from "../../lib/internalObservabilityConfig";
import { getPipelineStage } from "../../lib/internalExecutionOrchestrationConfig";

const planningBannerClass =
  "flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:flex-row sm:items-start sm:gap-4 sm:p-6 sm:text-[0.9375rem]";
const sectionCardClass = "tropicash-surface rounded-2xl p-5 sm:p-6";
const sectionTitleClass = "text-base font-bold text-slate-900 sm:text-lg";
const sectionSubtitleClass =
  "mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]";

const slug = (s) =>
  s.replace(/\s+/g, "-").replace(/[^a-z0-9-]/gi, "").toLowerCase();

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

function EnvChip({ environment }) {
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

function ExecutionStatePill({ stateKey }) {
  const s = getRuntimeExecutionState(stateKey);
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

function CheckpointStatusPill({ statusKey }) {
  const s = getCheckpointStatus(statusKey);
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
// 1. Immutable event store
// ---------------------------------------------------------------------------
function EventStoreSection() {
  const tracesById = EVENT_STORE_SEEDS.reduce((acc, ev) => {
    if (!acc[ev.traceId]) acc[ev.traceId] = [];
    acc[ev.traceId].push(ev);
    return acc;
  }, {});
  const traceIds = Object.keys(tracesById);

  return (
    <section className={sectionCardClass} aria-labelledby="event-store-heading">
      <h2 id="event-store-heading" className={sectionTitleClass}>
        Immutable event store
      </h2>
      <p className={sectionSubtitleClass}>
        Append-only log written by the future executor. Per-trace ordering
        is enforced by a unique{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          (trace_id, sequence_number)
        </code>{" "}
        constraint. Phase 2F seeds {EVENT_STORE_SEEDS.length} placeholder
        events across {traceIds.length} demo traces.
      </p>

      <div className="mt-4">
        <h3 className="text-sm font-bold text-slate-900 sm:text-base">
          Event families
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2">
          {EVENT_STORE_EVENT_FAMILIES.map((family) => (
            <li
              key={family.key}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
              style={{ borderLeft: `4px solid ${family.accent}` }}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="text-base leading-none">
                    {family.icon}
                  </span>
                  <Pill className={family.badgeClass}>{family.label}</Pill>
                </div>
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  {family.eventTypes.length}{" "}
                  {family.eventTypes.length === 1 ? "type" : "types"}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                {family.description}
              </p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {family.eventTypes.map((et) => (
                  <li key={et}>
                    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[0.7rem] text-slate-700">
                      {et}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-slate-900 sm:text-base">
          Demo traces
        </h3>
        <ul className="mt-3 flex flex-col gap-3">
          {traceIds.map((traceId) => {
            const events = getEventsForTrace(traceId);
            const first = events[0];
            return (
              <li
                key={traceId}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <code className="font-mono text-[0.75rem] font-semibold text-slate-900">
                    {traceId}
                  </code>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill className="border border-slate-200 bg-white/80 text-slate-700">
                      {events.length}{" "}
                      {events.length === 1 ? "event" : "events"}
                    </Pill>
                    <EnvChip environment={first?.environment} />
                  </div>
                </div>
                <ol className="mt-1 flex flex-col gap-1.5">
                  {events.map((ev) => {
                    const family = getEventFamilyForEventType(ev.eventType);
                    return (
                      <li
                        key={ev.eventId}
                        className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60 p-2"
                        style={{
                          borderLeft: `3px solid ${family?.accent ?? "#94a3b8"}`,
                        }}
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[0.7rem] font-semibold text-slate-500">
                              #{ev.sequenceNumber}
                            </span>
                            <code className="font-mono text-[0.75rem] font-semibold text-slate-900">
                              {ev.eventType}
                            </code>
                          </div>
                          {family ? (
                            <Pill className={family.badgeClass}>
                              {family.label}
                            </Pill>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-slate-600">
                          <span>
                            event_id:{" "}
                            <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[0.7rem] text-slate-800">
                              {ev.eventId}
                            </code>
                          </span>
                          {ev.actorType ? (
                            <span>
                              actor:{" "}
                              <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[0.7rem] text-slate-800">
                                {ev.actorType}
                                {ev.actorId ? `/${ev.actorId}` : ""}
                              </code>
                            </span>
                          ) : null}
                          {ev.correlationId ? (
                            <span>
                              correlation:{" "}
                              <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[0.7rem] text-slate-800">
                                {ev.correlationId}
                              </code>
                            </span>
                          ) : null}
                        </div>
                        {ev.eventPayload?.purpose ? (
                          <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                            {ev.eventPayload.purpose}
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Mutable state snapshots
// ---------------------------------------------------------------------------
function SnapshotsSection() {
  return (
    <section className={sectionCardClass} aria-labelledby="snapshots-heading">
      <h2 id="snapshots-heading" className={sectionTitleClass}>
        Mutable state snapshots
      </h2>
      <p className={sectionSubtitleClass}>
        Derived per-session state — a cache, never the source of truth.
        Snapshots must always be reconstructable from the immutable event
        store.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {RUNTIME_STATE_SNAPSHOT_SEEDS.map((snap) => {
          const session = getExecutionSessionSeed(snap.executionSessionId);
          const stage = snap.lastStageKey
            ? getPipelineStage(snap.lastStageKey)
            : null;
          return (
            <li
              key={snap.snapshotId}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <code className="font-mono text-[0.75rem] font-semibold text-slate-900">
                  {snap.snapshotId}
                </code>
                <ExecutionStatePill stateKey={snap.currentExecutionState} />
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 sm:text-[0.8125rem]">
                <span>
                  Capability:{" "}
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.7rem] text-slate-800">
                    {snap.capabilityKey}
                  </code>
                </span>
                <span className="text-slate-300" aria-hidden>
                  ·
                </span>
                <EnvChip environment={snap.environment} />
                <Pill className="border border-slate-200 bg-white/80 text-slate-700">
                  v{snap.version}
                </Pill>
              </div>
              <div className="text-[0.7rem] text-slate-500">
                trace_id:{" "}
                <code className="font-mono text-[0.7rem] text-slate-700">
                  {snap.traceId}
                </code>
              </div>
              {session ? (
                <div className="text-[0.7rem] text-slate-500">
                  Session (Phase 2E):{" "}
                  <code className="font-mono text-[0.7rem] text-slate-700">
                    {session.executionSessionId}
                  </code>
                </div>
              ) : null}
              {stage ? (
                <div className="text-[0.7rem] text-slate-500">
                  Last stage:{" "}
                  <code className="font-mono text-[0.7rem] text-slate-700">
                    {stage.stageKey}
                  </code>
                </div>
              ) : null}
              {snap.statePayload?.purpose ? (
                <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                  {snap.statePayload.purpose}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-5">
        <h3 className="text-sm font-bold text-slate-900 sm:text-base">
          Snapshot states
        </h3>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {RUNTIME_EXECUTION_STATES.map((s) => (
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
// 3. Event stream checkpoints
// ---------------------------------------------------------------------------
function CheckpointsSection() {
  return (
    <section className={sectionCardClass} aria-labelledby="checkpoints-heading">
      <h2 id="checkpoints-heading" className={sectionTitleClass}>
        Event stream checkpoints
      </h2>
      <p className={sectionSubtitleClass}>
        Per-trace cursor recording the last replayed event. Snapshot
        rebuilders advance these checkpoints — they are advisory and never
        authorize execution on their own.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {EVENT_STREAM_CHECKPOINT_SEEDS.map((ckpt) => (
          <li
            key={ckpt.checkpointKey}
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <code className="font-mono text-[0.75rem] font-semibold text-slate-900">
                {ckpt.checkpointKey}
              </code>
              <CheckpointStatusPill statusKey={ckpt.checkpointStatus} />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 sm:text-[0.8125rem]">
              <span>
                Capability:{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.7rem] text-slate-800">
                  {ckpt.capabilityKey}
                </code>
              </span>
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <EnvChip environment={ckpt.environment} />
            </div>
            <div className="text-[0.7rem] text-slate-500">
              trace_id:{" "}
              <code className="font-mono text-[0.7rem] text-slate-700">
                {ckpt.traceId}
              </code>
            </div>
            <div className="text-[0.7rem] text-slate-500">
              last_sequence_number:{" "}
              <code className="font-mono text-[0.7rem] text-slate-700">
                #{ckpt.lastSequenceNumber}
              </code>
            </div>
            {ckpt.lastEventId ? (
              <div className="text-[0.7rem] text-slate-500">
                last_event_id:{" "}
                <code className="font-mono text-[0.7rem] text-slate-700">
                  {ckpt.lastEventId}
                </code>
              </div>
            ) : null}
            {ckpt.metadata?.purpose ? (
              <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                {ckpt.metadata.purpose}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. Cross-service correlation
// ---------------------------------------------------------------------------
function CorrelationSection() {
  return (
    <section className={sectionCardClass} aria-labelledby="correlation-heading">
      <h2 id="correlation-heading" className={sectionTitleClass}>
        Cross-service correlation
      </h2>
      <p className={sectionSubtitleClass}>
        How a Tropicash event lines up with a downstream Blue Atlantic
        service event by{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          correlation_id
        </code>
        . Phase 2F seeds the canonical Tropicash → Triton / Sentinel /
        EliteHire Pro relationships.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {EVENT_CORRELATION_LINK_SEEDS.map((link) => {
          const rel = getCorrelationRelationType(link.relationType);
          return (
            <li
              key={link.correlationId}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-semibold text-slate-900">
                  {link.sourceServiceKey}
                  <span aria-hidden className="mx-1.5 text-slate-400">
                    →
                  </span>
                  {link.targetServiceKey}
                </span>
                <Pill className={rel.badgeClass} title={rel.description}>
                  {rel.label}
                </Pill>
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-slate-600">
                <EnvChip environment={link.environment} />
                <span>
                  correlation_id:{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.7rem] text-slate-800">
                    {link.correlationId}
                  </code>
                </span>
              </div>
              {link.sourceEventId ? (
                <div className="text-[0.7rem] text-slate-500">
                  source_event_id:{" "}
                  <code className="font-mono text-[0.7rem] text-slate-700">
                    {link.sourceEventId}
                  </code>
                </div>
              ) : null}
              {link.targetEventId ? (
                <div className="text-[0.7rem] text-slate-500">
                  target_event_id:{" "}
                  <code className="font-mono text-[0.7rem] text-slate-700">
                    {link.targetEventId}
                  </code>
                </div>
              ) : null}
              {link.metadata?.purpose ? (
                <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                  {link.metadata.purpose}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 5. Event ordering model
// ---------------------------------------------------------------------------
function EventOrderingSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="event-ordering-heading"
    >
      <h2 id="event-ordering-heading" className={sectionTitleClass}>
        Event ordering model
      </h2>
      <p className={sectionSubtitleClass}>
        Tropicash uses per-trace monotonic ordering, enforced at the
        database. There is no global event clock — global ordering is
        approximated via{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          occurred_at
        </code>{" "}
        and per-trace ordering is exact.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <li className="rounded-xl border border-slate-200 bg-white/80 p-3">
          <div className="flex items-center gap-2">
            <Pill className="border border-emerald-200 bg-emerald-50 text-emerald-800">
              Per-trace
            </Pill>
            <span className="text-sm font-semibold text-slate-900">
              Strictly monotonic
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
            Within a single{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.7rem] text-slate-800">
              trace_id
            </code>
            , sequence numbers must be allocated monotonically. The unique{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.7rem] text-slate-800">
              (trace_id, sequence_number)
            </code>{" "}
            constraint guarantees no two writers can collide.
          </p>
        </li>
        <li className="rounded-xl border border-slate-200 bg-white/80 p-3">
          <div className="flex items-center gap-2">
            <Pill className="border border-amber-200 bg-amber-50 text-amber-900">
              Cross-trace
            </Pill>
            <span className="text-sm font-semibold text-slate-900">
              Approximate (occurred_at)
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
            Across traces, ordering is approximate and based on{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.7rem] text-slate-800">
              occurred_at
            </code>
            . Consumers reconcile multi-trace replays via{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.7rem] text-slate-800">
              correlation_id
            </code>
            , not via a global clock.
          </p>
        </li>
        <li className="rounded-xl border border-slate-200 bg-white/80 p-3">
          <div className="flex items-center gap-2">
            <Pill className="border border-violet-200 bg-violet-50 text-violet-900">
              Causation
            </Pill>
            <span className="text-sm font-semibold text-slate-900">
              parent_event_id + causation_id
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
            Direct causal links are stamped on each event. Replayers can
            walk backwards from any event to the originating cause.
          </p>
        </li>
        <li className="rounded-xl border border-slate-200 bg-white/80 p-3">
          <div className="flex items-center gap-2">
            <Pill className="border border-sky-200 bg-sky-50 text-sky-800">
              Append-only
            </Pill>
            <span className="text-sm font-semibold text-slate-900">
              No updates, no deletes
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
            Once written, event rows are immutable. Corrections are
            modeled as new compensating events, not as mutations.
          </p>
        </li>
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 6. Runtime reconstruction flow
// ---------------------------------------------------------------------------
const RECONSTRUCTION_FLOW_STEPS = [
  {
    key: "select_trace",
    label: "Select a trace",
    description:
      "Pick a trace_id (or correlation_id) to reconstruct the runtime state for.",
    accent: "#0ea5e9",
  },
  {
    key: "load_events",
    label: "Load events",
    description:
      "Stream events from internal_event_store ordered by sequence_number ASC.",
    accent: "#2563eb",
  },
  {
    key: "apply_events",
    label: "Apply events",
    description:
      "Fold each event into a snapshot, redacting sensitive fields per the Phase 2E replay template.",
    accent: "#7c3aed",
  },
  {
    key: "advance_checkpoint",
    label: "Advance checkpoint",
    description:
      "Update internal_event_stream_checkpoints with the last (sequence_number, event_id) consumed.",
    accent: "#f97316",
  },
  {
    key: "publish_snapshot",
    label: "Publish snapshot",
    description:
      "Bump the snapshot version and write back to internal_runtime_state_snapshots.",
    accent: "#16a34a",
  },
  {
    key: "follow_correlations",
    label: "Follow correlations",
    description:
      "If the trace touched a downstream service, walk internal_event_correlation_links to inspect mirrored events.",
    accent: "#475569",
  },
];

function ReconstructionFlowSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="reconstruction-flow-heading"
    >
      <h2 id="reconstruction-flow-heading" className={sectionTitleClass}>
        Runtime reconstruction flow
      </h2>
      <p className={sectionSubtitleClass}>
        How a future replayer rebuilds a snapshot from the event log. Phase
        2F describes this flow; no code path implements it yet.
      </p>
      <ol
        aria-label="Runtime reconstruction flow"
        className="mt-4 flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto pb-2 sm:gap-3"
      >
        {RECONSTRUCTION_FLOW_STEPS.map((step, idx) => {
          const isLast = idx === RECONSTRUCTION_FLOW_STEPS.length - 1;
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
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
      aria-labelledby="runtime-state-safety-rules-heading"
    >
      <h2
        id="runtime-state-safety-rules-heading"
        className={sectionTitleClass}
      >
        Runtime state safety rules
      </h2>
      <p className={sectionSubtitleClass}>
        Phase 2F rules — narrow the existing platform safety rules into
        runtime-state-level checks. Phase 2F describes the event store and
        snapshots; it does not implement them.
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        {RUNTIME_STATE_SAFETY_RULES.map((rule, idx) => (
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
export default function RuntimeStatePage() {
  return (
    <DevConsoleLayout
      title="Runtime State & Event Store"
      subtitle="The append-only event log, derived snapshots, per-trace checkpoints, and cross-service correlation that future Tropicash executions will produce. Phase 2F defines the shape — no event emitter or executor exists yet."
    >
      <div className={planningBannerClass}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"
          aria-hidden
        >
          🧾
        </span>
        <div className="min-w-0">
          <strong className="block font-semibold text-amber-900">
            Planning only — no event emitter or executor.
          </strong>
          <span className="block">
            Phase{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {INTERNAL_RUNTIME_STATE_PHASE}
            </code>
            . Schema lives in{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              supabase/sql/internal_runtime_state_phase2f.sql
            </code>
            . {EVENT_STORE_SEEDS.length} placeholder events,{" "}
            {RUNTIME_STATE_SNAPSHOT_SEEDS.length} snapshots,{" "}
            {EVENT_STREAM_CHECKPOINT_SEEDS.length} checkpoints, and{" "}
            {EVENT_CORRELATION_LINK_SEEDS.length} correlation links seeded.
            No money movement.
          </span>
        </div>
      </div>

      <EventStoreSection />

      <SnapshotsSection />

      <CheckpointsSection />

      <CorrelationSection />

      <EventOrderingSection />

      <ReconstructionFlowSection />

      <LegendBlock
        heading="Checkpoint status legend"
        items={CHECKPOINT_STATUSES}
      />

      <LegendBlock
        heading="Correlation relation legend"
        items={CORRELATION_RELATION_TYPES}
      />

      <SafetyRulesSection />

      <section
        className={sectionCardClass}
        aria-labelledby="runtime-state-simulator-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-xl"
          >
            🧪
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-sky-800">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500"
                aria-hidden
              />
              Phase 3A
            </span>
            <h2
              id="runtime-state-simulator-heading"
              className={`mt-2 ${sectionTitleClass}`}
            >
              Execution Simulator
            </h2>
            <p className={sectionSubtitleClass}>
              The Execution Simulator visualizes how a future request would
              walk the orchestration pipeline and produce the events,
              snapshots, and checkpoints modeled in Phase 2F. Simulation is
              deterministic, replayable, and entirely in-memory — no event
              emitter, no persistence, no money movement.
            </p>
            <Link
              href="/dev-console/execution-simulator"
              className="mt-3 inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Open Execution Simulator →
            </Link>
          </div>
        </div>
      </section>

      <section
        className={sectionCardClass}
        aria-labelledby="runtime-state-cross-refs-heading"
      >
        <h2
          id="runtime-state-cross-refs-heading"
          className={sectionTitleClass}
        >
          Related views
        </h2>
        <p className={sectionSubtitleClass}>
          Runtime state composes with every prior phase: services (2A),
          governance (2B), capabilities (2C), orchestration (2D), and
          observability (2E). Phase 5D execution routing narration shows how
          post-gateway envelopes choreograph sandbox delegate targets toward
          deterministic simulation. The Phase 3A simulator brings these models to
          life as deterministic visualizations.
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
              href="/dev-console/observability"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Observability &amp; Runtime Telemetry →
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
          <li>
            <Link
              href="/dev-console/runtime-activation"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Runtime Activation (Phase 6A) →
            </Link>
          </li>
        </ul>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          <strong className="text-slate-800">Phase 6A — Runtime Activation.</strong> Models activation governance,
          environment isolation, readiness gates, and emergency shutdown before any execution environment exists.
        </p>
      </section>
    </DevConsoleLayout>
  );
}
