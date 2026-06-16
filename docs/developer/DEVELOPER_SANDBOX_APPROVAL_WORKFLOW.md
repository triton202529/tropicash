# Developer Sandbox Approval Workflow (Phase 14B)

## Purpose

Phase 14B introduces a **controlled onboarding and approval workflow** for external developers requesting access to the Tropicash Sandbox.

This phase provides application review, approval tracking, and sandbox access governance only. It does **not**:

- Enable production access
- Issue live API credentials automatically
- Create OAuth clients automatically
- Grant wallet access or money movement capabilities

## Application model

**Table:** `developer_sandbox_applications`

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | Primary key |
| `user_id` | uuid | Applicant (auth.users) |
| `organization_name` | text | Required |
| `developer_name` | text | Required |
| `email` | text | Required |
| `website` | text | Optional |
| `country` | text | Required |
| `use_case` | text | Required |
| `requested_capabilities` | text[] | Allowed capability ids |
| `status` | text | Default `pending` |
| `review_notes` | text | Admin only |
| `created_at` | timestamptz | Submission time |
| `reviewed_at` | timestamptz | Last review time |
| `reviewed_by` | uuid | Reviewing admin |

## Status model

| Status | Meaning |
|--------|---------|
| `pending` | Default after submission |
| `under_review` | Admin is reviewing |
| `approved` | Sandbox access authorized (governance record only) |
| `rejected` | Application denied |

Only admins can change status. Applicants cannot approve themselves.

## Requested capabilities

**Allowed:**

- `platform_status`
- `supported_currencies`
- `oauth_profile`
- `oauth_wallet_sandbox`

**Not available (rejected if submitted):**

- `send_money`
- `withdrawals`
- `payments_create`
- `production_access`

## RLS summary

| Role | INSERT | SELECT | UPDATE |
|------|--------|--------|--------|
| Authenticated applicant | Own `user_id` only | Own rows only | None |
| Admin | — | All rows | Status + review fields |
| Anonymous | None | None | None |

No public access to application rows.

## Public application flow

**Route:** `/developers/apply`

1. User signs in
2. Completes application form
3. Selects requested sandbox capabilities
4. Submits → status `pending`
5. Sees confirmation: no credentials issued

## Admin review flow

**Route:** `/admin/developer-sandbox-applications`

1. View all applications
2. Add review notes
3. Move to `under_review`, `approved`, or `rejected`
4. System records `reviewed_by` and `reviewed_at`

**Important:** Approval does not create API keys or OAuth clients. Credential issuance remains a separate developer action in the Developer Console.

## Security

- Sandbox only
- No production approval path
- No automatic credential generation
- No wallet mutation or money movement
- No secrets stored in application records

## Module reference

- `lib/developerSandboxApplications.js`
- `supabase/sql/developer_sandbox_applications_phase14b.sql`
