/**
 * POST /api/oauth/token — Phase 12P/12Q OAuth token exchange + refresh rotation.
 *
 * Supported grants:
 *   • authorization_code — exchange a single-use authorization code for an
 *     access + refresh token pair (Phase 12P).
 *   • refresh_token      — rotate a valid refresh token into a new access +
 *     refresh token pair, revoking the old refresh token immediately (12Q).
 *
 * Issues TOKENS ONLY — NO wallet APIs, NO transaction APIs, NO money movement,
 * NO user financial data. Plaintext tokens are returned exactly once; only
 * SHA-256 hashes are stored.
 */

import { createSupabaseServiceClient } from '../../../lib/supabaseAdminApi';
import { hashApiSecret } from '../../../lib/developerCredentials';
import {
  validateAuthorizationCode,
  markAuthorizationCodeUsed,
} from '../../../lib/oauthAuthorizationCodes';
import { issueTokensForCode, rotateRefreshToken } from '../../../lib/oauthTokens';

const SUPPORTED_GRANT_TYPES = ['authorization_code', 'refresh_token'];

const isDev = process.env.NODE_ENV !== 'production';

function devLog(...args) {
  if (isDev) {
    console.log('[OAUTH_TOKEN]', ...args);
  }
}

function fail(res, status, error) {
  return res.status(status).json({ ok: false, error });
}

function cleanString(v) {
  return typeof v === 'string' ? v.trim() : '';
}

/** Exact registered redirect URI match (no wildcards). */
function redirectIsRegistered(registered, redirectUri) {
  const list = Array.isArray(registered) ? registered : [];
  if (list.includes(redirectUri)) return true;
  let normalized;
  try {
    normalized = new URL(redirectUri).toString();
  } catch {
    return false;
  }
  return list.some((entry) => {
    if (entry === redirectUri) return true;
    try {
      return new URL(entry).toString() === normalized;
    } catch {
      return false;
    }
  });
}

/**
 * Authenticate the OAuth client by client_id + client_secret.
 * @returns {Promise<{ clientRow: object } | { error: string }>}
 */
async function authenticateClient(client, clientId, clientSecret) {
  if (!clientId || !clientSecret) {
    return { error: 'invalid_client' };
  }
  const { data: clientRow, error } = await client
    .from('oauth_clients')
    .select('id, client_id, status, client_secret_hash, redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle();

  if (error) {
    devLog('client_lookup_error', error.message || error);
    return { error: 'server_error' };
  }
  if (!clientRow || clientRow.status !== 'active') {
    return { error: 'invalid_client' };
  }

  let presentedHash;
  try {
    presentedHash = await hashApiSecret(clientSecret);
  } catch {
    return { error: 'server_error' };
  }
  if (presentedHash !== clientRow.client_secret_hash) {
    return { error: 'invalid_client' };
  }
  return { clientRow };
}

async function writeAudit(client, clientRow, eventType, metadata) {
  const { error } = await client.from('oauth_audit_events').insert({
    user_id: null,
    client_id: clientRow?.id ?? null,
    event_type: eventType,
    metadata: metadata || {},
  });
  if (error) {
    devLog('audit_failed', eventType, error.message || error);
  }
}

// ---------------------------------------------------------------------------
// grant_type=authorization_code
// ---------------------------------------------------------------------------
async function handleAuthorizationCodeGrant(req, res, client, body) {
  const code = cleanString(body.code);
  const redirectUri = cleanString(body.redirect_uri);

  if (!code || !redirectUri) {
    return fail(res, 400, 'invalid_request');
  }

  const auth = await authenticateClient(
    client,
    cleanString(body.client_id),
    cleanString(body.client_secret),
  );
  if (auth.error) {
    return fail(res, auth.error === 'server_error' ? 500 : 401, auth.error);
  }
  const { clientRow } = auth;

  if (!redirectIsRegistered(clientRow.redirect_uris, redirectUri)) {
    return fail(res, 400, 'invalid_grant');
  }

  const validation = await validateAuthorizationCode({
    client,
    code,
    clientRowId: clientRow.id,
    redirectUri,
  });
  if (!validation.valid || !validation.data) {
    devLog('code_invalid', validation.reason);
    return fail(res, 400, 'invalid_grant');
  }
  const codeRow = validation.data;

  // Single-use: atomically mark the code used BEFORE issuing tokens.
  const used = await markAuthorizationCodeUsed({ client, id: codeRow.id });
  if (used.error) {
    return fail(res, 500, 'server_error');
  }
  if (used.alreadyUsed) {
    return fail(res, 400, 'invalid_grant');
  }

  const scopes = Array.isArray(codeRow.scopes) ? codeRow.scopes : [];
  const issued = await issueTokensForCode({
    client,
    scopes,
    consentId: codeRow.consent_id ?? null,
    clientRowId: clientRow.id,
  });
  if (issued.error || !issued.accessToken || !issued.refreshToken) {
    devLog('issue_failed', issued.error?.message || issued.error);
    return fail(res, 500, 'server_error');
  }

  await writeAudit(client, clientRow, 'token_issued', {
    grant_type: 'authorization_code',
    client_id: clientRow.client_id,
    scopes,
    access_token_expires_at: issued.accessExpiresAt,
    refresh_token_expires_at: issued.refreshExpiresAt,
  });

  return res.status(200).json({
    ok: true,
    access_token: issued.accessToken,
    refresh_token: issued.refreshToken,
    token_type: 'Bearer',
    expires_in: issued.accessExpiresIn,
    scope: scopes.join(' '),
  });
}

// ---------------------------------------------------------------------------
// grant_type=refresh_token
// ---------------------------------------------------------------------------
async function handleRefreshTokenGrant(req, res, client, body) {
  const refreshToken = cleanString(body.refresh_token);
  if (!refreshToken) {
    return fail(res, 400, 'invalid_request');
  }

  const auth = await authenticateClient(
    client,
    cleanString(body.client_id),
    cleanString(body.client_secret),
  );
  if (auth.error) {
    return fail(res, auth.error === 'server_error' ? 500 : 401, auth.error);
  }
  const { clientRow } = auth;

  const result = await rotateRefreshToken({
    client,
    refreshToken,
    clientRowId: clientRow.id,
  });

  if (!result.ok) {
    // Reuse of an already-revoked refresh token: log (foundation only — do not
    // cascade-revoke the consent yet).
    if (result.reuse) {
      await writeAudit(client, clientRow, 'refresh_token_reuse_detected', {
        client_id: clientRow.client_id,
      });
    }
    if (['server_error', 'revoke_failed', 'issue_failed', 'lookup_error'].includes(result.reason)) {
      return fail(res, 500, 'server_error');
    }
    return fail(res, 400, 'invalid_grant');
  }

  await writeAudit(client, clientRow, 'token_refreshed', {
    client_id: clientRow.client_id,
    scopes: result.scopes,
    access_token_expires_at: result.accessExpiresAt,
    refresh_token_expires_at: result.refreshExpiresAt,
  });

  return res.status(200).json({
    ok: true,
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
    token_type: 'Bearer',
    expires_in: result.accessExpiresIn,
    scope: (result.scopes || []).join(' '),
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'method_not_allowed');
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const grantType = cleanString(body.grant_type);

  if (!SUPPORTED_GRANT_TYPES.includes(grantType)) {
    return fail(res, 400, 'unsupported_grant_type');
  }

  const client = createSupabaseServiceClient();
  if (!client) {
    return fail(res, 500, 'server_error');
  }

  if (grantType === 'authorization_code') {
    return handleAuthorizationCodeGrant(req, res, client, body);
  }
  return handleRefreshTokenGrant(req, res, client, body);
}
