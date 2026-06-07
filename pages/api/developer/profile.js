import { requireDeveloperApiAuth } from '../../../lib/developerApiAuth';
import { sendApiSuccess, sendMethodNotAllowed } from '../../../lib/developerApiResponses';
import { buildDeveloperProfile } from '../../../lib/developerApiProfile';

/**
 * GET /api/developer/profile
 *
 * First real external Tropicash Developer API (Phase 12H). Returns read-only
 * metadata for the credential making the request. RESTRICTED data class —
 * scoped to the caller's own organization/app; exposes NO secret material,
 * webhook secrets, user data, or organization owner emails.
 *
 * Every request passes through the Phase 12B/12C pipeline via
 * `requireDeveloperApiAuth`, in order:
 *   1. authenticate the credential (401 on failure),
 *   2. enforce the rate limit (429 when exceeded),
 *   3. record the request in developer_api_usage_logs (appears in the dashboard).
 *
 * No money movement, wallet, or user data.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendMethodNotAllowed(res, ['GET']);
  }

  const context = await requireDeveloperApiAuth(req, res, {
    endpoint: '/api/developer/profile',
    method: 'GET',
  });
  if (!context) {
    // 401 (auth) or 429 (rate limit) already written by requireDeveloperApiAuth.
    return;
  }

  return sendApiSuccess(res, buildDeveloperProfile(context));
}
