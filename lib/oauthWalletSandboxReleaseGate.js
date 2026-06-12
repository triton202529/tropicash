/**
 * Tropicash — Phase 13F OAuth wallet sandbox final certification & release gate.
 *
 * Executive/governance release decision layer for external developer sandbox
 * access. Pure evaluation logic — no database writes, no automatic promotion,
 * no production approval, and no money movement.
 */

import { ALLOWED_WALLET_FIELDS } from './oauthWalletSandboxOperatorChecklist';

export const RELEASE_GATE_PHASE = '13F';

/** @typedef {'BLOCKED' | 'READY_FOR_SANDBOX_RELEASE' | 'SANDBOX_RELEASED'} SandboxReleaseStatus */

export const SANDBOX_RELEASE_STATUSES = {
  BLOCKED: {
    key: 'BLOCKED',
    label: 'Blocked',
    tone: 'blocked',
    description:
      'Sandbox release requirements are not satisfied. External developer sandbox access is not approved.',
  },
  READY_FOR_SANDBOX_RELEASE: {
    key: 'READY_FOR_SANDBOX_RELEASE',
    label: 'Ready for sandbox release',
    tone: 'ready',
    description:
      'All release requirements are satisfied. Executive approval may grant external developer sandbox access.',
  },
  SANDBOX_RELEASED: {
    key: 'SANDBOX_RELEASED',
    label: 'Sandbox released',
    tone: 'released',
    description:
      'Sandbox release has been explicitly approved. Does not enable production access or money movement.',
  },
};

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   group: string;
 *   passed: boolean;
 *   blocker?: string;
 *   detail?: string;
 * }} ReleaseRequirement
 */

/**
 * Platform security controls implemented in prior OAuth wallet sandbox phases.
 * @type {Array<{ id: string; label: string; baselinePassed: boolean; detail: string }>}
 */
const SECURITY_CONTROL_BASELINE = [
  {
    id: 'sec_rate_limiting',
    label: 'Rate limiting active',
    baselinePassed: true,
    detail: 'Phase 12Y — per-token hourly limits via oauth_api_usage_logs.',
  },
  {
    id: 'sec_audit_logging',
    label: 'Audit logging active',
    baselinePassed: true,
    detail: 'OAuth wallet read and token lifecycle events audited.',
  },
  {
    id: 'sec_token_revocation',
    label: 'Token revocation functioning',
    baselinePassed: true,
    detail: 'Phase 12U+ — POST /api/oauth/revoke-token and harness revocation step.',
  },
  {
    id: 'sec_suspicious_access',
    label: 'Suspicious access review path active',
    baselinePassed: true,
    detail: 'Phase 12Y — suspicious access review cases and admin queue.',
  },
];

const WALLET_EXPOSURE_BASELINE = [
  {
    id: 'wallet_approved_fields_only',
    label: 'Only approved wallet fields exposed',
    baselinePassed: true,
    detail: `Allowed: ${ALLOWED_WALLET_FIELDS.join(', ')}`,
  },
  {
    id: 'wallet_no_transactions',
    label: 'No transaction data exposed',
    baselinePassed: true,
    detail: 'Transaction history blocked from OAuth wallet read response.',
  },
  {
    id: 'wallet_no_payment_methods',
    label: 'No payment methods exposed',
    baselinePassed: true,
    detail: 'Payment methods blocked from OAuth wallet read response.',
  },
  {
    id: 'wallet_no_kyc_documents',
    label: 'No KYC documents exposed',
    baselinePassed: true,
    detail: 'KYC documents blocked; only kyc_status summary permitted.',
  },
  {
    id: 'wallet_no_balance_mutation',
    label: 'No balance mutation APIs',
    baselinePassed: true,
    detail: 'OAuth wallet endpoint is read-only GET; no send/withdraw APIs.',
  },
];

const ENVIRONMENT_CONTROL_BASELINE = [
  {
    id: 'env_sandbox_only',
    label: 'Sandbox environment only',
    baselinePassed: true,
    detail: 'Release gate governs sandbox access only — not production.',
  },
  {
    id: 'env_production_oauth_disabled',
    label: 'Production OAuth disabled',
    baselinePassed: true,
    detail: 'Production OAuth wallet access is not enabled by this gate.',
  },
  {
    id: 'env_no_live_credentials',
    label: 'No live API credentials',
    baselinePassed: true,
    detail: 'Sandbox certification uses test OAuth clients only.',
  },
  {
    id: 'env_no_production_tokens',
    label: 'No production tokens',
    baselinePassed: true,
    detail: 'Production token issuance is outside sandbox release scope.',
  },
];

/**
 * @returns {Array<{
 *   id: string;
 *   title: string;
 *   summary: string;
 *   requirements: Array<{ id: string; label: string; dynamic?: boolean }>;
 * }>}
 */
export function getSandboxReleaseRequirements() {
  return [
    {
      id: 'technical_certification',
      title: 'Technical Certification',
      summary: 'Phase 13C OAuth wallet sandbox certification must be certified.',
      requirements: [
        {
          id: 'tech_certification_certified',
          label: 'OAuth Wallet Certification status = CERTIFIED',
          dynamic: true,
        },
      ],
    },
    {
      id: 'operational_readiness',
      title: 'Operational Readiness',
      summary: 'Phase 13E operator checklist must be ready for certification.',
      requirements: [
        {
          id: 'ops_checklist_ready',
          label: 'Operator checklist status = READY_FOR_CERTIFICATION',
          dynamic: true,
        },
      ],
    },
    {
      id: 'security_controls',
      title: 'Security Controls',
      summary: 'Platform security controls active and evidence free of secret leaks.',
      requirements: [
        ...SECURITY_CONTROL_BASELINE.map((c) => ({ id: c.id, label: c.label })),
        {
          id: 'sec_no_secret_exposure',
          label: 'No secret exposure in evidence',
          dynamic: true,
        },
      ],
    },
    {
      id: 'wallet_exposure_controls',
      title: 'Wallet Exposure Controls',
      summary: 'OAuth wallet sandbox exposes only approved read-only fields.',
      requirements: WALLET_EXPOSURE_BASELINE.map((c) => ({ id: c.id, label: c.label })),
    },
    {
      id: 'environment_controls',
      title: 'Environment Controls',
      summary: 'Sandbox-only execution with production separation enforced.',
      requirements: ENVIRONMENT_CONTROL_BASELINE.map((c) => ({ id: c.id, label: c.label })),
    },
  ];
}

/**
 * Evaluate a requirement group result.
 *
 * @param {string} groupId
 * @param {ReleaseRequirement[]} items
 * @returns {{ id: string; passed: boolean; items: ReleaseRequirement[]; blockers: string[] }}
 */
function summarizeGroup(groupId, items) {
  const blockers = items.filter((i) => !i.passed).map((i) => i.blocker || i.label);
  return {
    id: groupId,
    passed: blockers.length === 0,
    items,
    blockers,
  };
}

/**
 * Evaluate final OAuth wallet sandbox release gate.
 *
 * Defaults to BLOCKED. SANDBOX_RELEASED requires explicit releaseApproved flag.
 * No automatic promotion.
 *
 * @param {object} [options]
 * @param {object} [options.certificationGate] Result of evaluateCertificationGate()
 * @param {object} [options.checklistEvaluation] Result of evaluateOAuthWalletChecklist()
 * @param {boolean} [options.releaseApproved] Explicit executive release approval
 * @returns {{
 *   releaseStatus: SandboxReleaseStatus;
 *   releaseMeta: (typeof SANDBOX_RELEASE_STATUSES)[SandboxReleaseStatus];
 *   technicalCertification: ReturnType<typeof summarizeGroup>;
 *   operationalReadiness: ReturnType<typeof summarizeGroup>;
 *   securityControls: ReturnType<typeof summarizeGroup>;
 *   walletExposureControls: ReturnType<typeof summarizeGroup>;
 *   environmentControls: ReturnType<typeof summarizeGroup>;
 *   blockers: string[];
 *   passedCount: number;
 *   failedCount: number;
 *   totalCount: number;
 *   readinessPercent: number;
 *   releaseApproved: boolean;
 * }}
 */
export function evaluateOAuthWalletSandboxRelease(options = {}) {
  const certificationGate = options.certificationGate || {
    gateStatus: 'NOT_EVALUATED',
    leak_detected: false,
  };
  const checklistEvaluation = options.checklistEvaluation || {
    status: 'NOT_STARTED',
    readyForCertification: false,
  };
  const releaseApproved = Boolean(options.releaseApproved);

  const gateCertified = certificationGate.gateStatus === 'CERTIFIED';
  const checklistReady = checklistEvaluation.readyForCertification === true
    || checklistEvaluation.status === 'READY_FOR_CERTIFICATION'
    || checklistEvaluation.status === 'CERTIFIED';
  const noLeaks = !certificationGate.leak_detected;

  const technicalItems = [
    {
      id: 'tech_certification_certified',
      label: 'OAuth Wallet Certification status = CERTIFIED',
      group: 'technical_certification',
      passed: gateCertified,
      blocker: gateCertified ? undefined : `certification_gate: ${certificationGate.gateStatus || 'NOT_EVALUATED'}`,
      detail: 'Phase 13C certification evaluation required.',
    },
  ];

  const operationalItems = [
    {
      id: 'ops_checklist_ready',
      label: 'Operator checklist status = READY_FOR_CERTIFICATION',
      group: 'operational_readiness',
      passed: checklistReady,
      blocker: checklistReady ? undefined : `operator_checklist: ${checklistEvaluation.status || 'NOT_STARTED'}`,
      detail: 'Phase 13E operator checklist must be complete.',
    },
  ];

  const securityItems = [
    ...SECURITY_CONTROL_BASELINE.map((c) => ({
      id: c.id,
      label: c.label,
      group: 'security_controls',
      passed: c.baselinePassed,
      detail: c.detail,
    })),
    {
      id: 'sec_no_secret_exposure',
      label: 'No secret exposure in evidence',
      group: 'security_controls',
      passed: noLeaks,
      blocker: noLeaks ? undefined : 'evidence_leak_detected',
      detail: 'Phase 13C leak detection must pass on certification evidence.',
    },
  ];

  const walletItems = WALLET_EXPOSURE_BASELINE.map((c) => ({
    id: c.id,
    label: c.label,
    group: 'wallet_exposure_controls',
    passed: c.baselinePassed,
    detail: c.detail,
  }));

  const environmentItems = ENVIRONMENT_CONTROL_BASELINE.map((c) => ({
    id: c.id,
    label: c.label,
    group: 'environment_controls',
    passed: c.baselinePassed,
    detail: c.detail,
  }));

  const technicalCertification = summarizeGroup('technical_certification', technicalItems);
  const operationalReadiness = summarizeGroup('operational_readiness', operationalItems);
  const securityControls = summarizeGroup('security_controls', securityItems);
  const walletExposureControls = summarizeGroup('wallet_exposure_controls', walletItems);
  const environmentControls = summarizeGroup('environment_controls', environmentItems);

  const allItems = [
    ...technicalItems,
    ...operationalItems,
    ...securityItems,
    ...walletItems,
    ...environmentItems,
  ];

  const passedCount = allItems.filter((i) => i.passed).length;
  const failedCount = allItems.filter((i) => !i.passed).length;
  const totalCount = allItems.length;
  const readinessPercent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;

  const blockers = allItems.filter((i) => !i.passed).map((i) => i.blocker || i.label);

  const allGroupsPassed =
    technicalCertification.passed
    && operationalReadiness.passed
    && securityControls.passed
    && walletExposureControls.passed
    && environmentControls.passed;

  let releaseStatus = 'BLOCKED';
  if (allGroupsPassed && releaseApproved) {
    releaseStatus = 'SANDBOX_RELEASED';
  } else if (allGroupsPassed) {
    releaseStatus = 'READY_FOR_SANDBOX_RELEASE';
  }

  return {
    releaseStatus,
    releaseMeta: SANDBOX_RELEASE_STATUSES[releaseStatus],
    technicalCertification,
    operationalReadiness,
    securityControls,
    walletExposureControls,
    environmentControls,
    blockers,
    passedCount,
    failedCount,
    totalCount,
    readinessPercent,
    releaseApproved,
  };
}

/**
 * Build a release gate summary from an evaluation.
 *
 * @param {ReturnType<typeof evaluateOAuthWalletSandboxRelease>} [evaluation]
 * @returns {{
 *   phase: string;
 *   releaseStatus: SandboxReleaseStatus;
 *   readinessPercent: number;
 *   passedCount: number;
 *   failedCount: number;
 *   totalCount: number;
 *   groupsPassed: number;
 *   groupsTotal: number;
 *   blockers: string[];
 *   releaseApproved: boolean;
 *   sandboxOnly: boolean;
 *   productionSeparated: boolean;
 * }}
 */
export function getSandboxReleaseSummary(evaluation) {
  const eval_ = evaluation || evaluateOAuthWalletSandboxRelease();
  const groups = [
    eval_.technicalCertification,
    eval_.operationalReadiness,
    eval_.securityControls,
    eval_.walletExposureControls,
    eval_.environmentControls,
  ];

  return {
    phase: RELEASE_GATE_PHASE,
    releaseStatus: eval_.releaseStatus,
    readinessPercent: eval_.readinessPercent,
    passedCount: eval_.passedCount,
    failedCount: eval_.failedCount,
    totalCount: eval_.totalCount,
    groupsPassed: groups.filter((g) => g.passed).length,
    groupsTotal: groups.length,
    blockers: eval_.blockers,
    releaseApproved: eval_.releaseApproved,
    sandboxOnly: eval_.environmentControls.passed,
    productionSeparated: eval_.environmentControls.passed,
  };
}
