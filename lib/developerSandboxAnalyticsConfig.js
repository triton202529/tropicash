/**
 * Tropicash Developer Platform — Phase 4E:
 * Sandbox usage simulation & developer analytics (static modeling only).
 *
 * THIS FILE IS SIMULATION-ONLY. It does NOT:
 *   • call Supabase, HTTP APIs, webhooks, workers, or network I/O
 *   • read Date.now(), Math.random(), localStorage, or sessionStorage
 *   • expose credentials, treasury execution, or live traffic metrics
 *
 * Product, contract, and capability keys align with:
 *   • lib/developerProductCatalogConfig.js (API_PRODUCTS, API_SANDBOX_CONTRACTS)
 *   • lib/internalCapabilityConfig.js (INTERNAL_CAPABILITY_SEEDS)
 */

export const DEVELOPER_SANDBOX_ANALYTICS_PHASE = "phase_4e_sandbox_analytics";

/** @typedef {"healthy"|"review_heavy"|"throttled"|"constrained"|"inactive"} SandboxUsageStatus */

/** @readonly */
export const SANDBOX_USAGE_STATUSES = ["healthy", "review_heavy", "throttled", "constrained", "inactive"];

/** @typedef {"excellent"|"good"|"watch"|"needs_review"|"blocked"} SandboxHealthGrade */

/** @readonly */
export const SANDBOX_HEALTH_GRADES = ["excellent", "good", "watch", "needs_review", "blocked"];

/** @typedef {"low"|"medium"|"high"|"exceeded"} SandboxRateLimitPressureLevel */

/** @readonly */
export const SANDBOX_RATE_LIMIT_PRESSURE_LEVELS = ["low", "medium", "high", "exceeded"];

/** @typedef {"none"|"low"|"medium"|"high"|"critical"} SandboxReviewPressureLevel */

/** @readonly */
export const SANDBOX_REVIEW_PRESSURE_LEVELS = ["none", "low", "medium", "high", "critical"];

/**
 * Safety copy for console / docs. No runtime enforcement is implied.
 * @readonly {string[]}
 */
export const SANDBOX_ANALYTICS_SAFETY_RULES = [
  "All counters, grades, and pressure labels are hand-authored seeds for UI rehearsal — they are not sampled from production or sandbox traffic.",
  "No row in this module grants quotas, lifts rate limits, or changes governance posture for a developer app.",
  "Simulated windows such as '24h-fixed' are narrative placeholders; they do not correspond to a running clock or reset job.",
  "Product and contract keys mirror the Phase 4D catalog for teaching alignment only — consuming them still requires catalog + governance clearance elsewhere.",
  "Capability utilization narratives must be reconciled with Phase 2C capability definitions; seeds may omit capabilities an app has not requested.",
  "Health grades summarize static storytelling fields, not automated risk scores from fraud, treasury, or ledger systems.",
  "Do not paste API keys, webhook secrets, or customer identifiers into analytics previews — this phase stores no secrets by design.",
];

/**
 * Simulated per-contract / per-product usage rows for sandbox rehearsal.
 *
 * @type {ReadonlyArray<{
 *   simulation_key: string,
 *   app_label: string,
 *   product_key: string,
 *   contract_key: string,
 *   capability_key: string,
 *   environment: string,
 *   simulated_call_count: number,
 *   simulated_success_count: number,
 *   simulated_review_count: number,
 *   simulated_throttle_count: number,
 *   simulated_error_count: number,
 *   usage_status: SandboxUsageStatus,
 *   review_pressure: SandboxReviewPressureLevel,
 *   rate_limit_pressure: SandboxRateLimitPressureLevel,
 *   simulated_window: string,
 *   notes: string,
 * }>}
 */
export const SANDBOX_USAGE_SIMULATION_SEEDS = [
  {
    simulation_key: "sand_use_alpha_wallet_balance",
    app_label: "Sandbox App Alpha",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    simulated_call_count: 1280,
    simulated_success_count: 1262,
    simulated_review_count: 0,
    simulated_throttle_count: 2,
    simulated_error_count: 16,
    usage_status: "healthy",
    review_pressure: "none",
    rate_limit_pressure: "low",
    simulated_window: "24h-fixed",
    notes: "Read-heavy harness; occasional validation errors from malformed handles in tests.",
  },
  {
    simulation_key: "sand_use_alpha_reserve_cycle",
    app_label: "Sandbox App Alpha",
    product_key: "prod_wallet_reserve_sim",
    contract_key: "sc_wallet_reserve_cycle",
    capability_key: "wallet.reserve",
    environment: "sandbox",
    simulated_call_count: 420,
    simulated_success_count: 401,
    simulated_review_count: 0,
    simulated_throttle_count: 6,
    simulated_error_count: 13,
    usage_status: "healthy",
    review_pressure: "low",
    rate_limit_pressure: "medium",
    simulated_window: "24h-fixed",
    notes: "Reserve simulator sees duplicate idempotency replays counted as success in this seed.",
  },
  {
    simulation_key: "sand_use_alpha_notifications",
    app_label: "Sandbox App Alpha",
    product_key: "prod_notification_dispatch",
    contract_key: "sc_notification_dispatch",
    capability_key: "notification.send",
    environment: "sandbox",
    simulated_call_count: 310,
    simulated_success_count: 305,
    simulated_review_count: 0,
    simulated_throttle_count: 0,
    simulated_error_count: 5,
    usage_status: "healthy",
    review_pressure: "none",
    rate_limit_pressure: "low",
    simulated_window: "24h-fixed",
    notes: "Template mismatch errors dominate the small error bucket.",
  },
  {
    simulation_key: "sand_use_beta_checkout",
    app_label: "Sandbox App Beta",
    product_key: "prod_checkout_session",
    contract_key: "sc_checkout_session_create",
    capability_key: "payment.create",
    environment: "sandbox",
    simulated_call_count: 890,
    simulated_success_count: 702,
    simulated_review_count: 124,
    simulated_throttle_count: 18,
    simulated_error_count: 46,
    usage_status: "review_heavy",
    review_pressure: "high",
    rate_limit_pressure: "medium",
    simulated_window: "24h-fixed",
    notes: "Review checkpoint rows inflate review_pressure for teaching operator queue narratives.",
  },
  {
    simulation_key: "sand_use_beta_capture_review",
    app_label: "Sandbox App Beta",
    product_key: "prod_payment_capture_review",
    contract_key: "sc_payment_capture_review",
    capability_key: "payment.capture",
    environment: "sandbox",
    simulated_call_count: 210,
    simulated_success_count: 88,
    simulated_review_count: 98,
    simulated_throttle_count: 4,
    simulated_error_count: 20,
    usage_status: "review_heavy",
    review_pressure: "critical",
    rate_limit_pressure: "high",
    simulated_window: "24h-fixed",
    notes: "Pairs with fraud.review_required semantics in catalog; still simulation-only here.",
  },
  {
    simulation_key: "sand_use_beta_webhook_catalog",
    app_label: "Sandbox App Beta",
    product_key: "prod_partner_webhook_catalog",
    contract_key: "sc_webhook_topic_list",
    capability_key: "developer.webhook_manage",
    environment: "sandbox",
    simulated_call_count: 95,
    simulated_success_count: 94,
    simulated_review_count: 0,
    simulated_throttle_count: 0,
    simulated_error_count: 1,
    usage_status: "review_heavy",
    review_pressure: "medium",
    rate_limit_pressure: "low",
    simulated_window: "24h-fixed",
    notes: "Low volume; carried under same app to show mixed posture across products.",
  },
  {
    simulation_key: "sand_use_gamma_statement_export",
    app_label: "Sandbox App Gamma",
    product_key: "prod_statement_export_bundle",
    contract_key: "sc_statement_export_job",
    capability_key: "ledger.export",
    environment: "sandbox",
    simulated_call_count: 64,
    simulated_success_count: 52,
    simulated_review_count: 8,
    simulated_throttle_count: 22,
    simulated_error_count: 4,
    usage_status: "throttled",
    review_pressure: "medium",
    rate_limit_pressure: "high",
    simulated_window: "24h-fixed",
    notes: "Internal tier narrative — throttle_count elevated for storyboard.",
  },
  {
    simulation_key: "sand_use_gamma_trace",
    app_label: "Sandbox App Gamma",
    product_key: "prod_execution_trace_preview",
    contract_key: "sc_trace_bundle_fetch",
    capability_key: "ledger.export",
    environment: "sandbox",
    simulated_call_count: 180,
    simulated_success_count: 171,
    simulated_review_count: 0,
    simulated_throttle_count: 7,
    simulated_error_count: 2,
    usage_status: "throttled",
    review_pressure: "low",
    rate_limit_pressure: "medium",
    simulated_window: "24h-fixed",
    notes: "Shares capability_key with export job; utilization seed splits usage_level below.",
  },
  {
    simulation_key: "sand_use_delta_payout",
    app_label: "Sandbox App Delta",
    product_key: "prod_payout_request_blueprint",
    contract_key: "sc_payout_request_intake",
    capability_key: "payout.request",
    environment: "sandbox",
    simulated_call_count: 112,
    simulated_success_count: 48,
    simulated_review_count: 44,
    simulated_throttle_count: 10,
    simulated_error_count: 10,
    usage_status: "constrained",
    review_pressure: "high",
    rate_limit_pressure: "exceeded",
    simulated_window: "24h-fixed",
    notes: "Illustrates exceeded tier narrative without implying a real limiter.",
  },
  {
    simulation_key: "sand_use_delta_treasury",
    app_label: "Sandbox App Delta",
    product_key: "prod_treasury_partner_read",
    contract_key: "sc_treasury_summary_read",
    capability_key: "treasury.read_summary",
    environment: "sandbox",
    simulated_call_count: 36,
    simulated_success_count: 22,
    simulated_review_count: 10,
    simulated_throttle_count: 2,
    simulated_error_count: 2,
    usage_status: "constrained",
    review_pressure: "medium",
    rate_limit_pressure: "high",
    simulated_window: "24h-fixed",
    notes: "Partner-read rehearsal; errors include scope_denied in catalog outcomes.",
  },
  {
    simulation_key: "sand_use_eps_disabled_triton",
    app_label: "Sandbox App Epsilon",
    product_key: "prod_triton_funding_rehearsal",
    contract_key: "sc_triton_funding_sim",
    capability_key: "trading.funding_reserve",
    environment: "sandbox",
    simulated_call_count: 12,
    simulated_success_count: 4,
    simulated_review_count: 2,
    simulated_throttle_count: 0,
    simulated_error_count: 6,
    usage_status: "inactive",
    review_pressure: "low",
    rate_limit_pressure: "low",
    simulated_window: "24h-fixed",
    notes: "Catalog product is disabled — seed documents residual drill attempts.",
  },
  {
    simulation_key: "sand_use_eps_stale",
    app_label: "Sandbox App Epsilon",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    simulated_call_count: 8,
    simulated_success_count: 8,
    simulated_review_count: 0,
    simulated_throttle_count: 0,
    simulated_error_count: 0,
    usage_status: "inactive",
    review_pressure: "none",
    rate_limit_pressure: "low",
    simulated_window: "24h-fixed",
    notes: "Low engagement snapshot for inactive classification in summary cards.",
  },
];

/**
 * Per-app health grades (governance / stability storytelling).
 *
 * @type {ReadonlyArray<{
 *   app_label: string,
 *   governance_compliance_grade: SandboxHealthGrade,
 *   sandbox_stability_grade: SandboxHealthGrade,
 *   capability_risk_grade: SandboxHealthGrade,
 *   review_load_grade: SandboxHealthGrade,
 *   overall_health_grade: SandboxHealthGrade,
 *   summary: string,
 *   recommended_next_step: string,
 * }>}
 */
export const SANDBOX_APP_HEALTH_SEEDS = [
  {
    app_label: "Sandbox App Alpha",
    governance_compliance_grade: "excellent",
    sandbox_stability_grade: "excellent",
    capability_risk_grade: "good",
    review_load_grade: "excellent",
    overall_health_grade: "excellent",
    summary: "Balanced read and simulation mix with minimal review backlog in seeded data.",
    recommended_next_step: "Optional: add statement export rehearsal when governance clears ledger exports.",
  },
  {
    app_label: "Sandbox App Beta",
    governance_compliance_grade: "good",
    sandbox_stability_grade: "good",
    capability_risk_grade: "watch",
    review_load_grade: "needs_review",
    overall_health_grade: "watch",
    summary: "Capture-review paths dominate simulated review counters — operator narrative emphasis.",
    recommended_next_step: "Reconcile payment.capture requests with fraud review drills before widening contract use.",
  },
  {
    app_label: "Sandbox App Gamma",
    governance_compliance_grade: "good",
    sandbox_stability_grade: "watch",
    capability_risk_grade: "good",
    review_load_grade: "good",
    overall_health_grade: "good",
    summary: "Throttle-heavy pattern on internal-tier exports; trace reads remain lighter.",
    recommended_next_step: "Schedule export windows in documentation before increasing simulated volume.",
  },
  {
    app_label: "Sandbox App Delta",
    governance_compliance_grade: "watch",
    sandbox_stability_grade: "needs_review",
    capability_risk_grade: "needs_review",
    review_load_grade: "watch",
    overall_health_grade: "needs_review",
    summary: "Payout blueprint plus treasury preview under one label shows constrained posture in seeds.",
    recommended_next_step: "Pause additional capability grants until review_pressure narratives are cleared in governance UI.",
  },
  {
    app_label: "Sandbox App Epsilon",
    governance_compliance_grade: "good",
    sandbox_stability_grade: "excellent",
    capability_risk_grade: "blocked",
    review_load_grade: "excellent",
    overall_health_grade: "blocked",
    summary: "Disabled catalog product drives blocked capability_risk_grade while overall activity is negligible.",
    recommended_next_step: "Archive Triton rehearsal drills or remap to active sandbox products in catalog.",
  },
];

/**
 * Capability utilization snapshots per app (orthogonal to usage rows).
 *
 * @type {ReadonlyArray<{
 *   app_label: string,
 *   capability_key: string,
 *   usage_level: "none"|"light"|"moderate"|"heavy"|"restricted",
 *   risk_level: "low"|"medium"|"high"|"critical",
 *   review_pressure: SandboxReviewPressureLevel,
 *   related_products: string[],
 *   related_contracts: string[],
 *   notes: string,
 * }>}
 */
export const SANDBOX_CAPABILITY_UTILIZATION_SEEDS = [
  {
    app_label: "Sandbox App Alpha",
    capability_key: "wallet.read",
    usage_level: "heavy",
    risk_level: "low",
    review_pressure: "none",
    related_products: ["prod_wallet_balance_read"],
    related_contracts: ["sc_wallet_balance_preview"],
    notes: "Primary read path for Alpha harnesses.",
  },
  {
    app_label: "Sandbox App Alpha",
    capability_key: "wallet.reserve",
    usage_level: "moderate",
    risk_level: "high",
    review_pressure: "low",
    related_products: ["prod_wallet_reserve_sim"],
    related_contracts: ["sc_wallet_reserve_cycle"],
    notes: "Reservation simulator throughput sits below balance reads in seeds.",
  },
  {
    app_label: "Sandbox App Alpha",
    capability_key: "notification.send",
    usage_level: "light",
    risk_level: "low",
    review_pressure: "none",
    related_products: ["prod_notification_dispatch"],
    related_contracts: ["sc_notification_dispatch"],
    notes: "Messaging contract used for integration smoke only.",
  },
  {
    app_label: "Sandbox App Beta",
    capability_key: "payment.create",
    usage_level: "heavy",
    risk_level: "medium",
    review_pressure: "high",
    related_products: ["prod_checkout_session"],
    related_contracts: ["sc_checkout_session_create", "sc_live_capture_mirror"],
    notes: "Includes live mirror contract key for documentation cross-reference.",
  },
  {
    app_label: "Sandbox App Beta",
    capability_key: "payment.capture",
    usage_level: "moderate",
    risk_level: "high",
    review_pressure: "critical",
    related_products: ["prod_payment_capture_review"],
    related_contracts: ["sc_payment_capture_review"],
    notes: "Requires fraud.review_required in live governance narrative.",
  },
  {
    app_label: "Sandbox App Beta",
    capability_key: "fraud.review_required",
    usage_level: "moderate",
    risk_level: "high",
    review_pressure: "high",
    related_products: ["prod_payment_capture_review"],
    related_contracts: ["sc_payment_capture_review"],
    notes: "Dependency marker exercised indirectly through capture-review contract.",
  },
  {
    app_label: "Sandbox App Beta",
    capability_key: "developer.webhook_manage",
    usage_level: "light",
    risk_level: "medium",
    review_pressure: "medium",
    related_products: ["prod_partner_webhook_catalog"],
    related_contracts: ["sc_webhook_topic_list"],
    notes: "Topic list reads only in this seed set.",
  },
  {
    app_label: "Sandbox App Gamma",
    capability_key: "ledger.export",
    usage_level: "heavy",
    risk_level: "medium",
    review_pressure: "medium",
    related_products: ["prod_statement_export_bundle", "prod_execution_trace_preview"],
    related_contracts: ["sc_statement_export_job", "sc_trace_bundle_fetch"],
    notes: "Two products share ledger.export; utilization marked heavy in simulation.",
  },
  {
    app_label: "Sandbox App Gamma",
    capability_key: "ledger.statement_generate",
    usage_level: "light",
    risk_level: "low",
    review_pressure: "low",
    related_products: ["prod_statement_export_bundle"],
    related_contracts: ["sc_statement_export_job"],
    notes: "Paired capability for export bundle — lighter call volume in seeds.",
  },
  {
    app_label: "Sandbox App Delta",
    capability_key: "payout.request",
    usage_level: "moderate",
    risk_level: "high",
    review_pressure: "high",
    related_products: ["prod_payout_request_blueprint"],
    related_contracts: ["sc_payout_request_intake"],
    notes: "Outbound blueprint rehearsal with elevated review_pressure.",
  },
  {
    app_label: "Sandbox App Delta",
    capability_key: "treasury.read_summary",
    usage_level: "light",
    risk_level: "medium",
    review_pressure: "medium",
    related_products: ["prod_treasury_partner_read"],
    related_contracts: ["sc_treasury_summary_read"],
    notes: "Partner scope guardrails in contract copy.",
  },
  {
    app_label: "Sandbox App Epsilon",
    capability_key: "trading.funding_reserve",
    usage_level: "restricted",
    risk_level: "critical",
    review_pressure: "low",
    related_products: ["prod_triton_funding_rehearsal"],
    related_contracts: ["sc_triton_funding_sim"],
    notes: "Disabled catalog entry — utilization flagged restricted for teaching.",
  },
  {
    app_label: "Sandbox App Epsilon",
    capability_key: "wallet.read",
    usage_level: "none",
    risk_level: "low",
    review_pressure: "none",
    related_products: ["prod_wallet_balance_read"],
    related_contracts: ["sc_wallet_balance_preview"],
    notes: "Residual reads only; most activity deemed inactive at app level.",
  },
];

/**
 * Simulated rate-limit windows per app (tier values align with API_RATE_LIMIT_TIERS).
 *
 * @type {ReadonlyArray<{
 *   app_label: string,
 *   rate_limit_tier: string,
 *   simulated_limit: number,
 *   simulated_used: number,
 *   simulated_remaining: number,
 *   pressure_level: SandboxRateLimitPressureLevel,
 *   reset_window: string,
 *   notes: string,
 * }>}
 */
export const SANDBOX_RATE_LIMIT_SIMULATION_SEEDS = [
  {
    app_label: "Sandbox App Alpha",
    rate_limit_tier: "sandbox_basic",
    simulated_limit: 6000,
    simulated_used: 2100,
    simulated_remaining: 3900,
    pressure_level: "low",
    reset_window: "24h-fixed",
    notes: "Combined basic-tier traffic stays well under cap in seed.",
  },
  {
    app_label: "Sandbox App Alpha",
    rate_limit_tier: "sandbox_partner",
    simulated_limit: 12000,
    simulated_used: 4400,
    simulated_remaining: 7600,
    pressure_level: "low",
    reset_window: "24h-fixed",
    notes: "Partner tier reserved for reserve simulator volume.",
  },
  {
    app_label: "Sandbox App Beta",
    rate_limit_tier: "sandbox_partner",
    simulated_limit: 12000,
    simulated_used: 9100,
    simulated_remaining: 2900,
    pressure_level: "high",
    reset_window: "24h-fixed",
    notes: "Checkout and capture rehearsal push partner tier utilization.",
  },
  {
    app_label: "Sandbox App Beta",
    rate_limit_tier: "restricted",
    simulated_limit: 800,
    simulated_used: 620,
    simulated_remaining: 180,
    pressure_level: "medium",
    reset_window: "24h-fixed",
    notes: "Restricted capture-review lane with smaller absolute limit.",
  },
  {
    app_label: "Sandbox App Gamma",
    rate_limit_tier: "internal",
    simulated_limit: 4000,
    simulated_used: 3720,
    simulated_remaining: 280,
    pressure_level: "high",
    reset_window: "24h-fixed",
    notes: "Export + trace bundle traffic against internal-tier storytelling.",
  },
  {
    app_label: "Sandbox App Delta",
    rate_limit_tier: "sandbox_basic",
    simulated_limit: 6000,
    simulated_used: 5980,
    simulated_remaining: 20,
    pressure_level: "exceeded",
    reset_window: "24h-fixed",
    notes: "Illustrates exceeded pressure with remaining floor → operators would reset in a real system.",
  },
  {
    app_label: "Sandbox App Delta",
    rate_limit_tier: "internal",
    simulated_limit: 4000,
    simulated_used: 1200,
    simulated_remaining: 2800,
    pressure_level: "medium",
    reset_window: "24h-fixed",
    notes: "Treasury preview lane under separate cap in seed.",
  },
  {
    app_label: "Sandbox App Epsilon",
    rate_limit_tier: "restricted",
    simulated_limit: 800,
    simulated_used: 40,
    simulated_remaining: 760,
    pressure_level: "low",
    reset_window: "24h-fixed",
    notes: "Low usage despite restricted tier — inactive app pattern.",
  },
];

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

/** @param {string} appLabel */
export function getSandboxUsageForApp(appLabel) {
  if (!appLabel) return [];
  return SANDBOX_USAGE_SIMULATION_SEEDS.filter((r) => r.app_label === appLabel);
}

/** @param {string} appLabel */
export function getSandboxHealthForApp(appLabel) {
  if (!appLabel) return null;
  return SANDBOX_APP_HEALTH_SEEDS.find((h) => h.app_label === appLabel) ?? null;
}

/** @param {string} appLabel */
export function getCapabilityUtilizationForApp(appLabel) {
  if (!appLabel) return [];
  return SANDBOX_CAPABILITY_UTILIZATION_SEEDS.filter((r) => r.app_label === appLabel);
}

/** @param {string} appLabel */
export function getRateLimitSimulationForApp(appLabel) {
  if (!appLabel) return [];
  return SANDBOX_RATE_LIMIT_SIMULATION_SEEDS.filter((r) => r.app_label === appLabel);
}

export function buildSandboxUsageSummary() {
  const rows = SANDBOX_USAGE_SIMULATION_SEEDS;
  /** @type {Record<string, number>} */
  const byUsageStatus = {};
  /** @type {Record<string, number>} */
  const byReviewPressure = {};
  /** @type {Record<string, number>} */
  const byRateLimitPressure = {};
  const appLabels = [];

  let totalCalls = 0;
  let totalSuccess = 0;
  let totalReview = 0;
  let totalThrottle = 0;
  let totalError = 0;

  for (const r of rows) {
    totalCalls += r.simulated_call_count;
    totalSuccess += r.simulated_success_count;
    totalReview += r.simulated_review_count;
    totalThrottle += r.simulated_throttle_count;
    totalError += r.simulated_error_count;
    byUsageStatus[r.usage_status] = (byUsageStatus[r.usage_status] || 0) + 1;
    byReviewPressure[r.review_pressure] = (byReviewPressure[r.review_pressure] || 0) + 1;
    byRateLimitPressure[r.rate_limit_pressure] =
      (byRateLimitPressure[r.rate_limit_pressure] || 0) + 1;
    if (!appLabels.includes(r.app_label)) appLabels.push(r.app_label);
  }

  return {
    phase: DEVELOPER_SANDBOX_ANALYTICS_PHASE,
    total_simulation_rows: rows.length,
    unique_app_count: appLabels.length,
    app_labels: appLabels,
    totals: {
      simulated_call_count: totalCalls,
      simulated_success_count: totalSuccess,
      simulated_review_count: totalReview,
      simulated_throttle_count: totalThrottle,
      simulated_error_count: totalError,
    },
    rows_by_usage_status: byUsageStatus,
    rows_by_review_pressure: byReviewPressure,
    rows_by_rate_limit_pressure: byRateLimitPressure,
  };
}

export function buildSandboxHealthSummary() {
  const seeds = SANDBOX_APP_HEALTH_SEEDS;
  /** @type {Record<string, number>} */
  const byOverall = {};
  /** @type {Record<string, number>} */
  const byReviewLoad = {};
  let blocked = 0;
  let needsReview = 0;

  for (const h of seeds) {
    byOverall[h.overall_health_grade] = (byOverall[h.overall_health_grade] || 0) + 1;
    byReviewLoad[h.review_load_grade] = (byReviewLoad[h.review_load_grade] || 0) + 1;
    if (h.overall_health_grade === "blocked") blocked += 1;
    if (
      h.overall_health_grade === "needs_review" ||
      h.review_load_grade === "needs_review"
    ) {
      needsReview += 1;
    }
  }

  return {
    phase: DEVELOPER_SANDBOX_ANALYTICS_PHASE,
    total_apps: seeds.length,
    apps_by_overall_health_grade: byOverall,
    apps_by_review_load_grade: byReviewLoad,
    blocked_app_count: blocked,
    apps_flagged_needs_review: needsReview,
  };
}

export function buildCapabilityUtilizationSummary() {
  const rows = SANDBOX_CAPABILITY_UTILIZATION_SEEDS;
  /** @type {Record<string, number>} */
  const byUsageLevel = {};
  /** @type {Record<string, number>} */
  const byRisk = {};
  /** @type {Record<string, number>} */
  const byReview = {};
  const capKeys = [];

  for (const r of rows) {
    byUsageLevel[r.usage_level] = (byUsageLevel[r.usage_level] || 0) + 1;
    byRisk[r.risk_level] = (byRisk[r.risk_level] || 0) + 1;
    byReview[r.review_pressure] = (byReview[r.review_pressure] || 0) + 1;
    if (!capKeys.includes(r.capability_key)) capKeys.push(r.capability_key);
  }

  return {
    phase: DEVELOPER_SANDBOX_ANALYTICS_PHASE,
    total_utilization_rows: rows.length,
    distinct_capability_keys: capKeys.length,
    rows_by_usage_level: byUsageLevel,
    rows_by_risk_level: byRisk,
    rows_by_review_pressure: byReview,
  };
}

export function buildRateLimitPressureSummary() {
  const rows = SANDBOX_RATE_LIMIT_SIMULATION_SEEDS;
  /** @type {Record<string, number>} */
  const byPressure = {};
  /** @type {Record<string, number>} */
  const byTier = {};
  let sumLimit = 0;
  let sumUsed = 0;
  let sumRemaining = 0;

  for (const r of rows) {
    byPressure[r.pressure_level] = (byPressure[r.pressure_level] || 0) + 1;
    byTier[r.rate_limit_tier] = (byTier[r.rate_limit_tier] || 0) + 1;
    sumLimit += r.simulated_limit;
    sumUsed += r.simulated_used;
    sumRemaining += r.simulated_remaining;
  }

  return {
    phase: DEVELOPER_SANDBOX_ANALYTICS_PHASE,
    total_rate_limit_rows: rows.length,
    rows_by_pressure_level: byPressure,
    rows_by_tier: byTier,
    aggregate_simulated_limits: sumLimit,
    aggregate_simulated_used: sumUsed,
    aggregate_simulated_remaining: sumRemaining,
  };
}

export function buildDeveloperAnalyticsDashboardSummary() {
  return {
    phase: DEVELOPER_SANDBOX_ANALYTICS_PHASE,
    modeling_note:
      "Composite dashboard object assembled from static seeds only — no telemetry ingestion.",
    usage: buildSandboxUsageSummary(),
    health: buildSandboxHealthSummary(),
    capability_utilization: buildCapabilityUtilizationSummary(),
    rate_limits: buildRateLimitPressureSummary(),
  };
}
