import { logOperationalError, logOperationalEvent } from "../../../lib/operationalLogger";
import { requireUserFromRequest } from "../../../lib/apiAuth";
import {
  createSupabaseServiceClient,
} from "../../../lib/supabaseAdminApi";
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
import { emitEvent, recordEventOnce } from "../../../lib/eventBus";
import {
  claimFinancialIdempotencySlot,
  extractIdempotencyKey,
  patchFinancialIdempotencyRow,
  validateIdempotencyKey,
} from "../../../lib/financialIdempotency";

const TRANSFER_IDEMPOTENCY_TABLE = "transfer_idempotency_keys";

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

  const recipientId = typeof body?.recipient_id === "string" ? body.recipient_id.trim() : "";
  const rawAmount = body?.amount;
  const amount = typeof rawAmount === "string" ? parseFloat(rawAmount) : Number(rawAmount);

  if (!recipientId) {
    return res.status(400).json({ error: "recipient_id is required" });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }
  if (recipientId === userId) {
    return res.status(400).json({ error: "cannot_send_to_self" });
  }

  const idempotencyKey = extractIdempotencyKey(req, body);
  const idemValidation = validateIdempotencyKey(idempotencyKey);
  if (!idemValidation.valid) {
    return res.status(400).json({
      error: idemValidation.error,
      message: "Idempotency-Key header (or idempotency_key body field) is required.",
    });
  }

  const finGate = await canServerPerformFinancialAction({ userId, action: "send_money" });
  if (!finGate.allowed) {
    void logServerBlockedFinancialAction({
      userId,
      action: "send_money",
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
    actionType: "send",
    supabaseClient: admin,
  });
  if (!kycGate.allowed) {
    void logServerKycBlocked({
      userId,
      amount,
      actionType: "send",
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
      category: "transfer.send",
      key: limitKey,
    });
    if (!limit.allowed) {
      const retryAfter = limit.retryAfterSec ?? 60;
      res.setHeader("Retry-After", String(retryAfter));
      void logOperationalEvent({
        level: "warn",
        supabaseClient: admin,
        category: "abuse.transfer",
        message: "transfer.send rate-limit triggered",
        userId,
        route: "/api/transfers/send",
        metadata: { limitCategory: "transfer.send", key: limitKey, retryAfterSec: retryAfter },
      });
      return res.status(429).json({
        error: "Too many transfer attempts. Please wait and try again.",
        retryAfterSec: retryAfter,
      });
    }
  }

  const claim = await claimFinancialIdempotencySlot(admin, {
    table: TRANSFER_IDEMPOTENCY_TABLE,
    userId,
    idempotencyKey,
    insertFields: { recipient_id: recipientId, amount },
  });

  if (claim.kind === "duplicate_completed") {
    const stored = claim.row?.response_payload;
    if (stored && typeof stored === "object") {
      return res.status(200).json({ ...stored, duplicate: true });
    }
    return res.status(200).json({
      success: true,
      duplicate: true,
      transaction_id: claim.row?.transaction_id ?? null,
    });
  }
  if (claim.kind === "already_processing") {
    return res.status(409).json({
      error: "ALREADY_PROCESSING",
      message: "This transfer is already being processed. Please wait.",
    });
  }
  if (claim.kind === "error") {
    void logOperationalError({
      supabaseClient: admin,
      category: "transfer.idempotency",
      message: claim.error?.message || "transfer idempotency claim failed",
      userId,
      route: "/api/transfers/send",
    });
    return res.status(500).json({ error: "Transfer failed" });
  }

  const { data: transferData, error: transferError } = await admin.rpc("transfer_funds", {
    sender_id: userId,
    recipient_id: recipientId,
    amount,
  });

  if (transferError) {
    void patchFinancialIdempotencyRow(admin, TRANSFER_IDEMPOTENCY_TABLE, claim.rowId, {
      status: "failed",
    });
    void logOperationalError({
      supabaseClient: admin,
      category: "transfer.send_rpc",
      message: transferError.message || "transfer_funds RPC failed",
      userId,
      route: "/api/transfers/send",
      metadata: { recipientId, code: transferError.code },
    });
    const msg = transferError.message || "";
    if (msg.includes("insufficient_funds")) {
      return res.status(400).json({ error: "insufficient_funds", message: "Insufficient funds." });
    }
    if (msg.includes("not_authorized")) {
      return res.status(403).json({ error: "not_authorized" });
    }
    return res.status(500).json({ error: "Transfer failed" });
  }

  const transactionId =
    transferData?.transaction_id ??
    (typeof transferData === "object" ? transferData?.id : null) ??
    null;

  const responsePayload = {
    success: true,
    transaction_id: transactionId,
    sender_balance: transferData?.sender_balance ?? null,
  };

  void patchFinancialIdempotencyRow(admin, TRANSFER_IDEMPOTENCY_TABLE, claim.rowId, {
    status: "completed",
    transaction_id: transactionId,
    response_payload: responsePayload,
  });

  void appendAuditEventServer({
    entityType: "user",
    entityId: userId,
    eventType: "transfer.sent",
    actorUserId: userId,
    targetUserId: recipientId,
    severity: "info",
    title: "Money sent",
    description: `Transfer of $${amount} to recipient ${recipientId}`,
    metadata: { amount, recipientId, transactionId },
    dedupeKey: transactionId ? `transfer:${transactionId}` : null,
    dedupeWindowMs: 60 * 1000,
  });

  void recordEventOnce({
    supabaseClient: admin,
    targetUserId: userId,
    eventType: "transfer.sent",
    category: "payments",
    severity: "info",
    title: "Transfer completed",
    message: "Your transfer was completed successfully.",
    metadata: { amount, recipientId, transactionId },
    dedupeKey: transactionId ? `transfer.sent:${transactionId}` : `transfer.sent:${userId}:${Date.now()}`,
    windowMs: 60 * 1000,
  });

  void emitEvent({
    supabaseClient: admin,
    targetUserId: recipientId,
    eventType: "transfer.received",
    category: "payments",
    severity: "success",
    title: "Money received",
    message: "You received a transfer.",
    metadata: { amount, senderId: userId, transactionId },
  });

  return res.status(200).json(responsePayload);
}
