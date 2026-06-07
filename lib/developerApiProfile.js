/**
 * Tropicash Developer API — Phase 12H developer profile.
 *
 * Builds the safe, read-only metadata object returned by
 * `GET /api/developer/profile`. The input is the authenticated developer
 * context produced by `requireDeveloperApiAuth` (Phase 12B) — it already
 * excludes all secret material.
 *
 * Exposure rules (RESTRICTED data class, scoped to the calling credential):
 *   • EXPOSE: organization_id, app_id, environment, public_key, status.
 *   • NEVER EXPOSE: secret_hash, webhook secrets, user data, owner emails, or
 *     any other organization member information.
 *
 * Because authentication only succeeds for an active, sandbox credential whose
 * app + organization still exist, `status` is reported as 'active'.
 */

/**
 * @param {{
 *   organization_id: string;
 *   app_id: string;
 *   environment: string;
 *   public_key: string;
 * }} context  Authenticated developer context from requireDeveloperApiAuth.
 * @returns {{
 *   organization_id: string;
 *   app_id: string;
 *   environment: string;
 *   public_key: string;
 *   status: 'active';
 * }}
 */
export function buildDeveloperProfile(context = {}) {
  return {
    organization_id: context.organization_id,
    app_id: context.app_id,
    environment: context.environment,
    public_key: context.public_key,
    // Auth only resolves for active credentials, so this is always 'active'.
    status: 'active',
  };
}
