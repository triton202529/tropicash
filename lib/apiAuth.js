/**
 * TLP-002: Shared JWT authentication for server money APIs.
 */

import { createClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "./supabaseAdminApi";

/**
 * @param {import('next').NextApiRequest} req
 * @returns {Promise<{ user: import('@supabase/supabase-js').User; jwt: string } | { error: string; status: number }>}
 */
export async function requireUserFromRequest(req) {
  const authHeader = req.headers.authorization;
  const jwt =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;
  if (!jwt) {
    return { error: "Unauthorized", status: 401 };
  }

  const supabaseUrl = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!supabaseUrl || !anonKey) {
    return { error: "Server configuration error", status: 500 };
  }

  const supabaseAuth = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(jwt);

  if (authError || !user?.id) {
    return { error: "Unauthorized", status: 401 };
  }

  return { user, jwt };
}
