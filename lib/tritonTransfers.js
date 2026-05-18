/**
 * Manual Tropicash <-> Triton transfer queue (phase 1 — request infrastructure only).
 *
 * This module never moves real money: it just creates/lists/updates rows in
 * public.triton_transfer_requests. Wallet ledger entries and broker calls are
 * intentionally out of scope for this phase. The bounds below match the
 * withdraw-wallet style — keep them small while we're in controlled testing.
 *
 * Status transitions are enforced by the admin UI, not here, so the helpers
 * stay simple and defensive (no throws). Each Supabase call is wrapped in
 * try/catch and any failure is logged via lib/operationalLogger.js under
 * the `triton.*` / `notification.*` categories with minimal metadata.
 */

import { supabase } from './supabaseClient';
import { logOperationalError, logOperationalEvent } from './operationalLogger';
import { appendAuditEvent } from './auditTimeline';

export const MIN_TRITON_TRANSFER_AMOUNT = 1;
export const MAX_TRITON_TRANSFER_AMOUNT = 1000;

export const TRITON_TRANSFER_DIRECTIONS = Object.freeze(['to_triton', 'from_triton']);
export const TRITON_TRANSFER_STATUSES = Object.freeze([
  'pending',
  'processing',
  'completed',
  'rejected',
  'cancelled',
]);

const PROCESSED_STATUSES = new Set(['processing', 'completed', 'rejected', 'cancelled']);

function amountBucketFor(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 'invalid';
  if (n < 10) return '<10';
  if (n < 100) return '10-100';
  return '100-1000';
}

function isAllowedDirection(direction) {
  return TRITON_TRANSFER_DIRECTIONS.includes(direction);
}

function isAllowedStatus(status) {
  return TRITON_TRANSFER_STATUSES.includes(status);
}

function clampString(value, maxLen) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/**
 * Create a new transfer request row.
 * @param {{ userId: string; direction: 'to_triton' | 'from_triton'; amount: number | string }} params
 * @returns {Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>}
 */
export async function createTritonTransferRequest({ userId, direction, amount }) {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  if (!uid) {
    return { data: null, error: { message: 'You must be signed in to request a transfer.' } };
  }
  if (!isAllowedDirection(direction)) {
    return { data: null, error: { message: 'Invalid transfer direction.' } };
  }
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return { data: null, error: { message: 'Enter a valid amount.' } };
  }
  if (amt < MIN_TRITON_TRANSFER_AMOUNT || amt > MAX_TRITON_TRANSFER_AMOUNT) {
    return {
      data: null,
      error: {
        message: `Amount must be between $${MIN_TRITON_TRANSFER_AMOUNT} and $${MAX_TRITON_TRANSFER_AMOUNT}.`,
      },
    };
  }

  try {
    const { data, error } = await supabase
      .from('triton_transfer_requests')
      .insert({
        user_id: uid,
        direction,
        amount: amt,
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) {
      void logOperationalError({
        category: 'triton.transfer_request_insert',
        message: error.message || 'triton_transfer_requests insert failed',
        userId: uid,
        route: '/triton-transfer',
        metadata: {
          code: error.code ?? null,
          direction,
          amountBucket: amountBucketFor(amt),
        },
      });
      return { data: null, error: { message: 'Could not submit your transfer request. Try again shortly.' } };
    }

    return { data, error: null };
  } catch (e) {
    void logOperationalError({
      category: 'triton.transfer_request_insert',
      message: e?.message || 'triton_transfer_requests insert threw',
      userId: uid,
      route: '/triton-transfer',
      metadata: {
        direction,
        amountBucket: amountBucketFor(amt),
      },
    });
    return { data: null, error: { message: 'Could not submit your transfer request. Try again shortly.' } };
  }
}

/**
 * List the signed-in user's own transfer requests (RLS: own rows).
 * @param {string} userId
 * @param {number} [limit]
 * @returns {Promise<{ rows: Record<string, unknown>[]; error: { message: string } | null }>}
 */
export async function fetchUserTritonTransferRequests(userId, limit = 20) {
  const uid = typeof userId === 'string' ? userId.trim() : '';
  if (!uid) {
    return { rows: [], error: null };
  }
  const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), 200) : 20;

  try {
    const { data, error } = await supabase
      .from('triton_transfer_requests')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      void logOperationalEvent({
        level: 'warn',
        category: 'triton.transfer_list_user',
        message: error.message || 'triton_transfer_requests user list failed',
        userId: uid,
        route: '/triton-transfer',
        metadata: { code: error.code ?? null },
      });
      return { rows: [], error: { message: 'Could not load your transfer requests.' } };
    }
    return { rows: Array.isArray(data) ? data : [], error: null };
  } catch (e) {
    void logOperationalEvent({
      level: 'warn',
      category: 'triton.transfer_list_user',
      message: e?.message || 'triton_transfer_requests user list threw',
      userId: uid,
      route: '/triton-transfer',
      metadata: {},
    });
    return { rows: [], error: { message: 'Could not load your transfer requests.' } };
  }
}

/**
 * Admin view of the queue. Filters are optional.
 * @param {{ status?: string | null; direction?: string | null; limit?: number }} [args]
 * @returns {Promise<{ rows: Record<string, unknown>[]; error: { message: string } | null }>}
 */
export async function fetchAdminTritonTransferRequests({
  status = null,
  direction = null,
  limit = 200,
} = {}) {
  const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), 500) : 200;

  try {
    let query = supabase
      .from('triton_transfer_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (status && isAllowedStatus(status)) {
      query = query.eq('status', status);
    }
    if (direction && isAllowedDirection(direction)) {
      query = query.eq('direction', direction);
    }

    const { data, error } = await query;
    if (error) {
      void logOperationalEvent({
        level: 'warn',
        category: 'triton.transfer_list_admin',
        message: error.message || 'triton_transfer_requests admin list failed',
        route: '/admin/triton-transfers',
        metadata: { code: error.code ?? null },
      });
      return { rows: [], error: { message: 'Could not load the transfer queue.' } };
    }
    return { rows: Array.isArray(data) ? data : [], error: null };
  } catch (e) {
    void logOperationalEvent({
      level: 'warn',
      category: 'triton.transfer_list_admin',
      message: e?.message || 'triton_transfer_requests admin list threw',
      route: '/admin/triton-transfers',
      metadata: {},
    });
    return { rows: [], error: { message: 'Could not load the transfer queue.' } };
  }
}

/**
 * Admin status update. Builds a sparse payload — only fields the caller provided
 * are sent. `processed_at` / `processed_by` are stamped automatically for any
 * non-pending target status.
 *
 * @param {{
 *   id: string;
 *   status: 'pending' | 'processing' | 'completed' | 'rejected' | 'cancelled';
 *   adminNote?: string | null;
 *   tritonReference?: string | null;
 *   processedByUserId?: string | null;
 *   previousStatusForAudit?: string | null;
 * }} params
 * @returns {Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>}
 */
export async function updateTritonTransferStatus({
  id,
  status,
  adminNote,
  tritonReference,
  processedByUserId,
  previousStatusForAudit,
}) {
  const transferId = typeof id === 'string' ? id.trim() : '';
  if (!transferId) {
    return { data: null, error: { message: 'Missing request id.' } };
  }
  if (!isAllowedStatus(status)) {
    return { data: null, error: { message: 'Invalid status.' } };
  }

  /** @type {Record<string, unknown>} */
  const payload = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (adminNote !== undefined) {
    payload.admin_note = clampString(adminNote, 1000);
  }
  if (tritonReference !== undefined) {
    payload.triton_reference = clampString(tritonReference, 120);
  }

  if (PROCESSED_STATUSES.has(status)) {
    payload.processed_at = new Date().toISOString();
    payload.processed_by = typeof processedByUserId === 'string' && processedByUserId.trim()
      ? processedByUserId.trim()
      : null;
  }

  try {
    const { data, error } = await supabase
      .from('triton_transfer_requests')
      .update(payload)
      .eq('id', transferId)
      .select('*')
      .single();

    if (error) {
      void logOperationalError({
        category: 'triton.transfer_admin_update',
        message: error.message || 'triton_transfer_requests update failed',
        userId: typeof processedByUserId === 'string' ? processedByUserId : null,
        route: '/admin/triton-transfers',
        metadata: {
          code: error.code ?? null,
          transferId,
          targetStatus: status,
        },
      });
      return { data: null, error: { message: 'Could not update the transfer request.' } };
    }

    const prev =
      typeof previousStatusForAudit === 'string' ? previousStatusForAudit.trim().toLowerCase() : '';
    if (prev && data && typeof data === 'object' && data.id) {
      const uid = typeof data.user_id === 'string' && data.user_id.trim() ? data.user_id.trim() : null;
      void appendAuditEvent({
        entityType: 'triton_transfer',
        entityId: transferId,
        eventType: 'triton.status_changed',
        actorUserId: typeof processedByUserId === 'string' && processedByUserId.trim() ? processedByUserId.trim() : null,
        targetUserId: uid,
        severity: status === 'completed' ? 'success' : status === 'rejected' ? 'warning' : 'info',
        title: 'Triton transfer status changed',
        description: `Status ${prev} → ${status}.`,
        metadata: { from_status: prev, to_status: status },
        dedupeKey: `audit:triton_transfer:${transferId}:${prev}:${status}`,
        dedupeWindowMs: 6 * 60 * 1000,
      });
    }

    return { data, error: null };
  } catch (e) {
    void logOperationalError({
      category: 'triton.transfer_admin_update',
      message: e?.message || 'triton_transfer_requests update threw',
      userId: typeof processedByUserId === 'string' ? processedByUserId : null,
      route: '/admin/triton-transfers',
      metadata: {
        transferId,
        targetStatus: status,
      },
    });
    return { data: null, error: { message: 'Could not update the transfer request.' } };
  }
}

function notificationMessageFor(status) {
  switch (status) {
    case 'processing':
      return 'Your Triton transfer request is now being processed.';
    case 'completed':
      return 'Your Triton transfer request has been completed.';
    case 'rejected':
      return 'Your Triton transfer request was rejected. Contact support if you have questions.';
    case 'cancelled':
      return 'Your Triton transfer request was cancelled.';
    default:
      return `Your Triton transfer request status is now ${status}.`;
  }
}

/**
 * Best-effort end-user notification after an admin status change. Never throws.
 * The notifications table likely has a CHECK constraint on `type` (see
 * supabase/sql/notifications_withdrawal_status_types.sql). If the new type is
 * rejected, we log a warn under `notification.triton_transfer_skipped` and exit
 * — the admin update itself is unaffected.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient | null | undefined} supabaseClient
 * @param {{ transferId: string; userId: string; status: string }} params
 */
export async function notifyTritonTransferStatus(supabaseClient, { transferId, userId, status }) {
  const client = supabaseClient || supabase;
  const uid = typeof userId === 'string' ? userId.trim() : '';
  if (!client || !uid || !isAllowedStatus(status)) return;

  try {
    const { error } = await client.rpc('create_notification', {
      p_user_id: uid,
      p_type: 'triton_transfer_update',
      p_message: notificationMessageFor(status),
      p_title: `Triton transfer ${status}`,
      p_related_transaction_id: null,
    });
    if (error) {
      void logOperationalEvent({
        level: 'warn',
        category: 'notification.triton_transfer_skipped',
        message: error.message || 'create_notification triton_transfer_update rejected',
        userId: uid,
        route: '/admin/triton-transfers',
        metadata: {
          code: error.code ?? null,
          transferId: typeof transferId === 'string' ? transferId : null,
          targetStatus: status,
        },
      });
      void appendAuditEvent({
        entityType: 'notification',
        entityId: uid,
        eventType: 'notification.create_failed',
        targetUserId: uid,
        severity: 'warning',
        title: 'Triton transfer notification failed',
        description: 'create_notification rejected for triton transfer update.',
        metadata: {
          code: error.code ?? null,
          transferId: typeof transferId === 'string' ? transferId : null,
          targetStatus: status,
        },
        dedupeKey: `audit:notification:triton:${uid}:${String(transferId)}:${status}`,
        dedupeWindowMs: 8 * 60 * 1000,
      });
    }
  } catch (e) {
    void logOperationalEvent({
      level: 'warn',
      category: 'notification.triton_transfer_skipped',
      message: e?.message || 'create_notification triton_transfer_update threw',
      userId: uid,
      route: '/admin/triton-transfers',
      metadata: {
        transferId: typeof transferId === 'string' ? transferId : null,
        targetStatus: status,
      },
    });
  }
}

/** Inline pill style for transfer status (mirrors withdrawalStatusBadgeStyle). */
export function tritonTransferStatusBadgeStyle(status) {
  const v = String(status || '').toLowerCase();
  const base = {
    display: 'inline-block',
    padding: '0.22rem 0.55rem',
    borderRadius: '999px',
    fontSize: '0.68rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
    maxWidth: '100%',
  };
  if (v === 'pending') {
    return { ...base, background: '#fffbeb', color: '#9a3412', border: '1px solid #fcd34d' };
  }
  if (v === 'processing') {
    return { ...base, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' };
  }
  if (v === 'completed') {
    return { ...base, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' };
  }
  if (v === 'rejected') {
    return { ...base, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' };
  }
  if (v === 'cancelled') {
    return { ...base, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
  }
  return { ...base, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' };
}
