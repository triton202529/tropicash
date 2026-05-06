const SANDBOX_API_BASE = "https://api-m.sandbox.paypal.com";
const LIVE_API_BASE = "https://api-m.paypal.com";

/** Optional fallback when PAYPAL_MODE is unset: TROPICASH_PAYOUT_MODE=sandbox|live */

let warnedInvalidPayPalMode = false;

/**
 * Resolves PAYPAL_MODE: "sandbox" | "live". Invalid or missing values → "sandbox" + server console.warn.
 * @returns {"sandbox"|"live"}
 */
export function getResolvedPayPalMode() {
  const raw = String(process.env.PAYPAL_MODE ?? process.env.TROPICASH_PAYOUT_MODE ?? "sandbox")
    .trim()
    .toLowerCase();
  if (raw === "sandbox" || raw === "live") return raw;
  if (!warnedInvalidPayPalMode) {
    warnedInvalidPayPalMode = true;
    console.warn(
      `[paypal] Invalid PAYPAL_MODE "${process.env.PAYPAL_MODE}", falling back to sandbox.`,
    );
  }
  return "sandbox";
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
  return getResolvedPayPalMode() === "live" ? LIVE_API_BASE : SANDBOX_API_BASE;
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
    const detail = json.details?.[0]?.description || json.message || json.name;
    const msg = detail || `PayPal capture failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}
