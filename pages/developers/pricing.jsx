import Link from "next/link";
import Navbar from "../../components/Navbar";

const PRICING_TIERS = [
  {
    key: "sandbox",
    name: "Sandbox",
    price: "Free",
    accent: "#0ea5e9",
    description:
      "For development and testing in an isolated environment. No live funds, no real wallets.",
    features: [
      "Unlimited sandbox API requests",
      "Sandbox-only API keys",
      "Webhook deliveries to test endpoints",
      "Community support",
    ],
  },
  {
    key: "startup",
    name: "Startup",
    price: "TBD",
    accent: "#159669",
    description:
      "For early-stage builders moving the first real transactions on Tropicash.",
    features: [
      "Live API access (capped requests/month)",
      "Standard webhook reliability",
      "Payouts via supported methods",
      "Email support",
    ],
  },
  {
    key: "growth",
    name: "Growth",
    price: "TBD",
    accent: "#2563eb",
    description:
      "For platforms scaling payment volume and Blue Atlantic integrations.",
    features: [
      "Higher request limits",
      "Priority webhook delivery",
      "Expanded payout coverage",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: "Custom",
    accent: "#8b5cf6",
    description:
      "For merchants and partners with custom volume, compliance, and integration needs.",
    features: [
      "Custom request limits",
      "Dedicated webhook infrastructure",
      "Custom payout and treasury arrangements",
      "Dedicated technical contact",
    ],
  },
];

const ctaPrimaryClass =
  "rounded-lg bg-tropicash-green px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-tropicash-green-hover hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

const ctaSecondaryClass =
  "rounded-lg border border-[rgba(226,232,240,0.9)] bg-[rgba(255,255,255,0.92)] px-6 py-2.5 text-sm font-semibold text-slate-800 shadow-md backdrop-blur-[6px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

export default function DeveloperPricingPage() {
  return (
    <>
      <Navbar />
      <div className="px-4 py-8 pb-16 sm:px-6 sm:py-10">
        <main className="mx-auto flex w-full max-w-6xl flex-col">
          <header className="flex flex-col items-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
              Pricing not finalized
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Developer Pricing
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
              A first look at the planned Tropicash developer tiers. Final pricing,
              limits, and features will be confirmed before any live API access is
              enabled. Sandbox will always have a free tier for development.
            </p>
          </header>

          <section
            className="mt-10 grid grid-cols-1 gap-5 sm:mt-12 md:grid-cols-2 md:gap-6 lg:grid-cols-4"
            aria-labelledby="pricing-tiers-heading"
          >
            <h2 id="pricing-tiers-heading" className="sr-only">
              Planned developer pricing tiers
            </h2>
            {PRICING_TIERS.map((tier) => {
              const baseClass =
                "tropicash-surface flex h-full flex-col rounded-2xl p-5 sm:p-6";
              const cardClass = tier.highlighted
                ? `${baseClass} ring-2 ring-tropicash-green/30`
                : baseClass;
              return (
                <article key={tier.key} className={cardClass}>
                  <div
                    className="mb-4 h-1 w-12 shrink-0 rounded-full"
                    style={{ background: tier.accent }}
                    aria-hidden
                  />
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-slate-900 sm:text-xl">
                      {tier.name}
                    </h3>
                    {tier.highlighted ? (
                      <span className="inline-flex items-center rounded-full border border-tropicash-green-tint bg-tropicash-green-tint px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-tropicash-green-hover">
                        Likely best fit
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                    {tier.description}
                  </p>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                      {tier.price}
                    </span>
                    {tier.price !== "Free" && tier.price !== "Custom" ? (
                      <span className="text-xs font-medium text-slate-500">
                        / month
                      </span>
                    ) : null}
                  </div>
                  <ul className="mt-5 flex-1 space-y-2 text-sm leading-relaxed text-slate-700 sm:text-[0.9375rem]">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span
                          className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-tropicash-green"
                          aria-hidden
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="mt-6 inline-flex w-fit items-center rounded-full bg-slate-100 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-600">
                    Coming in future release
                  </span>
                </article>
              );
            })}
          </section>

          <section className="mt-10 sm:mt-12">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:p-6 sm:text-[0.9375rem]">
              <strong className="font-semibold text-amber-900">
                Pricing is not finalized.
              </strong>{" "}
              These tiers are directional. Limits, prices, and included features will
              change before launch. Today there are no charges, no billing, and no live
              API access.
            </div>
          </section>

          {/* CTA */}
          <section className="mt-12 flex flex-col items-center text-center sm:mt-14">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Building something specific?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              If your use case doesn't fit a standard tier, tell us what you're planning
              and we'll factor it into pricing decisions.
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
            <Link href="/developers/docs" className="font-semibold text-blue-700 hover:underline">
              Documentation
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
