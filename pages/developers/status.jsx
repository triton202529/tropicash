import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import {
  PLATFORM_STATUS,
  PLATFORM_STATUS_COMPONENTS,
} from "../../lib/developerCenterConfig";

function formatTimestamp(date) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch (e) {
    void e;
    return date.toISOString();
  }
}

export default function DeveloperStatusPage() {
  // Render the "last updated" stamp on the client to avoid SSR hydration
  // mismatches. The actual underlying data is static for Phase 1.5.
  const [lastUpdated, setLastUpdated] = useState(null);
  useEffect(() => {
    setLastUpdated(new Date());
  }, []);

  return (
    <>
      <Navbar />
      <div className="px-4 py-8 pb-16 sm:px-6 sm:py-10">
        <main className="mx-auto flex w-full max-w-4xl flex-col">
          <header className="flex flex-col items-start">
            <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-800">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />
              Developer Infrastructure
            </span>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Platform Status
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
              The current state of Tropicash developer infrastructure. All services
              below are in active development — none are serving live developer
              traffic yet.
            </p>
            <p className="mt-3 text-xs font-medium text-slate-500 sm:text-sm">
              Last updated:{" "}
              <span suppressHydrationWarning>
                {lastUpdated ? formatTimestamp(lastUpdated) : "—"}
              </span>
            </p>
          </header>

          <section
            className="mt-8 sm:mt-10"
            aria-labelledby="status-components-heading"
          >
            <h2
              id="status-components-heading"
              className="mb-4 text-lg font-bold tracking-tight text-slate-900 sm:mb-5 sm:text-xl"
            >
              Components
            </h2>
            <ul className="tropicash-surface divide-y divide-slate-200 overflow-hidden rounded-2xl">
              {PLATFORM_STATUS_COMPONENTS.map((component) => {
                const status =
                  PLATFORM_STATUS[component.statusKey] ?? PLATFORM_STATUS.development;
                return (
                  <li
                    key={component.key}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${status.dotClass}`}
                        aria-hidden
                      />
                      <span className="text-sm font-semibold text-slate-900 sm:text-base">
                        {component.label}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide ${status.badgeClass}`}
                    >
                      {status.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="mt-8 sm:mt-10">
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-relaxed text-sky-950 sm:p-6 sm:text-[0.9375rem]">
              <strong className="font-semibold text-sky-900">Operational note:</strong>{" "}
              Tropicash Developer Infrastructure is currently in active development.
              Live API traffic, sandbox provisioning, and webhook delivery will be
              rolled out in phases. See the{" "}
              <Link
                href="/developers/roadmap"
                className="font-semibold text-blue-700 hover:underline"
              >
                API Roadmap
              </Link>{" "}
              for the staged plan.
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
            <Link href="/developers/pricing" className="font-semibold text-blue-700 hover:underline">
              Pricing
            </Link>
          </p>
        </main>
      </div>
    </>
  );
}
