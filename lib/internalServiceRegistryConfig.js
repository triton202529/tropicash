/**
 * Tropicash Developer Platform — Phase 2A:
 * Internal Service Registry & Integration Identity config.
 *
 * Pure planning data for the Blue Atlantic platform service registry
 * (Triton, Sentinel, EliteHire Pro). Mirrors
 * supabase/sql/internal_service_registry_phase2a.sql.
 *
 * THIS FILE IS REGISTRY-ONLY. It does NOT:
 *   • create real public APIs
 *   • create real internal money-moving APIs
 *   • create API keys, service tokens, or secrets
 *   • modify treasury, wallet, withdrawal, PayPal funding, or fraud logic
 *
 * The canonical narrative lives in docs/internal-service-blueprint.md
 * (Phase 2A section). When the exports below change materially, update
 * that doc and the SQL migration in the same PR.
 */

export const INTERNAL_SERVICE_REGISTRY_PHASE = "phase_2a_registry";

/**
 * Lifecycle statuses for an internal service integration. Phase 2A seeds
 * every integration as `planning`. Promotion to `active` requires explicit
 * approval and a working auth model (Phase 2B+).
 */
export const INTERNAL_SERVICE_STATUSES = [
  {
    key: "planning",
    label: "Planning",
    description: "Registered in the blueprint. No real calls permitted.",
    dotClass: "bg-sky-500",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    key: "inactive",
    label: "Inactive",
    description:
      "Provisioned but disabled. Cannot be invoked until reactivated.",
    dotClass: "bg-slate-400",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    key: "active",
    label: "Active",
    description:
      "Authorized to make scoped internal calls (subject to audit + rate limits).",
    dotClass: "bg-emerald-500",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    key: "suspended",
    label: "Suspended",
    description: "Temporarily blocked. Investigation in progress.",
    dotClass: "bg-amber-500",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    key: "retired",
    label: "Retired",
    description: "End-of-life. Kept for historical audit only.",
    dotClass: "bg-slate-500",
    badgeClass: "border border-slate-300 bg-slate-100 text-slate-700",
  },
];

/**
 * Environments for an internal service integration. Sandbox and live are
 * strictly isolated; no cross-environment usage.
 */
export const INTERNAL_SERVICE_ENVIRONMENTS = [
  {
    key: "sandbox",
    label: "Sandbox",
    description: "Isolated environment. Never moves real money.",
    dotClass: "bg-sky-500",
    badgeClass: "border border-sky-200 bg-sky-50 text-sky-800",
  },
  {
    key: "live",
    label: "Live",
    description:
      "Production. Requires admin / platform approval before access is granted.",
    dotClass: "bg-emerald-500",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
];

/**
 * Permission risk levels. High and critical permissions require explicit
 * approval (and additional audit) before an integration can use them.
 */
export const INTERNAL_PERMISSION_RISK_LEVELS = [
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
 * Audit log status options. Mirrors the check constraint on
 * internal_service_audit_logs.status.
 */
export const INTERNAL_AUDIT_STATUS_OPTIONS = [
  {
    key: "recorded",
    label: "Recorded",
    description: "Event captured; no decision asserted.",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
  {
    key: "allowed",
    label: "Allowed",
    description: "Call was permitted by the future auth/permission layer.",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    key: "blocked",
    label: "Blocked",
    description: "Call was rejected by the future auth/permission layer.",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-900",
  },
  {
    key: "failed",
    label: "Failed",
    description: "Call reached the integration but failed during execution.",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
  },
];

/**
 * Seeded internal service integrations. Mirrors the seed block in
 * supabase/sql/internal_service_registry_phase2a.sql.
 *
 * `serviceKey` is the stable, lowercase identifier. `platform` matches the
 * Blue Atlantic platform name surfaced in the UI.
 */
export const BLUE_ATLANTIC_SERVICE_SEEDS = [
  {
    serviceKey: "triton",
    serviceName: "Triton funding & withdrawal bridge",
    platform: "Triton",
    environment: "sandbox",
    status: "planning",
    description:
      "Internal connector to Triton for funding trading accounts, withdrawing profits, reserving trading capital, and syncing trade funding records back to Tropicash wallets.",
    ownerLabel: "Blue Atlantic · Triton workstream",
    accent: "#2563eb",
    icon: "🔱",
  },
  {
    serviceKey: "sentinel",
    serviceName: "Sentinel reporting",
    platform: "Sentinel",
    environment: "sandbox",
    status: "planning",
    description:
      "One-way reporting feed into Sentinel: transaction events, ledger exports, treasury reporting, statements, and reconciliation feeds. Sentinel never writes back to Tropicash wallets.",
    ownerLabel: "Blue Atlantic · Sentinel workstream",
    accent: "#0ea5e9",
    icon: "🛡️",
  },
  {
    serviceKey: "elitehire_pro",
    serviceName: "EliteHire Pro payments connector",
    platform: "EliteHire Pro",
    environment: "sandbox",
    status: "planning",
    description:
      "Internal connector for EliteHire Pro employer payments, job posting payments, contractor payouts, future escrow flows, and subscriptions.",
    ownerLabel: "Blue Atlantic · EliteHire Pro workstream",
    accent: "#8b5cf6",
    icon: "💼",
  },
];

/**
 * Seeded per-service permissions. Mirrors the seed block in
 * supabase/sql/internal_service_registry_phase2a.sql. Each entry is keyed by
 * the parent integration's `serviceKey`.
 */
export const INTERNAL_PERMISSION_SEEDS = {
  triton: [
    {
      permissionKey: "wallet.read",
      permissionLabel: "Read wallet state",
      description:
        "Read-only access to wallet balance and metadata required for Triton funding decisions.",
      riskLevel: "low",
    },
    {
      permissionKey: "trading_funding.reserve",
      permissionLabel: "Reserve trading capital",
      description:
        "Reserve a portion of a wallet balance for Triton trading capital. Must respect wallet ledger as source of truth.",
      riskLevel: "high",
    },
    {
      permissionKey: "trading_funding.release",
      permissionLabel: "Release trading capital",
      description:
        "Release previously reserved trading capital back to wallet available balance.",
      riskLevel: "medium",
    },
    {
      permissionKey: "trading_profit.withdraw",
      permissionLabel: "Withdraw trading profits",
      description:
        "Move trading profits from Triton back into Tropicash wallets. Money-moving; requires idempotency, audit, and fraud review.",
      riskLevel: "critical",
    },
    {
      permissionKey: "treasury.read_summary",
      permissionLabel: "Read treasury summary",
      description:
        "Read-only access to aggregated treasury liquidity summary required for funding decisions.",
      riskLevel: "medium",
    },
  ],
  sentinel: [
    {
      permissionKey: "ledger.export",
      permissionLabel: "Export ledger records",
      description:
        "Bulk export of wallet ledger entries for accounting/reporting. Read-only; never modifies ledger.",
      riskLevel: "medium",
    },
    {
      permissionKey: "transaction.read",
      permissionLabel: "Read transaction records",
      description: "Read-only access to transaction records for reporting.",
      riskLevel: "low",
    },
    {
      permissionKey: "treasury.read_summary",
      permissionLabel: "Read treasury summary",
      description:
        "Read-only access to aggregated treasury summary for reconciliation reporting.",
      riskLevel: "medium",
    },
    {
      permissionKey: "statement.generate",
      permissionLabel: "Generate statements",
      description: "Generate periodic statements for accounting/audit consumption.",
      riskLevel: "low",
    },
    {
      permissionKey: "reconciliation.read",
      permissionLabel: "Read reconciliation feeds",
      description: "Consume Tropicash reconciliation feeds for accounting.",
      riskLevel: "low",
    },
  ],
  elitehire_pro: [
    {
      permissionKey: "payment.create",
      permissionLabel: "Create payment",
      description:
        "Initiate inbound payment intents that settle into Tropicash wallets. Money-moving; requires idempotency and fraud review.",
      riskLevel: "medium",
    },
    {
      permissionKey: "payment.read",
      permissionLabel: "Read payment records",
      description:
        "Read-only access to payment records for EliteHire Pro reconciliation.",
      riskLevel: "low",
    },
    {
      permissionKey: "payout.create",
      permissionLabel: "Create payout",
      description:
        "Initiate contractor payouts from EliteHire Pro flows. Money-moving; requires idempotency, audit, and fraud review.",
      riskLevel: "high",
    },
    {
      permissionKey: "subscription.create",
      permissionLabel: "Create subscription",
      description:
        "Initiate subscription billing intents (recurring). Money-moving; requires idempotency.",
      riskLevel: "medium",
    },
    {
      permissionKey: "escrow.plan",
      permissionLabel: "Plan escrow",
      description:
        "Plan future escrow arrangements (no execution yet). Reserved for future Phase.",
      riskLevel: "medium",
    },
  ],
};

/**
 * Convenience helpers for the UI. Look up status / environment / risk
 * descriptors safely; falls back to the most conservative defaults if an
 * unknown key is supplied.
 */
export function getServiceStatus(statusKey) {
  return (
    INTERNAL_SERVICE_STATUSES.find((s) => s.key === statusKey) ??
    INTERNAL_SERVICE_STATUSES[0]
  );
}

export function getServiceEnvironment(envKey) {
  return (
    INTERNAL_SERVICE_ENVIRONMENTS.find((e) => e.key === envKey) ??
    INTERNAL_SERVICE_ENVIRONMENTS[0]
  );
}

export function getRiskLevel(riskKey) {
  return (
    INTERNAL_PERMISSION_RISK_LEVELS.find((r) => r.key === riskKey) ??
    INTERNAL_PERMISSION_RISK_LEVELS[0]
  );
}
