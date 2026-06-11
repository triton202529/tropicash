import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import { fetchOAuthClients } from "../../lib/oauthClients";
import { OAUTH_SCOPE_CATALOG } from "../../lib/oauthConsentModels";
import {
  OAUTH_TESTING_GUIDE,
  RESPONSE_TYPE,
  DEFAULT_SCOPES,
  SCOPE_RISK_ORDER,
  CRITICAL_SCOPE_NOTE,
  buildAuthorizationUrl,
  buildTokenExchangeCurl,
  buildRefreshTokenCurl,
  buildProfileCurl,
  buildIntrospectCurl,
} from "../../lib/oauthTestingGuide";

const labelClass = "mb-1 block text-sm font-semibold text-slate-700";
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2";

const RISK_BADGE = {
  low: "border-emerald-200 bg-emerald-50 text-emerald-900",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
  high: "border-orange-200 bg-orange-50 text-orange-900",
  critical: "border-red-200 bg-red-50 text-red-900",
};

function statusBadge(status) {
  const s = String(status || "").toLowerCase();
  const map = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-900",
    disabled: "border-slate-200 bg-slate-100 text-slate-600",
  };
  const cls = map[s] || "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status || "—"}
    </span>
  );
}

function CopyButton({ value, label = "Copy", className = "" }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className={`rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 ${className}`}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

function CurlBlock({ code }) {
  return (
    <div className="mt-3">
      <div className="flex justify-end">
        <CopyButton value={code} label="Copy curl" />
      </div>
      <pre className="mt-2 overflow-x-auto rounded-lg border border-slate-200 bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function MethodPill({ method, path }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs">
      <span className="font-mono font-bold text-slate-900">{method}</span>
      <span className="font-mono text-slate-600">{path}</span>
    </span>
  );
}

function randomState() {
  try {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch {
    /* fall through */
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function DevConsoleOAuthTestingPage() {
  const { user, loading: authLoading } = useUser();
  const userId = user?.id ?? null;

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [selectedClientId, setSelectedClientId] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [state, setState] = useState("");
  const [selectedScopes, setSelectedScopes] = useState(() => new Set(DEFAULT_SCOPES));

  const load = useCallback(async () => {
    if (!userId) {
      setClients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    const { data, error } = await fetchOAuthClients(userId);
    if (error) {
      setLoadError(error.message || "Could not load OAuth clients.");
      setClients([]);
    } else {
      setClients(data || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!state) setState(randomState());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId],
  );

  useEffect(() => {
    if (!clients.length) {
      setSelectedClientId("");
      return;
    }
    setSelectedClientId((prev) =>
      prev && clients.some((c) => c.id === prev) ? prev : clients[0].id,
    );
  }, [clients]);

  useEffect(() => {
    const uris = Array.isArray(selectedClient?.redirect_uris)
      ? selectedClient.redirect_uris
      : [];
    setRedirectUri((prev) => (uris.includes(prev) ? prev : uris[0] || ""));
  }, [selectedClient]);

  const clientPublicId = selectedClient?.client_id || "";
  const clientUris = Array.isArray(selectedClient?.redirect_uris)
    ? selectedClient.redirect_uris
    : [];

  const scopeList = useMemo(() => Array.from(selectedScopes), [selectedScopes]);

  const toggleScope = (scope, disabled) => {
    if (disabled) return;
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });
  };

  const authorizationUrl = useMemo(
    () =>
      buildAuthorizationUrl({
        clientId: clientPublicId,
        redirectUri,
        scopes: scopeList,
        state,
        responseType: RESPONSE_TYPE,
      }),
    [clientPublicId, redirectUri, scopeList, state],
  );

  const tokenCurl = useMemo(
    () => buildTokenExchangeCurl({ clientId: clientPublicId || "tc_client_xxx", redirectUri }),
    [clientPublicId, redirectUri],
  );
  const refreshCurl = useMemo(
    () => buildRefreshTokenCurl({ clientId: clientPublicId || "tc_client_xxx" }),
    [clientPublicId],
  );
  const profileCurl = useMemo(() => buildProfileCurl(), []);
  const introspectCurl = useMemo(() => buildIntrospectCurl(), []);

  const canBuildUrl = Boolean(clientPublicId && redirectUri && scopeList.length);

  if (authLoading) {
    return (
      <DevConsoleLayout title="OAuth Testing" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout title="OAuth Testing" subtitle="Sign in to test the OAuth flow.">
        <p className="text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-tropicash-green-hover underline">
            Go to login
          </Link>
        </p>
      </DevConsoleLayout>
    );
  }

  return (
    <DevConsoleLayout
      title="OAuth Testing"
      subtitle="Build authorization URLs, pick scopes, and copy request examples for the full OAuth flow. Sandbox only — nothing here issues tokens or moves money."
    >
      {/* Safety banner */}
      <div
        role="note"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        <strong className="font-semibold">Sandbox testing tool.</strong> Production OAuth is
        disabled. No wallet access, no money movement, and no authorization codes or tokens are
        auto-issued here. Client secrets are never stored or shown on this page.
      </div>

      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}
        </p>
      ) : null}

      {/* 1. Select OAuth client */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="select-client-heading">
        <h2 id="select-client-heading" className="text-lg font-bold text-slate-900">
          1. Select OAuth Client
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Choose one of your registered OAuth clients. The client secret is never shown here — copy
          it from the one-time modal when you create or rotate a client.
        </p>

        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading clients…</p>
        ) : clients.length ? (
          <>
            <div className="mt-4 max-w-md">
              <label htmlFor="oauth_client" className={labelClass}>
                OAuth Client
              </label>
              <select
                id="oauth_client"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className={inputClass}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.client_name || c.client_id} ({c.client_id})
                  </option>
                ))}
              </select>
            </div>

            {selectedClient ? (
              <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Client Name
                  </dt>
                  <dd className="text-sm text-slate-900">{selectedClient.client_name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Client ID
                  </dt>
                  <dd className="flex items-center gap-2">
                    <code className="text-xs text-slate-800">{selectedClient.client_id}</code>
                    <CopyButton value={selectedClient.client_id} label="Copy" />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </dt>
                  <dd>{statusBadge(selectedClient.status)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Redirect URIs
                  </dt>
                  <dd>
                    {clientUris.length ? (
                      <ul className="space-y-0.5">
                        {clientUris.map((u) => (
                          <li key={u} className="font-mono text-[0.7rem] text-slate-600">
                            {u}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : null}
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No OAuth clients yet.{" "}
            <Link
              href="/dev-console/oauth-clients"
              className="font-semibold text-tropicash-green-hover underline"
            >
              Create an OAuth client
            </Link>{" "}
            to start testing.
          </p>
        )}
      </section>

      {/* 2. Build authorization URL */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="build-url-heading">
        <h2 id="build-url-heading" className="text-lg font-bold text-slate-900">
          2. Build Authorization URL
        </h2>
        <p className="mt-1 text-sm text-slate-600">{OAUTH_TESTING_GUIDE.authorizationUrl.summary}</p>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="field_client_id" className={labelClass}>
              client_id
            </label>
            <input
              id="field_client_id"
              type="text"
              value={clientPublicId}
              readOnly
              className={`${inputClass} bg-slate-50`}
              placeholder="Select a client above"
            />
          </div>
          <div>
            <label htmlFor="field_redirect_uri" className={labelClass}>
              redirect_uri
            </label>
            {clientUris.length ? (
              <select
                id="field_redirect_uri"
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                className={inputClass}
              >
                {clientUris.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="field_redirect_uri"
                type="text"
                value={redirectUri}
                onChange={(e) => setRedirectUri(e.target.value)}
                className={inputClass}
                placeholder="https://app.example.com/callback"
              />
            )}
          </div>
          <div>
            <label htmlFor="field_response_type" className={labelClass}>
              response_type
            </label>
            <input
              id="field_response_type"
              type="text"
              value={RESPONSE_TYPE}
              readOnly
              className={`${inputClass} bg-slate-50`}
            />
          </div>
          <div>
            <label htmlFor="field_state" className={labelClass}>
              state
            </label>
            <div className="flex items-center gap-2">
              <input
                id="field_state"
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className={inputClass}
                placeholder="random anti-CSRF value"
              />
              <button
                type="button"
                onClick={() => setState(randomState())}
                className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>

        {/* Scope selector */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <span className={labelClass}>scope</span>
            <span className="text-xs text-slate-500">Default: profile.read</span>
          </div>
          <div className="mt-2 space-y-4">
            {SCOPE_RISK_ORDER.map((risk) => {
              const group = OAUTH_SCOPE_CATALOG.filter((s) => s.riskLevel === risk);
              if (!group.length) return null;
              const isCritical = risk === "critical";
              return (
                <fieldset key={risk} className="rounded-xl border border-slate-200 p-3">
                  <legend className="px-1">
                    <span
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${
                        RISK_BADGE[risk] || RISK_BADGE.low
                      }`}
                    >
                      {risk} risk
                    </span>
                  </legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.map((s) => {
                      const checked = selectedScopes.has(s.scope);
                      return (
                        <label
                          key={s.scope}
                          className={`flex items-start gap-2 rounded-lg border p-2 text-sm ${
                            isCritical
                              ? "border-slate-200 bg-slate-50 opacity-70"
                              : "border-slate-200 bg-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isCritical}
                            onChange={() => toggleScope(s.scope, isCritical)}
                            className="mt-0.5"
                          />
                          <span>
                            <span className="font-mono text-slate-900">{s.scope}</span>
                            <span className="block text-xs text-slate-500">{s.label}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {isCritical ? (
                    <p className="mt-2 text-xs font-medium text-red-700">{CRITICAL_SCOPE_NOTE}</p>
                  ) : null}
                </fieldset>
              );
            })}
          </div>
        </div>

        {/* Generated URL */}
        <div className="mt-5">
          <span className={labelClass}>Generated authorization URL</span>
          <pre className="mt-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
            <code>{canBuildUrl ? authorizationUrl : "Select a client, redirect URI, and at least one scope."}</code>
          </pre>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton value={authorizationUrl} label="Copy URL" className={canBuildUrl ? "" : "pointer-events-none opacity-50"} />
            <a
              href={canBuildUrl ? authorizationUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!canBuildUrl}
              className={`rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 ${
                canBuildUrl ? "" : "pointer-events-none opacity-50"
              }`}
            >
              Open in new tab
            </a>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            This console does not auto-approve or issue codes. The consent screen handles approval.
          </p>
        </div>
      </section>

      {/* 3. Token exchange */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="token-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="token-heading" className="text-lg font-bold text-slate-900">
            3. Token Exchange
          </h2>
          <MethodPill method={OAUTH_TESTING_GUIDE.tokenExchange.method} path={OAUTH_TESTING_GUIDE.tokenExchange.path} />
        </div>
        <p className="mt-1 text-sm text-slate-600">{OAUTH_TESTING_GUIDE.tokenExchange.summary}</p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          The client secret is only shown once during OAuth client creation or rotation.
        </div>
        <CurlBlock code={tokenCurl} />
        <ul className="mt-2 list-disc pl-5 text-xs text-slate-500">
          {OAUTH_TESTING_GUIDE.tokenExchange.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      {/* 4. Refresh token */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="refresh-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="refresh-heading" className="text-lg font-bold text-slate-900">
            4. Refresh Token
          </h2>
          <MethodPill method={OAUTH_TESTING_GUIDE.refreshToken.method} path={OAUTH_TESTING_GUIDE.refreshToken.path} />
        </div>
        <p className="mt-1 text-sm text-slate-600">{OAUTH_TESTING_GUIDE.refreshToken.summary}</p>
        <CurlBlock code={refreshCurl} />
        <ul className="mt-2 list-disc pl-5 text-xs text-slate-500">
          {OAUTH_TESTING_GUIDE.refreshToken.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      {/* 5. Profile API */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="profile-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="profile-heading" className="text-lg font-bold text-slate-900">
            5. OAuth Profile Test
          </h2>
          <MethodPill method={OAUTH_TESTING_GUIDE.profileApi.method} path={OAUTH_TESTING_GUIDE.profileApi.path} />
        </div>
        <p className="mt-1 text-sm text-slate-600">{OAUTH_TESTING_GUIDE.profileApi.summary}</p>
        <p className="mt-2 text-xs">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-900">
            Required scope: {OAUTH_TESTING_GUIDE.profileApi.requiredScope}
          </span>
        </p>
        <CurlBlock code={profileCurl} />
        <ul className="mt-2 list-disc pl-5 text-xs text-slate-500">
          {OAUTH_TESTING_GUIDE.profileApi.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      {/* 6. Introspection */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="introspect-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="introspect-heading" className="text-lg font-bold text-slate-900">
            6. Introspection Test
          </h2>
          <MethodPill method={OAUTH_TESTING_GUIDE.introspection.method} path={OAUTH_TESTING_GUIDE.introspection.path} />
        </div>
        <p className="mt-1 text-sm text-slate-600">{OAUTH_TESTING_GUIDE.introspection.summary}</p>
        <CurlBlock code={introspectCurl} />
        <ul className="mt-2 list-disc pl-5 text-xs text-slate-500">
          {OAUTH_TESTING_GUIDE.introspection.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      {/* Safety notes */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="safety-heading">
        <h2 id="safety-heading" className="text-lg font-bold text-slate-900">
          {OAUTH_TESTING_GUIDE.safetyNotes.title}
        </h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-slate-600">
          {OAUTH_TESTING_GUIDE.safetyNotes.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/dev-console/oauth-clients" className="font-semibold text-tropicash-green-hover underline">
          OAuth Clients
        </Link>
        {" · "}
        <Link href="/dev-console/oauth-data-model" className="font-semibold text-tropicash-green-hover underline">
          OAuth Data Model
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
