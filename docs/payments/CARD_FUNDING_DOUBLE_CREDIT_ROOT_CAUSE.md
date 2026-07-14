# Card Funding Double-Credit — Root Cause (Phase C-002)

**Date:** 2026-07-12
**Project ref:** `opbhcndlibbcsmoaeymq` (from `NEXT_PUBLIC_SUPABASE_URL`)
**PayPal mode:** sandbox (not live card charging)
**Probe evidence:** `data/results/card_funding_double_credit_root_cause_probe.json`

---

## Verdict

**Root cause family: B — live `public.fund_wallet(uuid, numeric)` credits `wallets.wallet_balance` by `2 × p_amount` inside the RPC itself.**

Hypothesis **A (transaction trigger)** is **disproven**.

| Probe | Result |
|-------|--------|
| Direct `UPDATE wallets.wallet_balance += 0.01` | Delta `+0.01` (1:1) |
| Insert `transactions` type `fund` only | Wallet delta `0` — **no credit trigger** |
| Insert `transactions` type `fund_wallet` only | Wallet delta `0` — **no credit trigger** |
| `rpc fund_wallet(p_amount := 0.17)` | Wallet delta `+0.34` (**exactly 2×**) |
| Same RPC side-effect inspect (`0.13` → `+0.26`) | **No new transaction row**; RPC returns `null` (void-like) |

So the duplicate credit is **not**:

- A. fund_wallet + `transactions` AFTER INSERT trigger
- C. capture-order calling fund_wallet twice (RPC alone doubles)
- D. PayPal funding webhook + capture-order (webhook handles **payouts only**; see below)
- E. Multiple triggers on the same transaction insert

It **is**:

- **B.** The deployed `fund_wallet` function body increases `wallet_balance` twice (or by `2 * p_amount`). The function also does **not** currently insert a funding transaction / return jsonb (drift from `phase_tlp002_foundation_hardening.sql`).

MCP cannot currently `pg_get_functiondef` this project (permission denied under the authenticated Supabase org). Behavioral probes are the active evidence.

---

## Canonical credit authority (target architecture)

| Component | Role after fix |
|-----------|----------------|
| **`public.fund_wallet(uuid, numeric)`** | **Sole** wallet funding balance mutation + funding transaction insert + jsonb receipt |
| `pages/api/paypal/capture-order.js` | Verify PayPal capture, claim idempotency, call `fund_wallet` **once**, notify |
| `funding_idempotency_keys` | Prevent duplicate credits per provider order |
| `pages/api/webhooks/paypal.js` | **Payouts only** — must not call `fund_wallet` |
| Generic `transactions` INSERT | Must **not** independently mutate `wallet_balance` for fund types |

**Retain:** `fund_wallet` as sole funding credit authority.
**Remove/replace:** the drifted live `fund_wallet` body that double-credits.
**Do not disable:** unrelated send/withdraw/refund RPCs or non-funding triggers (none found on `transactions`/`wallets` for fund credits).

---

## Active path before the fix

```
capture-order (verified PayPal COMPLETED)
  → claimFundingProcessingSlot(provider_order_id)
  → rpc fund_wallet(p_user_id, p_amount)
       → [BUG] wallet_balance += 2 * p_amount
       → [DRIFT] no funding transaction / null return
  → create_notification / idempotency completed
```

App-level capture-order invokes the RPC **once** per claimed slot. The 2× delta is entirely inside the RPC.

---

## Effects on other money flows

| Flow | Impact of replacing `fund_wallet` only |
|------|----------------------------------------|
| Send-money (`transfer_funds`) | Unaffected (separate RPC) |
| Withdrawals (`create_withdrawal_request`) | Unaffected |
| Withdrawal refunds | Unaffected |
| Admin adjustments | Unaffected unless they call `fund_wallet` |
| Non-PayPal `transactions` type `fund` inserts | Still do **not** auto-credit (no trigger) — correct |
| Historical balances | **Not rewritten** by this migration |

---

## Webhook collision (funding)

`lib/payouts/payPalWebhookProcessor.js` resolves **withdrawal_requests** by PayPal payout batch/item IDs only. It never calls `fund_wallet` or updates `wallets` for `PAYMENT.CAPTURE.COMPLETED` funding events.

Therefore funding double-credit is **not** webhook-driven. Idempotency still protects capture-order replay via `funding_idempotency_keys`.

---

## Fix design

Replace `public.fund_wallet` with a single-credit implementation that:

1. Locks/updates `wallet_balance` by **exactly** `p_amount` once
2. Sets legacy `balance = wallet_balance` (equal assign, never add)
3. Inserts one `transactions` row (`fund_wallet`, fallback `fund` on check violation)
4. Returns jsonb `{ success, transaction_id, wallet_balance, credited_amount }`
5. Remains `service_role` only

SQL file: `supabase/sql/card_funding_fund_wallet_double_credit_fix_c001.sql`
(Phase C-002 revision — trigger disable **not** used because no fund-credit trigger exists.)

---

## Rollback

```sql
-- Restore prior behavior ONLY if emergency rollback is required.
-- Prefer re-applying a known-good backup definition from Supabase dashboard
-- Database → Functions → fund_wallet (version history) if available.
-- Do not reintroduce 2× credit intentionally.
```

Practical rollback: restore the previous function definition from a DB backup or dashboard history. The C-002 migration file itself is the forward fix; keep a copy of the pre-fix definition in ops notes when MCP/SQL Editor can dump `pg_get_functiondef`.

---

## Apply status

Automated Supabase MCP `execute_sql` / `apply_migration` against `opbhcndlibbcsmoaeymq` returns **permission denied**. Authenticated MCP org currently lists only **ElitePro Project**, not Tropicash.

Operator must apply the SQL in the Tropicash project SQL Editor (see instructions in the migration header).
