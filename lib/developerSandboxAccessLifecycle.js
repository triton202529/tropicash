/**
 * Tropicash — Phase 14E developer sandbox access activation & lifecycle management.
 *
 * Approval + agreement does not auto-activate sandbox access. Admin activation required.
 * No production access, automatic credentials, or money movement.
 */

import { supabase } from './supabaseClient';
import { SANDBOX_APPLICATIONS_TABLE } from './developerSandboxApplications';
import { hasAcceptedSandboxAgreement } from './developerSandboxAgreements';

export const SANDBOX_ACCESS_TABLE = 'developer_sandbox_access';
export const SANDBOX_ACCESS_HISTORY_TABLE = 'developer_sandbox_access_status_history';

export const SANDBOX_ACCESS_LIFECYCLE_PHASE = '14E';

export const SANDBOX_ACCESS_STATUSES = [
  'pending_activation',
  'active',
  'suspended',
  'expired',
  'revoked',
];

const STATUS_SET = new Set(SANDBOX_ACCESS_STATUSES);

const VISIBLE_COLUMNS =
  'id, user_id, application_id, status, activated_at, suspended_at, expired_at, revoked_at, expires_at, action_by, action_reason, status_changed_at, created_at';

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

function isPast(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now();
}

/**
 * @param {string} userId
 * @returns {Promise<object | null>}
 */
async function fetchAccessRecordByUserId(userId) {
  const { data, error } = await supabase
    .from(SANDBOX_ACCESS_TABLE)
    .select(VISIBLE_COLUMNS)
    .eq('user_id', userId.trim())
    .maybeSingle();

  if (error) return null;
  return data || null;
}

/**
 * @param {string} userId
 * @returns {Promise<object | null>}
 */
async function fetchApprovedApplication(userId) {
  const { data, error } = await supabase
    .from(SANDBOX_APPLICATIONS_TABLE)
    .select('id, status, organization_name, developer_name, email, reviewed_at')
    .eq('user_id', userId.trim())
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false })
    .limit(1);

  if (error || !Array.isArray(data) || !data.length) return null;
  return data[0];
}

/**
 * Append immutable status history row.
 *
 * @param {object} payload
 */
async function appendStatusHistory(payload) {
  const { error } = await supabase.from(SANDBOX_ACCESS_HISTORY_TABLE).insert({
    access_id: payload.access_id,
    user_id: payload.user_id,
    application_id: payload.application_id || null,
    from_status: payload.from_status || null,
    to_status: payload.to_status,
    action_by: payload.action_by,
    action_reason: payload.action_reason,
  });
  return { error };
}

/**
 * Verify activation prerequisites: approved application + current agreement.
 *
 * @param {string} userId
 */
async function verifyActivationPrerequisites(userId) {
  const application = await fetchApprovedApplication(userId);
  if (!application) {
    return validationError(
      'Developer must have an approved sandbox application before activation.',
      'sandbox_not_approved',
    );
  }
  const agreed = await hasAcceptedSandboxAgreement(userId);
  if (!agreed) {
    return validationError(
      'Developer must accept the current sandbox agreement before activation.',
      'sandbox_agreement_required',
    );
  }
  return { data: application, error: null };
}

/**
 * Create a sandbox access record in pending_activation state.
 *
 * @param {{
 *   user_id: string;
 *   application_id?: string;
 *   action_by: string;
 *   action_reason: string;
 * }} payload
 */
export async function createSandboxAccessRecord(payload) {
  const user_id = payload?.user_id;
  const action_by = payload?.action_by;
  const action_reason = String(payload?.action_reason || '').trim();

  if (!isUuidLike(user_id)) {
    return validationError('user_id must be a valid UUID.');
  }
  if (!isUuidLike(action_by)) {
    return validationError('action_by must be a valid UUID.');
  }
  if (!isNonEmptyString(action_reason)) {
    return validationError('action_reason is required.');
  }

  const existing = await fetchAccessRecordByUserId(user_id);
  if (existing) {
    return validationError('Sandbox access record already exists for this developer.', 'record_exists');
  }

  let application_id = payload?.application_id;
  if (application_id && !isUuidLike(application_id)) {
    return validationError('application_id must be a valid UUID.');
  }
  if (!application_id) {
    const app = await fetchApprovedApplication(user_id);
    application_id = app?.id || null;
  }

  const now = new Date().toISOString();
  const row = {
    user_id: user_id.trim(),
    application_id,
    status: 'pending_activation',
    action_by: action_by.trim(),
    action_reason,
    status_changed_at: now,
  };

  const { data, error } = await supabase
    .from(SANDBOX_ACCESS_TABLE)
    .insert(row)
    .select(VISIBLE_COLUMNS)
    .single();

  if (error) {
    return { data: null, error };
  }

  await appendStatusHistory({
    access_id: data.id,
    user_id: data.user_id,
    application_id: data.application_id,
    from_status: null,
    to_status: 'pending_activation',
    action_by: action_by.trim(),
    action_reason,
  });

  return { data, error: null };
}

/**
 * Transition access record to a new status with audit trail.
 *
 * @param {object} payload
 * @param {string} payload.access_id
 * @param {string} payload.to_status
 * @param {string} payload.action_by
 * @param {string} payload.action_reason
 * @param {object} [payload.patch]
 */
async function transitionAccessStatus(payload) {
  const access_id = payload?.access_id;
  const to_status = String(payload?.to_status || '').trim();
  const action_by = payload?.action_by;
  const action_reason = String(payload?.action_reason || '').trim();
  const patch = payload?.patch || {};

  if (!isUuidLike(access_id)) {
    return validationError('access_id must be a valid UUID.');
  }
  if (!STATUS_SET.has(to_status)) {
    return validationError('Invalid sandbox access status.');
  }
  if (!isUuidLike(action_by)) {
    return validationError('action_by must be a valid UUID.');
  }
  if (!isNonEmptyString(action_reason)) {
    return validationError('action_reason is required.');
  }

  const { data: current, error: fetchError } = await supabase
    .from(SANDBOX_ACCESS_TABLE)
    .select(VISIBLE_COLUMNS)
    .eq('id', access_id.trim())
    .single();

  if (fetchError || !current) {
    return validationError('Sandbox access record not found.', 'not_found');
  }

  if (current.status === 'revoked' && to_status !== 'revoked') {
    return validationError('Revoked sandbox access cannot be changed.', 'access_revoked');
  }

  const now = new Date().toISOString();
  const update = {
    status: to_status,
    action_by: action_by.trim(),
    action_reason,
    status_changed_at: now,
    ...patch,
  };

  const { data, error } = await supabase
    .from(SANDBOX_ACCESS_TABLE)
    .update(update)
    .eq('id', current.id)
    .select(VISIBLE_COLUMNS)
    .single();

  if (error) {
    return { data: null, error };
  }

  await appendStatusHistory({
    access_id: data.id,
    user_id: data.user_id,
    application_id: data.application_id,
    from_status: current.status,
    to_status,
    action_by: action_by.trim(),
    action_reason,
  });

  return { data, error: null };
}

/**
 * Activate sandbox access (admin only). Requires approved application + agreement.
 *
 * @param {{
 *   access_id?: string;
 *   user_id?: string;
 *   action_by: string;
 *   action_reason: string;
 *   expires_at?: string | null;
 * }} payload
 */
export async function activateSandboxAccess(payload) {
  const action_by = payload?.action_by;
  const action_reason = String(payload?.action_reason || '').trim();
  const expires_at = payload?.expires_at;

  let record = null;
  if (payload?.access_id && isUuidLike(payload.access_id)) {
    const { data } = await supabase
      .from(SANDBOX_ACCESS_TABLE)
      .select(VISIBLE_COLUMNS)
      .eq('id', payload.access_id.trim())
      .maybeSingle();
    record = data;
  } else if (payload?.user_id && isUuidLike(payload.user_id)) {
    record = await fetchAccessRecordByUserId(payload.user_id);
  }

  if (!record) {
    return validationError('Sandbox access record not found.', 'not_found');
  }

  const prereq = await verifyActivationPrerequisites(record.user_id);
  if (prereq.error) {
    return prereq;
  }

  const now = new Date().toISOString();
  const patch = {
    activated_at: now,
    suspended_at: null,
    expired_at: null,
    revoked_at: null,
    expires_at: isNonEmptyString(expires_at) ? String(expires_at).trim() : null,
  };

  return transitionAccessStatus({
    access_id: record.id,
    to_status: 'active',
    action_by,
    action_reason,
    patch,
  });
}

/**
 * Suspend active sandbox access.
 *
 * @param {{ access_id: string; action_by: string; action_reason: string }} payload
 */
export async function suspendSandboxAccess(payload) {
  const access_id = payload?.access_id;
  const { data: current } = await supabase
    .from(SANDBOX_ACCESS_TABLE)
    .select('id, status')
    .eq('id', access_id?.trim())
    .maybeSingle();

  if (!current) {
    return validationError('Sandbox access record not found.', 'not_found');
  }
  if (current.status !== 'active') {
    return validationError('Only active sandbox access can be suspended.', 'invalid_transition');
  }

  return transitionAccessStatus({
    access_id,
    to_status: 'suspended',
    action_by: payload.action_by,
    action_reason: payload.action_reason,
    patch: { suspended_at: new Date().toISOString() },
  });
}

/**
 * Mark sandbox access as expired.
 *
 * @param {{ access_id: string; action_by: string; action_reason: string }} payload
 */
export async function expireSandboxAccess(payload) {
  const access_id = payload?.access_id;
  const { data: current } = await supabase
    .from(SANDBOX_ACCESS_TABLE)
    .select('id, status')
    .eq('id', access_id?.trim())
    .maybeSingle();

  if (!current) {
    return validationError('Sandbox access record not found.', 'not_found');
  }
  if (current.status === 'revoked') {
    return validationError('Revoked sandbox access cannot be expired.', 'invalid_transition');
  }

  return transitionAccessStatus({
    access_id,
    to_status: 'expired',
    action_by: payload.action_by,
    action_reason: payload.action_reason,
    patch: { expired_at: new Date().toISOString() },
  });
}

/**
 * Permanently revoke sandbox access. Audit history preserved.
 *
 * @param {{ access_id: string; action_by: string; action_reason: string }} payload
 */
export async function revokeSandboxAccess(payload) {
  const access_id = payload?.access_id;
  const { data: current } = await supabase
    .from(SANDBOX_ACCESS_TABLE)
    .select('id, status')
    .eq('id', access_id?.trim())
    .maybeSingle();

  if (!current) {
    return validationError('Sandbox access record not found.', 'not_found');
  }
  if (current.status === 'revoked') {
    return validationError('Sandbox access is already revoked.', 'already_revoked');
  }

  return transitionAccessStatus({
    access_id,
    to_status: 'revoked',
    action_by: payload.action_by,
    action_reason: payload.action_reason,
    patch: { revoked_at: new Date().toISOString() },
  });
}

/**
 * Resolve effective lifecycle status including expiration checks.
 *
 * @param {object | null} record
 * @returns {string}
 */
function resolveEffectiveStatus(record) {
  if (!record) return 'pending_activation';
  const status = String(record.status || 'pending_activation');
  if (status === 'active' && isPast(record.expires_at)) {
    return 'expired';
  }
  return status;
}

/**
 * Full sandbox access lifecycle status for a developer.
 *
 * @param {string} userId
 */
export async function getSandboxAccessStatus(userId) {
  if (!isUuidLike(userId)) {
    return {
      hasRecord: false,
      status: 'pending_activation',
      effectiveStatus: 'pending_activation',
      active: false,
      record: null,
      activatedAt: null,
      expiresAt: null,
      suspendedAt: null,
      expiredAt: null,
      revokedAt: null,
      statusChangedAt: null,
      actionReason: null,
    };
  }

  const record = await fetchAccessRecordByUserId(userId);
  const effectiveStatus = resolveEffectiveStatus(record);
  const active = effectiveStatus === 'active';

  return {
    hasRecord: Boolean(record),
    status: record?.status || 'pending_activation',
    effectiveStatus,
    active,
    record,
    activatedAt: record?.activated_at || null,
    expiresAt: record?.expires_at || null,
    suspendedAt: record?.suspended_at || null,
    expiredAt: record?.expired_at || null,
    revokedAt: record?.revoked_at || null,
    statusChangedAt: record?.status_changed_at || null,
    actionReason: record?.action_reason || null,
  };
}

/**
 * Whether sandbox access is currently active for resource creation.
 *
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function isSandboxAccessActive(userId) {
  const status = await getSandboxAccessStatus(userId);
  return status.active;
}

/**
 * Admin: fetch all sandbox access records.
 */
export async function fetchAllSandboxAccessRecords() {
  const { data, error } = await supabase
    .from(SANDBOX_ACCESS_TABLE)
    .select(VISIBLE_COLUMNS)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Admin: fetch status history for an access record.
 *
 * @param {string} accessId
 */
export async function fetchSandboxAccessHistory(accessId) {
  if (!isUuidLike(accessId)) {
    return validationError('access_id must be a valid UUID.');
  }

  const { data, error } = await supabase
    .from(SANDBOX_ACCESS_HISTORY_TABLE)
    .select('id, access_id, user_id, from_status, to_status, action_by, action_reason, created_at')
    .eq('access_id', accessId.trim())
    .order('created_at', { ascending: false });

  return { data, error };
}
