/**
 * POST /api/oauth/validate-authorization-request — Phase 12N.
 *
 * Server-side validation of an OAuth authorization request. Returns a safe,
 * non-secret validation result for the consent screen. Issues NO authorization
 * codes, NO tokens, and creates NO consent records.
 *
 * Request body:
 *   { client_id, redirect_uri, response_type, scope, state }
 *
 * Response:
 *   200 { ok: true, client: { client_id, client_name, status }, scopes, warnings }
 *   400 { ok: false, errors: [{ code, message }], warnings }
 *   405 { ok: false, errors: [{ code, message }] }
 *   500 { ok: false, errors: [{ code, message }] }
 */

import { validateOAuthAuthorizationRequest } from '../../../lib/oauthAuthorizationValidator';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      ok: false,
      errors: [{ code: 'method_not_allowed', message: 'Method not allowed. Use POST.' }],
    });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};

  let result;
  try {
    result = await validateOAuthAuthorizationRequest({
      client_id: body.client_id,
      redirect_uri: body.redirect_uri,
      response_type: body.response_type,
      scope: body.scope,
      state: body.state,
    });
  } catch {
    return res.status(500).json({
      ok: false,
      errors: [{ code: 'server_error', message: 'Authorization validation failed.' }],
    });
  }

  return res.status(result.ok ? 200 : 400).json(result);
}
