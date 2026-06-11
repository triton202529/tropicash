/**
 * Tropicash — Phase 12O OAuth authorization code issuance + validation.
 *
 * Mints short-lived, single-use authorization codes after a valid consent
 * approval and validates them. Codes are stored as SHA-256 hashes ONLY; the
 * plaintext code is returned exactly once and never persisted.
 *
 * This module issues authorization CODES ONLY. It NEVER issues access tokens or
 * refresh tokens, calls wallet/transaction APIs, or moves money.
 *
 * All persistence runs against the SERVICE-ROLE Supabase client (the table is
 * service-role only under RLS). The caller (API route) must pass that client.
 */

import { hashApiSecret } from './developerCredentials';

const TABLE = 'oauth_authorization_codes';

// Visible (non-secret) columns. code_hash is never selected back out.
const VISIBLE_COLUMNS =
  'id, consent_id, client_id, scopes, redirect_uri, expires_at, used_at, created_at';

export const AUTHORIZATION_CODE_TTL_SECONDS = 600; // 10 minutes.

const CODE_RANDOM_LENGTH = 32;
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

/**
 * Generate a plaintext authorization code: tc_auth_xxxxxxxxxxxxxxxxx
 * @returns {string}
 */
export function generateAuthorizationCode() {
  const c = getCrypto();
  const bytes = new Uint8Array(CODE_RANDOM_LENGTH);
  c.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < CODE_RANDOM_LENGTH; i += 1) {
    out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length];
  }
  return `tc_auth_${out}`;
}

/**
 * SHA-256 hash of an authorization code (same digest used for API secrets).
 * @param {string} code
 * @returns {Promise<string>}
 */
export function hashAuthorizationCode(code) {
  return hashApiSecret(code);
}

/**
 * Create (mint) a single-use authorization code bound to a client + redirect
 * URI. Stores only the SHA-256 hash; returns the plaintext code once.
 *
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient;
 *   clientRowId: string;      // oauth_clients.id (uuid)
 *   redirectUri: string;
 *   scopes?: string[];
 *   consentId?: string | null;
 * }} params
 * @returns {Promise<{ data: object|null; authorizationCode: string|null; expiresIn: number|null; error: object|null }>}
 */
export async function createAuthorizationCode(params) {
  const client = params?.client;
  const clientRowId = params?.clientRowId;
  const redirectUri = params?.redirectUri;
  const scopes = Array.isArray(params?.scopes) ? params.scopes : [];
  const consentId = isUuidLike(params?.consentId) ? params.consentId.trim() : null;

  if (!client) {
    return { data: null, authorizationCode: null, expiresIn: null, error: { message: 'A Supabase client is required.', code: 'validation_error' } };
  }
  if (!isUuidLike(clientRowId)) {
    return { data: null, authorizationCode: null, expiresIn: null, error: { message: 'A valid client row id is required.', code: 'validation_error' } };
  }
  if (!isNonEmptyString(redirectUri)) {
    return { data: null, authorizationCode: null, expiresIn: null, error: { message: 'redirect_uri is required.', code: 'validation_error' } };
  }

  let authorizationCode;
  let code_hash;
  try {
    authorizationCode = generateAuthorizationCode();
    code_hash = await hashAuthorizationCode(authorizationCode);
  } catch (err) {
    return {
      data: null,
      authorizationCode: null,
      expiresIn: null,
      error: { message: err?.message || 'Failed to generate authorization code.', code: 'crypto_error' },
    };
  }

  const expiresAt = new Date(Date.now() + AUTHORIZATION_CODE_TTL_SECONDS * 1000).toISOString();

  const row = {
    consent_id: consentId,
    client_id: clientRowId.trim(),
    code_hash,
    scopes,
    redirect_uri: redirectUri.trim(),
    expires_at: expiresAt,
  };

  const { data, error } = await client
    .from(TABLE)
    .insert(row)
    .select(VISIBLE_COLUMNS)
    .single();

  if (error) {
    return { data: null, authorizationCode: null, expiresIn: null, error };
  }

  // Plaintext code returned ONCE; it is never stored or re-derivable.
  return {
    data,
    authorizationCode,
    expiresIn: AUTHORIZATION_CODE_TTL_SECONDS,
    error: null,
  };
}

/**
 * Validate an authorization code. Checks: exists, not expired, not used, client
 * matches, and redirect URI matches. Does NOT issue any token and does NOT mark
 * the code used (redemption is a future phase).
 *
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient;
 *   code: string;
 *   clientRowId: string;     // expected oauth_clients.id (uuid)
 *   redirectUri: string;
 * }} params
 * @returns {Promise<{ valid: boolean; reason: string|null; data: object|null }>}
 */
export async function validateAuthorizationCode(params) {
  const client = params?.client;
  const code = params?.code;
  const clientRowId = params?.clientRowId;
  const redirectUri = params?.redirectUri;

  if (!client || !isNonEmptyString(code)) {
    return { valid: false, reason: 'invalid_request', data: null };
  }

  let code_hash;
  try {
    code_hash = await hashAuthorizationCode(code);
  } catch {
    return { valid: false, reason: 'invalid_request', data: null };
  }

  const { data, error } = await client
    .from(TABLE)
    .select(VISIBLE_COLUMNS)
    .eq('code_hash', code_hash)
    .maybeSingle();

  if (error) {
    return { valid: false, reason: 'lookup_error', data: null };
  }
  if (!data) {
    return { valid: false, reason: 'unknown_code', data: null };
  }
  if (data.used_at) {
    return { valid: false, reason: 'already_used', data: null };
  }
  const expiresAt = Date.parse(data.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return { valid: false, reason: 'expired', data: null };
  }
  if (isUuidLike(clientRowId) && data.client_id !== clientRowId.trim()) {
    return { valid: false, reason: 'client_mismatch', data: null };
  }
  if (isNonEmptyString(redirectUri) && data.redirect_uri !== redirectUri.trim()) {
    return { valid: false, reason: 'redirect_uri_mismatch', data: null };
  }

  return { valid: true, reason: null, data };
}

/**
 * Atomically mark an authorization code as used (single-use enforcement).
 *
 * The update is guarded by `used_at IS NULL`, so a concurrent second exchange
 * updates zero rows and is reported via `alreadyUsed: true`. This closes the
 * race where two requests validate the same unused code simultaneously.
 *
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient;
 *   id: string;             // oauth_authorization_codes.id (uuid)
 *   usedAt?: string;
 * }} params
 * @returns {Promise<{ data: object|null; error: object|null; alreadyUsed: boolean }>}
 */
export async function markAuthorizationCodeUsed(params) {
  const client = params?.client;
  const id = params?.id;
  if (!client || !isUuidLike(id)) {
    return {
      data: null,
      error: { message: 'A valid authorization code id is required.', code: 'validation_error' },
      alreadyUsed: false,
    };
  }
  const usedAt = isNonEmptyString(params?.usedAt)
    ? String(params.usedAt).trim()
    : new Date().toISOString();

  const { data, error } = await client
    .from(TABLE)
    .update({ used_at: usedAt })
    .eq('id', id.trim())
    .is('used_at', null)
    .select(VISIBLE_COLUMNS)
    .maybeSingle();

  if (error) {
    return { data: null, error, alreadyUsed: false };
  }
  if (!data) {
    // No row updated: the code was already used (or no longer exists).
    return { data: null, error: null, alreadyUsed: true };
  }
  return { data, error: null, alreadyUsed: false };
}
