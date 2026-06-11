import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import {
  GATE_RESULTS,
  evaluateOAuthWalletReadiness,
  getWalletReadinessControls,
  getRecommendedWalletReadSchema,
  getBlockedWalletFields,
  getWalletReadinessSummary,
  ASSESSED_ON,
} from "../../lib/oauthWalletReadinessGate";

const resultTone = {
  ready: "border-emerald-300 bg-emerald-50 text-emerald-950",
  info: "border-sky-300 bg-sky-50 text-sky-950",
  warn: "border-amber-300 bg-amber-50 text-amber-950",
  blocked: "border-red-300 bg-red-50 text-red-950",
};

const statusBadge = {
  passed: "border-emerald-200 bg-emerald-50 text-emerald-900",
  blocked: "border-red-200 bg-red-50 text-red-900",
  planned: "border-sky-200 bg-sky-50 text-sky-900",
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

export default function OAuthWalletReadinessPage() {
  const { user, loading: authLoading } = useUser();
  const evaluation = evaluateOAuthWalletReadiness();
  const summary = getWalletReadinessSummary();
  const categories = getWalletReadinessControls();
  const schema = getRecommendedWalletReadSchema();
  const blockedFields = getBlockedWalletFields();
  const meta = evaluation.resultMeta || GATE_RESULTS.BLOCKED_PENDING_CONTROLS;

  if (authLoading) {
    return (
      <DevConsoleLayout title="OAuth Wallet Readiness" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout
        title="OAuth Wallet Readiness"
        subtitle="Sign in to view the OAuth wallet readiness gate."
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
      title="OAuth Wallet Readiness"
      subtitle="Formal readiness gate for GET /api/oauth/wallet. Assessment only — no wallet endpoint, no wallet data, no money movement."
    >
      <div
        role="note"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        <strong className="font-semibold">Readiness gate only.</strong> This page evaluates whether
        an OAuth-protected wallet read API can safely be built. It does not expose wallet balances,
        transaction history, or any money movement.
      </div>

      {/* Gate result */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="gate-result-heading">
        <h2 id="gate-result-heading" className="text-lg font-bold text-slate-900">
          Gate result
        </h2>
        <p className="mt-1 text-sm text-slate-600">Assessed {ASSESSED_ON}. Phase {summary.phase}.</p>
        <div className={`mt-4 rounded-xl border p-4 ${resultTone[meta.tone] || resultTone.warn}`}>
          <p className="text-xs font-bold uppercase tracking-wide opacity-80">Current status</p>
          <p className="mt-1 text-xl font-bold">{meta.label}</p>
          <p className="mt-2 text-sm leading-relaxed">{meta.description}</p>
          <code className="mt-3 inline-block rounded bg-white/60 px-2 py-0.5 text-xs font-mono">
            {evaluation.result}
          </code>
        </div>
      </section>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard title="Controls passed" value={summary.controlsPassed} accent="text-emerald-700" />
        <SummaryCard title="Blocked" value={summary.controlsBlocked} accent="text-red-700" />
        <SummaryCard title="Planned" value={summary.controlsPlanned} accent="text-sky-700" />
        <SummaryCard title="Blocked fields" value={summary.blockedFieldCount} accent="text-slate-700" />
      </div>

      {/* Categories */}
      {categories.map((cat) => (
        <section
          key={cat.id}
          className="tropicash-surface rounded-2xl p-5 sm:p-6"
          aria-labelledby={`cat-${cat.id}`}
        >
          <h2 id={`cat-${cat.id}`} className="text-lg font-bold text-slate-900">
            {cat.title}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{cat.summary}</p>
          <ul className="mt-4 space-y-3">
            {cat.controls.map((ctrl) => (
              <li
                key={ctrl.id}
                className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{ctrl.label}</span>
                  <Pill className={statusBadge[ctrl.status]}>{ctrl.status}</Pill>
                </div>
                <p className="mt-1 text-slate-600">{ctrl.detail}</p>
                {ctrl.nextAction ? (
                  <p className="mt-1 text-xs font-medium text-amber-800">
                    Next: {ctrl.nextAction}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Recommended schema */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="schema-heading">
        <h2 id="schema-heading" className="text-lg font-bold text-slate-900">
          Recommended wallet read schema
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Minimal response shape for sandbox <code className="rounded bg-slate-100 px-1">GET /api/oauth/wallet</code>{" "}
          when implemented. Requires <code className="rounded bg-slate-100 px-1">wallet.read</code> scope.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-slate-900 p-3 text-xs text-slate-100">
          <code>{JSON.stringify(schema, null, 2)}</code>
        </pre>
      </section>

      {/* Blocked fields */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="blocked-heading">
        <h2 id="blocked-heading" className="text-lg font-bold text-slate-900">
          Blocked fields
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          These must never appear on an OAuth wallet read response.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {blockedFields.map((field) => (
            <li key={field}>
              <Pill className="border-red-200 bg-red-50 text-red-900">{field}</Pill>
            </li>
          ))}
        </ul>
      </section>

      {/* Next actions */}
      {evaluation.nextActions.length ? (
        <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="next-heading">
          <h2 id="next-heading" className="text-lg font-bold text-slate-900">
            Next actions
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
            {evaluation.nextActions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ol>
        </section>
      ) : null}

      <p className="text-sm text-slate-600">
        <Link
          href="/dev-console/oauth-testing"
          className="font-semibold text-tropicash-green-hover underline"
        >
          OAuth Testing
        </Link>
        {" · "}
        <Link
          href="/dev-console/wallet-api-readiness"
          className="font-semibold text-tropicash-green-hover underline"
        >
          Wallet API Readiness
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
