# Tropicash Operator Compliance Guide

**Version:** 1.0.0  
**Effective date:** 2026-06-30  
**Audience:** Admin, Compliance, and Operations operators

---

## 1. Access requirements

- Admin access via `admin_members` table and `tc_is_admin()` RPC only  
- No hardcoded admin emails in application code  
- All sensitive actions logged to `admin_audit_logs`  

---

## 2. Daily operator checklist

1. Review **Compliance & Governance** dashboard (`/admin/compliance-governance`)  
2. Clear **KYC queue** (`/admin/kyc`) — submitted / under_review  
3. Review **pending sanctions/PEP screenings** — approve, reject, or manual override  
4. Triage **open AML cases** — assign and document notes  
5. Check **restricted/frozen accounts** — confirm reasons documented  
6. Review **open compliance incidents**  

---

## 3. User verification (KYC)

| Step | Action |
|------|--------|
| 1 | Open user in `/admin/kyc` |
| 2 | Verify screening results are not pending rejection |
| 3 | Compare legal name to documents |
| 4 | Set status: approved, rejected, or needs_more_info |
| 5 | Add internal notes for audit |

**Do not approve** if sanctions screening is `rejected` without compliance lead override.

---

## 4. Withdrawal review

1. Open `/admin/withdrawals`  
2. Verify KYC approved and account not restricted  
3. Check fraud/risk signals on user  
4. Approve payout or reject with documented reason  
5. Refund path available for rejected/failed via `refund_withdrawal_request`  

---

## 5. Fraud investigation

1. Review `/admin/fraud-queue` and `/admin/fraud`  
2. Open linked **risk case** or create **AML case**  
3. Add investigation notes  
4. Recommend account action (watch → restrict → freeze)  
5. Apply action via Compliance dashboard with **required reason**  

---

## 6. Account restriction procedures

See `docs/governance/ACCOUNT_RESTRICTION_PROCEDURES.md`.

Summary:

| Action | Effect |
|--------|--------|
| **watch** | Monitoring only; transactions allowed |
| **restrict** | Blocks send, withdraw, payout methods |
| **freeze** | Blocks all financial actions |
| **restore_access** | Returns to normal (requires reason) |

Every action creates a row in `compliance_account_actions`.

---

## 7. AML escalation

Escalate to compliance lead when:

- SAR draft warranted  
- PEP match without clear false positive  
- Structuring pattern across multiple users  
- Any transaction > internal threshold with incomplete KYC  

Update AML case status to `escalated` and add narrative note.

---

## 8. Emergency suspension

For active fraud or breach:

1. **Freeze** account immediately (Compliance dashboard)  
2. Create **Critical** compliance incident  
3. Notify compliance lead  
4. Preserve logs; do not delete records  
5. Post-incident review within 5 business days  

---

## 9. Prohibited operator behavior

- Bypassing server APIs to invoke wallet RPCs  
- Approving KYC without document review  
- Account actions without documented reason  
- Sharing KYC documents outside authorized systems  

---

## 10. References

- `docs/compliance/AML_POLICY.md`  
- `docs/compliance/KYC_POLICY.md`  
- `docs/compliance/INCIDENT_RESPONSE_PLAYBOOK.md`  
- `docs/governance/COMPLIANCE_OPERATIONS_MANUAL.md`  

---

*Internal operator guide — not legal advice.*
