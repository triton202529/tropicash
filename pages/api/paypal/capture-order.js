import { createClient } from "@supabase/supabase-js";
import { capturePayPalOrder } from "../../../lib/paypal";
import { getPayPalMode } from "../../../lib/paypalMode";
import {
  claimFundingProcessingSlot,
  FUNDING_PROVIDER_PAYPAL,
  patchFundingIdempotencyRow,
  paypalCaptureIdFromResult,
  serializeSupabaseError,
} from "../../../lib/fundingIdempotency";
import {
  logConcurrentFunding,
  logDuplicateFundingBlocked,
  logFundingCreditFailed,
  logFundingInvalidCaptureAmount,
  logFundingNotificationDupCheckFailed,
  logFundingRetryForbidden,
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
import { emitAdminEvent, emitEvent, recordEventOnce } from "../../../lib/eventBus";
import { appendAuditEventServer } from "../../../lib/auditTimeline";

function formatMoney(value) {
  const n = Number(value);
  return Number(Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function transactionIdFromFundWalletRpc(data) {
  if (data == null) return null;
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    return data.transaction_id ?? data.id ?? null;
  }
  return null;
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

  const kycGate = await enforceServerKycForAction({
    userId,
    amount: Number.isFinite(expectedAmount) && expectedAmount > 0 ? expectedAmount : 1,
    actionType: "funding",
    supabaseClient: supabaseAdmin,
  });
  if (!kycGate.allowed) {
    void logServerKycBlocked({
      userId,
      amount: expectedAmount,
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

  let result;
  try {
    result = await capturePayPalOrder(orderID);
  } catch (err) {
    await logPaypalCaptureFailed(supabaseAdmin, {
      userId,
      orderID,
      message: err?.message,
    });
    const declineCode = err?.code || null;
    const userSafeError =
      declineCode === "PROCESSOR_DECLINED" || declineCode === "PAYER_ACTION_REQUIRED"
        ? err.message
        : "Could not capture PayPal order";
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "paypal.capture",
      message: err?.message || "PayPal capture threw",
      userId,
      route: "/api/paypal/capture-order",
      metadata: {
        orderID: orderID ? String(orderID).slice(0, 80) : null,
        phase: "capture_throw",
        code: declineCode,
        paypalIssue: err?.paypalIssue || null,
      },
    });
    console.error("[paypal/capture-order] PayPal capture failed:", err?.code || err?.message || err);
    console.error("[FUNDING_STATUS_UPDATE] status=failed phase=capture", { orderID });
    void recordEventOnce({
      supabaseClient: supabaseAdmin,
      targetUserId: userId,
      eventType: "funding.failed",
      category: "payments",
      severity: "warning",
      title: "Funding attempt failed",
      message: "We couldn't complete your wallet funding. Please try again or contact support if it persists.",
      metadata: { orderID, phase: "capture_throw", code: declineCode },
      dedupeKey: `funding.failed:${userId}:${orderID}`,
      windowMs: 5 * 60 * 1000,
    });
    void emitAdminEvent({
      supabaseClient: supabaseAdmin,
      eventType: "funding.failed",
      category: "payments",
      severity: "warning",
      title: "User funding failed",
      message: `Funding attempt failed for user during PayPal capture (order ${orderID}).`,
      actorUserId: userId,
      metadata: { orderID, phase: "capture_throw", userId, code: declineCode },
    });
    return res.status(502).json({
      error: userSafeError,
      code: declineCode || "PAYPAL_CAPTURE_FAILED",
    });
  }

  if (result.status !== "COMPLETED") {
    await logPaypalCaptureIncomplete(supabaseAdmin, {
      userId,
      orderID,
      paypalStatus: result.status,
    });
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "paypal.capture",
      message: `PayPal capture status not COMPLETED: ${result.status}`,
      userId,
      route: "/api/paypal/capture-order",
      metadata: { orderID: orderID ? String(orderID).slice(0, 80) : null, paypalStatus: result.status },
    });
    console.error("[paypal/capture-order] Unexpected PayPal status:", result.status);
    console.error("[FUNDING_STATUS_UPDATE] status=failed paypalStatus", {
      orderID,
      paypalStatus: result.status,
    });
    void recordEventOnce({
      supabaseClient: supabaseAdmin,
      targetUserId: userId,
      eventType: "funding.failed",
      category: "payments",
      severity: "warning",
      title: "Funding incomplete",
      message: "PayPal didn't confirm completion of your wallet funding. Please try again.",
      metadata: { orderID, phase: "paypal_status", paypalStatus: result.status },
      dedupeKey: `funding.failed:${userId}:${orderID}`,
      windowMs: 5 * 60 * 1000,
    });
    void emitAdminEvent({
      supabaseClient: supabaseAdmin,
      eventType: "funding.failed",
      category: "payments",
      severity: "warning",
      title: "PayPal capture incomplete",
      message: `PayPal status ${result.status} on order ${orderID}.`,
      actorUserId: userId,
      metadata: { orderID, phase: "paypal_status", paypalStatus: result.status, userId },
    });
    return res.status(502).json({
      error: "PayPal payment was not completed",
      paypalStatus: result.status,
    });
  }

  const captureUnit = result.purchase_units?.[0]?.payments?.captures?.[0];
  const captureStatus = captureUnit?.status != null ? String(captureUnit.status) : null;
  if (captureStatus && captureStatus !== "COMPLETED") {
    await logPaypalCaptureIncomplete(supabaseAdmin, {
      userId,
      orderID,
      paypalStatus: captureStatus,
    });
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "paypal.capture",
      message: `PayPal capture unit status not COMPLETED: ${captureStatus}`,
      userId,
      route: "/api/paypal/capture-order",
      metadata: {
        orderID: orderID ? String(orderID).slice(0, 80) : null,
        captureStatus,
      },
    });
    return res.status(502).json({
      error: "PayPal payment was not completed",
      paypalStatus: captureStatus,
      code: "CAPTURE_INCOMPLETE",
    });
  }

  const currencyCode =
    captureUnit?.amount?.currency_code != null
      ? String(captureUnit.amount.currency_code).toUpperCase()
      : null;
  if (currencyCode && currencyCode !== "USD") {
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "paypal.capture",
      message: `Unexpected capture currency: ${currencyCode}`,
      userId,
      route: "/api/paypal/capture-order",
      metadata: {
        orderID: orderID ? String(orderID).slice(0, 80) : null,
        currencyCode,
      },
    });
    return res.status(502).json({
      error: "PayPal payment currency is not supported for wallet funding",
      code: "CURRENCY_MISMATCH",
    });
  }

  const amountStr = captureUnit?.amount?.value;
  const amountNum = amountStr != null ? Number(String(amountStr)) : NaN;
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    await logFundingInvalidCaptureAmount(supabaseAdmin, { userId, orderID });
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "paypal.capture",
      message: "Invalid or missing capture amount from PayPal",
      userId,
      route: "/api/paypal/capture-order",
      metadata: { orderID: orderID ? String(orderID).slice(0, 80) : null },
    });
    console.error("[paypal/capture-order] Missing or invalid capture amount");
    return res.status(502).json({ error: "Could not read captured amount from PayPal" });
  }

  if (Number.isFinite(expectedAmount) && expectedAmount > 0) {
    const expectedCents = Math.round(expectedAmount * 100);
    const capturedCents = Math.round(amountNum * 100);
    if (expectedCents !== capturedCents) {
      void logOperationalError({
        supabaseClient: supabaseAdmin,
        category: "paypal.capture",
        message: "Client expected amount does not match PayPal capture amount",
        userId,
        route: "/api/paypal/capture-order",
        metadata: {
          orderID: orderID ? String(orderID).slice(0, 80) : null,
          expectedCents,
          capturedCents,
        },
      });
      return res.status(409).json({
        error: "Payment amount did not match the funding request. No wallet credit was applied.",
        code: "AMOUNT_MISMATCH",
      });
    }
  }

  if (amountNum > 1000) {
    const modeLabel = getPayPalMode() === "live" ? "configured" : "sandbox";
    return res.status(400).json({
      error: `Funding limit exceeded. Maximum ${modeLabel} funding amount is $1,000.`,
    });
  }

  if (amountNum < 1) {
    return res.status(400).json({
      error: "Minimum funding amount is $1.",
    });
  }

  const providerCaptureId = paypalCaptureIdFromResult(result);

  const claim = await claimFundingProcessingSlot(supabaseAdmin, {
    provider: FUNDING_PROVIDER_PAYPAL,
    providerOrderId: orderID,
    userId,
    amount: amountNum,
  });

  if (claim.kind === "error") {
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "funding.idempotency",
      message: "Funding idempotency claim failed",
      userId,
      route: "/api/paypal/capture-order",
      metadata: { orderID: orderID ? String(orderID).slice(0, 80) : null, detail: String(claim.error || "").slice(0, 500) },
    });
    console.error("[paypal/capture-order] idempotency claim failed:", claim.error);
    return res.status(500).json({ error: "Could not verify funding status" });
  }

  if (claim.kind === "duplicate_completed") {
    if (claim.row.user_id && claim.row.user_id !== userId) {
      console.error("[FUNDING_DUPLICATE_BLOCKED] user_mismatch", { orderID, userId });
      return res.status(403).json({ error: "This order is not associated with your account." });
    }
    await logDuplicateFundingBlocked(supabaseAdmin, {
      userId,
      orderID,
      amountNum,
      source: "idempotency",
    });
    console.log("[FUNDING_DUPLICATE_BLOCKED]", { orderID, userId, source: "idempotency" });
    console.log("[FUNDING_STATUS_UPDATE] status=completed duplicate=idempotency", {
      orderID,
      userId,
    });
    return res.status(200).json({
      success: true,
      duplicate: true,
      amount: amountNum,
      orderID,
    });
  }

  if (claim.kind === "already_processing") {
    await logConcurrentFunding(supabaseAdmin, { userId, orderID, amountNum });
    console.log("[FUNDING_DUPLICATE_BLOCKED]", { orderID, userId, source: "in_flight" });
    console.log("[FUNDING_STATUS_UPDATE] status=processing conflict=already_processing", {
      orderID,
      userId,
    });
    return res.status(409).json({
      error: "Funding for this PayPal order is already being processed.",
      code: "ALREADY_PROCESSING",
    });
  }

  if (claim.kind === "retry_forbidden") {
    await logFundingRetryForbidden(supabaseAdmin, { userId, orderID });
    return res.status(403).json({
      error: "This order cannot be retried for this account.",
      code: "RETRY_FORBIDDEN",
    });
  }

  const idempotencyRowId = claim.rowId;

  const { data: dupRows, error: dupErr } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .in("type", ["fund_wallet", "wallet_funded"])
    .ilike("message", `%${orderID}%`)
    .limit(1);

  if (dupErr) {
    await logFundingNotificationDupCheckFailed(supabaseAdmin, {
      userId,
      orderID,
      amountNum,
    });
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "funding.notification_dup_check",
      message: dupErr.message || "Notification duplicate check failed",
      userId,
      route: "/api/paypal/capture-order",
      metadata: {
        orderID: orderID ? String(orderID).slice(0, 80) : null,
        code: dupErr.code,
        amountNum,
      },
    });
    console.error("[paypal/capture-order] duplicate check failed:", dupErr);
    await patchFundingIdempotencyRow(supabaseAdmin, idempotencyRowId, {
      status: "failed",
      raw_response: { phase: "notification_duplicate_check", error: serializeSupabaseError(dupErr) },
    });
    console.error("[FUNDING_STATUS_UPDATE] status=failed phase=notification_dup_check", {
      orderID,
      userId,
    });
    return res.status(500).json({ error: "Could not verify funding status" });
  }
  if (dupRows && dupRows.length > 0) {
    await logDuplicateFundingBlocked(supabaseAdmin, {
      userId,
      orderID,
      amountNum,
      source: "notification_fallback",
    });
    console.log("[FUNDING_DUPLICATE_BLOCKED]", { orderID, userId, source: "notification_fallback" });
    await patchFundingIdempotencyRow(supabaseAdmin, idempotencyRowId, {
      status: "completed",
      provider_capture_id: providerCaptureId,
      raw_response: { paypal: result, duplicateVia: "notification_fallback" },
    });
    console.log("[FUNDING_STATUS_UPDATE] status=completed duplicate=notification_fallback", {
      orderID,
      userId,
    });
    return res.status(200).json({
      success: true,
      duplicate: true,
      amount: amountNum,
      orderID,
    });
  }

  console.log("[FUNDING_STATUS_UPDATE] status=processing", { orderID, userId });

  const { data: fundData, error: fundError } = await supabaseAdmin.rpc("fund_wallet", {
    p_user_id: userId,
    p_amount: amountNum,
  });
  if (fundError) {
    await logFundingCreditFailed(supabaseAdmin, {
      userId,
      orderID,
      amountNum,
      fundWalletError: serializeSupabaseError(fundError),
    });
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "wallet.fund_wallet_rpc",
      message: fundError.message || "fund_wallet RPC failed after PayPal capture",
      userId,
      route: "/api/paypal/capture-order",
      metadata: {
        orderID: orderID ? String(orderID).slice(0, 80) : null,
        amountNum,
        supabase: serializeSupabaseError(fundError),
      },
    });
    console.error("[paypal/capture-order] fund_wallet RPC failed:", fundError);
    console.error("[FUNDING_STATUS_UPDATE] status=failed phase=fund_wallet_rpc", { orderID, userId });
    await patchFundingIdempotencyRow(supabaseAdmin, idempotencyRowId, {
      status: "failed",
      provider_capture_id: providerCaptureId,
      raw_response: { paypal: result, fund_wallet: serializeSupabaseError(fundError) },
    });
    void recordEventOnce({
      supabaseClient: supabaseAdmin,
      targetUserId: userId,
      eventType: "funding.failed",
      category: "payments",
      severity: "warning",
      title: "Funding could not be credited",
      message: "Your PayPal payment captured but we couldn't credit your wallet. Support has been notified.",
      metadata: { orderID, phase: "fund_wallet_rpc" },
      dedupeKey: `funding.failed:${userId}:${orderID}`,
      windowMs: 5 * 60 * 1000,
    });
    void emitAdminEvent({
      supabaseClient: supabaseAdmin,
      eventType: "funding.failed",
      category: "payments",
      severity: "critical",
      title: "Wallet credit failed after capture",
      message: `fund_wallet RPC failed after PayPal capture for order ${orderID}.`,
      actorUserId: userId,
      metadata: { orderID, phase: "fund_wallet_rpc", userId, code: fundError?.code || null },
    });
    return res.status(500).json({
      error: "Could not credit wallet after payment",
    });
  }

  const transactionId = transactionIdFromFundWalletRpc(fundData);

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
      metadata: { orderID: orderID ? String(orderID).slice(0, 80) : null, code: notifError.code },
    });
    console.error("[paypal/capture-order] create_notification failed:", notifError);
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
        orderID: orderID ? String(orderID).slice(0, 80) : null,
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

  await patchFundingIdempotencyRow(supabaseAdmin, idempotencyRowId, {
    status: "completed",
    transaction_id: transactionId,
    notification_id: notificationId,
    provider_capture_id: providerCaptureId,
    raw_response: result,
  });
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
