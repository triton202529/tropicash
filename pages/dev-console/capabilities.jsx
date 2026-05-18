import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  INTERNAL_CAPABILITY_PHASE,
  INTERNAL_CAPABILITY_CATEGORIES,
  INTERNAL_CAPABILITY_RISK_LEVELS,
  INTERNAL_CAPABILITY_LIFECYCLE_STATUSES,
  INTERNAL_DEPENDENCY_TYPES,
  INTERNAL_CONSTRAINT_ENFORCEMENT_STATUSES,
  INTERNAL_CAPABILITY_SEEDS,
  INTERNAL_DEPENDENCY_SEEDS,
  INTERNAL_CONSTRAINT_SEEDS,
  INTERNAL_CAPABILITY_SAFETY_RULES,
  getCapabilityCategory,
  getCapabilityRiskLevel,
  getCapabilityLifecycleStatus,
  getDependencyType,
  getConstraintEnforcementStatus,
  getCapabilityDependencies,
  getCapabilityConstraints,
} from "../../lib/internalCapabilityConfig";
import { RUNTIME_POLICY_GRAPH_PHASE } from "../../lib/runtimePolicyGraphConfig";

const planningBannerClass =
  "flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:flex-row sm:items-start sm:gap-4 sm:p-6 sm:text-[0.9375rem]";

const sectionCardClass = "tropicash-surface rounded-2xl p-5 sm:p-6";
const capabilityCardClass =
  "tropicash-surface flex flex-col rounded-2xl p-4 sm:p-5";

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

function RiskBadge({ riskKey }) {
  const r = getCapabilityRiskLevel(riskKey);
  return (
    <Pill className={r.badgeClass} title={r.description}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${r.dotClass}`} aria-hidden />
      Risk: {r.label}
    </Pill>
  );
}

function LifecycleBadge({ statusKey }) {
  const s = getCapabilityLifecycleStatus(statusKey);
  return (
    <Pill className={s.badgeClass} title={s.description}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dotClass}`} aria-hidden />
      {s.label}
    </Pill>
  );
}

function DependencyTypeBadge({ typeKey }) {
  const t = getDependencyType(typeKey);
  return (
    <Pill className={t.badgeClass} title={t.description}>
      {t.label}
    </Pill>
  );
}

function EnforcementBadge({ statusKey }) {
  const e = getConstraintEnforcementStatus(statusKey);
  return (
    <Pill className={e.badgeClass} title={e.description}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${e.dotClass}`} aria-hidden />
      {e.label}
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

function SandboxLiveSupport({ supportsSandbox, supportsLive }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill
        className={
          supportsSandbox
            ? "border border-sky-200 bg-sky-50 text-sky-800"
            : "border border-slate-200 bg-slate-50 text-slate-500"
        }
      >
        {supportsSandbox ? "Sandbox: yes" : "Sandbox: no"}
      </Pill>
      <Pill
        className={
          supportsLive
            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border border-slate-200 bg-slate-50 text-slate-500"
        }
      >
        {supportsLive ? "Live: yes" : "Live: no"}
      </Pill>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section: Capability categories
// ---------------------------------------------------------------------------
function CapabilityCategoriesSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="capability-categories-heading"
    >
      <h2 id="capability-categories-heading" className={sectionTitleClass}>
        Capability categories
      </h2>
      <p className={sectionSubtitleClass}>
        Capabilities are grouped into stable categories so future runtime
        policies and permissions can target a whole class of behaviors. Counts
        are based on the Phase 2C seeds.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INTERNAL_CAPABILITY_CATEGORIES.map((cat) => {
          const count = INTERNAL_CAPABILITY_SEEDS.filter(
            (c) => c.category === cat.key,
          ).length;
          return (
            <li
              key={cat.key}
              className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/80 p-3"
              style={{ borderLeft: `4px solid ${cat.accent}` }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span aria-hidden className="text-lg leading-none">
                    {cat.icon}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {cat.label}
                  </span>
                </div>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-700">
                  {count} {count === 1 ? "capability" : "capabilities"}
                </span>
              </div>
              <code className="font-mono text-[0.75rem] text-slate-700">
                {cat.key}
              </code>
              <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                {cat.description}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Capability cards (grouped by category)
// ---------------------------------------------------------------------------
function CapabilityCard({ capability }) {
  const category = getCapabilityCategory(capability.category);
  const deps = getCapabilityDependencies(capability.capabilityKey);
  const constraints = getCapabilityConstraints(capability.capabilityKey);

  return (
    <article
      className={capabilityCardClass}
      aria-labelledby={`cap-${slug(capability.capabilityKey)}-heading`}
    >
      <div
        className="mb-3 h-1 w-10 shrink-0 rounded-full"
        style={{ background: category?.accent ?? "#0ea5e9" }}
        aria-hidden
      />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <code
            id={`cap-${slug(capability.capabilityKey)}-heading`}
            className="block font-mono text-sm font-bold text-slate-900 sm:text-[0.9375rem]"
          >
            {capability.capabilityKey}
          </code>
          <span className="mt-0.5 block text-xs font-semibold text-slate-700 sm:text-[0.8125rem]">
            {capability.capabilityLabel}
          </span>
        </div>
        {category ? (
          <Pill
            className="border border-slate-200 bg-white/90 text-slate-800"
            title={category.description}
          >
            <span aria-hidden>{category.icon}</span>
            {category.label}
          </Pill>
        ) : null}
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
        {capability.description}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <RiskBadge riskKey={capability.riskLevel} />
        <LifecycleBadge statusKey={capability.lifecycleStatus} />
      </div>

      <div className="mt-3">
        <SandboxLiveSupport
          supportsSandbox={capability.supportsSandbox}
          supportsLive={capability.supportsLive}
        />
      </div>

      {deps.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-[0.7rem] font-bold uppercase tracking-wide text-slate-500">
            Dependencies
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {deps.map((dep) => (
              <li
                key={`${dep.dependencyKey}-${dep.dependencyType}`}
                className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5"
              >
                <DependencyTypeBadge typeKey={dep.dependencyType} />
                <code className="font-mono text-[0.75rem] text-slate-800">
                  {dep.dependencyKey}
                </code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {constraints.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-[0.7rem] font-bold uppercase tracking-wide text-slate-500">
            Constraints
          </h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {constraints.map((c) => (
              <li
                key={`${c.constraintKey}-${c.environment}`}
                className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <code className="font-mono text-[0.75rem] font-semibold text-slate-900">
                    {c.constraintKey}
                  </code>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <EnvironmentChip environment={c.environment} />
                    <EnforcementBadge statusKey={c.enforcementStatus} />
                  </div>
                </div>
                <code className="break-all rounded-md bg-slate-900/95 px-2 py-1 font-mono text-[0.7rem] text-slate-100">
                  {JSON.stringify(c.constraintValue)}
                </code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

function CapabilitiesByCategorySection() {
  const grouped = INTERNAL_CAPABILITY_CATEGORIES.map((cat) => ({
    category: cat,
    capabilities: INTERNAL_CAPABILITY_SEEDS.filter(
      (c) => c.category === cat.key,
    ),
  })).filter((g) => g.capabilities.length > 0);

  return (
    <section
      className="flex flex-col gap-4 sm:gap-5"
      aria-labelledby="capability-cards-heading"
    >
      <div className={sectionCardClass}>
        <h2 id="capability-cards-heading" className={sectionTitleClass}>
          Capabilities
        </h2>
        <p className={sectionSubtitleClass}>
          Each card is the design-time definition of a capability. Phase 2C
          delivers the <strong>definition</strong>; sandbox readiness and live
          readiness are promoted separately via Phase 2B governance.
        </p>
      </div>

      {grouped.map(({ category, capabilities }) => (
        <div key={category.key} className={sectionCardClass}>
          <header className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-xl leading-none">
                {category.icon}
              </span>
              <h3 className="text-base font-bold text-slate-900 sm:text-lg">
                {category.label}
              </h3>
            </div>
            <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
              {capabilities.length}{" "}
              {capabilities.length === 1 ? "capability" : "capabilities"}
            </span>
          </header>
          <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
            {category.description}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {capabilities.map((cap) => (
              <CapabilityCard key={cap.capabilityKey} capability={cap} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Dependency graph (flat list view)
// ---------------------------------------------------------------------------
function DependencyGraphSection() {
  const dependents = Array.from(
    new Set(INTERNAL_DEPENDENCY_SEEDS.map((d) => d.capabilityKey)),
  );

  return (
    <section
      className={sectionCardClass}
      aria-labelledby="dependency-graph-heading"
    >
      <h2 id="dependency-graph-heading" className={sectionTitleClass}>
        Dependency relationships
      </h2>
      <p className={sectionSubtitleClass}>
        A flat view of every seeded dependency. <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">requires</code>{" "}
        is a hard prerequisite,{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">blocks_without</code>{" "}
        blocks the call when missing, and{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">audit_requires</code>{" "}
        mandates downstream audit coverage.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {dependents.map((capKey) => {
          const deps = INTERNAL_DEPENDENCY_SEEDS.filter(
            (d) => d.capabilityKey === capKey,
          );
          return (
            <div
              key={capKey}
              className="rounded-xl border border-slate-200 bg-white/80 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
                  {capKey}
                </code>
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  {deps.length} {deps.length === 1 ? "dependency" : "dependencies"}
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-1.5">
                {deps.map((dep) => (
                  <li
                    key={`${capKey}-${dep.dependencyKey}-${dep.dependencyType}`}
                    className="flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1.5 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <DependencyTypeBadge typeKey={dep.dependencyType} />
                    <code className="font-mono text-[0.75rem] text-slate-900">
                      {dep.dependencyKey}
                    </code>
                    {dep.description ? (
                      <span className="text-xs leading-relaxed text-slate-600 sm:flex-1 sm:text-[0.8125rem]">
                        {dep.description}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Operational constraints (per-capability, per-environment)
// ---------------------------------------------------------------------------
function OperationalConstraintsSection() {
  const constrained = Array.from(
    new Set(INTERNAL_CONSTRAINT_SEEDS.map((c) => c.capabilityKey)),
  );

  return (
    <section
      className={sectionCardClass}
      aria-labelledby="operational-constraints-heading"
    >
      <h2 id="operational-constraints-heading" className={sectionTitleClass}>
        Operational constraints
      </h2>
      <p className={sectionSubtitleClass}>
        Per-environment policy values that future runtime enforcement will
        check against. All Phase 2C seeds are{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          planned
        </code>{" "}
        — none block calls today.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        {constrained.map((capKey) => {
          const rows = INTERNAL_CONSTRAINT_SEEDS.filter(
            (c) => c.capabilityKey === capKey,
          );
          return (
            <div
              key={capKey}
              className="rounded-xl border border-slate-200 bg-white/80 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
                  {capKey}
                </code>
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  {rows.length} {rows.length === 1 ? "constraint" : "constraints"}
                </span>
              </div>
              <ul className="mt-2 grid grid-cols-1 gap-2 lg:grid-cols-2">
                {rows.map((c) => (
                  <li
                    key={`${capKey}-${c.constraintKey}-${c.environment}`}
                    className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50/60 p-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <code className="font-mono text-[0.75rem] font-semibold text-slate-900">
                        {c.constraintKey}
                      </code>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <EnvironmentChip environment={c.environment} />
                        <RiskBadge riskKey={c.riskLevel} />
                        <EnforcementBadge statusKey={c.enforcementStatus} />
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-800 sm:text-[0.8125rem]">
                      {c.constraintLabel}
                    </span>
                    {c.description ? (
                      <span className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                        {c.description}
                      </span>
                    ) : null}
                    <code className="break-all rounded-md bg-slate-900/95 px-2 py-1 font-mono text-[0.7rem] text-slate-100">
                      {JSON.stringify(c.constraintValue)}
                    </code>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Environment compatibility summary
// ---------------------------------------------------------------------------
function EnvironmentCompatibilitySection() {
  const sandboxCount = INTERNAL_CAPABILITY_SEEDS.filter(
    (c) => c.supportsSandbox,
  ).length;
  const liveCount = INTERNAL_CAPABILITY_SEEDS.filter(
    (c) => c.supportsLive,
  ).length;
  const total = INTERNAL_CAPABILITY_SEEDS.length;

  return (
    <section
      className={sectionCardClass}
      aria-labelledby="environment-compatibility-heading"
    >
      <h2
        id="environment-compatibility-heading"
        className={sectionTitleClass}
      >
        Environment compatibility
      </h2>
      <p className={sectionSubtitleClass}>
        Design-time intent only. <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">supports_sandbox</code>{" "}
        and{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
          supports_live
        </code>{" "}
        flag the eligible environments — live promotion still goes through
        Phase 2B governance review.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <li
          className="flex flex-col gap-1 rounded-xl border border-sky-200 bg-sky-50 p-3"
          aria-label="Sandbox compatibility"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-sky-900">Sandbox</span>
            <span className="font-mono text-base font-bold text-sky-900">
              {sandboxCount} / {total}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-sky-900 sm:text-[0.8125rem]">
            Capabilities eligible to run in sandbox once an enforcement path is
            shipped.
          </p>
        </li>
        <li
          className="flex flex-col gap-1 rounded-xl border border-emerald-200 bg-emerald-50 p-3"
          aria-label="Live compatibility"
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold text-emerald-900">
              Live
            </span>
            <span className="font-mono text-base font-bold text-emerald-900">
              {liveCount} / {total}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-emerald-900 sm:text-[0.8125rem]">
            Capabilities currently approved for live. Phase 2C seeds this at
            zero — promotion requires Phase 2B governance review.
          </p>
        </li>
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Section: Legends
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
// Section: Safety rules
// ---------------------------------------------------------------------------
function SafetyRulesSection() {
  return (
    <section
      className={sectionCardClass}
      aria-labelledby="capability-safety-rules-heading"
    >
      <h2
        id="capability-safety-rules-heading"
        className={sectionTitleClass}
      >
        Capability safety rules
      </h2>
      <p className={sectionSubtitleClass}>
        Phase 2C rules — narrow the existing Phase 1.75 platform safety rules
        into capability-definition checks.
      </p>
      <ol className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
        {INTERNAL_CAPABILITY_SAFETY_RULES.map((rule, idx) => (
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
export default function CapabilitiesPage() {
  return (
    <DevConsoleLayout
      title="Capability Registry"
      subtitle="Reusable capability definitions, dependency relationships, and per-environment operational constraints that future runtime policies and APIs will reference. Phase 2C is documentation + schema — no enforcement code path exists yet."
    >
      <div className={planningBannerClass}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"
          aria-hidden
        >
          ⚙️
        </span>
        <div className="min-w-0">
          <strong className="block font-semibold text-amber-900">
            Planning only — no enforcement.
          </strong>
          <span className="block">
            Phase{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {INTERNAL_CAPABILITY_PHASE}
            </code>
            . Schema lives in{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              supabase/sql/internal_capability_registry_phase2c.sql
            </code>
            . Every constraint is seeded as{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              planned
            </code>{" "}
            and every capability ships with{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              supports_live = false
            </code>
            .
          </span>
        </div>
      </div>

      <CapabilityCategoriesSection />

      <CapabilitiesByCategorySection />

      <DependencyGraphSection />

      <OperationalConstraintsSection />

      <EnvironmentCompatibilitySection />

      <LegendBlock
        heading="Risk-level legend"
        items={INTERNAL_CAPABILITY_RISK_LEVELS}
      />

      <LegendBlock
        heading="Lifecycle status legend"
        items={INTERNAL_CAPABILITY_LIFECYCLE_STATUSES}
      />

      <LegendBlock
        heading="Dependency type legend"
        items={INTERNAL_DEPENDENCY_TYPES}
      />

      <LegendBlock
        heading="Enforcement status legend"
        items={INTERNAL_CONSTRAINT_ENFORCEMENT_STATUSES}
      />

      <SafetyRulesSection />

      <section
        className={sectionCardClass}
        aria-labelledby="execution-orchestration-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-xl"
          >
            🧠
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="execution-orchestration-heading"
              className={sectionTitleClass}
            >
              Execution Orchestration
            </h2>
            <p className={sectionSubtitleClass}>
              Phase 2D defines how future runtime requests flow through
              identity, environment, capability, dependency, policy, fraud,
              audit, and authorization stages. Each capability defined here
              maps to a Phase 2D trace template that names the decision points
              and terminal states.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-[0.8125rem]">
              Runtime telemetry and replay planning are modeled separately in
              Phase 2E — see{" "}
              <Link
                href="/dev-console/observability"
                className="font-semibold text-blue-700 hover:underline"
              >
                Observability &amp; Runtime Telemetry
              </Link>
              .
            </p>
            <Link
              href="/dev-console/orchestration"
              className="mt-3 inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Open Execution Orchestration →
            </Link>
          </div>
        </div>
      </section>

      <section
        className={sectionCardClass}
        aria-labelledby="policy-graphs-promo-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
          <span
            aria-hidden
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-xl"
          >
            🕸️
          </span>
          <div className="min-w-0 flex-1">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-sky-800">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />
              Phase 3D
            </span>
            <h2
              id="policy-graphs-promo-heading"
              className={sectionTitleClass}
            >
              Policy graphs
            </h2>
            <p className={sectionSubtitleClass}>
              Visualize the same capability and dependency seeds as grouped static graphs — capability bridges,
              constraints, and internal service correlation — next to Phase 3B rule pressure views.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-[0.8125rem]">
              Phase marker: <code className="rounded bg-slate-100 px-1 font-mono">{RUNTIME_POLICY_GRAPH_PHASE}</code>
            </p>
            <Link
              href="/dev-console/policy-graphs"
              className="mt-3 inline-flex items-center rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-slate-50 hover:underline"
            >
              Open Policy Graphs →
            </Link>
          </div>
        </div>
      </section>

      <section
        className={sectionCardClass}
        aria-labelledby="capability-cross-refs-heading"
      >
        <h2
          id="capability-cross-refs-heading"
          className={sectionTitleClass}
        >
          Related views
        </h2>
        <p className={sectionSubtitleClass}>
          The capability registry composes with the Phase 1.75 blueprint, the
          Phase 2A service registry, the Phase 2B governance layer, the Phase
          2D execution orchestration blueprint, and the Phase 2E observability
          blueprint.
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
