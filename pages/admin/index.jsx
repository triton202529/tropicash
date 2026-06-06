import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import { updateSmartAlertStatus } from "../../lib/smartAlerts";
import { fetchAdminOperationalSnapshot } from "../../lib/adminOperationalOverview";
import { fetchAdminSecuritySignalCounts } from "../../lib/adminSecuritySignals";
import { fetchTreasuryMonitoringChipSummary, fetchTreasuryAdminAttentionSummary } from "../../lib/treasuryOperations";
import { fetchTreasuryEventChipSummary } from "../../lib/treasuryEventCenter";

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

function treasuryAttentionPostureStyle(posture) {
  const key = String(posture || "").toLowerCase();
  if (key === "active_review") {
    return { bg: "#fef2f2", border: "#fca5a5", fg: "#991b1b" };
  }
  if (key === "elevated_attention") {
    return { bg: "#fef3c7", border: "#fde68a", fg: "#b45309" };
  }
  if (key === "monitoring") {
    return { bg: "#eff6ff", border: "#bfdbfe", fg: "#1d4ed8" };
  }
  return { bg: "#ecfdf5", border: "#bbf7d0", fg: "#047857" };
}

function treasuryAdminSeverityStyle(sev) {
  const key = String(sev || "").toLowerCase();
  if (key === "high") {
    return { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" };
  }
  if (key === "elevated") {
    return { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" };
  }
  if (key === "moderate") {
    return { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" };
  }
  if (key === "low") {
    return { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" };
  }
  return { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" };
}

function treasuryAttentionPostureLabel(posture) {
  const key = String(posture || "").toLowerCase();
  const labels = {
    quiet: "Quiet",
    monitoring: "Monitoring",
    elevated_attention: "Elevated attention",
    active_review: "Active review",
  };
  return labels[key] || "Quiet";
}

export default function AdminIndexPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [openAlertCount, setOpenAlertCount] = useState(null);
  const [highOpenCount, setHighOpenCount] = useState(null);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [alertProfiles, setAlertProfiles] = useState({});
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertsError, setAlertsError] = useState(null);
  const [alertBusyId, setAlertBusyId] = useState(null);

  const [secSignals, setSecSignals] = useState({
    highSeverityEvents: null,
    suspiciousLogins: null,
    suspiciousLoginsLast7d: null,
    suspiciousLoginWarning: null,
    suspiciousLoginHigh: null,
    revokedSessions: null,
    error: null,
  });
  const [secSignalsLoading, setSecSignalsLoading] = useState(false);

  const [opsLoading, setOpsLoading] = useState(false);
  const [opsError, setOpsError] = useState(null);
  const [opsKpi, setOpsKpi] = useState(null);
  const [opsActivity, setOpsActivity] = useState([]);

  const [treasuryChip, setTreasuryChip] = useState({
    label: "Treasury: Monitoring",
    alertReadinessLabel: null,
    notificationReadinessLabel: null,
    digestReadinessLabel: null,
    executiveEscalationLabel: null,
    decisionSupportLabel: null,
    institutionalMemoryLabel: null,
    confidenceLabel: null,
    consistencyLabel: null,
    narrativeLabel: null,
    playbookLabel: null,
    scenarioResponseLabel: null,
    timelineLabel: null,
    priorityLabel: null,
    coherenceLabel: null,
    adaptiveCadenceLabel: null,
    leadershipReadinessLabel: null,
    metaReasoningLabel: null,
    decisionTraceLabel: null,
    recommendationStabilityLabel: null,
    advisoryDriftLabel: null,
    regimeLabel: null,
    outlookLabel: null,
    href: "/admin/treasury-intelligence",
    loading: false,
  });

  const [treasuryAttention, setTreasuryAttention] = useState({
    alertPosture: "quiet",
    alertSummary: "Treasury advisory posture loading…",
    alertCounts: { total: 0, bySeverity: {}, byStatus: {} },
    treasuryAdminAlerts: [],
    href: "/admin/treasury-intelligence",
    loading: true,
  });

  const [treasuryEventsChip, setTreasuryEventsChip] = useState({
    label: "Treasury Events: —",
    subtitle: null,
    openCases: null,
    escalatedCases: null,
    criticalCount: 0,
    warningCount: 0,
    href: "/admin/treasury-intelligence#treasury-event-center",
    loading: true,
  });

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

  const loadSecuritySignals = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setSecSignalsLoading(true);
    try {
      const res = await fetchAdminSecuritySignalCounts(supabase);
      setSecSignals(res);
    } catch (e) {
      console.error(e);
      setSecSignals({
        highSeverityEvents: null,
        suspiciousLogins: null,
        suspiciousLoginsLast7d: null,
        suspiciousLoginWarning: null,
        suspiciousLoginHigh: null,
        revokedSessions: null,
        error: e?.message || "Failed to load security signals.",
      });
    } finally {
      setSecSignalsLoading(false);
    }
  }, [user?.id, user, profile]);

  const loadTreasuryChip = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setTreasuryChip((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetchTreasuryMonitoringChipSummary(supabase);
      setTreasuryChip({
        label: res.label || "Treasury: Monitoring",
        alertReadinessLabel: res.alertReadinessLabel || null,
        notificationReadinessLabel: res.notificationReadinessLabel || null,
        digestReadinessLabel: res.digestReadinessLabel || null,
        executiveEscalationLabel: res.executiveEscalationLabel || null,
        decisionSupportLabel: res.decisionSupportLabel || null,
        institutionalMemoryLabel: res.institutionalMemoryLabel || null,
        confidenceLabel: res.confidenceLabel || null,
        consistencyLabel: res.consistencyLabel || null,
        narrativeLabel: res.narrativeLabel || null,
        playbookLabel: res.playbookLabel || null,
        scenarioResponseLabel: res.scenarioResponseLabel || null,
        timelineLabel: res.timelineLabel || null,
        priorityLabel: res.priorityLabel || null,
        coherenceLabel: res.coherenceLabel || null,
        adaptiveCadenceLabel: res.adaptiveCadenceLabel || null,
        leadershipReadinessLabel: res.leadershipReadinessLabel || null,
        metaReasoningLabel: res.metaReasoningLabel || null,
        decisionTraceLabel: res.decisionTraceLabel || null,
        recommendationStabilityLabel: res.recommendationStabilityLabel || null,
        advisoryDriftLabel: res.advisoryDriftLabel || null,
        regimeLabel: res.regimeLabel || null,
        outlookLabel: res.outlookLabel || null,
        href: res.href || "/admin/treasury-intelligence",
        loading: false,
        updatedAt: res.updatedAt || null,
      });
    } catch {
      setTreasuryChip({
        label: "Treasury: Monitoring",
        href: "/admin/treasury-intelligence",
        loading: false,
      });
    }
  }, [user?.id, user, profile]);

  const loadTreasuryAttention = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setTreasuryAttention((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetchTreasuryAdminAttentionSummary(supabase);
      setTreasuryAttention({
        alertPosture: res.alertPosture || "quiet",
        alertSummary: res.alertSummary || "Treasury advisory posture unavailable.",
        alertCounts: res.alertCounts || { total: 0, bySeverity: {}, byStatus: {} },
        treasuryAdminAlerts: res.treasuryAdminAlerts || [],
        href: res.href || "/admin/treasury-intelligence",
        updatedAt: res.updatedAt || null,
        loading: false,
      });
    } catch {
      setTreasuryAttention({
        alertPosture: "quiet",
        alertSummary: "Treasury advisory posture unavailable.",
        alertCounts: { total: 0, bySeverity: {}, byStatus: {} },
        treasuryAdminAlerts: [],
        href: "/admin/treasury-intelligence",
        loading: false,
      });
    }
  }, [user?.id, user, profile]);

  const loadTreasuryEventsChip = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setTreasuryEventsChip((prev) => ({ ...prev, loading: true }));
    try {
      const res = await fetchTreasuryEventChipSummary(supabase);
      setTreasuryEventsChip({
        label: res.label || "Treasury Events: —",
        subtitle: res.subtitle || null,
        openCases: res.openCases ?? null,
        escalatedCases: res.escalatedCases ?? null,
        criticalCount: res.criticalCount ?? 0,
        warningCount: res.warningCount ?? 0,
        href: res.href || "/admin/treasury-intelligence#treasury-event-center",
        loading: false,
      });
    } catch {
      setTreasuryEventsChip({
        label: "Treasury Events: —",
        subtitle: null,
        openCases: null,
        escalatedCases: null,
        criticalCount: 0,
        warningCount: 0,
        href: "/admin/treasury-intelligence#treasury-event-center",
        loading: false,
      });
    }
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    let cancelled = false;
    (async () => {
      await Promise.all([
        loadAlerts(),
        loadOperational(),
        loadSecuritySignals(),
        loadTreasuryChip(),
        loadTreasuryAttention(),
        loadTreasuryEventsChip(),
      ]);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, profile, loadAlerts, loadOperational, loadSecuritySignals, loadTreasuryChip, loadTreasuryAttention, loadTreasuryEventsChip]);

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
            <Link href="/admin/risk" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Risk Intelligence
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/risk-cases" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Risk Review Queue
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/security" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Security Console
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/kyc" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              KYC Review
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/kyc-limits" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              KYC Limit Policies
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/audit" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Admin Audit Trail
            </Link>
          </li>
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
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/feedback" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Tester feedback
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/logs" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Operational logs
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/timeline" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Audit timeline
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/treasury" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Treasury
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/treasury-intelligence" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Treasury Intelligence
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/treasury-simulation-lab" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Treasury Simulation Lab
            </Link>
            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
              {" "}
              — test treasury advisory behavior against synthetic scenarios
            </span>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/ledger" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Internal ledger
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/triton-transfers" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Triton transfers
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/admin/health" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Health check
            </Link>
          </li>
          <li style={{ marginBottom: "0.5rem" }}>
            <Link href="/dev-console/app-governance" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Developer Governance
            </Link>
            <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
              {" "}
              — developer app review queue (Dev Console)
            </span>
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
          <h2
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Treasury monitoring
          </h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Advisory operating state from the latest treasury operational event — read-only observability only.
          </p>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.55rem 0.85rem",
              borderRadius: "10px",
              border: "1px solid #bae6fd",
              background: "#f0f9ff",
            }}
          >
            <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0369a1" }}>
              {treasuryChip.loading ? "Treasury: …" : treasuryChip.label}
            </span>
            {!treasuryChip.loading && treasuryChip.outlookLabel ? (
              <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 500 }}>
                · {treasuryChip.outlookLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.regimeLabel ? (
              <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 500 }}>
                · {treasuryChip.regimeLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.advisoryDriftLabel ? (
              <span style={{ color: "#64748b", fontWeight: 500 }}>
                · {treasuryChip.advisoryDriftLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.recommendationStabilityLabel ? (
              <span style={{ color: "#64748b", fontWeight: 500 }}>
                · {treasuryChip.recommendationStabilityLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.decisionTraceLabel ? (
              <span style={{ fontSize: "0.78rem", color: "#64748b", fontWeight: 500 }}>
                · {treasuryChip.decisionTraceLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.metaReasoningLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.metaReasoningLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.leadershipReadinessLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.leadershipReadinessLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.adaptiveCadenceLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.adaptiveCadenceLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.coherenceLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.coherenceLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.priorityLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.priorityLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.timelineLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.timelineLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.scenarioResponseLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.scenarioResponseLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.playbookLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.playbookLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.narrativeLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.narrativeLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.consistencyLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.consistencyLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.confidenceLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.confidenceLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.institutionalMemoryLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.institutionalMemoryLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.decisionSupportLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.decisionSupportLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.executiveEscalationLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.executiveEscalationLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.digestReadinessLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.digestReadinessLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.notificationReadinessLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.notificationReadinessLabel}
              </span>
            ) : !treasuryChip.loading && treasuryChip.alertReadinessLabel ? (
              <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                · {treasuryChip.alertReadinessLabel}
              </span>
            ) : null}
          </div>
          {treasuryChip.updatedAt ? (
            <p style={{ margin: "0.65rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
              Updated {formatWhen(treasuryChip.updatedAt)}
            </p>
          ) : null}
          <div
            style={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "0.25rem",
              marginTop: "0.75rem",
              padding: "0.45rem 0.75rem",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
              {treasuryEventsChip.loading ? "Treasury Events: …" : treasuryEventsChip.label}
            </span>
            {!treasuryEventsChip.loading && treasuryEventsChip.subtitle ? (
              <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 500 }}>
                {treasuryEventsChip.subtitle}
              </span>
            ) : null}
            {!treasuryEventsChip.loading &&
            treasuryEventsChip.openCases != null &&
            treasuryEventsChip.escalatedCases != null ? (
              <span style={{ fontSize: "0.72rem", color: "#64748b" }}>
                Open treasury cases: {treasuryEventsChip.openCases} · Escalated treasury cases:{" "}
                {treasuryEventsChip.escalatedCases}
              </span>
            ) : null}
          </div>
          <p style={{ margin: "0.85rem 0 0", fontSize: "0.82rem" }}>
            <Link href={treasuryChip.href} style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Open Treasury Intelligence →
            </Link>
          </p>
        </div>

        <div style={{ ...cardBase, padding: "1.1rem 1.15rem", marginBottom: "1.25rem" }}>
          <h2
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Treasury Attention
          </h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            In-app advisory treasury alerts from latest operational event metadata.{" "}
            <strong style={{ fontWeight: 700, color: "#64748b" }}>Advisory only</strong> — no emails, push, SMS, or
            external notifications.
          </p>
          {(() => {
            const pal = treasuryAttentionPostureStyle(treasuryAttention.alertPosture);
            const elevatedCount =
              (treasuryAttention.alertCounts?.bySeverity?.elevated || 0) +
              (treasuryAttention.alertCounts?.bySeverity?.high || 0);
            return (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.65rem", marginBottom: "0.85rem" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0.35rem 0.65rem",
                      borderRadius: "999px",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      background: pal.bg,
                      color: pal.fg,
                      border: `1px solid ${pal.border}`,
                    }}
                  >
                    {treasuryAttention.loading
                      ? "Posture: …"
                      : `Posture: ${treasuryAttentionPostureLabel(treasuryAttention.alertPosture)}`}
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#475569" }}>
                    {treasuryAttention.loading
                      ? "…"
                      : `${treasuryAttention.alertCounts?.total || 0} advisory alert${(treasuryAttention.alertCounts?.total || 0) === 1 ? "" : "s"}`}
                    {!treasuryAttention.loading && elevatedCount > 0 ? ` · ${elevatedCount} elevated` : ""}
                  </span>
                  {!treasuryAttention.loading && treasuryChip.executiveEscalationLabel ? (
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                      · {treasuryChip.executiveEscalationLabel.replace(/^Treasury executive posture: /, "")}
                    </span>
                  ) : !treasuryAttention.loading && treasuryChip.digestReadinessLabel ? (
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                      · {treasuryChip.digestReadinessLabel.replace(/^Treasury digest: /, "")}
                    </span>
                  ) : !treasuryAttention.loading && treasuryChip.notificationReadinessLabel ? (
                    <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
                      · {treasuryChip.notificationReadinessLabel.replace(/^Treasury notifications: /, "")}
                    </span>
                  ) : null}
                </div>
                <p style={{ margin: "0 0 0.85rem", fontSize: "0.85rem", color: "#334155", lineHeight: 1.5 }}>
                  {treasuryAttention.loading ? "Loading treasury advisories…" : treasuryAttention.alertSummary}
                </p>
                {!treasuryAttention.loading && treasuryAttention.treasuryAdminAlerts?.length > 0 ? (
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
                    {treasuryAttention.treasuryAdminAlerts.slice(0, 5).map((alert) => {
                      const sevPal = treasuryAdminSeverityStyle(alert.severity);
                      return (
                        <li
                          key={alert.id}
                          style={{
                            border: "1px solid #e2e8f0",
                            borderRadius: "10px",
                            padding: "0.65rem 0.75rem",
                            background: "#f8fafc",
                          }}
                        >
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem", marginBottom: "0.25rem" }}>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.12rem 0.4rem",
                                borderRadius: "6px",
                                fontSize: "0.62rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background: sevPal.bg,
                                color: sevPal.fg,
                                border: `1px solid ${sevPal.border}`,
                              }}
                            >
                              {alert.severity}
                            </span>
                            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#0369a1", textTransform: "uppercase" }}>
                              Advisory only
                            </span>
                          </div>
                          <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.85rem" }}>{alert.title}</p>
                          <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.4 }}>
                            {alert.summary}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                ) : !treasuryAttention.loading ? (
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
                    No treasury advisories at this time — routine monitoring recommended.
                  </p>
                ) : null}
                {treasuryAttention.updatedAt ? (
                  <p style={{ margin: "0.65rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
                    Updated {formatWhen(treasuryAttention.updatedAt)}
                  </p>
                ) : null}
                <p style={{ margin: "0.85rem 0 0", fontSize: "0.82rem" }}>
                  <Link href={treasuryAttention.href} style={{ fontWeight: 600, color: "#0ea5e9" }}>
                    Open Treasury Intelligence →
                  </Link>
                </p>
              </>
            );
          })()}
        </div>

        <div style={{ ...cardBase, padding: "1.1rem 1.15rem", marginBottom: "1.25rem" }}>
          <h2
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Security signals
          </h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Cross-account counts from <code style={{ fontSize: "0.72rem" }}>security_events</code> and{" "}
            <code style={{ fontSize: "0.72rem" }}>user_sessions</code> (admin read-only). Apply{" "}
            <code style={{ fontSize: "0.72rem" }}>security_foundation.sql</code> if these stay empty.
          </p>
          {secSignals.error ? (
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", color: "#b91c1c" }}>{secSignals.error}</p>
          ) : null}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
              gap: "0.65rem",
            }}
          >
            {[
              { label: "High + critical events", value: secSignals.highSeverityEvents },
              { label: "Suspicious logins (all)", value: secSignals.suspiciousLogins },
              { label: "Suspicious logins (7d)", value: secSignals.suspiciousLoginsLast7d },
              { label: "Suspicious (warning)", value: secSignals.suspiciousLoginWarning },
              { label: "Suspicious (high)", value: secSignals.suspiciousLoginHigh },
              { label: "Revoked sessions", value: secSignals.revokedSessions },
            ].map((c) => (
              <div key={c.label} style={{ border: "1px solid #e0f2fe", borderRadius: "10px", padding: "0.65rem 0.75rem", background: "#f8fafc" }}>
                <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>
                  {c.label}
                </p>
                <p style={{ margin: "0.35rem 0 0", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                  {secSignalsLoading ? "…" : c.value == null ? "—" : String(c.value)}
                </p>
              </div>
            ))}
          </div>
          <p style={{ margin: "0.85rem 0 0", fontSize: "0.82rem" }}>
            <Link href="/admin/security" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Open Security Console →
            </Link>
          </p>
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
                onClick={() =>
                  void Promise.all([
                    loadAlerts(),
                    loadOperational(),
                    loadSecuritySignals(),
                    loadTreasuryChip(),
                    loadTreasuryAttention(),
                    loadTreasuryEventsChip(),
                  ])
                }
                disabled={
                  alertsLoading ||
                  opsLoading ||
                  secSignalsLoading ||
                  treasuryChip.loading ||
                  treasuryAttention.loading ||
                  treasuryEventsChip.loading
                }
                style={{
                  ...btnXs,
                  opacity:
                    alertsLoading ||
                    opsLoading ||
                    secSignalsLoading ||
                    treasuryChip.loading ||
                    treasuryAttention.loading ||
                    treasuryEventsChip.loading
                      ? 0.65
                      : 1,
                  cursor:
                    alertsLoading ||
                    opsLoading ||
                    secSignalsLoading ||
                    treasuryChip.loading ||
                    treasuryAttention.loading ||
                    treasuryEventsChip.loading
                      ? "not-allowed"
                      : "pointer",
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
