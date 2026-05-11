import { createClient } from "@supabase/supabase-js";
import { ADMIN_EMAILS } from "../../../../../lib/adminAccess";
import { logOperationalError } from "../../../../../lib/operationalLogger";
import { executeWithdrawalPayout } from "../../../../../lib/payouts/payoutService";

const DEFAULT_SUPABASE_URL = "https://opbhcndlibbcsmoaeymq.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wYmhjbmRsaWJiY3Ntb2FleW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMTM4NjIsImV4cCI6MjA2NzU4OTg2Mn0.Scy3QTema-fyccjeado4ZHoL2s5fjND8useCatvJRyA";

function getSupabaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL
  );
}

function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  );
}

function isAdminEmail(email) {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  return ADMIN_EMAILS.map((x) => String(x).trim().toLowerCase()).includes(e);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const withdrawalId = req.query?.id;
  if (!withdrawalId || typeof withdrawalId !== "string") {
    return res.status(400).json({ error: "Withdrawal id is required" });
  }

  const authHeader = req.headers.authorization;
  const jwt =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
  if (!jwt) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error("[admin/payout] Missing SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Server configuration error" });
  }

  const supabaseAuth = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(jwt);

  if (authError || !user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!isAdminEmail(user.email)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const forceRetry =
    req.body &&
    typeof req.body === "object" &&
    (req.body.retry === true || req.body.forceRetry === true);

  try {
    const result = await executeWithdrawalPayout(supabaseAdmin, withdrawalId, { forceRetry });
    return res.status(200).json({
      success: true,
      withdrawalId,
      status: result.status,
      processorStatus: result.processorStatus,
      batchId: result.batchId,
    });
  } catch (err) {
    const paypalError =
      err && typeof err === "object" && "paypalError" in err && err.paypalError && typeof err.paypalError === "object"
        ? err.paypalError
        : null;
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "admin.withdrawal_payout",
      message: err?.message || "executeWithdrawalPayout failed",
      userId: user.id,
      route: "/api/admin/withdrawals/[id]/payout",
      metadata: {
        withdrawalId,
        hasPayPalErrorDetails: !!paypalError,
        paypalErrorName: paypalError && typeof paypalError === "object" ? paypalError.name : undefined,
      },
    });
    if (paypalError) {
      return res.status(400).json({ error: "PayPal payout failed", details: paypalError });
    }

    const msg = err?.message || String(err);
    console.error("[admin/payout] executeWithdrawalPayout failed:", err);
    const lower = msg.toLowerCase();
    if (lower.includes("no payout destination")) {
      return res.status(400).json({ error: msg });
    }
    if (
      lower.includes("already") ||
      lower.includes("rejected") ||
      lower.includes("not allowed") ||
      lower.includes("cannot start")
    ) {
      return res.status(409).json({ error: msg });
    }
    return res.status(502).json({ error: msg });
  }
}
