/**
 * Phase 6: read-only PayPal settlement evidence probe.
 * Does not create orders/captures. Does not mutate wallets or journals.
 * Never prints secrets, PAN, CVV, tokens, or full unnecessary UUIDs.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const resultsDir = path.join(root, "data", "results");

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
  const p = path.join(resultsDir, name);
  fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  return p;
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

async function getAccessToken() {
  const clientId = env.PAYPAL_CLIENT_ID;
  const clientSecret = env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("missing PayPal credentials");
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `token failed (${res.status})`);
  }
  return json.access_token;
}

async function paypalGet(token, pathAndQuery) {
  const res = await fetch(`${apiBase()}${pathAndQuery}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
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
  return { ok: res.ok, status: res.status, json };
}

const host = apiBase().replace(/^https?:\/\//, "").split("/")[0];
if (modeLabel() === "live" || host === "api-m.paypal.com" || !host.includes("sandbox.paypal.com")) {
  throw new Error("refuse live or non-sandbox PayPal probe");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("missing supabase service credentials");

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let gitHead = null;
let gitBranch = null;
try {
  gitHead = execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
  gitBranch = execSync("git branch --show-current", { cwd: root }).toString().trim();
} catch {
  /* ignore */
}

const { data: order, error: orderErr } = await admin
  .from("paypal_funding_orders")
  .select(
    "id, provider_order_id, provider_capture_id, amount, currency, status, ledger_posting_status, transaction_id, completed_at"
  )
  .eq("status", "completed")
  .like("provider_order_id", "0PD5%")
  .limit(1)
  .maybeSingle();

if (orderErr || !order?.provider_capture_id) {
  throw new Error(`certified order lookup failed: ${orderErr?.message || "missing"}`);
}

const captureId = order.provider_capture_id;
const orderId = order.provider_order_id;
const amount = Number(order.amount);
const token = await getAccessToken();

const probes = {
  getOrder: null,
  getCapture: null,
  reportingTransactionsByCapture: null,
  reportingTransactionsByOrder: null,
  reportingBalances: null,
};

{
  const r = await paypalGet(token, `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  const capture = r.json?.purchase_units?.[0]?.payments?.captures?.[0] || null;
  probes.getOrder = {
    ok: r.ok,
    httpStatus: r.status,
    status: r.json?.status || null,
    captureStatus: capture?.status || null,
    captureIdMasked: maskId(capture?.id || null),
    amountValue: capture?.amount?.value || null,
    currency: capture?.amount?.currency_code || null,
    hasSellerReceivableBreakdown: Boolean(capture?.seller_receivable_breakdown),
    sellerReceivable: capture?.seller_receivable_breakdown
      ? {
          gross: capture.seller_receivable_breakdown.gross_amount?.value || null,
          fee: capture.seller_receivable_breakdown.paypal_fee?.value || null,
          net: capture.seller_receivable_breakdown.net_amount?.value || null,
          currency: capture.seller_receivable_breakdown.gross_amount?.currency_code || null,
        }
      : null,
    interpretsAsSettlementToBankOrTreasury: false,
    note: "Order/capture COMPLETED is Phase 4/5 capture evidence only; not bank settlement.",
  };
}

{
  const r = await paypalGet(token, `/v2/payments/captures/${encodeURIComponent(captureId)}`);
  const srb = r.json?.seller_receivable_breakdown || null;
  probes.getCapture = {
    ok: r.ok,
    httpStatus: r.status,
    captureStatus: r.json?.status || null,
    amountValue: r.json?.amount?.value || null,
    currency: r.json?.amount?.currency_code || null,
    hasSellerReceivableBreakdown: Boolean(srb),
    sellerReceivable: srb
      ? {
          gross: srb.gross_amount?.value || null,
          fee: srb.paypal_fee?.value || null,
          net: srb.net_amount?.value || null,
          currency: srb.gross_amount?.currency_code || null,
        }
      : null,
    disbursementMode: r.json?.disbursement_mode || null,
    interpretsAsSettlementToBankOrTreasury: false,
    note: "seller_receivable_breakdown is capture fee/net receivable metadata, not proof of bank/treasury settlement.",
  };
}

const end = new Date();
const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
const startIso = start.toISOString();
const endIso = end.toISOString();

{
  const q = new URLSearchParams({
    start_date: startIso,
    end_date: endIso,
    transaction_id: captureId,
    fields: "all",
    page_size: "10",
    page: "1",
  });
  const r = await paypalGet(token, `/v1/reporting/transactions?${q.toString()}`);
  const details = Array.isArray(r.json?.transaction_details) ? r.json.transaction_details : [];
  probes.reportingTransactionsByCapture = {
    ok: r.ok,
    httpStatus: r.status,
    errorName: r.json?.name || r.json?.error || null,
    errorMessage: r.json?.message || r.json?.error_description || null,
    transactionCount: details.length,
    sampleEventCodes: details
      .slice(0, 5)
      .map((d) => d?.transaction_info?.transaction_event_code || null)
      .filter(Boolean),
    authoritativeSettlementEvidence: r.ok && details.length > 0,
  };
}

{
  const q = new URLSearchParams({
    start_date: startIso,
    end_date: endIso,
    transaction_id: orderId,
    fields: "all",
    page_size: "10",
    page: "1",
  });
  const r = await paypalGet(token, `/v1/reporting/transactions?${q.toString()}`);
  const details = Array.isArray(r.json?.transaction_details) ? r.json.transaction_details : [];
  probes.reportingTransactionsByOrder = {
    ok: r.ok,
    httpStatus: r.status,
    errorName: r.json?.name || r.json?.error || null,
    errorMessage: r.json?.message || r.json?.error_description || null,
    transactionCount: details.length,
    authoritativeSettlementEvidence: r.ok && details.length > 0,
  };
}

{
  const q = new URLSearchParams({
    as_of_time: endIso,
    currency_code: "USD",
  });
  const r = await paypalGet(token, `/v1/reporting/balances?${q.toString()}`);
  probes.reportingBalances = {
    ok: r.ok,
    httpStatus: r.status,
    errorName: r.json?.name || r.json?.error || null,
    errorMessage: r.json?.message || r.json?.error_description || null,
    hasBalances: Array.isArray(r.json?.balances) && r.json.balances.length > 0,
    note: "Account balance snapshot alone does not prove capture-level settlement linkage.",
  };
}

const captureFeeEvidenceAvailable = Boolean(
  probes.getCapture?.hasSellerReceivableBreakdown || probes.getOrder?.hasSellerReceivableBreakdown
);
const reportingSettlementEvidenceAvailable = Boolean(
  probes.reportingTransactionsByCapture?.authoritativeSettlementEvidence ||
    probes.reportingTransactionsByOrder?.authoritativeSettlementEvidence
);
const authoritativeSettlementEvidenceAvailable = reportingSettlementEvidenceAvailable;

const { data: accounts } = await admin
  .from("ledger_accounts")
  .select("id, code")
  .in("code", ["paypal_processor_clearing", "treasury_cash", "user_wallet_liability"]);
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

const audit = {
  phase: "phase6_paypal_settlement_audit",
  timestamp: new Date().toISOString(),
  git: { branch: gitBranch, head: gitHead },
  paypal: {
    mode: modeLabel(),
    apiBaseHost: host,
    isSandboxHost: host.includes("sandbox.paypal.com"),
    refuseLive: true,
  },
  certifiedEvent: {
    orderIdMasked: maskId(orderId),
    captureIdMasked: maskId(captureId),
    transactionIdMasked: maskId(order.transaction_id),
    amount,
    currency: order.currency,
    fundingOrderStatus: order.status,
    ledgerPostingStatus: order.ledger_posting_status,
  },
  integrationCapabilities: {
    createOrder: true,
    getOrder: true,
    captureOrder: true,
    getCapture: "probed_ad_hoc",
    reportingTransactions: "probed_ad_hoc",
    reportingBalances: "probed_ad_hoc",
    settlementReportIngestion: false,
    settlementTable: false,
    settlementJournalRpc: false,
  },
  probes,
  evidenceClassification: {
    captureCompletedEvidenceAvailable: probes.getCapture?.ok === true || probes.getOrder?.ok === true,
    captureFeeBreakdownAvailable: captureFeeEvidenceAvailable,
    captureFeeIsSettlementEvidence: false,
    reportingOrSettlementEvidenceAvailable: reportingSettlementEvidenceAvailable,
    authoritativeSettlementEvidenceAvailable,
    reasonIfUnavailable: authoritativeSettlementEvidenceAvailable
      ? null
      : "No authoritative PayPal reporting/settlement transaction evidence linked to the certified capture. Capture COMPLETED and optional seller_receivable_breakdown prove capture/fee metadata only, not clearing→treasury_cash settlement.",
  },
  ledgerSnapshot: {
    paypal_processor_clearing_net_debit: Number((clearing.debit - clearing.credit).toFixed(2)),
    treasury_cash_net_debit: Number((treasury.debit - treasury.credit).toFixed(2)),
    certifiedAmountStillInClearing: amount,
  },
  chartOfAccounts: {
    clearing: "paypal_processor_clearing",
    proposedSettlementCash: "treasury_cash",
    feeExpenseExists: false,
    feeRevenueExists: true,
    feeRevenueCode: "fees_revenue",
    note: "No payment_processing_fees expense account exists yet. Do not invent fees without provider evidence.",
  },
};

writeJson("phase6_paypal_settlement_audit.json", audit);

console.log(
  JSON.stringify(
    {
      ok: true,
      authoritativeSettlementEvidenceAvailable,
      captureFeeBreakdownAvailable: captureFeeEvidenceAvailable,
      clearingNetDebit: audit.ledgerSnapshot.paypal_processor_clearing_net_debit,
      captureStatus: probes.getCapture?.captureStatus || probes.getOrder?.captureStatus || null,
      reportingCaptureHttp: probes.reportingTransactionsByCapture?.httpStatus || null,
      reportingBalancesHttp: probes.reportingBalances?.httpStatus || null,
      getCaptureHttp: probes.getCapture?.httpStatus || null,
      sellerReceivable: probes.getCapture?.sellerReceivable || probes.getOrder?.sellerReceivable || null,
    },
    null,
    2
  )
);
