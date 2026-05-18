import { supabase as defaultClient } from "./supabaseClient";
import { logOperationalEvent } from "./operationalLogger";
import { recordEventOnce } from "./eventBus";
import { appendAuditEvent } from "./auditTimeline";

/**
 * Read-only treasury & reconciliation snapshot for the admin dashboard.
 *
 * Conventions:
 * - "Today" is the current calendar day in the JS runtime's local timezone
 *   (i.e. whichever timezone the admin's browser is in). The Tropicash app
 *   has no canonical TZ; the existing /admin reconciliation card uses the
 *   same local-day convention (see lib/adminOperationalOverview.js), so we
 *   stay consistent to avoid two pages disagreeing on the same screen.
 * - "Open operational errors" is defined as: rows in public.operational_logs
 *   with level = 'error' in the last 24 hours. The table has no `status`
 *   column, so a rolling window is the closest stable proxy.
 * - This module performs only SELECTs (some with `count: 'exact', head: true`).
 *   It must never insert/update/delete app data. Failures are surfaced as
 *   partial sub-results so the page can render with a warning chip.
 * - Detail strings returned for the UI must stay short and friendly; raw
 *   Postgrest errors only go into operational_logs metadata (server-side).
 */

const STATUS = Object.freeze({
  OK: "ok",
  WARNING: "warning",
  ERROR: "error",
});

const LIABILITY_PAGE_SIZE = 1000;
const LIABILITY_HARD_CAP = 50000;
const PAYOUT_EXPOSURE_LIMIT = 100;
const DAILY_WINDOW_DAYS = 7;
const URGENT_AMOUNT_THRESHOLD = 200;
const URGENT_AGE_MS = 24 * 60 * 60 * 1000;

const WALLET_AMOUNT_COLUMNS = Object.freeze(["wallet_balance", "balance"]);
let resolvedWalletAmountColumn = null;

function safeMessage(value, max = 140) {
  if (value == null) return "";
  const s = typeof value === "string" ? value : String(value);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function isMissingColumnError(err) {
  if (!err) return false;
  const code = String(err.code || "").trim();
  if (code === "42703") return true;
  const msg = String(err.message || "").toLowerCase();
  return msg.includes('column "') && msg.includes("does not exist");
}

function classifyQueryError(err, subject = null) {
  if (!err) return { status: STATUS.ERROR, detail: "Query failed." };
  const code = String(err.code || "").trim();
  const msg = String(err.message || "").toLowerCase();
  if (code === "42P01" || (msg.includes(" relation ") && msg.includes("does not exist"))) {
    return { status: STATUS.WARNING, detail: "Table not reachable — run latest migrations." };
  }
  if (code === "42703" || msg.includes('column "')) {
    const subjectLabel = subject === "wallets" ? "Wallet table" : "Table";
    return {
      status: STATUS.WARNING,
      detail: `${subjectLabel} is missing a column the app expects. Run latest migrations.`,
    };
  }
  if (
    code === "42501" ||
    msg.includes("permission denied") ||
    msg.includes("row-level security") ||
    msg.includes("row level security")
  ) {
    const target = subject ? `for ${subject}` : "";
    const trail = target ? `Admin read not authorized ${target} — run latest migrations.` : "Admin read not authorized — run latest migrations.";
    return { status: STATUS.WARNING, detail: trail };
  }
  return { status: STATUS.ERROR, detail: safeMessage(err.message || "Query failed.") };
}

function startOfTodayLocal() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDaysAgoLocal(daysAgo) {
  const d = startOfTodayLocal();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function endOfTodayLocal() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function localDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const TYPE_MAP = Object.freeze({
  fund: "fund",
  fund_wallet: "fund",
  withdraw: "withdraw",
  withdraw_wallet: "withdraw",
  send: "send",
  send_money: "send",
  receive: "receive",
  receive_money: "receive",
});

function normalizeTransactionType(raw) {
  const key = String(raw || "").toLowerCase();
  return TYPE_MAP[key] || key || "other";
}

async function resolveUserIdForLogging(client) {
  try {
    const { data } = await client.auth.getSession();
    const uid = data?.session?.user?.id;
    return uid && typeof uid === "string" ? uid : null;
  } catch {
    return null;
  }
}

async function logSectionFailure(client, section, err, extra = {}) {
  const userId = await resolveUserIdForLogging(client);
  if (!userId) return;
  void logOperationalEvent({
    level: "warn",
    category: "admin.treasury_query",
    message: `treasury snapshot section failed: ${section}`,
    metadata: {
      section,
      code: err?.code ?? null,
      message: safeMessage(err?.message ?? err, 200),
      ...extra,
    },
    userId,
    route: "/admin/treasury",
    supabaseClient: client,
  });
  void recordEventOnce({
    supabaseClient: client,
    adminTarget: true,
    eventType: "treasury.section_warning",
    category: "treasury",
    severity: "warning",
    title: "Treasury query warning",
    message: `Treasury section "${section}" returned a warning or error during snapshot build.`,
    metadata: {
      section,
      code: err?.code ?? null,
    },
    dedupeKey: `treasury.${section}`,
    windowMs: 10 * 60 * 1000,
  });
  void appendAuditEvent({
    entityType: "treasury",
    entityId: section,
    eventType: "treasury.section_warning",
    actorUserId: userId,
    severity: "warning",
    title: "Treasury snapshot warning",
    description: `Section "${section}" failed during treasury snapshot.`,
    metadata: { section, code: err?.code ?? null },
    dedupeKey: `audit:treasury:${section}:warn`,
    dedupeWindowMs: 10 * 60 * 1000,
  });
}

/**
 * Mask a payout destination for the UI. Email addresses become j***@d***.tld;
 * other strings keep their first and last char with `***` in the middle.
 * Never returns the unredacted destination.
 * @param {string | null | undefined} raw
 * @returns {string}
 */
export function maskPayoutDestination(raw) {
  const s = raw == null ? "" : String(raw).trim();
  if (!s) return "—";
  const at = s.indexOf("@");
  if (at > 0 && at < s.length - 1) {
    const local = s.slice(0, at);
    const domain = s.slice(at + 1);
    const localFirst = local.charAt(0) || "*";
    const dot = domain.lastIndexOf(".");
    if (dot > 0 && dot < domain.length - 1) {
      const domainName = domain.slice(0, dot);
      const tld = domain.slice(dot + 1);
      const domainFirst = domainName.charAt(0) || "*";
      return `${localFirst}***@${domainFirst}***.${tld}`;
    }
    const domainFirst = domain.charAt(0) || "*";
    return `${localFirst}***@${domainFirst}***`;
  }
  if (s.length <= 4) return "***";
  return `${s.charAt(0)}***${s.charAt(s.length - 1)}`;
}

function methodLabelForRow(row) {
  const explicit = row?.payout_label != null ? String(row.payout_label).trim() : "";
  if (explicit) return explicit;
  const methodId = row?.payout_method_id != null ? String(row.payout_method_id).trim() : "";
  if (methodId) return "Saved payout method";
  return "PayPal";
}

function userLabelFromProfile(profile, fallbackUserId) {
  const name = profile?.full_name != null ? String(profile.full_name).trim() : "";
  if (name) return name;
  const email = profile?.email != null ? String(profile.email).trim() : "";
  if (email) return email;
  return fallbackUserId || "—";
}

function urgencyFor(row) {
  const reasons = [];
  const amt = Number(row?.amount);
  if (Number.isFinite(amt) && amt >= URGENT_AMOUNT_THRESHOLD) {
    reasons.push("large_amount");
  }
  const created = row?.created_at ? new Date(row.created_at).getTime() : NaN;
  if (Number.isFinite(created) && Date.now() - created >= URGENT_AGE_MS) {
    reasons.push("over_24h");
  }
  return { urgent: reasons.length > 0, urgencyReasons: reasons };
}

async function fetchWalletPage(client, from, to) {
  const primary = resolvedWalletAmountColumn || WALLET_AMOUNT_COLUMNS[0];
  const firstAttempt = await client
    .from("wallets")
    .select(`user_id, ${primary}`)
    .order("user_id", { ascending: true })
    .range(from, to);
  if (!firstAttempt.error) {
    return { data: firstAttempt.data, error: null, columnUsed: primary };
  }
  if (resolvedWalletAmountColumn || !isMissingColumnError(firstAttempt.error)) {
    return { data: null, error: firstAttempt.error, columnUsed: primary };
  }
  const fallback = WALLET_AMOUNT_COLUMNS.find((c) => c !== primary) || primary;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[adminTreasury] wallets column retry: from=${primary}, to=${fallback}`);
  }
  const retryAttempt = await client
    .from("wallets")
    .select(`user_id, ${fallback}`)
    .order("user_id", { ascending: true })
    .range(from, to);
  if (retryAttempt.error) {
    return { data: null, error: retryAttempt.error, columnUsed: fallback };
  }
  return { data: retryAttempt.data, error: null, columnUsed: fallback };
}

async function paginateWalletBalances(client) {
  let total = 0;
  let processed = 0;
  let pagesFetched = 0;
  let from = 0;
  let truncated = false;
  let partialError = null;
  let columnUsedThisRun = null;
  while (processed < LIABILITY_HARD_CAP) {
    const to = from + LIABILITY_PAGE_SIZE - 1;
    const { data, error, columnUsed } = await fetchWalletPage(client, from, to);
    if (error) {
      partialError = error;
      break;
    }
    if (!resolvedWalletAmountColumn) resolvedWalletAmountColumn = columnUsed;
    columnUsedThisRun = columnUsed;
    pagesFetched += 1;
    const rows = Array.isArray(data) ? data : [];
    if (pagesFetched === 1 && process.env.NODE_ENV !== "production") {
      const sample = rows.slice(0, 2).map((r) => ({ user_id: r?.user_id ?? null }));
      console.log(
        `[adminTreasury] wallets first page: rows=${rows.length}, columns=${columnUsed}, sample=${JSON.stringify(sample)}`,
      );
    }
    for (const r of rows) {
      total += toFiniteNumber(r?.[columnUsed]);
    }
    processed += rows.length;
    if (rows.length < LIABILITY_PAGE_SIZE) break;
    if (processed >= LIABILITY_HARD_CAP) {
      truncated = true;
      break;
    }
    from += LIABILITY_PAGE_SIZE;
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[adminTreasury] wallets aggregation: pages=${pagesFetched}, rows=${processed}, total=${total}, truncated=${truncated}`,
    );
  }
  return {
    total,
    processed,
    pagesFetched,
    truncated,
    partialError,
    resolvedColumn: columnUsedThisRun || resolvedWalletAmountColumn,
  };
}

async function fetchSummaryAndReconciliation(client, todayStartIso, todayEndIso) {
  const summary = {
    totalLiabilities: { value: null, status: STATUS.OK, rowsScanned: null },
    fundedToday: { value: null, status: STATUS.OK },
    withdrawnToday: { value: null, status: STATUS.OK },
    netInflowToday: { value: null, status: STATUS.OK },
    pendingPayoutObligations: { value: null, status: STATUS.OK, count: null },
    processingPayouts: { value: null, status: STATUS.OK, count: null },
  };
  const reconciliation = {
    fundingTotal: { value: null, status: STATUS.OK },
    sendTotal: { value: null, status: STATUS.OK },
    withdrawalTotal: { value: null, status: STATUS.OK },
    transactionsToday: { value: null, status: STATUS.OK },
    withdrawalRequestsToday: { value: null, status: STATUS.OK },
    openFraudAlerts: { value: null, status: STATUS.OK },
    openOperationalErrors: { value: null, status: STATUS.OK },
  };

  try {
    const { total, processed, pagesFetched, truncated, partialError, resolvedColumn } =
      await paginateWalletBalances(client);
    if (partialError) {
      if (pagesFetched > 0) {
        summary.totalLiabilities.value = total;
        summary.totalLiabilities.rowsScanned = processed;
        summary.totalLiabilities.status = STATUS.WARNING;
        summary.totalLiabilities.detail = "Partial result — some pages could not be read.";
      } else {
        const classified = classifyQueryError(partialError, "wallets");
        summary.totalLiabilities.status = classified.status;
        summary.totalLiabilities.value = null;
        summary.totalLiabilities.detail = classified.detail;
      }
      await logSectionFailure(client, "summary.totalLiabilities", partialError, {
        rowsScanned: processed,
        pagesFetched,
        resolvedColumn: resolvedColumn || null,
        partial: pagesFetched > 0,
      });
    } else {
      summary.totalLiabilities.value = total;
      summary.totalLiabilities.rowsScanned = processed;
      if (truncated) {
        summary.totalLiabilities.status = STATUS.WARNING;
        summary.totalLiabilities.detail = `Partial sum — capped at ${LIABILITY_HARD_CAP.toLocaleString()} wallets.`;
      }
    }
  } catch (err) {
    const classified = classifyQueryError(err, "wallets");
    summary.totalLiabilities.status = classified.status;
    summary.totalLiabilities.value = null;
    summary.totalLiabilities.detail = classified.detail;
    await logSectionFailure(client, "summary.totalLiabilities", err, {
      rowsScanned: 0,
      pagesFetched: 0,
      resolvedColumn: resolvedWalletAmountColumn,
    });
  }

  let todayFunded = 0;
  let todayWithdrawn = 0;
  let todaySent = 0;
  try {
    const { data, error } = await client
      .from("transactions")
      .select("amount, type")
      .gte("created_at", todayStartIso)
      .lte("created_at", todayEndIso)
      .limit(5000);
    if (error) throw error;
    for (const row of data || []) {
      const amt = Math.abs(toFiniteNumber(row?.amount));
      const kind = normalizeTransactionType(row?.type);
      if (kind === "fund") todayFunded += amt;
      else if (kind === "withdraw") todayWithdrawn += amt;
      else if (kind === "send") todaySent += amt;
    }
    summary.fundedToday.value = todayFunded;
    summary.withdrawnToday.value = todayWithdrawn;
    summary.netInflowToday.value = todayFunded - todayWithdrawn;
    reconciliation.fundingTotal.value = todayFunded;
    reconciliation.withdrawalTotal.value = todayWithdrawn;
    reconciliation.sendTotal.value = todaySent;
  } catch (err) {
    const classified = classifyQueryError(err);
    for (const k of ["fundedToday", "withdrawnToday", "netInflowToday"]) {
      summary[k].status = classified.status;
      summary[k].value = null;
      summary[k].detail = classified.detail;
    }
    for (const k of ["fundingTotal", "withdrawalTotal", "sendTotal"]) {
      reconciliation[k].status = classified.status;
      reconciliation[k].value = null;
      reconciliation[k].detail = classified.detail;
    }
    await logSectionFailure(client, "summary.transactionsToday", err);
  }

  try {
    const { count, error } = await client
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStartIso)
      .lte("created_at", todayEndIso);
    if (error) throw error;
    reconciliation.transactionsToday.value = typeof count === "number" ? count : 0;
  } catch (err) {
    const classified = classifyQueryError(err);
    reconciliation.transactionsToday.status = classified.status;
    reconciliation.transactionsToday.value = null;
    reconciliation.transactionsToday.detail = classified.detail;
    await logSectionFailure(client, "reconciliation.transactionsToday", err);
  }

  try {
    const { data, error } = await client
      .from("withdrawal_requests")
      .select("amount, status")
      .in("status", ["pending", "processing"])
      .limit(5000);
    if (error) throw error;
    let pendingValue = 0;
    let processingValue = 0;
    let pendingCount = 0;
    let processingCount = 0;
    for (const row of data || []) {
      const st = String(row?.status || "").toLowerCase();
      const amt = toFiniteNumber(row?.amount);
      if (st === "pending") {
        pendingValue += amt;
        pendingCount += 1;
      } else if (st === "processing") {
        processingValue += amt;
        processingCount += 1;
      }
    }
    summary.pendingPayoutObligations.value = pendingValue;
    summary.pendingPayoutObligations.count = pendingCount;
    summary.processingPayouts.value = processingValue;
    summary.processingPayouts.count = processingCount;
  } catch (err) {
    const classified = classifyQueryError(err);
    for (const k of ["pendingPayoutObligations", "processingPayouts"]) {
      summary[k].status = classified.status;
      summary[k].value = null;
      summary[k].count = null;
      summary[k].detail = classified.detail;
    }
    await logSectionFailure(client, "summary.payoutObligations", err);
  }

  try {
    const { count, error } = await client
      .from("withdrawal_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStartIso)
      .lte("created_at", todayEndIso);
    if (error) throw error;
    reconciliation.withdrawalRequestsToday.value = typeof count === "number" ? count : 0;
  } catch (err) {
    const classified = classifyQueryError(err);
    reconciliation.withdrawalRequestsToday.status = classified.status;
    reconciliation.withdrawalRequestsToday.value = null;
    reconciliation.withdrawalRequestsToday.detail = classified.detail;
    await logSectionFailure(client, "reconciliation.withdrawalRequestsToday", err);
  }

  try {
    const { count, error } = await client
      .from("fraud_logs")
      .select("id", { count: "exact", head: true })
      .eq("status", "open");
    if (error) throw error;
    reconciliation.openFraudAlerts.value = typeof count === "number" ? count : 0;
  } catch (err) {
    const classified = classifyQueryError(err);
    reconciliation.openFraudAlerts.status = classified.status;
    reconciliation.openFraudAlerts.value = null;
    reconciliation.openFraudAlerts.detail = classified.detail;
    await logSectionFailure(client, "reconciliation.openFraudAlerts", err);
  }

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await client
      .from("operational_logs")
      .select("id", { count: "exact", head: true })
      .eq("level", "error")
      .gte("created_at", since24h);
    if (error) throw error;
    reconciliation.openOperationalErrors.value = typeof count === "number" ? count : 0;
  } catch (err) {
    const classified = classifyQueryError(err);
    reconciliation.openOperationalErrors.status = classified.status;
    reconciliation.openOperationalErrors.value = null;
    reconciliation.openOperationalErrors.detail = classified.detail;
    await logSectionFailure(client, "reconciliation.openOperationalErrors", err);
  }

  return { summary, reconciliation };
}

async function fetchTritonTransfers(client) {
  const result = {
    pendingToTriton: { value: 0, status: STATUS.OK },
    pendingFromTriton: { value: 0, status: STATUS.OK },
    processingTotal: { value: 0, status: STATUS.OK },
    status: STATUS.OK,
  };
  try {
    const { data, error } = await client
      .from("triton_transfer_requests")
      .select("amount, direction, status")
      .in("status", ["pending", "processing"])
      .limit(5000);
    if (error) throw error;
    let pendingTo = 0;
    let pendingFrom = 0;
    let processingTotal = 0;
    for (const row of data || []) {
      const amt = toFiniteNumber(row?.amount);
      const st = String(row?.status || "").toLowerCase();
      const dir = String(row?.direction || "").toLowerCase();
      if (st === "pending" && dir === "to_triton") pendingTo += amt;
      else if (st === "pending" && dir === "from_triton") pendingFrom += amt;
      if (st === "processing") processingTotal += amt;
    }
    result.pendingToTriton.value = pendingTo;
    result.pendingFromTriton.value = pendingFrom;
    result.processingTotal.value = processingTotal;
    return result;
  } catch (err) {
    const classified = classifyQueryError(err);
    await logSectionFailure(client, "tritonTransfers", err);
    const detail = classified.detail;
    return {
      pendingToTriton: { value: 0, status: classified.status, detail },
      pendingFromTriton: { value: 0, status: classified.status, detail },
      processingTotal: { value: 0, status: classified.status, detail },
      status: classified.status,
      detail,
    };
  }
}

async function fetchPayoutExposure(client) {
  try {
    const { data, error } = await client
      .from("withdrawal_requests")
      .select(
        "id, user_id, amount, status, created_at, payout_email, payout_destination, payout_method_id, payout_label",
      )
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(PAYOUT_EXPOSURE_LIMIT);
    if (error) throw error;
    const requestRows = Array.isArray(data) ? data : [];
    const userIds = [...new Set(requestRows.map((r) => r?.user_id).filter(Boolean))];
    let profilesById = {};
    if (userIds.length > 0) {
      try {
        const { data: profs, error: profErr } = await client
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);
        if (profErr) throw profErr;
        profilesById = Object.fromEntries((profs || []).map((p) => [String(p.id), p]));
      } catch (profErr) {
        await logSectionFailure(client, "payoutExposure.profiles", profErr);
      }
    }
    const rows = requestRows.map((r) => {
      const userId = r?.user_id ? String(r.user_id) : "";
      const profile = userId ? profilesById[userId] : null;
      const rawDestination = r?.payout_email || r?.payout_destination || "";
      const { urgent, urgencyReasons } = urgencyFor(r);
      return {
        id: String(r.id),
        userId,
        userLabel: userLabelFromProfile(profile, userId),
        amount: toFiniteNumber(r.amount),
        status: String(r.status || "").toLowerCase(),
        createdAt: r.created_at,
        methodLabel: methodLabelForRow(r),
        destinationMasked: maskPayoutDestination(rawDestination),
        urgent,
        urgencyReasons,
      };
    });
    return { rows, status: STATUS.OK };
  } catch (err) {
    const classified = classifyQueryError(err);
    await logSectionFailure(client, "payoutExposure", err);
    return { rows: [], status: classified.status, detail: classified.detail };
  }
}

function emptyDailyRows() {
  const rows = [];
  for (let i = DAILY_WINDOW_DAYS - 1; i >= 0; i -= 1) {
    const day = startOfDaysAgoLocal(i);
    rows.push({
      date: localDateKey(day),
      funded: 0,
      withdrawn: 0,
      sent: 0,
      net: 0,
      withdrawalRequestsCount: 0,
      fraudAlertsCount: 0,
    });
  }
  return rows;
}

function bucketByDate(rows, dateField) {
  const map = new Map();
  for (const r of rows || []) {
    const ts = r?.[dateField];
    if (!ts) continue;
    const key = localDateKey(new Date(ts));
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

async function fetchDailyReconciliation(client) {
  const baseRows = emptyDailyRows();
  const windowStart = startOfDaysAgoLocal(DAILY_WINDOW_DAYS - 1);
  const windowEnd = endOfTodayLocal();
  const startIso = windowStart.toISOString();
  const endIso = windowEnd.toISOString();

  let txError = null;
  let wrError = null;
  let fraudError = null;
  let txRows = [];
  let wrRows = [];
  let fraudRows = [];

  try {
    const { data, error } = await client
      .from("transactions")
      .select("amount, type, created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .limit(20000);
    if (error) throw error;
    txRows = Array.isArray(data) ? data : [];
  } catch (err) {
    txError = err;
    await logSectionFailure(client, "daily.transactions", err);
  }

  try {
    const { data, error } = await client
      .from("withdrawal_requests")
      .select("id, created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .limit(5000);
    if (error) throw error;
    wrRows = Array.isArray(data) ? data : [];
  } catch (err) {
    wrError = err;
    await logSectionFailure(client, "daily.withdrawalRequests", err);
  }

  try {
    const { data, error } = await client
      .from("fraud_logs")
      .select("id, created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso)
      .limit(5000);
    if (error) throw error;
    fraudRows = Array.isArray(data) ? data : [];
  } catch (err) {
    fraudError = err;
    await logSectionFailure(client, "daily.fraudLogs", err);
  }

  const txByDate = bucketByDate(txRows, "created_at");
  const wrByDate = bucketByDate(wrRows, "created_at");
  const fraudByDate = bucketByDate(fraudRows, "created_at");

  const rows = baseRows.map((row) => {
    const txList = txByDate.get(row.date) || [];
    let funded = 0;
    let withdrawn = 0;
    let sent = 0;
    for (const t of txList) {
      const amt = Math.abs(toFiniteNumber(t?.amount));
      const kind = normalizeTransactionType(t?.type);
      if (kind === "fund") funded += amt;
      else if (kind === "withdraw") withdrawn += amt;
      else if (kind === "send") sent += amt;
    }
    const withdrawalRequestsCount = (wrByDate.get(row.date) || []).length;
    const fraudAlertsCount = (fraudByDate.get(row.date) || []).length;
    return {
      ...row,
      funded,
      withdrawn,
      sent,
      net: funded - withdrawn,
      withdrawalRequestsCount,
      fraudAlertsCount,
    };
  });

  const firstErr = txError || wrError || fraudError;
  if (firstErr) {
    const classified = classifyQueryError(firstErr);
    return { rows, status: classified.status, detail: classified.detail };
  }
  return { rows, status: STATUS.OK };
}

/**
 * Build the full treasury snapshot. Returns a plain object the UI can render
 * incrementally — each sub-result carries its own status, so one section
 * failing (e.g. a missing table or RLS gap) does not blank the whole page.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient]
 */
export async function fetchTreasurySnapshot(supabaseClient = defaultClient) {
  const client = supabaseClient || defaultClient;
  const todayStart = startOfTodayLocal();
  const todayEnd = endOfTodayLocal();
  const todayStartIso = todayStart.toISOString();
  const todayEndIso = todayEnd.toISOString();

  const [{ summary, reconciliation }, payoutExposure, daily, tritonTransfers] = await Promise.all([
    fetchSummaryAndReconciliation(client, todayStartIso, todayEndIso),
    fetchPayoutExposure(client),
    fetchDailyReconciliation(client),
    fetchTritonTransfers(client),
  ]);

  return {
    summary,
    reconciliation,
    payoutExposure,
    daily,
    tritonTransfers,
    generatedAt: new Date().toISOString(),
  };
}

export const TREASURY_STATUS = STATUS;
export const TREASURY_URGENCY = Object.freeze({
  AMOUNT_THRESHOLD: URGENT_AMOUNT_THRESHOLD,
  AGE_MS: URGENT_AGE_MS,
});
