/**
 * Phase 11H: Server-side withdrawal KYC enforcement (API gate before create_withdrawal_request RPC).
 */

import { enforceKycForWithdrawal } from "./kycRisk";
import { logAdminAuditEvent } from "./adminAudit";
import { appendAuditEventServer } from "./auditTimeline";

export const KYC_WITHDRAWAL_BLOCKED_USER_MESSAGE =
  "Withdrawal blocked by KYC policy. Please verify your identity or reduce the amount.";

export const KYC_WITHDRAWAL_BLOCKED_ERROR = "kyc_withdrawal_blocked";

/**
 * @param {{ userId: string; amount: number; supabaseClient: import('@supabase/supabase-js').SupabaseClient }} args
 */
export async function enforceServerKycForWithdrawal({ userId, amount, supabaseClient }) {
  const amt = Number(amount);
  if (!userId || !Number.isFinite(amt) || amt <= 0) {
    return {
      allowed: false,
      error: "invalid_amount",
      message: "Invalid withdrawal amount.",
      enforcement: null,
    };
  }

  const enforcement = await enforceKycForWithdrawal({
    userId,
    amount: amt,
    supabaseClient,
  });

  if (enforcement.allowed) {
    return {
      allowed: true,
      enforcement,
      advisoryWarning: enforcement.exceedsLimit && enforcement.mode === "advisory" ? enforcement.reason : null,
    };
  }

  return {
    allowed: false,
    error: KYC_WITHDRAWAL_BLOCKED_ERROR,
    message: KYC_WITHDRAWAL_BLOCKED_USER_MESSAGE,
    enforcement,
  };
}

/**
 * Best-effort audit when server blocks a withdrawal for KYC policy.
 * @param {{
 *   userId: string;
 *   amount: number;
 *   enforcement: { kycStatus?: string; mode?: string; limit?: number | null; reason?: string | null };
 *   supabaseClient: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function logServerKycWithdrawalBlocked({ userId, amount, enforcement, supabaseClient }) {
  const metadata = {
    user_id: userId,
    amount: Number(amount),
    kyc_status: enforcement?.kycStatus ?? null,
    enforcement_mode: enforcement?.mode ?? null,
    limit: enforcement?.limit ?? null,
    used_today: enforcement?.usedToday ?? null,
    projected_total: enforcement?.projectedTotal ?? null,
    reason: enforcement?.reason ?? null,
  };

  void logAdminAuditEvent({
    actorUserId: null,
    targetUserId: userId,
    action: "kyc_withdrawal_server_blocked",
    category: "withdrawal",
    severity: "warning",
    description: "Server blocked withdrawal request due to KYC policy",
    metadata,
    supabaseClient,
  });

  void appendAuditEventServer({
    entityType: "user",
    entityId: userId,
    eventType: "kyc.withdrawal_blocked",
    actorUserId: null,
    targetUserId: userId,
    severity: "warning",
    title: "Withdrawal blocked by KYC policy",
    description: KYC_WITHDRAWAL_BLOCKED_USER_MESSAGE,
    metadata,
    dedupeKey: `kyc_withdrawal_blocked:${userId}:${Number(amount)}:${enforcement?.mode || "unknown"}`,
    dedupeWindowMs: 5 * 60 * 1000,
  });
}
