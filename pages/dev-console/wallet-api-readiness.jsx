import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import {
  ASSESSED_ON,
  CURRENT_AUTH_CAPABILITIES,
  REQUIRED_AUTH_CONTROLS,
  DATA_CLASSIFICATION,
  API_EXPOSURE,
  EXPOSURE_CATEGORY_LABELS,
  SCOPE_MATRIX,
  CONSENT_MODEL,
  SECURITY_FINDINGS,
  WEBHOOK_SECRET_REMEDIATION,
  ROLLOUT_TIERS,
  getReadinessSummary,
} from "../../lib/walletApiReadiness";

const classBadge = {
  PUBLIC: "border-emerald-200 bg-emerald-50 text-emerald-900",
  RESTRICTED: "border-sky-200 bg-sky-50 text-sky-900",
  SENSITIVE: "border-amber-200 bg-amber-50 text-amber-950",
  CRITICAL: "border-red-200 bg-red-50 text-red-900",
};

const categoryBadge = {
  SAFE_FOR_EARLY_ACCESS: "border-emerald-200 bg-emerald-50 text-emerald-900",
  REQUIRES_USER_CONSENT: "border-amber-200 bg-amber-50 text-amber-950",
  HIGH_RISK: "border-red-200 bg-red-50 text-red-900",
  INTERNAL_ONLY: "border-slate-300 bg-slate-100 text-slate-600",
};

const riskBadge = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-900",
  medium: "border-sky-200 bg-sky-50 text-sky-900",
  high: "border-amber-200 bg-amber-50 text-amber-950",
  critical: "border-red-200 bg-red-50 text-red-900",
};

const severityBadge = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-900",
  medium: "border-amber-200 bg-amber-50 text-amber-950",
  high: "border-red-200 bg-red-50 text-red-900",
};

function Pill({ className, children }) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${className || "border-slate-200 bg-slate-50 text-slate-700"}`}
    >
      {children}
    </span>
  );
}

function SummaryCard({ title, value, accent }) {
  return (
    <article className="tropicash-surface flex flex-col rounded-2xl p-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <p className={`mt-2 text-3xl font-bold ${accent || "text-slate-900"}`}>{value}</p>
    </article>
  );
}

function Section({ id, title, description, children }) {
  return (
    <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby={id}>
      <h2 id={id} className="text-lg font-bold text-slate-900">
        {title}
      </h2>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function WalletApiReadinessPage() {
  const { user, loading: authLoading } = useUser();
  const summary = getReadinessSummary();

  if (authLoading) {
    return (
      <DevConsoleLayout title="Wallet API Readiness" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout
        title="Wallet API Readiness"
        subtitle="Sign in to view the wallet API readiness assessment."
      >
        <p className="text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-tropicash-green-hover underline">
            Go to login
          </Link>
        </p>
      </DevConsoleLayout>
    );
  }

  return (
    <DevConsoleLayout
      title="Wallet API Readiness"
      subtitle={`Phase 12G assessment — security, data classification, scopes, consent, and rollout blueprint before any wallet API is exposed. Read-only. Assessed ${ASSESSED_ON}.`}
    >
      <div
        role="note"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        <strong className="font-semibold">Assessment only.</strong> No external wallet APIs are
        exposed, no scopes are enforced, and no money movement is enabled by this page. It documents
        what is required before wallet functionality ships to third-party developers.
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <SummaryCard title="APIs Reviewed" value={summary.apisReviewed} />
        <SummaryCard title="Safe APIs" value={summary.safeApis} accent="text-emerald-700" />
        <SummaryCard title="Consent APIs" value={summary.consentApis} accent="text-amber-700" />
        <SummaryCard title="High Risk APIs" value={summary.highRiskApis} accent="text-red-700" />
      </div>

      {/* Authentication requirements */}
      <Section
        id="auth-heading"
        title="Authentication requirements"
        description="Current trust foundation and the additional controls required per authorization tier."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-semibold">Capability</th>
                <th className="py-2 pr-3 font-semibold">Phase</th>
                <th className="py-2 pr-3 font-semibold">State</th>
                <th className="py-2 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {CURRENT_AUTH_CAPABILITIES.map((c) => (
                <tr key={c.capability} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{c.capability}</td>
                  <td className="py-2 pr-3 text-slate-600">{c.phase}</td>
                  <td className="py-2 pr-3">
                    <Pill className="border-emerald-200 bg-emerald-50 text-emerald-900">{c.state}</Pill>
                  </td>
                  <td className="py-2 text-slate-600">{c.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {REQUIRED_AUTH_CONTROLS.map((ctrl) => (
            <li key={ctrl.control} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{ctrl.control}</h3>
                <Pill>{ctrl.requires}</Pill>
              </div>
              <p className="mt-1 text-sm text-slate-600">{ctrl.summary}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-500">
                {ctrl.gaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>

      {/* Data classification */}
      <Section
        id="classification-heading"
        title="Data classification"
        description="Every wallet-related data category mapped to its required authorization and handling rules."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-semibold">Level</th>
                <th className="py-2 pr-3 font-semibold">Authorization</th>
                <th className="py-2 pr-3 font-semibold">Examples</th>
                <th className="py-2 font-semibold">Handling</th>
              </tr>
            </thead>
            <tbody>
              {DATA_CLASSIFICATION.map((row) => (
                <tr key={row.level} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3">
                    <Pill className={classBadge[row.level]}>{row.level}</Pill>
                  </td>
                  <td className="py-2 pr-3 text-slate-700">{row.authorization}</td>
                  <td className="py-2 pr-3 text-slate-600">{row.examples.join(", ")}</td>
                  <td className="py-2 text-slate-600">{row.handling}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* API exposure */}
      <Section
        id="exposure-heading"
        title="API exposure review"
        description="Proposed future endpoints classified by exposure risk. None are implemented."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-semibold">Endpoint</th>
                <th className="py-2 pr-3 font-semibold">Category</th>
                <th className="py-2 pr-3 font-semibold">Data class</th>
                <th className="py-2 pr-3 font-semibold">Scope</th>
                <th className="py-2 font-semibold">Note</th>
              </tr>
            </thead>
            <tbody>
              {API_EXPOSURE.map((ep) => (
                <tr key={`${ep.method}-${ep.path}`} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-900">
                    <span className="text-slate-400">{ep.method}</span> {ep.path}
                  </td>
                  <td className="py-2 pr-3">
                    <Pill className={categoryBadge[ep.category]}>
                      {EXPOSURE_CATEGORY_LABELS[ep.category]}
                    </Pill>
                  </td>
                  <td className="py-2 pr-3">
                    <Pill className={classBadge[ep.dataClass]}>{ep.dataClass}</Pill>
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-slate-600">{ep.scope || "—"}</td>
                  <td className="py-2 text-slate-600">{ep.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Scope matrix */}
      <Section
        id="scopes-heading"
        title="Scope matrix"
        description="Proposed SDK/API scopes. Design-only — no scope enforcement exists in this phase."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-semibold">Scope</th>
                <th className="py-2 pr-3 font-semibold">Description</th>
                <th className="py-2 pr-3 font-semibold">Risk</th>
                <th className="py-2 font-semibold">Future approval</th>
              </tr>
            </thead>
            <tbody>
              {SCOPE_MATRIX.map((s) => (
                <tr key={s.scope} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-900">{s.scope}</td>
                  <td className="py-2 pr-3 text-slate-600">{s.description}</td>
                  <td className="py-2 pr-3">
                    <Pill className={riskBadge[s.risk]}>{s.risk}</Pill>
                  </td>
                  <td className="py-2 text-slate-600">{s.approval}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Consent model */}
      <Section
        id="consent-heading"
        title="Consent model"
        description="Recommended future user authorization flow for third-party apps."
      >
        <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {CONSENT_MODEL.map((item) => (
            <div key={item.question} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <dt className="font-semibold text-slate-900">{item.question}</dt>
              <dd className="mt-1 text-sm text-slate-600">{item.recommendation}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Security findings */}
      <Section
        id="security-heading"
        title="Security findings"
        description="Strengths, weaknesses, and required upgrades before launch."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <h3 className="font-semibold text-emerald-900">Strengths</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-900/90">
              {SECURITY_FINDINGS.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <h3 className="font-semibold text-slate-900">Required upgrades before launch</h3>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              {SECURITY_FINDINGS.requiredUpgrades.map((u) => (
                <li key={u}>{u}</li>
              ))}
            </ol>
          </div>
        </div>

        <h3 className="mt-5 font-semibold text-slate-900">Weaknesses</h3>
        <ul className="mt-2 space-y-2">
          {SECURITY_FINDINGS.weaknesses.map((w) => (
            <li key={w.issue} className="rounded-xl border border-slate-200 bg-white/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{w.issue}</span>
                <Pill className={severityBadge[w.severity]}>{w.severity}</Pill>
              </div>
              <p className="mt-1 text-sm text-slate-600">{w.detail}</p>
            </li>
          ))}
        </ul>

        <h3 className="mt-5 font-semibold text-slate-900">
          Webhook secret storage — remediation options
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Addresses the Phase 12D limitation: only the hash of the webhook secret is stored, so
          signatures are not yet developer-verifiable end-to-end.
        </p>
        <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
          {WEBHOOK_SECRET_REMEDIATION.map((opt) => (
            <div key={opt.option} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <h4 className="text-sm font-bold text-slate-900">{opt.option}</h4>
              <p className="mt-1 text-xs text-slate-600">{opt.summary}</p>
              <p className="mt-2 text-xs font-semibold text-emerald-800">Pros</p>
              <ul className="list-disc pl-4 text-xs text-slate-600">
                {opt.pros.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs font-semibold text-red-800">Cons</p>
              <ul className="list-disc pl-4 text-xs text-slate-600">
                {opt.cons.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* Recommended rollout */}
      <Section
        id="rollout-heading"
        title="Recommended rollout"
        description="Tiered exposure plan, lowest risk first."
      >
        <ol className="space-y-3">
          {ROLLOUT_TIERS.map((t) => (
            <li key={t.tier} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                  {t.tier}
                </span>
                <span className="font-semibold text-slate-900">{t.title}</span>
                <Pill>{t.when}</Pill>
              </div>
              <p className="mt-2 font-mono text-xs text-slate-700">{t.endpoints.join("  ·  ")}</p>
              <p className="mt-2 text-sm text-slate-600">{t.justification}</p>
              <p className="mt-1 text-xs text-slate-500">
                <span className="font-semibold">Gate:</span> {t.gate}
              </p>
            </li>
          ))}
        </ol>
      </Section>

      <p className="text-sm text-slate-600">
        Full write-up:{" "}
        <span className="font-mono text-xs">docs/developer/WALLET_API_READINESS_REPORT.md</span>
        {" · "}
        <Link href="/dev-console/sdk" className="font-semibold text-tropicash-green-hover underline">
          SDK
        </Link>
        {" · "}
        <Link href="/dev-console/events" className="font-semibold text-tropicash-green-hover underline">
          Event Registry
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
