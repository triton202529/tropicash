/**
 * Phase 13B: PayPal Payout readiness (presence checks only — never expose secrets).
 */

import { getPayPalMode } from "./paypalMode";

/**
 * Client-safe checks from NEXT_PUBLIC_* vars (available in browser bundle).
 */
export function getPublicPayPalPayoutReadiness() {
  const automationFlag = process.env.NEXT_PUBLIC_WITHDRAWAL_AUTOMATED_PAYOUT;
  const automationEnabled = automationFlag === "true";
  const publicModeRaw = process.env.NEXT_PUBLIC_PAYPAL_MODE;
  const publicMode =
    typeof publicModeRaw === "string" && publicModeRaw.trim()
      ? publicModeRaw.trim().toLowerCase()
      : null;

  return {
    automationEnabled,
    automationFlagSet: typeof automationFlag === "string" && automationFlag.length > 0,
    publicMode: publicMode === "live" || publicMode === "sandbox" ? publicMode : null,
  };
}

/**
 * @param {ReturnType<typeof getPublicPayPalPayoutReadiness>} publicPart
 * @param {{
 *   clientIdPresent?: boolean;
 *   clientSecretPresent?: boolean;
 *   serviceRolePresent?: boolean;
 *   paypalMode?: string;
 *   senderEmailConfigured?: boolean;
 *   error?: string;
 * } | null} serverPart
 */
export function buildPayPalPayoutReadiness(publicPart, serverPart) {
  const mode =
    serverPart?.paypalMode === "live" || serverPart?.paypalMode === "sandbox"
      ? serverPart.paypalMode
      : publicPart.publicMode || "sandbox";

  const serverCredentialsReady = !!(
    serverPart?.clientIdPresent && serverPart?.clientSecretPresent && serverPart?.serviceRolePresent
  );

  const senderEmailConfigured = !!serverPart?.senderEmailConfigured;
  const payoutActionAvailable = publicPart.automationEnabled && serverCredentialsReady;

  const blockers = [];
  if (!publicPart.automationEnabled) {
    blockers.push("Set NEXT_PUBLIC_WITHDRAWAL_AUTOMATED_PAYOUT=true to enable Send payout (PayPal).");
  }
  if (!serverPart?.clientIdPresent) {
    blockers.push("Server PAYPAL_CLIENT_ID is not configured.");
  }
  if (!serverPart?.clientSecretPresent) {
    blockers.push("Server PAYPAL_CLIENT_SECRET is not configured.");
  }
  if (!serverPart?.serviceRolePresent) {
    blockers.push("SUPABASE_SERVICE_ROLE_KEY is required for payout API routes.");
  }
  if (serverPart?.error) {
    blockers.push(`Could not verify server credentials: ${serverPart.error}`);
  }

  const checks = [
    {
      id: "automation",
      label: "Automated payout feature flag",
      status: publicPart.automationEnabled ? "ready" : "missing",
      detail: publicPart.automationEnabled
        ? "NEXT_PUBLIC_WITHDRAWAL_AUTOMATED_PAYOUT=true"
        : "NEXT_PUBLIC_WITHDRAWAL_AUTOMATED_PAYOUT is not true",
    },
    {
      id: "mode",
      label: "PayPal mode",
      status: mode === "live" || mode === "sandbox" ? "ready" : "partial",
      detail: `Mode: ${mode} (PAYPAL_MODE / NEXT_PUBLIC_PAYPAL_MODE)`,
    },
    {
      id: "client_id",
      label: "Server PAYPAL_CLIENT_ID",
      status: serverPart?.clientIdPresent ? "ready" : serverPart == null ? "partial" : "missing",
      detail: serverPart?.clientIdPresent ? "Configured (value not shown)" : "Missing or not verified",
    },
    {
      id: "client_secret",
      label: "Server PAYPAL_CLIENT_SECRET",
      status: serverPart?.clientSecretPresent ? "ready" : serverPart == null ? "partial" : "missing",
      detail: serverPart?.clientSecretPresent ? "Configured (value not shown)" : "Missing or not verified",
    },
    {
      id: "service_role",
      label: "Supabase service role (payout API)",
      status: serverPart?.serviceRolePresent ? "ready" : serverPart == null ? "partial" : "missing",
      detail: serverPart?.serviceRolePresent ? "Configured (value not shown)" : "Missing or not verified",
    },
    {
      id: "sender_email",
      label: "PAYPAL_PAYOUTS_SENDER_EMAIL",
      status: senderEmailConfigured ? "ready" : "partial",
      detail: senderEmailConfigured
        ? "Sender email configured (optional; value not shown)"
        : "Optional — not set; PayPal may use default business profile",
    },
    {
      id: "payout_action",
      label: "Send payout (PayPal) action",
      status: payoutActionAvailable ? "ready" : "missing",
      detail: payoutActionAvailable
        ? "Available when a request is pending with a payout email"
        : "Unavailable until feature flag and server credentials are ready",
    },
  ];

  return {
    automationEnabled: publicPart.automationEnabled,
    mode,
    serverCredentialsReady,
    senderEmailConfigured,
    payoutActionAvailable,
    blockers,
    checks,
    serverProbeOk: serverPart != null && !serverPart.error,
  };
}

/**
 * Server-side readiness (API routes only).
 */
export function getServerPayPalPayoutReadiness() {
  return {
    clientIdPresent: !!(process.env.PAYPAL_CLIENT_ID && String(process.env.PAYPAL_CLIENT_ID).trim()),
    clientSecretPresent: !!(
      process.env.PAYPAL_CLIENT_SECRET && String(process.env.PAYPAL_CLIENT_SECRET).trim()
    ),
    serviceRolePresent: !!(
      process.env.SUPABASE_SERVICE_ROLE_KEY && String(process.env.SUPABASE_SERVICE_ROLE_KEY).trim()
    ),
    paypalMode: getPayPalMode(),
    senderEmailConfigured: !!(
      process.env.PAYPAL_PAYOUTS_SENDER_EMAIL && String(process.env.PAYPAL_PAYOUTS_SENDER_EMAIL).trim()
    ),
    senderEmailOptional: true,
  };
}
