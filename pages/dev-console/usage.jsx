import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import { fetchApiCredentials } from "../../lib/developerCredentials";
import { getDeveloperApiUsageSummary } from "../../lib/developerApiUsage";
import {
  DEVELOPER_RATE_LIMITS,
  getDeveloperRateLimit,
} from "../../lib/developerRateLimits";

const RANGE_OPTIONS = [
  { value: 1, label: "Today" },
  { value: 7, label: "7 Days" },
  { value: 30, label: "30 Days" },
];

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

function statusBadge(statusCode) {
  const code = Number(statusCode);
  let cls = "border-slate-200 bg-slate-50 text-slate-700";
  if (Number.isFinite(code)) {
    if (code >= 200 && code < 300) cls = "border-emerald-200 bg-emerald-50 text-emerald-900";
    else if (code === 429) cls = "border-amber-200 bg-amber-50 text-amber-950";
    else if (code >= 400 && code < 500) cls = "border-red-200 bg-red-50 text-red-900";
    else if (code >= 500) cls = "border-red-200 bg-red-50 text-red-900";
  }
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {Number.isFinite(code) ? code : "—"}
    </span>
  );
}

function UsageCard({ title, value, hint, icon }) {
  return (
    <article className="tropicash-surface flex flex-col rounded-2xl p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        {icon ? (
          <span aria-hidden className="text-lg leading-none">
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {value ?? "—"}
      </p>
      {hint ? <p className="mt-2 text-xs leading-relaxed text-slate-500 sm:text-sm">{hint}</p> : null}
    </article>
  );
}

export default function DevConsoleUsagePage() {
  const { user, loading: authLoading } = useUser();
  const userId = user?.id ?? null;

  const [rangeDays, setRangeDays] = useState(1);
  const [summary, setSummary] = useState(null);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    if (!userId) {
      setSummary(null);
      setCredentials([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    const [sRes, cRes] = await Promise.all([
      getDeveloperApiUsageSummary(userId, { rangeDays, recentLimit: 50 }),
      fetchApiCredentials(userId),
    ]);
    const parts = [];
    if (sRes.error) parts.push(sRes.error.message || "Could not load usage summary.");
    if (cRes.error) parts.push(cRes.error.message || "Could not load credentials.");
    setLoadError(parts.join(" "));
    setSummary(sRes.error ? null : sRes.data);
    setCredentials(cRes.error ? [] : cRes.data || []);
    setLoading(false);
  }, [userId, rangeDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeKeysCount = useMemo(
    () => (credentials || []).filter((c) => c.status === "active").length,
    [credentials],
  );

  const sandboxLimit = getDeveloperRateLimit("sandbox");
  const recent = summary?.recent || [];

  if (authLoading) {
    return (
      <DevConsoleLayout title="API Usage" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout title="API Usage" subtitle="Sign in to view your API usage.">
        <p className="text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-tropicash-green-hover underline">
            Go to login
          </Link>
        </p>
      </DevConsoleLayout>
    );
  }

  return (
    <DevConsoleLayout
      title="API Usage"
      subtitle="Request volume, rate limits, and recent activity across your sandbox API credentials."
    >
      {/* Rate limit info */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="limits-heading">
        <h2 id="limits-heading" className="text-lg font-bold text-slate-900">
          Sandbox rate limits
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
            {sandboxLimit.perHour} requests / hour
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
            {sandboxLimit.perDay} requests / day
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
            Production — reserved
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Exceeding a limit returns <code className="rounded bg-slate-100 px-1">HTTP 429</code>. Only
          authenticated requests count toward limits.{" "}
          {DEVELOPER_RATE_LIMITS.production.reserved
            ? "Production limits will be enabled in a future release."
            : null}
        </p>
      </section>

      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}{" "}
          <span className="text-slate-600">
            Run{" "}
            <code className="rounded bg-slate-100 px-1">
              supabase/sql/developer_api_usage_logs_phase12c.sql
            </code>{" "}
            if the usage log table is missing.
          </span>
        </p>
      ) : null}

      {/* Usage summary cards */}
      <section aria-labelledby="summary-heading" className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        <h2 id="summary-heading" className="sr-only">
          Usage summary
        </h2>
        <UsageCard
          title="Requests Today"
          value={loading ? "…" : summary?.requestsToday ?? 0}
          hint="Authenticated requests since midnight."
          icon="📈"
        />
        <UsageCard
          title="Requests This Hour"
          value={loading ? "…" : summary?.requestsThisHour ?? 0}
          hint={`Limit: ${sandboxLimit.perHour} / hour.`}
          icon="⏱️"
        />
        <UsageCard
          title="Active Keys"
          value={loading ? "…" : activeKeysCount}
          hint="Sandbox credentials currently active."
          icon="🔑"
        />
        <UsageCard
          title="Last Request"
          value={loading ? "…" : summary?.lastRequestAt ? formatWhen(summary.lastRequestAt) : "—"}
          hint="Most recent logged API request."
          icon="🕒"
        />
      </section>

      {/* Recent requests */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="recent-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="recent-heading" className="text-lg font-bold text-slate-900">
            Recent requests
          </h2>
          <div className="flex items-center gap-2" role="group" aria-label="Usage range filter">
            {RANGE_OPTIONS.map((opt) => {
              const active = rangeDays === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRangeDays(opt.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                  }`}
                  aria-pressed={active}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading…</p>
        ) : recent.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">Time</th>
                  <th className="pb-2 pr-3 font-semibold">Endpoint</th>
                  <th className="pb-2 pr-3 font-semibold">Method</th>
                  <th className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 text-slate-500">{formatWhen(row.created_at)}</td>
                    <td className="py-2 pr-3">
                      <code className="text-xs text-slate-800">{row.endpoint}</code>
                    </td>
                    <td className="py-2 pr-3 font-medium text-slate-700">{row.method}</td>
                    <td className="py-2">{statusBadge(row.status_code)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No API requests in this range yet. Authenticate against{" "}
            <code className="rounded bg-slate-100 px-1">/api/developer/ping</code> with a sandbox key
            to generate usage.
          </p>
        )}
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/dev-console/credentials" className="font-semibold text-tropicash-green-hover underline">
          API Credentials
        </Link>
        {" · "}
        <Link href="/dev-console/my-apps" className="font-semibold text-tropicash-green-hover underline">
          My Apps
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
