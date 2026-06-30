/**
 * TLP-002: PayPal sandbox/live separation and production safety checks.
 */

import { getPayPalMode } from "./paypalMode";

function normalize(raw) {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  return t || null;
}

/**
 * Validates PayPal environment configuration for the current request context.
 * @returns {{ ok: boolean; mode: "sandbox"|"live"; warnings: string[]; errors: string[] }}
 */
export function validatePayPalEnvironment() {
  const mode = getPayPalMode();
  const warnings = [];
  const errors = [];

  const publicMode = normalize(process.env.NEXT_PUBLIC_PAYPAL_MODE);
  const serverMode = normalize(process.env.PAYPAL_MODE);
  const isProduction = process.env.NODE_ENV === "production";

  if (publicMode && serverMode && publicMode !== serverMode) {
    errors.push(
      `PayPal mode mismatch: PAYPAL_MODE=${serverMode} vs NEXT_PUBLIC_PAYPAL_MODE=${publicMode}. Both must match.`,
    );
  }

  if (isProduction && mode === "sandbox") {
    warnings.push(
      "NODE_ENV is production but PayPal mode is sandbox. Live money will not flow until PAYPAL_MODE=live.",
    );
  }

  if (mode === "live") {
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      errors.push("PayPal live mode requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
    }
    if (!process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID) {
      errors.push("PayPal live mode requires NEXT_PUBLIC_PAYPAL_CLIENT_ID for the client SDK.");
    }
    if (!process.env.PAYPAL_WEBHOOK_ID?.trim()) {
      errors.push("PayPal live mode requires PAYPAL_WEBHOOK_ID for payout webhook verification.");
    }
  }

  return {
    ok: errors.length === 0,
    mode,
    warnings,
    errors,
  };
}

/**
 * Blocks money API handlers when PayPal config is invalid in production.
 * @returns {{ blocked: boolean; status: number; body: object }}
 */
export function payPalConfigGateForMoneyApi() {
  const result = validatePayPalEnvironment();
  if (result.ok) {
    return { blocked: false, status: 200, body: {} };
  }

  if (process.env.NODE_ENV === "production" && result.errors.length > 0) {
    return {
      blocked: true,
      status: 503,
      body: {
        error: "paypal_configuration_invalid",
        message: "PayPal is misconfigured for this environment. Contact support.",
        details: result.errors,
      },
    };
  }

  return { blocked: false, status: 200, body: {} };
}
