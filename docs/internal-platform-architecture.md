# Tropicash Internal Platform Architecture

> **Status:** planning document with narrow **Phase 4A–4E** exceptions (§19–§23) plus **Phase 5A–5E**
> developer previews (§25–§29):
> developer org/app registration tables and console UI exist as metadata-only
> infrastructure. Otherwise this file describes intended boundaries and
> integration points. Treasury, wallet ledger, withdrawal payout, PayPal funding,
> and fraud-engine logic are owned by the Treasury workstream and are explicitly
> out of scope.

This document is the source-of-truth narrative for **how the Tropicash
ecosystem is segmented**. It is referenced by:

- `lib/developerCenterConfig.js`
- `components/devconsole/DevConsoleLayout.jsx`
- `pages/developers/**`
- `pages/dev-console/**`

When the boundaries below change, update this file in the same PR.

---

## 1. Three-layer separation

Tropicash is now structured as three deliberately separate platform layers:

### A. Public Developer APIs

- Reachable via the future `api.tropicash.com` surface.
- Authenticated by **developer API keys** issued via the Developer Console.
- Subject to **auth, rate limiting, scoped permissions, and audit logging**
  before reaching any internal service.
- Examples (planned, not implemented): Wallet API, Payments API, Payouts API,
  Webhooks.
- **Never** call internal Blue Atlantic services directly. All traffic flows
  through the public-API edge layer.

### B. Authenticated Developer Console

- The infrastructure-management UI at `/dev-console/*`.
- Backed by a Supabase session (the same `RouteAuthGuard` that protects the
  rest of the Tropicash app).
- Will eventually expose: app registration, API key issuance, webhook
  configuration, request logs, sandbox tooling, billing/settings.
- **Never** exposes secrets to anonymous traffic. **Never** lists dev-console
  routes in the public Navbar.

### C. Internal Blue Atlantic Services

- Private services that power Tropicash, EliteHire Pro, Sentinel, and Triton.
- **Internal APIs are never public.** They run on internal networks and are
  not addressable from `api.tropicash.com`.
- Treasury systems stay isolated (see §3).

```
                      ┌──────────────────────────────┐
   External           │     Public Developer APIs    │     ⟵ api.tropicash.com
   traffic   ───▶     │  (auth, rate limit, scopes)  │
                      └──────────────┬───────────────┘
                                     │
                      ┌──────────────▼───────────────┐
                      │ Internal platform edge layer │     ⟵ owned by Tropicash
                      └──────────────┬───────────────┘
                                     │
            ┌──────────┬─────────────┼────────────┬──────────┐
            ▼          ▼             ▼            ▼          ▼
       Tropicash   EliteHire      Sentinel      Triton    (future)
       wallets /   Pro payments   reporting     funding /
       payments                                 withdrawal
                                                bridge
```

---

## 2. Planned internal integrations

The Blue Atlantic platforms integrate with Tropicash through **internal
service calls**, not through the public developer API.

### Tropicash ↔ Triton

- **Direction:** bidirectional.
- **Purpose:** Triton acts as the funding/withdrawal bridge for Tropicash
  wallets. Funding requests originated in Triton land in Tropicash wallet
  balances; withdrawal payouts originated in Tropicash flow out through
  Triton.
- **Boundary rules:**
  - The Tropicash wallet ledger remains the source of truth for balances.
  - Triton-side movements emit events (e.g. `wallet.funded`,
    `payout.completed`) that Tropicash consumes; Tropicash does not poll
    Triton's database.
  - Treasury reconciliation logic lives on the Treasury workstream side and
    is **not** modified by this document.

### Tropicash ↔ Sentinel

- **Direction:** Tropicash → Sentinel (one-way reporting feed).
- **Purpose:** Sentinel ingests financial and accounting events from
  Tropicash to produce internal reports.
- **Boundary rules:**
  - Sentinel never writes back to the Tropicash wallet ledger.
  - Sentinel consumes the same event stream as external webhooks
    (see §4) but over an internal channel.

### Tropicash ↔ EliteHire Pro

- **Direction:** EliteHire Pro → Tropicash (payments + payouts).
- **Purpose:** EliteHire Pro initiates payments and payouts that settle
  through Tropicash wallets.
- **Boundary rules:**
  - EliteHire Pro is treated as a trusted **internal client** of Tropicash,
    not as an external developer.
  - It still passes through the internal edge layer (auth + scopes), so the
    same permission model can later be reused for external merchants.

---

## 3. Architectural rules

These rules are non-negotiable for any change touching the developer
ecosystem.

1. **Internal APIs are NEVER public.** Internal Blue Atlantic service
   endpoints must not be addressable from `api.tropicash.com` or from any
   public Developer Center route.
2. **Treasury systems stay isolated.** The treasury workstream owns
   reconciliation, settlement, and treasury bookkeeping. The developer
   platform does not read or write treasury state directly.
3. **Wallet ledger remains the source of truth.** Balances are computed from
   the Tropicash wallet ledger. No external integration may shadow-store or
   override balance state.
4. **Public APIs must pass through auth + rate-limit layers.** Every public
   API request authenticates against a developer API key, is rate-limited,
   and is logged for audit. No bypass.
5. **Sandbox and live environments must remain isolated.** Sandbox traffic
   never reaches the live wallet ledger, the live payout pipeline, the live
   treasury bridge, or the live fraud engine. Sandbox API keys cannot call
   live endpoints, and live keys cannot call sandbox endpoints.
6. **No secrets in client code.** API key generation, signing keys, webhook
   secrets, and any platform credentials are server-side only. The public
   Developer Center and Developer Console never embed live secrets in the
   browser bundle.
7. **Fraud rules stay owned by the fraud engine.** The developer platform
   surfaces fraud-related *events* (e.g. `fraud.flagged`) but never
   re-implements or overrides fraud decisions.

---

## 4. Event-driven architecture direction

The platform is moving toward an **event-first** integration model. Internal
services emit events that fan out to:

- Internal consumers (Sentinel reporting, Triton bridge, fraud engine, etc.)
- External developer-configured webhooks (Phase 3+).

Initial planned event names (final naming + payload schemas TBD):

| Event                     | Direction      | Notes                                        |
| ------------------------- | -------------- | -------------------------------------------- |
| `wallet.funded`           | internal → all | Funding settled into a Tropicash wallet.     |
| `wallet.transfer.completed` | internal → all | Wallet-to-wallet transfer finalized.       |
| `payment.completed`       | internal → all | Payment accepted via Payments API.           |
| `payment.failed`          | internal → all | Payment declined or failed validation.       |
| `payout.completed`        | internal → all | Outbound payout settled.                     |
| `payout.failed`           | internal → all | Outbound payout rejected or returned.        |
| `fraud.flagged`           | internal → all | Fraud engine flagged a transaction/user.     |
| `account.status.changed`  | internal → all | Soft-enforcement / account state changed.    |

Rules:

- Events are produced by the system of record (e.g. the wallet ledger
  produces `wallet.funded`).
- Consumers must treat events as **idempotent** and re-deliverable.
- External webhook delivery uses signed payloads; the signing key is
  developer-scoped and rotatable from the Developer Console.

---

## 5. What this document does **not** do

- It does **not** specify wire formats, HTTP status codes, or schemas.
- It does **not** authorize creation of API keys, signing secrets, or
  webhook endpoints.
- It does **not** modify the treasury, wallet, payout, PayPal, or fraud
  subsystems.
- It does **not** commit to timelines — see `pages/developers/roadmap.jsx`
  for the phased rollout.

---

## 6. Maintenance

When you change any of the following, update this file in the same PR:

- `lib/developerCenterConfig.js` (route lists, phase metadata, status keys)
- `lib/internalPlatformConfig.js` (internal namespaces, integrations, events,
  env/safety/idempotency rules)
- The Developer Console layout sidebar in `components/devconsole/DevConsoleLayout.jsx`
- The public Developer Portal route set in `pages/developers/**`
- `components/RouteAuthGuard.jsx` if the `/dev-console` access policy changes

The `developer_access_requests` Supabase table (see
`supabase/sql/developer_center_phase1.sql`) is the **only** persistence
introduced by Phase 1 / Phase 1.5. No other tables are created or modified.

---

## 7. Internal service blueprint (Phase 1.75)

The detailed internal service blueprint lives in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md). It
expands the architecture described above with:

- **Service namespaces** — `internal.wallets`, `internal.payments`,
  `internal.payouts`, `internal.treasury`, `internal.fraud`,
  `internal.notifications`, `internal.triton`, `internal.sentinel`,
  `internal.elitehire`. Each namespace declares its purpose, planned
  responsibilities, and an explicit *must-not-yet* list.
- **Blue Atlantic integration mapping** — Tropicash ↔ Triton, ↔ Sentinel,
  and ↔ EliteHire Pro capabilities (capabilities, not endpoints).
- **Event catalog** — six families (`wallet.*`, `payment.*`, `payout.*`,
  `fraud.*`, `developer.*`, `integration.*`) plus the standard event
  envelope shape.
- **Idempotency rules** — required for payments, payouts, wallet
  adjustments, and Triton transfers; duplicate keys must return the
  original result.
- **Environment rules** — strict sandbox / live isolation; no cross-env
  API key usage.
- **Non-negotiable safety rules** — the ten rules every change must
  respect (wallet ledger source-of-truth, treasury isolation, no public
  internal routes, etc.).

The machine-readable form of every section lives in
`lib/internalPlatformConfig.js`. The authenticated Developer Console page
at `pages/dev-console/internal-blueprint.jsx` renders that config as a
read-only summary for logged-in users.

**Phase 1.75 introduces no APIs, no SQL migrations, no service tokens, and
no secrets.** It is architecture + config + UI shell only.

---

## 8. Internal service registry (Phase 2A)

Phase 2A adds a **governance / identity layer** for the internal Blue
Atlantic integrations described above. It is the first piece of the
internal platform that has a real database footprint — but it is still
**registry-only**: it introduces no API routes, no service tokens, and no
money movement.

What Phase 2A adds:

- Three admin-only Supabase tables in
  [`supabase/sql/internal_service_registry_phase2a.sql`](../supabase/sql/internal_service_registry_phase2a.sql):
  - `internal_service_integrations` — planned integration identities
    (Triton, Sentinel, EliteHire Pro), each with environment + lifecycle
    status.
  - `internal_service_permissions` — planned per-integration permissions
    with `low | medium | high | critical` risk levels.
  - `internal_service_audit_logs` — empty in Phase 2A. The shape is
    defined so every future internal call has a place to be audited from
    day one (`service_key`, `environment`, `event_type`, `request_id`,
    `idempotency_key`, `status`, `metadata`).
- `lib/internalServiceRegistryConfig.js` — mirror of the seeded
  integrations, permissions, statuses, environments, and risk levels for
  the Developer Console UI.
- `pages/dev-console/internal-services.jsx` — admin-facing registry view
  rendered **entirely from config** (no Supabase reads).

Cross-cutting rules already in §3 above (treasury isolation, wallet ledger
source of truth, no public internal routes, no cross-environment usage)
apply to Phase 2A. The registry exists specifically so that, when Phase 2B
introduces the internal auth model, every call has a known service
identity, a scoped permission, an environment, and an audit slot ready.

Full Phase 2A narrative — including risk-level semantics, seeded permission
tables, and the audit log model — lives in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md)
under the "Phase 2A — Internal Service Registry" section.

---

## 9. Integration lifecycle & runtime governance (Phase 2B)

Phase 2B layers an **operational governance** model on top of the Phase 2A
registry. Where Phase 2A defined *which* integrations exist and *what*
permissions they could ask for, Phase 2B defines *how* an integration moves
from `planning` to `live` and *which* runtime constraints apply once it
does. It is still **governance-only**: no API routes, no enforcement code
paths, no money movement.

What Phase 2B adds:

- Three admin-only Supabase tables in
  [`supabase/sql/internal_service_governance_phase2b.sql`](../supabase/sql/internal_service_governance_phase2b.sql):
  - `internal_service_lifecycle_reviews` — approval records for every
    lifecycle transition (`pending | approved | rejected | cancelled`).
    Approving a review does **not** mutate the registry; promotions remain
    a manual, audited step.
  - `internal_service_runtime_policies` — per-environment runtime
    constraints with `enforcement_status ∈ {planned, monitor_only,
    enforced, disabled}`. Phase 2B seeds everything as `planned`.
  - `internal_service_environment_gates` — per-environment readiness gates
    with `gate_status ∈ {blocked, pending_review, passed, waived}` and a
    `required_for_live` flag. Sandbox gates start `passed`; live gates
    start `blocked`.
- `lib/internalServiceGovernanceConfig.js` — mirror of the seeded lifecycle
  path, runtime policies, environment gates, and governance safety rules
  for the Developer Console UI.
- `pages/dev-console/internal-governance.jsx` — admin-facing governance
  view rendered **entirely from config** (no Supabase reads).

The cross-cutting rules already in §3 (treasury isolation, wallet ledger
source of truth, no public internal routes, no cross-environment usage)
continue to apply — governance is *additional* gating, not a replacement.

Full Phase 2B narrative — including the lifecycle path, seeded policy and
gate tables, governance safety rules, and the "no enforcement yet" stance
— lives in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md)
under the "Phase 2B — Integration Lifecycle & Runtime Governance"
section.

---

## 10. Capability & operational constraints registry (Phase 2C)

Phase 2C adds a **capability primitive layer** underneath the Phase 2A
identity layer and the Phase 2B governance layer. Where Phase 2A asked
*which integration* and Phase 2B asked *under what lifecycle*, Phase 2C
defines the reusable **capabilities** every future API, runtime policy,
and permission will reference. It is still **definition-only**: no API
routes, no enforcement code paths, and no money movement.

What Phase 2C adds:

- Three admin-only Supabase tables in
  [`supabase/sql/internal_capability_registry_phase2c.sql`](../supabase/sql/internal_capability_registry_phase2c.sql):
  - `internal_capabilities` — reusable capability definitions
    (`capability_key`, `category`, `risk_level`, `lifecycle_status`,
    `supports_sandbox`, `supports_live`). Phase 2C seeds 19 capabilities
    across the wallet / payments / payouts / treasury / ledger / trading
    / fraud / developer / notifications categories.
  - `internal_capability_dependencies` — directed edges between
    capabilities with `dependency_type ∈ {requires, recommends,
    blocks_without, audit_requires}`. Money-moving capabilities declare
    `requires` on `fraud.review_required` and `audit_requires` on
    `ledger.export`.
  - `internal_capability_constraints` — per-environment operational
    constraints with `enforcement_status ∈ {planned, monitor_only,
    enforced, disabled}` and `risk_level`. Sandbox and live rows are
    independent so promotion is explicit. Phase 2C seeds all rows as
    `planned`.
- `lib/internalCapabilityConfig.js` — mirror of the seeded categories,
  risk / lifecycle / dependency / enforcement vocabularies, and every
  capability / dependency / constraint row for the Developer Console UI.
- `pages/dev-console/capabilities.jsx` — admin-facing capability registry
  view rendered **entirely from config** (no Supabase reads).

Cross-cutting rules already in §3 (treasury isolation, wallet ledger
source of truth, no public internal routes, no cross-environment usage)
continue to apply — Phase 2C narrows them further into capability-level
rules: capabilities never bypass the wallet ledger, every money-moving
capability must declare a `requires` dependency on `fraud.review_required`,
and every Phase 2C seed defaults to `supports_live = false` until Phase
2B governance promotes it.

Full Phase 2C narrative — including category definitions, dependency-type
semantics, the full seeded capability / dependency / constraint tables,
sandbox vs. live compatibility, and the "no enforcement yet" stance —
lives in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md)
under the "Phase 2C — Capability & Operational Constraints Registry"
section.

---

## 11. Execution orchestration & policy evaluation blueprint (Phase 2D)

Phase 2D adds the **runtime orchestration blueprint** on top of the
identity (2A), lifecycle (2B), and capability (2C) layers. Where Phase 2C
asked *what* a capability is, Phase 2D asks *how* a request invoking that
capability flows through identity, environment, dependency, policy,
constraint, idempotency, fraud, audit, and authorization stages. It is
still **architecture-only**: no executor, no API routes, no enforcement
code paths, and no money movement.

What Phase 2D adds:

- Four admin-only Supabase tables in
  [`supabase/sql/internal_execution_orchestration_phase2d.sql`](../supabase/sql/internal_execution_orchestration_phase2d.sql):
  - `internal_execution_pipeline_stages` — 13 ordered stages
    (`request_received` → `post_execution_logged`) with `stage_type ∈
    {identity, environment, capability, dependency, policy, idempotency,
    fraud, audit, execution, post_execution}` and a
    `blocking_by_default` flag. Validation / policy / fraud stages
    block by default; intake / audit / post-execution stages do not.
  - `internal_policy_evaluation_rules` — reusable rule definitions
    (idempotency, fraud-review-required, sandbox-only, max-amount,
    dependency-resolution, env-match, audit-record) with
    `evaluation_type ∈ {required, optional, blocking, audit_only,
    monitor_only}` and per-rule `decision_if_failed`.
  - `internal_runtime_decisions` — the canonical verdict vocabulary
    (`allowed`, `warning`, `review_required`, `blocked`, `sandbox_only`,
    `limit_exceeded`, `dependency_missing`, `policy_not_satisfied`,
    `execution_authorized`, `execution_blocked`). Only
    `execution_authorized`, `execution_blocked`, and `blocked` are
    terminal.
  - `internal_execution_trace_templates` — per-capability blueprint of
    pipeline stages, decision points, and terminal states stored as
    JSONB. Phase 2D seeds sandbox templates for `payment.create`,
    `payout.release`, and `trading.profit_withdraw`.
- `lib/internalExecutionOrchestrationConfig.js` — mirror of every Phase
  2D seed plus the policy/severity/decision/category vocabularies and
  orchestration safety rules.
- `pages/dev-console/orchestration.jsx` — admin-facing orchestration
  view rendered **entirely from config** (no Supabase reads).

The cross-cutting rules already in §3 (treasury isolation, wallet ledger
source of truth, no public internal routes, no cross-environment usage)
continue to apply — Phase 2D narrows them into orchestrator-level rules:
no money-moving capability may reach `execution_authorized` without
passing `fraud_reviewed`; idempotency duplicates must short-circuit to
the prior recorded result; every authorized call must have a pre- and
post-execution audit row; sandbox and live trace templates are
independent so promoting sandbox never silently promotes live.

Full Phase 2D narrative — including the orchestration philosophy, the
full pipeline / policy / decision / trace tables, the composition with
prior phases, and the "no execution engine yet" stance — lives in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md)
under the "Phase 2D — Execution Orchestration & Policy Evaluation
Blueprint" section.

## 12. Observability & runtime telemetry blueprint (Phase 2E)

Phase 2E adds the **observability blueprint** on top of Phase 2D's
orchestration. Where Phase 2D defined *how a request flows*, Phase 2E
defines *how Tropicash will observe, trace, diagnose, replay, and
monitor* every future runtime invocation. It is still
**architecture-only**: no telemetry pipeline, no emitters, no monitoring
daemons, no API routes, and no money movement.

What Phase 2E adds:

- Four admin-only Supabase tables in
  [`supabase/sql/internal_observability_phase2e.sql`](../supabase/sql/internal_observability_phase2e.sql):
  - `internal_execution_sessions` — per-request envelope with stable
    `execution_session_id` / `trace_id`, `service_key`, `capability_key`,
    `environment ∈ {sandbox, live}`, and `execution_status ∈ {planned,
    started, in_progress, review_required, completed, failed, blocked,
    cancelled}`. Phase 2E seeds three demo sessions (`payment.create`,
    `payout.release`, `trading.profit_withdraw`) as `planned` /
    `sandbox`.
  - `internal_execution_metrics` — canonical metric catalog keyed by
    `metric_category ∈ {latency, policy, fraud, dependency, execution,
    audit, environment}`. Phase 2E seeds the catalog with
    `metric_value=0` against the `payment.create` demo session.
  - `internal_execution_failures` — canonical failure taxonomy
    (`policy_failure`, `dependency_failure`, `environment_failure`,
    `fraud_block`, `idempotency_conflict`, `constraint_violation`,
    `runtime_exception`, `audit_failure`) with `severity ∈ {low, medium,
    high, critical}` and an `is_terminal` flag. Each failure references
    Phase 2D rows by `stage_key` / `policy_rule_key` / `decision_key`.
  - `internal_execution_replay_templates` — per-capability replay
    blueprint with JSONB `replay_structure` listing
    `replayable_stages`, `reconstructable_events`, `terminal_states`,
    and (for money-moving capabilities) `redacted_fields`. Phase 2E
    seeds replay templates for `payment.create`, `payout.release`, and
    `trading.profit_withdraw`.
- `lib/internalObservabilityConfig.js` — mirror of every Phase 2E seed
  plus the status / metric category / failure category / severity /
  replay scope vocabularies, the planned dashboards catalog, and
  observability safety rules.
- `pages/dev-console/observability.jsx` — admin-facing observability
  view rendered **entirely from config** (no Supabase reads).

The cross-cutting rules already in §3 (treasury isolation, wallet
ledger source of truth, no public internal routes, no cross-environment
usage) continue to apply — Phase 2E narrows them into observability
rules: telemetry envelopes must never carry secrets, tokens, customer
PII, or wallet balances; replay is side-effect free and stops strictly
before `execution_authorized`; sandbox and live telemetry are
independent series; and dashboards must be admin-only at the storage
layer (RLS) AND at the future query layer.

Full Phase 2E narrative — including the telemetry philosophy, the full
session / metric / failure / replay tables, the planned operational
dashboards, the composition with prior phases, and the "no telemetry
engine yet" stance — lives in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md)
under the "Phase 2E — Observability & Runtime Telemetry Blueprint"
section.

## 13. Runtime state & event store blueprint (Phase 2F)

Phase 2F adds the **runtime state and event store blueprint** beneath
Phase 2E observability. Where Phase 2E asked *what is observed*, Phase
2F asks *how runtime state is persisted, ordered, snapshotted,
checkpointed, and correlated across services*. It is still
**architecture-only**: no event emitter, no executor, no replay engine,
no API routes, and no money movement.

What Phase 2F adds:

- Four admin-only Supabase tables in
  [`supabase/sql/internal_runtime_state_phase2f.sql`](../supabase/sql/internal_runtime_state_phase2f.sql):
  - `internal_event_store` — append-only event log. Per-trace ordering
    is enforced by a unique `(trace_id, sequence_number)` constraint.
    `actor_type ∈ {user, admin, system, service}` (or null);
    `environment ∈ {sandbox, live}`. Phase 2F seeds 12 placeholder
    events across 6 demo traces, covering the canonical event families
    (execution lifecycle, money movement, fraud signals, integration
    mirror).
  - `internal_runtime_state_snapshots` — derived per-session snapshot
    with `current_execution_state ∈ {planned, started, in_progress,
    review_required, authorized, blocked, completed, failed,
    cancelled}` and a monotonically-increasing `version`. Always
    reconstructable from the event store; never the source of truth.
  - `internal_event_stream_checkpoints` — per-trace cursor with
    `checkpoint_status ∈ {current, stale, rebuilding, failed,
    archived}`. Snapshot rebuilders advance the cursor; checkpoints are
    advisory and never authorize execution.
  - `internal_event_correlation_links` — Tropicash → downstream
    service mapping with `relation_type ∈ {caused, triggered, mirrored,
    reconciled, notified, reported}`. Phase 2F seeds Tropicash → Triton
    (`triggered`), Tropicash → Sentinel (`reported`), Tropicash →
    EliteHire Pro (`reconciled`).
- `lib/internalRuntimeStateConfig.js` — mirror of every Phase 2F seed
  plus the event-family / execution-state / checkpoint-status /
  correlation-relation vocabularies and runtime-state safety rules.
- `pages/dev-console/runtime-state.jsx` — admin-facing runtime state
  view rendered **entirely from config** (no Supabase reads).

The cross-cutting rules already in §3 (treasury isolation, wallet ledger
source of truth, no public internal routes, no cross-environment usage)
continue to apply — Phase 2F narrows them into runtime-state rules:
the event store is append-only (no updates, no deletes); per-trace
ordering is exact while cross-trace ordering is approximate via
`occurred_at`; sandbox and live event streams are independent series;
event payloads, state payloads, checkpoint metadata, and correlation
metadata must never carry secrets, tokens, customer PII, or wallet
balances; correlation rows reference downstream services by
`target_service_key` only — never by credentials or external API
tokens.

Full Phase 2F narrative — including the telemetry/state philosophy, the
full event-store / snapshot / checkpoint / correlation tables, the
event ordering model, the runtime reconstruction flow, the composition
with prior phases, and the "no event emitter yet" stance — lives in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md)
under the "Phase 2F — Runtime State & Event Store Blueprint" section.

## 14. Execution simulation layer (Phase 3A)

Phase 3A introduces a **simulation layer** on top of the Phase 2D/2E/2F
schemas — not a runtime. The Execution Simulator at
`/dev-console/execution-simulator` lets a reviewer pick a scenario
(wallet transfer, withdrawal, trading profit, merchant settlement,
fraud signal, API rate limit, orchestration retryable failure,
integration sync, etc.) and render a deterministic trace, event
stream, snapshot evolution, correlation map, and mock observability —
all from a static seed in `lib/executionScenarioConfig.js`.

Hard constraints — Phase 3A does **not**:

- spawn workers, schedulers, queues, retries, event emitters, webhook
  dispatchers, or any async execution engine;
- mutate any database table (including the Phase 2A–2F internal
  tables);
- move money, touch treasury, wallet, withdrawal, PayPal, payout, or
  fraud-engine modules;
- introduce API routes, keys, tokens, or secrets;
- use `Date.now()`, `Math.random()`, or any non-deterministic source.

The simulator's environment selector exposes `sandbox` only; the
`live` option is disabled by design. The "Replay Timeline" control is
purely visual — it advances how much of an already-built simulation is
revealed on screen and does not re-execute any helper.

Full Phase 3A narrative — including the deterministic-simulation
contract, replayable timelines, simulated event generation,
orchestration walkthroughs, and the "no live runtime" stance — lives
in [`docs/internal-service-blueprint.md`](./internal-service-blueprint.md)
under the "Phase 3A — Execution Simulation Layer" section.

## 15. Runtime decision engine simulator (Phase 3B)

Phase 3B layers a **decision simulation** on top of the same scenario
keys as Phase 3A. The Decision Simulator at
`/dev-console/decision-simulator` (`lib/runtimeDecisionSimulatorConfig.js`)
shows how static rules and impacts would explain `allowed`,
`review_required`, `delayed`, `rate_limited`, `retryable_failure`, etc.
— with **no** enforcement, APIs, workers, or persistence.

Blueprint detail: "Phase 3B — Runtime Decision Engine Simulator" in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 16. Simulation run history & comparison (Phase 3C)

Phase 3C adds a **deterministic run ledger** at
`/dev-console/simulation-history` (`lib/simulationRunHistoryConfig.js`) that
merges each shared Phase 3A scenario with `evaluateDecisionCase()` — producing
distributions, review slices, comparison rows, and a health summary **without**
persisting runs or calling APIs. See the "Phase 3C — Simulation Run History &
Comparison" section in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 17. Runtime policy visualization & dependency graphs (Phase 3D)

Phase 3D adds **static graph layouts** at `/dev-console/policy-graphs`
(`lib/runtimePolicyGraphConfig.js`): grouped nodes and edges built from Phase 2C
capabilities, Phase 3B rules and cases, and Phase 3C run history helpers — for
dependency, policy-gate, scenario, review-routing, and risk-concentration views.
There is **no** graph execution engine, policy enforcement, API surface, or
persistence.

Blueprint detail: "Phase 3D — Runtime Policy Visualization & Dependency Graphs"
in [`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 18. Simulation readiness audit (Phase 3E)

Phase 3E mirrors the documentation-only pattern in §16–17: it records a
**deterministic safety and alignment review** over the Phase 3A–3D simulation
stack (config modules and `/dev-console/*` simulation pages) so reviewers can
treat the layer as teaching UI with no live runtime, no persistence, and no
money movement. It does not introduce new product behavior.

Full narrative: **Phase 3E — Simulation Readiness Audit** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 19. Developer organizations & app registration (Phase 4A)

Phase 4A persists **developer organization** and **sandbox app** rows in Supabase
for the authenticated Developer Console only. Owners see and mutate their own
rows; admins use `tc_is_admin()` for lifecycle operations. This phase is
registration metadata and RLS scaffolding — **no** API keys, webhooks, public API
edge, or money movement.

Blueprint detail: **Phase 4A — Developer Organizations & App Registration** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md). SQL:
`supabase/sql/developer_orgs_phase4a.sql`. UI: `/dev-console/apps-register`.

## 20. Developer app governance & review workflow (Phase 4B)

Phase 4B adds **review requests** and **lifecycle events** for registered
developer apps. Owners submit governance requests (sandbox activation, etc.);
admins approve or reject and may update app `status` metadata only. Live access
approval stops at `live_pending` until a future phase. No API keys, secrets,
webhooks, or money movement.

Blueprint: **Phase 4B** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md). SQL:
`supabase/sql/developer_app_governance_phase4b.sql`. UI: `/dev-console/my-apps`,
`/dev-console/app-governance` (admin).

## 21. Sandbox access policies & capability assignment (Phase 4C)

Phase 4C adds **capability assignments**, **capability requests**, and **sandbox access policies**
for developer apps. Owners request sandbox capabilities; admins assign or revoke via
`tc_is_admin()`. Capability keys are read from the Phase 2C catalog for UI only — no enforcement,
API keys, or live traffic.

Blueprint: **Phase 4C** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md). SQL:
`supabase/sql/developer_app_capabilities_phase4c.sql`. UI: `/dev-console/app-capabilities`,
capability queue on `/dev-console/app-governance` (admin).

## 22. Sandbox runtime contracts & API product catalog (Phase 4D)

Phase 4D adds **pure-configuration** modeling for developer-facing API products and sandbox runtime
contracts: seeded catalog rows in `lib/developerProductCatalogConfig.js`, summarized on
`/dev-console/product-catalog`, with cross-links from App Capabilities, My Apps, and App Governance.
Capability keys remain aligned with the Phase 2C registry where products declare dependencies.

There are **no** new HTTP handlers, Supabase tables, API keys, webhooks, workers, treasury/wallet/payout
execution, or fraud-engine calls in this phase — only documentation-shaped metadata and helpers for
flattened summaries.

Blueprint detail: **Phase 4D — Sandbox Runtime Contracts & API Product Catalog** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 23. Sandbox usage simulation & developer analytics (Phase 4E)

Phase 4E adds **pure-configuration** sandbox analytics seeds in `lib/developerSandboxAnalyticsConfig.js`:
simulated usage rows, per-app health grades, capability utilization snapshots, and rate-limit pressure
tables keyed to the same `product_key`, `contract_key`, and Phase 2C `capability_key` vocabulary as Phase 4D.

The Developer Console page `/dev-console/sandbox-analytics` summarizes these seeds with optional app selection.

There is **no** telemetry ingestion, quota enforcement, Supabase storage, HTTP API traffic, or wall-clock
sampling (`Date.now`, `Math.random`) in this phase — only static modeling and pure helper aggregation.

## 24. Developer platform readiness audit (Phase 4F)

Phase 4F documents a **hardening and alignment review** across Phases 4A–4E: ordered SQL migrations with RLS
and admin gating (`tc_is_admin()`), owner-scoped client queries, `/dev-console/*` authentication and admin-only
governance, static Phase 4D/4E config key alignment with Phase 2C capabilities, and public developer messaging
without implying live APIs or leaking internal schema details.

Full checklist: **Phase 4F — Developer Platform Readiness Audit** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 25. Sandbox credential architecture & API key vault blueprint (Phase 5A)

Phase 5A adds **Supabase metadata tables** for developer credential rows, append-style credential lifecycle
events, and per-credential access policy attachments — with **no plaintext or encrypted secret columns**.
Owners may **SELECT** credential metadata for apps they own; **INSERT/UPDATE/DELETE** on credential rows and
related audit/policy tables is **admin-only** under RLS policies gated by `public.tc_is_admin()` (to the
`authenticated` role only; no anonymous policies), matching the
“no self-issued production keys” posture. The Developer Console page `/dev-console/credential-architecture`
and `lib/developerCredentialArchitectureConfig.js` are pure configuration and teaching UI: lifecycle
vocabulary, rotation models, signing concepts, vault strategy descriptions, and prefix **examples** (not real
keys). There is **no** key generation, no vault I/O, no HTTP API edge, and no treasury/wallet/payout/PayPal/fraud
execution in this phase.

Blueprint detail: **Phase 5A — Sandbox Credential Architecture & API Key Vault Blueprint** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md). SQL:
`supabase/sql/developer_credentials_phase5a.sql`. UI: `/dev-console/credential-architecture`; cross-links
from `/dev-console/app-governance`, `/dev-console/my-apps`, and public developer docs.

## 26. Authentication flow modeling & request verification simulation (Phase 5B)

Phase 5B adds **pure-configuration** authentication flow modeling in `lib/developerAuthSimulationConfig.js`: thirteen
ordered verification stages, nine documentation-only verification policies, sixteen failure states, six request-level
outcomes, replay-protection and environment-scope blurbs, and ten deterministic simulation cases keyed to the same
`product_key`, `contract_key`, and Phase 2C `capability_key` vocabulary as Phase 4D. The Developer Console page
`/dev-console/auth-simulator` renders banners, case and environment selectors, pinned traces after evaluation, and
safety copy — **no** real auth, crypto, signing, middleware, HTTP APIs, or secret handling.

Blueprint detail: **Phase 5B — Authentication Flow Modeling & Request Verification Simulation** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md). UI: `/dev-console/auth-simulator`; cross-links
from Credential Architecture, Product Catalog, App Governance, and Sandbox Analytics.

## 27. API gateway & request envelope architecture simulation (Phase 5C)

Phase 5C adds **`lib/developerGatewaySimulationConfig.js`**, a choreography-only simulator that aligns Phase **5B**
delegated traces with fourteen ordered gateway rehearsal surfaces, seeded request envelope merges declaring placeholder
credential references only (no handles), ten illustrative routing outcomes, six correlation narration models bridging Phase
**2E/2F** vocabulary, illustrative rate tiers tied to the Phase **4D** enums, deterministic audit envelope field previews with
zero append-only storage, Sandbox Analytics anchors as metadata stitches, runtime-state vocabulary references, observability
placeholders, and ten `gateway.*` simulation seeds mirroring Phase **4D** catalogs. Authenticated Developer Console UI
`/dev-console/gateway-simulator` exposes merged envelopes plus pinned routing summaries — **no** middleware gateways,
HTTPS termination, cryptography, webhook verification, quotas, or operational enforcement hooks.

Canonical blueprint section: **Phase 5C — API Gateway & Request Envelope Architecture Simulation** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).
Console cross-links originate from Credential Architecture, Product Catalog, Sandbox Analytics, Auth Simulator, and Execution Routing. Public blurbs cite the gateway rehearsal on `/developers/docs`, envelope-before-handoff copy on `/developers/how-it-works`, and execution routing previews on `/developers/docs`.

## 28. Execution routing & service orchestration simulation (Phase 5D)

Phase 5D adds **`lib/developerExecutionRoutingConfig.js`**, layering **twelve** deterministic post-gateway rehearsal stages
(`gateway_result_received` → `simulated_execution_result`), **ten** narrative `EXECUTION_SERVICE_TARGETS`, **nine**
execution-routing outcomes, **nine** dependency vocabularies, **five** reconciliation posture labels, **ten**
`EXECUTION_ORCHESTRATION_STATES`, **ten** seeded routing cases bridging Phase **5C** gateway keys into Phase **3A**
scenarios plus Phase **3B** decision slices, catalog rows from Phase **4D**, and delegated Phase **5B** authentication
evaluation — purely configuration merges with **`evaluateGatewaySimulationCase`** parity when enabled — **no**
workload routers, queue workers, adapters, treasury, wallets, payouts, PayPal integrations, crypto, fraud enforcement,
middleware, webhook dispatchers, or operational HTTP edges.

Authenticated Developer Console UI `/dev-console/execution-routing` exposes routed envelope previews, pinning for the
deterministic routing trace and delegation summaries. Canonical blueprint section: **Phase 5D — Execution Routing &
Service Orchestration Simulation** in [`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 29. Request lifecycle readiness audit (Phase 5E)

Phase 5E is an **audit / hardening gate** across Phases **5A–5D** before any real API key issuance or live request
processing is considered. Scope is limited to **configuration determinism**, **Dev Console route and cross-link
consistency**, **seed alignment** (5B auth cases ↔ 5C gateway `auth_case_key` ↔ 5D `gateway_case_key`; Phase **4D**
product/contract keys and Phase **2C** capabilities; placeholder-only `credential_reference` values), **UI safety
wording** on credential/auth/gateway/execution-routing pages, and **SQL posture** review of
`supabase/sql/developer_credentials_phase5a.sql` (metadata-only rows, owner **SELECT** without self-issuance, admin
CRUD, RLS, authenticated role only).

**Deterministic simulation:** all four configuration modules remain pure static seeds — no `Date.now`, `Math.random`,
`fetch`, Supabase/session storage, crypto, or secret material; `evaluateGatewaySimulationCase` / `evaluateAuthSimulationCase`
produce stable `stage_trace` merges for teaching.

**No live processing:** this phase does not add APIs, middleware, credentials, gateway traffic, workers, webhooks,
treasury, wallets, withdrawals, PayPal, or fraud execution. Readiness means reviewers can walk the full rehearsal chain
(Credential Architecture → Auth Simulator → Gateway Simulator → Execution Routing, with Product Catalog / Sandbox
Analytics / Orchestration / Runtime State peers) with aligned vocabulary and explicit “simulation only” copy before
issuance workflows open.

Canonical blueprint section: **Phase 5E — Request Lifecycle Readiness Audit** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 30. Runtime activation governance & environment isolation (Phase 6A)

Phase 6A adds **`lib/runtimeActivationGovernanceConfig.js`**: ten activation states (including
`live_enabled_placeholder` with explicit **no real live runtime** copy), five environment scopes, eleven activation gates,
seven safety envelopes, eight isolation rules, ten kill-switch models, and ten deterministic activation cases with pure
`evaluateRuntimeActivationCase()` — no Supabase, no network, no wall-clock entropy, and no operational enforcement.

The Developer Console page `/dev-console/runtime-activation` visualizes governance before any runtime exists. Route registered
in `DEV_CONSOLE_ROUTES` with icon **🔒** (🛡️ reserved for App Governance and internal Governance). Cross-links from execution
routing, gateway simulator, auth simulator, and runtime state. Public developer pages cite activation governance on
`/developers/docs` and safety boundaries on `/developers/how-it-works`.

Blueprint detail: **Phase 6A — Runtime Activation Governance & Environment Isolation Blueprint** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 31. Runtime activation readiness audit (Phase 6B)

Phase 6B audits Phase **6A** against the Phase **5** stack: config determinism across
`runtimeActivationGovernanceConfig.js` and Phase 5A–5D modules; `phase_ref` on all eleven activation gates; conceptual-only
kill-switch copy; `live_placeholder` / `live_enabled_placeholder` isolation language; UI safety banners on
`/dev-console/runtime-activation` and upstream simulators; route registration and cross-links; public developer blurbs on
`/developers/docs` and `/developers/how-it-works`. No runtime is armed, no APIs accept traffic, and no operational enforcement
is introduced.

Blueprint detail: **Phase 6B — Runtime Activation Readiness Audit** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 32. Developer identity & workspace foundation (Phase 7A)

Phase 7A adds `lib/developerWorkspaceConfig.js` and the Developer Console page `/dev-console/workspace` (route icon
**🏠** in `DEV_CONSOLE_ROUTES`). The page surfaces static workspace identity, a deterministic readiness score, onboarding
checkpoints and timeline events, environment notices, organization summary counts, health indicators, and recommendations —
all from pure config helpers with no Supabase, network, `Date.now()`, or `Math.random()`.

Environment vocabulary (`sandbox`, `live_preview`, `restricted`, `suspended`), developer tiers, and six onboarding stages
anchor cross-links from Overview, My Apps, Developer Governance, and Credential Architecture. Live API access, credential
issuance, workers, webhooks, and money subsystems remain explicitly out of scope.

Blueprint detail: **Phase 7A — Developer Identity & Workspace Foundation** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 33. Workspace personalization & context layer (Phase 7B)

Phase 7B adds `lib/developerWorkspaceContextConfig.js` and extends `/dev-console/workspace` with persona, context
state, environment preference, simulated activity feed, rule-driven smart recommendations, milestone progress, and
health context overlays — while retaining all Phase 7A sections. Helpers read Phase 7A seeds read-only for alignment;
no Supabase, network, `Date.now()`, or `Math.random()`.

Persona vocabulary (six types), seven context states, five environment preferences, and eight milestones — including
`credential_prepared_placeholder` with explicit “future planning only — no credentials issued” copy — anchor cross-links
from My Apps, Product Catalog, Sandbox Analytics, and Credential Architecture. Live API access, credential issuance,
workers, webhooks, and money subsystems remain out of scope.

Blueprint detail: **Phase 7B — Workspace Personalization & Context Layer** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 34. Workspace readiness validation (Phase 7C)

Phase 7C audits and hardens Phases **7A–7B**: developer console route access via `RouteAuthGuard` and
`lib/developerAccessGate.js` (admins bypass; approved `developer_access_requests` required for `/dev-console/*`);
public `/developers` remains outside the gate; Navbar `useDeveloperNavHref` resolves to `/dev-console` only when access
is allowed. Config modules stay deterministic (no clocks, randomness, fetch, or storage). `/dev-console/workspace`
retains Phase 7A + 7B sections with safety copy; Overview and peer pages maintain bidirectional workspace cross-links.

No API keys, live endpoints, workers, webhooks, Supabase writes, or money subsystems are introduced.

Blueprint detail: **Phase 7C — Workspace Readiness Validation** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 35. Sandbox credential lifecycle foundation (Phase 8A)

Phase 8A adds `lib/developerCredentialLifecycleConfig.js` and the Developer Console page
`/dev-console/credential-lifecycle` (route icon **🪪**). The phase models **placeholder** sandbox credential lifecycle
(statuses, request types, environments, visibility), eight deterministic readiness checks, timeline seeds with static
step labels, and governance recommendations — while explicitly excluding secret material, authentication runtime, API
traffic, webhooks, workers, Supabase writes, and money subsystems.

Blueprint detail: **Phase 8A — Sandbox Credential Lifecycle Foundation** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 36. Credential governance & visibility layer (Phase 8B)

Phase 8B adds `lib/developerCredentialGovernanceConfig.js` and extends `/dev-console/credential-lifecycle` with
**metadata-only credential governance**: eight governance states, seven developer/admin visibility rules, six review
outcomes, deterministic history and rationale seeds, placeholder visibility previews (prefix hints such as `tc_sbx_`
only — no secret material), and five suspension/revocation teaching models. The layer builds on Phase 8A lifecycle
vocabulary while explicitly excluding secrets, authentication runtime, API traffic, webhooks, workers, Supabase writes,
and money subsystems.

Blueprint detail: **Phase 8B — Credential Governance & Visibility Layer** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 37. Credential readiness audit & governance hardening (Phase 8C)

Phase 8C audits and hardens Phases **8A–8B**: developer console route access via `RouteAuthGuard` and
`lib/developerAccessGate.js` (admins bypass; approved `developer_access_requests` required for `/dev-console/*`);
public `/developers` remains outside the gate; Navbar `useDeveloperNavHref` resolves to `/dev-console` only when access
is allowed. Config modules `lib/developerCredentialLifecycleConfig.js` and `lib/developerCredentialGovernanceConfig.js`
stay deterministic (no clocks, randomness, fetch, storage, or crypto). `/dev-console/credential-lifecycle` retains
Phase 8A + 8B sections with consolidated placeholder-safety banner copy; Workspace, Credential Architecture, Auth
Simulator, Gateway Simulator, Runtime Activation, and Developer Governance maintain bidirectional Credential Lifecycle
cross-links with consistent labels.

No API keys, live endpoints, workers, webhooks, Supabase writes, or money subsystems are introduced.

Blueprint detail: **Phase 8C — Credential Readiness Audit & Governance Hardening** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 38. Sandbox API product access layer (Phase 9A)

Phase 9A adds `lib/developerProductAccessConfig.js` and the Developer Console page
`/dev-console/product-access` (route icon **🎫** — distinct from Apps **🧩**). The phase models **sandbox product
entitlements**, capability → product mapping, six access scopes, eight access states, eight governance restrictions,
seven governance rules, fourteen usage envelopes (execution disabled), readiness checks, and recommendations — while
explicitly excluding real endpoints, API execution, credentials, secrets, authentication runtime, webhooks, workers,
Supabase writes, and money movement.

Blueprint detail: **Phase 9A — Sandbox API Product Access Layer** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 39. Product access governance & visibility layer (Phase 9B)

Phase 9B adds `lib/developerProductGovernanceConfig.js` and extends the Developer Console page
`/dev-console/product-access` with sections **9B.1–9B.8**. The phase models **entitlement governance states**,
eight **visibility rules**, six **review outcomes**, four **governance actors**, deterministic **entitlement history**,
**restriction rationale** cards, six **revocation/suspension** teaching models, **sandbox entitlement preview** seeds
(for example `wallet_funding`, `send_money`, `treasury_placeholder`, `sandbox_webhooks_placeholder`), and **governance
risk summaries** — while explicitly excluding endpoints, API execution, credentials, secrets, authentication runtime,
webhooks, workers, Supabase writes, and money movement.

Blueprint detail: **Phase 9B — Product Access Governance & Visibility Layer** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 40. Product access readiness audit & governance hardening (Phase 9C)

Phase 9C audits and hardens Phases **9A–9B**: developer console route access via `RouteAuthGuard` and
`lib/developerAccessGate.js` (admins bypass; approved `developer_access_requests` required for `/dev-console/*`);
public `/developers` remains outside the gate; Navbar `useDeveloperNavHref` resolves to `/dev-console` only when access
is allowed. Config modules `lib/developerProductAccessConfig.js` and `lib/developerProductGovernanceConfig.js` stay
deterministic (no clocks, randomness, fetch, storage, or crypto; helpers return copies without mutating seeds).
`/dev-console/product-access` retains Phase 9A + 9B sections with consolidated safety banner copy (sandbox only, preview
only, metadata only, no execution, no endpoints, no live access); Workspace, Product Catalog, Credential Lifecycle, Auth
Simulator, Gateway Simulator, Runtime Activation, and Developer Governance maintain bidirectional Product Access
cross-links with consistent **9A + 9B** labels.

No API keys, live endpoints, workers, webhooks, Supabase writes, or money subsystems are introduced.

Blueprint detail: **Phase 9C — Product Access Readiness Audit & Governance Hardening** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 41. Sandbox API request & flow simulation layer (Phase 10A)

Phase 10A adds `lib/developerSandboxRequestFlowConfig.js` and the Developer Console page
`/dev-console/request-simulator`. The layer models **sandbox API request envelopes**, **twelve validation stages**,
**deterministic response previews**, and **delegated linkage** into Phase 5B authentication, Phase 5C gateway, and
Phase 5D execution routing simulations — read-only alignment with Phases 8A–8B credential lifecycle/governance and
9A–9B product access/governance seeds.

`evaluateSandboxRequestCase` walks stages, applies `failure_state_keys`, merges auth/gateway/routing evaluations by seeded
case keys, and returns envelope, stage trace, validation summary, response preview, and outcome summary objects. Route
previews are labeled **preview only**; no endpoints, auth runtime, webhooks, workers, Supabase writes, or money movement
are introduced.

Cross-links on Product Access, Credential Lifecycle, Auth Simulator, Gateway Simulator, Execution Routing, Runtime
Activation, and Workspace point to Request Simulator with consistent sandbox-request copy.

Blueprint detail: **Phase 10A — Sandbox API Request & Flow Simulation Layer** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 42. Request governance & observability layer (Phase 10B)

Phase 10B adds `lib/developerRequestGovernanceConfig.js` and extends `/dev-console/request-simulator` with sections
**10B.1–10B.8**. The layer models **request governance states**, **visibility rules**, **observability signal vocabulary**,
**audit trail seeds**, **blocking models**, and **restriction rationales** — read-only alignment with Phase 10A
`SANDBOX_REQUEST_CASE_KEYS` and teaching bridges to Phase 2E/2F observability vocabulary.

`getRequestGovernanceOverview` merges preview seeds with the operator-selected case key for observability copy. Pure
helpers build governance, visibility, observability, audit, and risk summaries. No endpoints, live traffic, telemetry
emitters, audit ingestion, auth runtime, webhooks, workers, Supabase writes, or money movement are introduced.

Cross-links on Workspace, Product Access, Credential Lifecycle, Auth Simulator, Gateway Simulator, Execution Routing,
and Runtime Activation point to Request Simulator with consistent **10A + 10B** labels and governance/observability copy.

Blueprint detail: **Phase 10B — Request Governance & Observability Layer** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).

## 43. Request simulation readiness audit & governance hardening (Phase 10C)

Phase 10C audits and hardens Phases **10A–10B**: developer console route access via `RouteAuthGuard` and
`lib/developerAccessGate.js` (admins bypass; approved `developer_access_requests` required for `/dev-console/*`);
public `/developers` remains outside the gate; Navbar `useDeveloperNavHref` resolves to `/dev-console` only when access
is allowed. Config modules `lib/developerSandboxRequestFlowConfig.js` and `lib/developerRequestGovernanceConfig.js` stay
deterministic (no clocks, randomness, fetch, storage, or crypto; helpers return copies without mutating seeds).
`REQUEST_FAILURE_GOVERNANCE_LINKS` maps each Phase 10A `failure_key` to Phase 10B blocking models and restriction
rationales with startup alignment asserts.

`/dev-console/request-simulator` retains Phase 10A sections 3–9 and 10B.1–10B.8 with consolidated safety banner copy
(simulation only, metadata only, preview only, no execution, no live request traffic, no endpoint activation, no money
movement); failure cards surface linked blocking model and rationale labels. Workspace, Product Catalog, Product Access,
Credential Lifecycle, Auth Simulator, Gateway Simulator, Execution Routing, Runtime Activation, and Developer
Governance maintain bidirectional Request Simulator cross-links with consistent **10A + 10B** labels.

Observability signals and audit trail seeds remain static (no clock timestamps); blocking stage failures in
`evaluateSandboxRequestCase` align with governance blocking model keys.

No API keys, live endpoints, workers, webhooks, Supabase writes, or money subsystems are introduced.

Blueprint detail: **Phase 10C — Request Simulation Readiness Audit & Governance Hardening** in
[`docs/internal-service-blueprint.md`](./internal-service-blueprint.md).
