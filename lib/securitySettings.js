/**
 * Per-user security preferences (public.security_settings).
 * Fail-open: missing table or query errors return defaults; never throws to callers.
 */

import { supabase as defaultClient } from "./supabaseClient";

const LOG_NS = "[security-settings]";

export const DEFAULT_SECURITY_SETTINGS = Object.freeze({
  login_alerts_enabled: true,
  suspicious_login_alerts_enabled: true,
  session_revocation_alerts_enabled: true,
  two_factor_enabled: false,
  two_factor_method: null,
  trusted_device_review_enabled: true,
});

const SELECT_COLUMNS =
  "user_id, login_alerts_enabled, suspicious_login_alerts_enabled, session_revocation_alerts_enabled, two_factor_enabled, two_factor_method, trusted_device_review_enabled, updated_at, created_at";

/** Alert toggles only — 2FA columns are schema-prep; not writable until enforcement ships. */
const UPSERTABLE_KEYS = new Set([
  "login_alerts_enabled",
  "suspicious_login_alerts_enabled",
  "session_revocation_alerts_enabled",
  "trusted_device_review_enabled",
]);

const TWO_FACTOR_METHODS = new Set(["email_otp", "authenticator_app", "sms_otp"]);

function logWarn(payload) {
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
  if (msg.includes("security_settings") && (msg.includes("does not exist") || msg.includes("not found"))) {
    return true;
  }
  return false;
}

function normalizeRow(row) {
  if (!row || typeof row !== "object") {
    return { ...DEFAULT_SECURITY_SETTINGS, exists: false };
  }
  const methodRaw = row.two_factor_method;
  const method =
    methodRaw == null || methodRaw === ""
      ? null
      : TWO_FACTOR_METHODS.has(String(methodRaw))
        ? String(methodRaw)
        : null;
  return {
    login_alerts_enabled: row.login_alerts_enabled !== false,
    suspicious_login_alerts_enabled: row.suspicious_login_alerts_enabled !== false,
    session_revocation_alerts_enabled: row.session_revocation_alerts_enabled !== false,
    two_factor_enabled: row.two_factor_enabled === true,
    two_factor_method: method,
    trusted_device_review_enabled: row.trusted_device_review_enabled !== false,
    updated_at: row.updated_at ?? null,
    created_at: row.created_at ?? null,
    exists: true,
  };
}

function withMeta(settings, { tableMissing = false, error = null } = {}) {
  return {
    ...settings,
    tableMissing,
    error: error ? String(error.message || error) : null,
  };
}

/**
 * @param {string} userId
 * @param {{ supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} [opts]
 */
export async function getSecuritySettings(userId, { supabaseClient } = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) {
    return withMeta({ ...DEFAULT_SECURITY_SETTINGS, exists: false });
  }
  const client = supabaseClient || defaultClient;
  try {
    const { data, error } = await client.from("security_settings").select(SELECT_COLUMNS).eq("user_id", uid).maybeSingle();
    if (error) {
      if (isMissingTableError(error)) {
        return withMeta({ ...DEFAULT_SECURITY_SETTINGS, exists: false }, { tableMissing: true });
      }
      logWarn({ op: "getSecuritySettings", err: error.message, code: error.code, userId: uid });
      return withMeta({ ...DEFAULT_SECURITY_SETTINGS, exists: false }, { error });
    }
    if (!data) {
      return withMeta({ ...DEFAULT_SECURITY_SETTINGS, exists: false });
    }
    return withMeta(normalizeRow(data));
  } catch (e) {
    logWarn({ op: "getSecuritySettings_throw", err: e?.message || String(e), userId: uid });
    return withMeta({ ...DEFAULT_SECURITY_SETTINGS, exists: false }, { error: e });
  }
}

/**
 * Insert default row when none exists. No-op if row already present.
 *
 * @param {string} userId
 * @param {{ supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} [opts]
 * @returns {Promise<{ ok: boolean; created?: boolean; tableMissing?: boolean; error?: string }>}
 */
export async function ensureSecuritySettings(userId, { supabaseClient } = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) return { ok: false, error: "missing_user" };
  const client = supabaseClient || defaultClient;
  try {
    const { data, error } = await client.from("security_settings").select("user_id").eq("user_id", uid).maybeSingle();
    if (error) {
      if (isMissingTableError(error)) {
        return { ok: false, tableMissing: true, error: error.message };
      }
      logWarn({ op: "ensureSecuritySettings_select", err: error.message, userId: uid });
      return { ok: false, error: error.message };
    }
    if (data?.user_id) return { ok: true, created: false };

    const row = {
      user_id: uid,
      ...DEFAULT_SECURITY_SETTINGS,
      updated_at: new Date().toISOString(),
    };
    const { error: insertError } = await client.from("security_settings").insert([row]);
    if (insertError) {
      if (isMissingTableError(insertError)) {
        return { ok: false, tableMissing: true, error: insertError.message };
      }
      logWarn({ op: "ensureSecuritySettings_insert", err: insertError.message, userId: uid });
      return { ok: false, error: insertError.message };
    }
    return { ok: true, created: true };
  } catch (e) {
    logWarn({ op: "ensureSecuritySettings_throw", err: e?.message || String(e), userId: uid });
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * @param {string} userId
 * @param {Record<string, unknown>} values
 * @param {{ supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} [opts]
 */
export async function upsertSecuritySettings(userId, values, { supabaseClient } = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) return { ok: false, error: "missing_user" };
  const client = supabaseClient || defaultClient;
  const incoming = values && typeof values === "object" && !Array.isArray(values) ? values : {};

  /** @type {Record<string, unknown>} */
  const patch = { user_id: uid, updated_at: new Date().toISOString() };

  for (const key of Object.keys(incoming)) {
    if (!UPSERTABLE_KEYS.has(key)) continue;
    if (key === "two_factor_method") {
      const v = incoming[key];
      if (v == null || v === "") {
        patch.two_factor_method = null;
      } else if (TWO_FACTOR_METHODS.has(String(v))) {
        patch.two_factor_method = String(v);
      }
      continue;
    }
    if (typeof incoming[key] === "boolean") {
      patch[key] = incoming[key];
    }
  }

  if (Object.keys(patch).length <= 2) {
    return { ok: false, error: "no_allowed_fields" };
  }

  try {
    const { error } = await client.from("security_settings").upsert(patch, { onConflict: "user_id" });
    if (error) {
      if (isMissingTableError(error)) {
        return { ok: false, tableMissing: true, error: error.message };
      }
      logWarn({ op: "upsertSecuritySettings", err: error.message, userId: uid });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    logWarn({ op: "upsertSecuritySettings_throw", err: e?.message || String(e), userId: uid });
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Notification gating flags for lib/securityNotifications.js (defaults enabled on any failure).
 *
 * @param {string} userId
 * @param {{ supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} [opts]
 */
export async function getSecurityNotificationFlags(userId, { supabaseClient } = {}) {
  const settings = await getSecuritySettings(userId, { supabaseClient });
  if (settings.tableMissing || settings.error) {
    return {
      login_alerts_enabled: true,
      suspicious_login_alerts_enabled: true,
      session_revocation_alerts_enabled: true,
    };
  }
  return {
    login_alerts_enabled: settings.login_alerts_enabled !== false,
    suspicious_login_alerts_enabled: settings.suspicious_login_alerts_enabled !== false,
    session_revocation_alerts_enabled: settings.session_revocation_alerts_enabled !== false,
  };
}
