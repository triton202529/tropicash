# Developer Sandbox Monitoring (Phase 14F)

## Purpose

Phase 14F adds operational monitoring for approved sandbox developers. The platform can answer:

- Who is using the sandbox?
- Which applications are active?
- Are developers respecting limits?
- Are there abnormal usage patterns?
- Should access be reviewed or suspended?

This phase creates **review cases only** — no automatic suspension.

## Tables

### `developer_sandbox_activity`

Immutable activity feed. Metadata only — no secrets, tokens, wallet balances, or payment data.

Activity types:

- `credential_created`
- `oauth_client_created`
- `oauth_test_run`
- `oauth_wallet_access`
- `api_usage_spike`
- `rate_limit_exceeded`
- `access_denied`

### `developer_sandbox_risk_cases`

Review queue with severity `LOW` | `MEDIUM` | `HIGH` | `CRITICAL` and status `open` | `reviewing` | `resolved` | `dismissed`.

## Risk classification

| Severity | Examples |
|----------|----------|
| LOW | Rate limit events, high-volume testing |
| MEDIUM | Repeated access denials, excessive failed auth patterns |
| HIGH | Blocked capability attempts, circumvention signals |
| CRITICAL | Reserved for malicious activity evidence (manual escalation) |

## Integration points (additive)

- `lib/developerCredentials.js` — credential creation, access denials
- `lib/oauthClients.js` — OAuth client creation, access denials
- `pages/api/oauth/test-evidence.js` — OAuth test evidence
- `pages/api/oauth/wallet.js` — OAuth wallet sandbox reads
- `lib/developerApiAuth.js` — developer API rate limits
- `lib/oauthAccessTokenAuth.js` — OAuth rate limits

## Admin dashboard

**Route:** `/admin/developer-sandbox-monitoring`

Read-only: platform overview, activity feed, risk queue. Filters by date, developer, severity, activity type.

Enforcement actions remain in Phase 14G.

## Module

- `lib/developerSandboxMonitoring.js`
