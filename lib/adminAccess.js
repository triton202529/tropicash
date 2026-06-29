/**
 * TLP-002: Admin access via admin_members table (tc_is_admin RPC).
 * No hardcoded email allowlists in application code.
 */

/**
 * @param {import('@supabase/supabase-js').User | null | undefined} user
 * @param {object | null | undefined} profile
 * @param {boolean | null | undefined} isAdminFromRpc — from userContext / tc_is_admin()
 */
export function isAdminUser(user, profile, isAdminFromRpc) {
  if (typeof isAdminFromRpc === "boolean") {
    return isAdminFromRpc;
  }
  if (profile?.is_admin === true) {
    return true;
  }
  return false;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @returns {Promise<boolean>}
 */
export async function fetchIsAdminFromRpc(supabaseClient) {
  if (!supabaseClient) return false;
  try {
    const { data, error } = await supabaseClient.rpc("tc_is_admin");
    if (error) {
      console.warn("[adminAccess] tc_is_admin RPC failed:", error.message);
      return false;
    }
    return data === true;
  } catch (err) {
    console.warn("[adminAccess] tc_is_admin error:", err?.message || err);
    return false;
  }
}
