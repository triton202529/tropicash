/**
 * Tropicash — Internal Platform Service Blueprint config (Phase 1.75).
 *
 * Pure data: namespaces, integrations, planned event families, environment
 * rules, and non-negotiable safety rules for the future internal Blue
 * Atlantic platform layer (Tropicash, Triton, Sentinel, EliteHire Pro).
 *
 * THIS FILE IS PLANNING-ONLY. It does not:
 *   • create real internal APIs
 *   • create real public APIs
 *   • create API keys, secrets, or service tokens
 *   • modify treasury, wallet, withdrawal, PayPal funding, or fraud logic
 *
 * The canonical narrative lives in docs/internal-service-blueprint.md. When
 * exports below change materially, update that doc in the same PR.
 */

/**
 * Internal service namespaces. These are *not* HTTP routes. They are
 * logical service domains that future internal calls will be organized
 * under (e.g. `internal.wallets.get_balance`). Each namespace documents
 * its purpose, planned responsibilities, and the things it must NOT do
 * yet.
 */
export const INTERNAL_SERVICE_NAMESPACES = [
  {
    key: "internal.wallets",
    label: "Wallets",
    purpose:
      "Owns wallet identity, ledger entries, balance reads, and wallet-level lifecycle events.",
    responsibilities: [
      "Create wallets and assign currency/owner",
      "Expose read-only balance and history APIs to other internal services",
      "Emit wallet.* events (created, funded, debited, credited, adjusted)",
    ],
    mustNotYet: [
      "Be called from external developer apps directly",
      "Mutate balances without an idempotency key",
      "Bypass the fraud decision path on money movements",
    ],
  },
  {
    key: "internal.payments",
    label: "Payments",
    purpose:
      "Inbound money movement — accepting payments from external sources and routing settled funds to wallets.",
    responsibilities: [
      "Coordinate funding intents with the internal wallets namespace",
      "Emit payment.* lifecycle events",
      "Persist idempotency keys and outcomes for retries",
    ],
    mustNotYet: [
      "Touch PayPal funding logic owned by the existing funding pipeline",
      "Hold balance state itself — wallets is source of truth",
      "Expose endpoints publicly",
    ],
  },
  {
    key: "internal.payouts",
    label: "Payouts",
    purpose:
      "Outbound money movement — routing wallet balances to supported payout destinations.",
    responsibilities: [
      "Coordinate payout requests, processing, and settlement events",
      "Emit payout.* lifecycle events",
      "Track per-request idempotency keys",
    ],
    mustNotYet: [
      "Replace the existing withdrawal pipeline; the Treasury workstream owns live payout settlement",
      "Skip fraud review",
      "Process live payouts without admin/platform approval",
    ],
  },
  {
    key: "internal.treasury",
    label: "Treasury",
    purpose:
      "Reserved namespace for treasury reconciliation and settlement state. Owned by the Treasury workstream.",
    responsibilities: [
      "Future home of reconciliation feeds and settlement bookkeeping (owned elsewhere)",
      "Consume wallet.* / payout.* events for reconciliation",
    ],
    mustNotYet: [
      "Be modified from this Developer Center workstream",
      "Be addressable from the public Developer API",
      "Shadow-store wallet balances — wallets remains source of truth",
    ],
  },
  {
    key: "internal.fraud",
    label: "Fraud",
    purpose:
      "Reserved namespace for the fraud engine integration surface. Decisions remain owned by the existing fraud engine.",
    responsibilities: [
      "Receive enrichment context from wallets / payments / payouts",
      "Emit fraud.* events when state changes",
    ],
    mustNotYet: [
      "Re-implement or override fraud rules",
      "Be modified from this Developer Center workstream",
      "Be bypassed by Blue Atlantic internal integrations",
    ],
  },
  {
    key: "internal.notifications",
    label: "Notifications",
    purpose:
      "In-app, email, and push notification fan-out for user-visible events.",
    responsibilities: [
      "Translate internal events into user-facing notifications",
      "Respect per-user preferences and account status",
    ],
    mustNotYet: [
      "Be a transport for sensitive credentials or secrets",
      "Be called from external developer apps directly",
    ],
  },
  {
    key: "internal.triton",
    label: "Triton bridge",
    purpose:
      "Internal connector to the Triton funding & withdrawal bridge.",
    responsibilities: [
      "Reserve trading capital, fund trading accounts, withdraw profits",
      "Sync trade funding records back to wallets",
      "Emit integration.triton_* events",
    ],
    mustNotYet: [
      "Bypass the wallet ledger when adjusting balances",
      "Be called from external developer apps directly",
      "Operate without idempotency keys on money-moving requests",
    ],
  },
  {
    key: "internal.sentinel",
    label: "Sentinel reporting",
    purpose:
      "One-way reporting feed into the Sentinel financial/accounting platform.",
    responsibilities: [
      "Export ledger records, statements, and reconciliation feeds",
      "Emit integration.sentinel_sync_completed events",
    ],
    mustNotYet: [
      "Write back to the Tropicash wallet ledger",
      "Be addressable from the public Developer API",
    ],
  },
  {
    key: "internal.elitehire",
    label: "EliteHire Pro",
    purpose:
      "Internal connector for EliteHire Pro employer payments, job posting payments, contractor payouts, future escrow, and subscriptions.",
    responsibilities: [
      "Initiate payments and payouts that settle through Tropicash wallets",
      "Emit integration.elitehire_payment_completed events",
    ],
    mustNotYet: [
      "Bypass auth/scopes — even as a trusted internal client",
      "Mutate wallet balances directly",
      "Be exposed publicly",
    ],
  },
];

/**
 * Blue Atlantic integration map. Each integration documents the planned
 * capabilities Tropicash will support with that platform. Capabilities are
 * directional descriptions, not endpoints.
 */
export const INTERNAL_BLUE_ATLANTIC_INTEGRATIONS = [
  {
    key: "tropicash_triton",
    label: "Tropicash ↔ Triton",
    summary:
      "Triton acts as the funding/withdrawal bridge and trading-capital reservation surface.",
    capabilities: [
      "Fund trading account",
      "Withdraw profits",
      "Check wallet liquidity",
      "Reserve trading capital",
      "Sync trade funding records",
    ],
  },
  {
    key: "tropicash_sentinel",
    label: "Tropicash ↔ Sentinel",
    summary:
      "Sentinel ingests Tropicash financial and accounting events for internal reporting.",
    capabilities: [
      "Sync transaction events",
      "Export ledger records",
      "Treasury reporting",
      "Statements / accounting summaries",
      "Reconciliation feeds",
    ],
  },
  {
    key: "tropicash_elitehire",
    label: "Tropicash ↔ EliteHire Pro",
    summary:
      "EliteHire Pro initiates payments and payouts that settle through Tropicash wallets.",
    capabilities: [
      "Employer payments",
      "Job posting payments",
      "Contractor payouts",
      "Future escrow",
      "Subscriptions",
    ],
  },
];

/**
 * Planned internal event families. Names and payloads are directional —
 * final naming + schemas will be confirmed before any consumer relies on
 * them. See STANDARD_EVENT_FIELDS for the envelope shape.
 */
export const INTERNAL_EVENT_FAMILIES = [
  {
    family: "wallet",
    description:
      "Wallet lifecycle and ledger movement events. Source of truth: the wallets namespace.",
    events: [
      "wallet.created",
      "wallet.funded",
      "wallet.debited",
      "wallet.credited",
      "wallet.balance_adjusted",
    ],
  },
  {
    family: "payment",
    description:
      "Inbound money movement lifecycle. Emitted by the payments namespace.",
    events: [
      "payment.created",
      "payment.completed",
      "payment.failed",
      "payment.refunded",
    ],
  },
  {
    family: "payout",
    description:
      "Outbound money movement lifecycle. Emitted by the payouts namespace; settlement is owned by Treasury.",
    events: [
      "payout.requested",
      "payout.processing",
      "payout.completed",
      "payout.failed",
      "payout.rejected",
    ],
  },
  {
    family: "fraud",
    description:
      "Fraud-decision state transitions. Emitted by the fraud namespace; decisions remain owned by the existing fraud engine.",
    events: [
      "fraud.flagged",
      "fraud.reviewed",
      "fraud.escalated",
      "fraud.cleared",
    ],
  },
  {
    family: "developer",
    description:
      "Developer Center lifecycle. Emitted as the developer program matures.",
    events: [
      "developer.access_requested",
      "developer.app_created",
      "developer.api_key_created",
      "developer.api_key_revoked",
    ],
  },
  {
    family: "integration",
    description:
      "Blue Atlantic integration crosswalk events. Emitted by the respective integration namespaces.",
    events: [
      "integration.triton_transfer_requested",
      "integration.triton_transfer_completed",
      "integration.sentinel_sync_completed",
      "integration.elitehire_payment_completed",
    ],
  },
];

/**
 * Standard event envelope shape. The `fields` array documents each
 * envelope field; `example` shows the shape with placeholder values.
 *
 * No real values, IDs, or secrets are embedded. The `example` object is
 * for documentation rendering only.
 */
export const STANDARD_EVENT_FIELDS = {
  fields: [
    {
      name: "event_id",
      type: "uuid",
      required: true,
      description: "Globally unique event identifier. Required for dedupe and replay.",
    },
    {
      name: "event_type",
      type: "string",
      required: true,
      description: "Fully-qualified event name (e.g. 'wallet.funded').",
    },
    {
      name: "environment",
      type: "enum: sandbox | live",
      required: true,
      description: "Environment that produced the event. Sandbox and live must never mix.",
    },
    {
      name: "source",
      type: "string",
      required: true,
      description:
        "Internal service that produced the event (e.g. 'tropicash', 'triton', 'sentinel').",
    },
    {
      name: "occurred_at",
      type: "ISO-8601 timestamp",
      required: true,
      description: "When the underlying state change happened. Producer-assigned, not consumer-assigned.",
    },
    {
      name: "actor",
      type: "object: { type, id }",
      required: true,
      description:
        "Who/what initiated the change. type ∈ {user, admin, system, service}; id is a uuid or service name.",
    },
    {
      name: "subject",
      type: "object: { type, id }",
      required: true,
      description:
        "What the event is about. type ∈ {wallet, payment, payout, integration}; id is a uuid.",
    },
    {
      name: "amount",
      type: "object: { value, currency } | null",
      required: false,
      description: "Monetary amount, when applicable. Omitted for non-money events.",
    },
    {
      name: "metadata",
      type: "object",
      required: false,
      description: "Free-form metadata. Must never contain secrets, raw PII beyond what's necessary, or auth tokens.",
    },
  ],
  example: {
    event_id: "00000000-0000-0000-0000-000000000000",
    event_type: "wallet.funded",
    environment: "sandbox",
    source: "tropicash",
    occurred_at: "2026-05-11T20:29:00.000Z",
    actor: {
      type: "system",
      id: "tropicash",
    },
    subject: {
      type: "wallet",
      id: "00000000-0000-0000-0000-000000000000",
    },
    amount: {
      value: 100.0,
      currency: "USD",
    },
    metadata: {},
  },
};

/**
 * Environment rules. Sandbox and live are strictly isolated; cross-env
 * usage is forbidden. Live access requires admin/platform approval.
 */
export const INTERNAL_ENVIRONMENT_RULES = {
  environments: [
    {
      key: "sandbox",
      label: "Sandbox",
      rules: [
        "Never moves real money",
        "Sandbox API keys cannot call live endpoints",
        "Sandbox data must be visibly distinguishable from live data",
        "Future migration may move sandbox to an isolated project/schema",
      ],
    },
    {
      key: "live",
      label: "Live",
      rules: [
        "Requires admin / platform approval before access is granted",
        "Live API keys cannot call sandbox endpoints",
        "Live event traffic must be reconcilable against the wallet ledger",
        "Subject to all production safety + audit controls",
      ],
    },
  ],
  shared: [
    "No cross-environment API key usage",
    "Sandbox and live data must be distinguishable",
    "Sandbox never reaches the live wallet ledger, payout pipeline, or treasury bridge",
  ],
};

/**
 * Idempotency rules. Money-moving requests must be safely retryable.
 */
export const INTERNAL_IDEMPOTENCY_RULES = {
  required_for: [
    "Payments",
    "Payouts",
    "Wallet adjustments",
    "Triton transfers",
  ],
  rules: [
    "Every money-moving request must support an idempotency key",
    "Duplicate idempotency keys must return the original result, not a new one",
    "Idempotency keys are scoped per developer app and per environment",
    "Request logs must store idempotency_key, request_hash, and response_status",
  ],
};

/**
 * Non-negotiable safety rules. Any change to the developer platform or
 * Blue Atlantic integration layer must respect these.
 */
export const INTERNAL_SAFETY_RULES = [
  "Wallet ledger remains source of truth",
  "Treasury systems remain isolated",
  "Internal services are never public",
  "Public APIs must pass through auth/rate-limit layer",
  "Every money movement must be auditable",
  "Every event must have an event_id",
  "No secret keys in frontend",
  "Fraud checks must remain in the decision path",
  "Blue Atlantic internal integrations must not bypass wallet/ledger controls",
  "External developers must never access internal service routes",
];

/**
 * Future-only auth model options. Documentation references — no
 * implementation exists today.
 */
export const INTERNAL_AUTH_MODEL_FUTURE = {
  status: "not_implemented",
  notes:
    "No internal service-to-service auth implementation exists yet. The options below are planning-only.",
  options: [
    "Service-to-service tokens (issued to internal services, not external developers)",
    "HMAC request signing with per-service secrets",
    "Scoped internal service permissions (least-privilege per namespace)",
    "Allowlisted service identities at the platform edge",
    "Audit logs for every internal call",
  ],
};
