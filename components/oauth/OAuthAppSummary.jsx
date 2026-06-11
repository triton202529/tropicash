/**
 * Phase 12M — summarizes the requesting application for the consent screen.
 *
 * Shows only safe, non-secret metadata: app name, client_id, environment,
 * redirect URI, and the number of requested scopes. NEVER renders
 * client_secret_hash or any secret material.
 */

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-slate-100 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-slate-800 sm:text-right">{children}</dd>
    </div>
  );
}

export default function OAuthAppSummary({
  appName,
  clientId,
  environment = "Sandbox",
  redirectUri,
  scopeCount = 0,
  resolved = false,
}) {
  return (
    <section
      aria-label="Application request summary"
      className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-base font-bold text-white"
        >
          {String(appName || "?").trim().charAt(0).toUpperCase() || "?"}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900">{appName || "Unknown application"}</p>
          <p className="text-xs text-slate-500">
            {resolved ? "Verified Tropicash OAuth client" : "Unverified — details from request"}
          </p>
        </div>
      </div>

      <dl className="mt-3">
        <Row label="Client ID">
          <code className="text-xs text-slate-700">{clientId || "—"}</code>
        </Row>
        <Row label="Environment">
          <span className="inline-block rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
            {environment}
          </span>
        </Row>
        <Row label="Redirect URI">
          <code className="text-xs text-slate-700">{redirectUri || "—"}</code>
        </Row>
        <Row label="Requested permissions">
          <span className="text-sm font-medium text-slate-800">{scopeCount}</span>
        </Row>
      </dl>
    </section>
  );
}
