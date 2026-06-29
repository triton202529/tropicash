# Money Integrity Certification

**Phase:** TLP-002 — Foundation Hardening  
**Date:** 2026-06-28  
**Status:** Certified (pending Supabase migration apply in target environment)

---

## Certification Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Single authoritative ledger | ✓ | `wallet_balance` canonical column; all RPCs use it (`phase_tlp002_foundation_hardening.sql`) |
| No duplicate transaction paths | ✓ | Client RPC grants revoked; money flows only via server APIs |
| Canonical balance source | ✓ | `lib/walletBalance.js`; UI reads `wallet_balance ?? balance` during transition |
| Idempotent financial operations | ✓ | PayPal funding idempotency keys; atomic withdrawal/send RPCs |
| Transaction auditability | ✓ | `transactions` table inserts from all RPCs; admin audit + timeline |
| Rollback safety | ✓ | Idempotent SQL sections; migration documented in deployment guide |
| Server-authoritative money movement | ✓ | `/api/transfers/send`, `/api/withdrawals/create`, PayPal capture pipeline |
| Environment separation | ✓ | `lib/paypalProductionGuard.js`; `.env.example`; deployment checklist |

---

## Approved Server Money Paths

### Funding
```
Client → POST /api/paypal/create-order (JWT, KYC, account security, rate limit)
       → PayPal capture
       → POST /api/paypal/capture-order (JWT, KYC, account security, rate limit)
       → fund_wallet(p_user_id, p_amount) [service_role only]
       → wallets.wallet_balance += amount
       → transactions row type fund_wallet
```

### Send (P2P Transfer)
```
Client → POST /api/transfers/send (JWT, KYC, account security, rate limit)
       → transfer_funds(sender, recipient, amount) [service_role only]
       → wallets.wallet_balance debit/credit
       → transactions row type send_money
```

### Withdrawal
```
Client → POST /api/withdrawals/create (JWT, KYC, account security, rate limit)
       → create_withdrawal_request(p_user_id, p_amount, p_payout_email) [service_role only]
       → wallets.wallet_balance debit
       → withdrawal_requests row + transactions row type withdraw_wallet
```

---

## Revoked Client Paths

| RPC | Prior grant | TLP-002 grant |
|-----|-------------|---------------|
| `transfer_funds` | authenticated | service_role only |
| `create_withdrawal_request` | authenticated | service_role only |
| `fund_wallet` | n/a (missing) | service_role only |

Direct browser invocation of these RPCs will fail after migration apply.

---

## KYC Enforcement

- **Module:** `lib/serverKycGuard.js`
- **Policy:** `TROPICASH_REQUIRE_APPROVED_KYC=true` (default) requires approved KYC before any money movement
- **Limits:** `evaluateKycTransactionLimit` enforces funding/send/withdrawal daily limits server-side (no client bypass)
- **Client UI:** KYC banners remain informational; blocking occurs on server APIs only

---

## Security Controls

- **Admin RBAC:** `admin_members` table + `tc_is_admin()` — no hardcoded emails in application code
- **Fraud logs RLS:** Admin-only select/update; users may insert own-row logs only
- **Rate limits:** Per-user/IP rolling windows on all money APIs

---

## Deployment Requirement

Apply `supabase/sql/phase_tlp002_foundation_hardening.sql` to the target Supabase project before certifying production.

---

*TLP-002 Money Integrity Certification — engineering sign-off for foundation hardening.*
