/**
 * Tropicash — Phase 12T OAuth developer testing guide.
 *
 * Static, read-only copy + example builders for the OAuth Testing console. This
 * module contains NO secrets, performs NO network calls, and issues NO tokens.
 * It only produces illustrative request examples (authorization URL + curl
 * snippets) from values the developer enters in the UI.
 *
 * Sandbox testing tool only — no wallet APIs, no money movement.
 */

export const OAUTH_TESTING_PHASE = '12T';

export const RESPONSE_TYPE = 'code';

export const DEFAULT_SCOPES = ['profile.read'];

/** Risk levels we surface in the scope selector, in display order. */
export const SCOPE_RISK_ORDER = ['low', 'medium', 'high', 'critical'];

export const CRITICAL_SCOPE_NOTE =
  'Money movement scopes are unavailable in sandbox testing.';

/**
 * Static guide sections rendered on the testing page. Each entry is safe,
 * non-secret documentation only.
 */
export const OAUTH_TESTING_GUIDE = {
  authorizationUrl: {
    id: 'authorization-url',
    title: 'Authorization URL',
    summary:
      'Send the user to the consent screen. Tropicash validates the request, the user approves, and (when issuance is enabled) an authorization code is returned to your redirect URI.',
    method: 'GET',
    path: '/oauth/authorize',
    notes: [
      'response_type must be "code".',
      'redirect_uri must exactly match a URI registered on the OAuth client.',
      'Always include a random "state" value and verify it on return (CSRF protection).',
      'This console never auto-approves and never issues codes for you.',
    ],
  },
  tokenExchange: {
    id: 'token-exchange',
    title: 'Token Exchange',
    summary:
      'Exchange a single-use authorization code for an access token + refresh token.',
    method: 'POST',
    path: '/api/oauth/token',
    params: [
      { key: 'grant_type', value: 'authorization_code' },
      { key: 'client_id', value: 'tc_client_…' },
      { key: 'client_secret', value: 'tc_secret_… (shown once at client creation)' },
      { key: 'code', value: 'tc_auth_… (from the redirect)' },
      { key: 'redirect_uri', value: 'must match the authorization request' },
    ],
    notes: [
      'The client secret is shown ONLY once when the OAuth client is created or rotated.',
      'Authorization codes are single-use and expire after ~10 minutes.',
    ],
  },
  refreshToken: {
    id: 'refresh-token',
    title: 'Refresh Token',
    summary:
      'Exchange a valid refresh token for a new access + refresh token pair. The old refresh token is revoked immediately (rotation).',
    method: 'POST',
    path: '/api/oauth/token',
    params: [
      { key: 'grant_type', value: 'refresh_token' },
      { key: 'client_id', value: 'tc_client_…' },
      { key: 'client_secret', value: 'tc_secret_…' },
      { key: 'refresh_token', value: 'tc_rt_…' },
    ],
    notes: [
      'No redirect_uri is required for the refresh grant.',
      'Reusing an already-rotated refresh token returns invalid_grant.',
    ],
  },
  profileApi: {
    id: 'profile-api',
    title: 'Profile API',
    summary:
      'Call the first OAuth-protected, user-scoped API using your access token.',
    method: 'GET',
    path: '/api/oauth/profile',
    requiredScope: 'profile.read',
    notes: [
      'Send the access token as: Authorization: Bearer tc_at_…',
      'Requires the profile.read scope; missing scope returns 403 insufficient_scope.',
      'Returns safe metadata only — no wallet, transaction, KYC, or contact data.',
    ],
  },
  introspection: {
    id: 'introspection',
    title: 'Introspection',
    summary:
      'Check whether an access token is currently active and view its safe metadata.',
    method: 'POST',
    path: '/api/oauth/introspect',
    notes: [
      'Body: { "token": "tc_at_…" }.',
      'Active tokens return active:true with client_id, app_id, user_id, scope, and exp.',
      'Inactive/invalid tokens return active:false. Sandbox testing only.',
    ],
  },
  safetyNotes: {
    id: 'safety-notes',
    title: 'Safety Notes',
    summary: 'What this console does and does not do.',
    notes: [
      'Sandbox only — production OAuth is disabled.',
      'No wallet access and no money movement are possible from here.',
      'Client secrets are never stored or displayed on this page.',
      'No authorization codes or tokens are auto-issued; you run each step yourself.',
      'Critical money-movement scopes are disabled in the selector.',
    ],
  },
};

/**
 * Build the `/oauth/authorize` URL from user-entered values. Pure string
 * builder — performs no validation side effects and issues nothing.
 *
 * @param {{
 *   clientId?: string;
 *   redirectUri?: string;
 *   scopes?: string[];
 *   state?: string;
 *   responseType?: string;
 * }} params
 * @returns {string}
 */
export function buildAuthorizationUrl(params = {}) {
  const {
    clientId = '',
    redirectUri = '',
    scopes = [],
    state = '',
    responseType = RESPONSE_TYPE,
  } = params;

  const query = new URLSearchParams();
  if (clientId) query.set('client_id', clientId);
  if (redirectUri) query.set('redirect_uri', redirectUri);
  query.set('response_type', responseType || RESPONSE_TYPE);
  if (Array.isArray(scopes) && scopes.length) {
    query.set('scope', scopes.join(' '));
  }
  if (state) query.set('state', state);

  return `/oauth/authorize?${query.toString()}`;
}

/**
 * Build a copy-pasteable curl example for the token exchange (authorization
 * code) grant. Values shown are placeholders unless provided.
 *
 * @param {{ clientId?: string; redirectUri?: string }} [params]
 * @returns {string}
 */
export function buildTokenExchangeCurl(params = {}) {
  const { clientId = 'tc_client_xxx', redirectUri = 'https://app.example.com/callback' } = params;
  return [
    "curl -X POST '/api/oauth/token' \\",
    "  -H 'Content-Type: application/json' \\",
    "  -d '{",
    '    "grant_type": "authorization_code",',
    `    "client_id": "${clientId}",`,
    '    "client_secret": "tc_secret_xxx",',
    '    "code": "tc_auth_xxx",',
    `    "redirect_uri": "${redirectUri}"`,
    "  }'",
  ].join('\n');
}

/**
 * Build a copy-pasteable curl example for the refresh_token grant.
 *
 * @param {{ clientId?: string }} [params]
 * @returns {string}
 */
export function buildRefreshTokenCurl(params = {}) {
  const { clientId = 'tc_client_xxx' } = params;
  return [
    "curl -X POST '/api/oauth/token' \\",
    "  -H 'Content-Type: application/json' \\",
    "  -d '{",
    '    "grant_type": "refresh_token",',
    `    "client_id": "${clientId}",`,
    '    "client_secret": "tc_secret_xxx",',
    '    "refresh_token": "tc_rt_xxx"',
    "  }'",
  ].join('\n');
}

/**
 * Build a copy-pasteable curl example for the OAuth profile API.
 * @returns {string}
 */
export function buildProfileCurl() {
  return [
    "curl '/api/oauth/profile' \\",
    "  -H 'Authorization: Bearer tc_at_xxx'",
  ].join('\n');
}

/**
 * Build a copy-pasteable curl example for the introspection endpoint.
 * @returns {string}
 */
export function buildIntrospectCurl() {
  return [
    "curl -X POST '/api/oauth/introspect' \\",
    "  -H 'Content-Type: application/json' \\",
    '  -d \'{ "token": "tc_at_xxx" }\'',
  ].join('\n');
}
