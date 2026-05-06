import { applyPayPalWebhookToWithdrawal } from "./payoutService";

/**
 * PayPal webhook (REST) event handling for payouts.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {{ eventId: string; eventType: string; resource: Record<string, unknown>; rawEvent: Record<string, unknown> }} payload
 * @returns {Promise<{ matchedWithdrawalId: string | null; skipped?: string }>}
 */
export async function handlePayPalWebhookEvent(supabaseAdmin, payload) {
  const { eventType, resource, rawEvent } = payload;
  const type = String(eventType || "");

  const batchId = extractBatchId(resource);
  const itemId = extractItemId(resource);

  const row = await findWithdrawalRow(supabaseAdmin, { batchId, itemId });
  if (!row?.id) {
    console.warn("[paypal-webhook] no matching withdrawal for", { type, batchId, itemId });
    return { matchedWithdrawalId: null };
  }

  const result = await applyPayPalWebhookToWithdrawal(supabaseAdmin, row, {
    eventType: type,
    resource: resource && typeof resource === "object" ? resource : {},
    rawEvent: rawEvent && typeof rawEvent === "object" ? rawEvent : {},
    batchId,
    itemId,
  });

  return { matchedWithdrawalId: row.id, ...result };
}

function extractBatchId(resource) {
  if (!resource || typeof resource !== "object") return null;
  const bh = resource.batch_header;
  if (bh && typeof bh === "object" && typeof bh.payout_batch_id === "string") return bh.payout_batch_id;
  if (typeof resource.payout_batch_id === "string") return resource.payout_batch_id;
  return null;
}

function extractItemId(resource) {
  if (!resource || typeof resource !== "object") return null;
  if (typeof resource.payout_item_id === "string") return resource.payout_item_id;
  const pi = resource.payout_item;
  if (pi && typeof pi === "object" && typeof pi.payout_item_id === "string") return pi.payout_item_id;
  return null;
}

async function findWithdrawalRow(supabaseAdmin, { batchId, itemId }) {
  if (itemId) {
    const { data, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .eq("processor_item_id", itemId)
      .limit(2);
    if (error) {
      console.error("[paypal-webhook] find by item:", error);
      return null;
    }
    if (data?.length === 1) return data[0];
  }
  if (batchId) {
    const { data, error } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("*")
      .eq("processor_batch_id", batchId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) {
      console.error("[paypal-webhook] find by batch:", error);
      return null;
    }
    if (data?.length === 1) return data[0];
    if (data?.length > 1) {
      console.warn("[paypal-webhook] ambiguous batch match; using newest row", batchId);
      return data[0];
    }
  }
  return null;
}
