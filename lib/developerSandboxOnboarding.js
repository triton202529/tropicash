/**
 * Tropicash — Phase 14A external developer sandbox onboarding.
 *
 * Pure data/config for public-facing developer onboarding. No database access,
 * no API calls, no secrets, and no production enablement.
 */

export const ONBOARDING_PHASE = '14A';

export const SANDBOX_STATUS = {
  sandboxAvailable: true,
  productionDisabled: true,
  productionAccessAvailable: false,
};

/**
 * @returns {{
 *   sandboxAvailable: boolean;
 *   productionDisabled: boolean;
 *   environment: string;
 *   message: string;
 * }}
 */
export function getDeveloperSandboxStatus() {
  return {
    sandboxAvailable: SANDBOX_STATUS.sandboxAvailable,
    productionDisabled: SANDBOX_STATUS.productionDisabled,
    environment: 'sandbox',
    message:
      'Tropicash Developer Platform is available in sandbox. Production access is disabled.',
  };
}

/**
 * @returns {Array<{
 *   id: string;
 *   step: number;
 *   title: string;
 *   summary: string;
 *   href: string | null;
 *   requiresConsoleAccess: boolean;
 * }>}
 */
export function getDeveloperJourney() {
  return [
    {
      id: 'create_organization',
      step: 1,
      title: 'Create Developer Organization',
      summary: 'Request developer access and set up your organization profile.',
      href: '/developers/request-access',
      requiresConsoleAccess: false,
    },
    {
      id: 'create_application',
      step: 2,
      title: 'Create Application',
      summary: 'Register a developer application in the sandbox console.',
      href: '/dev-console/apps-register',
      requiresConsoleAccess: true,
    },
    {
      id: 'sandbox_credentials',
      step: 3,
      title: 'Generate Sandbox API Credentials',
      summary: 'Issue sandbox API keys (tc_test_*) for developer API authentication.',
      href: '/dev-console/credentials',
      requiresConsoleAccess: true,
    },
    {
      id: 'oauth_client',
      step: 4,
      title: 'Create OAuth Client',
      summary: 'Register an OAuth client for authorization code flows.',
      href: '/dev-console/oauth-clients',
      requiresConsoleAccess: true,
    },
    {
      id: 'oauth_harness',
      step: 5,
      title: 'Run OAuth Sandbox Test Harness',
      summary: 'Execute the interactive end-to-end OAuth wallet sandbox test.',
      href: '/dev-console/oauth-wallet-test',
      requiresConsoleAccess: true,
    },
    {
      id: 'review_evidence',
      step: 6,
      title: 'Review Test Evidence',
      summary: 'Capture and review sanitized harness evidence from your test run.',
      href: '/dev-console/oauth-wallet-test',
      requiresConsoleAccess: true,
    },
    {
      id: 'certification',
      step: 7,
      title: 'Complete Certification Workflow',
      summary: 'Follow operator checklist and certification guidance for sandbox readiness.',
      href: '/developers/get-started',
      requiresConsoleAccess: false,
    },
  ];
}

/**
 * @returns {Array<{
 *   id: string;
 *   category: 'public' | 'oauth';
 *   name: string;
 *   method: string;
 *   path: string;
 *   scope: string | null;
 *   environment: string;
 *   description: string;
 * }>}
 */
export function getAvailableSandboxApis() {
  return [
    {
      id: 'platform_status',
      category: 'public',
      name: 'Platform Status',
      method: 'GET',
      path: '/api/developer/platform-status',
      scope: null,
      environment: 'sandbox',
      description: 'Returns developer platform availability and environment metadata.',
    },
    {
      id: 'supported_currencies',
      category: 'public',
      name: 'Supported Currencies',
      method: 'GET',
      path: '/api/developer/supported-currencies',
      scope: null,
      environment: 'sandbox',
      description: 'Lists currencies supported by the developer platform.',
    },
    {
      id: 'oauth_profile',
      category: 'oauth',
      name: 'OAuth Profile API',
      method: 'GET',
      path: '/api/oauth/profile',
      scope: 'profile.read',
      environment: 'sandbox',
      description: 'Read authenticated user profile via OAuth access token.',
    },
    {
      id: 'oauth_wallet',
      category: 'oauth',
      name: 'OAuth Wallet API (Sandbox)',
      method: 'GET',
      path: '/api/oauth/wallet',
      scope: 'wallet.read',
      environment: 'sandbox',
      description: 'Read-only sandbox wallet summary. No money movement.',
    },
  ];
}

/**
 * @returns {string[]}
 */
export function getSandboxRestrictions() {
  return [
    'Production API keys',
    'Live money movement',
    'Send money APIs',
    'Withdrawal APIs',
    'Transaction APIs',
    'Payment method APIs',
    'Production OAuth',
    'Real financial transfers',
  ];
}

/**
 * @returns {string[]}
 */
export function getDeveloperSecurityRequirements() {
  return [
    'Store client secrets server-side only',
    'Never expose OAuth secrets in frontend applications',
    'Use HTTPS redirect URIs',
    'Use least-privilege scopes',
    'Respect rate limits',
    'Protect customer data',
  ];
}

/**
 * API examples with placeholder credentials only.
 * @returns {Array<{
 *   id: string;
 *   title: string;
 *   authType: 'api_key' | 'oauth';
 *   method: string;
 *   path: string;
 *   example: string;
 * }>}
 */
export function getDeveloperApiExamples() {
  return [
    {
      id: 'example_platform_status',
      title: 'Platform Status',
      authType: 'api_key',
      method: 'GET',
      path: '/api/developer/platform-status',
      example: `GET /api/developer/platform-status HTTP/1.1
Host: your-app.example.com
Authorization: Bearer tc_test_xxxxxxxx`,
    },
    {
      id: 'example_supported_currencies',
      title: 'Supported Currencies',
      authType: 'api_key',
      method: 'GET',
      path: '/api/developer/supported-currencies',
      example: `GET /api/developer/supported-currencies HTTP/1.1
Host: your-app.example.com
Authorization: Bearer tc_test_xxxxxxxx`,
    },
    {
      id: 'example_oauth_profile',
      title: 'OAuth Profile',
      authType: 'oauth',
      method: 'GET',
      path: '/api/oauth/profile',
      example: `GET /api/oauth/profile HTTP/1.1
Host: your-app.example.com
Authorization: Bearer tc_at_xxxxxxxx`,
    },
    {
      id: 'example_oauth_wallet',
      title: 'OAuth Wallet (Sandbox)',
      authType: 'oauth',
      method: 'GET',
      path: '/api/oauth/wallet',
      example: `GET /api/oauth/wallet HTTP/1.1
Host: your-app.example.com
Authorization: Bearer tc_at_xxxxxxxx`,
    },
  ];
}

/**
 * Welcome section content.
 * @returns {{ title: string; paragraphs: string[] }}
 */
export function getDeveloperWelcomeContent() {
  return {
    title: 'Welcome to Tropicash Developers',
    paragraphs: [
      'The Tropicash Developer Platform helps you build Caribbean financial innovation with a sandbox-first, safety-first approach.',
      'Start in sandbox with read-only developer and OAuth APIs. Test authorization flows, profile access, and wallet read capabilities without live money movement.',
      'API safety is foundational: authenticated requests, rate limits, audit logging, and strict scope enforcement protect users and partners.',
    ],
  };
}

/**
 * Support and feedback guidance.
 * @returns {{ testing: string; issues: string; roadmap: string }}
 */
export function getDeveloperSupportGuidance() {
  return {
    testing:
      'Use the Developer Console sandbox tools and OAuth Wallet Test Harness to validate integrations before requesting expanded access.',
    issues:
      'Report sandbox defects through Tropicash support. Include request IDs, timestamps, and sanitized logs — never share client secrets or tokens.',
    roadmap:
      'Production access is not currently available. Future production releases will follow separate governance and certification requirements.',
  };
}
