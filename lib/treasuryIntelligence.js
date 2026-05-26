/**
 * Treasury Intelligence — read-only health scoring and snapshot persistence.
 * Uses adminTreasury snapshot helpers; never mutates wallets, payouts, or transactions.
 */

import { supabase as defaultClient } from "./supabaseClient";
import { fetchTreasurySnapshot, TREASURY_STATUS } from "./adminTreasury";
import { calculateLedgerTrialBalance } from "./internalLedger";
import { FUNDING_EVENTS } from "./fraudRules";

const LOG_NS = "[treasuryIntelligence]";

const FUNDING_FAILURE_THRESHOLD = 3;
const LARGE_PENDING_THRESHOLD_USD = 1000;
const HIGH_PAYOUT_PRESSURE_THRESHOLD_USD = 500;
const SURGE_MULTIPLIER = 2.0;
const LIABILITY_GROWTH_SPIKE_RATIO = 1.25;

const CAPTURE_FAIL_EVENTS = [
  FUNDING_EVENTS.PAYPAL_CAPTURE_FAILED,
  FUNDING_EVENTS.PAYPAL_CAPTURE_INCOMPLETE,
  FUNDING_EVENTS.INVALID_CAPTURE_AMOUNT,
];

const WALLET_AMOUNT_COLUMNS = ["wallet_balance", "balance"];
const WALLET_PAGE_SIZE = 1000;
const WALLET_HARD_CAP = 50000;

const TYPE_MAP = Object.freeze({
  fund: "fund",
  fund_wallet: "fund",
  withdraw: "withdraw",
  withdraw_wallet: "withdraw",
  send: "send",
  send_money: "send",
});

function warn(payload) {
  try {
    console.warn(LOG_NS, payload);
  } catch {
    /* ignore */
  }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isoHoursAgo(hours, anchor = new Date()) {
  const d = anchor instanceof Date ? anchor : new Date(anchor);
  return new Date(d.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function isMissingTable(error, tableName) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204") return true;
  return msg.includes(tableName) && (msg.includes("does not exist") || msg.includes("not found"));
}

function isMissingColumnError(err) {
  if (!err) return false;
  const code = String(err.code || "").trim();
  if (code === "42703") return true;
  const msg = String(err.message || "").toLowerCase();
  return msg.includes('column "') && msg.includes("does not exist");
}

function normalizeTransactionType(raw) {
  const key = String(raw || "").toLowerCase();
  return TYPE_MAP[key] || key || "other";
}

/**
 * @param {number} score
 * @returns {'low'|'medium'|'high'|'critical'}
 */
export function healthScoreToRiskLevel(score) {
  const s = clamp(Math.round(Number(score) || 0), 0, 100);
  if (s >= 80) return "low";
  if (s >= 60) return "medium";
  if (s >= 40) return "high";
  return "critical";
}

/**
 * @param {object} reason
 * @returns {object}
 */
function makeReason(code, label, impact, details = {}) {
  return { code, label, impact, details };
}

async function fetchWalletPage(client, from, to, column) {
  return client
    .from("wallets")
    .select(`user_id, ${column}`)
    .order("user_id", { ascending: true })
    .range(from, to);
}

async function scanWalletAnomalies(client) {
  let negativeCount = 0;
  let processed = 0;
  let columnUsed = WALLET_AMOUNT_COLUMNS[0];
  let partialError = null;
  let from = 0;

  while (processed < WALLET_HARD_CAP) {
    const to = from + WALLET_PAGE_SIZE - 1;
    let attempt = await fetchWalletPage(client, from, to, columnUsed);
    if (attempt.error && isMissingColumnError(attempt.error) && columnUsed === WALLET_AMOUNT_COLUMNS[0]) {
      columnUsed = WALLET_AMOUNT_COLUMNS[1];
      attempt = await fetchWalletPage(client, from, to, columnUsed);
    }
    if (attempt.error) {
      partialError = attempt.error;
      break;
    }
    const rows = Array.isArray(attempt.data) ? attempt.data : [];
    for (const r of rows) {
      const bal = toFiniteNumber(r?.[columnUsed]);
      if (bal < 0) negativeCount += 1;
    }
    processed += rows.length;
    if (rows.length < WALLET_PAGE_SIZE) break;
    from += WALLET_PAGE_SIZE;
  }

  return {
    negativeCount,
    walletsScanned: processed,
    partialError,
    columnUsed,
  };
}

async function fetch24hVolumes(client, since24h) {
  const empty = { funding: 0, withdraw: 0, send: 0, txCount: 0, error: null };
  try {
    const { data, error } = await client
      .from("transactions")
      .select("amount, type")
      .gte("created_at", since24h)
      .limit(10000);
    if (error) throw error;
    let funding = 0;
    let withdraw = 0;
    let send = 0;
    for (const row of data || []) {
      const amt = Math.abs(toFiniteNumber(row?.amount));
      const kind = normalizeTransactionType(row?.type);
      if (kind === "fund") funding += amt;
      else if (kind === "withdraw") withdraw += amt;
      else if (kind === "send") send += amt;
    }
    return { funding, withdraw, send, txCount: (data || []).length, error: null };
  } catch (err) {
    return { ...empty, error: err };
  }
}

async function fetchFailedFundingCount24h(client, since24h) {
  try {
    const [dupRes, capRes, creditRes] = await Promise.all([
      client
        .from("fraud_logs")
        .select("id", { count: "exact", head: true })
        .eq("transaction_type", "fund")
        .eq("event_type", FUNDING_EVENTS.DUPLICATE_BLOCKED)
        .gte("created_at", since24h),
      client
        .from("fraud_logs")
        .select("id", { count: "exact", head: true })
        .eq("transaction_type", "fund")
        .in("event_type", CAPTURE_FAIL_EVENTS)
        .gte("created_at", since24h),
      client
        .from("fraud_logs")
        .select("id", { count: "exact", head: true })
        .eq("transaction_type", "fund")
        .eq("event_type", FUNDING_EVENTS.CREDIT_FAILED)
        .gte("created_at", since24h),
    ]);
    const dup = typeof dupRes.count === "number" ? dupRes.count : 0;
    const cap = typeof capRes.count === "number" ? capRes.count : 0;
    const credit = typeof creditRes.count === "number" ? creditRes.count : 0;
    const firstErr = dupRes.error || capRes.error || creditRes.error;
    return { count: dup + cap + credit, error: firstErr || null };
  } catch (err) {
    return { count: 0, error: err };
  }
}

async function fetchPriorLiabilities(client) {
  try {
    const { data, error } = await client
      .from("treasury_health_snapshots")
      .select("total_wallet_liabilities, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error, "treasury_health_snapshots")) {
        return { liabilities: null, error: null, tableMissing: true };
      }
      return { liabilities: null, error, tableMissing: false };
    }
    return {
      liabilities: data?.total_wallet_liabilities != null ? toFiniteNumber(data.total_wallet_liabilities) : null,
      error: null,
      tableMissing: false,
    };
  } catch (err) {
    return { liabilities: null, error: err, tableMissing: false };
  }
}

function compute7DayAverageVolume(dailyRows) {
  const rows = Array.isArray(dailyRows) ? dailyRows : [];
  if (rows.length === 0) return 0;
  let total = 0;
  for (const r of rows) {
    total += toFiniteNumber(r.funded) + toFiniteNumber(r.withdrawn) + toFiniteNumber(r.sent);
  }
  return total / rows.length;
}

function computeConfidenceScore({ treasuryAvailable, txHistoryAvailable, reconciliationVisible, walletScanOk }) {
  let score = 50;
  if (treasuryAvailable) score += 15;
  if (txHistoryAvailable) score += 15;
  if (reconciliationVisible) score += 10;
  if (walletScanOk) score += 10;
  return clamp(Math.round(score), 0, 100);
}

const EMPTY_HEALTH = {
  healthScore: 100,
  treasuryRiskLevel: "low",
  confidenceScore: 50,
  liquidityScore: 100,
  reconciliationScore: 100,
  pendingObligationScore: 100,
  reasons: [],
  sourceSnapshot: {},
};

/**
 * Compute treasury health from existing observability data (read-only).
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient]
 */
export async function calculateTreasuryHealth(supabaseClient = defaultClient) {
  const client = supabaseClient || defaultClient;
  if (!client) return { ...EMPTY_HEALTH };

  const now = new Date();
  const since24h = isoHoursAgo(24, now);
  const reasons = [];
  let healthScore = 100;
  let liquidityScore = 100;
  let reconciliationScore = 100;
  let pendingObligationScore = 100;
  let reconciliationMismatchCount = 0;
  let anomalyCount = 0;

  const sourceSnapshot = {
    scoredAt: now.toISOString(),
    signals: {},
  };

  let treasuryAvailable = false;
  let txHistoryAvailable = false;
  let reconciliationVisible = false;
  let walletScanOk = false;

  try {
    const [treasurySnap, volumes24h, fundingFailures, walletAnomalies, ledgerTrial, priorLiab] = await Promise.all([
      fetchTreasurySnapshot(client),
      fetch24hVolumes(client, since24h),
      fetchFailedFundingCount24h(client, since24h),
      scanWalletAnomalies(client),
      calculateLedgerTrialBalance({ supabaseClient: client }),
      fetchPriorLiabilities(client),
    ]);

    treasuryAvailable = Boolean(treasurySnap?.summary);
    txHistoryAvailable = !volumes24h.error;
    walletScanOk = !walletAnomalies.partialError;
    reconciliationVisible = !ledgerTrial.error || (ledgerTrial.accounts || []).length > 0;

    const liabilities = toFiniteNumber(treasurySnap?.summary?.totalLiabilities?.value);
    const pendingExposure =
      toFiniteNumber(treasurySnap?.summary?.pendingPayoutObligations?.value) +
      toFiniteNumber(treasurySnap?.summary?.processingPayouts?.value);
    const pendingCount =
      (treasurySnap?.summary?.pendingPayoutObligations?.count || 0) +
      (treasurySnap?.summary?.processingPayouts?.count || 0);

    const funding24h = volumes24h.funding;
    const withdraw24h = volumes24h.withdraw;
    const send24h = volumes24h.send;
    const failedFundingCount = fundingFailures.count;

    sourceSnapshot.signals = {
      liabilities,
      pendingExposure,
      pendingCount,
      funding24h,
      withdraw24h,
      send24h,
      failedFundingCount,
      walletAnomalies,
      ledgerImbalance: ledgerTrial.imbalance,
      priorLiabilities: priorLiab.liabilities,
      treasurySummaryStatus: treasurySnap?.summary?.totalLiabilities?.status,
    };

    // A. Liability growth spike
    if (priorLiab.liabilities != null && priorLiab.liabilities > 0 && liabilities > 0) {
      const ratio = liabilities / priorLiab.liabilities;
      if (ratio >= LIABILITY_GROWTH_SPIKE_RATIO) {
        liquidityScore = clamp(liquidityScore - 15, 0, 100);
        anomalyCount += 1;
        reasons.push(
          makeReason("liability_growth_spike", "Liability growth spike", -10, {
            current: liabilities,
            prior: priorLiab.liabilities,
            ratio: Math.round(ratio * 100) / 100,
          }),
        );
      }
    }

    // B. Large pending obligations
    if (pendingExposure >= LARGE_PENDING_THRESHOLD_USD || pendingCount >= 10) {
      healthScore -= 20;
      pendingObligationScore = clamp(pendingObligationScore - 25, 0, 100);
      reasons.push(
        makeReason("large_pending_obligations", "High pending payout obligations", -20, {
          exposure: pendingExposure,
          count: pendingCount,
        }),
      );
    }

    // B2. High payout pressure
    if (
      pendingExposure >= HIGH_PAYOUT_PRESSURE_THRESHOLD_USD &&
      pendingCount >= 3
    ) {
      healthScore -= 20;
      pendingObligationScore = clamp(pendingObligationScore - 20, 0, 100);
      liquidityScore = clamp(liquidityScore - 15, 0, 100);
      reasons.push(
        makeReason("high_payout_pressure", "High withdrawal pressure", -20, {
          exposure: pendingExposure,
          count: pendingCount,
        }),
      );
    }

    // C. Funding failures
    if (failedFundingCount >= FUNDING_FAILURE_THRESHOLD) {
      healthScore -= 15;
      anomalyCount += 1;
      reasons.push(
        makeReason("elevated_funding_failures", "Elevated funding failures", -15, {
          count: failedFundingCount,
          threshold: FUNDING_FAILURE_THRESHOLD,
        }),
      );
    }

    // D. Reconciliation — negative balances
    if (walletAnomalies.negativeCount > 0) {
      healthScore -= 20;
      reconciliationScore = clamp(reconciliationScore - 30, 0, 100);
      reconciliationMismatchCount += walletAnomalies.negativeCount;
      anomalyCount += walletAnomalies.negativeCount;
      reasons.push(
        makeReason("negative_balance_anomaly", "Negative wallet balances detected", -20, {
          count: walletAnomalies.negativeCount,
        }),
      );
    }

    // D. Ledger imbalance
    const ledgerImbalance = Math.abs(toFiniteNumber(ledgerTrial.imbalance));
    if (!ledgerTrial.error && ledgerImbalance >= 1e-6) {
      healthScore -= 25;
      reconciliationScore = clamp(reconciliationScore - 25, 0, 100);
      reconciliationMismatchCount += 1;
      anomalyCount += 1;
      reasons.push(
        makeReason("reconciliation_mismatch", "Reconciliation mismatches detected", -25, {
          ledgerImbalance,
        }),
      );
    }

    // D. Treasury data partial/unavailable
    const liabStatus = treasurySnap?.summary?.totalLiabilities?.status;
    if (liabStatus === TREASURY_STATUS.WARNING || liabStatus === TREASURY_STATUS.ERROR) {
      reconciliationScore = clamp(reconciliationScore - 15, 0, 100);
      reconciliationMismatchCount += 1;
      if (liabStatus === TREASURY_STATUS.ERROR) {
        healthScore -= 25;
        reasons.push(
          makeReason("reconciliation_mismatch", "Reconciliation mismatches detected", -25, {
            detail: treasurySnap.summary.totalLiabilities.detail || "Wallet liability read failed",
          }),
        );
      }
    }

    if (walletAnomalies.partialError) {
      reconciliationMismatchCount += 1;
      reconciliationScore = clamp(reconciliationScore - 10, 0, 100);
    }

    // E. Transaction surge
    const dailyAvg = compute7DayAverageVolume(treasurySnap?.daily?.rows);
    const volume24h = funding24h + withdraw24h + send24h;
    if (dailyAvg > 0 && volume24h >= dailyAvg * SURGE_MULTIPLIER) {
      healthScore -= 10;
      liquidityScore = clamp(liquidityScore - 10, 0, 100);
      anomalyCount += 1;
      reasons.push(
        makeReason("transaction_surge", "Unusual treasury activity volume", -10, {
          volume24h,
          dailyAverage: Math.round(dailyAvg * 100) / 100,
          multiplier: SURGE_MULTIPLIER,
        }),
      );
    }

    // Liquidity pressure when pending exposure is large relative to liabilities
    if (liabilities > 0 && pendingExposure / liabilities >= 0.25) {
      liquidityScore = clamp(liquidityScore - 20, 0, 100);
      if (!reasons.some((r) => r.code === "liquidity_pressure")) {
        reasons.push(
          makeReason("liquidity_pressure", "Liquidity pressure warning", -10, {
            pendingExposure,
            liabilities,
            ratio: Math.round((pendingExposure / liabilities) * 100) / 100,
          }),
        );
      }
    }

    healthScore = clamp(Math.round(healthScore), 0, 100);
    const treasuryRiskLevel = healthScoreToRiskLevel(healthScore);
    const confidenceScore = computeConfidenceScore({
      treasuryAvailable,
      txHistoryAvailable,
      reconciliationVisible,
      walletScanOk,
    });

    reasons.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    return {
      healthScore,
      treasuryRiskLevel,
      confidenceScore,
      liquidityScore,
      reconciliationScore,
      pendingObligationScore,
      reasons,
      sourceSnapshot: {
        ...sourceSnapshot,
        metrics: {
          totalWalletLiabilities: liabilities,
          totalFundingVolume24h: funding24h,
          totalWithdrawVolume24h: withdraw24h,
          totalSendVolume24h: send24h,
          pendingWithdrawalExposure: pendingExposure,
          failedFundingCount24h: failedFundingCount,
          reconciliationMismatchCount,
          anomalyCount,
        },
      },
    };
  } catch (err) {
    warn({ op: "calculateTreasuryHealth", err: err?.message || err });
    return {
      ...EMPTY_HEALTH,
      confidenceScore: 30,
      reasons: [
        makeReason("calculation_error", "Treasury health calculation degraded", 0, {
          message: String(err?.message || "unknown error").slice(0, 200),
        }),
      ],
      sourceSnapshot: { scoredAt: now.toISOString(), error: String(err?.message || err) },
    };
  }
}

/**
 * Persist a treasury health snapshot (insert-only history).
 * @param {object} snapshot — result from calculateTreasuryHealth plus optional metrics
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient]
 */
export async function saveTreasuryHealthSnapshot(snapshot, supabaseClient = defaultClient) {
  const client = supabaseClient || defaultClient;
  if (!client || !snapshot) {
    return { ok: false, error: "missing_client_or_snapshot", data: null };
  }

  const metrics = snapshot.sourceSnapshot?.metrics || {};
  const row = {
    health_score: clamp(Math.round(Number(snapshot.healthScore) || 0), 0, 100),
    treasury_risk_level: snapshot.treasuryRiskLevel || healthScoreToRiskLevel(snapshot.healthScore),
    confidence_score: clamp(Math.round(Number(snapshot.confidenceScore) || 50), 0, 100),
    liquidity_score: clamp(Math.round(Number(snapshot.liquidityScore) || 100), 0, 100),
    reconciliation_score: clamp(Math.round(Number(snapshot.reconciliationScore) || 100), 0, 100),
    pending_obligation_score: clamp(Math.round(Number(snapshot.pendingObligationScore) || 100), 0, 100),
    total_wallet_liabilities: toFiniteNumber(metrics.totalWalletLiabilities),
    total_funding_volume_24h: toFiniteNumber(metrics.totalFundingVolume24h),
    total_withdraw_volume_24h: toFiniteNumber(metrics.totalWithdrawVolume24h),
    total_send_volume_24h: toFiniteNumber(metrics.totalSendVolume24h),
    pending_withdrawal_exposure: toFiniteNumber(metrics.pendingWithdrawalExposure),
    failed_funding_count_24h: Math.max(0, Math.round(Number(metrics.failedFundingCount24h) || 0)),
    reconciliation_mismatch_count: Math.max(0, Math.round(Number(metrics.reconciliationMismatchCount) || 0)),
    anomaly_count: Math.max(0, Math.round(Number(metrics.anomalyCount) || 0)),
    reasons: Array.isArray(snapshot.reasons) ? snapshot.reasons : [],
    source_snapshot:
      snapshot.sourceSnapshot && typeof snapshot.sourceSnapshot === "object" ? snapshot.sourceSnapshot : {},
  };

  try {
    const { data, error } = await client.from("treasury_health_snapshots").insert(row).select().single();
    if (error) {
      if (isMissingTable(error, "treasury_health_snapshots")) {
        return { ok: false, error: "table_missing", tableMissing: true, data: null };
      }
      warn({ op: "saveTreasuryHealthSnapshot", err: error.message });
      return { ok: false, error: error.message, data: null };
    }
    return { ok: true, error: null, data: mapTreasuryHealthRow(data) };
  } catch (err) {
    warn({ op: "saveTreasuryHealthSnapshot", err: err?.message || err });
    return { ok: false, error: String(err?.message || err), data: null };
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient]
 */
export async function fetchLatestTreasuryHealth(supabaseClient = defaultClient) {
  const client = supabaseClient || defaultClient;
  if (!client) return { data: null, error: "no_client", tableMissing: false };

  try {
    const { data, error } = await client
      .from("treasury_health_snapshots")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingTable(error, "treasury_health_snapshots")) {
        return { data: null, error: null, tableMissing: true };
      }
      return { data: null, error: error.message, tableMissing: false };
    }

    return { data: data ? mapTreasuryHealthRow(data) : null, error: null, tableMissing: false };
  } catch (err) {
    return { data: null, error: String(err?.message || err), tableMissing: false };
  }
}

/**
 * @param {{ limit?: number }} [opts]
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient]
 */
export async function fetchTreasuryHealthHistory(opts = {}, supabaseClient = defaultClient) {
  const client = supabaseClient || defaultClient;
  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 30));
  if (!client) return { rows: [], error: "no_client", tableMissing: false };

  try {
    const { data, error } = await client
      .from("treasury_health_snapshots")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      if (isMissingTable(error, "treasury_health_snapshots")) {
        return { rows: [], error: null, tableMissing: true };
      }
      return { rows: [], error: error.message, tableMissing: false };
    }

    return { rows: (data || []).map(mapTreasuryHealthRow).filter(Boolean), error: null, tableMissing: false };
  } catch (err) {
    return { rows: [], error: String(err?.message || err), tableMissing: false };
  }
}

const ALERT_MAP = Object.freeze({
  high_payout_pressure: {
    severity: "high",
    title: "High withdrawal pressure",
    message: "Pending and processing payout obligations exceed safe thresholds.",
  },
  large_pending_obligations: {
    severity: "high",
    title: "High pending payout obligations",
    message: "Outstanding payout obligations are elevated relative to normal operations.",
  },
  elevated_funding_failures: {
    severity: "medium",
    title: "Elevated failed funding activity",
    message: "Multiple funding failures detected in the last 24 hours.",
  },
  reconciliation_mismatch: {
    severity: "high",
    title: "Reconciliation mismatch detected",
    message: "Wallet or ledger reconciliation signals indicate mismatches.",
  },
  negative_balance_anomaly: {
    severity: "critical",
    title: "Negative wallet balance detected",
    message: "One or more wallets report a negative balance.",
  },
  liquidity_pressure: {
    severity: "medium",
    title: "Liquidity pressure warning",
    message: "Pending obligations are large relative to total wallet liabilities.",
  },
  transaction_surge: {
    severity: "medium",
    title: "Unusual treasury activity volume",
    message: "24-hour transaction volume exceeds the recent daily average.",
  },
  liability_growth_spike: {
    severity: "medium",
    title: "Liability growth spike",
    message: "Total wallet liabilities grew sharply since the last snapshot.",
  },
});

/**
 * Derive treasury alerts from current health signals (read-only).
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient]
 */
export async function fetchTreasuryAlerts(supabaseClient = defaultClient) {
  try {
    const health = await calculateTreasuryHealth(supabaseClient);
    const now = new Date().toISOString();
    const alerts = [];
    const seen = new Set();

    for (const reason of health.reasons || []) {
      const code = reason?.code;
      if (!code || seen.has(code)) continue;
      const template = ALERT_MAP[code];
      if (!template) continue;
      seen.add(code);
      alerts.push({
        severity: template.severity,
        title: template.title,
        message: template.message,
        createdAt: now,
        code,
        details: reason.details || {},
      });
    }

    alerts.sort((a, b) => {
      const rank = { critical: 0, high: 1, medium: 2, low: 3 };
      return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
    });

    return { alerts, health, error: null };
  } catch (err) {
    warn({ op: "fetchTreasuryAlerts", err: err?.message || err });
    return { alerts: [], health: { ...EMPTY_HEALTH }, error: String(err?.message || err) };
  }
}

/** Map DB row to camelCase for UI. */
export function mapTreasuryHealthRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    healthScore: row.health_score,
    treasuryRiskLevel: row.treasury_risk_level,
    confidenceScore: row.confidence_score,
    liquidityScore: row.liquidity_score,
    reconciliationScore: row.reconciliation_score,
    pendingObligationScore: row.pending_obligation_score,
    totalWalletLiabilities: toFiniteNumber(row.total_wallet_liabilities),
    totalFundingVolume24h: toFiniteNumber(row.total_funding_volume_24h),
    totalWithdrawVolume24h: toFiniteNumber(row.total_withdraw_volume_24h),
    totalSendVolume24h: toFiniteNumber(row.total_send_volume_24h),
    pendingWithdrawalExposure: toFiniteNumber(row.pending_withdrawal_exposure),
    failedFundingCount24h: row.failed_funding_count_24h,
    reconciliationMismatchCount: row.reconciliation_mismatch_count,
    anomalyCount: row.anomaly_count,
    reasons: row.reasons || [],
    sourceSnapshot: row.source_snapshot || {},
    createdAt: row.created_at,
  };
}
