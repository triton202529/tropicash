/**
 * Tropicash Developer Platform — Phase 7B:
 * Workspace personalization & context layer (static modeling only).
 *
 * THIS FILE IS CONFIGURATION-ONLY. It does NOT:
 *   • call Supabase, HTTP APIs, webhooks, workers, or network I/O
 *   • read Date.now(), Math.random(), localStorage, or sessionStorage
 *   • issue API keys, credentials, or touch payment/wallet/treasury/fraud systems
 *
 * Aligns with Phase 7A `lib/developerWorkspaceConfig.js` — read-only imports for seed alignment.
 */

import {
  DEVELOPER_WORKSPACE_PHASE,
  WORKSPACE_HEALTH_INDICATORS,
  WORKSPACE_IDENTITY_SEED,
  WORKSPACE_ONBOARDING_STAGE_LABELS,
  WORKSPACE_ONBOARDING_STAGES,
  WORKSPACE_RECOMMENDATIONS,
  buildWorkspaceReadinessScore,
} from "./developerWorkspaceConfig";

export const WORKSPACE_CONTEXT_PHASE = "phase_7b_workspace_context";

/** @readonly */
export const DEVELOPER_PERSONA_TYPES = [
  {
    persona_key: "explorer",
    label: "Explorer",
    description:
      "Learning the platform vocabulary — catalog browsing, governance tours, and simulator walkthroughs before heavy integration.",
    onboarding_priority: "orientation",
    suggested_actions: [
      "Browse product catalog contracts",
      "Review workspace onboarding milestones",
      "Open auth simulator introductory traces",
    ],
    maturity_level: "foundational",
  },
  {
    persona_key: "builder",
    label: "Builder",
    description:
      "Registering sandbox apps, requesting capabilities, and aligning metadata with catalog products for rehearsal breadth.",
    onboarding_priority: "app_registration",
    suggested_actions: [
      "Register a second sandbox app",
      "Request capabilities matching catalog products",
      "Reconcile My Apps with workspace counts",
    ],
    maturity_level: "developing",
  },
  {
    persona_key: "integrator",
    label: "Integrator",
    description:
      "Cross-wiring catalog contracts, capability grants, and simulator traces to rehearse end-to-end integration stories.",
    onboarding_priority: "contract_alignment",
    suggested_actions: [
      "Align apps with product catalog keys",
      "Rehearse auth verification stages",
      "Track pending capability governance",
    ],
    maturity_level: "developing",
  },
  {
    persona_key: "operator",
    label: "Operator",
    description:
      "Monitoring governance queues, review pressure, and sandbox health narratives as if preparing for operator handoff.",
    onboarding_priority: "governance_visibility",
    suggested_actions: [
      "Open Developer Governance for review posture",
      "Preview sandbox analytics seeds",
      "Study runtime activation gates",
    ],
    maturity_level: "maturing",
  },
  {
    persona_key: "partner",
    label: "Partner",
    description:
      "Coordinating multi-app organizations, elevated capability posture, and partner-tier vocabulary before any live surface.",
    onboarding_priority: "multi_app_coordination",
    suggested_actions: [
      "Resolve open capability requests across apps",
      "Review credential architecture lifecycle",
      "Compare analytics seeds with app statuses",
    ],
    maturity_level: "maturing",
  },
  {
    persona_key: "enterprise",
    label: "Enterprise",
    description:
      "Planning organization-scale governance, restricted-mode narratives, and future enterprise controls — metadata only.",
    onboarding_priority: "organization_scale",
    suggested_actions: [
      "Complete organization setup milestones",
      "Review restricted context state copy",
      "Align runtime activation readiness audit",
    ],
    maturity_level: "advanced",
  },
];

/** @readonly */
export const WORKSPACE_CONTEXT_STATES = [
  {
    state_key: "onboarding",
    label: "Onboarding",
    description: "Early workspace access — identity seeded, first organizations and apps still forming.",
  },
  {
    state_key: "active",
    label: "Active",
    description: "Routine console rehearsal — apps registered, governance and catalog tools in regular use.",
  },
  {
    state_key: "sandbox_ready",
    label: "Sandbox ready",
    description: "Governance checkpoints clear for catalog and simulator walkthroughs — still no live traffic.",
  },
  {
    state_key: "review_required",
    label: "Review required",
    description: "One or more governance reviews or activation cases need operator attention in metadata.",
  },
  {
    state_key: "capability_pending",
    label: "Capability pending",
    description: "Capability requests await admin decision before simulator breadth matches intent.",
  },
  {
    state_key: "organization_setup",
    label: "Organization setup",
    description: "Focus on registering organizations and first apps before capability expansion.",
  },
  {
    state_key: "restricted",
    label: "Restricted",
    description: "Elevated review narrative — restricted environment vocabulary, not active enforcement.",
  },
];

/** @readonly */
export const WORKSPACE_ENVIRONMENT_PREFERENCES = [
  {
    preference_key: "sandbox_first",
    label: "Sandbox first",
    description: "Default rehearsal posture — all traffic narratives assume sandbox until governance upgrades metadata.",
  },
  {
    preference_key: "live_preview",
    label: "Live preview (metadata)",
    description: "Teaching vocabulary for a future live_preview mode — no HTTP edge accepts developer traffic.",
  },
  {
    preference_key: "governance_first",
    label: "Governance first",
    description: "Prioritize review queues, activation cases, and app status transitions before simulator depth.",
  },
  {
    preference_key: "capability_first",
    label: "Capability first",
    description: "Expand approved internal capabilities before catalog contract breadth or analytics drills.",
  },
  {
    preference_key: "analytics_first",
    label: "Analytics first",
    description: "Start from sandbox analytics seeds and health grades, then reconcile with My Apps rows.",
  },
];

/**
 * @type {ReadonlyArray<{
 *   milestone_key: string,
 *   label: string,
 *   status: "completed"|"current"|"pending"|"placeholder",
 *   narrative: string,
 *   sort_order: number,
 * }>}
 */
export const WORKSPACE_ONBOARDING_MILESTONES = [
  {
    milestone_key: "milestone_access_granted",
    label: "Console access granted",
    status: "completed",
    narrative: "Developer shell access approved — no API keys attached.",
    sort_order: 1,
  },
  {
    milestone_key: "milestone_workspace_personalized",
    label: "Workspace context personalized",
    status: "completed",
    narrative: "Persona, context state, and environment preference seeds assigned for Phase 7B preview.",
    sort_order: 2,
  },
  {
    milestone_key: "milestone_organization_ready",
    label: "Organization structure ready",
    status: "completed",
    narrative: "At least one developer organization exists for app registration.",
    sort_order: 3,
  },
  {
    milestone_key: "milestone_first_sandbox_app",
    label: "First sandbox app registered",
    status: "completed",
    narrative: "Sandbox app metadata captured; governance may still require activation review.",
    sort_order: 4,
  },
  {
    milestone_key: "milestone_capability_in_flight",
    label: "Capability request in flight",
    status: "current",
    narrative: "Open capability governance aligns with integrator persona and capability_pending context.",
    sort_order: 5,
  },
  {
    milestone_key: "milestone_catalog_alignment",
    label: "Catalog alignment rehearsed",
    status: "pending",
    narrative: "Product keys and contract keys cross-checked against registered apps — static rehearsal only.",
    sort_order: 6,
  },
  {
    milestone_key: "milestone_sandbox_rehearsal_ready",
    label: "Sandbox rehearsal ready",
    status: "pending",
    narrative: "All governance milestones clear for simulator and analytics walkthroughs.",
    sort_order: 7,
  },
  {
    milestone_key: "credential_prepared_placeholder",
    label: "Credential readiness (placeholder)",
    status: "placeholder",
    narrative:
      "Future planning only — no credentials issued. Phase 5A architecture reviewed; vault and issuance remain future phases.",
    sort_order: 8,
  },
];

/**
 * @type {ReadonlyArray<{
 *   rule_key: string,
 *   persona_keys: string[],
 *   context_states: string[],
 *   onboarding_stages: string[],
 *   recommendation_keys: string[],
 *   priority_boost: "high"|"medium"|"low",
 *   rationale: string,
 * }>}
 */
export const WORKSPACE_RECOMMENDATION_RULES = [
  {
    rule_key: "rule_integrator_capability",
    persona_keys: ["integrator", "builder"],
    context_states: ["capability_pending", "active"],
    onboarding_stages: ["capability_requested", "first_app_registered"],
    recommendation_keys: ["rec_complete_capability_review", "rec_catalog_alignment"],
    priority_boost: "high",
    rationale: "Integrators and builders with open capability work should clear governance before catalog depth.",
  },
  {
    rule_key: "rule_explorer_orientation",
    persona_keys: ["explorer"],
    context_states: ["onboarding", "organization_setup"],
    onboarding_stages: ["access_approved", "workspace_initialized", "organization_created"],
    recommendation_keys: ["rec_catalog_alignment", "rec_auth_simulator"],
    priority_boost: "high",
    rationale: "Explorers benefit from catalog vocabulary and auth traces before capability requests.",
  },
  {
    rule_key: "rule_operator_governance",
    persona_keys: ["operator", "partner"],
    context_states: ["review_required", "capability_pending"],
    onboarding_stages: ["capability_requested", "sandbox_ready"],
    recommendation_keys: ["rec_my_apps_reconcile", "rec_complete_capability_review"],
    priority_boost: "high",
    rationale: "Operators reconcile static workspace counts with live My Apps governance rows.",
  },
  {
    rule_key: "rule_partner_credential_planning",
    persona_keys: ["partner", "enterprise"],
    context_states: ["active", "sandbox_ready"],
    onboarding_stages: ["capability_requested", "sandbox_ready"],
    recommendation_keys: ["rec_credential_architecture", "rec_runtime_activation"],
    priority_boost: "medium",
    rationale: "Partner and enterprise personas should read architecture before imagining issuance.",
  },
  {
    rule_key: "rule_analytics_first",
    persona_keys: ["operator", "integrator"],
    context_states: ["active", "sandbox_ready"],
    onboarding_stages: ["first_app_registered", "capability_requested"],
    recommendation_keys: ["rec_sandbox_analytics", "rec_my_apps_reconcile"],
    priority_boost: "medium",
    rationale: "Analytics-first preference pairs usage seeds with authoritative app lists.",
  },
  {
    rule_key: "rule_builder_second_app",
    persona_keys: ["builder"],
    context_states: ["active", "organization_setup"],
    onboarding_stages: ["first_app_registered", "organization_created"],
    recommendation_keys: ["rec_register_second_app", "rec_catalog_alignment"],
    priority_boost: "medium",
    rationale: "Builders exercising multi-app posture learn mixed governance in My Apps.",
  },
  {
    rule_key: "rule_enterprise_runtime",
    persona_keys: ["enterprise"],
    context_states: ["sandbox_ready", "restricted"],
    onboarding_stages: ["sandbox_ready", "capability_requested"],
    recommendation_keys: ["rec_runtime_activation", "rec_credential_architecture"],
    priority_boost: "low",
    rationale: "Enterprise maturity includes runtime activation rehearsal — simulation only.",
  },
];

/**
 * @type {ReadonlyArray<{
 *   activity_key: string,
 *   title: string,
 *   description: string,
 *   category: string,
 *   importance: "high"|"medium"|"low",
 *   simulated_time_label: string,
 * }>}
 */
export const WORKSPACE_ACTIVITY_SEEDS = [
  {
    activity_key: "act_persona_assigned",
    title: "Developer persona assigned",
    description: "Integrator persona seed linked to workspace context — no profile service write.",
    category: "context",
    importance: "medium",
    simulated_time_label: "Jan 16, 2026",
  },
  {
    activity_key: "act_context_active",
    title: "Context state set to capability pending",
    description: "Open capability request drives capability_pending context for smart recommendations.",
    category: "governance",
    importance: "high",
    simulated_time_label: "Apr 28, 2026",
  },
  {
    activity_key: "act_catalog_opened",
    title: "Product catalog rehearsal",
    description: "Browsed static API products to align contract_key vocabulary with Sandbox App Alpha.",
    category: "catalog",
    importance: "high",
    simulated_time_label: "May 10, 2026",
  },
  {
    activity_key: "act_auth_simulator",
    title: "Auth simulator trace reviewed",
    description: "Walked deterministic verification stages — modeling only, no gateway traffic.",
    category: "simulator",
    importance: "medium",
    simulated_time_label: "May 18, 2026",
  },
  {
    activity_key: "act_my_apps_reconcile",
    title: "My Apps reconciliation noted",
    description: "Compared workspace org summary counts with live Supabase rows on My Apps.",
    category: "governance",
    importance: "high",
    simulated_time_label: "May 17, 2026",
  },
  {
    activity_key: "act_analytics_preview",
    title: "Sandbox analytics seeds opened",
    description: "Reviewed health grades and rate-limit pressure narratives for Sandbox App Alpha.",
    category: "analytics",
    importance: "medium",
    simulated_time_label: "May 12, 2026",
  },
  {
    activity_key: "act_credential_architecture",
    title: "Credential architecture read",
    description: "Studied Phase 5A lifecycle blueprint — future planning only, no credentials issued.",
    category: "architecture",
    importance: "medium",
    simulated_time_label: "May 5, 2026",
  },
  {
    activity_key: "act_milestone_progress",
    title: "Milestone progress updated (static)",
    description: "Catalog alignment milestone marked pending; credential placeholder remains future planning.",
    category: "onboarding",
    importance: "low",
    simulated_time_label: "May 19, 2026",
  },
  {
    activity_key: "act_environment_pref",
    title: "Environment preference confirmed",
    description: "sandbox_first preference reaffirmed — live_preview remains teaching vocabulary only.",
    category: "environment",
    importance: "low",
    simulated_time_label: "May 19, 2026",
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
export const WORKSPACE_NOTICE_SEEDS = [
  {
    notice_key: "ctx_persona_static",
    severity: "info",
    title: "Persona is a static seed",
    body: "Developer persona, context state, and environment preference are hand-authored for UI rehearsal — they do not sync from auth or a profile service.",
  },
  {
    notice_key: "ctx_no_credentials",
    severity: "caution",
    title: "Credential milestone is placeholder only",
    body: "credential_prepared_placeholder milestone explicitly marks future planning — no credentials issued in Phase 7B.",
  },
  {
    notice_key: "ctx_recommendations_rules",
    severity: "info",
    title: "Smart recommendations are rule-driven",
    body: "WORKSPACE_RECOMMENDATION_RULES filter Phase 7A recommendation cards by persona and context — following links does not mutate governance.",
  },
  {
    notice_key: "ctx_activity_simulated",
    severity: "info",
    title: "Activity feed uses simulated time labels",
    body: "simulated_time_label strings are narrative placeholders — not computed from Date.now() or event streams.",
  },
  {
    notice_key: "ctx_restricted_narrative",
    severity: "restricted",
    title: "Restricted context is storytelling",
    body: "restricted context state describes elevated review requirements for enterprise rehearsal — not active enforcement on this preview seed.",
  },
  {
    notice_key: "ctx_align_7a",
    severity: "info",
    title: "Aligned with Phase 7A identity",
    body: "Context layer reads WORKSPACE_IDENTITY_SEED from developerWorkspaceConfig.js for tier and onboarding stage alignment only.",
  },
];

/**
 * @readonly {string[]}
 */
export const WORKSPACE_CONTEXT_SAFETY_RULES = [
  "Persona, context state, and environment preference are static seeds — no auth profile or workspace service writes.",
  "Activity feed events use simulated_time_label strings only — no Date.now(), clocks, or telemetry ingestion.",
  "Smart recommendations merge rule output with Phase 7A cards; opening a route does not issue secrets or change governance.",
  "credential_prepared_placeholder milestone is future planning only — no credentials issued in this phase.",
  "Context health overlays summarize Phase 7A health indicators — they are not automated risk or fraud scores.",
  "WORKSPACE_RECOMMENDATION_RULES may reference onboarding stages from Phase 7A — rules do not execute workflows.",
  "Reconcile organization and app counts on My Apps; context layer does not query Supabase.",
];

/**
 * @type {Readonly<{
 *   persona_key: string,
 *   context_state: string,
 *   environment_preference: string,
 * }>}
 */
export const WORKSPACE_CONTEXT_SEED = {
  persona_key: "integrator",
  context_state: "capability_pending",
  environment_preference: "sandbox_first",
};

// ---------------------------------------------------------------------------
// Helpers (pure)
// ---------------------------------------------------------------------------

/** @returns {{ phase: string, persona: typeof DEVELOPER_PERSONA_TYPES[number], seed: typeof WORKSPACE_CONTEXT_SEED }} */
export function getDeveloperPersona() {
  const key = WORKSPACE_CONTEXT_SEED.persona_key;
  const persona =
    DEVELOPER_PERSONA_TYPES.find((p) => p.persona_key === key) ?? DEVELOPER_PERSONA_TYPES[0];
  return {
    phase: WORKSPACE_CONTEXT_PHASE,
    persona: { ...persona },
    seed: { ...WORKSPACE_CONTEXT_SEED },
    aligns_with_tier: WORKSPACE_IDENTITY_SEED.developer_tier,
    tier_note:
      "Persona (integrator) may differ from developer_tier (builder) — both are teaching dimensions in static seeds.",
  };
}

/** @returns {{ phase: string, context_state: object, onboarding_stage: string, onboarding_stage_label: string }} */
export function getWorkspaceContext() {
  const key = WORKSPACE_CONTEXT_SEED.context_state;
  const state = WORKSPACE_CONTEXT_STATES.find((s) => s.state_key === key) ?? WORKSPACE_CONTEXT_STATES[0];
  const stage = WORKSPACE_IDENTITY_SEED.onboarding_stage;
  return {
    phase: WORKSPACE_CONTEXT_PHASE,
    context_state: { ...state },
    context_state_key: state.state_key,
    onboarding_stage: stage,
    onboarding_stage_label: WORKSPACE_ONBOARDING_STAGE_LABELS[stage] ?? stage,
    workspace_phase_anchor: DEVELOPER_WORKSPACE_PHASE,
  };
}

/** @returns {{ phase: string, preference: object, sandbox_first: boolean }} */
export function getWorkspaceEnvironmentPreference() {
  const key = WORKSPACE_CONTEXT_SEED.environment_preference;
  const preference =
    WORKSPACE_ENVIRONMENT_PREFERENCES.find((p) => p.preference_key === key) ??
    WORKSPACE_ENVIRONMENT_PREFERENCES[0];
  return {
    phase: WORKSPACE_CONTEXT_PHASE,
    preference: { ...preference },
    preference_key: preference.preference_key,
    sandbox_first: preference.preference_key === "sandbox_first",
    environment_mode_anchor: WORKSPACE_IDENTITY_SEED.environment_mode,
  };
}

export function getWorkspaceActivityFeed() {
  const importanceOrder = { high: 0, medium: 1, low: 2 };
  const items = [...WORKSPACE_ACTIVITY_SEEDS].sort((a, b) => {
    const ia = importanceOrder[a.importance] ?? 9;
    const ib = importanceOrder[b.importance] ?? 9;
    if (ia !== ib) return ia - ib;
    return a.activity_key.localeCompare(b.activity_key);
  });
  return {
    phase: WORKSPACE_CONTEXT_PHASE,
    activities: items,
    total_activities: items.length,
  };
}

export function getWorkspaceNotices() {
  return {
    phase: WORKSPACE_CONTEXT_PHASE,
    notices: [...WORKSPACE_NOTICE_SEEDS],
    total_notices: WORKSPACE_NOTICE_SEEDS.length,
    safety_rules: [...WORKSPACE_CONTEXT_SAFETY_RULES],
  };
}

export function getWorkspaceRecommendations() {
  const persona = WORKSPACE_CONTEXT_SEED.persona_key;
  const contextState = WORKSPACE_CONTEXT_SEED.context_state;
  const stage = WORKSPACE_IDENTITY_SEED.onboarding_stage;

  const matchedRules = WORKSPACE_RECOMMENDATION_RULES.filter(
    (r) =>
      r.persona_keys.includes(persona) &&
      r.context_states.includes(contextState) &&
      r.onboarding_stages.includes(stage),
  );

  const boostOrder = { high: 0, medium: 1, low: 2 };
  const basePriority = { high: 0, medium: 1, low: 2 };

  /** @type {Map<string, { card: typeof WORKSPACE_RECOMMENDATIONS[number], boost: string, rules: string[] }>} */
  const keyed = new Map();

  for (const card of WORKSPACE_RECOMMENDATIONS) {
    keyed.set(card.recommendation_key, { card: { ...card }, boost: card.priority, rules: [] });
  }

  for (const rule of matchedRules) {
    for (const recKey of rule.recommendation_keys) {
      const entry = keyed.get(recKey);
      if (!entry) continue;
      entry.rules.push(rule.rule_key);
      const currentBoost = boostOrder[entry.boost] ?? 9;
      const ruleBoost = boostOrder[rule.priority_boost] ?? 9;
      if (ruleBoost < currentBoost) entry.boost = rule.priority_boost;
    }
  }

  const recommendations = [...keyed.values()]
    .filter((e) => e.rules.length > 0 || matchedRules.length === 0)
    .map((e) => ({
      ...e.card,
      context_priority: e.boost,
      matched_rules: [...e.rules],
      persona_aligned: e.rules.length > 0,
    }))
    .sort((a, b) => {
      const pa = boostOrder[a.context_priority] ?? basePriority[a.priority] ?? 9;
      const pb = boostOrder[b.context_priority] ?? basePriority[b.priority] ?? 9;
      if (pa !== pb) return pa - pb;
      return a.recommendation_key.localeCompare(b.recommendation_key);
    });

  const fallback =
    matchedRules.length === 0
      ? WORKSPACE_RECOMMENDATIONS.map((c) => ({
          ...c,
          context_priority: c.priority,
          matched_rules: [],
          persona_aligned: false,
        }))
      : recommendations;

  return {
    phase: WORKSPACE_CONTEXT_PHASE,
    recommendations: fallback,
    total_recommendations: fallback.length,
    matched_rule_count: matchedRules.length,
    persona_key: persona,
    context_state: contextState,
  };
}

export function buildWorkspaceContextSummary() {
  const persona = getDeveloperPersona();
  const context = getWorkspaceContext();
  const preference = getWorkspaceEnvironmentPreference();
  return {
    phase: WORKSPACE_CONTEXT_PHASE,
    headline: `${persona.persona.label} · ${context.context_state.label}`,
    narrative: `Operating as ${persona.persona.label} (${persona.persona.maturity_level}) in ${context.context_state.label} context with ${preference.preference.label} environment preference. Onboarding stage: ${context.onboarding_stage_label}.`,
    modeling_note:
      "Assembled from WORKSPACE_CONTEXT_SEED and WORKSPACE_IDENTITY_SEED only — no database reads or clocks.",
    persona_key: persona.persona.persona_key,
    context_state_key: context.context_state_key,
    environment_preference_key: preference.preference_key,
  };
}

export function buildWorkspaceProgressSummary() {
  const milestones = [...WORKSPACE_ONBOARDING_MILESTONES].sort((a, b) => a.sort_order - b.sort_order);
  const completed = milestones.filter((m) => m.status === "completed").length;
  const current = milestones.filter((m) => m.status === "current").length;
  const pending = milestones.filter((m) => m.status === "pending").length;
  const placeholder = milestones.filter((m) => m.status === "placeholder").length;
  const progressPercent = Math.round(
    ((completed + current * 0.5) / milestones.length) * 100,
  );

  return {
    phase: WORKSPACE_CONTEXT_PHASE,
    milestones,
    totals: {
      completed,
      current,
      pending,
      placeholder,
      total: milestones.length,
    },
    progress_percent: progressPercent,
    credential_placeholder_note:
      "credential_prepared_placeholder is future planning only — no credentials issued.",
    aligns_onboarding_stages: [...WORKSPACE_ONBOARDING_STAGES],
  };
}

/** @readonly {string[]} */
export const DEFAULT_RECOMMENDATION_PRIORITY_ORDER = ["critical", "high", "medium", "low"];

export function buildWorkspaceRecommendationPriority(
  priorityOrder = DEFAULT_RECOMMENDATION_PRIORITY_ORDER,
) {
  const recs = getWorkspaceRecommendations();
  const safePriorityOrder = Array.isArray(priorityOrder)
    ? priorityOrder
    : DEFAULT_RECOMMENDATION_PRIORITY_ORDER;

  const ranked = recs.recommendations.map((r, index) => ({
    recommendation_key: r.recommendation_key,
    title: r.title,
    base_priority: r.priority,
    context_priority: r.context_priority,
    rank: index + 1,
    matched_rules: r.matched_rules,
    persona_aligned: r.persona_aligned,
  }));

  const top = ranked[0] ?? null;

  return {
    phase: WORKSPACE_CONTEXT_PHASE,
    ranked_recommendations: ranked,
    top_recommendation: top,
    matched_rule_count: recs.matched_rule_count,
    priority_model:
      "Context boost from WORKSPACE_RECOMMENDATION_RULES overrides base Phase 7A card priority when rules match persona, context state, and onboarding stage.",
    sort_order: [...safePriorityOrder],
  };
}

export function buildWorkspaceHealthContext() {
  const readiness = buildWorkspaceReadinessScore();
  const context = getWorkspaceContext();
  const progress = buildWorkspaceProgressSummary();

  const overlays = WORKSPACE_HEALTH_INDICATORS.map((h) => {
    let context_note = h.narrative;
    if (h.indicator_key === "health_onboarding" && context.context_state_key === "capability_pending") {
      context_note =
        "Capability pending context amplifies onboarding watch — align with open capability requests on My Apps.";
    }
    if (h.indicator_key === "health_credential_readiness") {
      context_note =
        "credential_prepared_placeholder milestone: future planning only — no credentials issued.";
    }
    return {
      ...h,
      context_note,
      context_state: context.context_state_key,
    };
  });

  return {
    phase: WORKSPACE_CONTEXT_PHASE,
    readiness_score: readiness.score,
    readiness_band: readiness.band,
    milestone_progress_percent: progress.progress_percent,
    indicators: overlays,
    total_indicators: overlays.length,
    modeling_note:
      "Health context overlays Phase 7A indicators with Phase 7B context vocabulary — not live monitoring.",
  };
}
