import { useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "../lib/userContext";
import AccountSecurityRestrictionBanner from "./AccountSecurityRestrictionBanner";

/** Pathnames that do not require a Supabase session. */
const PUBLIC_PATHNAMES = new Set([
  "/",
  "/login",
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/support",
  "/privacy",
  "/terms",
  "/developers",
  "/developers/how-it-works",
  "/developers/docs",
  "/developers/pricing",
  "/developers/roadmap",
  "/developers/status",
  "/developers/request-access",
]);

/**
 * Path prefixes that require auth but should redirect to a non-root login
 * destination instead of "/". Order matters — the first matching prefix wins.
 * Phase 1.5 introduces /dev-console as authenticated-only shell pages.
 *
 * NOTE: This guard enforces *session presence* only. Role-based gating
 * (e.g. admin-only `/admin/*` pages) is enforced at the page level via
 * `isAdminUser()` from `lib/adminAccess.js`. Do not encode admin allow-lists
 * in this file — keep admin logic next to the page that needs it.
 */
const AUTH_REDIRECT_PREFIXES = [
  { prefix: "/dev-console", redirectTo: "/login" },
];

const loadingShellStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
  color: "#94a3b8",
  fontSize: "0.95rem",
  fontWeight: 600,
};

function resolveRedirectTarget(pathname) {
  for (const rule of AUTH_REDIRECT_PREFIXES) {
    if (pathname === rule.prefix || pathname.startsWith(`${rule.prefix}/`)) {
      return rule.redirectTo;
    }
  }
  return "/";
}

export default function RouteAuthGuard({ children }) {
  const router = useRouter();
  const { user, loading } = useUser();

  const isPublic = PUBLIC_PATHNAMES.has(router.pathname);

  useEffect(() => {
    if (!router.isReady) return;
    if (isPublic) return;
    if (loading) return;

    if (!user) {
      const target = resolveRedirectTarget(router.pathname);
      router.replace(target);
    }
  }, [router, router.isReady, loading, user, isPublic]);

  if (isPublic) {
    return children;
  }

  if (!router.isReady) {
    return <div style={loadingShellStyle}>Loading…</div>;
  }

  if (loading || !user) {
    return <div style={loadingShellStyle}>Loading…</div>;
  }

  return (
    <>
      <AccountSecurityRestrictionBanner />
      {children}
    </>
  );
}
