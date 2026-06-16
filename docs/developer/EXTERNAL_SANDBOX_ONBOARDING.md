# External Developer Sandbox Onboarding (Phase 14A)

## Purpose

Phase 14A introduces the first **external-facing onboarding experience** for the Tropicash Developer Sandbox — documentation, journey guidance, and sandbox access readiness.

This phase does **not** enable production access, money movement, new wallet capabilities, or OAuth permission expansion.

**Public route:** `/developers/get-started`

## Sandbox status

| Indicator | Value |
|-----------|-------|
| Sandbox | Available |
| Production | Disabled |

## Available sandbox APIs

### Developer Sandbox APIs

| API | Method | Path |
|-----|--------|------|
| Platform Status | GET | `/api/developer/platform-status` |
| Supported Currencies | GET | `/api/developer/supported-currencies` |

Authenticated with sandbox API key: `Authorization: Bearer tc_test_xxx`

### OAuth Sandbox APIs

| API | Method | Path | Scope |
|-----|--------|------|-------|
| OAuth Profile | GET | `/api/oauth/profile` | `profile.read` |
| OAuth Wallet (Sandbox) | GET | `/api/oauth/wallet` | `wallet.read` |

Authenticated with OAuth access token: `Authorization: Bearer tc_at_xxx`

OAuth wallet is **sandbox-only** and **read-only**.

## Developer journey

1. Create Developer Organization
2. Create Application
3. Generate Sandbox API Credentials
4. Create OAuth Client
5. Run OAuth Sandbox Test Harness
6. Review Test Evidence
7. Complete Certification Workflow

Steps 2–6 require approved Developer Console access.

## Sandbox restrictions

Not available:

- Production API keys
- Live money movement
- Send money / withdrawal / transaction APIs
- Payment method APIs
- Production OAuth
- Real financial transfers

## Security expectations

- Store client secrets server-side only
- Never expose OAuth secrets in frontend applications
- Use HTTPS redirect URIs
- Use least-privilege scopes
- Respect rate limits
- Protect customer data

## Production separation

Production access is **not currently available**. Future production releases will follow separate governance outside this sandbox onboarding flow.

## Module reference

- `lib/developerSandboxOnboarding.js` — pure onboarding data/config
- `pages/developers/get-started.jsx` — public onboarding page
