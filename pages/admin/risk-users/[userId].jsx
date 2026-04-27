import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { useUser } from "../../../lib/userContext";
import { isAdminUser } from "../../../lib/adminAccess";
import Navbar from "../../../components/Navbar";
import {
  aggregateStatsFromFraudLogs,
  deriveUserRiskState,
  normalizeRiskFlagsArray,
  recomputeAndPersistUserRiskState,
} from "../../../lib/riskFlags";
import { normalizeAccountFlags, persistAccountControlState } from "../../../lib/accountControls";
import { updateSmartAlertStatus } from "../../../lib/smartAlerts";
import { createFraudCase, formatShortUserId } from "../../../lib/caseManagement";
import { buildUserTimeline } from "../../../lib/userTimeline";

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

function joinReasons(parts) {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function buildQuickAssessment(tier, s) {
  const avg = Number(s.avg_risk_score) || 0;
  if (tier === "high") {
    const parts = [];
    if (avg >= 60) parts.push(`their average fraud risk score is ${avg.toFixed(1)} (≥ 60)`);
    if (s.high_count >= 3) parts.push(`they have ${s.high_count} high-risk fraud logs (≥ 3)`);
    if (s.escalated_count >= 2) parts.push(`they have ${s.escalated_count} escalated cases (≥ 2)`);
    const body = joinReasons(parts) || "aggregated signals cross the high tier threshold";
    return `This user is high risk because ${body}.`;
  }
  if (tier === "medium") {
    const parts = [];
    if (avg >= 30) parts.push(`their average fraud risk score is ${avg.toFixed(1)} (≥ 30)`);
    if (s.medium_count >= 2) parts.push(`they have ${s.medium_count} medium-risk fraud logs (≥ 2)`);
    if (s.open_count >= 2) parts.push(`they have ${s.open_count} open reviews (≥ 2)`);
    const body = joinReasons(parts) || "aggregated signals cross the medium tier threshold";
    return `This user is medium risk because ${body}.`;
  }
  return "This user is low risk under the current rules: averages, high-severity counts, escalations, and open review backlog all stay below medium and high thresholds.";
}

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

function tierBadgeStyle(tier) {
  return riskBadgeStyle(tier);
}

function accountStatusBadgeStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === "restricted") {
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
  if (key === "under_review") {
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

const btnSm = {
  padding: "0.38rem 0.7rem",
  fontSize: "0.75rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
  marginRight: "0.35rem",
  marginBottom: "0.35rem",
};

const labelMuted = {
  fontSize: "0.72rem",
  fontWeight: 600,
  color: "#94a3b8",
  marginBottom: "0.25rem",
};

const valueRow = { marginBottom: "0.65rem" };

function formatRelativeShort(iso) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diffMs = Date.now() - t;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return formatWhen(iso);
}

function timelineDotColor(severity) {
  const k = String(severity || "").toLowerCase();
  if (k === "high") return "#dc2626";
  if (k === "medium") return "#d97706";
  if (k === "success") return "#16a34a";
  return "#94a3b8";
}

export default function AdminRiskUserDetailPage() {
  const router = useRouter();
  const rawUserId = router.query?.userId;
  const userId =
    typeof rawUserId === "string" ? rawUserId : Array.isArray(rawUserId) ? rawUserId[0] : null;

  const { user, profile: sessionProfile, loading: authLoading } = useUser();

  const [pageLoading, setPageLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [allLogs, setAllLogs] = useState([]);
  const [recomputeBusy, setRecomputeBusy] = useState(false);
  const [accountCtrlBusy, setAccountCtrlBusy] = useState(false);
  const [manualAcctBusy, setManualAcctBusy] = useState(null);
  const [userAlerts, setUserAlerts] = useState([]);
  const [alertBusyId, setAlertBusyId] = useState(null);
  const [userCaseBusy, setUserCaseBusy] = useState(false);
  const [investigationTimeline, setInvestigationTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !user?.id || !isAdminUser(user, sessionProfile)) return;

    setPageLoading(true);
    setFetchError(null);
    setProfile(null);
    setAllLogs([]);

    const logSelect =
      "id, user_id, created_at, transaction_type, amount, risk_score, risk_level, status, flags";

    const [logsRes, profRes] = await Promise.all([
      supabase
        .from("fraud_logs")
        .select(logSelect)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(2000),
      supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone, risk_level, risk_flags, risk_score_snapshot, risk_last_evaluated_at, account_status, account_flags, account_last_reviewed_at"
        )
        .eq("id", userId)
        .maybeSingle(),
    ]);

    if (logsRes.error) {
      console.error(logsRes.error);
      setFetchError(logsRes.error.message || "Failed to load fraud logs.");
      setPageLoading(false);
      return;
    }

    const logsData = logsRes.data || [];

    if (profRes.error) {
      console.error(profRes.error);
      setProfile(null);
    } else {
      setProfile(profRes.data || null);
    }

    setAllLogs(logsData);

    try {
      const rec = await recomputeAndPersistUserRiskState(supabase, userId, {
        logs: logsData,
        actorUserId: user?.id,
      });
      if (!rec.ok) console.error(rec.error);
      const { data: prof2, error: p2e } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone, risk_level, risk_flags, risk_score_snapshot, risk_last_evaluated_at, account_status, account_flags, account_last_reviewed_at"
        )
        .eq("id", userId)
        .maybeSingle();
      if (!p2e && prof2) setProfile(prof2);
    } catch (e) {
      console.error(e);
    }

    try {
      const { data: alertRows, error: alErr } = await supabase
        .from("smart_alerts")
        .select("id, created_at, title, severity, status, fraud_log_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (alErr) {
        console.error(alErr);
        setUserAlerts([]);
      } else {
        setUserAlerts(alertRows || []);
      }
    } catch (e) {
      console.error(e);
      setUserAlerts([]);
    }

    setPageLoading(false);
  }, [userId, user?.id, user, sessionProfile]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id || !isAdminUser(user, sessionProfile)) {
      setPageLoading(false);
      return;
    }
    if (!router.isReady || !userId) return;
    load();
  }, [authLoading, user?.id, user, sessionProfile, router.isReady, userId, load]);

  const stats = useMemo(() => {
    if (!userId) return null;
    return aggregateLogsForUser(userId, allLogs);
  }, [userId, allLogs]);

  const latestTableLogs = useMemo(() => allLogs.slice(0, 20), [allLogs]);

  const displayName = userId ? userLabel(profile, userId) : "—";

  const assessment = useMemo(() => {
    if (!stats) return "";
    return buildQuickAssessment(stats.overall_risk_tier, stats);
  }, [stats]);

  const liveDerived = useMemo(() => (stats ? deriveUserRiskState(stats) : null), [stats]);

  const handleRecomputeRisk = useCallback(async () => {
    if (!userId) return;
    setRecomputeBusy(true);
    try {
      const rec = await recomputeAndPersistUserRiskState(supabase, userId, {
        logs: allLogs,
        actorUserId: user?.id,
      });
      if (!rec.ok) console.error(rec.error);
      const { data: prof2, error: p2e } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone, risk_level, risk_flags, risk_score_snapshot, risk_last_evaluated_at, account_status, account_flags, account_last_reviewed_at"
        )
        .eq("id", userId)
        .maybeSingle();
      if (!p2e && prof2) setProfile(prof2);
    } catch (e) {
      console.error(e);
    } finally {
      setRecomputeBusy(false);
    }
  }, [userId, allLogs, user?.id]);

  const refreshProfileRow = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: prof2, error: p2e } = await supabase
        .from("profiles")
        .select(
          "id, full_name, email, phone, risk_level, risk_flags, risk_score_snapshot, risk_last_evaluated_at, account_status, account_flags, account_last_reviewed_at"
        )
        .eq("id", userId)
        .maybeSingle();
      if (!p2e && prof2) setProfile(prof2);
    } catch (e) {
      console.error(e);
    }
  }, [userId]);

  const handleRecomputeAccountControl = useCallback(async () => {
    if (!userId || !user?.id) return;
    setAccountCtrlBusy(true);
    try {
      const stats = aggregateStatsFromFraudLogs(allLogs);
      const derived = deriveUserRiskState(stats);
      const ac = await persistAccountControlState(supabase, userId, {
        source: "recomputed",
        actorUserId: user.id,
        riskLevel: derived.riskLevel,
        riskFlags: derived.riskFlags,
        stats,
      });
      if (!ac.ok) console.error(ac.error);
      await refreshProfileRow();
    } catch (e) {
      console.error(e);
    } finally {
      setAccountCtrlBusy(false);
    }
  }, [userId, user?.id, allLogs, refreshProfileRow]);

  const refreshUserAlerts = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: alertRows, error: alErr } = await supabase
        .from("smart_alerts")
        .select("id, created_at, title, severity, status, fraud_log_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (alErr) {
        console.error(alErr);
        return;
      }
      setUserAlerts(alertRows || []);
    } catch (e) {
      console.error(e);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, sessionProfile)) return;
    if (!router.isReady || !userId) return;
    const channel = supabase
      .channel(`smart-alerts-risk-user-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "smart_alerts",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshUserAlerts();
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") console.error("smart_alerts realtime:", err);
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id, user, sessionProfile, router.isReady, userId, refreshUserAlerts]);

  const handleUserAlertStatus = useCallback(
    async (row, nextStatus) => {
      if (!user?.id || !row?.id) return;
      setAlertBusyId(row.id);
      try {
        const res = await updateSmartAlertStatus(supabase, {
          alertId: row.id,
          status: nextStatus,
          actorUserId: user.id,
          userId,
          fraudLogId: row.fraud_log_id ?? null,
        });
        if (!res.ok) console.error(res.error);
        await refreshUserAlerts();
      } catch (e) {
        console.error(e);
      } finally {
        setAlertBusyId(null);
      }
    },
    [user?.id, userId, refreshUserAlerts]
  );

  const handleManualAccountStatus = useCallback(
    async (next) => {
      if (!userId || !user?.id) return;
      setManualAcctBusy(next);
      try {
        const ac = await persistAccountControlState(supabase, userId, {
          source: "manual",
          manualAccountStatus: next,
          actorUserId: user.id,
        });
        if (!ac.ok) console.error(ac.error);
        await refreshProfileRow();
      } catch (e) {
        console.error(e);
      } finally {
        setManualAcctBusy(null);
      }
    },
    [userId, user?.id, refreshProfileRow]
  );

  const handleOpenCaseForUser = useCallback(async () => {
    if (!userId || !user?.id) return;
    setUserCaseBusy(true);
    try {
      const acct = String(profile?.account_status || "").toLowerCase();
      const tier = String(stats?.overall_risk_tier || "").toLowerCase();
      const hasHighSevAlert = userAlerts.some((a) => String(a.severity || "").toLowerCase() === "high");
      let priority = "medium";
      if (acct === "restricted" && hasHighSevAlert) priority = "critical";
      else if (tier === "high" || (stats && stats.escalated_count >= 2)) priority = "high";

      const res = await createFraudCase(supabase, {
        userId,
        primaryFraudLogId: null,
        title: `User investigation — ${formatShortUserId(userId)}`,
        summary: null,
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
      setUserCaseBusy(false);
    }
  }, [userId, user?.id, profile, stats, userAlerts, router]);

  useEffect(() => {
    if (!userId || !user?.id || !isAdminUser(user, sessionProfile)) return;
    let cancelled = false;
    setTimelineLoading(true);
    void buildUserTimeline(supabase, userId)
      .then((rows) => {
        if (!cancelled) setInvestigationTimeline(Array.isArray(rows) ? rows : []);
      })
      .catch((e) => {
        console.error(e);
        if (!cancelled) setInvestigationTimeline([]);
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, user?.id, user, sessionProfile, allLogs.length]);

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

  if (!authLoading && user && !isAdminUser(user, sessionProfile)) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Not authorized</h2>
        <p>This area is restricted to admin users.</p>
      </div>
    );
  }

  if (!router.isReady || !userId) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading…</p>
        </div>
      </>
    );
  }

  if (pageLoading && !fetchError) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading user risk profile…</p>
        </div>
      </>
    );
  }

  if (fetchError) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <Link href="/admin/risk-users" style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.9rem" }}>
            ← Back to user risk
          </Link>
          <div
            style={{
              ...cardBase,
              marginTop: "1rem",
              padding: "1rem 1.15rem",
              background: "#fef2f2",
              borderColor: "#fecaca",
              color: "#b91c1c",
              fontSize: "0.9rem",
            }}
          >
            {fetchError}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <Link
          href="/admin/risk-users"
          style={{
            display: "inline-block",
            marginBottom: "1rem",
            fontWeight: 600,
            color: "#0ea5e9",
            fontSize: "0.9rem",
          }}
        >
          ← Back to user risk
        </Link>
        {userId ? (
          <p style={{ margin: "0 0 1rem", fontSize: "0.8rem" }}>
            <Link
              href={`/admin/users/${encodeURIComponent(userId)}/timeline`}
              style={{ fontWeight: 600, color: "#0ea5e9" }}
            >
              Investigation timeline →
            </Link>
          </p>
        ) : null}

        {/* Section A — Header */}
        <div
          style={{
            ...cardBase,
            padding: "1.1rem 1.25rem",
            marginBottom: "1rem",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem 1rem",
          }}
        >
          <div style={{ flex: "1 1 220px" }}>
            <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8" }}>USER</p>
            <p style={{ margin: "0.35rem 0 0", fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
              {displayName}
            </p>
            <p
              style={{
                margin: "0.35rem 0 0",
                fontSize: "0.8rem",
                color: "#64748b",
                wordBreak: "break-all",
              }}
            >
              {userId}
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
            {stats ? <span style={tierBadgeStyle(stats.overall_risk_tier)}>{stats.overall_risk_tier}</span> : null}
            <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
              Total logs:{" "}
              <strong style={{ fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
                {stats?.total_logs ?? 0}
              </strong>
            </span>
            <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
              Latest: {formatWhen(stats?.latest_activity_at)}
            </span>
          </div>
          <div style={{ marginLeft: "auto", flex: "0 0 auto" }}>
            <button
              type="button"
              disabled={userCaseBusy}
              onClick={handleOpenCaseForUser}
              style={{
                ...btnSm,
                marginRight: 0,
                marginBottom: 0,
                background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
                borderColor: "#93c5fd",
                color: "#1e40af",
                fontWeight: 700,
                opacity: userCaseBusy ? 0.55 : 1,
                cursor: userCaseBusy ? "not-allowed" : "pointer",
              }}
            >
              {userCaseBusy ? "Opening…" : "Open Case for User"}
            </button>
          </div>
        </div>

        {/* Section B — User summary */}
        <div style={{ ...cardBase, padding: "1.1rem 1.25rem", marginBottom: "1rem" }}>
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
            User summary
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "0.65rem 1rem",
            }}
          >
            <div style={valueRow}>
              <div style={labelMuted}>Full name</div>
              <div style={{ fontWeight: 600, color: "#0f172a" }}>{profile?.full_name?.trim() || "—"}</div>
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Email</div>
              <div style={{ fontSize: "0.875rem", wordBreak: "break-all", color: "#0f172a" }}>
                {profile?.email?.trim() || "—"}
              </div>
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Phone</div>
              <div style={{ fontSize: "0.875rem", color: "#0f172a" }}>{profile?.phone || "—"}</div>
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Average risk score</div>
              <div style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
                {stats && stats.total_logs > 0 ? stats.avg_risk_score.toFixed(1) : "—"}
              </div>
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>High / medium / low events</div>
              <div style={{ fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
                {stats ? `${stats.high_count} / ${stats.medium_count} / ${stats.low_count}` : "—"}
              </div>
            </div>
            <div style={{ marginBottom: 0 }}>
              <div style={labelMuted}>Open / reviewed / escalated</div>
              <div style={{ fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
                {stats ? `${stats.open_count} / ${stats.reviewed_count} / ${stats.escalated_count}` : "—"}
              </div>
            </div>
          </div>
        </div>

        {/* User risk flags (persisted on profiles) */}
        <div style={{ ...cardBase, padding: "1.1rem 1.25rem", marginBottom: "1rem" }}>
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
            User risk flags
          </h2>
          {!profile ? (
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", color: "#64748b" }}>
              No profile row for this user id — risk state cannot be persisted until a profile exists.
              {liveDerived ? (
                <span style={{ display: "block", marginTop: "0.5rem" }}>
                  <span style={labelMuted}>Computed from logs (not stored)</span>
                  <span style={{ display: "block", marginTop: "0.35rem" }}>
                    <span style={tierBadgeStyle(liveDerived.riskLevel)}>{liveDerived.riskLevel}</span>
                  </span>
                  <span style={{ display: "block", marginTop: "0.35rem" }}>
                    {liveDerived.riskFlags.length === 0 ? (
                      <span style={{ color: "#94a3b8" }}>—</span>
                    ) : (
                      liveDerived.riskFlags.map((f, i) => (
                        <span key={`ld-${i}-${f}`} style={chipStyle()}>
                          {f}
                        </span>
                      ))
                    )}
                  </span>
                </span>
              ) : null}
            </p>
          ) : (
            <>
              <div style={valueRow}>
                <div style={labelMuted}>Account risk level</div>
                {profile.risk_last_evaluated_at ? (
                  <span style={tierBadgeStyle(profile.risk_level || "low")}>{profile.risk_level || "—"}</span>
                ) : liveDerived ? (
                  <div>
                    <span style={tierBadgeStyle(liveDerived.riskLevel)}>{liveDerived.riskLevel}</span>
                    <span style={{ fontSize: "0.72rem", color: "#94a3b8", marginLeft: "0.35rem" }}>(computed)</span>
                  </div>
                ) : (
                  <span style={{ color: "#94a3b8" }}>—</span>
                )}
              </div>
              <div style={valueRow}>
                <div style={labelMuted}>Risk score snapshot</div>
                <div style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
                  {profile.risk_last_evaluated_at
                    ? profile.risk_score_snapshot != null
                      ? Number(profile.risk_score_snapshot).toFixed(1)
                      : "—"
                    : liveDerived?.riskScoreSnapshot != null
                      ? Number(liveDerived.riskScoreSnapshot).toFixed(1)
                      : "—"}
                </div>
              </div>
              <div style={valueRow}>
                <div style={labelMuted}>Last evaluated</div>
                <div style={{ fontSize: "0.875rem", color: "#0f172a" }}>
                  {formatWhen(profile.risk_last_evaluated_at)}
                </div>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={labelMuted}>Account flags</div>
                {(() => {
                  const flagList = profile.risk_last_evaluated_at
                    ? normalizeRiskFlagsArray(profile.risk_flags)
                    : liveDerived?.riskFlags || [];
                  return flagList.length === 0 ? (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  ) : (
                    flagList.map((f, i) => (
                      <span key={`pf-${i}-${f}`} style={chipStyle()}>
                        {f}
                      </span>
                    ))
                  );
                })()}
              </div>
            </>
          )}
          <button
            type="button"
            disabled={recomputeBusy}
            onClick={() => handleRecomputeRisk()}
            style={{
              ...btnSm,
              opacity: recomputeBusy ? 0.65 : 1,
              cursor: recomputeBusy ? "not-allowed" : "pointer",
            }}
          >
            {recomputeBusy ? "Recomputing…" : "Recompute risk state"}
          </button>
        </div>

        {/* Account control state */}
        <div style={{ ...cardBase, padding: "1.1rem 1.25rem", marginBottom: "1rem" }}>
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
            Account control state
          </h2>
          {!profile ? (
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.875rem", color: "#64748b" }}>
              No profile row — account control cannot be stored for this user id.
            </p>
          ) : (
            <>
              <div style={valueRow}>
                <div style={labelMuted}>Account status</div>
                <span style={accountStatusBadgeStyle(profile.account_status || "active")}>
                  {String(profile.account_status || "active").replace(/_/g, " ")}
                </span>
              </div>
              <div style={valueRow}>
                <div style={labelMuted}>Control flags</div>
                {normalizeAccountFlags(profile.account_flags).length === 0 ? (
                  <span style={{ color: "#94a3b8" }}>—</span>
                ) : (
                  normalizeAccountFlags(profile.account_flags).map((f, i) => (
                    <span key={`acf-${i}-${f}`} style={chipStyle()}>
                      {f}
                    </span>
                  ))
                )}
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={labelMuted}>Last reviewed</div>
                <div style={{ fontSize: "0.875rem", color: "#0f172a" }}>
                  {formatWhen(profile.account_last_reviewed_at)}
                </div>
              </div>
            </>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              disabled={!profile || !user?.id || manualAcctBusy !== null || accountCtrlBusy}
              onClick={() => handleManualAccountStatus("active")}
              style={{
                ...btnSm,
                opacity: !profile || !user?.id || manualAcctBusy !== null || accountCtrlBusy ? 0.65 : 1,
                cursor: !profile || !user?.id || manualAcctBusy !== null || accountCtrlBusy ? "not-allowed" : "pointer",
              }}
            >
              {manualAcctBusy === "active" ? "…" : "Set active"}
            </button>
            <button
              type="button"
              disabled={!profile || !user?.id || manualAcctBusy !== null || accountCtrlBusy}
              onClick={() => handleManualAccountStatus("under_review")}
              style={{
                ...btnSm,
                opacity: !profile || !user?.id || manualAcctBusy !== null || accountCtrlBusy ? 0.65 : 1,
                cursor: !profile || !user?.id || manualAcctBusy !== null || accountCtrlBusy ? "not-allowed" : "pointer",
              }}
            >
              {manualAcctBusy === "under_review" ? "…" : "Set under review"}
            </button>
            <button
              type="button"
              disabled={!profile || !user?.id || manualAcctBusy !== null || accountCtrlBusy}
              onClick={() => handleManualAccountStatus("restricted")}
              style={{
                ...btnSm,
                marginRight: 0,
                opacity: !profile || !user?.id || manualAcctBusy !== null || accountCtrlBusy ? 0.65 : 1,
                cursor: !profile || !user?.id || manualAcctBusy !== null || accountCtrlBusy ? "not-allowed" : "pointer",
              }}
            >
              {manualAcctBusy === "restricted" ? "…" : "Set restricted"}
            </button>
          </div>
          <button
            type="button"
            disabled={!profile || !user?.id || accountCtrlBusy || manualAcctBusy !== null}
            onClick={() => handleRecomputeAccountControl()}
            style={{
              ...btnSm,
              marginTop: "0.5rem",
              marginRight: 0,
              opacity: !profile || !user?.id || accountCtrlBusy || manualAcctBusy !== null ? 0.65 : 1,
              cursor: !profile || !user?.id || accountCtrlBusy || manualAcctBusy !== null ? "not-allowed" : "pointer",
            }}
          >
            {accountCtrlBusy ? "Recomputing…" : "Recompute account state"}
          </button>
        </div>

        {/* Investigation timeline (fraud logs + events) */}
        <div style={{ ...cardBase, padding: "1.1rem 1.25rem", marginBottom: "1rem" }}>
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
            Investigation timeline
          </h2>
          <p style={{ margin: "0 0 0.85rem", fontSize: "0.75rem", color: "#64748b", lineHeight: 1.45 }}>
            Latest {50} items: fraud checks and audit events (newest first).{" "}
            <Link href={`/admin/users/${encodeURIComponent(userId)}/timeline`} style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Full timeline page
            </Link>
          </p>
          {timelineLoading ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>Loading timeline…</p>
          ) : investigationTimeline.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>No timeline entries yet.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {investigationTimeline.map((item) => {
                const meta = item.metadata && typeof item.metadata === "object" ? item.metadata : {};
                const logId = item.type === "fraud_log" ? meta.fraud_log_id : null;
                const evLogId = item.type === "event" ? meta.fraud_log_id : null;
                return (
                  <li
                    key={item.id}
                    style={{
                      display: "flex",
                      gap: "0.65rem",
                      alignItems: "flex-start",
                      padding: "0.55rem 0",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: "10px",
                        height: "10px",
                        borderRadius: "999px",
                        marginTop: "0.35rem",
                        flexShrink: 0,
                        background: timelineDotColor(item.severity),
                        boxShadow: "0 0 0 2px rgba(15, 23, 42, 0.06)",
                      }}
                    />
                    <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.875rem", color: "#0f172a" }}>{item.title}</div>
                      <div style={{ marginTop: "0.2rem", fontSize: "0.78rem", color: "#475569", lineHeight: 1.45 }}>
                        {item.description}
                        {logId ? (
                          <span style={{ display: "inline-block", marginLeft: "0.35rem" }}>
                            <Link
                              href={`/admin/fraud/${encodeURIComponent(String(logId))}`}
                              style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.75rem" }}
                            >
                              Open log
                            </Link>
                          </span>
                        ) : null}
                        {evLogId && item.type === "event" ? (
                          <span style={{ display: "inline-block", marginLeft: "0.35rem" }}>
                            <Link
                              href={`/admin/fraud/${encodeURIComponent(String(evLogId))}`}
                              style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.75rem" }}
                            >
                              Related log
                            </Link>
                          </span>
                        ) : null}
                      </div>
                      <div style={{ marginTop: "0.25rem", fontSize: "0.72rem", color: "#94a3b8" }}>
                        {formatRelativeShort(item.created_at)}
                        <span style={{ margin: "0 0.35rem", color: "#cbd5e1" }}>·</span>
                        {formatWhen(item.created_at)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Recent smart alerts */}
        <div style={{ ...cardBase, padding: "1.1rem 1.25rem", marginBottom: "1rem" }}>
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
            Recent alerts
          </h2>
          {userAlerts.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>No smart alerts for this user.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {userAlerts.map((a) => {
                const busy = alertBusyId === a.id;
                return (
                  <li
                    key={a.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      padding: "0.55rem 0",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <div style={{ color: "#64748b", fontSize: "0.72rem" }}>{formatWhen(a.created_at)}</div>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>{a.title}</div>
                    <div style={{ marginTop: "0.25rem", color: "#64748b" }}>
                      <span style={{ fontWeight: 600, marginRight: "0.5rem" }}>{a.severity}</span>
                      <span style={{ fontWeight: 600 }}>{a.status}</span>
                      {a.fraud_log_id ? (
                        <span style={{ marginLeft: "0.5rem" }}>
                          <Link
                            href={`/admin/fraud/${encodeURIComponent(a.fraud_log_id)}`}
                            style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.75rem" }}
                          >
                            Fraud log
                          </Link>
                        </span>
                      ) : null}
                    </div>
                    <div style={{ marginTop: "0.35rem" }}>
                      <button
                        type="button"
                        disabled={busy || a.status !== "open"}
                        onClick={() => handleUserAlertStatus(a, "acknowledged")}
                        style={{
                          ...btnSm,
                          opacity: busy || a.status !== "open" ? 0.55 : 1,
                          cursor: busy || a.status !== "open" ? "not-allowed" : "pointer",
                        }}
                      >
                        Acknowledge
                      </button>
                      <button
                        type="button"
                        disabled={busy || a.status === "resolved"}
                        onClick={() => handleUserAlertStatus(a, "resolved")}
                        style={{
                          ...btnSm,
                          marginRight: 0,
                          opacity: busy || a.status === "resolved" ? 0.55 : 1,
                          cursor: busy || a.status === "resolved" ? "not-allowed" : "pointer",
                        }}
                      >
                        Resolve
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Section C — Latest fraud logs */}
        <div style={{ ...cardBase, padding: 0, overflow: "hidden", marginBottom: "1rem" }}>
          <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
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
              Latest fraud logs (up to 20)
            </h2>
          </div>
          {latestTableLogs.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, fontSize: "0.875rem", color: "#64748b" }}>
              No fraud logs for this user.
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
                      "Created",
                      "Type",
                      "Amount",
                      "Score",
                      "Level",
                      "Status",
                      "Flags",
                      "Detail",
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
                  {latestTableLogs.map((r) => {
                    const flags = normalizeFlags(r.flags);
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                        <td style={{ padding: "0.65rem 0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                          {formatWhen(r.created_at)}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", textTransform: "lowercase", color: "#0f172a" }}>
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
                        <td style={{ padding: "0.65rem 0.75rem", fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
                          {r.risk_score ?? "—"}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={riskBadgeStyle(r.risk_level)}>{r.risk_level || "—"}</span>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={statusBadgeStyle(r.status)}>{normalizeStatus(r.status)}</span>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", maxWidth: "200px" }}>
                          {flags.length === 0 ? (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          ) : (
                            flags.map((f, i) => (
                              <span key={`${r.id}-f-${i}`} style={chipStyle()}>
                                {f}
                              </span>
                            ))
                          )}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <Link
                            href={`/admin/fraud/${r.id}`}
                            style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.8rem" }}
                          >
                            Open
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

        {/* Section D — Quick assessment */}
        <div style={{ ...cardBase, padding: "1.1rem 1.25rem" }}>
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
            Quick assessment
          </h2>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#0f172a", lineHeight: 1.5 }}>{assessment}</p>
        </div>
      </div>
    </>
  );
}
