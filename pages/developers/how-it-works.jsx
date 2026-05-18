import Link from "next/link";
import Navbar from "../../components/Navbar";

const ctaPrimaryClass =
  "rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

const ctaSecondaryClass =
  "rounded-lg border border-[rgba(226,232,240,0.9)] bg-[rgba(255,255,255,0.92)] px-6 py-2.5 text-sm font-semibold text-slate-800 shadow-md backdrop-blur-[6px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

const cardClass =
  "tropicash-surface flex h-full flex-col rounded-2xl p-5 sm:p-6";

/**
 * Conceptual layers from developer-app down to executor. The status badge
 * vocabulary is intentionally narrow:
 *   "future"    — concept, not yet started
 *   "blueprint" — designed in detail, not yet implemented
 *   "planned"   — under active design / build
 * No internal table names, SQL, secrets, or admin internals.
 */
const PLATFORM_LAYERS = [
  {
    key: "developer_app",
    number: 1,
    icon: "💻",
    title: "Developer App",
    description:
      "Your application calls Tropicash to accept payments, manage wallets, send payouts, or integrate with a Blue Atlantic platform. You build it; Tropicash handles the money plumbing.",
    status: "future",
    accent: "#0ea5e9",
  },
  {
    key: "api_gateway",
    number: 2,
    icon: "🚪",
    title: "API Gateway",
    description:
      "A single entry point that authenticates the request, performs request verification before execution, routes it to the right capability, and isolates sandbox calls from live calls. Governed routing before execution: callers eventually traverse catalog projection, delegated verification, and choreography toward sandbox adapters only after envelopes clear static gateway surfaces — rehearsed separately in authenticated console simulations. Gateway envelope before execution itself still means correlation triples (request, correlation, trace IDs), tenant labels, Phase 4D catalog keys, illustrative rate tiers, delegated Phase 5B verification traces, observability placeholders, governance hints, and audit-field previews — rehearsed statically with no gateways, quotas, middleware, cryptography, webhook verification, issuance, outbound traffic, or operational enforcement.",
    status: "planned",
    accent: "#2563eb",
  },
  {
    key: "identity",
    number: 3,
    icon: "🪪",
    title: "Identity Layer",
    description:
      "Confirms who is calling — your developer app, an admin, or another internal service — and what they are allowed to do.",
    status: "blueprint",
    accent: "#7c3aed",
  },
  {
    key: "governance",
    number: 4,
    icon: "🛡️",
    title: "Governance Layer",
    description:
      "Tracks the lifecycle of every integration. Sandbox-only? Approved for live? Under review? The governance layer answers, before the request can run.",
    status: "blueprint",
    accent: "#a21caf",
  },
  {
    key: "capability",
    number: 5,
    icon: "⚙️",
    title: "Capability Layer",
    description:
      "Resolves the request to a specific capability — like “create a payment” or “release a payout” — and applies its operational constraints.",
    status: "blueprint",
    accent: "#f59e0b",
  },
  {
    key: "orchestration",
    number: 6,
    icon: "🧠",
    title: "Orchestration Layer",
    description:
      "Walks the request through a deterministic pipeline of checks: dependencies, policy, idempotency, fraud review, and audit logging — in that order.",
    status: "blueprint",
    accent: "#16a34a",
  },
  {
    key: "observability",
    number: 7,
    icon: "📡",
    title: "Observability Layer",
    description:
      "Records timing, decisions, failures, and review pauses for every request, so the platform can be diagnosed, compared, and (safely) replayed.",
    status: "blueprint",
    accent: "#0f766e",
  },
  {
    key: "runtime_state",
    number: 8,
    icon: "🧾",
    title: "Runtime State Layer",
    description:
      "Persists every state change as an ordered event, builds a derived snapshot of where each request is, and links related events across services.",
    status: "blueprint",
    accent: "#475569",
  },
  {
    key: "execution",
    number: 9,
    icon: "🚀",
    title: "Execution Layer",
    description:
      "The future executor that performs the actual money movement once every prior layer has authorized the request. Not built yet — by design.",
    status: "future",
    accent: "#be123c",
  },
];

const STATUS_BADGES = {
  future: {
    label: "Future",
    className: "border border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
  },
  blueprint: {
    label: "Blueprint",
    className: "border border-sky-200 bg-sky-50 text-sky-800",
    dot: "bg-sky-500",
  },
  planned: {
    label: "Planned",
    className: "border border-amber-200 bg-amber-50 text-amber-900",
    dot: "bg-amber-500",
  },
};

function StatusBadge({ statusKey }) {
  const badge = STATUS_BADGES[statusKey] ?? STATUS_BADGES.future;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide ${badge.className}`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${badge.dot}`}
        aria-hidden
      />
      {badge.label}
    </span>
  );
}

const PLATFORM_CONNECTIONS = [
  {
    key: "tropicash_wallet",
    icon: "👛",
    title: "Tropicash Wallet",
    description:
      "Wallets, balances, deposits, withdrawals, and transaction history — the home base for every Tropicash account.",
    accent: "#10b981",
  },
  {
    key: "elitehire_pro",
    icon: "🤝",
    title: "EliteHire Pro",
    description:
      "Employer-to-contractor payments. Tropicash is being built to clear those payments through the wallet and reconcile them automatically.",
    accent: "#7c3aed",
  },
  {
    key: "sentinel",
    icon: "🛡️",
    title: "Sentinel",
    description:
      "Financial reporting and risk visibility for the Blue Atlantic platforms. Tropicash will report execution outcomes upstream, not raw account data.",
    accent: "#0ea5e9",
  },
  {
    key: "triton",
    icon: "🌊",
    title: "Triton",
    description:
      "The funding bridge for moving money in and out of the platform safely. Tropicash will trigger Triton transfers — never the other way around.",
    accent: "#f59e0b",
  },
];

const WHY_THIS_MATTERS = [
  {
    icon: "🛡️",
    title: "Safer money movement",
    text: "Every money-moving request walks the same authorization pipeline before anything is moved. Skipping a step is not a configuration option.",
  },
  {
    icon: "🧾",
    title: "Clear audit trails",
    text: "Every state change is captured as an immutable event. You always know what happened, in what order, on whose behalf.",
  },
  {
    icon: "🧪",
    title: "Sandbox / live separation",
    text: "Sandbox and live are independent series. Sandbox traffic never bleeds into live, and vice versa.",
  },
  {
    icon: "🚨",
    title: "Fraud review in the path",
    text: "Fraud review is a first-class pipeline stage, not a bolt-on. High-risk requests pause for review before they can be authorized.",
  },
  {
    icon: "🛠️",
    title: "Developer-ready infrastructure",
    text: "The same primitives that power Tropicash today are designed to be exposed to developers later — same shapes, same guarantees.",
  },
  {
    icon: "🌐",
    title: "Future merchant integrations",
    text: "External merchants and partners will plug into the same pipeline. The internal Blue Atlantic family is the proving ground.",
  },
];

const NOT_LIVE_BULLETS = [
  "Tropicash APIs are not active. The endpoints described on the Documentation page are previews of what's planned, not callable services.",
  "Developer keys are not being issued yet. There is no sandbox or live key program open to external developers.",
  "Public-facing endpoints are previews only. Anything that looks like an API hostname in our docs is illustrative, not routable.",
  "Live access will require review. When the API program opens, every developer goes through an access review before getting live keys.",
];

export default function HowTropicashWorksPage() {
  return (
    <>
      <Navbar />
      <div className="px-4 py-8 pb-16 sm:px-6 sm:py-10">
        <main className="mx-auto flex w-full max-w-6xl flex-col">
          {/* Hero */}
          <section className="flex w-full flex-col items-center text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
              <span
                className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
                aria-hidden
              />
              Architecture preview — not live API infrastructure
            </span>
            <h1 className="max-w-3xl text-3xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.1]">
              How <span className="text-emerald-600">Tropicash</span> Works
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Tropicash is being built as a programmable financial
              infrastructure layer for wallets, payments, payouts, and Blue
              Atlantic platform integrations.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-4 sm:gap-5">
              <Link href="/developers/request-access" className={ctaPrimaryClass}>
                Request Developer Access
              </Link>
              <Link href="/developers/roadmap" className={ctaSecondaryClass}>
                View API Roadmap
              </Link>
              <Link href="/developers/docs" className={ctaSecondaryClass}>
                Read Documentation
              </Link>
            </div>
          </section>

          {/* Stacked flow */}
          <section
            className="mt-14 w-full sm:mt-16"
            aria-labelledby="platform-flow-heading"
          >
            <div className="mb-6 flex flex-col items-start gap-1 sm:mb-8">
              <h2
                id="platform-flow-heading"
                className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
              >
                From developer request to financial action
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                Every request is designed to walk through the same nine layers,
                in the same order. Each layer has one job — and can stop the
                request before money moves.
              </p>
            </div>

            <ol className="relative flex flex-col gap-3 sm:gap-4">
              {PLATFORM_LAYERS.map((layer, idx) => {
                const isLast = idx === PLATFORM_LAYERS.length - 1;
                return (
                  <li key={layer.key} className="flex flex-col">
                    <article
                      className={cardClass}
                      style={{ borderLeft: `6px solid ${layer.accent}` }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white sm:h-10 sm:w-10 sm:text-sm"
                            aria-hidden
                          >
                            {layer.number}
                          </span>
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span aria-hidden className="text-2xl leading-none">
                              {layer.icon}
                            </span>
                            <h3 className="text-lg font-bold text-slate-900 sm:text-xl">
                              {layer.title}
                            </h3>
                          </div>
                        </div>
                        <StatusBadge statusKey={layer.status} />
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-slate-700 sm:text-[0.9375rem]">
                        {layer.description}
                      </p>
                    </article>
                    {!isLast ? (
                      <span
                        aria-hidden
                        className="mx-auto -mb-1 mt-1 text-xl text-slate-400 sm:text-2xl"
                      >
                        ↓
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Blue Atlantic platforms */}
          <section
            className="mt-14 w-full sm:mt-16"
            aria-labelledby="blue-atlantic-heading"
          >
            <div className="mb-6 flex flex-col items-start gap-1 sm:mb-8">
              <h2
                id="blue-atlantic-heading"
                className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
              >
                Blue Atlantic platform connections
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                Tropicash is the programmable money engine behind the Blue
                Atlantic platform family. Each platform connects through the
                same pipeline shown above.
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
              {PLATFORM_CONNECTIONS.map((p) => (
                <li key={p.key} className={cardClass}>
                  <div
                    className="mb-4 h-1 w-12 shrink-0 rounded-full"
                    style={{ background: p.accent }}
                    aria-hidden
                  />
                  <span className="mb-3 text-2xl leading-none" aria-hidden>
                    {p.icon}
                  </span>
                  <h3 className="mb-2 text-lg font-bold text-slate-900">
                    {p.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                    {p.description}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* Developer products & sandbox contracts */}
          <section
            className="mt-14 w-full sm:mt-16"
            aria-labelledby="developer-products-heading"
          >
            <div className="mb-6 flex flex-col items-start gap-1 sm:mb-8">
              <h2
                id="developer-products-heading"
                className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
              >
                Developer Products &amp; Sandbox Contracts
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                Beyond the nine runtime layers, Tropicash is capturing how external developers will{" "}
                <strong className="font-semibold text-slate-800">discover</strong>,{" "}
                <strong className="font-semibold text-slate-800">request</strong>, and{" "}
                <strong className="font-semibold text-slate-800">rehearse</strong> integrations.
                Phase&nbsp;4D introduces an API product catalog plus sandbox runtime contract previews:
                static metadata that maps capability keys to illustrative REST shapes, simulated
                outcomes, review posture, and rate-limit intent — still without issuing API keys or
                executing money movement.
              </p>
            </div>
            <div className={cardClass}>
              <span className="mb-3 text-2xl leading-none" aria-hidden>
                📚
              </span>
              <h3 className="mb-2 text-lg font-bold text-slate-900">
                Where to read more
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                The public Documentation page includes a{" "}
                <strong className="font-semibold text-slate-800">Sandbox Runtime Contracts Preview</strong>{" "}
                subsection. Signed-in developers will eventually browse the full seeded catalog in the
                Developer Console — today it exists so reviewers can narrate how sandbox rehearsal stays
                isolated from live traffic.
              </p>
            </div>
            <div className={`${cardClass} mt-5`}>
              <span className="mb-3 text-2xl leading-none" aria-hidden>
                📈
              </span>
              <h3 className="mb-2 text-lg font-bold text-slate-900">
                Sandbox analytics before live access
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                Phase 4E layers <strong className="font-semibold text-slate-800">simulated analytics</strong>{" "}
                on top of that catalog vocabulary: usage rows, health grades, and rate-limit pressure
                stories that stay strictly static — useful for explaining how teams might rehearse metrics
                before any real API volume exists.
              </p>
            </div>
            <div className={`${cardClass} mt-5`}>
              <span className="mb-3 text-2xl leading-none" aria-hidden>
                🔒
              </span>
              <h3 className="mb-2 text-lg font-bold text-slate-900">
                Safety boundaries before runtime activation
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                Before any future runtime activation, requests must pass governance, simulation, observability,
                reconciliation, and isolation checks in narrative form. Phase 6A rehearses activation states, gates, kill
                switches, and safety envelopes in the Developer Console — conceptual governance only; no live runtime,
                APIs, workers, credentials, or money movement.
              </p>
            </div>
            <div className={`${cardClass} mt-5`}>
              <span className="mb-3 text-2xl leading-none" aria-hidden>
                🔐
              </span>
              <h3 className="mb-2 text-lg font-bold text-slate-900">
                Credential governance before live access
              </h3>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                Phase 5A captures how API key <strong className="font-semibold text-slate-800">metadata</strong>,{" "}
                <strong className="font-semibold text-slate-800">lifecycle audits</strong>, and{" "}
                <strong className="font-semibold text-slate-800">vault blueprint</strong> slices should line up
                before any developer receives live material. Owners are modeled as read-only on credential
                rows; issuance stays admin-governed so sandbox rehearsal cannot silently escalate into
                self-granted production power.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                Signed-in builders can read the Credential Architecture page inside the Developer Console;
                public pages stay descriptive only — no secrets, no key generation, and no API traffic.
              </p>
            </div>
          </section>

          {/* Why this matters */}
          <section
            className="mt-14 w-full sm:mt-16"
            aria-labelledby="why-this-matters-heading"
          >
            <div className="mb-6 flex flex-col items-start gap-1 sm:mb-8">
              <h2
                id="why-this-matters-heading"
                className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
              >
                Why this matters
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                The architecture is opinionated for a reason. These are the
                guarantees Tropicash is designed to give every request that
                touches money.
              </p>
            </div>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {WHY_THIS_MATTERS.map((item) => (
                <li key={item.title} className={cardClass}>
                  <span className="mb-3 text-2xl leading-none" aria-hidden>
                    {item.icon}
                  </span>
                  <h3 className="mb-1.5 text-base font-bold text-slate-900 sm:text-lg">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                    {item.text}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {/* Not live yet */}
          <section
            className="mt-14 w-full sm:mt-16"
            aria-labelledby="not-live-heading"
          >
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-white/90 text-xl"
                >
                  ⚠️
                </span>
                <h2
                  id="not-live-heading"
                  className="text-lg font-bold text-amber-900 sm:text-xl"
                >
                  Not live yet
                </h2>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-amber-950 sm:text-base">
                Tropicash is in deliberate, phased construction. Here's what
                that means today:
              </p>
              <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-amber-950 sm:text-[0.9375rem]">
                {NOT_LIVE_BULLETS.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* CTA */}
          <section className="mt-14 flex flex-col items-center text-center sm:mt-16">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Want to build on Tropicash?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Request developer access and we'll reach out as the program opens
              up new phases. Your use case shapes what ships first.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-5">
              <Link href="/developers/request-access" className={ctaPrimaryClass}>
                Request Developer Access
              </Link>
              <Link href="/developers/roadmap" className={ctaSecondaryClass}>
                View API Roadmap
              </Link>
              <Link href="/developers/docs" className={ctaSecondaryClass}>
                Read Documentation
              </Link>
            </div>
          </section>

          <p className="mt-12 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm text-slate-500">
            <Link
              href="/developers"
              className="font-semibold text-blue-700 hover:underline"
            >
              ← Developer Center
            </Link>
            <span className="text-slate-300" aria-hidden>
              |
            </span>
            <Link
              href="/developers/status"
              className="font-semibold text-blue-700 hover:underline"
            >
              Platform Status
            </Link>
            <span className="text-slate-300" aria-hidden>
              |
            </span>
            <Link
              href="/"
              className="font-semibold text-blue-700 hover:underline"
            >
              Tropicash home
            </Link>
          </p>
        </main>
      </div>
    </>
  );
}
