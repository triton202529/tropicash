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

const RISK_RANK = Object.freeze({ low: 0, medium: 1, high: 2, critical: 3 });

const TREND_MIN_SNAPSHOTS = 3;
const TREND_HEALTH_DROP_WARNING = 10;
const TREND_HEALTH_DROP_HIGH = 20;
const TREND_GROWTH_WARNING_RATIO = 1.25;
const TREND_GROWTH_HIGH_RATIO = 1.5;
const TREND_MATERIALITY_OLD_MIN = 10;
const TREND_MATERIALITY_DELTA_MIN = 10;

const TREASURY_WARNING_TITLE_PREFIXES = Object.freeze(["Early warning signal —", "Treasury warning —"]);

/** Strip duplicated treasury warning label prefixes from a title string. */
export function normalizeTreasuryWarningTitle(title) {
  if (!title) return "";
  let normalized = String(title).trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of TREASURY_WARNING_TITLE_PREFIXES) {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.slice(prefix.length).trim();
        changed = true;
      }
    }
  }
  return normalized;
}

/** Single renderer format for treasury trend warning titles. */
export function formatTreasuryWarningTitle(signal) {
  const label = signal?.label || "Early warning signal";
  const title = normalizeTreasuryWarningTitle(signal?.title);
  return title ? `${label} — ${title}` : label;
}

const TREND_WARNING_TEMPLATES = Object.freeze({
  treasury_health_declining: {
    title: "Treasury health declining",
    message: "Health score dropped across recent snapshots. Monitor closely. Not an automatic action.",
  },
  payout_exposure_rising: {
    title: "Payout exposure rising",
    message: "Pending withdrawal exposure increased over the trend window. Monitor closely. Not an automatic action.",
  },
  liability_growth_detected: {
    title: "Liability growth detected",
    message: "Total wallet liabilities grew across recent snapshots. Not an automatic action.",
  },
  risk_level_worsening: {
    title: "Risk level worsening",
    message: "Treasury risk level moved to a higher band. Monitor closely. Not an automatic action.",
  },
  repeated_alert_pattern: {
    title: "Repeated alert pattern",
    message: "Medium or high severity alerts appeared in multiple recent snapshots. Monitor closely. Not an automatic action.",
  },
  repeated_alert_pattern_stable: {
    title: "Repeated alert pattern",
    message:
      "Similar treasury alerts appeared in multiple recent snapshots. Monitor for changes, but no worsening trend was detected.",
  },
  insufficient_snapshot_history: {
    title: "Limited snapshot history",
    message: "Fewer than three snapshots in the trend window — trend confidence is low. Not an automatic action.",
  },
});

function makeTrendWarning(code, severity, value, templateKey = code) {
  const template = TREND_WARNING_TEMPLATES[templateKey] || TREND_WARNING_TEMPLATES.insufficient_snapshot_history;
  return {
    code,
    severity,
    label: "Early warning signal",
    title: normalizeTreasuryWarningTitle(template.title),
    message: template.message,
    value,
  };
}

function riskRank(level) {
  return RISK_RANK[String(level || "low").toLowerCase()] ?? 0;
}

function pctGrowth(from, to) {
  const base = toFiniteNumber(from);
  const next = toFiniteNumber(to);
  if (base <= 0) return next > 0 ? 1 : 0;
  return (next - base) / base;
}

/** Positive delta is worsening (exposure/liabilities up). */
function isMaterialPositiveChange(oldValue, change) {
  const delta = toFiniteNumber(change);
  if (delta < TREND_MATERIALITY_DELTA_MIN) return false;
  const old = toFiniteNumber(oldValue);
  if (old >= TREND_MATERIALITY_OLD_MIN) {
    return delta / old >= TREND_GROWTH_WARNING_RATIO - 1;
  }
  return true;
}

/** Negative delta is improving (exposure/liabilities down). */
function isMaterialNegativeChange(oldValue, change) {
  return isMaterialPositiveChange(oldValue, -toFiniteNumber(change));
}

function computeTrendConfidence(rows) {
  if (!rows.length) return 0;
  let total = 0;
  for (const row of rows) {
    total += clamp(Math.round(Number(row.confidenceScore) || 50), 0, 100);
  }
  const avg = total / rows.length;
  const countFactor = Math.min(1, rows.length / 7);
  return clamp(Math.round(avg * countFactor), 0, 100);
}

function detectRepeatedAlerts(rows) {
  const codeCounts = new Map();
  for (const row of rows) {
    const seenInRow = new Set();
    for (const reason of row.reasons || []) {
      const code = reason?.code;
      if (!code || seenInRow.has(code)) continue;
      const template = ALERT_MAP[code];
      if (!template) continue;
      const sev = String(template.severity || "").toLowerCase();
      if (sev !== "medium" && sev !== "high" && sev !== "critical") continue;
      seenInRow.add(code);
      codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
    }
  }
  const repeated = [];
  for (const [code, count] of codeCounts.entries()) {
    if (count >= 2) repeated.push({ code, count });
  }
  repeated.sort((a, b) => b.count - a.count);
  return repeated;
}

function deriveTrendStatus({
  historyCount,
  healthScoreChange,
  riskDelta,
  liabilityChange,
  priorLiabilities,
  exposureChange,
  priorExposure,
  reconciliationScoreChange,
}) {
  if (historyCount < TREND_MIN_SNAPSHOTS) return "insufficient_data";

  const isWorsening =
    healthScoreChange <= -TREND_HEALTH_DROP_WARNING ||
    riskDelta > 0 ||
    isMaterialPositiveChange(priorExposure, exposureChange) ||
    isMaterialPositiveChange(priorLiabilities, liabilityChange) ||
    reconciliationScoreChange <= -TREND_HEALTH_DROP_WARNING;

  const isImproving =
    healthScoreChange >= TREND_HEALTH_DROP_WARNING ||
    riskDelta < 0 ||
    isMaterialNegativeChange(priorExposure, exposureChange) ||
    isMaterialNegativeChange(priorLiabilities, liabilityChange) ||
    reconciliationScoreChange >= TREND_HEALTH_DROP_WARNING;

  if (isWorsening && !isImproving) return "deteriorating";
  if (isImproving && !isWorsening) return "improving";
  return "stable";
}

function softenRepeatedAlertCopyIfStable(warningSignals, trendStatus) {
  if (trendStatus === "deteriorating") return warningSignals;
  const stableTemplate = TREND_WARNING_TEMPLATES.repeated_alert_pattern_stable;
  return warningSignals.map((signal) => {
    if (signal.code !== "repeated_alert_pattern") return signal;
    return {
      ...signal,
      title: normalizeTreasuryWarningTitle(stableTemplate.title),
      message: stableTemplate.message,
    };
  });
}

const EMPTY_TRENDS = {
  trendStatus: "insufficient_data",
  healthScoreChange: 0,
  liabilityChange: 0,
  exposureChange: 0,
  reconciliationScoreChange: 0,
  priorExposure: 0,
  priorLiabilities: 0,
  riskLevelChange: "unchanged",
  warningSignals: [],
  confidence: 0,
  historyCount: 0,
};

const FORECAST_SUMMARIES = Object.freeze({
  stable: "Stable treasury conditions expected under current trends.",
  elevated_pressure:
    "Withdrawal or treasury pressure may increase if recent conditions continue.",
  deteriorating: "Treasury deterioration risk is emerging from recent operating trends.",
  improving: "Treasury conditions appear to be improving.",
  insufficient_data:
    "Limited snapshot history — forecast confidence is low. Conditions appear unchanged.",
});

const EMPTY_FORECAST = {
  outlook: "stable",
  projectedRisk: "low",
  projectedLiabilities: "stable",
  projectedExposure: "stable",
  treasuryPressure: "low",
  confidence: 0,
  summary: FORECAST_SUMMARIES.insufficient_data,
  warnings: [],
};

function makeForecastWarning(message, code = "advisory") {
  return { code, severity: "low", message };
}

function deriveProjectedDirection(change, priorValue) {
  if (isMaterialPositiveChange(priorValue, change)) return "rising";
  if (isMaterialNegativeChange(priorValue, change)) return "declining";
  return "stable";
}

function computeForecastConfidence({ historyCount, trendConfidence, trendStatus, outlook }) {
  let base = 0;
  if (historyCount >= 7) base = 85;
  else if (historyCount >= 3) base = 50;
  else if (historyCount >= 1) base = 20;

  const trendBlend = Math.round(toFiniteNumber(trendConfidence) * 0.25);
  let score = base + trendBlend;

  if (historyCount >= 7 && trendStatus === "stable" && outlook === "stable") {
    score = Math.max(score, 80);
  }
  if (historyCount < TREND_MIN_SNAPSHOTS) {
    score = Math.min(score, 45);
  }
  if (trendStatus === "insufficient_data") {
    score = Math.min(score, 35);
  }

  return clamp(Math.round(score), 0, 100);
}

function hasRepeatedTreasuryAlerts(trends) {
  return (trends.warningSignals || []).some((s) => s.code === "repeated_alert_pattern");
}

function countWorseningForecastSignals(trends, reconciliationScoreChange) {
  let count = 0;
  if (trends.healthScoreChange <= -TREND_HEALTH_DROP_WARNING) count += 1;
  if (reconciliationScoreChange <= -TREND_HEALTH_DROP_WARNING) count += 1;
  if (isMaterialPositiveChange(trends.priorExposure, trends.exposureChange)) count += 1;
  if (isMaterialPositiveChange(trends.priorLiabilities, trends.liabilityChange)) count += 1;
  const riskChange = String(trends.riskLevelChange || "");
  if (riskChange !== "unchanged") {
    const parts = riskChange.split("_to_");
    if (parts.length === 2 && riskRank(parts[1]) > riskRank(parts[0])) count += 1;
  }
  return count;
}

function deriveForecastOutlook(trends, reconciliationScoreChange) {
  const historyCount = trends.historyCount || 0;
  const trendStatus = trends.trendStatus || "insufficient_data";
  const worseningCount = countWorseningForecastSignals(trends, reconciliationScoreChange);
  const healthFallingMaterially = trends.healthScoreChange <= -TREND_HEALTH_DROP_WARNING;
  const reconciliationWorseningMaterially = reconciliationScoreChange <= -TREND_HEALTH_DROP_WARNING;
  const exposureRising = isMaterialPositiveChange(trends.priorExposure, trends.exposureChange);
  const liabilitiesRising = isMaterialPositiveChange(trends.priorLiabilities, trends.liabilityChange);

  const isDeteriorating =
    trends.healthScoreChange <= -TREND_HEALTH_DROP_HIGH ||
    reconciliationScoreChange <= -TREND_HEALTH_DROP_HIGH ||
    worseningCount >= 2 ||
    (trendStatus === "deteriorating" && (healthFallingMaterially || reconciliationWorseningMaterially));

  const isElevatedPressure = exposureRising || liabilitiesRising;

  const isImproving =
    trendStatus === "improving" &&
    !isDeteriorating &&
    (trends.healthScoreChange >= TREND_HEALTH_DROP_WARNING ||
      isMaterialNegativeChange(trends.priorExposure, trends.exposureChange) ||
      isMaterialNegativeChange(trends.priorLiabilities, trends.liabilityChange) ||
      reconciliationScoreChange >= TREND_HEALTH_DROP_WARNING);

  if (isDeteriorating) return "deteriorating";
  if (isImproving) return "improving";
  if (isElevatedPressure) return "elevated_pressure";
  if (trendStatus === "stable" || historyCount >= TREND_MIN_SNAPSHOTS) return "stable";
  return "stable";
}

function outlookToProjectedRisk(outlook, trends) {
  if (outlook === "deteriorating") {
    const severe =
      trends.healthScoreChange <= -TREND_HEALTH_DROP_HIGH ||
      countWorseningForecastSignals(trends, trends.reconciliationScoreChange) >= 3;
    return severe ? "high" : "elevated";
  }
  if (outlook === "elevated_pressure") return "medium";
  if (outlook === "improving") return "low";
  return "low";
}

function outlookToTreasuryPressure(outlook) {
  if (outlook === "deteriorating") return "elevated";
  if (outlook === "elevated_pressure") return "moderate";
  return "low";
}

function buildForecastWarnings(trends, outlook, reconciliationScoreChange) {
  const warnings = [];

  if (trends.historyCount < TREND_MIN_SNAPSHOTS) {
    warnings.push(
      makeForecastWarning(
        "Fewer than three snapshots in the forecast window — treat projections as indicative only.",
        "limited_history",
      ),
    );
  }

  if (hasRepeatedTreasuryAlerts(trends)) {
    warnings.push(
      makeForecastWarning(
        "Similar treasury alerts appeared across recent snapshots. This is informational — monitor for changes.",
        "repeated_alerts",
      ),
    );
  }

  const hasNonMaterialChange =
    (trends.liabilityChange !== 0 || trends.exposureChange !== 0) &&
    !isMaterialPositiveChange(trends.priorExposure, trends.exposureChange) &&
    !isMaterialPositiveChange(trends.priorLiabilities, trends.liabilityChange);
  if (outlook === "stable" && hasNonMaterialChange) {
    warnings.push(
      makeForecastWarning(
        "Small liability or exposure changes were observed but did not meet materiality thresholds for a trend shift.",
        "immaterial_change",
      ),
    );
  }

  if (reconciliationScoreChange <= -TREND_HEALTH_DROP_WARNING && outlook !== "deteriorating") {
    warnings.push(
      makeForecastWarning(
        "Reconciliation score softened across the window. Continue routine monitoring.",
        "reconciliation_softening",
      ),
    );
  }

  if (outlook === "elevated_pressure" || outlook === "deteriorating") {
    for (const signal of trends.warningSignals || []) {
      if (signal.code === "insufficient_snapshot_history") continue;
      if (signal.code === "repeated_alert_pattern" && warnings.some((w) => w.code === "repeated_alerts")) {
        continue;
      }
      warnings.push(
        makeForecastWarning(`${signal.title}: ${signal.message}`, `trend_${signal.code}`),
      );
    }
  }

  return warnings;
}

/**
 * Analyze treasury health snapshot trends (read-only).
 * @param {{ days?: number }} [opts]
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient]
 */
export async function calculateTreasuryTrends({ days = 7 } = {}, supabaseClient = defaultClient) {
  const client = supabaseClient || defaultClient;
  if (!client) return { ...EMPTY_TRENDS };

  const windowDays = Math.min(90, Math.max(1, Number(days) || 7));
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await client
      .from("treasury_health_snapshots")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      if (isMissingTable(error, "treasury_health_snapshots")) {
        return {
          ...EMPTY_TRENDS,
          warningSignals: [
            makeTrendWarning("insufficient_snapshot_history", "low", { historyCount: 0, windowDays }),
          ],
        };
      }
      warn({ op: "calculateTreasuryTrends", err: error.message });
      return { ...EMPTY_TRENDS };
    }

    const rows = (data || []).map(mapTreasuryHealthRow).filter(Boolean);
    const historyCount = rows.length;
    const confidence = computeTrendConfidence(rows);

    if (historyCount < TREND_MIN_SNAPSHOTS) {
      return {
        trendStatus: "insufficient_data",
        healthScoreChange: 0,
        liabilityChange: 0,
        exposureChange: 0,
        reconciliationScoreChange: 0,
        priorExposure: 0,
        priorLiabilities: 0,
        riskLevelChange: "unchanged",
        warningSignals: [
          makeTrendWarning("insufficient_snapshot_history", "low", { historyCount, windowDays }),
        ],
        confidence,
        historyCount,
      };
    }

    const newest = rows[0];
    const oldest = rows[rows.length - 1];

    const healthScoreChange = Math.round((newest.healthScore || 0) - (oldest.healthScore || 0));
    const liabilityChange = toFiniteNumber(newest.totalWalletLiabilities) - toFiniteNumber(oldest.totalWalletLiabilities);
    const exposureChange =
      toFiniteNumber(newest.pendingWithdrawalExposure) - toFiniteNumber(oldest.pendingWithdrawalExposure);
    const reconciliationScoreChange = Math.round(
      (newest.reconciliationScore || 0) - (oldest.reconciliationScore || 0),
    );

    const fromRisk = oldest.treasuryRiskLevel;
    const toRisk = newest.treasuryRiskLevel;
    const riskDelta = riskRank(toRisk) - riskRank(fromRisk);
    let riskLevelChange = "unchanged";
    if (riskDelta > 0) riskLevelChange = `${fromRisk}_to_${toRisk}`;
    else if (riskDelta < 0) riskLevelChange = `${fromRisk}_to_${toRisk}`;

    const priorExposure = toFiniteNumber(oldest.pendingWithdrawalExposure);
    const currentExposure = toFiniteNumber(newest.pendingWithdrawalExposure);
    const priorLiabilities = toFiniteNumber(oldest.totalWalletLiabilities);
    const currentLiabilities = toFiniteNumber(newest.totalWalletLiabilities);
    const exposureGrowth = pctGrowth(priorExposure, currentExposure);
    const liabilityGrowth = pctGrowth(priorLiabilities, currentLiabilities);

    const warningSignals = [];

    if (healthScoreChange <= -TREND_HEALTH_DROP_HIGH) {
      warningSignals.push(
        makeTrendWarning("treasury_health_declining", "high", {
          change: healthScoreChange,
          from: oldest.healthScore,
          to: newest.healthScore,
          windowDays,
        }),
      );
    } else if (healthScoreChange <= -TREND_HEALTH_DROP_WARNING) {
      warningSignals.push(
        makeTrendWarning("treasury_health_declining", "medium", {
          change: healthScoreChange,
          from: oldest.healthScore,
          to: newest.healthScore,
          windowDays,
        }),
      );
    }

    if (isMaterialPositiveChange(priorExposure, exposureChange)) {
      const severity =
        priorExposure >= TREND_MATERIALITY_OLD_MIN && exposureGrowth >= TREND_GROWTH_HIGH_RATIO - 1
          ? "high"
          : "medium";
      warningSignals.push(
        makeTrendWarning("payout_exposure_rising", severity, {
          change: exposureChange,
          growthPct: Math.round(exposureGrowth * 100),
          from: priorExposure,
          to: currentExposure,
          windowDays,
        }),
      );
    }

    if (isMaterialPositiveChange(priorLiabilities, liabilityChange)) {
      const severity =
        priorLiabilities >= TREND_MATERIALITY_OLD_MIN && liabilityGrowth >= TREND_GROWTH_HIGH_RATIO - 1
          ? "high"
          : "medium";
      warningSignals.push(
        makeTrendWarning("liability_growth_detected", severity, {
          change: liabilityChange,
          growthPct: Math.round(liabilityGrowth * 100),
          from: priorLiabilities,
          to: currentLiabilities,
          windowDays,
        }),
      );
    }

    if (riskDelta > 0) {
      const severity =
        riskDelta >= 2 || (fromRisk === "low" && (toRisk === "high" || toRisk === "critical"))
          ? "high"
          : "medium";
      warningSignals.push(
        makeTrendWarning("risk_level_worsening", severity, {
          from: fromRisk,
          to: toRisk,
          windowDays,
        }),
      );
    }

    const repeatedAlerts = detectRepeatedAlerts(rows);
    if (repeatedAlerts.length > 0) {
      const top = repeatedAlerts[0];
      const severity = top.count >= 3 ? "high" : "medium";
      warningSignals.push(
        makeTrendWarning("repeated_alert_pattern", severity, {
          codes: repeatedAlerts.slice(0, 5),
          windowDays,
        }),
      );
    }

    warningSignals.sort((a, b) => {
      const rank = { critical: 0, high: 1, medium: 2, low: 3 };
      return (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9);
    });

    const trendStatus = deriveTrendStatus({
      historyCount,
      healthScoreChange,
      riskDelta,
      liabilityChange,
      priorLiabilities,
      exposureChange,
      priorExposure,
      reconciliationScoreChange,
    });

    const finalWarningSignals = softenRepeatedAlertCopyIfStable(warningSignals, trendStatus);

    return {
      trendStatus,
      healthScoreChange,
      liabilityChange,
      exposureChange,
      reconciliationScoreChange,
      priorExposure,
      priorLiabilities,
      riskLevelChange,
      warningSignals: finalWarningSignals,
      confidence,
      historyCount,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryTrends", err: err?.message || err });
    return { ...EMPTY_TRENDS };
  }
}

/**
 * Conservative treasury operational outlook from snapshot trends (read-only).
 * @param {{ days?: number, trends?: object }} [opts]
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient]
 */
export async function calculateTreasuryForecast({ days = 7, trends: precomputedTrends } = {}, supabaseClient = defaultClient) {
  try {
    const trends = precomputedTrends || (await calculateTreasuryTrends({ days }, supabaseClient));
    const reconciliationScoreChange = trends.reconciliationScoreChange ?? 0;
    const outlook = deriveForecastOutlook(trends, reconciliationScoreChange);
    const projectedLiabilities = deriveProjectedDirection(trends.liabilityChange, trends.priorLiabilities);
    const projectedExposure = deriveProjectedDirection(trends.exposureChange, trends.priorExposure);
    const projectedRisk = outlookToProjectedRisk(outlook, trends);
    const treasuryPressure = outlookToTreasuryPressure(outlook);
    const confidence = computeForecastConfidence({
      historyCount: trends.historyCount,
      trendConfidence: trends.confidence,
      trendStatus: trends.trendStatus,
      outlook,
    });
    const summaryKey =
      trends.historyCount < TREND_MIN_SNAPSHOTS && outlook === "stable"
        ? "insufficient_data"
        : outlook;
    const summary = FORECAST_SUMMARIES[summaryKey] || FORECAST_SUMMARIES.stable;
    const warnings = buildForecastWarnings(trends, outlook, reconciliationScoreChange);

    return {
      outlook,
      projectedRisk,
      projectedLiabilities,
      projectedExposure,
      treasuryPressure,
      confidence,
      summary,
      warnings,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryForecast", err: err?.message || err });
    return { ...EMPTY_FORECAST };
  }
}

const SCENARIO_MATERIALITY_EXPOSURE_MAX = 10;
const SCENARIO_MATERIALITY_LIABILITY_MAX = 25;

const EMPTY_SCENARIOS = {
  scenarioConfidence: 0,
  baseline: {
    healthScore: 100,
    treasuryRiskLevel: "low",
    walletLiabilities: 0,
    pendingWithdrawalExposure: 0,
    liquidityScore: 100,
    reconciliationScore: 100,
  },
  scenarios: [],
  summary: "Scenario analysis unavailable — insufficient treasury data.",
};

function isSmallDollarScenarioEnvironment(exposure, liabilities) {
  return (
    toFiniteNumber(exposure) < SCENARIO_MATERIALITY_EXPOSURE_MAX &&
    toFiniteNumber(liabilities) < SCENARIO_MATERIALITY_LIABILITY_MAX
  );
}

function exposureLiabilityRatio(exposure, liabilities) {
  const liab = toFiniteNumber(liabilities);
  const exp = toFiniteNumber(exposure);
  if (liab <= 0) return exp > 0 ? 1 : 0;
  return exp / liab;
}

function deriveScenarioPressure({ scoreDrop, projectedScore, isSmallDollar, scenarioKey }) {
  if (isSmallDollar) {
    if (scenarioKey === "combined_stress") return "moderate";
    return "low";
  }
  if (scoreDrop >= 25 || projectedScore < 40) return "severe";
  if (scoreDrop >= 15 || projectedScore < 60) return "elevated";
  if (scoreDrop >= 8 || projectedScore < 80) return "moderate";
  return "low";
}

function deriveScenarioSeverity(scoreDrop, isSmallDollar) {
  if (isSmallDollar) return "low";
  if (scoreDrop >= 25) return "high";
  if (scoreDrop >= 12) return "medium";
  return "low";
}

function computeScenarioScoreDrop({
  minDrop,
  maxDrop,
  isMaterial,
  isSmallDollar,
  exposureRatio,
  liquidityScore,
  reconciliationScore,
  trendWeakness,
  forecastWeakness,
  hasLiquidityAlert,
}) {
  if (!isMaterial) return 0;
  if (isSmallDollar) return clamp(Math.round(minDrop * 0.2), 0, 3);

  let drop = minDrop + (maxDrop - minDrop) * 0.5;

  if (exposureRatio >= 0.25) drop += 3;
  if (exposureRatio >= 0.5) drop += 4;
  if (liquidityScore < 80) drop += 3;
  if (reconciliationScore < 80) drop += 3;
  if (hasLiquidityAlert) drop += 2;
  if (trendWeakness) drop += 4;
  if (forecastWeakness) drop += 4;

  return clamp(Math.round(drop), minDrop, maxDrop);
}

function hasLiquidityPressureAlert(health) {
  return (health?.reasons || []).some(
    (r) => r.code === "liquidity_pressure" || r.code === "high_payout_pressure" || r.code === "large_pending_obligations",
  );
}

function computeScenarioConfidence({ health, trends, forecast, historyCount, hasLatestSnapshot }) {
  let score = clamp(Math.round(Number(health?.confidenceScore) || 50), 0, 100);

  if (hasLatestSnapshot) score += 10;
  if (historyCount >= 7) score += 10;
  else if (historyCount >= 3) score += 5;

  const trendConf = clamp(Math.round(Number(trends?.confidence) || 0), 0, 100);
  const forecastConf = clamp(Math.round(Number(forecast?.confidence) || 0), 0, 100);
  score = Math.round(score * 0.5 + (trendConf + forecastConf) * 0.25);

  if (trends?.trendStatus === "insufficient_data") score = Math.min(score, 55);
  if (isSmallDollarScenarioEnvironment(
    health?.sourceSnapshot?.metrics?.pendingWithdrawalExposure,
    health?.sourceSnapshot?.metrics?.totalWalletLiabilities,
  )) {
    score = Math.max(score, 75);
  }

  return clamp(score, 0, 100);
}

function buildScenario({
  key,
  label,
  baseHealthScore,
  minDrop,
  maxDrop,
  ctx,
  assumptions,
  summaryMaterial,
  summarySmallDollar,
}) {
  const { isMaterial, isSmallDollar, exposureRatio, liquidityScore, reconciliationScore, trendWeakness, forecastWeakness, hasLiquidityAlert } = ctx;

  const scoreDrop = computeScenarioScoreDrop({
    minDrop,
    maxDrop,
    isMaterial,
    isSmallDollar,
    exposureRatio,
    liquidityScore,
    reconciliationScore,
    trendWeakness,
    forecastWeakness,
    hasLiquidityAlert,
  });

  const projectedHealthScore = clamp(Math.round(baseHealthScore - scoreDrop), 0, 100);
  const projectedRiskLevel = healthScoreToRiskLevel(projectedHealthScore);
  const projectedPressure = deriveScenarioPressure({
    scoreDrop,
    projectedScore: projectedHealthScore,
    isSmallDollar,
    scenarioKey: key,
  });
  const severity = deriveScenarioSeverity(scoreDrop, isSmallDollar);

  const warnings = [];
  if (isSmallDollar) {
    warnings.push(
      "Small-dollar test environment — dollar amounts are below materiality thresholds. Projections are advisory only.",
    );
  }
  if (trendWeakness) {
    warnings.push("Recent snapshot trends show softening — scenario impact may be slightly amplified.");
  }
  if (forecastWeakness) {
    warnings.push("Forecast outlook is not fully stable — treat scenario deltas as indicative.");
  }
  if (reconciliationScore < 80) {
    warnings.push("Reconciliation score is below optimal — monitor ledger signals alongside exposure shifts.");
  }
  if (hasLiquidityAlert) {
    warnings.push("Active liquidity or payout pressure alerts present — withdrawal spikes would add incremental stress.");
  }

  const summary = isSmallDollar ? summarySmallDollar : summaryMaterial;

  return {
    key,
    label,
    severity,
    projectedHealthScore,
    projectedRiskLevel,
    projectedPressure,
    assumptions,
    warnings,
    summary,
  };
}

/**
 * What-if treasury scenarios from current health, trends, and forecast (read-only).
 * @param {{ days?: number, trends?: object, forecast?: object, health?: object }} [opts]
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient]
 */
export async function calculateTreasuryScenarios(
  { days = 7, trends: precomputedTrends, forecast: precomputedForecast, health: precomputedHealth } = {},
  supabaseClient = defaultClient,
) {
  const client = supabaseClient || defaultClient;
  if (!client) return { ...EMPTY_SCENARIOS };

  try {
    const [health, latestResult, trends] = await Promise.all([
      precomputedHealth || calculateTreasuryHealth(client),
      fetchLatestTreasuryHealth(client),
      precomputedTrends || calculateTreasuryTrends({ days }, client),
    ]);

    const resolvedForecast =
      precomputedForecast || (await calculateTreasuryForecast({ days, trends }, client));

    const metrics = health?.sourceSnapshot?.metrics || {};
    const walletLiabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const pendingWithdrawalExposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const baseHealthScore = clamp(Math.round(Number(health?.healthScore) || 100), 0, 100);

    const baseline = {
      healthScore: baseHealthScore,
      treasuryRiskLevel: health?.treasuryRiskLevel || healthScoreToRiskLevel(baseHealthScore),
      walletLiabilities,
      pendingWithdrawalExposure,
      liquidityScore: clamp(Math.round(Number(health?.liquidityScore) || 100), 0, 100),
      reconciliationScore: clamp(Math.round(Number(health?.reconciliationScore) || 100), 0, 100),
    };

    const isSmallDollar = isSmallDollarScenarioEnvironment(pendingWithdrawalExposure, walletLiabilities);
    const exposureRatio = exposureLiabilityRatio(pendingWithdrawalExposure, walletLiabilities);
    const isMaterial = !isSmallDollar;

    const trendWeakness =
      trends?.trendStatus === "deteriorating" ||
      (trends?.healthScoreChange ?? 0) <= -TREND_HEALTH_DROP_WARNING ||
      isMaterialPositiveChange(trends?.priorExposure, trends?.exposureChange);

    const forecastWeakness =
      resolvedForecast?.outlook === "deteriorating" ||
      resolvedForecast?.outlook === "elevated_pressure" ||
      resolvedForecast?.treasuryPressure === "elevated" ||
      resolvedForecast?.treasuryPressure === "moderate";

    const ctx = {
      isMaterial,
      isSmallDollar,
      exposureRatio,
      liquidityScore: baseline.liquidityScore,
      reconciliationScore: baseline.reconciliationScore,
      trendWeakness,
      forecastWeakness,
      hasLiquidityAlert: hasLiquidityPressureAlert(health),
    };

    const scenarios = [
      buildScenario({
        key: "mild_withdrawal_spike",
        label: "Mild withdrawal spike",
        baseHealthScore,
        minDrop: 5,
        maxDrop: 10,
        ctx,
        assumptions: [
          "Pending withdrawal exposure increases by 25% from current levels.",
          "Funding inflow and liabilities remain unchanged.",
        ],
        summaryMaterial:
          "A modest increase in pending withdrawals would apply light pressure. Health score may soften slightly if exposure is material.",
        summarySmallDollar:
          "A 25% exposure increase stays within small-dollar bounds. Health score impact is negligible — routine monitoring is sufficient.",
      }),
      buildScenario({
        key: "moderate_withdrawal_spike",
        label: "Moderate withdrawal spike",
        baseHealthScore,
        minDrop: 10,
        maxDrop: 20,
        ctx,
        assumptions: [
          "Pending withdrawal exposure increases by 50% from current levels.",
          "No compensating funding inflow assumed.",
        ],
        summaryMaterial:
          "A 50% exposure increase could reduce health score moderately. Risk may shift one band if liabilities are small relative to the spike.",
        summarySmallDollar:
          "Even a 50% exposure increase remains below materiality thresholds in this small-dollar environment. Advisory only — no elevated risk expected.",
      }),
      buildScenario({
        key: "severe_withdrawal_spike",
        label: "Severe withdrawal spike",
        baseHealthScore,
        minDrop: 15,
        maxDrop: 30,
        ctx,
        assumptions: [
          "Pending withdrawal exposure doubles from current levels.",
          "Liabilities and funding volume held constant.",
        ],
        summaryMaterial:
          "Doubling pending exposure would meaningfully increase payout pressure. Health score reduction is more pronounced when exposure is large relative to liabilities.",
        summarySmallDollar:
          "Doubling small-dollar exposure (e.g. $2 → $4) does not constitute severe operational stress. Scenario remains informational.",
      }),
      buildScenario({
        key: "funding_slowdown",
        label: "Funding slowdown",
        baseHealthScore,
        minDrop: 5,
        maxDrop: 15,
        ctx: {
          ...ctx,
          isMaterial: isMaterial && pendingWithdrawalExposure > 0,
        },
        assumptions: [
          "24-hour funding volume drops materially (roughly 40–60%) while pending exposure remains.",
          "Withdrawal queue unchanged.",
        ],
        summaryMaterial:
          pendingWithdrawalExposure > 0
            ? "Reduced funding inflow with unchanged payout exposure would soften liquidity buffers. Impact scales with existing exposure."
            : "With minimal pending exposure, a funding slowdown has limited treasury impact under current conditions.",
        summarySmallDollar:
          "Funding slowdown in a small-dollar test environment with minimal exposure is unlikely to affect operational health.",
      }),
      buildScenario({
        key: "combined_stress",
        label: "Combined stress",
        baseHealthScore,
        minDrop: 20,
        maxDrop: 40,
        ctx,
        assumptions: [
          "Pending withdrawal exposure doubles and funding inflow weakens materially.",
          "Represents the highest plausible combined stress in this window.",
        ],
        summaryMaterial:
          "Simultaneous exposure doubling and funding weakness represents the strongest stress case. Health score may decline meaningfully if conditions are material.",
        summarySmallDollar:
          "Combined stress in a small-dollar test environment would produce at most mild/moderate advisory pressure — not operational alarm.",
      }),
    ];

    const historyCount = trends?.historyCount || 0;
    const scenarioConfidence = computeScenarioConfidence({
      health,
      trends,
      forecast: resolvedForecast,
      historyCount,
      hasLatestSnapshot: Boolean(latestResult?.data),
    });

    let summary;
    if (isSmallDollar) {
      summary =
        "Treasury scenarios run against a small-dollar test environment. All projections remain low-risk and advisory — dollar amounts are below materiality thresholds.";
    } else if (baseline.treasuryRiskLevel === "low" && trends?.trendStatus === "stable") {
      summary =
        "Baseline treasury health is strong with stable trends. Scenario projections indicate manageable pressure bands under modeled withdrawal and funding shifts.";
    } else if (trendWeakness || forecastWeakness) {
      summary =
        "Baseline health reflects some softening signals. Scenario analysis suggests monitoring withdrawal spikes and funding pace — projections are advisory, not automated actions.";
    } else {
      summary =
        "Scenario analysis models withdrawal spikes and funding slowdowns from current baseline. Use projections for planning and monitoring — no treasury mutations are triggered.";
    }

    return {
      scenarioConfidence,
      baseline,
      scenarios,
      summary,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryScenarios", err: err?.message || err });
    return { ...EMPTY_SCENARIOS };
  }
}

const EMPTY_RESILIENCE = {
  resilienceScore: 100,
  resilienceLevel: "resilient",
  liquidityBufferScore: 100,
  survivabilityScore: 100,
  recoveryDifficulty: "easy",
  runwayEstimate: "stable",
  treasuryTolerance: "high",
  confidence: 0,
  summary: "Treasury resilience analysis unavailable — insufficient data.",
  warnings: [],
};

function isSmallDollarResilienceEnvironment(exposure, liabilities) {
  return isSmallDollarScenarioEnvironment(exposure, liabilities);
}

function resilienceScoreToLevel(score) {
  const s = clamp(Math.round(Number(score) || 0), 0, 100);
  if (s >= 85) return "resilient";
  if (s >= 70) return "strong";
  if (s >= 50) return "moderate";
  return "weak";
}

function computeLiquidityBufferScore({ liquidityScore, exposureRatio, pendingObligationScore, isSmallDollar }) {
  let score = clamp(Math.round(Number(liquidityScore) || 100), 0, 100);
  score = Math.round(score * 0.55 + clamp(Math.round(Number(pendingObligationScore) || 100), 0, 100) * 0.25);

  if (isSmallDollar) {
    score = Math.max(score, 85);
  } else if (exposureRatio >= 0.5) {
    score = clamp(score - 20, 0, 100);
  } else if (exposureRatio >= 0.25) {
    score = clamp(score - 10, 0, 100);
  }

  return clamp(score, 0, 100);
}

function computeSurvivabilityScore({
  healthScore,
  exposureRatio,
  liquidityScore,
  reconciliationScore,
  isSmallDollar,
  hasLiquidityAlert,
  trendStatus,
  forecastOutlook,
}) {
  if (isSmallDollar && healthScore >= 80) {
    return clamp(Math.max(85, healthScore - 5), 80, 100);
  }

  let score;
  if (exposureRatio < 0.15 && healthScore >= 80 && liquidityScore >= 80 && reconciliationScore >= 80) {
    score = clamp(80 + Math.round((healthScore - 80) * 0.5), 80, 100);
  } else if (exposureRatio < 0.35 && healthScore >= 60) {
    score = clamp(50 + Math.round((healthScore - 60) * 1.0), 50, 80);
  } else if (hasLiquidityAlert || exposureRatio >= 0.35 || healthScore < 60) {
    score = clamp(20 + Math.round(healthScore * 0.3), 20, 50);
  } else {
    score = clamp(50 + Math.round(healthScore * 0.25), 50, 80);
  }

  if (trendStatus === "deteriorating") score = clamp(score - 8, 0, 100);
  if (forecastOutlook === "deteriorating") score = clamp(score - 10, 0, 100);
  if (forecastOutlook === "elevated_pressure") score = clamp(score - 5, 0, 100);
  if (reconciliationScore < 70) score = clamp(score - 8, 0, 100);

  return clamp(score, 0, 100);
}

function deriveRecoveryDifficulty({ survivabilityScore, isSmallDollar, trendStatus, forecastOutlook }) {
  if (isSmallDollar) {
    if (trendStatus === "deteriorating" || forecastOutlook === "deteriorating") return "manageable";
    return "easy";
  }
  if (survivabilityScore >= 80) return "easy";
  if (survivabilityScore >= 60) return "manageable";
  if (survivabilityScore >= 35) return "difficult";
  return "severe";
}

function deriveRunwayEstimate({ healthScore, trendStatus, forecastOutlook, trends, isSmallDollar }) {
  if (isSmallDollar && healthScore >= 80 && trendStatus !== "deteriorating") {
    return "stable";
  }

  const healthFalling = (trends?.healthScoreChange ?? 0) <= -TREND_HEALTH_DROP_HIGH;
  const reconciliationFalling = (trends?.reconciliationScoreChange ?? 0) <= -TREND_HEALTH_DROP_HIGH;
  const persistentDeterioration =
    trendStatus === "deteriorating" &&
    (healthFalling || reconciliationFalling || forecastOutlook === "deteriorating");

  if (persistentDeterioration && healthScore < 50) return "long_term_pressure";
  if (persistentDeterioration || forecastOutlook === "deteriorating") return "medium_term_pressure";
  if (
    trendStatus === "deteriorating" ||
    forecastOutlook === "elevated_pressure" ||
    (trends?.healthScoreChange ?? 0) <= -TREND_HEALTH_DROP_WARNING
  ) {
    return "short_term_pressure";
  }
  if (healthScore >= 70 && (trendStatus === "stable" || trendStatus === "improving")) return "stable";
  if (healthScore >= 50) return "short_term_pressure";
  return "medium_term_pressure";
}

function deriveTreasuryTolerance({
  healthScore,
  liquidityBufferScore,
  survivabilityScore,
  isSmallDollar,
  trendStatus,
  forecastOutlook,
  exposureRatio,
}) {
  if (isSmallDollar) {
    if (healthScore >= 80 && trendStatus !== "deteriorating") return "high";
    return "moderate";
  }

  let score = Math.round(healthScore * 0.35 + liquidityBufferScore * 0.35 + survivabilityScore * 0.3);

  if (trendStatus === "improving") score += 8;
  if (trendStatus === "deteriorating") score -= 12;
  if (forecastOutlook === "deteriorating") score -= 10;
  if (forecastOutlook === "elevated_pressure") score -= 5;
  if (exposureRatio >= 0.35) score -= 10;

  score = clamp(score, 0, 100);
  if (score >= 70) return "high";
  if (score >= 45) return "moderate";
  return "low";
}

function countScenarioDeteriorationSignals(scenarios) {
  const list = scenarios?.scenarios || [];
  let elevated = 0;
  let severe = 0;
  for (const s of list) {
    const pressure = String(s.projectedPressure || "").toLowerCase();
    if (pressure === "severe") severe += 1;
    else if (pressure === "elevated" || pressure === "moderate") elevated += 1;
  }
  return { elevated, severe };
}

function computeResilienceConfidence({ health, trends, forecast, scenarios, historyCount, hasLatestSnapshot }) {
  let score = clamp(Math.round(Number(health?.confidenceScore) || 50), 0, 100);

  if (hasLatestSnapshot) score += 8;
  if (historyCount >= 7) score += 10;
  else if (historyCount >= 3) score += 5;

  const trendConf = clamp(Math.round(Number(trends?.confidence) || 0), 0, 100);
  const forecastConf = clamp(Math.round(Number(forecast?.confidence) || 0), 0, 100);
  const scenarioConf = clamp(Math.round(Number(scenarios?.scenarioConfidence) || 0), 0, 100);
  score = Math.round(score * 0.4 + (trendConf + forecastConf + scenarioConf) / 3 * 0.6);

  if (trends?.trendStatus === "insufficient_data") score = Math.min(score, 55);
  if (isSmallDollarResilienceEnvironment(
    health?.sourceSnapshot?.metrics?.pendingWithdrawalExposure,
    health?.sourceSnapshot?.metrics?.totalWalletLiabilities,
  )) {
    score = Math.max(score, 70);
  }

  return clamp(score, 0, 100);
}

function buildResilienceSummary({
  resilienceLevel,
  isSmallDollar,
  trendStatus,
  forecastOutlook,
  runwayEstimate,
}) {
  if (isSmallDollar && (resilienceLevel === "resilient" || resilienceLevel === "strong")) {
    return "Treasury appears resilient under current operating conditions.";
  }
  if (resilienceLevel === "resilient") {
    return "Treasury appears resilient under current operating conditions.";
  }
  if (resilienceLevel === "strong") {
    return "Treasury resilience is strong. Routine monitoring remains appropriate under current trends.";
  }
  if (resilienceLevel === "moderate") {
    if (runwayEstimate === "short_term_pressure") {
      return "Treasury resilience is moderate. Pressure may emerge if recent trends persist — continue advisory monitoring.";
    }
    return "Treasury resilience is moderate. Some softening signals are present — advisory monitoring recommended.";
  }
  if (trendStatus === "deteriorating" || forecastOutlook === "deteriorating") {
    return "Treasury resilience is reduced. Sustained deterioration signals warrant closer advisory review — no automated actions.";
  }
  return "Treasury resilience is limited relative to current exposure and trend signals. Advisory review recommended.";
}

function buildResilienceWarnings({
  isSmallDollar,
  trends,
  forecast,
  scenarios,
  health,
  runwayEstimate,
  recoveryDifficulty,
}) {
  const warnings = [];

  if (isSmallDollar) {
    warnings.push({
      code: "small_dollar_environment",
      severity: "low",
      message: "Small-dollar testing environment detected; resilience results remain advisory.",
    });
  }

  if (trends?.historyCount < TREND_MIN_SNAPSHOTS) {
    warnings.push({
      code: "limited_history",
      severity: "low",
      message: "Fewer than three snapshots in the resilience window — treat assessments as indicative only.",
    });
  }

  if (trends?.trendStatus === "deteriorating" && !isSmallDollar) {
    warnings.push({
      code: "deteriorating_trends",
      severity: "medium",
      message: "Snapshot trends show softening across the window. Monitor payout exposure and reconciliation signals.",
    });
  }

  if (forecast?.outlook === "elevated_pressure" || forecast?.outlook === "deteriorating") {
    const msg = isSmallDollar
      ? "Forecast outlook is not fully stable — treat resilience projections as advisory in this small-dollar environment."
      : "Forecast outlook suggests elevated operational pressure if current conditions continue.";
    warnings.push({
      code: "forecast_pressure",
      severity: isSmallDollar ? "low" : "medium",
      message: msg,
    });
  }

  if (forecast?.confidence < 50) {
    warnings.push({
      code: "low_forecast_confidence",
      severity: "low",
      message: "Forecast confidence is limited — resilience estimates carry higher uncertainty.",
    });
  }

  const { elevated, severe } = countScenarioDeteriorationSignals(scenarios);
  if (severe > 0 && !isSmallDollar) {
    warnings.push({
      code: "scenario_stress",
      severity: "medium",
      message: "Scenario analysis indicates meaningful stress under modeled withdrawal shifts. Projections are advisory only.",
    });
  } else if (elevated >= 2 && !isSmallDollar) {
    warnings.push({
      code: "scenario_pressure",
      severity: "low",
      message: "Multiple scenarios project elevated pressure bands — continue routine monitoring.",
    });
  }

  if (hasLiquidityPressureAlert(health) && !isSmallDollar) {
    warnings.push({
      code: "liquidity_alerts",
      severity: "medium",
      message: "Active liquidity or payout pressure alerts are present — sustained pressure would reduce resilience buffers.",
    });
  }

  if (runwayEstimate === "short_term_pressure" && !isSmallDollar) {
    warnings.push({
      code: "short_term_runway",
      severity: "low",
      message: "Short-term pressure may emerge if current trends persist. No automated treasury actions are triggered.",
    });
  } else if (runwayEstimate === "medium_term_pressure" && !isSmallDollar) {
    warnings.push({
      code: "medium_term_runway",
      severity: "medium",
      message: "Sustained deterioration is visible across trends and forecast — advisory review recommended.",
    });
  } else if (runwayEstimate === "long_term_pressure" && !isSmallDollar) {
    warnings.push({
      code: "long_term_runway",
      severity: "medium",
      message: "Persistent treasury softening signals are present. Continue close advisory monitoring.",
    });
  }

  if (recoveryDifficulty === "difficult" && !isSmallDollar) {
    warnings.push({
      code: "recovery_difficulty",
      severity: "medium",
      message: "Recovery from sustained pressure would require meaningful operational adjustment — advisory assessment only.",
    });
  }

  return warnings;
}

function applyResilienceAdjustments({
  baseScore,
  trends,
  forecast,
  scenarios,
  health,
  liquidityScore,
  reconciliationScore,
  isSmallDollar,
  hasLiquidityAlert,
  historyCount,
}) {
  let score = baseScore;
  let adjustment = 0;

  const trendStatus = trends?.trendStatus || "insufficient_data";

  if (trendStatus === "stable") adjustment += 5;
  else if (trendStatus === "improving") adjustment += 8;
  else if (trendStatus === "deteriorating") adjustment -= isSmallDollar ? 2 : 12;

  if (forecast?.outlook === "stable") adjustment += 4;
  else if (forecast?.outlook === "improving") adjustment += 6;
  else if (forecast?.outlook === "elevated_pressure") adjustment -= isSmallDollar ? 1 : 8;
  else if (forecast?.outlook === "deteriorating") adjustment -= isSmallDollar ? 2 : 15;

  if (forecast?.confidence >= 80) adjustment += 3;
  else if (forecast?.confidence < 40) adjustment -= isSmallDollar ? 0 : 5;

  if (liquidityScore >= 90) adjustment += 3;
  else if (liquidityScore < 70) adjustment -= isSmallDollar ? 0 : 8;

  if (reconciliationScore >= 90) adjustment += 3;
  else if (reconciliationScore < 70) adjustment -= isSmallDollar ? 0 : 10;

  if (hasLiquidityAlert) adjustment -= isSmallDollar ? 0 : 10;

  if ((trends?.warningSignals || []).some((s) => s.code === "repeated_alert_pattern")) {
    adjustment -= isSmallDollar ? 1 : 6;
  }

  const { severe } = countScenarioDeteriorationSignals(scenarios);
  if (severe >= 2) adjustment -= isSmallDollar ? 1 : 8;
  else if (severe === 1) adjustment -= isSmallDollar ? 0 : 4;

  if (historyCount >= 7 && trendStatus === "stable") adjustment += 3;
  if (historyCount < TREND_MIN_SNAPSHOTS) adjustment -= 3;

  if (isSmallDollar) {
    adjustment = Math.round(adjustment * 0.25);
    score = Math.max(score, 85);
  }

  return clamp(Math.round(score + adjustment), 0, 100);
}

/**
 * Estimate treasury resilience under sustained pressure (read-only).
 * @param {{ days?: number, trends?: object, forecast?: object, scenarios?: object, health?: object }} [opts]
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient]
 */
export async function calculateTreasuryResilience(
  { days = 30, trends: precomputedTrends, forecast: precomputedForecast, scenarios: precomputedScenarios, health: precomputedHealth } = {},
  supabaseClient = defaultClient,
) {
  const client = supabaseClient || defaultClient;
  if (!client) return { ...EMPTY_RESILIENCE };

  const windowDays = Math.min(90, Math.max(1, Number(days) || 30));

  try {
    const [health, latestResult, trends] = await Promise.all([
      precomputedHealth || calculateTreasuryHealth(client),
      fetchLatestTreasuryHealth(client),
      precomputedTrends || calculateTreasuryTrends({ days: windowDays }, client),
    ]);

    const resolvedForecast =
      precomputedForecast || (await calculateTreasuryForecast({ days: windowDays, trends }, client));

    const resolvedScenarios =
      precomputedScenarios ||
      (await calculateTreasuryScenarios(
        { days: windowDays, trends, forecast: resolvedForecast, health },
        client,
      ));

    const metrics = health?.sourceSnapshot?.metrics || {};
    const walletLiabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const pendingWithdrawalExposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const baseHealthScore = clamp(Math.round(Number(health?.healthScore) || 100), 0, 100);
    const liquidityScore = clamp(Math.round(Number(health?.liquidityScore) || 100), 0, 100);
    const reconciliationScore = clamp(Math.round(Number(health?.reconciliationScore) || 100), 0, 100);
    const pendingObligationScore = clamp(Math.round(Number(health?.pendingObligationScore) || 100), 0, 100);

    const isSmallDollar = isSmallDollarResilienceEnvironment(pendingWithdrawalExposure, walletLiabilities);
    const exposureRatio = exposureLiabilityRatio(pendingWithdrawalExposure, walletLiabilities);
    const hasLiquidityAlert = hasLiquidityPressureAlert(health);
    const historyCount = trends?.historyCount || 0;

    const resilienceScore = applyResilienceAdjustments({
      baseScore: baseHealthScore,
      trends,
      forecast: resolvedForecast,
      scenarios: resolvedScenarios,
      health,
      liquidityScore,
      reconciliationScore,
      isSmallDollar,
      hasLiquidityAlert,
      historyCount,
    });

    let resilienceLevel = resilienceScoreToLevel(resilienceScore);
    if (isSmallDollar && baseHealthScore >= 80 && trends?.trendStatus !== "deteriorating") {
      resilienceLevel = resilienceScore >= 85 ? "resilient" : "strong";
    }

    const liquidityBufferScore = computeLiquidityBufferScore({
      liquidityScore,
      exposureRatio,
      pendingObligationScore,
      isSmallDollar,
    });

    const survivabilityScore = computeSurvivabilityScore({
      healthScore: baseHealthScore,
      exposureRatio,
      liquidityScore,
      reconciliationScore,
      isSmallDollar,
      hasLiquidityAlert,
      trendStatus: trends?.trendStatus,
      forecastOutlook: resolvedForecast?.outlook,
    });

    let recoveryDifficulty = deriveRecoveryDifficulty({
      survivabilityScore,
      isSmallDollar,
      trendStatus: trends?.trendStatus,
      forecastOutlook: resolvedForecast?.outlook,
    });
    if (isSmallDollar && recoveryDifficulty === "severe") recoveryDifficulty = "manageable";
    if (isSmallDollar && recoveryDifficulty === "difficult") recoveryDifficulty = "manageable";

    const runwayEstimate = deriveRunwayEstimate({
      healthScore: baseHealthScore,
      trendStatus: trends?.trendStatus,
      forecastOutlook: resolvedForecast?.outlook,
      trends,
      isSmallDollar,
    });

    const treasuryTolerance = deriveTreasuryTolerance({
      healthScore: baseHealthScore,
      liquidityBufferScore,
      survivabilityScore,
      isSmallDollar,
      trendStatus: trends?.trendStatus,
      forecastOutlook: resolvedForecast?.outlook,
      exposureRatio,
    });

    const confidence = computeResilienceConfidence({
      health,
      trends,
      forecast: resolvedForecast,
      scenarios: resolvedScenarios,
      historyCount,
      hasLatestSnapshot: Boolean(latestResult?.data),
    });

    const summary = buildResilienceSummary({
      resilienceLevel,
      isSmallDollar,
      trendStatus: trends?.trendStatus,
      forecastOutlook: resolvedForecast?.outlook,
      runwayEstimate,
    });

    const warnings = buildResilienceWarnings({
      isSmallDollar,
      trends,
      forecast: resolvedForecast,
      scenarios: resolvedScenarios,
      health,
      runwayEstimate,
      recoveryDifficulty,
    });

    return {
      resilienceScore,
      resilienceLevel,
      liquidityBufferScore,
      survivabilityScore,
      recoveryDifficulty,
      runwayEstimate,
      treasuryTolerance,
      confidence,
      summary,
      warnings,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryResilience", err: err?.message || err });
    return { ...EMPTY_RESILIENCE };
  }
}

const EMPTY_EXPLAINABILITY = {
  summary: "Treasury explainability unavailable — insufficient data.",
  confidenceExplanation: "Confidence could not be assessed — treasury signals are incomplete.",
  riskExplanation: "Risk classification unavailable.",
  topDrivers: [],
  observations: [],
  recommendations: ["Continue routine treasury monitoring until signals are available."],
  decisionTrace: ["Explainability analysis could not complete — treasury data unavailable."],
};

function explainabilityDriverTypeFromImpact(impact, severity) {
  const sev = String(severity || "").toLowerCase();
  if (sev === "critical" || sev === "high") return "negative";
  if (sev === "medium") return "warning";
  const n = Number(impact);
  if (Number.isFinite(n) && n < 0) return "negative";
  if (Number.isFinite(n) && n > 0) return "positive";
  return "warning";
}

function reasonToDriverTitle(reason) {
  const template = ALERT_MAP[reason?.code];
  const label = reason?.label || template?.title || reason?.code || "Treasury signal";
  return normalizeTreasuryWarningTitle(label);
}

function buildExplainabilityTopDrivers({ health, trends, forecast, resilience, isSmallDollar }) {
  const drivers = [];
  const seenTitles = new Set();

  function addDriver({ type, title, impact }) {
    const normalized = normalizeTreasuryWarningTitle(title);
    if (!normalized || seenTitles.has(normalized.toLowerCase())) return;
    seenTitles.add(normalized.toLowerCase());
    drivers.push({ type, title: normalized, impact });
  }

  if (health?.healthScore >= 80 && (health?.reasons || []).length === 0) {
    addDriver({
      type: "positive",
      title: "Strong treasury health score",
      impact: `Health score ${health.healthScore} with no penalty reasons`,
    });
  }

  if (health?.reconciliationScore >= 90 && (health?.sourceSnapshot?.metrics?.reconciliationMismatchCount || 0) === 0) {
    addDriver({
      type: "positive",
      title: "Clean reconciliation signals",
      impact: `Reconciliation score ${health.reconciliationScore} — no mismatch signals`,
    });
  }

  if (health?.liquidityScore >= 85 && health?.pendingObligationScore >= 85) {
    addDriver({
      type: "positive",
      title: "Stable liquidity and obligations",
      impact: `Liquidity ${health.liquidityScore} · pending obligations ${health.pendingObligationScore}`,
    });
  }

  for (const reason of health?.reasons || []) {
    if (isSmallDollar && (reason.code === "high_payout_pressure" || reason.code === "large_pending_obligations" || reason.code === "liquidity_pressure")) {
      continue;
    }
    const template = ALERT_MAP[reason.code];
    addDriver({
      type: explainabilityDriverTypeFromImpact(reason.impact, template?.severity),
      title: reasonToDriverTitle(reason),
      impact: reason.impact != null ? `${reason.impact} pts health impact` : "Active penalty signal",
    });
  }

  if (trends?.trendStatus === "stable" && (trends?.historyCount || 0) >= TREND_MIN_SNAPSHOTS) {
    addDriver({
      type: "positive",
      title: "Stable snapshot trends",
      impact: `${trends.historyCount} snapshots — trend status stable`,
    });
  } else if (trends?.trendStatus === "improving") {
    addDriver({
      type: "positive",
      title: "Improving snapshot trends",
      impact: `Health score change ${trends.healthScoreChange >= 0 ? "+" : ""}${trends.healthScoreChange} pts`,
    });
  } else if (trends?.trendStatus === "deteriorating" && !isSmallDollar) {
    addDriver({
      type: "negative",
      title: "Deteriorating snapshot trends",
      impact: `Health score change ${trends.healthScoreChange} pts across window`,
    });
  }

  for (const signal of trends?.warningSignals || []) {
    if (signal.code === "insufficient_snapshot_history") continue;
    if (isSmallDollar && (signal.code === "payout_exposure_rising" || signal.code === "liability_growth_detected")) {
      continue;
    }
    addDriver({
      type: explainabilityDriverTypeFromImpact(null, signal.severity),
      title: formatTreasuryWarningTitle(signal),
      impact: signal.message?.slice(0, 120) || "Trend warning signal",
    });
  }

  if (forecast?.outlook === "stable" && (trends?.historyCount || 0) >= TREND_MIN_SNAPSHOTS) {
    addDriver({
      type: "positive",
      title: "Stable forecast outlook",
      impact: `Projected risk ${String(forecast.projectedRisk || "low").toUpperCase()} · pressure ${forecast.treasuryPressure || "low"}`,
    });
  } else if (forecast?.outlook === "deteriorating" && !isSmallDollar) {
    addDriver({
      type: "negative",
      title: "Deteriorating forecast outlook",
      impact: forecast.summary || "Treasury deterioration risk emerging",
    });
  } else if (forecast?.outlook === "elevated_pressure" && !isSmallDollar) {
    addDriver({
      type: "warning",
      title: "Elevated pressure forecast",
      impact: forecast.summary || "Withdrawal or treasury pressure may increase",
    });
  }

  if (resilience?.resilienceLevel === "resilient" || resilience?.resilienceLevel === "strong") {
    addDriver({
      type: "positive",
      title: `Treasury resilience ${resilience.resilienceLevel}`,
      impact: `Resilience score ${resilience.resilienceScore} · runway ${resilience.runwayEstimate?.replace(/_/g, " ") || "stable"}`,
    });
  } else if (resilience?.resilienceLevel === "weak" && !isSmallDollar) {
    addDriver({
      type: "negative",
      title: "Weakened treasury resilience",
      impact: `Resilience score ${resilience.resilienceScore} · recovery ${resilience.recoveryDifficulty || "unknown"}`,
    });
  } else if (resilience?.resilienceLevel === "moderate" && !isSmallDollar) {
    addDriver({
      type: "warning",
      title: "Moderate treasury resilience",
      impact: resilience.summary?.slice(0, 120) || "Some softening signals present",
    });
  }

  if (isSmallDollar) {
    addDriver({
      type: "positive",
      title: "Small-dollar test environment",
      impact: "Exposure and liabilities below materiality thresholds — advisory context only",
    });
  }

  const typeRank = { negative: 0, warning: 1, positive: 2 };
  drivers.sort((a, b) => (typeRank[a.type] ?? 9) - (typeRank[b.type] ?? 9));

  return drivers.slice(0, 8);
}

function buildExplainabilitySummary({
  health,
  trends,
  forecast,
  resilience,
  scenarios,
  isSmallDollar,
}) {
  const score = clamp(Math.round(Number(health?.healthScore) || 0), 0, 100);
  const risk = String(health?.treasuryRiskLevel || healthScoreToRiskLevel(score)).toLowerCase();
  const trendStatus = trends?.trendStatus || "insufficient_data";
  const outlook = forecast?.outlook || "stable";
  const resilienceLevel = resilience?.resilienceLevel || "moderate";
  const reasonCount = (health?.reasons || []).length;

  if (isSmallDollar) {
    if (score >= 80 && reasonCount === 0) {
      return "Treasury health is strong in a small-dollar test environment. Dollar amounts are below materiality thresholds — conditions appear stable with routine monitoring sufficient.";
    }
    return "Treasury explainability runs in a small-dollar test environment. Signals remain advisory — dollar amounts are below materiality thresholds and should not trigger operational alarm language.";
  }

  if (score >= 80 && risk === "low" && reasonCount === 0 && trendStatus === "stable" && outlook === "stable") {
    return "Treasury is healthy with stable liabilities, stable exposure, clean reconciliation, a stable forecast, and low scenario stress. Current conditions support normal operational monitoring.";
  }

  if (trendStatus === "deteriorating" || outlook === "deteriorating") {
    return "Treasury shows deterioration signals — rising exposure or liabilities, reconciliation softening, worsening forecast, or weakening resilience may be present. Continue advisory monitoring; no automated treasury actions are triggered.";
  }

  if (score >= 60 && reasonCount <= 2) {
    return `Treasury health score is ${score} (${risk} risk). Some softening signals are present but conditions remain manageable under advisory monitoring.`;
  }

  if (score < 60 || risk === "high" || risk === "critical") {
    return `Treasury health score is ${score} with ${risk.toUpperCase()} risk classification. Multiple penalty signals, trend warnings, or resilience softening contribute to elevated advisory concern.`;
  }

  if (outlook === "elevated_pressure") {
    return "Treasury baseline remains acceptable but forecast and trend signals suggest elevated withdrawal or obligation pressure if current conditions continue.";
  }

  if (resilienceLevel === "weak" || resilienceLevel === "moderate") {
    return `Treasury resilience is classified as ${resilienceLevel}. Health and trend signals warrant closer advisory review without triggering automated payout or wallet actions.`;
  }

  if (scenarios?.summary) {
    return scenarios.summary;
  }

  return `Treasury health score is ${score} with ${risk.toUpperCase()} risk. Review top drivers and decision trace for institutional reasoning.`;
}

function buildConfidenceExplanation({ health, trends, forecast, scenarios, resilience, isSmallDollar }) {
  const parts = [];
  const healthConf = clamp(Math.round(Number(health?.confidenceScore) || 50), 0, 100);
  const trendConf = clamp(Math.round(Number(trends?.confidence) || 0), 0, 100);
  const forecastConf = clamp(Math.round(Number(forecast?.confidence) || 0), 0, 100);
  const scenarioConf = clamp(Math.round(Number(scenarios?.scenarioConfidence) || 0), 0, 100);
  const resilienceConf = clamp(Math.round(Number(resilience?.confidence) || 0), 0, 100);
  const historyCount = trends?.historyCount || 0;
  const reconScore = clamp(Math.round(Number(health?.reconciliationScore) || 100), 0, 100);
  const mismatchCount = health?.sourceSnapshot?.metrics?.reconciliationMismatchCount || 0;

  if (healthConf >= 80) {
    parts.push("Current treasury snapshot data is broadly available (treasury summary, transaction history, wallet scan, reconciliation).");
  } else if (healthConf >= 50) {
    parts.push("Treasury data availability is partial — some observability signals may be incomplete.");
  } else {
    parts.push("Treasury data confidence is limited — interpret health and risk signals with caution.");
  }

  if (historyCount >= 7) {
    parts.push(`${historyCount} snapshots in the trend window provide strong historical consistency for forecast and resilience confidence.`);
  } else if (historyCount >= TREND_MIN_SNAPSHOTS) {
    parts.push(`${historyCount} snapshots available — trend and forecast confidence are moderate; deeper history would improve certainty.`);
  } else {
    parts.push("Fewer than three snapshots in the trend window — forecast and trend confidence remain low.");
  }

  if (reconScore >= 90 && mismatchCount === 0) {
    parts.push("Reconciliation quality is clean with no mismatch signals, supporting higher confidence in liability and exposure readings.");
  } else if (mismatchCount > 0) {
    parts.push(`${mismatchCount} reconciliation mismatch signal(s) reduce confidence in ledger and wallet alignment.`);
  }

  const blended = Math.round((healthConf + trendConf + forecastConf + scenarioConf + resilienceConf) / 5);
  if (isSmallDollar) {
    parts.push("Small-dollar test environment detected — confidence is appropriately high for advisory interpretation despite low dollar materiality.");
  } else if (blended >= 75) {
    parts.push(`Blended explainability confidence is high (${blended}%) across health, trends, forecast, scenarios, and resilience.`);
  } else if (blended >= 50) {
    parts.push(`Blended explainability confidence is moderate (${blended}%) — continue monitoring as snapshot history accumulates.`);
  } else {
    parts.push(`Blended explainability confidence is limited (${blended}%) — treat projections and drivers as indicative only.`);
  }

  return parts.join(" ");
}

function buildRiskExplanation({ health, trends, forecast, isSmallDollar }) {
  const score = clamp(Math.round(Number(health?.healthScore) || 0), 0, 100);
  const risk = String(health?.treasuryRiskLevel || healthScoreToRiskLevel(score)).toUpperCase();
  const reasonCount = (health?.reasons || []).length;
  const trendStatus = trends?.trendStatus || "insufficient_data";

  if (isSmallDollar && score >= 80) {
    return `Treasury risk is classified as ${risk} based on health score ${score}. Small-dollar exposure keeps operational risk in an advisory, low-materiality band despite any informational alerts.`;
  }

  if (risk === "LOW" && reasonCount === 0) {
    return `Treasury risk is classified as ${risk} because the health score is ${score} with no active penalty reasons, stable trend classification (${trendStatus.replace(/_/g, " ")}), and no material reconciliation mismatches.`;
  }

  if (risk === "LOW") {
    return `Treasury risk is classified as ${risk} (health score ${score}). Minor penalty signals are present but remain below thresholds that would elevate risk to medium or higher.`;
  }

  const drivers = [];
  if (reasonCount > 0) drivers.push(`${reasonCount} active health penalty reason(s)`);
  if (trendStatus === "deteriorating") drivers.push("deteriorating snapshot trends");
  if (forecast?.outlook === "deteriorating" || forecast?.outlook === "elevated_pressure") {
    drivers.push(`${forecast.outlook.replace(/_/g, " ")} forecast outlook`);
  }

  const driverText = drivers.length > 0 ? drivers.join(", ") : "composite health and trend signals";
  return `Treasury risk is classified as ${risk} based on health score ${score}. Contributing factors: ${driverText}. This is an advisory classification — no automated treasury actions are triggered.`;
}

function buildExplainabilityRecommendations({
  health,
  trends,
  forecast,
  resilience,
  isSmallDollar,
}) {
  const recs = [];
  const reasonCodes = new Set((health?.reasons || []).map((r) => r.code));
  const trendStatus = trends?.trendStatus || "insufficient_data";

  if (isSmallDollar && (health?.healthScore ?? 100) >= 80) {
    recs.push("Small-dollar environment — continue routine monitoring; dollar amounts are below materiality thresholds.");
    if ((trends?.historyCount || 0) < TREND_MIN_SNAPSHOTS) {
      recs.push("Accumulate additional snapshots to improve trend and forecast confidence over time.");
    }
    return recs;
  }

  if (reasonCodes.has("high_payout_pressure") || reasonCodes.has("large_pending_obligations") || reasonCodes.has("liquidity_pressure")) {
    recs.push("Continue monitoring payout pressure and pending withdrawal exposure — advisory review only, no automated payout actions.");
  }

  if (reasonCodes.has("liability_growth_spike") || isMaterialPositiveChange(trends?.priorLiabilities, trends?.liabilityChange)) {
    recs.push("Review liability growth trends across recent snapshots and validate wallet balance aggregation.");
  }

  if (
    reasonCodes.has("reconciliation_mismatch") ||
    reasonCodes.has("negative_balance_anomaly") ||
    (health?.reconciliationScore ?? 100) < 80
  ) {
    recs.push("Monitor reconciliation signals and ledger trial balance — investigate mismatches through existing admin workflows.");
  }

  if ((trends?.warningSignals || []).some((s) => s.code === "repeated_alert_pattern")) {
    recs.push("Observe repeated alert patterns across snapshots — confirm whether conditions are stable or worsening.");
  }

  if (forecast?.outlook === "deteriorating" || forecast?.outlook === "elevated_pressure") {
    recs.push("Track forecast outlook and trend deltas — elevated pressure projections are advisory, not automated treasury decisions.");
  }

  if (resilience?.resilienceLevel === "weak" || resilience?.resilienceLevel === "moderate") {
    recs.push("Review resilience summary and scenario projections for sustained-pressure planning — guidance only.");
  }

  if ((trends?.historyCount || 0) < TREND_MIN_SNAPSHOTS) {
    recs.push("Allow snapshot history to accumulate (minimum three) before relying heavily on trend-based explainability.");
  }

  if (recs.length === 0 && (health?.healthScore ?? 0) >= 80 && trendStatus === "stable") {
    recs.push("Stable treasury conditions — continue normal monitoring cadence. No advisory escalation recommended.");
  } else if (recs.length === 0) {
    recs.push("Continue routine treasury monitoring and refresh snapshots on your normal cadence.");
  }

  return recs;
}

function buildExplainabilityObservations({ health, trends, forecast, scenarios, resilience, isSmallDollar }) {
  const observations = [];
  const metrics = health?.sourceSnapshot?.metrics || {};

  if (isSmallDollar) {
    observations.push(
      `Small-dollar environment: exposure ${formatExplainabilityMoney(metrics.pendingWithdrawalExposure)} · liabilities ${formatExplainabilityMoney(metrics.totalWalletLiabilities)} — below materiality thresholds.`,
    );
  }

  if ((trends?.historyCount || 0) >= TREND_MIN_SNAPSHOTS) {
    observations.push(
      `Trend window: ${trends.historyCount} snapshots · liability delta ${formatExplainabilityDelta(trends.liabilityChange, "$")} · exposure delta ${formatExplainabilityDelta(trends.exposureChange, "$")}.`,
    );
  }

  if (forecast?.summary) {
    observations.push(`Forecast: ${forecast.summary}`);
  }

  if (scenarios?.scenarioConfidence != null) {
    observations.push(`Scenario confidence ${scenarios.scenarioConfidence}% — ${(scenarios.scenarios || []).length} what-if models evaluated.`);
  }

  if (resilience?.summary) {
    observations.push(`Resilience: ${resilience.summary}`);
  }

  if ((health?.reasons || []).length === 0 && (health?.healthScore ?? 0) >= 80) {
    observations.push("No health penalty reasons detected in the current scoring pass.");
  }

  return observations;
}

function formatExplainabilityMoney(value) {
  const n = toFiniteNumber(value);
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatExplainabilityDelta(value, prefix = "") {
  const n = toFiniteNumber(value);
  const sign = n > 0 ? "+" : "";
  return `${sign}${prefix}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function buildExplainabilityDecisionTrace({
  health,
  trends,
  forecast,
  scenarios,
  resilience,
  isSmallDollar,
}) {
  const trace = [];
  const score = clamp(Math.round(Number(health?.healthScore) || 0), 0, 100);
  const risk = String(health?.treasuryRiskLevel || healthScoreToRiskLevel(score)).toUpperCase();
  const metrics = health?.sourceSnapshot?.metrics || {};

  trace.push(`Treasury health score evaluated at ${score}`);

  if (isSmallDollar) {
    trace.push("Small-dollar test environment detected — materiality guards applied to explainability language");
  }

  if ((health?.reasons || []).length === 0) {
    trace.push("No penalty reasons applied — baseline health deductions absent");
  } else {
    trace.push(`${(health?.reasons || []).length} penalty reason(s) contributed to health score deductions`);
  }

  if (metrics.reconciliationMismatchCount === 0 && (health?.reconciliationScore ?? 100) >= 90) {
    trace.push("Reconciliation signals are clean — no mismatch count detected");
  } else if ((metrics.reconciliationMismatchCount || 0) > 0) {
    trace.push(`Reconciliation review flagged ${metrics.reconciliationMismatchCount} mismatch signal(s)`);
  }

  const liabilityStable =
    !isMaterialPositiveChange(trends?.priorLiabilities, trends?.liabilityChange) &&
    !isMaterialNegativeChange(trends?.priorLiabilities, trends?.liabilityChange);
  const exposureStable =
    !isMaterialPositiveChange(trends?.priorExposure, trends?.exposureChange) &&
    !isMaterialNegativeChange(trends?.priorExposure, trends?.exposureChange);

  if (liabilityStable && (trends?.historyCount || 0) >= TREND_MIN_SNAPSHOTS) {
    trace.push("Wallet liabilities remained stable across the trend window");
  } else if (isMaterialPositiveChange(trends?.priorLiabilities, trends?.liabilityChange)) {
    trace.push("Wallet liabilities increased materially across the trend window");
  } else if (isMaterialNegativeChange(trends?.priorLiabilities, trends?.liabilityChange)) {
    trace.push("Wallet liabilities declined across the trend window");
  }

  if (exposureStable && (trends?.historyCount || 0) >= TREND_MIN_SNAPSHOTS) {
    trace.push("Pending withdrawal exposure remained stable across the trend window");
  } else if (isMaterialPositiveChange(trends?.priorExposure, trends?.exposureChange)) {
    trace.push("Pending withdrawal exposure increased materially across the trend window");
  }

  const trendLabel = String(trends?.trendStatus || "insufficient_data").replace(/_/g, " ");
  trace.push(`Trend analysis classified treasury as ${trendLabel}`);

  if (forecast?.outlook) {
    trace.push(`Forecast outlook classified as ${String(forecast.outlook).replace(/_/g, " ")} (${forecast.confidence ?? 0}% confidence)`);
  }

  if (resilience?.resilienceLevel) {
    trace.push(`Treasury resilience assessed as ${resilience.resilienceLevel} (score ${resilience.resilienceScore ?? "—"})`);
  }

  if (scenarios?.baseline?.healthScore != null) {
    trace.push(`Scenario baseline anchored at health score ${scenarios.baseline.healthScore}`);
  }

  trace.push(`Treasury risk classified as ${risk}`);

  return trace;
}

/**
 * Explain WHY treasury received its score and risk level (read-only, advisory).
 * @param {{ treasuryHealth?: object, trends?: object, forecast?: object, scenarios?: object, resilience?: object }} input
 */
export function calculateTreasuryExplainability({
  treasuryHealth,
  trends,
  forecast,
  scenarios,
  resilience,
} = {}) {
  try {
    const health = treasuryHealth || {};
    const metrics = health?.sourceSnapshot?.metrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    const summary = buildExplainabilitySummary({
      health,
      trends: trends || {},
      forecast: forecast || {},
      resilience: resilience || {},
      scenarios: scenarios || {},
      isSmallDollar,
    });

    const confidenceExplanation = buildConfidenceExplanation({
      health,
      trends: trends || {},
      forecast: forecast || {},
      scenarios: scenarios || {},
      resilience: resilience || {},
      isSmallDollar,
    });

    const riskExplanation = buildRiskExplanation({
      health,
      trends: trends || {},
      forecast: forecast || {},
      isSmallDollar,
    });

    const topDrivers = buildExplainabilityTopDrivers({
      health,
      trends: trends || {},
      forecast: forecast || {},
      resilience: resilience || {},
      isSmallDollar,
    });

    const observations = buildExplainabilityObservations({
      health,
      trends: trends || {},
      forecast: forecast || {},
      scenarios: scenarios || {},
      resilience: resilience || {},
      isSmallDollar,
    });

    const recommendations = buildExplainabilityRecommendations({
      health,
      trends: trends || {},
      forecast: forecast || {},
      resilience: resilience || {},
      isSmallDollar,
    });

    const decisionTrace = buildExplainabilityDecisionTrace({
      health,
      trends: trends || {},
      forecast: forecast || {},
      scenarios: scenarios || {},
      resilience: resilience || {},
      isSmallDollar,
    });

    return {
      summary,
      confidenceExplanation,
      riskExplanation,
      topDrivers,
      observations,
      recommendations,
      decisionTrace,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryExplainability", err: err?.message || err });
    return { ...EMPTY_EXPLAINABILITY };
  }
}

const EMPTY_SIMULATION = {
  simulatedHealthScore: 100,
  simulatedRiskLevel: "low",
  simulatedPressure: "low",
  simulatedResilience: "resilient",
  confidence: 0,
  summary: "Treasury decision simulation unavailable — baseline data required.",
  warnings: [],
  decisionTrace: ["Simulation could not run — treasury baseline unavailable."],
};

function formatSimulatorMoney(value) {
  const n = toFiniteNumber(value);
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function countActiveSimulatorParams({
  liabilityMultiplier,
  exposureMultiplier,
  fundingSlowdownPercent,
  reconciliationIssueCount,
  withdrawalSpikePercent,
}) {
  let count = 0;
  if (Number(liabilityMultiplier) > 1) count += 1;
  if (Number(exposureMultiplier) > 1) count += 1;
  if (Number(fundingSlowdownPercent) > 0) count += 1;
  if (Number(reconciliationIssueCount) > 0) count += 1;
  if (Number(withdrawalSpikePercent) > 0) count += 1;
  return count;
}

function computeSimulatorScoreDrop({
  baseHealthScore,
  baselineLiabilities,
  baselineExposure,
  simLiabilities,
  simExposure,
  liabilityMultiplier,
  exposureMultiplier,
  fundingSlowdownPercent,
  reconciliationIssueCount,
  withdrawalSpikePercent,
  isSmallDollar,
  isMaterial,
  liquidityScore,
  reconciliationScore,
  trendWeakness,
  forecastWeakness,
  hasLiquidityAlert,
}) {
  const trace = [];
  let drop = 0;

  const applyDrop = (points, message) => {
    if (points <= 0) return;
    drop += points;
    trace.push(message);
  };

  if (!isMaterial || isSmallDollar) {
    if (Number(liabilityMultiplier) > 1) {
      applyDrop(
        clamp(Math.round((Number(liabilityMultiplier) - 1) * 2), 0, 3),
        `Liability multiplier ${liabilityMultiplier}x: small-dollar guard applied — minimal liability pressure`,
      );
    }
    const effectiveExposureMult =
      Number(exposureMultiplier) * (1 + Number(withdrawalSpikePercent) / 100);
    if (effectiveExposureMult > 1) {
      applyDrop(
        clamp(Math.round((effectiveExposureMult - 1) * 2), 0, 3),
        `Payout exposure ${exposureMultiplier}x + ${withdrawalSpikePercent}% spike: below materiality thresholds — advisory only`,
      );
    }
    if (Number(fundingSlowdownPercent) > 0) {
      applyDrop(
        clamp(Math.round(Number(fundingSlowdownPercent) * 0.04), 0, 2),
        `Funding slowdown ${fundingSlowdownPercent}%: negligible impact in small-dollar environment`,
      );
    }
    if (Number(reconciliationIssueCount) > 0) {
      applyDrop(
        clamp(Number(reconciliationIssueCount), 0, 3),
        `${reconciliationIssueCount} reconciliation issue(s): capped impact — dollar amounts remain below materiality`,
      );
    }
    drop = clamp(Math.round(drop), 0, 5);
    if (drop === 0) {
      trace.push("All simulation inputs at baseline — no score adjustment under materiality guards");
    }
    return { drop, trace };
  }

  const simExposureRatio = exposureLiabilityRatio(simExposure, simLiabilities);
  const effectiveExposureMult =
    Number(exposureMultiplier) * (1 + Number(withdrawalSpikePercent) / 100);

  if (Number(liabilityMultiplier) > 1) {
    const liabilityDrop = clamp(Math.round((Number(liabilityMultiplier) - 1) * 10), 2, 15);
    applyDrop(
      liabilityDrop,
      `Liability multiplier ${liabilityMultiplier}x (${formatSimulatorMoney(baselineLiabilities)} → ${formatSimulatorMoney(simLiabilities)}): +${liabilityDrop} pt liability pressure`,
    );
    if (simExposureRatio >= 0.25) {
      applyDrop(3, `Simulated exposure/liability ratio ${Math.round(simExposureRatio * 100)}% ≥ 25%: +3 pt liquidity pressure`);
    }
    if (simExposureRatio >= 0.5) {
      applyDrop(4, `Simulated exposure/liability ratio ${Math.round(simExposureRatio * 100)}% ≥ 50%: +4 pt liquidity pressure`);
    }
  }

  if (effectiveExposureMult > 1) {
    const baseExposureDrop = clamp(Math.round((effectiveExposureMult - 1) * 8), 0, 22);
    applyDrop(
      baseExposureDrop,
      `Payout exposure ${exposureMultiplier}x + ${withdrawalSpikePercent}% withdrawal spike (${formatSimulatorMoney(baselineExposure)} → ${formatSimulatorMoney(simExposure)}): +${baseExposureDrop} pt exposure pressure`,
    );
    if (simExposure >= HIGH_PAYOUT_PRESSURE_THRESHOLD_USD) {
      applyDrop(
        8,
        `Simulated exposure ${formatSimulatorMoney(simExposure)} exceeds payout pressure threshold (${formatSimulatorMoney(HIGH_PAYOUT_PRESSURE_THRESHOLD_USD)}): +8 pt`,
      );
    }
    if (simExposure >= LARGE_PENDING_THRESHOLD_USD) {
      applyDrop(
        6,
        `Simulated exposure ${formatSimulatorMoney(simExposure)} exceeds large pending threshold (${formatSimulatorMoney(LARGE_PENDING_THRESHOLD_USD)}): +6 pt`,
      );
    }
    if (simExposureRatio >= 0.25) {
      applyDrop(5, "Elevated simulated exposure ratio: +5 pt payout pressure");
    }
  }

  if (Number(fundingSlowdownPercent) > 0) {
    const fundingDrop = clamp(Math.round(Number(fundingSlowdownPercent) * 0.15), 2, 18);
    applyDrop(fundingDrop, `Funding slowdown ${fundingSlowdownPercent}%: +${fundingDrop} pt liquidity pressure`);
    if (simExposure > 0 && Number(fundingSlowdownPercent) >= 25) {
      applyDrop(3, `Funding slowdown with pending exposure present: +3 pt incremental stress`);
    }
  }

  if (Number(reconciliationIssueCount) > 0) {
    const reconDrop = clamp(Number(reconciliationIssueCount) * 5, 5, 25);
    applyDrop(
      reconDrop,
      `${reconciliationIssueCount} simulated reconciliation issue(s): +${reconDrop} pt reconciliation impact`,
    );
  }

  if (liquidityScore < 80) {
    applyDrop(3, `Baseline liquidity score ${liquidityScore} < 80: +3 pt context amplifier`);
  }
  if (reconciliationScore < 80) {
    applyDrop(3, `Baseline reconciliation score ${reconciliationScore} < 80: +3 pt context amplifier`);
  }
  if (trendWeakness) {
    applyDrop(4, "Recent snapshot trends show softening: +4 pt context amplifier");
  }
  if (forecastWeakness) {
    applyDrop(4, "Forecast outlook is not fully stable: +4 pt context amplifier");
  }
  if (hasLiquidityAlert) {
    applyDrop(2, "Active liquidity or payout pressure alerts present: +2 pt context amplifier");
  }

  drop = clamp(Math.round(drop), 0, baseHealthScore);
  return { drop, trace };
}

function buildSimulatorWarnings({
  isSmallDollar,
  trendWeakness,
  forecastWeakness,
  reconciliationScore,
  hasLiquidityAlert,
  liabilityMultiplier,
  exposureMultiplier,
  fundingSlowdownPercent,
  reconciliationIssueCount,
  withdrawalSpikePercent,
  simulatedHealthScore,
  baselineHealthScore,
}) {
  const warnings = [];

  if (isSmallDollar) {
    warnings.push({
      code: "sim_small_dollar_guard",
      severity: "low",
      label: "Simulation advisory",
      title: "Small-dollar materiality guard active",
      message:
        "Dollar amounts are below materiality thresholds. Simulated score changes are capped — projections remain advisory only.",
    });
  }

  if (trendWeakness) {
    warnings.push({
      code: "sim_trend_softening",
      severity: "medium",
      label: "Simulation advisory",
      title: normalizeTreasuryWarningTitle(TREND_WARNING_TEMPLATES.treasury_health_declining.title),
      message: "Recent snapshot trends show softening — simulated impact may be slightly amplified.",
    });
  }

  if (forecastWeakness) {
    warnings.push({
      code: "sim_forecast_instability",
      severity: "medium",
      label: "Simulation advisory",
      title: "Forecast outlook unstable",
      message: "Forecast outlook is not fully stable — treat simulated deltas as indicative, not predictive.",
    });
  }

  if (reconciliationScore < 80) {
    warnings.push({
      code: "sim_reconciliation_weak",
      severity: "medium",
      label: "Simulation advisory",
      title: normalizeTreasuryWarningTitle("Reconciliation score below optimal"),
      message: "Baseline reconciliation score is below optimal — monitor ledger signals alongside simulated shifts.",
    });
  }

  if (hasLiquidityAlert) {
    warnings.push({
      code: "sim_liquidity_alert",
      severity: "high",
      label: "Simulation advisory",
      title: normalizeTreasuryWarningTitle("Active liquidity pressure"),
      message: "Active liquidity or payout pressure alerts present — simulated withdrawal spikes add incremental stress.",
    });
  }

  if (
    Number(liabilityMultiplier) >= 2 &&
    (Number(exposureMultiplier) >= 2 || Number(withdrawalSpikePercent) >= 50)
  ) {
    warnings.push({
      code: "sim_combined_stress",
      severity: isSmallDollar ? "low" : "high",
      label: "Simulation advisory",
      title: "Combined stress scenario",
      message:
        "Simultaneous liability growth and payout exposure increase represents elevated combined stress. Review manually — no automated treasury actions.",
    });
  }

  if (Number(fundingSlowdownPercent) >= 50 && Number(withdrawalSpikePercent) >= 25) {
    warnings.push({
      code: "sim_funding_withdrawal_stress",
      severity: isSmallDollar ? "low" : "high",
      label: "Simulation advisory",
      title: "Funding slowdown with withdrawal spike",
      message:
        "Funding slowdown combined with withdrawal spike would compress liquidity buffers. Advisory only — confirm funding pace before operational decisions.",
    });
  }

  if (Number(reconciliationIssueCount) >= 3) {
    warnings.push({
      code: "sim_reconciliation_cluster",
      severity: "medium",
      label: "Simulation advisory",
      title: normalizeTreasuryWarningTitle("Multiple reconciliation issues"),
      message: `${reconciliationIssueCount} simulated reconciliation issues would materially affect reconciliation score. Verify ledger integrity before acting on exposure shifts.`,
    });
  }

  if (simulatedHealthScore < baselineHealthScore - 20 && !isSmallDollar) {
    warnings.push({
      code: "sim_material_score_drop",
      severity: simulatedHealthScore < 40 ? "critical" : "high",
      label: "Simulation advisory",
      title: normalizeTreasuryWarningTitle("Material health score reduction"),
      message: `Simulated health score drops ${baselineHealthScore - simulatedHealthScore} points from baseline ${baselineHealthScore}. Escalate for manual review — simulation does not trigger payouts or holds.`,
    });
  }

  return warnings;
}

function buildSimulatorSummary({
  isSmallDollar,
  simulatedHealthScore,
  baselineHealthScore,
  simulatedRiskLevel,
  simulatedPressure,
  simulatedResilienceLevel,
  activeParamCount,
}) {
  const delta = baselineHealthScore - simulatedHealthScore;

  if (activeParamCount === 0) {
    return "All simulation inputs match current baseline. No what-if adjustments applied — treasury conditions reflect live read-only signals.";
  }

  if (isSmallDollar) {
    return `Simulated conditions (${activeParamCount} adjustment${activeParamCount === 1 ? "" : "s"}) produce a health score of ${simulatedHealthScore} (${simulatedRiskLevel} risk, ${simulatedPressure} pressure, ${simulatedResilienceLevel} resilience). Small-dollar materiality guards keep impact advisory — routine monitoring remains sufficient.`;
  }

  if (delta <= 5 && simulatedRiskLevel === "low") {
    return `Under modeled conditions, treasury health would remain strong at ${simulatedHealthScore} (${simulatedRiskLevel} risk). Pressure stays ${simulatedPressure} with ${simulatedResilienceLevel} resilience — continue routine monitoring.`;
  }

  if (simulatedRiskLevel === "critical" || simulatedPressure === "severe") {
    return `Simulated stress reduces health to ${simulatedHealthScore} (${simulatedRiskLevel} risk, ${simulatedPressure} pressure). Resilience degrades to ${simulatedResilienceLevel}. This is advisory only — escalate for manual review; no wallet, payout, or funding mutations are performed.`;
  }

  if (delta >= 15) {
    return `Modeled what-if conditions would reduce health score by ${delta} points to ${simulatedHealthScore} (${simulatedRiskLevel} risk, ${simulatedPressure} pressure). Resilience: ${simulatedResilienceLevel}. Use for planning and monitoring — not automated treasury action.`;
  }

  return `Simulation projects health score ${simulatedHealthScore} under ${activeParamCount} adjusted input${activeParamCount === 1 ? "" : "s"} (${simulatedRiskLevel} risk, ${simulatedPressure} pressure, ${simulatedResilienceLevel} resilience). Advisory only — confirm against live treasury signals before operational decisions.`;
}

function computeSimulatorConfidence({
  scenarios,
  health,
  trends,
  forecast,
  resilience,
  healthDrop,
  isSmallDollar,
  activeParamCount,
}) {
  let score = clamp(Math.round(Number(scenarios?.scenarioConfidence) || Number(health?.confidenceScore) || 50), 0, 100);

  const resilienceConf = clamp(Math.round(Number(resilience?.confidence) || 0), 0, 100);
  if (resilienceConf > 0) {
    score = Math.round(score * 0.55 + resilienceConf * 0.45);
  }

  const trendConf = clamp(Math.round(Number(trends?.confidence) || 0), 0, 100);
  const forecastConf = clamp(Math.round(Number(forecast?.confidence) || 0), 0, 100);
  if (trendConf > 0 || forecastConf > 0) {
    score = Math.round(score * 0.7 + (trendConf + forecastConf) * 0.15);
  }

  score -= activeParamCount * 2;
  if (healthDrop > 30) score -= 8;
  else if (healthDrop > 15) score -= 4;

  if (trends?.trendStatus === "insufficient_data") score = Math.min(score, 55);
  if (isSmallDollar) score = Math.max(score, 72);

  return clamp(score, 0, 100);
}

/**
 * Read-only treasury decision simulator — what-if analysis from current baseline signals.
 * Does not mutate wallets, payouts, transactions, or persist snapshots.
 * @param {{
 *   liabilityMultiplier?: number,
 *   exposureMultiplier?: number,
 *   fundingSlowdownPercent?: number,
 *   reconciliationIssueCount?: number,
 *   withdrawalSpikePercent?: number,
 *   treasuryHealth?: object,
 *   health?: object,
 *   trends?: object,
 *   forecast?: object,
 *   scenarios?: object,
 *   resilience?: object,
 * }} [input]
 */
export function simulateTreasuryDecision({
  liabilityMultiplier = 1,
  exposureMultiplier = 1,
  fundingSlowdownPercent = 0,
  reconciliationIssueCount = 0,
  withdrawalSpikePercent = 0,
  treasuryHealth,
  health: healthAlias,
  trends = {},
  forecast = {},
  scenarios = {},
  resilience = {},
} = {}) {
  try {
    const health = treasuryHealth || healthAlias;
    if (!health?.healthScore && health?.healthScore !== 0) {
      return { ...EMPTY_SIMULATION };
    }

    const metrics = health?.sourceSnapshot?.metrics || {};
    const baselineLiabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const baselineExposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const baseHealthScore = clamp(Math.round(Number(health.healthScore) || 100), 0, 100);
    const liquidityScore = clamp(Math.round(Number(health.liquidityScore) || 100), 0, 100);
    const reconciliationScore = clamp(Math.round(Number(health.reconciliationScore) || 100), 0, 100);

    const simLiabilities = baselineLiabilities * Number(liabilityMultiplier || 1);
    const simExposure =
      baselineExposure * Number(exposureMultiplier || 1) * (1 + Number(withdrawalSpikePercent || 0) / 100);

    const isSmallDollar = isSmallDollarScenarioEnvironment(baselineExposure, baselineLiabilities);
    const isMaterial = !isSmallDollar;

    const trendWeakness =
      trends?.trendStatus === "deteriorating" ||
      (trends?.healthScoreChange ?? 0) <= -TREND_HEALTH_DROP_WARNING ||
      isMaterialPositiveChange(trends?.priorExposure, trends?.exposureChange);

    const forecastWeakness =
      forecast?.outlook === "deteriorating" ||
      forecast?.outlook === "elevated_pressure" ||
      forecast?.treasuryPressure === "elevated" ||
      forecast?.treasuryPressure === "moderate";

    const hasLiquidityAlert = hasLiquidityPressureAlert(health);

    const decisionTrace = [
      `Baseline health score ${baseHealthScore} (${health.treasuryRiskLevel || healthScoreToRiskLevel(baseHealthScore)} risk) from live read-only signals`,
      `Baseline liabilities ${formatSimulatorMoney(baselineLiabilities)} · exposure ${formatSimulatorMoney(baselineExposure)}`,
    ];

    if (isSmallDollar) {
      decisionTrace.push(
        `Small-dollar environment detected (exposure < $${SCENARIO_MATERIALITY_EXPOSURE_MAX}, liabilities < $${SCENARIO_MATERIALITY_LIABILITY_MAX}) — materiality guards applied`,
      );
    }

    const { drop: scoreDrop, trace: adjustmentTrace } = computeSimulatorScoreDrop({
      baseHealthScore,
      baselineLiabilities,
      baselineExposure,
      simLiabilities,
      simExposure,
      liabilityMultiplier,
      exposureMultiplier,
      fundingSlowdownPercent,
      reconciliationIssueCount,
      withdrawalSpikePercent,
      isSmallDollar,
      isMaterial,
      liquidityScore,
      reconciliationScore,
      trendWeakness,
      forecastWeakness,
      hasLiquidityAlert,
    });

    decisionTrace.push(...adjustmentTrace);

    const simulatedHealthScore = clamp(baseHealthScore - scoreDrop, 0, 100);
    const simulatedRiskLevel = healthScoreToRiskLevel(simulatedHealthScore);

    const hasCombinedStress =
      (Number(liabilityMultiplier) > 1 &&
        (Number(exposureMultiplier) > 1 || Number(withdrawalSpikePercent) >= 50)) ||
      (Number(fundingSlowdownPercent) >= 50 &&
        (Number(exposureMultiplier) > 1 || Number(withdrawalSpikePercent) >= 25));

    const simulatedPressure = deriveScenarioPressure({
      scoreDrop,
      projectedScore: simulatedHealthScore,
      isSmallDollar,
      scenarioKey: hasCombinedStress ? "combined_stress" : "simulator",
    });

    const healthDrop = baseHealthScore - simulatedHealthScore;
    const baselineResilienceScore = clamp(
      Math.round(Number(resilience?.resilienceScore) || baseHealthScore),
      0,
      100,
    );
    const simulatedResilienceScore = clamp(
      Math.round(baselineResilienceScore - healthDrop * 0.65),
      0,
      100,
    );
    let simulatedResilienceLevel = resilienceScoreToLevel(simulatedResilienceScore);
    if (isSmallDollar && baseHealthScore >= 80 && trends?.trendStatus !== "deteriorating") {
      simulatedResilienceLevel = simulatedResilienceScore >= 85 ? "resilient" : "strong";
    }

    const activeParamCount = countActiveSimulatorParams({
      liabilityMultiplier,
      exposureMultiplier,
      fundingSlowdownPercent,
      reconciliationIssueCount,
      withdrawalSpikePercent,
    });

    const confidence = computeSimulatorConfidence({
      scenarios,
      health,
      trends,
      forecast,
      resilience,
      healthDrop,
      isSmallDollar,
      activeParamCount,
    });

    decisionTrace.push(
      `Simulated health score ${simulatedHealthScore} (${simulatedRiskLevel} risk, ${simulatedPressure} pressure) — ${scoreDrop} pt reduction from baseline`,
    );
    decisionTrace.push(`Simulated resilience ${simulatedResilienceLevel} (score ${simulatedResilienceScore})`);
    decisionTrace.push(`Simulation confidence ${confidence}% — advisory only, no treasury mutations`);

    const warnings = buildSimulatorWarnings({
      isSmallDollar,
      trendWeakness,
      forecastWeakness,
      reconciliationScore,
      hasLiquidityAlert,
      liabilityMultiplier,
      exposureMultiplier,
      fundingSlowdownPercent,
      reconciliationIssueCount,
      withdrawalSpikePercent,
      simulatedHealthScore,
      baselineHealthScore: baseHealthScore,
    });

    const summary = buildSimulatorSummary({
      isSmallDollar,
      simulatedHealthScore,
      baselineHealthScore: baseHealthScore,
      simulatedRiskLevel,
      simulatedPressure,
      simulatedResilienceLevel,
      activeParamCount,
    });

    return {
      simulatedHealthScore,
      simulatedRiskLevel,
      simulatedPressure,
      simulatedResilience: simulatedResilienceLevel,
      confidence,
      summary,
      warnings,
      decisionTrace,
    };
  } catch (err) {
    warn({ op: "simulateTreasuryDecision", err: err?.message || err });
    return { ...EMPTY_SIMULATION };
  }
}

const EMPTY_OPERATIONAL_GUIDANCE = {
  operationalStatus: "monitor",
  monitoringPriority: "medium",
  priorities: [],
  recommendedChecks: ["Continue routine treasury monitoring and refresh snapshots on your normal cadence."],
  observations: [],
  watchItems: [],
  confidence: 0,
  summary: "Treasury operational guidance unavailable — baseline data required.",
};

function deriveOperationalStatusTier(signals) {
  const {
    isSmallDollar,
    healthScore,
    hasHighAttentionSignals,
    hasElevatedAttentionSignals,
    hasMonitorSignals,
    isHealthyBaseline,
  } = signals;

  if (isSmallDollar && healthScore >= 80 && !hasElevatedAttentionSignals && !hasHighAttentionSignals) {
    return "healthy";
  }

  if (hasHighAttentionSignals) return "high_attention";
  if (hasElevatedAttentionSignals) return "elevated_attention";
  if (hasMonitorSignals || !isHealthyBaseline) return "monitor";
  return "healthy";
}

function operationalStatusToMonitoringPriority(status, confidence) {
  const conf = clamp(Math.round(Number(confidence) || 0), 0, 100);
  const map = {
    healthy: conf >= 60 ? "low" : "medium",
    monitor: conf >= 50 ? "medium" : "elevated",
    elevated_attention: "elevated",
    high_attention: "high",
  };
  return map[status] || "medium";
}

function computeOperationalGuidanceConfidence({ health, trends, forecast, resilience, scenarios, simulator }) {
  let score = clamp(Math.round(Number(health?.confidenceScore) || 50), 0, 100);
  const trendConf = clamp(Math.round(Number(trends?.confidence) || 0), 0, 100);
  const forecastConf = clamp(Math.round(Number(forecast?.confidence) || 0), 0, 100);
  const resilienceConf = clamp(Math.round(Number(resilience?.confidence) || 0), 0, 100);
  const scenarioConf = clamp(Math.round(Number(scenarios?.scenarioConfidence) || 0), 0, 100);

  score = Math.round(score * 0.35 + trendConf * 0.2 + forecastConf * 0.2 + resilienceConf * 0.15 + scenarioConf * 0.1);

  if (simulator?.confidence != null) {
    score = Math.round(score * 0.85 + clamp(Math.round(Number(simulator.confidence) || 0), 0, 100) * 0.15);
  }

  if (trends?.trendStatus === "insufficient_data") score = Math.min(score, 55);

  return clamp(score, 0, 100);
}

function collectOperationalGuidanceSignals({
  health,
  trends,
  forecast,
  scenarios,
  resilience,
  simulator,
  isSmallDollar,
}) {
  const metrics = health?.sourceSnapshot?.metrics || {};
  const healthScore = clamp(Math.round(Number(health?.healthScore) || 0), 0, 100);
  const riskLevel = String(health?.treasuryRiskLevel || healthScoreToRiskLevel(healthScore)).toLowerCase();
  const reconciliationScore = clamp(Math.round(Number(health?.reconciliationScore) || 100), 0, 100);
  const reasonCodes = new Set((health?.reasons || []).map((r) => r.code));
  const trendStatus = trends?.trendStatus || "insufficient_data";
  const forecastOutlook = forecast?.outlook || "stable";
  const treasuryPressure = forecast?.treasuryPressure || "low";
  const resilienceLevel = resilience?.resilienceLevel || "moderate";
  const reconciliationScoreChange = trends?.reconciliationScoreChange ?? 0;

  const hasRepeatedAlerts = (trends?.warningSignals || []).some((s) => s.code === "repeated_alert_pattern");
  const hasPayoutPressure =
    reasonCodes.has("high_payout_pressure") ||
    reasonCodes.has("large_pending_obligations") ||
    reasonCodes.has("liquidity_pressure") ||
    treasuryPressure === "moderate" ||
    treasuryPressure === "elevated" ||
    treasuryPressure === "severe";

  const hasModeratePayoutPressure =
    treasuryPressure === "moderate" ||
    reasonCodes.has("high_payout_pressure") ||
    (isMaterialPositiveChange(trends?.priorExposure, trends?.exposureChange) && !isSmallDollar);

  const reconciliationClean =
    reconciliationScore >= 80 &&
    (metrics.reconciliationMismatchCount || 0) === 0 &&
    !reasonCodes.has("reconciliation_mismatch");

  const reconciliationDeteriorating =
    reconciliationScore < 70 ||
    reconciliationScoreChange <= -TREND_HEALTH_DROP_WARNING ||
    reasonCodes.has("reconciliation_mismatch") ||
    reasonCodes.has("negative_balance_anomaly");

  const resilienceHealthy = resilienceLevel === "resilient" || resilienceLevel === "strong";
  const resilienceWeakening =
    resilienceLevel === "weak" ||
    (resilienceLevel === "moderate" &&
      (trendStatus === "deteriorating" || forecastOutlook === "deteriorating"));

  const forecastStable = forecastOutlook === "stable" || forecastOutlook === "improving";
  const forecastWorsening = forecastOutlook === "deteriorating" || forecastOutlook === "elevated_pressure";

  const trendDeteriorating = trendStatus === "deteriorating";
  const hasHighSeverityScenario = (scenarios?.scenarios || []).some((s) => s.severity === "high");
  const hasMediumSeverityScenario = (scenarios?.scenarios || []).some((s) => s.severity === "medium");

  const simHealthDrop =
    simulator?.simulatedHealthScore != null && health?.healthScore != null
      ? clamp(Math.round(Number(health.healthScore) - Number(simulator.simulatedHealthScore)), 0, 100)
      : 0;
  const simMaterialStress =
    simulator &&
    !isSmallDollar &&
    (simHealthDrop >= 20 ||
      simulator.simulatedRiskLevel === "high" ||
      simulator.simulatedRiskLevel === "critical" ||
      simulator.simulatedPressure === "severe");
  const simElevatedOutcome =
    simulator &&
    (simHealthDrop >= 8 ||
      simulator.simulatedPressure === "elevated" ||
      simulator.simulatedPressure === "moderate" ||
      (simulator.warnings || []).some((w) => w.severity === "high" || w.severity === "medium"));

  const isHealthyBaseline =
    healthScore >= 80 &&
    riskLevel === "low" &&
    resilienceHealthy &&
    forecastStable &&
    treasuryPressure === "low" &&
    reconciliationClean &&
    !trendDeteriorating &&
    !hasRepeatedAlerts;

  const hasHighAttentionSignals =
    !isSmallDollar &&
    (simMaterialStress ||
      (reconciliationDeteriorating && forecastWorsening) ||
      (forecastWorsening && resilienceWeakening) ||
      (trendDeteriorating && healthScore < 60 && hasPayoutPressure) ||
      (healthScore < 40 && reconciliationDeteriorating));

  const hasElevatedAttentionSignals =
    !isSmallDollar &&
    !hasHighAttentionSignals &&
    (trendDeteriorating ||
      resilienceWeakening ||
      hasHighSeverityScenario ||
      (forecastWorsening && hasModeratePayoutPressure) ||
      (hasMediumSeverityScenario && hasPayoutPressure) ||
      isMaterialPositiveChange(trends?.priorExposure, trends?.exposureChange));

  const hasMonitorSignals =
    hasRepeatedAlerts ||
    hasModeratePayoutPressure ||
    simElevatedOutcome ||
    (trends?.warningSignals || []).filter((s) => s.code !== "insufficient_snapshot_history").length >= 2 ||
    (healthScore < 80 && healthScore >= 60) ||
    resilienceLevel === "moderate";

  return {
    healthScore,
    riskLevel,
    reconciliationScore,
    reasonCodes,
    trendStatus,
    forecastOutlook,
    treasuryPressure,
    resilienceLevel,
    hasRepeatedAlerts,
    hasPayoutPressure,
    hasModeratePayoutPressure,
    reconciliationClean,
    reconciliationDeteriorating,
    resilienceHealthy,
    resilienceWeakening,
    forecastStable,
    forecastWorsening,
    trendDeteriorating,
    hasHighSeverityScenario,
    hasMediumSeverityScenario,
    simHealthDrop,
    simMaterialStress,
    simElevatedOutcome,
    isHealthyBaseline,
    hasHighAttentionSignals,
    hasElevatedAttentionSignals,
    hasMonitorSignals,
    isSmallDollar,
    metrics,
  };
}

function buildOperationalPriorities(signals) {
  const priorities = [];
  const add = (severity, title, explanation) => {
    priorities.push({ severity, title, explanation });
  };

  if (signals.isSmallDollar) {
    add(
      "low",
      "Small-dollar test environment",
      "Exposure and liabilities are below materiality thresholds. Guidance is advisory and may not reflect production-scale treasury conditions.",
    );
  }

  if (signals.hasModeratePayoutPressure || signals.hasPayoutPressure) {
    add(
      signals.treasuryPressure === "elevated" || signals.treasuryPressure === "severe" ? "high" : "medium",
      "Monitor payout exposure trends",
      signals.isSmallDollar
        ? "Payout pressure signals are present but dollar amounts remain below materiality — observe trends without escalation."
        : "Pending withdrawal exposure or payout pressure warrants continued observation through existing admin monitoring workflows.",
    );
  }

  if (signals.reconciliationDeteriorating) {
    add(
      signals.reconciliationScore < 70 ? "high" : "medium",
      "Continue reconciliation monitoring",
      "Reconciliation score or mismatch signals suggest closer observation of ledger alignment — review through standard admin reconciliation tools.",
    );
  } else if (signals.reconciliationClean) {
    add(
      "low",
      "Maintain reconciliation cadence",
      "Reconciliation signals appear clean. Continue your established reconciliation review schedule.",
    );
  }

  if (signals.hasRepeatedAlerts) {
    add(
      "medium",
      "Observe repeated treasury alerts",
      "Alert patterns have recurred across recent snapshots. Confirm whether conditions are stable, seasonal, or gradually worsening.",
    );
  }

  if (signals.simElevatedOutcome || signals.simMaterialStress) {
    add(
      signals.simMaterialStress ? "high" : "medium",
      "Monitor treasury stress simulation outcomes",
      signals.simMaterialStress
        ? "Simulated stress conditions materially reduce projected health — use as planning context only; no automated treasury actions are triggered."
        : "Decision simulator indicates elevated modeled pressure. Review outcomes as advisory what-if analysis.",
    );
  }

  if (signals.trendDeteriorating) {
    add(
      "high",
      "Review deteriorating trend signals",
      "Snapshot trends show deterioration in health, exposure, or reconciliation metrics over the monitoring window.",
    );
  }

  if (signals.resilienceWeakening) {
    add(
      signals.resilienceLevel === "weak" ? "high" : "medium",
      "Assess treasury resilience posture",
      `Resilience is classified as ${signals.resilienceLevel}. Review resilience summary and scenario projections for sustained-pressure planning.`,
    );
  }

  if (signals.forecastWorsening && !signals.isSmallDollar) {
    add(
      signals.forecastOutlook === "deteriorating" ? "high" : "medium",
      "Track forecast outlook",
      `Forecast outlook is ${String(signals.forecastOutlook).replace(/_/g, " ")} — monitor trend deltas on subsequent snapshot refreshes.`,
    );
  }

  if (signals.hasHighSeverityScenario && !signals.isSmallDollar) {
    add(
      "high",
      "Review high-severity scenario projections",
      "What-if scenarios indicate high-severity outcomes under modeled stress — advisory planning context only.",
    );
  }

  if (priorities.length === 0) {
    add(
      "low",
      "Routine treasury monitoring",
      "No elevated operational priorities detected. Continue standard snapshot and alert monitoring cadence.",
    );
  }

  const severityRank = { high: 0, medium: 1, low: 2 };
  priorities.sort((a, b) => (severityRank[a.severity] ?? 9) - (severityRank[b.severity] ?? 9));

  return priorities.slice(0, 8);
}

function buildOperationalRecommendedChecks(signals, operationalStatus) {
  const checks = [];

  if (signals.hasModeratePayoutPressure || signals.hasPayoutPressure) {
    checks.push("Review payout exposure trends across recent snapshots.");
  }

  checks.push("Continue reconciliation monitoring through existing admin workflows.");

  if (signals.hasRepeatedAlerts) {
    checks.push("Observe repeated treasury alerts and compare against prior snapshot windows.");
  }

  if (signals.simElevatedOutcome || signals.simMaterialStress) {
    checks.push("Monitor treasury stress simulation outcomes when evaluating operational readiness.");
  }

  if (signals.trendDeteriorating) {
    checks.push("Review trend deltas for health score, liabilities, and exposure over the monitoring window.");
  }

  if (signals.resilienceWeakening) {
    checks.push("Review treasury resilience summary and runway estimate.");
  }

  if (signals.forecastWorsening) {
    checks.push("Track 7-day forecast outlook and projected treasury pressure on refresh.");
  }

  if (operationalStatus === "healthy" && checks.length <= 2) {
    checks.push("Maintain normal snapshot refresh cadence.");
  }

  return [...new Set(checks)].slice(0, 8);
}

function buildOperationalWatchItems(signals, trends) {
  const items = [];

  for (const signal of trends?.warningSignals || []) {
    if (signal.code === "insufficient_snapshot_history") continue;
    if (signals.isSmallDollar && (signal.code === "payout_exposure_rising" || signal.code === "liability_growth_detected")) {
      continue;
    }
    items.push(formatTreasuryWarningTitle(signal));
  }

  if (signals.forecastWorsening && !signals.isSmallDollar) {
    items.push(`Forecast outlook: ${String(signals.forecastOutlook).replace(/_/g, " ")}`);
  }

  if (signals.resilienceWeakening) {
    items.push(`Resilience level: ${signals.resilienceLevel}`);
  }

  if (signals.simMaterialStress) {
    items.push(`Simulated health drop: ${signals.simHealthDrop} pts under modeled stress`);
  } else if (signals.simElevatedOutcome && signals.simHealthDrop > 0) {
    items.push(`Simulator projects ${signals.simHealthDrop} pt health reduction from baseline`);
  }

  if (signals.reconciliationDeteriorating) {
    items.push(`Reconciliation score: ${signals.reconciliationScore}`);
  }

  return [...new Set(items)].slice(0, 8);
}

function buildOperationalObservations(signals, { health, trends, forecast, scenarios, resilience, simulator }) {
  const observations = [];
  const metrics = signals.metrics;

  observations.push(
    `Health score ${signals.healthScore} (${String(signals.riskLevel).toUpperCase()} risk) · reconciliation ${signals.reconciliationScore}.`,
  );

  if (signals.isSmallDollar) {
    observations.push(
      `Small-dollar environment: exposure ${formatExplainabilityMoney(metrics.pendingWithdrawalExposure)} · liabilities ${formatExplainabilityMoney(metrics.totalWalletLiabilities)}.`,
    );
  }

  if ((trends?.historyCount || 0) >= TREND_MIN_SNAPSHOTS) {
    observations.push(`Trend status: ${String(signals.trendStatus).replace(/_/g, " ")} (${trends.historyCount} snapshots).`);
  }

  if (forecast?.summary) {
    observations.push(`Forecast: ${forecast.summary}`);
  }

  if (resilience?.resilienceLevel) {
    observations.push(
      `Resilience: ${resilience.resilienceLevel} (score ${resilience.resilienceScore ?? "—"}) · tolerance ${resilience.treasuryTolerance || "—"}.`,
    );
  }

  if (scenarios?.scenarioConfidence != null) {
    observations.push(`Scenario confidence ${scenarios.scenarioConfidence}% across ${(scenarios.scenarios || []).length} models.`);
  }

  if (simulator?.summary) {
    observations.push(`Latest simulation: ${simulator.summary}`);
  }

  if ((health?.reasons || []).length === 0 && signals.healthScore >= 80) {
    observations.push("No health penalty reasons in the current scoring pass.");
  }

  return observations;
}

function buildOperationalSummary(operationalStatus, signals, isSmallDollar) {
  const soften = (text) =>
    isSmallDollar ? `${text} Small-dollar amounts may indicate a test environment — interpret guidance accordingly.` : text;

  switch (operationalStatus) {
    case "healthy":
      return soften(
        "Treasury operations appear stable. Continue routine monitoring of payout pressure and reconciliation cadence.",
      );
    case "monitor":
      return soften(
        "Monitor treasury conditions for emerging payout or liquidity pressure. Several advisory signals warrant closer observation on refresh.",
      );
    case "elevated_attention":
      return soften(
        "Treasury conditions show emerging stress signals — deteriorating trends, resilience softening, or rising payout exposure. Prioritize advisory review on the next monitoring cycle.",
      );
    case "high_attention":
      return soften(
        "Treasury operational indicators suggest sustained pressure under current and simulated conditions. Conduct thorough advisory review; no automated treasury actions are recommended or triggered.",
      );
    default:
      return soften("Continue routine treasury monitoring.");
  }
}

/**
 * Operational prioritization guidance from treasury intelligence signals (read-only, advisory).
 * Does not mutate wallets, payouts, transactions, or persist snapshots.
 * @param {{
 *   treasuryHealth?: object,
 *   health?: object,
 *   trends?: object,
 *   forecast?: object,
 *   scenarios?: object,
 *   resilience?: object,
 *   explainability?: object,
 *   simulator?: object,
 *   simulation?: object,
 * }} [input]
 */
export function calculateTreasuryOperationalGuidance({
  treasuryHealth,
  health: healthAlias,
  trends = {},
  forecast = {},
  scenarios = {},
  resilience = {},
  explainability = {},
  simulator,
  simulation,
} = {}) {
  try {
    const health = treasuryHealth || healthAlias;
    if (!health?.healthScore && health?.healthScore !== 0) {
      return { ...EMPTY_OPERATIONAL_GUIDANCE };
    }

    const metrics = health?.sourceSnapshot?.metrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    const simulatorResult = simulator || simulation || null;

    const signals = collectOperationalGuidanceSignals({
      health,
      trends,
      forecast,
      scenarios,
      resilience,
      simulator: simulatorResult,
      isSmallDollar,
    });

    const operationalStatus = deriveOperationalStatusTier(signals);

    const confidence = computeOperationalGuidanceConfidence({
      health,
      trends,
      forecast,
      resilience,
      scenarios,
      simulator: simulatorResult,
    });

    const monitoringPriority = operationalStatusToMonitoringPriority(operationalStatus, confidence);

    const priorities = buildOperationalPriorities(signals);
    const recommendedChecks = buildOperationalRecommendedChecks(signals, operationalStatus);
    const watchItems = buildOperationalWatchItems(signals, trends);
    const observations = buildOperationalObservations(signals, {
      health,
      trends,
      forecast,
      scenarios,
      resilience,
      simulator: simulatorResult,
    });

    if (explainability?.summary && !observations.some((o) => o.includes(explainability.summary.slice(0, 40)))) {
      observations.push(`Explainability: ${explainability.summary}`);
    }

    let summary = buildOperationalSummary(operationalStatus, signals, isSmallDollar);

    if (isSmallDollar && operationalStatus !== "healthy") {
      summary = summary.replace(
        /Small-dollar amounts may indicate a test environment — interpret guidance accordingly\.$/,
        "",
      );
      summary = `${summary.trim()} Dollar amounts remain below materiality thresholds — guidance is softened accordingly.`;
    }

    return {
      operationalStatus,
      monitoringPriority,
      priorities,
      recommendedChecks,
      observations,
      watchItems,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryOperationalGuidance", err: err?.message || err });
    return { ...EMPTY_OPERATIONAL_GUIDANCE };
  }
}

const EMPTY_EXECUTIVE_SUMMARY = {
  executiveStatus: "stable_monitoring",
  headline: "Treasury executive summary unavailable — baseline data required.",
  summary: "Executive summary could not be generated without current treasury health data.",
  keyMetrics: [],
  keyRisks: [],
  keyStrengths: [],
  nextFocus: [],
  confidence: 0,
};

function mapOperationalStatusToExecutiveStatus(operationalStatus) {
  const map = {
    healthy: "healthy",
    monitor: "stable_monitoring",
    elevated_attention: "elevated_watch",
    high_attention: "high_attention",
  };
  return map[String(operationalStatus || "").toLowerCase()] || "stable_monitoring";
}

function computeExecutiveSummaryConfidence({ health, trends, forecast, resilience, operationalGuidance }) {
  const healthConf = clamp(Math.round(Number(health?.confidenceScore) || 50), 0, 100);
  const trendConf = clamp(Math.round(Number(trends?.confidence) || 0), 0, 100);
  const forecastConf = clamp(Math.round(Number(forecast?.confidence) || 0), 0, 100);
  const resilienceConf = clamp(Math.round(Number(resilience?.confidence) || 0), 0, 100);
  const operationalConf = clamp(Math.round(Number(operationalGuidance?.confidence) || 0), 0, 100);

  let score = Math.round(
    healthConf * 0.2 +
      trendConf * 0.15 +
      forecastConf * 0.25 +
      resilienceConf * 0.2 +
      operationalConf * 0.2,
  );

  if (trends?.trendStatus === "insufficient_data") score = Math.min(score, 55);

  return clamp(score, 0, 100);
}

function buildExecutiveHeadline({ executiveStatus, healthScore, riskLevel, isSmallDollar }) {
  const risk = String(riskLevel || healthScoreToRiskLevel(healthScore)).toUpperCase();

  if (isSmallDollar) {
    if (executiveStatus === "healthy" || executiveStatus === "stable_monitoring") {
      return "Common treasury indicators remain healthy under current soft-launch activity.";
    }
    if (executiveStatus === "elevated_watch") {
      return "Soft-launch treasury signals show emerging patterns worth monitoring.";
    }
    return "Soft-launch treasury indicators warrant advisory review on the next cycle.";
  }

  switch (executiveStatus) {
    case "healthy":
      return `Treasury posture is healthy with ${risk.toLowerCase()} operational risk.`;
    case "stable_monitoring":
      return "Treasury conditions are stable — continue monitoring payout exposure and alert patterns.";
    case "elevated_watch":
      return "Emerging treasury signals warrant elevated observation and advisory review.";
    case "high_attention":
      return "Treasury indicators require leadership attention under current and projected conditions.";
    default:
      return "Continue routine treasury monitoring and snapshot refresh.";
  }
}

function buildExecutiveSummaryParagraph({
  executiveStatus,
  health,
  trends,
  forecast,
  resilience,
  operationalGuidance,
  explainability,
  isSmallDollar,
}) {
  const healthScore = clamp(Math.round(Number(health?.healthScore) || 0), 0, 100);
  const riskLevel = String(health?.treasuryRiskLevel || healthScoreToRiskLevel(healthScore)).toLowerCase();
  const trendStatus = trends?.trendStatus || "insufficient_data";
  const forecastOutlook = forecast?.outlook || "stable";
  const resilienceLevel = resilience?.resilienceLevel || "moderate";
  const reconciliationScore = clamp(Math.round(Number(health?.reconciliationScore) || 100), 0, 100);

  const parts = [];

  if (isSmallDollar) {
    parts.push(
      "Treasury activity reflects a small-dollar soft-launch or test environment where dollar amounts remain below materiality thresholds.",
    );
  }

  parts.push(
    `Current health score is ${healthScore} with ${riskLevel} risk classification.`,
  );

  if (trendStatus === "stable" || trendStatus === "improving") {
    parts.push(
      trendStatus === "improving"
        ? "Snapshot trends show improving or stable movement over the monitoring window."
        : "Snapshot trends remain stable across the monitoring window.",
    );
  } else if (trendStatus === "deteriorating" && !isSmallDollar) {
    parts.push("Snapshot trends indicate gradual deterioration — monitor deltas on subsequent refreshes.");
  } else if (trendStatus === "insufficient_data") {
    parts.push("Limited snapshot history is available — trend confidence is reduced until more data accumulates.");
  }

  if (forecast?.summary) {
    parts.push(forecast.summary);
  } else if (forecastOutlook !== "stable") {
    parts.push(
      `The 7-day forecast outlook is ${String(forecastOutlook).replace(/_/g, " ")} — advisory context only.`,
    );
  }

  if (resilienceLevel === "resilient" || resilienceLevel === "strong") {
    parts.push(
      `Resilience posture is ${resilienceLevel}, suggesting capacity to absorb routine operational pressure.`,
    );
  } else if (resilienceLevel === "weak" && !isSmallDollar) {
    parts.push("Resilience assessment indicates limited buffer under sustained pressure.");
  }

  if (reconciliationScore >= 80) {
    parts.push("Reconciliation signals appear healthy.");
  } else if (!isSmallDollar) {
    parts.push(`Reconciliation score is ${reconciliationScore} — continue standard reconciliation monitoring.`);
  }

  if (operationalGuidance?.summary) {
    parts.push(operationalGuidance.summary);
  } else if (explainability?.summary) {
    parts.push(explainability.summary);
  }

  if (isSmallDollar && (executiveStatus === "healthy" || executiveStatus === "stable_monitoring")) {
    parts.push("Interpret all guidance as advisory until production-scale activity is present.");
  }

  if (executiveStatus === "high_attention" && !isSmallDollar) {
    parts.push("No automated treasury actions are recommended or triggered from this summary.");
  }

  return parts.join(" ");
}

function buildExecutiveKeyMetrics({ health, trends, forecast, resilience }) {
  const metrics = health?.sourceSnapshot?.metrics || {};
  const healthScore = clamp(Math.round(Number(health?.healthScore) || 0), 0, 100);
  const riskLevel = String(health?.treasuryRiskLevel || healthScoreToRiskLevel(healthScore)).toUpperCase();

  const items = [
    { label: "Health score", value: String(healthScore) },
    { label: "Risk level", value: riskLevel },
    { label: "Wallet liabilities", value: formatExplainabilityMoney(metrics.totalWalletLiabilities) },
    { label: "Pending exposure", value: formatExplainabilityMoney(metrics.pendingWithdrawalExposure) },
    { label: "Reconciliation", value: String(clamp(Math.round(Number(health?.reconciliationScore) || 100), 0, 100)) },
  ];

  if (resilience?.resilienceScore != null) {
    items.push({ label: "Resilience score", value: String(resilience.resilienceScore) });
  }

  if (resilience?.resilienceLevel) {
    items.push({
      label: "Resilience level",
      value: String(resilience.resilienceLevel).replace(/_/g, " "),
    });
  }

  if (trends?.trendStatus) {
    items.push({
      label: "Trend status",
      value: String(trends.trendStatus).replace(/_/g, " "),
    });
  }

  if (forecast?.outlook) {
    items.push({
      label: "7-day outlook",
      value: String(forecast.outlook).replace(/_/g, " "),
    });
  }

  if (forecast?.projectedRisk) {
    items.push({
      label: "Projected risk",
      value: String(forecast.projectedRisk).replace(/_/g, " "),
    });
  }

  return items;
}

function buildExecutiveKeyRisks({ trends, forecast, scenarios, operationalGuidance, resilience, isSmallDollar }) {
  const risks = [];

  for (const signal of trends?.warningSignals || []) {
    if (signal.code === "insufficient_snapshot_history") continue;
    if (isSmallDollar && (signal.code === "payout_exposure_rising" || signal.code === "liability_growth_detected")) {
      continue;
    }
    risks.push(signal.message || formatTreasuryWarningTitle(signal));
  }

  for (const w of forecast?.warnings || []) {
    if (w?.message) risks.push(w.message);
  }

  for (const w of resilience?.warnings || []) {
    if (w?.message && !isSmallDollar) risks.push(w.message);
  }

  for (const s of scenarios?.scenarios || []) {
    if (s.severity === "high" && !isSmallDollar) {
      risks.push(`${s.label}: ${s.summary}`);
    } else if (s.severity === "medium" && !isSmallDollar && s.warnings?.length) {
      for (const w of s.warnings.slice(0, 1)) risks.push(`${s.label}: ${w}`);
    }
  }

  for (const p of operationalGuidance?.priorities || []) {
    if (p.severity === "high" || p.severity === "medium") {
      risks.push(p.explanation || p.title);
    }
  }

  if (isSmallDollar && risks.length === 0) {
    risks.push("No material treasury risks detected at current soft-launch dollar levels.");
  }

  return [...new Set(risks)].slice(0, 6);
}

function buildExecutiveKeyStrengths({ health, trends, forecast, resilience, isSmallDollar }) {
  const strengths = [];
  const healthScore = clamp(Math.round(Number(health?.healthScore) || 0), 0, 100);
  const reconciliationScore = clamp(Math.round(Number(health?.reconciliationScore) || 100), 0, 100);
  const metrics = health?.sourceSnapshot?.metrics || {};
  const trendStatus = trends?.trendStatus;

  if (healthScore >= 80) {
    strengths.push(`Health score ${healthScore} indicates a strong operational baseline.`);
  }

  if (trendStatus === "stable" || trendStatus === "improving") {
    strengths.push(
      trendStatus === "improving"
        ? "Snapshot trends are improving over the monitoring window."
        : "Snapshot trends remain stable across recent snapshots.",
    );
  }

  if (
    reconciliationScore >= 80 &&
    (metrics.reconciliationMismatchCount || 0) === 0 &&
    !(health?.reasons || []).some((r) => r.code === "reconciliation_mismatch")
  ) {
    strengths.push("Reconciliation signals are clean with no active mismatch penalties.");
  }

  const resilienceLevel = resilience?.resilienceLevel;
  if (resilienceLevel === "resilient" || resilienceLevel === "strong") {
    strengths.push(`Treasury resilience is classified as ${resilienceLevel}.`);
  }

  if (forecast?.outlook === "stable" || forecast?.outlook === "improving") {
    strengths.push(`7-day forecast outlook is ${String(forecast.outlook).replace(/_/g, " ")}.`);
  }

  if ((health?.reasons || []).length === 0 && healthScore >= 80) {
    strengths.push("No health penalty reasons in the current scoring pass.");
  }

  if (isSmallDollar && strengths.length === 0) {
    strengths.push("Small-dollar activity remains within expected soft-launch parameters.");
  }

  if (strengths.length === 0) {
    strengths.push("Baseline treasury monitoring remains active with advisory signals available.");
  }

  return [...new Set(strengths)].slice(0, 5);
}

function buildExecutiveNextFocus({ operationalGuidance }) {
  const focus = [];

  for (const p of operationalGuidance?.priorities || []) {
    focus.push(p.title);
  }

  for (const w of operationalGuidance?.watchItems || []) {
    focus.push(w);
  }

  for (const c of operationalGuidance?.recommendedChecks || []) {
    if (focus.length >= 6) break;
    focus.push(c);
  }

  if (focus.length === 0) {
    focus.push("Continue monitoring payout exposure and repeated alert patterns.");
    focus.push("Maintain normal snapshot refresh cadence.");
  }

  return [...new Set(focus)].slice(0, 6);
}

const EMPTY_HISTORICAL_ANALYTICS = Object.freeze({
  analyticsSummary: "Historical analytics unavailable — insufficient snapshot data.",
  historicalHealthTrend: {
    direction: "insufficient_data",
    summary: "Fewer than three snapshots — health trend history is not yet available.",
    dataPoints: [],
  },
  historicalRiskTrend: {
    direction: "insufficient_data",
    summary: "Risk level history requires additional snapshots before transitions can be assessed.",
    transitions: [],
    stablePeriods: 0,
    dataPoints: [],
  },
  exposureTrend: {
    direction: "stable",
    summary: "Exposure history is not yet available.",
    dataPoints: [],
  },
  liabilityTrend: {
    direction: "stable",
    summary: "Liability history is not yet available.",
    dataPoints: [],
  },
  resilienceTrend: {
    direction: "unknown",
    summary: "Resilience movement cannot be derived without sufficient snapshot history.",
    fromLevel: null,
    toLevel: null,
    dataPoints: [],
  },
  volatilityIndicators: [],
  notableChanges: [],
  confidence: 0,
});

function normalizeHistoricalSnapshots(snapshots) {
  const rows = (snapshots || [])
    .map((row) => (row?.healthScore != null || row?.createdAt ? row : mapTreasuryHealthRow(row)))
    .filter(Boolean)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return rows;
}

function historicalMetricDirection(change, priorValue, isSmallDollar) {
  if (isSmallDollar) {
    const delta = toFiniteNumber(change);
    if (Math.abs(delta) < 1) return "stable";
    return delta > 0 ? "growth" : "decline";
  }
  if (isMaterialPositiveChange(priorValue, change)) return "growth";
  if (isMaterialNegativeChange(priorValue, change)) return "decline";
  return "stable";
}

function historicalDirectionLabel(direction) {
  const key = String(direction || "").toLowerCase();
  const labels = {
    improving: "Improving",
    deteriorating: "Deteriorating",
    stable: "Stable",
    growth: "Growth",
    decline: "Decline",
    escalating: "Escalating",
    de_escalating: "De-escalating",
    mixed: "Mixed",
    insufficient_data: "Insufficient data",
    unknown: "Unknown",
  };
  return labels[key] || "Unknown";
}

function buildHistoricalDataPoints(rows, valueKey) {
  return rows.map((row) => ({
    value: valueKey === "riskLevel" ? riskRank(row.treasuryRiskLevel) : toFiniteNumber(row[valueKey]),
    label: valueKey === "riskLevel" ? String(row.treasuryRiskLevel || "low") : undefined,
    createdAt: row.createdAt,
  }));
}

function computeResilienceProxyFromSnapshot(row) {
  const health = clamp(Math.round(Number(row?.healthScore) || 0), 0, 100);
  const liquidity = clamp(Math.round(Number(row?.liquidityScore) || 100), 0, 100);
  const reconciliation = clamp(Math.round(Number(row?.reconciliationScore) || 100), 0, 100);
  const pending = clamp(Math.round(Number(row?.pendingObligationScore) || 100), 0, 100);
  return clamp(Math.round(health * 0.4 + liquidity * 0.25 + reconciliation * 0.2 + pending * 0.15), 0, 100);
}

function analyzeHistoricalRiskTransitions(rows) {
  const transitions = [];
  let stablePeriods = 0;
  let runLength = 1;

  for (let i = 1; i < rows.length; i += 1) {
    const prev = String(rows[i - 1].treasuryRiskLevel || "low").toLowerCase();
    const next = String(rows[i].treasuryRiskLevel || "low").toLowerCase();
    if (prev === next) {
      runLength += 1;
      continue;
    }
    if (runLength >= 2) stablePeriods += 1;
    runLength = 1;
    transitions.push({
      from: prev,
      to: next,
      at: rows[i].createdAt,
      direction: riskRank(next) > riskRank(prev) ? "escalation" : "de-escalation",
    });
  }

  if (runLength >= 2) stablePeriods += 1;

  let direction = "stable";
  if (transitions.length === 0) {
    direction = rows.length >= TREND_MIN_SNAPSHOTS ? "stable" : "insufficient_data";
  } else {
    const escalations = transitions.filter((t) => t.direction === "escalation").length;
    const deEscalations = transitions.filter((t) => t.direction === "de-escalation").length;
    if (escalations > 0 && deEscalations === 0) direction = "escalating";
    else if (deEscalations > 0 && escalations === 0) direction = "de_escalating";
    else direction = "mixed";
  }

  return { transitions, stablePeriods, direction };
}

function computeSeriesVariance(values) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function countDirectionReversals(values) {
  if (values.length < 3) return 0;
  let reversals = 0;
  for (let i = 2; i < values.length; i += 1) {
    const prevDelta = values[i - 1] - values[i - 2];
    const nextDelta = values[i] - values[i - 1];
    if (prevDelta !== 0 && nextDelta !== 0 && Math.sign(prevDelta) !== Math.sign(nextDelta)) {
      reversals += 1;
    }
  }
  return reversals;
}

function deriveHistoricalVolatilityIndicators({ rows, trends, isSmallDollar }) {
  const indicators = [];
  const healthScores = rows.map((r) => clamp(Math.round(Number(r.healthScore) || 0), 0, 100));
  const exposureValues = rows.map((r) => toFiniteNumber(r.pendingWithdrawalExposure));
  const liabilityValues = rows.map((r) => toFiniteNumber(r.totalWalletLiabilities));

  const healthStd = computeSeriesVariance(healthScores);
  const exposureStd = computeSeriesVariance(exposureValues);
  const liabilityStd = computeSeriesVariance(liabilityValues);
  const healthReversals = countDirectionReversals(healthScores);

  if (rows.length >= TREND_MIN_SNAPSHOTS && healthStd <= (isSmallDollar ? 8 : 5)) {
    indicators.push({
      label: "Stable period",
      description: isSmallDollar
        ? "Health scores remained within a modest band across recent snapshots in this soft-launch environment."
        : "Health scores remained within a narrow band across recent snapshots, indicating a stable operating period.",
    });
  }

  if (healthReversals >= 2) {
    indicators.push({
      label: "Repeated fluctuations",
      description: isSmallDollar
        ? "Health score moved up and down across snapshots — typical for low-dollar test activity; monitor for sustained direction."
        : "Health score alternated direction across multiple snapshots, suggesting repeated short-term fluctuations rather than a single sustained trend.",
    });
  }

  const exposureThreshold = isSmallDollar ? 3 : TREND_MATERIALITY_DELTA_MIN;
  const liabilityThreshold = isSmallDollar ? 5 : TREND_MATERIALITY_DELTA_MIN;
  if (
    (exposureStd >= exposureThreshold || liabilityStd >= liabilityThreshold) &&
    rows.length >= TREND_MIN_SNAPSHOTS
  ) {
    indicators.push({
      label: "Elevated operational variance",
      description: isSmallDollar
        ? "Exposure or liability values varied across snapshots at small-dollar scale — interpret changes cautiously."
        : "Exposure or liability values varied materially across snapshots, indicating elevated operational variance in recent history.",
    });
  }

  if ((trends?.warningSignals || []).some((s) => s.code === "repeated_alert_pattern") && rows.length >= TREND_MIN_SNAPSHOTS) {
    indicators.push({
      label: "Repeated alert pattern",
      description:
        "Similar treasury alerts appeared across multiple snapshots. Advisory review recommended; no automated action is implied.",
    });
  }

  return indicators;
}

function buildHistoricalNotableChanges({
  rows,
  trends,
  forecast,
  resilience,
  isSmallDollar,
  healthDirection,
  exposureDirection,
  liabilityDirection,
  riskAnalysis,
  resilienceTrend,
}) {
  const notes = [];
  const count = rows.length;

  if (count >= TREND_MIN_SNAPSHOTS && healthDirection === "stable" && exposureDirection === "stable" && liabilityDirection === "stable") {
    notes.push(
      isSmallDollar
        ? "Treasury remained broadly stable across recent snapshots at soft-launch dollar levels."
        : "Treasury remained stable across recent snapshots with no material health, exposure, or liability drift.",
    );
  }

  if (exposureDirection === "growth") {
    notes.push(
      isSmallDollar
        ? "Pending withdrawal exposure increased modestly relative to earlier snapshots."
        : "Pending withdrawal exposure increased relative to earlier snapshots — monitor payout queue pressure.",
    );
  } else if (exposureDirection === "decline") {
    notes.push("Pending withdrawal exposure declined relative to earlier snapshots.");
  }

  if (liabilityDirection === "growth") {
    notes.push(
      isSmallDollar
        ? "Wallet liabilities increased modestly across the snapshot window."
        : "Total wallet liabilities grew across the snapshot window.",
    );
  } else if (liabilityDirection === "decline") {
    notes.push("Total wallet liabilities declined across the snapshot window.");
  }

  if (healthDirection === "improving") {
    notes.push("Treasury health score trended upward across recent snapshot history.");
  } else if (healthDirection === "deteriorating") {
    notes.push(
      isSmallDollar
        ? "Treasury health score softened across recent snapshots — review in context of low-dollar activity."
        : "Treasury health score declined across recent snapshots — advisory review recommended.",
    );
  }

  if (riskAnalysis.transitions.length > 0) {
    const latest = riskAnalysis.transitions[riskAnalysis.transitions.length - 1];
    notes.push(
      `Risk level transitioned from ${String(latest.from).toUpperCase()} to ${String(latest.to).toUpperCase()} during the snapshot window.`,
    );
  } else if (count >= TREND_MIN_SNAPSHOTS && riskAnalysis.direction === "stable") {
    notes.push(`Treasury risk level remained ${String(rows[rows.length - 1].treasuryRiskLevel || "low").toUpperCase()} across recent snapshots.`);
  }

  if (resilienceTrend.fromLevel && resilienceTrend.toLevel && resilienceTrend.fromLevel !== resilienceTrend.toLevel) {
    notes.push(
      `Resilience proxy moved from ${resilienceTrend.fromLevel} to ${resilienceTrend.toLevel} based on historical component scores.`,
    );
  } else if (resilience?.resilienceLevel && count >= TREND_MIN_SNAPSHOTS) {
    notes.push(`Current resilience posture is classified as ${resilience.resilienceLevel}.`);
  }

  if (forecast?.outlook && forecast.outlook !== "insufficient_data" && count >= TREND_MIN_SNAPSHOTS) {
    notes.push(`Forecast outlook (${forecast.outlook.replace(/_/g, " ")}) aligns with observed historical patterns.`);
  }

  if (notes.length === 0) {
    notes.push("Accumulate additional snapshots to surface notable historical changes.");
  }

  return [...new Set(notes)].slice(0, 8);
}

function computeHistoricalAnalyticsConfidence({ rows, trends, forecast, resilience }) {
  const historyCount = rows.length;
  let score = computeTrendConfidence(rows);

  if (historyCount >= 7) score += 10;
  else if (historyCount >= TREND_MIN_SNAPSHOTS) score += 5;

  if (trends?.confidence != null) {
    score = Math.round(score * 0.55 + clamp(Math.round(Number(trends.confidence) || 0), 0, 100) * 0.25);
  }
  if (forecast?.confidence != null) {
    score = Math.round(score * 0.85 + clamp(Math.round(Number(forecast.confidence) || 0), 0, 100) * 0.15);
  }
  if (resilience?.resilienceScore != null && historyCount >= TREND_MIN_SNAPSHOTS) {
    score += 3;
  }

  if (historyCount < TREND_MIN_SNAPSHOTS) {
    score = Math.min(score, 40);
  }
  if (historyCount < 2) {
    score = Math.min(score, 20);
  }

  return clamp(Math.round(score), 0, 100);
}

/**
 * Historical treasury analytics from snapshot history (read-only, advisory).
 * Does not mutate wallets, payouts, transactions, or persist snapshots.
 * @param {{
 *   treasury_health_snapshots?: object[],
 *   trends?: object,
 *   forecast?: object,
 *   resilience?: object,
 *   alerts?: object[],
 * }} [input]
 */
export function calculateTreasuryHistoricalAnalytics({
  treasury_health_snapshots: snapshotsInput,
  trends = {},
  forecast = {},
  resilience = {},
  alerts = [],
} = {}) {
  try {
    const rows = normalizeHistoricalSnapshots(snapshotsInput);
    const historyCount = rows.length;

    if (historyCount === 0) {
      return { ...EMPTY_HISTORICAL_ANALYTICS };
    }

    const newest = rows[rows.length - 1];
    const oldest = rows[0];
    const exposure = toFiniteNumber(newest.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(newest.totalWalletLiabilities);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    if (historyCount < TREND_MIN_SNAPSHOTS) {
      return {
        ...EMPTY_HISTORICAL_ANALYTICS,
        analyticsSummary: isSmallDollar
          ? `${historyCount} snapshot${historyCount === 1 ? "" : "s"} recorded — historical trend analysis requires at least three entries. Soft-launch dollar levels apply.`
          : `${historyCount} snapshot${historyCount === 1 ? "" : "s"} recorded — historical trend analysis requires at least three entries.`,
        historicalHealthTrend: {
          direction: "insufficient_data",
          summary: "Health trend history will populate after additional snapshots accumulate.",
          dataPoints: buildHistoricalDataPoints(rows, "healthScore"),
        },
        historicalRiskTrend: {
          direction: "insufficient_data",
          summary: "Risk transition history requires at least three snapshots.",
          transitions: [],
          stablePeriods: 0,
          dataPoints: buildHistoricalDataPoints(rows, "riskLevel"),
        },
        exposureTrend: {
          direction: "stable",
          summary: "Exposure trend pending sufficient snapshot history.",
          dataPoints: buildHistoricalDataPoints(rows, "pendingWithdrawalExposure"),
        },
        liabilityTrend: {
          direction: "stable",
          summary: "Liability trend pending sufficient snapshot history.",
          dataPoints: buildHistoricalDataPoints(rows, "totalWalletLiabilities"),
        },
        confidence: computeHistoricalAnalyticsConfidence({ rows, trends, forecast, resilience }),
      };
    }

    const healthScoreChange = Math.round((newest.healthScore || 0) - (oldest.healthScore || 0));
    const liabilityChange = toFiniteNumber(newest.totalWalletLiabilities) - toFiniteNumber(oldest.totalWalletLiabilities);
    const exposureChange =
      toFiniteNumber(newest.pendingWithdrawalExposure) - toFiniteNumber(oldest.pendingWithdrawalExposure);
    const priorLiabilities = toFiniteNumber(oldest.totalWalletLiabilities);
    const priorExposure = toFiniteNumber(oldest.pendingWithdrawalExposure);

    let healthDirection = trends?.trendStatus || "stable";
    if (healthDirection === "insufficient_data") {
      healthDirection = deriveTrendStatus({
        historyCount,
        healthScoreChange,
        riskDelta: riskRank(newest.treasuryRiskLevel) - riskRank(oldest.treasuryRiskLevel),
        liabilityChange,
        priorLiabilities,
        exposureChange,
        priorExposure,
        reconciliationScoreChange: Math.round(
          (newest.reconciliationScore || 0) - (oldest.reconciliationScore || 0),
        ),
      });
    }

    const exposureDirection = historicalMetricDirection(exposureChange, priorExposure, isSmallDollar);
    const liabilityDirection = historicalMetricDirection(liabilityChange, priorLiabilities, isSmallDollar);
    const riskAnalysis = analyzeHistoricalRiskTransitions(rows);

    const resilienceProxies = rows.map((row) => ({
      score: computeResilienceProxyFromSnapshot(row),
      level: resilienceScoreToLevel(computeResilienceProxyFromSnapshot(row)),
      createdAt: row.createdAt,
    }));
    const fromResilienceLevel = resilienceProxies[0]?.level || null;
    const toResilienceLevel = resilienceProxies[resilienceProxies.length - 1]?.level || null;
    let resilienceDirection = "stable";
    const resilienceRank = { weak: 0, moderate: 1, strong: 2, resilient: 3 };
    const resilienceDelta =
      (resilienceRank[toResilienceLevel] ?? 1) - (resilienceRank[fromResilienceLevel] ?? 1);
    if (resilienceDelta > 0) resilienceDirection = "improving";
    else if (resilienceDelta < 0) resilienceDirection = "deteriorating";

    const resilienceTrend = {
      direction: fromResilienceLevel && toResilienceLevel ? resilienceDirection : "unknown",
      fromLevel: fromResilienceLevel,
      toLevel: toResilienceLevel,
      summary:
        fromResilienceLevel && toResilienceLevel
          ? fromResilienceLevel === toResilienceLevel
            ? isSmallDollar
              ? `Resilience proxy remained ${toResilienceLevel} across recent snapshots at soft-launch scale.`
              : `Resilience proxy remained ${toResilienceLevel} across recent snapshot history.`
            : isSmallDollar
              ? `Resilience proxy moved from ${fromResilienceLevel} to ${toResilienceLevel} — interpret cautiously at low-dollar levels.`
              : `Resilience proxy moved from ${fromResilienceLevel} to ${toResilienceLevel} based on historical liquidity, reconciliation, and obligation scores.`
          : "Resilience movement could not be derived from available snapshot fields.",
      dataPoints: resilienceProxies.map((p) => ({ value: p.score, createdAt: p.createdAt })),
    };

    const historicalHealthTrend = {
      direction: healthDirection,
      summary:
        healthDirection === "improving"
          ? isSmallDollar
            ? `Health score improved by ${Math.abs(healthScoreChange)} points across ${historyCount} snapshots — modest upward movement at soft-launch scale.`
            : `Health score improved by ${Math.abs(healthScoreChange)} points across ${historyCount} snapshots.`
          : healthDirection === "deteriorating"
            ? isSmallDollar
              ? `Health score softened by ${Math.abs(healthScoreChange)} points across ${historyCount} snapshots — review in context of test activity.`
              : `Health score declined by ${Math.abs(healthScoreChange)} points across ${historyCount} snapshots — advisory monitoring recommended.`
            : isSmallDollar
              ? `Health score remained broadly stable across ${historyCount} recent snapshots at soft-launch dollar levels.`
              : `Health score remained stable across ${historyCount} recent snapshots (${oldest.healthScore} → ${newest.healthScore}).`,
      dataPoints: buildHistoricalDataPoints(rows, "healthScore"),
    };

    const transitionSummary =
      riskAnalysis.transitions.length === 0
        ? `Risk level held at ${String(newest.treasuryRiskLevel || "low").toUpperCase()} across ${historyCount} snapshots (${riskAnalysis.stablePeriods} stable period${riskAnalysis.stablePeriods === 1 ? "" : "s"}).`
        : `${riskAnalysis.transitions.length} risk transition${riskAnalysis.transitions.length === 1 ? "" : "s"} observed across snapshot history${riskAnalysis.stablePeriods > 0 ? ` with ${riskAnalysis.stablePeriods} repeated stable period${riskAnalysis.stablePeriods === 1 ? "" : "s"}` : ""}.`;

    const historicalRiskTrend = {
      direction: riskAnalysis.direction,
      summary: isSmallDollar ? `${transitionSummary} Soft-launch materiality guards apply.` : transitionSummary,
      transitions: riskAnalysis.transitions,
      stablePeriods: riskAnalysis.stablePeriods,
      dataPoints: buildHistoricalDataPoints(rows, "riskLevel"),
    };

    const exposureTrend = {
      direction: exposureDirection,
      summary:
        exposureDirection === "growth"
          ? isSmallDollar
            ? "Pending withdrawal exposure increased modestly across snapshot history."
            : `Pending withdrawal exposure increased by ${formatReportMoney(Math.abs(exposureChange))} from oldest to newest snapshot.`
          : exposureDirection === "decline"
            ? isSmallDollar
              ? "Pending withdrawal exposure declined modestly across snapshot history."
              : `Pending withdrawal exposure declined by ${formatReportMoney(Math.abs(exposureChange))} from oldest to newest snapshot.`
            : isSmallDollar
              ? "Pending withdrawal exposure remained stable across recent snapshot history."
              : "Pending withdrawal exposure remained stable across recent snapshot history.",
      dataPoints: buildHistoricalDataPoints(rows, "pendingWithdrawalExposure"),
    };

    const liabilityTrend = {
      direction: liabilityDirection,
      summary:
        liabilityDirection === "growth"
          ? isSmallDollar
            ? "Wallet liabilities increased modestly across snapshot history."
            : `Wallet liabilities increased by ${formatReportMoney(Math.abs(liabilityChange))} from oldest to newest snapshot.`
          : liabilityDirection === "decline"
            ? isSmallDollar
              ? "Wallet liabilities declined modestly across snapshot history."
              : `Wallet liabilities declined by ${formatReportMoney(Math.abs(liabilityChange))} from oldest to newest snapshot.`
            : isSmallDollar
              ? "Wallet liabilities remained stable across recent snapshot history."
              : "Wallet liabilities remained stable across recent snapshot history.",
      dataPoints: buildHistoricalDataPoints(rows, "totalWalletLiabilities"),
    };

    const volatilityIndicators = deriveHistoricalVolatilityIndicators({ rows, trends, isSmallDollar });

    const notableChanges = buildHistoricalNotableChanges({
      rows,
      trends,
      forecast,
      resilience,
      isSmallDollar,
      healthDirection,
      exposureDirection,
      liabilityDirection,
      riskAnalysis,
      resilienceTrend,
    });

    const analyticsSummaryParts = [
      `Historical analytics across ${historyCount} snapshots:`,
      `health ${historicalDirectionLabel(healthDirection).toLowerCase()},`,
      `risk ${historicalDirectionLabel(riskAnalysis.direction).toLowerCase()},`,
      `exposure ${exposureDirection},`,
      `liabilities ${liabilityDirection}.`,
    ];
    if (isSmallDollar) {
      analyticsSummaryParts.push("Soft-launch materiality guards applied — conclusions are intentionally conservative.");
    }
    if ((alerts || []).length > 0) {
      analyticsSummaryParts.push(`${alerts.length} active alert${alerts.length === 1 ? "" : "s"} present in the current snapshot.`);
    }

    const confidence = computeHistoricalAnalyticsConfidence({ rows, trends, forecast, resilience });

    return {
      analyticsSummary: analyticsSummaryParts.join(" "),
      historicalHealthTrend,
      historicalRiskTrend,
      exposureTrend,
      liabilityTrend,
      resilienceTrend,
      volatilityIndicators,
      notableChanges,
      confidence,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryHistoricalAnalytics", err: err?.message || err });
    return { ...EMPTY_HISTORICAL_ANALYTICS };
  }
}

const EMPTY_MONITORING_DASHBOARD = Object.freeze({
  dashboardSummary: "Treasury monitoring dashboard unavailable — insufficient snapshot data.",
  healthTimeline: {
    direction: "insufficient_data",
    summary: "Health evolution requires snapshot history.",
    dataPoints: [],
    segments: [],
  },
  pressureTimeline: {
    direction: "insufficient_data",
    summary: "Exposure pressure history requires snapshot history.",
    dataPoints: [],
    transitions: [],
  },
  riskTimeline: {
    direction: "insufficient_data",
    summary: "Risk level history requires snapshot history.",
    dataPoints: [],
    transitions: [],
    stablePeriods: 0,
  },
  treasuryMomentum: "stable",
  recentMovements: [],
  stabilitySignals: [],
  confidence: 0,
});

const PRESSURE_LEVEL_RANK = Object.freeze({ low: 0, moderate: 1, elevated: 2, severe: 3 });

function pressureLevelRank(level) {
  return PRESSURE_LEVEL_RANK[String(level || "low").toLowerCase()] ?? 0;
}

function deriveSnapshotPressureLevel(row, isSmallDollar) {
  const exposure = toFiniteNumber(row?.pendingWithdrawalExposure);
  const liabilities = toFiniteNumber(row?.totalWalletLiabilities);
  const pendingScore = clamp(Math.round(Number(row?.pendingObligationScore) || 100), 0, 100);
  const ratio = exposureLiabilityRatio(exposure, liabilities);

  if (isSmallDollar) {
    if (pendingScore < 65 || ratio >= 0.45) return "moderate";
    return "low";
  }
  if (pendingScore < 50 || ratio >= 0.5) return "elevated";
  if (pendingScore < 75 || ratio >= 0.25) return "moderate";
  return "low";
}

function snapshotHealthSegmentDirection(delta, isSmallDollar) {
  const threshold = isSmallDollar ? 5 : 3;
  if (delta > threshold) return "improving";
  if (delta < -threshold) return "weakening";
  return "stable";
}

function buildHealthTimelineSegments(rows, isSmallDollar) {
  const segments = [];
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1];
    const curr = rows[i];
    const fromScore = clamp(Math.round(Number(prev.healthScore) || 0), 0, 100);
    const toScore = clamp(Math.round(Number(curr.healthScore) || 0), 0, 100);
    segments.push({
      fromScore,
      toScore,
      direction: snapshotHealthSegmentDirection(toScore - fromScore, isSmallDollar),
      at: curr.createdAt,
    });
  }
  return segments;
}

function deriveHealthTimelineDirection(segments, historicalDirection, historyCount) {
  if (historyCount < TREND_MIN_SNAPSHOTS) return "insufficient_data";
  if (historicalDirection === "improving") return "improving";
  if (historicalDirection === "deteriorating") return "weakening";
  if (segments.length === 0) return "stable";

  const improving = segments.filter((s) => s.direction === "improving").length;
  const weakening = segments.filter((s) => s.direction === "weakening").length;
  if (improving > 0 && weakening === 0) return "improving";
  if (weakening > 0 && improving === 0) return "weakening";
  if (improving > 0 && weakening > 0) return "mixed";
  return "stable";
}

function buildPressureTimelineDataPoints(rows, isSmallDollar) {
  return rows.map((row) => ({
    value: pressureLevelRank(deriveSnapshotPressureLevel(row, isSmallDollar)),
    label: deriveSnapshotPressureLevel(row, isSmallDollar),
    createdAt: row.createdAt,
  }));
}

function analyzePressureTransitions(rows, isSmallDollar) {
  const transitions = [];
  let direction = "stable";

  for (let i = 1; i < rows.length; i += 1) {
    const prev = deriveSnapshotPressureLevel(rows[i - 1], isSmallDollar);
    const next = deriveSnapshotPressureLevel(rows[i], isSmallDollar);
    if (prev === next) continue;
    transitions.push({
      from: prev,
      to: next,
      at: rows[i].createdAt,
      direction: pressureLevelRank(next) > pressureLevelRank(prev) ? "escalation" : "de-escalation",
    });
  }

  if (transitions.length === 0) {
    direction = rows.length >= TREND_MIN_SNAPSHOTS ? "stable" : "insufficient_data";
  } else {
    const escalations = transitions.filter((t) => t.direction === "escalation").length;
    const deEscalations = transitions.filter((t) => t.direction === "de-escalation").length;
    if (escalations > 0 && deEscalations === 0) direction = "escalating";
    else if (deEscalations > 0 && escalations === 0) direction = "de-escalating";
    else direction = "mixed";
  }

  return { transitions, direction };
}

function deriveTreasuryMomentum({ healthDirection, pressureDirection, riskDirection }) {
  const healthImproving = healthDirection === "improving";
  const healthWeakening = healthDirection === "weakening" || healthDirection === "deteriorating";
  const pressureImproving = pressureDirection === "de-escalating" || pressureDirection === "decline";
  const pressureWeakening = pressureDirection === "escalating" || pressureDirection === "growth";
  const riskImproving = riskDirection === "de_escalating";
  const riskWeakening = riskDirection === "escalating";

  const improvingSignals = [healthImproving, pressureImproving, riskImproving].filter(Boolean).length;
  const weakeningSignals = [healthWeakening, pressureWeakening, riskWeakening].filter(Boolean).length;

  if (improvingSignals > 0 && weakeningSignals > 0) return "mixed";
  if (weakeningSignals >= 2 || (weakeningSignals === 1 && improvingSignals === 0)) return "weakening";
  if (improvingSignals >= 2 || (improvingSignals === 1 && weakeningSignals === 0)) return "improving";
  if (healthDirection === "mixed" || pressureDirection === "mixed" || riskDirection === "mixed") return "mixed";
  return "stable";
}

function buildMonitoringRecentMovements({ rows, historicalAnalytics, resilience, forecast, isSmallDollar }) {
  const movements = [];
  const count = rows.length;

  if (count < 2) {
    movements.push("Accumulate additional snapshots to compare recent treasury movement.");
    return movements;
  }

  const prev = rows[count - 2];
  const curr = rows[count - 1];
  const healthDelta = (curr.healthScore || 0) - (prev.healthScore || 0);
  const exposureDelta =
    toFiniteNumber(curr.pendingWithdrawalExposure) - toFiniteNumber(prev.pendingWithdrawalExposure);
  const reconDelta = (curr.reconciliationScore || 0) - (prev.reconciliationScore || 0);
  const prevRisk = String(prev.treasuryRiskLevel || "low").toLowerCase();
  const currRisk = String(curr.treasuryRiskLevel || "low").toLowerCase();
  const prevPressure = deriveSnapshotPressureLevel(prev, isSmallDollar);
  const currPressure = deriveSnapshotPressureLevel(curr, isSmallDollar);

  if (Math.abs(healthDelta) <= (isSmallDollar ? 5 : 3)) {
    movements.push("Treasury health unchanged between the two most recent snapshots.");
  } else if (healthDelta > 0) {
    movements.push(
      isSmallDollar
        ? "Treasury health improved modestly between recent snapshots."
        : `Treasury health improved by ${healthDelta} points between recent snapshots.`,
    );
  } else {
    movements.push(
      isSmallDollar
        ? "Treasury health softened modestly between recent snapshots."
        : `Treasury health softened by ${Math.abs(healthDelta)} points between recent snapshots.`,
    );
  }

  if (Math.abs(exposureDelta) < (isSmallDollar ? 1 : TREND_MATERIALITY_DELTA_MIN)) {
    movements.push("Exposure remained stable between the two most recent snapshots.");
  } else if (exposureDelta > 0) {
    movements.push(
      isSmallDollar
        ? "Pending withdrawal exposure increased modestly."
        : "Pending withdrawal exposure increased between recent snapshots.",
    );
  } else {
    movements.push("Pending withdrawal exposure declined between recent snapshots.");
  }

  if (prevPressure === currPressure) {
    movements.push(`Payout pressure remained ${currPressure} across recent snapshots.`);
  } else {
    movements.push(`Payout pressure moved from ${prevPressure} to ${currPressure}.`);
  }

  if (prevRisk !== currRisk) {
    movements.push(`Risk level transitioned from ${prevRisk.toUpperCase()} to ${currRisk.toUpperCase()}.`);
  } else {
    movements.push(`Risk level remained ${currRisk.toUpperCase()}.`);
  }

  if (Math.abs(reconDelta) <= 2) {
    movements.push("Reconciliation score held steady between recent snapshots.");
  } else if (reconDelta > 0) {
    movements.push("Reconciliation score improved between recent snapshots.");
  } else {
    movements.push("Reconciliation score softened between recent snapshots.");
  }

  const resilienceDirection = historicalAnalytics?.resilienceTrend?.direction;
  if (resilienceDirection === "improving") {
    movements.push("Resilience improved across recent snapshot history.");
  } else if (resilienceDirection === "deteriorating") {
    movements.push(
      isSmallDollar
        ? "Resilience proxy softened modestly — interpret at soft-launch scale."
        : "Resilience proxy softened across recent snapshot history.",
    );
  }

  if (forecast?.outlook && forecast.outlook !== "insufficient_data" && count >= TREND_MIN_SNAPSHOTS) {
    movements.push(`Forecast outlook remains ${String(forecast.outlook).replace(/_/g, " ")}.`);
  }

  if (resilience?.resilienceLevel && resilience.resilienceLevel !== "unknown" && count >= TREND_MIN_SNAPSHOTS) {
    movements.push(`Current resilience posture: ${resilience.resilienceLevel}.`);
  }

  return [...new Set(movements)].slice(0, 8);
}

function buildMonitoringStabilitySignals({
  rows,
  historicalAnalytics,
  classifiedAlerts,
  isSmallDollar,
}) {
  const signals = [];

  for (const indicator of historicalAnalytics?.volatilityIndicators || []) {
    signals.push(`${indicator.label}: ${indicator.description}`);
  }

  if (rows.length >= TREND_MIN_SNAPSHOTS) {
    const healthScores = rows.map((r) => clamp(Math.round(Number(r.healthScore) || 0), 0, 100));
    const healthStd = computeSeriesVariance(healthScores);
    if (healthStd <= (isSmallDollar ? 8 : 5)) {
      signals.push(
        isSmallDollar
          ? "Low health-score variance across recent snapshots at soft-launch dollar levels."
          : "Low health-score variance across recent snapshots — treasury operating within a narrow band.",
      );
    }

    const reconScores = rows.map((r) => clamp(Math.round(Number(r.reconciliationScore) || 100), 0, 100));
    const reconStd = computeSeriesVariance(reconScores);
    if (reconStd <= 3 && reconScores.every((s) => s >= 80)) {
      signals.push("Reconciliation scores remained consistent across snapshot history.");
    } else if (reconStd <= 5) {
      signals.push("Reconciliation movement remained within a modest range across snapshots.");
    }
  }

  const riskStablePeriods = historicalAnalytics?.historicalRiskTrend?.stablePeriods || 0;
  if (riskStablePeriods >= 1 && rows.length >= TREND_MIN_SNAPSHOTS) {
    signals.push(
      `${riskStablePeriods} stable risk period${riskStablePeriods === 1 ? "" : "s"} observed across snapshot history.`,
    );
  }

  const alertCount = classifiedAlerts?.classifiedAlerts?.length || 0;
  if (alertCount >= 2) {
    signals.push(
      `${alertCount} classified alert${alertCount === 1 ? "" : "s"} present — review for repeated patterns; advisory only.`,
    );
  } else if (alertCount === 0 && rows.length >= TREND_MIN_SNAPSHOTS) {
    signals.push("No classified treasury alerts in the current monitoring window.");
  }

  const exposureDirection = historicalAnalytics?.exposureTrend?.direction;
  const liabilityDirection = historicalAnalytics?.liabilityTrend?.direction;
  if (
    exposureDirection === "stable" &&
    liabilityDirection === "stable" &&
    rows.length >= TREND_MIN_SNAPSHOTS
  ) {
    signals.push(
      isSmallDollar
        ? "Exposure and liabilities both stable — typical for low-dollar operational periods."
        : "Exposure and liabilities both stable across recent snapshot history.",
    );
  }

  if (signals.length === 0) {
    signals.push("Accumulate additional snapshots to surface stability signals.");
  }

  return [...new Set(signals)].slice(0, 8);
}

function computeMonitoringDashboardConfidence({
  rows,
  historicalAnalytics,
  trends,
  forecast,
  classifiedAlerts,
}) {
  let score = historicalAnalytics?.confidence ?? 0;
  if (score === 0) {
    score = computeHistoricalAnalyticsConfidence({ rows, trends, forecast, resilience: {} });
  }

  if (rows.length >= 7) score += 5;
  else if (rows.length >= TREND_MIN_SNAPSHOTS) score += 3;

  if (classifiedAlerts?.confidence != null) {
    score = Math.round(score * 0.85 + clamp(Math.round(Number(classifiedAlerts.confidence) || 0), 0, 100) * 0.15);
  }

  if (rows.length < TREND_MIN_SNAPSHOTS) {
    score = Math.min(score, 45);
  }
  if (rows.length < 2) {
    score = Math.min(score, 25);
  }

  return clamp(Math.round(score), 0, 100);
}

/**
 * Treasury monitoring dashboard layer — snapshot-to-snapshot operational visibility (read-only, advisory).
 * Does not mutate wallets, payouts, transactions, or persist snapshots.
 * @param {{
 *   treasury_health_snapshots?: object[],
 *   historicalAnalytics?: object,
 *   trends?: object,
 *   forecast?: object,
 *   resilience?: object,
 *   operationalGuidance?: object,
 *   classifiedAlerts?: object,
 * }} [input]
 */
export function buildTreasuryMonitoringDashboard({
  treasury_health_snapshots: snapshotsInput,
  historicalAnalytics = {},
  trends = {},
  forecast = {},
  resilience = {},
  operationalGuidance = {},
  classifiedAlerts = {},
} = {}) {
  try {
    const rows = normalizeHistoricalSnapshots(snapshotsInput);
    const historyCount = rows.length;

    if (historyCount === 0) {
      return { ...EMPTY_MONITORING_DASHBOARD };
    }

    const newest = rows[rows.length - 1];
    const exposure = toFiniteNumber(newest.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(newest.totalWalletLiabilities);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    const healthSegments = buildHealthTimelineSegments(rows, isSmallDollar);
    const healthHistoricalDirection = historicalAnalytics?.historicalHealthTrend?.direction || "insufficient_data";
    const healthDirection = deriveHealthTimelineDirection(
      healthSegments,
      healthHistoricalDirection,
      historyCount,
    );

    const healthTimeline = {
      direction: healthDirection,
      summary:
        historyCount < TREND_MIN_SNAPSHOTS
          ? isSmallDollar
            ? `${historyCount} snapshot${historyCount === 1 ? "" : "s"} recorded — health evolution timeline requires at least three entries. Soft-launch materiality guards apply.`
            : `${historyCount} snapshot${historyCount === 1 ? "" : "s"} recorded — health evolution timeline requires at least three entries.`
          : healthDirection === "improving"
            ? isSmallDollar
              ? "Health score trended upward across recent snapshots at soft-launch scale."
              : "Health score trended upward across recent snapshot-to-snapshot comparisons."
            : healthDirection === "weakening"
              ? isSmallDollar
                ? "Health score softened across recent snapshots — review in context of low-dollar activity."
                : "Health score softened across recent snapshot-to-snapshot comparisons — advisory monitoring recommended."
              : healthDirection === "mixed"
                ? "Health score moved in both directions across recent snapshots — no single sustained trend."
                : isSmallDollar
                  ? "Health score remained broadly stable across recent snapshots at soft-launch dollar levels."
                  : "Health score remained stable across recent snapshot-to-snapshot comparisons.",
      dataPoints: buildHistoricalDataPoints(rows, "healthScore"),
      segments: healthSegments,
    };

    const pressureAnalysis = analyzePressureTransitions(rows, isSmallDollar);
    const exposureDirection = historicalAnalytics?.exposureTrend?.direction || "stable";
    const pressureDirection =
      pressureAnalysis.direction !== "insufficient_data"
        ? pressureAnalysis.direction
        : exposureDirection === "growth"
          ? "escalating"
          : exposureDirection === "decline"
            ? "de-escalating"
            : "stable";

    const currentPressure = deriveSnapshotPressureLevel(newest, isSmallDollar);
    const pressureTimeline = {
      direction: pressureDirection,
      summary:
        historyCount < TREND_MIN_SNAPSHOTS
          ? "Exposure pressure timeline pending sufficient snapshot history."
          : pressureAnalysis.transitions.length === 0
            ? isSmallDollar
              ? `Payout exposure pressure remained ${currentPressure} across recent snapshots at soft-launch scale.`
              : `Payout exposure pressure remained ${currentPressure} across recent snapshot history.`
            : isSmallDollar
              ? `${pressureAnalysis.transitions.length} pressure transition${pressureAnalysis.transitions.length === 1 ? "" : "s"} observed — interpret cautiously at low-dollar levels.`
              : `${pressureAnalysis.transitions.length} pressure transition${pressureAnalysis.transitions.length === 1 ? "" : "s"} observed across snapshot history (low → elevated visibility).`,
      dataPoints: buildPressureTimelineDataPoints(rows, isSmallDollar),
      transitions: pressureAnalysis.transitions,
    };

    const riskAnalysis = analyzeHistoricalRiskTransitions(rows);
    const riskTimeline = {
      direction: riskAnalysis.direction,
      summary:
        historyCount < TREND_MIN_SNAPSHOTS
          ? "Risk level timeline requires additional snapshots before transitions can be assessed."
          : riskAnalysis.transitions.length === 0
            ? isSmallDollar
              ? `Risk level held at ${String(newest.treasuryRiskLevel || "low").toUpperCase()} across recent snapshots. Soft-launch materiality guards apply.`
              : `Risk level held at ${String(newest.treasuryRiskLevel || "low").toUpperCase()} across ${historyCount} snapshots (${riskAnalysis.stablePeriods} stable period${riskAnalysis.stablePeriods === 1 ? "" : "s"}).`
            : isSmallDollar
              ? `${riskAnalysis.transitions.length} risk transition${riskAnalysis.transitions.length === 1 ? "" : "s"} observed — review in context of test activity.`
              : `${riskAnalysis.transitions.length} risk transition${riskAnalysis.transitions.length === 1 ? "" : "s"} recorded across snapshot history.`,
      dataPoints: buildHistoricalDataPoints(rows, "riskLevel"),
      transitions: riskAnalysis.transitions,
      stablePeriods: riskAnalysis.stablePeriods,
    };

    const treasuryMomentum = deriveTreasuryMomentum({
      healthDirection,
      pressureDirection,
      riskDirection: riskAnalysis.direction,
    });

    const recentMovements = buildMonitoringRecentMovements({
      rows,
      historicalAnalytics,
      resilience,
      forecast,
      isSmallDollar,
    });

    const stabilitySignals = buildMonitoringStabilitySignals({
      rows,
      historicalAnalytics,
      classifiedAlerts,
      isSmallDollar,
    });

    const confidence = computeMonitoringDashboardConfidence({
      rows,
      historicalAnalytics,
      trends,
      forecast,
      classifiedAlerts,
    });

    const dashboardSummaryParts = [
      `Treasury monitoring across ${historyCount} snapshot${historyCount === 1 ? "" : "s"}:`,
      `momentum ${treasuryMomentum},`,
      `health ${healthDirection},`,
      `pressure ${pressureDirection},`,
      `risk ${historicalDirectionLabel(riskAnalysis.direction).toLowerCase()}.`,
    ];
    if (isSmallDollar) {
      dashboardSummaryParts.push("Soft-launch materiality guards applied — conclusions are intentionally conservative.");
    }
    if (operationalGuidance?.operationalStatus) {
      dashboardSummaryParts.push(`Operational posture: ${operationalGuidance.operationalStatus}.`);
    }

    return {
      dashboardSummary: dashboardSummaryParts.join(" "),
      healthTimeline,
      pressureTimeline,
      riskTimeline,
      treasuryMomentum,
      recentMovements,
      stabilitySignals,
      confidence,
    };
  } catch (err) {
    warn({ op: "buildTreasuryMonitoringDashboard", err: err?.message || err });
    return { ...EMPTY_MONITORING_DASHBOARD };
  }
}

/**
 * Executive summary layer synthesizing treasury intelligence outputs (read-only, advisory).
 * Does not mutate wallets, payouts, transactions, or persist snapshots.
 * @param {{
 *   treasuryHealth?: object,
 *   health?: object,
 *   trends?: object,
 *   forecast?: object,
 *   scenarios?: object,
 *   resilience?: object,
 *   explainability?: object,
 *   operationalGuidance?: object,
 * }} [input]
 */
export function calculateTreasuryExecutiveSummary({
  treasuryHealth,
  health: healthAlias,
  trends = {},
  forecast = {},
  scenarios = {},
  resilience = {},
  explainability = {},
  operationalGuidance = {},
} = {}) {
  try {
    const health = treasuryHealth || healthAlias;
    if (!health?.healthScore && health?.healthScore !== 0) {
      return { ...EMPTY_EXECUTIVE_SUMMARY };
    }

    const metrics = health?.sourceSnapshot?.metrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    const operationalStatus = operationalGuidance?.operationalStatus || "monitor";
    const executiveStatus = mapOperationalStatusToExecutiveStatus(operationalStatus);
    const healthScore = clamp(Math.round(Number(health?.healthScore) || 0), 0, 100);
    const riskLevel = health?.treasuryRiskLevel || healthScoreToRiskLevel(healthScore);

    const headline = buildExecutiveHeadline({
      executiveStatus,
      healthScore,
      riskLevel,
      isSmallDollar,
    });

    let summary = buildExecutiveSummaryParagraph({
      executiveStatus,
      health,
      trends,
      forecast,
      resilience,
      operationalGuidance,
      explainability,
      isSmallDollar,
    });

    if (isSmallDollar && !summary.includes("soft-launch") && !summary.includes("test environment")) {
      summary = `${summary} Activity reflects a soft-launch or test environment with dollar amounts below materiality thresholds.`;
    }

    const confidence = computeExecutiveSummaryConfidence({
      health,
      trends,
      forecast,
      resilience,
      operationalGuidance,
    });

    return {
      executiveStatus,
      headline,
      summary,
      keyMetrics: buildExecutiveKeyMetrics({ health, trends, forecast, resilience }),
      keyRisks: buildExecutiveKeyRisks({ trends, forecast, scenarios, operationalGuidance, isSmallDollar, resilience }),
      keyStrengths: buildExecutiveKeyStrengths({ health, trends, forecast, resilience, isSmallDollar }),
      nextFocus: buildExecutiveNextFocus({ operationalGuidance }),
      confidence,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryExecutiveSummary", err: err?.message || err });
    return { ...EMPTY_EXECUTIVE_SUMMARY };
  }
}

const EMPTY_ALERT_CLASSIFICATION = Object.freeze({
  alertSummary: "Treasury alert classification unavailable — baseline data required.",
  alertPriority: "low",
  classifiedAlerts: [],
  routingSuggestions: [],
  confidence: 0,
});

const ALERT_CODE_CATEGORY_MAP = Object.freeze({
  high_payout_pressure: "exposure",
  large_pending_obligations: "exposure",
  elevated_funding_failures: "funding",
  reconciliation_mismatch: "reconciliation",
  negative_balance_anomaly: "reconciliation",
  liquidity_pressure: "liquidity",
  transaction_surge: "volatility",
  liability_growth_spike: "volatility",
});

const ALERT_PRIORITY_RANK = Object.freeze({ low: 0, medium: 1, elevated: 2, high: 3 });

function alertPriorityRank(priority) {
  return ALERT_PRIORITY_RANK[String(priority || "low").toLowerCase()] ?? 0;
}

function maxAlertPriority(priorities) {
  let best = "low";
  for (const priority of priorities) {
    if (alertPriorityRank(priority) > alertPriorityRank(best)) best = priority;
  }
  return best;
}

function softenAlertPriority(priority) {
  const key = String(priority || "low").toLowerCase();
  if (key === "high") return "elevated";
  if (key === "elevated") return "medium";
  if (key === "medium") return "low";
  return "low";
}

function softenSuggestedReview(review) {
  const key = String(review || "routine").toLowerCase();
  if (key === "urgent_review") return "review_today";
  if (key === "review_today") return "monitor";
  if (key === "monitor") return "routine";
  return "routine";
}

function deriveSuggestedReviewFromPriority(priority, category) {
  const p = String(priority || "low").toLowerCase();
  const c = String(category || "").toLowerCase();
  if (p === "high" || c === "reconciliation" && p === "elevated") return "urgent_review";
  if (p === "elevated") return "review_today";
  if (p === "medium") return "monitor";
  return "routine";
}

function mapAlertCodeToPriority(code, severity) {
  const sev = String(severity || "medium").toLowerCase();
  switch (code) {
    case "negative_balance_anomaly":
      return "high";
    case "reconciliation_mismatch":
      return sev === "critical" ? "high" : "elevated";
    case "high_payout_pressure":
    case "large_pending_obligations":
      return sev === "critical" || sev === "high" ? "elevated" : "medium";
    case "elevated_funding_failures":
      return sev === "high" ? "elevated" : "medium";
    case "liquidity_pressure":
      return sev === "high" ? "elevated" : "medium";
    case "transaction_surge":
    case "liability_growth_spike":
      return "medium";
    default:
      return sev === "critical" || sev === "high" ? "elevated" : "medium";
  }
}

function buildAlertClassificationReason(code, alert, context) {
  const { hasRisingExposure, isDeteriorating, trendStatus } = context;
  switch (code) {
    case "high_payout_pressure":
    case "large_pending_obligations":
      return hasRisingExposure
        ? "Payout obligations are elevated and exposure is rising across recent snapshots."
        : "Payout obligations exceed configured safe thresholds relative to treasury capacity.";
    case "elevated_funding_failures":
      return "Multiple funding failures were detected in the last 24 hours.";
    case "reconciliation_mismatch":
      return "Wallet or ledger reconciliation signals indicate mismatches requiring review.";
    case "negative_balance_anomaly":
      return "One or more wallets report a negative balance — reconciliation review is advised.";
    case "liquidity_pressure":
      return "Pending obligations are large relative to total wallet liabilities.";
    case "transaction_surge":
      return "24-hour transaction volume exceeds the recent daily average.";
    case "liability_growth_spike":
      return "Total wallet liabilities grew sharply since the prior snapshot.";
    default:
      if (isDeteriorating) return "Treasury trend status is deteriorating — alert warrants closer review.";
      if (trendStatus === "stable") return "Alert is active but recent trends remain stable.";
      return alert?.message || "Active treasury health signal.";
  }
}

function shouldSoftenAlertClassification({ isSmallDollar, isDeteriorating, category, priority }) {
  if (!isSmallDollar || isDeteriorating) return false;
  if (category === "reconciliation" && alertPriorityRank(priority) >= alertPriorityRank("elevated")) return false;
  return true;
}

function applySmallDollarSoftening(entry, isSmallDollar, isDeteriorating) {
  if (!shouldSoftenAlertClassification({ isSmallDollar, isDeteriorating, category: entry.category, priority: entry.priority })) {
    return entry;
  }
  return {
    ...entry,
    priority: softenAlertPriority(entry.priority),
    suggestedReview: softenSuggestedReview(entry.suggestedReview),
    reason: `${entry.reason} Dollar amounts remain below materiality thresholds — priority softened accordingly.`,
  };
}

function classifyTreasuryAlertEntry(alert, context) {
  const code = alert?.code;
  const category = ALERT_CODE_CATEGORY_MAP[code] || "system";
  let priority = mapAlertCodeToPriority(code, alert?.severity);
  let suggestedReview = deriveSuggestedReviewFromPriority(priority, category);

  if ((code === "high_payout_pressure" || code === "large_pending_obligations") && context.hasRisingExposure) {
    priority = "elevated";
    suggestedReview = "review_today";
  }

  const entry = {
    severity: alert?.severity || "medium",
    category,
    priority,
    title: normalizeTreasuryWarningTitle(alert?.title),
    message: alert?.message || "",
    reason: buildAlertClassificationReason(code, alert, context),
    suggestedReview,
  };

  return applySmallDollarSoftening(entry, context.isSmallDollar, context.isDeteriorating);
}

function classifyTrendSignalAlert(signal, context) {
  const code = signal?.code;
  if (!code) return null;

  if (code === "repeated_alert_pattern") {
    if (context.isDeteriorating) return null;
    const priority = context.trendStatus === "stable" ? "low" : "medium";
    const entry = {
      severity: signal.severity || "low",
      category: "informational",
      priority,
      title: formatTreasuryWarningTitle(signal),
      message: signal.message || "",
      reason:
        context.trendStatus === "stable"
          ? "Similar treasury alerts appeared across recent snapshots without a worsening trend."
          : "Repeated alert patterns were observed — monitor for directional change.",
      suggestedReview: "monitor",
    };
    return applySmallDollarSoftening(entry, context.isSmallDollar, context.isDeteriorating);
  }

  if (code === "payout_exposure_rising") {
    const entry = {
      severity: signal.severity || "medium",
      category: "exposure",
      priority: "elevated",
      title: formatTreasuryWarningTitle(signal),
      message: signal.message || "",
      reason: "Pending withdrawal exposure increased materially over the trend window.",
      suggestedReview: "review_today",
    };
    return applySmallDollarSoftening(entry, context.isSmallDollar, context.isDeteriorating);
  }

  if (code === "treasury_health_declining" || code === "risk_level_worsening") {
    const priority = signal.severity === "high" ? "elevated" : "medium";
    const entry = {
      severity: signal.severity || "medium",
      category: "system",
      priority,
      title: formatTreasuryWarningTitle(signal),
      message: signal.message || "",
      reason: "Treasury health or risk trajectory moved unfavorably across recent snapshots.",
      suggestedReview: priority === "elevated" ? "review_today" : "monitor",
    };
    return applySmallDollarSoftening(entry, context.isSmallDollar, context.isDeteriorating);
  }

  if (code === "liability_growth_detected") {
    const entry = {
      severity: signal.severity || "medium",
      category: "volatility",
      priority: signal.severity === "high" ? "elevated" : "medium",
      title: formatTreasuryWarningTitle(signal),
      message: signal.message || "",
      reason: "Wallet liabilities increased across the trend window.",
      suggestedReview: signal.severity === "high" ? "review_today" : "monitor",
    };
    return applySmallDollarSoftening(entry, context.isSmallDollar, context.isDeteriorating);
  }

  return null;
}

function dedupeClassifiedAlerts(entries) {
  const seen = new Set();
  const out = [];
  for (const entry of entries) {
    const key = `${entry.category}::${normalizeTreasuryWarningTitle(entry.title)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  out.sort((a, b) => alertPriorityRank(b.priority) - alertPriorityRank(a.priority));
  return out;
}

function buildHealthyTreasuryClassification({ operationalGuidance, trends, forecast, isSmallDollar }) {
  const confidence = computeAlertClassificationConfidence({
    trends,
    forecast,
    operationalGuidance,
    historicalAnalytics: null,
    alertCount: 0,
  });
  const summary = isSmallDollar
    ? "Treasury alerts are within normal range for the current soft-launch environment. Continue routine monitoring."
    : "Treasury alerts are within normal range. No classified operational routing is suggested at this time.";

  return {
    alertSummary: summary,
    alertPriority: "low",
    classifiedAlerts: [
      {
        severity: "low",
        category: "informational",
        priority: "low",
        title: "Treasury alerts within normal range",
        message: "No active treasury alerts. Health signals remain within expected thresholds.",
        reason: "Current health evaluation did not trigger alert conditions.",
        suggestedReview: "routine",
      },
    ],
    routingSuggestions: [
      "Continue routine treasury monitoring — no advisory routing suggested.",
      operationalGuidance?.recommendedChecks?.length
        ? `Optional: ${operationalGuidance.recommendedChecks[0]}`
        : "Include treasury health in the next scheduled operational review.",
    ].filter(Boolean),
    confidence,
  };
}

function buildAlertClassificationSummary(classifiedAlerts, alertPriority, context) {
  const count = classifiedAlerts.length;
  if (count === 0) {
    return "No treasury alerts require classification at this time.";
  }

  const categories = [...new Set(classifiedAlerts.map((a) => a.category))];
  const categoryText = categories.slice(0, 3).join(", ");
  const priorityLabel = alertPriority.charAt(0).toUpperCase() + alertPriority.slice(1);

  if (context.isSmallDollar) {
    return `${count} classified alert${count === 1 ? "" : "s"} (${priorityLabel} overall priority). Categories: ${categoryText}. Soft-launch dollar thresholds applied.`;
  }

  return `${count} classified alert${count === 1 ? "" : "s"} with ${priorityLabel.toLowerCase()} overall priority. Primary categories: ${categoryText}. Advisory review only — no automated actions.`;
}

function buildAlertRoutingSuggestions(classifiedAlerts, alertPriority, context) {
  const suggestions = [];
  const byCategory = new Map();
  for (const alert of classifiedAlerts) {
    if (!byCategory.has(alert.category)) byCategory.set(alert.category, []);
    byCategory.get(alert.category).push(alert);
  }

  if (byCategory.has("reconciliation")) {
    suggestions.push(
      "Reconciliation: include reconciliation-category alerts in today's treasury review cycle.",
    );
  }
  if (byCategory.has("exposure")) {
    suggestions.push(
      "Payout exposure: review pending withdrawal obligations and exposure trends during the next operations check.",
    );
  }
  if (byCategory.has("funding")) {
    suggestions.push(
      "Funding activity: monitor failed funding patterns and confirm no systemic inbound issues.",
    );
  }
  if (byCategory.has("liquidity")) {
    suggestions.push("Liquidity: assess liability-to-exposure ratios in the routine treasury dashboard review.");
  }
  if (byCategory.has("informational") && classifiedAlerts.every((a) => a.category === "informational")) {
    suggestions.push("Informational signals only — maintain standard monitoring cadence.");
  }

  const urgent = classifiedAlerts.filter((a) => a.suggestedReview === "urgent_review");
  if (urgent.length > 0) {
    suggestions.unshift(
      `${urgent.length} alert${urgent.length === 1 ? "" : "s"} suggest urgent advisory review — prioritize reconciliation and exposure items first.`,
    );
  } else if (alertPriorityRank(alertPriority) >= alertPriorityRank("elevated")) {
    suggestions.unshift(
      "Elevated alert priority — schedule a treasury operations review within the current business day.",
    );
  }

  if (context.isSmallDollar && !context.isDeteriorating) {
    suggestions.push(
      "Small-dollar environment: routing suggestions are softened unless deterioration is detected.",
    );
  }

  if (context.operationalGuidance?.watchItems?.length) {
    suggestions.push(`Related watch item: ${context.operationalGuidance.watchItems[0]}`);
  }

  if (suggestions.length === 0) {
    suggestions.push("Continue routine treasury monitoring — no specific routing advisory at this time.");
  }

  return suggestions.slice(0, 6);
}

function computeAlertClassificationConfidence({
  trends,
  forecast,
  operationalGuidance,
  historicalAnalytics,
  alertCount,
}) {
  const trendConf = clamp(Math.round(Number(trends?.confidence) || 0), 0, 100);
  const forecastConf = clamp(Math.round(Number(forecast?.confidence) || 0), 0, 100);
  const operationalConf = clamp(Math.round(Number(operationalGuidance?.confidence) || 0), 0, 100);
  const historicalConf = clamp(Math.round(Number(historicalAnalytics?.confidence) || 0), 0, 100);

  let score = Math.round(
    trendConf * 0.25 + forecastConf * 0.2 + operationalConf * 0.25 + historicalConf * 0.2 + (alertCount > 0 ? 10 : 5),
  );

  if (trends?.trendStatus === "insufficient_data") score = Math.min(score, 55);
  if (alertCount === 0 && operationalGuidance?.operationalStatus === "healthy") {
    score = Math.max(score, 60);
  }

  return clamp(score, 0, 100);
}

function hasMaterialTrendWarnings(trends) {
  return (trends?.warningSignals || []).some((s) => {
    const sev = String(s?.severity || "").toLowerCase();
    if (sev === "critical" || sev === "high") return true;
    if (s?.code === "payout_exposure_rising") return true;
    if (s?.code === "repeated_alert_pattern" && trends?.trendStatus === "deteriorating") return true;
    return false;
  });
}

/**
 * Classify treasury alerts by category, priority, and suggested review cadence (read-only, advisory).
 * @param {{
 *   alerts?: object[],
 *   trends?: object,
 *   forecast?: object,
 *   scenarios?: object,
 *   resilience?: object,
 *   operationalGuidance?: object,
 *   historicalAnalytics?: object,
 * }} [input]
 */
export function classifyTreasuryAlerts({
  alerts = [],
  trends = {},
  forecast = {},
  scenarios = {},
  resilience = {},
  operationalGuidance = {},
  historicalAnalytics = {},
} = {}) {
  try {
    const treasuryAlerts = Array.isArray(alerts) ? alerts : [];
    const trendStatus = trends?.trendStatus || "insufficient_data";
    const isDeteriorating = trendStatus === "deteriorating";
    const exposure =
      toFiniteNumber(trends?.priorExposure) + toFiniteNumber(trends?.exposureChange);
    const liabilities =
      toFiniteNumber(trends?.priorLiabilities) + toFiniteNumber(trends?.liabilityChange);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    const hasRisingExposure = (trends?.warningSignals || []).some((s) => s.code === "payout_exposure_rising");
    const context = {
      isSmallDollar,
      isDeteriorating,
      trendStatus,
      hasRisingExposure,
      operationalGuidance,
      forecast,
    };

    const isHealthy =
      treasuryAlerts.length === 0 &&
      !hasMaterialTrendWarnings(trends) &&
      (operationalGuidance?.operationalStatus === "healthy" ||
        operationalGuidance?.operationalStatus === "monitor");

    if (isHealthy) {
      return buildHealthyTreasuryClassification({
        operationalGuidance,
        trends,
        forecast,
        isSmallDollar,
      });
    }

    const classified = [];

    for (const alert of treasuryAlerts) {
      classified.push(classifyTreasuryAlertEntry(alert, context));
    }

    for (const signal of trends?.warningSignals || []) {
      const trendEntry = classifyTrendSignalAlert(signal, context);
      if (trendEntry) classified.push(trendEntry);
    }

    const classifiedAlerts = dedupeClassifiedAlerts(classified);
    const alertPriority = maxAlertPriority(classifiedAlerts.map((a) => a.priority));
    const alertSummary = buildAlertClassificationSummary(classifiedAlerts, alertPriority, context);
    const routingSuggestions = buildAlertRoutingSuggestions(classifiedAlerts, alertPriority, context);
    const confidence = computeAlertClassificationConfidence({
      trends,
      forecast,
      operationalGuidance,
      historicalAnalytics,
      alertCount: classifiedAlerts.length,
    });

    return {
      alertSummary,
      alertPriority,
      classifiedAlerts,
      routingSuggestions,
      confidence,
    };
  } catch (err) {
    warn({ op: "classifyTreasuryAlerts", err: err?.message || err });
    return { ...EMPTY_ALERT_CLASSIFICATION };
  }
}

const EMPTY_TREASURY_READINESS = Object.freeze({
  readinessScore: 0,
  readinessLevel: "not_ready",
  operatingPosture: "active_review",
  treasuryCondition: "watch",
  confidence: 0,
  summary: "Treasury readiness assessment unavailable — baseline health data required.",
  readinessDrivers: [],
  watchAreas: [],
  recommendations: [],
});

function readinessScoreToLevel(score) {
  const s = clamp(Math.round(Number(score) || 0), 0, 100);
  if (s >= 90) return "resilient";
  if (s >= 80) return "strong";
  if (s >= 65) return "operational";
  if (s >= 45) return "developing";
  return "not_ready";
}

function deriveTreasuryCondition({
  healthScore,
  riskLevel,
  operationalStatus,
  trendStatus,
  forecastOutlook,
  resilienceLevel,
  isSmallDollar,
}) {
  if (isSmallDollar) {
    if (healthScore >= 75 && operationalStatus !== "high_attention") return "stable";
    if (healthScore >= 60) return "watch";
    return "watch";
  }

  if (
    healthScore >= 80 &&
    riskLevel === "low" &&
    (operationalStatus === "healthy" || operationalStatus === "monitor") &&
    trendStatus !== "deteriorating" &&
    forecastOutlook !== "deteriorating"
  ) {
    return "healthy";
  }

  if (
    healthScore < 50 ||
    operationalStatus === "high_attention" ||
    (trendStatus === "deteriorating" && healthScore < 60) ||
    forecastOutlook === "deteriorating" ||
    resilienceLevel === "weak"
  ) {
    return "stressed";
  }

  if (
    operationalStatus === "elevated_attention" ||
    trendStatus === "deteriorating" ||
    forecastOutlook === "elevated_pressure" ||
    resilienceLevel === "moderate"
  ) {
    return "watch";
  }

  return "stable";
}

function countDeterioratingReadinessIndicators({
  trendStatus,
  forecastOutlook,
  resilienceWeakening,
  monitoringMomentum,
  healthTimelineDirection,
  reconciliationDeteriorating,
}) {
  let count = 0;
  if (trendStatus === "deteriorating") count += 1;
  if (forecastOutlook === "deteriorating" || forecastOutlook === "elevated_pressure") count += 1;
  if (resilienceWeakening) count += 1;
  if (monitoringMomentum === "weakening") count += 1;
  if (healthTimelineDirection === "weakening" || healthTimelineDirection === "deteriorating") count += 1;
  if (reconciliationDeteriorating) count += 1;
  return count;
}

function deriveOperatingPosture({
  operationalStatus,
  hasRepeatedAlerts,
  resilienceWeakening,
  deterioratingCount,
  isSmallDollar,
}) {
  if (!isSmallDollar && (deterioratingCount >= 2 || operationalStatus === "high_attention")) {
    return "active_review";
  }

  if (resilienceWeakening || operationalStatus === "elevated_attention") {
    return "elevated_attention";
  }

  if (hasRepeatedAlerts || operationalStatus === "monitor") {
    return "increased_monitoring";
  }

  if (operationalStatus === "healthy") {
    return "normal_monitoring";
  }

  return isSmallDollar ? "normal_monitoring" : "increased_monitoring";
}

function computeReadinessScoreAdjustments(signals, {
  trendStatus,
  forecastOutlook,
  operationalStatus,
  alertPriority,
  monitoringMomentum,
  historicalHealthDirection,
  isSmallDollar,
}) {
  const adjustments = [];
  let delta = 0;

  const add = (amount, type, title, explanation) => {
    if (amount === 0) return;
    delta += amount;
    adjustments.push({ type, title, explanation });
  };

  if (trendStatus === "stable") {
    add(isSmallDollar ? 2 : 4, "positive", "Stable trend signals", "Snapshot trends remain stable across the monitoring window.");
  } else if (trendStatus === "improving") {
    add(isSmallDollar ? 3 : 5, "positive", "Improving trend signals", "Health and exposure trends show improvement over recent snapshots.");
  }

  if (signals.resilienceHealthy) {
    add(
      isSmallDollar ? 3 : 5,
      "positive",
      "Healthy resilience posture",
      `Treasury resilience is classified as ${signals.resilienceLevel} with supportive buffer indicators.`,
    );
  }

  if (signals.forecastStable) {
    add(
      isSmallDollar ? 2 : 4,
      "positive",
      "Supportive forecast outlook",
      `Forecast outlook is ${String(forecastOutlook).replace(/_/g, " ")} — projected pressure remains manageable.`,
    );
  } else if (forecastOutlook === "improving") {
    add(3, "positive", "Improving forecast outlook", "Forward-looking indicators suggest easing treasury pressure.");
  }

  if (operationalStatus === "healthy") {
    add(4, "positive", "Healthy operational guidance", "Operational guidance indicates stable treasury routines.");
  }

  if (historicalHealthDirection === "stable" || historicalHealthDirection === "improving") {
    add(
      isSmallDollar ? 2 : 3,
      "positive",
      "Historical stability",
      "Snapshot history shows stable or improving health evolution.",
    );
  }

  if (alertPriority === "low") {
    add(3, "positive", "Low alert priority", "Classified alerts remain low priority with no sustained escalation pattern.");
  }

  if (monitoringMomentum === "stable" || monitoringMomentum === "improving") {
    add(
      isSmallDollar ? 2 : 3,
      "positive",
      "Stable monitoring momentum",
      `Treasury monitoring dashboard momentum is ${monitoringMomentum}.`,
    );
  }

  if (signals.trendDeteriorating) {
    add(
      isSmallDollar ? -4 : -8,
      "negative",
      "Deteriorating trends",
      "Snapshot trends show deterioration in health, exposure, or reconciliation metrics.",
    );
  }

  if (signals.resilienceWeakening) {
    add(
      isSmallDollar ? -4 : -7,
      "negative",
      "Weakening resilience",
      `Resilience posture is ${signals.resilienceLevel} — sustained-pressure planning may warrant closer review.`,
    );
  }

  if (signals.simMaterialStress || signals.simElevatedOutcome) {
    add(
      isSmallDollar ? -2 : -5,
      "negative",
      "Elevated stress simulation",
      signals.simMaterialStress
        ? "Stress simulation materially reduces modeled health — advisory planning context only."
        : "Decision simulator indicates elevated modeled pressure under what-if conditions.",
    );
  }

  if (signals.reconciliationDeteriorating) {
    add(
      isSmallDollar ? -3 : -6,
      "negative",
      "Reconciliation concerns",
      `Reconciliation score is ${signals.reconciliationScore} — continue standard reconciliation monitoring.`,
    );
  }

  if (signals.hasRepeatedAlerts) {
    add(-4, "negative", "Repeated elevated alerts", "Alert patterns have recurred across recent snapshots.");
  }

  if (alertPriority === "high" || alertPriority === "critical") {
    add(isSmallDollar ? -3 : -6, "negative", "Elevated alert priority", `Classified alert priority is ${alertPriority}.`);
  }

  if (operationalStatus === "elevated_attention") {
    add(isSmallDollar ? -3 : -5, "negative", "Elevated operational attention", "Operational guidance recommends elevated advisory review.");
  } else if (operationalStatus === "high_attention") {
    add(isSmallDollar ? -4 : -10, "negative", "High operational attention", "Multiple operational stress signals warrant thorough advisory review.");
  }

  if (monitoringMomentum === "weakening") {
    add(isSmallDollar ? -2 : -4, "negative", "Weakening monitoring momentum", "Snapshot-to-snapshot momentum shows softening across health, pressure, or risk timelines.");
  }

  return { delta, adjustments };
}

function computeReadinessConfidence({
  health,
  trends,
  forecast,
  resilience,
  operationalGuidance,
  historicalAnalytics,
  monitoringDashboard,
  classifiedAlerts,
}) {
  const healthConf = clamp(Math.round(Number(health?.confidenceScore) || 50), 0, 100);
  const trendConf = clamp(Math.round(Number(trends?.confidence) || 0), 0, 100);
  const forecastConf = clamp(Math.round(Number(forecast?.confidence) || 0), 0, 100);
  const resilienceConf = clamp(Math.round(Number(resilience?.confidence) || 0), 0, 100);
  const operationalConf = clamp(Math.round(Number(operationalGuidance?.confidence) || 0), 0, 100);
  const historicalConf = clamp(Math.round(Number(historicalAnalytics?.confidence) || 0), 0, 100);
  const monitoringConf = clamp(Math.round(Number(monitoringDashboard?.confidence) || 0), 0, 100);
  const alertConf = clamp(Math.round(Number(classifiedAlerts?.confidence) || 0), 0, 100);

  let score = Math.round(
    healthConf * 0.2 +
      trendConf * 0.12 +
      forecastConf * 0.15 +
      resilienceConf * 0.13 +
      operationalConf * 0.15 +
      historicalConf * 0.1 +
      monitoringConf * 0.08 +
      alertConf * 0.07,
  );

  if (trends?.trendStatus === "insufficient_data") score = Math.min(score, 50);

  return clamp(score, 0, 100);
}

function buildReadinessSummary({
  readinessScore,
  readinessLevel,
  operatingPosture,
  treasuryCondition,
  isSmallDollar,
  operationalStatus,
}) {
  const levelLabel = readinessLevel.replace(/_/g, " ");
  const postureLabel = operatingPosture.replace(/_/g, " ");
  const conditionLabel = treasuryCondition;

  let summary = `Treasury readiness score ${readinessScore} (${levelLabel}) with ${conditionLabel} treasury condition and ${postureLabel} operating posture. `;

  if (isSmallDollar) {
    summary +=
      "Soft-launch materiality guards apply — liabilities and exposure remain below thresholds; conclusions are intentionally conservative. ";
  }

  if (operatingPosture === "normal_monitoring") {
    summary += "Continue routine snapshot and alert monitoring cadence.";
  } else if (operatingPosture === "increased_monitoring") {
    summary += "Increase observational review on the next monitoring cycle without automated treasury actions.";
  } else if (operatingPosture === "elevated_attention") {
    summary += "Prioritize advisory review of resilience, trends, and payout exposure on the next cycle.";
  } else {
    summary += "Multiple indicators suggest coordinated leadership review — advisory only, no automated mutations.";
  }

  if (isSmallDollar && operationalStatus !== "healthy") {
    summary += " Dollar amounts remain below materiality thresholds — interpret stress signals in soft-launch context.";
  }

  return summary.trim();
}

function buildReadinessWatchAreas(signals, {
  operationalGuidance,
  classifiedAlerts,
  monitoringDashboard,
  historicalAnalytics,
  isSmallDollar,
}) {
  const areas = [];

  for (const item of operationalGuidance?.watchItems || []) {
    areas.push(item);
  }

  for (const alert of classifiedAlerts?.classifiedAlerts || []) {
    if (alert.priority === "high" || alert.priority === "critical" || alert.priority === "medium") {
      areas.push(`${alert.title}: ${alert.message || alert.summary || "Review on next cycle."}`);
    }
  }

  if (monitoringDashboard?.treasuryMomentum === "weakening") {
    areas.push("Monitoring dashboard momentum is weakening across snapshot timelines.");
  }

  if (historicalAnalytics?.historicalHealthTrend?.direction === "weakening") {
    areas.push("Historical health trend shows softening across snapshot history.");
  }

  if (signals.reconciliationDeteriorating) {
    areas.push(`Reconciliation score: ${signals.reconciliationScore}`);
  }

  if (isSmallDollar && areas.length === 0) {
    areas.push("Soft-launch dollar levels — accumulate additional snapshots for richer readiness signals.");
  }

  return [...new Set(areas)].slice(0, 8);
}

function buildReadinessRecommendations({
  operatingPosture,
  operationalGuidance,
  readinessLevel,
  isSmallDollar,
}) {
  const recs = [];

  for (const check of operationalGuidance?.recommendedChecks || []) {
    recs.push(check);
  }

  if (operatingPosture === "normal_monitoring") {
    recs.push("Maintain normal treasury snapshot refresh cadence and standard alert review.");
  } else if (operatingPosture === "increased_monitoring") {
    recs.push("Schedule an additional advisory review on the next snapshot refresh.");
  } else if (operatingPosture === "elevated_attention") {
    recs.push("Review resilience summary, forecast outlook, and payout exposure with leadership on the next cycle.");
  } else {
    recs.push("Conduct coordinated leadership review of trends, alerts, and operational guidance — advisory only.");
  }

  if (readinessLevel === "developing" || readinessLevel === "not_ready") {
    recs.push("Track readiness drivers on subsequent refreshes before drawing production-scale conclusions.");
  }

  if (isSmallDollar) {
    recs.push(
      "Interpret readiness in soft-launch context until liabilities and exposure exceed materiality thresholds.",
    );
  }

  return [...new Set(recs)].slice(0, 8);
}

/**
 * Treasury readiness score and operational posture layer (read-only, advisory).
 * Synthesizes health, trends, forecast, resilience, guidance, and monitoring signals.
 * Does not mutate wallets, payouts, transactions, or persist snapshots.
 * @param {{
 *   treasuryHealth?: object,
 *   health?: object,
 *   trends?: object,
 *   forecast?: object,
 *   scenarios?: object,
 *   resilience?: object,
 *   operationalGuidance?: object,
 *   executiveSummary?: object,
 *   historicalAnalytics?: object,
 *   monitoringDashboard?: object,
 *   classifiedAlerts?: object,
 *   simulator?: object,
 *   simulation?: object,
 * }} [input]
 */
export function calculateTreasuryReadiness({
  treasuryHealth,
  health: healthAlias,
  trends = {},
  forecast = {},
  scenarios = {},
  resilience = {},
  operationalGuidance = {},
  executiveSummary = {},
  historicalAnalytics = {},
  monitoringDashboard = {},
  classifiedAlerts = {},
  simulator,
  simulation,
} = {}) {
  try {
    const health = treasuryHealth || healthAlias;
    if (!health?.healthScore && health?.healthScore !== 0) {
      return { ...EMPTY_TREASURY_READINESS };
    }

    const metrics = health?.sourceSnapshot?.metrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    const simulatorResult = simulator || simulation || null;
    const signals = collectOperationalGuidanceSignals({
      health,
      trends,
      forecast,
      scenarios,
      resilience,
      simulator: simulatorResult,
      isSmallDollar,
    });

    const healthScore = signals.healthScore;
    let readinessScore = healthScore;

    const trendStatus = trends?.trendStatus || "insufficient_data";
    const forecastOutlook = forecast?.outlook || "stable";
    const operationalStatus = operationalGuidance?.operationalStatus || "monitor";
    const alertPriority = classifiedAlerts?.alertPriority || "low";
    const monitoringMomentum = monitoringDashboard?.treasuryMomentum || "stable";
    const historicalHealthDirection =
      historicalAnalytics?.historicalHealthTrend?.direction ||
      monitoringDashboard?.healthTimeline?.direction ||
      "insufficient_data";

    const { delta, adjustments } = computeReadinessScoreAdjustments(signals, {
      trendStatus,
      forecastOutlook,
      operationalStatus,
      alertPriority,
      monitoringMomentum,
      historicalHealthDirection,
      isSmallDollar,
    });

    readinessScore = clamp(Math.round(readinessScore + delta), 0, 100);

    if (isSmallDollar) {
      readinessScore = Math.max(readinessScore, Math.min(healthScore, 85));
      if (readinessScore < 50 && healthScore >= 60) {
        readinessScore = Math.max(readinessScore, 50);
      }
    }

    const readinessLevel = readinessScoreToLevel(readinessScore);

    const deterioratingCount = countDeterioratingReadinessIndicators({
      trendStatus,
      forecastOutlook,
      resilienceWeakening: signals.resilienceWeakening,
      monitoringMomentum,
      healthTimelineDirection: monitoringDashboard?.healthTimeline?.direction,
      reconciliationDeteriorating: signals.reconciliationDeteriorating,
    });

    const operatingPosture = deriveOperatingPosture({
      operationalStatus,
      hasRepeatedAlerts: signals.hasRepeatedAlerts,
      resilienceWeakening: signals.resilienceWeakening,
      deterioratingCount,
      isSmallDollar,
    });

    const treasuryCondition = deriveTreasuryCondition({
      healthScore,
      riskLevel: signals.riskLevel,
      operationalStatus,
      trendStatus,
      forecastOutlook,
      resilienceLevel: signals.resilienceLevel,
      isSmallDollar,
    });

    const confidence = computeReadinessConfidence({
      health,
      trends,
      forecast,
      resilience,
      operationalGuidance,
      historicalAnalytics,
      monitoringDashboard,
      classifiedAlerts,
    });

    const readinessDrivers = adjustments.slice(0, 10);

    if (executiveSummary?.headline && readinessDrivers.length < 10) {
      readinessDrivers.push({
        type: "context",
        title: "Executive synthesis",
        explanation: executiveSummary.headline,
      });
    }

    const summary = buildReadinessSummary({
      readinessScore,
      readinessLevel,
      operatingPosture,
      treasuryCondition,
      isSmallDollar,
      operationalStatus,
    });

    const watchAreas = buildReadinessWatchAreas(signals, {
      operationalGuidance,
      classifiedAlerts,
      monitoringDashboard,
      historicalAnalytics,
      isSmallDollar,
    });

    const recommendations = buildReadinessRecommendations({
      operatingPosture,
      operationalGuidance,
      readinessLevel,
      isSmallDollar,
    });

    return {
      readinessScore,
      readinessLevel,
      operatingPosture,
      treasuryCondition,
      confidence,
      summary,
      readinessDrivers,
      watchAreas,
      recommendations,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryReadiness", err: err?.message || err });
    return { ...EMPTY_TREASURY_READINESS };
  }
}

const EMPTY_TREASURY_DRIFT = Object.freeze({
  driftStatus: "unchanged",
  driftMagnitude: 0,
  driftDrivers: [],
  meaningfulChanges: [],
  stabilityAssessment: "stable",
  confidence: 0,
  summary: "Treasury drift assessment unavailable — snapshot history required.",
});

const DRIFT_PRESSURE_RANK = Object.freeze({ low: 0, moderate: 1, elevated: 2, severe: 3 });

function driftPressureRank(level) {
  return DRIFT_PRESSURE_RANK[String(level || "low").toLowerCase()] ?? 0;
}

function classifyHealthScoreDrift(healthDelta, isSmallDollar) {
  const threshold = isSmallDollar ? 5 : 3;
  const abs = Math.abs(healthDelta);
  if (abs <= threshold) return { severity: 0, points: 0 };
  if (abs >= TREND_HEALTH_DROP_HIGH) return { severity: 3, points: 28 };
  if (abs >= TREND_HEALTH_DROP_WARNING) return { severity: 2, points: 16 };
  return { severity: 1, points: 8 };
}

function classifyExposureLiabilityDrift(change, priorValue, isSmallDollar) {
  if (isSmallDollar) {
    const delta = Math.abs(toFiniteNumber(change));
    if (delta < 1) return { severity: 0, points: 0, worsening: false };
    if (delta >= 5) return { severity: 2, points: 14, worsening: toFiniteNumber(change) > 0 };
    return { severity: 1, points: 6, worsening: toFiniteNumber(change) > 0 };
  }
  if (isMaterialPositiveChange(priorValue, change)) {
    const ratio = priorValue >= TREND_MATERIALITY_OLD_MIN ? toFiniteNumber(change) / toFiniteNumber(priorValue) : 1;
    if (ratio >= TREND_GROWTH_HIGH_RATIO - 1) return { severity: 3, points: 24, worsening: true };
    return { severity: 2, points: 15, worsening: true };
  }
  if (isMaterialNegativeChange(priorValue, change)) {
    return { severity: 1, points: 5, worsening: false };
  }
  return { severity: 0, points: 0, worsening: false };
}

function deriveDriftStabilityAssessment(driftStatus, treasuryMomentum, pressureDirection, isSmallDollar) {
  if (driftStatus === "unchanged") {
    if (
      treasuryMomentum === "stable" &&
      (pressureDirection === "stable" || pressureDirection === "de-escalating" || pressureDirection === "insufficient_data")
    ) {
      return "stable";
    }
    return "mostly_stable";
  }
  if (driftStatus === "minor_shift") return "mostly_stable";
  if (driftStatus === "moderate_shift") return "changing";
  if (isSmallDollar && driftStatus === "meaningful_shift") return "changing";
  return "unstable";
}

function deriveDriftStatusFromSignals({ magnitude, maxSeverity, moderateCount, meaningfulCount, isSmallDollar }) {
  if (meaningfulCount >= 1 && !isSmallDollar) return "meaningful_shift";
  if (meaningfulCount >= 2 || (meaningfulCount >= 1 && moderateCount >= 2)) return "meaningful_shift";
  if (isSmallDollar && (meaningfulCount >= 1 || moderateCount >= 3 || magnitude >= 55)) return "moderate_shift";
  if (moderateCount >= 2 || magnitude >= 40 || maxSeverity >= 2) return "moderate_shift";
  if (moderateCount >= 1 || magnitude >= 12 || maxSeverity >= 1) return "minor_shift";
  return "unchanged";
}

function computeDriftConfidence({ historyCount, trends, monitoringDashboard, classifiedAlerts, readiness }) {
  let score = clamp(Math.round(Number(trends?.confidence) || 0), 0, 100);
  if (monitoringDashboard?.confidence != null) {
    score = Math.round(score * 0.45 + clamp(Math.round(Number(monitoringDashboard.confidence) || 0), 0, 100) * 0.35);
  }
  if (classifiedAlerts?.confidence != null) {
    score = Math.round(score * 0.85 + clamp(Math.round(Number(classifiedAlerts.confidence) || 0), 0, 100) * 0.15);
  }
  if (readiness?.confidence != null) {
    score = Math.round(score * 0.9 + clamp(Math.round(Number(readiness.confidence) || 0), 0, 100) * 0.1);
  }
  if (historyCount >= 7) score += 5;
  else if (historyCount >= TREND_MIN_SNAPSHOTS) score += 3;
  if (historyCount < TREND_MIN_SNAPSHOTS) score = Math.min(score, 50);
  if (historyCount < 2) score = Math.min(score, 30);
  return clamp(Math.round(score), 0, 100);
}

function buildDriftSummary({
  driftStatus,
  stabilityAssessment,
  isSmallDollar,
  historyCount,
  operatingPosture,
  treasuryMomentum,
}) {
  if (historyCount < 2) {
    return "Insufficient snapshot pairs for drift comparison — accumulate additional snapshots to assess treasury movement.";
  }

  if (isSmallDollar) {
    if (driftStatus === "unchanged") {
      return "Treasury operating conditions appear unchanged between recent snapshots at soft-launch dollar levels.";
    }
    if (driftStatus === "minor_shift") {
      return "Minor treasury variation detected, though operating conditions remain stable.";
    }
    if (driftStatus === "moderate_shift") {
      return "Several treasury indicators shifted modestly — increased monitoring is recommended, interpreted cautiously at low-dollar levels.";
    }
    return "Treasury posture shifted across multiple advisory signals — review recent snapshot movement in context of soft-launch activity.";
  }

  const postureNote =
    operatingPosture && operatingPosture !== "normal_monitoring"
      ? ` Operating posture: ${String(operatingPosture).replace(/_/g, " ")}.`
      : "";

  if (driftStatus === "unchanged") {
    return `Treasury operating conditions are unchanged between recent snapshots. Momentum remains ${treasuryMomentum || "stable"}.${postureNote}`;
  }
  if (driftStatus === "minor_shift") {
    return `Minor treasury movement detected between recent snapshots with no material operational impact.${postureNote}`;
  }
  if (driftStatus === "moderate_shift") {
    return `Several treasury indicators moved across recent snapshots — increased monitoring is recommended.${postureNote}`;
  }

  const stabilityNote =
    stabilityAssessment === "unstable"
      ? " Posture materially changed relative to prior operating conditions."
      : " Review drift drivers and meaningful changes below.";
  return `Treasury posture shifted meaningfully across recent snapshot comparisons.${stabilityNote}${postureNote}`;
}

/**
 * Treasury drift detection — snapshot-to-snapshot change awareness (read-only, advisory).
 * Does not mutate wallets, payouts, transactions, or persist snapshots.
 * @param {{
 *   treasury_health_snapshots?: object[],
 *   trends?: object,
 *   forecast?: object,
 *   resilience?: object,
 *   monitoringDashboard?: object,
 *   readiness?: object,
 *   classifiedAlerts?: object,
 * }} [input]
 */
export function detectTreasuryDrift({
  treasury_health_snapshots: snapshotsInput,
  trends = {},
  forecast = {},
  resilience = {},
  monitoringDashboard = {},
  readiness = {},
  classifiedAlerts = {},
} = {}) {
  try {
    const rows = normalizeHistoricalSnapshots(snapshotsInput);
    const historyCount = rows.length;

    if (historyCount === 0) {
      return { ...EMPTY_TREASURY_DRIFT };
    }

    const newest = rows[historyCount - 1];
    const prior = historyCount >= 2 ? rows[historyCount - 2] : null;
    const exposure = toFiniteNumber(newest.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(newest.totalWalletLiabilities);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    const driftDrivers = [];
    const meaningfulChanges = [];
    let magnitude = 0;
    let maxSeverity = 0;
    let moderateCount = 0;
    let meaningfulCount = 0;

    const recordSignal = (severity, points, driver, changeText) => {
      if (severity <= 0) return;
      magnitude += points;
      maxSeverity = Math.max(maxSeverity, severity);
      if (severity >= 3) meaningfulCount += 1;
      else if (severity >= 2) moderateCount += 1;
      if (driver) driftDrivers.push(driver);
      if (changeText) meaningfulChanges.push(changeText);
    };

    if (prior) {
      const healthDelta = (newest.healthScore || 0) - (prior.healthScore || 0);
      const healthDrift = classifyHealthScoreDrift(healthDelta, isSmallDollar);
      recordSignal(
        healthDrift.severity,
        healthDrift.points,
        healthDrift.severity > 0
          ? {
              type: healthDelta >= 0 ? "positive" : "negative",
              title: "Treasury health score",
              explanation: isSmallDollar
                ? healthDelta >= 0
                  ? "Health score improved modestly between the two most recent snapshots."
                  : "Health score softened modestly between the two most recent snapshots."
                : healthDelta >= 0
                  ? `Health score increased by ${healthDelta} points between recent snapshots.`
                  : `Health score decreased by ${Math.abs(healthDelta)} points between recent snapshots.`,
              impact:
                healthDrift.severity >= 3 ? "high" : healthDrift.severity >= 2 ? "medium" : "low",
            }
          : null,
        healthDrift.severity > 0
          ? isSmallDollar
            ? healthDelta >= 0
              ? "Treasury health improved modestly between recent snapshots."
              : "Treasury health softened modestly between recent snapshots."
            : `Treasury health score ${healthDelta >= 0 ? "rose" : "fell"} by ${Math.abs(healthDelta)} points.`
          : null,
      );

      const exposureDelta =
        toFiniteNumber(newest.pendingWithdrawalExposure) - toFiniteNumber(prior.pendingWithdrawalExposure);
      const exposureDrift = classifyExposureLiabilityDrift(
        exposureDelta,
        prior.pendingWithdrawalExposure,
        isSmallDollar,
      );
      recordSignal(
        exposureDrift.severity,
        exposureDrift.points,
        exposureDrift.severity > 0
          ? {
              type: exposureDrift.worsening ? "negative" : "positive",
              title: "Payout exposure",
              explanation: isSmallDollar
                ? exposureDrift.worsening
                  ? "Pending withdrawal exposure increased modestly between recent snapshots."
                  : "Pending withdrawal exposure declined between recent snapshots."
                : exposureDrift.worsening
                  ? "Pending withdrawal exposure increased materially between recent snapshots."
                  : "Pending withdrawal exposure declined between recent snapshots.",
              impact:
                exposureDrift.severity >= 3 ? "high" : exposureDrift.severity >= 2 ? "medium" : "low",
            }
          : null,
        exposureDrift.severity > 0
          ? exposureDrift.worsening
            ? "Payout exposure increased between recent snapshots."
            : "Payout exposure declined between recent snapshots."
          : null,
      );

      const liabilityDelta =
        toFiniteNumber(newest.totalWalletLiabilities) - toFiniteNumber(prior.totalWalletLiabilities);
      const liabilityDrift = classifyExposureLiabilityDrift(
        liabilityDelta,
        prior.totalWalletLiabilities,
        isSmallDollar,
      );
      recordSignal(
        liabilityDrift.severity,
        liabilityDrift.points,
        liabilityDrift.severity > 0
          ? {
              type: liabilityDrift.worsening ? "negative" : "positive",
              title: "Wallet liabilities",
              explanation: isSmallDollar
                ? liabilityDrift.worsening
                  ? "Wallet liabilities increased modestly between recent snapshots."
                  : "Wallet liabilities declined between recent snapshots."
                : liabilityDrift.worsening
                  ? "Wallet liabilities increased materially between recent snapshots."
                  : "Wallet liabilities declined between recent snapshots.",
              impact:
                liabilityDrift.severity >= 3 ? "high" : liabilityDrift.severity >= 2 ? "medium" : "low",
            }
          : null,
        liabilityDrift.severity > 0
          ? liabilityDrift.worsening
            ? "Wallet liabilities increased between recent snapshots."
            : "Wallet liabilities declined between recent snapshots."
          : null,
      );

      const prevPressure = deriveSnapshotPressureLevel(prior, isSmallDollar);
      const currPressure = deriveSnapshotPressureLevel(newest, isSmallDollar);
      if (prevPressure !== currPressure) {
        const pressureRankDelta = driftPressureRank(currPressure) - driftPressureRank(prevPressure);
        const severity = pressureRankDelta > 0 ? (isSmallDollar ? 2 : pressureRankDelta >= 2 ? 3 : 2) : 1;
        recordSignal(
          severity,
          severity >= 3 ? 22 : severity >= 2 ? 14 : 6,
          {
            type: pressureRankDelta > 0 ? "negative" : "positive",
            title: "Treasury pressure",
            explanation: `Payout pressure moved from ${prevPressure} to ${currPressure} between recent snapshots.`,
            impact: severity >= 3 ? "high" : severity >= 2 ? "medium" : "low",
          },
          `Treasury pressure transitioned from ${prevPressure} to ${currPressure}.`,
        );
      }

      const prevRisk = String(prior.treasuryRiskLevel || "low").toLowerCase();
      const currRisk = String(newest.treasuryRiskLevel || "low").toLowerCase();
      if (prevRisk !== currRisk) {
        const riskDelta = riskRank(currRisk) - riskRank(prevRisk);
        const severity = riskDelta > 0 ? (isSmallDollar ? 2 : riskDelta >= 2 ? 3 : 2) : 1;
        recordSignal(
          severity,
          severity >= 3 ? 26 : severity >= 2 ? 16 : 5,
          {
            type: riskDelta > 0 ? "negative" : "positive",
            title: "Treasury risk level",
            explanation: `Risk level moved from ${prevRisk.toUpperCase()} to ${currRisk.toUpperCase()} between recent snapshots.`,
            impact: severity >= 3 ? "high" : severity >= 2 ? "medium" : "low",
          },
          `Risk level changed from ${prevRisk.toUpperCase()} to ${currRisk.toUpperCase()}.`,
        );
      }
    }

    const trendExposureDrift = classifyExposureLiabilityDrift(
      trends.exposureChange,
      trends.priorExposure,
      isSmallDollar,
    );
    if (prior == null && trendExposureDrift.severity > 0) {
      recordSignal(
        Math.min(trendExposureDrift.severity, 2),
        trendExposureDrift.points,
        {
          type: trendExposureDrift.worsening ? "negative" : "positive",
          title: "Exposure trend",
          explanation: "Trend window shows payout exposure movement across snapshot history.",
          impact: "medium",
        },
        "Payout exposure shifted across the trend window.",
      );
    }

    const trendLiabilityDrift = classifyExposureLiabilityDrift(
      trends.liabilityChange,
      trends.priorLiabilities,
      isSmallDollar,
    );
    if (prior == null && trendLiabilityDrift.severity > 0) {
      recordSignal(
        Math.min(trendLiabilityDrift.severity, 2),
        trendLiabilityDrift.points,
        {
          type: trendLiabilityDrift.worsening ? "negative" : "positive",
          title: "Liability trend",
          explanation: "Trend window shows wallet liability movement across snapshot history.",
          impact: "medium",
        },
        "Wallet liabilities shifted across the trend window.",
      );
    }

    if ((trends?.healthScoreChange ?? 0) <= -TREND_HEALTH_DROP_WARNING && historyCount >= TREND_MIN_SNAPSHOTS) {
      const severity = (trends.healthScoreChange ?? 0) <= -TREND_HEALTH_DROP_HIGH ? 3 : 2;
      recordSignal(
        severity,
        severity >= 3 ? 20 : 12,
        {
          type: "negative",
          title: "Health trend",
          explanation: `Health score declined by ${Math.abs(trends.healthScoreChange)} points across the trend window.`,
          impact: severity >= 3 ? "high" : "medium",
        },
        `Health score trend: ${trends.healthScoreChange} points across recent snapshots.`,
      );
    }

    const resilienceDirection = resilience?.resilienceLevel === "weak" ? "deteriorating" : null;
    const historicalResilienceDirection =
      monitoringDashboard?.healthTimeline?.direction === "weakening" && resilience?.resilienceScore != null
        ? "deteriorating"
        : null;
    const effectiveResilienceWeak =
      resilience?.resilienceLevel === "weak" ||
      resilienceDirection === "deteriorating" ||
      historicalResilienceDirection === "deteriorating";

    if (effectiveResilienceWeak && !isSmallDollar) {
      recordSignal(
        2,
        14,
        {
          type: "negative",
          title: "Resilience posture",
          explanation: `Resilience assessed as ${resilience.resilienceLevel} (score ${resilience.resilienceScore ?? "—"}).`,
          impact: "medium",
        },
        "Resilience posture weakened relative to prior advisory assessments.",
      );
    } else if (resilience?.resilienceLevel === "moderate" && (trends?.trendStatus === "deteriorating" || forecast?.outlook === "deteriorating")) {
      recordSignal(
        isSmallDollar ? 1 : 2,
        isSmallDollar ? 6 : 12,
        {
          type: "negative",
          title: "Resilience posture",
          explanation: isSmallDollar
            ? "Resilience proxy softened modestly — interpret at soft-launch scale."
            : "Resilience score and trend signals indicate softening capacity.",
          impact: "medium",
        },
        isSmallDollar
          ? "Resilience proxy softened modestly across recent snapshots."
          : "Resilience capacity softened across recent operating conditions.",
      );
    }

    const forecastOutlook = forecast?.outlook || "stable";
    const treasuryPressure = forecast?.treasuryPressure || "low";
    if (forecastOutlook === "deteriorating") {
      recordSignal(
        isSmallDollar ? 2 : 3,
        isSmallDollar ? 14 : 24,
        {
          type: "negative",
          title: "Forecast outlook",
          explanation: "Forecast outlook indicates emerging treasury deterioration from recent trends.",
          impact: isSmallDollar ? "medium" : "high",
        },
        "Forecast outlook shifted toward deteriorating conditions.",
      );
    } else if (forecastOutlook === "elevated_pressure" || driftPressureRank(treasuryPressure) >= driftPressureRank("moderate")) {
      recordSignal(
        2,
        12,
        {
          type: "negative",
          title: "Treasury pressure outlook",
          explanation: `Forecast treasury pressure is ${treasuryPressure.replace(/_/g, " ")} with outlook ${forecastOutlook.replace(/_/g, " ")}.`,
          impact: "medium",
        },
        `Treasury pressure outlook: ${treasuryPressure.replace(/_/g, " ")}.`,
      );
    }

    const alertPriority = isSmallDollar
      ? softenAlertPriority(classifiedAlerts?.alertPriority || "low")
      : classifiedAlerts?.alertPriority || "low";
    if (alertPriorityRank(alertPriority) >= alertPriorityRank("elevated")) {
      recordSignal(
        alertPriorityRank(alertPriority) >= alertPriorityRank("high") ? 3 : 2,
        alertPriorityRank(alertPriority) >= alertPriorityRank("high") ? 20 : 13,
        {
          type: "negative",
          title: "Alert priority",
          explanation: `Classified alert priority is ${alertPriority} — review classified alerts for context.`,
          impact: alertPriorityRank(alertPriority) >= alertPriorityRank("high") ? "high" : "medium",
        },
        `Alert priority elevated to ${alertPriority}.`,
      );
    } else if (alertPriorityRank(alertPriority) >= alertPriorityRank("medium") && trends?.trendStatus === "deteriorating") {
      recordSignal(
        1,
        7,
        {
          type: "context",
          title: "Alert priority",
          explanation: "Alert priority is medium alongside deteriorating trend status.",
          impact: "low",
        },
        "Alert priority at medium with deteriorating trends.",
      );
    }

    const operatingPosture = readiness?.operatingPosture || "normal_monitoring";
    const treasuryMomentum = monitoringDashboard?.treasuryMomentum || "stable";
    const pressureDirection = monitoringDashboard?.pressureTimeline?.direction || "insufficient_data";

    if (
      !isSmallDollar &&
      (operatingPosture === "active_review" || operatingPosture === "elevated_attention") &&
      treasuryMomentum === "weakening"
    ) {
      recordSignal(
        operatingPosture === "active_review" ? 3 : 2,
        operatingPosture === "active_review" ? 22 : 15,
        {
          type: "negative",
          title: "Operating posture",
          explanation: `Operating posture is ${operatingPosture.replace(/_/g, " ")} with weakening treasury momentum.`,
          impact: operatingPosture === "active_review" ? "high" : "medium",
        },
        `Operating posture: ${operatingPosture.replace(/_/g, " ")}.`,
      );
    } else if (operatingPosture !== "normal_monitoring" && operatingPosture !== "increased_monitoring") {
      recordSignal(
        isSmallDollar ? 1 : 2,
        isSmallDollar ? 5 : 10,
        {
          type: "context",
          title: "Operating posture",
          explanation: `Current operating posture: ${operatingPosture.replace(/_/g, " ")}.`,
          impact: "low",
        },
        `Operating posture shifted to ${operatingPosture.replace(/_/g, " ")}.`,
      );
    }

    const readinessScore = clamp(Math.round(Number(readiness?.readinessScore) || 0), 0, 100);
    const healthScore = clamp(Math.round(Number(newest.healthScore) || 0), 0, 100);
    const readinessGap = healthScore - readinessScore;
    if (readinessGap >= (isSmallDollar ? 20 : 15) && readinessScore > 0) {
      recordSignal(
        isSmallDollar ? 1 : 2,
        isSmallDollar ? 6 : 11,
        {
          type: "negative",
          title: "Readiness score",
          explanation: isSmallDollar
            ? "Readiness score trails health score — advisory gap at soft-launch scale."
            : `Readiness score (${readinessScore}) trails health score (${healthScore}) by ${readinessGap} points.`,
          impact: "medium",
        },
        isSmallDollar
          ? "Readiness score trails baseline health modestly."
          : `Readiness score deteriorated relative to health baseline (gap: ${readinessGap} pts).`,
      );
    }

    if (
      treasuryMomentum === "weakening" &&
      monitoringDashboard?.healthTimeline?.direction === "weakening" &&
      historyCount >= TREND_MIN_SNAPSHOTS
    ) {
      recordSignal(
        isSmallDollar ? 1 : 2,
        isSmallDollar ? 5 : 10,
        {
          type: "negative",
          title: "Treasury momentum",
          explanation: "Monitoring dashboard indicates weakening momentum across health and pressure timelines.",
          impact: "medium",
        },
        "Treasury momentum weakened across recent snapshot comparisons.",
      );
    }

    if (isSmallDollar) {
      magnitude = Math.min(magnitude, 55);
    }

    magnitude = clamp(Math.round(magnitude), 0, 100);

    const driftStatus = deriveDriftStatusFromSignals({
      magnitude,
      maxSeverity,
      moderateCount,
      meaningfulCount,
      isSmallDollar,
    });

    const stabilityAssessment = deriveDriftStabilityAssessment(
      driftStatus,
      treasuryMomentum,
      pressureDirection,
      isSmallDollar,
    );

    const confidence = computeDriftConfidence({
      historyCount,
      trends,
      monitoringDashboard,
      classifiedAlerts,
      readiness,
    });

    const summary = buildDriftSummary({
      driftStatus,
      stabilityAssessment,
      isSmallDollar,
      historyCount,
      operatingPosture,
      treasuryMomentum,
    });

    return {
      driftStatus,
      driftMagnitude: magnitude,
      driftDrivers: driftDrivers.slice(0, 10),
      meaningfulChanges: [...new Set(meaningfulChanges)].slice(0, 8),
      stabilityAssessment,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "detectTreasuryDrift", err: err?.message || err });
    return { ...EMPTY_TREASURY_DRIFT };
  }
}

const EMPTY_TREASURY_STABILITY = Object.freeze({
  stabilityScore: 0,
  stabilityLevel: "unstable",
  operatingConfidence: "low",
  treasuryConsistency: "inconsistent",
  volatilityAssessment: "elevated_variance",
  confidence: 0,
  summary: "Treasury stability assessment unavailable — baseline readiness and monitoring signals required.",
  stabilityDrivers: [],
  cautionAreas: [],
});

function stabilityScoreToLevel(score) {
  const s = clamp(Math.round(Number(score) || 0), 0, 100);
  if (s >= 90) return "highly_stable";
  if (s >= 75) return "stable";
  if (s >= 50) return "variable";
  return "unstable";
}

function deriveOperatingConfidenceFromStability({ stabilityScore, driftMagnitude, driftStatus, historicalVolatilityCount, isSmallDollar }) {
  const score = clamp(Math.round(Number(stabilityScore) || 0), 0, 100);
  const driftPenalty =
    driftStatus === "meaningful_shift" ? 2 : driftStatus === "moderate_shift" ? 1 : driftMagnitude >= 40 ? 1 : 0;
  const volatilityPenalty = historicalVolatilityCount >= 2 ? 1 : historicalVolatilityCount >= 1 ? 0.5 : 0;
  const effective = score - (isSmallDollar ? driftPenalty * 4 : driftPenalty * 8) - volatilityPenalty * 6;

  if (effective >= 85 && driftPenalty === 0) return "high";
  if (effective >= 70) return "strong";
  if (effective >= 50) return "moderate";
  return "low";
}

function deriveTreasuryConsistency({
  stabilityScore,
  driftStatus,
  treasuryMomentum,
  historicalHealthDirection,
  riskStablePeriods,
  isSmallDollar,
}) {
  const score = clamp(Math.round(Number(stabilityScore) || 0), 0, 100);
  const driftDisruptive =
    driftStatus === "meaningful_shift" || driftStatus === "moderate_shift";
  const momentumWeak = treasuryMomentum === "weakening" || treasuryMomentum === "mixed";
  const healthUnstable =
    historicalHealthDirection === "deteriorating" || historicalHealthDirection === "weakening";

  if (
    score >= 88 &&
    !driftDisruptive &&
    !momentumWeak &&
    (riskStablePeriods >= 1 || historicalHealthDirection === "stable" || historicalHealthDirection === "improving")
  ) {
    return "highly_consistent";
  }
  if (score >= 72 && !driftDisruptive && !healthUnstable) {
    return "consistent";
  }
  if (score >= 50 || (isSmallDollar && score >= 45 && driftStatus !== "meaningful_shift")) {
    return "mixed";
  }
  return "inconsistent";
}

function deriveVolatilityAssessment({ historicalVolatilityCount, driftMagnitude, trends, forecast, isSmallDollar }) {
  const elevatedVariance = historicalVolatilityCount >= 1;
  const trendVolatile = trends?.trendStatus === "deteriorating";
  const forecastVolatile =
    forecast?.outlook === "deteriorating" || forecast?.outlook === "elevated_pressure";

  if (
    !elevatedVariance &&
    driftMagnitude <= (isSmallDollar ? 20 : 12) &&
    !trendVolatile &&
    !forecastVolatile
  ) {
    return "highly_stable";
  }
  if (
    historicalVolatilityCount >= 2 ||
    driftMagnitude >= (isSmallDollar ? 45 : 35) ||
    (trendVolatile && forecastVolatile)
  ) {
    return "elevated_variance";
  }
  if (elevatedVariance || driftMagnitude >= (isSmallDollar ? 25 : 18) || trendVolatile || forecastVolatile) {
    return "moderate_variance";
  }
  return "low_variance";
}

function countHistoricalVolatilityStress(volatilityIndicators) {
  let count = 0;
  for (const indicator of volatilityIndicators || []) {
    const label = String(indicator?.label || "").toLowerCase();
    if (label.includes("elevated") || label.includes("fluctuation") || label.includes("variance")) {
      count += 1;
    }
  }
  return count;
}

function computeStabilityConfidence({
  trends,
  readiness,
  driftDetection,
  monitoringDashboard,
  historicalAnalytics,
  classifiedAlerts,
}) {
  let score = clamp(Math.round(Number(readiness?.confidence) || 0), 0, 100);
  if (trends?.confidence != null) {
    score = Math.round(score * 0.55 + clamp(Math.round(Number(trends.confidence) || 0), 0, 100) * 0.2);
  }
  if (monitoringDashboard?.confidence != null) {
    score = Math.round(score * 0.7 + clamp(Math.round(Number(monitoringDashboard.confidence) || 0), 0, 100) * 0.15);
  }
  if (historicalAnalytics?.confidence != null) {
    score = Math.round(score * 0.82 + clamp(Math.round(Number(historicalAnalytics.confidence) || 0), 0, 100) * 0.1);
  }
  if (driftDetection?.confidence != null) {
    score = Math.round(score * 0.88 + clamp(Math.round(Number(driftDetection.confidence) || 0), 0, 100) * 0.08);
  }
  if (classifiedAlerts?.confidence != null) {
    score = Math.round(score * 0.92 + clamp(Math.round(Number(classifiedAlerts.confidence) || 0), 0, 100) * 0.06);
  }
  if ((trends?.historyCount || 0) < TREND_MIN_SNAPSHOTS) {
    score = Math.min(score, 55);
  }
  return clamp(Math.round(score), 0, 100);
}

function buildStabilitySummary({
  stabilityScore,
  stabilityLevel,
  operatingConfidence,
  treasuryConsistency,
  volatilityAssessment,
  isSmallDollar,
  driftStatus,
}) {
  const levelPhrase = {
    highly_stable: "highly stable",
    stable: "stable",
    variable: "variable",
    unstable: "showing elevated variability",
  }[stabilityLevel] || "under review";

  if (isSmallDollar) {
    if (stabilityLevel === "highly_stable" || stabilityLevel === "stable") {
      return `Treasury operating stability is ${levelPhrase} at soft-launch dollar levels, with ${treasuryConsistency.replace(/_/g, " ")} signal patterns and ${operatingConfidence.replace(/_/g, " ")} operating confidence. Interpret movements cautiously given limited materiality.`;
    }
    if (driftStatus === "unchanged" || driftStatus === "minor_shift") {
      return `Treasury stability is ${levelPhrase} in a small-dollar environment — recent snapshot variation is modest and advisory conclusions are intentionally conservative.`;
    }
    return `Treasury stability is ${levelPhrase} across recent advisory signals at soft-launch scale — review drift and historical context before adjusting operating posture.`;
  }

  const volatilityNote =
    volatilityAssessment === "elevated_variance"
      ? " Historical volatility indicators suggest elevated operational variance."
      : volatilityAssessment === "highly_stable"
        ? " Volatility remains contained across recent snapshot history."
        : "";

  return `Treasury stability score ${stabilityScore} indicates ${levelPhrase} operating conditions with ${operatingConfidence.replace(/_/g, " ")} confidence and ${treasuryConsistency.replace(/_/g, " ")} treasury consistency.${volatilityNote}`;
}

function collectStabilityScoreSignals({
  trends,
  forecast,
  resilience,
  readiness,
  monitoringDashboard,
  driftDetection,
  historicalAnalytics,
  classifiedAlerts,
  isSmallDollar,
}) {
  let positive = 0;
  let negative = 0;
  const drivers = [];
  const cautionAreas = [];

  const readinessScore = clamp(Math.round(Number(readiness?.readinessScore) || 0), 0, 100);
  const driftMagnitude = clamp(Math.round(Number(driftDetection?.driftMagnitude) || 0), 0, 100);
  const driftStatus = driftDetection?.driftStatus || "unchanged";
  const trendStatus = trends?.trendStatus || "insufficient_data";
  const forecastOutlook = forecast?.outlook || "stable";
  const resilienceLevel = resilience?.resilienceLevel || "moderate";
  const treasuryMomentum = monitoringDashboard?.treasuryMomentum || "stable";
  const alertPriority = isSmallDollar
    ? softenAlertPriority(classifiedAlerts?.alertPriority || "low")
    : classifiedAlerts?.alertPriority || "low";
  const historicalHealthDirection =
    historicalAnalytics?.historicalHealthTrend?.direction || "insufficient_data";
  const volatilityCount = countHistoricalVolatilityStress(historicalAnalytics?.volatilityIndicators);
  const stabilitySignalCount = (monitoringDashboard?.stabilitySignals || []).length;

  let base = readinessScore > 0 ? Math.round(readinessScore * 0.55 + 35) : 50;

  if (trendStatus === "stable" || trendStatus === "improving") {
    positive += isSmallDollar ? 6 : 9;
    drivers.push({
      type: "positive",
      title: "Trend stability",
      explanation:
        trendStatus === "improving"
          ? "Treasury trend status is improving across the snapshot window."
          : "Treasury trend status remains stable across recent snapshots.",
    });
  } else if (trendStatus === "deteriorating") {
    negative += isSmallDollar ? 8 : 14;
    cautionAreas.push("Trend status indicates deteriorating movement across recent snapshots.");
    drivers.push({
      type: "negative",
      title: "Trend deterioration",
      explanation: "Health and obligation trends are moving adversely across the advisory window.",
    });
  }

  if (readiness?.readinessLevel === "resilient" || readiness?.readinessLevel === "strong") {
    positive += 8;
    drivers.push({
      type: "positive",
      title: "Readiness posture",
      explanation: `Readiness level is ${readiness.readinessLevel} — operating preparation remains well supported.`,
    });
  } else if (readiness?.readinessLevel === "not_ready" || readiness?.readinessLevel === "developing") {
    negative += isSmallDollar ? 6 : 10;
    cautionAreas.push("Readiness score trails resilient operating thresholds.");
    drivers.push({
      type: "negative",
      title: "Readiness posture",
      explanation: `Readiness level is ${readiness.readinessLevel} — advisory preparation requires continued monitoring.`,
    });
  }

  if (resilienceLevel === "resilient" || resilienceLevel === "strong") {
    positive += 7;
    drivers.push({
      type: "positive",
      title: "Resilience capacity",
      explanation: `Resilience assessed as ${resilienceLevel} — capacity buffers remain supportive of stability.`,
    });
  } else if (resilienceLevel === "weak") {
    negative += isSmallDollar ? 8 : 12;
    cautionAreas.push("Resilience posture has softened — stability may be more sensitive to shocks.");
    drivers.push({
      type: "negative",
      title: "Resilience capacity",
      explanation: "Resilience level is weak relative to recent operating conditions.",
    });
  } else if (resilienceLevel === "moderate" && trendStatus === "deteriorating") {
    negative += isSmallDollar ? 4 : 7;
    drivers.push({
      type: "context",
      title: "Resilience capacity",
      explanation: "Resilience is moderate while trends deteriorate — stability depends on continued monitoring.",
    });
  }

  if (driftStatus === "unchanged") {
    positive += isSmallDollar ? 5 : 7;
    drivers.push({
      type: "positive",
      title: "Snapshot drift",
      explanation: "Treasury posture is unchanged between the most recent snapshot comparisons.",
    });
  } else if (driftStatus === "meaningful_shift") {
    negative += isSmallDollar ? 12 : 18;
    cautionAreas.push("Meaningful treasury drift detected between recent snapshots.");
    drivers.push({
      type: "negative",
      title: "Snapshot drift",
      explanation: "Multiple advisory indicators shifted materially between recent snapshots.",
    });
  } else if (driftStatus === "moderate_shift") {
    negative += isSmallDollar ? 7 : 12;
    cautionAreas.push("Moderate treasury drift observed — review drift drivers for context.");
    drivers.push({
      type: "negative",
      title: "Snapshot drift",
      explanation: "Several treasury indicators moved across recent snapshot comparisons.",
    });
  } else if (driftStatus === "minor_shift") {
    negative += isSmallDollar ? 2 : 4;
    drivers.push({
      type: "context",
      title: "Snapshot drift",
      explanation: "Minor movement detected between snapshots without sustained operational impact.",
    });
  }

  if (driftMagnitude <= (isSmallDollar ? 18 : 12)) {
    positive += 5;
  } else if (driftMagnitude >= (isSmallDollar ? 40 : 30)) {
    negative += isSmallDollar ? 8 : 12;
    if (!cautionAreas.some((c) => c.includes("drift magnitude"))) {
      cautionAreas.push("Elevated drift magnitude index across recent snapshot comparisons.");
    }
  }

  if (forecastOutlook === "stable" || forecastOutlook === "improving") {
    positive += 5;
    drivers.push({
      type: "positive",
      title: "Forecast outlook",
      explanation: `Forecast outlook is ${forecastOutlook.replace(/_/g, " ")} — near-term pressure remains manageable.`,
    });
  } else if (forecastOutlook === "deteriorating") {
    negative += isSmallDollar ? 8 : 14;
    cautionAreas.push("Forecast outlook indicates emerging deterioration.");
    drivers.push({
      type: "negative",
      title: "Forecast outlook",
      explanation: "Forecast signals point toward deteriorating treasury conditions.",
    });
  } else if (forecastOutlook === "elevated_pressure") {
    negative += isSmallDollar ? 5 : 9;
    drivers.push({
      type: "context",
      title: "Forecast outlook",
      explanation: "Forecast indicates elevated treasury pressure — stability may soften without relief.",
    });
  }

  if (treasuryMomentum === "stable" || treasuryMomentum === "improving") {
    positive += 6;
    drivers.push({
      type: "positive",
      title: "Treasury momentum",
      explanation: `Monitoring dashboard momentum is ${treasuryMomentum} across health and pressure timelines.`,
    });
  } else if (treasuryMomentum === "weakening") {
    negative += isSmallDollar ? 6 : 10;
    cautionAreas.push("Treasury momentum is weakening across monitoring timelines.");
    drivers.push({
      type: "negative",
      title: "Treasury momentum",
      explanation: "Health and pressure timelines indicate weakening momentum.",
    });
  }

  if (
    historicalHealthDirection === "stable" ||
    historicalHealthDirection === "improving"
  ) {
    positive += 6;
    drivers.push({
      type: "positive",
      title: "Historical consistency",
      explanation: "Historical health trend shows consistent or improving movement across snapshot history.",
    });
  } else if (historicalHealthDirection === "deteriorating" || historicalHealthDirection === "weakening") {
    negative += isSmallDollar ? 6 : 9;
    cautionAreas.push("Historical health trend shows softening across snapshot history.");
    drivers.push({
      type: "negative",
      title: "Historical consistency",
      explanation: "Historical analytics indicate softening health movement over the advisory window.",
    });
  }

  if (volatilityCount === 0 && stabilitySignalCount > 0) {
    positive += 4;
    drivers.push({
      type: "positive",
      title: "Monitoring stability",
      explanation: "Monitoring dashboard stability signals are present without elevated historical variance flags.",
    });
  } else if (volatilityCount >= 1) {
    negative += isSmallDollar ? volatilityCount * 4 : volatilityCount * 7;
    cautionAreas.push(
      volatilityCount >= 2
        ? "Repeated historical volatility indicators elevate operational variance."
        : "Historical volatility indicators suggest elevated short-term variance.",
    );
    drivers.push({
      type: "negative",
      title: "Operational variance",
      explanation: "Historical analytics flagged variance or fluctuation patterns across recent snapshots.",
    });
  }

  if (alertPriorityRank(alertPriority) <= alertPriorityRank("low")) {
    positive += 4;
  } else if (alertPriorityRank(alertPriority) >= alertPriorityRank("elevated")) {
    negative += isSmallDollar ? 6 : 11;
    cautionAreas.push(`Classified alert priority is ${alertPriority} — review alert context for stability impact.`);
    drivers.push({
      type: "negative",
      title: "Alert volatility",
      explanation: `Classified alerts carry ${alertPriority} priority, increasing advisory volatility.`,
    });
  } else if (alertPriorityRank(alertPriority) >= alertPriorityRank("medium")) {
    negative += isSmallDollar ? 3 : 5;
    drivers.push({
      type: "context",
      title: "Alert volatility",
      explanation: "Medium-priority alerts warrant continued monitoring for stability effects.",
    });
  }

  const repeatedAlertPattern = (trends?.warningSignals || []).some((w) =>
    String(w?.code || "").includes("repeated_alert"),
  );
  if (repeatedAlertPattern) {
    negative += isSmallDollar ? 4 : 8;
    cautionAreas.push("Repeated alert patterns observed across the trend window.");
    drivers.push({
      type: "negative",
      title: "Alert patterns",
      explanation: "Trend analysis detected recurring alert codes across recent snapshots.",
    });
  }

  if (driftDetection?.stabilityAssessment === "stable" || driftDetection?.stabilityAssessment === "mostly_stable") {
    positive += 4;
  } else if (driftDetection?.stabilityAssessment === "unstable") {
    negative += isSmallDollar ? 6 : 10;
    drivers.push({
      type: "negative",
      title: "Drift stability assessment",
      explanation: "Drift detection characterizes recent movement as unstable relative to prior conditions.",
    });
  }

  const netAdjust = positive - negative;
  let stabilityScore = clamp(Math.round(base + netAdjust), 0, 100);

  if (isSmallDollar) {
    stabilityScore = Math.max(stabilityScore, Math.min(readinessScore || 0, 80));
    if (stabilityScore < 45 && (readinessScore >= 55 || trendStatus === "stable")) {
      stabilityScore = Math.max(stabilityScore, 45);
    }
    if (driftStatus === "unchanged" && trendStatus !== "deteriorating") {
      stabilityScore = Math.max(stabilityScore, 58);
    }
  }

  return {
    stabilityScore,
    drivers: drivers.slice(0, 10),
    cautionAreas: [...new Set(cautionAreas)].slice(0, 8),
    driftMagnitude,
    driftStatus,
    volatilityCount,
    historicalHealthDirection,
    treasuryMomentum,
    riskStablePeriods: historicalAnalytics?.historicalRiskTrend?.stablePeriods || 0,
  };
}

/**
 * Treasury stability score and operating confidence — composite advisory layer (read-only).
 * Does not mutate wallets, payouts, transactions, or persist snapshots.
 * @param {{
 *   trends?: object,
 *   forecast?: object,
 *   resilience?: object,
 *   readiness?: object,
 *   monitoringDashboard?: object,
 *   driftDetection?: object,
 *   historicalAnalytics?: object,
 *   classifiedAlerts?: object,
 * }} [input]
 */
export function calculateTreasuryStability({
  trends = {},
  forecast = {},
  resilience = {},
  readiness = {},
  monitoringDashboard = {},
  driftDetection = {},
  historicalAnalytics = {},
  classifiedAlerts = {},
} = {}) {
  try {
    if (!readiness?.readinessScore && readiness?.readinessScore !== 0) {
      return { ...EMPTY_TREASURY_STABILITY };
    }

    const currentExposure =
      toFiniteNumber(trends.priorExposure) + toFiniteNumber(trends.exposureChange);
    const currentLiabilities =
      toFiniteNumber(trends.priorLiabilities) + toFiniteNumber(trends.liabilityChange);
    const isSmallDollar = isSmallDollarScenarioEnvironment(currentExposure, currentLiabilities);

    const {
      stabilityScore,
      drivers,
      cautionAreas,
      driftMagnitude,
      driftStatus,
      volatilityCount,
      historicalHealthDirection,
      treasuryMomentum,
      riskStablePeriods,
    } = collectStabilityScoreSignals({
      trends,
      forecast,
      resilience,
      readiness,
      monitoringDashboard,
      driftDetection: driftDetection || {},
      historicalAnalytics,
      classifiedAlerts,
      isSmallDollar,
    });

    const stabilityLevel = stabilityScoreToLevel(stabilityScore);
    const operatingConfidence = deriveOperatingConfidenceFromStability({
      stabilityScore,
      driftMagnitude,
      driftStatus,
      historicalVolatilityCount: volatilityCount,
      isSmallDollar,
    });
    const treasuryConsistency = deriveTreasuryConsistency({
      stabilityScore,
      driftStatus,
      treasuryMomentum,
      historicalHealthDirection,
      riskStablePeriods,
      isSmallDollar,
    });
    const volatilityAssessment = deriveVolatilityAssessment({
      historicalVolatilityCount: volatilityCount,
      driftMagnitude,
      trends,
      forecast,
      isSmallDollar,
    });
    const confidence = computeStabilityConfidence({
      trends,
      readiness,
      driftDetection,
      monitoringDashboard,
      historicalAnalytics,
      classifiedAlerts,
    });
    const summary = buildStabilitySummary({
      stabilityScore,
      stabilityLevel,
      operatingConfidence,
      treasuryConsistency,
      volatilityAssessment,
      isSmallDollar,
      driftStatus,
    });

    return {
      stabilityScore,
      stabilityLevel,
      operatingConfidence,
      treasuryConsistency,
      volatilityAssessment,
      confidence,
      summary,
      stabilityDrivers: drivers,
      cautionAreas,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryStability", err: err?.message || err });
    return { ...EMPTY_TREASURY_STABILITY };
  }
}

const EMPTY_TREASURY_SCALING_READINESS = Object.freeze({
  scalingReadinessScore: 0,
  scalingReadinessLevel: "not_ready",
  launchCapacity: "test_only",
  operatingTolerance: "fragile",
  scalingConfidence: 0,
  treasuryCapacityAssessment: "constrained",
  watchAreas: [],
  readinessDrivers: [],
  recommendations: [],
  summary: "Treasury scaling readiness assessment unavailable — baseline health, readiness, and stability signals required.",
});

function scalingReadinessScoreToLevel(score) {
  const s = clamp(Math.round(Number(score) || 0), 0, 100);
  if (s >= 90) return "highly_ready";
  if (s >= 80) return "strong";
  if (s >= 60) return "moderate";
  if (s >= 40) return "limited";
  return "not_ready";
}

function deriveLaunchCapacity({ scalingScore, stabilityScore, driftStatus, driftMagnitude, isSmallDollar }) {
  const score = clamp(Math.round(Number(scalingScore) || 0), 0, 100);
  const stability = clamp(Math.round(Number(stabilityScore) || 0), 0, 100);
  const driftDisruptive =
    driftStatus === "meaningful_shift" ||
    driftStatus === "moderate_shift" ||
    driftMagnitude >= (isSmallDollar ? 40 : 30);

  if (isSmallDollar) {
    if (score >= 80 && stability >= 70 && !driftDisruptive) return "soft_launch_ready";
    if (score >= 65 && stability >= 55 && driftStatus !== "meaningful_shift") return "limited_growth";
    return "test_only";
  }

  if (score >= 88 && stability >= 82 && !driftDisruptive) return "moderate_scale_ready";
  if (score >= 78 && stability >= 68 && driftStatus !== "meaningful_shift") return "soft_launch_ready";
  if (score >= 55 && stability >= 45) return "limited_growth";
  return "test_only";
}

function deriveOperatingTolerance({ scalingScore, stabilityScore, driftStatus, volatilityAssessment, resilienceLevel, isSmallDollar }) {
  const score = clamp(Math.round(Number(scalingScore) || 0), 0, 100);
  const stability = clamp(Math.round(Number(stabilityScore) || 0), 0, 100);
  const driftFragile = driftStatus === "meaningful_shift" || driftStatus === "moderate_shift";
  const varianceElevated =
    volatilityAssessment === "elevated_variance" || volatilityAssessment === "moderate_variance";
  const resilienceWeak = resilienceLevel === "weak";

  if (isSmallDollar) {
    if (score >= 75 && stability >= 65 && !driftFragile && !varianceElevated) return "manageable";
    if (score >= 60 && stability >= 50 && driftStatus === "unchanged") return "manageable";
    return "fragile";
  }

  if (score >= 85 && stability >= 78 && !driftFragile && !varianceElevated && !resilienceWeak) {
    return "resilient";
  }
  if (score >= 70 && stability >= 60 && !driftFragile) return "stable";
  if (score >= 50 && stability >= 40) return "manageable";
  return "fragile";
}

function deriveTreasuryCapacityAssessment({ scalingScore, healthScore, resilienceLevel, operatingTolerance, isSmallDollar }) {
  const score = clamp(Math.round(Number(scalingScore) || 0), 0, 100);
  const health = clamp(Math.round(Number(healthScore) || 0), 0, 100);

  if (isSmallDollar) {
    if (operatingTolerance === "manageable" && score >= 65) return "manageable";
    if (score >= 50 && health >= 55) return "manageable";
    return "constrained";
  }

  if (operatingTolerance === "resilient" && (resilienceLevel === "resilient" || resilienceLevel === "strong")) {
    return "resilient";
  }
  if (score >= 75 && health >= 70 && operatingTolerance !== "fragile") return "healthy";
  if (score >= 50 || operatingTolerance === "manageable") return "manageable";
  return "constrained";
}

function computeScalingConfidence({
  treasuryHealth,
  readiness,
  stability,
  driftDetection,
  monitoringDashboard,
  historicalAnalytics,
  classifiedAlerts,
  operationalGuidance,
}) {
  let score = clamp(Math.round(Number(readiness?.confidence) || 0), 0, 100);
  if (stability?.confidence != null) {
    score = Math.round(score * 0.5 + clamp(Math.round(Number(stability.confidence) || 0), 0, 100) * 0.25);
  }
  if (treasuryHealth?.confidenceScore != null) {
    score = Math.round(score * 0.65 + clamp(Math.round(Number(treasuryHealth.confidenceScore) || 0), 0, 100) * 0.15);
  }
  if (monitoringDashboard?.confidence != null) {
    score = Math.round(score * 0.75 + clamp(Math.round(Number(monitoringDashboard.confidence) || 0), 0, 100) * 0.12);
  }
  if (historicalAnalytics?.confidence != null) {
    score = Math.round(score * 0.82 + clamp(Math.round(Number(historicalAnalytics.confidence) || 0), 0, 100) * 0.1);
  }
  if (driftDetection?.confidence != null) {
    score = Math.round(score * 0.88 + clamp(Math.round(Number(driftDetection.confidence) || 0), 0, 100) * 0.08);
  }
  if (classifiedAlerts?.confidence != null) {
    score = Math.round(score * 0.92 + clamp(Math.round(Number(classifiedAlerts.confidence) || 0), 0, 100) * 0.05);
  }
  if (operationalGuidance?.confidence != null) {
    score = Math.round(score * 0.94 + clamp(Math.round(Number(operationalGuidance.confidence) || 0), 0, 100) * 0.04);
  }
  return clamp(Math.round(score), 0, 100);
}

function collectScalingReadinessSignals({
  treasuryHealth,
  forecast,
  resilience,
  readiness,
  driftDetection,
  stability,
  historicalAnalytics,
  monitoringDashboard,
  classifiedAlerts,
  operationalGuidance,
  isSmallDollar,
}) {
  let positive = 0;
  let negative = 0;
  const drivers = [];
  const watchAreas = [];

  const healthScore = clamp(Math.round(Number(treasuryHealth?.healthScore) || 0), 0, 100);
  const readinessScore = clamp(Math.round(Number(readiness?.readinessScore) || 0), 0, 100);
  const stabilityScore = clamp(Math.round(Number(stability?.stabilityScore) || 0), 0, 100);
  const resilienceScore = clamp(Math.round(Number(resilience?.resilienceScore) || 0), 0, 100);
  const resilienceLevel = resilience?.resilienceLevel || "moderate";
  const driftStatus = driftDetection?.driftStatus || "unchanged";
  const driftMagnitude = clamp(Math.round(Number(driftDetection?.driftMagnitude) || 0), 0, 100);
  const forecastOutlook = forecast?.outlook || "stable";
  const operationalStatus = operationalGuidance?.operationalStatus || "monitor";
  const alertPriority = isSmallDollar
    ? softenAlertPriority(classifiedAlerts?.alertPriority || "low")
    : classifiedAlerts?.alertPriority || "low";
  const treasuryMomentum = monitoringDashboard?.treasuryMomentum || "stable";
  const historicalHealthDirection =
    historicalAnalytics?.historicalHealthTrend?.direction || "insufficient_data";
  const volatilityCount = countHistoricalVolatilityStress(historicalAnalytics?.volatilityIndicators);
  const volatilityAssessment = stability?.volatilityAssessment || "moderate_variance";

  let base = Math.round(
    healthScore * 0.25 + readinessScore * 0.3 + stabilityScore * 0.3 + resilienceScore * 0.15,
  );

  if (healthScore >= 80) {
    positive += isSmallDollar ? 5 : 8;
    drivers.push({
      type: "positive",
      title: "Treasury health",
      explanation: "Health score remains strong — foundational capacity supports continued soft-launch activity.",
    });
  } else if (healthScore < 50) {
    negative += isSmallDollar ? 6 : 12;
    watchAreas.push("Treasury health score trails soft-launch operating thresholds.");
    drivers.push({
      type: "negative",
      title: "Treasury health",
      explanation: "Health score is below resilient operating thresholds — scaling capacity remains constrained.",
    });
  }

  if (readinessScore >= 75) {
    positive += 7;
    drivers.push({
      type: "positive",
      title: "Operational readiness",
      explanation: `Readiness score ${readinessScore} supports continued advisory soft-launch posture.`,
    });
  } else if (readiness?.readinessLevel === "not_ready" || readiness?.readinessLevel === "developing") {
    negative += isSmallDollar ? 6 : 10;
    watchAreas.push("Operational readiness remains below strong soft-launch thresholds.");
    drivers.push({
      type: "negative",
      title: "Operational readiness",
      explanation: `Readiness level is ${readiness.readinessLevel} — scaling assessments remain conservative.`,
    });
  }

  if (stabilityScore >= 75) {
    positive += 7;
    drivers.push({
      type: "positive",
      title: "Operating stability",
      explanation: "Stability score indicates consistent treasury signals across recent advisory windows.",
    });
  } else if (stability?.stabilityLevel === "unstable" || stability?.stabilityLevel === "variable") {
    negative += isSmallDollar ? 6 : 10;
    watchAreas.push("Operating stability is variable — scaling tolerance should remain cautious.");
    drivers.push({
      type: "negative",
      title: "Operating stability",
      explanation: "Stability assessment shows elevated variability across recent signals.",
    });
  }

  if (resilienceLevel === "resilient" || resilienceLevel === "strong") {
    positive += 6;
    drivers.push({
      type: "positive",
      title: "Resilience posture",
      explanation: `Resilience is ${resilienceLevel} — capacity buffers support measured soft-launch growth.`,
    });
  } else if (resilienceLevel === "weak") {
    negative += isSmallDollar ? 7 : 12;
    watchAreas.push("Resilience posture has softened — scaling headroom is limited.");
    drivers.push({
      type: "negative",
      title: "Resilience posture",
      explanation: "Weak resilience reduces advisory confidence in sustained scaling capacity.",
    });
  }

  if (driftStatus === "unchanged") {
    positive += isSmallDollar ? 5 : 7;
    drivers.push({
      type: "positive",
      title: "Drift stability",
      explanation: "Treasury posture is unchanged between recent snapshot comparisons.",
    });
  } else if (driftStatus === "meaningful_shift") {
    negative += isSmallDollar ? 12 : 18;
    watchAreas.push("Meaningful treasury drift detected — review before expanding soft-launch scope.");
    drivers.push({
      type: "negative",
      title: "Repeated drift",
      explanation: "Multiple advisory indicators shifted materially between recent snapshots.",
    });
  } else if (driftStatus === "moderate_shift") {
    negative += isSmallDollar ? 7 : 12;
    watchAreas.push("Moderate treasury drift observed across recent snapshots.");
    drivers.push({
      type: "negative",
      title: "Drift movement",
      explanation: "Several treasury indicators moved across recent snapshot comparisons.",
    });
  }

  if (driftMagnitude >= (isSmallDollar ? 40 : 30)) {
    negative += isSmallDollar ? 6 : 10;
    if (!watchAreas.some((w) => w.includes("drift"))) {
      watchAreas.push("Elevated drift magnitude suggests caution before scaling activity.");
    }
  }

  if (forecastOutlook === "stable" || forecastOutlook === "improving") {
    positive += 5;
    drivers.push({
      type: "positive",
      title: "Forecast stability",
      explanation: `Forecast outlook is ${forecastOutlook.replace(/_/g, " ")} — near-term scaling pressure appears manageable.`,
    });
  } else if (forecastOutlook === "deteriorating") {
    negative += isSmallDollar ? 8 : 14;
    watchAreas.push("Forecast instability indicates caution before expanding soft-launch scope.");
    drivers.push({
      type: "negative",
      title: "Forecast instability",
      explanation: "Forecast signals point toward deteriorating treasury conditions.",
    });
  } else if (forecastOutlook === "elevated_pressure") {
    negative += isSmallDollar ? 5 : 9;
    drivers.push({
      type: "context",
      title: "Forecast pressure",
      explanation: "Forecast indicates elevated treasury pressure — scaling tolerance may soften without relief.",
    });
  }

  if (treasuryMomentum === "stable" || treasuryMomentum === "improving") {
    positive += 5;
    drivers.push({
      type: "positive",
      title: "Monitoring dashboard",
      explanation: `Monitoring momentum is ${treasuryMomentum} — dashboard signals support stable operating posture.`,
    });
  } else if (treasuryMomentum === "weakening") {
    negative += isSmallDollar ? 5 : 9;
    watchAreas.push("Treasury momentum is weakening across monitoring timelines.");
    drivers.push({
      type: "negative",
      title: "Monitoring dashboard",
      explanation: "Health and pressure timelines indicate weakening momentum.",
    });
  }

  if (
    historicalHealthDirection === "stable" ||
    historicalHealthDirection === "improving"
  ) {
    positive += 5;
    drivers.push({
      type: "positive",
      title: "Historical consistency",
      explanation: "Historical analytics show consistent or improving health movement across snapshot history.",
    });
  } else if (historicalHealthDirection === "deteriorating" || historicalHealthDirection === "weakening") {
    negative += isSmallDollar ? 5 : 8;
    watchAreas.push("Historical health trend shows softening across snapshot history.");
    drivers.push({
      type: "negative",
      title: "Historical variance",
      explanation: "Historical analytics indicate softening health movement over the advisory window.",
    });
  }

  if (volatilityCount === 0 && (monitoringDashboard?.stabilitySignals || []).length > 0) {
    positive += 4;
    drivers.push({
      type: "positive",
      title: "Monitoring stability",
      explanation: "Monitoring dashboard stability signals are present without elevated historical variance flags.",
    });
  } else if (volatilityCount >= 1) {
    negative += isSmallDollar ? volatilityCount * 4 : volatilityCount * 7;
    watchAreas.push(
      volatilityCount >= 2
        ? "Repeated historical volatility indicators elevate scaling variance risk."
        : "Historical volatility indicators suggest elevated short-term variance.",
    );
    drivers.push({
      type: "negative",
      title: "Elevated variance",
      explanation: "Historical analytics flagged variance or fluctuation patterns across recent snapshots.",
    });
  }

  if (volatilityAssessment === "elevated_variance") {
    negative += isSmallDollar ? 4 : 7;
    if (!watchAreas.some((w) => w.includes("variance"))) {
      watchAreas.push("Volatility assessment indicates elevated operational variance.");
    }
  }

  if (alertPriorityRank(alertPriority) <= alertPriorityRank("low")) {
    positive += 4;
  } else if (alertPriorityRank(alertPriority) >= alertPriorityRank("elevated")) {
    negative += isSmallDollar ? 6 : 11;
    watchAreas.push(`Classified alert priority is ${alertPriority} — review before expanding soft-launch scope.`);
    drivers.push({
      type: "negative",
      title: "Alert pressure",
      explanation: `Classified alerts carry ${alertPriority} priority, reducing scaling confidence.`,
    });
  } else if (alertPriorityRank(alertPriority) >= alertPriorityRank("medium")) {
    negative += isSmallDollar ? 3 : 5;
    drivers.push({
      type: "context",
      title: "Alert pressure",
      explanation: "Medium-priority alerts warrant continued monitoring before scaling activity.",
    });
  }

  if (operationalStatus === "healthy") {
    positive += 5;
    drivers.push({
      type: "positive",
      title: "Operational guidance",
      explanation: "Operational guidance tier is healthy — advisory posture supports continued soft-launch activity.",
    });
  } else if (operationalStatus === "high_attention" || operationalStatus === "critical_attention") {
    negative += isSmallDollar ? 8 : 14;
    watchAreas.push(`Operational guidance tier is ${operationalStatus.replace(/_/g, " ")} — scaling should remain cautious.`);
    drivers.push({
      type: "negative",
      title: "Operational guidance tier",
      explanation: `Elevated operational guidance tier (${operationalStatus.replace(/_/g, " ")}) constrains scaling readiness.`,
    });
  } else if (operationalStatus === "elevated_attention") {
    negative += isSmallDollar ? 5 : 9;
    drivers.push({
      type: "context",
      title: "Operational guidance tier",
      explanation: "Elevated operational attention suggests measured scaling rather than rapid expansion.",
    });
  }

  const netAdjust = positive - negative;
  let scalingReadinessScore = clamp(Math.round(base + netAdjust), 0, 100);

  if (isSmallDollar) {
    scalingReadinessScore = Math.min(scalingReadinessScore, 85);
    if (scalingReadinessScore < 45 && (readinessScore >= 55 || stabilityScore >= 55)) {
      scalingReadinessScore = Math.max(scalingReadinessScore, 45);
    }
    if (driftStatus === "unchanged" && forecastOutlook !== "deteriorating") {
      scalingReadinessScore = Math.max(scalingReadinessScore, 52);
    }
  }

  return {
    scalingReadinessScore,
    drivers: drivers.slice(0, 10),
    watchAreas: [...new Set(watchAreas)].slice(0, 8),
    driftStatus,
    driftMagnitude,
    volatilityAssessment,
    resilienceLevel,
  };
}

function buildScalingReadinessSummary({
  scalingReadinessScore,
  scalingReadinessLevel,
  launchCapacity,
  operatingTolerance,
  treasuryCapacityAssessment,
  isSmallDollar,
}) {
  const levelPhrase = {
    highly_ready: "highly ready",
    strong: "strong",
    moderate: "moderately ready",
    limited: "limited",
    not_ready: "not yet ready",
  }[scalingReadinessLevel] || "under review";

  const capacityPhrase = {
    test_only: "test-only advisory scope",
    limited_growth: "limited growth capacity",
    soft_launch_ready: "soft-launch ready posture",
    moderate_scale_ready: "moderate scale readiness",
  }[launchCapacity] || "advisory review";

  if (isSmallDollar) {
    const prefix = "Soft-launch testing environment detected; readiness assessments remain advisory.";
    if (scalingReadinessLevel === "highly_ready" || scalingReadinessLevel === "strong") {
      return `${prefix} Treasury appears operationally capable of supporting continued soft-launch activity at ${capacityPhrase} with ${operatingTolerance.replace(/_/g, " ")} operating tolerance.`;
    }
    if (scalingReadinessLevel === "moderate" || scalingReadinessLevel === "limited") {
      return `${prefix} Scaling readiness is ${levelPhrase} (${scalingReadinessScore}/100) — treasury capacity is ${treasuryCapacityAssessment.replace(/_/g, " ")} with ${capacityPhrase}.`;
    }
    return `${prefix} Scaling readiness is ${levelPhrase} — maintain test-only scope and review watch areas before expanding activity.`;
  }

  if (scalingReadinessLevel === "highly_ready" || scalingReadinessLevel === "strong") {
    return `Treasury appears operationally capable of supporting continued soft-launch activity. Scaling readiness is ${levelPhrase} (${scalingReadinessScore}/100) with ${capacityPhrase} and ${operatingTolerance.replace(/_/g, " ")} operating tolerance.`;
  }
  if (scalingReadinessLevel === "moderate") {
    return `Treasury scaling readiness is ${levelPhrase} (${scalingReadinessScore}/100) — ${capacityPhrase} with ${operatingTolerance.replace(/_/g, " ")} operating tolerance. Review watch areas before expanding scope.`;
  }
  return `Treasury scaling readiness is ${levelPhrase} (${scalingReadinessScore}/100). Capacity assessment is ${treasuryCapacityAssessment.replace(/_/g, " ")} — maintain cautious advisory posture and address watch areas.`;
}

function buildScalingReadinessRecommendations({
  scalingReadinessLevel,
  launchCapacity,
  operatingTolerance,
  operationalGuidance,
  isSmallDollar,
}) {
  const recs = [];

  if (isSmallDollar) {
    recs.push("Interpret scaling readiness conservatively — small-dollar volumes limit materiality of advisory signals.");
  }

  if (launchCapacity === "test_only") {
    recs.push("Maintain test-only soft-launch scope until readiness and stability signals improve.");
  } else if (launchCapacity === "limited_growth") {
    recs.push("Limited growth capacity is available — expand activity incrementally while monitoring drift and alerts.");
  } else if (launchCapacity === "soft_launch_ready") {
    recs.push("Treasury signals support continued soft-launch activity — maintain routine monitoring cadence.");
  } else if (launchCapacity === "moderate_scale_ready") {
    recs.push("Advisory signals support moderate scale readiness — continue monitoring before broader expansion.");
  }

  if (operatingTolerance === "fragile") {
    recs.push("Operating tolerance is fragile — avoid rapid volume increases until stability improves.");
  } else if (operatingTolerance === "manageable") {
    recs.push("Operating tolerance is manageable — proceed with measured soft-launch adjustments.");
  }

  if (scalingReadinessLevel === "not_ready" || scalingReadinessLevel === "limited") {
    recs.push("Review readiness drivers and watch areas before adjusting soft-launch operating posture.");
  }

  const guidanceChecks = (operationalGuidance?.recommendedChecks || []).slice(0, 2);
  for (const check of guidanceChecks) {
    if (check && typeof check === "string") recs.push(check);
    else if (check?.title) recs.push(check.title);
  }

  return [...new Set(recs)].slice(0, 8);
}

/**
 * Treasury soft-launch scaling readiness — composite advisory layer (read-only).
 * Does not mutate wallets, payouts, transactions, or persist snapshots.
 * @param {{
 *   treasuryHealth?: object,
 *   health?: object,
 *   forecast?: object,
 *   resilience?: object,
 *   readiness?: object,
 *   driftDetection?: object,
 *   stability?: object,
 *   historicalAnalytics?: object,
 *   monitoringDashboard?: object,
 *   classifiedAlerts?: object,
 *   operationalGuidance?: object,
 * }} [input]
 */
export function calculateTreasuryScalingReadiness({
  treasuryHealth,
  health: healthAlias,
  forecast = {},
  resilience = {},
  readiness = {},
  driftDetection = {},
  stability = {},
  historicalAnalytics = {},
  monitoringDashboard = {},
  classifiedAlerts = {},
  operationalGuidance = {},
} = {}) {
  try {
    const health = treasuryHealth || healthAlias;
    if (!health?.healthScore && health?.healthScore !== 0) {
      return { ...EMPTY_TREASURY_SCALING_READINESS };
    }
    if (!readiness?.readinessScore && readiness?.readinessScore !== 0) {
      return { ...EMPTY_TREASURY_SCALING_READINESS };
    }
    if (!stability?.stabilityScore && stability?.stabilityScore !== 0) {
      return { ...EMPTY_TREASURY_SCALING_READINESS };
    }

    const metrics = health?.sourceSnapshot?.metrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    const {
      scalingReadinessScore,
      drivers,
      watchAreas,
      driftStatus,
      driftMagnitude,
      volatilityAssessment,
      resilienceLevel,
    } = collectScalingReadinessSignals({
      treasuryHealth: health,
      forecast,
      resilience,
      readiness,
      driftDetection,
      stability,
      historicalAnalytics,
      monitoringDashboard,
      classifiedAlerts,
      operationalGuidance,
      isSmallDollar,
    });

    const scalingReadinessLevel = scalingReadinessScoreToLevel(scalingReadinessScore);
    const launchCapacity = deriveLaunchCapacity({
      scalingScore: scalingReadinessScore,
      stabilityScore: stability.stabilityScore,
      driftStatus,
      driftMagnitude,
      isSmallDollar,
    });
    const operatingTolerance = deriveOperatingTolerance({
      scalingScore: scalingReadinessScore,
      stabilityScore: stability.stabilityScore,
      driftStatus,
      volatilityAssessment,
      resilienceLevel,
      isSmallDollar,
    });
    const treasuryCapacityAssessment = deriveTreasuryCapacityAssessment({
      scalingScore: scalingReadinessScore,
      healthScore: health.healthScore,
      resilienceLevel,
      operatingTolerance,
      isSmallDollar,
    });
    const scalingConfidence = computeScalingConfidence({
      treasuryHealth: health,
      readiness,
      stability,
      driftDetection,
      monitoringDashboard,
      historicalAnalytics,
      classifiedAlerts,
      operationalGuidance,
    });
    const summary = buildScalingReadinessSummary({
      scalingReadinessScore,
      scalingReadinessLevel,
      launchCapacity,
      operatingTolerance,
      treasuryCapacityAssessment,
      isSmallDollar,
    });
    const recommendations = buildScalingReadinessRecommendations({
      scalingReadinessLevel,
      launchCapacity,
      operatingTolerance,
      operationalGuidance,
      isSmallDollar,
    });

    return {
      scalingReadinessScore,
      scalingReadinessLevel,
      launchCapacity,
      operatingTolerance,
      scalingConfidence,
      treasuryCapacityAssessment,
      watchAreas,
      readinessDrivers: drivers,
      recommendations,
      summary,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryScalingReadiness", err: err?.message || err });
    return { ...EMPTY_TREASURY_SCALING_READINESS };
  }
}

const EMPTY_TREASURY_INTEGRITY = Object.freeze({
  treasuryIntegrityScore: 0,
  treasuryIntegrityLevel: "weak",
  signalTrustLevel: "low",
  treasuryReliability: "uncertain",
  consistencyAssessment: "inconsistent",
  confidence: 0,
  summary: "Treasury integrity assessment unavailable — baseline health, stability, and readiness signals required.",
  integrityDrivers: [],
  concernAreas: [],
  recommendations: [],
});

function treasuryIntegrityScoreToLevel(score) {
  const s = clamp(Math.round(Number(score) || 0), 0, 100);
  if (s >= 90) return "highly_trusted";
  if (s >= 80) return "strong";
  if (s >= 60) return "trusted";
  if (s >= 40) return "developing";
  return "weak";
}

function deriveSignalTrustLevel({ integrityScore, stabilityScore, historicalHealthDirection, driftStatus, isSmallDollar }) {
  const score = clamp(Math.round(Number(integrityScore) || 0), 0, 100);
  const stability = clamp(Math.round(Number(stabilityScore) || 0), 0, 100);
  const driftDisruptive =
    driftStatus === "meaningful_shift" || driftStatus === "moderate_shift";
  const healthUnstable =
    historicalHealthDirection === "deteriorating" || historicalHealthDirection === "weakening";

  if (score >= 85 && stability >= 78 && !driftDisruptive && !healthUnstable) return "high";
  if (score >= 70 && stability >= 62 && driftStatus !== "meaningful_shift") return "strong";
  if (score >= 50 || (isSmallDollar && score >= 45 && driftStatus === "unchanged")) return "moderate";
  return "low";
}

function deriveTreasuryReliability({
  integrityScore,
  stabilityScore,
  readinessScore,
  driftStatus,
  treasuryMomentum,
  operationalStatus,
  isSmallDollar,
}) {
  const score = clamp(Math.round(Number(integrityScore) || 0), 0, 100);
  const stability = clamp(Math.round(Number(stabilityScore) || 0), 0, 100);
  const readiness = clamp(Math.round(Number(readinessScore) || 0), 0, 100);
  const driftFragile = driftStatus === "meaningful_shift" || driftStatus === "moderate_shift";
  const momentumWeak = treasuryMomentum === "weakening";
  const opsConcern =
    operationalStatus === "high_attention" || operationalStatus === "critical_attention";

  if (
    score >= 85 &&
    stability >= 75 &&
    readiness >= 70 &&
    !driftFragile &&
    !momentumWeak &&
    !opsConcern
  ) {
    return "highly_reliable";
  }
  if (
    score >= 68 &&
    stability >= 58 &&
    !driftFragile &&
    !momentumWeak
  ) {
    return "reliable";
  }
  if (
    score >= 50 ||
    (isSmallDollar && score >= 42 && driftStatus === "unchanged" && !opsConcern)
  ) {
    return "improving";
  }
  return "uncertain";
}

function deriveIntegrityConsistencyAssessment({
  integrityScore,
  stabilityConsistency,
  historicalHealthDirection,
  driftStatus,
  volatilityCount,
  isSmallDollar,
}) {
  const score = clamp(Math.round(Number(integrityScore) || 0), 0, 100);
  const driftDisruptive =
    driftStatus === "meaningful_shift" || driftStatus === "moderate_shift";
  const healthUnstable =
    historicalHealthDirection === "deteriorating" || historicalHealthDirection === "weakening";

  if (
    stabilityConsistency === "highly_consistent" &&
    score >= 80 &&
    !driftDisruptive &&
    volatilityCount === 0
  ) {
    return "highly_consistent";
  }
  if (
    (stabilityConsistency === "consistent" || stabilityConsistency === "highly_consistent") &&
    score >= 65 &&
    !driftDisruptive &&
    !healthUnstable
  ) {
    return "consistent";
  }
  if (score >= 45 || (isSmallDollar && score >= 40 && driftStatus !== "meaningful_shift")) {
    return "mixed";
  }
  return "inconsistent";
}

function computeIntegrityConfidence({
  treasuryHealth,
  readiness,
  stability,
  driftDetection,
  monitoringDashboard,
  historicalAnalytics,
  classifiedAlerts,
  operationalGuidance,
  scalingReadiness,
}) {
  let score = clamp(Math.round(Number(stability?.confidence) || 0), 0, 100);
  if (readiness?.confidence != null) {
    score = Math.round(score * 0.55 + clamp(Math.round(Number(readiness.confidence) || 0), 0, 100) * 0.2);
  }
  if (treasuryHealth?.confidenceScore != null) {
    score = Math.round(score * 0.65 + clamp(Math.round(Number(treasuryHealth.confidenceScore) || 0), 0, 100) * 0.15);
  }
  if (monitoringDashboard?.confidence != null) {
    score = Math.round(score * 0.72 + clamp(Math.round(Number(monitoringDashboard.confidence) || 0), 0, 100) * 0.12);
  }
  if (historicalAnalytics?.confidence != null) {
    score = Math.round(score * 0.8 + clamp(Math.round(Number(historicalAnalytics.confidence) || 0), 0, 100) * 0.1);
  }
  if (driftDetection?.confidence != null) {
    score = Math.round(score * 0.86 + clamp(Math.round(Number(driftDetection.confidence) || 0), 0, 100) * 0.08);
  }
  if (classifiedAlerts?.confidence != null) {
    score = Math.round(score * 0.9 + clamp(Math.round(Number(classifiedAlerts.confidence) || 0), 0, 100) * 0.06);
  }
  if (operationalGuidance?.confidence != null) {
    score = Math.round(score * 0.92 + clamp(Math.round(Number(operationalGuidance.confidence) || 0), 0, 100) * 0.05);
  }
  if (scalingReadiness?.scalingConfidence != null) {
    score = Math.round(score * 0.94 + clamp(Math.round(Number(scalingReadiness.scalingConfidence) || 0), 0, 100) * 0.04);
  }
  return clamp(Math.round(score), 0, 100);
}

function collectTreasuryIntegritySignals({
  treasuryHealth,
  trends,
  forecast,
  resilience,
  readiness,
  driftDetection,
  stability,
  historicalAnalytics,
  monitoringDashboard,
  classifiedAlerts,
  operationalGuidance,
  isSmallDollar,
}) {
  let positive = 0;
  let negative = 0;
  const drivers = [];
  const concernAreas = [];

  const healthScore = clamp(Math.round(Number(treasuryHealth?.healthScore) || 0), 0, 100);
  const readinessScore = clamp(Math.round(Number(readiness?.readinessScore) || 0), 0, 100);
  const stabilityScore = clamp(Math.round(Number(stability?.stabilityScore) || 0), 0, 100);
  const resilienceLevel = resilience?.resilienceLevel || "moderate";
  const driftStatus = driftDetection?.driftStatus || "unchanged";
  const driftMagnitude = clamp(Math.round(Number(driftDetection?.driftMagnitude) || 0), 0, 100);
  const trendStatus = trends?.trendStatus || "unknown";
  const forecastOutlook = forecast?.outlook || "stable";
  const operationalStatus = operationalGuidance?.operationalStatus || "monitor";
  const alertPriority = isSmallDollar
    ? softenAlertPriority(classifiedAlerts?.alertPriority || "low")
    : classifiedAlerts?.alertPriority || "low";
  const treasuryMomentum = monitoringDashboard?.treasuryMomentum || "stable";
  const historicalHealthDirection =
    historicalAnalytics?.historicalHealthTrend?.direction || "insufficient_data";
  const volatilityCount = countHistoricalVolatilityStress(historicalAnalytics?.volatilityIndicators);
  const volatilityAssessment = stability?.volatilityAssessment || "moderate_variance";
  const monitoringHealth = monitoringDashboard?.treasuryCondition || "stable";

  let base = Math.round(
    stabilityScore * 0.35 +
      readinessScore * 0.25 +
      healthScore * 0.15 +
      clamp(Math.round(Number(resilience?.resilienceScore) || 0), 0, 100) * 0.15 +
      (monitoringDashboard?.confidence != null
        ? clamp(Math.round(Number(monitoringDashboard.confidence) || 0), 0, 100) * 0.1
        : 50 * 0.1),
  );

  if (stabilityScore >= 75) {
    positive += isSmallDollar ? 6 : 9;
    drivers.push({
      type: "positive",
      title: "Operating stability",
      explanation: "Stability score indicates consistent treasury signals across recent advisory windows.",
    });
  } else if (stability?.stabilityLevel === "unstable" || stability?.stabilityLevel === "variable") {
    negative += isSmallDollar ? 7 : 12;
    concernAreas.push("Operating stability is variable — integrity assessments remain cautious.");
    drivers.push({
      type: "negative",
      title: "Operating stability",
      explanation: "Stability assessment shows elevated variability across recent signals.",
    });
  }

  if (readinessScore >= 75) {
    positive += 7;
    drivers.push({
      type: "positive",
      title: "Operational readiness",
      explanation: `Readiness score ${readinessScore} supports advisory trust in treasury signal quality.`,
    });
  } else if (readiness?.readinessLevel === "not_ready" || readiness?.readinessLevel === "developing") {
    negative += isSmallDollar ? 6 : 10;
    concernAreas.push("Operational readiness trails resilient thresholds — trust assessments remain conservative.");
    drivers.push({
      type: "negative",
      title: "Operational readiness",
      explanation: `Readiness level is ${readiness.readinessLevel} — integrity confidence is moderated accordingly.`,
    });
  }

  if (trendStatus === "stable" || trendStatus === "improving") {
    positive += isSmallDollar ? 5 : 8;
    drivers.push({
      type: "positive",
      title: "Trend stability",
      explanation:
        trendStatus === "improving"
          ? "Treasury trend status is improving — signal trajectory supports advisory trust."
          : "Treasury trend status remains stable across recent snapshots.",
    });
  } else if (trendStatus === "deteriorating") {
    negative += isSmallDollar ? 8 : 14;
    concernAreas.push("Trend deterioration reduces confidence in treasury signal reliability.");
    drivers.push({
      type: "negative",
      title: "Trend deterioration",
      explanation: "Health and obligation trends are moving adversely across the advisory window.",
    });
  }

  if (resilienceLevel === "resilient" || resilienceLevel === "strong") {
    positive += 6;
    drivers.push({
      type: "positive",
      title: "Resilience posture",
      explanation: `Resilience is ${resilienceLevel} — capacity buffers support signal reliability.`,
    });
  } else if (resilienceLevel === "weak") {
    negative += isSmallDollar ? 7 : 12;
    concernAreas.push("Resilience posture has softened — treasury reliability may be more sensitive to shocks.");
    drivers.push({
      type: "negative",
      title: "Resilience weakening",
      explanation: "Weak resilience reduces advisory confidence in sustained treasury signal quality.",
    });
  }

  if (driftStatus === "unchanged") {
    positive += isSmallDollar ? 5 : 7;
    drivers.push({
      type: "positive",
      title: "Low drift",
      explanation: "Treasury posture is unchanged between recent snapshot comparisons.",
    });
  } else if (driftStatus === "meaningful_shift") {
    negative += isSmallDollar ? 12 : 18;
    concernAreas.push("Repeated meaningful drift detected — review signal consistency before relying on assessments.");
    drivers.push({
      type: "negative",
      title: "Repeated drift",
      explanation: "Multiple advisory indicators shifted materially between recent snapshots.",
    });
  } else if (driftStatus === "moderate_shift") {
    negative += isSmallDollar ? 7 : 12;
    concernAreas.push("Moderate treasury drift observed across recent snapshots.");
    drivers.push({
      type: "negative",
      title: "Drift movement",
      explanation: "Several treasury indicators moved across recent snapshot comparisons.",
    });
  }

  if (driftMagnitude >= (isSmallDollar ? 40 : 30)) {
    negative += isSmallDollar ? 6 : 10;
    if (!concernAreas.some((c) => c.includes("drift"))) {
      concernAreas.push("Elevated drift magnitude suggests caution in treasury trust assessments.");
    }
  }

  if (treasuryMomentum === "stable" || treasuryMomentum === "improving") {
    positive += 5;
    drivers.push({
      type: "positive",
      title: "Monitoring dashboard",
      explanation: `Monitoring momentum is ${treasuryMomentum} — dashboard signals support stable advisory posture.`,
    });
  } else if (treasuryMomentum === "weakening") {
    negative += isSmallDollar ? 5 : 9;
    concernAreas.push("Treasury momentum is weakening across monitoring timelines.");
    drivers.push({
      type: "negative",
      title: "Unstable signals",
      explanation: "Health and pressure timelines indicate weakening momentum.",
    });
  }

  if (monitoringHealth === "healthy" || monitoringHealth === "stable") {
    positive += 4;
    drivers.push({
      type: "positive",
      title: "Dashboard health",
      explanation: `Monitoring dashboard condition is ${monitoringHealth} — treasury signals appear well-formed.`,
    });
  } else if (monitoringHealth === "stressed" || monitoringHealth === "watch") {
    negative += isSmallDollar ? 5 : 8;
    concernAreas.push(`Monitoring dashboard condition is ${monitoringHealth} — signal quality may be impaired.`);
    drivers.push({
      type: "negative",
      title: "Monitoring concern",
      explanation: "Dashboard condition indicates elevated treasury pressure or watch status.",
    });
  }

  if (
    historicalHealthDirection === "stable" ||
    historicalHealthDirection === "improving"
  ) {
    positive += 6;
    drivers.push({
      type: "positive",
      title: "Historical consistency",
      explanation: "Historical analytics show consistent or improving health movement across snapshot history.",
    });
  } else if (historicalHealthDirection === "deteriorating" || historicalHealthDirection === "weakening") {
    negative += isSmallDollar ? 5 : 9;
    concernAreas.push("Historical health trend shows softening — consistency assessment is moderated.");
    drivers.push({
      type: "negative",
      title: "Historical variance",
      explanation: "Historical analytics indicate softening health movement over the advisory window.",
    });
  }

  if (volatilityCount === 0 && (monitoringDashboard?.stabilitySignals || []).length > 0) {
    positive += 4;
    drivers.push({
      type: "positive",
      title: "Low alert volatility",
      explanation: "Monitoring stability signals are present without elevated historical variance flags.",
    });
  } else if (volatilityCount >= 1) {
    negative += isSmallDollar ? volatilityCount * 4 : volatilityCount * 7;
    concernAreas.push(
      volatilityCount >= 2
        ? "Repeated historical volatility indicators elevate alert variance risk."
        : "Historical volatility indicators suggest elevated short-term variance.",
    );
    drivers.push({
      type: "negative",
      title: "Alert volatility",
      explanation: "Historical analytics flagged variance or fluctuation patterns across recent snapshots.",
    });
  }

  if (volatilityAssessment === "elevated_variance") {
    negative += isSmallDollar ? 4 : 7;
    if (!concernAreas.some((c) => c.includes("variance"))) {
      concernAreas.push("Volatility assessment indicates elevated operational variance.");
    }
  }

  if (forecastOutlook === "stable" || forecastOutlook === "improving") {
    positive += 4;
    drivers.push({
      type: "positive",
      title: "Forecast stability",
      explanation: `Forecast outlook is ${forecastOutlook.replace(/_/g, " ")} — near-term signal reliability appears manageable.`,
    });
  } else if (forecastOutlook === "deteriorating") {
    negative += isSmallDollar ? 7 : 12;
    concernAreas.push("Forecast instability indicates caution in treasury trust assessments.");
    drivers.push({
      type: "negative",
      title: "Forecast instability",
      explanation: "Forecast signals point toward deteriorating treasury conditions.",
    });
  }

  if (alertPriorityRank(alertPriority) <= alertPriorityRank("low")) {
    positive += 4;
  } else if (alertPriorityRank(alertPriority) >= alertPriorityRank("elevated")) {
    negative += isSmallDollar ? 6 : 11;
    concernAreas.push(`Classified alert priority is ${alertPriority} — review alert context for integrity impact.`);
    drivers.push({
      type: "negative",
      title: "Alert pressure",
      explanation: `Classified alerts carry ${alertPriority} priority, reducing signal trust.`,
    });
  } else if (alertPriorityRank(alertPriority) >= alertPriorityRank("medium")) {
    negative += isSmallDollar ? 3 : 5;
    drivers.push({
      type: "context",
      title: "Alert pressure",
      explanation: "Medium-priority alerts warrant continued monitoring before relying on treasury assessments.",
    });
  }

  if (operationalStatus === "healthy") {
    positive += 5;
    drivers.push({
      type: "positive",
      title: "Operational guidance",
      explanation: "Operational guidance tier is healthy — advisory posture supports signal reliability.",
    });
  } else if (operationalStatus === "high_attention" || operationalStatus === "critical_attention") {
    negative += isSmallDollar ? 8 : 14;
    concernAreas.push(`Operational guidance tier is ${operationalStatus.replace(/_/g, " ")} — trust assessments remain cautious.`);
    drivers.push({
      type: "negative",
      title: "Operational concern",
      explanation: `Elevated operational guidance tier (${operationalStatus.replace(/_/g, " ")}) constrains treasury integrity confidence.`,
    });
  } else if (operationalStatus === "elevated_attention") {
    negative += isSmallDollar ? 5 : 9;
    drivers.push({
      type: "context",
      title: "Operational concern",
      explanation: "Elevated operational attention suggests measured reliance on treasury assessments.",
    });
  }

  const netAdjust = positive - negative;
  let treasuryIntegrityScore = clamp(Math.round(base + netAdjust), 0, 100);

  if (isSmallDollar) {
    treasuryIntegrityScore = Math.min(treasuryIntegrityScore, 88);
    if (treasuryIntegrityScore < 45 && (readinessScore >= 55 || stabilityScore >= 55)) {
      treasuryIntegrityScore = Math.max(treasuryIntegrityScore, 45);
    }
    if (driftStatus === "unchanged" && forecastOutlook !== "deteriorating") {
      treasuryIntegrityScore = Math.max(treasuryIntegrityScore, 50);
    }
  }

  return {
    treasuryIntegrityScore,
    drivers: drivers.slice(0, 10),
    concernAreas: [...new Set(concernAreas)].slice(0, 8),
    driftStatus,
    driftMagnitude,
    volatilityCount,
    historicalHealthDirection,
    treasuryMomentum,
    operationalStatus,
  };
}

function buildTreasuryIntegritySummary({
  treasuryIntegrityScore,
  treasuryIntegrityLevel,
  signalTrustLevel,
  treasuryReliability,
  consistencyAssessment,
  isSmallDollar,
}) {
  const levelPhrase = {
    highly_trusted: "highly trusted",
    strong: "strong",
    trusted: "trusted",
    developing: "developing",
    weak: "weak",
  }[treasuryIntegrityLevel] || "under review";

  const trustPhrase = {
    high: "high signal trust",
    strong: "strong signal trust",
    moderate: "moderate signal trust",
    low: "low signal trust",
  }[signalTrustLevel] || "advisory review";

  const reliabilityPhrase = {
    highly_reliable: "highly reliable",
    reliable: "reliable",
    improving: "improving",
    uncertain: "uncertain",
  }[treasuryReliability] || "under review";

  if (isSmallDollar) {
    const prefix = "Soft-launch testing environment detected; treasury trust assessments remain advisory.";
    if (treasuryIntegrityLevel === "highly_trusted" || treasuryIntegrityLevel === "strong") {
      return `${prefix} Treasury integrity is ${levelPhrase} (${treasuryIntegrityScore}/100) with ${trustPhrase} and ${reliabilityPhrase} advisory reliability.`;
    }
    if (treasuryIntegrityLevel === "trusted" || treasuryIntegrityLevel === "developing") {
      return `${prefix} Treasury integrity is ${levelPhrase} (${treasuryIntegrityScore}/100) — consistency is ${consistencyAssessment.replace(/_/g, " ")} with ${trustPhrase}.`;
    }
    return `${prefix} Treasury integrity is ${levelPhrase} — review concern areas and maintain cautious advisory posture.`;
  }

  if (treasuryIntegrityLevel === "highly_trusted" || treasuryIntegrityLevel === "strong") {
    return `Treasury integrity is ${levelPhrase} (${treasuryIntegrityScore}/100) with ${trustPhrase} and ${reliabilityPhrase} advisory reliability. Consistency assessment is ${consistencyAssessment.replace(/_/g, " ")}.`;
  }
  if (treasuryIntegrityLevel === "trusted") {
    return `Treasury integrity is ${levelPhrase} (${treasuryIntegrityScore}/100) — ${trustPhrase} with ${reliabilityPhrase} reliability. Review concern areas for context.`;
  }
  return `Treasury integrity is ${levelPhrase} (${treasuryIntegrityScore}/100). Signal trust is ${trustPhrase.replace(" signal trust", "")} — maintain cautious advisory posture and address concern areas.`;
}

function buildTreasuryIntegrityRecommendations({
  treasuryIntegrityLevel,
  signalTrustLevel,
  treasuryReliability,
  consistencyAssessment,
  operationalGuidance,
  isSmallDollar,
}) {
  const recs = [];

  if (isSmallDollar) {
    recs.push("Interpret treasury integrity conservatively — small-dollar volumes limit materiality of advisory signals.");
  }

  if (treasuryIntegrityLevel === "weak" || treasuryIntegrityLevel === "developing") {
    recs.push("Review integrity drivers and concern areas before relying on treasury assessments for operational decisions.");
  }

  if (signalTrustLevel === "low" || signalTrustLevel === "moderate") {
    recs.push("Signal trust is moderated — cross-reference assessments with monitoring dashboard and drift context.");
  }

  if (treasuryReliability === "uncertain" || treasuryReliability === "improving") {
    recs.push("Treasury reliability is not yet established — maintain routine monitoring cadence before expanding reliance.");
  }

  if (consistencyAssessment === "inconsistent" || consistencyAssessment === "mixed") {
    recs.push("Consistency assessment indicates variance — review historical analytics before treating signals as stable.");
  }

  if (treasuryIntegrityLevel === "highly_trusted" || treasuryIntegrityLevel === "strong") {
    recs.push("Advisory signals support continued treasury monitoring — maintain established review cadence.");
  }

  const guidanceChecks = (operationalGuidance?.recommendedChecks || []).slice(0, 2);
  for (const check of guidanceChecks) {
    if (check && typeof check === "string") recs.push(check);
    else if (check?.title) recs.push(check.title);
  }

  return [...new Set(recs)].slice(0, 8);
}

/**
 * Treasury integrity and trust — composite advisory layer (read-only).
 * Does not mutate wallets, payouts, transactions, or persist snapshots.
 * @param {{
 *   treasuryHealth?: object,
 *   health?: object,
 *   trends?: object,
 *   forecast?: object,
 *   resilience?: object,
 *   readiness?: object,
 *   driftDetection?: object,
 *   stability?: object,
 *   scalingReadiness?: object,
 *   historicalAnalytics?: object,
 *   monitoringDashboard?: object,
 *   classifiedAlerts?: object,
 *   operationalGuidance?: object,
 * }} [input]
 */
export function calculateTreasuryIntegrity({
  treasuryHealth,
  health: healthAlias,
  trends = {},
  forecast = {},
  resilience = {},
  readiness = {},
  driftDetection = {},
  stability = {},
  scalingReadiness = {},
  historicalAnalytics = {},
  monitoringDashboard = {},
  classifiedAlerts = {},
  operationalGuidance = {},
} = {}) {
  try {
    const health = treasuryHealth || healthAlias;
    if (!health?.healthScore && health?.healthScore !== 0) {
      return { ...EMPTY_TREASURY_INTEGRITY };
    }
    if (!readiness?.readinessScore && readiness?.readinessScore !== 0) {
      return { ...EMPTY_TREASURY_INTEGRITY };
    }
    if (!stability?.stabilityScore && stability?.stabilityScore !== 0) {
      return { ...EMPTY_TREASURY_INTEGRITY };
    }

    const metrics = health?.sourceSnapshot?.metrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    const {
      treasuryIntegrityScore,
      drivers,
      concernAreas,
      driftStatus,
      historicalHealthDirection,
      treasuryMomentum,
      operationalStatus,
      volatilityCount,
    } = collectTreasuryIntegritySignals({
      treasuryHealth: health,
      trends,
      forecast,
      resilience,
      readiness,
      driftDetection,
      stability,
      historicalAnalytics,
      monitoringDashboard,
      classifiedAlerts,
      operationalGuidance,
      isSmallDollar,
    });

    const treasuryIntegrityLevel = treasuryIntegrityScoreToLevel(treasuryIntegrityScore);
    const signalTrustLevel = deriveSignalTrustLevel({
      integrityScore: treasuryIntegrityScore,
      stabilityScore: stability.stabilityScore,
      historicalHealthDirection,
      driftStatus,
      isSmallDollar,
    });
    const treasuryReliability = deriveTreasuryReliability({
      integrityScore: treasuryIntegrityScore,
      stabilityScore: stability.stabilityScore,
      readinessScore: readiness.readinessScore,
      driftStatus,
      treasuryMomentum,
      operationalStatus,
      isSmallDollar,
    });
    const consistencyAssessment = deriveIntegrityConsistencyAssessment({
      integrityScore: treasuryIntegrityScore,
      stabilityConsistency: stability.treasuryConsistency,
      historicalHealthDirection,
      driftStatus,
      volatilityCount,
      isSmallDollar,
    });
    const confidence = computeIntegrityConfidence({
      treasuryHealth: health,
      readiness,
      stability,
      driftDetection,
      monitoringDashboard,
      historicalAnalytics,
      classifiedAlerts,
      operationalGuidance,
      scalingReadiness,
    });
    const summary = buildTreasuryIntegritySummary({
      treasuryIntegrityScore,
      treasuryIntegrityLevel,
      signalTrustLevel,
      treasuryReliability,
      consistencyAssessment,
      isSmallDollar,
    });
    const recommendations = buildTreasuryIntegrityRecommendations({
      treasuryIntegrityLevel,
      signalTrustLevel,
      treasuryReliability,
      consistencyAssessment,
      operationalGuidance,
      isSmallDollar,
    });

    return {
      treasuryIntegrityScore,
      treasuryIntegrityLevel,
      signalTrustLevel,
      treasuryReliability,
      consistencyAssessment,
      confidence,
      summary,
      integrityDrivers: drivers,
      concernAreas,
      recommendations,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryIntegrity", err: err?.message || err });
    return { ...EMPTY_TREASURY_INTEGRITY };
  }
}

const EMPTY_TREASURY_GOVERNANCE = Object.freeze({
  governanceScore: 0,
  governanceLevel: "reactive",
  oversightPosture: "active_oversight",
  treasuryOversight: "strong",
  monitoringCadence: "active",
  confidence: 0,
  summary: "Treasury governance assessment unavailable — baseline health, readiness, and stability signals required.",
  governanceDrivers: [],
  watchAreas: [],
  governanceRecommendations: [],
});

function governanceScoreToLevel(score) {
  const s = clamp(Math.round(Number(score) || 0), 0, 100);
  if (s >= 90) return "institutional";
  if (s >= 80) return "strong";
  if (s >= 60) return "controlled";
  if (s >= 40) return "developing";
  return "reactive";
}

function countElevatedClassifiedAlerts(classifiedAlerts) {
  const list = classifiedAlerts?.classifiedAlerts;
  if (!Array.isArray(list)) return 0;
  return list.filter((a) => alertPriorityRank(a?.priority || "low") >= alertPriorityRank("elevated")).length;
}

function collectTreasuryGovernanceSignals({
  treasuryHealth,
  trends,
  forecast,
  resilience,
  readiness,
  driftDetection,
  stability,
  scalingReadiness,
  treasuryIntegrity,
  historicalAnalytics,
  monitoringDashboard,
  classifiedAlerts,
  operationalGuidance,
  isSmallDollar,
}) {
  let positive = 0;
  let negative = 0;
  const drivers = [];
  const watchAreas = [];

  const healthScore = clamp(Math.round(Number(treasuryHealth?.healthScore) || 0), 0, 100);
  const readinessScore = clamp(Math.round(Number(readiness?.readinessScore) || 0), 0, 100);
  const stabilityScore = clamp(Math.round(Number(stability?.stabilityScore) || 0), 0, 100);
  const integrityScore = clamp(Math.round(Number(treasuryIntegrity?.treasuryIntegrityScore) || 0), 0, 100);
  const resilienceLevel = resilience?.resilienceLevel || "moderate";
  const resilienceScore = clamp(Math.round(Number(resilience?.resilienceScore) || 0), 0, 100);
  const driftStatus = driftDetection?.driftStatus || "unchanged";
  const driftMagnitude = clamp(Math.round(Number(driftDetection?.driftMagnitude) || 0), 0, 100);
  const operationalStatus = operationalGuidance?.operationalStatus || "monitor";
  const alertPriority = isSmallDollar
    ? softenAlertPriority(classifiedAlerts?.alertPriority || "low")
    : classifiedAlerts?.alertPriority || "low";
  const elevatedAlertCount = countElevatedClassifiedAlerts(classifiedAlerts);
  const treasuryMomentum = monitoringDashboard?.treasuryMomentum || "stable";
  const monitoringHealth = monitoringDashboard?.treasuryCondition || "stable";
  const historicalHealthDirection =
    historicalAnalytics?.historicalHealthTrend?.direction || "insufficient_data";
  const volatilityCount = countHistoricalVolatilityStress(historicalAnalytics?.volatilityIndicators);
  const forecastOutlook = forecast?.outlook || "stable";
  const scalingScore = clamp(Math.round(Number(scalingReadiness?.scalingReadinessScore) || 0), 0, 100);

  let base = Math.round(
    integrityScore * 0.32 +
      readinessScore * 0.22 +
      stabilityScore * 0.22 +
      healthScore * 0.12 +
      resilienceScore * 0.12,
  );

  if (healthScore >= 80 && operationalStatus === "healthy") {
    positive += isSmallDollar ? 6 : 9;
    drivers.push({
      type: "positive",
      title: "Stable treasury health",
      explanation: "Health score and operational guidance indicate a stable treasury baseline for routine oversight.",
    });
  } else if (healthScore < 55 || operationalStatus === "high_attention" || operationalStatus === "critical_attention") {
    negative += isSmallDollar ? 8 : 14;
    watchAreas.push("Treasury health or operational guidance warrants closer governance review.");
    drivers.push({
      type: "negative",
      title: "Treasury health pressure",
      explanation: "Health or operational signals suggest governance should move beyond routine monitoring.",
    });
  }

  if (integrityScore >= 80) {
    positive += isSmallDollar ? 7 : 10;
    drivers.push({
      type: "positive",
      title: "Strong integrity and trust",
      explanation: `Treasury integrity score ${integrityScore} supports structured oversight and consistent advisory signals.`,
    });
  } else if (
    treasuryIntegrity?.treasuryIntegrityLevel === "weak" ||
    treasuryIntegrity?.treasuryIntegrityLevel === "developing"
  ) {
    negative += isSmallDollar ? 8 : 13;
    watchAreas.push("Integrity and trust assessments remain conservative — governance oversight should reflect that posture.");
    drivers.push({
      type: "negative",
      title: "Weak integrity posture",
      explanation: "Integrity layer indicates developing or weak trust — oversight cadence should remain cautious.",
    });
  }

  if (readinessScore >= 75) {
    positive += 7;
    drivers.push({
      type: "positive",
      title: "Strong operational readiness",
      explanation: `Readiness score ${readinessScore} supports dependable governance and monitoring routines.`,
    });
  } else if (readiness?.readinessLevel === "not_ready" || readiness?.readinessLevel === "developing") {
    negative += isSmallDollar ? 7 : 11;
    watchAreas.push("Operational readiness is not yet resilient — governance should emphasize review before expansion.");
    drivers.push({
      type: "negative",
      title: "Unstable readiness",
      explanation: `Readiness level ${readiness.readinessLevel} moderates governance confidence.`,
    });
  }

  if (stabilityScore >= 75 && (stability?.stabilityLevel === "stable" || stability?.stabilityLevel === "highly_stable")) {
    positive += 6;
    drivers.push({
      type: "positive",
      title: "Operating stability",
      explanation: "Stability signals are consistent — governance can rely on steady advisory inputs.",
    });
  } else if (stability?.stabilityLevel === "unstable" || stability?.stabilityLevel === "variable") {
    negative += isSmallDollar ? 6 : 10;
    watchAreas.push("Operating stability is variable — governance watch areas should include stability drivers.");
    drivers.push({
      type: "negative",
      title: "Stability variance",
      explanation: "Treasury stability assessment shows elevated variability across recent signals.",
    });
  }

  if (driftStatus === "unchanged") {
    positive += isSmallDollar ? 5 : 7;
    drivers.push({
      type: "positive",
      title: "Low drift",
      explanation: "Drift detection shows unchanged posture between recent snapshot comparisons.",
    });
  } else if (driftStatus === "meaningful_shift") {
    negative += isSmallDollar ? 12 : 17;
    watchAreas.push("Repeated meaningful drift detected — elevate governance review of snapshot comparisons.");
    drivers.push({
      type: "negative",
      title: "Repeated drift",
      explanation: "Material drift across advisory indicators suggests governance should intensify review cadence.",
    });
  } else if (driftStatus === "moderate_shift") {
    negative += isSmallDollar ? 7 : 11;
    watchAreas.push("Moderate treasury drift observed — continue structured oversight.");
    drivers.push({
      type: "negative",
      title: "Elevated drift",
      explanation: "Several treasury indicators shifted across recent comparisons.",
    });
  }

  if (resilienceLevel === "resilient" || resilienceLevel === "strong") {
    positive += 6;
    drivers.push({
      type: "positive",
      title: "Healthy resilience",
      explanation: `Resilience is ${resilienceLevel} — capacity buffers support measured governance oversight.`,
    });
  } else if (resilienceLevel === "weak") {
    negative += isSmallDollar ? 8 : 13;
    watchAreas.push("Resilience deterioration increases governance sensitivity to operational shocks.");
    drivers.push({
      type: "negative",
      title: "Resilience weakening",
      explanation: "Weak resilience posture warrants elevated governance attention.",
    });
  }

  if (monitoringHealth === "healthy" || monitoringHealth === "stable") {
    positive += 5;
    drivers.push({
      type: "positive",
      title: "Consistent monitoring dashboard",
      explanation: `Monitoring dashboard condition is ${monitoringHealth} — oversight signals appear well-formed.`,
    });
  } else if (monitoringHealth === "stressed" || monitoringHealth === "watch") {
    negative += isSmallDollar ? 5 : 8;
    watchAreas.push(`Monitoring dashboard condition is ${monitoringHealth}.`);
    drivers.push({
      type: "negative",
      title: "Dashboard pressure",
      explanation: "Monitoring dashboard indicates watch or stressed condition.",
    });
  }

  if (treasuryMomentum === "stable" || treasuryMomentum === "improving") {
    positive += 4;
  } else if (treasuryMomentum === "weakening") {
    negative += isSmallDollar ? 5 : 8;
    watchAreas.push("Treasury momentum is weakening across monitoring timelines.");
    drivers.push({
      type: "negative",
      title: "Weakening momentum",
      explanation: "Monitoring timelines indicate softening treasury momentum.",
    });
  }

  if (
    historicalHealthDirection === "stable" ||
    historicalHealthDirection === "improving"
  ) {
    positive += 5;
    drivers.push({
      type: "positive",
      title: "Stable historical analytics",
      explanation: "Historical health movement is stable or improving across snapshot history.",
    });
  } else if (historicalHealthDirection === "deteriorating" || historicalHealthDirection === "weakening") {
    negative += isSmallDollar ? 5 : 9;
    watchAreas.push("Historical analytics show softening health movement.");
    drivers.push({
      type: "negative",
      title: "Historical softening",
      explanation: "Historical analytics indicate deteriorating or weakening health trends.",
    });
  }

  if (volatilityCount === 0) {
    positive += 3;
    drivers.push({
      type: "positive",
      title: "Low alert volatility",
      explanation: "Historical analytics show limited volatility stress across the advisory window.",
    });
  } else if (volatilityCount >= 1) {
    negative += isSmallDollar ? volatilityCount * 4 : volatilityCount * 6;
    watchAreas.push(
      volatilityCount >= 2
        ? "Repeated historical volatility elevates governance alert sensitivity."
        : "Historical volatility indicators suggest elevated short-term variance.",
    );
    drivers.push({
      type: "negative",
      title: "Alert volatility",
      explanation: "Historical variance patterns increase governance watch sensitivity.",
    });
  }

  if (elevatedAlertCount >= 2 || alertPriorityRank(alertPriority) >= alertPriorityRank("elevated")) {
    negative += isSmallDollar ? 7 : 12;
    watchAreas.push("Repeated or elevated classified alerts suggest increased governance review.");
    drivers.push({
      type: "negative",
      title: "Repeated advisory alerts",
      explanation:
        elevatedAlertCount >= 2
          ? `${elevatedAlertCount} elevated classified alerts warrant increased review cadence.`
          : `Overall alert priority is ${alertPriority} — governance review should intensify.`,
    });
  } else if (elevatedAlertCount === 0 && alertPriorityRank(alertPriority) <= alertPriorityRank("low")) {
    positive += 4;
    drivers.push({
      type: "positive",
      title: "Low alert pressure",
      explanation: "Classified alerts remain low priority — routine governance monitoring is appropriate.",
    });
  }

  if (operationalStatus === "healthy") {
    positive += 5;
    drivers.push({
      type: "positive",
      title: "Operational guidance alignment",
      explanation: "Operational guidance tier is healthy — governance aligns with routine monitoring.",
    });
  } else if (operationalStatus === "high_attention" || operationalStatus === "critical_attention") {
    negative += isSmallDollar ? 9 : 14;
    watchAreas.push(`Operational guidance tier is ${operationalStatus.replace(/_/g, " ")}.`);
    drivers.push({
      type: "negative",
      title: "Elevated operational guidance",
      explanation: `Operational guidance is ${operationalStatus.replace(/_/g, " ")} — governance oversight should reflect elevated attention.`,
    });
  } else if (operationalStatus === "elevated_attention") {
    negative += isSmallDollar ? 5 : 8;
    drivers.push({
      type: "context",
      title: "Elevated operational guidance",
      explanation: "Operational guidance suggests measured governance escalation.",
    });
  }

  if (forecastOutlook === "deteriorating") {
    negative += isSmallDollar ? 6 : 10;
    watchAreas.push("Forecast deterioration may require governance attention to near-term treasury posture.");
    drivers.push({
      type: "negative",
      title: "Forecast pressure",
      explanation: "Forecast outlook indicates deteriorating conditions.",
    });
  } else if (forecastOutlook === "stable" || forecastOutlook === "improving") {
    positive += 3;
  }

  if (scalingScore >= 75) {
    positive += 4;
    drivers.push({
      type: "positive",
      title: "Scaling readiness support",
      explanation: "Scaling readiness signals support structured governance as operations grow.",
    });
  } else if (scalingReadiness?.scalingReadinessLevel === "not_ready" || scalingReadiness?.scalingReadinessLevel === "limited") {
    negative += isSmallDollar ? 4 : 6;
    drivers.push({
      type: "context",
      title: "Limited scaling readiness",
      explanation: "Scaling readiness remains limited — governance should remain conservative during expansion planning.",
    });
  }

  let deterioratingIndicators = 0;
  if (resilienceLevel === "weak") deterioratingIndicators += 1;
  if (driftStatus === "meaningful_shift" || driftStatus === "moderate_shift") deterioratingIndicators += 1;
  if (
    historicalHealthDirection === "deteriorating" ||
    historicalHealthDirection === "weakening"
  ) {
    deterioratingIndicators += 1;
  }
  if (readiness?.readinessLevel === "not_ready" || readiness?.readinessLevel === "developing") {
    deterioratingIndicators += 1;
  }
  if (integrityScore < 50) deterioratingIndicators += 1;
  if (treasuryMomentum === "weakening") deterioratingIndicators += 1;
  if (operationalStatus === "high_attention" || operationalStatus === "critical_attention") {
    deterioratingIndicators += 1;
  }
  if (stability?.stabilityLevel === "unstable" || stability?.stabilityLevel === "variable") {
    deterioratingIndicators += 1;
  }
  if (forecastOutlook === "deteriorating") deterioratingIndicators += 1;

  const isHealthyTreasury =
    healthScore >= 75 &&
    (operationalStatus === "healthy" || (isSmallDollar && operationalStatus === "monitor")) &&
    resilienceLevel !== "weak" &&
    driftStatus === "unchanged" &&
    deterioratingIndicators <= 1;

  const hasRepeatedElevatedAlerts =
    elevatedAlertCount >= 2 || alertPriorityRank(alertPriority) >= alertPriorityRank("elevated");
  const hasResilienceOrDriftConcern =
    resilienceLevel === "weak" ||
    driftStatus === "meaningful_shift" ||
    driftStatus === "moderate_shift" ||
    driftMagnitude >= (isSmallDollar ? 40 : 30);

  let oversightPosture = "routine_monitoring";
  if (deterioratingIndicators >= 3) {
    oversightPosture = "active_oversight";
  } else if (hasResilienceOrDriftConcern) {
    oversightPosture = "elevated_attention";
  } else if (hasRepeatedElevatedAlerts) {
    oversightPosture = "increased_review";
  } else if (isHealthyTreasury) {
    oversightPosture = "routine_monitoring";
  } else if (operationalStatus === "elevated_attention" || healthScore < 65) {
    oversightPosture = "increased_review";
  }

  const netAdjust = positive - negative;
  let governanceScore = clamp(Math.round(base + netAdjust), 0, 100);

  if (isSmallDollar) {
    governanceScore = Math.min(governanceScore, 90);
    if (governanceScore < 42 && (readinessScore >= 55 || stabilityScore >= 55)) {
      governanceScore = Math.max(governanceScore, 42);
    }
    if (driftStatus === "unchanged" && forecastOutlook !== "deteriorating" && deterioratingIndicators <= 1) {
      governanceScore = Math.max(governanceScore, 48);
    }
  }

  return {
    governanceScore,
    drivers: drivers.slice(0, 10),
    watchAreas: [...new Set(watchAreas)].slice(0, 8),
    deterioratingIndicators,
    oversightPosture,
    driftStatus,
    operationalStatus,
    isHealthyTreasury,
    elevatedAlertCount,
  };
}

function deriveTreasuryOversightFromPosture(oversightPosture, governanceScore, isSmallDollar) {
  const score = clamp(Math.round(Number(governanceScore) || 0), 0, 100);
  const posture = String(oversightPosture || "routine_monitoring");

  if (posture === "active_oversight") return "strong";
  if (posture === "elevated_attention") return score >= 55 ? "structured" : "strong";
  if (posture === "increased_review") return score >= 70 ? "moderate" : "structured";
  if (posture === "routine_monitoring") {
    if (score >= 85) return isSmallDollar ? "moderate" : "structured";
    if (score >= 65) return "moderate";
    return "light";
  }
  return score >= 60 ? "moderate" : "light";
}

function deriveMonitoringCadenceFromPosture(oversightPosture, governanceScore) {
  const score = clamp(Math.round(Number(governanceScore) || 0), 0, 100);
  const posture = String(oversightPosture || "routine_monitoring");

  if (posture === "active_oversight") return "active";
  if (posture === "elevated_attention") return "elevated";
  if (posture === "increased_review") return score >= 75 ? "increased" : "elevated";
  if (posture === "routine_monitoring") return score >= 80 ? "routine" : "increased";
  return score >= 50 ? "increased" : "elevated";
}

function computeGovernanceConfidence({
  treasuryHealth,
  readiness,
  stability,
  treasuryIntegrity,
  driftDetection,
  monitoringDashboard,
  historicalAnalytics,
  classifiedAlerts,
  operationalGuidance,
  scalingReadiness,
  resilience,
}) {
  let score = clamp(Math.round(Number(treasuryIntegrity?.confidence) || 0), 0, 100);
  if (readiness?.confidence != null) {
    score = Math.round(score * 0.55 + clamp(Math.round(Number(readiness.confidence) || 0), 0, 100) * 0.2);
  }
  if (stability?.confidence != null) {
    score = Math.round(score * 0.65 + clamp(Math.round(Number(stability.confidence) || 0), 0, 100) * 0.15);
  }
  if (treasuryHealth?.confidenceScore != null) {
    score = Math.round(score * 0.72 + clamp(Math.round(Number(treasuryHealth.confidenceScore) || 0), 0, 100) * 0.12);
  }
  if (monitoringDashboard?.confidence != null) {
    score = Math.round(score * 0.78 + clamp(Math.round(Number(monitoringDashboard.confidence) || 0), 0, 100) * 0.1);
  }
  if (historicalAnalytics?.confidence != null) {
    score = Math.round(score * 0.84 + clamp(Math.round(Number(historicalAnalytics.confidence) || 0), 0, 100) * 0.08);
  }
  if (driftDetection?.confidence != null) {
    score = Math.round(score * 0.88 + clamp(Math.round(Number(driftDetection.confidence) || 0), 0, 100) * 0.06);
  }
  if (classifiedAlerts?.confidence != null) {
    score = Math.round(score * 0.9 + clamp(Math.round(Number(classifiedAlerts.confidence) || 0), 0, 100) * 0.05);
  }
  if (operationalGuidance?.confidence != null) {
    score = Math.round(score * 0.92 + clamp(Math.round(Number(operationalGuidance.confidence) || 0), 0, 100) * 0.04);
  }
  if (scalingReadiness?.scalingConfidence != null) {
    score = Math.round(score * 0.94 + clamp(Math.round(Number(scalingReadiness.scalingConfidence) || 0), 0, 100) * 0.03);
  }
  if (resilience?.confidence != null) {
    score = Math.round(score * 0.96 + clamp(Math.round(Number(resilience.confidence) || 0), 0, 100) * 0.02);
  }
  return clamp(Math.round(score), 0, 100);
}

function buildTreasuryGovernanceSummary({
  governanceScore,
  governanceLevel,
  oversightPosture,
  treasuryOversight,
  monitoringCadence,
  isSmallDollar,
}) {
  const levelPhrase = {
    institutional: "institutional",
    strong: "strong",
    controlled: "controlled",
    developing: "developing",
    reactive: "reactive",
  }[governanceLevel] || "under review";

  const posturePhrase = {
    routine_monitoring: "routine monitoring",
    increased_review: "increased review",
    elevated_attention: "elevated attention",
    active_oversight: "active oversight",
  }[oversightPosture] || "advisory review";

  const oversightPhrase = {
    light: "light",
    moderate: "moderate",
    structured: "structured",
    strong: "strong",
  }[treasuryOversight] || "moderate";

  const cadencePhrase = {
    routine: "routine",
    increased: "increased",
    elevated: "elevated",
    active: "active",
  }[monitoringCadence] || "routine";

  if (isSmallDollar) {
    const prefix = "Soft-launch testing environment detected; governance guidance remains advisory.";
    return `${prefix} Governance score ${governanceScore}/100 (${levelPhrase}) recommends ${posturePhrase} with ${oversightPhrase} treasury oversight and ${cadencePhrase} monitoring cadence.`;
  }

  return `Treasury governance score ${governanceScore}/100 (${levelPhrase}) recommends ${posturePhrase}. Advisory posture: ${oversightPhrase} treasury oversight with ${cadencePhrase} monitoring cadence — read-only, no automated treasury actions.`;
}

function buildTreasuryGovernanceRecommendations({
  governanceLevel,
  oversightPosture,
  treasuryOversight,
  monitoringCadence,
  operationalGuidance,
  watchAreas,
  isSmallDollar,
}) {
  const recs = [];

  if (isSmallDollar) {
    recs.push(
      "Interpret governance guidance conservatively — small-dollar volumes limit materiality of oversight recommendations.",
    );
  }

  if (governanceLevel === "reactive" || governanceLevel === "developing") {
    recs.push("Review governance drivers and watch areas before adjusting operational treasury oversight routines.");
  }

  if (oversightPosture === "active_oversight" || oversightPosture === "elevated_attention") {
    recs.push(
      `Oversight posture is ${oversightPosture.replace(/_/g, " ")} — schedule focused treasury review with operations leadership.`,
    );
  } else if (oversightPosture === "increased_review") {
    recs.push("Increase governance review frequency for classified alerts and drift indicators.");
  } else if (oversightPosture === "routine_monitoring") {
    recs.push("Maintain routine governance monitoring cadence — no escalation recommended based on current signals.");
  }

  if (treasuryOversight === "strong" || monitoringCadence === "active") {
    recs.push("Strong oversight band active — document advisory findings; no financial mutations or automated actions.");
  }

  if (governanceLevel === "institutional" || governanceLevel === "strong") {
    recs.push("Governance signals support structured oversight — continue established review rhythms and snapshot discipline.");
  }

  for (const area of (watchAreas || []).slice(0, 2)) {
    if (area && typeof area === "string") recs.push(`Watch: ${area}`);
  }

  const guidanceChecks = (operationalGuidance?.recommendedChecks || []).slice(0, 2);
  for (const check of guidanceChecks) {
    if (check && typeof check === "string") recs.push(check);
    else if (check?.title) recs.push(check.title);
  }

  return [...new Set(recs)].slice(0, 8);
}

/**
 * Treasury governance and oversight — advisory layer (read-only).
 * Does not mutate wallets, payouts, transactions, or persist snapshots.
 * @param {{
 *   treasuryHealth?: object,
 *   health?: object,
 *   trends?: object,
 *   forecast?: object,
 *   resilience?: object,
 *   readiness?: object,
 *   driftDetection?: object,
 *   stability?: object,
 *   scalingReadiness?: object,
 *   treasuryIntegrity?: object,
 *   operationalGuidance?: object,
 *   monitoringDashboard?: object,
 *   classifiedAlerts?: object,
 *   historicalAnalytics?: object,
 * }} [input]
 */
export function calculateTreasuryGovernance({
  treasuryHealth,
  health: healthAlias,
  trends = {},
  forecast = {},
  resilience = {},
  readiness = {},
  driftDetection = {},
  stability = {},
  scalingReadiness = {},
  treasuryIntegrity: integrityInput,
  operationalGuidance = {},
  monitoringDashboard = {},
  classifiedAlerts = {},
  historicalAnalytics = {},
} = {}) {
  try {
    const health = treasuryHealth || healthAlias;
    if (!health?.healthScore && health?.healthScore !== 0) {
      return { ...EMPTY_TREASURY_GOVERNANCE };
    }
    if (!readiness?.readinessScore && readiness?.readinessScore !== 0) {
      return { ...EMPTY_TREASURY_GOVERNANCE };
    }
    if (!stability?.stabilityScore && stability?.stabilityScore !== 0) {
      return { ...EMPTY_TREASURY_GOVERNANCE };
    }

    const metrics = health?.sourceSnapshot?.metrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    const treasuryIntegrity =
      integrityInput &&
      (integrityInput.treasuryIntegrityScore != null || integrityInput.treasuryIntegrityScore === 0)
        ? integrityInput
        : calculateTreasuryIntegrity({
            treasuryHealth: health,
            trends,
            forecast,
            resilience,
            readiness,
            driftDetection,
            stability,
            scalingReadiness,
            historicalAnalytics,
            monitoringDashboard,
            classifiedAlerts,
            operationalGuidance,
          });

    if (!treasuryIntegrity?.treasuryIntegrityScore && treasuryIntegrity?.treasuryIntegrityScore !== 0) {
      return { ...EMPTY_TREASURY_GOVERNANCE };
    }

    const {
      governanceScore,
      drivers,
      watchAreas,
      oversightPosture,
    } = collectTreasuryGovernanceSignals({
      treasuryHealth: health,
      trends,
      forecast,
      resilience,
      readiness,
      driftDetection,
      stability,
      scalingReadiness,
      treasuryIntegrity,
      historicalAnalytics,
      monitoringDashboard,
      classifiedAlerts,
      operationalGuidance,
      isSmallDollar,
    });

    const governanceLevel = governanceScoreToLevel(governanceScore);
    const treasuryOversight = deriveTreasuryOversightFromPosture(
      oversightPosture,
      governanceScore,
      isSmallDollar,
    );
    const monitoringCadence = deriveMonitoringCadenceFromPosture(oversightPosture, governanceScore);
    const confidence = computeGovernanceConfidence({
      treasuryHealth: health,
      readiness,
      stability,
      treasuryIntegrity,
      driftDetection,
      monitoringDashboard,
      historicalAnalytics,
      classifiedAlerts,
      operationalGuidance,
      scalingReadiness,
      resilience,
    });
    const summary = buildTreasuryGovernanceSummary({
      governanceScore,
      governanceLevel,
      oversightPosture,
      treasuryOversight,
      monitoringCadence,
      isSmallDollar,
    });
    const governanceRecommendations = buildTreasuryGovernanceRecommendations({
      governanceLevel,
      oversightPosture,
      treasuryOversight,
      monitoringCadence,
      operationalGuidance,
      watchAreas,
      isSmallDollar,
    });

    return {
      governanceScore,
      governanceLevel,
      oversightPosture,
      treasuryOversight,
      monitoringCadence,
      confidence,
      summary,
      governanceDrivers: drivers,
      watchAreas,
      governanceRecommendations,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryGovernance", err: err?.message || err });
    return { ...EMPTY_TREASURY_GOVERNANCE };
  }
}

const EMPTY_TREASURY_OPERATING_MODE = Object.freeze({
  treasuryOperatingMode: "observation_mode",
  launchReadinessLevel: "testing_only",
  treasuryPosture: "cautious",
  operatingConfidence: "low",
  recommendedMonitoringLevel: "active",
  confidence: 0,
  summary:
    "Treasury operating mode assessment unavailable — baseline health, readiness, stability, and governance signals required.",
  postureDrivers: [],
  watchAreas: [],
  recommendations: [],
});

function collectTreasuryOperatingModeSignals({
  treasuryHealth,
  trends,
  forecast,
  resilience,
  readiness,
  driftDetection,
  stability,
  scalingReadiness,
  treasuryIntegrity,
  treasuryGovernance,
  historicalAnalytics,
  monitoringDashboard,
  classifiedAlerts,
  operationalGuidance,
  isSmallDollar,
}) {
  const drivers = [];
  const watchAreas = [];

  const healthScore = clamp(Math.round(Number(treasuryHealth?.healthScore) || 0), 0, 100);
  const readinessScore = clamp(Math.round(Number(readiness?.readinessScore) || 0), 0, 100);
  const readinessLevel = readiness?.readinessLevel || "not_ready";
  const stabilityScore = clamp(Math.round(Number(stability?.stabilityScore) || 0), 0, 100);
  const stabilityLevel = stability?.stabilityLevel || "variable";
  const integrityScore = clamp(Math.round(Number(treasuryIntegrity?.treasuryIntegrityScore) || 0), 0, 100);
  const integrityLevel = treasuryIntegrity?.treasuryIntegrityLevel || "weak";
  const governanceScore = clamp(Math.round(Number(treasuryGovernance?.governanceScore) || 0), 0, 100);
  const governanceLevel = treasuryGovernance?.governanceLevel || "reactive";
  const scalingScore = clamp(Math.round(Number(scalingReadiness?.scalingReadinessScore) || 0), 0, 100);
  const scalingLevel = scalingReadiness?.scalingReadinessLevel || "not_ready";
  const launchCapacity = scalingReadiness?.launchCapacity || "test_only";
  const operatingTolerance = scalingReadiness?.operatingTolerance || "fragile";
  const resilienceLevel = resilience?.resilienceLevel || "moderate";
  const resilienceScore = clamp(Math.round(Number(resilience?.resilienceScore) || 0), 0, 100);
  const driftStatus = driftDetection?.driftStatus || "unchanged";
  const driftMagnitude = clamp(Math.round(Number(driftDetection?.driftMagnitude) || 0), 0, 100);
  const operationalStatus = operationalGuidance?.operationalStatus || "monitor";
  const alertPriority = isSmallDollar
    ? softenAlertPriority(classifiedAlerts?.alertPriority || "low")
    : classifiedAlerts?.alertPriority || "low";
  const elevatedAlertCount = countElevatedClassifiedAlerts(classifiedAlerts);
  const treasuryMomentum = monitoringDashboard?.treasuryMomentum || "stable";
  const monitoringHealth = monitoringDashboard?.treasuryCondition || "stable";
  const historicalHealthDirection =
    historicalAnalytics?.historicalHealthTrend?.direction || "insufficient_data";
  const forecastOutlook = forecast?.outlook || "stable";
  const trendStatus = trends?.trendStatus || "insufficient_data";

  const isUnstableTreasury =
    healthScore < 55 ||
    operationalStatus === "high_attention" ||
    operationalStatus === "critical_attention" ||
    stabilityLevel === "unstable" ||
    stabilityLevel === "variable" ||
    treasuryHealth?.treasuryRiskLevel === "critical" ||
    treasuryHealth?.treasuryRiskLevel === "high";

  const hasRepeatedDrift =
    driftStatus === "meaningful_shift" ||
    (driftStatus === "moderate_shift" && driftMagnitude >= (isSmallDollar ? 35 : 25));

  const hasWeakReadiness =
    readinessLevel === "not_ready" ||
    readinessLevel === "developing" ||
    readinessScore < 45;

  const hasWeakIntegrity =
    integrityLevel === "weak" ||
    integrityLevel === "developing" ||
    integrityScore < 50;

  const hasElevatedAlerts =
    elevatedAlertCount >= 2 || alertPriorityRank(alertPriority) >= alertPriorityRank("elevated");

  const isHealthyTreasury =
    healthScore >= 75 &&
    (operationalStatus === "healthy" || (isSmallDollar && operationalStatus === "monitor")) &&
    resilienceLevel !== "weak" &&
    !isUnstableTreasury;

  const hasHealthyResilience =
    resilienceLevel === "resilient" ||
    resilienceLevel === "strong" ||
    (resilienceLevel === "moderate" && resilienceScore >= 55);

  const hasStableReadiness =
    readinessLevel === "operational" ||
    readinessLevel === "strong" ||
    readinessLevel === "resilient" ||
    readinessScore >= 65;

  const hasStrongReadiness =
    readinessScore >= 75 &&
    (readinessLevel === "operational" ||
      readinessLevel === "strong" ||
      readinessLevel === "resilient");

  const hasStrongStability =
    stabilityScore >= 75 &&
    (stabilityLevel === "stable" || stabilityLevel === "highly_stable");

  const hasHealthyScalingReadiness =
    scalingScore >= 75 &&
    (scalingLevel === "strong" || scalingLevel === "highly_ready");

  const hasStrongGovernance =
    governanceScore >= 75 &&
    (governanceLevel === "strong" ||
      governanceLevel === "institutional" ||
      governanceLevel === "controlled");

  const hasLowDrift = driftStatus === "unchanged";

  const hasSoftLaunchScaleTolerance =
    launchCapacity === "soft_launch_ready" ||
    launchCapacity === "limited_growth" ||
    operatingTolerance === "manageable" ||
    operatingTolerance === "stable" ||
    operatingTolerance === "resilient";

  let operationalConcernCount = 0;
  if (operationalStatus === "elevated_attention") operationalConcernCount += 1;
  if (operationalStatus === "high_attention" || operationalStatus === "critical_attention") {
    operationalConcernCount += 2;
  }
  if (elevatedAlertCount >= 1) operationalConcernCount += 1;
  if (treasuryMomentum === "weakening") operationalConcernCount += 1;
  if (
    historicalHealthDirection === "deteriorating" ||
    historicalHealthDirection === "weakening"
  ) {
    operationalConcernCount += 1;
  }
  if (monitoringHealth === "stressed" || monitoringHealth === "watch") operationalConcernCount += 1;
  if (forecastOutlook === "deteriorating") operationalConcernCount += 1;
  if (trendStatus === "deteriorating") operationalConcernCount += 1;
  if (resilienceLevel === "weak") operationalConcernCount += 1;

  const hasRepeatedOperationalConcerns = operationalConcernCount >= 2;

  if (isUnstableTreasury) {
    drivers.push({
      type: "negative",
      title: "Unstable treasury baseline",
      explanation: "Health, stability, or operational guidance indicates treasury is not yet operating from a stable baseline.",
    });
    watchAreas.push("Treasury health and stability require observation before any launch posture adjustment.");
  }

  if (hasRepeatedDrift) {
    drivers.push({
      type: "negative",
      title: "Repeated treasury drift",
      explanation: "Drift detection shows material or repeated shifts across recent advisory comparisons.",
    });
    watchAreas.push("Repeated drift detected — maintain observation until indicators stabilize.");
  }

  if (hasWeakReadiness) {
    drivers.push({
      type: "negative",
      title: "Weak operational readiness",
      explanation: `Readiness level ${readinessLevel.replace(/_/g, " ")} limits confidence in launch posture recommendations.`,
    });
    watchAreas.push("Operational readiness remains below soft-launch thresholds.");
  }

  if (hasWeakIntegrity) {
    drivers.push({
      type: "negative",
      title: "Developing integrity posture",
      explanation: "Integrity and trust assessments remain conservative — operating mode should reflect cautious advisory posture.",
    });
    watchAreas.push("Integrity signals suggest conservative interpretation of launch readiness.");
  }

  if (hasElevatedAlerts) {
    drivers.push({
      type: "negative",
      title: "Elevated classified alerts",
      explanation:
        elevatedAlertCount >= 2
          ? `${elevatedAlertCount} elevated classified alerts warrant elevated monitoring posture.`
          : `Alert priority is ${alertPriority} — operating mode should reflect increased review.`,
    });
    watchAreas.push("Classified alerts remain elevated — defer launch posture expansion.");
  }

  if (isHealthyTreasury && hasStableReadiness && hasHealthyResilience) {
    drivers.push({
      type: "positive",
      title: "Healthy treasury with stable readiness",
      explanation: "Health, readiness, and resilience support measured soft-launch operating posture.",
    });
  }

  if (hasStrongReadiness && hasStrongStability && hasHealthyScalingReadiness && hasLowDrift && hasStrongGovernance) {
    drivers.push({
      type: "positive",
      title: "Strong launch and governance foundation",
      explanation:
        "Readiness, stability, scaling readiness, low drift, and governance collectively support controlled growth advisory posture.",
    });
  }

  if (isHealthyTreasury && hasRepeatedOperationalConcerns) {
    drivers.push({
      type: "context",
      title: "Healthy treasury with operational concerns",
      explanation:
        "Treasury health is adequate, but repeated operational signals suggest elevated monitoring rather than launch expansion.",
    });
    watchAreas.push("Operational concerns persist despite healthy treasury baseline.");
  }

  if (hasSoftLaunchScaleTolerance && hasStableReadiness) {
    drivers.push({
      type: "positive",
      title: "Soft-launch scale tolerance",
      explanation: `Launch capacity is ${launchCapacity.replace(/_/g, " ")} with ${operatingTolerance.replace(/_/g, " ")} operating tolerance.`,
    });
  }

  if (integrityScore >= 80) {
    drivers.push({
      type: "positive",
      title: "Strong integrity signals",
      explanation: `Treasury integrity score ${integrityScore} supports dependable operating mode guidance.`,
    });
  }

  if (governanceScore >= 80) {
    drivers.push({
      type: "positive",
      title: "Structured governance oversight",
      explanation: `Governance score ${governanceScore} (${governanceLevel.replace(/_/g, " ")}) aligns with measured operating posture.`,
    });
  }

  return {
    healthScore,
    readinessScore,
    readinessLevel,
    stabilityScore,
    stabilityLevel,
    integrityScore,
    integrityLevel,
    governanceScore,
    governanceLevel,
    scalingScore,
    scalingLevel,
    launchCapacity,
    operatingTolerance,
    resilienceLevel,
    driftStatus,
    operationalStatus,
    alertPriority,
    elevatedAlertCount,
    isUnstableTreasury,
    hasRepeatedDrift,
    hasWeakReadiness,
    hasWeakIntegrity,
    hasElevatedAlerts,
    isHealthyTreasury,
    hasHealthyResilience,
    hasStableReadiness,
    hasStrongReadiness,
    hasStrongStability,
    hasHealthyScalingReadiness,
    hasStrongGovernance,
    hasLowDrift,
    hasSoftLaunchScaleTolerance,
    hasRepeatedOperationalConcerns,
    operationalConcernCount,
    drivers,
    watchAreas: [...new Set(watchAreas)].slice(0, 8),
  };
}

function deriveTreasuryOperatingMode(signals, isSmallDollar) {
  const {
    isUnstableTreasury,
    hasRepeatedDrift,
    hasWeakReadiness,
    hasWeakIntegrity,
    hasElevatedAlerts,
    isHealthyTreasury,
    hasStableReadiness,
    hasHealthyResilience,
    hasStrongReadiness,
    hasStrongStability,
    hasHealthyScalingReadiness,
    hasStrongGovernance,
    hasLowDrift,
    hasSoftLaunchScaleTolerance,
    hasRepeatedOperationalConcerns,
    healthScore,
    readinessScore,
    governanceScore,
    scalingScore,
  } = signals;

  const needsObservation =
    isUnstableTreasury ||
    hasRepeatedDrift ||
    hasWeakReadiness ||
    hasWeakIntegrity ||
    hasElevatedAlerts;

  if (needsObservation) {
    return "observation_mode";
  }

  const qualifiesControlledGrowth =
    hasStrongReadiness &&
    hasStrongStability &&
    hasHealthyScalingReadiness &&
    hasLowDrift &&
    hasStrongGovernance &&
    governanceScore >= 75 &&
    scalingScore >= 75;

  if (qualifiesControlledGrowth) {
    return "controlled_growth_mode";
  }

  if (isHealthyTreasury && hasRepeatedOperationalConcerns) {
    return "elevated_monitoring_mode";
  }

  const qualifiesSoftLaunch =
    healthScore >= (isSmallDollar ? 65 : 70) &&
    hasStableReadiness &&
    hasHealthyResilience &&
    hasSoftLaunchScaleTolerance &&
    readinessScore >= (isSmallDollar ? 55 : 65);

  if (qualifiesSoftLaunch) {
    return "soft_launch_mode";
  }

  if (isHealthyTreasury && hasStableReadiness) {
    return "soft_launch_mode";
  }

  return "observation_mode";
}

function deriveLaunchReadinessLevel({ treasuryOperatingMode, signals, isSmallDollar }) {
  const { launchCapacity, scalingLevel, readinessLevel, readinessScore, scalingScore, governanceScore } = signals;

  if (treasuryOperatingMode === "controlled_growth_mode") {
    if (
      scalingScore >= 85 &&
      readinessScore >= 80 &&
      governanceScore >= 80 &&
      (scalingLevel === "highly_ready" || launchCapacity === "moderate_scale_ready")
    ) {
      return "controlled_growth_ready";
    }
    return "soft_launch_ready";
  }

  if (treasuryOperatingMode === "soft_launch_mode") {
    if (launchCapacity === "soft_launch_ready" || launchCapacity === "moderate_scale_ready") {
      return "soft_launch_ready";
    }
    if (launchCapacity === "limited_growth" || scalingLevel === "moderate" || scalingLevel === "limited") {
      return "limited_soft_launch";
    }
    if (readinessLevel === "operational" || readinessLevel === "strong" || readinessScore >= 65) {
      return isSmallDollar ? "limited_soft_launch" : "soft_launch_ready";
    }
    return "limited_soft_launch";
  }

  if (treasuryOperatingMode === "elevated_monitoring_mode") {
    if (readinessScore >= 70 && launchCapacity !== "test_only") {
      return "limited_soft_launch";
    }
    return "testing_only";
  }

  return "testing_only";
}

function deriveTreasuryPostureFromMode(treasuryOperatingMode, signals) {
  const { hasRepeatedOperationalConcerns, scalingScore, readinessScore } = signals;

  if (treasuryOperatingMode === "observation_mode") return "cautious";
  if (treasuryOperatingMode === "elevated_monitoring_mode") return "elevated_attention";
  if (treasuryOperatingMode === "controlled_growth_mode") {
    return scalingScore >= 85 && readinessScore >= 80 ? "monitored_growth" : "stable";
  }
  if (treasuryOperatingMode === "soft_launch_mode") {
    if (hasRepeatedOperationalConcerns) return "elevated_attention";
    if (scalingScore >= 70 && readinessScore >= 75) return "monitored_growth";
    return "stable";
  }
  return "cautious";
}

function deriveOperatingConfidenceLevel({
  treasuryOperatingMode,
  signals,
  governanceConfidence,
  integrityConfidence,
  isSmallDollar,
}) {
  const {
    readinessScore,
    stabilityScore,
    integrityScore,
    governanceScore,
    scalingScore,
    hasWeakIntegrity,
    hasWeakReadiness,
    hasRepeatedDrift,
    hasElevatedAlerts,
  } = signals;

  let score =
    readinessScore * 0.22 +
    stabilityScore * 0.2 +
    integrityScore * 0.2 +
    governanceScore * 0.18 +
    scalingScore * 0.12 +
    clamp(Math.round(Number(governanceConfidence) || 0), 0, 100) * 0.08;

  if (hasWeakIntegrity || hasWeakReadiness) score -= isSmallDollar ? 12 : 18;
  if (hasRepeatedDrift) score -= isSmallDollar ? 10 : 15;
  if (hasElevatedAlerts) score -= isSmallDollar ? 8 : 12;

  if (treasuryOperatingMode === "controlled_growth_mode") score += isSmallDollar ? 4 : 8;
  if (treasuryOperatingMode === "observation_mode") score -= isSmallDollar ? 8 : 12;

  score = clamp(Math.round(score), 0, 100);

  if (isSmallDollar) {
    score = Math.min(score, 88);
    if (treasuryOperatingMode !== "observation_mode" && score < 45 && readinessScore >= 55) {
      score = Math.max(score, 45);
    }
  }

  let level = "low";
  if (score >= 82) level = "high";
  else if (score >= 68) level = "strong";
  else if (score >= 48) level = "moderate";

  if (treasuryOperatingMode === "observation_mode" && level !== "low") {
    level = score >= 55 ? "moderate" : "low";
  }

  return { level, score: clamp(Math.round(score), 0, 100), integrityConfidence };
}

function deriveRecommendedMonitoringLevel({
  treasuryOperatingMode,
  treasuryGovernance,
  signals,
  operatingConfidenceLevel,
}) {
  const governanceCadence = treasuryGovernance?.monitoringCadence || "increased";
  const oversightPosture = treasuryGovernance?.oversightPosture || "increased_review";
  const { operationalConcernCount, hasElevatedAlerts } = signals;

  if (treasuryOperatingMode === "observation_mode") return "active";
  if (treasuryOperatingMode === "elevated_monitoring_mode") {
    return operationalConcernCount >= 3 || hasElevatedAlerts ? "active" : "elevated";
  }
  if (treasuryOperatingMode === "controlled_growth_mode") {
    if (operatingConfidenceLevel === "high" && governanceCadence === "routine") return "routine";
    if (operatingConfidenceLevel === "strong") return "increased";
    return "elevated";
  }
  if (treasuryOperatingMode === "soft_launch_mode") {
    if (oversightPosture === "routine_monitoring" && operatingConfidenceLevel === "strong") {
      return "routine";
    }
    if (operatingConfidenceLevel === "moderate") return "increased";
    return governanceCadence === "active" ? "active" : "increased";
  }

  const cadenceMap = {
    routine: "routine",
    increased: "increased",
    elevated: "elevated",
    active: "active",
  };
  return cadenceMap[governanceCadence] || "increased";
}

function computeOperatingModeConfidence({
  treasuryHealth,
  readiness,
  stability,
  treasuryIntegrity,
  treasuryGovernance,
  scalingReadiness,
  driftDetection,
  monitoringDashboard,
  historicalAnalytics,
  classifiedAlerts,
  operationalGuidance,
  resilience,
}) {
  let score = clamp(Math.round(Number(treasuryGovernance?.confidence) || 0), 0, 100);
  if (readiness?.confidence != null) {
    score = Math.round(score * 0.55 + clamp(Math.round(Number(readiness.confidence) || 0), 0, 100) * 0.2);
  }
  if (stability?.confidence != null) {
    score = Math.round(score * 0.65 + clamp(Math.round(Number(stability.confidence) || 0), 0, 100) * 0.15);
  }
  if (treasuryIntegrity?.confidence != null) {
    score = Math.round(score * 0.72 + clamp(Math.round(Number(treasuryIntegrity.confidence) || 0), 0, 100) * 0.12);
  }
  if (scalingReadiness?.scalingConfidence != null) {
    score = Math.round(score * 0.78 + clamp(Math.round(Number(scalingReadiness.scalingConfidence) || 0), 0, 100) * 0.1);
  }
  if (treasuryHealth?.confidenceScore != null) {
    score = Math.round(score * 0.82 + clamp(Math.round(Number(treasuryHealth.confidenceScore) || 0), 0, 100) * 0.08);
  }
  if (monitoringDashboard?.confidence != null) {
    score = Math.round(score * 0.86 + clamp(Math.round(Number(monitoringDashboard.confidence) || 0), 0, 100) * 0.06);
  }
  if (historicalAnalytics?.confidence != null) {
    score = Math.round(score * 0.9 + clamp(Math.round(Number(historicalAnalytics.confidence) || 0), 0, 100) * 0.05);
  }
  if (driftDetection?.confidence != null) {
    score = Math.round(score * 0.93 + clamp(Math.round(Number(driftDetection.confidence) || 0), 0, 100) * 0.04);
  }
  if (classifiedAlerts?.confidence != null) {
    score = Math.round(score * 0.95 + clamp(Math.round(Number(classifiedAlerts.confidence) || 0), 0, 100) * 0.03);
  }
  if (operationalGuidance?.confidence != null) {
    score = Math.round(score * 0.97 + clamp(Math.round(Number(operationalGuidance.confidence) || 0), 0, 100) * 0.02);
  }
  if (resilience?.confidence != null) {
    score = Math.round(score * 0.98 + clamp(Math.round(Number(resilience.confidence) || 0), 0, 100) * 0.01);
  }
  return clamp(Math.round(score), 0, 100);
}

function buildTreasuryOperatingModeSummary({
  treasuryOperatingMode,
  launchReadinessLevel,
  treasuryPosture,
  operatingConfidence,
  recommendedMonitoringLevel,
  confidence,
  isSmallDollar,
}) {
  const modePhrase = {
    observation_mode: "observation",
    soft_launch_mode: "soft launch",
    controlled_growth_mode: "controlled growth",
    elevated_monitoring_mode: "elevated monitoring",
  }[treasuryOperatingMode] || "advisory review";

  const launchPhrase = {
    testing_only: "testing only",
    limited_soft_launch: "limited soft launch",
    soft_launch_ready: "soft launch ready",
    controlled_growth_ready: "controlled growth ready",
  }[launchReadinessLevel] || "under review";

  const posturePhrase = {
    cautious: "cautious",
    stable: "stable",
    monitored_growth: "monitored growth",
    elevated_attention: "elevated attention",
  }[treasuryPosture] || "advisory";

  const monitoringPhrase = {
    routine: "routine",
    increased: "increased",
    elevated: "elevated",
    active: "active",
  }[recommendedMonitoringLevel] || "increased";

  if (isSmallDollar) {
    return `Soft-launch testing environment detected; operating posture remains advisory. Recommended treasury operating mode is ${modePhrase} with ${launchPhrase} launch readiness (${posturePhrase} posture, ${operatingConfidence} operating confidence, ${monitoringPhrase} monitoring). Signal confidence ${confidence}%.`;
  }

  return `Treasury operating mode assessment recommends ${modePhrase} with ${launchPhrase} launch readiness. Advisory posture: ${posturePhrase} treasury posture, ${operatingConfidence} operating confidence, and ${monitoringPhrase} monitoring level (confidence ${confidence}%) — read-only guidance, no automated treasury actions.`;
}

function buildTreasuryOperatingModeRecommendations({
  treasuryOperatingMode,
  launchReadinessLevel,
  treasuryPosture,
  recommendedMonitoringLevel,
  operationalGuidance,
  watchAreas,
  isSmallDollar,
}) {
  const recs = [];

  if (isSmallDollar) {
    recs.push(
      "Interpret operating mode guidance conservatively — small-dollar volumes limit materiality of launch posture recommendations.",
    );
  }

  if (treasuryOperatingMode === "observation_mode") {
    recs.push(
      "Maintain observation mode — review posture drivers and stabilize treasury indicators before considering soft-launch expansion.",
    );
  } else if (treasuryOperatingMode === "elevated_monitoring_mode") {
    recs.push(
      "Treasury health is adequate but operational concerns persist — maintain elevated monitoring before adjusting launch scope.",
    );
  } else if (treasuryOperatingMode === "soft_launch_mode") {
    recs.push(
      "Soft-launch operating mode is appropriate — continue structured monitoring and review watch areas before expanding activity.",
    );
  } else if (treasuryOperatingMode === "controlled_growth_mode") {
    recs.push(
      "Controlled growth operating mode is supported by current signals — maintain governance oversight and snapshot discipline during expansion planning.",
    );
  }

  if (launchReadinessLevel === "testing_only") {
    recs.push("Launch readiness remains at testing only — defer soft-launch scope expansion until readiness indicators improve.");
  } else if (launchReadinessLevel === "limited_soft_launch") {
    recs.push("Limited soft launch readiness — proceed with measured scope and maintain increased monitoring cadence.");
  } else if (launchReadinessLevel === "soft_launch_ready") {
    recs.push("Soft launch readiness indicators are favorable — continue advisory review cycles before any operational changes.");
  } else if (launchReadinessLevel === "controlled_growth_ready") {
    recs.push("Controlled growth readiness is supported — document advisory posture for leadership review; no automated treasury actions.");
  }

  if (treasuryPosture === "elevated_attention") {
    recs.push("Treasury posture is elevated attention — prioritize operational guidance watch items in review sessions.");
  }

  if (recommendedMonitoringLevel === "active" || recommendedMonitoringLevel === "elevated") {
    recs.push(
      `Recommended monitoring level is ${recommendedMonitoringLevel.replace(/_/g, " ")} — increase review frequency for classified alerts and drift indicators.`,
    );
  } else if (recommendedMonitoringLevel === "routine") {
    recs.push("Routine monitoring level is appropriate based on current operating mode signals.");
  }

  for (const area of (watchAreas || []).slice(0, 2)) {
    if (area && typeof area === "string") recs.push(`Watch: ${area}`);
  }

  const guidanceChecks = (operationalGuidance?.recommendedChecks || []).slice(0, 2);
  for (const check of guidanceChecks) {
    if (check && typeof check === "string") recs.push(check);
    else if (check?.title) recs.push(check.title);
  }

  recs.push("All operating mode guidance is advisory only — no financial mutations, payouts, or automated treasury actions.");

  return [...new Set(recs)].slice(0, 8);
}

/**
 * Treasury operating mode — advisory layer (read-only).
 * Answers "What operating mode should treasury be in?" without automation or financial mutations.
 * @param {{
 *   treasuryHealth?: object,
 *   health?: object,
 *   trends?: object,
 *   forecast?: object,
 *   resilience?: object,
 *   readiness?: object,
 *   driftDetection?: object,
 *   stability?: object,
 *   scalingReadiness?: object,
 *   treasuryIntegrity?: object,
 *   treasuryGovernance?: object,
 *   operationalGuidance?: object,
 *   monitoringDashboard?: object,
 *   classifiedAlerts?: object,
 *   historicalAnalytics?: object,
 * }} [input]
 */
export function calculateTreasuryOperatingMode({
  treasuryHealth,
  health: healthAlias,
  trends = {},
  forecast = {},
  resilience = {},
  readiness = {},
  driftDetection = {},
  stability = {},
  scalingReadiness = {},
  treasuryIntegrity,
  treasuryGovernance,
  operationalGuidance = {},
  monitoringDashboard = {},
  classifiedAlerts = {},
  historicalAnalytics = {},
} = {}) {
  try {
    const health = treasuryHealth || healthAlias;
    if (!health?.healthScore && health?.healthScore !== 0) {
      return { ...EMPTY_TREASURY_OPERATING_MODE };
    }
    if (!readiness?.readinessScore && readiness?.readinessScore !== 0) {
      return { ...EMPTY_TREASURY_OPERATING_MODE };
    }
    if (!stability?.stabilityScore && stability?.stabilityScore !== 0) {
      return { ...EMPTY_TREASURY_OPERATING_MODE };
    }

    const governance =
      treasuryGovernance &&
      (treasuryGovernance.governanceScore != null || treasuryGovernance.governanceScore === 0)
        ? treasuryGovernance
        : calculateTreasuryGovernance({
            treasuryHealth: health,
            trends,
            forecast,
            resilience,
            readiness,
            driftDetection,
            stability,
            scalingReadiness,
            treasuryIntegrity,
            operationalGuidance,
            monitoringDashboard,
            classifiedAlerts,
            historicalAnalytics,
          });

    if (!governance?.governanceScore && governance?.governanceScore !== 0) {
      return { ...EMPTY_TREASURY_OPERATING_MODE };
    }

    const integrity =
      treasuryIntegrity &&
      (treasuryIntegrity.treasuryIntegrityScore != null || treasuryIntegrity.treasuryIntegrityScore === 0)
        ? treasuryIntegrity
        : calculateTreasuryIntegrity({
            treasuryHealth: health,
            trends,
            forecast,
            resilience,
            readiness,
            driftDetection,
            stability,
            scalingReadiness,
            historicalAnalytics,
            monitoringDashboard,
            classifiedAlerts,
            operationalGuidance,
          });

    if (!integrity?.treasuryIntegrityScore && integrity?.treasuryIntegrityScore !== 0) {
      return { ...EMPTY_TREASURY_OPERATING_MODE };
    }

    const metrics = health?.sourceSnapshot?.metrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    const signals = collectTreasuryOperatingModeSignals({
      treasuryHealth: health,
      trends,
      forecast,
      resilience,
      readiness,
      driftDetection,
      stability,
      scalingReadiness,
      treasuryIntegrity: integrity,
      treasuryGovernance: governance,
      historicalAnalytics,
      monitoringDashboard,
      classifiedAlerts,
      operationalGuidance,
      isSmallDollar,
    });

    const treasuryOperatingMode = deriveTreasuryOperatingMode(signals, isSmallDollar);
    const launchReadinessLevel = deriveLaunchReadinessLevel({
      treasuryOperatingMode,
      signals,
      isSmallDollar,
    });
    const treasuryPosture = deriveTreasuryPostureFromMode(treasuryOperatingMode, signals);
    const { level: operatingConfidence } = deriveOperatingConfidenceLevel({
      treasuryOperatingMode,
      signals,
      governanceConfidence: governance.confidence,
      integrityConfidence: integrity.confidence,
      isSmallDollar,
    });
    const recommendedMonitoringLevel = deriveRecommendedMonitoringLevel({
      treasuryOperatingMode,
      treasuryGovernance: governance,
      signals,
      operatingConfidenceLevel: operatingConfidence,
    });
    const confidence = computeOperatingModeConfidence({
      treasuryHealth: health,
      readiness,
      stability,
      treasuryIntegrity: integrity,
      treasuryGovernance: governance,
      scalingReadiness,
      driftDetection,
      monitoringDashboard,
      historicalAnalytics,
      classifiedAlerts,
      operationalGuidance,
      resilience,
    });
    const summary = buildTreasuryOperatingModeSummary({
      treasuryOperatingMode,
      launchReadinessLevel,
      treasuryPosture,
      operatingConfidence,
      recommendedMonitoringLevel,
      confidence,
      isSmallDollar,
    });
    const recommendations = buildTreasuryOperatingModeRecommendations({
      treasuryOperatingMode,
      launchReadinessLevel,
      treasuryPosture,
      recommendedMonitoringLevel,
      operationalGuidance,
      watchAreas: signals.watchAreas,
      isSmallDollar,
    });

    return {
      treasuryOperatingMode,
      launchReadinessLevel,
      treasuryPosture,
      operatingConfidence,
      recommendedMonitoringLevel,
      confidence,
      summary,
      postureDrivers: signals.drivers.slice(0, 10),
      watchAreas: signals.watchAreas,
      recommendations,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryOperatingMode", err: err?.message || err });
    return { ...EMPTY_TREASURY_OPERATING_MODE };
  }
}

const EMPTY_UNIFIED_TREASURY_SCORE = Object.freeze({
  unifiedTreasuryScore: 0,
  treasuryGrade: "D",
  treasuryStory: "Treasury assessment pending",
  treasuryConfidence: "low",
  treasuryCondition: "watch",
  operatingRecommendation: "continue_monitoring",
  confidence: 0,
  strengths: [],
  concernAreas: [],
  recommendations: [],
  boardSummary:
    "Unified treasury assessment unavailable — baseline treasury intelligence signals are required before an executive treasury score can be derived.",
});

function unifiedScoreToGrade(score) {
  const s = clamp(Math.round(Number(score) || 0), 0, 100);
  if (s >= 95) return "A+";
  if (s >= 85) return "A";
  if (s >= 70) return "B";
  if (s >= 50) return "C";
  return "D";
}

function unifiedConfidenceBand(confidence, isSmallDollar) {
  const c = clamp(Math.round(Number(confidence) || 0), 0, 100);
  let band;
  if (c >= 85) band = "high";
  else if (c >= 68) band = "strong";
  else if (c >= 45) band = "moderate";
  else band = "low";
  // Materiality guard: soften certainty in a small-dollar testing environment.
  if (isSmallDollar && band === "high") band = "strong";
  return band;
}

function isLevelIn(value, accepted) {
  return accepted.includes(String(value || "").toLowerCase());
}

/**
 * Synthesize all prior treasury intelligence outputs into a single executive
 * treasury score and board-level summary. Read-only and advisory only — performs
 * no mutations, no persistence, and no automated treasury actions.
 *
 * Accepts a single options object consistent with the other treasury intelligence
 * functions; every input is optional and defaults safely.
 */
export function calculateUnifiedTreasuryScore({
  treasuryHealth,
  health: healthAlias,
  trends = {},
  forecast = {},
  resilience = {},
  readiness = {},
  driftDetection = {},
  stability = {},
  scalingReadiness = {},
  treasuryIntegrity = {},
  treasuryGovernance = {},
  treasuryOperatingMode = {},
  operationalGuidance = {},
  monitoringDashboard = {},
  classifiedAlerts = {},
  historicalAnalytics = {},
} = {}) {
  try {
    const health = treasuryHealth || healthAlias || {};
    if (!health?.healthScore && health?.healthScore !== 0) {
      return { ...EMPTY_UNIFIED_TREASURY_SCORE };
    }

    const metrics = health?.sourceSnapshot?.metrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    // --- Categorical signal reads (defensive defaults) ---
    const healthScore = clamp(Math.round(Number(health.healthScore) || 0), 0, 100);
    const riskLevel = String(health.treasuryRiskLevel || "low").toLowerCase();
    const forecastOutlook = String(forecast.outlook || "stable").toLowerCase();
    const resilienceLevel = String(resilience.resilienceLevel || "").toLowerCase();
    const resilienceScore = toFiniteNumber(resilience.resilienceScore);
    const readinessLevel = String(readiness.readinessLevel || "").toLowerCase();
    const driftStatus = String(driftDetection.driftStatus || "unchanged").toLowerCase();
    const stabilityLevel = String(stability.stabilityLevel || "").toLowerCase();
    const integrityLevel = String(treasuryIntegrity.treasuryIntegrityLevel || "").toLowerCase();
    const signalTrustLevel = String(treasuryIntegrity.signalTrustLevel || "").toLowerCase();
    const governanceLevel = String(treasuryGovernance.governanceLevel || "").toLowerCase();
    const scalingLevel = String(scalingReadiness.scalingReadinessLevel || "").toLowerCase();
    const operatingModePosture = String(treasuryOperatingMode.treasuryPosture || "").toLowerCase();
    const operationalStatus = String(operationalGuidance.operationalStatus || "monitor").toLowerCase();
    const alertPriority = String(classifiedAlerts.alertPriority || "low").toLowerCase();
    const treasuryMomentum = String(monitoringDashboard.treasuryMomentum || "stable").toLowerCase();

    // --- Base score: weighted blend of available component scores ---
    const components = [
      { value: health.healthScore, weight: 0.22 },
      { value: treasuryGovernance.governanceScore, weight: 0.17 },
      { value: readiness.readinessScore, weight: 0.15 },
      { value: resilience.resilienceScore, weight: 0.13 },
      { value: stability.stabilityScore, weight: 0.13 },
      { value: treasuryIntegrity.treasuryIntegrityScore, weight: 0.12 },
      { value: scalingReadiness.scalingReadinessScore, weight: 0.08 },
    ];
    let weightSum = 0;
    let weighted = 0;
    for (const c of components) {
      const v = Number(c.value);
      if (Number.isFinite(v)) {
        weighted += clamp(Math.round(v), 0, 100) * c.weight;
        weightSum += c.weight;
      }
    }
    let score = weightSum > 0 ? weighted / weightSum : healthScore;

    // --- Positive contributors ---
    const strengths = [];
    if (healthScore >= 80) {
      score += 3;
      strengths.push("Treasury health remained strong across the most recent scoring window.");
    }
    if (isLevelIn(resilienceLevel, ["resilient", "strong"]) || resilienceScore >= 80) {
      score += 2;
      strengths.push("Resilience analysis indicates treasury can absorb routine operating stress.");
    }
    if (isLevelIn(readinessLevel, ["strong", "resilient", "operational"])) {
      score += 2;
      strengths.push("Operational readiness signals support continued treasury operations.");
    }
    if (isLevelIn(driftStatus, ["unchanged"])) {
      score += 3;
      strengths.push("Treasury signals remained stable and operationally consistent across recent monitoring periods.");
    } else if (isLevelIn(driftStatus, ["minor_shift"])) {
      score += 1;
    }
    if (isLevelIn(stabilityLevel, ["highly_stable", "stable"])) {
      score += 2;
      strengths.push("Treasury behavior has been stable with low period-over-period variance.");
    }
    if (isLevelIn(governanceLevel, ["institutional", "strong"])) {
      score += 2;
      strengths.push("Governance and oversight posture is well established and proactive.");
    }
    if (isLevelIn(integrityLevel, ["highly_trusted", "strong"]) || isLevelIn(signalTrustLevel, ["high", "strong"])) {
      score += 2;
      strengths.push("Underlying treasury signals are reliable and internally consistent.");
    }
    if (isLevelIn(alertPriority, ["low"])) {
      score += 2;
      strengths.push("Alert activity remained low with no elevated treasury escalations.");
    }
    if (isLevelIn(treasuryMomentum, ["stable", "improving", "strengthening"])) {
      score += 2;
      strengths.push("Monitoring dashboard momentum is steady with no destabilizing movement.");
    }
    if (isLevelIn(operationalStatus, ["healthy"]) || isLevelIn(operatingModePosture, ["stable", "confident", "steady"])) {
      score += 2;
      strengths.push("Operating posture is healthy and aligned with routine monitoring assumptions.");
    }
    if (isLevelIn(forecastOutlook, ["stable", "improving"])) {
      score += 2;
    }

    // --- Negative contributors ---
    const concernAreas = [];
    if (isLevelIn(driftStatus, ["meaningful_shift"])) {
      score -= 8;
      concernAreas.push("Repeated treasury drift detected — recent snapshots show a meaningful shift in posture.");
    } else if (isLevelIn(driftStatus, ["moderate_shift"])) {
      score -= 4;
      concernAreas.push("Moderate treasury drift observed across recent monitoring periods.");
    }
    if (isLevelIn(readinessLevel, ["not_ready"])) {
      score -= 8;
      concernAreas.push("Treasury readiness is unstable and not yet supportive of expanded operations.");
    } else if (isLevelIn(readinessLevel, ["developing"])) {
      score -= 4;
      concernAreas.push("Treasury readiness is still developing and warrants continued observation.");
    }
    if (resilienceScore > 0 && resilienceScore < 50) {
      score -= 5;
      concernAreas.push("Resilience analysis indicates limited buffer against operating stress.");
    }
    if (isLevelIn(alertPriority, ["high"])) {
      score -= 10;
      concernAreas.push("Elevated alert activity is present and requires prompt treasury attention.");
    } else if (isLevelIn(alertPriority, ["elevated"])) {
      score -= 5;
      concernAreas.push("Alert activity is elevated above routine baseline levels.");
    }
    if (isLevelIn(integrityLevel, ["weak"]) || isLevelIn(signalTrustLevel, ["low"])) {
      score -= 5;
      concernAreas.push("Treasury signal trust and integrity are weaker than desired, reducing certainty.");
    }
    if (isLevelIn(operationalStatus, ["high_attention"])) {
      score -= 9;
      concernAreas.push("Operational guidance flags high-attention treasury conditions.");
    } else if (isLevelIn(operationalStatus, ["elevated_attention"])) {
      score -= 4;
      concernAreas.push("Operational guidance flags elevated-attention treasury conditions.");
    }
    if (isLevelIn(stabilityLevel, ["unstable"])) {
      score -= 4;
      concernAreas.push("Treasury stability is inconsistent with elevated period-over-period variance.");
    }
    if (riskLevel === "high" || riskLevel === "critical") {
      score -= 6;
      concernAreas.push("Treasury health risk level is elevated.");
    }

    const unifiedTreasuryScore = clamp(Math.round(score), 0, 100);
    const treasuryGrade = unifiedScoreToGrade(unifiedTreasuryScore);

    // --- Confidence: blend of available component confidences + coverage ---
    const confidenceInputs = [
      health.confidenceScore,
      trends.confidence,
      forecast.confidence,
      resilience.confidence,
      readiness.confidence,
      driftDetection.confidence,
      stability.confidence,
      scalingReadiness.scalingConfidence,
      treasuryIntegrity.confidence,
      treasuryGovernance.confidence,
      treasuryOperatingMode.confidence,
      operationalGuidance.confidence,
      monitoringDashboard.confidence,
      classifiedAlerts.confidence,
      historicalAnalytics.confidence,
    ];
    const presentConfidences = confidenceInputs
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);
    const avgConfidence =
      presentConfidences.length > 0
        ? presentConfidences.reduce((a, b) => a + b, 0) / presentConfidences.length
        : clamp(Math.round(Number(health.confidenceScore) || 40), 0, 100);
    const coverage = confidenceInputs.length > 0 ? presentConfidences.length / confidenceInputs.length : 0;
    let confidence = clamp(Math.round(avgConfidence * (0.6 + 0.4 * coverage)), 0, 100);
    if (isSmallDollar) confidence = Math.min(confidence, 82);
    const treasuryConfidence = unifiedConfidenceBand(confidence, isSmallDollar);

    // --- Treasury condition ---
    const noElevatedSignals = !isLevelIn(alertPriority, ["high", "elevated"]) && !isLevelIn(driftStatus, ["meaningful_shift"]);
    let treasuryCondition;
    if (
      unifiedTreasuryScore >= 88 &&
      isLevelIn(resilienceLevel, ["resilient", "strong"]) &&
      isLevelIn(readinessLevel, ["strong", "resilient"]) &&
      noElevatedSignals
    ) {
      treasuryCondition = "resilient";
    } else if (unifiedTreasuryScore >= 72 && noElevatedSignals) {
      treasuryCondition = "healthy";
    } else if (unifiedTreasuryScore >= 55 && noElevatedSignals) {
      treasuryCondition = "stable";
    } else {
      treasuryCondition = "watch";
    }

    // --- Operating recommendation ---
    let operatingRecommendation;
    if (
      unifiedTreasuryScore < 50 ||
      isLevelIn(alertPriority, ["high"]) ||
      isLevelIn(driftStatus, ["meaningful_shift"]) ||
      isLevelIn(readinessLevel, ["not_ready"]) ||
      isLevelIn(operationalStatus, ["high_attention"])
    ) {
      operatingRecommendation = "elevated_attention";
    } else if (
      unifiedTreasuryScore >= 85 &&
      isLevelIn(scalingLevel, ["strong", "highly_ready"]) &&
      isLevelIn(governanceLevel, ["strong", "institutional"]) &&
      !isSmallDollar
    ) {
      operatingRecommendation = "controlled_growth_ready";
    } else if (unifiedTreasuryScore >= 68) {
      operatingRecommendation = "soft_launch_ready";
    } else {
      operatingRecommendation = "continue_monitoring";
    }

    // --- Treasury story label ---
    let treasuryStory;
    if (operatingRecommendation === "elevated_attention") treasuryStory = "Elevated monitoring treasury";
    else if (operatingRecommendation === "controlled_growth_ready") treasuryStory = "Controlled growth treasury";
    else if (operatingRecommendation === "soft_launch_ready") treasuryStory = "Healthy soft-launch treasury";
    else treasuryStory = "Stable treasury";

    // --- Recommendations ---
    const recommendations = [];
    if (operatingRecommendation === "elevated_attention") {
      recommendations.push("Prioritize review of flagged treasury signals before considering any expansion of activity.");
      recommendations.push("Maintain heightened monitoring cadence until conditions return to a stable baseline.");
    } else if (operatingRecommendation === "controlled_growth_ready") {
      recommendations.push("Treasury conditions support a measured, controlled increase in operating volume under routine monitoring.");
      recommendations.push("Continue tracking resilience and readiness signals as activity scales.");
    } else if (operatingRecommendation === "soft_launch_ready") {
      recommendations.push("Treasury conditions support continued soft-launch operations under routine monitoring assumptions.");
      recommendations.push("Maintain current monitoring cadence and reassess as snapshot history deepens.");
    } else {
      recommendations.push("Continue routine treasury monitoring and refresh snapshots on the normal cadence.");
    }
    if (concernAreas.length > 0) {
      recommendations.push("Review the concern areas above and confirm they remain within advisory tolerances.");
    }
    if (presentConfidences.length < 6) {
      recommendations.push("Build additional snapshot history to strengthen the confidence of future treasury assessments.");
    }

    // --- Board summary ---
    const conditionPhrase = {
      resilient: "resilient",
      healthy: "healthy",
      stable: "stable",
      watch: "under active watch",
    }[treasuryCondition];
    const recommendationPhrase = {
      elevated_attention: "elevated attention is advised before expanding activity",
      controlled_growth_ready: "treasury can support controlled, monitored growth",
      soft_launch_ready: "treasury supports continued soft-launch operations",
      continue_monitoring: "continued routine monitoring is appropriate",
    }[operatingRecommendation];

    let boardSummary =
      `Overall treasury is rated ${unifiedTreasuryScore}/100 (grade ${treasuryGrade}), reflecting a ${conditionPhrase} posture. ` +
      `The current treasury story is "${treasuryStory}", and ${recommendationPhrase}. `;
    if (strengths.length > 0) {
      boardSummary += `Key strengths include ${strengths.length} positive treasury signal${strengths.length === 1 ? "" : "s"}, ` +
        `led by overall health, governance, and stability indicators. `;
    }
    if (concernAreas.length > 0) {
      boardSummary += `There ${concernAreas.length === 1 ? "is" : "are"} ${concernAreas.length} concern area${concernAreas.length === 1 ? "" : "s"} warranting continued attention. `;
    } else {
      boardSummary += "No material concern areas were identified in the current assessment. ";
    }
    boardSummary += `Confidence in this assessment is ${treasuryConfidence} (${confidence}/100). `;
    if (isSmallDollar) {
      boardSummary +=
        "Soft-launch testing environment detected; treasury conclusions remain advisory and certainty is intentionally softened given the small-dollar operating scale.";
    } else {
      boardSummary += "This synthesis is read-only and advisory, intended to support leadership review rather than automated action.";
    }

    return {
      unifiedTreasuryScore,
      treasuryGrade,
      treasuryStory,
      treasuryConfidence,
      treasuryCondition,
      operatingRecommendation,
      confidence,
      strengths,
      concernAreas,
      recommendations,
      boardSummary,
    };
  } catch (err) {
    warn({ op: "calculateUnifiedTreasuryScore", err: err?.message || err });
    return { ...EMPTY_UNIFIED_TREASURY_SCORE };
  }
}

const EMPTY_TREASURY_BOARD_TIMELINE = Object.freeze({
  boardTimeline: [],
  treasuryJourney: "stable",
  treasuryMomentum: "stable",
  executiveMilestones: [],
  notablePeriods: [],
  confidence: 0,
  summary:
    "Treasury board timeline unavailable — insufficient snapshot history to construct an executive treasury narrative.",
});

const BOARD_CONDITION_RANK = Object.freeze({ watch: 0, stable: 1, healthy: 2, resilient: 3 });

function boardConditionRank(condition) {
  return BOARD_CONDITION_RANK[String(condition || "watch").toLowerCase()] ?? 0;
}

function formatBoardTimelineDate(iso) {
  if (!iso) return "an earlier period";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "an earlier period";
  return d.toISOString().slice(0, 10);
}

// Per-period treasury condition derived from snapshot signals, using the same
// banding philosophy as the unified treasury condition (resilient/healthy/stable/watch).
function boardTimelineConditionFromSnapshot(row, isSmallDollar) {
  const score = clamp(Math.round(Number(row?.healthScore) || 0), 0, 100);
  const risk = String(row?.treasuryRiskLevel || healthScoreToRiskLevel(score)).toLowerCase();
  const pressure = deriveSnapshotPressureLevel(row, isSmallDollar);
  const elevatedPressure = pressure === "elevated" || pressure === "severe";
  if (score >= 88 && risk === "low" && !elevatedPressure) return "resilient";
  if (score >= 72 && risk !== "high" && risk !== "critical" && !elevatedPressure) return "healthy";
  if (score >= 55 && risk !== "critical" && pressure !== "severe") return "stable";
  return "watch";
}

// Per-period operating posture using the same vocabulary as readiness operating posture.
function boardTimelinePostureFromSnapshot(row, condition, isSmallDollar) {
  const pressure = deriveSnapshotPressureLevel(row, isSmallDollar);
  if (condition === "watch" || pressure === "severe") {
    return isSmallDollar ? "increased_monitoring" : "active_review";
  }
  if (pressure === "elevated") return "elevated_attention";
  if (condition === "resilient" || condition === "healthy") return "normal_monitoring";
  return "increased_monitoring";
}

// A short, calm, institutional sentence describing the period.
function boardPeriodNarrative({ condition, scoreDelta, isFirst, isSmallDollar }) {
  const softLaunch = isSmallDollar ? " under observed soft-launch conditions" : "";
  if (isFirst) {
    const opener = {
      resilient: "Treasury opened the observed window in a resilient position",
      healthy: "Treasury opened the observed window in a healthy position",
      stable: "Treasury opened the observed window in a stable position",
      watch: "Treasury opened the observed window under active watch",
    }[condition];
    return `${opener}${softLaunch}.`;
  }
  const conditionPhrase = {
    resilient: "a resilient posture",
    healthy: "a healthy posture",
    stable: "a stable posture",
    watch: "an actively watched posture",
  }[condition];
  const moveThreshold = isSmallDollar ? 6 : 4;
  if (scoreDelta >= moveThreshold) {
    return `Treasury consistency improved into ${conditionPhrase}${softLaunch}.`;
  }
  if (scoreDelta <= -moveThreshold) {
    return `Treasury softened into ${conditionPhrase}${softLaunch}; continued monitoring is appropriate.`;
  }
  return `Treasury maintained ${conditionPhrase}${softLaunch} with limited operational drift.`;
}

function deriveTreasuryJourney({ overallDelta, reversals, firstScore, lastScore, historyCount, isSmallDollar }) {
  if (historyCount < 2) return "stable";
  const rise = isSmallDollar ? 8 : 5;
  const drop = isSmallDollar ? 8 : 5;
  const reversalLimit = 2;

  // Choppy / inconsistent series with no clear net direction.
  if (reversals >= reversalLimit && Math.abs(overallDelta) < rise) return "mixed";

  if (overallDelta <= -drop) {
    return reversals >= reversalLimit ? "mixed" : "weakening";
  }

  if (overallDelta >= rise) {
    if (reversals >= reversalLimit) return "mixed";
    // Rising from a lower base toward a consolidating level reads as stabilizing;
    // a higher base or a high finish reads as strengthening.
    if (firstScore < 70 && lastScore < 85) return "stabilizing";
    return "strengthening";
  }

  // Broadly flat.
  return "stable";
}

function deriveBoardTimelineMomentum({ scores, isSmallDollar }) {
  const n = scores.length;
  if (n < 2) return "stable";
  const recent = scores.slice(-3);
  const recentReversals = countDirectionReversals(recent);
  const recentVol = computeSeriesVariance(recent);
  const moveThreshold = isSmallDollar ? 6 : 4;
  const volThreshold = isSmallDollar ? 10 : 7;

  if (recentReversals >= 1 || recentVol > volThreshold) return "variable";

  const netRecent = recent[recent.length - 1] - recent[0];
  if (netRecent >= moveThreshold) return "improving";
  if (netRecent <= -moveThreshold) return "deteriorating";
  return "stable";
}

function longestBoardConditionRun(boardTimeline, acceptedConditions) {
  let longest = 0;
  let run = 0;
  for (const period of boardTimeline) {
    if (acceptedConditions.includes(period.treasuryCondition)) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }
  return longest;
}

function buildBoardExecutiveMilestones({
  boardTimeline,
  unifiedScore,
  executiveSummary,
  governance,
  readiness,
  scalingReadiness,
  treasuryOperatingMode,
  isSmallDollar,
}) {
  const milestones = [];
  const n = boardTimeline.length;
  const first = boardTimeline[0];

  milestones.push(
    `Treasury monitoring window opened on ${formatBoardTimelineDate(first.date)} at a score of ${first.treasuryScore}/100 (${first.treasuryCondition} condition).`,
  );

  const startRank = boardConditionRank(first.treasuryCondition);
  for (let i = 1; i < n; i += 1) {
    const cond = boardTimeline[i].treasuryCondition;
    if (boardConditionRank(cond) > startRank && (cond === "healthy" || cond === "resilient")) {
      milestones.push(`Treasury first reached a ${cond} condition by ${formatBoardTimelineDate(boardTimeline[i].date)}.`);
      break;
    }
  }

  if (n >= TREND_MIN_SNAPSHOTS) {
    const peak = boardTimeline.reduce((a, b) => (b.treasuryScore > a.treasuryScore ? b : a));
    milestones.push(`Highest observed treasury score was ${peak.treasuryScore}/100 on ${formatBoardTimelineDate(peak.date)}.`);
  }

  const governanceLevel = String(governance?.governanceLevel || "").toLowerCase();
  if (["institutional", "strong"].includes(governanceLevel)) {
    milestones.push("Governance posture matured to a well-established oversight standard during the observed window.");
  }

  const readinessLevel = String(readiness?.readinessLevel || "").toLowerCase();
  if (["resilient", "strong"].includes(readinessLevel)) {
    milestones.push("Operational readiness reached a strong, operations-supportive level.");
  }

  const scalingLevel = String(scalingReadiness?.scalingReadinessLevel || "").toLowerCase();
  if (["strong", "highly_ready"].includes(scalingLevel) && !isSmallDollar) {
    milestones.push("Scaling readiness strengthened to support controlled, monitored growth.");
  }

  const operatingPosture = String(treasuryOperatingMode?.treasuryPosture || "").toLowerCase();
  if (["confident", "steady", "stable"].includes(operatingPosture)) {
    milestones.push("Operating posture settled into a steady, routine-monitoring stance.");
  }

  if (unifiedScore?.treasuryStory) {
    milestones.push(`Most recent executive treasury story: "${unifiedScore.treasuryStory}".`);
  } else if (executiveSummary?.headline) {
    milestones.push(`Most recent executive read: "${executiveSummary.headline}".`);
  }

  return [...new Set(milestones)].slice(0, 6);
}

function buildBoardNotablePeriods({ boardTimeline, historicalAnalytics, driftDetection, isSmallDollar }) {
  const periods = [];
  const n = boardTimeline.length;

  if (n < 2) {
    periods.push(
      "Only a single snapshot is available — notable period analysis will deepen as snapshot history accumulates.",
    );
    return periods;
  }

  let maxUp = { delta: 0, at: null };
  let maxDown = { delta: 0, at: null };
  for (let i = 1; i < n; i += 1) {
    const delta = boardTimeline[i].treasuryScore - boardTimeline[i - 1].treasuryScore;
    if (delta > maxUp.delta) maxUp = { delta, at: boardTimeline[i].date };
    if (delta < maxDown.delta) maxDown = { delta, at: boardTimeline[i].date };
  }
  const swingThreshold = isSmallDollar ? 8 : 5;
  if (maxUp.delta >= swingThreshold) {
    periods.push(`Strongest improvement of +${Math.round(maxUp.delta)} points was observed into ${formatBoardTimelineDate(maxUp.at)}.`);
  }
  if (maxDown.delta <= -swingThreshold) {
    periods.push(`Largest single-period decline of ${Math.round(maxDown.delta)} points was observed into ${formatBoardTimelineDate(maxDown.at)}.`);
  }

  const stableRun = longestBoardConditionRun(boardTimeline, ["stable", "healthy", "resilient"]);
  if (stableRun >= TREND_MIN_SNAPSHOTS) {
    periods.push(
      `Treasury held a stable-or-better condition across ${stableRun} consecutive snapshots${isSmallDollar ? " under soft-launch conditions" : ""}.`,
    );
  }

  const driftStatus = String(driftDetection?.driftStatus || "").toLowerCase();
  if (driftStatus === "meaningful_shift" || driftStatus === "moderate_shift") {
    periods.push(`Recent monitoring detected a ${driftStatus.replace(/_/g, " ")} in treasury posture warranting advisory review.`);
  }

  const volatilityIndicators = Array.isArray(historicalAnalytics?.volatilityIndicators)
    ? historicalAnalytics.volatilityIndicators
    : [];
  const fluctuation = volatilityIndicators.find((v) => String(v?.label || "").toLowerCase().includes("fluctuation"));
  if (fluctuation) {
    periods.push("Repeated short-term fluctuations were observed across snapshots rather than a single sustained trend.");
  }

  if (periods.length === 0) {
    periods.push(
      isSmallDollar
        ? "No materially notable periods were observed; treasury remained broadly steady at soft-launch scale."
        : "No materially notable periods were observed; treasury remained broadly steady across the window.",
    );
  }

  return [...new Set(periods)].slice(0, 6);
}

function computeBoardTimelineConfidence({
  historyCount,
  volatility,
  reversals,
  unifiedScore,
  historicalAnalytics,
  stability,
  treasuryIntegrity,
  isSmallDollar,
}) {
  let score = 30;
  if (historyCount >= 7) score += 35;
  else if (historyCount >= 5) score += 28;
  else if (historyCount >= TREND_MIN_SNAPSHOTS) score += 20;
  else if (historyCount === 2) score += 8;

  if (volatility <= (isSmallDollar ? 6 : 4)) score += 12;
  else if (volatility <= (isSmallDollar ? 12 : 8)) score += 6;

  if (reversals === 0) score += 8;
  else if (reversals >= 3) score -= 6;

  const blendInputs = [unifiedScore?.confidence, historicalAnalytics?.confidence, stability?.confidence]
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0);
  if (blendInputs.length > 0) {
    const avg = blendInputs.reduce((a, b) => a + b, 0) / blendInputs.length;
    score = Math.round(score * 0.7 + avg * 0.3);
  }

  // Lower certainty when the underlying treasury signals are themselves less trusted.
  const signalTrustLevel = String(treasuryIntegrity?.signalTrustLevel || "").toLowerCase();
  const integrityLevel = String(treasuryIntegrity?.treasuryIntegrityLevel || "").toLowerCase();
  if (signalTrustLevel === "low" || integrityLevel === "weak") score -= 8;

  if (historyCount < TREND_MIN_SNAPSHOTS) score = Math.min(score, 45);
  if (historyCount < 2) score = Math.min(score, 25);
  if (isSmallDollar) score = Math.min(score, 82);

  return clamp(Math.round(score), 0, 100);
}

function buildBoardTimelineSummary({
  treasuryJourney,
  treasuryMomentum,
  lastScore,
  latestCondition,
  historyCount,
  confidence,
  isSmallDollar,
}) {
  const journeyPhrase = {
    stabilizing: "has been stabilizing",
    stable: "has remained stable",
    strengthening: "has been strengthening",
    mixed: "has shown a mixed trajectory",
    weakening: "has been weakening",
  }[treasuryJourney];
  const momentumPhrase = {
    improving: "recent momentum is improving",
    stable: "recent momentum is steady",
    variable: "recent momentum has been variable",
    deteriorating: "recent momentum is softening",
  }[treasuryMomentum];

  let summary =
    `Across ${historyCount} monitoring snapshot${historyCount === 1 ? "" : "s"}, treasury ${journeyPhrase}, and ${momentumPhrase}. ` +
    `The most recent snapshot reflects a ${latestCondition} condition at ${lastScore}/100. `;

  if (isSmallDollar) {
    summary +=
      "Treasury remained under observed soft-launch conditions, with limited operational drift; conclusions are intentionally softened and advisory. ";
  }
  summary +=
    `Confidence in this timeline narrative is ${confidence}/100, scaling with the depth and consistency of available snapshot history. ` +
    "This view is read-only and advisory, intended to support leadership review rather than automated action.";

  return summary;
}

/**
 * Build a treasury boardroom timeline and decision-memory layer that turns
 * treasury snapshot history into "the story of treasury" for leadership review.
 * Read-only and advisory only — performs no mutations, no persistence, and no
 * automated treasury actions. Accepts a single options object consistent with
 * the other treasury intelligence functions; every input is optional and
 * defaults safely.
 */
export function buildTreasuryBoardTimeline({
  treasury_health_snapshots: snapshotsInput,
  unifiedScore = {},
  executiveSummary = {},
  readiness = {},
  stability = {},
  scalingReadiness = {},
  treasuryGovernance = {},
  treasuryIntegrity = {},
  driftDetection = {},
  treasuryOperatingMode = {},
  historicalAnalytics = {},
} = {}) {
  try {
    const rows = normalizeHistoricalSnapshots(snapshotsInput);
    const historyCount = rows.length;

    if (historyCount === 0) {
      return { ...EMPTY_TREASURY_BOARD_TIMELINE };
    }

    const newest = rows[rows.length - 1];
    const exposure = toFiniteNumber(newest.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(newest.totalWalletLiabilities);
    const isSmallDollar = isSmallDollarScenarioEnvironment(exposure, liabilities);

    const boardTimeline = rows.map((row, idx) => {
      const treasuryScore = clamp(Math.round(Number(row.healthScore) || 0), 0, 100);
      const treasuryCondition = boardTimelineConditionFromSnapshot(row, isSmallDollar);
      const operatingPosture = boardTimelinePostureFromSnapshot(row, treasuryCondition, isSmallDollar);
      const prevScore =
        idx > 0 ? clamp(Math.round(Number(rows[idx - 1].healthScore) || 0), 0, 100) : treasuryScore;
      const narrative = boardPeriodNarrative({
        condition: treasuryCondition,
        scoreDelta: treasuryScore - prevScore,
        isFirst: idx === 0,
        isSmallDollar,
      });
      return {
        date: row.createdAt || null,
        treasuryScore,
        treasuryCondition,
        operatingPosture,
        narrative,
      };
    });

    const scores = boardTimeline.map((p) => p.treasuryScore);
    const firstScore = scores[0];
    const lastScore = scores[scores.length - 1];
    const overallDelta = lastScore - firstScore;
    const volatility = computeSeriesVariance(scores);
    const reversals = countDirectionReversals(scores);

    const treasuryJourney = deriveTreasuryJourney({
      overallDelta,
      reversals,
      firstScore,
      lastScore,
      historyCount,
      isSmallDollar,
    });

    const treasuryMomentum = deriveBoardTimelineMomentum({ scores, isSmallDollar });

    const executiveMilestones = buildBoardExecutiveMilestones({
      boardTimeline,
      unifiedScore,
      executiveSummary,
      governance: treasuryGovernance,
      readiness,
      scalingReadiness,
      treasuryOperatingMode,
      isSmallDollar,
    });

    const notablePeriods = buildBoardNotablePeriods({
      boardTimeline,
      historicalAnalytics,
      driftDetection,
      isSmallDollar,
    });

    const confidence = computeBoardTimelineConfidence({
      historyCount,
      volatility,
      reversals,
      unifiedScore,
      historicalAnalytics,
      stability,
      treasuryIntegrity,
      isSmallDollar,
    });

    const summary = buildBoardTimelineSummary({
      treasuryJourney,
      treasuryMomentum,
      lastScore,
      latestCondition: boardTimeline[boardTimeline.length - 1].treasuryCondition,
      historyCount,
      confidence,
      isSmallDollar,
    });

    return {
      boardTimeline,
      treasuryJourney,
      treasuryMomentum,
      executiveMilestones,
      notablePeriods,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryBoardTimeline", err: err?.message || err });
    return { ...EMPTY_TREASURY_BOARD_TIMELINE };
  }
}

const EMPTY_TREASURY_NARRATIVE = Object.freeze({
  dailyTreasuryStory:
    "Treasury narrative unavailable — baseline treasury intelligence signals are required before a daily treasury story can be composed.",
  treasuryHeadline: "Treasury narrative pending",
  treasuryTone: "stable",
  treasuryOutlook: "stable",
  keyTakeaways: [],
  operationalNarrative: [],
  confidence: 0,
  summary:
    "Treasury daily narrative unavailable — the underlying treasury intelligence signals required to compose a leadership-ready story are not yet present.",
});

// Lowercase, calm phrasing for the unified treasury condition.
const NARRATIVE_CONDITION_PHRASE = Object.freeze({
  resilient: "resilient",
  healthy: "healthy",
  stable: "stable",
  watch: "actively watched",
});

function narrativeConditionPhrase(condition) {
  return NARRATIVE_CONDITION_PHRASE[String(condition || "watch").toLowerCase()] || "actively watched";
}

// A short adjective describing the operating signal climate, derived from tone.
function narrativeToneWord(tone) {
  return (
    {
      calm: "calm",
      stable: "steady",
      cautious: "cautious",
      elevated_attention: "heightened",
    }[String(tone || "stable").toLowerCase()] || "steady"
  );
}

// Tone derives from unified condition + alert level + drift + operating posture.
function deriveNarrativeTone({
  treasuryCondition,
  operatingRecommendation,
  alertPriority,
  driftStatus,
  operationalStatus,
  readinessLevel,
  stabilityLevel,
  integrityLevel,
  signalTrustLevel,
  treasuryMomentum,
}) {
  // Elevated attention dominates when escalation-level signals are present.
  if (
    isLevelIn(alertPriority, ["high", "elevated"]) ||
    isLevelIn(treasuryCondition, ["watch"]) ||
    isLevelIn(operationalStatus, ["high_attention", "elevated_attention"]) ||
    isLevelIn(driftStatus, ["meaningful_shift"]) ||
    isLevelIn(operatingRecommendation, ["elevated_attention"])
  ) {
    return "elevated_attention";
  }
  // Cautious when there is moderate drift or developing/softer readiness or stability.
  if (
    isLevelIn(driftStatus, ["moderate_shift"]) ||
    isLevelIn(readinessLevel, ["developing", "not_ready"]) ||
    isLevelIn(stabilityLevel, ["variable", "unstable"]) ||
    isLevelIn(alertPriority, ["medium"]) ||
    isLevelIn(integrityLevel, ["weak"]) ||
    isLevelIn(signalTrustLevel, ["low"])
  ) {
    return "cautious";
  }
  // Calm reserved for healthy conditions with quiet, consistent signals.
  if (
    isLevelIn(treasuryCondition, ["resilient", "healthy"]) &&
    isLevelIn(alertPriority, ["low"]) &&
    isLevelIn(driftStatus, ["unchanged", "minor_shift"]) &&
    isLevelIn(treasuryMomentum, ["stable", "improving", "strengthening"])
  ) {
    return "calm";
  }
  return "stable";
}

// Outlook derives from board-timeline journey/momentum + historical health trend.
function deriveNarrativeOutlook({ treasuryJourney, boardMomentum, dashboardMomentum, healthDirection }) {
  const weakening =
    isLevelIn(treasuryJourney, ["weakening"]) ||
    isLevelIn(boardMomentum, ["deteriorating"]) ||
    isLevelIn(dashboardMomentum, ["weakening", "deteriorating"]) ||
    isLevelIn(healthDirection, ["deteriorating", "decline", "weakening"]);
  if (weakening) return "cautious";

  const mixed =
    isLevelIn(treasuryJourney, ["mixed"]) ||
    isLevelIn(boardMomentum, ["variable"]) ||
    isLevelIn(dashboardMomentum, ["mixed", "variable"]) ||
    isLevelIn(healthDirection, ["mixed"]);
  if (mixed) return "mixed";

  const improving =
    isLevelIn(treasuryJourney, ["strengthening", "stabilizing"]) ||
    isLevelIn(boardMomentum, ["improving"]) ||
    isLevelIn(dashboardMomentum, ["improving"]) ||
    isLevelIn(healthDirection, ["improving", "growth", "de_escalating", "de-escalating"]);
  if (improving) return "improving";

  return "stable";
}

function buildNarrativeHeadline({ treasuryCondition, operatingRecommendation, alertPriority, isSmallDollar }) {
  const elevated =
    isLevelIn(operatingRecommendation, ["elevated_attention"]) ||
    isLevelIn(treasuryCondition, ["watch"]) ||
    isLevelIn(alertPriority, ["high", "elevated"]);
  if (elevated) return "Treasury under elevated monitoring";
  if (isLevelIn(treasuryCondition, ["resilient"])) {
    return isSmallDollar ? "Resilient soft-launch treasury" : "Resilient treasury operations";
  }
  if (isLevelIn(operatingRecommendation, ["controlled_growth_ready"])) {
    return "Treasury ready for controlled growth";
  }
  if (isSmallDollar) return "Stable soft-launch treasury";
  if (isLevelIn(treasuryCondition, ["healthy"])) return "Treasury operating within expectations";
  return "Treasury operating within expectations";
}

function buildNarrativeKeyTakeaways({
  unifiedTreasuryScore,
  treasuryGrade,
  treasuryCondition,
  strengths,
  concernAreas,
  readinessLevel,
  stabilityLevel,
  alertPriority,
  driftStatus,
  resilienceSupportive,
  isSmallDollar,
}) {
  const takeaways = [];
  takeaways.push(
    `Overall treasury is rated ${unifiedTreasuryScore}/100 (grade ${treasuryGrade}) in a ${narrativeConditionPhrase(
      treasuryCondition,
    )} posture.`,
  );

  if (isLevelIn(alertPriority, ["low"]) && isLevelIn(driftStatus, ["unchanged", "minor_shift"])) {
    takeaways.push("Monitoring signals remained internally consistent with alert activity staying low.");
  }
  if (isLevelIn(readinessLevel, ["strong", "resilient", "operational"])) {
    takeaways.push("Operational readiness continued to support routine treasury operations.");
  }
  if (isLevelIn(stabilityLevel, ["highly_stable", "stable"])) {
    takeaways.push("Treasury behavior stayed stable with low period-over-period variance.");
  } else if (resilienceSupportive) {
    takeaways.push("Treasury resilience remained supportive of routine operating stress.");
  }

  // Lead with the strongest pre-synthesized positive if room remains.
  if (Array.isArray(strengths) && strengths.length > 0) {
    takeaways.push(strengths[0]);
  }

  // Surface concern areas, if any, in a measured voice.
  if (Array.isArray(concernAreas) && concernAreas.length > 0) {
    takeaways.push(concernAreas[0]);
    if (concernAreas.length > 1) takeaways.push(concernAreas[1]);
  } else {
    takeaways.push("No material concern areas were identified in the current assessment.");
  }

  if (isSmallDollar) {
    takeaways.push("Soft-launch testing environment detected; treasury conclusions remain advisory.");
  }

  return [...new Set(takeaways)].slice(0, 6);
}

function buildNarrativeOperational({
  tone,
  driftStatus,
  alertPriority,
  operationalStatus,
  readinessLevel,
  stabilityLevel,
  resilienceSupportive,
  governanceLevel,
  integrityLevel,
  signalTrustLevel,
  isSmallDollar,
}) {
  const lines = [];

  // Monitoring consistency.
  if (isLevelIn(driftStatus, ["unchanged", "minor_shift"])) {
    lines.push("Monitoring signals remained internally consistent across recent snapshots.");
  } else if (isLevelIn(driftStatus, ["moderate_shift"])) {
    lines.push("Monitoring detected some movement in treasury posture that remains within advisory tolerances.");
  } else {
    lines.push("Monitoring detected a meaningful shift in treasury posture warranting closer advisory review.");
  }

  // Payout / withdrawal exposure posture.
  if (isLevelIn(alertPriority, ["low"]) && !isLevelIn(operationalStatus, ["high_attention", "elevated_attention"])) {
    lines.push("Payout and withdrawal exposure stayed within controlled, monitored levels.");
  } else {
    lines.push("Payout and withdrawal exposure is being monitored more closely following recent alert activity.");
  }

  // Resilience and readiness.
  if (resilienceSupportive || isLevelIn(readinessLevel, ["strong", "resilient", "operational"])) {
    lines.push("Treasury resilience and readiness remained supportive of routine operations.");
  } else if (isLevelIn(stabilityLevel, ["variable", "unstable"])) {
    lines.push("Treasury stability is still consolidating, and resilience is being observed as snapshot history deepens.");
  } else {
    lines.push("Treasury resilience held within expected operating ranges.");
  }

  // Governance and signal integrity.
  if (
    isLevelIn(governanceLevel, ["institutional", "strong"]) &&
    !isLevelIn(integrityLevel, ["weak"]) &&
    !isLevelIn(signalTrustLevel, ["low"])
  ) {
    lines.push("Governance oversight and signal integrity remained well established and internally consistent.");
  } else if (isLevelIn(integrityLevel, ["weak"]) || isLevelIn(signalTrustLevel, ["low"])) {
    lines.push("Signal integrity is currently softer, modestly reducing certainty in this narrative.");
  } else {
    lines.push("Governance oversight remained active and aligned with routine monitoring assumptions.");
  }

  if (tone === "elevated_attention") {
    lines.push("Operating posture is under heightened, advisory-only monitoring until conditions return to baseline.");
  }
  if (isSmallDollar) {
    lines.push("These observations reflect a small-dollar soft-launch scale and are intentionally softened.");
  }

  return [...new Set(lines)].slice(0, 6);
}

function buildDailyTreasuryStory({
  tone,
  treasuryCondition,
  operatingRecommendation,
  driftStatus,
  alertPriority,
  resilienceSupportive,
  isSmallDollar,
}) {
  const softLaunch = isSmallDollar ? " under soft-launch conditions" : "";

  let opening;
  if (tone === "elevated_attention") {
    opening = `Today treasury operated under elevated monitoring${softLaunch}, with one or more signals flagged for closer review.`;
  } else if (tone === "cautious") {
    opening = `Today treasury remained broadly stable${softLaunch}, though a few signals warrant continued attention.`;
  } else {
    opening = `Today treasury remained operationally stable${softLaunch}.`;
  }

  const monitoringClause = isLevelIn(driftStatus, ["unchanged", "minor_shift"])
    ? "monitoring signals remained consistent"
    : "monitoring signals showed some movement that stayed within advisory tolerances";
  const exposureClause =
    isLevelIn(alertPriority, ["low"]) && tone !== "elevated_attention"
      ? "payout exposure stayed controlled"
      : "payout exposure is being watched more closely";
  const resilienceClause = resilienceSupportive
    ? "treasury resilience remained healthy"
    : "treasury resilience held within expected ranges";
  const middle = `Through the day, ${monitoringClause}, ${exposureClause}, and ${resilienceClause}.`;

  let closing;
  if (operatingRecommendation === "elevated_attention" || tone === "elevated_attention") {
    closing = "Closer review of the flagged signals is recommended before expanding activity.";
  } else if (operatingRecommendation === "controlled_growth_ready") {
    closing = "Treasury can support measured, monitored growth while routine monitoring continues.";
  } else {
    closing = "Continued routine monitoring is recommended.";
  }

  let story = `${opening} ${middle} ${closing}`;
  if (isSmallDollar) {
    story += " Soft-launch testing environment detected; treasury conclusions remain advisory.";
  }
  return story;
}

function buildNarrativeSummary({
  unifiedTreasuryScore,
  treasuryGrade,
  treasuryCondition,
  treasuryStory,
  tone,
  outlook,
  confidence,
  isSmallDollar,
}) {
  const outlookPhrase = {
    improving: "the near-term outlook reads as improving",
    stable: "the near-term outlook reads as stable",
    mixed: "the near-term outlook reads as mixed",
    cautious: "the near-term outlook reads as cautious",
  }[outlook];

  let summary =
    `From a treasury leadership perspective, the desk is rated ${unifiedTreasuryScore}/100 (grade ${treasuryGrade}) ` +
    `in a ${narrativeConditionPhrase(treasuryCondition)} posture with ${narrativeToneWord(tone)} operating signals. ` +
    `The current treasury story is "${treasuryStory}", and ${outlookPhrase}. ` +
    `Confidence in this narrative is ${confidence}/100, scaling with the depth and consistency of available treasury signals. `;
  if (isSmallDollar) {
    summary +=
      "Soft-launch testing environment detected; treasury conclusions remain advisory and certainty is intentionally softened given the small-dollar operating scale.";
  } else {
    summary +=
      "This narrative is read-only and advisory, intended to support leadership review rather than automated action.";
  }
  return summary;
}

function computeNarrativeConfidence({ inputConfidences, tone, outlook, isSmallDollar }) {
  const present = inputConfidences.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
  const avg = present.length > 0 ? present.reduce((a, b) => a + b, 0) / present.length : 35;
  const coverage = inputConfidences.length > 0 ? present.length / inputConfidences.length : 0;
  let score = avg * (0.6 + 0.4 * coverage);

  // Narrative certainty softens when signals are less settled.
  if (tone === "elevated_attention") score -= 8;
  else if (tone === "cautious") score -= 4;
  if (outlook === "cautious") score -= 4;
  else if (outlook === "mixed") score -= 2;

  if (present.length < 5) score = Math.min(score, 55);
  if (isSmallDollar) score = Math.min(score, 82);

  return clamp(Math.round(score), 0, 100);
}

/**
 * Compose a single, leadership-ready daily treasury story from the full set of
 * prior treasury intelligence outputs — answering "what would treasury
 * leadership say happened today?" Read-only and advisory only — performs no
 * mutations, no persistence, and no automated treasury actions. Accepts a single
 * options object consistent with the other treasury intelligence functions;
 * every input is optional and defaults safely.
 */
export function buildTreasuryNarrative({
  unifiedScore = {},
  boardTimeline = {},
  executiveSummary = {},
  readiness = {},
  stability = {},
  scalingReadiness = {},
  treasuryGovernance = {},
  treasuryIntegrity = {},
  treasuryOperatingMode = {},
  operationalGuidance = {},
  driftDetection = {},
  historicalAnalytics = {},
  monitoringDashboard = {},
  classifiedAlerts = {},
  treasuryHealth,
  health: healthAlias,
} = {}) {
  try {
    const hasUnified =
      Number.isFinite(Number(unifiedScore?.unifiedTreasuryScore)) &&
      (unifiedScore?.treasuryCondition || unifiedScore?.operatingRecommendation);
    if (!hasUnified) {
      return { ...EMPTY_TREASURY_NARRATIVE };
    }

    // --- Small-dollar materiality guard ---
    const health = treasuryHealth || healthAlias || {};
    const metrics = health?.sourceSnapshot?.metrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const hasMetrics = liabilities > 0 || exposure > 0;
    const summaryHints = `${String(unifiedScore?.treasuryStory || "")} ${String(
      boardTimeline?.summary || "",
    )}`.toLowerCase();
    const isSmallDollar = hasMetrics
      ? isSmallDollarScenarioEnvironment(exposure, liabilities)
      : summaryHints.includes("soft-launch") || summaryHints.includes("soft launch");

    // --- Categorical signal reads (defensive defaults) ---
    const unifiedTreasuryScore = clamp(Math.round(Number(unifiedScore.unifiedTreasuryScore) || 0), 0, 100);
    const treasuryGrade = String(unifiedScore.treasuryGrade || unifiedScoreToGrade(unifiedTreasuryScore));
    const treasuryStory = String(unifiedScore.treasuryStory || "Stable treasury");
    const treasuryCondition = String(unifiedScore.treasuryCondition || "watch").toLowerCase();
    const operatingRecommendation = String(unifiedScore.operatingRecommendation || "continue_monitoring").toLowerCase();
    const strengths = Array.isArray(unifiedScore.strengths) ? unifiedScore.strengths : [];
    const concernAreas = Array.isArray(unifiedScore.concernAreas) ? unifiedScore.concernAreas : [];

    const alertPriority = String(classifiedAlerts.alertPriority || "low").toLowerCase();
    const driftStatus = String(driftDetection.driftStatus || "unchanged").toLowerCase();
    const operationalStatus = String(operationalGuidance.operationalStatus || "monitor").toLowerCase();
    const readinessLevel = String(readiness.readinessLevel || "").toLowerCase();
    const stabilityLevel = String(stability.stabilityLevel || "").toLowerCase();
    const governanceLevel = String(treasuryGovernance.governanceLevel || "").toLowerCase();
    const integrityLevel = String(treasuryIntegrity.treasuryIntegrityLevel || "").toLowerCase();
    const signalTrustLevel = String(treasuryIntegrity.signalTrustLevel || "").toLowerCase();
    const scalingLevel = String(scalingReadiness.scalingReadinessLevel || "").toLowerCase();
    const operatingModePosture = String(treasuryOperatingMode.treasuryPosture || "").toLowerCase();

    const treasuryJourney = String(boardTimeline.treasuryJourney || "stable").toLowerCase();
    const boardMomentum = String(boardTimeline.treasuryMomentum || "stable").toLowerCase();
    const dashboardMomentum = String(monitoringDashboard.treasuryMomentum || "stable").toLowerCase();
    const healthDirection = String(historicalAnalytics?.historicalHealthTrend?.direction || "").toLowerCase();

    const resilienceSupportive =
      isLevelIn(readinessLevel, ["strong", "resilient", "operational"]) ||
      isLevelIn(stabilityLevel, ["highly_stable", "stable"]) ||
      isLevelIn(scalingLevel, ["strong", "highly_ready"]) ||
      isLevelIn(operatingModePosture, ["confident", "steady", "stable"]);

    // --- Tone, outlook, headline ---
    const treasuryTone = deriveNarrativeTone({
      treasuryCondition,
      operatingRecommendation,
      alertPriority,
      driftStatus,
      operationalStatus,
      readinessLevel,
      stabilityLevel,
      integrityLevel,
      signalTrustLevel,
      treasuryMomentum: boardMomentum,
    });

    const treasuryOutlook = deriveNarrativeOutlook({
      treasuryJourney,
      boardMomentum,
      dashboardMomentum,
      healthDirection,
    });

    const treasuryHeadline = buildNarrativeHeadline({
      treasuryCondition,
      operatingRecommendation,
      alertPriority,
      isSmallDollar,
    });

    // --- Confidence ---
    const confidence = computeNarrativeConfidence({
      inputConfidences: [
        unifiedScore.confidence,
        boardTimeline.confidence,
        historicalAnalytics.confidence,
        readiness.confidence,
        stability.confidence,
        treasuryIntegrity.confidence,
        treasuryGovernance.confidence,
        treasuryOperatingMode.confidence,
        operationalGuidance.confidence,
        classifiedAlerts.confidence,
        executiveSummary.confidence,
        monitoringDashboard.confidence,
        driftDetection.confidence,
        scalingReadiness.scalingConfidence,
      ],
      tone: treasuryTone,
      outlook: treasuryOutlook,
      isSmallDollar,
    });

    // --- Narrative bodies ---
    const keyTakeaways = buildNarrativeKeyTakeaways({
      unifiedTreasuryScore,
      treasuryGrade,
      treasuryCondition,
      strengths,
      concernAreas,
      readinessLevel,
      stabilityLevel,
      alertPriority,
      driftStatus,
      resilienceSupportive,
      isSmallDollar,
    });

    const operationalNarrative = buildNarrativeOperational({
      tone: treasuryTone,
      driftStatus,
      alertPriority,
      operationalStatus,
      readinessLevel,
      stabilityLevel,
      resilienceSupportive,
      governanceLevel,
      integrityLevel,
      signalTrustLevel,
      isSmallDollar,
    });

    const dailyTreasuryStory = buildDailyTreasuryStory({
      tone: treasuryTone,
      treasuryCondition,
      operatingRecommendation,
      driftStatus,
      alertPriority,
      resilienceSupportive,
      isSmallDollar,
    });

    const summary = buildNarrativeSummary({
      unifiedTreasuryScore,
      treasuryGrade,
      treasuryCondition,
      treasuryStory,
      tone: treasuryTone,
      outlook: treasuryOutlook,
      confidence,
      isSmallDollar,
    });

    return {
      dailyTreasuryStory,
      treasuryHeadline,
      treasuryTone,
      treasuryOutlook,
      keyTakeaways,
      operationalNarrative,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryNarrative", err: err?.message || err });
    return { ...EMPTY_TREASURY_NARRATIVE };
  }
}

const EMPTY_TREASURY_EXECUTIVE_BRIEFING = Object.freeze({
  executiveHeadline: "Treasury executive briefing pending",
  executiveStatus: "stable",
  executivePriority: "maintain_monitoring",
  executiveOutlook: "stable",
  keyLeadershipPoints: [],
  actionFocus: [],
  confidence: 0,
  briefingSummary:
    "Treasury executive briefing unavailable — unified treasury score and narrative signals are required before a leadership digest can be composed.",
});

function deriveBriefingExecutiveHeadline({
  treasuryCondition,
  operatingRecommendation,
  treasuryTone,
  alertPriority,
  isSmallDollar,
}) {
  const elevated =
    isLevelIn(operatingRecommendation, ["elevated_attention"]) ||
    isLevelIn(treasuryCondition, ["watch"]) ||
    isLevelIn(treasuryTone, ["elevated_attention"]) ||
    isLevelIn(alertPriority, ["high", "elevated"]);
  if (elevated) return "Treasury requires elevated monitoring";

  if (isLevelIn(operatingRecommendation, ["controlled_growth_ready"])) {
    return isSmallDollar
      ? "Treasury stable under monitored soft-launch growth"
      : "Treasury stable under monitored growth";
  }

  if (isSmallDollar) {
    if (isLevelIn(treasuryCondition, ["resilient", "healthy"])) {
      return "Treasury operating within soft-launch expectations";
    }
    return "Treasury stable under soft-launch monitoring";
  }

  if (isLevelIn(treasuryCondition, ["resilient"])) {
    return "Treasury operating within institutional expectations";
  }
  if (isLevelIn(treasuryCondition, ["healthy", "stable"])) {
    return "Treasury operating within expectations";
  }
  return "Treasury under routine leadership monitoring";
}

function deriveBriefingExecutiveStatus({
  treasuryCondition,
  alertPriority,
  driftStatus,
  operationalStatus,
  readinessLevel,
  treasuryTone,
  operatingRecommendation,
}) {
  if (
    isLevelIn(operatingRecommendation, ["elevated_attention"]) ||
    isLevelIn(treasuryCondition, ["watch"]) ||
    isLevelIn(alertPriority, ["high"]) ||
    isLevelIn(driftStatus, ["meaningful_shift"]) ||
    isLevelIn(operationalStatus, ["high_attention"])
  ) {
    return "elevated_attention";
  }

  if (
    isLevelIn(treasuryTone, ["cautious", "elevated_attention"]) ||
    isLevelIn(driftStatus, ["moderate_shift"]) ||
    isLevelIn(readinessLevel, ["developing", "not_ready"]) ||
    isLevelIn(alertPriority, ["elevated", "medium"])
  ) {
    return "monitored";
  }

  if (
    isLevelIn(treasuryCondition, ["resilient", "healthy"]) &&
    isLevelIn(alertPriority, ["low"]) &&
    !isLevelIn(driftStatus, ["meaningful_shift", "moderate_shift"])
  ) {
    return "healthy";
  }

  return "stable";
}

function deriveBriefingExecutivePriority({
  executiveStatus,
  operatingRecommendation,
  scalingLevel,
  executiveOutlook,
  driftStatus,
  alertPriority,
  readinessLevel,
}) {
  if (
    executiveStatus === "elevated_attention" ||
    isLevelIn(alertPriority, ["high"]) ||
    isLevelIn(readinessLevel, ["not_ready"])
  ) {
    return "elevated_review";
  }

  if (
    isLevelIn(operatingRecommendation, ["controlled_growth_ready"]) ||
    isLevelIn(scalingLevel, ["strong", "highly_ready"])
  ) {
    return "monitor_growth";
  }

  if (
    executiveOutlook === "cautious" ||
    executiveOutlook === "mixed" ||
    isLevelIn(driftStatus, ["moderate_shift"]) ||
    isLevelIn(alertPriority, ["elevated", "medium"])
  ) {
    return "review_risk_signals";
  }

  return "maintain_monitoring";
}

function deriveBriefingExecutiveOutlook({
  treasuryJourney,
  boardMomentum,
  narrativeOutlook,
  healthDirection,
  dashboardMomentum,
}) {
  const outlook = deriveNarrativeOutlook({
    treasuryJourney,
    boardMomentum,
    dashboardMomentum,
    healthDirection,
  });
  if (outlook !== "stable") return outlook;

  const narrative = String(narrativeOutlook || "stable").toLowerCase();
  if (narrative === "improving" || narrative === "cautious" || narrative === "mixed") {
    return narrative;
  }
  return "stable";
}

function buildBriefingLeadershipPoints({
  unifiedTreasuryScore,
  treasuryGrade,
  treasuryCondition,
  strengths,
  concernAreas,
  alertPriority,
  driftStatus,
  governanceLevel,
  integrityLevel,
  signalTrustLevel,
  operatingModePosture,
  isSmallDollar,
}) {
  const points = [];

  points.push(
    `Unified treasury score is ${unifiedTreasuryScore}/100 (grade ${treasuryGrade}) in a ${narrativeConditionPhrase(
      treasuryCondition,
    )} posture.`,
  );

  if (Array.isArray(strengths) && strengths.length > 0) {
    points.push(strengths[0]);
  } else if (isLevelIn(treasuryCondition, ["resilient", "healthy"])) {
    points.push("Core treasury health and stability indicators remain supportive of routine operations.");
  }

  if (Array.isArray(concernAreas) && concernAreas.length > 0) {
    points.push(concernAreas[0]);
  } else {
    points.push("No material concern areas were identified in the current leadership assessment.");
  }

  if (isLevelIn(alertPriority, ["low"]) && isLevelIn(driftStatus, ["unchanged", "minor_shift"])) {
    points.push("Monitoring posture remains routine with internally consistent alert and drift signals.");
  } else if (isLevelIn(alertPriority, ["high", "elevated"])) {
    points.push("Alert activity is above routine baseline and warrants leadership awareness in the next review cycle.");
  } else {
    points.push("Monitoring posture remains active with treasury signals tracked on the standard advisory cadence.");
  }

  if (
    isLevelIn(governanceLevel, ["institutional", "strong"]) &&
    !isLevelIn(integrityLevel, ["weak"]) &&
    !isLevelIn(signalTrustLevel, ["low"])
  ) {
    points.push("Governance oversight and signal integrity remain well established for leadership review.");
  } else if (isLevelIn(integrityLevel, ["weak"]) || isLevelIn(signalTrustLevel, ["low"])) {
    points.push("Signal integrity is currently softer, modestly reducing certainty in this briefing.");
  } else if (isLevelIn(operatingModePosture, ["confident", "steady", "stable"])) {
    points.push("Operating mode posture remains aligned with routine treasury oversight assumptions.");
  }

  if (isSmallDollar) {
    points.push("Soft-launch testing environment detected; treasury conclusions remain advisory.");
  }

  return [...new Set(points)].slice(0, 6);
}

function buildBriefingActionFocus({
  executivePriority,
  executiveStatus,
  operatingRecommendation,
  driftStatus,
  alertPriority,
  readinessLevel,
  operationalStatus,
  isSmallDollar,
}) {
  const items = [];

  if (executivePriority === "elevated_review" || executiveStatus === "elevated_attention") {
    items.push("Review flagged treasury signals in the next leadership treasury review cycle.");
    items.push("Maintain heightened monitoring cadence until conditions return to a stable baseline.");
  } else if (executivePriority === "monitor_growth") {
    items.push("Continue tracking readiness and scaling signals as operating volume grows under routine monitoring.");
    items.push("Confirm treasury governance and integrity indicators remain aligned before any volume expansion.");
  } else if (executivePriority === "review_risk_signals") {
    items.push("Review drift and alert signals in the next treasury review cycle.");
    items.push("Confirm mixed or cautious outlook drivers remain within advisory tolerances.");
  } else {
    items.push("Routine reconciliation monitoring remains recommended.");
    items.push("Maintain soft-launch monitoring cadence and refresh snapshots on the normal cycle.");
  }

  if (isLevelIn(driftStatus, ["moderate_shift", "meaningful_shift"])) {
    items.push("Review drift signals in the next treasury review cycle and confirm they remain advisory-only.");
  }
  if (isLevelIn(alertPriority, ["elevated", "high"])) {
    items.push("Review classified alert routing suggestions during the next leadership check-in.");
  }
  if (isLevelIn(readinessLevel, ["developing", "not_ready"])) {
    items.push("Observe readiness progression before considering any expansion of treasury operating scope.");
  }
  if (isLevelIn(operationalStatus, ["elevated_attention", "high_attention"])) {
    items.push("Align operational guidance watch areas with the next scheduled treasury leadership review.");
  }
  if (isLevelIn(operatingRecommendation, ["soft_launch_ready", "continue_monitoring"]) && items.length < 4) {
    items.push("Payout and withdrawal exposure monitoring remains recommended on the standard cadence.");
  }
  if (isSmallDollar) {
    items.push("Treat all treasury conclusions as advisory given the small-dollar soft-launch operating scale.");
  }

  return [...new Set(items)].slice(0, 6);
}

function buildBriefingSummaryParagraph({
  executiveStatus,
  executiveOutlook,
  treasuryCondition,
  driftStatus,
  alertPriority,
  resilienceSupportive,
  isSmallDollar,
}) {
  const statusPhrase = {
    healthy: "remained operationally healthy",
    stable: "remained operationally stable",
    monitored: "remained broadly stable under active monitoring",
    elevated_attention: "operated under elevated monitoring",
  }[executiveStatus];

  const outlookPhrase = {
    improving: "Near-term outlook reads as improving based on snapshot history and momentum.",
    stable: "Near-term outlook reads as stable across monitoring and historical signals.",
    mixed: "Near-term outlook reads as mixed, with some signals moving in different directions.",
    cautious: "Near-term outlook reads as cautious until additional snapshot history accumulates.",
  }[executiveOutlook];

  const monitoringClause = isLevelIn(driftStatus, ["unchanged", "minor_shift"])
    ? "Monitoring signals remained internally consistent"
    : "Monitoring signals showed some movement that remains within advisory tolerances";
  const driftClause = isLevelIn(driftStatus, ["unchanged", "minor_shift"])
    ? "treasury drift stayed limited"
    : "treasury drift warrants continued observation in the next review cycle";
  const alertClause =
    isLevelIn(alertPriority, ["low"]) && executiveStatus !== "elevated_attention"
      ? "alert activity stayed within routine levels"
      : "alert activity is being tracked more closely";
  const resilienceClause = resilienceSupportive
    ? "resilience remained healthy"
    : "resilience held within expected operating ranges";

  let summary =
    `Treasury ${statusPhrase} under current monitoring assumptions. ${monitoringClause}, ${driftClause}, and ${alertClause}, while ${resilienceClause}. ` +
    `${outlookPhrase} Routine reconciliation and payout monitoring remain recommended.`;

  if (isSmallDollar) {
    summary +=
      " Soft-launch testing environment detected; treasury conclusions remain advisory and certainty is intentionally softened given the small-dollar operating scale.";
  }

  if (isLevelIn(treasuryCondition, ["watch"]) && executiveStatus !== "elevated_attention") {
    summary += " Treasury condition is under watch — leadership review on the next cycle is appropriate.";
  }

  return summary;
}

function computeBriefingConfidence({
  inputConfidences,
  executiveStatus,
  executiveOutlook,
  isSmallDollar,
}) {
  const present = inputConfidences.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
  const avg = present.length > 0 ? present.reduce((a, b) => a + b, 0) / present.length : 35;
  const coverage = inputConfidences.length > 0 ? present.length / inputConfidences.length : 0;
  let score = avg * (0.6 + 0.4 * coverage);

  if (executiveStatus === "elevated_attention") score -= 8;
  else if (executiveStatus === "monitored") score -= 4;
  if (executiveOutlook === "cautious") score -= 4;
  else if (executiveOutlook === "mixed") score -= 2;

  if (present.length < 6) score = Math.min(score, 58);
  if (isSmallDollar) score = Math.min(score, 82);

  return clamp(Math.round(score), 0, 100);
}

/**
 * Compress all treasury intelligence into a concise executive digest for
 * leadership — answering what treasury leadership should know in sixty seconds.
 * Read-only and advisory only — performs no mutations, no persistence, and no
 * automated treasury actions. Accepts a single options object consistent with
 * the other treasury intelligence functions; every input is optional and defaults
 * safely.
 */
export function buildTreasuryExecutiveBriefing({
  unifiedScore = {},
  treasuryNarrative = {},
  boardTimeline = {},
  executiveSummary = {},
  readiness = {},
  stability = {},
  scalingReadiness = {},
  treasuryGovernance = {},
  treasuryIntegrity = {},
  treasuryOperatingMode = {},
  operationalGuidance = {},
  driftDetection = {},
  historicalAnalytics = {},
  monitoringDashboard = {},
  classifiedAlerts = {},
  treasuryHealth,
  health: healthAlias,
} = {}) {
  try {
    const hasUnified =
      Number.isFinite(Number(unifiedScore?.unifiedTreasuryScore)) &&
      (unifiedScore?.treasuryCondition || unifiedScore?.operatingRecommendation);
    if (!hasUnified) {
      return { ...EMPTY_TREASURY_EXECUTIVE_BRIEFING };
    }

    const health = treasuryHealth || healthAlias || {};
    const metrics = health?.sourceSnapshot?.metrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const hasMetrics = liabilities > 0 || exposure > 0;
    const summaryHints = `${String(unifiedScore?.treasuryStory || "")} ${String(
      treasuryNarrative?.briefingSummary || treasuryNarrative?.summary || "",
    )} ${String(boardTimeline?.summary || "")}`.toLowerCase();
    const isSmallDollar = hasMetrics
      ? isSmallDollarScenarioEnvironment(exposure, liabilities)
      : summaryHints.includes("soft-launch") || summaryHints.includes("soft launch");

    const unifiedTreasuryScore = clamp(Math.round(Number(unifiedScore.unifiedTreasuryScore) || 0), 0, 100);
    const treasuryGrade = String(unifiedScore.treasuryGrade || unifiedScoreToGrade(unifiedTreasuryScore));
    const treasuryCondition = String(unifiedScore.treasuryCondition || "watch").toLowerCase();
    const operatingRecommendation = String(unifiedScore.operatingRecommendation || "continue_monitoring").toLowerCase();
    const strengths = Array.isArray(unifiedScore.strengths) ? unifiedScore.strengths : [];
    const concernAreas = Array.isArray(unifiedScore.concernAreas) ? unifiedScore.concernAreas : [];

    const treasuryTone = String(treasuryNarrative.treasuryTone || "stable").toLowerCase();
    const narrativeOutlook = String(treasuryNarrative.treasuryOutlook || "stable").toLowerCase();
    const alertPriority = String(classifiedAlerts.alertPriority || "low").toLowerCase();
    const driftStatus = String(driftDetection.driftStatus || "unchanged").toLowerCase();
    const operationalStatus = String(operationalGuidance.operationalStatus || "monitor").toLowerCase();
    const readinessLevel = String(readiness.readinessLevel || "").toLowerCase();
    const stabilityLevel = String(stability.stabilityLevel || "").toLowerCase();
    const governanceLevel = String(treasuryGovernance.governanceLevel || "").toLowerCase();
    const integrityLevel = String(treasuryIntegrity.treasuryIntegrityLevel || "").toLowerCase();
    const signalTrustLevel = String(treasuryIntegrity.signalTrustLevel || "").toLowerCase();
    const scalingLevel = String(scalingReadiness.scalingReadinessLevel || "").toLowerCase();
    const operatingModePosture = String(treasuryOperatingMode.treasuryPosture || "").toLowerCase();

    const treasuryJourney = String(boardTimeline.treasuryJourney || "stable").toLowerCase();
    const boardMomentum = String(boardTimeline.treasuryMomentum || "stable").toLowerCase();
    const dashboardMomentum = String(monitoringDashboard.treasuryMomentum || "stable").toLowerCase();
    const healthDirection = String(historicalAnalytics?.historicalHealthTrend?.direction || "").toLowerCase();

    const resilienceSupportive =
      isLevelIn(readinessLevel, ["strong", "resilient", "operational"]) ||
      isLevelIn(stabilityLevel, ["highly_stable", "stable"]) ||
      isLevelIn(scalingLevel, ["strong", "highly_ready"]) ||
      isLevelIn(operatingModePosture, ["confident", "steady", "stable"]);

    const executiveStatus = deriveBriefingExecutiveStatus({
      treasuryCondition,
      alertPriority,
      driftStatus,
      operationalStatus,
      readinessLevel,
      treasuryTone,
      operatingRecommendation,
    });

    const executiveOutlook = deriveBriefingExecutiveOutlook({
      treasuryJourney,
      boardMomentum,
      narrativeOutlook,
      healthDirection,
      dashboardMomentum,
    });

    const executivePriority = deriveBriefingExecutivePriority({
      executiveStatus,
      operatingRecommendation,
      scalingLevel,
      executiveOutlook,
      driftStatus,
      alertPriority,
      readinessLevel,
    });

    const executiveHeadline = deriveBriefingExecutiveHeadline({
      treasuryCondition,
      operatingRecommendation,
      treasuryTone,
      alertPriority,
      isSmallDollar,
    });

    const keyLeadershipPoints = buildBriefingLeadershipPoints({
      unifiedTreasuryScore,
      treasuryGrade,
      treasuryCondition,
      strengths,
      concernAreas,
      alertPriority,
      driftStatus,
      governanceLevel,
      integrityLevel,
      signalTrustLevel,
      operatingModePosture,
      isSmallDollar,
    });

    const actionFocus = buildBriefingActionFocus({
      executivePriority,
      executiveStatus,
      operatingRecommendation,
      driftStatus,
      alertPriority,
      readinessLevel,
      operationalStatus,
      isSmallDollar,
    });

    const confidence = computeBriefingConfidence({
      inputConfidences: [
        unifiedScore.confidence,
        treasuryNarrative.confidence,
        boardTimeline.confidence,
        executiveSummary.confidence,
        readiness.confidence,
        stability.confidence,
        scalingReadiness.scalingConfidence,
        treasuryGovernance.confidence,
        treasuryIntegrity.confidence,
        treasuryOperatingMode.confidence,
        operationalGuidance.confidence,
        driftDetection.confidence,
        historicalAnalytics.confidence,
        monitoringDashboard.confidence,
        classifiedAlerts.confidence,
      ],
      executiveStatus,
      executiveOutlook,
      isSmallDollar,
    });

    const briefingSummary = buildBriefingSummaryParagraph({
      executiveStatus,
      executiveOutlook,
      treasuryCondition,
      driftStatus,
      alertPriority,
      resilienceSupportive,
      isSmallDollar,
    });

    return {
      executiveHeadline,
      executiveStatus,
      executivePriority,
      executiveOutlook,
      keyLeadershipPoints,
      actionFocus,
      confidence,
      briefingSummary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryExecutiveBriefing", err: err?.message || err });
    return { ...EMPTY_TREASURY_EXECUTIVE_BRIEFING };
  }
}

const EMPTY_TREASURY_READINESS_INDEX = Object.freeze({
  treasuryReadinessIndex: 0,
  treasuryLaunchSignal: "hold_position",
  launchConfidence: "low",
  treasuryLaunchCondition: "watch",
  recommendedLaunchPosture: "continue_testing",
  confidence: 0,
  readinessDrivers: [],
  watchAreas: [],
  recommendations: [],
  summary:
    "Treasury readiness index unavailable — unified treasury score and executive briefing signals are required before a launch readiness assessment can be derived.",
});

function driftStatusToLaunchScore(driftStatus) {
  const status = String(driftStatus || "unchanged").toLowerCase();
  if (status === "unchanged") return 92;
  if (status === "minor_shift") return 78;
  if (status === "moderate_shift") return 55;
  if (status === "meaningful_shift") return 28;
  return 60;
}

function alertPriorityToLaunchScore(alertPriority) {
  const priority = String(alertPriority || "low").toLowerCase();
  if (priority === "low") return 90;
  if (priority === "medium") return 68;
  if (priority === "elevated") return 45;
  if (priority === "high") return 22;
  return 65;
}

function operatingModeToLaunchScore(posture, operationalStatus) {
  const mode = String(posture || "").toLowerCase();
  const status = String(operationalStatus || "monitor").toLowerCase();
  if (isLevelIn(status, ["high_attention"])) return 30;
  if (isLevelIn(status, ["elevated_attention"])) return 52;
  if (isLevelIn(mode, ["confident", "steady", "stable"])) return 88;
  if (isLevelIn(mode, ["normal_monitoring"])) return 78;
  if (isLevelIn(mode, ["increased_monitoring"])) return 58;
  if (isLevelIn(mode, ["active_review", "elevated_attention"])) return 42;
  return 65;
}

function monitoringDashboardToLaunchScore(momentum, stabilityLevel) {
  const mom = String(momentum || "stable").toLowerCase();
  const stab = String(stabilityLevel || "").toLowerCase();
  let score = 70;
  if (isLevelIn(mom, ["stable", "improving", "strengthening"])) score += 12;
  else if (isLevelIn(mom, ["variable", "deteriorating"])) score -= 18;
  if (isLevelIn(stab, ["highly_stable", "stable"])) score += 8;
  else if (isLevelIn(stab, ["variable", "unstable"])) score -= 10;
  return clamp(Math.round(score), 0, 100);
}

function launchConfidenceBand(confidence, isSmallDollar) {
  return unifiedConfidenceBand(confidence, isSmallDollar);
}

function deriveTreasuryLaunchCondition({
  readinessIndex,
  unifiedCondition,
  alertPriority,
  driftStatus,
  readinessLevel,
}) {
  const noElevatedSignals =
    !isLevelIn(alertPriority, ["high", "elevated"]) &&
    !isLevelIn(driftStatus, ["meaningful_shift"]) &&
    !isLevelIn(readinessLevel, ["not_ready"]);

  if (
    readinessIndex >= 88 &&
    isLevelIn(unifiedCondition, ["resilient"]) &&
    noElevatedSignals
  ) {
    return "resilient";
  }
  if (readinessIndex >= 72 && noElevatedSignals) return "healthy";
  if (readinessIndex >= 55 && noElevatedSignals) return "stable";
  return "watch";
}

function deriveTreasuryLaunchSignal({
  readinessIndex,
  treasuryLaunchCondition,
  unifiedScore,
  operatingRecommendation,
  alertPriority,
  driftStatus,
  operationalStatus,
  readinessLevel,
  scalingLevel,
  governanceLevel,
  executiveStatus,
  isSmallDollar,
}) {
  const elevatedConcern =
    isLevelIn(alertPriority, ["high"]) ||
    isLevelIn(driftStatus, ["meaningful_shift"]) ||
    isLevelIn(operationalStatus, ["high_attention"]) ||
    isLevelIn(readinessLevel, ["not_ready"]) ||
    isLevelIn(executiveStatus, ["elevated_attention"]) ||
    isLevelIn(operatingRecommendation, ["elevated_attention"]) ||
    isLevelIn(treasuryLaunchCondition, ["watch"]);

  if (elevatedConcern) {
    return readinessIndex < 50 || isLevelIn(alertPriority, ["high"])
      ? "hold_position"
      : "elevated_monitoring";
  }

  const growthReady =
    readinessIndex >= 82 &&
    unifiedScore >= 80 &&
    isLevelIn(scalingLevel, ["strong", "highly_ready"]) &&
    isLevelIn(governanceLevel, ["strong", "institutional"]) &&
    !isLevelIn(driftStatus, ["moderate_shift", "meaningful_shift"]) &&
    !isLevelIn(alertPriority, ["elevated", "medium"]);

  if (growthReady && !isSmallDollar) {
    return "monitored_growth_ready";
  }

  if (
    readinessIndex >= 62 &&
    (isLevelIn(treasuryLaunchCondition, ["stable", "healthy", "resilient"]) ||
      isLevelIn(operatingRecommendation, ["soft_launch_ready", "controlled_growth_ready"]))
  ) {
    return "soft_launch_ready";
  }

  if (readinessIndex < 50) return "hold_position";
  return "elevated_monitoring";
}

function deriveRecommendedLaunchPosture({
  treasuryLaunchSignal,
  treasuryLaunchCondition,
  readinessLevel,
  isSmallDollar,
}) {
  if (isSmallDollar || isLevelIn(readinessLevel, ["developing", "not_ready"])) {
    return "continue_testing";
  }
  if (treasuryLaunchSignal === "monitored_growth_ready") return "monitored_growth";
  if (treasuryLaunchSignal === "soft_launch_ready") return "controlled_soft_launch";
  if (
    treasuryLaunchSignal === "elevated_monitoring" ||
    treasuryLaunchSignal === "hold_position" ||
    isLevelIn(treasuryLaunchCondition, ["watch"])
  ) {
    return "elevated_review";
  }
  return "controlled_soft_launch";
}

function buildLaunchReadinessDrivers({
  unifiedScore,
  readiness,
  stability,
  scalingReadiness,
  treasuryGovernance,
  treasuryIntegrity,
  driftStatus,
  alertPriority,
  treasuryOperatingMode,
  monitoringDashboard,
}) {
  const drivers = [];

  const unified = clamp(Math.round(Number(unifiedScore) || 0), 0, 100);
  if (unified >= 70) {
    drivers.push({
      type: "health",
      title: "Unified treasury health",
      explanation:
        unified >= 85
          ? "The unified treasury score reflects a well-supported operating posture across core health indicators."
          : "The unified treasury score indicates a supportive baseline for routine treasury operations.",
    });
  }

  const readinessScore = clamp(Math.round(Number(readiness?.readinessScore) || 0), 0, 100);
  if (
    readinessScore >= 65 ||
    isLevelIn(readiness?.readinessLevel, ["operational", "strong", "resilient"])
  ) {
    drivers.push({
      type: "health",
      title: "Operational readiness",
      explanation:
        "Treasury readiness signals indicate operational capacity aligned with current launch assumptions.",
    });
  }

  const stabilityScore = clamp(Math.round(Number(stability?.stabilityScore) || 0), 0, 100);
  if (
    stabilityScore >= 65 ||
    isLevelIn(stability?.stabilityLevel, ["stable", "highly_stable"])
  ) {
    drivers.push({
      type: "stability",
      title: "Treasury stability",
      explanation:
        "Period-over-period treasury behavior has remained consistent with limited destabilizing variance.",
    });
  }

  if (isLevelIn(treasuryGovernance?.governanceLevel, ["strong", "institutional"])) {
    drivers.push({
      type: "governance",
      title: "Governance oversight",
      explanation:
        "Governance posture is well established, supporting leadership review and advisory oversight cadence.",
    });
  }

  if (
    isLevelIn(treasuryIntegrity?.treasuryIntegrityLevel, ["strong", "highly_trusted"]) ||
    isLevelIn(treasuryIntegrity?.signalTrustLevel, ["high", "strong"])
  ) {
    drivers.push({
      type: "integrity",
      title: "Signal integrity",
      explanation:
        "Underlying treasury signals remain internally consistent and suitable for launch readiness assessment.",
    });
  }

  if (isLevelIn(driftStatus, ["unchanged", "minor_shift"]) && isLevelIn(alertPriority, ["low"])) {
    drivers.push({
      type: "stability",
      title: "Quiet monitoring environment",
      explanation:
        "Drift and alert activity remain within routine bounds, supporting a calm launch readiness read.",
    });
  }

  if (isLevelIn(treasuryOperatingMode?.treasuryPosture, ["stable", "steady", "confident"])) {
    drivers.push({
      type: "health",
      title: "Steady operating mode",
      explanation:
        "Treasury operating mode reflects a steady posture aligned with routine monitoring assumptions.",
    });
  }

  if (isLevelIn(monitoringDashboard?.treasuryMomentum, ["stable", "improving", "strengthening"])) {
    drivers.push({
      type: "stability",
      title: "Monitoring momentum",
      explanation:
        "The monitoring dashboard shows steady or improving momentum without destabilizing movement.",
    });
  }

  if (
    isLevelIn(scalingReadiness?.scalingReadinessLevel, ["strong", "highly_ready"]) &&
    clamp(Math.round(Number(scalingReadiness?.scalingReadinessScore) || 0), 0, 100) >= 70
  ) {
    drivers.push({
      type: "health",
      title: "Scaling readiness",
      explanation:
        "Scaling readiness indicators support measured volume increases under continued monitoring.",
    });
  }

  return [...new Set(drivers.map((d) => JSON.stringify(d)))].map((s) => JSON.parse(s)).slice(0, 6);
}

function buildLaunchWatchAreas({
  concernAreas,
  driftStatus,
  alertPriority,
  readinessLevel,
  stabilityLevel,
  integrityLevel,
  signalTrustLevel,
  operationalStatus,
  treasuryExecutiveBriefing,
  treasuryNarrative,
}) {
  const areas = [];

  if (Array.isArray(concernAreas)) {
    for (const item of concernAreas.slice(0, 2)) {
      if (typeof item === "string" && item.trim()) areas.push(item.trim());
    }
  }

  if (isLevelIn(driftStatus, ["moderate_shift", "meaningful_shift"])) {
    areas.push("Treasury drift signals warrant continued leadership awareness in the next review cycle.");
  }
  if (isLevelIn(alertPriority, ["elevated", "high", "medium"])) {
    areas.push("Alert activity is above routine baseline and should remain on the leadership watch list.");
  }
  if (isLevelIn(readinessLevel, ["developing", "not_ready"])) {
    areas.push("Operational readiness remains below the threshold for expanded launch activity.");
  }
  if (isLevelIn(stabilityLevel, ["variable", "unstable"])) {
    areas.push("Treasury stability variance suggests continued observation before posture changes.");
  }
  if (isLevelIn(integrityLevel, ["weak"]) || isLevelIn(signalTrustLevel, ["low"])) {
    areas.push("Signal integrity is softer than desired, reducing certainty in launch readiness conclusions.");
  }
  if (isLevelIn(operationalStatus, ["elevated_attention", "high_attention"])) {
    areas.push("Operational guidance flags elevated attention conditions for treasury oversight.");
  }

  const briefingPoints = treasuryExecutiveBriefing?.keyLeadershipPoints;
  if (Array.isArray(briefingPoints)) {
    for (const point of briefingPoints.slice(0, 1)) {
      if (typeof point === "string" && point.toLowerCase().includes("concern")) {
        areas.push(point);
      }
    }
  }

  const takeaways = treasuryNarrative?.keyTakeaways;
  if (Array.isArray(takeaways)) {
    for (const item of takeaways.slice(0, 1)) {
      if (typeof item === "string" && /caution|watch|elevated|drift|alert/i.test(item)) {
        areas.push(item);
      }
    }
  }

  return [...new Set(areas)].slice(0, 6);
}

function buildLaunchRecommendations({
  treasuryLaunchSignal,
  recommendedLaunchPosture,
  treasuryLaunchCondition,
  isSmallDollar,
  watchAreas,
}) {
  const recommendations = [];

  if (recommendedLaunchPosture === "continue_testing") {
    recommendations.push(
      "Continue soft-launch testing under routine monitoring and reconciliation oversight.",
    );
    recommendations.push(
      "Refresh treasury snapshots on the normal cadence before adjusting launch posture.",
    );
  } else if (recommendedLaunchPosture === "controlled_soft_launch") {
    recommendations.push(
      "Treasury conditions support continued soft-launch operations with routine monitoring and reconciliation oversight.",
    );
    recommendations.push(
      "Maintain current monitoring cadence and reassess as snapshot history deepens.",
    );
  } else if (recommendedLaunchPosture === "monitored_growth") {
    recommendations.push(
      "Treasury conditions support measured, monitored growth under established governance oversight.",
    );
    recommendations.push(
      "Continue tracking readiness, stability, and alert signals as operating volume scales.",
    );
  } else {
    recommendations.push(
      "Prioritize review of flagged treasury signals before considering any expansion of launch activity.",
    );
    recommendations.push(
      "Maintain heightened monitoring cadence until conditions return to a stable baseline.",
    );
  }

  if (treasuryLaunchSignal === "elevated_monitoring") {
    recommendations.push(
      "Leadership should treat today's launch signal as advisory elevated monitoring rather than a green light for expansion.",
    );
  }

  if (isLevelIn(treasuryLaunchCondition, ["watch"])) {
    recommendations.push(
      "Treasury launch condition remains under watch — defer posture upgrades until signals stabilize.",
    );
  }

  if (watchAreas.length > 0) {
    recommendations.push(
      "Review the watch areas above and confirm they remain within advisory tolerances.",
    );
  }

  if (isSmallDollar) {
    recommendations.push(
      "Treat all launch readiness conclusions as advisory given the observed soft-launch operating scale.",
    );
  }

  return [...new Set(recommendations)].slice(0, 6);
}

function buildLaunchReadinessSummary({
  treasuryReadinessIndex,
  treasuryLaunchSignal,
  launchConfidence,
  treasuryLaunchCondition,
  recommendedLaunchPosture,
  confidence,
  isSmallDollar,
}) {
  const signalPhrase = {
    hold_position: "holding current launch position with continued observation",
    soft_launch_ready: "continued soft-launch operations with routine monitoring and reconciliation oversight",
    monitored_growth_ready: "measured, monitored growth under established treasury oversight",
    elevated_monitoring: "elevated monitoring with leadership review before any posture change",
  }[treasuryLaunchSignal];

  const conditionPhrase = narrativeConditionPhrase(treasuryLaunchCondition);
  const posturePhrase = {
    continue_testing: "continue testing under soft-launch assumptions",
    controlled_soft_launch: "a controlled soft-launch posture",
    monitored_growth: "a monitored growth posture",
    elevated_review: "an elevated review posture",
  }[recommendedLaunchPosture];

  let summary =
    `Today's treasury readiness index is ${treasuryReadinessIndex}/100, reflecting a ${conditionPhrase} launch condition. ` +
    `Treasury conditions support ${signalPhrase}, and leadership should maintain ${posturePhrase}. ` +
    `Launch confidence is ${launchConfidence} (${confidence}/100). `;

  if (isSmallDollar) {
    summary +=
      "Soft-launch testing environment detected; treasury readiness remains advisory. ";
  }

  summary +=
    "This launch signal is read-only and advisory, intended to support leadership review rather than automated action.";

  return summary;
}

/**
 * Synthesize treasury intelligence into a single launch-facing readiness index
 * and leadership launch signal. Read-only and advisory only — performs no
 * mutations, no persistence, and no automated treasury actions. Accepts a single
 * options object consistent with the other treasury intelligence functions;
 * every input is optional and defaults safely.
 */
export function calculateTreasuryReadinessIndex({
  unifiedScore = {},
  treasuryExecutiveBriefing = {},
  treasuryNarrative = {},
  boardTimeline = {},
  readiness = {},
  stability = {},
  scalingReadiness = {},
  treasuryGovernance = {},
  treasuryIntegrity = {},
  treasuryOperatingMode = {},
  operationalGuidance = {},
  driftDetection = {},
  monitoringDashboard = {},
  historicalAnalytics = {},
  classifiedAlerts = {},
  treasuryHealth,
  health: healthAlias,
} = {}) {
  try {
    const hasUnified =
      Number.isFinite(Number(unifiedScore?.unifiedTreasuryScore)) &&
      (unifiedScore?.treasuryCondition || unifiedScore?.operatingRecommendation);
    if (!hasUnified) {
      return { ...EMPTY_TREASURY_READINESS_INDEX };
    }

    const health = treasuryHealth || healthAlias || {};
    const metrics = health?.sourceSnapshot?.metrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const hasMetrics = liabilities > 0 || exposure > 0;
    const summaryHints = `${String(unifiedScore?.treasuryStory || "")} ${String(
      treasuryExecutiveBriefing?.briefingSummary || treasuryNarrative?.summary || "",
    )} ${String(boardTimeline?.summary || "")}`.toLowerCase();
    const isSmallDollar = hasMetrics
      ? isSmallDollarScenarioEnvironment(exposure, liabilities)
      : summaryHints.includes("soft-launch") || summaryHints.includes("soft launch");

    const unifiedTreasuryScore = clamp(Math.round(Number(unifiedScore.unifiedTreasuryScore) || 0), 0, 100);
    const unifiedCondition = String(unifiedScore.treasuryCondition || "watch").toLowerCase();
    const operatingRecommendation = String(unifiedScore.operatingRecommendation || "continue_monitoring").toLowerCase();
    const concernAreas = Array.isArray(unifiedScore.concernAreas) ? unifiedScore.concernAreas : [];

    const readinessLevel = String(readiness.readinessLevel || "").toLowerCase();
    const stabilityLevel = String(stability.stabilityLevel || "").toLowerCase();
    const scalingLevel = String(scalingReadiness.scalingReadinessLevel || "").toLowerCase();
    const governanceLevel = String(treasuryGovernance.governanceLevel || "").toLowerCase();
    const integrityLevel = String(treasuryIntegrity.treasuryIntegrityLevel || "").toLowerCase();
    const signalTrustLevel = String(treasuryIntegrity.signalTrustLevel || "").toLowerCase();
    const alertPriority = String(classifiedAlerts.alertPriority || "low").toLowerCase();
    const driftStatus = String(driftDetection.driftStatus || "unchanged").toLowerCase();
    const operationalStatus = String(operationalGuidance.operationalStatus || "monitor").toLowerCase();
    const operatingModePosture = String(treasuryOperatingMode.treasuryPosture || "").toLowerCase();
    const dashboardMomentum = String(monitoringDashboard.treasuryMomentum || "stable").toLowerCase();
    const executiveStatus = String(treasuryExecutiveBriefing.executiveStatus || "stable").toLowerCase();

    const components = [
      { value: unifiedTreasuryScore, weight: 0.2 },
      { value: readiness.readinessScore, weight: 0.15 },
      { value: stability.stabilityScore, weight: 0.13 },
      { value: scalingReadiness.scalingReadinessScore, weight: 0.1 },
      { value: treasuryGovernance.governanceScore, weight: 0.12 },
      { value: treasuryIntegrity.treasuryIntegrityScore, weight: 0.1 },
      { value: driftStatusToLaunchScore(driftStatus), weight: 0.08 },
      { value: alertPriorityToLaunchScore(alertPriority), weight: 0.07 },
      {
        value: operatingModeToLaunchScore(operatingModePosture, operationalStatus),
        weight: 0.05,
      },
      {
        value: monitoringDashboardToLaunchScore(dashboardMomentum, stabilityLevel),
        weight: 0.1,
      },
    ];

    let weightSum = 0;
    let weighted = 0;
    for (const c of components) {
      const v = Number(c.value);
      if (Number.isFinite(v)) {
        weighted += clamp(Math.round(v), 0, 100) * c.weight;
        weightSum += c.weight;
      }
    }
    let indexScore = weightSum > 0 ? weighted / weightSum : unifiedTreasuryScore;

    if (isLevelIn(readinessLevel, ["strong", "resilient", "operational"])) indexScore += 2;
    if (isLevelIn(stabilityLevel, ["highly_stable", "stable"])) indexScore += 2;
    if (isLevelIn(governanceLevel, ["institutional", "strong"])) indexScore += 2;
    if (
      isLevelIn(integrityLevel, ["highly_trusted", "strong"]) ||
      isLevelIn(signalTrustLevel, ["high", "strong"])
    ) {
      indexScore += 2;
    }
    if (isLevelIn(driftStatus, ["unchanged"])) indexScore += 2;
    if (isLevelIn(alertPriority, ["low"])) indexScore += 2;
    if (isLevelIn(dashboardMomentum, ["stable", "improving", "strengthening"])) indexScore += 2;

    if (isLevelIn(driftStatus, ["meaningful_shift"])) indexScore -= 8;
    else if (isLevelIn(driftStatus, ["moderate_shift"])) indexScore -= 4;
    if (isLevelIn(readinessLevel, ["not_ready"])) indexScore -= 8;
    else if (isLevelIn(readinessLevel, ["developing"])) indexScore -= 4;
    if (isLevelIn(alertPriority, ["high"])) indexScore -= 10;
    else if (isLevelIn(alertPriority, ["elevated"])) indexScore -= 5;
    if (isLevelIn(integrityLevel, ["weak"]) || isLevelIn(signalTrustLevel, ["low"])) indexScore -= 5;
    if (isLevelIn(operationalStatus, ["high_attention"])) indexScore -= 9;
    else if (isLevelIn(operationalStatus, ["elevated_attention"])) indexScore -= 4;
    if (isLevelIn(stabilityLevel, ["unstable"])) indexScore -= 4;
    if (isLevelIn(executiveStatus, ["elevated_attention"])) indexScore -= 3;

    const treasuryReadinessIndex = clamp(Math.round(indexScore), 0, 100);

    const treasuryLaunchCondition = deriveTreasuryLaunchCondition({
      readinessIndex: treasuryReadinessIndex,
      unifiedCondition,
      alertPriority,
      driftStatus,
      readinessLevel,
    });

    const treasuryLaunchSignal = deriveTreasuryLaunchSignal({
      readinessIndex: treasuryReadinessIndex,
      treasuryLaunchCondition,
      unifiedScore: unifiedTreasuryScore,
      operatingRecommendation,
      alertPriority,
      driftStatus,
      operationalStatus,
      readinessLevel,
      scalingLevel,
      governanceLevel,
      executiveStatus,
      isSmallDollar,
    });

    let effectiveLaunchSignal = treasuryLaunchSignal;
    if (isSmallDollar && effectiveLaunchSignal === "monitored_growth_ready") {
      effectiveLaunchSignal = "soft_launch_ready";
    }

    const recommendedLaunchPosture = deriveRecommendedLaunchPosture({
      treasuryLaunchSignal: effectiveLaunchSignal,
      treasuryLaunchCondition,
      readinessLevel,
      isSmallDollar,
    });

    const confidenceInputs = [
      unifiedScore.confidence,
      treasuryExecutiveBriefing.confidence,
      treasuryNarrative.confidence,
      boardTimeline.confidence,
      readiness.confidence,
      stability.confidence,
      scalingReadiness.scalingConfidence,
      treasuryGovernance.confidence,
      treasuryIntegrity.confidence,
      treasuryOperatingMode.confidence,
      operationalGuidance.confidence,
      driftDetection.confidence,
      historicalAnalytics.confidence,
      monitoringDashboard.confidence,
      classifiedAlerts.confidence,
    ];
    const presentConfidences = confidenceInputs
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v) && v > 0);
    const avgConfidence =
      presentConfidences.length > 0
        ? presentConfidences.reduce((a, b) => a + b, 0) / presentConfidences.length
        : clamp(Math.round(Number(unifiedScore.confidence) || 40), 0, 100);
    const coverage =
      confidenceInputs.length > 0 ? presentConfidences.length / confidenceInputs.length : 0;
    let confidence = clamp(Math.round(avgConfidence * (0.6 + 0.4 * coverage)), 0, 100);
    if (isSmallDollar) confidence = Math.min(confidence, 82);
    const launchConfidence = launchConfidenceBand(confidence, isSmallDollar);

    const readinessDrivers = buildLaunchReadinessDrivers({
      unifiedScore: unifiedTreasuryScore,
      readiness,
      stability,
      scalingReadiness,
      treasuryGovernance,
      treasuryIntegrity,
      driftStatus,
      alertPriority,
      treasuryOperatingMode,
      monitoringDashboard,
    });

    const watchAreas = buildLaunchWatchAreas({
      concernAreas,
      driftStatus,
      alertPriority,
      readinessLevel,
      stabilityLevel,
      integrityLevel,
      signalTrustLevel,
      operationalStatus,
      treasuryExecutiveBriefing,
      treasuryNarrative,
    });

    const recommendations = buildLaunchRecommendations({
      treasuryLaunchSignal: effectiveLaunchSignal,
      recommendedLaunchPosture,
      treasuryLaunchCondition,
      isSmallDollar,
      watchAreas,
    });

    const summary = buildLaunchReadinessSummary({
      treasuryReadinessIndex,
      treasuryLaunchSignal: effectiveLaunchSignal,
      launchConfidence,
      treasuryLaunchCondition,
      recommendedLaunchPosture,
      confidence,
      isSmallDollar,
    });

    return {
      treasuryReadinessIndex,
      treasuryLaunchSignal: effectiveLaunchSignal,
      launchConfidence,
      treasuryLaunchCondition,
      recommendedLaunchPosture,
      confidence,
      readinessDrivers,
      watchAreas,
      recommendations,
      summary,
    };
  } catch (err) {
    warn({ op: "calculateTreasuryReadinessIndex", err: err?.message || err });
    return { ...EMPTY_TREASURY_READINESS_INDEX };
  }
}

const EMPTY_TREASURY_COMMAND_CENTER = Object.freeze({
  treasuryCommandStatus: "monitored",
  treasuryOperatingPicture: "cautious_launch",
  treasuryPriorityLevel: "moderate",
  treasuryAttentionSignal: "increased_review",
  treasuryHealthSignal: "watch",
  treasuryLeadershipView: "Treasury command center pending",
  confidence: 0,
  executiveActions: [],
  watchAreas: [],
  strengths: [],
  concerns: [],
  summary:
    "Treasury command center unavailable — unified treasury score, executive briefing, and readiness index signals are required before the leadership operating view can be composed.",
});

function deriveCommandCenterStatus({
  treasuryCondition,
  treasuryLaunchCondition,
  treasuryLaunchSignal,
  recommendedLaunchPosture,
  executiveStatus,
  executivePriority,
  treasuryTone,
  narrativeOutlook,
  alertPriority,
  driftStatus,
  operationalStatus,
  readinessLevel,
  operatingRecommendation,
}) {
  const criticalReview =
    treasuryLaunchSignal === "hold_position" ||
    isLevelIn(recommendedLaunchPosture, ["elevated_review"]) ||
    executivePriority === "elevated_review" ||
    isLevelIn(readinessLevel, ["not_ready"]) ||
    isLevelIn(alertPriority, ["high"]) ||
    isLevelIn(driftStatus, ["meaningful_shift"]) ||
    isLevelIn(operationalStatus, ["high_attention"]);

  if (criticalReview) return "active_review";

  const elevated =
    isLevelIn(treasuryCondition, ["watch"]) ||
    isLevelIn(treasuryLaunchCondition, ["watch"]) ||
    executiveStatus === "elevated_attention" ||
    treasuryLaunchSignal === "elevated_monitoring" ||
    isLevelIn(operatingRecommendation, ["elevated_attention"]) ||
    isLevelIn(alertPriority, ["elevated"]) ||
    isLevelIn(driftStatus, ["moderate_shift"]) ||
    isLevelIn(operationalStatus, ["elevated_attention"]);

  if (elevated) return "elevated_attention";

  const monitored =
    isLevelIn(treasuryTone, ["cautious", "elevated_attention"]) ||
    isLevelIn(narrativeOutlook, ["cautious", "mixed"]) ||
    executiveStatus === "monitored" ||
    isLevelIn(readinessLevel, ["developing"]) ||
    isLevelIn(alertPriority, ["medium"]) ||
    executivePriority === "review_risk_signals";

  if (monitored) return "monitored";

  if (
    isLevelIn(treasuryCondition, ["healthy", "resilient"]) &&
    isLevelIn(treasuryLaunchCondition, ["healthy", "resilient", "stable"]) &&
    isLevelIn(alertPriority, ["low"]) &&
    isLevelIn(driftStatus, ["unchanged", "minor_shift"]) &&
    isLevelIn(treasuryTone, ["calm", "stable"])
  ) {
    return "stable";
  }

  return "monitored";
}

function deriveCommandCenterOperatingPicture({
  treasuryLaunchSignal,
  recommendedLaunchPosture,
  operatingRecommendation,
  executivePriority,
  treasuryCommandStatus,
  narrativeOutlook,
  readinessLevel,
  isSmallDollar,
}) {
  if (
    treasuryLaunchSignal === "elevated_monitoring" ||
    treasuryCommandStatus === "elevated_attention" ||
    treasuryCommandStatus === "active_review" ||
    recommendedLaunchPosture === "elevated_review"
  ) {
    return "elevated_monitoring";
  }

  if (
    treasuryLaunchSignal === "monitored_growth_ready" ||
    recommendedLaunchPosture === "monitored_growth" ||
    executivePriority === "monitor_growth" ||
    operatingRecommendation === "controlled_growth_ready"
  ) {
    return "monitored_growth";
  }

  if (
    treasuryLaunchSignal === "soft_launch_ready" ||
    operatingRecommendation === "soft_launch_ready" ||
    recommendedLaunchPosture === "controlled_soft_launch" ||
    (isSmallDollar && treasuryCommandStatus === "stable")
  ) {
    return "stable_soft_launch";
  }

  if (
    isLevelIn(narrativeOutlook, ["cautious", "mixed"]) ||
    isLevelIn(readinessLevel, ["developing", "not_ready"]) ||
    recommendedLaunchPosture === "continue_testing" ||
    treasuryCommandStatus === "monitored"
  ) {
    return "cautious_launch";
  }

  if (isSmallDollar) return "stable_soft_launch";
  return "cautious_launch";
}

function deriveCommandCenterPriorityLevel({
  unifiedTreasuryScore,
  treasuryReadinessIndex,
  alertPriority,
  driftStatus,
  executivePriority,
  treasuryCommandStatus,
}) {
  if (
    treasuryCommandStatus === "active_review" ||
    isLevelIn(alertPriority, ["high"]) ||
    isLevelIn(driftStatus, ["meaningful_shift"]) ||
    executivePriority === "elevated_review" ||
    unifiedTreasuryScore < 45 ||
    treasuryReadinessIndex < 45
  ) {
    return "high";
  }

  if (
    treasuryCommandStatus === "elevated_attention" ||
    isLevelIn(alertPriority, ["elevated"]) ||
    isLevelIn(driftStatus, ["moderate_shift"]) ||
    executivePriority === "review_risk_signals" ||
    unifiedTreasuryScore < 60 ||
    treasuryReadinessIndex < 55
  ) {
    return "elevated";
  }

  if (
    executivePriority === "monitor_growth" ||
    isLevelIn(alertPriority, ["medium"]) ||
    unifiedTreasuryScore < 75 ||
    treasuryReadinessIndex < 68
  ) {
    return "moderate";
  }

  return "low";
}

function deriveCommandCenterAttentionSignal({
  treasuryCommandStatus,
  treasuryPriorityLevel,
  executiveStatus,
  alertPriority,
}) {
  if (
    treasuryCommandStatus === "active_review" ||
    treasuryPriorityLevel === "high" ||
    isLevelIn(alertPriority, ["high"])
  ) {
    return "active_oversight";
  }

  if (
    treasuryCommandStatus === "elevated_attention" ||
    treasuryPriorityLevel === "elevated" ||
    executiveStatus === "elevated_attention" ||
    isLevelIn(alertPriority, ["elevated"])
  ) {
    return "elevated_attention";
  }

  if (
    treasuryCommandStatus === "monitored" ||
    treasuryPriorityLevel === "moderate" ||
    executiveStatus === "monitored"
  ) {
    return "increased_review";
  }

  return "routine_monitoring";
}

function deriveCommandCenterHealthSignal({
  treasuryCondition,
  treasuryLaunchCondition,
}) {
  const unifiedRank = boardConditionRank(treasuryCondition);
  const launchRank = boardConditionRank(treasuryLaunchCondition);
  const combined = Math.min(unifiedRank, launchRank);
  if (combined >= 3) return "resilient";
  if (combined >= 2) return "healthy";
  if (combined >= 1) return "stable";
  return "watch";
}

function deriveCommandCenterLeadershipView({
  treasuryCommandStatus,
  treasuryOperatingPicture,
  treasuryHealthSignal,
  isSmallDollar,
}) {
  if (treasuryCommandStatus === "active_review") {
    return "Treasury requires active leadership review";
  }
  if (treasuryCommandStatus === "elevated_attention") {
    return "Treasury requires elevated operational attention";
  }
  if (treasuryOperatingPicture === "elevated_monitoring") {
    return "Treasury under elevated monitoring posture";
  }
  if (treasuryOperatingPicture === "monitored_growth") {
    return isSmallDollar
      ? "Treasury stable under monitored soft-launch growth"
      : "Treasury stable under monitored growth";
  }
  if (treasuryOperatingPicture === "stable_soft_launch" || isSmallDollar) {
    return "Treasury stable under soft-launch monitoring";
  }
  if (isLevelIn(treasuryHealthSignal, ["resilient", "healthy"])) {
    return "Treasury operating within expectations";
  }
  if (treasuryCommandStatus === "monitored") {
    return "Treasury operating under active monitoring";
  }
  return "Treasury operating within expectations";
}

function mergeCommandCenterStringLists(...sources) {
  const seen = new Set();
  const merged = [];
  for (const source of sources) {
    if (!Array.isArray(source)) continue;
    for (const item of source) {
      if (typeof item !== "string") continue;
      const trimmed = item.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      merged.push(trimmed);
    }
  }
  return merged;
}

function buildCommandCenterExecutiveActions({
  treasuryExecutiveBriefing,
  treasuryReadinessIndex,
  treasuryNarrative,
  unifiedScore,
  operationalGuidance,
  isSmallDollar,
}) {
  const briefingActions = treasuryExecutiveBriefing?.actionFocus || [];
  const readinessActions = treasuryReadinessIndex?.recommendations || [];
  const unifiedRecs = unifiedScore?.recommendations || [];
  const guidanceChecks = (operationalGuidance?.recommendedChecks || []).slice(0, 2);

  const narrativeActions = [];
  const takeaways = treasuryNarrative?.keyTakeaways;
  if (Array.isArray(takeaways)) {
    for (const item of takeaways) {
      if (typeof item === "string" && /recommend|review|monitor|maintain|continue|confirm|observe/i.test(item)) {
        narrativeActions.push(item);
      }
    }
  }

  const actions = mergeCommandCenterStringLists(
    briefingActions,
    readinessActions,
    unifiedRecs.slice(0, 2),
    guidanceChecks,
    narrativeActions,
  );

  if (actions.length === 0) {
    actions.push("Continue routine treasury monitoring and refresh snapshots on the normal cadence.");
    actions.push("Maintain soft-launch monitoring cadence and reconciliation oversight.");
  }

  if (isSmallDollar) {
    actions.push("Treat all treasury command guidance as advisory given the small-dollar soft-launch operating scale.");
  }

  return [...new Set(actions)].slice(0, 6);
}

function buildCommandCenterWatchAreas({
  treasuryReadinessIndex,
  treasuryNarrative,
  unifiedScore,
  operationalGuidance,
  driftDetection,
  classifiedAlerts,
}) {
  const areas = mergeCommandCenterStringLists(
    treasuryReadinessIndex?.watchAreas,
    unifiedScore?.concernAreas,
    operationalGuidance?.watchItems,
  );

  const driftStatus = String(driftDetection?.driftStatus || "").toLowerCase();
  if (isLevelIn(driftStatus, ["moderate_shift", "meaningful_shift"])) {
    areas.push("Treasury drift signals warrant continued leadership awareness in the next review cycle.");
  }

  const alertPriority = String(classifiedAlerts?.alertPriority || "low").toLowerCase();
  if (isLevelIn(alertPriority, ["elevated", "high", "medium"])) {
    areas.push("Alert activity is above routine baseline and should remain on the leadership watch list.");
  }

  const takeaways = treasuryNarrative?.keyTakeaways;
  if (Array.isArray(takeaways)) {
    for (const item of takeaways.slice(0, 2)) {
      if (typeof item === "string" && /watch|caution|elevated|drift|concern|alert/i.test(item)) {
        if (!areas.includes(item)) areas.push(item);
      }
    }
  }

  return [...new Set(areas)].slice(0, 6);
}

function buildCommandCenterStrengths({
  unifiedScore,
  treasuryExecutiveBriefing,
  treasuryReadinessIndex,
  treasuryNarrative,
  readiness,
  stability,
  treasuryGovernance,
  treasuryIntegrity,
}) {
  const strengths = mergeCommandCenterStringLists(
    unifiedScore?.strengths,
    treasuryReadinessIndex?.readinessDrivers?.map((d) =>
      typeof d?.explanation === "string" ? d.explanation : null,
    ),
  );

  if (strengths.length === 0 && isLevelIn(unifiedScore?.treasuryCondition, ["healthy", "resilient"])) {
    strengths.push("Core treasury health indicators remain supportive of routine operations.");
  }

  const briefingPoints = treasuryExecutiveBriefing?.keyLeadershipPoints;
  if (Array.isArray(briefingPoints)) {
    for (const point of briefingPoints.slice(0, 2)) {
      if (typeof point === "string" && !/concern|watch|elevated|drift|alert/i.test(point)) {
        if (!strengths.includes(point)) strengths.push(point);
      }
    }
  }

  if (
    isLevelIn(readiness?.readinessLevel, ["strong", "resilient", "operational"]) &&
    strengths.length < 4
  ) {
    strengths.push("Operational readiness continued to support routine treasury operations.");
  }
  if (
    isLevelIn(stability?.stabilityLevel, ["highly_stable", "stable"]) &&
    strengths.length < 4
  ) {
    strengths.push("Treasury behavior stayed stable with low period-over-period variance.");
  }
  if (
    isLevelIn(treasuryGovernance?.governanceLevel, ["institutional", "strong"]) &&
    strengths.length < 5
  ) {
    strengths.push("Governance oversight posture is well established for leadership review.");
  }
  if (
    (isLevelIn(treasuryIntegrity?.treasuryIntegrityLevel, ["highly_trusted", "strong"]) ||
      isLevelIn(treasuryIntegrity?.signalTrustLevel, ["high", "strong"])) &&
    strengths.length < 6
  ) {
    strengths.push("Underlying treasury signals remain internally consistent and reliable.");
  }

  const takeaways = treasuryNarrative?.keyTakeaways;
  if (Array.isArray(takeaways) && strengths.length < 6) {
    for (const item of takeaways.slice(0, 1)) {
      if (typeof item === "string" && !/concern|watch|elevated|drift|alert|soft-launch testing/i.test(item)) {
        if (!strengths.includes(item)) strengths.push(item);
      }
    }
  }

  return [...new Set(strengths)].slice(0, 6);
}

function buildCommandCenterConcerns({
  unifiedScore,
  treasuryExecutiveBriefing,
  treasuryNarrative,
  treasuryReadinessIndex,
  driftDetection,
  classifiedAlerts,
  readiness,
  operationalGuidance,
}) {
  const concerns = mergeCommandCenterStringLists(unifiedScore?.concernAreas);

  const briefingPoints = treasuryExecutiveBriefing?.keyLeadershipPoints;
  if (Array.isArray(briefingPoints)) {
    for (const point of briefingPoints) {
      if (typeof point === "string" && /concern|watch|elevated|drift|alert|softer|below|unstable/i.test(point)) {
        if (!concerns.includes(point)) concerns.push(point);
      }
    }
  }

  const takeaways = treasuryNarrative?.keyTakeaways;
  if (Array.isArray(takeaways)) {
    for (const item of takeaways) {
      if (typeof item === "string" && /concern|watch|elevated|drift|alert|caution|developing|not ready/i.test(item)) {
        if (!concerns.includes(item)) concerns.push(item);
      }
    }
  }

  const driftStatus = String(driftDetection?.driftStatus || "").toLowerCase();
  if (isLevelIn(driftStatus, ["moderate_shift", "meaningful_shift"]) && concerns.length < 4) {
    concerns.push("Treasury drift detected across recent monitoring periods warrants advisory review.");
  }

  const alertPriority = String(classifiedAlerts?.alertPriority || "low").toLowerCase();
  if (isLevelIn(alertPriority, ["elevated", "high"]) && concerns.length < 5) {
    concerns.push("Alert activity is elevated above routine baseline levels.");
  }

  if (isLevelIn(readiness?.readinessLevel, ["developing", "not_ready"]) && concerns.length < 6) {
    concerns.push("Operational readiness remains below the threshold for expanded treasury activity.");
  }

  if (
    isLevelIn(String(operationalGuidance?.operationalStatus || "").toLowerCase(), [
      "elevated_attention",
      "high_attention",
    ]) &&
    concerns.length < 6
  ) {
    concerns.push("Operational guidance flags elevated attention conditions for treasury oversight.");
  }

  if (concerns.length === 0 && Array.isArray(treasuryReadinessIndex?.watchAreas) && treasuryReadinessIndex.watchAreas.length > 0) {
    concerns.push(treasuryReadinessIndex.watchAreas[0]);
  }

  return [...new Set(concerns)].slice(0, 6);
}

function buildCommandCenterSummary({
  treasuryCommandStatus,
  treasuryOperatingPicture,
  treasuryPriorityLevel,
  treasuryAttentionSignal,
  treasuryHealthSignal,
  treasuryLeadershipView,
  unifiedTreasuryScore,
  treasuryReadinessIndex,
  confidence,
  concernCount,
  strengthCount,
  isSmallDollar,
}) {
  const statusPhrase = {
    stable: "remained operationally stable under current monitoring assumptions",
    monitored: "remained broadly stable under active monitoring",
    elevated_attention: "operated under elevated monitoring with leadership awareness recommended",
    active_review: "requires active leadership review before any posture change",
  }[treasuryCommandStatus];

  const picturePhrase = {
    stable_soft_launch: "a stable soft-launch operating picture",
    monitored_growth: "a monitored growth operating picture",
    cautious_launch: "a cautious launch operating picture",
    elevated_monitoring: "an elevated monitoring operating picture",
  }[treasuryOperatingPicture];

  const priorityPhrase = {
    low: "low",
    moderate: "moderate",
    elevated: "elevated",
    high: "high",
  }[treasuryPriorityLevel];

  const attentionPhrase = {
    routine_monitoring: "routine monitoring",
    increased_review: "increased review",
    elevated_attention: "elevated attention",
    active_oversight: "active oversight",
  }[treasuryAttentionSignal];

  const healthPhrase = narrativeConditionPhrase(treasuryHealthSignal);

  let summary =
    `${treasuryLeadershipView}. Treasury ${statusPhrase}, reflecting ${picturePhrase} at a unified score of ${unifiedTreasuryScore}/100 and readiness index of ${treasuryReadinessIndex}/100. ` +
    `The complete operating picture reads as ${healthPhrase} with ${priorityPhrase} leadership priority and ${attentionPhrase} as the recommended attention posture. `;

  if (strengthCount > 0) {
    summary += `${strengthCount} supportive treasury signal${strengthCount === 1 ? "" : "s"} were identified in the current synthesis. `;
  }
  if (concernCount > 0) {
    summary += `${concernCount} concern area${concernCount === 1 ? "" : "s"} warrant continued leadership awareness in the next review cycle. `;
  } else {
    summary += "No material concern areas were identified in the current synthesis. ";
  }

  summary += `Confidence in this command center view is ${confidence}/100, blending unified score, narrative, briefing, board timeline, and readiness index signals. `;

  if (isSmallDollar) {
    summary +=
      "Soft-launch testing environment detected; treasury command guidance remains advisory.";
  } else {
    summary +=
      "This command center view is read-only and advisory, intended to support leadership review rather than automated action.";
  }

  return summary;
}

function computeCommandCenterConfidence({
  inputConfidences,
  treasuryCommandStatus,
  treasuryPriorityLevel,
  isSmallDollar,
}) {
  const present = inputConfidences.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
  const avg = present.length > 0 ? present.reduce((a, b) => a + b, 0) / present.length : 35;
  const coverage = inputConfidences.length > 0 ? present.length / inputConfidences.length : 0;
  let score = avg * (0.6 + 0.4 * coverage);

  if (treasuryCommandStatus === "active_review") score -= 8;
  else if (treasuryCommandStatus === "elevated_attention") score -= 5;
  else if (treasuryCommandStatus === "monitored") score -= 3;

  if (treasuryPriorityLevel === "high") score -= 6;
  else if (treasuryPriorityLevel === "elevated") score -= 4;

  if (present.length < 8) score = Math.min(score, 62);
  if (isSmallDollar) score = Math.min(score, 82);

  return clamp(Math.round(score), 0, 100);
}

/**
 * Synthesize all treasury intelligence layers into a single executive command
 * center — the one-page leadership operating view. Read-only and advisory only —
 * performs no mutations, no persistence, and no automated treasury actions.
 * Accepts a single options object consistent with the other treasury intelligence
 * functions; every input is optional and defaults safely.
 */
export function buildTreasuryCommandCenter({
  unifiedScore = {},
  boardTimeline = {},
  treasuryNarrative = {},
  treasuryExecutiveBriefing = {},
  treasuryReadinessIndex = {},
  readiness = {},
  stability = {},
  treasuryGovernance = {},
  treasuryIntegrity = {},
  scalingReadiness = {},
  treasuryOperatingMode = {},
  operationalGuidance = {},
  monitoringDashboard = {},
  historicalAnalytics = {},
  classifiedAlerts = {},
  driftDetection = {},
  treasuryHealth,
  health: healthAlias,
} = {}) {
  try {
    const hasUnified =
      Number.isFinite(Number(unifiedScore?.unifiedTreasuryScore)) &&
      (unifiedScore?.treasuryCondition || unifiedScore?.operatingRecommendation);
    const hasBriefing = Boolean(treasuryExecutiveBriefing?.executiveHeadline || treasuryExecutiveBriefing?.executiveStatus);
    const hasReadinessIndex =
      Number.isFinite(Number(treasuryReadinessIndex?.treasuryReadinessIndex)) &&
      treasuryReadinessIndex?.treasuryLaunchSignal;
    if (!hasUnified || !hasBriefing || !hasReadinessIndex) {
      return { ...EMPTY_TREASURY_COMMAND_CENTER };
    }

    const health = treasuryHealth || healthAlias || {};
    const metrics = health?.sourceSnapshot?.metrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const hasMetrics = liabilities > 0 || exposure > 0;
    const summaryHints = `${String(unifiedScore?.treasuryStory || "")} ${String(
      treasuryExecutiveBriefing?.briefingSummary || treasuryNarrative?.summary || "",
    )} ${String(boardTimeline?.summary || "")}`.toLowerCase();
    const isSmallDollar = hasMetrics
      ? isSmallDollarScenarioEnvironment(exposure, liabilities)
      : summaryHints.includes("soft-launch") || summaryHints.includes("soft launch");

    const unifiedTreasuryScore = clamp(Math.round(Number(unifiedScore.unifiedTreasuryScore) || 0), 0, 100);
    const treasuryCondition = String(unifiedScore.treasuryCondition || "watch").toLowerCase();
    const operatingRecommendation = String(unifiedScore.operatingRecommendation || "continue_monitoring").toLowerCase();

    const treasuryReadinessIndexScore = clamp(
      Math.round(Number(treasuryReadinessIndex.treasuryReadinessIndex) || 0),
      0,
      100,
    );
    const treasuryLaunchCondition = String(
      treasuryReadinessIndex.treasuryLaunchCondition || treasuryCondition,
    ).toLowerCase();
    const treasuryLaunchSignal = String(treasuryReadinessIndex.treasuryLaunchSignal || "hold_position").toLowerCase();
    const recommendedLaunchPosture = String(
      treasuryReadinessIndex.recommendedLaunchPosture || "continue_testing",
    ).toLowerCase();

    const executiveStatus = String(treasuryExecutiveBriefing.executiveStatus || "stable").toLowerCase();
    const executivePriority = String(treasuryExecutiveBriefing.executivePriority || "maintain_monitoring").toLowerCase();
    const treasuryTone = String(treasuryNarrative.treasuryTone || "stable").toLowerCase();
    const narrativeOutlook = String(treasuryNarrative.treasuryOutlook || "stable").toLowerCase();

    const alertPriority = String(classifiedAlerts.alertPriority || "low").toLowerCase();
    const driftStatus = String(driftDetection.driftStatus || "unchanged").toLowerCase();
    const operationalStatus = String(operationalGuidance.operationalStatus || "monitor").toLowerCase();
    const readinessLevel = String(readiness.readinessLevel || "").toLowerCase();

    const treasuryCommandStatus = deriveCommandCenterStatus({
      treasuryCondition,
      treasuryLaunchCondition,
      treasuryLaunchSignal,
      recommendedLaunchPosture,
      executiveStatus,
      executivePriority,
      treasuryTone,
      narrativeOutlook,
      alertPriority,
      driftStatus,
      operationalStatus,
      readinessLevel,
      operatingRecommendation,
    });

    const treasuryOperatingPicture = deriveCommandCenterOperatingPicture({
      treasuryLaunchSignal,
      recommendedLaunchPosture,
      operatingRecommendation,
      executivePriority,
      treasuryCommandStatus,
      narrativeOutlook,
      readinessLevel,
      isSmallDollar,
    });

    const treasuryPriorityLevel = deriveCommandCenterPriorityLevel({
      unifiedTreasuryScore,
      treasuryReadinessIndex: treasuryReadinessIndexScore,
      alertPriority,
      driftStatus,
      executivePriority,
      treasuryCommandStatus,
    });

    const treasuryAttentionSignal = deriveCommandCenterAttentionSignal({
      treasuryCommandStatus,
      treasuryPriorityLevel,
      executiveStatus,
      alertPriority,
    });

    const treasuryHealthSignal = deriveCommandCenterHealthSignal({
      treasuryCondition,
      treasuryLaunchCondition,
    });

    const treasuryLeadershipView = deriveCommandCenterLeadershipView({
      treasuryCommandStatus,
      treasuryOperatingPicture,
      treasuryHealthSignal,
      isSmallDollar,
    });

    const executiveActions = buildCommandCenterExecutiveActions({
      treasuryExecutiveBriefing,
      treasuryReadinessIndex,
      treasuryNarrative,
      unifiedScore,
      operationalGuidance,
      isSmallDollar,
    });

    const watchAreas = buildCommandCenterWatchAreas({
      treasuryReadinessIndex,
      treasuryNarrative,
      unifiedScore,
      operationalGuidance,
      driftDetection,
      classifiedAlerts,
    });

    const strengths = buildCommandCenterStrengths({
      unifiedScore,
      treasuryExecutiveBriefing,
      treasuryReadinessIndex,
      treasuryNarrative,
      readiness,
      stability,
      treasuryGovernance,
      treasuryIntegrity,
    });

    const concerns = buildCommandCenterConcerns({
      unifiedScore,
      treasuryExecutiveBriefing,
      treasuryNarrative,
      treasuryReadinessIndex,
      driftDetection,
      classifiedAlerts,
      readiness,
      operationalGuidance,
    });

    const confidence = computeCommandCenterConfidence({
      inputConfidences: [
        unifiedScore.confidence,
        boardTimeline.confidence,
        treasuryNarrative.confidence,
        treasuryExecutiveBriefing.confidence,
        treasuryReadinessIndex.confidence,
        readiness.confidence,
        stability.confidence,
        scalingReadiness.scalingConfidence,
        treasuryGovernance.confidence,
        treasuryIntegrity.confidence,
        treasuryOperatingMode.confidence,
        operationalGuidance.confidence,
        monitoringDashboard.confidence,
        historicalAnalytics.confidence,
        classifiedAlerts.confidence,
        driftDetection.confidence,
      ],
      treasuryCommandStatus,
      treasuryPriorityLevel,
      isSmallDollar,
    });

    const summary = buildCommandCenterSummary({
      treasuryCommandStatus,
      treasuryOperatingPicture,
      treasuryPriorityLevel,
      treasuryAttentionSignal,
      treasuryHealthSignal,
      treasuryLeadershipView,
      unifiedTreasuryScore,
      treasuryReadinessIndex: treasuryReadinessIndexScore,
      confidence,
      concernCount: concerns.length,
      strengthCount: strengths.length,
      isSmallDollar,
    });

    return {
      treasuryCommandStatus,
      treasuryOperatingPicture,
      treasuryPriorityLevel,
      treasuryAttentionSignal,
      treasuryHealthSignal,
      treasuryLeadershipView,
      confidence,
      executiveActions,
      watchAreas,
      strengths,
      concerns,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryCommandCenter", err: err?.message || err });
    return { ...EMPTY_TREASURY_COMMAND_CENTER };
  }
}

const TREASURY_REPORT_TITLE = "Treasury Intelligence Advisory Report";

const TREASURY_REPORT_SAFETY_NOTICE =
  "This report is read-only and advisory only. It summarizes computed treasury intelligence signals for leadership review and documentation. It does not execute payouts, mutate balances, alter withdrawals, or trigger automated treasury actions.";

const EMPTY_TREASURY_REPORT = Object.freeze({
  generatedAt: null,
  reportTitle: TREASURY_REPORT_TITLE,
  executiveSummary: null,
  healthOverview: null,
  trendSummary: null,
  forecastSummary: null,
  scenarioSummary: null,
  resilienceSummary: null,
  explainabilitySummary: null,
  operationalGuidance: null,
  alerts: [],
  snapshotSummary: null,
  safetyNotice: TREASURY_REPORT_SAFETY_NOTICE,
});

function formatReportMoney(value) {
  const n = toFiniteNumber(value);
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function summarizeHealthOverview(health) {
  if (!health?.healthScore && health?.healthScore !== 0) return null;
  const metrics = health?.sourceSnapshot?.metrics || {};
  const topReasons = (health.reasons || []).slice(0, 5).map((r) => ({
    code: r.code,
    label: r.label,
    impact: r.impact,
  }));
  return {
    healthScore: health.healthScore,
    treasuryRiskLevel: health.treasuryRiskLevel || healthScoreToRiskLevel(health.healthScore),
    confidenceScore: health.confidenceScore,
    componentScores: {
      liquidity: health.liquidityScore,
      reconciliation: health.reconciliationScore,
      pendingObligation: health.pendingObligationScore,
    },
    metrics: {
      walletLiabilities: toFiniteNumber(metrics.totalWalletLiabilities),
      pendingWithdrawalExposure: toFiniteNumber(metrics.pendingWithdrawalExposure),
      fundingVolume24h: toFiniteNumber(metrics.totalFundingVolume24h),
      withdrawVolume24h: toFiniteNumber(metrics.totalWithdrawVolume24h),
      sendVolume24h: toFiniteNumber(metrics.totalSendVolume24h),
      reconciliationMismatchCount: metrics.reconciliationMismatchCount || 0,
      anomalyCount: metrics.anomalyCount || 0,
    },
    topPenaltyReasons: topReasons,
    scoredAt: health?.sourceSnapshot?.scoredAt || null,
  };
}

function summarizeTrendSection(trends) {
  if (!trends || typeof trends !== "object") return null;
  return {
    trendStatus: trends.trendStatus || "unknown",
    confidence: trends.confidence ?? 0,
    historyCount: trends.historyCount ?? 0,
    healthScoreChange: trends.healthScoreChange ?? 0,
    liabilityChange: trends.liabilityChange ?? 0,
    exposureChange: trends.exposureChange ?? 0,
    riskLevelChange: trends.riskLevelChange || "unchanged",
    warningSignalCount: (trends.warningSignals || []).length,
    warningHighlights: (trends.warningSignals || []).slice(0, 5).map((s) => ({
      code: s.code,
      severity: s.severity,
      title: formatTreasuryWarningTitle(s),
      message: s.message,
    })),
  };
}

function summarizeForecastSection(forecast) {
  if (!forecast || typeof forecast !== "object") return null;
  return {
    outlook: forecast.outlook || "unknown",
    projectedRisk: forecast.projectedRisk || "unknown",
    projectedLiabilities: forecast.projectedLiabilities || "unknown",
    projectedExposure: forecast.projectedExposure || "unknown",
    treasuryPressure: forecast.treasuryPressure || "unknown",
    confidence: forecast.confidence ?? 0,
    summary: forecast.summary || "",
    warningCount: (forecast.warnings || []).length,
    warnings: (forecast.warnings || []).slice(0, 5).map((w) => w.message || w.code),
  };
}

function summarizeScenarioSection(scenarios) {
  if (!scenarios || typeof scenarios !== "object") return null;
  return {
    scenarioConfidence: scenarios.scenarioConfidence ?? 0,
    summary: scenarios.summary || "",
    baseline: scenarios.baseline
      ? {
          healthScore: scenarios.baseline.healthScore,
          treasuryRiskLevel: scenarios.baseline.treasuryRiskLevel,
          walletLiabilities: scenarios.baseline.walletLiabilities,
          pendingWithdrawalExposure: scenarios.baseline.pendingWithdrawalExposure,
        }
      : null,
    scenarios: (scenarios.scenarios || []).map((s) => ({
      key: s.key,
      label: s.label,
      projectedHealthScore: s.projectedHealthScore,
      projectedRiskLevel: s.projectedRiskLevel,
      projectedPressure: s.projectedPressure,
      severity: s.severity,
      summary: s.summary,
    })),
  };
}

function summarizeResilienceSection(resilience) {
  if (!resilience || typeof resilience !== "object") return null;
  return {
    resilienceScore: resilience.resilienceScore ?? 0,
    resilienceLevel: resilience.resilienceLevel || "unknown",
    survivabilityScore: resilience.survivabilityScore ?? 0,
    recoveryDifficulty: resilience.recoveryDifficulty || "unknown",
    treasuryTolerance: resilience.treasuryTolerance || "unknown",
    runwayEstimate: resilience.runwayEstimate || "unknown",
    liquidityBufferScore: resilience.liquidityBufferScore ?? 0,
    confidence: resilience.confidence ?? 0,
    summary: resilience.summary || "",
    warningCount: (resilience.warnings || []).length,
  };
}

function summarizeExplainabilitySection(explainability) {
  if (!explainability || typeof explainability !== "object") return null;
  return {
    summary: explainability.summary || "",
    riskExplanation: explainability.riskExplanation || "",
    confidenceExplanation: explainability.confidenceExplanation || "",
    topDrivers: (explainability.topDrivers || []).slice(0, 5).map((d) => ({
      type: d.type,
      title: d.title,
      impact: d.impact,
    })),
    recommendations: (explainability.recommendations || []).slice(0, 8),
    decisionTraceSteps: (explainability.decisionTrace || []).length,
  };
}

function summarizeOperationalGuidanceSection(guidance, simulator) {
  if (!guidance || typeof guidance !== "object") return null;
  const section = {
    operationalStatus: guidance.operationalStatus || "monitor",
    monitoringPriority: guidance.monitoringPriority || "medium",
    confidence: guidance.confidence ?? 0,
    summary: guidance.summary || "",
    priorities: (guidance.priorities || []).slice(0, 6).map((p) => ({
      title: p.title,
      severity: p.severity,
      explanation: p.explanation,
    })),
    recommendedChecks: (guidance.recommendedChecks || []).slice(0, 8),
    watchItems: (guidance.watchItems || []).slice(0, 8),
    observations: (guidance.observations || []).slice(0, 6),
  };
  const simulatorSummary = summarizeSimulatorSection(simulator);
  if (simulatorSummary) section.simulator = simulatorSummary;
  return section;
}

function summarizeExecutiveSection(executiveSummary) {
  if (!executiveSummary || typeof executiveSummary !== "object") return null;
  return {
    executiveStatus: executiveSummary.executiveStatus || "stable_monitoring",
    headline: executiveSummary.headline || "",
    summary: executiveSummary.summary || "",
    confidence: executiveSummary.confidence ?? 0,
    keyMetrics: executiveSummary.keyMetrics || [],
    keyRisks: executiveSummary.keyRisks || [],
    keyStrengths: executiveSummary.keyStrengths || [],
    nextFocus: executiveSummary.nextFocus || [],
  };
}

function summarizeSimulatorSection(simulator) {
  if (!simulator || typeof simulator !== "object") return null;
  if (!simulator.summary && simulator.simulatedHealthScore == null) return null;
  return {
    simulatedHealthScore: simulator.simulatedHealthScore,
    simulatedRiskLevel: simulator.simulatedRiskLevel,
    simulatedPressure: simulator.simulatedPressure,
    simulatedResilience: simulator.simulatedResilience,
    confidence: simulator.confidence ?? 0,
    summary: simulator.summary || "",
    warningCount: (simulator.warnings || []).length,
  };
}

function summarizeAlertsForReport(alerts) {
  return (alerts || []).map((a) => ({
    code: a.code,
    severity: a.severity,
    title: a.title,
    message: a.message,
    createdAt: a.createdAt || null,
  }));
}

function summarizeSnapshotHistory(snapshotHistory) {
  const rows = Array.isArray(snapshotHistory) ? snapshotHistory : [];
  if (rows.length === 0) {
    return {
      count: 0,
      oldestAt: null,
      newestAt: null,
      latestScore: null,
      latestRiskLevel: null,
      scoreRange: null,
      recentSnapshots: [],
    };
  }

  const scores = rows.map((r) => Number(r.healthScore)).filter((n) => Number.isFinite(n));
  const newest = rows[0];
  const oldest = rows[rows.length - 1];

  return {
    count: rows.length,
    oldestAt: oldest?.createdAt || null,
    newestAt: newest?.createdAt || null,
    latestScore: newest?.healthScore ?? null,
    latestRiskLevel: newest?.treasuryRiskLevel || null,
    scoreRange:
      scores.length > 0
        ? { min: Math.min(...scores), max: Math.max(...scores) }
        : null,
    recentSnapshots: rows.slice(0, 5).map((r) => ({
      createdAt: r.createdAt,
      healthScore: r.healthScore,
      treasuryRiskLevel: r.treasuryRiskLevel,
      walletLiabilities: r.totalWalletLiabilities,
      pendingWithdrawalExposure: r.pendingWithdrawalExposure,
    })),
  };
}

/**
 * Build a structured advisory report from existing treasury intelligence outputs.
 * Read-only aggregation — no DB writes or financial mutations.
 *
 * @param {{
 *   executiveSummary?: object,
 *   treasuryHealth?: object,
 *   health?: object,
 *   trends?: object,
 *   forecast?: object,
 *   scenarios?: object,
 *   resilience?: object,
 *   explainability?: object,
 *   simulator?: object,
 *   simulation?: object,
 *   operationalGuidance?: object,
 *   alerts?: object[],
 *   snapshotHistory?: object[],
 * }} [input]
 */
export function buildTreasuryIntelligenceReport({
  executiveSummary,
  treasuryHealth,
  health: healthAlias,
  trends = {},
  forecast = {},
  scenarios = {},
  resilience = {},
  explainability = {},
  simulator,
  simulation,
  operationalGuidance = {},
  alerts = [],
  snapshotHistory = [],
} = {}) {
  try {
    const health = treasuryHealth || healthAlias;
    const simulatorResult = simulator || simulation || null;
    const generatedAt = new Date().toISOString();

    if (!health?.healthScore && health?.healthScore !== 0) {
      return {
        ...EMPTY_TREASURY_REPORT,
        generatedAt,
        alerts: summarizeAlertsForReport(alerts),
        snapshotSummary: summarizeSnapshotHistory(snapshotHistory),
      };
    }

    return {
      generatedAt,
      reportTitle: TREASURY_REPORT_TITLE,
      executiveSummary: summarizeExecutiveSection(executiveSummary),
      healthOverview: summarizeHealthOverview(health),
      trendSummary: summarizeTrendSection(trends),
      forecastSummary: summarizeForecastSection(forecast),
      scenarioSummary: summarizeScenarioSection(scenarios),
      resilienceSummary: summarizeResilienceSection(resilience),
      explainabilitySummary: summarizeExplainabilitySection(explainability),
      operationalGuidance: summarizeOperationalGuidanceSection(operationalGuidance, simulatorResult),
      alerts: summarizeAlertsForReport(alerts),
      snapshotSummary: summarizeSnapshotHistory(snapshotHistory),
      safetyNotice: TREASURY_REPORT_SAFETY_NOTICE,
    };
  } catch (err) {
    warn({ op: "buildTreasuryIntelligenceReport", err: err?.message || err });
    return {
      ...EMPTY_TREASURY_REPORT,
      generatedAt: new Date().toISOString(),
    };
  }
}

function appendReportSection(lines, title, bodyLines) {
  lines.push(title);
  lines.push("-".repeat(Math.min(title.length, 60)));
  for (const line of bodyLines) {
    lines.push(line);
  }
  lines.push("");
}

function appendReportBullets(lines, items, prefix = "  • ") {
  if (!items?.length) {
    lines.push("  (none)");
    return;
  }
  for (const item of items) {
    lines.push(`${prefix}${item}`);
  }
}

/**
 * Format a treasury intelligence report as plain text for copy-to-clipboard.
 * @param {ReturnType<typeof buildTreasuryIntelligenceReport>} report
 */
export function formatTreasuryReportAsText(report) {
  if (!report || typeof report !== "object") return "";

  const lines = [];
  lines.push(report.reportTitle || TREASURY_REPORT_TITLE);
  lines.push(`Generated: ${report.generatedAt || "—"}`);
  lines.push("");

  if (report.safetyNotice) {
    appendReportSection(lines, "Safety notice", [report.safetyNotice]);
  }

  const exec = report.executiveSummary;
  if (exec) {
    appendReportSection(lines, "Executive summary", [
      `Status: ${exec.executiveStatus}`,
      `Headline: ${exec.headline}`,
      exec.summary,
      `Confidence: ${exec.confidence}%`,
    ]);
    if (exec.keyMetrics?.length) {
      lines.push("Key metrics:");
      appendReportBullets(
        lines,
        exec.keyMetrics.map((m) => `${m.label}: ${m.value}`),
      );
    }
    if (exec.keyRisks?.length) {
      lines.push("Key risks:");
      appendReportBullets(lines, exec.keyRisks);
    }
    if (exec.keyStrengths?.length) {
      lines.push("Key strengths:");
      appendReportBullets(lines, exec.keyStrengths);
    }
    if (exec.nextFocus?.length) {
      lines.push("Next focus:");
      appendReportBullets(lines, exec.nextFocus);
    }
    lines.push("");
  }

  const health = report.healthOverview;
  if (health) {
    appendReportSection(lines, "Health overview", [
      `Health score: ${health.healthScore} (${health.treasuryRiskLevel} risk)`,
      `Confidence: ${health.confidenceScore}%`,
      `Liquidity / reconciliation / pending obligation: ${health.componentScores.liquidity} / ${health.componentScores.reconciliation} / ${health.componentScores.pendingObligation}`,
      `Wallet liabilities: ${formatReportMoney(health.metrics.walletLiabilities)}`,
      `Pending withdrawal exposure: ${formatReportMoney(health.metrics.pendingWithdrawalExposure)}`,
      `Reconciliation mismatches: ${health.metrics.reconciliationMismatchCount}`,
    ]);
    if (health.topPenaltyReasons?.length) {
      lines.push("Top penalty reasons:");
      appendReportBullets(
        lines,
        health.topPenaltyReasons.map((r) => `${r.label} (${r.impact})`),
      );
    }
    lines.push("");
  }

  const trends = report.trendSummary;
  if (trends) {
    appendReportSection(lines, "Trend summary", [
      `Trend status: ${trends.trendStatus}`,
      `Health score change: ${trends.healthScoreChange} pts`,
      `Liability change: ${formatReportMoney(trends.liabilityChange)}`,
      `Exposure change: ${formatReportMoney(trends.exposureChange)}`,
      `Warning signals: ${trends.warningSignalCount}`,
    ]);
    lines.push("");
  }

  const forecast = report.forecastSummary;
  if (forecast) {
    appendReportSection(lines, "Forecast summary", [
      `Outlook: ${forecast.outlook}`,
      `Projected risk: ${forecast.projectedRisk}`,
      `Treasury pressure: ${forecast.treasuryPressure}`,
      `Confidence: ${forecast.confidence}%`,
      forecast.summary,
    ]);
    lines.push("");
  }

  const scenarios = report.scenarioSummary;
  if (scenarios) {
    appendReportSection(lines, "Scenario summary", [
      `Scenario confidence: ${scenarios.scenarioConfidence}%`,
      scenarios.summary,
    ]);
    if (scenarios.scenarios?.length) {
      lines.push("Scenarios:");
      appendReportBullets(
        lines,
        scenarios.scenarios.map(
          (s) =>
            `${s.label}: health ${s.projectedHealthScore}, ${s.projectedRiskLevel} risk, ${s.projectedPressure} pressure — ${s.summary}`,
        ),
      );
    }
    lines.push("");
  }

  const resilience = report.resilienceSummary;
  if (resilience) {
    appendReportSection(lines, "Resilience summary", [
      `Resilience score: ${resilience.resilienceScore} (${resilience.resilienceLevel})`,
      `Survivability: ${resilience.survivabilityScore}`,
      `Recovery difficulty: ${resilience.recoveryDifficulty}`,
      `Runway estimate: ${resilience.runwayEstimate}`,
      resilience.summary,
    ]);
    lines.push("");
  }

  const explain = report.explainabilitySummary;
  if (explain) {
    appendReportSection(lines, "Explainability summary", [explain.summary, explain.riskExplanation]);
    if (explain.recommendations?.length) {
      lines.push("Recommendations:");
      appendReportBullets(lines, explain.recommendations);
    }
    lines.push("");
  }

  const guidance = report.operationalGuidance;
  const sim = guidance?.simulator;
  if (sim) {
    appendReportSection(lines, "Simulator summary", [
      `Simulated health: ${sim.simulatedHealthScore} (${sim.simulatedRiskLevel})`,
      `Simulated pressure: ${sim.simulatedPressure}`,
      `Simulated resilience: ${sim.simulatedResilience}`,
      sim.summary,
    ]);
    lines.push("");
  }

  if (guidance) {
    appendReportSection(lines, "Operational guidance", [
      `Operational status: ${guidance.operationalStatus}`,
      `Monitoring priority: ${guidance.monitoringPriority}`,
      guidance.summary,
    ]);
    if (guidance.priorities?.length) {
      lines.push("Priorities:");
      appendReportBullets(
        lines,
        guidance.priorities.map((p) => `[${p.severity}] ${p.title}: ${p.explanation}`),
      );
    }
    lines.push("");
  }

  if (report.alerts?.length) {
    appendReportSection(
      lines,
      "Active alerts",
      report.alerts.map((a) => `[${a.severity}] ${a.title}: ${a.message}`),
    );
  } else {
    appendReportSection(lines, "Active alerts", ["No active treasury alerts."]);
  }

  const snapshots = report.snapshotSummary;
  if (snapshots) {
    appendReportSection(lines, "Snapshot history", [
      `Snapshots in history: ${snapshots.count}`,
      snapshots.newestAt ? `Newest: ${snapshots.newestAt}` : "Newest: —",
      snapshots.latestScore != null
        ? `Latest score: ${snapshots.latestScore} (${snapshots.latestRiskLevel})`
        : "Latest score: —",
    ]);
  }

  return lines.join("\n").trim();
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
