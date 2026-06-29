import { logOperationalError, logOperationalEvent } from "../../../lib/operationalLogger";
import { requireUserFromRequest } from "../../../lib/apiAuth";
import { createSupabaseServiceClient } from "../../../lib/supabaseAdminApi";
import {
  buildRateLimitKey,
  extractClientIp,
  incrementRateLimit,
} from "../../../lib/rateLimit";
import {
  accountRestrictedHttpBody,
  canServerPerformFinancialAction,
  logServerBlockedFinancialAction,
} from "../../../lib/serverAccountSecurityGuard";
import {
  enforceServerKycForAction,
  KYC_BLOCKED_ERROR,
  logServerKycBlocked,
} from "../../../lib/serverKycGuard";
import { appendAuditEventServer } from "../../../lib/auditTimeline";

function messageForRpcError(err) {
  const msg = err?.message || "";
  if (msg.includes("Insufficient funds") || msg.includes("insufficient_funds")) {
    return "Insufficient funds.";
  }
  if (msg.includes("not_authorized")) return "You are not allowed to perform this action.";
  if (msg.includes("payout_email_required")) return "Payout email is required.";
  if (msg.includes("invalid_amount")) return "Please enter a valid amount.";
  if (msg.includes("Wallet not found")) return "Wallet not found.";
  return msg || "Withdrawal request failed.";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireUserFromRequest(req);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }
  const userId = auth.user.id;

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const rawAmount = body?.amount;
  const amount = typeof rawAmount === "string" ? parseFloat(rawAmount) : Number(rawAmount);
  const payoutEmail =
    typeof body?.payout_email === "string" ? body.payout_email.trim() : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  if (!payoutEmail) {
    return res.status(400).json({ error: "payout_email is required" });
  }

  const finGate = await canServerPerformFinancialAction({ userId, action: "withdraw_wallet" });
  if (!finGate.allowed) {
    void logServerBlockedFinancialAction({
      userId,
      action: "withdraw_wallet",
      status: finGate.status,
      riskLevel: finGate.riskLevel,
      reason: finGate.reason,
      source: "server",
    });
    return res.status(403).json(accountRestrictedHttpBody(finGate));
  }

  const admin = createSupabaseServiceClient();
  if (!admin) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const kycGate = await enforceServerKycForAction({
    userId,
    amount,
    actionType: "withdrawal",
    supabaseClient: admin,
  });
  if (!kycGate.allowed) {
    void logServerKycBlocked({
      userId,
      amount,
      actionType: "withdrawal",
      enforcement: kycGate.enforcement,
      supabaseClient: admin,
    });
    return res.status(403).json({
      success: false,
      error: kycGate.error || KYC_BLOCKED_ERROR,
      message: kycGate.message,
    });
  }

  const ip = extractClientIp(req);
  const limitKey = buildRateLimitKey({ userId, ip });
  if (limitKey) {
    const limit = await incrementRateLimit({
      supabaseClient: admin,
      category: "withdrawal.create_request",
      key: limitKey,
    });
    if (!limit.allowed) {
      const retryAfter = limit.retryAfterSec ?? 60;
      res.setHeader("Retry-After", String(retryAfter));
      void logOperationalEvent({
        level: "warn",
        supabaseClient: admin,
        category: "abuse.withdrawal",
        message: "withdrawal.create_request rate-limit triggered",
        userId,
        route: "/api/withdrawals/create",
        metadata: { limitCategory: "withdrawal.create_request", key: limitKey, retryAfterSec: retryAfter },
      });
      return res.status(429).json({
        error: "You've submitted several withdrawal requests recently. Please wait a bit and try again.",
        retryAfterSec: retryAfter,
      });
    }
  }

  const { data: requestId, error: rpcError } = await admin.rpc("create_withdrawal_request", {
    p_user_id: userId,
    p_amount: amount,
    p_payout_email: payoutEmail,
  });

  if (rpcError) {
    void logOperationalError({
      supabaseClient: admin,
      category: "withdrawal.create_request",
      message: rpcError.message || "create_withdrawal_request RPC failed",
      userId,
      route: "/api/withdrawals/create",
      metadata: { code: rpcError.code },
    });
    return res.status(400).json({
      success: false,
      error: "withdrawal_failed",
      message: messageForRpcError(rpcError),
    });
  }

  void appendAuditEventServer({
    entityType: "user",
    entityId: userId,
    eventType: "withdrawal.requested",
    actorUserId: userId,
    targetUserId: userId,
    severity: "info",
    title: "Withdrawal requested",
    description: `Withdrawal request ${requestId} for $${amount}`,
    metadata: { requestId, amount, payoutEmail },
    dedupeKey: requestId ? `withdrawal:${requestId}` : null,
    dedupeWindowMs: 60 * 1000,
  });

  return res.status(200).json({
    success: true,
    request_id: requestId,
  });
}
