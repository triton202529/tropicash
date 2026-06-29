/**
 * Tropicash Unified Notification & Event Center — Phase 1 event bus.
 *
 * Single entry point for emitting cross-cutting events into public.notifications.
 * Fail-open: every helper here swallows its own errors (logged via operationalLogger)
 * so that wiring an event into a hot payment path can NEVER take that path down.
 *
 * Allowed categories and severities are defined here and ALSO mirrored as a comment
 * in supabase/sql/notifications_event_center.sql. The DB intentionally has no CHECK
 * constraint on these — adding a new category must NOT require a migration.
 */

import crypto from "crypto";
import { resolvePrimaryAdminUserId } from "./adminMembers";
import { sanitizeOperationalMetadata, logOperationalError, logOperationalEvent } from "./operationalLogger";
import { incrementRateLimit } from "./rateLimit";
import { appendAuditEvent } from "./auditTimeline";

export const CATEGORIES = Object.freeze([
  "system",
  "security",
  "payments",
  "treasury",
  "fraud",
  "triton",
  "admin",
  "account",
]);

export const CATEGORY_SET = new Set(CATEGORIES);

export const SEVERITIES = Object.freeze(["info", "success", "warning", "critical"]);

export const SEVERITY_SET = new Set(SEVERITIES);

const DEFAULT_CATEGORY = "system";
const DEFAULT_SEVERITY = "info";

const LEGACY_TYPE_ALLOWLIST = new Set([
  "fund_wallet",
  "receive_money",
  "send_money",
  "withdraw_wallet",
  "admin_withdrawal_request",
  "withdrawal_processing",
  "withdrawal_paid",
  "withdrawal_rejected",
  "withdrawal_payout_processing",
  "withdrawal_payout_failed",
  "money_sent",
  "money_received",
  "wallet_funded",
  "triton_transfer_update",
  "security_suspicious_login",
  "security_session_revoked",
  "security_account_activity",
]);

function clampString(value, maxLen) {
  if (value == null) return null;
  const s = String(value);
  if (!s.length) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

async function resolveClient(explicit) {
  if (explicit) return explicit;
  if (typeof window !== "undefined") {
    const mod = await import("./supabaseClient.js");
    return mod.supabase || null;
  }
  const mod = await import("./supabaseAdminApi.js");
  return mod.createSupabaseServiceClient();
}

function validateCategory(raw) {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!v) return { value: DEFAULT_CATEGORY, fallback: false };
  if (CATEGORY_SET.has(v)) return { value: v, fallback: false };
  return { value: DEFAULT_CATEGORY, fallback: true, raw };
}

function validateSeverity(raw) {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!v) return { value: DEFAULT_SEVERITY, fallback: false };
  if (SEVERITY_SET.has(v)) return { value: v, fallback: false };
  return { value: DEFAULT_SEVERITY, fallback: true, raw };
}

function validateLegacyType(raw) {
  if (raw == null) return null;
  const v = String(raw).trim();
  if (!v) return null;
  if (LEGACY_TYPE_ALLOWLIST.has(v)) return v;
  return null;
}

/**
 * Insert a row into public.notifications. Returns `{ data, error }` like Supabase
 * but NEVER throws. Insert failures log to operational_logs (category + code only,
 * no metadata content) and are silently absorbed.
 *
 * @param {object} args
 * @param {string} args.targetUserId — recipient (notifications.user_id).
 * @param {string} [args.type] — legacy `notifications.type` (must be in allowlist,
 *   otherwise dropped and column left NULL).
 * @param {string} [args.eventType] — new event identifier (e.g. funding.completed).
 * @param {string} args.title
 * @param {string} args.message
 * @param {string} [args.category]
 * @param {string} [args.severity]
 * @param {string|null} [args.actorUserId]
 * @param {string|null} [args.relatedTransactionId]
 * @param {Record<string, unknown>} [args.metadata]
 * @param {import('@supabase/supabase-js').SupabaseClient} [args.supabaseClient]
 * @returns {Promise<{ data: any, error: any }>}
 */
export async function emitEvent(args) {
  try {
    const targetUserId = typeof args?.targetUserId === "string" ? args.targetUserId.trim() : "";
    if (!targetUserId) {
      void logOperationalEvent({
        level: "warn",
        category: "notification.emit_skipped",
        message: "emitEvent called without targetUserId",
        userId: null,
        route: null,
        metadata: { eventType: args?.eventType ? String(args.eventType).slice(0, 80) : null },
      });
      return { data: null, error: new Error("missing targetUserId") };
    }

    const title = clampString(args?.title, 200) ?? "Tropicash";
    const message = clampString(args?.message, 2000) ?? "";
    if (!message) {
      void logOperationalEvent({
        level: "warn",
        category: "notification.emit_skipped",
        message: "emitEvent called without message",
        userId: targetUserId,
        route: null,
        metadata: { eventType: args?.eventType ? String(args.eventType).slice(0, 80) : null },
      });
      return { data: null, error: new Error("missing message") };
    }

    const cat = validateCategory(args?.category);
    const sev = validateSeverity(args?.severity);

    if (cat.fallback) {
      void logOperationalEvent({
        level: "warn",
        category: "notification.emit_invalid_category",
        message: "emitEvent received an unknown category; coerced to system",
        userId: targetUserId,
        route: null,
        metadata: { rawCategory: clampString(cat.raw, 80) },
      });
    }
    if (sev.fallback) {
      void logOperationalEvent({
        level: "warn",
        category: "notification.emit_invalid_severity",
        message: "emitEvent received an unknown severity; coerced to info",
        userId: targetUserId,
        route: null,
        metadata: { rawSeverity: clampString(sev.raw, 80) },
      });
    }

    const legacyType = validateLegacyType(args?.type);
    const eventType = clampString(args?.eventType, 120);
    const actorUserId =
      typeof args?.actorUserId === "string" && args.actorUserId.trim() ? args.actorUserId.trim() : null;
    const relatedTransactionId =
      typeof args?.relatedTransactionId === "string" && args.relatedTransactionId.trim()
        ? args.relatedTransactionId.trim()
        : null;

    const sanitizedMeta = sanitizeOperationalMetadata(
      args?.metadata && typeof args.metadata === "object" && !Array.isArray(args.metadata) ? args.metadata : {},
    );

    const client = await resolveClient(args?.supabaseClient);
    if (!client) {
      void logOperationalError({
        category: "notification.emit_failed",
        message: "emitEvent could not resolve a Supabase client",
        userId: targetUserId,
        route: null,
        metadata: { eventType: eventType ? String(eventType).slice(0, 80) : null },
      });
      return { data: null, error: new Error("no client") };
    }

    const row = {
      user_id: targetUserId,
      type: legacyType,
      title,
      message,
      is_read: false,
      read_at: null,
      category: cat.value,
      severity: sev.value,
      event_type: eventType,
      actor_user_id: actorUserId,
      metadata: sanitizedMeta,
      related_transaction_id: relatedTransactionId,
    };

    const { data, error } = await client.from("notifications").insert(row).select("id").maybeSingle();
    if (error) {
      void logOperationalError({
        supabaseClient: client,
        category: "notification.emit_failed",
        message: "notifications insert failed",
        userId: targetUserId,
        route: null,
        metadata: {
          code: error.code || null,
          eventType: eventType ? String(eventType).slice(0, 80) : null,
          severity: sev.value,
          notificationCategory: cat.value,
        },
      });
      void appendAuditEvent({
        entityType: "notification",
        entityId: targetUserId,
        eventType: "notification.emit_failed",
        actorUserId,
        targetUserId,
        severity: "warning",
        title: "Notification insert failed",
        description: "Could not persist notification row.",
        metadata: {
          code: error.code || null,
          eventType: eventType ? String(eventType).slice(0, 80) : null,
          notificationCategory: cat.value,
        },
        dedupeKey: `audit:notification:emit_fail:${targetUserId}:${eventType || ""}:${error.code || "unknown"}`.slice(0, 400),
        dedupeWindowMs: 8 * 60 * 1000,
      });
      return { data: null, error };
    }
    return { data, error: null };
  } catch (e) {
    void logOperationalError({
      category: "notification.emit_failed",
      message: e?.message || "emitEvent threw",
      userId: typeof args?.targetUserId === "string" ? args.targetUserId : null,
      route: null,
      metadata: {
        eventType: args?.eventType ? String(args.eventType).slice(0, 80) : null,
        threw: true,
      },
    });
    return { data: null, error: e };
  }
}

let cachedPrimaryAdminId = null;
let cachedPrimaryAdminAt = 0;
const ADMIN_LOOKUP_TTL_MS = 5 * 60 * 1000;

async function resolvePrimaryAdminId(client) {
  if (cachedPrimaryAdminId && Date.now() - cachedPrimaryAdminAt < ADMIN_LOOKUP_TTL_MS) {
    return cachedPrimaryAdminId;
  }
  const id = await resolvePrimaryAdminUserId(client);
  if (id) {
    cachedPrimaryAdminId = id;
    cachedPrimaryAdminAt = Date.now();
  }
  return id;
}

/**
 * Convenience: route an event to the primary admin (admin_members table).
 * If the admin id cannot be resolved we silently skip — never throws.
 *
 * @param {Omit<Parameters<typeof emitEvent>[0], 'targetUserId'> & { adminPrimaryId?: string | null }} args
 */
export async function emitAdminEvent(args) {
  try {
    const client = await resolveClient(args?.supabaseClient);
    const adminId =
      (typeof args?.adminPrimaryId === "string" && args.adminPrimaryId.trim()) ||
      (await resolvePrimaryAdminId(client));
    if (!adminId) {
      void logOperationalEvent({
        level: "warn",
        category: "notification.emit_skipped",
        message: "emitAdminEvent could not resolve primary admin id",
        userId: null,
        route: null,
        metadata: { eventType: args?.eventType ? String(args.eventType).slice(0, 80) : null },
      });
      return { data: null, error: new Error("no admin id") };
    }
    return await emitEvent({
      ...args,
      targetUserId: adminId,
      category: args?.category || "admin",
      supabaseClient: client,
    });
  } catch (e) {
    void logOperationalError({
      category: "notification.emit_failed",
      message: e?.message || "emitAdminEvent threw",
      userId: null,
      route: null,
      metadata: { eventType: args?.eventType ? String(args.eventType).slice(0, 80) : null, threw: true },
    });
    return { data: null, error: e };
  }
}

function hashDedupeKey(rawKey) {
  const s = typeof rawKey === "string" ? rawKey : JSON.stringify(rawKey);
  return crypto.createHash("sha256").update(s).digest("hex").slice(0, 48);
}

/**
 * Emit at most once per (dedupeKey, windowMs). Subsequent calls within the window
 * are dropped. Uses public.request_limits as the dedupe store (cat = 'event_dedupe').
 *
 * On any error we FAIL OPEN — the event is emitted as if no dedupe were configured.
 *
 * Pass `adminTarget: true` (or set `targetUserId` directly) to control routing.
 * When `adminTarget` is true, the resolved primary admin id is used instead of
 * `targetUserId`.
 *
 * @param {Omit<Parameters<typeof emitEvent>[0], 'targetUserId'> & {
 *   targetUserId?: string,
 *   adminTarget?: boolean,
 *   adminPrimaryId?: string | null,
 *   dedupeKey: string,
 *   windowMs: number,
 * }} args
 * @returns {Promise<{ emitted: boolean, data?: any, error?: any }>}
 */
export async function recordEventOnce(args) {
  try {
    const dedupeKey = typeof args?.dedupeKey === "string" ? args.dedupeKey.trim() : "";
    const windowMs = Number(args?.windowMs);
    const client = await resolveClient(args?.supabaseClient);

    const targetUserId = args?.adminTarget
      ? (typeof args?.adminPrimaryId === "string" && args.adminPrimaryId.trim()) ||
        (await resolvePrimaryAdminId(client))
      : args?.targetUserId;

    if (!targetUserId) {
      void logOperationalEvent({
        level: "warn",
        category: "notification.emit_skipped",
        message: "recordEventOnce could not resolve a target user",
        userId: null,
        route: null,
        metadata: { eventType: args?.eventType ? String(args.eventType).slice(0, 80) : null, adminTarget: !!args?.adminTarget },
      });
      return { emitted: false };
    }

    if (!dedupeKey || !Number.isFinite(windowMs) || windowMs <= 0) {
      const result = await emitEvent({ ...args, targetUserId, supabaseClient: client });
      return { emitted: true, ...result };
    }

    if (!client) {
      const result = await emitEvent({ ...args, targetUserId, supabaseClient: client });
      return { emitted: true, ...result };
    }

    const key = `event_dedupe:${hashDedupeKey(dedupeKey)}`;
    const limit = await incrementRateLimit({
      supabaseClient: client,
      category: "event_dedupe",
      key,
      windowMs,
      max: 1,
    });

    if (!limit.allowed) {
      return { emitted: false };
    }

    const result = await emitEvent({ ...args, targetUserId, supabaseClient: client });
    return { emitted: true, ...result };
  } catch (e) {
    void logOperationalError({
      category: "notification.emit_failed",
      message: e?.message || "recordEventOnce threw",
      userId: typeof args?.targetUserId === "string" ? args.targetUserId : null,
      route: null,
      metadata: {
        eventType: args?.eventType ? String(args.eventType).slice(0, 80) : null,
        threw: true,
      },
    });
    try {
      const fallbackTarget = args?.adminTarget ? null : args?.targetUserId;
      if (!fallbackTarget) return { emitted: false, error: e };
      const result = await emitEvent({ ...args, targetUserId: fallbackTarget });
      return { emitted: true, ...result };
    } catch {
      return { emitted: false, error: e };
    }
  }
}
