import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import {
  fetchDeveloperApps,
  fetchDeveloperOrganizations,
} from "../../lib/developerApps";
import {
  createDeveloperWebhook,
  disableDeveloperWebhook,
  fetchDeveloperWebhooks,
  rotateDeveloperWebhookSecret,
} from "../../lib/developerWebhooks";

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
  const { secret, url } = result;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="webhook-secret-heading"
        className="tropicash-surface w-full max-w-lg rounded-2xl p-5 sm:p-6"
      >
        <h2 id="webhook-secret-heading" className="text-lg font-bold text-slate-900">
          Webhook secret
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {url ? (
            <>
              For <code className="text-xs">{url}</code>.
            </>
          ) : null}{" "}
          Use this secret to verify the <code className="text-xs">X-Tropicash-Signature</code> header.
        </p>

        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
          ⚠️ This webhook secret will only be shown once. Store it securely.
        </div>

        <div className="mt-4">
          <label className={labelClass}>Webhook Secret</label>
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

export default function DevConsoleWebhooksPage() {
  const { user, loading: authLoading } = useUser();
  const userId = user?.id ?? null;

  const [orgs, setOrgs] = useState([]);
  const [apps, setApps] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState({ type: "", text: "" });

  const [secretResult, setSecretResult] = useState(null);
  const [actionMessage, setActionMessage] = useState({ type: "", text: "" });
  const [busyId, setBusyId] = useState(null);

  // Sandbox API secret used to authenticate test deliveries (kept in memory only).
  const [testApiKey, setTestApiKey] = useState("");

  const load = useCallback(async () => {
    if (!userId) {
      setOrgs([]);
      setApps([]);
      setWebhooks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    const [oRes, aRes, wRes] = await Promise.all([
      fetchDeveloperOrganizations(userId),
      fetchDeveloperApps(userId),
      fetchDeveloperWebhooks(userId),
    ]);
    const parts = [];
    if (oRes.error) parts.push(oRes.error.message || "Could not load organizations.");
    if (aRes.error) parts.push(aRes.error.message || "Could not load apps.");
    if (wRes.error) parts.push(wRes.error.message || "Could not load webhooks.");
    setLoadError(parts.join(" "));
    setOrgs(oRes.error ? [] : oRes.data || []);
    setApps(aRes.error ? [] : aRes.data || []);
    setWebhooks(wRes.error ? [] : wRes.data || []);
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
    setSelectedAppId((prev) => (prev && apps.some((a) => a.id === prev) ? prev : apps[0].id));
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
    const { data, secret, error } = await createDeveloperWebhook({
      organization_id: app.organization_id,
      app_id: app.id,
      url,
      created_by: userId,
    });
    setSubmitting(false);
    if (error) {
      setFormMessage({ type: "error", text: error.message || "Could not create webhook." });
      return;
    }
    setSecretResult({ secret, url: data.url });
    setUrl("");
    setShowForm(false);
    void load();
  };

  const handleRotate = async (webhook) => {
    setActionMessage({ type: "", text: "" });
    if (!webhook?.id) return;
    setBusyId(webhook.id);
    const { data, secret, error } = await rotateDeveloperWebhookSecret(webhook.id);
    setBusyId(null);
    if (error) {
      setActionMessage({ type: "error", text: error.message || "Could not rotate secret." });
      return;
    }
    setSecretResult({ secret, url: data?.url });
    void load();
  };

  const handleDisable = async (webhook) => {
    setActionMessage({ type: "", text: "" });
    if (!webhook?.id) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Disable this webhook? It will stop receiving events.`)
    ) {
      return;
    }
    setBusyId(webhook.id);
    const { error } = await disableDeveloperWebhook(webhook.id);
    setBusyId(null);
    if (error) {
      setActionMessage({ type: "error", text: error.message || "Could not disable webhook." });
      return;
    }
    setActionMessage({ type: "success", text: "Webhook disabled." });
    void load();
  };

  const handleTestDelivery = async (webhook) => {
    setActionMessage({ type: "", text: "" });
    if (!webhook?.id) return;
    if (!testApiKey.trim()) {
      setActionMessage({
        type: "error",
        text: "Enter a sandbox API key above to send test deliveries.",
      });
      return;
    }
    setBusyId(webhook.id);
    try {
      const resp = await fetch("/api/developer/test-webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${testApiKey.trim()}`,
        },
        body: JSON.stringify({ webhook_id: webhook.id }),
      });
      const json = await resp.json().catch(() => ({}));
      if (resp.ok && json.ok) {
        setActionMessage({
          type: "success",
          text: `Test event sent (endpoint responded ${json.status ?? "200"}).`,
        });
      } else if (resp.status === 401) {
        setActionMessage({ type: "error", text: "Test delivery rejected: invalid API key." });
      } else if (resp.status === 429) {
        setActionMessage({ type: "error", text: "Rate limit exceeded. Try again later." });
      } else {
        setActionMessage({ type: "error", text: json.error || "Webhook test failed." });
      }
    } catch {
      setActionMessage({ type: "error", text: "Webhook test failed." });
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading) {
    return (
      <DevConsoleLayout title="Webhooks" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout title="Webhooks" subtitle="Sign in to manage webhook endpoints.">
        <p className="text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-tropicash-green-hover underline">
            Go to login
          </Link>
        </p>
      </DevConsoleLayout>
    );
  }

  const hasApps = apps.length > 0;

  return (
    <DevConsoleLayout
      title="Webhooks"
      subtitle="Register endpoints to receive signed Tropicash events. Secrets are shown once and stored only as SHA-256 hashes."
    >
      <OneTimeSecretModal result={secretResult} onClose={() => setSecretResult(null)} />

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="signing-heading">
        <h2 id="signing-heading" className="text-lg font-bold text-slate-900">
          Signed deliveries
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Every delivery is signed with HMAC-SHA256. Verify the{" "}
          <code className="rounded bg-slate-100 px-1">X-Tropicash-Signature</code> header against the{" "}
          <code className="rounded bg-slate-100 px-1">X-Tropicash-Timestamp</code> and the raw request
          body. No real payment or wallet events are emitted in this phase — only{" "}
          <code className="rounded bg-slate-100 px-1">developer.test</code> events.
        </p>
        <div className="mt-4">
          <label htmlFor="test_api_key" className={labelClass}>
            Sandbox API key (for test deliveries)
          </label>
          <input
            id="test_api_key"
            type="password"
            autoComplete="off"
            value={testApiKey}
            onChange={(e) => setTestApiKey(e.target.value)}
            placeholder="tc_test_…"
            className={`${inputClass} max-w-md`}
          />
          <p className="mt-1 text-xs text-slate-500">
            Held in memory only. Test deliveries authenticate with this sandbox key via the Developer
            API. Generate one under{" "}
            <Link href="/dev-console/credentials" className="font-semibold text-tropicash-green-hover underline">
              API Credentials
            </Link>
            .
          </p>
        </div>
      </section>

      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}{" "}
          <span className="text-slate-600">
            Run{" "}
            <code className="rounded bg-slate-100 px-1">
              supabase/sql/developer_webhooks_phase12d.sql
            </code>{" "}
            if the webhooks table is missing.
          </span>
        </p>
      ) : null}

      {actionMessage.text ? (
        <p
          role={actionMessage.type === "error" ? "alert" : "status"}
          className={actionMessage.type === "error" ? "text-sm text-red-700" : "text-sm text-emerald-800"}
        >
          {actionMessage.text}
        </p>
      ) : null}

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="create-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="create-heading" className="text-lg font-bold text-slate-900">
              Create Webhook
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Register an HTTPS endpoint for one of your applications.
            </p>
          </div>
          {hasApps ? (
            <button
              type="button"
              onClick={() => {
                setShowForm((v) => !v);
                setFormMessage({ type: "", text: "" });
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              {showForm ? "Cancel" : "Create Webhook"}
            </button>
          ) : null}
        </div>

        {!hasApps ? (
          <p className="mt-3 text-sm text-slate-600">
            You need a registered app first.{" "}
            <Link href="/dev-console/apps-register" className="font-semibold text-tropicash-green-hover underline">
              Register an app
            </Link>
            .
          </p>
        ) : null}

        {showForm && hasApps ? (
          <form onSubmit={handleCreate} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div>
              <label htmlFor="webhook_url" className={labelClass}>
                Endpoint URL
              </label>
              <input
                id="webhook_url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/webhooks/tropicash"
                className={inputClass}
                required
              />
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
                {submitting ? "Creating…" : "Create Webhook"}
              </button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="endpoints-heading">
        <h2 id="endpoints-heading" className="text-lg font-bold text-slate-900">
          Webhook endpoints
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading…</p>
        ) : webhooks.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">App</th>
                  <th className="pb-2 pr-3 font-semibold">URL</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 pr-3 font-semibold">Created</th>
                  <th className="pb-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((w) => {
                  const isActive = w.status === "active";
                  const busy = busyId === w.id;
                  const app = appById[w.app_id];
                  return (
                    <tr key={w.id} className="border-b border-slate-100 last:border-0 align-top">
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {app ? app.app_name : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <code className="text-xs text-slate-700">{w.url}</code>
                      </td>
                      <td className="py-2 pr-3">{statusBadge(w.status)}</td>
                      <td className="py-2 pr-3 text-slate-500">{formatWhen(w.created_at)}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={!isActive || busy}
                            onClick={() => void handleTestDelivery(w)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                          >
                            {busy ? "Working…" : "Test Delivery"}
                          </button>
                          <button
                            type="button"
                            disabled={!isActive || busy}
                            onClick={() => void handleRotate(w)}
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                          >
                            Rotate Secret
                          </button>
                          <button
                            type="button"
                            disabled={!isActive || busy}
                            onClick={() => void handleDisable(w)}
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
            No webhook endpoints yet. Create one above to start receiving signed events.
          </p>
        )}
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/dev-console/credentials" className="font-semibold text-tropicash-green-hover underline">
          API Credentials
        </Link>
        {" · "}
        <Link href="/dev-console/usage" className="font-semibold text-tropicash-green-hover underline">
          API Usage
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
