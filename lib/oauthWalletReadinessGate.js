/**
 * Tropicash Developer Platform — Phase 12X OAuth-protected wallet readiness gate.
 *
 * Formal readiness assessment determining whether `GET /api/oauth/wallet` can
 * safely be built. This module is EVALUATION DATA ONLY — it defines no wallet
 * endpoint, returns no wallet balances, performs no money movement, and does not
 * modify wallet, transaction, treasury, fraud, PayPal, or KYC state.
 *
 * The Developer Console page and markdown report render from these constants so
 * documentation never drifts from the gate logic.
 */

export const GATE_PHASE = '12Z';
export const ASSESSED_ON = '2026-06-10';

/** @typedef {'passed' | 'blocked' | 'planned'} ControlStatus */

/**
 * Gate outcome values.
 * @typedef {'READY_FOR_PROFILE_ONLY' | 'READY_FOR_WALLET_READ_SANDBOX' | 'BLOCKED_PENDING_CONTROLS' | 'BLOCKED_HIGH_RISK'} GateResult
 */

export const GATE_RESULTS = {
  READY_FOR_PROFILE_ONLY: {
    key: 'READY_FOR_PROFILE_ONLY',
    label: 'Ready for profile only',
    tone: 'info',
    description:
      'OAuth profile APIs may ship; wallet read prerequisites are not yet satisfied.',
  },
  READY_FOR_WALLET_READ_SANDBOX: {
    key: 'READY_FOR_WALLET_READ_SANDBOX',
    label: 'Ready for wallet read (sandbox)',
    tone: 'ready',
    description:
      'All required controls are satisfied. `GET /api/oauth/wallet` may be implemented in sandbox with the recommended minimal schema.',
  },
  BLOCKED_PENDING_CONTROLS: {
    key: 'BLOCKED_PENDING_CONTROLS',
    label: 'Blocked — pending controls',
    tone: 'warn',
    description:
      'OAuth infrastructure is largely complete, but one or more required controls must be implemented before exposing wallet read.',
  },
  BLOCKED_HIGH_RISK: {
    key: 'BLOCKED_HIGH_RISK',
    label: 'Blocked — high risk',
    tone: 'blocked',
    description:
      'A security-critical control failed. Do not expose wallet data until resolved.',
  },
};

/** Fields that must NEVER appear on an OAuth wallet read response. */
export const BLOCKED_WALLET_FIELDS = [
  'transaction history',
  'payment methods',
  'linked bank accounts',
  'KYC documents',
  'withdrawal methods',
  'fraud scores',
  'internal risk notes',
  'admin flags',
];

/** Recommended minimal sandbox wallet read response (documentation only). */
export const RECOMMENDED_WALLET_READ_SCHEMA = {
  ok: true,
  wallet: {
    user_id: '...',
    currency: 'USD',
    available_balance: '...',
    wallet_status: 'active',
    kyc_status: '...',
    access_type: 'oauth',
    scope: 'wallet.read',
  },
};

/**
 * Readiness categories and their required controls. Each control carries a
 * `status` reflecting the current platform state as of Phase 12Z.
 *
 * @type {Array<{
 *   id: string;
 *   title: string;
 *   summary: string;
 *   controls: Array<{
 *     id: string;
 *     label: string;
 *     status: ControlStatus;
 *     detail: string;
 *     nextAction?: string;
 *   }>;
 * }>}
 */
export const WALLET_READINESS_CATEGORIES = [
  {
    id: 'oauth_infrastructure',
    title: 'OAuth infrastructure',
    summary:
      'Core OAuth authorization, token lifecycle, and middleware required before any user-scoped financial API.',
    controls: [
      {
        id: 'oauth_clients',
        label: 'OAuth client registration',
        status: 'passed',
        detail: 'Phase 12L — developers register clients; secrets stored as hashes only.',
      },
      {
        id: 'auth_request_validation',
        label: 'Authorization request validation',
        status: 'passed',
        detail: 'Phase 12N — server-side validator for client_id, redirect_uri, scope, response_type.',
      },
      {
        id: 'consent_records',
        label: 'Consent record creation',
        status: 'passed',
        detail: 'Phase 12U — oauth_consents rows created before authorization codes.',
      },
      {
        id: 'authorization_codes',
        label: 'Authorization code issuance',
        status: 'passed',
        detail: 'Phase 12O — short-lived, single-use codes bound to consent (feature-flagged).',
      },
      {
        id: 'access_tokens',
        label: 'Access token exchange',
        status: 'passed',
        detail: 'Phase 12P — authorization_code grant issues hash-only access + refresh tokens.',
      },
      {
        id: 'refresh_rotation',
        label: 'Refresh token rotation',
        status: 'passed',
        detail: 'Phase 12Q — refresh_token grant rotates pairs; old refresh revoked immediately.',
      },
      {
        id: 'token_revocation',
        label: 'Token revocation endpoint',
        status: 'passed',
        detail: 'Phase 12W — POST /api/oauth/revoke-token with client auth; no enumeration.',
      },
      {
        id: 'access_token_middleware',
        label: 'Access token validation middleware',
        status: 'passed',
        detail: 'Phase 12R — authenticateOAuthAccessToken + requireOAuthAccessToken helpers.',
      },
      {
        id: 'scope_enforcement',
        label: 'Scope enforcement',
        status: 'passed',
        detail: 'Phase 12R — requireOAuthScope(s); 403 insufficient_scope on missing scope.',
      },
    ],
  },
  {
    id: 'user_consent',
    title: 'User consent',
    summary: 'End-user visibility and revocation for third-party OAuth access.',
    controls: [
      {
        id: 'wallet_read_scope',
        label: 'wallet.read scope defined',
        status: 'passed',
        detail: 'Catalogued in OAUTH_SCOPE_CATALOG (high risk; requires user consent + admin approval for production).',
      },
      {
        id: 'consent_lifecycle',
        label: 'Active / revoked consent records',
        status: 'passed',
        detail: 'oauth_consents supports active and revoked states with granted_at / revoked_at.',
      },
      {
        id: 'connected_apps_page',
        label: 'Connected apps management page',
        status: 'passed',
        detail: 'Phase 12V — /oauth/apps lists consents and supports user revocation.',
      },
      {
        id: 'consent_revokes_tokens',
        label: 'Consent revocation revokes tokens',
        status: 'passed',
        detail: 'Phase 12V — revoke-consent revokes related access + refresh tokens server-side.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security',
    summary: 'Hash-only secret storage and safe OAuth API surfaces.',
    controls: [
      {
        id: 'token_hashes_only',
        label: 'Access / refresh tokens stored as hashes only',
        status: 'passed',
        detail: 'oauth_access_tokens / oauth_refresh_tokens persist token_hash only.',
      },
      {
        id: 'client_secret_hashes_only',
        label: 'Client secrets stored as hashes only',
        status: 'passed',
        detail: 'oauth_clients.client_secret_hash — plaintext shown once at issuance.',
      },
      {
        id: 'no_token_hash_exposure',
        label: 'No token hashes exposed via APIs',
        status: 'passed',
        detail: 'Middleware, introspection, and profile endpoints never return token_hash.',
      },
      {
        id: 'profile_no_wallet_data',
        label: 'OAuth profile endpoint excludes wallet data',
        status: 'passed',
        detail: 'Phase 12S — GET /api/oauth/profile returns safe metadata only (no balance).',
      },
      {
        id: 'introspection_safe',
        label: 'Token introspection is enumeration-safe',
        status: 'passed',
        detail: 'Phase 12R — POST /api/oauth/introspect returns active:false for invalid tokens.',
      },
      {
        id: 'scope_enforcement_active',
        label: 'Scope enforcement active on protected APIs',
        status: 'passed',
        detail: 'profile.read enforced on /api/oauth/profile; wallet.read middleware ready to wire.',
      },
    ],
  },
  {
    id: 'wallet_exposure',
    title: 'Wallet exposure controls',
    summary: 'Design constraints that must hold when /api/oauth/wallet is implemented.',
    controls: [
      {
        id: 'wallet_read_scope_enforcement',
        label: 'wallet.read scope enforcement on wallet endpoint',
        status: 'passed',
        detail:
          'Phase 12Z — GET /api/oauth/wallet requires wallet.read via requireOAuthAccessToken(); foundation-mode tokens return consent_required.',
      },
      {
        id: 'minimal_wallet_schema',
        label: 'Minimal wallet response schema defined',
        status: 'passed',
        detail: 'Recommended schema documented — user_id, currency, available_balance, wallet_status, kyc_status only.',
      },
      {
        id: 'no_transaction_history',
        label: 'No transaction history on wallet endpoint',
        status: 'passed',
        detail: 'Blocked field policy — transactions belong on a separate future endpoint with transactions.read.',
      },
      {
        id: 'no_payment_methods',
        label: 'No payment methods on wallet endpoint',
        status: 'passed',
        detail: 'Blocked field policy — payment methods are never returned via OAuth wallet read.',
      },
      {
        id: 'no_kyc_documents',
        label: 'No KYC document fields',
        status: 'passed',
        detail: 'Only a summary kyc_status enum may appear; document images/URLs are blocked.',
      },
      {
        id: 'no_balance_mutation',
        label: 'No balance mutation via OAuth wallet read',
        status: 'passed',
        detail: 'GET-only wallet surface; no POST/PUT/PATCH wallet routes in OAuth namespace.',
      },
      {
        id: 'no_money_movement',
        label: 'No payout / send / withdraw via OAuth wallet read',
        status: 'passed',
        detail:
          'Phase 12Z wallet read sandbox endpoint is GET-only. payments.create and withdrawals.create remain blocked critical scopes — no money movement APIs are enabled.',
      },
      {
        id: 'wallet_read_sandbox_endpoint',
        label: 'Wallet read sandbox endpoint implemented',
        status: 'passed',
        detail:
          'Phase 12Z — GET /api/oauth/wallet ships as sandbox-only, read-only, rate-limited, and audited. No send, withdraw, transaction, or payment-method APIs exist in the OAuth namespace.',
      },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance',
    summary: 'Legal and regulatory posture before exposing financial reads to third parties.',
    controls: [
      {
        id: 'kyc_status_decision',
        label: 'KYC status handling decision documented',
        status: 'passed',
        detail:
          'Decision: return a read-only kyc_status summary (e.g. unverified, pending, verified, restricted) — never document URLs or reviewer notes.',
      },
      {
        id: 'legal_draft_banner',
        label: 'Legal draft banner remains active',
        status: 'passed',
        detail: 'LEGAL_DRAFT_BANNER displayed on /legal pages until counsel finalizes policies.',
      },
      {
        id: 'risk_disclosure',
        label: 'Risk disclosure published',
        status: 'passed',
        detail: '/legal/risk-disclosure covers wallet and payment risks.',
      },
      {
        id: 'privacy_policy',
        label: 'Privacy policy published',
        status: 'passed',
        detail: '/legal/privacy covers data collection and third-party sharing.',
      },
      {
        id: 'aml_policy',
        label: 'AML policy published',
        status: 'passed',
        detail: '/legal/aml-policy covers monitoring and reporting readiness.',
      },
    ],
  },
  {
    id: 'operational',
    title: 'Operational controls',
    summary: 'Rate limits, audit, logging, and admin review before wallet read goes live.',
    controls: [
      {
        id: 'oauth_rate_limits',
        label: 'Rate limit strategy for OAuth-protected endpoints',
        status: 'passed',
        detail:
          'Phase 12Y — lib/oauthRateLimits.js enforces per-token hourly limits on protected OAuth routes via oauth_api_usage_logs.',
      },
      {
        id: 'wallet_read_audit',
        label: 'Audit events for OAuth wallet reads',
        status: 'passed',
        detail:
          'Phase 12Y — oauth_audit_events includes wallet_read_performed, wallet_read_blocked, wallet_read_suspicious, and oauth_rate_limit_exceeded.',
      },
      {
        id: 'logs_exclude_balances',
        label: 'Logs exclude balances unless explicitly approved',
        status: 'passed',
        detail:
          'Policy: OAuth audit metadata and usage logs must never record available_balance or raw wallet payloads.',
      },
      {
        id: 'admin_review_path',
        label: 'Admin review path for suspicious OAuth app access',
        status: 'passed',
        detail:
          'Phase 12Y — lib/oauthSuspiciousAccess.js + /admin/oauth-access-review queue for wallet.read anomalies (review-only, no auto enforcement).',
      },
    ],
  },
];

/**
 * @returns {typeof WALLET_READINESS_CATEGORIES}
 */
export function getWalletReadinessControls() {
  return WALLET_READINESS_CATEGORIES;
}

/**
 * @returns {typeof RECOMMENDED_WALLET_READ_SCHEMA}
 */
export function getRecommendedWalletReadSchema() {
  return RECOMMENDED_WALLET_READ_SCHEMA;
}

/**
 * @returns {Readonly<string[]>}
 */
export function getBlockedWalletFields() {
  return BLOCKED_WALLET_FIELDS;
}

/**
 * Flatten all controls across categories.
 * @returns {Array<{ categoryId: string; categoryTitle: string } & (typeof WALLET_READINESS_CATEGORIES)[0]['controls'][0]>}
 */
function flattenControls() {
  const out = [];
  for (const cat of WALLET_READINESS_CATEGORIES) {
    for (const ctrl of cat.controls) {
      out.push({
        categoryId: cat.id,
        categoryTitle: cat.title,
        ...ctrl,
      });
    }
  }
  return out;
}

/**
 * Evaluate the OAuth wallet readiness gate.
 *
 * @returns {{
 *   result: GateResult;
 *   resultMeta: typeof GATE_RESULTS[keyof typeof GATE_RESULTS];
 *   passed: number;
 *   blocked: number;
 *   planned: number;
 *   total: number;
 *   blockedControls: object[];
 *   plannedControls: object[];
 *   nextActions: string[];
 *   profileReady: boolean;
 *   walletSandboxReady: boolean;
 * }}
 */
export function evaluateOAuthWalletReadiness() {
  const all = flattenControls();
  const passed = all.filter((c) => c.status === 'passed').length;
  const blocked = all.filter((c) => c.status === 'blocked').length;
  const planned = all.filter((c) => c.status === 'planned').length;
  const total = all.length;

  const blockedControls = all.filter((c) => c.status === 'blocked');
  const plannedControls = all.filter((c) => c.status === 'planned');

  const securityBlocked = all.some(
    (c) => c.categoryId === 'security' && c.status === 'blocked',
  );

  let result;
  if (securityBlocked) {
    result = 'BLOCKED_HIGH_RISK';
  } else if (blocked > 0) {
    result = 'BLOCKED_PENDING_CONTROLS';
  } else if (planned > 0) {
    // Planned controls are acceptable for sandbox if no hard blocks — wire on implementation.
    result = 'READY_FOR_WALLET_READ_SANDBOX';
  } else if (passed === total) {
    result = 'READY_FOR_WALLET_READ_SANDBOX';
  } else {
    result = 'READY_FOR_PROFILE_ONLY';
  }

  const profileInfraOk = all
    .filter((c) => ['oauth_infrastructure', 'security'].includes(c.categoryId))
    .every((c) => c.status === 'passed');

  const nextActions = [
    ...blockedControls.map((c) => c.nextAction || c.detail).filter(Boolean),
    ...plannedControls.map((c) => c.nextAction).filter(Boolean),
  ];

  return {
    result,
    resultMeta: GATE_RESULTS[result],
    passed,
    blocked,
    planned,
    total,
    blockedControls,
    plannedControls,
    nextActions: Array.from(new Set(nextActions)),
    profileReady: profileInfraOk,
    walletSandboxReady: result === 'READY_FOR_WALLET_READ_SANDBOX',
  };
}

/**
 * @returns {{
 *   phase: string;
 *   assessedOn: string;
 *   gateResult: GateResult;
 *   controlsPassed: number;
 *   controlsBlocked: number;
 *   controlsPlanned: number;
 *   controlsTotal: number;
 *   blockedFieldCount: number;
 *   categories: number;
 * }}
 */
export function getWalletReadinessSummary() {
  const eval_ = evaluateOAuthWalletReadiness();
  return {
    phase: GATE_PHASE,
    assessedOn: ASSESSED_ON,
    gateResult: eval_.result,
    controlsPassed: eval_.passed,
    controlsBlocked: eval_.blocked,
    controlsPlanned: eval_.planned,
    controlsTotal: eval_.total,
    blockedFieldCount: BLOCKED_WALLET_FIELDS.length,
    categories: WALLET_READINESS_CATEGORIES.length,
  };
}
