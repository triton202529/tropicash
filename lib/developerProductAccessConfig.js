/**
 * Tropicash Developer Platform — Phase 9A:
 * Sandbox API product access layer (metadata / entitlement previews only).
 *
 * THIS FILE IS DEFINITION-ONLY. It does NOT:
 *   • expose or call real HTTP APIs, workers, or webhooks
 *   • mint API keys, secrets, tokens, or credentials
 *   • enable authentication runtime, gateway enforcement, or live execution
 *   • touch Supabase, wallets, treasury, payouts, or money movement
 *
 * Capability keys align read-only with `lib/internalCapabilityConfig.js` and
 * Phase 4D `lib/developerProductCatalogConfig.js` where products rehearse the same affordances.
 */

import { DEVELOPER_PRODUCT_PHASE } from "./developerProductCatalogConfig";

export const PRODUCT_ACCESS_PHASE = "phase_9a_product_access";

/** Static preview posture for summary cards — not persisted anywhere. */
export const PRODUCT_ACCESS_PREVIEW_SEED = {
  app_label: "Sandbox App Alpha",
  environment_key: "sandbox",
  access_state_key: "sandbox_access_ready",
  scope_key: "simulate_action",
};

export const PRODUCT_ACCESS_SCOPES = [
  {
    scope_key: "read_metadata",
    label: "Read metadata",
    description:
      "Inspect product labels, access states, and governance copy — sandbox product access preview only; no API responses.",
    access_level: "read",
    live_enabled: false,
  },
  {
    scope_key: "simulate_action",
    label: "Simulate action",
    description:
      "Rehearse deterministic sandbox narratives inside usage envelopes — execution disabled; no money movement.",
    access_level: "simulate",
    live_enabled: false,
  },
  {
    scope_key: "preview_capability",
    label: "Preview capability",
    description:
      "Map internal capability keys to entitlement rows — documentation bridge from App Capabilities; does not grant access.",
    access_level: "preview",
    live_enabled: false,
  },
  {
    scope_key: "governance_review",
    label: "Governance review",
    description:
      "Operator-facing review posture for elevated products — metadata-only queue; no live promotion or issuance.",
    access_level: "review",
    live_enabled: false,
  },
  {
    scope_key: "audit_visibility",
    label: "Audit visibility",
    description:
      "Read-only audit and history placeholders for teaching trails — no log ingestion or Supabase writes.",
    access_level: "audit",
    live_enabled: false,
  },
  {
    scope_key: "analytics_preview",
    label: "Analytics preview",
    description:
      "Static analytics and export envelopes — aligns with Phase 4E seeds; no telemetry collection.",
    access_level: "analytics",
    live_enabled: false,
  },
];

export const PRODUCT_ACCESS_STATES = [
  {
    state_key: "unavailable",
    label: "Unavailable",
    description:
      "Product entitlement not modeled for this app — sandbox only; preview only; no live execution.",
  },
  {
    state_key: "review_required",
    label: "Review required",
    description:
      "Governance review must complete before sandbox access preview advances — metadata/config only.",
  },
  {
    state_key: "capability_required",
    label: "Capability required",
    description:
      "Assign internal capabilities on App Capabilities before entitlement preview shows ready — no automatic grant.",
  },
  {
    state_key: "credential_ready_placeholder",
    label: "Credential ready (placeholder)",
    description:
      "Phase 8A placeholder credential posture satisfied for narration — still no secrets, auth runtime, or live API.",
  },
  {
    state_key: "sandbox_access_ready",
    label: "Sandbox access ready",
    description:
      "Sandbox product access preview may be shown in console — simulate_action scope only; execution remains disabled.",
  },
  {
    state_key: "governance_blocked",
    label: "Governance blocked",
    description:
      "Developer governance or runtime activation seeds block advancement — metadata-only access previews frozen.",
  },
  {
    state_key: "restricted",
    label: "Restricted",
    description:
      "Elevated risk product visible for audit — operator review required; sandbox only; no live execution.",
  },
  {
    state_key: "suspended_placeholder",
    label: "Suspended (placeholder)",
    description:
      "Teaching suspension narrative — does not revoke production entitlements; sandbox preview only.",
  },
];

export const PRODUCT_ACCESS_RESTRICTIONS = [
  {
    restriction_key: "requires_approved_app",
    label: "Requires approved app",
    description: "Developer app must exist under an approved organization in My Apps.",
    severity: "blocking",
    developer_message: "Register and approve your sandbox app before product access previews advance.",
    operator_message: "Confirm developer_access_requests and app governance seeds show approved posture.",
  },
  {
    restriction_key: "requires_capability_assignment",
    label: "Requires capability assignment",
    description: "At least one internal capability must be assigned for the rehearsed product family.",
    severity: "blocking",
    developer_message: "Assign capabilities on App Capabilities — catalog mapping does not grant access automatically.",
    operator_message: "Verify capability assignments align with requested product access previews.",
  },
  {
    restriction_key: "requires_governance_review",
    label: "Requires governance review",
    description: "Human review queue must clear for elevated-risk or restricted products.",
    severity: "blocking",
    developer_message: "Track review status on Developer Governance — no issuance or live API from this layer.",
    operator_message: "Complete governance review before narrating sandbox_access_ready for restricted products.",
  },
  {
    restriction_key: "sandbox_only",
    label: "Sandbox only",
    description: "Entitlement previews are confined to sandbox environment seeds.",
    severity: "blocking",
    developer_message: "Live execution is not available — sandbox only, preview only, metadata/config only.",
    operator_message: "Live promotion remains blocked per Phase 6A runtime activation seeds.",
  },
  {
    restriction_key: "no_money_movement",
    label: "No money movement",
    description: "Usage envelopes may show limit labels for teaching — no wallet, treasury, or payout execution.",
    severity: "blocking",
    developer_message: "Dollar amounts in envelopes are illustrative sandbox limits — no money movement.",
    operator_message: "Confirm no payment, wallet, treasury, or fraud execution subsystems are invoked.",
  },
  {
    restriction_key: "no_live_execution",
    label: "No live execution",
    description: "live_status on every product remains blocked or preview-blocked in this phase.",
    severity: "blocking",
    developer_message: "No live execution — rehearse in sandbox simulators only.",
    operator_message: "Runtime activation must remain live_blocked before any future live entitlement work.",
  },
  {
    restriction_key: "metadata_only",
    label: "Metadata only",
    description: "Product access rows are configuration and console copy — not routable entitlements.",
    severity: "info",
    developer_message: "Metadata-only access previews — configuration seeds, not API grants.",
    operator_message: "Treat rows as entitlement documentation until future enforcement phases ship.",
  },
  {
    restriction_key: "credentials_placeholder_only",
    label: "Credentials placeholder only",
    description: "Phase 8A lifecycle may show placeholder statuses — zero secret material.",
    severity: "info",
    developer_message: "Credential Lifecycle shows placeholder statuses only — no API keys or signing bytes.",
    operator_message: "Issuance and vault writes remain out of scope for Phase 9A.",
  },
];

export const PRODUCT_ACCESS_ENVIRONMENTS = [
  {
    environment_key: "sandbox",
    label: "Sandbox",
    description:
      "Default developer rehearsal boundary — sandbox product access previews with execution disabled.",
  },
  {
    environment_key: "sandbox_preview",
    label: "Sandbox preview",
    description:
      "Narrower preview partition for catalog-aligned contracts — still no HTTP handlers or credentials.",
  },
  {
    environment_key: "live_preview_blocked",
    label: "Live preview (blocked)",
    description:
      "Live entitlement copy visible for planning — explicitly blocked: no live execution, no live API access.",
  },
  {
    environment_key: "internal_operator_preview",
    label: "Internal operator preview",
    description:
      "Blue Atlantic operator rehearsal — treasury and fraud placeholders; sandbox only; metadata only.",
  },
];

export const PRODUCT_ACCESS_GOVERNANCE_RULES = [
  {
    rule_key: "gov_sandbox_first",
    label: "Sandbox-first entitlements",
    description:
      "All Phase 9A products default to sandbox_only with live_status blocked — no live execution path.",
    applies_to: "all_products",
  },
  {
    rule_key: "gov_capability_alignment",
    label: "Capability alignment required",
    description:
      "required_capabilities must be assigned before sandbox_access_ready — maps to Phase 2C registry keys.",
    applies_to: "all_products",
  },
  {
    rule_key: "gov_credential_placeholder",
    label: "Credential placeholder gate",
    description:
      "credential_ready_placeholder narrates Phase 8A readiness — does not issue secrets or enable auth.",
    applies_to: "write_products",
  },
  {
    rule_key: "gov_review_elevated",
    label: "Review for elevated risk",
    description:
      "high and critical risk_level products require governance_review scope and review_required state.",
    applies_to: "elevated_risk",
  },
  {
    rule_key: "gov_runtime_activation",
    label: "Runtime activation coupling",
    description:
      "Phase 6A live_blocked seeds must remain satisfied before imagining live_status promotion.",
    applies_to: "live_preview_blocked",
  },
  {
    rule_key: "gov_usage_envelope",
    label: "Usage envelope caps",
    description:
      "simulate_action products must reference a usage envelope with execution_status disabled.",
    applies_to: "simulate_products",
  },
  {
    rule_key: "gov_catalog_crosswalk",
    label: "Catalog crosswalk",
    description:
      `Phase 4D catalog (${DEVELOPER_PRODUCT_PHASE}) supplies contract shapes — Phase 9A supplies access posture only.`,
    applies_to: "catalog_aligned",
  },
];

/**
 * @type {ReadonlyArray<{
 *   product_key: string,
 *   label: string,
 *   category: string,
 *   description: string,
 *   sandbox_status: string,
 *   live_status: string,
 *   required_capabilities: string[],
 *   access_scope: string,
 *   governance_level: string,
 *   risk_level: string,
 *   visibility: string,
 *   placeholder: boolean,
 *   catalog_product_key?: string,
 *   default_access_state?: string,
 *   usage_envelope_key?: string,
 * }>}
 */
export const PRODUCT_ACCESS_PRODUCTS = [
  {
    product_key: "wallet_funding",
    label: "Wallet funding (sandbox preview)",
    category: "wallet",
    description:
      "Sandbox-only wallet funding rehearsal — preview only, metadata/config only, no live execution. Illustrates inbound funding narratives inside a capped envelope.",
    sandbox_status: "sandbox_preview",
    live_status: "blocked",
    required_capabilities: ["wallet.read", "wallet.balance_adjust"],
    access_scope: "simulate_action",
    governance_level: "standard",
    risk_level: "medium",
    visibility: "developer_preview",
    placeholder: true,
    catalog_product_key: "prod_wallet_balance_read",
    default_access_state: "capability_required",
    usage_envelope_key: "wallet_funding",
  },
  {
    product_key: "wallet_balance",
    label: "Wallet balance read",
    category: "wallet",
    description:
      "Read-only balance entitlement preview — sandbox only; aligns with wallet.read; no ledger writes or live API.",
    sandbox_status: "sandbox_ready",
    live_status: "blocked",
    required_capabilities: ["wallet.read"],
    access_scope: "read_metadata",
    governance_level: "low",
    risk_level: "low",
    visibility: "developer_preview",
    placeholder: true,
    catalog_product_key: "prod_wallet_balance_read",
    default_access_state: "sandbox_access_ready",
    usage_envelope_key: "wallet_balance_read",
  },
  {
    product_key: "send_money",
    label: "Send money (simulation)",
    category: "transfers",
    description:
      "Outbound transfer entitlement preview — sandbox only, preview only, execution disabled, no money movement.",
    sandbox_status: "sandbox_preview",
    live_status: "blocked",
    required_capabilities: ["payout.request", "wallet.read"],
    access_scope: "simulate_action",
    governance_level: "elevated",
    risk_level: "high",
    visibility: "developer_preview",
    placeholder: true,
    catalog_product_key: "prod_payout_request_blueprint",
    default_access_state: "review_required",
    usage_envelope_key: "send_money",
  },
  {
    product_key: "receive_money",
    label: "Receive money (preview)",
    category: "transfers",
    description:
      "Inbound receive narrative for sandbox apps — metadata-only access previews; no settlement or live execution.",
    sandbox_status: "sandbox_preview",
    live_status: "blocked",
    required_capabilities: ["payment.create", "wallet.read"],
    access_scope: "simulate_action",
    governance_level: "standard",
    risk_level: "medium",
    visibility: "developer_preview",
    placeholder: true,
    catalog_product_key: "prod_checkout_session",
    default_access_state: "capability_required",
    usage_envelope_key: "receive_money",
  },
  {
    product_key: "withdrawal_requests",
    label: "Withdrawal requests (placeholder)",
    category: "transfers",
    description:
      "Withdrawal request blueprint — sandbox only; governance review scope; no payout.release execution.",
    sandbox_status: "sandbox_preview",
    live_status: "blocked",
    required_capabilities: ["payout.request", "payout.approve"],
    access_scope: "governance_review",
    governance_level: "elevated",
    risk_level: "high",
    visibility: "developer_preview",
    placeholder: true,
    default_access_state: "review_required",
    usage_envelope_key: "withdrawal_requests",
  },
  {
    product_key: "transaction_history",
    label: "Transaction history",
    category: "wallet",
    description:
      "Historical transaction list preview — read_metadata and audit_visibility; sandbox only; no live execution.",
    sandbox_status: "sandbox_ready",
    live_status: "blocked",
    required_capabilities: ["wallet.read", "ledger.export"],
    access_scope: "audit_visibility",
    governance_level: "low",
    risk_level: "low",
    visibility: "developer_preview",
    placeholder: true,
    catalog_product_key: "prod_statement_export_bundle",
    default_access_state: "sandbox_access_ready",
    usage_envelope_key: "transaction_history",
  },
  {
    product_key: "notifications",
    label: "Notifications dispatch preview",
    category: "platform",
    description:
      "Non-monetary notification entitlement — sandbox only; preview only; aligns with notification.send capability.",
    sandbox_status: "sandbox_ready",
    live_status: "blocked",
    required_capabilities: ["notification.send"],
    access_scope: "simulate_action",
    governance_level: "low",
    risk_level: "low",
    visibility: "developer_preview",
    placeholder: true,
    catalog_product_key: "prod_notification_dispatch",
    default_access_state: "sandbox_access_ready",
    usage_envelope_key: "notifications",
  },
  {
    product_key: "fraud_alerts_placeholder",
    label: "Fraud alerts (placeholder)",
    category: "governance",
    description:
      "Fraud signal preview rows for operators — sandbox only; metadata/config only; no fraud engine execution.",
    sandbox_status: "restricted_preview",
    live_status: "blocked",
    required_capabilities: ["fraud.review_required"],
    access_scope: "governance_review",
    governance_level: "restricted",
    risk_level: "critical",
    visibility: "operator_preview",
    placeholder: true,
    catalog_product_key: "prod_payment_capture_review",
    default_access_state: "restricted",
    usage_envelope_key: "fraud_alerts_placeholder",
  },
  {
    product_key: "identity_placeholder",
    label: "Identity verification (placeholder)",
    category: "governance",
    description:
      "KYC/identity rehearsal slot — preview only; no identity provider calls; sandbox only; no live execution.",
    sandbox_status: "planned_preview",
    live_status: "blocked",
    required_capabilities: ["developer.app_manage"],
    access_scope: "preview_capability",
    governance_level: "elevated",
    risk_level: "medium",
    visibility: "developer_preview",
    placeholder: true,
    default_access_state: "review_required",
    usage_envelope_key: "identity_placeholder",
  },
  {
    product_key: "analytics_placeholder",
    label: "Analytics export (placeholder)",
    category: "analytics",
    description:
      "Analytics and batch export entitlement preview — aligns with Phase 4E; analytics_preview scope; no telemetry.",
    sandbox_status: "sandbox_preview",
    live_status: "blocked",
    required_capabilities: ["ledger.export"],
    access_scope: "analytics_preview",
    governance_level: "standard",
    risk_level: "medium",
    visibility: "developer_preview",
    placeholder: true,
    catalog_product_key: "prod_statement_export_bundle",
    default_access_state: "capability_required",
    usage_envelope_key: "analytics_placeholder",
  },
  {
    product_key: "treasury_placeholder",
    label: "Treasury liquidity (placeholder)",
    category: "internal",
    description:
      "Treasury read rehearsal — admin review only; sandbox only; metadata-only access previews; no treasury execution.",
    sandbox_status: "internal_preview",
    live_status: "blocked",
    required_capabilities: ["treasury.read_summary"],
    access_scope: "governance_review",
    governance_level: "restricted",
    risk_level: "high",
    visibility: "operator_preview",
    placeholder: true,
    catalog_product_key: "prod_treasury_partner_read",
    default_access_state: "restricted",
    usage_envelope_key: "treasury_placeholder",
  },
  {
    product_key: "sandbox_webhooks_placeholder",
    label: "Sandbox webhooks (placeholder)",
    category: "platform",
    description:
      "Webhook subscription preview — event preview only; sandbox only; no delivery workers or signing secrets.",
    sandbox_status: "sandbox_preview",
    live_status: "blocked",
    required_capabilities: ["developer.webhook_manage"],
    access_scope: "read_metadata",
    governance_level: "standard",
    risk_level: "low",
    visibility: "developer_preview",
    placeholder: true,
    catalog_product_key: "prod_partner_webhook_catalog",
    default_access_state: "credential_ready_placeholder",
    usage_envelope_key: "sandbox_webhooks_placeholder",
  },
  {
    product_key: "checkout_session_preview",
    label: "Checkout session preview",
    category: "merchant",
    description:
      "Merchant checkout entitlement aligned with payment.create — sandbox only; preview only; no capture execution.",
    sandbox_status: "sandbox_preview",
    live_status: "blocked",
    required_capabilities: ["payment.create"],
    access_scope: "simulate_action",
    governance_level: "standard",
    risk_level: "medium",
    visibility: "developer_preview",
    placeholder: true,
    catalog_product_key: "prod_checkout_session",
    default_access_state: "capability_required",
    usage_envelope_key: "checkout_session_preview",
  },
  {
    product_key: "wallet_reserve_sim",
    label: "Wallet reserve simulation",
    category: "sandbox",
    description:
      "Reservation simulate_action envelope — sandbox only; ties to wallet.reserve / wallet.release; no ledger writes.",
    sandbox_status: "sandbox_ready",
    live_status: "blocked",
    required_capabilities: ["wallet.reserve", "wallet.release"],
    access_scope: "simulate_action",
    governance_level: "standard",
    risk_level: "medium",
    visibility: "developer_preview",
    placeholder: true,
    catalog_product_key: "prod_wallet_reserve_sim",
    default_access_state: "sandbox_access_ready",
    usage_envelope_key: "wallet_reserve_sim",
  },
];

export const PRODUCT_ACCESS_USAGE_ENVELOPES = [
  {
    envelope_key: "wallet_funding",
    title: "Wallet funding envelope",
    description: "Illustrative sandbox funding cap — execution disabled.",
    scope: "simulate_action",
    execution_status: "disabled",
    sandbox_limit_label: "$100/day sandbox preview",
    visibility: "developer_preview",
    product_keys: ["wallet_funding"],
  },
  {
    envelope_key: "wallet_balance_read",
    title: "Wallet balance read envelope",
    description: "Read-only metadata envelope — no simulate writes.",
    scope: "read_metadata",
    execution_status: "disabled",
    sandbox_limit_label: "Unlimited read previews",
    visibility: "developer_preview",
    product_keys: ["wallet_balance"],
  },
  {
    envelope_key: "send_money",
    title: "Send money envelope",
    description: "Transfer simulation cap — no outbound settlement.",
    scope: "simulate_action",
    execution_status: "disabled",
    sandbox_limit_label: "$50 sandbox preview transfer",
    visibility: "developer_preview",
    product_keys: ["send_money"],
  },
  {
    envelope_key: "receive_money",
    title: "Receive money envelope",
    description: "Inbound payment session preview — no capture.",
    scope: "simulate_action",
    execution_status: "disabled",
    sandbox_limit_label: "$200/day inbound preview",
    visibility: "developer_preview",
    product_keys: ["receive_money"],
  },
  {
    envelope_key: "withdrawal_requests",
    title: "Withdrawal requests envelope",
    description: "Governance-gated withdrawal blueprint — review required.",
    scope: "governance_review",
    execution_status: "disabled",
    sandbox_limit_label: "3 review rehearsals / day",
    visibility: "developer_preview",
    product_keys: ["withdrawal_requests"],
  },
  {
    envelope_key: "transaction_history",
    title: "Transaction history envelope",
    description: "Audit visibility for statement-shaped reads.",
    scope: "audit_visibility",
    execution_status: "disabled",
    sandbox_limit_label: "500 rows preview export",
    visibility: "developer_preview",
    product_keys: ["transaction_history"],
  },
  {
    envelope_key: "notifications",
    title: "Notifications envelope",
    description: "Non-monetary message simulation.",
    scope: "simulate_action",
    execution_status: "disabled",
    sandbox_limit_label: "50 messages / day preview",
    visibility: "developer_preview",
    product_keys: ["notifications"],
  },
  {
    envelope_key: "fraud_alerts_placeholder",
    title: "Fraud alerts envelope",
    description: "Operator-only fraud signal preview — no engine calls.",
    scope: "governance_review",
    execution_status: "disabled",
    sandbox_limit_label: "Admin review only",
    visibility: "operator_preview",
    product_keys: ["fraud_alerts_placeholder"],
  },
  {
    envelope_key: "identity_placeholder",
    title: "Identity placeholder envelope",
    description: "KYC rehearsal metadata — no provider integration.",
    scope: "preview_capability",
    execution_status: "disabled",
    sandbox_limit_label: "1 identity profile preview",
    visibility: "developer_preview",
    product_keys: ["identity_placeholder"],
  },
  {
    envelope_key: "analytics_placeholder",
    title: "Analytics placeholder envelope",
    description: "Batch export preview — aligns with Sandbox Analytics seeds.",
    scope: "analytics_preview",
    execution_status: "disabled",
    sandbox_limit_label: "10 MB preview export",
    visibility: "developer_preview",
    product_keys: ["analytics_placeholder"],
  },
  {
    envelope_key: "treasury_placeholder",
    title: "Treasury placeholder envelope",
    description: "Treasury liquidity read — admin review only.",
    scope: "governance_review",
    execution_status: "disabled",
    sandbox_limit_label: "Admin review only",
    visibility: "operator_preview",
    product_keys: ["treasury_placeholder"],
  },
  {
    envelope_key: "sandbox_webhooks_placeholder",
    title: "Sandbox webhooks envelope",
    description: "Event catalog preview — no HTTP delivery.",
    scope: "read_metadata",
    execution_status: "disabled",
    sandbox_limit_label: "Event preview only",
    visibility: "developer_preview",
    product_keys: ["sandbox_webhooks_placeholder"],
  },
  {
    envelope_key: "checkout_session_preview",
    title: "Checkout session envelope",
    description: "Session create simulation — capture still disabled.",
    scope: "simulate_action",
    execution_status: "disabled",
    sandbox_limit_label: "25 sessions / day preview",
    visibility: "developer_preview",
    product_keys: ["checkout_session_preview"],
  },
  {
    envelope_key: "wallet_reserve_sim",
    title: "Wallet reserve simulation envelope",
    description: "Hold/release rehearsal — mirrors Phase 4D reserve contract.",
    scope: "simulate_action",
    execution_status: "disabled",
    sandbox_limit_label: "$500 held preview max",
    visibility: "developer_preview",
    product_keys: ["wallet_reserve_sim"],
  },
];

export const PRODUCT_ACCESS_READINESS_CHECKS = [
  {
    check_key: "app_registered",
    label: "App registered",
    description: "Sandbox app exists under an approved organization.",
    passed: true,
    blocking: true,
    related_route: "/dev-console/my-apps",
  },
  {
    check_key: "capabilities_assigned",
    label: "Capabilities assigned",
    description: "Required capabilities assigned for rehearsed products.",
    passed: true,
    blocking: true,
    related_route: "/dev-console/app-capabilities",
  },
  {
    check_key: "governance_clear",
    label: "Governance review clear",
    description: "No blocking governance items for elevated products.",
    passed: true,
    blocking: false,
    related_route: "/dev-console/app-governance",
  },
  {
    check_key: "credential_placeholder_ready",
    label: "Credential placeholder ready",
    description: "Phase 8A lifecycle shows approved or issued placeholder — no secrets.",
    passed: true,
    blocking: false,
    related_route: "/dev-console/credential-lifecycle",
  },
  {
    check_key: "catalog_aligned",
    label: "Product catalog aligned",
    description: "Phase 4D catalog keys cross-walked for contract shapes.",
    passed: true,
    blocking: false,
    related_route: "/dev-console/product-catalog",
  },
  {
    check_key: "runtime_live_blocked",
    label: "Live runtime blocked",
    description: "Phase 6A narrates live_blocked — no live execution path.",
    passed: true,
    blocking: true,
    related_route: "/dev-console/runtime-activation",
  },
  {
    check_key: "auth_simulation_walked",
    label: "Auth simulation walked",
    description: "Auth Simulator stages rehearsed — modeling only.",
    passed: true,
    blocking: false,
    related_route: "/dev-console/auth-simulator",
  },
  {
    check_key: "gateway_simulation_walked",
    label: "Gateway simulation walked",
    description: "Gateway envelopes reviewed — no traffic.",
    passed: true,
    blocking: false,
    related_route: "/dev-console/gateway-simulator",
  },
];

export const PRODUCT_ACCESS_RECOMMENDATIONS = [
  {
    recommendation_key: "rec_workspace_readiness",
    priority: "high",
    title: "Reconcile workspace readiness",
    summary: "Workspace tracks sandbox product access milestones — planning only.",
    action_hint: "Open Workspace for persona and milestone context.",
    related_route: "/dev-console/workspace",
  },
  {
    recommendation_key: "rec_assign_capabilities",
    priority: "high",
    title: "Assign required capabilities",
    summary: "Map capability keys to product access rows before advancing previews.",
    action_hint: "Use App Capabilities — no automatic entitlement grant.",
    related_route: "/dev-console/app-capabilities",
  },
  {
    recommendation_key: "rec_product_catalog",
    priority: "medium",
    title: "Cross-check product catalog",
    summary: "Phase 4D contract shapes complement Phase 9A access posture.",
    action_hint: "Compare catalog_product_key cross-walks on this page.",
    related_route: "/dev-console/product-catalog",
  },
  {
    recommendation_key: "rec_credential_lifecycle",
    priority: "medium",
    title: "Review credential lifecycle",
    summary: "Placeholder credentials gate webhook and write-product narratives.",
    action_hint: "Credential Lifecycle — metadata only, no issuance.",
    related_route: "/dev-console/credential-lifecycle",
  },
  {
    recommendation_key: "rec_auth_simulator",
    priority: "medium",
    title: "Walk auth simulator traces",
    summary: "Rehearse verification before imagining entitled API calls.",
    action_hint: "Auth Simulator — zero real tokens.",
    related_route: "/dev-console/auth-simulator",
  },
  {
    recommendation_key: "rec_gateway_simulator",
    priority: "low",
    title: "Inspect gateway envelopes",
    summary: "Gateway choreography pairs with access scope previews.",
    action_hint: "Gateway Simulator — consoles only.",
    related_route: "/dev-console/gateway-simulator",
  },
  {
    recommendation_key: "rec_runtime_activation",
    priority: "low",
    title: "Confirm live runtime blocked",
    summary: "Runtime Activation must show live_blocked while sandbox access is previewed.",
    action_hint: "Phase 6A cases — simulation only.",
    related_route: "/dev-console/runtime-activation",
  },
];

export const PRODUCT_ACCESS_SAFETY_RULES = [
  "Phase 9A sandbox product access is metadata and entitlement preview only — no routable APIs, endpoints, or execution.",
  "Every product row is sandbox only, preview only, metadata/config only, with live_status blocked and no live execution.",
  "Usage envelope dollar limits are teaching labels — no money movement, wallet writes, treasury, or payout subsystems.",
  "Capability → product mapping does not grant access; assignments remain on App Capabilities and governance queues.",
  "Placeholder products (placeholder: true) exist for narration — they do not enable webhooks, fraud engines, or identity providers.",
  "Credential ready states reference Phase 8A placeholder lifecycle only — no API keys, secrets, tokens, or auth runtime.",
  "Config and helpers are deterministic — no Date.now(), Math.random(), fetch, Supabase, storage, or crypto.",
  `Aligns read-only with Phase 4D catalog (${DEVELOPER_PRODUCT_PHASE}) for contract cross-walks — access layer does not replace catalog.`,
];

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

function findByKey(list, key, field) {
  return list.find((item) => item[field] === key) ?? null;
}

export function getProductAccessMeta(productKey) {
  return findByKey(PRODUCT_ACCESS_PRODUCTS, productKey, "product_key");
}

export function getProductScopeMeta(scopeKey) {
  return findByKey(PRODUCT_ACCESS_SCOPES, scopeKey, "scope_key");
}

export function getProductAccessStateMeta(stateKey) {
  return findByKey(PRODUCT_ACCESS_STATES, stateKey, "state_key");
}

export function getProductEnvironmentMeta(environmentKey) {
  return findByKey(PRODUCT_ACCESS_ENVIRONMENTS, environmentKey, "environment_key");
}

export function getProductRestrictions(productKey) {
  const product = getProductAccessMeta(productKey);
  const keys = [
    "requires_approved_app",
    "requires_capability_assignment",
    "sandbox_only",
    "no_money_movement",
    "no_live_execution",
    "metadata_only",
    "credentials_placeholder_only",
  ];
  if (product?.governance_level === "elevated" || product?.governance_level === "restricted") {
    keys.push("requires_governance_review");
  }
  if (product?.risk_level === "critical" || product?.risk_level === "high") {
    if (!keys.includes("requires_governance_review")) {
      keys.push("requires_governance_review");
    }
  }
  return {
    phase: PRODUCT_ACCESS_PHASE,
    product_key: productKey,
    product,
    restrictions: keys
      .map((k) => findByKey(PRODUCT_ACCESS_RESTRICTIONS, k, "restriction_key"))
      .filter(Boolean),
  };
}

export function getProductUsageEnvelope(envelopeKey) {
  return findByKey(PRODUCT_ACCESS_USAGE_ENVELOPES, envelopeKey, "envelope_key");
}

export function getProductGovernanceRules(filter) {
  const rules = [...PRODUCT_ACCESS_GOVERNANCE_RULES];
  if (!filter) {
    return { phase: PRODUCT_ACCESS_PHASE, rules };
  }
  return {
    phase: PRODUCT_ACCESS_PHASE,
    rules: rules.filter((r) => r.applies_to === filter || r.applies_to === "all_products"),
  };
}

export function getProductRecommendations() {
  return {
    phase: PRODUCT_ACCESS_PHASE,
    recommendations: [...PRODUCT_ACCESS_RECOMMENDATIONS],
  };
}

export function buildCapabilityProductMap(products = PRODUCT_ACCESS_PRODUCTS) {
  const map = {};
  for (const product of products) {
    for (const cap of product.required_capabilities) {
      if (!map[cap]) map[cap] = [];
      map[cap].push({
        product_key: product.product_key,
        label: product.label,
        access_scope: product.access_scope,
        default_access_state: product.default_access_state,
      });
    }
  }
  return map;
}

export function buildProductAccessSummary(seed = PRODUCT_ACCESS_PREVIEW_SEED) {
  const state = getProductAccessStateMeta(seed.access_state_key);
  const env = getProductEnvironmentMeta(seed.environment_key);
  const scope = getProductScopeMeta(seed.scope_key);
  const productCount = PRODUCT_ACCESS_PRODUCTS.length;
  const placeholderCount = PRODUCT_ACCESS_PRODUCTS.filter((p) => p.placeholder).length;
  return (
    `Phase 9A sandbox product access (${productCount} products, ${placeholderCount} placeholders). ` +
    `Preview app “${seed.app_label}” is ${state?.label ?? seed.access_state_key} in ${env?.label ?? seed.environment_key} ` +
    `with ${scope?.label ?? seed.scope_key} scope. Metadata-only access previews — sandbox only; no live execution.`
  );
}

export function buildProductAccessReadiness(checks = PRODUCT_ACCESS_READINESS_CHECKS) {
  const total = checks.length;
  const passed = checks.filter((c) => c.passed).length;
  const blockingFailed = checks.filter((c) => c.blocking && !c.passed).length;
  const pct = total === 0 ? 0 : Math.round((passed / total) * 100);
  let band = "not_ready";
  if (blockingFailed > 0) band = "blocked";
  else if (passed === total) band = "ready";
  else if (passed >= total - 1) band = "almost_ready";
  else band = "in_progress";
  return {
    phase: PRODUCT_ACCESS_PHASE,
    passed_count: passed,
    total_count: total,
    percent: pct,
    blocking_failed_count: blockingFailed,
    readiness_band: band,
    checks: [...checks],
    label:
      band === "ready"
        ? "Ready for sandbox access previews (metadata only)"
        : band === "almost_ready"
          ? "Nearly ready — resolve remaining checks"
          : band === "blocked"
            ? "Blocked — resolve blocking checks first"
            : "In progress — complete governance prerequisites",
  };
}

export function buildProductRestrictionSummary() {
  const blocking = PRODUCT_ACCESS_RESTRICTIONS.filter((r) => r.severity === "blocking").length;
  const keys = PRODUCT_ACCESS_RESTRICTIONS.map((r) => r.restriction_key).join(", ");
  return (
    `Governance restrictions (${PRODUCT_ACCESS_RESTRICTIONS.length} total, ${blocking} blocking): ${keys}. ` +
    "Sandbox only, no money movement, no live execution, metadata only, credentials placeholder only."
  );
}

export function buildProductRiskSummary(products = PRODUCT_ACCESS_PRODUCTS) {
  const counts = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const p of products) {
    counts[p.risk_level] = (counts[p.risk_level] ?? 0) + 1;
  }
  const restricted = products.filter((p) => p.visibility === "operator_preview").length;
  return {
    phase: PRODUCT_ACCESS_PHASE,
    risk_counts: counts,
    operator_preview_count: restricted,
    summary:
      `Risk distribution — low: ${counts.low}, medium: ${counts.medium}, high: ${counts.high}, critical: ${counts.critical}. ` +
      `${restricted} product(s) use operator_preview visibility. All rows remain sandbox only with live_status blocked.`,
  };
}

export function getProductAccessOverview(seed = PRODUCT_ACCESS_PREVIEW_SEED) {
  return {
    phase: PRODUCT_ACCESS_PHASE,
    seed: { ...seed },
    state: getProductAccessStateMeta(seed.access_state_key),
    environment: getProductEnvironmentMeta(seed.environment_key),
    scope: getProductScopeMeta(seed.scope_key),
    access_summary: buildProductAccessSummary(seed),
    readiness: buildProductAccessReadiness(),
    restriction_summary: buildProductRestrictionSummary(),
    risk_summary: buildProductRiskSummary(),
    capability_map: buildCapabilityProductMap(),
  };
}
