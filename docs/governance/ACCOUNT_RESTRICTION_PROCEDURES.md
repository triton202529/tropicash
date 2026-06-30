# Account Restriction Procedures

**Version:** 1.0.0  
**Effective date:** 2026-06-30  
**Owner:** Compliance / Security Operations

---

## 1. Purpose

Define standardized procedures for restricting, freezing, and restoring Tropicash user accounts during Private Alpha. All actions require administrator authorization, documented reason, and audit trail.

---

## 2. Account status model

Enforced via `account_security_status` at API layer:

| Status | Financial impact |
|--------|------------------|
| `normal` | Full access per KYC/policy |
| `watch` | Monitoring; no blocks |
| `restricted` | Blocks send, withdraw, payout methods |
| `frozen` | Blocks all financial actions |

---

## 3. Authorized actions

| Compliance action | Maps to status |
|-------------------|----------------|
| `watch` | watch |
| `restrict` | restricted |
| `suspend_transactions` | restricted |
| `freeze` | frozen |
| `unfreeze` | normal |
| `restore_access` | normal |

Performed via `/admin/compliance-governance` or `/api/admin/compliance/action` with `action: account_action`.

---

## 4. Required fields

Every action **must** include:

- **Target user ID** (UUID)  
- **Action type**  
- **Reason** (plain language, max 500 chars)  
- **Operator identity** (from authenticated admin session)  
- **Timestamp** (automatic)  

Optional: link to AML case ID, internal notes, risk level.

---

## 5. Procedure: restrict account

1. Confirm investigation case or screening hit  
2. Document reason in AML case note  
3. Execute **restrict** with reason  
4. Verify user cannot send/withdraw (API returns 403)  
5. Notify user via standard security notification when configured  

---

## 6. Procedure: freeze account

Use for:

- Confirmed fraud or takeover  
- Sanctions/PEP match pending senior review  
- Critical incident containment  

Steps:

1. Create or update compliance incident (severity High/Critical)  
2. Execute **freeze** with detailed reason  
3. Escalate to compliance lead within 1 hour  
4. Do not unfreeze without dual review (operator + lead)  

---

## 7. Procedure: unfreeze / restore

1. Confirm root cause resolved  
2. Document resolution in AML case or incident  
3. Execute **unfreeze** or **restore_access** with reason  
4. Verify financial actions restored  
5. Monitor for 72 hours  

---

## 8. Audit trail

Each action writes to:

- `compliance_account_actions` (append-only)  
- `admin_audit_logs` via `logAdminAuditEvent`  
- `security_events` via account security status update  

Auditors can reconstruct: who, what, when, why, previous/new status.

---

## 9. Prohibited actions

- Restrict/freeze without reason  
- Non-admin operators using service role keys  
- Client-side RPC bypass (revoked in TLP-002)  

---

## 10. Related documents

- `docs/compliance/OPERATOR_COMPLIANCE_GUIDE.md`  
- `docs/compliance/AML_POLICY.md`  
- `docs/governance/COMPLIANCE_OPERATIONS_MANUAL.md`  

---

*Internal governance procedure.*
