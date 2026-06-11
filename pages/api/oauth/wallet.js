/**
 * GET /api/oauth/wallet — Phase 12Z first OAuth-protected wallet read (sandbox).
 *
 * Validates an OAuth access token (Authorization: Bearer tc_at_…) and enforces
 * the `wallet.read` scope, then returns a minimal, read-only wallet summary.
 *
 * Sandbox only. Requires real user consent (foundation-mode tokens without a
 * linked user are rejected). Rate-limited and audited.
 *
 * Returns NO transaction history, NO payment methods, NO KYC documents, NO
 * secrets, and NO token hashes. No balance mutation or money movement occurs.
 */

import { requireOAuthAccessToken } from '../../../lib/oauthAccessTokenAuth';
import {
  buildOAuthWalletResponse,
  writeOAuthWalletAudit,
} from '../../../lib/oauthWalletApi';
import { classifySuspiciousOAuthAccess } from '../../../lib/oauthSuspiciousAccess';
import { createSupabaseServiceClient } from '../../../lib/supabaseAdminApi';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const context = await requireOAuthAccessToken(req, res, {
    requiredScopes: ['wallet.read'],
    endpoint: '/api/oauth/wallet',
    method: 'GET',
  });
  if (!context) {
    return undefined;
  }

  const client = createSupabaseServiceClient();
  const result = await buildOAuthWalletResponse(context, { client });

  if (!result.ok) {
    if (result.blocked) {
      await writeOAuthWalletAudit(client, 'wallet_read_blocked', context, {
        error: result.error,
        endpoint: '/api/oauth/wallet',
      });
    }
    const status = result.error === 'consent_required' ? 403 : 503;
    return res.status(status).json({ ok: false, error: result.error });
  }

  await writeOAuthWalletAudit(client, 'wallet_read_performed', context, {
    endpoint: '/api/oauth/wallet',
    wallet_status: result.wallet.wallet_status,
    kyc_status: result.wallet.kyc_status,
  });

  await classifySuspiciousOAuthAccess(client, context, '/api/oauth/wallet');

  return res.status(200).json(result);
}
