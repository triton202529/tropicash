/**
 * Tropicash — Phase 12U OAuth consent record creation engine.
 *
 * Records a user's OAuth consent grant in `oauth_consents` BEFORE any
 * authorization code is issued. This module ONLY records consent. It NEVER
 * issues authorization codes, access tokens, or refresh tokens, NEVER calls
 * wallet/transaction APIs, and NEVER moves money.
 *
 * Persistence runs against the SERVICE-ROLE Supabase client (writes to
 * oauth_consents are service-role only). The caller (API route) passes it in.
 */

import { OAUTH_SCOPE_CATALOG, getOAuthScope } from './oauthConsentModels';

const CONSENTS_TABLE = 'oauth_consents';

const VISIBLE_COLUMNS = 'id, user_id, client_id, scopes, status, granted_at, revoked_at';

export const CRITICAL_SCOPES = OAUTH_SCOPE_CATALOG.filter(
  (s) => s.riskLevel === 'critical',
).map((s) => s.scope);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isUuidLike(v) {
  if (!isNonEmptyString(v)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim(),
  );
}

/**
 * Normalize a scope list: trim, drop empties, dedupe, and sort. Used both to
 * persist a canonical scope set and to compare two grants for exact equality.
 *
 * @param {unknown} scopes
 * @returns {string[]}
 */
export function normalizeScopes(scopes) {
  const list = Array.isArray(scopes) ? scopes : [];
  const cleaned = list
    .map((s) => (typeof s === 'string' ? s.trim() : ''))
    .filter(Boolean);
  return Array.from(new Set(cleaned)).sort();
}

/**
 * True when two scope sets are exactly equal (order-independent).
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean}
 */
export function scopesEqual(a, b) {
  const na = normalizeScopes(a);
  const nb = normalizeScopes(b);
  if (na.length !== nb.length) return false;
  return na.every((s, i) => s === nb[i]);
}

function makeError(code, message) {
  return { code, message };
}

/**
 * Create (or safely reuse) an active OAuth consent record for a user/client/
 * scope grant.
 *
 * Validation:
 *   • userId + clientRowId must be UUIDs.
 *   • scopes must be non-empty and all known in OAUTH_SCOPE_CATALOG.
 *   • critical (money-movement) scopes are rejected.
 *   • the OAuth client must exist and be active.
 *
 * Idempotency: if an active consent already exists for the exact same
 * user/client/scope set, it is reused (no duplicate active record is created).
 *
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient;
 *   userId: string;            // auth.users.id (uuid)
 *   clientRowId: string;       // oauth_clients.id (uuid)
 *   scopes: string[];
 * }} params
 * @returns {Promise<{ data: object|null; reused: boolean; error: object|null }>}
 */
export async function createOAuthConsent(params) {
  const client = params?.client;
  const userId = params?.userId;
  const clientRowId = params?.clientRowId;

  if (!client) {
    return { data: null, reused: false, error: makeError('validation_error', 'A Supabase client is required.') };
  }
  if (!isUuidLike(userId)) {
    return { data: null, reused: false, error: makeError('invalid_user', 'A valid user_id is required.') };
  }
  if (!isUuidLike(clientRowId)) {
    return { data: null, reused: false, error: makeError('invalid_client', 'A valid client id is required.') };
  }

  const scopes = normalizeScopes(params?.scopes);
  if (!scopes.length) {
    return { data: null, reused: false, error: makeError('missing_scope', 'At least one scope is required.') };
  }

  const unknown = scopes.filter((s) => !getOAuthScope(s));
  if (unknown.length) {
    return { data: null, reused: false, error: makeError('unknown_scope', `Unknown scope(s): ${unknown.join(', ')}.`) };
  }

  const critical = scopes.filter((s) => CRITICAL_SCOPES.includes(s));
  if (critical.length) {
    return {
      data: null,
      reused: false,
      error: makeError('critical_scope_blocked', `Money-movement scopes are not available: ${critical.join(', ')}.`),
    };
  }

  // Confirm the OAuth client exists and is active.
  const { data: clientRow, error: clientError } = await client
    .from('oauth_clients')
    .select('id, status')
    .eq('id', clientRowId.trim())
    .maybeSingle();

  if (clientError) {
    return { data: null, reused: false, error: makeError('lookup_error', 'Could not validate the OAuth client.') };
  }
  if (!clientRow || clientRow.status !== 'active') {
    return { data: null, reused: false, error: makeError('inactive_client', 'The OAuth client is not active.') };
  }

  // Reuse an existing active consent for the exact same grant (no duplicates).
  const { data: existing, error: existingError } = await client
    .from(CONSENTS_TABLE)
    .select(VISIBLE_COLUMNS)
    .eq('user_id', userId.trim())
    .eq('client_id', clientRowId.trim())
    .eq('status', 'active');

  if (existingError) {
    return { data: null, reused: false, error: makeError('lookup_error', 'Could not check existing consents.') };
  }

  const match = (existing || []).find((row) => scopesEqual(row.scopes, scopes));
  if (match) {
    return { data: match, reused: true, error: null };
  }

  const { data, error } = await client
    .from(CONSENTS_TABLE)
    .insert({
      user_id: userId.trim(),
      client_id: clientRowId.trim(),
      scopes,
      status: 'active',
      granted_at: new Date().toISOString(),
      revoked_at: null,
    })
    .select(VISIBLE_COLUMNS)
    .single();

  if (error) {
    return { data: null, reused: false, error };
  }
  return { data, reused: false, error: null };
}

/**
 * Fetch a consent by id and confirm it belongs to a user, is active, is bound to
 * a given client, and (optionally) carries an exact scope set. Used by the
 * authorization-code endpoint to bind a code to a verified consent.
 *
 * @param {{
 *   client: import('@supabase/supabase-js').SupabaseClient;
 *   consentId: string;
 *   userId: string;
 *   clientRowId: string;
 *   scopes?: string[];
 * }} params
 * @returns {Promise<{ valid: boolean; reason: string|null; data: object|null }>}
 */
export async function verifyConsentForCode(params) {
  const client = params?.client;
  const consentId = params?.consentId;
  const userId = params?.userId;
  const clientRowId = params?.clientRowId;

  if (!client || !isUuidLike(consentId) || !isUuidLike(userId) || !isUuidLike(clientRowId)) {
    return { valid: false, reason: 'invalid_request', data: null };
  }

  const { data, error } = await client
    .from(CONSENTS_TABLE)
    .select(VISIBLE_COLUMNS)
    .eq('id', consentId.trim())
    .maybeSingle();

  if (error) return { valid: false, reason: 'lookup_error', data: null };
  if (!data) return { valid: false, reason: 'unknown_consent', data: null };
  if (data.user_id !== userId.trim()) return { valid: false, reason: 'consent_user_mismatch', data: null };
  if (data.status !== 'active') return { valid: false, reason: 'consent_inactive', data: null };
  if (data.client_id !== clientRowId.trim()) return { valid: false, reason: 'consent_client_mismatch', data: null };

  if (params?.scopes && !scopesEqual(data.scopes, params.scopes)) {
    return { valid: false, reason: 'consent_scope_mismatch', data: null };
  }

  return { valid: true, reason: null, data };
}
