import { supabase } from "./supabaseClient";

/**
 * Phase 11D–11F: KYC risk visibility and limit policy architecture.
 *
 * Phase 11F: Withdrawals are enforcement-aware via enforceKycForWithdrawal().
 * Funding and send-money remain advisory only until a later phase.
 * TODO(Phase 11G+): Wire enforceKycForFunding / enforceKycForSend when ready.
 * TODO(Phase 11G+): Require approved KYC before production live-money launch.
 */

const DEFAULT_STATUS = "not_started";

const ACTION_TYPES = ["funding", "send", "withdrawal"];

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

export async function resolveKycPolicyStatus(userId) {
  if (!userId) return { policyStatus: "missing", kycStatus: DEFAULT_STATUS, error: null };

  const { data, error } = await supabase
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

export async function fetchKycLimitPolicyForStatus(status) {
  const policyStatus = normalizeKycStatus(status === "missing" ? "missing" : status);

  const { data, error } = await supabase
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
export async function evaluateKycTransactionLimit({ userId, actionType, amount }) {
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

  const { policyStatus, kycStatus, error: statusError } = await resolveKycPolicyStatus(userId);
  if (statusError) {
    console.warn("[kycRisk] resolveKycPolicyStatus", statusError.message);
  }

  const { data: policy } = await fetchKycLimitPolicyForStatus(policyStatus);
  const limitField = limitFieldForAction(action);
  const limit = Number(policy?.[limitField]);
  const safeLimit = Number.isFinite(limit) ? limit : null;
  const mode = normalizeEnforcementMode(policy?.enforcement_mode);
  const exceedsLimit = safeLimit != null && safeAmount > safeLimit;
  const advisoryOnly = mode === "advisory";

  let allowed = true;
  let reason = null;

  if (exceedsLimit && !advisoryOnly) {
    allowed = false;
    reason =
      mode === "hard_block"
        ? "This amount exceeds your KYC daily limit."
        : "This amount exceeds your recommended KYC daily limit.";
  } else if (exceedsLimit && advisoryOnly) {
    reason = "Amount exceeds recommended KYC daily limit (advisory only — not blocked yet).";
  }

  return {
    allowed: advisoryOnly ? true : allowed,
    mode,
    reason,
    kycStatus,
    policyStatus,
    limit: safeLimit,
    amount: safeAmount,
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
 * Sync withdrawal enforcement decision from known policy + amount (treasury metadata).
 */
export function evaluateWithdrawalEnforcementFromPolicy({ kycStatus, amount, policy }) {
  const status = normalizeKycStatus(kycStatus || "missing");
  const policySummary = summarizeKycLimitPolicy(policy || status);
  const mode = policySummary.enforcementMode;
  const limit = policySummary.withdrawalDaily;
  const safeAmount = Number(amount);
  const safeLimit = Number.isFinite(limit) ? limit : null;
  const exceedsLimit = safeLimit != null && Number.isFinite(safeAmount) && safeAmount > safeLimit;
  const advisoryOnly = mode === "advisory";
  let allowed = true;
  if (exceedsLimit && !advisoryOnly) {
    allowed = false;
  }
  return {
    allowed,
    mode,
    exceedsLimit,
    limit: safeLimit,
    amount: Number.isFinite(safeAmount) ? safeAmount : 0,
    kycStatus: status,
  };
}

/**
 * Admin withdrawal queue compliance summary (no document paths).
 */
export function buildWithdrawalComplianceContext({ kycStatus, amount, policy }) {
  const status = normalizeKycStatus(kycStatus || "missing");
  const risk = buildKycRiskProfileFromStatus(status);
  const policySummary = summarizeKycLimitPolicy(policy || status);
  const enforcement = evaluateWithdrawalEnforcementFromPolicy({
    kycStatus: status,
    amount,
    policy,
  });
  const notApproved = status !== "approved";
  const needsKycReview = ["rejected", "needs_more_info", "not_started", "missing"].includes(status);
  const enforcementActive =
    policySummary.enforcementMode === "soft_block" || policySummary.enforcementMode === "hard_block";

  const showComplianceCaution =
    notApproved || enforcement.exceedsLimit || enforcementActive;

  return {
    kycStatus: status,
    verificationTier: risk.verificationTier,
    kycRiskLevel: risk.riskLevel,
    withdrawalDailyLimit: policySummary.withdrawalDaily,
    enforcementMode: policySummary.enforcementMode,
    exceedsLimit: enforcement.exceedsLimit,
    wouldBlockIfEnforced: !enforcement.allowed,
    showComplianceCaution,
    needsKycReview,
  };
}

function buildWithdrawalEnforcementMessages({ allowed, mode, exceedsLimit, limit, kycStatus }) {
  const limitLabel = formatLimitForMessage(limit);
  const approved = normalizeKycStatus(kycStatus) === "approved";

  if (!allowed) {
    if (mode === "hard_block") {
      return {
        reason: "Withdrawal amount exceeds KYC hard daily limit.",
        userMessage: `This withdrawal exceeds your identity verification daily limit (${limitLabel}). Lower the amount or contact support.`,
      };
    }
    return {
      reason: "Withdrawal amount exceeds KYC soft daily limit.",
      userMessage: approved
        ? `This withdrawal is above your verified daily limit (${limitLabel}). Try a smaller amount.`
        : `This withdrawal is above your current identity verification limit (${limitLabel}). Verify your identity or lower the amount.`,
    };
  }

  if (exceedsLimit && mode === "advisory") {
    return {
      reason: "Withdrawal exceeds advisory KYC daily limit.",
      userMessage: `This amount is above your recommended daily limit (${limitLabel}). Withdrawals are not blocked while enforcement is advisory.`,
    };
  }

  return { reason: null, userMessage: null };
}

/**
 * Phase 11F: Withdrawal-only KYC enforcement gate (client-side, before withdrawal request creation).
 */
export async function enforceKycForWithdrawal({ userId, amount }) {
  const evaluation = await evaluateKycTransactionLimit({
    userId,
    actionType: "withdrawal",
    amount,
  });

  const { allowed, mode, kycStatus, limit, amount: safeAmount, exceedsLimit } = evaluation;
  const { reason, userMessage } = buildWithdrawalEnforcementMessages({
    allowed,
    mode,
    exceedsLimit,
    limit,
    kycStatus,
  });

  return {
    allowed,
    mode,
    reason,
    userMessage,
    kycStatus,
    limit,
    amount: safeAmount,
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

export async function getKycStatusForUser(userId) {
  if (!userId) {
    return { status: DEFAULT_STATUS, error: new Error("userId is required.") };
  }

  const { data, error } = await supabase
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
