# Phase 5 — Automatic Funding Ledger Posting

**Baseline:** `3be657554485db27ca584985e8828be3dec403f3`
**Classification target:** `TROPICASH_PHASE5_FUNDING_LEDGER_VALIDATED`
**CARD_PAYOUT_STATUS:** `REQUIRES_ACQUIRER_SPONSOR`

## Accounting event

`WALLET_FUNDING_COMPLETED`

Posted only when all are true:

- PayPal funding order `status = completed` with capture id
- `funding_idempotency_keys.status = completed`
- Canonical `transactions` row exists (`type = fund`, `status = completed`)
- `metadata.balance_authority = fund_wallet_rpc`
- Wallet credit already succeeded

## Entry design

| Side | Account code | Account name | Type |
|------|--------------|--------------|------|
| Debit | `paypal_processor_clearing` | PayPal processor clearing | asset |
| Credit | `user_wallet_liability` | User wallet liability | liability |

Amount X from the canonical funding transaction:

```
DR paypal_processor_clearing     X
CR user_wallet_liability         X
```

`treasury_cash` is intentionally not used (settlement has not occurred).

## Posting authority

`public.post_funding_journal(p_transaction_id uuid)`

- service_role only (`PUBLIC` / `anon` / `authenticated` EXECUTE = false)
- Locks transaction + funding order + idempotency rows
- Idempotency key: `journal_entries (source_type=wallet_funding, source_id=transaction_id)` unique index
- Creates draft entry → two lines → marks `posted`
- Returns existing journal on replay / unique violation
- Never mutates `wallets.wallet_balance`

## Integration

`credit_paypal_funding_order` calls `post_funding_journal` **after** exact-once wallet credit completion (including already-completed recovery paths).

If journal posting fails:

- wallet credit remains
- funding remains `completed`
- `ledger_posting_status = failed` with error text
- retry via `post_funding_journal` / credit replay is safe

## Immutability and reversals

Posted journal headers/lines cannot be updated or deleted (triggers).

Future funding reversal (not implemented in Phase 5):

```
DR user_wallet_liability
CR paypal_processor_clearing
```

as a **new** journal linked by metadata — never edit/delete the original.

## Controlled validation

Posted against Phase 4 certified funding event (sanitized):

- Order `0PD5…2456`
- Capture `1DP8…794U`
- Amount `5.25` USD

This is the **first legitimate ledger record** for that certified funding event. No second PayPal capture and no second wallet credit were performed.

Evidence:

- `data/results/phase5_funding_ledger_validation.json`
- `data/results/phase5_funding_ledger_reconciliation.json`
- `data/results/phase5_funding_ledger_security.json`
- `data/results/phase5_funding_ledger_concurrency.json`

## Historical backfill recommendation

Do **not** bulk backfill. Most historical `fund*` rows predate Phase 3 ownership / lack completed PayPal order linkage. A later authorized pass may backfill only completed PayPal-owned funding with capture + idempotency evidence.

## Migration

Repository file (consolidated final architecture):

`supabase/sql/phase5_funding_ledger_posting.sql`

Live Supabase migration history (execution order):

1. `phase5_funding_ledger_posting`
2. `phase5_funding_ledger_credit_integration`
3. `phase5_funding_ledger_posting_draft_fix`

The three live history entries are implementation increments; the consolidated repository SQL matches the final live architecture (functions, uniqueness, accounts, grants, triggers). See `data/results/phase5_funding_ledger_migration_parity.json`.

## Historical funding statement

- 41 fund-like transactions total
- 1 has a Phase 5 journal (certified Phase 4 funding)
- 40 remain without journals
- No historical bulk backfill performed

Historical funding predating the new accounting authority is not automatically trustworthy for ledger backfill because provider ownership/capture evidence may be incomplete. Future backfill should include only transactions with independently proven completed provider evidence and canonical ownership.
