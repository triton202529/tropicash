/**
 * Tropicash Developer Platform — Phase 12G wallet API readiness assessment.
 *
 * This module is the single source of truth for the wallet API exposure
 * blueprint. It is ASSESSMENT DATA ONLY — it defines no endpoints, performs no
 * money movement, and reads/writes no wallet, transaction, withdrawal, treasury,
 * fraud, PayPal, or KYC state. The Developer Console readiness page and the
 * markdown report both render from these constants so they never drift.
 *
 * Nothing here is wired to runtime behavior. It documents what WOULD be required
 * before any wallet capability is exposed to third-party developers.
 */

export const READINESS_PHASE = '12G';
export const READINESS_STATUS = 'assessment_complete';
export const ASSESSED_ON = '2026-06-06';

/* ──────────────────────────────────────────────────────────────────────────
 * 1. Authentication requirements
 * ──────────────────────────────────────────────────────────────────────── */

export const CURRENT_AUTH_CAPABILITIES = [
  {
    capability: 'Developer API keys',
    phase: '12A / 12B',
    state: 'live (sandbox)',
    detail:
      'Public/secret key pairs. Only the SHA-256 hash of the secret is stored; secrets are shown once. Bearer-token auth validates status, environment, expiry, and app/org linkage.',
  },
  {
    capability: 'Webhooks',
    phase: '12D',
    state: 'live (sandbox)',
    detail:
      'Registered HTTPS endpoints with one-time whsec_ secrets (stored hashed). Outbound events are HMAC-SHA256 signed with timestamped replay protection.',
  },
  {
    capability: 'Usage tracking',
    phase: '12C',
    state: 'live (sandbox)',
    detail:
      'Every authenticated request is appended to developer_api_usage_logs (endpoint, method, status, IP, request id). No secrets or headers are logged.',
  },
  {
    capability: 'Rate limiting',
    phase: '12C',
    state: 'live (sandbox)',
    detail:
      'Per-key rolling windows (100/hour, 1000/day) counted from the usage log. Fail-closed: any uncertainty denies the request.',
  },
];

/**
 * Controls that must exist BEFORE the matching authorization tier can ship.
 * `requires` is one of: app | user | platform.
 */
export const REQUIRED_AUTH_CONTROLS = [
  {
    control: 'App authorization (current)',
    requires: 'app',
    summary:
      'The API key identifies the app + organization. Sufficient for public, non-user data only.',
    gaps: [
      'No per-scope entitlement on the key — a key can call any endpoint it reaches.',
      'No app review/attestation gate before sensitive scopes are granted.',
    ],
  },
  {
    control: 'User authorization (OAuth-style consent)',
    requires: 'user',
    summary:
      'A signed-in Tropicash user must explicitly grant a third-party app access to THEIR wallet data before any user-scoped endpoint resolves.',
    gaps: [
      'No consent grant table, consent UI, or per-user access tokens exist yet.',
      'No scoped, revocable, expiring access tokens distinct from the app key.',
    ],
  },
  {
    control: 'Step-up authorization for value movement',
    requires: 'user',
    summary:
      'Money-moving operations require fresh, explicit, per-transaction user authorization (re-auth / 2FA / signed intent), never a standing token.',
    gaps: [
      'No transaction-intent signing or step-up challenge exists.',
      'No idempotency-key contract for safe retries of value operations.',
    ],
  },
  {
    control: 'Platform / internal authorization',
    requires: 'platform',
    summary:
      'Treasury, fraud, KYC, and admin operations stay internal and are never reachable by any developer credential.',
    gaps: ['Must be explicitly denied at the gateway, not merely undocumented.'],
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * 2. Data classification matrix
 * ──────────────────────────────────────────────────────────────────────── */

export const DATA_CLASSES = ['PUBLIC', 'RESTRICTED', 'SENSITIVE', 'CRITICAL'];

export const DATA_CLASSIFICATION = [
  {
    level: 'PUBLIC',
    authorization: 'App key only',
    handling: 'Cacheable, no user linkage, safe for early access.',
    examples: ['Supported currencies', 'Platform / service status', 'Public fee schedule'],
  },
  {
    level: 'RESTRICTED',
    authorization: 'App key + user consent (read)',
    handling: 'Identifies a user but exposes no balances or money movement.',
    examples: ['Developer profile (own)', 'Wallet metadata (id, currency, status)', 'User display name / handle'],
  },
  {
    level: 'SENSITIVE',
    authorization: 'App key + explicit user consent (scoped read)',
    handling: 'Financially revealing. Per-scope consent, audit log, tight rate limits.',
    examples: ['Wallet balance', 'Transaction history', 'Linked payment methods'],
  },
  {
    level: 'CRITICAL',
    authorization: 'Step-up per-operation user authorization',
    handling: 'Moves or mutates value. Signed intent, idempotency, fraud + KYC checks, never a standing token.',
    examples: ['Send money', 'Withdraw funds', 'Modify balances', 'Create transactions'],
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * 3. API exposure review
 * ──────────────────────────────────────────────────────────────────────── */

export const EXPOSURE_CATEGORIES = [
  'SAFE_FOR_EARLY_ACCESS',
  'REQUIRES_USER_CONSENT',
  'HIGH_RISK',
  'INTERNAL_ONLY',
];

export const EXPOSURE_CATEGORY_LABELS = {
  SAFE_FOR_EARLY_ACCESS: 'Safe for early access',
  REQUIRES_USER_CONSENT: 'Requires user consent',
  HIGH_RISK: 'High risk',
  INTERNAL_ONLY: 'Internal only',
};

/**
 * Candidate future endpoints. NONE are implemented — `method`/`path` describe
 * the intended shape only.
 */
export const API_EXPOSURE = [
  {
    method: 'GET',
    path: '/platform-status',
    category: 'SAFE_FOR_EARLY_ACCESS',
    dataClass: 'PUBLIC',
    scope: null,
    note: 'No user linkage. Mirrors the existing public status surface.',
  },
  {
    method: 'GET',
    path: '/supported-currencies',
    category: 'SAFE_FOR_EARLY_ACCESS',
    dataClass: 'PUBLIC',
    scope: null,
    note: 'Static reference data. Cacheable.',
  },
  {
    method: 'GET',
    path: '/developer/profile',
    category: 'SAFE_FOR_EARLY_ACCESS',
    dataClass: 'RESTRICTED',
    scope: 'profile.read',
    note: 'Returns the developer\u2019s own profile, scoped to the calling credential — no third-party user data.',
  },
  {
    method: 'GET',
    path: '/wallet',
    category: 'REQUIRES_USER_CONSENT',
    dataClass: 'SENSITIVE',
    scope: 'wallet.read',
    note: 'Balance is financially sensitive — requires explicit, revocable user consent.',
  },
  {
    method: 'GET',
    path: '/transactions',
    category: 'REQUIRES_USER_CONSENT',
    dataClass: 'SENSITIVE',
    scope: 'transactions.read',
    note: 'Full history reveals behavior + counterparties. Consent + tight rate limits + audit.',
  },
  {
    method: 'GET',
    path: '/payment-methods',
    category: 'REQUIRES_USER_CONSENT',
    dataClass: 'SENSITIVE',
    scope: 'wallet.read',
    note: 'Return masked references only; never raw PAN / full instrument data.',
  },
  {
    method: 'POST',
    path: '/send-money',
    category: 'HIGH_RISK',
    dataClass: 'CRITICAL',
    scope: 'payments.create',
    note: 'Moves value. Step-up auth, signed intent, idempotency, fraud + KYC gating.',
  },
  {
    method: 'POST',
    path: '/withdraw',
    category: 'HIGH_RISK',
    dataClass: 'CRITICAL',
    scope: 'withdrawals.create',
    note: 'Removes value from the platform. Highest assurance; last to ship.',
  },
  {
    method: '—',
    path: 'Treasury controls',
    category: 'INTERNAL_ONLY',
    dataClass: 'CRITICAL',
    scope: null,
    note: 'Never exposed to any developer credential. Deny at the gateway.',
  },
  {
    method: '—',
    path: 'Fraud controls',
    category: 'INTERNAL_ONLY',
    dataClass: 'CRITICAL',
    scope: null,
    note: 'Internal risk engine only.',
  },
  {
    method: '—',
    path: 'Admin operations',
    category: 'INTERNAL_ONLY',
    dataClass: 'CRITICAL',
    scope: null,
    note: 'Admin/back-office only; protected by tc_is_admin(), not developer keys.',
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * 4. Permission model (scope matrix)
 * ──────────────────────────────────────────────────────────────────────── */

export const SCOPE_RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

export const SCOPE_MATRIX = [
  {
    scope: 'profile.read',
    description: 'Read the developer/app\u2019s own profile metadata.',
    risk: 'low',
    dataClass: 'RESTRICTED',
    approval: 'Self-serve (sandbox). No extra approval.',
  },
  {
    scope: 'wallet.read',
    description: 'Read wallet metadata and balance for a consenting user.',
    risk: 'high',
    dataClass: 'SENSITIVE',
    approval: 'Requires user consent + app review before production.',
  },
  {
    scope: 'transactions.read',
    description: 'Read transaction history for a consenting user.',
    risk: 'high',
    dataClass: 'SENSITIVE',
    approval: 'Requires user consent + app review before production.',
  },
  {
    scope: 'payments.create',
    description: 'Initiate a money transfer on behalf of a consenting user.',
    risk: 'critical',
    dataClass: 'CRITICAL',
    approval: 'Manual approval + signed agreement + step-up per transaction.',
  },
  {
    scope: 'withdrawals.create',
    description: 'Initiate a withdrawal of funds off-platform.',
    risk: 'critical',
    dataClass: 'CRITICAL',
    approval: 'Highest assurance: contract, compliance review, step-up auth.',
  },
  {
    scope: 'webhooks.manage',
    description: 'Register, rotate, and disable webhook endpoints for the app.',
    risk: 'medium',
    dataClass: 'RESTRICTED',
    approval: 'Self-serve (sandbox). App-scoped only.',
  },
  {
    scope: 'developer.manage',
    description: 'Manage the developer org\u2019s apps, keys, and settings.',
    risk: 'medium',
    dataClass: 'RESTRICTED',
    approval: 'Self-serve, restricted to org owners.',
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * 5. Consent model recommendations
 * ──────────────────────────────────────────────────────────────────────── */

export const CONSENT_MODEL = [
  {
    question: 'How does a user authorize a third-party app?',
    recommendation:
      'OAuth 2.0 authorization-code + PKCE flow. The app redirects the user to a Tropicash-hosted consent screen that lists the exact requested scopes; the signed-in user approves, and Tropicash issues a scoped, app-bound access token (and refresh token). The app key never grants user data on its own.',
  },
  {
    question: 'How is consent revoked?',
    recommendation:
      'Users can revoke any connected app from a "Connected Apps" settings screen; developers can revoke from their side. Revocation immediately invalidates the access + refresh tokens (token-version bump) so in-flight tokens stop resolving on the next request.',
  },
  {
    question: 'How long does consent last?',
    recommendation:
      'Short-lived access tokens (~30–60 min) with rotating refresh tokens. Read consent persists until revoked but is re-confirmed periodically; CRITICAL (value-movement) operations never rely on standing consent — each requires fresh step-up authorization.',
  },
  {
    question: 'What audit records should exist?',
    recommendation:
      'Append-only consent ledger: grant, scope change, refresh, and revocation events with timestamp, user id, app id, scope set, and IP/device. Every SENSITIVE/CRITICAL access is logged against the consent grant for user-visible transparency and dispute resolution.',
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * 6. Security review
 * ──────────────────────────────────────────────────────────────────────── */

export const SECURITY_FINDINGS = {
  strengths: [
    'Secrets (API keys + webhook secrets) are never stored in plaintext — only SHA-256 hashes; plaintext is shown once.',
    'Generic auth failures leak no information about whether a key exists, is revoked, expired, or production-scoped.',
    'Service-role lookups are server-only; secret_hash is never selected into a response or context.',
    'Rate limiting and webhook delivery both fail closed under uncertainty.',
    'Usage logging excludes secrets, hashes, and Authorization headers.',
    'Production is reserved/disabled across keys, rate limits, and environment manager.',
  ],
  weaknesses: [
    {
      issue: 'Webhook secret storage limitation (Phase 12D)',
      severity: 'high',
      detail:
        'Only the SHA-256 hash of the webhook secret is stored, so outbound test events are signed with the hash as the key. Developers cannot independently verify signatures against the plaintext secret end-to-end, and the hash is not a true HMAC secret.',
    },
    {
      issue: 'API keys are bearer tokens without per-scope entitlement',
      severity: 'medium',
      detail:
        'A valid key can reach any endpoint it is routed to. There is no scope claim binding a key to a permitted set of operations.',
    },
    {
      issue: 'No user-consent / OAuth layer',
      severity: 'high',
      detail:
        'There is no mechanism for a user to authorize a third-party app, so no user-scoped (SENSITIVE) data can be safely exposed yet.',
    },
    {
      issue: 'SHA-256 secret hashing is fast',
      severity: 'low',
      detail:
        'Adequate for high-entropy random secrets, but offers no work factor. Consider HMAC-with-pepper or a slow KDF if secret entropy ever drops.',
    },
    {
      issue: 'No idempotency / signed-intent contract',
      severity: 'medium',
      detail:
        'Required before any value-moving endpoint to make retries safe and prevent duplicate transfers.',
    },
  ],
  requiredUpgrades: [
    'Introduce encrypted-at-rest webhook secrets (or a true HMAC signing secret) so signatures are developer-verifiable.',
    'Add a scope claim to API credentials and enforce it at the gateway.',
    'Build the OAuth-style user-consent layer with scoped, revocable, expiring tokens.',
    'Add idempotency keys and signed transaction intents for value movement.',
    'Add step-up authentication (re-auth / 2FA) for all CRITICAL operations.',
    'Add anomaly detection + per-app + per-user spend velocity limits feeding the fraud engine.',
  ],
};

/**
 * Remediation options for the Phase 12D webhook secret storage limitation.
 */
export const WEBHOOK_SECRET_REMEDIATION = [
  {
    option: 'Encrypt the secret at rest (recommended)',
    summary:
      'Store the webhook secret encrypted with a KMS-managed key (envelope encryption). Decrypt server-side only at signing time and sign with the true plaintext secret.',
    pros: ['Developer-verifiable signatures end-to-end', 'Secret never stored in plaintext'],
    cons: ['Requires KMS / key management integration', 'Decryption path must be tightly access-controlled'],
  },
  {
    option: 'Split secret: store hash for lookup + sealed copy for signing',
    summary:
      'Keep the SHA-256 hash for constant-time identification and a separately sealed (encrypted) copy used only to sign outbound events.',
    pros: ['Backwards compatible with current hash-based model'],
    cons: ['Two artifacts to manage', 'Still needs a key-management story'],
  },
  {
    option: 'Asymmetric signing (platform-held private key)',
    summary:
      'Sign events with a Tropicash private key; publish the public key so developers verify without holding a shared secret.',
    pros: ['No per-webhook shared secret to protect', 'Standard, auditable verification'],
    cons: ['Larger change to the signing + docs model', 'Key rotation tooling required'],
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * 7. First API candidates (rollout tiers)
 * ──────────────────────────────────────────────────────────────────────── */

export const ROLLOUT_TIERS = [
  {
    tier: 1,
    title: 'Public, no user data',
    when: 'First to ship',
    endpoints: ['GET /platform-status', 'GET /supported-currencies', 'GET /developer/profile'],
    justification:
      'No user-linked financial data. Exercises the existing auth + rate-limit + usage pipeline with zero consent risk. Ideal for proving the gateway end-to-end.',
    gate: 'Existing app-key auth is sufficient.',
  },
  {
    tier: 2,
    title: 'User wallet (read)',
    when: 'After consent layer ships',
    endpoints: ['GET /wallet'],
    justification:
      'First SENSITIVE surface. Validates the consent + scoped-token model on a single, well-bounded read before broadening.',
    gate: 'Requires OAuth consent + wallet.read scope + audit logging.',
  },
  {
    tier: 3,
    title: 'Transaction history (read)',
    when: 'After Tier 2 proven',
    endpoints: ['GET /transactions'],
    justification:
      'Higher data volume and stronger privacy implications than a single balance. Ship once consent + audit + pagination + tight rate limits are battle-tested.',
    gate: 'Requires transactions.read scope + tightened rate limits + audit.',
  },
  {
    tier: 4,
    title: 'Value movement',
    when: 'Last, highest assurance',
    endpoints: ['POST /send-money', 'POST /withdraw'],
    justification:
      'Irreversible movement of funds. Only after step-up auth, signed intents, idempotency, fraud + KYC integration, compliance review, and a signed developer agreement are all in place.',
    gate: 'Manual approval + step-up auth + idempotency + fraud/KYC + contract.',
  },
];

/* ──────────────────────────────────────────────────────────────────────────
 * Derived summary (powers the console summary cards)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * @returns {{
 *   apisReviewed: number;
 *   safeApis: number;
 *   consentApis: number;
 *   highRiskApis: number;
 *   internalApis: number;
 * }}
 */
export function getReadinessSummary() {
  const count = (category) => API_EXPOSURE.filter((e) => e.category === category).length;
  return {
    apisReviewed: API_EXPOSURE.length,
    safeApis: count('SAFE_FOR_EARLY_ACCESS'),
    consentApis: count('REQUIRES_USER_CONSENT'),
    highRiskApis: count('HIGH_RISK'),
    internalApis: count('INTERNAL_ONLY'),
  };
}
