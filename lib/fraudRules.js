/**
 * Phase 1 fraud rule definitions (pure; no I/O).
 * Severity maps to fraud_logs.risk_level; scores set in fraudPhase1Log.
 */

/** @typedef {'low'|'medium'|'high'} FraudSeverity */

export const FUNDING_EVENTS = {
  PAYPAL_CAPTURE_FAILED: "FUNDING_PAYPAL_CAPTURE_FAILED",
  PAYPAL_CAPTURE_INCOMPLETE: "FUNDING_PAYPAL_CAPTURE_INCOMPLETE",
  INVALID_CAPTURE_AMOUNT: "FUNDING_INVALID_CAPTURE_AMOUNT",
  DUPLICATE_BLOCKED: "DUPLICATE_FUNDING_BLOCKED",
  CONCURRENT_ATTEMPT: "FUNDING_CONCURRENT_ATTEMPT",
  RETRY_FORBIDDEN: "FUNDING_RETRY_FORBIDDEN",
  LARGE_AMOUNT: "FUNDING_LARGE_AMOUNT",
  VELOCITY_10M: "FUNDING_VELOCITY_10M",
  REPEATED_FAILURES: "FUNDING_REPEATED_FAILURES",
  CREDIT_FAILED: "FUNDING_WALLET_CREDIT_FAILED",
  NOTIFICATION_DUP_CHECK_FAILED: "FUNDING_NOTIFICATION_DUP_CHECK_FAILED",
};

export const WITHDRAWAL_EVENTS = {
  REQUEST_SUBMITTED: "WITHDRAWAL_REQUEST_SUBMITTED",
  LARGE_AMOUNT: "WITHDRAWAL_LARGE_AMOUNT",
  VELOCITY_24H: "WITHDRAWAL_VELOCITY_24H",
  NEW_USER: "NEW_USER_WITHDRAWAL",
  PROFILE_RECENT_UPDATE: "PROFILE_UPDATED_BEFORE_WITHDRAWAL",
  FUND_THEN_WITHDRAW: "FUND_THEN_WITHDRAW_SHORT_WINDOW",
};

/**
 * @param {string} email
 * @returns {string|null}
 */
export function emailDomainOnly(email) {
  const s = String(email || "").trim();
  const at = s.indexOf("@");
  if (at < 0 || at === s.length - 1) return null;
  return s.slice(at + 1).toLowerCase() || null;
}

/**
 * @param {{ amount: number, withdrawalCount24h: number, accountCreatedAt?: string|null, profileUpdatedAt?: string|null, recentFundTxns?: Array<{ id?: string, created_at?: string, amount?: number }>, payoutEmailDomain?: string|null, now?: Date }} ctx
 * @returns {Array<{ eventType: string, severity: FraudSeverity, description: string, amount: number, metadata: Record<string, unknown> }>}
 */
export function buildWithdrawalPhase1Signals(ctx) {
  const now = ctx.now instanceof Date ? ctx.now : new Date();
  const nowMs = now.getTime();
  const amount = Number(ctx.amount);
  const safeAmt = Number.isFinite(amount) && amount >= 0 ? amount : 0;

  /** @type {Array<{ eventType: string, severity: FraudSeverity, description: string, amount: number, metadata: Record<string, unknown> }>} */
  const out = [];

  out.push({
    eventType: WITHDRAWAL_EVENTS.REQUEST_SUBMITTED,
    severity: "low",
    description: "User submitted a PayPal withdrawal request.",
    amount: safeAmt,
    metadata: {
      payoutEmailDomain: ctx.payoutEmailDomain ?? null,
    },
  });

  if (safeAmt > 250) {
    out.push({
      eventType: WITHDRAWAL_EVENTS.LARGE_AMOUNT,
      severity: "medium",
      description: "Withdrawal amount exceeds $250 monitoring threshold.",
      amount: safeAmt,
      metadata: { thresholdUsd: 250 },
    });
  }

  const wCount = Number(ctx.withdrawalCount24h) || 0;
  if (wCount >= 2) {
    out.push({
      eventType: WITHDRAWAL_EVENTS.VELOCITY_24H,
      severity: "medium",
      description: `Multiple withdrawal requests (${wCount}) in the last 24 hours.`,
      amount: safeAmt,
      metadata: { count24h: wCount },
    });
  }

  const createdMs = ctx.accountCreatedAt ? new Date(ctx.accountCreatedAt).getTime() : NaN;
  if (Number.isFinite(createdMs) && nowMs - createdMs < 7 * 24 * 60 * 60 * 1000) {
    out.push({
      eventType: WITHDRAWAL_EVENTS.NEW_USER,
      severity: "medium",
      description: "Withdrawal requested within 7 days of account creation.",
      amount: safeAmt,
      metadata: { accountCreatedAt: ctx.accountCreatedAt },
    });
  }

  const profMs = ctx.profileUpdatedAt ? new Date(ctx.profileUpdatedAt).getTime() : NaN;
  if (Number.isFinite(profMs) && nowMs - profMs < 24 * 60 * 60 * 1000) {
    out.push({
      eventType: WITHDRAWAL_EVENTS.PROFILE_RECENT_UPDATE,
      severity: "low",
      description:
        "Profile was updated within 24 hours of this withdrawal (check payout email change if applicable).",
      amount: safeAmt,
      metadata: { profileUpdatedAt: ctx.profileUpdatedAt },
    });
  }

  const funds = Array.isArray(ctx.recentFundTxns) ? ctx.recentFundTxns : [];
  if (funds.length > 0) {
    out.push({
      eventType: WITHDRAWAL_EVENTS.FUND_THEN_WITHDRAW,
      severity: "high",
      description: "Wallet was funded within 30 minutes before this withdrawal.",
      amount: safeAmt,
      metadata: {
        recentFundCount: funds.length,
        recentFundSample: funds.slice(0, 3).map((t) => ({
          id: t.id ?? null,
          created_at: t.created_at ?? null,
          amount: t.amount ?? null,
        })),
      },
    });
  }

  return out;
}
