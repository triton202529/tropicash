# Phase 7 — PayPal Reporting Access Audit

**Baseline:** `42e94c150bd6389c260f66eb95601f7e4510d3e2`
**Final classification:** `TROPICASH_PHASE7_PAYPAL_SUPPORT_REQUIRED`
**CARD_PAYOUT_STATUS:** `REQUIRES_ACQUIRER_SPONSOR`

## Executive result

Transaction Search is **enabled and saved** on the correct PayPal Sandbox REST application. A previously issued OAuth token was **terminated**. A **fresh** Sandbox client-credentials token was inspected.

The fresh token still **does not** include:

- `https://uri.paypal.com/services/reporting/search/read`
- `https://uri.paypal.com/services/reporting/balances/read`

Both reporting probes remain **403 NOT_AUTHORIZED**.

**Ruled out as immediate causes:**

- Missing Transaction Search application checkbox (enabled and saved)
- Token caching (cached token terminated; fresh token still lacks reporting scopes)

**Remaining unresolved cause:** PayPal provider / account entitlement or configuration beyond the Developer Dashboard feature checkbox.

Tropicash **must not fabricate** settlement evidence. No settlement accounting was posted. Clearing remains 5.25; treasury cash remains 0.

## Final classification

`TROPICASH_PHASE7_PAYPAL_SUPPORT_REQUIRED`

Escalate using `docs/payments/PAYPAL_REPORTING_ACCESS_SUPPORT_REQUEST.md`.

## Reprobe after Transaction Search enablement (2026-11-23)

Script: `scripts/phase7-paypal-reporting-reprobe.mjs`
Evidence: `data/results/phase7_paypal_reporting_reprobe.json`

| Check | Result |
|-------|--------|
| Transaction Search on Sandbox REST app | **Enabled and saved** (operator-confirmed, correct app) |
| `…/reporting/search/read` on fresh token | **ABSENT** |
| `…/reporting/balances/read` on fresh token | **ABSENT** |
| Cached token terminated | yes (HTTP 200) |
| Token caching ruled out | **yes** |
| `GET /v1/reporting/transactions` | **403** `NOT_AUTHORIZED` |
| `GET /v1/reporting/balances` | **403** `NOT_AUTHORIZED` |
| Certified 5.25 funding event visible | **no** |
| Gross / fee / net | n/a (no transaction detail) |
| PayPal balance result | n/a (403) |
| Further entitlement / PayPal support required | **yes** |
| Accounting mutated | **no** |

## Environment

| Item | Value |
|------|-------|
| Mode | sandbox |
| API host | `api-m.sandbox.paypal.com` |
| OAuth endpoint | `/v1/oauth2/token` (client credentials) |
| Client ID (masked) | `AYc5…cfmF` |
| Public client ID matches server | yes |

## Actual OAuth scopes (sanitized names only)

Present scopes include Orders/Payments, Payouts, Vault, Disputes, Invoicing, Subscriptions, Webhooks, `openid`.

**Absent (required for reporting):**

- `https://uri.paypal.com/services/reporting/search/read`
- `https://uri.paypal.com/services/reporting/balances/read`

## Required vs actual scope qualification

| Required scope | Endpoint | Status |
|----------------|----------|--------|
| `…/reporting/search/read` | `GET /v1/reporting/transactions` | **ABSENT** |
| `…/reporting/balances/read` | `GET /v1/reporting/balances` | **ABSENT** |

## Safe 403 reproduction

| Endpoint | HTTP | Error name | Message |
|----------|------|------------|---------|
| `/v1/reporting/transactions` | 403 | `NOT_AUTHORIZED` | Authorization failed due to insufficient permissions. |
| `/v1/reporting/balances` | 403 | `NOT_AUTHORIZED` | Authorization failed due to insufficient permissions. |

Neither endpoint returned 200. No settlement evidence was ingested.

## App / product configuration

**Operator-confirmed:** Transaction Search is enabled and saved on the Sandbox REST app matching client ID `AYc5…cfmF`.

**Programmatically observed:** reporting scopes remain absent on a fresh token after cached-token terminate; Orders/Payments-related scopes remain present.

### Completed enablement steps

1. Developer Dashboard → Sandbox → Apps & Credentials → REST app `AYc5…cfmF`
2. Enable **Transaction search** → **Save**
3. Terminate cached access token
4. Request fresh client-credentials token
5. Confirm reporting scopes still absent; re-probe both reporting endpoints → 403

Do not change Live credentials as part of Sandbox enablement. Live requires a separate Live-app feature enablement and entitlement path.

## Merchant account / role audit

| Question | Result |
|----------|--------|
| Sandbox merchant associated with app | Bound via REST app Sandbox business account (exact email/payer ID not programmatically resolved without secrets) |
| Account type | Assumed business merchant for Sandbox seller flows; **not independently proven** from token claims |
| Reporting portal availability | **UNKNOWN** — requires operator login to PayPal business account Reporting Dashboard |
| Balance Reports / statements / Activity Download | **UNKNOWN** without portal access; potential manual authoritative sources only |
| Role restrictions | **UNKNOWN** — do not auto-change roles |
| Additional account entitlement | **Unresolved** — primary remaining hypothesis after checkbox + cache bust |

## Sandbox limitation assessment

No evidence that Sandbox universally lacks Transaction Search. Public PayPal docs describe enabling **Transaction search** on Sandbox REST apps. Checkbox enablement alone did not grant reporting scopes on this app’s token.

Classification of sandbox-wide unavailability: **not selected** as proven primary cause. Provider/account entitlement remains unresolved.

## Manual official-report availability

Potential `MANUAL_AUTHORITATIVE_RECONCILIATION_SOURCE` candidates (if portal access exists):

- Balance Reconciliation Report (BRR)
- Activity Download Report (ADR)
- Monthly Statement
- Subscription Settlement Report (STL) where entitled

These were **not downloaded or validated** in Phase 7. Screenshots are not preferred when structured CSV/report files exist. Tropicash must not fabricate settlement evidence while waiting for provider access.

## Blocker taxonomy

| Candidate | Selected? | Notes |
|-----------|-----------|-------|
| `TOKEN_SCOPE_MISSING` | Symptom yes | Both required scopes ABSENT on fresh token |
| `APP_PRODUCT_NOT_ENABLED` | **Ruled out** as immediate cause | Transaction Search enabled and saved |
| Token caching | **Ruled out** | Terminate + fresh token still lacks scopes |
| `ACCOUNT_NOT_ENTITLED` | **Likely** | Unresolved provider/account entitlement |
| `SANDBOX_REPORTING_UNAVAILABLE` | No | Not proven sandbox-wide |
| `MERCHANT_ROLE_RESTRICTED` | Unknown | Manual portal check needed |
| `UNKNOWN_REQUIRES_PAYPAL_SUPPORT` | **Yes (final)** | Escalation required |

## Accounting non-mutation

| Metric | Value |
|--------|------:|
| `paypal_processor_clearing` | 5.25 |
| `treasury_cash` | 0 |
| Fee posted | 0 |
| Settlement journals | 0 |

## Evidence artifacts

- `data/results/phase7_paypal_reporting_token_audit.json`
- `data/results/phase7_paypal_reporting_access_probe.json`
- `data/results/phase7_paypal_reporting_qualification.json`
- `data/results/phase7_paypal_reporting_reprobe.json`
- `scripts/phase7-paypal-reporting-access-audit.mjs`
- `scripts/phase7-paypal-reporting-reprobe.mjs`
- `docs/payments/PAYPAL_REPORTING_ACCESS_SUPPORT_REQUEST.md`
- `docs/payments/PHASE7_SETTLEMENT_EVIDENCE_STANDARD.md`
