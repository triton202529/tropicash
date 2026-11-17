# Phase 4 — PayPal Sandbox Funding Recertification

**Classification:** `TROPICASH_PHASE4_PAYPAL_SANDBOX_RECERTIFIED`

**CARD_PAYOUT_STATUS:** `REQUIRES_ACQUIRER_SPONSOR`

**Baseline HEAD:** `e8f7e6ab9b3c214fbe567a5bddf7e6f5951d92a8`

**Date:** 2026-11-16

## Verdict

An actual post-Phase-3 PayPal Sandbox card capture completed under the ownership-binding architecture.

Primary evidence (masked):

- PayPal order: `0PD5…2456`
- PayPal capture: `1DP8…794U`
- Amount: `5.25 USD`
- Wallet delta: `0 → 5.25`
- `paypal_funding_orders.status`: `completed`
- `funding_idempotency_keys.status`: `completed`
- Canonical transaction: type `fund`, authority `fund_wallet_rpc`
- Notification for order: 1

## Live endpoint guard

Before order creation:

- mode = `sandbox`
- API host = `api-m.sandbox.paypal.com`
- Live host refused
- Harness forced runtime `PAYPAL_MODE` / `PAYPAL_API_BASE` to the verified sandbox base for the process

## Evidence distinction

| Area | Evidence type | Result |
| --- | --- | --- |
| Primary create → capture → credit | Actual PayPal Sandbox + authenticated Tropicash routes | PASS |
| Owner isolation | Actual authenticated capture-order | PASS (`ORDER_OWNER_MISMATCH`) |
| Amount / currency mismatch | Actual authenticated capture-order before provider capture | PASS |
| Capture replay / response-loss | Actual authenticated capture-order | PASS (duplicate, wallet unchanged) |
| Already-captured recovery | Actual PayPal COMPLETED + Tropicash recovery path | PASS |
| Captured-but-uncredited recovery | Actual PayPal capture + controlled Tropicash `captured` state | PASS |
| Concurrent recovery | Controlled fixture via `executePaypalFundingCapture` | PASS (1 credit) |
| Phase 3 integrity regression | Controlled module tests | PASS |

## Reconciliation

Operationally balanced:

- PayPal order/capture COMPLETED at 5.25 USD
- Funding order completed, owner matches
- Funding idempotency completed, owner matches
- One canonical `fund` transaction with `fund_wallet_rpc`
- Wallet delta exactly 5.25
- One funding notification for the order

Journal / GL:

- `journal_entries` count observed: 0
- `journal_lines` count observed: 0
- Automatic double-entry posting on funding remains **absent**
- System of record for Phase 4: `wallets.wallet_balance` + `public.transactions`
- Phase 4 is **not** claimed as full general-ledger reconciliation

## Quality gates

- `node scripts/phase3-funding-integrity-check.mjs` — passed
- `npm run lint` — no warnings or errors
- `npm run build` — succeeded
- `git diff --check` — clean for reviewed files

## Artifacts

- `data/results/phase4_paypal_funding_preflight.json`
- `data/results/phase4_paypal_funding_success.json`
- `data/results/phase4_paypal_funding_owner_isolation.json`
- `data/results/phase4_paypal_funding_replay.json`
- `data/results/phase4_paypal_funding_recovery.json`
- `data/results/phase4_paypal_funding_concurrency.json`
- `data/results/phase4_paypal_funding_reconciliation.json`
- `scripts/phase4-env-preflight.mjs`
- `scripts/phase4-paypal-sandbox-recertify.mjs`

`.env.local` remains gitignored and is not staged or committed.
Phase 14G/14H files remain unstaged and unmodified by this phase’s certification work.
Push is intentionally withheld until separately authorized.
