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
}

export default TropicashClient;
