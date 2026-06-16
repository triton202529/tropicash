import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import { fetchDeveloperApps } from "../../lib/developerApps";
import {
  createOAuthClient,
  fetchOAuthClients,
  rotateOAuthClientSecret,
  disableOAuthClient,
} from "../../lib/oauthClients";
import {
  evaluateDeveloperSandboxAccess,
  SANDBOX_APPROVAL_UI,
  SANDBOX_AGREEMENT_UI,
  SANDBOX_LIFECYCLE_UI,
} from "../../lib/developerSandboxAccessPolicy";
import { getCapabilityLabel } from "../../lib/developerSandboxApplications";

const labelClass = "mb-1 block text-sm font-semibold text-slate-700";
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2";
const selectClass = inputClass;

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

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

function OneTimeSecretModal({ result, onClose }) {
  if (!result) return null;
  const { clientId, secret, clientName } = result;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="oauth-secret-heading"
        className="tropicash-surface w-full max-w-lg rounded-2xl p-5 sm:p-6"
      >
        <h2 id="oauth-secret-heading" className="text-lg font-bold text-slate-900">
          OAuth client credentials
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {clientName ? <span className="font-semibold text-slate-800">{clientName}</span> : null} is
          ready. Copy your client secret now.
        </p>

        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
          ⚠️ This secret will only be shown once. Store it securely.
        </div>

        <div className="mt-4">
          <label className={labelClass}>Client ID</label>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
              {clientId}
            </code>
            <CopyButton value={clientId} label="Copy" />
          </div>
        </div>

        <div className="mt-3">
          <label className={labelClass}>Client Secret</label>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
              {secret}
            </code>
            <CopyButton value={secret} label="Copy" />
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            I&apos;ve stored my secret
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DevConsoleOAuthClientsPage() {
  const { user, loading: authLoading } = useUser();
  const userId = user?.id ?? null;

  const [apps, setApps] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [selectedAppId, setSelectedAppId] = useState("");
  const [redirectUris, setRedirectUris] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState({ type: "", text: "" });

  const [secretResult, setSecretResult] = useState(null);
  const [actionMessage, setActionMessage] = useState({ type: "", text: "" });
  const [busyId, setBusyId] = useState(null);
  const [accessEval, setAccessEval] = useState(null);

  const load = useCallback(async () => {
    if (!userId) {
      setApps([]);
      setClients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    const [aRes, cRes, access] = await Promise.all([
      fetchDeveloperApps(userId),
      fetchOAuthClients(userId),
      evaluateDeveloperSandboxAccess(userId),
    ]);
    const parts = [];
    if (aRes.error) parts.push(aRes.error.message || "Could not load apps.");
    if (cRes.error) parts.push(cRes.error.message || "Could not load OAuth clients.");
    setLoadError(parts.join(" "));
    setApps(aRes.error ? [] : aRes.data || []);
    setClients(cRes.error ? [] : cRes.data || []);
    setAccessEval(access);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!apps.length) {
      setSelectedAppId("");
      return;
    }
    setSelectedAppId((prev) =>
      prev && apps.some((a) => a.id === prev) ? prev : apps[0].id,
    );
  }, [apps]);

  const appById = useMemo(
    () => Object.fromEntries((apps || []).map((a) => [a.id, a])),
    [apps],
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormMessage({ type: "", text: "" });
    if (!userId) return;

    const app = appById[selectedAppId];
    if (!app) {
      setFormMessage({ type: "error", text: "Select an application first." });
      return;
    }

    setSubmitting(true);
    const { data, clientId, secret, error } = await createOAuthClient({
      user_id: userId,
      app_id: app.id,
      client_name: clientName,
      redirect_uris: redirectUris,
      environment: "sandbox",
    });
    setSubmitting(false);

    if (error) {
      const blocked =
        error.code === "sandbox_access_not_approved" ||
        error.code === "sandbox_capability_blocked" ||
        error.code === "sandbox_agreement_required" ||
        error.code === "sandbox_access_not_active";
      setFormMessage({
        type: "error",
        text: blocked
          ? error.code === "sandbox_agreement_required"
            ? "Sandbox agreement required. Accept the agreement before creating OAuth clients."
            : error.code === "sandbox_access_not_active"
              ? "Sandbox access is not active. An administrator must activate your access."
              : "Sandbox access not approved. Your application must include oauth_profile or oauth_wallet_sandbox."
          : error.message || "Could not create OAuth client.",
      });
      return;
    }

    setSecretResult({ clientId, secret, clientName: data.client_name });
    setClientName("");
    setRedirectUris("");
    setShowForm(false);
    void load();
  };

  const handleRotate = async (client) => {
    setActionMessage({ type: "", text: "" });
    if (!client?.id) return;
    setBusyId(client.id);
    const { data, secret, error } = await rotateOAuthClientSecret(client.id);
    setBusyId(null);
    if (error) {
      setActionMessage({ type: "error", text: error.message || "Could not rotate secret." });
      return;
    }
    if (data && secret) {
      setSecretResult({ clientId: data.client_id, secret, clientName: data.client_name });
    }
    void load();
  };

  const handleDisable = async (client) => {
    setActionMessage({ type: "", text: "" });
    if (!client?.id) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Disable “${client.client_name}”? This immediately disables the client.`)
    ) {
      return;
    }
    setBusyId(client.id);
    const { error } = await disableOAuthClient(client.id);
    setBusyId(null);
    if (error) {
      setActionMessage({ type: "error", text: error.message || "Could not disable client." });
      return;
    }
    setActionMessage({ type: "success", text: `“${client.client_name}” has been disabled.` });
    void load();
  };

  if (authLoading) {
    return (
      <DevConsoleLayout title="OAuth Clients" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout title="OAuth Clients" subtitle="Sign in to register and manage OAuth clients.">
        <p className="text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-tropicash-green-hover underline">
            Go to login
          </Link>
        </p>
      </DevConsoleLayout>
    );
  }

  const hasApps = apps.length > 0;
  const approvalUi =
    SANDBOX_APPROVAL_UI[accessEval?.status] || SANDBOX_APPROVAL_UI.no_application;
  const approvalToneClass = {
    ready: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    blocked: "border-red-200 bg-red-50 text-red-900",
    info: "border-sky-200 bg-sky-50 text-sky-900",
  }[approvalUi.tone] || "border-sky-200 bg-sky-50 text-sky-900";
  const oauthCaps = new Set(["oauth_profile", "oauth_wallet_sandbox"]);
  const hasOAuthCapability =
    Boolean(accessEval?.approved) &&
    accessEval.capabilities.some((c) => oauthCaps.has(c));
  const canCreateOAuth = Boolean(accessEval?.readyForSandboxResources) && hasOAuthCapability;
  const agreementUi = accessEval?.agreementAccepted
    ? SANDBOX_AGREEMENT_UI.accepted
    : SANDBOX_AGREEMENT_UI.required;
  const agreementToneClass = {
    ready: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
  }[agreementUi.tone] || "border-amber-200 bg-amber-50 text-amber-900";
  const lifecycleKey = accessEval?.lifecycleEffectiveStatus || "pending_activation";
  const lifecycleUi =
    SANDBOX_LIFECYCLE_UI[lifecycleKey] || SANDBOX_LIFECYCLE_UI.pending_activation;
  const lifecycleToneClass = {
    ready: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    blocked: "border-red-200 bg-red-50 text-red-900",
  }[lifecycleUi.tone] || "border-amber-200 bg-amber-50 text-amber-900";

  return (
    <DevConsoleLayout
      title="OAuth Clients"
      subtitle="Register OAuth clients and issue client credentials. Secrets are shown once and stored only as SHA-256 hashes. No tokens or consent are issued in this phase."
    >
      <OneTimeSecretModal result={secretResult} onClose={() => setSecretResult(null)} />

      <section
        className={`rounded-2xl border p-5 sm:p-6 ${approvalToneClass}`}
        aria-labelledby="sandbox-approval-heading"
      >
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="sandbox-approval-heading" className="text-lg font-bold">
            Sandbox access
          </h2>
          <span className="inline-block rounded-full border border-current/20 bg-white/60 px-3 py-1 text-xs font-bold">
            {approvalUi.badge}
          </span>
        </div>
        <p className="mt-2 text-sm opacity-90">{approvalUi.message}</p>
        {accessEval?.approved ? (
          <div className="mt-3 text-sm">
            <p className="font-semibold">Approved capabilities</p>
            <ul className="mt-1 list-inside list-disc">
              {accessEval.capabilities.map((cap) => (
                <li key={cap}>{getCapabilityLabel(cap)}</li>
              ))}
            </ul>
            {accessEval.reviewedAt ? (
              <p className="mt-2 text-xs opacity-80">
                Approved {formatWhen(accessEval.reviewedAt)}
              </p>
            ) : null}
            <p className="mt-2 text-xs opacity-80">
              OAuth clients require oauth_profile or oauth_wallet_sandbox. No money movement or
              production access.
            </p>
          </div>
        ) : null}
        {accessEval?.status === "no_application" && approvalUi.applyHref ? (
          <p className="mt-3 text-sm">
            <Link
              href={approvalUi.applyHref}
              className="font-semibold underline underline-offset-2"
            >
              Apply for sandbox access
            </Link>
          </p>
        ) : null}
      </section>

      {accessEval?.approved ? (
        <section
          className={`rounded-2xl border p-5 sm:p-6 ${agreementToneClass}`}
          aria-labelledby="sandbox-agreement-heading"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="sandbox-agreement-heading" className="text-lg font-bold">
              Sandbox agreement
            </h2>
            <span className="inline-block rounded-full border border-current/20 bg-white/60 px-3 py-1 text-xs font-bold">
              {agreementUi.badge}
            </span>
          </div>
          <p className="mt-2 text-sm opacity-90">{agreementUi.message}</p>
          {accessEval.agreementAccepted && accessEval.agreementAcceptedAt ? (
            <p className="mt-2 text-xs opacity-80">
              Version {accessEval.agreementVersion || accessEval.currentAgreementVersion} accepted{" "}
              {formatWhen(accessEval.agreementAcceptedAt)}
            </p>
          ) : null}
          {!accessEval.agreementAccepted && agreementUi.agreementHref ? (
            <p className="mt-3 text-sm">
              <Link
                href={agreementUi.agreementHref}
                className="font-semibold underline underline-offset-2"
              >
                Accept sandbox agreement
              </Link>
            </p>
          ) : null}
        </section>
      ) : null}

      {accessEval?.approved && accessEval?.agreementAccepted ? (
        <section
          className={`rounded-2xl border p-5 sm:p-6 ${lifecycleToneClass}`}
          aria-labelledby="sandbox-lifecycle-heading"
        >
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="sandbox-lifecycle-heading" className="text-lg font-bold">
              Access lifecycle
            </h2>
            <span className="inline-block rounded-full border border-current/20 bg-white/60 px-3 py-1 text-xs font-bold">
              {lifecycleUi.badge}
            </span>
          </div>
          <p className="mt-2 text-sm opacity-90">{lifecycleUi.message}</p>
          {accessEval.lifecycleActivatedAt ? (
            <p className="mt-2 text-xs opacity-80">
              Activated {formatWhen(accessEval.lifecycleActivatedAt)}
            </p>
          ) : null}
          {accessEval.lifecycleExpiresAt ? (
            <p className="mt-1 text-xs opacity-80">
              Expires {formatWhen(accessEval.lifecycleExpiresAt)}
            </p>
          ) : null}
        </section>
      ) : null}

      <div
        role="note"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        <strong className="font-semibold">Client management only.</strong> This registers OAuth
        clients and issues credentials. No authorization flow, access/refresh tokens, consent, or
        money movement happen here.
      </div>

      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}{" "}
          <span className="text-slate-600">
            Run{" "}
            <code className="rounded bg-slate-100 px-1">
              supabase/sql/oauth_consent_foundation_phase12k.sql
            </code>{" "}
            and{" "}
            <code className="rounded bg-slate-100 px-1">
              supabase/sql/oauth_clients_metadata_phase12l.sql
            </code>{" "}
            if the OAuth client table/columns are missing.
          </span>
        </p>
      ) : null}

      {actionMessage.text ? (
        <p
          role={actionMessage.type === "error" ? "alert" : "status"}
          className={
            actionMessage.type === "error" ? "text-sm text-red-700" : "text-sm text-emerald-800"
          }
        >
          {actionMessage.text}
        </p>
      ) : null}

      {/* Create OAuth client */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="create-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="create-heading" className="text-lg font-bold text-slate-900">
              Create OAuth Client
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Register a sandbox OAuth client for one of your applications.
            </p>
          </div>
          {hasApps && canCreateOAuth ? (
            <button
              type="button"
              onClick={() => {
                setShowForm((v) => !v);
                setFormMessage({ type: "", text: "" });
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {showForm ? "Cancel" : "Create OAuth Client"}
            </button>
          ) : null}
        </div>

        {!hasApps ? (
          <p className="mt-3 text-sm text-slate-600">
            You need a registered app first.{" "}
            <Link
              href="/dev-console/apps-register"
              className="font-semibold text-tropicash-green-hover underline"
            >
              Register an app
            </Link>
            .
          </p>
        ) : hasApps && accessEval?.approved && hasOAuthCapability && accessEval?.agreementAccepted && !accessEval?.lifecycleActive ? (
          <p className="mt-3 text-sm text-slate-600">
            OAuth client creation is disabled until an administrator activates your sandbox access.
          </p>
        ) : hasApps && accessEval?.approved && hasOAuthCapability && !accessEval?.agreementAccepted ? (
          <p className="mt-3 text-sm text-slate-600">
            OAuth client creation is disabled until you accept the sandbox agreement.
          </p>
        ) : hasApps && !canCreateOAuth ? (
          <p className="mt-3 text-sm text-slate-600">
            OAuth client creation is disabled until your sandbox application is approved with
            oauth_profile or oauth_wallet_sandbox.
          </p>
        ) : null}

        {showForm && hasApps ? (
          <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="client_name" className={labelClass}>
                Client Name
              </label>
              <input
                id="client_name"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Web App"
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="app_id" className={labelClass}>
                Application
              </label>
              <select
                id="app_id"
                value={selectedAppId}
                onChange={(e) => setSelectedAppId(e.target.value)}
                className={selectClass}
              >
                {apps.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.app_name} ({a.app_slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="redirect_uris" className={labelClass}>
                Redirect URIs
              </label>
              <textarea
                id="redirect_uris"
                value={redirectUris}
                onChange={(e) => setRedirectUris(e.target.value)}
                placeholder={"https://app.example.com/oauth/callback\nhttp://localhost:3000/callback"}
                rows={3}
                className={inputClass}
                required
              />
              <p className="mt-1 text-xs text-slate-500">
                One per line (or comma-separated). HTTPS required; http://localhost allowed in
                sandbox. No wildcards.
              </p>
            </div>

            {formMessage.text ? (
              <p
                role="alert"
                className={`sm:col-span-2 text-sm ${
                  formMessage.type === "error" ? "text-red-700" : "text-emerald-800"
                }`}
              >
                {formMessage.text}
              </p>
            ) : null}

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-tropicash-green px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-tropicash-green-hover disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create OAuth Client"}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {/* OAuth clients table */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="clients-heading">
        <h2 id="clients-heading" className="text-lg font-bold text-slate-900">
          Your OAuth clients
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading…</p>
        ) : clients.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">Client Name</th>
                  <th className="pb-2 pr-3 font-semibold">App</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 pr-3 font-semibold">Redirect URIs</th>
                  <th className="pb-2 pr-3 font-semibold">Created</th>
                  <th className="pb-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => {
                  const isActive = c.status === "active";
                  const busy = busyId === c.id;
                  const app = appById[c.app_id];
                  const uris = Array.isArray(c.redirect_uris) ? c.redirect_uris : [];
                  return (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-900">{c.client_name || "—"}</div>
                        <code className="text-[0.7rem] text-slate-500">{c.client_id}</code>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {app ? `${app.app_name}` : <code className="text-xs">{c.app_id}</code>}
                      </td>
                      <td className="py-2 pr-3">{statusBadge(c.status)}</td>
                      <td className="py-2 pr-3">
                        {uris.length ? (
                          <ul className="space-y-0.5">
                            {uris.map((u) => (
                              <li key={u} className="font-mono text-[0.7rem] text-slate-600">
                                {u}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-slate-500">{formatWhen(c.created_at)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <CopyButton value={c.client_id} label="Copy Client ID" />
                          <button
                            type="button"
                            disabled={!isActive || busy}
                            onClick={() => void handleRotate(c)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                          >
                            {busy ? "Working…" : "Rotate Secret"}
                          </button>
                          <button
                            type="button"
                            disabled={!isActive || busy}
                            onClick={() => void handleDisable(c)}
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 shadow-sm hover:bg-red-100 disabled:opacity-50"
                          >
                            Disable
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No OAuth clients yet. Create one above to get started.
          </p>
        )}
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/dev-console/oauth-data-model" className="font-semibold text-tropicash-green-hover underline">
          OAuth Data Model
        </Link>
        {" · "}
        <Link href="/dev-console/credentials" className="font-semibold text-tropicash-green-hover underline">
          API Credentials
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
