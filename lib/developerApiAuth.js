import { createSupabaseServiceClient } from './supabaseAdminApi';
import { hashApiSecret, recordApiUsage } from './developerCredentials';
import { sendUnauthorized, sendApiError } from './developerApiResponses';
import {
  checkDeveloperRateLimit,
  incrementDeveloperUsage,
} from './developerRateLimits';

/**
 * Tropicash Developer API — authentication + rate limit layer (Phase 12B/12C).
 *
 * Validates an incoming `Authorization: Bearer tc_test_...` credential against
 * the Phase 12A `developer_api_keys` vault, enforces credential state, applies
 * Phase 12C rate limits, records usage, and returns an authenticated developer
 * context.
 *
 * Gates (in order):
 *   1. Authentication  — valid, active, sandbox credential with live app/org.
 *   2. Rate limit      — within the per-hour / per-day sandbox allowance.
 * Only requests that pass BOTH gates are logged to developer_api_usage_logs.
 *
 * This helper is intentionally reusable. Future phases (payment intents, wallet,
 * checkout, webhooks, developer analytics) should call
 * `authenticateDeveloperApiRequest` / `requireDeveloperApiAuth` rather than
 * re-implementing credential checks.
 *
 * Security posture:
 *   • The plaintext secret is hashed (SHA-256, identical to Phase 12A) and only
 *     the hash is ever compared / queried.
 *   • secret_hash is never selected into the returned context.
 *   • Every failure returns the SAME generic result so callers cannot learn
 *     whether a key exists, is revoked, expired, or production-scoped.
 *   • Lookups run with the service-role client because API requests have no
 *     authenticated Supabase user session for RLS to evaluate.
 *   • Usage logging never records secrets, hashes, or Authorization headers.
 */

const RATE_LIMIT_ERROR = 'API rate limit exceeded';

const TABLE = 'developer_api_keys';
const CREDENTIAL_COLUMNS =
  'id, public_key, organization_id, app_id, environment, status, expires_at';

const TOKEN_PATTERN = /^tc_(test|live)_[A-Za-z0-9]+$/;

const isDev = process.env.NODE_ENV !== 'production';

function devLog(...args) {
  if (isDev) {
    console.log('[DEVELOPER_API_AUTH]', ...args);
  }
}

/**
 * Generic failure result. `reason` is for development logging only and is never
 * surfaced to the caller.
 * @param {string} reason
 */
function fail(reason) {
  devLog('rejected reason=' + reason);
  return { ok: false, error: 'Unauthorized API request' };
}

/**
 * Extract a Bearer token from the Authorization header.
 * @param {unknown} authHeader
 * @returns {string | null}
 */
function parseBearerToken(authHeader) {
  if (typeof authHeader !== 'string') return null;
  const trimmed = authHeader.trim();
  // Scheme is case-insensitive per RFC 7235; the token itself is not.
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  if (!match) return null;
  const token = match[1].trim();
  return token.length ? token : null;
}

/**
 * Authenticate a Developer API request.
 *
 * @param {import('next').NextApiRequest} req
 * @returns {Promise<
 *   | { ok: true, context: {
 *       api_key_id: string,
 *       public_key: string,
 *       organization_id: string,
 *       app_id: string,
 *       environment: string
 *     } }
 *   | { ok: false, error: string }
 * >}
 */
export async function authenticateDeveloperApiRequest(req) {
  // 1. Read the Authorization header.
  const authHeader = req?.headers?.authorization;

  // 2 + 3. Reject missing / non-Bearer / malformed tokens.
  const token = parseBearerToken(authHeader);
  if (!token) {
    return fail('missing_or_non_bearer');
  }
  if (!TOKEN_PATTERN.test(token)) {
    return fail('malformed_token');
  }

  // Service-role client: API requests carry no Supabase user session, so RLS
  // cannot scope the lookup. Service role bypasses RLS for this trusted check.
  const client = createSupabaseServiceClient();
  if (!client) {
    return fail('service_client_unavailable');
  }

  // 4. Hash the presented secret with the same method used at issuance.
  let secretHash;
  try {
    secretHash = await hashApiSecret(token);
  } catch {
    return fail('hash_error');
  }

  // 5. Look up by secret_hash (never select secret_hash back out).
  const { data: rows, error: lookupError } = await client
    .from(TABLE)
    .select(CREDENTIAL_COLUMNS)
    .eq('secret_hash', secretHash)
    .limit(1);

  if (lookupError) {
    return fail('lookup_error');
  }
  const credential = Array.isArray(rows) ? rows[0] : null;
  if (!credential) {
    return fail('unknown_key');
  }

  // 6. Confirm status = active (covers revoked/expired-by-status).
  if (credential.status !== 'active') {
    return fail('inactive_status:' + credential.status);
  }

  // 7. Confirm environment = sandbox (covers production + unknown environments).
  if (credential.environment !== 'sandbox') {
    return fail('non_sandbox_environment:' + credential.environment);
  }

  // Expiry guard: reject keys whose expires_at has passed.
  if (credential.expires_at) {
    const expiresAt = Date.parse(credential.expires_at);
    if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
      return fail('expired_key');
    }
  }

  // 8. Confirm the related app + organization still exist and are linked.
  const [{ data: app, error: appError }, { data: org, error: orgError }] =
    await Promise.all([
      client
        .from('developer_apps')
        .select('id, organization_id')
        .eq('id', credential.app_id)
        .maybeSingle(),
      client
        .from('developer_organizations')
        .select('id')
        .eq('id', credential.organization_id)
        .maybeSingle(),
    ]);

  if (appError || orgError) {
    return fail('relationship_lookup_error');
  }
  if (!app || !org) {
    return fail('deleted_relationship');
  }
  if (app.organization_id !== credential.organization_id) {
    return fail('relationship_mismatch');
  }

  // 9. Update last_used_at (Phase 12A helper, server-side client). Usage
  // tracking must never block authentication, so failures are logged only.
  const { error: usageError } = await recordApiUsage(credential.id, { client });
  if (usageError) {
    devLog('usage_update_failed', usageError.message || usageError);
  }

  // 10. Return the authenticated developer context (no secret material).
  const context = {
    api_key_id: credential.id,
    public_key: credential.public_key,
    organization_id: credential.organization_id,
    app_id: credential.app_id,
    environment: credential.environment,
  };

  devLog(
    `authenticated app=${context.app_id} org=${context.organization_id} environment=${context.environment}`,
  );

  return { ok: true, context };
}

/**
 * Derive the request endpoint path (query string stripped).
 * @param {import('next').NextApiRequest} req
 * @returns {string}
 */
function resolveEndpoint(req) {
  const url = typeof req?.url === 'string' ? req.url : '/';
  return url.split('?')[0] || '/';
}

/**
 * Best-effort client IP from common proxy headers.
 * @param {import('next').NextApiRequest} req
 * @returns {string | null}
 */
function resolveIpAddress(req) {
  const fwd = req?.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  if (Array.isArray(fwd) && fwd.length) {
    return String(fwd[0]).trim();
  }
  const real = req?.headers?.['x-real-ip'];
  if (typeof real === 'string' && real.trim()) {
    return real.trim();
  }
  return req?.socket?.remoteAddress || null;
}

/**
 * Resolve (or generate) a request id. Never derived from secret material.
 * @param {import('next').NextApiRequest} req
 * @returns {string}
 */
function resolveRequestId(req) {
  const headerId = req?.headers?.['x-request-id'];
  if (typeof headerId === 'string' && headerId.trim()) {
    return headerId.trim().slice(0, 128);
  }
  try {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Convenience wrapper for API route handlers. Runs both gates:
 *   1. Authentication — writes a generic 401 on failure.
 *   2. Rate limiting  — writes HTTP 429 `{ ok:false, error:"API rate limit exceeded" }`.
 * On success it records the request in the usage log and returns the developer
 * context; on any failure it returns null so the caller can simply `return`.
 *
 * @param {import('next').NextApiRequest} req
 * @param {import('next').NextApiResponse} res
 * @param {{ endpoint?: string; method?: string }} [options]
 * @returns {Promise<object | null>}
 */
export async function requireDeveloperApiAuth(req, res, options = {}) {
  // Gate 1 — authentication.
  const result = await authenticateDeveloperApiRequest(req);
  if (!result.ok) {
    sendUnauthorized(res);
    return null;
  }
  const context = result.context;

  const client = createSupabaseServiceClient();
  if (!client) {
    // Cannot evaluate limits / record usage — fail closed.
    devLog('rate_limit service_client_unavailable');
    sendUnauthorized(res);
    return null;
  }

  // Gate 2 — rate limiting.
  const rate = await checkDeveloperRateLimit(client, {
    apiKeyId: context.api_key_id,
    environment: context.environment,
  });
  if (!rate.allowed) {
    devLog(
      `rate_limited app=${context.app_id} org=${context.organization_id} reason=${rate.reason}`,
    );
    if (rate.retryAfterSeconds) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
    }
    sendApiError(res, 429, RATE_LIMIT_ERROR);
    return null;
  }

  // Record the successful (both gates passed) request. Logging must never block
  // the request, so failures are logged in development only.
  const endpoint =
    typeof options?.endpoint === 'string' ? options.endpoint : resolveEndpoint(req);
  const method =
    typeof options?.method === 'string' ? options.method : req?.method || 'GET';

  const { error: logError } = await incrementDeveloperUsage(client, {
    api_key_id: context.api_key_id,
    organization_id: context.organization_id,
    app_id: context.app_id,
    endpoint,
    method,
    status_code: 200,
    request_id: resolveRequestId(req),
    ip_address: resolveIpAddress(req),
  });
  if (logError) {
    devLog('usage_log_failed', logError.message || logError);
  }

  return context;
}
