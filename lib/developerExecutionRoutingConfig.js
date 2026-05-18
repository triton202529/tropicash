/**
 * Tropicash Developer Platform — Phase 5D:
 * Execution routing & service orchestration simulation (modeling only).
 *
 * MODELING + SIMULATION ONLY. This module:
 *   • does NOT route real traffic, enqueue work, delegate to services, execute
 *     APIs, middleware, webhook dispatchers, or workers
 *   • does NOT move money or touch treasury, wallets, payouts, PayPal, or
 *     fraud execution subsystems
 *   • does NOT use Date.now(), Math.random(), fetch, Supabase, or storage
 *
 * Deterministic merges across Phase 5C gateway seeds, Phase 5B auth traces,
 * Phase 4D catalog keys, Phase 3A scenarios, and Phase 3B decision walks.
 */

import { evaluateAuthSimulationCase, getAuthSimulationCase } from "./developerAuthSimulationConfig";
import {
  evaluateGatewaySimulationCase,
  getGatewaySimulationCase,
} from "./developerGatewaySimulationConfig";
import { getProductByKey } from "./developerProductCatalogConfig";
import { getScenarioByKey } from "./executionScenarioConfig";
import { evaluateDecisionCase, getDecisionCaseByKey } from "./runtimeDecisionSimulatorConfig";

export const DEVELOPER_EXECUTION_ROUTING_PHASE = "phase_5d_execution_routing";

/** @typedef {'modeled' | 'planned' | 'future'} ExecutionRoutingDocStatus */
/** @typedef {'passed' | 'failed' | 'skipped' | 'warning'} ExecutionRoutingStageResult */
/** @typedef {{ stage_key: string, label: string, blocking: boolean, result: ExecutionRoutingStageResult, doc_status: ExecutionRoutingDocStatus }} ExecutionRoutingTraceRow */

/**
 * Twelve ordered surfaces from post-gateway receipt through simulated execution.
 * @type {ReadonlyArray<{
 *   stage_key: string,
 *   label: string,
 *   description: string,
 *   blocking_by_default: boolean,
 *   status: ExecutionRoutingDocStatus,
 * }>}
 */
export const EXECUTION_ROUTING_STAGES = [
  {
    stage_key: "gateway_result_received",
    label: "Gateway result received",
    description:
      "Execution router ingests the Phase 5C routing snapshot and correlation triple without mutating live edges.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "routing_context_normalized",
    label: "Routing context normalized",
    description:
      "Declared environment, product, contract, and capability keys are aligned with catalog posture for orchestration handoff.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "catalog_service_resolution",
    label: "Catalog service resolution",
    description:
      "Maps the route class to a sandbox execution family and shortlists eligible delegate targets (configuration only).",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "capability_projection_check",
    label: "Capability projection check",
    description:
      "Ensures the projected capability scope matches the contract row before any simulated service binding.",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "orchestration_delegate_selected",
    label: "Orchestration delegate selected",
    description:
      "Chooses a single sandbox execution target from EXECUTION_SERVICE_TARGETS for narrative delegation.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "dependency_graph_materialized",
    label: "Dependency graph materialized",
    description:
      "Expands EXECUTION_DEPENDENCY_TYPES keys into a deterministic chain with blocking hints for teaching.",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "simulation_workspace_bound",
    label: "Simulation workspace bound",
    description:
      "Pins the request to the Phase 3A scenario workspace and Phase 3B decision slice without persisting runs.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "delegation_plan_signed_off",
    label: "Delegation plan signed off",
    description:
      "Static sign-off that the delegation plan is internally consistent with gateway and auth traces.",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "reconciliation_posture_locked",
    label: "Reconciliation posture locked",
    description:
      "Selects a reconciliation posture label for downstream audit storytelling (no reconciliation I/O).",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "operator_review_surface_evaluated",
    label: "Operator review surface evaluated",
    description:
      "Non-terminal review interstitial when review_required or manual_intervention flags are present.",
    blocking_by_default: false,
    status: "planned",
  },
  {
    stage_key: "simulated_service_invocation_placeholder",
    label: "Simulated service invocation (placeholder)",
    description:
      "Placeholder stage narrating a sandbox-only adapter call — no sockets, queues, or workers.",
    blocking_by_default: true,
    status: "future",
  },
  {
    stage_key: "simulated_execution_result",
    label: "Simulated execution result",
    description:
      "Materializes a terminal or intentionally non-terminal simulation outcome consistent with Phase 3A final_state vocabulary.",
    blocking_by_default: true,
    status: "modeled",
  },
];

/**
 * Ten illustrative sandbox delegate targets (names are narrative only).
 * @type {ReadonlyArray<{
 *   target_key: string,
 *   label: string,
 *   service_family: string,
 *   environment: string,
 *   supported_capabilities: ReadonlyArray<string>,
 *   orchestration_states: ReadonlyArray<string>,
 *   risk_level: string,
 *   description: string,
 *   status: ExecutionRoutingDocStatus,
 * }>}
 */
export const EXECUTION_SERVICE_TARGETS = [
  {
    target_key: "sandbox_wallet_simulator",
    label: "Sandbox wallet simulator",
    service_family: "tropicash_sandbox",
    environment: "sandbox",
    supported_capabilities: ["wallet.read", "wallet.reserve", "wallet.transfer"],
    orchestration_states: ["delegate_bound", "simulation_workspace_ready", "simulation_executed"],
    risk_level: "low",
    description: "Deterministic wallet-shaped simulations aligned with Phase 3A wallet scenarios.",
    status: "modeled",
  },
  {
    target_key: "sandbox_transfer_simulator",
    label: "Sandbox transfer simulator",
    service_family: "tropicash_sandbox",
    environment: "sandbox",
    supported_capabilities: ["wallet.transfer", "wallet.reserve"],
    orchestration_states: ["delegate_bound", "dependency_verified", "simulation_executed"],
    risk_level: "medium",
    description: "Transfer rehearsal target for mutating sandbox contracts with idempotency storytelling.",
    status: "modeled",
  },
  {
    target_key: "sandbox_payout_preview",
    label: "Sandbox payout preview",
    service_family: "tropicash_sandbox",
    environment: "sandbox",
    supported_capabilities: ["wallet.withdraw", "payment.capture"],
    orchestration_states: ["review_interstitial", "reconciliation_bind", "simulation_executed"],
    risk_level: "high",
    description: "Operator-facing payout preview lane — always narrated, never executed here.",
    status: "planned",
  },
  {
    target_key: "sandbox_review_queue",
    label: "Sandbox review queue (narrative)",
    service_family: "tropicash_governance",
    environment: "sandbox",
    supported_capabilities: ["payment.capture", "wallet.transfer", "wallet.withdraw"],
    orchestration_states: ["review_interstitial", "terminal_blocked"],
    risk_level: "medium",
    description: "Holds requests that require human review before simulated execution continues.",
    status: "planned",
  },
  {
    target_key: "sandbox_settlement_preview",
    label: "Sandbox settlement preview",
    service_family: "platform_merchant",
    environment: "sandbox",
    supported_capabilities: ["merchant.settlement"],
    orchestration_states: ["delegate_bound", "delayed_downstream", "reconciliation_bind"],
    risk_level: "medium",
    description: "Merchant settlement deferral narratives without contacting partner ledgers.",
    status: "planned",
  },
  {
    target_key: "triton_bridge_preview",
    label: "Triton bridge preview",
    service_family: "blue_atlantic_triton",
    environment: "sandbox",
    supported_capabilities: ["integration.reconcile", "trading.profit_withdraw"],
    orchestration_states: ["dependency_verified", "delegate_bound", "simulation_executed"],
    risk_level: "medium",
    description: "Cross-platform bridge preview for integration sync scenarios (architecture-only).",
    status: "planned",
  },
  {
    target_key: "sentinel_reporting_preview",
    label: "Sentinel reporting preview",
    service_family: "blue_atlantic_sentinel",
    environment: "sandbox",
    supported_capabilities: ["wallet.payment", "audit.reporting_preview"],
    orchestration_states: ["review_interstitial", "reconciliation_bind"],
    risk_level: "high",
    description: "Fraud-adjacent signal rehearsal surface — emits documentation rows only.",
    status: "future",
  },
  {
    target_key: "elitehire_payment_preview",
    label: "EliteHire payment preview",
    service_family: "blue_atlantic_elitehire",
    environment: "sandbox",
    supported_capabilities: ["merchant.settlement", "payment.create"],
    orchestration_states: ["delegate_bound", "review_interstitial"],
    risk_level: "high",
    description: "Commerce partner rehearsal lane gated for elevated review classes.",
    status: "planned",
  },
  {
    target_key: "audit_finalization_preview",
    label: "Audit finalization preview",
    service_family: "tropicash_audit",
    environment: "sandbox",
    supported_capabilities: ["audit.append_only_preview"],
    orchestration_states: ["reconciliation_bind", "terminal_success"],
    risk_level: "low",
    description: "Binds deterministic audit payloads after simulated execution resolves.",
    status: "planned",
  },
  {
    target_key: "manual_intervention_preview",
    label: "Manual intervention preview",
    service_family: "tropicash_operations",
    environment: "sandbox",
    supported_capabilities: ["wallet.withdraw", "payment.capture"],
    orchestration_states: ["review_interstitial", "terminal_blocked"],
    risk_level: "critical",
    description: "Operator-led intervention placeholder when manual gates are scripted for a case.",
    status: "future",
  },
];

/**
 * @type {ReadonlyArray<{
 *   state_key: string,
 *   label: string,
 *   category: string,
 *   terminal: boolean,
 *   description: string,
 * }>}
 */
export const EXECUTION_ORCHESTRATION_STATES = [
  {
    state_key: "routing_ingress",
    label: "Routing ingress",
    category: "ingress",
    terminal: false,
    description: "Post-gateway envelope is accepted into the execution routing narrative.",
  },
  {
    state_key: "delegate_bound",
    label: "Delegate bound",
    category: "delegation",
    terminal: false,
    description: "A sandbox execution target is bound for storytelling.",
  },
  {
    state_key: "dependency_verified",
    label: "Dependency verified (simulated)",
    category: "dependency",
    terminal: false,
    description: "Static dependency chain rows are consistent with the selected case.",
  },
  {
    state_key: "simulation_workspace_ready",
    label: "Simulation workspace ready",
    category: "simulation",
    terminal: false,
    description: "Phase 3A scenario metadata is attached to the routing envelope.",
  },
  {
    state_key: "review_interstitial",
    label: "Review interstitial",
    category: "review",
    terminal: false,
    description: "Paused for review before simulated execution continues.",
  },
  {
    state_key: "delayed_downstream",
    label: "Delayed downstream",
    category: "deferral",
    terminal: false,
    description: "Downstream completion is intentionally deferred without failing the envelope.",
  },
  {
    state_key: "reconciliation_bind",
    label: "Reconciliation bind",
    category: "reconciliation",
    terminal: false,
    description: "Reconciliation posture is locked for audit narration.",
  },
  {
    state_key: "simulation_executed",
    label: "Simulation executed",
    category: "simulation",
    terminal: false,
    description: "Placeholder completion of the simulated adapter invocation stage.",
  },
  {
    state_key: "terminal_success",
    label: "Terminal success",
    category: "termination",
    terminal: true,
    description: "Simulated execution reached a success terminal consistent with the scenario.",
  },
  {
    state_key: "terminal_blocked",
    label: "Terminal blocked",
    category: "termination",
    terminal: true,
    description: "Simulated execution cannot proceed — gateway, dependency, or policy posture blocks delegation.",
  },
];

/**
 * @type {ReadonlyArray<{
 *   outcome_key: string,
 *   label: string,
 *   category: string,
 *   terminal: boolean,
 *   developer_message: string,
 *   operator_message: string,
 * }>}
 */
export const EXECUTION_ROUTING_OUTCOMES = [
  {
    outcome_key: "execution_routing.delegate_success",
    label: "Delegate success",
    category: "success",
    terminal: true,
    developer_message: "Gateway and auth traces clear; the sandbox delegate returns a successful simulated execution.",
    operator_message: "Case closed in simulation — verify catalog keys match the intended rehearsal path.",
  },
  {
    outcome_key: "execution_routing.delegate_preview_continue",
    label: "Delegate preview continues with warnings",
    category: "success",
    terminal: false,
    developer_message:
      "Gateway accepted with a non-terminal warning surface; execution routing continues into sandbox simulation.",
    operator_message: "Expect degraded-warning style handoffs — monitor paired observability docs only.",
  },
  {
    outcome_key: "execution_routing.gateway_surface_blocked",
    label: "Blocked at gateway surface",
    category: "block",
    terminal: true,
    developer_message: "Phase 5C routing outcome is terminal — execution delegation does not proceed.",
    operator_message: "Repair the gateway/auth seed alignment before expecting any downstream delegate story.",
  },
  {
    outcome_key: "execution_routing.review_required_hold",
    label: "Review required hold",
    category: "review",
    terminal: false,
    developer_message: "Routing pauses for review while still narrating a coherent delegate plan.",
    operator_message: "Treat as an intentional interstitial — pair with Phase 3B for policy explanations.",
  },
  {
    outcome_key: "execution_routing.manual_intervention_hold",
    label: "Manual intervention hold",
    category: "review",
    terminal: false,
    developer_message: "Manual intervention is scripted for this case before simulated execution may finish.",
    operator_message: "Operator lane preview only — no tickets, queues, or escalations are created.",
  },
  {
    outcome_key: "execution_routing.delayed_downstream",
    label: "Delayed downstream simulated",
    category: "deferral",
    terminal: false,
    developer_message: "Delegation succeeds but simulated completion is deferred per the Phase 3A scenario.",
    operator_message: "Use for settlement-delay narratives — not a retryable infrastructure failure.",
  },
  {
    outcome_key: "execution_routing.dependency_blocked",
    label: "Dependency blocked",
    category: "block",
    terminal: true,
    developer_message:
      "An execution dependency in the scripted chain prevents binding the delegate or finishing simulation.",
    operator_message: "Inspect dependency_chain rows and Phase 3B dependency_missing parallels.",
  },
  {
    outcome_key: "execution_routing.simulation_failed_terminal",
    label: "Simulated terminal failure",
    category: "block",
    terminal: true,
    developer_message:
      "Delegation bound, but simulated execution resolves to a failed or blocked scenario terminal.",
    operator_message: "Compare scenario final_state with routing trace for staged failure drills.",
  },
  {
    outcome_key: "execution_routing.no_route_projection",
    label: "No route projection available",
    category: "block",
    terminal: true,
    developer_message: "Catalog or scope posture prevents forming a delegate projection for this envelope.",
    operator_message: "Often mirrors internal partner scope blocks or missing catalog alignment.",
  },
];

/**
 * @type {ReadonlyArray<{
 *   dependency_key: string,
 *   label: string,
 *   blocking: boolean,
 *   description: string,
 * }>}
 */
export const EXECUTION_DEPENDENCY_TYPES = [
  {
    dependency_key: "dep_gateway_acceptance",
    label: "Gateway acceptance",
    blocking: true,
    description: "Requires a non-terminal Phase 5C routing posture that allows orchestration handoff.",
  },
  {
    dependency_key: "dep_auth_posture",
    label: "Authentication posture",
    blocking: true,
    description: "Phase 5B derived outcome must not be a terminal failure for delegation drills.",
  },
  {
    dependency_key: "dep_product_contract_row",
    label: "Product / contract row",
    blocking: true,
    description: "Phase 4D catalog keys on the envelope must resolve to a consistent product and contract.",
  },
  {
    dependency_key: "dep_capability_projection",
    label: "Capability projection",
    blocking: true,
    description: "Capability key must project to the orchestration scope expected by the route class.",
  },
  {
    dependency_key: "dep_scenario_binding",
    label: "Scenario binding",
    blocking: true,
    description: "Phase 3A scenario metadata must be present for simulation workspace binding.",
  },
  {
    dependency_key: "dep_decision_slice",
    label: "Decision slice",
    blocking: false,
    description: "Phase 3B decision evaluation adds explanatory weight but is not always blocking in this preview.",
  },
  {
    dependency_key: "dep_sandbox_surface",
    label: "Sandbox surface",
    blocking: true,
    description: "Sandbox-only simulations refuse live-lane projections in this teaching module.",
  },
  {
    dependency_key: "dep_integration_peer",
    label: "Integration peer readiness (narrative)",
    blocking: false,
    description: "Blue Atlantic peer connectors are described as ready without network checks.",
  },
  {
    dependency_key: "dep_operator_review_lane",
    label: "Operator review lane",
    blocking: false,
    description: "When present, operator review can pause progression without failing earlier dependencies.",
  },
];

/**
 * @type {ReadonlyArray<{
 *   reconciliation_key: string,
 *   label: string,
 *   description: string,
 * }>}
 */
export const EXECUTION_RECONCILIATION_STATES = [
  {
    reconciliation_key: "recon_uninitialized",
    label: "Uninitialized",
    description: "No reconciliation posture has been selected for the routing envelope.",
  },
  {
    reconciliation_key: "recon_preview_only",
    label: "Preview only",
    description: "Reconciliation fields are documentation placeholders only.",
  },
  {
    reconciliation_key: "recon_pending_manual_match",
    label: "Pending manual match",
    description: "Operator matching is scripted but not executed in this simulator.",
  },
  {
    reconciliation_key: "recon_simulated_aligned",
    label: "Simulated alignment",
    description: "Downstream reconciliation is narrated as aligned with the simulated execution result.",
  },
  {
    reconciliation_key: "recon_exception_narrative",
    label: "Exception narrative",
    description: "Holds reconciliation exceptions as text-only storytelling for escalation drills.",
  },
];

export const EXECUTION_ROUTING_SIMULATION_SAFETY_RULES = [
  "Phase 5D is execution routing choreography only — it never invokes services, adapters, queues, workers, middleware, TLS edges, storage, Supabase, or live HTTP.",
  "evaluateExecutionRoutingCase stays deterministic — no Date.now, Math.random, or network identifiers beyond static seed placeholders.",
  "Gateway evaluation is optional (`simulateGateway: false`) yet still reads only static Phase 5C seeds when enabled.",
  "Service target names resemble future Blue Atlantic families but expose no connectors, URLs, endpoints, secrets, credentials, treasury paths, payouts, wallets, crypto, fraud execution, PayPal integrations, or money movement.",
  "Reconciliation, review, delayed, blocked, dependency, and delegation rows are authoring-only — operators cannot take action inside this simulator.",
];

/** Hard-stop gateway routing keys that prevent execution delegation in Phase 5D. */
export const GATEWAY_HARD_STOP_KEYS = /** @type {const} */ ([
  "gateway.routing.reject_malformed_envelope",
  "gateway.routing.reject_authentication_simulation",
  "gateway.routing.reject_environment_isolation",
  "gateway.routing.reject_capability_route",
  "gateway.routing.reject_governance_surface",
  "gateway.routing.throttled_budget_preview",
  "gateway.routing.internal_partner_scope_block",
]);

/**
 * @type {ReadonlyArray<{
 *   case_key: string,
 *   title: string,
 *   gateway_case_key: string,
 *   auth_case_key: string,
 *   scenario_key: string,
 *   decision_case_key: string,
 *   product_key: string,
 *   contract_key: string,
 *   capability_key: string,
 *   environment: string,
 *   selected_service_target: string,
 *   expected_outcome: string,
 *   orchestration_state_path: ReadonlyArray<string>,
 *   dependency_keys: ReadonlyArray<string>,
 *   reconciliation_state: string,
 *   review_required: boolean,
 *   manual_intervention_required: boolean,
 *   explanation: string,
 * }>}
 */
export const EXECUTION_ROUTING_CASES = [
  {
    case_key: "routing.wallet.preview.success",
    title: "Wallet preview routing — delegated success",
    gateway_case_key: "gateway.wallet.preview.success",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    scenario_key: "wallet.transfer.success",
    decision_case_key: "wallet.transfer.success",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    selected_service_target: "sandbox_wallet_simulator",
    expected_outcome: "execution_routing.delegate_success",
    orchestration_state_path: [
      "routing_ingress",
      "delegate_bound",
      "dependency_verified",
      "simulation_workspace_ready",
      "simulation_executed",
      "reconciliation_bind",
      "terminal_success",
    ],
    dependency_keys: [
      "dep_gateway_acceptance",
      "dep_auth_posture",
      "dep_product_contract_row",
      "dep_capability_projection",
      "dep_scenario_binding",
      "dep_decision_slice",
      "dep_sandbox_surface",
    ],
    reconciliation_state: "recon_simulated_aligned",
    review_required: false,
    manual_intervention_required: false,
    explanation:
      "Happy-path wallet read preview: Phase 5C accepts, Phase 5B clears, and the router binds the sandbox wallet simulator with a completed Phase 3A scenario.",
  },
  {
    case_key: "routing.transfer.simulate.success",
    title: "Transfer simulation routing — warning-tolerant success",
    gateway_case_key: "gateway.sandbox.preview.rate_budget_warning",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    scenario_key: "wallet.transfer.success",
    decision_case_key: "wallet.transfer.success",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    selected_service_target: "sandbox_transfer_simulator",
    expected_outcome: "execution_routing.delegate_preview_continue",
    orchestration_state_path: [
      "routing_ingress",
      "delegate_bound",
      "dependency_verified",
      "simulation_workspace_ready",
      "simulation_executed",
      "terminal_success",
    ],
    dependency_keys: [
      "dep_gateway_acceptance",
      "dep_auth_posture",
      "dep_product_contract_row",
      "dep_capability_projection",
      "dep_scenario_binding",
      "dep_decision_slice",
    ],
    reconciliation_state: "recon_preview_only",
    review_required: false,
    manual_intervention_required: false,
    explanation:
      "Gateway continues with a rate-limit warning surface while still handing off to the transfer simulator — teaches degraded-but-successful orchestration routing.",
  },
  {
    case_key: "routing.transfer.review_required",
    title: "Transfer routing — review interstitial",
    gateway_case_key: "gateway.payment.preview.review_branch",
    auth_case_key: "auth_case_capture_review_hold",
    scenario_key: "wallet.transfer.review_required",
    decision_case_key: "wallet.transfer.review_required",
    product_key: "prod_payment_capture_review",
    contract_key: "sc_payment_capture_review",
    capability_key: "payment.capture",
    environment: "sandbox",
    selected_service_target: "sandbox_review_queue",
    expected_outcome: "execution_routing.review_required_hold",
    orchestration_state_path: [
      "routing_ingress",
      "delegate_bound",
      "review_interstitial",
      "reconciliation_bind",
    ],
    dependency_keys: [
      "dep_gateway_acceptance",
      "dep_auth_posture",
      "dep_product_contract_row",
      "dep_capability_projection",
      "dep_scenario_binding",
      "dep_decision_slice",
      "dep_operator_review_lane",
    ],
    reconciliation_state: "recon_pending_manual_match",
    review_required: true,
    manual_intervention_required: false,
    explanation:
      "Gateway models a non-terminal review hold; execution routing binds the review queue target and pauses before simulated completion.",
  },
  {
    case_key: "routing.transfer.missing_capability",
    title: "Transfer routing — capability projection blocked",
    gateway_case_key: "gateway.checkout.preview.capability_denied",
    auth_case_key: "auth_case_checkout_missing_payment_capability",
    scenario_key: "orchestration.stage.retryable_failure",
    decision_case_key: "orchestration.stage.retryable_failure",
    product_key: "prod_checkout_session",
    contract_key: "sc_checkout_session_create",
    capability_key: "payment.create",
    environment: "sandbox",
    selected_service_target: "sandbox_transfer_simulator",
    expected_outcome: "execution_routing.gateway_surface_blocked",
    orchestration_state_path: ["routing_ingress", "terminal_blocked"],
    dependency_keys: [
      "dep_gateway_acceptance",
      "dep_auth_posture",
      "dep_capability_projection",
      "dep_product_contract_row",
    ],
    reconciliation_state: "recon_exception_narrative",
    review_required: false,
    manual_intervention_required: false,
    explanation:
      "Capability authorization fails at the gateway; execution routing cannot bind a safe delegate — pairs with checkout denial seeds and a dependency-flavored Phase 3A scenario.",
  },
  {
    case_key: "routing.settlement.delayed",
    title: "Settlement routing — delayed downstream",
    gateway_case_key: "gateway.wallet.preview.success",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    scenario_key: "merchant.settlement.delayed",
    decision_case_key: "merchant.settlement.delayed",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    selected_service_target: "sandbox_settlement_preview",
    expected_outcome: "execution_routing.delayed_downstream",
    orchestration_state_path: [
      "routing_ingress",
      "delegate_bound",
      "simulation_workspace_ready",
      "delayed_downstream",
      "reconciliation_bind",
    ],
    dependency_keys: [
      "dep_gateway_acceptance",
      "dep_auth_posture",
      "dep_product_contract_row",
      "dep_scenario_binding",
      "dep_decision_slice",
      "dep_integration_peer",
    ],
    reconciliation_state: "recon_pending_manual_match",
    review_required: false,
    manual_intervention_required: false,
    explanation:
      "Clean gateway posture with a merchant settlement scenario that intentionally defers completion — routing shows delay without hard failure.",
  },
  {
    case_key: "routing.payout.manual_review",
    title: "Payout routing — manual intervention preview",
    gateway_case_key: "gateway.wallet.preview.replay_blocked",
    auth_case_key: "auth_case_replay_nonce_conflict",
    scenario_key: "withdrawal.pending_review",
    decision_case_key: "withdrawal.pending_review",
    product_key: "prod_wallet_reserve_sim",
    contract_key: "sc_wallet_reserve_cycle",
    capability_key: "wallet.reserve",
    environment: "sandbox",
    selected_service_target: "manual_intervention_preview",
    expected_outcome: "execution_routing.manual_intervention_hold",
    orchestration_state_path: ["routing_ingress", "review_interstitial", "terminal_blocked"],
    dependency_keys: [
      "dep_gateway_acceptance",
      "dep_auth_posture",
      "dep_product_contract_row",
      "dep_operator_review_lane",
      "dep_scenario_binding",
    ],
    reconciliation_state: "recon_pending_manual_match",
    review_required: true,
    manual_intervention_required: true,
    explanation:
      "Gateway rejects replayed authentication posture while the scenario still narrates payout review — execution routing highlights manual intervention previews only.",
  },
  {
    case_key: "routing.triton.bridge.preview",
    title: "Triton bridge routing — integration sync preview",
    gateway_case_key: "gateway.wallet.preview.live_environment_drill",
    auth_case_key: "auth_case_live_eval_on_sandbox_credential",
    scenario_key: "integration.sync.completed",
    decision_case_key: "integration.sync.completed",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    selected_service_target: "triton_bridge_preview",
    expected_outcome: "execution_routing.delegate_success",
    orchestration_state_path: [
      "routing_ingress",
      "delegate_bound",
      "dependency_verified",
      "simulation_workspace_ready",
      "simulation_executed",
      "terminal_success",
    ],
    dependency_keys: [
      "dep_gateway_acceptance",
      "dep_auth_posture",
      "dep_product_contract_row",
      "dep_scenario_binding",
      "dep_integration_peer",
      "dep_decision_slice",
    ],
    reconciliation_state: "recon_simulated_aligned",
    review_required: false,
    manual_intervention_required: false,
    explanation:
      "Uses the live-environment drill gateway case with sandbox evaluation so routing can still succeed while teaching envelope-label risk; binds the Triton bridge preview target to an integration sync scenario.",
  },
  {
    case_key: "routing.sentinel.reporting.preview",
    title: "Sentinel reporting routing — fraud signal review",
    gateway_case_key: "gateway.governance.preview.hard_gate",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    scenario_key: "fraud.signal.escalated",
    decision_case_key: "fraud.signal.escalated",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    selected_service_target: "sentinel_reporting_preview",
    expected_outcome: "execution_routing.simulation_failed_terminal",
    orchestration_state_path: ["routing_ingress", "terminal_blocked"],
    dependency_keys: [
      "dep_gateway_acceptance",
      "dep_auth_posture",
      "dep_product_contract_row",
      "dep_scenario_binding",
      "dep_decision_slice",
    ],
    reconciliation_state: "recon_exception_narrative",
    review_required: true,
    manual_intervention_required: false,
    explanation:
      "Governance gate fails at Phase 5C while the Sentinel-tinged fraud scenario explains review escalation — routing terminates before delegate execution completes.",
  },
  {
    case_key: "routing.elitehire.payment.preview",
    title: "EliteHire payment routing — partner profit payout review",
    gateway_case_key: "gateway.partner.preview.internal_scope_block",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    scenario_key: "trading.profit_payout",
    decision_case_key: "trading.profit_payout",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    selected_service_target: "elitehire_payment_preview",
    expected_outcome: "execution_routing.no_route_projection",
    orchestration_state_path: ["routing_ingress", "terminal_blocked"],
    dependency_keys: [
      "dep_gateway_acceptance",
      "dep_product_contract_row",
      "dep_capability_projection",
      "dep_integration_peer",
    ],
    reconciliation_state: "recon_preview_only",
    review_required: false,
    manual_intervention_required: false,
    explanation:
      "Partner internal scope contradiction blocks catalog route binding — no EliteHire delegate projection is formed even though the trading scenario explains partner payout posture.",
  },
  {
    case_key: "routing.gateway.no_route_available",
    title: "Gateway routing exhaustion — no execution projection",
    gateway_case_key: "gateway.rate_limit.preview.budget_exceeded",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    scenario_key: "api.request.rate_limited",
    decision_case_key: "api.request.rate_limited",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    environment: "sandbox",
    selected_service_target: "sandbox_wallet_simulator",
    expected_outcome: "execution_routing.gateway_surface_blocked",
    orchestration_state_path: ["routing_ingress", "terminal_blocked"],
    dependency_keys: ["dep_gateway_acceptance", "dep_auth_posture", "dep_product_contract_row"],
    reconciliation_state: "recon_uninitialized",
    review_required: false,
    manual_intervention_required: false,
    explanation:
      "Throttle surface stops the gateway before orchestration — execution routing never receives a bindable delegate, mirroring hard-stop traffic shaping narratives.",
  },
];

const ROUTING_OUTCOME_MAP = Object.fromEntries(
  EXECUTION_ROUTING_OUTCOMES.map((o) => [o.outcome_key, o]),
);

const SERVICE_TARGET_MAP = Object.fromEntries(
  EXECUTION_SERVICE_TARGETS.map((t) => [t.target_key, t]),
);

const DEPENDENCY_MAP = Object.fromEntries(
  EXECUTION_DEPENDENCY_TYPES.map((d) => [d.dependency_key, d]),
);

const RECON_MAP = Object.fromEntries(
  EXECUTION_RECONCILIATION_STATES.map((r) => [r.reconciliation_key, r]),
);

/** @returns {boolean} */export function gatewayOutcomeIsHardStop(outcome_key) {
  return GATEWAY_HARD_STOP_KEYS.some((k) => k === outcome_key);
}

/**
 * @param {string | null | undefined} outcomeKey
 * @param {'sandbox' | 'live' | string} env
 */
function gatewayAcceptsDelegation(env, gatewayEvaluation) {
  if (!gatewayEvaluation?.routing_outcome) return false;
  const key = gatewayEvaluation.routing_outcome.outcome_key;
  if (key === "gateway.routing.reject_environment_isolation") return false;
  if (key === "gateway.routing.accept_preview") return true;
  if (key === "gateway.routing.review_held_non_terminal") return true;
  if (key === "gateway.routing.degraded_warning_continue") return true;
  if (key === "gateway.routing.throttled_budget_preview") return false;

  /** Live drill case can still accept sandbox label. */
  if (gatewayEvaluation.case?.case_key === "gateway.wallet.preview.live_environment_drill" && env !== "live") {
    return key === "gateway.routing.accept_preview";
  }

  return !gatewayOutcomeIsHardStop(key);
}

/**
 * Resolve final execution routing outcome object from seeded case expectation plus gateway/auth/decision posture.
 *
 * @param {{
 *   case_key: string,
 *   expected_outcome: string,
 *   review_required: boolean,
 *   manual_intervention_required: boolean,
 * }} caseRow
 * @param {{ routing_outcome?: { outcome_key: string }, terminal_outcome?: boolean, case?: { case_key?: string } | null } | null} gatewayEvaluation
 * @param {{ terminal_failure?: boolean } | null} authEvaluation
 * @param {{ final_outcome?: string } | null | undefined} decisionEvaluation
 */
function resolveRoutingOutcome(caseRow, gatewayEvaluation, authEvaluation, decisionEvaluation, env) {
  let outcomeKey = caseRow.expected_outcome;
  const gwKey = gatewayEvaluation?.routing_outcome?.outcome_key ?? "";

  if (caseRow.manual_intervention_required) {
    outcomeKey = "execution_routing.manual_intervention_hold";
    return ROUTING_OUTCOME_MAP[outcomeKey];
  }

  if (caseRow.case_key === "routing.sentinel.reporting.preview" && gwKey && gatewayOutcomeIsHardStop(gwKey)) {
    outcomeKey = "execution_routing.simulation_failed_terminal";
    return ROUTING_OUTCOME_MAP[outcomeKey];
  }

  if (gwKey === "gateway.routing.internal_partner_scope_block") {
    outcomeKey = "execution_routing.no_route_projection";
    return ROUTING_OUTCOME_MAP[outcomeKey];
  }

  if (
    gatewayEvaluation &&
    gwKey &&
    gatewayOutcomeIsHardStop(gwKey) &&
    !gatewayAcceptsDelegation(env, gatewayEvaluation)
  ) {
    outcomeKey = "execution_routing.gateway_surface_blocked";
    return ROUTING_OUTCOME_MAP[outcomeKey];
  }

  const decisionOutcome = decisionEvaluation?.final_outcome;

  if (authEvaluation?.terminal_failure) {
    outcomeKey = "execution_routing.gateway_surface_blocked";
  } else if (
    decisionOutcome === "dependency_missing" &&
    gwKey &&
    gatewayAcceptsDelegation(env, gatewayEvaluation)
  ) {
    outcomeKey = "execution_routing.dependency_blocked";
  } else if (decisionOutcome === "blocked" && gwKey && gatewayAcceptsDelegation(env, gatewayEvaluation)) {
    outcomeKey = "execution_routing.dependency_blocked";
  } else if (decisionOutcome === "review_required" && caseRow.review_required) {
    outcomeKey = "execution_routing.review_required_hold";
  } else if (decisionOutcome === "delayed") {
    outcomeKey = "execution_routing.delayed_downstream";
  }

  const meta =
    ROUTING_OUTCOME_MAP[outcomeKey] ?? ROUTING_OUTCOME_MAP.execution_routing.gateway_surface_blocked;
  return meta;
}

/**
 * @param {ReturnType<typeof resolveRoutingOutcome>} routingOutcomeMeta
 * @param {boolean} gatewayHardStop
 * @param {boolean} authTerminal
 * @param {(typeof EXECUTION_ROUTING_CASES)[number]} caseRow
 * @param {ReturnType<typeof evaluateDecisionCase> | null} decisionEvaluation
 */
function buildRoutingTraceRows(routingOutcomeMeta, gatewayHardStop, authTerminal, caseRow, decisionEvaluation) {
  /** @type {ExecutionRoutingTraceRow[]} */
  const results = [];
  let skipRest = false;

  const push = (stageKey, /** @type {ExecutionRoutingStageResult} */ res) => {
    const meta = EXECUTION_ROUTING_STAGES.find((s) => s.stage_key === stageKey);
    if (!meta) return;
    let r = res;
    if (skipRest && meta.blocking_by_default) {
      r = "skipped";
    }
    results.push({
      stage_key: stageKey,
      label: meta.label,
      blocking: meta.blocking_by_default,
      result: r,
      doc_status: meta.status,
    });
    if (meta.blocking_by_default && r === "failed") {
      skipRest = true;
    }
  };

  push("gateway_result_received", gatewayHardStop ? "failed" : "passed");
  push("routing_context_normalized", gatewayHardStop || authTerminal ? "failed" : "passed");
  push("catalog_service_resolution", routingOutcomeMeta.outcome_key === "execution_routing.no_route_projection" ? "failed" : "passed");
  push(
    "capability_projection_check",
    caseRow.case_key === "routing.transfer.missing_capability" || routingOutcomeMeta.outcome_key === "execution_routing.no_route_projection"
      ? "failed"
      : "passed",
  );

  push(
    "orchestration_delegate_selected",
    [
      "execution_routing.gateway_surface_blocked",
      "execution_routing.no_route_projection",
      "execution_routing.simulation_failed_terminal",
    ].includes(routingOutcomeMeta.outcome_key)
      ? "failed"
      : "passed",
  );

  push(
    "dependency_graph_materialized",
    routingOutcomeMeta.outcome_key === "execution_routing.dependency_blocked" ? "failed" : "passed",
  );

  push(
    "simulation_workspace_bound",
    gatewayHardStop || routingOutcomeMeta.outcome_key === "execution_routing.no_route_projection"
      ? "failed"
      : "passed",
  );

  push(
    "delegation_plan_signed_off",
    ["execution_routing.delegate_success", "execution_routing.delegate_preview_continue"].includes(routingOutcomeMeta.outcome_key)
      ? "passed"
      : routingOutcomeMeta.category === "review" || routingOutcomeMeta.category === "deferral"
        ? "warning"
        : "failed",
  );

  push(
    "reconciliation_posture_locked",
    routingOutcomeMeta.terminal && routingOutcomeMeta.category === "block" ? "failed" : "passed",
  );

  const reviewIsh =
    routingOutcomeMeta.outcome_key.includes("review") ||
    routingOutcomeMeta.outcome_key.includes("manual") ||
    Boolean(decisionEvaluation?.final_outcome === "review_required");
  push("operator_review_surface_evaluated", reviewIsh ? "warning" : "passed");

  push(
    "simulated_service_invocation_placeholder",
    ["execution_routing.delegate_success", "execution_routing.delegate_preview_continue", "execution_routing.delayed_downstream"].includes(
      routingOutcomeMeta.outcome_key,
    )
      ? "passed"
      : reviewIsh
        ? "skipped"
        : "failed",
  );

  const simResult =
    routingOutcomeMeta.outcome_key === "execution_routing.delegate_success" ||
    routingOutcomeMeta.outcome_key === "execution_routing.delegate_preview_continue"
      ? "passed"
      : routingOutcomeMeta.category === "deferral"
        ? "warning"
        : "failed";

  push("simulated_execution_result", simResult);

  return results;
}

function countStageResults(rows) {
  const counts = { passed: 0, failed: 0, warning: 0, skipped: 0 };
  for (const r of rows) {
    if (r.result === "passed") counts.passed += 1;
    if (r.result === "failed") counts.failed += 1;
    if (r.result === "warning") counts.warning += 1;
    if (r.result === "skipped") counts.skipped += 1;
  }
  return counts;
}

/**
 * @param {string} caseKey
 */
export function getExecutionRoutingCase(caseKey) {
  return EXECUTION_ROUTING_CASES.find((c) => c.case_key === caseKey) ?? null;
}

/**
 * @param {string} targetKey
 */
export function getServiceTarget(targetKey) {
  return SERVICE_TARGET_MAP[targetKey] ?? null;
}

/**
 * Deterministic merge of gateway envelope, catalog, scenario, and routing phase anchors.
 *
 * @param {{
 *   routingCase: (typeof EXECUTION_ROUTING_CASES)[number],
 *   gatewayEvaluation: ReturnType<typeof evaluateGatewaySimulationCase> | null,
 *   authEvaluation: ReturnType<typeof evaluateAuthSimulationCase> | null,
 *   scenarioRow: ReturnType<typeof getScenarioByKey>,
 *   decisionEvaluation: ReturnType<typeof evaluateDecisionCase>,
 *   environment: string,
 * }} args
 */
export function buildExecutionRouteEnvelope(args) {
  const { routingCase, gatewayEvaluation, authEvaluation, scenarioRow, decisionEvaluation, environment } = args;

  const gwEnvelope = gatewayEvaluation?.envelope ?? null;
  const product = getProductByKey(routingCase.product_key);

  return {
    routing_phase: DEVELOPER_EXECUTION_ROUTING_PHASE,
    environment_envelope_label: environment,
    routing_case_key: routingCase.case_key,
    gateway_case_key: routingCase.gateway_case_key,
    selected_service_target: routingCase.selected_service_target,
    product_key: routingCase.product_key,
    contract_key: routingCase.contract_key,
    capability_key: routingCase.capability_key,
    scenario_key: routingCase.scenario_key,
    scenario_title: scenarioRow?.title ?? "unknown_scenario",
    scenario_final_state_preview: scenarioRow?.final_state ?? "unknown_state",
    decision_case_key: routingCase.decision_case_key,
    decision_final_outcome_preview: decisionEvaluation?.final_outcome ?? "unset",
    reconciliation_state_key: routingCase.reconciliation_state,
    gateway_routing_outcome_key: gatewayEvaluation?.routing_outcome?.outcome_key ?? "unset",
    delegated_auth_derived_outcome: authEvaluation?.derived_outcome ?? "unset",
    catalog_product_title: product?.title ?? routingCase.product_key,
    envelope_correlation_echo: gwEnvelope
      ? {
          request_id: gwEnvelope.request_id,
          correlation_id: gwEnvelope.correlation_id,
          trace_id: gwEnvelope.trace_id,
          app_label: gwEnvelope.app_label,
        }
      : null,
    review_required: routingCase.review_required,
    manual_intervention_required: routingCase.manual_intervention_required,
  };
}

/** @typedef {{ stage_key: string, label: string, blocking: boolean, result: ExecutionRoutingStageResult, doc_status: ExecutionRoutingDocStatus }} ExecutionRoutingTraceRow */

/**
 * @param {typeof EXECUTION_ROUTING_CASES[number]} caseRow
 * @param {ReturnType<typeof evaluateGatewaySimulationCase> | null} gatewayEvaluation
 * @param {ReturnType<typeof evaluateAuthSimulationCase> | null} authEvaluation
 * @param {ReturnType<typeof evaluateDecisionCase> | null | undefined} decisionEvaluation
 * @param {ReturnType<typeof resolveRoutingOutcome>} routingOutcomeMeta
 */
export function buildExecutionRoutingTrace(caseRow, gatewayEvaluation, authEvaluation, decisionEvaluation, routingOutcomeMeta) {
  const gwKey = gatewayEvaluation?.routing_outcome?.outcome_key;
  const gatewayHardStop = Boolean(gwKey && gatewayOutcomeIsHardStop(gwKey));
  const authTerminal = Boolean(authEvaluation?.terminal_failure);

  return buildRoutingTraceRows(routingOutcomeMeta, gatewayHardStop, authTerminal, caseRow, decisionEvaluation);
}

/**
 * @param {typeof EXECUTION_ROUTING_CASES[number]} caseRow
 * @param {ReturnType<typeof evaluateGatewaySimulationCase> | null} gatewayEvaluation
 */
export function buildServiceDelegationPlan(caseRow, gatewayEvaluation) {
  const target = getServiceTarget(caseRow.selected_service_target);
  return {
    target_key: caseRow.selected_service_target,
    target_label: target?.label ?? caseRow.selected_service_target,
    service_family: target?.service_family ?? "unknown_family",
    risk_level: target?.risk_level ?? "unknown",
    rationale: caseRow.explanation,
    delegated_from_phases: [
      DEVELOPER_EXECUTION_ROUTING_PHASE,
      "phase_5c_gateway_simulation",
      "phase_5b_auth_simulation",
      "phase_3a_execution_simulation",
    ],
    gateway_handoff_outcome: gatewayEvaluation?.routing_outcome?.outcome_key ?? "unset",
    orchestration_state_path: [...caseRow.orchestration_state_path],
  };
}

/**
 * @param {typeof EXECUTION_ROUTING_CASES[number]} caseRow
 */
export function buildExecutionDependencyChain(caseRow) {
  return caseRow.dependency_keys.map((k) => {
    const dep = DEPENDENCY_MAP[k];
    return {
      dependency_key: k,
      label: dep?.label ?? k,
      blocking: dep?.blocking ?? true,
      description: dep?.description ?? "",
    };
  });
}

/**
 * @param {typeof EXECUTION_ROUTING_CASES[number]} caseRow
 */
export function buildExecutionReconciliationSummary(caseRow) {
  const rec = RECON_MAP[caseRow.reconciliation_state];
  return {
    reconciliation_key: caseRow.reconciliation_state,
    label: rec?.label ?? caseRow.reconciliation_state,
    description: rec?.description ?? "",
    review_required: caseRow.review_required,
    manual_intervention_required: caseRow.manual_intervention_required,
  };
}

/**
 * @param {string} outcome_key
 */
export function buildExecutionRoutingOutcomeSummary(outcome_key) {
  const o = ROUTING_OUTCOME_MAP[outcome_key];
  if (!o) return `Unknown routing outcome ${outcome_key}`;
  return `${o.label} — ${o.developer_message}`;
}

/**
 * @typedef {{
 *   simulateGateway?: boolean,
 *   environment?: string,
 * }} ExecutionRoutingEvalOptions
 */

/**
 * @param {string} caseKey
 * @param {ExecutionRoutingEvalOptions | undefined} options
 */
export function evaluateExecutionRoutingCase(caseKey, options = {}) {
  const simulateGateway = options.simulateGateway !== false;
  const row = getExecutionRoutingCase(caseKey);

  const emptyCounts = () => ({
    routing_stages: { passed: 0, failed: 0, warning: 0, skipped: 0 },
    gateway_gateway_counts: null,
  });

  if (!row) {
    return {
      case: null,
      routing_envelope: null,
      routing_trace: [],
      service_delegation_plan: null,
      dependency_chain: [],
      reconciliation_summary: null,
      routing_outcome: ROUTING_OUTCOME_MAP.execution_routing.no_route_projection,
      counts: emptyCounts(),
      terminal_outcome: true,
      developer_message: "Unknown execution routing case key.",
      operator_summary: "Select a seeded key from EXECUTION_ROUTING_CASES.",
      gateway_evaluation: null,
      auth_evaluation: null,
      decision_evaluation: null,
      scenario_row: null,
    };
  }

  const env = options.environment ?? row.environment ?? "sandbox";

  /** @type {ReturnType<typeof evaluateGatewaySimulationCase> | null} */
  let gatewayEvaluation = null;
  if (simulateGateway && row.gateway_case_key) {
    gatewayEvaluation = evaluateGatewaySimulationCase(row.gateway_case_key, { environment: env });
  }

  /** @type {ReturnType<typeof evaluateAuthSimulationCase>} */
  const authEvaluation =
    gatewayEvaluation?.delegated_auth_evaluation ??
    evaluateAuthSimulationCase(row.auth_case_key, { environment: env });

  const scenarioRow = getScenarioByKey(row.scenario_key);
  const decisionEvaluation = evaluateDecisionCase(row.decision_case_key, { environment: env });

  const routingOutcomeMeta = resolveRoutingOutcome(row, gatewayEvaluation, authEvaluation, decisionEvaluation ?? null, env);

  const routingTrace = buildExecutionRoutingTrace(
    row,
    gatewayEvaluation,
    authEvaluation,
    decisionEvaluation ?? null,
    routingOutcomeMeta,
  );

  const routingEnvelope = buildExecutionRouteEnvelope({
    routingCase: row,
    gatewayEvaluation,
    authEvaluation,
    scenarioRow,
    decisionEvaluation: decisionEvaluation ?? null,
    environment: env,
  });

  const routingCounts = countStageResults(routingTrace);

  return {
    case: row,
    routing_envelope: routingEnvelope,
    routing_trace: routingTrace,
    service_delegation_plan: buildServiceDelegationPlan(row, gatewayEvaluation),
    dependency_chain: buildExecutionDependencyChain(row),
    reconciliation_summary: buildExecutionReconciliationSummary(row),
    routing_outcome: routingOutcomeMeta,
    counts: {
      routing_stages: routingCounts,
      gateway_gateway_counts: gatewayEvaluation?.counts ?? null,
    },
    terminal_outcome: routingOutcomeMeta.terminal,
    developer_message: routingOutcomeMeta.developer_message,
    operator_summary: routingOutcomeMeta.operator_message,
    gateway_evaluation: gatewayEvaluation,
    auth_evaluation: authEvaluation,
    decision_evaluation: decisionEvaluation,
    scenario_row: scenarioRow,
  };
}

// ---------------------------------------------------------------------------
// Alignment guards (deterministic startup checks)
// ---------------------------------------------------------------------------

function assertExecutionRoutingAlignment() {
  for (const c of EXECUTION_ROUTING_CASES) {
    if (!getGatewaySimulationCase(c.gateway_case_key)) {
      throw new Error(`Phase 5D routing case ${c.case_key} references unknown gateway_case_key ${c.gateway_case_key}`);
    }
    if (!getAuthSimulationCase(c.auth_case_key)) {
      throw new Error(`Phase 5D routing case ${c.case_key} references unknown auth_case_key ${c.auth_case_key}`);
    }
    if (!getScenarioByKey(c.scenario_key)) {
      throw new Error(`Phase 5D routing case ${c.case_key} references unknown scenario_key ${c.scenario_key}`);
    }
    if (!getDecisionCaseByKey(c.decision_case_key)) {
      throw new Error(`Phase 5D routing case ${c.case_key} references unknown decision_case_key ${c.decision_case_key}`);
    }
    if (!getProductByKey(c.product_key)) {
      throw new Error(`Phase 5D routing case ${c.case_key} references unknown product_key ${c.product_key}`);
    }
    if (!getServiceTarget(c.selected_service_target)) {
      throw new Error(`Phase 5D routing case ${c.case_key} references unknown selected_service_target ${c.selected_service_target}`);
    }
    if (!ROUTING_OUTCOME_MAP[c.expected_outcome]) {
      throw new Error(`Phase 5D routing case ${c.case_key} references unknown expected_outcome ${c.expected_outcome}`);
    }
    for (const dk of c.dependency_keys) {
      if (!DEPENDENCY_MAP[dk]) {
        throw new Error(`Phase 5D routing case ${c.case_key} references unknown dependency_key ${dk}`);
      }
    }
    if (!RECON_MAP[c.reconciliation_state]) {
      throw new Error(`Phase 5D routing case ${c.case_key} references unknown reconciliation_state ${c.reconciliation_state}`);
    }
    for (const s of c.orchestration_state_path) {
      if (!EXECUTION_ORCHESTRATION_STATES.some((x) => x.state_key === s)) {
        throw new Error(`Phase 5D routing case ${c.case_key} references unknown orchestration state ${s}`);
      }
    }
  }
}

assertExecutionRoutingAlignment();

/** Keys for discoverability/testing (stable order). */
export const EXECUTION_ROUTING_CASE_KEYS = EXECUTION_ROUTING_CASES.map((c) => c.case_key);
