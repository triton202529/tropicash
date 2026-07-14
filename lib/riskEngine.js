import { supabase } from "./supabaseClient";
import { FUNDING_EVENTS } from "./fraudRules";

const LOG_NS = "[riskEngine]";
const RISK_VERSION = "phase2b";

/** @typedef {'low'|'medium'|'high'|'critical'} RiskLevel */
/** @typedef {'allow'|'monitor'|'review'|'restrict'|'freeze_candidate'} RecommendedAction */

/** High 24h send total threshold (USD). */
const HIGH_SEND_TOTAL_24H_USD = 500;

/** Rapid fund→withdraw window (ms) — matches fraudRules withdrawal phase 1. */
const FUND_THEN_WITHDRAW_MS = 30 * 60 * 1000;

const ROUND_AMOUNTS = new Set([100, 200, 250, 500, 1000, 2000, 5000]);

const FUNDING_FAILURE_EVENTS = [
  FUNDING_EVENTS.PAYPAL_CAPTURE_FAILED,
  FUNDING_EVENTS.PAYPAL_CAPTURE_INCOMPLETE,
  FUNDING_EVENTS.INVALID_CAPTURE_AMOUNT,
  FUNDING_EVENTS.CREDIT_FAILED,
  FUNDING_EVENTS.REPEATED_FAILURES,
];

const MAX_TRUST_RISK_REDUCTION = 30;

function isoDaysAgo(days, anchor = new Date()) {
  const d = anchor instanceof Date ? anchor : new Date(anchor);
  return new Date(d.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

function isoHoursAgo(hours, anchor = new Date()) {
  const d = anchor instanceof Date ? anchor : new Date(anchor);
  return new Date(d.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function warn(payload) {
  try {
    console.warn(LOG_NS, payload);
  } catch {
    /* ignore */
  }
}

function isMissingTable(error, tableName) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204") return true;
  return msg.includes(tableName) && (msg.includes("does not exist") || msg.includes("not found"));
}

function isMissingColumn(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return code === "42703" || msg.includes("column") && msg.includes("does not exist");
}

/**
 * Age-based decay weight for historical events.
 * @param {number} ageDays
 */
export function decayWeightForAgeDays(ageDays) {
  const d = Number(ageDays);
  if (!Number.isFinite(d) || d < 0) return 1;
  if (d <= 7) return 1;
  if (d <= 30) return 0.6;
  if (d <= 90) return 0.3;
  return 0.1;
}

function eventAgeDays(createdAt, anchor) {
  const t = new Date(createdAt).getTime();
  const now = anchor instanceof Date ? anchor.getTime() : new Date(anchor).getTime();
  if (!Number.isFinite(t) || !Number.isFinite(now)) return 0;
  return Math.max(0, (now - t) / (24 * 60 * 60 * 1000));
}

function avgDecayWeight(events, anchor) {
  if (!events?.length) return null;
  let sum = 0;
  for (const ev of events) {
    sum += decayWeightForAgeDays(eventAgeDays(ev.created_at, anchor));
  }
  return Math.round((sum / events.length) * 100) / 100;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * @param {{ score: number, trustScore: number, reasons: Array<object> }} acc
 * @param {{ code: string, label: string, unit: number, max: number, count: number, details?: object }} rule
 */
function addRule(acc, rule) {
  if (!rule.count || rule.count <= 0) return;
  const rawPoints = rule.count * rule.unit;
  const capped = Math.min(rawPoints, rule.max);
  if (capped <= 0) return;
  const before = acc.score;
  acc.score = Math.min(100, acc.score + capped);
  acc.reasons.push({
    code: rule.code,
    label: rule.label,
    points: capped,
    details: {
      count: rule.count,
      unitPoints: rule.unit,
      cap: rule.max,
      ...(rule.details || {}),
    },
  });
  if (acc.score === before && capped > 0) {
    warn({ op: "addRule_capped_at_100", code: rule.code });
  }
}

/**
 * Apply decay-weighted points from timestamped events.
 * @param {{ score: number, reasons: Array<object> }} acc
 * @param {{ code: string, label: string, unit: number, max: number, events: Array<{ created_at: string }>, anchor: Date, details?: object }} rule
 */
function addDecayedRule(acc, rule) {
  const events = Array.isArray(rule.events) ? rule.events : [];
  if (events.length === 0) return;
  let raw = 0;
  for (const ev of events) {
    const w = decayWeightForAgeDays(eventAgeDays(ev.created_at, rule.anchor));
    raw += rule.unit * w;
  }
  const capped = Math.min(Math.round(raw * 10) / 10, rule.max);
  if (capped <= 0) return;
  acc.score = Math.min(100, acc.score + capped);
  acc.reasons.push({
    code: rule.code,
    label: rule.label,
    points: capped,
    details: {
      eventCount: events.length,
      unitPoints: rule.unit,
      cap: rule.max,
      decayed: true,
      ...(rule.details || {}),
    },
  });
}

/**
 * @param {{ score: number, trustScore: number, trustRiskReduction: number, reasons: Array<object> }} acc
 * @param {{ code: string, label: string, riskReduction: number, trustPoints: number, details?: object }} rule
 */
function addTrustSignal(acc, rule) {
  const riskRed = Math.max(0, Number(rule.riskReduction) || 0);
  const trustPts = Number(rule.trustPoints) || 0;
  if (riskRed <= 0 && trustPts <= 0) return;

  const appliedRiskRed = Math.min(riskRed, MAX_TRUST_RISK_REDUCTION - acc.trustRiskReduction);
  if (appliedRiskRed > 0) {
    acc.trustRiskReduction += appliedRiskRed;
    acc.score = Math.max(0, acc.score - appliedRiskRed);
    acc.reasons.push({
      code: rule.code,
      label: rule.label,
      points: -appliedRiskRed,
      trustPoints: trustPts,
      details: rule.details || {},
    });
  } else if (trustPts > 0) {
    acc.reasons.push({
      code: rule.code,
      label: rule.label,
      points: 0,
      trustPoints: trustPts,
      details: rule.details || {},
    });
  }

  if (trustPts !== 0) {
    acc.trustScore = clamp(acc.trustScore + trustPts, -100, 100);
  }
}

/**
 * @param {number} score
 * @returns {RiskLevel}
 */
export function scoreToRiskLevel(score) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  if (s >= 75) return "critical";
  if (s >= 50) return "high";
  if (s >= 25) return "medium";
  return "low";
}

/**
 * @param {RiskLevel} level
 * @returns {RecommendedAction}
 */
export function riskLevelToRecommendedAction(level) {
  const key = String(level || "").toLowerCase();
  if (key === "critical") return "freeze_candidate";
  if (key === "high") return "review";
  if (key === "medium") return "monitor";
  return "allow";
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 * @param {object} filters
 */
async function fetchSecurityEvents(client, userId, filters) {
  const sinceIso = filters.sinceIso;
  if (!sinceIso) return { rows: [], error: null };
  let q = client
    .from("security_events")
    .select("id, created_at, type, severity, description")
    .eq("user_id", userId)
    .gte("created_at", sinceIso);
  if (filters.type) q = q.eq("type", filters.type);
  if (filters.severityIn?.length) q = q.in("severity", filters.severityIn);
  if (filters.descriptionIlike) q = q.ilike("description", filters.descriptionIlike);
  if (filters.descriptionNotIlike) q = q.not("description", "ilike", filters.descriptionNotIlike);
  const { data, error } = await q.limit(500);
  if (error) {
    warn({ op: "fetchSecurityEvents", err: error.message, filters });
    return { rows: [], error };
  }
  return { rows: data || [], error: null };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 */
async function countRevokedSessions(client, userId) {
  let res = await client
    .from("user_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .or("revoked.eq.true,revoked_at.not.is.null");
  if (res.error) {
    res = await client
      .from("user_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("revoked_at", "is", null);
  }
  if (res.error) {
    warn({ op: "countRevokedSessions", err: res.error.message });
    return 0;
  }
  return res.count ?? 0;
}

function isRoundAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return false;
  if (ROUND_AMOUNTS.has(n)) return true;
  if (n >= 100 && n % 100 === 0) return true;
  return false;
}

function detectRapidFundWithdraw(funds, withdraws) {
  for (const w of withdraws) {
    const wMs = new Date(w.created_at).getTime();
    if (!Number.isFinite(wMs)) continue;
    for (const f of funds) {
      const fMs = new Date(f.created_at).getTime();
      if (!Number.isFinite(fMs)) continue;
      const delta = wMs - fMs;
      if (delta >= 0 && delta <= FUND_THEN_WITHDRAW_MS) {
        return { detected: true, fundAt: f.created_at, withdrawAt: w.created_at, deltaMs: delta };
      }
    }
  }
  return { detected: false };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 * @param {string} since24h
 * @param {string} since1h
 */
async function fetchTransactionSignals(client, userId, since24h, since1h) {
  const snapshot = {
    sendCount1h: 0,
    sendCount24h: 0,
    withdrawCount24h: 0,
    fundingAttempts24h: 0,
    sendTotal24h: 0,
    failedOrBlocked24h: 0,
    burstCount1h: 0,
    roundNumberCount30d: 0,
    rapidCashOut: false,
    totalTxnCount90d: 0,
    queryErrors: [],
  };

  const [send24Res, send1hRes, withdrawRes, fundRes, failedRes, recentRes, burstRes] = await Promise.all([
    client
      .from("transactions")
      .select("amount, status, created_at")
      .eq("sender_id", userId)
      .eq("type", "send_money")
      .gte("created_at", since24h),
    client
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", userId)
      .eq("type", "send_money")
      .gte("created_at", since1h),
    client
      .from("transactions")
      .select("id, status, created_at")
      .eq("sender_id", userId)
      .eq("type", "withdraw_wallet")
      .gte("created_at", since24h),
    client
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", userId)
      .in("type", ["fund", "fund_wallet", "wallet_funded"])
      .gte("created_at", since24h),
    client
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", userId)
      .gte("created_at", since24h)
      .in("status", ["failed", "blocked", "rejected"]),
    client
      .from("transactions")
      .select("id, type, amount, created_at")
      .eq("sender_id", userId)
      .in("type", ["fund", "fund_wallet", "wallet_funded", "withdraw_wallet", "send_money"])
      .gte("created_at", isoDaysAgo(30))
      .order("created_at", { ascending: false })
      .limit(200),
    client
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("sender_id", userId)
      .in("type", ["fund", "fund_wallet", "wallet_funded", "withdraw_wallet", "send_money"])
      .gte("created_at", since1h),
  ]);

  if (send24Res.error) {
    const fallback = await client
      .from("transactions")
      .select("amount, status, created_at")
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .eq("type", "send_money")
      .gte("created_at", since24h);
    if (fallback.error) {
      snapshot.queryErrors.push(fallback.error.message);
    } else {
      const rows = fallback.data || [];
      snapshot.sendCount24h = rows.length;
      snapshot.sendTotal24h = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    }
  } else {
    const rows = send24Res.data || [];
    snapshot.sendCount24h = rows.length;
    snapshot.sendTotal24h = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  }

  if (!send1hRes.error) snapshot.sendCount1h = send1hRes.count ?? 0;
  else snapshot.queryErrors.push(send1hRes.error.message);

  if (withdrawRes.error) {
    snapshot.queryErrors.push(withdrawRes.error.message);
  } else {
    snapshot.withdrawCount24h = (withdrawRes.data || []).length;
  }

  if (!fundRes.error) snapshot.fundingAttempts24h = fundRes.count ?? 0;
  else snapshot.queryErrors.push(fundRes.error.message);

  if (!failedRes.error && typeof failedRes.count === "number") {
    snapshot.failedOrBlocked24h = failedRes.count;
  }

  if (!burstRes.error) snapshot.burstCount1h = burstRes.count ?? 0;
  else snapshot.queryErrors.push(burstRes.error.message);

  const recentRows = recentRes.error ? [] : recentRes.data || [];
  if (recentRes.error) snapshot.queryErrors.push(recentRes.error.message);

  let roundHits = 0;
  for (const row of recentRows) {
    if (isRoundAmount(row.amount)) roundHits += 1;
  }
  snapshot.roundNumberCount30d = roundHits;

  const funds = recentRows.filter((r) =>
    r.type === "fund" || r.type === "fund_wallet" || r.type === "wallet_funded",
  );
  const withdraws = recentRows.filter((r) => r.type === "withdraw_wallet");
  const rapid = detectRapidFundWithdraw(funds, withdraws);
  snapshot.rapidCashOut = rapid.detected;
  if (rapid.detected) snapshot.rapidCashOutDetail = rapid;

  const count90Res = await client
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .gte("created_at", isoDaysAgo(90));
  if (!count90Res.error) snapshot.totalTxnCount90d = count90Res.count ?? 0;

  return snapshot;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 * @param {string} since24h
 */
async function countFundingFailures24h(client, userId, since24h) {
  const { count, error } = await client
    .from("fraud_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("transaction_type", "fund")
    .in("event_type", FUNDING_FAILURE_EVENTS)
    .gte("created_at", since24h);
  if (error) {
    if (!isMissingTable(error, "fraud_logs") && !isMissingColumn(error)) {
      warn({ op: "countFundingFailures24h", err: error.message });
    }
    return 0;
  }
  return count ?? 0;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 */
async function fetchFraudLogSignals(client, userId) {
  const out = {
    openCount: 0,
    highSeverityCount: 0,
    escalatedCount: 0,
    openRows: [],
    highSeverityRows: [],
    escalatedRows: [],
    tableMissing: false,
  };
  const { data, error } = await client
    .from("fraud_logs")
    .select("risk_level, status, created_at")
    .eq("user_id", userId)
    .limit(500);
  if (error) {
    if (isMissingTable(error, "fraud_logs")) {
      out.tableMissing = true;
      return out;
    }
    warn({ op: "fetchFraudLogSignals", err: error.message });
    return out;
  }
  for (const row of data || []) {
    const st = String(row.status || "open").toLowerCase();
    const rl = String(row.risk_level || "").toLowerCase();
    if (st === "open") {
      out.openCount += 1;
      out.openRows.push(row);
    }
    if (st === "escalated") {
      out.escalatedCount += 1;
      out.escalatedRows.push(row);
    }
    if (rl === "high") {
      out.highSeverityCount += 1;
      out.highSeverityRows.push(row);
    }
  }
  return out;
}

/**
 * Resolve account creation timestamp (fail-open).
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 */
async function resolveAccountCreatedAt(client, userId) {
  const profRes = await client.from("profiles").select("created_at").eq("id", userId).maybeSingle();
  if (!profRes.error && profRes.data?.created_at) {
    return { createdAt: profRes.data.created_at, source: "profiles.created_at" };
  }
  if (profRes.error && !isMissingColumn(profRes.error)) {
    warn({ op: "resolveAccountCreatedAt_profile", err: profRes.error.message });
  }

  const txRes = await client
    .from("transactions")
    .select("created_at")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!txRes.error && txRes.data?.created_at) {
    return { createdAt: txRes.data.created_at, source: "earliest_transaction" };
  }

  return { createdAt: null, source: null };
}

/**
 * Compute confidence score from signal coverage.
 * @param {object} ctx
 */
function computeConfidenceScore(ctx) {
  let score = 50;
  const { txSignals, fraudSignals, accountAgeDays, securityEventCount, hasAccountStatus } = ctx;

  if (txSignals.totalTxnCount90d >= 20) score += 15;
  else if (txSignals.totalTxnCount90d >= 5) score += 8;
  else if (txSignals.totalTxnCount90d === 0) score -= 12;

  if (securityEventCount >= 3) score += 8;
  else if (securityEventCount >= 1) score += 4;

  if (!fraudSignals.tableMissing && (fraudSignals.openCount + fraudSignals.highSeverityCount) > 0) {
    score += 10;
  }

  if (Number.isFinite(accountAgeDays)) {
    if (accountAgeDays >= 90) score += 10;
    else if (accountAgeDays >= 30) score += 5;
    else if (accountAgeDays < 7) score -= 15;
    else if (accountAgeDays < 30) score -= 8;
  } else {
    score -= 5;
  }

  if (hasAccountStatus) score += 5;

  const corroborating =
    (txSignals.sendCount24h > 0 ? 1 : 0) +
    (txSignals.withdrawCount24h > 0 ? 1 : 0) +
    (txSignals.fundingAttempts24h > 0 ? 1 : 0) +
    (fraudSignals.openCount > 0 ? 1 : 0);
  if (corroborating >= 3) score += 8;
  else if (corroborating >= 2) score += 4;

  if (txSignals.queryErrors.length > 2) score -= 10;

  return clamp(Math.round(score), 0, 100);
}

/**
 * Compute unified risk score from existing observability tables (read-only).
 * @param {string} userId
 * @param {import('@supabase/supabase-js').SupabaseClient} [client]
 */
export async function calculateUserRiskScore(userId, client = supabase) {
  const uid = String(userId || "").trim();
  const empty = {
    riskScore: 0,
    confidenceScore: 50,
    trustScore: 0,
    riskLevel: /** @type {RiskLevel} */ ("low"),
    recommendedAction: /** @type {RecommendedAction} */ ("allow"),
    reasons: [],
    sourceSnapshot: {},
    decaySnapshot: {},
  };
  if (!uid || !client) return empty;

  const now = new Date();
  const since7d = isoDaysAgo(7, now);
  const since30d = isoDaysAgo(30, now);
  const since90d = isoDaysAgo(90, now);
  const since24h = isoHoursAgo(24, now);
  const since1h = isoHoursAgo(1, now);

  const acc = { score: 0, trustScore: 0, trustRiskReduction: 0, reasons: [] };
  const sourceSnapshot = {
    scoredAt: now.toISOString(),
    userId: uid,
    riskVersion: RISK_VERSION,
    windows: { since7d, since30d, since90d, since24h, since1h },
    signals: {},
  };
  const decaySnapshot = {};

  const [
    suspRows,
    alertRows,
    blockedFinRows,
    susp30Check,
    revokedCount,
    acctStatus,
    txSignals,
    fraudSignals,
    fundingFailures24h,
    accountCreated,
  ] = await Promise.all([
    fetchSecurityEvents(client, uid, { type: "suspicious_login", sinceIso: since90d }),
    fetchSecurityEvents(client, uid, {
      type: "security_alert",
      sinceIso: since90d,
      severityIn: ["high", "critical"],
      descriptionNotIlike: "%Blocked financial action%",
    }),
    fetchSecurityEvents(client, uid, {
      type: "security_alert",
      sinceIso: since90d,
      descriptionIlike: "%Blocked financial action%",
    }),
    fetchSecurityEvents(client, uid, { type: "suspicious_login", sinceIso: since30d }),
    countRevokedSessions(client, uid),
    client
      .from("account_security_status")
      .select("status, risk_level")
      .eq("user_id", uid)
      .maybeSingle(),
    fetchTransactionSignals(client, uid, since24h, since1h),
    fetchFraudLogSignals(client, uid),
    countFundingFailures24h(client, uid, since24h),
    resolveAccountCreatedAt(client, uid),
  ]);

  const accountAgeDays = accountCreated.createdAt
    ? eventAgeDays(accountCreated.createdAt, now)
    : null;

  sourceSnapshot.signals.security = {
    suspiciousLogin90d: suspRows.rows.length,
    suspiciousLogin30d: susp30Check.rows.length,
    securityAlertHighCritical90d: alertRows.rows.length,
    blockedFinancial90d: blockedFinRows.rows.length,
    revokedSessions: revokedCount,
  };
  sourceSnapshot.signals.account = acctStatus.error
    ? { error: acctStatus.error.message }
    : acctStatus.data || { status: "normal", risk_level: "low" };
  sourceSnapshot.signals.transactions = txSignals;
  sourceSnapshot.signals.fraudLogs = {
    openCount: fraudSignals.openCount,
    highSeverityCount: fraudSignals.highSeverityCount,
    escalatedCount: fraudSignals.escalatedCount,
    tableMissing: fraudSignals.tableMissing,
  };
  sourceSnapshot.signals.accountAge = {
    createdAt: accountCreated.createdAt,
    source: accountCreated.source,
    ageDays: accountAgeDays,
  };
  sourceSnapshot.signals.fundingFailures24h = fundingFailures24h;

  decaySnapshot.suspicious_login_weight = avgDecayWeight(suspRows.rows, now);
  decaySnapshot.security_alert_weight = avgDecayWeight(alertRows.rows, now);
  decaySnapshot.blocked_financial_weight = avgDecayWeight(blockedFinRows.rows, now);
  const fraudDecayRows = [
    ...fraudSignals.openRows,
    ...fraudSignals.highSeverityRows,
    ...fraudSignals.escalatedRows,
  ];
  decaySnapshot.fraud_log_weight = avgDecayWeight(fraudDecayRows, now);

  addDecayedRule(acc, {
    code: "suspicious_login_decayed",
    label: "Suspicious sign-ins (decayed)",
    unit: 10,
    max: 30,
    events: suspRows.rows,
    anchor: now,
    details: { windowDays: 90 },
  });

  addDecayedRule(acc, {
    code: "security_alert_high_critical_decayed",
    label: "High/critical security alerts (decayed)",
    unit: 20,
    max: 40,
    events: alertRows.rows,
    anchor: now,
    details: { windowDays: 90 },
  });

  addDecayedRule(acc, {
    code: "blocked_financial_action_decayed",
    label: "Blocked financial actions (decayed)",
    unit: 15,
    max: 45,
    events: blockedFinRows.rows,
    anchor: now,
    details: { windowDays: 90 },
  });

  addRule(acc, {
    code: "revoked_sessions",
    label: "Revoked sessions",
    unit: 5,
    max: 20,
    count: revokedCount,
  });

  const acct = acctStatus.data;
  if (acct && !acctStatus.error) {
    const st = String(acct.status || "normal").toLowerCase();
    if (st === "watch") {
      addRule(acc, { code: "account_watch", label: "Account on watch", unit: 10, max: 10, count: 1 });
    } else if (st === "restricted") {
      addRule(acc, { code: "account_restricted", label: "Account restricted", unit: 40, max: 40, count: 1 });
    } else if (st === "frozen") {
      addRule(acc, { code: "account_frozen", label: "Account frozen", unit: 70, max: 70, count: 1 });
    }
  }

  if (txSignals.sendCount1h >= 3) {
    addRule(acc, {
      code: "high_send_velocity_1h",
      label: "High send velocity (1h)",
      unit: 15,
      max: 15,
      count: 1,
      details: { sendCount1h: txSignals.sendCount1h },
    });
  }

  if (txSignals.sendCount24h >= 5) {
    addRule(acc, {
      code: "high_send_velocity_24h",
      label: "High send count (24h)",
      unit: 15,
      max: 15,
      count: 1,
      details: { sendCount24h: txSignals.sendCount24h },
    });
  }

  if (txSignals.withdrawCount24h >= 3) {
    addRule(acc, {
      code: "withdraw_velocity_24h",
      label: "High withdrawal count (24h)",
      unit: 20,
      max: 20,
      count: 1,
      details: { withdrawCount24h: txSignals.withdrawCount24h },
    });
  }

  if (txSignals.burstCount1h >= 5) {
    addRule(acc, {
      code: "burst_activity_1h",
      label: "Burst financial activity (1h)",
      unit: 15,
      max: 15,
      count: 1,
      details: { burstCount1h: txSignals.burstCount1h },
    });
  }

  if (txSignals.sendTotal24h >= HIGH_SEND_TOTAL_24H_USD) {
    addRule(acc, {
      code: "send_total_high_24h",
      label: "High total sent (24h)",
      unit: 15,
      max: 15,
      count: 1,
      details: { sendTotal24h: txSignals.sendTotal24h, thresholdUsd: HIGH_SEND_TOTAL_24H_USD },
    });
  }

  if (txSignals.rapidCashOut) {
    addRule(acc, {
      code: "rapid_cash_out_pattern",
      label: "Rapid fund→withdraw pattern",
      unit: 20,
      max: 20,
      count: 1,
      details: txSignals.rapidCashOutDetail || {},
    });
  }

  if (txSignals.roundNumberCount30d >= 3) {
    addRule(acc, {
      code: "round_number_pattern",
      label: "Repeated round-number amounts",
      unit: 10,
      max: 10,
      count: 1,
      details: { roundNumberCount30d: txSignals.roundNumberCount30d },
    });
  }

  if (Number.isFinite(accountAgeDays)) {
    if (accountAgeDays < 7) {
      addRule(acc, {
        code: "new_account_7d",
        label: "New account (< 7 days)",
        unit: 15,
        max: 15,
        count: 1,
        details: { ageDays: Math.round(accountAgeDays * 10) / 10 },
      });
    } else if (accountAgeDays < 30) {
      addRule(acc, {
        code: "new_account_30d",
        label: "Recent account (< 30 days)",
        unit: 8,
        max: 8,
        count: 1,
        details: { ageDays: Math.round(accountAgeDays * 10) / 10 },
      });
    }
  }

  if (txSignals.failedOrBlocked24h > 0) {
    addRule(acc, {
      code: "failed_blocked_txn_24h",
      label: "Failed/blocked transactions (24h)",
      unit: 15,
      max: 15,
      count: 1,
      details: { count: txSignals.failedOrBlocked24h },
    });
  }

  if (fundingFailures24h >= 2) {
    addRule(acc, {
      code: "repeated_funding_failures_24h",
      label: "Repeated failed funding (24h)",
      unit: 15,
      max: 15,
      count: 1,
      details: { count: fundingFailures24h },
    });
  }

  if (fraudSignals.openCount > 0) {
    addDecayedRule(acc, {
      code: "fraud_log_open_decayed",
      label: "Open fraud reviews (decayed)",
      unit: 15,
      max: 15,
      events: fraudSignals.openRows,
      anchor: now,
    });
  }

  if (fraudSignals.highSeverityCount > 0) {
    addDecayedRule(acc, {
      code: "fraud_log_high_severity_decayed",
      label: "High-severity fraud logs (decayed)",
      unit: 25,
      max: 25,
      events: fraudSignals.highSeverityRows,
      anchor: now,
    });
  }

  if (fraudSignals.escalatedCount > 0) {
    addDecayedRule(acc, {
      code: "fraud_log_escalated_decayed",
      label: "Escalated fraud reviews (decayed)",
      unit: 30,
      max: 30,
      events: fraudSignals.escalatedRows,
      anchor: now,
    });
  }

  if (Number.isFinite(accountAgeDays)) {
    if (accountAgeDays > 180) {
      addTrustSignal(acc, {
        code: "trusted_account_age_180d",
        label: "Established account (> 180 days)",
        riskReduction: 15,
        trustPoints: 25,
        details: { ageDays: Math.round(accountAgeDays) },
      });
    } else if (accountAgeDays > 90) {
      addTrustSignal(acc, {
        code: "trusted_account_age_90d",
        label: "Mature account (> 90 days)",
        riskReduction: 10,
        trustPoints: 15,
        details: { ageDays: Math.round(accountAgeDays) },
      });
    }
  }

  if (susp30Check.rows.length === 0) {
    addTrustSignal(acc, {
      code: "clean_login_history_30d",
      label: "No suspicious sign-ins (30d)",
      riskReduction: 10,
      trustPoints: 10,
    });
  }

  if (!fraudSignals.tableMissing && fraudSignals.openCount === 0) {
    addTrustSignal(acc, {
      code: "clean_security_history",
      label: "No open fraud reviews",
      riskReduction: 10,
      trustPoints: 10,
    });
  }

  if (blockedFinRows.rows.length === 0) {
    addTrustSignal(acc, {
      code: "stable_behavior",
      label: "No blocked financial actions",
      riskReduction: 8,
      trustPoints: 8,
    });
  }

  const securityEventCount =
    suspRows.rows.length + alertRows.rows.length + blockedFinRows.rows.length;

  const confidenceScore = computeConfidenceScore({
    txSignals,
    fraudSignals,
    accountAgeDays,
    securityEventCount,
    hasAccountStatus: Boolean(acct && !acctStatus.error),
  });

  const riskScore = clamp(Math.round(acc.score), 0, 100);
  const trustScore = clamp(Math.round(acc.trustScore), -100, 100);
  const riskLevel = scoreToRiskLevel(riskScore);
  const recommendedAction = riskLevelToRecommendedAction(riskLevel);

  acc.reasons.sort((a, b) => Math.abs(b.points || 0) - Math.abs(a.points || 0));

  return {
    riskScore,
    confidenceScore,
    trustScore,
    riskLevel,
    recommendedAction,
    reasons: acc.reasons,
    sourceSnapshot,
    decaySnapshot,
  };
}

/**
 * Persist a calculated risk result for a user (admin RLS).
 * @param {string} userId
 * @param {object} riskResult
 * @param {import('@supabase/supabase-js').SupabaseClient} [client]
 */
export async function saveUserRiskScore(userId, riskResult, client = supabase) {
  const uid = String(userId || "").trim();
  if (!uid || !client) {
    return { ok: false, error: "missing_user_or_client", data: null };
  }
  const now = new Date().toISOString();
  const row = {
    user_id: uid,
    risk_score: Math.min(100, Math.max(0, Number(riskResult?.riskScore) || 0)),
    confidence_score: clamp(Math.round(Number(riskResult?.confidenceScore) || 50), 0, 100),
    trust_score: clamp(Math.round(Number(riskResult?.trustScore) || 0), -100, 100),
    risk_level: riskResult?.riskLevel || "low",
    recommended_action: riskResult?.recommendedAction || "allow",
    reasons: Array.isArray(riskResult?.reasons) ? riskResult.reasons : [],
    source_snapshot: riskResult?.sourceSnapshot && typeof riskResult.sourceSnapshot === "object" ? riskResult.sourceSnapshot : {},
    decay_snapshot: riskResult?.decaySnapshot && typeof riskResult.decaySnapshot === "object" ? riskResult.decaySnapshot : {},
    risk_version: RISK_VERSION,
    last_scored_at: now,
    updated_at: now,
  };

  const { data, error } = await client
    .from("user_risk_scores")
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    if (isMissingTable(error, "user_risk_scores")) {
      return { ok: false, error: "table_missing", tableMissing: true, data: null };
    }
    warn({ op: "saveUserRiskScore", err: error.message });
    return { ok: false, error: error.message, data: null };
  }

  return { ok: true, error: null, data };
}

/**
 * @param {string} userId
 * @param {import('@supabase/supabase-js').SupabaseClient} [client]
 */
export async function fetchUserRiskScore(userId, client = supabase) {
  const uid = String(userId || "").trim();
  if (!uid || !client) return { data: null, error: "missing_user_or_client", tableMissing: false };

  const { data, error } = await client.from("user_risk_scores").select("*").eq("user_id", uid).maybeSingle();

  if (error) {
    if (isMissingTable(error, "user_risk_scores")) {
      return { data: null, error: null, tableMissing: true };
    }
    return { data: null, error: error.message, tableMissing: false };
  }

  return { data, error: null, tableMissing: false };
}

const ADMIN_RISK_SELECT =
  "user_id, risk_score, confidence_score, trust_score, risk_level, recommended_action, reasons, source_snapshot, decay_snapshot, risk_version, last_scored_at, updated_at, created_at";

/**
 * @param {{ limit?: number, riskLevel?: string, minScore?: number, minConfidence?: number, recommendedAction?: string }} [opts]
 * @param {import('@supabase/supabase-js').SupabaseClient} [client]
 */
export async function fetchAdminRiskScores(opts = {}, client = supabase) {
  const limit = Math.min(500, Math.max(1, Number(opts.limit) || 100));
  const riskLevel = String(opts.riskLevel || "").trim().toLowerCase();
  const minScore = Math.max(0, Number(opts.minScore) || 0);
  const minConfidence = Math.max(0, Number(opts.minConfidence) || 0);
  const recommendedAction = String(opts.recommendedAction || "").trim().toLowerCase();

  if (!client) {
    return { rows: [], error: "no_client", tableMissing: false };
  }

  let q = client
    .from("user_risk_scores")
    .select(ADMIN_RISK_SELECT)
    .gte("risk_score", minScore)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (minConfidence > 0) {
    q = q.gte("confidence_score", minConfidence);
  }

  if (riskLevel && ["low", "medium", "high", "critical"].includes(riskLevel)) {
    q = q.eq("risk_level", riskLevel);
  }

  const validActions = ["allow", "monitor", "review", "restrict", "freeze_candidate"];
  if (recommendedAction && validActions.includes(recommendedAction)) {
    q = q.eq("recommended_action", recommendedAction);
  }

  const { data, error } = await q;

  if (error) {
    if (isMissingTable(error, "user_risk_scores")) {
      return { rows: [], error: null, tableMissing: true };
    }
    return { rows: [], error: error.message, tableMissing: false };
  }

  return { rows: data || [], error: null, tableMissing: false };
}

/** Map DB row to camelCase result shape for UI. */
export function mapRiskScoreRow(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    riskScore: row.risk_score,
    confidenceScore: row.confidence_score ?? 50,
    trustScore: row.trust_score ?? 0,
    riskLevel: row.risk_level,
    recommendedAction: row.recommended_action,
    reasons: row.reasons || [],
    sourceSnapshot: row.source_snapshot || {},
    decaySnapshot: row.decay_snapshot || {},
    riskVersion: row.risk_version || "phase2b",
    lastScoredAt: row.last_scored_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

/** Format top reasons with signed points for display. */
export function formatTopReasons(reasons, max = 3) {
  const list = Array.isArray(reasons) ? reasons : [];
  if (list.length === 0) return [];
  return list.slice(0, max).map((r) => {
    const pts = Number(r.points) || 0;
    const sign = pts >= 0 ? "+" : "";
    return {
      code: r.code,
      label: r.label || r.code || "signal",
      points: pts,
      display: `${r.label || r.code || "signal"} (${sign}${pts})`,
    };
  });
}
