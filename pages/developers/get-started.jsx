import Link from "next/link";
import Navbar from "../../components/Navbar";
import {
  getAvailableSandboxApis,
  getDeveloperApiExamples,
  getDeveloperJourney,
  getDeveloperSandboxStatus,
  getDeveloperSecurityRequirements,
  getDeveloperSupportGuidance,
  getDeveloperWelcomeContent,
  getSandboxRestrictions,
  ONBOARDING_PHASE,
} from "../../lib/developerSandboxOnboarding";

const cardClass =
  "tropicash-surface flex h-full flex-col rounded-2xl p-5 transition-all duration-200 ease-in-out sm:p-6";

const ctaPrimaryClass =
  "rounded-lg bg-tropicash-green px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-tropicash-green-hover hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

const ctaSecondaryClass =
  "rounded-lg border border-[rgba(226,232,240,0.9)] bg-[rgba(255,255,255,0.92)] px-6 py-2.5 text-sm font-semibold text-slate-800 shadow-md backdrop-blur-[6px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

function Badge({ tone, children }) {
  const cls =
    tone === "ready"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-slate-200 bg-slate-100 text-slate-600";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-wide ${cls}`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${tone === "ready" ? "bg-emerald-500" : "bg-slate-400"}`}
        aria-hidden
      />
      {children}
    </span>
  );
}

export default function DevelopersGetStartedPage() {
  const welcome = getDeveloperWelcomeContent();
  const status = getDeveloperSandboxStatus();
  const journey = getDeveloperJourney();
  const apis = getAvailableSandboxApis();
  const restrictions = getSandboxRestrictions();
  const security = getDeveloperSecurityRequirements();
  const examples = getDeveloperApiExamples();
  const support = getDeveloperSupportGuidance();

  const publicApis = apis.filter((a) => a.category === "public");
  const oauthApis = apis.filter((a) => a.category === "oauth");

  return (
    <>
      <Navbar />
      <div className="px-4 py-8 pb-16 sm:px-6 sm:py-10">
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-10">
          {/* Hero */}
          <section className="flex w-full flex-col">
            <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-tropicash-green-tint bg-tropicash-green-tint px-3 py-1 text-xs font-semibold uppercase tracking-wide text-tropicash-green-hover">
              External Developer Onboarding · Phase {ONBOARDING_PHASE}
            </span>
            <h1 className="max-w-3xl text-3xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-4xl">
              {welcome.title}
            </h1>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="ready">Sandbox Available</Badge>
              <Badge tone="off">Production Disabled</Badge>
            </div>
            {welcome.paragraphs.map((p) => (
              <p key={p.slice(0, 24)} className="mt-4 max-w-3xl text-base leading-relaxed text-slate-600">
                {p}
              </p>
            ))}
            <p className="mt-2 text-sm text-slate-500">{status.message}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/developers/apply" className={ctaPrimaryClass}>
                Apply for Sandbox Access
              </Link>
              <Link href="/developers/request-access" className={ctaSecondaryClass}>
                Request developer access
              </Link>
              <Link href="/developers" className={ctaSecondaryClass}>
                Developer overview
              </Link>
            </div>
          </section>

          {/* Available APIs */}
          <section className={cardClass} aria-labelledby="available-apis-heading">
            <h2 id="available-apis-heading" className="text-xl font-bold text-slate-900">
              What You Can Build Today
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Only implemented sandbox APIs are listed. OAuth wallet read is sandbox-only and read-only.
            </p>

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
              Developer Sandbox APIs
            </h3>
            <ul className="mt-3 space-y-3">
              {publicApis.map((api) => (
                <li
                  key={api.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{api.name}</span>
                    <code className="rounded bg-white px-2 py-0.5 text-xs text-slate-700">
                      {api.method} {api.path}
                    </code>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{api.description}</p>
                </li>
              ))}
            </ul>

            <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
              OAuth Sandbox APIs
            </h3>
            <ul className="mt-3 space-y-3">
              {oauthApis.map((api) => (
                <li
                  key={api.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{api.name}</span>
                    <code className="rounded bg-white px-2 py-0.5 text-xs text-slate-700">
                      {api.method} {api.path}
                    </code>
                    {api.scope ? (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
                        Requires: {api.scope}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{api.description}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* Developer Journey */}
          <section className={cardClass} aria-labelledby="journey-heading">
            <h2 id="journey-heading" className="text-xl font-bold text-slate-900">
              Developer Journey
            </h2>
            <p className="mt-2 text-sm text-slate-600">Recommended path for sandbox onboarding.</p>
            <ol className="mt-5 space-y-4">
              {journey.map((step) => (
                <li key={step.id} className="flex gap-4 rounded-xl border border-slate-100 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tropicash-green-tint text-sm font-bold text-tropicash-green-hover">
                    {step.step}
                  </span>
                  <div>
                    <h3 className="font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-1 text-sm text-slate-600">{step.summary}</p>
                    {step.href && !step.requiresConsoleAccess ? (
                      <Link href={step.href} className="mt-2 inline-block text-sm font-semibold text-tropicash-green-hover underline">
                        Learn more
                      </Link>
                    ) : step.requiresConsoleAccess ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Available in Developer Console after access approval.
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* Restrictions */}
          <section className={cardClass} aria-labelledby="restrictions-heading">
            <h2 id="restrictions-heading" className="text-xl font-bold text-slate-900">
              Sandbox Restrictions
            </h2>
            <p className="mt-2 text-sm text-slate-600">Not available in the current sandbox release.</p>
            <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {restrictions.map((item) => (
                <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="font-bold text-red-600" aria-hidden>
                    ✗
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* Security */}
          <section className={cardClass} aria-labelledby="security-heading">
            <h2 id="security-heading" className="text-xl font-bold text-slate-900">
              Security Expectations
            </h2>
            <ul className="mt-4 space-y-2">
              {security.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                  <span className="mt-0.5 font-bold text-emerald-600" aria-hidden>
                    •
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          {/* API Examples */}
          <section className={cardClass} aria-labelledby="examples-heading">
            <h2 id="examples-heading" className="text-xl font-bold text-slate-900">
              API Examples
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Placeholder credentials only. Never use real secrets in documentation or client-side code.
            </p>
            <div className="mt-4 space-y-4">
              {examples.map((ex) => (
                <div key={ex.id}>
                  <h3 className="text-sm font-semibold text-slate-800">{ex.title}</h3>
                  <pre className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
                    {ex.example}
                  </pre>
                </div>
              ))}
            </div>
          </section>

          {/* Support */}
          <section className={cardClass} aria-labelledby="support-heading">
            <h2 id="support-heading" className="text-xl font-bold text-slate-900">
              Support &amp; Feedback
            </h2>
            <dl className="mt-4 space-y-4 text-sm text-slate-600">
              <div>
                <dt className="font-semibold text-slate-800">Sandbox testing</dt>
                <dd className="mt-1">{support.testing}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-800">Reporting issues</dt>
                <dd className="mt-1">{support.issues}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-800">Production roadmap</dt>
                <dd className="mt-1">{support.roadmap}</dd>
              </div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/support" className={ctaSecondaryClass}>
                Contact support
              </Link>
              <Link href="/developers/roadmap" className={ctaSecondaryClass}>
                View roadmap
              </Link>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}
