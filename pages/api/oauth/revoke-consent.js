/**
 * POST /api/oauth/revoke-consent — Phase 12V OAuth consent revocation.
 *
 * Lets a logged-in user revoke a third-party app's access. Verifies the consent
 * belongs to the caller, then (service-role) marks the consent revoked and
 * revokes all related access + refresh tokens, and writes a consent_revoked
 * audit event.
 *
 * Exposes NO secrets/hashes, NO wallet APIs, and moves NO money.
 *
 * Request body: { consent_id: "..." }
 * Response: 200 { ok: true }
 */

import {
  createSupabaseServiceClient,
  getSupabaseUrl,
  getSupabaseAnonKey,
} from '../../../lib/supabaseAdminApi';
import { createClient } from '@supabase/supabase-js';

const isDev = process.env.NODE_ENV !== 'production';

function devLog(...args) {
  if (isDev) {
    console.log('[OAUTH_REVOKE_CONSENT]', ...args);
  }
}

function isUuidLike(v) {
  if (typeof v !== 'string' || !v.trim()) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim(),
  );
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

  const userId = await resolveUserId(req.headers?.authorization);
  if (!userId) {
    return res.status(401).json({ ok: false, error: 'login_required' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const consentId = typeof body.consent_id === 'string' ? body.consent_id.trim() : '';
  if (!isUuidLike(consentId)) {
    return res.status(400).json({ ok: false, error: 'invalid_request' });
  }

  const client = createSupabaseServiceClient();
  if (!client) {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  // Verify the consent exists and belongs to the caller.
  const { data: consent, error: lookupError } = await client
    .from('oauth_consents')
    .select('id, user_id, client_id, scopes, status')
    .eq('id', consentId)
    .maybeSingle();

  if (lookupError) {
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
  if (!consent || consent.user_id !== userId) {
    // Do not disclose existence of other users' consents.
    return res.status(404).json({ ok: false, error: 'not_found' });
  }

  const nowIso = new Date().toISOString();

  // Idempotent: if already revoked, report success without re-touching tokens.
  if (consent.status !== 'active') {
    return res.status(200).json({ ok: true, already_revoked: true });
  }

  // 1. Revoke the consent.
  const { error: consentError } = await client
    .from('oauth_consents')
    .update({ status: 'revoked', revoked_at: nowIso })
    .eq('id', consentId)
    .eq('user_id', userId)
    .eq('status', 'active');

  if (consentError) {
    devLog('consent_update_failed', consentError.message || consentError);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }

  // 2 + 3. Revoke related access + refresh tokens (only those still active).
  const { error: accessError } = await client
    .from('oauth_access_tokens')
    .update({ revoked_at: nowIso })
    .eq('consent_id', consentId)
    .is('revoked_at', null);
  if (accessError) {
    devLog('access_revoke_failed', accessError.message || accessError);
  }

  const { error: refreshError } = await client
    .from('oauth_refresh_tokens')
    .update({ revoked_at: nowIso })
    .eq('consent_id', consentId)
    .is('revoked_at', null);
  if (refreshError) {
    devLog('refresh_revoke_failed', refreshError.message || refreshError);
  }

  // 4. Audit (best-effort). No tokens/hashes/secrets recorded.
  const { error: auditError } = await client.from('oauth_audit_events').insert({
    user_id: userId,
    client_id: isUuidLike(consent.client_id) ? consent.client_id : null,
    event_type: 'consent_revoked',
    metadata: {
      consent_id: consentId,
      client_id: consent.client_id,
      scopes: Array.isArray(consent.scopes) ? consent.scopes : [],
    },
  });
  if (auditError) {
    devLog('audit_failed', auditError.message || auditError);
  }

  return res.status(200).json({ ok: true });
}
