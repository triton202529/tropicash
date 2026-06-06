import { logDeveloperApiRequest } from './developerApiUsage';

/**
 * Tropicash Developer Center — Phase 12C rate limit foundation.
 *
 * Rate limits are computed by counting rows in `developer_api_usage_logs` per
 * api_key_id inside rolling windows. The limiter is the SECOND gate, applied
 * only after authentication succeeds (the first gate).
 *
 * Design principle: FAIL CLOSED. Any uncertainty — missing client, unknown
 * environment, counting error, production usage — denies the request.
 */

const USAGE_TABLE = 'developer_api_usage_logs';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Per-environment rate limits. Production is reserved for a future release and
 * intentionally has no allowance (fail closed).
 */
export const DEVELOPER_RATE_LIMITS = {
  sandbox: { perHour: 100, perDay: 1000, reserved: false },
  production: { perHour: null, perDay: null, reserved: true },
};

/**
 * Resolve the rate limit policy for an environment.
 *
 * @param {string} environment
 * @returns {{ environment: string, perHour: number | null, perDay: number | null, reserved: boolean, supported: boolean }}
 */
export function getDeveloperRateLimit(environment) {
  const env = String(environment || '').trim();
  const config = DEVELOPER_RATE_LIMITS[env];
  if (!config) {
    return { environment: env, perHour: null, perDay: null, reserved: true, supported: false };
  }
  return { environment: env, ...config, supported: !config.reserved };
}

function deniedResult(reason, extra = {}) {
  return {
    allowed: false,
    reason,
    perHour: extra.perHour ?? null,
    perDay: extra.perDay ?? null,
    hourCount: extra.hourCount ?? null,
    dayCount: extra.dayCount ?? null,
    exceededScope: extra.exceededScope ?? null,
    retryAfterSeconds: extra.retryAfterSeconds ?? null,
  };
}

async function countWindow(client, apiKeyId, sinceIso) {
  const { count, error } = await client
    .from(USAGE_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gte('created_at', sinceIso);
  return { count: count ?? 0, error };
}

/**
 * Check whether a credential is within its rate limit window. Counts existing
 * logged requests; the caller records the new request only if allowed.
 *
 * Fails closed: returns `{ allowed: false }` on any error or unsupported
 * environment.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ apiKeyId: string; environment: string }} params
 * @returns {Promise<{
 *   allowed: boolean;
 *   reason?: string;
 *   perHour: number | null;
 *   perDay: number | null;
 *   hourCount: number | null;
 *   dayCount: number | null;
 *   exceededScope: 'hour' | 'day' | null;
 *   retryAfterSeconds: number | null;
 * }>}
 */
export async function checkDeveloperRateLimit(client, params = {}) {
  const apiKeyId = params?.apiKeyId;
  const environment = params?.environment;

  if (!client) {
    return deniedResult('no_client');
  }
  if (typeof apiKeyId !== 'string' || !apiKeyId.trim()) {
    return deniedResult('missing_api_key_id');
  }

  const limit = getDeveloperRateLimit(environment);
  if (!limit.supported || limit.perHour == null || limit.perDay == null) {
    // Production / unknown environments are not permitted yet — fail closed.
    return deniedResult('environment_not_supported', {
      perHour: limit.perHour,
      perDay: limit.perDay,
    });
  }

  const now = Date.now();
  const hourAgoIso = new Date(now - HOUR_MS).toISOString();
  const dayAgoIso = new Date(now - DAY_MS).toISOString();

  const [hourRes, dayRes] = await Promise.all([
    countWindow(client, apiKeyId.trim(), hourAgoIso),
    countWindow(client, apiKeyId.trim(), dayAgoIso),
  ]);

  if (hourRes.error || dayRes.error) {
    // Counting failed — deny rather than risk unbounded usage.
    return deniedResult('count_error', { perHour: limit.perHour, perDay: limit.perDay });
  }

  const hourCount = hourRes.count;
  const dayCount = dayRes.count;

  if (hourCount >= limit.perHour) {
    return deniedResult('hour_limit_exceeded', {
      perHour: limit.perHour,
      perDay: limit.perDay,
      hourCount,
      dayCount,
      exceededScope: 'hour',
      retryAfterSeconds: 3600,
    });
  }
  if (dayCount >= limit.perDay) {
    return deniedResult('day_limit_exceeded', {
      perHour: limit.perHour,
      perDay: limit.perDay,
      hourCount,
      dayCount,
      exceededScope: 'day',
      retryAfterSeconds: 86400,
    });
  }

  return {
    allowed: true,
    perHour: limit.perHour,
    perDay: limit.perDay,
    hourCount,
    dayCount,
    exceededScope: null,
    retryAfterSeconds: null,
  };
}

/**
 * Record a single successful request against a credential's usage. This is the
 * canonical "increment" — it appends one row to the usage log, which is exactly
 * what the rate-limit windows count.
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
export async function incrementDeveloperUsage(client, payload) {
  return logDeveloperApiRequest(client, payload);
}
