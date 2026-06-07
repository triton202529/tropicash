/**
 * @tropicash/sdk — basic usage example.
 *
 * Demonstrates creating a client and calling the read-only sandbox APIs.
 * Run from the sdk/ directory (Node 18+ for global fetch):
 *
 *   TROPICASH_API_KEY=tc_test_xxx TROPICASH_BASE_URL=https://your-app.example node examples/basic-usage.js
 *
 * Notes:
 *   • Sandbox only. Production is disabled.
 *   • No money movement APIs are exposed.
 *   • `baseUrl` is required outside the browser because the SDK's default base
 *     URL ("/api/developer") is relative and only resolves in a browser context.
 */

import { TropicashClient } from '../index.js';

const apiKey = process.env.TROPICASH_API_KEY || 'tc_test_xxx';
const baseUrl = process.env.TROPICASH_BASE_URL || 'http://localhost:3000/api/developer';

async function main() {
  // 1. Create a client.
  const client = new TropicashClient({
    apiKey,
    environment: 'sandbox',
    baseUrl,
  });

  console.log('environment:', client.getEnvironment());

  // 2. Health check.
  const pong = await client.ping();
  console.log('ping():', pong);

  // 3. Platform status.
  const status = await client.platformStatus();
  console.log('platformStatus():', status);

  // 4. Supported currencies.
  const currencies = await client.supportedCurrencies();
  console.log('supportedCurrencies():', currencies);

  // 5. Developer profile (metadata for the calling key).
  const profile = await client.profile();
  console.log('profile():', profile);
}

main().catch((err) => {
  console.error('Example failed:', err);
  process.exitCode = 1;
});
