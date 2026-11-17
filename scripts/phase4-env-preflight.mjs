/**
 * Phase 4 sanitized preflight. Never prints secrets, card data, or tokens.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

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

const env = {
  ...loadEnvFile(path.join(root, ".env")),
  ...loadEnvFile(path.join(root, ".env.local")),
  ...process.env,
};

function present(key) {
  return !!(env[key] && String(env[key]).trim());
}

function maskId(id) {
  if (!id || typeof id !== "string") return null;
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

const mode = String(env.PAYPAL_MODE || env.NEXT_PUBLIC_PAYPAL_MODE || "sandbox").toLowerCase();
const base =
  env.PAYPAL_API_BASE && String(env.PAYPAL_API_BASE).trim()
    ? String(env.PAYPAL_API_BASE).replace(/\/$/, "")
    : mode === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
const host = base.replace(/^https?:\/\//, "").split("/")[0];
const isSandboxHost = host.includes("sandbox.paypal.com");
const isLiveHost = host === "api-m.paypal.com";
const refuseLive = mode === "live" || isLiveHost;

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
const supabaseHost = supabaseUrl.replace(/^https?:\/\//, "").split("/")[0] || null;
const projectRef = supabaseHost ? supabaseHost.split(".")[0] : null;

const out = {
  phase: "phase4_preflight",
  timestamp: new Date().toISOString(),
  git: {
    branch: null,
    head: null,
  },
  paypal: {
    mode,
    apiBaseHost: host,
    isSandboxHost,
    isLiveHost,
    refuseLive,
    hasClientId: present("PAYPAL_CLIENT_ID"),
    hasClientSecret: present("PAYPAL_CLIENT_SECRET"),
    hasPublicClientId: present("NEXT_PUBLIC_PAYPAL_CLIENT_ID"),
    hasSandboxCardNumber: present("PAYPAL_SANDBOX_TEST_CARD_NUMBER"),
    hasSandboxCardExpiry: present("PAYPAL_SANDBOX_TEST_CARD_EXPIRY"),
    hasSandboxCardCvv: present("PAYPAL_SANDBOX_TEST_CARD_CVV"),
  },
  supabase: {
    host: supabaseHost,
    projectRef,
    expectedProjectRef: "opbhcndlibbcsmoaeymq",
    projectMatches: projectRef === "opbhcndlibbcsmoaeymq",
    hasAnonKey: present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    hasServiceRole: present("SUPABASE_SERVICE_ROLE_KEY"),
  },
  testIdentity: {
    hasTestUserId: present("CARD_FUNDING_TEST_USER_ID") || present("TROPICASH_TEST_USER_ID"),
    hasTestEmail: present("TROPICASH_SANDBOX_TEST_EMAIL") || present("CARD_FUNDING_TEST_EMAIL"),
    hasTestPassword: present("TROPICASH_SANDBOX_TEST_PASSWORD") || present("CARD_FUNDING_TEST_PASSWORD"),
    hasSecondUserId: present("CARD_FUNDING_SECOND_USER_ID") || present("TROPICASH_SECOND_TEST_USER_ID"),
  },
  kyc: {
    requireApprovedFlag:
      env.TROPICASH_REQUIRE_APPROVED_KYC === undefined
        ? "unset_defaults_required"
        : String(env.TROPICASH_REQUIRE_APPROVED_KYC),
  },
  baselines: null,
  phase1: null,
  phase2: null,
  safety: {
    ok: false,
    blockers: [],
  },
};

try {
  const { execSync } = await import("child_process");
  out.git.branch = execSync("git branch --show-current", { cwd: root }).toString().trim();
  out.git.head = execSync("git rev-parse HEAD", { cwd: root }).toString().trim();
} catch {
  out.git.error = "git_unavailable";
}

if (refuseLive) out.safety.blockers.push("live_paypal_refused");
if (!isSandboxHost) out.safety.blockers.push("paypal_host_not_sandbox");
if (!out.paypal.hasClientId || !out.paypal.hasClientSecret) out.safety.blockers.push("paypal_credentials_missing");
if (!out.paypal.hasSandboxCardNumber || !out.paypal.hasSandboxCardExpiry || !out.paypal.hasSandboxCardCvv) {
  out.safety.blockers.push("sandbox_card_env_missing");
}
if (!out.supabase.projectMatches) out.safety.blockers.push("supabase_project_mismatch");
if (!out.supabase.hasAnonKey || !out.supabase.hasServiceRole) out.safety.blockers.push("supabase_keys_missing");
if (out.git.head !== "e8f7e6ab9b3c214fbe567a5bddf7e6f5951d92a8") {
  out.safety.blockers.push("unexpected_git_head");
}

if (out.supabase.hasServiceRole && out.supabase.host) {
  const admin = createClient(supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let testUserId =
    env.CARD_FUNDING_TEST_USER_ID ||
    env.TROPICASH_TEST_USER_ID ||
    null;

  if (!testUserId) {
    const { data: wallets } = await admin.from("wallets").select("user_id").not("user_id", "is", null).limit(1);
    testUserId = wallets?.[0]?.user_id || null;
  }

  const { count: txCount } = await admin.from("transactions").select("id", { count: "exact", head: true });
  const { count: orderCount } = await admin.from("paypal_funding_orders").select("id", { count: "exact", head: true });
  const { count: fundingKeys } = await admin.from("funding_idempotency_keys").select("id", { count: "exact", head: true });
  const { count: notifCount } = await admin.from("notifications").select("id", { count: "exact", head: true });
  const { count: transferKeys } = await admin.from("transfer_idempotency_keys").select("id", { count: "exact", head: true });
  const { count: withdrawalKeys } = await admin.from("withdrawal_idempotency_keys").select("id", { count: "exact", head: true });
  const { count: webhookEvents } = await admin.from("payout_webhook_events").select("id", { count: "exact", head: true });
  const { count: auditTimeline } = await admin.from("audit_timeline").select("id", { count: "exact", head: true });
  const { count: adminAudit } = await admin.from("admin_audit_logs").select("id", { count: "exact", head: true });

  let walletBalance = null;
  let kycStatus = null;
  if (testUserId) {
    const { data: wallet } = await admin
      .from("wallets")
      .select("wallet_balance")
      .eq("user_id", testUserId)
      .maybeSingle();
    walletBalance = wallet?.wallet_balance != null ? Number(wallet.wallet_balance) : null;
    const { data: kyc } = await admin
      .from("kyc_profiles")
      .select("status")
      .eq("user_id", testUserId)
      .maybeSingle();
    kycStatus = kyc?.status || "missing";
  }

  out.baselines = {
    testUserMasked: maskId(testUserId),
    walletBalance,
    transactionsCount: txCount ?? null,
    paypalFundingOrdersCount: orderCount ?? null,
    fundingIdempotencyKeysCount: fundingKeys ?? null,
    notificationsCount: notifCount ?? null,
    kycStatus,
  };

  out.phase2 = {
    transferIdempotencyPresent: transferKeys != null,
    withdrawalIdempotencyPresent: withdrawalKeys != null,
    payoutWebhookEventsPresent: webhookEvents != null,
    auditTimelinePresent: auditTimeline != null,
    adminAuditLogsPresent: adminAudit != null,
  };
}

// Phase 1 privilege checks via service SQL RPC are done separately with MCP;
// record structural expectations here.
out.phase1 = {
  expectedAuthExecuteFalse: [
    "fund_wallet",
    "transfer_funds",
    "create_withdrawal_request",
    "refund_withdrawal_request",
    "credit_paypal_funding_order",
  ],
  note: "Live privilege checks recorded in phase4 MCP verification",
};

out.safety.ok = out.safety.blockers.length === 0;

const outPath = path.join(root, "data", "results", "phase4_paypal_funding_preflight.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ok: out.safety.ok, blockers: out.safety.blockers, outPath: "data/results/phase4_paypal_funding_preflight.json" }));
process.exit(out.safety.ok ? 0 : 2);
