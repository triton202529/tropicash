/**
 * POST /api/oauth/revoke-token — Phase 12W OAuth token revocation (RFC 7009-style).
 *
 * Lets an authenticated OAuth client programmatically revoke its own access or
 * refresh tokens. Unknown, malformed, or foreign-client tokens return
 * { ok: true, revoked: false } to avoid token enumeration. Invalid client
 * credentials return { ok: false, error: 'invalid_client' }.
 *
 * Exposes NO token hashes, NO secrets, NO wallet APIs, and moves NO money.
 *
 * Request body:
 *   { token, token_type_hint?, client_id, client_secret }
 */

import { createSupabaseServiceClient } from '../../../lib/supabaseAdminApi';
import { hashApiSecret } from '../../../lib/developerCredentials';
import { revokeOAuthToken } from '../../../lib/oauthTokens';

const isDev = process.env.NODE_ENV !== 'production';

function devLog(...args) {
  if (isDev) {
    console.log('[OAUTH_REVOKE_TOKEN]', ...args);
  }
}

function cleanString(v) {
  return typeof v === 'string' ? v.trim() : '';
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
    .select('id, client_id, status, client_secret_hash')
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

async function writeAudit(client, clientRow, metadata) {
  const { error } = await client.from('oauth_audit_events').insert({
    user_id: null,
    client_id: clientRow?.id ?? null,
    event_type: 'token_revoked',
    metadata: metadata || {},
  });
  if (error) {
    devLog('audit_failed', error.message || error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const client = createSupabaseServiceClient();
  if (!client) {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const token = cleanString(body.token);
  const tokenTypeHint = cleanString(body.token_type_hint) || null;
  const clientId = cleanString(body.client_id);
  const clientSecret = cleanString(body.client_secret);

  const auth = await authenticateClient(client, clientId, clientSecret);
  if (auth.error) {
    if (auth.error === 'invalid_client') {
      return res.status(401).json({ ok: false, error: 'invalid_client' });
    }
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  const { clientRow } = auth;
  const result = await revokeOAuthToken({
    client,
    token,
    tokenTypeHint,
    clientRowId: clientRow.id,
  });

  await writeAudit(client, clientRow, {
    client_id: clientRow.client_id,
    token_type_hint: tokenTypeHint,
    matched_type: result.matchedType,
    revoked: result.revoked,
  });

  return res.status(200).json({
    ok: true,
    revoked: result.revoked,
  });
}
