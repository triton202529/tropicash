/**
 * Tropicash Developer Platform — Phase 12K OAuth consent data model.
 *
 * Canonical, read-only metadata describing the OAuth consent storage layer:
 * table catalog, consent relationships, approved scope catalog, RLS rules,
 * token security model, and audit architecture. The Developer Console
 * documentation page renders from these constants so docs never drift from the
 * schema in `supabase/sql/oauth_consent_foundation_phase12k.sql`.
 *
 * SCHEMA/DOCUMENTATION ONLY — no OAuth flow, token issuance, wallet APIs, or
 * money movement. Nothing here is wired to runtime behavior.
 */

export const OAUTH_MODEL_PHASE = '12K';

export const SCOPE_RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

export const OAUTH_AUDIT_EVENT_TYPES = [
  'consent_granted',
  'consent_revoked',
  'token_issued',
  'token_revoked',
  'token_refresh_attempt',
  'oauth_client_disabled',
  'suspicious_oauth_activity',
];

/**
 * @typedef {{
 *   scope: string;
 *   label: string;
 *   description: string;
 *   riskLevel: 'low' | 'medium' | 'high' | 'critical';
 *   requiresUserConsent: boolean;
 *   requiresAdminApproval: boolean;
 *   requiresStepUpAuth: boolean;
 *   userFacingDescription: string;
 * }} OAuthScopeDefinition
 */

/** @type {OAuthScopeDefinition[]} */
export const OAUTH_SCOPE_CATALOG = [
  {
    scope: 'profile.read',
    label: 'Profile Read',
    description: 'Read basic profile metadata for a consenting user.',
    riskLevel: 'low',
    requiresUserConsent: true,
    requiresAdminApproval: false,
    requiresStepUpAuth: false,
    userFacingDescription: 'Allow this app to view your name and profile details.',
  },
  {
    scope: 'wallet.read',
    label: 'Wallet Read',
    description: 'Read wallet metadata and balance for a consenting user.',
    riskLevel: 'high',
    requiresUserConsent: true,
    requiresAdminApproval: true,
    requiresStepUpAuth: false,
    userFacingDescription: 'Allow this app to view your wallet balance and account status.',
  },
  {
    scope: 'transactions.read',
    label: 'Transactions Read',
    description: 'Read transaction history for a consenting user.',
    riskLevel: 'high',
    requiresUserConsent: true,
    requiresAdminApproval: true,
    requiresStepUpAuth: false,
    userFacingDescription: 'Allow this app to view your transaction history.',
  },
  {
    scope: 'payments.create',
    label: 'Payments Create',
    description: 'Initiate a money transfer on behalf of a consenting user.',
    riskLevel: 'critical',
    requiresUserConsent: true,
    requiresAdminApproval: true,
    requiresStepUpAuth: true,
    userFacingDescription: 'Allow this app to send money on your behalf.',
  },
  {
    scope: 'withdrawals.create',
    label: 'Withdrawals Create',
    description: 'Initiate a withdrawal of funds off-platform.',
    riskLevel: 'critical',
    requiresUserConsent: true,
    requiresAdminApproval: true,
    requiresStepUpAuth: true,
    userFacingDescription: 'Allow this app to withdraw funds from your wallet.',
  },
  {
    scope: 'webhooks.manage',
    label: 'Webhooks Manage',
    description: 'Register, rotate, and disable webhook endpoints for the app.',
    riskLevel: 'medium',
    requiresUserConsent: false,
    requiresAdminApproval: false,
    requiresStepUpAuth: false,
    userFacingDescription: 'Manage webhook endpoints for this developer application.',
  },
  {
    scope: 'developer.manage',
    label: 'Developer Manage',
    description: 'Manage the developer org’s apps, keys, and settings.',
    riskLevel: 'medium',
    requiresUserConsent: false,
    requiresAdminApproval: false,
    requiresStepUpAuth: false,
    userFacingDescription: 'Manage developer organization settings and applications.',
  },
];

/** @deprecated Use OAUTH_SCOPE_CATALOG */
export const OAUTH_SCOPES = OAUTH_SCOPE_CATALOG.map((entry) => ({
  scope: entry.scope,
  description: entry.description,
  risk: entry.riskLevel,
  approval: entry.requiresAdminApproval
    ? 'Requires admin approval before production.'
    : 'Self-serve (sandbox). No extra approval.',
}));

export const OAUTH_TABLES = [
  {
    name: 'oauth_clients',
    purpose: 'Registered applications approved for future OAuth access.',
    serviceRoleOnly: false,
    fields: [
      { name: 'id', type: 'uuid', note: 'Primary key.' },
      { name: 'app_id', type: 'uuid', note: 'References developer_apps(id).' },
      { name: 'client_id', type: 'text', note: 'Public OAuth client identifier (unique).' },
      { name: 'client_secret_hash', type: 'text', note: 'Hash of the client secret — never plaintext.' },
      { name: 'status', type: 'text', note: 'active | disabled.' },
      { name: 'created_at', type: 'timestamptz', note: 'Creation time.' },
      { name: 'updated_at', type: 'timestamptz', note: 'Last update time.' },
    ],
  },
  {
    name: 'oauth_consents',
    purpose: 'Records user consent grants to an OAuth client.',
    serviceRoleOnly: false,
    fields: [
      { name: 'id', type: 'uuid', note: 'Primary key.' },
      { name: 'user_id', type: 'uuid', note: 'References auth.users(id).' },
      { name: 'client_id', type: 'uuid', note: 'References oauth_clients(id).' },
      { name: 'scopes', type: 'text[]', note: 'Granted scopes from the catalog.' },
      { name: 'status', type: 'text', note: 'active | revoked.' },
      { name: 'granted_at', type: 'timestamptz', note: 'When consent was granted.' },
      { name: 'revoked_at', type: 'timestamptz', note: 'When consent was revoked (nullable).' },
    ],
  },
  {
    name: 'oauth_access_tokens',
    purpose: 'Future access token storage (hash only).',
    serviceRoleOnly: true,
    fields: [
      { name: 'id', type: 'uuid', note: 'Primary key.' },
      { name: 'consent_id', type: 'uuid', note: 'References oauth_consents(id).' },
      { name: 'token_hash', type: 'text', note: 'Hash of the access token — never plaintext.' },
      { name: 'scopes', type: 'text[]', note: 'Scopes carried by the token.' },
      { name: 'expires_at', type: 'timestamptz', note: 'Short-lived expiry (~30–60 min).' },
      { name: 'created_at', type: 'timestamptz', note: 'Issue time.' },
      { name: 'revoked_at', type: 'timestamptz', note: 'Revocation time (nullable).' },
    ],
  },
  {
    name: 'oauth_refresh_tokens',
    purpose: 'Future refresh token storage (hash only).',
    serviceRoleOnly: true,
    fields: [
      { name: 'id', type: 'uuid', note: 'Primary key.' },
      { name: 'consent_id', type: 'uuid', note: 'References oauth_consents(id).' },
      { name: 'token_hash', type: 'text', note: 'Hash of the refresh token — never plaintext.' },
      { name: 'expires_at', type: 'timestamptz', note: 'Longer-lived expiry; rotated on use.' },
      { name: 'created_at', type: 'timestamptz', note: 'Issue time.' },
      { name: 'revoked_at', type: 'timestamptz', note: 'Revocation time (nullable).' },
    ],
  },
  {
    name: 'oauth_audit_events',
    purpose: 'Security and compliance audit trail.',
    serviceRoleOnly: false,
    fields: [
      { name: 'id', type: 'uuid', note: 'Primary key.' },
      { name: 'user_id', type: 'uuid', note: 'Affected user (nullable); references auth.users(id).' },
      { name: 'client_id', type: 'uuid', note: 'References oauth_clients(id) (nullable).' },
      { name: 'event_type', type: 'text', note: OAUTH_AUDIT_EVENT_TYPES.join(' | ') + '.' },
      { name: 'metadata', type: 'jsonb', note: 'Structured context (scopes, ip/device, etc.).' },
      { name: 'created_at', type: 'timestamptz', note: 'Event time.' },
    ],
  },
];

export const CONSENT_RELATIONSHIP_FLOW = [
  { step: 1, label: 'Developer App', detail: 'developer_apps row owned by the developer org.' },
  { step: 2, label: 'OAuth Client', detail: 'oauth_clients row with client_id and client_secret_hash.' },
  { step: 3, label: 'User Consent', detail: 'oauth_consents row recording granted scopes for a user.' },
  { step: 4, label: 'Access Token', detail: 'oauth_access_tokens row (hash only, service-role only).' },
  { step: 5, label: 'Refresh Token', detail: 'oauth_refresh_tokens row (hash only, service-role only).' },
  { step: 6, label: 'Audit Events', detail: 'oauth_audit_events append-only trail for compliance.' },
];

export const CONSENT_RELATIONSHIPS = [
  { from: 'developer_apps', to: 'oauth_clients', via: 'oauth_clients.app_id', cardinality: '1 → many' },
  { from: 'oauth_clients', to: 'oauth_consents', via: 'oauth_consents.client_id', cardinality: '1 → many' },
  { from: 'oauth_consents', to: 'oauth_access_tokens', via: 'oauth_access_tokens.consent_id', cardinality: '1 → many' },
  { from: 'oauth_consents', to: 'oauth_refresh_tokens', via: 'oauth_refresh_tokens.consent_id', cardinality: '1 → many' },
  { from: 'oauth_clients', to: 'oauth_audit_events', via: 'oauth_audit_events.client_id', cardinality: '1 → many' },
];

export const SECURITY_RULES = [
  {
    table: 'oauth_clients',
    rule: 'Developers read clients tied to apps they own; admins read all; writes admin-only or service-role only.',
  },
  {
    table: 'oauth_consents',
    rule: 'Users read ONLY their own consents; developers cannot see user-level consent details; admins read all; writes service-role only.',
  },
  {
    table: 'oauth_access_tokens',
    rule: 'SERVICE-ROLE ONLY. RLS enabled with no authenticated/public select policies — token hashes never exposed to frontend users.',
  },
  {
    table: 'oauth_refresh_tokens',
    rule: 'SERVICE-ROLE ONLY. RLS enabled with no authenticated/public select policies — token hashes never exposed to frontend users.',
  },
  {
    table: 'oauth_audit_events',
    rule: 'Users read their own events when safe; developers cannot read audit rows yet; admins read all; inserts service-role only.',
  },
];

export const IMPLEMENTATION_STATUS = [
  { area: 'Schema', status: 'Foundation', tone: 'ready' },
  { area: 'OAuth Flow', status: 'Not implemented', tone: 'blocked' },
  { area: 'Token Issuance', status: 'Not implemented', tone: 'blocked' },
  { area: 'Wallet APIs', status: 'Blocked', tone: 'blocked' },
  { area: 'Money Movement', status: 'Blocked', tone: 'blocked' },
];

export const TOKEN_SECURITY = {
  hashOnly: [
    'Access tokens — stored as token_hash only.',
    'Refresh tokens — stored as token_hash only.',
    'Client secrets — stored as client_secret_hash only.',
  ],
  neverStored: [
    'Plaintext access tokens',
    'Plaintext refresh tokens',
    'Plaintext client secrets',
  ],
  rls: [
    'RLS enabled on all five OAuth tables.',
    'Token tables deny all authenticated/public select access.',
    'No wallet or transaction APIs are exposed through this foundation.',
  ],
};

/**
 * @returns {Readonly<OAuthScopeDefinition[]>}
 */
export function getOAuthScopes() {
  return OAUTH_SCOPE_CATALOG;
}

/**
 * @param {string} scope
 * @returns {OAuthScopeDefinition | undefined}
 */
export function getOAuthScope(scope) {
  return OAUTH_SCOPE_CATALOG.find((entry) => entry.scope === scope);
}

/**
 * @param {'low' | 'medium' | 'high' | 'critical'} riskLevel
 * @returns {Readonly<OAuthScopeDefinition[]>}
 */
export function getScopesByRiskLevel(riskLevel) {
  return OAUTH_SCOPE_CATALOG.filter((entry) => entry.riskLevel === riskLevel);
}

/**
 * @returns {{
 *   phase: string;
 *   tables: number;
 *   serviceRoleOnlyTables: number;
 *   scopes: number;
 *   auditEventTypes: number;
 *   relationshipSteps: number;
 * }}
 */
export function getConsentDataModelSummary() {
  return {
    phase: OAUTH_MODEL_PHASE,
    tables: OAUTH_TABLES.length,
    serviceRoleOnlyTables: OAUTH_TABLES.filter((t) => t.serviceRoleOnly).length,
    scopes: OAUTH_SCOPE_CATALOG.length,
    auditEventTypes: OAUTH_AUDIT_EVENT_TYPES.length,
    relationshipSteps: CONSENT_RELATIONSHIP_FLOW.length,
  };
}

/**
 * @returns {Readonly<typeof OAUTH_TABLES>}
 */
export function getOAuthTableDefinitions() {
  return OAUTH_TABLES;
}

/** @deprecated Use getConsentDataModelSummary */
export function getOAuthModelSummary() {
  const summary = getConsentDataModelSummary();
  return {
    tables: summary.tables,
    serviceRoleOnlyTables: summary.serviceRoleOnlyTables,
    scopes: summary.scopes,
    auditEventTypes: summary.auditEventTypes,
  };
}
