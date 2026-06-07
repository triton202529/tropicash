import { supabase } from "./supabaseClient";

/**
 * Phase 11D–11F: KYC risk visibility and limit policy architecture.
 *
 * Phase 11F: Withdrawals are enforcement-aware via enforceKycForWithdrawal() (client).
 * Phase 11H: Server gate via lib/serverKycWithdrawalGuard.js + /api/withdrawals/check-limit.
 * Phase 11I: Cumulative daily withdrawal usage (pending + processing + paid).
 * Phase 11J: Funding/send cumulative daily usage preview (advisory only — never blocks).
 * TODO(Phase 11G+): Wire enforceKycForFunding / enforceKycForSend when ready.
 * TODO(Phase 11G+): Require approved KYC before production live-money launch.
 */

const DEFAULT_STATUS = "not_started";

const ACTION_TYPES = ["funding", "send", "withdrawal"];

/** Statuses counted toward daily withdrawal usage (Phase 11I). */
export const WITHDRAWAL_DAILY_COUNTED_STATUSES = Object.freeze(["pending", "processing", "paid"]);

/** Statuses excluded from daily withdrawal usage (Phase 11I). */
export const WITHDRAWAL_DAILY_EXCLUDED_STATUSES = Object.freeze(["rejected", "failed", "cancelled"]);

function resolveDateForUsage(date) {
  if (date instanceof Date && !Number.isNaN(date.getTime())) return new Date(date);
  if (typeof date === "string" && date.trim()) {
    const parsed = new Date(date);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

function startOfLocalDay(date) {
  const d = resolveDateForUsage(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfLocalDay(date) {
  const d = resolveDateForUsage(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function localDateKey(date) {
  const d = resolveDateForUsage(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sumCountedWithdrawalAmounts(rows) {
  let total = 0;
  for (const row of rows || []) {
    const st = String(row?.status || "").toLowerCase();
    if (!WITHDRAWAL_DAILY_COUNTED_STATUSES.includes(st)) continue;
    const amt = Number(row.amount);
    if (Number.isFinite(amt)) total += amt;
  }
  return total;
}

/**
 * Batch-fetch cumulative daily withdrawal usage per user (local calendar day).
 * @param {string[]} userIds
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchWithdrawalDailyUsageMapForUsers(userIds, { date, supabaseClient } = {}) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return {};

  const dayStart = startOfLocalDay(date);
  const dayEnd = endOfLocalDay(date);
  const client = resolveKycClient(supabaseClient);

  const { data, error } = await client
    .from("withdrawal_requests")
    .select("user_id, amount, status, created_at")
    .in("user_id", ids)
    .gte("created_at", dayStart.toISOString())
    .lte("created_at", dayEnd.toISOString());

  if (error) {
    console.warn("[kycRisk] fetchWithdrawalDailyUsageMapForUsers", error.message);
    return Object.fromEntries(ids.map((id) => [id, 0]));
  }

  const map = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const row of data || []) {
    const uid = row?.user_id;
    if (!uid || !Object.prototype.hasOwnProperty.call(map, uid)) continue;
    const st = String(row?.status || "").toLowerCase();
    if (!WITHDRAWAL_DAILY_COUNTED_STATUSES.includes(st)) continue;
    const amt = Number(row.amount);
    if (Number.isFinite(amt)) map[uid] += amt;
  }
  return map;
}

/**
 * Cumulative withdrawal usage for a user on a given local calendar day.
 */
export async function fetchUserWithdrawalDailyUsage({ userId, date, supabaseClient } = {}) {
  const countedStatuses = [...WITHDRAWAL_DAILY_COUNTED_STATUSES];
  const excludedStatuses = [...WITHDRAWAL_DAILY_EXCLUDED_STATUSES];
  const dateKey = localDateKey(date);

  if (!userId) {
    return {
      userId: null,
      date: dateKey,
      usedToday: 0,
      countedStatuses,
      excludedStatuses,
      error: new Error("userId is required"),
    };
  }

  const dayStart = startOfLocalDay(date);
  const dayEnd = endOfLocalDay(date);
  const client = resolveKycClient(supabaseClient);

  const { data, error } = await client
    .from("withdrawal_requests")
    .select("amount, status, created_at")
    .eq("user_id", userId)
    .gte("created_at", dayStart.toISOString())
    .lte("created_at", dayEnd.toISOString());

  if (error) {
    console.warn("[kycRisk] fetchUserWithdrawalDailyUsage", error.message);
    return {
      userId,
      date: dateKey,
      usedToday: 0,
      countedStatuses,
      excludedStatuses,
      error,
    };
  }

  return {
    userId,
    date: dateKey,
    usedToday: sumCountedWithdrawalAmounts(data),
    countedStatuses,
    excludedStatuses,
    error: null,
  };
}

/** Transaction types counted as wallet funding (public.transactions). */
export const FUNDING_TRANSACTION_TYPES = Object.freeze(["fund_wallet", "fund", "wallet_funded"]);

/** Outgoing send transaction types (public.transactions). */
export const SEND_TRANSACTION_TYPES = Object.freeze(["send_money", "send"]);

/** Statuses counted toward daily funding usage (Phase 11J). */
export const FUNDING_DAILY_COUNTED_STATUSES = Object.freeze(["completed", "pending", "processing"]);

/** Statuses excluded from daily funding usage (Phase 11J). */
export const FUNDING_DAILY_EXCLUDED_STATUSES = Object.freeze([
  "failed",
  "cancelled",
  "canceled",
  "rejected",
  "blocked",
  "reversed",
]);

/** Statuses counted toward daily send usage (Phase 11J). */
export const SEND_DAILY_COUNTED_STATUSES = Object.freeze(["completed", "pending", "processing"]);

/** Statuses excluded from daily send usage (Phase 11J). */
export const SEND_DAILY_EXCLUDED_STATUSES = Object.freeze([
  "failed",
  "cancelled",
  "canceled",
  "rejected",
  "blocked",
  "reversed",
]);

function normalizeTransactionStatus(raw) {
  return String(raw || "completed").toLowerCase();
}

function isExcludedTransactionStatus(status, excludedStatuses) {
  const st = normalizeTransactionStatus(status);
  if (excludedStatuses.includes(st)) return true;
  if (st.includes("fail") || st.includes("cancel") || st.includes("revers") || st.includes("reject") || st === "blocked") {
    return true;
  }
  return false;
}

function isCountedTransactionStatus(status, countedStatuses, excludedStatuses) {
  if (isExcludedTransactionStatus(status, excludedStatuses)) return false;
  const st = normalizeTransactionStatus(status);
  return countedStatuses.includes(st);
}

function sumCountedTransactionAmounts(rows, countedStatuses, excludedStatuses) {
  let total = 0;
  for (const row of rows || []) {
    if (!isCountedTransactionStatus(row?.status, countedStatuses, excludedStatuses)) continue;
    const amt = Number(row.amount);
    if (Number.isFinite(amt)) total += amt;
  }
  return total;
}

async function fetchTransactionDailyUsageForUser({
  userId,
  date,
  types,
  countedStatuses,
  excludedStatuses,
  logKey,
  supabaseClient,
}) {
  const counted = [...countedStatuses];
  const excluded = [...excludedStatuses];
  const dateKey = localDateKey(date);

  if (!userId) {
    return {
      userId: null,
      date: dateKey,
      usedToday: 0,
      countedStatuses: counted,
      excludedStatuses: excluded,
      error: new Error("userId is required"),
    };
  }

  const dayStart = startOfLocalDay(date);
  const dayEnd = endOfLocalDay(date);
  const client = resolveKycClient(supabaseClient);

  const { data, error } = await client
    .from("transactions")
    .select("amount, status, type, created_at")
    .eq("sender_id", userId)
    .in("type", types)
    .gte("created_at", dayStart.toISOString())
    .lte("created_at", dayEnd.toISOString());

  if (error) {
    console.warn(`[kycRisk] ${logKey}`, error.message);
    return {
      userId,
      date: dateKey,
      usedToday: 0,
      countedStatuses: counted,
      excludedStatuses: excluded,
      error,
    };
  }

  return {
    userId,
    date: dateKey,
    usedToday: sumCountedTransactionAmounts(data, counted, excluded),
    countedStatuses: counted,
    excludedStatuses: excluded,
    error: null,
  };
}

async function fetchTransactionDailyUsageMapForUsers({
  userIds,
  date,
  types,
  countedStatuses,
  excludedStatuses,
  logKey,
  supabaseClient,
}) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return {};

  const dayStart = startOfLocalDay(date);
  const dayEnd = endOfLocalDay(date);
  const client = resolveKycClient(supabaseClient);

  const { data, error } = await client
    .from("transactions")
    .select("sender_id, amount, status, type, created_at")
    .in("sender_id", ids)
    .in("type", types)
    .gte("created_at", dayStart.toISOString())
    .lte("created_at", dayEnd.toISOString());

  if (error) {
    console.warn(`[kycRisk] ${logKey}`, error.message);
    return Object.fromEntries(ids.map((id) => [id, 0]));
  }

  const map = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const row of data || []) {
    const uid = row?.sender_id;
    if (!uid || !Object.prototype.hasOwnProperty.call(map, uid)) continue;
    if (!isCountedTransactionStatus(row?.status, countedStatuses, excludedStatuses)) continue;
    const amt = Number(row.amount);
    if (Number.isFinite(amt)) map[uid] += amt;
  }
  return map;
}

/**
 * Cumulative funding usage for a user on a given local calendar day.
 */
export async function fetchUserFundingDailyUsage({ userId, date, supabaseClient } = {}) {
  return fetchTransactionDailyUsageForUser({
    userId,
    date,
    supabaseClient,
    types: [...FUNDING_TRANSACTION_TYPES],
    countedStatuses: FUNDING_DAILY_COUNTED_STATUSES,
    excludedStatuses: FUNDING_DAILY_EXCLUDED_STATUSES,
    logKey: "fetchUserFundingDailyUsage",
  });
}

/**
 * Cumulative outgoing send usage for a user on a given local calendar day.
 */
export async function fetchUserSendDailyUsage({ userId, date, supabaseClient } = {}) {
  return fetchTransactionDailyUsageForUser({
    userId,
    date,
    supabaseClient,
    types: [...SEND_TRANSACTION_TYPES],
    countedStatuses: SEND_DAILY_COUNTED_STATUSES,
    excludedStatuses: SEND_DAILY_EXCLUDED_STATUSES,
    logKey: "fetchUserSendDailyUsage",
  });
}

/**
 * Batch-fetch cumulative daily funding usage per user.
 * @param {string[]} userIds
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchFundingDailyUsageMapForUsers(userIds, { date, supabaseClient } = {}) {
  return fetchTransactionDailyUsageMapForUsers({
    userIds,
    date,
    supabaseClient,
    types: [...FUNDING_TRANSACTION_TYPES],
    countedStatuses: FUNDING_DAILY_COUNTED_STATUSES,
    excludedStatuses: FUNDING_DAILY_EXCLUDED_STATUSES,
    logKey: "fetchFundingDailyUsageMapForUsers",
  });
}

/**
 * Batch-fetch cumulative daily send usage per user.
 * @param {string[]} userIds
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchSendDailyUsageMapForUsers(userIds, { date, supabaseClient } = {}) {
  return fetchTransactionDailyUsageMapForUsers({
    userIds,
    date,
    supabaseClient,
    types: [...SEND_TRANSACTION_TYPES],
    countedStatuses: SEND_DAILY_COUNTED_STATUSES,
    excludedStatuses: SEND_DAILY_EXCLUDED_STATUSES,
    logKey: "fetchSendDailyUsageMapForUsers",
  });
}

const FALLBACK_POLICIES = {
  approved: { funding_daily_limit: 10000, send_daily_limit: 5000, withdrawal_daily_limit: 5000, enforcement_mode: "advisory", is_active: true },
  submitted: { funding_daily_limit: 500, send_daily_limit: 200, withdrawal_daily_limit: 200, enforcement_mode: "advisory", is_active: true },
  under_review: { funding_daily_limit: 500, send_daily_limit: 200, withdrawal_daily_limit: 200, enforcement_mode: "advisory", is_active: true },
  rejected: { funding_daily_limit: 100, send_daily_limit: 50, withdrawal_daily_limit: 50, enforcement_mode: "advisory", is_active: true },
  needs_more_info: { funding_daily_limit: 100, send_daily_limit: 50, withdrawal_daily_limit: 50, enforcement_mode: "advisory", is_active: true },
  not_started: { funding_daily_limit: 250, send_daily_limit: 100, withdrawal_daily_limit: 100, enforcement_mode: "advisory", is_active: true },
  missing: { funding_daily_limit: 250, send_daily_limit: 100, withdrawal_daily_limit: 100, enforcement_mode: "advisory", is_active: true },
};

const LIMIT_TIERS = {
  verified: {
    fundingDaily: 10000,
    sendDaily: 5000,
    withdrawalDaily: 5000,
  },
  pending: {
    fundingDaily: 500,
    sendDaily: 200,
    withdrawalDaily: 200,
  },
  needs_review: {
    fundingDaily: 100,
    sendDaily: 50,
    withdrawalDaily: 50,
  },
  unverified: {
    fundingDaily: 250,
    sendDaily: 100,
    withdrawalDaily: 100,
  },
};

function normalizeKycStatus(raw) {
  const key = String(raw || DEFAULT_STATUS).toLowerCase().trim();
  if (
    key === "not_started" ||
    key === "submitted" ||
    key === "under_review" ||
    key === "approved" ||
    key === "rejected" ||
    key === "needs_more_info" ||
    key === "missing"
  ) {
    return key;
  }
  return DEFAULT_STATUS;
}

function normalizeEnforcementMode(raw) {
  const key = String(raw || "advisory").toLowerCase().trim();
  if (key === "soft_block" || key === "hard_block") return key;
  return "advisory";
}

function limitFieldForAction(actionType) {
  if (actionType === "funding") return "funding_daily_limit";
  if (actionType === "send") return "send_daily_limit";
  if (actionType === "withdrawal") return "withdrawal_daily_limit";
  return null;
}

function fallbackPolicyForStatus(status) {
  const key = normalizeKycStatus(status);
  const row = FALLBACK_POLICIES[key] || FALLBACK_POLICIES.missing;
  return {
    kyc_status: key,
    ...row,
    id: null,
    created_at: null,
    updated_at: null,
  };
}

function isMissingPolicyTable(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return code === "42P01" || (msg.includes("kyc_limit_policies") && msg.includes("does not exist"));
}

function resolveKycClient(supabaseClient) {
  return supabaseClient || supabase;
}

export async function resolveKycPolicyStatus(userId, { supabaseClient } = {}) {
  if (!userId) return { policyStatus: "missing", kycStatus: DEFAULT_STATUS, error: null };

  const client = resolveKycClient(supabaseClient);
  const { data, error } = await client
    .from("kyc_profiles")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (String(error.code || "") === "42P01") {
      return { policyStatus: "missing", kycStatus: DEFAULT_STATUS, error: null };
    }
    return { policyStatus: "missing", kycStatus: DEFAULT_STATUS, error };
  }

  if (!data) {
    return { policyStatus: "missing", kycStatus: DEFAULT_STATUS, error: null };
  }

  const kycStatus = normalizeKycStatus(data.status);
  return { policyStatus: kycStatus, kycStatus, error: null };
}

export async function fetchKycLimitPolicies({ includeInactive = false } = {}) {
  let query = supabase
    .from("kyc_limit_policies")
    .select(
      "id, kyc_status, funding_daily_limit, send_daily_limit, withdrawal_daily_limit, enforcement_mode, is_active, created_at, updated_at",
    )
    .order("kyc_status", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingPolicyTable(error)) {
      return {
        data: Object.entries(FALLBACK_POLICIES).map(([kyc_status, row]) => ({
          id: null,
          kyc_status,
          ...row,
          created_at: null,
          updated_at: null,
        })),
        error: null,
        policiesUnavailable: true,
      };
    }
    return { data: [], error, policiesUnavailable: false };
  }

  return { data: Array.isArray(data) ? data : [], error: null, policiesUnavailable: false };
}

export async function fetchKycLimitPolicyForStatus(status, { supabaseClient } = {}) {
  const policyStatus = normalizeKycStatus(status === "missing" ? "missing" : status);

  const client = resolveKycClient(supabaseClient);
  const { data, error } = await client
    .from("kyc_limit_policies")
    .select(
      "id, kyc_status, funding_daily_limit, send_daily_limit, withdrawal_daily_limit, enforcement_mode, is_active, created_at, updated_at",
    )
    .eq("kyc_status", policyStatus)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    if (isMissingPolicyTable(error)) {
      return { data: fallbackPolicyForStatus(policyStatus), error: null, policiesUnavailable: true };
    }
    return { data: fallbackPolicyForStatus(policyStatus), error, policiesUnavailable: false };
  }

  if (!data) {
    return { data: fallbackPolicyForStatus(policyStatus), error: null, policiesUnavailable: false };
  }

  return { data, error: null, policiesUnavailable: false };
}

export async function updateKycLimitPolicy(policyId, updates) {
  if (!policyId) {
    return { data: null, error: new Error("policyId is required.") };
  }

  const payload = {};
  if (updates.funding_daily_limit != null) payload.funding_daily_limit = Number(updates.funding_daily_limit);
  if (updates.send_daily_limit != null) payload.send_daily_limit = Number(updates.send_daily_limit);
  if (updates.withdrawal_daily_limit != null) payload.withdrawal_daily_limit = Number(updates.withdrawal_daily_limit);
  if (updates.enforcement_mode != null) payload.enforcement_mode = normalizeEnforcementMode(updates.enforcement_mode);
  if (updates.is_active != null) payload.is_active = !!updates.is_active;

  const { data, error } = await supabase
    .from("kyc_limit_policies")
    .update(payload)
    .eq("id", policyId)
    .select("*")
    .maybeSingle();

  return { data: data || null, error };
}

/**
 * Evaluate a transaction against KYC policy limits.
 * advisory: allowed stays true when over limit.
 * soft_block / hard_block: allowed false when over limit (enforced at call sites — withdrawals in Phase 11F).
 */
export async function evaluateKycTransactionLimit({ userId, actionType, amount, supabaseClient } = {}) {
  const action = String(actionType || "").toLowerCase();
  if (!ACTION_TYPES.includes(action)) {
    return {
      allowed: true,
      mode: "advisory",
      reason: null,
      kycStatus: DEFAULT_STATUS,
      limit: null,
      amount: Number(amount) || 0,
      advisoryOnly: true,
      exceedsLimit: false,
      error: new Error(`Invalid actionType: ${actionType}`),
    };
  }

  const amt = Number(amount);
  const safeAmount = Number.isFinite(amt) ? amt : 0;

  const { policyStatus, kycStatus, error: statusError } = await resolveKycPolicyStatus(userId, { supabaseClient });
  if (statusError) {
    console.warn("[kycRisk] resolveKycPolicyStatus", statusError.message);
  }

  const { data: policy } = await fetchKycLimitPolicyForStatus(policyStatus, { supabaseClient });
  const limitField = limitFieldForAction(action);
  const limit = Number(policy?.[limitField]);
  const safeLimit = Number.isFinite(limit) ? limit : null;
  const mode = normalizeEnforcementMode(policy?.enforcement_mode);
  const policyAdvisoryOnly = mode === "advisory";
  const previewOnlyAction = action === "funding" || action === "send";

  let usedToday = null;
  let remainingToday = null;
  let projectedTotal = safeAmount;
  let exceedsLimit = false;

  if (action === "withdrawal" && userId) {
    const usage = await fetchUserWithdrawalDailyUsage({ userId, supabaseClient });
    usedToday = Number.isFinite(Number(usage.usedToday)) ? Number(usage.usedToday) : 0;
    projectedTotal = usedToday + safeAmount;
    if (safeLimit != null) {
      remainingToday = Math.max(0, safeLimit - usedToday);
    }
    exceedsLimit = safeLimit != null && projectedTotal > safeLimit;
  } else if (action === "funding" && userId) {
    const usage = await fetchUserFundingDailyUsage({ userId, supabaseClient });
    usedToday = Number.isFinite(Number(usage.usedToday)) ? Number(usage.usedToday) : 0;
    projectedTotal = usedToday + safeAmount;
    if (safeLimit != null) {
      remainingToday = Math.max(0, safeLimit - usedToday);
    }
    exceedsLimit = safeLimit != null && projectedTotal > safeLimit;
  } else if (action === "send" && userId) {
    const usage = await fetchUserSendDailyUsage({ userId, supabaseClient });
    usedToday = Number.isFinite(Number(usage.usedToday)) ? Number(usage.usedToday) : 0;
    projectedTotal = usedToday + safeAmount;
    if (safeLimit != null) {
      remainingToday = Math.max(0, safeLimit - usedToday);
    }
    exceedsLimit = safeLimit != null && projectedTotal > safeLimit;
  } else {
    projectedTotal = safeAmount;
    exceedsLimit = safeLimit != null && safeAmount > safeLimit;
  }

  const advisoryOnly = previewOnlyAction ? true : policyAdvisoryOnly;

  let allowed = true;
  let reason = null;

  if (exceedsLimit && !advisoryOnly) {
    allowed = false;
    if (action === "withdrawal") {
      reason =
        mode === "hard_block"
          ? "Daily withdrawal total would exceed your KYC hard daily limit."
          : "Daily withdrawal total would exceed your recommended KYC daily limit.";
    } else {
      reason =
        mode === "hard_block"
          ? "This amount exceeds your KYC daily limit."
          : "This amount exceeds your recommended KYC daily limit.";
    }
  } else if (exceedsLimit && advisoryOnly) {
    if (previewOnlyAction) {
      reason =
        "Daily total exceeds recommended KYC daily limit (advisory preview only — funding and send are not blocked).";
    } else if (action === "withdrawal") {
      reason = "Daily withdrawal total exceeds recommended KYC daily limit (advisory only — not blocked yet).";
    } else {
      reason = "Amount exceeds recommended KYC daily limit (advisory only — not blocked yet).";
    }
  }

  if (previewOnlyAction) {
    allowed = true;
  }

  return {
    allowed: advisoryOnly ? true : allowed,
    mode,
    reason,
    kycStatus,
    policyStatus,
    limit: safeLimit,
    amount: safeAmount,
    usedToday,
    remainingToday,
    projectedTotal,
    advisoryOnly,
    exceedsLimit,
    error: null,
  };
}

function formatLimitForMessage(limit) {
  const n = Number(limit);
  if (!Number.isFinite(n)) return "your current";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Sync withdrawal enforcement decision from known policy + amount (treasury/admin metadata).
 * @param {{ usedToday?: number }} opts — cumulative usage already counted today (includes existing row when displaying).
 */
export function evaluateWithdrawalEnforcementFromPolicy({ kycStatus, amount, policy, usedToday = 0 }) {
  const status = normalizeKycStatus(kycStatus || "missing");
  const policySummary = summarizeKycLimitPolicy(policy || status);
  const mode = policySummary.enforcementMode;
  const limit = policySummary.withdrawalDaily;
  const safeAmount = Number(amount);
  const safeUsed = Number.isFinite(Number(usedToday)) ? Number(usedToday) : 0;
  const safeLimit = Number.isFinite(limit) ? limit : null;
  const projectedTotal = (Number.isFinite(safeAmount) ? safeAmount : 0) + safeUsed;
  const exceedsLimit = safeLimit != null && projectedTotal > safeLimit;
  const advisoryOnly = mode === "advisory";
  let allowed = true;
  if (exceedsLimit && !advisoryOnly) {
    allowed = false;
  }
  const remainingToday = safeLimit != null ? Math.max(0, safeLimit - safeUsed) : null;
  return {
    allowed,
    mode,
    exceedsLimit,
    limit: safeLimit,
    amount: Number.isFinite(safeAmount) ? safeAmount : 0,
    usedToday: safeUsed,
    remainingToday,
    projectedTotal,
    kycStatus: status,
  };
}

/**
 * Admin withdrawal queue compliance summary (no document paths).
 * @param {{ usedToday?: number }} opts — cumulative counted usage today for the user.
 */
export function buildWithdrawalComplianceContext({ kycStatus, amount, policy, usedToday = 0 }) {
  const status = normalizeKycStatus(kycStatus || "missing");
  const risk = buildKycRiskProfileFromStatus(status);
  const policySummary = summarizeKycLimitPolicy(policy || status);
  const safeUsed = Number.isFinite(Number(usedToday)) ? Number(usedToday) : 0;
  const enforcement = evaluateWithdrawalEnforcementFromPolicy({
    kycStatus: status,
    amount: 0,
    policy,
    usedToday: safeUsed,
  });
  const rowAmount = Number(amount);
  const safeAmount = Number.isFinite(rowAmount) ? rowAmount : 0;
  const stCounted = WITHDRAWAL_DAILY_COUNTED_STATUSES;
  const notApproved = status !== "approved";
  const needsKycReview = ["rejected", "needs_more_info", "not_started", "missing"].includes(status);
  const enforcementActive =
    policySummary.enforcementMode === "soft_block" || policySummary.enforcementMode === "hard_block";
  const exceedsLimit = enforcement.exceedsLimit;

  const showComplianceCaution =
    notApproved || exceedsLimit || enforcementActive;

  return {
    kycStatus: status,
    verificationTier: risk.verificationTier,
    kycRiskLevel: risk.riskLevel,
    withdrawalDailyLimit: policySummary.withdrawalDaily,
    enforcementMode: policySummary.enforcementMode,
    usedToday: safeUsed,
    remainingToday: enforcement.remainingToday,
    projectedTotal: safeUsed,
    requestAmount: safeAmount,
    exceedsLimit,
    wouldBlockIfEnforced: !enforcement.allowed,
    showComplianceCaution,
    needsKycReview,
    countedStatuses: stCounted,
  };
}

function buildWithdrawalEnforcementMessages({
  allowed,
  mode,
  exceedsLimit,
  limit,
  kycStatus,
  usedToday,
  amount,
  projectedTotal,
}) {
  const limitLabel = formatLimitForMessage(limit);
  const usedLabel = formatLimitForMessage(usedToday);
  const amountLabel = formatLimitForMessage(amount);
  const projectedLabel = formatLimitForMessage(projectedTotal);
  const cumulativeDetail = `Daily limit ${limitLabel}; used today ${usedLabel}; requested ${amountLabel}; projected total ${projectedLabel}.`;
  const approved = normalizeKycStatus(kycStatus) === "approved";

  if (!allowed) {
    if (mode === "hard_block") {
      return {
        reason: "Daily withdrawal total exceeds KYC hard daily limit.",
        userMessage: `This withdrawal would exceed your daily limit. ${cumulativeDetail} Lower the amount or contact support.`,
      };
    }
    return {
      reason: "Daily withdrawal total exceeds KYC soft daily limit.",
      userMessage: approved
        ? `This withdrawal would exceed your daily limit. ${cumulativeDetail} Try a smaller amount.`
        : `This withdrawal would exceed your daily limit. ${cumulativeDetail} Verify your identity or lower the amount.`,
    };
  }

  if (exceedsLimit && mode === "advisory") {
    return {
      reason: "Daily withdrawal total exceeds advisory KYC daily limit.",
      userMessage: `This withdrawal would exceed your recommended daily limit. ${cumulativeDetail} Withdrawals are not blocked while enforcement is advisory.`,
    };
  }

  return { reason: null, userMessage: null };
}

/**
 * Phase 11F: Withdrawal-only KYC enforcement gate (client-side, before withdrawal request creation).
 */
export async function enforceKycForWithdrawal({ userId, amount, supabaseClient } = {}) {
  const evaluation = await evaluateKycTransactionLimit({
    userId,
    actionType: "withdrawal",
    amount,
    supabaseClient,
  });

  const { allowed, mode, kycStatus, limit, amount: safeAmount, exceedsLimit, usedToday, remainingToday, projectedTotal } =
    evaluation;
  const { reason, userMessage } = buildWithdrawalEnforcementMessages({
    allowed,
    mode,
    exceedsLimit,
    limit,
    kycStatus,
    usedToday,
    amount: safeAmount,
    projectedTotal,
  });

  return {
    allowed,
    mode,
    reason,
    userMessage,
    kycStatus,
    limit,
    amount: safeAmount,
    usedToday,
    remainingToday,
    projectedTotal,
    exceedsLimit,
  };
}

export function getKycLimitRecommendation(kycStatus) {
  const status = normalizeKycStatus(kycStatus);

  if (status === "approved") {
    return {
      riskLevel: "low",
      verificationTier: "verified",
      recommendedLimits: { ...LIMIT_TIERS.verified },
      warnings: [],
    };
  }

  if (status === "submitted" || status === "under_review") {
    return {
      riskLevel: "medium",
      verificationTier: "pending",
      recommendedLimits: { ...LIMIT_TIERS.pending },
      warnings: ["Identity verification is under review. Future limits may be adjusted after approval."],
    };
  }

  if (status === "rejected" || status === "needs_more_info") {
    return {
      riskLevel: "high",
      verificationTier: "needs_review",
      recommendedLimits: { ...LIMIT_TIERS.needs_review },
      warnings: ["Identity verification requires attention before higher limits can apply."],
    };
  }

  return {
    riskLevel: "high",
    verificationTier: "unverified",
    recommendedLimits: { ...LIMIT_TIERS.unverified },
    warnings: ["Complete identity verification to unlock higher recommended limits."],
  };
}

/**
 * @param {string} kycStatus
 * @returns {{ tone: "success"|"info"|"warning"|"danger", message: string, showLink: boolean }}
 */
export function getKycSoftLimitBannerContent(kycStatus) {
  const status = normalizeKycStatus(kycStatus);

  if (status === "approved") {
    return {
      tone: "success",
      message: "Identity verified.",
      showLink: false,
    };
  }

  if (status === "submitted" || status === "under_review") {
    return {
      tone: "info",
      message: "Verification is under review. Some future limits may apply.",
      showLink: true,
    };
  }

  if (status === "rejected" || status === "needs_more_info") {
    return {
      tone: "warning",
      message: "Verification requires attention. Please update your identity verification.",
      showLink: true,
    };
  }

  return {
    tone: "info",
    message: "Verify your identity to unlock higher limits and prepare for full account access.",
    showLink: true,
  };
}

export async function getKycStatusForUser(userId, { supabaseClient } = {}) {
  if (!userId) {
    return { status: DEFAULT_STATUS, error: new Error("userId is required.") };
  }

  const client = resolveKycClient(supabaseClient);
  const { data, error } = await client
    .from("kyc_profiles")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (String(error.code || "") === "42P01") {
      return { status: DEFAULT_STATUS, error: null };
    }
    return { status: DEFAULT_STATUS, error };
  }

  return { status: normalizeKycStatus(data?.status), error: null };
}

/**
 * Batch-fetch KYC statuses for treasury/admin enrichment. Missing rows → not_started.
 * @param {string[]} userIds
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchKycStatusMapForUsers(userIds) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return {};

  const { data, error } = await supabase.from("kyc_profiles").select("user_id, status").in("user_id", ids);

  if (error) {
    console.warn("[kycRisk] fetchKycStatusMapForUsers", error.message);
    return Object.fromEntries(ids.map((id) => [id, DEFAULT_STATUS]));
  }

  const map = Object.fromEntries(ids.map((id) => [id, "missing"]));
  for (const row of data || []) {
    if (row?.user_id) {
      map[row.user_id] = normalizeKycStatus(row.status);
    }
  }
  return map;
}

export async function buildKycRiskProfile(userId) {
  if (!userId) {
    return { data: null, error: new Error("userId is required.") };
  }

  const { status, error } = await getKycStatusForUser(userId);
  if (error) {
    return { data: null, error };
  }

  const recommendation = getKycLimitRecommendation(status);

  return {
    data: {
      userId,
      kycStatus: status,
      riskLevel: recommendation.riskLevel,
      verificationTier: recommendation.verificationTier,
      recommendedLimits: recommendation.recommendedLimits,
      warnings: recommendation.warnings,
    },
    error: null,
  };
}

/**
 * Build a compact admin summary from a known KYC status (no fetch).
 * @param {string} kycStatus
 * @returns {{ kycStatus: string, riskLevel: string, verificationTier: string, recommendedLimits: object, warnings: string[] }}
 */
export function buildKycRiskProfileFromStatus(kycStatus) {
  const status = normalizeKycStatus(kycStatus);
  const recommendation = getKycLimitRecommendation(status);
  return {
    kycStatus: status,
    riskLevel: recommendation.riskLevel,
    verificationTier: recommendation.verificationTier,
    recommendedLimits: recommendation.recommendedLimits,
    warnings: recommendation.warnings,
  };
}

/**
 * Sync policy summary for admin display from a policy row or status key.
 */
export function summarizeKycLimitPolicy(policyOrStatus) {
  if (policyOrStatus && typeof policyOrStatus === "object" && policyOrStatus.kyc_status) {
    return {
      kycStatus: policyOrStatus.kyc_status,
      enforcementMode: normalizeEnforcementMode(policyOrStatus.enforcement_mode),
      fundingDaily: Number(policyOrStatus.funding_daily_limit),
      sendDaily: Number(policyOrStatus.send_daily_limit),
      withdrawalDaily: Number(policyOrStatus.withdrawal_daily_limit),
      isActive: policyOrStatus.is_active !== false,
    };
  }
  const fallback = fallbackPolicyForStatus(policyOrStatus);
  return {
    kycStatus: fallback.kyc_status,
    enforcementMode: fallback.enforcement_mode,
    fundingDaily: fallback.funding_daily_limit,
    sendDaily: fallback.send_daily_limit,
    withdrawalDaily: fallback.withdrawal_daily_limit,
    isActive: fallback.is_active,
  };
}

/**
 * TODO(notifications): emit user notifications on KYC approved / rejected / needs_more_info
 * when wired through lib/notifications.js or lib/notificationService.js.
 */
