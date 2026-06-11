/**
 * Phase 13E: Read-only withdrawal reconciliation & stuck-status monitoring.
 * Does not mutate balances, statuses, payouts, or refunds.
 */

import { supabase as defaultClient } from "./supabaseClient";
import {
  extractWithdrawalRequestIdFromTransaction,
  findWithdrawalMatchForRefundTransaction,
  findWithdrawalMatchForWithdrawTransaction,
} from "./withdrawalRequests";

export const DEFAULT_RECONCILIATION_THRESHOLDS = Object.freeze({
  /** Pending review older than this (default 24h). */
  pendingStaleMs: 24 * 60 * 60 * 1000,
  /** PayPal processing batch older than this (default 2h). */
  processingPayPalStaleMs: 2 * 60 * 60 * 1000,
  lookbackDays: 90,
  withdrawalRequestLimit: 1000,
  transactionLimit: 2500,
});

export const RECONCILIATION_ISSUE_TYPES = Object.freeze({
  PENDING_STALE: "pending_stale",
  PROCESSING_PAYPAL_STALE: "processing_paypal_stale",
  FAILED_NOT_REFUNDED: "failed_not_refunded",
  REJECTED_NOT_REFUNDED: "rejected_not_refunded",
  PAID_MANUAL_MISSING_REFERENCE: "paid_manual_missing_reference",
  PAID_PAYPAL_MISSING_BATCH: "paid_paypal_missing_batch",
  MISSING_WITHDRAWAL_TRANSACTION_ID: "missing_withdrawal_transaction_id",
  ORPHAN_WITHDRAW_TRANSACTION: "orphan_withdraw_transaction",
  ORPHAN_REFUND_TRANSACTION: "orphan_refund_transaction",
  REFUNDED_STILL_ACTIVE: "refunded_still_active",
  PAID_AND_REFUNDED: "paid_and_refunded",
});

/**
 * @param {Record<string, unknown>} row
 * @param {string} col
 */
function str(row, col) {
  const v = row?.[col];
  return v != null ? String(v).trim() : "";
}

/**
 * @param {string | null | undefined} iso
 */
function ageMs(iso) {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : Date.now() - t;
}

/**
 * @param {{
 *   type: string;
 *   severity: 'critical' | 'warning' | 'info';
 *   message: string;
 *   recommendedAction: string;
 *   row?: Record<string, unknown> | null;
 *   transactionId?: string | null;
 *   userId?: string | null;
 *   amount?: number | null;
 *   status?: string | null;
 * }} args
 */
function makeIssue({ type, severity, message, recommendedAction, row = null, transactionId = null, userId = null, amount = null, status = null }) {
  const withdrawalRequestId = row?.id != null ? String(row.id) : null;
  const resolvedUserId = userId ?? (row?.user_id != null ? String(row.user_id) : null);
  const resolvedAmount =
    amount != null
      ? amount
      : row?.amount != null && Number.isFinite(Number(row.amount))
        ? Number(row.amount)
        : null;
  const resolvedStatus = status ?? (row?.status != null ? String(row.status) : null);
  const idKey = withdrawalRequestId || transactionId || `${type}-${message.slice(0, 24)}`;
  return {
    id: `${type}:${idKey}`,
    severity,
    type,
    withdrawalRequestId,
    userId: resolvedUserId,
    amount: resolvedAmount,
    status: resolvedStatus,
    transactionId: transactionId ?? null,
    message,
    recommendedAction,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {typeof DEFAULT_RECONCILIATION_THRESHOLDS} thresholds
 */
async function loadReconciliationData(supabase, thresholds) {
  const since = new Date(Date.now() - thresholds.lookbackDays * 86400000).toISOString();

  const [wrRes, txRes] = await Promise.all([
    supabase
      .from("withdrawal_requests")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(thresholds.withdrawalRequestLimit),
    supabase
      .from("transactions")
      .select("*")
      .in("type", ["withdraw_wallet", "withdraw", "withdrawal_refund"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(thresholds.transactionLimit),
  ]);

  return {
    withdrawalRows: wrRes.data || [],
    transactionRows: txRes.data || [],
    errors: [wrRes.error, txRes.error].filter(Boolean),
  };
}

/**
 * @param {Record<string, unknown>[]} withdrawalRows
 * @param {Record<string, unknown>[]} transactionRows
 * @param {typeof DEFAULT_RECONCILIATION_THRESHOLDS} thresholds
 */
export function buildWithdrawalReconciliationReport(withdrawalRows, transactionRows, thresholds = DEFAULT_RECONCILIATION_THRESHOLDS) {
  const issues = [];
  const requestById = new Map();
  const txIdLinkedToRequest = new Set();

  for (const row of withdrawalRows) {
    if (row?.id) requestById.set(String(row.id), row);
    const txId = row?.withdrawal_transaction_id;
    if (txId) txIdLinkedToRequest.add(String(txId));
  }

  for (const row of withdrawalRows) {
    const id = str(row, "id");
    if (!id) continue;
    const status = str(row, "status").toLowerCase();
    const processor = str(row, "processor").toLowerCase();
    const createdAt = row.created_at;
    const updatedAt = row.updated_at || row.processed_at || createdAt;
    const refundedAt = row.refunded_at;
    const hasRefund = !!refundedAt;

    if (status === "pending" && ageMs(createdAt) > thresholds.pendingStaleMs) {
      issues.push(
        makeIssue({
          type: RECONCILIATION_ISSUE_TYPES.PENDING_STALE,
          severity: "warning",
          row,
          message: `Pending withdrawal open for ${Math.round(ageMs(createdAt) / 3600000)}h without settlement action.`,
          recommendedAction: "Review in /admin/withdrawals — send PayPal payout, record manual payout, or reject with refund.",
        }),
      );
    }

    if (status === "processing" && (processor === "paypal" || row.processor_batch_id)) {
      const staleRef = updatedAt || createdAt;
      if (ageMs(staleRef) > thresholds.processingPayPalStaleMs) {
        issues.push(
          makeIssue({
            type: RECONCILIATION_ISSUE_TYPES.PROCESSING_PAYPAL_STALE,
            severity: "warning",
            row,
            message: `PayPal batch processing for ${Math.round(ageMs(staleRef) / 3600000)}h — check batch status or webhooks.`,
            recommendedAction: "Use Check status on /admin/withdrawals. Do not auto-mark paid.",
          }),
        );
      }
    }

    if (status === "failed" && !hasRefund) {
      issues.push(
        makeIssue({
          type: RECONCILIATION_ISSUE_TYPES.FAILED_NOT_REFUNDED,
          severity: "critical",
          row,
          message: "Failed withdrawal — wallet was debited but no refund recorded.",
          recommendedAction: "Confirm PayPal will not complete, then Refund wallet on /admin/withdrawals.",
        }),
      );
    }

    if (status === "rejected" && !hasRefund) {
      issues.push(
        makeIssue({
          type: RECONCILIATION_ISSUE_TYPES.REJECTED_NOT_REFUNDED,
          severity: "critical",
          row,
          message: "Rejected withdrawal — wallet may still be debited without refund.",
          recommendedAction: "Reject with refund checked, or use Refund wallet on /admin/withdrawals.",
        }),
      );
    }

    if (status === "paid" && processor === "manual") {
      const manualRef = str(row, "manual_payout_reference") || str(row, "external_reference");
      if (!manualRef) {
        issues.push(
          makeIssue({
            type: RECONCILIATION_ISSUE_TYPES.PAID_MANUAL_MISSING_REFERENCE,
            severity: "warning",
            row,
            message: "Paid via manual external payment but audit reference is missing.",
            recommendedAction: "Add external reference in admin notes or verify payout documentation offline.",
          }),
        );
      }
    }

    if (status === "paid" && processor === "paypal") {
      const batchId = str(row, "processor_batch_id");
      const procResp = row.processor_response;
      const hasResponse = procResp != null && (typeof procResp === "object" ? Object.keys(procResp).length > 0 : String(procResp).trim() !== "");
      if (!batchId || !hasResponse) {
        issues.push(
          makeIssue({
            type: RECONCILIATION_ISSUE_TYPES.PAID_PAYPAL_MISSING_BATCH,
            severity: "warning",
            row,
            message: "Paid PayPal withdrawal missing processor_batch_id or processor_response audit fields.",
            recommendedAction: "Reconcile batch in /admin/withdrawals or verify PayPal dashboard before closing.",
          }),
        );
      }
    }

    if (!row.withdrawal_transaction_id) {
      issues.push(
        makeIssue({
          type: RECONCILIATION_ISSUE_TYPES.MISSING_WITHDRAWAL_TRANSACTION_ID,
          severity: "info",
          row,
          message: "No withdraw_wallet ledger transaction linked to this request.",
          recommendedAction: "Run phase_13d backfill or verify wallet debit in transaction history.",
        }),
      );
    }

    if (hasRefund && (status === "pending" || status === "processing")) {
      issues.push(
        makeIssue({
          type: RECONCILIATION_ISSUE_TYPES.REFUNDED_STILL_ACTIVE,
          severity: "critical",
          row,
          message: `Withdrawal refunded but status is still "${status}".`,
          recommendedAction: "Update status for reporting consistency (manual review only — no auto-fix in this phase).",
        }),
      );
    }

    if (status === "paid" && hasRefund) {
      issues.push(
        makeIssue({
          type: RECONCILIATION_ISSUE_TYPES.PAID_AND_REFUNDED,
          severity: "critical",
          row,
          message: "Withdrawal marked paid and also has refunded_at — possible double settlement.",
          recommendedAction: "Investigate immediately: confirm PayPal/manual payout vs wallet refund.",
        }),
      );
    }
  }

  for (const txn of transactionRows) {
    const rawType = str(txn, "type").toLowerCase();
    const txId = str(txn, "id");
    if (!txId) continue;

    if (rawType === "withdraw_wallet" || rawType === "withdraw") {
      if (txIdLinkedToRequest.has(txId)) continue;
      const parsedId = extractWithdrawalRequestIdFromTransaction(txn);
      if (parsedId && requestById.has(parsedId)) continue;
      const fuzzy = findWithdrawalMatchForWithdrawTransaction(txn, withdrawalRows, txn.sender_id || "");
      if (fuzzy) continue;

      issues.push(
        makeIssue({
          type: RECONCILIATION_ISSUE_TYPES.ORPHAN_WITHDRAW_TRANSACTION,
          severity: "warning",
          transactionId: txId,
          userId: txn.sender_id != null ? String(txn.sender_id) : null,
          amount: Number(txn.amount) || null,
          status: txn.status != null ? String(txn.status) : null,
          message: "withdraw_wallet transaction has no matching withdrawal_requests row.",
          recommendedAction: "Link via backfill_withdrawal_transaction_ledger or investigate duplicate debit.",
        }),
      );
    }

    if (rawType === "withdrawal_refund") {
      const match = findWithdrawalMatchForRefundTransaction(txn, withdrawalRows);
      if (match) continue;

      issues.push(
        makeIssue({
          type: RECONCILIATION_ISSUE_TYPES.ORPHAN_REFUND_TRANSACTION,
          severity: "warning",
          transactionId: txId,
          userId: txn.recipient_id != null ? String(txn.recipient_id) : null,
          amount: Number(txn.amount) || null,
          status: txn.status != null ? String(txn.status) : null,
          message: "withdrawal_refund transaction not linked to a withdrawal request.",
          recommendedAction: "Verify refund note contains request ID; reconcile in /admin/withdrawals.",
        }),
      );
    }
  }

  const byType = {};
  for (const t of Object.values(RECONCILIATION_ISSUE_TYPES)) {
    byType[t] = 0;
  }
  let critical = 0;
  let warning = 0;
  let info = 0;
  for (const issue of issues) {
    byType[issue.type] = (byType[issue.type] || 0) + 1;
    if (issue.severity === "critical") critical += 1;
    else if (issue.severity === "warning") warning += 1;
    else info += 1;
  }

  return {
    summary: {
      total: issues.length,
      critical,
      warning,
      info,
      byType,
      withdrawalRowsScanned: withdrawalRows.length,
      transactionRowsScanned: transactionRows.length,
      thresholds: {
        pendingStaleHours: thresholds.pendingStaleMs / 3600000,
        processingPayPalStaleHours: thresholds.processingPayPalStaleMs / 3600000,
        lookbackDays: thresholds.lookbackDays,
      },
    },
    issues,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Read-only reconciliation report for admin monitoring.
 *
 * @param {{
 *   supabase?: import('@supabase/supabase-js').SupabaseClient;
 *   thresholds?: Partial<typeof DEFAULT_RECONCILIATION_THRESHOLDS>;
 * }} [opts]
 */
export async function fetchWithdrawalReconciliationReport(opts = {}) {
  const supabase = opts.supabase || defaultClient;
  const thresholds = { ...DEFAULT_RECONCILIATION_THRESHOLDS, ...(opts.thresholds || {}) };

  const { withdrawalRows, transactionRows, errors } = await loadReconciliationData(supabase, thresholds);

  if (errors.length > 0) {
    const msg = errors.map((e) => e.message).join("; ");
    return {
      summary: {
        total: 0,
        critical: 0,
        warning: 0,
        info: 0,
        byType: {},
        error: msg,
        thresholds: {
          pendingStaleHours: thresholds.pendingStaleMs / 3600000,
          processingPayPalStaleHours: thresholds.processingPayPalStaleMs / 3600000,
          lookbackDays: thresholds.lookbackDays,
        },
      },
      issues: [],
      generatedAt: new Date().toISOString(),
      error: msg,
    };
  }

  return buildWithdrawalReconciliationReport(withdrawalRows, transactionRows, thresholds);
}
