import { createClient } from "@supabase/supabase-js";
import { capturePayPalOrder, getPayPalOrder } from "../../../lib/paypal";
import { executePaypalFundingCapture } from "../../../lib/paypalFundingIntegrity.mjs";
import { createPaypalFundingStore } from "../../../lib/paypalFundingStore";
import {
  logConcurrentFunding,
  logDuplicateFundingBlocked,
  logFundingCreditFailed,
  logFundingSuccessFraudSignals,
  logPaypalCaptureFailed,
  logPaypalCaptureIncomplete,
} from "../../../lib/fundingFraudServer";
import { logOperationalError, logOperationalEvent } from "../../../lib/operationalLogger";
import { getSupabaseAnonKey, getSupabaseUrl } from "../../../lib/supabaseAdminApi";
import { payPalConfigGateForMoneyApi } from "../../../lib/paypalProductionGuard";
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
import {
  buildRateLimitKey,
  extractClientIp,
  incrementRateLimit,
} from "../../../lib/rateLimit";
import { emitEvent, recordEventOnce } from "../../../lib/eventBus";
import { appendAuditEventServer } from "../../../lib/auditTimeline";

function formatMoney(value) {
  const n = Number(value);
  return Number(Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  console.log("[FUNDING_PROCESS] capture-order request received");

  const authHeader = req.headers.authorization;
  const jwt =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
  if (!jwt) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missingEnv = [];
  if (!supabaseUrl) missingEnv.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!anonKey) missingEnv.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!serviceRoleKey) missingEnv.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missingEnv.length > 0) {
    console.error("[paypal/capture-order] missing env:", missingEnv.join(", "));
    void logOperationalError({
      category: "env.config",
      message: `Missing required env: ${missingEnv.join(", ")}`,
      userId: null,
      route: "/api/paypal/capture-order",
      metadata: { missing: missingEnv },
    });
    return res.status(500).json({ error: "Server configuration error" });
  }

  const supabaseAuth = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(jwt);
  if (authError || !user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = user.id;

  const finGate = await canServerPerformFinancialAction({ userId, action: "fund_wallet" });
  if (!finGate.allowed) {
    void logServerBlockedFinancialAction({
      userId,
      action: "fund_wallet",
      status: finGate.status,
      riskLevel: finGate.riskLevel,
      reason: finGate.reason,
      source: "server",
    });
    return res.status(403).json(accountRestrictedHttpBody(finGate));
  }

  const paypalGate = payPalConfigGateForMoneyApi();
  if (paypalGate.blocked) {
    return res.status(paypalGate.status).json(paypalGate.body);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const ip = extractClientIp(req);
  const limitKey = buildRateLimitKey({ userId, ip });
  if (limitKey) {
    const limit = await incrementRateLimit({
      supabaseClient: supabaseAdmin,
      category: "paypal.capture_order",
      key: limitKey,
    });
    if (!limit.allowed) {
      const retryAfter = limit.retryAfterSec ?? 60;
      res.setHeader("Retry-After", String(retryAfter));
      void logOperationalEvent({
        level: "warn",
        supabaseClient: supabaseAdmin,
        category: "abuse.funding",
        message: "paypal.capture_order rate-limit triggered",
        userId,
        route: "/api/paypal/capture-order",
        metadata: {
          limitCategory: "paypal.capture_order",
          key: limitKey,
          count: limit.count,
          retryAfterSec: retryAfter,
        },
      });
      void emitEvent({
        supabaseClient: supabaseAdmin,
        targetUserId: userId,
        eventType: "security.rate_limit",
        category: "security",
        severity: "warning",
        title: "Funding rate limit reached",
        message: "You've reached the funding rate limit. Please wait a few minutes before trying again.",
        metadata: { limitCategory: "paypal.capture_order", retryAfterSec: retryAfter },
      });
      void recordEventOnce({
        supabaseClient: supabaseAdmin,
        adminTarget: true,
        eventType: "security.rate_limit",
        category: "admin",
        severity: "warning",
        title: "Rate limit hit",
        message: "User hit rate limit on paypal.capture_order.",
        actorUserId: userId,
        metadata: { limitCategory: "paypal.capture_order", retryAfterSec: retryAfter, key: limitKey, userId },
        dedupeKey: `rate_limit.${limitKey}.paypal.capture_order`,
        windowMs: 10 * 60 * 1000,
      });
      void appendAuditEventServer({
        entityType: "user",
        entityId: userId,
        eventType: "abuse.rate_limit",
        actorUserId: userId,
        targetUserId: userId,
        severity: "warning",
        title: "PayPal capture rate limit",
        description: "paypal.capture_order soft limit exceeded.",
        metadata: { limitCategory: "paypal.capture_order", retryAfterSec: retryAfter },
        dedupeKey: `audit:rate:${limitKey}:paypal.capture_order`,
        dedupeWindowMs: 10 * 60 * 1000,
      });
      return res.status(429).json({
        error: "Too many funding attempts. Please wait a few minutes and try again.",
        retryAfterSec: retryAfter,
      });
    }
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const orderID = body?.orderID;
  if (!orderID || typeof orderID !== "string") {
    return res.status(400).json({ error: "orderID is required" });
  }

  const rawExpectedAmount = body?.amount;
  const expectedAmount =
    rawExpectedAmount != null && rawExpectedAmount !== ""
      ? typeof rawExpectedAmount === "string"
        ? parseFloat(rawExpectedAmount)
        : Number(rawExpectedAmount)
      : null;
  const clientCurrency = body?.currency ?? null;

  const store = createPaypalFundingStore(supabaseAdmin);
  let fundingOrder = null;
  try {
    fundingOrder = await store.load(orderID);
  } catch (err) {
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "paypal.capture",
      message: err?.message || "Funding order lookup failed",
      userId,
      route: "/api/paypal/capture-order",
      metadata: { orderID: String(orderID).slice(0, 80) },
    });
    return res.status(500).json({ error: "Could not verify funding status" });
  }

  if (fundingOrder && fundingOrder.user_id === userId) {
    const kycGate = await enforceServerKycForAction({
      userId,
      amount: Number(fundingOrder.amount),
      actionType: "funding",
      supabaseClient: supabaseAdmin,
    });
    if (!kycGate.allowed) {
      void logServerKycBlocked({
        userId,
        amount: Number(fundingOrder.amount),
        actionType: "funding",
        enforcement: kycGate.enforcement,
        supabaseClient: supabaseAdmin,
      });
      return res.status(403).json({
        success: false,
        error: kycGate.error || KYC_BLOCKED_ERROR,
        message: kycGate.message,
      });
    }
  }

  let outcome;
  try {
    outcome = await executePaypalFundingCapture({
      callerUserId: userId,
      orderId: orderID,
      clientAmount: expectedAmount,
      clientCurrency,
      store,
      paypal: {
        capture: capturePayPalOrder,
        get: getPayPalOrder,
      },
    });
  } catch (err) {
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "paypal.capture",
      message: err?.message || "Funding capture flow failed",
      userId,
      route: "/api/paypal/capture-order",
      metadata: { orderID: String(orderID).slice(0, 80), code: err?.code || null },
    });
    return res.status(500).json({ error: "Could not verify funding status" });
  }

  const code = outcome.body?.code || null;
  if (code === "ORDER_OWNER_MISMATCH" || code === "ORDER_NOT_BOUND") {
    console.error("[FUNDING_DUPLICATE_BLOCKED] ownership", { orderID, userId, code });
    return res.status(outcome.httpStatus).json(outcome.body);
  }
  if (code === "AMOUNT_MISMATCH" || code === "CURRENCY_MISMATCH" || code === "ORDER_IDENTITY_MISMATCH") {
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "paypal.capture",
      message: outcome.body?.error || code,
      userId,
      route: "/api/paypal/capture-order",
      metadata: { orderID: String(orderID).slice(0, 80), code },
    });
    return res.status(outcome.httpStatus).json(outcome.body);
  }
  if (code === "ALREADY_PROCESSING" || code === "FUNDING_CREDIT_UNCERTAIN") {
    await logConcurrentFunding(supabaseAdmin, {
      userId,
      orderID,
      amountNum: Number(fundingOrder?.amount) || null,
    });
    return res.status(outcome.httpStatus).json(outcome.body);
  }
  if (code === "CAPTURE_INCOMPLETE") {
    await logPaypalCaptureIncomplete(supabaseAdmin, {
      userId,
      orderID,
      paypalStatus: outcome.body?.paypalStatus || null,
    });
    return res.status(outcome.httpStatus).json(outcome.body);
  }
  if (code === "PAYPAL_CAPTURE_FAILED" || code === "PROCESSOR_DECLINED" || code === "PAYER_ACTION_REQUIRED") {
    await logPaypalCaptureFailed(supabaseAdmin, {
      userId,
      orderID,
      message: outcome.body?.error,
    });
    return res.status(outcome.httpStatus).json(outcome.body);
  }
  if (!outcome.body?.success) {
    await logFundingCreditFailed(supabaseAdmin, {
      userId,
      orderID,
      amountNum: Number(fundingOrder?.amount) || null,
      fundWalletError: { code: code || "credit_failed" },
    });
    return res.status(outcome.httpStatus || 500).json(
      outcome.body || { error: "Could not credit wallet after payment" },
    );
  }

  if (outcome.body.duplicate) {
    await logDuplicateFundingBlocked(supabaseAdmin, {
      userId,
      orderID,
      amountNum: Number(outcome.body.amount),
      source: "funding_order",
    });
    return res.status(200).json(outcome.body);
  }

  const amountNum = Number(outcome.body.amount);
  const transactionId = outcome.transactionId ?? outcome.body.transactionId ?? null;
  const amountText = formatMoney(amountNum);
  const { data: notifData, error: notifError } = await supabaseAdmin.rpc("create_notification", {
    p_user_id: userId,
    p_type: "wallet_funded",
    p_message: `Your wallet funding was completed successfully. (PayPal order ${orderID})`,
    p_title: "Wallet funding completed",
    p_related_transaction_id: transactionId,
  });
  if (notifError) {
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "notification.create",
      message: notifError.message || "create_notification RPC failed after funding",
      userId,
      route: "/api/paypal/capture-order",
      metadata: { orderID: String(orderID).slice(0, 80), code: notifError.code },
    });
    void appendAuditEventServer({
      entityType: "notification",
      entityId: userId,
      eventType: "notification.create_failed",
      actorUserId: userId,
      targetUserId: userId,
      severity: "warning",
      title: "Post-funding notification failed",
      description: "create_notification RPC failed after successful funding.",
      metadata: {
        code: notifError.code || null,
        orderID: String(orderID).slice(0, 80),
      },
      dedupeKey: `audit:notification:funding:${userId}:${String(orderID)}`,
      dedupeWindowMs: 8 * 60 * 1000,
    });
  }

  const notificationId =
    typeof notifData === "string"
      ? notifData
      : notifData && typeof notifData === "object"
        ? notifData.id ?? notifData.notification_id ?? null
        : null;
  if (notificationId) {
    await supabaseAdmin
      .from("funding_idempotency_keys")
      .update({ notification_id: notificationId, updated_at: new Date().toISOString() })
      .eq("provider", "paypal")
      .eq("provider_order_id", orderID);
  }

  await logFundingSuccessFraudSignals(supabaseAdmin, { userId, amountNum, orderID });
  console.log("[FUNDING_STATUS_UPDATE] status=completed", { orderID, userId, amount: amountNum });

  void emitEvent({
    supabaseClient: supabaseAdmin,
    targetUserId: userId,
    eventType: "funding.completed",
    category: "payments",
    severity: "success",
    title: "Wallet funded",
    message: `$${amountText} was added to your wallet.`,
    relatedTransactionId: transactionId,
    metadata: { orderID, amount: amountNum },
  });

  return res.status(200).json({
    success: true,
    amount: amountNum,
    orderID,
  });
}
