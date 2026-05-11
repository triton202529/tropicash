/**
 * Lightweight operational logging to Supabase. Never throws; insert failures are console-only.
 * Do not pass secrets, tokens, or raw card data — use sanitizeOperationalMetadata on caller metadata.
 */

const SENSITIVE_SUBSTRINGS = [
  "password",
  "passwd",
  "secret",
  "token",
  "authorization",
  "bearer",
  "cookie",
  "cardnumber",
  "card_number",
  "cvv",
  "apikey",
  "api_key",
  "access_token",
  "refresh_token",
  "service_role",
  "client_secret",
  "paypal_client",
];

function keyLooksSensitive(key) {
  const lower = String(key || "").toLowerCase();
  return SENSITIVE_SUBSTRINGS.some((s) => lower.includes(s));
}

/**
 * @param {unknown} input
 * @returns {Record<string, unknown>}
 */
export function sanitizeOperationalMetadata(input) {
  if (input == null) return {};
  if (typeof input !== "object" || Array.isArray(input)) return {};
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (keyLooksSensitive(k)) {
      out[k] = "[redacted]";
      continue;
    }
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeOperationalMetadata(v);
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item != null && typeof item === "object" && !Array.isArray(item)
          ? sanitizeOperationalMetadata(item)
          : item,
      );
    } else if (typeof v === "string" && v.length > 2000) {
      out[k] = `${v.slice(0, 500)}…[truncated]`;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function normalizeRoute(route) {
  if (route == null || typeof route !== "string") return null;
  const t = route.trim().slice(0, 500);
  return t.length ? t : null;
}

/**
 * @param {object} args
 * @param {'error'|'warn'|'info'} [args.level]
 * @param {string} args.category
 * @param {string} args.message
 * @param {Record<string, unknown>} [args.metadata]
 * @param {string|null} [args.userId]
 * @param {string|null} [args.route]
 * @param {import('@supabase/supabase-js').SupabaseClient|null} [args.supabaseClient]
 */
export async function logOperationalEvent(args) {
  const level = args.level || "info";
  const category = args.category;
  const message = args.message;
  if (!category || message == null || message === "") return;

  try {
    let client = args.supabaseClient ?? null;
    if (!client) {
      if (typeof window !== "undefined") {
        const mod = await import("./supabaseClient.js");
        client = mod.supabase;
      } else {
        const mod = await import("./supabaseAdminApi.js");
        client = mod.createSupabaseServiceClient();
      }
    }
    if (!client) {
      console.warn("[operationalLogger] skipped (no client)", { category, message: String(message).slice(0, 200) });
      return;
    }

    const uid = args.userId && typeof args.userId === "string" ? args.userId : null;
    if (typeof window !== "undefined" && !uid) {
      console.warn("[operationalLogger] skipped client insert without userId", { category });
      return;
    }

    const row = {
      level: String(level).slice(0, 64),
      category: String(category).slice(0, 128),
      message: String(message).slice(0, 10000),
      metadata: sanitizeOperationalMetadata(args.metadata && typeof args.metadata === "object" ? args.metadata : {}),
      user_id: uid,
      route: normalizeRoute(args.route),
    };

    const { error } = await client.from("operational_logs").insert(row);
    if (error) {
      console.error("[operationalLogger] insert failed:", error.message || error);
    }
  } catch (e) {
    console.error("[operationalLogger]", e?.message || e);
  }
}

/**
 * @param {Omit<Parameters<typeof logOperationalEvent>[0], 'level'>} args
 */
export async function logOperationalError(args) {
  return logOperationalEvent({ ...args, level: "error" });
}
