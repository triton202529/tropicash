import { supabase } from './supabaseClient';
import { ADMIN_EMAILS } from './adminAccess';

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

  return { data, error };
}

/**
 * Notify primary admin (first ADMIN_EMAILS) of a new withdrawal request. Does not throw.
 * @param {number} amount
 */
export async function notifyAdminNewWithdrawalRequest(amount) {
  const adminEmail = String(ADMIN_EMAILS[0] || '')
    .trim()
    .toLowerCase();
  if (!adminEmail) {
    console.warn('[withdrawal] admin notification skipped: admin user id unavailable');
    return;
  }

  const { data: adminProfile, error: profErr } = await supabase
    .from('profiles')
    .select('id')
    .ilike('email', adminEmail)
    .maybeSingle();

  if (profErr) {
    console.warn('[withdrawal] admin notification skipped: admin profile lookup failed', profErr);
    return;
  }

  const adminId = adminProfile?.id;
  if (!adminId) {
    console.warn('[withdrawal] admin notification skipped: admin user id unavailable');
    return;
  }

  const amtText = formatMoneyForMessage(amount);
  const { error } = await supabase.rpc('create_notification', {
    p_user_id: adminId,
    p_type: 'admin_withdrawal_request',
    p_message: `New withdrawal request for $${amtText}`,
    p_title: 'New withdrawal request',
    p_related_transaction_id: null,
  });

  if (error) {
    console.error('[withdrawal] admin create_notification failed:', error);
  }
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
    return { rows: [], error };
  }

  const rows = (data || []).filter((r) => r && r.user_id === userId);
  return { rows, error: null };
}

/**
 * Notify the end user after admin changes withdrawal status. Does not throw.
 * @param {{ userId: string; amount: number; kind: 'processing' | 'paid' | 'rejected' }} params
 */
export async function notifyUserWithdrawalStatusChange(params) {
  const { userId, amount, kind } = params;
  if (!userId || !kind) return;

  const amtText = formatMoneyForMessage(amount);
  const cfg =
    kind === 'processing'
      ? {
          p_type: 'withdrawal_processing',
          p_title: 'Withdrawal processing',
          p_message: `Your withdrawal of $${amtText} is now being processed.`,
        }
      : kind === 'paid'
        ? {
            p_type: 'withdrawal_paid',
            p_title: 'Withdrawal paid',
            p_message: `Your withdrawal of $${amtText} has been paid.`,
          }
        : kind === 'rejected'
          ? {
              p_type: 'withdrawal_rejected',
              p_title: 'Withdrawal rejected',
              p_message: `Your withdrawal of $${amtText} was rejected. Please contact support.`,
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

