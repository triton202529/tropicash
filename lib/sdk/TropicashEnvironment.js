/**
 * Tropicash SDK — Phase 12F environment manager.
 *
 * Centralizes environment awareness for the SDK. Sandbox is enabled; production
 * is reserved and throws descriptive errors until a future release.
 *
 * No wallet movement or payment execution — configuration/metadata only.
 */

export const SUPPORTED_ENVIRONMENTS = ['sandbox', 'production'];

export const PRODUCTION_DISABLED_MESSAGE =
  'Production environment is not enabled yet. Production access will be enabled in a future Tropicash release.';

export const ENVIRONMENT_CONFIG = {
  sandbox: {
    enabled: true,
    baseUrl: '/api/developer',
    dashboardUrl: '/dev-console',
    label: 'Sandbox',
  },
  production: {
    enabled: false,
    baseUrl: null,
    dashboardUrl: null,
    label: 'Production',
  },
};

function normalizeEnvironment(environment) {
  return String(environment == null ? '' : environment).trim().toLowerCase();
}

export class TropicashEnvironment {
  /**
   * @param {string} [environment='sandbox']
   */
  constructor(environment = 'sandbox') {
    const env = normalizeEnvironment(environment) || 'sandbox';
    if (!SUPPORTED_ENVIRONMENTS.includes(env)) {
      throw new Error(
        `Unsupported environment "${environment}". Supported environments: ${SUPPORTED_ENVIRONMENTS.join(
          ', ',
        )}.`,
      );
    }
    this.environment = env;
  }

  /** @returns {boolean} */
  isSandbox() {
    return this.environment === 'sandbox';
  }

  /** @returns {boolean} */
  isProduction() {
    return this.environment === 'production';
  }

  /** @returns {boolean} Whether this environment is currently enabled. */
  isEnabled() {
    return Boolean(ENVIRONMENT_CONFIG[this.environment]?.enabled);
  }

  /**
   * Base URL for Developer API requests. Throws for production (disabled).
   * @returns {string}
   */
  getBaseUrl() {
    if (this.isProduction()) {
      throw new Error(PRODUCTION_DISABLED_MESSAGE);
    }
    return ENVIRONMENT_CONFIG.sandbox.baseUrl;
  }

  /**
   * Developer Console dashboard URL for this environment. Throws for production.
   * @returns {string}
   */
  getDashboardUrl() {
    if (this.isProduction()) {
      throw new Error(PRODUCTION_DISABLED_MESSAGE);
    }
    return ENVIRONMENT_CONFIG.sandbox.dashboardUrl;
  }

  /** @returns {string} Human-readable label. */
  getLabel() {
    return ENVIRONMENT_CONFIG[this.environment]?.label || this.environment;
  }
}

export default TropicashEnvironment;
