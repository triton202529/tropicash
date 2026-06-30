# Migration Integrity Report (TLP-004 / MIG-001)

**Generated:** 2026-06-30  
**Phase:** TLP-004 — Financial Core Completion  
**Scope:** SQL migrations affecting money movement RPC grants

---

## Executive Summary

All money-movement RPCs (`fund_wallet`, `transfer_funds`, `create_withdrawal_request`) are granted **service_role only** across every migration file. Legacy files that previously granted `authenticated` have been superseded. A drift-guard migration (`phase_tlp004_financial_core_completion.sql`) re-applies revocations idempotently.

**MIG-001 status:** PASS

---

## Canonical Migration Order

Apply in this order for money RPC integrity:

1. Base wallet / withdrawal / transaction schema migrations
2. `phase_tlp002_foundation_hardening.sql` — canonical RPC definitions + service_role grants
3. `phase_tlp004_financial_core_completion.sql` — idempotency tables + grant drift guard

**Never re-apply legacy RPC files after TLP-002/TLP-004 without review.**

---

## Money RPC Grant Scan

| RPC | Files granting execute | Grantee |
|-----|------------------------|---------|
| `fund_wallet` | `phase_tlp002`, `phase_tlp004` | `service_role` only |
| `transfer_funds` | `phase_tlp002`, `phase_tlp004`, `wallet_transfer_withdraw_rpc` | `service_role` only |
| `create_withdrawal_request` | `phase_tlp002`, `phase_tlp004`, `create_withdrawal_request_rpc`, `phase_13d` | `service_role` only |

No grants to `authenticated` or `public` remain for these functions.

---

## Superseded Migrations

| File | Issue (pre-TLP-004) | Resolution |
|------|---------------------|------------|
| `create_withdrawal_request_rpc.sql` | Granted `authenticated`; allowed client RPC bypass | Deprecated header added; grant changed to `service_role` |
| `phase_13d_withdrawal_transaction_ledger.sql` | Re-defined `create_withdrawal_request` with `authenticated` grant | Grant changed to `service_role`; ledger link logic retained |
| `wallet_transfer_withdraw_rpc.sql` | Duplicate `transfer_funds` definition | Already revokes `authenticated`; comment directs to server API |

---

## Drift Guard (TLP-004)

`phase_tlp004_financial_core_completion.sql` section 3 explicitly:

```sql
revoke all on function public.fund_wallet(...) from authenticated;
revoke all on function public.transfer_funds(...) from authenticated;
revoke all on function public.create_withdrawal_request(...) from authenticated;
grant execute ... to service_role;
```

Re-running this migration after any accidental legacy apply restores secure grants.

---

## Idempotency Schema (TLP-004)

New tables in `phase_tlp004_financial_core_completion.sql`:

- `transfer_idempotency_keys` — UNIQUE `(user_id, idempotency_key)`
- `withdrawal_idempotency_keys` — UNIQUE `(user_id, idempotency_key)`

Both tables: RLS enabled, no client policies (service_role writes only).

---

## Validation

Automated scan: `scripts/ftc001-recertification.mjs` → `data/certification/migration_validation.json`

| Test | Result |
|------|--------|
| MIG-001 | No insecure money RPC grants |
| MIG-002 | TLP-004 drift guard present |

---

## Recommendations

1. Add `phase_tlp004_financial_core_completion.sql` to deployment runbook after TLP-002.
2. Mark superseded files in CI/docs so operators do not apply them in isolation post-hardening.
3. Consider a single `supabase/migrations/` ordered directory in a future phase to eliminate manual apply-order risk.

---

## Machine-readable output

See `data/certification/migration_validation.json`.
