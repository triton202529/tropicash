/**
 * PayPal funding ownership and recovery decisions.
 * PayPal is authoritative for capture. Tropicash is authoritative for the wallet credit.
 * This module does not call PayPal or change a balance.
 */

export const PAYPAL_FUNDING_PROVIDER = "paypal";
export const PAYPAL_FUNDING_CURRENCY = "USD";
export const CAPTURE_IN_PROGRESS_STALE_MS = 90 * 1000;

const RECOVERABLE = new Set(["captured", "credit_failed"]);

export function moneyCents(value) {
  const n = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function normalizeFundingAmount(value) {
  const cents = moneyCents(value);
  if (cents == null) return null;
  return cents / 100;
}

export function readPayPalCapture(paypalOrder) {
  const unit = paypalOrder?.purchase_units?.[0] ?? null;
  const capture = unit?.payments?.captures?.[0] ?? null;
  const amount = capture?.amount?.value ?? unit?.amount?.value ?? null;
  const currency = capture?.amount?.currency_code ?? unit?.amount?.currency_code ?? null;
  return {
    orderId: typeof paypalOrder?.id === "string" ? paypalOrder.id : null,
    orderStatus: paypalOrder?.status != null ? String(paypalOrder.status) : null,
    captureId: typeof capture?.id === "string" ? capture.id : null,
    captureStatus: capture?.status != null ? String(capture.status) : null,
    amount,
    currency: currency != null ? String(currency).toUpperCase() : null,
  };
}

function reject(httpStatus, code, error) {
  return { action: "reject", httpStatus, code, error };
}

/**
 * Decide what the authenticated caller may do before any provider call.
 * @param {{ fundingOrder: object|null, callerUserId: string, clientAmount?: number|null, clientCurrency?: string|null, completedCredit?: object|null }} args
 */
export function evaluateFundingRequest(args) {
  const fundingOrder = args.fundingOrder;
  const callerUserId = args.callerUserId;

  if (!fundingOrder) {
    const prior = args.completedCredit;
    if (prior?.status === "completed") {
      if (prior.user_id && prior.user_id !== callerUserId) {
        return reject(403, "ORDER_OWNER_MISMATCH", "This order is not associated with your account.");
      }
      return {
        action: "replay",
        amount: prior.amount,
        transactionId: prior.transaction_id ?? null,
      };
    }
    return reject(404, "ORDER_NOT_BOUND", "This PayPal order is not linked to a Tropicash funding request.");
  }

  if (fundingOrder.user_id !== callerUserId) {
    return reject(403, "ORDER_OWNER_MISMATCH", "This order is not associated with your account.");
  }

  if (args.clientAmount != null && args.clientAmount !== "") {
    const clientCents = moneyCents(args.clientAmount);
    if (clientCents == null || clientCents !== moneyCents(fundingOrder.amount)) {
      return reject(
        409,
        "AMOUNT_MISMATCH",
        "Payment amount did not match the funding request. No wallet credit was applied.",
      );
    }
  }

  if (args.clientCurrency != null && String(args.clientCurrency).trim() !== "") {
    if (String(args.clientCurrency).trim().toUpperCase() !== fundingOrder.currency) {
      return reject(
        409,
        "CURRENCY_MISMATCH",
        "Payment currency did not match the funding request. No wallet credit was applied.",
      );
    }
  }

  if (fundingOrder.status === "completed") {
    return {
      action: "replay",
      amount: fundingOrder.amount,
      transactionId: fundingOrder.transaction_id ?? null,
    };
  }

  if (fundingOrder.status === "credit_in_progress") {
    return reject(409, "ALREADY_PROCESSING", "Funding for this PayPal order is already being processed.");
  }

  if (RECOVERABLE.has(fundingOrder.status)) {
    return { action: "recover" };
  }

  if (fundingOrder.status === "created" || fundingOrder.status === "capture_failed") {
    return { action: "capture" };
  }

  if (fundingOrder.status === "capture_in_progress") {
    return { action: "inspect" };
  }

  return reject(409, "FUNDING_STATE_UNKNOWN", "This funding order cannot be completed.");
}

/**
 * Confirm a PayPal order/capture payload against the stored funding intent.
 * Does not credit a wallet.
 */
export function evaluatePayPalOrder({ fundingOrder, paypalOrder }) {
  const read = readPayPalCapture(paypalOrder);
  if (read.orderStatus !== "COMPLETED" || read.captureStatus !== "COMPLETED" || !read.captureId) {
    return {
      action: "not_captured",
      paypalStatus: read.captureStatus || read.orderStatus || null,
    };
  }
  if (read.orderId !== fundingOrder.provider_order_id) {
    return reject(409, "ORDER_IDENTITY_MISMATCH", "PayPal order identity did not match the stored funding request.");
  }
  if (read.currency !== fundingOrder.currency) {
    return reject(
      409,
      "CURRENCY_MISMATCH",
      "PayPal payment currency did not match the funding request. No wallet credit was applied.",
    );
  }
  const capturedCents = moneyCents(read.amount);
  if (capturedCents == null || capturedCents !== moneyCents(fundingOrder.amount)) {
    return reject(
      409,
      "AMOUNT_MISMATCH",
      "Payment amount did not match the funding request. No wallet credit was applied.",
    );
  }
  return {
    action: "credit",
    captureId: read.captureId,
    amount: fundingOrder.amount,
    currency: fundingOrder.currency,
  };
}

function successBody({ fundingOrder, transactionId, duplicate }) {
  return {
    success: true,
    duplicate: Boolean(duplicate),
    amount: fundingOrder?.amount ?? null,
    orderID: fundingOrder?.provider_order_id ?? null,
    transactionId: transactionId ?? null,
  };
}

/**
 * Server funding flow. `store` and `paypal` are injected so tests can run
 * without PayPal or a wallet update.
 */
export async function executePaypalFundingCapture({
  callerUserId,
  orderId,
  clientAmount = null,
  clientCurrency = null,
  store,
  paypal,
}) {
  const counters = { captureCalls: 0, getCalls: 0, creditCalls: 0 };
  const fundingOrder = await store.load(orderId);
  const completedCredit = fundingOrder ? null : await store.loadCompletedCredit(orderId);
  let current = fundingOrder;
  let decision = evaluateFundingRequest({
    fundingOrder: current,
    callerUserId,
    clientAmount,
    clientCurrency,
    completedCredit,
  });

  if (decision.action === "reject") {
    return { httpStatus: decision.httpStatus, body: { error: decision.error, code: decision.code }, ...counters };
  }
  if (decision.action === "replay") {
    return {
      httpStatus: 200,
      body: {
        success: true,
        duplicate: true,
        amount: decision.amount,
        orderID: orderId,
        transactionId: decision.transactionId ?? null,
      },
      ...counters,
    };
  }

  const loadFresh = async () => {
    current = await store.load(orderId);
    decision = evaluateFundingRequest({
      fundingOrder: current,
      callerUserId,
      clientAmount,
      clientCurrency,
    });
  };

  let claimedForCapture = false;

  if (decision.action === "inspect") {
    counters.getCalls += 1;
    const paypalOrder = await paypal.get(orderId);
    const verdict = evaluatePayPalOrder({ fundingOrder: current, paypalOrder });
    if (verdict.action === "credit") {
      decision = { action: "recover", paypalOrder };
    } else if (verdict.action === "not_captured") {
      const claim = await store.claimCapture({ orderId, userId: callerUserId });
      if (!claim?.claimed) {
        return {
          httpStatus: 409,
          body: {
            error: "Funding for this PayPal order is already being processed.",
            code: "ALREADY_PROCESSING",
          },
          ...counters,
        };
      }
      claimedForCapture = true;
      decision = { action: "capture" };
    } else {
      return { httpStatus: verdict.httpStatus, body: { error: verdict.error, code: verdict.code }, ...counters };
    }
  }

  let paypalOrder = decision.paypalOrder ?? null;

  if (decision.action === "capture") {
    if (!claimedForCapture) {
    const claim = await store.claimCapture({ orderId, userId: callerUserId });
    if (!claim?.claimed) {
      await loadFresh();
      if (decision.action === "replay") {
        return {
          httpStatus: 200,
          body: {
            success: true,
            duplicate: true,
            amount: decision.amount,
            orderID: orderId,
            transactionId: decision.transactionId ?? null,
          },
          ...counters,
        };
      }
      if (decision.action !== "recover") {
        return {
          httpStatus: 409,
          body: {
            error: "Funding for this PayPal order is already being processed.",
            code: "ALREADY_PROCESSING",
          },
          ...counters,
        };
      }
    } else {
      claimedForCapture = true;
    }
    }
    if (claimedForCapture) {
      try {
        counters.captureCalls += 1;
        paypalOrder = await paypal.capture(orderId);
      } catch (err) {
        if (err?.code === "ORDER_ALREADY_CAPTURED") {
          counters.getCalls += 1;
          paypalOrder = await paypal.get(orderId);
          decision = { action: "recover" };
        } else {
          await store.markCaptureFailed({
            orderId,
            userId: callerUserId,
            reason: err?.code || "PAYPAL_CAPTURE_FAILED",
          });
          return {
            httpStatus: 502,
            body: {
              error: err?.message || "Could not capture PayPal order",
              code: err?.code || "PAYPAL_CAPTURE_FAILED",
            },
            ...counters,
          };
        }
      }
    }
  }

  if (decision.action === "recover" && !paypalOrder) {
    counters.getCalls += 1;
    paypalOrder = await paypal.get(orderId);
  }

  await loadFresh();
  if (decision.action === "reject") {
    return { httpStatus: decision.httpStatus, body: { error: decision.error, code: decision.code }, ...counters };
  }
  if (decision.action === "replay") {
    return {
      httpStatus: 200,
      body: {
        success: true,
        duplicate: true,
        amount: decision.amount,
        orderID: orderId,
        transactionId: decision.transactionId ?? null,
      },
      ...counters,
    };
  }

  const verdict = evaluatePayPalOrder({ fundingOrder: current, paypalOrder });
  if (verdict.action === "not_captured") {
    if (current.status === "capture_in_progress") {
      await store.markCaptureFailed({
        orderId,
        userId: callerUserId,
        reason: "CAPTURE_INCOMPLETE",
      });
    }
    return {
      httpStatus: 502,
      body: {
        error: "PayPal payment was not completed",
        code: "CAPTURE_INCOMPLETE",
        paypalStatus: verdict.paypalStatus,
      },
      ...counters,
    };
  }
  if (verdict.action === "reject") {
    return { httpStatus: verdict.httpStatus, body: { error: verdict.error, code: verdict.code }, ...counters };
  }

  if (current.status !== "captured" && current.status !== "credit_failed") {
    const marked = await store.markCaptured({
      orderId,
      userId: callerUserId,
      captureId: verdict.captureId,
    });
    if (!marked?.updated) {
      await loadFresh();
      if (decision.action === "replay") {
        return {
          httpStatus: 200,
          body: successBody({
            fundingOrder: current,
            transactionId: decision.transactionId,
            duplicate: true,
          }),
          ...counters,
        };
      }
      if (current?.status !== "captured" && current?.status !== "credit_failed") {
        return {
          httpStatus: 409,
          body: {
            error: "Funding for this PayPal order is already being processed.",
            code: "ALREADY_PROCESSING",
          },
          ...counters,
        };
      }
    }
  }

  counters.creditCalls += 1;
  const credit = await store.credit({
    orderId,
    userId: callerUserId,
    amount: current.amount,
    currency: current.currency,
    captureId: verdict.captureId,
  });

  if (!credit?.ok && credit?.code === "funding_credit_uncertain") {
    return {
      httpStatus: 409,
      body: {
        error: "Funding for this PayPal order needs review before it can be credited again.",
        code: "FUNDING_CREDIT_UNCERTAIN",
      },
      ...counters,
    };
  }
  if (!credit?.ok) {
    return {
      httpStatus: 500,
      body: { error: "Could not credit wallet after payment", code: credit?.code || "credit_failed" },
      ...counters,
    };
  }

  return {
    httpStatus: 200,
    body: successBody({
      fundingOrder: current,
      transactionId: credit.transaction_id ?? credit.transactionId ?? null,
      duplicate: Boolean(credit.already_completed),
    }),
    transactionId: credit.transaction_id ?? credit.transactionId ?? null,
    ...counters,
  };
}
