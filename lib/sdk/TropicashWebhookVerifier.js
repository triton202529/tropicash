/**
 * Tropicash SDK — Phase 12F webhook signature verifier.
 *
 * Verifies the HMAC-SHA256 signatures produced by the Phase 12D webhook layer:
 *   • Header `X-Tropicash-Signature`  — hex HMAC-SHA256.
 *   • Header `X-Tropicash-Timestamp`  — unix seconds (signed as `${ts}.${body}`).
 *
 * Guarantees:
 *   • HMAC-SHA256 verification using the provided signing secret.
 *   • Constant-time signature comparison (no early-exit timing leak).
 *   • Replay-protection foundation via a configurable timestamp tolerance.
 *
 * Preparation for future real webhook events — no events are emitted here.
 */

export const DEFAULT_TOLERANCE_SECONDS = 300;

function getCrypto() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (!c || !c.subtle) {
    throw new Error('Web Crypto API is unavailable in this environment.');
  }
  return c;
}

async function hmacSha256Hex(secret, message) {
  const c = getCrypto();
  const enc = new TextEncoder();
  const key = await c.subtle.importKey(
    'raw',
    enc.encode(String(secret)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await c.subtle.sign('HMAC', key, enc.encode(String(message)));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Constant-time string comparison. Returns false for length mismatch without
 * leaking position information via early return.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export class TropicashWebhookVerifier {
  /**
   * @param {string} secret  The webhook signing secret used to verify deliveries.
   * @param {{ toleranceSeconds?: number }} [options]
   */
  constructor(secret, options = {}) {
    if (typeof secret !== 'string' || !secret.trim()) {
      throw new Error('A webhook signing secret is required.');
    }
    this.secret = secret.trim();
    this.toleranceSeconds = Number.isFinite(options?.toleranceSeconds)
      ? Math.max(0, Math.floor(options.toleranceSeconds))
      : DEFAULT_TOLERANCE_SECONDS;
  }

  /**
   * Validate that a timestamp is within the allowed tolerance window (replay
   * protection foundation).
   *
   * @param {number|string} timestamp  unix seconds
   * @param {number} [toleranceSeconds]
   * @returns {{ valid: boolean; error?: string; ageSeconds?: number }}
   */
  validateTimestamp(timestamp, toleranceSeconds = this.toleranceSeconds) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) {
      return { valid: false, error: 'Invalid or missing timestamp.' };
    }
    const now = Math.floor(Date.now() / 1000);
    const ageSeconds = Math.abs(now - ts);
    if (ageSeconds > toleranceSeconds) {
      return {
        valid: false,
        error: 'Timestamp is outside the allowed tolerance window (possible replay).',
        ageSeconds,
      };
    }
    return { valid: true, ageSeconds };
  }

  /**
   * Verify a webhook signature.
   *
   * When a timestamp is supplied it is validated against the tolerance window
   * and the signed content is `${timestamp}.${body}` (matching the server). When
   * omitted, the raw body is verified directly.
   *
   * @param {{
   *   payload: object|string;
   *   signature: string;
   *   timestamp?: number|string;
   *   toleranceSeconds?: number;
   * }} params
   * @returns {Promise<{ valid: boolean; error?: string }>}
   */
  async verifySignature(params = {}) {
    const { payload, signature, timestamp, toleranceSeconds } = params || {};

    if (typeof signature !== 'string' || !signature.trim()) {
      return { valid: false, error: 'Missing signature.' };
    }

    const body = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});

    let signedContent = body;
    if (timestamp != null) {
      const tsCheck = this.validateTimestamp(
        timestamp,
        toleranceSeconds ?? this.toleranceSeconds,
      );
      if (!tsCheck.valid) {
        return { valid: false, error: tsCheck.error };
      }
      signedContent = `${timestamp}.${body}`;
    }

    let expected;
    try {
      expected = await hmacSha256Hex(this.secret, signedContent);
    } catch (err) {
      return { valid: false, error: err?.message || 'Failed to compute signature.' };
    }

    const valid = constantTimeEqual(expected, signature.trim());
    return valid ? { valid: true } : { valid: false, error: 'Signature mismatch.' };
  }
}

export default TropicashWebhookVerifier;
