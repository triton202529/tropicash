import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
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

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function levelBadge(level) {
  const v = String(level || "").toLowerCase();
  const isErr = v === "error";
  const isWarn = v === "warn";
  return {
    display: "inline-block",
    padding: "0.15rem 0.45rem",
    borderRadius: "6px",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: isErr ? "#fef2f2" : isWarn ? "#fffbeb" : "#f1f5f9",
    color: isErr ? "#b91c1c" : isWarn ? "#92400e" : "#64748b",
    border: `1px solid ${isErr ? "#fecaca" : isWarn ? "#fcd34d" : "#e2e8f0"}`,
  };
}

function safeJsonPreview(obj) {
  try {
    return JSON.stringify(obj ?? {}, null, 2);
  } catch {
    return String(obj);
  }
}

export default function AdminOperationalLogsPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  const load = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase
      .from("operational_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      console.error("[admin/logs]", error);
      setErrorMsg(error.message || "Could not load operational logs.");
      setRows([]);
      setLoading(false);
      return;
    }
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void load();
  }, [authLoading, user, profile, load]);

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
          <Link href="/login" style={{ display: "inline-block", marginTop: "1rem", fontWeight: 600, color: "#0ea5e9" }}>
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
          Operational logs
        </h1>
        <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#64748b", maxWidth: "42rem", lineHeight: 1.55 }}>
          Internal telemetry from API routes and in-app error capture. Newest first. Metadata may be truncated or
          redacted in the client before insert.
        </p>

        <div style={{ ...cardBase, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <button type="button" onClick={() => void load()} disabled={loading} style={{ ...btnSm, marginTop: 0 }}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {errorMsg ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", background: "#fef2f2", borderColor: "#fecaca" }}>
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>{errorMsg}</p>
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {loading && rows.length === 0 ? (
            <p style={{ color: "#64748b" }}>Loading…</p>
          ) : rows.length === 0 ? (
            <div style={{ ...cardBase, padding: "2rem", textAlign: "center" }}>
              <p style={{ margin: 0, color: "#64748b" }}>No operational logs yet.</p>
            </div>
          ) : (
            rows.map((r) => {
              const id = r.id;
              const isOpen = expanded.has(id);
              const meta = r.metadata && typeof r.metadata === "object" ? r.metadata : {};
              const hasMeta = meta && Object.keys(meta).length > 0;
              return (
                <div key={id} style={{ ...cardBase, padding: "1rem 1.1rem" }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "0.65rem",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                      <span style={levelBadge(r.level)}>{String(r.level || "—")}</span>
                      <span
                        style={{
                          display: "inline-block",
                          marginLeft: "0.5rem",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "#64748b",
                          letterSpacing: "0.04em",
                          wordBreak: "break-word",
                        }}
                      >
                        {r.category}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "#94a3b8", whiteSpace: "nowrap" }}>{formatWhen(r.created_at)}</span>
                  </div>
                  <p
                    style={{
                      margin: "0 0 0.5rem",
                      fontSize: "0.88rem",
                      color: "#0f172a",
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}
                  >
                    {r.message}
                  </p>
                  <p style={{ margin: "0 0 0.35rem", fontSize: "0.76rem", color: "#64748b", wordBreak: "break-all" }}>
                    <strong style={{ color: "#475569" }}>User</strong> {r.user_id ? String(r.user_id) : "—"}
                    {r.route ? (
                      <>
                        {" "}
                        · <strong style={{ color: "#475569" }}>Route</strong> {r.route}
                      </>
                    ) : null}
                  </p>
                  {hasMeta ? (
                    <button type="button" onClick={() => toggle(id)} style={{ ...btnSm, marginTop: "0.35rem" }}>
                      {isOpen ? "Hide metadata" : "Show metadata"}
                    </button>
                  ) : null}
                  {isOpen && hasMeta ? (
                    <pre
                      style={{
                        marginTop: "0.65rem",
                        padding: "0.65rem 0.75rem",
                        borderRadius: "8px",
                        background: "#0f172a",
                        color: "#e2e8f0",
                        fontSize: "0.68rem",
                        overflowX: "auto",
                        maxHeight: "240px",
                        overflowY: "auto",
                        lineHeight: 1.45,
                      }}
                    >
                      {safeJsonPreview(meta)}
                    </pre>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
