/**
 * TLP-002: Admin member resolution via admin_members table (no hardcoded emails).
 */

let cachedPrimaryAdminId = null;
let cachedPrimaryAdminAt = 0;
const ADMIN_LOOKUP_TTL_MS = 5 * 60 * 1000;

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null | undefined} supabaseClient
 * @returns {Promise<string | null>}
 */
export async function resolvePrimaryAdminUserId(supabaseClient) {
  if (cachedPrimaryAdminId && Date.now() - cachedPrimaryAdminAt < ADMIN_LOOKUP_TTL_MS) {
    return cachedPrimaryAdminId;
  }
  if (!supabaseClient) return null;

  try {
    const { data, error } = await supabaseClient
      .from("admin_members")
      .select("user_id")
      .eq("active", true)
      .in("role", ["admin", "ops"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data?.user_id) return null;
    cachedPrimaryAdminId = String(data.user_id);
    cachedPrimaryAdminAt = Date.now();
    return cachedPrimaryAdminId;
  } catch {
    return null;
  }
}

export function clearPrimaryAdminCache() {
  cachedPrimaryAdminId = null;
  cachedPrimaryAdminAt = 0;
}
