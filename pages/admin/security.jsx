import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import {
  fetchAdminSecurityOverview,
  fetchRecentAccountSecurityStatuses,
  fetchRecentBlockedFinancialActions,
  fetchRecentSecurityEvents,
  fetchRecentUserSessions,
  formatSecurityMetadataPreview,
} from "../../lib/adminSecurity";
import {
  ACCOUNT_STATUSES,
  RISK_LEVELS,
  adminSetAccountSecurityStatus,
} from "../../lib/accountSecurityStatus";
import { SECURITY_QA_SCENARIOS, runSecurityQaScenario } from "../../lib/adminSecurityQa";

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

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function severityBadge(sev) {
  const key = String(sev || "").toLowerCase();
  if (key === "critical") {
    return {
      display: "inline-block",
      padding: "0.15rem 0.45rem",
      borderRadius: "6px",
      fontSize: "0.68rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#450a0a",
      color: "#fecaca",
      border: "1px solid #7f1d1d",
    };
  }
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
  if (key === "warning") {
    return {
      display: "inline-block",
      padding: "0.15rem 0.45rem",
      borderRadius: "6px",
      fontSize: "0.68rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fffbeb",
      color: "#92400e",
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

const EVENT_TYPE_LABELS = {
  login_success: "Successful sign-in",
  session_revoked: "Session revoked",
  suspicious_login: "Suspicious sign-in",
  failed_login: "Failed sign-in attempt",
  password_changed: "Password changed",
  email_changed: "Email changed",
  logout: "Signed out",
};

function eventTypeLabel(type) {
  const t = String(type || "");
  return EVENT_TYPE_LABELS[t] || t.replace(/_/g, " ");
}

function sessionRevoked(row) {
  return !!row?.revoked_at || row?.revoked === true;
}

function AccountRiskControlsSection({
  riskForm,
  setRiskForm,
  riskBanner,
  riskApplying,
  loading,
  statusRows,
  onApply,
  formatWhen,
}) {
  return (
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
        Account risk controls
      </h2>
      <p style={{ margin: "0 0 0.85rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
        Mark accounts for review. This updates status visibility and user messaging only — it does not block sends,
        funding, or withdrawals yet.
      </p>
      {riskBanner.message ? (
        <div
          role="status"
          style={{
            padding: "0.65rem 0.85rem",
            marginBottom: "0.75rem",
            borderRadius: "10px",
            border: `1px solid ${riskBanner.type === "ok" ? "#bbf7d0" : "#fecaca"}`,
            background: riskBanner.type === "ok" ? "#f0fdf4" : "#fef2f2",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.82rem", color: riskBanner.type === "ok" ? "#166534" : "#991b1b" }}>
            {riskBanner.message}
          </p>
        </div>
      ) : null}
      <div
        style={{
          display: "grid",
          gap: "0.65rem",
          gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))",
        }}
      >
        <label style={{ display: "block" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>User ID</span>
          <input
            type="text"
            value={riskForm.userId}
            onChange={(e) => setRiskForm((f) => ({ ...f, userId: e.target.value }))}
            placeholder="UUID"
            style={{
              display: "block",
              width: "100%",
              marginTop: "0.3rem",
              padding: "0.5rem 0.6rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "0.85rem",
              boxSizing: "border-box",
            }}
          />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Status</span>
          <select
            value={riskForm.status}
            onChange={(e) => setRiskForm((f) => ({ ...f, status: e.target.value }))}
            style={{
              display: "block",
              width: "100%",
              marginTop: "0.3rem",
              padding: "0.5rem 0.6rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "0.85rem",
            }}
          >
            {ACCOUNT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Risk level</span>
          <select
            value={riskForm.riskLevel}
            onChange={(e) => setRiskForm((f) => ({ ...f, riskLevel: e.target.value }))}
            style={{
              display: "block",
              width: "100%",
              marginTop: "0.3rem",
              padding: "0.5rem 0.6rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "0.85rem",
            }}
          >
            {RISK_LEVELS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ display: "block", marginTop: "0.65rem" }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Reason</span>
        <input
          type="text"
          value={riskForm.reason}
          onChange={(e) => setRiskForm((f) => ({ ...f, reason: e.target.value }))}
          placeholder="Short reason for operators"
          style={{
            display: "block",
            width: "100%",
            marginTop: "0.3rem",
            padding: "0.5rem 0.6rem",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            fontSize: "0.85rem",
            boxSizing: "border-box",
          }}
        />
      </label>
      <label style={{ display: "block", marginTop: "0.65rem" }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>Notes</span>
        <textarea
          value={riskForm.notes}
          onChange={(e) => setRiskForm((f) => ({ ...f, notes: e.target.value }))}
          rows={2}
          placeholder="Internal notes (optional)"
          style={{
            display: "block",
            width: "100%",
            marginTop: "0.3rem",
            padding: "0.5rem 0.6rem",
            borderRadius: "8px",
            border: "1px solid #cbd5e1",
            fontSize: "0.85rem",
            boxSizing: "border-box",
            resize: "vertical",
          }}
        />
      </label>
      <div style={{ marginTop: "0.85rem" }}>
        <button
          type="button"
          disabled={riskApplying || loading}
          onClick={onApply}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "8px",
            border: "1px solid #2563eb",
            background: riskApplying ? "#94a3b8" : "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.85rem",
            cursor: riskApplying || loading ? "not-allowed" : "pointer",
          }}
        >
          {riskApplying ? "Applying…" : "Apply account status"}
        </button>
      </div>
      {statusRows.length > 0 ? (
        <div style={{ marginTop: "1rem", overflowX: "auto" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
            Recent status updates
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                {["User ID", "Status", "Risk", "Reason", "Updated"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.35rem", color: "#94a3b8" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statusRows.map((row) => (
                <tr key={String(row.user_id)} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.45rem 0.35rem", fontFamily: "ui-monospace, monospace", fontSize: "0.7rem" }}>
                    {String(row.user_id || "").slice(0, 8)}…
                  </td>
                  <td style={{ padding: "0.45rem 0.35rem", fontWeight: 600 }}>{row.status}</td>
                  <td style={{ padding: "0.45rem 0.35rem" }}>{row.risk_level}</td>
                  <td style={{ padding: "0.45rem 0.35rem", color: "#64748b", maxWidth: "12rem" }}>
                    {row.reason || "—"}
                  </td>
                  <td style={{ padding: "0.45rem 0.35rem", whiteSpace: "nowrap", color: "#64748b" }}>
                    {formatWhen(row.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function blockedActionFromMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return { action: "—", status: "—", risk_level: "—", reason: "—" };
  }
  return {
    action: metadata.action != null ? String(metadata.action) : "—",
    status: metadata.status != null ? String(metadata.status) : "—",
    risk_level: metadata.risk_level != null ? String(metadata.risk_level) : "—",
    reason: metadata.reason != null ? String(metadata.reason) : "—",
  };
}

function BlockedFinancialActionsSection({ rows, formatWhen }) {
  if (!rows?.length) return null;
  return (
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
        Blocked financial actions
      </h2>
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
        Frontend enforcement denials logged as security alerts (server-side API gates recommended later).
      </p>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.76rem" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
              {["Time", "User ID", "Action", "Status", "Risk", "Reason"].map((h) => (
                <th key={h} style={{ textAlign: "left", padding: "0.4rem 0.35rem", color: "#94a3b8" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const meta = blockedActionFromMetadata(row.metadata);
              return (
                <tr key={String(row.id)} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "0.45rem 0.35rem", whiteSpace: "nowrap", color: "#64748b" }}>
                    {formatWhen(row.created_at)}
                  </td>
                  <td style={{ padding: "0.45rem 0.35rem", fontFamily: "ui-monospace, monospace", fontSize: "0.7rem" }}>
                    {String(row.user_id || "").slice(0, 8)}…
                  </td>
                  <td style={{ padding: "0.45rem 0.35rem" }}>{meta.action}</td>
                  <td style={{ padding: "0.45rem 0.35rem" }}>{meta.status}</td>
                  <td style={{ padding: "0.45rem 0.35rem" }}>{meta.risk_level}</td>
                  <td style={{ padding: "0.45rem 0.35rem", color: "#64748b", maxWidth: "10rem" }}>
                    {meta.reason}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function sessionStatusPill(revoked) {
  if (revoked) {
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
  return {
    display: "inline-block",
    padding: "0.15rem 0.45rem",
    borderRadius: "6px",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: "#ecfdf5",
    color: "#166534",
    border: "1px solid #bbf7d0",
  };
}

export default function AdminSecurityPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(() => ({
    error: null,
    recentEventsTotal: null,
    highCriticalCount: null,
    suspiciousLoginCount: null,
    suspiciousLoginRecent7d: null,
    suspiciousLoginHighestSeverity7d: null,
    suspiciousLoginLatestAt: null,
    revokedSessionCount: null,
    activeSessionCount: null,
    latestEventAt: null,
    frozenAccounts: null,
    restrictedAccounts: null,
    watchAccounts: null,
    criticalRiskAccounts: null,
  }));
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [statusRows, setStatusRows] = useState([]);
  const [blockedActions, setBlockedActions] = useState([]);
  const [listError, setListError] = useState(null);
  const [riskForm, setRiskForm] = useState({
    userId: "",
    status: "watch",
    riskLevel: "medium",
    reason: "",
    notes: "",
  });
  const [riskApplying, setRiskApplying] = useState(false);
  const [riskBanner, setRiskBanner] = useState({ type: null, message: "" });
  const [qaForm, setQaForm] = useState({ targetUserId: "", scenario: "suspicious_login_event" });
  const [qaRunning, setQaRunning] = useState(false);
  const [qaBanner, setQaBanner] = useState({ type: null, message: "" });

  const loadAll = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setListError(null);
    try {
      const [ov, ev, sess, statuses, blocked] = await Promise.all([
        fetchAdminSecurityOverview(supabase),
        fetchRecentSecurityEvents(supabase, { limit: 50 }),
        fetchRecentUserSessions(supabase, { limit: 50 }),
        fetchRecentAccountSecurityStatuses(supabase, { limit: 20 }),
        fetchRecentBlockedFinancialActions(supabase, { limit: 15 }),
      ]);
      setOverview(ov);
      setEvents(ev.rows || []);
      setSessions(sess.rows || []);
      setStatusRows(statuses.rows || []);
      setBlockedActions(blocked.rows || []);
      if (ev.error || sess.error) {
        setListError([ev.error, sess.error].filter(Boolean).join(" · ") || null);
      }
    } catch (e) {
      console.error(e);
      setListError(e?.message || "Failed to load security data.");
    } finally {
      setLoading(false);
    }
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void loadAll();
  }, [authLoading, user, profile, loadAll]);

  const handleApplyAccountStatus = useCallback(async () => {
    if (!user?.id) return;
    const targetId = riskForm.userId.trim();
    if (!targetId) {
      setRiskBanner({ type: "err", message: "Enter a user ID to update account status." });
      return;
    }
    setRiskApplying(true);
    setRiskBanner({ type: null, message: "" });
    try {
      const res = await adminSetAccountSecurityStatus({
        userId: targetId,
        status: riskForm.status,
        riskLevel: riskForm.riskLevel,
        reason: riskForm.reason,
        notes: riskForm.notes,
        adminUserId: user.id,
        supabaseClient: supabase,
      });
      if (res.tableMissing) {
        setRiskBanner({
          type: "err",
          message: "Account status table is not available. Apply supabase/sql/account_security_status.sql first.",
        });
        return;
      }
      if (!res.ok) {
        setRiskBanner({ type: "err", message: res.error || "Could not update account status." });
        return;
      }
      setRiskBanner({
        type: "ok",
        message: `Account status set to ${res.status} (${res.risk_level} risk).`,
      });
      await loadAll();
    } catch (e) {
      setRiskBanner({ type: "err", message: e?.message || "Update failed." });
    } finally {
      setRiskApplying(false);
    }
  }, [user?.id, riskForm, loadAll]);

  const handleRunQaScenario = useCallback(async () => {
    if (!user?.id) return;
    const targetId = qaForm.targetUserId.trim();
    if (!targetId) {
      setQaBanner({ type: "err", message: "Enter a target user ID before running a QA test." });
      return;
    }
    setQaRunning(true);
    setQaBanner({ type: null, message: "" });
    try {
      const res = await runSecurityQaScenario({
        adminUserId: user.id,
        targetUserId: targetId,
        scenario: qaForm.scenario,
        supabaseClient: supabase,
      });
      if (!res.success) {
        setQaBanner({ type: "err", message: res.error || "QA test failed." });
        return;
      }
      setQaBanner({ type: "ok", message: res.message || "QA test completed." });
      await loadAll();
    } catch (e) {
      setQaBanner({ type: "err", message: e?.message || "QA test failed." });
    } finally {
      setQaRunning(false);
    }
  }, [user?.id, qaForm, loadAll]);

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

  const kpi = (label, value) => (
    <div
      key={label}
      style={{
        border: "1px solid #f1f5f9",
        borderRadius: "10px",
        padding: "0.65rem 0.75rem",
        background: "#fafafa",
      }}
    >
      <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#64748b" }}>
        {label}
      </p>
      <p style={{ margin: "0.35rem 0 0", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a", fontVariantNumeric: "tabular-nums", wordBreak: "break-word" }}>
        {loading ? "…" : value == null ? "—" : String(value)}
      </p>
    </div>
  );

  return (
    <>
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
            Security Console
          </h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#64748b", maxWidth: "44rem", lineHeight: 1.5 }}>
            Monitor account access, suspicious login activity, and revoked sessions.
          </p>
          <p style={{ margin: "0.65rem 0 0", fontSize: "0.85rem" }}>
            <Link href="/admin/audit" style={{ fontWeight: 600, color: "#0ea5e9" }}>
              View Admin Audit Trail
            </Link>
          </p>
        </div>

        <div
          style={{
            ...cardBase,
            padding: "0.85rem 1rem",
            marginBottom: "1rem",
            background: "#f8fafc",
            borderColor: "#e2e8f0",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#475569", lineHeight: 1.5 }}>
            Security preferences are user-controlled. 2FA is currently prepared but not enforced.
          </p>
        </div>

        {overview.error ? (
          <div style={{ ...cardBase, padding: "0.85rem 1rem", marginBottom: "1rem", borderColor: "#fecaca", background: "#fef2f2" }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#991b1b" }}>
              Some metrics may be unavailable: {overview.error}
            </p>
          </div>
        ) : null}

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
              Overview
            </h2>
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
              style={{
                padding: "0.28rem 0.55rem",
                fontSize: "0.72rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 600,
                opacity: loading ? 0.65 : 1,
              }}
            >
              Refresh
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
              gap: "0.65rem",
              marginTop: "0.85rem",
            }}
          >
            {kpi("Recent events (7d)", overview.recentEventsTotal)}
            {kpi("High / critical (all)", overview.highCriticalCount)}
            {kpi("Suspicious logins (all)", overview.suspiciousLoginCount)}
            {kpi("Active sessions", overview.activeSessionCount)}
            {kpi("Revoked sessions", overview.revokedSessionCount)}
            {kpi("Latest event", overview.latestEventAt ? formatWhen(overview.latestEventAt) : "—")}
            {kpi("Frozen accounts", overview.frozenAccounts)}
            {kpi("Restricted accounts", overview.restrictedAccounts)}
            {kpi("Watch accounts", overview.watchAccounts)}
            {kpi("Critical risk", overview.criticalRiskAccounts)}
          </div>
        </div>

        <AccountRiskControlsSection
          riskForm={riskForm}
          setRiskForm={setRiskForm}
          riskBanner={riskBanner}
          riskApplying={riskApplying}
          loading={loading}
          statusRows={statusRows}
          onApply={() => void handleApplyAccountStatus()}
          formatWhen={formatWhen}
        />

        <BlockedFinancialActionsSection rows={blockedActions} formatWhen={formatWhen} />

        <div
          style={{
            ...cardBase,
            padding: "1rem 1.15rem",
            marginBottom: "1.25rem",
            border: "1px solid #fef3c7",
            background: "linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)",
          }}
        >
          <h2
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.78rem",
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#92400e",
            }}
          >
            Suspicious login signals
          </h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#78350f", lineHeight: 1.45 }}>
            Derived from <code style={{ fontSize: "0.72rem" }}>suspicious_login</code> events (device/browser pattern changes). Advisory
            only — not a fraud verdict.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem 1.25rem" }}>
            <div>
              <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase" }}>
                Recent (7d)
              </p>
              <p style={{ margin: "0.25rem 0 0", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                {loading ? "…" : overview.suspiciousLoginRecent7d == null ? "—" : String(overview.suspiciousLoginRecent7d)}
              </p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase" }}>
                Peak severity (7d)
              </p>
              <div style={{ marginTop: "0.3rem" }}>
                {overview.suspiciousLoginHighestSeverity7d ? (
                  <span style={severityBadge(overview.suspiciousLoginHighestSeverity7d)}>
                    {String(overview.suspiciousLoginHighestSeverity7d)}
                  </span>
                ) : (
                  <span style={{ color: "#64748b", fontSize: "0.88rem" }}>{loading ? "…" : "—"}</span>
                )}
              </div>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, color: "#92400e", textTransform: "uppercase" }}>
                Newest signal
              </p>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.88rem", fontWeight: 600, color: "#0f172a" }}>
                {loading ? "…" : overview.suspiciousLoginLatestAt ? formatWhen(overview.suspiciousLoginLatestAt) : "—"}
              </p>
            </div>
          </div>
        </div>

        {listError ? (
          <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "#b45309" }}>{listError}</p>
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
            Recent security events
          </h2>
          {events.length === 0 && !loading ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.88rem" }}>No security events in the database yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    {["Time", "Severity", "Type", "User ID", "Description", "Metadata"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "0.45rem 0.35rem",
                          fontWeight: 700,
                          color: "#94a3b8",
                          whiteSpace: h === "Metadata" ? "nowrap" : "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.5rem 0.35rem", color: "#64748b", whiteSpace: "nowrap", verticalAlign: "top" }}>
                        {formatWhen(ev.created_at)}
                      </td>
                      <td style={{ padding: "0.5rem 0.35rem", verticalAlign: "top" }}>
                        <span style={severityBadge(ev.severity)}>{String(ev.severity || "info")}</span>
                      </td>
                      <td style={{ padding: "0.5rem 0.35rem", verticalAlign: "top" }}>
                        <div style={{ fontWeight: 600, color: "#0f172a" }}>{eventTypeLabel(ev.type)}</div>
                        <div style={{ fontSize: "0.65rem", color: "#94a3b8", fontFamily: "ui-monospace, monospace", marginTop: "0.15rem" }}>
                          {ev.type}
                        </div>
                      </td>
                      <td style={{ padding: "0.5rem 0.35rem", fontFamily: "ui-monospace, monospace", fontSize: "0.7rem", wordBreak: "break-all", verticalAlign: "top" }}>
                        {ev.user_id || "—"}
                      </td>
                      <td style={{ padding: "0.5rem 0.35rem", color: "#475569", wordBreak: "break-word", verticalAlign: "top", maxWidth: "220px" }}>
                        {ev.description || "—"}
                      </td>
                      <td style={{ padding: "0.5rem 0.35rem", color: "#64748b", wordBreak: "break-word", verticalAlign: "top", maxWidth: "260px" }}>
                        {formatSecurityMetadataPreview(ev.metadata)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            Security QA / Test Panel
          </h2>
          <p style={{ margin: "0 0 0.85rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            QA tests create audit/security records only. They do not move money or call payment processors.
          </p>
          {qaBanner.message ? (
            <div
              role="status"
              style={{
                padding: "0.65rem 0.85rem",
                marginBottom: "0.75rem",
                borderRadius: "10px",
                border: `1px solid ${qaBanner.type === "ok" ? "#bbf7d0" : "#fecaca"}`,
                background: qaBanner.type === "ok" ? "#f0fdf4" : "#fef2f2",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.85rem", color: qaBanner.type === "ok" ? "#166534" : "#b91c1c" }}>
                {qaBanner.message}
                {qaBanner.type === "ok" && qaForm.scenario === "audit_log_test" ? (
                  <>
                    {" "}
                    <Link href="/admin/audit" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                      Open Admin Audit Trail
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}
          <label style={{ display: "block", marginBottom: "0.65rem" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
              Target user ID
            </span>
            <input
              type="text"
              value={qaForm.targetUserId}
              onChange={(e) => setQaForm((f) => ({ ...f, targetUserId: e.target.value }))}
              placeholder="User UUID (profiles.id)"
              style={{
                display: "block",
                width: "100%",
                maxWidth: "420px",
                marginTop: "0.3rem",
                padding: "0.5rem 0.6rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                fontFamily: "ui-monospace, monospace",
                boxSizing: "border-box",
              }}
            />
          </label>
          <label style={{ display: "block", marginBottom: "0.85rem" }}>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
              Scenario
            </span>
            <select
              value={qaForm.scenario}
              onChange={(e) => setQaForm((f) => ({ ...f, scenario: e.target.value }))}
              style={{
                display: "block",
                width: "100%",
                maxWidth: "420px",
                marginTop: "0.3rem",
                padding: "0.5rem 0.6rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                background: "#fff",
              }}
            >
              {SECURITY_QA_SCENARIOS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={qaRunning || loading}
            onClick={() => void handleRunQaScenario()}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "1px solid #0ea5e9",
              background: "linear-gradient(180deg, #38bdf8 0%, #0ea5e9 100%)",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: qaRunning || loading ? "not-allowed" : "pointer",
              opacity: qaRunning || loading ? 0.65 : 1,
            }}
          >
            {qaRunning ? "Running…" : "Run test"}
          </button>
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
            Recent sessions / devices
          </h2>
          {sessions.length === 0 && !loading ? (
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.88rem" }}>No device sessions recorded yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                    {["Created", "Last active", "User ID", "Device", "Browser / OS", "Location", "Status"].map((h) => (
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
                  {sessions.map((row) => {
                    const revoked = sessionRevoked(row);
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", background: revoked ? "#fafafa" : undefined }}>
                        <td style={{ padding: "0.5rem 0.35rem", color: "#64748b", whiteSpace: "nowrap", verticalAlign: "top" }}>
                          {formatWhen(row.created_at)}
                        </td>
                        <td style={{ padding: "0.5rem 0.35rem", color: "#64748b", whiteSpace: "nowrap", verticalAlign: "top" }}>
                          {formatWhen(row.last_active_at)}
                        </td>
                        <td style={{ padding: "0.5rem 0.35rem", fontFamily: "ui-monospace, monospace", fontSize: "0.7rem", wordBreak: "break-all", verticalAlign: "top" }}>
                          {row.user_id || "—"}
                        </td>
                        <td style={{ padding: "0.5rem 0.35rem", fontWeight: 600, color: "#0f172a", verticalAlign: "top" }}>
                          {row.device_name || "—"}
                        </td>
                        <td style={{ padding: "0.5rem 0.35rem", color: "#475569", verticalAlign: "top" }}>
                          {[row.browser, row.os].filter(Boolean).join(" · ") || "—"}
                        </td>
                        <td style={{ padding: "0.5rem 0.35rem", color: "#64748b", verticalAlign: "top" }}>{row.location || "—"}</td>
                        <td style={{ padding: "0.5rem 0.35rem", verticalAlign: "top" }}>
                          <span style={sessionStatusPill(revoked)}>{revoked ? "Revoked" : "Active"}</span>
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
