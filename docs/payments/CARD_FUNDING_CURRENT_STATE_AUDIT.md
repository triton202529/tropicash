# Tropicash Card Funding — Current State Audit (Phase C-001)

**Date:** 2026-07-12
**Scope:** Card funding into Tropicash wallet via existing PayPal integration
**Environment audited:** PayPal Sandbox (`api-m.sandbox.paypal.com`), app PayPal mode sandbox
**Live charges:** Not enabled / not attempted

---

## Final classification

**CARD_FUNDING_IMPLEMENTATION_DEFECT_FOUND**

PayPal sandbox **card authorization + capture succeeded** (Visa test instrument, USD).
Canonical `fund_wallet` RPC in the connected Supabase project **credits `wallet_balance` at 2× `p_amount`**, so wallet reconciliation cannot be certified as credited-once until the SQL repair is applied.

**CARD_PAYOUT_STATUS:** `REQUIRES_ACQUIRER_SPONSOR` for Visa Direct / Mastercard Send card-push withdrawals.
PayPal account payouts (email/PayPal wallet) are a separate rail (`AVAILABLE_WITH_CURRENT_PROVIDER` for PayPal Payouts once automation flags/credentials are enabled). Refunds ≠ general wallet withdrawal.

---

## Executive path map (as implemented)

```
User → /fund-wallet
  → PayPal JS SDK Buttons (enable-funding=card after C-001 repair)
  → POST /api/paypal/create-order (JWT, KYC, account security, rate limit)
  → PayPal Checkout (PayPal balance OR guest/card when eligible)
  → onApprove → POST /api/paypal/capture-order (JWT, KYC, capture verify, idempotency)
  → fund_wallet RPC (service_role) → notifications / audit events
```

Raw PAN/CVV never touch Tropicash servers on the product path (PayPal-hosted UI / PayPal REST for probe only).

---

## Phase 1 — Component status

| Area | Status | Evidence |
|------|--------|----------|
| Fund Wallet UI — PayPal Buttons | IMPLEMENTED_AND_WORKING | `pages/fund-wallet.jsx` |
| Debit/Credit Card via PayPal Checkout (Option A) | IMPLEMENTED_AND_WORKING (provider) / IMPLEMENTED_BUT_MISCONFIGURED (SDK lacked `enable-funding=card` before repair) | Sandbox Orders API card capture PASS; SDK URL repaired |
| Advanced Card Fields / Hosted Fields | NOT_IMPLEMENTED | No `card-fields` / Hosted Fields components |
| create-order funding_source param | NOT_IMPLEMENTED (not required for Option A) | `create-order.js` accepts amount only |
| capture-order order status COMPLETED | IMPLEMENTED_AND_WORKING | `capture-order.js` |
| capture-order capture unit status | IMPLEMENTED_BUT_UNTESTED → repaired in C-001 | Now checks capture `COMPLETED` |
| capture-order amount limits ($1–$1000) | IMPLEMENTED_AND_WORKING | Code path |
| capture-order currency USD | IMPLEMENTED_BUT_UNTESTED → repaired in C-001 | Now rejects non-USD |
| capture-order expected amount match | IMPLEMENTED_BUT_MISCONFIGURED → repaired | Client now sends amount; server compares cents |
| Idempotency (`funding_idempotency_keys`) | IMPLEMENTED_AND_WORKING | Duplicate insert → unique violation PASS in probe |
| fund_wallet after verified capture | IMPLEMENTED_BUT_MISCONFIGURED | Double-credit defect in live RPC |
| KYC / financial action gates | IMPLEMENTED_AND_WORKING | create + capture guarded |
| PayPal webhook for funding CAPTURE | NOT_IMPLEMENTED for funding credit | Webhook used for **payouts**, not funding ledger |
| Merchant country card eligibility | IMPLEMENTED_AND_WORKING (sandbox) | Sandbox card capture COMPLETED |
| Live merchant card eligibility | UNKNOWN_REQUIRES_PROVIDER_CONFIRMATION | Live mode not tested |
| Option B Advanced Card Fields eligibility | UNKNOWN_REQUIRES_PROVIDER_CONFIRMATION | Not required; Option A works in sandbox |
| Option C external acquirer | NOT_IMPLEMENTED | Documented only if PayPal unavailable — N/A for sandbox |

---

## UI assessment (pre/post repair)

**Before C-001**

- Heading: “Pay with PayPal”
- Mentions card billing address, but no clear “Debit or Credit Card” product label
- SDK URL: `currency=USD&intent=capture&locale=en_AG` — **no** `enable-funding=card`

**After C-001**

- Heading: “Debit or Credit Card / PayPal”
- Explicit copy: PayPal processes cards; Tropicash does not store PAN/CVV; sandbox notice; KYC/limits
- SDK: `enable-funding=card&components=buttons`

---

## Provider decision (Phase 2)

**OPTION A — SELECTED**

Shortest path: existing PayPal Checkout / Smart Buttons with card funding enabled.
Sandbox proof: Orders API create with `payment_source.card` (official Visa test instrument) → status `COMPLETED`, capture status `COMPLETED`, currency `USD`.

**OPTION B** — Not required for sandbox validation; Advanced Card Fields remain optional UX later. Eligibility for live AG/merchant country needs PayPal account confirmation.

**OPTION C** — Not warranted while PayPal sandbox processes cards.

---

## Defects found

### App / config (repaired in C-001)

1. SDK did not enable card funding source → added `enable-funding=card`
2. Capture did not verify capture-unit status or currency → added checks
3. Amount mismatch guard unused (client never sent amount) → client sends amount; server compares cents
4. Decline errors opaque → `normalizePayPalCaptureFailure` + user-safe codes
5. UX unclear that cards are supported → Fund Wallet copy updated

### Database (repair SQL written; **not applied** via MCP)

6. **`fund_wallet` double-credits `wallet_balance`**
   - Probe: `p_amount=1.11` → `wallet_balance` += `2.22`; `p_amount=0.5` → += `1.0`
   - Direct `UPDATE wallets.wallet_balance` is 1:1 (not a table-wide trigger)
   - Live RPC inserts `transactions.type = 'fund'` and returns `null` (not jsonb from migration)
   - Repair file: `supabase/sql/card_funding_fund_wallet_double_credit_fix_c001.sql`
   - **Blocked:** Supabase MCP authenticated org only sees “Elitehire solutions” / ElitePro; project `opbhcndlibbcsmoaeymq` returns permission denied. Operator must apply SQL in the Tropicash Supabase SQL editor or grant MCP access.

---

## Sandbox test results (sanitized)

See `data/results/card_funding_sandbox_test.json` and `card_funding_reconciliation.json`.

| Test | Result |
|------|--------|
| OAuth sandbox token | PASS |
| Successful Visa sandbox card capture | PASS |
| Provider duplicate capture | PASS_REJECTED (`ORDER_ALREADY_CAPTURED`) |
| Decline instrument | PASS (422 validation/decline path) |
| Wallet credit after capture | PARTIAL — credited but **2× amount** |
| Idempotency duplicate key | PASS |
| Amount mismatch guard (app) | PASS (code repaired) |
| Unauthenticated / limits / RPC failure handling | DOCUMENTED from code inspection |

---

## Card payout / withdrawal assessment (not implemented)

| Path | Classification |
|------|----------------|
| PayPal Payouts to PayPal account/email | `AVAILABLE_WITH_CURRENT_PROVIDER` (existing withdrawal automation; flag/credentials gated) |
| Refund of an original card capture | Refund ≠ withdrawal; possible via PayPal refunds API later — not a general cash-out |
| Visa Direct / Mastercard Send push-to-card | `REQUIRES_ACQUIRER_SPONSOR` |
| Current acquiring processor card push | `NOT_YET_DETERMINED` / effectively N/A — PayPal Checkout is the funding acquirer |

---

## Remaining blockers

1. Apply `card_funding_fund_wallet_double_credit_fix_c001.sql` to Tropicash Supabase and re-run probe until `balanced: true`
2. Confirm live PayPal Business account Guest Checkout / card eligibility for merchant country before production
3. Browser E2E with PayPal Smart Buttons card button (optional; API card capture already proves merchant can process cards in sandbox)
4. Do not enable live mode until (1) and (2) clear

---

## Files inspected (primary)

- `pages/fund-wallet.jsx`
- `pages/api/paypal/create-order.js`
- `pages/api/paypal/capture-order.js`
- `pages/api/webhooks/paypal.js`
- `lib/paypal.js`, `lib/paypalSdkUrl.js`, `lib/paypalMode.js`, `lib/paypalProductionGuard.js`
- `lib/paymentSource.js`, `lib/fundingIdempotency.js`
- `lib/payouts/*`, `lib/paypalPayoutReadiness.js`
- `.env.example`
- `supabase/sql/phase_tlp002_foundation_hardening.sql`

## Files created

- `docs/payments/CARD_FUNDING_CURRENT_STATE_AUDIT.md`
- `data/results/card_funding_audit.json`
- `data/results/card_funding_sandbox_test.json`
- `data/results/card_funding_reconciliation.json`
- `scripts/card-funding-sandbox-probe.mjs`
- `supabase/sql/card_funding_fund_wallet_double_credit_fix_c001.sql`

## Files modified

- `lib/paypalSdkUrl.js`
- `lib/paypal.js`
- `pages/api/paypal/capture-order.js`
- `pages/fund-wallet.jsx`
- `.env.example`
- `pages/api/admin/compliance/action.js` (pre-existing broken import depth; required for `npm run build`)
