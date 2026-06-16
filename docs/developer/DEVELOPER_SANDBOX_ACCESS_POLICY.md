# Developer Sandbox Access Policy (Phase 14C)

## Purpose

Phase 14C introduces the **enforcement layer** that makes developer sandbox approval meaningful. Only approved developers with the correct capabilities can create controlled sandbox resources.

This phase does **not** enable production access, automatic API credentials, OAuth permission expansion, or money movement.

## Approval rules

A developer is **approved** only when:

1. A `developer_sandbox_applications` row exists
2. Application `status` = `approved`
3. The requested capability is included in `requested_capabilities`

## Allowed capabilities

| ID | Resource |
|----|----------|
| `platform_status` | Developer API credentials / platform status |
| `supported_currencies` | Supported currencies API |
| `oauth_profile` | OAuth client creation (profile scope path) |
| `oauth_wallet_sandbox` | OAuth client creation (wallet sandbox path) |

## Hard-blocked capabilities

Never available, even if requested:

- `send_money`
- `withdrawals`
- `payments_create`
- `production_access`

## Enforcement points

### API credentials (`lib/developerCredentials.js`)

Before `createApiCredential()`:

```
requireDeveloperSandboxCapability(userId, 'platform_status')
```

Failure → error code `sandbox_access_not_approved`

### OAuth clients (`lib/oauthClients.js`)

Before `createOAuthClient()`:

```
requireOAuthSandboxAccess(userId)
```

Requires approved application with `oauth_profile` **or** `oauth_wallet_sandbox`.

Failure → error code `sandbox_access_not_approved`

## Developer Console UX

`/dev-console/credentials` and `/dev-console/oauth-clients` display:

| Status | Badge |
|--------|-------|
| Approved | ✓ Sandbox Approved |
| Pending | ⏳ Pending Review |
| Rejected | ✗ Access Not Approved |
| No application | ⚠ Application Required |

UI restrictions are informational. **Server-side enforcement is authoritative.**

## Admin visibility

**Route:** `/admin/developer-sandbox-access-policy`

Read-only analytics: application counts, capability distribution, per-developer approval status.

Approval actions remain at `/admin/developer-sandbox-applications`.

## Security model

- Server-side enforcement on credential and OAuth client creation
- Approval does not create credentials or OAuth clients
- No production credential path
- No wallet mutation or money movement

## Module reference

- `lib/developerSandboxAccessPolicy.js` — central policy module
- `lib/developerSandboxApplications.js` — application data (Phase 14B)
