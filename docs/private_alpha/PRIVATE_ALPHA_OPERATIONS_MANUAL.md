# Private Alpha Operations Manual

**Program:** TLP-007 — Private Alpha Execution  
**Effective:** 2026-06-30  
**Classification at launch:** EXTEND PRIVATE ALPHA (evaluation in progress)

---

## Purpose

This manual defines how Tropicash operates during **Private Alpha**: a controlled, invite-only period with real operational procedures, production-quality governance, and monitored financial workflows — while remaining on **PayPal Sandbox** until explicitly authorized for Live.

Private Alpha is **platform operations**, not feature development. The feature freeze remains in effect except for defects, stability, operations, documentation, monitoring, and reliability fixes.

---

## Scope

| Parameter | Value |
|-----------|--------|
| Cohort size | 10–25 trusted users |
| Registration | Invite-only; no public signup |
| Marketing | None |
| Scaling | No production scaling |
| Supervision | Close operator oversight |
| Payments | PayPal Sandbox only |

---

## Roles

| Role | Responsibilities |
|------|------------------|
| **Operator on duty** | Daily checklist, queue review, incident triage |
| **Treasury** | Manual oversight of funding/withdrawal flows, reconciliation sign-off |
| **Compliance** | KYC/AML queue, screening, account restrictions |
| **Engineering** | Defect fixes, monitoring, incident resolution support |
| **Executive sponsor** | Exit review, Public Beta authorization |

---

## Daily operating rhythm

### Start of day (before user activity)

1. Open **Admin → Private Alpha** dashboard (`/admin/private-alpha`).
2. Run daily certification script (optional CI/local):

   ```bash
   node scripts/tlp007-private-alpha-daily.mjs
   ```

3. Complete every item in [PRIVATE_ALPHA_DAILY_CHECKLIST.md](./PRIVATE_ALPHA_DAILY_CHECKLIST.md).
4. Review KYC, AML, and withdrawal queues.
5. Confirm no unresolved **Critical** incidents in `data/private_alpha/incident_log.json`.
6. Generate and archive the daily operations report (dashboard + JSON artifacts).

### During the day

- Monitor funding, transfers, withdrawals, and notifications.
- Log every user-reported issue and every platform error.
- Classify incidents per [PRIVATE_ALPHA_INCIDENT_PLAYBOOK.md](./PRIVATE_ALPHA_INCIDENT_PLAYBOOK.md).

### End of day

- Run reconciliation evidence capture (dashboard + script output).
- Update incident log and operational metrics.
- Brief next operator on open items.

---

## Financial controls

- **PayPal:** Sandbox mode only. Do not set `PAYPAL_MODE=live` or enable Live credentials during Private Alpha unless explicitly authorized in writing.
- **Treasury:** Manual approval remains required for withdrawal payouts per existing admin workflows.
- **Ledger:** Authoritative balances are `wallets.wallet_balance` and `public.transactions` (see `docs/certification/LEDGER_ARCHITECTURE_DECISION.md`).
- **Reconciliation:** Use `/admin/withdrawal-reconciliation` and Private Alpha dashboard daily.

---

## User testing tracking

Track for each alpha user:

- Registration and invite acceptance
- KYC completion
- Wallet funding (PayPal sandbox)
- Transfers
- Withdrawals
- Notifications
- Error handling
- Support requests
- Satisfaction (informal feedback)
- Feature requests (log only — no implementation during freeze)

---

## Dashboards and artifacts

| Resource | Location |
|----------|----------|
| Executive dashboard | `/admin/private-alpha` |
| Component | `dashboard/private_alpha_dashboard.jsx` |
| Daily health | `data/private_alpha/daily_health.json` |
| Metrics | `data/private_alpha/operational_metrics.json` |
| Incidents | `data/private_alpha/incident_log.json` |
| Reconciliation history | `data/private_alpha/reconciliation_history.json` |

---

## Related documentation

- [Daily Checklist](./PRIVATE_ALPHA_DAILY_CHECKLIST.md)
- [Exit Criteria](./PRIVATE_ALPHA_EXIT_CRITERIA.md)
- [Incident Playbook](./PRIVATE_ALPHA_INCIDENT_PLAYBOOK.md)
- [Production Operations](../operations/PRODUCTION_OPERATIONS_CERTIFICATION.md)
- [Compliance Governance](../compliance/COMPLIANCE_GOVERNANCE_READINESS.md)

---

## Communication

- No public marketing or announcements.
- Alpha users receive direct invite and support channel only.
- Escalate **Critical** incidents to engineering and executive sponsor immediately.

---

## Program status

At TLP-007 launch, infrastructure and procedures are **certified for execution**. Sustained evaluation data must accumulate before Public Beta. See exit criteria for graduation requirements.
