/**
 * Normalize PayPal REST error JSON for persistence and API responses.
 *
 * @param {Record<string, unknown>|null|undefined} raw - Parsed JSON body from PayPal
 * @param {number|null|undefined} httpStatus
 * @returns {{
 *   name: string | null;
 *   message: string | null;
 *   details: unknown;
 *   httpStatus: number | null;
 *   phase: string | null;
 *   fullResponseBody: Record<string, unknown>;
 * }}
 */
export function buildPayPalPayoutErrorDetails(raw, httpStatus, phase = null) {
  const body =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? /** @type {Record<string, unknown>} */ (raw)
      : {};
  return {
    name: body.name != null ? String(body.name) : null,
    message: body.message != null ? String(body.message) : null,
    details: body.details !== undefined ? body.details : null,
    httpStatus: httpStatus != null && Number.isFinite(Number(httpStatus)) ? Number(httpStatus) : null,
    phase: phase || null,
    fullResponseBody: body,
  };
}

/**
 * @param {unknown} err
 * @param {{ httpStatus?: number | null; phase?: string }} [meta]
 */
export function buildPayPalPayoutErrorFromException(err, meta = {}) {
  const msg = err && typeof err === "object" && "message" in err && err.message != null ? String(err.message) : String(err);
  const name =
    err && typeof err === "object" && "name" in err && err.name != null ? String(err.name) : "Error";
  return {
    name,
    message: msg,
    details: null,
    httpStatus: meta.httpStatus != null ? meta.httpStatus : null,
    phase: meta.phase || "request",
    fullResponseBody: {},
  };
}

const FAILURE_REASON_MAX = 12000;

/**
 * @param {Record<string, unknown>} paypalError
 */
export function stringifyFailureReason(paypalError) {
  try {
    const s = JSON.stringify(paypalError);
    return s.length > FAILURE_REASON_MAX ? s.slice(0, FAILURE_REASON_MAX) : s;
  } catch {
    return JSON.stringify({
      name: "Error",
      message: "Could not serialize PayPal error",
      details: null,
      fullResponseBody: {},
    });
  }
}

/**
 * @param {Record<string, unknown>} paypalError
 */
export function throwPayPalPayoutFailed(paypalError) {
  const summary =
    (paypalError.message && String(paypalError.message)) ||
    (paypalError.name && String(paypalError.name)) ||
    "PayPal payout failed";
  const err = new Error(summary);
  err.paypalError = paypalError;
  throw err;
}
