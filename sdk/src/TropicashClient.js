import TropicashEnvironment, {
  PRODUCTION_DISABLED_MESSAGE,
} from './TropicashEnvironment.js';

/**
 * Tropicash SDK — client (package build).
 *
 * Wraps authentication, environment management, and request handling so
 * developers don't hand-roll them. Wired today: ping(), platformStatus(),
 * supportedCurrencies(), profile(). Resource namespaces
 * (wallets/payments/withdrawals/accounts/webhooks) are reserved as clean
 * extension points and throw a descriptive error until implemented.
 *
 * Packaged copy of lib/sdk/TropicashClient.js (Phase 12I). No wallet movement
 * or payment execution.
 */

const API_KEY_PATTERN = /^tc_(test|live)_[A-Za-z0-9]+$/;

/**
 * Build a reserved resource namespace. Accessing any method on it throws a
 * descriptive "not available yet" error, giving future phases a clean place to
 * attach real methods (e.g. client.wallets.list()).
 *
 * @param {string} name
 * @returns {object}
 */
function plannedNamespace(name) {
  return new Proxy(
    { __namespace: name, __status: 'planned' },
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'toJSON') {
          return () => ({ namespace: name, status: 'planned' });
        }
        if (typeof prop === 'symbol') return undefined;
        return () => {
          throw new Error(
            `client.${name}.${String(prop)}() is not available yet. The ${name} API ships in a future Tropicash SDK release.`,
          );
        };
      },
    },
  );
}

export class TropicashClient {
  /**
   * @param {{
   *   apiKey?: string;
   *   environment?: string;
   *   baseUrl?: string;
   *   fetchImpl?: typeof fetch;
   * }} [config]
   */
  constructor(config = {}) {
    const { apiKey, environment = 'sandbox', baseUrl, fetchImpl } = config || {};

    this.apiKey = typeof apiKey === 'string' ? apiKey.trim() : '';
    this.env = new TropicashEnvironment(environment);

    this._baseUrlOverride =
      typeof baseUrl === 'string' && baseUrl.trim()
        ? baseUrl.trim().replace(/\/+$/, '')
        : null;

    this._fetch =
      fetchImpl ||
      (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function'
        ? globalThis.fetch.bind(globalThis)
        : null);

    // Reserved resource namespaces — clean extension points for future phases.
    this.wallets = plannedNamespace('wallets');
    this.payments = plannedNamespace('payments');
    this.withdrawals = plannedNamespace('withdrawals');
    this.accounts = plannedNamespace('accounts');
    this.webhooks = plannedNamespace('webhooks');
  }

  /** @returns {string} The configured environment. */
  getEnvironment() {
    return this.env.environment;
  }

  /** @returns {string} The configured API key. */
  getApiKey() {
    return this.apiKey;
  }

  /** @returns {string} Resolved Developer API base URL. */
  getBaseUrl() {
    return this._baseUrlOverride || this.env.getBaseUrl();
  }

  /**
   * Validate the client configuration without making a request.
   * @returns {{ ok: boolean; errors: string[] }}
   */
  validateConfiguration() {
    const errors = [];

    if (!this.apiKey) {
      errors.push('Missing API key.');
    } else if (!API_KEY_PATTERN.test(this.apiKey)) {
      errors.push('Malformed API key. Expected the form tc_test_… or tc_live_….');
    }

    if (this.env.isProduction()) {
      errors.push(PRODUCTION_DISABLED_MESSAGE);
    }

    // Sandbox clients must use a sandbox (tc_test_) key.
    if (this.env.isSandbox() && this.apiKey && !this.apiKey.startsWith('tc_test_')) {
      errors.push('A sandbox client requires a sandbox API key (tc_test_…).');
    }

    return { ok: errors.length === 0, errors };
  }

  /**
   * Authenticated GET against a Developer API path. Validates configuration,
   * attaches the bearer token, and returns the parsed JSON body. On any
   * configuration / network error it returns a normalized `{ ok: false, error }`.
   *
   * @param {string} path  Path relative to the environment base URL (e.g. "/profile").
   * @param {{ method?: string }} [options]
   * @returns {Promise<object>}
   */
  async _request(path, options = {}) {
    const method = options?.method || 'GET';

    const cfg = this.validateConfiguration();
    if (!cfg.ok) {
      return { ok: false, error: cfg.errors[0] || 'Invalid client configuration.' };
    }
    if (!this._fetch) {
      return { ok: false, error: 'No fetch implementation available in this runtime.' };
    }

    let baseUrl;
    try {
      baseUrl = this.getBaseUrl();
    } catch (err) {
      return { ok: false, error: err?.message || 'Environment is not available.' };
    }

    try {
      const resp = await this._fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });
      const json = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return json && typeof json === 'object' ? json : { ok: true };
      }
      return {
        ok: false,
        error: (json && json.error) || `Request failed (${resp.status}).`,
        status: resp.status,
      };
    } catch (err) {
      return { ok: false, error: err?.message || 'Network error.' };
    }
  }

  /**
   * Call the Developer API health check using the configured API key.
   *
   * @returns {Promise<{ ok: boolean; environment?: string; error?: string; status?: number }>}
   */
  async ping() {
    const result = await this._request('/ping');
    if (result.ok) {
      return { ok: true, environment: result.environment || this.getEnvironment() };
    }
    return result;
  }

  /**
   * GET /platform-status — platform availability information.
   * @returns {Promise<object>} Parsed JSON: { ok, environment, status, version, timestamp }.
   */
  async platformStatus() {
    return this._request('/platform-status');
  }

  /**
   * GET /supported-currencies — currencies supported by Tropicash.
   * @returns {Promise<object>} Parsed JSON: { ok, currencies: [{ code, name, status }] }.
   */
  async supportedCurrencies() {
    return this._request('/supported-currencies');
  }

  /**
   * GET /profile — read-only metadata for the authenticated credential.
   * @returns {Promise<object>} Parsed JSON: { ok, organization_id, app_id, environment, public_key, status }.
   */
  async profile() {
    return this._request('/profile');
  }

  /**
   * GET /api/oauth/profile — OAuth-protected user profile (Phase 12S).
   *
   * Requires an OAuth access token (NOT the API key) carrying the
   * `profile.read` scope. The token is sent as `Authorization: Bearer <token>`.
   *
   * @param {{ accessToken?: string }} [args]
   * @returns {Promise<object>} Parsed JSON: { ok, profile: { user_id, app_id, client_id, scopes, environment, access_type, consent_status? } }.
   */
  async oauthProfile({ accessToken } = {}) {
    const token = typeof accessToken === 'string' ? accessToken.trim() : '';
    if (!token) {
      return { ok: false, error: 'Missing OAuth access token.' };
    }
    if (!this._fetch) {
      return { ok: false, error: 'No fetch implementation available in this runtime.' };
    }

    let baseUrl;
    try {
      baseUrl = this.getBaseUrl();
    } catch (err) {
      return { ok: false, error: err?.message || 'Environment is not available.' };
    }

    // OAuth endpoints live under /api/oauth, sibling to the Developer API base.
    const oauthBase = baseUrl.replace(/\/developer$/, '/oauth');

    try {
      const resp = await this._fetch(`${oauthBase}/profile`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return json && typeof json === 'object' ? json : { ok: true };
      }
      return {
        ok: false,
        error: (json && json.error) || `Request failed (${resp.status}).`,
        status: resp.status,
      };
    } catch (err) {
      return { ok: false, error: err?.message || 'Network error.' };
    }
  }

  /**
   * GET /api/oauth/wallet — OAuth-protected wallet read (Phase 12Z).
   *
   * Sandbox only. Requires an OAuth access token (NOT the API key) carrying the
   * `wallet.read` scope. Read-only — returns minimal wallet summary only; no
   * transaction history, payment methods, or money movement.
   *
   * @param {{ accessToken?: string }} [args]
   * @returns {Promise<object>} Parsed JSON: { ok, wallet: { user_id, currency, available_balance, wallet_status, kyc_status, access_type, scope } }.
   */
  async oauthWallet({ accessToken } = {}) {
    const token = typeof accessToken === 'string' ? accessToken.trim() : '';
    if (!token) {
      return { ok: false, error: 'Missing OAuth access token.' };
    }
    if (!this._fetch) {
      return { ok: false, error: 'No fetch implementation available in this runtime.' };
    }

    let baseUrl;
    try {
      baseUrl = this.getBaseUrl();
    } catch (err) {
      return { ok: false, error: err?.message || 'Environment is not available.' };
    }

    const oauthBase = baseUrl.replace(/\/developer$/, '/oauth');

    try {
      const resp = await this._fetch(`${oauthBase}/wallet`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return json && typeof json === 'object' ? json : { ok: true };
      }
      return {
        ok: false,
        error: (json && json.error) || `Request failed (${resp.status}).`,
        status: resp.status,
      };
    } catch (err) {
      return { ok: false, error: err?.message || 'Network error.' };
    }
  }

  /**
   * POST /api/oauth/revoke-token — revoke an OAuth access or refresh token (Phase 12W).
   *
   * Uses OAuth client credentials (NOT the API key). Store client_secret
   * server-side only — never embed it in client-side apps.
   *
   * @param {{
   *   token?: string;
   *   tokenTypeHint?: 'access_token' | 'refresh_token';
   *   clientId?: string;
   *   clientSecret?: string;
   * }} [args]
   * @returns {Promise<object>} Parsed JSON: { ok, revoked } or { ok: false, error }.
   */
  async revokeToken({ token, tokenTypeHint, clientId, clientSecret } = {}) {
    const presentedToken = typeof token === 'string' ? token.trim() : '';
    const cid = typeof clientId === 'string' ? clientId.trim() : '';
    const secret = typeof clientSecret === 'string' ? clientSecret.trim() : '';
    if (!presentedToken) {
      return { ok: false, error: 'Missing token.' };
    }
    if (!cid || !secret) {
      return { ok: false, error: 'Missing OAuth client credentials.' };
    }
    if (!this._fetch) {
      return { ok: false, error: 'No fetch implementation available in this runtime.' };
    }

    let baseUrl;
    try {
      baseUrl = this.getBaseUrl();
    } catch (err) {
      return { ok: false, error: err?.message || 'Environment is not available.' };
    }

    const oauthBase = baseUrl.replace(/\/developer$/, '/oauth');
    const hint =
      tokenTypeHint === 'access_token' || tokenTypeHint === 'refresh_token'
        ? tokenTypeHint
        : undefined;

    try {
      const resp = await this._fetch(`${oauthBase}/revoke-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: presentedToken,
          ...(hint ? { token_type_hint: hint } : {}),
          client_id: cid,
          client_secret: secret,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return json && typeof json === 'object' ? json : { ok: true };
      }
      return {
        ok: false,
        error: (json && json.error) || `Request failed (${resp.status}).`,
        status: resp.status,
      };
    } catch (err) {
      return { ok: false, error: err?.message || 'Network error.' };
    }
  }
}

export default TropicashClient;
