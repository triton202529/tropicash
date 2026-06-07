/**
 * Tropicash Developer API — Phase 12H supported currencies.
 *
 * Hardcoded reference data for the public `GET /api/developer/supported-currencies`
 * endpoint. This is non-financial, non-user-sensitive informational data
 * (PUBLIC data class per the Phase 12G readiness assessment).
 *
 * Future phases may move this to database-backed configuration; the response
 * shape is intentionally stable so that migration is transparent to clients.
 *
 * No money movement, balances, or user data are involved.
 */

/**
 * @typedef {{ code: string; name: string; status: 'active' | 'planned' }} SupportedCurrency
 */

/** @type {SupportedCurrency[]} */
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', status: 'active' },
  { code: 'HTG', name: 'Haitian Gourde', status: 'active' },
];

/**
 * Return a defensive copy of the supported currency list so callers cannot
 * mutate the shared reference data.
 *
 * @returns {SupportedCurrency[]}
 */
export function getSupportedCurrencies() {
  return SUPPORTED_CURRENCIES.map((c) => ({ ...c }));
}
