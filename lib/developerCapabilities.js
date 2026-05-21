import { supabase } from './supabaseClient';

import {
  createLifecycleEvent,
  fetchOwnedAppIdsForUser,
  GOVERNANCE_QUEUE_PENDING_STATUS,
} from './developerGovernance';



const CAPABILITIES_TABLE = 'developer_app_capabilities';

const REQUESTS_TABLE = 'developer_app_capability_requests';

const POLICIES_TABLE = 'developer_app_access_policies';

const APPS_TABLE = 'developer_apps';



const ENVIRONMENTS = new Set(['sandbox', 'live']);

const CAPABILITY_STATUSES = new Set([

  'assigned',

  'pending_review',

  'restricted',

  'revoked',

  'suspended',

]);

const REQUEST_STATUSES = new Set([

  GOVERNANCE_QUEUE_PENDING_STATUS,

  'approved',

  'rejected',

  'needs_changes',

  'cancelled',

]);

const POLICY_STATUSES = new Set(['planned', 'active', 'restricted', 'disabled']);

const RISK_LEVELS = new Set(['low', 'medium', 'high', 'critical']);



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



/**

 * @param {string} appId

 * @param {string} capabilityKey

 * @param {string} environment

 */

async function fetchPendingCapabilityRequest(appId, capabilityKey, environment) {

  const { data } = await supabase

    .from(REQUESTS_TABLE)

    .select('*')

    .eq('app_id', appId.trim())

    .eq('capability_key', capabilityKey.trim())

    .eq('requested_environment', environment)

    .eq('status', GOVERNANCE_QUEUE_PENDING_STATUS)

    .order('created_at', { ascending: false })

    .limit(1)

    .maybeSingle();

  return data || null;

}



/**

 * @param {string} userId

 * @returns {Promise<{ data: object[] | null; error: object | null }>}

 */

export async function fetchAppCapabilities(userId) {

  if (!isUuidLike(userId)) {

    return validationError('A valid user id is required.');

  }

  const { ids, error: idsError } = await fetchOwnedAppIdsForUser(userId);

  if (idsError) return { data: null, error: idsError };

  if (!ids.length) return { data: [], error: null };

  const { data, error } = await supabase

    .from(CAPABILITIES_TABLE)

    .select('*')

    .in('app_id', ids)

    .order('updated_at', { ascending: false });

  return { data, error };

}



/**

 * @param {string} userId

 * @returns {Promise<{ data: object[] | null; error: object | null }>}

 */

export async function fetchAppCapabilityRequests(userId) {

  if (!isUuidLike(userId)) {

    return validationError('A valid user id is required.');

  }

  const { ids, error: idsError } = await fetchOwnedAppIdsForUser(userId);

  if (idsError) return { data: null, error: idsError };

  if (!ids.length) return { data: [], error: null };

  const { data, error } = await supabase

    .from(REQUESTS_TABLE)

    .select('*')

    .in('app_id', ids)

    .order('created_at', { ascending: false });

  return { data, error };

}



/**

 * @param {string} userId

 * @returns {Promise<{ data: object[] | null; error: object | null }>}

 */

export async function fetchAppAccessPolicies(userId) {

  if (!isUuidLike(userId)) {

    return validationError('A valid user id is required.');

  }

  const { ids, error: idsError } = await fetchOwnedAppIdsForUser(userId);

  if (idsError) return { data: null, error: idsError };

  if (!ids.length) return { data: [], error: null };

  const { data, error } = await supabase

    .from(POLICIES_TABLE)

    .select('*')

    .in('app_id', ids)

    .order('updated_at', { ascending: false });

  return { data, error };

}



/**

 * @param {{

 *   app_id: string;

 *   organization_id: string;

 *   requested_by_user_id: string;

 *   capability_key: string;

 *   requested_environment?: string;

 *   request_reason?: string | null;

 * }} payload

 */

export async function createCapabilityRequest(payload) {

  const app_id = payload?.app_id;

  const organization_id = payload?.organization_id;

  const requested_by_user_id = payload?.requested_by_user_id;

  const capability_key = String(payload?.capability_key || '').trim();



  if (!isUuidLike(app_id)) {

    return validationError('app_id must be a valid UUID.');

  }

  if (!isUuidLike(organization_id)) {

    return validationError('organization_id must be a valid UUID.');

  }

  if (!isUuidLike(requested_by_user_id)) {

    return validationError('requested_by_user_id must be a valid UUID.');

  }

  if (!isNonEmptyString(capability_key)) {

    return validationError('capability_key is required.');

  }



  const requested_environment = ENVIRONMENTS.has(

    String(payload?.requested_environment || '').trim(),

  )

    ? String(payload.requested_environment).trim()

    : 'sandbox';



  if (requested_environment !== 'sandbox') {

    return validationError('Only sandbox capability requests are accepted in this phase.');

  }



  const pending = await fetchPendingCapabilityRequest(

    app_id,

    capability_key,

    requested_environment,

  );

  if (pending) {

    return validationError(

      'A pending request for this capability and environment already exists.',

    );

  }



  const row = {

    app_id: app_id.trim(),

    organization_id: organization_id.trim(),

    requested_by_user_id: requested_by_user_id.trim(),

    capability_key,

    requested_environment,

    status: GOVERNANCE_QUEUE_PENDING_STATUS,

    request_reason: isNonEmptyString(payload?.request_reason)

      ? String(payload.request_reason).trim()

      : null,

  };



  const { data, error } = await supabase.from(REQUESTS_TABLE).insert(row).select('*').single();

  if (error) {

    console.log('[governance-debug] createCapabilityRequest insert failed', {

      capability_key,

      app_id: row.app_id,

      status: row.status,

      message: error.message,

    });

  } else {

    console.log('[governance-debug] createCapabilityRequest insert ok', {

      id: data?.id,

      capability_key: data?.capability_key,

      status: data?.status,

      app_id: data?.app_id,

    });

  }

  return { data, error };

}



/**

 * @param {{

 *   app_id: string;

 *   organization_id: string;

 *   capability_key: string;

 *   environment?: string;

 *   assigned_by_user_id: string;

 *   status?: string;

 *   notes?: string | null;

 * }} payload

 */

export async function adminAssignCapability(payload) {

  const app_id = payload?.app_id;

  const organization_id = payload?.organization_id;

  const capability_key = String(payload?.capability_key || '').trim();

  const assigned_by_user_id = payload?.assigned_by_user_id;



  if (!isUuidLike(app_id)) {

    return validationError('app_id must be a valid UUID.');

  }

  if (!isUuidLike(organization_id)) {

    return validationError('organization_id must be a valid UUID.');

  }

  if (!isNonEmptyString(capability_key)) {

    return validationError('capability_key is required.');

  }

  if (!isUuidLike(assigned_by_user_id)) {

    return validationError('assigned_by_user_id must be a valid UUID.');

  }



  const environment = ENVIRONMENTS.has(String(payload?.environment || '').trim())

    ? String(payload.environment).trim()

    : 'sandbox';



  const status = CAPABILITY_STATUSES.has(String(payload?.status || '').trim())

    ? String(payload.status).trim()

    : 'assigned';



  const now = new Date().toISOString();

  const row = {

    app_id: app_id.trim(),

    organization_id: organization_id.trim(),

    capability_key,

    environment,

    status,

    assigned_by_user_id: assigned_by_user_id.trim(),

    notes: isNonEmptyString(payload?.notes) ? String(payload.notes).trim() : null,

    updated_at: now,

  };



  const { data, error } = await supabase

    .from(CAPABILITIES_TABLE)

    .upsert(row, { onConflict: 'app_id,capability_key,environment' })

    .select('*')

    .single();



  return { data, error };

}



/**

 * @param {{

 *   capability_id: string;

 *   status: string;

 *   notes?: string | null;

 * }} payload

 */

export async function adminUpdateCapabilityStatus(payload) {

  const capability_id = payload?.capability_id;

  const status = String(payload?.status || '').trim();



  if (!isUuidLike(capability_id)) {

    return validationError('capability_id must be a valid UUID.');

  }

  if (!CAPABILITY_STATUSES.has(status)) {

    return validationError('status is not valid.');

  }



  const patch = {

    status,

    updated_at: new Date().toISOString(),

  };

  if (payload?.notes !== undefined) {

    patch.notes = isNonEmptyString(payload.notes) ? String(payload.notes).trim() : null;

  }



  const { data, error } = await supabase

    .from(CAPABILITIES_TABLE)

    .update(patch)

    .eq('id', capability_id.trim())

    .select('*')

    .single();



  return { data, error };

}



/**

 * @param {{

 *   app_id: string;

 *   organization_id: string;

 *   environment?: string;

 *   policy_key: string;

 *   policy_label: string;

 *   policy_value?: object;

 *   status?: string;

 *   risk_level?: string;

 *   notes?: string | null;

 * }} payload

 */

export async function adminCreateAccessPolicy(payload) {

  const app_id = payload?.app_id;

  const organization_id = payload?.organization_id;

  const policy_key = String(payload?.policy_key || '').trim();

  const policy_label = String(payload?.policy_label || '').trim();



  if (!isUuidLike(app_id)) {

    return validationError('app_id must be a valid UUID.');

  }

  if (!isUuidLike(organization_id)) {

    return validationError('organization_id must be a valid UUID.');

  }

  if (!isNonEmptyString(policy_key)) {

    return validationError('policy_key is required.');

  }

  if (!isNonEmptyString(policy_label)) {

    return validationError('policy_label is required.');

  }



  const environment = ENVIRONMENTS.has(String(payload?.environment || '').trim())

    ? String(payload.environment).trim()

    : 'sandbox';



  const status = POLICY_STATUSES.has(String(payload?.status || '').trim())

    ? String(payload.status).trim()

    : 'planned';



  const risk_level = RISK_LEVELS.has(String(payload?.risk_level || '').trim())

    ? String(payload.risk_level).trim()

    : 'medium';



  const row = {

    app_id: app_id.trim(),

    organization_id: organization_id.trim(),

    environment,

    policy_key,

    policy_label,

    policy_value:

      payload?.policy_value &&

      typeof payload.policy_value === 'object' &&

      !Array.isArray(payload.policy_value)

        ? payload.policy_value

        : {},

    status,

    risk_level,

    notes: isNonEmptyString(payload?.notes) ? String(payload.notes).trim() : null,

    updated_at: new Date().toISOString(),

  };



  const { data, error } = await supabase

    .from(POLICIES_TABLE)

    .upsert(row, { onConflict: 'app_id,environment,policy_key' })

    .select('*')

    .single();



  return { data, error };

}



/**

 * @param {{

 *   policy_id: string;

 *   status: string;

 *   notes?: string | null;

 *   policy_value?: object;

 * }} payload

 */

export async function adminUpdateAccessPolicyStatus(payload) {

  const policy_id = payload?.policy_id;

  const status = String(payload?.status || '').trim();



  if (!isUuidLike(policy_id)) {

    return validationError('policy_id must be a valid UUID.');

  }

  if (!POLICY_STATUSES.has(status)) {

    return validationError('status is not valid.');

  }



  const patch = {

    status,

    updated_at: new Date().toISOString(),

  };

  if (payload?.notes !== undefined) {

    patch.notes = isNonEmptyString(payload.notes) ? String(payload.notes).trim() : null;

  }

  if (

    payload?.policy_value &&

    typeof payload.policy_value === 'object' &&

    !Array.isArray(payload.policy_value)

  ) {

    patch.policy_value = payload.policy_value;

  }



  const { data, error } = await supabase

    .from(POLICIES_TABLE)

    .update(patch)

    .eq('id', policy_id.trim())

    .select('*')

    .single();



  return { data, error };

}



export async function fetchPendingCapabilityRequestsForAdmin() {

  const { data, error } = await supabase

    .from(REQUESTS_TABLE)

    .select('*')

    .eq('status', GOVERNANCE_QUEUE_PENDING_STATUS)

    .order('created_at', { ascending: true });

  console.log('[governance-debug] fetchPendingCapabilityRequestsForAdmin', {

    count: data?.length ?? 0,

    error: error?.message ?? null,

    capabilityKeys: (data || []).map((r) => r.capability_key),

  });

  return { data, error };

}



/**

 * @param {string} requestId

 * @param {string} reviewerUserId

 * @param {string} status

 * @param {string | null} decisionNotes

 */

async function resolveCapabilityRequest(requestId, reviewerUserId, status, decisionNotes) {

  if (!isUuidLike(requestId)) {

    return validationError('request_id must be a valid UUID.');

  }

  if (!isUuidLike(reviewerUserId)) {

    return validationError('reviewer_user_id must be a valid UUID.');

  }

  if (!REQUEST_STATUSES.has(status)) {

    return validationError('status is not valid.');

  }



  const { data: request, error: fetchError } = await supabase

    .from(REQUESTS_TABLE)

    .select('*')

    .eq('id', requestId.trim())

    .maybeSingle();



  if (fetchError) {

    return { data: null, error: fetchError };

  }

  if (!request) {

    return validationError('Capability request not found.');

  }

  if (request.requested_by_user_id === reviewerUserId.trim()) {

    return validationError('The reviewer cannot be the same user who submitted this request.');

  }



  const reviewed_at = new Date().toISOString();

  const { data: updatedRequest, error: updateError } = await supabase

    .from(REQUESTS_TABLE)

    .update({

      status,

      reviewer_user_id: reviewerUserId.trim(),

      decision_notes: isNonEmptyString(decisionNotes) ? String(decisionNotes).trim() : null,

      reviewed_at,

    })

    .eq('id', requestId.trim())

    .select('*')

    .single();



  if (updateError) {

    return { data: null, error: updateError };

  }



  if (status !== 'approved') {

    return { data: { request: updatedRequest, capability: null }, error: null };

  }



  const assignRes = await adminAssignCapability({

    app_id: request.app_id,

    organization_id: request.organization_id,

    capability_key: request.capability_key,

    environment: request.requested_environment,

    assigned_by_user_id: reviewerUserId,

    status: 'assigned',

    notes: isNonEmptyString(decisionNotes) ? String(decisionNotes).trim() : null,

  });



  if (assignRes.error) {

    return { data: { request: updatedRequest, capability: null }, error: assignRes.error };

  }



  const { data: app } = await supabase

    .from(APPS_TABLE)

    .select('status')

    .eq('id', request.app_id)

    .maybeSingle();



  await createLifecycleEvent({

    app_id: request.app_id,

    organization_id: request.organization_id,

    event_type: 'status_changed',

    previous_status: app?.status ?? null,

    new_status: app?.status ?? null,

    actor_user_id: reviewerUserId.trim(),

    actor_type: 'admin',

    notes: `Capability approved: ${request.capability_key}`,

    metadata: {

      capability_key: request.capability_key,

      environment: request.requested_environment,

      request_id: request.id,

    },

  });



  return {

    data: { request: updatedRequest, capability: assignRes.data },

    error: null,

  };

}



export async function approveCapabilityRequest(requestId, reviewerUserId, decisionNotes = null) {

  return resolveCapabilityRequest(requestId, reviewerUserId, 'approved', decisionNotes);

}



export async function rejectCapabilityRequest(requestId, reviewerUserId, decisionNotes = null) {

  return resolveCapabilityRequest(requestId, reviewerUserId, 'rejected', decisionNotes);

}



export async function needsChangesCapabilityRequest(

  requestId,

  reviewerUserId,

  decisionNotes = null,

) {

  return resolveCapabilityRequest(requestId, reviewerUserId, 'needs_changes', decisionNotes);

}



export {

  CAPABILITY_STATUSES,

  REQUEST_STATUSES,

  POLICY_STATUSES,

  RISK_LEVELS,

};


