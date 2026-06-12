# OAuth Wallet Sandbox Certification (Phase 13C)

## Purpose

The OAuth Wallet Sandbox Certification layer evaluates **saved harness evidence** (`oauth_wallet_test_evidence`) for a single `run_id` and produces a pass/fail/incomplete certification outcome.

This is **diagnostics only**. It does not add wallet APIs, expose balances, or enable money movement.

**Admin route:** `/admin/oauth-wallet-certification`

## Required steps

Each certification run must include evidence for all canonical steps:

| Step key | Harness alias | Critical |
|----------|---------------|----------|
| `select-client` | — | No |
| `authorization-url` | — | No |
| `open-consent` | `consent` | No |
| `capture-code` | — | No |
| `token-exchange` | — | **Yes** |
| `profile-api` | — | **Yes** |
| `wallet-api` | — | **Yes** |
| `refresh-token` | — | **Yes** |
| `revoke-token` | — | **Yes** |
| `revoked-token-check` | `confirm-revoked` | **Yes** |

Non-critical steps may be `passed` or `skipped`. Critical steps must `passed`, except `wallet-api` (see safe failures).

## Certification statuses

| Status | Meaning |
|--------|---------|
| `certified` | All required steps present; critical steps satisfied; no leaks |
| `failed` | Critical step failed, unsafe wallet error, or leak detected |
| `incomplete` | One or more required steps missing from evidence |

## Pass / fail rules

### Must pass (critical)

- `token-exchange` → `passed`
- `profile-api` → `passed`
- `refresh-token` → `passed`
- `revoke-token` → `passed`
- `revoked-token-check` → `passed`

### Wallet API — pass or safe failure

`wallet-api` is satisfied when:

- Evidence status is `passed`, **or**
- Evidence status is `failed` with a **safe** error in `sanitized_result`:

  - `consent_required`
  - `insufficient_scope`
  - `invalid_token`
  - `rate_limit_exceeded`

Any other wallet-api failure → certification `failed`.

### Leak detection

Certification **fails** if any evidence row contains:

- Visible tokens (`tc_secret_`, `tc_auth_`, `tc_at_`, `tc_rt_` not masked)
- Visible wallet balance (numeric value instead of `[REDACTED_BALANCE]`)
- Transaction arrays or blocked fields (`transactions`, `payment_methods`, etc.)
- Sensitive keys with values other than `[MASKED]`

## Persistence

Certification outcomes are stored in `oauth_wallet_test_certifications` (one row per `run_id`):

- `status`, pass/fail/skip counts
- `leak_detected` flag
- Safe `summary` JSON (step checklist, reasons, leaks — no raw evidence payloads)

Admins evaluate or re-evaluate from `/admin/oauth-wallet-certification`. Evidence rows are never edited or deleted by this flow.

## Limitations

- Certification depends on evidence having been saved from `/dev-console/oauth-wallet-test`
- Re-evaluation overwrites the prior certification row for the same `run_id`
- Safe wallet failures certify the **controls** path, not a successful balance read
- No automatic certification — admin must explicitly evaluate a run
- Does not validate live API behavior beyond what was captured in evidence

## Related modules

- `lib/oauthWalletCertification.js` — evaluation + leak detection
- `lib/oauthWalletTestEvidence.js` — evidence sanitization (Phase 13B)
- `/admin/oauth-wallet-test-evidence` — evidence viewer with **Evaluate run** links
