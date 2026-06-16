/**
 * Tropicash — Phase 14D developer sandbox agreements & acceptance audit trail.
 *
 * Immutable agreement records. Acceptance is required before sandbox credential
 * or OAuth client creation. No production access or money movement.
 */

import { supabase } from './supabaseClient';
import { SANDBOX_APPLICATIONS_TABLE } from './developerSandboxApplications';

export const SANDBOX_AGREEMENTS_TABLE = 'developer_sandbox_agreements';

export const SANDBOX_AGREEMENT_PHASE = '14D';

/** Current agreement version requiring acceptance. */
export const CURRENT_SANDBOX_AGREEMENT_VERSION = 'v1.0';

/** Known agreement versions (for admin filters and future migrations). */
export const SANDBOX_AGREEMENT_VERSIONS = ['v1.0', 'v1.1', 'v2.0'];

export const SANDBOX_AGREEMENT_SECTIONS = [
  {
    id: 'sandbox_only',
    title: 'Sandbox only',
    items: [
      'Access is for testing only.',
      'Production environment is unavailable.',
    ],
  },
  {
    id: 'no_money_movement',
    title: 'No money movement',
    items: [
      'Send money APIs are unavailable.',
      'Withdrawal APIs are unavailable.',
      'Payment creation is unavailable.',
    ],
  },
  {
    id: 'security',
    title: 'Security responsibilities',
    items: [
      'Protect API credentials.',
      'Store OAuth client secrets server-side.',
      'Never expose secrets publicly.',
      'Respect rate limits.',
      'Protect user data.',
    ],
  },
  {
    id: 'platform_rules',
    title: 'Platform rules',
    items: [
      'No unauthorized access.',
      'No bypassing controls.',
      'No abuse of sandbox.',
      'Follow Tropicash developer policies.',
    ],
  },
];

const VERSION_SET = new Set(SANDBOX_AGREEMENT_VERSIONS);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isUuidLike(v) {
  if (!isNonEmptyString(v)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

function validationError(message, code = 'validation_error') {
  return { data: null, error: { message, code } };
}

/**
 * @returns {string}
 */
export function getCurrentAgreementVersion() {
  return CURRENT_SANDBOX_AGREEMENT_VERSION;
}

/**
 * Fetch agreement acceptances for a user (own rows via RLS).
 *
 * @param {string} userId
 * @returns {Promise<object[]>}
 */
async function fetchUserAgreements(userId) {
  const { data, error } = await supabase
    .from(SANDBOX_AGREEMENTS_TABLE)
    .select(
      'id, user_id, application_id, agreement_version, accepted_at, accepted_ip, accepted_user_agent, created_at',
    )
    .eq('user_id', userId.trim())
    .order('accepted_at', { ascending: false });

  if (error) return [];
  return Array.isArray(data) ? data : [];
}

/**
 * Whether the user has accepted the current (or specified) agreement version.
 *
 * @param {string} userId
 * @param {string} [version]
 * @returns {Promise<boolean>}
 */
export async function hasAcceptedSandboxAgreement(userId, version = CURRENT_SANDBOX_AGREEMENT_VERSION) {
  if (!isUuidLike(userId)) return false;
  const targetVersion = String(version || CURRENT_SANDBOX_AGREEMENT_VERSION).trim();
  const agreements = await fetchUserAgreements(userId);
  return agreements.some((row) => row.agreement_version === targetVersion);
}

/**
 * Agreement acceptance status for UI and policy evaluation.
 *
 * @param {string} userId
 * @returns {Promise<{
 *   accepted: boolean;
 *   agreementVersion: string | null;
 *   acceptedAt: string | null;
 *   currentVersion: string;
 *   applicationId: string | null;
 * }>}
 */
export async function getSandboxAgreementStatus(userId) {
  const currentVersion = getCurrentAgreementVersion();
  if (!isUuidLike(userId)) {
    return {
      accepted: false,
      agreementVersion: null,
      acceptedAt: null,
      currentVersion,
      applicationId: null,
    };
  }

  const agreements = await fetchUserAgreements(userId);
  const current = agreements.find((row) => row.agreement_version === currentVersion);

  return {
    accepted: Boolean(current),
    agreementVersion: current?.agreement_version || null,
    acceptedAt: current?.accepted_at || null,
    currentVersion,
    applicationId: current?.application_id || null,
  };
}

/**
 * Fetch own agreement records (authenticated developer).
 *
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchOwnSandboxAgreements() {
  const { data, error } = await supabase
    .from(SANDBOX_AGREEMENTS_TABLE)
    .select(
      'id, application_id, agreement_version, accepted_at, accepted_ip, accepted_user_agent, created_at',
    )
    .order('accepted_at', { ascending: false });

  return { data, error };
}

/**
 * Admin: fetch all agreement acceptance records.
 *
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchAllSandboxAgreements() {
  const { data, error } = await supabase
    .from(SANDBOX_AGREEMENTS_TABLE)
    .select(
      'id, user_id, application_id, agreement_version, accepted_at, accepted_ip, accepted_user_agent, created_at',
    )
    .order('accepted_at', { ascending: false });

  return { data, error };
}

/**
 * Resolve the user's approved sandbox application id for agreement linkage.
 *
 * @param {string} userId
 * @returns {Promise<string | null>}
 */
async function resolveApprovedApplicationId(userId) {
  const { data, error } = await supabase
    .from(SANDBOX_APPLICATIONS_TABLE)
    .select('id, status')
    .eq('user_id', userId.trim())
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .limit(1);

  if (error || !Array.isArray(data) || !data.length) return null;
  return data[0].id || null;
}

/**
 * Record sandbox agreement acceptance (immutable insert).
 *
 * @param {{
 *   user_id: string;
 *   agreement_version?: string;
 *   accepted_ip?: string | null;
 *   accepted_user_agent?: string | null;
 * }} payload
 * @returns {Promise<{ data: object | null; error: object | null }>}
 */
export async function acceptSandboxAgreement(payload) {
  const user_id = payload?.user_id;
  const agreement_version = String(
    payload?.agreement_version || CURRENT_SANDBOX_AGREEMENT_VERSION,
  ).trim();

  if (!isUuidLike(user_id)) {
    return validationError('user_id must be a valid UUID.');
  }
  if (!VERSION_SET.has(agreement_version)) {
    return validationError(`Unsupported agreement version: ${agreement_version}`);
  }
  if (agreement_version !== CURRENT_SANDBOX_AGREEMENT_VERSION) {
    return validationError(
      `Only ${CURRENT_SANDBOX_AGREEMENT_VERSION} acceptance is currently required.`,
      'agreement_version_outdated',
    );
  }

  const alreadyAccepted = await hasAcceptedSandboxAgreement(user_id, agreement_version);
  if (alreadyAccepted) {
    return validationError(
      `Agreement ${agreement_version} has already been accepted.`,
      'agreement_already_accepted',
    );
  }

  const application_id = await resolveApprovedApplicationId(user_id);
  if (!application_id) {
    return validationError(
      'Sandbox application must be approved before accepting the agreement.',
      'sandbox_not_approved',
    );
  }

  const row = {
    user_id: user_id.trim(),
    application_id,
    agreement_version,
    accepted_ip: isNonEmptyString(payload?.accepted_ip)
      ? String(payload.accepted_ip).trim().slice(0, 128)
      : null,
    accepted_user_agent: isNonEmptyString(payload?.accepted_user_agent)
      ? String(payload.accepted_user_agent).trim().slice(0, 512)
      : null,
  };

  const { data, error } = await supabase
    .from(SANDBOX_AGREEMENTS_TABLE)
    .insert(row)
    .select(
      'id, user_id, application_id, agreement_version, accepted_at, accepted_ip, accepted_user_agent, created_at',
    )
    .single();

  if (error) {
    if (error.code === '23505') {
      return validationError(
        `Agreement ${agreement_version} has already been accepted.`,
        'agreement_already_accepted',
      );
    }
    return { data: null, error };
  }

  return { data, error: null };
}
