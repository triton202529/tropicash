# OAuth Wallet Readiness Gate (Phase 12X)

**Status:** Assessment only — no `GET /api/oauth/wallet` endpoint exists.  
**Assessed:** 2026-06-10  
**Purpose:** Determine whether an OAuth-protected wallet read API can safely be built in sandbox.

This gate evaluates OAuth infrastructure, consent, security, wallet exposure controls, compliance, and operational readiness **before** exposing any wallet balance through a third-party OAuth application.

---

## Gate result values

| Result | Meaning |
|--------|---------|
| `READY_FOR_PROFILE_ONLY` | OAuth profile APIs may ship; wallet prerequisites not satisfied |
| `READY_FOR_WALLET_READ_SANDBOX` | All required controls pass; wallet read may be implemented in sandbox |
| `BLOCKED_PENDING_CONTROLS` | One or more controls must be implemented first |
| `BLOCKED_HIGH_RISK` | Security-critical control failed — do not expose wallet data |

**Current result (Phase 12X):** `BLOCKED_PENDING_CONTROLS`

OAuth authorization infrastructure (Phases 12L–12W) is largely complete, but operational controls — OAuth endpoint rate limits, wallet-read audit events, and an admin review path for suspicious app access — remain pending.

---

## Readiness categories

### 1. OAuth infrastructure

Required before any user-scoped OAuth API:

- OAuth client registration (12L)
- Authorization request validation (12N)
- Consent record creation (12U)
- Authorization code issuance (12O)
- Access token exchange (12P)
- Refresh token rotation (12Q)
- Token revocation endpoint (12W)
- Access token validation middleware (12R)
- Scope enforcement (12R)

**Status:** All passed.

### 2. User consent

- `wallet.read` scope exists in the catalog (high risk)
- Active / revoked consent records
- Connected apps page (`/oauth/apps`)
- Consent revocation revokes related tokens

**Status:** All passed.

### 3. Security

- Tokens and client secrets stored as hashes only
- No token hashes exposed via APIs
- OAuth profile endpoint excludes wallet data
- Introspection is enumeration-safe
- Scope enforcement active on protected APIs

**Status:** All passed.

### 4. Wallet exposure controls

Required when `/api/oauth/wallet` is implemented:

- Enforce `wallet.read` scope (middleware ready; wire on implementation)
- Minimal response schema (documented below)
- No transaction history, payment methods, or KYC documents
- No balance mutation; no send/withdraw/payout operations

**Status:** Design controls passed; scope wiring planned for implementation phase.

### 5. Compliance

- KYC status: return read-only summary enum only (never documents)
- Legal draft banner active on `/legal` pages
- Risk disclosure, privacy policy, and AML policy published

**Status:** All passed.

### 6. Operational controls

- **Blocked:** OAuth-protected endpoints lack dedicated rate limits
- **Blocked:** No wallet-read audit event type yet
- **Passed:** Policy — logs must exclude raw balances
- **Blocked:** No admin workflow for suspicious third-party wallet.read grants

---

## `wallet.read` scope rules

- Scope: `wallet.read`
- Risk level: **high**
- Requires user consent: **yes**
- Requires admin approval (production): **yes**
- Blocked in sandbox consent UI for money-movement scopes: **no** (wallet.read is high-risk read, not critical)
- Must be enforced via `requireOAuthAccessToken(req, res, { requiredScopes: ['wallet.read'] })`

---

## Allowed fields (recommended schema)

```json
{
  "ok": true,
  "wallet": {
    "user_id": "...",
    "currency": "USD",
    "available_balance": "...",
    "wallet_status": "active",
    "kyc_status": "...",
    "access_type": "oauth",
    "scope": "wallet.read"
  }
}
```

---

## Blocked fields

Never return via OAuth wallet read:

- Transaction history
- Payment methods
- Linked bank accounts
- KYC documents
- Withdrawal methods
- Fraud scores
- Internal risk notes
- Admin flags

---

## Compliance considerations

1. Third-party apps receiving `wallet.read` must be disclosed in the user consent screen with high-risk warnings.
2. Legal policies remain in draft — production wallet read requires counsel review.
3. `kyc_status` is a summary field only; full KYC records stay internal.
4. Balance values are sensitive — audit every read; never log raw balances in metadata.

---

## Launch recommendation

**Do not implement `GET /api/oauth/wallet` until:**

1. OAuth endpoint rate limiting is defined and enforced.
2. A `wallet_read` (or equivalent) audit event is added to `oauth_audit_events`.
3. An admin review path exists for anomalous `wallet.read` grants or read volume.

After those controls ship, re-run the gate. If all controls pass, implement the wallet endpoint in **sandbox only** using the recommended minimal schema and existing OAuth middleware.

**Do not** expose transaction history, payment methods, or money movement through OAuth in this phase.

---

## Related documentation

- Developer Console: `/dev-console/oauth-wallet-readiness`
- Wallet API Readiness (12G): `/dev-console/wallet-api-readiness`
- OAuth Testing: `/dev-console/oauth-testing`
