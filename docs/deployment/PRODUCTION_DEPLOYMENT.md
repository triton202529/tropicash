# Tropicash Production Deployment Guide

## Prerequisites

- Node.js 18+ and npm
- Supabase project with all SQL migrations applied (including `phase_tlp002_foundation_hardening.sql`)
- PayPal Business account (sandbox for staging, live for production)
- Hosting with server-side env var support (e.g. Vercel)

## Startup Checklist

1. Copy `.env.example` to `.env.local` (dev) or configure host env vars (production).
2. Apply Supabase migrations in order under `supabase/sql/`.
3. Verify `admin_members` has at least one active admin row after migration bootstrap.
4. Set `PAYPAL_MODE` and `NEXT_PUBLIC_PAYPAL_MODE` to the **same** value (`sandbox` or `live`).
5. Run `npm install && npm run build && npm start`.

## Required Environment Variables

| Variable | Scope | Required | Notes |
|----------|-------|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Yes | Never expose to client |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | Public | Yes | PayPal JS SDK |
| `NEXT_PUBLIC_PAYPAL_MODE` | Public | Yes | `sandbox` or `live` |
| `PAYPAL_MODE` | Server | Yes | Must match public mode |
| `PAYPAL_CLIENT_ID` | Server | Yes | REST API |
| `PAYPAL_CLIENT_SECRET` | Server | Yes | REST API |
| `PAYPAL_WEBHOOK_ID` | Server | Yes (prod) | PayPal webhook verification |
| `TROPICASH_REQUIRE_APPROVED_KYC` | Server | Recommended | Default `true` |

## Production Verification Checklist

- [ ] `npm run build` succeeds with no env errors
- [ ] `/admin/production-audit` passes Supabase and PayPal probes
- [ ] PayPal `PAYPAL_MODE` === `NEXT_PUBLIC_PAYPAL_MODE`
- [ ] Funding: create-order → capture-order → `fund_wallet` credits balance
- [ ] Send: `POST /api/transfers/send` succeeds (direct RPC revoked)
- [ ] Withdraw: `POST /api/withdrawals/create` succeeds (direct RPC revoked)
- [ ] KYC not approved → all money APIs return 403
- [ ] Non-admin user cannot access `/admin/*` or `fraud_logs` of other users
- [ ] `tc_is_admin()` returns true for `admin_members` rows only

## Sandbox vs Production

- **Sandbox:** `PAYPAL_MODE=sandbox`, sandbox PayPal credentials, no real money.
- **Production:** `PAYPAL_MODE=live`, live credentials, webhooks configured, legal pages reviewed.

Misconfigured mode mismatch returns HTTP 503 on funding APIs when `NODE_ENV=production`.

## Admin RBAC

Add operators via SQL (service role) or future admin UI:

```sql
INSERT INTO admin_members (user_id, role, active)
SELECT id, 'admin', true FROM auth.users WHERE email = 'ops@example.com'
ON CONFLICT (user_id) DO UPDATE SET active = true, role = 'admin';
```

## Rollback

- SQL migrations are idempotent where noted; keep database backups before applying TLP-002.
- To revert money API changes, restore authenticated grants on RPCs only after re-deploying prior app version.
