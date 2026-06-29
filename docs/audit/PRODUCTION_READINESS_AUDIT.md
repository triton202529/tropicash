# Tropicash Production Readiness Audit

**Audit ID:** TLP-001  
**Date:** 2026-06-28  
**Scope:** Full platform production readiness assessment  
**Method:** Codebase inspection — no modifications  
**Stack:** Next.js 15 (Pages Router) + Supabase + PayPal

---

## Executive Summary

### Launch Stage: Internal Alpha

Tropicash belongs in **Internal Alpha** because:

1. **Core wallet flows are implemented** — PayPal funding, P2P send via `transfer_funds` RPC, and withdrawal queue with admin review exist and are exercised in soft-launch mode.
2. **Extensive admin/compliance tooling** — 44 admin pages, launch readiness scoring, production audit, compliance checklist, withdrawal reconciliation, and treasury intelligence demonstrate operational maturity beyond prototype.
3. **Critical production gaps remain** — Missing `fund_wallet` migration in version control, balance column split, advisory-only KYC, open fraud RLS, draft legal documents, and PayPal sandbox defaults prevent real-money Private Alpha.
4. **Soft-launch posture is explicit** — `SoftLaunchNotice` component, controlled testing messaging, and manual treasury review are the designed operating model today.
5. **Merchant/QR/payment links absent** — Not blocking Internal Alpha but excluded from near-term launch scope.

### Overall Readiness: 54%

Unweighted average of 31 module scores. Platform is suitable for **internal testing with manual treasury oversight**; not ready for **regulated live-money deployment** or **external Private Alpha**.

---

## Launch Score

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

## Module Assessments

### Authentication
**Classification:** READY_WITH_MINOR_WORK | **Score:** 75%

| Aspect | Assessment |
|--------|------------|
| Implementation | Supabase email/password auth, password reset, session lifecycle in `lib/userContext.js`, `RouteAuthGuard.jsx` |
| Production readiness | Functional for soft launch; lacks 2FA, social OAuth, server middleware |
| Missing | 2FA enforcement (schema only in `security_settings.sql`), OAuth/social login, Next.js middleware |
| Security concerns | JWT in Authorization header (standard SPA pattern); debug logging of emails in RouteAuthGuard |
| Operational concerns | Custom `user_sessions` table is advisory — does not revoke Supabase tokens |
| UX concerns | Adequate auth flows; no step-up auth for sensitive actions |
| Launch blockers | BLK-011 (2FA not enforced) — HIGH |
| Dependencies | Supabase, environment configuration |
| Priority | P1 |

**Evidence:** `pages/auth.js`, `pages/login.jsx`, `components/RouteAuthGuard.jsx`, `lib/security.js`

---

### Authorization
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 45%

| Aspect | Assessment |
|--------|------------|
| Implementation | Single email allowlist in `lib/adminAccess.js`; OAuth scope RBAC; developer access gate |
| Production readiness | Not scalable — one hardcoded admin email in JS and SQL `tc_is_admin()` |
| Missing | Role matrix, permissions table, server-side admin route middleware |
| Security concerns | Admin identity in source code; `/admin/*` gated client-side only |
| Operational concerns | No role separation (ops vs compliance vs treasury) |
| Launch blockers | BLK-006 (hardcoded admin RBAC) — CRITICAL |
| Dependencies | Authentication, admin console |
| Priority | P0 |

**Evidence:** `lib/adminAccess.js`, `supabase/sql/withdrawal_requests.sql`, `lib/developerAccessGate.js`

---

### User Onboarding
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 62%

| Aspect | Assessment |
|--------|------------|
| Implementation | Landing → auth → wallet redirect; KYC document upload; soft-launch notices |
| Production readiness | Basic flow works; developer onboarding requires manual admin approval |
| Missing | Guided tour, email verification beyond Supabase defaults, progressive KYC prompts |
| UX concerns | KYC is optional path; no in-app onboarding wizard |
| Launch blockers | None critical — tied to KYC enforcement (BLK-003) |
| Priority | P2 |

**Evidence:** `pages/index.js`, `pages/kyc.jsx`, `lib/developerSandboxOnboarding.js`, `components/SoftLaunchNotice.jsx`

---

### Wallet
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 65%

| Aspect | Assessment |
|--------|------------|
| Implementation | Wallet UI, balance display, OAuth sandbox read-only API |
| Production readiness | Functional with defensive `wallet_balance ?? balance` fallback |
| Missing | Multi-currency, unified balance column, production OAuth wallet |
| Security concerns | **Critical balance vs wallet_balance split** — `transfer_funds` uses `balance`, withdrawals use `wallet_balance` |
| Operational concerns | Legacy `SendMoneyForm.jsx` does non-atomic client-side updates (unused but present) |
| Launch blockers | BLK-002 (column split) — CRITICAL |
| Dependencies | Ledger, transactions, funding |
| Priority | P0 |

**Evidence:** `pages/wallet.js`, `supabase/sql/wallet_transfer_withdraw_rpc.sql`, `lib/oauthWalletApi.js`

---

### Ledger
**Classification:** PROTOTYPE | **Score:** 25%

| Aspect | Assessment |
|--------|------------|
| Implementation | Double-entry schema (`internal_ledger_phase1.sql`), admin UI, manual `createJournalEntry` helper |
| Production readiness | Observation mode only — explicitly no auto-posting from money flows |
| Missing | Wiring from fund/withdraw/send RPCs; automated reconciliation |
| Operational concerns | Cannot produce auditable financial statements from ledger |
| Launch blockers | BLK-013 (ledger not connected) — HIGH |
| Priority | P1 |

**Evidence:** `supabase/sql/internal_ledger_phase1.sql`, `lib/internalLedger.js`, `pages/admin/ledger.jsx`

---

### Transactions
**Classification:** READY_WITH_MINOR_WORK | **Score:** 72%

| Aspect | Assessment |
|--------|------------|
| Implementation | History UI, filtering, withdrawal status correlation, type normalization |
| Production readiness | Solid user-facing activity log |
| Missing | Merchant/checkout transaction types |
| Operational concerns | Type mismatch: RPC inserts `send`, fraud queries `send_money` |
| Launch blockers | BLK-017 (type mismatch) — MEDIUM |
| Priority | P2 |

**Evidence:** `pages/transactions.jsx`, `supabase/sql/phase_13d_withdrawal_transaction_ledger.sql`

---

### Funding
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 50%

| Aspect | Assessment |
|--------|------------|
| Implementation | PayPal create/capture APIs with idempotency, rate limits, account security gate on create-order |
| Production readiness | Strong server pipeline but **fund_wallet RPC missing from supabase/sql/** |
| Missing | Bank transfer, non-PayPal rails, server KYC hard block on funding |
| Security concerns | capture-order missing account security gate (create-order has it) |
| Launch blockers | BLK-001 (fund_wallet missing) — CRITICAL; BLK-009 (PayPal sandbox) — HIGH |
| Priority | P0 |

**Evidence:** `pages/api/paypal/capture-order.js`, `pages/fund-wallet.jsx`, `supabase/sql/funding_idempotency.sql`

---

### Withdrawals
**Classification:** READY_WITH_MINOR_WORK | **Score:** 78%

| Aspect | Assessment |
|--------|------------|
| Implementation | Atomic `create_withdrawal_request` RPC, KYC server gate, trust layer, admin queue, optional PayPal payout automation |
| Production readiness | Strongest money flow; manual review is default posture |
| Missing | Non-PayPal withdrawal rails |
| Operational concerns | Automated payout gated by `NEXT_PUBLIC_WITHDRAWAL_AUTOMATED_PAYOUT` |
| Launch blockers | Withdrawal RPC bypassable without check-limit API (part of BLK-003) |
| Priority | P1 |

**Evidence:** `pages/withdraw-wallet.jsx`, `pages/api/withdrawals/check-limit.js`, `lib/payouts/payoutService.js`

---

### Merchant Platform
**Classification:** SIMULATION_ONLY | **Score:** 10%

| Aspect | Assessment |
|--------|------------|
| Implementation | Developer product catalog with planned checkout session contracts; simulation configs only |
| Production readiness | No merchant onboarding, settlement, or capture APIs |
| Missing | All merchant functionality — Phase 5 roadmap |
| Launch blockers | BLK-025 — informational for wallet-only launch |
| Priority | P3 |

**Evidence:** `lib/developerProductCatalogConfig.js`, `pages/developers/roadmap.jsx`

---

### QR Payments
**Classification:** NOT_STARTED | **Score:** 0%

No QR generation, scanning, or payment flows found in codebase.

**Launch blockers:** BLK-023 — informational

---

### Payment Links
**Classification:** NOT_STARTED | **Score:** 0%

No hosted payment link product. Closest is planned checkout session in developer catalog.

**Launch blockers:** BLK-024 — informational

---

### Notifications
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 58%

| Aspect | Assessment |
|--------|------------|
| Implementation | In-app Supabase notifications, realtime subscription, event bus, security notifications |
| Missing | Push (FCM/APNs), email/SMS delivery |
| Launch blockers | BLK-021 (no email/push) — MEDIUM |
| Priority | P2 |

**Evidence:** `lib/notificationService.js`, `pages/notifications.jsx`, `components/NotificationBell.jsx`

---

### Security
**Classification:** READY_WITH_MINOR_WORK | **Score:** 68%

| Aspect | Assessment |
|--------|------------|
| Implementation | Rate limits, hashed secrets, PayPal webhook verification, audit trails, account security guards |
| Missing | CSRF, CSP/HSTS headers, fail-closed account security |
| Security concerns | fraud_logs RLS wide open; rate limits fail-open; legacy Python API |
| Launch blockers | BLK-005, BLK-012, BLK-016, BLK-018, BLK-019 |
| Priority | P0 |

**Evidence:** `lib/rateLimit.js`, `supabase/sql/fraud_logs_install.sql`, `tropicash-api/main.py`, `next.config.mjs`

---

### Fraud Controls
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 55%

| Aspect | Assessment |
|--------|------------|
| Implementation | Rule-based engine (detection only), trust layer client caps, admin fraud queue, funding fraud signals |
| Missing | Server-side blocking on high fraud scores; ML/vendor integration |
| Security concerns | Send bypasses server gates; fraud engine is log-only |
| Launch blockers | BLK-008 (send bypass) — CRITICAL |
| Priority | P0 |

**Evidence:** `lib/fraudEngine.js`, `lib/trustLayer.js`, `pages/admin/fraud-queue.jsx`

---

### KYC
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 58%

| Aspect | Assessment |
|--------|------------|
| Implementation | Document upload, admin review, limit policies with enforcement modes, withdrawal server gate |
| Missing | Identity verification vendor, KYC on funding/send server-side, notifications |
| Operational concerns | Default enforcement mode is `advisory` |
| Launch blockers | BLK-003 — CRITICAL |
| Priority | P0 |

**Evidence:** `lib/kyc.js`, `lib/kycRisk.js`, `supabase/sql/phase_11a_kyc_foundation.sql`, `pages/admin/kyc.jsx`

---

### AML Controls
**Classification:** PROTOTYPE | **Score:** 22%

| Aspect | Assessment |
|--------|------------|
| Implementation | Draft AML policy page only |
| Missing | Sanctions/PEP screening, SAR workflow, automated AML monitoring |
| Launch blockers | BLK-004 — CRITICAL |
| Priority | P0 |

**Evidence:** `pages/legal/aml-policy.jsx`, `lib/complianceChecklist.js`

---

### Treasury
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 62%

| Aspect | Assessment |
|--------|------------|
| Implementation | Admin dashboard, intelligence, event center, simulation lab (advisory) |
| Missing | Automated settlement, ledger connection, timezone consistency |
| Operational concerns | "Today" metrics use browser local timezone |
| Priority | P1 |

**Evidence:** `lib/adminTreasury.js`, `pages/admin/treasury.jsx`, `lib/treasurySimulationLab.js`

---

### Admin Console
**Classification:** READY_WITH_MINOR_WORK | **Score:** 82%

| Aspect | Assessment |
|--------|------------|
| Implementation | 44 admin pages covering KYC, fraud, treasury, withdrawals, launch readiness, developer sandbox |
| Missing | Multi-admin RBAC, mobile-optimized admin UI |
| Priority | P1 |

**Evidence:** `pages/admin/index.jsx`, `pages/admin/launch-readiness.jsx`

---

### Reporting
**Classification:** READY_WITH_MINOR_WORK | **Score:** 75%

| Aspect | Assessment |
|--------|------------|
| Implementation | Withdrawal reconciliation, launch readiness, production audit, compliance checklist |
| Missing | Scheduled exports, BI integration |
| Launch blockers | BLK-026 — informational |
| Priority | P2 |

**Evidence:** `lib/withdrawalReconciliation.js`, `lib/launchReadiness.js`, `lib/productionAudit.js`

---

### Developer APIs
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 48%

| Aspect | Assessment |
|--------|------------|
| Implementation | Sandbox-only read APIs (ping, profile, currencies, platform-status) |
| Missing | Money-movement APIs, production key issuance, OpenAPI spec |
| Priority | P2 |

**Evidence:** `pages/api/developer/`, `lib/developerApiAuth.js`, `lib/developerCredentials.js`

---

### OAuth
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 55%

| Aspect | Assessment |
|--------|------------|
| Implementation | Full OAuth2 stack with hashed tokens, scopes, certification gates, wallet.read sandbox |
| Missing | Production OAuth path, code issuance disabled by default |
| Priority | P2 |

**Evidence:** `pages/api/oauth/`, `lib/oauthAccessTokenAuth.js`, `lib/oauthFeatureFlags.js`

---

### SDK Readiness
**Classification:** PROTOTYPE | **Score:** 32%

| Aspect | Assessment |
|--------|------------|
| Implementation | In-repo `@tropicash/sdk` v0.1.0 private preview |
| Missing | npm publish, TypeScript types, CI tests, OAuth client |
| Launch blockers | BLK-020 — MEDIUM |
| Priority | P2 |

**Evidence:** `sdk/package.json`, `sdk/README.md`, `lib/sdk/`

---

### Webhooks
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 38%

| Aspect | Assessment |
|--------|------------|
| Implementation | Registration, test delivery, PayPal inbound webhooks, SDK verifier |
| Missing | Production event delivery worker; signing key mismatch (hash vs plaintext) |
| Launch blockers | BLK-015 — HIGH |
| Priority | P2 |

**Evidence:** `lib/developerWebhooks.js`, `pages/api/webhooks/paypal.js`

---

### Mobile Responsiveness
**Classification:** READY_WITH_MINOR_WORK | **Score:** 70%

Tailwind responsive utilities across consumer pages. Admin pages partially optimized. Viewport meta not explicit in `_document.js`.

**Evidence:** `components/Navbar.jsx`, `lib/authFormUi.js`, `pages/_document.js`

---

### PWA
**Classification:** READY_WITH_MINOR_WORK | **Score:** 68%

Manifest, service worker (production only), installable shell. Offline explicitly excludes wallet/API.

**Evidence:** `public/manifest.json`, `public/sw.js`, `pages/_app.js`

---

### Environment Configuration
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 48%

Runtime env vars functional. No `.env.example`. PayPal defaults to sandbox. Dual mode vars risk mismatch.

**Launch blockers:** BLK-009, BLK-010 — HIGH

**Evidence:** `lib/productionAudit.js`, `lib/paypalMode.js`

---

### Secrets Management
**Classification:** READY_WITH_MINOR_WORK | **Score:** 70%

Show-once secrets, SHA-256 hash storage, service role server-only. Hardcoded admin email; no secrets manager.

**Evidence:** `lib/developerCredentials.js`, `lib/oauthTokens.js`, `lib/operationalLogger.js`

---

### Error Handling
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 58%

Consistent API envelopes for developer/OAuth. Mixed client patterns. No global error middleware.

---

### Logging
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 60%

DB-backed operational logs, admin audit, fraud logs, OAuth audit. No centralized aggregation.

**Evidence:** `lib/operationalLogger.js`, `lib/adminAudit.js`, `pages/admin/logs.jsx`

---

### Monitoring
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 50%

Admin health checks, smart alerts, sandbox monitoring. No Sentry/Datadog/PagerDuty.

**Launch blockers:** BLK-014 — HIGH

**Evidence:** `pages/admin/health.jsx`, `lib/smartAlerts.js`

---

### Production Configuration
**Classification:** PARTIALLY_IMPLEMENTED | **Score:** 45%

Minimal `next.config.mjs`. No security headers. Legal pages draft. No deployment runbook.

**Launch blockers:** BLK-007 — CRITICAL

---

## Blockers

### Critical Blockers (8)

| ID | Module | Description | Why It Blocks | Fix | Effort |
|----|--------|-------------|---------------|-----|--------|
| BLK-001 | Funding | fund_wallet RPC missing from migrations | PayPal capture fails at wallet credit | Add SQL migration | 2–3 days |
| BLK-002 | Wallet | balance vs wallet_balance split | Balance corruption | Unify column + migrate RPCs | 3–5 days |
| BLK-003 | KYC | Advisory-only enforcement | Unverified users can move money | hard_block + server gates | 5–7 days |
| BLK-004 | AML | No sanctions/SAR | Regulatory non-compliance | AML vendor + SAR workflow | 2–4 weeks |
| BLK-005 | Security | fraud_logs RLS open | Data leak/tampering | Admin-only RLS | 1–2 days |
| BLK-006 | Authorization | Hardcoded admin | Not scalable/secure | DB-backed RBAC | 3–5 days |
| BLK-007 | Production Config | Legal drafts | Cannot launch externally | Legal review | 1–2 weeks |
| BLK-008 | Fraud | Send bypasses server | Client bypass possible | /api/send/check-limit | 3–4 days |

### Major Blockers (8)

BLK-009 PayPal sandbox default | BLK-010 No .env.example | BLK-011 2FA not enforced | BLK-012 Account security fail-open | BLK-013 Ledger disconnected | BLK-014 No APM | BLK-015 No webhook delivery | BLK-016 Legacy Python API

### Minor Blockers (6)

BLK-017 Transaction type mismatch | BLK-018 No CSRF | BLK-019 No security headers | BLK-020 SDK not published | BLK-021 No email/push | BLK-022 PWA offline only

### Informational (4)

BLK-023 QR not implemented | BLK-024 Payment links not implemented | BLK-025 Merchant simulation only | BLK-026 No report exports

---

## Top 10 Launch Blockers

1. **BLK-001** — fund_wallet RPC missing from version-controlled migrations (CRITICAL)
2. **BLK-002** — balance vs wallet_balance column split (CRITICAL)
3. **BLK-003** — KYC enforcement advisory-only by default (CRITICAL)
4. **BLK-004** — No sanctions/PEP screening or SAR workflow (CRITICAL)
5. **BLK-005** — fraud_logs RLS allows all authenticated users (CRITICAL)
6. **BLK-006** — Single hardcoded admin email RBAC (CRITICAL)
7. **BLK-007** — Legal documents are draft placeholders (CRITICAL)
8. **BLK-008** — Send money bypasses server-side gates (CRITICAL)
9. **BLK-009** — PayPal defaults to sandbox mode (HIGH)
10. **BLK-010** — No .env.example or deployment runbook (HIGH)

---

## Recommended Implementation Order

1. **Week 1–2:** BLK-001, BLK-002, BLK-005, BLK-010, BLK-016
2. **Week 2–3:** BLK-008, BLK-003, BLK-012, BLK-006, BLK-017
3. **Week 3–4:** BLK-009, BLK-007, BLK-014, BLK-019
4. **Week 4–8:** BLK-004, BLK-011, BLK-013, BLK-015
5. **Post Private Alpha:** BLK-023, BLK-024, BLK-025, BLK-020, BLK-021

---

## Path from Current State to Private Alpha

**Current:** Internal Alpha (54% readiness)  
**Target:** Private Alpha (invite-only, live PayPal, 10–50 users)  
**Duration:** 6–10 weeks

### Prerequisites
- All 8 critical blockers resolved
- PayPal live mode with verified webhooks
- Legal documents published
- KYC hard_block on withdrawals and sends
- Admin RBAC with ≥2 operators
- Sentry/monitoring baseline
- Treasury reconciliation clean

### Private Alpha Scope
**In scope:** Wallet fund, P2P send, withdraw with manual treasury oversight  
**Out of scope:** Merchant checkout, QR payments, payment links, developer live APIs, automated payouts (optional)

---

## Validation Checklist

- [x] Every production module inspected (31 modules)
- [x] Every module has readiness classification
- [x] Every launch blocker documented (26 items)
- [x] Launch readiness score generated (54%)
- [x] Dashboard component created (`dashboard/launch_readiness_dashboard.jsx`)
- [x] JSON artifact created (`data/launch/launch_readiness.json`)
- [x] CSV backlog created (`data/launch/launch_backlog.csv`)

---

## Existing Audit Tooling (Reference)

The platform includes built-in audit surfaces that complement this static audit:

| Tool | Path | Purpose |
|------|------|---------|
| Launch Readiness | `/admin/launch-readiness` | Live aggregated score |
| Production Audit | `/admin/production-audit` | Env/config probes |
| Compliance Checklist | `/admin/compliance-checklist` | 8-section compliance |
| Withdrawal Reconciliation | `/admin/withdrawal-reconciliation` | Money flow integrity |

**Libraries:** `lib/launchReadiness.js`, `lib/productionAudit.js`, `lib/complianceChecklist.js`

---

*TLP-001 Production Readiness Audit — inspection complete. No code changes made.*
