import DevConsoleLayout, {
  DevConsolePlaceholderCard,
  DevConsoleComingSoon,
} from "../../components/devconsole/DevConsoleLayout";

export default function DevConsoleSandboxPage() {
  return (
    <DevConsoleLayout
      title="Sandbox"
      subtitle="An isolated environment that mirrors production behavior. Sandbox wallets, sandbox payments, and sandbox payouts will never touch live treasury."
    >
      <section
        aria-labelledby="sandbox-metrics-heading"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
      >
        <h2 id="sandbox-metrics-heading" className="sr-only">
          Sandbox metrics (placeholder)
        </h2>
        <DevConsolePlaceholderCard
          title="Sandbox Apps"
          value="—"
          hint="Apps scoped to the sandbox environment."
          icon="🧩"
        />
        <DevConsolePlaceholderCard
          title="Test Wallets"
          value="—"
          hint="Sandbox wallets created against your apps."
          icon="👛"
        />
        <DevConsolePlaceholderCard
          title="Simulated Events"
          value="—"
          hint="Events you've fired through the future event simulator."
          icon="⚡"
        />
      </section>

      <section className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-relaxed text-sky-950 sm:p-6 sm:text-[0.9375rem]">
        <strong className="font-semibold text-sky-900">Sandbox isolation rule:</strong>{" "}
        Sandbox and live environments must remain isolated end-to-end. Sandbox traffic
        never reaches the live wallet ledger, the live payout pipeline, the live
        treasury bridge, or the live fraud engine.
      </section>

      <DevConsoleComingSoon
        heading="Sandbox tooling is coming"
        description="In Phase 2 you'll be able to create sandbox apps, mint sandbox wallets, fund them with test balances, and simulate webhook events without affecting any live system."
      />
    </DevConsoleLayout>
  );
}
