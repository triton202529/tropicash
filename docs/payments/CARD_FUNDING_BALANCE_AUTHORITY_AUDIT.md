# Card Funding Balance Authority Audit (Phase C-002 / E)

**Date:** 2026-07-13
**Project ref:** `opbhcndlibbcsmoaeymq`
**Starting state:** Option A applied — `fund_wallet` inserts `type='fund'` with `metadata.balance_authority='fund_wallet_rpc'`; `update_wallet_balance()` is a **global no-op**.

---

## Verdict

Production application funding writes exclusively through `public.fund_wallet` (via PayPal capture-order + service role). **However**, the live database still has a documented legacy mechanism: unmarked `transactions` inserts with `type='fund'`, `status='completed'`, and `recipient_id` historically depended on `trg_update_wallet_balance` to credit `wallets.wallet_balance`.

That legacy path is broken by the global no-op (transaction row without balance change). Probe/scripts and support/SQL recovery could still use it.

**Preferred safe design applied:** replace the global no-op with a **conditional** skip only when:

`NEW.type = 'fund'` AND `NEW.metadata->>'balance_authority' = 'fund_wallet_rpc'`

Otherwise preserve prior trigger credit behavior for unmarked legacy fund inserts.

`transactions.metadata` is `jsonb NULL`-able (default `NULL`). Null-safe check:

`coalesce(NEW.metadata->>'balance_authority', '') = 'fund_wallet_rpc'`

---

## Live column facts

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `transactions.metadata` | `jsonb` | YES | default NULL |
| `transactions.type` | `text` | YES | CHECK includes `fund`, `fund_wallet`, … |
| `transactions.status` | `text` | YES | default `completed` |
| `transactions.recipient_id` | `uuid` | YES | trigger keys off this |
| `transactions.source` | `text` | YES | unused by current RPC marker |

---

## Fund transaction writers

| Writer | Uses `fund_wallet` RPC? | Depends on trigger? | Auth boundary | Idempotency | Ledger | Notifications | Compatibility under global no-op |
|--------|-------------------------|---------------------|---------------|-------------|--------|---------------|----------------------------------|
| `pages/api/paypal/capture-order.js` → `rpc fund_wallet` | **Yes** | No (RPC credits) | Session user + `canServerPerformFinancialAction` + **service_role** RPC | `funding_idempotency_keys` + notification dup check | Wire ledger not posted here; tx row is SoR | `create_notification` type `wallet_funded` | **OK** |
| `public.fund_wallet` (live) | Self | Must **not** double with trigger | `service_role` EXECUTE only | Delegated to capture-order | Inserts one `fund` row + metadata marker | None inside RPC | **OK** with conditional skip |
| `scripts/c002-root-cause-probe.mjs` direct `.insert({type:'fund'})` | No | **Yes** (historically) | Local service-role script | None | N/A | N/A | **Broken** under global no-op |
| `scripts/card-funding-sandbox-probe.mjs` | Yes | No | service-role | Claim slot | N/A | May notify | OK |
| Admin UI (`pages/admin/*`) | No fund insert found | — | Admin session | — | — | — | No fund writer |
| `components/SendMoneyForm.jsx` | No | No | Client authenticated; inserts `send`/`receive`; mutates legacy `balance` | None | Client inserts | None | Not a fund writer (legacy/unsafe path separately) |
| `components/DepositToTritonForm.js` | No | No | Client; type `deposit_to_triton` | None | Client insert | None | Not a fund writer |
| SQL Editor / ops recovery insert `type=fund` | No | **Yes** (legacy expectation) | Operator / DB role | Operator-controlled | Manual | Manual | **Broken** under global no-op |

No production `pages/api` or `lib` path inserts `type: "fund"` except through the RPC.

---

## Wallet balance writers

| Writer | Mutates `wallet_balance`? | Via trigger? | Auth | Notes |
|--------|---------------------------|--------------|------|-------|
| `public.fund_wallet` | Yes (`+ p_amount` once) | No | service_role | Canonical funding authority |
| `public.update_wallet_balance` (trigger fn) | Was yes for unmarked `fund` | Yes | Runs as trigger on INSERT | Global no-op broke unmarked path |
| `public.transfer_funds` | Yes (debit/credit) | No | Currently executable by anon/authenticated/service_role (pre-existing grant drift) | Type `send_money` |
| `public.create_withdrawal_request` / withdraw RPCs | Yes (debit) | No | RPC | Withdraw types |
| `public.refund_withdrawal_request` | Yes (`+` refund) | No | SECURITY DEFINER; inserts `withdrawal_refund` (not `fund`) | Own balance update |
| `public.credit_wallet(user_id, amount)` | Yes (`+ amount`) | No | **anon/authenticated/service_role EXECUTE** (INVOKER) | **No transaction insert**; not referenced in app code — separate risk, out of C-002 scope |
| Legacy client forms | Update `balance` column | No | Client RLS | Does not use trigger; not canonical `wallet_balance` path |
| Probe scripts | Direct UPDATE / RPC | Mixed | service-role | Test only |

---

## Answers to required questions

1. **Any path outside `fund_wallet` inserts `type='fund'`?**
   Yes — probe scripts and potential ops/SQL recovery. No production API/lib writer found.

2. **Any path expects the trigger to credit?**
   Yes — historical unmarked `fund` + `recipient_id` + `completed` inserts.

3. **Admin / recovery funding?**
   No dedicated admin fund UI. Capability registry mentions `wallet.balance_adjust` but no live fund-insert implementation found. `credit_wallet` adjusts balance without a fund row.

4. **Historical import/reconcile funding?**
   No automated importer found. Historical rows are majority `fund` (pre-marker).

5. **Refunds / reversals / corrections?**
   Withdrawal refunds use `refund_withdrawal_request` + `withdrawal_refund` type and update balance inside the RPC — **not** via the fund trigger.

6. **Could global no-op create tx without balance change?**
   **Yes** — for unmarked legacy fund inserts. That is why the conditional rule is required.

---

## Unchanged systems (must remain)

| Area | Why unchanged by conditional trigger |
|------|--------------------------------------|
| Send-money | `transfer_funds` updates balances; type ≠ `fund` |
| Withdrawals | Own RPCs debit; types withdraw* |
| Refunds | `refund_withdrawal_request` own credit + `withdrawal_refund` |
| Reversals / admin adjustments | No fund-trigger dependency found |
| Ledger processing | Not driven by this trigger |
| Notifications | Capture-order creates `wallet_funded` separately |
| Fraud reads | Dual-read `fund` / `fund_wallet` / `wallet_funded` |
| Reconciliation / funding limits | API + KYC type lists; not trigger-based |

---

## Design decision

| Option | Decision |
|--------|----------|
| Keep global no-op | Rejected — breaks unmarked legacy fund writers |
| Restore unconditional trigger | Rejected — reintroduces RPC double-credit |
| **Conditional skip on `balance_authority=fund_wallet_rpc`** | **Chosen** |

Migration: `supabase/sql/card_funding_conditional_balance_authority_c002.sql`

---

## Corrective application (completed)

| Change | Status |
|--------|--------|
| Conditional `update_wallet_balance()` | Applied |
| Trigger object `trg_update_wallet_balance` preserved | Yes |
| Marked fund insert does not credit | **PASS** (cleaned up) |
| Unmarked legacy fund insert credits once | **PASS** (cleaned up) |
| Canonical RPC exact-once + `type=fund` + metadata marker | **PASS** |

Evidence:

- This audit
- `data/results/card_funding_balance_authority_validation.json`
- `data/results/card_funding_double_credit_fix_validation.json`
- `data/results/card_funding_fund_wallet_migration.json`

**Stop for review.** Do not run PayPal sandbox probe until operator approval.
