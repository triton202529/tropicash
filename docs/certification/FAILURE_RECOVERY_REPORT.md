# Failure Recovery Report — FTC-001

**Date:** 2026-06-29  
**Scope:** Simulated and code-verified failure scenarios

---

## Summary

**Failure recovery score:** 70% (live) / 100% (funding paths verified statically)

Funding flows demonstrate strong recovery semantics. Transfer and withdrawal paths lack idempotency-based recovery. Account security guard fail-open remains a residual risk.

---

## Scenario Matrix

| ID | Scenario | Expected behavior | Result | Evidence |
|----|----------|-------------------|--------|----------|
| FR-001 | fund_wallet RPC fails after PayPal capture | Idempotency → failed; retry allowed | **PASS** | `capture-order.js` patches status failed |
| FR-002 | Duplicate capture (same orderID) | No double credit | **PASS** | `duplicate_completed` |
| FR-003 | Concurrent capture same order | 409 ALREADY_PROCESSING | **PASS** | `already_processing` |
| FR-004 | Transfer insufficient funds | No debit; insufficient_funds error | **PASS** | `transfer_funds` RPC |
| FR-005 | Network retry duplicate transfer POST | Same result, no second debit | **FAIL** | No idempotency key |
| FR-006 | Double-click withdrawal | Single request | **PARTIAL** | Rate limit 5/hour only |
| FR-007 | account_security_status missing | Block all financial actions | **FAIL** | Fail-open in guard |
| FR-008 | KYC blocked after PayPal capture | No wallet credit; clear user state | **PARTIAL** | PayPal captured; wallet blocked |
| FR-009 | Withdrawal rejected | Wallet refunded | **PASS** | `refund_withdrawal_request` |
| FR-010 | Unauthorized API call | 401 | **PASS** | `requireUserFromRequest` |
| FR-011 | Invalid transfer payload | 400 | **PASS** | API validation |
| FR-012 | Database unavailable mid-RPC | Transaction rollback | **PASS** | PostgreSQL atomic RPC |
| FR-013 | API timeout after RPC success | Client may retry → duplicate | **FAIL** | Transfer/withdraw |

---

## Funding Recovery Detail

### Happy path interruption points

```
create-order → [PayPal UI] → capture-order
                              ├─ idempotency claim
                              ├─ PayPal capture
                              ├─ KYC gate
                              └─ fund_wallet → mark completed
```

### Recovery semantics

| Failure point | Wallet state | Idempotency state | User action |
|---------------|--------------|-------------------|-------------|
| Before capture | Unchanged | processing | Retry capture |
| Capture fails | Unchanged | failed | Retry or support |
| fund_wallet fails | Unchanged | failed | Retry capture |
| After completed | Credited | completed | Duplicate returns success |

---

## Transfer Recovery Detail

**Atomic RPC:** All-or-nothing within PostgreSQL transaction.

**Retry problem:** Client receives timeout but RPC committed → retry creates second transfer.

**Recommended fix:** `Idempotency-Key` header stored in `transfer_idempotency_keys`; replay returns original `transaction_id`.

---

## Withdrawal Recovery Detail

**Atomic RPC:** Debit + request + transaction in one transaction.

**Duplicate submit:** Two pending withdrawals if rate limit not exceeded.

**Rejection path:** Admin rejects → `refund_withdrawal_request` idempotent credit.

---

## Security Failure Modes

| Attack / failure | Mitigation | Gap |
|------------------|------------|-----|
| Client RPC bypass | Revoked grants | Legacy SQL if mis-applied |
| Stolen JWT | Short-lived; KYC gate | No step-up 2FA |
| Replay webhook (PayPal) | Signature verify + payout idempotency | — |
| Fraud log tampering | Admin-only RLS | — |

---

## Residual Risks (Documented, Not Fixed in FTC-001)

1. **Fail-open account security** — missing table allows financial actions  
2. **KYC after PayPal capture** — funds at PayPal without wallet credit  
3. **No automated integration test suite** — recovery verified by code review only  

---

## Corrective Actions

| Priority | Action | Effort |
|----------|--------|--------|
| P0 | Transfer idempotency keys | 3–5 days |
| P0 | Withdrawal idempotency keys | 2–3 days |
| P1 | Fail-closed account security for money APIs | 1–2 days |
| P1 | KYC gate before PayPal capture OR refund automation | 2–3 days |
| P2 | Integration test suite for failure scenarios | 1 week |

---

*FTC-001 Failure Recovery Report*
