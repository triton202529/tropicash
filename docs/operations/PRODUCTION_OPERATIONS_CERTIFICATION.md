# Production Operations Certification (TLP-006)

**Phase:** TLP-006 — Production Operations & Staging Certification  
**PayPal mode:** Sandbox only (Live not enabled)  
**Generated:** 2026-06-30

---

## Executive summary

TLP-006 validates operational readiness for **Private Alpha** — real users on invite-only cohort with **PayPal Sandbox** funding and server-authoritative money flows.

| Metric | Result |
|--------|--------|
| Static operations score | See `data/operations/production_operations_results.json` |
| Financial certification | FTC-001 PRIVATE ALPHA (TLP-004) |
| Compliance readiness | TLP-005 PRODUCTION OPERATIONS |
| Live staging E2E | **Manual execution required** |
| Classification | **READY FOR PRIVATE ALPHA** (static + docs; pending live E2E) |

---

## Certification scope

### In scope
- Environment variable documentation and guards
- PayPal sandbox configuration and production guards
- Deployment, rollback, and disaster recovery documentation
- Internal monitoring via `operational_logs` and admin probes
- Operator workflow documentation
- Defect remediation (KYC-before-capture, mode parity audit, `.env.example`)

### Out of scope (by design)
- PayPal Live enablement
- External APM (Sentry/Datadog) — documented gap
- New customer-facing features
- Financial engine changes

---

## Key fixes (TLP-006)

| Defect | Resolution |
|--------|------------|
| KYC after PayPal capture | KYC enforced **before** `capturePayPalOrder` |
| Missing `.env.example` | Root template tracked; `!.env.example` in `.gitignore` |
| Live mode missing webhook ID check | Added to `validatePayPalEnvironment()` |
| Admin audit missing mode parity | `probePayPalModeParity()` in production audit |
| Sandbox-only funding cap message | Mode-aware error message |

---

## Pass criteria

| Criterion | Static | Live |
|-----------|--------|------|
| Deployment documented | ✓ | Manual verify |
| Rollback documented | ✓ | Drill optional |
| Monitoring documented | ✓ | Admin pages |
| Backup/DR documented | ✓ | Supabase backup manual |
| PayPal sandbox guards | ✓ | Token fetch manual |
| Financial cert valid | ✓ | FTC-001 recert |
| Staging E2E | — | **Pending** |

---

## Classification rationale

**READY FOR PRIVATE ALPHA** when:
- Static certification passes (0 critical failures)
- FTC-001 PRIVATE ALPHA remains valid
- Operations documentation complete
- PayPal remains sandbox

**NOT READY FOR LIVE CUTOVER** because:
- PayPal Live disabled
- Live staging E2E not automated
- External monitoring not integrated
- Counsel GA sign-off pending

---

## Evidence artifacts

- `data/operations/production_operations_results.json`
- `data/operations/staging_validation_results.json`
- `data/operations/monitoring_validation.json`
- `data/operations/deployment_validation.json`
- `scripts/tlp006-production-operations.mjs`

Run: `node scripts/tlp006-production-operations.mjs`

---

## Recommendation

1. Apply all SQL migrations through TLP-005 in staging Supabase  
2. Configure sandbox env vars from `.env.example`  
3. Execute `STAGING_EXECUTION_REPORT.md` manual checklist  
4. Invite Private Alpha cohort after live E2E sign-off  

Proceed to ongoing production operations; defer live cutover to a future TLP phase.
