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
