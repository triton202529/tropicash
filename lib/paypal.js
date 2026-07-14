import { getPayPalMode } from "./paypalMode";

const SANDBOX_API_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_API_BASE = "https://api-m.paypal.com";

/**
 * Resolves the PayPal mode for server-side use. Delegates to the shared
 * `getPayPalMode` helper so client and server always agree on sandbox/live.
 * Retained as a named export for callers that still import it.
 * @returns {"sandbox"|"live"}
 */
export function getResolvedPayPalMode() {
  return getPayPalMode();
}

/**
 * PayPal REST API base URL.
 * If PAYPAL_API_BASE is set to a non-empty string, it wins.
 * Otherwise: sandbox → api-m.sandbox.paypal.com, live → api-m.paypal.com
 */
export function getPayPalApiBase() {
  const explicit = process.env.PAYPAL_API_BASE;
  if (explicit != null && String(explicit).trim() !== "") {
    return String(explicit).replace(/\/$/, "");
  }
  return getPayPalMode() === "live" ? LIVE_API_BASE : SANDBOX_API_BASE;
}

/**
 * OAuth2 client-credentials token for PayPal REST API (server-side only).
 */
export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal is not configured: set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET",
    );
  }

  const base = getPayPalApiBase();
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      json.error_description ||
      json.error ||
      `PayPal token request failed (${res.status})`;
    throw new Error(msg);
  }
  if (!json.access_token) {
    throw new Error("PayPal token response did not include access_token");
  }
  return json.access_token;
}

function normalizeUsdAmount(amount) {
  const n = typeof amount === "string" ? parseFloat(amount) : Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error("Amount must be a positive number");
  }
  return n.toFixed(2);
}

/**
 * Create a PayPal order (intent CAPTURE, USD).
 * @param {number} amount - Amount in USD
 * @returns {Promise<object>} PayPal order JSON (includes id)
 */
export async function createPayPalOrder(amount) {
  const token = await getPayPalAccessToken();
  const base = getPayPalApiBase();
  const value = normalizeUsdAmount(amount);

  const res = await fetch(`${base}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": `tropicash-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      application_context: {
        locale: "en-AG",
        landing_page: "NO_PREFERENCE",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
      },
      purchase_units: [
        {
          amount: {
            currency_code: "USD",
            value,
          },
        },
      ],
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json.details?.[0]?.description || json.message || json.name;
    const msg = detail || `PayPal create order failed (${res.status})`;
    throw new Error(msg);
  }
  if (!json.id) {
    throw new Error("PayPal create order response missing id");
  }
  return json;
}

/**
 * Authenticated PayPal REST request helper. Adds OAuth bearer + base URL.
 * Returns the parsed JSON body and the underlying Response so callers can
 * inspect status codes when needed.
 *
 * @param {string} path - Path beginning with "/" (e.g. "/v1/notifications/verify-webhook-signature")
 * @param {{ method?: string; headers?: Record<string,string>; body?: BodyInit | object }} [init]
 * @returns {Promise<{ ok: boolean; status: number; json: any }>}
 */
export async function paypalApiFetch(path, init = {}) {
  if (!path || typeof path !== "string" || !path.startsWith("/")) {
    throw new Error("paypalApiFetch: path must start with '/'");
  }
  const token = await getPayPalAccessToken();
  const base = getPayPalApiBase();
  const method = (init.method || "GET").toUpperCase();
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(init.headers || {}),
  };
  let body = init.body;
  if (body != null && typeof body === "object" && !(body instanceof ArrayBuffer) && !(body instanceof Uint8Array)) {
    body = JSON.stringify(body);
  }
  const res = await fetch(`${base}${path}`, { method, headers, body });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  return { ok: res.ok, status: res.status, json };
}

/**
 * Capture payment for an approved order.
 * @param {string} orderId - PayPal order ID
 * @returns {Promise<object>} PayPal capture / order JSON
 */
export async function capturePayPalOrder(orderId) {
  if (!orderId || typeof orderId !== "string") {
    throw new Error("orderId is required");
  }

  const token = await getPayPalAccessToken();
  const base = getPayPalApiBase();
  const encodedId = encodeURIComponent(orderId);

  const res = await fetch(`${base}/v2/checkout/orders/${encodedId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issue = json.details?.[0]?.issue || null;
    const detail = json.details?.[0]?.description || json.message || json.name;
    const normalized = normalizePayPalCaptureFailure({
      status: res.status,
      issue,
      detail,
      name: json.name,
    });
    const err = new Error(normalized.message);
    err.code = normalized.code;
    err.paypalIssue = issue;
    err.httpStatus = res.status;
    throw err;
  }
  return json;
}

/**
 * Map provider capture failures to stable codes + user-safe messages.
 * Never includes PAN/CVV or tokens.
 * @param {{ status?: number; issue?: string|null; detail?: string|null; name?: string|null }} args
 */
export function normalizePayPalCaptureFailure(args) {
  const issue = String(args?.issue || "").toUpperCase();
  const name = String(args?.name || "").toUpperCase();
  const detail = String(args?.detail || "").trim();

  if (
    issue === "INSTRUMENT_DECLINED" ||
    issue === "PAYER_CANNOT_PAY" ||
    issue === "CARD_DECLINED" ||
    /DECLINED/i.test(detail)
  ) {
    return {
      code: "PROCESSOR_DECLINED",
      message: "Your card was declined by the payment provider. No money was charged. Try another card or PayPal.",
    };
  }
  if (issue === "ORDER_ALREADY_CAPTURED") {
    return {
      code: "ORDER_ALREADY_CAPTURED",
      message: "This payment was already captured.",
    };
  }
  if (issue === "PAYER_ACTION_REQUIRED" || /3DS|AUTHENTICATION|LIABILITY/i.test(detail)) {
    return {
      code: "PAYER_ACTION_REQUIRED",
      message: "Additional card authentication is required. Complete verification with your bank and try again.",
    };
  }
  return {
    code: name || "PAYPAL_CAPTURE_FAILED",
    message: detail || `PayPal capture failed (${args?.status || "unknown"})`,
  };
}
