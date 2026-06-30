# Monitoring Guide

**Version:** 1.0.0 · **TLP-006**

---

## Overview

Tropicash Private Alpha uses **internal monitoring** via database tables and admin dashboards. External APM is **not yet integrated** (documented gap).

---

## Monitoring surfaces

| Surface | Path / table | Purpose |
|---------|--------------|---------|
| Operational logs | `operational_logs` → `/admin/logs` | API failures, env errors, webhook issues |
| Admin audit | `admin_audit_logs` | Compliance and admin actions |
| Security events | `security_events` | Account restrictions |
| Fraud logs | `fraud_logs` → `/admin/fraud` | Suspicious activity |
| Treasury events | `treasury_operational_events` | Treasury ops |
| Compliance dashboard | `/admin/compliance-governance` | AML/KYC/incident counts |
| Production audit | `/admin/production-audit` | Env and schema probes |
| Launch readiness | `/admin/launch-readiness` | Aggregated score |

---

## What to monitor

### API failures
- **Categories:** `paypal.capture`, `wallet.fund_wallet_rpc`, `transfer.send_rpc`, `withdrawal.create_request`
- **Action:** Investigate spike; check Supabase and PayPal status

### Payment failures
- **Categories:** `funding.idempotency`, `paypal.capture`, funding fraud logs
- **Action:** Check idempotency stuck in `processing`; manual reconcile

### Authentication failures
- **Categories:** `auth.*`, 401 rate on APIs
- **Action:** Brute force vs config issue

### KYC failures
- **Categories:** `kyc.*`, blocked funding/withdraw
- **Action:** Clear KYC queue; verify `TROPICASH_REQUIRE_APPROVED_KYC`

### AML events
- **Tables:** `compliance_aml_cases`, `compliance_screening_results`
- **Dashboard:** Compliance governance pending counts

### Withdrawal processing
- **Tables:** `withdrawal_requests`, payout webhook events
- **Tool:** `/admin/withdrawals`, reconciliation lib

### Database health
- **Probe:** `/admin/health` table reachability
- **Supabase:** Dashboard metrics (connections, CPU)

### Application health
- **Build:** CI/host deploy status
- **Probe:** Homepage + `/api/withdrawals/check-limit` (401 expected)

### Audit failures
- **Symptom:** Missing rows in `admin_audit_logs` after admin action
- **Action:** Check table exists; RLS policies

---

## Alerting (Private Alpha)

Manual operator review:

1. Daily: Compliance dashboard + operational logs (last 24h errors)
2. Weekly: Launch readiness score trend
3. On deploy: Production audit full run

**Future (post-Alpha):** Sentry, uptime ping, PagerDuty integration

---

## Log retention

- `operational_logs`: per Supabase retention policy
- Export critical incidents to compliance incident records

---

## Secret rotation

Document rotation without committing secrets:

| Secret | Rotation trigger |
|--------|------------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Compromise, quarterly policy |
| `PAYPAL_CLIENT_SECRET` | PayPal dashboard rotation |
| JWT signing keys | Supabase auth settings |

After rotation: redeploy app with new env; verify funding test.

---

## Runbook links

- Incidents: `docs/compliance/INCIDENT_RESPONSE_PLAYBOOK.md`
- Operators: `docs/compliance/OPERATOR_COMPLIANCE_GUIDE.md`
- Deployment: `DEPLOYMENT_CHECKLIST.md`

---

*Internal monitoring only for TLP-006 — external APM recommended before live cutover.*
