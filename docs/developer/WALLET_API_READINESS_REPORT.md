# Tropicash Wallet API Readiness Report

**Phase:** 12G — Wallet API Readiness Assessment
**Status:** Assessment complete — **no external wallet APIs exposed, no money movement enabled**
**Assessed:** 2026-06-06

> This is a governance and assessment document. It defines what *would* be
> required before any wallet capability is exposed to third-party developers. It
> creates no endpoints and changes no wallet, transaction, withdrawal, treasury,
> fraud, PayPal, or KYC behavior. The machine-readable source of truth is
> [`lib/walletApiReadiness.js`](../../lib/walletApiReadiness.js); the Developer
> Console renders it at `/dev-console/wallet-api-readiness`.

---

## 1. Executive summary

The developer platform now has a working **app-level** trust foundation:
issued/hashed API credentials (12A/12B), webhook registration + signing (12D),
usage logging (12C), and fail-closed rate limiting (12C). This is sufficient to
expose **public, non-user-linked** endpoints today.

It is **not yet sufficient** to expose any user wallet data or any money
movement. The two blocking gaps are:

1. **No user-consent layer.** Nothing lets a Tropicash user authorize a
   third-party app to read *their* wallet/transactions. Until this exists, no
   `SENSITIVE` data can be exposed.
2. **No value-movement assurance.** No signed intents, idempotency, step-up
   auth, or fraud/KYC integration for developer-initiated transfers.

Recommendation: ship **Tier 1 (public)** endpoints on the existing pipeline,
then build the consent layer before Tier 2.

---

## 2. Authentication requirements

### Current capabilities

| Capability | Phase | State | Notes |
|---|---|---|---|
| Developer API keys | 12A/12B | live (sandbox) | Hashed secrets, bearer auth, status/env/expiry/linkage checks |
| Webhooks | 12D | live (sandbox) | HTTPS endpoints, hashed `whsec_` secrets, HMAC-SHA256 + replay protection |
| Usage tracking | 12C | live (sandbox) | Append-only logs; no secrets/headers recorded |
| Rate limiting | 12C | live (sandbox) | 100/hour, 1000/day per key; fail-closed |

### Additional controls required

- **App authorization (have):** the API key identifies app + org. Good enough
  for `PUBLIC` data only. Missing: per-scope entitlement on the key, app review
  before sensitive scopes.
- **User authorization (need):** an OAuth-style consent flow issuing scoped,
  revocable, expiring per-user tokens. Required for every `RESTRICTED`/
  `SENSITIVE` user endpoint.
- **Step-up authorization (need):** fresh per-transaction user authorization for
  all `CRITICAL` operations — never a standing token.
- **Platform/internal (enforce):** treasury, fraud, KYC, admin must be **denied
  at the gateway** to all developer credentials, not merely undocumented.

### Operation → authorization mapping

| Operation type | Requires |
|---|---|
| Public reference data | App key |
| Own developer profile | App key (self-scoped) |
| User wallet / transactions (read) | App key **+ user consent** |
| Send money / withdraw | **Step-up per-operation user auth** |
| Treasury / fraud / admin | Internal only (never developer-reachable) |

---

## 3. Data classification matrix

| Level | Authorization | Examples | Handling |
|---|---|---|---|
| **PUBLIC** | App key only | supported currencies, platform status, public fees | Cacheable, no user linkage |
| **RESTRICTED** | App key + user consent (read) | developer profile, wallet metadata, display name | Identifies a user, no balances |
| **SENSITIVE** | App key + explicit scoped consent | wallet balance, transaction history, linked payment methods | Per-scope consent, audit, tight limits |
| **CRITICAL** | Step-up per-operation auth | send money, withdraw, modify balances, create transactions | Signed intent, idempotency, fraud + KYC |

---

## 4. API exposure review

| Method | Endpoint (proposed) | Category | Data class | Scope |
|---|---|---|---|---|
| GET | /platform-status | Safe for early access | PUBLIC | — |
| GET | /supported-currencies | Safe for early access | PUBLIC | — |
| GET | /developer/profile | Safe for early access | RESTRICTED | profile.read |
| GET | /wallet | Requires user consent | SENSITIVE | wallet.read |
| GET | /transactions | Requires user consent | SENSITIVE | transactions.read |
| GET | /payment-methods | Requires user consent | SENSITIVE | wallet.read |
| POST | /send-money | High risk | CRITICAL | payments.create |
| POST | /withdraw | High risk | CRITICAL | withdrawals.create |
| — | Treasury controls | Internal only | CRITICAL | — |
| — | Fraud controls | Internal only | CRITICAL | — |
| — | Admin operations | Internal only | CRITICAL | — |

*None of these endpoints exist. This table describes intended shape and
governance only.*

---

## 5. Permission model (scope matrix)

| Scope | Description | Risk | Data class | Future approval |
|---|---|---|---|---|
| `profile.read` | Read own developer/app profile | low | RESTRICTED | Self-serve (sandbox) |
| `wallet.read` | Read wallet metadata + balance (consenting user) | high | SENSITIVE | User consent + app review |
| `transactions.read` | Read transaction history (consenting user) | high | SENSITIVE | User consent + app review |
| `payments.create` | Initiate a transfer for a consenting user | critical | CRITICAL | Manual approval + signed agreement + step-up |
| `withdrawals.create` | Initiate an off-platform withdrawal | critical | CRITICAL | Compliance review + step-up |
| `webhooks.manage` | Register/rotate/disable webhooks | medium | RESTRICTED | Self-serve (app-scoped) |
| `developer.manage` | Manage org apps/keys/settings | medium | RESTRICTED | Org owners only |

*Scopes are design-only — no scope enforcement is implemented in this phase.*

---

## 6. Consent model recommendations

**How does a user authorize a third-party app?**
OAuth 2.0 authorization-code + PKCE. The app redirects to a Tropicash-hosted
consent screen listing the exact requested scopes; the signed-in user approves,
and Tropicash issues a scoped, app-bound access token (+ refresh token). The app
key alone never grants user data.

**How is consent revoked?**
A user-facing "Connected Apps" screen (and a developer-side revoke). Revocation
bumps a token version, immediately invalidating access + refresh tokens so
in-flight tokens stop resolving on the next request.

**How long does consent last?**
Short-lived access tokens (~30–60 min) with rotating refresh tokens. Read consent
persists until revoked but is periodically re-confirmed. `CRITICAL` operations
never rely on standing consent — each needs fresh step-up authorization.

**What audit records should exist?**
An append-only consent ledger (grant, scope change, refresh, revocation) with
timestamp, user id, app id, scope set, and IP/device. Every `SENSITIVE`/
`CRITICAL` access is logged against its consent grant for user transparency and
dispute resolution.

---

## 7. Security review

### Strengths

- Secrets stored only as SHA-256 hashes; plaintext shown once.
- Generic auth failures leak no key state (exists/revoked/expired/prod).
- Service-role lookups are server-only; `secret_hash` never leaves the server.
- Rate limiting and webhook delivery both fail closed.
- Usage logging excludes secrets, hashes, and `Authorization` headers.
- Production reserved/disabled across keys, limits, and environment manager.

### Weaknesses

| Issue | Severity | Detail |
|---|---|---|
| **Webhook secret storage limitation (12D)** | high | Only the SHA-256 hash is stored, so events are signed with the hash as key. Not developer-verifiable end-to-end; the hash is not a true HMAC secret. |
| API keys are unscoped bearer tokens | medium | A valid key can reach any endpoint it is routed to; no scope claim. |
| No user-consent / OAuth layer | high | No way for users to authorize apps, so no `SENSITIVE` data can ship. |
| Fast SHA-256 secret hashing | low | Fine for high-entropy secrets; no work factor. Consider HMAC-with-pepper/KDF. |
| No idempotency / signed-intent contract | medium | Required before any value-moving endpoint to make retries safe. |

### Required upgrades before launch

1. Encrypted-at-rest (or true HMAC) webhook secrets for verifiable signatures.
2. Scope claims on API credentials, enforced at the gateway.
3. OAuth-style user-consent layer with scoped, revocable, expiring tokens.
4. Idempotency keys + signed transaction intents for value movement.
5. Step-up authentication (re-auth / 2FA) for all `CRITICAL` operations.
6. Anomaly detection + per-app/per-user spend velocity limits into the fraud engine.

### Webhook secret storage — remediation options

1. **Encrypt at rest (recommended).** KMS envelope encryption; decrypt
   server-side only at signing time and sign with the true plaintext secret.
   *Pros:* end-to-end verifiable, never plaintext at rest. *Cons:* needs KMS;
   tightly controlled decryption path.
2. **Split secret.** Keep the hash for lookup + a separately sealed copy for
   signing. *Pros:* backwards compatible. *Cons:* two artifacts; still needs key
   management.
3. **Asymmetric signing.** Sign with a Tropicash private key; publish the public
   key for verification. *Pros:* no shared secret to protect. *Cons:* bigger
   change to signing/docs; needs rotation tooling.

---

## 8. Recommended rollout

| Tier | Scope | When | Endpoints | Gate |
|---|---|---|---|---|
| **1** | Public, no user data | First | /platform-status, /supported-currencies, /developer/profile | Existing app-key auth |
| **2** | User wallet (read) | After consent layer | /wallet | OAuth consent + `wallet.read` + audit |
| **3** | Transaction history | After Tier 2 proven | /transactions | `transactions.read` + tightened limits + audit |
| **4** | Value movement | Last | /send-money, /withdraw | Manual approval + step-up + idempotency + fraud/KYC + contract |

**Justification.** Tier 1 carries no user-data risk and proves the gateway on
the existing pipeline. Tier 2 introduces the consent model on one bounded read.
Tier 3 scales the consent model to high-volume, high-privacy history. Tier 4 —
irreversible money movement — ships only once every assurance control is in
place.

---

## 9. Validation checklist

- [x] Readiness report generated
- [x] Classification matrix completed
- [x] Scope matrix completed
- [x] Consent recommendations documented
- [x] Security findings documented
- [x] Rollout plan documented
- [x] No money movement enabled
- [x] No wallet behavior changed
