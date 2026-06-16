import { supabase } from './supabaseClient';
import { requireApiCredentialSandboxAccess } from './developerSandboxAccessPolicy';
import {
  logSandboxAccessDeniedFireAndForget,
  logSandboxActivityFireAndForget,
} from './developerSandboxMonitoring';

/**
 * Tropicash Developer Center — Phase 12A real API credential infrastructure.
 *
 * Security model (Stripe-style):
 *   • Public key  — non-secret publishable identifier, safe to display/store.
 *       sandbox    => tc_pub_test_xxxxxxxxxxxxxxxx
 *       production => tc_pub_live_xxxxxxxxxxxxxxxx
 *   • Secret key  — shown to the developer EXACTLY ONCE, never persisted.
 *       sandbox    => tc_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *       production => tc_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *
 * The database (developer_api_keys) stores only the SHA-256 hash of the secret.
 * The plaintext secret never leaves this module's return value.
 */

const TABLE = 'developer_api_keys';

const ENVIRONMENTS = new Set(['sandbox', 'production']);
const STATUSES = new Set(['active', 'revoked', 'expired']);

// Production issuance is intentionally gated off in Phase 12A. Sandbox only.
const ISSUABLE_ENVIRONMENTS = new Set(['sandbox']);

// Visible (non-secret) columns. secret_hash is deliberately excluded so the
// hash never travels to the client surfaces that render credential metadata.
const VISIBLE_COLUMNS =
  'id, organization_id, app_id, key_name, public_key, environment, status, created_at, last_used_at, expires_at, created_by';

const SECRET_RANDOM_LENGTH = 28;
const PUBLIC_RANDOM_LENGTH = 18;
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
  return { data: null, secret: null, error: { message, code: 'validation_error' } };
}

function getCrypto() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!c || !c.getRandomValues || !c.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment.');
  }
  return c;
}

/**
 * Cryptographically-strong base62 token of the requested length.
 * @param {number} length
 * @returns {string}
 */
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
 * SHA-256 hex digest of a UTF-8 string.
 * @param {string} input
 * @returns {Promise<string>}
 */
async function sha256Hex(input) {
  const c = getCrypto();
  const data = new TextEncoder().encode(String(input));
  const digest = await c.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Public, reusable hash for an API secret. Phase 12B authentication hashes the
 * presented bearer token with this exact method before looking up secret_hash,
 * guaranteeing the same digest produced at creation time.
 * @param {string} secret
 * @returns {Promise<string>}
 */
export async function hashApiSecret(secret) {
  return sha256Hex(secret);
}

/**
 * Build a fresh public/secret credential pair for an environment.
 * @param {string} environment
 * @returns {{ publicKey: string, secret: string }}
 */
function generateKeyPair(environment) {
  const envToken = environment === 'production' ? 'live' : 'test';
  const publicKey = `tc_pub_${envToken}_${randomToken(PUBLIC_RANDOM_LENGTH)}`;
  const secret = `tc_${envToken}_${randomToken(SECRET_RANDOM_LENGTH)}`;
  return { publicKey, secret };
}

/**
 * Create a new API credential for a developer app.
 *
 * Generates a public key + secret, stores only the SHA-256 hash of the secret,
 * and returns the plaintext secret exactly once.
 *
 * @param {{
 *   organization_id: string;
 *   app_id: string;
 *   key_name: string;
 *   environment?: string;
 *   created_by: string;
 *   expires_at?: string | null;
 * }} payload
 * @returns {Promise<{ data: object | null; secret: string | null; error: object | null }>}
 */
export async function createApiCredential(payload) {
  const organization_id = payload?.organization_id;
  const app_id = payload?.app_id;
  const key_name = payload?.key_name;
  const created_by = payload?.created_by;

  if (!isUuidLike(organization_id)) {
    return validationError('organization_id must be a valid UUID.');
  }
  if (!isUuidLike(app_id)) {
    return validationError('app_id must be a valid UUID.');
  }
  if (!isNonEmptyString(key_name)) {
    return validationError('key_name is required.');
  }
  if (!isUuidLike(created_by)) {
    return validationError('created_by must be a valid UUID.');
  }

  const accessCheck = await requireApiCredentialSandboxAccess(created_by.trim());
  if (!accessCheck.ok) {
    logSandboxAccessDeniedFireAndForget({
      user_id: created_by.trim(),
      developer_app_id: app_id,
      error_code: accessCheck.error?.code,
      capability: accessCheck.error?.capability,
      resource: 'api_credentials',
    });
    return {
      data: null,
      secret: null,
      error: accessCheck.error,
    };
  }

  const environment = ENVIRONMENTS.has(String(payload?.environment || '').trim())
    ? String(payload.environment).trim()
    : 'sandbox';

  if (!ISSUABLE_ENVIRONMENTS.has(environment)) {
    return validationError(
      'Production credentials are not available yet. Production access will be enabled in a future release.',
    );
  }

  let publicKey;
  let secret;
  let secret_hash;
  try {
    ({ publicKey, secret } = generateKeyPair(environment));
    secret_hash = await sha256Hex(secret);
  } catch (err) {
    return {
      data: null,
      secret: null,
      error: { message: err?.message || 'Failed to generate credential.', code: 'crypto_error' },
    };
  }

  const row = {
    organization_id: organization_id.trim(),
    app_id: app_id.trim(),
    key_name: key_name.trim(),
    public_key: publicKey,
    secret_hash,
    environment,
    status: 'active',
    created_by: created_by.trim(),
    expires_at: isNonEmptyString(payload?.expires_at)
      ? String(payload.expires_at).trim()
      : null,
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select(VISIBLE_COLUMNS)
    .single();

  if (error) {
    return { data: null, secret: null, error };
  }

  logSandboxActivityFireAndForget({
    user_id: created_by.trim(),
    developer_app_id: app_id.trim(),
    activity_type: 'credential_created',
    resource: 'developer_api_keys',
    metadata: { environment, key_name: key_name.trim() },
  });

  // Plaintext secret returned ONCE here; it is never stored or re-derivable.
  return { data, secret, error: null };
}

/**
 * Fetch visible credential metadata for a developer. Never returns secrets or
 * secret hashes. RLS additionally scopes rows to the caller's organizations.
 *
 * @param {string} userId
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchApiCredentials(userId) {
  if (!isUuidLike(userId)) {
    return { data: null, error: { message: 'A valid user id is required.', code: 'validation_error' } };
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select(VISIBLE_COLUMNS)
    .eq('created_by', userId.trim())
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * Revoke a credential. Immediately disables the key by setting status=revoked.
 *
 * @param {string} credentialId
 * @returns {Promise<{ data: object | null; error: object | null }>}
 */
export async function revokeApiCredential(credentialId) {
  if (!isUuidLike(credentialId)) {
    return { data: null, error: { message: 'A valid credential id is required.', code: 'validation_error' } };
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'revoked' })
    .eq('id', credentialId.trim())
    .select(VISIBLE_COLUMNS)
    .single();
  return { data, error };
}

/**
 * Rotate a credential: revoke the existing key and issue a brand-new replacement
 * credential (new public key + new secret) carrying the same metadata. Returns
 * the new plaintext secret exactly once.
 *
 * @param {string} credentialId
 * @param {{ rotated_by?: string }} [options]
 * @returns {Promise<{ data: object | null; secret: string | null; error: object | null }>}
 */
export async function rotateApiCredential(credentialId, options = {}) {
  if (!isUuidLike(credentialId)) {
    return validationError('A valid credential id is required.');
  }

  const { data: existing, error: fetchError } = await supabase
    .from(TABLE)
    .select(VISIBLE_COLUMNS)
    .eq('id', credentialId.trim())
    .single();

  if (fetchError) {
    return { data: null, secret: null, error: fetchError };
  }
  if (!existing) {
    return validationError('Credential not found.');
  }
  if (existing.status === 'revoked') {
    return validationError('Cannot rotate a credential that is already revoked.');
  }

  const createdBy = isUuidLike(options?.rotated_by)
    ? options.rotated_by
    : existing.created_by;

  const { data: created, secret, error: createError } = await createApiCredential({
    organization_id: existing.organization_id,
    app_id: existing.app_id,
    key_name: existing.key_name,
    environment: existing.environment,
    created_by: createdBy,
    expires_at: existing.expires_at,
  });

  if (createError) {
    return { data: null, secret: null, error: createError };
  }

  const { error: revokeError } = await revokeApiCredential(credentialId);
  if (revokeError) {
    // New credential exists but old one could not be revoked. Surface the error
    // and the new credential so the caller can react / retry the revocation.
    return {
      data: created,
      secret,
      error: revokeError,
    };
  }

  return { data: created, secret, error: null };
}

/**
 * Record API usage for a credential. Updates last_used_at to support future
 * usage analytics. Safe no-op error if the credential is not visible/owned.
 *
 * Pass `options.client` to run with a server-side (service-role) Supabase
 * client — required from API routes, which have no authenticated user session
 * for RLS. Defaults to the browser anon client used by the console.
 *
 * @param {string} credentialId
 * @param {{ usedAt?: string, client?: import('@supabase/supabase-js').SupabaseClient }} [options]
 * @returns {Promise<{ data: object | null; error: object | null }>}
 */
export async function recordApiUsage(credentialId, options = {}) {
  if (!isUuidLike(credentialId)) {
    return { data: null, error: { message: 'A valid credential id is required.', code: 'validation_error' } };
  }
  const client = options?.client || supabase;
  const usedAt = isNonEmptyString(options?.usedAt)
    ? String(options.usedAt).trim()
    : new Date().toISOString();

  const { data, error } = await client
    .from(TABLE)
    .update({ last_used_at: usedAt })
    .eq('id', credentialId.trim())
    .select(VISIBLE_COLUMNS)
    .single();
  return { data, error };
}

export const CREDENTIAL_ENVIRONMENTS = Array.from(ENVIRONMENTS);
export const CREDENTIAL_STATUSES = Array.from(STATUSES);
