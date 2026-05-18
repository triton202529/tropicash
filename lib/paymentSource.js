import { getPayPalMode } from "./paypalMode";

/** @typedef {"card" | "paypal"} FundingPaymentMethod */

export const FUNDING_METHOD_CARD = "card";
export const FUNDING_METHOD_PAYPAL = "paypal";

const SESSION_PREFIX = "tc_fund_src_";

/**
 * App PayPal mode (matches fund-wallet / SDK loader). Delegates to the
 * shared resolver so client and server always agree.
 * @returns {"sandbox"|"live"}
 */
export function getPayPalAppEnvironment() {
  return getPayPalMode();
}

/** @returns {"Sandbox"|"Live"} */
export function formatPayPalEnvironmentBadge(env) {
  return env === "live" ? "Live" : "Sandbox";
}

/** @param {FundingPaymentMethod | string | null | undefined} method */
export function fundingMethodLabel(method) {
  const m = String(method || "").toLowerCase();
  return m === FUNDING_METHOD_CARD ? "Card" : "PayPal";
}

/**
 * Detect wallet vs card / PayPal wallet from Smart Buttons `onApprove` payload (shape varies).
 * @param {Record<string, unknown> | null | undefined} data
 * @returns {FundingPaymentMethod}
 */
export function fundingMethodFromPayPalApproveData(data) {
  if (!data || typeof data !== "object") return FUNDING_METHOD_PAYPAL;
  const raw =
    data.paymentSource ??
    data.payment_source ??
    data.fundingSource ??
    data.funding_source ??
    "";
  const s = String(raw).toLowerCase().replace(/[\s_-]/g, "");
  if (
    s === "card" ||
    s === "creditcard" ||
    s === "debitcard" ||
    s === "credit" ||
    s === "applepay" ||
    s === "googlepay"
  ) {
    return FUNDING_METHOD_CARD;
  }
  return FUNDING_METHOD_PAYPAL;
}

/**
 * Remember funding source for this browser session (same-tab UX on transaction screens).
 * @param {string | null | undefined} payPalOrderId
 * @param {FundingPaymentMethod} method
 */
export function rememberFundingPaymentSource(payPalOrderId, method) {
  if (typeof window === "undefined" || !payPalOrderId) return;
  try {
    sessionStorage.setItem(`${SESSION_PREFIX}${payPalOrderId}`, method);
  } catch {
    /* ignore quota / privacy mode */
  }
}

/**
 * @param {string | null | undefined} payPalOrderId
 * @returns {FundingPaymentMethod | null}
 */
export function readStoredFundingPaymentSource(payPalOrderId) {
  if (typeof window === "undefined" || !payPalOrderId) return null;
  try {
    const v = sessionStorage.getItem(`${SESSION_PREFIX}${payPalOrderId}`);
    if (v === FUNDING_METHOD_CARD || v === FUNDING_METHOD_PAYPAL) return v;
    return null;
  } catch {
    return null;
  }
}

/**
 * @param {string} text
 * @returns {string | null}
 */
export function extractPayPalOrderIdFromText(text) {
  const s = String(text || "");
  const m = s.match(/paypal\s+order\s+([A-Z0-9]+(?:-[A-Z0-9]+)*)/i);
  return m ? m[1].trim() : null;
}

/**
 * @param {Record<string, unknown>} txn
 * @returns {string | null}
 */
export function extractPayPalOrderIdFromTransaction(txn) {
  const blob = [txn.description, txn.message, txn.notes, txn.memo, txn.reference]
    .filter((v) => v != null && v !== "")
    .map((v) => (typeof v === "string" ? v : String(v)))
    .join(" ");
  return extractPayPalOrderIdFromText(blob);
}

/**
 * Resolve Card vs PayPal for a stored transaction (no capture API changes).
 * Uses session memory from a recent fund-wallet completion when the PayPal order id matches.
 * @param {Record<string, unknown>} txn
 * @returns {FundingPaymentMethod}
 */
export function resolveFundingMethodForTransaction(txn) {
  const orderId = extractPayPalOrderIdFromTransaction(txn);
  const stored = orderId ? readStoredFundingPaymentSource(orderId) : null;
  if (stored) return stored;
  return FUNDING_METHOD_PAYPAL;
}
