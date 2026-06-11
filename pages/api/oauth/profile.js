/**
 * GET /api/oauth/profile — Phase 12S first OAuth-protected, user-scoped API.
 *
 * Validates an OAuth access token (Authorization: Bearer tc_at_…) and enforces
 * the `profile.read` scope, then returns safe, minimal profile metadata only.
 *
 * Returns NO email/phone, NO wallet balance, NO transaction history, NO KYC
 * documents, NO payment methods, NO secrets, and NO token hashes. No money
 * movement occurs here.
 */

import { requireOAuthAccessToken } from '../../../lib/oauthAccessTokenAuth';
import { buildOAuthProfileResponse } from '../../../lib/oauthProfileApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  // 401 invalid_token / 403 insufficient_scope are written by the middleware.
  const context = await requireOAuthAccessToken(req, res, {
    requiredScopes: ['profile.read'],
    endpoint: '/api/oauth/profile',
    method: 'GET',
  });
  if (!context) {
    return undefined;
  }

  return res.status(200).json(buildOAuthProfileResponse(context));
}
