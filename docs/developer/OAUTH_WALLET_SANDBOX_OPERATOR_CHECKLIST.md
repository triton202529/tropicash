# OAuth Wallet Sandbox Operator Checklist (Phase 13E)

## Purpose

The OAuth Wallet Sandbox Operator Checklist is a formal operational governance workflow for executing OAuth wallet sandbox certification runs consistently.

This phase provides **operator procedures and readiness validation only**. It does not:

- Create new OAuth capabilities
- Expose new wallet data
- Enable production access
- Modify wallet balances or transaction APIs
- Change OAuth token issuance or scope permissions

**Admin route:** `/admin/oauth-wallet-sandbox-checklist`

## Required test sequence

Operators should complete checklist categories in order before submitting harness evidence for certification:

### 1. Environment Verification

- Sandbox environment confirmed
- Production OAuth disabled
- Test OAuth client available
- Test user account available
- Test wallet account available

### 2. OAuth Flow Verification

Run the harness at `/dev-console/oauth-wallet-test` and confirm:

- Authorization request generated
- Consent screen displayed
- Consent created
- Authorization code issued
- Token exchange completed
- Access token validated
- Profile endpoint successful
- Wallet endpoint successful
- Refresh token rotation successful
- Token revocation successful
- Revoked token rejected

### 3. Security Validation

Confirm evidence and platform controls:

- No client secrets stored in evidence
- No access tokens stored
- No refresh tokens stored
- No authorization codes stored
- No wallet balances stored in evidence
- Scope enforcement verified
- Rate limits verified
- Audit events recorded
- Suspicious access review functioning

### 4. Wallet Data Exposure Validation

**Allowed fields** (may appear in wallet API response):

- `user_id`
- `currency`
- `available_balance`
- `wallet_status`
- `kyc_status`
- `access_type`
- `scope`
- `environment`

**Blocked fields** (must be absent from responses and evidence):

- Transaction history
- Payment methods
- Bank accounts
- KYC documents
- Fraud scores
- Internal risk notes
- Admin-only fields

### 5. Failure Scenario Testing

Verify expected error paths:

| Scenario | Expected |
|----------|----------|
| Invalid access token | 401 |
| Missing `wallet.read` scope | 403 |
| Revoked token | Rejected |
| Foundation-mode token | Blocked |
| Rate limit exceeded | 429 |
| Invalid OAuth client | Rejected |

## Checklist statuses

| Status | Meaning |
|--------|---------|
| `NOT_STARTED` | No checklist items verified |
| `IN_PROGRESS` | Some items verified, others pending |
| `READY_FOR_CERTIFICATION` | All required items verified |
| `CERTIFIED` | Checklist complete + certification gate = CERTIFIED |
| `FAILED` | One or more items failed verification |

## Readiness criteria

### Operator checklist alone

All required items marked `complete` → `READY_FOR_CERTIFICATION`

### Combined operational readiness (Phase 13D + 13E)

A sandbox wallet implementation is **operationally ready** only when:

1. **Certification gate status** = `CERTIFIED` (Phase 13D)
2. **Operator checklist status** = `READY_FOR_CERTIFICATION` (Phase 13E)

The operator checklist **does not override** a failed certification. Certification failures always block operational readiness.

## Related tools

| Tool | Route |
|------|-------|
| OAuth Wallet Test Harness | `/dev-console/oauth-wallet-test` |
| Evidence Reports | `/admin/oauth-wallet-test-evidence` |
| Certification | `/admin/oauth-wallet-certification` |
| Certification Gate | `/admin/oauth-wallet-certification-gate` |

## Limitations

- Checklist is pure data-driven logic — no database persistence
- Admin page is informational only — no approve button, no production promotion
- Operators track completion externally or via harness evidence + certification workflow
- Does not automatically certify runs — use Phase 13C certification evaluation

## Module reference

- `lib/oauthWalletSandboxOperatorChecklist.js` — checklist structure and evaluation
- `lib/oauthWalletCertificationGate.js` — `evaluateOperationalReadiness()` integration
