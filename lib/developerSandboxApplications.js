/**
 * Tropicash — Phase 14B developer sandbox application & approval workflow.
 *
 * Controlled sandbox onboarding governance only — no automatic credentials,
 * OAuth clients, production access, or money movement.
 */

import { supabase } from './supabaseClient';

export const SANDBOX_APPLICATIONS_TABLE = 'developer_sandbox_applications';

export const SANDBOX_APPLICATION_PHASE = '14B';

export const SANDBOX_APPLICATION_STATUSES = [
  'pending',
  'under_review',
  'approved',
  'rejected',
];

/** Capabilities applicants may request. */
export const ALLOWED_SANDBOX_CAPABILITIES = [
  {
    id: 'platform_status',
    label: 'Platform Status API',
    description: 'GET /api/developer/platform-status',
  },
  {
    id: 'supported_currencies',
    label: 'Supported Currencies API',
    description: 'GET /api/developer/supported-currencies',
  },
  {
    id: 'oauth_profile',
    label: 'OAuth Profile API',
    description: 'GET /api/oauth/profile (profile.read)',
  },
  {
    id: 'oauth_wallet_sandbox',
    label: 'OAuth Wallet API (Sandbox)',
    description: 'GET /api/oauth/wallet (wallet.read, sandbox only)',
  },
];

/** Capabilities that are not available — rejected if submitted. */
export const DISALLOWED_SANDBOX_CAPABILITIES = [
  'send_money',
  'withdrawals',
  'payments_create',
  'production_access',
];

const ALLOWED_CAPABILITY_IDS = new Set(
  ALLOWED_SANDBOX_CAPABILITIES.map((c) => c.id),
);

const STATUS_SET = new Set(SANDBOX_APPLICATION_STATUSES);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isEmailLike(v) {
  if (!isNonEmptyString(v)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isUuidLike(v) {
  if (!isNonEmptyString(v)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

function validationError(message) {
  return { data: null, error: { message, code: 'validation_error' } };
}

/**
 * Sanitize and validate requested capability ids.
 *
 * @param {string[]} capabilities
 * @returns {{ ok: boolean; capabilities: string[]; error?: string }}
 */
export function sanitizeRequestedCapabilities(capabilities) {
  const list = Array.isArray(capabilities) ? capabilities : [];
  const unique = [...new Set(list.map((c) => String(c || '').trim()).filter(Boolean))];

  for (const cap of unique) {
    if (DISALLOWED_SANDBOX_CAPABILITIES.includes(cap)) {
      return { ok: false, capabilities: [], error: `Capability not available: ${cap}` };
    }
    if (!ALLOWED_CAPABILITY_IDS.has(cap)) {
      return { ok: false, capabilities: [], error: `Unknown capability: ${cap}` };
    }
  }

  if (unique.length === 0) {
    return { ok: false, capabilities: [], error: 'Select at least one sandbox capability.' };
  }

  return { ok: true, capabilities: unique };
}

/**
 * Human-readable label for a capability id.
 *
 * @param {string} capabilityId
 * @returns {string}
 */
export function getCapabilityLabel(capabilityId) {
  const match = ALLOWED_SANDBOX_CAPABILITIES.find((c) => c.id === capabilityId);
  return match?.label || capabilityId;
}

/**
 * Submit a sandbox access application (authenticated user, own user_id only).
 *
 * @param {object} payload
 * @param {string} payload.user_id
 * @param {string} payload.organization_name
 * @param {string} payload.developer_name
 * @param {string} payload.email
 * @param {string} [payload.website]
 * @param {string} payload.country
 * @param {string} payload.use_case
 * @param {string[]} payload.requested_capabilities
 */
export async function submitDeveloperSandboxApplication(payload) {
  if (!isUuidLike(payload?.user_id)) {
    return validationError('user_id is required.');
  }
  if (!isNonEmptyString(payload?.organization_name)) {
    return validationError('organization_name is required.');
  }
  if (!isNonEmptyString(payload?.developer_name)) {
    return validationError('developer_name is required.');
  }
  if (!isEmailLike(payload?.email)) {
    return validationError('A valid email is required.');
  }
  if (!isNonEmptyString(payload?.country)) {
    return validationError('country is required.');
  }
  if (!isNonEmptyString(payload?.use_case)) {
    return validationError('use_case is required.');
  }

  const capResult = sanitizeRequestedCapabilities(payload?.requested_capabilities);
  if (!capResult.ok) {
    return validationError(capResult.error);
  }

  const row = {
    user_id: payload.user_id.trim(),
    organization_name: payload.organization_name.trim(),
    developer_name: payload.developer_name.trim(),
    email: payload.email.trim(),
    website: isNonEmptyString(payload?.website) ? String(payload.website).trim() : null,
    country: payload.country.trim(),
    use_case: payload.use_case.trim(),
    requested_capabilities: capResult.capabilities,
    status: 'pending',
  };

  const { data, error } = await supabase
    .from(SANDBOX_APPLICATIONS_TABLE)
    .insert(row)
    .select('id, status, created_at')
    .single();

  return { data, error };
}

/**
 * Fetch applications for the signed-in user (own rows only via RLS).
 *
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchOwnSandboxApplications() {
  const { data, error } = await supabase
    .from(SANDBOX_APPLICATIONS_TABLE)
    .select(
      'id, organization_name, developer_name, email, website, country, use_case, requested_capabilities, status, created_at, reviewed_at',
    )
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Admin: fetch all sandbox applications.
 *
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchAllSandboxApplications() {
  const { data, error } = await supabase
    .from(SANDBOX_APPLICATIONS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Admin: update application status and review metadata only.
 * Does not create credentials, OAuth clients, or grant wallet access.
 *
 * @param {{
 *   id: string;
 *   status: string;
 *   reviewed_by: string;
 *   review_notes?: string | null;
 * }} payload
 */
export async function updateSandboxApplicationStatus(payload) {
  const id = payload?.id;
  const status = String(payload?.status || '').trim();
  const reviewed_by = payload?.reviewed_by;

  if (!isUuidLike(id)) {
    return validationError('id must be a valid UUID.');
  }
  if (!STATUS_SET.has(status)) {
    return validationError('status must be pending, under_review, approved, or rejected.');
  }
  if (!isUuidLike(reviewed_by)) {
    return validationError('reviewed_by must be a valid UUID.');
  }

  const patch = {
    status,
    reviewed_by: reviewed_by.trim(),
    review_notes: isNonEmptyString(payload?.review_notes)
      ? String(payload.review_notes).trim()
      : null,
    reviewed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(SANDBOX_APPLICATIONS_TABLE)
    .update(patch)
    .eq('id', id.trim())
    .select('*')
    .single();

  return { data, error };
}
