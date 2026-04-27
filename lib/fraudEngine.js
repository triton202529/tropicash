/**
 * Phase 1 rule-based fraud scoring (detection only).
 * Pure functions — no I/O. Extend with ML / real-time controls later.
 */

/** Type-specific “large” amount thresholds (same currency as wallet UI). */
const LARGE_AMOUNT_BY_TYPE = {
  send: 2500,
  fund: 8000,
  withdraw: 2500,
};

const DEFAULT_LARGE_AMOUNT = 2500;

/** Count of user-involved txs in 15m above this adds risk. */
const BUSY_WINDOW_COUNT_SOFT = 5;
const BUSY_WINDOW_COUNT_HARD = 8;

/** Same-amount repeats in 10m: at least this many (including current) triggers. */
const SAME_AMOUNT_REPEAT_MIN = 2;
const RAPID_FUND_THEN_SEND_WINDOW_MINUTES = 20;

function clampScore(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function mapScoreToLevel(score) {
  if (score < 32) return "low";
  if (score < 62) return "medium";
  return "high";
}

function isNearlyInteger(n) {
  return Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-6;
}

/**
 * Whole-dollar “psychological” round amounts (e.g. 100, 500, 1000).
 */
function isSuspiciousRoundAmount(amount) {
  const a = Number(amount);
  if (!Number.isFinite(a) || a < 100) return false;
  if (!isNearlyInteger(a)) return false;
  const whole = Math.round(a);
  return whole % 100 === 0;
}

/**
 * @param {object} input
 * @param {string} [input.userId]
 * @param {string} input.transactionType - "send" | "fund" | "withdraw"
 * @param {number} input.amount
 * @param {string} [input.senderId]
 * @param {string|null} [input.recipientId]
 * @param {string|number|Date} [input.timestamp]
 * @param {object} [context]
 * @param {number} [context.recentTransactionCount15m] - txs involving user in last 15m
 * @param {number} [context.sameAmountIn10mCount] - same amount, same user window, last 10m
 * @param {number[]} [context.recentFundAmounts30d] - historical fund amounts (excl. current)
 * @param {number|null|undefined} [context.minutesSinceLastFund] - minutes since latest fund before this txn
 * @param {number|null|undefined} [context.lastFundAmount] - amount of latest fund before this txn
 * @returns {{ riskScore: number, riskLevel: 'low'|'medium'|'high', flags: string[] }}
 */
export function evaluateFraudTransaction(input, context = {}) {
  const flags = [];
  let score = 0;

  const amount = Number(input?.amount);
  const type = String(input?.transactionType || "").toLowerCase();
  const senderId = input?.senderId ?? null;
  const recipientId = input?.recipientId ?? null;

  const recentCount = Number(context.recentTransactionCount15m) || 0;
  const sameAmtCount = Number(context.sameAmountIn10mCount) || 0;
  const fundHistory = Array.isArray(context.recentFundAmounts30d)
    ? context.recentFundAmounts30d.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0)
    : [];
  const minutesSinceLastFund = Number(context.minutesSinceLastFund);
  const lastFundAmount = Number(context.lastFundAmount);

  // --- self_transfer_attempt (send only; major risk) ---
  if (type === "send" && senderId && recipientId && senderId === recipientId) {
    flags.push("self_transfer_attempt");
    score += 55;
  }

  // --- large_amount ---
  const largeThreshold =
    LARGE_AMOUNT_BY_TYPE[type] ?? DEFAULT_LARGE_AMOUNT;
  if (Number.isFinite(amount) && amount >= largeThreshold) {
    flags.push("large_amount");
    score += type === "fund" ? 18 : 16;
  }

  // --- rapid_repeat_transactions ---
  if (sameAmtCount >= SAME_AMOUNT_REPEAT_MIN) {
    flags.push("rapid_repeat_transactions");
    score += sameAmtCount >= 4 ? 28 : 20;
  }

  // --- too_many_transactions_short_window ---
  if (recentCount >= BUSY_WINDOW_COUNT_HARD) {
    flags.push("too_many_transactions_short_window");
    score += 22;
  } else if (recentCount >= BUSY_WINDOW_COUNT_SOFT) {
    flags.push("too_many_transactions_short_window");
    score += 12;
  }

  // --- unusual_funding_amount (fund only) ---
  if (type === "fund" && Number.isFinite(amount) && amount > 0) {
    if (fundHistory.length >= 3) {
      const sorted = [...fundHistory].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const median =
        sorted.length % 2 === 1
          ? sorted[mid]
          : (sorted[mid - 1] + sorted[mid]) / 2;
      const mean =
        fundHistory.reduce((s, v) => s + v, 0) / fundHistory.length;
      const baseline = Math.max(median, mean * 0.85);
      if (baseline > 0 && amount >= baseline * 3.5) {
        flags.push("unusual_funding_amount");
        score += 26;
      } else if (baseline > 0 && amount >= baseline * 2.5) {
        flags.push("unusual_funding_amount");
        score += 16;
      }
    } else if (fundHistory.length === 1) {
      const prev = fundHistory[0];
      if (prev > 0 && amount >= prev * 4) {
        flags.push("unusual_funding_amount");
        score += 18;
      }
    } else if (fundHistory.length === 0 && amount >= 3000) {
      flags.push("unusual_funding_amount");
      score += 8;
    }
  }

  // --- round_number_spike ---
  if (isSuspiciousRoundAmount(amount)) {
    flags.push("round_number_spike");
    score += 12;
  }

  // --- rapid_fund_then_send ---
  if (
    (type === "send" || type === "withdraw") &&
    Number.isFinite(minutesSinceLastFund) &&
    minutesSinceLastFund >= 0 &&
    minutesSinceLastFund <= RAPID_FUND_THEN_SEND_WINDOW_MINUTES
  ) {
    flags.push("rapid_fund_then_send");
    if (
      Number.isFinite(lastFundAmount) &&
      Number.isFinite(amount) &&
      lastFundAmount > 0 &&
      amount >= lastFundAmount * 0.8
    ) {
      score += 24;
    } else if (minutesSinceLastFund <= 5) {
      score += 20;
    } else {
      score += 14;
    }
  }

  // --- compounding bump when multiple rules fire ---
  const uniqueFlags = [...new Set(flags)];
  let compound = 0;
  if (uniqueFlags.length >= 2) {
    compound = Math.min(14, (uniqueFlags.length - 1) * 4);
  }
  score += compound;

  const riskScore = clampScore(score);
  return {
    riskScore,
    riskLevel: mapScoreToLevel(riskScore),
    flags: uniqueFlags,
  };
}
