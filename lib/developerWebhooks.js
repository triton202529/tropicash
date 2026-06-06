import { supabase } from './supabaseClient';
import { hashApiSecret } from './developerCredentials';

/**
 * Tropicash Developer Center — Phase 12D webhook foundation.
 *
 * Webhook endpoint registration, one-time signing secrets, HMAC-SHA256 payload
 * signing, and test delivery.
 *
 * Security model:
 *   • Signing secret format: whsec_xxxxxxxxxxxxxxxx (shown once at create/rotate).
 *   • Only the SHA-256 hash of the secret is stored (`secret_hash`) — never the
 *     plaintext, and `secret_hash` is never returned to the frontend.
 *   • Outgoing test events are signed with HMAC-SHA256 (X-Tropicash-Signature),
 *     keyed by the stored secret hash (the only server-side key material in this
 *     foundation phase). Full developer-verifiable signing keyed by the plaintext
 *     secret requires encrypted-at-rest secret storage and is deferred.
 */

const TABLE = 'developer_webhooks';

// Non-secret columns safe to surface to the console. secret_hash is excluded.
const VISIBLE_COLUMNS =
  'id, organization_id, app_id, url, status, created_at, updated_at, created_by';

const SECRET_RANDOM_LENGTH = 28;
const TOKEN_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const TEST_EVENT_TIMEOUT_MS = 8000;

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

function generateWebhookSecret() {
  return `whsec_${randomToken(SECRET_RANDOM_LENGTH)}`;
}

/**
 * Validate and normalize a webhook URL. Requires http(s); only allows http for
 * localhost/loopback to ease local testing.
 * @param {string} rawUrl
 * @returns {{ url: string } | { error: string }}
 */
export function validateWebhookUrl(rawUrl) {
  if (!isNonEmptyString(rawUrl)) {
    return { error: 'A webhook URL is required.' };
  }
  let parsed;
  try {
    parsed = new URL(String(rawUrl).trim());
  } catch {
    return { error: 'Enter a valid absolute URL (https://...).' };
  }
  const isHttps = parsed.protocol === 'https:';
  const host = parsed.hostname.toLowerCase();
  const isLocal =
    host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (!isHttps && !(parsed.protocol === 'http:' && isLocal)) {
    return { error: 'Webhook URL must use HTTPS.' };
  }
  return { url: parsed.toString() };
}

/**
 * HMAC-SHA256 hex signature of a message using the provided key.
 * @param {string} key
 * @param {string} message
 * @returns {Promise<string>}
 */
async function hmacSha256Hex(key, message) {
  const c = getCrypto();
  const enc = new TextEncoder();
  const cryptoKey = await c.subtle.importKey(
    'raw',
    enc.encode(String(key)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await c.subtle.sign('HMAC', cryptoKey, enc.encode(String(message)));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Sign a JSON payload with HMAC-SHA256.
 *
 * When a timestamp is provided the signed content is `${timestamp}.${body}`
 * (Stripe-style), defending against replay when paired with the timestamp
 * header.
 *
 * @param {object|string} payload  JSON-serializable payload (or pre-serialized string).
 * @param {string} secret          Signing key.
 * @param {{ timestamp?: number|string }} [options]
 * @returns {Promise<{ signature: string; timestamp: string | null; body: string }>}
 */
export async function signWebhookPayload(payload, secret, options = {}) {
  if (!isNonEmptyString(secret)) {
    throw new Error('A signing secret is required.');
  }
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
  const timestamp =
    options?.timestamp != null ? String(options.timestamp) : null;
  const signedContent = timestamp ? `${timestamp}.${body}` : body;
  const signature = await hmacSha256Hex(secret, signedContent);
  return { signature, timestamp, body };
}

/**
 * Create a webhook endpoint. Validates the URL, generates a one-time signing
 * secret, stores only its SHA-256 hash, and returns the plaintext secret once.
 *
 * @param {{
 *   organization_id: string;
 *   app_id: string;
 *   url: string;
 *   created_by: string;
 * }} payload
 * @returns {Promise<{ data: object | null; secret: string | null; error: object | null }>}
 */
export async function createDeveloperWebhook(payload) {
  if (!isUuidLike(payload?.organization_id)) {
    return validationError('organization_id must be a valid UUID.');
  }
  if (!isUuidLike(payload?.app_id)) {
    return validationError('app_id must be a valid UUID.');
  }
  if (!isUuidLike(payload?.created_by)) {
    return validationError('created_by must be a valid UUID.');
  }
  const urlCheck = validateWebhookUrl(payload?.url);
  if (urlCheck.error) {
    return validationError(urlCheck.error);
  }

  let secret;
  let secret_hash;
  try {
    secret = generateWebhookSecret();
    secret_hash = await hashApiSecret(secret);
  } catch (err) {
    return {
      data: null,
      secret: null,
      error: { message: err?.message || 'Failed to generate secret.', code: 'crypto_error' },
    };
  }

  const row = {
    organization_id: payload.organization_id.trim(),
    app_id: payload.app_id.trim(),
    url: urlCheck.url,
    secret_hash,
    status: 'active',
    created_by: payload.created_by.trim(),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select(VISIBLE_COLUMNS)
    .single();

  if (error) {
    return { data: null, secret: null, error };
  }
  // Plaintext secret returned ONCE here; it is never stored or re-derivable.
  return { data, secret, error: null };
}

/**
 * Fetch webhook metadata for a developer (never returns secret_hash). RLS
 * additionally scopes rows to organizations the caller owns.
 *
 * @param {string} userId
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchDeveloperWebhooks(userId) {
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
 * Disable a webhook (status = disabled). Developers disable instead of deleting.
 *
 * @param {string} webhookId
 * @returns {Promise<{ data: object | null; error: object | null }>}
 */
export async function disableDeveloperWebhook(webhookId) {
  if (!isUuidLike(webhookId)) {
    return { data: null, error: { message: 'A valid webhook id is required.', code: 'validation_error' } };
  }
  const { data, error } = await supabase
    .from(TABLE)
    .update({ status: 'disabled', updated_at: new Date().toISOString() })
    .eq('id', webhookId.trim())
    .select(VISIBLE_COLUMNS)
    .single();
  return { data, error };
}

/**
 * Rotate a webhook's signing secret. Generates a new secret, stores only its
 * hash, and returns the new plaintext secret once.
 *
 * @param {string} webhookId
 * @returns {Promise<{ data: object | null; secret: string | null; error: object | null }>}
 */
export async function rotateDeveloperWebhookSecret(webhookId) {
  if (!isUuidLike(webhookId)) {
    return validationError('A valid webhook id is required.');
  }

  let secret;
  let secret_hash;
  try {
    secret = generateWebhookSecret();
    secret_hash = await hashApiSecret(secret);
  } catch (err) {
    return {
      data: null,
      secret: null,
      error: { message: err?.message || 'Failed to generate secret.', code: 'crypto_error' },
    };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update({ secret_hash, updated_at: new Date().toISOString() })
    .eq('id', webhookId.trim())
    .select(VISIBLE_COLUMNS)
    .single();

  if (error) {
    return { data: null, secret: null, error };
  }
  return { data, secret, error: null };
}

/**
 * Build the standard developer test event payload.
 * @returns {object}
 */
export function buildWebhookTestEvent() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  const rand =
    c?.randomUUID?.().replace(/-/g, '').slice(0, 16) ||
    Math.random().toString(36).slice(2, 18);
  return {
    id: `evt_test_${rand}`,
    type: 'developer.test',
    created_at: new Date().toISOString(),
    data: {
      message: 'Tropicash webhook test successful',
    },
  };
}

/**
 * Send a signed test event to a webhook endpoint.
 *
 * Server-side only: requires a service-role client to look up the webhook
 * (including secret_hash, which never leaves the server). Confirms the webhook
 * belongs to the supplied organization/app and is active, signs the payload,
 * and POSTs it with signature headers.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client  service-role client
 * @param {{
 *   webhookId: string;
 *   organizationId: string;
 *   appId: string;
 *   payload?: object;
 * }} params
 * @returns {Promise<{ ok: boolean; status: number | null; error?: string }>}
 */
export async function sendDeveloperWebhookTestEvent(client, params = {}) {
  if (!client) {
    return { ok: false, status: null, error: 'server_misconfigured' };
  }
  if (!isUuidLike(params?.webhookId)) {
    return { ok: false, status: null, error: 'invalid_webhook_id' };
  }
  if (!isUuidLike(params?.organizationId) || !isUuidLike(params?.appId)) {
    return { ok: false, status: null, error: 'invalid_scope' };
  }

  const { data: webhook, error } = await client
    .from(TABLE)
    .select('id, organization_id, app_id, url, status, secret_hash')
    .eq('id', params.webhookId.trim())
    .maybeSingle();

  if (error || !webhook) {
    return { ok: false, status: null, error: 'not_found' };
  }
  // Ownership: webhook must belong to the authenticated credential's org + app.
  if (
    webhook.organization_id !== params.organizationId ||
    webhook.app_id !== params.appId
  ) {
    return { ok: false, status: null, error: 'forbidden' };
  }
  if (webhook.status !== 'active') {
    return { ok: false, status: null, error: 'disabled' };
  }

  const event = params?.payload || buildWebhookTestEvent();
  const timestamp = Math.floor(Date.now() / 1000);

  let signed;
  try {
    // Foundation-phase signing key: the stored secret hash (only server-side
    // key material; plaintext secret is intentionally not persisted).
    signed = await signWebhookPayload(event, webhook.secret_hash, { timestamp });
  } catch {
    return { ok: false, status: null, error: 'sign_error' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_EVENT_TIMEOUT_MS);
  try {
    const resp = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tropicash-Signature': signed.signature,
        'X-Tropicash-Timestamp': String(timestamp),
        'X-Tropicash-Event-Type': event.type,
        'User-Agent': 'Tropicash-Webhooks/12D',
      },
      body: signed.body,
      signal: controller.signal,
    });
    return { ok: resp.ok, status: resp.status };
  } catch {
    return { ok: false, status: null, error: 'delivery_failed' };
  } finally {
    clearTimeout(timer);
  }
}
