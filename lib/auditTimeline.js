/**
 * Unified audit timeline — append-only feed (`public.audit_timeline`).
 * Inserts use the Supabase service role on the server, or `/api/admin/audit-append` from the browser.
 * Fail-open: never throws from public entry points.
 */

import crypto from "crypto";
import { sanitizeOperationalMetadata, logOperationalError, logOperationalEvent } from "./operationalLogger";
import { createSupabaseServiceClient } from "./supabaseAdminApi";
import { incrementRateLimit } from "./rateLimit";

/** @type {readonly string[]} */
export const ENTITY_TYPES = Object.freeze([
  "user",
  "withdrawal",
  "transaction",
  "triton_transfer",
  "fraud_case",
  "treasury",
  "admin_action",
  "notification",
  "developer_app",
]);

export const ENTITY_TYPE_SET = new Set(ENTITY_TYPES);

export const SEVERITIES = Object.freeze(["info", "success", "warning", "critical"]);

export const SEVERITY_SET = new Set(SEVERITIES);

/** Stable column list for selects (realtime-friendly). */
export const AUDIT_TIMELINE_COLUMNS =
  "id, entity_type, entity_id, event_type, severity, actor_user_id, target_user_id, title, description, metadata, created_at";

const DEFAULT_DEDUPE_MS = 8 * 60 * 1000;

function clampStr(v, max) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeSeverity(raw) {
  const v = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (SEVERITY_SET.has(v)) return v;
  return "info";
}

function hashDedupeKey(raw) {
  const s = typeof raw === "string" ? raw : JSON.stringify(raw);
  return crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 48);
}

/**
 * Deep link from an audit row to an admin destination (best-effort).
 * @param {string} entityType
 * @param {string} entityId
 * @returns {string | null}
 */
export function auditEntityAdminHref(entityType, entityId) {
  const t = String(entityType || "").trim();
  const id = String(entityId || "").trim();
  if (!t || !id) return null;
  if (t === "withdrawal") return `/admin/withdrawals?withdrawalId=${encodeURIComponent(id)}`;
  if (t === "triton_transfer") return `/admin/triton-transfers?requestId=${encodeURIComponent(id)}`;
  if (t === "fraud_case") return `/admin/fraud/${encodeURIComponent(id)}`;
  if (t === "user") return `/admin/users/${encodeURIComponent(id)}/timeline`;
  if (t === "treasury") return "/admin/treasury";
  if (t === "notification" || t === "admin_action") return "/admin/timeline";
  if (t === "developer_app") return "/admin/timeline";
  if (t === "transaction") return `/admin/timeline?entityType=${encodeURIComponent(t)}&entityId=${encodeURIComponent(id)}`;
  return null;
}

/**
 * Service-role insert + dedupe. Used by API routes and Node-only callers.
 * @param {object} args — same shape as `appendAuditEvent`
 */
export async function appendAuditEventServer(args = {}) {
  try {
    let resolvedType = typeof args.entityType === "string" ? args.entityType.trim() : "";
    if (!ENTITY_TYPE_SET.has(resolvedType)) {
      void logOperationalEvent({
        level: "warn",
        category: "audit.invalid_entity_type",
        message: "appendAuditEvent coerced unknown entity_type to admin_action",
        userId: null,
        route: null,
        metadata: { raw: clampStr(resolvedType, 80) },
      });
      resolvedType = "admin_action";
    }

    const eid =
      typeof args.entityId === "string" ? args.entityId.trim() : args.entityId != null ? String(args.entityId).trim() : "";
    const ev = typeof args.eventType === "string" ? args.eventType.trim() : "";
    if (!eid || !ev) return;

    const meta = sanitizeOperationalMetadata(
      args.metadata && typeof args.metadata === "object" && !Array.isArray(args.metadata) ? args.metadata : {},
    );
    const sev = normalizeSeverity(args.severity);

    const windowMs =
      Number.isFinite(Number(args.dedupeWindowMs)) && Number(args.dedupeWindowMs) > 0
        ? Number(args.dedupeWindowMs)
        : DEFAULT_DEDUPE_MS;

    const dk = typeof args.dedupeKey === "string" ? args.dedupeKey.trim() : "";
    if (dk) {
      const serviceForDedupe = createSupabaseServiceClient();
      if (serviceForDedupe) {
        const limitKey = `audit:${hashDedupeKey(dk)}`;
        const limit = await incrementRateLimit({
          supabaseClient: serviceForDedupe,
          category: "audit.dedupe",
          key: limitKey,
          windowMs,
          max: 1,
        });
        if (!limit.allowed) return;
      }
    }

    const row = {
      entity_type: resolvedType,
      entity_id: eid.slice(0, 512),
      event_type: ev.slice(0, 200),
      severity: sev,
      actor_user_id: typeof args.actorUserId === "string" && args.actorUserId.trim() ? args.actorUserId.trim() : null,
      target_user_id:
        typeof args.targetUserId === "string" && args.targetUserId.trim() ? args.targetUserId.trim() : null,
      title: clampStr(args.title, 500),
      description: clampStr(args.description, 8000),
      metadata: meta,
    };

    const admin = createSupabaseServiceClient();
    if (!admin) return;
    const { error } = await admin.from("audit_timeline").insert(row);
    if (error) {
      void logOperationalError({
        supabaseClient: admin,
        category: "audit.append_failed",
        message: "audit_timeline insert failed",
        userId: row.actor_user_id,
        route: null,
        metadata: {
          code: error.code || null,
          entity_type: row.entity_type,
          entity_id: clampStr(row.entity_id, 80),
        },
      });
    }
  } catch {
    try {
      void logOperationalError({
        category: "audit.append_failed",
        message: "appendAuditEventServer threw",
        userId: null,
        route: null,
        metadata: { threw: true },
      });
    } catch {
      /* swallow */
    }
  }
}

/**
 * @param {object} args
 * @param {string} args.entityType
 * @param {string} args.entityId
 * @param {string} args.eventType
 * @param {string|null} [args.actorUserId]
 * @param {string|null} [args.targetUserId]
 * @param {string} [args.severity]
 * @param {string|null} [args.title]
 * @param {string|null} [args.description]
 * @param {Record<string, unknown>} [args.metadata]
 * @param {string|null} [args.dedupeKey]
 * @param {number} [args.dedupeWindowMs]
 * @returns {Promise<void>}
 */
export async function appendAuditEvent(args = {}) {
  try {
    if (typeof window === "undefined") {
      await appendAuditEventServer(args);
      return;
    }
    const { supabase } = await import("./supabaseClient.js");
    if (!supabase) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const payload = {
      entityType: args.entityType,
      entityId: args.entityId,
      eventType: args.eventType,
      actorUserId: args.actorUserId,
      targetUserId: args.targetUserId,
      severity: args.severity,
      title: args.title,
      description: args.description,
      metadata: args.metadata,
      dedupeKey: args.dedupeKey,
      dedupeWindowMs: args.dedupeWindowMs,
    };
    await fetch("/api/admin/audit-append", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    /* fail-open */
  }
}

/**
 * Cursor-paginated entity feed (newest first). Caller supplies an authenticated Supabase client (admin session).
 *
 * @param {object} args
 * @param {string} args.entityType
 * @param {string} args.entityId
 * @param {string|null} [args.beforeIso]
 * @param {number} [args.limit]
 * @param {string|string[]|null} [args.severity]
 * @param {import('@supabase/supabase-js').SupabaseClient} args.supabaseClient
 */
export async function fetchAuditTimeline({
  entityType,
  entityId,
  beforeIso = null,
  limit = 30,
  severity = null,
  supabaseClient,
} = {}) {
  if (!supabaseClient) return { rows: [], error: new Error("missing supabaseClient") };
  const et = typeof entityType === "string" ? entityType.trim() : "";
  const eid = typeof entityId === "string" ? entityId.trim() : "";
  if (!et || !eid) return { rows: [], error: null };

  const lim = Number.isFinite(Number(limit)) ? Math.min(Math.max(1, Number(limit)), 100) : 30;

  try {
    let q = supabaseClient
      .from("audit_timeline")
      .select(AUDIT_TIMELINE_COLUMNS)
      .eq("entity_type", et)
      .eq("entity_id", eid)
      .order("created_at", { ascending: false })
      .limit(lim);

    if (beforeIso && typeof beforeIso === "string") {
      q = q.lt("created_at", beforeIso);
    }

    if (severity) {
      if (Array.isArray(severity) && severity.length) {
        q = q.in(
          "severity",
          severity.map((s) => String(s).toLowerCase()).filter((s) => SEVERITY_SET.has(s)),
        );
      } else if (typeof severity === "string" && severity.trim() && SEVERITY_SET.has(severity.trim().toLowerCase())) {
        q = q.eq("severity", severity.trim().toLowerCase());
      }
    }

    const { data, error } = await q;
    if (error) return { rows: [], error };
    return { rows: Array.isArray(data) ? data : [], error: null };
  } catch (e) {
    return { rows: [], error: e };
  }
}

/**
 * Global admin feed (RLS requires `tc_is_admin()`).
 *
 * @param {object} args
 * @param {string|null} [args.beforeIso]
 * @param {number} [args.limit]
 * @param {string|null} [args.entityType]
 * @param {string|string[]|null} [args.severity]
 * @param {import('@supabase/supabase-js').SupabaseClient} args.supabaseClient
 */
export async function fetchGlobalAuditTimeline({
  beforeIso = null,
  limit = 40,
  entityType = null,
  severity = null,
  supabaseClient,
} = {}) {
  if (!supabaseClient) return { rows: [], error: new Error("missing supabaseClient") };
  const lim = Number.isFinite(Number(limit)) ? Math.min(Math.max(1, Number(limit)), 100) : 40;

  try {
    let q = supabaseClient
      .from("audit_timeline")
      .select(AUDIT_TIMELINE_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(lim);

    if (beforeIso && typeof beforeIso === "string") {
      q = q.lt("created_at", beforeIso);
    }

    const et = typeof entityType === "string" ? entityType.trim() : "";
    if (et && ENTITY_TYPE_SET.has(et)) {
      q = q.eq("entity_type", et);
    }

    if (severity) {
      if (Array.isArray(severity) && severity.length) {
        const list = severity.map((s) => String(s).toLowerCase()).filter((s) => SEVERITY_SET.has(s));
        if (list.length) q = q.in("severity", list);
      } else if (typeof severity === "string" && severity.trim() && SEVERITY_SET.has(severity.trim().toLowerCase())) {
        q = q.eq("severity", severity.trim().toLowerCase());
      }
    }

    const { data, error } = await q;
    if (error) return { rows: [], error };
    return { rows: Array.isArray(data) ? data : [], error: null };
  } catch (e) {
    return { rows: [], error: e };
  }
}

/**
 * Realtime subscription stub — wire when `audit_timeline` is added to `supabase_realtime`.
 * @returns {() => void}
 */
export function subscribeToEntityAuditTimeline(_entityType, _entityId, _callback) {
  return () => {};
}
