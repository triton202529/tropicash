import { createClient } from "@supabase/supabase-js";
import { fetchIsAdminFromRpc } from "./adminAccess";

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || null;
}

export function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || null;
}

export function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function createSupabaseServiceClient() {
  const url = getSupabaseUrl();
  const key = getServiceRoleKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * @deprecated Use tc_is_admin() via fetchIsAdminFromRpc. Kept for transitional callers.
 */
export function isAdminEmail(email) {
  void email;
  return false;
}

/**
 * @param {string | undefined} authHeader
 * @returns {Promise<{ user: import('@supabase/supabase-js').User; jwt: string } | { error: string; status: number }>}
 */
export async function requireAdminFromBearer(authHeader) {
  const jwt =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
  if (!jwt) {
    return { error: "Unauthorized", status: 401 };
  }
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) {
    return { error: "Server configuration error", status: 500 };
  }
  const supabaseAuth = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(jwt);
  if (authError || !user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  const isAdmin = await fetchIsAdminFromRpc(supabaseAuth);
  if (!isAdmin) {
    return { error: "Admin access required", status: 403 };
  }
  return { user, jwt };
}
