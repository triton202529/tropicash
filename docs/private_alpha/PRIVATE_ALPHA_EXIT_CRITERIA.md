# Private Alpha Exit Criteria

**Program:** TLP-007  
**Purpose:** Define when Private Alpha may conclude and how to classify readiness.

Private Alpha concludes **only** when **all** criteria below are satisfied with evidence. Do not overstate readiness.

---

## Required criteria

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | **Stable operation** over a sustained evaluation period (minimum **14 operating days**) | `daily_health.json` history; no recurring Critical incidents |
| 2 | **No unresolved Critical defects** | `incident_log.json` — zero open `critical` |
| 3 | **No unresolved High-severity financial defects** | `incident_log.json` — zero open `high` + `category: financial` |
| 4 | **Successful reconciliation** throughout evaluation | `reconciliation_history.json` — no critical reconciliation failures |
| 5 | **Compliance workflows validated** | KYC/AML queues processed; screening workflow exercised |
| 6 | **Treasury procedures validated** | Manual withdrawal approval; sandbox funding E2E |
| 7 | **Operational procedures validated** | Daily checklist completed ≥7 days with sign-off |
| 8 | **Positive user feedback** | Documented alpha user feedback (no systematic blockers) |
| 9 | **Executive launch review completed** | Written sign-off for next phase |

---

## Payment mode gate

- Private Alpha runs on **PayPal Sandbox**.
- Moving to Public Beta may require Live PayPal — that is a **separate authorization** after staging checklist completion (`docs/operations/STAGING_EXECUTION_REPORT.md`).

---

## Final assessment (exactly one)

At completion, classify Tropicash as **exactly one** of:

### EXTEND PRIVATE ALPHA

- Criteria not yet met
- Insufficient evaluation period
- Minor issues under remediation
- User feedback mixed but not blocking

### READY FOR PUBLIC BETA

- All criteria met with evidence
- No open Critical or High financial incidents
- Executive review completed
- Staging/Live payment authorization tracked separately

### NOT READY

- Open Critical incidents
- Open High-severity financial defects
- Reconciliation failures unresolved
- Compliance or treasury procedures not validated

---

## Evaluation helper

Run:

```bash
node scripts/tlp007-private-alpha-daily.mjs --evaluate
```

This reads `data/private_alpha/*.json` and outputs a recommended classification. **Operator and executive judgment override automation.**

---

## At TLP-007 launch (baseline)

| Item | Status |
|------|--------|
| Program infrastructure | Ready |
| Sustained evaluation period | Not started |
| Default classification | **EXTEND PRIVATE ALPHA** |

Evidence: TLP-006 classified **READY FOR PRIVATE ALPHA**; TLP-007 launches operational framework.
