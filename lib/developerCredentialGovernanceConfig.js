/**
 * Tropicash Developer Platform — Phase 8B:
 * Credential Governance & Visibility Layer.
 *
 * METADATA + GOVERNANCE + VISIBILITY ONLY. This module:
 *   • does NOT generate API keys, secrets, tokens, signing keys, or encrypted blobs
 *   • does NOT enable authentication, API routes, traffic, webhooks, or workers
 *   • does NOT write to Supabase, move money, or touch treasury / fraud execution
 *   • does NOT use Date.now(), Math.random(), fetch, storage, or crypto
 *
 * Builds on Phase 8A `developerCredentialLifecycleConfig.js` and optionally
 * aligns vocabulary with Phase 5A credential architecture metadata.
 */

import {
  CREDENTIAL_LIFECYCLE_PHASE,
  SANDBOX_CREDENTIAL_PREVIEW_SEED,
} from "./developerCredentialLifecycleConfig";
import { DEVELOPER_CREDENTIAL_PHASE } from "./developerCredentialArchitectureConfig";

export const CREDENTIAL_GOVERNANCE_PHASE = "phase_8b_credential_governance";

/** Default governance posture for summary helpers — placeholder only. */
export const CREDENTIAL_GOVERNANCE_PREVIEW_SEED = {
  governance_state_key: "developer_visible_metadata_only",
  review_outcome_key: "approved_placeholder",
  visibility_rule_key: "developer_can_view_metadata",
  environment_key: "sandbox",
};

export const CREDENTIAL_GOVERNANCE_STATES = [
  {
    state_key: "not_requested",
    label: "Not requested",
    description:
      "No credential governance row opened — placeholder only; no secret material, no auth runtime, no live API.",
  },
  {
    state_key: "review_ready",
    label: "Review ready",
    description:
      "Governance prerequisites satisfied to queue placeholder issuance review — metadata checklist only; still no secrets.",
  },
  {
    state_key: "pending_admin_review",
    label: "Pending admin review",
    description:
      "Admin or operator holds the placeholder credential request — no vault bytes, no issuance, no authentication enablement.",
  },
  {
    state_key: "approved_placeholder",
    label: "Approved (placeholder)",
    description:
      "Review approved for a future sandbox credential slot — placeholder metadata only; no API keys and no active authentication.",
  },
  {
    state_key: "developer_visible_metadata_only",
    label: "Developer visible (metadata only)",
    description:
      "Developers may see labels, environment, prefix hints, and status — never ciphertext, tokens, signing bytes, or live access.",
  },
  {
    state_key: "suspended_placeholder",
    label: "Suspended (placeholder)",
    description:
      "Placeholder credential narrated as temporarily unusable — governance story only; does not revoke production material.",
  },
  {
    state_key: "revoked_placeholder",
    label: "Revoked (placeholder)",
    description:
      "Placeholder invalidation for teaching audit trails — no vault invalidation or edge enforcement in this repository phase.",
  },
  {
    state_key: "archived_placeholder",
    label: "Archived (placeholder)",
    description:
      "Historical governance row retained for audit readability — hidden from default developer views; no secret recovery.",
  },
];

export const CREDENTIAL_VISIBILITY_RULES = [
  {
    rule_key: "developer_can_view_metadata",
    label: "Developer can view metadata",
    audience: "developer",
    description:
      "Developers see status, type, environment, correlation references, and prefix-shaped hints — never secret suffixes or signing material.",
  },
  {
    rule_key: "developer_cannot_view_secret",
    label: "Developer cannot view secret",
    audience: "developer",
    description:
      "Hard deny on ciphertext, token bodies, HMAC secrets, and encrypted blobs — enforced as policy narration only in Phase 8B.",
  },
  {
    rule_key: "admin_can_review_metadata",
    label: "Admin can review metadata",
    audience: "admin",
    description:
      "Operators audit placeholder requests, review outcomes, and history seeds — still zero secret export from console config.",
  },
  {
    rule_key: "admin_cannot_view_secret_material",
    label: "Admin cannot view secret material",
    audience: "admin",
    description:
      "Even elevated roles see governance metadata only — future vault phases would gate bytes behind break-glass workflows not modeled here.",
  },
  {
    rule_key: "visibility_requires_approved_app",
    label: "Visibility requires approved app",
    audience: "governance_policy",
    description:
      "Developer-visible metadata requires an approved app registration — unapproved apps remain hidden from credential preview seeds.",
  },
  {
    rule_key: "visibility_requires_sandbox_environment",
    label: "Visibility requires sandbox environment",
    audience: "governance_policy",
    description:
      "Placeholder visibility is limited to sandbox environment narration — live scopes stay blocked in seeds and copy.",
  },
  {
    rule_key: "live_visibility_blocked",
    label: "Live visibility blocked",
    audience: "governance_policy",
    description:
      "Live credential visibility is explicitly blocked — no live API access, no live issuance, no authentication runtime.",
  },
];

export const CREDENTIAL_REVIEW_OUTCOMES = [
  {
    outcome_key: "approved_placeholder",
    label: "Approved (placeholder)",
    description:
      "Admin review approves a future sandbox credential slot — metadata only; no vault write and no auth enablement.",
  },
  {
    outcome_key: "rejected_needs_changes",
    label: "Rejected — needs changes",
    description:
      "Request returned to developer with governance notes — still no secrets generated; must re-pass readiness narration.",
  },
  {
    outcome_key: "suspended",
    label: "Suspended",
    description:
      "Placeholder suspended pending investigation — simulators and console remain read-only; no live API.",
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

export const CREDENTIAL_GOVERNANCE_ACTORS = [
  {
    actor_key: "developer",
    label: "Developer",
    description:
      "App owner or org member initiating placeholder requests and viewing metadata-only previews — cannot self-approve issuance.",
  },
  {
    actor_key: "admin",
    label: "Admin",
    description:
      "Platform operator reviewing placeholder requests, recording outcomes, and narrating suspension or revocation — no secret export.",
  },
  {
    actor_key: "system_placeholder",
    label: "System (placeholder)",
    description:
      "Deterministic automation narrator for future jobs — Phase 8B seeds only; no workers, webhooks, or Supabase writes.",
  },
  {
    actor_key: "governance_policy",
    label: "Governance policy",
    description:
      "Static policy rules (visibility, environment, app approval) evaluated in config helpers — not a live policy engine.",
  },
];

export const CREDENTIAL_GOVERNANCE_SAFETY_RULES = [
  "Phase 8B credential governance is metadata and visibility vocabulary only — no API keys, secrets, tokens, or signing material are generated.",
  "Developer previews may show prefix-shaped labels such as tc_sbx_ — they contain no real entropy and do not authenticate requests.",
  "Admin review outcomes are placeholder narration — approving or revoking in the console does not write vault rows or arm authentication.",
  "Visibility rules explicitly deny secret material for both developers and admins in this repository phase.",
  "Live visibility is blocked — sandbox environment is required for any developer-visible metadata seeds.",
  "Governance history uses static simulated step labels — no clock timestamps, no fetch, no storage.",
  "Suspension and revocation models teach audit trails only — no edge enforcement, webhooks, workers, or money subsystems.",
  `Aligns with Phase 8A lifecycle (${CREDENTIAL_LIFECYCLE_PHASE}) and Phase 5A architecture (${DEVELOPER_CREDENTIAL_PHASE}) — still zero issuance.`,
];

export const CREDENTIAL_GOVERNANCE_HISTORY_SEEDS = [
  {
    history_key: "hist_access_approved",
    title: "Access approved",
    description:
      "Developer platform access approved for the organization — prerequisite for app and credential governance rows.",
    actor: "admin",
    state: "not_requested",
    simulated_step_label: "Step 1",
    visibility: "admin_only",
  },
  {
    history_key: "hist_workspace_initialized",
    title: "Workspace initialized",
    description:
      "Workspace persona and readiness milestones seeded — planning context for credential governance without issuance.",
    actor: "system_placeholder",
    state: "not_requested",
    simulated_step_label: "Step 2",
    visibility: "developer_can_view_metadata",
  },
  {
    history_key: "hist_app_registered",
    title: "App registered",
    description:
      "Developer app row exists under an approved organization — governance attaches to app_id metadata only.",
    actor: "developer",
    state: "not_requested",
    simulated_step_label: "Step 3",
    visibility: "developer_can_view_metadata",
  },
  {
    history_key: "hist_sandbox_activation_approved",
    title: "Sandbox activation approved",
    description:
      "Sandbox activation governance shows approved posture — credential visibility still requires sandbox environment rule.",
    actor: "admin",
    state: "review_ready",
    simulated_step_label: "Step 4",
    visibility: "admin_can_review_metadata",
  },
  {
    history_key: "hist_capability_assigned",
    title: "Capability assigned",
    description:
      "At least one capability assigned — scopes future access-policy JSON and revocation dependency narratives.",
    actor: "governance_policy",
    state: "review_ready",
    simulated_step_label: "Step 5",
    visibility: "developer_can_view_metadata",
  },
  {
    history_key: "hist_credential_review_ready",
    title: "Credential placeholder review ready",
    description:
      "Phase 8A readiness checks satisfied — queue opens for pending_admin_review without generating secrets.",
    actor: "developer",
    state: "pending_admin_review",
    simulated_step_label: "Step 6",
    visibility: "admin_can_review_metadata",
  },
  {
    history_key: "hist_admin_placeholder_approved",
    title: "Admin placeholder approved",
    description:
      "Review outcome approved_placeholder recorded — still no vault write, no auth runtime, no live API access.",
    actor: "admin",
    state: "approved_placeholder",
    simulated_step_label: "Step 7",
    visibility: "admin_can_review_metadata",
  },
  {
    history_key: "hist_metadata_visibility_enabled",
    title: "Metadata visibility enabled",
    description:
      "Governance state advances to developer_visible_metadata_only — prefix hints allowed, secret suffixes permanently denied.",
    actor: "governance_policy",
    state: "developer_visible_metadata_only",
    simulated_step_label: "Step 8",
    visibility: "developer_can_view_metadata",
  },
];

export const CREDENTIAL_GOVERNANCE_RATIONALE_SEEDS = [
  {
    rationale_key: "rat_metadata_only_visibility",
    title: "Metadata-only developer visibility",
    summary:
      "Developers need enough context to integrate without ever receiving secret bytes — visibility rules enforce label-only previews.",
    related_rule_keys: ["developer_can_view_metadata", "developer_cannot_view_secret"],
    related_state_keys: ["developer_visible_metadata_only"],
  },
  {
    rationale_key: "rat_admin_review_gate",
    title: "Admin review before visible placeholder",
    summary:
      "Placeholder issuance review reduces mistaken approvals — admins see metadata, never secret material, before developers see rows.",
    related_rule_keys: ["admin_can_review_metadata", "admin_cannot_view_secret_material"],
    related_state_keys: ["pending_admin_review", "approved_placeholder"],
  },
  {
    rationale_key: "rat_sandbox_environment_boundary",
    title: "Sandbox environment boundary",
    summary:
      "Credential governance visibility requires sandbox environment narration — live scopes remain blocked across rules and seeds.",
    related_rule_keys: ["visibility_requires_sandbox_environment", "live_visibility_blocked"],
    related_state_keys: ["review_ready", "developer_visible_metadata_only"],
  },
  {
    rationale_key: "rat_approved_app_prerequisite",
    title: "Approved app prerequisite",
    summary:
      "Unregistered or unapproved apps must not surface credential previews — governance policy ties visibility to app approval.",
    related_rule_keys: ["visibility_requires_approved_app"],
    related_state_keys: ["not_requested", "review_ready"],
  },
  {
    rationale_key: "rat_suspension_revocation_teaching",
    title: "Suspension and revocation teaching",
    summary:
      "Revocation models document operator and developer messaging without enforcing edge kills — audit education for Phase 8B.",
    related_rule_keys: ["developer_cannot_view_secret"],
    related_state_keys: ["suspended_placeholder", "revoked_placeholder"],
  },
  {
    rationale_key: "rat_phase8a_alignment",
    title: "Phase 8A lifecycle alignment",
    summary:
      "Governance states map to sandbox lifecycle statuses — teams rehearse end-to-end stories before any future vault work.",
    related_rule_keys: ["developer_can_view_metadata"],
    related_state_keys: ["approved_placeholder", "archived_placeholder"],
  },
];

export const CREDENTIAL_VISIBILITY_PREVIEW_SEEDS = [
  {
    preview_key: "prev_sandbox_api_key",
    label: "Sandbox API key (placeholder)",
    environment: "sandbox",
    status: "issued_placeholder",
    prefix: "tc_sbx_",
    created_label: "Step 7",
    last_used_label: "never",
    rotation_label: "not active",
    visibility: "metadata only",
    notes:
      "Prefix-shaped documentation hint only — no key suffix, no secret, no token, no hash, no encrypted blob.",
  },
  {
    preview_key: "prev_sandbox_signing",
    label: "Sandbox signing handle (placeholder)",
    environment: "sandbox",
    status: "approved_placeholder",
    prefix: "tc_sbx_sign_",
    created_label: "Step 6",
    last_used_label: "never",
    rotation_label: "not active",
    visibility: "metadata only",
    notes: "HMAC rehearsal narrative — no signing bytes generated or stored in Phase 8B.",
  },
  {
    preview_key: "prev_webhook_secret",
    label: "Webhook secret slot (placeholder)",
    environment: "sandbox",
    status: "pending_admin_review",
    prefix: "tc_sbx_wh_",
    created_label: "not issued",
    last_used_label: "never",
    rotation_label: "not active",
    visibility: "admin review only",
    notes: "Distinct from API transport keys — no webhook endpoints or delivery workers.",
  },
];

export const CREDENTIAL_REVOCATION_MODEL_SEEDS = [
  {
    model_key: "governance_suspension",
    label: "Governance suspension",
    trigger: "Operator flags placeholder credential during admin review or audit.",
    effect:
      "Governance state moves to suspended_placeholder — developer preview hidden; no secret invalidation at edge.",
    recovery_path:
      "Admin clears suspension after review — may return to approved_placeholder or developer_visible_metadata_only in seeds.",
    developer_message:
      "Your sandbox credential placeholder is temporarily suspended. No secret was exposed; contact support for review status.",
    operator_message:
      "Suspension is metadata-only — document ticket ID and outcome; no vault or auth runtime changes in Phase 8B.",
  },
  {
    model_key: "developer_requested_revocation",
    label: "Developer-requested revocation",
    trigger: "Developer requests revocation of a placeholder row from My Apps or lifecycle console copy.",
    effect:
      "State narrates revoked_placeholder — teaches self-service revocation UX without deleting real credentials.",
    recovery_path:
      "New placeholder request after readiness checks — archived rows remain in governance history seeds.",
    developer_message:
      "Revocation recorded for the placeholder slot. No live API was enabled; request a new placeholder when ready.",
    operator_message:
      "Confirm request authenticity — outcome is audit metadata only until future issuance phases exist.",
  },
  {
    model_key: "emergency_revocation",
    label: "Emergency revocation",
    trigger: "Security or compliance operator invokes emergency narrative (simulation only).",
    effect:
      "Immediate revoked_placeholder with restricted visibility — highest severity in teaching seeds; no kill-switch execution.",
    recovery_path:
      "Dual-operator sign-off and new governance review — documented in operator runbooks, not automated here.",
    developer_message:
      "Placeholder credential emergency-revoked. No authentication was active; follow support guidance before re-requesting.",
    operator_message:
      "Emergency path is rehearsal-only — pair with Phase 6A runtime containment narratives; no Supabase writes.",
  },
  {
    model_key: "capability_revocation_dependency",
    label: "Capability revocation dependency",
    trigger: "Assigned capability removed or rejected in App Capabilities governance.",
    effect:
      "Placeholder credential visibility may downgrade — capability_revocation_dependency blocks metadata preview until reassigned.",
    recovery_path:
      "Re-assign required capabilities and pass review_ready checks — aligns with Phase 8A readiness seeds.",
    developer_message:
      "Credential preview hidden because a required capability was removed. Reconcile capabilities before continuing.",
    operator_message:
      "Verify capability matrix against app intent — metadata-only dependency chain; no edge policy engine.",
  },
  {
    model_key: "app_suspended_dependency",
    label: "App suspended dependency",
    trigger: "App governance sets suspended or live_blocked posture on the parent app.",
    effect:
      "All credential governance states freeze or move to suspended_placeholder — app-level gate precedes credential rows.",
    recovery_path:
      "Restore app to sandbox_active in governance queue — then replay credential review readiness helpers.",
    developer_message:
      "App suspension hides credential metadata previews. Resolve app governance before credential rehearsal continues.",
    operator_message:
      "App suspension is upstream of credential governance — coordinate with Developer Governance console actions.",
  },
];

/** Deterministic review readiness checks for Phase 8B — separate from Phase 8A lifecycle readiness. */
export const CREDENTIAL_GOVERNANCE_READINESS_CHECKS = [
  {
    check_key: "governance_state_review_ready",
    label: "Governance state review ready",
    description: "Governance seed at review_ready or beyond — placeholder queue may open.",
    passed: true,
    blocking: false,
  },
  {
    check_key: "sandbox_environment_rule",
    label: "Sandbox environment rule satisfied",
    description: "visibility_requires_sandbox_environment passes for preview seeds.",
    passed: true,
    blocking: true,
  },
  {
    check_key: "approved_app_rule",
    label: "Approved app rule satisfied",
    description: "visibility_requires_approved_app passes for the preview app narrative.",
    passed: true,
    blocking: true,
  },
  {
    check_key: "admin_review_outcome",
    label: "Admin review outcome recorded",
    description: "approved_placeholder outcome present in governance history seeds.",
    passed: true,
    blocking: false,
  },
  {
    check_key: "developer_secret_denied",
    label: "Developer secret access denied",
    description: "developer_cannot_view_secret rule active — no secret fields in preview seeds.",
    passed: true,
    blocking: true,
  },
  {
    check_key: "live_visibility_blocked",
    label: "Live visibility blocked",
    description: "live_visibility_blocked rule enforced — no live credential preview.",
    passed: true,
    blocking: true,
  },
];

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

function findByKey(list, key, field = "state_key") {
  return list.find((item) => item[field] === key) ?? null;
}

export function getCredentialGovernanceStateMeta(stateKey) {
  return findByKey(CREDENTIAL_GOVERNANCE_STATES, stateKey, "state_key");
}

export function getCredentialVisibilityRule(ruleKey) {
  return findByKey(CREDENTIAL_VISIBILITY_RULES, ruleKey, "rule_key");
}

export function getCredentialReviewOutcomeMeta(outcomeKey) {
  return findByKey(CREDENTIAL_REVIEW_OUTCOMES, outcomeKey, "outcome_key");
}

export function getCredentialGovernanceActor(actorKey) {
  return findByKey(CREDENTIAL_GOVERNANCE_ACTORS, actorKey, "actor_key");
}

export function getCredentialGovernanceHistory() {
  return {
    phase: CREDENTIAL_GOVERNANCE_PHASE,
    events: [...CREDENTIAL_GOVERNANCE_HISTORY_SEEDS],
    total_steps: CREDENTIAL_GOVERNANCE_HISTORY_SEEDS.length,
  };
}

export function getCredentialGovernanceRationales() {
  return {
    phase: CREDENTIAL_GOVERNANCE_PHASE,
    rationales: [...CREDENTIAL_GOVERNANCE_RATIONALE_SEEDS],
  };
}

export function getCredentialVisibilityPreview() {
  return {
    phase: CREDENTIAL_GOVERNANCE_PHASE,
    previews: [...CREDENTIAL_VISIBILITY_PREVIEW_SEEDS],
  };
}

export function getCredentialRevocationModels() {
  return {
    phase: CREDENTIAL_GOVERNANCE_PHASE,
    models: [...CREDENTIAL_REVOCATION_MODEL_SEEDS],
  };
}

export function buildCredentialGovernanceSummary(
  seed = CREDENTIAL_GOVERNANCE_PREVIEW_SEED,
) {
  const state = getCredentialGovernanceStateMeta(seed.governance_state_key);
  const outcome = getCredentialReviewOutcomeMeta(seed.review_outcome_key);
  const stateCount = CREDENTIAL_GOVERNANCE_STATES.length;
  const ruleCount = CREDENTIAL_VISIBILITY_RULES.length;
  return (
    `Phase 8B credential governance (${stateCount} states, ${ruleCount} visibility rules). ` +
    `Preview posture: ${state?.label ?? seed.governance_state_key} with review outcome ` +
    `${outcome?.label ?? seed.review_outcome_key}. ` +
    `Metadata-only credential governance — no secrets, no auth runtime, no live API. ` +
    `Builds on ${CREDENTIAL_LIFECYCLE_PHASE}.`
  );
}

export function buildCredentialVisibilitySummary() {
  const keys = CREDENTIAL_VISIBILITY_RULES.map((r) => r.rule_key).join(", ");
  return (
    `Visibility rules (${CREDENTIAL_VISIBILITY_RULES.length}): ${keys}. ` +
    "Developers and admins never receive secret material; live visibility is blocked; sandbox and approved-app gates apply."
  );
}

export function buildCredentialReviewReadiness(
  checks = CREDENTIAL_GOVERNANCE_READINESS_CHECKS,
) {
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
    phase: CREDENTIAL_GOVERNANCE_PHASE,
    passed_count: passed,
    total_count: total,
    percent: pct,
    blocking_failed_count: blockingFailed,
    readiness_band: band,
    label:
      band === "ready"
        ? "Ready for placeholder governance review (metadata only)"
        : band === "almost_ready"
          ? "Nearly ready — resolve remaining governance checks"
          : band === "blocked"
            ? "Blocked — resolve blocking visibility or environment rules"
            : "In progress — complete governance prerequisites",
    checks: [...checks],
  };
}

export function buildCredentialGovernanceRiskSummary() {
  const suspensionModels = CREDENTIAL_REVOCATION_MODEL_SEEDS.filter((m) =>
    m.model_key.includes("suspension"),
  ).length;
  const emergencyModels = CREDENTIAL_REVOCATION_MODEL_SEEDS.filter((m) =>
    m.model_key.includes("emergency"),
  ).length;
  const liveBlocked = CREDENTIAL_VISIBILITY_RULES.some(
    (r) => r.rule_key === "live_visibility_blocked",
  );
  return {
    phase: CREDENTIAL_GOVERNANCE_PHASE,
    revocation_model_count: CREDENTIAL_REVOCATION_MODEL_SEEDS.length,
    suspension_model_count: suspensionModels,
    emergency_model_count: emergencyModels,
    live_visibility_blocked: liveBlocked,
    secret_generation_risk: "none — config forbids secrets",
    auth_runtime_risk: "none — no authentication enabled",
    live_api_risk: "none — live visibility blocked in rules and seeds",
    summary:
      `${CREDENTIAL_REVOCATION_MODEL_SEEDS.length} revocation/suspension models (${suspensionModels} suspension-class, ${emergencyModels} emergency-class) ` +
      "teach audit paths only. Live visibility blocked; developers and admins cannot view secret material. " +
      "No credentials, tokens, or auth runtime exist in this phase.",
  };
}

export function getCredentialGovernanceOverview(
  seed = CREDENTIAL_GOVERNANCE_PREVIEW_SEED,
) {
  return {
    phase: CREDENTIAL_GOVERNANCE_PHASE,
    seed: { ...seed },
    state: getCredentialGovernanceStateMeta(seed.governance_state_key),
    review_outcome: getCredentialReviewOutcomeMeta(seed.review_outcome_key),
    visibility_rule: getCredentialVisibilityRule(seed.visibility_rule_key),
    governance_summary: buildCredentialGovernanceSummary(seed),
    visibility_summary: buildCredentialVisibilitySummary(),
    review_readiness: buildCredentialReviewReadiness(),
    risk_summary: buildCredentialGovernanceRiskSummary(),
    lifecycle_preview_seed: { ...SANDBOX_CREDENTIAL_PREVIEW_SEED },
  };
}
