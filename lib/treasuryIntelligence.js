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
