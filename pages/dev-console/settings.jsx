import DevConsoleLayout, {
  DevConsolePlaceholderCard,
  DevConsoleComingSoon,
} from "../../components/devconsole/DevConsoleLayout";

export default function DevConsoleSettingsPage() {
  return (
    <DevConsoleLayout
      title="Settings"
      subtitle="Account, team, and billing configuration for your developer organization. Settings are read-only placeholders today."
    >
      <section
        aria-labelledby="settings-metrics-heading"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
      >
        <h2 id="settings-metrics-heading" className="sr-only">
          Organization metrics (placeholder)
        </h2>
        <DevConsolePlaceholderCard
          title="Organization"
          value="—"
          hint="Your developer organization name."
          icon="🏢"
        />
        <DevConsolePlaceholderCard
          title="Team Members"
          value="—"
          hint="Members with access to this developer console."
          icon="👥"
        />
        <DevConsolePlaceholderCard
          title="Billing Plan"
          value="—"
          hint="Active plan (Sandbox is free during development)."
          icon="💼"
        />
      </section>

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6">
        <h2 className="text-base font-bold text-slate-900 sm:text-lg">
          Planned settings
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-700 sm:text-[0.9375rem]">
          <li>Organization profile and contact details</li>
          <li>Team invitations and member roles</li>
          <li>Billing plan and payment method</li>
          <li>Security: SSO, 2FA enforcement, IP allow-lists</li>
          <li>Compliance contacts and notification preferences</li>
        </ul>
      </section>

      <DevConsoleComingSoon
        heading="Settings will become editable later"
        description="In Phase 2 you'll manage your developer org, invite teammates, and configure security and billing. For now this is a shell."
      />
    </DevConsoleLayout>
  );
}
