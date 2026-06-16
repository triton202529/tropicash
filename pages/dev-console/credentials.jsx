import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import {
  fetchDeveloperApps,
  fetchDeveloperOrganizations,
} from "../../lib/developerApps";
import {
  createApiCredential,
  fetchApiCredentials,
  revokeApiCredential,
  rotateApiCredential,
} from "../../lib/developerCredentials";
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
    revoked: "border-red-200 bg-red-50 text-red-900",
    expired: "border-slate-200 bg-slate-100 text-slate-600",
  };
  const cls = map[s] || "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status || "—"}
    </span>
  );
}

function environmentBadge(environment) {
  const e = String(environment || "").toLowerCase();
  const cls =
    e === "production"
      ? "border-violet-200 bg-violet-50 text-violet-900"
      : "border-sky-200 bg-sky-50 text-sky-800";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {environment || "—"}
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
  const { publicKey, secret, keyName } = result;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="one-time-secret-heading"
        className="tropicash-surface w-full max-w-lg rounded-2xl p-5 sm:p-6"
      >
        <h2 id="one-time-secret-heading" className="text-lg font-bold text-slate-900">
          API credential created
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {keyName ? <span className="font-semibold text-slate-800">{keyName}</span> : null} is now
          active. Copy your secret now.
        </p>

        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
          ⚠️ This secret will only be shown once. Store it securely.
        </div>

        <div className="mt-4">
          <label className={labelClass}>Public Key</label>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">
              {publicKey}
            </code>
            <CopyButton value={publicKey} label="Copy" />
          </div>
        </div>

        <div className="mt-3">
          <label className={labelClass}>Secret Key</label>
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

export default function DevConsoleCredentialsPage() {
  const { user, loading: authLoading } = useUser();
  const userId = user?.id ?? null;

  const [orgs, setOrgs] = useState([]);
  const [apps, setApps] = useState([]);
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedAppId, setSelectedAppId] = useState("");
  const [environment, setEnvironment] = useState("sandbox");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState({ type: "", text: "" });

  const [secretResult, setSecretResult] = useState(null);
  const [actionMessage, setActionMessage] = useState({ type: "", text: "" });
  const [busyId, setBusyId] = useState(null);
  const [accessEval, setAccessEval] = useState(null);

  const load = useCallback(async () => {
    if (!userId) {
      setOrgs([]);
      setApps([]);
      setCredentials([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    const [oRes, aRes, cRes, access] = await Promise.all([
      fetchDeveloperOrganizations(userId),
      fetchDeveloperApps(userId),
      fetchApiCredentials(userId),
      evaluateDeveloperSandboxAccess(userId),
    ]);
    const parts = [];
    if (oRes.error) parts.push(oRes.error.message || "Could not load organizations.");
    if (aRes.error) parts.push(aRes.error.message || "Could not load apps.");
    if (cRes.error) parts.push(cRes.error.message || "Could not load credentials.");
    setLoadError(parts.join(" "));
    setOrgs(oRes.error ? [] : oRes.data || []);
    setApps(aRes.error ? [] : aRes.data || []);
    setCredentials(cRes.error ? [] : cRes.data || []);
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
    if (environment !== "sandbox") {
      setFormMessage({
        type: "error",
        text: "Production access will be enabled in a future release.",
      });
      return;
    }

    setSubmitting(true);
    const { data, secret, error } = await createApiCredential({
      organization_id: app.organization_id,
      app_id: app.id,
      key_name: keyName,
      environment,
      created_by: userId,
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
            ? "Sandbox agreement required. Accept the agreement before creating credentials."
            : error.code === "sandbox_access_not_active"
              ? "Sandbox access is not active. An administrator must activate your access."
              : "Sandbox access not approved. Submit or wait for approval on your sandbox application."
          : error.message || "Could not create credential.",
      });
      return;
    }

    setSecretResult({ publicKey: data.public_key, secret, keyName: data.key_name });
    setKeyName("");
    setShowForm(false);
    setFormMessage({ type: "", text: "" });
    void load();
  };

  const handleRotate = async (credential) => {
    setActionMessage({ type: "", text: "" });
    if (!credential?.id) return;
    setBusyId(credential.id);
    const { data, secret, error } = await rotateApiCredential(credential.id, {
      rotated_by: userId,
    });
    setBusyId(null);
    if (error && !data) {
      setActionMessage({ type: "error", text: error.message || "Could not rotate credential." });
      return;
    }
    if (data && secret) {
      setSecretResult({ publicKey: data.public_key, secret, keyName: data.key_name });
    }
    if (error) {
      setActionMessage({
        type: "error",
        text: "New credential issued, but the old key could not be revoked automatically. Please revoke it manually.",
      });
    }
    void load();
  };

  const handleRevoke = async (credential) => {
    setActionMessage({ type: "", text: "" });
    if (!credential?.id) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Revoke “${credential.key_name}”? This immediately disables the key.`)
    ) {
      return;
    }
    setBusyId(credential.id);
    const { error } = await revokeApiCredential(credential.id);
    setBusyId(null);
    if (error) {
      setActionMessage({ type: "error", text: error.message || "Could not revoke credential." });
      return;
    }
    setActionMessage({ type: "success", text: `“${credential.key_name}” has been revoked.` });
    void load();
  };

  if (authLoading) {
    return (
      <DevConsoleLayout title="API Credentials" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout
        title="API Credentials"
        subtitle="Sign in to generate and manage API credentials."
      >
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
  const canCreateCredentials = Boolean(accessEval?.readyForSandboxResources);
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
      title="API Credentials"
      subtitle="Generate and manage real API credentials for your applications. Secrets are shown once and stored only as SHA-256 hashes."
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
              Sandbox only — no production access, money movement, or wallet mutations.
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

      {/* Environment availability */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="env-heading">
        <h2 id="env-heading" className="text-lg font-bold text-slate-900">
          Environments
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
            Sandbox — enabled
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
            Production — disabled
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          Production access will be enabled in a future release. Sandbox credentials are isolated
          from live wallets, transactions, and payouts.
        </p>
      </section>

      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}{" "}
          <span className="text-slate-600">
            Run{" "}
            <code className="rounded bg-slate-100 px-1">
              supabase/sql/developer_api_keys_phase12a.sql
            </code>{" "}
            if the credential table is missing.
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

      {/* Generate */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="generate-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="generate-heading" className="text-lg font-bold text-slate-900">
              Generate API Key
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Issue a sandbox credential for one of your applications.
            </p>
          </div>
          {hasApps && canCreateCredentials ? (
            <button
              type="button"
              onClick={() => {
                setShowForm((v) => !v);
                setFormMessage({ type: "", text: "" });
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {showForm ? "Cancel" : "Generate API Key"}
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
        ) : hasApps && accessEval?.approved && accessEval?.agreementAccepted && !accessEval?.lifecycleActive ? (
          <p className="mt-3 text-sm text-slate-600">
            Credential creation is disabled until an administrator activates your sandbox access.
          </p>
        ) : hasApps && accessEval?.approved && !accessEval?.agreementAccepted ? (
          <p className="mt-3 text-sm text-slate-600">
            Credential creation is disabled until you accept the sandbox agreement.
          </p>
        ) : hasApps && !canCreateCredentials ? (
          <p className="mt-3 text-sm text-slate-600">
            Credential creation is disabled until your sandbox application is approved.
          </p>
        ) : null}

        {showForm && hasApps ? (
          <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <label htmlFor="key_name" className={labelClass}>
                Key Name
              </label>
              <input
                id="key_name"
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. Production backend"
                className={inputClass}
                required
              />
            </div>
            <div className="sm:col-span-1">
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
            <div className="sm:col-span-1">
              <label htmlFor="environment" className={labelClass}>
                Environment
              </label>
              <select
                id="environment"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
                className={selectClass}
              >
                <option value="sandbox">Sandbox</option>
                <option value="production" disabled>
                  Production (coming soon)
                </option>
              </select>
            </div>

            {formMessage.text ? (
              <p
                role="alert"
                className={`sm:col-span-3 text-sm ${
                  formMessage.type === "error" ? "text-red-700" : "text-emerald-800"
                }`}
              >
                {formMessage.text}
              </p>
            ) : null}

            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-tropicash-green px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-tropicash-green-hover disabled:opacity-60"
              >
                {submitting ? "Generating…" : "Generate API Key"}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      {/* Credentials table */}
      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="credentials-heading">
        <h2 id="credentials-heading" className="text-lg font-bold text-slate-900">
          Your credentials
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading…</p>
        ) : credentials.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">Key Name</th>
                  <th className="pb-2 pr-3 font-semibold">Environment</th>
                  <th className="pb-2 pr-3 font-semibold">Created</th>
                  <th className="pb-2 pr-3 font-semibold">Last Used</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((c) => {
                  const isActive = c.status === "active";
                  const busy = busyId === c.id;
                  return (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0 align-top">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-slate-900">{c.key_name}</div>
                        <code className="text-[0.7rem] text-slate-500">{c.public_key}</code>
                      </td>
                      <td className="py-2 pr-3">{environmentBadge(c.environment)}</td>
                      <td className="py-2 pr-3 text-slate-500">{formatWhen(c.created_at)}</td>
                      <td className="py-2 pr-3 text-slate-500">{formatWhen(c.last_used_at)}</td>
                      <td className="py-2 pr-3">{statusBadge(c.status)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <CopyButton value={c.public_key} label="Copy Public Key" />
                          <button
                            type="button"
                            disabled={!isActive || busy}
                            onClick={() => void handleRotate(c)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                          >
                            {busy ? "Working…" : "Rotate"}
                          </button>
                          <button
                            type="button"
                            disabled={!isActive || busy}
                            onClick={() => void handleRevoke(c)}
                            className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 shadow-sm hover:bg-red-100 disabled:opacity-50"
                          >
                            Revoke
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
            No API credentials yet. Generate a sandbox key above to get started.
          </p>
        )}
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/dev-console/my-apps" className="font-semibold text-tropicash-green-hover underline">
          My Apps
        </Link>
        {" · "}
        <Link
          href="/dev-console/credential-architecture"
          className="font-semibold text-tropicash-green-hover underline"
        >
          Credential Architecture
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
