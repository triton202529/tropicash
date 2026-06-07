import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import {
  OAUTH_SCOPE_CATALOG,
  CONSENT_RELATIONSHIP_FLOW,
  SECURITY_RULES,
  TOKEN_SECURITY,
  IMPLEMENTATION_STATUS,
  getConsentDataModelSummary,
  getOAuthTableDefinitions,
} from "../../lib/oauthConsentModels";

const riskBadge = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-900",
  medium: "border-sky-200 bg-sky-50 text-sky-900",
  high: "border-amber-200 bg-amber-50 text-amber-950",
  critical: "border-red-200 bg-red-50 text-red-900",
};

const statusTone = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-900",
  blocked: "border-slate-200 bg-slate-50 text-slate-700",
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

function BoolPill({ value }) {
  return (
    <Pill className={value ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-slate-50 text-slate-600"}>
      {value ? "Yes" : "No"}
    </Pill>
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

export default function OAuthDataModelPage() {
  const { user, loading: authLoading } = useUser();
  const summary = getConsentDataModelSummary();
  const tables = getOAuthTableDefinitions();

  if (authLoading) {
    return (
      <DevConsoleLayout title="OAuth Data Model" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout
        title="OAuth Data Model"
        subtitle="Sign in to view the OAuth consent data model."
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
      title="OAuth Data Model"
      subtitle="Phase 12K consent storage foundation — tables, relationships, scope catalog, security rules, and audit architecture. Read-only documentation; schema only, no OAuth flow."
    >
      <div
        role="note"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        <strong className="font-semibold">Schema only.</strong> This phase creates the database
        and model foundation for future OAuth authorization and user consent. No login flow, token
        issuance, wallet APIs, or money movement exist here. No records are created through this page.
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <SummaryCard title="OAuth Tables" value={summary.tables} />
        <SummaryCard title="Service-role Only" value={summary.serviceRoleOnlyTables} accent="text-red-700" />
        <SummaryCard title="Scopes" value={summary.scopes} accent="text-sky-700" />
        <SummaryCard title="Audit Event Types" value={summary.auditEventTypes} accent="text-emerald-700" />
      </div>

      <Section
        id="overview-heading"
        title="Overview"
        description="Foundation for future OAuth-style authorization and explicit user consent."
      >
        <p className="text-sm text-slate-600">
          Phase 12K defines five PostgreSQL tables, a static scope catalog, and conservative row-level
          security policies. Developers can review the data model here before any authorization server,
          token endpoints, or wallet APIs are built. All secret and token material is stored as hashes
          only; token tables are service-role only.
        </p>
      </Section>

      <Section
        id="tables-heading"
        title="OAuth tables"
        description="Five tables defined in supabase/sql/oauth_consent_foundation_phase12k.sql."
      >
        <div className="space-y-4">
          {tables.map((table) => (
            <div key={table.name} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-mono text-sm font-bold text-slate-900">{table.name}</h3>
                {table.serviceRoleOnly ? (
                  <Pill className="border-red-200 bg-red-50 text-red-900">service-role only</Pill>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-slate-600">{table.purpose}</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 uppercase tracking-wide text-slate-500">
                      <th className="py-1.5 pr-3 font-semibold">Field</th>
                      <th className="py-1.5 pr-3 font-semibold">Type</th>
                      <th className="py-1.5 font-semibold">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {table.fields.map((f) => (
                      <tr key={f.name} className="border-b border-slate-100 align-top">
                        <td className="py-1.5 pr-3 font-mono text-slate-900">{f.name}</td>
                        <td className="py-1.5 pr-3 font-mono text-slate-500">{f.type}</td>
                        <td className="py-1.5 text-slate-600">{f.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="flow-heading"
        title="Relationship flow"
        description="How developer apps connect to clients, consents, tokens, and audit events."
      >
        <ol className="space-y-3">
          {CONSENT_RELATIONSHIP_FLOW.map((step) => (
            <li
              key={step.step}
              className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-200 bg-white/80 p-4"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
                {step.step}
              </span>
              <div>
                <p className="font-semibold text-slate-900">{step.label}</p>
                <p className="mt-0.5 text-sm text-slate-600">{step.detail}</p>
              </div>
              {step.step < CONSENT_RELATIONSHIP_FLOW.length ? (
                <span className="ml-auto hidden text-slate-400 sm:inline" aria-hidden="true">
                  ↓
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="scopes-heading"
        title="Scope catalog"
        description="Approved OAuth scopes with risk classification and consent requirements."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 font-semibold">Scope</th>
                <th className="py-2 pr-3 font-semibold">Label</th>
                <th className="py-2 pr-3 font-semibold">Risk</th>
                <th className="py-2 pr-3 font-semibold">Consent</th>
                <th className="py-2 pr-3 font-semibold">Admin approval</th>
                <th className="py-2 pr-3 font-semibold">Step-up auth</th>
                <th className="py-2 font-semibold">User-facing</th>
              </tr>
            </thead>
            <tbody>
              {OAUTH_SCOPE_CATALOG.map((s) => (
                <tr key={s.scope} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-mono text-xs text-slate-900">{s.scope}</td>
                  <td className="py-2 pr-3 font-medium text-slate-900">{s.label}</td>
                  <td className="py-2 pr-3">
                    <Pill className={riskBadge[s.riskLevel]}>{s.riskLevel}</Pill>
                  </td>
                  <td className="py-2 pr-3">
                    <BoolPill value={s.requiresUserConsent} />
                  </td>
                  <td className="py-2 pr-3">
                    <BoolPill value={s.requiresAdminApproval} />
                  </td>
                  <td className="py-2 pr-3">
                    <BoolPill value={s.requiresStepUpAuth} />
                  </td>
                  <td className="py-2 text-slate-600">{s.userFacingDescription}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        id="security-heading"
        title="Security rules"
        description="Hash-only secrets, service-role token tables, RLS enabled, no wallet APIs exposed."
      >
        <ul className="space-y-2">
          {SECURITY_RULES.map((r) => (
            <li key={r.table} className="rounded-xl border border-slate-200 bg-white/80 p-3">
              <span className="font-mono text-sm font-semibold text-slate-900">{r.table}</span>
              <p className="mt-1 text-sm text-slate-600">{r.rule}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <h3 className="font-semibold text-emerald-900">Stored as hashes only</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-emerald-900/90">
              {TOKEN_SECURITY.hashOnly.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50/60 p-4">
            <h3 className="font-semibold text-red-900">Never stored</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-900/90">
              {TOKEN_SECURITY.neverStored.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4 lg:col-span-2">
            <h3 className="font-semibold text-slate-900">RLS posture</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {TOKEN_SECURITY.rls.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section
        id="status-heading"
        title="Implementation status"
        description="What exists today versus what remains blocked for future phases."
      >
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {IMPLEMENTATION_STATUS.map((item) => (
            <li
              key={item.area}
              className={`rounded-xl border p-4 ${statusTone[item.tone] || statusTone.blocked}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{item.area}</p>
              <p className="mt-1 text-lg font-bold">{item.status}</p>
            </li>
          ))}
        </ul>
      </Section>

      <p className="text-sm text-slate-600">
        Schema:{" "}
        <span className="font-mono text-xs">supabase/sql/oauth_consent_foundation_phase12k.sql</span>
        {" · "}
        <Link href="/dev-console/wallet-api-readiness" className="font-semibold text-tropicash-green-hover underline">
          Wallet API Readiness
        </Link>
        {" · "}
        <Link href="/dev-console/sdk" className="font-semibold text-tropicash-green-hover underline">
          SDK
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
