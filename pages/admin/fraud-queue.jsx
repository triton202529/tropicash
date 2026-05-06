import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { recomputeAndPersistUserRiskState } from "../../lib/riskFlags";
import { logFraudStatusChanged } from "../../lib/fraudEvents";

function formatMoney(value) {
  const n = Number(value);
  return Number(Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function normalizeFlags(flags) {
  if (Array.isArray(flags)) return flags.map((f) => String(f));
  if (flags && typeof flags === "object") return Object.values(flags).map(String);
  return [];
}

function userLabel(profile, userId) {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  if (profile?.email?.trim()) return profile.email.trim();
  return userId || "—";
}

function normalizeStatus(raw) {
  const v = String(raw || "").toLowerCase();
  if (v === "reviewed" || v === "escalated") return v;
  return "open";
}

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

function riskBadgeStyle(level) {
  const key = String(level || "").toLowerCase();
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

function statusBadgeStyle(status) {
  const key = normalizeStatus(status);
  if (key === "reviewed") {
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
  if (key === "escalated") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#fef2f2",
      color: "#b91c1c",
      border: "1px solid #fecaca",
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
    background: "#f1f5f9",
    color: "#64748b",
    border: "1px solid #e2e8f0",
  };
}

function chipStyle() {
  return {
    display: "inline-block",
    padding: "0.15rem 0.45rem",
    marginRight: "0.35rem",
    marginBottom: "0.25rem",
    borderRadius: "6px",
    fontSize: "0.7rem",
    fontWeight: 600,
    background: "#f1f5f9",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
  };
}

export default function AdminFraudQueuePage() {
  const { user, profile, loading: authLoading } = useUser();

  const [logs, setLogs] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [dataLoading, setDataLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [statusBusyId, setStatusBusyId] = useState(null);
  const [openSmartAlerts, setOpenSmartAlerts] = useState(null);

  const refreshOpenSmartAlerts = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { count, error: aErr } = await supabase
        .from("smart_alerts")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");
      if (aErr) {
        console.error(aErr);
        setOpenSmartAlerts(null);
      } else {
        setOpenSmartAlerts(typeof count === "number" ? count : 0);
      }
    } catch (e) {
      console.error(e);
      setOpenSmartAlerts(null);
    }
  }, [user?.id]);

  const fetchLogs = useCallback(async () => {
    if (!user?.id) return;
    setDataLoading(true);
    setFetchError(null);

    const { data, error } = await supabase
      .from("fraud_logs")
      .select("*")
      .in("status", ["open", "escalated"])
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error(error);
      setFetchError(error.message || "Failed to load fraud queue.");
      setLogs([]);
      setProfilesMap({});
      setOpenSmartAlerts(null);
      setDataLoading(false);
      return;
    }

    const rows = data || [];
    setLogs(rows);

    await refreshOpenSmartAlerts();

    const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    if (ids.length === 0) {
      setProfilesMap({});
      setDataLoading(false);
      return;
    }

    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select(
        "id, full_name, email, phone, risk_level, risk_flags, risk_score_snapshot, risk_last_evaluated_at, account_status, account_flags, account_last_reviewed_at"
      )
      .in("id", ids);

    if (pErr) {
      console.error(pErr);
      setProfilesMap({});
    } else {
      setProfilesMap(Object.fromEntries((profs || []).map((p) => [p.id, p])));
    }

    setDataLoading(false);
  }, [user?.id, refreshOpenSmartAlerts]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, profile)) return;
    fetchLogs();
  }, [authLoading, user?.id, user, profile, fetchLogs]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, profile)) return;
    const channel = supabase
      .channel(`smart-alerts-fraud-queue-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "smart_alerts" },
        () => {
          void refreshOpenSmartAlerts();
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") console.error("smart_alerts realtime:", err);
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id, user, profile, refreshOpenSmartAlerts]);

  const mergeLogRow = useCallback((logId, patch) => {
    setLogs((prev) =>
      prev.map((row) => (row.id === logId ? { ...row, ...patch } : row))
    );
  }, []);

  const removeLogRow = useCallback((logId) => {
    setLogs((prev) => prev.filter((row) => row.id !== logId));
  }, []);

  async function updateFraudStatus(id, nextStatus) {
    if (!user?.id) {
      console.error("updateFraudStatus: missing current user id");
      return { ok: false, error: new Error("Not signed in") };
    }

    const prevRow = logs.find((r) => r.id === id);
    const previousStatus = prevRow ? normalizeStatus(prevRow.status) : "open";
    const subjectUserId = prevRow?.user_id ?? null;

    setStatusBusyId(id);
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("fraud_logs")
        .update({
          status: nextStatus,
          reviewed_by: user.id,
          reviewed_at: now,
        })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) {
        console.error("updateFraudStatus:", error);
        return { ok: false, error };
      }

      if (nextStatus === "reviewed") {
        removeLogRow(id);
      } else if (data) {
        mergeLogRow(id, data);
      } else {
        await fetchLogs();
      }

      if (data) {
        await logFraudStatusChanged(supabase, {
          fraudLogId: id,
          userId: data.user_id ?? subjectUserId,
          actorUserId: user.id,
          previousStatus,
          nextStatus,
          reviewedAt: now,
        });
      }

      const uid = data?.user_id ?? subjectUserId;
      if (uid) {
        void recomputeAndPersistUserRiskState(supabase, uid, {
          actorUserId: user.id,
          fraudLogId: id,
        })
          .then(async (rec) => {
            if (!rec.ok) return;
            if (!rec.patch) return;
            setProfilesMap((prev) => ({
              ...prev,
              [uid]: { ...(prev[uid] || {}), ...rec.patch },
            }));
          })
          .catch((e) => console.error(e));
      }

      return { ok: true, data };
    } finally {
      setStatusBusyId(null);
    }
  }

  const summary = useMemo(() => {
    const total = logs.length;
    let openCount = 0;
    let escalatedCount = 0;
    let highRisk = 0;
    let sumScore = 0;

    for (const r of logs) {
      const st = normalizeStatus(r.status);
      if (st === "open") openCount += 1;
      if (st === "escalated") escalatedCount += 1;
      const lv = String(r.risk_level || "").toLowerCase();
      if (lv === "high") highRisk += 1;
      const s = Number(r.risk_score);
      sumScore += Number.isFinite(s) ? s : 0;
    }

    const avgScore = total > 0 ? sumScore / total : 0;
    return { total, openCount, escalatedCount, highRisk, avgScore };
  }, [logs]);

  const filteredLogs = useMemo(() => {
    let rows = logs;

    if (riskFilter !== "all") {
      rows = rows.filter(
        (r) => String(r.risk_level || "").toLowerCase() === riskFilter
      );
    }
    if (statusFilter !== "all") {
      rows = rows.filter(
        (r) => normalizeStatus(r.status) === statusFilter
      );
    }

    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const p = profilesMap[r.user_id];
      const name = (p?.full_name || "").toLowerCase();
      const email = (p?.email || "").toLowerCase();
      const uid = String(r.user_id || "").toLowerCase();
      const rel = String(r.related_transaction_id || "").toLowerCase();
      const typ = String(r.transaction_type || "").toLowerCase();
      const flagList = normalizeFlags(r.flags).map((f) => f.toLowerCase());
      const flagsJoined = flagList.join(" ");
      const st = normalizeStatus(r.status);

      return (
        uid.includes(q) ||
        name.includes(q) ||
        email.includes(q) ||
        rel.includes(q) ||
        typ.includes(q) ||
        flagsJoined.includes(q) ||
        flagList.some((f) => f.includes(q)) ||
        st.includes(q)
      );
    });
  }, [logs, riskFilter, statusFilter, search, profilesMap]);

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <h1
            style={{
              fontSize: "1.55rem",
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: "1rem",
              letterSpacing: "-0.02em",
            }}
          >
            Fraud queue
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
              color: "#0f172a",
              marginBottom: "0.75rem",
              letterSpacing: "-0.02em",
            }}
          >
            Fraud queue
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

  const summaryCards = [
    { label: "Open cases", value: String(summary.openCount) },
    { label: "Escalated cases", value: String(summary.escalatedCount) },
    { label: "High risk cases", value: String(summary.highRisk) },
    {
      label: "Avg risk score",
      value: summary.total > 0 ? summary.avgScore.toFixed(1) : "—",
    },
    {
      label: "Open smart alerts",
      value: openSmartAlerts == null ? "—" : String(openSmartAlerts),
    },
  ];

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
                color: "#0f172a",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Fraud queue
            </h1>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
              Active cases (<code style={{ fontSize: "0.8rem" }}>open</code>,{" "}
              <code style={{ fontSize: "0.8rem" }}>escalated</code>) — up to 200, newest first
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>
              <Link href="/admin/fraud" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                ← Fraud dashboard
              </Link>
              {" · "}
              <Link href="/admin/alerts" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                Open alerts
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchLogs()}
            disabled={dataLoading}
            style={{
              padding: "0.65rem 1.15rem",
              borderRadius: "10px",
              border: "1px solid #1e293b",
              background: dataLoading ? "#e2e8f0" : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
              color: dataLoading ? "#64748b" : "#fff",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: dataLoading ? "not-allowed" : "pointer",
              boxShadow: dataLoading ? "none" : "0 2px 8px rgba(15, 23, 42, 0.2)",
            }}
          >
            Refresh
          </button>
        </div>

        {fetchError ? (
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
            {fetchError}
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
                htmlFor="fraud-queue-search"
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
                id="fraud-queue-search"
                className="tc-admin-in"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="User, email, flags, type, txn id…"
                style={inputBase}
              />
            </div>
            <div>
              <label
                htmlFor="fraud-queue-status"
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
                id="fraud-queue-status"
                className="tc-admin-in"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={selectBase}
              >
                <option value="all">Open and escalated</option>
                <option value="open">Open</option>
                <option value="escalated">Escalated</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="fraud-queue-risk"
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginBottom: "0.35rem",
                }}
              >
                Risk level
              </label>
              <select
                id="fraud-queue-risk"
                className="tc-admin-in"
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                style={selectBase}
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
          {dataLoading && logs.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, color: "#64748b" }}>Loading queue…</p>
          ) : !fetchError && logs.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, color: "#64748b" }}>
              No active fraud cases. When new risk events are logged as open or escalated, they will appear here.
            </p>
          ) : filteredLogs.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, color: "#64748b" }}>
              No rows match your filters. Try clearing search or filters.
            </p>
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
                      "User",
                      "Transaction type",
                      "Amount",
                      "Risk score",
                      "Risk level",
                      "Status",
                      "Flags",
                      "Created at",
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
                  {filteredLogs.map((r) => {
                    const p = profilesMap[r.user_id];
                    const flags = normalizeFlags(r.flags);
                    const busy = statusBusyId === r.id;

                    return (
                      <tr
                        key={r.id}
                        style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}
                      >
                        <td style={{ padding: "0.65rem 0.75rem", color: "#0f172a", minWidth: "140px" }}>
                          <div style={{ fontWeight: 600 }}>{userLabel(p, r.user_id)}</div>
                          <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.2rem" }}>
                            {r.user_id}
                          </div>
                          {r.user_id ? (
                            <div style={{ marginTop: "0.35rem" }}>
                              <Link
                                href={`/admin/risk-users/${encodeURIComponent(r.user_id)}`}
                                style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.72rem" }}
                              >
                                User risk profile
                              </Link>
                            </div>
                          ) : null}
                        </td>
                        <td
                          style={{
                            padding: "0.65rem 0.75rem",
                            textTransform: "lowercase",
                            color: "#0f172a",
                          }}
                        >
                          {r.transaction_type || "—"}
                        </td>
                        <td
                          style={{
                            padding: "0.65rem 0.75rem",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                            color: "#0f172a",
                          }}
                        >
                          ${formatMoney(r.amount)}
                        </td>
                        <td
                          style={{
                            padding: "0.65rem 0.75rem",
                            fontVariantNumeric: "tabular-nums",
                            color: "#0f172a",
                          }}
                        >
                          {r.risk_score ?? "—"}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={riskBadgeStyle(r.risk_level)}>{r.risk_level || "—"}</span>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={statusBadgeStyle(r.status)}>
                            {normalizeStatus(r.status)}
                          </span>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", maxWidth: "200px" }}>
                          {flags.length === 0 ? (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          ) : (
                            flags.map((f, i) => (
                              <span key={`${r.id}-${i}-${f}`} style={chipStyle()}>
                                {f}
                              </span>
                            ))
                          )}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                          {formatWhen(r.created_at)}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", minWidth: "180px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.15rem", alignItems: "center" }}>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => updateFraudStatus(r.id, "reviewed")}
                              style={{
                                ...btnSm,
                                opacity: busy ? 0.65 : 1,
                                cursor: busy ? "not-allowed" : "pointer",
                              }}
                            >
                              Mark reviewed
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => updateFraudStatus(r.id, "escalated")}
                              style={{
                                ...btnSm,
                                opacity: busy ? 0.65 : 1,
                                cursor: busy ? "not-allowed" : "pointer",
                              }}
                            >
                              Escalate
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => updateFraudStatus(r.id, "open")}
                              style={{
                                ...btnSm,
                                marginRight: 0,
                                opacity: busy ? 0.65 : 1,
                                cursor: busy ? "not-allowed" : "pointer",
                              }}
                            >
                              Reopen
                            </button>
                          </div>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", whiteSpace: "nowrap" }}>
                          <Link
                            href={`/admin/fraud/${encodeURIComponent(r.id)}`}
                            style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.85rem" }}
                          >
                            View
                          </Link>
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
