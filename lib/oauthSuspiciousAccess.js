/**
 * Tropicash OAuth Platform — Phase 12Y suspicious OAuth access classification.
 *
 * Creates admin review cases for anomalous wallet.read patterns. Review-only —
 * no automatic user restrictions, account locks, or token revocation.
 */

const REVIEW_TABLE = 'oauth_access_review_cases';
const USAGE_TABLE = 'oauth_api_usage_logs';
const ACCESS_TABLE = 'oauth_access_tokens';

const HOUR_MS = 60 * 60 * 1000;

/** Known review reasons (no automatic enforcement). */
export const OAUTH_SUSPICIOUS_REASONS = {
  HIGH_FREQUENCY_WALLET_READ: 'HIGH_FREQUENCY_WALLET_READ',
  MULTIPLE_TOKENS_SAME_CLIENT: 'MULTIPLE_TOKENS_SAME_CLIENT',
  REVOKED_CONSENT_ACCESS_ATTEMPT: 'REVOKED_CONSENT_ACCESS_ATTEMPT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  UNKNOWN_ANOMALY: 'UNKNOWN_ANOMALY',
};

const REASON_SEVERITY = {
  [OAUTH_SUSPICIOUS_REASONS.HIGH_FREQUENCY_WALLET_READ]: 'high',
  [OAUTH_SUSPICIOUS_REASONS.MULTIPLE_TOKENS_SAME_CLIENT]: 'medium',
  [OAUTH_SUSPICIOUS_REASONS.REVOKED_CONSENT_ACCESS_ATTEMPT]: 'high',
  [OAUTH_SUSPICIOUS_REASONS.RATE_LIMIT_EXCEEDED]: 'medium',
  [OAUTH_SUSPICIOUS_REASONS.UNKNOWN_ANOMALY]: 'low',
};

function isUuidLike(v) {
  if (typeof v !== 'string' || !v.trim()) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim(),
  );
}

/**
 * @param {string} reason
 * @returns {'low' | 'medium' | 'high'}
 */
export function getSeverityForReason(reason) {
  return REASON_SEVERITY[reason] || 'low';
}

/**
 * Create an admin review case (best-effort; never throws).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{
 *   client_id?: string | null;
 *   user_id?: string | null;
 *   access_token_id?: string | null;
 *   reason: string;
 *   severity?: string;
 *   metadata?: object;
 * }} payload
 * @returns {Promise<{ data: object | null; error: object | null }>}
 */
export async function createOAuthAccessReviewCase(client, payload = {}) {
  if (!client) {
    return { data: null, error: { message: 'no_client' } };
  }

  const reason = String(payload.reason || OAUTH_SUSPICIOUS_REASONS.UNKNOWN_ANOMALY);
  const row = {
    client_id: isUuidLike(payload.client_id) ? payload.client_id : null,
    user_id: isUuidLike(payload.user_id) ? payload.user_id : null,
    access_token_id: isUuidLike(payload.access_token_id) ? payload.access_token_id : null,
    reason,
    severity: payload.severity || getSeverityForReason(reason),
    status: 'open',
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
  };

  return client.from(REVIEW_TABLE).insert(row).select('id, reason, severity, status').maybeSingle();
}

/**
 * Open a review case when OAuth rate limit is exceeded.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {object} context
 * @param {string} endpoint
 * @param {object} [rateMeta]
 */
export async function maybeCreateReviewCaseForRateLimit(client, context, endpoint, rateMeta = {}) {
  return createOAuthAccessReviewCase(client, {
    client_id: context?.client_row_id ?? null,
    user_id: context?.user_id ?? null,
    access_token_id: context?.access_token_id ?? null,
    reason: OAUTH_SUSPICIOUS_REASONS.RATE_LIMIT_EXCEEDED,
    metadata: {
      endpoint,
      ...rateMeta,
    },
  });
}

/**
 * Open a review case when a revoked/inactive consent token is presented.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ clientRowId?: string | null; userId?: string | null; accessTokenId?: string | null }} params
 */
export async function maybeCreateReviewCaseForRevokedConsent(client, params = {}) {
  return createOAuthAccessReviewCase(client, {
    client_id: params.clientRowId ?? null,
    user_id: params.userId ?? null,
    access_token_id: params.accessTokenId ?? null,
    reason: OAUTH_SUSPICIOUS_REASONS.REVOKED_CONSENT_ACCESS_ATTEMPT,
    metadata: { source: 'access_token_auth' },
  });
}

/**
 * Classify wallet.read access patterns and optionally open review cases.
 * No enforcement — classification + case creation only.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{
 *   access_token_id: string;
 *   client_row_id?: string | null;
 *   user_id?: string | null;
 *   scopes?: string[];
 * }} context
 * @param {string} [endpoint]
 * @returns {Promise<{ reasons: string[]; casesCreated: number }>}
 */
export async function classifySuspiciousOAuthAccess(client, context, endpoint) {
  const reasons = [];
  let casesCreated = 0;

  if (!client || !context?.access_token_id) {
    return { reasons: [OAUTH_SUSPICIOUS_REASONS.UNKNOWN_ANOMALY], casesCreated: 0 };
  }

  const scopes = Array.isArray(context.scopes) ? context.scopes : [];
  const ep = String(endpoint || '').toLowerCase();
  const isWalletContext = ep.includes('wallet') || scopes.includes('wallet.read');

  if (isWalletContext) {
    const hourAgoIso = new Date(Date.now() - HOUR_MS).toISOString();
    const { count, error } = await client
      .from(USAGE_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('access_token_id', context.access_token_id)
      .ilike('endpoint', '%wallet%')
      .gte('created_at', hourAgoIso);

    if (!error && (count ?? 0) >= 40) {
      reasons.push(OAUTH_SUSPICIOUS_REASONS.HIGH_FREQUENCY_WALLET_READ);
      const res = await createOAuthAccessReviewCase(client, {
        client_id: context.client_row_id ?? null,
        user_id: context.user_id ?? null,
        access_token_id: context.access_token_id,
        reason: OAUTH_SUSPICIOUS_REASONS.HIGH_FREQUENCY_WALLET_READ,
        metadata: { hourCount: count, endpoint },
      });
      if (!res.error) casesCreated += 1;
    }
  }

  if (isUuidLike(context.client_row_id) && isUuidLike(context.user_id)) {
    const { count, error } = await client
      .from(ACCESS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('client_id', context.client_row_id)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString());

    if (!error && (count ?? 0) >= 3) {
      reasons.push(OAUTH_SUSPICIOUS_REASONS.MULTIPLE_TOKENS_SAME_CLIENT);
      const res = await createOAuthAccessReviewCase(client, {
        client_id: context.client_row_id,
        user_id: context.user_id,
        access_token_id: context.access_token_id,
        reason: OAUTH_SUSPICIOUS_REASONS.MULTIPLE_TOKENS_SAME_CLIENT,
        metadata: { activeTokenCount: count },
      });
      if (!res.error) casesCreated += 1;
    }
  }

  return { reasons, casesCreated };
}

/**
 * Fetch review cases for the admin UI.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{ status?: string; limit?: number }} [options]
 */
export async function fetchOAuthAccessReviewCases(client, options = {}) {
  if (!client) {
    return { data: [], error: { message: 'no_client' } };
  }

  let query = client
    .from(REVIEW_TABLE)
    .select(
      'id, client_id, user_id, access_token_id, reason, severity, status, metadata, created_at, resolved_at',
    )
    .order('created_at', { ascending: false });

  if (options.status) {
    query = query.eq('status', options.status);
  }

  const limit = Number(options.limit) > 0 ? Number(options.limit) : 200;
  query = query.limit(limit);

  return query;
}

/**
 * Update a review case status (admin RLS).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} caseId
 * @param {'reviewing' | 'resolved' | 'dismissed'} status
 */
export async function updateOAuthAccessReviewCaseStatus(client, caseId, status) {
  if (!client || !isUuidLike(caseId)) {
    return { data: null, error: { message: 'invalid_case_id' } };
  }

  const patch = { status };
  if (status === 'resolved' || status === 'dismissed') {
    patch.resolved_at = new Date().toISOString();
  }

  return client
    .from(REVIEW_TABLE)
    .update(patch)
    .eq('id', caseId)
    .select('id, status, resolved_at')
    .maybeSingle();
}
