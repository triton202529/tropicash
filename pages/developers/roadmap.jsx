import Link from "next/link";
import Navbar from "../../components/Navbar";
import { DEVELOPER_API_PHASE } from "../../lib/developerCenterConfig";

const PHASES = [
  {
    key: "phase-1",
    label: "Phase 1",
    title: "Developer Center foundation",
    status: "in_progress",
    items: [
      "Developer Center foundation",
      "API key system planning",
      "Internal documentation",
      "Sandbox / live environment separation planning",
    ],
  },
  {
    key: "phase-2",
    label: "Phase 2",
    title: "Developer accounts & API keys",
    status: "planned",
    items: [
      "API keys",
      "App registration",
      "Request logs",
      "Scoped permissions",
    ],
  },
  {
    key: "phase-3",
    label: "Phase 3",
    title: "Core money-movement APIs",
    status: "planned",
    items: [
      "Wallet APIs",
      "Payment APIs",
      "Payout APIs",
      "Webhook events",
    ],
  },
  {
    key: "phase-4",
    label: "Phase 4",
    title: "Blue Atlantic integrations",
    status: "planned",
    items: [
      "EliteHire Pro payments",
      "Sentinel reporting",
      "Triton funding bridge",
    ],
  },
  {
    key: "phase-5",
    label: "Phase 5",
    title: "External developers & merchants",
    status: "planned",
    items: [
      "External merchant onboarding",
      "SDKs",
      "API docs",
      "Production access review",
    ],
  },
];

const statusBadge = {
  in_progress: {
    label: "In progress",
    className:
      "border border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
  },
  planned: {
    label: "Planned",
    className: "border border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
  },
};

const phaseCardClass =
  "tropicash-surface rounded-2xl p-5 sm:p-6";

const ctaPrimaryClass =
  "rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

const ctaSecondaryClass =
  "rounded-lg border border-[rgba(226,232,240,0.9)] bg-[rgba(255,255,255,0.92)] px-6 py-2.5 text-sm font-semibold text-slate-800 shadow-md backdrop-blur-[6px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

export default function DeveloperRoadmapPage() {
  return (
    <>
      <Navbar />
      <div className="px-4 py-8 pb-16 sm:px-6 sm:py-10">
        <main className="mx-auto flex w-full max-w-4xl flex-col">
          <header className="mb-8 sm:mb-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
              Developer Center
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              API Roadmap
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              The Tropicash API is rolling out in deliberate phases. We're building the
              programmable payment engine for Tropicash, EliteHire Pro, Sentinel, Triton,
              and future external developers — and we want to ship it safely.
            </p>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
              Current phase:{" "}
              <span className="font-semibold text-slate-800">
                {DEVELOPER_API_PHASE}
              </span>
              . Timelines below are intentions, not commitments.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              For the architecture story behind these phases, read{" "}
              <Link
                href="/developers/how-it-works"
                className="font-semibold text-blue-700 hover:underline"
              >
                How Tropicash Works
              </Link>
              .
            </p>
          </header>

          <ol className="relative space-y-5 sm:space-y-6">
            {PHASES.map((phase, idx) => {
              const badge = statusBadge[phase.status] ?? statusBadge.planned;
              return (
                <li key={phase.key} className={phaseCardClass}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white sm:text-sm"
                        aria-hidden
                      >
                        {idx + 1}
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {phase.label}
                        </p>
                        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                          {phase.title}
                        </h2>
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide ${badge.className}`}
                    >
                      <span
                        className={`inline-block h-1.5 w-1.5 rounded-full ${badge.dot}`}
                        aria-hidden
                      />
                      {badge.label}
                    </span>
                  </div>
                  <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {phase.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm leading-relaxed text-slate-700 sm:text-[0.9375rem]"
                      >
                        <span
                          className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                          aria-hidden
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>

          <section className="mt-12 flex flex-col items-center text-center sm:mt-14">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Want early access?
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
              Tell us what you're building. We'll prioritize use cases that align with
              upcoming phases.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:gap-5">
              <Link href="/developers/request-access" className={ctaPrimaryClass}>
                Request Developer Access
              </Link>
              <Link href="/developers" className={ctaSecondaryClass}>
                Back to Developer Center
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
            <Link href="/" className="font-semibold text-blue-700 hover:underline">
              Tropicash home
            </Link>
          </p>
        </main>
      </div>
    </>
  );
}
