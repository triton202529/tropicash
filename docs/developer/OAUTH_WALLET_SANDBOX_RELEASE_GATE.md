# OAuth Wallet Sandbox Release Gate (Phase 13F)

## Purpose

The OAuth Wallet Sandbox Release Gate is the **final executive/governance decision layer** that determines whether the OAuth Wallet Sandbox is approved for external developer sandbox access.

This phase provides **release governance only**. It does not:

- Enable production access
- Enable money movement
- Modify OAuth flows, token issuance, or wallet APIs
- Change treasury, fraud, or KYC decisions

**Admin route:** `/admin/oauth-wallet-sandbox-release-gate`

> **Permanent notice:** Approval of sandbox release does not enable production access or money movement.

## Release criteria

Sandbox release may only be approved when **all five requirement groups** pass:

### 1. Technical Certification

- OAuth Wallet Certification status = `CERTIFIED` (Phase 13C)

### 2. Operational Readiness

- Operator checklist status = `READY_FOR_CERTIFICATION` (Phase 13E)

### 3. Security Controls

- Rate limiting active (Phase 12Y)
- Audit logging active
- Token revocation functioning
- Suspicious access review path active
- No secret exposure in evidence (Phase 13C leak detection)

### 4. Wallet Exposure Controls

- Only approved wallet fields exposed
- No transaction data exposed
- No payment methods exposed
- No KYC documents exposed
- No balance mutation APIs

### 5. Environment Controls

- Sandbox environment only
- Production OAuth disabled
- No live API credentials
- No production tokens

## Release statuses

| Status | Meaning |
|--------|---------|
| `BLOCKED` | Default — one or more requirements not satisfied |
| `READY_FOR_SANDBOX_RELEASE` | All requirements satisfied; awaiting explicit executive approval |
| `SANDBOX_RELEASED` | Explicitly approved (`releaseApproved: true`); sandbox access granted |

**No automatic promotion.** The system always defaults to `BLOCKED`.

## Required approvals

1. **Technical** — certified harness run with no evidence leaks
2. **Operational** — operator checklist complete
3. **Executive** — explicit `releaseApproved` flag for `SANDBOX_RELEASED` (not automatic)

## Security requirements

Security controls are evaluated against platform baseline implementations from Phases 12Y–13C. Evidence leak detection from certification can block release even when platform controls are active.

## Sandbox restrictions

- Sandbox environment only
- Read-only wallet API (`GET /api/oauth/wallet`)
- No send-money, withdrawal, or transaction APIs
- No production OAuth wallet access
- No live payment credentials

## Production separation

The release gate **never** enables:

- Production OAuth wallet endpoints
- Production token issuance for external developers
- Money movement or balance mutation
- Treasury or fraud policy changes

Production access requires separate governance outside this sandbox release gate.

## Related tools

| Tool | Route |
|------|-------|
| Test Harness | `/dev-console/oauth-wallet-test` |
| Evidence Reports | `/admin/oauth-wallet-test-evidence` |
| Certification | `/admin/oauth-wallet-certification` |
| Certification Gate | `/admin/oauth-wallet-certification-gate` |
| Operator Checklist | `/admin/oauth-wallet-sandbox-checklist` |

## Module reference

- `lib/oauthWalletSandboxReleaseGate.js` — release evaluation
- `lib/oauthWalletCertificationGate.js` — `evaluateFinalSandboxRelease()` integration
