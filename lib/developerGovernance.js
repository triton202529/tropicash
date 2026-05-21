import { supabase } from './supabaseClient';

const REVIEWS_TABLE = 'developer_app_reviews';
const LIFECYCLE_TABLE = 'developer_app_lifecycle_events';
const APPS_TABLE = 'developer_apps';

const REVIEW_TYPES = new Set([
  'sandbox_activation',
  'live_access',
  'environment_upgrade',
  'suspension_review',
  'reactivation',
]);

/** Queue + request rows use this status until an admin decides (matches SQL check constraints). */
export const GOVERNANCE_QUEUE_PENDING_STATUS = 'pending';

const REVIEW_STATUSES = new Set([
  GOVERNANCE_QUEUE_PENDING_STATUS,
  'approved',
  'rejected',
  'needs_changes',
  'cancelled',
]);

const REQUESTED_ENVIRONMENTS = new Set(['sandbox', 'live']);

const LIFECYCLE_EVENT_TYPES = new Set([
  // Includes `status_changed` after Phase 4C SQL extends `developer_app_lifecycle_events` check constraint.
  'review_requested',
  'review_approved',
  'review_rejected',
  'review_needs_changes',
  'review_cancelled',
  'status_transition',
  'status_changed',
  'sandbox_activated',
  'live_pending_set',
  'live_activated',
  'environment_upgraded',
  'suspended',
  'reactivated',
  'archived',
]);

const ACTOR_TYPES = new Set(['user', 'admin', 'system']);

const APP_STATUSES = new Set([
  'draft',
  'pending_review',
  'sandbox_active',
  'live_pending',
  'live_active',
  'suspended',
  'archived',
]);

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function isUuidLike(v) {
  if (!isNonEmptyString(v)) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

function validationError(message) {
  return { data: null, error: { message, code: 'validation_error' } };
}

export async function fetchOwnedAppIdsForUser(userId) {
  const { data, error } = await supabase
    .from(APPS_TABLE)
    .select('id')
    .eq('owner_user_id', userId.trim());
  if (error) return { ids: null, error };
  return { ids: (data || []).map((r) => r.id), error: null };
}

/**
 * @param {string} userId
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchDeveloperAppReviews(userId) {
  if (!isUuidLike(userId)) {
    return validationError('A valid user id is required.');
  }
  const { ids, error: idsError } = await fetchOwnedAppIdsForUser(userId);
  if (idsError) return { data: null, error: idsError };
  if (!ids.length) return { data: [], error: null };
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .select('*')
    .in('app_id', ids)
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * @param {string | null} appId
 * @param {string} reviewType
 * @returns {Promise<object | null>}
 */
export async function fetchPendingReviewForApp(appId, reviewType) {
  if (!isUuidLike(appId) || !REVIEW_TYPES.has(reviewType)) {
    return null;
  }
  const { data } = await supabase
    .from(REVIEWS_TABLE)
    .select('*')
    .eq('app_id', appId.trim())
    .eq('review_type', reviewType)
    .eq('status', GOVERNANCE_QUEUE_PENDING_STATUS)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data || null;
}

/**
 * @param {{
 *   app_id: string;
 *   organization_id: string;
 *   requested_by_user_id: string;
 *   review_type: string;
 *   requested_environment?: string;
 *   review_notes?: string | null;
 * }} payload
 */
export async function createDeveloperAppReview(payload) {
  const app_id = payload?.app_id;
  const organization_id = payload?.organization_id;
  const requested_by_user_id = payload?.requested_by_user_id;
  const review_type = String(payload?.review_type || '').trim();

  if (!isUuidLike(app_id)) {
    return validationError('app_id must be a valid UUID.');
  }
  if (!isUuidLike(organization_id)) {
    return validationError('organization_id must be a valid UUID.');
  }
  if (!isUuidLike(requested_by_user_id)) {
    return validationError('requested_by_user_id must be a valid UUID.');
  }
  if (!REVIEW_TYPES.has(review_type)) {
    return validationError('review_type is not valid.');
  }

  const requested_environment = REQUESTED_ENVIRONMENTS.has(
    String(payload?.requested_environment || '').trim(),
  )
    ? String(payload.requested_environment).trim()
    : 'sandbox';

  const pending = await fetchPendingReviewForApp(app_id, review_type);
  if (pending) {
    return validationError('A pending review of this type already exists for this app.');
  }

  const row = {
    app_id: app_id.trim(),
    organization_id: organization_id.trim(),
    requested_by_user_id: requested_by_user_id.trim(),
    review_type,
    requested_environment,
    status: GOVERNANCE_QUEUE_PENDING_STATUS,
    review_notes: isNonEmptyString(payload?.review_notes) ? String(payload.review_notes).trim() : null,
  };

  const { data, error } = await supabase.from(REVIEWS_TABLE).insert(row).select('*').single();
  if (error) {
    console.log('[governance-debug] createDeveloperAppReview insert failed', {
      review_type,
      app_id: row.app_id,
      status: row.status,
      message: error.message,
    });
  } else {
    console.log('[governance-debug] createDeveloperAppReview insert ok', {
      id: data?.id,
      review_type: data?.review_type,
      status: data?.status,
      app_id: data?.app_id,
    });
  }
  return { data, error };
}

/**
 * @param {string} userId
 * @returns {Promise<{ data: object[] | null; error: object | null }>}
 */
export async function fetchDeveloperLifecycleEvents(userId) {
  if (!isUuidLike(userId)) {
    return validationError('A valid user id is required.');
  }
  const { ids, error: idsError } = await fetchOwnedAppIdsForUser(userId);
  if (idsError) return { data: null, error: idsError };
  if (!ids.length) return { data: [], error: null };
  const { data, error } = await supabase
    .from(LIFECYCLE_TABLE)
    .select('*')
    .in('app_id', ids)
    .order('created_at', { ascending: false });
  return { data, error };
}

/**
 * @param {{
 *   app_id: string;
 *   organization_id: string;
 *   event_type: string;
 *   previous_status?: string | null;
 *   new_status?: string | null;
 *   actor_user_id?: string | null;
 *   actor_type?: string;
 *   notes?: string | null;
 *   metadata?: object;
 * }} payload
 */
export async function createLifecycleEvent(payload) {
  const app_id = payload?.app_id;
  const organization_id = payload?.organization_id;
  const event_type = String(payload?.event_type || '').trim();

  if (!isUuidLike(app_id)) {
    return validationError('app_id must be a valid UUID.');
  }
  if (!isUuidLike(organization_id)) {
    return validationError('organization_id must be a valid UUID.');
  }
  if (!LIFECYCLE_EVENT_TYPES.has(event_type)) {
    return validationError('event_type is not valid.');
  }

  const actor_type = ACTOR_TYPES.has(String(payload?.actor_type || '').trim())
    ? String(payload.actor_type).trim()
    : 'user';

  const row = {
    app_id: app_id.trim(),
    organization_id: organization_id.trim(),
    event_type,
    previous_status: isNonEmptyString(payload?.previous_status)
      ? String(payload.previous_status).trim()
      : null,
    new_status: isNonEmptyString(payload?.new_status) ? String(payload.new_status).trim() : null,
    actor_user_id: isUuidLike(payload?.actor_user_id) ? payload.actor_user_id.trim() : null,
    actor_type,
    notes: isNonEmptyString(payload?.notes) ? String(payload.notes).trim() : null,
    metadata:
      payload?.metadata && typeof payload.metadata === 'object' && !Array.isArray(payload.metadata)
        ? payload.metadata
        : {},
  };

  const { data, error } = await supabase.from(LIFECYCLE_TABLE).insert(row).select('*').single();
  return { data, error };
}

/**
 * Resolve next app status after an approved review.
 * @param {string} reviewType
 * @param {string} currentStatus
 * @returns {{ newStatus: string | null; lifecycleType: string | null }}
 */
function resolveApprovedAppTransition(reviewType, currentStatus) {
  switch (reviewType) {
    case 'sandbox_activation':
      return { newStatus: 'sandbox_active', lifecycleType: 'sandbox_activated' };
    case 'live_access':
      return { newStatus: 'live_pending', lifecycleType: 'live_pending_set' };
    case 'environment_upgrade':
      if (currentStatus === 'sandbox_active') {
        return { newStatus: 'live_pending', lifecycleType: 'environment_upgraded' };
      }
      return { newStatus: null, lifecycleType: 'environment_upgraded' };
    case 'suspension_review':
      return { newStatus: 'suspended', lifecycleType: 'suspended' };
    case 'reactivation':
      if (currentStatus === 'suspended') {
        return { newStatus: 'sandbox_active', lifecycleType: 'reactivated' };
      }
      return { newStatus: 'sandbox_active', lifecycleType: 'reactivated' };
    default:
      return { newStatus: null, lifecycleType: null };
  }
}

/**
 * Map review decision status to lifecycle event_type.
 * @param {string} status
 * @returns {string}
 */
function lifecycleTypeForReviewStatus(status) {
  switch (status) {
    case 'approved':
      return 'review_approved';
    case 'rejected':
      return 'review_rejected';
    case 'needs_changes':
      return 'review_needs_changes';
    case 'cancelled':
      return 'review_cancelled';
    default:
      return 'status_transition';
  }
}

/**
 * Admin: update review status and optionally transition app status on approval.
 * @param {{
 *   review_id: string;
 *   status: string;
 *   reviewer_user_id: string;
 *   decision_notes?: string | null;
 *   review_notes?: string | null;
 * }} payload
 */
export async function updateDeveloperReviewStatus(payload) {
  const review_id = payload?.review_id;
  const status = String(payload?.status || '').trim();
  const reviewer_user_id = payload?.reviewer_user_id;

  if (!isUuidLike(review_id)) {
    return validationError('review_id must be a valid UUID.');
  }
  if (!REVIEW_STATUSES.has(status)) {
    return validationError('status is not valid.');
  }
  if (!isUuidLike(reviewer_user_id)) {
    return validationError('reviewer_user_id must be a valid UUID.');
  }

  const { data: review, error: fetchError } = await supabase
    .from(REVIEWS_TABLE)
    .select('*')
    .eq('id', review_id.trim())
    .maybeSingle();

  if (fetchError) {
    return { data: null, error: fetchError };
  }
  if (!review) {
    return validationError('Review not found.');
  }

  if (review.requested_by_user_id === reviewer_user_id.trim()) {
    return validationError('The reviewer cannot be the same user who requested this review.');
  }

  const reviewed_at = new Date().toISOString();
  const reviewPatch = {
    status,
    reviewer_user_id: reviewer_user_id.trim(),
    reviewed_at,
    decision_notes: isNonEmptyString(payload?.decision_notes)
      ? String(payload.decision_notes).trim()
      : null,
  };
  if (payload?.review_notes !== undefined) {
    reviewPatch.review_notes = isNonEmptyString(payload.review_notes)
      ? String(payload.review_notes).trim()
      : null;
  }

  const { data: updatedReview, error: updateError } = await supabase
    .from(REVIEWS_TABLE)
    .update(reviewPatch)
    .eq('id', review_id.trim())
    .select('*')
    .single();

  if (updateError) {
    return { data: null, error: updateError };
  }

  const decisionLifecycle = lifecycleTypeForReviewStatus(status);
  await createLifecycleEvent({
    app_id: review.app_id,
    organization_id: review.organization_id,
    event_type: decisionLifecycle,
    actor_user_id: reviewer_user_id.trim(),
    actor_type: 'admin',
    notes: reviewPatch.decision_notes,
    metadata: {
      review_id: review.id,
      review_type: review.review_type,
      review_status: status,
    },
  });

  if (status !== 'approved') {
    return { data: { review: updatedReview, app: null }, error: null };
  }

  const { data: app, error: appError } = await supabase
    .from(APPS_TABLE)
    .select('*')
    .eq('id', review.app_id)
    .maybeSingle();

  if (appError || !app) {
    return {
      data: { review: updatedReview, app: null },
      error: appError || validationError('App not found for review.').error,
    };
  }

  const { newStatus, lifecycleType } = resolveApprovedAppTransition(
    review.review_type,
    app.status,
  );

  if (!newStatus || !APP_STATUSES.has(newStatus)) {
    return { data: { review: updatedReview, app }, error: null };
  }

  const previousStatus = app.status;
  const { data: updatedApp, error: appUpdateError } = await supabase
    .from(APPS_TABLE)
    .update({ status: newStatus, updated_at: reviewed_at })
    .eq('id', app.id)
    .select('*')
    .single();

  if (appUpdateError) {
    return { data: { review: updatedReview, app: null }, error: appUpdateError };
  }

  await createLifecycleEvent({
    app_id: app.id,
    organization_id: app.organization_id,
    event_type: lifecycleType || 'status_transition',
    previous_status: previousStatus,
    new_status: newStatus,
    actor_user_id: reviewer_user_id.trim(),
    actor_type: 'admin',
    notes: `Approved ${review.review_type}`,
    metadata: {
      review_id: review.id,
      review_type: review.review_type,
    },
  });

  return { data: { review: updatedReview, app: updatedApp }, error: null };
}

/**
 * Admin: all pending reviews (RLS allows admin select all).
 */
export async function fetchAllPendingReviewsForAdmin() {
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .select('*')
    .eq('status', GOVERNANCE_QUEUE_PENDING_STATUS)
    .order('created_at', { ascending: true });
  console.log('[governance-debug] fetchAllPendingReviewsForAdmin', {
    count: data?.length ?? 0,
    error: error?.message ?? null,
    reviewTypes: (data || []).map((r) => r.review_type),
  });
  return { data, error };
}

/**
 * Admin: recent reviews of any status.
 */
export async function fetchAllReviewsForAdmin() {
  const { data, error } = await supabase
    .from(REVIEWS_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);
  return { data, error };
}

/**
 * Admin: apps with org context for governance overview.
 */
export async function fetchAppsForGovernance() {
  const { data, error } = await supabase
    .from(APPS_TABLE)
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(500);
  return { data, error };
}

/**
 * Admin: global lifecycle feed.
 */
export async function fetchAllLifecycleEventsForAdmin() {
  const { data, error } = await supabase
    .from(LIFECYCLE_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  return { data, error };
}

export {
  REVIEW_TYPES,
  REVIEW_STATUSES,
  LIFECYCLE_EVENT_TYPES,
};
