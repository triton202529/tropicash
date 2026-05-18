import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import {
  fetchDeveloperApps,
  fetchDeveloperOrganizations,
} from "../../lib/developerApps";
import {
  fetchAppCapabilities,
  fetchAppCapabilityRequests,
} from "../../lib/developerCapabilities";
import {
  createDeveloperAppReview,
  fetchDeveloperAppReviews,
  fetchDeveloperLifecycleEvents,
  fetchPendingReviewForApp,
} from "../../lib/developerGovernance";

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
    pending: "border-amber-200 bg-amber-50 text-amber-950",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rejected: "border-red-200 bg-red-50 text-red-900",
    needs_changes: "border-sky-200 bg-sky-50 text-sky-900",
    cancelled: "border-slate-200 bg-slate-100 text-slate-700",
    draft: "border-slate-200 bg-slate-50 text-slate-700",
    pending_review: "border-amber-200 bg-amber-50 text-amber-950",
    sandbox_active: "border-emerald-200 bg-emerald-50 text-emerald-900",
    live_pending: "border-violet-200 bg-violet-50 text-violet-900",
    live_active: "border-emerald-300 bg-emerald-100 text-emerald-950",
    suspended: "border-red-200 bg-red-50 text-red-900",
    archived: "border-slate-200 bg-slate-100 text-slate-600",
  };
  const cls = map[s] || "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status || "—"}
    </span>
  );
}

function eligibilityNotice(app, pendingSandbox) {
  const status = app?.status;
  if (pendingSandbox) {
    return "Sandbox activation review is pending admin decision.";
  }
  if (status === "draft" || status === "pending_review") {
    return "Eligible to request sandbox activation once your app metadata is complete.";
  }
  if (status === "live_active") {
    return "Live-labelled in metadata only — no production credentials or traffic in this repository phase.";
  }
  if (status === "archived") {
    return "This app is archived. Open a new sandbox app if you need a fresh record.";
  }
  if (status === "sandbox_active") {
    return "Sandbox active. Live API access is not enabled in this phase — live requests require admin approval and stay at live_pending.";
  }
  if (status === "live_pending") {
    return "Live access is pending further governance (no live credentials issued yet).";
  }
  if (status === "suspended") {
    return "App is suspended. Contact support or request reactivation when available.";
  }
  return "Track governance status below; API keys and webhooks are not available in this phase.";
}

export default function DevConsoleMyAppsPage() {
  const { user, loading: authLoading } = useUser();
  const userId = user?.id ?? null;

  const [orgs, setOrgs] = useState([]);
  const [apps, setApps] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [lifecycle, setLifecycle] = useState([]);
  const [pendingByApp, setPendingByApp] = useState({});
  const [capabilities, setCapabilities] = useState([]);
  const [capabilityRequests, setCapabilityRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [requestingAppId, setRequestingAppId] = useState(null);
  const [actionMessage, setActionMessage] = useState({ type: "", text: "" });

  const load = useCallback(async () => {
    if (!userId) {
      setOrgs([]);
      setApps([]);
      setReviews([]);
      setLifecycle([]);
      setPendingByApp({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    const [oRes, aRes, rRes, lRes, capRes, capReqRes] = await Promise.all([
      fetchDeveloperOrganizations(userId),
      fetchDeveloperApps(userId),
      fetchDeveloperAppReviews(userId),
      fetchDeveloperLifecycleEvents(userId),
      fetchAppCapabilities(userId),
      fetchAppCapabilityRequests(userId),
    ]);
    const parts = [];
    if (oRes.error) parts.push(oRes.error.message || "Could not load organizations.");
    if (aRes.error) parts.push(aRes.error.message || "Could not load apps.");
    if (rRes.error) parts.push(rRes.error.message || "Could not load reviews.");
    if (lRes.error) parts.push(lRes.error.message || "Could not load lifecycle.");
    if (capRes.error) parts.push(capRes.error.message || "Could not load capabilities.");
    if (capReqRes.error) parts.push(capReqRes.error.message || "Could not load capability requests.");
    setLoadError(parts.join(" "));
    const appList = aRes.error ? [] : aRes.data || [];
    setOrgs(oRes.error ? [] : oRes.data || []);
    setApps(appList);
    setReviews(rRes.error ? [] : rRes.data || []);
    setLifecycle(lRes.error ? [] : lRes.data || []);
    setCapabilities(capRes.error ? [] : capRes.data || []);
    setCapabilityRequests(capReqRes.error ? [] : capReqRes.data || []);

    const pendingMap = {};
    await Promise.all(
      appList.map(async (app) => {
        const pending = await fetchPendingReviewForApp(app.id, "sandbox_activation");
        if (pending) pendingMap[app.id] = pending;
      }),
    );
    setPendingByApp(pendingMap);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const orgNameById = useMemo(
    () => Object.fromEntries((orgs || []).map((o) => [o.id, o.organization_name])),
    [orgs],
  );

  const reviewsByAppId = useMemo(() => {
    const map = {};
    for (const r of reviews || []) {
      if (!map[r.app_id]) map[r.app_id] = [];
      map[r.app_id].push(r);
    }
    return map;
  }, [reviews]);

  const assignedCountByAppId = useMemo(() => {
    const map = {};
    for (const c of capabilities || []) {
      if (c.status === "assigned") {
        map[c.app_id] = (map[c.app_id] || 0) + 1;
      }
    }
    return map;
  }, [capabilities]);

  const pendingCapCountByAppId = useMemo(() => {
    const map = {};
    for (const r of capabilityRequests || []) {
      if (r.status === "pending") {
        map[r.app_id] = (map[r.app_id] || 0) + 1;
      }
    }
    return map;
  }, [capabilityRequests]);

  const handleRequestSandbox = async (app) => {
    setActionMessage({ type: "", text: "" });
    if (!userId || !app?.id) return;
    if (pendingByApp[app.id]) {
      setActionMessage({ type: "error", text: "A sandbox activation review is already pending." });
      return;
    }
    if (["sandbox_active", "live_pending", "live_active", "suspended", "archived"].includes(String(app.status))) {
      setActionMessage({ type: "error", text: "This app is already past sandbox activation." });
      return;
    }

    setRequestingAppId(app.id);
    const { data, error } = await createDeveloperAppReview({
      app_id: app.id,
      organization_id: app.organization_id,
      requested_by_user_id: userId,
      review_type: "sandbox_activation",
      requested_environment: "sandbox",
    });
    setRequestingAppId(null);

    if (error) {
      setActionMessage({
        type: "error",
        text: error.message || "Could not submit review request.",
      });
      return;
    }
    setActionMessage({
      type: "success",
      text: `Sandbox activation requested for “${app.app_name}”. An admin will review it.`,
    });
    void load();
    if (data) {
      setPendingByApp((prev) => ({ ...prev, [app.id]: data }));
    }
  };

  if (authLoading) {
    return (
      <DevConsoleLayout title="My Apps" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout title="My Apps" subtitle="Sign in to view your developer apps.">
        <p className="text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-emerald-700 underline">
            Go to login
          </Link>
        </p>
      </DevConsoleLayout>
    );
  }

  return (
    <DevConsoleLayout
      title="My Apps"
      subtitle="Organizations, app statuses, governance reviews, and lifecycle history. No API keys or live execution in this phase."
    >
      <div
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        <strong className="font-semibold">Governance only.</strong> You can register apps and request
        sandbox activation. Admins approve status transitions; credentials, webhooks, and payment APIs
        are not enabled here.
      </div>

      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}{" "}
          <span className="text-slate-600">
            Run{" "}
            <code className="rounded bg-slate-100 px-1">
              supabase/sql/developer_app_governance_phase4b.sql
            </code>{" "}
            and{" "}
            <code className="rounded bg-slate-100 px-1">
              supabase/sql/developer_app_capabilities_phase4c.sql
            </code>{" "}
            if governance or capability tables are missing.
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

      <section
        className="tropicash-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="credential-readiness-heading"
      >
        <h2 id="credential-readiness-heading" className="text-lg font-bold text-slate-900">
          Credential readiness (Phase 5A — conceptual)
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Future API keys will not be self-issued from the console. Issuance stays an{" "}
          <strong className="font-semibold text-slate-800">admin-governed</strong> workflow backed by
          metadata rows, vault handles, and lifecycle events — not plaintext in Supabase.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
          <li>
            <strong className="font-semibold text-slate-800">Eligibility (illustrative):</strong>{" "}
            organization approved, app at least <code className="text-xs">sandbox_active</code> for
            sandbox-class keys in future phases, no open suspension, and capability assignments aligned
            with the Product Catalog vocabulary.
          </li>
          <li>
            <strong className="font-semibold text-slate-800">Review requirements:</strong> sandbox
            activation and capability reviews (above) precede any imagined key program; live keys remain
            blocked until additional governance phases beyond this repository snapshot.
          </li>
          <li>
            <strong className="font-semibold text-slate-800">What you see today:</strong> static
            architecture copy only — no credential rows are queried here.
          </li>
        </ul>
        <div className="mt-4">
          <Link
            href="/dev-console/credential-architecture"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🔐 Read Credential Architecture
          </Link>
        </div>
      </section>

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="orgs-heading">
        <h2 id="orgs-heading" className="text-lg font-bold text-slate-900">
          Organizations
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading…</p>
        ) : orgs.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">Name</th>
                  <th className="pb-2 pr-3 font-semibold">Type</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-900">{o.organization_name}</td>
                    <td className="py-2 pr-3 text-slate-600">{o.organization_type}</td>
                    <td className="py-2 pr-3">{statusBadge(o.status)}</td>
                    <td className="py-2 text-slate-500">{formatWhen(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No organizations yet.{" "}
            <Link href="/dev-console/apps-register" className="font-semibold text-emerald-700 underline">
              Register an app
            </Link>
            .
          </p>
        )}
      </section>

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="apps-heading">
        <h2 id="apps-heading" className="text-lg font-bold text-slate-900">
          Apps &amp; governance
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading…</p>
        ) : apps.length ? (
          <div className="mt-4 space-y-4">
            {apps.map((app) => {
              const pending = pendingByApp[app.id];
              const appReviews = reviewsByAppId[app.id] || [];
              const latestReview = appReviews[0];
              const canRequestSandbox =
                !pending &&
                ["draft", "pending_review"].includes(String(app.status)) &&
                app.environment === "sandbox";
              const assignedCount = assignedCountByAppId[app.id] || 0;
              const pendingCapCount = pendingCapCountByAppId[app.id] || 0;

              return (
                <article
                  key={app.id}
                  className="rounded-xl border border-slate-200 bg-white/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900">{app.app_name}</h3>
                      <p className="mt-0.5 text-sm text-slate-600">
                        {orgNameById[app.organization_id] || "—"} ·{" "}
                        <code className="text-xs">{app.app_slug}</code> · {app.environment}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {statusBadge(app.status)}
                      {pending ? statusBadge("pending") : null}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{eligibilityNotice(app, pending)}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    Capabilities: {assignedCount} assigned
                    {pendingCapCount
                      ? ` · ${pendingCapCount} pending request${pendingCapCount === 1 ? "" : "s"}`
                      : ""}
                    .{" "}
                    <Link
                      href="/dev-console/app-capabilities"
                      className="font-semibold text-emerald-700 underline"
                    >
                      Manage capabilities
                    </Link>
                  </p>
                  {latestReview ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Latest review: {latestReview.review_type} — {latestReview.status}
                      {latestReview.reviewed_at
                        ? ` (${formatWhen(latestReview.reviewed_at)})`
                        : ""}
                    </p>
                  ) : null}
                  {canRequestSandbox ? (
                    <button
                      type="button"
                      className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                      disabled={requestingAppId === app.id}
                      onClick={() => void handleRequestSandbox(app)}
                    >
                      {requestingAppId === app.id ? "Submitting…" : "Request sandbox activation"}
                    </button>
                  ) : pending ? (
                    <p className="mt-3 text-sm font-medium text-amber-900">
                      Sandbox activation review pending since {formatWhen(pending.created_at)}.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            No apps yet.{" "}
            <Link href="/dev-console/apps-register" className="font-semibold text-emerald-700 underline">
              Create a sandbox app
            </Link>
            .
          </p>
        )}
      </section>

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="reviews-heading">
        <h2 id="reviews-heading" className="text-lg font-bold text-slate-900">
          Review history
        </h2>
        {reviews.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">Type</th>
                  <th className="pb-2 pr-3 font-semibold">Environment</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 text-slate-800">{r.review_type}</td>
                    <td className="py-2 pr-3 text-slate-600">{r.requested_environment}</td>
                    <td className="py-2 pr-3">{statusBadge(r.status)}</td>
                    <td className="py-2 text-slate-500">{formatWhen(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No review requests yet.</p>
        )}
      </section>

      <section
        className="tropicash-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="lifecycle-heading"
      >
        <h2 id="lifecycle-heading" className="text-lg font-bold text-slate-900">
          Lifecycle history
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Admin-recorded status transitions appear here after decisions.
        </p>
        {lifecycle.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">When</th>
                  <th className="pb-2 pr-3 font-semibold">Event</th>
                  <th className="pb-2 pr-3 font-semibold">Transition</th>
                  <th className="pb-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {lifecycle.map((ev) => (
                  <tr key={ev.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 text-slate-500">{formatWhen(ev.created_at)}</td>
                    <td className="py-2 pr-3 font-medium text-slate-900">{ev.event_type}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {ev.previous_status || "—"} → {ev.new_status || "—"}
                    </td>
                    <td className="py-2 text-slate-600">{ev.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No lifecycle events yet.</p>
        )}
      </section>

      <section
        className="tropicash-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="catalog-shortcut-heading"
      >
        <h2 id="catalog-shortcut-heading" className="text-lg font-bold text-slate-900">
          Product catalog (Phase 4D)
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Static documentation that ties sandbox capabilities to illustrative API products and
          sandbox runtime contracts — configuration only, no HTTP traffic.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dev-console/app-capabilities"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🧬 App Capabilities
          </Link>
          <Link
            href="/dev-console/product-catalog"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            📚 Open Product Catalog
          </Link>
          <Link
            href="/dev-console/sandbox-analytics"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            📈 Sandbox Analytics (Phase 4E)
          </Link>
        </div>
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/dev-console/apps-register" className="font-semibold text-emerald-700 underline">
          Register another app
        </Link>
        {" · "}
        <Link href="/dev-console/apps" className="font-semibold text-emerald-700 underline">
          Apps overview
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
