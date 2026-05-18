import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { fetchAdminAuditLogs, formatAdminAuditMetadataPreview } from "../../lib/adminAudit";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1200px",
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
  padding: "0.4rem 0.75rem",
  fontSize: "0.8rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
};

const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  { value: "security", label: "Security" },
  { value: "wallet", label: "Wallet" },
  { value: "withdrawal", label: "Withdrawal" },
  { value: "payout", label: "Payout" },
  { value: "user_management", label: "User management" },
  { value: "system", label: "System" },
];

const SEVERITY_OPTIONS = [
  { value: "", label: "All severities" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function shortId(id) {
  const s = String(id || "").trim();
  if (!s) return "—";
  return s.length > 12 ? `${s.slice(0, 8)}…` : s;
}

function severityBadge(sev) {
  const key = String(sev || "").toLowerCase();
  if (key === "critical") {
    return {
      display: "inline-block",
      padding: "0.15rem 0.45rem",
      borderRadius: "6px",
      fontSize: "0.68rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#450a0a",
      color: "#fecaca",
      border: "1px solid #7f1d1d",
    };
  }
  if (key === "high") {
    return {
      display: "inline-block",
      padding: "0.15rem 0.45rem",
      borderRadius: "6px",
      fontSize: "0.68rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fca5a5",
    };
  }
  if (key === "warning") {
    return {
      display: "inline-block",
      padding: "0.15rem 0.45rem",
      borderRadius: "6px",
      fontSize: "0.68rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fffbeb",
      color: "#92400e",
      border: "1px solid #fcd34d",
    };
  }
  return {
    display: "inline-block",
    padding: "0.15rem 0.45rem",
    borderRadius: "6px",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: "#f1f5f9",
    color: "#64748b",
    border: "1px solid #e2e8f0",
  };
}

function categoryPill(cat) {
  return {
    display: "inline-block",
    padding: "0.12rem 0.4rem",
    borderRadius: "6px",
    fontSize: "0.65rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  };
}

export default function AdminAuditPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [tableMissing, setTableMissing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [targetFilter, setTargetFilter] = useState("");

  const load = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setErrorMsg(null);
    setTableMissing(false);

    const result = await fetchAdminAuditLogs({
      limit: 200,
      category: categoryFilter,
      severity: severityFilter,
      targetUserId: targetFilter.trim(),
      supabaseClient: supabase,
    });

    if (result.tableMissing) {
      setTableMissing(true);
      setRows([]);
      setErrorMsg(
        "Admin audit logs table is not available yet. Run supabase/sql/admin_audit_logs.sql in Supabase.",
      );
    } else if (result.error) {
      setErrorMsg(result.error);
      setRows([]);
    } else {
      setRows(result.rows);
    }
    setLoading(false);
  }, [user?.id, user, profile, categoryFilter, severityFilter, targetFilter]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void load();
  }, [authLoading, user, profile, load]);

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
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Admin access required.</p>
          <Link href="/admin" style={{ display: "inline-block", marginTop: "1rem", fontWeight: 600, color: "#0ea5e9" }}>
            Back to Admin
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <Link
          href="/admin"
          style={{
            display: "inline-block",
            marginBottom: "0.75rem",
            fontSize: "0.88rem",
            fontWeight: 600,
            color: "#0ea5e9",
          }}
        >
          ← Back to Admin
        </Link>
        <h1
          style={{
            fontSize: "clamp(1.25rem, 4vw, 1.55rem)",
            fontWeight: 800,
            color: "#0f172a",
            margin: "0 0 0.35rem",
            letterSpacing: "-0.02em",
          }}
        >
          Admin Audit Trail
        </h1>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.9rem", color: "#64748b", maxWidth: "44rem", lineHeight: 1.5 }}>
          Append-only record of sensitive admin and security enforcement actions. Logs are best-effort and cannot be
          edited from this UI.
        </p>

        <div
          style={{
            ...cardBase,
            padding: "1rem 1.1rem",
            marginBottom: "1.25rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "flex-end",
          }}
        >
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "140px", flex: "1 1 140px" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
              Category
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                padding: "0.45rem 0.5rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                background: "#fff",
              }}
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "140px", flex: "1 1 140px" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
              Severity
            </span>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{
                padding: "0.45rem 0.5rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                background: "#fff",
              }}
            >
              {SEVERITY_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: "200px", flex: "2 1 200px" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>
              Target user ID
            </span>
            <input
              type="text"
              value={targetFilter}
              onChange={(e) => setTargetFilter(e.target.value)}
              placeholder="Full UUID (optional)"
              style={{
                padding: "0.45rem 0.5rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                fontFamily: "ui-monospace, monospace",
              }}
            />
          </label>
          <button type="button" onClick={() => void load()} disabled={loading} style={btnSm}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {errorMsg ? (
          <div
            style={{
              ...cardBase,
              padding: "0.85rem 1rem",
              marginBottom: "1rem",
              borderColor: tableMissing ? "#fcd34d" : "#fecaca",
              background: tableMissing ? "#fffbeb" : "#fef2f2",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.85rem", color: tableMissing ? "#92400e" : "#b91c1c" }}>{errorMsg}</p>
          </div>
        ) : null}

        <div style={{ ...cardBase, padding: "0.5rem 0.35rem 0.75rem", overflowX: "auto" }}>
          {loading && rows.length === 0 ? (
            <p style={{ padding: "1rem", margin: 0, color: "#64748b", fontSize: "0.88rem" }}>Loading audit logs…</p>
          ) : rows.length === 0 ? (
            <p style={{ padding: "1rem", margin: 0, color: "#64748b", fontSize: "0.88rem" }}>No audit entries match these filters.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: "720px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0", textAlign: "left" }}>
                  {["Time", "Category", "Severity", "Action", "Actor", "Target", "Description", "Metadata"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "0.55rem 0.5rem",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.5rem", whiteSpace: "nowrap", color: "#64748b" }}>{formatWhen(row.created_at)}</td>
                    <td style={{ padding: "0.5rem" }}>
                      <span style={categoryPill(row.category)}>{row.category || "—"}</span>
                    </td>
                    <td style={{ padding: "0.5rem" }}>
                      <span style={severityBadge(row.severity)}>{row.severity || "—"}</span>
                    </td>
                    <td style={{ padding: "0.5rem", fontWeight: 600, color: "#0f172a", maxWidth: "10rem" }}>
                      {row.action || "—"}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "0.72rem",
                        color: "#475569",
                      }}
                      title={row.actor_user_id || ""}
                    >
                      {row.actor_user_id ? shortId(row.actor_user_id) : "system"}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "0.72rem",
                        color: "#475569",
                      }}
                      title={row.target_user_id || ""}
                    >
                      {shortId(row.target_user_id)}
                    </td>
                    <td style={{ padding: "0.5rem", color: "#475569", maxWidth: "14rem", lineHeight: 1.4 }}>
                      {row.description || "—"}
                    </td>
                    <td
                      style={{
                        padding: "0.5rem",
                        color: "#64748b",
                        fontSize: "0.72rem",
                        maxWidth: "16rem",
                        lineHeight: 1.35,
                      }}
                      title={formatAdminAuditMetadataPreview(row.metadata, 400)}
                    >
                      {formatAdminAuditMetadataPreview(row.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
