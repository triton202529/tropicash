import { supabase } from "./supabaseClient";
import { evaluateFraudTransaction } from "./fraudEngine";
import { logFraudLogCreated } from "./fraudEvents";
import { evaluateAndCreateAlerts } from "./smartAlerts";

function isoMinutesAgo(minutes, anchorDate) {
  const d = anchorDate instanceof Date ? anchorDate : new Date(anchorDate);
  return new Date(d.getTime() - minutes * 60 * 1000).toISOString();
}

function isoDaysAgo(days, anchorDate) {
  const d = anchorDate instanceof Date ? anchorDate : new Date(anchorDate);
  return new Date(d.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function userInvolvesOrFilter(userId) {
  return `sender_id.eq.${userId},recipient_id.eq.${userId}`;
}

/**
 * Insert one fraud_logs row. Throws on hard insert errors.
 */
export async function saveFraudLog(payload) {
  const row = {
    user_id: payload.userId,
    transaction_type: payload.transactionType,
    amount: payload.amount,
    risk_score: payload.riskScore,
    risk_level: payload.riskLevel,
    flags: payload.flags ?? [],
    related_transaction_id: payload.relatedTransactionId ?? null,
  };

  const { data, error } = await supabase
    .from("fraud_logs")
    .insert([row])
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data;
}

async function countUserTransactionsSince(userId, sinceIso) {
  if (!userId || !sinceIso) return 0;
  const { count, error } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .or(userInvolvesOrFilter(userId))
    .gte("created_at", sinceIso);

  if (error) {
    console.error("[fraudService] countUserTransactionsSince:", error);
    return 0;
  }
  return count ?? 0;
}

async function countSameAmountSince(userId, amount, sinceIso) {
  if (!userId || !sinceIso || !Number.isFinite(Number(amount))) return 0;
  const { count, error } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .or(userInvolvesOrFilter(userId))
    .eq("amount", amount)
    .gte("created_at", sinceIso);

  if (error) {
    console.error("[fraudService] countSameAmountSince:", error);
    return 0;
  }
  return count ?? 0;
}

async function fetchRecentFundAmounts(userId, sinceIso, excludeTransactionId) {
  if (!userId || !sinceIso) return [];
  let q = supabase
    .from("transactions")
    .select("amount")
    .eq("type", "fund")
    .or(userInvolvesOrFilter(userId))
    .gte("created_at", sinceIso);

  if (excludeTransactionId) {
    q = q.neq("id", excludeTransactionId);
  }

  const { data, error } = await q;

  if (error) {
    console.error("[fraudService] fetchRecentFundAmounts:", error);
    return [];
  }
  return (data || [])
    .map((r) => Number(r.amount))
    .filter((n) => Number.isFinite(n) && n > 0);
}

async function fetchLatestFundBefore(userId, beforeIso, excludeTransactionId) {
  if (!userId) return null;
  let q = supabase
    .from("transactions")
    .select("id, amount, created_at")
    .eq("type", "fund")
    .or(userInvolvesOrFilter(userId));

  if (beforeIso) {
    q = q.lte("created_at", beforeIso);
  }
  if (excludeTransactionId) {
    q = q.neq("id", excludeTransactionId);
  }

  const { data, error } = await q
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[fraudService] fetchLatestFundBefore:", error);
    return null;
  }
  return data || null;
}

/**
 * Loads lightweight recent history, scores the txn, persists fraud_logs.
 * @param {object} params
 * @param {string} params.userId - acting user (wallet owner / initiator)
 * @param {string} params.transactionType - send | fund | withdraw
 * @param {number} params.amount
 * @param {string|null|undefined} params.senderId
 * @param {string|null|undefined} params.recipientId
 * @param {string|number|Date} [params.timestamp] - anchor for windows (defaults now)
 * @param {string|null|undefined} params.relatedTransactionId
 * @returns {Promise<{ evaluation: ReturnType<typeof evaluateFraudTransaction>, fraudLog: object | null }>}
 */
export async function evaluateAndLogFraud(params) {
  const {
    userId,
    transactionType,
    amount,
    senderId,
    recipientId,
    timestamp,
    relatedTransactionId,
  } = params;

  if (!userId) {
    throw new Error("evaluateAndLogFraud: userId is required");
  }

  const anchor = timestamp ? new Date(timestamp) : new Date();
  const since15 = isoMinutesAgo(15, anchor);
  const since10 = isoMinutesAgo(10, anchor);
  const since30d = isoDaysAgo(30, anchor);

  const amt = Number(amount);
  const typeKey = String(transactionType || "").toLowerCase();

  const [recentTransactionCount15m, sameAmountIn10mCount, recentFundAmounts30d, latestFund] =
    await Promise.all([
      countUserTransactionsSince(userId, since15),
      countSameAmountSince(userId, amt, since10),
      fetchRecentFundAmounts(userId, since30d, typeKey === "fund" ? relatedTransactionId : undefined),
      typeKey === "send" || typeKey === "withdraw"
        ? fetchLatestFundBefore(userId, anchor.toISOString(), relatedTransactionId)
        : Promise.resolve(null),
    ]);

  let minutesSinceLastFund = null;
  let lastFundAmount = null;
  if (latestFund?.created_at) {
    const lf = new Date(latestFund.created_at);
    if (!Number.isNaN(lf.getTime())) {
      minutesSinceLastFund = Math.max(0, (anchor.getTime() - lf.getTime()) / (60 * 1000));
    }
  }
  if (latestFund?.amount != null) {
    const n = Number(latestFund.amount);
    if (Number.isFinite(n)) lastFundAmount = n;
  }

  const evaluation = evaluateFraudTransaction(
    {
      userId,
      transactionType: typeKey,
      amount: amt,
      senderId: senderId ?? null,
      recipientId: recipientId ?? null,
      timestamp,
    },
    {
      recentTransactionCount15m,
      sameAmountIn10mCount,
      recentFundAmounts30d,
      minutesSinceLastFund,
      lastFundAmount,
    }
  );

  let fraudLog = null;
  try {
    fraudLog = await saveFraudLog({
      userId,
      transactionType: typeKey,
      amount: amt,
      riskScore: evaluation.riskScore,
      riskLevel: evaluation.riskLevel,
      flags: evaluation.flags,
      relatedTransactionId,
    });
  } catch (err) {
    console.error("[fraudService] saveFraudLog failed (best-effort, funding continues):", err);
    return { evaluation, fraudLog: null };
  }

  const flagsArr = Array.isArray(evaluation.flags) ? evaluation.flags : [];
  try {
    logFraudLogCreated(supabase, {
      fraudLogId: fraudLog.id,
      userId,
      actorUserId: userId,
      transactionType: typeKey,
      riskScore: evaluation.riskScore,
      riskLevel: evaluation.riskLevel,
      flagsCount: flagsArr.length,
    });
  } catch (err) {
    console.error("[fraudService] logFraudLogCreated failed:", err);
  }

  try {
    let riskProfile = null;
    let accountStatus = "";
    try {
      const { data: prof, error: pe } = await supabase
        .from("profiles")
        .select("risk_level, account_status")
        .eq("id", userId)
        .maybeSingle();
      if (pe) {
        console.error("[fraudService] profile for alerts:", pe);
      } else if (prof && typeof prof === "object") {
        riskProfile = prof;
        accountStatus = prof.account_status != null ? String(prof.account_status) : "";
      }
    } catch (e) {
      console.error("[fraudService] profile for alerts:", e);
    }

    if (fraudLog) {
      await evaluateAndCreateAlerts(supabase, {
        userId,
        fraudLog,
        riskProfile,
        accountStatus,
      });
    }
  } catch (e) {
    console.error("[fraudService] evaluateAndCreateAlerts:", e);
  }

  return { evaluation, fraudLog };
}
