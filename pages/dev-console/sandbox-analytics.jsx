import Link from "next/link";
import { useMemo, useState } from "react";

import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { getProductByKey } from "../../lib/developerProductCatalogConfig";
import {
  DEVELOPER_SANDBOX_ANALYTICS_PHASE,
  SANDBOX_ANALYTICS_SAFETY_RULES,
  SANDBOX_HEALTH_GRADES,
  SANDBOX_RATE_LIMIT_PRESSURE_LEVELS,
  SANDBOX_REVIEW_PRESSURE_LEVELS,
  SANDBOX_USAGE_STATUSES,
  buildCapabilityUtilizationSummary,
  buildDeveloperAnalyticsDashboardSummary,
  buildRateLimitPressureSummary,
  buildSandboxHealthSummary,
  buildSandboxUsageSummary,
  getCapabilityUtilizationForApp,
  getRateLimitSimulationForApp,
  getSandboxHealthForApp,
  getSandboxUsageForApp,
} from "../../lib/developerSandboxAnalyticsConfig";

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

function pressureTint(level) {
  const map = {
    low: "border-emerald-200 bg-emerald-50 text-emerald-950",
    medium: "border-amber-200 bg-amber-50 text-amber-950",
    high: "border-orange-200 bg-orange-50 text-orange-950",
    exceeded: "border-rose-200 bg-rose-50 text-rose-950",
    none: "border-slate-200 bg-slate-50 text-slate-800",
    critical: "border-red-200 bg-red-50 text-red-950",
  };
  return map[level] || map.medium;
}

function usageStatusTint(status) {
  const map = {
    healthy: "border-emerald-200 bg-emerald-50 text-emerald-950",
    review_heavy: "border-amber-200 bg-amber-50 text-amber-950",
    throttled: "border-orange-200 bg-orange-50 text-orange-950",
    constrained: "border-rose-200 bg-rose-50 text-rose-950",
    inactive: "border-slate-200 bg-slate-100 text-slate-700",
  };
  return map[status] || map.inactive;
}

export default function DevConsoleSandboxAnalyticsPage() {
  const usageSummary = useMemo(() => buildSandboxUsageSummary(), []);
  const healthSummary = useMemo(() => buildSandboxHealthSummary(), []);
  const capSummary = useMemo(() => buildCapabilityUtilizationSummary(), []);
  const rateSummary = useMemo(() => buildRateLimitPressureSummary(), []);
  const dashboard = useMemo(() => buildDeveloperAnalyticsDashboardSummary(), []);

  const appOptions = usageSummary.app_labels;
  const [selectedApp, setSelectedApp] = useState("");

  const usageRows = useMemo(() => {
    if (!selectedApp) return getSandboxUsageForApp(appOptions[0] ?? "");
    return getSandboxUsageForApp(selectedApp);
  }, [selectedApp, appOptions]);

  const activeAppLabel = selectedApp || appOptions[0] || "";
  const health = getSandboxHealthForApp(activeAppLabel);
  const capRows = getCapabilityUtilizationForApp(activeAppLabel);
  const rateRows = getRateLimitSimulationForApp(activeAppLabel);

  return (
    <DevConsoleLayout
      title="Sandbox Analytics"
      subtitle="Phase 4E static simulation — usage, health, capability utilization, and rate-limit pressure narratives. No telemetry, quotas, or live traffic."
    >
      {/* Section 1 — Overview */}
      <section className={sectionClass} aria-labelledby="sbx-analytics-s1">
        <h2 id="sbx-analytics-s1" className={titleClass}>
          1. Modeling scope &amp; phase
        </h2>
        <p className={subClass}>
          This page reads{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">lib/developerSandboxAnalyticsConfig.js</code>{" "}
          only. Numbers are seeded for console storytelling; they are not computed from requests.
        </p>
        <p className="mt-3">
          <Pill>{DEVELOPER_SANDBOX_ANALYTICS_PHASE}</Pill>
        </p>
        <p className="mt-4 text-sm text-slate-600">
          <strong className="font-semibold text-slate-800">Catalog alignment:</strong>{" "}
          <Link href="/dev-console/product-catalog" className="font-semibold text-emerald-700 underline">
            Product Catalog
          </Link>{" "}
          (Phase 4D) — cross-check <code className="text-xs">product_key</code> /{" "}
          <code className="text-xs">contract_key</code> / Phase 2C{" "}
          <code className="text-xs">capability_key</code> values. For a deterministic auth-stage walk on the same keys, open{" "}
          <Link href="/dev-console/auth-simulator" className="font-semibold text-emerald-700 underline">
            Auth Simulator
          </Link>{" "}
          (Phase 5B — verification modeling only). For rehearsal request envelopes layered on identical keys plus
          illustrative gateway routing previews, delegated trace joins, observability placeholders, and audit rehearsal
          fields, continue to{" "}
          <Link href="/dev-console/gateway-simulator" className="font-semibold text-emerald-700 underline">
            Gateway Simulator (Phase 5C)
          </Link>{" "}
          — consoles only; seeded analytics counters stay decoupled from any HTTP edge narrative. For post-gateway
          delegate narration on the same keys, continue to{" "}
          <Link href="/dev-console/execution-routing" className="font-semibold text-emerald-700 underline">
            Execution Routing (Phase 5D)
          </Link>{" "}
          — simulation only; no workers or live routing.
        </p>
      </section>

      <div
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        <strong className="font-semibold">Simulation only.</strong> No Supabase queries, HTTP calls, or
        wall-clock sampling power this view.
      </div>

      {/* Section 2 — Vocabulary */}
      <section className={sectionClass} aria-labelledby="sbx-analytics-s2">
        <h2 id="sbx-analytics-s2" className={titleClass}>
          2. Vocabulary
        </h2>
        <p className={subClass}>
          Enumerations used across seeds and summary helpers (labels are not enforced at runtime).
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Usage status</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SANDBOX_USAGE_STATUSES.map((s) => (
                <Pill key={s}>{s}</Pill>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Health grades</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SANDBOX_HEALTH_GRADES.map((g) => (
                <Pill key={g}>{g}</Pill>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Rate-limit pressure</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SANDBOX_RATE_LIMIT_PRESSURE_LEVELS.map((p) => (
                <Pill key={p} className={pressureTint(p)}>
                  {p}
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">Review pressure</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SANDBOX_REVIEW_PRESSURE_LEVELS.map((p) => (
                <Pill key={p} className={pressureTint(p)}>
                  {p}
                </Pill>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 3 — App selector + usage */}
      <section className={sectionClass} aria-labelledby="sbx-analytics-s3">
        <h2 id="sbx-analytics-s3" className={titleClass}>
          3. Simulated usage (per app)
        </h2>
        <p className={subClass}>
          Choose an app label to filter usage rows. Counts are static; success + review + throttle + error
          may not reconcile to call totals by design in teaching data.
        </p>
        <div className="mt-4">
          <label htmlFor="sandbox-app-select" className="mb-1 block text-sm font-semibold text-slate-700">
            App label
          </label>
          <select
            id="sandbox-app-select"
            className="w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2 sm:w-72"
            value={selectedApp || appOptions[0] || ""}
            onChange={(e) => setSelectedApp(e.target.value)}
          >
            {appOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3 font-semibold">Simulation</th>
                <th className="pb-2 pr-3 font-semibold">Product</th>
                <th className="pb-2 pr-3 font-semibold">Contract</th>
                <th className="pb-2 pr-3 font-semibold">Capability</th>
                <th className="pb-2 pr-3 font-semibold">Calls</th>
                <th className="pb-2 pr-3 font-semibold">Outcome mix</th>
                <th className="pb-2 pr-3 font-semibold">Pressures</th>
                <th className="pb-2 pr-3 font-semibold">Window</th>
                <th className="pb-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {usageRows.map((row) => {
                const product = getProductByKey(row.product_key);
                return (
                  <tr key={row.simulation_key} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 align-top">
                      <div className="font-medium text-slate-900">{row.app_label}</div>
                      <code className="text-xs text-slate-500">{row.simulation_key}</code>
                    </td>
                    <td className="py-2 pr-3 align-top text-xs">
                      <span className="font-medium text-slate-800">{product?.title ?? row.product_key}</span>
                      <div>
                        <code className="text-[0.65rem] text-slate-500">{row.product_key}</code>
                      </div>
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <code className="text-xs text-slate-700">{row.contract_key}</code>
                    </td>
                    <td className="py-2 pr-3 align-top">
                      <code className="text-xs text-slate-700">{row.capability_key}</code>
                    </td>
                    <td className="py-2 pr-3 align-top text-slate-700">{row.simulated_call_count}</td>
                    <td className="py-2 pr-3 align-top text-xs text-slate-600">
                      ok {row.simulated_success_count} · rev {row.simulated_review_count} · thr{" "}
                      {row.simulated_throttle_count} · err {row.simulated_error_count}
                    </td>
                    <td className="py-2 pr-3 align-top text-xs">
                      <span className="mr-1">
                        <Pill className={usageStatusTint(row.usage_status)}>{row.usage_status}</Pill>
                      </span>
                      <Pill className={pressureTint(row.review_pressure)}>rev:{row.review_pressure}</Pill>{" "}
                      <Pill className={pressureTint(row.rate_limit_pressure)}>
                        rl:{row.rate_limit_pressure}
                      </Pill>
                    </td>
                    <td className="py-2 pr-3 align-top text-xs text-slate-600">{row.simulated_window}</td>
                    <td className="py-2 align-top text-xs text-slate-600">{row.notes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Section 4 — Health */}
      <section className={sectionClass} aria-labelledby="sbx-analytics-s4">
        <h2 id="sbx-analytics-s4" className={titleClass}>
          4. App health grades
        </h2>
        <p className={subClass}>
          Per-app grades for the selected label ({activeAppLabel}). Summaries below aggregate all seeded
          apps.
        </p>
        {health ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Governance compliance", health.governance_compliance_grade],
              ["Sandbox stability", health.sandbox_stability_grade],
              ["Capability risk", health.capability_risk_grade],
              ["Review load", health.review_load_grade],
              ["Overall", health.overall_health_grade],
            ].map(([label, grade]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white/80 p-4">
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </p>
                <p className="mt-1 text-lg font-bold capitalize text-slate-900">{grade}</p>
              </div>
            ))}
            <div className="rounded-xl border border-slate-200 bg-white/80 p-4 sm:col-span-2 lg:col-span-3">
              <p className="text-sm font-semibold text-slate-900">{health.summary}</p>
              <p className="mt-2 text-sm text-slate-600">
                <strong className="text-slate-800">Recommended:</strong> {health.recommended_next_step}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No health seed for this label.</p>
        )}

        <h3 className="mt-8 text-sm font-bold text-slate-800">Health summary (all apps)</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Apps seeded: {healthSummary.total_apps}</li>
          <li>Blocked (overall): {healthSummary.blocked_app_count}</li>
          <li>Flagged needs_review (overall or review load): {healthSummary.apps_flagged_needs_review}</li>
        </ul>
      </section>

      {/* Section 5 — Capability utilization */}
      <section className={sectionClass} aria-labelledby="sbx-analytics-s5">
        <h2 id="sbx-analytics-s5" className={titleClass}>
          5. Capability utilization
        </h2>
        <p className={subClass}>
          Orthogonal to usage rows — expresses how heavily each capability is narrated for the selected
          app.
        </p>
        <ul className="mt-4 space-y-3">
          {capRows.map((r) => (
            <li key={`${r.app_label}-${r.capability_key}`} className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <code className="text-sm font-semibold text-slate-900">{r.capability_key}</code>
                <span className="text-xs text-slate-500">
                  {r.usage_level} · risk {r.risk_level} · review {r.review_pressure}
                </span>
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Products: {r.related_products.join(", ")} · Contracts: {r.related_contracts.join(", ")}
              </p>
              <p className="mt-1 text-xs text-slate-500">{r.notes}</p>
            </li>
          ))}
        </ul>
        <h3 className="mt-8 text-sm font-bold text-slate-800">Utilization summary (all rows)</h3>
        <p className="mt-1 text-sm text-slate-600">
          Distinct capabilities: {capSummary.distinct_capability_keys} · Rows:{" "}
          {capSummary.total_utilization_rows}
        </p>
      </section>

      {/* Section 6 — Rate limits */}
      <section className={sectionClass} aria-labelledby="sbx-analytics-s6">
        <h2 id="sbx-analytics-s6" className={titleClass}>
          6. Rate-limit simulation
        </h2>
        <p className={subClass}>
          Tier strings match the Phase 4D catalog vocabulary. Remaining tokens are illustrative.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3 font-semibold">Tier</th>
                <th className="pb-2 pr-3 font-semibold">Limit / used / remaining</th>
                <th className="pb-2 pr-3 font-semibold">Pressure</th>
                <th className="pb-2 font-semibold">Reset</th>
              </tr>
            </thead>
            <tbody>
              {rateRows.map((r, i) => (
                <tr key={`${r.app_label}-${r.rate_limit_tier}-${i}`} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 align-top font-mono text-xs">{r.rate_limit_tier}</td>
                  <td className="py-2 pr-3 align-top text-slate-700">
                    {r.simulated_limit} / {r.simulated_used} / {r.simulated_remaining}
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <Pill className={pressureTint(r.pressure_level)}>{r.pressure_level}</Pill>
                  </td>
                  <td className="py-2 align-top text-xs text-slate-600">{r.reset_window}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rateRows[0]?.notes ? (
          <p className="mt-3 text-xs text-slate-600">{rateRows[0].notes}</p>
        ) : null}
        <h3 className="mt-8 text-sm font-bold text-slate-800">Rate-limit aggregates (all rows)</h3>
        <p className="mt-1 text-sm text-slate-600">
          Σ limits {rateSummary.aggregate_simulated_limits} · Σ used {rateSummary.aggregate_simulated_used}{" "}
          · Σ remaining {rateSummary.aggregate_simulated_remaining}
        </p>
      </section>

      {/* Section 7 — Dashboard umbrella */}
      <section className={sectionClass} aria-labelledby="sbx-analytics-s7">
        <h2 id="sbx-analytics-s7" className={titleClass}>
          7. Dashboard composite
        </h2>
        <p className={subClass}>
          <code className="rounded bg-slate-100 px-1 text-xs">buildDeveloperAnalyticsDashboardSummary()</code>{" "}
          composes usage, health, utilization, and rate-limit summaries for embedding in future layouts.
        </p>
        <p className="mt-2 text-sm text-slate-600">{dashboard.modeling_note}</p>
        <pre className="mt-4 max-h-80 overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-[0.7rem] leading-relaxed text-slate-100 sm:text-xs">
          <code>{JSON.stringify(dashboard, null, 2)}</code>
        </pre>
      </section>

      {/* Safety */}
      <section
        className="rounded-2xl border border-rose-200 bg-rose-50 p-5 sm:p-6"
        aria-labelledby="sbx-analytics-safety"
      >
        <h2 id="sbx-analytics-safety" className="text-base font-bold text-rose-950 sm:text-lg">
          Safety notice — Phase 4E sandbox analytics
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-rose-950 sm:text-[0.9375rem]">
          {SANDBOX_ANALYTICS_SAFETY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/dev-console/product-catalog" className="font-semibold text-emerald-700 underline">
          Product Catalog
        </Link>
        {" · "}
        <Link href="/dev-console/app-capabilities" className="font-semibold text-emerald-700 underline">
          App Capabilities
        </Link>
        {" · "}
        <Link href="/dev-console/sandbox" className="font-semibold text-emerald-700 underline">
          Sandbox
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
