/**
 * Phase 7: PayPal reporting access enablement audit.
 * Sandbox-only. Does not create captures, post journals, or mutate wallets.
 * Never prints tokens, secrets, Authorization headers, or full unnecessary IDs.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const resultsDir = path.join(root, "data", "results");

const REQUIRED_SCOPES = {
  transactions: "https://uri.paypal.com/services/reporting/search/read",
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

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function parseScopeString(scope) {
  if (!scope) return [];
  if (Array.isArray(scope)) return scope.map(String).filter(Boolean);
  return String(scope)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function classifyScope(actualScopes, required) {
  if (actualScopes.includes(required)) return "PRESENT";
  return "ABSENT";
}

const host = apiBase().replace(/^https?:\/\//, "").split("/")[0];
if (modeLabel() === "live" || host === "api-m.paypal.com" || !host.includes("sandbox.paypal.com")) {
  throw new Error("refuse live or non-sandbox PayPal probe");
}

const clientId = env.PAYPAL_CLIENT_ID;
const clientSecret = env.PAYPAL_CLIENT_SECRET;
if (!clientId || !clientSecret) throw new Error("missing PayPal credentials");

let gitHead = null;
let gitBranch = null;
try {
  gitHead = execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
  gitBranch = execSync("git branch --show-current", { cwd: root }).toString().trim();
} catch {
  /* ignore */
}

const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
const tokenRes = await fetch(`${apiBase()}/v1/oauth2/token`, {
  method: "POST",
  headers: {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: "grant_type=client_credentials",
});
const tokenJson = await tokenRes.json().catch(() => ({}));
if (!tokenRes.ok || !tokenJson.access_token) {
  throw new Error(tokenJson.error_description || tokenJson.error || `token failed (${tokenRes.status})`);
}

const accessToken = tokenJson.access_token;
const scopeFromTokenResponse = parseScopeString(tokenJson.scope);
const jwtPayload = decodeJwtPayload(accessToken);
const scopeFromJwt = parseScopeString(jwtPayload?.scope || jwtPayload?.scp);
const actualScopes = Array.from(new Set([...scopeFromTokenResponse, ...scopeFromJwt])).sort();

// Never retain raw token after extracting scopes.
const tokenMeta = {
  tokenType: tokenJson.token_type || null,
  expiresIn: tokenJson.expires_in ?? null,
  appIdClaimMasked: maskId(String(jwtPayload?.app_id || jwtPayload?.azp || "")),
  issuer: jwtPayload?.iss || null,
  // PayPal may include payer_id / merchant claims; sanitize only.
  payerIdMasked: maskId(String(jwtPayload?.payer_id || "")),
  hasAccessToken: true,
  accessTokenLogged: false,
};

const requiredScopeStatus = {
  [REQUIRED_SCOPES.transactions]: classifyScope(actualScopes, REQUIRED_SCOPES.transactions),
  [REQUIRED_SCOPES.balances]: classifyScope(actualScopes, REQUIRED_SCOPES.balances),
};

const reportingScopesPresent = Object.values(requiredScopeStatus).every((s) => s === "PRESENT");
const reportingScopesAbsent = Object.values(requiredScopeStatus).some((s) => s === "ABSENT");

async function paypalGet(pathAndQuery) {
  const res = await fetch(`${apiBase()}${pathAndQuery}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
const txQuery = new URLSearchParams({
  start_date: start.toISOString(),
  end_date: end.toISOString(),
  fields: "transaction_info",
  page_size: "1",
  page: "1",
});
const balQuery = new URLSearchParams({
  as_of_time: end.toISOString(),
  currency_code: "USD",
});

const txProbe = await paypalGet(`/v1/reporting/transactions?${txQuery.toString()}`);
const balProbe = await paypalGet(`/v1/reporting/balances?${balQuery.toString()}`);

if (txProbe.status === 200 || balProbe.status === 200) {
  // Preserve structure for review; do not proceed to accounting.
  writeJson("phase7_paypal_reporting_unexpected_200.json", {
    note: "Reporting endpoint returned 200. Stop before any accounting action.",
    transactionsHttpStatus: txProbe.status,
    balancesHttpStatus: balProbe.status,
    transactionsKeys: txProbe.json && typeof txProbe.json === "object" ? Object.keys(txProbe.json) : [],
    balancesKeys: balProbe.json && typeof balProbe.json === "object" ? Object.keys(balProbe.json) : [],
    transactionCount: Array.isArray(txProbe.json?.transaction_details)
      ? txProbe.json.transaction_details.length
      : null,
    hasBalancesArray: Array.isArray(balProbe.json?.balances),
  });
}

function sanitizeProbe(label, probe) {
  return {
    endpoint: label,
    httpStatus: probe.status,
    ok: probe.ok,
    paypalErrorName: probe.json?.name || probe.json?.error || null,
    paypalErrorMessage: probe.json?.message || probe.json?.error_description || null,
    debugIdMasked: probe.debugIdMasked,
    usableSettlementEvidenceReturned: probe.ok === true && probe.status === 200,
  };
}

const tokenAudit = {
  phase: "phase7_paypal_reporting_token_audit",
  timestamp: new Date().toISOString(),
  git: { branch: gitBranch, head: gitHead },
  environment: {
    mode: modeLabel(),
    apiBaseHost: host,
    oauthTokenEndpoint: `${host}/v1/oauth2/token`,
    isSandboxHost: host.includes("sandbox.paypal.com"),
    refuseLive: true,
  },
  application: {
    clientIdMasked: maskId(clientId),
    clientSecretPresent: Boolean(clientSecret && String(clientSecret).trim()),
    clientSecretLogged: false,
    publicClientIdPresent: Boolean(env.NEXT_PUBLIC_PAYPAL_CLIENT_ID),
    publicClientIdMatchesServer:
      !!env.NEXT_PUBLIC_PAYPAL_CLIENT_ID &&
      String(env.NEXT_PUBLIC_PAYPAL_CLIENT_ID).trim() === String(clientId).trim(),
  },
  token: tokenMeta,
  scopes: {
    actualScopes,
    requiredScopes: REQUIRED_SCOPES,
    requiredScopeStatus,
    reportingScopesPresent,
    reportingScopesAbsent,
    ordersRelatedScopesPresent: actualScopes.filter(
      (s) => /payments|checkout|orders|vault|openid/i.test(s)
    ),
  },
  classificationHint: reportingScopesAbsent
    ? "TOKEN_SCOPE_MISSING"
    : reportingScopesPresent
      ? "SCOPES_PRESENT_RECHECK_ENTITLEMENT_IF_403"
      : "UNKNOWN",
  // Phase 7 closeout: checkbox enabled + cache bust already performed; scopes still absent.
  classification: reportingScopesAbsent
    ? "TROPICASH_PHASE7_PAYPAL_SUPPORT_REQUIRED"
    : reportingScopesPresent
      ? "TROPICASH_PHASE7_REPORTING_SCOPES_PRESENT"
      : "TROPICASH_PHASE7_UNKNOWN",
  CARD_PAYOUT_STATUS: "REQUIRES_ACQUIRER_SPONSOR",
};

const accessProbe = {
  phase: "phase7_paypal_reporting_access_probe",
  timestamp: new Date().toISOString(),
  git: { branch: gitBranch, head: gitHead },
  environment: tokenAudit.environment,
  tokenScopesPresent: actualScopes.filter((s) => Object.values(REQUIRED_SCOPES).includes(s)),
  tokenScopesMissing: Object.values(REQUIRED_SCOPES).filter((s) => !actualScopes.includes(s)),
  probes: {
    reportingTransactions: sanitizeProbe("/v1/reporting/transactions", txProbe),
    reportingBalances: sanitizeProbe("/v1/reporting/balances", balProbe),
  },
  stopForReviewIf200: txProbe.status === 200 || balProbe.status === 200,
  classification: reportingScopesAbsent
    ? "TROPICASH_PHASE7_PAYPAL_SUPPORT_REQUIRED"
    : "TROPICASH_PHASE7_REPORTING_PROBES_REQUIRE_REVIEW",
  CARD_PAYOUT_STATUS: "REQUIRES_ACQUIRER_SPONSOR",
};

// Ledger non-mutation snapshot via Supabase (read-only)
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
let ledgerSnapshot = null;
if (url && serviceKey) {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
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
  ledgerSnapshot = {
    paypal_processor_clearing_net_debit: Number((clearing.debit - clearing.credit).toFixed(2)),
    treasury_cash_net_debit: Number((treasury.debit - treasury.credit).toFixed(2)),
    settlementJournalCount: settlementJournalCount ?? 0,
    feePosted: 0,
  };
}

accessProbe.ledgerSnapshot = ledgerSnapshot;

writeJson("phase7_paypal_reporting_token_audit.json", tokenAudit);
writeJson("phase7_paypal_reporting_access_probe.json", accessProbe);

console.log(
  JSON.stringify(
    {
      ok: true,
      reportingScopesPresent,
      missingScopes: accessProbe.tokenScopesMissing,
      transactionsHttp: txProbe.status,
      balancesHttp: balProbe.status,
      transactionsError: txProbe.json?.name || null,
      balancesError: balProbe.json?.name || null,
      unexpected200: accessProbe.stopForReviewIf200,
      clearing: ledgerSnapshot?.paypal_processor_clearing_net_debit ?? null,
      treasury: ledgerSnapshot?.treasury_cash_net_debit ?? null,
      classificationHint: tokenAudit.classificationHint,
      classification: tokenAudit.classification,
      CARD_PAYOUT_STATUS: tokenAudit.CARD_PAYOUT_STATUS,
    },
    null,
    2
  )
);
