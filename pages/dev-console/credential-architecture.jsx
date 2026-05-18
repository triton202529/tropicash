import Link from "next/link";
import { useMemo } from "react";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  buildCredentialLifecycleSummary,
  buildCredentialRiskSummary,
  buildCredentialRotationSummary,
  buildCredentialVaultSummary,
  buildSigningModelSummary,
  CREDENTIAL_LIFECYCLE_STATUSES,
  CREDENTIAL_PREFIX_MODELS,
  CREDENTIAL_REVOCATION_MODELS,
  CREDENTIAL_RISK_LEVELS,
  CREDENTIAL_ROTATION_MODELS,
  CREDENTIAL_ROTATION_STATUSES,
  CREDENTIAL_SECURITY_RULES,
  CREDENTIAL_SIGNING_EXAMPLES,
  CREDENTIAL_SIGNING_MODELS,
  CREDENTIAL_TYPES,
  CREDENTIAL_VAULT_BLUEPRINTS,
  CREDENTIAL_VAULT_STRATEGIES,
  DEVELOPER_CREDENTIAL_PHASE,
} from "../../lib/developerCredentialArchitectureConfig";

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

export default function DevConsoleCredentialArchitecturePage() {
  const lifecycleSummary = useMemo(() => buildCredentialLifecycleSummary(), []);
  const rotationSummary = useMemo(() => buildCredentialRotationSummary(), []);
  const vaultSummary = useMemo(() => buildCredentialVaultSummary(), []);
  const signingSummary = useMemo(() => buildSigningModelSummary(), []);
  const riskSummary = useMemo(() => buildCredentialRiskSummary(), []);

  return (
    <DevConsoleLayout
      title="Credential Architecture"
      subtitle="Phase 5A — metadata modeling, lifecycle vocabulary, vault blueprint, and signing concepts. Configuration only; no Supabase calls, no issuance, no secrets on this page."
    >
      <div
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        <strong className="font-semibold">Architecture only.</strong> This page reads{" "}
        <code className="rounded bg-white/80 px-1 text-xs">lib/developerCredentialArchitectureConfig.js</code>{" "}
        and mirrors the SQL blueprint in{" "}
        <code className="rounded bg-white/80 px-1 text-xs">supabase/sql/developer_credentials_phase5a.sql</code>.
        Prefix examples are shaped like future keys but contain no real entropy.
      </div>

      {/* 1 — Lifecycle */}
      <section className={sectionClass} aria-labelledby="s1-lifecycle">
        <h2 id="s1-lifecycle" className={titleClass}>
          1. Credential lifecycle
        </h2>
        <p className={subClass}>{lifecycleSummary}</p>
        <p className="mt-3">
          <Pill>{DEVELOPER_CREDENTIAL_PHASE}</Pill>
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {CREDENTIAL_LIFECYCLE_STATUSES.map((s) => (
            <li key={s.key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{s.label}</span>
                <Pill>{s.key}</Pill>
              </div>
              <p className="mt-2 text-sm text-slate-600">{s.narrative}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-600">
          Append-only lifecycle events for credentials are modeled in SQL as{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">developer_credential_lifecycle_events</code>{" "}
          (owner read, admin write). Pair with app governance on{" "}
          <Link href="/dev-console/app-governance" className="font-semibold text-emerald-700 underline">
            Developer Governance
          </Link>{" "}
          before imagining live issuance.
        </p>
      </section>

      {/* 2 — Types */}
      <section className={sectionClass} aria-labelledby="s2-types">
        <h2 id="s2-types" className={titleClass}>
          2. Credential types
        </h2>
        <p className={subClass}>
          Each type maps to a constrained <code className="text-xs">credential_type</code> value in
          Supabase. These are identity classes — not secret payloads.
        </p>
        <ul className="mt-4 space-y-3">
          {CREDENTIAL_TYPES.map((t) => (
            <li key={t.key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold text-slate-900">{t.label}</span>
                <code className="text-xs text-slate-600">{t.key}</code>
              </div>
              <p className="mt-2 text-sm text-slate-600">{t.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 3 — Prefix examples */}
      <section className={sectionClass} aria-labelledby="s3-prefix">
        <h2 id="s3-prefix" className={titleClass}>
          3. Prefix examples (not real keys)
        </h2>
        <p className={subClass}>
          Public prefix hints help humans pick the right key in a dashboard. They are not secrets and
          never substitute for vault verification.
        </p>
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {CREDENTIAL_PREFIX_MODELS.map((p) => (
            <li key={p.key} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{p.label}</p>
              <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800">
                {p.example}
              </pre>
              <p className="mt-2 text-xs text-slate-500">{p.note}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 4 — Rotation */}
      <section className={sectionClass} aria-labelledby="s4-rotation">
        <h2 id="s4-rotation" className={titleClass}>
          4. Rotation posture
        </h2>
        <p className={subClass}>{rotationSummary}</p>
        <h3 className="mt-5 text-sm font-bold text-slate-800">Rotation status vocabulary</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {CREDENTIAL_ROTATION_STATUSES.map((r) => (
            <Pill key={r.key}>{r.key}</Pill>
          ))}
        </div>
        <h3 className="mt-6 text-sm font-bold text-slate-800">Rotation models</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {CREDENTIAL_ROTATION_MODELS.map((m) => (
            <li key={m.key} className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2">
              <span className="font-semibold text-slate-900">{m.label}.</span> {m.summary}
            </li>
          ))}
        </ul>
      </section>

      {/* 5 — Signing concepts */}
      <section className={sectionClass} aria-labelledby="s5-signing">
        <h2 id="s5-signing" className={titleClass}>
          5. Signing concepts
        </h2>
        <p className={subClass}>{signingSummary}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {Object.values(CREDENTIAL_SIGNING_MODELS).map((m) => (
            <article key={m.key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <h3 className="font-semibold text-slate-900">{m.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{m.description}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Illustrative headers
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
                {m.headers.map((h) => (
                  <li key={h}>
                    <code>{h}</code>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <h3 className="mt-6 text-sm font-bold text-slate-800">Worked-shape examples (hex is placeholder)</h3>
        <div className="mt-3 space-y-3">
          {CREDENTIAL_SIGNING_EXAMPLES.map((ex) => (
            <div key={ex.title} className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-slate-100">
              <p className="text-sm font-semibold">{ex.title}</p>
              <pre className="mt-2 overflow-x-auto text-xs leading-relaxed">
                <code>{ex.lines.join("\n")}</code>
              </pre>
              <p className="mt-2 text-xs text-slate-400">{ex.caption}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 6 — Vault blueprint */}
      <section className={sectionClass} aria-labelledby="s6-vault">
        <h2 id="s6-vault" className={titleClass}>
          6. API key vault blueprint
        </h2>
        <p className={subClass}>{vaultSummary}</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {Object.values(CREDENTIAL_VAULT_STRATEGIES).map((s) => (
            <article key={s.key} className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
              <h3 className="font-semibold text-violet-950">{s.title}</h3>
              <p className="mt-2 text-sm text-violet-950/90">{s.body}</p>
            </article>
          ))}
        </div>
        <h3 className="mt-6 text-sm font-bold text-slate-800">Layered blueprint slices</h3>
        <ul className="mt-3 space-y-3">
          {CREDENTIAL_VAULT_BLUEPRINTS.map((b) => (
            <li key={b.key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <p className="font-semibold text-slate-900">{b.title}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                {b.bullets.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {/* 7 — Risk */}
      <section className={sectionClass} aria-labelledby="s7-risk">
        <h2 id="s7-risk" className={titleClass}>
          7. Risk alignment
        </h2>
        <p className={subClass}>{riskSummary}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {CREDENTIAL_RISK_LEVELS.map((r) => (
            <li key={r.key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <Pill className="mb-2">{r.key}</Pill>
              <p className="font-semibold text-slate-900">{r.label}</p>
              <p className="mt-2 text-sm text-slate-600">{r.hint}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 8 — Safety */}
      <section className={sectionClass} aria-labelledby="s8-safety">
        <h2 id="s8-safety" className={titleClass}>
          8. Safety rules &amp; governance cross-links
        </h2>
        <p className={subClass}>
          These rules summarize how Phase 5A stays architecture-only. They align with RLS intent in the
          SQL migration (authenticated role only; no anonymous policies).
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {CREDENTIAL_SECURITY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        <h3 className="mt-6 text-sm font-bold text-slate-800">Revocation models</h3>
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          {CREDENTIAL_REVOCATION_MODELS.map((m) => (
            <li key={m.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="font-semibold text-slate-900">{m.label}.</span> {m.summary}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dev-console/my-apps"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            My Apps
          </Link>
          <Link
            href="/dev-console/app-capabilities"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            App Capabilities
          </Link>
          <Link
            href="/dev-console/product-catalog"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            Product Catalog
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
            href="/dev-console/execution-routing"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🧭 Execution Routing (Phase 5D)
          </Link>
          <Link
            href="/dev-console/runtime-activation"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🔒 Runtime Activation (Phase 6A)
          </Link>
        </div>
        <p className="mt-6 text-sm leading-relaxed text-slate-600">
          <strong className="text-slate-800">Phase 6A Runtime Activation:</strong> governance gates reference Phase 5A
          credential review (`credential_review_completed`) before any activation-ready narration — simulation only; no
          issuance, live runtime, or enforcement.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          <strong className="text-slate-800">Phase 5C Gateway Simulator:</strong> request-envelope rehearsals attach
          placeholder correlation identifiers, sandbox analytics phase anchors as metadata-only labels, illustrative audit
          field names, delegated Phase 5B traces, gateway routing previews, rehearsal rate tiers, observability placeholders,
          and runtime-state vocabulary references — purely static merges with zero issuance, cryptography, gateways, quotas,
          or operational enforcement tied to credential rows.
        </p>
      </section>
    </DevConsoleLayout>
  );
}
