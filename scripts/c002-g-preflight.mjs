/**
 * Phase C-002 G: sanitized preflight before PayPal sandbox card probe.
 * Never prints secrets.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

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

const env = { ...loadEnv(path.join(root, ".env")), ...loadEnv(path.join(root, ".env.local")), ...process.env };
const mode = String(env.PAYPAL_MODE || env.NEXT_PUBLIC_PAYPAL_MODE || "sandbox").toLowerCase();
const base = String(env.PAYPAL_API_BASE || "").trim() || (mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com");
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
const ref = (url.match(/https:\/\/([^.]+)\.supabase\.co/) || [])[1] || null;

const out = {
  phase: "C-002-G-preflight",
  paypalMode: mode,
  paypalApiHost: (() => {
    try {
      return new URL(base).host;
    } catch {
      return null;
    }
  })(),
  isSandboxHost: String(base).includes("sandbox.paypal.com"),
  isLiveHost: /api-m\.paypal\.com/.test(String(base)) && !String(base).includes("sandbox"),
  supabaseRef: ref,
  hasPayPalClientId: !!(env.PAYPAL_CLIENT_ID && String(env.PAYPAL_CLIENT_ID).trim()),
  hasPayPalSecret: !!(env.PAYPAL_CLIENT_SECRET && String(env.PAYPAL_CLIENT_SECRET).trim()),
  hasServiceRole: !!(env.SUPABASE_SERVICE_ROLE_KEY && String(env.SUPABASE_SERVICE_ROLE_KEY).trim()),
  refuseLive: mode === "live" || (/api-m\.paypal\.com/.test(String(base)) && !String(base).includes("sandbox")),
  checks: {},
};

if (out.refuseLive || out.supabaseRef !== "opbhcndlibbcsmoaeymq" || !out.isSandboxHost || !out.hasPayPalClientId || !out.hasPayPalSecret || !out.hasServiceRole) {
  out.ok = false;
  out.reason = "safety_check_failed";
  console.log(JSON.stringify(out, null, 2));
  process.exit(2);
}

const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "missing", {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: wallets } = await admin.from("wallets").select("user_id,wallet_balance").not("user_id", "is", null).limit(1);
const userId = wallets?.[0]?.user_id;
if (!userId) {
  out.ok = false;
  out.reason = "no_wallet_user";
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}

const amt = 0.19;
const before = Number(wallets[0].wallet_balance ?? 0);
const since = new Date(Date.now() - 2000).toISOString();
const { data, error } = await admin.rpc("fund_wallet", { p_user_id: userId, p_amount: amt });
const { data: afterRow } = await admin.from("wallets").select("wallet_balance").eq("user_id", userId).maybeSingle();
const after = Number(afterRow?.wallet_balance ?? 0);
const delta = Number((after - before).toFixed(2));
const { data: txs } = await admin
  .from("transactions")
  .select("id,type,metadata,amount")
  .or(`user_id.eq.${userId},recipient_id.eq.${userId},sender_id.eq.${userId}`)
  .in("type", ["fund", "fund_wallet"])
  .eq("amount", amt)
  .gte("created_at", since);

const { error: anonErr } = await anon.rpc("credit_wallet", { user_id_input: userId, amount_input: 0.01 });
const { error: anonFundErr } = await anon.rpc("fund_wallet", { p_user_id: userId, p_amount: 0.01 });

out.checks.fundWalletExactOnce = {
  result: !error && Math.abs(delta - amt) < 0.001 && (txs?.length || 0) === 1 ? "PASS" : "FAIL",
  delta,
  expected: amt,
  doubled: Math.abs(delta - amt * 2) < 0.001,
  txType: txs?.[0]?.type || null,
  balanceAuthority: txs?.[0]?.metadata?.balance_authority || null,
};
out.checks.creditWalletInaccessible = {
  result: anonErr ? "PASS" : "FAIL",
  rejected: !!anonErr,
};
out.checks.fundWalletUnauthRejected = {
  result: anonFundErr ? "PASS" : "FAIL",
  rejected: !!anonFundErr,
};

out.ok =
  out.checks.fundWalletExactOnce.result === "PASS" &&
  out.checks.fundWalletExactOnce.txType === "fund" &&
  out.checks.fundWalletExactOnce.balanceAuthority === "fund_wallet_rpc" &&
  out.checks.creditWalletInaccessible.result === "PASS" &&
  out.checks.fundWalletUnauthRejected.result === "PASS";

fs.mkdirSync(path.join(root, "data", "results"), { recursive: true });
fs.writeFileSync(path.join(root, "data", "results", "card_funding_g_preflight.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ok: out.ok, paypalMode: out.paypalMode, host: out.paypalApiHost, ref: out.supabaseRef, checks: out.checks }, null, 2));
process.exit(out.ok ? 0 : 1);
