/**
 * POST /api/oauth/create-consent — Phase 12U OAuth consent record creation.
 *
 * Records a user's consent grant in oauth_consents AFTER re-validating the
 * authorization request server-side (Phase 12N validator). Requires a logged-in
 * Supabase user. Issues NO authorization codes, NO tokens, NO wallet access, and
 * moves NO money.
 *
 * Request body: { client_id, redirect_uri, response_type, scope, state }
 * Response (valid): 200 { ok: true, consent_id: "...", scopes: [...] }
 */

import {
  createSupabaseServiceClient,
  getSupabaseUrl,
  getSupabaseAnonKey,
} from '../../../lib/supabaseAdminApi';
import { createClient } from '@supabase/supabase-js';
import { validateOAuthAuthorizationRequest } from '../../../lib/oauthAuthorizationValidator';
import { createOAuthConsent } from '../../../lib/oauthConsents';

const isDev = process.env.NODE_ENV !== 'production';

function devLog(...args) {
  if (isDev) {
    console.log('[OAUTH_CONSENT]', ...args);
  }
}

/** Resolve the logged-in user id from a Supabase Bearer access token. */
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
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  // 1. Require a logged-in Supabase user.
  const userId = await resolveUserId(req.headers?.authorization);
  if (!userId) {
    return res.status(401).json({ ok: false, error: 'login_required' });
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

  // 2. Re-validate the authorization request authoritatively (12N). This
  //    rejects unknown/disabled clients, redirect mismatches, unknown scopes,
  //    and critical (money-movement) scopes.
  let validation;
  try {
    validation = await validateOAuthAuthorizationRequest(input, { client });
  } catch {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
  if (!validation.ok) {
    return res.status(400).json({ ok: false, errors: validation.errors });
  }

  // 3. Resolve the oauth_clients UUID (validator returns only the public id).
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

  // 4. Create (or reuse) the consent record.
  const scopes = (validation.scopes || []).map((s) => s.scope);
  const { data: consent, reused, error: consentError } = await createOAuthConsent({
    client,
    userId,
    clientRowId: clientRow.id,
    scopes,
  });

  if (consentError || !consent) {
    devLog('consent_failed', consentError?.code || consentError?.message || consentError);
    const code = consentError?.code;
    if (code && code !== 'lookup_error' && code !== 'validation_error') {
      return res.status(400).json({ ok: false, errors: [consentError] });
    }
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  // 5. Audit (best-effort; never blocks). Only new grants are logged. No secrets.
  if (!reused) {
    const { error: auditError } = await client.from('oauth_audit_events').insert({
      user_id: userId,
      client_id: clientRow.id,
      event_type: 'consent_granted',
      metadata: {
        client_id: validation.client.client_id,
        scopes: consent.scopes,
        redirect_uri: input.redirect_uri,
        response_type: input.response_type,
        state_present: Boolean(input.state),
      },
    });
    if (auditError) {
      devLog('audit_failed', auditError.message || auditError);
    }
  }

  return res.status(200).json({
    ok: true,
    consent_id: consent.id,
    scopes: consent.scopes,
  });
}
