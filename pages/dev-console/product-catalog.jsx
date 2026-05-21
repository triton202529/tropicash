import Link from "next/link";
import { useMemo } from "react";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import {
  API_CONTRACT_ENVIRONMENTS,
  API_CONTRACT_STATUSES,
  API_OPERATION_TYPES,
  API_PRODUCT_CATEGORIES,
  API_PRODUCT_RISK_LEVELS,
  API_PRODUCT_SAFETY_RULES,
  API_PRODUCT_STATUSES,
  API_PRODUCT_TYPES,
  API_PRODUCTS,
  API_RATE_LIMIT_TIERS,
  API_SANDBOX_CONTRACTS,
  DEVELOPER_PRODUCT_PHASE,
  buildContractHealthSummary,
  buildEnvironmentRestrictionSummary,
  buildProductCapabilityMap,
  buildRateLimitSummary,
  buildSandboxContractRows,
  getContractsForProduct,
} from "../../lib/developerProductCatalogConfig";

const sectionClass = "tropicash-surface rounded-2xl p-5 sm:p-6";
const titleClass = "text-lg font-bold text-slate-900";
const subClass = "mt-1 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]";

function Pill({ children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-700 ${className}`}
    >
      {children}
    </span>
  );
}

function RiskBadge({ level }) {
  const map = {
    low: "border-slate-200 bg-slate-50 text-slate-800",
    medium: "border-sky-200 bg-sky-50 text-sky-900",
    high: "border-amber-200 bg-amber-50 text-amber-950",
    critical: "border-rose-200 bg-rose-50 text-rose-900",
  };
  const cls = map[level] || map.medium;
  return <Pill className={cls}>{level}</Pill>;
}

export default function DevConsoleProductCatalogPage() {
  const rateSummary = useMemo(() => buildRateLimitSummary(), []);
  const envSummary = useMemo(() => buildEnvironmentRestrictionSummary(), []);
  const healthSummary = useMemo(() => buildContractHealthSummary(), []);
  const contractRows = useMemo(() => buildSandboxContractRows(), []);
  const capabilityMap = useMemo(() => buildProductCapabilityMap(), []);

  const sampleCapabilities = Object.keys(capabilityMap).slice(0, 6);

  return (
    <DevConsoleLayout
      title="Product Catalog"
      subtitle="Phase 4D static catalog — sandbox runtime contracts and API product shapes. Illustrative only; no endpoints, credentials, or execution."
    >
      <div
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        <strong className="font-semibold">Modeling layer.</strong> This page renders configuration
        from <code className="rounded bg-white/80 px-1 text-xs">lib/developerProductCatalogConfig.js</code>{" "}
        only. Route previews such as{" "}
        <code className="rounded bg-white/80 px-1 text-xs">POST /sandbox/…</code> are not wired to
        HTTP handlers.
      </div>

      <div
        role="note"
        className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950"
      >
        <strong className="font-semibold">Phase 9A + 9B — Product Access.</strong> Sandbox product entitlement previews
        and metadata-only product governance map capabilities to access scopes in{" "}
        <Link href="/dev-console/product-access" className="font-semibold text-teal-900 underline">
          Product Access
        </Link>{" "}
        — no endpoints, credentials, execution, or live access.
      </div>

      <div
        role="note"
        className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950"
      >
        <strong className="font-semibold">Phase 4E — Sandbox Analytics.</strong> Static usage, health,
        capability utilization, and rate-limit pressure narratives align with catalog keys in{" "}
        <Link href="/dev-console/sandbox-analytics" className="font-semibold text-violet-900 underline">
          Sandbox Analytics
        </Link>{" "}
        (simulation only — no traffic or storage).
      </div>

      <div
        role="note"
        className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950"
      >
        <strong className="font-semibold">Phase 5B — Auth Simulator.</strong> The{" "}
        <Link href="/dev-console/auth-simulator" className="font-semibold text-sky-900 underline">
          Auth Simulator
        </Link>{" "}
        walks thirteen conceptual verification stages against these same <code className="text-xs">product_key</code> /{" "}
        <code className="text-xs">contract_key</code> seeds — pure modeling, no HTTP or credentials.
      </div>

      <div
        role="note"
        className="rounded-xl border border-tropicash-green-tint bg-tropicash-green-tint px-4 py-3 text-sm text-slate-900"
      >
        <strong className="font-semibold">Phase 5C — Gateway Simulator.</strong> The{" "}
        <Link href="/dev-console/gateway-simulator" className="font-semibold text-tropicash-green-hover underline">
          Gateway Simulator
        </Link>{" "}
        merges catalog keys into static request envelopes, correlation triples, audit-field rehearsals, illustrative
        routing outcomes, delegated Phase 5B traces, Sandbox Analytics anchors, observability placeholders, and rate-limit
        storytelling — consoles only; illustrative routes stay non-functional.
      </div>

      <div
        role="note"
        className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-950"
      >
        <strong className="font-semibold">Phase 5D — Execution Routing.</strong> The{" "}
        <Link href="/dev-console/execution-routing" className="font-semibold text-violet-900 underline">
          Execution Routing
        </Link>{" "}
        simulator stitches post-gateway delegate narration across the same catalog keys — choreography only; no queues,
        workers, or live execution.
      </div>

      <div
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        <strong className="font-semibold">Phase 10A + 10B — Request Simulator.</strong> Sandbox request flow, governance,
        and observability metadata for catalog <code className="text-xs">product_key</code> rows live in the{" "}
        <Link href="/dev-console/request-simulator" className="font-semibold text-amber-900 underline">
          Request Simulator
        </Link>{" "}
        — simulation only, metadata only, preview only; no execution, no live request traffic, no endpoint activation,
        and no money movement.
      </div>

      <section className={sectionClass} aria-labelledby="phase-heading">
        <h2 id="phase-heading" className={titleClass}>
          Phase identifier
        </h2>
        <p className={subClass}>
          Machine-readable phase tag for cross-referencing documentation and developer-center
          navigation.
        </p>
        <p className="mt-3">
          <Pill>{DEVELOPER_PRODUCT_PHASE}</Pill>
        </p>
      </section>

      <section className={sectionClass} aria-labelledby="taxonomy-heading">
        <h2 id="taxonomy-heading" className={titleClass}>
          Categories &amp; vocabulary
        </h2>
        <p className={subClass}>
          Product categories cover the public catalog. Product types explain how each entry is
          packaged for documentation.
        </p>

        <h3 className="mt-5 text-sm font-bold text-slate-800">Categories</h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {API_PRODUCT_CATEGORIES.map((c) => (
            <li
              key={c.key}
              className="rounded-xl border border-slate-200 bg-white/80 p-4"
              style={{ borderLeftWidth: 4, borderLeftColor: c.accent }}
            >
              <div className="flex items-center gap-2">
                <span aria-hidden>{c.icon}</span>
                <span className="font-semibold text-slate-900">{c.label}</span>
              </div>
              <code className="mt-1 block text-xs text-slate-500">{c.key}</code>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{c.description}</p>
            </li>
          ))}
        </ul>

        <h3 className="mt-8 text-sm font-bold text-slate-800">Product types</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {API_PRODUCT_TYPES.map((t) => (
            <li key={t.key} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
              <strong className="font-semibold text-slate-900">{t.label}</strong>{" "}
              <code className="text-xs text-slate-500">({t.key})</code>
              <span className="mt-1 block text-xs text-slate-600">{t.description}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Contract environments</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {API_CONTRACT_ENVIRONMENTS.map((e) => (
                <Pill key={e}>{e}</Pill>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Contract statuses</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {API_CONTRACT_STATUSES.map((s) => (
                <Pill key={s}>{s}</Pill>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Product statuses</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {API_PRODUCT_STATUSES.map((s) => (
                <Pill key={s}>{s}</Pill>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Risk levels</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {API_PRODUCT_RISK_LEVELS.map((r) => (
                <RiskBadge key={r} level={r} />
              ))}
            </div>
          </div>
        </div>

        <h3 className="mt-8 text-sm font-bold text-slate-800">Operation types</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {API_OPERATION_TYPES.map((o) => (
            <Pill key={o}>{o}</Pill>
          ))}
        </div>

        <h3 className="mt-8 text-sm font-bold text-slate-800">Rate limit tiers (intent)</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {API_RATE_LIMIT_TIERS.map((t) => (
            <Pill key={t}>{t}</Pill>
          ))}
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="products-heading">
        <h2 id="products-heading" className={titleClass}>
          API products (seed)
        </h2>
        <p className={subClass}>
          Each product bundles documentation metadata, capability keys from the Phase 2C catalog,
          and environment posture flags.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3 font-semibold">Product</th>
                <th className="pb-2 pr-3 font-semibold">Category</th>
                <th className="pb-2 pr-3 font-semibold">Status</th>
                <th className="pb-2 pr-3 font-semibold">Sandbox / live</th>
                <th className="pb-2 pr-3 font-semibold">Tier</th>
                <th className="pb-2 pr-3 font-semibold">Risk</th>
                <th className="pb-2 font-semibold">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {API_PRODUCTS.map((p) => (
                <tr key={p.product_key} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-3 align-top">
                    <div className="font-semibold text-slate-900">{p.title}</div>
                    <code className="text-xs text-slate-500">{p.product_key}</code>
                  </td>
                  <td className="py-3 pr-3 align-top text-slate-600">{p.category}</td>
                  <td className="py-3 pr-3 align-top">
                    <Pill>{p.status}</Pill>
                  </td>
                  <td className="py-3 pr-3 align-top text-xs text-slate-600">
                    {p.sandbox_supported ? "sandbox" : "—"}
                    <span className="text-slate-300"> · </span>
                    {p.live_supported ? "live" : "—"}
                  </td>
                  <td className="py-3 pr-3 align-top text-slate-600">{p.rate_limit_tier}</td>
                  <td className="py-3 pr-3 align-top">
                    <RiskBadge level={p.risk_level} />
                  </td>
                  <td className="py-3 align-top text-xs text-slate-600">
                    {(p.capability_keys || []).join(", ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="contracts-heading">
        <h2 id="contracts-heading" className={titleClass}>
          Sandbox &amp; live contract previews
        </h2>
        <p className={subClass}>
          Static request/response schema objects illustrate future handler contracts. Cross-reference
          products from App Capabilities via each{' '}
          <code className="rounded bg-slate-100 px-1 text-xs">product_key</code>.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3 font-semibold">Contract</th>
                <th className="pb-2 pr-3 font-semibold">Route</th>
                <th className="pb-2 pr-3 font-semibold">Product</th>
                <th className="pb-2 pr-3 font-semibold">Env</th>
                <th className="pb-2 pr-3 font-semibold">Tier</th>
                <th className="pb-2 pr-3 font-semibold">Review</th>
                <th className="pb-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {contractRows.map((row) => (
                <tr key={row.contract_key} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 align-top">
                    <div className="font-medium text-slate-900">{row.title}</div>
                    <code className="text-xs text-slate-500">{row.contract_key}</code>
                  </td>
                  <td className="py-2 pr-3 align-top">
                    <span className="font-mono text-xs text-slate-800">
                      {row.method} {row.route_preview}
                    </span>
                  </td>
                  <td className="py-2 pr-3 align-top text-xs text-slate-600">
                    {row.product_title}
                    <div>
                      <code className="text-[0.65rem] text-slate-500">{row.product_key}</code>
                    </div>
                  </td>
                  <td className="py-2 pr-3 align-top">{row.environment}</td>
                  <td className="py-2 pr-3 align-top text-slate-600">{row.rate_limit_tier}</td>
                  <td className="py-2 pr-3 align-top">{row.review_required ? "yes" : "no"}</td>
                  <td className="py-2 align-top">
                    <Pill>{row.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={sectionClass} aria-labelledby="schema-heading">
        <h2 id="schema-heading" className={titleClass}>
          Example schema detail
        </h2>
        <p className={subClass}>
          The first sandbox contract demonstrates how request/response literals are embedded in
          config. Additional contracts follow the same pattern in the module.
        </p>
        {API_SANDBOX_CONTRACTS[0] ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Request schema</h3>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-100">
                <code>{JSON.stringify(API_SANDBOX_CONTRACTS[0].request_schema, null, 2)}</code>
              </pre>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-800">Response schema</h3>
              <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-100">
                <code>{JSON.stringify(API_SANDBOX_CONTRACTS[0].response_schema, null, 2)}</code>
              </pre>
            </div>
          </div>
        ) : null}
      </section>

      <section className={sectionClass} aria-labelledby="summaries-heading">
        <h2 id="summaries-heading" className={titleClass}>
          Aggregates &amp; capability map samples
        </h2>
        <p className={subClass}>
          Helpers expose flattened summaries for tables elsewhere in the Developer Console (no network
          calls).
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Contracts
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{healthSummary.total_contracts}</p>
            <p className="mt-1 text-xs text-slate-600">
              Review required: {healthSummary.review_required_contracts}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Products (live-capable)
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{envSummary.products_live_capable}</p>
            <p className="mt-1 text-xs text-slate-600">Sandbox-only support: {envSummary.products_sandbox_only_support}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Contract env split
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              sandbox {envSummary.contracts_sandbox_environment} · live{" "}
              {envSummary.contracts_live_environment}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
              Capability keys mapped
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{Object.keys(capabilityMap).length}</p>
            <p className="mt-1 text-xs text-slate-600">Distinct Phase 2C keys touched by products</p>
          </div>
        </div>

        <h3 className="mt-8 text-sm font-bold text-slate-800">Rate limit tier aggregates</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3 font-semibold">Tier</th>
                <th className="pb-2 pr-3 font-semibold">Products</th>
                <th className="pb-2 font-semibold">Contracts</th>
              </tr>
            </thead>
            <tbody>
              {API_RATE_LIMIT_TIERS.map((tier) => (
                <tr key={tier} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 font-mono text-xs">{tier}</td>
                  <td className="py-2 pr-3">{rateSummary[tier]?.products ?? 0}</td>
                  <td className="py-2">{rateSummary[tier]?.contracts ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-8 text-sm font-bold text-slate-800">Capability → products (sample)</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          {sampleCapabilities.map((ck) => (
            <li key={ck} className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
              <code className="text-xs font-semibold text-slate-900">{ck}</code>
              <span className="mx-2 text-slate-300">→</span>
              {(capabilityMap[ck] || []).map((p) => p.title).join(", ")}
            </li>
          ))}
        </ul>
      </section>

      <section className={sectionClass} aria-labelledby="product-contracts-heading">
        <h2 id="product-contracts-heading" className={titleClass}>
          Contracts per product (drill-down)
        </h2>
        <p className={subClass}>
          Each seeded product key lists its contracts using the{' '}
          <code className="rounded bg-slate-100 px-1 text-xs">getContractsForProduct</code> helper.
        </p>
        <ul className="mt-4 space-y-3">
          {API_PRODUCTS.map((p) => {
            const related = getContractsForProduct(p.product_key);
            return (
              <li key={p.product_key} className="rounded-xl border border-slate-200 bg-white/90 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <strong className="font-semibold text-slate-900">{p.title}</strong>
                  <span className="text-xs text-slate-500">{related.length} contract(s)</span>
                </div>
                {related.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                    {related.map((c) => (
                      <li key={c.contract_key}>
                        <span className="font-mono">{c.method}</span> {c.route_preview} —{" "}
                        <span className="font-medium text-slate-800">{c.title}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">No seeded contracts.</p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section
        className="rounded-2xl border border-rose-200 bg-rose-50 p-5 sm:p-6"
        aria-labelledby="safety-heading"
      >
        <h2 id="safety-heading" className="text-base font-bold text-rose-950 sm:text-lg">
          Safety notice — Phase 4D catalog
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-rose-950 sm:text-[0.9375rem]">
          {API_PRODUCT_SAFETY_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/dev-console/workspace" className="font-semibold text-tropicash-green-hover underline">
          Workspace (Phase 7A + 7B)
        </Link>
        {" · "}
        <Link href="/dev-console/product-access" className="font-semibold text-tropicash-green-hover underline">
          Product Access (9A + 9B)
        </Link>
        {" · "}
        <Link href="/dev-console/request-simulator" className="font-semibold text-tropicash-green-hover underline">
          Request Simulator (10A + 10B)
        </Link>
        {" · "}
        <Link href="/dev-console/sandbox-analytics" className="font-semibold text-tropicash-green-hover underline">
          Sandbox Analytics
        </Link>
        {" · "}
        <Link href="/dev-console/app-capabilities" className="font-semibold text-tropicash-green-hover underline">
          App Capabilities
        </Link>
        {" · "}
        <Link href="/dev-console/my-apps" className="font-semibold text-tropicash-green-hover underline">
          My Apps
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
