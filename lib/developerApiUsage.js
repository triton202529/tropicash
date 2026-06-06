import { supabase } from './supabaseClient';

/**
 * Tropicash Developer Center — Phase 12C API usage logging.
 *
 * Writes append-only request records into `developer_api_usage_logs` and reads
 * usage summaries for the developer dashboard.
 *
 * Hard rule: this module NEVER persists secret keys, secret hashes, or
 * Authorization headers. Only the non-sensitive request shape is logged
 * (endpoint, method, status code, request id, ip address, timestamp).
 */

const TABLE = 'developer_api_usage_logs';

// Whitelisted, non-sensitive columns returned to dashboard surfaces.
const VISIBLE_COLUMNS =
  'id, api_key_id, organization_id, app_id, endpoint, method, status_code, request_id, ip_address, created_at';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isUuidLike(v) {
  if (!isNonEmptyString(v)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim(),
  );
}

function clampString(value, max) {
  if (!isNonEmptyString(value)) return null;
  const trimmed = String(value).trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/**
 * Append a single Developer API request to the usage log.
 *
 * Must be called with a server-side (service-role) Supabase client — usage logs
 * are written only from trusted server code, never the browser.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{
 *   api_key_id: string;
 *   organization_id: string;
 *   app_id: string;
 *   endpoint: string;
 *   method: string;
 *   status_code?: number | null;
 *   request_id?: string | null;
 *   ip_address?: string | null;
 * }} payload
 * @returns {Promise<{ data: object | null; error: object | null }>}
 */
export async function logDeveloperApiRequest(client, payload) {
  if (!client) {
    return { data: null, error: { message: 'A Supabase client is required.', code: 'client_required' } };
  }
  if (!isUuidLike(payload?.api_key_id)) {
    return { data: null, error: { message: 'api_key_id must be a valid UUID.', code: 'validation_error' } };
  }
  if (!isUuidLike(payload?.organization_id)) {
    return { data: null, error: { message: 'organization_id must be a valid UUID.', code: 'validation_error' } };
  }
  if (!isUuidLike(payload?.app_id)) {
    return { data: null, error: { message: 'app_id must be a valid UUID.', code: 'validation_error' } };
  }

  const statusCode =
    Number.isInteger(payload?.status_code) ? payload.status_code : null;

  // Explicitly build the row from a non-sensitive allow-list. There is no path
  // here for a secret, hash, or Authorization header to be persisted.
  const row = {
    api_key_id: payload.api_key_id.trim(),
    organization_id: payload.organization_id.trim(),
    app_id: payload.app_id.trim(),
    endpoint: clampString(payload?.endpoint, 512) || '/',
    method: (clampString(payload?.method, 16) || 'GET').toUpperCase(),
    status_code: statusCode,
    request_id: clampString(payload?.request_id, 128),
    ip_address: clampString(payload?.ip_address, 128),
  };

  const { data, error } = await client
    .from(TABLE)
    .insert(row)
    .select(VISIBLE_COLUMNS)
    .single();
  return { data, error };
}

async function countSince(client, sinceIso) {
  const { count, error } = await client
    .from(TABLE)
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sinceIso);
  return { count: count ?? 0, error };
}

/**
 * Build a usage summary for the developer dashboard.
 *
 * Cards (requests today / this hour, last request) are computed from the usage
 * log. `recent` returns the most recent rows within the selected range for the
 * dashboard table. Uses the browser anon client by default; RLS scopes rows to
 * the caller's organizations.
 *
 * @param {string} userId
 * @param {{
 *   rangeDays?: number;
 *   recentLimit?: number;
 *   client?: import('@supabase/supabase-js').SupabaseClient;
 * }} [options]
 * @returns {Promise<{ data: {
 *   requestsToday: number;
 *   requestsThisHour: number;
 *   lastRequestAt: string | null;
 *   recent: object[];
 * } | null; error: object | null }>}
 */
export async function getDeveloperApiUsageSummary(userId, options = {}) {
  if (!isUuidLike(userId)) {
    return { data: null, error: { message: 'A valid user id is required.', code: 'validation_error' } };
  }
  const client = options?.client || supabase;
  const rangeDays = Number.isFinite(options?.rangeDays) && options.rangeDays > 0
    ? Math.floor(options.rangeDays)
    : 1;
  const recentLimit = Number.isFinite(options?.recentLimit) && options.recentLimit > 0
    ? Math.floor(options.recentLimit)
    : 50;

  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const hourAgoIso = new Date(now - HOUR_MS).toISOString();
  const rangeStartIso = new Date(now - rangeDays * DAY_MS).toISOString();

  const [todayRes, hourRes, recentRes] = await Promise.all([
    countSince(client, startOfToday.toISOString()),
    countSince(client, hourAgoIso),
    client
      .from(TABLE)
      .select(VISIBLE_COLUMNS)
      .gte('created_at', rangeStartIso)
      .order('created_at', { ascending: false })
      .limit(recentLimit),
  ]);

  const error = todayRes.error || hourRes.error || recentRes.error || null;
  if (error) {
    return { data: null, error };
  }

  const recent = recentRes.data || [];
  return {
    data: {
      requestsToday: todayRes.count,
      requestsThisHour: hourRes.count,
      lastRequestAt: recent.length ? recent[0].created_at : null,
      recent,
    },
    error: null,
  };
}
