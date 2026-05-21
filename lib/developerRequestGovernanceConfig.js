/**
 * Tropicash Developer Platform — Phase 10B:
 * Request Governance & Observability Layer.
 *
 * SIMULATION + METADATA ONLY. This module:
 *   • does NOT expose or call real HTTP endpoints, workers, or webhooks
 *   • does NOT mint API keys, secrets, tokens, or credentials
 *   • does NOT enable authentication runtime, gateway enforcement, or live execution
 *   • does NOT emit telemetry, write audit logs, or touch Supabase
 *   • does NOT move money, treasury, payouts, or fraud execution
 *   • does NOT use Date.now(), Math.random(), fetch, storage, or crypto
 *
 * Builds on Phase 10A `developerSandboxRequestFlowConfig.js` and read-only
 * alignment with Phases 8A–8B, 9A–9B, 5B–5D, and 2E–2F vocabulary.
 */

import {
  SANDBOX_REQUEST_CASE_KEYS,
  SANDBOX_REQUEST_FAILURE_STATES,
  SANDBOX_REQUEST_FLOW_PHASE,
} from "./developerSandboxRequestFlowConfig";

export const REQUEST_GOVERNANCE_PHASE = "phase_10b_request_governance";

/** Default governance posture for summary helpers — preview only. */
export const REQUEST_GOVERNANCE_PREVIEW_SEED = {
  governance_state_key: "developer_visible_request_metadata",
  review_outcome_key: "approved_sandbox_rehearsal",
  visibility_rule_key: "developer_can_view_request_metadata",
  environment_key: "sandbox",
  linked_case_key: "request.wallet.balance.preview",
};

export const REQUEST_GOVERNANCE_STATES = [
  {
    state_key: "request_not_modeled",
    label: "Request not modeled",
    description:
      "No sandbox request governance row opened — simulation only, metadata only; no outbound socket, queue, or worker.",
  },
  {
    state_key: "review_ready",
    label: "Review ready",
    description:
      "Governance prerequisites satisfied to queue sandbox request rehearsal review — checklist only; still no HTTP surface or live traffic.",
  },
  {
    state_key: "pending_operator_review",
    label: "Pending operator review",
    description:
      "Operator holds the sandbox request governance narrative — no endpoint activation, no auth runtime, no execution handoff.",
  },
  {
    state_key: "approved_sandbox_rehearsal",
    label: "Approved (sandbox rehearsal)",
    description:
      "Review approved for deterministic request case rehearsal — metadata only; route previews remain labeled preview only.",
  },
  {
    state_key: "developer_visible_request_metadata",
    label: "Developer visible (request metadata)",
    description:
      "Developers may see case keys, route previews, stage labels, and outcome vocabulary — never live URLs, secrets, or production identifiers.",
  },
  {
    state_key: "request_suspended_placeholder",
    label: "Request suspended (placeholder)",
    description:
      "Request rehearsal narrated as temporarily frozen — governance story only; does not block production APIs or emit edge policy.",
  },
  {
    state_key: "request_revoked_placeholder",
    label: "Request revoked (placeholder)",
    description:
      "Placeholder invalidation for teaching audit trails — no gateway kill-switch or Supabase writes in this repository phase.",
  },
  {
    state_key: "request_archived_placeholder",
    label: "Request archived (placeholder)",
    description:
      "Historical governance row retained for audit readability — hidden from default developer views; sandbox only, metadata only.",
  },
];

export const REQUEST_VISIBILITY_RULES = [
  {
    rule_key: "developer_can_view_request_metadata",
    label: "Developer can view request metadata",
    audience: "developer",
    description:
      "Developers see case keys, method labels, route preview strings, stage keys, and outcome categories — simulation only; no execution payloads.",
  },
  {
    rule_key: "developer_cannot_execute_requests",
    label: "Developer cannot execute requests",
    audience: "developer",
    description:
      "Hard deny on real HTTP, webhooks, workers, and money movement — enforced as policy narration only in Phase 10B; preview only.",
  },
  {
    rule_key: "developer_cannot_access_live_requests",
    label: "Developer cannot access live requests",
    audience: "developer",
    description:
      "Live environment labels may appear for drills but live traffic and endpoint activation remain blocked — no live API, no live correlation ids.",
  },
  {
    rule_key: "admin_can_review_request_metadata",
    label: "Admin can review request metadata",
    audience: "admin",
    description:
      "Operators audit sandbox request cases, review outcomes, audit trail seeds, and observability vocabulary — still zero endpoint activation.",
  },
  {
    rule_key: "request_requires_entitlement",
    label: "Request requires entitlement",
    audience: "governance_policy",
    description:
      "Request governance visibility requires Phase 9A entitlement posture — product access does not auto-enable request execution.",
  },
  {
    rule_key: "request_requires_credential_placeholder",
    label: "Request requires credential placeholder",
    audience: "governance_policy",
    description:
      "Sandbox request narration requires Phase 8A approved or issued placeholder — no API keys, secrets, or auth runtime.",
  },
  {
    rule_key: "sandbox_only_request_visibility",
    label: "Sandbox-only request visibility",
    audience: "governance_policy",
    description:
      "Request governance visibility is limited to sandbox environment narration — live scopes stay blocked in seeds and copy.",
  },
  {
    rule_key: "metadata_only_request_visibility",
    label: "Metadata-only request visibility",
    audience: "governance_policy",
    description:
      "All request governance rows are configuration and console copy — route previews are not registered routes; no execution, no live traffic.",
  },
];

export const REQUEST_REVIEW_OUTCOMES = [
  {
    outcome_key: "approved_sandbox_rehearsal",
    label: "Approved (sandbox rehearsal)",
    description:
      "Operator review approves deterministic case rehearsal — metadata only; no endpoint registration and no observability emitter.",
  },
  {
    outcome_key: "rejected_needs_changes",
    label: "Rejected — needs changes",
    description:
      "Request governance returned to developer with notes — still no HTTP traffic; must re-pass entitlement and placeholder narration.",
  },
  {
    outcome_key: "suspended",
    label: "Suspended",
    description:
      "Request rehearsal suspended pending investigation — simulators remain read-only; sandbox only, no live traffic.",
  },
  {
    outcome_key: "revoked",
    label: "Revoked",
    description:
      "Placeholder request governance invalidated in audit narrative — teaches revocation without edge enforcement.",
  },
  {
    outcome_key: "archived",
    label: "Archived",
    description:
      "Row moved to historical governance archive — developers lose default visibility; operators retain audit trail seeds.",
  },
  {
    outcome_key: "deferred",
    label: "Deferred",
    description:
      "Review intentionally postponed — queue holds state without advancing to developer_visible_request_metadata.",
  },
];

export const REQUEST_GOVERNANCE_ACTORS = [
  {
    actor_key: "developer",
    label: "Developer",
    description:
      "App owner rehearsing sandbox request cases in the console — cannot self-approve elevated review or activate endpoints.",
  },
  {
    actor_key: "admin",
    label: "Admin",
    description:
      "Platform operator reviewing request governance posture and recording outcomes — no endpoint issuance or live promotion.",
  },
  {
    actor_key: "governance_policy",
    label: "Governance policy",
    description:
      "Static policy rules (visibility, entitlement, credential placeholder, sandbox boundary) — not a live policy engine.",
  },
  {
    actor_key: "system_placeholder",
    label: "System (placeholder)",
    description:
      "Deterministic automation narrator for future jobs — Phase 10B seeds only; no workers, webhooks, or Supabase writes.",
  },
  {
    actor_key: "auth_simulation_delegate",
    label: "Auth simulation delegate",
    description:
      "Read-only Phase 5B evaluateAuthSimulationCase linkage by seeded auth_case_key — trace narration only, no auth runtime.",
  },
  {
    actor_key: "gateway_simulation_delegate",
    label: "Gateway simulation delegate",
    description:
      "Read-only Phase 5C evaluateGatewaySimulationCase linkage by seeded gateway_case_key — envelope choreography only.",
  },
];

export const REQUEST_OBSERVABILITY_SIGNALS = [
  {
    signal_key: "sig_request_case_selected",
    label: "Request case selected",
    category: "lifecycle",
    description:
      "Operator selected a SANDBOX_REQUEST_CASES row — correlates to developer_request_selected stage; no emitter runs.",
    phase_2e_anchor: "planned",
    correlates_to_stage: "developer_request_selected",
  },
  {
    signal_key: "sig_credential_placeholder_checked",
    label: "Credential placeholder checked",
    category: "policy",
    description:
      "Phase 8A placeholder posture evaluated in validation summary — metadata only; aligns with Phase 2E policy metrics vocabulary.",
    phase_2e_anchor: "policy",
    correlates_to_stage: "credential_placeholder_checked",
  },
  {
    signal_key: "sig_entitlement_visibility_checked",
    label: "Entitlement visibility checked",
    category: "policy",
    description:
      "Phase 9A/9B entitlement visibility narrated — no product execution; static correlation label only.",
    phase_2e_anchor: "policy",
    correlates_to_stage: "product_entitlement_checked",
  },
  {
    signal_key: "sig_auth_delegate_linked",
    label: "Auth delegate linked",
    category: "delegation",
    description:
      "Phase 5B auth_case_key evaluation merged into request trace — simulation only; no authentication middleware.",
    phase_2e_anchor: "in_progress",
    correlates_to_stage: "auth_simulation_linked",
  },
  {
    signal_key: "sig_gateway_delegate_linked",
    label: "Gateway delegate linked",
    category: "delegation",
    description:
      "Phase 5C gateway_case_key evaluation merged — routing outcome vocabulary only; no gateway enforcement.",
    phase_2e_anchor: "in_progress",
    correlates_to_stage: "gateway_simulation_linked",
  },
  {
    signal_key: "sig_routing_delegate_linked",
    label: "Routing delegate linked",
    category: "delegation",
    description:
      "Phase 5D routing_case_key evaluation merged — post-gateway narration only; no service invocation.",
    phase_2e_anchor: "in_progress",
    correlates_to_stage: "execution_routing_linked",
  },
  {
    signal_key: "sig_audit_preview_prepared",
    label: "Audit preview prepared",
    category: "audit",
    description:
      "Append-only audit narrative placeholders assembled — aligns with Phase 2F event-store teaching seeds; no log ingestion.",
    phase_2e_anchor: "review_required",
    correlates_to_stage: "audit_preview_prepared",
  },
  {
    signal_key: "sig_observability_preview_prepared",
    label: "Observability preview prepared",
    category: "telemetry",
    description:
      "Static correlation to Phase 2E/2F vocabulary — no metrics pipeline, no trace exporter, no runtime session id from production.",
    phase_2e_anchor: "planned",
    correlates_to_stage: "observability_preview_prepared",
  },
  {
    signal_key: "sig_simulated_response_returned",
    label: "Simulated response returned",
    category: "outcome",
    description:
      "Terminal or non-terminal sandbox response preview returned to console — not an HTTP status line from a live edge.",
    phase_2e_anchor: "completed",
    correlates_to_stage: "simulated_response_returned",
  },
  {
    signal_key: "sig_request_review_required",
    label: "Request review required",
    category: "governance",
    description:
      "Non-terminal review_required outcome across auth, gateway, or routing seeds — operator lane metadata only.",
    phase_2e_anchor: "review_required",
    correlates_to_stage: "simulated_response_returned",
  },
];

export const REQUEST_AUDIT_TRAIL_SEEDS = [
  {
    audit_key: "audit_workspace_request_context",
    title: "Workspace request context seeded",
    description:
      "Workspace persona and readiness milestones provide planning context for request governance — no API enablement.",
    actor: "system_placeholder",
    governance_state: "request_not_modeled",
    simulated_step_label: "Step 1",
    visibility: "developer_can_view_request_metadata",
  },
  {
    audit_key: "audit_entitlement_linked",
    title: "Product entitlement linked",
    description:
      "Phase 9A access state and Phase 9B governance visibility referenced in request envelope — read-only alignment.",
    actor: "governance_policy",
    governance_state: "review_ready",
    simulated_step_label: "Step 2",
    visibility: "developer_can_view_request_metadata",
  },
  {
    audit_key: "audit_credential_placeholder_linked",
    title: "Credential placeholder linked",
    description:
      "Phase 8A lifecycle and Phase 8B governance seeds referenced — placeholder handle only; no secret material.",
    actor: "governance_policy",
    governance_state: "review_ready",
    simulated_step_label: "Step 3",
    visibility: "developer_can_view_request_metadata",
  },
  {
    audit_key: "audit_request_case_catalog_opened",
    title: "Request case catalog opened",
    description:
      "Operator may select from SANDBOX_REQUEST_CASES — deterministic keys only; route previews labeled preview only.",
    actor: "developer",
    governance_state: "pending_operator_review",
    simulated_step_label: "Step 4",
    visibility: "admin_can_review_request_metadata",
  },
  {
    audit_key: "audit_operator_review_completed",
    title: "Operator review completed",
    description:
      "Review outcome approved_sandbox_rehearsal recorded — still no endpoints, no live traffic, no observability emitter.",
    actor: "admin",
    governance_state: "approved_sandbox_rehearsal",
    simulated_step_label: "Step 5",
    visibility: "admin_can_review_request_metadata",
  },
  {
    audit_key: "audit_auth_gateway_routing_delegates",
    title: "Auth / gateway / routing delegates recorded",
    description:
      "Phase 5B/5C/5D evaluate*Case helpers merged into stage trace — simulation delegates only; no middleware execution.",
    actor: "auth_simulation_delegate",
    governance_state: "approved_sandbox_rehearsal",
    simulated_step_label: "Step 6",
    visibility: "developer_can_view_request_metadata",
  },
  {
    audit_key: "audit_observability_vocabulary_attached",
    title: "Observability vocabulary attached",
    description:
      "REQUEST_OBSERVABILITY_SIGNALS correlated to stage keys — Phase 2E/2F teaching alignment; no telemetry pipeline.",
    actor: "system_placeholder",
    governance_state: "developer_visible_request_metadata",
    simulated_step_label: "Step 7",
    visibility: "developer_can_view_request_metadata",
  },
  {
    audit_key: "audit_response_preview_materialized",
    title: "Response preview materialized",
    description:
      "SANDBOX_RESPONSE_PREVIEWS body shown in console — preview only; not serialized over HTTP; no production transaction ids.",
    actor: "developer",
    governance_state: "developer_visible_request_metadata",
    simulated_step_label: "Step 8",
    visibility: "developer_can_view_request_metadata",
  },
  {
    audit_key: "audit_live_environment_drill_blocked",
    title: "Live environment drill blocked",
    description:
      "Live rehearsal label attempted — isolation guard narrated; sandbox_only_request_visibility and environment guards fire.",
    actor: "governance_policy",
    governance_state: "request_suspended_placeholder",
    simulated_step_label: "Step 9",
    visibility: "admin_can_review_request_metadata",
  },
];

export const REQUEST_RESTRICTION_RATIONALES = [
  {
    rationale_key: "rat_metadata_only_request_visibility",
    title: "Metadata-only request visibility",
    summary:
      "Developers need request rehearsal context without receiving routable grants — visibility rules enforce label-only sandbox previews.",
    related_rule_keys: ["developer_can_view_request_metadata", "metadata_only_request_visibility"],
    related_state_keys: ["developer_visible_request_metadata"],
  },
  {
    rationale_key: "rat_operator_review_gate",
    title: "Operator review before visible request rehearsal",
    summary:
      "Elevated-risk request families require governance review before case catalog advances — admins see metadata, never live traffic.",
    related_rule_keys: ["admin_can_review_request_metadata", "developer_cannot_execute_requests"],
    related_state_keys: ["pending_operator_review", "approved_sandbox_rehearsal"],
  },
  {
    rationale_key: "rat_sandbox_environment_boundary",
    title: "Sandbox environment boundary",
    summary:
      "Request governance visibility requires sandbox environment narration — live scopes remain blocked across rules and audit seeds.",
    related_rule_keys: ["sandbox_only_request_visibility", "developer_cannot_access_live_requests"],
    related_state_keys: ["review_ready", "developer_visible_request_metadata"],
  },
  {
    rationale_key: "rat_entitlement_prerequisite",
    title: "Entitlement prerequisite",
    summary:
      "Unentitled products must not advance request narration — governance ties visibility to Phase 9A/9B seeds.",
    related_rule_keys: ["request_requires_entitlement"],
    related_state_keys: ["request_not_modeled", "review_ready"],
  },
  {
    rationale_key: "rat_credential_placeholder_prerequisite",
    title: "Credential placeholder prerequisite",
    summary:
      "Requests without approved placeholder posture must not advance — aligns with Phase 8A/8B without issuing secrets.",
    related_rule_keys: ["request_requires_credential_placeholder"],
    related_state_keys: ["review_ready", "approved_sandbox_rehearsal"],
  },
  {
    rationale_key: "rat_no_endpoint_activation",
    title: "No endpoint activation",
    summary:
      "route_preview strings are teaching labels — registering HTTP routes or activating edges is permanently out of scope for Phase 10B.",
    related_rule_keys: ["metadata_only_request_visibility", "developer_cannot_execute_requests"],
    related_state_keys: ["approved_sandbox_rehearsal"],
  },
  {
    rationale_key: "rat_observability_without_emitters",
    title: "Observability without emitters",
    summary:
      "Signals and audit trails document future correlation — Phase 2E/2F vocabulary only; no metrics daemons or log shippers.",
    related_rule_keys: ["metadata_only_request_visibility"],
    related_state_keys: ["developer_visible_request_metadata"],
  },
  {
    rationale_key: "rat_suspension_revocation_teaching",
    title: "Suspension and revocation teaching",
    summary:
      "Blocking models document operator and developer messaging without enforcing API kills — audit education for Phase 10B.",
    related_rule_keys: ["developer_cannot_execute_requests"],
    related_state_keys: ["request_suspended_placeholder", "request_revoked_placeholder"],
  },
];

/**
 * Deterministic links from Phase 10A failure_key values to Phase 10B blocking models and rationales.
 * @type {Readonly<Record<string, { blocking_model_key: string, rationale_key: string }>>}
 */
export const REQUEST_FAILURE_GOVERNANCE_LINKS = {
  no_credential_placeholder: {
    blocking_model_key: "credential_placeholder_block",
    rationale_key: "rat_credential_placeholder_prerequisite",
  },
  entitlement_not_visible: {
    blocking_model_key: "entitlement_visibility_block",
    rationale_key: "rat_entitlement_prerequisite",
  },
  product_restricted: {
    blocking_model_key: "entitlement_visibility_block",
    rationale_key: "rat_operator_review_gate",
  },
  missing_capability_scope: {
    blocking_model_key: "execution_routing_block",
    rationale_key: "rat_metadata_only_request_visibility",
  },
  auth_case_failed: {
    blocking_model_key: "auth_simulation_denial",
    rationale_key: "rat_operator_review_gate",
  },
  gateway_case_failed: {
    blocking_model_key: "gateway_simulation_denial",
    rationale_key: "rat_no_endpoint_activation",
  },
  routing_case_blocked: {
    blocking_model_key: "execution_routing_block",
    rationale_key: "rat_no_endpoint_activation",
  },
  invalid_payload_shape: {
    blocking_model_key: "gateway_simulation_denial",
    rationale_key: "rat_metadata_only_request_visibility",
  },
  live_environment_blocked: {
    blocking_model_key: "environment_isolation_block",
    rationale_key: "rat_sandbox_environment_boundary",
  },
  money_movement_disabled: {
    blocking_model_key: "environment_isolation_block",
    rationale_key: "rat_suspension_revocation_teaching",
  },
};

export const REQUEST_BLOCKING_MODELS = [
  {
    model_key: "entitlement_visibility_block",
    label: "Entitlement visibility block",
    trigger: "Phase 9A entitlement not visible or Phase 9B governance hides product access for the case product_key.",
    effect:
      "Request stage product_entitlement_checked fails — narration stops before auth/gateway delegates unless teaching malformed paths.",
    recovery_path:
      "Restore sandbox_access_ready or approved governance posture on Product Access — metadata only; no API enablement.",
    developer_message:
      "Sandbox request rehearsal blocked: product entitlement is not visible. Check Product Access (9A + 9B) — no request was sent.",
    operator_message:
      "Entitlement visibility block is configuration narration only — verify governance seeds; no Supabase writes.",
  },
  {
    model_key: "credential_placeholder_block",
    label: "Credential placeholder block",
    trigger: "Credential lifecycle status below approved_placeholder or governance suspends placeholder visibility.",
    effect:
      "credential_placeholder_checked stage fails — request envelope still shows placeholder handle text only.",
    recovery_path:
      "Advance Phase 8A lifecycle and Phase 8B governance to approved_placeholder — still no secret issuance.",
    developer_message:
      "Sandbox credential placeholder is not ready. Visit Credential Lifecycle (8A + 8B) — simulation only, no live API.",
    operator_message:
      "Placeholder block precedes auth simulation — coordinate with credential governance console; no vault changes.",
  },
  {
    model_key: "auth_simulation_denial",
    label: "Auth simulation denial",
    trigger: "Phase 5B evaluateAuthSimulationCase returns blocked or blocking stage failures for seeded auth_case_key.",
    effect:
      "auth_simulation_linked stage fails — gateway may be skipped in trace; outcome trends toward auth_denied.",
    recovery_path:
      "Select a passing auth case or adjust teaching case on Auth Simulator — still no authentication runtime.",
    developer_message:
      "Authentication simulation blocked this rehearsal. Inspect Auth Simulator trace — no credentials were used on the wire.",
    operator_message:
      "Auth denial is delegate narration only — document auth_case_key and derived_outcome for operator review.",
  },
  {
    model_key: "gateway_simulation_denial",
    label: "Gateway simulation denial",
    trigger: "Phase 5C evaluateGatewaySimulationCase terminal denial or blocking gateway stage failure.",
    effect:
      "gateway_simulation_linked stage fails — execution routing may not run; outcome trends toward gateway_denied.",
    recovery_path:
      "Rehearse gateway case on Gateway Simulator or pick a success-path request case — no gateway enforcement.",
    developer_message:
      "Gateway simulation rejected the request envelope. See Gateway Simulator (Phase 5C) — preview only.",
    operator_message:
      "Gateway denial teaches envelope guardrails — routing_outcome_key captured in validation summary metadata.",
  },
  {
    model_key: "execution_routing_block",
    label: "Execution routing block",
    trigger: "Phase 5D evaluateExecutionRoutingCase terminal block or missing capability routing outcome.",
    effect:
      "execution_routing_linked stage fails — simulated service invocation narration stops; outcome trends toward execution_blocked.",
    recovery_path:
      "Align capability scope on App Capabilities and rehearse routing case on Execution Routing — no workers invoked.",
    developer_message:
      "Execution routing simulation blocked delegation. See Execution Routing (Phase 5D) — no service was called.",
    operator_message:
      "Routing block is post-gateway teaching only — treasury and fraud paths remain disabled in sandbox request phase.",
  },
  {
    model_key: "environment_isolation_block",
    label: "Environment isolation block",
    trigger: "Live rehearsal label, treasury partner preview, or money_movement_disabled failure keys on the case.",
    effect:
      "Environment guard fires — sandbox_only_blocked or live_environment_blocked outcomes; observability signals still static.",
    recovery_path:
      "Return environment label to sandbox and select non-treasury cases — live paths stay disabled in Runtime Activation narratives.",
    developer_message:
      "This rehearsal cannot run outside sandbox labels. Live and treasury paths remain disabled — metadata teaching only.",
    operator_message:
      "Environment isolation is deliberate — pair with Phase 6A runtime containment copy; no edge policy engine.",
  },
];

export const REQUEST_GOVERNANCE_SAFETY_RULES = [
  "Phase 10B request governance is metadata, visibility, audit, and observability vocabulary only — no endpoints, APIs, credentials, secrets, or auth runtime.",
  "Route preview strings remain labeled preview only — they do not register routes, activate endpoints, or terminate TLS.",
  "REQUEST_OBSERVABILITY_SIGNALS correlate to Phase 10A stage keys and Phase 2E/2F teaching vocabulary — no telemetry emitters, metrics pipelines, or log shippers run.",
  "REQUEST_AUDIT_TRAIL_SEEDS use static simulated step labels — no clock timestamps, no fetch, no storage, no Supabase writes.",
  "Admin review outcomes are placeholder narration — approving or suspending in the console does not enable HTTP traffic or observability export.",
  "Visibility rules explicitly deny request execution and live traffic for developers; admins review metadata only.",
  "Blocking models teach restriction paths only — no gateway kill-switch, no fraud execution, no treasury movement.",
  `Aligns with Phase 10A sandbox request flow (${SANDBOX_REQUEST_FLOW_PHASE}) — simulation only, metadata only, no execution, no live traffic.`,
];

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

function findByKey(list, key, field) {
  return list.find((item) => item[field] === key) ?? null;
}

export function getRequestGovernanceStateMeta(stateKey) {
  return findByKey(REQUEST_GOVERNANCE_STATES, stateKey, "state_key");
}

export function getRequestVisibilityRule(ruleKey) {
  return findByKey(REQUEST_VISIBILITY_RULES, ruleKey, "rule_key");
}

export function getRequestReviewOutcomeMeta(outcomeKey) {
  return findByKey(REQUEST_REVIEW_OUTCOMES, outcomeKey, "outcome_key");
}

export function getRequestObservabilitySignals(caseKey = null) {
  const signals = [...REQUEST_OBSERVABILITY_SIGNALS];
  if (!caseKey) {
    return { phase: REQUEST_GOVERNANCE_PHASE, signals, total: signals.length };
  }
  const linked = SANDBOX_REQUEST_CASE_KEYS.includes(caseKey);
  return {
    phase: REQUEST_GOVERNANCE_PHASE,
    case_key: caseKey,
    case_linked: linked,
    signals,
    total: signals.length,
    note: linked
      ? "Signals apply to all sandbox request stages — correlation labels only; no emitter."
      : "Unknown case key — signals still listed as teaching vocabulary only.",
  };
}

export function getRequestAuditTrail() {
  return {
    phase: REQUEST_GOVERNANCE_PHASE,
    events: [...REQUEST_AUDIT_TRAIL_SEEDS],
    total_steps: REQUEST_AUDIT_TRAIL_SEEDS.length,
  };
}

export function getRequestRestrictionRationales() {
  return {
    phase: REQUEST_GOVERNANCE_PHASE,
    rationales: [...REQUEST_RESTRICTION_RATIONALES],
  };
}

export function getRequestBlockingModels() {
  return {
    phase: REQUEST_GOVERNANCE_PHASE,
    models: [...REQUEST_BLOCKING_MODELS],
  };
}

export function getRequestFailureGovernanceLink(failureKey) {
  const link = REQUEST_FAILURE_GOVERNANCE_LINKS[failureKey];
  if (!link) {
    return null;
  }
  const model = REQUEST_BLOCKING_MODELS.find((m) => m.model_key === link.blocking_model_key) ?? null;
  const rationale =
    REQUEST_RESTRICTION_RATIONALES.find((r) => r.rationale_key === link.rationale_key) ?? null;
  return {
    failure_key: failureKey,
    blocking_model_key: link.blocking_model_key,
    rationale_key: link.rationale_key,
    blocking_model: model,
    rationale,
  };
}

export function buildRequestGovernanceSummary(seed = REQUEST_GOVERNANCE_PREVIEW_SEED) {
  const state = getRequestGovernanceStateMeta(seed.governance_state_key);
  const outcome = getRequestReviewOutcomeMeta(seed.review_outcome_key);
  return (
    `Phase 10B request governance (${REQUEST_GOVERNANCE_STATES.length} states, ${REQUEST_VISIBILITY_RULES.length} visibility rules). ` +
    `Preview posture: ${state?.label ?? seed.governance_state_key} with review outcome ` +
    `${outcome?.label ?? seed.review_outcome_key}. ` +
    `Simulation only, metadata only — no execution, no live traffic, no endpoint activation. ` +
    `Builds on ${SANDBOX_REQUEST_FLOW_PHASE}.`
  );
}

export function buildRequestVisibilitySummary() {
  const keys = REQUEST_VISIBILITY_RULES.map((r) => r.rule_key).join(", ");
  return (
    `Visibility rules (${REQUEST_VISIBILITY_RULES.length}): ${keys}. ` +
    "Developers see request metadata only; execution and live traffic are denied; entitlement and credential placeholder gates apply."
  );
}

export function buildRequestObservabilitySummary(caseKey = null) {
  const signalCount = REQUEST_OBSERVABILITY_SIGNALS.length;
  const categories = [...new Set(REQUEST_OBSERVABILITY_SIGNALS.map((s) => s.category))];
  const caseNote = caseKey
    ? SANDBOX_REQUEST_CASE_KEYS.includes(caseKey)
      ? ` Linked to case ${caseKey}.`
      : ` Case ${caseKey} is not in SANDBOX_REQUEST_CASE_KEYS — vocabulary still static.`
    : "";
  return (
    `${signalCount} observability signals across ${categories.length} categories (${categories.join(", ")}). ` +
    "Aligns with Phase 2E execution status vocabulary and Phase 2F event-store teaching — no emitters, no live sessions." +
    caseNote
  );
}

export function buildRequestAuditSummary() {
  return (
    `${REQUEST_AUDIT_TRAIL_SEEDS.length} deterministic audit trail seeds with static step labels — ` +
    "append-only narration for operator and developer teaching; no log ingestion or Supabase writes."
  );
}

export function buildRequestRiskSummary() {
  const blockingCount = REQUEST_BLOCKING_MODELS.length;
  const environmentBlocks = REQUEST_BLOCKING_MODELS.filter((m) =>
    m.model_key.includes("environment"),
  ).length;
  const liveBlocked = REQUEST_VISIBILITY_RULES.some(
    (r) => r.rule_key === "developer_cannot_access_live_requests",
  );
  return {
    phase: REQUEST_GOVERNANCE_PHASE,
    blocking_model_count: blockingCount,
    environment_block_model_count: environmentBlocks,
    observability_signal_count: REQUEST_OBSERVABILITY_SIGNALS.length,
    audit_trail_seed_count: REQUEST_AUDIT_TRAIL_SEEDS.length,
    live_traffic_blocked: liveBlocked,
    endpoint_activation_risk: "none — route previews are not routes",
    execution_risk: "none — developer_cannot_execute_requests enforced",
    telemetry_emitter_risk: "none — signals are vocabulary only",
    money_movement_risk: "none — treasury cases teach guardrails only",
    summary:
      `${blockingCount} blocking models (${environmentBlocks} environment-class) teach restriction paths. ` +
      `${REQUEST_OBSERVABILITY_SIGNALS.length} observability signals and ${REQUEST_AUDIT_TRAIL_SEEDS.length} audit seeds ` +
      "are static correlation only. Live traffic blocked; no endpoints, auth runtime, workers, or Supabase writes.",
  };
}

export function getRequestGovernanceOverview(seed = REQUEST_GOVERNANCE_PREVIEW_SEED) {
  const mergedSeed = { ...REQUEST_GOVERNANCE_PREVIEW_SEED, ...seed };
  const caseKey = mergedSeed.linked_case_key ?? null;
  return {
    phase: REQUEST_GOVERNANCE_PHASE,
    seed: { ...mergedSeed },
    state: getRequestGovernanceStateMeta(mergedSeed.governance_state_key),
    review_outcome: getRequestReviewOutcomeMeta(mergedSeed.review_outcome_key),
    visibility_rule: getRequestVisibilityRule(mergedSeed.visibility_rule_key),
    governance_summary: buildRequestGovernanceSummary(mergedSeed),
    visibility_summary: buildRequestVisibilitySummary(),
    observability_summary: buildRequestObservabilitySummary(caseKey),
    audit_summary: buildRequestAuditSummary(),
    risk_summary: buildRequestRiskSummary(),
    observability: getRequestObservabilitySignals(caseKey),
    audit_trail: getRequestAuditTrail(),
    restriction_rationales: getRequestRestrictionRationales(),
    blocking_models: getRequestBlockingModels(),
    sandbox_request_flow_phase: SANDBOX_REQUEST_FLOW_PHASE,
    linked_case_key: caseKey,
    linked_case_valid: caseKey ? SANDBOX_REQUEST_CASE_KEYS.includes(caseKey) : false,
    sandbox_request_case_count: SANDBOX_REQUEST_CASE_KEYS.length,
  };
}

function assertRequestGovernanceAlignment() {
  const stateKeys = new Set(REQUEST_GOVERNANCE_STATES.map((s) => s.state_key));
  const ruleKeys = new Set(REQUEST_VISIBILITY_RULES.map((r) => r.rule_key));
  const outcomeKeys = new Set(REQUEST_REVIEW_OUTCOMES.map((o) => o.outcome_key));

  if (REQUEST_GOVERNANCE_STATES.length !== 8) {
    throw new Error(`Phase 10B expects 8 governance states, got ${REQUEST_GOVERNANCE_STATES.length}`);
  }
  if (REQUEST_VISIBILITY_RULES.length !== 8) {
    throw new Error(`Phase 10B expects 8 visibility rules, got ${REQUEST_VISIBILITY_RULES.length}`);
  }
  if (REQUEST_REVIEW_OUTCOMES.length !== 6) {
    throw new Error(`Phase 10B expects 6 review outcomes, got ${REQUEST_REVIEW_OUTCOMES.length}`);
  }
  if (REQUEST_GOVERNANCE_ACTORS.length !== 6) {
    throw new Error(`Phase 10B expects 6 governance actors, got ${REQUEST_GOVERNANCE_ACTORS.length}`);
  }
  if (REQUEST_OBSERVABILITY_SIGNALS.length < 8) {
    throw new Error(`Phase 10B expects 8+ observability signals, got ${REQUEST_OBSERVABILITY_SIGNALS.length}`);
  }
  if (REQUEST_AUDIT_TRAIL_SEEDS.length < 8) {
    throw new Error(`Phase 10B expects 8+ audit trail seeds, got ${REQUEST_AUDIT_TRAIL_SEEDS.length}`);
  }
  if (REQUEST_RESTRICTION_RATIONALES.length !== 8) {
    throw new Error(`Phase 10B expects 8 restriction rationales, got ${REQUEST_RESTRICTION_RATIONALES.length}`);
  }
  if (REQUEST_BLOCKING_MODELS.length !== 6) {
    throw new Error(`Phase 10B expects 6 blocking models, got ${REQUEST_BLOCKING_MODELS.length}`);
  }

  const seed = REQUEST_GOVERNANCE_PREVIEW_SEED;
  if (!stateKeys.has(seed.governance_state_key)) {
    throw new Error(`Phase 10B preview seed references unknown governance_state_key ${seed.governance_state_key}`);
  }
  if (!ruleKeys.has(seed.visibility_rule_key)) {
    throw new Error(`Phase 10B preview seed references unknown visibility_rule_key ${seed.visibility_rule_key}`);
  }
  if (!outcomeKeys.has(seed.review_outcome_key)) {
    throw new Error(`Phase 10B preview seed references unknown review_outcome_key ${seed.review_outcome_key}`);
  }
  if (seed.linked_case_key && !SANDBOX_REQUEST_CASE_KEYS.includes(seed.linked_case_key)) {
    throw new Error(`Phase 10B preview seed references unknown linked_case_key ${seed.linked_case_key}`);
  }

  for (const evt of REQUEST_AUDIT_TRAIL_SEEDS) {
    if (!stateKeys.has(evt.governance_state)) {
      throw new Error(`Phase 10B audit ${evt.audit_key} references unknown governance_state ${evt.governance_state}`);
    }
  }

  const blockingModelKeys = new Set(REQUEST_BLOCKING_MODELS.map((m) => m.model_key));
  const rationaleKeys = new Set(REQUEST_RESTRICTION_RATIONALES.map((r) => r.rationale_key));
  for (const failure of SANDBOX_REQUEST_FAILURE_STATES) {
    const link = REQUEST_FAILURE_GOVERNANCE_LINKS[failure.failure_key];
    if (!link) {
      throw new Error(`Phase 10B missing REQUEST_FAILURE_GOVERNANCE_LINKS for ${failure.failure_key}`);
    }
    if (!blockingModelKeys.has(link.blocking_model_key)) {
      throw new Error(
        `Phase 10B failure link ${failure.failure_key} references unknown blocking_model_key ${link.blocking_model_key}`,
      );
    }
    if (!rationaleKeys.has(link.rationale_key)) {
      throw new Error(
        `Phase 10B failure link ${failure.failure_key} references unknown rationale_key ${link.rationale_key}`,
      );
    }
  }
}

assertRequestGovernanceAlignment();
