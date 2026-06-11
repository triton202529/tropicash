/**
 * POST /api/oauth/create-authorization-code — Phase 12O.
 *
 * Mints a short-lived, single-use OAuth authorization code AFTER re-validating
 * the authorization request server-side (Phase 12N validator). Gated behind the
 * OAUTH_CODE_ISSUANCE_ENABLED feature flag (fail-closed: disabled by default).
 *
 * Issues authorization CODES ONLY — NO access tokens, NO refresh tokens, NO
 * consent records, NO wallet APIs, NO money movement.
 *
 * Request body: { client_id, redirect_uri, response_type, scope, state }
 * Response (enabled + valid):
 *   200 { ok: true, authorization_code: "tc_auth_xxx", expires_in: 600 }
 */

import {
  createSupabaseServiceClient,
  getSupabaseUrl,
  getSupabaseAnonKey,
} from '../../../lib/supabaseAdminApi';
import { createClient } from '@supabase/supabase-js';
import {
  isOAuthCodeIssuanceEnabled,
  isFoundationOAuthCodesAllowed,
} from '../../../lib/oauthFeatureFlags';
import { validateOAuthAuthorizationRequest } from '../../../lib/oauthAuthorizationValidator';
import { createAuthorizationCode } from '../../../lib/oauthAuthorizationCodes';
import { verifyConsentForCode } from '../../../lib/oauthConsents';

const isDev = process.env.NODE_ENV !== 'production';

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function devLog(...args) {
  if (isDev) {
    console.log('[OAUTH_AUTH_CODE]', ...args);
  }
}

/** Best-effort user resolution from a Bearer access token (audit only). */
async function resolveUserId(authHeader) {
  const jwt =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;
  if (!jwt) return null;
  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) return null;
  try {
    const authClient = createClient(url, anonKey);
    const {
      data: { user },
    } = await authClient.auth.getUser(jwt);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      ok: false,
      error: 'method_not_allowed',
    });
  }

  // Feature flag — fail closed.
  if (!isOAuthCodeIssuanceEnabled()) {
    return res.status(403).json({
      ok: false,
      error: 'authorization_code_issuance_disabled',
    });
  }

  const client = createSupabaseServiceClient();
  if (!client) {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const input = {
    client_id: body.client_id,
    redirect_uri: body.redirect_uri,
    response_type: body.response_type,
    scope: body.scope,
    state: body.state,
  };

  // 1. Re-validate the authorization request authoritatively (12N).
  let validation;
  try {
    validation = await validateOAuthAuthorizationRequest(input, { client });
  } catch {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
  if (!validation.ok) {
    return res.status(400).json({ ok: false, errors: validation.errors });
  }

  // 2. Resolve the oauth_clients UUID (validation confirmed it exists/active +
  //    redirect match). The validator returns only the public text client_id.
  const { data: clientRow, error: clientError } = await client
    .from('oauth_clients')
    .select('id, status')
    .eq('client_id', validation.client.client_id)
    .maybeSingle();

  if (clientError || !clientRow || clientRow.status !== 'active') {
    return res.status(400).json({
      ok: false,
      errors: [{ code: 'unknown_client', message: 'Unknown client_id.' }],
    });
  }

  const scopes = (validation.scopes || []).map((s) => s.scope);
  const userId = await resolveUserId(req.headers?.authorization);

  // 3. Bind the code to a verified consent (Phase 12U). A consent_id is required
  //    by default; foundation (consent-less) codes are allowed ONLY when the
  //    OAUTH_ALLOW_FOUNDATION_OAUTH_CODES flag is explicitly enabled.
  const consentIdInput = isNonEmptyString(body.consent_id) ? body.consent_id : null;
  let consentId = null;

  if (consentIdInput) {
    if (!userId) {
      return res.status(401).json({ ok: false, error: 'login_required' });
    }
    const verify = await verifyConsentForCode({
      client,
      consentId: consentIdInput,
      userId,
      clientRowId: clientRow.id,
      scopes,
    });
    if (!verify.valid) {
      devLog('consent_invalid', verify.reason);
      return res.status(400).json({
        ok: false,
        errors: [{ code: 'invalid_consent', message: 'Consent is invalid for this request.' }],
      });
    }
    consentId = verify.data.id;
  } else if (!isFoundationOAuthCodesAllowed()) {
    return res.status(400).json({
      ok: false,
      errors: [
        { code: 'consent_required', message: 'A consent_id is required to issue an authorization code.' },
      ],
    });
  }

  // 4. Mint the authorization code (hash-only storage, plaintext returned once).
  const { authorizationCode, expiresIn, data, error } = await createAuthorizationCode({
    client,
    clientRowId: clientRow.id,
    redirectUri: input.redirect_uri,
    scopes,
    consentId,
  });

  if (error || !authorizationCode) {
    devLog('issue_failed', error?.message || error);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  // 5. Audit log (best-effort; never blocks issuance). No secrets recorded.
  const { error: auditError } = await client.from('oauth_audit_events').insert({
    user_id: userId,
    client_id: clientRow.id,
    event_type: 'authorization_code_issued',
    metadata: {
      scopes,
      redirect_uri: input.redirect_uri,
      authorization_code_id: data?.id ?? null,
      consent_id: consentId,
      expires_in: expiresIn,
    },
  });
  if (auditError) {
    devLog('audit_failed', auditError.message || auditError);
  }

  return res.status(200).json({
    ok: true,
    authorization_code: authorizationCode,
    expires_in: expiresIn,
  });
}
