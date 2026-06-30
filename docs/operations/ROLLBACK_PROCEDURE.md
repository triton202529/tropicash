# Rollback Procedure

**Version:** 1.0.0 · **TLP-006**

---

## When to rollback

- Deploy causes 5xx on money APIs (`/api/transfers/send`, `/api/withdrawals/create`, `/api/paypal/*`)
- PayPal mode mismatch detected in production
- Unexpected wallet balance drift reported
- Authentication or admin RBAC regression

---

## Application rollback

1. **Identify last known good deployment** (hosting provider release history)
2. **Revert application** to previous build artifact or git tag
3. **Do not revert database** unless migration caused breakage (see SQL rollback)
4. Re-run post-deploy checks from `DEPLOYMENT_CHECKLIST.md`
5. Notify operators via incident record if user-facing impact

### Vercel / similar

- Promote previous deployment from dashboard  
- Verify env vars unchanged  

### Self-hosted

```bash
git checkout <last-good-tag>
npm ci && npm run build && npm start
```

---

## SQL rollback

SQL migrations are **forward-only** and idempotent where noted. Rollback strategy:

1. **Do not** drop money tables in production without treasury sign-off
2. If a migration grant was wrong, re-apply `phase_tlp004_financial_core_completion.sql` drift guard
3. Restore from backup if data corruption suspected (see `DISASTER_RECOVERY_PLAN.md`)

---

## Configuration rollback

If bad env vars deployed:

1. Restore previous env snapshot from host history
2. Confirm `PAYPAL_MODE` parity with `NEXT_PUBLIC_PAYPAL_MODE`
3. Restart application processes
4. Verify `/admin/production-audit` PayPal parity item is READY

---

## Financial incident rollback

If duplicate credits suspected:

1. **Stop** further deploys  
2. Freeze affected accounts via Compliance dashboard  
3. Query `funding_idempotency_keys`, `transactions` for duplicate `provider_order_id`  
4. Treasury reconciliation per FTC-001 procedures  
5. Document in compliance incident  

---

## Communication

- Internal: compliance incident + admin audit log  
- Users: support template if balances affected  

---

## Validation after rollback

- [ ] Money APIs return expected errors for test unauthenticated calls  
- [ ] Admin health green  
- [ ] No new operational_errors spike in `/admin/logs`  

---

*Test rollback on staging before first Private Alpha production deploy.*
