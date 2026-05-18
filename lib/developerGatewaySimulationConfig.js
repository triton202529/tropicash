/**
 * Tropicash Developer Platform — Phase 5C:
 * API gateway & request envelope architecture simulation (modeling only).
 *
 * MODELING + SIMULATION ONLY. This module does NOT expose or invoke real gateways,
 * routes, middleware, auth, crypto, API keys, webhooks, workers, execution, treasury,
 * wallets, withdrawals, PayPal, or fraud. No Date.now, Math.random, fetch, Supabase,
 * or storage — pure configuration and deterministic merges.
 */

import { evaluateAuthSimulationCase, getAuthSimulationCase } from "./developerAuthSimulationConfig";
import {
  API_SANDBOX_CONTRACTS,
  DEVELOPER_PRODUCT_PHASE,
  getProductByKey,
} from "./developerProductCatalogConfig";
import {
  DEVELOPER_SANDBOX_ANALYTICS_PHASE,
  getSandboxUsageForApp,
} from "./developerSandboxAnalyticsConfig";
import {
  INTERNAL_OBSERVABILITY_PHASE,
  getExecutionStatusType,
} from "./internalObservabilityConfig";
import {
  getRuntimeExecutionState,
  INTERNAL_RUNTIME_STATE_PHASE,
} from "./internalRuntimeStateConfig";

export const DEVELOPER_GATEWAY_SIMULATION_PHASE = "phase_5c_gateway_simulation";

const CREDENTIAL_PLACEHOLDER_LABEL = "sandbox_credential_placeholder";

/** @typedef {'passed' | 'failed' | 'skipped' | 'warning'} GatewayStageSimResult */
/** @typedef {'modeled' | 'planned' | 'future'} GatewayDocStatus */

/**
 * Canonical request envelope schema (conceptual preview).
 * @type {ReadonlyArray<{ field_key: string, label: string, description: string, required_hint: boolean }>}
 */
export const GATEWAY_ENVELOPE_FIELDS = [
  {
    field_key: "request_id",
    label: "Request identifier",
    description: "Stable per-request identifier carried end-to-end for deduplication previews.",
    required_hint: true,
  },
  {
    field_key: "correlation_id",
    label: "Correlation identifier",
    description: "Bundles related gateway calls before execution handoff narratives.",
    required_hint: true,
  },
  {
    field_key: "trace_id",
    label: "Trace identifier",
    description: "Joins observability sessions (Phase 2E vocabulary) without emitting telemetry.",
    required_hint: true,
  },
  {
    field_key: "environment",
    label: "Declared environment",
    description: "Sandbox, live rehearsal label, or internal posture — aligns with Phase 4D catalog `environment`.",
    required_hint: true,
  },
  {
    field_key: "app_label",
    label: "App label",
    description: "Human-facing developer application label used in analytics rehearsal rows.",
    required_hint: true,
  },
  {
    field_key: "product_key",
    label: "Product key",
    description: "Phase 4D `API_PRODUCTS` key used for catalog binding previews.",
    required_hint: true,
  },
  {
    field_key: "contract_key",
    label: "Contract key",
    description: "Phase 4D `API_SANDBOX_CONTRACTS.contract_key` for route-class previews.",
    required_hint: true,
  },
  {
    field_key: "capability_key",
    label: "Capability key",
    description: "Phase 2C capability seed referenced by catalog rows.",
    required_hint: true,
  },
  {
    field_key: "credential_reference",
    label: "Credential reference",
    description:
      `Always a placeholder handle in simulations (e.g. "${CREDENTIAL_PLACEHOLDER_LABEL}") — never a secret.`,
    required_hint: true,
  },
  {
    field_key: "auth_policy_key",
    label: "Auth policy key",
    description: "Phase 5B `AUTH_VERIFICATION_POLICIES.policy_key` for teaching alignment.",
    required_hint: false,
  },
  {
    field_key: "rate_limit_tier",
    label: "Rate-limit tier key",
    description: "Mirrors Phase 4D `rate_limit_tier` vocabulary on products and contracts.",
    required_hint: true,
  },
  {
    field_key: "request_metadata",
    label: "Request metadata",
    description: "Lightweight previews (catalog phase anchors, analytic alignment keys).",
    required_hint: false,
  },
  {
    field_key: "audit_metadata",
    label: "Audit metadata",
    description: "Pre-execution narrative hints stitched into GATEWAY_AUDIT_ENVELOPE_FIELDS.",
    required_hint: false,
  },
  {
    field_key: "governance_context",
    label: "Governance context",
    description: "Planned reviewer posture placeholders — no governance execution.",
    required_hint: false,
  },
  {
    field_key: "observability_context",
    label: "Observability context",
    description: "Static references to Phase 2E dashboards and execution session statuses.",
    required_hint: false,
  },
  {
    field_key: "runtime_state_context",
    label: "Runtime state context",
    description: "Static references to Phase 2F snapshots and checkpoints for correlation teaching.",
    required_hint: false,
  },
];

/**
 * Fourteen ordered gateway-facing processing surfaces.
 * `auth_verification_simulated` delegates into Phase 5B via evaluateAuthSimulationCase.
 */
export const GATEWAY_PROCESSING_STAGES = [
  {
    stage_key: "edge_transport_received",
    label: "Edge transport received",
    description: "TLS-terminating edge accepts the TCP session and hands bytes to normalization without parsing secrets.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "envelope_normalization",
    label: "Request envelope normalization",
    description: "Normalize headers, verbs, declared content negotiation, and static path templates.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "correlation_context_bound",
    label: "Correlation context bound",
    description: "Bind request_id, correlation_id, and trace_id to the GATEWAY_CORRELATION_MODELS vocabulary.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "environment_tenant_resolution",
    label: "Environment & tenant resolution",
    description:
      "Resolve sandbox vs live vs rehearsal labels against app governance metadata (no datastore access here).",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "auth_verification_simulated",
    label: "Auth verification (Phase 5B delegate)",
    description:
      "Runs evaluateAuthSimulationCase for the seeded auth_case_key — static verification trace only.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "catalog_route_binding",
    label: "Catalog route binding preview",
    description: "Map incoming route class to Phase 4D product and contract previews before execution adapters.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "governance_policy_surface",
    label: "Governance policy surface",
    description: "Reviews frozen governance metadata that would pause or escalate certain contract classes.",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "capability_route_projection",
    label: "Capability route projection",
    description: "Ensures downstream orchestration adapters see the Phase 2C capability scope expected by the contract.",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "rate_limit_budget_surface",
    label: "Rate-limit budget preview",
    description: "Applies GATEWAY_RATE_LIMIT_MODELS rehearsals without issuing real quota tokens.",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "observability_context_surface",
    label: "Observability stamping preview",
    description: "Attach EXECUTION_STATUS preview labels from Phase 2E for hypothetical sessions.",
    blocking_by_default: false,
    status: "planned",
  },
  {
    stage_key: "runtime_state_projection_surface",
    label: "Runtime state projection preview",
    description: "Reference Phase 2F snapshot states purely for correlated storytelling.",
    blocking_by_default: false,
    status: "planned",
  },
  {
    stage_key: "routing_decision_aggregation",
    label: "Routing decision aggregation",
    description: "Collate stage narratives into GATEWAY_ROUTING_OUTCOMES for operator teaching.",
    blocking_by_default: false,
    status: "modeled",
  },
  {
    stage_key: "audit_preview_assembly",
    label: "Audit envelope assembly preview",
    description: "Materialize GATEWAY_AUDIT_ENVELOPE_FIELDS without writing append-only logs.",
    blocking_by_default: false,
    status: "planned",
  },
  {
    stage_key: "orchestration_handoff_preview",
    label: "Orchestration handoff preview",
    description: "Non-executing handoff narration before Phase 3A execution simulations begin.",
    blocking_by_default: false,
    status: "future",
  },
];

export const GATEWAY_ROUTING_OUTCOMES = [
  {
    outcome_key: "gateway.routing.accept_preview",
    label: "Accept preview (handoff narrated)",
    category: "success",
    terminal: false,
    developer_message:
      "Gateway surfaces accepted the rehearsal envelope — execution simulators may continue in later phases.",
    operator_message:
      "Trace all fourteen stages as passed; correlate with downstream orchestration rehearsals only.",
  },
  {
    outcome_key: "gateway.routing.reject_malformed_envelope",
    label: "Reject — malformed envelope",
    category: "malformed",
    terminal: true,
    developer_message: "Normalization or envelope fields failed before trustworthy routing metadata exists.",
    operator_message: "Stop at normalization / correlation drills — no identity or capability routing yet.",
  },
  {
    outcome_key: "gateway.routing.reject_authentication_simulation",
    label: "Reject — authentication simulation",
    category: "authentication",
    terminal: true,
    developer_message: "Phase 5B verification produced a terminal authentication posture for this seed.",
    operator_message:
      "Pair the failure with AUTH_FAILURE_STATES for the delegated stage — gateway only mirrors the simulation.",
  },
  {
    outcome_key: "gateway.routing.reject_environment_isolation",
    label: "Reject — environment isolation",
    category: "environment",
    terminal: true,
    developer_message: "Sandbox, live rehearsal, or internal posture conflicts with credential or catalog previews.",
    operator_message:
      "Use environment overrides intentionally — this outcome documents isolation without opening new traffic.",
  },
  {
    outcome_key: "gateway.routing.reject_capability_route",
    label: "Reject — capability routing",
    category: "capability",
    terminal: true,
    developer_message: "Capability authorization or routing projection conflicts with Phase 4D / Phase 2C alignment.",
    operator_message:
      "Compare required capabilities on the catalog row with App Capability assignments before execution rehearsals.",
  },
  {
    outcome_key: "gateway.routing.reject_governance_surface",
    label: "Reject — governance surface",
    category: "governance",
    terminal: true,
    developer_message: "Governance metadata for this rehearsal route would halt before orchestration adapters.",
    operator_message:
      "Escalate to App Governance previews — Phase 5C only narrates static governance_context placeholders.",
  },
  {
    outcome_key: "gateway.routing.throttled_budget_preview",
    label: "Throttled — budget preview",
    category: "rate_limit",
    terminal: true,
    developer_message: "Simulated quota budget denies the rehearsal call at the gateway rate-limit surface.",
    operator_message:
      "Align with GATEWAY_RATE_LIMIT_MODELS and SANDBOX_RATE_LIMIT_PRESSURE_LEVELS stories — counters are illustrative.",
  },
  {
    outcome_key: "gateway.routing.review_held_non_terminal",
    label: "Review held (non-terminal at gateway)",
    category: "review",
    terminal: false,
    developer_message: "Mechanical stages pass but a rehearsal review hold attaches to observability narration.",
    operator_message:
      "Follow into Phase 3B decision drills — gateway review is informational until operators clear governance.",
  },
  {
    outcome_key: "gateway.routing.degraded_warning_continue",
    label: "Degraded — warnings only",
    category: "degraded",
    terminal: false,
    developer_message: "Gateway surfaces emit warnings (often rate-limit rehearsal) yet continue to acceptance.",
    operator_message:
      "Track warning pills on observability previews; escalate if warnings repeat in correlated traces.",
  },
  {
    outcome_key: "gateway.routing.internal_partner_scope_block",
    label: "Internal partner scope blocked",
    category: "internal_scope",
    terminal: true,
    developer_message: "Catalog-bound internal rehearsal scope disagrees with the caller’s routed bindings.",
    operator_message:
      "Validate internal_only products separately from sandbox dashboards — simulator encodes mismatches via catalog binding failures.",
  },
];

/** @typedef {'conceptual' | 'simulated' | 'future'} RateLimitDocStatus */

/**
 * Mirrors API_RATE_LIMIT_TIERS vocabulary with illustrative caps (not enforced).
 */
export const GATEWAY_RATE_LIMIT_MODELS = [
  {
    tier_key: "sandbox_basic",
    label: "Sandbox basic",
    simulated_limit: 1200,
    simulated_window: "per_app_per_minute_preview",
    enforcement_status: "simulated",
  },
  {
    tier_key: "sandbox_partner",
    label: "Sandbox partner",
    simulated_limit: 6000,
    simulated_window: "per_partner_per_hour_preview",
    enforcement_status: "simulated",
  },
  {
    tier_key: "internal",
    label: "Internal rehearsal",
    simulated_limit: 2000,
    simulated_window: "per_service_per_minute_preview",
    enforcement_status: "conceptual",
  },
  {
    tier_key: "restricted",
    label: "Restricted catalog",
    simulated_limit: 120,
    simulated_window: "per_route_per_hour_preview",
    enforcement_status: "future",
  },
];

/** Narrative audit field names surfaced in previews only. */
export const GATEWAY_AUDIT_ENVELOPE_FIELDS = [
  "audit_actor_class",
  "audit_app_subject",
  "audit_environment_stamp",
  "audit_route_family",
  "audit_policy_refs",
  "audit_correlation_triple",
  "audit_capability_refs",
  "audit_rate_limit_tier",
  "audit_gateway_phase_tag",
];

/**
 * Six correlation narratives tying gateway placeholders to sibling blueprints.
 */
export const GATEWAY_CORRELATION_MODELS = [
  {
    model_key: "corr_request_to_trace",
    label: "Request → trace",
    source: "request_id",
    target: "trace_id",
    propagated_fields: ["request_id", "correlation_id", "trace_id"],
    description:
      "Every gateway envelope declares a triple echoed by Phase 2E execution_session previews when narrated downstream.",
  },
  {
    model_key: "corr_trace_to_session",
    label: "Trace → execution session",
    source: "trace_id",
    target: "execution_session_id_placeholder",
    propagated_fields: ["trace_id", "capability_key", "environment"],
    description:
      "Static seeds in internalObservabilityConfig illustrate how traces become session stubs — no emitter runs here.",
  },
  {
    model_key: "corr_session_to_runtime_snapshot",
    label: "Session → runtime snapshot",
    source: "execution_session_id_placeholder",
    target: "runtime_snapshot_placeholder",
    propagated_fields: ["trace_id", "contract_key", "routing_outcome_preview"],
    description:
      "Phase 2F snapshot vocabulary references the same trace identifiers purely for rehearsal documentation.",
  },
  {
    model_key: "corr_app_to_audit_narrative",
    label: "App label → audit narrative",
    source: "app_label",
    target: "audit_app_subject",
    propagated_fields: ["app_label", "product_key"],
    description:
      "Audit preview assembly substitutes app labels before any append-only store exists.",
  },
  {
    model_key: "corr_gateway_orchestration",
    label: "Gateway → orchestration handoff",
    source: "gateway_stage_trace_placeholder",
    target: "orchestration_phase_3a_placeholder",
    propagated_fields: ["routing_outcome_key", "capability_key", "audit_metadata"],
    description:
      "Phase 5C ends with narrated orchestration handoff referencing prior stage outcomes only.",
  },
  {
    model_key: "corr_analytics_alignment",
    label: "Gateway → sandbox analytics rehearsal",
    source: "product_key",
    target: "sandbox_usage_seed_row",
    propagated_fields: ["app_label", "product_key", "contract_key"],
    description:
      "developerSandboxAnalyticsConfig seeds reuse identical keys for rehearsal counts — gateway never computes them.",
  },
];

/**
 * Ten deterministic simulations (keys follow gateway.<domain>.<story> conventions).
 *
 * @type {ReadonlyArray<{
 *   case_key: string,
 *   title: string,
 *   app_label: string,
 *   product_key: string,
 *   contract_key: string,
 *   capability_key: string,
 *   environment: string,
 *   auth_case_key: string,
 *   auth_policy_key: string,
 *   rate_limit_tier: string,
 *   expected_outcome: string,
 *   expected_outcome_env_overrides?: Record<string, string>,
 *   stage_overrides: Record<string, GatewayStageSimResult>,
 *   envelope_overrides: Record<string, unknown>,
 *   explanation: string,
 * }>}
 */
export const GATEWAY_SIMULATION_CASES = [
  {
    case_key: "gateway.wallet.preview.success",
    title: "Wallet preview — gateway accept path",
    app_label: "Rehearsal Wallet UI",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    auth_policy_key: "pol_sandbox_api_key_read",
    rate_limit_tier: "sandbox_basic",
    expected_outcome: "gateway.routing.accept_preview",
    stage_overrides: {},
    envelope_overrides: {},
    explanation:
      "Happy-path gateway walk with delegated Phase 5B success — aligns catalog read contract with SANDBOX_USAGE_SIMULATION_SEEDS storytelling.",
  },
  {
    case_key: "gateway.wallet.preview.malformed_reserve",
    title: "Wallet reserve preview — malformed proof envelope",
    app_label: "Hold / release harness",
    product_key: "prod_wallet_reserve_sim",
    contract_key: "sc_wallet_reserve_cycle",
    capability_key: "wallet.reserve",
    environment: "sandbox",
    auth_case_key: "auth_case_reserve_missing_idempotency",
    auth_policy_key: "pol_sandbox_api_key_mutate",
    rate_limit_tier: "sandbox_basic",
    expected_outcome: "gateway.routing.reject_malformed_envelope",
    stage_overrides: {},
    envelope_overrides: {},
    explanation:
      "Delegates to Phase 5B missing proof fields — normalization passes but delegated auth exposes malformed posture mirrored as envelope rejection.",
  },
  {
    case_key: "gateway.checkout.preview.capability_denied",
    title: "Checkout preview — capability route denial",
    app_label: "Commerce starter kit",
    product_key: "prod_checkout_session",
    contract_key: "sc_checkout_session_create",
    capability_key: "payment.create",
    environment: "sandbox",
    auth_case_key: "auth_case_checkout_missing_payment_capability",
    auth_policy_key: "pol_sandbox_api_key_mutate",
    rate_limit_tier: "sandbox_partner",
    expected_outcome: "gateway.routing.reject_capability_route",
    stage_overrides: {},
    envelope_overrides: {},
    explanation:
      "Delegated authentication surfaces capability authorization failures that the gateway models as routing denials.",
  },
  {
    case_key: "gateway.wallet.preview.live_environment_drill",
    title: "Wallet preview — live environment drill narrative",
    app_label: "Mis-routed SDK drill",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    auth_case_key: "auth_case_live_eval_on_sandbox_credential",
    auth_policy_key: "pol_sandbox_api_key_read",
    rate_limit_tier: "sandbox_basic",
    expected_outcome: "gateway.routing.accept_preview",
    expected_outcome_env_overrides: {
      sandbox: "gateway.routing.accept_preview",
      live: "gateway.routing.reject_environment_isolation",
      internal: "gateway.routing.reject_environment_isolation",
    },
    stage_overrides: {},
    envelope_overrides: {},
    explanation:
      "Mirrors Phase 5B dual expectation: sandbox evaluation accepts while live rehearsal labels intentionally diverge.",
  },
  {
    case_key: "gateway.payment.preview.review_branch",
    title: "Payment capture preview — gateway review narration",
    app_label: "Risky capture drill",
    product_key: "prod_payment_capture_review",
    contract_key: "sc_payment_capture_review",
    capability_key: "payment.capture",
    environment: "sandbox",
    auth_case_key: "auth_case_capture_review_hold",
    auth_policy_key: "pol_review_gated_capture",
    rate_limit_tier: "sandbox_partner",
    expected_outcome: "gateway.routing.review_held_non_terminal",
    stage_overrides: {},
    envelope_overrides: {},
    explanation:
      "Phase 5B emits review-required posture without blocking failures — modeled as gateway review hold with downstream simulation optional.",
  },
  {
    case_key: "gateway.partner.preview.internal_scope_block",
    title: "Partner binding rehearsal — catalog scope contradiction",
    app_label: "Partner liquidity preview",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    auth_policy_key: "pol_sandbox_api_key_read",
    rate_limit_tier: "internal",
    expected_outcome: "gateway.routing.internal_partner_scope_block",
    stage_overrides: { catalog_route_binding: "failed" },
    envelope_overrides: {},
    explanation:
      "Authentication passes, but catalog-route binding deliberately fails to rehearse restricted internal routing stories.",
  },
  {
    case_key: "gateway.wallet.preview.replay_blocked",
    title: "Wallet reserve preview — replay simulation block",
    app_label: "Flaky network replay",
    product_key: "prod_wallet_reserve_sim",
    contract_key: "sc_wallet_reserve_cycle",
    capability_key: "wallet.reserve",
    environment: "sandbox",
    auth_case_key: "auth_case_replay_nonce_conflict",
    auth_policy_key: "pol_sandbox_api_key_mutate",
    rate_limit_tier: "sandbox_basic",
    expected_outcome: "gateway.routing.reject_authentication_simulation",
    stage_overrides: {},
    envelope_overrides: {},
    explanation:
      "Delegates to replay failure vocabulary from Phase 5B — surfaced as gateway-level authentication rejection for teaching.",
  },
  {
    case_key: "gateway.sandbox.preview.rate_budget_warning",
    title: "Sandbox rehearsal — degraded rate-limit warning surface",
    app_label: "Rehearsal Wallet UI",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    auth_policy_key: "pol_sandbox_api_key_read",
    rate_limit_tier: "sandbox_basic",
    expected_outcome: "gateway.routing.degraded_warning_continue",
    stage_overrides: { rate_limit_budget_surface: "warning" },
    envelope_overrides: {},
    explanation:
      "Authentication is clean — the simulator injects only a narrative warning at the gateway rate-limit surface to rehearse degraded handoffs.",
  },
  {
    case_key: "gateway.rate_limit.preview.budget_exceeded",
    title: "Rate-limit rehearsal — simulated hard deny",
    app_label: "Rehearsal Wallet UI",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    auth_policy_key: "pol_sandbox_api_key_read",
    rate_limit_tier: "sandbox_partner",
    expected_outcome: "gateway.routing.throttled_budget_preview",
    stage_overrides: { rate_limit_budget_surface: "failed" },
    envelope_overrides: {},
    explanation:
      "Deterministic rehearsal that the conceptual gateway may stop traffic at the throttle surface prior to orchestration — numbers reference GATEWAY_RATE_LIMIT_MODELS only.",
  },
  {
    case_key: "gateway.governance.preview.hard_gate",
    title: "Governance surface rehearsal — deliberate hard gate",
    app_label: "Operator governance drill",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    auth_policy_key: "pol_sandbox_api_key_read",
    rate_limit_tier: "restricted",
    expected_outcome: "gateway.routing.reject_governance_surface",
    stage_overrides: { governance_policy_surface: "failed" },
    envelope_overrides: {
      governance_context: {
        review_queue_placeholder: "governance_hard_stop_preview",
        operator_lane: "static_seed_only",
      },
    },
    explanation:
      "Authentication succeeds intentionally so operators can rehearse downstream governance-stage failures in isolation.",
  },
];

/** Narrative sidebar: treasury-style auth failures remain available directly from Phase 5B cases delegated here. */

export const GATEWAY_SIMULATION_SAFETY_RULES = [
  "Phase 5C is configuration storytelling — never attempt to terminate TLS, terminate HTTP requests, or contact a live gateway.",
  "credential_reference MUST remain placeholder text; do not substitute API keys or webhook secrets.",
  "evaluateAuthSimulationCase only reads static Phase 5B seeds — downstream failures never touch middleware or Supabase.",
  "Correlation triples here are illustrative; they do not open Datadog dashboards or telemetry sinks.",
  "Rate-limit numbers ARE NOT quotas — pairing with Sandbox Analytics narratives is explanatory only.",
  "Routing outcomes summarize teaching traces; mismatches with Phase 5B delegated outcomes imply seed drift reviewers must fix intentionally.",
];

const OUTCOME_MAP = Object.fromEntries(GATEWAY_ROUTING_OUTCOMES.map((o) => [o.outcome_key, o]));

function assertGatewayAlignment() {
  for (const row of GATEWAY_SIMULATION_CASES) {
    if (!getAuthSimulationCase(row.auth_case_key)) {
      throw new Error(`Unknown auth_case_key on gateway case ${row.case_key}`);
    }
    if (!getProductByKey(row.product_key)) {
      throw new Error(`Unknown product_key on gateway case ${row.case_key}`);
    }
    const contract = API_SANDBOX_CONTRACTS.find((c) => c.contract_key === row.contract_key);
    if (!contract || contract.product_key !== row.product_key) {
      throw new Error(`contract/product mismatch on gateway case ${row.case_key}`);
    }
    if (!OUTCOME_MAP[row.expected_outcome]) {
      throw new Error(`Unknown expected_outcome on gateway case ${row.case_key}`);
    }
    if (row.expected_outcome_env_overrides) {
      for (const key of Object.values(row.expected_outcome_env_overrides)) {
        if (!OUTCOME_MAP[key]) {
          throw new Error(`Unknown expected_outcome override value on gateway case ${row.case_key}`);
        }
      }
    }
  }
}

assertGatewayAlignment();

/** @returns {GatewayStageSimResult[]} */
function authDelegateResult(authEvaluation) {
  if (authEvaluation.error === "unknown_case") {
    return { stageResult: /** @type {GatewayStageSimResult} */ ("failed"), reviewFlag: false, terminalAuth: true };
  }
  if (authEvaluation.terminal_failure) {
    return { stageResult: "failed", reviewFlag: false, terminalAuth: true };
  }
  if (authEvaluation.derived_outcome === "review_required") {
    return { stageResult: "warning", reviewFlag: true, terminalAuth: false };
  }
  return { stageResult: "passed", reviewFlag: false, terminalAuth: false };
}

/**
 * Resolve expected routing key for cases with environmental nuance (mirrors Phase 5B drills).
 */
function resolveExpectedOutcomeKey(row, effectiveEnv) {
  if (row.expected_outcome_env_overrides && row.expected_outcome_env_overrides[effectiveEnv]) {
    return row.expected_outcome_env_overrides[effectiveEnv];
  }
  return row.expected_outcome;
}

/**
 * Map delegated auth-derived outcomes to routing enumerations after auth stage failure.
 */
function outcomeFromDelegatedAuth(authEvaluation) {
  const details = authEvaluation.failure_details ?? [];
  const hasCapabilityDenial =
    authEvaluation.derived_outcome === "blocked" &&
    details.some((f) => f.failure_key === "capability_not_granted");
  if (hasCapabilityDenial) {
    return GATEWAY_ROUTING_OUTCOMES.find((o) => o.outcome_key === "gateway.routing.reject_capability_route");
  }
  switch (authEvaluation.derived_outcome) {
    case "malformed":
      return GATEWAY_ROUTING_OUTCOMES.find((o) => o.outcome_key === "gateway.routing.reject_malformed_envelope");
    case "environment_denied":
      return GATEWAY_ROUTING_OUTCOMES.find((o) => o.outcome_key === "gateway.routing.reject_environment_isolation");
    case "blocked":
      return GATEWAY_ROUTING_OUTCOMES.find((o) => o.outcome_key === "gateway.routing.reject_authentication_simulation");
    case "rejected":
      return GATEWAY_ROUTING_OUTCOMES.find((o) => o.outcome_key === "gateway.routing.reject_authentication_simulation");
    case "review_required":
      return GATEWAY_ROUTING_OUTCOMES.find((o) => o.outcome_key === "gateway.routing.review_held_non_terminal");
    default:
      return GATEWAY_ROUTING_OUTCOMES.find((o) => o.outcome_key === "gateway.routing.accept_preview");
  }
}

/** @param {{ stage_key: string, blocking: boolean, label: string, result: GatewayStageSimResult, doc_status: string }[]} stages */
function resolveRoutingOutcomeSnapshot(stages, authEvaluation, reviewFlagAfterAuth, options) {
  const firstBlockingFailure = stages.find((s) => s.blocking && s.result === "failed");
  const rateLimited = stages.find((s) => s.stage_key === "rate_limit_budget_surface");
  const hasRateWarning = stages.some((s) => s.stage_key === "rate_limit_budget_surface" && s.result === "warning");

  let routing = OUTCOME_MAP["gateway.routing.accept_preview"];

  if (firstBlockingFailure) {
    switch (firstBlockingFailure.stage_key) {
      case "edge_transport_received":
      case "envelope_normalization":
      case "correlation_context_bound":
        routing = OUTCOME_MAP["gateway.routing.reject_malformed_envelope"];
        break;
      case "environment_tenant_resolution":
        routing = OUTCOME_MAP["gateway.routing.reject_environment_isolation"];
        break;
      case "catalog_route_binding":
        routing = OUTCOME_MAP["gateway.routing.internal_partner_scope_block"];
        break;
      case "auth_verification_simulated":
        routing =
          outcomeFromDelegatedAuth(authEvaluation) ?? OUTCOME_MAP["gateway.routing.reject_authentication_simulation"];
        break;
      case "governance_policy_surface":
        routing = OUTCOME_MAP["gateway.routing.reject_governance_surface"];
        break;
      case "capability_route_projection":
        routing = OUTCOME_MAP["gateway.routing.reject_capability_route"];
        break;
      case "rate_limit_budget_surface":
        routing = OUTCOME_MAP["gateway.routing.throttled_budget_preview"];
        break;
      default:
        routing = OUTCOME_MAP["gateway.routing.reject_malformed_envelope"];
    }
  } else if (reviewFlagAfterAuth || options.forceReviewHeld) {
    routing = OUTCOME_MAP["gateway.routing.review_held_non_terminal"];
  } else if (hasRateWarning && rateLimited?.result !== "failed") {
    routing = OUTCOME_MAP["gateway.routing.degraded_warning_continue"];
  }

  return routing;
}

/**
 * @typedef {{
 *   environment?: string,
 *   authTraceOverrides?: Record<string, "passed"|"failed"|"skipped"|"warning">,
 *   stageOverrides?: Record<string, GatewayStageSimResult>,
 * }} GatewayEvalOptions
 */

/**
 * Expand gateway stage evaluations with deterministic skip propagation after blocking failures.
 *
 * @param {string | (typeof GATEWAY_SIMULATION_CASES)[number]} caseInput
 */
export function buildGatewayStageTrace(caseInput, authEvaluation, mergedOverrides) {
  const row = typeof caseInput === "string" ? getGatewaySimulationCase(caseInput) : caseInput;
  if (!row) return [];

  const delegate = authDelegateResult(authEvaluation);
  /** @type {Record<string, GatewayStageSimResult | undefined>} */
  const seeded = { ...(mergedOverrides ?? {}) };

  const results = [];
  let skipRest = false;

  for (let i = 0; i < GATEWAY_PROCESSING_STAGES.length; i += 1) {
    const meta = GATEWAY_PROCESSING_STAGES[i];
    const stageKey = meta.stage_key;
    let result = seeded[stageKey];

    if (result === undefined && stageKey === "auth_verification_simulated") {
      result = skipRest ? "skipped" : delegate.stageResult;
    } else if (result === undefined) {
      result = skipRest ? "skipped" : "passed";
    } else if (skipRest && result !== "skipped") {
      result = "skipped";
    }

    results.push({
      stage_key: stageKey,
      label: meta.label,
      blocking: meta.blocking_by_default,
      result,
      doc_status: meta.status,
    });

    if (meta.blocking_by_default && result === "failed") {
      skipRest = true;
    }
  }

  return results;
}

/**
 * @param {string} caseKey
 */
export function getGatewaySimulationCase(caseKey) {
  return GATEWAY_SIMULATION_CASES.find((c) => c.case_key === caseKey) ?? null;
}

/**
 * Merge defaults plus case envelope overrides. credential_reference stays placeholder-only.
 *
 * @param {string | (typeof GATEWAY_SIMULATION_CASES)[number]} caseKeyOrObject
 * @param {string} [effectiveEnv]
 */
export function buildGatewayEnvelope(caseKeyOrObject, effectiveEnv) {
  const row = typeof caseKeyOrObject === "string" ? getGatewaySimulationCase(caseKeyOrObject) : caseKeyOrObject;
  if (!row) {
    return {
      request_id: "gateway_unknown_case",
      correlation_id: "corr_unknown_case",
      trace_id: "trace_unknown_case",
      environment: effectiveEnv ?? "sandbox",
      app_label: "unknown_case",
      product_key: "unknown_case",
      contract_key: "unknown_case",
      capability_key: "unknown_case",
      credential_reference: CREDENTIAL_PLACEHOLDER_LABEL,
      auth_policy_key: "pol_unknown",
      rate_limit_tier: "sandbox_basic",
      request_metadata: {
        developer_product_phase: DEVELOPER_PRODUCT_PHASE,
        sandbox_analytics_phase: DEVELOPER_SANDBOX_ANALYTICS_PHASE,
        observability_phase: INTERNAL_OBSERVABILITY_PHASE,
        runtime_state_phase: INTERNAL_RUNTIME_STATE_PHASE,
        product_known: false,
      },
      audit_metadata: {
        rehearsal_only: true,
        gateway_phase: DEVELOPER_GATEWAY_SIMULATION_PHASE,
      },
      governance_context: { posture: "unresolved_placeholder" },
      observability_context: {
        preview_status_key: getExecutionStatusType("planned").key,
        observability_phase: INTERNAL_OBSERVABILITY_PHASE,
      },
      runtime_state_context: {
        preview_snapshot_state: getRuntimeExecutionState("planned").key,
        runtime_phase: INTERNAL_RUNTIME_STATE_PHASE,
      },
    };
  }

  const envResolved = effectiveEnv ?? row.environment;
  const sandboxRows = getSandboxUsageForApp(row.app_label).filter((u) => u.contract_key === row.contract_key);

  /** @type {Record<string, unknown>} */
  const base = {
    request_id: "gateway_req_placeholder",
    correlation_id: "gateway_corr_placeholder",
    trace_id: "gateway_trace_placeholder",
    environment: envResolved,
    app_label: row.app_label,
    product_key: row.product_key,
    contract_key: row.contract_key,
    capability_key: row.capability_key,
    credential_reference: CREDENTIAL_PLACEHOLDER_LABEL,
    auth_policy_key: row.auth_policy_key,
    rate_limit_tier: row.rate_limit_tier,
    request_metadata: {
      developer_product_phase: DEVELOPER_PRODUCT_PHASE,
      sandbox_analytics_phase: DEVELOPER_SANDBOX_ANALYTICS_PHASE,
      observability_phase: INTERNAL_OBSERVABILITY_PHASE,
      runtime_state_phase: INTERNAL_RUNTIME_STATE_PHASE,
      catalog_product_known: Boolean(getProductByKey(row.product_key)),
      sandbox_usage_matching_rows: sandboxRows.length,
    },
    audit_metadata: {
      rehearsal_only: true,
      gateway_phase: DEVELOPER_GATEWAY_SIMULATION_PHASE,
      seeded_case_key: row.case_key,
    },
    governance_context: {
      rehearsal_lane: "static_configuration",
      escalation_placeholder: false,
    },
    observability_context: {
      preview_execution_status_key: "planned",
      observability_phase: INTERNAL_OBSERVABILITY_PHASE,
    },
    runtime_state_context: {
      preview_snapshot_state: getRuntimeExecutionState("planned").key,
      runtime_phase: INTERNAL_RUNTIME_STATE_PHASE,
    },
  };

  const merged = { ...base, ...row.envelope_overrides };
  merged.credential_reference = CREDENTIAL_PLACEHOLDER_LABEL;
  return merged;
}

/**
 * @param {ReturnType<typeof buildGatewayEnvelope>} envelope
 * @param {(typeof GATEWAY_SIMULATION_CASES)[number]} caseRow
 */
export function buildGatewayAuditEnvelope(envelope, caseRow) {
  /** @type {Record<string, string>} */
  const preview = {};

  preview.audit_actor_class = "developer_app_rehearsal";
  preview.audit_app_subject = String(envelope.app_label ?? caseRow.app_label ?? "unknown_app");
  preview.audit_environment_stamp = String(envelope.environment ?? caseRow.environment);
  preview.audit_route_family = String(envelope.contract_key ?? caseRow.contract_key);
  preview.audit_policy_refs = String(envelope.auth_policy_key ?? caseRow.auth_policy_key);
  preview.audit_correlation_triple = `${envelope.request_id}|${envelope.correlation_id}|${envelope.trace_id}`;
  preview.audit_capability_refs = String(envelope.capability_key ?? caseRow.capability_key);
  preview.audit_rate_limit_tier = String(envelope.rate_limit_tier ?? caseRow.rate_limit_tier);
  preview.audit_gateway_phase_tag = DEVELOPER_GATEWAY_SIMULATION_PHASE;
  preview.audit_expected_outcome = caseRow.expected_outcome;

  for (const key of GATEWAY_AUDIT_ENVELOPE_FIELDS) {
    if (!preview[key]) {
      preview[key] = `${key}_placeholder`;
    }
  }

  return preview;
}

/**
 * @param {ReturnType<typeof buildGatewayEnvelope>} envelope
 */
export function buildGatewayCorrelationSummary(envelope) {
  const pieces = GATEWAY_CORRELATION_MODELS.map((m) => {
    const fields = m.propagated_fields.map((f) => `${f}:${envelope[f] ?? "unset"}`);
    return `${m.label} — ${fields.join(", ")}`;
  });
  return {
    bullets: pieces,
    text: pieces.join(" · "),
  };
}

/**
 * @param {string} tier_key
 */
export function buildGatewayRateLimitSummary(tier_key) {
  const model = GATEWAY_RATE_LIMIT_MODELS.find((m) => m.tier_key === tier_key);
  if (!model) {
    return `Unknown tier ${tier_key}`;
  }
  return `${model.label}: ${model.simulated_limit} calls / ${model.simulated_window} (${model.enforcement_status})`;
}

/**
 * @param {string} outcome_key
 */
export function buildGatewayRoutingOutcomeSummary(outcome_key) {
  const outcome = OUTCOME_MAP[outcome_key];
  if (!outcome) {
    return `Unknown routing outcome ${outcome_key}`;
  }
  return `${outcome.label} — ${outcome.developer_message}`;
}

/**
 * @param {string} caseKey
 * @param {GatewayEvalOptions | undefined} options
 */
export function evaluateGatewaySimulationCase(caseKey, options) {
  const row = getGatewaySimulationCase(caseKey);

  const emptyCounts = () => ({
    passed: 0,
    failed: 0,
    warning: 0,
    skipped: 0,
  });

  if (!row) {
    return {
      case: null,
      envelope: buildGatewayEnvelope("missing", options?.environment ?? "sandbox"),
      stage_trace: [],
      audit_envelope: {},
      correlation_summary: buildGatewayCorrelationSummary(buildGatewayEnvelope("missing", options?.environment ?? "sandbox")),
      rate_limit_summary: buildGatewayRateLimitSummary("sandbox_basic"),
      routing_outcome: OUTCOME_MAP["gateway.routing.reject_malformed_envelope"],
      counts: emptyCounts(),
      terminal_outcome: true,
      expected_outcome: "gateway.routing.reject_malformed_envelope",
      expected_outcome_resolved: "gateway.routing.reject_malformed_envelope",
      outcome_matches_expected: false,
      developer_message: OUTCOME_MAP["gateway.routing.reject_malformed_envelope"].developer_message,
      operator_summary: "Select a seeded case from GATEWAY_SIMULATION_CASES.",
      delegated_auth_evaluation: null,
      explanation: "Unknown gateway simulation case.",
    };
  }

  const effectiveEnv = options?.environment ?? row.environment;
  const authEvaluation = evaluateAuthSimulationCase(row.auth_case_key, {
    environment: effectiveEnv,
    traceOverrides: options?.authTraceOverrides,
  });

  const delegateExtras = authDelegateResult(authEvaluation);

  const envelope = buildGatewayEnvelope(row, effectiveEnv);

  const mergedGatewayStageOverrides = {
    ...(row.stage_overrides ?? {}),
    ...(options?.stageOverrides ?? {}),
  };
  const stageTrace = buildGatewayStageTrace(row, authEvaluation, mergedGatewayStageOverrides);

  /** @note Review flag after auth succeeds mechanically but delegated auth flagged review posture. */
  const forceReviewHeld =
    !stageTrace.some(
      (s) => s.stage_key === "auth_verification_simulated" && (s.result === "failed" || s.result === "skipped"),
    ) && delegateExtras.reviewFlag;

  let routingOutcome = resolveRoutingOutcomeSnapshot(stageTrace, authEvaluation, delegateExtras.reviewFlag, {
    forceReviewHeld,
  });

  /** When catalog succeeds but delegated auth flagged review-only posture with no failures. */
  if (forceReviewHeld && routingOutcome.outcome_key !== "gateway.routing.review_held_non_terminal") {
    routingOutcome = OUTCOME_MAP["gateway.routing.review_held_non_terminal"];
  }

  const counts = emptyCounts();
  for (const step of stageTrace) {
    if (step.result === "passed") counts.passed += 1;
    if (step.result === "failed") counts.failed += 1;
    if (step.result === "warning") counts.warning += 1;
    if (step.result === "skipped") counts.skipped += 1;
  }

  const expectedResolved = resolveExpectedOutcomeKey(row, effectiveEnv);

  /** Ensure capability denials prioritize explicit envelope even if heuristic mis-labeled. */
  if (authEvaluation.derived_outcome === "blocked" && row.expected_outcome === "gateway.routing.reject_capability_route") {
    routingOutcome = OUTCOME_MAP["gateway.routing.reject_capability_route"];
  }

  const auditEnvelope = buildGatewayAuditEnvelope(envelope, row);
  const correlationSummary = buildGatewayCorrelationSummary(envelope);
  const rateLimitSummary = buildGatewayRateLimitSummary(row.rate_limit_tier);

  const terminalOutcome = routingOutcome.terminal;

  return {
    case: row,
    envelope,
    stage_trace: stageTrace,
    audit_envelope: auditEnvelope,
    correlation_summary: correlationSummary,
    rate_limit_summary: rateLimitSummary,
    routing_outcome: routingOutcome,
    counts,
    terminal_outcome: terminalOutcome,
    expected_outcome: row.expected_outcome,
    expected_outcome_resolved: expectedResolved,
    outcome_matches_expected: routingOutcome.outcome_key === expectedResolved,
    developer_message: routingOutcome.developer_message,
    operator_summary: routingOutcome.operator_message,
    delegated_auth_evaluation: authEvaluation,
    explanation: row.explanation,
  };
}
