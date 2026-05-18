/**
 * Tropicash Developer Platform — Phase 6A:
 * Runtime Activation Governance & Environment Isolation Blueprint.
 *
 * ARCHITECTURE + GOVERNANCE + SIMULATION ONLY. This module:
 *   • does NOT activate any runtime, public API, gateway, worker, or execution path
 *   • does NOT generate credentials, secrets, webhooks, or deployment pipelines
 *   • does NOT move money or touch treasury, wallets, payouts, PayPal, or fraud execution
 *   • does NOT use Date.now(), Math.random(), fetch, Supabase, or storage
 *
 * Cross-phase vocabulary anchors: Phases 5A–5D rehearsal chain, 4E analytics,
 * 2C capabilities, 3B decision simulation — referenced for teaching alignment only.
 */

import { DEVELOPER_CREDENTIAL_PHASE } from "./developerCredentialArchitectureConfig";
import { DEVELOPER_AUTH_SIMULATION_PHASE } from "./developerAuthSimulationConfig";
import { DEVELOPER_GATEWAY_SIMULATION_PHASE } from "./developerGatewaySimulationConfig";
import { DEVELOPER_EXECUTION_ROUTING_PHASE } from "./developerExecutionRoutingConfig";
import { DEVELOPER_SANDBOX_ANALYTICS_PHASE } from "./developerSandboxAnalyticsConfig";
import { INTERNAL_CAPABILITY_PHASE } from "./internalCapabilityConfig";
import { RUNTIME_DECISION_SIMULATOR_PHASE } from "./runtimeDecisionSimulatorConfig";

export const RUNTIME_ACTIVATION_PHASE = "phase_6a_runtime_activation";

/** @typedef {'passed' | 'failed' | 'warning' | 'skipped'} GateEvalResult */
/** @typedef {'activation_ready' | 'review_required' | 'blocked' | 'isolated' | 'emergency_locked' | 'not_ready'} ActivationExpectedOutcome */

export const RUNTIME_ACTIVATION_STATES = [
  {
    state_key: "inactive",
    label: "Inactive",
    category: "inactive",
    execution_allowed: false,
    external_access_allowed: false,
    review_required: false,
    description: "Default posture — no runtime slice is armed; governance seeds only.",
  },
  {
    state_key: "sandbox_internal",
    label: "Sandbox internal",
    category: "sandbox",
    execution_allowed: true,
    external_access_allowed: false,
    review_required: false,
    description:
      "Internal rehearsal slice — simulated execution permitted inside the internal scope with zero external edges.",
  },
  {
    state_key: "sandbox_limited",
    label: "Sandbox limited",
    category: "sandbox",
    execution_allowed: true,
    external_access_allowed: false,
    review_required: false,
    description:
      "Reduced sandbox envelope — capability and rate narratives capped for teaching and dry-run drills.",
  },
  {
    state_key: "sandbox_partner",
    label: "Sandbox partner",
    category: "sandbox",
    execution_allowed: true,
    external_access_allowed: true,
    review_required: false,
    description:
      "Partner-isolated sandbox slice — external access allowed only within the partner_sandbox credential boundary.",
  },
  {
    state_key: "sandbox_review",
    label: "Sandbox review",
    category: "review",
    execution_allowed: false,
    external_access_allowed: false,
    review_required: true,
    description:
      "Sandbox activation paused pending human review — execution blocked until gates clear.",
  },
  {
    state_key: "live_blocked",
    label: "Live blocked",
    category: "live",
    execution_allowed: false,
    external_access_allowed: false,
    review_required: true,
    description:
      "Live placeholder scope is explicitly blocked — no live runtime or external live access is enabled.",
  },
  {
    state_key: "live_review",
    label: "Live review",
    category: "live",
    execution_allowed: false,
    external_access_allowed: false,
    review_required: true,
    description:
      "Live promotion narrative under review — all live gates must pass before placeholder posture may advance.",
  },
  {
    state_key: "live_disabled",
    label: "Live disabled",
    category: "live",
    execution_allowed: false,
    external_access_allowed: false,
    review_required: false,
    description:
      "Live slice deliberately disabled — operators may re-open review but no execution is permitted.",
  },
  {
    state_key: "live_enabled_placeholder",
    label: "Live enabled (placeholder)",
    category: "live",
    execution_allowed: false,
    external_access_allowed: false,
    review_required: true,
    description:
      "placeholder governance state only — no real live runtime exists. Documents future live posture without arming any edge.",
  },
  {
    state_key: "emergency_shutdown",
    label: "Emergency shutdown",
    category: "emergency",
    execution_allowed: false,
    external_access_allowed: false,
    review_required: true,
    description:
      "Emergency containment — kill-switch precedence overrides all activation paths until operators recover.",
  },
];

export const RUNTIME_ENVIRONMENT_SCOPES = [
  {
    scope_key: "internal",
    label: "Internal",
    external_access_allowed: false,
    credential_boundary: "internal_rehearsal_only",
    execution_boundary: "simulated_internal_delegate",
    observability_boundary: "platform_operator_visibility",
    data_isolation_level: "strict_internal",
    description:
      "Blue Atlantic operator rehearsal — no partner or merchant external edges.",
  },
  {
    scope_key: "sandbox",
    label: "Sandbox",
    external_access_allowed: false,
    credential_boundary: "sandbox_metadata_only",
    execution_boundary: "sandbox_simulation_workspace",
    observability_boundary: "developer_console_preview",
    data_isolation_level: "sandbox_synthetic",
    description:
      "Standard developer sandbox — aligns with Phase 4D contracts and Phase 5B–5D simulators.",
  },
  {
    scope_key: "partner_sandbox",
    label: "Partner sandbox",
    external_access_allowed: true,
    credential_boundary: "partner_sandbox_partition",
    execution_boundary: "partner_isolated_delegate",
    observability_boundary: "partner_scoped_telemetry_preview",
    data_isolation_level: "partner_partitioned",
    description:
      "Partner-facing sandbox slice isolated from internal rehearsal data paths.",
  },
  {
    scope_key: "isolated_review",
    label: "Isolated review",
    external_access_allowed: false,
    credential_boundary: "review_hold_no_issuance",
    execution_boundary: "frozen_simulation_only",
    observability_boundary: "audit_operator_only",
    data_isolation_level: "review_quarantine",
    description:
      "Human review quarantine — execution frozen while governance and audit gates are evaluated.",
  },
  {
    scope_key: "live_placeholder",
    label: "Live placeholder",
    external_access_allowed: false,
    credential_boundary: "live_metadata_blueprint_only",
    execution_boundary: "no_runtime_armed",
    observability_boundary: "governance_narration_only",
    data_isolation_level: "live_blueprint_isolated",
    description:
      "Documentation-only live scope — describes future isolation before any production runtime exists.",
  },
];

export const RUNTIME_KILL_SWITCH_MODELS = [
  {
    switch_key: "global_runtime_disable",
    label: "Global runtime disable",
    scope: "platform",
    activation_effect:
      "Conceptual only — in simulation, all activation states collapse to emergency containment with zero execution.",
    recovery_requirements: "Dual-operator sign-off, incident ticket, and governance replay of Phase 6A cases.",
    review_required: true,
    description:
      "Platform-wide kill narrative — highest precedence over gates and envelopes; not enforced in production.",
  },
  {
    switch_key: "sandbox_runtime_disable",
    label: "Sandbox runtime disable",
    scope: "sandbox",
    activation_effect:
      "Conceptual only — sandbox execution_allowed flags narrated as false; simulators remain readable offline.",
    recovery_requirements: "Sandbox health review and analytics posture reset (Phase 4E seeds).",
    review_required: true,
    description:
      "Sandbox rehearsal containment story — does not disable production infrastructure.",
  },
  {
    switch_key: "partner_runtime_disable",
    label: "Partner runtime disable",
    scope: "partner_sandbox",
    activation_effect:
      "Conceptual only — partner external_access_allowed narrated as false; internal sandbox may continue in simulation.",
    recovery_requirements: "Partner governance ticket and isolation rule re-validation.",
    review_required: true,
    description: "Partner_sandbox scope narrative only — simulated, not enforced.",
  },
  {
    switch_key: "credential_access_disable",
    label: "Credential access disable",
    scope: "credential_vault",
    activation_effect:
      "Conceptual only — credential-bound activation paths narrated as blocked; aligns with Phase 5A metadata-only posture.",
    recovery_requirements: "Credential architecture review; no issuance implied.",
    review_required: true,
    description: "Vault-bound identity containment story — simulated, not enforced.",
  },
  {
    switch_key: "product_disable",
    label: "Product disable",
    scope: "catalog",
    activation_effect: "Conceptual only — product-level activation seeds treated as blocked in evaluation.",
    recovery_requirements: "Product catalog (Phase 4D) governance sign-off.",
    review_required: false,
    description: "Catalog-scoped kill narrative for teaching product-level containment.",
  },
  {
    switch_key: "contract_disable",
    label: "Contract disable",
    scope: "catalog",
    activation_effect: "Conceptual only — contract rows cannot satisfy activation gates until re-enabled in simulation.",
    recovery_requirements: "Contract review against sandbox runtime contracts.",
    review_required: false,
    description: "Finer-grained than product_disable — contract_key scoped; not enforced.",
  },
  {
    switch_key: "capability_disable",
    label: "Capability disable",
    scope: "capability_registry",
    activation_effect: "Conceptual only — capability assignment gate fails until registry posture clears in simulation.",
    recovery_requirements: "Phase 4C capability assignment verification.",
    review_required: true,
    description: "Maps to capability_assignment_verified gate failures — simulated only.",
  },
  {
    switch_key: "execution_routing_disable",
    label: "Execution routing disable",
    scope: "routing",
    activation_effect:
      "Conceptual only — Phase 5D routing gate treated as failed; post-gateway choreography frozen in narration.",
    recovery_requirements: "Execution routing simulator replay with passing seed.",
    review_required: true,
    description: "Routing-scoped kill narrative — gateway/auth may still be reviewed offline.",
  },
  {
    switch_key: "review_queue_disable",
    label: "Review queue disable",
    scope: "governance",
    activation_effect: "Conceptual only — human review paths paused; cases default to blocked or not_ready.",
    recovery_requirements: "Governance queue restored and pending reviews cleared.",
    review_required: true,
    description: "Prevents promotion in simulation while review infrastructure is unavailable.",
  },
  {
    switch_key: "observability_isolation_mode",
    label: "Observability isolation mode",
    scope: "observability",
    activation_effect:
      "Conceptual only — observability_required_mode envelope engaged; execution blocked without trace context in simulation.",
    recovery_requirements: "Observability blueprint (Phase 2E) and runtime state (2F) readiness replay.",
    review_required: false,
    description: "Telemetry context containment narrative — not global production shutdown.",
  },
];

export const RUNTIME_ACTIVATION_GATES = [
  {
    gate_key: "governance_review_completed",
    phase_ref: "4B",
    label: "Governance review completed",
    blocking: true,
    required_for_states: ["sandbox_internal", "sandbox_partner", "sandbox_limited", "live_review"],
    description: "Phase 4B app governance review narrative satisfied for the requested scope.",
  },
  {
    gate_key: "credential_review_completed",
    phase_ref: "5A",
    label: "Credential review completed",
    blocking: true,
    required_for_states: ["sandbox_internal", "sandbox_partner", "sandbox_limited"],
    description: `Phase ${DEVELOPER_CREDENTIAL_PHASE} metadata review — no issuance, vault posture documented.`,
  },
  {
    gate_key: "capability_assignment_verified",
    phase_ref: "4C",
    label: "Capability assignment verified",
    blocking: true,
    required_for_states: ["sandbox_internal", "sandbox_partner", "sandbox_limited"],
    description: `Phase 4C capability assignments align with requested keys (registry vocabulary: ${INTERNAL_CAPABILITY_PHASE}).`,
  },
  {
    gate_key: "auth_simulation_passing",
    phase_ref: "5B",
    label: "Auth simulation passing",
    blocking: true,
    required_for_states: ["sandbox_internal", "sandbox_partner", "sandbox_limited"],
    description: `Phase ${DEVELOPER_AUTH_SIMULATION_PHASE} seeded cases pass for the integration slice.`,
  },
  {
    gate_key: "gateway_simulation_passing",
    phase_ref: "5C",
    label: "Gateway simulation passing",
    blocking: true,
    required_for_states: ["sandbox_internal", "sandbox_partner", "sandbox_limited"],
    description: `Phase ${DEVELOPER_GATEWAY_SIMULATION_PHASE} envelope choreography passes without blocking failures.`,
  },
  {
    gate_key: "routing_simulation_passing",
    phase_ref: "5D",
    label: "Routing simulation passing",
    blocking: true,
    required_for_states: ["sandbox_internal", "sandbox_partner", "sandbox_limited"],
    description: `Phase ${DEVELOPER_EXECUTION_ROUTING_PHASE} post-gateway stages complete without blocking failures.`,
  },
  {
    gate_key: "sandbox_analytics_healthy",
    phase_ref: "4E",
    label: "Sandbox analytics healthy",
    blocking: false,
    required_for_states: ["sandbox_partner", "sandbox_review"],
    description: `Phase ${DEVELOPER_SANDBOX_ANALYTICS_PHASE} health grades within rehearsed thresholds.`,
  },
  {
    gate_key: "reconciliation_checks_ready",
    phase_ref: "5D",
    label: "Reconciliation checks ready",
    blocking: true,
    required_for_states: ["sandbox_internal", "sandbox_partner", "live_review"],
    description: `Phase ${DEVELOPER_EXECUTION_ROUTING_PHASE} reconciliation narration is ready before execution enablement.`,
  },
  {
    gate_key: "audit_preparation_ready",
    phase_ref: "5C",
    label: "Audit preparation ready",
    blocking: true,
    required_for_states: ["sandbox_partner", "live_review", "sandbox_review"],
    description: `Phase ${DEVELOPER_GATEWAY_SIMULATION_PHASE} audit envelope fields and append-only narrative prerequisites satisfied in simulation.`,
  },
  {
    gate_key: "observability_context_ready",
    phase_ref: "2E",
    label: "Observability context ready",
    blocking: true,
    required_for_states: ["sandbox_internal", "sandbox_partner", "live_review"],
    description: "Phase 2E trace, session, and correlation context is present for the activation slice.",
  },
  {
    gate_key: "runtime_state_ready",
    phase_ref: "2F",
    label: "Runtime state ready",
    blocking: true,
    required_for_states: ["sandbox_internal", "sandbox_partner"],
    description: "Phase 2F runtime state snapshot vocabulary indicates the slice may proceed in simulation.",
  },
];

export const RUNTIME_SAFETY_ENVELOPES = [
  {
    envelope_key: "sandbox_safe_mode",
    label: "Sandbox safe mode",
    restrictions: ["No live_placeholder scope", "External access denied unless partner_sandbox envelope applies"],
    required_controls: ["sandbox_credentials_cannot_touch_live", "runtime_activation_requires_governance"],
    escalation_behavior: "Downgrade to sandbox_limited activation state on repeated gate warnings.",
    description: "Default teaching envelope for internal and standard sandbox scopes.",
  },
  {
    envelope_key: "sandbox_review_only_mode",
    label: "Sandbox review-only mode",
    restrictions: ["execution_allowed false", "All mutating simulation pinned to read-only traces"],
    required_controls: ["review_required_overrides_execution", "audit_context_required"],
    escalation_behavior: "Opens governance queue — no automatic promotion.",
    description: "Used when sandbox_review or isolated_review scopes are active.",
  },
  {
    envelope_key: "isolated_partner_mode",
    label: "Isolated partner mode",
    restrictions: ["Partner data partition enforced", "Internal rehearsal credentials rejected"],
    required_controls: ["partner_sandbox_isolated_from_internal"],
    escalation_behavior: "Partner kill-switch may engage without affecting internal sandbox narration.",
    description: "Partner-facing isolation envelope aligned with partner_sandbox scope.",
  },
  {
    envelope_key: "audit_locked_mode",
    label: "Audit locked mode",
    restrictions: ["Activation frozen until audit_preparation_ready passes"],
    required_controls: ["audit_context_required"],
    escalation_behavior: "Operator must clear audit gate — no bypass in simulation.",
    description: "Blocks promotion when audit narrative is incomplete.",
  },
  {
    envelope_key: "observability_required_mode",
    label: "Observability required mode",
    restrictions: ["No execution without observability_context_ready"],
    required_controls: ["observability_context_required"],
    escalation_behavior: "Engages observability_isolation_mode kill-switch on sustained failure.",
    description: "Forces trace/session context before enablement stories proceed.",
  },
  {
    envelope_key: "reconciliation_required_mode",
    label: "Reconciliation required mode",
    restrictions: ["Routing completion requires reconciliation_checks_ready"],
    required_controls: ["execution_requires_reconciliation_path"],
    escalation_behavior: "Downgrades to not_ready until reconciliation gate passes.",
    description: "Ties execution enablement to Phase 5D reconciliation vocabulary.",
  },
  {
    envelope_key: "emergency_containment_mode",
    label: "Emergency containment mode",
    restrictions: ["All execution_allowed false", "All external_access_allowed false"],
    required_controls: ["emergency_shutdown_overrides_all"],
    escalation_behavior: "Requires global_runtime_disable recovery playbook.",
    description: "Active when emergency shutdown or global kill-switch is engaged.",
  },
];

export const RUNTIME_ISOLATION_RULES = [
  {
    rule_key: "sandbox_credentials_cannot_touch_live",
    label: "Sandbox credentials cannot touch live",
    blocking: true,
    enforcement_scope: "credential_boundary",
    description: "Sandbox credential metadata must never satisfy live_placeholder activation paths.",
  },
  {
    rule_key: "partner_sandbox_isolated_from_internal",
    label: "Partner sandbox isolated from internal",
    blocking: true,
    enforcement_scope: "partner_sandbox",
    description: "Partner partition cannot read internal rehearsal identifiers or traces.",
  },
  {
    rule_key: "runtime_activation_requires_governance",
    label: "Runtime activation requires governance",
    blocking: true,
    enforcement_scope: "governance",
    description: "No activation_ready outcome without governance_review_completed for the scope.",
  },
  {
    rule_key: "execution_requires_reconciliation_path",
    label: "Execution requires reconciliation path",
    blocking: true,
    enforcement_scope: "execution",
    description: "Simulated execution enablement requires reconciliation_checks_ready when routing is in scope.",
  },
  {
    rule_key: "observability_context_required",
    label: "Observability context required",
    blocking: true,
    enforcement_scope: "observability",
    description: "Trace and session vocabulary from Phases 2E/2F must be present before enablement.",
  },
  {
    rule_key: "audit_context_required",
    label: "Audit context required",
    blocking: true,
    enforcement_scope: "audit",
    description: "Audit envelope prerequisites must pass before partner or live-review promotion.",
  },
  {
    rule_key: "emergency_shutdown_overrides_all",
    label: "Emergency shutdown overrides all",
    blocking: true,
    enforcement_scope: "emergency",
    description: "Emergency state or global kill-switch collapses all other outcomes to emergency_locked.",
  },
  {
    rule_key: "review_required_overrides_execution",
    label: "Review required overrides execution",
    blocking: true,
    enforcement_scope: "governance",
    description: "When activation state has review_required, execution_allowed is forced false in evaluation.",
  },
];

/**
 * @type {ReadonlyArray<{
 *   case_key: string,
 *   title: string,
 *   environment_scope: string,
 *   activation_state: string,
 *   required_gate_keys: string[],
 *   isolation_rule_keys: string[],
 *   safety_envelope_keys: string[],
 *   kill_switch_keys: string[],
 *   expected_outcome: ActivationExpectedOutcome,
 *   explanation: string,
 *   gate_results: Record<string, GateEvalResult>,
 *   isolation_satisfied?: Record<string, boolean>,
 * }>}
 */
export const RUNTIME_ACTIVATION_CASES = [
  {
    case_key: "activation.internal.sandbox_ready",
    title: "Internal sandbox activation ready",
    environment_scope: "internal",
    activation_state: "sandbox_internal",
    required_gate_keys: [
      "governance_review_completed",
      "credential_review_completed",
      "capability_assignment_verified",
      "auth_simulation_passing",
      "gateway_simulation_passing",
      "routing_simulation_passing",
      "observability_context_ready",
      "runtime_state_ready",
    ],
    isolation_rule_keys: [
      "sandbox_credentials_cannot_touch_live",
      "runtime_activation_requires_governance",
      "observability_context_required",
    ],
    safety_envelope_keys: ["sandbox_safe_mode"],
    kill_switch_keys: [],
    expected_outcome: "activation_ready",
    explanation:
      "All blocking gates pass for internal sandbox — teaching posture shows activation_ready without arming any runtime.",
    gate_results: {
      governance_review_completed: "passed",
      credential_review_completed: "passed",
      capability_assignment_verified: "passed",
      auth_simulation_passing: "passed",
      gateway_simulation_passing: "passed",
      routing_simulation_passing: "passed",
      observability_context_ready: "passed",
      runtime_state_ready: "passed",
    },
  },
  {
    case_key: "activation.partner.sandbox_review",
    title: "Partner sandbox pending review",
    environment_scope: "partner_sandbox",
    activation_state: "sandbox_review",
    required_gate_keys: [
      "governance_review_completed",
      "credential_review_completed",
      "capability_assignment_verified",
      "auth_simulation_passing",
      "gateway_simulation_passing",
      "sandbox_analytics_healthy",
      "audit_preparation_ready",
    ],
    isolation_rule_keys: [
      "partner_sandbox_isolated_from_internal",
      "review_required_overrides_execution",
      "audit_context_required",
    ],
    safety_envelope_keys: ["sandbox_review_only_mode", "isolated_partner_mode"],
    kill_switch_keys: [],
    expected_outcome: "review_required",
    explanation:
      "Governance and simulations pass but sandbox_review state and analytics warning require human review before enablement.",
    gate_results: {
      governance_review_completed: "passed",
      credential_review_completed: "passed",
      capability_assignment_verified: "passed",
      auth_simulation_passing: "passed",
      gateway_simulation_passing: "passed",
      sandbox_analytics_healthy: "warning",
      audit_preparation_ready: "passed",
    },
  },
  {
    case_key: "activation.partner.capability_missing",
    title: "Partner sandbox missing capability assignment",
    environment_scope: "partner_sandbox",
    activation_state: "sandbox_partner",
    required_gate_keys: [
      "governance_review_completed",
      "capability_assignment_verified",
      "auth_simulation_passing",
    ],
    isolation_rule_keys: ["partner_sandbox_isolated_from_internal", "runtime_activation_requires_governance"],
    safety_envelope_keys: ["isolated_partner_mode"],
    kill_switch_keys: ["capability_disable"],
    expected_outcome: "blocked",
    explanation:
      "Capability assignment gate fails — partner slice cannot proceed even if auth simulation would pass in isolation.",
    gate_results: {
      governance_review_completed: "passed",
      capability_assignment_verified: "failed",
      auth_simulation_passing: "passed",
    },
    isolation_satisfied: { partner_sandbox_isolated_from_internal: true },
  },
  {
    case_key: "activation.gateway.audit_missing",
    title: "Gateway path blocked — audit not ready",
    environment_scope: "sandbox",
    activation_state: "sandbox_limited",
    required_gate_keys: [
      "governance_review_completed",
      "gateway_simulation_passing",
      "audit_preparation_ready",
    ],
    isolation_rule_keys: ["audit_context_required", "sandbox_credentials_cannot_touch_live"],
    safety_envelope_keys: ["audit_locked_mode", "sandbox_safe_mode"],
    kill_switch_keys: [],
    expected_outcome: "blocked",
    explanation:
      "Gateway simulation passes but audit_preparation_ready fails — audit_locked_mode envelope blocks promotion.",
    gate_results: {
      governance_review_completed: "passed",
      gateway_simulation_passing: "passed",
      audit_preparation_ready: "failed",
    },
    isolation_satisfied: { audit_context_required: false },
  },
  {
    case_key: "activation.auth.simulation_failed",
    title: "Auth simulation blocking activation",
    environment_scope: "sandbox",
    activation_state: "sandbox_limited",
    required_gate_keys: ["governance_review_completed", "auth_simulation_passing", "gateway_simulation_passing"],
    isolation_rule_keys: ["runtime_activation_requires_governance"],
    safety_envelope_keys: ["sandbox_safe_mode"],
    kill_switch_keys: [],
    expected_outcome: "blocked",
    explanation: `Phase ${DEVELOPER_AUTH_SIMULATION_PHASE} case would fail — auth_simulation_passing gate blocks the slice.`,
    gate_results: {
      governance_review_completed: "passed",
      auth_simulation_passing: "failed",
      gateway_simulation_passing: "skipped",
    },
  },
  {
    case_key: "activation.routing.review_required",
    title: "Routing simulation requires review",
    environment_scope: "sandbox",
    activation_state: "sandbox_internal",
    required_gate_keys: [
      "governance_review_completed",
      "routing_simulation_passing",
      "reconciliation_checks_ready",
    ],
    isolation_rule_keys: ["execution_requires_reconciliation_path"],
    safety_envelope_keys: ["reconciliation_required_mode"],
    kill_switch_keys: [],
    expected_outcome: "review_required",
    explanation:
      "Routing passes with reconciliation warning — human review required before activation_ready in simulation.",
    gate_results: {
      governance_review_completed: "passed",
      routing_simulation_passing: "passed",
      reconciliation_checks_ready: "warning",
    },
  },
  {
    case_key: "activation.observability.not_ready",
    title: "Observability context not ready",
    environment_scope: "internal",
    activation_state: "sandbox_internal",
    required_gate_keys: ["governance_review_completed", "observability_context_ready", "runtime_state_ready"],
    isolation_rule_keys: ["observability_context_required"],
    safety_envelope_keys: ["observability_required_mode"],
    kill_switch_keys: ["observability_isolation_mode"],
    expected_outcome: "not_ready",
    explanation:
      "Trace/session context missing — not_ready until Phase 2E/2F observability seeds satisfy the gate.",
    gate_results: {
      governance_review_completed: "passed",
      observability_context_ready: "failed",
      runtime_state_ready: "skipped",
    },
    isolation_satisfied: { observability_context_required: false },
  },
  {
    case_key: "activation.reconciliation.not_ready",
    title: "Reconciliation path not ready",
    environment_scope: "sandbox",
    activation_state: "sandbox_partner",
    required_gate_keys: ["routing_simulation_passing", "reconciliation_checks_ready"],
    isolation_rule_keys: ["execution_requires_reconciliation_path"],
    safety_envelope_keys: ["reconciliation_required_mode"],
    kill_switch_keys: [],
    expected_outcome: "not_ready",
    explanation:
      "Routing narration incomplete for reconciliation — execution enablement stays not_ready in the blueprint.",
    gate_results: {
      routing_simulation_passing: "passed",
      reconciliation_checks_ready: "failed",
    },
    isolation_satisfied: { execution_requires_reconciliation_path: false },
  },
  {
    case_key: "activation.live.placeholder_blocked",
    title: "Live placeholder explicitly blocked",
    environment_scope: "live_placeholder",
    activation_state: "live_blocked",
    required_gate_keys: ["governance_review_completed", "audit_preparation_ready"],
    isolation_rule_keys: ["sandbox_credentials_cannot_touch_live", "review_required_overrides_execution"],
    safety_envelope_keys: ["sandbox_safe_mode"],
    kill_switch_keys: [],
    expected_outcome: "blocked",
    explanation:
      "live_blocked state on live_placeholder scope — no real live runtime; governance may pass but activation remains blocked.",
    gate_results: {
      governance_review_completed: "passed",
      audit_preparation_ready: "passed",
    },
  },
  {
    case_key: "activation.emergency.shutdown",
    title: "Emergency shutdown engaged",
    environment_scope: "internal",
    activation_state: "emergency_shutdown",
    required_gate_keys: ["governance_review_completed"],
    isolation_rule_keys: ["emergency_shutdown_overrides_all"],
    safety_envelope_keys: ["emergency_containment_mode"],
    kill_switch_keys: ["global_runtime_disable"],
    expected_outcome: "emergency_locked",
    explanation:
      "Global kill-switch and emergency_shutdown state — all paths collapse to emergency_locked regardless of gate passes.",
    gate_results: {
      governance_review_completed: "passed",
    },
  },
];

export const RUNTIME_ACTIVATION_SAFETY_RULES = [
  "Phase 6A models runtime activation governance and environment isolation only — it does not arm any runtime, API gateway, worker, queue, or execution environment.",
  `evaluateRuntimeActivationCase() is pure: same case_key and options always return the same object. No Date.now(), Math.random(), network I/O, Supabase, or secret material.`,
  `Activation gates reference rehearsal phases (${DEVELOPER_CREDENTIAL_PHASE}, ${DEVELOPER_AUTH_SIMULATION_PHASE}, ${DEVELOPER_GATEWAY_SIMULATION_PHASE}, ${DEVELOPER_EXECUTION_ROUTING_PHASE}, ${DEVELOPER_SANDBOX_ANALYTICS_PHASE}, ${INTERNAL_CAPABILITY_PHASE}, ${RUNTIME_DECISION_SIMULATOR_PHASE}) for vocabulary alignment — they do not invoke those evaluators at runtime.`,
  "live_enabled_placeholder MUST remain a documentation state — its description explicitly states that no real live runtime exists.",
  "Kill-switch models describe containment narratives only — toggling them in the Developer Console does not change production infrastructure.",
  "No credentials are generated, no secrets are stored, and no money-movement, treasury, wallet, withdrawal, PayPal, or fraud subsystems are touched.",
];

const STATE_BY_KEY = Object.fromEntries(RUNTIME_ACTIVATION_STATES.map((s) => [s.state_key, s]));
const SCOPE_BY_KEY = Object.fromEntries(RUNTIME_ENVIRONMENT_SCOPES.map((s) => [s.scope_key, s]));
const GATE_BY_KEY = Object.fromEntries(RUNTIME_ACTIVATION_GATES.map((g) => [g.gate_key, g]));
const RULE_BY_KEY = Object.fromEntries(RUNTIME_ISOLATION_RULES.map((r) => [r.rule_key, r]));
const ENVELOPE_BY_KEY = Object.fromEntries(RUNTIME_SAFETY_ENVELOPES.map((e) => [e.envelope_key, e]));
const SWITCH_BY_KEY = Object.fromEntries(RUNTIME_KILL_SWITCH_MODELS.map((s) => [s.switch_key, s]));

/**
 * @param {string} caseKey
 */
export function getRuntimeActivationCase(caseKey) {
  return RUNTIME_ACTIVATION_CASES.find((c) => c.case_key === caseKey) ?? null;
}

/**
 * @param {ActivationExpectedOutcome | string} outcome
 */
function outcomeLabel(outcome) {
  const labels = {
    activation_ready: "Activation ready (simulation)",
    review_required: "Review required",
    blocked: "Blocked",
    isolated: "Isolated",
    emergency_locked: "Emergency locked",
    not_ready: "Not ready",
  };
  return labels[outcome] ?? String(outcome);
}

/**
 * @param {typeof RUNTIME_ACTIVATION_CASES[number] | null} row
 * @param {ActivationExpectedOutcome} derived
 */
function buildActivationReadinessFromEval(row, derived) {
  if (!row) return "Unknown activation case.";
  const state = STATE_BY_KEY[row.activation_state];
  return `${outcomeLabel(derived)} for "${row.title}" — state ${state?.label ?? row.activation_state}, scope ${row.environment_scope}. Expected seed: ${row.expected_outcome}; derived: ${derived}.`;
}

export function buildActivationReadinessSummary(caseKeyOrEval) {
  if (typeof caseKeyOrEval === "string") {
    const ev = evaluateRuntimeActivationCase(caseKeyOrEval);
    return ev.activation_summary;
  }
  if (caseKeyOrEval && typeof caseKeyOrEval === "object" && caseKeyOrEval.activation_summary) {
    return caseKeyOrEval.activation_summary;
  }
  return buildActivationReadinessSummary(RUNTIME_ACTIVATION_CASES[0]?.case_key ?? "");
}

export function buildEnvironmentIsolationSummary(scopeKey) {
  const scope = SCOPE_BY_KEY[scopeKey] ?? SCOPE_BY_KEY.sandbox;
  return `${scope.label} (${scope.scope_key}): credential=${scope.credential_boundary}, execution=${scope.execution_boundary}, observability=${scope.observability_boundary}, isolation=${scope.data_isolation_level}. ${scope.description}`;
}

export function buildKillSwitchSummary() {
  return RUNTIME_KILL_SWITCH_MODELS.map(
    (s) => `${s.label} [${s.scope}]: ${s.activation_effect}`,
  ).join(" ");
}

/**
 * @param {string | { gate_evaluations?: { gate_key: string, result: GateEvalResult, blocking: boolean }[] }} caseKeyOrEval
 */
export function buildActivationGateSummary(caseKeyOrEval) {
  /** @type {{ gate_key: string, result: GateEvalResult, blocking: boolean, label: string }[]} */
  let rows = [];
  if (typeof caseKeyOrEval === "string") {
    rows = evaluateRuntimeActivationCase(caseKeyOrEval).gate_evaluations;
  } else if (caseKeyOrEval?.gate_evaluations) {
    rows = caseKeyOrEval.gate_evaluations;
  } else {
    rows = evaluateRuntimeActivationCase(RUNTIME_ACTIVATION_CASES[0]?.case_key ?? "").gate_evaluations;
  }
  const passed = rows.filter((r) => r.result === "passed").length;
  const failed = rows.filter((r) => r.result === "failed").length;
  return `${passed} passed, ${failed} failed, ${rows.length} evaluated — ${rows.map((r) => `${r.gate_key}:${r.result}`).join("; ")}.`;
}

export function buildSafetyEnvelopeSummary(envelopeKeys) {
  const keys = envelopeKeys ?? RUNTIME_SAFETY_ENVELOPES.map((e) => e.envelope_key);
  return keys
    .map((k) => {
      const e = ENVELOPE_BY_KEY[k];
      return e ? `${e.label}: ${e.escalation_behavior}` : k;
    })
    .join(" ");
}

/**
 * @param {typeof RUNTIME_ACTIVATION_CASES[number]} row
 * @param {{ environment_scope?: string } | undefined} options
 */
function mergeCaseOptions(row, options) {
  const environment_scope = options?.environment_scope ?? row.environment_scope;
  return { environment_scope };
}

/**
 * @param {typeof RUNTIME_ACTIVATION_CASES[number]} row
 * @param {string} environment_scope
 */
function evaluateGatesForCase(row, environment_scope) {
  const gateKeys =
    row.required_gate_keys.length > 0
      ? row.required_gate_keys
      : RUNTIME_ACTIVATION_GATES.map((g) => g.gate_key);

  return gateKeys.map((gate_key) => {
    const meta = GATE_BY_KEY[gate_key];
    const result = row.gate_results[gate_key] ?? "skipped";
    return {
      gate_key,
      phase_ref: meta?.phase_ref ?? null,
      label: meta?.label ?? gate_key,
      blocking: meta?.blocking ?? true,
      result,
      environment_scope,
    };
  });
}

/**
 * @param {typeof RUNTIME_ACTIVATION_CASES[number]} row
 */
function evaluateIsolationForCase(row) {
  return row.isolation_rule_keys.map((rule_key) => {
    const meta = RULE_BY_KEY[rule_key];
    const satisfied =
      row.isolation_satisfied?.[rule_key] ??
      (!(row.gate_results.audit_preparation_ready === "failed" && rule_key === "audit_context_required") &&
        !(row.gate_results.observability_context_ready === "failed" &&
          rule_key === "observability_context_required") &&
        !(row.gate_results.reconciliation_checks_ready === "failed" &&
          rule_key === "execution_requires_reconciliation_path") &&
        !(row.kill_switch_keys.includes("global_runtime_disable") &&
          rule_key !== "emergency_shutdown_overrides_all"));
    return {
      rule_key,
      label: meta?.label ?? rule_key,
      blocking: meta?.blocking ?? true,
      enforcement_scope: meta?.enforcement_scope ?? "unknown",
      satisfied: rule_key === "emergency_shutdown_overrides_all"
        ? !row.kill_switch_keys.includes("global_runtime_disable") && row.activation_state !== "emergency_shutdown"
        : satisfied,
    };
  });
}

/**
 * @param {typeof RUNTIME_ACTIVATION_CASES[number]} row
 */
function evaluateKillSwitchesForCase(row) {
  return RUNTIME_KILL_SWITCH_MODELS.map((sw) => ({
    switch_key: sw.switch_key,
    label: sw.label,
    scope: sw.scope,
    engaged: row.kill_switch_keys.includes(sw.switch_key),
    activation_effect: sw.activation_effect,
    recovery_requirements: sw.recovery_requirements,
    review_required: sw.review_required,
  }));
}

/**
 * @param {typeof RUNTIME_ACTIVATION_CASES[number]} row
 */
function evaluateEnvelopesForCase(row) {
  return row.safety_envelope_keys.map((envelope_key) => {
    const meta = ENVELOPE_BY_KEY[envelope_key];
    return {
      envelope_key,
      label: meta?.label ?? envelope_key,
      active: true,
      restrictions: meta?.restrictions ?? [],
      required_controls: meta?.required_controls ?? [],
      escalation_behavior: meta?.escalation_behavior ?? "",
    };
  });
}

/**
 * @param {typeof RUNTIME_ACTIVATION_CASES[number]} row
 * @param {{ gate_evaluations: ReturnType<typeof evaluateGatesForCase>, isolation_evaluations: ReturnType<typeof evaluateIsolationForCase>, kill_switch_evaluations: ReturnType<typeof evaluateKillSwitchesForCase> }} evals
 */
function deriveOutcome(row, evals) {
  const state = STATE_BY_KEY[row.activation_state];
  const globalKill = evals.kill_switch_evaluations.some(
    (k) => k.engaged && k.switch_key === "global_runtime_disable",
  );
  if (globalKill || row.activation_state === "emergency_shutdown") {
    return "emergency_locked";
  }

  if (row.activation_state === "live_blocked" || row.environment_scope === "live_placeholder") {
    return "blocked";
  }

  const blockingFailures = evals.gate_evaluations.filter((g) => g.blocking && g.result === "failed");
  const isolationFailures = evals.isolation_evaluations.filter((r) => r.blocking && !r.satisfied);

  if (blockingFailures.length > 0) {
    const readinessOnly = blockingFailures.every((g) =>
      ["observability_context_ready", "reconciliation_checks_ready", "runtime_state_ready"].includes(
        g.gate_key,
      ),
    );
    if (readinessOnly) {
      return "not_ready";
    }
    return "blocked";
  }

  if (isolationFailures.length > 0) {
    return row.case_key === "activation.partner.capability_missing" ? "blocked" : "isolated";
  }

  const warnings = evals.gate_evaluations.filter((g) => g.result === "warning");
  if (warnings.length > 0 || state?.review_required || row.activation_state === "sandbox_review") {
    return "review_required";
  }

  if (state?.execution_allowed && !state?.review_required) {
    return "activation_ready";
  }

  return "not_ready";
}

/**
 * @param {string} caseKey
 * @param {{ environment_scope?: string } | undefined} options
 */
export function evaluateRuntimeActivationCase(caseKey, options) {
  const row = getRuntimeActivationCase(caseKey);
  if (!row) {
    return {
      case_key: caseKey,
      error: "unknown_case",
      case: null,
      activation_summary: "Unknown activation case.",
      environment_summary: "",
      isolation_summary: "",
      kill_switch_summary: buildKillSwitchSummary(),
      gate_summary: "",
      safety_envelope_summary: "",
      gate_evaluations: [],
      isolation_evaluations: [],
      kill_switch_evaluations: [],
      safety_envelope_evaluations: [],
      counts: { passed_count: 0, failed_count: 0, warning_count: 0, skipped_count: 0 },
      blocking_failures: [],
      expected_outcome: "not_ready",
      derived_outcome: "not_ready",
      outcome_matches_expected: false,
      developer_safe_message: "Select a valid seeded case from RUNTIME_ACTIVATION_CASES.",
      operator_summary: "Unknown case_key — no activation evaluation performed.",
    };
  }

  const { environment_scope } = mergeCaseOptions(row, options);
  const scope = SCOPE_BY_KEY[environment_scope] ?? SCOPE_BY_KEY[row.environment_scope];
  const state = STATE_BY_KEY[row.activation_state];

  const gate_evaluations = evaluateGatesForCase(row, environment_scope);
  const isolation_evaluations = evaluateIsolationForCase(row);
  const kill_switch_evaluations = evaluateKillSwitchesForCase(row);
  const safety_envelope_evaluations = evaluateEnvelopesForCase(row);

  let passed_count = 0;
  let failed_count = 0;
  let warning_count = 0;
  let skipped_count = 0;
  for (const g of gate_evaluations) {
    if (g.result === "passed") passed_count += 1;
    if (g.result === "failed") failed_count += 1;
    if (g.result === "warning") warning_count += 1;
    if (g.result === "skipped") skipped_count += 1;
  }

  const blocking_failures = [
    ...gate_evaluations.filter((g) => g.blocking && g.result === "failed").map((g) => g.gate_key),
    ...isolation_evaluations.filter((r) => r.blocking && !r.satisfied).map((r) => r.rule_key),
    ...kill_switch_evaluations.filter((k) => k.engaged).map((k) => k.switch_key),
  ];

  const derived_outcome = deriveOutcome(row, {
    gate_evaluations,
    isolation_evaluations,
    kill_switch_evaluations,
  });

  const review_required =
    state?.review_required ||
    derived_outcome === "review_required" ||
    derived_outcome === "emergency_locked";

  const execution_allowed =
    state?.execution_allowed === true &&
    derived_outcome === "activation_ready" &&
    !kill_switch_evaluations.some((k) => k.engaged);

  const external_access_allowed =
    scope?.external_access_allowed === true &&
    derived_outcome === "activation_ready" &&
    state?.external_access_allowed === true;

  const activation_summary = buildActivationReadinessFromEval(row, derived_outcome);
  const environment_summary = buildEnvironmentIsolationSummary(environment_scope);
  const isolation_summary = isolation_evaluations
    .map((r) => `${r.rule_key}:${r.satisfied ? "satisfied" : "violated"}`)
    .join("; ");
  const kill_switch_summary = kill_switch_evaluations
    .filter((k) => k.engaged)
    .map((k) => k.label)
    .join(", ") || "No kill switches engaged for this case.";
  const gate_summary = buildActivationGateSummary({ gate_evaluations });
  const safety_envelope_summary = buildSafetyEnvelopeSummary(row.safety_envelope_keys);

  const developer_safe_message =
    derived_outcome === "activation_ready"
      ? "In this simulation the slice would be narratively ready — no runtime is armed and no API traffic is accepted."
      : derived_outcome === "emergency_locked"
        ? "Emergency containment is active in the blueprint. Resolve kill-switch recovery steps before replaying activation cases."
        : derived_outcome === "review_required"
          ? "Human review is required before this activation story could advance — execution remains disabled in the model."
          : derived_outcome === "isolated"
            ? "Environment isolation rules are not satisfied for this scope — the slice stays quarantined in simulation."
            : derived_outcome === "blocked"
              ? "One or more blocking gates or live-placeholder rules failed — activation cannot proceed in the model."
              : "Activation prerequisites are not yet satisfied — continue rehearsing upstream Phase 5 simulators and observability seeds.";

  const operator_summary = `Case ${row.case_key}: ${passed_count} gates passed, ${failed_count} failed, ${warning_count} warnings, ${blocking_failures.length} blocking items. State=${row.activation_state}, scope=${environment_scope}, kill switches engaged=${kill_switch_evaluations.filter((k) => k.engaged).length}.`;

  return {
    case_key: row.case_key,
    case: row,
    activation_state: row.activation_state,
    activation_state_meta: state,
    environment_scope,
    environment_scope_meta: scope,
    activation_summary,
    environment_summary,
    isolation_summary,
    kill_switch_summary,
    gate_summary,
    safety_envelope_summary,
    gate_evaluations,
    isolation_evaluations,
    kill_switch_evaluations,
    safety_envelope_evaluations,
    counts: { passed_count, failed_count, warning_count, skipped_count },
    blocking_failures,
    expected_outcome: row.expected_outcome,
    derived_outcome,
    outcome_matches_expected: derived_outcome === row.expected_outcome,
    review_required,
    execution_allowed,
    external_access_allowed,
    developer_safe_message,
    operator_summary,
    explanation: row.explanation,
  };
}
