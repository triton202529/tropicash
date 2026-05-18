/**
 * Tropicash Developer Platform — Phase 2C:
 * Capability & Operational Constraints Registry config.
 *
 * Pure planning data layered on top of the Phase 2A Internal Service
 * Registry and the Phase 2B governance layer. Mirrors
 * supabase/sql/internal_capability_registry_phase2c.sql.
 *
 * THIS FILE IS DEFINITION-ONLY. It does NOT:
 *   • create real public APIs or internal money-moving APIs
 *   • create API keys, service tokens, or secrets
 *   • create enforcement code paths
 *   • modify treasury, wallet, withdrawal, PayPal funding, or fraud logic
 *
 * The canonical narrative lives in docs/internal-service-blueprint.md
 * (Phase 2C section). When the exports below change materially, update
 * that doc and the SQL migration in the same PR.
 */

export const INTERNAL_CAPABILITY_PHASE = "phase_2c_capabilities";

/**
 * Capability categories. Mirrors the category check constraint on
 * internal_capabilities.
 */
export const INTERNAL_CAPABILITY_CATEGORIES = [
  {
    key: "wallet",
    label: "Wallet",
    description:
      "Reads and reservations against the wallet ledger. The wallet ledger remains the source of truth — capabilities never bypass it.",
    accent: "#2563eb",
    icon: "💰",
  },
  {
    key: "payments",
    label: "Payments",
    description:
      "Inbound payment intents (create, capture, refund). Money-moving — every capability requires idempotency and fraud review.",
    accent: "#0ea5e9",
    icon: "💳",
  },
  {
    key: "payouts",
    label: "Payouts",
    description:
      "Outbound payout flows (request, approve, release). Highest-risk movement direction.",
    accent: "#f97316",
    icon: "🏦",
  },
  {
    key: "treasury",
    label: "Treasury",
    description:
      "Treasury liquidity reads and reservations. Treasury systems remain isolated from wallet ledger writes.",
    accent: "#7c3aed",
    icon: "🏛️",
  },
  {
    key: "ledger",
    label: "Ledger",
    description:
      "Read-only ledger exports and statement generation. Capabilities here never modify the ledger.",
    accent: "#0f766e",
    icon: "📒",
  },
  {
    key: "reporting",
    label: "Reporting",
    description:
      "Aggregated, derived reporting feeds. Reserved for the Sentinel workstream and admin dashboards.",
    accent: "#0284c7",
    icon: "📊",
  },
  {
    key: "trading",
    label: "Trading",
    description:
      "Trading-side capital movement. Reserved for the Triton workstream. All capabilities are sandbox-only by default.",
    accent: "#dc2626",
    icon: "📈",
  },
  {
    key: "developer",
    label: "Developer",
    description:
      "Capabilities consumed by external developer apps (webhooks, scoped reads). Always pass through the public auth/rate-limit layer.",
    accent: "#8b5cf6",
    icon: "🧑‍💻",
  },
  {
    key: "admin",
    label: "Admin",
    description:
      "Admin-only operational capabilities. Always gated by the admin helper (tc_is_admin).",
    accent: "#475569",
    icon: "🛠️",
  },
  {
    key: "fraud",
    label: "Fraud",
    description:
      "Fraud-engine dependency markers. Money-moving capabilities must declare a `requires` dependency on fraud.review_required.",
    accent: "#be123c",
    icon: "🚨",
  },
  {
    key: "notifications",
    label: "Notifications",
    description:
      "In-app, email, or push messages. Non-monetary. Must never carry secrets in payloads.",
    accent: "#16a34a",
    icon: "🔔",
  },
];

/**
 * Capability risk levels. Identical scale to Phase 2A permission risks so
 * permissions and capabilities can be compared side-by-side.
 */
export const INTERNAL_CAPABILITY_RISK_LEVELS = [
  {
    key: "low",
    label: "Low",
    description:
      "Read-only or non-monetary scope. Default risk classification.",
    dotClass: "bg-slate-400",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
    order: 1,
  },
  {
    key: "medium",
    label: "Medium",
    description:
      "Sensitive read or low-magnitude write. Requires audit logging.",
    dotClass: "bg-amber-500",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
    order: 2,
  },
  {
    key: "high",
    label: "High",
    description:
      "Money-moving or balance-affecting. Requires idempotency, audit, and fraud review.",
    dotClass: "bg-orange-500",
    badgeClass: "border border-orange-200 bg-orange-50 text-orange-900",
    order: 3,
  },
  {
    key: "critical",
    label: "Critical",
    description:
      "Highest-risk monetary scope. Requires explicit per-call approval and elevated audit.",
    dotClass: "bg-red-500",
    badgeClass: "border border-red-200 bg-red-50 text-red-900",
    order: 4,
  },
];

/**
 * Lifecycle statuses for a capability definition. Mirrors the
 * lifecycle_status check constraint on internal_capabilities.
 *
 *   planning → defined → review → sandbox_ready → live_ready
 *                                                    │
 *                                                    ▼
 *                                          deprecated → retired
 */
export const INTERNAL_CAPABILITY_LIFECYCLE_STATUSES = [
  {
    key: "planning",
    label: "Planning",
    description: "Idea captured. Shape not yet finalized.",
    dotClass: "bg-sky-500",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
    order: 1,
  },
  {
    key: "defined",
    label: "Defined",
    description:
      "Capability shape is finalized in the registry. Phase 2C seed default.",
    dotClass: "bg-indigo-500",
    badgeClass: "border border-indigo-200 bg-indigo-50 text-indigo-800",
    order: 2,
  },
  {
    key: "review",
    label: "Review",
    description: "Awaiting review for sandbox readiness promotion.",
    dotClass: "bg-amber-500",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
    order: 3,
  },
  {
    key: "sandbox_ready",
    label: "Sandbox ready",
    description:
      "Capability can be exercised in sandbox under a real enforcement path.",
    dotClass: "bg-emerald-500",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
    order: 4,
  },
  {
    key: "live_ready",
    label: "Live ready",
    description:
      "Capability is approved for production execution. Requires all gates passed.",
    dotClass: "bg-blue-500",
    badgeClass: "border border-blue-200 bg-blue-50 text-blue-800",
    order: 5,
  },
  {
    key: "deprecated",
    label: "Deprecated",
    description:
      "Discouraged. New integrations must not depend on this capability.",
    dotClass: "bg-slate-400",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
    order: 6,
  },
  {
    key: "retired",
    label: "Retired",
    description: "End-of-life. Kept for historical audit only.",
    dotClass: "bg-slate-500",
    badgeClass: "border border-slate-300 bg-slate-100 text-slate-700",
    order: 7,
  },
];

/**
 * Capability dependency types. Mirrors the dependency_type check constraint
 * on internal_capability_dependencies.
 */
export const INTERNAL_DEPENDENCY_TYPES = [
  {
    key: "requires",
    label: "Requires",
    description:
      "Hard prerequisite. Caller must hold the dependency capability to invoke this one.",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-900",
    accent: "#e11d48",
  },
  {
    key: "recommends",
    label: "Recommends",
    description:
      "Soft suggestion. Strongly encouraged but not enforced.",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
    accent: "#0ea5e9",
  },
  {
    key: "blocks_without",
    label: "Blocks without",
    description:
      "Invocation is blocked if the dependency capability has not been exercised first.",
    badgeClass: "border border-orange-200 bg-orange-50 text-orange-900",
    accent: "#f97316",
  },
  {
    key: "audit_requires",
    label: "Audit requires",
    description:
      "Dependency must be invoked downstream for audit completeness (e.g. ledger export).",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
    accent: "#f59e0b",
  },
];

/**
 * Constraint enforcement statuses. Mirrors the enforcement_status check
 * constraint on internal_capability_constraints. Phase 2C seeds everything
 * as `planned` — no enforcement code path exists yet.
 */
export const INTERNAL_CONSTRAINT_ENFORCEMENT_STATUSES = [
  {
    key: "planned",
    label: "Planned",
    description: "Documented intent. Not yet evaluated at runtime.",
    dotClass: "bg-sky-500",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    key: "monitor_only",
    label: "Monitor only",
    description:
      "Evaluated and logged, but violations do not block calls. Used for shadow rollout.",
    dotClass: "bg-amber-500",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    key: "enforced",
    label: "Enforced",
    description:
      "Violations block the call. Requires a real enforcement path.",
    dotClass: "bg-emerald-500",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    key: "disabled",
    label: "Disabled",
    description:
      "Constraint deliberately turned off. Retained for audit history.",
    dotClass: "bg-slate-400",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
];

/**
 * Seeded capabilities. Mirrors the seed block in
 * supabase/sql/internal_capability_registry_phase2c.sql.
 *
 * All seeds default to:
 *   - lifecycleStatus: "defined"
 *   - supportsSandbox: true
 *   - supportsLive: false (live readiness requires Phase 2B governance promotion)
 */
export const INTERNAL_CAPABILITY_SEEDS = [
  // Wallet
  {
    capabilityKey: "wallet.read",
    capabilityLabel: "Read wallet state",
    category: "wallet",
    description:
      "Read-only access to wallet balance and metadata.",
    riskLevel: "low",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },
  {
    capabilityKey: "wallet.reserve",
    capabilityLabel: "Reserve wallet funds",
    category: "wallet",
    description:
      "Place a hold on a portion of available wallet balance.",
    riskLevel: "high",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },
  {
    capabilityKey: "wallet.release",
    capabilityLabel: "Release wallet reserve",
    category: "wallet",
    description:
      "Release a previously placed hold back to available balance.",
    riskLevel: "medium",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },
  {
    capabilityKey: "wallet.balance_adjust",
    capabilityLabel: "Adjust wallet balance",
    category: "wallet",
    description:
      "Direct ledger-level balance mutation. Highest-risk wallet capability.",
    riskLevel: "critical",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },

  // Payments
  {
    capabilityKey: "payment.create",
    capabilityLabel: "Create payment",
    category: "payments",
    description:
      "Initiate an inbound payment intent against a wallet.",
    riskLevel: "medium",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },
  {
    capabilityKey: "payment.capture",
    capabilityLabel: "Capture payment",
    category: "payments",
    description: "Settle an authorized payment intent.",
    riskLevel: "high",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },
  {
    capabilityKey: "payment.refund",
    capabilityLabel: "Refund payment",
    category: "payments",
    description:
      "Reverse a captured payment, returning funds to the payer.",
    riskLevel: "high",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },

  // Payouts
  {
    capabilityKey: "payout.request",
    capabilityLabel: "Request payout",
    category: "payouts",
    description: "Submit an outbound payout request for review.",
    riskLevel: "medium",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },
  {
    capabilityKey: "payout.approve",
    capabilityLabel: "Approve payout",
    category: "payouts",
    description: "Approve a pending payout request.",
    riskLevel: "high",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },
  {
    capabilityKey: "payout.release",
    capabilityLabel: "Release payout",
    category: "payouts",
    description:
      "Disburse an approved payout to the destination. Highest-risk payouts capability.",
    riskLevel: "critical",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },

  // Treasury
  {
    capabilityKey: "treasury.read_summary",
    capabilityLabel: "Read treasury summary",
    category: "treasury",
    description:
      "Read-only aggregate treasury liquidity summary.",
    riskLevel: "medium",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },
  {
    capabilityKey: "treasury.reserve_funds",
    capabilityLabel: "Reserve treasury funds",
    category: "treasury",
    description:
      "Reserve a tranche of treasury funds for a planned movement.",
    riskLevel: "high",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },

  // Ledger
  {
    capabilityKey: "ledger.export",
    capabilityLabel: "Export ledger records",
    category: "ledger",
    description:
      "Bulk export of wallet ledger entries for accounting/reporting. Read-only; never modifies the ledger.",
    riskLevel: "medium",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },
  {
    capabilityKey: "ledger.statement_generate",
    capabilityLabel: "Generate ledger statement",
    category: "ledger",
    description:
      "Produce a periodic statement for a wallet or treasury account.",
    riskLevel: "low",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },

  // Trading
  {
    capabilityKey: "trading.funding_reserve",
    capabilityLabel: "Reserve trading funding",
    category: "trading",
    description:
      "Reserve a portion of wallet balance for trading capital.",
    riskLevel: "high",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },
  {
    capabilityKey: "trading.profit_withdraw",
    capabilityLabel: "Withdraw trading profit",
    category: "trading",
    description:
      "Move trading profits from a trading platform back into Tropicash wallets.",
    riskLevel: "critical",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },

  // Fraud
  {
    capabilityKey: "fraud.review_required",
    capabilityLabel: "Fraud review required",
    category: "fraud",
    description:
      "Capability dependency marker: caller must pass through the fraud engine decision path.",
    riskLevel: "high",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },

  // Developer
  {
    capabilityKey: "developer.webhook_manage",
    capabilityLabel: "Manage developer webhooks",
    category: "developer",
    description:
      "Register and manage developer-configured webhook endpoints.",
    riskLevel: "medium",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },

  // Notifications
  {
    capabilityKey: "notification.send",
    capabilityLabel: "Send notification",
    category: "notifications",
    description:
      "Send an in-app, email, or push notification.",
    riskLevel: "low",
    lifecycleStatus: "defined",
    supportsSandbox: true,
    supportsLive: false,
  },
];

/**
 * Seeded dependencies. Mirrors the seed block in
 * supabase/sql/internal_capability_registry_phase2c.sql.
 *
 * `capabilityKey` is the dependent. `dependencyKey` is what it relies on.
 * `(capabilityKey, dependencyKey, dependencyType)` is unique.
 */
export const INTERNAL_DEPENDENCY_SEEDS = [
  // payment.create
  {
    capabilityKey: "payment.create",
    dependencyKey: "wallet.read",
    dependencyType: "requires",
    description:
      "Payment creation must read wallet state to validate the target.",
  },
  {
    capabilityKey: "payment.create",
    dependencyKey: "fraud.review_required",
    dependencyType: "requires",
    description:
      "Payment creation must pass through the fraud engine decision path.",
  },

  // payment.capture
  {
    capabilityKey: "payment.capture",
    dependencyKey: "payment.create",
    dependencyType: "requires",
    description:
      "A payment intent must exist before it can be captured.",
  },

  // payment.refund
  {
    capabilityKey: "payment.refund",
    dependencyKey: "payment.capture",
    dependencyType: "requires",
    description:
      "A captured payment is required before issuing a refund.",
  },
  {
    capabilityKey: "payment.refund",
    dependencyKey: "ledger.export",
    dependencyType: "audit_requires",
    description:
      "Refunds must be reconcilable via ledger export for audit completeness.",
  },

  // payout.release
  {
    capabilityKey: "payout.release",
    dependencyKey: "payout.approve",
    dependencyType: "requires",
    description:
      "A payout must be approved before it can be released.",
  },
  {
    capabilityKey: "payout.release",
    dependencyKey: "fraud.review_required",
    dependencyType: "requires",
    description:
      "Outbound payouts must pass through the fraud engine decision path.",
  },
  {
    capabilityKey: "payout.release",
    dependencyKey: "treasury.reserve_funds",
    dependencyType: "blocks_without",
    description:
      "Releasing a payout without a corresponding treasury reservation is blocked.",
  },

  // trading.profit_withdraw
  {
    capabilityKey: "trading.profit_withdraw",
    dependencyKey: "wallet.read",
    dependencyType: "requires",
    description:
      "Profit withdrawal must read wallet state to validate the destination.",
  },
  {
    capabilityKey: "trading.profit_withdraw",
    dependencyKey: "fraud.review_required",
    dependencyType: "requires",
    description:
      "Trading profit withdrawal must pass through the fraud engine decision path.",
  },
  {
    capabilityKey: "trading.profit_withdraw",
    dependencyKey: "ledger.export",
    dependencyType: "audit_requires",
    description:
      "Trading profit movements must be reconcilable via ledger export.",
  },
];

/**
 * Seeded operational constraints. Mirrors the seed block in
 * supabase/sql/internal_capability_registry_phase2c.sql.
 *
 * Sandbox and live rows are independent so promotion is explicit.
 * Phase 2C seeds every constraint as enforcementStatus = "planned".
 */
export const INTERNAL_CONSTRAINT_SEEDS = [
  // payment.create
  {
    capabilityKey: "payment.create",
    constraintKey: "max_transaction_amount",
    constraintLabel: "Max transaction amount",
    constraintValue: { amount: 1000, currency: "USD" },
    environment: "sandbox",
    riskLevel: "critical",
    enforcementStatus: "planned",
    description: "Hard cap on a single payment in sandbox.",
  },
  {
    capabilityKey: "payment.create",
    constraintKey: "max_transaction_amount",
    constraintLabel: "Max transaction amount",
    constraintValue: { amount: 0, currency: "USD", note: "Not approved" },
    environment: "live",
    riskLevel: "critical",
    enforcementStatus: "planned",
    description: "Live cap is zero until limits are approved.",
  },
  {
    capabilityKey: "payment.create",
    constraintKey: "requires_idempotency",
    constraintLabel: "Requires idempotency",
    constraintValue: { required: true },
    environment: "sandbox",
    riskLevel: "high",
    enforcementStatus: "planned",
    description: "Sandbox calls must carry an idempotency key.",
  },
  {
    capabilityKey: "payment.create",
    constraintKey: "requires_idempotency",
    constraintLabel: "Requires idempotency",
    constraintValue: { required: true },
    environment: "live",
    riskLevel: "high",
    enforcementStatus: "planned",
    description: "Live calls must carry an idempotency key.",
  },

  // payout.release
  {
    capabilityKey: "payout.release",
    constraintKey: "requires_manual_review",
    constraintLabel: "Requires manual review",
    constraintValue: { required: true },
    environment: "sandbox",
    riskLevel: "high",
    enforcementStatus: "planned",
    description: "Sandbox payouts must pass manual review (drill).",
  },
  {
    capabilityKey: "payout.release",
    constraintKey: "requires_manual_review",
    constraintLabel: "Requires manual review",
    constraintValue: { required: true },
    environment: "live",
    riskLevel: "high",
    enforcementStatus: "planned",
    description: "Live payouts must pass manual review before release.",
  },
  {
    capabilityKey: "payout.release",
    constraintKey: "requires_treasury_approval",
    constraintLabel: "Requires treasury approval",
    constraintValue: { required: true },
    environment: "sandbox",
    riskLevel: "critical",
    enforcementStatus: "planned",
    description:
      "Sandbox payouts must obtain treasury approval (drill).",
  },
  {
    capabilityKey: "payout.release",
    constraintKey: "requires_treasury_approval",
    constraintLabel: "Requires treasury approval",
    constraintValue: { required: true },
    environment: "live",
    riskLevel: "critical",
    enforcementStatus: "planned",
    description:
      "Live payouts must obtain treasury approval before release.",
  },

  // trading.profit_withdraw
  {
    capabilityKey: "trading.profit_withdraw",
    constraintKey: "sandbox_only",
    constraintLabel: "Sandbox only",
    constraintValue: { enabled: true },
    environment: "sandbox",
    riskLevel: "critical",
    enforcementStatus: "planned",
    description: "Capability is permitted in sandbox.",
  },
  {
    capabilityKey: "trading.profit_withdraw",
    constraintKey: "sandbox_only",
    constraintLabel: "Sandbox only",
    constraintValue: { enabled: true, blocks_in_live: true },
    environment: "live",
    riskLevel: "critical",
    enforcementStatus: "planned",
    description:
      "Capability is restricted to sandbox; live invocations must be blocked.",
  },
];

/**
 * Non-negotiable safety rules. These narrow the existing Phase 1.75
 * INTERNAL_SAFETY_RULES (in lib/internalPlatformConfig.js) into rules that
 * apply to capability definitions and their seeded constraints.
 */
export const INTERNAL_CAPABILITY_SAFETY_RULES = [
  "Capabilities are definitions, not endpoints. A defined capability has no runtime behavior until an enforcement path is shipped.",
  "Every money-moving capability must declare a `requires` dependency on fraud.review_required.",
  "Every refund and trading-profit movement must declare an `audit_requires` dependency on ledger.export.",
  "supports_live=false is the default. Promotion to supports_live=true must follow Phase 2B governance (review + gates).",
  "Sandbox and live constraints are independent rows. Promoting sandbox does not promote live.",
  "Constraints seeded as enforcement_status=`planned` cannot block calls until promoted via review.",
  "Critical capabilities (payout.release, trading.profit_withdraw, wallet.balance_adjust) require explicit per-call approval and elevated audit before live promotion.",
  "No capability row may store secrets, tokens, customer PII, or wallet balances in description or constraint_value.",
  "Capabilities never bypass the wallet ledger — the ledger remains source of truth even for high-risk movement.",
  "Internal capabilities are not exposed to external developers. Public APIs reference them only through the scoped permission layer.",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Look up a capability seed by its capability_key. Returns null if not found.
 */
export function getCapabilityByKey(capabilityKey) {
  if (!capabilityKey) return null;
  return (
    INTERNAL_CAPABILITY_SEEDS.find(
      (cap) => cap.capabilityKey === capabilityKey,
    ) ?? null
  );
}

/**
 * Return all seeded dependencies for a given capability_key (the dependent
 * side). Order: as declared in INTERNAL_DEPENDENCY_SEEDS.
 */
export function getCapabilityDependencies(capabilityKey) {
  if (!capabilityKey) return [];
  return INTERNAL_DEPENDENCY_SEEDS.filter(
    (dep) => dep.capabilityKey === capabilityKey,
  );
}

/**
 * Return all seeded constraints for a given capability_key. Optional
 * `environment` filter restricts to one of ('sandbox' | 'live').
 */
export function getCapabilityConstraints(capabilityKey, environment = null) {
  if (!capabilityKey) return [];
  return INTERNAL_CONSTRAINT_SEEDS.filter((c) => {
    if (c.capabilityKey !== capabilityKey) return false;
    if (environment && c.environment !== environment) return false;
    return true;
  });
}

/**
 * Convenience lookups that fall back to the most conservative entry when an
 * unknown key is supplied.
 */
export function getCapabilityCategory(key) {
  return (
    INTERNAL_CAPABILITY_CATEGORIES.find((c) => c.key === key) ?? null
  );
}

export function getCapabilityRiskLevel(key) {
  return (
    INTERNAL_CAPABILITY_RISK_LEVELS.find((r) => r.key === key) ??
    INTERNAL_CAPABILITY_RISK_LEVELS[0]
  );
}

export function getCapabilityLifecycleStatus(key) {
  return (
    INTERNAL_CAPABILITY_LIFECYCLE_STATUSES.find((l) => l.key === key) ??
    INTERNAL_CAPABILITY_LIFECYCLE_STATUSES[0]
  );
}

export function getDependencyType(key) {
  return (
    INTERNAL_DEPENDENCY_TYPES.find((d) => d.key === key) ??
    INTERNAL_DEPENDENCY_TYPES[0]
  );
}

export function getConstraintEnforcementStatus(key) {
  return (
    INTERNAL_CONSTRAINT_ENFORCEMENT_STATUSES.find((s) => s.key === key) ??
    INTERNAL_CONSTRAINT_ENFORCEMENT_STATUSES[0]
  );
}
