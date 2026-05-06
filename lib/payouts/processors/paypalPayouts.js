import { getPayPalAccessToken, getPayPalApiBase } from "../../paypal";

/**
 * @param {string} withdrawalRequestId - Correlates sender_batch_id / sender_item_id
 * @param {{ amountUsd: string; receiverEmail: string; note?: string }} params
 * @param {string} [idempotencyKey] - PayPal-Request-Id header (defaults to withdrawalRequestId)
 * @returns {Promise<{
 *   batchId: string | null;
 *   itemId: string | null;
 *   batchStatus: string | null;
 *   httpStatus: number;
 *   raw: Record<string, unknown>;
 * }>}
 */
export async function createPayPalPayoutBatch(withdrawalRequestId, params, idempotencyKey) {
  const { amountUsd, receiverEmail, note } = params;
  const token = await getPayPalAccessToken();
  const base = getPayPalApiBase();
  const paypalRequestId = String(idempotencyKey || withdrawalRequestId).slice(0, 127);
  const payoutCurrency = String(process.env.PAYPAL_PAYOUT_CURRENCY || "USD").trim() || "USD";

  const senderEmail = String(process.env.PAYPAL_PAYOUTS_SENDER_EMAIL || "").trim();
  const senderBatchHeader = {
    sender_batch_id: `tropicash_${withdrawalRequestId}`.slice(0, 50),
    email_subject: "You have a payout from Tropicash",
    email_message: "Your withdrawal payout has been sent.",
    ...(senderEmail ? { sender_email: senderEmail } : {}),
  };

  const body = {
    sender_batch_header: senderBatchHeader,
    items: [
      {
        recipient_type: "EMAIL",
        amount: {
          value: Number(amountUsd).toFixed(2),
          currency: payoutCurrency,
        },
        receiver: receiverEmail,
        note: note || "Tropicash withdrawal payout",
        sender_item_id: `wr_${withdrawalRequestId}`.slice(0, 50),
      },
    ],
  };

  const res = await fetch(`${base}/v1/payments/payouts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": paypalRequestId,
    },
    body: JSON.stringify(body),
  });

  const raw = (await res.json().catch(() => ({}))) || {};
  const bh = raw.batch_header && typeof raw.batch_header === "object" ? raw.batch_header : {};
  const batchId =
    (typeof bh.payout_batch_id === "string" && bh.payout_batch_id) ||
    (typeof raw.payout_batch_id === "string" && raw.payout_batch_id) ||
    null;
  const batchStatus =
    (typeof bh.batch_status === "string" && bh.batch_status) ||
    (typeof raw.batch_status === "string" && raw.batch_status) ||
    null;

  let itemId = null;
  const items = raw.items;
  if (Array.isArray(items) && items[0]) {
    const it = items[0];
    itemId =
      (typeof it.payout_item_id === "string" && it.payout_item_id) ||
      (typeof it.payout_item?.payout_item_id === "string" && it.payout_item.payout_item_id) ||
      null;
  }

  return {
    batchId,
    itemId,
    batchStatus,
    httpStatus: res.status,
    raw: typeof raw === "object" && raw !== null ? raw : {},
  };
}

/**
 * GET batch details for reconciliation.
 * @param {string} batchId
 * @returns {Promise<{
 *   httpStatus: number;
 *   batchStatus: string | null;
 *   batchId: string | null;
 *   items: unknown[];
 *   raw: Record<string, unknown>;
 * }>}
 */
export async function getPayPalPayoutBatch(batchId) {
  if (!batchId || typeof batchId !== "string") {
    throw new Error("batchId is required");
  }
  const token = await getPayPalAccessToken();
  const base = getPayPalApiBase();
  const encoded = encodeURIComponent(batchId);
  const res = await fetch(`${base}/v1/payments/payouts/${encoded}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const raw = (await res.json().catch(() => ({}))) || {};
  const bh = raw.batch_header && typeof raw.batch_header === "object" ? raw.batch_header : {};
  const resolvedBatchId =
    (typeof bh.payout_batch_id === "string" && bh.payout_batch_id) ||
    (typeof raw.payout_batch_id === "string" && raw.payout_batch_id) ||
    batchId;
  const batchStatus =
    (typeof bh.batch_status === "string" && bh.batch_status) ||
    (typeof raw.batch_status === "string" && raw.batch_status) ||
    null;
  const items = Array.isArray(raw.items) ? raw.items : [];
  return {
    httpStatus: res.status,
    batchStatus,
    batchId: resolvedBatchId,
    items,
    raw: typeof raw === "object" && raw !== null ? raw : {},
  };
}
