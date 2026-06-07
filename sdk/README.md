# @tropicash/sdk

Official Tropicash JavaScript SDK.

> **Status:** Private / internal preview (`"private": true`). **Not published to
> npm.** Sandbox is available; **production is disabled**. No money-movement APIs
> are exposed yet.

---

## Overview

The Tropicash SDK removes boilerplate so you can integrate without hand-writing
authentication, request handling, webhook verification, and environment
management. It currently exposes the first **read-only, non-financial** Developer
APIs and a webhook signature verifier.

It ships three building blocks:

- **`TropicashClient`** — authenticated API client.
- **`TropicashEnvironment`** — sandbox/production awareness (production disabled).
- **`TropicashWebhookVerifier`** — HMAC-SHA256 signature + replay verification.

## Installation

The package is **not published yet**. Package publishing is planned for a future
release. For now it lives in-repo under `sdk/` and is consumed locally:

```js
import { TropicashClient } from "./sdk/index.js";
```

When published, installation will be:

```bash
npm install @tropicash/sdk
```

## Quick Start

```js
import { TropicashClient } from "@tropicash/sdk";

const client = new TropicashClient({
  apiKey: "tc_test_xxx",
  environment: "sandbox",
  // Outside a browser, set an absolute base URL:
  // baseUrl: "https://your-app.example/api/developer",
});

const status = await client.platformStatus();
// => { ok: true, environment: "sandbox", status: "operational", version: "v1", timestamp: "..." }
```

See [`examples/basic-usage.js`](./examples/basic-usage.js) and
[`examples/webhook-verification.js`](./examples/webhook-verification.js).

## Environment Support

| Environment | Status | Base URL |
|---|---|---|
| `sandbox` | **Available** | `/api/developer` (relative; override with `baseUrl` outside the browser) |
| `production` | **Disabled** | Reserved — throws a descriptive error |

```js
import { TropicashEnvironment } from "@tropicash/sdk";

const env = new TropicashEnvironment("sandbox");
env.isSandbox();    // true
env.isProduction(); // false
env.getBaseUrl();   // "/api/developer"

new TropicashEnvironment("production").getBaseUrl();
// throws: "Production environment is not enabled yet. ..."
```

## Authentication

Pass your sandbox API key (`tc_test_…`) once. The client attaches it as a bearer
token on every request:

```
Authorization: Bearer tc_test_xxx
```

`validateConfiguration()` checks the key format and environment before any
request is made. A sandbox client requires a `tc_test_` key; production keys and
the production environment are rejected while production is disabled.

Every API request is authenticated, **rate-limited**, and **usage-logged** by the
Tropicash gateway before any data is returned.

## Available Methods

| Method | Endpoint | Returns |
|---|---|---|
| `ping()` | `GET /ping` | `{ ok, environment }` |
| `platformStatus()` | `GET /platform-status` | `{ ok, environment, status, version, timestamp }` |
| `supportedCurrencies()` | `GET /supported-currencies` | `{ ok, currencies: [{ code, name, status }] }` |
| `profile()` | `GET /profile` | `{ ok, organization_id, app_id, environment, public_key, status }` |

Reserved namespaces (`client.wallets`, `client.payments`, `client.withdrawals`,
`client.accounts`, `client.webhooks`) exist as clean extension points and throw a
descriptive error until implemented in a future release.

## Webhook Verification

```js
import { TropicashWebhookVerifier } from "@tropicash/sdk";

const verifier = new TropicashWebhookVerifier(process.env.TROPICASH_WEBHOOK_SECRET);

const { valid, error } = await verifier.verifySignature({
  payload: rawBody,                                  // exact raw request body
  signature: req.headers["x-tropicash-signature"],   // hex HMAC-SHA256
  timestamp: req.headers["x-tropicash-timestamp"],   // enables replay protection
});

if (!valid) {
  // reject the delivery
}
```

- **HMAC-SHA256** over `${timestamp}.${rawBody}` (raw body when no timestamp).
- **Constant-time** signature comparison.
- **Replay protection** via a configurable `toleranceSeconds` window (default 300s).

## Production Status

Production is **disabled**. `TropicashEnvironment` and `TropicashClient` reject
the `production` environment and `tc_live_…` usage with descriptive errors.
Production access will be enabled in a future Tropicash release.

## Roadmap

- ✅ Sandbox client, environment manager, webhook verifier.
- ✅ Read-only APIs: platform status, supported currencies, developer profile.
- ⏳ User-consent (OAuth) flow for user-scoped reads (wallet, transactions).
- ⏳ Value-movement APIs (payments, withdrawals) — last, highest assurance.
- ⏳ Public npm publishing.

## Security Notes

- Never commit API keys or webhook secrets. Use environment variables.
- Webhook secrets are sensitive — store them securely and rotate via the
  Developer Console.
- Always verify webhook signatures against the **raw** request body, before
  parsing.
- No money-movement or user-sensitive APIs are exposed in this release.
- This package is private/internal and not yet published.
