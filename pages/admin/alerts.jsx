import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { updateSmartAlertStatus } from "../../lib/smartAlerts";
import { createFraudCase, formatShortUserId } from "../../lib/caseManagement";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1200px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
  boxSizing: "border-box",
};

const cardBase = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
};

const inputBase = {
  padding: "0.65rem 0.8rem",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  background: "#f4f6f9",
  color: "#0f172a",
};

const selectBase = {
  ...inputBase,
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

const adminFocusCss = `
  .tc-admin-in:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .tc-admin-in::placeholder { color: #94a3b8; }
`;

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function userLabel(profile, userId) {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  if (profile?.email?.trim()) return profile.email.trim();
  return userId || "—";
}

function alertSeverityBadgeStyle(sev) {
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
      boxShadow: "0 1px 2px rgba(185, 28, 28, 0.12)",
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
      boxShadow: "0 1px 2px rgba(180, 83, 9, 0.1)",
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
    boxShadow: "0 1px 2px rgba(4, 120, 87, 0.1)",
  };
}

function alertStatusBadgeStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === "resolved") {
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
  if (key === "acknowledged") {
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
      boxShadow: "0 1px 2px rgba(180, 83, 9, 0.1)",
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
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  };
}

export default function AdminAlertsPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useUser();
  const [alerts, setAlerts] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [rowBusyId, setRowBusyId] = useState(null);
  const [caseOpenBusyId, setCaseOpenBusyId] = useState(null);

  const fetchAlerts = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("smart_alerts")
        .select("id, created_at, user_id, fraud_log_id, alert_type, title, message, severity, status, updated_at")
        .order("created_at", { ascending: false })
        .limit(200);

      if (qErr) {
        console.error(qErr);
        setError(qErr.message || "Failed to load alerts.");
        setAlerts([]);
        setProfilesMap({});
        return;
      }

      const rows = data || [];
      setAlerts(rows);

      const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      if (ids.length === 0) {
        setProfilesMap({});
        return;
      }

      const { data: profs, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);

      if (pErr) {
        console.error(pErr);
        setProfilesMap({});
      } else {
        setProfilesMap(Object.fromEntries((profs || []).map((p) => [p.id, p])));
      }
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to load alerts.");
      setAlerts([]);
      setProfilesMap({});
    } finally {
      setLoading(false);
    }
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, profile)) return;
    fetchAlerts();
  }, [authLoading, user?.id, user, profile, fetchAlerts]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, profile)) return;
    const channel = supabase
      .channel(`smart-alerts-admin-center-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "smart_alerts" },
        () => {
          void fetchAlerts();
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") console.error("smart_alerts realtime:", err);
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id, user, profile, fetchAlerts]);

  async function updateAlertStatus(id, nextStatus) {
    if (!user?.id || !id) return;
    const row = alerts.find((a) => a.id === id);
    setRowBusyId(id);
    try {
      const res = await updateSmartAlertStatus(supabase, {
        alertId: id,
        status: nextStatus,
        actorUserId: user.id,
        userId: row?.user_id ?? null,
        fraudLogId: row?.fraud_log_id ?? null,
      });
      if (!res.ok) {
        console.error(res.error);
        return;
      }
      await fetchAlerts();
    } catch (e) {
      console.error(e);
    } finally {
      setRowBusyId(null);
    }
  }

  async function openCaseFromAlert(row) {
    const uid = row?.user_id;
    if (!uid || !user?.id) return;
    setCaseOpenBusyId(row.id);
    try {
      const sev = String(row.severity || "").toLowerCase();
      const priority = sev === "high" ? "high" : "medium";
      const rawTitle = String(row.title || "").trim();
      const title =
        rawTitle.length > 0
          ? `Case: ${rawTitle.slice(0, 120)}`
          : `Case: alert ${formatShortUserId(row.id)}`;
      const summaryText = row.message != null ? String(row.message).trim().slice(0, 800) : null;
      const res = await createFraudCase(supabase, {
        userId: uid,
        primaryFraudLogId: row.fraud_log_id || null,
        title,
        summary: summaryText || null,
        priority,
        status: "open",
        openedBy: user.id,
      });
      if (res.ok && res.caseId) {
        await router.push(`/admin/cases/${encodeURIComponent(res.caseId)}`);
      } else if (!res.ok) {
        console.error(res.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCaseOpenBusyId(null);
    }
  }

  const summary = useMemo(() => {
    let open = 0;
    let high = 0;
    let ack = 0;
    let resolved = 0;
    for (const a of alerts) {
      const st = String(a.status || "").toLowerCase();
      const sev = String(a.severity || "").toLowerCase();
      if (st === "open") open += 1;
      if (sev === "high") high += 1;
      if (st === "acknowledged") ack += 1;
      if (st === "resolved") resolved += 1;
    }
    return { open, high, ack, resolved };
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    let rows = alerts;
    if (severityFilter !== "all") {
      rows = rows.filter((a) => String(a.severity || "").toLowerCase() === severityFilter);
    }
    if (statusFilter !== "all") {
      rows = rows.filter((a) => String(a.status || "").toLowerCase() === statusFilter);
    }
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((a) => {
      const title = String(a.title || "").toLowerCase();
      const message = String(a.message || "").toLowerCase();
      const typ = String(a.alert_type || "").toLowerCase();
      const uid = String(a.user_id || "").toLowerCase();
      return title.includes(q) || message.includes(q) || typ.includes(q) || uid.includes(q);
    });
  }, [alerts, severityFilter, statusFilter, search]);

  const summaryCards = [
    { label: "Open alerts", value: String(summary.open) },
    { label: "High severity alerts", value: String(summary.high) },
    { label: "Acknowledged alerts", value: String(summary.ack) },
    { label: "Resolved alerts", value: String(summary.resolved) },
  ];

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <h1
            style={{
              fontSize: "1.55rem",
              fontWeight: 700,
              color: "#f8fafc",
              marginBottom: "1rem",
              letterSpacing: "-0.02em",
            }}
          >
            Alert center
          </h1>
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
          <h1
            style={{
              fontSize: "1.55rem",
              fontWeight: 700,
              color: "#f8fafc",
              marginBottom: "0.75rem",
              letterSpacing: "-0.02em",
            }}
          >
            Alert center
          </h1>
          <p style={{ color: "#64748b" }}>Sign in to view this page.</p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              marginTop: "1rem",
              fontWeight: 600,
              color: "#0ea5e9",
            }}
          >
            Go to login
          </Link>
        </div>
      </>
    );
  }

  if (!authLoading && user && !isAdminUser(user, profile)) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Not authorized</h2>
        <p>This area is restricted to admin users.</p>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: adminFocusCss }} />
      <Navbar />
      <div style={pageWrap}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.55rem",
                fontWeight: 700,
                color: "#f8fafc",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Alert center
            </h1>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
              System-wide smart alerts (latest 200, newest first)
              <span
                style={{
                  marginLeft: "0.5rem",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  color: "#22c55e",
                  letterSpacing: "0.02em",
                }}
              >
                Live
              </span>
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>
              <Link href="/admin" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                ← Admin home
              </Link>
              {" · "}
              <Link href="/admin/fraud-queue" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                Fraud queue
              </Link>
              {" · "}
              <Link href="/admin/cases" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                Cases
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchAlerts()}
            disabled={loading}
            style={{
              padding: "0.65rem 1.15rem",
              borderRadius: "10px",
              border: "1px solid #1e293b",
              background: loading ? "#e2e8f0" : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
              color: loading ? "#64748b" : "#fff",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 2px 8px rgba(15, 23, 42, 0.2)",
            }}
          >
            Refresh
          </button>
        </div>

        {error ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem 1.15rem",
              marginBottom: "1.25rem",
              background: "#fef2f2",
              borderColor: "#fecaca",
              color: "#b91c1c",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          {summaryCards.map((c) => (
            <div key={c.label} style={{ ...cardBase, padding: "1rem 1.1rem" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#94a3b8",
                }}
              >
                {c.label}
              </p>
              <p
                style={{
                  margin: "0.4rem 0 0",
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {c.value}
              </p>
            </div>
          ))}
        </div>

        <div style={{ ...cardBase, padding: "1.1rem 1.15rem", marginBottom: "1.25rem" }}>
          <h2
            style={{
              margin: "0 0 0.85rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Filters
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "0.75rem",
              alignItems: "end",
            }}
          >
            <div>
              <label
                htmlFor="alert-center-search"
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginBottom: "0.35rem",
                }}
              >
                Search
              </label>
              <input
                id="alert-center-search"
                className="tc-admin-in"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title, message, type, user id…"
                style={inputBase}
              />
            </div>
            <div>
              <label
                htmlFor="alert-center-severity"
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginBottom: "0.35rem",
                }}
              >
                Severity
              </label>
              <select
                id="alert-center-severity"
                className="tc-admin-in"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={selectBase}
              >
                <option value="all">All</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="alert-center-status"
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginBottom: "0.35rem",
                }}
              >
                Status
              </label>
              <select
                id="alert-center-status"
                className="tc-admin-in"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={selectBase}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
          {loading && alerts.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, color: "#64748b" }}>Loading alerts...</p>
          ) : filteredAlerts.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, color: "#64748b" }}>No alerts found.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.8125rem",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "linear-gradient(180deg, #f1f5f9 0%, #e8eef5 100%)",
                      borderBottom: "1px solid #cbd5e1",
                    }}
                  >
                    {[
                      "Created at",
                      "User",
                      "Alert type",
                      "Title",
                      "Severity",
                      "Status",
                      "Actions",
                      "View",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "0.65rem 0.75rem",
                          fontWeight: 700,
                          color: "#94a3b8",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map((r) => {
                    const uid = r.user_id;
                    const p = uid ? profilesMap[uid] : null;
                    const busy = rowBusyId === r.id;
                    const st = String(r.status || "").toLowerCase();
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                        <td style={{ padding: "0.65rem 0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                          {formatWhen(r.created_at)}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", color: "#0f172a", minWidth: "120px" }}>
                          {uid ? (
                            <>
                              <div style={{ fontWeight: 600 }}>{userLabel(p, uid)}</div>
                              <div style={{ fontSize: "0.72rem", color: "#64748b", wordBreak: "break-all", marginTop: "0.2rem" }}>
                                {uid}
                              </div>
                              <div style={{ marginTop: "0.35rem", display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
                                <Link
                                  href={`/admin/risk-users/${encodeURIComponent(uid)}`}
                                  style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.72rem" }}
                                >
                                  User risk
                                </Link>
                                <Link
                                  href={`/admin/users/${encodeURIComponent(uid)}/timeline`}
                                  style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.72rem" }}
                                >
                                  Timeline
                                </Link>
                              </div>
                            </>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", color: "#0f172a", wordBreak: "break-word" }}>
                          {r.alert_type || "—"}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", fontWeight: 600, color: "#0f172a", maxWidth: "220px" }}>
                          {r.title || "—"}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={alertSeverityBadgeStyle(r.severity)}>{String(r.severity || "—").toLowerCase()}</span>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={alertStatusBadgeStyle(r.status)}>{st || "—"}</span>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", minWidth: "200px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.15rem", alignItems: "center" }}>
                            <button
                              type="button"
                              disabled={busy || st !== "open"}
                              onClick={() => updateAlertStatus(r.id, "acknowledged")}
                              style={{
                                ...btnSm,
                                opacity: busy || st !== "open" ? 0.55 : 1,
                                cursor: busy || st !== "open" ? "not-allowed" : "pointer",
                              }}
                            >
                              Acknowledge
                            </button>
                            <button
                              type="button"
                              disabled={busy || st === "resolved"}
                              onClick={() => updateAlertStatus(r.id, "resolved")}
                              style={{
                                ...btnSm,
                                opacity: busy || st === "resolved" ? 0.55 : 1,
                                cursor: busy || st === "resolved" ? "not-allowed" : "pointer",
                              }}
                            >
                              Resolve
                            </button>
                            <button
                              type="button"
                              disabled={busy || st === "open"}
                              onClick={() => updateAlertStatus(r.id, "open")}
                              style={{
                                ...btnSm,
                                marginRight: 0,
                                opacity: busy || st === "open" ? 0.55 : 1,
                                cursor: busy || st === "open" ? "not-allowed" : "pointer",
                              }}
                            >
                              Reopen
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.35rem" }}>
                            {r.fraud_log_id ? (
                              <Link
                                href={`/admin/fraud/${encodeURIComponent(r.fraud_log_id)}`}
                                style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.85rem" }}
                              >
                                Fraud log
                              </Link>
                            ) : uid ? (
                              <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.45rem", alignItems: "center" }}>
                                <Link
                                  href={`/admin/risk-users/${encodeURIComponent(uid)}`}
                                  style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.85rem" }}
                                >
                                  User risk
                                </Link>
                                <Link
                                  href={`/admin/users/${encodeURIComponent(uid)}/timeline`}
                                  style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.85rem" }}
                                >
                                  Timeline
                                </Link>
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>—</span>
                            )}
                            {uid ? (
                              <button
                                type="button"
                                disabled={caseOpenBusyId === r.id || rowBusyId === r.id}
                                onClick={() => openCaseFromAlert(r)}
                                style={{
                                  ...btnSm,
                                  marginRight: 0,
                                  marginBottom: 0,
                                  background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
                                  borderColor: "#93c5fd",
                                  color: "#1e40af",
                                  fontWeight: 700,
                                  opacity: caseOpenBusyId === r.id || rowBusyId === r.id ? 0.55 : 1,
                                  cursor:
                                    caseOpenBusyId === r.id || rowBusyId === r.id ? "not-allowed" : "pointer",
                                }}
                              >
                                {caseOpenBusyId === r.id ? "Opening…" : "Open case"}
                              </button>
                            ) : null}
                          </div>
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
