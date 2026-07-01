# Private Alpha Incident Playbook

**Program:** TLP-007  
**Log file:** `data/private_alpha/incident_log.json`

Every incident during Private Alpha must be recorded with full traceability.

---

## Severity definitions

| Severity | Definition | Response time |
|----------|------------|---------------|
| **CRITICAL** | Money loss risk, data breach, total outage, compliance breach | Immediate; page engineering + executive |
| **HIGH** | Financial workflow broken, widespread user impact, reconciliation failure | Same day |
| **MEDIUM** | Degraded UX, single-user financial issue with workaround | 24–48 hours |
| **LOW** | Cosmetic, docs, non-blocking annoyance | Next sprint / backlog |

Add `category: "financial"` for any incident affecting balances, ledger, funding, transfers, or withdrawals.

---

## Required fields

Each incident **must** include:

| Field | Description |
|-------|-------------|
| `id` | Unique ID (e.g. `INC-20260630-001`) |
| `severity` | `critical` \| `high` \| `medium` \| `low` |
| `title` | Short summary |
| `timestamp` | ISO 8601 UTC |
| `operator` | Person who logged or owns triage |
| `root_cause` | After investigation |
| `resolution` | What was done |
| `preventive_action` | How to prevent recurrence |
| `status` | `open` \| `investigating` \| `resolved` \| `closed` |

Optional: `category`, `affected_users`, `financial_impact_usd`, `links` (PR, admin URLs).

---

## Workflow

```
Detect → Log → Classify → Assign → Investigate → Resolve → Preventive action → Close
```

1. **Detect** — Monitoring, user report, reconciliation, or daily checklist.
2. **Log** — Append to `incident_log.json` immediately (do not wait for root cause).
3. **Classify** — Severity and category.
4. **Assign** — Operator + engineering if needed.
5. **Investigate** — Preserve audit logs; no destructive DB changes without approval.
6. **Resolve** — Fix or workaround; document in incident record.
7. **Preventive action** — Ticket, doc update, or monitoring improvement.
8. **Close** — Only when verified in production/sandbox.

---

## Critical incident checklist

- [ ] Incident logged with timestamp and operator
- [ ] Engineering notified
- [ ] Executive sponsor notified (Critical only)
- [ ] User communication plan (if affected)
- [ ] Treasury/compliance looped in (if financial)
- [ ] PayPal mode verified (must remain sandbox unless authorized)
- [ ] Post-incident review within 48 hours
- [ ] Preventive action tracked

---

## Examples

### CRITICAL — Duplicate wallet credit

- **Category:** financial  
- **Action:** Freeze affected accounts; run reconciliation; invoke rollback procedure if needed  
- **Blocker for exit:** Yes — must be resolved before Public Beta

### HIGH — Withdrawal stuck in processing

- **Category:** financial  
- **Action:** Admin withdrawal tools + reconciliation report  
- **Blocker for exit:** Yes if unresolved

### MEDIUM — Notification email delayed

- **Action:** Check provider logs; retry  
- **Blocker for exit:** No

---

## Permanent log

`incident_log.json` is append-only in practice — never delete entries; mark `status: closed` instead.

For compliance incidents also recorded in `compliance_incidents` table, cross-reference IDs in the incident log `links` field.
