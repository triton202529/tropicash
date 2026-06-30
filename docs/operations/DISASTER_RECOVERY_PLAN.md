# Disaster Recovery Plan

**Version:** 1.0.0 · **TLP-006**

---

## Objectives

| Metric | Target (Private Alpha) |
|--------|------------------------|
| **RPO** (Recovery Point Objective) | ≤ 24 hours |
| **RTO** (Recovery Time Objective) | ≤ 4 hours |

Private Alpha uses managed Supabase and hosting provider backups. Targets reflect documented expectations — validate against your Supabase plan.

---

## Scope

- PostgreSQL database (Supabase)
- Application hosting (Next.js)
- Environment configuration
- KYC document storage (`kyc-documents` bucket)

PayPal funds and payout state are also held at PayPal — reconcile against `transactions` and `withdrawal_requests`.

---

## Backup process

### Database (Supabase)

1. Enable **daily automated backups** in Supabase project settings (Pro plan or equivalent)
2. Before major migrations, run **manual backup** or point-in-time snapshot if available
3. Document backup retention period in Supabase dashboard
4. Verify restore access limited to project owners

### Application

- Source code: git repository (`main` branch)
- Environment: host env var export (encrypted, not in git)
- Build artifacts: reproducible via `npm run build`

### KYC storage

- Supabase Storage bucket `kyc-documents` included in project backup scope
- Do not delete bucket without legal retention review

---

## Restore procedure

### 1. Assess incident

- Classify severity per `INCIDENT_RESPONSE_PLAYBOOK.md`
- Determine if DB restore required vs app-only rollback

### 2. Database restore

1. Open Supabase dashboard → Database → Backups  
2. Select restore point ≤ RPO target  
3. Restore to **new project** or in-place per Supabase guidance  
4. Update `NEXT_PUBLIC_SUPABASE_URL` and keys in hosting env if project changed  
5. Re-run migration verification  

### 3. Application restore

1. Deploy last known good build  
2. Restore env vars from secure backup  
3. Run post-deploy checklist  

### 4. Verification

- [ ] `/admin/health` all critical tables  
- [ ] Sample user login  
- [ ] Wallet balance matches pre-incident spot check (sample users)  
- [ ] `withdrawal_requests` status consistent  
- [ ] FTC-001 reconciliation queries (manual)  

---

## Disaster scenarios

| Scenario | Response |
|----------|----------|
| Supabase region outage | Wait for provider; communicate to users; no local failover in Alpha |
| Accidental data delete | Restore from backup; freeze writes during recovery |
| Compromised service role key | Rotate key in Supabase; update host env; audit `admin_audit_logs` |
| PayPal API outage | Funding/withdrawals queue; notify users; no balance changes |
| Complete host loss | Redeploy from git; restore DB; restore env from vault |

---

## Disaster recovery checklist

- [ ] Supabase daily backups enabled
- [ ] Env vars backed up in password manager / host history
- [ ] Operator knows Supabase restore UI
- [ ] Rollback procedure tested on staging
- [ ] Emergency contact list for compliance lead
- [ ] Post-incident review template ready

---

## Testing

Conduct **annual** restore drill (or before live cutover):

1. Restore staging DB to new project  
2. Point staging app at restored project  
3. Verify login + read-only wallet data  

Document results in compliance incident notes.

---

*RTO/RPO are targets for Private Alpha — tighten before live cutover.*
