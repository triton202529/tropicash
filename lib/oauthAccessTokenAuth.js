/**
 * Tropicash — Phase 12R OAuth access token validation middleware + scope
 * enforcement.
 *
 * Reusable server-side helpers that validate an `Authorization: Bearer tc_at_…`
 * OAuth access token and enforce scopes on (future) user-authorized APIs. This
 * phase validates TOKENS ONLY — it exposes NO wallet/transaction APIs, NO money
 * movement, and NO user financial data.
 *
 * Security posture:
 *   • Tokens are matched by SHA-256 hash; the hash is never selected back out.
 *   • Every authentication failure returns the SAME generic `invalid_token`
 *     result so callers cannot learn whether a token is unknown, expired,
 *     revoked, or tied to a disabled client.
 *   • The returned context contains NO secret material (no token/refresh/secret
 *     hashes, no wallet data).
 *   • Lookups run with the service-role client (token tables are service-role
 *     only under RLS).
 */

import { createSupabaseServiceClient } from './supabaseAdminApi';
import { hashApiSecret } from './developerCredentials';
import {
  checkOAuthRateLimit,
  recordOAuthEndpointUsage,
} from './oauthRateLimits';
import {
  maybeCreateReviewCaseForRateLimit,
  maybeCreateReviewCaseForRevokedConsent,
} from './oauthSuspiciousAccess';

const ACCESS_TABLE = 'oauth_access_tokens';

// Non-secret columns. token_hash is deliberately never selected.
const ACCESS_VISIBLE_COLUMNS =
  'id, client_id, consent_id, scopes, expires_at, revoked_at';

const ACCESS_TOKEN_PATTERN = /^tc_at_[A-Za-z0-9]+$/;

const isDev = process.env.NODE_ENV !== 'production';

function devLog(...args) {
  if (isDev) {
    console.log('[OAUTH_ACCESS_TOKEN]', ...args);
  }
}

function isUuidLike(v) {
  if (typeof v !== 'string' || !v.trim()) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim(),
  );
}

/** Generic failure. `reason` is for dev logging only and never surfaced. */
function fail(reason) {
  devLog('rejected reason=' + reason);
  return { ok: false, error: 'invalid_token', reason };
}

/**
 * Extract a Bearer token from an Authorization header value.
 * @param {unknown} authHeader
 * @returns {string|null}
 */
function parseBearerToken(authHeader) {
  if (typeof authHeader !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length ? token : null;
}

/**
 * Authenticate an OAuth access token from a request.
 *
 * @param {{ headers?: Record<string, unknown> }} req
 * @param {{ client?: import('@supabase/supabase-js').SupabaseClient }} [options]
 * @returns {Promise<
 *   | { ok: true; context: {
 *       access_token_id: string;
 *       client_id: string|null;   // public text client_id
 *       app_id: string|null;
 *       user_id: string|null;
 *       scopes: string[];
 *       expires_at: string;
 *     }; clientRowId: string|null }
 *   | { ok: false; error: 'invalid_token'; reason: string }
 * >}
 */
export async function authenticateOAuthAccessToken(req, options = {}) {
  const token = parseBearerToken(req?.headers?.authorization);
  if (!token) {
    return fail('missing_token');
  }
  if (!ACCESS_TOKEN_PATTERN.test(token)) {
    return fail('malformed_token');
  }

  const client = options.client || createSupabaseServiceClient();
  if (!client) {
    return fail('service_client_unavailable');
  }

  let tokenHash;
  try {
    tokenHash = await hashApiSecret(token);
  } catch {
    return fail('hash_error');
  }

  const { data: tokenRow, error: lookupError } = await client
    .from(ACCESS_TABLE)
    .select(ACCESS_VISIBLE_COLUMNS)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (lookupError) {
    return fail('lookup_error');
  }
  if (!tokenRow) {
    return fail('unknown_token');
  }
  if (tokenRow.revoked_at) {
    return fail('revoked_token');
  }
  const expiresAt = Date.parse(tokenRow.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return fail('expired_token');
  }

  // Resolve the related consent (user_id) when linked. A revoked/missing
  // consent invalidates the token.
  let userId = null;
  if (isUuidLike(tokenRow.consent_id)) {
    const { data: consent, error: consentError } = await client
      .from('oauth_consents')
      .select('user_id, status')
      .eq('id', tokenRow.consent_id)
      .maybeSingle();
    if (consentError) {
      return fail('consent_lookup_error');
    }
    if (!consent || consent.status !== 'active') {
      // Server-side review case only — response remains generic invalid_token.
      try {
        await maybeCreateReviewCaseForRevokedConsent(client, {
          clientRowId: tokenRow.client_id ?? null,
          userId: consent?.user_id ?? null,
          accessTokenId: tokenRow.id ?? null,
        });
      } catch {
        /* best-effort */
      }
      return fail('consent_inactive');
    }
    userId = consent.user_id ?? null;
  }

  // Resolve client/app metadata when linked. A disabled client invalidates.
  let publicClientId = null;
  let appId = null;
  if (isUuidLike(tokenRow.client_id)) {
    const { data: clientRow, error: clientError } = await client
      .from('oauth_clients')
      .select('client_id, app_id, status')
      .eq('id', tokenRow.client_id)
      .maybeSingle();
    if (clientError) {
      return fail('client_lookup_error');
    }
    if (!clientRow || clientRow.status !== 'active') {
      return fail('client_inactive');
    }
    publicClientId = clientRow.client_id ?? null;
    appId = clientRow.app_id ?? null;
  }

  const context = {
    access_token_id: tokenRow.id,
    client_id: publicClientId,
    app_id: appId,
    user_id: userId,
    scopes: Array.isArray(tokenRow.scopes) ? tokenRow.scopes : [],
    expires_at: tokenRow.expires_at,
  };

  return { ok: true, context, clientRowId: tokenRow.client_id ?? null };
}

/**
 * True when the context carries the required scope.
 * @param {{ scopes?: string[] }} context
 * @param {string} requiredScope
 * @returns {boolean}
 */
export function requireOAuthScope(context, requiredScope) {
  if (!requiredScope) return true;
  const scopes = Array.isArray(context?.scopes) ? context.scopes : [];
  return scopes.includes(requiredScope);
}

/**
 * True when the context carries ALL required scopes.
 * @param {{ scopes?: string[] }} context
 * @param {string[]} requiredScopes
 * @returns {boolean}
 */
export function requireOAuthScopes(context, requiredScopes) {
  const required = Array.isArray(requiredScopes) ? requiredScopes : [];
  return required.every((scope) => requireOAuthScope(context, scope));
}

/**
 * Return the first required scope missing from the context, or null.
 * @param {{ scopes?: string[] }} context
 * @param {string[]} requiredScopes
 * @returns {string|null}
 */
export function findMissingScope(context, requiredScopes) {
  const required = Array.isArray(requiredScopes) ? requiredScopes : [];
  for (const scope of required) {
    if (!requireOAuthScope(context, scope)) return scope;
  }
  return null;
}

/** Best-effort audit write. Never logs plaintext tokens or hashes. */
async function writeAccessAudit(client, eventType, clientRowId, userId, metadata) {
  if (!client) return;
  try {
    await client.from('oauth_audit_events').insert({
      user_id: isUuidLike(userId) ? userId : null,
      client_id: isUuidLike(clientRowId) ? clientRowId : null,
      event_type: eventType,
      metadata: metadata || {},
    });
  } catch (err) {
    devLog('audit_failed', eventType, err?.message || err);
  }
}

/**
 * Reusable API-route guard. On failure it writes the response and returns null;
 * on success it returns the safe OAuth context.
 *
 *   401 { ok:false, error:'invalid_token' }
 *   403 { ok:false, error:'insufficient_scope', required_scope:'…' }
 *
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @param {{
 *   requiredScopes?: string[];
 *   endpoint?: string;
 *   method?: string;
 *   skipRateLimit?: boolean;
 * }} [options]
 * @returns {Promise<object|null>}
 */
export async function requireOAuthAccessToken(req, res, options = {}) {
  const client = createSupabaseServiceClient();
  const result = await authenticateOAuthAccessToken(req, { client });

  if (!result.ok) {
    await writeAccessAudit(client, 'access_token_rejected', null, null, {
      reason: result.reason,
    });
    res.status(401).json({ ok: false, error: 'invalid_token' });
    return null;
  }

  const { context, clientRowId } = result;
  const enrichedContext = {
    ...context,
    client_row_id: clientRowId,
  };

  const requiredScopes = Array.isArray(options?.requiredScopes)
    ? options.requiredScopes
    : [];
  const missing = findMissingScope(context, requiredScopes);
  if (missing) {
    await writeAccessAudit(client, 'access_token_rejected', clientRowId, context.user_id, {
      reason: 'insufficient_scope',
      required_scope: missing,
    });
    res.status(403).json({
      ok: false,
      error: 'insufficient_scope',
      required_scope: missing,
    });
    return null;
  }

  const endpoint = options?.endpoint;
  const skipRateLimit = options?.skipRateLimit === true;

  if (endpoint && !skipRateLimit) {
    const rateCheck = await checkOAuthRateLimit(client, enrichedContext, endpoint);
    if (!rateCheck.allowed) {
      await writeAccessAudit(client, 'oauth_rate_limit_exceeded', clientRowId, context.user_id, {
        endpoint,
        limit_per_hour: rateCheck.limitPerHour,
        hour_count: rateCheck.hourCount,
        reason: rateCheck.reason,
      });
      await maybeCreateReviewCaseForRateLimit(client, enrichedContext, endpoint, {
        limit_per_hour: rateCheck.limitPerHour,
        hour_count: rateCheck.hourCount,
        reason: rateCheck.reason,
      });
      if (rateCheck.retryAfterSeconds) {
        res.setHeader('Retry-After', String(rateCheck.retryAfterSeconds));
      }
      res.status(429).json({ ok: false, error: 'rate_limit_exceeded' });
      return null;
    }

    const method = options?.method || req?.method || 'GET';
    await recordOAuthEndpointUsage(client, enrichedContext, endpoint, method, null);
  }

  await writeAccessAudit(client, 'access_token_validated', clientRowId, context.user_id, {
    client_id: context.client_id,
    scopes: context.scopes,
    endpoint: endpoint || null,
  });

  return enrichedContext;
}
