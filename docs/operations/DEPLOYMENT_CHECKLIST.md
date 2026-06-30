# Deployment Checklist

**Version:** 1.0.0 · **TLP-006**

---

## Pre-deploy

- [ ] All SQL migrations applied in order (TLP-002 → TLP-005 minimum)
- [ ] `admin_members` bootstrapped with ops/compliance admins
- [ ] Environment vars set per `.env.example` (host dashboard — no secrets in git)
- [ ] `PAYPAL_MODE` = `NEXT_PUBLIC_PAYPAL_MODE` = `sandbox`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` server-only (never `NEXT_PUBLIC_*`)
- [ ] `TROPICASH_REQUIRE_APPROVED_KYC=true`
- [ ] Review open launch blockers in `/admin/launch-readiness`

## Build & deploy

- [ ] `npm ci`
- [ ] `npm run build` succeeds
- [ ] Deploy to staging host first
- [ ] Smoke test: app loads, login works

## Post-deploy verification

- [ ] `/admin/health` — tables reachable
- [ ] `/admin/production-audit` — no MISSING critical items
- [ ] `/admin/compliance-checklist` — review partial items
- [ ] `/admin/compliance-governance` — dashboard loads
- [ ] Legal pages `/legal/*` respond
- [ ] PayPal sandbox fund test ($1) — see staging report
- [ ] `node scripts/tlp006-production-operations.mjs` — static pass

## Release checklist

- [ ] FTC-001 recertification still PRIVATE ALPHA
- [ ] TLP-005 compliance readiness ≥85%
- [ ] No uncommitted secrets in repo
- [ ] Rollback procedure reviewed with operator on call
- [ ] Incident playbook accessible to ops team

## Hotfix procedure (summary)

1. Branch from `main` with fix  
2. Run `npm run build` locally  
3. Deploy to staging; verify affected path  
4. Deploy to production; re-run post-deploy checks  
5. Log incident if financial path touched  

See `ROLLBACK_PROCEDURE.md` if deploy fails.

## Production verification checklist

- [ ] Auth: sign-in / sign-out
- [ ] KYC: submit + admin approve flow
- [ ] Funding: create-order → capture (sandbox)
- [ ] Transfer: send with idempotency key
- [ ] Withdrawal: create → admin approve
- [ ] Account freeze: compliance action blocks send
- [ ] Audit: admin action appears in logs

---

*Complete before each Private Alpha deploy.*
