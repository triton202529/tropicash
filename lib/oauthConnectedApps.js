/**
 * Tropicash — Phase 12V connected-apps (OAuth consent management) helpers.
 *
 * Client-side helpers for the user-facing "Connected Apps" page: list the
 * logged-in user's OAuth consents (RLS-scoped to their own rows) and revoke a
 * consent via a trusted server endpoint.
 *
 * Security: this module NEVER selects or surfaces client_secret_hash or any
 * token hashes. It reads only the user's own consents (RLS enforced) plus safe,
 * non-secret client metadata (public client_id, client_name, status) when
 * available. No wallet APIs, no money movement.
 */

import { supabase } from './supabaseClient';
import { getOAuthScope } from './oauthConsentModels';

/**
 * Fetch the logged-in user's OAuth consents (active + revoked), newest first.
 *
 * RLS restricts rows to `user_id = auth.uid()`. Client metadata is resolved via
 * a best-effort embed; when RLS denies access to `oauth_clients` the embed is
 * null and the UI falls back to the consent's client reference. We deliberately
 * never select secret columns (client_secret_hash) or any token hashes.
 *
 * @param {string} userId
 * @returns {Promise<{ data: object[]; error: object|null }>}
 */
export async function fetchUserOAuthConsents(userId) {
  if (!userId) {
    return { data: [], error: { message: 'A user id is required.' } };
  }

  const { data, error } = await supabase
    .from('oauth_consents')
    .select(
      'id, client_id, scopes, status, granted_at, revoked_at, oauth_clients ( client_id, client_name, status )',
    )
    .eq('user_id', userId)
    .order('granted_at', { ascending: false });

  if (error) {
    return { data: [], error };
  }

  const rows = (data || []).map((row) => {
    const clientMeta = row.oauth_clients || null;
    return {
      id: row.id,
      clientRowId: row.client_id,
      clientPublicId: clientMeta?.client_id ?? null,
      clientName: clientMeta?.client_name ?? null,
      clientStatus: clientMeta?.status ?? null,
      scopes: Array.isArray(row.scopes) ? row.scopes : [],
      status: row.status,
      grantedAt: row.granted_at ?? null,
      revokedAt: row.revoked_at ?? null,
    };
  });

  return { data: rows, error: null };
}

/**
 * Revoke one of the user's consents through the trusted server endpoint. The
 * server verifies ownership, revokes the consent + related tokens, and writes an
 * audit event. Sends the user's Supabase access token as a Bearer.
 *
 * @param {string} consentId
 * @param {string} [userId]  Accepted for symmetry; the server authorizes via the token.
 * @returns {Promise<{ ok: boolean; error: string|null }>}
 */
export async function revokeOAuthConsent(consentId, userId) {
  void userId;
  if (!consentId) {
    return { ok: false, error: 'A consent id is required.' };
  }

  let accessToken = null;
  try {
    const { data: { session } = {} } = await supabase.auth.getSession();
    accessToken = session?.access_token ?? null;
  } catch {
    accessToken = null;
  }
  if (!accessToken) {
    return { ok: false, error: 'You must be signed in to revoke access.' };
  }

  try {
    const res = await fetch('/api/oauth/revoke-consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ consent_id: consentId }),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok) {
      return { ok: true, error: null };
    }
    return { ok: false, error: json?.error || 'Could not revoke access. Please try again.' };
  } catch {
    return { ok: false, error: 'Could not revoke access. Please try again.' };
  }
}

/**
 * Map a scope list to display descriptors (label + risk) using the catalog.
 * Unknown scopes are passed through with the raw scope as the label.
 *
 * @param {string[]} scopes
 * @returns {{ scope: string; label: string; riskLevel: string|null }[]}
 */
export function formatConsentScopes(scopes) {
  const list = Array.isArray(scopes) ? scopes : [];
  return list.map((scope) => {
    const def = getOAuthScope(scope);
    return {
      scope,
      label: def?.label || scope,
      riskLevel: def?.riskLevel || null,
    };
  });
}

/**
 * UI badge descriptor for a consent status.
 * @param {string} status
 * @returns {{ label: string; className: string }}
 */
export function getConsentStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'active') {
    return { label: 'Active', className: 'border-emerald-200 bg-emerald-50 text-emerald-900' };
  }
  if (s === 'revoked') {
    return { label: 'Revoked', className: 'border-slate-200 bg-slate-100 text-slate-600' };
  }
  return { label: status || '—', className: 'border-slate-200 bg-slate-50 text-slate-700' };
}
