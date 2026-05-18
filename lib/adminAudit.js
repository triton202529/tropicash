/**
 * Admin action audit trail — append-only logs for sensitive admin/system actions.
 * Best-effort inserts; never throws to callers.
 */

import { supabase as defaultClient } from "./supabaseClient";
import { createSupabaseServiceClient } from "./supabaseAdminApi";
import { sanitizeOperationalMetadata } from "./operationalLogger";

const LOG_NS = "[admin-audit]";

const AUDIT_CATEGORIES = new Set([
  "security",
  "wallet",
  "withdrawal",
  "payout",
  "user_management",
  "system",
]);

const AUDIT_SEVERITIES = new Set(["info", "warning", "high", "critical"]);

const SENSITIVE_METADATA_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "password",
  "secret",
  "authorization",
  "bearer",
  "api_key",
  "apikey",
]);

function warn(payload) {
  try {
    console.warn(LOG_NS, payload);
  } catch {
    /* ignore */
  }
}

function isMissingTableError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204") return true;
  return msg.includes("admin_audit_logs") && (msg.includes("does not exist") || msg.includes("not found"));
}

/**
 * @param {unknown} input
 */
export function sanitizeAdminAuditMetadata(input) {
  return sanitizeOperationalMetadata(input);
}

/**
 * @param {string} riskLevel
 */
export function auditSeverityFromRiskLevel(riskLevel) {
  const r = String(riskLevel || "low").toLowerCase();
  if (r === "critical") return "critical";
  if (r === "high") return "high";
  if (r === "medium") return "warning";
  return "info";
}

function normalizeCategory(category) {
  const v = String(category || "security").toLowerCase();
  return AUDIT_CATEGORIES.has(v) ? v : "security";
}

function normalizeSeverity(severity) {
  const v = String(severity || "info").toLowerCase();
  return AUDIT_SEVERITIES.has(v) ? v : "info";
}

function resolveClient(supabaseClient) {
  if (supabaseClient) return supabaseClient;
  if (typeof window === "undefined") {
    return createSupabaseServiceClient() || defaultClient;
  }
  return defaultClient;
}

/**
 * @param {unknown} metadata
 * @param {number} [maxLen]
 */
export function formatAdminAuditMetadataPreview(metadata, maxLen = 140) {
  if (metadata == null) return "—";
  const safe =
    metadata != null && typeof metadata === "object" && !Array.isArray(metadata)
      ? sanitizeAdminAuditMetadata(metadata)
      : metadata;
  if (typeof safe !== "object" || Array.isArray(safe)) {
    const s = String(safe);
    return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
  }
  const entries = Object.entries(safe).filter(([k]) => {
    const low = String(k).toLowerCase();
    if (SENSITIVE_METADATA_KEYS.has(low)) return false;
    if (low.includes("token") && low !== "session_id") return false;
    return true;
  });
  if (entries.length === 0) return "—";
  const parts = entries.slice(0, 6).map(([k, v]) => {
    const vs = typeof v === "object" ? JSON.stringify(v) : String(v);
    const trimmed = vs.length > 48 ? `${vs.slice(0, 47)}…` : vs;
    return `${k}: ${trimmed}`;
  });
  const joined = parts.join(" · ");
  return joined.length > maxLen ? `${joined.slice(0, maxLen - 1)}…` : joined;
}

/**
 * @param {{
 *   actorUserId?: string | null;
 *   targetUserId?: string | null;
 *   action: string;
 *   category?: string;
 *   severity?: string;
 *   description?: string;
 *   metadata?: Record<string, unknown>;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function logAdminAuditEvent({
  actorUserId = null,
  targetUserId = null,
  action,
  category = "security",
  severity = "info",
  description = "",
  metadata = {},
  supabaseClient,
} = {}) {
  const act = typeof action === "string" ? action.trim() : "";
  if (!act) {
    warn({ op: "logAdminAuditEvent", reason: "missing_action" });
    return { ok: false };
  }

  const client = resolveClient(supabaseClient);
  if (!client) {
    warn({ op: "logAdminAuditEvent", reason: "no_client" });
    return { ok: false };
  }

  const actorId = typeof actorUserId === "string" && actorUserId.trim() ? actorUserId.trim() : null;
  const targetId = typeof targetUserId === "string" && targetUserId.trim() ? targetUserId.trim() : null;

  const row = {
    actor_user_id: actorId,
    target_user_id: targetId,
    action: act.slice(0, 200),
    category: normalizeCategory(category),
    severity: normalizeSeverity(severity),
    description: String(description || "").trim().slice(0, 2000) || null,
    metadata: sanitizeAdminAuditMetadata(metadata),
  };

  try {
    const { error } = await client.from("admin_audit_logs").insert([row]);
    if (error) {
      if (isMissingTableError(error)) {
        warn({ op: "logAdminAuditEvent", tableMissing: true, action: act });
        return { ok: false, tableMissing: true };
      }
      warn({ op: "logAdminAuditEvent", err: error.message, action: act });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    warn({ op: "logAdminAuditEvent_throw", err: e?.message || String(e), action: act });
    return { ok: false };
  }
}

const emptyFetchResult = () => ({
  rows: [],
  error: null,
  tableMissing: false,
});

/**
 * @param {{
 *   limit?: number;
 *   category?: string;
 *   severity?: string;
 *   targetUserId?: string;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} [args]
 */
export async function fetchAdminAuditLogs({
  limit = 100,
  category = "",
  severity = "",
  targetUserId = "",
  supabaseClient,
} = {}) {
  const out = emptyFetchResult();
  const client = resolveClient(supabaseClient);
  if (!client) {
    warn({ op: "fetchAdminAuditLogs", reason: "no_client" });
    out.error = "no_client";
    return out;
  }

  const cap = Math.min(Math.max(Number(limit) || 100, 1), 500);

  try {
    let q = client
      .from("admin_audit_logs")
      .select(
        "id, actor_user_id, target_user_id, action, category, severity, description, metadata, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(cap);

    const cat = String(category || "").trim().toLowerCase();
    if (cat && AUDIT_CATEGORIES.has(cat)) {
      q = q.eq("category", cat);
    }

    const sev = String(severity || "").trim().toLowerCase();
    if (sev && AUDIT_SEVERITIES.has(sev)) {
      q = q.eq("severity", sev);
    }

    const target = String(targetUserId || "").trim();
    if (target) {
      q = q.eq("target_user_id", target);
    }

    const { data, error } = await q;
    if (error) {
      if (isMissingTableError(error)) {
        warn({ op: "fetchAdminAuditLogs", tableMissing: true });
        out.tableMissing = true;
        return out;
      }
      warn({ op: "fetchAdminAuditLogs", err: error.message });
      out.error = error.message;
      return out;
    }

    out.rows = Array.isArray(data) ? data : [];
    return out;
  } catch (e) {
    warn({ op: "fetchAdminAuditLogs_throw", err: e?.message || String(e) });
    out.error = e?.message || String(e);
    return out;
  }
}
