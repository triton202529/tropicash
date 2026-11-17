import { createClient } from "@supabase/supabase-js";
import { createPayPalOrder } from "../../../lib/paypal";
import { payPalConfigGateForMoneyApi } from "../../../lib/paypalProductionGuard";
import { logOperationalError, logOperationalEvent } from "../../../lib/operationalLogger";
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
import { createSupabaseServiceClient, getSupabaseAnonKey, getSupabaseUrl } from "../../../lib/supabaseAdminApi";
import {
  buildRateLimitKey,
  extractClientIp,
  incrementRateLimit,
} from "../../../lib/rateLimit";
import { recordEventOnce } from "../../../lib/eventBus";
import { appendAuditEventServer } from "../../../lib/auditTimeline";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const raw = body?.amount;
  const amount = typeof raw === "string" ? parseFloat(raw) : Number(raw);

  if (raw === undefined || raw === null || raw === "") {
    return res.status(400).json({ error: "amount is required" });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a number greater than 0" });
  }
  const normalizedAmount = Math.round(amount * 100) / 100;
  if (normalizedAmount < 1) {
    return res.status(400).json({ error: "Minimum funding amount is $1." });
  }
  if (normalizedAmount > 1000) {
    return res.status(400).json({ error: "Funding limit exceeded. Maximum funding amount is $1,000." });
  }

  const authHeader = req.headers.authorization;
  const jwt =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
  if (!jwt) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !anonKey) {
    void logOperationalError({
      category: "env.config",
      message: "Missing Supabase env on /api/paypal/create-order",
      userId: null,
      route: "/api/paypal/create-order",
      metadata: {},
    });
    return res.status(500).json({ success: false, error: "Server configuration error" });
  }

  const supabaseAuth = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(jwt);
  if (authError || !user?.id) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
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

  const admin = createSupabaseServiceClient();
  if (!admin) {
    return res.status(500).json({ success: false, error: "Server configuration error" });
  }

  const kycGate = await enforceServerKycForAction({
    userId,
    amount: normalizedAmount,
    actionType: "funding",
    supabaseClient: admin,
  });
  if (!kycGate.allowed) {
    void logServerKycBlocked({
      userId,
      amount: normalizedAmount,
      actionType: "funding",
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
  const limitKey = buildRateLimitKey({ ip });
  if (admin && limitKey) {
    const limit = await incrementRateLimit({
      supabaseClient: admin,
      category: "paypal.create_order",
      key: limitKey,
    });
    if (!limit.allowed) {
      const retryAfter = limit.retryAfterSec ?? 60;
      res.setHeader("Retry-After", String(retryAfter));
      void logOperationalEvent({
        level: "warn",
        supabaseClient: admin,
        category: "abuse.funding",
        message: "paypal.create_order rate-limit triggered",
        userId,
        route: "/api/paypal/create-order",
        metadata: {
          limitCategory: "paypal.create_order",
          key: limitKey,
          count: limit.count,
          retryAfterSec: retryAfter,
        },
      });
      void recordEventOnce({
        supabaseClient: admin,
        adminTarget: true,
        eventType: "security.rate_limit",
        category: "admin",
        severity: "warning",
        title: "Rate limit hit",
        message: "Anonymous IP hit rate limit on paypal.create_order.",
        metadata: { limitCategory: "paypal.create_order", retryAfterSec: retryAfter, key: limitKey },
        dedupeKey: `rate_limit.${limitKey}.paypal.create_order`,
        windowMs: 10 * 60 * 1000,
      });
      void appendAuditEventServer({
        entityType: "admin_action",
        entityId: limitKey,
        eventType: "abuse.rate_limit",
        severity: "warning",
        title: "PayPal create-order rate limit",
        description: "paypal.create_order soft limit exceeded.",
        metadata: { limitCategory: "paypal.create_order", retryAfterSec: retryAfter },
        dedupeKey: `audit:rate:${limitKey}:paypal.create_order`,
        dedupeWindowMs: 10 * 60 * 1000,
      });
      return res.status(429).json({
        error: "Too many funding attempts. Please wait a few minutes and try again.",
        retryAfterSec: retryAfter,
      });
    }
  }

  try {
    const order = await createPayPalOrder(normalizedAmount);
    const { error: bindError } = await admin.from("paypal_funding_orders").insert({
      provider: "paypal",
      provider_order_id: order.id,
      user_id: userId,
      amount: normalizedAmount,
      currency: "USD",
      status: "created",
    });
    if (bindError) {
      void logOperationalError({
        supabaseClient: admin,
        category: "paypal.create_order",
        message: "PayPal order was created but the Tropicash ownership record was not saved",
        userId,
        route: "/api/paypal/create-order",
        metadata: {
          orderID: order.id ? String(order.id).slice(0, 80) : null,
          code: bindError.code || null,
        },
      });
      return res.status(502).json({ error: "Could not create PayPal order" });
    }
    return res.status(200).json({ orderID: order.id });
  } catch (err) {
    console.error("[paypal/create-order]", err);
    const rawMsg = err?.message || String(err) || "createPayPalOrder failed";
    void logOperationalError({
      supabaseClient: admin,
      category: "paypal.create_order",
      message: rawMsg,
      userId,
      route: "/api/paypal/create-order",
      metadata: { amount: normalizedAmount, rawError: rawMsg.slice(0, 500) },
    });
    return res.status(502).json({ error: "Could not create PayPal order" });
  }
}
