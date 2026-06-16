# Developer Sandbox Agreement Policy (Phase 14D)

## Purpose

Phase 14D adds a legal acceptance and immutable audit layer. **Developer approval alone is not sufficient** to use sandbox capabilities.

Full access requires:

1. **Approved developer** (Phase 14B application status = `approved`)
2. **Approved capability** (matching requested capability)
3. **Sandbox agreement accepted** (current version)

## Agreement model

Table: `developer_sandbox_agreements`

| Field | Description |
|-------|-------------|
| `user_id` | Developer who accepted |
| `application_id` | Linked approved application |
| `agreement_version` | e.g. `v1.0` |
| `accepted_at` | Acceptance timestamp |
| `accepted_ip` | Client-reported IP (audit) |
| `accepted_user_agent` | Browser user agent (audit) |

One record per user per version. History is **immutable** (no UPDATE/DELETE).

Current required version: **v1.0**

## Agreement content

Developers must acknowledge:

- **Sandbox only** — testing only; production unavailable
- **No money movement** — send, withdrawals, payments unavailable
- **Security responsibilities** — protect credentials and secrets
- **Platform rules** — no abuse, bypassing controls, or unauthorized access

## Enforcement

Before sandbox API credential or OAuth client creation:

```
hasAcceptedSandboxAgreement(userId)
```

Failure:

```json
{
  "ok": false,
  "error": "sandbox_agreement_required"
}
```

Enforced server-side in `lib/developerSandboxAccessPolicy.js`.

## Developer flow

**Route:** `/developers/sandbox-agreement`

- Login required
- Approved application required
- Display current version and acknowledgements
- Checkbox + Accept button
- Prevents duplicate acceptance of same version

## Admin audit

**Route:** `/admin/developer-sandbox-agreements`

Read-only view: developer, organization, version, timestamp, IP, user agent.

Filters: version, date range, developer search.

## Security

- Server-side validation only
- Immutable audit trail
- No production access
- No money movement
- No new API capabilities or OAuth scope expansion

## Module reference

- `lib/developerSandboxAgreements.js` — agreement helpers
- `lib/developerSandboxAccessPolicy.js` — combined enforcement (14C + 14D)
- `supabase/sql/developer_sandbox_agreements_phase14d.sql` — migration
