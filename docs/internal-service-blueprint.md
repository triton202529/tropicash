# Tropicash — Internal Platform Service Blueprint

> **Status:** Phase 1.75 — planning-only documentation. **No internal APIs,
> service tokens, or secrets exist yet.** This document defines the
> architecture, namespaces, event catalog, idempotency contracts, and safety
> rules that future internal Blue Atlantic integrations must follow.
>
> Treasury, wallet ledger, withdrawal payout, PayPal funding, and fraud-engine
> logic are owned by the Treasury workstream and are **not** modified by this
> document.

This file is the canonical narrative for the **internal** Tropicash platform
layer. The machine-readable form of everything below lives in
`lib/internalPlatformConfig.js`. The companion architecture overview
(`docs/internal-platform-architecture.md`) describes the three-layer
separation at a higher level.

When the contents below change, keep the config and the architecture overview
in sync in the same PR.

---

## A. Purpose

Tropicash is becoming the **financial infrastructure layer for the Blue
Atlantic platform family** — Tropicash itself, Triton, Sentinel, and
EliteHire Pro. Before any public developer APIs ship, we need a clean
internal architecture so that:

- Internal services have well-named, well-bounded responsibilities.
- Blue Atlantic platforms integrate through documented capabilities, not
  ad-hoc database access.
- Money movement is auditable, idempotent, and fraud-aware end to end.
- Public APIs can be added later as a thin, auth-gated edge over an
  already-stable internal core.

---

## B. Internal vs External API Boundary

The Tropicash developer ecosystem has three deliberately separated layers:

1. **Public Developer Portal** (`/developers/*`)
   - Anonymous-accessible marketing, docs, pricing, roadmap, status, and the
     access request form.
   - Reads from `lib/developerCenterConfig.js`.
2. **Authenticated Developer Console** (`/dev-console/*`)
   - Supabase-session-gated infrastructure UI (apps, API keys, webhooks,
     logs, sandbox, settings, internal blueprint).
   - Future home of API key issuance and per-app management.
3. **Internal Blue Atlantic Services** (this document)
   - Private, non-public service surfaces that power Tropicash + Blue
     Atlantic integrations.
   - **Never** addressable from `api.tropicash.com` or any anonymous
     Developer Center route.

```
External traffic
        │
        ▼
┌────────────────────────────┐
│   Public Developer APIs    │  ⟵ api.tropicash.com (future)
│ (auth, rate-limit, scopes) │
└──────────────┬─────────────┘
               │
               ▼
┌────────────────────────────┐
│ Internal platform edge     │  ⟵ owned by Tropicash
│ (svc auth, allowlists)     │
└──────────────┬─────────────┘
               │
   ┌───────────┴────────────┬─────────────────┬─────────────────┐
   ▼                        ▼                 ▼                 ▼
internal.wallets       internal.payments  internal.payouts  internal.treasury
internal.fraud         internal.notifications
internal.triton  internal.sentinel  internal.elitehire
```

---

## C. Internal Service Namespaces

Logical service domains. **These are not HTTP routes yet** — they are
naming conventions that future internal calls will be organized under
(e.g. `internal.wallets.get_balance`). Each namespace has a stated purpose,
planned responsibilities, and an explicit *must-not-yet* list.

| Namespace                | Purpose                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `internal.wallets`       | Wallet identity, ledger entries, balance reads, wallet lifecycle events.                      |
| `internal.payments`      | Inbound money movement and routing to wallets.                                                |
| `internal.payouts`       | Outbound money movement to supported destinations.                                            |
| `internal.treasury`      | Reserved for treasury reconciliation / settlement. **Owned by Treasury workstream.**          |
| `internal.fraud`         | Reserved for the fraud-engine integration surface. **Decisions owned by existing engine.**    |
| `internal.notifications` | In-app, email, push notification fan-out.                                                     |
| `internal.triton`        | Triton funding / withdrawal bridge connector.                                                 |
| `internal.sentinel`      | One-way reporting feed into Sentinel.                                                         |
| `internal.elitehire`     | EliteHire Pro employer / contractor / subscription payment connector.                         |

Each namespace declares its planned responsibilities and what it must NOT
do yet (see `INTERNAL_SERVICE_NAMESPACES` in
`lib/internalPlatformConfig.js`). The two recurring "must-not-yet" rules
across every namespace are:

1. **Do not be addressable from external developer apps.**
2. **Do not mutate balances without an idempotency key.**

`internal.treasury` and `internal.fraud` add a third rule: **do not be
modified by this Developer Center workstream.**

---

## D. Internal Integration Map

Capabilities, not endpoints. Names, schemas, and timing will be finalized
before any consumer relies on them.

### Tropicash ↔ Triton

- Fund trading account
- Withdraw profits
- Check wallet liquidity
- Reserve trading capital
- Sync trade funding records

**Rules:**

- Triton-side movements emit `integration.triton_*` events. Tropicash does
  not poll Triton's database.
- The wallet ledger remains the source of truth — Triton may request
  movement but cannot shadow-store balance state.
- Every money-moving Triton request must carry an idempotency key.

### Tropicash ↔ Sentinel

- Sync transaction events
- Export ledger records
- Treasury reporting
- Statements / accounting summaries
- Reconciliation feeds

**Rules:**

- One-way. Sentinel reads from Tropicash; **Sentinel never writes back to
  the wallet ledger.**
- Sentinel consumes the same event envelope as external webhooks (see §F)
  over an internal channel.

### Tropicash ↔ EliteHire Pro

- Employer payments
- Job posting payments
- Contractor payouts
- Future escrow
- Subscriptions

**Rules:**

- EliteHire Pro is a **trusted internal client**, not an external developer.
- Trust does not waive auth/scopes — it still passes through the internal
  edge layer, so the same permission model can later be reused for external
  merchants.

---

## E. Internal Event Catalog

Six event families. Names below are directional; final naming + payload
schemas will be confirmed before any consumer depends on them.

### `wallet.*`
- `wallet.created`
- `wallet.funded`
- `wallet.debited`
- `wallet.credited`
- `wallet.balance_adjusted`

### `payment.*`
- `payment.created`
- `payment.completed`
- `payment.failed`
- `payment.refunded`

### `payout.*`
- `payout.requested`
- `payout.processing`
- `payout.completed`
- `payout.failed`
- `payout.rejected`

### `fraud.*`
- `fraud.flagged`
- `fraud.reviewed`
- `fraud.escalated`
- `fraud.cleared`

### `developer.*`
- `developer.access_requested`
- `developer.app_created`
- `developer.api_key_created`
- `developer.api_key_revoked`

### `integration.*`
- `integration.triton_transfer_requested`
- `integration.triton_transfer_completed`
- `integration.sentinel_sync_completed`
- `integration.elitehire_payment_completed`

Rules that apply to all events:

- Each event has exactly one **system of record** that produces it.
- Consumers must treat events as **idempotent** and re-deliverable.
- Sandbox events are emitted only to sandbox consumers; live events only to
  live consumers. **No cross-env fan-out.**

---

## F. Standard Event Payload Shape

The internal event envelope is uniform across families. The example below
uses placeholder values — no real IDs, secrets, or PII appear here.

```json
{
  "event_id": "uuid",
  "event_type": "wallet.funded",
  "environment": "sandbox",
  "source": "tropicash",
  "occurred_at": "ISO timestamp",
  "actor": {
    "type": "user|admin|system|service",
    "id": "uuid-or-service-name"
  },
  "subject": {
    "type": "wallet|payment|payout|integration",
    "id": "uuid"
  },
  "amount": {
    "value": 100.00,
    "currency": "USD"
  },
  "metadata": {}
}
```

Envelope rules:

- `event_id` is **required** for every event — see §J safety rule 6.
- `environment` is **required**. Producers must never emit an event with an
  ambiguous environment.
- `actor.type` ∈ `{user, admin, system, service}`.
- `subject.type` ∈ `{wallet, payment, payout, integration}`.
- `amount` is omitted entirely for non-money events; do not emit `null`
  amounts on money events.
- `metadata` **must never** contain secrets, auth tokens, or raw PII beyond
  what is strictly necessary for downstream processing.

---

## G. Internal Auth Model — Future Only

**No internal service-to-service auth implementation exists yet.** The
options below are planning-only references:

- **Service-to-service tokens** issued to internal services (never to
  external developers).
- **HMAC request signing** with per-service secrets.
- **Scoped internal service permissions**, least-privilege per namespace
  (e.g. `internal.payouts:write` ≠ `internal.wallets:write`).
- **Allowlisted service identities** at the platform edge.
- **Audit logs for every internal call**, including caller identity, target
  namespace, request hash, and outcome.

Whichever combination is chosen, internal auth **must not** leak into the
public developer surface, and **must not** be addressable from anonymous
traffic.

---

## H. Idempotency Rules

Every money-moving request must be safely retryable.

**Required for:**

- Payments
- Payouts
- Wallet adjustments
- Triton transfers

**Rules:**

1. Every money-moving request must support an `idempotency_key`.
2. Duplicate idempotency keys must return the **original result**, not a
   new one. Same key → same outcome → same response body.
3. Idempotency keys are scoped per developer app and per environment.
   The same key value in sandbox vs live is **two different keys**.
4. Request logs must store `idempotency_key`, `request_hash`, and
   `response_status` so we can audit retries and detect mismatch attacks
   (same key, different payload).

---

## I. Environment Rules

Two environments. Strict isolation.

### Sandbox

- Never moves real money.
- Sandbox API keys cannot call live endpoints.
- Sandbox data must be visibly distinguishable from live data
  (UI badges, identifier prefixes, separate request logs).
- Future migration may move sandbox to an isolated Supabase project or
  schema. Plan for that from day one.

### Live

- Requires admin / platform approval before access is granted.
- Live API keys cannot call sandbox endpoints.
- Live event traffic must be reconcilable against the wallet ledger.
- Subject to all production safety + audit controls.

### Shared

- **No cross-environment API key usage**, ever.
- **Sandbox and live data must be distinguishable** at every layer
  (events, logs, console, webhooks).
- **Sandbox never reaches the live wallet ledger, payout pipeline, or
  treasury bridge.**

---

## J. Non-Negotiable Safety Rules

Any change to the developer platform or Blue Atlantic integration layer
must respect these.

1. **Wallet ledger remains source of truth.**
2. **Treasury systems remain isolated.**
3. **Internal services are never public.**
4. **Public APIs must pass through the auth/rate-limit layer.**
5. **Every money movement must be auditable.**
6. **Every event must have an `event_id`.**
7. **No secret keys in frontend.**
8. **Fraud checks must remain in the decision path.**
9. **Blue Atlantic internal integrations must not bypass wallet/ledger
   controls.**
10. **External developers must never access internal service routes.**

---

## What this document does **not** do

- It does **not** create internal or public APIs.
- It does **not** issue API keys, service tokens, or signing secrets.
- It does **not** modify treasury, wallet ledger, withdrawal, PayPal
  funding, or fraud-engine logic.
- It does **not** add SQL migrations or runtime code paths.

The Developer Center workstream stays on its own rails. Treasury, wallet,
payout, PayPal, and fraud subsystems remain owned and operated by their
existing maintainers.

---

## Phase 2A — Internal Service Registry

> **Status:** governance + schema + UI shell only. **No internal APIs, money
> movement, service tokens, or secrets are created.** Treasury, wallet,
> withdrawal, PayPal funding, and fraud subsystems are untouched.

Phase 2A introduces the **identity / governance layer** for internal Blue
Atlantic integrations before any real APIs exist. It gives Tropicash a place
to declare *which* integrations are planned, *what* permissions they would
require, and *how* their future calls will be audited — all without any
runtime behavior attached.

### Purpose

Before Tropicash exposes public APIs or wires Triton/Sentinel/EliteHire Pro
into real money movement, we need:

- A canonical list of planned internal integrations (the **registry**).
- A canonical list of planned permissions per integration, each with a
  **risk level**.
- A canonical **audit log shape** so that, when execution finally lands,
  every internal call is recorded against a known integration identity.

### Tables (see `supabase/sql/internal_service_registry_phase2a.sql`)

1. **`internal_service_integrations`** — one row per planned integration
   (e.g. `triton`, `sentinel`, `elitehire_pro`). Tracks `service_key`,
   `service_name`, `platform`, `environment` (sandbox | live), `status`
   (planning | inactive | active | suspended | retired), description, and
   an owner label.
2. **`internal_service_permissions`** — one row per planned permission per
   integration. Tracks `permission_key`, `permission_label`, `description`,
   and `risk_level` (low | medium | high | critical). Uniqueness is
   enforced on `(integration_id, permission_key)`.
3. **`internal_service_audit_logs`** — append-only audit log shape for
   future internal calls. Tracks `service_key`, `environment`,
   `event_type`, `request_id`, `idempotency_key`, `status` (recorded |
   allowed | blocked | failed), and a free-form `metadata` JSONB.
   **Phase 2A leaves this table empty** — the schema exists so that, when
   execution lands, every call has a place to be audited from day one.

All three tables have **RLS enabled and admin-only policies** via
`public.tc_is_admin()`. No anonymous or non-admin access.

### Seeded services

Phase 2A seeds three integrations, all in `environment = 'sandbox'` and
`status = 'planning'`:

| `service_key`   | `platform`     | Description                                                                                  |
| --------------- | -------------- | -------------------------------------------------------------------------------------------- |
| `triton`        | Triton         | Funding & withdrawal bridge: fund trading accounts, withdraw profits, sync trade funding.    |
| `sentinel`      | Sentinel       | One-way reporting feed: transaction events, ledger exports, statements, reconciliation.      |
| `elitehire_pro` | EliteHire Pro  | Employer payments, job posting payments, contractor payouts, future escrow, subscriptions.   |

### Seeded permissions

Permissions are planned, not enforced. Risk levels follow the model below.

**Triton**

| `permission_key`            | Risk      |
| --------------------------- | --------- |
| `wallet.read`               | low       |
| `trading_funding.reserve`   | high      |
| `trading_funding.release`   | medium    |
| `trading_profit.withdraw`   | critical  |
| `treasury.read_summary`     | medium    |

**Sentinel**

| `permission_key`            | Risk      |
| --------------------------- | --------- |
| `ledger.export`             | medium    |
| `transaction.read`          | low       |
| `treasury.read_summary`     | medium    |
| `statement.generate`        | low       |
| `reconciliation.read`       | low       |

**EliteHire Pro**

| `permission_key`            | Risk      |
| --------------------------- | --------- |
| `payment.create`            | medium    |
| `payment.read`              | low       |
| `payout.create`             | high      |
| `subscription.create`       | medium    |
| `escrow.plan`               | medium    |

### Risk level model

| Risk      | Meaning                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------ |
| low       | Read-only or non-monetary. Default classification.                                                     |
| medium    | Sensitive read or low-magnitude write. Requires audit logging.                                         |
| high      | Money-moving or balance-affecting. Requires idempotency, audit, and fraud review.                      |
| critical  | Highest-risk monetary scope. Requires explicit per-call approval and elevated audit.                   |

`high` and `critical` permissions cannot be exercised at all in Phase 2A —
they exist in the registry as future contract surface, nothing more.

### Audit log model

Even though no rows are written yet, the schema deliberately includes
fields the platform will need from day one:

- `integration_id` — links the audit row back to a known service identity.
- `service_key` — denormalized for fast queries even if an integration is
  later deleted (FK is `ON DELETE SET NULL`).
- `environment` — sandbox / live, mirroring the integration row.
- `event_type` — the planned event from the
  [event catalog](#e-internal-event-catalog).
- `request_id` + `idempotency_key` — required for retry / replay
  reconciliation.
- `status` — recorded | allowed | blocked | failed. Captures both the call
  itself and the future auth-layer decision.
- `metadata` — JSONB. **Must never** contain secrets, auth tokens, or
  unnecessary PII.

### No execution yet

Phase 2A is **registry-only**:

- No API routes are created.
- No service tokens, signing secrets, or API keys are issued.
- No money is moved.
- The Developer Console page at
  `pages/dev-console/internal-services.jsx` renders entirely from
  `lib/internalServiceRegistryConfig.js` — it does **not** query Supabase.
- Treasury, wallet ledger, withdrawal payout, PayPal funding, and the
  fraud engine are untouched.

Promotion of any integration from `planning` to `active` requires Phase 2B:
the internal auth model, key management, and request-time enforcement.

---

## Phase 2B — Integration Lifecycle & Runtime Governance

> **Status:** governance + schema + UI shell only. **No internal APIs,
> money movement, enforcement code paths, service tokens, or secrets are
> created.** Treasury, wallet, withdrawal, PayPal funding, and fraud
> subsystems are untouched.

Phase 2B layers an **operational governance** model on top of the Phase 2A
Internal Service Registry. Where Phase 2A defined *which* integrations
exist and *what* permissions they could ask for, Phase 2B defines *how* an
integration moves from `planning` to `live` and *which* runtime constraints
apply once it does.

It introduces three concepts, each backed by an admin-only table:

1. **Lifecycle reviews** — approval records for any status transition.
2. **Runtime policies** — per-environment runtime constraints (limits,
   required checks). All seeded as `planned`; nothing enforces yet.
3. **Environment gates** — readiness checks per environment, with explicit
   `required_for_live` markers.

### Tables (see [`supabase/sql/internal_service_governance_phase2b.sql`](../supabase/sql/internal_service_governance_phase2b.sql))

#### `internal_service_lifecycle_reviews`

Approval workflow for lifecycle transitions. Every promotion or demotion
between Phase 2A statuses (`planning | inactive | active | suspended |
retired`) must produce a row here.

| Column                 | Notes                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `integration_id`       | FK to `internal_service_integrations` (cascade delete).                                                     |
| `service_key`          | Denormalized for audit-friendly queries.                                                                    |
| `requested_environment`| `sandbox | live`.                                                                                           |
| `current_status`       | Lifecycle status when the review was opened.                                                                |
| `requested_status`     | Lifecycle status being requested.                                                                           |
| `review_status`        | `pending | approved | rejected | cancelled`.                                                                |
| `risk_level`           | `low | medium | high | critical`. Drives reviewer routing.                                                  |
| `requested_by`         | uuid of submitter.                                                                                          |
| `reviewed_by`          | uuid of reviewer.                                                                                           |
| `request_reason`       | free-form text.                                                                                             |
| `review_note`          | free-form text.                                                                                             |
| `reviewed_at`          | timestamptz, null until decided.                                                                            |

**Rule:** Approving a review here does **not** mutate the registry row.
The registry remains the source of truth; lifecycle reviews are the audit
trail that authorizes a *future* registry mutation.

#### `internal_service_runtime_policies`

Per-environment runtime constraints. Phase 2B seeds every policy with
`enforcement_status = 'planned'` — nothing executes yet.

| Column               | Notes                                                                              |
| -------------------- | ---------------------------------------------------------------------------------- |
| `integration_id`     | FK to `internal_service_integrations` (cascade delete).                            |
| `service_key`        | Denormalized.                                                                      |
| `environment`        | `sandbox | live`. Independent rows; promoting sandbox does NOT promote live.       |
| `policy_key`         | Stable, lowercase identifier (e.g. `requires_idempotency`).                        |
| `policy_label`       | Human-readable label.                                                              |
| `policy_value`       | JSONB. Must not contain secrets, tokens, or unnecessary PII.                       |
| `risk_level`         | `low | medium | high | critical`.                                                  |
| `enforcement_status` | `planned | monitor_only | enforced | disabled`.                                    |
| `description`        | free-form text.                                                                    |

Uniqueness: `(integration_id, environment, policy_key)`.

#### `internal_service_environment_gates`

Per-environment readiness checks. Sandbox gates start as `passed` (because
Phase 2A delivered the registry). Live gates start as `blocked` and are
marked `required_for_live = true`.

| Column             | Notes                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| `integration_id`   | FK to `internal_service_integrations` (cascade delete).                              |
| `service_key`      | Denormalized.                                                                        |
| `environment`      | `sandbox | live`.                                                                    |
| `gate_key`         | Stable, lowercase identifier (e.g. `treasury_review`).                               |
| `gate_label`       | Human-readable label.                                                                |
| `gate_status`      | `blocked | pending_review | passed | waived`.                                        |
| `required_for_live`| boolean. When true, must be `passed` or `waived` before live promotion.              |
| `description`      | free-form text.                                                                      |

Uniqueness: `(integration_id, environment, gate_key)`.

All three tables have **RLS enabled and admin-only policies** via
`public.tc_is_admin()`. The migration explicitly revokes `anon` and
re-grants only to `authenticated` — RLS is the sole gate.

### Lifecycle path

```
planning ──▶ review ──▶ sandbox_active ──▶ live_pending ──▶ live_active
                                                              │
                                              ┌───────────────┘
                                              ▼
                                         suspended ──▶ retired
```

- `planning` — Phase 2A default. No runtime calls allowed.
- `review` — a row exists in `internal_service_lifecycle_reviews` with
  `review_status = 'pending'`.
- `sandbox_active` — sandbox-only permissions may be exercised; live calls
  remain forbidden.
- `live_pending` — live promotion requested; all `required_for_live` gates
  must be `passed` or `waived`.
- `live_active` — live calls permitted under runtime policies.
- `suspended` — temporary block; reversible.
- `retired` — terminal end-of-life; kept for audit.

### Seeded runtime policies (sandbox)

**Triton**

| `policy_key`                 | `policy_value`                                        | Risk      | Enforcement |
| ---------------------------- | ----------------------------------------------------- | --------- | ----------- |
| `max_daily_transfer_amount`  | `{"amount":0,"currency":"USD","note":"Not active yet"}`| critical  | planned     |
| `requires_idempotency`       | `{"required":true}`                                   | high      | planned     |
| `fraud_checks_required`      | `{"required":true}`                                   | high      | planned     |
| `sandbox_only`               | `{"enabled":true}`                                    | medium    | planned     |

**Sentinel**

| `policy_key`             | `policy_value`        | Risk   | Enforcement |
| ------------------------ | --------------------- | ------ | ----------- |
| `export_requires_audit`  | `{"required":true}`   | medium | planned     |
| `no_money_movement`      | `{"required":true}`   | high   | planned     |
| `sandbox_only`           | `{"enabled":true}`    | medium | planned     |

**EliteHire Pro**

| `policy_key`                    | `policy_value`        | Risk   | Enforcement |
| ------------------------------- | --------------------- | ------ | ----------- |
| `payment_requires_idempotency`  | `{"required":true}`   | high   | planned     |
| `payout_requires_review`        | `{"required":true}`   | high   | planned     |
| `escrow_not_active`             | `{"enabled":true}`    | medium | planned     |
| `sandbox_only`                  | `{"enabled":true}`    | medium | planned     |

### Seeded environment gates

**Sandbox (all three services)** — start as `passed` because Phase 2A
delivered the underlying registry / permissions / audit shape.

| `gate_key`            | `gate_status` | `required_for_live` |
| --------------------- | ------------- | ------------------- |
| `registry_created`    | passed        | false               |
| `permissions_defined` | passed        | false               |
| `audit_model_defined` | passed        | false               |

**Live (all three services)** — start as `blocked` and are
`required_for_live = true`.

| `gate_key`         | `gate_status` | `required_for_live` |
| ------------------ | ------------- | ------------------- |
| `treasury_review`  | blocked       | true                |
| `fraud_review`     | blocked       | true                |
| `security_review`  | blocked       | true                |
| `admin_approval`   | blocked       | true                |

### No enforcement yet

Phase 2B is **governance-only**:

- No API routes, no runtime enforcement code paths.
- No service tokens, signing secrets, or API keys.
- No money is moved.
- Approving a `internal_service_lifecycle_reviews` row does **not** mutate
  the registry — promotions are still a manual, audited step.
- Runtime policies seeded as `planned` cannot block calls until promoted
  to `monitor_only` or `enforced` via a review *and* a real enforcement
  implementation.
- The Developer Console page at
  `pages/dev-console/internal-governance.jsx` renders entirely from
  `lib/internalServiceGovernanceConfig.js`. It does **not** query Supabase.
- Treasury, wallet ledger, withdrawal payout, PayPal funding, and the
  fraud engine are untouched.

Promotion from `planning` to `sandbox_active` to `live_active` requires
Phase 2C+: the actual enforcement code path, key management, and per-call
runtime evaluation.

---

## Phase 2C — Capability & Operational Constraints Registry

**Phase key**: `phase_2c_capabilities`
**Schema**: `supabase/sql/internal_capability_registry_phase2c.sql`
**Config**: `lib/internalCapabilityConfig.js`
**UI**: `pages/dev-console/capabilities.jsx` (admin-only shell)

### Purpose

Phase 2A defined *who* (the integrations) and *what scopes* (permissions).
Phase 2B defined *how the integration moves through its lifecycle*.
Phase 2C defines the **capability primitives** that every future
integration, API, runtime policy, and permission will reference.

Capabilities are deliberately **definitions, not endpoints**. A
capability has no runtime behavior until a real enforcement path is
shipped — Phase 2C adds the model, not the engine.

### Capability table

`internal_capabilities` — one row per reusable capability.

| Column             | Notes                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- |
| `capability_key`   | Stable lowercase identifier (e.g. `payment.create`). Unique.                           |
| `capability_label` | Human-readable label.                                                                  |
| `category`         | ∈ {`wallet`, `payments`, `payouts`, `treasury`, `ledger`, `reporting`, `trading`, `developer`, `admin`, `fraud`, `notifications`} |
| `risk_level`       | ∈ {`low`, `medium`, `high`, `critical`}.                                               |
| `lifecycle_status` | ∈ {`planning`, `defined`, `review`, `sandbox_ready`, `live_ready`, `deprecated`, `retired`}. Phase 2C seeds all rows as `defined`. |
| `supports_sandbox` | Design-time intent. Phase 2C seeds all rows as `true`.                                 |
| `supports_live`    | Design-time intent. Phase 2C seeds all rows as `false` — promotion requires Phase 2B governance review. |

### Dependency table

`internal_capability_dependencies` — directed `(capability → dependency)`
edges. Multiple types per pair are allowed because the unique key is
`(capability_key, dependency_key, dependency_type)`.

| `dependency_type` | Meaning                                                                       |
| ----------------- | ----------------------------------------------------------------------------- |
| `requires`        | Hard prerequisite. Caller must hold the dependency.                           |
| `recommends`      | Soft suggestion. Not enforced.                                                |
| `blocks_without`  | Invocation is blocked when dependency has not been exercised.                 |
| `audit_requires`  | Dependency must be invoked downstream for audit completeness (e.g. ledger).   |

### Constraint table

`internal_capability_constraints` — per-environment operational
constraints. Sandbox and live rows are independent so promotion is
explicit.

| Column               | Notes                                                                       |
| -------------------- | --------------------------------------------------------------------------- |
| `constraint_key`     | Stable lowercase identifier (e.g. `max_transaction_amount`).                |
| `constraint_label`   | Human-readable label.                                                       |
| `constraint_value`   | JSONB payload (limits, flags). Must never contain secrets or PII.           |
| `environment`        | ∈ {`sandbox`, `live`}. Unique with `(capability_key, constraint_key)`.      |
| `risk_level`         | ∈ {`low`, `medium`, `high`, `critical`}.                                    |
| `enforcement_status` | ∈ {`planned`, `monitor_only`, `enforced`, `disabled`}. Phase 2C seeds all rows as `planned`. |

### Capability categories

| Category        | Purpose                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| `wallet`        | Reads and reservations against the wallet ledger. Ledger remains source of truth. |
| `payments`      | Inbound payment intents (create / capture / refund). Money-moving.          |
| `payouts`       | Outbound payout flows (request / approve / release). Highest-risk direction. |
| `treasury`      | Treasury liquidity reads and reservations.                                  |
| `ledger`        | Read-only ledger exports and statement generation.                          |
| `reporting`     | Aggregated, derived reporting feeds (Sentinel, admin dashboards).           |
| `trading`       | Trading-side capital movement (Triton). Sandbox-only by default.            |
| `developer`     | Capabilities consumed by external developer apps via the public auth layer. |
| `admin`         | Admin-only operational capabilities (gated by `tc_is_admin`).               |
| `fraud`         | Fraud-engine dependency markers (e.g. `fraud.review_required`).             |
| `notifications` | Non-monetary in-app / email / push messages.                                |

### Seeded capabilities

All rows are `lifecycle_status='defined'`, `supports_sandbox=true`,
`supports_live=false`.

| `capability_key`            | Category        | Risk     |
| --------------------------- | --------------- | -------- |
| `wallet.read`               | wallet          | low      |
| `wallet.reserve`            | wallet          | high     |
| `wallet.release`            | wallet          | medium   |
| `wallet.balance_adjust`     | wallet          | critical |
| `payment.create`            | payments        | medium   |
| `payment.capture`           | payments        | high     |
| `payment.refund`            | payments        | high     |
| `payout.request`            | payouts         | medium   |
| `payout.approve`            | payouts         | high     |
| `payout.release`            | payouts         | critical |
| `treasury.read_summary`     | treasury        | medium   |
| `treasury.reserve_funds`    | treasury        | high     |
| `ledger.export`             | ledger          | medium   |
| `ledger.statement_generate` | ledger          | low      |
| `trading.funding_reserve`   | trading         | high     |
| `trading.profit_withdraw`   | trading         | critical |
| `fraud.review_required`     | fraud           | high     |
| `developer.webhook_manage`  | developer       | medium   |
| `notification.send`         | notifications   | low      |

### Seeded dependencies

| `capability_key`          | `dependency_type` | `dependency_key`         |
| ------------------------- | ----------------- | ------------------------ |
| `payment.create`          | requires          | `wallet.read`            |
| `payment.create`          | requires          | `fraud.review_required`  |
| `payment.capture`         | requires          | `payment.create`         |
| `payment.refund`          | requires          | `payment.capture`        |
| `payment.refund`          | audit_requires    | `ledger.export`          |
| `payout.release`          | requires          | `payout.approve`         |
| `payout.release`          | requires          | `fraud.review_required`  |
| `payout.release`          | blocks_without    | `treasury.reserve_funds` |
| `trading.profit_withdraw` | requires          | `wallet.read`            |
| `trading.profit_withdraw` | requires          | `fraud.review_required`  |
| `trading.profit_withdraw` | audit_requires    | `ledger.export`          |

### Seeded constraints

| `capability_key`          | `constraint_key`             | `environment` | `constraint_value`                                       | Risk     | Enforcement |
| ------------------------- | ---------------------------- | ------------- | -------------------------------------------------------- | -------- | ----------- |
| `payment.create`          | `max_transaction_amount`     | sandbox       | `{"amount":1000,"currency":"USD"}`                       | critical | planned     |
| `payment.create`          | `max_transaction_amount`     | live          | `{"amount":0,"currency":"USD","note":"Not approved"}`    | critical | planned     |
| `payment.create`          | `requires_idempotency`       | sandbox       | `{"required":true}`                                      | high     | planned     |
| `payment.create`          | `requires_idempotency`       | live          | `{"required":true}`                                      | high     | planned     |
| `payout.release`          | `requires_manual_review`     | sandbox       | `{"required":true}`                                      | high     | planned     |
| `payout.release`          | `requires_manual_review`     | live          | `{"required":true}`                                      | high     | planned     |
| `payout.release`          | `requires_treasury_approval` | sandbox       | `{"required":true}`                                      | critical | planned     |
| `payout.release`          | `requires_treasury_approval` | live          | `{"required":true}`                                      | critical | planned     |
| `trading.profit_withdraw` | `sandbox_only`               | sandbox       | `{"enabled":true}`                                       | critical | planned     |
| `trading.profit_withdraw` | `sandbox_only`               | live          | `{"enabled":true,"blocks_in_live":true}`                 | critical | planned     |

### Sandbox / live compatibility

Every Phase 2C seed defaults to **sandbox-eligible, live-ineligible**.

- `supports_sandbox=true` means the capability *could* run in sandbox once
  an enforcement path is shipped — it does **not** mean it runs today.
- `supports_live=false` is the conservative default. Promotion is a Phase
  2B governance event (lifecycle review + required-for-live gates).
- Sandbox and live constraints are stored as separate rows so a sandbox
  promotion never accidentally promotes live.

### No enforcement yet

Phase 2C is **registry-only**:

- No API routes, no runtime enforcement code paths.
- No service tokens, signing secrets, or API keys.
- No money is moved.
- No mutation of treasury, wallet ledger, withdrawal payout, PayPal
  funding, or fraud-engine logic.
- The Developer Console page at `pages/dev-console/capabilities.jsx`
  renders entirely from `lib/internalCapabilityConfig.js`. It does **not**
  query Supabase.
- Constraints seeded as `enforcement_status='planned'` cannot block calls
  until promoted to `monitor_only` or `enforced` via a Phase 2B-style
  review *and* a real enforcement implementation.

Phase 2D+ (out of scope for this phase) will deliver the runtime
evaluator that turns capability + dependency + constraint rows into
actual decision-path behavior.

---

## Cross-references

- `lib/internalPlatformConfig.js` — machine-readable form of every section
  above (namespaces, integrations, events, env rules, safety rules).
- `lib/internalServiceRegistryConfig.js` — Phase 2A registry/permissions/risk
  data, mirrored from the SQL migration.
- `lib/internalServiceGovernanceConfig.js` — Phase 2B lifecycle path,
  enforcement/gate statuses, policy + gate seeds, governance safety rules.
- `lib/internalCapabilityConfig.js` — Phase 2C capability categories,
  risk/lifecycle/dependency types, seeded capabilities/dependencies/
  constraints, capability safety rules.
- `lib/developerCenterConfig.js` — public Developer Portal and Developer
  Console route metadata; phase labels.
- `docs/internal-platform-architecture.md` — higher-level three-layer
  architecture and event-driven direction.
- `pages/dev-console/internal-blueprint.jsx` — authenticated UI summary
  for logged-in users / admins.
- `pages/dev-console/internal-services.jsx` — authenticated UI summary of
  the Phase 2A registry seeds.
- `pages/dev-console/internal-governance.jsx` — authenticated UI summary
  of the Phase 2B lifecycle / runtime policies / environment gates.
- `pages/dev-console/capabilities.jsx` — authenticated UI summary of the
  Phase 2C capability registry, dependencies, and operational constraints.
- `supabase/sql/internal_service_registry_phase2a.sql` — Phase 2A schema +
  seeds + RLS policies.
- `supabase/sql/internal_service_governance_phase2b.sql` — Phase 2B schema +
  seeds + RLS policies.
- `supabase/sql/internal_capability_registry_phase2c.sql` — Phase 2C schema +
  seeds + RLS policies.
- `lib/internalExecutionOrchestrationConfig.js` — Phase 2D pipeline stages,
  policy rules, runtime decisions, trace templates, and orchestration
  safety rules.
- `pages/dev-console/orchestration.jsx` — authenticated UI summary of the
  Phase 2D execution orchestration blueprint.
- `supabase/sql/internal_execution_orchestration_phase2d.sql` — Phase 2D
  schema + seeds + RLS policies.
- `lib/internalObservabilityConfig.js` — Phase 2E execution session,
  metric, failure, and replay-template seeds + observability safety rules.
- `pages/dev-console/observability.jsx` — authenticated UI summary of the
  Phase 2E observability and runtime telemetry blueprint.
- `supabase/sql/internal_observability_phase2e.sql` — Phase 2E schema +
  seeds + RLS policies.
- `lib/internalRuntimeStateConfig.js` — Phase 2F event-store, snapshot,
  checkpoint, and correlation seeds + runtime-state safety rules.
- `pages/dev-console/runtime-state.jsx` — authenticated UI summary of the
  Phase 2F runtime state and event store blueprint.
- `supabase/sql/internal_runtime_state_phase2f.sql` — Phase 2F schema +
  seeds + RLS policies.

---

## Phase 2D — Execution Orchestration & Policy Evaluation Blueprint

**Phase key**: `phase_2d_orchestration`
**Schema**: `supabase/sql/internal_execution_orchestration_phase2d.sql`
**Config**: `lib/internalExecutionOrchestrationConfig.js`
**UI**: `pages/dev-console/orchestration.jsx` (admin-only shell)

### Purpose

Phase 2A defined *who* (the integrations). Phase 2B defined *how
integrations move through their lifecycle*. Phase 2C defined *what
capabilities exist and what dependencies / constraints apply*.

Phase 2D defines the **runtime orchestration pipeline** every future
money-moving request will pass through, plus the **policy rules**,
**runtime decisions**, and **per-capability trace templates** that
compose with it.

Phase 2D is a **blueprint, not an engine**. It names the pipeline, the
verdicts, and the per-capability traces — but no evaluator code path runs
yet. Phase 2D rows are inputs to a future executor that will be built in
a separate phase.

### Orchestration philosophy

1. The pipeline is **linear and deterministic**:
   identity → environment → capability → dependency → policy →
   constraint → idempotency → fraud → audit → execution → post-execution.
2. **Blocking stages halt on failure**; passive stages (intake / audit
   recording / post-execution recording) never halt the pipeline.
3. **Only three verdicts are terminal**: `execution_authorized`,
   `execution_blocked`, and `blocked`. Every other decision feeds back
   into a later stage.
4. **Sandbox and live trace templates are independent**. Promoting
   sandbox does not promote live; live templates require Phase 2B
   governance and a Phase 2C `supports_live=true` flip.
5. **Capabilities never bypass the pipeline**. A money-moving capability
   that skips `fraud_reviewed` cannot reach `execution_authorized`.

### Pipeline stages

`internal_execution_pipeline_stages` — 13 ordered stages. All seeded as
`lifecycle_status='defined'`.

| `execution_order` | `stage_key`             | `stage_type`   | `blocking_by_default` |
| ----------------- | ----------------------- | -------------- | --------------------- |
| 1                 | `request_received`      | audit          | false                 |
| 2                 | `identity_verified`     | identity       | true                  |
| 3                 | `environment_checked`   | environment    | true                  |
| 4                 | `capability_resolved`   | capability     | true                  |
| 5                 | `dependency_checked`    | dependency     | true                  |
| 6                 | `policy_evaluated`      | policy         | true                  |
| 7                 | `constraint_evaluated`  | policy         | true                  |
| 8                 | `idempotency_checked`   | idempotency    | true                  |
| 9                 | `fraud_reviewed`        | fraud          | true                  |
| 10                | `audit_logged`          | audit          | false                 |
| 11                | `execution_authorized`  | execution      | false                 |
| 12                | `execution_blocked`     | execution      | true                  |
| 13                | `post_execution_logged` | post_execution | false                 |

### Policy evaluation rules

`internal_policy_evaluation_rules` — reusable rule definitions evaluated
at `policy_evaluated` and `constraint_evaluated`. All seeded as
`lifecycle_status='defined'`.

| `rule_key`                        | `evaluation_type` | `severity` | `decision_if_failed` |
| --------------------------------- | ----------------- | ---------- | -------------------- |
| `requires_idempotency`            | required          | high       | block                |
| `requires_fraud_review`           | blocking          | critical   | review_required      |
| `sandbox_only`                    | blocking          | medium     | sandbox_only         |
| `max_transaction_amount`          | blocking          | high       | limit_exceeded       |
| `requires_dependency_resolution`  | required          | high       | dependency_missing   |
| `requires_environment_match`      | blocking          | medium     | sandbox_only         |
| `requires_audit_record`           | required          | low        | block                |

`evaluation_type` ∈ {`required`, `optional`, `blocking`, `audit_only`,
`monitor_only`}. `severity` ∈ {`low`, `medium`, `high`, `critical`}.
`decision_if_failed` ∈ {`allow`, `block`, `review_required`,
`sandbox_only`, `limit_exceeded`, `dependency_missing`,
`policy_not_satisfied`}.

### Runtime decisions

`internal_runtime_decisions` — every verdict the future evaluator may
emit. Only the three terminal verdicts end the pipeline; non-terminal
verdicts feed back into a later stage.

| `decision_key`         | `decision_category` | `is_terminal` |
| ---------------------- | ------------------- | ------------- |
| `allowed`              | success             | false         |
| `warning`              | warning             | false         |
| `review_required`      | review              | false         |
| `blocked`              | blocked             | true          |
| `sandbox_only`         | environment         | false         |
| `limit_exceeded`       | policy              | false         |
| `dependency_missing`   | dependency          | false         |
| `policy_not_satisfied` | policy              | false         |
| `execution_authorized` | success             | true          |
| `execution_blocked`    | blocked             | true          |

`decision_category` ∈ {`success`, `warning`, `review`, `blocked`,
`environment`, `dependency`, `policy`}.

### Trace templates

`internal_execution_trace_templates` — per-capability blueprint of which
pipeline stages run, which stages are decision points, and which terminal
states are reachable. All Phase 2D seeds are
`environment='sandbox'`, `lifecycle_status='defined'`.

| `template_key`                  | `capability_key`          | `environment` |
| ------------------------------- | ------------------------- | ------------- |
| `payment_create_sandbox`        | `payment.create`          | sandbox       |
| `payout_release_sandbox`        | `payout.release`          | sandbox       |
| `trading_profit_withdraw_sandbox` | `trading.profit_withdraw` | sandbox       |

`trace_structure` is a JSONB payload with `pipeline`, `decision_points`,
`terminal_states`, and optional `review_states` / `notes`. Example
(payment.create sandbox):

```json
{
  "pipeline": [
    "request_received",
    "identity_verified",
    "environment_checked",
    "capability_resolved",
    "dependency_checked",
    "policy_evaluated",
    "constraint_evaluated",
    "idempotency_checked",
    "fraud_reviewed",
    "audit_logged",
    "execution_authorized"
  ],
  "decision_points": [
    "policy_evaluated",
    "constraint_evaluated",
    "fraud_reviewed"
  ],
  "terminal_states": [
    "execution_authorized",
    "execution_blocked"
  ],
  "notes": "Phase 2C requires wallet.read and fraud.review_required. Sandbox cap: max_transaction_amount=1000 USD."
}
```

### Composition with prior phases

Phase 2D composes with — it does not replace — the prior layers:

- **Phase 2A** supplies the caller identity resolved at `identity_verified`.
- **Phase 2B** supplies the lifecycle status / environment gates checked
  at `environment_checked`.
- **Phase 2C** supplies the capability resolved at `capability_resolved`,
  the dependencies validated at `dependency_checked`, and the operational
  constraints evaluated at `constraint_evaluated`.

Trace templates lift these three sources together: each template names a
single Phase 2C capability, then declares which Phase 2D stages are
decision points and which terminal states the pipeline may reach.

### No execution engine yet

Phase 2D is **architecture-only**:

- No API routes, no runtime evaluator, no enforcement code paths.
- No service tokens, signing secrets, or API keys.
- No money is moved.
- No mutation of treasury, wallet ledger, withdrawal payout, PayPal
  funding, or fraud-engine logic.
- The Developer Console page at `pages/dev-console/orchestration.jsx`
  renders entirely from `lib/internalExecutionOrchestrationConfig.js`.
  It does **not** query Supabase.
- Stages and rules seeded as `lifecycle_status='defined'` describe the
  blueprint only — they cannot block calls until a real executor exists.

Phase 2E+ (out of scope for this phase) will deliver the actual
orchestrator that consumes Phase 2A identities, Phase 2B lifecycle
gates, Phase 2C capabilities/dependencies/constraints, and Phase 2D
pipeline rows to make per-request decisions at runtime.

---

## Phase 2E — Observability & Runtime Telemetry Blueprint

**Phase key**: `phase_2e_observability`
**Schema**: `supabase/sql/internal_observability_phase2e.sql`
**Config**: `lib/internalObservabilityConfig.js`
**UI**: `pages/dev-console/observability.jsx` (admin-only shell)

### Purpose

Phase 2A defined *who*. Phase 2B defined *under what lifecycle*. Phase
2C defined *what capabilities exist*. Phase 2D defined *how a request
flows through identity / environment / dependency / policy / fraud /
audit / execution stages*.

Phase 2E defines **how Tropicash will observe, trace, diagnose, replay,
and monitor** runtime activity once the orchestrator from Phase 2D
exists. It introduces:

- Per-request **execution sessions** (with stable trace + request IDs)
- A canonical **metric catalog** keyed by stage category
- A canonical **failure taxonomy** that references Phase 2D stage,
  policy-rule, and decision keys
- Per-capability **replay templates** that describe which stages and
  events a future replay engine may reconstruct
- A planning catalog of operational **dashboards** the runtime would
  surface

Phase 2E is a **blueprint, not a telemetry pipeline**. It names the
sessions, metrics, failures, replays, and dashboards — but no emitter,
no monitoring daemon, no query layer, and no UI render path exists yet.

### Telemetry philosophy

1. The pipeline produces **one session per request**. Retries, review
   pauses, and reconciliation runs share the same `trace_id`.
2. **Session metadata, failure metadata, and replay structures must
   never carry secrets, tokens, customer PII, or wallet balances.**
3. **Replay is side-effect free.** The replay engine may reconstruct
   any replayable stage up to (but not including)
   `execution_authorized` — the actual executor side-effect is NEVER
   replayed.
4. Failure rows reference Phase 2D rows by key (`stage_key`,
   `policy_rule_key`, `decision_key`). Removing a Phase 2D row never
   deletes Phase 2E telemetry — keys are preserved for forensic
   completeness.
5. **Sandbox and live telemetry are independent series.** Sandbox
   aggregates must never be presented as live, and vice versa.
6. Dashboards must be admin-only at the storage layer (RLS) AND at the
   query layer when implemented. **No public dashboards.**

### Execution sessions

`internal_execution_sessions` — per-request envelope.

| Column                 | Notes                                                                       |
| ---------------------- | --------------------------------------------------------------------------- |
| `execution_session_id` | Stable text identifier. Unique.                                             |
| `trace_id`             | Parent trace. Retries / review pauses share this.                           |
| `request_id`           | Optional caller-supplied request identifier.                                |
| `service_key`          | Phase 2A integration that owns the call.                                    |
| `capability_key`       | Phase 2C capability being invoked.                                          |
| `environment`          | ∈ {`sandbox`, `live`}.                                                      |
| `execution_status`     | ∈ {`planned`, `started`, `in_progress`, `review_required`, `completed`, `failed`, `blocked`, `cancelled`}. Phase 2E seeds three demo sessions as `planned`. |
| `metadata`             | JSONB telemetry envelope. No secrets / PII / balances.                      |

### Metric catalog

`internal_execution_metrics` — canonical metric definitions emitted per
session. Phase 2E seeds them with `metric_value=0` against the
payment.create demo session as a metric catalog.

`metric_category` ∈ {`latency`, `policy`, `fraud`, `dependency`,
`execution`, `audit`, `environment`}.

| `metric_key`                    | `metric_unit` | `metric_category` |
| ------------------------------- | ------------- | ----------------- |
| `latency_ms`                    | ms            | latency           |
| `policy_eval_time_ms`           | ms            | policy            |
| `fraud_eval_time_ms`            | ms            | fraud             |
| `dependency_resolution_time_ms` | ms            | dependency        |
| `audit_logging_time_ms`         | ms            | audit             |
| `execution_duration_ms`         | ms            | execution         |
| `environment_check_time_ms`     | ms            | environment       |
| `policy_rules_evaluated`        | count         | policy            |
| `fraud_flags_checked`           | count         | fraud             |
| `dependencies_resolved`         | count         | dependency        |

### Failure taxonomy

`internal_execution_failures` — canonical failure modes.
`failure_category` ∈ {`policy_failure`, `dependency_failure`,
`environment_failure`, `fraud_block`, `idempotency_conflict`,
`constraint_violation`, `runtime_exception`, `audit_failure`}.
`severity` ∈ {`low`, `medium`, `high`, `critical`}.

| `failure_key`                  | `failure_category`     | `severity` | `is_terminal` | Phase 2D references                                       |
| ------------------------------ | ---------------------- | ---------- | ------------- | --------------------------------------------------------- |
| `policy_not_satisfied`         | policy_failure         | high       | true          | stage `policy_evaluated`, rule `requires_idempotency`     |
| `dependency_missing`           | dependency_failure     | high       | true          | stage `dependency_checked`, rule `requires_dependency_resolution` |
| `sandbox_only_block`           | environment_failure    | medium     | true          | stage `environment_checked`, rule `sandbox_only`          |
| `fraud_review_required`        | fraud_block            | critical   | false         | stage `fraud_reviewed`, rule `requires_fraud_review`      |
| `idempotency_key_conflict`     | idempotency_conflict   | high       | true          | stage `idempotency_checked`, rule `requires_idempotency`  |
| `constraint_limit_exceeded`    | constraint_violation   | high       | true          | stage `constraint_evaluated`, rule `max_transaction_amount` |
| `runtime_processing_exception` | runtime_exception      | critical   | true          | stage `execution_authorized`                              |
| `audit_pipeline_failure`       | audit_failure          | high       | true          | stage `audit_logged`, rule `requires_audit_record`        |

### Replay templates

`internal_execution_replay_templates` — per-capability replay blueprint.
All Phase 2E seeds are `replay_scope='full_execution'`,
`lifecycle_status='defined'`. `replay_scope` ∈ {`session`, `trace`,
`pipeline`, `audit`, `full_execution`}.

| `replay_key`                      | `capability_key`          | `replay_scope`   |
| --------------------------------- | ------------------------- | ---------------- |
| `payment_create_replay`           | `payment.create`          | full_execution   |
| `payout_release_replay`           | `payout.release`          | full_execution   |
| `trading_profit_withdraw_replay`  | `trading.profit_withdraw` | full_execution   |

`replay_structure` is a JSONB payload with `replayable_stages`,
`reconstructable_events`, `terminal_states`, optional `review_states`,
and **required** `redacted_fields` for money-moving capabilities.
Example (payment.create):

```json
{
  "replayable_stages": [
    "request_received",
    "identity_verified",
    "environment_checked",
    "capability_resolved",
    "dependency_checked",
    "policy_evaluated",
    "constraint_evaluated",
    "idempotency_checked",
    "fraud_reviewed",
    "audit_logged"
  ],
  "reconstructable_events": [
    "execution.started",
    "execution.policy_evaluated",
    "execution.constraint_evaluated",
    "execution.fraud_reviewed",
    "execution.audit_logged",
    "execution.completed"
  ],
  "terminal_states": [
    "execution_authorized",
    "execution_blocked"
  ],
  "redacted_fields": ["amount", "wallet_balance", "payer_pii"]
}
```

Note that `execution_authorized` is **listed as a terminal state but
never appears in `replayable_stages`** — replays stop strictly before
the executor side-effect.

### Runtime replay planning

A future replay engine consuming Phase 2E telemetry will:

1. Resolve a session by `execution_session_id` (or every session under a
   given `trace_id`).
2. Look up the matching replay template by `capability_key`.
3. Walk the `replayable_stages` list in pipeline order, scrubbing
   `redacted_fields` from any reconstructed payload.
4. Re-emit `reconstructable_events` to a sandboxed observer (no
   downstream listeners).
5. Stop at the first `terminal_states` entry (or, for sessions that
   reached `review_required`, at the configured `review_states` entry).

Phase 2E does NOT implement step 1–5. The blueprint exists so that the
future implementation has a stable contract.

### Operational dashboards (planned)

Phase 2E planned dashboards (not built yet):

- `execution_health` — per-environment success vs. failure rate.
- `policy_failure_trends` — top failing policy rules over time.
- `fraud_review_queue` — open `review_required` sessions.
- `runtime_latency` — P50 / P95 / P99 by stage and capability.
- `blocked_execution_reasons` — distribution of `execution_blocked` by
  failure category and decision.
- `environment_health` — per-environment dependency / constraint health.
- `capability_usage` — active sessions per capability.

### Composition with prior phases

- **Phase 2A** supplies the `service_key` recorded on every session.
- **Phase 2B** supplies the lifecycle / environment gates that decide
  whether a session may run in live; live sessions inherit Phase 2B
  governance.
- **Phase 2C** supplies the `capability_key` and the operational
  constraints whose violations become Phase 2E failure rows.
- **Phase 2D** supplies the `stage_key`, `policy_rule_key`, and
  `decision_key` referenced by every failure row, plus the pipeline
  shape that drives metric and replay structure.

### No telemetry engine yet

Phase 2E is **architecture-only**:

- No telemetry pipeline, no emitters, no log shippers, no monitoring
  daemons.
- No API routes, no public dashboards, no query layer.
- No service tokens, signing secrets, or API keys.
- No money is moved.
- No mutation of treasury, wallet ledger, withdrawal payout, PayPal
  funding, or fraud-engine logic.
- The Developer Console page at `pages/dev-console/observability.jsx`
  renders entirely from `lib/internalObservabilityConfig.js`. It does
  **not** query Supabase.
- Seeded `metric_value=0` rows describe the metric catalog only — they
  are not real measurements and must not be aggregated as such.

Phase 2F+ (out of scope for this phase) will deliver the actual
telemetry pipeline that emits sessions, metrics, and failures from a
running orchestrator, plus the dashboard backend and replay engine
described above.

---

## Phase 2F — Runtime State & Event Store Blueprint

**Phase key**: `phase_2f_runtime_state`
**Schema**: `supabase/sql/internal_runtime_state_phase2f.sql`
**Config**: `lib/internalRuntimeStateConfig.js`
**UI**: `pages/dev-console/runtime-state.jsx` (admin-only shell)

### Purpose

Phase 2A defined *who*. Phase 2B defined *under what lifecycle*. Phase
2C defined *what capabilities exist*. Phase 2D defined *how a request
flows*. Phase 2E defined *how the run is observed*.

Phase 2F defines **how runtime state is persisted, ordered, snapshotted,
checkpointed, and correlated across services**. It introduces:

- An **append-only event store** for every state-changing event a future
  executor produces, with strict per-trace ordering.
- A **mutable snapshot table** that is always reconstructable from the
  event store — the snapshot is a cache, not the source of truth.
- A **per-trace checkpoint table** so snapshot rebuilders can advance a
  cursor and detect stale snapshots.
- A **cross-service correlation table** that links Tropicash events to
  downstream Blue Atlantic service events by `correlation_id`.

Phase 2F is a **blueprint, not a runtime**. It names the tables, the
event families, the snapshot vocabulary, and the reconstruction flow —
but no emitter, no executor, no consumer, and no UI render path exists
yet.

### Telemetry / state philosophy

1. **The event store is the source of truth.** Every other Phase 2F
   surface (snapshots, checkpoints) is derived from it.
2. **Append-only.** Once written, event rows are immutable. Corrections
   are modeled as new compensating events, not as mutations.
3. **Per-trace ordering is exact, cross-trace ordering is approximate.**
   The unique `(trace_id, sequence_number)` constraint guarantees no two
   writers can collide within a trace; cross-trace ordering uses
   `occurred_at`.
4. **Snapshots are reconstructable.** A future replayer can drop and
   rebuild any snapshot row from the event log. Snapshots are versioned;
   rebuilds bump `version` and update the matching checkpoint.
5. **Event payloads must never carry secrets, tokens, customer PII, or
   wallet balances.** Same redaction discipline as Phase 2E.
6. **Sandbox and live event streams are independent series.** No
   cross-environment aggregation, replay, or mirroring.
7. **Checkpoints are advisory.** A `current` checkpoint does not
   authorize execution — only the Phase 2D pipeline can.

### Immutable event store

`internal_event_store` — append-only event log.

| Column                 | Notes                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `event_id`             | Stable text identifier. Unique.                                                                |
| `event_type`           | Free-form event type (`execution.*`, `wallet.*`, `payment.*`, `payout.*`, `fraud.*`, `integration.*`). |
| `execution_session_id` | Optional Phase 2E session.                                                                     |
| `trace_id`             | Parent trace (Phase 2D / 2E).                                                                  |
| `request_id`           | Optional caller-supplied request identifier.                                                   |
| `service_key`          | Phase 2A integration that produced the event.                                                  |
| `capability_key`       | Phase 2C capability if applicable.                                                             |
| `environment`          | ∈ {`sandbox`, `live`}.                                                                         |
| `sequence_number`      | Monotonic per `trace_id`. Unique with `trace_id`.                                              |
| `parent_event_id`      | Direct parent in the event DAG.                                                                |
| `causation_id`         | The event that *caused* this event (often equal to parent).                                    |
| `correlation_id`       | Cross-service correlation key.                                                                 |
| `actor_type`           | ∈ {`user`, `admin`, `system`, `service`} or `null`.                                            |
| `actor_id`             | Identifier within actor_type.                                                                  |
| `subject_type`         | What the event is about (`execution_session`, `integration`, etc.).                            |
| `subject_id`           | Identifier within subject_type.                                                                |
| `event_payload`        | JSONB body. No secrets / PII / balances.                                                       |
| `metadata`             | JSONB envelope. Same redaction rules as event_payload.                                         |
| `occurred_at`          | When the event happened (logical time).                                                        |
| `created_at`           | When the row was written.                                                                      |

Phase 2F seeds **12 placeholder events** across 6 demo traces, covering
all 12 spec-listed event types exactly once. Logical groupings:

| Family                | Event types                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Execution lifecycle   | `execution.started`, `execution.policy_evaluated`, `execution.review_required`, `execution.blocked`, `execution.completed` |
| Money movement        | `wallet.funded`, `payment.completed`, `payout.requested`                                                             |
| Fraud signals         | `fraud.flagged`                                                                                                      |
| Integration mirror    | `integration.triton_transfer_requested`, `integration.sentinel_sync_completed`, `integration.elitehire_payment_completed` |

### Mutable state snapshots

`internal_runtime_state_snapshots` — derived per-session state.

| Column                    | Notes                                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `snapshot_id`             | Unique text identifier.                                                                                |
| `execution_session_id`    | Phase 2E session.                                                                                      |
| `trace_id`                | Phase 2D / 2E trace.                                                                                   |
| `service_key`             | Phase 2A integration.                                                                                  |
| `capability_key`          | Phase 2C capability.                                                                                   |
| `environment`             | ∈ {`sandbox`, `live`}.                                                                                 |
| `current_execution_state` | ∈ {`planned`, `started`, `in_progress`, `review_required`, `authorized`, `blocked`, `completed`, `failed`, `cancelled`}. |
| `current_review_state`    | Optional review pause state.                                                                           |
| `current_policy_state`    | Optional policy evaluation state.                                                                      |
| `last_decision_key`       | Last Phase 2D decision applied.                                                                        |
| `last_stage_key`          | Last Phase 2D stage applied.                                                                           |
| `last_event_id`           | Last event applied to the snapshot.                                                                    |
| `state_payload`           | JSONB derived state. No secrets / PII / balances.                                                      |
| `version`                 | Monotonically increased on every rebuild.                                                              |

Phase 2F seeds 3 demo snapshots (`payment.create`, `payout.release`,
`trading.profit_withdraw`), all `planned` / `sandbox` / `version=1`.

### Event stream checkpoints

`internal_event_stream_checkpoints` — per-trace cursor.

`checkpoint_status` ∈ {`current`, `stale`, `rebuilding`, `failed`,
`archived`}. Phase 2F seeds 3 `current` checkpoints — one per demo
trace — pointing at the highest sequence number actually present in the
event store seeds (so the checkpoint is internally consistent).

### Cross-service correlation links

`internal_event_correlation_links` — Tropicash → downstream service
mapping. `relation_type` ∈ {`caused`, `triggered`, `mirrored`,
`reconciled`, `notified`, `reported`}.

| Source     | Target          | `relation_type` | Trigger event                                  |
| ---------- | --------------- | --------------- | ---------------------------------------------- |
| tropicash  | triton          | triggered       | `payment.completed` → `integration.triton_transfer_requested` |
| tropicash  | sentinel        | reported        | `execution.completed` → `integration.sentinel_sync_completed` |
| tropicash  | elitehire_pro   | reconciled      | `payout.requested` → `integration.elitehire_payment_completed` |

### Event ordering model

- **Per-trace** ordering is **strictly monotonic** — enforced by the
  unique `(trace_id, sequence_number)` constraint on the event store.
- **Cross-trace** ordering is **approximate** — based on `occurred_at`.
  Multi-trace replays must reconcile via `correlation_id`, not via a
  global clock.
- **Causation** is recorded explicitly with `parent_event_id` and
  `causation_id`. Replayers can walk backwards from any event.
- **Append-only.** Compensating events (refunds, reversals, manual
  overrides) are new events, not mutations of prior events.

### Runtime reconstruction flow

A future replayer:

1. Selects a `trace_id` (or `correlation_id`).
2. Loads events from `internal_event_store` ordered by
   `sequence_number` ASC.
3. Folds each event into a snapshot, redacting sensitive fields per the
   Phase 2E replay template.
4. Advances `internal_event_stream_checkpoints` with the last
   `(sequence_number, event_id)` consumed.
5. Bumps `version` on the matching `internal_runtime_state_snapshots`
   row and writes the new payload.
6. If the trace touched a downstream service, walks
   `internal_event_correlation_links` to inspect mirrored events.

Phase 2F does NOT implement steps 1–6. The blueprint exists so that the
future implementation has a stable contract.

### Composition with prior phases

- **Phase 2A** supplies the `service_key` recorded on every event,
  snapshot, checkpoint, and correlation row.
- **Phase 2B** governs whether a snapshot may transition into `live`.
- **Phase 2C** supplies the `capability_key` recorded on every event,
  snapshot, and checkpoint.
- **Phase 2D** supplies the `stage_key`, `decision_key`, and pipeline
  shape that drive snapshot transitions.
- **Phase 2E** sessions, metrics, failures, and replay templates roll
  up from these event rows. The replay templates explicitly redact
  fields when reconstructing a snapshot.

### No event emitter yet

Phase 2F is **architecture-only**:

- No event emitter, no executor, no replay engine, no snapshot
  rebuilder, no consumer.
- No API routes, no public dashboards, no query layer.
- No service tokens, signing secrets, or API keys.
- No money is moved.
- No mutation of treasury, wallet ledger, withdrawal payout, PayPal
  funding, or fraud-engine logic.
- The Developer Console page at `pages/dev-console/runtime-state.jsx`
  renders entirely from `lib/internalRuntimeStateConfig.js` (and the
  Phase 2D / 2E configs for cross-references). It does **not** query
  Supabase.
- All seeded events, snapshots, checkpoints, and correlation rows are
  placeholders — `event_payload`, `state_payload`, and metadata carry
  no real user data, balances, secrets, or PII.

Phase 2G+ (out of scope for this phase) will deliver the actual event
emitter, the replay engine, and the snapshot rebuilder that consume the
schema described above.

## Phase 3A — Execution Simulation Layer

> **Status:** Simulation layer only. Deterministic, replayable, and
> in-memory. No live runtime, no APIs, no money movement, no
> persistence. Lives in the Developer Console at
> `/dev-console/execution-simulator` and is rendered entirely from
> `lib/executionScenarioConfig.js`.

### Why Phase 3A exists

Phases 2A–2F define **schemas + vocabularies**. Phase 3A is the first
layer where those schemas become **visible as motion** — without
running an executor, an emitter, or a worker. The simulator answers a
specific question for reviewers and future API consumers:

> "If a payment / payout / withdrawal / integration request were to
> walk the pipeline today, what would the trace, event log, snapshot
> evolution, and correlation map look like?"

It is intentionally a **visualization layer**, not a runtime engine.

### Deterministic simulations

Every Phase 3A artifact is derived from a static scenario seed. The
simulator does **not** use:

- `Date.now()`, `performance.now()`, or any real-time clock
- `Math.random()` or any non-deterministic source
- timers, schedulers, intervals, or async tasks
- network access, Supabase queries, or storage access

Each scenario in `EXECUTION_SCENARIOS` carries a `timeline[]`. The
simulator base anchor is the constant
`EXECUTION_SIMULATION_BASE_TIMESTAMP` (`2026-05-12T12:00:00.000Z`).
Every event, snapshot, and checkpoint timestamp is `base +
relative_offset_ms` from a timeline entry. **The same scenario always
produces the same trace.**

### Replayable timelines

The Execution Simulator page exposes three controls:

| Control | Effect |
|---|---|
| **Generate Simulation** | Builds the full trace, events, snapshots, and checkpoints, and reveals the entire timeline. |
| **Replay Timeline** | Steps through the timeline one entry at a time; wraps back to the first entry after the last. |
| **Reset Simulation** | Clears local React state. Nothing else is touched. |

Replay is purely visual — none of the simulator's helpers fire,
retry, or repeat any real side effect on each step.

### Simulated event generation

`buildScenarioEvents()` returns an array of synthetic events shaped
exactly like a Phase 2F `internal_event_store` row, **without writing
them anywhere**:

- `event_id` = `evt_3a_<scenario>_<NNN>` (zero-padded sequence).
- `trace_id` = `trace_3a_<scenario>_demo`.
- `sequence_number` is monotonically increasing across the trace,
  honoring the `(trace_id, sequence_number)` uniqueness invariant
  from Phase 2F.
- `parent_event_id` chains to the previous event so the visualization
  can render a clean lineage.
- `correlation_id` = `corr_3a_<scenario>_demo`.
- `metadata.source` is always `phase_3a_simulator` so any future
  consumer (when one ships) can recognize and reject these rows.

`buildScenarioSnapshots()` returns one snapshot per timeline entry
with `version` 1..N. `buildScenarioCheckpoints()` advances a cursor
through the same timeline. Together they let the Snapshot evolution
and Checkpoint cursor panels show state movement.

### Orchestration walkthroughs

Each scenario lists the Phase 2D pipeline stages it touches
(`orchestration_stages[]`) and the Phase 2E metrics it would emit
(`observability_signals[]`). The simulator does **not** invoke a
real evaluator or a real metric emitter — it renders the lists as
labels so the user can see which stages a given request shape would
exercise.

Scenarios cover the following high-level shapes:

- **Wallet transfer — success** (full pipeline, clean completion)
- **Wallet transfer — review required** (fraud pause mid-flight)
- **Withdrawal — pending review** (held before authorization)
- **Withdrawal — completed** (full success after approval)
- **Trading profit payout** (Tropicash ↔ Triton correlation)
- **Merchant settlement — delayed** (Tropicash ↔ EliteHire Pro;
  downstream defers)
- **Fraud signal — escalated** (Tropicash ↔ Sentinel; pipeline
  blocked)
- **API request — rate limited** (gateway rejects before any stage)
- **Orchestration stage — retryable failure** (transient failure;
  idempotency key preserved)
- **Integration sync — completed** (Tropicash → Triton + Sentinel
  reconciliation)

### No live runtime

Phase 3A is **simulation only**:

- No executor, no event emitter, no scheduler, no queue, no worker,
  no cron, no webhook dispatcher, no retry loop.
- No persistence: nothing writes to any Supabase table, including the
  Phase 2A–2F internal tables.
- No money is moved. Treasury, wallet, withdrawal, PayPal, payout,
  and fraud-engine modules are untouched.
- No API routes are added. No keys, tokens, or secrets are
  introduced.
- The environment selector exposes `sandbox` only; the `live` option
  is intentionally disabled.

The Execution Simulator is meant to support **review, design
critique, and reasoning** about the future runtime — not to be one.

### Cross-references

- `lib/executionScenarioConfig.js` — scenarios, categories, final
  states, timeline states, safety rules, and deterministic helpers
  (`getScenarioByKey`, `getScenarioTimeline`, `buildScenarioTrace`,
  `buildScenarioEvents`, `buildScenarioSnapshots`,
  `buildScenarioCheckpoints`, `buildScenarioSimulation`,
  `getMockObservabilityForScenario`).
- `pages/dev-console/execution-simulator.jsx` — the visualization
  page rendered entirely from the config above.
- Phase 2D pipeline stages, Phase 2E metric keys, Phase 2F snapshot
  states / checkpoint statuses / event families are referenced as
  stable string keys; no cross-file imports keep Phase 3A free of
  circular references.

## Phase 3B — Runtime Decision Engine Simulator

Phase 3B answers **why** a simulated execution would be allowed,
blocked, delayed, rate-limited, sent to review, or marked as a
retryable failure — using a **policy evaluation simulation** only.

### Policy evaluation simulation

Each **decision case** (`DECISION_SIMULATION_CASES` in
`lib/runtimeDecisionSimulatorConfig.js`) binds to the same
`scenario_key` as a Phase 3A execution scenario. The case carries
pre-seeded `rule_results` (pass/fail, impact, evaluation order). Pure
helpers sort by `evaluation_order`, merge with the static rule
catalog (`DECISION_SIMULATION_RULES`), and derive counts, a
`final_outcome`, and a `terminal` flag for the Dev Console UI.

### Rule result modeling

Rules are typed (`identity`, `environment`, `capability`,
`dependency`, `policy`, `constraint`, `idempotency`, `fraud`,
`audit`) and carry `severity`, human-readable messages, and
`decision_if_failed` (the outcome if that rule fails in isolation).
**Impact** (`continue`, `warn`, `pause_for_review`, `block`, `retry`,
`delay`) drives how the sorted walk interprets failures: blocking
impacts yield terminal-ish outcomes in simulation (`blocked`,
`sandbox_only`, `policy_not_satisfied`, `dependency_missing`);
`pause_for_review` yields `review_required`; `retry` →
`retryable_failure`; `delay` → `delayed`.

### Deterministic decisions

There is **no** `Date.now()`, `Math.random()`, network I/O, Supabase,
or cross-request mutable state. `evaluateDecisionCase(caseKey,
{ environment })` only reads static config and optional UI override
for the displayed environment label.

### Outcome explanations

`getOutcomeExplanation(finalOutcome)` returns plain-English copy for
the Decision Simulator page. This is **narration for reviewers**, not
an enforcement verdict.

### No real enforcement

Phase 3B does **not** implement a policy engine, middleware, workers,
queues, schedulers, webhooks, event emitters, database writes, or any
path that moves money or touches treasury, wallets, withdrawals,
PayPal, or live fraud execution. It is **local UI simulation only**.

### Cross-references

- `lib/runtimeDecisionSimulatorConfig.js` — rule types, outcomes,
  severities, rules, cases, safety rules, and helpers (`getDecisionCaseByKey`,
  `getRulesForCase`, `evaluateDecisionCase`, `buildDecisionTrace`,
  `buildPolicyResultRows`, `buildDecisionSummary`, etc.).
- `pages/dev-console/decision-simulator.jsx` — Decision Simulator UI
  (summary, rule table, trace, outcome explanation, link to the
  related Execution Simulator scenario).
- `lib/executionScenarioConfig.js` — related scenario metadata via
  `getScenarioByKey`.

## Phase 3C — Simulation Run History & Comparison

Phase 3C introduces a **read-only simulation ledger** that joins the Phase 3A
execution scenario registry with Phase 3B `evaluateDecisionCase()` results for
the same `scenario_key` / `case_key` pairs. The goal is reviewer-facing
**history, comparison, and distribution** views — not a database table, not a
replay engine, and not a scheduler.

### Deterministic history

- `lib/simulationRunHistoryConfig.js` exports `SIMULATION_RUN_HISTORY_SEEDS`
  (ten static rows — one per shared scenario), `SIMULATION_RUN_STATUSES`,
  `SIMULATION_RUN_OUTCOME_GROUPS`, `SIMULATION_COMPARISON_METRICS`, and
  `SIMULATION_RUN_HISTORY_SAFETY_RULES`.
- `buildSimulationRunHistory()` merges each seed with `getScenarioByKey` and
  `evaluateDecisionCase` so rule counts, checkpoint tail status, correlation
  cardinality, and durations are **derived**, not duplicated as a second
  scenario catalog.
- `created_at_simulated` is a fixed ISO string per seed — no `Date.now()` and
  no wall clock in the module.

### Scenario vs decision comparison

- `buildScenarioDecisionComparison()` and `buildSimulationComparisonRows()`
  expose alignment heuristics (e.g. when execution `final_state` is `completed`
  but the decision walk ends in `review_required`) so cross-layer tension is
  visible in documentation and UI without implying production enforcement.

### Distributions and review analysis

- `buildSimulationOutcomeDistribution()` rolls up Phase 3C outcome groups
  (allowed, review, operational_pause, blocked, completed).
- `buildSimulationFinalStateDistribution()` counts execution-layer
  `final_state` keys.
- `buildReviewRequiredRuns()` and `buildBlockedOrPausedRuns()` slice the same
  merged list for focused review — still pure filters over in-memory rows.

### Health summary

- `buildSimulationHealthSummary()` returns top-level counters (totals,
  averages, rule-count sums, unique categories, unique correlation targets,
  divergent-alignment count) plus nested `by_category`, `by_final_state`, and
  `by_decision_outcome` aggregates for cards and charts on
  `/dev-console/simulation-history`.

### No persistence

Phase 3C does **not** write to Supabase, introduce API routes, workers, queues,
schedulers, webhooks, event emitters, secrets, or money-movement execution. It
is **simulation-only** documentation and UI glue atop existing Phase 3A/3B
config.

### Cross-references

- `lib/simulationRunHistoryConfig.js` — seeds, vocabularies, safety strings,
  and pure helpers (`getSimulationRunByKey`, `buildSimulationRunHistory`, …).
- `pages/dev-console/simulation-history.jsx` — Simulation Run History UI.
- `lib/developerCenterConfig.js` — `DEV_CONSOLE_ROUTES` entry for
  `/dev-console/simulation-history`.

## Phase 3D — Runtime Policy Visualization & Dependency Graphs

Phase 3D introduces **read-only graph-shaped summaries** that reuse the same
static sources as Phases 2C, 3B, and 3C. The goal is reviewer-facing **layout and
concentration** views — not a graph database, not a policy executor, and not a
scheduler.

### Deterministic graph builders

- `lib/runtimePolicyGraphConfig.js` exports `RUNTIME_POLICY_GRAPH_PHASE`,
  vocabulary arrays (`GRAPH_NODE_TYPES`, `GRAPH_EDGE_TYPES`, `GRAPH_RISK_LEVELS`,
  `GRAPH_VIEW_MODES`), `POLICY_GRAPH_SAFETY_RULES`, and pure builders:
  `buildCapabilityDependencyGraph()`, `buildPolicyGateGraph()`,
  `buildScenarioRuleGraph()`, `buildReviewRoutingGraph()`,
  `buildRiskConcentrationSummary()`, `buildRulePressureSummary()`,
  `buildCapabilityRiskRows()`, and `buildGraphHealthSummary()`.
- Node shape: `{ node_id, label, type, risk_level, status, description, metadata }`.
  Edge shape: `{ edge_id, source, target, type, label, risk_level, description }`.
- Capability graphs include Phase 2C capability and constraint rows, dependency
  bridge nodes for each `INTERNAL_DEPENDENCY_SEEDS` row, and **correlates** edges
  to Phase 2A `BLUE_ATLANTIC_SERVICE_SEEDS` where permission keys match capability
  keys.

### UI contract

- `/dev-console/policy-graphs` (`pages/dev-console/policy-graphs.jsx`) renders
  **cards and grouped lists only** — no new npm graph/canvas libraries.
- View modes switch which builder feeds the main grouped node/edge panels; risk
  concentration reuses the same rollups as dedicated summary sections.

### No enforcement

Phase 3D does **not** write to Supabase, introduce API routes, workers, queues,
schedulers, webhooks, event emitters, secrets, or money-movement execution. It
is **visualization-only** glue atop existing planning and simulation config.

### Cross-references

- `lib/runtimePolicyGraphConfig.js` — graph vocabularies, safety strings, and pure
  builders listed above.
- `pages/dev-console/policy-graphs.jsx` — Policy Graphs Developer Console page.
- `lib/developerCenterConfig.js` — `DEV_CONSOLE_ROUTES` entry for
  `/dev-console/policy-graphs`.

## Phase 3E — Simulation Readiness Audit

Phase 3E is a **readiness and safety review** pass over Phases 3A–3D — not a new
runtime surface. It confirms deterministic simulation contracts (no wall clock,
no randomness, no network or Supabase in the four config modules), UI copy that
cannot be mistaken for live execution, shared `scenario_key` alignment between
`EXECUTION_SCENARIOS` and `DECISION_SIMULATION_CASES`, and cross-links across the
Developer Console simulation pages plus orchestration, observability, runtime
state, and capabilities. The goal is **stack alignment and reviewer confidence**
before any real org/app or authenticated console work expands scope.

Phase 3E does **not** add API routes, workers, queues, schedulers, webhooks,
emitters, persistence, secrets, or money-movement paths.

### Cross-references

- `lib/executionScenarioConfig.js`, `lib/runtimeDecisionSimulatorConfig.js`,
  `lib/simulationRunHistoryConfig.js`, `lib/runtimePolicyGraphConfig.js`
- `pages/dev-console/execution-simulator.jsx`,
  `pages/dev-console/decision-simulator.jsx`,
  `pages/dev-console/simulation-history.jsx`,
  `pages/dev-console/policy-graphs.jsx`

Later phases (beyond Phase 3E) are the earliest point at which any **real** runtime
infrastructure (executor, emitter, replay engine, enforcement middleware) could
be introduced — and only behind explicit governance and a working enforcement
code path.

## Public Developer Access Requests

Public intake for the Developer Center lives in `public.developer_access_requests`
(`supabase/sql/developer_access_requests.sql`). Visitors submit from
`/developers/request-access` without signing in; the row stores contact fields,
use case, optional message, and a workflow status (`pending` → `reviewed` /
`approved` / `rejected` / `archived`) plus admin review metadata
(`reviewed_by_user_id`, `review_notes`, `reviewed_at`).

**RLS:** `anon` may **INSERT** only (no select/update/delete for anonymous callers).
Authenticated **admins** (`public.tc_is_admin()`) may **SELECT**, **UPDATE**, and **DELETE**.
There is no self-service list for submitters.

**Application:** `lib/developerAccessRequests.js` (`submitDeveloperAccessRequest`,
`fetchDeveloperAccessRequests`, `updateDeveloperAccessRequestStatus`);
`/dev-console/app-governance` admin queue at the top of the page (separate from
`developer_app_reviews` and capability request queues).

**Hard exclusions:** Approving or archiving a request does **not** create
`developer_organizations`, `developer_apps`, API keys, or secrets.

## Phase 4A — Developer Organizations & App Registration

Phase 4A adds **registration-only** persistence for developer organizations and
per-environment app rows. Authenticated users create orgs they own and sandbox
app records under those orgs; RLS enforces `owner_user_id = auth.uid()` for
normal users and `public.tc_is_admin()` for operators. Anonymous roles have **no**
policies on these tables.

### Schema (`supabase/sql/developer_orgs_phase4a.sql`)

- **`developer_organizations`** — `owner_user_id`, `organization_name`,
  `organization_type` (`individual` \| `business` \| `platform` \| `internal`),
  `status` (`pending_review` \| `approved` \| `suspended` \| `rejected` \| `archived`),
  optional `website_url`, `contact_email`, `description`, timestamps.
- **`developer_apps`** — `organization_id` (FK, cascade delete), `owner_user_id`,
  `app_name`, `app_slug`, `environment` (`sandbox` \| `live`) with Phase 4A UI
  defaulting to **sandbox**, `status` including `draft` as the create default,
  `app_type`, optional `redirect_url` / `description`, timestamps. Unique
  `(organization_id, app_slug, environment)`.

Indexes cover `owner_user_id` and `status` on orgs; `organization_id`,
`owner_user_id`, and `(environment, status)` on apps.

### Application surface

- `lib/developerApps.js` — thin Supabase helpers (`fetchDeveloperOrganizations`,
  `createDeveloperOrganization`, `fetchDeveloperApps`, `createDeveloperApp`,
  `slugifyAppName`) returning `{ data, error }` with light client-side validation.
- `/dev-console/apps-register` — authenticated Developer Console page using
  `DevConsoleLayout`; lists the caller’s orgs/apps and submits inserts only.
- `/dev-console/apps` — minimal CTA link to registration; no API key UI.

### Hard exclusions (Phase 4A)

Phase 4A does **not**: issue or store API keys, OAuth client secrets, webhook
signing secrets, public HTTP API routes, execution engines, workers, queues,
schedulers, payment or wallet mutations, treasury, withdrawals, PayPal, or fraud
execution. `redirect_url` is metadata only — no redirect validation service ships
in this phase.

### Cross-references

- `supabase/sql/developer_orgs_phase4a.sql`
- `lib/developerApps.js`
- `pages/dev-console/apps-register.jsx`, `pages/dev-console/apps.jsx`
- `lib/developerCenterConfig.js` — `DEV_CONSOLE_ROUTES` entry for
  `/dev-console/apps-register`

## Phase 4B — Developer App Governance & Review Workflow

Phase 4B adds a **governance-only** review queue and append-only lifecycle audit
for `developer_apps`. Owners submit review requests (e.g. sandbox activation);
admins decide via `public.tc_is_admin()` and may transition app `status` rows.
No API keys, secrets, webhooks, workers, runtime execution, or money movement.

### Schema (`supabase/sql/developer_app_governance_phase4b.sql`)

- **`developer_app_reviews`** — `app_id`, `organization_id`, `requested_by_user_id`,
  `review_type` (`sandbox_activation` \| `live_access` \| `environment_upgrade` \|
  `suspension_review` \| `reactivation`), `requested_environment`, `status`
  (`pending` \| `approved` \| `rejected` \| `needs_changes` \| `cancelled`),
  optional `reviewer_user_id`, `review_notes`, `decision_notes`, timestamps.
  Indexes on `app_id`, `status`, `review_type`.
- **`developer_app_lifecycle_events`** — `event_type` (review decisions, status
  transitions, sandbox/live milestones), `previous_status`, `new_status`,
  `actor_user_id`, `actor_type` (`user` \| `admin` \| `system`), `notes`,
  `metadata` jsonb, `created_at`. Indexes on `app_id`, `event_type`.

RLS: owners **SELECT** reviews for owned apps/orgs and **INSERT** their own
requests; admins **SELECT/UPDATE/DELETE** reviews. Lifecycle: owners **SELECT**;
admins full CRUD (lifecycle rows are written on admin decisions).

### Application surface

- `lib/developerGovernance.js` — `fetchDeveloperAppReviews`,
  `createDeveloperAppReview`, `fetchDeveloperLifecycleEvents`,
  `updateDeveloperReviewStatus`, `createLifecycleEvent`, plus admin helpers
  (`fetchAllPendingReviewsForAdmin`, `fetchAppsForGovernance`, …).
- `/dev-console/my-apps` — developer dashboard: orgs, apps, pending reviews,
  lifecycle feed, eligibility notices.
- `/dev-console/app-governance` — **admin-only** review queue, approve/reject/
  needs-changes actions, app overview, lifecycle feed.
- `/dev-console/apps-register` — per-app **Request Sandbox Activation** when
  eligible; disabled while a pending `sandbox_activation` review exists.

### Approval behavior

- **`sandbox_activation` approved** → `developer_apps.status = sandbox_active`
  + lifecycle `sandbox_activated`.
- **`live_access` approved** → `live_pending` (not `live_active`) + lifecycle
  `live_pending_set`.
- **Reject / needs_changes** → review row updated only; app status unchanged.

### Hard exclusions (Phase 4B)

Same as Phase 4A: no credentials, no public API edge, no webhooks, no payment/
wallet/treasury/PayPal/fraud execution.

### Cross-references

- `supabase/sql/developer_app_governance_phase4b.sql`
- `lib/developerGovernance.js`
- `pages/dev-console/my-apps.jsx`, `pages/dev-console/app-governance.jsx`
- `lib/developerCenterConfig.js` — `/dev-console/my-apps`, `/dev-console/app-governance`

## Phase 4C — Sandbox Access Policies & Capability Assignment

Phase 4C adds **sandbox access governance** for registered developer apps: admin-assigned
capability rows, owner-submitted capability requests, and per-app access policy metadata.
Capability keys reference the Phase 2C internal catalog for UI labels only — **no**
enforcement, API keys, secrets, or live API traffic.

### Schema (`supabase/sql/developer_app_capabilities_phase4c.sql`)

- **`developer_app_capabilities`** — `app_id`, `organization_id`, `capability_key`,
  `environment` (`sandbox` \| `live`), `status` (`assigned` \| `pending_review` \|
  `restricted` \| `revoked` \| `suspended`), optional `assigned_by_user_id`, `notes`,
  timestamps. Unique `(app_id, capability_key, environment)`.
- **`developer_app_capability_requests`** — owner-submitted requests with
  `requested_environment`, `status` (`pending` \| `approved` \| `rejected` \|
  `needs_changes` \| `cancelled`), `request_reason`, reviewer fields, timestamps.
- **`developer_app_access_policies`** — `policy_key`, `policy_label`, `policy_value` jsonb,
  `status` (`planned` \| `active` \| `restricted` \| `disabled`), `risk_level`, `notes`.
  Unique `(app_id, environment, policy_key)`.

Indexes cover `app_id`, `organization_id`, `capability_key`, `(environment, status)` on
capabilities; `app_id`, `status`, `capability_key` on requests; `app_id`,
`(environment, status)`, `policy_key` on policies.

RLS: owners **SELECT** capabilities for owned apps (cannot insert/update/delete assignments);
admins full CRUD on capabilities. Requests: owners **SELECT** + **INSERT** for owned apps;
admins **SELECT/UPDATE/DELETE** all. Policies: owners **SELECT**; admins full CRUD. No anonymous
access. Lifecycle `event_type` extended with `status_changed` for capability approval notes.

### Application surface

- `lib/developerCapabilities.js` — fetch helpers, `createCapabilityRequest`,
  `adminAssignCapability`, `adminUpdateCapabilityStatus`, `adminCreateAccessPolicy`,
  `adminUpdateAccessPolicyStatus`, admin queue helpers (`fetchPendingCapabilityRequestsForAdmin`,
  `approveCapabilityRequest`, `rejectCapabilityRequest`, `needsChangesCapabilityRequest`).
- `/dev-console/app-capabilities` — developer view: assigned capabilities, requests, policies,
  sandbox-only request form (catalog dropdown from `lib/internalCapabilityConfig.js`).
- `/dev-console/app-governance` — admin **Capability Requests** section (approve/reject/needs
  changes; on approve upserts `developer_app_capabilities` with `status=assigned`).
- `/dev-console/my-apps` — per-app capability summary and link to app-capabilities.

### Approval behavior

- **Approve capability request** → upsert `developer_app_capabilities` (`assigned`, requested
  environment) + request `approved` + optional lifecycle `status_changed` with capability notes.
- **Reject / needs_changes** → request row updated only; no capability assignment.

### Hard exclusions (Phase 4C)

Same as Phase 4A/4B: no API keys, secrets, public API edge, webhooks, workers, runtime execution,
payment/wallet/treasury/PayPal/fraud execution. Policy `policy_value` jsonb is metadata only.

### Cross-references

- `supabase/sql/developer_app_capabilities_phase4c.sql`
- `lib/developerCapabilities.js`
- `pages/dev-console/app-capabilities.jsx`, `pages/dev-console/app-governance.jsx`
- `lib/developerCenterConfig.js` — `/dev-console/app-capabilities`

## Phase 4D — Sandbox Runtime Contracts & API Product Catalog

Phase 4D introduces a **static developer API product catalog** and **sandbox runtime contract** seeds
so reviewers, console pages, and public documentation can reference the same vocabulary without
standing up a public HTTP edge. Entries include JSON Schema-shaped `request_schema` /
`response_schema` object literals, simulated outcome enumerations, review and rate-limit intent, and
references to Phase 2C `capability_key` strings.

### Modeling surface (`lib/developerProductCatalogConfig.js`)

- **`API_PRODUCTS`** — diverse products across wallet, transfers, merchant, sandbox, observability,
  governance, analytics, platform, and internal categories with sandbox/live posture flags.
- **`API_SANDBOX_CONTRACTS`** — illustrative `route_preview` strings (for example
  `POST /sandbox/wallet/reservations/simulate`) paired to products and required capabilities.
- **Pure helpers** — `getProductByKey`, `getContractsForProduct`, `getContractsForCapability`,
  `buildProductCapabilityMap`, `buildSandboxContractRows`, `buildRateLimitSummary`,
  `buildEnvironmentRestrictionSummary`, `buildContractHealthSummary`.

### Developer Console UI

- `/dev-console/product-catalog` — DevConsoleLayout page summarizing taxonomy, seeded products,
  contracts, aggregates, and safety copy.
- `/dev-console/app-capabilities` — “Related Product Access” ties the sandbox capability dropdown to
  catalog lookups for teaching reviewers and app owners.

### Public Developer Portal copy

- `/developers/docs` — **Sandbox Runtime Contracts Preview** subsection orients anonymous readers.
- `/developers/how-it-works` — **Developer Products & Sandbox Contracts** section explains how Phase 4D
  complements the nine-layer narrative without implying live APIs.

### Hard exclusions (Phase 4D)

No Supabase migrations, anonymous catalog endpoints, secrets, API keys, webhooks, workers, runtime
policy enforcement, wallet/treasury/payout/PayPal/fraud execution, or non-deterministic config (`Date.now`,
`Math.random`, network I/O). The catalog is documentation metadata only.

### Cross-references

- `lib/developerProductCatalogConfig.js`
- `pages/dev-console/product-catalog.jsx`
- `pages/dev-console/app-capabilities.jsx`, `pages/dev-console/my-apps.jsx`,
  `pages/dev-console/app-governance.jsx`
- `pages/developers/docs.jsx`, `pages/developers/how-it-works.jsx`
- `lib/developerCenterConfig.js` — `/dev-console/product-catalog`

## Phase 4E — Sandbox Usage Simulation & Developer Analytics

Phase 4E introduces **static sandbox analytics seeds** so authenticated console users can rehearse how
usage, health, capability utilization, and rate-limit pressure might be narrated **before** live traffic
exists. Rows reference Phase 4D catalog keys and Phase 2C capabilities; all counters are illustrative.

### Modeling surface (`lib/developerSandboxAnalyticsConfig.js`)

- **`SANDBOX_USAGE_SIMULATION_SEEDS`** — per-app simulated call / outcome mix, review and rate-limit
  pressure labels, fixed windows such as `24h-fixed`.
- **`SANDBOX_APP_HEALTH_SEEDS`** — governance, stability, capability risk, review load, and overall
  health grades with copy-first summaries.
- **`SANDBOX_CAPABILITY_UTILIZATION_SEEDS`** — `usage_level`, `risk_level`, and related product/contract
  references per capability.
- **`SANDBOX_RATE_LIMIT_SIMULATION_SEEDS`** — tier-aligned limits with simulated used/remaining buckets.
- **Pure helpers** — `getSandboxUsageForApp`, `getSandboxHealthForApp`, `getCapabilityUtilizationForApp`,
  `getRateLimitSimulationForApp`, `buildSandboxUsageSummary`, `buildSandboxHealthSummary`,
  `buildCapabilityUtilizationSummary`, `buildRateLimitPressureSummary`,
  `buildDeveloperAnalyticsDashboardSummary`.

### Developer Console UI

- `/dev-console/sandbox-analytics` — DevConsoleLayout page with optional app selector and composed
  dashboard summary.
- Cross-links from **Product Catalog**, **App Capabilities**, **My Apps**, and **App Governance**.

### Public Developer Portal copy

- `/developers/docs` — **Sandbox Analytics Preview** subsection.
- `/developers/how-it-works` — **Sandbox analytics before live access** note alongside Phase 4D copy.

### Hard exclusions (Phase 4E)

No Supabase tables, analytics pipelines, anonymous telemetry endpoints, secrets, API keys, webhooks,
workers, real rate limiters, wallet/treasury/payout/PayPal/fraud execution, or non-deterministic helpers
(`Date.now`, `Math.random`, network I/O, `localStorage`). Seeds are documentation metadata only.

### Cross-references

- `lib/developerSandboxAnalyticsConfig.js`
- `pages/dev-console/sandbox-analytics.jsx`
- `lib/developerProductCatalogConfig.js`, `lib/internalCapabilityConfig.js`
- `pages/dev-console/product-catalog.jsx`, `pages/dev-console/app-capabilities.jsx`,
  `pages/dev-console/my-apps.jsx`, `pages/dev-console/app-governance.jsx`
- `pages/developers/docs.jsx`, `pages/developers/how-it-works.jsx`
- `lib/developerCenterConfig.js` — `/dev-console/sandbox-analytics`

## Phase 4F — Developer Platform Readiness Audit

Phase 4F is a **readiness and consistency pass** over Phases 4A–4E: SQL migration order and RLS invariants, Supabase helper query scoping, Developer Console route protection and cross-links, UI copy alignment (sandbox / no-API-key messaging), static catalog vs analytics seed keys vs `INTERNAL_CAPABILITY_SEEDS`, and public developer portal wording. It does **not** introduce API keys, secrets, public HTTP APIs, webhooks, workers, execution engines, telemetry, or money/treasury/wallet/payout/PayPal/fraud execution.

### SQL & RLS (apply in order)

1. `supabase/sql/developer_orgs_phase4a.sql` — `developer_organizations`, `developer_apps`; owner `auth.uid()` policies; admin via `tc_is_admin()`; RLS enabled; grants to `authenticated` only (no anon policies).
2. `supabase/sql/developer_app_governance_phase4b.sql` — `developer_app_reviews`, `developer_app_lifecycle_events`; owners submit/read reviews; **only admins** update reviews; admin UPDATE on reviews requires `reviewer_user_id` distinct from `requested_by_user_id` (no self-decision on own request).
3. `supabase/sql/developer_app_capabilities_phase4c.sql` — extends lifecycle `event_type` check (e.g. `status_changed`); `developer_app_capabilities` (owner **select** only; admin insert/update/delete); capability requests and access policies with matching admin self-review guard on capability request updates; valid `CREATE POLICY` for access-policy delete.

### Helpers & configs

- `lib/developerApps.js`, `lib/developerGovernance.js`, `lib/developerCapabilities.js` — browser `supabase` client only; `{ data, error }` returns; owner-scoped list queries filter by owned `developer_apps.id` where applicable; admin helpers remain explicitly named (`fetchAllPendingReviewsForAdmin`, `adminAssignCapability`, etc.).
- `lib/developerProductCatalogConfig.js`, `lib/developerSandboxAnalyticsConfig.js` — pure static seeds and helpers (no `Date.now` / `Math.random` / network in analytics config per Phase 4E rules).

### Developer Console routes (authenticated; governance admin-only)

- `/dev-console/apps`, `/dev-console/apps-register`, `/dev-console/my-apps`, `/dev-console/app-capabilities`, `/dev-console/product-catalog`, `/dev-console/sandbox-analytics` — session required via `components/RouteAuthGuard.jsx` (`/dev-console` prefix → `/login`).
- `/dev-console/app-governance` — same session gate; **admin-only** UI via `isAdminUser()`; non-admins see denial copy with links to My Apps, Product Catalog, and Sandbox Analytics.

### Public portal

- `/developers/docs`, `/developers/how-it-works`, `/developers/roadmap`, `/developers/index` — conceptual API and sandbox copy only; no internal table dumps; no “live APIs ready” implication.

### Cross-references

- `docs/internal-platform-architecture.md` — §24 Phase 4F summary.

## Phase 5A — Sandbox Credential Architecture & API Key Vault Blueprint

Phase 5A introduces **three Supabase tables** that model how developer API identities will be governed before any
real key bytes exist in this repository: `developer_app_credentials` (non-secret metadata per app),
`developer_credential_lifecycle_events` (append-style audit), and `developer_credential_access_policies` (JSON
policy attachments). Columns intentionally exclude plaintext or ciphertext secret fields — only safe hints,
status fields, optional `public_prefix_hint`, `correlation_reference`, and `metadata`/`policy_value` JSON for
documentation-shaped governance.

### SQL & RLS (apply after Phase 4A)

1. `supabase/sql/developer_orgs_phase4a.sql` — prerequisite `developer_organizations`, `developer_apps`.
2. `supabase/sql/developer_credentials_phase5a.sql` — enables RLS on all three tables; **owners** `SELECT` on
   credential rows and related tables when the credential belongs to an app they own; **admins**
   (`public.tc_is_admin()`) **SELECT/INSERT/UPDATE/DELETE** everywhere. **Owners cannot INSERT or UPDATE**
   `developer_app_credentials` (no self-issuance at the policy layer). Grants are to `authenticated` only — no
   `anon` policies (same posture as Phase 4A).

### Pure configuration & console UI

- `lib/developerCredentialArchitectureConfig.js` — static types, lifecycle/rotation/risk vocabularies, signing
  concept objects, vault strategy blurbs, prefix **examples**, rotation/revocation models, and pure summary
  helpers (no `Date.now`, `Math.random`, `fetch`, or Supabase imports).
- `pages/dev-console/credential-architecture.jsx` — eight-section walkthrough using the config module only.
- `lib/developerCenterConfig.js` — `/dev-console/credential-architecture` route registration.
- Cross-links: `pages/dev-console/app-governance.jsx`, `pages/dev-console/my-apps.jsx`,
  `pages/developers/docs.jsx`, `pages/developers/how-it-works.jsx`.

### Hard constraints (Phase 5A)

- **No** live API key issuance, no secret storage in these tables, no crypto implementations, no webhooks/workers,
  and no treasury/wallet/withdrawal/PayPal/fraud execution paths.
- **No** new public HTTP handlers; public pages remain descriptive previews.

### Cross-references

- `docs/internal-platform-architecture.md` — §25 Phase 5A summary.
- Phase 4A–4E sections above in this document.

## Phase 5B — Authentication flow modeling & request verification simulation

Phase 5B introduces **`lib/developerAuthSimulationConfig.js`**, a definition-only module that models how a future
public edge would walk **request verification before execution**: transport and shape checks, credential lifecycle and
environment alignment, capability and catalog consistency, proof-field requirements, and conceptual replay windows.
The module exports thirteen `AUTH_FLOW_STAGES`, nine `AUTH_VERIFICATION_POLICIES`, sixteen `AUTH_FAILURE_STATES`, six
`AUTH_REQUEST_OUTCOMES`, replay and environment scope blurbs, ten `AUTH_SIMULATION_CASES` (each aligned to Phase 4D
`API_PRODUCTS` / `API_SANDBOX_CONTRACTS` rows and Phase 2C capability seeds), pure helper functions (`evaluateAuthSimulationCase`,
`buildAuthFlowTrace`, summaries), and `AUTH_SIMULATION_SAFETY_RULES`. There is **no** `Date.now`, `Math.random`, `fetch`,
Supabase access, signing, crypto, middleware, webhooks, workers, treasury, wallet, withdrawal, PayPal, or fraud execution.

### Developer Console & alignment

- `pages/dev-console/auth-simulator.jsx` — authenticated layout page with case/environment controls and pinned trace UI.
- `lib/developerCenterConfig.js` — registers `/dev-console/auth-simulator` in `DEV_CONSOLE_ROUTES`.
- Cross-links: `pages/dev-console/credential-architecture.jsx`, `pages/dev-console/product-catalog.jsx`,
  `pages/dev-console/app-governance.jsx`, `pages/dev-console/sandbox-analytics.jsx`, and public developer docs.

### Hard constraints (Phase 5B)

- **No** real authentication, API key parsing, HMAC verification, or TLS termination logic in this repository phase.
- **No** new HTTP handlers; evaluation is pure JavaScript over static seeds.
- **No** operational enforcement — outcomes are teaching enumerations only.

### Cross-references

- `docs/internal-platform-architecture.md` — §26 Phase 5B summary.
- Phase 5A credential architecture section above in this document.

## Phase 5C — API gateway & request envelope architecture simulation

Phase 5C introduces **`lib/developerGatewaySimulationConfig.js`**, layering **fourteen** deterministic gateway processing surfaces
(with documentation statuses `modeled`, `planned`, `future`), **delegated Phase 5B** authentication traces via `evaluateAuthSimulationCase`, ten `GATEWAY_ROUTING_OUTCOMES`, six `GATEWAY_CORRELATION_MODELS`,
four illustrative `GATEWAY_RATE_LIMIT_MODELS` rows aligned to Phase **4D** tiers, seeded request envelope merges enforcing the
immutable placeholder **`sandbox_credential_placeholder`** for every `credential_reference`, audit rehearsal fields from
`GATEWAY_AUDIT_ENVELOPE_FIELDS`, metadata stitches referencing `INTERNAL_OBSERVABILITY_PHASE`, `INTERNAL_RUNTIME_STATE_PHASE`,
`DEVELOPER_PRODUCT_PHASE`, and `DEVELOPER_SANDBOX_ANALYTICS_PHASE`, ten keyed `gateway.*` cases, pure helpers (`evaluateGatewaySimulationCase`,
`buildGatewayEnvelope`, trace/audit summaries), and `GATEWAY_SIMULATION_SAFETY_RULES`.

### Developer Console & alignment

- `pages/dev-console/gateway-simulator.jsx` — authenticated simulator with case/environment controls, delegated trace panels,
  audit JSON previews, and routing summaries.
- `lib/developerCenterConfig.js` registers `/dev-console/gateway-simulator`.
- Cross-links: `credential-architecture.jsx`, `product-catalog.jsx`, `sandbox-analytics.jsx`, `auth-simulator.jsx`, `/developers/docs`,
  `/developers/how-it-works`.

### Hard constraints (Phase 5C)

- **No** production or rehearsal HTTP gateway processes, routers, quotas, cryptography, webhook verification pipelines, issuance,
  secrets storage, outbound calls, telemetry emitters, or operational enforcement attributable to these seeds alone.
- **No** incremental schema migrations are required strictly for narration — envelopes remain authored in JavaScript.
- **Correlation / audit fields** are illustrative; they neither create append-only storage nor ingest customer identifiers pasted from browsers.

### Cross-references

- `docs/internal-platform-architecture.md` — §27 Phase 5C summary.
- Phase 5B authentication simulation immediately above.

## Phase 5D — Execution routing & service orchestration simulation

Phase 5D introduces **`lib/developerExecutionRoutingConfig.js`**, bridging **gateway acceptance narration** (
`evaluateGatewaySimulationCase`) into deterministic **sandbox delegate storytelling**: twelve routing stages,
ten `EXECUTION_SERVICE_TARGETS`, ten orchestration posture states, nine routing outcomes, nine dependency taxonomy rows,
five reconciliation posture labels, and ten seeded `routing.*` cases aligned to Phase **5C**, **5B**, **4D**, **3A**,
and **3B** keys (including optional `simulateGateway`). Pure helpers assemble routed envelopes (`buildExecutionRouteEnvelope`),
delegation plans, dependency chains, reconciliation summaries, and routing traces (`evaluateExecutionRoutingCase`).

### Developer Console & alignment

- `pages/dev-console/execution-routing.jsx` — authenticated simulator with seeded case/environment selectors, pinning for
  merged routed envelopes plus twelve-stage narration.
- `lib/developerCenterConfig.js` registers `/dev-console/execution-routing`.
- Cross-links: `gateway-simulator.jsx`, `auth-simulator.jsx`, `orchestration.jsx`, `runtime-state.jsx`, `execution-simulator.jsx`,
  `decision-simulator.jsx`, `/developers/docs`, `/developers/how-it-works`.

### Hard constraints (Phase 5D)

- **No** workload routers, service meshes, enqueue/dequeue primitives, adapters, webhook dispatchers, or live HTTP callers.
- **No** operational enforcement — narration only and always replayable offline.
- **No** treasury, wallet ledger mutations, payouts, PayPal integrations, cryptocurrency surfaces, fraud engines, custody,
  issuance, plaintext secrets, or Supabase/session reads inside the configuration module beyond what earlier phases describe.

### Cross-references

- `docs/internal-platform-architecture.md` — §28 Phase 5D summary.
- Phase 5C gateway simulation immediately above.

## Phase 5E — Request Lifecycle Readiness Audit

Phase 5E is a **readiness audit and hardening pass** across Phases **5A–5D** — not a new runtime surface. It confirms
the developer request lifecycle can be taught end-to-end from static configuration before API key issuance or live edge
work begins.

### Audit scope

| Area | Intent |
|------|--------|
| Config determinism | `developerCredentialArchitectureConfig`, `developerAuthSimulationConfig`, `developerGatewaySimulationConfig`, `developerExecutionRoutingConfig` — pure seeds, no I/O |
| Routes & cross-links | `DEV_CONSOLE_ROUTES` entries for credential-architecture, auth-simulator, gateway-simulator, execution-routing, product-catalog, sandbox-analytics, orchestration, runtime-state |
| Data alignment | Gateway `auth_case_key` → 5B; execution routing `gateway_case_key` → 5C; catalog/capability keys → 4D/2C; `credential_reference` placeholders only |
| UI safety | Banners/copy on Phase 5 pages state simulation-only posture (no real credentials, auth, gateway traffic, execution, or money) |
| SQL safety | `developer_credentials_phase5a.sql` — no secret columns; owner SELECT; admin issuance CRUD; RLS; no anon |

### Deterministic simulation

Merged traces (`buildAuthFlowTrace`, `buildGatewayStageTrace`, `evaluateExecutionRoutingCase`) are **replayable offline**.
Startup alignment guards throw on unknown foreign keys so seed drift is caught during import, not in production.

### No live processing

Phase 5E explicitly excludes APIs, middleware, credential issuance, gateway termination, queue workers, webhooks,
and all money-movement subsystems. Readiness means **documentation-shaped rehearsal** is coherent — not that traffic is
accepted.

### Readiness before key issuance

Operators should be able to walk: **Credential Architecture (5A)** → **Auth Simulator (5B)** → **Gateway Simulator (5C)**
→ **Execution Routing (5D)**, with **Product Catalog**, **Sandbox Analytics**, **Orchestration**, and **Runtime State**
as peer references, before enabling admin credential INSERT paths or external developer key distribution.

### Hard constraints (Phase 5E)

- **No** new executable endpoints, vault integrations, or enforcement hooks in this phase.
- **No** expansion of RLS beyond safety fixes on existing Phase 5A SQL.
- Fixes are **surgical** — alignment bugs, missing cross-links, copy clarifications, and evaluator correctness only.

### Cross-references

- `docs/internal-platform-architecture.md` — §29 Phase 5E summary.
- Phase 5D execution routing immediately above.

## Phase 6A — Runtime Activation Governance & Environment Isolation Blueprint

Phase 6A introduces **`lib/runtimeActivationGovernanceConfig.js`**, modeling future **runtime activation states**,
**environment isolation scopes**, **activation readiness gates**, **kill-switch concepts**, **safety envelopes**, and
**emergency shutdown** vocabulary before any real runtime, public API, or execution environment exists.

### Activation states & environment scopes

Ten `RUNTIME_ACTIVATION_STATES` span inactive, sandbox (internal/limited/partner/review), live (blocked/review/disabled),
`live_enabled_placeholder` (explicitly documents **no real live runtime**), and `emergency_shutdown`. Five
`RUNTIME_ENVIRONMENT_SCOPES` (`internal`, `sandbox`, `partner_sandbox`, `isolated_review`, `live_placeholder`) declare
credential, execution, observability, and data-isolation boundaries.

### Gates, isolation, envelopes, kill switches

Eleven `RUNTIME_ACTIVATION_GATES` each include `phase_ref` bridging Phase 4B governance, Phase 5A credentials, Phase 4C
capabilities, Phase 5B/5C/5D simulation passes, Phase 4E analytics health, Phase 5D reconciliation, Phase 5C audit narration,
Phase 2E observability, and Phase 2F runtime state readiness.
Eight `RUNTIME_ISOLATION_RULES`, seven `RUNTIME_SAFETY_ENVELOPES`, and ten `RUNTIME_KILL_SWITCH_MODELS` describe containment
without operational hooks.

### Simulation cases & evaluation

Ten seeded `RUNTIME_ACTIVATION_CASES` (e.g. `activation.internal.sandbox_ready`, `activation.emergency.shutdown`) carry
`gate_results`, expected outcomes (`activation_ready`, `review_required`, `blocked`, `isolated`, `emergency_locked`,
`not_ready`), and pure `evaluateRuntimeActivationCase()` merges — no Supabase, no network, no `Date.now()` / `Math.random()`.

### Developer Console & public docs

- `pages/dev-console/runtime-activation.jsx` — case/scope selectors, Run Activation Simulation, pinned gate/isolation/envelope/kill-switch panels.
- `lib/developerCenterConfig.js` — `/dev-console/runtime-activation` (icon **🔒** — 🛡️ already used on App Governance and internal Governance).
- Cross-links: `execution-routing.jsx`, `gateway-simulator.jsx`, `auth-simulator.jsx`, `runtime-state.jsx`.
- Public blurbs: `/developers/docs` (runtime activation governance preview), `/developers/how-it-works` (safety boundaries before runtime activation).

### Hard constraints (Phase 6A)

- **No** runtime activation, public APIs, middleware, workers/queues/schedulers, deployment pipelines, execution, webhooks, auth runtime, credential issuance, secrets, or money movement.
- **No** live runtime — `live_enabled_placeholder` is governance narration only.

### Cross-references

- `docs/internal-platform-architecture.md` — §30 Phase 6A summary.
- Phase 5E request lifecycle readiness audit immediately above.

## Phase 6B — Runtime Activation Readiness Audit

Phase 6B is a **readiness audit and hardening pass** across Phase **6A** and the Phase **5** rehearsal stack — not runtime
activation. It confirms activation governance vocabulary, gate-to-phase alignment, kill-switch narration, and Developer
Console safety copy stay deterministic and teaching-safe before any future runtime work begins.

### Audit scope

| Area | Intent |
|------|--------|
| Config determinism | `runtimeActivationGovernanceConfig.js` plus Phase 5A–5D configs — pure seeds, no `Date.now()` / `Math.random()` / I/O |
| Activation gate alignment | Eleven `RUNTIME_ACTIVATION_GATES` each carry `phase_ref` (4B, 5A, 4C, 5B, 5C, 5D, 4E, 2E, 2F) matching upstream rehearsal phases |
| Kill-switch model | Ten `RUNTIME_KILL_SWITCH_MODELS` — scope, `activation_effect`, and `recovery_requirements` labeled conceptual/simulated only |
| Environment isolation | `live_enabled_placeholder` / `live_placeholder` — no implication that live runtime exists |
| UI safety | `runtime-activation.jsx`, Phase 5 pages — banners state no live runtime, API traffic, credentials, workers, execution, or money |
| Routes & cross-links | `DEV_CONSOLE_ROUTES` `/dev-console/runtime-activation` (🔒); links from execution-routing, gateway, auth, credential-architecture, runtime-state |
| Public messaging | `/developers/docs`, `/developers/how-it-works` — conceptual activation governance only |

### Deterministic evaluation

`evaluateRuntimeActivationCase()` remains **pure**: same `case_key` and `environment_scope` always yield the same derived
outcome. Gate results are seeded per case — evaluators do not invoke Phase 5 simulators at runtime.

### No live processing

Phase 6B explicitly excludes runtime activation, public APIs, middleware, workers/queues, webhooks, credential issuance,
secrets, and all money-movement subsystems. Readiness means **governance-shaped rehearsal** is coherent — not that traffic is
accepted.

### Hard constraints (Phase 6B)

- **No** new executable endpoints, enforcement hooks, or operational kill-switch wiring.
- Fixes are **surgical** — `phase_ref` metadata, copy clarifications, cross-links, and evaluator field completeness only.

### Cross-references

- `docs/internal-platform-architecture.md` — §31 Phase 6B summary.
- Phase 6A runtime activation governance blueprint immediately above.

## Phase 7A — Developer Identity & Workspace Foundation

Phase 7A introduces a **developer workspace shell** — identity vocabulary, onboarding checkpoints, environment
notices, health indicators, recommendations, and a deterministic readiness score assembled from static seeds. It is the
home surface for “your Tropicash developer workspace” before credential issuance or live API access.

### Scope

| Area | Intent |
|------|--------|
| Config | `lib/developerWorkspaceConfig.js` — environment modes, tiers, onboarding stages, seeds, pure helpers |
| Console UI | `/dev-console/workspace` — hero, identity cards, readiness, timeline, environment panel, org summary, recommendations, safety copy |
| Routes | `lib/developerCenterConfig.js` — `DEV_CONSOLE_ROUTES` entry `/dev-console/workspace` (icon **🏠**) |
| Cross-links | Overview, My Apps, Developer Governance, Credential Architecture; workspace links back to My Apps, Governance, Credential Architecture, Product Catalog |

### Vocabulary (exported)

- **Environment modes:** `sandbox`, `live_preview`, `restricted`, `suspended`
- **Developer tiers:** `explorer`, `builder`, `partner`, `enterprise`
- **Onboarding stages:** `access_approved` → `sandbox_ready` (six ordered stages)

### Seeded artifacts (minimum counts)

- Workspace identity fields (`workspace_id`, `display_name`, `developer_tier`, `onboarding_stage`, `environment_mode`, simulated timestamps)
- 6+ onboarding checkpoints, 8+ workspace events, 6+ health indicators, 6+ environment notices, 8+ recommendation cards
- Organization summary: `active_org_count`, `sandbox_apps_count`, `pending_reviews_count`, `approved_capabilities_count`

### Pure helpers

`getWorkspaceOverview()`, `getWorkspaceHealth()`, `getWorkspaceTimeline()`, `getWorkspaceRecommendations()`,
`getWorkspaceEnvironmentMeta()`, `buildWorkspaceSummary()`, `buildWorkspaceReadinessScore()` — no I/O, no clocks, no
randomness.

### Hard constraints (Phase 7A)

- **No** API keys, secrets, live APIs, payment/wallet/treasury/fraud, workers/webhooks, credential issuance, runtime
  execution, or money movement.
- **No** `Date.now()`, `Math.random()`, Supabase writes, network, or realtime on the workspace page.
- Org/app counts on Workspace are **static**; My Apps remains authoritative for live rows.

### Cross-references

- `docs/internal-platform-architecture.md` — §32 Phase 7A summary.
- Phase 6B runtime activation readiness audit immediately above.

## Phase 7B — Workspace Personalization & Context Layer

Phase 7B adds a **personalization and context layer** on top of Phase 7A — developer personas, context states,
environment preferences, milestone progress, simulated activity feed, rule-driven smart recommendations, and health
context overlays. All artifacts remain static seeds; the Developer Operating Center narrative deepens without
credentials, live APIs, or Supabase writes.

### Scope

| Area | Intent |
|------|--------|
| Config | `lib/developerWorkspaceContextConfig.js` — personas, context states, preferences, milestones, rules, activity/notices, pure helpers |
| Console UI | `/dev-console/workspace` — adds Developer Persona, Context Summary, Contextual Readiness, Environment Preference, Activity Feed, Smart Recommendations, Milestone Progress, Workspace Health Context (7A sections retained) |
| Alignment | Read-only imports from `lib/developerWorkspaceConfig.js` for identity and recommendation card keys |
| Cross-links | My Apps, Product Catalog, Sandbox Analytics, Credential Architecture — workspace shortcut updated to Phase 7A + 7B |

### Vocabulary (exported)

- **Personas:** `explorer`, `builder`, `integrator`, `operator`, `partner`, `enterprise` (label, description, onboarding_priority, suggested_actions, maturity_level)
- **Context states:** `onboarding`, `active`, `sandbox_ready`, `review_required`, `capability_pending`, `organization_setup`, `restricted`
- **Environment preferences:** `sandbox_first`, `live_preview`, `governance_first`, `capability_first`, `analytics_first`
- **Milestones:** 8 including `credential_prepared_placeholder` — **future planning only — no credentials issued**

### Seeded artifacts (minimum counts)

- 6 persona types, 7 context states, 5 environment preferences
- 8 onboarding milestones, 7+ recommendation rules, 9+ activity seeds, 6+ context notices
- `WORKSPACE_CONTEXT_SEED` — persona_key, context_state, environment_preference aligned with Phase 7A identity seed

### Pure helpers

`getDeveloperPersona()`, `getWorkspaceContext()`, `getWorkspaceEnvironmentPreference()`, `getWorkspaceActivityFeed()`,
`getWorkspaceNotices()`, `getWorkspaceRecommendations()` (context rule merge), `buildWorkspaceContextSummary()`,
`buildWorkspaceProgressSummary()`, `buildWorkspaceRecommendationPriority()`, `buildWorkspaceHealthContext()` — no I/O,
no clocks, no randomness.

### Hard constraints (Phase 7B)

- **No** API keys, secrets, live APIs, payment/wallet/treasury/fraud, workers/webhooks, credential issuance, runtime
  execution, or money movement.
- **No** `Date.now()`, `Math.random()`, Supabase writes, network, fetch, or storage on the workspace page.
- `credential_prepared_placeholder` milestone is explicit placeholder copy only.
- Smart recommendations filter/boost Phase 7A cards via rules — links are orientation only.

### Cross-references

- `docs/internal-platform-architecture.md` — §33 Phase 7B summary.
- Phase 7A developer identity & workspace foundation immediately above.

## Phase 7C — Workspace Readiness Validation

Phase 7C is a **readiness audit and hardening pass** on Phases 7A–7B — routes, config determinism, workspace UI
safety copy, bidirectional cross-links, and documentation. No new runtime, credentials, Supabase writes, workers,
webhooks, or money subsystems.

### Scope

| Area | Intent |
|------|--------|
| Routes / access | `/dev-console`, `/dev-console/workspace`, My Apps, Product Catalog, Credential Architecture — `RouteAuthGuard` + `developerAccessGate` for approved dev + admin; `/developers` public; Navbar `useDeveloperNavHref` → `/dev-console` when allowed |
| Config determinism | `lib/developerWorkspaceConfig.js`, `lib/developerWorkspaceContextConfig.js` — no `Date.now()`, `Math.random()`, fetch, Supabase, or storage; helpers return copies without mutating seeds |
| Console UI | `/dev-console/workspace` — Phase 7A + 7B sections, safety banners, mobile-friendly wrapping on long mono fields |
| Cross-links | Bidirectional workspace links: Overview ↔ Workspace, My Apps, Developer Governance, Credential Architecture, Product Catalog, Sandbox Analytics |
| Docs | This section + `docs/internal-platform-architecture.md` §34 |

### Validation checklist (7C)

- Approved developer or admin reaches workspace and related console routes; unapproved users see `DevConsoleAccessDenied`.
- Workspace page imports config modules only — no network I/O on mount.
- `WORKSPACE_SAFETY_RULES` and `WORKSPACE_CONTEXT_SAFETY_RULES` rendered on workspace; credential placeholder copy explicit.
- Overview entry card references Phase 7A + 7B; related-tools footer links back to Overview and peer console pages.

### Hard constraints (Phase 7C)

- **Audit + hardening only** — surgical fixes to broken access paths, cross-links, copy, and wrapping; no feature expansion.
- **No** API keys, secrets, live APIs, payment/wallet/treasury/fraud, workers/webhooks, credential issuance, runtime execution, or Supabase writes introduced by this phase.

### Cross-references

- `docs/internal-platform-architecture.md` — §34 Phase 7C summary.
- Phase 7B workspace personalization & context layer immediately above.

## Phase 8A — Sandbox Credential Lifecycle Foundation

Phase 8A introduces a **sandbox credential lifecycle control surface** for approved developer apps — placeholder
statuses, request types, environments, visibility states, readiness checks, timeline seeds, and recommendations. This
is **metadata and governance only**: no real API keys, secrets, tokens, signing material, authentication runtime, API
routes, traffic, webhooks, workers, Supabase writes, or money movement.

| Area | Deliverable |
|------|-------------|
| Config | `lib/developerCredentialLifecycleConfig.js` — `CREDENTIAL_LIFECYCLE_PHASE`, statuses, request types, environments, visibility, safety rules, timeline (8+ steps with static Step labels), readiness checks (8), recommendations; pure helpers |
| Console UI | `/dev-console/credential-lifecycle` — DevConsoleLayout, safety banner, summary cards, readiness checklist, timeline, placeholder types, visibility rules, recommendations, related tools |
| Routes | `lib/developerCenterConfig.js` — `/dev-console/credential-lifecycle` (icon **🪪**) |
| Cross-links | Workspace, My Apps, Credential Architecture, Auth Simulator, Gateway Simulator, Runtime Activation |
| Alignment | Optional read-only refs from `lib/developerCredentialArchitectureConfig.js` (Phase 5A type vocabulary) |

### Readiness checks (seeded)

- `app_registered`, `sandbox_activation_approved`, `capability_assigned`, `governance_review_completed`,
  `credential_architecture_ready`, `auth_simulation_available`, `gateway_simulation_available`,
  `runtime_activation_blocked_for_live` — each with `passed`, `blocking`, `related_route`, `why_it_matters`.

### Hard constraints (Phase 8A)

- **Placeholder only** — statuses such as `issued_placeholder` may show prefix-shaped documentation; zero entropy and no auth.
- **No** secret generation, vault writes, live API access, runtime execution, or Supabase mutations from this phase.
- Config and UI remain **deterministic** (no `Date.now`, `Math.random`, fetch, or storage).

### Cross-references

- `docs/internal-platform-architecture.md` — §35 Phase 8A summary.
- Phase 5A credential architecture metadata tables and Phase 7C workspace readiness immediately upstream.

## Phase 8B — Credential Governance & Visibility Layer

Phase 8B expands Phase 8A with **metadata-only credential governance** — governance states, developer/admin
visibility rules, placeholder issuance review outcomes, deterministic history seeds, visibility previews (prefix hints
only), suspension/revocation teaching models, and risk summaries. Still **no secrets, auth runtime, live API, webhooks,
workers, Supabase writes, or money movement**.

| Area | Deliverable |
|------|-------------|
| Config | `lib/developerCredentialGovernanceConfig.js` — `CREDENTIAL_GOVERNANCE_PHASE`, 8 governance states, 7 visibility rules, 6 review outcomes, 4 actors, safety rules, history (8+ rows), rationale seeds, visibility preview seeds (prefix `tc_sbx_` only), 5 revocation models; pure helpers |
| Console UI | `/dev-console/credential-lifecycle` — adds 8B sections: governance summary, review readiness, visibility rules, placeholder preview, history, suspension/revocation, rationale cards, risk summary (8A sections retained) |
| Cross-links | Workspace, Credential Architecture, Auth Simulator, Gateway Simulator, Runtime Activation, App Governance — Credential Lifecycle links with metadata-only governance copy |

### Governance states (seeded)

- `not_requested`, `review_ready`, `pending_admin_review`, `approved_placeholder`,
  `developer_visible_metadata_only`, `suspended_placeholder`, `revoked_placeholder`, `archived_placeholder`.

### Visibility rules (seeded)

- `developer_can_view_metadata`, `developer_cannot_view_secret`, `admin_can_review_metadata`,
  `admin_cannot_view_secret_material`, `visibility_requires_approved_app`,
  `visibility_requires_sandbox_environment`, `live_visibility_blocked`.

### Hard constraints (Phase 8B)

- **Metadata only** — previews show labels, environment, status, and prefix-shaped hints; never key suffixes, tokens, hashes, or encrypted blobs.
- **No** secret generation, vault writes, authentication runtime, live API access, or Supabase mutations from this phase.
- Config and UI remain **deterministic** (no `Date.now`, `Math.random`, fetch, or storage).

### Cross-references

- `docs/internal-platform-architecture.md` — §36 Phase 8B summary.
- Phase 8A sandbox credential lifecycle foundation immediately upstream.

## Phase 8C — Credential Readiness Audit & Governance Hardening

Phase 8C is a **readiness audit and hardening pass** on Phases **8A–8B** — routes, config determinism, placeholder
safety copy, credential-lifecycle UI wrapping, bidirectional cross-links, and documentation. No new runtime,
credentials, Supabase writes, workers, webhooks, or money subsystems.

### Scope

| Area | Intent |
|------|--------|
| Routes / access | `/dev-console/credential-lifecycle`, workspace, credential-architecture, auth-simulator, gateway-simulator, runtime-activation, app-governance — `RouteAuthGuard` + `developerAccessGate` for approved dev + admin; `/developers` public; Navbar `useDeveloperNavHref` → `/dev-console` when allowed |
| Config determinism | `lib/developerCredentialLifecycleConfig.js`, `lib/developerCredentialGovernanceConfig.js` — no `Date.now()`, `Math.random()`, fetch, Supabase, localStorage, or crypto; helpers return copies without mutating seeds |
| Placeholder safety | Seeds and UI must state placeholder only, metadata only, no secret material, no active authentication, no live API access |
| Console UI | `/dev-console/credential-lifecycle` — Phase 8A + 8B sections, safety banners, mobile-friendly wrapping on prefix hints |
| Cross-links | Bidirectional links among Workspace, Credential Architecture, Credential Lifecycle, Auth Simulator, Gateway Simulator, Runtime Activation, Developer Governance |
| Docs | This section + `docs/internal-platform-architecture.md` §37 |

### Validation checklist (8C)

- Approved developer or admin reaches credential-lifecycle and related console routes; unapproved users see `DevConsoleAccessDenied`.
- Credential-lifecycle page imports config modules only — no network I/O on mount.
- `SANDBOX_CREDENTIAL_SAFETY_RULES` and `CREDENTIAL_GOVERNANCE_SAFETY_RULES` rendered; primary banner includes required placeholder-safety phrases.
- Related-tools footers on peer pages link back to Credential Lifecycle with consistent **8A + 8B** labels.

### Hard constraints (Phase 8C)

- **Audit + hardening only** — surgical fixes to broken access paths, cross-links, copy, and wrapping; no feature expansion.
- **No** API keys, secrets, live APIs, payment/wallet/treasury/fraud, workers/webhooks, credential issuance, runtime execution, or Supabase writes introduced by this phase.

### Cross-references

- `docs/internal-platform-architecture.md` — §37 Phase 8C summary.
- Phase 8B credential governance & visibility layer immediately above.

## Phase 9A — Sandbox API Product Access Layer

Phase 9A introduces a **sandbox API product access control surface** — entitlement previews, capability → product
mapping, access scopes, governance restrictions, and sandbox usage envelopes. This is **metadata and configuration
only**: no real endpoints, API execution, credentials, secrets, authentication runtime, webhooks, workers, Supabase
writes, or money movement.

| Area | Deliverable |
|------|-------------|
| Config | `lib/developerProductAccessConfig.js` — `PRODUCT_ACCESS_PHASE`, 14 products, 6 scopes, 8 states, 8 restrictions, 4 environments, 7 governance rules, 14 usage envelopes, 8 readiness checks, 7 recommendations, safety rules; pure helpers |
| Console UI | `/dev-console/product-access` — DevConsoleLayout, 11 sections (hero, safety banner, summary cards, product grid, capability map, scopes, restrictions, envelopes, readiness, recommendations, related tools) |
| Routes | `lib/developerCenterConfig.js` — `/dev-console/product-access` (icon **🎫**) |
| Cross-links | Workspace, Product Catalog, Credential Lifecycle, Auth Simulator, Gateway Simulator, Runtime Activation |

### Products (seeded examples)

- `wallet_funding`, `wallet_balance`, `send_money`, `receive_money`, `withdrawal_requests`, `transaction_history`,
  `notifications`, `fraud_alerts_placeholder`, `identity_placeholder`, `analytics_placeholder`, `treasury_placeholder`,
  `sandbox_webhooks_placeholder`, plus `checkout_session_preview` and `wallet_reserve_sim`.

Each row includes `sandbox_status`, `live_status` (blocked), `required_capabilities`, `access_scope`, `governance_level`,
`risk_level`, `visibility`, and `placeholder: true` with copy stating sandbox only, preview only, no live execution.

### Access scopes (seeded)

- `read_metadata`, `simulate_action`, `preview_capability`, `governance_review`, `audit_visibility`, `analytics_preview`
  — each with `live_enabled: false`.

### Usage envelopes (seeded)

- `wallet_funding` — preview_funding_limit `$100/day sandbox`, execution disabled.
- `send_money` — preview_transfer_limit `$50 sandbox`, execution disabled.
- `treasury_placeholder` — admin review only.
- `sandbox_webhooks_placeholder` — event preview only.
- Plus envelopes for balance read, receive, withdrawals, history, notifications, fraud, identity, analytics, checkout,
  reserve simulation.

### Hard constraints (Phase 9A)

- **Metadata only** — product access rows are not routable entitlements and do not grant capabilities automatically.
- **No** secret generation, auth runtime, live API access, workers, webhooks, Supabase mutations, or money movement.
- Config and UI remain **deterministic** (no `Date.now`, `Math.random`, fetch, storage, or crypto).

### Cross-references

- `docs/internal-platform-architecture.md` — §38 Phase 9A summary.
- Phase 4D product catalog and Phase 8A–8C credential lifecycle immediately upstream.

## Phase 9B — Product Access Governance & Visibility Layer

Phase 9B expands Phase 9A into a **governed entitlement visibility and review system** — entitlement governance
states, developer/admin visibility rules, product access review outcomes, entitlement history, restriction rationale
cards, suspension/revocation modeling, sandbox entitlement previews, and governance risk summaries. This remains
**metadata and configuration only**: no endpoints, API execution, credentials, secrets, authentication runtime,
webhooks, workers, Supabase writes, or money movement.

| Area | Deliverable |
|------|-------------|
| Config | `lib/developerProductGovernanceConfig.js` — `PRODUCT_GOVERNANCE_PHASE`, 8 entitlement states, 8 visibility rules, 6 review outcomes, 4 actors, 8+ history seeds, 6 rationale cards, 8 entitlement preview seeds, 6 revocation models, safety rules; pure helpers |
| Console UI | `/dev-console/product-access` — sections 9B.1–9B.8 (governance state, review readiness, visibility rules, entitlement preview, history, revocation models, rationale cards, risk summary) atop Phase 9A sections |
| Cross-links | Workspace, Credential Lifecycle, App Governance, Auth Simulator, Gateway Simulator, Runtime Activation — sandbox product entitlement previews and metadata-only product governance copy |

### Entitlement states (seeded)

- `unavailable`, `review_ready`, `pending_governance_review`, `approved_sandbox_placeholder`,
  `developer_visible_metadata_only`, `suspended_placeholder`, `revoked_placeholder`, `archived_placeholder`

### Visibility rules (seeded)

- `developer_can_view_metadata`, `developer_cannot_execute`, `developer_cannot_access_live`,
  `admin_can_review_metadata`, `access_requires_capability`, `access_requires_approved_app`,
  `sandbox_only_visibility`, `metadata_only_visibility`

### Entitlement preview seeds (examples)

- `wallet_funding`, `send_money`, `treasury_placeholder`, `sandbox_webhooks_placeholder`, plus balance read,
  receive money, fraud placeholder, checkout session — each with scope, execution disabled, sandbox limit labels;
  **never** endpoints, tokens, credentials, auth headers, live URLs, or execution payloads.

### Revocation / suspension models (seeded)

- `governance_restriction`, `capability_removed`, `app_suspended_dependency`, `sandbox_review_failed`,
  `developer_requested_removal`, `emergency_policy_restriction`

### Hard constraints (Phase 9B)

- **Metadata only** — governance rows do not enable APIs, execution, or live access.
- **No** secret generation, auth runtime, endpoint URLs, workers, webhooks, Supabase mutations, or money movement.
- Config and UI remain **deterministic** (no `Date.now`, `Math.random`, fetch, storage, or crypto).

### Cross-references

- `docs/internal-platform-architecture.md` — §39 Phase 9B summary.
- Phase 9A sandbox product access layer immediately below.

## Phase 9C — Product Access Readiness Audit & Governance Hardening

Phase 9C is a **readiness audit and hardening pass** on Phases **9A–9B** — routes, config determinism, metadata-only
safety copy, product-access UI wrapping, bidirectional cross-links, and documentation. No new runtime, endpoints,
credentials, Supabase writes, workers, webhooks, or money subsystems.

### Scope

| Area | Intent |
|------|--------|
| Routes / access | `/dev-console/product-access`, workspace, product-catalog, credential-lifecycle, auth-simulator, gateway-simulator, runtime-activation, app-governance — `RouteAuthGuard` + `developerAccessGate` for approved dev + admin; `/developers` public; Navbar `useDeveloperNavHref` → `/dev-console` when allowed |
| Config determinism | `lib/developerProductAccessConfig.js`, `lib/developerProductGovernanceConfig.js` — no `Date.now()`, `Math.random()`, fetch, Supabase, localStorage, or crypto; helpers return copies without mutating seeds |
| Metadata-only safety | Seeds and UI must state sandbox only, preview only, metadata only, no execution, no endpoints, no live access — never live URLs, tokens, credentials, or execution payloads in preview seeds |
| Console UI | `/dev-console/product-access` — Phase 9A sections 1–11 + 9B.1–9B.8, safety banners, section 2 governance bridge, mobile-friendly wrapping on config path hints |
| Cross-links | Bidirectional links among Workspace, Product Catalog, Credential Lifecycle, Auth Simulator, Gateway Simulator, Runtime Activation, Developer Governance, and Product Access |
| Docs | This section + `docs/internal-platform-architecture.md` §40 |

### Validation checklist (9C)

- Approved developer or admin reaches product-access and related console routes; unapproved users see `DevConsoleAccessDenied`.
- Product-access page imports config modules only — no network I/O on mount.
- `PRODUCT_ACCESS_SAFETY_RULES` and `PRODUCT_GOVERNANCE_SAFETY_RULES` rendered; primary banners include required metadata-only phrases.
- Related-tools footers and teal callout banners on peer pages link back to Product Access with consistent **9A + 9B** labels.
- Entitlement preview seeds contain product labels, scope, execution disabled, and sandbox limit text only.

### Hard constraints (Phase 9C)

- **Audit + hardening only** — surgical fixes to broken access paths, cross-links, copy, and wrapping; no feature expansion.
- **No** API keys, secrets, live APIs, payment/wallet/treasury/fraud, workers/webhooks, credential issuance, runtime execution, or Supabase writes introduced by this phase.

### Cross-references

- `docs/internal-platform-architecture.md` — §40 Phase 9C summary.
- Phase 9B product access governance & visibility layer immediately above.

## Phase 10A — Sandbox API Request & Flow Simulation Layer

Phase 10A introduces a **sandbox API request and response simulation layer** that stitches the developer operating
center into the existing request-lifecycle teaching stack:

Developer app → credential placeholder → product entitlement → simulated request path → sandbox response preview.

| Surface | Role |
| --- | --- |
| Config | `lib/developerSandboxRequestFlowConfig.js` — twelve flow stages, ten outcomes, ten failure states, ten request cases, response preview catalog, safety rules |
| Console UI | `/dev-console/request-simulator` — envelope, stage trace, validation summary, response preview (preview only), failure states, outcome summary |
| Delegates | Read-only calls into Phase 5B auth, Phase 5C gateway, and Phase 5D execution routing `evaluate*Case` helpers by seeded case keys |
| Alignment | Read-only imports from Phases 8A–8B (credential), 9A–9B (product access / governance), 4D catalog `product_key` rows |

### Modeled flow (configuration only)

1. **developer_request_selected** — operator picks a seeded `SANDBOX_REQUEST_CASES` row.
2. **credential_placeholder_checked** — Phase 8A lifecycle posture (`approved_placeholder` / `issued_placeholder`).
3. **product_entitlement_checked** — Phase 9A access state visibility.
4. **capability_scope_checked** — capability ↔ product alignment (no automatic grant).
5. **auth_simulation_linked** — `evaluateAuthSimulationCase(auth_case_key)`.
6. **gateway_simulation_linked** — `evaluateGatewaySimulationCase(gateway_case_key)`.
7. **execution_routing_linked** — `evaluateExecutionRoutingCase(routing_case_key)`.
8. **request_payload_shape_checked** — deterministic JSON preview field validation.
9. **sandbox_response_selected** — `SANDBOX_RESPONSE_PREVIEWS` body (labeled preview only).
10. **audit_preview_prepared** — append-only narrative placeholders.
11. **observability_preview_prepared** — Phase 2E/2F correlation vocabulary (no emitter).
12. **simulated_response_returned** — terminal or non-terminal outcome for console display only.

`route_preview` strings are prefixed **`[preview only]`** — they do not register HTTP routes or activate endpoints.

### Seeded request cases (keys)

- `request.wallet.balance.preview`
- `request.wallet.funding.simulate`
- `request.send.money.simulate`
- `request.transaction.history.preview`
- `request.notifications.preview`
- `request.fraud.alerts.placeholder`
- `request.analytics.summary.preview`
- `request.webhook.event.preview`
- `request.treasury.placeholder.blocked`
- `request.live.environment.blocked`

### Hard constraints (Phase 10A)

- **Simulation + metadata only** — no real endpoints, API traffic, auth runtime, credentials, secrets, middleware, webhooks, workers, Supabase writes, money, treasury, or fraud execution.
- **Deterministic** — no `Date.now()`, `Math.random()`, `fetch`, storage, or crypto; startup alignment asserts auth/gateway/routing case keys and catalog `product_key` references.
- **Response previews** — never include secrets, tokens, live URLs, real balances, execution ids, or production transaction ids.

### Cross-references

- `docs/internal-platform-architecture.md` — §41 Phase 10A summary.
- Phase 9C product access readiness audit immediately above.
- Phases 5B–5D authentication, gateway, and execution routing simulations.

## Phase 10B — Request Governance & Observability Layer

Phase 10B adds **request governance, observability vocabulary, and audit trail seeds** on top of Phase 10A sandbox
request flow simulation. The layer teaches how sandbox request rehearsals would be reviewed, correlated, and narrated
in audit trails — without executing HTTP traffic, emitting telemetry, writing logs, or activating endpoints.

| Surface | Role |
| --- | --- |
| Config | `lib/developerRequestGovernanceConfig.js` — eight governance states, eight visibility rules, six review outcomes, six actors, ten observability signals, nine audit trail seeds, eight restriction rationales, six blocking models, safety rules |
| Console UI | `/dev-console/request-simulator` sections **10B.1–10B.8** — governance summary, review outcomes, visibility rules, observability signals, audit trail, blocking models, rationales, risk summary |
| Alignment | Read-only `SANDBOX_REQUEST_CASE_KEYS` from Phase 10A; vocabulary bridges to Phase 2E observability and Phase 2F event-store teaching seeds |
| Delegates | Auth and gateway simulation actors reference Phase 5B/5C evaluate*Case linkage — trace narration only |

### Modeled governance (configuration only)

1. **Governance states** — from `request_not_modeled` through `developer_visible_request_metadata`, suspension, revocation, and archive placeholders.
2. **Visibility rules** — developers see request metadata only; execution and live traffic denied; entitlement and credential placeholder prerequisites.
3. **Observability signals** — static correlation labels mapped to Phase 10A stage keys (`developer_request_selected` through `simulated_response_returned`) with Phase 2E anchor vocabulary.
4. **Audit trail seeds** — nine deterministic append-only narrative rows with static step labels (no clock timestamps).
5. **Blocking models** — entitlement, credential, auth denial, gateway denial, routing block, and environment isolation teaching paths.
6. **Restriction rationales** — explain metadata-only visibility, operator review gates, sandbox boundary, and observability-without-emitters.

### Hard constraints (Phase 10B)

- **Simulation + metadata only** — no real endpoints, API traffic, auth runtime, credentials, secrets, middleware, webhooks, workers, Supabase writes, telemetry emitters, audit ingestion, money, treasury, or fraud execution.
- **Deterministic** — no `Date.now()`, `Math.random()`, `fetch`, storage, or crypto; startup alignment asserts array counts and preview seed keys.
- **Observability** — signals and audit trails are vocabulary only — they do not create sessions, metrics, or production correlation ids.

### Cross-references

- `docs/internal-platform-architecture.md` — §42 Phase 10B summary.
- Phase 10A sandbox API request & flow simulation layer immediately above.
- Phases 2E–2F observability and runtime-state blueprints (teaching vocabulary only).

## Phase 10C — Request Simulation Readiness Audit & Governance Hardening

Phase 10C is a **readiness audit and hardening pass** on Phases **10A–10B** — routes, config determinism,
simulation-safety copy, request-simulator UI wrapping, bidirectional cross-links, failure-to-governance mapping, and
documentation. No new runtime, endpoints, credentials, Supabase writes, workers, webhooks, or money subsystems.

### Scope

| Area | Intent |
|------|--------|
| Routes / access | `/dev-console/request-simulator`, workspace, product-access, product-catalog, credential-lifecycle, auth-simulator, gateway-simulator, execution-routing, runtime-activation, app-governance — `RouteAuthGuard` + `developerAccessGate` for approved dev + admin; `/developers` public; Navbar `useDeveloperNavHref` → `/dev-console` when allowed |
| Config determinism | `lib/developerSandboxRequestFlowConfig.js`, `lib/developerRequestGovernanceConfig.js` — no `Date.now()`, `Math.random()`, fetch, Supabase, localStorage, or crypto; helpers return copies without mutating seeds; `REQUEST_FAILURE_GOVERNANCE_LINKS` maps every `failure_key` to blocking models and rationales |
| Simulation safety | Seeds and UI must state simulation only, metadata only, preview only, no execution, no live request traffic, no endpoint activation, no money movement — never live URLs, tokens, credentials, or execution payloads in preview seeds |
| Observability / audit | `REQUEST_OBSERVABILITY_SIGNALS` and `REQUEST_AUDIT_TRAIL_SEEDS` use static step labels (no clocks); signals correlate to Phase 10A stage keys; blocking models map to failure keys and outcomes |
| Console UI | `/dev-console/request-simulator` — Phase 10A sections 3–9 + 10B.1–10B.8, consolidated safety banners, failure cards show 10B blocking/rationale links, mobile-friendly wrapping on mono paths and JSON previews |
| Cross-links | Bidirectional links among Workspace, Product Catalog, Product Access, Credential Lifecycle, Auth Simulator, Gateway Simulator, Execution Routing, Runtime Activation, Developer Governance, and Request Simulator with consistent **10A + 10B** labels |
| Docs | This section + `docs/internal-platform-architecture.md` §43 |

### Validation checklist (10C)

- Approved developer or admin reaches request-simulator and related console routes; unapproved users see `DevConsoleAccessDenied`.
- Request-simulator page imports config modules only — no network I/O on mount for simulation evaluation.
- `SANDBOX_REQUEST_SAFETY_RULES` and `REQUEST_GOVERNANCE_SAFETY_RULES` rendered; primary banners include required simulation-safety phrases.
- Every `SANDBOX_REQUEST_FAILURE_STATES` `failure_key` has a `REQUEST_FAILURE_GOVERNANCE_LINKS` row validated at module startup.
- Related-tools footers and callout banners on peer pages link back to Request Simulator with consistent **10A + 10B** labels.
- `evaluateSandboxRequestCase` blocking stages align with governance blocking model narration.

### Hard constraints (Phase 10C)

- **Audit + hardening only** — surgical fixes to broken access paths, cross-links, copy, failure mapping, and wrapping; no feature expansion.
- **No** API keys, secrets, live APIs, payment/wallet/treasury/fraud, workers/webhooks, credential issuance, runtime execution, or Supabase writes introduced by this phase.

### Cross-references

- `docs/internal-platform-architecture.md` — §43 Phase 10C summary.
- Phase 10B request governance & observability layer immediately above.

