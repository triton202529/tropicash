import { supabase } from './supabaseClient';
import { DEVELOPER_ACCESS_REQUESTS_TABLE } from './developerCenterConfig';

const TABLE = DEVELOPER_ACCESS_REQUESTS_TABLE;

const STATUSES = new Set(['pending', 'reviewed', 'approved', 'rejected', 'archived']);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isUuidLike(v) {
  if (!isNonEmptyString(v)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

function isEmailLike(v) {
  if (!isNonEmptyString(v)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function validationError(message) {
  return { data: null, error: { message, code: 'validation_error' } };
}

/**
 * Public form submit (anon RLS insert).
 * @param {{
 *   full_name: string;
 *   email: string;
 *   company_name?: string | null;
 *   use_case?: string | null;
 *   message?: string | null;
 * }} payload
 */
export async function submitDeveloperAccessRequest(payload) {
  const full_name = payload?.full_name;
  const email = payload?.email;

  if (!isNonEmptyString(full_name)) {
    return validationError('full_name is required.');
  }
  if (!isEmailLike(email)) {
    return validationError('A valid email is required.');
  }

  const row = {
    full_name: full_name.trim(),
    email: email.trim(),
    company_name: isNonEmptyString(payload?.company_name) ? String(payload.company_name).trim() : null,
    use_case: isNonEmptyString(payload?.use_case) ? String(payload.use_case).trim() : null,
    message: isNonEmptyString(payload?.message) ? String(payload.message).trim() : null,
  };

  const { error } = await supabase.from(TABLE).insert(row);
  return { data: error ? null : { ok: true }, error };
}

/**
 * Admin queue (RLS requires tc_is_admin).
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchDeveloperAccessRequests() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * Admin status transition — updates review metadata only (no org/app side effects).
 * @param {{
 *   id: string;
 *   status: string;
 *   reviewed_by_user_id: string;
 *   review_notes?: string | null;
 *   reviewed_at?: string | null;
 * }} payload
 */
export async function updateDeveloperAccessRequestStatus(payload) {
  const id = payload?.id;
  const status = payload?.status;
  const reviewed_by_user_id = payload?.reviewed_by_user_id;

  if (!isUuidLike(id)) {
    return validationError('id must be a valid UUID.');
  }
  if (!STATUSES.has(String(status || '').trim())) {
    return validationError('status must be pending, reviewed, approved, rejected, or archived.');
  }
  if (!isUuidLike(reviewed_by_user_id)) {
    return validationError('reviewed_by_user_id must be a valid UUID.');
  }

  const patch = {
    status: String(status).trim(),
    reviewed_by_user_id: reviewed_by_user_id.trim(),
    review_notes: isNonEmptyString(payload?.review_notes) ? String(payload.review_notes).trim() : null,
    reviewed_at: isNonEmptyString(payload?.reviewed_at)
      ? String(payload.reviewed_at).trim()
      : new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id.trim())
    .select('*')
    .single();
  return { data, error };
}
