import { useEffect } from "react";
import { useRouter } from "next/router";
import { useUser } from "../lib/userContext";

/** Pathnames that do not require a Supabase session. */
const PUBLIC_PATHNAMES = new Set([
  "/",
  "/login",
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/support",
  "/security",
  "/privacy",
  "/terms",
]);

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

export default function RouteAuthGuard({ children }) {
  const router = useRouter();
  const { user, loading } = useUser();

  const isPublic = PUBLIC_PATHNAMES.has(router.pathname);

  useEffect(() => {
    if (!router.isReady) return;
    if (isPublic) return;
    if (loading) return;

    if (!user) {
      router.replace("/");
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

  return children;
}
