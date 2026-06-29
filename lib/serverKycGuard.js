/**
 * TLP-002: Server-side KYC enforcement for all money movement actions.
 * Client-side KYC checks are informational only.
 */

import { evaluateKycTransactionLimit, getKycStatusForUser } from "./kycRisk";
import { logAdminAuditEvent } from "./adminAudit";
import { appendAuditEventServer } from "./auditTimeline";

export const KYC_BLOCKED_ERROR = "kyc_policy_blocked";

export const KYC_WITHDRAWAL_BLOCKED_ERROR = "kyc_withdrawal_blocked";

export const KYC_WITHDRAWAL_BLOCKED_USER_MESSAGE =
  "Withdrawal blocked by KYC policy. Please verify your identity or reduce the amount.";

export const KYC_BLOCKED_USER_MESSAGE =
  "This action is blocked by identity verification policy. Please complete KYC or reduce the amount.";

const REQUIRE_APPROVED_KYC = process.env.TROPICASH_REQUIRE_APPROVED_KYC !== "false";

/**
 * @param {"funding"|"send"|"withdrawal"} actionType
 */
function actionLabel(actionType) {
  if (actionType === "funding") return "Funding";
  if (actionType === "send") return "Transfer";
  return "Withdrawal";
}

/**
 * @param {{
 *   userId: string;
 *   amount: number | string;
 *   actionType: "funding"|"send"|"withdrawal";
 *   supabaseClient: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function enforceServerKycForAction({ userId, amount, actionType, supabaseClient }) {
  const amt = Number(amount);
  if (!userId || !Number.isFinite(amt) || amt <= 0) {
    return {
      allowed: false,
      error: "invalid_amount",
      message: "Invalid amount.",
      enforcement: null,
    };
  }

  const { status: kycStatus } = await getKycStatusForUser(userId, { supabaseClient });

  if (REQUIRE_APPROVED_KYC && String(kycStatus || "").toLowerCase() !== "approved") {
    const blockError =
      actionType === "withdrawal" ? KYC_WITHDRAWAL_BLOCKED_ERROR : KYC_BLOCKED_ERROR;
    return {
      allowed: false,
      error: blockError,
      message:
        "Identity verification must be approved before moving money. Complete KYC in your profile settings.",
      enforcement: { kycStatus, mode: "hard_block", reason: "kyc_not_approved" },
    };
  }

  const evaluation = await evaluateKycTransactionLimit({
    userId,
    actionType,
    amount: amt,
    supabaseClient,
  });

  if (evaluation.allowed) {
    return {
      allowed: true,
      enforcement: evaluation,
      advisoryWarning:
        evaluation.exceedsLimit && evaluation.mode === "advisory" ? evaluation.reason : null,
    };
  }

  const blockError =
    actionType === "withdrawal" ? KYC_WITHDRAWAL_BLOCKED_ERROR : KYC_BLOCKED_ERROR;
  const blockMessage =
    actionType === "withdrawal"
      ? evaluation.reason || KYC_WITHDRAWAL_BLOCKED_USER_MESSAGE
      : evaluation.reason || KYC_BLOCKED_USER_MESSAGE;

  return {
    allowed: false,
    error: blockError,
    message: blockMessage,
    enforcement: evaluation,
  };
}

/**
 * @param {{
 *   userId: string;
 *   amount: number;
 *   actionType: "funding"|"send"|"withdrawal";
 *   enforcement: object | null;
 *   supabaseClient: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function logServerKycBlocked({ userId, amount, actionType, enforcement, supabaseClient }) {
  const metadata = {
    user_id: userId,
    amount: Number(amount),
    action_type: actionType,
    kyc_status: enforcement?.kycStatus ?? enforcement?.policyStatus ?? null,
    enforcement_mode: enforcement?.mode ?? null,
    limit: enforcement?.limit ?? null,
    reason: enforcement?.reason ?? null,
  };

  void logAdminAuditEvent({
    actorUserId: null,
    targetUserId: userId,
    action: `kyc_${actionType}_server_blocked`,
    category: actionType === "withdrawal" ? "withdrawal" : "payments",
    severity: "warning",
    description: `Server blocked ${actionLabel(actionType).toLowerCase()} due to KYC policy`,
    metadata,
    supabaseClient,
  });

  void appendAuditEventServer({
    entityType: "user",
    entityId: userId,
    eventType: `kyc.${actionType}_blocked`,
    actorUserId: null,
    targetUserId: userId,
    severity: "warning",
    title: `${actionLabel(actionType)} blocked by KYC policy`,
    description: metadata.reason || KYC_BLOCKED_USER_MESSAGE,
    metadata,
    dedupeKey: `kyc_${actionType}_blocked:${userId}:${Number(amount)}`,
    dedupeWindowMs: 5 * 60 * 1000,
  });
}
