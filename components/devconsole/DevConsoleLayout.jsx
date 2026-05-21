import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../Navbar";
import {
  DEV_CONSOLE_ROUTES,
  API_ENVIRONMENTS,
  filterDevConsoleRoutes,
} from "../../lib/developerCenterConfig";
import { isAdminUser } from "../../lib/adminAccess";
import { useUser } from "../../lib/userContext";

/**
 * Shared layout for every /dev-console route.
 *
 * Responsibilities:
 *   • Render the global Tropicash <Navbar /> at the top.
 *   • Render a left sidebar with the Developer Console sections on >= md.
 *   • Render a horizontally-scrollable section nav on small screens.
 *   • Show a "Construction" banner so users know nothing here is functional.
 *   • Expose an environment badge area for future sandbox/live toggling.
 *
 * Session + approved developer access (Phase 6C) are enforced in
 * components/RouteAuthGuard.jsx before any dev-console page mounts.
 */

const sidebarLinkBase =
  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition";
const sidebarLinkInactive =
  "text-slate-700 hover:bg-slate-100 hover:text-slate-900";
const sidebarLinkActive =
  "bg-slate-900 text-white shadow-[0_8px_20px_rgba(15,23,42,0.18)]";

const mobileTabBase =
  "whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-semibold transition";
const mobileTabInactive =
  "border-slate-200 bg-white/80 text-slate-700 hover:border-slate-300";
const mobileTabActive =
  "border-slate-900 bg-slate-900 text-white shadow-[0_6px_14px_rgba(15,23,42,0.18)]";

function isRouteActive(currentPath, routePath) {
  if (routePath === "/dev-console") return currentPath === "/dev-console";
  return currentPath === routePath || currentPath.startsWith(`${routePath}/`);
}

function DevConsoleDeniedShell({ title, subtitle, children }) {
  return (
    <DevConsoleDeniedShellPage title={title} subtitle={subtitle}>
      {children}
    </DevConsoleDeniedShellPage>
  );
}

export function DevConsoleAccessDenied({ title, subtitle, reason }) {
  return (
    <>
      <Navbar />
      <DevConsoleDeniedShell title={title} subtitle={subtitle}>
        <div
          role="status"
          className="tropicash-surface rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8"
        >
          <h2 className="text-lg font-bold text-amber-950 sm:text-xl">
            Developer Console access required
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-amber-950 sm:text-base">
            {reason}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            Approval grants entry to the Developer Console shell only — it does not
            create organizations, apps, or API keys.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/developers/request-access"
              className="inline-flex rounded-lg bg-tropicash-green px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-tropicash-green-hover"
            >
              Request developer access
            </Link>
            <Link
              href="/developers"
              className="inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Developer Portal
            </Link>
          </div>
        </div>
      </DevConsoleDeniedShell>
    </>
  );
}

function DevConsoleDeniedShellPage({ title, subtitle, children }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] px-3 py-6 sm:px-5 sm:py-8">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-tropicash-green-hover">
            Developer Console
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
              {subtitle}
            </p>
          ) : null}
        </header>
        {children}
      </div>
    </div>
  );
}

export default function DevConsoleLayout({
  title,
  subtitle,
  environment = "sandbox",
  children,
}) {
  const router = useRouter();
  const currentPath = router.pathname;
  const { user, profile } = useUser();
  const isAdmin = isAdminUser(user, profile);

  const [environmentLabel] = useState(() =>
    API_ENVIRONMENTS.includes(environment) ? environment : "sandbox",
  );

  const navItems = useMemo(() => {
    const routes = filterDevConsoleRoutes(DEV_CONSOLE_ROUTES, {
      isAdmin,
    });
    return routes.map((route) => ({
      ...route,
      active: isRouteActive(currentPath, route.path),
    }));
  }, [currentPath, isAdmin]);

  return (
    <>
      <Navbar />
      <div className="min-h-[calc(100vh-4rem)] px-3 py-6 sm:px-5 sm:py-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 md:flex-row md:gap-8">
          {/* Sidebar (desktop) */}
          <aside
            className="hidden shrink-0 md:block md:w-60 lg:w-64"
            aria-label="Developer Console navigation"
          >
            <div className="tropicash-surface sticky top-24 rounded-2xl p-3">
              <div className="px-2 pb-3 pt-1">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
                  Developer Console
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Infrastructure shell · not yet functional
                </p>
              </div>
              <nav className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`${sidebarLinkBase} ${
                      item.active ? sidebarLinkActive : sidebarLinkInactive
                    }`}
                    aria-current={item.active ? "page" : undefined}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </nav>
              <div className="mt-3 border-t border-slate-200 pt-3">
                <Link
                  href="/developers"
                  className="block rounded-xl px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-slate-100 hover:underline"
                >
                  ← Back to Developer Portal
                </Link>
              </div>
            </div>
          </aside>

          {/* Main content */}
          <section className="flex w-full min-w-0 flex-col">
            <header className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-tropicash-green-hover">
                  Developer Console
                </p>
                <h1 className="mt-1 truncate text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {title}
                </h1>
                {subtitle ? (
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                    {subtitle}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-sky-800">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />
                  Env: {environmentLabel}
                </span>
                <span className="text-[0.7rem] font-medium text-slate-500">
                  Sandbox-only preview
                </span>
              </div>
            </header>

            <nav
              aria-label="Developer Console sections"
              className="mb-5 -mx-1 overflow-x-auto md:hidden"
            >
              <ul className="flex items-center gap-2 px-1 pb-1">
                {navItems.map((item) => (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className={`${mobileTabBase} ${
                        item.active ? mobileTabActive : mobileTabInactive
                      }`}
                      aria-current={item.active ? "page" : undefined}
                    >
                      <span aria-hidden className="mr-1">
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 sm:px-5 sm:py-3.5 sm:text-[0.9375rem]">
              <strong className="font-semibold text-amber-900">
                Developer Console infrastructure is currently under construction.
              </strong>{" "}
              These screens are shell placeholders — no real keys, requests, or logs
              are being created.
            </div>

            <div className="flex flex-col gap-6">{children}</div>

            <p className="mt-12 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <Link
                href="/developers"
                className="font-semibold text-blue-700 hover:underline"
              >
                ← Developer Portal
              </Link>
              <span className="text-slate-300" aria-hidden>
                |
              </span>
              <Link
                href="/developers/roadmap"
                className="font-semibold text-blue-700 hover:underline"
              >
                Roadmap
              </Link>
              <span className="text-slate-300" aria-hidden>
                |
              </span>
              <Link
                href="/developers/status"
                className="font-semibold text-blue-700 hover:underline"
              >
                Status
              </Link>
            </p>
          </section>
        </div>
      </div>
    </>
  );
}

/**
 * Re-usable placeholder card for console pages. Each console page composes a
 * grid of these to represent the future infrastructure surface.
 */
export function DevConsolePlaceholderCard({ title, value, hint, icon }) {
  return (
    <article className="tropicash-surface flex flex-col rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
        </h3>
        {icon ? (
          <span aria-hidden className="text-lg leading-none">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {value ?? "—"}
      </p>
      {hint ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">
          {hint}
        </p>
      ) : null}
      <span className="mt-4 inline-flex w-fit items-center rounded-full bg-slate-100 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-600">
        Coming Soon
      </span>
    </article>
  );
}

/**
 * Re-usable "Coming Soon" notice for console pages that don't yet have any
 * infrastructure to surface.
 */
export function DevConsoleComingSoon({
  heading = "Coming Soon",
  description,
}) {
  return (
    <div className="tropicash-surface rounded-2xl p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white"
          aria-hidden
        >
          🚧
        </span>
        <div>
          <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
            {heading}
          </h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
