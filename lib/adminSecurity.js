const LOG_NS = "[admin-security]";

function warn(payload) {
  try {
    console.warn(LOG_NS, payload);
  } catch {
    /* ignore */
  }
}

const emptyOverview = () => ({
  error: null,
  recentEventsTotal: null,
  highCriticalCount: null,
  suspiciousLoginCount: null,
  suspiciousLoginRecent7d: null,
  suspiciousLoginHighestSeverity7d: null,
  suspiciousLoginLatestAt: null,
  revokedSessionCount: null,
  activeSessionCount: null,
  latestEventAt: null,
  frozenAccounts: null,
  restrictedAccounts: null,
  watchAccounts: null,
  criticalRiskAccounts: null,
});

function isMissingAccountStatusTable(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204") return true;
  return msg.includes("account_security_status") && (msg.includes("does not exist") || msg.includes("not found"));
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @returns {Promise<ReturnType<typeof emptyOverview>>}
 */
export async function fetchAdminSecurityOverview(supabase) {
  const out = emptyOverview();
  if (!supabase) {
    warn({ op: "fetchAdminSecurityOverview", reason: "no_client" });
    return out;
  }

  const since7d = new Date(Date.now() - 7 * 86400000).toISOString();

  try {
    const [
      recentEv,
      highEv,
      critEv,
      suspEv,
      latestEv,
      activeSess,
    ] = await Promise.all([
      supabase.from("security_events").select("id", { count: "exact", head: true }).gte("created_at", since7d),
      supabase.from("security_events").select("id", { count: "exact", head: true }).eq("severity", "high"),
      supabase.from("security_events").select("id", { count: "exact", head: true }).eq("severity", "critical"),
      supabase.from("security_events").select("id", { count: "exact", head: true }).eq("type", "suspicious_login"),
      supabase.from("security_events").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("user_sessions").select("id", { count: "exact", head: true }).is("revoked_at", null),
    ]);

    if (recentEv.error) warn({ op: "overview_recent_events", err: recentEv.error.message });
    if (highEv.error) warn({ op: "overview_high", err: highEv.error.message });
    if (critEv.error) warn({ op: "overview_critical", err: critEv.error.message });
    if (suspEv.error) warn({ op: "overview_suspicious", err: suspEv.error.message });
    if (latestEv.error) warn({ op: "overview_latest_event", err: latestEv.error.message });
    if (activeSess.error) warn({ op: "overview_active_sessions", err: activeSess.error.message });

    if (typeof recentEv.count === "number") out.recentEventsTotal = recentEv.count;
    const hiOk = !highEv.error && typeof highEv.count === "number";
    const crOk = !critEv.error && typeof critEv.count === "number";
    if (hiOk || crOk) {
      out.highCriticalCount = (hiOk ? highEv.count : 0) + (crOk ? critEv.count : 0);
    }
    if (typeof suspEv.count === "number") out.suspiciousLoginCount = suspEv.count;
    if (!latestEv.error && latestEv.data?.created_at) out.latestEventAt = latestEv.data.created_at;
    if (typeof activeSess.count === "number") out.activeSessionCount = activeSess.count;

    let revRes = await supabase
      .from("user_sessions")
      .select("id", { count: "exact", head: true })
      .or("revoked.eq.true,revoked_at.not.is.null");
    if (revRes.error) {
      revRes = await supabase.from("user_sessions").select("id", { count: "exact", head: true }).not("revoked_at", "is", null);
    }
    if (revRes.error) {
      warn({ op: "overview_revoked_sessions", err: revRes.error.message });
    } else if (typeof revRes.count === "number") {
      out.revokedSessionCount = revRes.count;
    }

    const suspSince = since7d;
    const [susp7dCount, latestSusp, suspSevRows] = await Promise.all([
      supabase.from("security_events").select("id", { count: "exact", head: true }).eq("type", "suspicious_login").gte("created_at", suspSince),
      supabase
        .from("security_events")
        .select("created_at")
        .eq("type", "suspicious_login")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from("security_events").select("severity").eq("type", "suspicious_login").gte("created_at", suspSince).limit(500),
    ]);

    if (susp7dCount.error) warn({ op: "overview_suspicious_7d", err: susp7dCount.error.message });
    else if (typeof susp7dCount.count === "number") out.suspiciousLoginRecent7d = susp7dCount.count;

    if (latestSusp.error) warn({ op: "overview_suspicious_latest", err: latestSusp.error.message });
    else if (latestSusp.data?.created_at) out.suspiciousLoginLatestAt = latestSusp.data.created_at;

    if (suspSevRows.error) {
      warn({ op: "overview_suspicious_severities", err: suspSevRows.error.message });
    } else {
      const rows = suspSevRows.data || [];
      let best = "";
      let bestR = 0;
      const rank = (s) => {
        const k = String(s || "").toLowerCase();
        if (k === "critical") return 4;
        if (k === "high") return 3;
        if (k === "warning") return 2;
        if (k === "info") return 1;
        return 0;
      };
      for (const r of rows) {
        const rn = rank(r.severity);
        if (rn > bestR) {
          bestR = rn;
          best = String(r.severity || "");
        }
      }
      if (best) out.suspiciousLoginHighestSeverity7d = best;
    }

    const [frozenRes, restrictedRes, watchRes, criticalRiskRes] = await Promise.all([
      supabase.from("account_security_status").select("user_id", { count: "exact", head: true }).eq("status", "frozen"),
      supabase.from("account_security_status").select("user_id", { count: "exact", head: true }).eq("status", "restricted"),
      supabase.from("account_security_status").select("user_id", { count: "exact", head: true }).eq("status", "watch"),
      supabase.from("account_security_status").select("user_id", { count: "exact", head: true }).eq("risk_level", "critical"),
    ]);

    const statusTableMissing =
      isMissingAccountStatusTable(frozenRes.error) ||
      isMissingAccountStatusTable(restrictedRes.error);

    if (!statusTableMissing) {
      if (!frozenRes.error && typeof frozenRes.count === "number") out.frozenAccounts = frozenRes.count;
      if (!restrictedRes.error && typeof restrictedRes.count === "number") out.restrictedAccounts = restrictedRes.count;
      if (!watchRes.error && typeof watchRes.count === "number") out.watchAccounts = watchRes.count;
      if (!criticalRiskRes.error && typeof criticalRiskRes.count === "number") out.criticalRiskAccounts = criticalRiskRes.count;
    }

    const fatal =
      recentEv.error?.code === "42P01" ||
      (recentEv.error && String(recentEv.error.message || "").toLowerCase().includes("does not exist"));
    if (fatal) {
      out.error = recentEv.error.message;
    }
  } catch (e) {
    warn({ op: "fetchAdminSecurityOverview_throw", err: e?.message || String(e) });
    out.error = e?.message || "overview_failed";
  }

  return out;
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ rows: Record<string, unknown>[]; error: string | null }>}
 */
export async function fetchRecentSecurityEvents(supabase, opts = {}) {
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
  const empty = { rows: [], error: null };
  if (!supabase) {
    warn({ op: "fetchRecentSecurityEvents", reason: "no_client" });
    return { ...empty, error: "no_client" };
  }
  try {
    const { data, error } = await supabase
      .from("security_events")
      .select("id, user_id, type, severity, description, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      warn({ op: "fetchRecentSecurityEvents", err: error.message });
      return { rows: [], error: error.message };
    }
    return { rows: data || [], error: null };
  } catch (e) {
    warn({ op: "fetchRecentSecurityEvents_throw", err: e?.message || String(e) });
    return { rows: [], error: e?.message || "fetch_failed" };
  }
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ rows: Record<string, unknown>[]; error: string | null }>}
 */
export async function fetchRecentUserSessions(supabase, opts = {}) {
  const limit = Math.min(100, Math.max(1, Number(opts.limit) || 50));
  const empty = { rows: [], error: null };
  if (!supabase) {
    warn({ op: "fetchRecentUserSessions", reason: "no_client" });
    return { ...empty, error: "no_client" };
  }

  const baseSelect =
    "id, user_id, device_name, browser, os, location, last_active_at, created_at, revoked_at, revoked_by";

  try {
    let q = supabase
      .from("user_sessions")
      .select(`${baseSelect}, revoked`)
      .order("created_at", { ascending: false })
      .limit(limit);
    let { data, error } = await q;
    if (error && /revoked/.test(String(error.message || ""))) {
      const retry = await supabase
        .from("user_sessions")
        .select(baseSelect)
        .order("created_at", { ascending: false })
        .limit(limit);
      data = retry.data;
      error = retry.error;
    }
    if (error) {
      warn({ op: "fetchRecentUserSessions", err: error.message });
      return { rows: [], error: error.message };
    }
    return { rows: data || [], error: null };
  } catch (e) {
    warn({ op: "fetchRecentUserSessions_throw", err: e?.message || String(e) });
    return { rows: [], error: e?.message || "fetch_failed" };
  }
}

const SENSITIVE_METADATA_KEYS = new Set([
  "access_token",
  "refresh_token",
  "password",
  "secret",
  "authorization",
  "cookie",
  "token",
  "api_key",
  "apikey",
  "session_token",
]);

/**
 * Compact metadata for admin tables — strips known sensitive keys and truncates.
 * @param {unknown} metadata
 * @param {number} [maxLen]
 * @returns {string}
 */
/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ limit?: number }} [opts]
 */
/**
 * Recent security_alert rows for blocked financial actions (admin console).
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {{ limit?: number }} [opts]
 */
export async function fetchRecentBlockedFinancialActions(supabase, opts = {}) {
  const limit = Math.min(50, Math.max(1, Number(opts.limit) || 15));
  if (!supabase) {
    warn({ op: "fetchRecentBlockedFinancialActions", reason: "no_client" });
    return { rows: [], error: "no_client" };
  }
  try {
    const { data, error } = await supabase
      .from("security_events")
      .select("id, user_id, type, severity, description, metadata, created_at")
      .eq("type", "security_alert")
      .ilike("description", "%Blocked financial action%")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      warn({ op: "fetchRecentBlockedFinancialActions", err: error.message });
      return { rows: [], error: error.message };
    }
    return { rows: data || [], error: null };
  } catch (e) {
    warn({ op: "fetchRecentBlockedFinancialActions_throw", err: e?.message || String(e) });
    return { rows: [], error: e?.message || "fetch_failed" };
  }
}

export async function fetchRecentAccountSecurityStatuses(supabase, opts = {}) {
  const limit = Math.min(50, Math.max(1, Number(opts.limit) || 20));
  if (!supabase) {
    warn({ op: "fetchRecentAccountSecurityStatuses", reason: "no_client" });
    return { rows: [], error: "no_client" };
  }
  try {
    const { data, error } = await supabase
      .from("account_security_status")
      .select("user_id, status, risk_level, reason, notes, updated_at, frozen_at, unfrozen_at")
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingAccountStatusTable(error)) return { rows: [], error: null, tableMissing: true };
      warn({ op: "fetchRecentAccountSecurityStatuses", err: error.message });
      return { rows: [], error: error.message };
    }
    return { rows: data || [], error: null, tableMissing: false };
  } catch (e) {
    warn({ op: "fetchRecentAccountSecurityStatuses_throw", err: e?.message || String(e) });
    return { rows: [], error: e?.message || "fetch_failed" };
  }
}

export function formatSecurityMetadataPreview(metadata, maxLen = 140) {
  if (metadata == null) return "—";
  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    const s = String(metadata);
    return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s;
  }
  const entries = Object.entries(metadata).filter(([k]) => {
    const low = String(k).toLowerCase();
    if (SENSITIVE_METADATA_KEYS.has(low)) return false;
    if (low.includes("token") && low !== "session_id") return false;
    return true;
  });
  if (entries.length === 0) return "—";
  const parts = entries.slice(0, 6).map(([k, v]) => {
    const low = String(k).toLowerCase();
    const vs = typeof v === "object" ? JSON.stringify(v) : String(v);
    let trimmed = vs.length > 48 ? `${vs.slice(0, 47)}…` : vs;
    if (low === "useragent" && trimmed.length > 56) {
      trimmed = `${trimmed.slice(0, 54)}…`;
    }
    return `${k}: ${trimmed}`;
  });
  const joined = parts.join(" · ");
  return joined.length > maxLen ? `${joined.slice(0, maxLen - 1)}…` : joined;
}
