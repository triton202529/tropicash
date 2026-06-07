import Link from "next/link";
import AdminGovernanceNavCard from "../../components/devconsole/AdminGovernanceNavCard";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";

const DEVELOPER_TOOLS = [
  {
    href: "/dev-console/credentials",
    label: "API Credentials",
    icon: "🔑",
    description: "Generate, rotate, and revoke sandbox API keys.",
  },
  {
    href: "/dev-console/usage",
    label: "API Usage",
    icon: "📈",
    description: "Request volume, recent activity, and rate limits.",
  },
  {
    href: "/dev-console/webhooks",
    label: "Webhooks",
    icon: "🔔",
    description: "Register endpoints and send signed test deliveries.",
  },
  {
    href: "/dev-console/events",
    label: "Event Registry",
    icon: "📚",
    description: "Available and planned platform events.",
  },
  {
    href: "/dev-console/sdk",
    label: "SDK",
    icon: "📦",
    description: "Official SDK foundation and usage examples.",
  },
  {
    href: "/dev-console/wallet-api-readiness",
    label: "Wallet API Readiness",
    icon: "🧪",
    description: "Security, scope, and rollout blueprint.",
  },
];

const PLATFORM_FEATURES = [
  "API Credentials",
  "API Authentication",
  "Usage Analytics",
  "Webhooks",
  "Event Registry",
  "SDK Foundation",
];

function StatusRow({ label, value, tone }) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700"
      : tone === "off"
        ? "text-slate-500"
        : "text-slate-900";
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-b-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={`text-sm font-semibold ${toneClass}`}>{value}</dd>
    </div>
  );
}

export default function DevConsoleOverviewPage() {
  return (
    <DevConsoleLayout
      title="Overview"
      subtitle="The Tropicash Developer Platform is now available in Sandbox. Production remains disabled."
    >
      <AdminGovernanceNavCard />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Availability + features */}
        <section
          className="tropicash-surface rounded-2xl p-5 sm:p-6 lg:col-span-2"
          aria-labelledby="platform-available-heading"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-emerald-800">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            Sandbox available
          </span>
          <h2 id="platform-available-heading" className="mt-3 text-lg font-bold text-slate-900">
            Tropicash Developer Platform is live in Sandbox
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Approved developers can issue credentials and call the first read-only APIs today. Every
            request is authenticated, rate-limited, and logged. Production access is disabled and will
            open in a future release.
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PLATFORM_FEATURES.map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-slate-700">
                <span aria-hidden className="text-emerald-600">
                  ✓
                </span>
                {feature}
              </li>
            ))}
          </ul>
        </section>

        {/* Platform status card */}
        <section
          className="tropicash-surface rounded-2xl p-5 sm:p-6"
          aria-labelledby="platform-status-heading"
        >
          <h2 id="platform-status-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Developer Platform Status
          </h2>
          <dl className="mt-3">
            <StatusRow label="Environment" value="Sandbox" />
            <StatusRow label="Status" value="Operational" tone="ok" />
            <StatusRow label="Production" value="Disabled" tone="off" />
            <StatusRow label="Version" value="v1" />
          </dl>
          <p className="mt-3 text-xs text-slate-400">
            Consistent with GET /api/developer/platform-status.
          </p>
        </section>
      </div>

      {/* Developer Tools quick access */}
      <section aria-labelledby="developer-tools-heading">
        <h2 id="developer-tools-heading" className="text-lg font-bold text-slate-900">
          Developer Tools
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Jump straight to the tools you use most.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {DEVELOPER_TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="tropicash-surface group flex flex-col rounded-2xl p-5 transition hover:border-slate-300 hover:shadow-md"
            >
              <span aria-hidden className="text-2xl leading-none">
                {tool.icon}
              </span>
              <span className="mt-3 font-semibold text-slate-900 group-hover:text-slate-950">
                {tool.label}
              </span>
              <span className="mt-1 text-sm text-slate-600">{tool.description}</span>
            </Link>
          ))}
        </div>
      </section>
    </DevConsoleLayout>
  );
}
