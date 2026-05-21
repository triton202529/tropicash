import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import {
  calculateUserRiskScore,
  fetchAdminRiskScores,
  fetchUserRiskScore,
  formatTopReasons,
  mapRiskScoreRow,
  saveUserRiskScore,
} from "../../lib/riskEngine";
import { createRiskReviewCaseFromScore } from "../../lib/riskReviewCases";

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

const btnPrimary = {
  padding: "0.55rem 1rem",
  borderRadius: "10px",
  border: "1px solid #0284c7",
  background: "linear-gradient(180deg, #0ea5e9 0%, #0284c7 100%)",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "0.88rem",
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(14, 165, 233, 0.35)",
};

const btnSecondary = {
  padding: "0.55rem 1rem",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  color: "#0f172a",
  fontWeight: 600,
  fontSize: "0.88rem",
  cursor: "pointer",
};

const adminFocusCss = `
  .tc-risk-in:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .tc-risk-in::placeholder { color: #94a3b8; }
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

function actionBadge(action) {
  const key = String(action || "").toLowerCase();
  const styles = {
    freeze_candidate: { bg: "#450a0a", fg: "#fecaca", border: "#7f1d1d" },
    restrict: { bg: "#fff1f2", fg: "#9f1239", border: "#fecdd3" },
    review: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    monitor: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    allow: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.allow;
  return {
    display: "inline-block",
    padding: "0.18rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
    whiteSpace: "nowrap",
  };
}

function trustColor(score) {
  const n = Number(score) || 0;
  if (n >= 20) return "#166534";
  if (n <= -10) return "#991b1b";
  return "#475569";
}

function confidenceColor(score) {
  const n = Number(score) || 0;
  if (n >= 70) return "#166534";
  if (n < 40) return "#92400e";
  return "#475569";
}

export default function AdminRiskPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tableError, setTableError] = useState(null);
  const [tableMissing, setTableMissing] = useState(false);

  const [userIdInput, setUserIdInput] = useState("");
  const [riskLevelFilter, setRiskLevelFilter] = useState("");
  const [minScoreFilter, setMinScoreFilter] = useState("0");
  const [minConfidenceFilter, setMinConfidenceFilter] = useState("0");
  const [actionFilter, setActionFilter] = useState("");
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [calcBusy, setCalcBusy] = useState(false);
  const [caseBusyUserId, setCaseBusyUserId] = useState(null);
  const [banner, setBanner] = useState({ type: null, message: "" });

  const loadTable = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setTableError(null);
    try {
      const minScore = Number(minScoreFilter);
      const minConf = Number(minConfidenceFilter);
      const res = await fetchAdminRiskScores({
        limit: 100,
        riskLevel: riskLevelFilter,
        minScore: Number.isFinite(minScore) ? minScore : 0,
        minConfidence: Number.isFinite(minConf) ? minConf : 0,
        recommendedAction: actionFilter,
      });
      if (res.tableMissing) {
        setTableMissing(true);
        setRows([]);
        setTableError(null);
        return;
      }
      setTableMissing(false);
      if (res.error) {
        setTableError(res.error);
        setRows([]);
        return;
      }
      setRows((res.rows || []).map(mapRiskScoreRow).filter(Boolean));
    } catch (e) {
      setTableError(e?.message || "Failed to load risk scores.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user, profile, riskLevelFilter, minScoreFilter, minConfidenceFilter, actionFilter]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void loadTable();
  }, [authLoading, user, profile, loadTable]);

  const handleCalculate = useCallback(async () => {
    const targetId = userIdInput.trim();
    if (!targetId) {
      setBanner({ type: "err", message: "Enter a user ID to calculate a risk score." });
      return;
    }
    setCalcBusy(true);
    setBanner({ type: null, message: "" });
    try {
      const result = await calculateUserRiskScore(targetId);
      const saved = await saveUserRiskScore(targetId, result);
      if (saved.tableMissing) {
        setBanner({
          type: "err",
          message: "Risk scores table is not available. Apply supabase/sql/user_risk_scores.sql first.",
        });
        return;
      }
      if (!saved.ok) {
        setBanner({ type: "err", message: saved.error || "Could not save risk score." });
        return;
      }
      setBanner({
        type: "ok",
        message: `Risk ${result.riskScore} · Confidence ${result.confidenceScore}% · Trust ${result.trustScore} — ${result.riskLevel}, recommended: ${result.recommendedAction.replace(/_/g, " ")}.`,
      });
      await loadTable();
    } catch (e) {
      setBanner({ type: "err", message: e?.message || "Calculation failed." });
    } finally {
      setCalcBusy(false);
    }
  }, [userIdInput, loadTable]);

  const handleCreateReviewCase = useCallback(
    async (targetUserId, riskRow) => {
      const uid = String(targetUserId || "").trim();
      if (!uid) {
        setBanner({ type: "err", message: "User ID is required to create a review case." });
        return;
      }
      setCaseBusyUserId(uid);
      setBanner({ type: null, message: "" });
      try {
        let scoreRow = riskRow;
        if (!scoreRow) {
          const fetched = await fetchUserRiskScore(uid);
          if (fetched.tableMissing) {
            setBanner({
              type: "err",
              message: "Risk scores table is not available. Calculate and save a score first.",
            });
            return;
          }
          if (!fetched.data) {
            setBanner({
              type: "err",
              message: "No stored risk score for this user. Calculate a score first.",
            });
            return;
          }
          scoreRow = fetched.data;
        }

        const res = await createRiskReviewCaseFromScore({
          userId: uid,
          riskScoreRow: scoreRow,
          adminUserId: user?.id ?? null,
        });

        if (res.tableMissing) {
          setBanner({
            type: "err",
            message: "Review cases table is not available. Apply supabase/sql/risk_review_cases.sql first.",
          });
          return;
        }
        if (!res.success) {
          setBanner({ type: "err", message: res.error || "Could not create review case." });
          return;
        }
        if (res.duplicate) {
          setBanner({
            type: "ok",
            message: res.message || "An active review case already exists. A system note was added.",
          });
          return;
        }
        setBanner({ type: "ok", message: "Review case created. Open the Risk Review Queue to manage it." });
      } catch (e) {
        setBanner({ type: "err", message: e?.message || "Could not create review case." });
      } finally {
        setCaseBusyUserId(null);
      }
    },
    [user?.id],
  );

  const summary = useMemo(() => {
    const byLevel = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const r of rows) {
      const k = String(r.riskLevel || "").toLowerCase();
      if (k in byLevel) byLevel[k] += 1;
    }
    return byLevel;
  }, [rows]);

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
          <Link href="/login" style={{ fontWeight: 600, color: "#0ea5e9" }}>
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
      <style>{adminFocusCss}</style>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ marginBottom: "1.25rem" }}>
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
              fontSize: "1.55rem",
              fontWeight: 800,
              color: "#0f172a",
              margin: "0 0 0.35rem",
              letterSpacing: "-0.02em",
            }}
          >
            Risk Intelligence
          </h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748b", maxWidth: "44rem", lineHeight: 1.5 }}>
            Unified risk scoring from security events, account status, transactions, and fraud logs. Recommendations
            only — no automatic blocking or enforcement.
          </p>
          <p style={{ margin: "0.65rem 0 0", fontSize: "0.85rem" }}>
            <Link href="/admin/risk-cases" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              Risk Review Queue
            </Link>
          </p>
        </div>

        {tableMissing ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem 1.15rem",
              marginBottom: "1.25rem",
              borderColor: "#fcd34d",
              background: "#fffbeb",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#92400e", lineHeight: 1.5 }}>
              Apply <code style={{ fontSize: "0.8rem" }}>supabase/sql/user_risk_scores.sql</code> and{" "}
              <code style={{ fontSize: "0.8rem" }}>supabase/sql/user_risk_scores_phase2b.sql</code> in Supabase SQL Editor
              to enable persisted risk scores.
            </p>
          </div>
        ) : null}

        <div style={{ ...cardBase, padding: "1.1rem 1.15rem", marginBottom: "1.25rem" }}>
          <h2
            style={{
              margin: "0 0 0.75rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Controls
          </h2>
          {banner.message ? (
            <div
              role="status"
              style={{
                padding: "0.65rem 0.85rem",
                marginBottom: "0.85rem",
                borderRadius: "10px",
                border: `1px solid ${banner.type === "ok" ? "#bbf7d0" : "#fecaca"}`,
                background: banner.type === "ok" ? "#f0fdf4" : "#fef2f2",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.82rem", color: banner.type === "ok" ? "#166534" : "#991b1b" }}>
                {banner.message}
              </p>
            </div>
          ) : null}
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
              alignItems: "end",
            }}
          >
            <label style={{ display: "block" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                User ID
              </span>
              <input
                type="text"
                className="tc-risk-in"
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                placeholder="UUID"
                style={{ ...inputBase, marginTop: "0.35rem" }}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                Risk level filter
              </span>
              <select
                className="tc-risk-in"
                value={riskLevelFilter}
                onChange={(e) => setRiskLevelFilter(e.target.value)}
                style={{ ...selectBase, marginTop: "0.35rem" }}
              >
                <option value="">All levels</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                Min score
              </span>
              <input
                type="number"
                min={0}
                max={100}
                className="tc-risk-in"
                value={minScoreFilter}
                onChange={(e) => setMinScoreFilter(e.target.value)}
                style={{ ...inputBase, marginTop: "0.35rem" }}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                Min confidence
              </span>
              <input
                type="number"
                min={0}
                max={100}
                className="tc-risk-in"
                value={minConfidenceFilter}
                onChange={(e) => setMinConfidenceFilter(e.target.value)}
                style={{ ...inputBase, marginTop: "0.35rem" }}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                Recommended action
              </span>
              <select
                className="tc-risk-in"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                style={{ ...selectBase, marginTop: "0.35rem" }}
              >
                <option value="">All actions</option>
                <option value="allow">Allow</option>
                <option value="monitor">Monitor</option>
                <option value="review">Review</option>
                <option value="restrict">Restrict</option>
                <option value="freeze_candidate">Freeze candidate</option>
              </select>
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => void handleCalculate()}
                disabled={calcBusy}
                style={{
                  ...btnPrimary,
                  opacity: calcBusy ? 0.65 : 1,
                  cursor: calcBusy ? "not-allowed" : "pointer",
                }}
              >
                {calcBusy ? "Calculating…" : "Calculate score"}
              </button>
              <button
                type="button"
                onClick={() => void handleCreateReviewCase(userIdInput.trim(), null)}
                disabled={calcBusy || caseBusyUserId === userIdInput.trim() || !userIdInput.trim()}
                style={{
                  ...btnSecondary,
                  opacity: calcBusy || caseBusyUserId || !userIdInput.trim() ? 0.65 : 1,
                  cursor: calcBusy || caseBusyUserId || !userIdInput.trim() ? "not-allowed" : "pointer",
                }}
              >
                {caseBusyUserId === userIdInput.trim() ? "Creating case…" : "Create review case"}
              </button>
              <button
                type="button"
                onClick={() => void loadTable()}
                disabled={loading}
                style={{
                  ...btnSecondary,
                  opacity: loading ? 0.65 : 1,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                Refresh table
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 120px), 1fr))",
            gap: "0.65rem",
            marginBottom: "1.25rem",
          }}
        >
          {[
            { label: "Low", value: summary.low, color: "#166534" },
            { label: "Medium", value: summary.medium, color: "#92400e" },
            { label: "High", value: summary.high, color: "#991b1b" },
            { label: "Critical", value: summary.critical, color: "#450a0a" },
          ].map((c) => (
            <div key={c.label} style={{ ...cardBase, padding: "0.65rem 0.75rem" }}>
              <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", color: "#94a3b8" }}>
                {c.label}
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "1.15rem", fontWeight: 800, color: c.color }}>
                {loading ? "…" : c.value}
              </p>
            </div>
          ))}
        </div>

        <div style={{ ...cardBase, padding: "1.1rem 1.15rem" }}>
          <h2
            style={{
              margin: "0 0 0.75rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Risk score table
          </h2>
          {tableError ? (
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "#b91c1c" }}>{tableError}</p>
          ) : null}
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", minWidth: "960px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                  {[
                    "",
                    "User ID",
                    "Risk score",
                    "Confidence",
                    "Trust",
                    "Risk level",
                    "Recommended action",
                    "Top reasons",
                    "Last scored",
                    "Updated",
                    "Case",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "0.5rem 0.4rem",
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
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: "0.75rem 0.4rem", color: "#64748b" }}>
                      Loading…
                    </td>
                  </tr>
                ) : null}
                {!loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ padding: "0.75rem 0.4rem", color: "#64748b" }}>
                      No persisted risk scores yet. Calculate a score for a user above.
                    </td>
                  </tr>
                ) : null}
                {rows.map((r) => {
                  const expanded = expandedUserId === r.userId;
                  const topReasons = formatTopReasons(r.reasons, 3);
                  return (
                    <Fragment key={r.userId}>
                      <tr style={{ borderBottom: expanded ? "none" : "1px solid #f1f5f9", verticalAlign: "top" }}>
                        <td style={{ padding: "0.5rem 0.4rem", width: "2rem" }}>
                          <button
                            type="button"
                            onClick={() => setExpandedUserId(expanded ? null : r.userId)}
                            aria-expanded={expanded}
                            aria-label={expanded ? "Hide details" : "Show details"}
                            style={{
                              ...btnSecondary,
                              padding: "0.2rem 0.45rem",
                              fontSize: "0.75rem",
                              lineHeight: 1,
                            }}
                          >
                            {expanded ? "−" : "+"}
                          </button>
                        </td>
                        <td style={{ padding: "0.5rem 0.4rem", wordBreak: "break-all", maxWidth: "12rem" }}>
                          <Link
                            href={`/admin/risk-users/${encodeURIComponent(r.userId)}`}
                            style={{ fontWeight: 600, color: "#0ea5e9" }}
                          >
                            {r.userId}
                          </Link>
                        </td>
                        <td style={{ padding: "0.5rem 0.4rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                          {r.riskScore}
                        </td>
                        <td
                          style={{
                            padding: "0.5rem 0.4rem",
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                            color: confidenceColor(r.confidenceScore),
                          }}
                        >
                          {r.confidenceScore}%
                        </td>
                        <td
                          style={{
                            padding: "0.5rem 0.4rem",
                            fontWeight: 700,
                            fontVariantNumeric: "tabular-nums",
                            color: trustColor(r.trustScore),
                          }}
                        >
                          {r.trustScore > 0 ? "+" : ""}
                          {r.trustScore}
                        </td>
                        <td style={{ padding: "0.5rem 0.4rem" }}>
                          <span style={riskLevelBadge(r.riskLevel)}>{r.riskLevel}</span>
                        </td>
                        <td style={{ padding: "0.5rem 0.4rem" }}>
                          <span style={actionBadge(r.recommendedAction)}>
                            {String(r.recommendedAction || "").replace(/_/g, " ")}
                          </span>
                        </td>
                        <td style={{ padding: "0.5rem 0.4rem", color: "#475569", lineHeight: 1.5, maxWidth: "18rem" }}>
                          {topReasons.length === 0 ? (
                            "—"
                          ) : (
                            <ul style={{ margin: 0, padding: "0 0 0 1rem" }}>
                              {topReasons.map((reason) => (
                                <li key={reason.code} style={{ marginBottom: "0.15rem" }}>
                                  {reason.display}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td style={{ padding: "0.5rem 0.4rem", color: "#64748b", whiteSpace: "nowrap" }}>
                          {formatWhen(r.lastScoredAt)}
                        </td>
                        <td style={{ padding: "0.5rem 0.4rem", color: "#64748b", whiteSpace: "nowrap" }}>
                          {formatWhen(r.updatedAt)}
                        </td>
                        <td style={{ padding: "0.5rem 0.4rem", whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            onClick={() =>
                              void handleCreateReviewCase(r.userId, {
                                user_id: r.userId,
                                risk_score: r.riskScore,
                                confidence_score: r.confidenceScore,
                                trust_score: r.trustScore,
                                risk_level: r.riskLevel,
                                recommended_action: r.recommendedAction,
                                reasons: r.reasons,
                                source_snapshot: r.sourceSnapshot,
                                decay_snapshot: r.decaySnapshot,
                              })
                            }
                            disabled={caseBusyUserId === r.userId}
                            style={{
                              ...btnSecondary,
                              padding: "0.28rem 0.5rem",
                              fontSize: "0.72rem",
                              opacity: caseBusyUserId === r.userId ? 0.65 : 1,
                            }}
                          >
                            {caseBusyUserId === r.userId ? "…" : "Create case"}
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr key={`${r.userId}-details`} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td colSpan={11} style={{ padding: "0.65rem 0.75rem 0.85rem", background: "#f8fafc" }}>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
                                gap: "0.75rem",
                              }}
                            >
                              <div>
                                <p
                                  style={{
                                    margin: "0 0 0.35rem",
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    color: "#94a3b8",
                                  }}
                                >
                                  Decay snapshot
                                </p>
                                <pre
                                  style={{
                                    margin: 0,
                                    padding: "0.55rem 0.65rem",
                                    borderRadius: "8px",
                                    background: "#ffffff",
                                    border: "1px solid #e2e8f0",
                                    fontSize: "0.72rem",
                                    overflow: "auto",
                                    maxHeight: "10rem",
                                  }}
                                >
                                  {JSON.stringify(r.decaySnapshot || {}, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <p
                                  style={{
                                    margin: "0 0 0.35rem",
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                    textTransform: "uppercase",
                                    color: "#94a3b8",
                                  }}
                                >
                                  Source snapshot
                                </p>
                                <pre
                                  style={{
                                    margin: 0,
                                    padding: "0.55rem 0.65rem",
                                    borderRadius: "8px",
                                    background: "#ffffff",
                                    border: "1px solid #e2e8f0",
                                    fontSize: "0.72rem",
                                    overflow: "auto",
                                    maxHeight: "10rem",
                                  }}
                                >
                                  {JSON.stringify(r.sourceSnapshot || {}, null, 2)}
                                </pre>
                              </div>
                            </div>
                            <p style={{ margin: "0.5rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
                              Engine version: {r.riskVersion || "phase2b"}
                            </p>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
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
