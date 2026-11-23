# Phase 7 — Settlement Evidence Standard

**Baseline:** `42e94c150bd6389c260f66eb95601f7e4510d3e2`
**Phase 7 classification:** `TROPICASH_PHASE7_PAYPAL_SUPPORT_REQUIRED`
**CARD_PAYOUT_STATUS:** `REQUIRES_ACQUIRER_SPONSOR`
**Purpose:** Define what Tropicash accepts as authoritative PayPal processor settlement evidence before any clearing→cash journal is posted.

## Ranked acceptable sources

1. **PayPal reporting API / Transaction Search**
   - `GET /v1/reporting/transactions` (and related reporting endpoints)
   - Requires scope `https://uri.paypal.com/services/reporting/search/read`
   - Preferred for automated exact-once reconciliation
   - **Phase 7 status:** unavailable — scope absent; endpoint 403 after Transaction Search enablement + fresh token

2. **PayPal official Balance / Reconciliation report**
   - e.g. Balance Reconciliation Report (BRR) from Reporting Dashboard or subscription delivery
   - Structured file preferred (CSV / official report format)

3. **PayPal official account statement or Activity Download**
   - Monthly Statement and/or Activity Download Report (ADR)
   - Must be durable, exportable evidence retained in ops vault

4. **Provider-supported SFTP settlement report**
   - e.g. Settlement Report (STL) or other subscribed settlement feed
   - Only when identity/linkage to captures can be proven

## Required proof content

An acceptable settlement source must allow Tropicash to determine, for the reconciliation period or linked capture(s):

- beginning PayPal balance (when available)
- payment/capture activity
- fee amounts (when present)
- available / withheld balance distinctions (when present)
- withdrawal or transfer to bank (when settlement leaves PayPal)
- ending balance (when available)

Settlement posting may use net/gross/fee math only when those amounts appear in the authoritative source.

## Explicitly rejected as settlement proof

- Orders capture response alone (`COMPLETED` capture)
- Capture `seller_receivable_breakdown` fee/net metadata alone
- Browser UI balance without durable export
- Manually typed amounts
- Internal Tropicash assumptions or derived guesses
- Fabricated journals to “clear” `paypal_processor_clearing`

**Tropicash must not fabricate settlement evidence** while PayPal reporting entitlement remains unresolved.

## Accounting implication

Until at least one ranked source returns usable evidence:

- leave `paypal_processor_clearing` outstanding
- do not debit `treasury_cash`
- do not post fee expense from capture metadata alone
- do not invent settlement identities

## Phase lineage

| Phase | Classification |
|-------|----------------|
| Phase 5 | Funding ledger posting validated; clearing holds capture amount |
| Phase 6 | `TROPICASH_PHASE6_SETTLEMENT_EVIDENCE_UNAVAILABLE` |
| Phase 7 | `TROPICASH_PHASE7_PAYPAL_SUPPORT_REQUIRED` |

Current accounting (unchanged through Phase 7):

| Metric | Value |
|--------|------:|
| `paypal_processor_clearing` | 5.25 |
| `treasury_cash` | 0 |
| Fee posted | 0 |
| Settlement journals | 0 |
