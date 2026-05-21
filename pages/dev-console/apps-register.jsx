import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import {
  createDeveloperApp,
  createDeveloperOrganization,
  fetchDeveloperApps,
  fetchDeveloperOrganizations,
  slugifyAppName,
} from "../../lib/developerApps";
import {
  createDeveloperAppReview,
  fetchDeveloperAppReviews,
  fetchPendingReviewForApp,
} from "../../lib/developerGovernance";

const labelClass = "mb-1 block text-sm font-semibold text-slate-700";
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2";
const selectClass = inputClass;

const ORG_TYPE_OPTIONS = [
  { value: "individual", label: "Individual" },
  { value: "business", label: "Business" },
  { value: "platform", label: "Platform" },
  { value: "internal", label: "Internal" },
];

const APP_TYPE_OPTIONS = [
  { value: "web", label: "Web" },
  { value: "mobile", label: "Mobile" },
  { value: "server", label: "Server" },
  { value: "internal", label: "Internal" },
  { value: "other", label: "Other" },
];

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

export default function DevConsoleAppsRegisterPage() {
  const { user, loading: authLoading } = useUser();
  const userId = user?.id ?? null;

  const [orgs, setOrgs] = useState([]);
  const [apps, setApps] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("business");
  const [orgWebsite, setOrgWebsite] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [orgSubmitting, setOrgSubmitting] = useState(false);
  const [orgMessage, setOrgMessage] = useState({ type: "", text: "" });

  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [appName, setAppName] = useState("");
  const [appType, setAppType] = useState("web");
  const [appRedirect, setAppRedirect] = useState("");
  const [appDescription, setAppDescription] = useState("");
  const [appSubmitting, setAppSubmitting] = useState(false);
  const [appMessage, setAppMessage] = useState({ type: "", text: "" });
  const [pendingByApp, setPendingByApp] = useState({});
  const [requestingAppId, setRequestingAppId] = useState(null);
  const [reviewMessage, setReviewMessage] = useState({ type: "", text: "" });

  const loadLists = useCallback(async () => {
    if (!userId) {
      setOrgs([]);
      setApps([]);
      setListLoading(false);
      return;
    }
    setListLoading(true);
    setListError("");
    const [oRes, aRes, rRes] = await Promise.all([
      fetchDeveloperOrganizations(userId),
      fetchDeveloperApps(userId),
      fetchDeveloperAppReviews(userId),
    ]);
    const parts = [];
    if (oRes.error) parts.push(oRes.error.message || "Could not load organizations.");
    if (aRes.error) parts.push(aRes.error.message || "Could not load apps.");
    if (rRes.error) parts.push(rRes.error.message || "Could not load reviews.");
    setListError(parts.length ? parts.join(" ") : "");
    const appList = aRes.error ? [] : aRes.data || [];
    setOrgs(oRes.error ? [] : oRes.data || []);
    setApps(appList);
    const pendingMap = {};
    await Promise.all(
      appList.map(async (app) => {
        const pending = await fetchPendingReviewForApp(app.id, "sandbox_activation");
        if (pending) pendingMap[app.id] = pending;
      }),
    );
    setPendingByApp(pendingMap);
    setListLoading(false);
  }, [userId]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (!orgs.length) {
      setSelectedOrgId("");
      return;
    }
    setSelectedOrgId((prev) => {
      if (prev && orgs.some((o) => o.id === prev)) return prev;
      return orgs[0].id;
    });
  }, [orgs]);

  const canSubmitApp = orgs.length > 0 && selectedOrgId;

  const orgRows = useMemo(
    () =>
      (orgs || []).map((o) => (
        <tr key={o.id} className="border-b border-slate-100 last:border-0">
          <td className="py-2 pr-3 font-medium text-slate-900">{o.organization_name}</td>
          <td className="py-2 pr-3 text-slate-600">{o.organization_type}</td>
          <td className="py-2 pr-3 text-slate-600">{o.status}</td>
          <td className="py-2 text-slate-500">{formatWhen(o.created_at)}</td>
        </tr>
      )),
    [orgs],
  );

  const handleRequestSandbox = useCallback(
    async (app) => {
      setReviewMessage({ type: "", text: "" });
      if (!userId || !app?.id) return;
      if (pendingByApp[app.id]) {
        setReviewMessage({ type: "error", text: "Sandbox activation review is already pending." });
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
        console.log("[governance-debug] apps-register sandbox activation failed", {
          app_id: app.id,
          message: error.message,
        });
        setReviewMessage({
          type: "error",
          text: error.message || "Could not submit sandbox activation request.",
        });
        return;
      }
      console.log("[governance-debug] apps-register sandbox activation submitted", {
        review_id: data?.id,
        status: data?.status,
        review_type: data?.review_type,
        app_id: data?.app_id,
      });
      setReviewMessage({
        type: "success",
        text: `Sandbox activation requested for “${app.app_name}”.`,
      });
      if (data) setPendingByApp((prev) => ({ ...prev, [app.id]: data }));
      void loadLists();
    },
    [userId, pendingByApp, loadLists],
  );

  const appRows = useMemo(() => {
    const orgNameById = Object.fromEntries((orgs || []).map((o) => [o.id, o.organization_name]));
    return (apps || []).map((a) => {
      const pending = pendingByApp[a.id];
      const canRequest =
        !pending &&
        ["draft", "pending_review"].includes(String(a.status)) &&
        a.environment === "sandbox";
      return (
        <tr key={a.id} className="border-b border-slate-100 last:border-0">
          <td className="py-2 pr-3 font-medium text-slate-900">{a.app_name}</td>
          <td className="py-2 pr-3 text-slate-600">{orgNameById[a.organization_id] || "—"}</td>
          <td className="py-2 pr-3 text-slate-600">
            <code className="text-xs">{a.app_slug}</code>
          </td>
          <td className="py-2 pr-3 text-slate-600">{a.environment}</td>
          <td className="py-2 pr-3 text-slate-600">
            <span>{a.status}</span>
            {pending ? (
              <span className="ml-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-950">
                review pending
              </span>
            ) : null}
          </td>
          <td className="py-2 pr-3">
            {canRequest ? (
              <button
                type="button"
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                disabled={requestingAppId === a.id}
                onClick={() => void handleRequestSandbox(a)}
              >
                {requestingAppId === a.id ? "…" : "Request sandbox activation"}
              </button>
            ) : pending ? (
              <span className="text-xs text-amber-900">Pending review</span>
            ) : (
              <span className="text-xs text-slate-400">—</span>
            )}
          </td>
          <td className="py-2 text-slate-500">{formatWhen(a.created_at)}</td>
        </tr>
      );
    });
  }, [apps, orgs, pendingByApp, requestingAppId, handleRequestSandbox]);

  const handleCreateOrg = async (e) => {
    e.preventDefault();
    setOrgMessage({ type: "", text: "" });
    if (!userId) return;

    const name = orgName.trim();
    if (!name) {
      setOrgMessage({ type: "error", text: "Organization name is required." });
      return;
    }

    setOrgSubmitting(true);
    const { data, error } = await createDeveloperOrganization({
      owner_user_id: userId,
      organization_name: name,
      organization_type: orgType,
      website_url: orgWebsite.trim() || null,
      contact_email: orgEmail.trim() || null,
      description: orgDescription.trim() || null,
    });
    setOrgSubmitting(false);

    if (error) {
      setOrgMessage({
        type: "error",
        text: error.message || "Could not create organization.",
      });
      return;
    }

    setOrgMessage({
      type: "success",
      text: `Organization “${data?.organization_name || name}” saved (status: ${data?.status || "pending_review"}).`,
    });
    setOrgName("");
    setOrgWebsite("");
    setOrgEmail("");
    setOrgDescription("");
    setOrgType("business");
    void loadLists();
  };

  const handleCreateApp = async (e) => {
    e.preventDefault();
    setAppMessage({ type: "", text: "" });
    if (!userId || !selectedOrgId) {
      setAppMessage({
        type: "error",
        text: "Select an organization first (create one above if you have none).",
      });
      return;
    }

    const name = appName.trim();
    if (!name) {
      setAppMessage({ type: "error", text: "App name is required." });
      return;
    }

    const slug = slugifyAppName(name);

    setAppSubmitting(true);
    const { data, error } = await createDeveloperApp({
      organization_id: selectedOrgId,
      owner_user_id: userId,
      app_name: name,
      app_slug: slug,
      environment: "sandbox",
      app_type: appType,
      description: appDescription.trim() || null,
      redirect_url: appRedirect.trim() || null,
    });
    setAppSubmitting(false);

    if (error) {
      setAppMessage({
        type: "error",
        text: error.message || "Could not create app record.",
      });
      return;
    }

    setAppMessage({
      type: "success",
      text: `Sandbox app “${data?.app_name || name}” saved as draft (slug: ${data?.app_slug || slug}). API keys are not issued in this phase.`,
    });
    setAppName("");
    setAppRedirect("");
    setAppDescription("");
    setAppType("web");
    void loadLists();
  };

  if (authLoading) {
    return (
      <DevConsoleLayout title="Register Developer App" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout
        title="Register Developer App"
        subtitle="Sign in to register a sandbox developer organization and app record."
      >
        <p className="text-sm text-slate-600">
          You need an account session to use this page.{" "}
          <Link href="/login" className="font-semibold text-tropicash-green-hover underline">
            Go to login
          </Link>
          .
        </p>
      </DevConsoleLayout>
    );
  }

  return (
    <DevConsoleLayout
      title="Register Developer App"
      subtitle="Create developer organization and sandbox app rows in Supabase. This is registration metadata only: no API keys, no secrets, and no live API traffic."
    >
      <div
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        <strong className="font-semibold">Sandbox metadata only.</strong> Records default to draft /
        pending_review states. API keys are not issued yet, webhook and execution surfaces stay out of
        scope, and nothing here moves money or calls payment APIs.
      </div>

      {listError ? (
        <p className="text-sm text-red-700" role="alert">
          {listError}{" "}
          <span className="text-slate-600">
            If the database migration is not applied yet, run{" "}
            <code className="rounded bg-slate-100 px-1">supabase/sql/developer_orgs_phase4a.sql</code>.
          </span>
        </p>
      ) : null}

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="org-form-heading">
        <h2 id="org-form-heading" className="text-lg font-bold text-slate-900">
          1. Developer organization
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Each organization is owned by your account. Admins may update approval status out of band.
        </p>
        <form className="mt-4 space-y-4" onSubmit={handleCreateOrg}>
          <div>
            <label className={labelClass} htmlFor="org-name">
              Organization name
            </label>
            <input
              id="org-name"
              className={inputClass}
              value={orgName}
              onChange={(ev) => setOrgName(ev.target.value)}
              autoComplete="organization"
              required
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="org-type">
              Organization type
            </label>
            <select
              id="org-type"
              className={selectClass}
              value={orgType}
              onChange={(ev) => setOrgType(ev.target.value)}
            >
              {ORG_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="org-website">
              Website URL <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="org-website"
              className={inputClass}
              value={orgWebsite}
              onChange={(ev) => setOrgWebsite(ev.target.value)}
              inputMode="url"
              placeholder="https://"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="org-email">
              Contact email <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="org-email"
              className={inputClass}
              type="email"
              value={orgEmail}
              onChange={(ev) => setOrgEmail(ev.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="org-desc">
              Description <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <textarea
              id="org-desc"
              className={inputClass}
              rows={3}
              value={orgDescription}
              onChange={(ev) => setOrgDescription(ev.target.value)}
            />
          </div>
          {orgMessage.text ? (
            <p
              role={orgMessage.type === "error" ? "alert" : "status"}
              className={
                orgMessage.type === "error" ? "text-sm text-red-700" : "text-sm text-emerald-800"
              }
            >
              {orgMessage.text}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={orgSubmitting}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-60"
          >
            {orgSubmitting ? "Saving…" : "Create organization"}
          </button>
        </form>
      </section>

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="app-form-heading">
        <h2 id="app-form-heading" className="text-lg font-bold text-slate-900">
          2. Sandbox app record
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Apps are stored per organization. Slug is generated from the app name on submit. Environment is
          sandbox-only in Phase 4A; status defaults to <code className="text-xs">draft</code>.
        </p>

        {!orgs.length ? (
          <p className="mt-4 text-sm font-medium text-slate-700">
            Create an organization above before registering an app.
          </p>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={handleCreateApp}>
            <div>
              <label className={labelClass} htmlFor="app-org">
                Organization
              </label>
              <select
                id="app-org"
                className={selectClass}
                value={selectedOrgId}
                onChange={(ev) => setSelectedOrgId(ev.target.value)}
                required
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.organization_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="app-name">
                App name
              </label>
              <input
                id="app-name"
                className={inputClass}
                value={appName}
                onChange={(ev) => setAppName(ev.target.value)}
                required
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="app-type">
                App type
              </label>
              <select
                id="app-type"
                className={selectClass}
                value={appType}
                onChange={(ev) => setAppType(ev.target.value)}
              >
                {APP_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="app-env">
                Environment
              </label>
              <input
                id="app-env"
                className={`${inputClass} bg-slate-50 text-slate-600`}
                value="sandbox"
                readOnly
                aria-readonly="true"
              />
              <p className="mt-1 text-xs text-slate-500">Live environment registration is not enabled in this phase.</p>
            </div>
            <div>
              <label className={labelClass} htmlFor="app-redirect">
                Redirect URL <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <input
                id="app-redirect"
                className={inputClass}
                value={appRedirect}
                onChange={(ev) => setAppRedirect(ev.target.value)}
                placeholder="https://yourapp.example/oauth/callback"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="app-desc">
                Description <span className="font-normal text-slate-500">(optional)</span>
              </label>
              <textarea
                id="app-desc"
                className={inputClass}
                rows={3}
                value={appDescription}
                onChange={(ev) => setAppDescription(ev.target.value)}
              />
            </div>
            {appMessage.text ? (
              <p
                role={appMessage.type === "error" ? "alert" : "status"}
                className={
                  appMessage.type === "error" ? "text-sm text-red-700" : "text-sm text-emerald-800"
                }
              >
                {appMessage.text}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={appSubmitting || !canSubmitApp}
              className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-60"
            >
              {appSubmitting ? "Saving…" : "Create sandbox app"}
            </button>
          </form>
        )}
      </section>

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="lists-heading">
        <h2 id="lists-heading" className="text-lg font-bold text-slate-900">
          3. Your organizations &amp; apps
        </h2>
        {listLoading ? (
          <p className="mt-3 text-sm text-slate-600">Loading…</p>
        ) : (
          <>
            <h3 className="mt-4 text-sm font-semibold text-slate-800">Organizations</h3>
            {orgs.length ? (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2 pr-3 font-semibold">Name</th>
                      <th className="pb-2 pr-3 font-semibold">Type</th>
                      <th className="pb-2 pr-3 font-semibold">Status</th>
                      <th className="pb-2 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody>{orgRows}</tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No organizations yet.</p>
            )}

            {reviewMessage.text ? (
              <p
                role={reviewMessage.type === "error" ? "alert" : "status"}
                className={
                  reviewMessage.type === "error"
                    ? "mt-4 text-sm text-red-700"
                    : "mt-4 text-sm text-emerald-800"
                }
              >
                {reviewMessage.text}
              </p>
            ) : null}
            <h3 className="mt-6 text-sm font-semibold text-slate-800">Apps</h3>
            {apps.length ? (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2 pr-3 font-semibold">App</th>
                      <th className="pb-2 pr-3 font-semibold">Organization</th>
                      <th className="pb-2 pr-3 font-semibold">Slug</th>
                      <th className="pb-2 pr-3 font-semibold">Env</th>
                      <th className="pb-2 pr-3 font-semibold">Status</th>
                      <th className="pb-2 pr-3 font-semibold">Governance</th>
                      <th className="pb-2 font-semibold">Created</th>
                    </tr>
                  </thead>
                  <tbody>{appRows}</tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No apps yet.</p>
            )}
          </>
        )}
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/dev-console/my-apps" className="font-semibold text-tropicash-green-hover underline">
          My Apps
        </Link>
        {" · "}
        <Link href="/dev-console/apps" className="font-semibold text-tropicash-green-hover underline">
          Apps overview
        </Link>
      </p>
    </DevConsoleLayout>
  );
}
