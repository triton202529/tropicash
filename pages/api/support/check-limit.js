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

  let userId = null;
  if (jwt) {
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();
    if (supabaseUrl && anonKey) {
      try {
        const supabaseAuth = createClient(supabaseUrl, anonKey);
        const {
          data: { user },
        } = await supabaseAuth.auth.getUser(jwt);
        if (user?.id) userId = user.id;
      } catch (e) {
        void logOperationalError({
          category: "auth.session",
          message: e?.message || "support/check-limit auth.getUser threw",
          userId: null,
          route: "/api/support/check-limit",
          metadata: {},
        });
      }
    }
  }

  const admin = createSupabaseServiceClient();
  if (!admin) {
    void logOperationalError({
      category: "env.config",
      message: "Missing SUPABASE_SERVICE_ROLE_KEY on /api/support/check-limit",
      userId,
      route: "/api/support/check-limit",
      metadata: {},
    });
    return res.status(500).json({ error: "Server configuration error" });
  }

  const ip = extractClientIp(req);
  const limitKey = buildRateLimitKey({ userId, ip });
  if (!limitKey) {
    return res.status(200).json({ allowed: true, retryAfterSec: null });
  }

  const limit = await incrementRateLimit({
    supabaseClient: admin,
    category: "support.feedback_submit",
    key: limitKey,
  });

  if (!limit.allowed) {
    const retryAfter = limit.retryAfterSec ?? 60;
    res.setHeader("Retry-After", String(retryAfter));
    void logOperationalEvent({
      level: "warn",
      supabaseClient: admin,
      category: "abuse.rate_limit",
      message: "support.feedback_submit rate-limit triggered",
      userId,
      route: "/api/support/check-limit",
      metadata: {
        subcategory: "support.feedback_submit",
        limitCategory: "support.feedback_submit",
        key: limitKey,
        count: limit.count,
        retryAfterSec: retryAfter,
      },
    });
    if (userId) {
      void emitEvent({
        supabaseClient: admin,
        targetUserId: userId,
        eventType: "security.rate_limit",
        category: "security",
        severity: "warning",
        title: "Feedback rate limit reached",
        message: "You've sent us a lot of feedback in a short time. Please try again in a bit.",
        metadata: { limitCategory: "support.feedback_submit", retryAfterSec: retryAfter },
      });
    }
    void recordEventOnce({
      supabaseClient: admin,
      adminTarget: true,
      eventType: "security.rate_limit",
      category: "admin",
      severity: "warning",
      title: "Rate limit hit",
      message: "User or anonymous IP hit rate limit on support.feedback_submit.",
      actorUserId: userId,
      metadata: { limitCategory: "support.feedback_submit", retryAfterSec: retryAfter, key: limitKey, userId },
      dedupeKey: `rate_limit.${limitKey}.support.feedback_submit`,
      windowMs: 10 * 60 * 1000,
    });
    void appendAuditEventServer({
      entityType: userId ? "user" : "admin_action",
      entityId: userId || limitKey,
      eventType: "abuse.rate_limit",
      actorUserId: userId,
      targetUserId: userId,
      severity: "warning",
      title: "Support feedback rate limit",
      description: "support.feedback_submit soft limit exceeded.",
      metadata: { limitCategory: "support.feedback_submit", retryAfterSec: retryAfter },
      dedupeKey: `audit:rate:${limitKey}:support.feedback_submit`,
      dedupeWindowMs: 10 * 60 * 1000,
    });
    return res.status(429).json({
      error: "You've sent us a lot of feedback in a short time. Please try again in a bit.",
      retryAfterSec: retryAfter,
    });
  }

  return res.status(200).json({ allowed: true, retryAfterSec: null });
}
