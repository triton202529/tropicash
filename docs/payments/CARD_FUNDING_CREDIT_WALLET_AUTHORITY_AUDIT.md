# Card Funding — credit_wallet Authority Audit (Phase C-002 / F)

**Date:** 2026-07-13
**Project ref:** `opbhcndlibbcsmoaeymq`
**Inspection mode:** read-only first; hardening applied after caller confirmation.

---

## Verdict

| Field | Value |
|-------|-------|
| Classification | **CRITICAL_UNSAFE_BALANCE_AUTHORITY** |
| Category | **D — unsafe and externally reachable** (also **C — unused**) |
| Overloads | **1** |
| Repository callers | **None** (only prior C-002 audit mentions) |
| Database callers | **None** (no function/trigger `prosrc` references) |
| Recommended action | Revoke EXECUTE from `PUBLIC`, `anon`, `authenticated`, and `service_role`; pin `search_path`; mark **DEPRECATED**; do **not** drop yet |

Canonical funding remains `public.fund_wallet(uuid, numeric)`.

---

## Live function inventory

### Signature

`public.credit_wallet(user_id_input uuid, amount_input numeric) → void`

| Property | Value |
|----------|-------|
| Owner | `postgres` |
| Return type | `void` |
| Security mode | **SECURITY INVOKER** (`prosecdef = false`) |
| `search_path` | **unset** (`proconfig` null) |
| Comment | none (pre-hardening) |

### Body (complete)

```sql
begin
  update wallets
  set wallet_balance = wallet_balance + amount_input
  where user_id = user_id_input;
end;
```

### Privilege / control checklist

| Control | Status |
|---------|--------|
| Caller selects target user | **Yes** — `user_id_input` argument |
| Caller selects amount | **Yes** — `amount_input` argument |
| Authentication checks | **None** |
| Authorization checks | **None** |
| Amount validation | **None** (negative credits allowed by body) |
| KYC enforcement | **None** |
| Funding limits | **None** |
| Idempotency | **None** |
| Transaction creation | **No** |
| Ledger creation | **No** |
| Audit logging | **None** |
| Notification behavior | **None** |

### Execute grants (pre-hardening)

| Grantee | EXECUTE |
|---------|---------|
| `PUBLIC` | **Yes** |
| `anon` | **Yes** |
| `authenticated` | **Yes** |
| `service_role` | **Yes** |
| `postgres` | Yes (owner) |

### RLS interaction (wallets)

- RLS **enabled** on `public.wallets`
- Policies observed: own-row **SELECT**, own-row **INSERT**, admin **SELECT**
- **No UPDATE policy** observed → INVOKER client calls currently update **0 rows** under RLS
- Table-level `UPDATE` privilege still granted to `anon` / `authenticated`
- `service_role` / table owner bypass RLS → **successful silent balance mutation without a transaction row**

Even with today’s missing UPDATE policy, EXECUTE exposure is unsafe: any future wallet UPDATE policy (or bypass) would make client-callable credits live without accounting.

---

## Caller search

| Surface | Result |
|---------|--------|
| App `pages/`, `lib/`, `components/`, `scripts/` | No `credit_wallet` / `rpc("credit_wallet")` |
| SQL migrations | No definitions/callers besides unrelated docs |
| Admin tools | No |
| Jobs / triggers / other functions | No `prosrc` references |
| Prior C-002 docs/results | Mention only as risk note |

**Production path required?** No.
**Legitimate dependency on service_role?** No verified dependency → revoke service_role EXECUTE as well; owner (`postgres`) retains access for emergency SQL if ever needed.

---

## Security decision

Because `anon` / `authenticated` can EXECUTE a function that mutates `wallet_balance` without canonical accounting records:

**CRITICAL_UNSAFE_BALANCE_AUTHORITY**

Preferred resolution applied:

1. `REVOKE` EXECUTE from `PUBLIC`, `anon`, `authenticated`, `service_role`
2. `CREATE OR REPLACE` with `SET search_path = public` (body unchanged)
3. Comment: deprecated; use `public.fund_wallet`
4. Do **not** drop until a later phase reconfirms zero callers

---

## Migration

`supabase/sql/card_funding_credit_wallet_authority_hardening_c002.sql`

Rollback guidance is included in that file (re-grant only under controlled incident response — do not re-expose to clients).

---

## Corrective application (completed)

| Check | Result |
|-------|--------|
| Migration applied | `card_funding_credit_wallet_authority_hardening_c002` |
| anon EXECUTE | **false** |
| authenticated EXECUTE | **false** |
| PUBLIC EXECUTE | **false** |
| service_role EXECUTE | **false** (no verified dependency) |
| postgres owner EXECUTE | true |
| `fund_wallet` regression | **PASS** |
| Conditional trigger intact | **PASS** |
| `npm run lint` | **PASS** |
| `npm run build` | **PASS** |

**Stop for review.** Do not run PayPal sandbox probe until operator approval.
