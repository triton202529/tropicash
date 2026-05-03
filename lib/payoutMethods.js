import { supabase } from './supabaseClient';

/** Human-readable destination for withdraw UI (label, or "Brand ending 1234"). */
export function formatPayoutDestinationDisplay(row) {
  if (!row) return '';
  const label = String(row.payout_label || '').trim();
  if (label) return label;
  const brand = String(row.brand || 'Card').trim() || 'Card';
  const last4 = String(row.last4 || '').trim() || '????';
  return `${brand} ending ${last4}`;
}

export async function fetchPayoutMethodsForUser(userId) {
  const { data, error } = await supabase
    .from('payout_methods')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[payoutMethods] fetchPayoutMethodsForUser', error);
    return { rows: [], error };
  }
  return { rows: data || [], error: null };
}

export async function fetchDefaultPayoutMethod(userId) {
  const { data, error } = await supabase
    .from('payout_methods')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) {
    console.error('[payoutMethods] fetchDefaultPayoutMethod', error);
    return { row: null, error };
  }
  return { row: data, error: null };
}

async function clearDefaultFlagsForUser(userId, exceptId) {
  let q = supabase.from('payout_methods').update({ is_default: false }).eq('user_id', userId);
  if (exceptId) {
    q = q.neq('id', exceptId);
  }
  const { error } = await q;
  if (error) {
    console.error('[payoutMethods] clearDefaultFlagsForUser', error);
  }
}

/**
 * @param {string} userId
 * @param {{ cardholder_name: string; brand: string; last4: string; payout_label?: string }} payload
 * @param {string | null | undefined} existingId
 */
export async function savePayoutMethodForUser(userId, payload, existingId) {
  const cardholder_name = String(payload.cardholder_name || '').trim();
  const brand = String(payload.brand || '').trim();
  const payout_label = String(payload.payout_label || '').trim();
  const last4digits = String(payload.last4 || '').replace(/\D/g, '').slice(0, 4);

  if (!cardholder_name) {
    return { data: null, error: new Error('Cardholder name is required.') };
  }
  if (!brand) {
    return { data: null, error: new Error('Card brand is required.') };
  }
  if (last4digits.length !== 4) {
    return { data: null, error: new Error('Enter exactly 4 digits (last 4 of the card).') };
  }

  if (existingId) {
    await clearDefaultFlagsForUser(userId, existingId);
    const { data, error } = await supabase
      .from('payout_methods')
      .update({
        cardholder_name,
        brand,
        last4: last4digits,
        payout_label: payout_label || null,
        is_default: true,
      })
      .eq('id', existingId)
      .eq('user_id', userId)
      .select('*')
      .single();
    return { data, error };
  }

  await clearDefaultFlagsForUser(userId, null);

  const { data, error } = await supabase
    .from('payout_methods')
    .insert({
      user_id: userId,
      type: 'card',
      cardholder_name,
      brand,
      last4: last4digits,
      payout_label: payout_label || null,
      is_default: true,
    })
    .select('*')
    .single();

  return { data, error };
}
