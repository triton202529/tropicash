/**
 * Tropicash — Phase 12Z OAuth-protected wallet read response builder.
 *
 * Read-only, sandbox-only shaping of the minimal wallet payload for
 * `GET /api/oauth/wallet`. Uses service-role SELECTs against `wallets` and
 * `kyc_profiles` only — no inserts, updates, balance recalculation, transaction
 * joins, or money movement.
 *
 * Explicitly excluded from responses: transaction history, payment methods,
 * linked bank accounts, KYC documents, withdrawal methods, fraud scores,
 * internal risk notes, admin flags, and raw transaction rows.
 */

import { createSupabaseServiceClient } from './supabaseAdminApi';

export const OAUTH_WALLET_ENVIRONMENT = 'sandbox';

const WALLET_AMOUNT_COLUMNS = ['wallet_balance', 'balance'];

function isUuidLike(v) {
  if (typeof v !== 'string' || !v.trim()) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v.trim(),
  );
}

function isMissingColumnError(err) {
  if (!err) return false;
  const code = String(err.code || '').trim();
  if (code === '42703') return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('column "') && msg.includes('does not exist');
}

/**
 * Map internal KYC profile status to a safe OAuth summary enum.
 *
 * @param {unknown} rawStatus
 * @returns {'unverified' | 'pending' | 'verified' | 'rejected' | 'unknown'}
 */
export function mapKycStatusForOAuth(rawStatus) {
  const s = String(rawStatus || '')
    .toLowerCase()
    .trim();
  if (!s || s === 'not_started') return 'unverified';
  if (s === 'approved') return 'verified';
  if (s === 'rejected') return 'rejected';
  if (s === 'submitted' || s === 'under_review' || s === 'needs_more_info') {
    return 'pending';
  }
  return 'unknown';
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatAvailableBalance(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toFixed(2);
}

/**
 * Read-only wallet row lookup (no transaction joins).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 */
async function fetchWalletRow(client, userId) {
  for (const col of WALLET_AMOUNT_COLUMNS) {
    const { data, error } = await client
      .from('wallets')
      .select(`user_id, ${col}`)
      .eq('user_id', userId)
      .maybeSingle();

    if (!error) {
      return { row: data, balanceColumn: col, error: null };
    }
    if (!isMissingColumnError(error)) {
      return { row: null, balanceColumn: null, error };
    }
  }
  return { row: null, balanceColumn: null, error: { message: 'wallet_lookup_failed' } };
}

/**
 * Safe KYC summary — status column only; never document URLs or review notes.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 */
async function fetchKycStatusSummary(client, userId) {
  const { data, error } = await client
    .from('kyc_profiles')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return { kycStatus: 'unknown', error };
  }
  return { kycStatus: mapKycStatusForOAuth(data?.status), error: null };
}

/** Best-effort wallet read audit. Never logs available_balance or raw wallet payloads. */
export async function writeOAuthWalletAudit(client, eventType, context, metadata) {
  if (!client) return;
  try {
    await client.from('oauth_audit_events').insert({
      user_id: isUuidLike(context?.user_id) ? context.user_id : null,
      client_id: isUuidLike(context?.client_row_id) ? context.client_row_id : null,
      event_type: eventType,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Build the minimal OAuth wallet read response.
 *
 * @param {{
 *   user_id?: string | null;
 *   client_row_id?: string | null;
 * }} context
 * @param {{ client?: import('@supabase/supabase-js').SupabaseClient }} [options]
 * @returns {Promise<
 *   | { ok: true; wallet: object }
 *   | { ok: false; error: string; blocked?: boolean }
 * >}
 */
export async function buildOAuthWalletResponse(context, options = {}) {
  const userId = context?.user_id ?? null;

  if (!userId) {
    return { ok: false, error: 'consent_required', blocked: true };
  }

  const client = options.client || createSupabaseServiceClient();
  if (!client) {
    return { ok: false, error: 'service_unavailable', blocked: true };
  }

  const [walletRes, kycRes] = await Promise.all([
    fetchWalletRow(client, userId),
    fetchKycStatusSummary(client, userId),
  ]);

  if (walletRes.error) {
    return { ok: false, error: 'wallet_read_failed', blocked: true };
  }

  const kycStatus = kycRes.error ? 'unknown' : kycRes.kycStatus;

  if (!walletRes.row) {
    return {
      ok: true,
      wallet: {
        user_id: userId,
        currency: 'USD',
        available_balance: '0.00',
        wallet_status: 'not_created',
        kyc_status: kycStatus,
        access_type: 'oauth',
        scope: 'wallet.read',
        environment: OAUTH_WALLET_ENVIRONMENT,
      },
    };
  }

  const rawBalance = walletRes.row[walletRes.balanceColumn] ?? 0;

  return {
    ok: true,
    wallet: {
      user_id: userId,
      currency: 'USD',
      available_balance: formatAvailableBalance(rawBalance),
      wallet_status: 'active',
      kyc_status: kycStatus,
      access_type: 'oauth',
      scope: 'wallet.read',
      environment: OAUTH_WALLET_ENVIRONMENT,
    },
  };
}

export default buildOAuthWalletResponse;
