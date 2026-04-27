import { logAccountControlUpdated } from "./fraudEvents";
import { maybeCreateAccountControlAlerts } from "./smartAlerts";

const FLAG_ORDER = [
  "manual_review_required",
  "fraud_watchlist",
  "repeat_offender",
  "escalated_case_history",
  "high_risk_account",
];

function coerceInt(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? Math.floor(x) : fallback;
}

/**
 * @param {unknown} raw
 * @returns {string[]}
 */
export function normalizeAccountFlags(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);
  if (raw && typeof raw === "object") return Object.values(raw).map(String).filter(Boolean);
  return [];
}

function normalizeAccountStatus(raw) {
  const v = String(raw || "").toLowerCase().replace(/\s+/g, "_");
  if (v === "under_review" || v === "restricted" || v === "active") return v;
  return "active";
}

function riskFlagsIncludeUnderReview(riskFlags) {
  const arr = Array.isArray(riskFlags) ? riskFlags.map((x) => String(x).toLowerCase()) : [];
  return arr.includes("under_review");
}

/**
 * @param {{
 *   riskLevel?: string,
 *   riskFlags?: unknown,
 *   totalLogs?: number,
 *   total_logs?: number,
 *   highCount?: number,
 *   high_count?: number,
 *   mediumCount?: number,
 *   medium_count?: number,
 *   lowCount?: number,
 *   low_count?: number,
 *   openCount?: number,
 *   open_count?: number,
 *   reviewedCount?: number,
 *   reviewed_count?: number,
 *   escalatedCount?: number,
 *   escalated_count?: number,
 * }} input
 * @returns {{ accountStatus: string, accountFlags: string[] }}
 */
export function deriveAccountControlState(input) {
  const inObj = input && typeof input === "object" ? input : {};
  const riskLevel = String(inObj.riskLevel || "").toLowerCase();
  const riskFlags = Array.isArray(inObj.riskFlags)
    ? inObj.riskFlags.map((x) => String(x))
    : normalizeAccountFlags(inObj.riskFlags);

  const totalLogs = coerceInt(inObj.totalLogs ?? inObj.total_logs, 0);
  const highCount = coerceInt(inObj.highCount ?? inObj.high_count, 0);
  const openCount = coerceInt(inObj.openCount ?? inObj.open_count, 0);
  const escalatedCount = coerceInt(inObj.escalatedCount ?? inObj.escalated_count, 0);

  let accountStatus = "active";
  const restricted =
    riskLevel === "high" && (escalatedCount >= 2 || highCount >= 3);
  if (restricted) {
    accountStatus = "restricted";
  } else if (openCount >= 1 || riskFlagsIncludeUnderReview(riskFlags) || riskLevel === "medium") {
    accountStatus = "under_review";
  }

  const flags = new Set();
  if (openCount >= 1) flags.add("manual_review_required");
  if (riskLevel === "high" || escalatedCount >= 1) flags.add("fraud_watchlist");
  if (totalLogs >= 3) flags.add("repeat_offender");
  if (escalatedCount >= 1) flags.add("escalated_case_history");
  if (accountStatus === "restricted") flags.add("high_risk_account");

  const accountFlags = FLAG_ORDER.filter((f) => flags.has(f));
  return { accountStatus, accountFlags };
}

function flagsEqual(a, b) {
  const aa = [...(a || [])].map(String).sort();
  const bb = [...(b || [])].map(String).sort();
  if (aa.length !== bb.length) return false;
  return aa.every((v, i) => v === bb[i]);
}

/**
 * @param {*} supabase
 * @param {string} userId
 * @param {{
 *   source?: "manual" | "recomputed",
 *   manualAccountStatus?: string,
 *   actorUserId?: string | null,
 *   fraudLogId?: string | null,
 *   riskLevel?: string,
 *   riskFlags?: unknown,
 *   stats?: Record<string, unknown> | null,
 * }} [options]
 * @returns {Promise<{
 *   ok: boolean,
 *   error?: unknown,
 *   persisted?: boolean,
 *   patch?: Record<string, unknown>,
 *   skipped?: boolean,
 * }>}
 */
export async function persistAccountControlState(supabase, userId, options = {}) {
  if (!supabase || !userId) {
    return { ok: false, error: new Error("persistAccountControlState: missing supabase or userId") };
  }

  const source = options.source === "manual" ? "manual" : "recomputed";
  const actorUserId = options.actorUserId ?? null;
  const fraudLogId = options.fraudLogId ?? null;

  try {
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id, account_status, account_flags, risk_level, risk_flags")
      .eq("id", userId)
      .maybeSingle();

    if (profErr) {
      console.error(profErr);
      return { ok: false, error: profErr };
    }
    if (!prof) {
      return { ok: true, persisted: false, skipped: true };
    }

    const prevStatus = normalizeAccountStatus(prof.account_status);
    const prevFlags = normalizeAccountFlags(prof.account_flags);

    let nextStatus;
    let nextFlags;

    if (source === "manual" && options.manualAccountStatus != null) {
      nextStatus = normalizeAccountStatus(options.manualAccountStatus);
      nextFlags = prevFlags;
    } else {
      const st = options.stats && typeof options.stats === "object" ? options.stats : {};
      const derived = deriveAccountControlState({
        riskLevel: options.riskLevel ?? prof.risk_level,
        riskFlags: options.riskFlags ?? prof.risk_flags,
        total_logs: st.total_logs,
        high_count: st.high_count,
        medium_count: st.medium_count,
        low_count: st.low_count,
        open_count: st.open_count,
        reviewed_count: st.reviewed_count,
        escalated_count: st.escalated_count,
      });
      nextStatus = derived.accountStatus;
      nextFlags = derived.accountFlags;
    }

    const nowIso = new Date().toISOString();
    const patch = {
      account_status: nextStatus,
      account_flags: nextFlags,
      account_last_reviewed_at: nowIso,
    };

    const statusOrFlagsChanged = prevStatus !== nextStatus || !flagsEqual(prevFlags, nextFlags);

    const { error: upErr } = await supabase.from("profiles").update(patch).eq("id", userId);

    if (upErr) {
      console.error(upErr);
      return { ok: false, error: upErr };
    }

    if (statusOrFlagsChanged && actorUserId) {
      void logAccountControlUpdated(supabase, {
        userId,
        actorUserId,
        fraudLogId,
        previousAccountStatus: prevStatus,
        nextAccountStatus: nextStatus,
        accountFlags: nextFlags,
        source,
      });
    }

    if (statusOrFlagsChanged) {
      void maybeCreateAccountControlAlerts(supabase, {
        userId,
        actorUserId,
        fraudLogId,
        previousAccountStatus: prevStatus,
        nextAccountStatus: nextStatus,
      });
    }

    return { ok: true, persisted: true, patch };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e };
  }
}
