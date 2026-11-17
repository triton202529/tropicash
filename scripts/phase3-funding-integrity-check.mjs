/**
 * Non-financial Phase 3 checks. No PayPal calls and no wallet updates.
 */
import {
  evaluateFundingRequest,
  evaluatePayPalOrder,
  executePaypalFundingCapture,
} from "../lib/paypalFundingIntegrity.mjs";

const userA = "user-a";
const userB = "user-b";
const orderId = "ORDER-PHASE3";

function assert(cond, message) {
  if (!cond) {
    throw new Error(message);
  }
}

function capturedPaypal(amount = "25.00", currency = "USD") {
  return {
    id: orderId,
    status: "COMPLETED",
    purchase_units: [
      {
        payments: {
          captures: [
            {
              id: "CAP-1",
              status: "COMPLETED",
              amount: { currency_code: currency, value: amount },
            },
          ],
        },
      },
    ],
  };
}

function baseOrder(overrides = {}) {
  return {
    provider_order_id: orderId,
    user_id: userA,
    amount: 25,
    currency: "USD",
    status: "created",
    transaction_id: null,
    ...overrides,
  };
}

const ownerDeny = evaluateFundingRequest({
  fundingOrder: baseOrder(),
  callerUserId: userB,
  clientAmount: 25,
});
assert(ownerDeny.code === "ORDER_OWNER_MISMATCH", "user B must be rejected");

const amountDeny = evaluateFundingRequest({
  fundingOrder: baseOrder(),
  callerUserId: userA,
  clientAmount: 40,
});
assert(amountDeny.code === "AMOUNT_MISMATCH", "altered amount must be rejected");

const currencyDeny = evaluateFundingRequest({
  fundingOrder: baseOrder(),
  callerUserId: userA,
  clientCurrency: "EUR",
});
assert(currencyDeny.code === "CURRENCY_MISMATCH", "altered currency must be rejected");

const unbound = evaluateFundingRequest({
  fundingOrder: null,
  callerUserId: userA,
});
assert(unbound.code === "ORDER_NOT_BOUND", "missing ownership must fail closed");

const paypalMismatch = evaluatePayPalOrder({
  fundingOrder: baseOrder({ status: "captured" }),
  paypalOrder: capturedPaypal("40.00"),
});
assert(paypalMismatch.code === "AMOUNT_MISMATCH", "PayPal amount must match the stored amount");

function memoryStore(initial) {
  const row = { ...initial };
  let creditCalls = 0;
  return {
    row,
    async load() {
      return { ...row };
    },
    async loadCompletedCredit() {
      return null;
    },
    async claimCapture({ userId }) {
      if (row.user_id !== userId) return { claimed: false };
      if (row.status === "created" || row.status === "capture_failed" || row.status === "capture_in_progress") {
        row.status = "capture_in_progress";
        return { claimed: true };
      }
      return { claimed: false };
    },
    async markCaptured({ userId, captureId }) {
      if (row.user_id !== userId || row.status !== "capture_in_progress") return { updated: false };
      row.status = "captured";
      row.provider_capture_id = captureId;
      return { updated: true };
    },
    async markCaptureFailed({ userId, reason }) {
      if (row.user_id !== userId) return { updated: false };
      row.status = "capture_failed";
      row.last_error = reason;
      return { updated: true };
    },
    async credit({ userId, amount }) {
      creditCalls += 1;
      if (row.user_id !== userId) return { ok: false, code: "ORDER_OWNER_MISMATCH" };
      if (Number(amount) !== Number(row.amount)) return { ok: false, code: "AMOUNT_MISMATCH" };
      if (row.status === "completed") {
        return { ok: true, already_completed: true, transaction_id: row.transaction_id };
      }
      if (row.creditLock) return { ok: false, code: "funding_credit_uncertain" };
      row.creditLock = true;
      row.status = "completed";
      row.transaction_id = "tx-once";
      row.creditsPosted = (row.creditsPosted || 0) + 1;
      row.creditLock = false;
      return { ok: true, already_completed: false, transaction_id: "tx-once" };
    },
    creditCalls: () => creditCalls,
  };
}

const recoveryStore = memoryStore(baseOrder({ status: "captured" }));
let captureCalls = 0;
const recovery = await executePaypalFundingCapture({
  callerUserId: userA,
  orderId,
  clientAmount: 25,
  store: recoveryStore,
  paypal: {
    async capture() {
      captureCalls += 1;
      throw new Error("capture must not be called");
    },
    async get() {
      return capturedPaypal();
    },
  },
});
assert(recovery.httpStatus === 200, "recovery should succeed");
assert(recovery.body.duplicate === false, "first recovery posts the credit");
assert(captureCalls === 0, "recovery must not capture again");
assert(recovery.creditCalls === 1, "recovery credits once");
assert(recoveryStore.row.creditsPosted === 1, "wallet credit authority acquired once");
assert(recoveryStore.row.user_id === userA, "owner stays user A");

const replay = await executePaypalFundingCapture({
  callerUserId: userA,
  orderId,
  clientAmount: 25,
  store: recoveryStore,
  paypal: {
    async capture() {
      throw new Error("replay must not capture");
    },
    async get() {
      throw new Error("replay must not read PayPal");
    },
  },
});
assert(replay.httpStatus === 200 && replay.body.duplicate === true, "replay returns the completed result");
assert(replay.creditCalls === 0, "replay must not credit again");
assert(recoveryStore.row.creditsPosted === 1, "replay leaves the single credit in place");

const stolen = await executePaypalFundingCapture({
  callerUserId: userB,
  orderId,
  store: recoveryStore,
  paypal: {
    async capture() {
      throw new Error("other user must not capture");
    },
    async get() {
      throw new Error("other user must not read PayPal");
    },
  },
});
assert(stolen.body.code === "ORDER_OWNER_MISMATCH", "user B cannot take a completed order");
assert(recoveryStore.row.user_id === userA, "ownership was not reassigned");

const concurrent = memoryStore(baseOrder({ status: "captured" }));
const paypalGet = async () => capturedPaypal();
const [a, b] = await Promise.all([
  executePaypalFundingCapture({
    callerUserId: userA,
    orderId,
    store: concurrent,
    paypal: { capture: async () => { throw new Error("no capture"); }, get: paypalGet },
  }),
  executePaypalFundingCapture({
    callerUserId: userA,
    orderId,
    store: concurrent,
    paypal: { capture: async () => { throw new Error("no capture"); }, get: paypalGet },
  }),
]);
const posted = [a, b].filter((item) => item.httpStatus === 200 && item.body.duplicate === false);
assert(posted.length === 1, "only one concurrent recovery may post a credit");
assert(concurrent.row.creditsPosted === 1, "concurrent recoveries post one credit");

const alreadyCaptured = memoryStore(baseOrder({ status: "created" }));
let captures = 0;
const stranded = await executePaypalFundingCapture({
  callerUserId: userA,
  orderId,
  store: alreadyCaptured,
  paypal: {
    async capture() {
      captures += 1;
      const err = new Error("This payment was already captured.");
      err.code = "ORDER_ALREADY_CAPTURED";
      throw err;
    },
    async get() {
      return capturedPaypal();
    },
  },
});
assert(captures === 1, "already-captured lookup happens after one capture attempt");
assert(stranded.httpStatus === 200, "already captured order can still be credited");
assert(alreadyCaptured.row.creditsPosted === 1, "stranded capture credits once");

console.log("phase3 funding integrity checks passed");
