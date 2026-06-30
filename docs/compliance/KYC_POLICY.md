# Tropicash Know Your Customer (KYC) Policy

**Version:** 1.0.0  
**Effective date:** 2026-06-30  
**Program:** Private Alpha

---

## 1. Purpose

This policy defines identity verification requirements for Tropicash users during Private Alpha, including document collection, review workflow, status outcomes, and enforcement at money-movement APIs.

---

## 2. Verification requirements

Users may be required to provide:

- Full legal name and date of birth
- Residential address
- Government-issued identification (type and last-four digits recorded; images stored securely)
- Selfie or liveness check when enabled

Documents are stored in private storage with signed URL access only.

---

## 3. KYC statuses

| Status | Meaning |
|--------|---------|
| `not_started` | User has not submitted verification |
| `submitted` | Awaiting initial review |
| `under_review` | Compliance operator reviewing |
| `approved` | Identity verified for policy limits |
| `rejected` | Verification failed |
| `needs_more_info` | User must resubmit or clarify |

---

## 4. Enforcement

When `TROPICASH_REQUIRE_APPROVED_KYC=true` (default for Private Alpha):

- **Funding, transfers, and withdrawals** are blocked server-side until KYC is `approved`
- Enforcement occurs at API layer (`lib/serverKycGuard.js`), not client UI
- Withdrawals may have additional daily limits per KYC tier policy

---

## 5. Sanctions / PEP linkage

Upon KYC submission, Tropicash queues **sanctions** and **PEP** screening records for operator review (`/api/compliance/queue-screening`). Screening outcomes may delay or block approval.

---

## 6. Admin review

KYC review is performed via `/admin/kyc`. Operators must:

- Verify document authenticity and name consistency
- Resolve pending screening results before approval when matches exist
- Record rejection reasons and resubmission guidance
- Log status changes in audit trail

---

## 7. Data protection

KYC data is processed per the Privacy Policy. Access is limited to the user and authorized administrators. Documents are not exposed via public APIs.

---

## 8. Resubmission

Users with `rejected` or `needs_more_info` may resubmit unless account is restricted or frozen for compliance reasons.

---

## 9. Policy review

Reviewed annually or when regulatory requirements change. Version 1.0.0 effective 2026-06-30.

---

*Operational policy — not legal advice.*
