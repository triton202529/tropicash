# Tropicash Incident Response Playbook

**Version:** 1.0.0  
**Effective date:** 2026-06-30  
**Program:** Private Alpha

---

## 1. Purpose

This playbook defines how Tropicash classifies, investigates, resolves, and reviews operational and compliance incidents during Private Alpha.

---

## 2. Incident types

| Type | Examples |
|------|----------|
| **Security** | Unauthorized access, credential leak, session abuse |
| **Financial** | Balance discrepancy, duplicate transaction report, payout failure |
| **Compliance** | Sanctions hit, SAR escalation, KYC breach |
| **Operational** | API outage, provider failure, data pipeline error |
| **Fraud** | Confirmed fraud ring, account takeover cluster |

---

## 3. Severity levels

| Severity | Criteria | Initial response |
|----------|----------|------------------|
| **Low** | No user impact; internal tooling | Next business day |
| **Medium** | Limited user impact; workaround exists | Within 4 hours |
| **High** | Money movement or data at risk | Within 1 hour |
| **Critical** | Active financial loss, breach, or regulatory exposure | Immediate; exec notification |

---

## 4. Status workflow

`open` → `investigating` → `mitigated` → `resolved` → `closed`

- **Open:** Incident recorded, owner assigned  
- **Investigating:** Active analysis; investigation notes added  
- **Mitigated:** Immediate harm contained (e.g., account frozen)  
- **Resolved:** Root cause addressed; users notified if required  
- **Closed:** Post-incident review complete  

Stored in `compliance_incidents` with notes in `compliance_incident_notes`.

---

## 5. Response procedures

### 5.1 Detection

- Monitoring alerts, user reports, admin observation, automated fraud signals

### 5.2 Triage

1. Assign severity and classification  
2. Designate incident lead (compliance or ops admin)  
3. Create incident record in Compliance dashboard  

### 5.3 Containment

- **Financial:** freeze account via Compliance → Account controls (audited)  
- **Security:** revoke sessions, rotate credentials, block IPs  
- **Compliance:** halt payouts; preserve evidence  

### 5.4 Investigation

Document in incident notes:

- Timeline (UTC)  
- Affected users and transaction IDs  
- Systems involved  
- Hypothesis and evidence  

### 5.5 Resolution

- Record `resolution_summary`  
- Restore services when safe  
- Notify affected users per Privacy Policy  

### 5.6 Post-incident review

Complete `post_incident_review` within **5 business days** for High/Critical incidents:

- Root cause  
- What worked / what failed  
- Corrective actions and owners  

---

## 6. Escalation matrix

| Condition | Escalate to |
|-----------|-------------|
| Frozen accounts > 10 related to one incident | Compliance lead |
| Any confirmed balance corruption | Engineering + Treasury |
| Sanctions confirmed match | Compliance + Legal counsel |
| Data breach suspicion | Security lead + Legal |

---

## 7. Communication

- **Internal:** Admin audit logs, incident notes  
- **External:** Support templates; no public disclosure without approval  
- **Regulatory:** Compliance lead determines filing obligations  

---

## 8. Tools

- `/admin/compliance-governance` — incident list and stats  
- `/admin/security` — account freeze QA  
- `lib/complianceIncidents.js` — programmatic incident CRUD  
- `/api/admin/compliance/action` — authorized operator actions  

---

## 9. Testing

Conduct tabletop exercise before expanding beyond Private Alpha cohort.

---

*Operational playbook — adapt to counsel and regulatory guidance.*
