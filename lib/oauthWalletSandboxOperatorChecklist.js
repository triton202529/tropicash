/**
 * Tropicash — Phase 13E OAuth wallet sandbox operator checklist.
 *
 * Formal operator procedures for consistent OAuth wallet sandbox certification
 * runs. Pure data-driven logic — no database, no persistence, no wallet mutation,
 * no production approval, and no new OAuth capabilities.
 */

export const CHECKLIST_PHASE = '13E';

/** @typedef {'NOT_STARTED' | 'IN_PROGRESS' | 'READY_FOR_CERTIFICATION' | 'CERTIFIED' | 'FAILED'} ChecklistStatus */

/** @typedef {'pending' | 'complete' | 'failed'} ChecklistItemState */

export const CHECKLIST_STATUSES = {
  NOT_STARTED: {
    key: 'NOT_STARTED',
    label: 'Not started',
    tone: 'info',
    description: 'Operator checklist has not been started for this certification run.',
  },
  IN_PROGRESS: {
    key: 'IN_PROGRESS',
    label: 'In progress',
    tone: 'warn',
    description: 'Some checklist items are complete; remaining items must be verified.',
  },
  READY_FOR_CERTIFICATION: {
    key: 'READY_FOR_CERTIFICATION',
    label: 'Ready for certification',
    tone: 'ready',
    description:
      'All operator checklist items verified. Proceed to harness evidence capture and certification evaluation.',
  },
  CERTIFIED: {
    key: 'CERTIFIED',
    label: 'Certified',
    tone: 'ready',
    description:
      'Operator checklist complete and certification gate status is CERTIFIED. Operationally ready for sandbox progression.',
  },
  FAILED: {
    key: 'FAILED',
    label: 'Failed',
    tone: 'blocked',
    description: 'One or more checklist items failed verification. Resolve before certification.',
  },
};

/** Fields approved for OAuth wallet sandbox responses. */
export const ALLOWED_WALLET_FIELDS = [
  'user_id',
  'currency',
  'available_balance',
  'wallet_status',
  'kyc_status',
  'access_type',
  'scope',
  'environment',
];

/** Fields that must never appear in OAuth wallet sandbox responses or evidence. */
export const BLOCKED_WALLET_FIELDS = [
  'transaction history',
  'payment methods',
  'bank accounts',
  'KYC documents',
  'fraud scores',
  'internal risk notes',
  'admin-only fields',
];

/**
 * @returns {Array<{
 *   id: string;
 *   title: string;
 *   summary: string;
 *   items: Array<{ id: string; label: string; required: boolean; kind?: string }>;
 * }>}
 */
export function getOAuthWalletChecklist() {
  return [
    {
      id: 'environment_verification',
      title: 'Environment Verification',
      summary: 'Confirm sandbox-only execution context before any certification run.',
      items: [
        { id: 'env_sandbox_confirmed', label: 'Sandbox environment confirmed', required: true },
        { id: 'env_production_oauth_disabled', label: 'Production OAuth disabled', required: true },
        { id: 'env_test_oauth_client', label: 'Test OAuth client available', required: true },
        { id: 'env_test_user_account', label: 'Test user account available', required: true },
        { id: 'env_test_wallet_account', label: 'Test wallet account available', required: true },
      ],
    },
    {
      id: 'oauth_flow_verification',
      title: 'OAuth Flow Verification',
      summary: 'Confirm successful end-to-end OAuth wallet sandbox harness execution.',
      items: [
        { id: 'flow_auth_request', label: 'Authorization request generated', required: true },
        { id: 'flow_consent_screen', label: 'Consent screen displayed', required: true },
        { id: 'flow_consent_created', label: 'Consent created', required: true },
        { id: 'flow_auth_code_issued', label: 'Authorization code issued', required: true },
        { id: 'flow_token_exchange', label: 'Token exchange completed', required: true },
        { id: 'flow_access_token_validated', label: 'Access token validated', required: true },
        { id: 'flow_profile_endpoint', label: 'Profile endpoint successful', required: true },
        { id: 'flow_wallet_endpoint', label: 'Wallet endpoint successful', required: true },
        { id: 'flow_refresh_rotation', label: 'Refresh token rotation successful', required: true },
        { id: 'flow_token_revocation', label: 'Token revocation successful', required: true },
        { id: 'flow_revoked_rejected', label: 'Revoked token rejected', required: true },
      ],
    },
    {
      id: 'security_validation',
      title: 'Security Validation',
      summary: 'Confirm evidence sanitization and platform security controls.',
      items: [
        { id: 'sec_no_client_secrets', label: 'No client secrets stored in evidence', required: true },
        { id: 'sec_no_access_tokens', label: 'No access tokens stored', required: true },
        { id: 'sec_no_refresh_tokens', label: 'No refresh tokens stored', required: true },
        { id: 'sec_no_auth_codes', label: 'No authorization codes stored', required: true },
        { id: 'sec_no_balances_in_evidence', label: 'No wallet balances stored in evidence', required: true },
        { id: 'sec_scope_enforcement', label: 'Scope enforcement verified', required: true },
        { id: 'sec_rate_limits', label: 'Rate limits verified', required: true },
        { id: 'sec_audit_events', label: 'Audit events recorded', required: true },
        { id: 'sec_suspicious_access_review', label: 'Suspicious access review functioning', required: true },
      ],
    },
    {
      id: 'wallet_data_exposure',
      title: 'Wallet Data Exposure Validation',
      summary: 'Confirm only approved wallet fields are returned; blocked fields are absent.',
      items: [
        ...ALLOWED_WALLET_FIELDS.map((field) => ({
          id: `wallet_allowed_${field}`,
          label: `Allowed field present: ${field}`,
          required: true,
          kind: 'allowed_field',
        })),
        ...BLOCKED_WALLET_FIELDS.map((field) => ({
          id: `wallet_blocked_${field.replace(/\s+/g, '_')}`,
          label: `Blocked field absent: ${field}`,
          required: true,
          kind: 'blocked_field',
        })),
      ],
    },
    {
      id: 'failure_scenario_testing',
      title: 'Failure Scenario Testing',
      summary: 'Verify expected error paths and access controls.',
      items: [
        { id: 'fail_invalid_token_401', label: 'Invalid access token → 401', required: true },
        { id: 'fail_missing_scope_403', label: 'Missing wallet.read scope → 403', required: true },
        { id: 'fail_revoked_token_rejected', label: 'Revoked token rejected', required: true },
        { id: 'fail_foundation_token_blocked', label: 'Foundation-mode token blocked', required: true },
        { id: 'fail_rate_limit_429', label: 'Rate limit exceeded → 429', required: true },
        { id: 'fail_invalid_client_rejected', label: 'Invalid OAuth client rejected', required: true },
      ],
    },
  ];
}

/**
 * Flatten all checklist items from categories.
 *
 * @returns {Array<{ id: string; label: string; required: boolean; categoryId: string; categoryTitle: string }>}
 */
export function flattenChecklistItems() {
  const out = [];
  for (const category of getOAuthWalletChecklist()) {
    for (const item of category.items) {
      out.push({
        ...item,
        categoryId: category.id,
        categoryTitle: category.title,
      });
    }
  }
  return out;
}

/**
 * Resolve item state from operator completions map.
 *
 * @param {string} itemId
 * @param {Record<string, ChecklistItemState>} completions
 * @returns {ChecklistItemState}
 */
function resolveItemState(itemId, completions) {
  const state = completions[itemId];
  if (state === 'complete' || state === 'failed') return state;
  return 'pending';
}

/**
 * Evaluate operator checklist completion and overall readiness status.
 *
 * @param {object} [options]
 * @param {Record<string, ChecklistItemState>} [options.completions] Operator item states
 * @param {string} [options.certificationGateStatus] Phase 13D gate status (CERTIFIED, etc.)
 * @returns {{
 *   status: ChecklistStatus;
 *   statusMeta: (typeof CHECKLIST_STATUSES)[ChecklistStatus];
 *   categories: Array<{
 *     id: string;
 *     title: string;
 *     summary: string;
 *     items: Array<{ id: string; label: string; required: boolean; state: ChecklistItemState; kind?: string }>;
 *     completed: number;
 *     failed: number;
 *     pending: number;
 *     total: number;
 *     percentComplete: number;
 *   }>;
 *   totalItems: number;
 *   completedItems: number;
 *   failedItems: number;
 *   pendingItems: number;
 *   percentComplete: number;
 *   readyForCertification: boolean;
 *   operationallyReady: boolean;
 * }}
 */
export function evaluateOAuthWalletChecklist(options = {}) {
  const completions = options.completions && typeof options.completions === 'object'
    ? options.completions
    : {};
  const certificationGateStatus = String(options.certificationGateStatus || '').trim();

  const categories = getOAuthWalletChecklist().map((category) => {
    const items = category.items.map((item) => {
      const state = resolveItemState(item.id, completions);
      return { ...item, state };
    });

    const requiredItems = items.filter((i) => i.required);
    const completed = requiredItems.filter((i) => i.state === 'complete').length;
    const failed = requiredItems.filter((i) => i.state === 'failed').length;
    const pending = requiredItems.filter((i) => i.state === 'pending').length;
    const total = requiredItems.length;

    return {
      id: category.id,
      title: category.title,
      summary: category.summary,
      items,
      completed,
      failed,
      pending,
      total,
      percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  const allRequired = categories.flatMap((c) => c.items.filter((i) => i.required));
  const totalItems = allRequired.length;
  const completedItems = allRequired.filter((i) => i.state === 'complete').length;
  const failedItems = allRequired.filter((i) => i.state === 'failed').length;
  const pendingItems = allRequired.filter((i) => i.state === 'pending').length;
  const percentComplete = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  let status = 'NOT_STARTED';

  if (failedItems > 0) {
    status = 'FAILED';
  } else if (completedItems === 0) {
    status = 'NOT_STARTED';
  } else if (completedItems < totalItems) {
    status = 'IN_PROGRESS';
  } else {
    status = 'READY_FOR_CERTIFICATION';
  }

  const readyForCertification = status === 'READY_FOR_CERTIFICATION';
  const gateCertified = certificationGateStatus === 'CERTIFIED';

  if (readyForCertification && gateCertified) {
    status = 'CERTIFIED';
  }

  const operationallyReady = readyForCertification && gateCertified;

  return {
    status,
    statusMeta: CHECKLIST_STATUSES[status],
    categories,
    totalItems,
    completedItems,
    failedItems,
    pendingItems,
    percentComplete,
    readyForCertification,
    operationallyReady,
  };
}

/**
 * Build a readiness summary from a checklist evaluation.
 *
 * @param {ReturnType<typeof evaluateOAuthWalletChecklist>} evaluation
 * @returns {{
 *   phase: string;
 *   status: ChecklistStatus;
 *   totalItems: number;
 *   completedItems: number;
 *   failedItems: number;
 *   pendingItems: number;
 *   percentComplete: number;
 *   readyForCertification: boolean;
 *   operationallyReady: boolean;
 *   categoriesComplete: number;
 *   categoriesTotal: number;
 * }}
 */
export function getChecklistReadinessSummary(evaluation) {
  const eval_ = evaluation || evaluateOAuthWalletChecklist();
  const categoriesComplete = eval_.categories.filter(
    (c) => c.total > 0 && c.completed === c.total && c.failed === 0,
  ).length;

  return {
    phase: CHECKLIST_PHASE,
    status: eval_.status,
    totalItems: eval_.totalItems,
    completedItems: eval_.completedItems,
    failedItems: eval_.failedItems,
    pendingItems: eval_.pendingItems,
    percentComplete: eval_.percentComplete,
    readyForCertification: eval_.readyForCertification,
    operationallyReady: eval_.operationallyReady,
    categoriesComplete,
    categoriesTotal: eval_.categories.length,
  };
}
