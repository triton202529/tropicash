/**
 * Tropicash Developer Platform — Phase 5B:
 * Authentication flow modeling & request verification simulation.
 *
 * MODELING + SIMULATION ONLY. This module:
 *   • does NOT perform real auth, crypto, signing, or API key verification
 *   • does NOT call middleware, APIs, webhooks, workers, Supabase, or storage
 *   • does NOT move money or touch treasury, wallets, withdrawals, PayPal, or fraud execution
 *   • does NOT use Date.now(), Math.random(), fetch, or timers
 *
 * Credential type keys align with `CREDENTIAL_TYPES` in
 * `lib/developerCredentialArchitectureConfig.js`. Product and contract keys
 * align with Phase 4D seeds in `lib/developerProductCatalogConfig.js`.
 * Capability keys align with `INTERNAL_CAPABILITY_SEEDS` in
 * `lib/internalCapabilityConfig.js`.
 */

import { CREDENTIAL_TYPES } from "./developerCredentialArchitectureConfig";
import {
  API_SANDBOX_CONTRACTS,
  getProductByKey,
} from "./developerProductCatalogConfig";
import { getCapabilityByKey } from "./internalCapabilityConfig";

export const DEVELOPER_AUTH_SIMULATION_PHASE = "phase_5b_auth_simulation";

/** @typedef {'passed' | 'failed' | 'skipped' | 'warning'} AuthStageResult */
/** @typedef {'modeled' | 'planned' | 'future'} AuthStageDocStatus */

/**
 * Thirteen ordered verification stages (conceptual edge walk).
 * @type {ReadonlyArray<{
 *   stage_key: string,
 *   label: string,
 *   description: string,
 *   blocking_by_default: boolean,
 *   status: AuthStageDocStatus,
 * }>}
 */
export const AUTH_FLOW_STAGES = [
  {
    stage_key: "edge_transport_present",
    label: "Transport envelope present",
    description:
      "TLS-terminating edge sees a well-formed HTTP envelope before any body-dependent checks run.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "request_shape_valid",
    label: "Request shape validation",
    description:
      "Method, path template, and declared content-type align with the contract preview for the route class.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "authentication_scheme_recognized",
    label: "Authentication scheme recognized",
    description:
      "Authorization header or equivalent carries a supported scheme token for developer traffic (e.g. bearer-style handle).",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "credential_reference_resolved",
    label: "Credential reference resolved",
    description:
      "Opaque credential handle maps to a metadata row and vault correlation reference (no secret material leaves the vault edge).",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "credential_lifecycle_eligible",
    label: "Credential lifecycle eligible",
    description:
      "Lifecycle status is active or within an allowed rotation overlap window; revoked, suspended, and expired paths fail here.",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "environment_matches_credential",
    label: "Environment matches credential",
    description:
      "Declared route environment (sandbox, live, internal rehearsal) matches the credential class and app governance posture.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "app_tenant_binding_confirmed",
    label: "App tenant binding confirmed",
    description:
      "Resolved credential is bound to the same developer app tenant as the route context and correlation identifiers.",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "capability_authorization",
    label: "Capability authorization",
    description:
      "Requested operation requires Phase 2C capability keys that are assigned to the app in the current environment.",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "contract_product_consistency",
    label: "Contract / product consistency",
    description:
      "Resolved `contract_key` belongs to the same `product_key` as the route handler’s catalog binding.",
    blocking_by_default: true,
    status: "modeled",
  },
  {
    stage_key: "required_proof_fields_present",
    label: "Required proof fields present",
    description:
      "Idempotency keys, content digests, timestamps, or other policy-required fields declared in AUTH_VERIFICATION_POLICIES are present.",
    blocking_by_default: true,
    status: "planned",
  },
  {
    stage_key: "replay_window_and_nonce",
    label: "Replay window & nonce",
    description:
      "Timestamp skew, nonce, or request-id deduplication satisfies replay models without contacting external clocks in this simulation.",
    blocking_by_default: true,
    status: "future",
  },
  {
    stage_key: "rate_limit_budget_available",
    label: "Rate-limit budget (conceptual)",
    description:
      "Illustrative per-caller budget check — always modeled as metadata here, not quota storage.",
    blocking_by_default: false,
    status: "planned",
  },
  {
    stage_key: "audit_context_emitted",
    label: "Audit context emitted",
    description:
      "Trace and correlation identifiers are ready for append-only audit narratives (non-terminal warning if incomplete in rehearsal).",
    blocking_by_default: false,
    status: "planned",
  },
];

/**
 * Nine verification policy envelopes (documentation only).
 * @type {ReadonlyArray<{
 *   policy_key: string,
 *   label: string,
 *   credential_type: string,
 *   environment: string,
 *   required_fields: string[],
 *   failure_states: string[],
 *   description: string,
 *   status: AuthStageDocStatus,
 * }>}
 */
export const AUTH_VERIFICATION_POLICIES = [
  {
    policy_key: "pol_sandbox_api_key_read",
    label: "Sandbox API key — read envelope",
    credential_type: "sandbox_api_key",
    environment: "sandbox",
    required_fields: ["authorization_scheme", "credential_handle", "correlation_request_id"],
    failure_states: [
      "missing_authorization_scheme",
      "credential_unknown",
      "environment_mismatch",
    ],
    description: "Minimal proof fields for sandbox GET-style contracts such as wallet balance preview.",
    status: "modeled",
  },
  {
    policy_key: "pol_sandbox_api_key_mutate",
    label: "Sandbox API key — mutate envelope",
    credential_type: "sandbox_api_key",
    environment: "sandbox",
    required_fields: [
      "authorization_scheme",
      "credential_handle",
      "idempotency_key",
      "content_type_json",
    ],
    failure_states: [
      "missing_required_field",
      "malformed_payload_shape",
      "replay_detected",
    ],
    description: "POST-style sandbox contracts require idempotency and JSON shape alignment.",
    status: "planned",
  },
  {
    policy_key: "pol_live_api_key_placeholder",
    label: "Live API key — governance placeholder",
    credential_type: "live_api_key",
    environment: "live",
    required_fields: ["authorization_scheme", "credential_handle", "signed_headers_digest"],
    failure_states: ["live_traffic_on_sandbox_key", "credential_suspended"],
    description: "Live-labelled traffic is modeled as closed until governance clears issuance — fields are illustrative.",
    status: "future",
  },
  {
    policy_key: "pol_webhook_signing_inbound",
    label: "Webhook signing — inbound verification",
    credential_type: "webhook_signing_key",
    environment: "sandbox",
    required_fields: ["webhook_signature_header", "webhook_timestamp_header", "raw_body_reference"],
    failure_states: ["missing_authorization_scheme", "malformed_payload_shape"],
    description: "Inbound webhook verification uses a distinct key class from transport API keys.",
    status: "planned",
  },
  {
    policy_key: "pol_service_account_m2m",
    label: "Service account — machine envelope",
    credential_type: "service_account_token",
    environment: "internal",
    required_fields: ["authorization_scheme", "audience_claim", "credential_handle"],
    failure_states: ["tenant_binding_failed", "credential_unknown"],
    description: "Machine-to-machine narratives bind audience claims to internal rehearsal scopes.",
    status: "future",
  },
  {
    policy_key: "pol_oauth_client_credentials",
    label: "OAuth client credentials — token exchange shape",
    credential_type: "oauth_client_credentials",
    environment: "sandbox",
    required_fields: ["client_id_reference", "token_scope_request", "correlation_request_id"],
    failure_states: ["capability_not_granted", "credential_revoked"],
    description: "Confidential-client style flows remain documentation-only in this repository phase.",
    status: "future",
  },
  {
    policy_key: "pol_dual_capability_export",
    label: "Dual capability — statement export",
    credential_type: "sandbox_api_key",
    environment: "sandbox",
    required_fields: ["period_start", "period_end", "export_format", "idempotency_key"],
    failure_states: ["capability_not_granted", "missing_required_field"],
    description: "Aligns with Phase 4D products that declare multiple ledger capabilities.",
    status: "planned",
  },
  {
    policy_key: "pol_review_gated_capture",
    label: "Review-gated capture path",
    credential_type: "sandbox_api_key",
    environment: "sandbox",
    required_fields: ["authorization_scheme", "credential_handle", "fraud_dependency_marker"],
    failure_states: ["operator_review_pending", "capability_not_granted"],
    description: "Capture contracts that declare `fraud.review_required` dependency in the capability registry.",
    status: "modeled",
  },
  {
    policy_key: "pol_internal_partner_read",
    label: "Internal partner read posture",
    credential_type: "sandbox_api_key",
    environment: "internal",
    required_fields: ["authorization_scheme", "partner_scope_header", "credential_handle"],
    failure_states: ["sandbox_traffic_on_live_key", "environment_mismatch"],
    description: "Treasury summary rehearsal uses internal environment vocabulary even when the product is sandbox-only.",
    status: "planned",
  },
];

/**
 * Sixteen failure states for teaching traces (no runtime enforcement).
 * @type {ReadonlyArray<{
 *   failure_key: string,
 *   category: string,
 *   severity: string,
 *   terminal: boolean,
 *   developer_message: string,
 *   operator_message: string,
 *   primary_stage_key: string,
 * }>}
 */
export const AUTH_FAILURE_STATES = [
  {
    failure_key: "tls_context_missing",
    category: "malformed",
    severity: "high",
    terminal: true,
    developer_message: "The edge did not observe a transport context suitable for developer API verification.",
    operator_message: "Check TLS termination configuration and client proxy settings for the rehearsal route.",
    primary_stage_key: "edge_transport_present",
  },
  {
    failure_key: "malformed_payload_shape",
    category: "malformed",
    severity: "medium",
    terminal: true,
    developer_message: "JSON or declared content-type does not match the contract preview for this handler.",
    operator_message: "Compare request body against the static schema in the Phase 4D contract entry.",
    primary_stage_key: "request_shape_valid",
  },
  {
    failure_key: "missing_authorization_scheme",
    category: "malformed",
    severity: "medium",
    terminal: true,
    developer_message: "No recognizable authentication scheme token was supplied on the request envelope.",
    operator_message: "Reject early — scheme parsing failed before any credential lookup.",
    primary_stage_key: "authentication_scheme_recognized",
  },
  {
    failure_key: "credential_unknown",
    category: "credential",
    severity: "medium",
    terminal: true,
    developer_message: "The credential handle does not resolve to known metadata for this environment.",
    operator_message: "Correlate with vault correlation references; possible typo or wrong prefix.",
    primary_stage_key: "credential_reference_resolved",
  },
  {
    failure_key: "credential_revoked",
    category: "credential",
    severity: "high",
    terminal: true,
    developer_message: "Lifecycle state indicates revocation — the handle must not authenticate new calls.",
    operator_message: "Lifecycle row shows revoked; require re-issuance through admin workflow.",
    primary_stage_key: "credential_lifecycle_eligible",
  },
  {
    failure_key: "credential_suspended",
    category: "credential",
    severity: "high",
    terminal: true,
    developer_message: "Credential is suspended pending governance or abuse review.",
    operator_message: "Do not re-enable without explicit review completion.",
    primary_stage_key: "credential_lifecycle_eligible",
  },
  {
    failure_key: "rotation_overlap_warning",
    category: "review",
    severity: "low",
    terminal: false,
    developer_message: "Both predecessor and successor handles verify during overlap — plan cutover.",
    operator_message: "Informational overlap window per rotation model; not a hard failure.",
    primary_stage_key: "credential_lifecycle_eligible",
  },
  {
    failure_key: "environment_mismatch",
    category: "environment",
    severity: "high",
    terminal: true,
    developer_message: "Route environment does not match the credential class or governance-bound environment.",
    operator_message: "Common when sandbox material is replayed against live-labelled previews.",
    primary_stage_key: "environment_matches_credential",
  },
  {
    failure_key: "live_traffic_on_sandbox_key",
    category: "environment",
    severity: "critical",
    terminal: true,
    developer_message: "Live-declared traffic cannot authenticate with sandbox-typed API key material.",
    operator_message: "Block at edge — violates dual-environment isolation from Phase 5A vocabulary.",
    primary_stage_key: "environment_matches_credential",
  },
  {
    failure_key: "sandbox_traffic_on_live_key",
    category: "environment",
    severity: "high",
    terminal: true,
    developer_message: "Internal or live-graded credential used from an incompatible caller posture.",
    operator_message: "Verify app governance and catalog `environment` fields for the contract.",
    primary_stage_key: "environment_matches_credential",
  },
  {
    failure_key: "tenant_binding_failed",
    category: "credential",
    severity: "high",
    terminal: true,
    developer_message: "Credential metadata does not bind to the app tenant implied by the route context.",
    operator_message: "Investigate mis-issued handles or stale app identifiers in rehearsal data.",
    primary_stage_key: "app_tenant_binding_confirmed",
  },
  {
    failure_key: "capability_not_granted",
    category: "policy",
    severity: "high",
    terminal: true,
    developer_message: "The app is not authorized for the requested Phase 2C capability in this environment.",
    operator_message: "Cross-check App Capabilities assignments against the contract’s `required_capabilities`.",
    primary_stage_key: "capability_authorization",
  },
  {
    failure_key: "contract_product_mismatch",
    category: "malformed",
    severity: "medium",
    terminal: true,
    developer_message: "The resolved contract is not published under the selected product catalog entry.",
    operator_message: "Static catalog inconsistency — fix routing table or catalog linkage in planning data.",
    primary_stage_key: "contract_product_consistency",
  },
  {
    failure_key: "missing_required_field",
    category: "malformed",
    severity: "medium",
    terminal: true,
    developer_message: "A policy-required field such as idempotency key or period window is absent.",
    operator_message: "Fails closed before replay or rate-limit narratives run.",
    primary_stage_key: "required_proof_fields_present",
  },
  {
    failure_key: "replay_detected",
    category: "policy",
    severity: "high",
    terminal: true,
    developer_message: "Replay or duplicate identifier window treats this request as a duplicate application.",
    operator_message: "Align with idempotency replay semantics in the contract preview.",
    primary_stage_key: "replay_window_and_nonce",
  },
  {
    failure_key: "operator_review_pending",
    category: "review",
    severity: "medium",
    terminal: false,
    developer_message: "Human or elevated review is required before this request class is considered cleared.",
    operator_message: "Non-terminal in this simulator — downstream decision phases may still block.",
    primary_stage_key: "rate_limit_budget_available",
  },
];

/** Request-level outcomes for the simulator vocabulary. */
export const AUTH_REQUEST_OUTCOMES = [
  {
    key: "allowed",
    label: "Allowed",
    description: "All blocking verification stages passed; no terminal failure state applies.",
  },
  {
    key: "rejected",
    label: "Rejected",
    description: "Credential or identity class failure — the caller is not authenticated for this envelope.",
  },
  {
    key: "review_required",
    label: "Review required",
    description: "A non-terminal review hold applies; blocking mechanical checks may still have passed.",
  },
  {
    key: "blocked",
    label: "Blocked",
    description: "Policy or authorization denial after identity was parsed — distinct from malformed transport.",
  },
  {
    key: "malformed",
    label: "Malformed",
    description: "Envelope, scheme, or required-field validation failed before trustworthy identity is established.",
  },
  {
    key: "environment_denied",
    label: "Environment denied",
    description: "Sandbox vs live vs internal posture disagrees with credential class or route binding.",
  },
];

/** Static replay-protection concepts (no algorithms). */
export const AUTH_REPLAY_PROTECTION_MODELS = [
  {
    key: "skew_bounded_timestamp",
    label: "Skew-bounded timestamp",
    body: "Reject requests outside a narrow clock skew window relative to the edge’s trusted time.",
  },
  {
    key: "one_time_nonce",
    label: "One-time nonce",
    body: "Pair each request with a nonce table entry so duplicates cannot be applied twice.",
  },
  {
    key: "idempotency_key_fingerprint",
    label: "Idempotency key fingerprint",
    body: "Mutations carry an idempotency key; duplicates return the same conceptual outcome fingerprint.",
  },
  {
    key: "webhook_delivery_nonce",
    label: "Webhook delivery nonce",
    body: "Inbound webhook deliveries may carry a delivery id to deduplicate at-least-once retries.",
  },
];

/** Environment scopes for documentation alignment with Phase 4D `environment` fields. */
export const AUTH_ENVIRONMENT_SCOPES = [
  {
    key: "sandbox",
    label: "Sandbox",
    description: "Isolated rehearsal traffic keyed to sandbox credentials and sandbox_preview contracts.",
  },
  {
    key: "live",
    label: "Live",
    description: "Production-graded posture — modeled as closed in many catalog rows until governance clears apps.",
  },
  {
    key: "internal",
    label: "Internal rehearsal",
    description: "Partner or operator-only previews (`internal_only` products) with stricter header narratives.",
  },
];

const FAILURE_BY_KEY = Object.fromEntries(
  AUTH_FAILURE_STATES.map((f) => [f.failure_key, f]),
);

const STAGE_ORDER = AUTH_FLOW_STAGES.map((s) => s.stage_key);

/**
 * Ten deterministic simulation cases. Keys are stable identifiers for UI and tests.
 * `base_trace` uses only keys from AUTH_FLOW_STAGES; omitted stages are expanded by rules.
 *
 * @type {ReadonlyArray<{
 *   case_key: string,
 *   title: string,
 *   app_label: string,
 *   product_key: string,
 *   contract_key: string,
 *   capability_key: string,
 *   credential_type: string,
 *   environment: string,
 *   expected_outcome: string,
 *   failure_state_keys: string[],
 *   trace_overrides: Record<string, AuthStageResult>,
 *   base_trace: Record<string, AuthStageResult>,
 *   explanation: string,
 * }>}
 */
export const AUTH_SIMULATION_CASES = [
  {
    case_key: "auth_case_balance_read_sandbox_ok",
    title: "Sandbox balance read — happy path",
    app_label: "Rehearsal Wallet UI",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    credential_type: "sandbox_api_key",
    environment: "sandbox",
    expected_outcome: "allowed",
    failure_state_keys: [],
    trace_overrides: {},
    base_trace: {},
    explanation:
      "Low-risk read contract with a single Phase 2C capability — all blocking stages pass when material is sandbox-typed.",
  },
  {
    case_key: "auth_case_reserve_missing_idempotency",
    title: "Reserve simulate — missing idempotency field",
    app_label: "Hold / release harness",
    product_key: "prod_wallet_reserve_sim",
    contract_key: "sc_wallet_reserve_cycle",
    capability_key: "wallet.reserve",
    credential_type: "sandbox_api_key",
    environment: "sandbox",
    expected_outcome: "malformed",
    failure_state_keys: ["missing_required_field"],
    trace_overrides: {},
    base_trace: {
      required_proof_fields_present: "failed",
      replay_window_and_nonce: "skipped",
      rate_limit_budget_available: "skipped",
      audit_context_emitted: "skipped",
    },
    explanation:
      "Phase 4D contract preview requires `idempotency_key` on POST — absence fails proof-field stage before replay checks.",
  },
  {
    case_key: "auth_case_live_eval_on_sandbox_credential",
    title: "Live evaluation override on sandbox credential",
    app_label: "Mis-routed SDK drill",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    credential_type: "sandbox_api_key",
    environment: "sandbox",
    expected_outcome: "allowed",
    failure_state_keys: [],
    trace_overrides: {},
    base_trace: {},
    explanation:
      "Default walk passes under sandbox. Selecting `live` in the simulator injects an environment mismatch against the Phase 4D sandbox contract row — illustrating the `live_traffic_on_sandbox_key` failure vocabulary without any network I/O.",
  },
  {
    case_key: "auth_case_revoked_credential_inactive",
    title: "Revoked credential — lifecycle gate",
    app_label: "Stale CI fixture",
    product_key: "prod_wallet_balance_read",
    contract_key: "sc_wallet_balance_preview",
    capability_key: "wallet.read",
    credential_type: "sandbox_api_key",
    environment: "sandbox",
    expected_outcome: "rejected",
    failure_state_keys: ["credential_revoked"],
    trace_overrides: {},
    base_trace: {
      credential_lifecycle_eligible: "failed",
      environment_matches_credential: "skipped",
      app_tenant_binding_confirmed: "skipped",
      capability_authorization: "skipped",
      contract_product_consistency: "skipped",
      required_proof_fields_present: "skipped",
      replay_window_and_nonce: "skipped",
      rate_limit_budget_available: "skipped",
      audit_context_emitted: "skipped",
    },
    explanation:
      "Lifecycle vocabulary from Phase 5A maps revocation to a hard stop before environment and capability checks consume budget.",
  },
  {
    case_key: "auth_case_checkout_missing_payment_capability",
    title: "Checkout session — capability gap",
    app_label: "Commerce starter kit",
    product_key: "prod_checkout_session",
    contract_key: "sc_checkout_session_create",
    capability_key: "payment.create",
    credential_type: "sandbox_api_key",
    environment: "sandbox",
    expected_outcome: "blocked",
    failure_state_keys: ["capability_not_granted"],
    trace_overrides: {},
    base_trace: {
      capability_authorization: "failed",
      contract_product_consistency: "skipped",
      required_proof_fields_present: "skipped",
      replay_window_and_nonce: "skipped",
      rate_limit_budget_available: "skipped",
      audit_context_emitted: "skipped",
    },
    explanation:
      "Catalog declares `payment.create` but this rehearsal app narrative lacks the capability grant on purpose.",
  },
  {
    case_key: "auth_case_capture_review_hold",
    title: "Capture with review — non-terminal hold",
    app_label: "Risky capture drill",
    product_key: "prod_payment_capture_review",
    contract_key: "sc_payment_capture_review",
    capability_key: "payment.capture",
    credential_type: "sandbox_api_key",
    environment: "sandbox",
    expected_outcome: "review_required",
    failure_state_keys: ["operator_review_pending"],
    trace_overrides: {},
    base_trace: {
      rate_limit_budget_available: "warning",
    },
    explanation:
      "Mechanical verification passes; review hold is modeled as a warning on a non-blocking stage so the outcome stays non-terminal.",
  },
  {
    case_key: "auth_case_replay_nonce_conflict",
    title: "Reserve simulate — replay detected",
    app_label: "Flaky network replay",
    product_key: "prod_wallet_reserve_sim",
    contract_key: "sc_wallet_reserve_cycle",
    capability_key: "wallet.reserve",
    credential_type: "sandbox_api_key",
    environment: "sandbox",
    expected_outcome: "blocked",
    failure_state_keys: ["replay_detected"],
    trace_overrides: {},
    base_trace: {
      replay_window_and_nonce: "failed",
      rate_limit_budget_available: "skipped",
      audit_context_emitted: "skipped",
    },
    explanation:
      "After proof fields pass, replay window detects a duplicate application fingerprint for the same idempotency key.",
  },
  {
    case_key: "auth_case_internal_treasury_partner_deny",
    title: "Treasury summary — internal scope denied",
    app_label: "Partner liquidity preview",
    product_key: "prod_treasury_partner_read",
    contract_key: "sc_treasury_summary_read",
    capability_key: "treasury.read_summary",
    credential_type: "sandbox_api_key",
    environment: "internal",
    expected_outcome: "environment_denied",
    failure_state_keys: ["environment_mismatch"],
    trace_overrides: {},
    base_trace: {
      environment_matches_credential: "failed",
      app_tenant_binding_confirmed: "skipped",
      capability_authorization: "skipped",
      contract_product_consistency: "skipped",
      required_proof_fields_present: "skipped",
      replay_window_and_nonce: "skipped",
      rate_limit_budget_available: "skipped",
      audit_context_emitted: "skipped",
    },
    explanation:
      "Internal rehearsal header narrative disagrees with the sandbox-typed credential in this seeded negative path.",
  },
  {
    case_key: "auth_case_webhook_catalog_ok",
    title: "Webhook catalog — successful verification walk",
    app_label: "Partner notifications lab",
    product_key: "prod_partner_webhook_catalog",
    contract_key: "sc_webhook_topic_list",
    capability_key: "developer.webhook_manage",
    credential_type: "sandbox_api_key",
    environment: "sandbox",
    expected_outcome: "allowed",
    failure_state_keys: [],
    trace_overrides: {},
    base_trace: {},
    explanation:
      "GET-style platform catalog read with developer.webhook_manage — aligns Phase 4D contract with Phase 2C seed.",
  },
  {
    case_key: "auth_case_statement_export_invalid_window",
    title: "Statement export — invalid period window",
    app_label: "Analytics export drill",
    product_key: "prod_statement_export_bundle",
    contract_key: "sc_statement_export_job",
    capability_key: "ledger.export",
    credential_type: "sandbox_api_key",
    environment: "sandbox",
    expected_outcome: "malformed",
    failure_state_keys: ["missing_required_field"],
    trace_overrides: {},
    base_trace: {
      required_proof_fields_present: "failed",
      replay_window_and_nonce: "skipped",
      rate_limit_budget_available: "skipped",
      audit_context_emitted: "skipped",
    },
    explanation:
      "Dual capability product still requires complete period fields — missing `period_end` fails proof-field stage.",
  },
];

export const AUTH_SIMULATION_SAFETY_RULES = [
  "This simulator is pure configuration — it never reads headers, tokens, or secrets from the browser or network.",
  "Do not paste real API keys, webhook signing secrets, or session material into DevTools or support tickets.",
  "Outcomes are enumerations for teaching UI; they do not imply a shipped authentication edge.",
  "Live environment overrides are deliberate negative drills — they do not enable live traffic or issuance.",
  "Capability keys must stay aligned with Phase 2C seeds; the simulator does not grant capabilities.",
  "Product and contract keys are illustrative Phase 4D catalog rows, not callable HTTP routes.",
  "Webhook signing and OAuth policy rows describe future shapes only — no crypto runs here.",
  "Terminal failures in this phase are narrative only — no rate limiting, blocking, or audit side effects occur.",
];

// --- validation helpers (pure; keys reference imported catalogs) ---

const CREDENTIAL_KEYS = new Set(CREDENTIAL_TYPES.map((c) => c.key));

function assertCatalogAlignment() {
  for (const row of AUTH_SIMULATION_CASES) {
    if (!CREDENTIAL_KEYS.has(row.credential_type)) {
      throw new Error(`Unknown credential_type on case ${row.case_key}`);
    }
    if (!getProductByKey(row.product_key)) {
      throw new Error(`Unknown product_key on case ${row.case_key}`);
    }
    const contract = API_SANDBOX_CONTRACTS.find((c) => c.contract_key === row.contract_key);
    if (!contract || contract.product_key !== row.product_key) {
      throw new Error(`contract/product mismatch on case ${row.case_key}`);
    }
    if (!getCapabilityByKey(row.capability_key)) {
      throw new Error(`Unknown capability_key on case ${row.case_key}`);
    }
  }
  for (const pol of AUTH_VERIFICATION_POLICIES) {
    if (!CREDENTIAL_KEYS.has(pol.credential_type)) {
      throw new Error(`Unknown credential_type on policy ${pol.policy_key}`);
    }
    for (const fk of pol.failure_states) {
      if (!FAILURE_BY_KEY[fk]) {
        throw new Error(`Unknown failure_state ${fk} on policy ${pol.policy_key}`);
      }
    }
  }
  for (const row of AUTH_SIMULATION_CASES) {
    for (const fk of row.failure_state_keys) {
      if (!FAILURE_BY_KEY[fk]) {
        throw new Error(`Unknown failure_state_keys entry on case ${row.case_key}`);
      }
    }
  }
}

assertCatalogAlignment();

/**
 * @param {typeof AUTH_SIMULATION_CASES[number]} row
 * @param {string} effectiveEnv
 */
function getExpectedOutcomeForCase(row, effectiveEnv) {
  if (row.case_key === "auth_case_live_eval_on_sandbox_credential") {
    return effectiveEnv === "live" ? "environment_denied" : "allowed";
  }
  return row.expected_outcome;
}

/**
 * @param {typeof AUTH_SIMULATION_CASES[number]} row
 * @param {{ environment?: string, traceOverrides?: Record<string, AuthStageResult> } | undefined} options
 */
function mergeAuthPartial(row, options) {
  const effectiveEnv = options?.environment ?? row.environment;
  const mergedPartial = {
    ...row.base_trace,
    ...row.trace_overrides,
    ...(options?.traceOverrides ?? {}),
  };
  const contract = API_SANDBOX_CONTRACTS.find((c) => c.contract_key === row.contract_key);
  if (
    mergedPartial.environment_matches_credential === undefined &&
    effectiveEnv === "live" &&
    row.credential_type === "sandbox_api_key" &&
    contract?.environment === "sandbox"
  ) {
    mergedPartial.environment_matches_credential = "failed";
  }
  return { effectiveEnv, mergedPartial };
}

function outcomeFromCategory(category) {
  switch (category) {
    case "malformed":
      return "malformed";
    case "environment":
      return "environment_denied";
    case "credential":
      return "rejected";
    case "policy":
      return "blocked";
    case "review":
      return "review_required";
    default:
      return "blocked";
  }
}

/**
 * @param {string} caseKey
 */
export function getAuthSimulationCase(caseKey) {
  return AUTH_SIMULATION_CASES.find((c) => c.case_key === caseKey) ?? null;
}

/**
 * @param {string} policyKey
 */
export function getAuthPolicyByKey(policyKey) {
  return AUTH_VERIFICATION_POLICIES.find((p) => p.policy_key === policyKey) ?? null;
}

/**
 * Merge base trace with case overrides, optional evaluation overrides, and environment drill rules.
 * @param {string} caseKey
 * @param {{ environment?: string, traceOverrides?: Record<string, AuthStageResult> } | undefined} options
 */
export function buildAuthFlowTrace(caseKey, options) {
  const row = getAuthSimulationCase(caseKey);
  if (!row) return [];
  const { mergedPartial } = mergeAuthPartial(row, options);
  return expandTrace(mergedPartial);
}

/**
 * @param {string} caseKey
 */
export function buildAuthFailureSummary(caseKey) {
  const row = getAuthSimulationCase(caseKey);
  if (!row) return "";
  if (!row.failure_state_keys.length) {
    return "No failure states are attached to this case.";
  }
  return row.failure_state_keys
    .map((fk) => {
      const f = FAILURE_BY_KEY[fk];
      return f ? `${f.failure_key} (${f.category}, ${f.severity}): ${f.developer_message}` : fk;
    })
    .join(" ");
}

/**
 * @param {string} caseKey
 * @param {{ environment?: string, traceOverrides?: Record<string, AuthStageResult> } | undefined} options
 */
export function buildAuthOutcomeSummary(caseKey, options) {
  const ev = evaluateAuthSimulationCase(caseKey, options);
  const o = AUTH_REQUEST_OUTCOMES.find((x) => x.key === ev.derived_outcome);
  return `${o?.label ?? ev.derived_outcome} — ${o?.description ?? ""} Resolved expected: ${ev.expected_outcome}; derived: ${ev.derived_outcome}; match: ${ev.outcome_matches_expected ? "yes" : "no"}.`;
}

export function buildReplayProtectionSummary() {
  return AUTH_REPLAY_PROTECTION_MODELS.map((m) => `${m.label}: ${m.body}`).join(" ");
}

export function buildEnvironmentScopeSummary() {
  return AUTH_ENVIRONMENT_SCOPES.map((e) => `${e.label}: ${e.description}`).join(" ");
}

/**
 * Resolve per-stage results with skip propagation after blocking failures.
 * @param {Record<string, AuthStageResult>} mergedPartial
 */
function expandTrace(mergedPartial) {
  /** @type {{ stage_key: string, label: string, blocking: boolean, result: AuthStageResult, doc_status: AuthStageDocStatus }[]} */
  const results = [];
  let skipRest = false;

  for (let i = 0; i < STAGE_ORDER.length; i += 1) {
    const stageKey = STAGE_ORDER[i];
    const stageMeta = AUTH_FLOW_STAGES[i];
    let result = mergedPartial[stageKey];

    if (result === undefined) {
      result = skipRest ? "skipped" : "passed";
    }

    if (stageMeta.blocking_by_default && result === "failed") {
      skipRest = true;
    }

    results.push({
      stage_key: stageKey,
      label: stageMeta.label,
      blocking: stageMeta.blocking_by_default,
      result,
      doc_status: stageMeta.status,
    });
  }

  return results;
}

/**
 * @param {string} caseKey
 * @param {{ environment?: string, traceOverrides?: Record<string, AuthStageResult> } | undefined} options
 */
export function evaluateAuthSimulationCase(caseKey, options) {
  const row = getAuthSimulationCase(caseKey);
  if (!row) {
    return {
      case_key: caseKey,
      error: "unknown_case",
      stages: [],
      failure_details: [],
      passed_count: 0,
      failed_count: 0,
      warning_count: 0,
      skipped_count: 0,
      terminal_failure: false,
      expected_outcome: "malformed",
      derived_outcome: "malformed",
      outcome_matches_expected: false,
      developer_safe_message: "Unknown simulation case key.",
      operator_summary: "Select a valid seeded case from AUTH_SIMULATION_CASES.",
    };
  }

  const { effectiveEnv, mergedPartial } = mergeAuthPartial(row, options);

  const stages = expandTrace(mergedPartial);

  let passed_count = 0;
  let failed_count = 0;
  let warning_count = 0;
  let skipped_count = 0;
  for (const s of stages) {
    if (s.result === "passed") passed_count += 1;
    if (s.result === "failed") failed_count += 1;
    if (s.result === "warning") warning_count += 1;
    if (s.result === "skipped") skipped_count += 1;
  }

  const firstBlockingFail = stages.find((s) => s.blocking && s.result === "failed");
  const firstWarning = stages.find((s) => s.result === "warning");

  /** @type {typeof AUTH_FAILURE_STATES[number] | null} */
  let terminalMeta = null;
  if (firstBlockingFail) {
    let fk =
      row.failure_state_keys.find(
        (k) => FAILURE_BY_KEY[k]?.primary_stage_key === firstBlockingFail.stage_key,
      ) ?? null;
    if (!fk && firstBlockingFail.stage_key === "environment_matches_credential") {
      const contract = API_SANDBOX_CONTRACTS.find((c) => c.contract_key === row.contract_key);
      if (
        effectiveEnv === "live" &&
        row.credential_type === "sandbox_api_key" &&
        contract?.environment === "sandbox"
      ) {
        fk = "live_traffic_on_sandbox_key";
      } else {
        fk = "environment_mismatch";
      }
    }
    terminalMeta = fk ? FAILURE_BY_KEY[fk] : null;
    if (!terminalMeta) {
      terminalMeta =
        AUTH_FAILURE_STATES.find((f) => f.primary_stage_key === firstBlockingFail.stage_key) ??
        FAILURE_BY_KEY.malformed_payload_shape;
    }
  }

  let derived_outcome = "allowed";
  if (firstBlockingFail && terminalMeta) {
    derived_outcome = outcomeFromCategory(terminalMeta.category);
  } else if (!firstBlockingFail && firstWarning && row.failure_state_keys.includes("operator_review_pending")) {
    derived_outcome = "review_required";
  } else if (!firstBlockingFail && row.failure_state_keys.some((k) => FAILURE_BY_KEY[k]?.category === "review")) {
    derived_outcome = "review_required";
  }

  const terminal_failure = ["rejected", "blocked", "malformed", "environment_denied"].includes(derived_outcome);

  let failure_details = row.failure_state_keys.map((fk) => FAILURE_BY_KEY[fk]).filter(Boolean);
  if (firstBlockingFail && failure_details.length === 0 && terminalMeta) {
    failure_details = [terminalMeta];
  }

  const resolvedExpected = getExpectedOutcomeForCase(row, effectiveEnv);
  const outcome_matches_expected = derived_outcome === resolvedExpected;

  const developer_safe_message = firstBlockingFail
    ? terminalMeta?.developer_message ??
      "A blocking verification stage failed — see the stage trace for the first failure."
    : derived_outcome === "review_required"
      ? "Mechanical checks passed but a review hold applies for this request class."
      : "All blocking verification stages passed for this seeded case.";

  const operator_summary = firstBlockingFail
    ? `${firstBlockingFail.stage_key}: ${terminalMeta?.operator_message ?? "Inspect failure_state_keys and catalog alignment."}`
    : derived_outcome === "review_required"
      ? "Review hold is informational in Phase 5B — pair with Phase 3B decision simulator for policy outcomes."
      : "No blocking failures — credential and catalog alignment are consistent for this drill.";

  return {
    case_key: row.case_key,
    title: row.title,
    app_label: row.app_label,
    product_key: row.product_key,
    contract_key: row.contract_key,
    capability_key: row.capability_key,
    credential_type: row.credential_type,
    environment: row.environment,
    effective_environment: effectiveEnv,
    expected_outcome: resolvedExpected,
    seed_expected_outcome: row.expected_outcome,
    stages,
    failure_details,
    passed_count,
    failed_count,
    warning_count,
    skipped_count,
    terminal_failure,
    derived_outcome,
    outcome_matches_expected,
    developer_safe_message,
    operator_summary,
    explanation: row.explanation,
  };
}
