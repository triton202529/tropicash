/**
 * Phase 7 continuation: re-probe reporting after Transaction Search enablement.
 * Sandbox only. No captures, no journal posts, no wallet mutation.
 * Never prints access tokens, secrets, or Authorization headers.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const resultsDir = path.join(root, "data", "results");

const REQUIRED = {
  search: "https://uri.paypal.com/services/reporting/search/read",
  balances: "https://uri.paypal.com/services/reporting/balances/read",
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const fileEnv = {
  ...loadEnvFile(path.join(root, ".env")),
  ...loadEnvFile(path.join(root, ".env.local")),
};
for (const [k, v] of Object.entries(fileEnv)) {
  if (process.env[k] == null || process.env[k] === "") process.env[k] = v;
}
const env = { ...fileEnv, ...process.env };

function maskId(id) {
  if (!id || typeof id !== "string") return null;
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function writeJson(name, data) {
  fs.mkdirSync(resultsDir, { recursive: true });
  fs.writeFileSync(path.join(resultsDir, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function modeLabel() {
  return String(env.PAYPAL_MODE || env.NEXT_PUBLIC_PAYPAL_MODE || "sandbox").toLowerCase() === "live"
    ? "live"
    : "sandbox";
}

function apiBase() {
  const explicit = env.PAYPAL_API_BASE;
  if (explicit && String(explicit).trim()) return String(explicit).replace(/\/$/, "");
  return modeLabel() === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

function parseScopes(scope) {
  if (!scope) return [];
  if (Array.isArray(scope)) return scope.map(String).filter(Boolean);
  return String(scope).split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

const host = apiBase().replace(/^https?:\/\//, "").split("/")[0];
if (modeLabel() === "live" || host === "api-m.paypal.com" || !host.includes("sandbox.paypal.com")) {
  throw new Error("refuse live or non-sandbox PayPal probe");
}

const clientId = env.PAYPAL_CLIENT_ID;
const clientSecret = env.PAYPAL_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error("missing PayPal credentials");

const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

async function requestToken() {
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `token failed (${res.status})`);
  }
  return {
    token: json.access_token,
    scopes: parseScopes(json.scope).sort(),
    expiresIn: json.expires_in ?? null,
    tokenType: json.token_type || null,
  };
}

async function terminateToken(token) {
  const res = await fetch(`${apiBase()}/v1/oauth2/token/terminate`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `token=${encodeURIComponent(token)}`,
  });
  return { ok: res.ok, status: res.status };
}

let first = await requestToken();
const firstHasSearch = first.scopes.includes(REQUIRED.search);
const firstHasBalances = first.scopes.includes(REQUIRED.balances);
let terminateResult = null;
let token = first;

if (!firstHasSearch || !firstHasBalances) {
  // Feature may be enabled but cached token still lacks scopes.
  terminateResult = await terminateToken(first.token);
  first.token = null; // drop reference
  token = await requestToken();
}

const scopes = token.scopes;
const hasSearch = scopes.includes(REQUIRED.search);
const hasBalances = scopes.includes(REQUIRED.balances);

async function paypalGet(pathAndQuery) {
  const res = await fetch(`${apiBase()}${pathAndQuery}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token.token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { _nonJson: true, length: text.length };
    }
  }
  return {
    ok: res.ok,
    status: res.status,
    json,
    debugIdMasked: maskId(String(res.headers.get("paypal-debug-id") || json?.debug_id || "")),
  };
}

const end = new Date();
const start = new Date(Date.UTC(2026, 10, 1, 0, 0, 0)); // Nov 1 2026 covers Phase 4 event
const txQ = new URLSearchParams({
  start_date: start.toISOString(),
  end_date: end.toISOString(),
  fields: "all",
  page_size: "100",
  page: "1",
});
const balQ = new URLSearchParams({
  as_of_time: end.toISOString(),
  currency_code: "USD",
});

const txProbe = await paypalGet(`/v1/reporting/transactions?${txQ.toString()}`);
const balProbe = await paypalGet(`/v1/reporting/balances?${balQ.toString()}`);

// Resolve certified event IDs from DB (masked in output)
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("missing supabase service credentials");
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: order } = await admin
  .from("paypal_funding_orders")
  .select("provider_order_id, provider_capture_id, amount, currency, status")
  .eq("status", "completed")
  .like("provider_order_id", "0PD5%")
  .limit(1)
  .maybeSingle();

const captureId = order?.provider_capture_id || null;
const orderId = order?.provider_order_id || null;
const certifiedAmount = order ? Number(order.amount) : 5.25;

let certifiedVisible = false;
let matchedTx = null;
const details = Array.isArray(txProbe.json?.transaction_details) ? txProbe.json.transaction_details : [];

function extractAmounts(info) {
  if (!info) return { gross: null, fee: null, net: null, currency: null };
  const gross = info.transaction_amount?.value ?? info.transaction_amount ?? null;
  const fee = info.fee_amount?.value ?? info.fee_amount ?? null;
  let net = null;
  if (gross != null && fee != null && !Number.isNaN(Number(gross)) && !Number.isNaN(Number(fee))) {
    net = (Number(gross) - Number(fee)).toFixed(2);
  }
  return {
    gross: gross != null ? String(gross) : null,
    fee: fee != null ? String(fee) : null,
    net,
    currency: info.transaction_amount?.currency_code || info.fee_amount?.currency_code || null,
  };
}

if (captureId || orderId) {
  for (const d of details) {
    const info = d?.transaction_info || {};
    const tid = info.transaction_id || null;
    const ref = info.paypal_reference_id || null;
    const custom = info.custom_field || null;
    const hit =
      (captureId && (tid === captureId || ref === captureId)) ||
      (orderId && (tid === orderId || ref === orderId || custom === orderId));
    if (hit) {
      certifiedVisible = true;
      const amts = extractAmounts(info);
      matchedTx = {
        transactionIdMasked: maskId(String(tid || "")),
        referenceIdMasked: maskId(String(ref || "")),
        eventCode: info.transaction_event_code || null,
        status: info.transaction_status || null,
        initiationDate: info.transaction_initiation_date || null,
        ...amts,
      };
      break;
    }
  }
}

// Also try targeted lookup by capture id if list did not include it
let targetedTxProbe = null;
if (!certifiedVisible && captureId && txProbe.status === 200) {
  const q = new URLSearchParams({
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    transaction_id: captureId,
    fields: "all",
    page_size: "20",
    page: "1",
  });
  targetedTxProbe = await paypalGet(`/v1/reporting/transactions?${q.toString()}`);
  const tdetails = Array.isArray(targetedTxProbe.json?.transaction_details)
    ? targetedTxProbe.json.transaction_details
    : [];
  if (tdetails.length > 0) {
    certifiedVisible = true;
    const info = tdetails[0]?.transaction_info || {};
    const amts = extractAmounts(info);
    matchedTx = {
      transactionIdMasked: maskId(String(info.transaction_id || captureId)),
      referenceIdMasked: maskId(String(info.paypal_reference_id || "")),
      eventCode: info.transaction_event_code || null,
      status: info.transaction_status || null,
      initiationDate: info.transaction_initiation_date || null,
      lookup: "by_transaction_id",
      ...amts,
    };
  }
}

let balanceResult = null;
if (balProbe.status === 200 && Array.isArray(balProbe.json?.balances)) {
  balanceResult = {
    count: balProbe.json.balances.length,
    currencies: balProbe.json.balances.map((b) => b.currency || b.currency_code || null).filter(Boolean),
    // Do not dump full balances; summarize total available if present
    samples: balProbe.json.balances.slice(0, 3).map((b) => ({
      currency: b.currency || b.currency_code || null,
      totalBalance: b.total_balance?.value ?? b.total_balance ?? null,
      availableBalance: b.available_balance?.value ?? b.available_balance ?? null,
      withheldBalance: b.withheld_balance?.value ?? b.withheld_balance ?? null,
    })),
  };
}

const { data: accounts } = await admin
  .from("ledger_accounts")
  .select("id, code")
  .in("code", ["paypal_processor_clearing", "treasury_cash"]);
const byId = Object.fromEntries((accounts || []).map((a) => [a.id, a.code]));
const { data: lines } = await admin.from("journal_lines").select("debit, credit, account_id");
const clearing = { debit: 0, credit: 0 };
const treasury = { debit: 0, credit: 0 };
for (const l of lines || []) {
  const code = byId[l.account_id];
  if (code === "paypal_processor_clearing") {
    clearing.debit += Number(l.debit || 0);
    clearing.credit += Number(l.credit || 0);
  }
  if (code === "treasury_cash") {
    treasury.debit += Number(l.debit || 0);
    treasury.credit += Number(l.credit || 0);
  }
}
const { count: settlementJournalCount } = await admin
  .from("journal_entries")
  .select("id", { count: "exact", head: true })
  .or("source_type.ilike.%settlement%,entry_type.ilike.%settlement%");

let gitHead = null;
try {
  gitHead = execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
} catch {
  /* ignore */
}

const furtherEntitlementRequired =
  (hasSearch && txProbe.status === 403) ||
  (hasBalances && balProbe.status === 403) ||
  (!hasSearch && !hasBalances);

const out = {
  phase: "phase7_paypal_reporting_reprobe_after_transaction_search_enable",
  timestamp: new Date().toISOString(),
  gitHead,
  environment: {
    mode: modeLabel(),
    apiBaseHost: host,
    isSandboxHost: true,
  },
  tokenRefresh: {
    firstTokenHadSearchScope: firstHasSearch,
    firstTokenHadBalancesScope: firstHasBalances,
    terminatedCachedToken: Boolean(terminateResult),
    terminateHttpStatus: terminateResult?.status ?? null,
    // True only when terminate+refresh changes scope presence (cached stale token was the issue).
    tokenCachingAppearsInvolved:
      Boolean(terminateResult) &&
      ((firstHasSearch !== hasSearch) || (firstHasBalances !== hasBalances)),
    cachedTokenTerminated: Boolean(terminateResult),
    freshTokenStillLacksReportingScopes: !hasSearch && !hasBalances,
    freshTokenHasSearchScope: hasSearch,
    freshTokenHasBalancesScope: hasBalances,
  },
  reportingScopes: {
    searchRead: hasSearch ? "PRESENT" : "ABSENT",
    balancesRead: hasBalances ? "PRESENT" : "ABSENT",
    actualReportingScopes: scopes.filter((s) => s.includes("/reporting/")),
    actualGrantedScopeNames: scopes,
  },
  probes: {
    reportingTransactions: {
      httpStatus: txProbe.status,
      ok: txProbe.ok,
      paypalErrorName: txProbe.json?.name || null,
      paypalErrorMessage: txProbe.json?.message || null,
      debugIdMasked: txProbe.debugIdMasked,
      transactionDetailCount: details.length,
    },
    reportingTransactionsTargeted: targetedTxProbe
      ? {
          httpStatus: targetedTxProbe.status,
          ok: targetedTxProbe.ok,
          paypalErrorName: targetedTxProbe.json?.name || null,
          detailCount: Array.isArray(targetedTxProbe.json?.transaction_details)
            ? targetedTxProbe.json.transaction_details.length
            : 0,
        }
      : null,
    reportingBalances: {
      httpStatus: balProbe.status,
      ok: balProbe.ok,
      paypalErrorName: balProbe.json?.name || null,
      paypalErrorMessage: balProbe.json?.message || null,
      debugIdMasked: balProbe.debugIdMasked,
      balanceResult,
    },
  },
  certifiedEvent: {
    orderIdMasked: maskId(orderId),
    captureIdMasked: maskId(captureId),
    expectedAmount: certifiedAmount,
    visibleInReporting: certifiedVisible,
    matchedTransaction: matchedTx,
  },
  furtherPayPalAccountEntitlementRequired: furtherEntitlementRequired,
  tokenCachingRuledOut: Boolean(terminateResult) && !hasSearch && !hasBalances,
  transactionSearchEnabledOnApp: true,
  classification: furtherEntitlementRequired
    ? "TROPICASH_PHASE7_PAYPAL_SUPPORT_REQUIRED"
    : "TROPICASH_PHASE7_REPORTING_ACCESS_AVAILABLE",
  CARD_PAYOUT_STATUS: "REQUIRES_ACQUIRER_SPONSOR",
  accountingUnchanged: {
    paypal_processor_clearing_net_debit: Number((clearing.debit - clearing.credit).toFixed(2)),
    treasury_cash_net_debit: Number((treasury.debit - treasury.credit).toFixed(2)),
    feePosted: 0,
    settlementJournalCount: settlementJournalCount ?? 0,
  },
};

// Drop token from memory before writing
token.token = null;

writeJson("phase7_paypal_reporting_reprobe.json", out);

console.log(
  JSON.stringify(
    {
      reportingScopes: {
        searchRead: out.reportingScopes.searchRead,
        balancesRead: out.reportingScopes.balancesRead,
        actualReportingScopes: out.reportingScopes.actualReportingScopes,
      },
      grantedScopeNames: scopes,
      transactionSearchHttp: txProbe.status,
      balanceApiHttp: balProbe.status,
      certifiedVisible,
      matchedTransaction: matchedTx,
      balanceResult,
      tokenCachingAppearsInvolved: out.tokenRefresh.tokenCachingAppearsInvolved,
      cachedTokenTerminated: out.tokenRefresh.cachedTokenTerminated,
      freshTokenStillLacksReportingScopes: out.tokenRefresh.freshTokenStillLacksReportingScopes,
      firstTokenScopes: { search: firstHasSearch, balances: firstHasBalances },
      freshTokenScopes: { search: hasSearch, balances: hasBalances },
      furtherEntitlementRequired,
      accounting: out.accountingUnchanged,
    },
    null,
    2
  )
);
