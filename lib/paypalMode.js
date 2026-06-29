/**
 * Centralized PayPal mode resolution for both client and server.
 *
 * - Server reads PAYPAL_MODE first, then NEXT_PUBLIC_PAYPAL_MODE.
 * - Browser reads NEXT_PUBLIC_PAYPAL_MODE only (server-only vars are not
 *   inlined into the bundle by Next.js).
 *
 * Unknown / missing values normalize to "sandbox". In development the
 * helper warns at most once when it had to coerce an unexpected literal
 * (e.g. "Live" or "production") back to sandbox.
 */

const VALID_MODES = ["sandbox", "live"];

let warnedInvalid = false;
let warnedMismatch = false;

function normalize(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed;
}

function warnOnceInvalid(rawValue, source) {
  if (warnedInvalid) return;
  if (process.env.NODE_ENV !== "development") return;
  warnedInvalid = true;
  console.warn(
    `[paypalMode] Invalid ${source} value "${rawValue}" — expected "sandbox" or "live". Falling back to sandbox.`,
  );
}

function warnProductionModeMismatch(serverMode, publicMode) {
  if (warnedMismatch) return;
  if (process.env.NODE_ENV !== "production") return;
  if (!serverMode || !publicMode || serverMode === publicMode) return;
  warnedMismatch = true;
  console.error(
    `[paypalMode] CRITICAL: PAYPAL_MODE (${serverMode}) !== NEXT_PUBLIC_PAYPAL_MODE (${publicMode})`,
  );
}

/**
 * @returns {"sandbox"|"live"}
 */
export function getPayPalMode() {
  const isServer = typeof window === "undefined";
  let resolvedServerMode = null;

  if (isServer) {
    const serverRaw = process.env.PAYPAL_MODE;
    const serverNormalized = normalize(serverRaw);
    if (serverNormalized) {
      if (VALID_MODES.includes(serverNormalized)) {
        resolvedServerMode = serverNormalized;
        return serverNormalized;
      }
      warnOnceInvalid(serverRaw, "PAYPAL_MODE");
    }
  }

  const publicRaw = process.env.NEXT_PUBLIC_PAYPAL_MODE;
  const publicNormalized = normalize(publicRaw);
  if (publicNormalized) {
    if (VALID_MODES.includes(publicNormalized)) {
      if (isServer) {
        warnProductionModeMismatch(resolvedServerMode || normalize(process.env.PAYPAL_MODE), publicNormalized);
      }
      return publicNormalized;
    }
    warnOnceInvalid(publicRaw, "NEXT_PUBLIC_PAYPAL_MODE");
  }

  return "sandbox";
}

/**
 * Whether the current PayPal mode is "live".
 * @returns {boolean}
 */
export function isPayPalLive() {
  return getPayPalMode() === "live";
}
