/**
 * Tropicash OAuth Platform — Phase 12Y OAuth-protected endpoint rate limits.
 *
 * Rolling-window limits per access_token_id, counted from `oauth_api_usage_logs`.
 * Applied as the second gate after successful token validation on protected OAuth
 * routes (e.g. /api/oauth/profile). Token exchange endpoints are excluded.
 *
 * Design principle: FAIL CLOSED — counting or insert errors deny the request.
 */

const USAGE_TABLE = 'oauth_api_usage_logs';
const HOUR_MS = 60 * 60 * 1000;

/** Per-scope hourly limits (requests per access_token_id). */
export const OAUTH_SCOPE_RATE_LIMITS = {
  'profile.read': 120,
  'wallet.read': 60,
  'transactions.read': 30,
};

export const OAUTH_DEFAULT_RATE_LIMIT_PER_HOUR = 120;

/**
 * Resolve the hourly limit for a set of granted scopes (most restrictive wins).
 *
 * @param {string[]} scopes
 * @returns {number}
 */
export function getOAuthRateLimitForScopes(scopes) {
  const list = Array.isArray(scopes) ? scopes : [];
  let limit = OAUTH_DEFAULT_RATE_LIMIT_PER_HOUR;
  let hasScopeLimit = false;

  for (const scope of list) {
    const scoped = OAUTH_SCOPE_RATE_LIMITS[scope];
    if (scoped != null) {
      hasScopeLimit = true;
      limit = Math.min(limit, scoped);
    }
  }

  return hasScopeLimit ? limit : OAUTH_DEFAULT_RATE_LIMIT_PER_HOUR;
}

/**
 * Map an OAuth protected endpoint path to its rate-limit bucket.
 *
 * @param {string} endpoint
 * @returns {number}
 */
export function getOAuthRateLimitForEndpoint(endpoint) {
  const ep = String(endpoint || '').toLowerCase();
  if (ep.includes('wallet')) return OAUTH_SCOPE_RATE_LIMITS['wallet.read'];
  if (ep.includes('transaction')) return OAUTH_SCOPE_RATE_LIMITS['transactions.read'];
  if (ep.includes('profile')) return OAUTH_SCOPE_RATE_LIMITS['profile.read'];
  return OAUTH_DEFAULT_RATE_LIMIT_PER_HOUR;
}

function deniedResult(reason, extra = {}) {
  return {
    allowed: false,
    reason,
    limitPerHour: extra.limitPerHour ?? null,
    hourCount: extra.hourCount ?? null,
    retryAfterSeconds: extra.retryAfterSeconds ?? 3600,
  };
}

async function countHourWindow(client, accessTokenId, sinceIso) {
  const { count, error } = await client
    .from(USAGE_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('access_token_id', accessTokenId)
    .gte('created_at', sinceIso);
  return { count: count ?? 0, error };
}

/**
 * Check whether an OAuth context is within its hourly rate limit for an endpoint.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{
 *   access_token_id: string;
 *   scopes?: string[];
 * }} context
 * @param {string} endpoint
 * @returns {Promise<{
 *   allowed: boolean;
 *   reason?: string;
 *   limitPerHour: number | null;
 *   hourCount: number | null;
 *   retryAfterSeconds: number | null;
 * }>}
 */
export async function checkOAuthRateLimit(client, context, endpoint) {
  const accessTokenId = context?.access_token_id;

  if (!client) {
    return deniedResult('no_client');
  }
  if (typeof accessTokenId !== 'string' || !accessTokenId.trim()) {
    return deniedResult('missing_access_token_id');
  }

  const limitPerHour = getOAuthRateLimitForEndpoint(endpoint);
  const hourAgoIso = new Date(Date.now() - HOUR_MS).toISOString();

  const { count, error } = await countHourWindow(client, accessTokenId.trim(), hourAgoIso);
  if (error) {
    return deniedResult('count_error', { limitPerHour, hourCount: null });
  }

  if (count >= limitPerHour) {
    return deniedResult('hour_limit_exceeded', {
      limitPerHour,
      hourCount: count,
      retryAfterSeconds: 3600,
    });
  }

  return {
    allowed: true,
    limitPerHour,
    hourCount: count,
    retryAfterSeconds: null,
  };
}

/**
 * Append one OAuth protected-API usage row (drives future rate-limit counts).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{
 *   access_token_id: string;
 *   client_row_id?: string | null;
 *   user_id?: string | null;
 * }} context
 * @param {string} endpoint
 * @param {string} method
 * @param {number | null} [status]
 * @returns {Promise<{ data: object | null; error: object | null }>}
 */
export async function recordOAuthEndpointUsage(client, context, endpoint, method, status) {
  if (!client) {
    return { data: null, error: { message: 'no_client' } };
  }

  const accessTokenId = context?.access_token_id;
  if (typeof accessTokenId !== 'string' || !accessTokenId.trim()) {
    return { data: null, error: { message: 'missing_access_token_id' } };
  }

  const row = {
    access_token_id: accessTokenId.trim(),
    client_id: context?.client_row_id ?? null,
    user_id: context?.user_id ?? null,
    endpoint: String(endpoint || '').trim() || 'unknown',
    method: String(method || 'GET').trim().toUpperCase(),
    status_code: status == null ? null : Number(status),
  };

  return client.from(USAGE_TABLE).insert(row).select('id').maybeSingle();
}
