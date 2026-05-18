import Link from "next/link";
import AdminGovernanceNavCard from "../../components/devconsole/AdminGovernanceNavCard";
import DevConsoleLayout, {
  DevConsolePlaceholderCard,
  DevConsoleComingSoon,
} from "../../components/devconsole/DevConsoleLayout";

export default function DevConsoleAppsPage() {
  return (
    <DevConsoleLayout
      title="Apps"
      subtitle="Register and manage developer apps that integrate with Tropicash. App-level scopes will gate which APIs each app can call."
    >
      <AdminGovernanceNavCard />

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
        <Link
          href="/dev-console/apps-register"
          className="font-semibold text-emerald-800 underline decoration-emerald-600/40 underline-offset-2 hover:decoration-emerald-700"
        >
          Register Developer App
        </Link>
        <span className="text-slate-600">
          {" "}
          — create a sandbox app record in Supabase. API keys are not issued yet.
        </span>
      </div>

      <section
        aria-labelledby="apps-metrics-heading"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
      >
        <h2 id="apps-metrics-heading" className="sr-only">
          App metrics (placeholder)
        </h2>
        <DevConsolePlaceholderCard
          title="Registered Apps"
          value="—"
          hint="Sandbox and live apps tied to your developer account."
          icon="🧩"
        />
        <DevConsolePlaceholderCard
          title="Sandbox Apps"
          value="—"
          hint="Apps scoped to the isolated sandbox environment."
          icon="🧪"
        />
        <DevConsolePlaceholderCard
          title="Live Apps"
          value="—"
          hint="Apps approved for production traffic (none yet)."
          icon="🚀"
        />
      </section>

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="apps-related-heading">
        <h2 id="apps-related-heading" className="text-lg font-bold text-slate-900">
          Related console pages
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Sandbox app registration and governance metadata are available as Phase 4A–4C shells — still no API keys,
          webhooks, or live HTTP surface.
        </p>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
          <li>
            <Link href="/dev-console/apps-register" className="font-semibold text-emerald-800 underline">
              Register App
            </Link>{" "}
            — create org and sandbox app rows.
          </li>
          <li>
            <Link href="/dev-console/my-apps" className="font-semibold text-emerald-800 underline">
              My Apps
            </Link>{" "}
            — statuses, reviews, lifecycle, capability requests.
          </li>
          <li>
            <Link href="/dev-console/app-capabilities" className="font-semibold text-emerald-800 underline">
              App Capabilities
            </Link>{" "}
            — sandbox capability requests (admin assigns in governance).
          </li>
        </ul>
      </section>

      <DevConsoleComingSoon
        heading="Rich app management is still planned"
        description="Future phases will add redirect URI validation, scoped permissions, team seats, and Blue Atlantic integration wiring. Metrics above stay placeholders until then."
      />
    </DevConsoleLayout>
  );
}
