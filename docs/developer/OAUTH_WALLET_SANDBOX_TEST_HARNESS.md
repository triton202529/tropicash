# OAuth Wallet Sandbox Test Harness (Phase 13A)

## Purpose

The OAuth Wallet Sandbox Test Harness is an **interactive, sandbox-only** developer console tool that walks operators through the complete OAuth wallet-read flow end-to-end:

1. Select an OAuth client
2. Generate an authorization URL (`profile.read` + `wallet.read`)
3. Complete user consent
4. Exchange the authorization code for tokens
5. Call `GET /api/oauth/profile`
6. Call `GET /api/oauth/wallet`
7. Refresh tokens
8. Revoke the access token
9. Confirm the revoked token is rejected

**Route:** `/dev-console/oauth-wallet-test`

This harness is for **testing and diagnostics only**. It does not add wallet capabilities, expose money movement, or mutate balances.

## Safety warnings

- **Sandbox only** — production OAuth is disabled.
- **No live money movement** — the harness cannot send money, withdraw, or create transactions.
- **Session-only secrets** — `client_secret`, authorization codes, and tokens are held in React state only for the current page session.
- **No persistence** — nothing is written to `localStorage`, `sessionStorage`, or the database from this page.
- **Do not paste production secrets** — use sandbox OAuth clients only.
- **Client secret hash never shown** — only the public `client_id` and redirect URIs are loaded from the database.

## Test steps

| Step | Action | Expected result |
|------|--------|-----------------|
| 1 | Select OAuth client + redirect URI | Client metadata visible; no `client_secret_hash` |
| 2 | Generate authorization URL | URL contains `scope=profile.read wallet.read` and `state` |
| 3 | Open consent screen | User approves scopes on `/oauth/authorize` |
| 4 | Paste authorization code | `tc_auth_…` captured in session state |
| 5 | Exchange code for tokens | `200` with `access_token` + `refresh_token` |
| 6 | Call profile API | `200`, `profile.access_type === "oauth"` |
| 7 | Call wallet API | `200`, `wallet.scope === "wallet.read"` (or safe `consent_required` for foundation tokens) |
| 8 | Refresh token | New token pair issued; old refresh revoked |
| 9 | Revoke access token | `{ ok: true, revoked: true }` |
| 10 | Call profile with revoked token | `401`, `error: "invalid_token"` |

### Optional: introspection

Between steps 6–9 you may introspect the access token via `POST /api/oauth/introspect`. Expect `active: true` before revocation and `active: false` after.

## Expected wallet response (success)

```json
{
  "ok": true,
  "wallet": {
    "user_id": "...",
    "currency": "USD",
    "available_balance": "0.00",
    "wallet_status": "active",
    "kyc_status": "unverified",
    "access_type": "oauth",
    "scope": "wallet.read",
    "environment": "sandbox"
  }
}
```

The response intentionally excludes transaction history, payment methods, KYC documents, and internal risk data.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `invalid_client` on token exchange | Wrong `client_secret` or disabled client | Re-copy secret from one-time issuance modal; verify client is `active` |
| `invalid_grant` on code exchange | Expired or reused authorization code | Complete consent again; exchange within ~10 minutes |
| `insufficient_scope` on wallet | Token missing `wallet.read` | Regenerate authorization URL with both scopes |
| `consent_required` on wallet | Foundation-mode token without user consent | Complete full consent flow (not foundation OAuth codes) |
| `rate_limit_exceeded` | Too many requests per hour | Wait and retry (60 wallet reads/hour per token) |
| `invalid_token` after revoke | Expected on step 10 | Confirms revocation worked |

## Known limitations

- **Sandbox only** — no production wallet OAuth surface.
- **Manual client secret** — the secret is not retrievable after creation; you must paste it each session.
- **No automated consent** — a human must approve on `/oauth/authorize`.
- **Read-only wallet** — balance is displayed but never modified by this harness.
- **Critical scopes disabled** — `payments.create` and `withdrawals.create` cannot be selected.
- **Single-user testing** — typically the logged-in developer completes consent as the test user.

## Related modules

- `lib/oauthWalletTestHarness.js` — pure step/URL/sanitize helpers
- `pages/dev-console/oauth-wallet-test.jsx` — interactive UI
- `GET /api/oauth/wallet` — Phase 12Z wallet read endpoint
- `/dev-console/oauth-wallet-readiness` — readiness gate assessment
