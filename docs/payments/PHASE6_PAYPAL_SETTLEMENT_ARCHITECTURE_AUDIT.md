# Phase 6 — PayPal Settlement Architecture Audit

**Baseline:** `3375abab4f1d420d3b92bad7c91982aada887710`
**Phase 5 classification:** `TROPICASH_PHASE5_FUNDING_LEDGER_VALIDATED`
**CARD_PAYOUT_STATUS:** `REQUIRES_ACQUIRER_SPONSOR`

## Scope

Read-only inspection of repository + live schema + PayPal Sandbox probes for settlement, clearing, cash, fees, and reconciliation. No settlement journals posted from this audit.

## Live chart of accounts (relevant)

| code | name | type | settlement role |
|------|------|------|-----------------|
| `paypal_processor_clearing` | PayPal processor clearing | asset | Outstanding capture receivable (Phase 5 debit) |
| `treasury_cash` | Treasury cash | asset | Candidate settlement-cash destination |
| `user_wallet_liability` | User wallet liability | liability | Customer liability (Phase 5 credit) |
| `fees_revenue` | Fees revenue | revenue | **Not** processing-fee expense |
| `triton_pending_settlement` | Triton pending settlement | liability | Triton transfer pending — unrelated to PayPal card settlement |

**Missing:** no `payment_processing_fees` (or equivalent) expense account.

## Existing tables touching money / PayPal / treasury

| Table | Settlement relevance |
|-------|----------------------|
| `paypal_funding_orders` | Capture ownership + Phase 5 ledger posting status |
| `funding_idempotency_keys` | Exact-once wallet credit |
| `transactions` / `wallets` | Authoritative customer money SoR |
| `journal_entries` / `journal_lines` / `ledger_accounts` | Phase 5 funding journals only so far |
| `payout_methods` / `payout_webhook_events` | **Payout** webhooks — not funding settlement |
| `treasury_health_snapshots` / `treasury_operational_events` | Ops/treasury analytics — not provider settlement SoR |

**Absent:** `paypal_settlements`, settlement batches, processor balance-transaction tables, settlement journal RPCs.

## PayPal integration capabilities

`lib/paypal.js` currently supports:

- OAuth token
- create order
- get order
- capture order
- generic `paypalApiFetch`

`pages/api/webhooks/paypal.js` handles **payout** webhook events only.

Not integrated before Phase 6 probe:

- `GET /v2/payments/captures/{id}`
- `GET /v1/reporting/transactions`
- `GET /v1/reporting/balances`
- Settlement report file ingestion

## Probe results (certified Phase 4 event `0PD5…2456`)

| Source | Result | Settlement meaning |
|--------|--------|--------------------|
| GET order | 200 COMPLETED | Capture evidence only |
| GET capture | 200 COMPLETED + `seller_receivable_breakdown` | Fee/net receivable metadata; **not** bank settlement |
| Reporting transactions | **403 NOT_AUTHORIZED** | No linked settlement rows |
| Reporting balances | **403 NOT_AUTHORIZED** | No balance snapshot |

Observed capture receivable metadata (not settlement):

- gross `5.25`
- paypal_fee `0.63`
- net `4.62`

## Answers to audit questions

1. **Does Tropicash retrieve settlement/balance evidence today?** No production path; ad-hoc Phase 6 probe only; reporting APIs unauthorized for this app.
2. **Does capture evidence contain fee information?** Yes — `seller_receivable_breakdown` on capture GET.
3. **Is a balance-transaction/report endpoint integrated?** No; probe received 403.
4. **Is processor settlement represented anywhere?** No durable settlement table or journal authority.
5. **Is `treasury_cash` the correct destination?** Yes, as the existing cash asset when settlement is later proven. Do not debit it from capture alone.
6. **Better existing account for PayPal balance vs bank cash?** None. Future optional `paypal_balance_cash` could split PayPal wallet vs bank, but `treasury_cash` remains the current chart destination until a dedicated account is authorized.
7. **Payment fee expense account?** No. `fees_revenue` must not be used for PayPal processing fees.
8. **Existing reconciliation job to extend?** Phase 5 funding reconciliation + withdrawal reconciliation exist; neither posts PayPal settlement. Extend only after reporting access is granted.

## Event authority separation

| Event | Evidence required | Accounting |
|-------|-------------------|------------|
| A. Card capture | Capture COMPLETED + Phase 5 rules | DR clearing / CR wallet liability (done) |
| B. Processor settlement | Reporting/settlement identity proving funds available/settled | DR `treasury_cash` / CR clearing |
| C. Processor fee | Provider fee on settlement or explicitly modeled fee evidence | DR fee expense / CR clearing (only with proven fee; expense account must exist) |
| D. Refund/chargeback | Future | Reverse via new journals; never edit posted entries |

**Rule:** Capture ≠ settlement. Settlement must never re-credit `user_wallet_liability`.

## Batch vs one-to-one

PayPal settlement reports and reporting transactions can aggregate many captures. Future settlement design must support:

- one settlement → many captures
- many settlement rows → one capture

Do not force one-capture-one-settlement without provider identity proof.

## Reporting permission blocker

Required evidence source for processor settlement is PayPal reporting / Transaction Search
(not Orders capture alone).

Probe result: reporting endpoints returned **403 NOT_AUTHORIZED** for this app/account.
Ordinary Orders API credentials are therefore insufficient for authoritative settlement
evidence. PayPal reporting access may require account/product enablement beyond Orders API
credentials.

**Next provider action:** Obtain/enable the required PayPal reporting permissions and
re-test `GET /v1/reporting/transactions` (and related reporting APIs).

Capture `seller_receivable_breakdown` fee/net metadata remains capture accounting detail only
and is not settlement proof.

## Live clearing snapshot

- `paypal_processor_clearing` net debit: **5.25**
- `treasury_cash` net debit: **0**
- Settlement amount posted: **0**
- Fee expense posted: **0**
- Settlement journal: **none**
- Migration applied: **none**
- Certified event settlement status: **unsettled / settlement evidence unavailable**
