import { supabase } from './supabaseClient';
import { hashApiSecret } from './developerCredentials';
import { requireOAuthSandboxAccess } from './developerSandboxAccessPolicy';
import {
  logSandboxAccessDeniedFireAndForget,
  logSandboxActivityFireAndForget,
} from './developerSandboxMonitoring';

/**
 * Tropicash Developer Platform — Phase 12L OAuth client registration.
 *
 * Manages OAuth CLIENTS ONLY — registration, secret issuance, rotation, and
 * disable. There is NO OAuth authorization flow, NO access/refresh tokens, NO
 * consent, NO authorization codes, and NO wallet/money-movement behavior here.
 *
 * Security model (mirrors the API-key + webhook model):
 *   • client_id format: tc_client_xxxxxxxxxxxxxxxx (non-secret identifier).
 *   • client secret  : tc_secret_xxxxxxxxxxxxxxxx — shown ONCE, never persisted.
 *   • Only the SHA-256 hash of the secret is stored (client_secret_hash).
 *   • Ownership is enforced by RLS (oauth_clients.app_id → developer_apps owned
 *     by the caller); admins may override.
 */

const TABLE = 'oauth_clients';

// Non-secret columns. client_secret_hash is deliberately never selected back.
const VISIBLE_COLUMNS =
  'id, app_id, client_id, client_name, redirect_uris, status, created_at, updated_at';

const CLIENT_ID_RANDOM_LENGTH = 18;
const SECRET_RANDOM_LENGTH = 28;
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

function validationError(message) {
  return { data: null, secret: null, clientId: null, error: { message, code: 'validation_error' } };
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
 * Generate a fresh OAuth client_id + client secret pair.
 * @returns {{ clientId: string; secret: string }}
 */
export function generateOAuthClientCredentials() {
  return {
    clientId: `tc_client_${randomToken(CLIENT_ID_RANDOM_LENGTH)}`,
    secret: `tc_secret_${randomToken(SECRET_RANDOM_LENGTH)}`,
  };
}

/**
 * Validate a single redirect URI.
 *   • Must be an absolute URL.
 *   • HTTPS required; http allowed only for localhost/loopback in sandbox.
 *   • No wildcards.
 *   • No fragment component.
 *
 * @param {string} rawUri
 * @param {{ environment?: string }} [options]
 * @returns {{ uri: string } | { error: string }}
 */
export function validateRedirectUri(rawUri, options = {}) {
  const environment = String(options?.environment || 'sandbox').trim().toLowerCase();
  if (!isNonEmptyString(rawUri)) {
    return { error: 'A redirect URI is required.' };
  }
  const trimmed = String(rawUri).trim();
  if (trimmed.includes('*')) {
    return { error: 'Wildcards are not allowed in redirect URIs.' };
  }
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { error: `Enter a valid absolute URL (https://…): ${trimmed}` };
  }
  if (parsed.hash) {
    return { error: 'Redirect URIs must not contain a fragment (#…).' };
  }
  const host = parsed.hostname.toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const isHttps = parsed.protocol === 'https:';
  const isHttp = parsed.protocol === 'http:';

  if (isHttps) {
    return { uri: parsed.toString() };
  }
  if (isHttp && isLocal && environment === 'sandbox') {
    return { uri: parsed.toString() };
  }
  if (isHttp && isLocal && environment !== 'sandbox') {
    return { error: 'http://localhost is only allowed in sandbox.' };
  }
  return { error: `Redirect URI must use HTTPS: ${trimmed}` };
}

/**
 * Validate + normalize a list (array or newline/comma-separated string) of
 * redirect URIs. Requires at least one; de-duplicates.
 *
 * @param {string|string[]} input
 * @param {{ environment?: string }} [options]
 * @returns {{ uris: string[] } | { error: string }}
 */
export function validateRedirectUris(input, options = {}) {
  let list = [];
  if (Array.isArray(input)) {
    list = input;
  } else if (isNonEmptyString(input)) {
    list = String(input).split(/[\n,]/);
  }
  const cleaned = list.map((s) => String(s).trim()).filter(Boolean);
  if (!cleaned.length) {
    return { error: 'At least one redirect URI is required.' };
  }
  const out = [];
  for (const candidate of cleaned) {
    const result = validateRedirectUri(candidate, options);
    if (result.error) {
      return { error: result.error };
    }
    if (!out.includes(result.uri)) {
      out.push(result.uri);
    }
  }
  return { uris: out };
}

/**
 * Register a new OAuth client for a developer app.
 *
 * Generates a client_id + secret, stores only the SHA-256 hash of the secret,
 * and returns the plaintext secret + client_id exactly once.
 *
 * @param {{
 *   app_id: string;
 *   client_name: string;
 *   redirect_uris: string|string[];
 *   environment?: string;
 *   user_id: string;
 * }} payload
 * @returns {Promise<{ data: object|null; clientId: string|null; secret: string|null; error: object|null }>}
 */
export async function createOAuthClient(payload) {
  const app_id = payload?.app_id;
  const client_name = payload?.client_name;
  const user_id = payload?.user_id;
  const environment = String(payload?.environment || 'sandbox').trim().toLowerCase();

  if (!isUuidLike(app_id)) {
    return validationError('app_id must be a valid UUID.');
  }
  if (!isUuidLike(user_id)) {
    return validationError('user_id must be a valid UUID.');
  }
  if (!isNonEmptyString(client_name)) {
    return validationError('client_name is required.');
  }

  const accessCheck = await requireOAuthSandboxAccess(user_id.trim());
  if (!accessCheck.ok) {
    logSandboxAccessDeniedFireAndForget({
      user_id: user_id.trim(),
      developer_app_id: app_id,
      error_code: accessCheck.error?.code,
      resource: 'oauth_clients',
    });
    return {
      data: null,
      clientId: null,
      secret: null,
      error: accessCheck.error,
    };
  }

  const redirectCheck = validateRedirectUris(payload?.redirect_uris, { environment });
  if (redirectCheck.error) {
    return validationError(redirectCheck.error);
  }

  let clientId;
  let secret;
  let client_secret_hash;
  try {
    ({ clientId, secret } = generateOAuthClientCredentials());
    client_secret_hash = await hashApiSecret(secret);
  } catch (err) {
    return {
      data: null,
      clientId: null,
      secret: null,
      error: { message: err?.message || 'Failed to generate client credentials.', code: 'crypto_error' },
    };
  }

  const row = {
    app_id: app_id.trim(),
    client_id: clientId,
    client_secret_hash,
    client_name: client_name.trim(),
    redirect_uris: redirectCheck.uris,
    status: 'active',
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select(VISIBLE_COLUMNS)
    .single();

  if (error) {
    return { data: null, clientId: null, secret: null, error };
  }

  logSandboxActivityFireAndForget({
    user_id: user_id.trim(),
    developer_app_id: app_id.trim(),
    activity_type: 'oauth_client_created',
    resource: 'oauth_clients',
    metadata: { client_name: client_name.trim(), environment },
  });

  // Plaintext secret + client_id returned ONCE; secret is never re-derivable.
  return { data, clientId, secret, error: null };
}

/**
 * Fetch visible OAuth client metadata. RLS scopes rows to clients tied to apps
 * the caller owns (admins see all). Never returns the secret hash.
 *
 * @param {string} userId
 * @returns {Promise<{ data: object[]|null; error: object|null }>}
 */
export async function fetchOAuthClients(userId) {
  if (!isUuidLike(userId)) {
    return { data: null, error: { message: 'A valid user id is required.', code: 'validation_error' } };
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select(VISIBLE_COLUMNS)
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * Rotate an OAuth client's secret. Generates a new secret, stores only its
 * hash, keeps the same client_id, and returns the new plaintext secret once.
 *
 * @param {string} clientRowId  oauth_clients.id (uuid)
 * @returns {Promise<{ data: object|null; secret: string|null; error: object|null }>}
 */
export async function rotateOAuthClientSecret(clientRowId) {
  if (!isUuidLike(clientRowId)) {
    return { data: null, secret: null, error: { message: 'A valid client id is required.', code: 'validation_error' } };
  }

  let secret;
  let client_secret_hash;
  try {
    ({ secret } = generateOAuthClientCredentials());
    client_secret_hash = await hashApiSecret(secret);
  } catch (err) {
    return {
      data: null,
      secret: null,
      error: { message: err?.message || 'Failed to generate secret.', code: 'crypto_error' },
    };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ client_secret_hash, updated_at: new Date().toISOString() })
    .eq('id', clientRowId.trim())
    .select(VISIBLE_COLUMNS)
    .single();

  if (error) {
    return { data: null, secret: null, error };
  }
  return { data, secret, error: null };
}

/**
 * Disable an OAuth client (status = disabled). Developers disable instead of
 * deleting.
 *
 * @param {string} clientRowId  oauth_clients.id (uuid)
 * @returns {Promise<{ data: object|null; error: object|null }>}
 */
export async function disableOAuthClient(clientRowId) {
  if (!isUuidLike(clientRowId)) {
    return { data: null, error: { message: 'A valid client id is required.', code: 'validation_error' } };
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'disabled', updated_at: new Date().toISOString() })
    .eq('id', clientRowId.trim())
    .select(VISIBLE_COLUMNS)
    .single();
  return { data, error };
}
