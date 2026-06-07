/**
 * @tropicash/sdk — webhook verification example.
 *
 * Demonstrates verifying an incoming Tropicash webhook delivery:
 *   • X-Tropicash-Signature  — hex HMAC-SHA256 of `${timestamp}.${rawBody}`.
 *   • X-Tropicash-Timestamp  — unix seconds, checked against a tolerance window
 *                              for replay protection.
 *
 * Run from the sdk/ directory:
 *
 *   node examples/webhook-verification.js
 *
 * This example self-signs a payload so it runs without a live endpoint. In a
 * real handler you would read the headers and the EXACT raw request body.
 */

import { TropicashWebhookVerifier } from '../index.js';

// Your webhook signing secret (whsec_...), stored securely. Demo value here.
const SIGNING_SECRET = process.env.TROPICASH_WEBHOOK_SECRET || 'whsec_demo_secret_value';

// --- Helper: produce a signature the way the Tropicash server does. ---------
async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function main() {
  const verifier = new TropicashWebhookVerifier(SIGNING_SECRET, {
    toleranceSeconds: 300,
  });

  // Simulate an incoming delivery.
  const payload = {
    id: 'evt_test_0123456789abcdef',
    type: 'developer.test',
    created_at: new Date().toISOString(),
    data: { message: 'Tropicash webhook test successful' },
  };
  const rawBody = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000); // X-Tropicash-Timestamp
  const signature = await hmacSha256Hex(SIGNING_SECRET, `${timestamp}.${rawBody}`); // X-Tropicash-Signature

  // 1. Validate the timestamp on its own (replay protection).
  console.log('validateTimestamp():', verifier.validateTimestamp(timestamp));

  // 2. Verify signature + timestamp together (the typical path).
  const result = await verifier.verifySignature({
    payload: rawBody,
    signature,
    timestamp,
  });
  console.log('verifySignature():', result); // => { valid: true }

  // 3. A tampered payload fails verification.
  const tampered = await verifier.verifySignature({
    payload: rawBody + ' ',
    signature,
    timestamp,
  });
  console.log('tampered payload:', tampered); // => { valid: false, error: 'Signature mismatch.' }
}

main().catch((err) => {
  console.error('Example failed:', err);
  process.exitCode = 1;
});
