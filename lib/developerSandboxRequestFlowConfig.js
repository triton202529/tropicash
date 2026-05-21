/**
 * Tropicash Developer Platform — Phase 10A:
 * Sandbox API request & flow simulation layer (metadata / previews only).
 *
 * SIMULATION + METADATA ONLY. This module:
 *   • does NOT expose or call real HTTP endpoints, workers, or webhooks
 *   • does NOT mint API keys, secrets, tokens, or credentials
 *   • does NOT enable authentication runtime, gateway enforcement, or live execution
 *   • does NOT touch Supabase, wallets, treasury, payouts, or money movement
 *   • does NOT use Date.now(), Math.random(), fetch, storage, or crypto
 *
 * Read-only alignment with Phases 8A–8B, 9A–9B, and 5B–5D simulation seeds.
 */

import {
  evaluateAuthSimulationCase,
  getAuthSimulationCase,
  DEVELOPER_AUTH_SIMULATION_PHASE,
} from "./developerAuthSimulationConfig";
import {
  CREDENTIAL_GOVERNANCE_PHASE,
  CREDENTIAL_GOVERNANCE_PREVIEW_SEED,
} from "./developerCredentialGovernanceConfig";
import {
  CREDENTIAL_LIFECYCLE_PHASE,
  SANDBOX_CREDENTIAL_PREVIEW_SEED,
} from "./developerCredentialLifecycleConfig";
import {
  evaluateExecutionRoutingCase,
  getExecutionRoutingCase,
  DEVELOPER_EXECUTION_ROUTING_PHASE,
} from "./developerExecutionRoutingConfig";
import {
  evaluateGatewaySimulationCase,
  getGatewaySimulationCase,
  DEVELOPER_GATEWAY_SIMULATION_PHASE,
} from "./developerGatewaySimulationConfig";
import {
  PRODUCT_ACCESS_PHASE,
  PRODUCT_ACCESS_PREVIEW_SEED,
  PRODUCT_ACCESS_STATES,
} from "./developerProductAccessConfig";
import {
  PRODUCT_GOVERNANCE_PHASE,
  PRODUCT_GOVERNANCE_PREVIEW_SEED,
} from "./developerProductGovernanceConfig";
import { getProductByKey } from "./developerProductCatalogConfig";

export const SANDBOX_REQUEST_FLOW_PHASE = "phase_10a_sandbox_request_flow";

const CREDENTIAL_PLACEHOLDER_HANDLE = "sandbox_credential_placeholder";
const ROUTE_PREVIEW_PREFIX = "[preview only]";

/** @typedef {'passed' | 'failed' | 'skipped' | 'warning'} SandboxRequestStageResult */
/** @typedef {'modeled' | 'planned' | 'future'} SandboxRequestDocStatus */

export const SANDBOX_REQUEST_METHODS = [
  { method: "GET", label: "GET", description: "Conceptual read — sandbox response preview only; no HTTP surface." },
  { method: "POST", label: "POST", description: "Conceptual create/simulate — no mutation or money movement." },
  { method: "PATCH", label: "PATCH", description: "Conceptual partial update rehearsal — metadata only." },
  { method: "DELETE", label: "DELETE", description: "Conceptual delete rehearsal — no resource destruction." },
];

/**
 * Twelve ordered surfaces from case selection through simulated response return.
 * @type {ReadonlyArray<{
 *   stage_key: string,
 *   label: string,
 *   description: string,
 *   blocking_by_default: boolean,
 *   status: SandboxRequestDocStatus,
 * }>}
 */
export const SANDBOX_REQUEST_FLOW_STAGES = [
  {
    stage_key: "developer_request_selected",
    label: "Developer request selected",
    description:
      "Operator picks a seeded sandbox request case — no outbound socket, queue, or worker is contacted.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "credential_placeholder_checked",
    label: "Credential placeholder checked",
    description:
      "Phase 8A lifecycle posture must show an approved or issued placeholder before entitlement narration advances.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "product_entitlement_checked",
    label: "Product entitlement checked",
    description:
      "Phase 9A access state and Phase 9B governance visibility must allow sandbox entitlement previews for the product family.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "capability_scope_checked",
    label: "Capability scope checked",
    description:
      "Requested capability_key must align with catalog and app capability assignments — configuration bridge only.",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "auth_simulation_linked",
    label: "Auth simulation linked",
    description:
      "Delegates into Phase 5B evaluateAuthSimulationCase for the seeded auth_case_key — static trace only.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "gateway_simulation_linked",
    label: "Gateway simulation linked",
    description:
      "Delegates into Phase 5C evaluateGatewaySimulationCase for the seeded gateway_case_key — envelope choreography only.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "execution_routing_linked",
    label: "Execution routing linked",
    description:
      "Delegates into Phase 5D evaluateExecutionRoutingCase for the seeded routing_case_key — post-gateway narration only.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "request_payload_shape_checked",
    label: "Request payload shape checked",
    description:
      "Validates conceptual JSON preview fields against case seeds — does not parse live request bodies.",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "sandbox_response_selected",
    label: "Sandbox response selected",
    description:
      "Chooses a deterministic SANDBOX_RESPONSE_PREVIEWS row — labeled preview only; never a live API body.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "audit_preview_prepared",
    label: "Audit preview prepared",
    description:
      "Assembles append-only audit narrative placeholders — no log ingestion or Supabase writes.",
    blocking_by_default: false,
    status: "planned",
  },
  {
    stage_key: "observability_preview_prepared",
    label: "Observability preview prepared",
    description:
      "Static correlation to Phase 2E/2F vocabulary — no telemetry emitter runs in this phase.",
    blocking_by_default: false,
    status: "planned",
  },
  {
    stage_key: "simulated_response_returned",
    label: "Simulated response returned",
    description:
      "Terminal or intentionally non-terminal sandbox response preview returned to the console — not an HTTP response.",
    blocking_by_default: true,
    status: "modeled",
  },
];

export const SANDBOX_REQUEST_OUTCOMES = [
  {
    outcome_key: "simulated_success",
    label: "Simulated success",
    category: "success",
    terminal: true,
    developer_message: "Sandbox request rehearsal completed — response is a preview only; no API executed.",
    operator_message: "All blocking stages passed or degraded with warnings; response preview materialized.",
  },
  {
    outcome_key: "review_required",
    label: "Review required",
    category: "review",
    terminal: false,
    developer_message: "Sandbox request paused for governance review — no money moved and no webhook delivered.",
    operator_message: "Non-terminal review posture from auth, gateway, or routing seeds — operator lane metadata only.",
  },
  {
    outcome_key: "entitlement_missing",
    label: "Entitlement missing",
    category: "access",
    terminal: true,
    developer_message: "Product entitlement preview is not visible for this app — check Product Access (Phase 9A + 9B).",
    operator_message: "Entitlement visibility or governance seeds block sandbox access narration.",
  },
  {
    outcome_key: "credential_not_ready",
    label: "Credential not ready",
    category: "credential",
    terminal: true,
    developer_message: "Sandbox credential placeholder is not ready — visit Credential Lifecycle (Phase 8A + 8B).",
    operator_message: "Lifecycle or governance posture does not satisfy approved_placeholder narration.",
  },
  {
    outcome_key: "capability_missing",
    label: "Capability missing",
    category: "access",
    terminal: true,
    developer_message: "Required capability scope is not assigned — map capabilities on App Capabilities first.",
    operator_message: "Capability projection failed before gateway or routing could safely continue.",
  },
  {
    outcome_key: "gateway_denied",
    label: "Gateway denied",
    category: "gateway",
    terminal: true,
    developer_message: "Gateway simulation rejected the request envelope — see Gateway Simulator (Phase 5C).",
    operator_message: "Phase 5C routing outcome is terminal denial — no execution handoff narrated.",
  },
  {
    outcome_key: "auth_denied",
    label: "Auth denied",
    category: "auth",
    terminal: true,
    developer_message: "Authentication simulation blocked the request — see Auth Simulator (Phase 5B).",
    operator_message: "Phase 5B derived outcome is blocked — gateway may not have been evaluated.",
  },
  {
    outcome_key: "malformed_preview",
    label: "Malformed preview",
    category: "validation",
    terminal: true,
    developer_message: "Request payload preview failed shape checks — fix seeded fields; still no live API call.",
    operator_message: "Payload preview validation failed deterministically for teaching malformed envelopes.",
  },
  {
    outcome_key: "execution_blocked",
    label: "Execution blocked",
    category: "routing",
    terminal: true,
    developer_message: "Execution routing simulation blocked downstream delegation — see Execution Routing (Phase 5D).",
    operator_message: "Phase 5D terminal routing outcome prevents simulated service invocation narration.",
  },
  {
    outcome_key: "sandbox_only_blocked",
    label: "Sandbox-only blocked",
    category: "environment",
    terminal: true,
    developer_message: "This rehearsal cannot run outside sandbox labels — live and treasury paths remain disabled.",
    operator_message: "Environment isolation or money-movement guardrails fired — metadata teaching only.",
  },
];

export const SANDBOX_RESPONSE_TYPES = [
  {
    type_key: "json_preview",
    label: "JSON preview object",
    description: "Deterministic object returned in console — not serialized over HTTP.",
  },
  {
    type_key: "empty_preview",
    label: "Empty preview",
    description: "Intentionally empty body for blocked cases — still not a 204 from a live edge.",
  },
  {
    type_key: "error_preview",
    label: "Error preview envelope",
    description: "Teaching failure object with developer-safe copy — no stack traces from production.",
  },
  {
    type_key: "review_preview",
    label: "Review interstitial preview",
    description: "Non-terminal hold object — pairs with review_required outcomes.",
  },
];

export const SANDBOX_REQUEST_FAILURE_STATES = [
  {
    failure_key: "no_credential_placeholder",
    category: "credential",
    severity: "blocking",
    terminal: true,
    developer_message: "No sandbox credential placeholder is ready for this app.",
    operator_message: "Credential lifecycle status must reach approved_placeholder or issued_placeholder.",
  },
  {
    failure_key: "entitlement_not_visible",
    category: "entitlement",
    severity: "blocking",
    terminal: true,
    developer_message: "Product entitlement is not visible in sandbox previews.",
    operator_message: "Phase 9B visibility rules hide entitlement — governance review may be required.",
  },
  {
    failure_key: "product_restricted",
    category: "governance",
    severity: "blocking",
    terminal: true,
    developer_message: "Product is restricted for sandbox rehearsal — operator review required.",
    operator_message: "Restricted or governance_blocked entitlement seeds prevent preview advancement.",
  },
  {
    failure_key: "missing_capability_scope",
    category: "capability",
    severity: "blocking",
    terminal: true,
    developer_message: "Capability scope for this request is not assigned to the app.",
    operator_message: "Capability projection mismatch — align App Capabilities with catalog keys.",
  },
  {
    failure_key: "auth_case_failed",
    category: "auth",
    severity: "blocking",
    terminal: true,
    developer_message: "Linked authentication simulation failed — inspect Auth Simulator trace.",
    operator_message: "Phase 5B stage trace contains blocking failures for the seeded auth_case_key.",
  },
  {
    failure_key: "gateway_case_failed",
    category: "gateway",
    severity: "blocking",
    terminal: true,
    developer_message: "Linked gateway simulation rejected the envelope.",
    operator_message: "Phase 5C terminal routing outcome or blocking stage failure.",
  },
  {
    failure_key: "routing_case_blocked",
    category: "routing",
    severity: "blocking",
    terminal: true,
    developer_message: "Execution routing simulation blocked delegation.",
    operator_message: "Phase 5D terminal_outcome or blocking routing trace row.",
  },
  {
    failure_key: "invalid_payload_shape",
    category: "validation",
    severity: "blocking",
    terminal: true,
    developer_message: "Request payload preview is missing required fields.",
    operator_message: "Seeded request_payload_preview failed deterministic shape validation.",
  },
  {
    failure_key: "live_environment_blocked",
    category: "environment",
    severity: "blocking",
    terminal: true,
    developer_message: "Live environment labels are blocked in sandbox request simulation.",
    operator_message: "Rehearsal environment override attempted live path — isolation guard fired.",
  },
  {
    failure_key: "money_movement_disabled",
    category: "treasury",
    severity: "blocking",
    terminal: true,
    developer_message: "Money movement and treasury execution remain disabled in sandbox previews.",
    operator_message: "Treasury or payout families are teaching-only — no funds move in this repository phase.",
  },
];

const OUTCOME_MAP = Object.fromEntries(SANDBOX_REQUEST_OUTCOMES.map((o) => [o.outcome_key, o]));
const FAILURE_MAP = Object.fromEntries(SANDBOX_REQUEST_FAILURE_STATES.map((f) => [f.failure_key, f]));

const READY_CREDENTIAL_STATUSES = new Set(["approved_placeholder", "issued_placeholder"]);
const READY_ENTITLEMENT_STATES = new Set(["sandbox_access_ready", "credential_ready_placeholder"]);

/**
 * Deterministic response preview bodies — preview only, no secrets or live identifiers.
 * @type {Record<string, { preview_key: string, response_type: string, body: Record<string, unknown> }>}
 */
export const SANDBOX_RESPONSE_PREVIEWS = {
  wallet_balance_preview: {
    preview_key: "wallet_balance_preview",
    response_type: "json_preview",
    body: {
      environment: "sandbox",
      status: "simulated_success",
      balance_preview: "100.00",
      currency: "XCD",
      note: "Preview value only — no real wallet balance returned.",
    },
  },
  wallet_funding_preview: {
    preview_key: "wallet_funding_preview",
    response_type: "json_preview",
    body: {
      environment: "sandbox",
      status: "simulated_success",
      funding_preview_id: "sim_funding_preview_001",
      note: "Simulation only — no funds credited.",
    },
  },
  send_money_simulation: {
    preview_key: "send_money_simulation",
    response_type: "review_preview",
    body: {
      environment: "sandbox",
      status: "review_required",
      transfer_preview_id: "sim_transfer_preview_001",
      note: "Simulation only — no money moved.",
    },
  },
  transaction_history_preview: {
    preview_key: "transaction_history_preview",
    response_type: "json_preview",
    body: {
      environment: "sandbox",
      status: "simulated_success",
      entries_preview_count: 3,
      note: "Preview ledger rows only — no statement export executed.",
    },
  },
  notifications_preview: {
    preview_key: "notifications_preview",
    response_type: "json_preview",
    body: {
      environment: "sandbox",
      status: "simulated_success",
      notifications_preview_count: 2,
      note: "Preview only — no push or email dispatch.",
    },
  },
  fraud_alerts_preview: {
    preview_key: "fraud_alerts_preview",
    response_type: "review_preview",
    body: {
      environment: "sandbox",
      status: "review_required",
      alert_preview_count: 1,
      note: "Placeholder alert — no fraud engine execution.",
    },
  },
  analytics_summary_preview: {
    preview_key: "analytics_summary_preview",
    response_type: "json_preview",
    body: {
      environment: "sandbox",
      status: "simulated_success",
      metric_preview_labels: ["requests_rehearsed", "success_rate_preview"],
      note: "Static analytics envelope — aligns with Phase 4E seeds only.",
    },
  },
  webhook_event_preview: {
    preview_key: "webhook_event_preview",
    response_type: "json_preview",
    body: {
      environment: "sandbox",
      event_type: "payment.preview.created",
      delivery_status: "not_delivered",
      note: "Preview only — no webhook sent.",
    },
  },
  treasury_blocked_preview: {
    preview_key: "treasury_blocked_preview",
    response_type: "error_preview",
    body: {
      environment: "sandbox",
      status: "sandbox_only_blocked",
      reason: "money_movement_disabled",
      note: "Treasury rehearsal blocked — no partner ledger access.",
    },
  },
  live_environment_blocked_preview: {
    preview_key: "live_environment_blocked_preview",
    response_type: "error_preview",
    body: {
      environment: "sandbox",
      status: "sandbox_only_blocked",
      reason: "live_environment_blocked",
      note: "Live labels are teaching-only in this simulator.",
    },
  },
  malformed_payload_preview: {
    preview_key: "malformed_payload_preview",
    response_type: "error_preview",
    body: {
      environment: "sandbox",
      status: "malformed_preview",
      note: "Payload shape validation failed — still no HTTP round trip.",
    },
  },
};

/**
 * Ten sandbox request cases — keys per Phase 10A spec.
 * @type {ReadonlyArray<{
 *   case_key: string,
 *   title: string,
 *   method: string,
 *   route_preview: string,
 *   product_key: string,
 *   capability_key: string,
 *   credential_status: string,
 *   entitlement_state: string,
 *   auth_case_key: string,
 *   gateway_case_key: string,
 *   routing_case_key: string,
 *   expected_outcome: string,
 *   request_payload_preview: Record<string, unknown>,
 *   response_preview_key: string,
 *   failure_state_keys: ReadonlyArray<string>,
 *   explanation: string,
 * }>}
 */
export const SANDBOX_REQUEST_CASES = [
  {
    case_key: "request.wallet.balance.preview",
    title: "Wallet balance — sandbox read preview",
    method: "GET",
    route_preview: `${ROUTE_PREVIEW_PREFIX} GET /v1/sandbox/wallet/balance`,
    product_key: "prod_wallet_balance_read",
    capability_key: "wallet.read",
    credential_status: "approved_placeholder",
    entitlement_state: "sandbox_access_ready",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    gateway_case_key: "gateway.wallet.preview.success",
    routing_case_key: "routing.wallet.preview.success",
    expected_outcome: "simulated_success",
    request_payload_preview: { account_preview_label: "sandbox_wallet_alpha" },
    response_preview_key: "wallet_balance_preview",
    failure_state_keys: [],
    explanation:
      "Happy-path read: credential placeholder, entitlement, and Phase 5B/5C/5D seeds align for a balance preview object.",
  },
  {
    case_key: "request.wallet.funding.simulate",
    title: "Wallet funding — simulate action preview",
    method: "POST",
    route_preview: `${ROUTE_PREVIEW_PREFIX} POST /v1/sandbox/wallet/funding/simulate`,
    product_key: "prod_wallet_reserve_sim",
    capability_key: "wallet.reserve",
    credential_status: "approved_placeholder",
    entitlement_state: "sandbox_access_ready",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    gateway_case_key: "gateway.sandbox.preview.rate_budget_warning",
    routing_case_key: "routing.transfer.simulate.success",
    expected_outcome: "simulated_success",
    request_payload_preview: { amount_preview: "25.00", currency: "XCD" },
    response_preview_key: "wallet_funding_preview",
    failure_state_keys: [],
    explanation:
      "Funding rehearsal with gateway rate-limit warning surface — routing still narrates success with degraded handoff.",
  },
  {
    case_key: "request.send.money.simulate",
    title: "Send money — review-required simulation",
    method: "POST",
    route_preview: `${ROUTE_PREVIEW_PREFIX} POST /v1/sandbox/transfers/simulate`,
    product_key: "prod_payment_capture_review",
    capability_key: "payment.capture",
    credential_status: "approved_placeholder",
    entitlement_state: "sandbox_access_ready",
    auth_case_key: "auth_case_capture_review_hold",
    gateway_case_key: "gateway.payment.preview.review_branch",
    routing_case_key: "routing.transfer.review_required",
    expected_outcome: "review_required",
    request_payload_preview: { recipient_preview_label: "sandbox_peer_beta", amount_preview: "10.00" },
    response_preview_key: "send_money_simulation",
    failure_state_keys: [],
    explanation:
      "Non-terminal review posture across auth, gateway, and routing — response preview stresses no money moved.",
  },
  {
    case_key: "request.transaction.history.preview",
    title: "Transaction history — statement preview",
    method: "GET",
    route_preview: `${ROUTE_PREVIEW_PREFIX} GET /v1/sandbox/transactions/preview`,
    product_key: "prod_statement_export_bundle",
    capability_key: "wallet.read",
    credential_status: "approved_placeholder",
    entitlement_state: "sandbox_access_ready",
    auth_case_key: "auth_case_statement_export_invalid_window",
    gateway_case_key: "gateway.wallet.preview.malformed_reserve",
    routing_case_key: "routing.transfer.missing_capability",
    expected_outcome: "malformed_preview",
    request_payload_preview: {},
    response_preview_key: "malformed_payload_preview",
    failure_state_keys: ["invalid_payload_shape", "auth_case_failed"],
    explanation:
      "Teaching malformed export window and missing payload fields — auth and gateway seeds fail before routing binds.",
  },
  {
    case_key: "request.notifications.preview",
    title: "Notifications — dispatch preview",
    method: "GET",
    route_preview: `${ROUTE_PREVIEW_PREFIX} GET /v1/sandbox/notifications/preview`,
    product_key: "prod_notification_dispatch",
    capability_key: "wallet.read",
    credential_status: "approved_placeholder",
    entitlement_state: "sandbox_access_ready",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    gateway_case_key: "gateway.wallet.preview.success",
    routing_case_key: "routing.wallet.preview.success",
    expected_outcome: "simulated_success",
    request_payload_preview: { channel_preview: "in_app" },
    response_preview_key: "notifications_preview",
    failure_state_keys: [],
    explanation: "Lightweight notification preview using wallet read posture — no dispatch workers.",
  },
  {
    case_key: "request.fraud.alerts.placeholder",
    title: "Fraud alerts — placeholder escalation",
    method: "GET",
    route_preview: `${ROUTE_PREVIEW_PREFIX} GET /v1/sandbox/fraud/alerts/preview`,
    product_key: "prod_execution_trace_preview",
    capability_key: "wallet.read",
    credential_status: "approved_placeholder",
    entitlement_state: "restricted",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    gateway_case_key: "gateway.governance.preview.hard_gate",
    routing_case_key: "routing.sentinel.reporting.preview",
    expected_outcome: "gateway_denied",
    request_payload_preview: { severity_preview: "medium" },
    response_preview_key: "fraud_alerts_preview",
    failure_state_keys: ["product_restricted", "gateway_case_failed"],
    explanation:
      "Restricted entitlement plus governance gateway hard gate — fraud alert preview remains metadata-only.",
  },
  {
    case_key: "request.analytics.summary.preview",
    title: "Analytics summary — static envelope",
    method: "GET",
    route_preview: `${ROUTE_PREVIEW_PREFIX} GET /v1/sandbox/analytics/summary`,
    product_key: "prod_wallet_balance_read",
    capability_key: "wallet.read",
    credential_status: "approved_placeholder",
    entitlement_state: "sandbox_access_ready",
    auth_case_key: "auth_case_balance_read_sandbox_ok",
    gateway_case_key: "gateway.wallet.preview.success",
    routing_case_key: "routing.settlement.delayed",
    expected_outcome: "simulated_success",
    request_payload_preview: { window_preview: "7d" },
    response_preview_key: "analytics_summary_preview",
    failure_state_keys: [],
    explanation:
      "Analytics preview with delayed settlement routing narration — still returns static summary metrics only.",
  },
  {
    case_key: "request.webhook.event.preview",
    title: "Webhook event — delivery preview",
    method: "POST",
    route_preview: `${ROUTE_PREVIEW_PREFIX} POST /v1/sandbox/webhooks/events/preview`,
    product_key: "prod_partner_webhook_catalog",
    capability_key: "wallet.read",
    credential_status: "approved_placeholder",
    entitlement_state: "sandbox_access_ready",
    auth_case_key: "auth_case_webhook_catalog_ok",
    gateway_case_key: "gateway.wallet.preview.success",
    routing_case_key: "routing.wallet.preview.success",
    expected_outcome: "simulated_success",
    request_payload_preview: { event_family_preview: "payment.preview" },
    response_preview_key: "webhook_event_preview",
    failure_state_keys: [],
    explanation:
      "Webhook catalog auth seed with not_delivered status — emphasizes no webhook worker or signing material.",
  },
  {
    case_key: "request.treasury.placeholder.blocked",
    title: "Treasury partner — money movement blocked",
    method: "POST",
    route_preview: `${ROUTE_PREVIEW_PREFIX} POST /v1/sandbox/treasury/partner/preview`,
    product_key: "prod_treasury_partner_read",
    capability_key: "wallet.read",
    credential_status: "approved_placeholder",
    entitlement_state: "sandbox_access_ready",
    auth_case_key: "auth_case_internal_treasury_partner_deny",
    gateway_case_key: "gateway.checkout.preview.capability_denied",
    routing_case_key: "routing.transfer.missing_capability",
    expected_outcome: "sandbox_only_blocked",
    request_payload_preview: { partner_preview_label: "treasury_rehearsal" },
    response_preview_key: "treasury_blocked_preview",
    failure_state_keys: ["money_movement_disabled", "auth_case_failed", "routing_case_blocked"],
    explanation:
      "Treasury deny auth seed and capability denial gateway — money movement guardrails always terminal in sandbox.",
  },
  {
    case_key: "request.live.environment.blocked",
    title: "Live environment — isolation blocked",
    method: "GET",
    route_preview: `${ROUTE_PREVIEW_PREFIX} GET /v1/sandbox/wallet/balance`,
    product_key: "prod_wallet_balance_read",
    capability_key: "wallet.read",
    credential_status: "approved_placeholder",
    entitlement_state: "sandbox_access_ready",
    auth_case_key: "auth_case_live_eval_on_sandbox_credential",
    gateway_case_key: "gateway.wallet.preview.live_environment_drill",
    routing_case_key: "routing.triton.bridge.preview",
    expected_outcome: "sandbox_only_blocked",
    request_payload_preview: { environment_label: "live_rehearsal" },
    response_preview_key: "live_environment_blocked_preview",
    failure_state_keys: ["live_environment_blocked"],
    explanation:
      "Live rehearsal label drill: sandbox evaluation may pass locally while live override narrates isolation block.",
  },
];

export const SANDBOX_REQUEST_SAFETY_RULES = [
  "Simulation only, metadata only, preview only — no execution, no live request traffic, no endpoint activation, and no money movement.",
  "Phase 10A is configuration storytelling — never open sockets, terminate TLS, or call a live API edge.",
  `credential_reference MUST remain placeholder text (e.g. "${CREDENTIAL_PLACEHOLDER_HANDLE}") — no API keys or webhook secrets.`,
  "route_preview strings are labeled preview only — they do not register routes or activate endpoints.",
  "SANDBOX_RESPONSE_PREVIEWS never include secrets, tokens, live URLs, real balances, execution ids, or production transaction ids.",
  "evaluateAuthSimulationCase, evaluateGatewaySimulationCase, and evaluateExecutionRoutingCase only read static seeds — no middleware or Supabase.",
  "Money movement, treasury, payout, and fraud execution subsystems remain disabled — blocked cases teach guardrails only.",
  "Product access (9A + 9B) and credential lifecycle (8A + 8B) alignment is read-only — this module does not grant entitlements or issue credentials.",
];

const METHOD_MAP = Object.fromEntries(SANDBOX_REQUEST_METHODS.map((m) => [m.method, m]));

function countStageResults(trace) {
  const counts = { passed: 0, failed: 0, warning: 0, skipped: 0 };
  for (const step of trace) {
    if (counts[step.result] !== undefined) counts[step.result] += 1;
  }
  return counts;
}

function labelRoutePreview(routePreview) {
  if (routePreview.startsWith(ROUTE_PREVIEW_PREFIX)) return routePreview;
  return `${ROUTE_PREVIEW_PREFIX} ${routePreview}`;
}

function credentialReady(statusKey) {
  return READY_CREDENTIAL_STATUSES.has(statusKey);
}

function entitlementReady(stateKey) {
  return READY_ENTITLEMENT_STATES.has(stateKey) || stateKey === "sandbox_access_ready";
}

function payloadShapeValid(payload) {
  if (!payload || typeof payload !== "object") return false;
  if (Object.keys(payload).length === 0) return false;
  return true;
}

function authBlocked(authEvaluation) {
  if (!authEvaluation) return true;
  if (authEvaluation.derived_outcome === "blocked") return true;
  const trace = authEvaluation.stage_trace ?? [];
  return trace.some((s) => s.blocking && s.result === "failed");
}

function gatewayBlocked(gatewayEvaluation) {
  if (!gatewayEvaluation) return true;
  if (gatewayEvaluation.terminal_outcome && gatewayEvaluation.routing_outcome?.category !== "success") {
    if (gatewayEvaluation.routing_outcome?.outcome_key === "gateway.routing.review_held_non_terminal") {
      return false;
    }
    return gatewayEvaluation.routing_outcome?.terminal !== false;
  }
  const trace = gatewayEvaluation.stage_trace ?? [];
  return trace.some((s) => s.blocking && s.result === "failed");
}

function routingBlocked(routingEvaluation) {
  if (!routingEvaluation) return true;
  if (routingEvaluation.terminal_outcome && routingEvaluation.routing_outcome?.category === "success") {
    return false;
  }
  if (routingEvaluation.routing_outcome?.category === "review") return false;
  return Boolean(routingEvaluation.terminal_outcome);
}

/**
 * @param {string} caseKey
 */
export function getSandboxRequestCase(caseKey) {
  return SANDBOX_REQUEST_CASES.find((c) => c.case_key === caseKey) ?? null;
}

/**
 * @param {string} previewKey
 */
export function getSandboxResponsePreview(previewKey) {
  const row = SANDBOX_RESPONSE_PREVIEWS[previewKey];
  if (!row) return null;
  return {
    preview_key: row.preview_key,
    response_type: row.response_type,
    body: { ...row.body },
    note: "Preview only — not an HTTP response body from a live endpoint.",
  };
}

/**
 * @param {string | (typeof SANDBOX_REQUEST_CASES)[number]} caseInput
 * @param {string} [environment]
 */
export function buildSandboxRequestEnvelope(caseInput, environment = "sandbox") {
  const row = typeof caseInput === "string" ? getSandboxRequestCase(caseInput) : caseInput;
  if (!row) {
    return {
      case_key: "unknown",
      method: "GET",
      route_preview: `${ROUTE_PREVIEW_PREFIX} /v1/sandbox/unknown`,
      environment,
      product_key: null,
      capability_key: null,
      credential_placeholder: CREDENTIAL_PLACEHOLDER_HANDLE,
      credential_status: "not_requested",
      entitlement_state: "unavailable",
      auth_case_key: null,
      gateway_case_key: null,
      routing_case_key: null,
      request_payload_preview: {},
      phase_anchors: {
        product_access: PRODUCT_ACCESS_PHASE,
        product_governance: PRODUCT_GOVERNANCE_PHASE,
        credential_lifecycle: CREDENTIAL_LIFECYCLE_PHASE,
        credential_governance: CREDENTIAL_GOVERNANCE_PHASE,
        auth_simulation: DEVELOPER_AUTH_SIMULATION_PHASE,
        gateway_simulation: DEVELOPER_GATEWAY_SIMULATION_PHASE,
        execution_routing: DEVELOPER_EXECUTION_ROUTING_PHASE,
        request_flow: SANDBOX_REQUEST_FLOW_PHASE,
      },
    };
  }

  const product = getProductByKey(row.product_key);

  return {
    case_key: row.case_key,
    method: row.method,
    route_preview: labelRoutePreview(row.route_preview),
    environment,
    product_key: row.product_key,
    product_label: product?.label ?? row.product_key,
    capability_key: row.capability_key,
    credential_placeholder: CREDENTIAL_PLACEHOLDER_HANDLE,
    credential_status: row.credential_status,
    entitlement_state: row.entitlement_state,
    auth_case_key: row.auth_case_key,
    gateway_case_key: row.gateway_case_key,
    routing_case_key: row.routing_case_key,
    request_payload_preview: { ...row.request_payload_preview },
    governance_preview: {
      product_access_seed: PRODUCT_ACCESS_PREVIEW_SEED,
      product_governance_seed: PRODUCT_GOVERNANCE_PREVIEW_SEED,
      credential_seed: SANDBOX_CREDENTIAL_PREVIEW_SEED,
      credential_governance_seed: CREDENTIAL_GOVERNANCE_PREVIEW_SEED,
    },
    phase_anchors: {
      product_access: PRODUCT_ACCESS_PHASE,
      product_governance: PRODUCT_GOVERNANCE_PHASE,
      credential_lifecycle: CREDENTIAL_LIFECYCLE_PHASE,
      credential_governance: CREDENTIAL_GOVERNANCE_PHASE,
      auth_simulation: DEVELOPER_AUTH_SIMULATION_PHASE,
      gateway_simulation: DEVELOPER_GATEWAY_SIMULATION_PHASE,
      execution_routing: DEVELOPER_EXECUTION_ROUTING_PHASE,
      request_flow: SANDBOX_REQUEST_FLOW_PHASE,
    },
  };
}

/**
 * @param {(typeof SANDBOX_REQUEST_CASES)[number]} caseRow
 * @param {string} environment
 * @param {{
 *   authEvaluation?: ReturnType<typeof evaluateAuthSimulationCase> | null,
 *   gatewayEvaluation?: ReturnType<typeof evaluateGatewaySimulationCase> | null,
 *   routingEvaluation?: ReturnType<typeof evaluateExecutionRoutingCase> | null,
 *   activeFailureKeys?: Set<string>,
 * }} context
 */
export function buildSandboxRequestStageTrace(caseRow, environment, context = {}) {
  const failures = context.activeFailureKeys ?? new Set(caseRow.failure_state_keys ?? []);
  const authEv = context.authEvaluation ?? null;
  const gatewayEv = context.gatewayEvaluation ?? null;
  const routingEv = context.routingEvaluation ?? null;

  const resolve = (stageKey, defaultResult, blocking) => {
    if (stageKey === "developer_request_selected") {
      return { result: caseRow ? "passed" : "failed", blocking: true };
    }
    if (stageKey === "credential_placeholder_checked") {
      if (failures.has("no_credential_placeholder") || !credentialReady(caseRow.credential_status)) {
        return { result: "failed", blocking: true };
      }
      return { result: "passed", blocking: true };
    }
    if (stageKey === "product_entitlement_checked") {
      if (failures.has("entitlement_not_visible")) return { result: "failed", blocking: true };
      if (failures.has("product_restricted") || caseRow.entitlement_state === "restricted") {
        return { result: "failed", blocking: true };
      }
      if (!entitlementReady(caseRow.entitlement_state)) {
        return { result: "failed", blocking: true };
      }
      return { result: "passed", blocking: true };
    }
    if (stageKey === "capability_scope_checked") {
      if (failures.has("missing_capability_scope")) return { result: "failed", blocking: true };
      return { result: "passed", blocking: true };
    }
    if (stageKey === "auth_simulation_linked") {
      if (failures.has("auth_case_failed") || authBlocked(authEv)) return { result: "failed", blocking: true };
      if (authEv?.derived_outcome === "review") return { result: "warning", blocking: false };
      return { result: authEv ? "passed" : "skipped", blocking: true };
    }
    if (stageKey === "gateway_simulation_linked") {
      if (failures.has("gateway_case_failed") || gatewayBlocked(gatewayEv)) {
        if (gatewayEv?.routing_outcome?.outcome_key === "gateway.routing.review_held_non_terminal") {
          return { result: "warning", blocking: false };
        }
        return { result: "failed", blocking: true };
      }
      if (gatewayEv?.counts?.warning > 0) return { result: "warning", blocking: false };
      return { result: gatewayEv ? "passed" : "skipped", blocking: true };
    }
    if (stageKey === "execution_routing_linked") {
      if (failures.has("routing_case_blocked") || routingBlocked(routingEv)) {
        if (routingEv?.routing_outcome?.category === "review") {
          return { result: "warning", blocking: false };
        }
        return { result: "failed", blocking: true };
      }
      return { result: routingEv ? "passed" : "skipped", blocking: true };
    }
    if (stageKey === "request_payload_shape_checked") {
      if (failures.has("invalid_payload_shape") || !payloadShapeValid(caseRow.request_payload_preview)) {
        return { result: "failed", blocking: true };
      }
      return { result: "passed", blocking: true };
    }
    if (stageKey === "sandbox_response_selected") {
      return {
        result: getSandboxResponsePreview(caseRow.response_preview_key) ? "passed" : "failed",
        blocking: true,
      };
    }
    if (stageKey === "audit_preview_prepared") {
      return { result: defaultResult === "failed" ? "skipped" : "passed", blocking: false };
    }
    if (stageKey === "observability_preview_prepared") {
      return { result: defaultResult === "failed" ? "skipped" : "warning", blocking: false };
    }
    if (stageKey === "simulated_response_returned") {
      if (defaultResult === "failed") return { result: "failed", blocking: true };
      if (defaultResult === "warning") return { result: "warning", blocking: false };
      return { result: "passed", blocking: true };
    }
    return { result: defaultResult, blocking };
  };

  let priorFailed = false;
  return SANDBOX_REQUEST_FLOW_STAGES.map((stage, idx) => {
    let defaultResult = "passed";
    if (priorFailed && stage.blocking_by_default) defaultResult = "skipped";

    const { result, blocking } = resolve(stage.stage_key, defaultResult, stage.blocking_by_default);
    if (result === "failed" && blocking) priorFailed = true;

    return {
      stage_key: stage.stage_key,
      label: stage.label,
      description: stage.description,
      status: stage.status,
      blocking: blocking ?? stage.blocking_by_default,
      result,
      ordinal: idx + 1,
    };
  });
}

/**
 * @param {(typeof SANDBOX_REQUEST_CASES)[number]} caseRow
 * @param {string} environment
 * @param {{
 *   authEvaluation?: ReturnType<typeof evaluateAuthSimulationCase> | null,
 *   gatewayEvaluation?: ReturnType<typeof evaluateGatewaySimulationCase> | null,
 *   routingEvaluation?: ReturnType<typeof evaluateExecutionRoutingCase> | null,
 *   activeFailureKeys?: Set<string>,
 * }} context
 */
export function buildSandboxRequestValidationSummary(caseRow, environment, context = {}) {
  const failures = context.activeFailureKeys ?? new Set(caseRow.failure_state_keys ?? []);
  const authEv = context.authEvaluation ?? null;
  const gatewayEv = context.gatewayEvaluation ?? null;
  const routingEv = context.routingEvaluation ?? null;

  return {
    environment,
    credential_readiness: {
      ready: credentialReady(caseRow.credential_status) && !failures.has("no_credential_placeholder"),
      status_key: caseRow.credential_status,
      placeholder: CREDENTIAL_PLACEHOLDER_HANDLE,
      lifecycle_phase: CREDENTIAL_LIFECYCLE_PHASE,
      governance_phase: CREDENTIAL_GOVERNANCE_PHASE,
    },
    entitlement_visibility: {
      visible:
        entitlementReady(caseRow.entitlement_state) &&
        !failures.has("entitlement_not_visible") &&
        !failures.has("product_restricted"),
      state_key: caseRow.entitlement_state,
      product_access_phase: PRODUCT_ACCESS_PHASE,
      product_governance_phase: PRODUCT_GOVERNANCE_PHASE,
    },
    capability_scope: {
      ok: !failures.has("missing_capability_scope"),
      capability_key: caseRow.capability_key,
      product_key: caseRow.product_key,
    },
    auth_link: {
      case_key: caseRow.auth_case_key,
      linked: Boolean(getAuthSimulationCase(caseRow.auth_case_key)),
      blocked: failures.has("auth_case_failed") || authBlocked(authEv),
      derived_outcome: authEv?.derived_outcome ?? null,
      phase: DEVELOPER_AUTH_SIMULATION_PHASE,
    },
    gateway_link: {
      case_key: caseRow.gateway_case_key,
      linked: Boolean(getGatewaySimulationCase(caseRow.gateway_case_key)),
      blocked: failures.has("gateway_case_failed") || gatewayBlocked(gatewayEv),
      routing_outcome_key: gatewayEv?.routing_outcome?.outcome_key ?? null,
      phase: DEVELOPER_GATEWAY_SIMULATION_PHASE,
    },
    routing_link: {
      case_key: caseRow.routing_case_key,
      linked: Boolean(getExecutionRoutingCase(caseRow.routing_case_key)),
      blocked: failures.has("routing_case_blocked") || routingBlocked(routingEv),
      routing_outcome_key: routingEv?.routing_outcome?.outcome_key ?? null,
      phase: DEVELOPER_EXECUTION_ROUTING_PHASE,
    },
    payload_shape: {
      ok: !failures.has("invalid_payload_shape") && payloadShapeValid(caseRow.request_payload_preview),
      field_count: Object.keys(caseRow.request_payload_preview ?? {}).length,
    },
    environment_guard: {
      live_blocked: failures.has("live_environment_blocked") || environment === "live",
      money_movement_blocked: failures.has("money_movement_disabled"),
    },
  };
}

/**
 * @param {string} previewKey
 * @param {string} [environment]
 */
export function buildSandboxResponsePreview(previewKey, environment = "sandbox") {
  const base = getSandboxResponsePreview(previewKey);
  if (!base) return null;
  return {
    ...base,
    body: {
      ...base.body,
      environment: environment === "live" ? "sandbox" : environment,
    },
    disclaimer: "Preview only — not an HTTP response from a live endpoint.",
  };
}

/**
 * @param {string} outcomeKey
 * @param {boolean} [matchesExpected]
 */
export function buildSandboxRequestOutcomeSummary(outcomeKey, matchesExpected = true) {
  const outcome = OUTCOME_MAP[outcomeKey] ?? OUTCOME_MAP.simulated_success;
  return {
    outcome_key: outcome.outcome_key,
    label: outcome.label,
    category: outcome.category,
    terminal: outcome.terminal,
    developer_message: outcome.developer_message,
    operator_message: outcome.operator_message,
    matches_expected: matchesExpected,
  };
}

/**
 * @param {(typeof SANDBOX_REQUEST_CASES)[number]} caseRow
 * @param {ReturnType<typeof buildSandboxRequestEnvelope>} envelope
 * @param {ReturnType<typeof buildSandboxRequestValidationSummary>} validation
 */
export function buildSandboxRequestFlowSummary(caseRow, envelope, validation) {
  const accessState = PRODUCT_ACCESS_STATES.find((s) => s.state_key === caseRow.entitlement_state);
  return {
    case_key: caseRow.case_key,
    title: caseRow.title,
    method: METHOD_MAP[caseRow.method]?.label ?? caseRow.method,
    route_preview: envelope.route_preview,
    product_label: envelope.product_label,
    explanation: caseRow.explanation,
    entitlement_label: accessState?.label ?? caseRow.entitlement_state,
    credential_status: caseRow.credential_status,
    validation_posture: {
      credential_ready: validation.credential_readiness.ready,
      entitlement_visible: validation.entitlement_visibility.visible,
      capability_ok: validation.capability_scope.ok,
    },
    linked_simulations: {
      auth: caseRow.auth_case_key,
      gateway: caseRow.gateway_case_key,
      routing: caseRow.routing_case_key,
    },
  };
}

function resolveTerminalOutcome(caseRow, environment, context) {
  const failures = context.activeFailureKeys ?? new Set(caseRow.failure_state_keys ?? []);
  const authEv = context.authEvaluation;
  const gatewayEv = context.gatewayEvaluation;
  const routingEv = context.routingEvaluation;

  if (failures.has("money_movement_disabled")) return "sandbox_only_blocked";
  if (failures.has("live_environment_blocked") || environment === "live") return "sandbox_only_blocked";
  if (failures.has("no_credential_placeholder") || !credentialReady(caseRow.credential_status)) {
    return "credential_not_ready";
  }
  if (failures.has("entitlement_not_visible") || failures.has("product_restricted")) {
    return "entitlement_missing";
  }
  if (failures.has("missing_capability_scope")) return "capability_missing";
  if (failures.has("invalid_payload_shape") || !payloadShapeValid(caseRow.request_payload_preview)) {
    return "malformed_preview";
  }
  if (failures.has("auth_case_failed") || authBlocked(authEv)) return "auth_denied";
  if (failures.has("gateway_case_failed") || gatewayBlocked(gatewayEv)) {
    if (gatewayEv?.routing_outcome?.outcome_key === "gateway.routing.review_held_non_terminal") {
      return "review_required";
    }
    return "gateway_denied";
  }
  if (failures.has("routing_case_blocked") || routingBlocked(routingEv)) {
    if (routingEv?.routing_outcome?.category === "review") return "review_required";
    return "execution_blocked";
  }
  if (caseRow.expected_outcome === "review_required") return "review_required";
  return caseRow.expected_outcome;
}

/**
 * @param {string} caseKey
 * @param {{ environment?: string }} [options]
 */
export function evaluateSandboxRequestCase(caseKey, options = {}) {
  const row = getSandboxRequestCase(caseKey);
  const env = options.environment ?? "sandbox";

  const emptyCounts = () => ({ passed: 0, failed: 0, warning: 0, skipped: 0 });

  if (!row) {
    return {
      case: null,
      request_envelope: buildSandboxRequestEnvelope("missing", env),
      stage_trace: [],
      validation_summary: null,
      response_preview: null,
      outcome_summary: buildSandboxRequestOutcomeSummary("malformed_preview", false),
      flow_summary: null,
      counts: emptyCounts(),
      terminal_outcome: true,
      expected_outcome: "malformed_preview",
      developer_message: OUTCOME_MAP.malformed_preview.developer_message,
      operator_summary: "Select a seeded key from SANDBOX_REQUEST_CASES.",
      auth_evaluation: null,
      gateway_evaluation: null,
      routing_evaluation: null,
      active_failure_states: [],
    };
  }

  const activeFailureKeys = new Set(row.failure_state_keys ?? []);
  if (env === "live") activeFailureKeys.add("live_environment_blocked");

  const authEvaluation = evaluateAuthSimulationCase(row.auth_case_key, { environment: env });
  const gatewayEvaluation = evaluateGatewaySimulationCase(row.gateway_case_key, { environment: env });
  const routingEvaluation = evaluateExecutionRoutingCase(row.routing_case_key, { environment: env });

  const context = {
    authEvaluation,
    gatewayEvaluation,
    routingEvaluation,
    activeFailureKeys,
  };

  const requestEnvelope = buildSandboxRequestEnvelope(row, env);
  const stageTrace = buildSandboxRequestStageTrace(row, env, context);
  const validationSummary = buildSandboxRequestValidationSummary(row, env, context);
  const resolvedOutcomeKey = resolveTerminalOutcome(row, env, context);
  const outcomeSummary = buildSandboxRequestOutcomeSummary(
    resolvedOutcomeKey,
    resolvedOutcomeKey === row.expected_outcome,
  );
  const responsePreview = buildSandboxResponsePreview(row.response_preview_key, env);
  const flowSummary = buildSandboxRequestFlowSummary(row, requestEnvelope, validationSummary);
  const counts = countStageResults(stageTrace);

  const activeFailureStates = [...activeFailureKeys]
    .map((k) => FAILURE_MAP[k])
    .filter(Boolean);

  return {
    case: row,
    request_envelope: requestEnvelope,
    stage_trace: stageTrace,
    validation_summary: validationSummary,
    response_preview: responsePreview,
    outcome_summary: outcomeSummary,
    flow_summary: flowSummary,
    counts,
    terminal_outcome: outcomeSummary.terminal,
    expected_outcome: row.expected_outcome,
    developer_message: outcomeSummary.developer_message,
    operator_summary: outcomeSummary.operator_message,
    auth_evaluation: authEvaluation,
    gateway_evaluation: gatewayEvaluation,
    routing_evaluation: routingEvaluation,
    active_failure_states: activeFailureStates,
  };
}

function assertSandboxRequestAlignment() {
  for (const c of SANDBOX_REQUEST_CASES) {
    if (!getAuthSimulationCase(c.auth_case_key)) {
      throw new Error(`Phase 10A case ${c.case_key} references unknown auth_case_key ${c.auth_case_key}`);
    }
    if (!getGatewaySimulationCase(c.gateway_case_key)) {
      throw new Error(`Phase 10A case ${c.case_key} references unknown gateway_case_key ${c.gateway_case_key}`);
    }
    if (!getExecutionRoutingCase(c.routing_case_key)) {
      throw new Error(`Phase 10A case ${c.case_key} references unknown routing_case_key ${c.routing_case_key}`);
    }
    if (!SANDBOX_RESPONSE_PREVIEWS[c.response_preview_key]) {
      throw new Error(`Phase 10A case ${c.case_key} references unknown response_preview_key ${c.response_preview_key}`);
    }
    if (!OUTCOME_MAP[c.expected_outcome]) {
      throw new Error(`Phase 10A case ${c.case_key} references unknown expected_outcome ${c.expected_outcome}`);
    }
    for (const fk of c.failure_state_keys) {
      if (!FAILURE_MAP[fk]) {
        throw new Error(`Phase 10A case ${c.case_key} references unknown failure_key ${fk}`);
      }
    }
    if (!getProductByKey(c.product_key)) {
      throw new Error(`Phase 10A case ${c.case_key} references unknown product_key ${c.product_key}`);
    }
  }
}

assertSandboxRequestAlignment();

export const SANDBOX_REQUEST_CASE_KEYS = SANDBOX_REQUEST_CASES.map((c) => c.case_key);
