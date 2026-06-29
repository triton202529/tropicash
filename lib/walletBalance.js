/**
 * TLP-002: Canonical wallet balance resolution.
 * Authoritative column: wallets.wallet_balance (legacy balance synced by RPCs).
 */

export const CANONICAL_WALLET_BALANCE_COLUMN = "wallet_balance";

/**
 * @param {{ wallet_balance?: unknown; balance?: unknown } | null | undefined} row
 * @returns {number}
 */
export function resolveWalletBalance(row) {
  const raw = row?.wallet_balance ?? row?.balance ?? 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {string} userId
 * @returns {Promise<{ balance: number; error: string | null }>}
 */
export async function fetchCanonicalWalletBalance(supabaseClient, userId) {
  if (!userId) return { balance: 0, error: "userId required" };
  const { data, error } = await supabaseClient
    .from("wallets")
    .select("wallet_balance, balance")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { balance: 0, error: error.message };
  return { balance: resolveWalletBalance(data), error: null };
}
