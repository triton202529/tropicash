/**
 * Tropicash — Phase 12S OAuth-protected profile response builder.
 *
 * Pure, side-effect-free shaping of the safe profile payload returned by
 * `GET /api/oauth/profile`. It NEVER queries wallet, transaction, or KYC tables
 * and only echoes safe, non-secret fields already present on the authenticated
 * OAuth access-token context.
 *
 * Explicitly excluded: email, phone, wallet balance, transaction history, KYC
 * documents, payment methods, secrets, token hashes.
 */

const OAUTH_PROFILE_ENVIRONMENT = 'sandbox';

/**
 * Build the safe profile response from a validated OAuth access-token context.
 *
 * @param {{
 *   user_id?: string|null;
 *   app_id?: string|null;
 *   client_id?: string|null;
 *   scopes?: string[];
 * }} context  Context returned by requireOAuthAccessToken().
 * @returns {{ ok: true; profile: object }}
 */
export function buildOAuthProfileResponse(context) {
  const ctx = context && typeof context === 'object' ? context : {};
  const userId = ctx.user_id ?? null;

  const profile = {
    user_id: userId,
    app_id: ctx.app_id ?? null,
    client_id: ctx.client_id ?? null,
    scopes: Array.isArray(ctx.scopes) ? ctx.scopes : [],
    environment: OAUTH_PROFILE_ENVIRONMENT,
    access_type: 'oauth',
  };

  // Foundation-phase tokens may be issued without a linked consent (no user).
  if (userId === null) {
    profile.consent_status = 'foundation_mode';
  }

  return { ok: true, profile };
}

export default buildOAuthProfileResponse;
