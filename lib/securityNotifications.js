/**
 * In-app notifications for account security (via lib/eventBus → public.notifications).
 * Fail-open: never throws; errors are logged only.
 */

import { emitEvent } from "./eventBus";
import { getSecurityNotificationFlags } from "./securitySettings";

const LOG_NS = "[security-notifications]";

function warn(payload) {
  try {
    console.warn(LOG_NS, payload);
  } catch {
    /* ignore */
  }
}

/** @param {Record<string, unknown>} metadata */
function sanitizeSecurityMetadata(metadata) {
  const m = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
  const allow = ["risk_level", "flags", "browser", "os", "device_name", "location", "source", "session_id", "hint"];
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const k of allow) {
    if (m[k] !== undefined && m[k] !== null) {
      if (k === "flags" && Array.isArray(m[k])) {
        out[k] = m[k].map((x) => String(x)).slice(0, 12);
      } else {
        out[k] = m[k];
      }
    }
  }
  return out;
}

/**
 * @param {"warning" | "high"} severity
 */
function mapSuspiciousToEmitSeverity(severity) {
  const s = String(severity || "warning").toLowerCase();
  if (s === "high") return "critical";
  return "warning";
}

/**
 * @param {{ userId: string; severity?: string; metadata?: Record<string, unknown> }} args
 * @returns {Promise<{ ok: boolean }>}
 */
export async function notifySuspiciousLogin({ userId, severity = "warning", metadata = {} }) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) {
    warn({ op: "notifySuspiciousLogin_skip", reason: "missing_user" });
    return { ok: false };
  }
  try {
    const flags = await getSecurityNotificationFlags(uid);
    if (!flags.suspicious_login_alerts_enabled) {
      return { ok: true, skipped: true };
    }
    const { error } = await emitEvent({
      targetUserId: uid,
      type: "security_suspicious_login",
      eventType: "security.suspicious_login",
      title: "New login pattern detected",
      message:
        "We noticed a login pattern that looks different from your recent activity. Review your Security Center if this was not you.",
      category: "security",
      severity: mapSuspiciousToEmitSeverity(severity),
      metadata: sanitizeSecurityMetadata(metadata),
    });
    if (error) warn({ op: "notifySuspiciousLogin", err: error?.message || String(error) });
    return { ok: !error };
  } catch (e) {
    warn({ op: "notifySuspiciousLogin_throw", err: e?.message || String(e) });
    return { ok: false };
  }
}

/**
 * @param {{ userId: string; metadata?: Record<string, unknown> }} args
 * @returns {Promise<{ ok: boolean }>}
 */
export async function notifySessionRevoked({ userId, metadata = {} }) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) {
    warn({ op: "notifySessionRevoked_skip", reason: "missing_user" });
    return { ok: false };
  }
  try {
    const flags = await getSecurityNotificationFlags(uid);
    if (!flags.session_revocation_alerts_enabled) {
      return { ok: true, skipped: true };
    }
    const { error } = await emitEvent({
      targetUserId: uid,
      type: "security_session_revoked",
      eventType: "security.session_revoked",
      title: "Session revoked",
      message: "A saved device session was revoked from your Tropicash Security Center.",
      category: "security",
      severity: "warning",
      metadata: sanitizeSecurityMetadata(metadata),
    });
    if (error) warn({ op: "notifySessionRevoked", err: error?.message || String(error) });
    return { ok: !error };
  } catch (e) {
    warn({ op: "notifySessionRevoked_throw", err: e?.message || String(e) });
    return { ok: false };
  }
}

/**
 * @param {{ userId: string; title: string; message: string; metadata?: Record<string, unknown> }} args
 * @returns {Promise<{ ok: boolean }>}
 */
export async function notifySecurityAccountActivity({ userId, title, message, metadata = {} }) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  const t = typeof title === "string" ? title.trim() : "";
  const m = typeof message === "string" ? message.trim() : "";
  if (!uid || !t || !m) {
    warn({ op: "notifySecurityAccountActivity_skip", reason: "missing_fields" });
    return { ok: false };
  }
  try {
    const flags = await getSecurityNotificationFlags(uid);
    if (!flags.login_alerts_enabled) {
      return { ok: true, skipped: true };
    }
    const { error } = await emitEvent({
      targetUserId: uid,
      type: "security_account_activity",
      eventType: "security.account_activity",
      title: t.slice(0, 200),
      message: m.slice(0, 2000),
      category: "security",
      severity: "info",
      metadata: sanitizeSecurityMetadata(metadata),
    });
    if (error) warn({ op: "notifySecurityAccountActivity", err: error?.message || String(error) });
    return { ok: !error };
  } catch (e) {
    warn({ op: "notifySecurityAccountActivity_throw", err: e?.message || String(e) });
    return { ok: false };
  }
}
