/**
 * Tropicash — Phase 12M OAuth consent screen UI helpers.
 *
 * Pure, side-effect-free logic for the user-facing OAuth consent screen
 * (`/oauth/authorize`). This module ONLY parses, validates, and classifies an
 * incoming authorization request so the UI can render it safely.
 *
 * It DOES NOT:
 *   • issue authorization codes, access tokens, or refresh tokens,
 *   • create consent records,
 *   • call wallet/transaction APIs, or
 *   • move money.
 *
 * Approval is never permitted in this phase — `approval.allowed` is always
 * false. The classification below only controls warnings, blocked banners, and
 * invalid-request messaging.
 */

import { OAUTH_SCOPE_CATALOG, getOAuthScope } from './oauthConsentModels';

export const REQUIRED_AUTHORIZE_PARAMS = [
  'client_id',
  'redirect_uri',
  'scope',
  'response_type',
];

export const SUPPORTED_RESPONSE_TYPES = ['code'];

// Critical scopes block approval outright; high-risk scopes surface a warning.
export const CRITICAL_RISK_LEVEL = 'critical';
export const WARNING_RISK_LEVELS = ['high', 'critical'];

export const APPROVAL_DISABLED_LABEL = 'Approval coming soon';
export const MONEY_MOVEMENT_BLOCKED_MESSAGE =
  'Money movement permissions are not available yet.';

function firstValue(value) {
  if (Array.isArray(value)) return value.length ? value[0] : '';
  return value == null ? '' : value;
}

function cleanString(value) {
  return String(firstValue(value)).trim();
}

/**
 * Split an OAuth `scope` string into a de-duplicated, ordered array of scope
 * names. Accepts space- or plus-delimited values.
 * @param {string} scope
 * @returns {string[]}
 */
export function parseScopeString(scope) {
  const parts = cleanString(scope)
    .split(/[\s+]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const unique = [];
  for (const part of parts) {
    if (!unique.includes(part)) unique.push(part);
  }
  return unique;
}

/**
 * Normalize the raw query object into a safe authorization request shape.
 * Never trusts query params beyond string coercion + trimming.
 *
 * @param {Record<string, string|string[]>} [query]
 * @returns {{
 *   clientId: string;
 *   redirectUri: string;
 *   scopeRaw: string;
 *   scopes: string[];
 *   state: string;
 *   responseType: string;
 * }}
 */
export function parseAuthorizationRequest(query = {}) {
  const scopeRaw = cleanString(query.scope);
  return {
    clientId: cleanString(query.client_id),
    redirectUri: cleanString(query.redirect_uri),
    scopeRaw,
    scopes: parseScopeString(scopeRaw),
    state: cleanString(query.state),
    responseType: cleanString(query.response_type),
  };
}

/**
 * Resolve each requested scope against the canonical catalog.
 * @param {string[]} [scopes]
 * @returns {{ scope: string; definition: object|null; known: boolean }[]}
 */
export function resolveScopeItems(scopes = []) {
  return scopes.map((scope) => {
    const definition = getOAuthScope(scope) || null;
    return { scope, definition, known: Boolean(definition) };
  });
}

/**
 * Validate that the request carries the structurally-required params.
 * @param {ReturnType<typeof parseAuthorizationRequest>} request
 * @returns {{ ok: boolean; missing: string[]; unsupportedResponseType: boolean }}
 */
export function validateAuthorizationRequest(request) {
  const missing = [];
  if (!request.clientId) missing.push('client_id');
  if (!request.redirectUri) missing.push('redirect_uri');
  if (!request.scopeRaw || !request.scopes.length) missing.push('scope');
  if (!request.responseType) missing.push('response_type');

  const unsupportedResponseType =
    Boolean(request.responseType) &&
    !SUPPORTED_RESPONSE_TYPES.includes(request.responseType);

  return {
    ok: missing.length === 0 && !unsupportedResponseType,
    missing,
    unsupportedResponseType,
  };
}

/**
 * Lightweight redirect URI sanity check (display/decline gating only).
 * HTTPS required; http allowed only for localhost/loopback; no wildcards.
 * @param {string} redirectUri
 * @returns {boolean}
 */
export function looksLikeValidRedirectUri(redirectUri) {
  const value = cleanString(redirectUri);
  if (!value || value.includes('*')) return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.hash) return false;
  const host = url.hostname.toLowerCase();
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1';
  if (url.protocol === 'https:') return true;
  if (url.protocol === 'http:' && isLocal) return true;
  return false;
}

/**
 * Build the full consent view-model the page renders from.
 *
 * status:
 *   'invalid'  — required params missing or response_type unsupported.
 *   'blocked'  — request includes a critical (money-movement) scope.
 *   'consent'  — safe to preview (approval still disabled this phase).
 *
 * @param {Record<string, string|string[]>} query
 * @returns {{
 *   request: ReturnType<typeof parseAuthorizationRequest>;
 *   validation: ReturnType<typeof validateAuthorizationRequest>;
 *   scopes: { items: object[]; known: object[]; unknown: object[]; hasUnknown: boolean };
 *   risk: { hasCritical: boolean; hasWarning: boolean; criticalScopes: string[]; warningScopes: string[] };
 *   blockedReasons: string[];
 *   requestInvalid: boolean;
 *   status: 'invalid' | 'blocked' | 'consent';
 *   approval: { allowed: false; label: string };
 *   redirectUriLooksValid: boolean;
 * }}
 */
export function buildConsentView(query) {
  const request = parseAuthorizationRequest(query);
  const validation = validateAuthorizationRequest(request);

  const items = resolveScopeItems(request.scopes);
  const known = items.filter((i) => i.known);
  const unknown = items.filter((i) => !i.known);
  const hasUnknown = unknown.length > 0;

  const criticalScopes = known
    .filter((i) => i.definition.riskLevel === CRITICAL_RISK_LEVEL)
    .map((i) => i.scope);
  const warningScopes = known
    .filter((i) => WARNING_RISK_LEVELS.includes(i.definition.riskLevel))
    .map((i) => i.scope);

  const hasCritical = criticalScopes.length > 0;
  const hasWarning = warningScopes.length > 0;

  const blockedReasons = [];
  if (hasCritical) blockedReasons.push(MONEY_MOVEMENT_BLOCKED_MESSAGE);
  if (hasUnknown) {
    blockedReasons.push('This request includes one or more unrecognized scopes.');
  }

  let status;
  if (!validation.ok) {
    status = 'invalid';
  } else if (hasCritical) {
    status = 'blocked';
  } else {
    status = 'consent';
  }

  // Unknown scopes never invalidate the *structure* of the request, but they do
  // mark the request invalid for approval and surface a clear banner.
  const requestInvalid = !validation.ok || hasUnknown;

  return {
    request,
    validation,
    scopes: { items, known, unknown, hasUnknown },
    risk: { hasCritical, hasWarning, criticalScopes, warningScopes },
    blockedReasons,
    requestInvalid,
    status,
    // Approval is intentionally never allowed in Phase 12M.
    approval: { allowed: false, label: APPROVAL_DISABLED_LABEL },
    redirectUriLooksValid: looksLikeValidRedirectUri(request.redirectUri),
  };
}

/**
 * Catalog passthrough for any UI that wants the full scope list.
 * @returns {Readonly<typeof OAUTH_SCOPE_CATALOG>}
 */
export function getScopeCatalog() {
  return OAUTH_SCOPE_CATALOG;
}
