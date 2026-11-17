# Phase 5 — Funding Ledger Architecture Audit

**Baseline:** `3be657554485db27ca584985e8828be3dec403f3`
**Phase 4 classification:** `TROPICASH_PHASE4_PAYPAL_SANDBOX_RECERTIFIED`
**Project:** `opbhcndlibbcsmoaeymq` (tropicash)

## Scope

Read-only inspection of live schema and repository accounting/funding paths before Phase 5 automatic journal posting.

## Live chart of accounts

| code | name | type | status |
|------|------|------|--------|
| `fees_revenue` | Fees revenue | revenue | active |
| `fraud_holds` | Fraud holds | liability | active |
| `pending_withdrawals` | Pending withdrawals | liability | active |
| `system_adjustments` | System adjustments | equity | active |
| `treasury_cash` | Treasury cash | asset | active |
| `triton_pending_settlement` | Triton pending settlement | liability | active |
| `user_wallet_liability` | User wallet liability | liability | active |

### Account selection for wallet funding

| Role | Existing? | Selected |
|------|-----------|----------|
| Customer wallet liability | Yes — `user_wallet_liability` | **Reuse** (do not duplicate) |
| PayPal / processor clearing asset | **No** | **Add** `paypal_processor_clearing` (asset) |

`treasury_cash` is **not** used for card funding posts. Settlement cash has not yet moved from PayPal; inventing treasury cash would misstate settlement.

## Journal tables

### `ledger_accounts`

- Types: `asset | liability | equity | revenue | expense`
- Unique on `code`
- RLS enabled; admin select/insert via `tc_is_admin()`
- `service_role` has full DML

### `journal_entries`

- Fields: `entry_type`, `source_type`, `source_id`, `description`, `status` (`draft|posted|void`), `created_by`, `metadata`
- Index on `(source_type, source_id)` — **not unique**
- No automatic posting RPC before Phase 5
- Live counts **at pre-implementation audit**: `journal_entries = 0`, `journal_lines = 0`
- Live counts **after Phase 5 validation** (certified Phase 4 funding only): `journal_entries = 1`, `journal_lines = 2`

### `journal_lines`

- `debit` / `credit` numeric ≥ 0; exactly one side positive
- FK to `journal_entries` (cascade delete) and `ledger_accounts`
- Optional `user_id`, `currency` default `USD`

### Debit/credit convention

Standard accounting:

- Asset increase = debit
- Liability increase = credit

Funding of amount X:

- DR `paypal_processor_clearing` X
- CR `user_wallet_liability` X

## Funding operational chain (certified)

```
PayPal capture
→ paypal_funding_orders (completed)
→ funding_idempotency_keys (completed)
→ transactions (type=fund, balance_authority=fund_wallet_rpc)
→ wallets.wallet_balance
→ notification
```

Authoritative money SoR remains `transactions` + `wallets.wallet_balance` (LEDGER_ARCHITECTURE_DECISION Option B). Journal is accounting evidence only and must never mutate balances.

## Existing helpers

| Artifact | Role |
|----------|------|
| `lib/internalLedger.js` | Manual admin journal create/read; explicitly non-automatic |
| `public.fund_wallet` | Sole wallet credit authority (service_role) |
| `public.credit_paypal_funding_order` | Exact-once PayPal credit bridge (service_role) |
| `backfill_withdrawal_transaction_ledger` | Withdrawal transaction linkage only — unrelated |

No `post_*_journal` funding function existed at audit time.

## Exact-once gaps before Phase 5

1. No unique constraint on funding `(source_type, source_id)` → duplicate journals possible under concurrency
2. No service-role posting authority for completed funding
3. Journal failure/success not tracked on `paypal_funding_orders`
4. Posted journals are mutable (`service_role` update/delete; no immutability trigger)

## Historical funding

| Metric | Count |
|--------|------:|
| Fund-like transactions (`fund` / `fund_wallet` / `wallet_funded`) | 41 |
| Completed PayPal funding orders with `transaction_id` | 3 |
| Fund-like transactions with a Phase 5 `wallet_funding` journal | 1 |
| Fund-like transactions still without journals | 40 |

Phase 4 certified order (sanitized): `0PD5…2456` / capture `1DP8…794U` / amount `5.25` USD — first legitimate automatic ledger post under Phase 5.

Historical funding predating the new accounting authority is **not** automatically trustworthy for ledger backfill because provider ownership/capture evidence may be incomplete. Recommended future approach: backfill only transactions with independently proven completed provider evidence and canonical ownership. Do not bulk backfill.

## Security notes (pre-change)

- Money RPCs (`fund_wallet`, `credit_paypal_funding_order`, transfer/withdraw) are service_role-only
- Ledger tables: authenticated admin insert/select only; anon has no policies
- Admin manual insert remains for treasury UI; Phase 5 must not expose `post_funding_journal` to `anon` / `authenticated` / `PUBLIC`

## Reversal design (document only — not implemented)

Future funding reversal must post a **new** reversing journal:

- DR `user_wallet_liability`
- CR `paypal_processor_clearing`

linked to the original entry via metadata — never update/delete the original posted journal.

## Risks carried into Phase 5

1. **Journal immutability not enforced** until Phase 5 trigger/policy hardening
2. **Historical unposted funding** — do not bulk backfill without separate authorization
3. **Admin insert path** on journal tables remains (manual treasury); distinct from automatic posting authority
