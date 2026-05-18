import { useMemo } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  INTERNAL_SERVICE_NAMESPACES,
  INTERNAL_BLUE_ATLANTIC_INTEGRATIONS,
  INTERNAL_EVENT_FAMILIES,
  STANDARD_EVENT_FIELDS,
  INTERNAL_ENVIRONMENT_RULES,
  INTERNAL_IDEMPOTENCY_RULES,
  INTERNAL_SAFETY_RULES,
} from "../../lib/internalPlatformConfig";

const sectionCardClass =
  "tropicash-surface flex flex-col rounded-2xl p-5 sm:p-6";

const sectionTitleClass =
  "text-base font-bold text-slate-900 sm:text-lg";

const sectionSubtitleClass =
  "mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]";

const planningBadgeClass =
  "inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-amber-900";

// Hub cards for every internal-platform phase. Each is a planning-only
// blueprint — no runtime, no APIs, no money movement. Cards are surfaced in
// the same order as the underlying phase progression.
const INTERNAL_PHASE_HUB_CARDS = [
  {
    phase: "2A",
    title: "Internal Service Registry",
    description:
      "The planning registry for Triton, Sentinel, and EliteHire Pro service identities, permissions, environments, and the audit log model.",
    sqlPath: "supabase/sql/internal_service_registry_phase2a.sql",
    href: "/dev-console/internal-services",
    cta: "Open registry",
  },
  {
    phase: "2B",
    title: "Integration Governance",
    description:
      "Lifecycle reviews, runtime policies, and environment gates layered on top of the registry. No enforcement yet.",
    sqlPath: "supabase/sql/internal_service_governance_phase2b.sql",
    href: "/dev-console/internal-governance",
    cta: "Open governance",
  },
  {
    phase: "2C",
    title: "Capability Registry",
    description:
      "Reusable capability definitions, dependencies, and operational constraints — the primitives every future request resolves to.",
    sqlPath: "supabase/sql/internal_capability_registry_phase2c.sql",
    href: "/dev-console/capabilities",
    cta: "Open capabilities",
  },
  {
    phase: "2D",
    title: "Execution Orchestration",
    description:
      "The runtime pipeline, policy evaluation vocabulary, runtime decisions, and per-capability trace templates. Vocabulary only — no executor.",
    sqlPath: "supabase/sql/internal_execution_orchestration_phase2d.sql",
    href: "/dev-console/orchestration",
    cta: "Open orchestration",
  },
  {
    phase: "2E",
    title: "Observability & Runtime Telemetry",
    description:
      "Execution sessions, the canonical metric catalog, the failure taxonomy, and replay templates. No telemetry pipeline emits today.",
    sqlPath: "supabase/sql/internal_observability_phase2e.sql",
    href: "/dev-console/observability",
    cta: "Open observability",
  },
  {
    phase: "2F",
    title: "Runtime State & Event Store",
    description:
      "The append-only event store, derived state snapshots, per-trace checkpoints, and cross-service correlation links. No emitter exists yet.",
    sqlPath: "supabase/sql/internal_runtime_state_phase2f.sql",
    href: "/dev-console/runtime-state",
    cta: "Open runtime state",
  },
];

function PlanningOnlyBadge() {
  return (
    <span className={planningBadgeClass}>
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
      Planning only — no internal APIs are active yet
    </span>
  );
}

function NamespaceList() {
  return (
    <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {INTERNAL_SERVICE_NAMESPACES.map((ns) => (
        <li
          key={ns.key}
          className="flex flex-col rounded-xl border border-slate-200 bg-white/80 p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <code className="font-mono text-sm font-semibold text-slate-900">
              {ns.key}
            </code>
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
              {ns.label}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-[0.9375rem]">
            {ns.purpose}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-700">
                Responsibilities
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
                {ns.responsibilities.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-rose-700">
                Must NOT yet
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
                {ns.mustNotYet.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function IntegrationsList() {
  return (
    <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {INTERNAL_BLUE_ATLANTIC_INTEGRATIONS.map((integration) => (
        <li
          key={integration.key}
          className="flex flex-col rounded-xl border border-slate-200 bg-white/80 p-4"
        >
          <p className="text-sm font-bold text-slate-900 sm:text-[0.9375rem]">
            {integration.label}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
            {integration.summary}
          </p>
          <ul className="mt-3 space-y-1 text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
            {integration.capabilities.map((cap) => (
              <li key={cap} className="flex items-start gap-2">
                <span
                  className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                  aria-hidden
                />
                <span>{cap}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function EventCatalog() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {INTERNAL_EVENT_FAMILIES.map((family) => (
        <div
          key={family.family}
          className="flex flex-col rounded-xl border border-slate-200 bg-white/80 p-4"
        >
          <div className="flex items-baseline justify-between gap-2">
            <code className="font-mono text-sm font-semibold text-slate-900">
              {family.family}.*
            </code>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-600">
              {family.events.length} events
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm">
            {family.description}
          </p>
          <ul className="mt-3 space-y-0.5">
            {family.events.map((e) => (
              <li key={e}>
                <code className="font-mono text-xs text-slate-800 sm:text-[0.8125rem]">
                  {e}
                </code>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function EventEnvelope({ exampleJson }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
          Envelope fields
        </p>
        <ul className="mt-2 space-y-2 text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
          {STANDARD_EVENT_FIELDS.fields.map((f) => (
            <li key={f.name} className="flex flex-col">
              <div className="flex flex-wrap items-baseline gap-2">
                <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
                  {f.name}
                </code>
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  {f.type}
                </span>
                <span
                  className={`text-[0.65rem] font-semibold uppercase tracking-wide ${
                    f.required ? "text-rose-700" : "text-slate-400"
                  }`}
                >
                  {f.required ? "Required" : "Optional"}
                </span>
              </div>
              <span className="text-slate-600">{f.description}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
          Example payload (placeholder values)
        </p>
        <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs leading-relaxed text-slate-100 sm:text-[0.8125rem]">
          <code>{exampleJson}</code>
        </pre>
      </div>
    </div>
  );
}

function IdempotencyRulesCard() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-700">
          Required for
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {INTERNAL_IDEMPOTENCY_RULES.required_for.map((item) => (
            <li
              key={item}
              className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800"
            >
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
          Rules
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
          {INTERNAL_IDEMPOTENCY_RULES.rules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function EnvironmentRulesCard() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {INTERNAL_ENVIRONMENT_RULES.environments.map((env) => (
        <div
          key={env.key}
          className="flex flex-col rounded-xl border border-slate-200 bg-white/80 p-4"
        >
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                env.key === "sandbox" ? "bg-sky-500" : "bg-emerald-500"
              }`}
              aria-hidden
            />
            <p className="text-sm font-bold text-slate-900">{env.label}</p>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
            {env.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      ))}
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white/80 p-4 md:col-span-2">
        <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
          Shared rules
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
          {INTERNAL_ENVIRONMENT_RULES.shared.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SafetyRulesCard() {
  return (
    <ol className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {INTERNAL_SAFETY_RULES.map((rule, idx) => (
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
  );
}

export default function InternalBlueprintPage() {
  // Memoize the formatted JSON so we don't restringify on every render.
  const exampleJson = useMemo(
    () => JSON.stringify(STANDARD_EVENT_FIELDS.example, null, 2),
    [],
  );

  return (
    <DevConsoleLayout
      title="Internal Platform Blueprint"
      subtitle="A planning-only summary of the internal Blue Atlantic service architecture: namespaces, integrations, event catalog, idempotency rules, environments, and safety rules."
    >
      <PlanningOnlyBadge />

      <section
        aria-label="Internal platform sub-system links"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {INTERNAL_PHASE_HUB_CARDS.map((card) => (
          <div
            key={card.phase}
            className="tropicash-surface flex flex-col gap-3 rounded-2xl p-5 sm:p-6"
            aria-labelledby={`blueprint-${card.phase.toLowerCase()}-heading`}
          >
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-sky-800">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500"
                aria-hidden
              />
              Phase {card.phase}
            </span>
            <h2
              id={`blueprint-${card.phase.toLowerCase()}-heading`}
              className="text-base font-bold text-slate-900 sm:text-lg"
            >
              {card.title}
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
              {card.description}{" "}
              Schema lives in{" "}
              <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
                {card.sqlPath}
              </code>
              .
            </p>
            <Link
              href={card.href}
              className="inline-flex w-fit items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              {card.cta} →
            </Link>
          </div>
        ))}
      </section>

      <section className={sectionCardClass} aria-labelledby="blueprint-namespaces-heading">
        <h2 id="blueprint-namespaces-heading" className={sectionTitleClass}>
          Internal Service Namespaces
        </h2>
        <p className={sectionSubtitleClass}>
          Logical service domains. These are <strong>not HTTP routes yet</strong> — they
          are naming conventions for future internal calls. Every namespace lists its
          planned responsibilities and what it must <em>not</em> do yet.
        </p>
        <div className="mt-4">
          <NamespaceList />
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="blueprint-integrations-heading">
        <h2 id="blueprint-integrations-heading" className={sectionTitleClass}>
          Blue Atlantic Integrations
        </h2>
        <p className={sectionSubtitleClass}>
          Capabilities (not endpoints) for each Blue Atlantic platform that integrates
          with Tropicash. Wire formats and timing are intentionally not specified here.
        </p>
        <div className="mt-4">
          <IntegrationsList />
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="blueprint-events-heading">
        <h2 id="blueprint-events-heading" className={sectionTitleClass}>
          Event Catalog
        </h2>
        <p className={sectionSubtitleClass}>
          Six planned event families. Final naming and payload schemas will be
          confirmed before any consumer depends on them.
        </p>
        <div className="mt-4">
          <EventCatalog />
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-bold text-slate-900 sm:text-base">
            Standard event envelope
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
            Uniform across families. The example below uses placeholder values — no real
            IDs, secrets, or PII appear here.
          </p>
          <div className="mt-3">
            <EventEnvelope exampleJson={exampleJson} />
          </div>
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="blueprint-idempotency-heading">
        <h2 id="blueprint-idempotency-heading" className={sectionTitleClass}>
          Idempotency Rules
        </h2>
        <p className={sectionSubtitleClass}>
          Every money-moving request must be safely retryable. Duplicate keys return the
          original result, not a new one.
        </p>
        <div className="mt-4">
          <IdempotencyRulesCard />
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="blueprint-environments-heading">
        <h2 id="blueprint-environments-heading" className={sectionTitleClass}>
          Sandbox vs Live
        </h2>
        <p className={sectionSubtitleClass}>
          Sandbox and live are strictly isolated. No cross-environment API key usage,
          ever. Sandbox never reaches the live wallet ledger, payout pipeline, or
          treasury bridge.
        </p>
        <div className="mt-4">
          <EnvironmentRulesCard />
        </div>
      </section>

      <section className={sectionCardClass} aria-labelledby="blueprint-safety-heading">
        <h2 id="blueprint-safety-heading" className={sectionTitleClass}>
          Non-negotiable Safety Rules
        </h2>
        <p className={sectionSubtitleClass}>
          Any change to the developer platform or Blue Atlantic integration layer must
          respect these.
        </p>
        <div className="mt-4">
          <SafetyRulesCard />
        </div>
      </section>

      <section
        className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:p-6 sm:text-[0.9375rem]"
        aria-labelledby="blueprint-status-heading"
      >
        <h2 id="blueprint-status-heading" className="text-base font-bold text-amber-900 sm:text-lg">
          Planning status
        </h2>
        <p className="mt-2">
          No internal APIs, service tokens, or signing secrets exist yet. This page is
          documentation only and is rendered from <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">lib/internalPlatformConfig.js</code>.
          See <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">docs/internal-service-blueprint.md</code> for the
          canonical narrative.
        </p>
      </section>
    </DevConsoleLayout>
  );
}
