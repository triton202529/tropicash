import { createClient } from "@supabase/supabase-js";
import { ADMIN_EMAILS } from "./adminAccess";

const DEFAULT_SUPABASE_URL = "https://opbhcndlibbcsmoaeymq.supabase.co";
const DEFAULT_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wYmhjbmRsaWJiY3Ntb2FleW1xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMTM4NjIsImV4cCI6MjA2NzU4OTg2Mn0.Scy3QTema-fyccjeado4ZHoL2s5fjND8useCatvJRyA";

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
}

export function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
  );
}

export function getServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || null;
}

export function createSupabaseServiceClient() {
  const url = getSupabaseUrl();
  const key = getServiceRoleKey();
  if (!key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isAdminEmail(email) {
  const e = String(email || "")
    .trim()
    .toLowerCase();
  return ADMIN_EMAILS.map((x) => String(x).trim().toLowerCase()).includes(e);
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
  const supabaseAuth = createClient(url, anonKey);
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(jwt);
  if (authError || !user?.id) {
    return { error: "Unauthorized", status: 401 };
  }
  if (!isAdminEmail(user.email)) {
    return { error: "Admin access required", status: 403 };
  }
  return { user, jwt };
}
