import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import {
  calculateTreasuryHealth,
  calculateTreasuryForecast,
  calculateTreasuryResilience,
  calculateTreasuryScenarios,
  calculateTreasuryTrends,
  fetchTreasuryAlerts,
  fetchTreasuryHealthHistory,
  formatTreasuryWarningTitle,
  saveTreasuryHealthSnapshot,
} from "../../lib/treasuryIntelligence";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1100px",
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

const sectionHeading = {
  margin: "0 0 0.65rem",
  fontSize: "0.8rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#94a3b8",
};

function formatMoney(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function riskLevelBadge(level) {
  const key = String(level || "").toLowerCase();
  const styles = {
    critical: { bg: "#450a0a", fg: "#fecaca", border: "#7f1d1d" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    medium: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    low: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
  };
  const pal = styles[key] || styles.low;
  return {
    display: "inline-block",
    padding: "0.18rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
}

function severityBadge(severity) {
  const key = String(severity || "").toLowerCase();
  const styles = {
    critical: { bg: "#450a0a", fg: "#fecaca", border: "#7f1d1d" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    medium: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    low: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.low;
  return {
    display: "inline-block",
    padding: "0.12rem 0.45rem",
    borderRadius: "999px",
    fontSize: "0.62rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
    whiteSpace: "nowrap",
  };
}

function scoreColor(score) {
  const n = Number(score) || 0;
  if (n >= 80) return "#047857";
  if (n >= 60) return "#92400e";
  if (n >= 40) return "#b91c1c";
  return "#7f1d1d";
}

function trendStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    stable: "Stable",
    improving: "Improving",
    deteriorating: "Deteriorating",
    insufficient_data: "Insufficient data",
  };
  return labels[key] || "Unknown";
}

function trendStatusColor(status) {
  const key = String(status || "").toLowerCase();
  if (key === "improving") return "#047857";
  if (key === "deteriorating") return "#b91c1c";
  if (key === "stable") return "#0f172a";
  return "#64748b";
}

function forecastOutlookLabel(outlook) {
  const key = String(outlook || "").toLowerCase();
  const labels = {
    stable: "Stable",
    improving: "Improving",
    elevated_pressure: "Elevated pressure",
    deteriorating: "Deteriorating",
  };
  return labels[key] || "Unknown";
}

function forecastOutlookColor(outlook) {
  const key = String(outlook || "").toLowerCase();
  if (key === "improving") return "#047857";
  if (key === "deteriorating") return "#b91c1c";
  if (key === "elevated_pressure") return "#92400e";
  if (key === "stable") return "#0f172a";
  return "#64748b";
}

function projectedRiskLabel(risk) {
  const key = String(risk || "").toLowerCase();
  const labels = {
    low: "Low",
    medium: "Medium",
    elevated: "Elevated",
    high: "High",
  };
  return labels[key] || "Unknown";
}

function projectedRiskColor(risk) {
  const key = String(risk || "").toLowerCase();
  if (key === "low") return "#047857";
  if (key === "medium") return "#92400e";
  if (key === "elevated") return "#b45309";
  if (key === "high") return "#b91c1c";
  return "#64748b";
}

function treasuryPressureLabel(pressure) {
  const key = String(pressure || "").toLowerCase();
  const labels = {
    low: "Low",
    moderate: "Moderate",
    elevated: "Elevated",
    severe: "Severe",
  };
  return labels[key] || "Unknown";
}

function treasuryPressureColor(pressure) {
  const key = String(pressure || "").toLowerCase();
  if (key === "low") return "#047857";
  if (key === "moderate") return "#92400e";
  if (key === "elevated") return "#b91c1c";
  if (key === "severe") return "#991b1b";
  return "#64748b";
}

function scenarioSeverityLabel(severity) {
  const key = String(severity || "").toLowerCase();
  const labels = { low: "Low", medium: "Medium", high: "High" };
  return labels[key] || "Unknown";
}

function projectedDirectionLabel(direction) {
  const key = String(direction || "").toLowerCase();
  const labels = { stable: "Stable", rising: "Rising", declining: "Declining" };
  return labels[key] || "Unknown";
}

function resilienceLevelLabel(level) {
  const key = String(level || "").toLowerCase();
  const labels = {
    resilient: "Resilient",
    strong: "Strong",
    moderate: "Moderate",
    weak: "Weak",
  };
  return labels[key] || "Unknown";
}

function resilienceLevelColor(level) {
  const key = String(level || "").toLowerCase();
  if (key === "resilient") return "#047857";
  if (key === "strong") return "#0f766e";
  if (key === "moderate") return "#92400e";
  if (key === "weak") return "#b45309";
  return "#64748b";
}

function recoveryDifficultyLabel(difficulty) {
  const key = String(difficulty || "").toLowerCase();
  const labels = {
    easy: "Easy",
    manageable: "Manageable",
    difficult: "Difficult",
    severe: "Severe",
  };
  return labels[key] || "Unknown";
}

function recoveryDifficultyColor(difficulty) {
  const key = String(difficulty || "").toLowerCase();
  if (key === "easy") return "#047857";
  if (key === "manageable") return "#0f766e";
  if (key === "difficult") return "#92400e";
  if (key === "severe") return "#b45309";
  return "#64748b";
}

function treasuryToleranceLabel(tolerance) {
  const key = String(tolerance || "").toLowerCase();
  const labels = { low: "Low", moderate: "Moderate", high: "High" };
  return labels[key] || "Unknown";
}

function treasuryToleranceColor(tolerance) {
  const key = String(tolerance || "").toLowerCase();
  if (key === "high") return "#047857";
  if (key === "moderate") return "#92400e";
  if (key === "low") return "#b45309";
  return "#64748b";
}

function runwayEstimateLabel(runway) {
  const key = String(runway || "").toLowerCase();
  const labels = {
    stable: "Stable",
    short_term_pressure: "Short-term pressure",
    medium_term_pressure: "Medium-term pressure",
    long_term_pressure: "Long-term pressure",
  };
  return labels[key] || "Unknown";
}

function runwayEstimateColor(runway) {
  const key = String(runway || "").toLowerCase();
  if (key === "stable") return "#047857";
  if (key === "short_term_pressure") return "#92400e";
  if (key === "medium_term_pressure") return "#b45309";
  if (key === "long_term_pressure") return "#b91c1c";
  return "#64748b";
}

function formatDelta(value, { prefix = "", suffix = "", invertColor = false } = {}) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const sign = safe > 0 ? "+" : "";
  const color =
    safe === 0
      ? "#64748b"
      : invertColor
        ? safe > 0
          ? "#b91c1c"
          : "#047857"
        : safe > 0
          ? "#047857"
          : "#b91c1c";
  return { text: `${sign}${prefix}${safe.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`, color };
}

function KpiCard({ label, value, subtitle, valueColor }) {
  return (
    <div style={{ ...cardBase, padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <p
        style={{
          margin: 0,
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#94a3b8",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "1.35rem",
          fontWeight: 800,
          color: valueColor || "#0f172a",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
      {subtitle ? (
        <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b", lineHeight: 1.4 }}>{subtitle}</p>
      ) : null}
    </div>
  );
}

function SkeletonKpi() {
  return (
    <div style={{ ...cardBase, padding: "1rem 1.1rem" }}>
      <div
        style={{
          height: "0.6rem",
          width: "40%",
          borderRadius: "6px",
          background: "#e2e8f0",
          marginBottom: "0.55rem",
        }}
      />
      <div style={{ height: "1.6rem", width: "55%", borderRadius: "6px", background: "#e2e8f0" }} />
    </div>
  );
}

export default function AdminTreasuryIntelligencePage() {
  const { user, profile, loading: authLoading } = useUser();
  const [health, setHealth] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [trends, setTrends] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [scenarios, setScenarios] = useState(null);
  const [resilience, setResilience] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveNote, setSaveNote] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setLoadError(null);
    setSaveNote(null);
    try {
      const [healthResult, alertResult, historyResult, trendsResult] = await Promise.all([
        calculateTreasuryHealth(supabase),
        fetchTreasuryAlerts(supabase),
        fetchTreasuryHealthHistory({ limit: 30 }, supabase),
        calculateTreasuryTrends({ days: 7 }, supabase),
      ]);
      const forecastResult = await calculateTreasuryForecast({ days: 7, trends: trendsResult }, supabase);
      const scenariosResult = await calculateTreasuryScenarios(
        { days: 7, trends: trendsResult, forecast: forecastResult, health: healthResult },
        supabase,
      );
      const resilienceResult = await calculateTreasuryResilience(
        {
          days: 30,
          trends: trendsResult,
          forecast: forecastResult,
          scenarios: scenariosResult,
          health: healthResult,
        },
        supabase,
      );

      setHealth(healthResult);
      setAlerts(alertResult.alerts || []);
      setTrends(trendsResult);
      setForecast(forecastResult);
      setScenarios(scenariosResult);
      setResilience(resilienceResult);

      if (historyResult.tableMissing) {
        setTableMissing(true);
        setHistory([]);
      } else {
        setTableMissing(false);
        setHistory(historyResult.rows || []);
        if (historyResult.error) {
          setLoadError(historyResult.error);
        }
      }

      const saveRes = await saveTreasuryHealthSnapshot(healthResult, supabase);
      if (saveRes.tableMissing) {
        setTableMissing(true);
        setSaveNote("Snapshot table not migrated — run supabase/sql/treasury_health_snapshots.sql");
      } else if (saveRes.ok) {
        setSaveNote("Snapshot saved.");
        const [refreshed, refreshedTrends] = await Promise.all([
          fetchTreasuryHealthHistory({ limit: 30 }, supabase),
          calculateTreasuryTrends({ days: 7 }, supabase),
        ]);
        if (!refreshed.tableMissing) {
          setHistory(refreshed.rows || []);
        }
        setTrends(refreshedTrends);
        const refreshedForecast = await calculateTreasuryForecast({ days: 7, trends: refreshedTrends }, supabase);
        setForecast(refreshedForecast);
        const refreshedScenarios = await calculateTreasuryScenarios(
          { days: 7, trends: refreshedTrends, forecast: refreshedForecast, health: healthResult },
          supabase,
        );
        setScenarios(refreshedScenarios);
        setResilience(
          await calculateTreasuryResilience(
            {
              days: 30,
              trends: refreshedTrends,
              forecast: refreshedForecast,
              scenarios: refreshedScenarios,
              health: healthResult,
            },
            supabase,
          ),
        );
      } else if (saveRes.error && saveRes.error !== "table_missing") {
        setSaveNote(`Snapshot not saved: ${saveRes.error}`);
      }
    } catch (e) {
      console.error("[admin/treasury-intelligence]", e);
      setLoadError(e?.message || "Failed to load treasury intelligence.");
      setHealth(null);
      setAlerts([]);
      setTrends(null);
      setForecast(null);
      setScenarios(null);
      setResilience(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void load();
  }, [authLoading, user, profile, load]);

  const metrics = health?.sourceSnapshot?.metrics || {};
  const topReasons = useMemo(() => (health?.reasons || []).slice(0, 5), [health]);

  const kpiCards = useMemo(() => {
    if (!health) return null;
    return [
      {
        key: "healthScore",
        label: "Health score",
        value: String(health.healthScore),
        subtitle: "0–100 composite",
        valueColor: scoreColor(health.healthScore),
      },
      {
        key: "riskLevel",
        label: "Treasury risk level",
        value: String(health.treasuryRiskLevel || "—").toUpperCase(),
        subtitle: "Derived from health score",
        valueColor: scoreColor(health.healthScore),
      },
      {
        key: "confidence",
        label: "Confidence",
        value: `${health.confidenceScore}%`,
        subtitle: "Data availability signal",
        valueColor: health.confidenceScore >= 70 ? "#047857" : health.confidenceScore >= 40 ? "#92400e" : "#b91c1c",
      },
      {
        key: "liabilities",
        label: "Wallet liabilities",
        value: formatMoney(metrics.totalWalletLiabilities),
        subtitle: "Sum of wallet balances",
      },
      {
        key: "exposure",
        label: "Pending withdrawal exposure",
        value: formatMoney(metrics.pendingWithdrawalExposure),
        subtitle: "Pending + processing payouts",
      },
      {
        key: "reconciliation",
        label: "Reconciliation score",
        value: String(health.reconciliationScore),
        subtitle: `${metrics.reconciliationMismatchCount || 0} mismatch signals`,
        valueColor: scoreColor(health.reconciliationScore),
      },
    ];
  }, [health, metrics]);

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

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.65rem",
            marginBottom: "1rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontSize: "clamp(1.25rem, 4vw, 1.55rem)",
                fontWeight: 700,
                color: "#0f172a",
                margin: "0 0 0.4rem",
                letterSpacing: "-0.02em",
              }}
            >
              Treasury Intelligence
            </h1>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5, maxWidth: "44rem" }}>
              Read-only monitoring of operational treasury health — liabilities, payout pressure, reconciliation signals,
              and activity anomalies. No wallet or payout mutations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            style={{
              ...btnSm,
              marginTop: 0,
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Refreshing…" : "Refresh & save snapshot"}
          </button>
        </div>

        {tableMissing ? (
          <div
            style={{
              ...cardBase,
              padding: "0.85rem 1rem",
              marginBottom: "1rem",
              background: "#fffbeb",
              borderColor: "#fcd34d",
            }}
          >
            <p style={{ margin: 0, color: "#92400e", fontSize: "0.85rem" }}>
              Run migration <code style={{ fontSize: "0.78rem" }}>supabase/sql/treasury_health_snapshots.sql</code> to
              enable snapshot history persistence.
            </p>
          </div>
        ) : null}

        {loadError ? (
          <div
            style={{
              ...cardBase,
              padding: "0.85rem 1rem",
              marginBottom: "1rem",
              background: "#fef2f2",
              borderColor: "#fecaca",
            }}
          >
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.85rem" }}>{loadError}</p>
          </div>
        ) : null}

        {saveNote ? (
          <p style={{ margin: "0 0 1rem", fontSize: "0.78rem", color: "#64748b" }}>{saveNote}</p>
        ) : null}

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Key indicators</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))",
              gap: "0.85rem",
            }}
          >
            {kpiCards
              ? kpiCards.map((c) => (
                  <KpiCard key={c.key} label={c.label} value={c.value} subtitle={c.subtitle} valueColor={c.valueColor} />
                ))
              : Array.from({ length: 6 }).map((_, i) => <SkeletonKpi key={i} />)}
          </div>
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury trends</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Early warning signals from snapshot history over the last 7 days. Monitor closely — not an automatic action.
          </p>
          {!trends ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading trends…</p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "0.85rem",
                }}
              >
                <KpiCard
                  label="Trend status"
                  value={trendStatusLabel(trends.trendStatus)}
                  subtitle={`${trends.historyCount} snapshot${trends.historyCount === 1 ? "" : "s"} in window`}
                  valueColor={trendStatusColor(trends.trendStatus)}
                />
                <KpiCard
                  label="Health score change"
                  value={formatDelta(trends.healthScoreChange, { suffix: " pts", invertColor: true }).text}
                  subtitle="Newest vs oldest in window"
                  valueColor={formatDelta(trends.healthScoreChange, { invertColor: true }).color}
                />
                <KpiCard
                  label="Liability change"
                  value={formatDelta(trends.liabilityChange, { prefix: "$", invertColor: true }).text}
                  subtitle="Wallet liabilities delta"
                  valueColor={formatDelta(trends.liabilityChange, { invertColor: true }).color}
                />
                <KpiCard
                  label="Exposure change"
                  value={formatDelta(trends.exposureChange, { prefix: "$", invertColor: true }).text}
                  subtitle="Pending withdrawal delta"
                  valueColor={formatDelta(trends.exposureChange, { invertColor: true }).color}
                />
                <KpiCard
                  label="Confidence"
                  value={`${trends.confidence}%`}
                  subtitle="Trend data quality"
                  valueColor={trends.confidence >= 70 ? "#047857" : trends.confidence >= 40 ? "#92400e" : "#64748b"}
                />
                <KpiCard
                  label="History count"
                  value={String(trends.historyCount)}
                  subtitle={
                    trends.riskLevelChange !== "unchanged"
                      ? `Risk: ${String(trends.riskLevelChange).replace(/_/g, " → ")}`
                      : "Risk level unchanged"
                  }
                />
              </div>

              {trends.warningSignals.length === 0 ? (
                <div style={{ ...cardBase, padding: "1rem 1.1rem" }}>
                  <p style={{ margin: 0, color: "#047857", fontWeight: 600, fontSize: "0.88rem" }}>
                    No early warning signals in the trend window
                  </p>
                  <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.82rem" }}>
                    Snapshot trends appear stable. Continue routine monitoring.
                  </p>
                </div>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.65rem" }}>
                  {trends.warningSignals.map((signal, idx) => (
                    <li key={`${signal.code}-${idx}`} style={{ ...cardBase, padding: "0.85rem 1rem" }}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.35rem",
                        }}
                      >
                        <span style={severityBadge(signal.severity)}>{signal.severity}</span>
                        <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>
                          {formatTreasuryWarningTitle(signal)}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {signal.message}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury forecast</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Conservative 7-day operational outlook from snapshot trends — not a financial prediction. Advisory only;
            no automated treasury actions.
          </p>
          {!forecast ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading forecast…</p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "0.85rem",
                }}
              >
                <KpiCard
                  label="7-day outlook"
                  value={forecastOutlookLabel(forecast.outlook)}
                  subtitle={`Liabilities ${projectedDirectionLabel(forecast.projectedLiabilities).toLowerCase()} · Exposure ${projectedDirectionLabel(forecast.projectedExposure).toLowerCase()}`}
                  valueColor={forecastOutlookColor(forecast.outlook)}
                />
                <KpiCard
                  label="Projected treasury risk"
                  value={projectedRiskLabel(forecast.projectedRisk)}
                  subtitle="Operational pressure band"
                  valueColor={projectedRiskColor(forecast.projectedRisk)}
                />
                <KpiCard
                  label="Treasury pressure"
                  value={treasuryPressureLabel(forecast.treasuryPressure)}
                  subtitle="Withdrawal & obligation stress"
                  valueColor={treasuryPressureColor(forecast.treasuryPressure)}
                />
                <KpiCard
                  label="Forecast confidence"
                  value={
                    forecast.confidence >= 80
                      ? `High (${forecast.confidence}%)`
                      : forecast.confidence >= 50
                        ? `Moderate (${forecast.confidence}%)`
                        : `${forecast.confidence}%`
                  }
                  subtitle="Based on snapshot depth & trend agreement"
                  valueColor={
                    forecast.confidence >= 80
                      ? "#047857"
                      : forecast.confidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
              </div>

              <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: forecast.warnings?.length ? "0.75rem" : 0 }}>
                <p style={{ margin: "0 0 0.35rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8" }}>
                  Forecast summary
                </p>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#0f172a", lineHeight: 1.5, fontWeight: 500 }}>
                  {forecast.summary}
                </p>
              </div>

              {forecast.warnings?.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
                  {forecast.warnings.map((w, idx) => (
                    <li key={`${w.code}-${idx}`} style={{ ...cardBase, padding: "0.75rem 1rem", background: "#f8fafc" }}>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {w.message}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury scenarios</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            What-if analysis from current baseline, trends, and forecast — advisory only. No wallet, payout, or
            funding mutations.
          </p>
          {!scenarios ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading scenarios…</p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "0.85rem",
                }}
              >
                <KpiCard
                  label="Scenario confidence"
                  value={
                    scenarios.scenarioConfidence >= 80
                      ? `High (${scenarios.scenarioConfidence}%)`
                      : scenarios.scenarioConfidence >= 50
                        ? `Moderate (${scenarios.scenarioConfidence}%)`
                        : `${scenarios.scenarioConfidence}%`
                  }
                  subtitle="Data depth & trend agreement"
                  valueColor={
                    scenarios.scenarioConfidence >= 80
                      ? "#047857"
                      : scenarios.scenarioConfidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
                <KpiCard
                  label="Baseline health"
                  value={String(scenarios.baseline?.healthScore ?? "—")}
                  subtitle={`Risk: ${String(scenarios.baseline?.treasuryRiskLevel || "—").toUpperCase()}`}
                  valueColor={scoreColor(scenarios.baseline?.healthScore)}
                />
                <KpiCard
                  label="Baseline liabilities"
                  value={formatMoney(scenarios.baseline?.walletLiabilities)}
                  subtitle={`Exposure ${formatMoney(scenarios.baseline?.pendingWithdrawalExposure)}`}
                />
                <KpiCard
                  label="Liquidity / reconciliation"
                  value={`${scenarios.baseline?.liquidityScore ?? "—"} / ${scenarios.baseline?.reconciliationScore ?? "—"}`}
                  subtitle="Component scores at baseline"
                  valueColor={scoreColor(Math.min(scenarios.baseline?.liquidityScore ?? 100, scenarios.baseline?.reconciliationScore ?? 100))}
                />
              </div>

              <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "0.85rem" }}>
                <p style={{ margin: "0 0 0.35rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8" }}>
                  Scenario summary
                </p>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#0f172a", lineHeight: 1.5, fontWeight: 500 }}>
                  {scenarios.summary}
                </p>
              </div>

              <div style={{ ...cardBase, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                <table style={{ width: "100%", minWidth: "720px", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {[
                        { key: "label", label: "Scenario", align: "left" },
                        { key: "score", label: "Proj. health", align: "right" },
                        { key: "risk", label: "Proj. risk", align: "left" },
                        { key: "pressure", label: "Pressure", align: "left" },
                        { key: "severity", label: "Severity", align: "left" },
                        { key: "summary", label: "Summary", align: "left" },
                      ].map((h) => (
                        <th
                          key={h.key}
                          style={{
                            textAlign: h.align,
                            padding: "0.55rem 0.65rem",
                            fontSize: "0.66rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: "#94a3b8",
                            whiteSpace: h.key === "summary" ? "normal" : "nowrap",
                          }}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(scenarios.scenarios || []).map((s) => (
                      <tr key={s.key} style={{ borderTop: "1px solid #f1f5f9", verticalAlign: "top" }}>
                        <td style={{ padding: "0.65rem", minWidth: "140px" }}>
                          <span style={{ display: "block", fontWeight: 700, color: "#0f172a" }}>{s.label}</span>
                          {s.assumptions?.length > 0 ? (
                            <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1rem", color: "#64748b", fontSize: "0.72rem", lineHeight: 1.4 }}>
                              {s.assumptions.map((a, i) => (
                                <li key={i}>{a}</li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                        <td
                          style={{
                            padding: "0.65rem",
                            textAlign: "right",
                            fontWeight: 700,
                            color: scoreColor(s.projectedHealthScore),
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.projectedHealthScore}
                        </td>
                        <td style={{ padding: "0.65rem", whiteSpace: "nowrap" }}>
                          <span style={riskLevelBadge(s.projectedRiskLevel)}>{s.projectedRiskLevel}</span>
                        </td>
                        <td style={{ padding: "0.65rem", whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 600, color: treasuryPressureColor(s.projectedPressure) }}>
                            {treasuryPressureLabel(s.projectedPressure)}
                          </span>
                        </td>
                        <td style={{ padding: "0.65rem", whiteSpace: "nowrap" }}>
                          <span style={severityBadge(s.severity)}>{scenarioSeverityLabel(s.severity)}</span>
                        </td>
                        <td style={{ padding: "0.65rem", color: "#475569", lineHeight: 1.45, minWidth: "200px" }}>
                          <p style={{ margin: 0 }}>{s.summary}</p>
                          {s.warnings?.length > 0 ? (
                            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1rem", fontSize: "0.72rem", color: "#64748b" }}>
                              {s.warnings.map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury resilience</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Stress and resilience assessment from health, trends, forecast, and scenarios — advisory only. No wallet,
            payout, or funding mutations.
          </p>
          {!resilience ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading resilience…</p>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "0.85rem",
                }}
              >
                <KpiCard
                  label="Resilience score"
                  value={String(resilience.resilienceScore)}
                  subtitle="0–100 composite under sustained pressure"
                  valueColor={scoreColor(resilience.resilienceScore)}
                />
                <KpiCard
                  label="Resilience level"
                  value={resilienceLevelLabel(resilience.resilienceLevel)}
                  subtitle="Weak · moderate · strong · resilient"
                  valueColor={resilienceLevelColor(resilience.resilienceLevel)}
                />
                <KpiCard
                  label="Survivability"
                  value={String(resilience.survivabilityScore)}
                  subtitle={`Recovery: ${recoveryDifficultyLabel(resilience.recoveryDifficulty).toLowerCase()}`}
                  valueColor={scoreColor(resilience.survivabilityScore)}
                />
                <KpiCard
                  label="Treasury tolerance"
                  value={treasuryToleranceLabel(resilience.treasuryTolerance)}
                  subtitle="Capacity for sustained pressure"
                  valueColor={treasuryToleranceColor(resilience.treasuryTolerance)}
                />
                <KpiCard
                  label="Resilience confidence"
                  value={
                    resilience.confidence >= 80
                      ? `High (${resilience.confidence}%)`
                      : resilience.confidence >= 50
                        ? `Moderate (${resilience.confidence}%)`
                        : `${resilience.confidence}%`
                  }
                  subtitle="Data depth & signal agreement"
                  valueColor={
                    resilience.confidence >= 80
                      ? "#047857"
                      : resilience.confidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
                <KpiCard
                  label="Runway estimate"
                  value={runwayEstimateLabel(resilience.runwayEstimate)}
                  subtitle={`Liquidity buffer ${resilience.liquidityBufferScore}`}
                  valueColor={runwayEstimateColor(resilience.runwayEstimate)}
                />
              </div>

              <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: resilience.warnings?.length ? "0.75rem" : 0 }}>
                <p style={{ margin: "0 0 0.35rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8" }}>
                  Resilience summary
                </p>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#0f172a", lineHeight: 1.5, fontWeight: 500 }}>
                  {resilience.summary}
                </p>
              </div>

              {resilience.warnings?.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
                  {resilience.warnings.map((w, idx) => (
                    <li key={`${w.code}-${idx}`} style={{ ...cardBase, padding: "0.75rem 1rem", background: "#f8fafc" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.45rem", marginBottom: w.severity ? "0.3rem" : 0 }}>
                        {w.severity ? <span style={severityBadge(w.severity)}>{w.severity}</span> : null}
                      </div>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {w.message}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury alerts</h2>
          {!health ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading alerts…</p>
            </div>
          ) : alerts.length === 0 ? (
            <div style={{ ...cardBase, padding: "1.25rem", textAlign: "center" }}>
              <p style={{ margin: 0, color: "#047857", fontWeight: 600, fontSize: "0.9rem" }}>
                No active treasury alerts
              </p>
              <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.82rem" }}>
                Health signals are within normal thresholds.
              </p>
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.65rem" }}>
              {alerts.map((a) => (
                <li key={a.code} style={{ ...cardBase, padding: "0.85rem 1rem" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                    <span style={severityBadge(a.severity)}>{a.severity}</span>
                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>{a.title}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>{a.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Snapshot history</h2>
          <p style={{ margin: "0 0 0.65rem", fontSize: "0.78rem", color: "#64748b" }}>
            Newest first — read-only observability records.
          </p>
          {!health && history.length === 0 ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading history…</p>
            </div>
          ) : history.length === 0 ? (
            <div style={{ ...cardBase, padding: "1.25rem", textAlign: "center" }}>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>No snapshots yet.</p>
            </div>
          ) : (
            <div style={{ ...cardBase, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
              <table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[
                      { key: "created", label: "Created", align: "left" },
                      { key: "score", label: "Score", align: "right" },
                      { key: "risk", label: "Risk", align: "left" },
                      { key: "liab", label: "Liabilities", align: "right" },
                      { key: "exp", label: "Exposure", align: "right" },
                      { key: "reasons", label: "Reasons", align: "right" },
                    ].map((h) => (
                      <th
                        key={h.key}
                        style={{
                          textAlign: h.align,
                          padding: "0.55rem 0.65rem",
                          fontSize: "0.66rem",
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "#94a3b8",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => {
                    const reasonCount = (row.reasons || []).length;
                    return (
                      <tr key={row.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.55rem 0.65rem", color: "#475569", whiteSpace: "nowrap" }}>
                          <span style={{ display: "block", fontWeight: 600, color: "#0f172a" }}>
                            {formatWhen(row.createdAt)}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "0.55rem 0.65rem",
                            textAlign: "right",
                            fontWeight: 700,
                            color: scoreColor(row.healthScore),
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {row.healthScore}
                        </td>
                        <td style={{ padding: "0.55rem 0.65rem" }}>
                          <span style={riskLevelBadge(row.treasuryRiskLevel)}>{row.treasuryRiskLevel}</span>
                        </td>
                        <td
                          style={{
                            padding: "0.55rem 0.65rem",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: "#0f172a",
                          }}
                        >
                          {formatMoney(row.totalWalletLiabilities)}
                        </td>
                        <td
                          style={{
                            padding: "0.55rem 0.65rem",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: "#0f172a",
                          }}
                        >
                          {formatMoney(row.pendingWithdrawalExposure)}
                        </td>
                        <td
                          style={{
                            padding: "0.55rem 0.65rem",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: reasonCount > 0 ? "#92400e" : "#64748b",
                            fontWeight: reasonCount > 0 ? 700 : 400,
                          }}
                          title={reasonCount > 0 ? `${reasonCount} penalty reason(s)` : "No penalty reasons"}
                        >
                          {reasonCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1rem" }}>
          <h2 style={sectionHeading}>Score explanation</h2>
          <div style={{ ...cardBase, padding: "1rem 1.1rem" }}>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5 }}>
              Health starts at 100 and subtracts for payout pressure, reconciliation issues, funding failures, negative
              balances, and volume anomalies. Risk level: 80–100 low, 60–79 medium, 40–59 high, 0–39 critical.
            </p>
            {topReasons.length === 0 ? (
              <p style={{ margin: 0, color: "#047857", fontWeight: 600, fontSize: "0.88rem" }}>
                No penalty reasons — treasury signals look healthy.
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
                {topReasons.map((r) => (
                  <li
                    key={r.code}
                    style={{
                      border: "1px solid #f1f5f9",
                      borderRadius: "10px",
                      padding: "0.65rem 0.75rem",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.35rem" }}>
                      <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.88rem" }}>{r.label}</span>
                      <span style={{ fontWeight: 700, color: "#b91c1c", fontVariantNumeric: "tabular-nums" }}>
                        {r.impact}
                      </span>
                    </div>
                    {r.details && Object.keys(r.details).length > 0 ? (
                      <p style={{ margin: "0.3rem 0 0", fontSize: "0.75rem", color: "#64748b", wordBreak: "break-word" }}>
                        {JSON.stringify(r.details)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p style={{ margin: "0.85rem 0 0", fontSize: "0.82rem" }}>
              <Link href="/admin/treasury" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                Open Treasury &amp; Reconciliation →
              </Link>
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
