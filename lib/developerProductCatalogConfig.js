/**
 * Tropicash Developer Platform — Phase 4D:
 * Sandbox runtime contracts & API product catalog (static modeling only).
 *
 * THIS FILE IS DEFINITION-ONLY. It does NOT:
 *   • expose or call real HTTP APIs, workers, or webhooks
 *   • mint API keys, secrets, or credentials
 *   • touch Supabase, wallets, treasury, payouts, PayPal, or fraud execution
 *
 * Capability keys intentionally align with `lib/internalCapabilityConfig.js`
 * (`INTERNAL_CAPABILITY_SEEDS`) where products reference backend affordances.
 */

export const DEVELOPER_PRODUCT_PHASE = "phase_4d_product_catalog";

/** @typedef {"wallet"|"transfers"|"merchant"|"sandbox"|"observability"|"governance"|"analytics"|"platform"|"internal"} ApiProductCategoryKey */

/** Product taxonomy aligned with developer-facing surfaces (not SQL enums). */
export const API_PRODUCT_CATEGORIES = [
  {
    key: "wallet",
    label: "Wallet",
    description: "Ledger-shaped reads and reservations surfaced as developer-facing contracts.",
    accent: "#2563eb",
    icon: "👛",
  },
  {
    key: "transfers",
    label: "Transfers & payouts",
    description: "Outbound movement blueprints (sandbox-first simulations).",
    accent: "#f97316",
    icon: "↔️",
  },
  {
    key: "merchant",
    label: "Merchant & checkout",
    description: "Payment session and capture surfaces aimed at commerce integrations.",
    accent: "#0ea5e9",
    icon: "🏪",
  },
  {
    key: "sandbox",
    label: "Sandbox",
    description: "Deterministic simulation and rehearsal surfaces isolated from live traffic.",
    accent: "#a855f7",
    icon: "🧪",
  },
  {
    key: "observability",
    label: "Observability",
    description: "Trace exports, signal previews, and diagnostic affordances.",
    accent: "#0f766e",
    icon: "📡",
  },
  {
    key: "governance",
    label: "Governance",
    description: "Review-gated operations and administrative rehearsal contracts.",
    accent: "#a21caf",
    icon: "🛡️",
  },
  {
    key: "analytics",
    label: "Analytics",
    description: "Batch exports and derived reporting bundles (read-only shapes).",
    accent: "#0284c7",
    icon: "📊",
  },
  {
    key: "platform",
    label: "Platform",
    description: "Cross-cutting platform utilities (notifications, delivery, shared plumbing).",
    accent: "#64748b",
    icon: "⚙️",
  },
  {
    key: "internal",
    label: "Internal / partner",
    description: "Restricted partner and Blue-Atlantic-internal catalog entries (metadata only).",
    accent: "#475569",
    icon: "🏢",
  },
];

/** Reasonable vocabulary for how a catalog entry is packaged. */
export const API_PRODUCT_TYPES = [
  {
    key: "rest_contract",
    label: "REST contract preview",
    description: "Request/response schema shapes for a future HTTP surface.",
  },
  {
    key: "simulation_surface",
    label: "Simulation surface",
    description: "Deterministic sandbox outcomes without persistent side effects.",
  },
  {
    key: "batch_export_contract",
    label: "Batch export contract",
    description: "File or async export style contract (still static in this phase).",
  },
  {
    key: "review_surface",
    label: "Human review surface",
    description: "Operations that always pause for operator or policy review in live mode.",
  },
  {
    key: "catalog_descriptor",
    label: "Catalog descriptor",
    description: "Grouping or cross-product documentation node (no standalone route).",
  },
];

export const API_RATE_LIMIT_TIERS = ["sandbox_basic", "sandbox_partner", "internal", "restricted"];

export const API_CONTRACT_ENVIRONMENTS = ["sandbox", "live"];

export const API_CONTRACT_STATUSES = ["planned", "active"];

export const API_OPERATION_TYPES = [
  "read",
  "write",
  "simulate",
  "review",
  "analytics",
  "administrative",
];

export const API_PRODUCT_STATUSES = [
  "planned",
  "sandbox_preview",
  "internal_only",
  "restricted",
  "disabled",
];

export const API_PRODUCT_RISK_LEVELS = ["low", "medium", "high", "critical"];

/**
 * Conceptual safety rules for reviewers and UI copy.
 * No operational enforcement is implied.
 */
export const API_PRODUCT_SAFETY_RULES = [
  "Catalog rows, route previews, and JSON schema literals are illustrative — they are not routable endpoints.",
  "Never paste real API keys, webhook signing secrets, or session tokens into sandbox rehearsal tools.",
  "Live-labelled contracts remain inert until explicit governance clears both the product and the app.",
  "Simulated outcomes are finite enumerations for teaching UI; they do not guarantee future production semantics.",
  "Rate limit tiers describe intent only; no throttling or quota storage is attached to this config.",
  "Capabilities referenced here must still be assigned through the sandbox governance queue — the catalog does not grant access.",
  "Restricted and internal_only products exist for auditability; consuming them requires additional operator review.",
];

/**
 * Seed products spanning categories. `capability_keys` mirror Phase 2C seeds when applicable.
 *
 * @type {ReadonlyArray<{
 *   product_key: string,
 *   title: string,
 *   category: ApiProductCategoryKey,
 *   product_type: string,
 *   description: string,
 *   status: string,
 *   environments: string[],
 *   capability_keys: string[],
 *   operation_types: string[],
 *   rate_limit_tier: string,
 *   risk_level: string,
 *   review_required: boolean,
 *   sandbox_supported: boolean,
 *   live_supported: boolean,
 * }>}
 */
export const API_PRODUCTS = [
  {
    product_key: "prod_wallet_balance_read",
    title: "Wallet balance inspector",
    category: "wallet",
    product_type: "rest_contract",
    description:
      "Read-only balance snapshot contract for sandbox apps reconciling UI state against ledger-shaped responses.",
    status: "sandbox_preview",
    environments: ["sandbox"],
    capability_keys: ["wallet.read"],
    operation_types: ["read"],
    rate_limit_tier: "sandbox_basic",
    risk_level: "low",
    review_required: false,
    sandbox_supported: true,
    live_supported: false,
  },
  {
    product_key: "prod_wallet_reserve_sim",
    title: "Wallet reservation simulator",
    category: "sandbox",
    product_type: "simulation_surface",
    description:
      "Rehearses reservation requests with deterministic hold / release narratives — no ledger writes in this modeling phase.",
    status: "sandbox_preview",
    environments: ["sandbox"],
    capability_keys: ["wallet.reserve", "wallet.release"],
    operation_types: ["simulate", "write"],
    rate_limit_tier: "sandbox_partner",
    risk_level: "medium",
    review_required: false,
    sandbox_supported: true,
    live_supported: false,
  },
  {
    product_key: "prod_checkout_session",
    title: "Checkout session contract",
    category: "merchant",
    product_type: "rest_contract",
    description:
      "Defines the JSON bodies for creating a merchant-facing payment session prior to capture.",
    status: "planned",
    environments: ["sandbox", "live"],
    capability_keys: ["payment.create"],
    operation_types: ["write"],
    rate_limit_tier: "sandbox_partner",
    risk_level: "medium",
    review_required: true,
    sandbox_supported: true,
    live_supported: true,
  },
  {
    product_key: "prod_payment_capture_review",
    title: "Payment capture review bridge",
    category: "governance",
    product_type: "review_surface",
    description:
      "Capture operations that must pair with fraud and governance signals before clearing.",
    status: "restricted",
    environments: ["sandbox", "live"],
    capability_keys: ["payment.capture", "fraud.review_required"],
    operation_types: ["write", "review"],
    rate_limit_tier: "restricted",
    risk_level: "critical",
    review_required: true,
    sandbox_supported: true,
    live_supported: true,
  },
  {
    product_key: "prod_payout_request_blueprint",
    title: "Payout request blueprint",
    category: "transfers",
    product_type: "rest_contract",
    description:
      "Static blueprint for initiating sandbox payout requests with explicit idempotency headers in documentation.",
    status: "sandbox_preview",
    environments: ["sandbox"],
    capability_keys: ["payout.request"],
    operation_types: ["write"],
    rate_limit_tier: "sandbox_basic",
    risk_level: "high",
    review_required: true,
    sandbox_supported: true,
    live_supported: false,
  },
  {
    product_key: "prod_partner_webhook_catalog",
    title: "Partner webhook catalog",
    category: "platform",
    product_type: "catalog_descriptor",
    description:
      "Enumerates webhook envelopes developers may subscribe to once delivery infrastructure exists.",
    status: "planned",
    environments: ["sandbox", "live"],
    capability_keys: ["developer.webhook_manage"],
    operation_types: ["read", "administrative"],
    rate_limit_tier: "sandbox_basic",
    risk_level: "low",
    review_required: false,
    sandbox_supported: true,
    live_supported: true,
  },
  {
    product_key: "prod_statement_export_bundle",
    title: "Statement export bundle",
    category: "analytics",
    product_type: "batch_export_contract",
    description:
      "Batch export schema for ledger statements aimed at downstream analytics warehouses.",
    status: "internal_only",
    environments: ["sandbox", "live"],
    capability_keys: ["ledger.export", "ledger.statement_generate"],
    operation_types: ["analytics", "read"],
    rate_limit_tier: "internal",
    risk_level: "medium",
    review_required: true,
    sandbox_supported: true,
    live_supported: false,
  },
  {
    product_key: "prod_execution_trace_preview",
    title: "Execution trace preview",
    category: "observability",
    product_type: "simulation_surface",
    description:
      "Links orchestration previews to summarized trace payloads for developer education.",
    status: "sandbox_preview",
    environments: ["sandbox"],
    capability_keys: ["ledger.export"],
    operation_types: ["read", "simulate"],
    rate_limit_tier: "sandbox_partner",
    risk_level: "low",
    review_required: false,
    sandbox_supported: true,
    live_supported: false,
  },
  {
    product_key: "prod_notification_dispatch",
    title: "Notification dispatch contract",
    category: "platform",
    product_type: "rest_contract",
    description:
      "Non-monetary messaging contract that mirrors internal notification capabilities.",
    status: "sandbox_preview",
    environments: ["sandbox"],
    capability_keys: ["notification.send"],
    operation_types: ["write"],
    rate_limit_tier: "sandbox_basic",
    risk_level: "low",
    review_required: false,
    sandbox_supported: true,
    live_supported: false,
  },
  {
    product_key: "prod_treasury_partner_read",
    title: "Treasury liquidity read (partner)",
    category: "internal",
    product_type: "rest_contract",
    description:
      "Restricted read shapes for treasury summaries — sandbox rehearsal only in this catalog.",
    status: "internal_only",
    environments: ["sandbox"],
    capability_keys: ["treasury.read_summary"],
    operation_types: ["read"],
    rate_limit_tier: "internal",
    risk_level: "high",
    review_required: true,
    sandbox_supported: true,
    live_supported: false,
  },
  {
    product_key: "prod_triton_funding_rehearsal",
    title: "Triton funding rehearsal",
    category: "sandbox",
    product_type: "simulation_surface",
    description:
      "Sandbox-only simulation aligning with trading capital movement narratives (no bridge execution).",
    status: "disabled",
    environments: ["sandbox"],
    capability_keys: ["trading.funding_reserve"],
    operation_types: ["simulate"],
    rate_limit_tier: "restricted",
    risk_level: "critical",
    review_required: true,
    sandbox_supported: true,
    live_supported: false,
  },
];

/**
 * Sandbox contract seeds (illustrative routes only).
 *
 * @type {ReadonlyArray<{
 *   contract_key: string,
 *   product_key: string,
 *   route_preview: string,
 *   method: string,
 *   title: string,
 *   description: string,
 *   required_capabilities: string[],
 *   request_schema: Record<string, unknown>,
 *   response_schema: Record<string, unknown>,
 *   simulated_outcomes: string[],
 *   review_required: boolean,
 *   environment: string,
 *   rate_limit_tier: string,
 *   status: string,
 *   notes: string,
 * }>}
 */
export const API_SANDBOX_CONTRACTS = [
  {
    contract_key: "sc_wallet_balance_preview",
    product_key: "prod_wallet_balance_read",
    route_preview: "GET /sandbox/wallet/balance-preview",
    method: "GET",
    title: "Preview wallet balance payload",
    description: "Returns a static ledger-shaped snapshot for UI harness tests.",
    required_capabilities: ["wallet.read"],
    request_schema: {
      type: "object",
      properties: {
        wallet_handle: { type: "string", description: "Sandbox-only opaque wallet identifier." },
        currency: { type: "string", enum: ["USD"] },
      },
      required: ["wallet_handle"],
    },
    response_schema: {
      type: "object",
      properties: {
        wallet_handle: { type: "string" },
        available: { type: "string", pattern: "^[0-9]+\\.[0-9]{2}$" },
        pending: { type: "string", pattern: "^[0-9]+\\.[0-9]{2}$" },
        environment: { type: "string", enum: ["sandbox"] },
      },
      required: ["wallet_handle", "available", "environment"],
    },
    simulated_outcomes: ["ok_balances", "wallet_not_found", "currency_mismatch"],
    review_required: false,
    environment: "sandbox",
    rate_limit_tier: "sandbox_basic",
    status: "active",
    notes: "Ties to Phase 4C sandbox capability assignments for wallet.read.",
  },
  {
    contract_key: "sc_wallet_reserve_cycle",
    product_key: "prod_wallet_reserve_sim",
    route_preview: "POST /sandbox/wallet/reservations/simulate",
    method: "POST",
    title: "Simulate reserve / release cycle",
    description: "Walks a two-step hold narrative with explicit failure codes for teaching panels.",
    required_capabilities: ["wallet.reserve", "wallet.release"],
    request_schema: {
      type: "object",
      properties: {
        amount: { type: "string", description: "Decimal string amount for display only." },
        idempotency_key: { type: "string", minLength: 8 },
      },
      required: ["amount", "idempotency_key"],
    },
    response_schema: {
      type: "object",
      properties: {
        reservation_id: { type: "string" },
        phase: { type: "string", enum: ["held", "released", "failed"] },
        detail: { type: "string" },
      },
      required: ["reservation_id", "phase"],
    },
    simulated_outcomes: ["held", "released", "idempotency_replay", "limit_exceeded"],
    review_required: false,
    environment: "sandbox",
    rate_limit_tier: "sandbox_partner",
    status: "active",
    notes: "No persistent reservation store is implied by this static contract.",
  },
  {
    contract_key: "sc_checkout_session_create",
    product_key: "prod_checkout_session",
    route_preview: "POST /sandbox/merchant/checkout-sessions",
    method: "POST",
    title: "Create sandbox checkout session",
    description: "Allocates a session token for sandbox UI flows — not a payment capture.",
    required_capabilities: ["payment.create"],
    request_schema: {
      type: "object",
      properties: {
        merchant_reference: { type: "string" },
        line_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              sku: { type: "string" },
              quantity: { type: "integer", minimum: 1 },
            },
            required: ["sku", "quantity"],
          },
        },
      },
      required: ["merchant_reference", "line_items"],
    },
    response_schema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        status: { type: "string", enum: ["created", "invalid_payload"] },
      },
      required: ["session_id", "status"],
    },
    simulated_outcomes: ["created", "invalid_payload", "merchant_not_ready"],
    review_required: true,
    environment: "sandbox",
    rate_limit_tier: "sandbox_partner",
    status: "planned",
    notes: "Live twin would reuse schema with environment=live after governance clears the app.",
  },
  {
    contract_key: "sc_payment_capture_review",
    product_key: "prod_payment_capture_review",
    route_preview: "POST /sandbox/payments/capture-review",
    method: "POST",
    title: "Capture with review checkpoint",
    description: "Demonstrates mandatory review routing before a capture is considered cleared.",
    required_capabilities: ["payment.capture", "fraud.review_required"],
    request_schema: {
      type: "object",
      properties: {
        authorization_id: { type: "string" },
        amount: { type: "string" },
      },
      required: ["authorization_id", "amount"],
    },
    response_schema: {
      type: "object",
      properties: {
        capture_id: { type: "string" },
        decision: { type: "string", enum: ["cleared", "pending_review", "blocked"] },
      },
      required: ["decision"],
    },
    simulated_outcomes: ["cleared", "pending_review", "blocked"],
    review_required: true,
    environment: "sandbox",
    rate_limit_tier: "restricted",
    status: "active",
    notes: "Sandbox uses the same decision vocabulary for teaching — not a fraud engine.",
  },
  {
    contract_key: "sc_payout_request_intake",
    product_key: "prod_payout_request_blueprint",
    route_preview: "POST /sandbox/transfers/payout-requests",
    method: "POST",
    title: "Intake payout request blueprint",
    description: "Static body for initiating a sandbox payout rehearsal with explicit risk flag.",
    required_capabilities: ["payout.request"],
    request_schema: {
      type: "object",
      properties: {
        beneficiary_ref: { type: "string" },
        amount: { type: "string" },
        idempotency_key: { type: "string", minLength: 8 },
      },
      required: ["beneficiary_ref", "amount", "idempotency_key"],
    },
    response_schema: {
      type: "object",
      properties: {
        request_id: { type: "string" },
        state: { type: "string", enum: ["accepted_simulation", "rejected_validation"] },
      },
      required: ["request_id", "state"],
    },
    simulated_outcomes: ["accepted_simulation", "rejected_validation", "duplicate_request"],
    review_required: true,
    environment: "sandbox",
    rate_limit_tier: "sandbox_basic",
    status: "planned",
    notes: "High-risk label is for catalog sorting, not automated enforcement.",
  },
  {
    contract_key: "sc_webhook_topic_list",
    product_key: "prod_partner_webhook_catalog",
    route_preview: "GET /sandbox/platform/webhooks/catalog",
    method: "GET",
    title: "List webhook catalog entries",
    description: "Returns static topic metadata for developer education.",
    required_capabilities: ["developer.webhook_manage"],
    request_schema: { type: "object", properties: {}, additionalProperties: false },
    response_schema: {
      type: "object",
      properties: {
        topics: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topic_key: { type: "string" },
              delivery_mode: { type: "string", enum: ["at_least_once"] },
            },
            required: ["topic_key", "delivery_mode"],
          },
        },
      },
      required: ["topics"],
    },
    simulated_outcomes: ["catalog_returned"],
    review_required: false,
    environment: "sandbox",
    rate_limit_tier: "sandbox_basic",
    status: "active",
    notes: "No signing secret material is modeled here.",
  },
  {
    contract_key: "sc_statement_export_job",
    product_key: "prod_statement_export_bundle",
    route_preview: "POST /sandbox/analytics/statement-exports",
    method: "POST",
    title: "Request statement export job",
    description: "Describes async export enqueue for analytics partners (still inert).",
    required_capabilities: ["ledger.export", "ledger.statement_generate"],
    request_schema: {
      type: "object",
      properties: {
        period_start: { type: "string", format: "date" },
        period_end: { type: "string", format: "date" },
        format: { type: "string", enum: ["csv", "jsonl"] },
      },
      required: ["period_start", "period_end", "format"],
    },
    response_schema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        status: { type: "string", enum: ["queued_simulation"] },
      },
      required: ["job_id", "status"],
    },
    simulated_outcomes: ["queued_simulation", "window_too_large"],
    review_required: true,
    environment: "sandbox",
    rate_limit_tier: "internal",
    status: "planned",
    notes: "internal_only product — contract still listed for completeness in dev console.",
  },
  {
    contract_key: "sc_trace_bundle_fetch",
    product_key: "prod_execution_trace_preview",
    route_preview: "GET /sandbox/observability/traces/{trace_id}",
    method: "GET",
    title: "Fetch summarized trace bundle",
    description: "Returns a compact trace narrative for sandbox simulators.",
    required_capabilities: ["ledger.export"],
    request_schema: {
      type: "object",
      properties: {
        trace_id: { type: "string" },
      },
      required: ["trace_id"],
    },
    response_schema: {
      type: "object",
      properties: {
        trace_id: { type: "string" },
        spans: { type: "array", items: { type: "object" } },
      },
      required: ["trace_id", "spans"],
    },
    simulated_outcomes: ["found", "not_found"],
    review_required: false,
    environment: "sandbox",
    rate_limit_tier: "sandbox_partner",
    status: "active",
    notes: "Span objects are intentionally underspecified placeholders.",
  },
  {
    contract_key: "sc_notification_dispatch",
    product_key: "prod_notification_dispatch",
    route_preview: "POST /sandbox/platform/notifications/dispatch",
    method: "POST",
    title: "Dispatch templated notification",
    description: "Non-monetary notification contract for sandbox harnesses.",
    required_capabilities: ["notification.send"],
    request_schema: {
      type: "object",
      properties: {
        template_key: { type: "string" },
        recipient_ref: { type: "string" },
        payload: { type: "object" },
      },
      required: ["template_key", "recipient_ref"],
    },
    response_schema: {
      type: "object",
      properties: {
        dispatch_id: { type: "string" },
        status: { type: "string", enum: ["queued_simulation", "invalid_template"] },
      },
      required: ["dispatch_id", "status"],
    },
    simulated_outcomes: ["queued_simulation", "invalid_template"],
    review_required: false,
    environment: "sandbox",
    rate_limit_tier: "sandbox_basic",
    status: "active",
    notes: "Payload must never include secrets — enforced by policy narrative, not code here.",
  },
  {
    contract_key: "sc_treasury_summary_read",
    product_key: "prod_treasury_partner_read",
    route_preview: "GET /sandbox/internal/treasury/summary-preview",
    method: "GET",
    title: "Treasury summary preview",
    description: "Partner-only rehearsal of liquidity summary responses.",
    required_capabilities: ["treasury.read_summary"],
    request_schema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["partner_sandbox"] },
      },
      required: ["scope"],
    },
    response_schema: {
      type: "object",
      properties: {
        snapshot_as_of: { type: "string" },
        buckets: { type: "array", items: { type: "object" } },
      },
      required: ["snapshot_as_of", "buckets"],
    },
    simulated_outcomes: ["summary_returned", "scope_denied"],
    review_required: true,
    environment: "sandbox",
    rate_limit_tier: "internal",
    status: "planned",
    notes: "Requires both internal tiering and explicit app governance clearance.",
  },
  {
    contract_key: "sc_triton_funding_sim",
    product_key: "prod_triton_funding_rehearsal",
    route_preview: "POST /sandbox/trading/funding/rehearse",
    method: "POST",
    title: "Rehearse Triton funding reserve",
    description: "Disabled product still documents the contract for historical traceability.",
    required_capabilities: ["trading.funding_reserve"],
    request_schema: {
      type: "object",
      properties: {
        funding_intent: { type: "string" },
      },
      required: ["funding_intent"],
    },
    response_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["disabled_in_catalog"] },
      },
      required: ["status"],
    },
    simulated_outcomes: ["disabled_in_catalog"],
    review_required: true,
    environment: "sandbox",
    rate_limit_tier: "restricted",
    status: "planned",
    notes: "Product flagged disabled — contract remains as documentation skeleton.",
  },
  {
    contract_key: "sc_live_capture_mirror",
    product_key: "prod_checkout_session",
    route_preview: "POST /live/merchant/checkout-sessions",
    method: "POST",
    title: "Live checkout session mirror (planned)",
    description: "Documentation-only twin emphasising additional review for live-labelled traffic.",
    required_capabilities: ["payment.create"],
    request_schema: {
      type: "object",
      properties: {
        merchant_reference: { type: "string" },
      },
      required: ["merchant_reference"],
    },
    response_schema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        environment: { type: "string", enum: ["live"] },
      },
      required: ["session_id", "environment"],
    },
    simulated_outcomes: ["not_available_in_preview_ui"],
    review_required: true,
    environment: "live",
    rate_limit_tier: "sandbox_partner",
    status: "planned",
    notes: "Illustrates environment separation — still non-runnable in this repository phase.",
  },
];

const productByKey = Object.fromEntries(API_PRODUCTS.map((p) => [p.product_key, p]));

export function getProductByKey(key) {
  return productByKey[key] ?? null;
}

export function getContractsForProduct(productKey) {
  return API_SANDBOX_CONTRACTS.filter((c) => c.product_key === productKey);
}

export function getContractsForCapability(capabilityKey) {
  return API_SANDBOX_CONTRACTS.filter((c) =>
    (c.required_capabilities || []).includes(capabilityKey),
  );
}

/** @returns {Record<string, typeof API_PRODUCTS[number][]>} */
export function buildProductCapabilityMap() {
  /** @type {Record<string, typeof API_PRODUCTS[number][]>} */
  const map = {};
  for (const product of API_PRODUCTS) {
    for (const ck of product.capability_keys) {
      if (!map[ck]) map[ck] = [];
      map[ck].push(product);
    }
  }
  return map;
}

export function buildSandboxContractRows() {
  return API_SANDBOX_CONTRACTS.map((contract) => {
    const product = getProductByKey(contract.product_key);
    return {
      contract_key: contract.contract_key,
      product_key: contract.product_key,
      product_title: product?.title ?? contract.product_key,
      product_category: product?.category ?? null,
      route_preview: contract.route_preview,
      method: contract.method,
      title: contract.title,
      environment: contract.environment,
      rate_limit_tier: contract.rate_limit_tier,
      status: contract.status,
      review_required: contract.review_required,
      required_capabilities: contract.required_capabilities,
    };
  });
}

export function buildRateLimitSummary() {
  /** @type {Record<string, { products: number, contracts: number }>} */
  const tiers = {};
  for (const t of API_RATE_LIMIT_TIERS) {
    tiers[t] = { products: 0, contracts: 0 };
  }
  for (const p of API_PRODUCTS) {
    if (tiers[p.rate_limit_tier]) tiers[p.rate_limit_tier].products += 1;
  }
  for (const c of API_SANDBOX_CONTRACTS) {
    if (tiers[c.rate_limit_tier]) tiers[c.rate_limit_tier].contracts += 1;
  }
  return tiers;
}

export function buildEnvironmentRestrictionSummary() {
  const productsSandboxOnly = API_PRODUCTS.filter((p) => p.sandbox_supported && !p.live_supported).length;
  const productsLiveCapable = API_PRODUCTS.filter((p) => p.live_supported).length;
  const contractsSandbox = API_SANDBOX_CONTRACTS.filter((c) => c.environment === "sandbox").length;
  const contractsLive = API_SANDBOX_CONTRACTS.filter((c) => c.environment === "live").length;
  const productsListingBothEnvironments = API_PRODUCTS.filter((p) =>
    (p.environments || []).includes("sandbox") && (p.environments || []).includes("live"),
  ).length;

  return {
    products_total: API_PRODUCTS.length,
    products_sandbox_only_support: productsSandboxOnly,
    products_live_capable: productsLiveCapable,
    products_catalog_env_both: productsListingBothEnvironments,
    contracts_total: API_SANDBOX_CONTRACTS.length,
    contracts_sandbox_environment: contractsSandbox,
    contracts_live_environment: contractsLive,
  };
}

export function buildContractHealthSummary() {
  const reviewRequiredContracts = API_SANDBOX_CONTRACTS.filter((c) => c.review_required).length;
  /** @type {Record<string, number>} */
  const byStatus = {};
  for (const c of API_SANDBOX_CONTRACTS) {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1;
  }
  /** @type {Record<string, number>} */
  const byEnvironment = {};
  for (const c of API_SANDBOX_CONTRACTS) {
    byEnvironment[c.environment] = (byEnvironment[c.environment] || 0) + 1;
  }
  return {
    total_contracts: API_SANDBOX_CONTRACTS.length,
    review_required_contracts: reviewRequiredContracts,
    contracts_by_status: byStatus,
    contracts_by_environment: byEnvironment,
    products_without_contracts: API_PRODUCTS.filter(
      (p) => getContractsForProduct(p.product_key).length === 0,
    ).map((p) => p.product_key),
  };
}
