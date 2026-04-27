import React from "react";

/**
 * Product-layer soft enforcement from profile account control + risk (no blocking).
 */

function normalizeAccountStatus(raw) {
  const v = String(raw || "").toLowerCase().replace(/\s+/g, "_");
  if (v === "under_review" || v === "restricted" || v === "active") return v;
  return "active";
}

function normalizeFlags(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean);
  if (raw && typeof raw === "object") return Object.values(raw).map(String).filter(Boolean);
  return [];
}

function hasFlag(flags, name) {
  return flags.some((f) => String(f).toLowerCase() === String(name).toLowerCase());
}

/** Tailwind class bundles for light cards (e.g. profile). */
export function softEnforcementLightPanelClassNames(tone) {
  const t = tone === "danger" ? "danger" : tone === "warning" ? "warning" : "info";
  if (t === "danger") {
    return {
      wrap: "mb-4 rounded-[12px] border border-red-200 bg-red-50 p-4",
      title: "text-sm font-semibold text-red-900",
      body: "mt-1 text-sm leading-relaxed text-red-800",
    };
  }
  if (t === "warning") {
    return {
      wrap: "mb-4 rounded-[12px] border border-amber-200 bg-amber-50 p-4",
      title: "text-sm font-semibold text-amber-900",
      body: "mt-1 text-sm leading-relaxed text-amber-900",
    };
  }
  return {
    wrap: "mb-4 rounded-[12px] border border-sky-200 bg-sky-50 p-4",
    title: "text-sm font-semibold text-sky-900",
    body: "mt-1 text-sm leading-relaxed text-sky-900",
  };
}

/**
 * Inline styles for banners on dark gradient pages.
 * @param {"info"|"warning"|"danger"} tone
 * @returns {{ wrap: Record<string, unknown>, title: Record<string, unknown>, body: Record<string, unknown> }}
 */
export function softEnforcementToneStyles(tone) {
  const t = tone === "danger" ? "danger" : tone === "warning" ? "warning" : "info";
  if (t === "danger") {
    return {
      wrap: {
        marginBottom: "1rem",
        padding: "1rem 1.1rem",
        borderRadius: "12px",
        border: "1px solid rgba(248, 113, 113, 0.45)",
        background: "rgba(127, 29, 29, 0.35)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      },
      title: {
        margin: 0,
        fontSize: "0.95rem",
        fontWeight: 700,
        color: "#fecaca",
        letterSpacing: "-0.01em",
      },
      body: {
        margin: "0.45rem 0 0",
        fontSize: "0.875rem",
        lineHeight: 1.55,
        color: "#fca5a5",
      },
    };
  }
  if (t === "warning") {
    return {
      wrap: {
        marginBottom: "1rem",
        padding: "1rem 1.1rem",
        borderRadius: "12px",
        border: "1px solid rgba(251, 191, 36, 0.45)",
        background: "rgba(120, 53, 15, 0.35)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      },
      title: {
        margin: 0,
        fontSize: "0.95rem",
        fontWeight: 700,
        color: "#fde68a",
        letterSpacing: "-0.01em",
      },
      body: {
        margin: "0.45rem 0 0",
        fontSize: "0.875rem",
        lineHeight: 1.55,
        color: "#fcd34d",
      },
    };
  }
  return {
    wrap: {
      marginBottom: "1rem",
      padding: "1rem 1.1rem",
      borderRadius: "12px",
      border: "1px solid rgba(56, 189, 248, 0.4)",
      background: "rgba(12, 74, 110, 0.45)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
    },
    title: {
      margin: 0,
      fontSize: "0.95rem",
      fontWeight: 700,
      color: "#bae6fd",
      letterSpacing: "-0.01em",
    },
    body: {
      margin: "0.45rem 0 0",
      fontSize: "0.875rem",
      lineHeight: 1.55,
      color: "#7dd3fc",
    },
  };
}

/**
 * @param {unknown} profile
 * @returns {{
 *   accountStatus: string,
 *   riskLevel: string,
 *   accountFlags: string[],
 *   showWarningBanner: boolean,
 *   bannerTone: "info"|"warning"|"danger",
 *   bannerTitle: string,
 *   bannerMessage: string,
 *   recommendManualReview: boolean,
 *   requireExtraConfirmation: boolean,
 * }}
 */
export function getSoftEnforcementState(profile) {
  const safe = profile && typeof profile === "object" ? profile : null;
  const accountStatus = safe && "account_status" in safe ? normalizeAccountStatus(safe.account_status) : "active";
  const riskLevel = String(safe?.risk_level || "low").toLowerCase();
  const accountFlags = safe && "account_flags" in safe ? normalizeFlags(safe.account_flags) : [];

  let bannerTone = "info";
  let bannerTitle = "";
  let bannerMessage = "";
  let showWarningBanner = false;
  const recommendManualReview =
    accountStatus === "under_review" ||
    accountStatus === "restricted" ||
    hasFlag(accountFlags, "manual_review_required");

  const requireExtraConfirmation = accountStatus === "restricted";

  if (accountStatus === "restricted") {
    showWarningBanner = true;
    bannerTone = "danger";
    bannerTitle = "Your account has limited access";
    bannerMessage =
      "Your account has been flagged for additional review. Some features may be limited soon. You can still use Tropicash; some actions may be monitored while we verify activity.";
  } else if (accountStatus === "under_review") {
    showWarningBanner = true;
    bannerTone = "warning";
    bannerTitle = "Your account is under review";
    bannerMessage =
      "Your account is currently under review. Some actions may be monitored while we verify activity. Thank you for your patience.";
  } else if (riskLevel === "high" || hasFlag(accountFlags, "fraud_watchlist") || hasFlag(accountFlags, "high_risk_account")) {
    showWarningBanner = true;
    bannerTone = "warning";
    bannerTitle = "Additional checks may apply";
    bannerMessage =
      "We're reviewing some recent activity on your account. Some features may be subject to additional checks. You can continue using your wallet as usual.";
  } else if (
    hasFlag(accountFlags, "manual_review_required") ||
    hasFlag(accountFlags, "repeat_offender") ||
    hasFlag(accountFlags, "escalated_case_history")
  ) {
    showWarningBanner = true;
    bannerTone = "info";
    bannerTitle = "Account notice";
    bannerMessage =
      "We're reviewing some recent activity on your account. If you have questions, contact support. You can continue using Tropicash.";
  }

  return {
    accountStatus,
    riskLevel,
    accountFlags,
    showWarningBanner,
    bannerTone,
    bannerTitle,
    bannerMessage,
    recommendManualReview,
    requireExtraConfirmation,
  };
}

/**
 * @param {unknown} profile
 * @returns {null | {
 *   tone: "info"|"warning"|"danger",
 *   title: string,
 *   message: string,
 *   recommendManualReview: boolean,
 *   requireExtraConfirmation: boolean,
 * }}
 */
export function getSoftEnforcementBanner(profile) {
  try {
    const s = getSoftEnforcementState(profile);
    if (!s.showWarningBanner) return null;
    return {
      tone: s.bannerTone,
      title: s.bannerTitle,
      message: s.bannerMessage,
      recommendManualReview: s.recommendManualReview,
      requireExtraConfirmation: s.requireExtraConfirmation,
    };
  } catch (e) {
    console.error("getSoftEnforcementBanner:", e);
    return null;
  }
}

/**
 * @param {unknown} profile
 */
export function canShowRestrictionWarning(profile) {
  try {
    return getSoftEnforcementState(profile).showWarningBanner;
  } catch (e) {
    console.error("canShowRestrictionWarning:", e);
    return false;
  }
}

/** User-facing account status line (no accusatory language). */
export function getAccountStatusUserLabel(profile) {
  const s = normalizeAccountStatus(profile?.account_status);
  if (s === "restricted") return "Additional review";
  if (s === "under_review") return "Under review";
  return "Active";
}

/** User-facing risk tier (avoid "high risk" wording). */
export function getRiskTierUserLabel(profile) {
  const r = String(profile?.risk_level || "low").toLowerCase();
  if (r === "high") return "Higher attention";
  if (r === "medium") return "Elevated";
  return "Standard";
}

/**
 * Short, professional labels for account_flags (optional display).
 * @param {unknown} profile
 * @returns {string[]}
 */
export function getAccountFlagsUserLabels(profile) {
  const flags = normalizeFlags(profile?.account_flags);
  const out = [];
  for (const f of flags) {
    const k = String(f).toLowerCase();
    if (k === "manual_review_required") out.push("Manual review");
    else if (k === "fraud_watchlist") out.push("Activity monitoring");
    else if (k === "repeat_offender") out.push("Repeat activity review");
    else if (k === "escalated_case_history") out.push("Prior escalations");
    else if (k === "high_risk_account") out.push("Additional safeguards");
  }
  return out;
}

/** Compact banner for dark gradient shells (wallet, send, fund, withdraw). */
export function SoftEnforcementNotice({ profile }) {
  try {
    const b = getSoftEnforcementBanner(profile);
    if (!b) return null;
    const st = softEnforcementToneStyles(b.tone);
    return (
      <div role="status" aria-live="polite" style={st.wrap}>
        <p style={st.title}>{b.title}</p>
        <p style={st.body}>{b.message}</p>
      </div>
    );
  } catch (e) {
    console.error("SoftEnforcementNotice:", e);
    return null;
  }
}
