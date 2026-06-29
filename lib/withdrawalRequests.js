import { supabase } from './supabaseClient';
import { createSupabaseServiceClient } from './supabaseAdminApi';
import { resolvePrimaryAdminUserId } from './adminMembers';
import { logOperationalError } from './operationalLogger';
import { emitEvent } from './eventBus';

function formatMoneyForMessage(value) {
  const n = Number(value);
  return Number(Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Log a beta manual payout request after wallet RPC succeeds.
 * @param {{ userId: string; amount: number; payoutMethodId: string | null; payoutLabel: string | null; payoutEmail?: string | null }} params
 */
export async function insertWithdrawalRequestAfterWalletDebit(params) {
  const { userId, amount, payoutMethodId, payoutLabel, payoutEmail } = params;

  const row = {
    user_id: userId,
    amount,
    payout_method_id: payoutMethodId || null,
    payout_label: payoutLabel || null,
    status: 'pending',
  };
  if (payoutEmail != null && String(payoutEmail).trim()) {
    row.payout_email = String(payoutEmail).trim();
    row.payout_destination = String(payoutEmail).trim();
  }

  const { data, error } = await supabase.from('withdrawal_requests').insert(row).select('id').single();

  if (error) {
    void logOperationalError({
      category: 'withdrawal.request_insert',
      message: error.message || 'withdrawal_requests insert failed',
      userId,
      route: null,
      metadata: { code: error.code },
    });
  }

  return { data, error };
}

/**
 * Notify primary admin (admin_members table) of a new withdrawal request. Does not throw.
 * @param {number} amount
 * @param {{ requesterUserId?: string }} [opts] Used only for operational logging on failure (RLS-safe user_id).
 */
export async function notifyAdminNewWithdrawalRequest(amount, opts = {}) {
  const requesterUserId = opts.requesterUserId && typeof opts.requesterUserId === 'string' ? opts.requesterUserId : null;
  const adminClient = createSupabaseServiceClient() || supabase;
  const adminId = await resolvePrimaryAdminUserId(adminClient);
  if (!adminId) {
    console.warn('[withdrawal] admin notification skipped: no admin_members row');
    return;
  }

  const amtText = formatMoneyForMessage(amount);
  const { error } = await adminClient.rpc('create_notification', {
    p_user_id: adminId,
    p_type: 'admin_withdrawal_request',
    p_message: `New withdrawal request for $${amtText}`,
    p_title: 'New withdrawal request',
    p_related_transaction_id: null,
  });

  if (error) {
    console.error('[withdrawal] admin create_notification failed:', error);
    if (requesterUserId) {
      void logOperationalError({
        category: 'notification.admin_withdrawal_alert',
        message: error.message || 'create_notification for admin withdrawal alert failed',
        userId: requesterUserId,
        route: null,
        metadata: { code: error.code, targetAdminId: adminId },
      });
    }
  }

  void emitEvent({
    targetUserId: adminId,
    eventType: 'withdrawal.request_submitted',
    category: 'treasury',
    severity: 'info',
    title: 'New withdrawal request',
    message: `Treasury queue: a new request for $${amtText} is pending review.`,
    actorUserId: requesterUserId,
    metadata: { amountText: amtText, requesterUserId: requesterUserId || null },
  });
}

/**
 * @param {string} userId
 * @param {number} [limit]
 * @returns {Promise<{ rows: Record<string, unknown>[]; error: import('@supabase/supabase-js').PostgrestError | null }>}
 */
export async function fetchUserWithdrawalRequests(userId, limit = 20) {
  if (!userId) {
    return { rows: [], error: null };
  }

  const { data, error } = await supabase
    .from('withdrawal_requests')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[withdrawalRequests] fetchUserWithdrawalRequests:', error);
    void logOperationalError({
      category: 'withdrawal.list_fetch',
      message: error.message || 'withdrawal_requests select failed',
      userId,
      route: null,
      metadata: { code: error.code },
    });
    return { rows: [], error };
  }

  const rows = (data || []).filter((r) => r && r.user_id === userId);
  return { rows, error: null };
}

/** User-facing line for withdrawal request status (wallet / activity). */
export function withdrawalStatusUserLine(status) {
  const v = String(status || '').toLowerCase();
  if (v === 'pending') return 'Pending payout';
  if (v === 'processing') return 'Processing';
  if (v === 'paid') return 'Paid';
  if (v === 'failed') return 'Payout failed — contact support';
  if (v === 'rejected') return 'Rejected';
  return v ? String(status) : '—';
}

/** Inline badge styles for withdrawal status (wallet cards). */
export function withdrawalStatusBadgeStyle(status) {
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
  if (v === 'paid') {
    return { ...base, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' };
  }
  if (v === 'failed') {
    return { ...base, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' };
  }
  if (v === 'rejected') {
    return { ...base, background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
  }
  return { ...base, background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' };
}

/**
 * Short user-safe failure text (avoid dumping raw JSON when possible).
 * @param {string | null | undefined} failureReason
 */
/**
 * Parse withdrawal request UUID embedded in transaction note/description (Phase 13D).
 * @param {Record<string, unknown> | null | undefined} txn
 * @returns {string | null}
 */
export function extractWithdrawalRequestIdFromTransaction(txn) {
  if (!txn || typeof txn !== "object") return null;
  const blob = [txn.note, txn.description, txn.message, txn.memo, txn.reference]
    .filter((v) => v != null && String(v).trim() !== "")
    .map((v) => String(v))
    .join(" ");
  if (!blob) return null;
  const m = blob.match(
    /(?:withdrawal request|request|id)\s*(?:·|\u00b7|:)?\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
  );
  return m ? m[1] : null;
}

/**
 * @param {Record<string, unknown> | null | undefined} txn
 * @param {Record<string, unknown>[] | null | undefined} withdrawalRows
 */
export function findWithdrawalMatchForRefundTransaction(txn, withdrawalRows) {
  const rawType = String(txn?.type || "").toLowerCase();
  if (rawType !== "withdrawal_refund") return null;
  const list = Array.isArray(withdrawalRows) ? withdrawalRows : [];
  const parsedId = extractWithdrawalRequestIdFromTransaction(txn);
  if (parsedId) {
    const byId = list.find((w) => w && String(w.id) === parsedId);
    if (byId) return byId;
  }
  const blob = [txn?.note, txn?.description].filter(Boolean).join(" ");
  const debitMatch = blob.match(/debit txn\s+([0-9a-f-]{36})/i);
  if (debitMatch) {
    const byDebit = list.find(
      (w) => w?.withdrawal_transaction_id && String(w.withdrawal_transaction_id) === debitMatch[1],
    );
    if (byDebit) return byDebit;
  }
  return null;
}

/**
 * Best-effort link from a `withdraw_wallet` transaction row to `withdrawal_requests`.
 * Prefers withdrawal_transaction_id, then embedded request id, then amount/time fuzzy match.
 * @param {Record<string, unknown>} txn
 * @param {Record<string, unknown>[] | null | undefined} withdrawalRows
 * @param {string} currentUserId
 */
export function findWithdrawalMatchForWithdrawTransaction(txn, withdrawalRows, currentUserId) {
  const rawType = String(txn?.type || "").toLowerCase();
  const isWithdraw = rawType === "withdraw_wallet" || rawType === "withdraw";
  if (!isWithdraw) return null;
  const list = Array.isArray(withdrawalRows) ? withdrawalRows : [];

  const byTxLink = list.find(
    (w) =>
      w &&
      String(w.user_id) === String(currentUserId) &&
      w.withdrawal_transaction_id &&
      String(w.withdrawal_transaction_id) === String(txn.id),
  );
  if (byTxLink) return byTxLink;

  const parsedId = extractWithdrawalRequestIdFromTransaction(txn);
  if (parsedId) {
    const byId = list.find((w) => w && String(w.user_id) === String(currentUserId) && String(w.id) === parsedId);
    if (byId) return byId;
  }

  const amt = Number(txn.amount);
  if (!Number.isFinite(amt)) return null;
  const tTime = new Date(txn.created_at).getTime();
  if (Number.isNaN(tTime)) return null;
  const candidates = list.filter((w) => {
    if (!w || String(w.user_id) !== String(currentUserId)) return false;
    const wAmt = Number(w.amount);
    if (!Number.isFinite(wAmt) || Math.abs(wAmt - amt) > 0.02) return false;
    return true;
  });
  if (!candidates.length) return null;
  let best = null;
  let bestDiff = Infinity;
  for (const w of candidates) {
    const wTime = new Date(w.created_at).getTime();
    const diff = Number.isNaN(wTime) ? Infinity : Math.abs(wTime - tTime);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = w;
    }
  }
  if (!best || bestDiff > 36 * 60 * 60 * 1000) return null;
  return best;
}

export function formatWithdrawalFailureForUser(failureReason) {
  if (failureReason == null) return '';
  const s = String(failureReason).trim();
  if (!s) return '';
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s);
      if (o && typeof o === 'object') {
        const name = o.name != null ? String(o.name) : '';
        const msg = o.message != null ? String(o.message) : '';
        if (name && msg) return `${name}: ${msg}`;
        if (msg) return msg;
        if (name) return name;
      }
    } catch {
      /* fall through */
    }
  }
  return s.length > 280 ? `${s.slice(0, 280)}…` : s;
}

function clipText(s, max = 220) {
  const t = String(s || '').trim();
  if (!t) return '';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/**
 * Notify the end user after admin changes withdrawal status. Does not throw.
 * @param {{
 *   userId: string;
 *   amount: number;
 *   kind: 'processing' | 'paid' | 'rejected';
 *   paidVia?: string | null;
 *   externalReference?: string | null;
 *   rejectionReason?: string | null;
 * }} params
 */
export async function notifyUserWithdrawalStatusChange(params) {
  const { userId, amount, kind, paidVia, externalReference, rejectionReason } = params;
  if (!userId || !kind) return;

  const amtText = formatMoneyForMessage(amount);
  const via = paidVia != null ? String(paidVia).trim() : '';
  const ref = externalReference != null ? String(externalReference).trim() : '';
  const rej = clipText(rejectionReason);

  const cfg =
    kind === 'processing'
      ? {
          p_type: 'withdrawal_processing',
          p_title: 'Withdrawal in review',
          p_message:
            'Your withdrawal request is being reviewed. Tropicash will update you when the payout moves forward.',
        }
      : kind === 'paid'
        ? {
            p_type: 'withdrawal_paid',
            p_title: 'Withdrawal marked paid',
            p_message:
              via || ref
                ? `Your withdrawal of $${amtText} was marked paid${via ? ` (${via})` : ''}${ref ? `. Reference: ${ref}` : '.'}`
                : `Your withdrawal of $${amtText} was marked paid. If you do not see the funds yet, check with your payout provider.`,
          }
        : kind === 'rejected'
          ? {
              p_type: 'withdrawal_rejected',
              p_title: 'Withdrawal rejected',
              p_message: rej
                ? `Your withdrawal of $${amtText} was rejected. Reason: ${rej}`
                : `Your withdrawal of $${amtText} was rejected. Please contact support if you have questions.`,
            }
          : null;

  if (!cfg) return;

  try {
    const { error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: cfg.p_type,
      p_message: cfg.p_message,
      p_title: cfg.p_title,
      p_related_transaction_id: null,
    });
    if (error) {
      console.error('[withdrawal] user status create_notification failed:', error);
    }
  } catch (err) {
    console.error('[withdrawal] user status create_notification failed:', err);
  }
}

