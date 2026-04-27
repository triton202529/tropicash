import { logRiskStateRecomputed } from "./fraudEvents";
import { persistAccountControlState } from "./accountControls";
import { maybeCreateRiskAlerts } from "./smartAlerts";

/**
 * Deterministic account-level risk state from fraud_logs aggregates (no ML, no blocking).
 */

function normalizeLogStatus(raw) {
  const v = String(raw || "").toLowerCase();
  if (v === "reviewed" || v === "escalated") return v;
  return "open";
}

function coerceNumber(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

/**
 * Build stats from raw fraud log rows (minimal fields: risk_score, risk_level, status, created_at).
 * @param {Array<Record<string, unknown>>} logs
 * @returns {{
 *   total_logs: number,
 *   high_count: number,
 *   medium_count: number,
 *   low_count: number,
 *   open_count: number,
 *   reviewed_count: number,
 *   escalated_count: number,
 *   avg_risk_score: number,
 *   latest_activity_at: string | null
 * }}
 */
export function aggregateStatsFromFraudLogs(logs) {
  const list = Array.isArray(logs) ? logs : [];
  let high = 0;
  let medium = 0;
  let low = 0;
  let open = 0;
  let reviewed = 0;
  let escalated = 0;
  let sumScore = 0;
  let scoreN = 0;
  let latest = null;

  for (const r of list) {
    const lv = String(r.risk_level || "").toLowerCase();
    if (lv === "high") high += 1;
    else if (lv === "medium") medium += 1;
    else if (lv === "low") low += 1;

    const st = normalizeLogStatus(r.status);
    if (st === "open") open += 1;
    else if (st === "reviewed") reviewed += 1;
    else if (st === "escalated") escalated += 1;

    const s = Number(r.risk_score);
    if (Number.isFinite(s)) {
      sumScore += s;
      scoreN += 1;
    }

    const ca = r.created_at;
    if (ca && typeof ca === "string" && (!latest || ca > latest)) latest = ca;
  }

  const avg_risk_score = scoreN > 0 ? sumScore / scoreN : 0;
  return {
    total_logs: list.length,
    high_count: high,
    medium_count: medium,
    low_count: low,
    open_count: open,
    reviewed_count: reviewed,
    escalated_count: escalated,
    avg_risk_score,
    latest_activity_at: latest,
  };
}

/**
 * @param {{
 *   total_logs?: number,
 *   high_count?: number,
 *   medium_count?: number,
 *   low_count?: number,
 *   open_count?: number,
 *   reviewed_count?: number,
 *   escalated_count?: number,
 *   avg_risk_score?: number,
 * }} stats
 * @param {"low"|"medium"|"high"} riskLevel
 * @returns {string[]}
 */
export function buildRiskFlagsFromStats(stats, riskLevel) {
  const total = coerceNumber(stats.total_logs, 0);
  const highCount = coerceNumber(stats.high_count, 0);
  const openCount = coerceNumber(stats.open_count, 0);
  const escalatedCount = coerceNumber(stats.escalated_count, 0);

  const flags = new Set();

  if (total >= 2) flags.add("suspicious_activity");
  if (openCount >= 1) flags.add("under_review");
  if (openCount >= 1 || escalatedCount >= 1) flags.add("fraud_queue_active");
  if (highCount >= 2) flags.add("repeated_high_risk_events");
  if (escalatedCount >= 2) flags.add("repeated_escalations");
  if (riskLevel === "high") flags.add("high_risk_user");

  return Array.from(flags).sort();
}

/**
 * @param {{
 *   total_logs?: number,
 *   high_count?: number,
 *   medium_count?: number,
 *   low_count?: number,
 *   open_count?: number,
 *   reviewed_count?: number,
 *   escalated_count?: number,
 *   avg_risk_score?: number,
 *   latest_activity_at?: string | null
 * }} stats
 * @returns {{ riskLevel: "low"|"medium"|"high", riskFlags: string[], riskScoreSnapshot: number | null }}
 */
export function deriveUserRiskState(stats) {
  const avg = coerceNumber(stats.avg_risk_score, 0);
  const highCount = coerceNumber(stats.high_count, 0);
  const mediumCount = coerceNumber(stats.medium_count, 0);
  const openCount = coerceNumber(stats.open_count, 0);
  const escalatedCount = coerceNumber(stats.escalated_count, 0);
  const total = coerceNumber(stats.total_logs, 0);

  let riskLevel = "low";
  if (avg >= 60 || highCount >= 3 || escalatedCount >= 2) {
    riskLevel = "high";
  } else if (avg >= 30 || mediumCount >= 2 || openCount >= 2) {
    riskLevel = "medium";
  }

  const riskFlags = buildRiskFlagsFromStats(stats, riskLevel);
  const riskScoreSnapshot = total > 0 ? avg : null;

  return { riskLevel, riskFlags, riskScoreSnapshot };
}

/**
 * Normalize DB jsonb / client value to string[].
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeRiskFlagsArray(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);
  if (raw && typeof raw === "object") return Object.values(raw).map(String).filter(Boolean);
  return [];
}

/**
 * Load fraud_logs for user (unless logs provided), derive state, persist to profiles when row exists.
 * @param {*} supabase Supabase client (from lib/supabaseClient)
 * @param {string} userId
 * @param {{
 *   logs?: Array<Record<string, unknown>> | null,
 *   actorUserId?: string | null,
 *   fraudLogId?: string | null,
 * }} [options]
 * @returns {Promise<{
 *   ok: boolean,
 *   error?: unknown,
 *   persisted?: boolean,
 *   derived?: { riskLevel: string, riskFlags: string[], riskScoreSnapshot: number | null },
 *   stats?: ReturnType<typeof aggregateStatsFromFraudLogs>,
 *   patch?: Record<string, unknown>
 * }>}
 */
export async function recomputeAndPersistUserRiskState(supabase, userId, options = {}) {
  if (!supabase || !userId) {
    return { ok: false, error: new Error("recomputeAndPersistUserRiskState: missing supabase or userId") };
  }

  try {
    let logs = options.logs;
    if (!logs) {
      const { data, error } = await supabase
        .from("fraud_logs")
        .select("risk_score, risk_level, status, created_at")
        .eq("user_id", userId);

      if (error) {
        console.error(error);
        return { ok: false, error };
      }
      logs = data || [];
    }

    const stats = aggregateStatsFromFraudLogs(logs);
    const derived = deriveUserRiskState(stats);
    const nowIso = new Date().toISOString();

    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id, risk_level")
      .eq("id", userId)
      .maybeSingle();

    if (profErr) {
      console.error(profErr);
      return { ok: false, error: profErr };
    }

    if (!prof) {
      return { ok: true, persisted: false, derived, stats };
    }

    const previousRiskLevel = String(prof.risk_level || "").toLowerCase();

    const patch = {
      risk_level: derived.riskLevel,
      risk_flags: derived.riskFlags,
      risk_score_snapshot: derived.riskScoreSnapshot,
      risk_last_evaluated_at: nowIso,
    };

    const { error: upErr } = await supabase.from("profiles").update(patch).eq("id", userId);

    if (upErr) {
      console.error(upErr);
      return { ok: false, error: upErr };
    }

    if (options.actorUserId) {
      void logRiskStateRecomputed(supabase, {
        userId,
        actorUserId: options.actorUserId,
        fraudLogId: options.fraudLogId ?? null,
        derived,
        stats,
      });
    }

    let mergedPatch = { ...patch };
    try {
      const ac = await persistAccountControlState(supabase, userId, {
        source: "recomputed",
        actorUserId: options.actorUserId ?? null,
        fraudLogId: options.fraudLogId ?? null,
        riskLevel: derived.riskLevel,
        riskFlags: derived.riskFlags,
        stats,
      });
      if (ac.ok && ac.patch && typeof ac.patch === "object") {
        mergedPatch = { ...mergedPatch, ...ac.patch };
      }
    } catch (e) {
      console.error(e);
    }

    void maybeCreateRiskAlerts(supabase, {
      userId,
      actorUserId: options.actorUserId ?? null,
      fraudLogId: options.fraudLogId ?? null,
      previousRiskLevel,
      nextRiskLevel: derived.riskLevel,
      stats,
    });

    return { ok: true, persisted: true, derived, stats, patch: mergedPatch };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e };
  }
}
