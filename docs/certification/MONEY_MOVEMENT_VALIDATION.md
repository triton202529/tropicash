# Money Movement Validation — FTC-001

**Date:** 2026-06-29  
**Purpose:** Document certification scenarios, expected outcomes, and evidence

---

## Validation Methodology

| Layer | Method | Executed |
|-------|--------|----------|
| Static control verification | `scripts/ftc001-certification.mjs` | Yes |
| Code path review | Manual inspection | Yes |
| Live Supabase RPC tests | Manual / staging | **Not in CI** |
| PayPal sandbox E2E | Manual | **Not in CI** |
| Concurrent load tests | — | **Not executed** |

---

## 1. Wallet Funding Scenarios

| # | Scenario | Expected | Static | Live |
|---|----------|----------|--------|------|
| F-01 | Successful fund $50 | wallet_balance += 50; tx type fund_wallet | PASS | Pending |
| F-02 | Duplicate capture same orderID | duplicate: true; no second credit | PASS | Pending |
| F-03 | Refresh browser mid-capture | Idempotency prevents double | PASS | Pending |
| F-04 | Amount > $1000 | 400 rejected | PASS | Pending |
| F-05 | Unauthenticated capture | 401 | PASS | Pending |
| F-06 | KYC not approved | 403; no wallet credit | PASS | Pending |
| F-07 | PayPal capture fails | 502; idempotency failed | PASS | Pending |
| F-08 | fund_wallet RPC error | 500; idempotency failed | PASS | Pending |

**Evidence:** `pages/api/paypal/capture-order.js`, `lib/fundingIdempotency.js`

---

## 2. Transfer Scenarios

| # | Scenario | Expected | Static | Live |
|---|----------|----------|--------|------|
| T-01 | Send $10 to valid recipient | sender -= 10; recipient += 10; send_money tx | PASS | Pending |
| T-02 | Insufficient funds | 400 insufficient_funds | PASS | Pending |
| T-03 | Send to self | 400 cannot_send_to_self | PASS | Pending |
| T-04 | Duplicate POST (retry) | **Same result, no double debit** | **FAIL** | Pending |
| T-05 | Concurrent sends draining balance | Second fails insufficient_funds | PASS | Pending |
| T-06 | No JWT | 401 | PASS | Pending |
| T-07 | KYC not approved | 403 | PASS | Pending |
| T-08 | Client RPC transfer_funds | Error / not authorized | PASS | Pending |

**Evidence:** `pages/api/transfers/send.js`, `phase_tlp002_foundation_hardening.sql`

---

## 3. Withdrawal Scenarios

| # | Scenario | Expected | Static | Live |
|---|----------|----------|--------|------|
| W-01 | Create withdrawal $25 | wallet debited; pending request | PASS | Pending |
| W-02 | Duplicate submit | Single request | PARTIAL | Pending |
| W-03 | Insufficient balance | Error | PASS | Pending |
| W-04 | Admin reject + refund | wallet credited back | PASS | Pending |
| W-05 | Missing payout email | 400 | PASS | Pending |
| W-06 | Rate limit exceeded | 429 | PASS | Pending |

**Evidence:** `pages/api/withdrawals/create.js`, `phase_13c_withdrawal_refunds.sql`

---

## 4. Authorization Scenarios

| # | Scenario | Expected | Result |
|---|----------|----------|--------|
| A-01 | transfer_funds as authenticated client | Denied (post TLP-002) | PASS |
| A-02 | fund_wallet as authenticated client | Denied | PASS |
| A-03 | create_withdrawal_request as authenticated | Denied (post TLP-002) | PASS |
| A-04 | Money API without Bearer token | 401 | PASS |
| A-05 | Non-admin reads all fraud_logs | Denied (post TLP-002 RLS) | PASS |

---

## 5. Ledger Validation

| # | Check | Result |
|---|-------|--------|
| L-01 | transfer_funds prevents negative balance | PASS |
| L-02 | create_withdrawal_request uses FOR UPDATE | PASS |
| L-03 | Transaction UUID uniqueness | PASS |
| L-04 | Internal journal auto-posts | FAIL |
| L-05 | Balance reconstructable from transactions | PASS (design) |

---

## 6. Idempotency Validation

| # | Operation | Double-click | Duplicate API | Webhook replay |
|---|-----------|--------------|-------------|----------------|
| I-01 | Funding | Protected | Protected | N/A |
| I-02 | Transfer | **Not protected** | **Not protected** | N/A |
| I-03 | Withdrawal | Partial (rate limit) | Partial | N/A |
| I-04 | PayPal payout | N/A | N/A | Protected |

---

## Live Test Protocol (Staging)

Before Private Alpha, execute manually:

1. Apply `phase_tlp002_foundation_hardening.sql` to staging Supabase  
2. Configure sandbox PayPal env vars  
3. Run F-01 through F-08 with test user (approved KYC)  
4. Run T-01 through T-07  
5. Run W-01 through W-04  
6. Run `/admin/withdrawal-reconciliation` — confirm zero critical  
7. Record results in `data/certification/ftc001_results.json` live section  

---

## Validation Score

**Static validation:** 82%  
**Live validation:** Not executed — required before upgrading to Private Alpha certification

---

*FTC-001 Money Movement Validation*
