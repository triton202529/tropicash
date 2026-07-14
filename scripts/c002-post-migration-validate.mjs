/**
 * Phase C-002 post-migration validation harness (sanitized).
 * Run AFTER applying card_funding_fund_wallet_double_credit_fix_c001.sql.
 *
 * Usage: node scripts/c002-post-migration-validate.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import {
  claimFundingProcessingSlot,
  FUNDING_PROVIDER_PAYPAL,
  patchFundingIdempotencyRow,
} from "../lib/fundingIdempotency.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(p) {
  if (!fs.existsSync(p)) return {};
  const o = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    o[t.slice(0, i).trim()] = v;
  }
  return o;
}

function mask(id) {
  if (!id || typeof id !== "string") return null;
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

const env = { ...loadEnv(path.join(root, ".env")), ...loadEnv(path.join(root, ".env.local")), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const projectRef = (url || "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || null;
const paypalMode = String(env.PAYPAL_MODE || env.NEXT_PUBLIC_PAYPAL_MODE || "sandbox").toLowerCase();

if (!url || !key) {
  console.log(JSON.stringify({ ok: false, reason: "missing_supabase_env" }));
  process.exit(1);
}
if (paypalMode === "live") {
  console.log(JSON.stringify({ ok: false, reason: "refuse_live_mode" }));
  process.exit(2);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = anonKey
  ? createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

async function readBal(userId) {
  const { data } = await admin.from("wallets").select("wallet_balance").eq("user_id", userId).maybeSingle();
  return Number(data?.wallet_balance ?? 0);
}

async function countFundingTx({ userId, amount, since }) {
  const { data: txs } = await admin
    .from("transactions")
    .select("id,amount,type,metadata")
    .or(`sender_id.eq.${userId},user_id.eq.${userId},recipient_id.eq.${userId}`)
    .in("type", ["fund", "fund_wallet"])
    .gte("created_at", since)
    .eq("amount", amount);
  return txs || [];
}

const out = {
  phase: "C-002",
  projectRef,
  environment: paypalMode,
  testTimestamp: new Date().toISOString(),
  migrationAssumedApplied: true,
  tests: {},
  report: {},
};

const { data: wallets, error: walletsError } = await admin
  .from("wallets")
  .select("user_id,wallet_balance")
  .not("user_id", "is", null)
  .limit(5);

const userId = wallets?.[0]?.user_id;
const otherWallet = wallets?.find((w) => w.user_id && w.user_id !== userId) || null;
if (!userId) {
  console.log(JSON.stringify({ ok: false, reason: "no_wallet_user", walletsError: walletsError?.message || null }));
  process.exit(1);
}
out.userIdMasked = mask(userId);
out.otherUserIdMasked = otherWallet ? mask(otherWallet.user_id) : null;

const startBal = await readBal(userId);
const otherStartBal = otherWallet ? await readBal(otherWallet.user_id) : null;
out.startingWalletBalance = startBal;
out.otherWalletStartingBalance = otherStartBal;

const requestedAmount = 1.37;
out.report.starting_balance = startBal;
out.report.requested_amount = requestedAmount;

// 1–3) Direct RPC exact-once credit + one funding transaction
{
  const amt = requestedAmount;
  const before = await readBal(userId);
  const since = new Date(Date.now() - 2000).toISOString();
  const { data, error } = await admin.rpc("fund_wallet", { p_user_id: userId, p_amount: amt });
  const after = await readBal(userId);
  const delta = Number((after - before).toFixed(2));
  const txs = await countFundingTx({ userId, amount: amt, since });
  out.tests.rpcExactOnce = {
    result: !error && Math.abs(delta - amt) < 0.001 && txs.length === 1 ? "PASS" : "FAIL",
    amount: amt,
    delta,
    expected: amt,
    exactOnce: Math.abs(delta - amt) < 0.001,
    doubled: Math.abs(delta - amt * 2) < 0.001,
    rpcError: error?.message || null,
    rpcReturnedJson: data != null && typeof data === "object",
    creditedAmountInRpc: data?.credited_amount ?? null,
    fundingTxCount: txs.length,
    txIdMasked: txs[0]?.id ? mask(String(txs[0].id)) : null,
    txType: txs[0]?.type || null,
    expectedTxType: "fund",
    txTypeCompatible: txs[0]?.type === "fund",
    balanceAuthority: txs[0]?.metadata?.balance_authority ?? null,
    balanceAuthorityOk: txs[0]?.metadata?.balance_authority === "fund_wallet_rpc",
  };
  if (
    out.tests.rpcExactOnce.result === "PASS" &&
    (!out.tests.rpcExactOnce.txTypeCompatible || !out.tests.rpcExactOnce.balanceAuthorityOk)
  ) {
    out.tests.rpcExactOnce.result = "FAIL";
  }
  out.report.ending_balance_after_primary = after;
  out.report.expected_delta = amt;
  out.report.actual_delta = delta;
  out.report.transaction_count = txs.length;
}

// 4) Idempotency duplicate claim (funding_idempotency_keys) — replay must not claim another credit slot
{
  const orderId = `C002-IDEMP-${Date.now()}`;
  const claim1 = await claimFundingProcessingSlot(admin, {
    provider: FUNDING_PROVIDER_PAYPAL,
    providerOrderId: orderId,
    userId,
    amount: 2.25,
  });
  const claim2 = await claimFundingProcessingSlot(admin, {
    provider: FUNDING_PROVIDER_PAYPAL,
    providerOrderId: orderId,
    userId,
    amount: 2.25,
  });
  if (claim1.kind === "claimed" && claim1.rowId) {
    await patchFundingIdempotencyRow(admin, claim1.rowId, {
      status: "completed",
      provider_capture_id: `CAP-${Date.now()}`,
    });
  }
  const claim3 = await claimFundingProcessingSlot(admin, {
    provider: FUNDING_PROVIDER_PAYPAL,
    providerOrderId: orderId,
    userId,
    amount: 2.25,
  });
  out.tests.idempotencyReplay = {
    result:
      claim1.kind === "claimed" &&
      (claim2.kind === "already_processing" || claim2.kind === "duplicate_completed") &&
      claim3.kind === "duplicate_completed"
        ? "PASS"
        : "FAIL",
    first: claim1.kind,
    concurrent: claim2.kind,
    afterCompleted: claim3.kind,
    orderIdMasked: mask(orderId),
  };
  out.report.duplicate_replay_result = out.tests.idempotencyReplay.result;
}

// 5) Distinct second valid funding creates exactly one additional credit
{
  const amt = 0.41;
  const before = await readBal(userId);
  const since = new Date(Date.now() - 2000).toISOString();
  const { error } = await admin.rpc("fund_wallet", { p_user_id: userId, p_amount: amt });
  const after = await readBal(userId);
  const delta = Number((after - before).toFixed(2));
  const txs = await countFundingTx({ userId, amount: amt, since });
  out.tests.distinctSecondFund = {
    result: !error && Math.abs(delta - amt) < 0.001 && txs.length === 1 ? "PASS" : "FAIL",
    amount: amt,
    delta,
    expected: amt,
    fundingTxCount: txs.length,
    rpcError: error?.message || null,
  };
}

// 6) Invalid amount
{
  const { error } = await admin.rpc("fund_wallet", { p_user_id: userId, p_amount: -1 });
  out.tests.invalidAmount = {
    result: error ? "PASS" : "FAIL",
    rejected: !!error,
    message: error?.message || null,
  };
}

// 7) Unauthenticated / anon execute rejected
{
  if (!anon) {
    out.tests.unauthenticatedAccess = {
      result: "FAIL",
      rejected: false,
      reason: "missing_anon_key",
    };
  } else {
    const balBeforeAnon = await readBal(userId);
    const { error } = await anon.rpc("fund_wallet", { p_user_id: userId, p_amount: 0.01 });
    const balAfterAnon = await readBal(userId);
    const unchanged = Math.abs(balAfterAnon - balBeforeAnon) < 0.001;
    out.tests.unauthenticatedAccess = {
      result: error && unchanged ? "PASS" : "FAIL",
      rejected: !!error,
      balanceUnchanged: unchanged,
      message: error?.message || null,
    };
  }
  out.report.authentication_result = out.tests.unauthenticatedAccess.result;
}

// 8) Funding-limit enforcement remains active (capture-order gate still present)
{
  const captureSrc = fs.readFileSync(path.join(root, "pages/api/paypal/capture-order.js"), "utf8");
  const hasAmountCap =
    /Funding limit exceeded/.test(captureSrc) &&
    (/1000/.test(captureSrc) || /1,?000/.test(captureSrc));
  const hasFinGate = /canServerPerformFinancialAction/.test(captureSrc) && /fund_wallet/.test(captureSrc);
  const hasRateLimit = /incrementRateLimit/.test(captureSrc) && /paypal\.capture_order/.test(captureSrc);
  out.tests.fundingLimitEnforcement = {
    result: hasAmountCap && hasFinGate && hasRateLimit ? "PASS" : "FAIL",
    amountCapPresent: hasAmountCap,
    financialActionGatePresent: hasFinGate,
    rateLimitPresent: hasRateLimit,
    note: "API-layer funding limits/gates remain in capture-order; RPC itself only rejects non-positive amounts.",
  };
  out.report.limit_result = out.tests.fundingLimitEnforcement.result;
}

// 9) Unrelated wallet unmodified
{
  if (!otherWallet) {
    out.tests.unrelatedWalletUnchanged = {
      result: "PASS",
      skipped: true,
      note: "Only one wallet row available; no second wallet to compare.",
    };
  } else {
    const otherEnd = await readBal(otherWallet.user_id);
    out.tests.unrelatedWalletUnchanged = {
      result: Math.abs(otherEnd - otherStartBal) < 0.001 ? "PASS" : "FAIL",
      start: otherStartBal,
      end: otherEnd,
      otherUserIdMasked: mask(otherWallet.user_id),
    };
  }
}

// Webhook collision — code/path proof (no fund_wallet in payout webhook processor)
{
  const webhookSrc = fs.readFileSync(path.join(root, "lib/payouts/payPalWebhookProcessor.js"), "utf8");
  const captureSrc = fs.readFileSync(path.join(root, "pages/api/paypal/capture-order.js"), "utf8");
  const webhookCallsFund = /fund_wallet/.test(webhookSrc);
  const captureCallsFund = /fund_wallet/.test(captureSrc);
  out.tests.webhookCollisionCode = {
    result: !webhookCallsFund && captureCallsFund ? "PASS" : "FAIL",
    webhookCallsFundWallet: webhookCallsFund,
    captureOrderCallsFundWallet: captureCallsFund,
    note: "PayPal webhook processor matches withdrawal_requests only; funding credits solely via capture-order → fund_wallet",
  };
}

const endBal = await readBal(userId);
out.endingWalletBalance = endBal;
out.rpcTestDelta = Number((endBal - startBal).toFixed(2));
out.report.ending_balance = endBal;

const required = [
  out.tests.rpcExactOnce,
  out.tests.idempotencyReplay,
  out.tests.distinctSecondFund,
  out.tests.invalidAmount,
  out.tests.unauthenticatedAccess,
  out.tests.fundingLimitEnforcement,
  out.tests.unrelatedWalletUnchanged,
];
const allPass = required.every((t) => t?.result === "PASS");
const rpcOk = out.tests.rpcExactOnce?.result === "PASS" && !out.tests.rpcExactOnce?.doubled;

out.ok = allPass;
out.classificationHint = allPass
  ? "RPC_SINGLE_CREDIT_OK_RUN_PAYPAL_PROBE"
  : out.tests.rpcExactOnce?.doubled
    ? "CARD_FUNDING_DOUBLE_CREDIT_FIX_FAILED"
    : "CARD_FUNDING_RECONCILIATION_FAILED";

const dir = path.join(root, "data", "results");
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "card_funding_double_credit_fix_validation.json"), JSON.stringify(out, null, 2));

console.log(
  JSON.stringify(
    {
      ok: allPass,
      projectRef,
      starting_balance: out.report.starting_balance,
      requested_amount: out.report.requested_amount,
      ending_balance: out.report.ending_balance,
      expected_delta: out.report.expected_delta,
      actual_delta: out.report.actual_delta,
      transaction_count: out.report.transaction_count,
      duplicate_replay_result: out.report.duplicate_replay_result,
      limit_result: out.report.limit_result,
      authentication_result: out.report.authentication_result,
      rpcExactOnce: out.tests.rpcExactOnce?.result,
      doubled: out.tests.rpcExactOnce?.doubled,
      distinctSecondFund: out.tests.distinctSecondFund?.result,
      unrelatedWallet: out.tests.unrelatedWalletUnchanged?.result,
      webhook: out.tests.webhookCollisionCode?.result,
      hint: out.classificationHint,
    },
    null,
    2,
  ),
);

process.exit(allPass && rpcOk ? 0 : 1);
