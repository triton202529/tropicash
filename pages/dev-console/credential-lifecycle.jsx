import Link from "next/link";
import { useMemo } from "react";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { DEVELOPER_CREDENTIAL_PHASE } from "../../lib/developerCredentialArchitectureConfig";
import {
  buildCredentialGovernanceRiskSummary,
  buildCredentialGovernanceSummary,
  buildCredentialReviewReadiness,
  buildCredentialVisibilitySummary as buildGovernanceVisibilitySummary,
  CREDENTIAL_GOVERNANCE_PHASE,
  CREDENTIAL_GOVERNANCE_SAFETY_RULES,
  CREDENTIAL_GOVERNANCE_STATES,
  CREDENTIAL_REVIEW_OUTCOMES,
  CREDENTIAL_VISIBILITY_RULES,
  getCredentialGovernanceHistory,
  getCredentialGovernanceOverview,
  getCredentialGovernanceRationales,
  getCredentialRevocationModels,
  getCredentialVisibilityPreview,
} from "../../lib/developerCredentialGovernanceConfig";
import {
  buildCredentialLifecycleSummary,
  buildCredentialReadinessScore,
  buildCredentialVisibilitySummary,
  CREDENTIAL_LIFECYCLE_PHASE,
  getCredentialLifecycleOverview,
  getCredentialReadinessChecks,
  getCredentialRecommendations,
  getCredentialTimeline,
  SANDBOX_CREDENTIAL_ENVIRONMENTS,
  SANDBOX_CREDENTIAL_REQUEST_TYPES,
  SANDBOX_CREDENTIAL_SAFETY_RULES,
  SANDBOX_CREDENTIAL_STATUSES,
  SANDBOX_CREDENTIAL_VISIBILITY_STATES,
} from "../../lib/developerCredentialLifecycleConfig";

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

function CheckPill({ passed, blocking }) {
  if (!passed && blocking) {
    return <Pill className="border-rose-200 bg-rose-50 text-rose-800">blocking</Pill>;
  }
  if (passed) {
    return <Pill className="border-emerald-200 bg-emerald-50 text-emerald-800">passed</Pill>;
  }
  return <Pill className="border-amber-200 bg-amber-50 text-amber-900">open</Pill>;
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

export default function DevConsoleCredentialLifecyclePage() {
  const overview = useMemo(() => getCredentialLifecycleOverview(), []);
  const governanceOverview = useMemo(() => getCredentialGovernanceOverview(), []);
  const lifecycleSummary = useMemo(() => buildCredentialLifecycleSummary(), []);
  const governanceSummary = useMemo(() => buildCredentialGovernanceSummary(), []);
  const readinessScore = useMemo(() => buildCredentialReadinessScore(), []);
  const governanceReadiness = useMemo(() => buildCredentialReviewReadiness(), []);
  const visibilitySummary = useMemo(() => buildCredentialVisibilitySummary(), []);
  const governanceVisibilitySummary = useMemo(() => buildGovernanceVisibilitySummary(), []);
  const riskSummary = useMemo(() => buildCredentialGovernanceRiskSummary(), []);
  const timeline = useMemo(() => getCredentialTimeline(), []);
  const readiness = useMemo(() => getCredentialReadinessChecks(), []);
  const recommendations = useMemo(() => getCredentialRecommendations(), []);
  const governanceHistory = useMemo(() => getCredentialGovernanceHistory(), []);
  const governanceRationales = useMemo(() => getCredentialGovernanceRationales(), []);
  const visibilityPreview = useMemo(() => getCredentialVisibilityPreview(), []);
  const revocationModels = useMemo(() => getCredentialRevocationModels(), []);

  return (
    <DevConsoleLayout
      title="Sandbox Credential Lifecycle"
      subtitle="Phase 8A + 8B — sandbox credential lifecycle and metadata-only credential governance. Placeholder only; no Supabase calls, no issuance, no secrets, no auth runtime."
      environment="sandbox"
    >
      {/* 2 — Safety banner */}
      <div
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        <strong className="font-semibold">Placeholder only — metadata only.</strong> No secret material exists; no
        active authentication; no live API access. No real API keys, secrets, signing keys, or authentication runtime
        exists yet.
        This page reads{" "}
        <code className="rounded bg-white/80 px-1 text-xs">lib/developerCredentialLifecycleConfig.js</code> (Phase 8A) and{" "}
        <code className="rounded bg-white/80 px-1 text-xs">lib/developerCredentialGovernanceConfig.js</code> (Phase 8B) and
        optionally aligns copy with Phase 5A{" "}
        <code className="rounded bg-white/80 px-1 text-xs">{DEVELOPER_CREDENTIAL_PHASE}</code>. Prefix examples are
        shaped like future keys but contain no entropy.
      </div>

      <div
        role="note"
        className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950"
      >
        <strong className="font-semibold">Phase 9A + 9B — Product Access.</strong> Sandbox product entitlement previews
        and metadata-only product governance — capability → product mapping, visibility rules, and usage envelopes in{" "}
        <Link href="/dev-console/product-access" className="font-semibold text-teal-900 underline">
          Product Access
        </Link>{" "}
        (no endpoints, credentials, execution, or live access).
      </div>

      {/* 1 / 3 — Header + summary cards */}
      <section className={sectionClass} aria-labelledby="cl-header">
        <h2 id="cl-header" className={titleClass}>
          1. Sandbox credential lifecycle
        </h2>
        <p className={subClass}>{lifecycleSummary}</p>
        <p className="mt-3">
          <Pill>{CREDENTIAL_LIFECYCLE_PHASE}</Pill>
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Status"
            value={overview.status?.label ?? overview.seed.status_key}
            hint={overview.status?.description}
          />
          <StatCard
            label="Readiness score"
            value={`${readinessScore.percent}% (${readinessScore.passed_count}/${readinessScore.total_count})`}
            hint={readinessScore.label}
          />
          <StatCard
            label="Visibility"
            value={overview.visibility?.label ?? overview.seed.visibility_key}
            hint={overview.visibility?.description}
          />
          <StatCard
            label="Environment"
            value={overview.environment?.label ?? overview.seed.environment_key}
            hint={overview.environment?.description}
          />
        </div>
      </section>

      {/* 4 — Readiness checklist */}
      <section className={sectionClass} aria-labelledby="cl-readiness">
        <h2 id="cl-readiness" className={titleClass}>
          4. Readiness checklist
        </h2>
        <p className={subClass}>
          Deterministic seeds — passing does not issue credentials or enable authentication. Blocking checks must clear
          before placeholder request narration advances.
        </p>
        <ul className="mt-4 space-y-3">
          {readiness.checks.map((check) => (
            <li key={check.check_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{check.label}</span>
                <CheckPill passed={check.passed} blocking={check.blocking} />
                {check.blocking ? <Pill>blocking gate</Pill> : null}
              </div>
              <p className="mt-2 text-sm text-slate-600">{check.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                <strong className="text-slate-700">Why it matters:</strong> {check.why_it_matters}
              </p>
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

      {/* 5 — Timeline */}
      <section className={sectionClass} aria-labelledby="cl-timeline">
        <h2 id="cl-timeline" className={titleClass}>
          5. Credential lifecycle timeline
        </h2>
        <p className={subClass}>
          {timeline.total_steps} deterministic steps — static step labels only (no clock timestamps).
        </p>
        <ol className="mt-4 space-y-3">
          {timeline.events.map((evt) => (
            <li key={evt.event_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Pill>{evt.step_label}</Pill>
                <span className="font-semibold text-slate-900">{evt.title}</span>
                <Pill>{evt.related_status}</Pill>
              </div>
              <p className="mt-2 text-sm text-slate-600">{evt.summary}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 6 — Placeholder credential types */}
      <section className={sectionClass} aria-labelledby="cl-types">
        <h2 id="cl-types" className={titleClass}>
          6. Placeholder credential types
        </h2>
        <p className={subClass}>
          Request types describe future slots — not issued material. No live API, webhooks, or auth runtime.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {SANDBOX_CREDENTIAL_REQUEST_TYPES.map((t) => (
            <li key={t.request_type_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold text-slate-900">{t.label}</span>
                <code className="text-xs text-slate-600">{t.request_type_key}</code>
              </div>
              <p className="mt-2 text-sm text-slate-600">{t.description}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 text-sm font-bold text-slate-800">Lifecycle statuses</h3>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {SANDBOX_CREDENTIAL_STATUSES.map((s) => (
            <li key={s.status_key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-900">{s.label}</span>
              <p className="mt-1 text-slate-600">{s.description}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 text-sm font-bold text-slate-800">Environments</h3>
        <ul className="mt-2 space-y-2">
          {SANDBOX_CREDENTIAL_ENVIRONMENTS.map((e) => (
            <li key={e.environment_key} className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm">
              <span className="font-semibold text-slate-900">{e.label}</span> — {e.description}
            </li>
          ))}
        </ul>
      </section>

      {/* 7 — Visibility rules */}
      <section className={sectionClass} aria-labelledby="cl-visibility">
        <h2 id="cl-visibility" className={titleClass}>
          7. Visibility rules
        </h2>
        <p className={subClass}>{visibilitySummary}</p>
        <ul className="mt-4 space-y-3">
          {SANDBOX_CREDENTIAL_VISIBILITY_STATES.map((v) => (
            <li key={v.visibility_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{v.label}</span>
                <Pill>{v.visibility_key}</Pill>
              </div>
              <p className="mt-2 text-sm text-slate-600">{v.description}</p>
            </li>
          ))}
        </ul>
        <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {SANDBOX_CREDENTIAL_SAFETY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      {/* 8 — Recommendations */}
      <section className={sectionClass} aria-labelledby="cl-recs">
        <h2 id="cl-recs" className={titleClass}>
          8. Recommendations
        </h2>
        <ul className="mt-4 space-y-3">
          {recommendations.recommendations.map((rec) => (
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

      {/* Phase 8B — Governance & visibility */}
      <div
        role="note"
        className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
      >
        <strong className="font-semibold">Phase 8B — metadata-only credential governance.</strong> Governance states,
        visibility rules, review outcomes, history seeds, and revocation models are deterministic configuration. No
        credentials are issued; admins cannot view secret material; live visibility is blocked.
        <p className="mt-2">
          <Pill className="border-sky-300 bg-white">{CREDENTIAL_GOVERNANCE_PHASE}</Pill>
        </p>
      </div>

      <section className={sectionClass} aria-labelledby="cg-governance-summary">
        <h2 id="cg-governance-summary" className={titleClass}>
          8B.1 Governance state summary
        </h2>
        <p className={subClass}>{governanceSummary}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Governance state"
            value={governanceOverview.state?.label ?? governanceOverview.seed.governance_state_key}
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
            value={String(CREDENTIAL_GOVERNANCE_STATES.length)}
            hint="Placeholder governance vocabulary — no vault writes."
          />
        </div>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {CREDENTIAL_GOVERNANCE_STATES.map((s) => (
            <li key={s.state_key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-900">{s.label}</span>
              <p className="mt-1 text-slate-600">{s.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="cg-review-readiness">
        <h2 id="cg-review-readiness" className={titleClass}>
          8B.2 Review readiness
        </h2>
        <p className={subClass}>
          Governance review readiness is separate from Phase 8A lifecycle readiness — passing does not issue
          credentials or enable authentication.
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
          {CREDENTIAL_REVIEW_OUTCOMES.map((o) => (
            <li key={o.outcome_key} className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-900">{o.label}</span>
              <p className="mt-1 text-slate-600">{o.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="cg-visibility-rules">
        <h2 id="cg-visibility-rules" className={titleClass}>
          8B.3 Developer visibility rules
        </h2>
        <p className={subClass}>{governanceVisibilitySummary}</p>
        <ul className="mt-4 space-y-3">
          {CREDENTIAL_VISIBILITY_RULES.map((rule) => (
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
          {CREDENTIAL_GOVERNANCE_SAFETY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="cg-preview">
        <h2 id="cg-preview" className={titleClass}>
          8B.4 Placeholder credential preview
        </h2>
        <p className={subClass}>
          What developers would eventually see — labels, environment, prefix hints, and status only. No actual keys,
          secrets, tokens, signing values, hashes, or encrypted blobs.
        </p>
        <ul className="mt-4 space-y-4">
          {visibilityPreview.previews.map((prev) => (
            <li key={prev.preview_key} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{prev.label}</span>
                <Pill>{prev.environment}</Pill>
                <Pill>{prev.status}</Pill>
                <Pill>{prev.visibility}</Pill>
              </div>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Prefix hint</dt>
                  <dd className="break-all font-mono text-slate-800">{prev.prefix}…</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Created</dt>
                  <dd className="text-slate-800">{prev.created_label}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Last used</dt>
                  <dd className="text-slate-800">{prev.last_used_label}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-slate-500">Rotation</dt>
                  <dd className="text-slate-800">{prev.rotation_label}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-slate-600">{prev.notes}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="cg-history">
        <h2 id="cg-history" className={titleClass}>
          8B.5 Governance history
        </h2>
        <p className={subClass}>
          {governanceHistory.total_steps} deterministic audit rows — static step labels only (no clock timestamps).
        </p>
        <ol className="mt-4 space-y-3">
          {governanceHistory.events.map((evt) => (
            <li key={evt.history_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Pill>{evt.simulated_step_label}</Pill>
                <span className="font-semibold text-slate-900">{evt.title}</span>
                <Pill>{evt.actor}</Pill>
                <Pill>{evt.state}</Pill>
              </div>
              <p className="mt-2 text-sm text-slate-600">{evt.description}</p>
              <p className="mt-1 text-xs text-slate-500">
                <strong className="text-slate-700">Visibility:</strong> {evt.visibility}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className={sectionClass} aria-labelledby="cg-revocation">
        <h2 id="cg-revocation" className={titleClass}>
          8B.6 Suspension / revocation models
        </h2>
        <p className={subClass}>
          Teaching models for governance suspension, developer-requested revocation, emergency paths, and upstream
          dependencies — no edge enforcement or vault invalidation in Phase 8B.
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

      <section className={sectionClass} aria-labelledby="cg-rationale">
        <h2 id="cg-rationale" className={titleClass}>
          8B.7 Governance rationale cards
        </h2>
        <ul className="mt-4 space-y-3">
          {governanceRationales.rationales.map((card) => (
            <li key={card.rationale_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <span className="font-semibold text-slate-900">{card.title}</span>
              <p className="mt-2 text-sm text-slate-600">{card.summary}</p>
              <p className="mt-2 text-xs text-slate-500">
                Rules: {card.related_rule_keys.join(", ")} · States: {card.related_state_keys.join(", ")}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="cg-risk">
        <h2 id="cg-risk" className={titleClass}>
          8B.8 Risk summary
        </h2>
        <p className={subClass}>{riskSummary.summary}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Revocation models"
            value={String(riskSummary.revocation_model_count)}
            hint="Suspension and dependency narratives — audit only."
          />
          <StatCard label="Secret generation risk" value={riskSummary.secret_generation_risk} />
          <StatCard label="Auth runtime risk" value={riskSummary.auth_runtime_risk} />
          <StatCard label="Live API risk" value={riskSummary.live_api_risk} />
          <StatCard
            label="Live visibility"
            value={riskSummary.live_visibility_blocked ? "blocked" : "unknown"}
            hint="live_visibility_blocked rule enforced in seeds."
          />
        </div>
      </section>

      {/* 9 — Related tools */}
      <section className={sectionClass} aria-labelledby="cl-related">
        <h2 id="cl-related" className={titleClass}>
          9. Related tools
        </h2>
        <p className={subClass}>
          Rehearse upstream architecture, metadata-only credential governance, and simulators before imagining
          placeholder issuance.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
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
            🛡️ Developer Governance
          </Link>
          <Link
            href="/dev-console/my-apps"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            📦 My Apps
          </Link>
          <Link
            href="/dev-console/workspace"
            className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm hover:bg-emerald-100"
          >
            🏠 Workspace (Phase 7A + 7B)
          </Link>
          <Link
            href="/dev-console/product-access"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🎫 Product Access (9A + 9B)
          </Link>
        </div>
      </section>
    </DevConsoleLayout>
  );
}
