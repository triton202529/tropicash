import DevConsoleLayout, {
  DevConsolePlaceholderCard,
  DevConsoleComingSoon,
} from "../../components/devconsole/DevConsoleLayout";

const PLANNED_EVENTS = [
  "wallet.funded",
  "wallet.transfer.completed",
  "payment.completed",
  "payment.failed",
  "payout.completed",
  "payout.failed",
  "fraud.flagged",
  "account.status.changed",
];

export default function DevConsoleWebhooksPage() {
  return (
    <DevConsoleLayout
      title="Webhooks"
      subtitle="Subscribe to signed, real-time events from Tropicash. Webhook configuration and delivery tracking land in Phase 3."
    >
      <section
        aria-labelledby="webhooks-metrics-heading"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
      >
        <h2 id="webhooks-metrics-heading" className="sr-only">
          Webhook metrics (placeholder)
        </h2>
        <DevConsolePlaceholderCard
          title="Active Webhooks"
          value="—"
          hint="Endpoints configured to receive Tropicash events."
          icon="🔔"
        />
        <DevConsolePlaceholderCard
          title="Deliveries (24h)"
          value="—"
          hint="Successful + failed webhook deliveries over the last day."
          icon="📬"
        />
        <DevConsolePlaceholderCard
          title="Failure Rate"
          value="—"
          hint="Rolling failure rate across all webhook endpoints."
          icon="⚠️"
        />
      </section>

      <section
        aria-labelledby="planned-events-heading"
        className="tropicash-surface rounded-2xl p-5 sm:p-6"
      >
        <h2
          id="planned-events-heading"
          className="text-base font-bold text-slate-900 sm:text-lg"
        >
          Planned event types
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
          The event names below are directional. Final naming, payload schemas, and
          signature format will be finalized before any webhook deliveries go out.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PLANNED_EVENTS.map((event) => (
            <li
              key={event}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-mono text-slate-800"
            >
              <span
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500"
                aria-hidden
              />
              <span>{event}</span>
            </li>
          ))}
        </ul>
      </section>

      <DevConsoleComingSoon
        heading="Webhook management is coming"
        description="In Phase 3 you'll be able to register endpoints, subscribe to event types, replay deliveries, and verify HMAC signatures."
      />
    </DevConsoleLayout>
  );
}
