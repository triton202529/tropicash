# Private Alpha Daily Checklist

**Program:** TLP-007  
**Use:** Beginning of every operating day  
**Operator:** __________________ **Date:** __________

Mark each item after verification. Automated probes run via `/admin/private-alpha` and `scripts/tlp007-private-alpha-daily.mjs`.

---

## System health

| ✓ | Item | How to verify |
|---|------|----------------|
| ☐ | Environment healthy | PayPal sandbox config valid; no Live mode |
| ☐ | API health | Admin operational snapshot loads |
| ☐ | Database health | Core tables reachable (wallets, transactions) |
| ☐ | Monitoring operational | Operational logs + admin dashboards accessible |

---

## Financial integrity

| ✓ | Item | How to verify |
|---|------|----------------|
| ☐ | Wallet balances reconcile | Spot-check wallet sum vs ledger movements |
| ☐ | Ledger reconciles | No critical issues on withdrawal reconciliation |
| ☐ | Idempotency clean | No stuck `processing` idempotency keys |
| ☐ | Failed operations reviewed | Review funding failures (24h) and fraud logs |

---

## Compliance and queues

| ✓ | Item | How to verify |
|---|------|----------------|
| ☐ | Audit logs functioning | Sample admin audit entries |
| ☐ | KYC queue reviewed | `/admin/kyc` — pending items actioned |
| ☐ | AML queue reviewed | `/admin/compliance-governance` |
| ☐ | Withdrawal queue reviewed | `/admin/withdrawals` |

---

## Incidents

| ✓ | Item | How to verify |
|---|------|----------------|
| ☐ | No unresolved Critical incidents | `data/private_alpha/incident_log.json` |
| ☐ | Open High incidents have owner | Incident playbook |

---

## Daily outputs

After completing the checklist:

1. ☐ Daily operations report generated (JSON + dashboard screenshot optional)
2. ☐ Reconciliation evidence appended to `reconciliation_history.json`
3. ☐ Metrics updated in `operational_metrics.json`
4. ☐ Operator sign-off recorded below

---

## Operator sign-off

| Field | Value |
|-------|--------|
| Operator name | |
| Certification pass (Y/N) | |
| Notes / blockers | |
| Next operator handoff | |

---

## Quick links

- [Private Alpha Dashboard](/admin/private-alpha)
- [Withdrawal Reconciliation](/admin/withdrawal-reconciliation)
- [Compliance Governance](/admin/compliance-governance)
- [Production Operations](/admin/production-operations)
- [Health](/admin/health)
