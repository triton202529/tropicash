import { supabase } from "./supabaseClient";
import { notifySessionRevoked, notifySuspiciousLogin } from "./securityNotifications";

/**
 * Client-side login risk hints compare new sign-ins to saved user_sessions only.
 * Advisory only: never blocks authentication, revokes tokens, or replaces 2FA.
 * Future work may add 2FA step-up and server-side session invalidation.
 */
const LOG_NS = "[security]";const STORAGE_BOOT_DONE = "tropicash_sec_boot_done";
const STORAGE_AUTH_HINT = "tropicash_sec_auth_hint";
const STORAGE_DEVICE_TOKEN = "tropicash_sec_device_token";
const AUTH_HINT_MAX_AGE_MS = 120000;

/** @type {Set<string>} */
const bootstrapInflight = new Set();

/**
 * Call from login / signup pages before navigating away so observability can tag the auth path.
 * @param {{ isSignUp?: boolean; source?: string }} hint
 */
export function setAuthFormSecurityHint(hint) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_AUTH_HINT,
      JSON.stringify({ isSignUp: !!hint?.isSignUp, source: String(hint?.source || ""), at: Date.now() }),
    );
  } catch {
    /* ignore quota / privacy mode */
  }
}

/**
 * @returns {{ isSignUp: boolean; source: string; at?: number } | null}
 */
function consumeAuthFormSecurityHint() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_AUTH_HINT);
    if (!raw) return null;
    sessionStorage.removeItem(STORAGE_AUTH_HINT);
    const parsed = JSON.parse(raw);
    const at = typeof parsed?.at === "number" ? parsed.at : 0;
    if (at && Date.now() - at > AUTH_HINT_MAX_AGE_MS) {
      return null;
    }
    return {
      isSignUp: !!parsed?.isSignUp,
      source: typeof parsed?.source === "string" ? parsed.source : "",
      at: typeof parsed?.at === "number" ? parsed.at : undefined,
    };
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_AUTH_HINT);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function clearSecurityBrowserMarkers() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_BOOT_DONE);
    sessionStorage.removeItem(STORAGE_AUTH_HINT);
    sessionStorage.removeItem(STORAGE_DEVICE_TOKEN);
  } catch {
    /* ignore */
  }
}

function securityLog(level, payload) {
  const line = { ns: LOG_NS, ...payload };
  try {
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.info(line);
  } catch {
    /* never throw from logging */
  }
}

function bootstrapKeyFromSession(session) {
  const uid = session?.user?.id;
  if (!uid) return null;
  const last = session?.user?.last_sign_in_at || "";
  return `${uid}|${last}`;
}

/**
 * Lightweight client context for session + security rows (no external deps).
 */
export function getSecurityClientContext() {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      userAgent: "",
      deviceName: "Web browser",
      browser: "",
      os: "",
    };
  }
  const ua = String(navigator.userAgent || "");
  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";

  let os = "Unknown";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  const deviceName =
    typeof navigator.userAgentData?.platform === "string" && navigator.userAgentData.platform
      ? `${browser} · ${navigator.userAgentData.platform}`
      : `${browser} · ${os}`;

  return { userAgent: ua, deviceName, browser, os };
}

function normSig(s) {
  return String(s || "")
    .trim()
    .toLowerCase();
}

/**
 * Compare sign-in context to recent user_sessions (same Supabase user). Advisory only.
 *
 * @param {{
 *   userId: string;
 *   browser?: string;
 *   os?: string;
 *   deviceName?: string;
 *   location?: string;
 *   userAgent?: string;
 * }} args
 * @returns {Promise<{ riskLevel: "none" | "low" | "medium" | "high"; flags: string[]; description: string }>}
 */
export async function detectLoginRisk({
  userId,
  browser = "",
  os = "",
  deviceName = "",
  location = "",
  userAgent = "",
}) {
  void userAgent;
  const none = { riskLevel: "none", flags: [], description: "" };
  if (!userId) return none;

  /** @type {{ browser?: string; os?: string; device_name?: string; location?: string }[]} */
  let rows = [];
  try {
    const { data, error } = await supabase
      .from("user_sessions")
      .select("browser, os, device_name, location")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) {
      securityLog("warn", { op: "detectLoginRisk", err: error.message, userId });
      return none;
    }
    rows = data || [];
  } catch (e) {
    securityLog("warn", { op: "detectLoginRisk_throw", err: e?.message || String(e), userId });
    return none;
  }

  const nb = normSig(browser);
  const nos = normSig(os);
  const ndev = normSig(deviceName);
  const nloc = normSig(location);

  if (rows.length === 0) {
    return {
      riskLevel: "low",
      flags: ["first_known_device"],
      description: "First saved device session for this account.",
    };
  }

  const browsers = new Set();
  const oss = new Set();
  const devices = new Set();
  const locs = new Set();
  for (const r of rows) {
    const b = normSig(r.browser);
    const o = normSig(r.os);
    const d = normSig(r.device_name);
    const l = normSig(r.location);
    if (b) browsers.add(b);
    if (o) oss.add(o);
    if (d) devices.add(d);
    if (l) locs.add(l);
  }

  /** @type {string[]} */
  const flags = [];
  if (nb && !browsers.has(nb)) flags.push("new_browser");
  if (nos && !oss.has(nos)) flags.push("new_os");
  if (ndev && !devices.has(ndev)) flags.push("new_device");
  const hasHistLoc = locs.size > 0;
  if (nloc && hasHistLoc && !locs.has(nloc)) flags.push("location_changed");

  if (flags.length === 0) {
    return { riskLevel: "none", flags: [], description: "Device profile matches recent saved sessions." };
  }

  /** @type {"none" | "low" | "medium" | "high"} */
  let riskLevel = "none";
  if (flags.length === 1) {
    riskLevel = flags[0] === "location_changed" ? "medium" : "low";
  } else if (flags.length === 2) {
    riskLevel = "medium";
  } else {
    riskLevel = "high";
  }

  const label = flags.map((f) => f.replace(/_/g, " ")).join(", ");
  let description = `Compared with recent activity: ${label}.`;
  if (riskLevel === "low") {
    description = `Minor change from usual pattern (${label}).`;
  } else if (riskLevel === "medium") {
    description = `Several details differ from your recent sign-ins (${label}).`;
  } else {
    description = `Multiple details differ from your recent sign-ins (${label}).`;
  }

  return { riskLevel, flags, description };
}

/**
 * @param {{
 *   userId: string;
 *   type: string;
 *   severity?: string;
 *   description?: string;
 *   metadata?: Record<string, unknown>;
 * }} args
 * @returns {Promise<{ ok: boolean; error?: string }>}
 */
export async function logSecurityEvent(args) {
  const userId = args?.userId;
  const type = args?.type;
  if (!userId || !type) {
    securityLog("warn", { op: "logSecurityEvent_skip", reason: "missing_user_or_type" });
    return { ok: false, error: "missing_fields" };
  }
  const row = {
    user_id: userId,
    type: String(type),
    severity: String(args?.severity || "info").toLowerCase(),
    description: String(args?.description ?? ""),
    metadata: args?.metadata && typeof args.metadata === "object" ? args.metadata : {},
  };
  try {
    const { error } = await supabase.from("security_events").insert([row]);
    if (error) {
      securityLog("warn", { op: "logSecurityEvent", err: error.message, type: row.type, userId });
      return { ok: false, error: error.message };
    }
    securityLog("info", { op: "logSecurityEvent_ok", type: row.type, severity: row.severity, userId });
    return { ok: true };
  } catch (e) {
    securityLog("warn", { op: "logSecurityEvent_throw", err: e?.message || String(e), type: row.type, userId });
    return { ok: false, error: e?.message || "insert_failed" };
  }
}

/**
 * @param {{
 *   userId: string;
 *   sessionToken?: string;
 *   deviceName?: string;
 *   browser?: string;
 *   os?: string;
 *   ipAddress?: string;
 *   location?: string;
 * }} args
 * @returns {Promise<{ ok: boolean; error?: string }>}
 */
export async function createUserSession(args) {
  const userId = args?.userId;
  if (!userId) {
    securityLog("warn", { op: "createUserSession_skip", reason: "missing_user" });
    return { ok: false, error: "missing_user" };
  }
  const row = {
    user_id: userId,
    session_token: String(args?.sessionToken ?? ""),
    device_name: String(args?.deviceName ?? ""),
    browser: String(args?.browser ?? ""),
    os: String(args?.os ?? ""),
    ip_address: String(args?.ipAddress ?? ""),
    location: String(args?.location ?? ""),
    last_active_at: new Date().toISOString(),
  };
  try {
    const { error } = await supabase.from("user_sessions").insert([row]);
    if (error) {
      securityLog("warn", { op: "createUserSession", err: error.message, userId });
      return { ok: false, error: error.message };
    }
    securityLog("info", { op: "createUserSession_ok", userId });
    return { ok: true };
  } catch (e) {
    securityLog("warn", { op: "createUserSession_throw", err: e?.message || String(e), userId });
    return { ok: false, error: e?.message || "insert_failed" };
  }
}

/**
 * After password login or signup, record a device session + login_success once per Supabase sign-in
 * (page refresh does not duplicate). Safe to fire-and-forget.
 *
 * @param {import('@supabase/supabase-js').Session | null} session
 * @returns {Promise<void>}
 */
export async function recordPostAuthSecurityIfNeeded(session) {
  if (typeof window === "undefined" || !session?.user?.id) return;

  const key = bootstrapKeyFromSession(session);
  if (!key) return;

  if (bootstrapInflight.has(key)) return;

  let doneMarker = null;
  try {
    doneMarker = sessionStorage.getItem(STORAGE_BOOT_DONE);
  } catch {
    /* continue */
  }
  if (doneMarker === key) return;

  bootstrapInflight.add(key);
  try {
    const hint = consumeAuthFormSecurityHint();
    const ctx = getSecurityClientContext();
    const sessionToken =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    let risk = { riskLevel: "none", flags: [], description: "" };
    try {
      risk = await detectLoginRisk({
        userId: session.user.id,
        browser: ctx.browser,
        os: ctx.os,
        deviceName: ctx.deviceName,
        location: "",
        userAgent: ctx.userAgent,
      });
    } catch (e) {
      securityLog("warn", { op: "recordPostAuth_risk", err: e?.message || String(e) });
    }

    const authSrc = hint?.source || "session_restore";
    const metadata = {
      userAgent: ctx.userAgent,
      timestamp: new Date().toISOString(),
      authSource: authSrc,
      isSignUp: !!hint?.isSignUp,
      risk_level: risk.riskLevel,
      risk_flags: risk.flags,
      risk_description: risk.description,
    };

    const description = hint?.isSignUp
      ? "New authenticated session created"
      : "User signed in successfully";

    const sessionRes = await createUserSession({
      userId: session.user.id,
      sessionToken,
      deviceName: ctx.deviceName,
      browser: ctx.browser,
      os: ctx.os,
      ipAddress: "",
      location: "",
    });

    const eventRes = await logSecurityEvent({
      userId: session.user.id,
      type: "login_success",
      severity: "info",
      description,
      metadata,
    });

    if ((risk.riskLevel === "medium" || risk.riskLevel === "high") && sessionRes.ok && eventRes.ok) {
      const susp = await logSecurityEvent({
        userId: session.user.id,
        type: "suspicious_login",
        severity: risk.riskLevel === "high" ? "high" : "warning",
        description: "Login pattern changed from previous activity",
        metadata: {
          risk_level: risk.riskLevel,
          flags: risk.flags,
          browser: ctx.browser,
          os: ctx.os,
          device_name: ctx.deviceName,
          location: "",
          source: authSrc,
        },
      });
      if (!susp.ok) {
        securityLog("warn", { op: "recordPostAuth_suspicious", err: susp.error, userId: session.user.id });
      } else {
        void notifySuspiciousLogin({
          userId: session.user.id,
          severity: risk.riskLevel === "high" ? "high" : "warning",
          metadata: {
            risk_level: risk.riskLevel,
            flags: risk.flags,
            browser: ctx.browser,
            os: ctx.os,
            device_name: ctx.deviceName,
            source: authSrc,
          },
        });
      }
    }

    if (sessionRes.ok && eventRes.ok) {
      try {
        sessionStorage.setItem(STORAGE_BOOT_DONE, key);
        sessionStorage.setItem(STORAGE_DEVICE_TOKEN, sessionToken);
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    securityLog("warn", { op: "recordPostAuthSecurityIfNeeded", err: e?.message || String(e) });
  } finally {
    bootstrapInflight.delete(key);
  }
}

/**
 * Touch last_active_at for the row matching this browser's opaque session token (best-effort).
 * @param {string} userId
 */
export async function touchCurrentUserSessionActivity(userId) {
  if (typeof window === "undefined" || !userId) return;
  let token = "";
  try {
    token = sessionStorage.getItem(STORAGE_DEVICE_TOKEN) || "";
  } catch {
    return;
  }
  if (!token) return;
  const now = new Date().toISOString();
  try {
    const { error } = await supabase
      .from("user_sessions")
      .update({ last_active_at: now })
      .eq("user_id", userId)
      .eq("session_token", token)
      .is("revoked_at", null);
    if (error) {
      securityLog("warn", { op: "touchUserSession", err: error.message, userId });
    }
  } catch (e) {
    securityLog("warn", { op: "touchUserSession_throw", err: e?.message || String(e), userId });
  }
}

/**
 * Opaque device session id for this tab (matches user_sessions.session_token when bootstrap ran).
 */
export function getBrowserSecurityDeviceToken() {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(STORAGE_DEVICE_TOKEN) || "";
  } catch {
    return "";
  }
}

/**
 * Mark a saved device session as revoked (does not invalidate Supabase auth tokens).
 *
 * @param {{ sessionId: string; userId: string }} args
 * @returns {Promise<{ success: true } | { success: false; error: string }>}
 */
export async function revokeUserSession({ sessionId, userId }) {
  const sid = sessionId ? String(sessionId) : "";
  const uid = userId ? String(userId) : "";
  if (!sid || !uid) {
    securityLog("warn", { op: "revokeUserSession_skip", reason: "missing_args" });
    return { success: false, error: "missing_args" };
  }
  const now = new Date().toISOString();
  try {
    const { data, error } = await supabase
      .from("user_sessions")
      .update({ revoked_at: now, revoked_by: uid })
      .eq("id", sid)
      .eq("user_id", uid)
      .is("revoked_at", null)
      .select("id")
      .limit(1);

    if (error) {
      securityLog("warn", { op: "revokeUserSession", err: error.message, sessionId: sid, userId: uid });
      return { success: false, error: error.message };
    }
    if (!data?.length) {
      securityLog("warn", { op: "revokeUserSession_noop", sessionId: sid, userId: uid });
      return { success: false, error: "Session was already revoked or could not be found." };
    }

    const logRes = await logSecurityEvent({
      userId: uid,
      type: "session_revoked",
      severity: "warning",
      description: "A saved session was revoked from the Security Center",
      metadata: { session_id: sid },
    });
    if (!logRes.ok) {
      securityLog("warn", { op: "revokeUserSession_event", err: logRes.error, sessionId: sid, userId: uid });
    } else {
      void notifySessionRevoked({ userId: uid, metadata: { session_id: sid } });
    }

    securityLog("info", { op: "revokeUserSession_ok", sessionId: sid, userId: uid });
    return { success: true };
  } catch (e) {
    securityLog("warn", { op: "revokeUserSession_throw", err: e?.message || String(e), sessionId: sid, userId: uid });
    return { success: false, error: e?.message || "revoke_failed" };
  }
}
