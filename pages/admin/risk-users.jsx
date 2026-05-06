import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import {
  aggregateStatsFromFraudLogs,
  deriveUserRiskState,
  normalizeRiskFlagsArray,
  recomputeAndPersistUserRiskState,
} from "../../lib/riskFlags";
import { normalizeAccountFlags, persistAccountControlState } from "../../lib/accountControls";

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function normalizeStatus(raw) {
  const v = String(raw || "").toLowerCase();
  if (v === "reviewed" || v === "escalated") return v;
  return "open";
}

function userLabel(profile, userId) {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  if (profile?.email?.trim()) return profile.email.trim();
  return userId || "—";
}

function aggregateLogsForUser(userId, logs) {
  const stats = aggregateStatsFromFraudLogs(logs);
  const { riskLevel } = deriveUserRiskState(stats);
  return {
    user_id: userId,
    ...stats,
    overall_risk_tier: riskLevel,
  };
}

function mergeProfileRow(agg, profile) {
  const display_name = userLabel(profile, agg.user_id);
  return {
    ...agg,
    display_name,
    email: profile?.email?.trim() || "",
    phone: profile?.phone || "",
    profile_risk_level: profile?.risk_level ?? null,
    profile_risk_flags: profile?.risk_flags ?? null,
    profile_risk_score_snapshot: profile?.risk_score_snapshot ?? null,
    profile_risk_last_evaluated_at: profile?.risk_last_evaluated_at ?? null,
    profile_account_status: String(profile?.account_status || "active").toLowerCase(),
    profile_account_flags: normalizeAccountFlags(profile?.account_flags),
    profile_account_last_reviewed_at: profile?.account_last_reviewed_at ?? null,
  };
}

function statsFromAggregatedRow(r) {
  return {
    total_logs: r.total_logs,
    high_count: r.high_count,
    medium_count: r.medium_count,
    low_count: r.low_count,
    open_count: r.open_count,
    reviewed_count: r.reviewed_count,
    escalated_count: r.escalated_count,
    avg_risk_score: r.avg_risk_score,
    latest_activity_at: r.latest_activity_at,
  };
}

function chipStyle() {
  return {
    display: "inline-block",
    padding: "0.15rem 0.45rem",
    marginRight: "0.35rem",
    marginBottom: "0.25rem",
    borderRadius: "6px",
    fontSize: "0.65rem",
    fontWeight: 600,
    background: "#f1f5f9",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
  };
}

const btnSm = {
  padding: "0.32rem 0.55rem",
  fontSize: "0.68rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
};

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

function tierBadgeStyle(tier) {
  return riskBadgeStyle(tier);
}

function accountStatusBadgeStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === "restricted") {
    return {
      display: "inline-block",
      padding: "0.15rem 0.45rem",
      borderRadius: "999px",
      fontSize: "0.65rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fca5a5",
    };
  }
  if (key === "under_review") {
    return {
      display: "inline-block",
      padding: "0.15rem 0.45rem",
      borderRadius: "999px",
      fontSize: "0.65rem",
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
    padding: "0.15rem 0.45rem",
    borderRadius: "999px",
    fontSize: "0.65rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #6ee7b7",
  };
}

export default function AdminRiskUsersPage() {
  const { user, profile, loading: authLoading } = useUser();

  const [logs, setLogs] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [dataLoading, setDataLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [signalFilter, setSignalFilter] = useState("all");
  const [rowRiskBusy, setRowRiskBusy] = useState(null);
  const [bulkRiskBusy, setBulkRiskBusy] = useState(false);
  const [rowAcctBusy, setRowAcctBusy] = useState(null);
  const [bulkAcctBusy, setBulkAcctBusy] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    setDataLoading(true);
    setFetchError(null);

    const { data, error } = await supabase
      .from("fraud_logs")
      .select(
        "user_id, risk_score, risk_level, status, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(2000);

    if (error) {
      console.error(error);
      setFetchError(error.message || "Failed to load fraud logs.");
      setLogs([]);
      setProfilesMap({});
      setDataLoading(false);
      return;
    }

    const rows = data || [];
    setLogs(rows);

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
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, profile)) return;
    fetchData();
  }, [authLoading, user?.id, user, profile, fetchData]);

  const userRows = useMemo(() => {
    const byUser = new Map();
    for (const r of logs) {
      const uid = r.user_id;
      if (!uid) continue;
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid).push(r);
    }

    const out = [];
    for (const [uid, userLogs] of byUser) {
      const agg = aggregateLogsForUser(uid, userLogs);
      const p = profilesMap[uid];
      out.push(mergeProfileRow(agg, p));
    }

    out.sort((a, b) => {
      const ta = String(a.latest_activity_at || "");
      const tb = String(b.latest_activity_at || "");
      return tb.localeCompare(ta);
    });

    return out;
  }, [logs, profilesMap]);

  const summary = useMemo(() => {
    let highTier = 0;
    let mediumTier = 0;
    let lowTier = 0;
    let withOpen = 0;
    let withEscalated = 0;

    for (const r of userRows) {
      const t = String(r.overall_risk_tier || "").toLowerCase();
      if (t === "high") highTier += 1;
      else if (t === "medium") mediumTier += 1;
      else lowTier += 1;
      if (r.open_count > 0) withOpen += 1;
      if (r.escalated_count > 0) withEscalated += 1;
    }

    return {
      totalUsers: userRows.length,
      highTier,
      mediumTier,
      lowTier,
      withOpen,
      withEscalated,
    };
  }, [userRows]);

  const filteredRows = useMemo(() => {
    let rows = userRows;

    if (tierFilter !== "all") {
      rows = rows.filter((r) => String(r.overall_risk_tier).toLowerCase() === tierFilter);
    }

    if (signalFilter === "has_open") {
      rows = rows.filter((r) => r.open_count > 0);
    } else if (signalFilter === "has_escalated") {
      rows = rows.filter((r) => r.escalated_count > 0);
    }

    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const name = (r.display_name || "").toLowerCase();
      const email = (r.email || "").toLowerCase();
      const phone = String(r.phone || "").toLowerCase();
      const uid = String(r.user_id || "").toLowerCase();
      const derived = deriveUserRiskState(statsFromAggregatedRow(r));
      const flagStr = derived.riskFlags.join(" ").toLowerCase();
      return (
        name.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        uid.includes(q) ||
        flagStr.includes(q) ||
        normalizeRiskFlagsArray(r.profile_risk_flags)
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [userRows, tierFilter, signalFilter, search]);

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
            User Risk System
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
            User Risk System
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
    { label: "Users with fraud activity", value: String(summary.totalUsers) },
    { label: "High risk users", value: String(summary.highTier) },
    { label: "Medium risk users", value: String(summary.mediumTier) },
    { label: "Low risk users", value: String(summary.lowTier) },
    { label: "Users with open reviews", value: String(summary.withOpen) },
    { label: "Users with escalations", value: String(summary.withEscalated) },
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
              User Risk System
            </h1>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "#64748b", maxWidth: "640px" }}>
              Aggregates <code style={{ fontSize: "0.8rem" }}>fraud_logs</code> by user to surface repeat patterns,
              review load, and a simple overall risk tier for prioritization only (not automated blocking).
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>
              <Link href="/admin/fraud" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                Fraud dashboard
              </Link>
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => fetchData()}
              disabled={dataLoading || bulkRiskBusy}
              style={{
                padding: "0.65rem 1.15rem",
                borderRadius: "10px",
                border: "1px solid #1e293b",
                background: dataLoading ? "#e2e8f0" : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
                color: dataLoading ? "#64748b" : "#fff",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: dataLoading || bulkRiskBusy ? "not-allowed" : "pointer",
                boxShadow: dataLoading ? "none" : "0 2px 8px rgba(15, 23, 42, 0.2)",
              }}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!user?.id || userRows.length === 0) return;
                setBulkRiskBusy(true);
                try {
                  for (const row of userRows) {
                    try {
                      const rec = await recomputeAndPersistUserRiskState(supabase, row.user_id, {
                        actorUserId: user?.id,
                      });
                      if (!rec.ok) console.error(rec.error);
                    } catch (e) {
                      console.error(e);
                    }
                  }
                  await fetchData();
                } finally {
                  setBulkRiskBusy(false);
                }
              }}
              disabled={dataLoading || bulkRiskBusy || userRows.length === 0}
              style={{
                padding: "0.65rem 1.15rem",
                borderRadius: "10px",
                border: "1px solid #1e293b",
                background: bulkRiskBusy ? "#e2e8f0" : "#fff",
                color: bulkRiskBusy ? "#64748b" : "#0f172a",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: dataLoading || bulkRiskBusy || userRows.length === 0 ? "not-allowed" : "pointer",
                boxShadow: "0 1px 4px rgba(15, 23, 42, 0.08)",
              }}
            >
              {bulkRiskBusy ? "Syncing risk…" : "Refresh risk flags"}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!user?.id || userRows.length === 0) return;
                setBulkAcctBusy(true);
                try {
                  for (const row of userRows) {
                    try {
                      const stats = statsFromAggregatedRow(row);
                      const derived = deriveUserRiskState(stats);
                      const ac = await persistAccountControlState(supabase, row.user_id, {
                        source: "recomputed",
                        actorUserId: user?.id,
                        riskLevel: derived.riskLevel,
                        riskFlags: derived.riskFlags,
                        stats,
                      });
                      if (!ac.ok) console.error(ac.error);
                    } catch (e) {
                      console.error(e);
                    }
                  }
                  await fetchData();
                } finally {
                  setBulkAcctBusy(false);
                }
              }}
              disabled={dataLoading || bulkAcctBusy || bulkRiskBusy || userRows.length === 0}
              style={{
                padding: "0.65rem 1.15rem",
                borderRadius: "10px",
                border: "1px solid #1e293b",
                background: bulkAcctBusy ? "#e2e8f0" : "#fff",
                color: bulkAcctBusy ? "#64748b" : "#0f172a",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor:
                  dataLoading || bulkAcctBusy || bulkRiskBusy || userRows.length === 0 ? "not-allowed" : "pointer",
                boxShadow: "0 1px 4px rgba(15, 23, 42, 0.08)",
              }}
            >
              {bulkAcctBusy ? "Account state…" : "Refresh account state"}
            </button>
          </div>
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
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
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
                htmlFor="risk-user-search"
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
                id="risk-user-search"
                className="tc-admin-in"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, email, phone, user id…"
                style={inputBase}
              />
            </div>
            <div>
              <label
                htmlFor="risk-tier-filter"
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginBottom: "0.35rem",
                }}
              >
                Overall risk tier
              </label>
              <select
                id="risk-tier-filter"
                className="tc-admin-in"
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                style={selectBase}
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="risk-signal-filter"
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginBottom: "0.35rem",
                }}
              >
                Review signal
              </label>
              <select
                id="risk-signal-filter"
                className="tc-admin-in"
                value={signalFilter}
                onChange={(e) => setSignalFilter(e.target.value)}
                style={selectBase}
              >
                <option value="all">All</option>
                <option value="has_open">Has open reviews</option>
                <option value="has_escalated">Has escalations</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
          {dataLoading && logs.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, color: "#64748b" }}>Loading…</p>
          ) : !fetchError && userRows.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, color: "#64748b" }}>
              No fraud logs yet. User risk rows appear once fraud scoring creates log entries.
            </p>
          ) : filteredRows.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, color: "#64748b" }}>
              No users match your filters. Try clearing search or filters.
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
                  <tr style={{ background: "linear-gradient(180deg, #f1f5f9 0%, #e8eef5 100%)", borderBottom: "1px solid #cbd5e1" }}>
                    {[
                      "User",
                      "Total logs",
                      "High",
                      "Medium",
                      "Low",
                      "Open",
                      "Escalated",
                      "Avg score",
                      "Latest activity",
                      "Overall tier",
                      "Account risk",
                      "Control",
                      "Sync",
                      "Acct",
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
                  {filteredRows.map((r) => {
                    const derived = deriveUserRiskState(statsFromAggregatedRow(r));
                    const evaluated = r.profile_risk_last_evaluated_at;
                    const useStored = evaluated != null && evaluated !== "";
                    const acctLevel = useStored ? String(r.profile_risk_level || "low").toLowerCase() : derived.riskLevel;
                    const acctFlags = useStored
                      ? normalizeRiskFlagsArray(r.profile_risk_flags)
                      : derived.riskFlags;
                    const ctrlStatus = String(r.profile_account_status || "active").toLowerCase();
                    const ctrlFlags = normalizeAccountFlags(r.profile_account_flags);
                    return (
                      <tr key={r.user_id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                        <td style={{ padding: "0.65rem 0.75rem", color: "#0f172a", minWidth: "140px" }}>
                          <div style={{ fontWeight: 600 }}>{r.display_name}</div>
                          <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.2rem" }}>
                            {r.user_id}
                          </div>
                          {r.email ? (
                            <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.15rem" }}>
                              {r.email}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: "#0f172a" }}>
                          {r.total_logs}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>{r.high_count}</td>
                        <td style={{ padding: "0.65rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
                          {r.medium_count}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>{r.low_count}</td>
                        <td style={{ padding: "0.65rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>{r.open_count}</td>
                        <td style={{ padding: "0.65rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
                          {r.escalated_count}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
                          {r.total_logs > 0 ? r.avg_risk_score.toFixed(1) : "—"}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                          {formatWhen(r.latest_activity_at)}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={tierBadgeStyle(r.overall_risk_tier)}>{r.overall_risk_tier}</span>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", maxWidth: "220px" }}>
                          <div style={{ marginBottom: "0.25rem" }}>
                            <span style={tierBadgeStyle(acctLevel)}>{acctLevel}</span>
                            {!useStored ? (
                              <span style={{ fontSize: "0.65rem", color: "#94a3b8", marginLeft: "0.35rem" }}>(computed)</span>
                            ) : null}
                          </div>
                          {acctFlags.length === 0 ? (
                            <span style={{ color: "#94a3b8", fontSize: "0.72rem" }}>—</span>
                          ) : (
                            acctFlags.map((f, i) => (
                              <span key={`${r.user_id}-af-${i}-${f}`} style={chipStyle()}>
                                {f}
                              </span>
                            ))
                          )}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", maxWidth: "200px" }}>
                          <div style={{ marginBottom: "0.2rem" }}>
                            <span style={accountStatusBadgeStyle(ctrlStatus)}>
                              {ctrlStatus.replace(/_/g, " ")}
                            </span>
                          </div>
                          {ctrlFlags.length === 0 ? (
                            <span style={{ color: "#94a3b8", fontSize: "0.68rem" }}>—</span>
                          ) : (
                            ctrlFlags.slice(0, 4).map((f, i) => (
                              <span key={`${r.user_id}-cf-${i}-${f}`} style={chipStyle()}>
                                {f}
                              </span>
                            ))
                          )}
                          {ctrlFlags.length > 4 ? (
                            <span style={{ fontSize: "0.65rem", color: "#94a3b8" }}> +{ctrlFlags.length - 4}</span>
                          ) : null}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <button
                            type="button"
                            disabled={dataLoading || bulkRiskBusy || rowRiskBusy === r.user_id}
                            onClick={async () => {
                              setRowRiskBusy(r.user_id);
                              try {
                                const rec = await recomputeAndPersistUserRiskState(supabase, r.user_id, {
                                  actorUserId: user?.id,
                                });
                                if (!rec.ok) console.error(rec.error);
                                const { data: p, error: pe } = await supabase
                                  .from("profiles")
                                  .select(
                                    "id, full_name, email, phone, risk_level, risk_flags, risk_score_snapshot, risk_last_evaluated_at, account_status, account_flags, account_last_reviewed_at"
                                  )
                                  .eq("id", r.user_id)
                                  .maybeSingle();
                                if (!pe && p) {
                                  setProfilesMap((prev) => ({ ...prev, [r.user_id]: p }));
                                }
                              } catch (e) {
                                console.error(e);
                              } finally {
                                setRowRiskBusy(null);
                              }
                            }}
                            style={{
                              ...btnSm,
                              opacity: dataLoading || bulkRiskBusy || rowRiskBusy === r.user_id ? 0.65 : 1,
                              cursor:
                                dataLoading || bulkRiskBusy || rowRiskBusy === r.user_id ? "not-allowed" : "pointer",
                            }}
                          >
                            {rowRiskBusy === r.user_id ? "…" : "Sync"}
                          </button>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <button
                            type="button"
                            disabled={dataLoading || bulkAcctBusy || bulkRiskBusy || rowAcctBusy === r.user_id}
                            onClick={async () => {
                              setRowAcctBusy(r.user_id);
                              try {
                                const stats = statsFromAggregatedRow(r);
                                const d = deriveUserRiskState(stats);
                                const ac = await persistAccountControlState(supabase, r.user_id, {
                                  source: "recomputed",
                                  actorUserId: user?.id,
                                  riskLevel: d.riskLevel,
                                  riskFlags: d.riskFlags,
                                  stats,
                                });
                                if (!ac.ok) console.error(ac.error);
                                const { data: p, error: pe } = await supabase
                                  .from("profiles")
                                  .select(
                                    "id, full_name, email, phone, risk_level, risk_flags, risk_score_snapshot, risk_last_evaluated_at, account_status, account_flags, account_last_reviewed_at"
                                  )
                                  .eq("id", r.user_id)
                                  .maybeSingle();
                                if (!pe && p) {
                                  setProfilesMap((prev) => ({ ...prev, [r.user_id]: p }));
                                }
                              } catch (e) {
                                console.error(e);
                              } finally {
                                setRowAcctBusy(null);
                              }
                            }}
                            style={{
                              ...btnSm,
                              opacity:
                                dataLoading || bulkAcctBusy || bulkRiskBusy || rowAcctBusy === r.user_id ? 0.65 : 1,
                              cursor:
                                dataLoading || bulkAcctBusy || bulkRiskBusy || rowAcctBusy === r.user_id
                                  ? "not-allowed"
                                  : "pointer",
                            }}
                          >
                            {rowAcctBusy === r.user_id ? "…" : "Acct"}
                          </button>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <Link
                            href={`/admin/risk-users/${encodeURIComponent(r.user_id)}`}
                            style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.8rem" }}
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
