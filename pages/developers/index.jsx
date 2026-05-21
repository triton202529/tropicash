import Link from "next/link";
import Navbar from "../../components/Navbar";
import {
  DEVELOPER_API_PHASE,
  API_ENVIRONMENTS,
  BLUE_ATLANTIC_PLATFORMS,
} from "../../lib/developerCenterConfig";

const cardClass =
  "tropicash-surface flex h-full flex-col rounded-2xl p-5 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.10)] sm:p-6";

const ctaPrimaryClass =
  "rounded-lg bg-tropicash-green px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-tropicash-green-hover hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

const ctaSecondaryClass =
  "rounded-lg border border-[rgba(226,232,240,0.9)] bg-[rgba(255,255,255,0.92)] px-6 py-2.5 text-sm font-semibold text-slate-800 shadow-md backdrop-blur-[6px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

const API_SECTIONS = [
  {
    accent: "#2563eb",
    icon: "💳",
    title: "Payments API",
    text: "Accept payments from customers across Tropicash and partner platforms. Power one-time charges, recurring billing, and split flows.",
    status: "Planned — Phase 3",
  },
  {
    accent: "#159669",
    icon: "👛",
    title: "Wallet API",
    text: "Programmatically create and manage Tropicash wallets, query balances, move funds between wallets, and stream transaction history.",
    status: "Planned — Phase 3",
  },
  {
    accent: "#f59e0b",
    icon: "🏦",
    title: "Payouts API",
    text: "Send money out to bank accounts, cards, and supported payout methods. Built for scheduled disbursements and on-demand transfers.",
    status: "Planned — Phase 3",
  },
  {
    accent: "#8b5cf6",
    icon: "🔔",
    title: "Webhooks",
    text: "Subscribe to real-time events for funding, transfers, withdrawals, fraud reviews, and account status updates with signed deliveries.",
    status: "Planned — Phase 3",
  },
  {
    accent: "#0ea5e9",
    icon: "🧪",
    title: "Sandbox Testing",
    text: "A fully isolated sandbox environment for development. Mirror production behavior without touching real funds or live wallets.",
    status: "Planned — Phase 2",
  },
  {
    accent: "#ec4899",
    icon: "🌐",
    title: "Blue Atlantic Integrations",
    text: "First-class connectors for EliteHire Pro payments, Sentinel financial reporting, and the Triton funding & withdrawal bridge.",
    status: "Planned — Phase 4",
  },
];

export default function DevelopersLanding() {
  return (
    <>
      <Navbar />
      <div className="px-4 py-8 pb-16 sm:px-6 sm:py-10">
        <main className="mx-auto flex w-full max-w-6xl flex-col">
          {/* Hero */}
          <section className="flex w-full flex-col items-center text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-tropicash-green-tint bg-tropicash-green-tint px-3 py-1 text-xs font-semibold uppercase tracking-wide text-tropicash-green-hover">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-tropicash-green" aria-hidden />
              Developer Preview · Phase: {DEVELOPER_API_PHASE}
            </span>
            <h1 className="max-w-3xl text-3xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl sm:leading-[1.1]">
              Build with <span className="text-tropicash-green">Tropicash</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Tropicash APIs will let businesses and developers accept payments, move money,
              create wallet flows, and connect directly to Blue Atlantic platforms —
              including EliteHire Pro, Sentinel, and Triton. Join the early developer
              program to shape the roadmap.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-4 sm:gap-5">
              <Link href="/developers/request-access" className={ctaPrimaryClass}>
                Request Developer Access
              </Link>
              <Link href="/developers/roadmap" className={ctaSecondaryClass}>
                View API Roadmap
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-blue-700 sm:text-sm">
              <Link href="/developers/how-it-works" className="hover:underline">
                How It Works
              </Link>
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <Link href="/developers/docs" className="hover:underline">
                Documentation
              </Link>
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <Link href="/developers/pricing" className="hover:underline">
                Pricing
              </Link>
              <span className="text-slate-300" aria-hidden>
                ·
              </span>
              <Link href="/developers/status" className="hover:underline">
                Status
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-slate-500 sm:text-sm">
              <span>
                Environments:{" "}
                {API_ENVIRONMENTS.map((env, i) => (
                  <span key={env}>
                    <span className="font-semibold text-slate-700">{env}</span>
                    {i < API_ENVIRONMENTS.length - 1 ? " · " : null}
                  </span>
                ))}
              </span>
              <span className="hidden text-slate-300 sm:inline" aria-hidden>
                |
              </span>
              <span>Powered by the Blue Atlantic platform family</span>
            </div>
          </section>

          {/* How It Works — prominent link */}
          <section
            className="mt-14 w-full sm:mt-16"
            aria-labelledby="how-it-works-promo-heading"
          >
            <Link
              href="/developers/how-it-works"
              className="group block"
            >
              <div className="tropicash-surface flex flex-col gap-4 rounded-2xl p-6 transition-all duration-200 ease-in-out group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_36px_rgba(15,23,42,0.10)] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-8">
                <div className="flex items-start gap-4 sm:items-center">
                  <span
                    aria-hidden
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white/90 text-2xl"
                  >
                    🧭
                  </span>
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-2 rounded-full border border-tropicash-green-tint bg-tropicash-green-tint px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-tropicash-green-hover">
                      Architecture preview
                    </span>
                    <h2
                      id="how-it-works-promo-heading"
                      className="mt-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
                    >
                      How Tropicash Works
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                      A plain-English walkthrough of the Tropicash platform —
                      from your developer app down to wallet, payment, and
                      payout actions, and how the Blue Atlantic family connects
                      in.
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center self-start rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-sm font-semibold text-blue-700 group-hover:underline sm:self-auto">
                  See the architecture →
                </span>
              </div>
            </Link>
          </section>

          {/* API surfaces */}
          <section
            className="mt-14 w-full sm:mt-16"
            aria-labelledby="developer-apis-heading"
          >
            <div className="mb-6 flex flex-col items-start gap-1 sm:mb-8">
              <h2
                id="developer-apis-heading"
                className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
              >
                What you'll be able to build
              </h2>
              <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                A focused, opinionated API surface — designed for the Caribbean fintech
                stack and the Blue Atlantic platform family.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
              {API_SECTIONS.map((section) => (
                <article key={section.title} className={cardClass}>
                  <div
                    className="mb-4 h-1 w-12 shrink-0 rounded-full"
                    style={{ background: section.accent }}
                    aria-hidden
                  />
                  <span className="mb-3 text-2xl leading-none" aria-hidden>
                    {section.icon}
                  </span>
                  <h3 className="mb-2 text-lg font-bold text-slate-900">{section.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                    {section.text}
                  </p>
                  <span className="mt-4 inline-flex w-fit items-center rounded-full bg-slate-100 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-600">
                    {section.status}
                  </span>
                </article>
              ))}
            </div>
          </section>

          {/* Platform family */}
          <section
            className="mt-14 w-full sm:mt-16"
            aria-labelledby="platform-family-heading"
          >
            <div className="tropicash-surface rounded-2xl p-6 sm:p-8">
              <h2
                id="platform-family-heading"
                className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
              >
                One programmable engine, multiple platforms
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Tropicash is becoming the programmable payment engine behind the entire
                Blue Atlantic family. Build once, connect everywhere.
              </p>
              <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {BLUE_ATLANTIC_PLATFORMS.map((name) => (
                  <li
                    key={name}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm font-semibold text-slate-800 sm:text-base"
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full bg-tropicash-green"
                      aria-hidden
                    />
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Developer Console (Coming Soon) */}
          <section
            className="mt-14 w-full sm:mt-16"
            aria-labelledby="dev-console-coming-heading"
          >
            <div className="tropicash-surface flex flex-col items-start gap-4 rounded-2xl p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-8">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-amber-900">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                  Coming Soon
                </span>
                <h2
                  id="dev-console-coming-heading"
                  className="mt-3 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"
                >
                  Developer Console
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                  An authenticated infrastructure surface for managing apps, API keys,
                  webhooks, request logs, and sandbox resources. The console is being
                  built — sign in to preview the shell once it's wired up.
                </p>
              </div>
            </div>
          </section>

          {/* Bottom CTA */}
          <section className="mt-14 flex w-full flex-col items-center text-center sm:mt-16">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Ready to build?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Request developer access and we'll reach out as the Tropicash API program
              opens up new phases.
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
            <Link href="/" className="font-semibold text-blue-700 hover:underline">
              ← Back to Tropicash
            </Link>
            <span className="text-slate-300" aria-hidden>
              |
            </span>
            <Link href="/support" className="font-semibold text-blue-700 hover:underline">
              Contact support
            </Link>
          </p>
        </main>
      </div>
    </>
  );
}
