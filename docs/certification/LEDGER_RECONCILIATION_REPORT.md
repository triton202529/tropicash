# Ledger Reconciliation Report — FTC-001

**Date:** 2026-06-29  
**Scope:** Wallet balances, transaction ledger, internal journal, funding/withdrawal alignment

---

## Executive Summary

**Reconciliation status:** PARTIAL PASS  
**Score:** 72%

The **operational ledger** (`public.transactions` + `public.wallets.wallet_balance`) is the effective system of record. The **internal double-entry ledger** (`journal_entries` / `journal_lines`) does not participate in money movement reconciliation and cannot be used to certify full ledger integrity.

---

## 1. Wallet Reconciliation

### Canonical balance source

| Column | Role |
|--------|------|
| `wallets.wallet_balance` | **Authoritative** (TLP-002) |
| `wallets.balance` | Legacy; synced by RPCs when column exists |

### Reconstruction formula (per user)

```
wallet_balance ≈ SUM(fund_wallet) 
               - SUM(send_money as sender) 
               + SUM(receive as recipient)
               - SUM(withdraw_wallet)
               + SUM(withdrawal_refund credits)
```

**Caveat:** Transaction type aliases (`fund`, `send`, `wallet_funded`) require normalization in queries — see `lib/kycRisk.js` `FUNDING_TRANSACTION_TYPES`.

### Status

| Check | Result |
|-------|--------|
| Single canonical column defined | PASS |
| All RPCs use wallet_balance | PASS (post TLP-002) |
| UI reads canonical column | PASS (`wallet_balance ?? balance`) |
| Automated wallet-vs-transactions reconcile job | NOT IMPLEMENTED |

---

## 2. Funding Reconciliation

### Idempotency ledger

Table: `funding_idempotency_keys`

| Field | Purpose |
|-------|---------|
| `provider` + `provider_order_id` | Unique constraint — one credit per PayPal order |
| `status` | processing → completed / failed |
| `amount` | Captured amount |
| `user_id` | Owner |

### Reconciliation checks

| Check | Expected | Status |
|-------|----------|--------|
| One completed row per PayPal order | 1:1 | PASS (by design) |
| Completed row → fund_wallet transaction exists | Yes | PASS (when capture succeeds) |
| Failed row → no duplicate credit on retry | Yes | PASS |
| PayPal capture amount = wallet credit amount | Equal | PASS (amount from capture) |

**Evidence:** `lib/fundingIdempotency.js`, `pages/api/paypal/capture-order.js`

---

## 3. Transfer Reconciliation

### Conservation law (single RPC)

Within `transfer_funds`:
- Sender `wallet_balance` decreases by `amount`
- Recipient `wallet_balance` increases by `amount`
- One `send_money` transaction row inserted

| Check | Status |
|-------|--------|
| Net platform liability unchanged | PASS |
| Duplicate API → duplicate transactions | **FAIL** (no idempotency) |
| Orphan send without wallet movement | N/A (atomic RPC) |

---

## 4. Withdrawal Reconciliation

### Tooling

- **Report:** `lib/withdrawalReconciliation.js`
- **Admin UI:** `/admin/withdrawal-reconciliation`
- **Issue types:** 12 (stale pending, orphan tx, failed-not-refunded, etc.)

| Check | Status |
|-------|--------|
| Withdrawal request ↔ withdraw_wallet transaction link | PASS (phase_13d) |
| Rejected/failed → refund RPC | PASS |
| Duplicate withdrawal API calls | PARTIAL (rate limit only) |
| Live DB zero critical issues | REQUIRES MANUAL RUN |

---

## 5. Internal Ledger Reconciliation

### Status: NOT RECONCILED

```sql
-- internal_ledger_phase1.sql line 2:
-- No automatic journal posts from wallet or payment flows in this phase.
```

| Check | Status |
|-------|--------|
| journal_entries mirror wallet RPCs | FAIL |
| Trial balance reflects wallet liabilities | MANUAL ONLY |
| Every wallet debit has journal credit | FAIL |

**Designation recommendation:** Until journal wiring ships, certify against `transactions` + `wallets` only. Document internal ledger as **admin observation scaffold**.

---

## 6. Daily Reconciliation

| Report | Automated | Manual alternative |
|--------|-----------|-------------------|
| Daily funding totals | No | Admin treasury dashboard |
| Daily withdrawal queue | No | `/admin/withdrawals` |
| Wallet liability aggregate | No | `/admin/treasury` |
| Withdrawal reconciliation | No | `/admin/withdrawal-reconciliation` |

---

## 7. Orphan & Duplicate Detection

| Risk | Detection | Status |
|------|-----------|--------|
| Duplicate PayPal funding | Idempotency + notification fallback | PASS |
| Duplicate send | None | FAIL |
| Orphan withdraw transaction | Reconciliation report | PASS (detection) |
| Duplicate transaction UUID | PK constraint | PASS |

---

## Reconciliation Certification

**Wallet + transaction ledger:** Conditionally reconcilable for internal alpha with manual admin review.

**Internal journal ledger:** Not certified.

**Before Private Alpha:** Implement transfer/withdrawal idempotency; run live reconciliation report with zero critical issues; optionally wire journal posts.

---

*FTC-001 Ledger Reconciliation Report*
