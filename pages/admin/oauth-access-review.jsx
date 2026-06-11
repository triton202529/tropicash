import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { OAUTH_SUSPICIOUS_REASONS } from "../../lib/oauthSuspiciousAccess";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1200px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "transparent",
  boxSizing: "border-box",
};

const cardBase = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
};

const selectBase = {
  padding: "0.65rem 0.8rem",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  background: "#f4f6f9",
  color: "#0f172a",
  cursor: "pointer",
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
  marginRight: "0.3rem",
  marginBottom: "0.25rem",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
};

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortId(id) {
  if (!id) return "—";
  const s = String(id);
  return s.length > 12 ? `${s.slice(0, 8)}…` : s;
}

function severityBadgeStyle(sev) {
  const key = String(sev || "").toLowerCase();
  if (key === "high") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fca5a5",
    };
  }
  if (key === "medium") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#fffbeb",
      color: "#9a3412",
      border: "1px solid #fcd34d",
    };
  }
  return {
    display: "inline-block",
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #6ee7b7",
  };
}

function statusBadgeStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === "resolved" || key === "dismissed") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#ecfdf5",
      color: "#047857",
      border: "1px solid #a7f3d0",
    };
  }
  if (key === "reviewing") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#eff6ff",
      color: "#1d4ed8",
      border: "1px solid #93c5fd",
    };
  }
  return {
    display: "inline-block",
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: "#fff7ed",
    color: "#c2410c",
    border: "1px solid #fdba74",
  };
}

function reasonLabel(reason) {
  const labels = {
    [OAUTH_SUSPICIOUS_REASONS.HIGH_FREQUENCY_WALLET_READ]: "High-frequency wallet read",
    [OAUTH_SUSPICIOUS_REASONS.MULTIPLE_TOKENS_SAME_CLIENT]: "Multiple tokens (same client)",
    [OAUTH_SUSPICIOUS_REASONS.REVOKED_CONSENT_ACCESS_ATTEMPT]: "Revoked consent access attempt",
    [OAUTH_SUSPICIOUS_REASONS.RATE_LIMIT_EXCEEDED]: "Rate limit exceeded",
    [OAUTH_SUSPICIOUS_REASONS.UNKNOWN_ANOMALY]: "Unknown anomaly",
  };
  return labels[reason] || reason || "—";
}

export default function OAuthAccessReviewPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const [cases, setCases] = useState([]);
  const [clientMap, setClientMap] = useState({});
  const [profileMap, setProfileMap] = useState({});
  const [statusFilter, setStatusFilter] = useState("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState("");

  const isAdmin = isAdminUser(user, profile);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setError("");

    let query = supabase
      .from("oauth_access_review_cases")
      .select(
        "id, client_id, user_id, access_token_id, reason, severity, status, metadata, created_at, resolved_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message || "Failed to load review cases.");
      setCases([]);
      setLoading(false);
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    setCases(rows);

    const clientIds = [...new Set(rows.map((r) => r.client_id).filter(Boolean))];
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];

    if (clientIds.length) {
      const { data: clients } = await supabase
        .from("oauth_clients")
        .select("id, client_id, app_id")
        .in("id", clientIds);
      const map = {};
      for (const c of clients || []) {
        map[c.id] = c;
      }
      setClientMap(map);
    } else {
      setClientMap({});
    }

    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const map = {};
      for (const p of profiles || []) {
        map[p.id] = p;
      }
      setProfileMap(map);
    } else {
      setProfileMap({});
    }

    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    void loadCases();
  }, [user, userLoading, isAdmin, router, loadCases]);

  const openCount = useMemo(
    () => cases.filter((c) => c.status === "open").length,
    [cases],
  );

  async function updateStatus(caseId, status) {
    setActionId(caseId);
    setError("");
    const patch = { status };
    if (status === "resolved" || status === "dismissed") {
      patch.resolved_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("oauth_access_review_cases")
      .update(patch)
      .eq("id", caseId);

    setActionId("");
    if (updateError) {
      setError(updateError.message || "Failed to update case.");
      return;
    }
    await loadCases();
  }

  if (userLoading || !user || !isAdmin) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href="/admin" style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.9rem" }}>
            ← Admin
          </Link>
        </div>

        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.65rem", color: "#0f172a" }}>
          OAuth Access Review
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "#64748b", maxWidth: "720px", lineHeight: 1.5 }}>
          Review-only queue for suspicious OAuth wallet.read access patterns. No automatic account
          restrictions are applied from this page.
        </p>

        <div style={{ ...cardBase, padding: "1.25rem", marginBottom: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
              alignItems: "flex-end",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: "0.35rem" }}>
                Status filter
              </div>
              <select
                className="tc-admin-in"
                style={{ ...selectBase, maxWidth: "220px" }}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="open">Open</option>
                <option value="reviewing">Reviewing</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
                <option value="all">All</option>
              </select>
            </div>
            <div style={{ fontSize: "0.9rem", color: "#334155" }}>
              <strong>{openCount}</strong> open in current view
            </div>
          </div>
        </div>

        {error ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem",
              marginBottom: "1rem",
              borderColor: "#fecaca",
              background: "#fef2f2",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ ...cardBase, overflow: "hidden" }}>
          {loading ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>Loading cases…</p>
          ) : cases.length === 0 ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>
              No review cases match this filter.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Reason</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Severity</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Client</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>User</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Created</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((row) => {
                    const client = clientMap[row.client_id];
                    const userProfile = profileMap[row.user_id];
                    const userLabel =
                      userProfile?.full_name?.trim() ||
                      userProfile?.email?.trim() ||
                      shortId(row.user_id);
                    const busy = actionId === row.id;

                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>
                            {reasonLabel(row.reason)}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                            Token {shortId(row.access_token_id)}
                          </div>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                          <span style={severityBadgeStyle(row.severity)}>{row.severity}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                          {client?.client_id || shortId(row.client_id)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                          {userLabel}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", verticalAlign: "top", color: "#475569" }}>
                          {formatWhen(row.created_at)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", verticalAlign: "top" }}>
                          <span style={statusBadgeStyle(row.status)}>{row.status}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", verticalAlign: "top", minWidth: "200px" }}>
                          {row.status === "open" ? (
                            <button
                              type="button"
                              style={btnSm}
                              disabled={busy}
                              onClick={() => void updateStatus(row.id, "reviewing")}
                            >
                              Mark reviewing
                            </button>
                          ) : null}
                          {row.status === "open" || row.status === "reviewing" ? (
                            <>
                              <button
                                type="button"
                                style={btnSm}
                                disabled={busy}
                                onClick={() => void updateStatus(row.id, "resolved")}
                              >
                                Mark resolved
                              </button>
                              <button
                                type="button"
                                style={btnSm}
                                disabled={busy}
                                onClick={() => void updateStatus(row.id, "dismissed")}
                              >
                                Dismiss
                              </button>
                            </>
                          ) : null}
                          {row.status === "resolved" || row.status === "dismissed" ? (
                            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                              {formatWhen(row.resolved_at)}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
