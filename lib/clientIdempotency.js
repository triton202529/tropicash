/**
 * Client-side idempotency key helpers for financial API retries (browser refresh, double-click).
 */

/**
 * @param {string} scope Stable key for this in-flight operation (user + params).
 * @returns {string}
 */
export function getOrCreateIdempotencyKey(scope) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    if (typeof window === "undefined" || !window.sessionStorage) {
      return crypto.randomUUID();
    }
    try {
      const existing = sessionStorage.getItem(scope);
      if (existing) return existing;
      const key = crypto.randomUUID();
      sessionStorage.setItem(scope, key);
      return key;
    } catch {
      return crypto.randomUUID();
    }
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** @param {string} scope */
export function clearIdempotencyKey(scope) {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    sessionStorage.removeItem(scope);
  } catch {
    /* ignore */
  }
}
