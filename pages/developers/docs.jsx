import Link from "next/link";
import Navbar from "../../components/Navbar";
import { getPhaseLabel } from "../../lib/developerCenterConfig";

const cardClass =
  "tropicash-surface flex h-full flex-col rounded-2xl p-5 sm:p-6";

const ctaPrimaryClass =
  "rounded-lg bg-tropicash-green px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-tropicash-green-hover hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

const ctaSecondaryClass =
  "rounded-lg border border-[rgba(226,232,240,0.9)] bg-[rgba(255,255,255,0.92)] px-6 py-2.5 text-sm font-semibold text-slate-800 shadow-md backdrop-blur-[6px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

const DOCS_SECTIONS = [
  {
    accent: "#0ea5e9",
    icon: "🔐",
    title: "Authentication",
    text: "Every API request will be authenticated with a developer API key. Sandbox and live keys are isolated.",
    phaseKey: "phase_2",
  },
  {
    accent: "#159669",
    icon: "👛",
    title: "Wallet API",
    text: "Create wallets, fetch balances, and inspect transaction history programmatically.",
    phaseKey: "phase_3",
  },
  {
    accent: "#2563eb",
    icon: "💳",
    title: "Payments API",
    text: "Accept one-time and recurring payments, split flows, and capture authorizations.",
    phaseKey: "phase_3",
  },
  {
    accent: "#f59e0b",
    icon: "🏦",
    title: "Payouts API",
    text: "Disburse funds to supported payout methods. Built for on-demand and scheduled payouts.",
    phaseKey: "phase_3",
  },
  {
    accent: "#8b5cf6",
    icon: "🔔",
    title: "Webhooks",
    text: "Subscribe to signed events for funding, transfers, withdrawals, and account changes.",
    phaseKey: "phase_3",
  },
  {
    accent: "#ec4899",
    icon: "🧪",
    title: "Sandbox Testing",
    text: "An isolated sandbox that mirrors production behavior without touching real funds.",
    phaseKey: "phase_2",
  },
];

const SAMPLE_REQUEST = `GET /api/v1/wallets/:id/balance HTTP/1.1
Host: api.tropicash.com
Authorization: Bearer sk_sandbox_••••••••
Accept: application/json

# Example response (preview — host/path are conceptual; not callable yet)
{
  "wallet_id": "wal_01HZX...",
  "currency": "USD",
  "available_balance": "0.00",
  "pending_balance": "0.00",
  "environment": "sandbox"
}`;

export default function DeveloperDocsPage() {
  return (
    <>
      <Navbar />
      <div className="px-4 py-8 pb-16 sm:px-6 sm:py-10">
        <main className="mx-auto flex w-full max-w-5xl flex-col">
          <header className="flex flex-col items-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
              Preview · Not Active
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Tropicash API Documentation
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Tropicash APIs will eventually let developers accept payments, manage wallets,
              send payouts, integrate with merchants, and connect to Blue Atlantic
              platforms — Tropicash, EliteHire Pro, Sentinel, and Triton. The endpoints,
              authentication, and webhook contracts shown on this page are a preview of
              what's planned. Nothing here is live yet.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              New to the platform? Start with{" "}
              <Link
                href="/developers/how-it-works"
                className="font-semibold text-blue-700 hover:underline"
              >
                How Tropicash Works
              </Link>{" "}
              for a plain-English walkthrough of the architecture before reading
              the API surface preview below.
            </p>
          </header>

          {/* API surface preview */}
          <section
            className="mt-10 sm:mt-12"
            aria-labelledby="docs-sections-heading"
          >
            <h2
              id="docs-sections-heading"
              className="mb-5 text-lg font-bold tracking-tight text-slate-900 sm:mb-6 sm:text-xl"
            >
              API surfaces (preview)
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
              {DOCS_SECTIONS.map((section) => (
                <article key={section.title} className={cardClass}>
                  <div
                    className="mb-4 h-1 w-12 shrink-0 rounded-full"
                    style={{ background: section.accent }}
                    aria-hidden
                  />
                  <span className="mb-3 text-2xl leading-none" aria-hidden>
                    {section.icon}
                  </span>
                  <h3 className="mb-2 text-lg font-bold text-slate-900">
                    {section.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                    {section.text}
                  </p>
                  <span className="mt-4 inline-flex w-fit items-center rounded-full bg-slate-100 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-600">
                    Coming in {getPhaseLabel(section.phaseKey)}
                  </span>
                </article>
              ))}
            </div>
          </section>

          {/* Sandbox runtime contracts preview */}
          <section
            className="mt-12 sm:mt-14"
            aria-labelledby="sandbox-contracts-heading"
          >
            <h2
              id="sandbox-contracts-heading"
              className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl"
            >
              Sandbox Runtime Contracts Preview
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
              Future developer traffic is modeled as{" "}
              <strong className="font-semibold text-slate-800">products</strong> (documentation
              bundles) and{" "}
              <strong className="font-semibold text-slate-800">sandbox contracts</strong>{" "}
              (illustrative HTTP shapes with embedded JSON Schema literals). Authenticated builders
              can browse the seeded catalog inside the Developer Console&apos;s Product Catalog page;
              nothing on this public site issues credentials or accepts calls.
            </p>
            <ul className="mt-4 max-w-3xl list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
              <li>
                Route previews such as <code className="rounded bg-slate-100 px-1 font-mono text-[0.75rem]">GET /sandbox/…</code>{" "}
                are placeholders — they are not served by this repository phase.
              </li>
              <li>
                Contract seeds intentionally mirror Phase 2C capability keys (
                <code className="rounded bg-slate-100 px-1 font-mono text-[0.75rem]">wallet.read</code>,{" "}
                <code className="rounded bg-slate-100 px-1 font-mono text-[0.75rem]">payment.create</code>, etc.)
                so governance, simulation, and documentation stay aligned.
              </li>
              <li>
                Rate-limit tiers, risk labels, and review flags describe intent for humans reviewing
                the catalog — they do not configure live infrastructure from static JSON.
              </li>
            </ul>
            <div
              role="note"
              className="mt-8 max-w-3xl rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-950 sm:text-[0.9375rem]"
            >
              <strong className="font-semibold">Gateway request lifecycle preview.</strong> Authenticated console work
              includes a static <strong>Phase 5C</strong> request-envelope simulation layered on catalog shapes:
              correlation triples, declared environment labels, illustrative routing summaries, delegated Phase 5B
              verification traces, audit-field previews, and rehearsal rate narratives — purely configuration modeling with
              no HTTP edge, quotas, gateways, cryptography, webhook verification, or secret material handled on-page.
            </div>
            <div
              role="note"
              className="mt-6 max-w-3xl rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm leading-relaxed text-indigo-950 sm:text-[0.9375rem]"
            >
              <strong className="font-semibold">Runtime activation governance preview.</strong> Phase 6A models
              environment isolation, runtime governance, audit readiness, and emergency controls before enabling any real
              execution environment. Signed-in developers can rehearse activation states, gates, kill switches, and safety
              envelopes in the Developer Console — deterministic configuration only, with no live runtime, APIs, workers,
              credentials, or money movement.
            </div>
            <div
              role="note"
              className="mt-6 max-w-3xl rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm leading-relaxed text-violet-950 sm:text-[0.9375rem]"
            >
              <strong className="font-semibold">Execution routing preview.</strong> Builders with console access can
              rehearse <strong className="font-semibold text-violet-950">Phase 5D execution routing</strong>: twelve
              deterministic post-gateway stages, sandbox delegate-target storytelling, dependency and reconciliation
              vocabulary, plus merges anchored to Phase 5C gateways, Phase 5B traces, Phase 4D catalog keys, and Phase
              3A/3B simulators — pure configuration narration with no workloads, routers, queues, outbound calls,
              treasury, payouts, wallets, PayPal integrations, crypto, fraud enforcement, secrets, Supabase reads, or
              wall-clock entropy.
            </div>
          </section>

          {/* Sandbox analytics preview */}
          <section
            className="mt-12 sm:mt-14"
            aria-labelledby="sandbox-analytics-preview-heading"
          >
            <h2
              id="sandbox-analytics-preview-heading"
              className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl"
            >
              Sandbox Analytics Preview
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
              Phase 4E adds{" "}
              <strong className="font-semibold text-slate-800">static simulation seeds</strong> for sandbox
              usage, per-app health grades, capability utilization, and rate-limit pressure — keyed to the
              same product and capability vocabulary as the catalog above. Signed-in developers can browse
              the rehearsed dashboards in the Developer Console; nothing here ingests live telemetry.
            </p>
            <ul className="mt-4 max-w-3xl list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
              <li>
                Counters such as simulated calls, review backlog, and throttle hits are authored for
                teaching — they are not sampled from production or sandbox traffic.
              </li>
              <li>
                Health grades and pressure labels describe narrative posture for reviewers; they do not
                invoke fraud engines, treasury systems, or quota stores.
              </li>
            </ul>
          </section>

          {/* Credential security architecture preview */}
          <section
            className="mt-12 sm:mt-14"
            aria-labelledby="credential-arch-preview-heading"
          >
            <h2
              id="credential-arch-preview-heading"
              className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl"
            >
              Credential security architecture preview
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
              Phase 5A documents how Tropicash intends to separate{" "}
              <strong className="font-semibold text-slate-800">credential metadata</strong> (rows you can
              audit in a database) from{" "}
              <strong className="font-semibold text-slate-800">actual key material</strong> (bytes that
              stay inside a vault/HSM envelope). Lifecycle states, rotation vocabulary, signing concepts,
              and vault blueprint slices are summarized for signed-in builders on the Developer Console —
              still without issuing keys or exposing secrets on public pages.
            </p>
            <ul className="mt-4 max-w-3xl list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
              <li>
                Prefix examples in documentation are shaped like future keys but contain no real
                entropy; treat every sample as inert text.
              </li>
              <li>
                Row Level Security is planned so owners can read their app&apos;s credential metadata while
                only admins can insert or mutate issuance rows — preventing self-issued production access.
              </li>
              <li>
                Nothing on the public Developer Portal stores or renders live credentials; the preview
                below remains conceptual.
              </li>
            </ul>
          </section>

          {/* Authentication simulation preview */}
          <section
            className="mt-12 sm:mt-14"
            aria-labelledby="auth-sim-preview-heading"
          >
            <h2
              id="auth-sim-preview-heading"
              className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl"
            >
              Authentication simulation preview
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
              Phase 5B adds an <strong className="font-semibold text-slate-800">Auth Simulator</strong> inside the
              Developer Console: thirteen static verification stages, nine policy envelopes, sixteen failure states,
              and ten seeded cases aligned with the Phase 4D product catalog. It explains how a future edge would
              reject, allow, or pause traffic <em>before</em> execution simulators run — without parsing real headers
              or touching secrets.
            </p>
            <ul className="mt-4 max-w-3xl list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
              <li>
                Outcomes such as <code className="rounded bg-slate-100 px-1 font-mono text-[0.75rem]">environment_denied</code>{" "}
                or <code className="rounded bg-slate-100 px-1 font-mono text-[0.75rem]">review_required</code> are
                enumerations for teaching only.
              </li>
              <li>
                Live and internal environment toggles are deliberate negative drills — they do not enable live APIs.
              </li>
            </ul>
          </section>

          {/* Sample request */}
          <section
            className="mt-12 sm:mt-14"
            aria-labelledby="docs-sample-heading"
          >
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2
                  id="docs-sample-heading"
                  className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl"
                >
                  Example request
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                  Illustrative only. The endpoint below is a planned shape, not a working
                  call. Do not embed real credentials.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-amber-900">
                Preview — not active
              </span>
            </div>
            <pre className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950 p-5 text-xs leading-relaxed text-slate-100 shadow-[0_12px_30px_rgba(15,23,42,0.12)] sm:p-6 sm:text-[0.8125rem]">
              <code>{SAMPLE_REQUEST}</code>
            </pre>
            <p className="mt-3 text-xs leading-relaxed text-slate-500 sm:text-sm">
              No real API credentials are issued today. There are no working endpoints
              behind <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.75rem] text-slate-800">api.tropicash.com</code>{" "}
              yet — the host is illustrative.
            </p>
          </section>

          {/* Safety / preview banner */}
          <section
            className="mt-12 sm:mt-14"
            aria-labelledby="docs-safety-heading"
          >
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
              <h2
                id="docs-safety-heading"
                className="text-base font-bold text-amber-900 sm:text-lg"
              >
                Preview only — read before integrating
              </h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-amber-950 sm:text-[0.9375rem]">
                <li>
                  No endpoints, hostnames, or schemas on this page are active or
                  guaranteed to ship as written.
                </li>
                <li>
                  Tropicash will not issue API keys, sandbox or live, until the developer
                  program opens later phases.
                </li>
                <li>
                  Do not store, share, or commit any value that resembles an API key
                  shown in examples. They are placeholders.
                </li>
              </ul>
            </div>
          </section>

          {/* CTA */}
          <section className="mt-12 flex flex-col items-center text-center sm:mt-14">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Want to influence the API shape?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Request developer access and tell us how you'd use these APIs. We're
              prioritizing use cases for upcoming phases.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-5">
              <Link href="/developers/request-access" className={ctaPrimaryClass}>
                Request Developer Access
              </Link>
              <Link href="/developers/roadmap" className={ctaSecondaryClass}>
                View API Roadmap
              </Link>
            </div>
          </section>

          <p className="mt-12 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm text-slate-500">
            <Link href="/developers" className="font-semibold text-blue-700 hover:underline">
              ← Developer Center
            </Link>
            <span className="text-slate-300" aria-hidden>
              |
            </span>
            <Link href="/developers/how-it-works" className="font-semibold text-blue-700 hover:underline">
              How It Works
            </Link>
            <span className="text-slate-300" aria-hidden>
              |
            </span>
            <Link href="/developers/pricing" className="font-semibold text-blue-700 hover:underline">
              Pricing
            </Link>
            <span className="text-slate-300" aria-hidden>
              |
            </span>
            <Link href="/developers/status" className="font-semibold text-blue-700 hover:underline">
              Status
            </Link>
          </p>
        </main>
      </div>
    </>
  );
}
