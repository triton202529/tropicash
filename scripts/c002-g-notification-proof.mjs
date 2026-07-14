/**
 * Prove wallet_funded notification works after CHECK fix (no new PayPal charge).
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
function mask(id) {
  if (!id || typeof id !== "string") return null;
  if (id.length <= 8) return "***";
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

const env = { ...loadEnv(path.join(root, ".env")), ...loadEnv(path.join(root, ".env.local")) };
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: wallets } = await admin.from("wallets").select("user_id").not("user_id", "is", null).limit(1);
const userId = wallets?.[0]?.user_id;
const { data: txs } = await admin
  .from("transactions")
  .select("id")
  .eq("type", "fund")
  .order("created_at", { ascending: false })
  .limit(1);
const txId = txs?.[0]?.id || null;

const before = new Date().toISOString();
const { error } = await admin.rpc("create_notification", {
  p_user_id: userId,
  p_type: "wallet_funded",
  p_message: "C-002 G notification proof after type CHECK fix",
  p_title: "Wallet funding completed",
  p_related_transaction_id: txId,
});
const { data: rows } = await admin
  .from("notifications")
  .select("id,type,created_at")
  .eq("user_id", userId)
  .eq("type", "wallet_funded")
  .gte("created_at", before)
  .limit(1);

const out = {
  ok: !error && (rows?.length || 0) === 1,
  notificationCreated: !error,
  rowPresent: (rows?.length || 0) === 1,
  type: rows?.[0]?.type || null,
  userIdMasked: mask(userId),
  txIdMasked: mask(txId),
  error: error ? { code: error.code || null, message: String(error.message || "").slice(0, 160) } : null,
  timestamp: new Date().toISOString(),
};
console.log(JSON.stringify(out, null, 2));
fs.writeFileSync(path.join(root, "data", "results", "card_funding_notification_proof.json"), JSON.stringify(out, null, 2));
process.exit(out.ok ? 0 : 1);
