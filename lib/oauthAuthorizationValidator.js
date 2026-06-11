/**
 * Tropicash — Phase 12N server-side OAuth authorization request validator.
 *
 * Authoritatively validates an incoming `/oauth/authorize` request against the
 * registered `oauth_clients` record: client existence/status, exact redirect
 * URI match (no wildcards), response_type, and scope (known + non-critical).
 *
 * This module ONLY validates. It NEVER:
 *   • issues authorization codes, access tokens, or refresh tokens,
 *   • creates consent records,
 *   • calls wallet/transaction APIs, or
 *   • moves money.
 *
 * It NEVER returns secret material (client_secret_hash, token hashes, owner
 * email, wallet data). The returned `client` carries only client_id,
 * client_name, and status.
 */

import { createSupabaseServiceClient } from './supabaseAdminApi';
import {
  parseAuthorizationRequest,
  resolveScopeItems,
  SUPPORTED_RESPONSE_TYPES,
  CRITICAL_RISK_LEVEL,
  MONEY_MOVEMENT_BLOCKED_MESSAGE,
} from './oauthConsentUi';

const HIGH_RISK_LEVEL = 'high';

function makeError(code, message) {
  return { code, message };
}

/**
 * Exact redirect URI match against the registered list. No wildcard matching.
 * A normalized (URL.toString()) comparison is allowed so trivial formatting
 * (e.g. trailing slash) does not cause a false mismatch, but the host/path/etc.
 * must still match exactly.
 *
 * @param {string[]} registered
 * @param {string} incoming
 * @returns {boolean}
 */
function redirectUriMatches(registered, incoming) {
  const list = Array.isArray(registered) ? registered : [];
  const value = String(incoming || '').trim();
  if (!value) return false;
  if (list.includes(value)) return true;

  let normalizedIncoming;
  try {
    normalizedIncoming = new URL(value).toString();
  } catch {
    return false;
  }
  return list.some((entry) => {
    if (entry === value) return true;
    try {
      return new URL(entry).toString() === normalizedIncoming;
    } catch {
      return false;
    }
  });
}

/**
 * Build the safe, non-secret scope descriptors returned on success.
 * @param {{ definition: object }[]} knownItems
 */
function toSafeScopes(knownItems) {
  return knownItems.map((item) => ({
    scope: item.definition.scope,
    label: item.definition.label,
    riskLevel: item.definition.riskLevel,
    description: item.definition.userFacingDescription,
    requiresUserConsent: item.definition.requiresUserConsent,
    requiresAdminApproval: item.definition.requiresAdminApproval,
    requiresStepUpAuth: item.definition.requiresStepUpAuth,
  }));
}

/**
 * Validate an OAuth authorization request.
 *
 * @param {{
 *   client_id?: string;
 *   redirect_uri?: string;
 *   response_type?: string;
 *   scope?: string;
 *   state?: string;
 * }} params
 * @param {{ client?: import('@supabase/supabase-js').SupabaseClient }} [options]
 * @returns {Promise<
 *   | { ok: true; client: { client_id: string; client_name: string|null; status: string }; scopes: object[]; warnings: string[] }
 *   | { ok: false; errors: { code: string; message: string }[]; warnings: string[] }
 * >}
 */
export async function validateOAuthAuthorizationRequest(params, options = {}) {
  const request = parseAuthorizationRequest(params || {});
  const errors = [];
  const warnings = [];

  // --- Structural checks -----------------------------------------------------
  if (!request.clientId) errors.push(makeError('missing_client_id', 'client_id is required.'));
  if (!request.redirectUri) errors.push(makeError('missing_redirect_uri', 'redirect_uri is required.'));
  if (!request.responseType) {
    errors.push(makeError('missing_response_type', 'response_type is required.'));
  } else if (!SUPPORTED_RESPONSE_TYPES.includes(request.responseType)) {
    errors.push(makeError('unsupported_response_type', 'Only response_type=code is supported.'));
  }
  if (!request.scopeRaw || !request.scopes.length) {
    errors.push(makeError('missing_scope', 'scope is required.'));
  }

  // --- Scope analysis --------------------------------------------------------
  const items = resolveScopeItems(request.scopes);
  const knownItems = items.filter((i) => i.known);
  const unknownScopes = items.filter((i) => !i.known).map((i) => i.scope);
  if (unknownScopes.length) {
    errors.push(
      makeError('unknown_scope', `Unknown scope(s): ${unknownScopes.join(', ')}.`),
    );
  }
  const criticalScopes = knownItems
    .filter((i) => i.definition.riskLevel === CRITICAL_RISK_LEVEL)
    .map((i) => i.scope);
  if (criticalScopes.length) {
    errors.push(makeError('critical_scope_blocked', MONEY_MOVEMENT_BLOCKED_MESSAGE));
  }
  knownItems
    .filter((i) => i.definition.riskLevel === HIGH_RISK_LEVEL)
    .forEach((i) => {
      warnings.push(`${i.definition.label} grants access to sensitive account data.`);
    });
  if (!request.state) {
    warnings.push(
      'No state parameter was provided. Including a state value is recommended to protect against CSRF.',
    );
  }

  // --- Client lookup (service-role; bypasses RLS for this trusted check) -----
  let safeClient = null;
  if (request.clientId) {
    const client = options.client || createSupabaseServiceClient();
    if (!client) {
      return {
        ok: false,
        errors: [makeError('server_error', 'Authorization validation is temporarily unavailable.')],
        warnings,
      };
    }

    const { data, error } = await client
      .from('oauth_clients')
      .select('client_id, client_name, status, redirect_uris')
      .eq('client_id', request.clientId)
      .maybeSingle();

    if (error) {
      errors.push(makeError('lookup_error', 'Could not validate the requesting client.'));
    } else if (!data) {
      errors.push(makeError('unknown_client', 'Unknown client_id.'));
    } else {
      if (data.status !== 'active') {
        errors.push(makeError('client_disabled', 'This OAuth client is not active.'));
      }
      if (request.redirectUri && !redirectUriMatches(data.redirect_uris, request.redirectUri)) {
        errors.push(
          makeError('redirect_uri_mismatch', 'redirect_uri does not match a registered redirect URI.'),
        );
      }
      // Safe, non-secret projection only.
      safeClient = {
        client_id: data.client_id,
        client_name: data.client_name ?? null,
        status: data.status,
      };
    }
  }

  if (errors.length) {
    return { ok: false, errors, warnings };
  }

  return {
    ok: true,
    client: safeClient,
    scopes: toSafeScopes(knownItems),
    warnings,
  };
}
