/**
 * Tropicash Developer Platform — Phase 8A:
 * Sandbox Credential Lifecycle Foundation.
 *
 * METADATA + GOVERNANCE + LIFECYCLE ONLY. This module:
 *   • does NOT generate API keys, secrets, tokens, signing keys, or encrypted blobs
 *   • does NOT enable authentication, API routes, traffic, webhooks, or workers
 *   • does NOT write to Supabase, move money, or touch treasury / fraud execution
 *   • does NOT use Date.now(), Math.random(), fetch, storage, or crypto
 *
 * Optional read-only alignment with Phase 5A `developerCredentialArchitectureConfig.js`.
 */

import {
  CREDENTIAL_TYPES,
  DEVELOPER_CREDENTIAL_PHASE,
} from "./developerCredentialArchitectureConfig";

export const CREDENTIAL_LIFECYCLE_PHASE = "phase_8a_sandbox_credential_lifecycle";

/** Static preview posture for summary cards — not persisted anywhere. */
export const SANDBOX_CREDENTIAL_PREVIEW_SEED = {
  app_label: "Sandbox App Alpha",
  status_key: "approved_placeholder",
  environment_key: "sandbox",
  visibility_key: "visible_metadata_only",
  request_type_key: "sandbox_api_key_placeholder",
};

export const SANDBOX_CREDENTIAL_STATUSES = [
  {
    status_key: "not_requested",
    label: "Not requested",
    description:
      "No sandbox credential lifecycle row started — placeholder only; no secret material, no auth, no live API.",
  },
  {
    status_key: "request_ready",
    label: "Request ready",
    description:
      "Governance prerequisites met to open a sandbox credential request — metadata checklist only; still no secrets or authentication.",
  },
  {
    status_key: "pending_review",
    label: "Pending review",
    description:
      "Admin or operator review queue holds the placeholder request — no issuance, no vault bytes, no live API access.",
  },
  {
    status_key: "approved_placeholder",
    label: "Approved (placeholder)",
    description:
      "Review approved for a future sandbox credential slot — placeholder metadata only; no API keys issued and no auth runtime.",
  },
  {
    status_key: "issued_placeholder",
    label: "Issued (placeholder)",
    description:
      "Console may show prefix-shaped hints in documentation — still zero real entropy, no secret export, no active authentication.",
  },
  {
    status_key: "suspended",
    label: "Suspended",
    description:
      "Placeholder credential narrated as temporarily unusable — governance story only; does not revoke production material.",
  },
  {
    status_key: "revoked",
    label: "Revoked",
    description:
      "Placeholder invalidation for teaching audit trails — no vault invalidation or edge enforcement in this repository phase.",
  },
  {
    status_key: "expired",
    label: "Expired",
    description:
      "Natural TTL narrative on placeholder rows — renewal would require a new governance path; no live API re-enablement.",
  },
  {
    status_key: "archived",
    label: "Archived",
    description:
      "Historical placeholder retained for audit readability — hidden from default developer views; no secret recovery.",
  },
];

export const SANDBOX_CREDENTIAL_REQUEST_TYPES = [
  {
    request_type_key: "sandbox_api_key_placeholder",
    label: "Sandbox API key (placeholder)",
    description:
      "Rehearsal identity class aligned with Phase 5A sandbox_api_key — metadata and prefix hints only; no transport auth.",
  },
  {
    request_type_key: "sandbox_signing_key_placeholder",
    label: "Sandbox signing key (placeholder)",
    description:
      "Documentation-shaped signing handle for HMAC drills — no cryptographic material generated or stored.",
  },
  {
    request_type_key: "webhook_secret_placeholder",
    label: "Webhook secret (placeholder)",
    description:
      "Receiver verification narrative — distinct from API transport keys; no webhook endpoints or delivery workers.",
  },
  {
    request_type_key: "internal_service_placeholder",
    label: "Internal service (placeholder)",
    description:
      "Machine-to-machine rehearsal slot for operator sandboxes — not a live service account token.",
  },
];

export const SANDBOX_CREDENTIAL_ENVIRONMENTS = [
  {
    environment_key: "sandbox",
    label: "Sandbox",
    description:
      "Default developer rehearsal boundary — metadata-only credentials; no live API surface or external money paths.",
  },
  {
    environment_key: "live_preview_blocked",
    label: "Live preview (blocked)",
    description:
      "Future live posture is visible in copy only — explicitly blocked: no live API access, no issuance, no auth runtime.",
  },
  {
    environment_key: "internal_placeholder",
    label: "Internal (placeholder)",
    description:
      "Blue Atlantic operator rehearsal partition — isolated from partner sandboxes; placeholder handles only.",
  },
];

export const SANDBOX_CREDENTIAL_VISIBILITY_STATES = [
  {
    visibility_key: "hidden",
    label: "Hidden",
    description:
      "Developers see no credential row — lifecycle may still advance in admin-only seeds; no secret exposure.",
  },
  {
    visibility_key: "visible_metadata_only",
    label: "Visible (metadata only)",
    description:
      "Status, type, environment, and correlation references may appear — never ciphertext, tokens, or signing bytes.",
  },
  {
    visibility_key: "admin_only",
    label: "Admin only",
    description:
      "Operators review placeholder requests and audit events — developers receive outcome labels without secret material.",
  },
  {
    visibility_key: "restricted",
    label: "Restricted",
    description:
      "Elevated review or suspension narratives — console copy warns that simulators remain read-only; no auth enablement.",
  },
];

export const SANDBOX_CREDENTIAL_SAFETY_RULES = [
  "Sandbox credential lifecycle is metadata and governance vocabulary only — no API keys, secrets, tokens, or signing material are generated in Phase 8A.",
  "Placeholder statuses such as issued_placeholder may show prefix-shaped examples from Phase 5A — they contain no real entropy and do not authenticate requests.",
  "No authentication runtime, gateway enforcement, webhook delivery, workers, or Supabase writes are introduced by this phase.",
  "Live preview and internal_placeholder environments are narration boundaries — live API access and money movement remain out of scope.",
  "Visibility states never export secret bytes; admin-only and restricted rows stay audit-oriented.",
  "Readiness checks are deterministic seeds — passing a check does not issue credentials or arm runtime activation.",
  `Aligns with Phase 5A architecture phase (${DEVELOPER_CREDENTIAL_PHASE}) for type vocabulary — still zero issuance.`,
];

export const SANDBOX_CREDENTIAL_TIMELINE_SEEDS = [
  {
    event_key: "evt_app_registered",
    step_label: "Step 1",
    title: "App registered",
    summary: "Developer app row exists under an approved organization — prerequisite for lifecycle modeling.",
    related_status: "not_requested",
  },
  {
    event_key: "evt_sandbox_activation_requested",
    step_label: "Step 2",
    title: "Sandbox activation requested",
    summary: "Sandbox activation review submitted — governance metadata only.",
    related_status: "not_requested",
  },
  {
    event_key: "evt_sandbox_approved",
    step_label: "Step 3",
    title: "Sandbox approved",
    summary: "Sandbox activation approved in governance seeds — still no credential issuance.",
    related_status: "request_ready",
  },
  {
    event_key: "evt_capability_requested",
    step_label: "Step 4",
    title: "Capability requested",
    summary: "Internal capability request opened — scopes future placeholder credential policy JSON.",
    related_status: "request_ready",
  },
  {
    event_key: "evt_capability_assigned",
    step_label: "Step 5",
    title: "Capability assigned",
    summary: "At least one capability assigned — sandbox rehearsal breadth aligned with app capabilities console.",
    related_status: "request_ready",
  },
  {
    event_key: "evt_credential_request_ready",
    step_label: "Step 6",
    title: "Credential request ready",
    summary: "Readiness checklist satisfied for opening a sandbox credential placeholder request.",
    related_status: "pending_review",
  },
  {
    event_key: "evt_placeholder_approved",
    step_label: "Step 7",
    title: "Placeholder credential approved",
    summary: "Admin review approved a sandbox_api_key_placeholder slot — no vault write implied.",
    related_status: "approved_placeholder",
  },
  {
    event_key: "evt_placeholder_visible",
    step_label: "Step 8",
    title: "Placeholder visible in console",
    summary: "Visibility moves to visible_metadata_only — developers see status labels, never secret suffixes.",
    related_status: "issued_placeholder",
  },
  {
    event_key: "evt_architecture_crosscheck",
    step_label: "Step 9",
    title: "Architecture cross-check",
    summary: "Operators confirm Phase 5A lifecycle vocabulary matches sandbox row — teaching alignment only.",
    related_status: "approved_placeholder",
  },
];

export const SANDBOX_CREDENTIAL_READINESS_CHECKS = [
  {
    check_key: "app_registered",
    label: "App registered",
    description: "A developer app exists under an approved organization in My Apps.",
    passed: true,
    blocking: true,
    related_route: "/dev-console/my-apps",
    why_it_matters:
      "Lifecycle rows attach to app_id — without registration there is no legitimate placeholder subject.",
  },
  {
    check_key: "sandbox_activation_approved",
    label: "Sandbox activation approved",
    description: "Sandbox activation governance shows approved posture for the preview app seed.",
    passed: true,
    blocking: true,
    related_route: "/dev-console/app-governance",
    why_it_matters:
      "Credential requests should not advance while sandbox activation is still pending or rejected.",
  },
  {
    check_key: "capability_assigned",
    label: "Capability assigned",
    description: "At least one internal capability is assigned — scopes future access-policy JSON shapes.",
    passed: true,
    blocking: true,
    related_route: "/dev-console/app-capabilities",
    why_it_matters:
      "Placeholder credentials inherit capability boundaries in future enforcement — assign before requesting.",
  },
  {
    check_key: "governance_review_completed",
    label: "Governance review completed",
    description: "Developer governance queue has no blocking open items for the preview app narrative.",
    passed: true,
    blocking: false,
    related_route: "/dev-console/app-governance",
    why_it_matters:
      "Human review gates reduce mistaken placeholder approvals — metadata-only but audit-critical.",
  },
  {
    check_key: "credential_architecture_ready",
    label: "Credential architecture ready",
    description: "Phase 5A tables and vocabulary understood — lifecycle events and policy attachments planned.",
    passed: true,
    blocking: false,
    related_route: "/dev-console/credential-architecture",
    why_it_matters:
      "Issuance workflows must align with developer_app_credentials and append-only lifecycle events before any future vault work.",
  },
  {
    check_key: "auth_simulation_available",
    label: "Auth simulation available",
    description: "Auth Simulator traces rehearse verification stages without enabling real authentication.",
    passed: true,
    blocking: false,
    related_route: "/dev-console/auth-simulator",
    why_it_matters:
      "Teams should walk deterministic auth stages before imagining placeholder keys at the edge.",
  },
  {
    check_key: "gateway_simulation_available",
    label: "Gateway simulation available",
    description: "Gateway Simulator envelopes document how future requests would be shaped — simulation only.",
    passed: true,
    blocking: false,
    related_route: "/dev-console/gateway-simulator",
    why_it_matters:
      "Gateway choreography clarifies correlation identifiers and audit fields that pair with credential metadata.",
  },
  {
    check_key: "runtime_activation_blocked_for_live",
    label: "Live runtime activation blocked",
    description: "Phase 6A narrates live_blocked / live_disabled — no live API or credential issuance implied.",
    passed: true,
    blocking: true,
    related_route: "/dev-console/runtime-activation",
    why_it_matters:
      "Sandbox credential lifecycle must not be interpreted as live promotion — live remains explicitly blocked in seeds.",
  },
];

export const SANDBOX_CREDENTIAL_RECOMMENDATIONS = [
  {
    recommendation_key: "rec_sandbox_review",
    priority: "high",
    title: "Complete sandbox activation review",
    summary: "Ensure sandbox activation is approved before advancing placeholder credential requests.",
    action_hint: "Track review status on Developer Governance — no issuance on that page.",
    related_route: "/dev-console/app-governance",
  },
  {
    recommendation_key: "rec_assign_capabilities",
    priority: "high",
    title: "Assign required capabilities",
    summary: "Align capability assignments with the API products you plan to rehearse.",
    action_hint: "Open App Capabilities and reconcile pending requests.",
    related_route: "/dev-console/app-capabilities",
  },
  {
    recommendation_key: "rec_auth_simulator",
    priority: "medium",
    title: "Inspect auth simulator traces",
    summary: "Rehearse verification stages that will eventually consume credential handles — modeling only.",
    action_hint: "Run Auth Simulator scenarios; zero real tokens.",
    related_route: "/dev-console/auth-simulator",
  },
  {
    recommendation_key: "rec_gateway_simulator",
    priority: "medium",
    title: "Inspect gateway simulator envelopes",
    summary: "Understand request shape, correlation IDs, and audit placeholders before gateway work.",
    action_hint: "Walk Gateway Simulator cases — no traffic leaves the browser.",
    related_route: "/dev-console/gateway-simulator",
  },
  {
    recommendation_key: "rec_runtime_activation",
    priority: "medium",
    title: "Review runtime activation gates",
    summary: "Confirm live runtime remains blocked while sandbox placeholder credentials are planned.",
    action_hint: "Evaluate Phase 6A cases — simulation only.",
    related_route: "/dev-console/runtime-activation",
  },
  {
    recommendation_key: "rec_credential_architecture",
    priority: "low",
    title: "Read credential architecture blueprint",
    summary: "Cross-check Phase 5A lifecycle statuses with sandbox placeholder vocabulary.",
    action_hint: "Compare SQL blueprint tables with this lifecycle page.",
    related_route: "/dev-console/credential-architecture",
  },
  {
    recommendation_key: "rec_workspace_identity",
    priority: "low",
    title: "Reconcile workspace readiness",
    summary: "Workspace seeds track credential_prepared_placeholder — planning only until Phase 8A+ issuance exists.",
    action_hint: "Open Workspace for persona and milestone context.",
    related_route: "/dev-console/workspace",
  },
];

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

function findByKey(list, key, field = "status_key") {
  return list.find((item) => item[field] === key) ?? null;
}

export function getCredentialStatusMeta(statusKey) {
  return findByKey(SANDBOX_CREDENTIAL_STATUSES, statusKey, "status_key");
}

export function getCredentialRequestTypeMeta(requestTypeKey) {
  return findByKey(SANDBOX_CREDENTIAL_REQUEST_TYPES, requestTypeKey, "request_type_key");
}

export function getCredentialEnvironmentMeta(environmentKey) {
  return findByKey(SANDBOX_CREDENTIAL_ENVIRONMENTS, environmentKey, "environment_key");
}

export function getCredentialVisibilityMeta(visibilityKey) {
  return findByKey(SANDBOX_CREDENTIAL_VISIBILITY_STATES, visibilityKey, "visibility_key");
}

export function getCredentialTimeline() {
  return {
    phase: CREDENTIAL_LIFECYCLE_PHASE,
    events: [...SANDBOX_CREDENTIAL_TIMELINE_SEEDS],
    total_steps: SANDBOX_CREDENTIAL_TIMELINE_SEEDS.length,
  };
}

export function getCredentialReadinessChecks() {
  return {
    phase: CREDENTIAL_LIFECYCLE_PHASE,
    checks: [...SANDBOX_CREDENTIAL_READINESS_CHECKS],
  };
}

export function getCredentialRecommendations() {
  return {
    phase: CREDENTIAL_LIFECYCLE_PHASE,
    recommendations: [...SANDBOX_CREDENTIAL_RECOMMENDATIONS],
  };
}

export function buildCredentialLifecycleSummary(seed = SANDBOX_CREDENTIAL_PREVIEW_SEED) {
  const status = getCredentialStatusMeta(seed.status_key);
  const env = getCredentialEnvironmentMeta(seed.environment_key);
  const visibility = getCredentialVisibilityMeta(seed.visibility_key);
  const typeCount = SANDBOX_CREDENTIAL_REQUEST_TYPES.length;
  const statusCount = SANDBOX_CREDENTIAL_STATUSES.length;
  const archTypes = CREDENTIAL_TYPES.length;
  return (
    `Phase 8A sandbox credential lifecycle (${statusCount} statuses, ${typeCount} placeholder request types). ` +
    `Preview app “${seed.app_label}” is ${status?.label ?? seed.status_key} in ${env?.label ?? seed.environment_key} ` +
    `with ${visibility?.label ?? seed.visibility_key} visibility. ` +
    `Aligned with Phase 5A (${DEVELOPER_CREDENTIAL_PHASE}, ${archTypes} architecture types) — no secrets, no auth, no live API.`
  );
}

export function buildCredentialReadinessScore(checks = SANDBOX_CREDENTIAL_READINESS_CHECKS) {
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
    phase: CREDENTIAL_LIFECYCLE_PHASE,
    passed_count: passed,
    total_count: total,
    percent: pct,
    blocking_failed_count: blockingFailed,
    readiness_band: band,
    label:
      band === "ready"
        ? "Ready for placeholder request (metadata only)"
        : band === "almost_ready"
          ? "Nearly ready — resolve remaining checks"
          : band === "blocked"
            ? "Blocked — resolve blocking checks first"
            : "In progress — complete governance prerequisites",
  };
}

export function buildCredentialVisibilitySummary() {
  const keys = SANDBOX_CREDENTIAL_VISIBILITY_STATES.map((v) => v.visibility_key).join(", ");
  return (
    `Visibility states (${SANDBOX_CREDENTIAL_VISIBILITY_STATES.length}): ${keys}. ` +
    "Developers never receive secret material; admin_only and restricted rows support audit without enabling authentication."
  );
}

export function getCredentialLifecycleOverview(seed = SANDBOX_CREDENTIAL_PREVIEW_SEED) {
  return {
    phase: CREDENTIAL_LIFECYCLE_PHASE,
    seed: { ...seed },
    status: getCredentialStatusMeta(seed.status_key),
    environment: getCredentialEnvironmentMeta(seed.environment_key),
    visibility: getCredentialVisibilityMeta(seed.visibility_key),
    request_type: getCredentialRequestTypeMeta(seed.request_type_key),
    lifecycle_summary: buildCredentialLifecycleSummary(seed),
    readiness_score: buildCredentialReadinessScore(),
    visibility_summary: buildCredentialVisibilitySummary(),
  };
}
