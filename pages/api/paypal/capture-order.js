import { createClient } from "@supabase/supabase-js";
import { capturePayPalOrder } from "../../../lib/paypal";
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
import { logOperationalError } from "../../../lib/operationalLogger";

const DEFAULT_SUPABASE_URL = "https://opbhcndlibbcsmoaeymq.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wYmhjbmRsaWJiY3Ntb2FleW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMTM4NjIsImV4cCI6MjA2NzU4OTg2Mn0.Scy3QTema-fyccjeado4ZHoL2s5fjND8useCatvJRyA";

function getSupabaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  );
}

function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  );
}

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
  if (!serviceRoleKey) {
    console.error("[paypal/capture-order] Missing SUPABASE_SERVICE_ROLE_KEY");
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

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

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

  let result;
  try {
    result = await capturePayPalOrder(orderID);
  } catch (err) {
    await logPaypalCaptureFailed(supabaseAdmin, {
      userId,
      orderID,
      message: err?.message,
    });
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "paypal.capture",
      message: err?.message || "PayPal capture threw",
      userId,
      route: "/api/paypal/capture-order",
      metadata: { orderID: orderID ? String(orderID).slice(0, 80) : null, phase: "capture_throw" },
    });
    console.error("[paypal/capture-order] PayPal capture failed:", err);
    console.error("[FUNDING_STATUS_UPDATE] status=failed phase=capture", { orderID });
    return res.status(502).json({
      error: err?.message || "Could not capture PayPal order",
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
    return res.status(502).json({
      error: "PayPal payment was not completed",
      paypalStatus: result.status,
    });
  }

  const amountStr =
    result.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
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

  if (amountNum > 1000) {
    return res.status(400).json({
      error: "Funding limit exceeded. Maximum sandbox funding amount is $1,000.",
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
    return res.status(500).json({
      error: fundError.message || "Could not credit wallet after payment",
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

  return res.status(200).json({
    success: true,
    amount: amountNum,
    orderID,
  });
}
