# Tropicash Launch Master Plan

**Program:** TLP (Tropicash Launch Program)  
**Current Phase:** TLP-003 — Compliance & Live Cutover (next)  
**Last Completed:** TLP-002 — Foundation Hardening ✓  
**Generated:** 2026-06-28 (updated post TLP-002)  
**Current Launch Stage:** Internal Alpha → Private Alpha preparation  
**Overall Readiness:** ~62% (estimated post TLP-002)

---

## TLP-002 Completion Summary (Foundation Hardening)

**Status:** Complete — commit `TLP-002: harden financial foundation and production readiness`

| Blocker | Resolution |
|---------|------------|
| BLK-001 | `fund_wallet` RPC added in `phase_tlp002_foundation_hardening.sql` |
| BLK-002 | Canonical `wallet_balance`; all RPCs unified; legacy `balance` synced |
| BLK-003 | Server KYC via `lib/serverKycGuard.js` on all money APIs |
| BLK-005 | `fraud_logs` RLS hardened to admin-only select/update |
| BLK-006 | `admin_members` table + `tc_is_admin()`; no hardcoded app emails |
| BLK-008 | `POST /api/transfers/send`; client `transfer_funds` revoked |
| BLK-009 | `lib/paypalProductionGuard.js`; mode mismatch blocked in production |
| BLK-010 | `.env.example` + `docs/deployment/PRODUCTION_DEPLOYMENT.md` |

**Certification:** `docs/audit/MONEY_INTEGRITY_CERTIFICATION.md`

**Deploy prerequisite:** Apply `supabase/sql/phase_tlp002_foundation_hardening.sql` to Supabase.

---

## 1. Executive Summary

Tropicash is a Next.js 15 + Supabase fintech platform with PayPal integration, targeting wallet-based money movement for Caribbean and diaspora users. The codebase demonstrates mature engineering in admin operations, compliance tooling, and sandbox developer infrastructure. However, **the platform is not production-ready** for regulated live-money deployment.

The audit identifies **8 critical blockers**, **8 major blockers**, **6 minor blockers**, and **4 informational gaps** across 31 production modules. Core wallet flows (fund → send → withdraw) exist but contain schema inconsistencies, enforcement gaps, and missing version-controlled migrations that must be resolved before Private Alpha.

### Launch Stage Assessment: Internal Alpha

| Stage | Fit |
|-------|-----|
| Internal Prototype | Exceeded — substantial functionality beyond POC |
| **Internal Alpha** | **Current — working flows with manual ops, soft launch posture** |
| Private Alpha | Blocked — P0 issues prevent invite-only real-money testing |
| Closed Beta | Not reachable until Private Alpha exit criteria met |
| Public Beta Ready | 6+ months estimated |
| Production Ready | Not achievable with current compliance posture |

---

## 2. Launch Readiness Scorecard

```
Authentication            ███████████████░░░░░  75%
Authorization             █████████░░░░░░░░░░░  45%
User Onboarding           ████████████░░░░░░░░  62%
Wallet                    █████████████░░░░░░░  65%
Ledger                    █████░░░░░░░░░░░░░░░  25%
Transactions              ██████████████░░░░░░  72%
Funding                   ██████████░░░░░░░░░░  50%
Withdrawals               ████████████████░░░░  78%
Merchant Platform         ██░░░░░░░░░░░░░░░░░░  10%
QR Payments               ░░░░░░░░░░░░░░░░░░░░   0%
Payment Links             ░░░░░░░░░░░░░░░░░░░░   0%
Notifications             ███████████░░░░░░░░░  58%
Security                  ██████████████░░░░░░  68%
Fraud Controls            ███████████░░░░░░░░░  55%
KYC                       ███████████░░░░░░░░░  58%
AML Controls              ████░░░░░░░░░░░░░░░░  22%
Treasury                  ████████████░░░░░░░░  62%
Admin Console             ████████████████░░░░  82%
Reporting                 ███████████████░░░░░  75%
Developer APIs            ██████████░░░░░░░░░░  48%
OAuth                     ███████████░░░░░░░░░  55%
SDK Readiness             ██████░░░░░░░░░░░░░░  32%
Webhooks                  ████████░░░░░░░░░░░░  38%
Mobile Responsiveness     ██████████████░░░░░░  70%
PWA                       ██████████████░░░░░░  68%
Environment Config        ██████████░░░░░░░░░░  48%
Secrets Management        ██████████████░░░░░░  70%
Error Handling            ███████████░░░░░░░░░  58%
Logging                   ████████████░░░░░░░░  60%
Monitoring                ██████████░░░░░░░░░░  50%
Production Config         █████████░░░░░░░░░░░  45%
----------------------------------------
Overall Readiness         ███████████░░░░░░░░░  54%
```

---

## 3. Module Classification Summary

| Classification | Count | Modules |
|----------------|-------|---------|
| PRODUCTION_READY | 0 | — |
| READY_WITH_MINOR_WORK | 11 | Authentication, Transactions, Withdrawals, Security, Admin Console, Reporting, Mobile, PWA, Secrets Management |
| PARTIALLY_IMPLEMENTED | 15 | Authorization, Onboarding, Wallet, Funding, Notifications, Fraud, KYC, Treasury, Developer APIs, OAuth, Webhooks, Env Config, Error Handling, Logging, Monitoring, Production Config |
| PROTOTYPE | 4 | Ledger, AML Controls, SDK, Legacy API |
| SIMULATION_ONLY | 1 | Merchant Platform |
| NOT_STARTED | 2 | QR Payments, Payment Links |

---

## 4. Launch Phases (Post-Audit Roadmap)

### Phase TLP-002: Foundation Fixes (Weeks 1–2) — ✓ COMPLETE
**Goal:** Resolve data integrity and security P0 blockers

| Priority | Blocker | Effort |
|----------|---------|--------|
| P0 | BLK-001: Add fund_wallet SQL migration | 2–3 days |
| P0 | BLK-002: Unify balance/wallet_balance columns | 3–5 days |
| P0 | BLK-005: Harden fraud_logs RLS | 1–2 days |
| P1 | BLK-010: Add .env.example | 1 day |
| P1 | BLK-016: Remove/isolate legacy Python API | 1–2 days |

**Exit criteria:** Funding end-to-end works in staging; zero balance column discrepancies in test accounts.

### Phase TLP-003: Enforcement Hardening (Weeks 2–4)
**Goal:** Server-side gates for all money movement

| Priority | Blocker | Effort |
|----------|---------|--------|
| P0 | BLK-008: Send money server gate | 3–4 days |
| P0 | BLK-003: KYC hard_block enforcement | 5–7 days |
| P0 | BLK-006: Admin RBAC from env/DB | 3–5 days |
| P1 | BLK-012: Fail-closed account security | 1–2 days |
| P2 | BLK-017: Transaction type standardization | 0.5 day |

**Exit criteria:** No client-bypassable money movement; admin roles configurable without code deploy.

### Phase TLP-004: Compliance & Live Cutover (Weeks 4–6)
**Goal:** Legal and payment infrastructure for real money

| Priority | Blocker | Effort |
|----------|---------|--------|
| P0 | BLK-007: Legal document review | 1–2 weeks |
| P0 | BLK-004: AML sanctions vendor (start) | 2–4 weeks |
| P1 | BLK-009: PayPal live cutover | 2–3 days |
| P1 | BLK-014: Sentry + monitoring baseline | 3–5 days |
| P2 | BLK-019: Security headers | 1 day |

**Exit criteria:** Legal pages published; PayPal live webhooks verified; monitoring alerts configured.

### Phase TLP-005: Private Alpha (Weeks 6–10)
**Goal:** Invite-only cohort with real money

**Prerequisites:**
- All TLP-002 through TLP-004 exit criteria met
- KYC hard_block enabled
- Manual treasury ops playbook documented
- 10–50 invite-only testers
- Withdrawal reconciliation zero critical issues

**Scope:** Wallet fund/send/withdraw only. No merchant, QR, or payment links.

### Phase TLP-006: Developer Platform (Weeks 10–16)
**Goal:** External sandbox with webhook delivery

| Blocker | Effort |
|---------|--------|
| BLK-015: Webhook delivery pipeline | 1–2 weeks |
| BLK-020: SDK npm publish | 3–5 days |
| BLK-011: 2FA for OAuth wallet | 1–2 weeks |

### Phase TLP-007: Feature Expansion (Post Private Alpha)
**Deferred:** QR payments, payment links, merchant checkout, ledger auto-posting, email/push notifications.

---

## 5. Path to Private Alpha

**Estimated duration:** 6–10 weeks from audit completion  
**Target cohort:** 10–50 invite-only users  
**Money rails:** PayPal live (fund + payout)  
**Excluded from Private Alpha:** Merchant platform, QR, payment links, developer live APIs

### Exit Criteria Checklist

- [ ] End-to-end fund → send → withdraw on live PayPal
- [ ] All money RPCs in version control and applied to production Supabase
- [ ] Compliance checklist ≥70% on KYC, security, fraud
- [ ] No CRITICAL fraud_logs accessible to non-admin users
- [ ] Production audit passes Supabase, PayPal live, legal probes
- [ ] Admin RBAC with ≥2 operators
- [ ] Sentry error tracking active
- [ ] Treasury reconciliation zero critical issues

---

## 6. Dependencies & Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| fund_wallet missing in prod DB | Funding fails after PayPal capture | Apply migration immediately; verify in staging |
| Balance column split causes data corruption | Incorrect balances, failed withdrawals | Unify columns before any live users |
| Legal review delays | Blocks external launch | Start legal engagement in parallel with TLP-002 |
| AML vendor integration timeline | Blocks scaled launch | Begin vendor evaluation in TLP-004 |
| PayPal live approval | Blocks real money | Submit live app review early |
| Single admin operator | Ops bottleneck | RBAC + backup admin in TLP-003 |

---

## 7. Artifacts Produced (TLP-001)

| File | Purpose |
|------|---------|
| `docs/launch/TROPICASH_LAUNCH_MASTER_PLAN.md` | This document — launch roadmap |
| `docs/audit/PRODUCTION_READINESS_AUDIT.md` | Full module-by-module audit |
| `data/launch/launch_readiness.json` | Machine-readable readiness data |
| `data/launch/launch_backlog.csv` | Prioritized blocker backlog |
| `dashboard/launch_readiness_dashboard.jsx` | Visual readiness dashboard |

---

## 8. Governance

- **Audit authority:** TLP-001 comprehensive code inspection
- **No code changes:** This phase is inspection and reporting only
- **Next phase owner:** Engineering lead assigns TLP-002 work items from backlog
- **Review cadence:** Re-run launch readiness score after each phase completion
- **Existing tooling:** Continue using `/admin/launch-readiness`, `/admin/production-audit`, `/admin/compliance-checklist` for live metrics

---

*TLP-001 complete. Proceed to TLP-002 upon stakeholder approval.*
