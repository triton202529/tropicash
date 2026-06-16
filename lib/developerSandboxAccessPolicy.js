/**
 * Tropicash — Phase 14C–14E developer sandbox access policy & capability enforcement.
 *
 * Central source of truth for sandbox approval checks. Server-side enforcement
 * only — approval does not create credentials or OAuth clients.
 */

import { supabase } from './supabaseClient';
import {
  ALLOWED_SANDBOX_CAPABILITIES,
  DISALLOWED_SANDBOX_CAPABILITIES,
  SANDBOX_APPLICATIONS_TABLE,
} from './developerSandboxApplications';
import {
  getCurrentAgreementVersion,
  getSandboxAgreementStatus,
  hasAcceptedSandboxAgreement,
} from './developerSandboxAgreements';
import { getSandboxAccessStatus } from './developerSandboxAccessLifecycle';

export const ACCESS_POLICY_PHASE = '14E';

/** @typedef {'approved' | 'pending' | 'rejected' | 'no_application'} SandboxApprovalStatus */

export const HARD_BLOCKED_CAPABILITIES = [...DISALLOWED_SANDBOX_CAPABILITIES];

const HARD_BLOCKED_SET = new Set(HARD_BLOCKED_CAPABILITIES);

const ALLOWED_CAPABILITY_IDS = new Set(
  ALLOWED_SANDBOX_CAPABILITIES.map((c) => c.id),
);

const OAUTH_CLIENT_CAPABILITIES = new Set(['oauth_profile', 'oauth_wallet_sandbox']);

const API_CREDENTIAL_CAPABILITIES = new Set(['platform_status', 'supported_currencies']);

function isUuidLike(v) {
  if (typeof v !== 'string' || !v.trim()) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

function accessDeniedError(capability, reason = 'sandbox_access_not_approved') {
  return {
    ok: false,
    error: {
      message: 'Sandbox access not approved for this capability.',
      code: reason,
      capability,
    },
  };
}

function agreementRequiredError() {
  return {
    ok: false,
    error: {
      message: 'You must accept the Tropicash Sandbox Agreement before using sandbox capabilities.',
      code: 'sandbox_agreement_required',
    },
  };
}

function lifecycleInactiveError(effectiveStatus = 'pending_activation') {
  return {
    ok: false,
    error: {
      message: 'Sandbox access is not active. Admin activation is required.',
      code: 'sandbox_access_not_active',
      lifecycleStatus: effectiveStatus,
    },
  };
}

/**
 * Require current sandbox agreement acceptance.
 *
 * @param {string} userId
 * @returns {Promise<{ ok: boolean; error?: { message: string; code: string } }>}
 */
export async function requireSandboxAgreementAccepted(userId) {
  const accepted = await hasAcceptedSandboxAgreement(userId);
  if (!accepted) {
    return agreementRequiredError();
  }
  return { ok: true };
}

/**
 * Require ACTIVE sandbox lifecycle status.
 *
 * @param {string} userId
 */
export async function requireSandboxAccessActive(userId) {
  const lifecycle = await getSandboxAccessStatus(userId);
  if (!lifecycle.active) {
    return lifecycleInactiveError(lifecycle.effectiveStatus);
  }
  return { ok: true, lifecycle };
}

/**
 * Fetch sandbox applications for a user (own rows via RLS).
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function fetchUserApplications(userId) {
  const { data, error } = await supabase
    .from(SANDBOX_APPLICATIONS_TABLE)
    .select(
      'id, organization_name, developer_name, email, status, requested_capabilities, created_at, reviewed_at, reviewed_by',
    )
    .eq('user_id', userId.trim())
    .order('created_at', { ascending: false });

  if (error) return [];
  return Array.isArray(data) ? data : [];
}

/**
 * Resolve the effective sandbox application for policy evaluation.
 *
 * @param {object[]} applications
 * @returns {object | null}
 */
function resolveEffectiveApplication(applications) {
  const approved = applications.find((a) => a.status === 'approved');
  if (approved) return approved;
  return applications[0] || null;
}

/**
 * @param {string} userId
 * @returns {Promise<{
 *   status: SandboxApprovalStatus;
 *   approved: boolean;
 *   applicationId: string | null;
 *   organizationName: string | null;
 *   capabilities: string[];
 *   reviewedAt: string | null;
 *   submittedAt: string | null;
 * }>}
 */
export async function getDeveloperSandboxApprovalStatus(userId) {
  const evaluation = await evaluateDeveloperSandboxAccess(userId);
  return {
    status: evaluation.status,
    approved: evaluation.approved,
    applicationId: evaluation.applicationId,
    organizationName: evaluation.organizationName,
    capabilities: evaluation.capabilities,
    reviewedAt: evaluation.reviewedAt,
    submittedAt: evaluation.submittedAt,
  };
}

/**
 * @param {string} userId
 * @returns {Promise<string[]>}
 */
export async function getApprovedSandboxCapabilities(userId) {
  const evaluation = await evaluateDeveloperSandboxAccess(userId);
  if (!evaluation.approved) return [];
  return evaluation.capabilities;
}

/**
 * Full sandbox access evaluation for a developer.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   status: SandboxApprovalStatus;
 *   approved: boolean;
 *   applicationId: string | null;
 *   organizationName: string | null;
 *   capabilities: string[];
 *   reviewedAt: string | null;
 *   submittedAt: string | null;
 *   rawApplicationStatus: string | null;
 *   agreementAccepted: boolean;
 *   agreementVersion: string | null;
 *   agreementAcceptedAt: string | null;
 *   currentAgreementVersion: string;
 *   readyForSandboxResources: boolean;
 *   lifecycleStatus: string;
 *   lifecycleEffectiveStatus: string;
 *   lifecycleActive: boolean;
 *   lifecycleActivatedAt: string | null;
 *   lifecycleExpiresAt: string | null;
 * }>}
 */
export async function evaluateDeveloperSandboxAccess(userId) {
  const currentAgreementVersion = getCurrentAgreementVersion();

  const emptyLifecycle = {
    lifecycleStatus: 'pending_activation',
    lifecycleEffectiveStatus: 'pending_activation',
    lifecycleActive: false,
    lifecycleActivatedAt: null,
    lifecycleExpiresAt: null,
  };

  if (!isUuidLike(userId)) {
    return {
      status: 'no_application',
      approved: false,
      applicationId: null,
      organizationName: null,
      capabilities: [],
      reviewedAt: null,
      submittedAt: null,
      rawApplicationStatus: null,
      agreementAccepted: false,
      agreementVersion: null,
      agreementAcceptedAt: null,
      currentAgreementVersion,
      readyForSandboxResources: false,
      ...emptyLifecycle,
    };
  }

  const [applications, agreementStatus, lifecycle] = await Promise.all([
    fetchUserApplications(userId),
    getSandboxAgreementStatus(userId),
    getSandboxAccessStatus(userId),
  ]);
  const effective = resolveEffectiveApplication(applications);

  const lifecycleFields = {
    lifecycleStatus: lifecycle.status,
    lifecycleEffectiveStatus: lifecycle.effectiveStatus,
    lifecycleActive: lifecycle.active,
    lifecycleActivatedAt: lifecycle.activatedAt,
    lifecycleExpiresAt: lifecycle.expiresAt,
  };

  if (!effective) {
    return {
      status: 'no_application',
      approved: false,
      applicationId: null,
      organizationName: null,
      capabilities: [],
      reviewedAt: null,
      submittedAt: null,
      rawApplicationStatus: null,
      agreementAccepted: agreementStatus.accepted,
      agreementVersion: agreementStatus.agreementVersion,
      agreementAcceptedAt: agreementStatus.acceptedAt,
      currentAgreementVersion,
      readyForSandboxResources: false,
      ...lifecycleFields,
    };
  }

  const rawStatus = String(effective.status || '').toLowerCase();
  const capabilities = rawStatus === 'approved'
    ? (Array.isArray(effective.requested_capabilities)
        ? effective.requested_capabilities.filter((c) => ALLOWED_CAPABILITY_IDS.has(c))
        : [])
    : [];

  let status = 'pending';
  if (rawStatus === 'approved') status = 'approved';
  else if (rawStatus === 'rejected') status = 'rejected';
  else if (rawStatus === 'pending' || rawStatus === 'under_review') status = 'pending';

  const approved = status === 'approved';
  const agreementAccepted = agreementStatus.accepted;

  return {
    status,
    approved,
    applicationId: effective.id,
    organizationName: effective.organization_name || null,
    capabilities,
    reviewedAt: effective.reviewed_at || null,
    submittedAt: effective.created_at || null,
    rawApplicationStatus: rawStatus,
    agreementAccepted,
    agreementVersion: agreementStatus.agreementVersion,
    agreementAcceptedAt: agreementStatus.acceptedAt,
    currentAgreementVersion,
    readyForSandboxResources: approved && agreementAccepted && lifecycle.active,
    ...lifecycleFields,
  };
}

/**
 * Require a specific sandbox capability before allowing an action.
 *
 * @param {string} userId
 * @param {string} capability
 * @returns {Promise<{ ok: boolean; error?: { message: string; code: string; capability: string }; evaluation?: object }>}
 */
export async function requireDeveloperSandboxCapability(userId, capability) {
  const cap = String(capability || '').trim();

  if (HARD_BLOCKED_SET.has(cap)) {
    return {
      ok: false,
      error: {
        message: 'This capability is not available in sandbox.',
        code: 'sandbox_capability_blocked',
        capability: cap,
      },
    };
  }

  if (!ALLOWED_CAPABILITY_IDS.has(cap)) {
    return {
      ok: false,
      error: {
        message: 'Unknown sandbox capability.',
        code: 'sandbox_capability_unknown',
        capability: cap,
      },
    };
  }

  const evaluation = await evaluateDeveloperSandboxAccess(userId);

  if (!evaluation.approved) {
    return accessDeniedError(cap);
  }

  if (!evaluation.capabilities.includes(cap)) {
    return accessDeniedError(cap);
  }

  const agreementCheck = await requireSandboxAgreementAccepted(userId);
  if (!agreementCheck.ok) {
    return agreementCheck;
  }

  const lifecycleCheck = await requireSandboxAccessActive(userId);
  if (!lifecycleCheck.ok) {
    return lifecycleCheck;
  }

  return { ok: true, evaluation };
}

/**
 * Require OAuth sandbox access (oauth_profile or oauth_wallet_sandbox).
 *
 * @param {string} userId
 * @returns {Promise<{ ok: boolean; error?: { message: string; code: string }; evaluation?: object }>}
 */
export async function requireOAuthSandboxAccess(userId) {
  const evaluation = await evaluateDeveloperSandboxAccess(userId);

  if (!evaluation.approved) {
    return {
      ok: false,
      error: {
        message: 'Sandbox access not approved for OAuth client creation.',
        code: 'sandbox_access_not_approved',
      },
    };
  }

  const hasOAuth = evaluation.capabilities.some((c) => OAUTH_CLIENT_CAPABILITIES.has(c));
  if (!hasOAuth) {
    return {
      ok: false,
      error: {
        message: 'Approved application must include oauth_profile or oauth_wallet_sandbox.',
        code: 'sandbox_access_not_approved',
      },
    };
  }

  const agreementCheck = await requireSandboxAgreementAccepted(userId);
  if (!agreementCheck.ok) {
    return agreementCheck;
  }

  const lifecycleCheck = await requireSandboxAccessActive(userId);
  if (!lifecycleCheck.ok) {
    return lifecycleCheck;
  }

  return { ok: true, evaluation };
}

/**
 * Require API credential sandbox access (platform_status capability).
 *
 * @param {string} userId
 * @returns {Promise<{ ok: boolean; error?: object; evaluation?: object }>}
 */
export async function requireApiCredentialSandboxAccess(userId) {
  return requireDeveloperSandboxCapability(userId, 'platform_status');
}

/**
 * UI helper labels for approval status badges.
 */
export const SANDBOX_APPROVAL_UI = {
  approved: {
    badge: '✓ Sandbox Approved',
    tone: 'ready',
    message: 'You may create sandbox resources for your approved capabilities.',
  },
  pending: {
    badge: '⏳ Pending Review',
    tone: 'warn',
    message: 'Your sandbox application is pending review. Creation actions are disabled.',
  },
  rejected: {
    badge: '✗ Access Not Approved',
    tone: 'blocked',
    message: 'Your sandbox application was not approved. Contact support or re-apply.',
  },
  no_application: {
    badge: '⚠ Application Required',
    tone: 'info',
    message: 'Submit a sandbox application before creating credentials or OAuth clients.',
    applyHref: '/developers/apply',
  },
};

export const SANDBOX_AGREEMENT_UI = {
  accepted: {
    badge: '✓ Agreement Accepted',
    tone: 'ready',
    message: 'You have accepted the current sandbox agreement.',
  },
  required: {
    badge: '⚠ Agreement Required',
    tone: 'warn',
    message: 'Accept the Tropicash Sandbox Agreement before creating credentials or OAuth clients.',
    agreementHref: '/developers/sandbox-agreement',
  },
};

export const SANDBOX_LIFECYCLE_UI = {
  active: {
    badge: '✓ Sandbox Active',
    tone: 'ready',
    message: 'Your sandbox access is active. You may create resources for approved capabilities.',
  },
  pending_activation: {
    badge: '⏳ Awaiting Activation',
    tone: 'warn',
    message: 'Your application and agreement are on file. An administrator must activate sandbox access.',
  },
  suspended: {
    badge: '⚠ Access Suspended',
    tone: 'blocked',
    message: 'Sandbox access has been suspended. Contact support for assistance.',
  },
  expired: {
    badge: '⌛ Access Expired',
    tone: 'blocked',
    message: 'Sandbox access has expired. Reactivation by an administrator is required.',
  },
  revoked: {
    badge: '✗ Access Revoked',
    tone: 'blocked',
    message: 'Sandbox access has been permanently revoked.',
  },
};

export { API_CREDENTIAL_CAPABILITIES, OAUTH_CLIENT_CAPABILITIES };
