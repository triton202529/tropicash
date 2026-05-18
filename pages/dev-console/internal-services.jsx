import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  INTERNAL_SERVICE_REGISTRY_PHASE,
  INTERNAL_PERMISSION_RISK_LEVELS,
  BLUE_ATLANTIC_SERVICE_SEEDS,
  INTERNAL_PERMISSION_SEEDS,
  getServiceStatus,
  getServiceEnvironment,
  getRiskLevel,
} from "../../lib/internalServiceRegistryConfig";

const planningBannerClass =
  "flex flex-col gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:flex-row sm:items-start sm:gap-4 sm:p-6 sm:text-[0.9375rem]";

const serviceCardClass =
  "tropicash-surface flex flex-col rounded-2xl p-5 sm:p-6";

function ServiceCard({ service }) {
  const permissions = INTERNAL_PERMISSION_SEEDS[service.serviceKey] ?? [];
  const status = getServiceStatus(service.status);
  const environment = getServiceEnvironment(service.environment);

  return (
    <article className={serviceCardClass} aria-labelledby={`svc-${service.serviceKey}-heading`}>
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
              id={`svc-${service.serviceKey}-heading`}
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
              <span className="font-semibold text-slate-800">{service.platform}</span>
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

      <p className="mt-4 text-sm leading-relaxed text-slate-700 sm:text-[0.9375rem]">
        {service.description}
      </p>

      {service.ownerLabel ? (
        <p className="mt-2 text-xs font-medium text-slate-500 sm:text-sm">
          Owner: <span className="font-semibold text-slate-700">{service.ownerLabel}</span>
        </p>
      ) : null}

      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 sm:text-base">
            Planned permissions
          </h3>
          <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
            {permissions.length} planned
          </span>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
          {permissions.map((p) => {
            const risk = getRiskLevel(p.riskLevel);
            return (
              <li
                key={p.permissionKey}
                className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/80 p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <code className="font-mono text-[0.8125rem] font-semibold text-slate-900">
                    {p.permissionKey}
                  </code>
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
                </div>
                <p className="text-xs leading-relaxed text-slate-600 sm:text-[0.8125rem]">
                  <span className="font-semibold text-slate-800">
                    {p.permissionLabel}
                  </span>{" "}
                  — {p.description}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

function RiskLegend() {
  return (
    <section
      className="tropicash-surface rounded-2xl p-5 sm:p-6"
      aria-labelledby="risk-legend-heading"
    >
      <h2
        id="risk-legend-heading"
        className="text-base font-bold text-slate-900 sm:text-lg"
      >
        Permission risk legend
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
        Permissions classified <strong>high</strong> or <strong>critical</strong>{" "}
        require explicit approval and elevated audit before an integration can be
        promoted out of <em>planning</em>.
      </p>
      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {INTERNAL_PERMISSION_RISK_LEVELS.map((risk) => (
          <li
            key={risk.key}
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/80 p-3"
          >
            <span
              className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${risk.badgeClass}`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${risk.dotClass}`}
                aria-hidden
              />
              {risk.label}
            </span>
            <p className="text-xs leading-relaxed text-slate-700 sm:text-[0.8125rem]">
              {risk.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function InternalServicesPage() {
  return (
    <DevConsoleLayout
      title="Internal Service Registry"
      subtitle="Planning registry for internal Blue Atlantic platform integrations. No real calls are made — this view is rendered entirely from config."
    >
      <div className={planningBannerClass}>
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-900"
          aria-hidden
        >
          🗂️
        </span>
        <div className="min-w-0">
          <strong className="block font-semibold text-amber-900">
            Planning only — no execution.
          </strong>
          <span className="block">
            Phase{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              {INTERNAL_SERVICE_REGISTRY_PHASE}
            </code>
            . Schema lives in{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[0.75rem]">
              supabase/sql/internal_service_registry_phase2a.sql
            </code>
            . No API routes, service tokens, or money movement.
          </span>
        </div>
      </div>

      <section
        className="tropicash-surface flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6"
        aria-labelledby="services-governance-card-heading"
      >
        <div className="min-w-0">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-sky-800">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />
            Phase 2B
          </span>
          <h2
            id="services-governance-card-heading"
            className="mt-2 text-base font-bold text-slate-900 sm:text-lg"
          >
            Integration Governance
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
            Phase 2B defines lifecycle reviews, runtime policies, environment
            gates, and approval controls layered on top of this registry.
            Schema lives in{" "}
            <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">
              supabase/sql/internal_service_governance_phase2b.sql
            </code>
            .
          </p>
        </div>
        <Link
          href="/dev-console/internal-governance"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          Open governance →
        </Link>
      </section>

      <section
        aria-labelledby="services-heading"
        className="flex flex-col gap-5 sm:gap-6"
      >
        <h2 id="services-heading" className="sr-only">
          Seeded internal service integrations
        </h2>
        {BLUE_ATLANTIC_SERVICE_SEEDS.map((service) => (
          <ServiceCard key={service.serviceKey} service={service} />
        ))}
      </section>

      <RiskLegend />

      <section
        className="tropicash-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="registry-rules-heading"
      >
        <h2
          id="registry-rules-heading"
          className="text-base font-bold text-slate-900 sm:text-lg"
        >
          Registry rules
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 sm:text-[0.9375rem]">
          <li>
            Every integration begins in <strong>planning</strong>. Promotion to{" "}
            <strong>active</strong> requires explicit approval and a working
            internal auth model (Phase 2B+).
          </li>
          <li>
            Sandbox and live are strictly isolated. No cross-environment usage,
            ever.
          </li>
          <li>
            Permissions marked <strong>high</strong> or <strong>critical</strong>{" "}
            require idempotency keys, audit logging, and fraud review on every
            invocation.
          </li>
          <li>
            All registry tables are admin-only via RLS. The Developer Console
            never queries them anonymously.
          </li>
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-slate-500 sm:text-sm">
          For the narrative version, see{" "}
          <Link
            href="/dev-console/internal-blueprint"
            className="font-semibold text-blue-700 hover:underline"
          >
            Internal Platform Blueprint
          </Link>
          .
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
          Capabilities and constraints are managed separately in Phase 2C —
          see the{" "}
          <Link
            href="/dev-console/capabilities"
            className="font-semibold text-blue-700 hover:underline"
          >
            Capability Registry
          </Link>
          .
        </p>
      </section>

      <section
        className="tropicash-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="registry-cross-refs-heading"
      >
        <h2
          id="registry-cross-refs-heading"
          className="text-base font-bold text-slate-900 sm:text-lg"
        >
          Related views
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
          The registry is the identity layer that every later phase composes
          with — governance (2B), capabilities (2C), orchestration (2D),
          observability (2E), and runtime state (2F).
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
