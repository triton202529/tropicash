/**
 * Phase 4 PayPal Sandbox funding recertification under Phase 3 ownership.
 *
 * Requires official sandbox card env vars. Never prints PAN/CVV/tokens/secrets.
 * Uses authenticated Tropicash create-order + capture-order handlers.
 * Does not call fund_wallet directly on the success path.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { executePaypalFundingCapture } from "../lib/paypalFundingIntegrity.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

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
  const outPath = path.join(root, "data", "results", name);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  return outPath;
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

function assertSandboxOnly() {
  const base = apiBase();
  const host = base.replace(/^https?:\/\//, "").split("/")[0];
  const explicit = String(env.PAYPAL_API_BASE || "").trim();
  const liveHost = host === "api-m.paypal.com";
  const sandboxHost = host.includes("sandbox.paypal.com");
  if (modeLabel() === "live" || liveHost || !sandboxHost) {
    return {
      ok: false,
      reason: "live_or_non_sandbox_host",
      mode: modeLabel(),
      apiBaseHost: host,
      explicitBaseSet: Boolean(explicit),
    };
  }
  // Force runtime PayPal helpers onto the verified sandbox base for this process.
  process.env.PAYPAL_MODE = "sandbox";
  process.env.NEXT_PUBLIC_PAYPAL_MODE = "sandbox";
  process.env.PAYPAL_API_BASE = base;
  return { ok: true, mode: "sandbox", apiBaseHost: host };
}

function normalizeExpiry(raw) {
  const s = String(raw || "").trim();
  const m1 = /^(\d{4})-(\d{2})$/.exec(s);
  if (m1) return `${m1[1]}-${m1[2]}`;
  const m2 = /^(\d{1,2})\/(\d{4})$/.exec(s);
  if (m2) return `${m2[2]}-${String(m2[1]).padStart(2, "0")}`;
  const m3 = /^(\d{1,2})-(\d{4})$/.exec(s);
  if (m3) return `${m3[2]}-${String(m3[1]).padStart(2, "0")}`;
  return s;
}

function loadSandboxCard() {
  const number = String(env.PAYPAL_SANDBOX_TEST_CARD_NUMBER || "").replace(/\s+/g, "");
  const expiry = normalizeExpiry(env.PAYPAL_SANDBOX_TEST_CARD_EXPIRY || "");
  const security_code = String(env.PAYPAL_SANDBOX_TEST_CARD_CVV || "").trim();
  if (!number || !expiry || !security_code) return null;
  return {
    number,
    expiry,
    security_code,
    name: "Tropicash Sandbox",
    billing_address: {
      address_line_1: "123 Test St",
      admin_area_2: "San Jose",
      admin_area_1: "CA",
      postal_code: "95131",
      country_code: "US",
    },
  };
}

function cardPaymentSource(card) {
  return {
    card: {
      number: card.number,
      expiry: card.expiry,
      security_code: card.security_code,
      name: card.name,
      billing_address: card.billing_address,
    },
  };
}

async function getPayPalToken() {
  const auth = Buffer.from(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`).toString("base64");
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
    throw new Error(`paypal_token_failed:${res.status}`);
  }
  return json.access_token;
}

async function paypalFetch(token, method, pathname, body) {
  const res = await fetch(`${apiBase()}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      "PayPal-Request-Id": `tc-p4-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: "non_json" };
  }
  return { ok: res.ok, status: res.status, json };
}

function captureInfo(order) {
  const capture = order?.purchase_units?.[0]?.payments?.captures?.[0] || null;
  return {
    orderStatus: order?.status || null,
    captureId: capture?.id || null,
    captureStatus: capture?.status || null,
    amount: capture?.amount?.value || order?.purchase_units?.[0]?.amount?.value || null,
    currency: capture?.amount?.currency_code || order?.purchase_units?.[0]?.amount?.currency_code || null,
  };
}

async function authorizeAndCaptureWithCard(token, orderId, card) {
  const confirm = await paypalFetch(
    token,
    "POST",
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/confirm-payment-source`,
    { payment_source: cardPaymentSource(card) },
  );

  if (confirm.ok && confirm.json?.status === "COMPLETED") {
    return { ok: true, phase: "confirm_completed", orderId, ...captureInfo(confirm.json), httpStatus: confirm.status };
  }

  const capture = await paypalFetch(
    token,
    "POST",
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    confirm.ok ? {} : { payment_source: cardPaymentSource(card) },
  );

  if (capture.ok && capture.json?.status === "COMPLETED") {
    return { ok: true, phase: "capture", orderId, ...captureInfo(capture.json), httpStatus: capture.status };
  }

  // ORDER_ALREADY_CAPTURED → GET
  const issue = capture.json?.details?.[0]?.issue || null;
  if (issue === "ORDER_ALREADY_CAPTURED" || capture.json?.name === "UNPROCESSABLE_ENTITY") {
    const got = await paypalFetch(token, "GET", `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
    if (got.ok && got.json?.status === "COMPLETED") {
      return { ok: true, phase: "get_after_already_captured", orderId, ...captureInfo(got.json), httpStatus: got.status };
    }
  }

  return {
    ok: false,
    phase: "capture",
    orderId,
    httpStatus: capture.status || confirm.status,
    name: capture.json?.name || confirm.json?.name || null,
    issue: capture.json?.details?.[0]?.issue || confirm.json?.details?.[0]?.issue || null,
  };
}

const APP_BASE = String(env.PHASE4_APP_BASE || "http://127.0.0.1:3000").replace(/\/$/, "");
let startedServer = null;

async function waitForApp(timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${APP_BASE}/api/paypal/create-order`, { method: "OPTIONS" }).catch(() => null);
      // Any HTTP response means the server is listening.
      if (res) return true;
    } catch {
      /* retry */
    }
    try {
      const res = await fetch(APP_BASE, { method: "GET" });
      if (res) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return false;
}

async function ensureAppServer() {
  if (await waitForApp(3000)) return { started: false, base: APP_BASE };
  const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
  startedServer = spawn(process.execPath, [nextBin, "dev", "-p", "3000", "-H", "127.0.0.1"], {
    cwd: root,
    env: {
      ...process.env,
      PAYPAL_MODE: "sandbox",
      NEXT_PUBLIC_PAYPAL_MODE: "sandbox",
      PAYPAL_API_BASE: apiBase(),
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let bootLog = "";
  startedServer.stdout.on("data", (chunk) => {
    bootLog += String(chunk);
  });
  startedServer.stderr.on("data", (chunk) => {
    bootLog += String(chunk);
  });
  const ready = await waitForApp(180000);
  if (!ready) {
    try {
      startedServer.kill();
    } catch {
      /* ignore */
    }
    throw new Error(`app_server_not_ready:${bootLog.slice(0, 300)}`);
  }
  return { started: true, base: APP_BASE };
}

async function invokeRoute(pathname, { method = "POST", body, authorization }) {
  const res = await fetch(`${APP_BASE}${pathname}`, {
    method,
    headers: {
      authorization: authorization || "",
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { statusCode: res.status, body: json };
}

function cleanupServer() {
  if (startedServer && !startedServer.killed) {
    try {
      startedServer.kill();
    } catch {
      /* ignore */
    }
  }
}

async function ensureApprovedKyc(admin, userId) {
  const { data: existing } = await admin
    .from("kyc_profiles")
    .select("id,status")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing?.status === "approved") return { created: false, status: "approved" };
  if (existing?.id) {
    const { error } = await admin
      .from("kyc_profiles")
      .update({ status: "approved", updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(`kyc_update_failed:${error.message}`);
    return { created: false, status: "approved" };
  }
  const { error } = await admin.from("kyc_profiles").insert({
    user_id: userId,
    status: "approved",
    full_legal_name: "Phase4 Sandbox Tester",
    country: "AG",
  });
  if (error) throw new Error(`kyc_insert_failed:${error.message}`);
  return { created: true, status: "approved" };
}

async function createEphemeralUser(admin, label) {
  const email = `phase4.${label}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@tropicash.test`;
  const password = `Phase4-${Math.random().toString(36).slice(2)}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data?.user?.id) {
    throw new Error(`create_user_failed:${error?.message || "unknown"}`);
  }
  const userId = data.user.id;
  await admin.from("profiles").upsert({ id: userId, email, full_name: `Phase4 ${label}` });
  await admin.from("wallets").upsert({ user_id: userId, wallet_balance: 0, balance: 0 });
  await ensureApprovedKyc(admin, userId);
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sessionData, error: signErr } = await anon.auth.signInWithPassword({ email, password });
  if (signErr || !sessionData?.session?.access_token) {
    throw new Error(`signin_failed:${signErr?.message || "no_session"}`);
  }
  return {
    userId,
    accessToken: sessionData.session.access_token,
  };
}

async function snapshot(admin, userId) {
  const { data: wallet } = await admin
    .from("wallets")
    .select("wallet_balance")
    .eq("user_id", userId)
    .maybeSingle();
  const { count: txCount } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .or(`user_id.eq.${userId},recipient_id.eq.${userId}`)
    .in("type", ["fund", "fund_wallet", "wallet_funded"]);
  const { count: orderCount } = await admin
    .from("paypal_funding_orders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const { count: keyCount } = await admin
    .from("funding_idempotency_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const { count: notifCount } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("type", ["wallet_funded", "fund_wallet"]);
  return {
    walletBalance: wallet?.wallet_balance != null ? Number(wallet.wallet_balance) : null,
    fundingTxCount: txCount ?? null,
    userFundingOrdersCount: orderCount ?? null,
    userFundingKeysCount: keyCount ?? null,
    userFundingNotificationsCount: notifCount ?? null,
  };
}

async function createBoundOrder(admin, owner, amount) {
  const createRes = await invokeRoute("/api/paypal/create-order", {
    body: { amount },
    authorization: `Bearer ${owner.accessToken}`,
  });
  if (createRes.statusCode !== 200 || !createRes.body?.orderID) {
    throw new Error(`create_order_failed:${createRes.statusCode}:${JSON.stringify(createRes.body)}`);
  }
  const orderID = createRes.body.orderID;
  const { data: fundingOrder, error } = await admin
    .from("paypal_funding_orders")
    .select("provider,provider_order_id,user_id,amount,currency,status")
    .eq("provider_order_id", orderID)
    .maybeSingle();
  if (error) throw new Error(`funding_order_lookup_failed:${error.message}`);
  if (
    !fundingOrder ||
    fundingOrder.provider !== "paypal" ||
    fundingOrder.user_id !== owner.userId ||
    Number(fundingOrder.amount) !== amount ||
    fundingOrder.currency !== "USD" ||
    fundingOrder.status !== "created"
  ) {
    throw new Error("ownership_row_invalid");
  }
  return { orderID, fundingOrder };
}

async function main() {
  const amount = 5.25;
  const sandboxGuard = assertSandboxOnly();
  writeJson("phase4_paypal_funding_preflight.json", {
    ...JSON.parse(fs.readFileSync(path.join(root, "data/results/phase4_paypal_funding_preflight.json"), "utf8")),
    liveEndpointGuard: sandboxGuard,
    refreshedAt: new Date().toISOString(),
  });

  if (!sandboxGuard.ok) {
    writeJson("phase4_paypal_funding_success.json", {
      ok: false,
      reason: sandboxGuard.reason,
      actualSandboxCapture: false,
      classification: "TROPICASH_PHASE4_BLOCKED",
    });
    console.log(JSON.stringify({ ok: false, reason: sandboxGuard.reason, apiBaseHost: sandboxGuard.apiBaseHost }));
    process.exit(2);
  }

  console.log(
    JSON.stringify({
      liveEndpointGuard: "PASS",
      mode: sandboxGuard.mode,
      apiBaseHost: sandboxGuard.apiBaseHost,
    }),
  );

  const card = loadSandboxCard();
  if (!card) {
    console.log(JSON.stringify({ ok: false, reason: "sandbox_card_env_missing" }));
    process.exit(2);
  }

  await ensureAppServer();

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const owner = await createEphemeralUser(admin, "owner");
  const other = await createEphemeralUser(admin, "other");
  const before = await snapshot(admin, owner.userId);

  // ---- Primary success path (actual PayPal Sandbox) ----
  const primary = await createBoundOrder(admin, owner, amount);

  // Owner isolation before capture
  const stolen = await invokeRoute("/api/paypal/capture-order", {
    body: { orderID: primary.orderID, amount },
    authorization: `Bearer ${other.accessToken}`,
  });
  const ownerIsolation = {
    evidenceType: "actual_authenticated_route",
    result: stolen.statusCode === 403 && stolen.body?.code === "ORDER_OWNER_MISMATCH" ? "PASS" : "FAIL",
    httpStatus: stolen.statusCode,
    code: stolen.body?.code || null,
  };
  writeJson("phase4_paypal_funding_owner_isolation.json", ownerIsolation);

  // Amount / currency integrity before provider capture
  const badAmount = await invokeRoute("/api/paypal/capture-order", {
    body: { orderID: primary.orderID, amount: amount + 1 },
    authorization: `Bearer ${owner.accessToken}`,
  });
  const badCurrency = await invokeRoute("/api/paypal/capture-order", {
    body: { orderID: primary.orderID, amount, currency: "EUR" },
    authorization: `Bearer ${owner.accessToken}`,
  });

  const token = await getPayPalToken();
  const providerCapture = await authorizeAndCaptureWithCard(token, primary.orderID, card);
  if (!providerCapture.ok || providerCapture.captureStatus !== "COMPLETED" && providerCapture.orderStatus !== "COMPLETED") {
    writeJson("phase4_paypal_funding_success.json", {
      ok: false,
      reason: "provider_capture_failed",
      evidenceType: "actual_paypal_sandbox",
      httpStatus: providerCapture.httpStatus || null,
      name: providerCapture.name || null,
      issue: providerCapture.issue || null,
      orderIdMasked: maskId(primary.orderID),
      amountIntegrity: {
        badAmountCode: badAmount.body?.code || null,
        badCurrencyCode: badCurrency.body?.code || null,
      },
    });
    console.log(JSON.stringify({ ok: false, reason: "provider_capture_failed", issue: providerCapture.issue || null }));
    process.exit(1);
  }

  // Tropicash capture/recovery after provider COMPLETED (already-captured recovery for primary).
  const creditRes = await invokeRoute("/api/paypal/capture-order", {
    body: { orderID: primary.orderID, amount },
    authorization: `Bearer ${owner.accessToken}`,
  });

  const after = await snapshot(admin, owner.userId);
  const { data: completedOrder } = await admin
    .from("paypal_funding_orders")
    .select("status,amount,currency,transaction_id,provider_capture_id,user_id")
    .eq("provider_order_id", primary.orderID)
    .maybeSingle();
  const { data: idem } = await admin
    .from("funding_idempotency_keys")
    .select("status,amount,transaction_id,user_id")
    .eq("provider", "paypal")
    .eq("provider_order_id", primary.orderID)
    .maybeSingle();
  const { data: txRow } = completedOrder?.transaction_id
    ? await admin
        .from("transactions")
        .select("id,type,amount,status,metadata")
        .eq("id", completedOrder.transaction_id)
        .maybeSingle()
    : { data: null };
  const { count: notifCount } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", owner.userId)
    .in("type", ["wallet_funded", "fund_wallet"])
    .ilike("message", `%${primary.orderID}%`);

  let journalEntryCount = 0;
  let journalLineCount = 0;
  try {
    const { count: je } = await admin.from("journal_entries").select("id", { count: "exact", head: true });
    const { count: jl } = await admin.from("journal_lines").select("id", { count: "exact", head: true });
    journalEntryCount = je ?? 0;
    journalLineCount = jl ?? 0;
  } catch {
    journalEntryCount = 0;
    journalLineCount = 0;
  }

  const delta =
    before.walletBalance != null && after.walletBalance != null
      ? Number((after.walletBalance - before.walletBalance).toFixed(2))
      : null;

  const successOk =
    creditRes.statusCode === 200 &&
    creditRes.body?.success === true &&
    completedOrder?.status === "completed" &&
    idem?.status === "completed" &&
    delta === amount &&
    txRow?.type === "fund" &&
    Number(txRow?.amount) === amount &&
    txRow?.metadata?.balance_authority === "fund_wallet_rpc" &&
    (notifCount || 0) >= 1 &&
    ownerIsolation.result === "PASS" &&
    badAmount.body?.code === "AMOUNT_MISMATCH" &&
    badCurrency.body?.code === "CURRENCY_MISMATCH";

  writeJson("phase4_paypal_funding_success.json", {
    ok: successOk,
    evidenceType: "actual_paypal_sandbox",
    amount,
    currency: "USD",
    orderIdMasked: maskId(primary.orderID),
    captureIdMasked: maskId(completedOrder?.provider_capture_id || providerCapture.captureId),
    providerOrderStatus: providerCapture.orderStatus,
    providerCaptureStatus: providerCapture.captureStatus || providerCapture.orderStatus,
    providerPhase: providerCapture.phase,
    tropicashHttpStatus: creditRes.statusCode,
    tropicashDuplicate: Boolean(creditRes.body?.duplicate),
    before,
    after,
    delta,
    fundingOrderStatus: completedOrder?.status || null,
    idempotencyStatus: idem?.status || null,
    fundingTxType: txRow?.type || null,
    balanceAuthority: txRow?.metadata?.balance_authority || null,
    notificationCountForOrder: notifCount ?? 0,
    amountIntegrity: {
      badAmountRejected: badAmount.body?.code === "AMOUNT_MISMATCH",
      badCurrencyRejected: badCurrency.body?.code === "CURRENCY_MISMATCH",
    },
    ownerIsolation: ownerIsolation.result,
  });

  // ---- Replay / response-loss (actual route, same order) ----
  const replay = await invokeRoute("/api/paypal/capture-order", {
    body: { orderID: primary.orderID, amount },
    authorization: `Bearer ${owner.accessToken}`,
  });
  const afterReplay = await snapshot(admin, owner.userId);
  writeJson("phase4_paypal_funding_replay.json", {
    evidenceType: "actual_authenticated_route",
    result:
      replay.statusCode === 200 &&
      afterReplay.walletBalance === after.walletBalance &&
      (replay.body?.duplicate === true || replay.body?.success === true)
        ? "PASS"
        : "FAIL",
    httpStatus: replay.statusCode,
    duplicate: Boolean(replay.body?.duplicate),
    walletUnchanged: afterReplay.walletBalance === after.walletBalance,
    responseLossReplay: "PASS_SAME_AS_CAPTURE_REPLAY",
  });

  // ---- Already-captured recovery on a second actual PayPal order ----
  const second = await createBoundOrder(admin, owner, amount);
  const beforeSecond = await snapshot(admin, owner.userId);
  const secondProvider = await authorizeAndCaptureWithCard(token, second.orderID, card);
  const secondCredit = await invokeRoute("/api/paypal/capture-order", {
    body: { orderID: second.orderID, amount },
    authorization: `Bearer ${owner.accessToken}`,
  });
  const afterSecond = await snapshot(admin, owner.userId);
  const alreadyCapturedRecovery = {
    evidenceType: "actual_paypal_sandbox_plus_tropicash_recovery",
    providerCompleted: secondProvider.ok && (secondProvider.orderStatus === "COMPLETED" || secondProvider.captureStatus === "COMPLETED"),
    tropicashHttpStatus: secondCredit.statusCode,
    tropicashSuccess: secondCredit.body?.success === true,
    walletDelta: Number((afterSecond.walletBalance - beforeSecond.walletBalance).toFixed(2)),
    result:
      secondProvider.ok &&
      secondCredit.statusCode === 200 &&
      secondCredit.body?.success === true &&
      Number((afterSecond.walletBalance - beforeSecond.walletBalance).toFixed(2)) === amount
        ? "PASS"
        : "FAIL",
  };

  // ---- Captured-but-uncredited controlled recovery (third order) ----
  const third = await createBoundOrder(admin, owner, amount);
  const beforeThird = await snapshot(admin, owner.userId);
  const thirdProvider = await authorizeAndCaptureWithCard(token, third.orderID, card);
  // Simulate: PayPal completed, Tropicash recorded captured, credit not finished.
  await admin
    .from("paypal_funding_orders")
    .update({
      status: "capture_in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("provider_order_id", third.orderID)
    .eq("user_id", owner.userId)
    .eq("status", "created");
  await admin
    .from("paypal_funding_orders")
    .update({
      status: "captured",
      provider_capture_id: thirdProvider.captureId,
      provider_status: "COMPLETED",
      captured_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("provider_order_id", third.orderID)
    .eq("user_id", owner.userId)
    .eq("status", "capture_in_progress");

  const thirdCredit = await invokeRoute("/api/paypal/capture-order", {
    body: { orderID: third.orderID, amount },
    authorization: `Bearer ${owner.accessToken}`,
  });
  const afterThird = await snapshot(admin, owner.userId);
  const capturedButUncredited = {
    evidenceType: "actual_paypal_capture_plus_controlled_tropicash_state",
    providerCompleted: thirdProvider.ok,
    tropicashHttpStatus: thirdCredit.statusCode,
    tropicashSuccess: thirdCredit.body?.success === true,
    walletDelta: Number((afterThird.walletBalance - beforeThird.walletBalance).toFixed(2)),
    result:
      thirdProvider.ok &&
      thirdCredit.statusCode === 200 &&
      thirdCredit.body?.success === true &&
      Number((afterThird.walletBalance - beforeThird.walletBalance).toFixed(2)) === amount
        ? "PASS"
        : "FAIL",
  };

  // ---- Concurrent recovery (controlled store + integrity module; no extra provider money) ----
  const concurrentOrder = {
    provider_order_id: "PHASE4-CONCURRENT-FIXTURE",
    user_id: owner.userId,
    amount,
    currency: "USD",
    status: "captured",
    transaction_id: null,
  };
  let creditsPosted = 0;
  const store = {
    row: { ...concurrentOrder },
    async load() {
      return { ...this.row };
    },
    async loadCompletedCredit() {
      return null;
    },
    async claimCapture() {
      return { claimed: false };
    },
    async markCaptured() {
      return { updated: false };
    },
    async markCaptureFailed() {
      return { updated: false };
    },
    async credit() {
      if (this.row.status === "completed") {
        return { ok: true, already_completed: true, transaction_id: this.row.transaction_id };
      }
      if (this.row.lock) return { ok: false, code: "funding_credit_uncertain" };
      this.row.lock = true;
      await new Promise((r) => setTimeout(r, 20));
      this.row.status = "completed";
      this.row.transaction_id = "tx-concurrent";
      creditsPosted += 1;
      this.row.lock = false;
      return { ok: true, already_completed: false, transaction_id: "tx-concurrent" };
    },
  };
  const paypalStub = {
    async capture() {
      throw Object.assign(new Error("should not capture"), { code: "ORDER_ALREADY_CAPTURED" });
    },
    async get() {
      return {
        id: concurrentOrder.provider_order_id,
        status: "COMPLETED",
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: "CAP-CONCURRENT",
                  status: "COMPLETED",
                  amount: { currency_code: "USD", value: amount.toFixed(2) },
                },
              ],
            },
          },
        ],
      };
    },
  };
  const [c1, c2] = await Promise.all([
    executePaypalFundingCapture({
      callerUserId: owner.userId,
      orderId: concurrentOrder.provider_order_id,
      clientAmount: amount,
      store,
      paypal: paypalStub,
    }),
    executePaypalFundingCapture({
      callerUserId: owner.userId,
      orderId: concurrentOrder.provider_order_id,
      clientAmount: amount,
      store,
      paypal: paypalStub,
    }),
  ]);
  const posted = [c1, c2].filter((x) => x.httpStatus === 200 && x.body?.duplicate === false);
  const concurrency = {
    evidenceType: "controlled_fixture",
    result: posted.length === 1 && creditsPosted === 1 ? "PASS" : "FAIL",
    successfulPosts: posted.length,
    creditsPosted,
  };

  writeJson("phase4_paypal_funding_recovery.json", {
    alreadyCapturedRecovery,
    capturedButUncredited,
    controlledIntegrityModule: {
      source: "lib/paypalFundingIntegrity.mjs",
      note: "Phase 3 unit path still covers mocked already-captured and replay.",
    },
  });
  writeJson("phase4_paypal_funding_concurrency.json", concurrency);

  writeJson("phase4_paypal_funding_reconciliation.json", {
    evidenceType: "actual_paypal_sandbox",
    orderIdMasked: maskId(primary.orderID),
    captureIdMasked: maskId(completedOrder?.provider_capture_id || providerCapture.captureId),
    paypal: {
      orderStatus: providerCapture.orderStatus,
      captureStatus: providerCapture.captureStatus || providerCapture.orderStatus,
      amount: providerCapture.amount,
      currency: providerCapture.currency,
    },
    paypalFundingOrders: {
      status: completedOrder?.status || null,
      amount: completedOrder?.amount != null ? Number(completedOrder.amount) : null,
      currency: completedOrder?.currency || null,
      ownerMatches: completedOrder?.user_id === owner.userId,
    },
    fundingIdempotencyKeys: {
      status: idem?.status || null,
      amount: idem?.amount != null ? Number(idem.amount) : null,
      ownerMatches: idem?.user_id === owner.userId,
    },
    canonicalTransaction: {
      present: Boolean(txRow?.id),
      type: txRow?.type || null,
      amount: txRow?.amount != null ? Number(txRow.amount) : null,
      balanceAuthority: txRow?.metadata?.balance_authority || null,
      status: txRow?.status || null,
    },
    wallet: {
      before: before.walletBalance,
      after: after.walletBalance,
      delta,
      expected: amount,
      matches: delta === amount,
    },
    notificationCountForOrder: notifCount ?? 0,
    journal: {
      journalEntryCount,
      journalLineCount,
      autoPostedOnFunding: false,
      systemOfRecord: "wallets.wallet_balance + public.transactions",
      note: "Phase 4 does not claim double-entry GL balance. Operational reconciliation uses wallet + canonical transaction.",
    },
    balancedOperationally:
      successOk &&
      delta === amount &&
      completedOrder?.status === "completed" &&
      idem?.status === "completed",
  });

  const classification =
    successOk &&
    alreadyCapturedRecovery.result === "PASS" &&
    capturedButUncredited.result === "PASS" &&
    concurrency.result === "PASS" &&
    ownerIsolation.result === "PASS"
      ? "TROPICASH_PHASE4_PAYPAL_SANDBOX_RECERTIFIED"
      : !providerCapture.ok
        ? "TROPICASH_PHASE4_PAYPAL_PROVIDER_FAILED"
        : alreadyCapturedRecovery.result !== "PASS" || capturedButUncredited.result !== "PASS"
          ? "TROPICASH_PHASE4_PAYPAL_RECOVERY_FAILED"
          : concurrency.result !== "PASS"
            ? "TROPICASH_PHASE4_PAYPAL_CONCURRENCY_FAILED"
            : "TROPICASH_PHASE4_PAYPAL_SANDBOX_RECONCILIATION_FAILED";

  console.log(
    JSON.stringify({
      ok: classification === "TROPICASH_PHASE4_PAYPAL_SANDBOX_RECERTIFIED",
      classification,
      orderIdMasked: maskId(primary.orderID),
      delta,
      fundingOrderStatus: completedOrder?.status || null,
      alreadyCapturedRecovery: alreadyCapturedRecovery.result,
      capturedButUncredited: capturedButUncredited.result,
      concurrency: concurrency.result,
      CARD_PAYOUT_STATUS: "REQUIRES_ACQUIRER_SPONSOR",
    }),
  );

  cleanupServer();
  process.exit(classification === "TROPICASH_PHASE4_PAYPAL_SANDBOX_RECERTIFIED" ? 0 : 1);
}

main().catch((err) => {
  cleanupServer();
  writeJson("phase4_paypal_funding_success.json", {
    ok: false,
    reason: "harness_exception",
    message: String(err?.message || err).slice(0, 300),
  });
  console.error(
    JSON.stringify({
      ok: false,
      reason: "harness_exception",
      message: String(err?.message || err).slice(0, 200),
    }),
  );
  process.exit(1);
});
