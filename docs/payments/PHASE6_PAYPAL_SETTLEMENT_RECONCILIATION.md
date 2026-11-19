# Phase 6 — PayPal Settlement Reconciliation

**Baseline:** `3375abab4f1d420d3b92bad7c91982aada887710`
**Final classification:** `TROPICASH_PHASE6_SETTLEMENT_EVIDENCE_UNAVAILABLE`
**CARD_PAYOUT_STATUS:** `REQUIRES_ACQUIRER_SPONSOR`

## Certified funding event

| Field | Value |
|-------|-------|
| Order (masked) | `0PD5…2456` |
| Capture (masked) | `1DP8…794U` |
| Gross captured | `5.25` USD |
| Phase 5 journal | DR `paypal_processor_clearing` 5.25 / CR `user_wallet_liability` 5.25 |
| Settlement journal | **none** (not posted) |

## Provider evidence obtained

### Available

- Capture status `COMPLETED`
- Capture `seller_receivable_breakdown`:
  - gross `5.25`
  - fee `0.63`
  - net `4.62`

### Not available (authoritative settlement)

- `GET /v1/reporting/transactions` → **403 NOT_AUTHORIZED**
- `GET /v1/reporting/balances` → **403 NOT_AUTHORIZED**
- Settlement report ingestion → not integrated
- No `paypal_settlements` table / settlement journal RPC

## Decision

Capture fee/net metadata is **not** treated as proof that funds became `treasury_cash` or bank cash.

Therefore:

- no settlement journal posted
- no fee expense journal posted in Phase 6
- `paypal_processor_clearing` remains **5.25** outstanding
- `treasury_cash` remains **0** from this event

## Designed future accounting (not executed)

When reporting/settlement evidence is authorized and linked:

```
DR treasury_cash                 net
DR payment_processing_fees       fee   (only if fee proven and expense account exists)
CR paypal_processor_clearing     gross
```

For a no-fee full settlement:

```
DR treasury_cash
CR paypal_processor_clearing
```

Exact-once authority (future): `public.post_paypal_settlement_journal(...)` service-role only, unique on provider settlement identity, never mutates `wallets.wallet_balance`, never re-credits wallet liability.

## Proposed settlement data model (deferred — not applied)

`paypal_settlements` with provider-unique settlement identity, optional links to capture/funding/transaction, gross/fee/net, status, journal_entry_id, RLS with no client write.

Not created in Phase 6 because authoritative settlement evidence is unavailable; applying posting schema without evidence would invite fabricated settlements.

## Reconciliation identity for certified event

| Metric | Value |
|--------|------:|
| Captured amount | 5.25 |
| Clearing debit | 5.25 |
| Amount settled | 0.00 |
| Fee posted | 0.00 |
| Remaining clearing | 5.25 |
| Settlement journal | none |
| Status | `unsettled` |

### Global clearing equation (current)

```
opening clearing 0
+ new funding captures 5.25
- settlements 0
- fees/adjustments posted 0
= closing clearing 5.25
```

## Historical clearing audit (recommendation only)

| Metric | Count |
|--------|------:|
| Fund-like transactions | 41 |
| With completed PayPal order + capture + completed idempotency | 3 |
| With Phase 5 funding journal | 1 |
| Without PayPal order | 38 |

Do **not** bulk backfill. Future settlement backfill only for rows with independently proven settlement/reporting evidence and Phase 3 ownership.

## Reporting permission blocker

**Required evidence source:** PayPal reporting / Transaction Search capability
(`GET /v1/reporting/transactions`, related balance/settlement reporting).

**Observed blocker:** the current application/account credentials can call Orders/Payments
capture APIs, but the probed reporting endpoints returned **403 NOT_AUTHORIZED**.

This means the current app/account lacks sufficient reporting authorization for those
endpoints. PayPal reporting access may require account/product enablement beyond ordinary
Orders API credentials.

**Next provider action:** Obtain/enable the required PayPal reporting permissions and
re-test the reporting APIs against the certified funding event. Do not fabricate
settlement from capture fee metadata while reporting remains unauthorized.

## Required follow-up before Phase 6 can validate settlement posting

1. Obtain/enable required PayPal reporting permissions and re-test reporting APIs.
2. Persist linked settlement identities durably.
3. Add fee expense account if fee posting is in scope.
4. Implement service-role exact-once settlement journal authority.
5. Re-probe certified event and post only from authoritative settlement evidence.

## Evidence artifacts

- `data/results/phase6_paypal_settlement_audit.json`
- `data/results/phase6_paypal_settlement_validation.json`
- `data/results/phase6_paypal_settlement_reconciliation.json`
- `data/results/phase6_paypal_settlement_security.json`
- `data/results/phase6_paypal_settlement_concurrency.json`
- `scripts/phase6-paypal-settlement-probe.mjs`
