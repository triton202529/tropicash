/**
 * Lightweight admin read helpers for security tables (requires RLS admin via tc_is_admin()).
 * Returns null counts when a query fails so dashboards stay resilient.
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{
 *   highSeverityEvents: number | null;
 *   suspiciousLogins: number | null;
 *   suspiciousLoginsLast7d: number | null;
 *   suspiciousLoginWarning: number | null;
 *   suspiciousLoginHigh: number | null;
 *   revokedSessions: number | null;
 *   error: string | null;
 * }>}
 */
export async function fetchAdminSecuritySignalCounts(supabase) {
  const out = {
    highSeverityEvents: null,
    suspiciousLogins: null,
    suspiciousLoginsLast7d: null,
    suspiciousLoginWarning: null,
    suspiciousLoginHigh: null,
    revokedSessions: null,
    error: null,
  };
  if (!supabase) {
    out.error = "no_client";
    return out;
  }
  const since7d = new Date(Date.now() - 7 * 86400000).toISOString();

  try {
    const [highRes, critRes, suspRes, susp7d, suspWarn, suspHi, revRes] = await Promise.all([
      supabase.from("security_events").select("id", { count: "exact", head: true }).eq("severity", "high"),
      supabase.from("security_events").select("id", { count: "exact", head: true }).eq("severity", "critical"),
      supabase.from("security_events").select("id", { count: "exact", head: true }).eq("type", "suspicious_login"),
      supabase
        .from("security_events")
        .select("id", { count: "exact", head: true })
        .eq("type", "suspicious_login")
        .gte("created_at", since7d),
      supabase
        .from("security_events")
        .select("id", { count: "exact", head: true })
        .eq("type", "suspicious_login")
        .eq("severity", "warning"),
      supabase
        .from("security_events")
        .select("id", { count: "exact", head: true })
        .eq("type", "suspicious_login")
        .in("severity", ["high", "critical"]),
      supabase.from("user_sessions").select("id", { count: "exact", head: true }).or("revoked.eq.true,revoked_at.not.is.null"),
    ]);

    let revFinal = revRes;
    if (revFinal.error) {
      revFinal = await supabase.from("user_sessions").select("id", { count: "exact", head: true }).not("revoked_at", "is", null);
    }

    const errs = [highRes.error, critRes.error, suspRes.error, susp7d.error, suspWarn.error, suspHi.error, revFinal.error].filter(
      Boolean
    );
    if (errs.length) {
      out.error = errs[0].message || "query_partial_failure";
    }

    if (!highRes.error && typeof highRes.count === "number" && !critRes.error && typeof critRes.count === "number") {
      out.highSeverityEvents = highRes.count + critRes.count;
    } else if (!highRes.error && typeof highRes.count === "number") {
      out.highSeverityEvents = highRes.count;
    } else if (!critRes.error && typeof critRes.count === "number") {
      out.highSeverityEvents = critRes.count;
    }

    if (!suspRes.error && typeof suspRes.count === "number") out.suspiciousLogins = suspRes.count;
    if (!susp7d.error && typeof susp7d.count === "number") out.suspiciousLoginsLast7d = susp7d.count;
    if (!suspWarn.error && typeof suspWarn.count === "number") out.suspiciousLoginWarning = suspWarn.count;
    if (!suspHi.error && typeof suspHi.count === "number") out.suspiciousLoginHigh = suspHi.count;

    if (!revFinal.error && typeof revFinal.count === "number") out.revokedSessions = revFinal.count;

    return out;
  } catch (e) {
    out.error = e?.message || "fetch_failed";
    return out;
  }
}
