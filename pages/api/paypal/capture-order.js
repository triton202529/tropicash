import { createClient } from "@supabase/supabase-js";
import { capturePayPalOrder } from "../../../lib/paypal";

const DEFAULT_SUPABASE_URL = "https://opbhcndlibbcsmoaeymq.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wYmhjbmRsaWJiY3Ntb2FleW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMTM4NjIsImV4cCI6MjA2NzU4OTg2Mn0.Scy3QTema-fyccjeado4ZHoL2s5fjND8useCatvJRyA";

function getSupabaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  );
}

function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    DEFAULT_SUPABASE_ANON_KEY
  );
}

function formatMoney(value) {
  const n = Number(value);
  return Number(Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
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
    console.error("[paypal/capture-order] Missing SUPABASE_SERVICE_ROLE_KEY");
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
  const userId = user.id;

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const orderID = body?.orderID;
  if (!orderID || typeof orderID !== "string") {
    return res.status(400).json({ error: "orderID is required" });
  }

  let result;
  try {
    result = await capturePayPalOrder(orderID);
  } catch (err) {
    console.error("[paypal/capture-order] PayPal capture failed:", err);
    return res.status(502).json({
      error: err?.message || "Could not capture PayPal order",
    });
  }

  if (result.status !== "COMPLETED") {
    console.error("[paypal/capture-order] Unexpected PayPal status:", result.status);
    return res.status(502).json({
      error: "PayPal payment was not completed",
      paypalStatus: result.status,
    });
  }

  const amountStr =
    result.purchase_units?.[0]?.payments?.captures?.[0]?.amount?.value;
  const amountNum = amountStr != null ? Number(String(amountStr)) : NaN;
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    console.error("[paypal/capture-order] Missing or invalid capture amount");
    return res.status(502).json({ error: "Could not read captured amount from PayPal" });
  }

  if (amountNum > 1000) {
    return res.status(400).json({
      error: "Funding limit exceeded. Maximum sandbox funding amount is $1,000.",
    });
  }

  if (amountNum < 1) {
    return res.status(400).json({
      error: "Minimum funding amount is $1.",
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: dupRows, error: dupErr } = await supabaseAdmin
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "fund_wallet")
    .ilike("message", `%${orderID}%`)
    .limit(1);

  if (dupErr) {
    console.error("[paypal/capture-order] duplicate check failed:", dupErr);
    return res.status(500).json({ error: "Could not verify funding status" });
  }
  if (dupRows && dupRows.length > 0) {
    return res.status(409).json({
      error: "This PayPal order has already been processed.",
    });
  }

  const { error: fundError } = await supabaseAdmin.rpc("fund_wallet", {
    p_user_id: userId,
    p_amount: amountNum,
  });
  if (fundError) {
    console.error("[paypal/capture-order] fund_wallet RPC failed:", fundError);
    return res.status(500).json({
      error: fundError.message || "Could not credit wallet after payment",
    });
  }

  const amountText = formatMoney(amountNum);
  const { error: notifError } = await supabaseAdmin.rpc("create_notification", {
    p_user_id: userId,
    p_type: "fund_wallet",
    p_message: `Wallet funded $${amountText} via PayPal order ${orderID}`,
    p_title: "Wallet funded",
    p_related_transaction_id: null,
  });
  if (notifError) {
    console.error("[paypal/capture-order] create_notification failed:", notifError);
  }

  return res.status(200).json({
    success: true,
    amount: amountNum,
    orderID,
  });
}
