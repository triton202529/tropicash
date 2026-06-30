# Ledger Architecture Decision (TLP-004 / LED-001)

**Decision date:** 2026-06-30  
**Status:** Accepted  
**Decision:** **Option B** — designate an existing ledger as authoritative; retain treasury journal as supplementary reporting only.

---

## Context

FTC-001 (TLP-003) identified **LED-001**: `internal_ledger_phase1.sql` defined a double-entry journal in observation mode while wallet RPCs wrote only to `wallets` and `transactions`. Two parallel ledger concepts existed with no automatic reconciliation between them.

TLP-004 required exactly **one authoritative financial ledger**.

---

## Options Considered

### Option A — Internal journal as authoritative

Wire every `fund_wallet`, `transfer_funds`, `create_withdrawal_request`, and `refund_withdrawal_request` call to post balanced journal entries to `journal_entries` / `journal_lines`.

**Rejected for TLP-004** because:

- All money RPCs already write immutable rows to `public.transactions` and update `public.wallets.wallet_balance`.
- Retrofitting double-entry posts into live RPCs increases migration risk without closing a production defect — balances were already correct via the transaction ledger.
- Treasury journal tables remain valuable for admin reporting but are not yet required for user-facing money movement.

### Option B — Transaction ledger as authoritative (selected)

**Authoritative system of record:**

| Layer | Table / column | Role |
|-------|----------------|------|
| Balance cache | `public.wallets.wallet_balance` | Current user balance (updated atomically in RPCs) |
| Transaction ledger | `public.transactions` | Immutable record of every money movement |
| Withdrawal state | `public.withdrawal_requests` | Workflow state linked to debit via `withdrawal_transaction_id` |
| Funding idempotency | `public.funding_idempotency_keys` | Duplicate funding prevention |
| Transfer idempotency | `public.transfer_idempotency_keys` | Duplicate transfer prevention (TLP-004) |
| Withdrawal idempotency | `public.withdrawal_idempotency_keys` | Duplicate withdrawal prevention (TLP-004) |

**Supplementary (non-authoritative):**

| Layer | Tables | Role |
|-------|--------|------|
| Treasury journal | `ledger_accounts`, `journal_entries`, `journal_lines` | Admin treasury reporting, manual adjustments, trial balance UI |

---

## Reconciliation Model

1. **Wallet balance** = sum of completed transaction effects for a user (funding credits, send debits/credits, withdrawal debits, refund credits).
2. Every RPC that moves money inserts exactly **one** `transactions` row per successful operation.
3. Idempotency tables ensure retries do not create duplicate RPC executions / transaction rows.
4. `lib/withdrawalReconciliation.js` reconciles withdrawal workflow state against transaction debits.

The internal journal is **not** used to derive user balances. Admin pages (`pages/admin/ledger.jsx`, `pages/admin/treasury.jsx`) may read journal data for treasury analytics only.

---

## Implementation Changes (TLP-004)

- Updated `supabase/sql/internal_ledger_phase1.sql` header to state non-authoritative role.
- Updated `lib/internalLedger.js` module documentation.
- Certification LED-001 validates this document and RPC transaction writes (LED-003).

---

## Future Work (post–Private Alpha)

If regulatory or treasury requirements mandate double-entry automation, implement Option A as a **Phase 2 journal mirroring** layer that posts from `transactions.id` as `source_id` — without replacing `transactions` as the user-facing ledger of record.

---

## Sign-off

| Role | Outcome |
|------|---------|
| Financial integrity | Single authoritative ledger: `public.transactions` + `public.wallets.wallet_balance` |
| Audit | All money RPCs write to `transactions`; idempotency keys prevent duplicates |
| Treasury | Journal retained for admin reporting; clearly non-authoritative |
