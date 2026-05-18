import DevConsoleLayout, {
  DevConsolePlaceholderCard,
  DevConsoleComingSoon,
} from "../../components/devconsole/DevConsoleLayout";

export default function DevConsoleLogsPage() {
  return (
    <DevConsoleLayout
      title="Logs"
      subtitle="Per-request logs and audit trail for your apps. Live request logging arrives alongside Phase 2 API keys."
    >
      <section
        aria-labelledby="logs-metrics-heading"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
      >
        <h2 id="logs-metrics-heading" className="sr-only">
          Log metrics (placeholder)
        </h2>
        <DevConsolePlaceholderCard
          title="Requests (24h)"
          value="—"
          hint="Total API requests across sandbox + live."
          icon="📋"
        />
        <DevConsolePlaceholderCard
          title="4xx Errors"
          value="—"
          hint="Client-side error volume over the last day."
          icon="⚠️"
        />
        <DevConsolePlaceholderCard
          title="5xx Errors"
          value="—"
          hint="Server-side error volume — should hover near zero."
          icon="🛠️"
        />
      </section>

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6">
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">
          Request log (preview)
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
          Once live, each request will appear here with method, path, status, latency,
          environment, and the key that made the call. Nothing is being captured today.
        </p>
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
          <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-wide text-slate-500">
            <span className="col-span-3">Timestamp</span>
            <span className="col-span-2">Method</span>
            <span className="col-span-4">Path</span>
            <span className="col-span-2">Status</span>
            <span className="col-span-1 text-right">Env</span>
          </div>
          <div className="grid grid-cols-12 items-center px-4 py-6 text-xs text-slate-500 sm:text-sm">
            <span className="col-span-12 text-center">
              No request logs yet — the Tropicash API has not started accepting
              developer traffic.
            </span>
          </div>
        </div>
      </section>

      <DevConsoleComingSoon
        heading="Per-request logs are coming"
        description="In Phase 2 you'll see every API call your apps make, with filtering by environment, status code, and time range."
      />
    </DevConsoleLayout>
  );
}
