/**
 * Tropicash — Phase 13A OAuth wallet sandbox test harness.
 *
 * Pure helpers for the interactive wallet-read E2E test console. No network
 * calls, no token issuance, no persistence, and no wallet mutation.
 */

export const OAUTH_WALLET_TEST_PHASE = '13A';

export const RESPONSE_TYPE = 'code';

/** Default scopes for the wallet sandbox harness. */
export const DEFAULT_WALLET_TEST_SCOPES = ['profile.read', 'wallet.read'];

export const SANDBOX_WARNING =
  'Sandbox test harness only. No live money movement.';

export const SECRETS_WARNING =
  'Do not paste production secrets. Production OAuth is disabled.';

const SENSITIVE_KEYS = new Set([
  'access_token',
  'refresh_token',
  'client_secret',
  'token',
  'code',
  'authorization_code',
  'token_hash',
  'client_secret_hash',
]);

const TOKEN_PREFIX_PATTERN = /^(tc_at_|tc_rt_|tc_secret_|tc_auth_)[A-Za-z0-9]+$/;

/**
 * @returns {{
 *   phase: string;
 *   title: string;
 *   environment: string;
 *   defaultScopes: string[];
 *   warnings: string[];
 *   persistencePolicy: string;
 * }}
 */
export function buildOAuthWalletTestPlan() {
  return {
    phase: OAUTH_WALLET_TEST_PHASE,
    title: 'OAuth Wallet Sandbox Test Harness',
    environment: 'sandbox',
    defaultScopes: [...DEFAULT_WALLET_TEST_SCOPES],
    warnings: [SANDBOX_WARNING, SECRETS_WARNING],
    persistencePolicy:
      'Secrets and tokens live in React state only for this session. Nothing is written to localStorage, sessionStorage, or the database from this harness.',
  };
}

/**
 * Build the `/oauth/authorize` URL for wallet sandbox testing.
 *
 * @param {{
 *   clientId?: string;
 *   redirectUri?: string;
 *   scopes?: string[];
 *   state?: string;
 *   responseType?: string;
 * }} [params]
 * @returns {string}
 */
export function buildAuthorizationUrl(params = {}) {
  const {
    clientId = '',
    redirectUri = '',
    scopes = DEFAULT_WALLET_TEST_SCOPES,
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
 * Ordered E2E steps for the wallet sandbox harness UI.
 *
 * @returns {Array<{
 *   id: string;
 *   order: number;
 *   title: string;
 *   purpose: string;
 *   method?: string;
 *   path?: string;
 *   inputHint?: string;
 *   actionLabel?: string;
 * }>}
 */
export function getOAuthWalletTestSteps() {
  return [
    {
      id: 'select-client',
      order: 1,
      title: 'Select OAuth Client',
      purpose:
        'Choose a developer-owned OAuth client and redirect URI. Client secrets are never loaded from the database.',
      inputHint: 'OAuth client + redirect_uri',
    },
    {
      id: 'authorization-url',
      order: 2,
      title: 'Generate Authorization URL',
      purpose:
        'Build the consent URL with profile.read and wallet.read scopes (critical money-movement scopes disabled).',
      method: 'GET',
      path: '/oauth/authorize',
      actionLabel: 'Copy URL',
    },
    {
      id: 'consent',
      order: 3,
      title: 'Open Consent Screen',
      purpose:
        'Open the authorization URL in a new tab and complete user consent manually.',
      actionLabel: 'Open consent screen',
    },
    {
      id: 'capture-code',
      order: 4,
      title: 'Capture Authorization Code',
      purpose:
        'Paste the authorization code returned to your redirect URI after consent.',
      inputHint: 'tc_auth_…',
    },
    {
      id: 'token-exchange',
      order: 5,
      title: 'Exchange Code for Tokens',
      purpose:
        'Exchange the single-use authorization code for access + refresh tokens using client credentials you enter manually.',
      method: 'POST',
      path: '/api/oauth/token',
      inputHint: 'client_secret + authorization code',
      actionLabel: 'Exchange tokens',
    },
    {
      id: 'profile-api',
      order: 6,
      title: 'Call OAuth Profile API',
      purpose: 'Verify the access token works on the first OAuth-protected route.',
      method: 'GET',
      path: '/api/oauth/profile',
      actionLabel: 'Call profile',
    },
    {
      id: 'wallet-api',
      order: 7,
      title: 'Call OAuth Wallet API',
      purpose:
        'Verify wallet.read scope and minimal sandbox wallet response (read-only; no transactions).',
      method: 'GET',
      path: '/api/oauth/wallet',
      actionLabel: 'Call wallet',
    },
    {
      id: 'refresh-token',
      order: 8,
      title: 'Refresh Token',
      purpose: 'Rotate the refresh token into a new access + refresh pair.',
      method: 'POST',
      path: '/api/oauth/token',
      actionLabel: 'Refresh tokens',
    },
    {
      id: 'revoke-token',
      order: 9,
      title: 'Revoke Token',
      purpose: 'Revoke the current access token programmatically.',
      method: 'POST',
      path: '/api/oauth/revoke-token',
      actionLabel: 'Revoke access token',
    },
    {
      id: 'confirm-revoked',
      order: 10,
      title: 'Confirm Revoked Token Fails',
      purpose: 'Call the profile API with the revoked access token — expect invalid_token.',
      method: 'GET',
      path: '/api/oauth/profile',
      actionLabel: 'Call profile (revoked)',
    },
  ];
}

/**
 * Expected response shapes / status codes per harness step.
 *
 * @returns {Record<string, { summary: string; checks?: string[] }>}
 */
export function getExpectedOAuthWalletResponses() {
  return {
    'select-client': {
      summary: 'At least one active OAuth client with a registered redirect URI.',
      checks: ['client_id visible', 'client_secret_hash never shown'],
    },
    'authorization-url': {
      summary: 'URL includes client_id, redirect_uri, response_type=code, scope, and state.',
      checks: ['scope contains profile.read and wallet.read'],
    },
    consent: {
      summary: 'User approves scopes on /oauth/authorize and is redirected with ?code=…',
    },
    'capture-code': {
      summary: 'Authorization code pasted into harness (session state only).',
    },
    'token-exchange': {
      summary: '{ ok: true, access_token, refresh_token, token_type: "Bearer" }',
      checks: ['access_token starts with tc_at_', 'refresh_token starts with tc_rt_'],
    },
    'profile-api': {
      summary: '{ ok: true, profile: { access_type: "oauth", … } }',
      checks: ['HTTP 200', 'profile.access_type === "oauth"'],
    },
    'wallet-api': {
      summary:
        '{ ok: true, wallet: { scope: "wallet.read", access_type: "oauth", … } } or safe error (e.g. consent_required)',
      checks: [
        'wallet.scope === "wallet.read" when ok',
        'no transaction or payment-method fields',
      ],
    },
    'refresh-token': {
      summary: 'New access_token + refresh_token pair; old refresh token revoked.',
      checks: ['HTTP 200', 'new tc_at_ and tc_rt_ values'],
    },
    'revoke-token': {
      summary: '{ ok: true, revoked: true }',
    },
    'confirm-revoked': {
      summary: 'HTTP 401 { ok: false, error: "invalid_token" }',
    },
    introspect: {
      summary: 'Optional: { active: true } before revoke; { active: false } after revoke.',
    },
  };
}

/**
 * Mask a single token-like string for safe display/copy in the UI.
 *
 * @param {string} value
 * @returns {string}
 */
function maskTokenString(value) {
  const s = String(value);
  const match = /^(tc_(?:at|rt|secret|auth)_)/.exec(s);
  if (match) {
    return `${match[1]}…`;
  }
  if (s.length <= 8) return '…';
  return `${s.slice(0, 4)}…${s.slice(-2)}`;
}

/**
 * Recursively sanitize API output for display — redacts secrets and tokens.
 *
 * @param {unknown} value
 * @param {string} [key]
 * @returns {unknown}
 */
export function sanitizeTestOutput(value, key = '') {
  if (value == null) return value;

  if (typeof value === 'string') {
    const k = String(key).toLowerCase();
    if (SENSITIVE_KEYS.has(k) || TOKEN_PREFIX_PATTERN.test(value.trim())) {
      return maskTokenString(value);
    }
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeTestOutput(item));
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k)) {
        out[k] = typeof v === 'string' ? maskTokenString(v) : '…';
      } else {
        out[k] = sanitizeTestOutput(v, k);
      }
    }
    return out;
  }

  return value;
}

/**
 * Evaluate whether an actual API result matches the harness expectation.
 *
 * @param {string} stepId
 * @param {{ status?: number; body?: object }} actual
 * @returns {{ pass: boolean; message: string }}
 */
export function evaluateStepResult(stepId, actual = {}) {
  const status = actual.status;
  const body = actual.body && typeof actual.body === 'object' ? actual.body : {};

  switch (stepId) {
    case 'token-exchange':
      return {
        pass: status === 200 && body.ok === true && Boolean(body.access_token),
        message:
          status === 200 && body.ok
            ? 'Tokens received'
            : `Expected 200 ok:true with access_token (got ${status})`,
      };
    case 'profile-api':
      return {
        pass: status === 200 && body.ok === true && body.profile?.access_type === 'oauth',
        message:
          status === 200 && body.profile?.access_type === 'oauth'
            ? 'Profile OK'
            : `Expected 200 profile.access_type=oauth (got ${status})`,
      };
    case 'wallet-api':
      if (status === 200 && body.ok === true && body.wallet?.scope === 'wallet.read') {
        return { pass: true, message: 'Wallet read OK' };
      }
      if (status === 403 && body.error === 'consent_required') {
        return { pass: true, message: 'Safe error: consent_required (foundation token)' };
      }
      return {
        pass: false,
        message: `Expected wallet.scope=wallet.read or consent_required (got ${status} ${body.error || ''})`,
      };
    case 'refresh-token':
      return {
        pass: status === 200 && body.ok === true && Boolean(body.access_token),
        message:
          status === 200 && body.ok
            ? 'Refresh OK'
            : `Expected 200 with new tokens (got ${status})`,
      };
    case 'revoke-token':
      return {
        pass: status === 200 && body.ok === true && body.revoked === true,
        message:
          body.revoked === true ? 'Token revoked' : `Expected revoked:true (got ${status})`,
      };
    case 'confirm-revoked':
      return {
        pass: status === 401 && body.error === 'invalid_token',
        message:
          status === 401 && body.error === 'invalid_token'
            ? 'Revoked token rejected'
            : `Expected 401 invalid_token (got ${status} ${body.error || ''})`,
      };
    default:
      return { pass: Boolean(actual), message: actual ? 'Completed' : 'Pending' };
  }
}
