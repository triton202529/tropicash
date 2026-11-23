# PayPal Reporting Access — Support / Account-Manager Request

**Environment:** Sandbox (primary)
**Live:** Eligibility requirements requested separately
**Use case:** Wallet funding settlement reconciliation for Tropicash
**Date context:** Phase 7 reporting access closeout
**Classification:** `TROPICASH_PHASE7_PAYPAL_SUPPORT_REQUIRED`

## Summary

Tropicash successfully processes PayPal Sandbox Orders API wallet funding (create + capture) and posts internal double-entry clearing for completed funding. We cannot reconcile processor clearing to cash because Transaction Search / balance reporting APIs return insufficient permissions even after Transaction Search was enabled on the Sandbox REST app and a fresh OAuth token was obtained.

## Current success

- Sandbox Orders / Payments capture flow works for wallet funding.
- Internal accounting correctly records:

  - DR PayPal processor clearing
  - CR customer wallet liability

- Capture fee metadata may appear on capture detail, but Tropicash does **not** treat capture fee metadata as bank/treasury settlement proof and will **not** fabricate settlement evidence.

## Steps already completed (Sandbox)

1. Environment: **Sandbox** (`api-m.sandbox.paypal.com`).
2. Developer Dashboard → Apps & Credentials → REST app matching client ID `AYc5…cfmF`.
3. **Transaction Search enabled and saved** on that Sandbox REST application.
4. Previously issued access token **explicitly terminated**.
5. **Fresh** client-credentials OAuth token requested and inspected (scope names only).
6. Fresh token still missing both reporting scopes (below).
7. Both reporting endpoints still return **403 NOT_AUTHORIZED**.

## Problem (fresh token)

Fresh Sandbox client-credentials tokens for our REST app do **not** include:

- `https://uri.paypal.com/services/reporting/search/read`
- `https://uri.paypal.com/services/reporting/balances/read`

Calls to:

- `GET /v1/reporting/transactions`
- `GET /v1/reporting/balances`

return:

- HTTP `403`
- `NOT_AUTHORIZED`
- “Authorization failed due to insufficient permissions.”

Token caching and the missing application checkbox have been **ruled out** as immediate causes.

## Requested actions

1. Identify and enable the necessary **Sandbox** reporting entitlement / product configuration so that:

   - `…/reporting/search/read` and
   - `…/reporting/balances/read`

   appear on a fresh client-credentials token for this Sandbox REST app, and Transaction Search / Balance APIs authorize successfully.

2. Confirm whether **balance reporting** (`…/reporting/balances/read`) is included with Transaction Search or requires a separate feature/entitlement.

3. Provide **Live** environment eligibility requirements separately for the same reporting capabilities (do not conflate with Sandbox enablement).

4. Confirm whether any additional merchant-account role, product subscription, or account-manager approval is required beyond the Developer Dashboard Transaction Search checkbox.

## Business need

We must reconcile:

- processor clearing balances created at capture
- PayPal fees
- subsequent availability / settlement of funds
- eventual movement to bank / treasury cash

without inventing settlement events from capture responses alone.

## What we are not requesting

- Production card funding enablement
- Automated payout enablement
- Sharing of customer PANs, CVVs, passwords, access tokens, client secrets, or full internal customer IDs

## Sandbox app identifier (sanitized)

- Client ID masked: `AYc5…cfmF`
- API host: `api-m.sandbox.paypal.com`
- Mode: sandbox

## Accounting state (unchanged; for context only)

- `paypal_processor_clearing` = 5.25
- `treasury_cash` = 0
- Fee posted = 0
- Settlement journal count = 0
