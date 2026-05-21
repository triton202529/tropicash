/**
 * Tropicash Developer Platform — Phase 7A:
 * Developer identity & workspace foundation (static modeling only).
 *
 * THIS FILE IS CONFIGURATION-ONLY. It does NOT:
 *   • call Supabase, HTTP APIs, webhooks, workers, or network I/O
 *   • read Date.now(), Math.random(), localStorage, or sessionStorage
 *   • issue API keys, credentials, or touch payment/wallet/treasury/fraud systems
 *
 * Aligns conceptually with Phase 4B–4E app/governance seeds and Phase 5–6 rehearsal
 * vocabulary — cross-links only; no runtime joins.
 */

export const DEVELOPER_WORKSPACE_PHASE = "phase_7a_developer_workspace";

/** @readonly */
export const WORKSPACE_ENVIRONMENT_MODES = [
  "sandbox",
  "live_preview",
  "restricted",
  "suspended",
];

/** @readonly */
export const DEVELOPER_TIERS = ["explorer", "builder", "partner", "enterprise"];

/** @readonly */
export const WORKSPACE_ONBOARDING_STAGES = [
  "access_approved",
  "workspace_initialized",
  "organization_created",
  "first_app_registered",
  "capability_requested",
  "sandbox_ready",
];

/** @readonly {Record<string, string>} */
export const WORKSPACE_ENVIRONMENT_MODE_LABELS = {
  sandbox: "Sandbox",
  live_preview: "Live preview (metadata)",
  restricted: "Restricted",
  suspended: "Suspended",
};

/** @readonly {Record<string, string>} */
export const DEVELOPER_TIER_LABELS = {
  explorer: "Explorer",
  builder: "Builder",
  partner: "Partner",
  enterprise: "Enterprise",
};

/** @readonly {Record<string, string>} */
export const WORKSPACE_ONBOARDING_STAGE_LABELS = {
  access_approved: "Access approved",
  workspace_initialized: "Workspace initialized",
  organization_created: "Organization created",
  first_app_registered: "First app registered",
  capability_requested: "Capability requested",
  sandbox_ready: "Sandbox ready",
};

/**
 * Safety copy for console / docs. No runtime enforcement is implied.
 * @readonly {string[]}
 */
export const WORKSPACE_SAFETY_RULES = [
  "Workspace identity fields are hand-authored seeds — they do not read from auth.users or a live workspace service.",
  "Environment mode labels such as live_preview describe future posture only; no live API surface or credentials are enabled in Phase 7A.",
  "Organization and app counts are static teaching numbers; reconcile with My Apps when Supabase rows exist — this module does not query them.",
  "Onboarding checkpoints and timeline events are narrative placeholders, not workflow engine state.",
  "Health indicators and readiness scores summarize static storytelling fields, not automated risk or fraud scores.",
  "Recommendations may reference console routes for orientation only — following a link does not mutate governance or issue secrets.",
];

/**
 * @type {Readonly<{
 *   workspace_id: string,
 *   display_name: string,
 *   developer_tier: string,
 *   onboarding_stage: string,
 *   environment_mode: string,
 *   created_at_simulated: string,
 *   last_activity_simulated: string,
 * }>}
 */
export const WORKSPACE_IDENTITY_SEED = {
  workspace_id: "wsp_tc_dev_preview_001",
  display_name: "Tropicash Developer Preview",
  developer_tier: "builder",
  onboarding_stage: "capability_requested",
  environment_mode: "sandbox",
  created_at_simulated: "2026-01-15T10:00:00.000Z",
  last_activity_simulated: "2026-05-18T14:30:00.000Z",
};

/**
 * @type {Readonly<{
 *   active_org_count: number,
 *   sandbox_apps_count: number,
 *   pending_reviews_count: number,
 *   approved_capabilities_count: number,
 * }>}
 */
export const WORKSPACE_ORGANIZATION_SUMMARY = {
  active_org_count: 2,
  sandbox_apps_count: 5,
  pending_reviews_count: 3,
  approved_capabilities_count: 12,
};

/**
 * @type {ReadonlyArray<{
 *   checkpoint_key: string,
 *   stage: string,
 *   label: string,
 *   status: "completed"|"current"|"pending",
 *   narrative: string,
 *   sort_order: number,
 * }>}
 */
export const WORKSPACE_ONBOARDING_CHECKPOINTS = [
  {
    checkpoint_key: "chk_access_approved",
    stage: "access_approved",
    label: "Developer access approved",
    status: "completed",
    narrative: "Console shell access granted after intake review — no API keys attached.",
    sort_order: 1,
  },
  {
    checkpoint_key: "chk_workspace_initialized",
    stage: "workspace_initialized",
    label: "Workspace shell initialized",
    status: "completed",
    narrative: "Identity record and environment vocabulary assigned for this preview workspace.",
    sort_order: 2,
  },
  {
    checkpoint_key: "chk_organization_created",
    stage: "organization_created",
    label: "First organization created",
    status: "completed",
    narrative: "At least one developer organization exists for app registration.",
    sort_order: 3,
  },
  {
    checkpoint_key: "chk_first_app_registered",
    stage: "first_app_registered",
    label: "First sandbox app registered",
    status: "completed",
    narrative: "Sandbox app metadata captured; governance may still require activation review.",
    sort_order: 4,
  },
  {
    checkpoint_key: "chk_capability_requested",
    stage: "capability_requested",
    label: "Capability request in flight",
    status: "current",
    narrative: "One or more capability requests await admin decision before sandbox rehearsal expands.",
    sort_order: 5,
  },
  {
    checkpoint_key: "chk_sandbox_ready",
    stage: "sandbox_ready",
    label: "Sandbox rehearsal ready",
    status: "pending",
    narrative: "All governance checkpoints clear for catalog + simulator walkthroughs — still no live traffic.",
    sort_order: 6,
  },
  {
    checkpoint_key: "chk_governance_alignment",
    stage: "capability_requested",
    label: "Governance alignment review",
    status: "pending",
    narrative: "Optional operator pass to confirm app status transitions match capability posture.",
    sort_order: 7,
  },
];

/**
 * @type {ReadonlyArray<{
 *   event_key: string,
 *   occurred_at_simulated: string,
 *   event_type: string,
 *   summary: string,
 *   related_stage: string,
 * }>}
 */
export const WORKSPACE_EVENTS = [
  {
    event_key: "evt_access_granted",
    occurred_at_simulated: "2026-01-15T10:00:00.000Z",
    event_type: "access.approved",
    summary: "Developer access request approved for console shell.",
    related_stage: "access_approved",
  },
  {
    event_key: "evt_workspace_boot",
    occurred_at_simulated: "2026-01-16T09:15:00.000Z",
    event_type: "workspace.initialized",
    summary: "Workspace identity seed attached to preview developer account.",
    related_stage: "workspace_initialized",
  },
  {
    event_key: "evt_org_alpha",
    occurred_at_simulated: "2026-01-22T11:40:00.000Z",
    event_type: "organization.created",
    summary: "Organization “Preview Commerce Lab” registered.",
    related_stage: "organization_created",
  },
  {
    event_key: "evt_app_alpha",
    occurred_at_simulated: "2026-02-03T16:20:00.000Z",
    event_type: "app.registered",
    summary: "Sandbox App Alpha created under Preview Commerce Lab.",
    related_stage: "first_app_registered",
  },
  {
    event_key: "evt_review_sandbox",
    occurred_at_simulated: "2026-02-10T08:05:00.000Z",
    event_type: "governance.review_submitted",
    summary: "Sandbox activation review submitted for Sandbox App Alpha.",
    related_stage: "first_app_registered",
  },
  {
    event_key: "evt_review_approved",
    occurred_at_simulated: "2026-02-12T13:00:00.000Z",
    event_type: "governance.review_approved",
    summary: "Sandbox activation approved — metadata status only.",
    related_stage: "first_app_registered",
  },
  {
    event_key: "evt_cap_requested",
    occurred_at_simulated: "2026-04-28T10:30:00.000Z",
    event_type: "capability.requested",
    summary: "wallet.read capability requested for Sandbox App Beta.",
    related_stage: "capability_requested",
  },
  {
    event_key: "evt_catalog_viewed",
    occurred_at_simulated: "2026-05-10T15:45:00.000Z",
    event_type: "console.navigation",
    summary: "Product catalog rehearsal opened for contract alignment.",
    related_stage: "capability_requested",
  },
  {
    event_key: "evt_simulator_auth",
    occurred_at_simulated: "2026-05-18T14:30:00.000Z",
    event_type: "simulator.rehearsal",
    summary: "Auth simulator trace reviewed — verification modeling only.",
    related_stage: "capability_requested",
  },
];

/**
 * @type {ReadonlyArray<{
 *   indicator_key: string,
 *   label: string,
 *   status: "healthy"|"watch"|"attention"|"blocked",
 *   score_band: string,
 *   narrative: string,
 * }>}
 */
export const WORKSPACE_HEALTH_INDICATORS = [
  {
    indicator_key: "health_identity",
    label: "Identity completeness",
    status: "healthy",
    score_band: "complete",
    narrative: "Core workspace fields populated in static seed.",
  },
  {
    indicator_key: "health_onboarding",
    label: "Onboarding progression",
    status: "watch",
    score_band: "in_progress",
    narrative: "Capability request stage active; sandbox_ready checkpoint still pending.",
  },
  {
    indicator_key: "health_governance",
    label: "Governance queue pressure",
    status: "watch",
    score_band: "moderate",
    narrative: "Three pending reviews in org summary seed — reconcile on My Apps.",
  },
  {
    indicator_key: "health_environment",
    label: "Environment posture",
    status: "healthy",
    score_band: "sandbox_only",
    narrative: "environment_mode sandbox — no live_preview or restricted flags set.",
  },
  {
    indicator_key: "health_capabilities",
    label: "Capability coverage",
    status: "attention",
    score_band: "expanding",
    narrative: "Approved capabilities count rising; one open request may block simulator breadth.",
  },
  {
    indicator_key: "health_credential_readiness",
    label: "Credential readiness (conceptual)",
    status: "attention",
    score_band: "architecture_only",
    narrative: "Phase 5A architecture reviewed; issuance remains a future phase.",
  },
  {
    indicator_key: "health_runtime_activation",
    label: "Runtime activation (conceptual)",
    status: "healthy",
    score_band: "governance_rehearsal",
    narrative: "Phase 6A gates rehearsed — no runtime armed.",
  },
];

/**
 * @type {ReadonlyArray<{
 *   notice_key: string,
 *   severity: "info"|"caution"|"restricted",
 *   title: string,
 *   body: string,
 * }>}
 */
export const WORKSPACE_ENVIRONMENT_NOTICES = [
  {
    notice_key: "env_sandbox_first",
    severity: "info",
    title: "Sandbox-first default",
    body: "All rehearsal traffic and catalog contracts assume sandbox environment_mode until governance upgrades metadata.",
  },
  {
    notice_key: "env_no_live_api",
    severity: "caution",
    title: "No live API surface",
    body: "live_preview and live_active labels are teaching vocabulary only — no HTTP edge accepts developer traffic in this repository phase.",
  },
  {
    notice_key: "env_no_credentials",
    severity: "caution",
    title: "Credentials deferred",
    body: "API keys, signing secrets, and vault material are modeled in Phase 5A architecture — not issued from this workspace.",
  },
  {
    notice_key: "env_metadata_only",
    severity: "info",
    title: "Metadata-only transitions",
    body: "App status and capability rows may change via governance UI; workspace seeds do not auto-sync from Supabase.",
  },
  {
    notice_key: "env_restricted_preview",
    severity: "restricted",
    title: "Restricted mode available",
    body: "restricted environment_mode narrates elevated review requirements — not active for this preview seed.",
  },
  {
    notice_key: "env_suspended_guard",
    severity: "restricted",
    title: "Suspended guardrail",
    body: "suspended mode would block all simulator entry points in a future enforcement layer — simulation copy only here.",
  },
];

/**
 * @type {ReadonlyArray<{
 *   recommendation_key: string,
 *   priority: "high"|"medium"|"low",
 *   title: string,
 *   summary: string,
 *   action_hint: string,
 *   related_route: string,
 * }>}
 */
export const WORKSPACE_RECOMMENDATIONS = [
  {
    recommendation_key: "rec_complete_capability_review",
    priority: "high",
    title: "Resolve open capability requests",
    summary: "Clear pending capability governance so sandbox rehearsal matches requested internal capabilities.",
    action_hint: "Open App Capabilities and track admin decisions.",
    related_route: "/dev-console/app-capabilities",
  },
  {
    recommendation_key: "rec_register_second_app",
    priority: "medium",
    title: "Register a second sandbox app",
    summary: "Exercise multi-app org summaries and mixed governance posture in My Apps.",
    action_hint: "Use Register App when organization metadata is ready.",
    related_route: "/dev-console/apps-register",
  },
  {
    recommendation_key: "rec_catalog_alignment",
    priority: "high",
    title: "Align apps with product catalog",
    summary: "Cross-check product_key and contract_key vocabulary before simulator walks.",
    action_hint: "Browse static API products and sandbox contracts.",
    related_route: "/dev-console/product-catalog",
  },
  {
    recommendation_key: "rec_credential_architecture",
    priority: "medium",
    title: "Review credential architecture",
    summary: "Understand lifecycle and vault blueprint before imagining key issuance.",
    action_hint: "Read Phase 5A metadata — no secrets on that page.",
    related_route: "/dev-console/credential-architecture",
  },
  {
    recommendation_key: "rec_auth_simulator",
    priority: "medium",
    title: "Rehearse auth verification stages",
    summary: "Walk deterministic auth traces that mirror future gateway checks.",
    action_hint: "Run Auth Simulator scenarios — modeling only.",
    related_route: "/dev-console/auth-simulator",
  },
  {
    recommendation_key: "rec_sandbox_analytics",
    priority: "low",
    title: "Preview sandbox analytics seeds",
    summary: "See how usage and health grades tell operator stories alongside real app rows.",
    action_hint: "Compare analytics seeds with My Apps statuses.",
    related_route: "/dev-console/sandbox-analytics",
  },
  {
    recommendation_key: "rec_runtime_activation",
    priority: "low",
    title: "Study runtime activation gates",
    summary: "Understand Phase 6A governance before any future runtime work.",
    action_hint: "Evaluate activation cases — simulation only.",
    related_route: "/dev-console/runtime-activation",
  },
  {
    recommendation_key: "rec_my_apps_reconcile",
    priority: "high",
    title: "Reconcile workspace counts with My Apps",
    summary: "Organization summary numbers are static until you compare live Supabase rows.",
    action_hint: "Open My Apps for authoritative app and review lists.",
    related_route: "/dev-console/my-apps",
  },
];

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

/** @returns {typeof WORKSPACE_IDENTITY_SEED & { phase: string, organization_summary: typeof WORKSPACE_ORGANIZATION_SUMMARY }} */
export function getWorkspaceOverview() {
  return {
    phase: DEVELOPER_WORKSPACE_PHASE,
    ...WORKSPACE_IDENTITY_SEED,
    organization_summary: { ...WORKSPACE_ORGANIZATION_SUMMARY },
    tier_label: DEVELOPER_TIER_LABELS[WORKSPACE_IDENTITY_SEED.developer_tier] ?? WORKSPACE_IDENTITY_SEED.developer_tier,
    onboarding_stage_label:
      WORKSPACE_ONBOARDING_STAGE_LABELS[WORKSPACE_IDENTITY_SEED.onboarding_stage] ??
      WORKSPACE_IDENTITY_SEED.onboarding_stage,
    environment_mode_label:
      WORKSPACE_ENVIRONMENT_MODE_LABELS[WORKSPACE_IDENTITY_SEED.environment_mode] ??
      WORKSPACE_IDENTITY_SEED.environment_mode,
  };
}

export function getWorkspaceHealth() {
  /** @type {Record<string, number>} */
  const byStatus = {};
  for (const h of WORKSPACE_HEALTH_INDICATORS) {
    byStatus[h.status] = (byStatus[h.status] || 0) + 1;
  }
  return {
    phase: DEVELOPER_WORKSPACE_PHASE,
    indicators: [...WORKSPACE_HEALTH_INDICATORS],
    indicators_by_status: byStatus,
    total_indicators: WORKSPACE_HEALTH_INDICATORS.length,
    readiness: buildWorkspaceReadinessScore(),
  };
}

export function getWorkspaceTimeline() {
  const events = [...WORKSPACE_EVENTS].sort((a, b) => {
    if (a.occurred_at_simulated < b.occurred_at_simulated) return -1;
    if (a.occurred_at_simulated > b.occurred_at_simulated) return 1;
    return a.event_key.localeCompare(b.event_key);
  });
  return {
    phase: DEVELOPER_WORKSPACE_PHASE,
    events,
    total_events: events.length,
    checkpoints: [...WORKSPACE_ONBOARDING_CHECKPOINTS].sort((a, b) => a.sort_order - b.sort_order),
  };
}

export function getWorkspaceRecommendations() {
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const cards = [...WORKSPACE_RECOMMENDATIONS].sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 9;
    const pb = priorityOrder[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return a.recommendation_key.localeCompare(b.recommendation_key);
  });
  return {
    phase: DEVELOPER_WORKSPACE_PHASE,
    recommendations: cards,
    total_recommendations: cards.length,
  };
}

export function getWorkspaceEnvironmentMeta() {
  const mode = WORKSPACE_IDENTITY_SEED.environment_mode;
  return {
    phase: DEVELOPER_WORKSPACE_PHASE,
    environment_mode: mode,
    environment_mode_label: WORKSPACE_ENVIRONMENT_MODE_LABELS[mode] ?? mode,
    available_modes: [...WORKSPACE_ENVIRONMENT_MODES],
    notices: [...WORKSPACE_ENVIRONMENT_NOTICES],
    sandbox_first: mode === "sandbox",
    live_api_enabled: false,
    credentials_issued: false,
  };
}

export function buildWorkspaceSummary() {
  const overview = getWorkspaceOverview();
  const org = overview.organization_summary;
  return {
    phase: DEVELOPER_WORKSPACE_PHASE,
    headline: `${overview.display_name} — ${overview.environment_mode_label}`,
    narrative: `Preview workspace on ${overview.tier_label} tier at stage “${overview.onboarding_stage_label}”. ${org.active_org_count} active org(s), ${org.sandbox_apps_count} sandbox app(s), ${org.pending_reviews_count} pending review(s), ${org.approved_capabilities_count} approved capability assignment(s) in static seeds.`,
    modeling_note:
      "Summary strings are assembled from WORKSPACE_IDENTITY_SEED and WORKSPACE_ORGANIZATION_SUMMARY only — no database reads.",
  };
}

/**
 * Deterministic readiness score (0–100) from checkpoints, health, and onboarding stage index.
 */
export function buildWorkspaceReadinessScore() {
  const checkpoints = WORKSPACE_ONBOARDING_CHECKPOINTS;
  const completed = checkpoints.filter((c) => c.status === "completed").length;
  const current = checkpoints.filter((c) => c.status === "current").length;
  const checkpointRatio = (completed + current * 0.5) / checkpoints.length;

  const healthWeight = { healthy: 1, watch: 0.75, attention: 0.5, blocked: 0.25 };
  let healthSum = 0;
  for (const h of WORKSPACE_HEALTH_INDICATORS) {
    healthSum += healthWeight[h.status] ?? 0.5;
  }
  const healthAvg = healthSum / WORKSPACE_HEALTH_INDICATORS.length;

  const stageIndex = WORKSPACE_ONBOARDING_STAGES.indexOf(WORKSPACE_IDENTITY_SEED.onboarding_stage);
  const stageRatio =
    stageIndex >= 0 ? (stageIndex + 1) / WORKSPACE_ONBOARDING_STAGES.length : 0.5;

  const raw = checkpointRatio * 40 + healthAvg * 35 + stageRatio * 25;
  const score = Math.min(100, Math.max(0, Math.round(raw)));

  let band = "forming";
  if (score >= 85) band = "strong";
  else if (score >= 70) band = "progressing";
  else if (score >= 50) band = "developing";

  return {
    phase: DEVELOPER_WORKSPACE_PHASE,
    score,
    max_score: 100,
    band,
    factors: [
      {
        key: "onboarding_checkpoints",
        weight_percent: 40,
        contribution: Math.round(checkpointRatio * 40),
        detail: `${completed} completed, ${current} current of ${checkpoints.length} checkpoints`,
      },
      {
        key: "health_indicators",
        weight_percent: 35,
        contribution: Math.round(healthAvg * 35),
        detail: `${WORKSPACE_HEALTH_INDICATORS.length} static health indicators averaged`,
      },
      {
        key: "onboarding_stage",
        weight_percent: 25,
        contribution: Math.round(stageRatio * 25),
        detail: `Stage index ${stageIndex + 1} of ${WORKSPACE_ONBOARDING_STAGES.length} (${WORKSPACE_IDENTITY_SEED.onboarding_stage})`,
      },
    ],
    modeling_note: "Score is recomputed from seeds on every call — no persistence or clocks.",
  };
}
