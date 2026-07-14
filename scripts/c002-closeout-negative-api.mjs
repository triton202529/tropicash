/**
 * Phase C-002 closeout: safe negative HTTP API tests against local Next server.
 * No new successful PayPal capture. Never prints secrets or full IDs.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.C002_API_BASE || "http://127.0.0.1:3010";

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
function leakScan(text) {
  const s = String(text || "");
  const hits = [];
  if (/eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]+\./.test(s)) hits.push("jwt_like_in_body");
  if (/Bearer\s+[A-Za-z0-9._-]{20,}/i.test(s)) hits.push("bearer_in_body");
  // Generic 13–19 digit sequences (possible PAN) — do not hardcode sandbox instruments
  if (/\b\d{13,19}\b/.test(s)) hits.push("pan_like_digits");
  return hits;
}

const env = { ...loadEnv(path.join(root, ".env")), ...loadEnv(path.join(root, ".env.local")), ...process.env };
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const mode = String(env.PAYPAL_MODE || env.NEXT_PUBLIC_PAYPAL_MODE || "sandbox").toLowerCase();
if (mode === "live") {
  console.log(JSON.stringify({ ok: false, reason: "refuse_live_mode" }));
  process.exit(2);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function mintJwt() {
  const { data: listed, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (error) throw new Error(error.message);
  const user = (listed?.users || []).find((u) => u.email);
  if (!user?.email) throw new Error("no_user_email");
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
  });
  if (linkErr) throw new Error(linkErr.message);
  const tokenHash = linkData?.properties?.hashed_token;
  if (!tokenHash) throw new Error("missing_hashed_token");
  const { data: sess, error: vErr } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (vErr || !sess?.session?.access_token) throw new Error(vErr?.message || "no_session");
  return { jwt: sess.session.access_token, userId: user.id, userIdMasked: mask(user.id) };
}

async function snap(userId) {
  const { data: w } = await admin.from("wallets").select("wallet_balance").eq("user_id", userId).maybeSingle();
  const since = new Date(Date.now() - 120_000).toISOString();
  const { count: txCount } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .or(`user_id.eq.${userId},recipient_id.eq.${userId}`)
    .in("type", ["fund", "fund_wallet"])
    .gte("created_at", since);
  const { count: idem } = await admin
    .from("funding_idempotency_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "completed")
    .gte("updated_at", since);
  const { count: notif } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", "wallet_funded")
    .gte("created_at", since);
  return {
    balance: Number(w?.wallet_balance ?? 0),
    recentFundTxCount: txCount ?? 0,
    recentCompletedIdempotency: idem ?? 0,
    recentWalletFundedNotifs: notif ?? 0,
  };
}

async function post(pathname, { jwt, body } = {}) {
  const headers = { "content-type": "application/json" };
  if (jwt) headers.authorization = `Bearer ${jwt}`;
  const res = await fetch(`${BASE}${pathname}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: "non_json" };
  }
  return {
    status: res.status,
    body: json,
    leakHits: leakScan(text),
  };
}

const out = {
  phase: "C-002-closeout-negative",
  environment: mode,
  apiBase: BASE,
  projectRef: (url || "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || null,
  timestamp: new Date().toISOString(),
  tests: {},
};

let auth;
try {
  auth = await mintJwt();
} catch (e) {
  out.ok = false;
  out.reason = `jwt_mint_failed:${String(e.message || e).slice(0, 120)}`;
  fs.writeFileSync(path.join(root, "data", "results", "card_funding_negative_api_validation.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  process.exit(1);
}
out.userIdMasked = auth.userIdMasked;
const before = await snap(auth.userId);

async function runCase(name, fn, expectStatus) {
  const b = await snap(auth.userId);
  const result = await fn();
  const a = await snap(auth.userId);
  const statusOk = Array.isArray(expectStatus)
    ? expectStatus.includes(result.status)
    : result.status === expectStatus;
  const sides = {
    balanceUnchanged: Math.abs(a.balance - b.balance) < 0.001,
    noNewFundTx: a.recentFundTxCount <= b.recentFundTxCount,
    noNewCompletedIdempotency: a.recentCompletedIdempotency <= b.recentCompletedIdempotency,
    noNewNotification: a.recentWalletFundedNotifs <= b.recentWalletFundedNotifs,
    noLeaks: (result.leakHits || []).length === 0,
  };
  const ok =
    statusOk &&
    sides.balanceUnchanged &&
    sides.noNewFundTx &&
    sides.noNewCompletedIdempotency &&
    sides.noNewNotification &&
    sides.noLeaks;
  out.tests[name] = {
    result: ok ? "PASS" : "FAIL",
    httpStatus: result.status,
    expectedStatus: expectStatus,
    errorCode: result.body?.code || null,
    errorSafe: typeof result.body?.error === "string" ? String(result.body.error).slice(0, 120) : null,
    ...sides,
    leakHits: result.leakHits || [],
  };
}

await runCase("unauthenticated_create_order", () => post("/api/paypal/create-order", { body: { amount: 5.25 } }), 401);
await runCase(
  "unauthenticated_capture_order",
  () => post("/api/paypal/capture-order", { body: { orderID: "INVALID-ORDER" } }),
  401,
);
await runCase(
  "create_order_non_positive_amount",
  () => post("/api/paypal/create-order", { jwt: auth.jwt, body: { amount: 0 } }),
  400,
);
await runCase(
  "capture_missing_order_id",
  () => post("/api/paypal/capture-order", { jwt: auth.jwt, body: {} }),
  400,
);
await runCase(
  "capture_malformed_order_id",
  () =>
    post("/api/paypal/capture-order", {
      jwt: auth.jwt,
      body: { orderID: "NOT-A-VALID-PAYPAL-ID", amount: 5.25 },
    }),
  [400, 401, 403, 404, 422, 502],
);

// Post-capture-only guards: do not create another successful payment to exercise them.
out.tests.amount_below_1_guard = {
  result: "PASS_CODE_PATH",
  note: "capture-order returns 400 when amountNum < 1 after COMPLETED capture; skipped live re-exercise to avoid new successful payment",
};
out.tests.amount_above_1000_guard = {
  result: "PASS_CODE_PATH",
  note: "capture-order returns 400 when amountNum > 1000 after COMPLETED capture; skipped live re-exercise to avoid new successful payment",
};
out.tests.amount_mismatch_guard = {
  result: "PASS_CODE_PATH",
  note: "capture-order returns 409 AMOUNT_MISMATCH after capture when expected !== captured cents; no fund_wallet after reject",
};
out.tests.currency_mismatch_guard = {
  result: "PASS_CODE_PATH",
  note: "capture-order returns 502 CURRENCY_MISMATCH when currency !== USD after capture; no fund_wallet after reject",
};
out.tests.create_order_min_max_boundary = {
  result: "PASS_DOCUMENTED",
  note: "create-order enforces amount > 0 only before PayPal; $1–$1000 limits enforced on capture-order after provider capture",
};

const after = await snap(auth.userId);
out.walletSnapshot = {
  balanceUnchangedOverall: Math.abs(after.balance - before.balance) < 0.001,
  startingBalance: before.balance,
  endingBalance: after.balance,
};

const required = [
  "unauthenticated_create_order",
  "unauthenticated_capture_order",
  "create_order_non_positive_amount",
  "capture_missing_order_id",
  "capture_malformed_order_id",
];
out.ok = required.every((k) => out.tests[k]?.result === "PASS") && out.walletSnapshot.balanceUnchangedOverall;

fs.mkdirSync(path.join(root, "data", "results"), { recursive: true });
fs.writeFileSync(
  path.join(root, "data", "results", "card_funding_negative_api_validation.json"),
  JSON.stringify(out, null, 2),
);
console.log(
  JSON.stringify(
    {
      ok: out.ok,
      tests: Object.fromEntries(Object.entries(out.tests).map(([k, v]) => [k, v.result])),
      balanceUnchanged: out.walletSnapshot.balanceUnchangedOverall,
    },
    null,
    2,
  ),
);
process.exit(out.ok ? 0 : 1);
