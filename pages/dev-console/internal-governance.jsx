import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  BLUE_ATLANTIC_SERVICE_SEEDS,
  getServiceStatus,
  getServiceEnvironment,
  getRiskLevel,
} from "../../lib/internalServiceRegistryConfig";
import {
  INTERNAL_GOVERNANCE_PHASE,
  GOVERNANCE_LIFECYCLE_PATH,
  GOVERNANCE_POLICY_SEEDS,
  GOVERNANCE_GATE_SEEDS,
  GOVERNANCE_SAFETY_RULES,
  RUNTIME_POLICY_ENFORCEMENT_STATUSES,
  ENVIRONMENT_GATE_STATUSES,
  getEnforcementStatus,
  getGateStatus,
} from "../../lib/internalServiceGovernanceConfig";

const planningBannerClass =
  "flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:flex-row sm:items-start sm:gap-4 sm:p-6 sm:text-[0.9375rem]";

const serviceCardClass = "tropicash-surface flex flex-col rounded-2xl p-5 sm:p-6";
const sectionCardClass = "tropicash-surface rounded-2xl p-5 sm:p-6";

const sectionTitleClass = "text-base font-bold text-slate-900 sm:text-lg";
const sectionSubtitleClass =
  "mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]";

function LifecyclePath() {
  return (
    <section className={sectionCardClass} aria-labelledby="lifecycle-path-heading">
      <h2 id="lifecycle-path-heading" className={sectionTitleClass}>
        Lifecycle path
      </h2>
      <p className={sectionSubtitleClass}>
        The canonical states every integration travels through. Phase 2B seeds
        every service at <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">planning</code>{" "}
        and treats the rest as forward states that must be earned via reviews
        and gates.
      </p>
      <ol
        aria-label="Integration lifecycle steps"
        className="mt-4 flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto pb-2 sm:gap-3"
      >
        {GOVERNANCE_LIFECYCLE_PATH.map((step, idx) => {
          const isLast = idx === GOVERNANCE_LIFECYCLE_PATH.length - 1;
          return (
            <li
              key={step.key}
              className="flex shrink-0 snap-start items-stretch"
            >
              <div
                className="flex w-44 flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/80 p-3 sm:w-52"
                style={{ borderLeft: `4px solid ${step.accent}` }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                    Step {idx + 1}
                  </span>
                  {step.terminal ? (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-slate-600">
                      Terminal
                    </span>
                  ) : null}
                </div>
                <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
                  {step.key}
                </code>
                <span className="text-xs font-semibold text-slate-800">
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

function PolicyRow({ policy }) {
  const risk = getRiskLevel(policy.riskLevel);
  const enforcement = getEnforcementStatus(policy.enforcementStatus);
  const valueJson = JSON.stringify(policy.policyValue);
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/80 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
          {policy.policyKey}
        </code>
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${risk.badgeClass}`}
            title={risk.description}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${risk.dotClass}`}
              aria-hidden
            />
            {risk.label}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${enforcement.badgeClass}`}
            title={enforcement.description}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${enforcement.dotClass}`}
              aria-hidden
            />
            {enforcement.label}
          </span>
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-800 sm:text-[0.8125rem]">
        {policy.policyLabel}
      </span>
      <span className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
        {policy.description}
      </span>
      <code className="break-all rounded-md bg-slate-900/95 px-2 py-1.5 font-mono text-[0.7rem] text-slate-100 sm:text-[0.75rem]">
        {valueJson}
      </code>
    </li>
  );
}

function GateRow({ gate }) {
  const status = getGateStatus(gate.gateStatus);
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/80 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
          {gate.gateKey}
        </code>
        <div className="flex flex-wrap items-center gap-1.5">
          {gate.requiredForLive ? (
            <span className="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-orange-900">
              Required for live
            </span>
          ) : null}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${status.badgeClass}`}
            title={status.description}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${status.dotClass}`}
              aria-hidden
            />
            {status.label}
          </span>
        </div>
      </div>
      <span className="text-xs font-semibold text-slate-800 sm:text-[0.8125rem]">
        {gate.gateLabel}
      </span>
      <span className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
        {gate.description}
      </span>
    </li>
  );
}

function ServiceGovernanceCard({ service }) {
  const policies = GOVERNANCE_POLICY_SEEDS[service.serviceKey] ?? [];
  const sandboxGates = GOVERNANCE_GATE_SEEDS.sandbox;
  const liveGates = GOVERNANCE_GATE_SEEDS.live;
  const status = getServiceStatus(service.status);
  const environment = getServiceEnvironment(service.environment);

  const liveBlockedCount = liveGates.filter(
    (g) => g.gateStatus !== "passed" && g.gateStatus !== "waived",
  ).length;

  return (
    <article
      className={serviceCardClass}
      aria-labelledby={`gov-${service.serviceKey}-heading`}
    >
      <div
        className="mb-4 h-1 w-12 shrink-0 rounded-full"
        style={{ background: service.accent }}
        aria-hidden
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-2xl leading-none">
              {service.icon}
            </span>
            <h2
              id={`gov-${service.serviceKey}-heading`}
              className="text-lg font-bold text-slate-900 sm:text-xl"
            >
              {service.serviceName}
            </h2>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 sm:text-sm">
            <span>
              Service key:{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.75rem] text-slate-800">
                {service.serviceKey}
              </code>
            </span>
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
            <span>
              Platform:{" "}
              <span className="font-semibold text-slate-800">
                {service.platform}
              </span>
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide ${environment.badgeClass}`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${environment.dotClass}`}
              aria-hidden
            />
            Env: {environment.label}
          </span>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide ${status.badgeClass}`}
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${status.dotClass}`}
              aria-hidden
            />
            {status.label}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 sm:text-base">
            Runtime policies
          </h3>
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
            {policies.length} planned · sandbox
          </span>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {policies.map((p) => (
            <PolicyRow key={p.policyKey} policy={p} />
          ))}
        </ul>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
              Sandbox gates
            </h3>
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-700">
              All passed
            </span>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-2">
            {sandboxGates.map((g) => (
              <GateRow key={`sb-${g.gateKey}`} gate={g} />
            ))}
          </ul>
        </div>
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
              Live gates
            </h3>
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-rose-700">
              {liveBlockedCount} blocking live
            </span>
          </div>
          <ul className="mt-3 grid grid-cols-1 gap-2">
            {liveGates.map((g) => (
              <GateRow key={`lv-${g.gateKey}`} gate={g} />
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-950 sm:p-5 sm:text-[0.8125rem]">
        <strong className="font-semibold text-amber-900">
          Safety summary:
        </strong>{" "}
        {service.serviceName} is in <strong>{status.label.toLowerCase()}</strong>{" "}
        in <strong>{environment.label.toLowerCase()}</strong>. {policies.length}{" "}
        runtime policies are seeded as <code className="rounded bg-amber-100 px-1 py-0.5 font-mono">planned</code>{" "}
        — none enforced. Live promotion requires{" "}
        {liveGates.filter((g) => g.requiredForLive).length} gates to pass; today{" "}
        {liveBlockedCount} of them are blocked.
      </div>
    </article>
  );
}

function LegendBlock({ heading, items }) {
  return (
    <section className={sectionCardClass} aria-labelledby={`legend-${heading.replace(/\s+/g, "-").toLowerCase()}-heading`}>
      <h2
        id={`legend-${heading.replace(/\s+/g, "-").toLowerCase()}-heading`}
        className={sectionTitleClass}
      >
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
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${item.dotClass}`}
                aria-hidden
              />
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

function GovernanceRules() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="governance-rules-heading"
    >
      <h2 id="governance-rules-heading" className={sectionTitleClass}>
        Governance safety rules
      </h2>
      <p className={sectionSubtitleClass}>
        Phase 2B operational rules — narrow the existing Phase 1.75 platform
        safety rules into integration-lifecycle checks.
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        {GOVERNANCE_SAFETY_RULES.map((rule, idx) => (
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

export default function InternalGovernancePage() {
  return (
    <DevConsoleLayout
      title="Integration Governance"
      subtitle="Lifecycle reviews, runtime policies, and environment gates that gate every Blue Atlantic integration. Phase 2B is documentation + schema — no enforcement code path exists yet."
    >
      <div className={planningBannerClass}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"
          aria-hidden
        >
          🛡️
        </span>
        <div className="min-w-0">
          <strong className="block font-semibold text-amber-900">
            Planning only — no enforcement.
          </strong>
          <span className="block">
            Phase{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {INTERNAL_GOVERNANCE_PHASE}
            </code>
            . Schema lives in{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              supabase/sql/internal_service_governance_phase2b.sql
            </code>
            . Every policy is seeded as{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              planned
            </code>{" "}
            until a real enforcement code path lands.
          </span>
        </div>
      </div>

      <LifecyclePath />

      <section
        className="flex flex-col gap-5 sm:gap-6"
        aria-labelledby="services-governance-heading"
      >
        <h2 id="services-governance-heading" className="sr-only">
          Per-service governance plan
        </h2>
        {BLUE_ATLANTIC_SERVICE_SEEDS.map((service) => (
          <ServiceGovernanceCard key={service.serviceKey} service={service} />
        ))}
      </section>

      <LegendBlock
        heading="Enforcement status legend"
        items={RUNTIME_POLICY_ENFORCEMENT_STATUSES}
      />

      <LegendBlock
        heading="Environment gate status legend"
        items={ENVIRONMENT_GATE_STATUSES}
      />

      <GovernanceRules />

      <section
        className={sectionCardClass}
        aria-labelledby="capability-registry-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-xl"
          >
            ⚙️
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="capability-registry-heading"
              className={sectionTitleClass}
            >
              Capability Registry
            </h2>
            <p className={sectionSubtitleClass}>
              Phase 2C defines reusable capability definitions, dependencies,
              and operational constraints that future runtime policies will
              reference. The governance layer here promotes capabilities and
              policies; the registry is where those definitions live.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-[0.8125rem]">
              Execution orchestration and runtime decision flow are modeled
              separately in Phase 2D — see{" "}
              <Link
                href="/dev-console/orchestration"
                className="font-semibold text-blue-700 hover:underline"
              >
                Execution Orchestration
              </Link>
              .
            </p>
            <Link
              href="/dev-console/capabilities"
              className="mt-3 inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Open Capability Registry →
            </Link>
          </div>
        </div>
      </section>

      <section
        className={sectionCardClass}
        aria-labelledby="governance-cross-refs-heading"
      >
        <h2
          id="governance-cross-refs-heading"
          className={sectionTitleClass}
        >
          Related views
        </h2>
        <p className={sectionSubtitleClass}>
          Governance composes with the Phase 1.75 blueprint, the Phase 2A
          registry, the Phase 2C capability model, the Phase 2D orchestration
          blueprint, Phase 2E observability, and Phase 2F runtime state — start
          there for higher-level context.
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
              href="/dev-console/runtime-state"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Runtime State &amp; Event Store →
            </Link>
          </li>
        </ul>
      </section>
    </DevConsoleLayout>
  );
}
