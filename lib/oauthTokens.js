/**
 * Tropicash — Phase 12P OAuth access + refresh token issuance.
 *
 * Mints access and refresh tokens during the authorization-code → token
 * exchange and persists them into the Phase 12K token tables. Tokens are stored
 * as SHA-256 hashes ONLY; the plaintext tokens are returned exactly once and
 * never persisted.
 *
 * This module issues TOKENS ONLY. It NEVER calls wallet/transaction APIs,
 * exposes user financial data, or moves money.
 *
 * Persistence runs against the SERVICE-ROLE Supabase client (the token tables
 * are service-role only under RLS). The caller (API route) must pass it.
 */

import { hashApiSecret } from './developerCredentials';

const ACCESS_TABLE = 'oauth_access_tokens';
const REFRESH_TABLE = 'oauth_refresh_tokens';

export const ACCESS_TOKEN_PATTERN = /^tc_at_[A-Za-z0-9]+$/;
export const REFRESH_TOKEN_PATTERN = /^tc_rt_[A-Za-z0-9]+$/;

// Non-secret columns. token_hash is never selected.
const ACCESS_VISIBLE_COLUMNS = 'id, client_id, revoked_at';

export const ACCESS_TOKEN_TTL_SECONDS = 3600; // 1 hour.
export const REFRESH_TOKEN_TTL_SECONDS = 2592000; // 30 days.

const TOKEN_RANDOM_LENGTH = 40;
const TOKEN_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isUuidLike(v) {
  if (!isNonEmptyString(v)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim(),
  );
}

function getCrypto() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!c || !c.getRandomValues) {
    throw new Error('Web Crypto API is unavailable in this environment.');
  }
  return c;
}

function randomToken(length) {
  const c = getCrypto();
  const bytes = new Uint8Array(length);
  c.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return out;
}

/**
 * Generate a plaintext access token: tc_at_xxxxxxxxxxxxxxxxx
 * @returns {string}
 */
export function generateAccessToken() {
  return `tc_at_${randomToken(TOKEN_RANDOM_LENGTH)}`;
}

/**
 * Generate a plaintext refresh token: tc_rt_xxxxxxxxxxxxxxxxx
 * @returns {string}
 */
export function generateRefreshToken() {
  return `tc_rt_${randomToken(TOKEN_RANDOM_LENGTH)}`;
}

/**
 * Issue an access + refresh token pair for a successful code exchange.
 *
 * Stores only SHA-256 hashes; returns plaintext tokens once. consent_id may be
 * null in this foundation phase (token tables accept a nullable consent link).
 *
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient;
 *   scopes?: string[];
 *   consentId?: string | null;
 *   clientRowId?: string | null;   // oauth_clients.id — binds the refresh token.
 * }} params
 * @returns {Promise<{
 *   accessToken: string|null;
 *   refreshToken: string|null;
 *   accessExpiresAt: string|null;
 *   refreshExpiresAt: string|null;
 *   accessExpiresIn: number|null;
 *   scopes: string[];
 *   error: object|null;
 * }>}
 */
export async function issueTokensForCode(params) {
  const client = params?.client;
  const scopes = Array.isArray(params?.scopes) ? params.scopes : [];
  const consentId = isUuidLike(params?.consentId) ? params.consentId.trim() : null;
  const clientRowId = isUuidLike(params?.clientRowId) ? params.clientRowId.trim() : null;

  const failure = (error) => ({
    accessToken: null,
    refreshToken: null,
    accessExpiresAt: null,
    refreshExpiresAt: null,
    accessExpiresIn: null,
    scopes,
    error,
  });

  if (!client) {
    return failure({ message: 'A Supabase client is required.', code: 'validation_error' });
  }

  let accessToken;
  let refreshToken;
  let accessHash;
  let refreshHash;
  try {
    accessToken = generateAccessToken();
    refreshToken = generateRefreshToken();
    [accessHash, refreshHash] = await Promise.all([
      hashApiSecret(accessToken),
      hashApiSecret(refreshToken),
    ]);
  } catch (err) {
    return failure({ message: err?.message || 'Failed to generate tokens.', code: 'crypto_error' });
  }

  const now = Date.now();
  const accessExpiresAt = new Date(now + ACCESS_TOKEN_TTL_SECONDS * 1000).toISOString();
  const refreshExpiresAt = new Date(now + REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString();

  // Insert the access token first.
  const { data: accessRow, error: accessError } = await client
    .from(ACCESS_TABLE)
    .insert({
      consent_id: consentId,
      client_id: clientRowId,
      token_hash: accessHash,
      scopes,
      expires_at: accessExpiresAt,
    })
    .select('id')
    .single();

  if (accessError) {
    return failure(accessError);
  }

  // Then the refresh token (bound to the client + carrying scopes forward). If
  // this fails, revoke the access token we just created so we never leave a
  // dangling access token without its refresh pair.
  const { error: refreshError } = await client
    .from(REFRESH_TABLE)
    .insert({
      consent_id: consentId,
      client_id: clientRowId,
      token_hash: refreshHash,
      scopes,
      expires_at: refreshExpiresAt,
    });

  if (refreshError) {
    await client
      .from(ACCESS_TABLE)
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', accessRow.id);
    return failure(refreshError);
  }

  return {
    accessToken,
    refreshToken,
    accessExpiresAt,
    refreshExpiresAt,
    accessExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
    scopes,
    error: null,
  };
}

// Non-secret columns for a refresh token row. token_hash is never selected out.
const REFRESH_VISIBLE_COLUMNS =
  'id, consent_id, client_id, scopes, expires_at, created_at, revoked_at';

/**
 * Validate a presented refresh token.
 *
 * Checks: hash exists, not expired, not revoked, client matches the
 * authenticated client, and (when a consent link exists) the consent is still
 * active. A revoked token is reported with reason 'revoked' so the caller can
 * flag reuse.
 *
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient;
 *   refreshToken: string;
 *   clientRowId: string;          // authenticated oauth_clients.id
 * }} params
 * @returns {Promise<{ valid: boolean; reason: string|null; data: object|null }>}
 */
export async function validateRefreshToken(params) {
  const client = params?.client;
  const refreshToken = params?.refreshToken;
  const clientRowId = params?.clientRowId;

  if (!client || !isNonEmptyString(refreshToken)) {
    return { valid: false, reason: 'invalid_request', data: null };
  }

  let tokenHash;
  try {
    tokenHash = await hashApiSecret(refreshToken);
  } catch {
    return { valid: false, reason: 'invalid_request', data: null };
  }

  const { data, error } = await client
    .from(REFRESH_TABLE)
    .select(REFRESH_VISIBLE_COLUMNS)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) {
    return { valid: false, reason: 'lookup_error', data: null };
  }
  if (!data) {
    return { valid: false, reason: 'unknown_token', data: null };
  }
  // Revoked tokens are surfaced (with the row) so callers can detect reuse.
  if (data.revoked_at) {
    return { valid: false, reason: 'revoked', data };
  }
  const expiresAt = Date.parse(data.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return { valid: false, reason: 'expired', data };
  }
  if (isUuidLike(clientRowId) && data.client_id && data.client_id !== clientRowId.trim()) {
    return { valid: false, reason: 'client_mismatch', data };
  }
  // If linked to a consent, that consent must still be active.
  if (isUuidLike(data.consent_id)) {
    const { data: consent, error: consentError } = await client
      .from('oauth_consents')
      .select('id, status')
      .eq('id', data.consent_id)
      .maybeSingle();
    if (consentError) {
      return { valid: false, reason: 'lookup_error', data };
    }
    if (!consent || consent.status !== 'active') {
      return { valid: false, reason: 'consent_inactive', data };
    }
  }

  return { valid: true, reason: null, data };
}

/**
 * Revoke a refresh token by id, guarded by `revoked_at IS NULL` so a concurrent
 * rotation revokes zero rows and is reported via `alreadyRevoked: true`.
 *
 * @param {{ client: import('@supabase/supabase-js').SupabaseClient; id: string; revokedAt?: string }} params
 * @returns {Promise<{ data: object|null; error: object|null; alreadyRevoked: boolean }>}
 */
export async function revokeRefreshTokenById(params) {
  const client = params?.client;
  const id = params?.id;
  if (!client || !isUuidLike(id)) {
    return {
      data: null,
      error: { message: 'A valid refresh token id is required.', code: 'validation_error' },
      alreadyRevoked: false,
    };
  }
  const revokedAt = isNonEmptyString(params?.revokedAt)
    ? String(params.revokedAt).trim()
    : new Date().toISOString();

  const { data, error } = await client
    .from(REFRESH_TABLE)
    .update({ revoked_at: revokedAt })
    .eq('id', id.trim())
    .is('revoked_at', null)
    .select(REFRESH_VISIBLE_COLUMNS)
    .maybeSingle();

  if (error) {
    return { data: null, error, alreadyRevoked: false };
  }
  if (!data) {
    return { data: null, error: null, alreadyRevoked: true };
  }
  return { data, error: null, alreadyRevoked: false };
}

/**
 * Rotate a refresh token: validate it, revoke it immediately (single-use), then
 * issue a brand-new access + refresh token pair carrying the same scopes/consent
 * and bound to the same client. Fail-closed: if the new pair cannot be minted,
 * the old token stays revoked (already consumed).
 *
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient;
 *   refreshToken: string;
 *   clientRowId: string;
 * }} params
 * @returns {Promise<
 *   | { ok: true; accessToken: string; refreshToken: string; accessExpiresAt: string; refreshExpiresAt: string; accessExpiresIn: number; scopes: string[] }
 *   | { ok: false; reason: string; reuse: boolean }
 * >}
 */
export async function rotateRefreshToken(params) {
  const client = params?.client;
  const clientRowId = params?.clientRowId;

  const validation = await validateRefreshToken({
    client,
    refreshToken: params?.refreshToken,
    clientRowId,
  });

  if (!validation.valid) {
    // A presented-but-revoked token is reuse of an already-rotated token.
    const reuse = validation.reason === 'revoked';
    return { ok: false, reason: validation.reason || 'invalid_grant', reuse };
  }

  const oldRow = validation.data;

  // Revoke the old token FIRST (single-use). A concurrent rotation that already
  // revoked it is treated as reuse.
  const revoked = await revokeRefreshTokenById({ client, id: oldRow.id });
  if (revoked.error) {
    return { ok: false, reason: 'revoke_failed', reuse: false };
  }
  if (revoked.alreadyRevoked) {
    return { ok: false, reason: 'revoked', reuse: true };
  }

  const scopes = Array.isArray(oldRow.scopes) ? oldRow.scopes : [];
  const issued = await issueTokensForCode({
    client,
    scopes,
    consentId: oldRow.consent_id ?? null,
    clientRowId: clientRowId ?? oldRow.client_id ?? null,
  });

  if (issued.error || !issued.accessToken || !issued.refreshToken) {
    // Fail closed: the old token remains revoked (already consumed).
    return { ok: false, reason: 'issue_failed', reuse: false };
  }

  return {
    ok: true,
    accessToken: issued.accessToken,
    refreshToken: issued.refreshToken,
    accessExpiresAt: issued.accessExpiresAt,
    refreshExpiresAt: issued.refreshExpiresAt,
    accessExpiresIn: issued.accessExpiresIn,
    scopes,
  };
}

/**
 * True when the presented token string matches the expected OAuth token format.
 * When a hint is provided, only that type's prefix is accepted.
 *
 * @param {string} token
 * @param {'access_token'|'refresh_token'|null|undefined} [tokenTypeHint]
 * @returns {boolean}
 */
export function isOAuthTokenFormatValid(token, tokenTypeHint) {
  if (!isNonEmptyString(token)) return false;
  const hint = typeof tokenTypeHint === 'string' ? tokenTypeHint.trim() : '';
  if (hint === 'access_token') return ACCESS_TOKEN_PATTERN.test(token);
  if (hint === 'refresh_token') return REFRESH_TOKEN_PATTERN.test(token);
  return ACCESS_TOKEN_PATTERN.test(token) || REFRESH_TOKEN_PATTERN.test(token);
}

/**
 * Revoke a single access-token row when it belongs to the authenticated client.
 * Returns revoked:false without disclosing wrong-client vs unknown-token.
 *
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient;
 *   tokenHash: string;
 *   clientRowId: string;
 *   revokedAt?: string;
 * }} params
 * @returns {Promise<{ revoked: boolean; matchedType: 'access_token'|null }>}
 */
async function revokeAccessTokenByHash(params) {
  const { client, tokenHash, clientRowId } = params;
  const revokedAt = isNonEmptyString(params?.revokedAt)
    ? String(params.revokedAt).trim()
    : new Date().toISOString();

  const { data, error } = await client
    .from(ACCESS_TABLE)
    .select(ACCESS_VISIBLE_COLUMNS)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) {
    return { revoked: false, matchedType: null };
  }
  if (!isUuidLike(clientRowId) || data.client_id !== clientRowId.trim()) {
    return { revoked: false, matchedType: null };
  }
  if (data.revoked_at) {
    return { revoked: false, matchedType: 'access_token' };
  }

  const { data: updated, error: updateError } = await client
    .from(ACCESS_TABLE)
    .update({ revoked_at: revokedAt })
    .eq('id', data.id)
    .eq('client_id', clientRowId.trim())
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (updateError || !updated) {
    return { revoked: false, matchedType: 'access_token' };
  }
  return { revoked: true, matchedType: 'access_token' };
}

/**
 * Revoke a single refresh-token row when it belongs to the authenticated client.
 *
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient;
 *   tokenHash: string;
 *   clientRowId: string;
 *   revokedAt?: string;
 * }} params
 * @returns {Promise<{ revoked: boolean; matchedType: 'refresh_token'|null }>}
 */
async function revokeRefreshTokenByHash(params) {
  const { client, tokenHash, clientRowId } = params;
  const revokedAt = isNonEmptyString(params?.revokedAt)
    ? String(params.revokedAt).trim()
    : new Date().toISOString();

  const { data, error } = await client
    .from(REFRESH_TABLE)
    .select(REFRESH_VISIBLE_COLUMNS)
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error || !data) {
    return { revoked: false, matchedType: null };
  }
  if (!isUuidLike(clientRowId) || data.client_id !== clientRowId.trim()) {
    return { revoked: false, matchedType: null };
  }
  if (data.revoked_at) {
    return { revoked: false, matchedType: 'refresh_token' };
  }

  const { data: updated, error: updateError } = await client
    .from(REFRESH_TABLE)
    .update({ revoked_at: revokedAt })
    .eq('id', data.id)
    .eq('client_id', clientRowId.trim())
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (updateError || !updated) {
    return { revoked: false, matchedType: 'refresh_token' };
  }
  return { revoked: true, matchedType: 'refresh_token' };
}

/**
 * Standards-style OAuth token revocation (RFC 7009-inspired). Authenticated
 * clients may revoke their own access or refresh tokens. Unknown, malformed,
 * or foreign-client tokens return revoked:false without disclosure.
 *
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient;
 *   token: string;
 *   tokenTypeHint?: string | null;
 *   clientRowId: string;           // authenticated oauth_clients.id (uuid)
 * }} params
 * @returns {Promise<{ revoked: boolean; matchedType: string|null }>}
 */
export async function revokeOAuthToken(params) {
  const client = params?.client;
  const token = params?.token;
  const clientRowId = params?.clientRowId;
  const hintRaw = typeof params?.tokenTypeHint === 'string' ? params.tokenTypeHint.trim() : '';
  const hint = hintRaw === 'access_token' || hintRaw === 'refresh_token' ? hintRaw : null;

  if (!client || !isNonEmptyString(token) || !isUuidLike(clientRowId)) {
    return { revoked: false, matchedType: null };
  }
  if (!isOAuthTokenFormatValid(token, hint)) {
    return { revoked: false, matchedType: null };
  }

  let tokenHash;
  try {
    tokenHash = await hashApiSecret(token);
  } catch {
    return { revoked: false, matchedType: null };
  }

  const revokedAt = new Date().toISOString();
  const lookupArgs = { client, tokenHash, clientRowId, revokedAt };

  if (hint === 'access_token') {
    return revokeAccessTokenByHash(lookupArgs);
  }
  if (hint === 'refresh_token') {
    return revokeRefreshTokenByHash(lookupArgs);
  }

  // No hint: use prefix when possible, otherwise check both tables safely.
  if (ACCESS_TOKEN_PATTERN.test(token)) {
    const access = await revokeAccessTokenByHash(lookupArgs);
    if (access.revoked || access.matchedType) return access;
  }
  if (REFRESH_TOKEN_PATTERN.test(token)) {
    return revokeRefreshTokenByHash(lookupArgs);
  }

  const access = await revokeAccessTokenByHash(lookupArgs);
  if (access.revoked) return access;
  return revokeRefreshTokenByHash(lookupArgs);
}
