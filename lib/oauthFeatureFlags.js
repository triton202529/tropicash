/**
 * Tropicash — OAuth feature flags (Phase 12O).
 *
 * Authorization code issuance is gated behind a feature flag that defaults to
 * OFF. When disabled, the consent screen keeps the Approve button disabled and
 * the issuance endpoint refuses to mint codes (fail-closed).
 *
 * Two env names are honored so the flag works on both sides:
 *   • NEXT_PUBLIC_OAUTH_CODE_ISSUANCE_ENABLED — inlined into the browser bundle
 *     so the consent page can enable the Approve button.
 *   • OAUTH_CODE_ISSUANCE_ENABLED — server-only fallback for the API route.
 *
 * Anything other than the string "true" (case-insensitive) is treated as false.
 */

export function isOAuthCodeIssuanceEnabled() {
  const value =
    process.env.NEXT_PUBLIC_OAUTH_CODE_ISSUANCE_ENABLED ??
    process.env.OAUTH_CODE_ISSUANCE_ENABLED;
  return String(value).trim().toLowerCase() === 'true';
}

/**
 * Phase 12U — allow minting authorization codes WITHOUT a bound consent record
 * ("foundation mode"). Defaults to OFF: by default every authorization code must
 * bind to an active consent. Only set this when intentionally testing the legacy
 * pre-consent flow.
 *
 * Env: OAUTH_ALLOW_FOUNDATION_OAUTH_CODES (server-only). Anything other than the
 * string "true" (case-insensitive) is treated as false.
 *
 * @returns {boolean}
 */
export function isFoundationOAuthCodesAllowed() {
  return (
    String(process.env.OAUTH_ALLOW_FOUNDATION_OAUTH_CODES).trim().toLowerCase() ===
    'true'
  );
}
