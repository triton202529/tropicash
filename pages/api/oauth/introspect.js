/**
 * POST /api/oauth/introspect — Phase 12R OAuth access token introspection.
 *
 * Developer/internal helper to check whether an access token is active and view
 * its safe metadata. Sandbox testing only. Exposes NO token/refresh/secret
 * hashes, NO wallet data, and NO money movement.
 *
 * Request:  { "token": "tc_at_xxx" }
 * Active:   { active: true, client_id, app_id, user_id, scope, exp }
 * Inactive: { active: false }
 */

import { authenticateOAuthAccessToken } from '../../../lib/oauthAccessTokenAuth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ active: false });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const token = typeof body.token === 'string' ? body.token.trim() : '';

  if (!token) {
    return res.status(200).json({ active: false });
  }

  // Reuse the access token middleware by presenting the token as a Bearer.
  const result = await authenticateOAuthAccessToken({
    headers: { authorization: `Bearer ${token}` },
  });

  if (!result.ok) {
    return res.status(200).json({ active: false });
  }

  const { context } = result;
  const expSeconds = (() => {
    const ms = Date.parse(context.expires_at);
    return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
  })();

  return res.status(200).json({
    active: true,
    client_id: context.client_id,
    app_id: context.app_id,
    user_id: context.user_id,
    scope: (context.scopes || []).join(' '),
    exp: expSeconds,
  });
}
