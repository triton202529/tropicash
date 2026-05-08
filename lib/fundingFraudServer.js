import { FUNDING_EVENTS } from "./fraudRules";
import { insertPhase1FraudLog, insertPhase1FraudLogs } from "./fraudPhase1Log";

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {string} userId
 */
export async function countFundingIdempotencySince(admin, userId, sinceIso) {
  if (!admin || !userId || !sinceIso) return 0;
  const { count, error } = await admin
    .from("funding_idempotency_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceIso);
  if (error) {
    console.error("[fundingFraudServer] countFundingIdempotencySince:", error);
    return 0;
  }
  return count ?? 0;
}

/**
 * Count phase-1 funding failure events logged in fraud_logs (last window).
 */
export async function countRecentFundingFailureEvents(admin, userId, sinceIso) {
  if (!admin || !userId || !sinceIso) return 0;
  const { count, error } = await admin
    .from("fraud_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("transaction_type", "fund")
    .in("event_type", [
      FUNDING_EVENTS.PAYPAL_CAPTURE_FAILED,
      FUNDING_EVENTS.PAYPAL_CAPTURE_INCOMPLETE,
      FUNDING_EVENTS.INVALID_CAPTURE_AMOUNT,
      FUNDING_EVENTS.CREDIT_FAILED,
    ])
    .gte("created_at", sinceIso);
  if (error) {
    console.error("[fundingFraudServer] countRecentFundingFailureEvents:", error);
    return 0;
  }
  return count ?? 0;
}

async function maybeLogRepeatedFundingFailures(admin, userId, orderID, amountHint) {
  const sinceDay = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const n = await countRecentFundingFailureEvents(admin, userId, sinceDay);
  if (n < 2) return;
  await insertPhase1FraudLog(admin, {
    userId,
    transactionType: "fund",
    eventType: FUNDING_EVENTS.REPEATED_FAILURES,
    severity: "high",
    description: `Multiple failed funding outcomes (${n}) in the last 24 hours.`,
    amount: Number(amountHint) >= 0 ? Number(amountHint) : 0,
    metadata: { orderID: orderID ?? null, failureEventCount24h: n },
  });
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 * @param {object} base
 */
export async function logFundingLargeAndVelocity(admin, base) {
  const { userId, amountNum, orderID } = base;
  const events = [];
  if (Number(amountNum) > 250) {
    events.push({
      userId,
      transactionType: "fund",
      eventType: FUNDING_EVENTS.LARGE_AMOUNT,
      severity: "medium",
      description: `Funding amount $${amountNum} exceeds $250 monitoring threshold.`,
      amount: Number(amountNum),
      metadata: { orderID, thresholdUsd: 250 },
    });
  }

  const since10 = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const n = await countFundingIdempotencySince(admin, userId, since10);
  if (n >= 2) {
    events.push({
      userId,
      transactionType: "fund",
      eventType: FUNDING_EVENTS.VELOCITY_10M,
      severity: "medium",
      description: `Multiple funding attempts (${n}) in the last 10 minutes.`,
      amount: Number(amountNum) || 0,
      metadata: { orderID, count10m: n, windowMinutes: 10 },
    });
  }

  await insertPhase1FraudLogs(admin, events);
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 */
export async function logDuplicateFundingBlocked(admin, args) {
  const { userId, orderID, amountNum, source } = args;
  await insertPhase1FraudLog(admin, {
    userId,
    transactionType: "fund",
    eventType: FUNDING_EVENTS.DUPLICATE_BLOCKED,
    severity: "medium",
    description: "Duplicate or replayed funding attempt blocked (idempotency / prior completion).",
    amount: Number(amountNum) || 0,
    metadata: { orderID, source },
  });
  await logFundingLargeAndVelocity(admin, { userId, amountNum, orderID });
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 */
export async function logConcurrentFunding(admin, args) {
  const { userId, orderID, amountNum } = args;
  await insertPhase1FraudLog(admin, {
    userId,
    transactionType: "fund",
    eventType: FUNDING_EVENTS.CONCURRENT_ATTEMPT,
    severity: "medium",
    description: "Funding order is already being processed (concurrent attempt).",
    amount: Number(amountNum) || 0,
    metadata: { orderID },
  });
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 */
export async function logFundingRetryForbidden(admin, args) {
  const { userId, orderID } = args;
  await insertPhase1FraudLog(admin, {
    userId,
    transactionType: "fund",
    eventType: FUNDING_EVENTS.RETRY_FORBIDDEN,
    severity: "low",
    description: "Funding retry not allowed for this order / account pairing.",
    amount: 0,
    metadata: { orderID },
  });
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 */
export async function logPaypalCaptureFailed(admin, args) {
  const { userId, orderID, message } = args;
  await insertPhase1FraudLog(admin, {
    userId,
    transactionType: "fund",
    eventType: FUNDING_EVENTS.PAYPAL_CAPTURE_FAILED,
    severity: "medium",
    description: "PayPal order capture request failed before wallet credit.",
    amount: 0,
    metadata: { orderID, errorMessage: String(message || "").slice(0, 500) },
  });
  await maybeLogRepeatedFundingFailures(admin, userId, orderID, 0);
}

export async function logPaypalCaptureIncomplete(admin, args) {
  const { userId, orderID, paypalStatus } = args;
  await insertPhase1FraudLog(admin, {
    userId,
    transactionType: "fund",
    eventType: FUNDING_EVENTS.PAYPAL_CAPTURE_INCOMPLETE,
    severity: "medium",
    description: "PayPal capture returned non-COMPLETED status.",
    amount: 0,
    metadata: { orderID, paypalStatus: String(paypalStatus || "") },
  });
  await maybeLogRepeatedFundingFailures(admin, userId, orderID, 0);
}

export async function logFundingInvalidCaptureAmount(admin, args) {
  const { userId, orderID } = args;
  await insertPhase1FraudLog(admin, {
    userId,
    transactionType: "fund",
    eventType: FUNDING_EVENTS.INVALID_CAPTURE_AMOUNT,
    severity: "medium",
    description: "Captured PayPal amount missing or invalid.",
    amount: 0,
    metadata: { orderID },
  });
  await maybeLogRepeatedFundingFailures(admin, userId, orderID, 0);
}

export async function logFundingNotificationDupCheckFailed(admin, args) {
  const { userId, orderID, amountNum } = args;
  await insertPhase1FraudLog(admin, {
    userId,
    transactionType: "fund",
    eventType: FUNDING_EVENTS.NOTIFICATION_DUP_CHECK_FAILED,
    severity: "low",
    description: "Could not verify duplicate notification state (server error).",
    amount: Number(amountNum) || 0,
    metadata: { orderID },
  });
}

export async function logFundingCreditFailed(admin, args) {
  const { userId, orderID, amountNum, fundWalletError } = args;
  await insertPhase1FraudLog(admin, {
    userId,
    transactionType: "fund",
    eventType: FUNDING_EVENTS.CREDIT_FAILED,
    severity: "high",
    description: "PayPal capture succeeded but wallet credit RPC failed.",
    amount: Number(amountNum) || 0,
    metadata: { orderID, fundWalletError },
  });
  await maybeLogRepeatedFundingFailures(admin, userId, orderID, amountNum);
}

/**
 * After successful funding (new credit), log large + velocity only (not duplicate).
 */
export async function logFundingSuccessFraudSignals(admin, args) {
  const { userId, amountNum, orderID } = args;
  await logFundingLargeAndVelocity(admin, { userId, amountNum, orderID });
}
