import { requireDeveloperApiAuth } from '../../../lib/developerApiAuth';
import { sendApiSuccess, sendMethodNotAllowed } from '../../../lib/developerApiResponses';

/**
 * GET /api/developer/ping
 *
 * Authenticated health check for the Tropicash Developer API. Requires a valid
 * sandbox API credential via `Authorization: Bearer tc_test_...`.
 *
 * Phase 12B + 12C: `requireDeveloperApiAuth` runs all three steps in order —
 *   1. authenticate the credential,
 *   2. enforce the rate limit (HTTP 429 when exceeded),
 *   3. record the request in developer_api_usage_logs.
 * Successful requests therefore appear in the usage dashboard.
 *
 * No money movement, wallet, or user-facing logic.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const context = await requireDeveloperApiAuth(req, res, {
    endpoint: '/api/developer/ping',
    method: 'GET',
  });
  if (!context) {
    // 401 (auth) or 429 (rate limit) already written by requireDeveloperApiAuth.
    return;
  }

  return sendApiSuccess(res, {
    message: 'Tropicash Developer API authentication successful',
    environment: context.environment,
    organization_id: context.organization_id,
    app_id: context.app_id,
  });
}
