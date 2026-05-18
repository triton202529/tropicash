import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "960px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "transparent",
  boxSizing: "border-box",
  overflowX: "hidden",
};

const cardBase = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
};

const btnSm = {
  padding: "0.32rem 0.55rem",
  fontSize: "0.68rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
  marginTop: "0.25rem",
};

const STATUS = {
  PASS: "Pass",
  WARN: "Warning",
  FAIL: "Fail",
};

function statusBadge(status) {
  const isPass = status === STATUS.PASS;
  const isWarn = status === STATUS.WARN;
  const isFail = status === STATUS.FAIL;
  return {
    display: "inline-block",
    padding: "0.15rem 0.45rem",
    borderRadius: "6px",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: isPass ? "#ecfdf5" : isWarn ? "#fffbeb" : isFail ? "#fef2f2" : "#f1f5f9",
    color: isPass ? "#047857" : isWarn ? "#92400e" : isFail ? "#b91c1c" : "#64748b",
    border: `1px solid ${isPass ? "#a7f3d0" : isWarn ? "#fcd34d" : isFail ? "#fecaca" : "#e2e8f0"}`,
    whiteSpace: "nowrap",
  };
}

function truncate(text, max = 200) {
  const s = String(text == null ? "" : text);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function classifyTableError(error) {
  if (!error) return null;
  const code = String(error.code || "").trim();
  const msg = String(error.message || "").toLowerCase();
  const isMissing =
    code === "42P01" || msg.includes("does not exist") || msg.includes("relation ");
  return {
    severity: isMissing ? STATUS.FAIL : STATUS.WARN,
    detail: truncate(error.message || error.code || "Unknown error"),
  };
}

async function checkSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return {
      status: STATUS.FAIL,
      detail: "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    };
  }
  try {
    const { error } = await supabase.auth.getSession();
    if (error) {
      return { status: STATUS.WARN, detail: truncate(error.message) };
    }
    return { status: STATUS.PASS, detail: "Env vars set and client initialised." };
  } catch (e) {
    return { status: STATUS.WARN, detail: truncate(e?.message || "Client call failed.") };
  }
}

async function checkAuthSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return { status: STATUS.WARN, detail: truncate(error.message) };
    }
    const session = data?.session;
    if (!session) {
      return { status: STATUS.WARN, detail: "No active session — sign back in." };
    }
    const expiresAt = session.expires_at ? new Date(session.expires_at * 1000) : null;
    const detail = expiresAt
      ? `Signed in. Session expires ${expiresAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`
      : "Signed in.";
    return { status: STATUS.PASS, detail };
  } catch (e) {
    return { status: STATUS.WARN, detail: truncate(e?.message || "Auth call failed.") };
  }
}

async function checkTableReachable(table) {
  try {
    const { error, count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) {
      const classified = classifyTableError(error);
      return { status: classified.severity, detail: classified.detail };
    }
    const n = typeof count === "number" ? count : null;
    return {
      status: STATUS.PASS,
      detail: n == null ? "Reachable." : `Reachable. Visible rows (RLS-scoped): ${n.toLocaleString()}.`,
    };
  } catch (e) {
    return { status: STATUS.WARN, detail: truncate(e?.message || "Query failed.") };
  }
}

function checkPaypalMode() {
  const raw = process.env.NEXT_PUBLIC_PAYPAL_MODE;
  const mode = typeof raw === "string" ? raw.trim() : "";
  if (mode === "live" || mode === "sandbox") {
    return { status: STATUS.PASS, detail: `Mode: ${mode}.` };
  }
  if (!mode) {
    return {
      status: STATUS.WARN,
      detail: "NEXT_PUBLIC_PAYPAL_MODE not set — defaults to sandbox.",
    };
  }
  return {
    status: STATUS.WARN,
    detail: `Unexpected value "${truncate(mode, 60)}" — expected "live" or "sandbox".`,
  };
}

async function checkPwaManifest() {
  try {
    const res = await fetch("/manifest.json", { credentials: "same-origin" });
    if (!res.ok) {
      return { status: STATUS.FAIL, detail: `HTTP ${res.status} fetching /manifest.json.` };
    }
    let json;
    try {
      json = await res.json();
    } catch (e) {
      return { status: STATUS.FAIL, detail: truncate(`Manifest is not valid JSON: ${e?.message || ""}`) };
    }
    const icons = Array.isArray(json?.icons) ? json.icons : [];
    if (icons.length === 0) {
      return { status: STATUS.WARN, detail: "Manifest loaded but no icons[] entries." };
    }
    return {
      status: STATUS.PASS,
      detail: `Manifest OK. Icons declared: ${icons.length}.`,
    };
  } catch (e) {
    return { status: STATUS.FAIL, detail: truncate(e?.message || "fetch failed.") };
  }
}

const CHECK_DEFS = [
  {
    key: "supabase_env",
    label: "Supabase environment connected",
    description: "Verifies the public Supabase URL and anon key are wired into the client.",
    run: () => checkSupabaseEnv(),
  },
  {
    key: "auth",
    label: "Auth working",
    description: "Confirms supabase.auth.getSession() resolves and an admin session is active.",
    run: () => checkAuthSession(),
  },
  {
    key: "wallets",
    label: "Wallet table reachable",
    description: "Head-only count on wallets to confirm the table exists and RLS responds.",
    run: () => checkTableReachable("wallets"),
  },
  {
    key: "transactions",
    label: "Transactions table reachable",
    description: "Head-only count on transactions.",
    run: () => checkTableReachable("transactions"),
  },
  {
    key: "withdrawal_requests",
    label: "Withdrawal requests table reachable",
    description: "Head-only count on withdrawal_requests.",
    run: () => checkTableReachable("withdrawal_requests"),
  },
  {
    key: "fraud_logs",
    label: "Fraud logs table reachable",
    description: "Head-only count on fraud_logs.",
    run: () => checkTableReachable("fraud_logs"),
  },
  {
    key: "operational_logs",
    label: "Operational logs table reachable",
    description: "Head-only count on operational_logs.",
    run: () => checkTableReachable("operational_logs"),
  },
  {
    key: "tester_feedback",
    label: "Tester feedback table reachable",
    description: "Head-only count on tester_feedback.",
    run: () => checkTableReachable("tester_feedback"),
  },
  {
    key: "request_limits",
    label: "Request limits table reachable",
    description: "Head-only count on request_limits (soft-launch abuse-protection counters).",
    run: () => checkTableReachable("request_limits"),
  },
  {
    key: "notifications",
    label: "Notifications table reachable",
    description: "Head-only count on notifications.",
    run: () => checkTableReachable("notifications"),
  },
  {
    key: "paypal_mode",
    label: "PayPal mode configured",
    description: "Reads NEXT_PUBLIC_PAYPAL_MODE and confirms it is exactly live or sandbox.",
    run: async () => checkPaypalMode(),
  },
  {
    key: "pwa_manifest",
    label: "PWA manifest/icons detected",
    description: "Fetches /manifest.json at runtime and validates icons[] is non-empty.",
    run: () => checkPwaManifest(),
  },
];

export default function AdminHealthPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [results, setResults] = useState({});
  const [running, setRunning] = useState(false);
  const [lastRunAt, setLastRunAt] = useState(null);

  const runChecks = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setRunning(true);
    const initial = {};
    for (const def of CHECK_DEFS) initial[def.key] = { status: null, detail: "Running…" };
    setResults(initial);
    const settled = await Promise.all(
      CHECK_DEFS.map(async (def) => {
        try {
          const r = await def.run();
          return [def.key, r];
        } catch (e) {
          return [def.key, { status: STATUS.WARN, detail: truncate(e?.message || "Check threw.") }];
        }
      })
    );
    setResults(Object.fromEntries(settled));
    setLastRunAt(new Date());
    setRunning(false);
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void runChecks();
  }, [authLoading, user, profile, runChecks]);

  const summary = useMemo(() => {
    let pass = 0;
    let warn = 0;
    let fail = 0;
    for (const def of CHECK_DEFS) {
      const r = results[def.key];
      if (!r || r.status == null) continue;
      if (r.status === STATUS.PASS) pass += 1;
      else if (r.status === STATUS.WARN) warn += 1;
      else if (r.status === STATUS.FAIL) fail += 1;
    }
    return { pass, warn, fail };
  }, [results]);

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading…</p>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Sign in to view this page.</p>
          <Link
            href="/login"
            style={{ display: "inline-block", marginTop: "1rem", fontWeight: 600, color: "#0ea5e9" }}
          >
            Go to login
          </Link>
        </div>
      </>
    );
  }

  if (!isAdminUser(user, profile)) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Not authorized</h2>
        <p>This area is restricted to admin users.</p>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href="/admin" style={{ color: "#38bdf8", fontWeight: 600, fontSize: "0.9rem" }}>
            ← Admin home
          </Link>
        </div>
        <h1
          style={{
            fontSize: "clamp(1.25rem, 4vw, 1.55rem)",
            fontWeight: 700,
            color: "#0f172a",
            margin: "0 0 0.5rem",
            letterSpacing: "-0.02em",
          }}
        >
          Health check
        </h1>
        <p
          style={{
            margin: "0 0 1rem",
            fontSize: "0.875rem",
            color: "#64748b",
            maxWidth: "42rem",
            lineHeight: 1.55,
          }}
        >
          Read-only readiness checks for the Tropicash deployment. All probes use safe reads (no
          writes, updates, or deletes). Use this page after a release or whenever something looks
          off in production.
        </p>

        <div
          style={{
            ...cardBase,
            padding: "0.85rem 1rem",
            marginBottom: "1rem",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.65rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              Summary
            </p>
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.95rem",
                color: "#0f172a",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span style={{ color: "#047857" }}>{summary.pass} passing</span>
              <span style={{ color: "#94a3b8" }}> · </span>
              <span style={{ color: "#92400e" }}>{summary.warn} warnings</span>
              <span style={{ color: "#94a3b8" }}> · </span>
              <span style={{ color: "#b91c1c" }}>{summary.fail} failing</span>
            </p>
            {lastRunAt ? (
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
                Last run:{" "}
                {lastRunAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void runChecks()}
            disabled={running}
            style={{
              ...btnSm,
              marginTop: 0,
              opacity: running ? 0.65 : 1,
              cursor: running ? "not-allowed" : "pointer",
            }}
          >
            {running ? "Running…" : "Re-run checks"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
            gap: "0.85rem",
          }}
        >
          {CHECK_DEFS.map((def) => {
            const r = results[def.key];
            const status = r?.status ?? null;
            const detail = r?.detail ?? "";
            return (
              <div key={def.key} style={{ ...cardBase, padding: "1rem 1.1rem" }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      lineHeight: 1.35,
                      wordBreak: "break-word",
                      minWidth: 0,
                      flex: "1 1 12rem",
                    }}
                  >
                    {def.label}
                  </p>
                  <span style={statusBadge(status)}>{status ?? "—"}</span>
                </div>
                <p
                  style={{
                    margin: "0 0 0.35rem",
                    fontSize: "0.78rem",
                    color: "#64748b",
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}
                >
                  {def.description}
                </p>
                {detail ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.78rem",
                      color: "#475569",
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}
                  >
                    <strong style={{ color: "#334155" }}>Detail:</strong> {truncate(detail)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div style={{ ...cardBase, padding: "1.1rem 1.15rem", marginTop: "1.25rem" }}>
          <h2
            style={{
              margin: "0 0 0.65rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Deployment notes
          </h2>
          <p
            style={{
              margin: "0 0 0.65rem",
              fontSize: "0.8rem",
              color: "#475569",
              lineHeight: 1.55,
            }}
          >
            Reminders for the operator before / after pushing a build. None of these are automated.
          </p>
          <ol
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              fontSize: "0.85rem",
              color: "#0f172a",
              lineHeight: 1.55,
              display: "grid",
              gap: "0.4rem",
            }}
          >
            <li>
              Run the latest SQL migrations in Supabase — in particular{" "}
              <code style={{ fontSize: "0.78rem" }}>supabase/sql/operational_logs.sql</code>,{" "}
              <code style={{ fontSize: "0.78rem" }}>supabase/sql/tester_feedback.sql</code>, and{" "}
              <code style={{ fontSize: "0.78rem" }}>supabase/sql/request_limits.sql</code>.
            </li>
            <li>
              Confirm Vercel env vars are set: <code style={{ fontSize: "0.78rem" }}>NEXT_PUBLIC_SUPABASE_URL</code>,{" "}
              <code style={{ fontSize: "0.78rem" }}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,{" "}
              <code style={{ fontSize: "0.78rem" }}>SUPABASE_SERVICE_ROLE_KEY</code>,{" "}
              <code style={{ fontSize: "0.78rem" }}>NEXT_PUBLIC_PAYPAL_MODE</code>, and the PayPal
              client ID + secret.
            </li>
            <li>
              Test funding with a small amount and verify the wallet credit and the user-facing
              notification both land.
            </li>
            <li>
              Test a manual withdrawal end-to-end and verify the admin payout queue picks it up.
            </li>
            <li>
              After any error path, open{" "}
              <Link href="/admin/logs" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                /admin/logs
              </Link>{" "}
              to confirm telemetry captured the failure.
            </li>
          </ol>
        </div>
      </div>
    </>
  );
}
