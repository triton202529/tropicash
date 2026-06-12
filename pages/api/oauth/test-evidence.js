/**
 * POST /api/oauth/test-evidence — Phase 13B OAuth wallet sandbox evidence.
 *
 * Records sanitized pass/fail harness step evidence for a logged-in user.
 * Server-side sanitization is mandatory — client payloads are never trusted.
 *
 * Never stores secrets, tokens, authorization codes, wallet balances,
 * transactions, or KYC documents. Diagnostics only — no money movement.
 */

import {
  createSupabaseServiceClient,
  getSupabaseUrl,
  getSupabaseAnonKey,
} from '../../../lib/supabaseAdminApi';
import {
  buildEvidencePayload,
  EVIDENCE_STATUSES,
  sanitizeOAuthWalletEvidence,
} from '../../../lib/oauthWalletTestEvidence';
import { createClient } from '@supabase/supabase-js';

function isUuidLike(v) {
  if (typeof v !== 'string' || !v.trim()) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim(),
  );
}

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

async function verifyClientOwnership(client, userId, oauthClientId, developerAppId) {
  if (!isUuidLike(oauthClientId)) {
    return { ok: false, error: 'invalid_oauth_client_id' };
  }

  const { data: clientRow, error } = await client
    .from('oauth_clients')
    .select('id, app_id')
    .eq('id', oauthClientId)
    .maybeSingle();

  if (error || !clientRow) {
    return { ok: false, error: 'oauth_client_not_found' };
  }

  if (isUuidLike(developerAppId) && clientRow.app_id !== developerAppId) {
    return { ok: false, error: 'app_client_mismatch' };
  }

  const { data: appRow, error: appError } = await client
    .from('developer_apps')
    .select('id, owner_user_id')
    .eq('id', clientRow.app_id)
    .maybeSingle();

  if (appError || !appRow) {
    return { ok: false, error: 'developer_app_not_found' };
  }

  if (appRow.owner_user_id !== userId) {
    return { ok: false, error: 'forbidden' };
  }

  return { ok: true, developer_app_id: clientRow.app_id };
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

  const runId = String(body.run_id || '').trim();
  const stepKey = String(body.step_key || '').trim();
  const stepLabel = String(body.step_label || '').trim();
  const status = String(body.status || '').toLowerCase();

  if (!runId || runId.length > 128) {
    return res.status(400).json({ ok: false, error: 'invalid_run_id' });
  }
  if (!stepKey || stepKey.length > 64) {
    return res.status(400).json({ ok: false, error: 'invalid_step_key' });
  }
  if (!stepLabel || stepLabel.length > 128) {
    return res.status(400).json({ ok: false, error: 'invalid_step_label' });
  }
  if (!EVIDENCE_STATUSES.includes(status)) {
    return res.status(400).json({ ok: false, error: 'invalid_status' });
  }

  const serviceClient = createSupabaseServiceClient();
  if (!serviceClient) {
    return res.status(503).json({ ok: false, error: 'service_unavailable' });
  }

  const oauthClientId = isUuidLike(body.oauth_client_id) ? body.oauth_client_id : null;
  const developerAppId = isUuidLike(body.developer_app_id) ? body.developer_app_id : null;

  if (oauthClientId) {
    const ownership = await verifyClientOwnership(
      serviceClient,
      userId,
      oauthClientId,
      developerAppId,
    );
    if (!ownership.ok) {
      return res.status(ownership.error === 'forbidden' ? 403 : 400).json({
        ok: false,
        error: ownership.error,
      });
    }
  }

  const payload = buildEvidencePayload({
    run_id: runId,
    developer_app_id: developerAppId,
    oauth_client_id: oauthClientId,
    step_key: stepKey,
    step_label: stepLabel,
    status,
    http_status: body.http_status,
    result: body.sanitized_result ?? body.result ?? {},
  });

  const row = {
    user_id: userId,
    developer_app_id: payload.developer_app_id,
    oauth_client_id: payload.oauth_client_id,
    run_id: payload.run_id,
    step_key: payload.step_key,
    step_label: payload.step_label,
    status: payload.status,
    http_status: payload.http_status,
    sanitized_result: sanitizeOAuthWalletEvidence(payload.sanitized_result),
  };

  const { data, error } = await serviceClient
    .from('oauth_wallet_test_evidence')
    .insert(row)
    .select('id')
    .maybeSingle();

  if (error) {
    return res.status(500).json({ ok: false, error: 'insert_failed' });
  }

  return res.status(200).json({ ok: true, id: data?.id ?? null });
}
