import Link from "next/link";
import { useMemo } from "react";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  PRODUCT_ACCESS_ENVIRONMENTS,
  PRODUCT_ACCESS_GOVERNANCE_RULES,
  PRODUCT_ACCESS_PHASE,
  PRODUCT_ACCESS_PRODUCTS,
  PRODUCT_ACCESS_READINESS_CHECKS,
  PRODUCT_ACCESS_RECOMMENDATIONS,
  PRODUCT_ACCESS_RESTRICTIONS,
  PRODUCT_ACCESS_SAFETY_RULES,
  PRODUCT_ACCESS_SCOPES,
  PRODUCT_ACCESS_STATES,
  PRODUCT_ACCESS_USAGE_ENVELOPES,
  buildCapabilityProductMap,
  buildProductAccessReadiness,
  buildProductAccessSummary,
  buildProductRestrictionSummary,
  buildProductRiskSummary,
  getProductAccessOverview,
  getProductRestrictions,
  getProductScopeMeta,
} from "../../lib/developerProductAccessConfig";
import {
  PRODUCT_ENTITLEMENT_STATES,
  PRODUCT_GOVERNANCE_PHASE,
  PRODUCT_GOVERNANCE_SAFETY_RULES,
  PRODUCT_REVIEW_OUTCOMES,
  PRODUCT_VISIBILITY_RULES,
  buildProductGovernanceRiskSummary,
  buildProductGovernanceSummary,
  buildProductReviewReadiness,
  buildProductVisibilitySummary,
  getProductAccessRationales,
  getProductAccessRevocationModels,
  getProductEntitlementHistory,
  getProductEntitlementPreview,
  getProductGovernanceOverview,
} from "../../lib/developerProductGovernanceConfig";

const sectionClass = "tropicash-surface rounded-2xl p-5 sm:p-6";
const titleClass = "text-lg font-bold text-slate-900";
const subClass = "mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]";

function Pill({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-700 ${className}`}
    >
      {children}
    </span>
  );
}

function RiskBadge({ level }) {
  const map = {
    low: "border-slate-200 bg-slate-50 text-slate-800",
    medium: "border-sky-200 bg-sky-50 text-sky-900",
    high: "border-amber-200 bg-amber-50 text-amber-950",
    critical: "border-rose-200 bg-rose-50 text-rose-900",
  };
  const cls = map[level] || map.medium;
  return <Pill className={cls}>{level}</Pill>;
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-slate-600">{hint}</p> : null}
    </div>
  );
}

function CheckPill({ passed, blocking }) {
  if (!passed && blocking) {
    return <Pill className="border-rose-200 bg-rose-50 text-rose-800">blocking</Pill>;
  }
  if (passed) {
    return <Pill className="border-emerald-200 bg-emerald-50 text-emerald-800">passed</Pill>;
  }
  return <Pill className="border-amber-200 bg-amber-50 text-amber-900">open</Pill>;
}

export default function DevConsoleProductAccessPage() {
  const overview = useMemo(() => getProductAccessOverview(), []);
  const governanceOverview = useMemo(() => getProductGovernanceOverview(), []);
  const accessSummary = useMemo(() => buildProductAccessSummary(), []);
  const governanceSummary = useMemo(() => buildProductGovernanceSummary(), []);
  const readiness = useMemo(() => buildProductAccessReadiness(), []);
  const governanceReadiness = useMemo(() => buildProductReviewReadiness(), []);
  const restrictionSummary = useMemo(() => buildProductRestrictionSummary(), []);
  const visibilitySummary = useMemo(() => buildProductVisibilitySummary(), []);
  const riskSummary = useMemo(() => buildProductRiskSummary(), []);
  const governanceRiskSummary = useMemo(() => buildProductGovernanceRiskSummary(), []);
  const capabilityMap = useMemo(() => buildCapabilityProductMap(), []);
  const capabilityKeys = useMemo(() => Object.keys(capabilityMap).sort(), [capabilityMap]);
  const entitlementHistory = useMemo(() => getProductEntitlementHistory(), []);
  const accessRationales = useMemo(() => getProductAccessRationales(), []);
  const entitlementPreview = useMemo(() => getProductEntitlementPreview(), []);
  const revocationModels = useMemo(() => getProductAccessRevocationModels(), []);

  return (
    <DevConsoleLayout
      title="Sandbox Product Access"
      subtitle="Phase 9A + 9B — sandbox product access modeling and metadata-only product governance. Entitlement previews, visibility rules, review outcomes, and usage envelopes — no endpoints, credentials, execution, or money movement."
      environment="sandbox"
    >
      <div
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        <strong className="font-semibold">Metadata-only access previews.</strong> Sandbox only — preview only — metadata
        only — no execution — no endpoints — no live access. No real APIs, credentials, webhooks, workers, Supabase
        writes, or money movement exist in Phase 9A–9B. Rows are configuration seeds from{" "}
        <code className="break-all rounded bg-white/80 px-1 text-xs">lib/developerProductAccessConfig.js</code> (9A) and{" "}
        <code className="break-all rounded bg-white/80 px-1 text-xs">lib/developerProductGovernanceConfig.js</code> (9B).
      </div>

      <section className={sectionClass} aria-labelledby="pa-header">
        <h2 id="pa-header" className={titleClass}>
          1. Sandbox product access
        </h2>
        <p className={subClass}>{accessSummary}</p>
        <p className="mt-3">
          <Pill>{PRODUCT_ACCESS_PHASE}</Pill>
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Access state"
            value={overview.state?.label ?? overview.seed.access_state_key}
            hint={overview.state?.description}
          />
          <StatCard
            label="Readiness"
            value={`${readiness.percent}% (${readiness.passed_count}/${readiness.total_count})`}
            hint={readiness.label}
          />
          <StatCard
            label="Scope"
            value={overview.scope?.label ?? overview.seed.scope_key}
            hint={overview.scope?.description}
          />
          <StatCard
            label="Environment"
            value={overview.environment?.label ?? overview.seed.environment_key}
            hint={overview.environment?.description}
          />
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="pa-governance-bridge">
        <h2 id="pa-governance-bridge" className={titleClass}>
          2. Governance posture (9B bridge)
        </h2>
        <p className={subClass}>{governanceSummary}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-700">
          Entitlement states, visibility rules, and review outcomes below are sandbox only, metadata only, preview only —
          no endpoints, no execution, no live access.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Entitlement state"
            value={governanceOverview.state?.label ?? governanceOverview.seed.entitlement_state_key}
            hint={governanceOverview.state?.description}
          />
          <StatCard
            label="Review outcome"
            value={governanceOverview.review_outcome?.label ?? governanceOverview.seed.review_outcome_key}
            hint={governanceOverview.review_outcome?.description}
          />
          <StatCard
            label="Visibility rule"
            value={governanceOverview.visibility_rule?.label ?? governanceOverview.seed.visibility_rule_key}
            hint={governanceOverview.visibility_rule?.description}
          />
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="pa-summary">
        <h2 id="pa-summary" className={titleClass}>
          3. Product access summary
        </h2>
        <p className={subClass}>{restrictionSummary}</p>
        <p className="mt-3 text-sm text-slate-700">{riskSummary.summary}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(riskSummary.risk_counts).map(([level, count]) => (
            <span key={level} className="inline-flex items-center gap-1 text-sm text-slate-700">
              <RiskBadge level={level} /> {count}
            </span>
          ))}
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="pa-products">
        <h2 id="pa-products" className={titleClass}>
          4. Product catalog (access layer)
        </h2>
        <p className={subClass}>
          {PRODUCT_ACCESS_PRODUCTS.length} sandbox product access rows — sandbox only, preview only, no live execution.
        </p>
        <ul className="mt-4 grid gap-3 lg:grid-cols-2">
          {PRODUCT_ACCESS_PRODUCTS.map((product) => {
            const scope = getProductScopeMeta(product.access_scope);
            return (
              <li key={product.product_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{product.label}</span>
                  <RiskBadge level={product.risk_level} />
                  {product.placeholder ? <Pill>placeholder</Pill> : null}
                </div>
                <code className="mt-1 block text-xs text-slate-500">{product.product_key}</code>
                <p className="mt-2 text-sm text-slate-600">{product.description}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Sandbox {product.sandbox_status} · Live {product.live_status} · Scope {scope?.label ?? product.access_scope}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Capabilities: {product.required_capabilities.join(", ")}
                </p>
                {product.catalog_product_key ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Catalog cross-walk: <code>{product.catalog_product_key}</code>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="pa-cap-map">
        <h2 id="pa-cap-map" className={titleClass}>
          5. Capability → product mapping
        </h2>
        <p className={subClass}>
          Documentation bridge from Phase 2C capability keys — does not grant access. Assign capabilities on App
          Capabilities first.
        </p>
        <ul className="mt-4 space-y-3">
          {capabilityKeys.map((cap) => (
            <li key={cap} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <code className="text-sm font-semibold text-slate-900">{cap}</code>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {capabilityMap[cap].map((row) => (
                  <li key={row.product_key}>
                    {row.label} — <span className="text-xs">{row.product_key}</span> ({row.access_scope})
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="pa-scopes">
        <h2 id="pa-scopes" className={titleClass}>
          6. Access scope reference
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {PRODUCT_ACCESS_SCOPES.map((s) => (
            <li key={s.scope_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{s.label}</span>
                <Pill>{s.scope_key}</Pill>
                {s.live_enabled ? <Pill className="border-rose-200 text-rose-800">live</Pill> : <Pill>sandbox only</Pill>}
              </div>
              <p className="mt-2 text-sm text-slate-600">{s.description}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 text-sm font-bold text-slate-800">Access states</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {PRODUCT_ACCESS_STATES.map((st) => (
            <li key={st.state_key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-900">{st.label}</span>
              <p className="mt-1 text-slate-600">{st.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="pa-restrictions">
        <h2 id="pa-restrictions" className={titleClass}>
          7. Governance restrictions
        </h2>
        <p className={subClass}>{restrictionSummary}</p>
        <ul className="mt-4 space-y-3">
          {PRODUCT_ACCESS_RESTRICTIONS.map((r) => (
            <li key={r.restriction_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{r.label}</span>
                <Pill>{r.severity}</Pill>
              </div>
              <p className="mt-2 text-sm text-slate-600">{r.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                <strong>Developer:</strong> {r.developer_message}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                <strong>Operator:</strong> {r.operator_message}
              </p>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 text-sm font-bold text-slate-800">Governance rules</h3>
        <ul className="mt-3 space-y-2">
          {PRODUCT_ACCESS_GOVERNANCE_RULES.map((rule) => (
            <li key={rule.rule_key} className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm">
              <span className="font-semibold text-slate-900">{rule.label}</span> — {rule.description}
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="pa-envelopes">
        <h2 id="pa-envelopes" className={titleClass}>
          8. Sandbox usage envelopes
        </h2>
        <p className={subClass}>
          Deterministic limit labels — execution_status disabled on every envelope; no money movement.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {PRODUCT_ACCESS_USAGE_ENVELOPES.map((env) => (
            <li key={env.envelope_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <span className="font-semibold text-slate-900">{env.title}</span>
              <p className="mt-2 text-sm text-slate-600">{env.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                Limit: {env.sandbox_limit_label} · Execution: {env.execution_status} · Scope: {env.scope}
              </p>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 text-sm font-bold text-slate-800">Environments</h3>
        <ul className="mt-2 space-y-2">
          {PRODUCT_ACCESS_ENVIRONMENTS.map((e) => (
            <li key={e.environment_key} className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm">
              <span className="font-semibold text-slate-900">{e.label}</span> — {e.description}
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="pa-readiness">
        <h2 id="pa-readiness" className={titleClass}>
          9. Readiness summary
        </h2>
        <p className={subClass}>
          Deterministic seeds — passing does not grant API access or enable execution. {readiness.label}
        </p>
        <ul className="mt-4 space-y-3">
          {PRODUCT_ACCESS_READINESS_CHECKS.map((check) => (
            <li key={check.check_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{check.label}</span>
                <CheckPill passed={check.passed} blocking={check.blocking} />
              </div>
              <p className="mt-2 text-sm text-slate-600">{check.description}</p>
              <Link
                href={check.related_route}
                className="mt-3 inline-flex text-sm font-semibold text-tropicash-green-hover underline"
              >
                Open related console →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="pa-recs">
        <h2 id="pa-recs" className={titleClass}>
          10. Recommendations
        </h2>
        <ul className="mt-4 space-y-3">
          {PRODUCT_ACCESS_RECOMMENDATIONS.map((rec) => (
            <li key={rec.recommendation_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{rec.title}</span>
                <Pill>{rec.priority}</Pill>
              </div>
              <p className="mt-2 text-sm text-slate-600">{rec.summary}</p>
              <p className="mt-1 text-xs text-slate-500">{rec.action_hint}</p>
              <Link
                href={rec.related_route}
                className="mt-3 inline-flex text-sm font-semibold text-tropicash-green-hover underline"
              >
                Go to console →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div
        role="note"
        className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
      >
        <strong className="font-semibold">Phase 9B — metadata-only product governance.</strong> Sandbox only — preview
        only — metadata only — no execution — no endpoints — no live access. Entitlement states, visibility rules, review
        outcomes, history seeds, sandbox entitlement previews, and revocation models are deterministic configuration — no
        credentials and no money movement.
        <p className="mt-2">
          <Pill className="border-sky-300 bg-white">{PRODUCT_GOVERNANCE_PHASE}</Pill>
        </p>
      </div>

      <section className={sectionClass} aria-labelledby="pg-governance-summary">
        <h2 id="pg-governance-summary" className={titleClass}>
          9B.1 Governance state summary
        </h2>
        <p className={subClass}>{governanceSummary}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Entitlement state"
            value={governanceOverview.state?.label ?? governanceOverview.seed.entitlement_state_key}
            hint={governanceOverview.state?.description}
          />
          <StatCard
            label="Review outcome"
            value={governanceOverview.review_outcome?.label ?? governanceOverview.seed.review_outcome_key}
            hint={governanceOverview.review_outcome?.description}
          />
          <StatCard
            label="Visibility rule"
            value={governanceOverview.visibility_rule?.label ?? governanceOverview.seed.visibility_rule_key}
            hint={governanceOverview.visibility_rule?.description}
          />
          <StatCard
            label="States modeled"
            value={String(PRODUCT_ENTITLEMENT_STATES.length)}
            hint="Placeholder entitlement vocabulary — no API enablement."
          />
        </div>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {PRODUCT_ENTITLEMENT_STATES.map((s) => (
            <li key={s.state_key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-900">{s.label}</span>
              <p className="mt-1 text-slate-600">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="pg-review-readiness">
        <h2 id="pg-review-readiness" className={titleClass}>
          9B.2 Review readiness
        </h2>
        <p className={subClass}>
          Product governance review readiness is separate from Phase 9A access readiness — passing does not enable
          endpoints, execution, or live access.
        </p>
        <div className="mt-4 rounded-xl border border-slate-200 bg-white/80 p-4">
          <p className="text-sm font-semibold text-slate-900">
            {governanceReadiness.percent}% ({governanceReadiness.passed_count}/{governanceReadiness.total_count})
          </p>
          <p className="mt-1 text-sm text-slate-600">{governanceReadiness.label}</p>
        </div>
        <ul className="mt-4 space-y-3">
          {governanceReadiness.checks.map((check) => (
            <li key={check.check_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{check.label}</span>
                <CheckPill passed={check.passed} blocking={check.blocking} />
              </div>
              <p className="mt-2 text-sm text-slate-600">{check.description}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 text-sm font-bold text-slate-800">Review outcomes</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {PRODUCT_REVIEW_OUTCOMES.map((o) => (
            <li key={o.outcome_key} className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-900">{o.label}</span>
              <p className="mt-1 text-slate-600">{o.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="pg-visibility-rules">
        <h2 id="pg-visibility-rules" className={titleClass}>
          9B.3 Visibility rules
        </h2>
        <p className={subClass}>{visibilitySummary}</p>
        <ul className="mt-4 space-y-3">
          {PRODUCT_VISIBILITY_RULES.map((rule) => (
            <li key={rule.rule_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{rule.label}</span>
                <Pill>{rule.audience}</Pill>
                <Pill>{rule.rule_key}</Pill>
              </div>
              <p className="mt-2 text-sm text-slate-600">{rule.description}</p>
            </li>
          ))}
        </ul>
        <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {PRODUCT_GOVERNANCE_SAFETY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="pg-entitlement-preview">
        <h2 id="pg-entitlement-preview" className={titleClass}>
          9B.4 Sandbox entitlement preview
        </h2>
        <p className={subClass}>
          What developers and operators would eventually see — product labels, environment, scope, execution posture,
          and sandbox limit text only. No endpoints, URLs, tokens, credentials, auth headers, or execution payloads.
        </p>
        <ul className="mt-4 space-y-4">
          {entitlementPreview.previews.map((prev) => (
            <li key={prev.preview_key} className="rounded-xl border border-teal-200 bg-teal-50/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{prev.label}</span>
                <Pill>{prev.environment}</Pill>
                <Pill>{prev.status}</Pill>
                <Pill>{prev.visibility}</Pill>
              </div>
              <code className="mt-1 block text-xs text-slate-500">{prev.product_key}</code>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Scope</dt>
                  <dd className="text-slate-800">{prev.scope}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Execution</dt>
                  <dd className="text-slate-800">{prev.execution}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Sandbox limit</dt>
                  <dd className="text-slate-800">{prev.sandbox_limit}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-slate-600">{prev.notes}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="pg-history">
        <h2 id="pg-history" className={titleClass}>
          9B.5 Governance history
        </h2>
        <p className={subClass}>
          {entitlementHistory.total_steps} deterministic audit rows — static step labels only (no clock timestamps).
        </p>
        <ol className="mt-4 space-y-3">
          {entitlementHistory.events.map((evt) => (
            <li key={evt.history_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Pill>{evt.simulated_step_label}</Pill>
                <span className="font-semibold text-slate-900">{evt.title}</span>
                <Pill>{evt.actor}</Pill>
                <Pill>{evt.entitlement_state}</Pill>
              </div>
              <p className="mt-2 text-sm text-slate-600">{evt.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                <strong className="text-slate-700">Visibility:</strong> {evt.visibility}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className={sectionClass} aria-labelledby="pg-revocation">
        <h2 id="pg-revocation" className={titleClass}>
          9B.6 Suspension / revocation models
        </h2>
        <p className={subClass}>
          Teaching models for governance restrictions, capability removal, app suspension, failed review, developer
          removal, and emergency policy — no edge enforcement or API enablement in Phase 9B.
        </p>
        <ul className="mt-4 space-y-4">
          {revocationModels.models.map((model) => (
            <li key={model.model_key} className="rounded-xl border border-rose-200 bg-rose-50/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{model.label}</span>
                <Pill>{model.model_key}</Pill>
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

      <section className={sectionClass} aria-labelledby="pg-rationale">
        <h2 id="pg-rationale" className={titleClass}>
          9B.7 Governance rationale cards
        </h2>
        <p className={subClass}>
          Restriction rationale seeds explain why visibility and review gates exist — metadata-only product governance,
          not enforcement code.
        </p>
        <ul className="mt-4 space-y-4">
          {accessRationales.rationales.map((card) => (
            <li key={card.rationale_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <span className="font-semibold text-slate-900">{card.title}</span>
              <p className="mt-2 text-sm text-slate-600">{card.summary}</p>
              <p className="mt-2 text-xs text-slate-500">
                Rules: {card.related_rule_keys.join(", ")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                States: {card.related_state_keys.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="pg-risk">
        <h2 id="pg-risk" className={titleClass}>
          9B.8 Governance risk summary
        </h2>
        <p className={subClass}>{governanceRiskSummary.summary}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Revocation models"
            value={String(governanceRiskSummary.revocation_model_count)}
            hint="Suspension and restriction teaching paths only."
          />
          <StatCard
            label="Admin-only previews"
            value={String(governanceRiskSummary.admin_only_preview_count)}
            hint="Elevated products — operator review narration."
          />
          <StatCard
            label="Live access"
            value={governanceRiskSummary.live_access_blocked ? "blocked" : "—"}
            hint="developer_cannot_access_live enforced in seeds."
          />
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Endpoint risk: {governanceRiskSummary.endpoint_risk}</li>
          <li>Execution risk: {governanceRiskSummary.execution_risk}</li>
          <li>Credential risk: {governanceRiskSummary.credential_risk}</li>
          <li>Money movement risk: {governanceRiskSummary.money_movement_risk}</li>
        </ul>
      </section>

      <section
        className="rounded-2xl border border-rose-200 bg-rose-50 p-5 sm:p-6"
        aria-labelledby="pa-safety-heading"
      >
        <h2 id="pa-safety-heading" className="text-base font-bold text-rose-950 sm:text-lg">
          Safety notice — Phase 9A + 9B
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-rose-950">
          {PRODUCT_ACCESS_SAFETY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
          {PRODUCT_GOVERNANCE_SAFETY_RULES.map((rule) => (
            <li key={`gov-${rule}`}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="pa-related">
        <h2 id="pa-related" className={titleClass}>
          11. Related tools
        </h2>
        <p className={subClass}>
          Pair sandbox product entitlement previews and metadata-only product governance with workspace readiness,
          app governance, catalog contracts, credential lifecycle, and simulators — no endpoints or execution.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dev-console/workspace"
            className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm hover:bg-emerald-100"
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
            href="/dev-console/credential-lifecycle"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🪪 Credential Lifecycle (8A + 8B)
          </Link>
          <Link
            href="/dev-console/credential-architecture"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🔐 Credential Architecture (Phase 5A)
          </Link>
          <Link
            href="/dev-console/auth-simulator"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🛂 Auth Simulator (Phase 5B)
          </Link>
          <Link
            href="/dev-console/gateway-simulator"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🚦 Gateway Simulator (Phase 5C)
          </Link>
          <Link
            href="/dev-console/request-simulator"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            📨 Request Simulator (10A + 10B)
          </Link>
          <Link
            href="/dev-console/runtime-activation"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🔒 Runtime Activation (Phase 6A)
          </Link>
          <Link
            href="/dev-console/app-governance"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            ⚖️ App Governance (Phase 4B)
          </Link>
          <Link
            href="/dev-console/app-capabilities"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🧬 App Capabilities
          </Link>
        </div>
      </section>
    </DevConsoleLayout>
  );
}
