/**
 * Phase 12M — the main OAuth consent preview card.
 *
 * Composes the app summary, warning/blocked banners, and the requested scope
 * list, then renders the (always-disabled) Approve action plus a Decline
 * action. This card NEVER issues codes/tokens or creates consent records.
 */

import OAuthAppSummary from "./OAuthAppSummary";
import OAuthScopeList from "./OAuthScopeList";

function Banner({ tone = "info", title, children }) {
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className={`rounded-xl border p-4 text-sm ${tones[tone] || tones.info}`} role="note">
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

export default function OAuthConsentCard({
  view,
  appName,
  environment = "Sandbox",
  resolved = false,
  onDecline,
  declining = false,
  server = null,
  approveEnabled = false,
  onApprove,
  approving = false,
}) {
  const { request, scopes, risk, requestInvalid, status, approval } = view;
  const blocked = status === "blocked" || risk.hasCritical;

  // When a server validation result is supplied (Phase 12N) it is authoritative:
  // render server errors/warnings and suppress the local catalog-derived banners.
  const useServer = Boolean(server);
  const serverErrors = server?.errors ?? [];
  const serverWarnings = server?.warnings ?? [];
  const serverHasCritical = serverErrors.some((e) => e.code === "critical_scope_blocked");

  return (
    <div className="space-y-5">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-tropicash-green-hover">
          Tropicash · Authorization request
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-900">
          {appName || "An application"} wants to access your Tropicash account
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Review the permissions below before deciding. You can decline at any time.
        </p>
      </header>

      <OAuthAppSummary
        appName={appName}
        clientId={request.clientId}
        environment={environment}
        redirectUri={request.redirectUri}
        scopeCount={scopes.items.length}
        resolved={resolved}
      />

      {useServer ? (
        <>
          {serverErrors.length ? (
            <Banner
              tone="danger"
              title={
                serverHasCritical
                  ? "Money movement permissions are not available yet"
                  : "This authorization request cannot be approved"
              }
            >
              <ul className="list-disc space-y-1 pl-5">
                {serverErrors.map((e) => (
                  <li key={e.code}>{e.message}</li>
                ))}
              </ul>
            </Banner>
          ) : null}
          {serverWarnings.length ? (
            <Banner tone="warning" title="Please review before continuing">
              <ul className="list-disc space-y-1 pl-5">
                {serverWarnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Banner>
          ) : null}
        </>
      ) : (
        <>
          {requestInvalid ? (
            <Banner tone="danger" title="This authorization request is invalid">
              {scopes.hasUnknown
                ? "It includes one or more unrecognized permissions. Approval is not possible."
                : "Some required details are missing or unsupported. Approval is not possible."}
            </Banner>
          ) : null}

          {blocked ? (
            <Banner tone="danger" title="Money movement permissions are not available yet">
              This app is requesting permission to move money (for example sending or withdrawing
              funds). These permissions are not available, and this request cannot be approved.
            </Banner>
          ) : null}

          {!blocked && risk.hasWarning ? (
            <Banner tone="warning" title="Sensitive permissions requested">
              This app is requesting access to sensitive account information (such as your wallet
              balance or transaction history). Only continue if you trust this application.
            </Banner>
          ) : null}
        </>
      )}

      <section aria-label="Requested permissions">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Requested permissions</h2>
        <OAuthScopeList items={scopes.items} />
      </section>

      <Banner tone="info">
        {approveEnabled
          ? "Approving grants this app an authorization code only. No access tokens are issued and no money can move."
          : "Approving third-party access is not enabled yet. This screen is a preview — no access is granted, and no codes or tokens are issued."}
      </Banner>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onDecline}
          disabled={declining || approving}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          Decline
        </button>
        {approveEnabled ? (
          <button
            type="button"
            onClick={onApprove}
            disabled={approving}
            className="rounded-lg bg-tropicash-green px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-tropicash-green-hover disabled:opacity-60"
          >
            {approving ? "Approving…" : "Approve"}
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Approval is not available yet"
            className="cursor-not-allowed rounded-lg bg-slate-300 px-4 py-2 text-sm font-semibold text-white"
          >
            {approval.label}
          </button>
        )}
      </div>
    </div>
  );
}
