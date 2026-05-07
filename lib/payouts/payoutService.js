import { createPayPalPayoutBatch, getPayPalPayoutBatch } from "./processors/paypalPayouts";
import {
  buildPayPalPayoutErrorDetails,
  buildPayPalPayoutErrorFromException,
  stringifyFailureReason,
  throwPayPalPayoutFailed,
} from "./paypalErrorPayload";

/**
 * Interpret PayPal GET /v1/payments/payouts/{id} (or create response) JSON.
 * @param {Record<string, unknown>} raw
 * @returns {{
 *   nextStatus: 'paid' | 'failed' | 'processing';
 *   processorStatus: string;
 *   failureReason: string | null;
 *   externalRef: string | null;
 * }}
 */
export function interpretPayPalPayoutBatchRaw(raw) {
  if (!raw || typeof raw !== "object") {
    return { nextStatus: "processing", processorStatus: "unknown", failureReason: null, externalRef: null };
  }
  const bh = raw.batch_header && typeof raw.batch_header === "object" ? raw.batch_header : {};
  const batchStatus = String(bh.batch_status || raw.batch_status || "").toUpperCase();
  const batchId =
    (typeof bh.payout_batch_id === "string" && bh.payout_batch_id) ||
    (typeof raw.payout_batch_id === "string" && raw.payout_batch_id) ||
    null;

  const items = Array.isArray(raw.items) ? raw.items : [];
  let hasItemSuccess = false;
  /** @type {string | null} */
  let terminalItemReason = null;

  for (const it of items) {
    const row = it?.payout_item && typeof it.payout_item === "object" ? it.payout_item : it;
    const ts = String(row?.transaction_status || "").toUpperCase();
    if (ts === "SUCCESS") hasItemSuccess = true;
    if (["FAILED", "DENIED", "RETURNED", "BLOCKED", "CANCELED", "REFUNDED"].includes(ts)) {
      terminalItemReason = ts;
    }
  }

  if (batchStatus === "DENIED" || batchStatus === "CANCELED") {
    return {
      nextStatus: "failed",
      processorStatus: batchStatus.toLowerCase(),
      failureReason: `PayPal batch status: ${batchStatus}`,
      externalRef: batchId,
    };
  }

  if (batchStatus === "SUCCESS" || hasItemSuccess) {
    return {
      nextStatus: "paid",
      processorStatus: "success",
      failureReason: null,
      externalRef: batchId,
    };
  }

  if (terminalItemReason) {
    return {
      nextStatus: "failed",
      processorStatus: terminalItemReason.toLowerCase(),
      failureReason: `PayPal payout item status: ${terminalItemReason}`,
      externalRef: batchId,
    };
  }

  const proc = batchStatus || "PROCESSING";
  return {
    nextStatus: "processing",
    processorStatus: proc.toLowerCase(),
    failureReason: null,
    externalRef: batchId,
  };
}

/**
 * Map webhook event type + resource to withdrawal state.
 * @param {{ eventType: string; resource: Record<string, unknown> }} ctx
 */
function deriveFromPayPalWebhook(ctx) {
  const eventType = String(ctx.eventType || "");
  const r = ctx.resource && typeof ctx.resource === "object" ? ctx.resource : {};
  const batchHeader = r.batch_header && typeof r.batch_header === "object" ? r.batch_header : {};
  const batchStatus = String(batchHeader.batch_status || r.batch_status || "").toUpperCase();
  const itemStatus = String(r.transaction_status || "").toUpperCase();

  const summaryBits = [];
  if (batchStatus) summaryBits.push(`batch=${batchStatus}`);
  if (itemStatus) summaryBits.push(`item=${itemStatus}`);
  const summary = summaryBits.length ? summaryBits.join(" ") : eventType;

  /** @type {'paid' | 'failed' | 'processing'} */
  let nextStatus = "processing";
  /** @type {string} */
  let processorStatus = itemStatus || batchStatus || "processing";
  /** @type {string | null} */
  let failureReason = null;

  switch (eventType) {
    case "PAYMENT.PAYOUTSBATCH.SUCCESS":
      if (batchStatus === "SUCCESS" || !batchStatus) {
        nextStatus = "paid";
        processorStatus = "success";
      } else {
        nextStatus = "processing";
        processorStatus = batchStatus.toLowerCase() || "processing";
      }
      break;
    case "PAYMENT.PAYOUTSBATCH.DENIED":
      nextStatus = "failed";
      processorStatus = "denied";
      failureReason = `PayPal: ${summary}`;
      break;
    case "PAYMENT.PAYOUTSBATCH.PROCESSING":
      nextStatus = "processing";
      processorStatus = batchStatus ? batchStatus.toLowerCase() : "processing";
      break;
    case "PAYMENT.PAYOUTS-ITEM.SUCCEEDED":
      nextStatus = "paid";
      processorStatus = "succeeded";
      break;
    case "PAYMENT.PAYOUTS-ITEM.FAILED":
    case "PAYMENT.PAYOUTS-ITEM.RETURNED":
    case "PAYMENT.PAYOUTS-ITEM.BLOCKED":
    case "PAYMENT.PAYOUTS-ITEM.CANCELED":
      nextStatus = "failed";
      processorStatus = eventType.split(".").pop()?.toLowerCase() || "failed";
      failureReason = `PayPal: ${summary}`;
      break;
    case "PAYMENT.PAYOUTS-ITEM.HELD":
    case "PAYMENT.PAYOUTS-ITEM.UNCLAIMED":
      nextStatus = "processing";
      processorStatus = itemStatus ? itemStatus.toLowerCase() : "processing";
      break;
    default:
      return null;
  }

  return { nextStatus, processorStatus, failureReason, summary };
}

function isPaidDowngradeAllowed(eventType) {
  const t = String(eventType || "");
  return (
    t === "PAYMENT.PAYOUTS-ITEM.RETURNED" ||
    t === "PAYMENT.PAYOUTS-ITEM.CANCELED" ||
    t === "PAYMENT.PAYOUTS-ITEM.FAILED" ||
    t === "PAYMENT.PAYOUTS-ITEM.BLOCKED" ||
    t === "PAYMENT.PAYOUTSBATCH.DENIED"
  );
}

function reconcileAllowsPaidToFail(delta) {
  if (delta.source !== "reconcile") return false;
  const fr = String(delta.failureReason || "").toUpperCase();
  return fr.includes("RETURNED") || fr.includes("REFUND");
}

function mergeProcessorResponse(row, extra) {
  const prev = row.processor_response && typeof row.processor_response === "object" ? row.processor_response : {};
  return { ...prev, ...extra };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {{ userId: string; outcome: 'processing' | 'paid' | 'failed' }} params
 */
async function notifyWithdrawalPayoutOutcome(supabaseAdmin, params) {
  const { userId, outcome } = params;
  if (!userId || !outcome) return;
  const cfg =
    outcome === "processing"
      ? {
          p_type: "withdrawal_payout_processing",
          p_title: "Withdrawal payout processing",
          p_message: "Your withdrawal is being processed.",
        }
      : outcome === "paid"
        ? {
            p_type: "withdrawal_paid",
            p_title: "Withdrawal paid",
            p_message: "Your withdrawal has been sent to your PayPal account.",
          }
        : outcome === "failed"
          ? {
              p_type: "withdrawal_payout_failed",
              p_title: "Withdrawal payout failed",
              p_message: "Your withdrawal payout failed. Please contact support.",
            }
          : null;
  if (!cfg) return;
  const { error } = await supabaseAdmin.rpc("create_notification", {
    p_user_id: userId,
    p_type: cfg.p_type,
    p_message: cfg.p_message,
    p_title: cfg.p_title,
    p_related_transaction_id: null,
  });
  if (error) {
    console.error("[payoutService] create_notification failed:", error);
  }
}

function formatUsdTwoDecimals(amount) {
  const n = typeof amount === "string" ? parseFloat(amount) : Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Invalid withdrawal amount");
  }
  return n.toFixed(2);
}

/**
 * Resolve PayPal recipient email for a withdrawal (MVP).
 * Prefers snapshot on the request row, then profiles.payout_email, then profiles.email.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {Record<string, unknown>} row
 */
async function resolvePayoutEmail(supabaseAdmin, row) {
  const userId = row.user_id;
  const snap = String(row.payout_email || row.payout_destination || "").trim();
  if (snap) return snap;

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("email, payout_email")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[payoutService] profile load failed:", error);
    throw new Error("Could not load user profile for payout destination");
  }

  const direct = String(profile?.payout_email || "").trim();
  if (direct) return direct;

  const fallback = String(profile?.email || "").trim();
  if (fallback) return fallback;

  return "";
}

/**
 * Apply webhook- or reconcile-derived payout state to a withdrawal row.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {Record<string, unknown>} row
 * @param {{
 *   source: 'webhook' | 'reconcile' | 'execute';
 *   eventType?: string;
 *   batchId?: string | null;
 *   itemId?: string | null;
 *   nextStatus: 'paid' | 'failed' | 'processing';
 *   processorStatus: string;
 *   failureReason?: string | null;
 *   rawPayload?: Record<string, unknown>;
 * }} delta
 */
export async function applyPayPalTransition(supabaseAdmin, row, delta) {
  const withdrawalId = row.id;
  const prevStatus = String(row.status || "").toLowerCase();
  const nextStatus = delta.nextStatus;
  const processorManual = String(row.processor || "").toLowerCase() === "manual";

  if (prevStatus === "rejected") {
    return { skipped: "rejected" };
  }

  if (
    prevStatus === "paid" &&
    nextStatus === "failed" &&
    !isPaidDowngradeAllowed(delta.eventType || "") &&
    !reconcileAllowsPaidToFail(delta)
  ) {
    return { skipped: "paid_no_downgrade" };
  }

  if (processorManual && (delta.source === "webhook" || delta.source === "reconcile")) {
    return { skipped: "manual_payout" };
  }

  const nowIso = new Date().toISOString();
  const mergedResp = mergeProcessorResponse(row, {
    [`last_${delta.source}_at`]: nowIso,
    [`last_${delta.source}`]: delta.rawPayload || {},
  });

  /** @type {Record<string, unknown>} */
  const patch = {
    processor: row.processor || "paypal",
    processor_status: delta.processorStatus,
    processor_response: mergedResp,
    updated_at: nowIso,
  };

  if (delta.batchId && !row.processor_batch_id) {
    patch.processor_batch_id = delta.batchId;
  }
  if (delta.itemId && !row.processor_item_id) {
    patch.processor_item_id = delta.itemId;
  }

  if (nextStatus === "paid") {
    patch.status = "paid";
    patch.paid_at = nowIso;
    patch.paid_via = "PayPal";
    patch.external_reference = delta.batchId || delta.itemId || row.external_reference || null;
    patch.failure_reason = null;
  } else if (nextStatus === "failed") {
    patch.status = "failed";
    patch.failure_reason = (delta.failureReason || "PayPal payout failed").slice(0, 2000);
    patch.paid_at = null;
  } else {
    patch.status = "processing";
  }

  const statusChanged = String(patch.status).toLowerCase() !== prevStatus;

  const { error: updErr } = await supabaseAdmin.from("withdrawal_requests").update(patch).eq("id", withdrawalId);
  if (updErr) {
    console.error("[payoutService] applyPayPalTransition update failed:", updErr);
    throw new Error(updErr.message || "Could not update withdrawal");
  }

  const userId = row.user_id;

  if (statusChanged) {
    if (nextStatus === "paid") {
      await notifyWithdrawalPayoutOutcome(supabaseAdmin, { userId, outcome: "paid" });
    } else if (nextStatus === "failed") {
      await notifyWithdrawalPayoutOutcome(supabaseAdmin, { userId, outcome: "failed" });
    } else if (nextStatus === "processing") {
      const alreadyNotified = row.payout_processing_notified_at != null;
      if (!alreadyNotified) {
        await notifyWithdrawalPayoutOutcome(supabaseAdmin, { userId, outcome: "processing" });
        await supabaseAdmin
          .from("withdrawal_requests")
          .update({ payout_processing_notified_at: nowIso })
          .eq("id", withdrawalId);
      }
    }
  }

  return { applied: true, status: nextStatus, statusChanged };
}

/**
 * Webhook entry: maps PayPal event to applyPayPalTransition.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {Record<string, unknown>} row
 * @param {{ eventType: string; resource: Record<string, unknown>; rawEvent: Record<string, unknown>; batchId?: string | null; itemId?: string | null }} ctx
 */
export async function applyPayPalWebhookToWithdrawal(supabaseAdmin, row, ctx) {
  const derived = deriveFromPayPalWebhook({ eventType: ctx.eventType, resource: ctx.resource });
  if (!derived) {
    return { skipped: "unhandled_event" };
  }

  const bh = ctx.resource?.batch_header && typeof ctx.resource.batch_header === "object" ? ctx.resource.batch_header : {};
  const batchId =
    ctx.batchId ||
    (typeof bh.payout_batch_id === "string" ? bh.payout_batch_id : null) ||
    (typeof ctx.resource?.payout_batch_id === "string" ? ctx.resource.payout_batch_id : null);
  const itemId =
    ctx.itemId ||
    (typeof ctx.resource?.payout_item_id === "string" ? ctx.resource.payout_item_id : null);

  return applyPayPalTransition(supabaseAdmin, row, {
    source: "webhook",
    eventType: ctx.eventType,
    batchId,
    itemId,
    nextStatus: derived.nextStatus,
    processorStatus: derived.processorStatus,
    failureReason: derived.failureReason,
    rawPayload: { event_type: ctx.eventType, resource: ctx.resource, envelope: ctx.rawEvent },
  });
}

/**
 * Execute automated PayPal payout for a withdrawal request.
 * Does not deduct wallet (already done at request time).
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} withdrawalId
 * @param {{ forceRetry?: boolean }} [options]
 * @returns {Promise<{ status: string; processorStatus: string | null; batchId: string | null }>}
 */
export async function executeWithdrawalPayout(supabaseAdmin, withdrawalId, options = {}) {
  if (!withdrawalId || typeof withdrawalId !== "string") {
    throw new Error("withdrawalId is required");
  }

  const forceRetry = options.forceRetry === true;

  const { data: row, error: loadErr } = await supabaseAdmin
    .from("withdrawal_requests")
    .select("*")
    .eq("id", withdrawalId)
    .maybeSingle();

  if (loadErr) {
    console.error("[payoutService] load withdrawal:", loadErr);
    throw new Error(loadErr.message || "Could not load withdrawal request");
  }
  if (!row) {
    throw new Error("Withdrawal request not found");
  }

  const st = String(row.status || "").toLowerCase();
  if (forceRetry && st !== "failed") {
    throw new Error("Retry payout is only for failed withdrawals.");
  }
  if (st === "paid") {
    throw new Error("Withdrawal is already marked paid");
  }
  if (st === "rejected") {
    throw new Error("Withdrawal was rejected; automated payout is not allowed");
  }
  const batchExisting = row.processor_batch_id != null && String(row.processor_batch_id).trim() !== "";
  if (st === "processing" && batchExisting && !forceRetry) {
    throw new Error("Automated payout already in progress for this request (processor batch on file)");
  }
  if (st === "failed" && batchExisting && !forceRetry) {
    throw new Error('Use "Retry payout" to submit a new PayPal batch for this withdrawal.');
  }
  if (!["pending", "failed", "processing"].includes(st)) {
    throw new Error(`Withdrawal status "${row.status}" cannot start automated payout`);
  }

  const receiverEmail = await resolvePayoutEmail(supabaseAdmin, row);
  if (!receiverEmail) {
    throw new Error("User has no payout destination on file.");
  }

  const nowIso = new Date().toISOString();
  const amountUsd = formatUsdTwoDecimals(row.amount);

  const idempotencyKey = forceRetry
    ? `${withdrawalId}_retry_${Date.now()}`.slice(0, 127)
    : String(withdrawalId).slice(0, 127);

  const processingUpdate = {
    status: "processing",
    processor: "paypal",
    failure_reason: null,
    updated_at: nowIso,
    ...(st === "failed" && forceRetry ? { payout_processing_notified_at: null } : {}),
  };

  const { error: procErr } = await supabaseAdmin
    .from("withdrawal_requests")
    .update(processingUpdate)
    .eq("id", withdrawalId)
    .in("status", ["pending", "failed", "processing"]);

  if (procErr) {
    console.error("[payoutService] set processing failed:", procErr);
    throw new Error(procErr.message || "Could not mark withdrawal as processing");
  }

  let paypalResult;
  try {
    paypalResult = await createPayPalPayoutBatch(
      withdrawalId,
      {
        amountUsd,
        receiverEmail,
        note: `Tropicash withdrawal ${withdrawalId.slice(0, 8)}`,
      },
      idempotencyKey,
    );
  } catch (err) {
    console.error("[payoutService] PayPal API error:", err);
    if (err && typeof err === "object" && "paypalError" in err && err.paypalError) {
      throw err;
    }
    const paypalError = buildPayPalPayoutErrorFromException(err, { phase: "create_batch_request" });
    const failPatch = {
      status: "failed",
      failure_reason: stringifyFailureReason(paypalError),
      processor: "paypal",
      processor_response: mergeProcessorResponse(row, { paypalError, phase: "request" }),
      updated_at: new Date().toISOString(),
    };
    const { data: beforeCatchFail } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("status")
      .eq("id", withdrawalId)
      .maybeSingle();
    const beforeCatchSt = String(beforeCatchFail?.status || "").toLowerCase();

    const { error: failUpd } = await supabaseAdmin.from("withdrawal_requests").update(failPatch).eq("id", withdrawalId);
    if (failUpd) {
      console.error("[payoutService] failed to persist failure state:", failUpd);
    }
    if (beforeCatchSt !== "failed") {
      await notifyWithdrawalPayoutOutcome(supabaseAdmin, {
        userId: row.user_id,
        outcome: "failed",
      });
    }
    throwPayPalPayoutFailed(paypalError);
  }

  const raw = paypalResult.raw;
  const httpOk = paypalResult.httpStatus >= 200 && paypalResult.httpStatus < 300;
  const batchStatus = (paypalResult.batchStatus || "").toUpperCase() || "UNKNOWN";

  const processorPatch = {
    processor: "paypal",
    processor_batch_id: paypalResult.batchId,
    processor_item_id: paypalResult.itemId,
    processor_status: paypalResult.batchStatus || String(paypalResult.httpStatus),
    processor_response: mergeProcessorResponse(row, { execute_response: raw }),
    payout_email: receiverEmail,
    updated_at: new Date().toISOString(),
  };

  if (!httpOk) {
    const paypalError = buildPayPalPayoutErrorDetails(raw, paypalResult.httpStatus, "create_batch");
    const failPatch = {
      ...processorPatch,
      status: "failed",
      failure_reason: stringifyFailureReason(paypalError),
      processor_response: mergeProcessorResponse(row, {
        paypalError,
        phase: "create_batch",
        execute_response: raw,
      }),
    };
    const { data: beforeHttpFail } = await supabaseAdmin
      .from("withdrawal_requests")
      .select("status")
      .eq("id", withdrawalId)
      .maybeSingle();
    const beforeHttpSt = String(beforeHttpFail?.status || "").toLowerCase();

    const { error: u2 } = await supabaseAdmin.from("withdrawal_requests").update(failPatch).eq("id", withdrawalId);
    if (u2) console.error("[payoutService] persist PayPal HTTP failure:", u2);
    if (beforeHttpSt !== "failed") {
      await notifyWithdrawalPayoutOutcome(supabaseAdmin, {
        userId: row.user_id,
        outcome: "failed",
      });
    }
    throwPayPalPayoutFailed(paypalError);
  }

  const interpreted = interpretPayPalPayoutBatchRaw(raw);
  let nextStatus = interpreted.nextStatus;
  let paidAt = null;
  let failureReason = interpreted.failureReason;

  if (interpreted.nextStatus === "paid") {
    paidAt = new Date().toISOString();
    processorPatch.paid_via = "PayPal";
    processorPatch.external_reference = paypalResult.batchId;
  } else if (interpreted.nextStatus === "failed") {
    failureReason = interpreted.failureReason || `PayPal batch status: ${batchStatus}`;
  } else {
    nextStatus = "processing";
  }

  const finalPatch = {
    ...processorPatch,
    status: nextStatus,
    paid_at: paidAt,
    failure_reason: failureReason,
  };

  const { data: rowBeforeFinal, error: beforeFinalErr } = await supabaseAdmin
    .from("withdrawal_requests")
    .select("status, payout_processing_notified_at")
    .eq("id", withdrawalId)
    .maybeSingle();
  if (beforeFinalErr) {
    console.error("[payoutService] pre-final withdrawal load:", beforeFinalErr);
  }
  const dbBeforeFinal = String(rowBeforeFinal?.status || "").toLowerCase();
  const processingAlreadyNotified = rowBeforeFinal?.payout_processing_notified_at != null;

  const { error: u3 } = await supabaseAdmin.from("withdrawal_requests").update(finalPatch).eq("id", withdrawalId);
  if (u3) {
    console.error("[payoutService] final update failed:", u3);
    throw new Error(u3.message || "Could not save payout result");
  }

  const statusTransitioned = nextStatus !== dbBeforeFinal;

  if (nextStatus === "paid" && statusTransitioned) {
    await notifyWithdrawalPayoutOutcome(supabaseAdmin, {
      userId: row.user_id,
      outcome: "paid",
    });
  } else if (nextStatus === "failed" && statusTransitioned) {
    await notifyWithdrawalPayoutOutcome(supabaseAdmin, {
      userId: row.user_id,
      outcome: "failed",
    });
  } else if (nextStatus === "processing" && !processingAlreadyNotified) {
    await notifyWithdrawalPayoutOutcome(supabaseAdmin, {
      userId: row.user_id,
      outcome: "processing",
    });
    await supabaseAdmin
      .from("withdrawal_requests")
      .update({ payout_processing_notified_at: new Date().toISOString() })
      .eq("id", withdrawalId);
  }

  return {
    status: nextStatus,
    processorStatus: paypalResult.batchStatus,
    batchId: paypalResult.batchId,
  };
}

/**
 * Poll PayPal for batch status and align DB (notifications only if status changes).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} withdrawalId
 */
export async function reconcileWithdrawalPayout(supabaseAdmin, withdrawalId) {
  if (!withdrawalId || typeof withdrawalId !== "string") {
    throw new Error("withdrawalId is required");
  }

  const { data: row, error: loadErr } = await supabaseAdmin
    .from("withdrawal_requests")
    .select("*")
    .eq("id", withdrawalId)
    .maybeSingle();

  if (loadErr) {
    console.error("[payoutService] reconcile load:", loadErr);
    throw new Error(loadErr.message || "Could not load withdrawal");
  }
  if (!row) {
    throw new Error("Withdrawal request not found");
  }

  const batchId = row.processor_batch_id != null ? String(row.processor_batch_id).trim() : "";
  if (!batchId) {
    return { noop: true, withdrawalId, status: row.status };
  }

  const api = await getPayPalPayoutBatch(batchId);
  if (api.httpStatus < 200 || api.httpStatus >= 300) {
    const detail =
      api.raw && typeof api.raw === "object"
        ? api.raw.message || api.raw.name || api.raw.error_description
        : null;
    throw new Error(String(detail || `PayPal batch lookup failed (${api.httpStatus})`));
  }
  const raw = api.raw;

  const interpreted = interpretPayPalPayoutBatchRaw(raw);

  const result = await applyPayPalTransition(supabaseAdmin, row, {
    source: "reconcile",
    batchId,
    itemId: row.processor_item_id || null,
    nextStatus: interpreted.nextStatus,
    processorStatus: interpreted.processorStatus,
    failureReason: interpreted.failureReason,
    rawPayload: { reconcile: raw, httpStatus: api.httpStatus },
  });

  const { data: after } = await supabaseAdmin
    .from("withdrawal_requests")
    .select("status, processor_status, processor_batch_id, paid_at, failure_reason")
    .eq("id", withdrawalId)
    .maybeSingle();

  return {
    withdrawalId,
    status: after?.status ?? interpreted.nextStatus,
    processorStatus: after?.processor_status ?? interpreted.processorStatus,
    batchId,
    withdrawal: after,
    noop: false,
    ...result,
  };
}
