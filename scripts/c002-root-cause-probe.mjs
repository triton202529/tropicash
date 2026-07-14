/**
 * Phase C-002: Isolate fund_wallet double-credit root cause (sanitized).
 * Never prints secrets, PAN, or tokens.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

const env = {
  ...loadEnv(path.join(root, ".env")),
  ...loadEnv(path.join(root, ".env.local")),
  ...process.env,
};

function mask(id) {
  if (!id || typeof id !== "string") return null;
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log(JSON.stringify({ ok: false, reason: "missing_supabase_env" }));
  process.exit(1);
}

const projectRef = (url.match(/https:\/\/([^.]+)\.supabase\.co/) || [])[1] || null;
const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const paypalMode = String(env.PAYPAL_MODE || env.NEXT_PUBLIC_PAYPAL_MODE || "sandbox").toLowerCase();

async function readWallet(userId) {
  const { data } = await admin
    .from("wallets")
    .select("wallet_balance,balance,triton_balance")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    wallet_balance: Number(data?.wallet_balance ?? 0),
    balance: Number(data?.balance ?? 0),
    triton_balance: Number(data?.triton_balance ?? 0),
  };
}

async function countRecentFundTx(userId, sinceIso) {
  const { data, error } = await admin
    .from("transactions")
    .select("id,amount,type,status,created_at")
    .eq("sender_id", userId)
    .in("type", ["fund", "fund_wallet", "wallet_funded"])
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false });
  return { rows: data || [], error: error?.message || null };
}

const report = {
  projectRef,
  paypalMode,
  liveCardCharging: paypalMode === "live",
  tests: {},
};

const { data: wallets, error: wErr } = await admin
  .from("wallets")
  .select("user_id")
  .not("user_id", "is", null)
  .limit(1);

if (wErr || !wallets?.[0]?.user_id) {
  console.log(JSON.stringify({ ok: false, reason: wErr?.message || "no_wallet_user" }));
  process.exit(1);
}

const userId = wallets[0].user_id;
report.userIdMasked = mask(userId);

// A) Direct wallet update (control)
{
  const before = await readWallet(userId);
  const { error } = await admin
    .from("wallets")
    .update({ wallet_balance: Number((before.wallet_balance + 0.01).toFixed(2)) })
    .eq("user_id", userId);
  const after = await readWallet(userId);
  report.tests.directWalletUpdate = {
    error: error?.message || null,
    deltaWallet: Number((after.wallet_balance - before.wallet_balance).toFixed(4)),
    expected: 0.01,
    oneToOne: Math.abs(after.wallet_balance - before.wallet_balance - 0.01) < 0.0001,
  };
}

// B) Insert fund transaction only (trigger probe)
{
  const before = await readWallet(userId);
  const since = new Date().toISOString();
  const { data: tx, error } = await admin
    .from("transactions")
    .insert({
      sender_id: userId,
      user_id: userId,
      amount: 0.03,
      type: "fund",
      status: "completed",
      description: "c002_trigger_probe_fund",
    })
    .select("id,type,amount")
    .maybeSingle();
  const after = await readWallet(userId);
  const { rows } = await countRecentFundTx(userId, since);
  report.tests.insertFundTransactionOnly = {
    insertError: error?.message || null,
    txCreated: !!tx?.id,
    txType: tx?.type || null,
    deltaWallet: Number((after.wallet_balance - before.wallet_balance).toFixed(4)),
    triggerCreditsWallet: Math.abs(after.wallet_balance - before.wallet_balance - 0.03) < 0.0001,
    recentFundTxCount: rows.length,
  };
}

// C) Insert fund_wallet type only
{
  const before = await readWallet(userId);
  const { data: tx, error } = await admin
    .from("transactions")
    .insert({
      sender_id: userId,
      user_id: userId,
      amount: 0.04,
      type: "fund_wallet",
      status: "completed",
      description: "c002_trigger_probe_fund_wallet",
    })
    .select("id,type,amount")
    .maybeSingle();
  const after = await readWallet(userId);
  report.tests.insertFundWalletTypeOnly = {
    insertError: error?.message || null,
    txCreated: !!tx?.id,
    txType: tx?.type || null,
    deltaWallet: Number((after.wallet_balance - before.wallet_balance).toFixed(4)),
    triggerCreditsWallet: Math.abs(after.wallet_balance - before.wallet_balance - 0.04) < 0.0001,
  };
}

// D) fund_wallet RPC once
{
  const amt = 0.17;
  const before = await readWallet(userId);
  const since = new Date().toISOString();
  const { data, error } = await admin.rpc("fund_wallet", {
    p_user_id: userId,
    p_amount: amt,
  });
  const after = await readWallet(userId);
  const { rows } = await countRecentFundTx(userId, since);
  const delta = Number((after.wallet_balance - before.wallet_balance).toFixed(4));
  report.tests.fundWalletRpcOnce = {
    rpcError: error?.message || null,
    rpcDataPresent: data != null,
    rpcDataKeys: data && typeof data === "object" ? Object.keys(data) : typeof data,
    amount: amt,
    before: before.wallet_balance,
    after: after.wallet_balance,
    delta,
    expected: amt,
    doubled: Math.abs(delta - amt * 2) < 0.0001,
    exactOnce: Math.abs(delta - amt) < 0.0001,
    fundTxCount: rows.length,
    fundTxAmounts: rows.map((r) => Number(r.amount)),
    fundTxTypes: rows.map((r) => r.type),
    balanceColumnDelta: Number((after.balance - before.balance).toFixed(4)),
    tritonDelta: Number((after.triton_balance - before.triton_balance).toFixed(4)),
  };
}

// E) Classify root cause family
const t = report.tests;
let rootCauseFamily = "UNKNOWN";
if (t.fundWalletRpcOnce?.doubled && !t.insertFundTransactionOnly?.triggerCreditsWallet && !t.insertFundWalletTypeOnly?.triggerCreditsWallet) {
  rootCauseFamily = "B_OR_INLINE_FUND_WALLET_DOUBLE_UPDATE";
  if (t.fundWalletRpcOnce.fundTxCount === 1 && t.fundWalletRpcOnce.exactOnce === false) {
    rootCauseFamily = "B_FUND_WALLET_FUNCTION_CREDITS_TWICE_INLINE";
  }
} else if (
  t.fundWalletRpcOnce?.doubled &&
  (t.insertFundTransactionOnly?.triggerCreditsWallet || t.insertFundWalletTypeOnly?.triggerCreditsWallet)
) {
  rootCauseFamily = "A_FUND_WALLET_PLUS_TRANSACTION_TRIGGER";
} else if (t.fundWalletRpcOnce?.exactOnce) {
  rootCauseFamily = "ALREADY_FIXED";
}

report.rootCauseFamily = rootCauseFamily;
report.hypothesisNotes = {
  A: "fund_wallet updates wallet then insert triggers another credit",
  B: "fund_wallet itself updates balance twice (or helper doubles)",
  C: "capture-order calls fund_wallet twice — app-level, not proven by this RPC probe",
  D: "webhook + capture both credit — app-level",
  E: "multiple triggers — would show on transaction-only insert",
};

const outDir = path.join(root, "data", "results");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "card_funding_double_credit_root_cause_probe.json"),
  JSON.stringify(report, null, 2),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      projectRef,
      paypalMode,
      rootCauseFamily,
      fundWallet: report.tests.fundWalletRpcOnce,
      insertFundTrigger: report.tests.insertFundTransactionOnly,
      insertFundWalletTrigger: report.tests.insertFundWalletTypeOnly,
      directUpdateOk: report.tests.directWalletUpdate?.oneToOne,
    },
    null,
    2,
  ),
);
