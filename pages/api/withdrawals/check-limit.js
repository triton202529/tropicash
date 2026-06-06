import { createClient } from "@supabase/supabase-js";
import { logOperationalError, logOperationalEvent } from "../../../lib/operationalLogger";
import {
  createSupabaseServiceClient,
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "../../../lib/supabaseAdminApi";
import {
  buildRateLimitKey,
  extractClientIp,
  incrementRateLimit,
} from "../../../lib/rateLimit";
import { emitEvent, recordEventOnce } from "../../../lib/eventBus";
import { appendAuditEventServer } from "../../../lib/auditTimeline";
import {
  accountRestrictedHttpBody,
  canServerPerformFinancialAction,
  logServerBlockedFinancialAction,
} from "../../../lib/serverAccountSecurityGuard";
import {
  enforceServerKycForWithdrawal,
  KYC_WITHDRAWAL_BLOCKED_ERROR,
  KYC_WITHDRAWAL_BLOCKED_USER_MESSAGE,
  logServerKycWithdrawalBlocked,
} from "../../../lib/serverKycWithdrawalGuard";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

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
  if (!supabaseUrl || !anonKey) {
    void logOperationalError({
      category: "env.config",
      message: "Missing Supabase env on /api/withdrawals/check-limit",
      userId: null,
      route: "/api/withdrawals/check-limit",
      metadata: { hasUrl: !!supabaseUrl, hasAnon: !!anonKey },
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
    void logOperationalError({
      category: "env.config",
      message: "Missing SUPABASE_SERVICE_ROLE_KEY on /api/withdrawals/check-limit",
      userId,
      route: "/api/withdrawals/check-limit",
      metadata: {},
    });
    return res.status(500).json({ error: "Server configuration error" });
  }

  const rawAmount = req.body?.amount;
  let kycUsagePayload = null;
  if (rawAmount != null && rawAmount !== "") {
    const kycGate = await enforceServerKycForWithdrawal({
      userId,
      amount: rawAmount,
      supabaseClient: admin,
    });
    if (kycGate.enforcement) {
      kycUsagePayload = {
        usedToday: kycGate.enforcement.usedToday ?? null,
        remainingToday: kycGate.enforcement.remainingToday ?? null,
        projectedTotal: kycGate.enforcement.projectedTotal ?? null,
        limit: kycGate.enforcement.limit ?? null,
        enforcementMode: kycGate.enforcement.mode ?? null,
        kycStatus: kycGate.enforcement.kycStatus ?? null,
      };
    }
    if (!kycGate.allowed) {
      if (kycGate.enforcement) {
        void logServerKycWithdrawalBlocked({
          userId,
          amount: Number(rawAmount),
          enforcement: kycGate.enforcement,
          supabaseClient: admin,
        });
      }
      void logOperationalEvent({
        level: "warn",
        supabaseClient: admin,
        category: "kyc.withdrawal_blocked",
        message: "Server blocked withdrawal create due to KYC policy",
        userId,
        route: "/api/withdrawals/check-limit",
        metadata: {
          amount: Number(rawAmount),
          kyc_status: kycGate.enforcement?.kycStatus ?? null,
          enforcement_mode: kycGate.enforcement?.mode ?? null,
          limit: kycGate.enforcement?.limit ?? null,
          used_today: kycGate.enforcement?.usedToday ?? null,
          projected_total: kycGate.enforcement?.projectedTotal ?? null,
          reason: kycGate.enforcement?.reason ?? null,
        },
      });
      return res.status(403).json({
        success: false,
        error: kycGate.error || KYC_WITHDRAWAL_BLOCKED_ERROR,
        message: kycGate.message || KYC_WITHDRAWAL_BLOCKED_USER_MESSAGE,
        ...kycUsagePayload,
      });
    }
  }

  const ip = extractClientIp(req);
  const limitKey = buildRateLimitKey({ userId, ip });
  if (!limitKey) {
    return res.status(200).json({ allowed: true, retryAfterSec: null });
  }

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
      route: "/api/withdrawals/check-limit",
      metadata: {
        limitCategory: "withdrawal.create_request",
        key: limitKey,
        count: limit.count,
        retryAfterSec: retryAfter,
      },
    });
    void emitEvent({
      supabaseClient: admin,
      targetUserId: userId,
      eventType: "security.rate_limit",
      category: "security",
      severity: "warning",
      title: "Withdrawal rate limit reached",
      message: "You've submitted several withdrawal requests recently. Please wait a bit and try again.",
      metadata: { limitCategory: "withdrawal.create_request", retryAfterSec: retryAfter },
    });
    void recordEventOnce({
      supabaseClient: admin,
      adminTarget: true,
      eventType: "security.rate_limit",
      category: "admin",
      severity: "warning",
      title: "Rate limit hit",
      message: "User hit rate limit on withdrawal.create_request.",
      actorUserId: userId,
      metadata: { limitCategory: "withdrawal.create_request", retryAfterSec: retryAfter, userId, key: limitKey },
      dedupeKey: `rate_limit.${limitKey}.withdrawal.create_request`,
      windowMs: 10 * 60 * 1000,
    });
    void appendAuditEventServer({
      entityType: userId ? "user" : "admin_action",
      entityId: userId || limitKey,
      eventType: "abuse.rate_limit",
      actorUserId: userId,
      targetUserId: userId,
      severity: "warning",
      title: "Withdrawal create rate limit",
      description: "User exceeded withdrawal.create_request soft limit.",
      metadata: { limitCategory: "withdrawal.create_request", retryAfterSec: retryAfter },
      dedupeKey: `audit:rate:${limitKey}:withdrawal.create_request`,
      dedupeWindowMs: 10 * 60 * 1000,
    });
    return res.status(429).json({
      error: "You've submitted several withdrawal requests recently. Please wait a bit and try again.",
      retryAfterSec: retryAfter,
    });
  }

  return res.status(200).json({
    allowed: true,
    retryAfterSec: null,
    ...(kycUsagePayload || {}),
  });
}
