import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import {
  calculateTreasuryHealth,
  fetchTreasuryAlerts,
  fetchTreasuryHealthHistory,
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
      const [healthResult, alertResult, historyResult] = await Promise.all([
        calculateTreasuryHealth(supabase),
        fetchTreasuryAlerts(supabase),
        fetchTreasuryHealthHistory({ limit: 30 }, supabase),
      ]);

      setHealth(healthResult);
      setAlerts(alertResult.alerts || []);

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
        const refreshed = await fetchTreasuryHealthHistory({ limit: 30 }, supabase);
        if (!refreshed.tableMissing) {
          setHistory(refreshed.rows || []);
        }
      } else if (saveRes.error && saveRes.error !== "table_missing") {
        setSaveNote(`Snapshot not saved: ${saveRes.error}`);
      }
    } catch (e) {
      console.error("[admin/treasury-intelligence]", e);
      setLoadError(e?.message || "Failed to load treasury intelligence.");
      setHealth(null);
      setAlerts([]);
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
          {!health && history.length === 0 ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading history…</p>
            </div>
          ) : history.length === 0 ? (
            <div style={{ ...cardBase, padding: "1.25rem", textAlign: "center" }}>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>No snapshots yet.</p>
            </div>
          ) : (
            <div style={{ ...cardBase, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Time", "Score", "Risk", "Liabilities", "Exposure", "Reasons"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === "Time" || h === "Risk" ? "left" : "right",
                          padding: "0.55rem 0.65rem",
                          fontSize: "0.66rem",
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
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
                  {history.map((row) => (
                    <tr key={row.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.55rem 0.65rem", color: "#475569", whiteSpace: "nowrap" }}>
                        {formatWhen(row.createdAt)}
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
                          color: "#64748b",
                        }}
                      >
                        {(row.reasons || []).length}
                      </td>
                    </tr>
                  ))}
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
