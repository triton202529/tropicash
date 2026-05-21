import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "../lib/userContext";
import { isAdminUser } from "../lib/adminAccess";
import {
  DEVELOPER_CONSOLE_ACCESS_MESSAGES,
  isDevConsoleRoute,
  userHasDeveloperConsoleAccess,
} from "../lib/developerAccessGate";
import { DevConsoleAccessDenied } from "./devconsole/DevConsoleLayout";
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
 * NOTE: This guard enforces *session presence* for protected routes. Role-based
 * gating (e.g. admin-only `/admin/*` pages) stays at the page level via
 * `isAdminUser()` from `lib/adminAccess.js`.
 *
 * Approved developer access for `/dev-console/*` is enforced here via
 * `userHasDeveloperConsoleAccess` from `lib/developerAccessGate.js` (admins
 * bypass; others need an approved `developer_access_requests` row).
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

const DEV_ACCESS_IDLE = {
  checking: false,
  allowed: true,
  reason: null,
  resolved: false,
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
  const { user, profile, loading } = useUser();

  const isPublic = PUBLIC_PATHNAMES.has(router.pathname);
  const isDevConsole =
    router.isReady && !isPublic && isDevConsoleRoute(router.pathname);

  const [devAccess, setDevAccess] = useState(DEV_ACCESS_IDLE);

  useEffect(() => {
    if (!router.isReady || isPublic) return;
    if (!isDevConsoleRoute(router.pathname)) {
      setDevAccess(DEV_ACCESS_IDLE);
      return;
    }
    if (loading) return;
    if (!user) {
      setDevAccess(DEV_ACCESS_IDLE);
      return;
    }

    const route = router.pathname;
    const email = user?.email ?? profile?.email ?? null;
    console.log("[dev-access-debug] route", route);
    console.log("[dev-access-debug] user email", email);

    if (isAdminUser(user, profile)) {
      const adminResult = { allowed: true, reason: null, request: null };
      console.log("[dev-access-debug] gate result", adminResult);
      setDevAccess({
        checking: false,
        allowed: true,
        reason: null,
        resolved: true,
      });
      return;
    }

    let cancelled = false;
    setDevAccess({
      checking: true,
      allowed: false,
      reason: null,
      resolved: false,
    });

    void userHasDeveloperConsoleAccess(user, profile).then((result) => {
      if (cancelled) return;
      console.log("[dev-access-debug] gate result", result);
      setDevAccess({
        checking: false,
        allowed: result.allowed,
        reason: result.reason,
        resolved: true,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [router.isReady, router.pathname, isPublic, loading, user, profile]);

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

  if (isDevConsole) {
    if (devAccess.checking || !devAccess.resolved) {
      return <div style={loadingShellStyle}>Checking developer access…</div>;
    }
    if (!devAccess.allowed) {
      return (
        <DevConsoleAccessDenied
          title="Developer Console"
          subtitle=""
          reason={devAccess.reason ?? DEVELOPER_CONSOLE_ACCESS_MESSAGES.none}
        />
      );
    }
  }

  return (
    <>
      <AccountSecurityRestrictionBanner />
      {children}
    </>
  );
}
