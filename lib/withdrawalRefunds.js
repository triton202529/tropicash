/**
 * Phase 13C: Idempotent wallet refund for rejected/failed withdrawal requests.
 * Uses service-role RPC refund_withdrawal_request when available.
 */

import { createSupabaseServiceClient } from "./supabaseAdminApi";
import { logAdminAuditEvent } from "./adminAudit";
import { appendAuditEventServer } from "./auditTimeline";

/**
 * @typedef {'refunded' | 'already_refunded' | 'not_refundable' | 'error'} RefundOutcome
 */

/**
 * @param {unknown} data
 * @returns {Record<string, unknown> | null}
 */
function parseRpcPayload(data) {
  if (data == null) return null;
  if (typeof data === "object" && !Array.isArray(data)) return /** @type {Record<string, unknown>} */ (data);
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {Record<string, unknown> | null} payload
 */
export function normalizeRefundRpcResult(payload) {
  if (!payload) {
    return { outcome: "error", message: "Empty refund response" };
  }
  const outcome = String(payload.outcome || "error").toLowerCase();
  if (outcome === "refunded") {
    return {
      outcome: "refunded",
      withdrawalRequestId: payload.withdrawal_request_id ?? null,
      userId: payload.user_id ?? null,
      amount: payload.amount != null ? Number(payload.amount) : null,
      transactionId: payload.transaction_id ?? null,
      refundedAt: payload.refunded_at ?? null,
    };
  }
  if (outcome === "already_refunded") {
    return {
      outcome: "already_refunded",
      withdrawalRequestId: payload.withdrawal_request_id ?? null,
      refundedAt: payload.refunded_at ?? null,
      transactionId: payload.refund_transaction_id ?? payload.transaction_id ?? null,
    };
  }
  if (outcome === "not_refundable") {
    return {
      outcome: "not_refundable",
      withdrawalRequestId: payload.withdrawal_request_id ?? null,
      status: payload.status ?? null,
      message: payload.message ? String(payload.message) : "Withdrawal is not eligible for refund.",
    };
  }
  return {
    outcome: "error",
    message: payload.message ? String(payload.message) : "Refund failed.",
  };
}

/**
 * Credit wallet for a rejected/failed withdrawal (idempotent).
 *
 * @param {{
 *   withdrawalRequestId: string;
 *   reason?: string | null;
 *   adminUserId?: string | null;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient | null;
 *   skipAudit?: boolean;
 * }} args
 */
export async function refundWithdrawalRequest({
  withdrawalRequestId,
  reason = null,
  adminUserId = null,
  supabaseClient = null,
  skipAudit = false,
}) {
  const id = String(withdrawalRequestId || "").trim();
  if (!id) {
    return { outcome: "error", message: "withdrawal_request_id_required" };
  }

  const client = supabaseClient || createSupabaseServiceClient();
  if (!client) {
    return { outcome: "error", message: "Server configuration error (missing service role)" };
  }

  const { data, error } = await client.rpc("refund_withdrawal_request", {
    p_withdrawal_request_id: id,
    p_reason: reason != null ? String(reason).slice(0, 500) : null,
    p_admin_user_id: adminUserId ?? null,
  });

  if (error) {
    const msg = error.message || "refund_withdrawal_request RPC failed";
    const missingRpc =
      String(error.code || "") === "PGRST202" ||
      msg.toLowerCase().includes("refund_withdrawal_request") ||
      msg.toLowerCase().includes("does not exist");
    return {
      outcome: "error",
      message: missingRpc
        ? "Refund RPC not deployed. Apply supabase/sql/phase_13c_withdrawal_refunds.sql."
        : msg,
      code: error.code ?? null,
    };
  }

  const result = normalizeRefundRpcResult(parseRpcPayload(data));

  if (!skipAudit && result.outcome === "refunded") {
    const amount = result.amount != null && Number.isFinite(result.amount) ? result.amount : null;
    void logAdminAuditEvent({
      actorUserId: adminUserId ?? null,
      targetUserId: result.userId != null ? String(result.userId) : null,
      action: "withdrawal_refunded",
      category: "withdrawal",
      severity: "info",
      description: `Wallet refunded for withdrawal ${id}.`,
      metadata: {
        withdrawal_id: id,
        user_id: result.userId ?? null,
        amount,
        reason: reason != null ? String(reason).slice(0, 200) : null,
        admin_user_id: adminUserId ?? null,
        transaction_id: result.transactionId ?? null,
      },
      supabaseClient: client,
    });
    void appendAuditEventServer({
      entityType: "withdrawal",
      entityId: id,
      eventType: "withdrawal.refunded",
      actorUserId: adminUserId ?? null,
      targetUserId: result.userId != null ? String(result.userId) : null,
      severity: "success",
      title: "Withdrawal wallet refund",
      description: amount != null ? `Credited $${amount} back to wallet.` : "Wallet credited after rejection/failure.",
      metadata: {
        withdrawal_id: id,
        user_id: result.userId ?? null,
        amount,
        reason: reason != null ? String(reason).slice(0, 200) : null,
        transaction_id: result.transactionId ?? null,
      },
      dedupeKey: `audit:withdrawal:${id}:refunded`,
      dedupeWindowMs: 24 * 60 * 60 * 1000,
    });
  }

  return result;
}
