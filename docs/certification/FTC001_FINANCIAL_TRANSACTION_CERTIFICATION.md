# FTC-001 Financial Transaction Certification

**Program:** TLP-003  
**Certification ID:** FTC-001  
**Date:** 2026-06-29  
**Method:** Static code/SQL inspection (`scripts/ftc001-certification.mjs`) + architectural review  
**Live integration tests:** Not executed in this environment (no Supabase/PayPal credentials)

---

## Final Classification

### CERTIFIED FOR INTERNAL ALPHA

**Full certification pass:** NO  
**Overall certification score:** 78%

The Tropicash financial engine is **certified for controlled internal alpha testing** with documented caveats. It is **not certified for Private Alpha** until transfer/withdrawal idempotency and internal ledger reconciliation gaps are resolved.

---

## Certification Scorecard

```
Wallet Funding          ████████████████████ 100%
Transfers               ███████████████░░░░░  75%
Withdrawals             ████████████████░░░░  80%
Ledger Integrity        █████░░░░░░░░░░░░░░░  25%
Security                ████████████████████ 100%
Failure Recovery        ████████████████████ 100%
Reconciliation          ██████████████░░░░░░  72%
Audit Logging           ████████████████████ 100%
Idempotency             ██████████░░░░░░░░░░  50%
----------------------------------------
Overall Certification   ████████████████░░░░  78%
```

---

## Pass / Fail Criteria

| Criterion | Result | Notes |
|-----------|--------|-------|
| No balance corruption | **PASS** | RPCs guard `wallet_balance >= amount`; canonical column in TLP-002 |
| No duplicate money movement | **FAIL** | Transfers/withdrawals lack idempotency keys |
| No unrecoverable failures | **PASS** | Funding idempotency supports retry; failed states tracked |
| Ledger reconciles | **FAIL** | Internal ledger observation-only; not wired to wallet RPCs |
| Audit trail complete | **PASS** | transactions, audit_timeline, operational_logs, admin_audit |
| Server-authoritative execution | **PASS** | TLP-002 revoked client RPC grants |
| KYC enforced | **PASS** | `enforceServerKycForAction` on all money APIs |
| RBAC enforced | **PASS** | `admin_members` + `tc_is_admin()` |
| Idempotency confirmed | **FAIL** | Funding only; send/withdraw vulnerable to duplicate POST |

---

## Area Summaries

### 1. Wallet Funding — PASS (100%)

**Verified controls:**
- PayPal create-order → capture-order pipeline with JWT auth
- `funding_idempotency_keys` unique on `(provider, provider_order_id)`
- Duplicate completed / already processing / retry forbidden paths
- Notification fallback duplicate detection
- `fund_wallet` RPC credits `wallet_balance` + inserts `fund_wallet` transaction
- Failed `fund_wallet` marks idempotency row `failed`

**Gap (non-blocking for internal alpha):**
- `fund_wallet` RPC itself always inserts a new transaction row if called directly (mitigated by service_role-only + API idempotency)
- KYC gate runs **after** PayPal capture — PayPal may capture while wallet credit is blocked

**Evidence:** `pages/api/paypal/capture-order.js`, `lib/fundingIdempotency.js`, `phase_tlp002_foundation_hardening.sql`

---

### 2. Peer-to-Peer Transfers — PARTIAL (75%)

**Verified controls:**
- Server API `POST /api/transfers/send` only path from UI
- KYC, account security, rate limit (20/hour)
- Atomic `transfer_funds` RPC with insufficient_funds guard
- Transaction type `send_money` (TLP-002 fix)
- Audit timeline + event bus logging

**Failures:**
- **IDEM-002:** No `Idempotency-Key` header — duplicate POST creates duplicate transfers
- No client-side RPC bypass possible after migration

**Evidence:** `pages/api/transfers/send.js`, `pages/send-money.jsx`

---

### 3. Withdrawals — PARTIAL (80%)

**Verified controls:**
- Server API `POST /api/withdrawals/create`
- Atomic debit + `withdrawal_requests` + `withdraw_wallet` transaction
- `refund_withdrawal_request` for rejected/failed paths
- Reconciliation tooling (`lib/withdrawalReconciliation.js`)
- Admin approval/payout workflow exists

**Failures:**
- **IDEM-003:** No idempotency key — double-submit within rate limit may duplicate
- **MIG-001:** Legacy `create_withdrawal_request_rpc.sql` still grants `authenticated` if applied after TLP-002 out of order

**Evidence:** `pages/api/withdrawals/create.js`, `phase_13c_withdrawal_refunds.sql`

---

### 4. Ledger Integrity — FAIL (25%)

**System of record:** `public.transactions` + `public.wallets.wallet_balance`

**Failures:**
- **LED-001:** Internal double-entry ledger (`journal_entries`) does not auto-post from money flows
- Cannot demonstrate every debit has matching credit in internal ledger
- Historical balance reconstruction possible from `transactions` table only

**Passes:**
- Transfer conservation within RPC (sender debit = recipient credit)
- No duplicate transaction IDs (UUID primary keys)

**Evidence:** `supabase/sql/internal_ledger_phase1.sql`, `lib/internalLedger.js`

---

### 5. Idempotency — FAIL (50%)

| Operation | Duplicate protection | Status |
|-----------|------------------------|--------|
| Funding (PayPal order) | `funding_idempotency_keys` | PASS |
| Transfer | None | FAIL |
| Withdrawal | Rate limit only | PARTIAL |
| PayPal webhook | Payout idempotency key | PASS (payouts) |

---

### 6. Failure Recovery — PARTIAL (70% live / 100% static funding paths)

See `FAILURE_RECOVERY_REPORT.md`. Critical gap: account security fail-open; KYC-after-capture edge case.

---

### 7. Security — PASS (100%)

- Client cannot call `transfer_funds` / `create_withdrawal_request` after TLP-002 migration
- Unauthorized JWT → 401
- KYC unapproved → 403
- Fraud logs RLS admin-only (TLP-002)
- PayPal mode guard (`lib/paypalProductionGuard.js`)

---

### 8. Reconciliation — PARTIAL (72%)

See `LEDGER_RECONCILIATION_REPORT.md`. Withdrawal reconciliation tooling strong; no automated daily job.

---

## Critical Findings (Must Fix Before Private Alpha)

| ID | Finding | Root cause | Recommended fix | Effort |
|----|---------|------------|-----------------|--------|
| FTC-F01 | Duplicate transfers on API retry | No idempotency on `/api/transfers/send` | Add `transfer_idempotency_keys` table + header check | 3–5 days |
| FTC-F02 | Duplicate withdrawals on double-submit | No idempotency on `/api/withdrawals/create` | Add idempotency key per withdrawal intent | 2–3 days |
| FTC-F03 | Internal ledger not reconciled | Phase 1 observation mode | Wire journal posts to RPCs OR formally designate transactions as SOA | 1–2 weeks |
| FTC-F04 | SQL migration drift | Legacy SQL files grant authenticated | Add migration guard doc; remove grants from legacy files | 0.5 day |
| FTC-F05 | KYC after PayPal capture | Gate order in capture-order | Move KYC check before PayPal capture or auto-refund path | 2–3 days |

---

## Recommended Corrective Order

1. FTC-F04 — Migration drift documentation / legacy SQL cleanup  
2. FTC-F01 — Transfer idempotency  
3. FTC-F02 — Withdrawal idempotency  
4. FTC-F05 — KYC/capture ordering  
5. FTC-F03 — Ledger wiring (can parallel with Private Alpha prep)

---

## Artifacts

| File | Purpose |
|------|---------|
| `data/certification/ftc001_results.json` | Machine-readable test results |
| `data/certification/reconciliation_results.json` | Reconciliation assessment |
| `data/certification/failure_recovery_results.json` | Failure scenario matrix |
| `data/certification/transaction_validation_results.json` | Money path validation |
| `scripts/ftc001-certification.mjs` | Repeatable static certification runner |

---

## Re-run Certification

```bash
node scripts/ftc001-certification.mjs
```

Live certification (recommended before Private Alpha): execute manual test matrix in `MONEY_MOVEMENT_VALIDATION.md` against staging Supabase with sandbox PayPal.

---

*FTC-001 complete. Classification: CERTIFIED FOR INTERNAL ALPHA — not Private Alpha.*
