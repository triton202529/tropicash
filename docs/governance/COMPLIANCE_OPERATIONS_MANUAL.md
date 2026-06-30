# Compliance Operations Manual

**Version:** 1.0.0  
**Effective date:** 2026-06-30  
**Program:** Private Alpha

---

## 1. Overview

This manual describes Tropicash compliance operations for Private Alpha: organizational controls, workflows, policies, and system touchpoints. It complements technical certification (FTC-001) and launch readiness (TLP-001–004).

---

## 2. Governance structure

| Role | Responsibilities |
|------|------------------|
| **Admin** | Full platform administration |
| **Compliance** | KYC, AML, screening, SAR cases |
| **Ops** | Withdrawals, treasury, incidents |
| **Treasury** | Payout execution, reconciliation |

Roles stored in `admin_members` with `tc_is_admin()` enforcement.

---

## 3. Policy registry

| Document | Version | Location |
|----------|---------|----------|
| Terms of Service | 1.0.0 | docs/compliance + /legal/terms |
| Privacy Policy | 1.0.0 | docs/compliance + /legal/privacy |
| KYC Policy | 1.0.0 | docs/compliance + /legal/kyc-policy |
| AML Policy | 1.0.0 | docs/compliance + /legal/aml-policy |
| Acceptable Use | 1.0.0 | Terms §9 + AML Policy |
| Refund / Dispute | 1.0.0 | See §8 below |
| Cookie Policy | 1.0.0 | See §9 below |

---

## 4. System architecture (compliance layer)

Compliance controls sit **above** the financial engine:

```
User → Next.js API (KYC, account security, idempotency) → service_role RPCs
Admin → Compliance dashboard → audited account actions
```

Wallet RPCs are not modified for compliance actions.

---

## 5. Database objects (TLP-005)

| Table | Purpose |
|-------|---------|
| `compliance_screening_results` | Sanctions / PEP queue |
| `compliance_aml_cases` | SAR / investigation cases |
| `compliance_aml_case_notes` | Case notes |
| `compliance_incidents` | Operational incidents |
| `compliance_incident_notes` | Investigation notes |
| `compliance_account_actions` | Account control audit |

Migration: `supabase/sql/phase_tlp005_compliance_governance.sql`

---

## 6. Workflows

### 6.1 Onboarding

Register → KYC submit → screening queued → admin review → approved/rejected

### 6.2 Transaction monitoring

Fraud rules → fraud logs → optional risk case → optional AML case → account action

### 6.3 Withdrawal compliance

KYC gate → rate limits → admin approval → payout → reconciliation

---

## 7. Monitoring & reporting

- **Compliance dashboard:** `/admin/compliance-governance`  
- **Launch readiness:** `/admin/launch-readiness`  
- **Compliance checklist:** `/admin/compliance-checklist`  
- **Validation JSON:** `data/compliance/compliance_readiness.json`  

---

## 8. Refund & dispute policy (summary)

**Funding disputes:** Governed by payment provider (PayPal). Chargebacks may debit wallet.

**Transfer disputes:** Completed transfers are final unless error or fraud is proven. Users contact support within 30 days.

**Withdrawal disputes:** Rejected or failed withdrawals may be refunded via `refund_withdrawal_request` when status qualifies.

**Process:** Support ticket → operator review → AML/fraud check → resolution documented in case notes.

---

## 9. Cookie policy (summary)

Tropicash uses:

- **Essential cookies:** Authentication session (required)  
- **Functional cookies:** User preferences where enabled  
- **Analytics:** Only if disclosed and consented where required  

Users may control non-essential cookies via browser settings. No third-party advertising cookies in Private Alpha.

---

## 10. External AML vendor

TLP-005 implements **provider-agnostic hooks** only. External vendor integration is deferred to post–Private Alpha. Configure `TROPICASH_SANCTIONS_PROVIDER` when ready.

---

## 11. TLP-006 recommendation

Before Production Operations (TLP-006):

1. Apply `phase_tlp005_compliance_governance.sql` in Supabase  
2. Run `node scripts/tlp005-governance-validation.mjs`  
3. Complete counsel review of v1.0 policies  
4. Conduct incident tabletop exercise  
5. Verify account security fail-closed in production env  

**Target classification:** READY FOR PRODUCTION OPERATIONS (not live cutover until PayPal live + remaining launch items complete).

---

## 12. Document control

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-30 | Initial Private Alpha release (TLP-005) |

---

*Internal operations manual — not legal advice.*
