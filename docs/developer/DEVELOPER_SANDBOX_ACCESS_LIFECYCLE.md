# Developer Sandbox Access Lifecycle (Phase 14E)

## Purpose

Phase 14E introduces explicit lifecycle control for approved developers. **Approval + agreement does not automatically activate sandbox access.**

Full resource creation requires:

1. Approved application (Phase 14B)
2. Accepted current agreement (Phase 14D)
3. **ACTIVE** lifecycle status (Phase 14E)

## Lifecycle states

```
PENDING_ACTIVATION → ACTIVE → SUSPENDED → EXPIRED → REVOKED
```

| Status | Meaning |
|--------|---------|
| `pending_activation` | Record created; awaiting admin activation |
| `active` | Sandbox access enabled |
| `suspended` | Temporarily blocked (security, abuse, investigation) |
| `expired` | Access period ended; reactivation required |
| `revoked` | Permanent removal; history preserved |

## Activation rules

Admin activation requires:

- Approved sandbox application
- Accepted current agreement version
- Explicit admin action with reason

Activation is **never automatic**.

## Suspension

Admin may suspend for security concerns, policy violations, abuse, or investigation.

Suspension immediately blocks:

- API credential creation
- OAuth client creation

Existing credentials are **not** automatically deleted.

## Expiration

Optional `expires_at` on activation. When past due, access is treated as expired for enforcement even until explicitly transitioned.

## Revocation

Permanent. Audit history is preserved. No record deletion.

## Enforcement

Server-side check in `lib/developerSandboxAccessPolicy.js`:

```
requireSandboxAccessActive(userId)
```

Failure code: `sandbox_access_not_active`

## Admin dashboard

**Route:** `/admin/developer-sandbox-access`

Actions: Activate, Suspend, Expire, Revoke — all require reason and admin identity. Status transitions are logged to `developer_sandbox_access_status_history`.

## Modules

- `lib/developerSandboxAccessLifecycle.js` — lifecycle engine
- `lib/developerSandboxAccessPolicy.js` — combined enforcement
- `supabase/sql/developer_sandbox_access_lifecycle_phase14e.sql` — migration
