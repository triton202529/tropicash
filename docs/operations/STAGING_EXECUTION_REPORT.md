# Staging Execution Report

**Version:** 1.0.0 · **TLP-006**  
**Environment:** Staging + PayPal Sandbox  
**Execution status:** Template — **live run pending operator sign-off**

---

## Purpose

Document end-to-end Private Alpha lifecycle validation in a deployed staging environment. Static certification (`tlp006-production-operations.mjs`) does not substitute for this checklist.

---

## Prerequisites

- [ ] Staging host deployed with sandbox env vars
- [ ] Supabase staging project with TLP-002 through TLP-005 migrations
- [ ] PayPal sandbox business + personal test accounts
- [ ] Two test users (sender + recipient) + one admin account

---

## Stage 1 — Register account

| Step | Action | Expected | Pass | Evidence |
|------|--------|----------|------|----------|
| 1.1 | Register user A | Account created | ☐ | |
| 1.2 | Register user B | Account created | ☐ | |
| 1.3 | Email verification (if enabled) | Verified | ☐ | |

---

## Stage 2 — Complete KYC

| Step | Action | Expected | Pass | Evidence |
|------|--------|----------|------|----------|
| 2.1 | User A submits KYC | Status `submitted` | ☐ | |
| 2.2 | Screening queued | 2 rows in `compliance_screening_results` pending | ☐ | |
| 2.3 | Admin approves screening | `approved` | ☐ | |
| 2.4 | Admin approves KYC | Status `approved` | ☐ | |

Repeat for User B.

---

## Stage 3 — Fund wallet (Sandbox)

| Step | Action | Expected | Pass | Evidence |
|------|--------|----------|------|----------|
| 3.1 | User A fund $10 | PayPal sandbox approve | ☐ | |
| 3.2 | Capture succeeds | Balance +$10 | ☐ | |
| 3.3 | Duplicate capture same orderID | 200 duplicate, no double credit | ☐ | |
| 3.4 | KYC-blocked user fund attempt | 403 before capture | ☐ | |

---

## Stage 4 — Peer-to-peer transfer

| Step | Action | Expected | Pass | Evidence |
|------|--------|----------|------|----------|
| 4.1 | User A sends $5 to B | Success | ☐ | |
| 4.2 | Retry same idempotency key | 200 duplicate | ☐ | |
| 4.3 | Insufficient funds attempt | 400 | ☐ | |

---

## Stage 5 — Withdrawal request

| Step | Action | Expected | Pass | Evidence |
|------|--------|----------|------|----------|
| 5.1 | User A requests withdrawal | Request created | ☐ | |
| 5.2 | Duplicate idempotency key | No double debit | ☐ | |

---

## Stage 6 — Admin approval

| Step | Action | Expected | Pass | Evidence |
|------|--------|----------|------|----------|
| 6.1 | Admin reviews withdrawal | Approve/reject workflow | ☐ | |
| 6.2 | Payout sandbox (if enabled) | Status updated | ☐ | |

---

## Stage 7 — Ledger reconciliation

| Step | Action | Expected | Pass | Evidence |
|------|--------|----------|------|----------|
| 7.1 | Wallet balance = transaction sum | Matches | ☐ | |
| 7.2 | Withdrawal linked to transaction | `withdrawal_transaction_id` set | ☐ | |
| 7.3 | No orphaned idempotency `processing` | Clean | ☐ | |

---

## Stage 8 — Audit verification

| Step | Action | Expected | Pass | Evidence |
|------|--------|----------|------|----------|
| 8.1 | Transfer audit timeline | Event recorded | ☐ | |
| 8.2 | Admin withdrawal action logged | `admin_audit_logs` | ☐ | |
| 8.3 | Operational logs no critical spike | Review `/admin/logs` | ☐ | |

---

## Stage 9 — Compliance verification

| Step | Action | Expected | Pass | Evidence |
|------|--------|----------|------|----------|
| 9.1 | Compliance dashboard stats | Loads | ☐ | |
| 9.2 | Account restrict blocks send | 403 | ☐ | |
| 9.3 | Restore access | Transactions allowed | ☐ | |

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Operator | | | |
| Compliance | | | |

---

## Result

When all stages pass, update `data/operations/staging_validation_results.json`:

```json
{ "executed": true, "all_pass": true }
```

Until then, TLP-006 classification remains **READY FOR PRIVATE ALPHA (static)** with live E2E **pending**.

---

*Do not mark PASS without executed evidence.*
