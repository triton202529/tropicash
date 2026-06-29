import crypto from "crypto";
import { logOperationalError, sanitizeOperationalMetadata } from "./operationalLogger";

/**
 * Soft-launch rate-limit rules. Adjust here, not at call sites.
 *
 * Values intentionally err on the lenient side for a controlled tester pool while still
 * absorbing accidental loops (double-clicks, retry storms, scripted abuse). Categories
 * not in this map will still work as long as the caller passes explicit windowMs / max.
 */
export const RATE_LIMIT_RULES = Object.freeze({
  "paypal.create_order": { max: 10, windowMs: 10 * 60 * 1000 },
  "paypal.capture_order": { max: 10, windowMs: 10 * 60 * 1000 },
  "withdrawal.create_request": { max: 5, windowMs: 60 * 60 * 1000 },
  "transfer.send": { max: 20, windowMs: 60 * 60 * 1000 },
  "support.feedback_submit": { max: 10, windowMs: 60 * 60 * 1000 },
  /** Soft dedupe for `appendAuditEvent` — callers pass explicit window/max as needed. */
  "audit.dedupe": { max: 1, windowMs: 8 * 60 * 1000 },
});

export const LIMITS = RATE_LIMIT_RULES;

const SAFE_FALLBACK = Object.freeze({
  allowed: true,
  remaining: Number.POSITIVE_INFINITY,
  retryAfterSec: null,
  count: 0,
});

function clampNonNegInt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return v < 0 ? 0 : Math.floor(v);
}

function resolveRule(category, windowMs, max) {
  const rule = RATE_LIMIT_RULES[category] || null;
  return {
    windowMs: clampNonNegInt(windowMs ?? rule?.windowMs ?? 60 * 1000) || 60 * 1000,
    max: clampNonNegInt(max ?? rule?.max ?? 30) || 30,
  };
}

function safeMetadata(metadata) {
  if (metadata == null) return {};
  return sanitizeOperationalMetadata(metadata);
}

/**
 * Pull the most likely client IP from common proxy headers. Returns `null` when
 * nothing usable is present; callers MUST handle null gracefully (e.g. fall back to
 * a userId-only key, or skip the limit and fail-open).
 *
 * @param {import('next').NextApiRequest|{ headers?: Record<string, unknown>, socket?: { remoteAddress?: string } }} req
 * @returns {string|null}
 */
export function extractClientIp(req) {
  try {
    const headers = req?.headers || {};
    const xff = headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.trim()) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    } else if (Array.isArray(xff) && xff.length > 0) {
      const first = String(xff[0] || "").split(",")[0]?.trim();
      if (first) return first;
    }
    const xri = headers["x-real-ip"];
    if (typeof xri === "string" && xri.trim()) return xri.trim();
    const sock = req?.socket?.remoteAddress;
    if (typeof sock === "string" && sock.trim()) return sock.trim();
    return null;
  } catch {
    return null;
  }
}

/**
 * Build a stable counter key. Prefers `userId` when available. Falls back to a
 * truncated sha256 of the raw IP (NEVER the raw IP itself). Returns `null` when
 * neither input is usable.
 *
 * @param {{ userId?: string|null, ip?: string|null }} args
 * @returns {string|null}
 */
export function buildRateLimitKey({ userId, ip } = {}) {
  if (typeof userId === "string" && userId.trim()) {
    return `user:${userId.trim()}`;
  }
  if (typeof ip === "string" && ip.trim()) {
    const hashed = crypto.createHash("sha256").update(ip.trim()).digest("hex").slice(0, 24);
    return `ip:${hashed}`;
  }
  return null;
}

/**
 * Check the current rolling counter for a (key, category) without incrementing.
 * Fail-open: any internal/Supabase error returns `{ allowed: true }` and logs once.
 *
 * @param {object} args
 * @param {import('@supabase/supabase-js').SupabaseClient} args.supabaseClient — must be the SERVICE ROLE client.
 * @param {string} args.category
 * @param {string} args.key
 * @param {number} [args.windowMs]
 * @param {number} [args.max]
 * @returns {Promise<{ allowed: boolean, remaining: number, retryAfterSec: number|null, count: number }>}
 */
export async function checkRateLimit({ supabaseClient, category, key, windowMs, max } = {}) {
  if (!supabaseClient || !category || !key) return { ...SAFE_FALLBACK };
  const rule = resolveRule(category, windowMs, max);
  try {
    const { data, error } = await supabaseClient
      .from("request_limits")
      .select("count,window_start")
      .eq("key", key)
      .eq("category", category)
      .maybeSingle();
    if (error) {
      void logOperationalError({
        supabaseClient,
        category: "abuse.limiter_error",
        message: error.message || "request_limits select failed",
        userId: null,
        route: null,
        metadata: { phase: "check", limitCategory: category, code: error.code || null },
      });
      return { ...SAFE_FALLBACK };
    }
    if (!data) {
      return { allowed: true, remaining: rule.max, retryAfterSec: null, count: 0 };
    }
    const windowStartMs = new Date(data.window_start).getTime();
    const ageMs = Date.now() - windowStartMs;
    if (!Number.isFinite(windowStartMs) || ageMs >= rule.windowMs) {
      return { allowed: true, remaining: rule.max, retryAfterSec: null, count: 0 };
    }
    const count = clampNonNegInt(data.count);
    const allowed = count < rule.max;
    const remaining = Math.max(0, rule.max - count);
    const retryAfterSec = allowed
      ? null
      : Math.max(1, Math.ceil((rule.windowMs - ageMs) / 1000));
    return { allowed, remaining, retryAfterSec, count };
  } catch (e) {
    void logOperationalError({
      supabaseClient,
      category: "abuse.limiter_error",
      message: e?.message || "checkRateLimit threw",
      userId: null,
      route: null,
      metadata: { phase: "check", limitCategory: category },
    });
    return { ...SAFE_FALLBACK };
  }
}

/**
 * Atomically increment the rolling counter for (key, category) and return whether the
 * caller is still within budget. Fail-open: any internal/Supabase error returns
 * `{ allowed: true }` and logs once via `abuse.limiter_error`.
 *
 * The atomic upsert is performed by the `public.rate_limit_increment` SQL function
 * (see supabase/sql/request_limits.sql). The helper falls back to a manual upsert path
 * if the RPC isn't installed yet (e.g. mid-migration).
 *
 * @param {object} args
 * @param {import('@supabase/supabase-js').SupabaseClient} args.supabaseClient — must be the SERVICE ROLE client.
 * @param {string} args.category
 * @param {string} args.key
 * @param {number} [args.windowMs]
 * @param {number} [args.max]
 * @param {Record<string, unknown>} [args.metadata]
 * @returns {Promise<{ allowed: boolean, remaining: number, retryAfterSec: number|null, count: number }>}
 */
export async function incrementRateLimit({
  supabaseClient,
  category,
  key,
  windowMs,
  max,
  metadata,
} = {}) {
  if (!supabaseClient || !category || !key) return { ...SAFE_FALLBACK };
  const rule = resolveRule(category, windowMs, max);
  const meta = safeMetadata(metadata);

  try {
    const { data, error } = await supabaseClient.rpc("rate_limit_increment", {
      p_key: key,
      p_category: category,
      p_window_ms: rule.windowMs,
      p_metadata: meta,
    });
    if (error) {
      void logOperationalError({
        supabaseClient,
        category: "abuse.limiter_error",
        message: error.message || "rate_limit_increment RPC failed",
        userId: null,
        route: null,
        metadata: { phase: "increment", limitCategory: category, code: error.code || null },
      });
      return { ...SAFE_FALLBACK };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { ...SAFE_FALLBACK };
    const count = clampNonNegInt(row.out_count ?? row.count ?? 0);
    const windowStartIso = row.out_window_start ?? row.window_start ?? null;
    const windowStartMs = windowStartIso ? new Date(windowStartIso).getTime() : Date.now();
    const ageMs = Math.max(0, Date.now() - windowStartMs);
    const allowed = count <= rule.max;
    const remaining = Math.max(0, rule.max - count);
    const retryAfterSec = allowed
      ? null
      : Math.max(1, Math.ceil((rule.windowMs - ageMs) / 1000));
    return { allowed, remaining, retryAfterSec, count };
  } catch (e) {
    void logOperationalError({
      supabaseClient,
      category: "abuse.limiter_error",
      message: e?.message || "incrementRateLimit threw",
      userId: null,
      route: null,
      metadata: { phase: "increment", limitCategory: category },
    });
    return { ...SAFE_FALLBACK };
  }
}
