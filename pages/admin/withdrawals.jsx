import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import AuditTimelineEmbed from "../../components/admin/AuditTimelineEmbed";
import { notifyUserWithdrawalStatusChange } from "../../lib/withdrawalRequests";
import { appendAuditEvent } from "../../lib/auditTimeline";
import { logAdminAuditEvent } from "../../lib/adminAudit";
import {
  buildWithdrawalComplianceContext,
  fetchKycLimitPolicies,
  fetchKycStatusMapForUsers,
  fetchWithdrawalDailyUsageMapForUsers,
} from "../../lib/kycRisk";
import {
  buildPayPalPayoutReadiness,
  getPublicPayPalPayoutReadiness,
} from "../../lib/paypalPayoutReadiness";

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

function shortUuid(id) {
  if (!id || typeof id !== "string") return "—";
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function userLabel(profile, userId) {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  if (profile?.email?.trim()) return profile.email.trim();
  return userId || "—";
}

function statusBadgeStyle(status) {
  const v = String(status || "").toLowerCase();
  if (v === "pending") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fffbeb",
      color: "#9a3412",
      border: "1px solid #fcd34d",
    };
  }
  if (v === "processing") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#eff6ff",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }
  if (v === "paid") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#ecfdf5",
      color: "#047857",
      border: "1px solid #a7f3d0",
    };
  }
  if (v === "rejected") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#f1f5f9",
      color: "#475569",
      border: "1px solid #cbd5e1",
    };
  }
  if (v === "failed") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
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
    background: "#f1f5f9",
    color: "#64748b",
    border: "1px solid #e2e8f0",
  };
}

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
  padding: "0.55rem 0.65rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "0.85rem",
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  background: "#f4f6f9",
  color: "#0f172a",
};

const btnSm = {
  padding: "0.35rem 0.6rem",
  fontSize: "0.72rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
  marginRight: "0.35rem",
  marginTop: "0.35rem",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
};

const adminFocusCss = `
  .tc-admin-in:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .tc-admin-in::placeholder { color: #94a3b8; }
  .tc-withdrawal-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem 1.25rem;
  }
  @media (max-width: 560px) {
    .tc-withdrawal-detail-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .tc-withdrawal-actions-primary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .tc-withdrawal-actions-secondary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.5rem;
    padding-top: 0.65rem;
    border-top: 1px solid #f1f5f9;
  }
`;

function payoutLabelCell(r) {
  const t = r?.payout_label != null ? String(r.payout_label).trim() : "";
  return t || "No payout label";
}

const PAID_VIA_OPTIONS = ["PayPal", "Bank transfer", "Cash", "Other"];

function readinessStatusStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === "ready") return { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" };
  if (key === "partial") return { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" };
  return { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" };
}

function adminStatusDisplay(row) {
  const v = String(row?.status || "").toLowerCase();
  const processor = String(row?.processor || "").toLowerCase();
  if (v === "pending") return "Pending review";
  if (v === "processing") {
    if (processor === "paypal" && row?.processor_batch_id) return "Processing — PayPal batch sent";
    return "Processing";
  }
  if (v === "paid") {
    if (processor === "manual") return "Paid — manual external payment recorded";
    if (processor === "paypal") return "Paid — PayPal confirmed";
    return "Paid";
  }
  if (v === "rejected") return "Rejected";
  if (v === "failed") return "Failed — PayPal error";
  return v ? String(row?.status || "") : "—";
}

function PayPalPayoutReadinessPanel({ readiness, loading, onRefresh }) {
  if (loading && !readiness) {
    return (
      <div style={{ ...cardBase, padding: "1rem", marginBottom: "1.25rem" }}>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Loading PayPal payout readiness…</p>
      </div>
    );
  }
  if (!readiness) return null;

  const actionPal = readinessStatusStyle(readiness.payoutActionAvailable ? "ready" : "missing");

  return (
    <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>PayPal Payout readiness</h2>
        {onRefresh ? (
          <button type="button" onClick={() => void onRefresh()} style={{ ...btnSm, marginTop: 0 }}>
            Re-check env
          </button>
        ) : null}
      </div>
      <p style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.45 }}>
        Presence checks only — secret values are never displayed. Payouts are never sent automatically on user submit.
      </p>
      <div
        style={{
          marginBottom: "0.85rem",
          padding: "0.65rem 0.85rem",
          borderRadius: "8px",
          border: `1px solid ${actionPal.border}`,
          background: actionPal.bg,
        }}
      >
        <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: actionPal.fg }}>
          Send payout (PayPal): {readiness.payoutActionAvailable ? "Available" : "Unavailable"}
        </p>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#475569" }}>
          Mode: <strong>{readiness.mode}</strong>
          {" · "}
          Automation: <strong>{readiness.automationEnabled ? "enabled" : "disabled"}</strong>
        </p>
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        {readiness.checks.map((check) => {
          const pal = readinessStatusStyle(check.status);
          return (
            <li
              key={check.id}
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.35rem 0.75rem",
                alignItems: "baseline",
                fontSize: "0.8rem",
                padding: "0.4rem 0.5rem",
                borderRadius: "6px",
                background: "#fafbfc",
                border: "1px solid #e2e8f0",
              }}
            >
              <span style={{ fontWeight: 600, color: "#0f172a", minWidth: "11rem" }}>{check.label}</span>
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "999px",
                  background: pal.bg,
                  color: pal.fg,
                  border: `1px solid ${pal.border}`,
                }}
              >
                {check.status}
              </span>
              <span style={{ color: "#64748b", flex: "1 1 12rem" }}>{check.detail}</span>
            </li>
          );
        })}
      </ul>
      {readiness.blockers.length > 0 ? (
        <div style={{ marginTop: "0.75rem", padding: "0.65rem 0.85rem", borderRadius: "8px", background: "#fffbeb", border: "1px solid #fde68a" }}>
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.78rem", fontWeight: 700, color: "#92400e" }}>To enable PayPal payouts</p>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.78rem", color: "#92400e", lineHeight: 1.45 }}>
            {readiness.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ManualPayoutModal({ form, onChange, onClose, onSubmit, submitting }) {
  if (!form?.open) return null;
  const canSubmit =
    form.confirmed &&
    String(form.reference || "").trim().length >= 3 &&
    PAID_VIA_OPTIONS.includes(String(form.paidVia || "").trim());

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-payout-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: "rgba(15, 23, 42, 0.45)",
      }}
      onClick={onClose}
    >
      <div
        style={{ ...cardBase, maxWidth: "28rem", width: "100%", padding: "1.25rem", boxShadow: "0 20px 50px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="manual-payout-title" style={{ margin: "0 0 0.5rem", fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
          Record manual external payout
        </h2>
        <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.45 }}>
          Use only after payment was completed <strong>outside</strong> Tropicash. This marks the withdrawal paid in the
          app — it does not send money.
        </p>
        <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
          Paid via
          <select
            className="tc-admin-in"
            value={form.paidVia}
            onChange={(e) => onChange({ paidVia: e.target.value })}
            style={{ display: "block", width: "100%", marginTop: "0.35rem", padding: "0.45rem 0.55rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          >
            {PAID_VIA_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.82rem", fontWeight: 600, color: "#334155" }}>
          External reference / receipt / transaction ID
          <input
            className="tc-admin-in"
            type="text"
            value={form.reference}
            onChange={(e) => onChange({ reference: e.target.value })}
            placeholder="PayPal txn ID, bank ref, receipt #…"
            style={{ display: "block", width: "100%", marginTop: "0.35rem", padding: "0.45rem 0.55rem", borderRadius: "8px", border: "1px solid #cbd5e1", boxSizing: "border-box" }}
          />
        </label>
        <label style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", marginBottom: "1rem", fontSize: "0.82rem", color: "#334155", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!!form.confirmed}
            onChange={(e) => onChange({ confirmed: e.target.checked })}
            style={{ marginTop: "0.2rem" }}
          />
          <span>I confirm this withdrawal was paid outside Tropicash.</span>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "flex-end" }}>
          <button type="button" onClick={onClose} style={{ ...btnSm, marginTop: 0 }} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit || submitting}
            onClick={() => void onSubmit()}
            style={{
              ...btnSm,
              marginTop: 0,
              border: "1px solid #15803d",
              background: canSubmit ? "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)" : "#e2e8f0",
              color: canSubmit ? "#fff" : "#94a3b8",
              fontWeight: 700,
            }}
          >
            {submitting ? "Saving…" : "Record manual payout"}
          </button>
        </div>
      </div>
    </div>
  );
}

const STALE_PENDING_MS = 24 * 60 * 60 * 1000;
const LARGE_WITHDRAWAL_USD = 200;

/** Visual hints only — does not change workflow. */
function withdrawalUrgencyChips(row, queueByUser) {
  const st = String(row?.status || "").toLowerCase();
  const chips = [];
  if (st === "pending" && row?.created_at) {
    const t = new Date(row.created_at).getTime();
    if (!Number.isNaN(t) && Date.now() - t > STALE_PENDING_MS) {
      chips.push({ key: "stale", label: ">24h pending", style: { background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca" } });
    }
  }
  const amt = Number(row?.amount);
  if (Number.isFinite(amt) && amt >= LARGE_WITHDRAWAL_USD) {
    chips.push({ key: "large", label: "Large amount", style: { background: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d" } });
  }
  const uid = row?.user_id;
  const q = uid ? queueByUser[uid]?.pending ?? 0 : 0;
  if (uid && q >= 2) {
    chips.push({
      key: "repeat",
      label: "Multiple in queue",
      style: { background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1" },
    });
  }
  return chips;
}

function WithdrawalDetail({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: "0.68rem",
          fontWeight: 600,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: "0.25rem",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "0.875rem", color: "#0f172a", wordBreak: "break-word", lineHeight: 1.45 }}>{children}</div>
    </div>
  );
}

const preErrorBox = {
  margin: "0.5rem 0 0",
  padding: "0.65rem 0.75rem",
  borderRadius: "8px",
  background: "#fff",
  border: "1px solid #fecaca",
  fontSize: "0.75rem",
  lineHeight: 1.45,
  overflowX: "auto",
  maxWidth: "100%",
  boxSizing: "border-box",
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

function PayPalPayoutErrorView({ error }) {
  if (!error || typeof error !== "object") return null;
  const name = error.name != null ? String(error.name) : null;
  const message = error.message != null ? String(error.message) : null;
  const details = error.details;
  const fullBody =
    error.fullResponseBody && typeof error.fullResponseBody === "object" ? error.fullResponseBody : null;
  const httpStatus = error.httpStatus != null ? error.httpStatus : null;
  const phase = error.phase != null ? String(error.phase) : null;

  let detailsStr = null;
  if (details !== undefined && details !== null) {
    try {
      detailsStr = typeof details === "string" ? details : JSON.stringify(details, null, 2);
    } catch {
      detailsStr = String(details);
    }
  }

  let fullStr = null;
  if (fullBody && Object.keys(fullBody).length > 0) {
    try {
      fullStr = JSON.stringify(fullBody, null, 2);
    } catch {
      fullStr = null;
    }
  }

  return (
    <div style={{ fontSize: "0.84rem", color: "#7f1d1d", lineHeight: 1.5 }}>
      {(httpStatus != null || phase) && (
        <p style={{ margin: "0 0 0.35rem", fontSize: "0.78rem", color: "#991b1b" }}>
          {httpStatus != null ? `HTTP ${httpStatus}` : ""}
          {httpStatus != null && phase ? " · " : ""}
          {phase || ""}
        </p>
      )}
      {name ? (
        <p style={{ margin: "0 0 0.35rem", fontWeight: 800, fontFamily: preErrorBox.fontFamily, color: "#450a0a" }}>{name}</p>
      ) : null}
      {message ? <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>{message}</p> : null}
      {detailsStr ? (
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#991b1b", marginBottom: "0.2rem" }}>Details</div>
          <pre style={preErrorBox}>{detailsStr}</pre>
        </div>
      ) : null}
      {fullStr ? (
        <div style={{ marginTop: detailsStr ? "0.65rem" : 0 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#991b1b", marginBottom: "0.2rem" }}>Full PayPal response</div>
          <pre style={preErrorBox}>{fullStr}</pre>
        </div>
      ) : null}
    </div>
  );
}

function parseFailureReasonString(failureReason) {
  if (failureReason == null) return null;
  const s = String(failureReason).trim();
  if (!s) return null;
  if (s.startsWith("{")) {
    try {
      const o = JSON.parse(s);
      if (o && typeof o === "object" && !Array.isArray(o)) {
        const looksPayPal =
          "fullResponseBody" in o ||
          "details" in o ||
          (o.name != null && String(o.name).length > 0) ||
          (o.message != null && String(o.message).length > 0);
        if (looksPayPal) return { kind: "paypal", payload: o };
      }
    } catch {
      return { kind: "text", text: s };
    }
  }
  return { kind: "text", text: s };
}

function WithdrawalFailurePanel({ failureReason }) {
  const parsed = parseFailureReasonString(failureReason);
  if (!parsed) return null;

  return (
    <div
      style={{
        marginBottom: "1rem",
        padding: "1rem 1.05rem",
        borderRadius: "12px",
        border: "1px solid #fecaca",
        background: "linear-gradient(180deg, #fef2f2 0%, #fff5f5 100%)",
        boxSizing: "border-box",
        maxWidth: "100%",
      }}
    >
      <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.65rem" }}>
        Payout error
      </div>
      {parsed.kind === "paypal" ? (
        <PayPalPayoutErrorView error={parsed.payload} />
      ) : (
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#7f1d1d", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{parsed.text}</p>
      )}
    </div>
  );
}

function kycStatusChipStyle(status) {
  const s = String(status || "missing").toLowerCase();
  if (s === "approved") return { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" };
  if (s === "rejected") return { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" };
  if (s === "needs_more_info") return { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" };
  if (s === "pending") return { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" };
  return { bg: "#f1f5f9", fg: "#475569", border: "#e2e8f0" };
}

function WithdrawalCompliancePanel({ row, compliance }) {
  if (!row || !compliance) return null;
  const st = String(row.status || "").toLowerCase();
  const showReviewWarning = compliance.needsKycReview;

  return (
    <div
      style={{
        marginTop: "0.75rem",
        padding: "0.75rem 0.85rem",
        borderRadius: "10px",
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
      }}
    >
      <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Compliance context
      </p>
      <div className="tc-withdrawal-detail-grid" style={{ marginTop: 0 }}>
        <WithdrawalDetail label="User ID">
          <span style={{ fontFamily: "monospace", fontSize: "0.78rem" }}>{row.user_id || "—"}</span>
        </WithdrawalDetail>
        <WithdrawalDetail label="Amount">{formatMoney(row.amount)}</WithdrawalDetail>
        <WithdrawalDetail label="Withdrawal status">{st || "—"}</WithdrawalDetail>
        <WithdrawalDetail label="KYC status">{compliance.kycStatus}</WithdrawalDetail>
        <WithdrawalDetail label="Verification tier">{compliance.verificationTier}</WithdrawalDetail>
        <WithdrawalDetail label="KYC risk level">{compliance.kycRiskLevel}</WithdrawalDetail>
        <WithdrawalDetail label="Withdrawal daily limit">{formatMoney(compliance.withdrawalDailyLimit)}</WithdrawalDetail>
        <WithdrawalDetail label="Used today">{formatMoney(compliance.usedToday)}</WithdrawalDetail>
        <WithdrawalDetail label="Remaining today">
          {compliance.remainingToday != null ? formatMoney(compliance.remainingToday) : "—"}
        </WithdrawalDetail>
        <WithdrawalDetail label="Projected total">{formatMoney(compliance.projectedTotal)}</WithdrawalDetail>
        <WithdrawalDetail label="Enforcement mode">{compliance.enforcementMode}</WithdrawalDetail>
        <WithdrawalDetail label="Exceeds KYC limit">{compliance.exceedsLimit ? "Yes" : "No"}</WithdrawalDetail>
        <WithdrawalDetail label="Would block if enforced">{compliance.wouldBlockIfEnforced ? "Yes" : "No"}</WithdrawalDetail>
      </div>
      {showReviewWarning ? (
        <p style={{ margin: "0.65rem 0 0", fontSize: "0.82rem", color: "#b45309", lineHeight: 1.45 }}>
          KYC is not approved ({compliance.kycStatus}). Review identity verification before settlement.
        </p>
      ) : null}
      <Link
        href="/admin/kyc"
        style={{ display: "inline-block", marginTop: "0.65rem", fontSize: "0.82rem", fontWeight: 600, color: "#0369a1" }}
      >
        Open KYC review queue →
      </Link>
    </div>
  );
}

function ComplianceCautionBanner() {
  return (
    <div
      role="status"
      style={{
        marginTop: "0.75rem",
        padding: "0.65rem 0.85rem",
        borderRadius: "8px",
        border: "1px solid #fde68a",
        background: "#fffbeb",
        color: "#92400e",
        fontSize: "0.84rem",
        lineHeight: 1.45,
      }}
    >
      Compliance caution: this withdrawal may require KYC review before settlement.
    </div>
  );
}

export default function AdminWithdrawalsPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useUser();
  const [rows, setRows] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [kycMap, setKycMap] = useState({});
  const [kycPoliciesByStatus, setKycPoliciesByStatus] = useState({});
  const [dailyUsageByUserId, setDailyUsageByUserId] = useState({});
  const [dataLoading, setDataLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [fetchErrorDetails, setFetchErrorDetails] = useState(null);
  const [payoutSuccessMessage, setPayoutSuccessMessage] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [payoutRetryLoadingId, setPayoutRetryLoadingId] = useState(null);
  const [adminNotesDraft, setAdminNotesDraft] = useState({});
  const [withdrawalAuditOpenId, setWithdrawalAuditOpenId] = useState(null);
  const [payoutReadiness, setPayoutReadiness] = useState(null);
  const [payoutReadinessLoading, setPayoutReadinessLoading] = useState(false);
  const [manualPayoutForm, setManualPayoutForm] = useState(null);
  const [refundOnRejectById, setRefundOnRejectById] = useState({});
  const [refundSuccessMessage, setRefundSuccessMessage] = useState(null);

  const loadPayoutReadiness = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setPayoutReadinessLoading(true);
    const publicPart = getPublicPayPalPayoutReadiness();
    try {
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !sessionData?.session?.access_token) {
        setPayoutReadiness(buildPayPalPayoutReadiness(publicPart, null));
        return;
      }
      const res = await fetch("/api/admin/withdrawals/payout-readiness", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });
      const serverPart = res.ok ? await res.json().catch(() => null) : { error: `HTTP ${res.status}` };
      setPayoutReadiness(buildPayPalPayoutReadiness(publicPart, serverPart));
    } catch (err) {
      setPayoutReadiness(
        buildPayPalPayoutReadiness(publicPart, { error: err?.message || "Server probe failed" }),
      );
    } finally {
      setPayoutReadinessLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void loadPayoutReadiness();
  }, [authLoading, user, profile, loadPayoutReadiness]);

  useEffect(() => {
    if (!router.isReady) return;
    const w = router.query.withdrawalId;
    if (typeof w === "string" && w.trim()) setWithdrawalAuditOpenId(w.trim());
  }, [router.isReady, router.query.withdrawalId]);

  const fetchRows = useCallback(async () => {
    if (!user?.id) return;
    setDataLoading(true);
    setFetchError(null);
    setFetchErrorDetails(null);

    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[admin/withdrawals] fetch:", error);
      setFetchError(error.message || "Failed to load withdrawal requests.");
      setFetchErrorDetails({
        message: error.message ?? null,
        code: error.code ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      });
      setDataLoading(false);
      return;
    }

    const list = Array.isArray(data) ? data : [];
    setRows(list);

    const draft = {};
    list.forEach((r) => {
      if (r && r.id) {
        draft[r.id] = r.admin_note != null ? String(r.admin_note) : "";
      }
    });
    setAdminNotesDraft(draft);

    const ids = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
    if (ids.length === 0) {
      setProfilesMap({});
      setKycMap({});
      setKycPoliciesByStatus({});
      setDailyUsageByUserId({});
      setDataLoading(false);
      return;
    }

    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, email, created_at")
      .in("id", ids);

    if (pErr) {
      console.error("[admin/withdrawals] profiles:", pErr);
      setProfilesMap({});
    } else {
      setProfilesMap(Object.fromEntries((profs || []).map((p) => [p.id, p])));
    }

    try {
      const kycStatusMap = await fetchKycStatusMapForUsers(ids);
      setKycMap(kycStatusMap || {});
    } catch (kycErr) {
      console.warn("[admin/withdrawals] KYC status fetch failed:", kycErr?.message || kycErr);
      setKycMap({});
    }

    try {
      const { data: policies } = await fetchKycLimitPolicies();
      setKycPoliciesByStatus(Object.fromEntries((policies || []).map((p) => [p.kyc_status, p])));
    } catch (policyErr) {
      console.warn("[admin/withdrawals] KYC policy fetch failed:", policyErr?.message || policyErr);
      setKycPoliciesByStatus({});
    }

    try {
      const usageMap = await fetchWithdrawalDailyUsageMapForUsers(ids);
      setDailyUsageByUserId(usageMap || {});
    } catch (usageErr) {
      console.warn("[admin/withdrawals] daily usage fetch failed:", usageErr?.message || usageErr);
      setDailyUsageByUserId({});
    }

    setDataLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, profile)) return;
    void fetchRows();
  }, [authLoading, user?.id, user, profile, fetchRows]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const tb = new Date(b?.created_at || 0).getTime();
      const ta = new Date(a?.created_at || 0).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
  }, [rows]);

  const pendingCount = useMemo(() => {
    return rows.filter((r) => String(r.status || "").toLowerCase() === "pending").length;
  }, [rows]);

  const userWithdrawalCounts = useMemo(() => {
    const map = {};
    for (const r of rows) {
      const uid = r?.user_id;
      if (!uid) continue;
      const st = String(r?.status || "").toLowerCase();
      if (!map[uid]) map[uid] = { pending: 0, failed: 0 };
      if (st === "pending" || st === "processing") map[uid].pending += 1;
      if (st === "failed") map[uid].failed += 1;
    }
    return map;
  }, [rows]);

  const complianceByWithdrawalId = useMemo(() => {
    const map = {};
    for (const row of rows) {
      if (!row?.id) continue;
      const kycStatus = kycMap[row.user_id] || "missing";
      const policy = kycPoliciesByStatus[kycStatus] || kycPoliciesByStatus.missing || null;
      map[row.id] = buildWithdrawalComplianceContext({
        kycStatus,
        amount: row.amount,
        policy,
        usedToday: dailyUsageByUserId[row.user_id] ?? 0,
      });
    }
    return map;
  }, [rows, kycMap, kycPoliciesByStatus, dailyUsageByUserId]);

  const setNoteDraft = (id, value) => {
    setAdminNotesDraft((prev) => ({ ...prev, [id]: value }));
  };

  /**
   * @param {{ id: string; user_id: string; amount?: unknown }} row
   * @param {Record<string, unknown>} patch
   * @param {'processing' | 'paid' | 'rejected' | null} notifyKind
   * @param {ReturnType<typeof buildWithdrawalComplianceContext> | undefined} compliance
   */
  async function logComplianceCautionAcknowledged(row, compliance) {
    if (!row?.id || !compliance?.showComplianceCaution) return;
    try {
      await logAdminAuditEvent({
        actorUserId: user?.id,
        targetUserId: row.user_id,
        action: "withdrawal_compliance_caution_acknowledged",
        category: "withdrawal",
        severity: "info",
        description: "Admin proceeded with withdrawal action despite compliance caution.",
        metadata: {
          withdrawal_request_id: row.id,
          user_id: row.user_id,
          amount: row.amount,
          kyc_status: compliance.kycStatus,
          enforcement_mode: compliance.enforcementMode,
        },
      });
    } catch (auditErr) {
      console.warn("[admin/withdrawals] compliance audit log failed:", auditErr?.message || auditErr);
    }
  }

  const runUpdate = async (row, patch, notifyKind, compliance) => {
    const id = row?.id;
    if (!id) return false;
    setActionBusyId(id);
    setFetchError(null);
    setFetchErrorDetails(null);
    const nowIso = new Date().toISOString();
    const mergedPatch = {
      ...patch,
      updated_at: nowIso,
      processed_at: nowIso,
      processed_by: user?.id ?? null,
    };
    const { error } = await supabase.from("withdrawal_requests").update(mergedPatch).eq("id", id);
    if (error) {
      const manualKeys = ["manual_payout_reference", "manual_payout_confirmed_at", "manual_payout_confirmed_by"];
      const hasManualFields = manualKeys.some((k) => mergedPatch[k] !== undefined);
      const looksLikeMissingColumn =
        hasManualFields &&
        (String(error.message || "").toLowerCase().includes("manual_payout") ||
          String(error.code || "") === "PGRST204");
      if (looksLikeMissingColumn) {
        const fallbackPatch = { ...mergedPatch };
        for (const k of manualKeys) delete fallbackPatch[k];
        const { error: retryErr } = await supabase.from("withdrawal_requests").update(fallbackPatch).eq("id", id);
        if (!retryErr) {
          console.warn(
            "[admin/withdrawals] manual payout columns missing — saved external_reference only. Apply phase_13b_manual_payout_confirmation.sql.",
          );
        } else {
          console.error("[admin/withdrawals] update failed:", retryErr);
          setFetchError(retryErr.message || "Update failed.");
          setFetchErrorDetails({
            message: retryErr.message ?? null,
            code: retryErr.code ?? null,
            details: retryErr.details ?? null,
            hint: retryErr.hint ?? null,
          });
          setActionBusyId(null);
          return false;
        }
      } else {
        console.error("[admin/withdrawals] update failed:", error);
        setFetchError(error.message || "Update failed.");
        setFetchErrorDetails({
          message: error.message ?? null,
          code: error.code ?? null,
          details: error.details ?? null,
          hint: error.hint ?? null,
        });
        setActionBusyId(null);
        return false;
      }
    }
    if (patch.status != null) {
      const prevStatus = String(row.status || "").toLowerCase();
      const nextStatus = String(patch.status || "").toLowerCase();
      void appendAuditEvent({
        entityType: "withdrawal",
        entityId: id,
        eventType: "withdrawal.status_changed",
        actorUserId: user?.id ?? null,
        targetUserId: row.user_id ?? null,
        severity: "info",
        title: "Withdrawal status changed",
        description: `${prevStatus} → ${nextStatus}`,
        metadata: { from_status: prevStatus, to_status: nextStatus },
        dedupeKey: `audit:withdrawal:${id}:${prevStatus}:${nextStatus}`,
        dedupeWindowMs: 5 * 60 * 1000,
      });
    }
    if (notifyKind && row?.user_id) {
      try {
        await notifyUserWithdrawalStatusChange({
          userId: row.user_id,
          amount: Number(row.amount),
          kind: notifyKind,
          paidVia: mergedPatch.paid_via != null ? String(mergedPatch.paid_via) : null,
          externalReference: mergedPatch.external_reference != null ? String(mergedPatch.external_reference) : null,
          rejectionReason: mergedPatch.rejection_reason != null ? String(mergedPatch.rejection_reason) : null,
        });
      } catch (notifErr) {
        console.error("[admin/withdrawals] user notification failed (non-blocking):", notifErr);
      }
    }
    if (notifyKind === "processing" || notifyKind === "paid") {
      await logComplianceCautionAcknowledged(row, compliance);
    }
    await fetchRows();
    setActionBusyId(null);
    return true;
  };

  const refundOutcomeMessage = (body) => {
    const outcome = String(body?.outcome || "").toLowerCase();
    if (outcome === "refunded") {
      const amt = body?.amount != null ? `$${formatMoney(body.amount)}` : "Funds";
      return `${amt} refunded to user wallet.`;
    }
    if (outcome === "already_refunded") return "Wallet was already refunded for this withdrawal.";
    return "Refund request completed.";
  };

  const postAdminRefund = async (id, reason) => {
    const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
    if (sessErr || !sessionData?.session?.access_token) {
      setFetchError("Could not read your session. Sign in again.");
      setFetchErrorDetails(null);
      return { ok: false };
    }
    const res = await fetch(`/api/admin/withdrawals/${encodeURIComponent(id)}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason: reason || null }),
    });
    const responseJson = await res.json().catch(() => ({}));
    await fetchRows();
    if (!res.ok) {
      setFetchError(responseJson?.error || responseJson?.message || `Refund failed (${res.status})`);
      setFetchErrorDetails(responseJson?.outcome ? { source: "api", payload: responseJson } : null);
      return { ok: false, body: responseJson };
    }
    setFetchError(null);
    setFetchErrorDetails(null);
    return { ok: true, body: responseJson };
  };

  const handleMarkProcessing = (r) => {
    void runUpdate(r, { status: "processing" }, "processing", complianceByWithdrawalId[r.id]);
  };

  const openManualPayoutModal = (row) => {
    if (!row?.id) return;
    setManualPayoutForm({
      open: true,
      row,
      paidVia: "PayPal",
      reference: "",
      confirmed: false,
    });
  };

  const submitManualPayout = async () => {
    const form = manualPayoutForm;
    if (!form?.open || !form.row?.id) return;
    if (!form.confirmed) {
      window.alert("Confirm that payment was completed outside Tropicash.");
      return;
    }
    const externalRefTrim = String(form.reference || "").trim();
    if (externalRefTrim.length < 3) {
      window.alert("External reference is required (min 3 characters).");
      return;
    }
    const paidVia = String(form.paidVia || "").trim();
    if (!PAID_VIA_OPTIONS.includes(paidVia)) {
      window.alert(`Invalid paid via. Use one of: ${PAID_VIA_OPTIONS.join(", ")}.`);
      return;
    }
    const nowIso = new Date().toISOString();
    setManualPayoutForm((prev) => (prev ? { ...prev, submitting: true } : prev));
    await runUpdate(
      form.row,
      {
        status: "paid",
        paid_at: nowIso,
        paid_via: paidVia,
        external_reference: externalRefTrim,
        manual_payout_reference: externalRefTrim,
        manual_payout_confirmed_at: nowIso,
        manual_payout_confirmed_by: user?.id ?? null,
        processor: "manual",
        processor_status: "recorded_manual",
      },
      "paid",
      complianceByWithdrawalId[form.row.id],
    );
    setManualPayoutForm(null);
  };

  const postAdminPayout = async (id, { retry }) => {
    if (!payoutReadiness?.payoutActionAvailable) {
      const msg =
        payoutReadiness?.blockers?.[0] ||
        "PayPal payout is unavailable. Check the readiness panel and environment configuration.";
      setFetchError(msg);
      setFetchErrorDetails(null);
      return false;
    }
    const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
    if (sessErr || !sessionData?.session?.access_token) {
      setFetchError("Could not read your session. Sign in again.");
      setFetchErrorDetails(null);
      return false;
    }
    const res = await fetch(`/api/admin/withdrawals/${encodeURIComponent(id)}/payout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ retry }),
    });
    const responseJson = await res.json().catch(() => ({}));
    await fetchRows();
    if (!res.ok) {
      if (retry) {
        console.error("[WITHDRAWAL_RETRY_PAYOUT_ERROR]", responseJson);
      }
      const errLine =
        responseJson?.summary && typeof responseJson.summary === "string"
          ? `${responseJson.error || "Payout failed"}: ${responseJson.summary}`
          : responseJson?.error || `Payout failed (${res.status})`;
      setFetchError(errLine);
      if (responseJson?.details && typeof responseJson.details === "object") {
        setFetchErrorDetails({ source: "paypal", payload: responseJson.details });
      } else if (responseJson && typeof responseJson === "object" && Object.keys(responseJson).length > 0) {
        setFetchErrorDetails({ source: "api", payload: responseJson });
      } else {
        setFetchErrorDetails(null);
      }
      return false;
    }
    setFetchError(null);
    setFetchErrorDetails(null);
    return { ok: true, body: responseJson };
  };

  const payoutOutcomeMessage = (body) => {
    const st = String(body?.status || "").toLowerCase();
    const batchNote = body?.batchId ? ` Batch ID: ${body.batchId}.` : "";
    if (st === "paid") return "Paid — PayPal confirmed. The list has been refreshed.";
    if (st === "processing") {
      return `Processing — PayPal batch sent.${batchNote} Use Check status or webhooks before treating as settled.`;
    }
    if (st === "failed") return "Failed — PayPal error. Review failure details on the request.";
    return "Payout API completed. The list has been refreshed.";
  };

  const handleSendPayout = async (r) => {
    if (!payoutReadiness?.payoutActionAvailable) {
      setFetchError(
        payoutReadiness?.blockers?.[0] ||
          "PayPal payout is unavailable. Enable NEXT_PUBLIC_WITHDRAWAL_AUTOMATED_PAYOUT and server PayPal credentials.",
      );
      return;
    }
    const id = r?.id;
    if (!id) return;
    const ok = window.confirm(
      "Confirm you want to send this payout through PayPal. This will move funds using the connected payout processor. Continue?",
    );
    if (!ok) return;
    setActionBusyId(id);
    setFetchError(null);
    setFetchErrorDetails(null);
    setPayoutSuccessMessage(null);
    try {
      const result = await postAdminPayout(id, { retry: false });
      if (result?.ok) {
        setPayoutSuccessMessage(payoutOutcomeMessage(result.body));
      }
    } catch (err) {
      console.error("[admin/withdrawals] payout fetch failed:", err);
      setFetchError(err?.message || "Payout request failed.");
      setFetchErrorDetails(null);
    }
    setActionBusyId(null);
  };

  const handleRetryPayout = async (r) => {
    if (!payoutReadiness?.payoutActionAvailable) {
      setFetchError(payoutReadiness?.blockers?.[0] || "PayPal payout is unavailable.");
      return;
    }
    const id = r?.id;
    if (!id) return;
    const ok = window.confirm(
      "Submit a new PayPal batch for this failed withdrawal? Use only if the previous attempt will not complete.",
    );
    if (!ok) return;
    setPayoutRetryLoadingId(id);
    setActionBusyId(id);
    setFetchError(null);
    setFetchErrorDetails(null);
    setPayoutSuccessMessage(null);
    try {
      const result = await postAdminPayout(id, { retry: true });
      if (result?.ok) {
        setPayoutSuccessMessage(payoutOutcomeMessage(result.body));
      }
    } catch (err) {
      console.error("[admin/withdrawals] retry payout failed:", err);
      setFetchError(err?.message || "Retry payout failed.");
      setFetchErrorDetails(null);
    } finally {
      setPayoutRetryLoadingId(null);
      setActionBusyId(null);
    }
  };

  const handleCheckPayoutStatus = async (r) => {
    if (!payoutReadiness?.automationEnabled) return;
    const id = r?.id;
    if (!id) return;
    setActionBusyId(id);
    setFetchError(null);
    setFetchErrorDetails(null);
    try {
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !sessionData?.session?.access_token) {
        setFetchError("Could not read your session. Sign in again.");
        setActionBusyId(null);
        return;
      }
      const res = await fetch(`/api/admin/withdrawals/${encodeURIComponent(id)}/reconcile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFetchError(body?.error || `Reconcile failed (${res.status})`);
        setActionBusyId(null);
        return;
      }
      await fetchRows();
    } catch (err) {
      console.error("[admin/withdrawals] reconcile failed:", err);
      setFetchError(err?.message || "Could not check payout status.");
    }
    setActionBusyId(null);
  };

  const handleReject = async (r) => {
    const id = r?.id;
    if (!id) return;
    const note = String(adminNotesDraft[id] || "").trim();
    if (!note) {
      window.alert("Add an admin note before rejecting (reason for the user / internal record).");
      return;
    }
    const refundWallet = refundOnRejectById[id] !== false;
    const ok = await runUpdate(
      r,
      {
        status: "rejected",
        admin_note: note,
        rejection_reason: note,
        paid_at: null,
        paid_via: null,
        external_reference: null,
      },
      "rejected",
    );
    if (!ok) return;
    if (!refundWallet) {
      setRefundSuccessMessage(null);
      return;
    }
    setActionBusyId(id);
    setRefundSuccessMessage(null);
    try {
      const result = await postAdminRefund(id, note);
      if (result.ok) {
        setRefundSuccessMessage(refundOutcomeMessage(result.body));
      }
    } catch (err) {
      console.error("[admin/withdrawals] reject refund failed:", err);
      setFetchError(err?.message || "Rejection saved but wallet refund failed.");
    }
    setActionBusyId(null);
  };

  const handleRefundWallet = async (r) => {
    const id = r?.id;
    if (!id) return;
    const st = String(r?.status || "").toLowerCase();
    if (st !== "failed" && st !== "rejected") {
      setFetchError("Only rejected or failed withdrawals can be refunded.");
      return;
    }
    if (r?.refunded_at) {
      setRefundSuccessMessage("Wallet was already refunded for this withdrawal.");
      return;
    }
    const reason =
      st === "rejected"
        ? String(r?.rejection_reason || r?.admin_note || "").trim() || "Rejected withdrawal refund"
        : String(r?.failure_reason || "").trim() || "Failed payout refund";
    setActionBusyId(id);
    setRefundSuccessMessage(null);
    setFetchError(null);
    try {
      const result = await postAdminRefund(id, reason);
      if (result.ok) {
        setRefundSuccessMessage(refundOutcomeMessage(result.body));
      }
    } catch (err) {
      console.error("[admin/withdrawals] refund failed:", err);
      setFetchError(err?.message || "Wallet refund failed.");
    }
    setActionBusyId(null);
  };

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>Withdrawals</h1>
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
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.75rem" }}>Withdrawals</h1>
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
      <>
        <Navbar />
        <div style={pageWrap}>
          <h2 style={{ color: "#0f172a", marginTop: 0 }}>Admin access required.</h2>
          <p style={{ color: "#94a3b8" }}>This area is restricted to admin users.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: adminFocusCss }} />
      <Navbar />
      <div style={pageWrap}>
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href="/admin" style={{ color: "#38bdf8", fontWeight: 600, fontSize: "0.9rem" }}>
            ← Admin home
          </Link>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", marginBottom: "0.75rem" }}>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
            Withdrawal requests
          </h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#94a3b8" }}>
            Pending: <strong style={{ color: "#0f172a" }}>{pendingCount}</strong>
          </p>
        </div>

        <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "#64748b", lineHeight: 1.55, maxWidth: "42rem" }}>
          Users submit payout requests; their wallet is debited when the request is created. Pay them manually outside
          Tropicash, then mark the request <strong>processing</strong> while you work on it and <strong>paid</strong> when
          complete (with paid via + external reference). Reject if you will not pay out.
        </p>

        <PayPalPayoutReadinessPanel
          readiness={payoutReadiness}
          loading={payoutReadinessLoading}
          onRefresh={loadPayoutReadiness}
        />

        <div style={{ ...cardBase, padding: "0.85rem 1rem", marginBottom: "1.25rem" }}>
          <button type="button" onClick={() => void fetchRows()} disabled={dataLoading} style={{ ...btnSm, marginTop: 0 }}>
            {dataLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {payoutSuccessMessage ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem",
              marginBottom: "1rem",
              borderColor: "#6ee7b7",
              background: "#ecfdf5",
            }}
          >
            <p style={{ margin: 0, color: "#047857", fontSize: "0.9rem", fontWeight: 600 }}>{payoutSuccessMessage}</p>
          </div>
        ) : null}

        {refundSuccessMessage ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem",
              marginBottom: "1rem",
              borderColor: "#93c5fd",
              background: "#eff6ff",
            }}
          >
            <p style={{ margin: 0, color: "#1d4ed8", fontSize: "0.9rem", fontWeight: 600 }}>{refundSuccessMessage}</p>
          </div>
        ) : null}

        {fetchError ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", borderColor: "#fecaca", background: "#fef2f2" }}>
            <p style={{ margin: "0 0 0.5rem", color: "#991b1b", fontSize: "0.9rem", fontWeight: 700 }}>{fetchError}</p>
            {fetchErrorDetails?.source === "paypal" ? (
              <PayPalPayoutErrorView error={fetchErrorDetails.payload} />
            ) : fetchErrorDetails?.source === "api" ? (
              <pre style={{ ...preErrorBox, marginTop: "0.35rem" }}>
                {JSON.stringify(fetchErrorDetails.payload, null, 2)}
              </pre>
            ) : fetchErrorDetails ? (
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#7f1d1d", fontSize: "0.82rem", lineHeight: 1.5 }}>
                <li>code: {fetchErrorDetails.code != null ? String(fetchErrorDetails.code) : "—"}</li>
                <li>details: {fetchErrorDetails.details != null ? String(fetchErrorDetails.details) : "—"}</li>
                <li>hint: {fetchErrorDetails.hint != null ? String(fetchErrorDetails.hint) : "—"}</li>
                <li>message: {fetchErrorDetails.message != null ? String(fetchErrorDetails.message) : "—"}</li>
              </ul>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
          }}
        >
          {dataLoading && rows.length === 0 ? (
            <p style={{ color: "#64748b", margin: 0 }}>Loading requests…</p>
          ) : sortedRows.length === 0 ? (
            <div style={{ ...cardBase, padding: "2.5rem 1.5rem", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "0.95rem", color: "#64748b" }}>No withdrawal requests yet.</p>
            </div>
          ) : (
            sortedRows.map((r) => {
              const st = String(r?.status || "").toLowerCase();
              const busy = actionBusyId === r.id;
              const hasBatch = !!(r?.processor_batch_id && String(r.processor_batch_id).trim());
              const payoutEmail = String(r?.payout_email || r?.payout_destination || "").trim();
              const hasPayoutEmail = payoutEmail.length > 0;
              const payoutActionReady = !!payoutReadiness?.payoutActionAvailable;
              const automationOn = !!payoutReadiness?.automationEnabled;
              const payoutBlockerHint =
                payoutReadiness?.blockers?.length > 0
                  ? payoutReadiness.blockers.join(" ")
                  : "PayPal payout is unavailable. Check the readiness panel.";
              const showAutomatedSend =
                automationOn && st === "pending" && hasPayoutEmail && !hasBatch;
              const showAutomatedCheck = automationOn && st === "processing" && hasBatch;
              const showAutomatedRetry = automationOn && st === "failed";
              const isRefunded = !!r?.refunded_at;
              const showRefundWallet =
                (st === "failed" || st === "rejected") && !isRefunded;
              const canRecordManual = st !== "paid" && st !== "rejected";
              const canMarkProcessing = st === "pending";
              const p = profilesMap[r.user_id];
              const userCounts = userWithdrawalCounts[r.user_id] || { pending: 0, failed: 0 };
              const createdAt = p?.created_at ? new Date(String(p.created_at)) : null;
              const isNewUser =
                createdAt && !Number.isNaN(createdAt.getTime()) ? Date.now() - createdAt.getTime() < 7 * 24 * 60 * 60 * 1000 : false;
              const failureReasonRaw = r?.failure_reason != null ? String(r.failure_reason) : "";
              const proc = r?.processor != null ? String(r.processor).trim() : "";
              const procStatus = r?.processor_status != null ? String(r.processor_status).trim() : "";
              const paidVia = r?.paid_via != null ? String(r.paid_via).trim() : "";
              const extRef = r?.external_reference != null ? String(r.external_reference).trim() : "";
              const manualRef =
                r?.manual_payout_reference != null ? String(r.manual_payout_reference).trim() : "";
              const manualConfirmedAt = r?.manual_payout_confirmed_at;
              const manualConfirmedBy = r?.manual_payout_confirmed_by;
              const refundedAt = r?.refunded_at;
              const refundReason = r?.refund_reason != null ? String(r.refund_reason).trim() : "";
              const paidAt = r?.paid_at;
              const showPrimaryActions =
                showAutomatedSend ||
                showAutomatedCheck ||
                showAutomatedRetry ||
                showRefundWallet ||
                canRecordManual;
              const showSecondaryActions = canMarkProcessing || canRecordManual || (st !== "rejected" && st !== "paid");
              const compliance = complianceByWithdrawalId[r.id];
              const showComplianceCaution =
                compliance?.showComplianceCaution &&
                (canMarkProcessing || canRecordManual || showAutomatedSend);

              const btnBase = {
                padding: "0.5rem 0.9rem",
                fontSize: "0.8rem",
                borderRadius: "10px",
                fontWeight: 700,
                cursor: "pointer",
                boxSizing: "border-box",
              };
              const disabledStyle = busy ? { opacity: 0.55, cursor: "not-allowed" } : {};

              return (
                <div
                  key={r.id}
                  style={{
                    ...cardBase,
                    padding: "1.15rem 1.2rem",
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem 1rem",
                      marginBottom: "1rem",
                      paddingBottom: "1rem",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 700,
                        color: "#0f172a",
                        lineHeight: 1.3,
                        minWidth: 0,
                        flex: "1 1 12rem",
                      }}
                    >
                      {userLabel(p, r.user_id)}
                      <div style={{ marginTop: "0.35rem", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.35 }}>
                        {isNewUser ? (
                          <span style={{ display: "inline-block", marginRight: "0.5rem", fontWeight: 700, color: "#92400e" }}>New user</span>
                        ) : null}
                        <span style={{ display: "inline-block", marginRight: "0.5rem" }}>
                          In queue: <strong style={{ color: "#0f172a" }}>{userCounts.pending}</strong>
                        </span>
                        <span style={{ display: "inline-block", marginRight: "0.5rem" }}>
                          Failed: <strong style={{ color: "#0f172a" }}>{userCounts.failed}</strong>
                        </span>
                        {p?.email ? (
                          <span style={{ display: "inline-block", marginRight: "0.5rem", wordBreak: "break-all" }}>
                            Email: <strong style={{ color: "#0f172a", fontWeight: 600 }}>{String(p.email).trim()}</strong>
                          </span>
                        ) : null}
                        {payoutEmail ? (
                          <span style={{ display: "inline-block", wordBreak: "break-all" }}>
                            Payout destination: <strong style={{ color: "#0f172a", fontWeight: 600 }}>{payoutEmail}</strong>
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "0.65rem 0.85rem",
                        marginLeft: "auto",
                      }}
                    >
                      <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" }}>
                        ${formatMoney(r?.amount)}
                      </span>
                      <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem", justifyContent: "flex-end" }}>
                        <span style={statusBadgeStyle(r?.status)}>{adminStatusDisplay(r)}</span>
                        {withdrawalUrgencyChips(r, userWithdrawalCounts).map((chip) => (
                          <span
                            key={chip.key}
                            title="Operational hint only"
                            style={{
                              display: "inline-block",
                              padding: "0.12rem 0.4rem",
                              borderRadius: "6px",
                              fontSize: "0.62rem",
                              fontWeight: 800,
                              letterSpacing: "0.04em",
                              textTransform: "uppercase",
                              ...chip.style,
                            }}
                          >
                            {chip.label}
                          </span>
                        ))}
                        {compliance ? (
                          <>
                            <span
                              title="KYC status"
                              style={{
                                display: "inline-block",
                                padding: "0.12rem 0.4rem",
                                borderRadius: "6px",
                                fontSize: "0.62rem",
                                fontWeight: 800,
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                                background: kycStatusChipStyle(compliance.kycStatus).bg,
                                color: kycStatusChipStyle(compliance.kycStatus).fg,
                                border: `1px solid ${kycStatusChipStyle(compliance.kycStatus).border}`,
                              }}
                            >
                              KYC {compliance.kycStatus}
                            </span>
                            {compliance.exceedsLimit ? (
                              <span
                                title="Amount exceeds KYC withdrawal daily limit"
                                style={{
                                  display: "inline-block",
                                  padding: "0.12rem 0.4rem",
                                  borderRadius: "6px",
                                  fontSize: "0.62rem",
                                  fontWeight: 800,
                                  letterSpacing: "0.04em",
                                  textTransform: "uppercase",
                                  background: "#fef2f2",
                                  color: "#b91c1c",
                                  border: "1px solid #fecaca",
                                }}
                              >
                                Over limit
                              </span>
                            ) : null}
                            {compliance.wouldBlockIfEnforced ? (
                              <span
                                title="Would be blocked if KYC enforcement is active"
                                style={{
                                  display: "inline-block",
                                  padding: "0.12rem 0.4rem",
                                  borderRadius: "6px",
                                  fontSize: "0.62rem",
                                  fontWeight: 800,
                                  letterSpacing: "0.04em",
                                  textTransform: "uppercase",
                                  background: "#fffbeb",
                                  color: "#b45309",
                                  border: "1px solid #fde68a",
                                }}
                              >
                                Would block
                              </span>
                            ) : null}
                          </>
                        ) : null}
                      </span>
                    </div>
                  </div>

                  <div className="tc-withdrawal-detail-grid" style={{ marginBottom: "1.1rem" }}>
                    <WithdrawalDetail label="Request ID">{shortUuid(r.id)}</WithdrawalDetail>
                    <WithdrawalDetail label="User ID">{shortUuid(r.user_id)}</WithdrawalDetail>
                    <WithdrawalDetail label="Payout method">{payoutLabelCell(r)}</WithdrawalDetail>
                    {p?.email ? <WithdrawalDetail label="User email">{String(p.email).trim()}</WithdrawalDetail> : null}
                    {payoutEmail ? <WithdrawalDetail label="Payout destination">{payoutEmail}</WithdrawalDetail> : null}
                    {proc ? <WithdrawalDetail label="Processor">{proc}</WithdrawalDetail> : null}
                    {procStatus ? <WithdrawalDetail label="Processor status">{procStatus}</WithdrawalDetail> : null}
                    {hasBatch ? (
                      <WithdrawalDetail label="Batch ID">{shortUuid(String(r.processor_batch_id))}</WithdrawalDetail>
                    ) : null}
                    <WithdrawalDetail label="Created date">{formatWhen(r?.created_at)}</WithdrawalDetail>
                    {paidAt ? <WithdrawalDetail label="Paid date">{formatWhen(paidAt)}</WithdrawalDetail> : null}
                    {paidVia ? <WithdrawalDetail label="Paid via">{paidVia}</WithdrawalDetail> : null}
                    {extRef ? <WithdrawalDetail label="Reference">{extRef}</WithdrawalDetail> : null}
                    {manualRef && manualRef !== extRef ? (
                      <WithdrawalDetail label="Manual payout reference">{manualRef}</WithdrawalDetail>
                    ) : null}
                    {manualConfirmedAt ? (
                      <WithdrawalDetail label="Manual confirmation">{formatWhen(manualConfirmedAt)}</WithdrawalDetail>
                    ) : null}
                    {manualConfirmedBy ? (
                      <WithdrawalDetail label="Confirmed by admin">{shortUuid(String(manualConfirmedBy))}</WithdrawalDetail>
                    ) : null}
                    {refundedAt ? (
                      <WithdrawalDetail label="Wallet refunded">{formatWhen(refundedAt)}</WithdrawalDetail>
                    ) : null}
                    {refundReason ? <WithdrawalDetail label="Refund reason">{refundReason}</WithdrawalDetail> : null}
                    {r?.refund_transaction_id ? (
                      <WithdrawalDetail label="Refund txn">{shortUuid(String(r.refund_transaction_id))}</WithdrawalDetail>
                    ) : null}
                    {st === "rejected" && r?.rejection_reason != null && String(r.rejection_reason).trim() ? (
                      <WithdrawalDetail label="Rejection reason">{String(r.rejection_reason).trim()}</WithdrawalDetail>
                    ) : null}
                    {r?.processed_at ? <WithdrawalDetail label="Last processed">{formatWhen(r.processed_at)}</WithdrawalDetail> : null}
                  </div>

                  <WithdrawalCompliancePanel row={r} compliance={compliance} />

                  {failureReasonRaw.trim() ? <WithdrawalFailurePanel failureReason={failureReasonRaw} /> : null}

                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#64748b", marginBottom: "0.35rem" }}>
                    Admin note
                  </label>
                  <textarea
                    className="tc-admin-in"
                    rows={2}
                    value={adminNotesDraft[r.id] ?? ""}
                    onChange={(e) => setNoteDraft(r.id, e.target.value)}
                    placeholder="Internal note (required to reject)"
                    style={{ ...inputBase, resize: "vertical", minHeight: "52px", marginBottom: "1rem" }}
                    disabled={busy || st === "paid" || st === "rejected"}
                  />

                  {showComplianceCaution ? <ComplianceCautionBanner /> : null}

                  {showPrimaryActions || showSecondaryActions ? (
                    <div
                      style={{
                        marginTop: "0.25rem",
                        paddingTop: "1rem",
                        borderTop: "1px solid #e2e8f0",
                      }}
                    >
                      {showPrimaryActions ? (
                        <div className="tc-withdrawal-actions-primary">
                          {canRecordManual ? (
                            <button
                              type="button"
                              style={{
                                ...btnBase,
                                border: "1px solid #15803d",
                                background: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)",
                                color: "#ffffff",
                                boxShadow: "0 2px 8px rgba(22, 163, 74, 0.25)",
                                fontWeight: 700,
                                ...disabledStyle,
                              }}
                              disabled={busy}
                              onClick={() => openManualPayoutModal(r)}
                            >
                              Record manual payout
                            </button>
                          ) : null}
                          {showRefundWallet ? (
                            <button
                              type="button"
                              style={{
                                ...btnBase,
                                border: "1px solid #2563eb",
                                background: "linear-gradient(180deg, #60a5fa 0%, #2563eb 100%)",
                                color: "#ffffff",
                                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.22)",
                                ...disabledStyle,
                              }}
                              disabled={busy}
                              onClick={() => void handleRefundWallet(r)}
                              title="Credit the user's wallet for this rejected/failed withdrawal (idempotent)."
                            >
                              Refund wallet
                            </button>
                          ) : null}
                          {showAutomatedSend ? (
                            <button
                              type="button"
                              style={{
                                ...btnBase,
                                border: "1px solid #15803d",
                                background: payoutActionReady
                                  ? "linear-gradient(180deg, #15803d 0%, #166534 100%)"
                                  : "#e2e8f0",
                                color: payoutActionReady ? "#ffffff" : "#64748b",
                                boxShadow: payoutActionReady ? "0 2px 8px rgba(22, 163, 74, 0.2)" : "none",
                                ...disabledStyle,
                              }}
                              disabled={busy || !payoutActionReady}
                              onClick={() => void handleSendPayout(r)}
                              title={
                                !hasPayoutEmail
                                  ? "Missing payout email on withdrawal request."
                                  : !payoutActionReady
                                    ? payoutBlockerHint
                                    : undefined
                              }
                            >
                              Send payout (PayPal)
                            </button>
                          ) : null}
                          {showAutomatedCheck ? (
                            <button
                              type="button"
                              style={{
                                ...btnBase,
                                border: "1px solid #2563eb",
                                background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
                                color: "#ffffff",
                                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.22)",
                                ...disabledStyle,
                              }}
                              disabled={busy}
                              onClick={() => void handleCheckPayoutStatus(r)}
                            >
                              Check status
                            </button>
                          ) : null}
                          {showAutomatedRetry ? (
                            <button
                              type="button"
                              style={{
                                ...btnBase,
                                border: "1px solid #d97706",
                                background: "linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)",
                                color: "#422006",
                                boxShadow: "0 2px 8px rgba(245, 158, 11, 0.25)",
                                ...disabledStyle,
                              }}
                              disabled={busy || !payoutActionReady}
                              onClick={() => void handleRetryPayout(r)}
                              title={
                                !payoutActionReady
                                  ? payoutBlockerHint
                                  : "Submits a new PayPal payout with retry: true (fresh idempotency key when needed)."
                              }
                            >
                              {payoutRetryLoadingId === r.id ? "Retrying..." : "Retry payout"}
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {showSecondaryActions ? (
                        <div className="tc-withdrawal-actions-secondary">
                          {canMarkProcessing ? (
                            <button
                              type="button"
                              style={{
                                ...btnBase,
                                border: "1px solid #cbd5e1",
                                background: "#f8fafc",
                                color: "#334155",
                                fontWeight: 600,
                                ...disabledStyle,
                              }}
                              disabled={busy}
                              onClick={() => handleMarkProcessing(r)}
                            >
                              Mark processing
                            </button>
                          ) : null}
                          {canRecordManual ? (
                            <>
                              <label
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.4rem",
                                  fontSize: "0.78rem",
                                  color: "#475569",
                                  marginRight: "0.25rem",
                                  cursor: "pointer",
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={refundOnRejectById[r.id] !== false}
                                  onChange={(e) =>
                                    setRefundOnRejectById((prev) => ({ ...prev, [r.id]: e.target.checked }))
                                  }
                                  disabled={busy}
                                />
                                Refund wallet balance after rejection
                              </label>
                              <button
                                type="button"
                                style={{
                                  ...btnBase,
                                  border: "1px solid #fecaca",
                                  background: "#fef2f2",
                                  color: "#b91c1c",
                                  fontWeight: 600,
                                  ...disabledStyle,
                                }}
                                disabled={busy}
                                onClick={() => void handleReject(r)}
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  <div style={{ marginTop: "0.75rem" }}>
                    <button
                      type="button"
                      style={btnSm}
                      onClick={() => setWithdrawalAuditOpenId((cur) => (cur === r.id ? null : r.id))}
                    >
                      {withdrawalAuditOpenId === r.id ? "Hide audit timeline" : "Audit timeline"}
                    </button>
                    {withdrawalAuditOpenId === r.id ? (
                      <AuditTimelineEmbed entityType="withdrawal" entityId={r.id} limit={20} />
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ManualPayoutModal
        form={manualPayoutForm}
        submitting={!!manualPayoutForm?.submitting}
        onChange={(patch) => setManualPayoutForm((prev) => (prev ? { ...prev, ...patch } : prev))}
        onClose={() => setManualPayoutForm(null)}
        onSubmit={() => void submitManualPayout()}
      />
    </>
  );
}
