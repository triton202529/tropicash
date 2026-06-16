/**
 * Tropicash — Phase 14F developer sandbox monitoring & risk control.
 *
 * Activity logging, anomaly detection, and risk case creation.
 * Review cases only — no automatic suspension. Metadata only.
 */

import { supabase } from './supabaseClient';
import { createSupabaseServiceClient } from './supabaseAdminApi';

export const SANDBOX_ACTIVITY_TABLE = 'developer_sandbox_activity';
export const SANDBOX_RISK_CASES_TABLE = 'developer_sandbox_risk_cases';

export const SANDBOX_MONITORING_PHASE = '14F';

export const SANDBOX_ACTIVITY_TYPES = [
  'credential_created',
  'oauth_client_created',
  'oauth_test_run',
  'oauth_wallet_access',
  'api_usage_spike',
  'rate_limit_exceeded',
  'access_denied',
];

export const SANDBOX_RISK_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const SANDBOX_RISK_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'];

const ACTIVITY_TYPE_SET = new Set(SANDBOX_ACTIVITY_TYPES);
const SEVERITY_SET = new Set(SANDBOX_RISK_SEVERITIES);

const DENIED_ACCESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const DENIED_ACCESS_MEDIUM_THRESHOLD = 3;
const RATE_LIMIT_MEDIUM_THRESHOLD = 5;

const FORBIDDEN_METADATA_KEYS = new Set([
  'secret',
  'client_secret',
  'access_token',
  'refresh_token',
  'authorization_code',
  'password',
  'api_key',
  'token',
]);

function isUuidLike(v) {
  if (typeof v !== 'string' || !v.trim()) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());
}

/**
 * @param {unknown} metadata
 * @returns {object}
 */
export function sanitizeMonitoringMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }
  const out = {};
  for (const [key, value] of Object.entries(metadata)) {
    const lower = String(key).toLowerCase();
    if (FORBIDDEN_METADATA_KEYS.has(lower)) continue;
    if (lower.includes('secret') || lower.includes('token') || lower.includes('password')) continue;
    if (value === undefined) continue;
    if (typeof value === 'object' && value !== null) {
      out[key] = sanitizeMonitoringMetadata(value);
    } else if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Map activity to suggested risk severity (may return null).
 *
 * @param {string} activityType
 * @param {object} metadata
 * @returns {'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | null}
 */
export function classifyRiskFromActivity(activityType, metadata = {}) {
  const type = String(activityType || '').trim();
  const code = String(metadata?.error_code || metadata?.code || '').trim();

  if (type === 'access_denied') {
    if (code === 'sandbox_capability_blocked') return 'HIGH';
    if (code === 'sandbox_access_not_active' || code === 'sandbox_agreement_required') {
      return 'MEDIUM';
    }
    return 'MEDIUM';
  }

  if (type === 'rate_limit_exceeded') return 'LOW';
  if (type === 'api_usage_spike') return 'LOW';

  if (type === 'oauth_wallet_access' && metadata?.blocked === true) {
    return 'MEDIUM';
  }

  return null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null | undefined} client
 */
function resolveClient(client) {
  return client || createSupabaseServiceClient() || supabase;
}

/**
 * Record sandbox activity (fire-and-forget safe).
 *
 * @param {{
 *   user_id: string;
 *   developer_app_id?: string | null;
 *   activity_type: string;
 *   resource?: string | null;
 *   metadata?: object;
 *   client?: import('@supabase/supabase-js').SupabaseClient | null;
 * }} payload
 */
export async function recordSandboxActivity(payload) {
  const user_id = payload?.user_id;
  const activity_type = String(payload?.activity_type || '').trim();

  if (!isUuidLike(user_id) || !ACTIVITY_TYPE_SET.has(activity_type)) {
    return { data: null, error: { message: 'Invalid activity payload.' } };
  }

  const row = {
    user_id: user_id.trim(),
    developer_app_id: isUuidLike(payload?.developer_app_id)
      ? payload.developer_app_id.trim()
      : null,
    activity_type,
    resource: typeof payload?.resource === 'string' ? payload.resource.slice(0, 256) : null,
    metadata: sanitizeMonitoringMetadata(payload?.metadata),
  };

  try {
    const db = resolveClient(payload?.client);
    const { data, error } = await db
      .from(SANDBOX_ACTIVITY_TABLE)
      .insert(row)
      .select('id, activity_type, created_at')
      .single();

    if (error) return { data: null, error };

    await evaluateActivityForRisk({
      user_id: row.user_id,
      developer_app_id: row.developer_app_id,
      activity_type: row.activity_type,
      metadata: row.metadata,
      client: db,
    });

    return { data, error: null };
  } catch (err) {
    return { data: null, error: { message: err?.message || 'activity_log_failed' } };
  }
}

/**
 * Create a sandbox risk review case (no automatic suspension).
 *
 * @param {{
 *   user_id: string;
 *   developer_app_id?: string | null;
 *   severity: string;
 *   reason: string;
 *   metadata?: object;
 *   client?: import('@supabase/supabase-js').SupabaseClient | null;
 * }} payload
 */
export async function createSandboxRiskCase(payload) {
  const user_id = payload?.user_id;
  const severity = String(payload?.severity || '').trim().toUpperCase();
  const reason = String(payload?.reason || '').trim();

  if (!isUuidLike(user_id)) {
    return { data: null, error: { message: 'user_id must be a valid UUID.' } };
  }
  if (!SEVERITY_SET.has(severity)) {
    return { data: null, error: { message: 'Invalid severity.' } };
  }
  if (!reason) {
    return { data: null, error: { message: 'reason is required.' } };
  }

  const row = {
    user_id: user_id.trim(),
    developer_app_id: isUuidLike(payload?.developer_app_id)
      ? payload.developer_app_id.trim()
      : null,
    severity,
    reason: reason.slice(0, 512),
    status: 'open',
    metadata: sanitizeMonitoringMetadata(payload?.metadata),
  };

  try {
    const db = resolveClient(payload?.client);
    const { data, error } = await db
      .from(SANDBOX_RISK_CASES_TABLE)
      .insert(row)
      .select('id, severity, status, created_at')
      .single();
    return { data, error };
  } catch (err) {
    return { data: null, error: { message: err?.message || 'risk_case_failed' } };
  }
}

/**
 * @param {object} payload
 */
async function evaluateActivityForRisk(payload) {
  const { user_id, developer_app_id, activity_type, metadata, client } = payload;
  const db = resolveClient(client);

  const immediate = classifyRiskFromActivity(activity_type, metadata);
  if (immediate === 'HIGH' || immediate === 'CRITICAL') {
    await createSandboxRiskCase({
      user_id,
      developer_app_id,
      severity: immediate,
      reason: `Sandbox activity flagged: ${activity_type}`,
      metadata: { ...metadata, trigger: 'immediate_classification' },
      client: db,
    });
    return;
  }

  if (activity_type === 'access_denied') {
    const since = new Date(Date.now() - DENIED_ACCESS_WINDOW_MS).toISOString();
    const { count } = await db
      .from(SANDBOX_ACTIVITY_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('activity_type', 'access_denied')
      .gte('created_at', since);

    if ((count || 0) >= DENIED_ACCESS_MEDIUM_THRESHOLD) {
      await createSandboxRiskCase({
        user_id,
        developer_app_id,
        severity: 'MEDIUM',
        reason: 'Repeated sandbox access denials in 24h',
        metadata: { denial_count_24h: count, ...metadata },
        client: db,
      });
    }
    return;
  }

  if (activity_type === 'rate_limit_exceeded' || activity_type === 'api_usage_spike') {
    const since = new Date(Date.now() - DENIED_ACCESS_WINDOW_MS).toISOString();
    const { count } = await db
      .from(SANDBOX_ACTIVITY_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .in('activity_type', ['rate_limit_exceeded', 'api_usage_spike'])
      .gte('created_at', since);

    if ((count || 0) >= RATE_LIMIT_MEDIUM_THRESHOLD) {
      await createSandboxRiskCase({
        user_id,
        developer_app_id,
        severity: 'MEDIUM',
        reason: 'Excessive rate limit events in 24h',
        metadata: { rate_limit_count_24h: count, ...metadata },
        client: db,
      });
    } else if (immediate === 'LOW') {
      await createSandboxRiskCase({
        user_id,
        developer_app_id,
        severity: 'LOW',
        reason: 'Elevated sandbox API activity',
        metadata: { ...metadata, trigger: 'rate_limit_single' },
        client: db,
      });
    }
  }
}

/**
 * Log sandbox access denial from policy enforcement.
 */
export async function recordSandboxAccessDenied(payload) {
  return recordSandboxActivity({
    user_id: payload.user_id,
    developer_app_id: payload.developer_app_id,
    activity_type: 'access_denied',
    resource: payload.resource || 'sandbox_access',
    metadata: sanitizeMonitoringMetadata({
      error_code: payload.error_code,
      capability: payload.capability,
      lifecycle_status: payload.lifecycle_status,
    }),
    client: payload.client,
  });
}

/**
 * Admin: fetch activity feed.
 */
export async function fetchAllSandboxActivity(options = {}) {
  let query = supabase
    .from(SANDBOX_ACTIVITY_TABLE)
    .select('id, user_id, developer_app_id, activity_type, resource, metadata, created_at')
    .order('created_at', { ascending: false });

  if (options.activity_type) {
    query = query.eq('activity_type', options.activity_type);
  }
  if (options.since) {
    query = query.gte('created_at', options.since);
  }
  if (options.until) {
    query = query.lte('created_at', options.until);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  return { data, error };
}

/**
 * Admin: fetch risk cases.
 */
export async function fetchAllSandboxRiskCases(options = {}) {
  let query = supabase
    .from(SANDBOX_RISK_CASES_TABLE)
    .select(
      'id, user_id, developer_app_id, severity, reason, status, metadata, created_at, resolved_at',
    )
    .order('created_at', { ascending: false });

  if (options.severity) {
    query = query.eq('severity', options.severity);
  }
  if (options.status) {
    query = query.eq('status', options.status);
  }
  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  return { data, error };
}

/**
 * Admin monitoring overview aggregates.
 */
export async function getSandboxMonitoringOverview() {
  const [activityRes, riskRes, accessRes] = await Promise.all([
    supabase.from(SANDBOX_ACTIVITY_TABLE).select('activity_type, user_id, developer_app_id'),
    supabase.from(SANDBOX_RISK_CASES_TABLE).select('severity, status'),
    supabase.from('developer_sandbox_access').select('user_id, status').eq('status', 'active'),
  ]);

  const activities = Array.isArray(activityRes.data) ? activityRes.data : [];
  const risks = Array.isArray(riskRes.data) ? riskRes.data : [];
  const activeAccess = Array.isArray(accessRes.data) ? accessRes.data : [];

  const activityCounts = {};
  const developerSet = new Set();
  const appSet = new Set();
  let oauthActivity = 0;
  let apiActivity = 0;

  for (const row of activities) {
    activityCounts[row.activity_type] = (activityCounts[row.activity_type] || 0) + 1;
    if (row.user_id) developerSet.add(row.user_id);
    if (row.developer_app_id) appSet.add(row.developer_app_id);
    if (
      row.activity_type === 'oauth_client_created' ||
      row.activity_type === 'oauth_test_run' ||
      row.activity_type === 'oauth_wallet_access'
    ) {
      oauthActivity += 1;
    }
    if (
      row.activity_type === 'credential_created' ||
      row.activity_type === 'api_usage_spike' ||
      row.activity_type === 'rate_limit_exceeded'
    ) {
      apiActivity += 1;
    }
  }

  const riskBySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
  let openRiskCases = 0;
  for (const row of risks) {
    if (row.severity && riskBySeverity[row.severity] !== undefined) {
      riskBySeverity[row.severity] += 1;
    }
    if (row.status === 'open' || row.status === 'reviewing') openRiskCases += 1;
  }

  return {
    activeDevelopers: activeAccess.length,
    trackedDevelopers: developerSet.size,
    sandboxApplications: appSet.size,
    totalActivityEvents: activities.length,
    oauthActivityEvents: oauthActivity,
    apiActivityEvents: apiActivity,
    activityCounts,
    riskBySeverity,
    openRiskCases,
    totalRiskCases: risks.length,
  };
}

/**
 * Resolve developer (app owner) and record activity.
 *
 * @param {object} payload
 */
export async function recordSandboxActivityForApp(payload) {
  const db = resolveClient(payload?.client);
  let user_id = isUuidLike(payload?.user_id) ? payload.user_id.trim() : null;

  if (!user_id && isUuidLike(payload?.developer_app_id)) {
    const { data } = await db
      .from('developer_apps')
      .select('owner_user_id')
      .eq('id', payload.developer_app_id.trim())
      .maybeSingle();
    user_id = data?.owner_user_id || null;
  }

  if (!user_id) {
    return { data: null, error: { message: 'developer_user_not_found' } };
  }

  return recordSandboxActivity({
    ...payload,
    user_id,
    client: db,
  });
}

/**
 * Non-blocking activity logger for integration points.
 */
export function logSandboxActivityFireAndForget(payload) {
  void recordSandboxActivity(payload).catch(() => {});
}

export function logSandboxAccessDeniedFireAndForget(payload) {
  void recordSandboxAccessDenied(payload).catch(() => {});
}

export function logSandboxActivityForAppFireAndForget(payload) {
  void recordSandboxActivityForApp(payload).catch(() => {});
}
