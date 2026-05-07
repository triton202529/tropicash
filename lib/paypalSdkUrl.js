/**
 * PayPal JS SDK loader URL for fund-wallet (browser only).
 * Caribbean-friendly locale; currency USD; intent capture — no buyer-country lock.
 */

const PAYPAL_JS_SDK_BASE = "https://www.paypal.com/sdk/js";

/** PayPal JS SDK `locale` query value (underscore country). Antigua & Barbuda English. */
export const PAYPAL_FUND_CHECKOUT_LOCALE = "en_AG";

export function buildPayPalFundWalletSdkUrl(clientId) {
  const params = new URLSearchParams({
    "client-id": clientId,
    currency: "USD",
    intent: "capture",
    locale: PAYPAL_FUND_CHECKOUT_LOCALE,
  });
  return `${PAYPAL_JS_SDK_BASE}?${params.toString()}`;
}
