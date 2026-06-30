# Tropicash Anti-Money Laundering (AML) Policy

**Version:** 1.0.0  
**Effective date:** 2026-06-30  
**Program:** Private Alpha  
**Owner:** Compliance / Operations

---

## 1. Purpose

This policy establishes Tropicash’s Anti-Money Laundering (“AML”) framework for the Private Alpha program. It defines how we monitor wallet activity, investigate suspicious behavior, escalate cases, and prepare for regulatory reporting obligations.

---

## 2. Scope

Applies to all Tropicash wallet services during Private Alpha:

- Wallet funding (third-party payment providers)
- Peer-to-peer transfers
- Withdrawal requests and payouts
- Account restrictions and freezes

---

## 3. Risk-based approach

Tropicash applies a risk-based AML program proportionate to Private Alpha scale:

| Risk tier | Indicators | Response |
|-----------|------------|----------|
| Low | Normal usage, approved KYC | Standard monitoring |
| Medium | Velocity spikes, new device, limit proximity | Enhanced monitoring; optional review case |
| High | Structuring patterns, fraud signals, screening hits | AML case; restrict or freeze pending review |
| Critical | Confirmed sanctions match, fraud ring | Immediate freeze; escalation |

---

## 4. Customer due diligence (CDD)

- **Identity verification (KYC)** is required before material money movement when `TROPICASH_REQUIRE_APPROVED_KYC=true`.
- **Sanctions and PEP screening** is queued on KYC submission and reviewed by compliance operators.
- **Ongoing monitoring** uses transaction records, fraud logs, and risk review cases.

---

## 5. Transaction monitoring

Automated and manual monitoring includes:

- Rule-based fraud scoring (`lib/fraudEngine.js`, `lib/fraudRules.js`)
- Risk review case queue with recommended actions (no automatic enforcement)
- AML investigation cases (`compliance_aml_cases`) for suspicious activity
- Transaction monitoring cases created from risk scoring hooks

Operators review alerts; no alert auto-moves money.

---

## 6. Suspicious Activity Reports (SAR)

Private Alpha supports **SAR case workflow** without automated e-filing:

1. **Open** — case created from monitoring or operator referral  
2. **Under review** — compliance analyst investigation  
3. **Escalated** — senior review required  
4. **SAR draft** — narrative prepared  
5. **SAR filed** — manual filing reference recorded  
6. **Closed / dismissed** — no filing required  

Filing references are stored in `sar_filing_reference`. Actual regulatory submission is performed manually by authorized personnel when legally required.

---

## 7. Sanctions & PEP screening

- Provider-agnostic integration via `lib/complianceScreening.js`
- Default provider: **manual review queue** (no vendor lock-in)
- Configurable: `TROPICASH_SANCTIONS_PROVIDER` / `TROPICASH_COMPLIANCE_SCREENING_PROVIDER`
- Outcomes: `pending_review`, `approved`, `rejected`, `manual_override` (admin only)

Confirmed matches may trigger account freeze via audited compliance account actions.

---

## 8. Recordkeeping

Tropicash retains:

- Transaction ledger (`public.transactions`)
- KYC profiles and review history
- Fraud logs and case notes
- AML cases, screening results, and account control audit trail
- Admin audit logs (`admin_audit_logs`)

Retention period: minimum **5 years** from account closure or as required by applicable law.

---

## 9. Training & governance

Operators follow `OPERATOR_COMPLIANCE_GUIDE.md` and `COMPLIANCE_OPERATIONS_MANUAL.md`. Incident response follows `INCIDENT_RESPONSE_PLAYBOOK.md`.

---

## 10. Policy review

Reviewed at least **annually** or upon material product, regulatory, or geographic change. Version history maintained in repository documentation.

---

## 11. Limitations (Private Alpha)

- No external AML vendor integrated in v1.0 (manual screening queue)
- SAR e-filing not automated
- Counsel review recommended before general availability

---

*This document is operational policy, not legal advice.*
