import { requireDeveloperApiAuth } from '../../../lib/developerApiAuth';
import { sendApiSuccess, sendMethodNotAllowed } from '../../../lib/developerApiResponses';

/**
 * GET /api/developer/platform-status
 *
 * First real external Tropicash Developer API (Phase 12H). Returns platform
 * availability information. PUBLIC data class — non-financial, non-user-sensitive.
 *
 * Every request passes through the Phase 12B/12C pipeline via
 * `requireDeveloperApiAuth`, in order:
 *   1. authenticate the credential (401 on failure),
 *   2. enforce the rate limit (429 when exceeded),
 *   3. record the request in developer_api_usage_logs (appears in the dashboard).
 *
 * Status is always "operational" in this phase. Future values: operational,
 * degraded, maintenance.
 *
 * No money movement, wallet, or user data.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const context = await requireDeveloperApiAuth(req, res, {
    endpoint: '/api/developer/platform-status',
    method: 'GET',
  });
  if (!context) {
    // 401 (auth) or 429 (rate limit) already written by requireDeveloperApiAuth.
    return;
  }

  return sendApiSuccess(res, {
    environment: context.environment,
    status: 'operational',
    version: 'v1',
    timestamp: new Date().toISOString(),
  });
}
