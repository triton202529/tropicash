# Card Funding Transaction Type Compatibility Audit (Phase C-002 / D)

**Date:** 2026-07-13
**Project ref:** `opbhcndlibbcsmoaeymq`
**Scope:** Compatibility of post-migration `transactions.type = 'fund_wallet'` vs historical `type = 'fund'`
**Constraint:** Read-only audit first; corrective SQL only if `fund_wallet` breaks or bypasses funding behavior.

---

## Verdict

**`type = 'fund_wallet'` is not fully compatible.** It bypasses at least one live funding-behavior consumer (`lib/fraudService.js`), splits the public funding vocabulary against a historical majority of `fund` rows, and is unnecessary once the double-credit trigger path is neutralized.

**Recommended design: OPTION A**

1. Keep / restore public transaction vocabulary `type = 'fund'` for canonical wallet funding rows.
2. Revise `update_wallet_balance()` / `trg_update_wallet_balance` so it does **not** mutate `wallets.wallet_balance` for fund inserts (RPC remains sole credit authority).
3. Keep `public.fund_wallet` as the only funding balance mutator; insert one `fund` transaction with `recipient_id` / `user_id` for UI and history continuity.
4. Narrow app follow-up: widen a few `fund_wallet`-only reporting queries to include `fund` so admin/risk totals do not regress.

**Not chosen**

| Option | Why not |
|--------|---------|
| **B** Keep `fund_wallet` and patch every consumer | Works, but introduces a second public funding type against preference to preserve vocabulary; still leaves historical `fund` (27 rows) split unless every consumer dual-reads. |
| **C** `fund` + metadata/source marker for trigger skip | Viable, but heavier than making the legacy auto-credit trigger a no-op, which already matches the documented sole-authority architecture. |

---

## Live database facts

### `trg_update_wallet_balance`

```text
CREATE TRIGGER trg_update_wallet_balance
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_balance();
```

### `public.update_wallet_balance()` (live)

On `INSERT`, if `NEW.type = 'fund'` and `NEW.status = 'completed'`, credits:

`wallets.wallet_balance += NEW.amount` where `user_id = NEW.recipient_id`.

It does **not** credit `fund_wallet` or `wallet_funded`.

### `transactions.type` CHECK (live)

Allows both `'fund'` and `'fund_wallet'` (plus other money types). No enum type; text + CHECK.

### Historical row mix (live, funding-related)

| type | count |
|------|------:|
| `fund` | 27 |
| `fund_wallet` | 3 |
| `wallet_funded` | 0 |

Post C-002 primary path currently inserts **`fund_wallet`** (the 3 rows include validation credits). Historical production vocabulary is overwhelmingly **`fund`**.

### Other DB objects

- No public/analytics views found that hard-filter funding types for this audit pass.
- DB functions referencing fund vocabulary: `fund_wallet`, `update_wallet_balance`, `refund_withdrawal_request` (type allow-list only).
- No evidence that notifications, webhooks, or ledger tables require `fund_wallet` specifically for funding rows. Capture-order creates notifications with type `wallet_funded` (notification type, not transaction type).

---

## Dependency matrix (repo + live)

| Area | Key locations | Expects | Impact of `fund_wallet` insert |
|------|---------------|---------|--------------------------------|
| Transaction history UI | `pages/transactions.jsx`, `pages/transactions/[id].js` | Normalizes `fund_wallet` → `fund` | **OK** — visible as fund |
| Wallet activity | `pages/wallet.js` | Maps `fund_wallet` → `fund` | **OK** |
| Insights / statements | `pages/insights.js` | Treats `fund`, `fund_wallet`, `wallet_funded` as fund | **OK** |
| Withdraw helper history | `pages/withdraw-wallet.jsx` | `.in(type, ['fund','fund_wallet'])` | **OK** |
| Admin treasury | `lib/adminTreasury.js` | `TYPE_MAP` maps both → `fund` | **OK** |
| Treasury intelligence | `lib/treasuryIntelligence.js` | Same normalize map | **OK** |
| KYC daily funding limits | `lib/kycRisk.js` `FUNDING_TRANSACTION_TYPES` | `fund_wallet`, `fund`, `wallet_funded` | **OK** — limits not bypassed |
| Capture-order $1k / rate / fin-gate | `pages/api/paypal/capture-order.js` | Amount/API gates; not tx-type totals | **OK** |
| Notifications | capture-order → `create_notification(... wallet_funded)` | Notification type, not tx type | **OK** — not tied to tx `fund` |
| Webhook processing | `lib/payouts/payPalWebhookProcessor.js` | Withdrawals only | **OK** — no fund credit path |
| Fraud phase-1 / funding fraud logs | `lib/fundingFraudServer.js`, `fraud_logs.transaction_type` | Logs use semantic `"fund"` | **OK** for logging |
| **Fraud history reads** | **`lib/fraudService.js`** | **`.eq('type','fund')` only** | **BYPASS** — new funding rows invisible to 30d fund-amount / last-fund windows |
| Risk engine funding velocity | `lib/riskEngine.js` | Counts `.eq('type','fund_wallet')` | Prefers `fund_wallet`; historical `fund` already undercounted |
| Admin ops / private alpha recon | `lib/adminOperationalOverview.js`, `lib/privateAlphaOps.js` | Daily funded `.eq('type','fund_wallet')` | Prefers `fund_wallet`; historical `fund` already undercounted |
| Ledger | journal tables / LEDGER docs | Not type-coupled to fund vs fund_wallet in live posting path | **No break found** |
| Audit / security events | event bus / capture-order | Use funding event names, not tx type | **OK** |
| CHECK / scripts / cert docs | SQL allow-lists, FTC docs | Both types allowed; docs often say `fund_wallet` | Dual vocabulary already documented |

---

## Explicit answers (required checklist)

1. **Hides from user?** No — UI normalizes `fund_wallet` → fund display.
2. **Bypasses funding-limit calculations?** No for KYC daily usage (`FUNDING_TRANSACTION_TYPES` includes both) and capture-order amount cap.
3. **Bypasses fraud or compliance checks?** **Yes** — `fraudService.fetchRecentFundAmounts` / `fetchLatestFundBefore` only query `type = 'fund'`.
4. **Prevents notification creation?** No — notifications are created separately as `wallet_funded`.
5. **Breaks reconciliation?** Partially — private-alpha / admin funded-today queries that only sum `fund_wallet` are consistent with the new type but remain inconsistent with historical `fund` rows.
6. **Breaks admin reporting?** Mixed — treasury normalizers OK; some admin KPI queries are `fund_wallet`-only.
7. **Changes ledger classification?** No active ledger posting branch found that hard-requires one funding type.
8. **Unknown type fallback?** UI/admin maps known aliases; unknown raw types fall through to generic/other labels in some admin maps — `fund_wallet` is known.
9. **Incompatibility with historical `fund` rows?** Yes — split vocabulary (27 `fund` vs 3 `fund_wallet`) unless consumers always dual-read.

---

## Safer design: OPTION A (chosen)

### SQL corrective shape

1. **`update_wallet_balance`**: stop mutating balances on `fund` inserts (return `NEW` without wallet UPDATE). Leave the trigger attached (do not disable unrelated trigger infrastructure).
2. **`fund_wallet` RPC**: credit `wallet_balance` exactly once; insert **one** `transactions` row with `type = 'fund'`, `status = 'completed'`, `recipient_id = p_user_id` (and `user_id` when column present); return jsonb receipt; remain `service_role` only.
3. Because the trigger no longer credits, inserting `fund` with `recipient_id` is safe and restores historical vocabulary.

### Narrow app follow-up (same phase if applying Option A)

Update `fund_wallet`-only funding aggregations to include `fund` (and ideally `wallet_funded`):

- `lib/riskEngine.js`
- `lib/adminOperationalOverview.js`
- `lib/privateAlphaOps.js`

`lib/fraudService.js` already matches Option A once inserts are `fund` again; optionally widen later for defense in depth.

### Why not keep `fund_wallet` (Option B)

There is a documented TLP-002 preference for `fund_wallet`, but:

- live history and fraud reads center on `fund`
- product guidance for this phase prefers preserving public vocabulary
- neutralizing the trigger removes the only strong reason to avoid `fund`

---

## Stop-condition decision

| Condition | Result |
|-----------|--------|
| Does `fund_wallet` bypass existing funding behavior? | **Yes** (`fraudService`) |
| Run PayPal sandbox probe? | **No** |
| Required next step | Corrective Option A migration + single-credit revalidation |

---

## Corrective application (completed)

Applied: `supabase/sql/card_funding_fund_wallet_type_compat_option_a_c002.sql`

| Change | Status |
|--------|--------|
| `update_wallet_balance()` → no-op (trigger retained) | Applied |
| `fund_wallet` inserts `type='fund'` + credits once | Applied |
| App dual-read widen (`fraudService`, `riskEngine`, admin/private-alpha) | Applied |
| Direct RPC revalidation | **PASS** (`txType=fund`, delta exact once, not doubled) |

Evidence:

- Audit: this document
- Migration record: `data/results/card_funding_fund_wallet_migration.json`
- Validation: `data/results/card_funding_double_credit_fix_validation.json`

**Stop for review.** Do not run PayPal sandbox probe until operator approval.

---

## Evidence files

- Pre-migration RPC dump: `data/results/card_funding_fund_wallet_pre_migration.json`
- Applied migration record: `data/results/card_funding_fund_wallet_migration.json`
- Root-cause notes: `docs/payments/CARD_FUNDING_DOUBLE_CREDIT_ROOT_CAUSE.md` (earlier trigger conclusion was incomplete; live trigger **did** credit `fund` when `recipient_id` is set; Option A disables that auto-credit)
