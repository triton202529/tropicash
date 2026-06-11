import { useCallback, useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { useUser } from "../../lib/userContext";
import {
  fetchUserOAuthConsents,
  revokeOAuthConsent,
  formatConsentScopes,
  getConsentStatusBadge,
} from "../../lib/oauthConnectedApps";

const shellClass = "min-h-screen bg-slate-50 px-4 py-8";
const containerClass = "mx-auto w-full max-w-3xl";

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

function appLabel(consent) {
  if (consent.clientName) return consent.clientName;
  if (consent.clientPublicId) return consent.clientPublicId;
  return "Connected application";
}

function StatusBadge({ status }) {
  const { label, className } = getConsentStatusBadge(status);
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function ScopeChips({ scopes }) {
  const items = formatConsentScopes(scopes);
  if (!items.length) {
    return <span className="text-sm text-slate-400">No scopes</span>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item.scope}
          className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
          title={item.scope}
        >
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function ConsentCard({ consent, onRevoke, revoking, revoked }) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-slate-900">{appLabel(consent)}</h3>
            <StatusBadge status={consent.status} />
          </div>
          {consent.clientPublicId ? (
            <code className="mt-0.5 block text-xs text-slate-500">{consent.clientPublicId}</code>
          ) : null}
        </div>
        {!revoked ? (
          <button
            type="button"
            onClick={() => onRevoke(consent)}
            disabled={revoking}
            className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-800 shadow-sm hover:bg-red-100 disabled:opacity-60"
          >
            {revoking ? "Revoking…" : "Revoke access"}
          </button>
        ) : null}
      </div>

      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Access granted</p>
        <div className="mt-1">
          <ScopeChips scopes={consent.scopes} />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Granted</dt>
          <dd className="text-slate-700">{formatWhen(consent.grantedAt)}</dd>
        </div>
        {revoked ? (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revoked</dt>
            <dd className="text-slate-700">{formatWhen(consent.revokedAt)}</dd>
          </div>
        ) : null}
      </dl>
    </li>
  );
}

export default function OAuthConnectedAppsPage() {
  const { user, loading: authLoading } = useUser();
  const userId = user?.id ?? null;

  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [revokingId, setRevokingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: "", text: "" });

  const load = useCallback(async () => {
    if (!userId) {
      setConsents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    const { data, error } = await fetchUserOAuthConsents(userId);
    if (error) {
      setLoadError(error.message || "Could not load your connected apps.");
      setConsents([]);
    } else {
      setConsents(data || []);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!authLoading) void load();
  }, [authLoading, load]);

  const { active, revoked } = useMemo(() => {
    const a = [];
    const r = [];
    for (const c of consents) {
      if (c.status === "active") a.push(c);
      else r.push(c);
    }
    return { active: a, revoked: r };
  }, [consents]);

  const handleRevoke = useCallback(
    async (consent) => {
      if (!consent?.id || revokingId) return;
      if (
        typeof window !== "undefined" &&
        !window.confirm(
          "Revoking access will prevent this app from using your Tropicash account through OAuth. Continue?",
        )
      ) {
        return;
      }
      setRevokingId(consent.id);
      setFeedback({ type: "", text: "" });
      const { ok, error } = await revokeOAuthConsent(consent.id, userId);
      setRevokingId(null);
      if (!ok) {
        setFeedback({ type: "error", text: error || "Could not revoke access. Please try again." });
        return;
      }
      setFeedback({ type: "success", text: `Access for “${appLabel(consent)}” has been revoked.` });
      await load();
    },
    [revokingId, userId, load],
  );

  if (authLoading) {
    return (
      <>
        <Navbar />
        <main className={shellClass}>
          <div className={containerClass}>
            <p className="text-sm text-slate-600">Loading…</p>
          </div>
        </main>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <main className={shellClass}>
          <div className={containerClass}>
            <h1 className="text-xl font-bold text-slate-900">Connected apps</h1>
            <p className="mt-2 text-sm text-slate-600">Sign in to view and manage app access.</p>
            <Link href="/login" className="mt-3 inline-block text-sm font-semibold text-tropicash-green-hover underline">
              Go to login
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Connected apps · Tropicash</title>
        <meta name="robots" content="noindex" />
      </Head>
      <Navbar />
      <main className={shellClass}>
        <div className={containerClass}>
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-slate-900">Connected apps</h1>
            <p className="mt-1 text-sm text-slate-600">
              These third-party applications can access your Tropicash account through OAuth. You can
              revoke access at any time.
            </p>
          </div>

          {loadError ? (
            <p role="alert" className="mb-4 text-sm text-red-700">
              {loadError}
            </p>
          ) : null}

          {feedback.text ? (
            <p
              role={feedback.type === "error" ? "alert" : "status"}
              className={`mb-4 text-sm ${feedback.type === "error" ? "text-red-700" : "text-emerald-800"}`}
            >
              {feedback.text}
            </p>
          ) : null}

          {/* Active connected apps */}
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
              Active connected apps
            </h2>
            {loading ? (
              <p className="text-sm text-slate-600">Loading…</p>
            ) : active.length ? (
              <ul className="space-y-3">
                {active.map((c) => (
                  <ConsentCard
                    key={c.id}
                    consent={c}
                    onRevoke={handleRevoke}
                    revoking={revokingId === c.id}
                    revoked={false}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">
                You haven&apos;t granted any apps access to your account.
              </p>
            )}
          </section>

          {/* Revoked apps */}
          {revoked.length ? (
            <section>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                Revoked apps
              </h2>
              <ul className="space-y-3">
                {revoked.map((c) => (
                  <ConsentCard
                    key={c.id}
                    consent={c}
                    onRevoke={handleRevoke}
                    revoking={false}
                    revoked
                  />
                ))}
              </ul>
            </section>
          ) : null}

          <p className="mt-6 text-sm text-slate-600">
            <Link href="/security" className="font-semibold text-tropicash-green-hover underline">
              Security center
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
