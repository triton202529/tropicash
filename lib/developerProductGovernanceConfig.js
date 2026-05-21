/**
 * Tropicash Developer Platform — Phase 9B:
 * Product Access Governance & Visibility Layer.
 *
 * METADATA + GOVERNANCE + VISIBILITY ONLY. This module:
 *   • does NOT create endpoints, APIs, workers, webhooks, or execution paths
 *   • does NOT generate credentials, secrets, tokens, or auth runtime
 *   • does NOT write to Supabase, move money, or touch treasury / fraud execution
 *   • does NOT use Date.now(), Math.random(), fetch, storage, or crypto
 *
 * Builds on Phase 9A `developerProductAccessConfig.js`.
 */

import {
  PRODUCT_ACCESS_PHASE,
  PRODUCT_ACCESS_PREVIEW_SEED,
} from "./developerProductAccessConfig";

export const PRODUCT_GOVERNANCE_PHASE = "phase_9b_product_governance";

/** Default governance posture for summary helpers — preview only. */
export const PRODUCT_GOVERNANCE_PREVIEW_SEED = {
  entitlement_state_key: "developer_visible_metadata_only",
  review_outcome_key: "approved_placeholder",
  visibility_rule_key: "developer_can_view_metadata",
  environment_key: "sandbox",
};

export const PRODUCT_ENTITLEMENT_STATES = [
  {
    state_key: "unavailable",
    label: "Unavailable",
    description:
      "Product entitlement governance row not opened — sandbox only, metadata only, preview only; no execution, no live access.",
  },
  {
    state_key: "review_ready",
    label: "Review ready",
    description:
      "Governance prerequisites satisfied to queue sandbox product access review — metadata checklist only; still no APIs or money movement.",
  },
  {
    state_key: "pending_governance_review",
    label: "Pending governance review",
    description:
      "Admin or operator holds the product entitlement request — no endpoints, no execution, no live access; preview only.",
  },
  {
    state_key: "approved_sandbox_placeholder",
    label: "Approved (sandbox placeholder)",
    description:
      "Review approved for a future sandbox entitlement slot — metadata only; no routable APIs and no live execution.",
  },
  {
    state_key: "developer_visible_metadata_only",
    label: "Developer visible (metadata only)",
    description:
      "Developers may see product labels, scopes, envelope limits, and access states — never endpoints, tokens, credentials, or live access.",
  },
  {
    state_key: "suspended_placeholder",
    label: "Suspended (placeholder)",
    description:
      "Entitlement narrated as temporarily frozen — governance story only; does not revoke production access or enable execution.",
  },
  {
    state_key: "revoked_placeholder",
    label: "Revoked (placeholder)",
    description:
      "Placeholder invalidation for teaching audit trails — no edge enforcement or API enablement in this repository phase.",
  },
  {
    state_key: "archived_placeholder",
    label: "Archived (placeholder)",
    description:
      "Historical governance row retained for audit readability — hidden from default developer views; sandbox only, metadata only.",
  },
];

export const PRODUCT_VISIBILITY_RULES = [
  {
    rule_key: "developer_can_view_metadata",
    label: "Developer can view metadata",
    audience: "developer",
    description:
      "Developers see product labels, access scopes, envelope limit labels, and entitlement states — sandbox only, metadata only, preview only; no execution.",
  },
  {
    rule_key: "developer_cannot_execute",
    label: "Developer cannot execute",
    audience: "developer",
    description:
      "Hard deny on API execution, request payloads, and money movement — enforced as policy narration only in Phase 9B; preview only.",
  },
  {
    rule_key: "developer_cannot_access_live",
    label: "Developer cannot access live",
    audience: "developer",
    description:
      "Live entitlement copy may appear for planning but live access is blocked — no live execution, no live API, no live URLs in preview seeds.",
  },
  {
    rule_key: "admin_can_review_metadata",
    label: "Admin can review metadata",
    audience: "admin",
    description:
      "Operators audit placeholder product requests, review outcomes, and history seeds — still zero endpoints or credentials from console config.",
  },
  {
    rule_key: "access_requires_capability",
    label: "Access requires capability",
    audience: "governance_policy",
    description:
      "Product entitlement visibility requires assigned internal capabilities — mapping on App Capabilities does not auto-grant access.",
  },
  {
    rule_key: "access_requires_approved_app",
    label: "Access requires approved app",
    audience: "governance_policy",
    description:
      "Developer-visible product previews require an approved app registration — unapproved apps remain hidden from entitlement seeds.",
  },
  {
    rule_key: "sandbox_only_visibility",
    label: "Sandbox-only visibility",
    audience: "governance_policy",
    description:
      "Entitlement visibility is limited to sandbox environment narration — live scopes stay blocked in seeds and copy.",
  },
  {
    rule_key: "metadata_only_visibility",
    label: "Metadata-only visibility",
    audience: "governance_policy",
    description:
      "All product governance rows are configuration and console copy — not routable entitlements; no execution, no live access.",
  },
];

export const PRODUCT_REVIEW_OUTCOMES = [
  {
    outcome_key: "approved_placeholder",
    label: "Approved (placeholder)",
    description:
      "Admin review approves a future sandbox product entitlement slot — metadata only; no API enablement and no execution.",
  },
  {
    outcome_key: "rejected_needs_changes",
    label: "Rejected — needs changes",
    description:
      "Request returned to developer with governance notes — still no endpoints; must re-pass readiness narration.",
  },
  {
    outcome_key: "suspended",
    label: "Suspended",
    description:
      "Entitlement suspended pending investigation — simulators and console remain read-only; sandbox only, no live access.",
  },
  {
    outcome_key: "revoked",
    label: "Revoked",
    description:
      "Placeholder invalidated in audit narrative — teaches revocation modeling without edge enforcement.",
  },
  {
    outcome_key: "archived",
    label: "Archived",
    description:
      "Row moved to historical governance archive — developers lose default visibility; operators retain metadata seeds.",
  },
  {
    outcome_key: "deferred",
    label: "Deferred",
    description:
      "Review intentionally postponed — queue holds state without advancing to developer_visible_metadata_only.",
  },
];

export const PRODUCT_GOVERNANCE_ACTORS = [
  {
    actor_key: "developer",
    label: "Developer",
    description:
      "App owner requesting sandbox product access previews — cannot self-approve elevated products; metadata only, no execution.",
  },
  {
    actor_key: "admin",
    label: "Admin",
    description:
      "Platform operator reviewing product entitlement requests and recording outcomes — no endpoint issuance or live promotion.",
  },
  {
    actor_key: "governance_policy",
    label: "Governance policy",
    description:
      "Static policy rules (visibility, capability, app approval, sandbox boundary) evaluated in config helpers — not a live policy engine.",
  },
  {
    actor_key: "system_placeholder",
    label: "System (placeholder)",
    description:
      "Deterministic automation narrator for future jobs — Phase 9B seeds only; no workers, webhooks, or Supabase writes.",
  },
];

export const PRODUCT_GOVERNANCE_SAFETY_RULES = [
  "Phase 9B product access governance is metadata and visibility vocabulary only — no endpoints, APIs, credentials, secrets, or auth runtime.",
  "Sandbox entitlement previews may show product labels and envelope limit text — they contain no URLs, tokens, signing material, or execution payloads.",
  "Admin review outcomes are placeholder narration — approving or revoking in the console does not enable APIs or move money.",
  "Visibility rules explicitly deny execution and live access for developers; admins review metadata only.",
  "Live product access is blocked — sandbox environment is required for any developer-visible entitlement seeds.",
  "Governance history uses static simulated step labels — no clock timestamps, no fetch, no storage.",
  "Suspension and revocation models teach audit trails only — no edge enforcement, webhooks, workers, treasury, or fraud execution.",
  `Aligns with Phase 9A product access (${PRODUCT_ACCESS_PHASE}) — still sandbox only, preview only, metadata/config only.`,
];

export const PRODUCT_ENTITLEMENT_HISTORY_SEEDS = [
  {
    history_key: "hist_workspace_initialized",
    title: "Workspace initialized",
    description:
      "Workspace persona and readiness milestones seeded — planning context for product governance without API enablement.",
    actor: "system_placeholder",
    entitlement_state: "unavailable",
    simulated_step_label: "Step 1",
    visibility: "developer_can_view_metadata",
  },
  {
    history_key: "hist_app_registered",
    title: "App registered",
    description:
      "Developer app row exists under an approved organization — governance attaches to app metadata only; sandbox only.",
    actor: "developer",
    entitlement_state: "unavailable",
    simulated_step_label: "Step 2",
    visibility: "developer_can_view_metadata",
  },
  {
    history_key: "hist_capability_assigned",
    title: "Capability assigned",
    description:
      "At least one capability assigned — scopes future product entitlement previews; does not grant execution.",
    actor: "governance_policy",
    entitlement_state: "review_ready",
    simulated_step_label: "Step 3",
    visibility: "developer_can_view_metadata",
  },
  {
    history_key: "hist_sandbox_activation_approved",
    title: "Sandbox activation approved",
    description:
      "Sandbox activation governance shows approved posture — product visibility still requires sandbox_only_visibility rule.",
    actor: "admin",
    entitlement_state: "review_ready",
    simulated_step_label: "Step 4",
    visibility: "admin_can_review_metadata",
  },
  {
    history_key: "hist_product_entitlement_ready",
    title: "Product entitlement ready",
    description:
      "Phase 9A readiness checks satisfied for rehearsed products — queue opens for pending_governance_review without APIs.",
    actor: "developer",
    entitlement_state: "pending_governance_review",
    simulated_step_label: "Step 5",
    visibility: "admin_can_review_metadata",
  },
  {
    history_key: "hist_governance_review_completed",
    title: "Governance review completed",
    description:
      "Review outcome approved_placeholder recorded — still no endpoints, no execution, no live access.",
    actor: "admin",
    entitlement_state: "approved_sandbox_placeholder",
    simulated_step_label: "Step 6",
    visibility: "admin_can_review_metadata",
  },
  {
    history_key: "hist_sandbox_access_preview_enabled",
    title: "Sandbox access preview enabled",
    description:
      "Phase 9A sandbox_access_ready posture narrated — simulate_action scope only; execution remains disabled.",
    actor: "governance_policy",
    entitlement_state: "approved_sandbox_placeholder",
    simulated_step_label: "Step 7",
    visibility: "developer_can_view_metadata",
  },
  {
    history_key: "hist_entitlement_visibility_enabled",
    title: "Entitlement visibility enabled",
    description:
      "Governance state advances to developer_visible_metadata_only — product rows visible; endpoints and live access permanently denied.",
    actor: "governance_policy",
    entitlement_state: "developer_visible_metadata_only",
    simulated_step_label: "Step 8",
    visibility: "developer_can_view_metadata",
  },
];

export const PRODUCT_ACCESS_RATIONALE_SEEDS = [
  {
    rationale_key: "rat_metadata_only_entitlements",
    title: "Metadata-only entitlement visibility",
    summary:
      "Developers need product context to integrate without receiving routable grants — visibility rules enforce label-only sandbox previews.",
    related_rule_keys: ["developer_can_view_metadata", "metadata_only_visibility"],
    related_state_keys: ["developer_visible_metadata_only"],
  },
  {
    rationale_key: "rat_admin_review_gate",
    title: "Admin review before visible entitlements",
    summary:
      "Elevated-risk products require governance review before sandbox previews advance — admins see metadata, never execution paths.",
    related_rule_keys: ["admin_can_review_metadata", "developer_cannot_execute"],
    related_state_keys: ["pending_governance_review", "approved_sandbox_placeholder"],
  },
  {
    rationale_key: "rat_sandbox_environment_boundary",
    title: "Sandbox environment boundary",
    summary:
      "Product governance visibility requires sandbox environment narration — live scopes remain blocked across rules and seeds.",
    related_rule_keys: ["sandbox_only_visibility", "developer_cannot_access_live"],
    related_state_keys: ["review_ready", "developer_visible_metadata_only"],
  },
  {
    rationale_key: "rat_capability_prerequisite",
    title: "Capability prerequisite",
    summary:
      "Unassigned capabilities must not surface entitled products — governance policy ties visibility to App Capabilities assignments.",
    related_rule_keys: ["access_requires_capability"],
    related_state_keys: ["unavailable", "review_ready"],
  },
  {
    rationale_key: "rat_approved_app_prerequisite",
    title: "Approved app prerequisite",
    summary:
      "Unregistered or unapproved apps must not surface product access previews — governance ties visibility to app approval.",
    related_rule_keys: ["access_requires_approved_app"],
    related_state_keys: ["unavailable", "review_ready"],
  },
  {
    rationale_key: "rat_suspension_revocation_teaching",
    title: "Suspension and revocation teaching",
    summary:
      "Revocation models document operator and developer messaging without enforcing API kills — audit education for Phase 9B.",
    related_rule_keys: ["developer_cannot_execute", "metadata_only_visibility"],
    related_state_keys: ["suspended_placeholder", "revoked_placeholder"],
  },
];

export const PRODUCT_ENTITLEMENT_PREVIEW_SEEDS = [
  {
    preview_key: "prev_wallet_funding",
    product_key: "wallet_funding",
    label: "Wallet Funding (sandbox preview)",
    environment: "sandbox",
    scope: "simulate_action",
    status: "approved_sandbox_placeholder",
    execution: "disabled",
    sandbox_limit: "$100/day sandbox preview",
    visibility: "metadata only",
    notes:
      "Inbound funding rehearsal — no endpoints, no credentials, no wallet writes; sandbox only, preview only, no execution.",
  },
  {
    preview_key: "prev_send_money",
    product_key: "send_money",
    label: "Send Money (simulation)",
    environment: "sandbox",
    scope: "simulate_action",
    status: "pending_governance_review",
    execution: "disabled",
    sandbox_limit: "$50 sandbox preview transfer",
    visibility: "metadata only",
    notes:
      "Sandbox transfer preview only — no settlement, no live access, no money movement; metadata-only entitlement preview.",
  },
  {
    preview_key: "prev_wallet_balance",
    product_key: "wallet_balance",
    label: "Wallet Balance Read",
    environment: "sandbox",
    scope: "read_metadata",
    status: "developer_visible_metadata_only",
    execution: "disabled",
    sandbox_limit: "Unlimited read previews",
    visibility: "metadata only",
    notes: "Read-only balance entitlement preview — no API responses, no ledger writes.",
  },
  {
    preview_key: "prev_receive_money",
    product_key: "receive_money",
    label: "Receive Money (preview)",
    environment: "sandbox",
    scope: "simulate_action",
    status: "approved_sandbox_placeholder",
    execution: "disabled",
    sandbox_limit: "$200/day inbound preview",
    visibility: "metadata only",
    notes: "Inbound receive narrative — no capture execution; sandbox only.",
  },
  {
    preview_key: "prev_treasury_placeholder",
    product_key: "treasury_placeholder",
    label: "Treasury Liquidity (placeholder)",
    environment: "sandbox",
    scope: "governance_review",
    status: "pending_governance_review",
    execution: "disabled",
    sandbox_limit: "Admin review only",
    visibility: "admin review only",
    notes:
      "Operator-only treasury rehearsal — no treasury execution, no endpoints; metadata-only product governance.",
  },
  {
    preview_key: "prev_sandbox_webhooks_placeholder",
    product_key: "sandbox_webhooks_placeholder",
    label: "Sandbox Webhooks (placeholder)",
    environment: "sandbox",
    scope: "read_metadata",
    status: "approved_sandbox_placeholder",
    execution: "disabled",
    sandbox_limit: "Event preview only",
    visibility: "metadata only",
    notes:
      "Event catalog preview only — no webhook URLs, no signing secrets, no delivery workers.",
  },
  {
    preview_key: "prev_fraud_alerts_placeholder",
    product_key: "fraud_alerts_placeholder",
    label: "Fraud Alerts (placeholder)",
    environment: "sandbox",
    scope: "governance_review",
    status: "suspended_placeholder",
    execution: "disabled",
    sandbox_limit: "Admin review only",
    visibility: "admin review only",
    notes: "Fraud signal preview rows — no fraud engine execution; operator_preview visibility.",
  },
  {
    preview_key: "prev_checkout_session_preview",
    product_key: "checkout_session_preview",
    label: "Checkout Session Preview",
    environment: "sandbox",
    scope: "simulate_action",
    status: "review_ready",
    execution: "disabled",
    sandbox_limit: "25 sessions / day preview",
    visibility: "metadata only",
    notes: "Merchant checkout rehearsal — no capture, no payment execution.",
  },
];

export const PRODUCT_ACCESS_REVOCATION_MODELS = [
  {
    model_key: "governance_restriction",
    label: "Governance restriction",
    trigger: "Operator applies a Phase 9A governance restriction or blocks elevated-risk product review.",
    effect:
      "Entitlement state moves to suspended_placeholder or review_required narrative — no API enablement; sandbox only.",
    recovery_path:
      "Clear governance queue on App Governance — may return to approved_sandbox_placeholder after metadata review.",
    developer_message:
      "Product access preview paused by governance restriction. No API was enabled; resolve review items in Developer Governance.",
    operator_message:
      "Restriction is metadata-only — document outcome; no endpoints, credentials, or execution subsystems in Phase 9B.",
  },
  {
    model_key: "capability_removed",
    label: "Capability removed",
    trigger: "Assigned capability removed or rejected in App Capabilities governance.",
    effect:
      "Product entitlement visibility downgrades — access_requires_capability blocks metadata preview until reassigned.",
    recovery_path:
      "Re-assign required capabilities and pass review_ready checks — aligns with Phase 9A capability map.",
    developer_message:
      "Product preview hidden because a required capability was removed. Reconcile App Capabilities before continuing.",
    operator_message:
      "Verify capability matrix against product intent — metadata-only dependency; no policy engine execution.",
  },
  {
    model_key: "app_suspended_dependency",
    label: "App suspended dependency",
    trigger: "App governance sets suspended or live_blocked posture on the parent app.",
    effect:
      "All product entitlement states freeze or move to suspended_placeholder — app-level gate precedes product rows.",
    recovery_path:
      "Restore app to sandbox_active in governance queue — then replay product entitlement review readiness.",
    developer_message:
      "App suspension hides sandbox product entitlement previews. Resolve app governance before rehearsal continues.",
    operator_message:
      "App suspension is upstream of product governance — coordinate with App Governance console actions.",
  },
  {
    model_key: "sandbox_review_failed",
    label: "Sandbox review failed",
    trigger: "Admin records rejected_needs_changes or deferred outcome for product entitlement review.",
    effect:
      "State narrates pending_governance_review or unavailable — developer_visible_metadata_only withheld.",
    recovery_path:
      "Developer addresses notes and re-queues review_ready — history seeds retain audit trail.",
    developer_message:
      "Product access review needs changes. No execution was enabled; update capabilities or governance prerequisites.",
    operator_message:
      "Capture rejection rationale in review notes — placeholder outcomes only until future enforcement phases.",
  },
  {
    model_key: "developer_requested_removal",
    label: "Developer-requested removal",
    trigger: "Developer requests removal of a product entitlement preview from Product Access console copy.",
    effect:
      "State narrates revoked_placeholder — teaches self-service removal UX without deleting real entitlements.",
    recovery_path:
      "New governance review after readiness checks — archived rows remain in entitlement history seeds.",
    developer_message:
      "Removal recorded for the sandbox product preview. No live API was enabled; request again when ready.",
    operator_message:
      "Confirm request authenticity — outcome is audit metadata only until future API product phases exist.",
  },
  {
    model_key: "emergency_policy_restriction",
    label: "Emergency policy restriction",
    trigger: "Security or compliance operator invokes emergency narrative (simulation only).",
    effect:
      "Immediate revoked_placeholder with restricted visibility — highest severity in teaching seeds; no kill-switch execution.",
    recovery_path:
      "Dual-operator sign-off and new governance review — pair with Phase 6A runtime containment; no Supabase writes.",
    developer_message:
      "Product entitlement emergency-restricted. No API was active; follow support guidance before re-requesting previews.",
    operator_message:
      "Emergency path is rehearsal-only — metadata-only product governance; no treasury, fraud, or payment execution.",
  },
];

/** Deterministic review readiness checks for Phase 9B — separate from Phase 9A access readiness. */
export const PRODUCT_GOVERNANCE_READINESS_CHECKS = [
  {
    check_key: "entitlement_state_review_ready",
    label: "Entitlement state review ready",
    description: "Governance seed at review_ready or beyond — product review queue may open.",
    passed: true,
    blocking: false,
  },
  {
    check_key: "sandbox_only_visibility_rule",
    label: "Sandbox-only visibility satisfied",
    description: "sandbox_only_visibility passes for entitlement preview seeds.",
    passed: true,
    blocking: true,
  },
  {
    check_key: "approved_app_rule",
    label: "Approved app rule satisfied",
    description: "access_requires_approved_app passes for the preview app narrative.",
    passed: true,
    blocking: true,
  },
  {
    check_key: "capability_assignment_rule",
    label: "Capability assignment rule satisfied",
    description: "access_requires_capability passes for rehearsed product keys.",
    passed: true,
    blocking: true,
  },
  {
    check_key: "admin_review_outcome",
    label: "Admin review outcome recorded",
    description: "approved_placeholder outcome present in entitlement history seeds.",
    passed: true,
    blocking: false,
  },
  {
    check_key: "developer_execution_denied",
    label: "Developer execution denied",
    description: "developer_cannot_execute rule active — no execution fields in preview seeds.",
    passed: true,
    blocking: true,
  },
  {
    check_key: "live_access_blocked",
    label: "Live access blocked",
    description: "developer_cannot_access_live rule enforced — no live product preview.",
    passed: true,
    blocking: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

function findByKey(list, key, field) {
  return list.find((item) => item[field] === key) ?? null;
}

export function getProductEntitlementStateMeta(stateKey) {
  return findByKey(PRODUCT_ENTITLEMENT_STATES, stateKey, "state_key");
}

export function getProductVisibilityRule(ruleKey) {
  return findByKey(PRODUCT_VISIBILITY_RULES, ruleKey, "rule_key");
}

export function getProductReviewOutcomeMeta(outcomeKey) {
  return findByKey(PRODUCT_REVIEW_OUTCOMES, outcomeKey, "outcome_key");
}

export function getProductGovernanceActor(actorKey) {
  return findByKey(PRODUCT_GOVERNANCE_ACTORS, actorKey, "actor_key");
}

export function getProductEntitlementHistory() {
  return {
    phase: PRODUCT_GOVERNANCE_PHASE,
    events: [...PRODUCT_ENTITLEMENT_HISTORY_SEEDS],
    total_steps: PRODUCT_ENTITLEMENT_HISTORY_SEEDS.length,
  };
}

export function getProductAccessRationales() {
  return {
    phase: PRODUCT_GOVERNANCE_PHASE,
    rationales: [...PRODUCT_ACCESS_RATIONALE_SEEDS],
  };
}

export function getProductEntitlementPreview() {
  return {
    phase: PRODUCT_GOVERNANCE_PHASE,
    previews: [...PRODUCT_ENTITLEMENT_PREVIEW_SEEDS],
  };
}

export function getProductAccessRevocationModels() {
  return {
    phase: PRODUCT_GOVERNANCE_PHASE,
    models: [...PRODUCT_ACCESS_REVOCATION_MODELS],
  };
}

export function buildProductGovernanceSummary(seed = PRODUCT_GOVERNANCE_PREVIEW_SEED) {
  const state = getProductEntitlementStateMeta(seed.entitlement_state_key);
  const outcome = getProductReviewOutcomeMeta(seed.review_outcome_key);
  const stateCount = PRODUCT_ENTITLEMENT_STATES.length;
  const ruleCount = PRODUCT_VISIBILITY_RULES.length;
  return (
    `Phase 9B product access governance (${stateCount} entitlement states, ${ruleCount} visibility rules). ` +
    `Preview posture: ${state?.label ?? seed.entitlement_state_key} with review outcome ` +
    `${outcome?.label ?? seed.review_outcome_key}. ` +
    `Metadata-only product governance — sandbox only, preview only, no execution, no live access, no endpoints. ` +
    `Builds on ${PRODUCT_ACCESS_PHASE}.`
  );
}

export function buildProductVisibilitySummary() {
  const keys = PRODUCT_VISIBILITY_RULES.map((r) => r.rule_key).join(", ");
  return (
    `Visibility rules (${PRODUCT_VISIBILITY_RULES.length}): ${keys}. ` +
    "Developers see metadata only and cannot execute or access live; admins review metadata only. " +
    "Sandbox-only and approved-app gates apply — no endpoints, credentials, or auth runtime."
  );
}

export function buildProductReviewReadiness(checks = PRODUCT_GOVERNANCE_READINESS_CHECKS) {
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
    phase: PRODUCT_GOVERNANCE_PHASE,
    passed_count: passed,
    total_count: total,
    percent: pct,
    blocking_failed_count: blockingFailed,
    readiness_band: band,
    label:
      band === "ready"
        ? "Ready for sandbox entitlement governance review (metadata only)"
        : band === "almost_ready"
          ? "Nearly ready — resolve remaining governance checks"
          : band === "blocked"
            ? "Blocked — resolve blocking visibility or sandbox rules"
            : "In progress — complete product governance prerequisites",
    checks: [...checks],
  };
}

export function buildProductGovernanceRiskSummary() {
  const restrictionModels = PRODUCT_ACCESS_REVOCATION_MODELS.filter((m) =>
    m.model_key.includes("restriction"),
  ).length;
  const emergencyModels = PRODUCT_ACCESS_REVOCATION_MODELS.filter((m) =>
    m.model_key.includes("emergency"),
  ).length;
  const elevatedPreviews = PRODUCT_ENTITLEMENT_PREVIEW_SEEDS.filter(
    (p) => p.visibility === "admin review only",
  ).length;
  const liveBlocked = PRODUCT_VISIBILITY_RULES.some(
    (r) => r.rule_key === "developer_cannot_access_live",
  );
  return {
    phase: PRODUCT_GOVERNANCE_PHASE,
    revocation_model_count: PRODUCT_ACCESS_REVOCATION_MODELS.length,
    restriction_model_count: restrictionModels,
    emergency_model_count: emergencyModels,
    admin_only_preview_count: elevatedPreviews,
    live_access_blocked: liveBlocked,
    endpoint_risk: "none — config forbids endpoints and URLs",
    execution_risk: "none — developer_cannot_execute enforced",
    credential_risk: "none — no credentials or tokens in preview seeds",
    money_movement_risk: "none — execution disabled on all previews",
    summary:
      `${PRODUCT_ACCESS_REVOCATION_MODELS.length} revocation/suspension models (${restrictionModels} restriction-class, ${emergencyModels} emergency-class) ` +
      `teach audit paths only. ${elevatedPreviews} preview(s) are admin-review-only. Live access blocked; ` +
      "no endpoints, credentials, execution, or money movement exist in this phase.",
  };
}

export function getProductGovernanceOverview(seed = PRODUCT_GOVERNANCE_PREVIEW_SEED) {
  return {
    phase: PRODUCT_GOVERNANCE_PHASE,
    seed: { ...seed },
    state: getProductEntitlementStateMeta(seed.entitlement_state_key),
    review_outcome: getProductReviewOutcomeMeta(seed.review_outcome_key),
    visibility_rule: getProductVisibilityRule(seed.visibility_rule_key),
    governance_summary: buildProductGovernanceSummary(seed),
    visibility_summary: buildProductVisibilitySummary(),
    review_readiness: buildProductReviewReadiness(),
    risk_summary: buildProductGovernanceRiskSummary(),
    access_preview_seed: { ...PRODUCT_ACCESS_PREVIEW_SEED },
  };
}
