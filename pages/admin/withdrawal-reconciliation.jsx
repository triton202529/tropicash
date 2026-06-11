import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import {
  DEFAULT_RECONCILIATION_THRESHOLDS,
  fetchWithdrawalReconciliationReport,
  RECONCILIATION_ISSUE_TYPES,
} from "../../lib/withdrawalReconciliation";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1180px",
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

const btnSm = {
  padding: "0.45rem 0.75rem",
  fontSize: "0.78rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
};

const ISSUE_TYPE_LABELS = {
  [RECONCILIATION_ISSUE_TYPES.PENDING_STALE]: "Pending too long",
  [RECONCILIATION_ISSUE_TYPES.PROCESSING_PAYPAL_STALE]: "PayPal processing stuck",
  [RECONCILIATION_ISSUE_TYPES.FAILED_NOT_REFUNDED]: "Failed, not refunded",
  [RECONCILIATION_ISSUE_TYPES.REJECTED_NOT_REFUNDED]: "Rejected, not refunded",
  [RECONCILIATION_ISSUE_TYPES.PAID_MANUAL_MISSING_REFERENCE]: "Manual paid, no reference",
  [RECONCILIATION_ISSUE_TYPES.PAID_PAYPAL_MISSING_BATCH]: "PayPal paid, missing batch",
  [RECONCILIATION_ISSUE_TYPES.MISSING_WITHDRAWAL_TRANSACTION_ID]: "Missing ledger link",
  [RECONCILIATION_ISSUE_TYPES.ORPHAN_WITHDRAW_TRANSACTION]: "Orphan withdraw txn",
  [RECONCILIATION_ISSUE_TYPES.ORPHAN_REFUND_TRANSACTION]: "Orphan refund txn",
  [RECONCILIATION_ISSUE_TYPES.REFUNDED_STILL_ACTIVE]: "Refunded but active status",
  [RECONCILIATION_ISSUE_TYPES.PAID_AND_REFUNDED]: "Paid and refunded",
};

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatMoney(value) {
  const n = Number(value);
  return Number(Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function sevStyle(sev) {
  const key = String(sev || "").toLowerCase();
  if (key === "critical") {
    return { bg: "#fef2f2", fg: "#991b1b", border: "#fecaca" };
  }
  if (key === "warning") {
    return { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" };
  }
  return { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" };
}

function shortId(id) {
  if (!id || typeof id !== "string") return "—";
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function MetricTile({ label, value, accent }) {
  return (
    <div style={{ ...cardBase, padding: "0.85rem 1rem", background: "#fafbfc" }}>
      <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
        {label}
      </p>
      <p style={{ margin: "0.35rem 0 0", fontSize: "1.35rem", fontWeight: 800, color: accent || "#0f172a" }}>{value}</p>
    </div>
  );
}

export default function AdminWithdrawalReconciliationPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [severityFilter, setSeverityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const loadReport = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setFetchError(null);
    try {
      const data = await fetchWithdrawalReconciliationReport({ supabase });
      setReport(data);
      if (data.error) setFetchError(data.error);
    } catch (err) {
      setFetchError(err?.message || "Could not load reconciliation report.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void loadReport();
  }, [authLoading, user, profile, loadReport]);

  const filteredIssues = useMemo(() => {
    const list = report?.issues || [];
    return list.filter((issue) => {
      if (severityFilter !== "all" && issue.severity !== severityFilter) return false;
      if (typeFilter !== "all" && issue.type !== typeFilter) return false;
      return true;
    });
  }, [report?.issues, severityFilter, typeFilter]);

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
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a" }}>Withdrawal Reconciliation</h1>
          <p style={{ color: "#64748b" }}>Sign in to view this page.</p>
          <Link href="/login" style={{ color: "#0ea5e9", fontWeight: 600 }}>
            Go to login
          </Link>
        </div>
      </>
    );
  }

  if (!isAdminUser(user, profile)) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <h2 style={{ color: "#0f172a" }}>Admin access required.</h2>
        </div>
      </>
    );
  }

  const summary = report?.summary;

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div>
            <Link href="/admin" style={{ color: "#38bdf8", fontWeight: 600, fontSize: "0.9rem" }}>
              ← Admin home
            </Link>
            <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", margin: "0.5rem 0 0", letterSpacing: "-0.02em" }}>
              Withdrawal Reconciliation
            </h1>
          </div>
          <button type="button" onClick={() => void loadReport()} disabled={loading} style={btnSm}>
            {loading ? "Refreshing…" : "Refresh report"}
          </button>
        </div>

        <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "#64748b", lineHeight: 1.55, maxWidth: "44rem" }}>
          Read-only monitor for stuck, inconsistent, or unresolved withdrawal records. No automatic refunds, status
          changes, or PayPal calls are made from this page.
        </p>

        <div
          style={{
            ...cardBase,
            padding: "0.75rem 1rem",
            marginBottom: "1.25rem",
            borderColor: "#bfdbfe",
            background: "#eff6ff",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#1e40af", lineHeight: 1.45 }}>
            Thresholds: pending &gt; {DEFAULT_RECONCILIATION_THRESHOLDS.pendingStaleMs / 3600000}h · PayPal processing
            &gt; {DEFAULT_RECONCILIATION_THRESHOLDS.processingPayPalStaleMs / 3600000}h · lookback{" "}
            {DEFAULT_RECONCILIATION_THRESHOLDS.lookbackDays} days
          </p>
          {report?.generatedAt ? (
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#64748b" }}>
              Generated {formatWhen(report.generatedAt)}
              {summary?.withdrawalRowsScanned != null
                ? ` · ${summary.withdrawalRowsScanned} requests · ${summary.transactionRowsScanned} ledger txns`
                : ""}
            </p>
          ) : null}
        </div>

        {fetchError ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", borderColor: "#fecaca", background: "#fef2f2" }}>
            <p style={{ margin: 0, color: "#991b1b", fontSize: "0.9rem" }}>{fetchError}</p>
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          <MetricTile label="Total issues" value={summary?.total ?? "—"} />
          <MetricTile label="Critical" value={summary?.critical ?? "—"} accent="#991b1b" />
          <MetricTile label="Warning" value={summary?.warning ?? "—"} accent="#b45309" />
          <MetricTile label="Info" value={summary?.info ?? "—"} accent="#1d4ed8" />
        </div>

        <div style={{ ...cardBase, padding: "0.85rem 1rem", marginBottom: "1.25rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
          <label style={{ fontSize: "0.82rem", color: "#475569" }}>
            Severity{" "}
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              style={{ marginLeft: "0.35rem", padding: "0.35rem 0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
          </label>
          <label style={{ fontSize: "0.82rem", color: "#475569" }}>
            Type{" "}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{ marginLeft: "0.35rem", padding: "0.35rem 0.5rem", borderRadius: "6px", border: "1px solid #cbd5e1", maxWidth: "14rem" }}
            >
              <option value="all">All types</option>
              {Object.entries(ISSUE_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Link href="/admin/withdrawals" style={{ marginLeft: "auto", fontSize: "0.82rem", fontWeight: 600, color: "#0ea5e9" }}>
            Open withdrawals queue →
          </Link>
        </div>

        {loading && !report ? (
          <p style={{ color: "#64748b" }}>Loading reconciliation report…</p>
        ) : filteredIssues.length === 0 ? (
          <div style={{ ...cardBase, padding: "2rem 1.5rem", textAlign: "center" }}>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
              {report?.issues?.length ? "No issues match the current filters." : "No reconciliation issues detected in the lookback window."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {filteredIssues.map((issue) => {
              const pal = sevStyle(issue.severity);
              return (
                <div key={issue.id} style={{ ...cardBase, padding: "1rem 1.1rem" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        background: pal.bg,
                        color: pal.fg,
                        border: `1px solid ${pal.border}`,
                      }}
                    >
                      {issue.severity}
                    </span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                      {ISSUE_TYPE_LABELS[issue.type] || issue.type}
                    </span>
                    {issue.amount != null ? (
                      <span style={{ marginLeft: "auto", fontWeight: 800, color: "#0f172a" }}>${formatMoney(issue.amount)}</span>
                    ) : null}
                  </div>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem", color: "#0f172a", lineHeight: 1.45 }}>{issue.message}</p>
                  <p style={{ margin: "0 0 0.65rem", fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                    <strong>Recommended:</strong> {issue.recommendedAction}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem 1rem", fontSize: "0.78rem", color: "#64748b" }}>
                    {issue.withdrawalRequestId ? (
                      <Link
                        href={`/admin/withdrawals?withdrawalId=${encodeURIComponent(issue.withdrawalRequestId)}`}
                        style={{ color: "#0ea5e9", fontWeight: 600 }}
                      >
                        Request {shortId(issue.withdrawalRequestId)}
                      </Link>
                    ) : null}
                    {issue.transactionId ? (
                      <Link
                        href={`/transactions/${encodeURIComponent(issue.transactionId)}`}
                        style={{ color: "#0ea5e9", fontWeight: 600 }}
                      >
                        Transaction {shortId(issue.transactionId)}
                      </Link>
                    ) : null}
                    {issue.status ? <span>Status: {issue.status}</span> : null}
                    {issue.userId ? <span>User: {shortId(issue.userId)}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
