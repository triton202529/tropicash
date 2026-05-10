import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import { updateSmartAlertStatus } from "../../lib/smartAlerts";
import { fetchAdminOperationalSnapshot } from "../../lib/adminOperationalOverview";

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

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function userLabel(p, userId) {
  if (p?.full_name?.trim()) return p.full_name.trim();
  if (p?.email?.trim()) return p.email.trim();
  return userId || "—";
}

function sevStyle(sev) {
  const key = String(sev || "").toLowerCase();
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
  if (key === "medium") {
    return {
      display: "inline-block",
      padding: "0.15rem 0.45rem",
      borderRadius: "6px",
      fontSize: "0.68rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fffbeb",
      color: "#9a3412",
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

function statusPill(st) {
  const key = String(st || "").toLowerCase();
  const open = key === "open";
  return {
    display: "inline-block",
    padding: "0.15rem 0.45rem",
    borderRadius: "6px",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: open ? "#eff6ff" : "#f1f5f9",
    color: open ? "#1d4ed8" : "#64748b",
    border: `1px solid ${open ? "#bfdbfe" : "#e2e8f0"}`,
  };
}

const btnXs = {
  padding: "0.22rem 0.45rem",
  fontSize: "0.68rem",
  borderRadius: "6px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
  marginRight: "0.25rem",
};

export default function AdminIndexPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [openAlertCount, setOpenAlertCount] = useState(null);
  const [highOpenCount, setHighOpenCount] = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [alertProfiles, setAlertProfiles] = useState({});
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState(null);
  const [alertBusyId, setAlertBusyId] = useState(null);

  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState(null);
  const [opsKpi, setOpsKpi] = useState(null);
  const [opsActivity, setOpsActivity] = useState([]);

  const loadOperational = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setOpsLoading(true);
    setOpsError(null);
    try {
      const snap = await fetchAdminOperationalSnapshot(supabase);
      if (snap.error) {
        setOpsError(snap.error);
        setOpsKpi(null);
        setOpsActivity([]);
      } else {
        setOpsKpi(snap.kpi);
        setOpsActivity(snap.activity || []);
      }
    } catch (e) {
      console.error(e);
      setOpsError(e?.message || "Failed to load operational metrics.");
      setOpsKpi(null);
      setOpsActivity([]);
    } finally {
      setOpsLoading(false);
    }
  }, [user?.id, user, profile]);

  const loadAlerts = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setAlertsLoading(true);
    setAlertsError(null);
    try {
      const [openRes, highRes, listRes] = await Promise.all([
        supabase.from("smart_alerts").select("*", { count: "exact", head: true }).eq("status", "open"),
        supabase
          .from("smart_alerts")
          .select("*", { count: "exact", head: true })
          .eq("status", "open")
          .eq("severity", "high"),
        supabase
          .from("smart_alerts")
          .select("id, created_at, title, severity, status, user_id, fraud_log_id")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      if (openRes.error) throw openRes.error;
      if (highRes.error) throw highRes.error;
      if (listRes.error) throw listRes.error;

      setOpenAlertCount(typeof openRes.count === "number" ? openRes.count : 0);
      setHighOpenCount(typeof highRes.count === "number" ? highRes.count : 0);
      const rows = listRes.data || [];
      setRecentAlerts(rows);

      const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      if (ids.length === 0) {
        setAlertProfiles({});
      } else {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        if (pErr) {
          console.error(pErr);
          setAlertProfiles({});
        } else {
          setAlertProfiles(Object.fromEntries((profs || []).map((p) => [p.id, p])));
        }
      }
    } catch (e) {
      console.error(e);
      setAlertsError(e?.message || "Failed to load alerts.");
      setOpenAlertCount(null);
      setHighOpenCount(null);
      setRecentAlerts([]);
      setAlertProfiles({});
    } finally {
      setAlertsLoading(false);
    }
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    let cancelled = false;
    (async () => {
      await Promise.all([loadAlerts(), loadOperational()]);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, profile, loadAlerts, loadOperational]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, profile)) return;
    const channel = supabase
      .channel(`smart-alerts-admin-home-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "smart_alerts" },
        () => {
          void loadAlerts();
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") console.error("smart_alerts realtime:", err);
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id, user, profile, loadAlerts]);

  const handleAlertStatus = useCallback(
    async (row, nextStatus) => {
      if (!user?.id || !row?.id) return;
      setAlertBusyId(row.id);
      try {
        const res = await updateSmartAlertStatus(supabase, {
          alertId: row.id,
          status: nextStatus,
          actorUserId: user.id,
          userId: row.user_id ?? null,
          fraudLogId: row.fraud_log_id ?? null,
        });
        if (!res.ok) console.error(res.error);
        await loadAlerts();
      } catch (e) {
        console.error(e);
      } finally {
        setAlertBusyId(null);
      }
    },
    [user?.id, loadAlerts]
  );

  const summaryCards = useMemo(
    () => [
      { label: "Open alerts", value: openAlertCount == null ? "—" : String(openAlertCount) },
      { label: "High severity (open)", value: highOpenCount == null ? "—" : String(highOpenCount) },
      {
        label: "Recent (table)",
        value: alertsLoading ? "…" : `${recentAlerts.length} shown`,
      },
    ],
    [openAlertCount, highOpenCount, recentAlerts.length, alertsLoading]
  );

  const opsKpiCards = useMemo(() => {
    if (!opsKpi) {
      return [
        { label: "Pending withdrawals", value: "—" },
        { label: "Processing withdrawals", value: "—" },
        { label: "Fraud reviews open", value: "—" },
        { label: "Failed funding (24h)", value: "—" },
        { label: "Volume today (txns)", value: "—" },
        { label: "Transactions today", value: "—" },
        { label: "Support queue", value: "—" },
      ];
    }
    const fmt = (n) =>
      Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return [
      { label: "Pending withdrawals", value: String(opsKpi.pendingWithdrawals) },
      { label: "Processing withdrawals", value: String(opsKpi.processingWithdrawals) },
      { label: "Fraud reviews open", value: String(opsKpi.fraudOpen) },
      { label: "Failed funding (24h)", value: String(opsKpi.failedFunding24h) },
      { label: "Volume today (txns)", value: `$${fmt(opsKpi.volumeToday)}` },
      { label: "Transactions today", value: String(opsKpi.transactionsToday) },
      { label: "Support queue", value: "Planned" },
    ];
  }, [opsKpi]);

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <h1
            style={{
              fontSize: "1.55rem",
              fontWeight: 700,
              color: "#0c1222",
              marginBottom: "1rem",
              letterSpacing: "-0.02em",
            }}
          >
            Admin
          </h1>
          <p style={{ color: "#475569" }}>Loading…</p>
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
            Admin
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
          Admin
        </h1>
        <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#64748b" }}>
          Internal tools and review dashboards.
        </p>
        <ul style={{ margin: "0 0 1.5rem", paddingLeft: "1.25rem", fontSize: "0.95rem", color: "#64748b" }}>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/fraud" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Fraud dashboard
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/alerts" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Alert center
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/cases" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Case management
            </Link>
          </li>
          <li>
            <Link href="/admin/risk-users" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              User risk system
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/withdrawals" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Withdrawals queue
            </Link>
          </li>
        </ul>

        <div style={{ ...cardBase, padding: "1.1rem 1.15rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              Operations overview
            </h2>
            <button
              type="button"
              onClick={() => void loadOperational()}
              disabled={opsLoading}
              style={{
                ...btnXs,
                opacity: opsLoading ? 0.65 : 1,
                cursor: opsLoading ? "not-allowed" : "pointer",
              }}
            >
              Refresh metrics
            </button>
          </div>
          {opsError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{opsError}</p>
          ) : (
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
              Local-day aggregates for funding visibility and transaction volume (read-only). Volume sums up to 5,000
              transactions per day if the table is very busy.
            </p>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 130px), 1fr))",
              gap: "0.65rem",
              marginTop: "0.85rem",
            }}
          >
            {opsKpiCards.map((c) => (
              <div key={c.label} style={{ border: "1px solid #f1f5f9", borderRadius: "10px", padding: "0.65rem 0.75rem" }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                    lineHeight: 1.25,
                  }}
                >
                  {c.label}
                </p>
                <p
                  style={{
                    margin: "0.35rem 0 0",
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    fontVariantNumeric: "tabular-nums",
                    wordBreak: "break-word",
                  }}
                >
                  {opsLoading && !opsKpi ? "…" : c.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {opsKpi?.fundingFailureBuckets ? (
          <div style={{ ...cardBase, padding: "1.1rem 1.15rem", marginBottom: "1.25rem" }}>
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
              Failed funding signals (24h)
            </h2>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
              Counts from <code style={{ fontSize: "0.72rem" }}>fraud_logs</code> event types (duplicate block, capture
              issues, wallet credit failures).
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                gap: "0.65rem",
              }}
            >
              {[
                { label: "Duplicate blocked", value: opsKpi.fundingFailureBuckets.duplicate24h },
                { label: "Capture / amount issues", value: opsKpi.fundingFailureBuckets.captureFailures24h },
                { label: "Wallet credit failed", value: opsKpi.fundingFailureBuckets.walletCreditFailures24h },
              ].map((c) => (
                <div key={c.label} style={{ border: "1px solid #fef3c7", borderRadius: "10px", padding: "0.65rem 0.75rem", background: "#fffbeb" }}>
                  <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#92400e" }}>{c.label}</p>
                  <p style={{ margin: "0.35rem 0 0", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>{String(c.value)}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {opsKpi?.reconciliation ? (
          <div style={{ ...cardBase, padding: "1.1rem 1.15rem", marginBottom: "1.25rem" }}>
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
              {"Today's reconciliation (read-only)"}
            </h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                gap: "0.75rem",
              }}
            >
              {[
                { label: "Funded (fund_wallet)", amount: opsKpi.reconciliation.fundedToday },
                { label: "Withdrawn (withdraw_wallet)", amount: opsKpi.reconciliation.withdrawnToday },
                { label: "Sent (send_money)", amount: opsKpi.reconciliation.sentToday },
              ].map((row) => (
                <div key={row.label} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "0.75rem 0.85rem" }}>
                  <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{row.label}</p>
                  <p style={{ margin: "0.4rem 0 0", fontSize: "1.2rem", fontWeight: 800, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                    $
                    {Number(row.amount || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ ...cardBase, padding: "1.1rem 1.15rem", marginBottom: "1.25rem" }}>
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
            Recent activity
          </h2>
          <p style={{ margin: "0 0 0.85rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Newest first — funding and wallet debits, fraud logs, withdrawal / payout queue updates.
          </p>
          {opsLoading && opsActivity.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>Loading activity…</p>
          ) : opsActivity.length === 0 ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>No recent items.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
              {opsActivity.map((item) => {
                const kindColors = {
                  fund: { bg: "#ecfdf5", border: "#a7f3d0", fg: "#065f46" },
                  withdraw: { bg: "#fff1f2", border: "#fecdd3", fg: "#9f1239" },
                  fraud: { bg: "#fffbeb", border: "#fcd34d", fg: "#92400e" },
                  payout: { bg: "#eff6ff", border: "#bfdbfe", fg: "#1e40af" },
                };
                const pal = kindColors[item.kind] || { bg: "#f8fafc", border: "#e2e8f0", fg: "#334155" };
                const inner = (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 12rem" }}>
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: "0.62rem",
                          fontWeight: 800,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: pal.fg,
                          marginBottom: "0.2rem",
                        }}
                      >
                        {item.kind}
                      </span>
                      <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.88rem" }}>{item.title}</p>
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#475569", lineHeight: 1.4, wordBreak: "break-word" }}>
                        {item.detail}
                      </p>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#94a3b8", whiteSpace: "nowrap" }}>{formatWhen(item.at)}</div>
                  </div>
                );
                return (
                  <li
                    key={item.id}
                    style={{
                      border: `1px solid ${pal.border}`,
                      background: pal.bg,
                      borderRadius: "10px",
                      padding: "0.65rem 0.75rem",
                    }}
                  >
                    {item.href ? (
                      <Link href={item.href} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                        {inner}
                      </Link>
                    ) : (
                      inner
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div style={{ ...cardBase, padding: "1.1rem 1.15rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              Smart alerts
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
              <Link href="/admin/alerts" style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.8rem" }}>
                View all alerts
              </Link>
              <button
                type="button"
                onClick={() => void Promise.all([loadAlerts(), loadOperational()])}
                disabled={alertsLoading || opsLoading}
                style={{
                  ...btnXs,
                  opacity: alertsLoading || opsLoading ? 0.65 : 1,
                  cursor: alertsLoading || opsLoading ? "not-allowed" : "pointer",
                }}
              >
                Refresh
              </button>
            </div>
          </div>
          {alertsError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{alertsError}</p>
          ) : null}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: "0.65rem",
              marginTop: "0.85rem",
            }}
          >
            {summaryCards.map((c) => (
              <div key={c.label} style={{ border: "1px solid #f1f5f9", borderRadius: "10px", padding: "0.65rem 0.75rem" }}>
                <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8" }}>
                  {c.label}
                </p>
                <p style={{ margin: "0.35rem 0 0", fontSize: "1.15rem", fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                  {c.value}
                </p>
              </div>
            ))}
          </div>

          <div style={{ marginTop: "1rem", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  {["Created", "Title", "Severity", "Status", "User", "Link", "Actions"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "0.45rem 0.35rem",
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
                {recentAlerts.length === 0 && !alertsLoading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "0.65rem 0.35rem", color: "#64748b" }}>
                      No alerts yet (or none returned).
                    </td>
                  </tr>
                ) : null}
                {recentAlerts.map((r) => {
                  const busy = alertBusyId === r.id;
                  const uid = r.user_id;
                  const prof = uid ? alertProfiles[uid] : null;
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                      <td style={{ padding: "0.45rem 0.35rem", color: "#64748b", whiteSpace: "nowrap" }}>{formatWhen(r.created_at)}</td>
                      <td style={{ padding: "0.45rem 0.35rem", color: "#0f172a", fontWeight: 600 }}>{r.title}</td>
                      <td style={{ padding: "0.45rem 0.35rem" }}>
                        <span style={sevStyle(r.severity)}>{r.severity}</span>
                      </td>
                      <td style={{ padding: "0.45rem 0.35rem" }}>
                        <span style={statusPill(r.status)}>{r.status}</span>
                      </td>
                      <td style={{ padding: "0.45rem 0.35rem", color: "#0f172a" }}>
                        <div style={{ fontWeight: 600 }}>{userLabel(prof, uid)}</div>
                        {uid ? (
                          <div style={{ fontSize: "0.68rem", color: "#64748b", wordBreak: "break-all" }}>{uid}</div>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "0.45rem 0.35rem", whiteSpace: "nowrap" }}>
                        {r.fraud_log_id ? (
                          <Link href={`/admin/fraud/${encodeURIComponent(r.fraud_log_id)}`} style={{ fontWeight: 600, color: "#0ea5e9" }}>
                            Fraud
                          </Link>
                        ) : uid ? (
                          <Link href={`/admin/risk-users/${encodeURIComponent(uid)}`} style={{ fontWeight: 600, color: "#0ea5e9" }}>
                            User
                          </Link>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "0.45rem 0.35rem" }}>
                        <button
                          type="button"
                          disabled={busy || r.status !== "open"}
                          onClick={() => handleAlertStatus(r, "acknowledged")}
                          style={{
                            ...btnXs,
                            opacity: busy || r.status !== "open" ? 0.55 : 1,
                            cursor: busy || r.status !== "open" ? "not-allowed" : "pointer",
                          }}
                        >
                          Ack
                        </button>
                        <button
                          type="button"
                          disabled={busy || r.status === "resolved"}
                          onClick={() => handleAlertStatus(r, "resolved")}
                          style={{
                            ...btnXs,
                            marginRight: 0,
                            opacity: busy || r.status === "resolved" ? 0.55 : 1,
                            cursor: busy || r.status === "resolved" ? "not-allowed" : "pointer",
                          }}
                        >
                          Resolve
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
