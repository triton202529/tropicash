import Link from "next/link";
import AdminGovernanceNavCard from "../../components/devconsole/AdminGovernanceNavCard";
import DevConsoleLayout, {
  DevConsolePlaceholderCard,
  DevConsoleComingSoon,
} from "../../components/devconsole/DevConsoleLayout";

export default function DevConsoleOverviewPage() {
  return (
    <DevConsoleLayout
      title="Overview"
      subtitle="A snapshot of your future Tropicash developer infrastructure. None of these metrics are live yet."
    >
      <AdminGovernanceNavCard />

      <section
        className="tropicash-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="workspace-entry-heading"
      >
        <h2 id="workspace-entry-heading" className="text-lg font-bold text-slate-900">
          Developer workspace
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Phase 7A + 7B — identity, persona context, milestones, smart recommendations, environment posture, and
          readiness from static seeds. Sandbox-first; no live API or credentials on this page.
        </p>
        <Link
          href="/dev-console/workspace"
          className="mt-4 inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm hover:bg-emerald-100"
        >
          🏠 Open Workspace
        </Link>
      </section>

      <section
        aria-labelledby="overview-metrics-heading"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4"
      >
        <h2 id="overview-metrics-heading" className="sr-only">
          Infrastructure metrics (placeholder)
        </h2>
        <DevConsolePlaceholderCard
          title="API Requests Today"
          value="—"
          hint="Once live, request volume across sandbox + live will show here."
          icon="📈"
        />
        <DevConsolePlaceholderCard
          title="Active Webhooks"
          value="—"
          hint="Configured webhook endpoints across your apps."
          icon="🔔"
        />
        <DevConsolePlaceholderCard
          title="Sandbox Apps"
          value="—"
          hint="Sandbox apps registered against your developer account."
          icon="🧪"
        />
        <DevConsolePlaceholderCard
          title="Environment Status"
          value="Dev"
          hint="Tropicash Developer Infrastructure is in active development."
          icon="🛠️"
        />
      </section>

      <DevConsoleComingSoon
        heading="The console is being built"
        description="API key issuance, app registration, request logs, and webhook management will land in Phase 2. Use the public Developer Portal to follow progress and submit feedback in the meantime."
      />
    </DevConsoleLayout>
  );
}
