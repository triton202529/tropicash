import DevConsoleLayout, {
  DevConsolePlaceholderCard,
  DevConsoleComingSoon,
} from "../../components/devconsole/DevConsoleLayout";

export default function DevConsoleApiKeysPage() {
  return (
    <DevConsoleLayout
      title="API Keys"
      subtitle="Sandbox and live API keys are isolated. Live keys will only be issued after a manual review."
    >
      <section
        aria-labelledby="api-keys-metrics-heading"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
      >
        <h2 id="api-keys-metrics-heading" className="sr-only">
          API key metrics (placeholder)
        </h2>
        <DevConsolePlaceholderCard
          title="Sandbox Keys"
          value="—"
          hint="Sandbox-only keys for development and testing."
          icon="🧪"
        />
        <DevConsolePlaceholderCard
          title="Live Keys"
          value="—"
          hint="Production keys (issued only after review)."
          icon="🔐"
        />
        <DevConsolePlaceholderCard
          title="Last Rotation"
          value="—"
          hint="Most recent key rotation event for your account."
          icon="🔁"
        />
      </section>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-relaxed text-amber-950 sm:p-6 sm:text-[0.9375rem]">
        <strong className="font-semibold text-amber-900">
          No keys are generated today.
        </strong>{" "}
        Tropicash will not issue API keys — sandbox or live — until Phase 2 of the
        developer program opens. Any value resembling a key shown in documentation is a
        placeholder.
      </div>

      <DevConsoleComingSoon
        heading="API key management is coming"
        description="In Phase 2 you'll be able to create sandbox keys, rotate keys, and request live access through a manual review."
      />
    </DevConsoleLayout>
  );
}
