/**
 * Tropicash Developer Platform — Phase 2B:
 * Integration Lifecycle & Runtime Governance config.
 *
 * Pure planning data layered on top of the Phase 2A Internal Service
 * Registry. Mirrors supabase/sql/internal_service_governance_phase2b.sql.
 *
 * THIS FILE IS GOVERNANCE-ONLY. It does NOT:
 *   • create real public APIs or internal money-moving APIs
 *   • create API keys, service tokens, or secrets
 *   • modify treasury, wallet, withdrawal, PayPal funding, or fraud logic
 *
 * The canonical narrative lives in docs/internal-service-blueprint.md
 * (Phase 2B section). When the exports below change materially, update
 * that doc and the SQL migration in the same PR.
 */

export const INTERNAL_GOVERNANCE_PHASE = "phase_2b_governance";

/**
 * Lifecycle review verdicts. Mirrors the review_status check constraint on
 * internal_service_lifecycle_reviews.
 */
export const LIFECYCLE_REVIEW_STATUSES = [
  {
    key: "pending",
    label: "Pending",
    description: "Awaiting reviewer decision.",
    dotClass: "bg-amber-500",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    key: "approved",
    label: "Approved",
    description: "Reviewer approved the requested lifecycle transition.",
    dotClass: "bg-emerald-500",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    key: "rejected",
    label: "Rejected",
    description: "Reviewer rejected the requested transition.",
    dotClass: "bg-rose-500",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-900",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    description: "Submitter cancelled the request before a decision.",
    dotClass: "bg-slate-400",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
];

/**
 * Runtime policy enforcement statuses. Mirrors the enforcement_status check
 * constraint on internal_service_runtime_policies. Phase 2B seeds everything
 * as `planned` — no runtime enforcement code path exists yet.
 */
export const RUNTIME_POLICY_ENFORCEMENT_STATUSES = [
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
    description: "Violations block the call. Requires a real enforcement path.",
    dotClass: "bg-emerald-500",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    key: "disabled",
    label: "Disabled",
    description: "Policy deliberately turned off. Retained for audit history.",
    dotClass: "bg-slate-400",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
];

/**
 * Environment gate statuses. Mirrors the gate_status check constraint on
 * internal_service_environment_gates.
 */
export const ENVIRONMENT_GATE_STATUSES = [
  {
    key: "blocked",
    label: "Blocked",
    description: "Gate is not yet passed. Default for live gates.",
    dotClass: "bg-rose-500",
    badgeClass: "border border-rose-200 bg-rose-50 text-rose-900",
  },
  {
    key: "pending_review",
    label: "Pending review",
    description: "Submitted for review; awaiting reviewer.",
    dotClass: "bg-amber-500",
    badgeClass: "border border-amber-200 bg-amber-50 text-amber-900",
  },
  {
    key: "passed",
    label: "Passed",
    description: "Gate is satisfied.",
    dotClass: "bg-emerald-500",
    badgeClass: "border border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  {
    key: "waived",
    label: "Waived",
    description: "Gate intentionally bypassed with reviewer sign-off.",
    dotClass: "bg-slate-400",
    badgeClass: "border border-slate-200 bg-slate-50 text-slate-700",
  },
];

/**
 * Canonical lifecycle path an integration travels.
 *
 *   planning → review → sandbox_active → live_pending → live_active
 *                                                          │
 *                              ┌───────────────────────────┘
 *                              ▼
 *                          suspended → retired
 *
 * The first five steps are the forward path. The last two are terminal /
 * recovery states reachable from `live_active` (and conceptually from
 * `sandbox_active` for `suspended`).
 */
export const GOVERNANCE_LIFECYCLE_PATH = [
  {
    key: "planning",
    label: "Planning",
    description:
      "Registry row exists. No runtime calls permitted. (Phase 2A default.)",
    accent: "#0ea5e9",
  },
  {
    key: "review",
    label: "Review",
    description:
      "A lifecycle review is open in internal_service_lifecycle_reviews.",
    accent: "#f59e0b",
  },
  {
    key: "sandbox_active",
    label: "Sandbox active",
    description:
      "Integration may exercise sandbox-only permissions. No live calls.",
    accent: "#10b981",
  },
  {
    key: "live_pending",
    label: "Live pending",
    description:
      "Live promotion requested. All required_for_live gates must be passed or waived.",
    accent: "#f97316",
  },
  {
    key: "live_active",
    label: "Live active",
    description:
      "Integration is approved for production calls under runtime policies.",
    accent: "#2563eb",
  },
  {
    key: "suspended",
    label: "Suspended",
    description:
      "Temporarily blocked. Investigation in progress; reversible.",
    accent: "#f59e0b",
    terminal: false,
  },
  {
    key: "retired",
    label: "Retired",
    description: "End-of-life. Kept for historical audit only.",
    accent: "#64748b",
    terminal: true,
  },
];

/**
 * Seeded runtime policies. Keyed by parent integration's service_key.
 * Mirrors the seed block in
 * supabase/sql/internal_service_governance_phase2b.sql.
 *
 * All policies are sandbox-environment Phase 2B planning seeds.
 */
export const GOVERNANCE_POLICY_SEEDS = {
  triton: [
    {
      environment: "sandbox",
      policyKey: "max_daily_transfer_amount",
      policyLabel: "Max daily transfer amount",
      policyValue: { amount: 0, currency: "USD", note: "Not active yet" },
      riskLevel: "critical",
      enforcementStatus: "planned",
      description:
        "Cap on the total amount Triton may move on behalf of Tropicash wallets in a 24h window. Sandbox seed is 0 until live limits are approved.",
    },
    {
      environment: "sandbox",
      policyKey: "requires_idempotency",
      policyLabel: "Requires idempotency key",
      policyValue: { required: true },
      riskLevel: "high",
      enforcementStatus: "planned",
      description:
        "Every money-moving Triton call must carry an idempotency key. Duplicates must return the original result.",
    },
    {
      environment: "sandbox",
      policyKey: "fraud_checks_required",
      policyLabel: "Fraud checks required",
      policyValue: { required: true },
      riskLevel: "high",
      enforcementStatus: "planned",
      description:
        "Money-moving Triton calls must pass through the existing fraud engine decision path.",
    },
    {
      environment: "sandbox",
      policyKey: "sandbox_only",
      policyLabel: "Sandbox only",
      policyValue: { enabled: true },
      riskLevel: "medium",
      enforcementStatus: "planned",
      description:
        "Integration is restricted to sandbox until all live gates are passed.",
    },
  ],
  sentinel: [
    {
      environment: "sandbox",
      policyKey: "export_requires_audit",
      policyLabel: "Exports require audit",
      policyValue: { required: true },
      riskLevel: "medium",
      enforcementStatus: "planned",
      description:
        "Bulk ledger exports must emit an audit log row with the requester identity and export scope.",
    },
    {
      environment: "sandbox",
      policyKey: "no_money_movement",
      policyLabel: "No money movement",
      policyValue: { required: true },
      riskLevel: "high",
      enforcementStatus: "planned",
      description:
        "Sentinel is read-only against the Tropicash ledger. Any write attempt must be rejected.",
    },
    {
      environment: "sandbox",
      policyKey: "sandbox_only",
      policyLabel: "Sandbox only",
      policyValue: { enabled: true },
      riskLevel: "medium",
      enforcementStatus: "planned",
      description:
        "Sentinel integration is restricted to sandbox until all live gates are passed.",
    },
  ],
  elitehire_pro: [
    {
      environment: "sandbox",
      policyKey: "payment_requires_idempotency",
      policyLabel: "Payments require idempotency",
      policyValue: { required: true },
      riskLevel: "high",
      enforcementStatus: "planned",
      description:
        "EliteHire Pro payment creation must carry an idempotency key per request.",
    },
    {
      environment: "sandbox",
      policyKey: "payout_requires_review",
      policyLabel: "Payouts require review",
      policyValue: { required: true },
      riskLevel: "high",
      enforcementStatus: "planned",
      description:
        "Outbound contractor payouts must pass admin/platform review before execution.",
    },
    {
      environment: "sandbox",
      policyKey: "escrow_not_active",
      policyLabel: "Escrow not active",
      policyValue: { enabled: true },
      riskLevel: "medium",
      enforcementStatus: "planned",
      description:
        "Escrow flows are planned but not active. Any escrow call must be rejected until escrow ships.",
    },
    {
      environment: "sandbox",
      policyKey: "sandbox_only",
      policyLabel: "Sandbox only",
      policyValue: { enabled: true },
      riskLevel: "medium",
      enforcementStatus: "planned",
      description:
        "EliteHire Pro integration is restricted to sandbox until all live gates are passed.",
    },
  ],
};

/**
 * Seeded environment gates per service. Sandbox gates start `passed`
 * (because Phase 2A delivered registry + permissions + audit shape).
 * Live gates start `blocked` with required_for_live = true.
 */
export const GOVERNANCE_GATE_SEEDS = {
  sandbox: [
    {
      gateKey: "registry_created",
      gateLabel: "Registry created",
      gateStatus: "passed",
      requiredForLive: false,
      description:
        "Integration row exists in internal_service_integrations (Phase 2A).",
    },
    {
      gateKey: "permissions_defined",
      gateLabel: "Permissions defined",
      gateStatus: "passed",
      requiredForLive: false,
      description:
        "Planned permissions are recorded in internal_service_permissions (Phase 2A).",
    },
    {
      gateKey: "audit_model_defined",
      gateLabel: "Audit model defined",
      gateStatus: "passed",
      requiredForLive: false,
      description:
        "Audit log shape exists in internal_service_audit_logs (Phase 2A).",
    },
  ],
  live: [
    {
      gateKey: "treasury_review",
      gateLabel: "Treasury review",
      gateStatus: "blocked",
      requiredForLive: true,
      description: "Treasury workstream must sign off on live readiness.",
    },
    {
      gateKey: "fraud_review",
      gateLabel: "Fraud review",
      gateStatus: "blocked",
      requiredForLive: true,
      description:
        "Fraud engine team must confirm live decision-path coverage.",
    },
    {
      gateKey: "security_review",
      gateLabel: "Security review",
      gateStatus: "blocked",
      requiredForLive: true,
      description:
        "Security review must approve auth model, key handling, and audit coverage.",
    },
    {
      gateKey: "admin_approval",
      gateLabel: "Admin approval",
      gateStatus: "blocked",
      requiredForLive: true,
      description:
        "Final admin approval recorded in internal_service_lifecycle_reviews.",
    },
  ],
};

/**
 * Non-negotiable governance rules. These narrow the existing Phase 1.75
 * INTERNAL_SAFETY_RULES (in lib/internalPlatformConfig.js) into operational
 * checks at the integration-lifecycle level.
 */
export const GOVERNANCE_SAFETY_RULES = [
  "Approval records do not mutate the registry; the registry remains source of truth.",
  "Every lifecycle transition must produce a row in internal_service_lifecycle_reviews.",
  "Runtime policies seeded as `planned` cannot block calls until promoted to `enforced` via review.",
  "All required_for_live gates must be `passed` or `waived` (with reviewer sign-off) before live promotion.",
  "Sandbox and live runtime policies are independent rows. Promoting sandbox does not promote live.",
  "High and critical policies require human approval per enforcement-status change.",
  "No governance row may store secrets, tokens, or unnecessary PII in policy_value or description.",
  "Suspended integrations must immediately stop being invoked, even if approval records exist.",
];

/**
 * Convenience helpers. Each one falls back to the most conservative entry
 * if an unknown key is supplied.
 */
export function getLifecycleReviewStatus(key) {
  return (
    LIFECYCLE_REVIEW_STATUSES.find((s) => s.key === key) ??
    LIFECYCLE_REVIEW_STATUSES[0]
  );
}

export function getEnforcementStatus(key) {
  return (
    RUNTIME_POLICY_ENFORCEMENT_STATUSES.find((s) => s.key === key) ??
    RUNTIME_POLICY_ENFORCEMENT_STATUSES[0]
  );
}

export function getGateStatus(key) {
  return (
    ENVIRONMENT_GATE_STATUSES.find((s) => s.key === key) ??
    ENVIRONMENT_GATE_STATUSES[0]
  );
}

export function getLifecycleStep(key) {
  return GOVERNANCE_LIFECYCLE_PATH.find((s) => s.key === key) ?? null;
}
