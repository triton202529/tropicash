/**
 * Tropicash Developer API — shared HTTP response helpers (Phase 12B).
 *
 * Centralizes the response envelope used by the Developer API surface so every
 * endpoint (ping today; payment intents, wallet, checkout, webhooks, analytics
 * in future phases) returns a consistent { ok, ... } / { ok, error } shape.
 *
 * Auth failures intentionally use ONE generic message so callers cannot infer
 * whether a key exists, is revoked, expired, or production-scoped.
 */

export const UNAUTHORIZED_ERROR = 'Unauthorized API request';
export const METHOD_NOT_ALLOWED_ERROR = 'Method not allowed';
export const SERVER_ERROR = 'Internal server error';

/**
 * Generic unauthorized response. Same body for every auth failure reason.
 * @param {import('next').NextApiResponse} res
 */
export function sendUnauthorized(res) {
  return res.status(401).json({ ok: false, error: UNAUTHORIZED_ERROR });
}

/**
 * @param {import('next').NextApiResponse} res
 * @param {string[]} allowedMethods
 */
export function sendMethodNotAllowed(res, allowedMethods = []) {
  if (allowedMethods.length) {
    res.setHeader('Allow', allowedMethods.join(', '));
  }
  return res.status(405).json({ ok: false, error: METHOD_NOT_ALLOWED_ERROR });
}

/**
 * @param {import('next').NextApiResponse} res
 * @param {number} statusCode
 * @param {string} error
 */
export function sendApiError(res, statusCode, error) {
  return res.status(statusCode).json({ ok: false, error });
}

/**
 * @param {import('next').NextApiResponse} res
 * @param {object} payload
 * @param {number} [statusCode]
 */
export function sendApiSuccess(res, payload = {}, statusCode = 200) {
  return res.status(statusCode).json({ ok: true, ...payload });
}
