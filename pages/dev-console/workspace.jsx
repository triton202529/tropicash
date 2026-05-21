import Link from "next/link";
import { useMemo } from "react";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  DEVELOPER_TIERS,
  DEVELOPER_WORKSPACE_PHASE,
  WORKSPACE_ENVIRONMENT_MODES,
  WORKSPACE_ONBOARDING_STAGES,
  WORKSPACE_SAFETY_RULES,
  buildWorkspaceReadinessScore,
  buildWorkspaceSummary,
  getWorkspaceEnvironmentMeta,
  getWorkspaceHealth,
  getWorkspaceOverview,
  getWorkspaceRecommendations as getBaseWorkspaceRecommendations,
  getWorkspaceTimeline,
} from "../../lib/developerWorkspaceConfig";
import {
  DEVELOPER_PERSONA_TYPES,
  WORKSPACE_CONTEXT_PHASE,
  WORKSPACE_CONTEXT_SAFETY_RULES,
  WORKSPACE_CONTEXT_STATES,
  WORKSPACE_ENVIRONMENT_PREFERENCES,
  buildWorkspaceContextSummary,
  buildWorkspaceHealthContext,
  buildWorkspaceProgressSummary,
  buildWorkspaceRecommendationPriority,
  getDeveloperPersona,
  getWorkspaceActivityFeed,
  getWorkspaceContext,
  getWorkspaceEnvironmentPreference,
  getWorkspaceNotices,
  getWorkspaceRecommendations as getSmartWorkspaceRecommendations,
} from "../../lib/developerWorkspaceContextConfig";

const sectionClass = "tropicash-surface rounded-2xl p-5 sm:p-6";
const titleClass = "text-lg font-bold text-slate-900";
const subClass = "mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]";

function Pill({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-700 ${className}`}
    >
      {children}
    </span>
  );
}

function checkpointTint(status) {
  const map = {
    completed: "border-emerald-200 bg-emerald-50 text-emerald-900",
    current: "border-sky-200 bg-sky-50 text-sky-900",
    pending: "border-slate-200 bg-slate-50 text-slate-600",
  };
  return map[status] || map.pending;
}

function healthTint(status) {
  const map = {
    healthy: "border-emerald-200 bg-emerald-50 text-emerald-900",
    watch: "border-amber-200 bg-amber-50 text-amber-950",
    attention: "border-orange-200 bg-orange-50 text-orange-950",
    blocked: "border-rose-200 bg-rose-50 text-rose-950",
  };
  return map[status] || map.watch;
}

function noticeTint(severity) {
  const map = {
    info: "border-sky-200 bg-sky-50 text-sky-950",
    caution: "border-amber-200 bg-amber-50 text-amber-950",
    restricted: "border-violet-200 bg-violet-50 text-violet-950",
  };
  return map[severity] || map.info;
}

function priorityTint(priority) {
  const map = {
    high: "border-rose-200 bg-rose-50 text-rose-900",
    medium: "border-amber-200 bg-amber-50 text-amber-950",
    low: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return map[priority] || map.medium;
}

function readinessBandTint(band) {
  const map = {
    strong: "border-emerald-300 bg-emerald-100 text-emerald-950",
    progressing: "border-sky-200 bg-sky-50 text-sky-900",
    developing: "border-amber-200 bg-amber-50 text-amber-950",
    forming: "border-slate-200 bg-slate-100 text-slate-700",
  };
  return map[band] || map.forming;
}

function milestoneTint(status) {
  const map = {
    completed: "border-emerald-200 bg-emerald-50 text-emerald-900",
    current: "border-sky-200 bg-sky-50 text-sky-900",
    pending: "border-slate-200 bg-slate-50 text-slate-600",
    placeholder: "border-violet-200 bg-violet-50 text-violet-950",
  };
  return map[status] || map.pending;
}

function importanceTint(importance) {
  const map = {
    high: "border-rose-200 bg-rose-50 text-rose-900",
    medium: "border-amber-200 bg-amber-50 text-amber-950",
    low: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return map[importance] || map.medium;
}

function StatCard({ label, value, mono }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2">
      <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={`mt-1 text-sm font-semibold text-slate-900 ${mono ? "break-all font-mono text-xs" : "break-words"}`}
      >
        {value}
      </dd>
    </div>
  );
}

export default function DevConsoleWorkspacePage() {
  const overview = useMemo(() => getWorkspaceOverview(), []);
  const summary = useMemo(() => buildWorkspaceSummary(), []);
  const readiness = useMemo(() => buildWorkspaceReadinessScore(), []);
  const health = useMemo(() => getWorkspaceHealth(), []);
  const timeline = useMemo(() => getWorkspaceTimeline(), []);
  const environment = useMemo(() => getWorkspaceEnvironmentMeta(), []);
  const recommendations = useMemo(() => getBaseWorkspaceRecommendations(), []);
  const persona = useMemo(() => getDeveloperPersona(), []);
  const context = useMemo(() => getWorkspaceContext(), []);
  const contextSummary = useMemo(() => buildWorkspaceContextSummary(), []);
  const envPreference = useMemo(() => getWorkspaceEnvironmentPreference(), []);
  const activityFeed = useMemo(() => getWorkspaceActivityFeed(), []);
  const contextNotices = useMemo(() => getWorkspaceNotices(), []);
  const smartRecommendations = useMemo(() => getSmartWorkspaceRecommendations(), []);
  const milestoneProgress = useMemo(() => buildWorkspaceProgressSummary(), []);
  const recommendationPriority = useMemo(() => buildWorkspaceRecommendationPriority(), []);
  const healthContext = useMemo(() => buildWorkspaceHealthContext(), []);
  const org = overview.organization_summary;

  return (
    <DevConsoleLayout
      title="Workspace"
      subtitle="Phase 7A + 7B — developer operating center with identity, personalization context, onboarding, environment posture, and readiness. Static seeds only; no live API, credentials, or Supabase writes."
    >
      <section
        className="relative overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-6 sm:p-8"
        aria-labelledby="workspace-hero"
      >
        <h2 id="workspace-hero" className="sr-only">
          Workspace hero
        </h2>
        <div className="flex flex-wrap items-start gap-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm ring-1 ring-emerald-100"
            aria-hidden
          >
            🏠
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-800/80">
              Your Tropicash Developer Operating Center
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {overview.display_name}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
              {contextSummary.narrative} {summary.narrative}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Pill className="border-emerald-200 bg-white text-emerald-900">{DEVELOPER_WORKSPACE_PHASE}</Pill>
              <Pill className="border-sky-200 bg-white text-sky-900">{WORKSPACE_CONTEXT_PHASE}</Pill>
              <Pill>{persona.persona.persona_key}</Pill>
              <Pill>{overview.developer_tier}</Pill>
              <Pill>{context.context_state_key}</Pill>
              <Pill>{overview.environment_mode}</Pill>
              <Pill>{overview.onboarding_stage}</Pill>
            </div>
          </div>
        </div>
      </section>

      <div
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        <strong className="font-semibold">Sandbox-first, metadata only.</strong> This page reads{" "}
        <code className="rounded bg-white/80 px-1 text-xs">lib/developerWorkspaceConfig.js</code> and{" "}
        <code className="rounded bg-white/80 px-1 text-xs">lib/developerWorkspaceContextConfig.js</code> only.
        No API keys, live endpoints, workers, webhooks, or money-movement systems are active.
      </div>

      <section className={sectionClass} aria-labelledby="workspace-persona">
        <h2 id="workspace-persona" className={titleClass}>
          Developer Persona
        </h2>
        <p className={subClass}>{persona.tier_note}</p>
        <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/80 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-slate-900">{persona.persona.label}</span>
            <Pill>{persona.persona.maturity_level}</Pill>
            <Pill>{persona.persona.onboarding_priority}</Pill>
          </div>
          <p className="mt-2 text-sm text-slate-700">{persona.persona.description}</p>
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Suggested actions</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {persona.persona.suggested_actions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {DEVELOPER_PERSONA_TYPES.map((p) => (
            <Pill key={p.persona_key} className={p.persona_key === persona.persona.persona_key ? "border-sky-300" : ""}>
              {p.persona_key}
            </Pill>
          ))}
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-context-summary">
        <h2 id="workspace-context-summary" className={titleClass}>
          Workspace Context Summary
        </h2>
        <p className={subClass}>{contextSummary.modeling_note}</p>
        <p className="mt-3 text-sm font-semibold text-slate-900">{contextSummary.headline}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <StatCard label="Persona" value={contextSummary.persona_key} />
          <StatCard label="Context state" value={contextSummary.context_state_key} />
          <StatCard label="Environment preference" value={contextSummary.environment_preference_key} />
        </dl>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {WORKSPACE_CONTEXT_STATES.map((s) => (
            <Pill key={s.state_key}>{s.state_key}</Pill>
          ))}
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-contextual-readiness">
        <h2 id="workspace-contextual-readiness" className={titleClass}>
          Contextual Readiness
        </h2>
        <p className={subClass}>{recommendationPriority.priority_model}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="rounded-xl border border-sky-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase text-slate-500">Milestone progress</p>
            <p className="text-2xl font-bold text-slate-900">{milestoneProgress.progress_percent}%</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase text-slate-500">7A readiness band</p>
            <Pill className={readinessBandTint(healthContext.readiness_band)}>{healthContext.readiness_band}</Pill>
            <p className="mt-1 text-sm text-slate-600">Score {healthContext.readiness_score}/100</p>
          </div>
        </div>
        {recommendationPriority.top_recommendation ? (
          <p className="mt-4 text-sm text-slate-700">
            Top smart recommendation:{" "}
            <strong>{recommendationPriority.top_recommendation.title}</strong> (context{" "}
            {recommendationPriority.top_recommendation.context_priority})
          </p>
        ) : null}
      </section>

      <section className={sectionClass} aria-labelledby="workspace-env-preference">
        <h2 id="workspace-env-preference" className={titleClass}>
          Environment Preference
        </h2>
        <p className={subClass}>
          Preference <strong className="text-slate-800">{envPreference.preference.label}</strong> — anchors to
          environment_mode{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">{envPreference.environment_mode_anchor}</code>
        </p>
        <p className="mt-2 text-sm text-slate-600">{envPreference.preference.description}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {WORKSPACE_ENVIRONMENT_PREFERENCES.map((p) => (
            <li
              key={p.preference_key}
              className={`rounded-xl border p-3 text-sm ${
                p.preference_key === envPreference.preference_key
                  ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                  : "border-slate-200 bg-white/80 text-slate-700"
              }`}
            >
              <span className="font-semibold">{p.label}</span>
              <p className="mt-1 opacity-90">{p.description}</p>
            </li>
          ))}
        </ul>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {contextNotices.notices.slice(0, 4).map((n) => (
            <li key={n.notice_key} className={`rounded-xl border p-4 ${noticeTint(n.severity)}`}>
              <span className="font-semibold">{n.title}</span>
              <p className="mt-2 text-sm opacity-90">{n.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-identity">
        <h2 id="workspace-identity" className={titleClass}>
          2. Identity summary
        </h2>
        <p className={subClass}>Workspace identity fields from static seed — not loaded from auth or Supabase.</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Workspace ID" value={overview.workspace_id} mono />
          <StatCard label="Display name" value={overview.display_name} />
          <StatCard label="Developer tier" value={overview.tier_label} />
          <StatCard label="Onboarding stage" value={overview.onboarding_stage_label} />
          <StatCard label="Environment mode" value={overview.environment_mode_label} />
          <StatCard label="Created (simulated)" value={overview.created_at_simulated} mono />
          <StatCard label="Last activity (simulated)" value={overview.last_activity_simulated} mono />
        </dl>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Vocabulary</span>
          {WORKSPACE_ENVIRONMENT_MODES.map((m) => (
            <Pill key={m}>{m}</Pill>
          ))}
          {DEVELOPER_TIERS.map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-readiness">
        <h2 id="workspace-readiness" className={titleClass}>
          3. Workspace readiness
        </h2>
        <p className={subClass}>{readiness.modeling_note}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-emerald-200 bg-white text-2xl font-bold text-emerald-900"
            aria-label={`Readiness score ${readiness.score} out of ${readiness.max_score}`}
          >
            {readiness.score}
          </div>
          <div>
            <Pill className={readinessBandTint(readiness.band)}>{readiness.band}</Pill>
            <p className="mt-2 text-sm text-slate-600">
              Score {readiness.score}/{readiness.max_score} from checkpoints, health indicators, and onboarding stage
              index.
            </p>
          </div>
        </div>
        <ul className="mt-4 grid gap-3 sm:grid-cols-3">
          {readiness.factors.map((f) => (
            <li key={f.key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{f.key.replace(/_/g, " ")}</p>
              <p className="mt-1 text-lg font-bold text-slate-900">+{f.contribution}</p>
              <p className="mt-1 text-xs text-slate-600">{f.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-onboarding">
        <h2 id="workspace-onboarding" className={titleClass}>
          4. Onboarding timeline
        </h2>
        <p className={subClass}>
          Checkpoints and simulated events — stages: {WORKSPACE_ONBOARDING_STAGES.join(", ")}.
        </p>
        <ol className="mt-4 space-y-3">
          {timeline.checkpoints.map((c) => (
            <li
              key={c.checkpoint_key}
              className="flex gap-3 rounded-xl border border-slate-200 bg-white/80 p-4"
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${checkpointTint(c.status)}`}
                aria-hidden
              >
                {c.sort_order}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{c.label}</span>
                  <Pill className={checkpointTint(c.status)}>{c.status}</Pill>
                  <Pill>{c.stage}</Pill>
                </div>
                <p className="mt-1 text-sm text-slate-600">{c.narrative}</p>
              </div>
            </li>
          ))}
        </ol>
        <h3 className="mt-6 text-sm font-bold text-slate-800">Recent workspace events</h3>
        <ul className="mt-3 space-y-2">
          {[...timeline.events].reverse().slice(0, 6).map((e) => (
            <li
              key={e.event_key}
              className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs text-slate-500">{e.occurred_at_simulated}</span>
              <span className="mx-2 text-slate-300">·</span>
              <span className="font-semibold text-slate-800">{e.event_type}</span>
              <p className="mt-0.5 text-slate-600">{e.summary}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-activity">
        <h2 id="workspace-activity" className={titleClass}>
          Activity Feed
        </h2>
        <p className={subClass}>
          Simulated activity from Phase 7B seeds — {activityFeed.total_activities} events with narrative time labels
          only.
        </p>
        <ul className="mt-4 space-y-3">
          {activityFeed.activities.map((a) => (
            <li key={a.activity_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{a.title}</span>
                <Pill className={importanceTint(a.importance)}>{a.importance}</Pill>
                <Pill>{a.category}</Pill>
                <span className="text-xs text-slate-500">{a.simulated_time_label}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{a.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-environment">
        <h2 id="workspace-environment" className={titleClass}>
          5. Environment state
        </h2>
        <p className={subClass}>
          Mode <strong className="text-slate-800">{environment.environment_mode_label}</strong> — live API{" "}
          {environment.live_api_enabled ? "enabled" : "disabled"}, credentials{" "}
          {environment.credentials_issued ? "issued" : "not issued"} (always false in Phase 7A).
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {environment.notices.map((n) => (
            <li key={n.notice_key} className={`rounded-xl border p-4 ${noticeTint(n.severity)}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{n.title}</span>
                <Pill className="bg-white/60">{n.severity}</Pill>
              </div>
              <p className="mt-2 text-sm opacity-90">{n.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-org">
        <h2 id="workspace-org" className={titleClass}>
          6. Organization &amp; app summary
        </h2>
        <p className={subClass}>Static seed counts — compare with My Apps for live Supabase rows.</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active organizations" value={String(org.active_org_count)} />
          <StatCard label="Sandbox apps" value={String(org.sandbox_apps_count)} />
          <StatCard label="Pending reviews" value={String(org.pending_reviews_count)} />
          <StatCard label="Approved capabilities" value={String(org.approved_capabilities_count)} />
        </dl>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-health">
        <h2 id="workspace-health" className={titleClass}>
          7. Workspace health indicators
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {health.indicators.map((h) => (
            <li key={h.indicator_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{h.label}</span>
                <Pill className={healthTint(h.status)}>{h.status}</Pill>
                <Pill>{h.score_band}</Pill>
              </div>
              <p className="mt-2 text-sm text-slate-600">{h.narrative}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-health-context">
        <h2 id="workspace-health-context" className={titleClass}>
          Workspace Health Context
        </h2>
        <p className={subClass}>{healthContext.modeling_note}</p>
        <p className="mt-2 text-sm text-slate-600">
          Milestone progress {healthContext.milestone_progress_percent}% · readiness {healthContext.readiness_score} (
          {healthContext.readiness_band})
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {healthContext.indicators.map((h) => (
            <li key={h.indicator_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{h.label}</span>
                <Pill className={healthTint(h.status)}>{h.status}</Pill>
                <Pill>{h.context_state}</Pill>
              </div>
              <p className="mt-2 text-sm text-slate-600">{h.context_note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-smart-recommendations">
        <h2 id="workspace-smart-recommendations" className={titleClass}>
          Smart Recommendations
        </h2>
        <p className={subClass}>
          Rule-driven from persona <strong>{smartRecommendations.persona_key}</strong> and context{" "}
          <strong>{smartRecommendations.context_state}</strong> — {smartRecommendations.matched_rule_count} rule(s)
          matched.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {smartRecommendations.recommendations.slice(0, 6).map((r) => (
            <li key={r.recommendation_key} className="rounded-xl border border-sky-200 bg-sky-50/50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Pill className={priorityTint(r.context_priority)}>{r.context_priority}</Pill>
                {r.persona_aligned ? <Pill className="border-sky-300">persona aligned</Pill> : null}
                <span className="font-semibold text-slate-900">{r.title}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{r.summary}</p>
              {r.matched_rules?.length ? (
                <p className="mt-1 text-xs text-slate-500">Rules: {r.matched_rules.join(", ")}</p>
              ) : null}
              <Link
                href={r.related_route}
                className="mt-3 inline-flex text-sm font-semibold text-tropicash-green-hover underline"
              >
                Open related tool →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-milestones">
        <h2 id="workspace-milestones" className={titleClass}>
          Milestone Progress
        </h2>
        <p className={subClass}>{milestoneProgress.credential_placeholder_note}</p>
        <p className="mt-2 text-sm text-slate-600">
          {milestoneProgress.totals.completed} completed · {milestoneProgress.totals.current} current ·{" "}
          {milestoneProgress.totals.pending} pending · {milestoneProgress.totals.placeholder} placeholder
        </p>
        <ol className="mt-4 space-y-3">
          {milestoneProgress.milestones.map((m) => (
            <li
              key={m.milestone_key}
              className="flex gap-3 rounded-xl border border-slate-200 bg-white/80 p-4"
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${milestoneTint(m.status)}`}
                aria-hidden
              >
                {m.sort_order}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-900">{m.label}</span>
                  <Pill className={milestoneTint(m.status)}>{m.status}</Pill>
                </div>
                <p className="mt-1 text-sm text-slate-600">{m.narrative}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-recommendations">
        <h2 id="workspace-recommendations" className={titleClass}>
          8. Recommendations (Phase 7A)
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {recommendations.recommendations.map((r) => (
            <li key={r.recommendation_key} className="rounded-xl border border-slate-200 bg-white/80 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Pill className={priorityTint(r.priority)}>{r.priority}</Pill>
                <span className="font-semibold text-slate-900">{r.title}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{r.summary}</p>
              <p className="mt-2 text-xs text-slate-500">{r.action_hint}</p>
              <Link
                href={r.related_route}
                className="mt-3 inline-flex text-sm font-semibold text-tropicash-green-hover underline"
              >
                Open related tool →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="workspace-safety">
        <h2 id="workspace-safety" className={titleClass}>
          9. Safety &amp; governance notice
        </h2>
        <p className={subClass}>
          Sandbox-first rehearsal. Metadata-only governance transitions. Credentials and live API access arrive in future
          phases — never from this workspace shell alone.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {WORKSPACE_SAFETY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
          {WORKSPACE_CONTEXT_SAFETY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <div
        role="note"
        className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950"
      >
        <strong className="font-semibold">Phase 9A + 9B — Product Access.</strong> Sandbox product entitlement previews
        and metadata-only product governance (visibility rules, review outcomes, usage envelopes) live in{" "}
        <Link href="/dev-console/product-access" className="font-semibold text-teal-900 underline">
          Product Access
        </Link>
        . Workspace readiness seeds inform entitlement history narration — sandbox only, preview only, no endpoints, no
        execution, no live access.
      </div>

      <div
        role="note"
        className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
      >
        <strong className="font-semibold">Phase 10A + 10B — Request Simulator.</strong> End-to-end sandbox request simulation
        with governance and observability vocabulary (metadata only) — credential placeholder → entitlement → auth/gateway/routing
        delegates → response preview — lives in{" "}
        <Link href="/dev-console/request-simulator" className="font-semibold text-sky-900 underline">
          Request Simulator
        </Link>
        . Sandbox request simulation only — no real endpoint execution.
      </div>

      <section className={sectionClass} aria-labelledby="workspace-tools">
        <h2 id="workspace-tools" className={titleClass}>
          10. Related tools
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dev-console"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            📊 Overview
          </Link>
          <Link
            href="/dev-console/my-apps"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            📦 My Apps
          </Link>
          <Link
            href="/dev-console/app-governance"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🛡️ Developer Governance
          </Link>
          <Link
            href="/dev-console/credential-architecture"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🔐 Credential Architecture
          </Link>
          <Link
            href="/dev-console/credential-lifecycle"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🪪 Credential Lifecycle (8A + 8B)
          </Link>
          <Link
            href="/dev-console/auth-simulator"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🛂 Auth Simulator (Phase 5B)
          </Link>
          <Link
            href="/dev-console/gateway-simulator"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🚦 Gateway Simulator (Phase 5C)
          </Link>
          <Link
            href="/dev-console/request-simulator"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            📨 Request Simulator (10A + 10B)
          </Link>
          <Link
            href="/dev-console/runtime-activation"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🔒 Runtime Activation (Phase 6A)
          </Link>
          <Link
            href="/dev-console/product-catalog"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            📚 Product Catalog
          </Link>
          <Link
            href="/dev-console/product-access"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🎫 Product Access (9A + 9B)
          </Link>
          <Link
            href="/dev-console/app-capabilities"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🧬 App Capabilities
          </Link>
          <Link
            href="/dev-console/sandbox-analytics"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            📈 Sandbox Analytics
          </Link>
        </div>
      </section>
    </DevConsoleLayout>
  );
}
