import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";

import { useUser } from "../../lib/userContext";

import { fetchDeveloperApps } from "../../lib/developerApps";

import {

  createCapabilityRequest,

  fetchAppAccessPolicies,

  fetchAppCapabilities,

  fetchAppCapabilityRequests,

} from "../../lib/developerCapabilities";

import { INTERNAL_CAPABILITY_SEEDS } from "../../lib/internalCapabilityConfig";

import {

  buildProductCapabilityMap,

  getContractsForCapability,

  getProductByKey,

} from "../../lib/developerProductCatalogConfig";



const labelClass = "mb-1 block text-sm font-semibold text-slate-700";

const inputClass =

  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2";

const btnPrimary =

  "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-60";



const SANDBOX_CATALOG = INTERNAL_CAPABILITY_SEEDS.filter((c) => c.supportsSandbox);



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

    assigned: "border-emerald-200 bg-emerald-50 text-emerald-900",

    restricted: "border-orange-200 bg-orange-50 text-orange-900",

    revoked: "border-red-200 bg-red-50 text-red-900",

    suspended: "border-red-200 bg-red-50 text-red-900",

    active: "border-emerald-200 bg-emerald-50 text-emerald-900",

    planned: "border-slate-200 bg-slate-50 text-slate-700",

    restricted: "border-orange-200 bg-orange-50 text-orange-900",

    disabled: "border-slate-200 bg-slate-100 text-slate-600",

  };

  const cls = map[s] || "border-slate-200 bg-slate-50 text-slate-700";

  return (

    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>

      {status || "—"}

    </span>

  );

}



function catalogLabel(key) {

  const seed = SANDBOX_CATALOG.find((c) => c.capabilityKey === key);

  return seed ? `${seed.capabilityLabel} (${key})` : key;

}



export default function DevConsoleAppCapabilitiesPage() {

  const { user, loading: authLoading } = useUser();

  const userId = user?.id ?? null;



  const [apps, setApps] = useState([]);

  const [capabilities, setCapabilities] = useState([]);

  const [requests, setRequests] = useState([]);

  const [policies, setPolicies] = useState([]);

  const [selectedAppId, setSelectedAppId] = useState("");

  const [capabilityKey, setCapabilityKey] = useState("");

  const [requestReason, setRequestReason] = useState("");

  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [actionMessage, setActionMessage] = useState({ type: "", text: "" });



  const productCapabilityMap = useMemo(() => buildProductCapabilityMap(), []);



  const relatedCatalog = useMemo(() => {

    const key = capabilityKey.trim();

    if (!key) return { products: [], contracts: [] };

    return {

      products: productCapabilityMap[key] || [],

      contracts: getContractsForCapability(key),

    };

  }, [capabilityKey, productCapabilityMap]);


  const load = useCallback(async () => {

    if (!userId) {

      setApps([]);

      setCapabilities([]);

      setRequests([]);

      setPolicies([]);

      setLoading(false);

      return;

    }

    setLoading(true);

    setLoadError("");

    const [aRes, cRes, rRes, pRes] = await Promise.all([

      fetchDeveloperApps(userId),

      fetchAppCapabilities(userId),

      fetchAppCapabilityRequests(userId),

      fetchAppAccessPolicies(userId),

    ]);

    const parts = [];

    if (aRes.error) parts.push(aRes.error.message || "Could not load apps.");

    if (cRes.error) parts.push(cRes.error.message || "Could not load capabilities.");

    if (rRes.error) parts.push(rRes.error.message || "Could not load requests.");

    if (pRes.error) parts.push(pRes.error.message || "Could not load policies.");

    setLoadError(parts.join(" "));

    const appList = aRes.error ? [] : aRes.data || [];

    setApps(appList);

    setCapabilities(cRes.error ? [] : cRes.data || []);

    setRequests(rRes.error ? [] : rRes.data || []);

    setPolicies(pRes.error ? [] : pRes.data || []);

    setLoading(false);

  }, [userId]);



  useEffect(() => {

    void load();

  }, [load]);



  useEffect(() => {

    if (!selectedAppId && apps.length) {

      setSelectedAppId(apps[0].id);

    }

  }, [apps, selectedAppId]);



  const selectedApp = useMemo(

    () => apps.find((a) => a.id === selectedAppId) || null,

    [apps, selectedAppId],

  );



  const capsForApp = useMemo(

    () => capabilities.filter((c) => c.app_id === selectedAppId),

    [capabilities, selectedAppId],

  );



  const requestsForApp = useMemo(

    () => requests.filter((r) => r.app_id === selectedAppId),

    [requests, selectedAppId],

  );



  const policiesForApp = useMemo(

    () => policies.filter((p) => p.app_id === selectedAppId),

    [policies, selectedAppId],

  );



  const pendingForApp = useMemo(

    () => requestsForApp.filter((r) => r.status === "pending"),

    [requestsForApp],

  );



  const pastRequestsForApp = useMemo(

    () =>

      requestsForApp.filter((r) =>

        ["rejected", "needs_changes", "approved", "cancelled"].includes(String(r.status)),

      ),

    [requestsForApp],

  );



  const handleSubmitRequest = async (ev) => {

    ev.preventDefault();

    setActionMessage({ type: "", text: "" });

    if (!userId || !selectedApp) {

      setActionMessage({ type: "error", text: "Select an app first." });

      return;

    }

    if (!capabilityKey.trim()) {

      setActionMessage({ type: "error", text: "Select a capability." });

      return;

    }



    const dupPending = pendingForApp.some(

      (r) => r.capability_key === capabilityKey.trim() && r.requested_environment === "sandbox",

    );

    if (dupPending) {

      setActionMessage({ type: "error", text: "A pending request for this capability already exists." });

      return;

    }



    setSubmitting(true);

    const { data, error } = await createCapabilityRequest({

      app_id: selectedApp.id,

      organization_id: selectedApp.organization_id,

      requested_by_user_id: userId,

      capability_key: capabilityKey.trim(),

      requested_environment: "sandbox",

      request_reason: requestReason.trim() || null,

    });

    setSubmitting(false);



    if (error) {

      console.log("[governance-debug] app-capabilities submit failed", {

        app_id: selectedApp.id,

        capability_key: capabilityKey.trim(),

        message: error.message,

      });

      setActionMessage({

        type: "error",

        text: error.message || "Could not submit capability request.",

      });

      return;

    }

    console.log("[governance-debug] app-capabilities submit ok", {

      request_id: data?.id,

      status: data?.status,

      capability_key: data?.capability_key,

      app_id: data?.app_id,

    });

    setActionMessage({

      type: "success",

      text: "Capability request submitted. An admin will review it — you cannot self-assign access.",

    });

    setCapabilityKey("");

    setRequestReason("");

    void load();

  };



  if (authLoading) {

    return (

      <DevConsoleLayout title="App Capabilities" subtitle="Loading…">

        <p className="text-sm text-slate-600">Checking your session…</p>

      </DevConsoleLayout>

    );

  }



  if (!user) {

    return (

      <DevConsoleLayout title="App Capabilities" subtitle="Sign in required.">

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

      title="App Capabilities"

      subtitle="Sandbox capability assignments, access policies, and requests. Governance metadata only — no API keys or live API traffic."

    >

      <SandboxNotice />



      <p className="text-sm text-slate-600">

        Phase 4D adds a static catalog of API products and sandbox contracts — see{" "}

        <Link href="/dev-console/product-catalog" className="font-semibold text-tropicash-green-hover underline">

          Product Catalog

        </Link>

        . Phase 4E surfaces simulated usage and health narratives keyed to the same products —{" "}

        <Link href="/dev-console/sandbox-analytics" className="font-semibold text-tropicash-green-hover underline">

          Sandbox Analytics

        </Link>

        .

      </p>



      {loadError ? (

        <p className="text-sm text-red-700" role="alert">

          {loadError}{" "}

          <span className="text-slate-600">

            Apply{" "}

            <code className="rounded bg-slate-100 px-1">

              supabase/sql/developer_app_capabilities_phase4c.sql

            </code>{" "}

            if tables are missing.

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



      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="app-select-heading">

        <h2 id="app-select-heading" className="text-lg font-bold text-slate-900">

          App selector

        </h2>

        {loading ? (

          <p className="mt-3 text-sm text-slate-600">Loading…</p>

        ) : apps.length ? (

          <div className="mt-4 max-w-md">

            <label className={labelClass} htmlFor="app-select">

              App

            </label>

            <select

              id="app-select"

              className={inputClass}

              value={selectedAppId}

              onChange={(ev) => setSelectedAppId(ev.target.value)}

            >

              {apps.map((a) => (

                <option key={a.id} value={a.id}>

                  {a.app_name} ({a.app_slug})

                </option>

              ))}

            </select>

          </div>

        ) : (

          <p className="mt-3 text-sm text-slate-600">

            No apps yet.{" "}

            <Link href="/dev-console/apps-register" className="font-semibold text-tropicash-green-hover underline">

              Register an app

            </Link>

            .

          </p>

        )}

      </section>



      {selectedApp ? (

        <>

          <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="assigned-heading">

            <h2 id="assigned-heading" className="text-lg font-bold text-slate-900">

              Assigned capabilities

            </h2>

            <p className="mt-1 text-sm text-slate-600">

              Admin-assigned sandbox grants for <strong>{selectedApp.app_name}</strong>. You cannot

              modify these directly.

            </p>

            {capsForApp.length ? (

              <div className="mt-4 overflow-x-auto">

                <table className="w-full min-w-[560px] text-left text-sm">

                  <thead>

                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">

                      <th className="pb-2 pr-3 font-semibold">Capability</th>

                      <th className="pb-2 pr-3 font-semibold">Environment</th>

                      <th className="pb-2 pr-3 font-semibold">Status</th>

                      <th className="pb-2 font-semibold">Updated</th>

                    </tr>

                  </thead>

                  <tbody>

                    {capsForApp.map((c) => (

                      <tr key={c.id} className="border-b border-slate-100 last:border-0">

                        <td className="py-2 pr-3 font-medium text-slate-900">

                          {catalogLabel(c.capability_key)}

                        </td>

                        <td className="py-2 pr-3 text-slate-600">{c.environment}</td>

                        <td className="py-2 pr-3">{statusBadge(c.status)}</td>

                        <td className="py-2 text-slate-500">{formatWhen(c.updated_at)}</td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            ) : (

              <p className="mt-3 text-sm text-slate-600">No capabilities assigned yet.</p>

            )}

          </section>



          <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="requests-heading">

            <h2 id="requests-heading" className="text-lg font-bold text-slate-900">

              Capability requests

            </h2>

            {pendingForApp.length ? (

              <div className="mt-4">

                <h3 className="text-sm font-semibold text-amber-900">Pending</h3>

                <ul className="mt-2 space-y-2 text-sm">

                  {pendingForApp.map((r) => (

                    <li

                      key={r.id}

                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 break-words"

                    >

                      {catalogLabel(r.capability_key)} · {r.requested_environment} ·{" "}

                      {formatWhen(r.created_at)}

                      {r.request_reason ? (

                        <span className="mt-1 block text-slate-600">{r.request_reason}</span>

                      ) : null}

                    </li>

                  ))}

                </ul>

              </div>

            ) : (

              <p className="mt-3 text-sm text-slate-600">No pending requests for this app.</p>

            )}

            {pastRequestsForApp.length ? (

              <div className="mt-6">

                <h3 className="text-sm font-semibold text-slate-800">Previous requests</h3>

                <PastRequestsTable items={pastRequestsForApp} />

              </div>

            ) : null}

          </section>



          <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="policies-heading">

            <h2 id="policies-heading" className="text-lg font-bold text-slate-900">

              Access policies

            </h2>

            <p className="mt-1 text-sm text-slate-600">

              Sandbox restrictions and policy metadata set by admins for this app.

            </p>

            {policiesForApp.length ? (

              <div className="mt-4 overflow-x-auto">

                <table className="w-full min-w-[640px] text-left text-sm">

                  <thead>

                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">

                      <th className="pb-2 pr-3 font-semibold">Policy</th>

                      <th className="pb-2 pr-3 font-semibold">Environment</th>

                      <th className="pb-2 pr-3 font-semibold">Status</th>

                      <th className="pb-2 pr-3 font-semibold">Risk</th>

                      <th className="pb-2 font-semibold">Updated</th>

                    </tr>

                  </thead>

                  <tbody>

                    {policiesForApp.map((p) => (

                      <tr key={p.id} className="border-b border-slate-100 last:border-0">

                        <td className="py-2 pr-3">

                          <div className="font-medium text-slate-900">{p.policy_label}</div>

                          <code className="text-xs text-slate-500">{p.policy_key}</code>

                        </td>

                        <td className="py-2 pr-3 text-slate-600">{p.environment}</td>

                        <td className="py-2 pr-3">{statusBadge(p.status)}</td>

                        <td className="py-2 pr-3 text-slate-600">{p.risk_level}</td>

                        <td className="py-2 text-slate-500">{formatWhen(p.updated_at)}</td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            ) : (

              <p className="mt-3 text-sm text-slate-600">No access policies configured yet.</p>

            )}

          </section>



          <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="request-form-heading">

            <h2 id="request-form-heading" className="text-lg font-bold text-slate-900">

              Request sandbox capability

            </h2>

            <p className="mt-1 text-sm text-slate-600">

              Environment is fixed to <strong>sandbox</strong>. Live access is not available in this

              phase.

            </p>

            <form className="mt-4 max-w-lg space-y-4" onSubmit={(ev) => void handleSubmitRequest(ev)}>

              <div>

                <label className={labelClass} htmlFor="capability-key">

                  Capability

                </label>

                <select

                  id="capability-key"

                  className={inputClass}

                  value={capabilityKey}

                  onChange={(ev) => setCapabilityKey(ev.target.value)}

                  required

                >

                  <option value="">Select capability…</option>

                  {SANDBOX_CATALOG.map((c) => (

                    <option key={c.capabilityKey} value={c.capabilityKey}>

                      {c.capabilityLabel} — {c.capabilityKey}

                    </option>

                  ))}

                </select>

              </div>

              <div>

                <label className={labelClass} htmlFor="request-env">

                  Environment

                </label>

                <input

                  id="request-env"

                  className={inputClass}

                  value="sandbox"

                  readOnly

                  aria-readonly="true"

                />

              </div>

              <RequestReasonField

                requestReason={requestReason}

                setRequestReason={setRequestReason}

                labelClass={labelClass}

                inputClass={inputClass}

              />

              <button type="submit" className={btnPrimary} disabled={submitting}>

                {submitting ? "Submitting…" : "Submit request"}

              </button>

            </form>

          </section>



          <RelatedProductAccessSection relatedCatalog={relatedCatalog} capabilityKey={capabilityKey} />

        </>

      ) : null}



      <p className="text-sm text-slate-600">

        <Link href="/dev-console/my-apps" className="font-semibold text-tropicash-green-hover underline">

          Back to My Apps

        </Link>

      </p>

    </DevConsoleLayout>

  );

}



function RelatedProductAccessSection({ relatedCatalog, capabilityKey }) {

  const focused = capabilityKey.trim();

  return (

    <section

      className="tropicash-surface rounded-2xl p-5 sm:p-6"

      aria-labelledby="related-catalog-heading"

    >

      <h2 id="related-catalog-heading" className="text-lg font-bold text-slate-900">

        Related Product Access

      </h2>

      <p className="mt-1 text-sm text-slate-600">

        Cross-reference from the Phase 2C capability key you selected in{" "}

        <strong>Request sandbox capability</strong>. This mapping is documentation-only — no access

        is granted automatically.

      </p>

      {!focused ? (

        <p className="mt-3 text-sm text-slate-600">

          Pick a capability in the request form above to preview matching API products and sandbox

          contracts.

        </p>

      ) : (

        <>

          <p className="mt-3 text-sm font-semibold text-slate-800">

            Capability <code className="rounded bg-slate-100 px-1 text-xs">{focused}</code>

          </p>



          <div className="mt-4">

            <h3 className="text-sm font-bold text-slate-800">API products</h3>

            {relatedCatalog.products.length ? (

              <ul className="mt-2 space-y-2 text-sm text-slate-700">

                {relatedCatalog.products.map((p) => {

                  const full = getProductByKey(p.product_key);

                  return (

                    <li key={p.product_key} className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2">

                      <div className="font-semibold text-slate-900">{full?.title ?? p.product_key}</div>

                      <div className="text-xs text-slate-500">{p.product_key}</div>

                      <div className="mt-1 text-xs text-slate-600">

                        Status {full?.status ?? "—"} · tier {full?.rate_limit_tier ?? "—"} · sandbox{" "}

                        {full?.sandbox_supported ? "yes" : "no"} · live {full?.live_supported ? "yes" : "no"}

                      </div>

                    </li>

                  );

                })}

              </ul>

            ) : (

              <p className="mt-2 text-sm text-slate-600">No catalog products reference this capability.</p>

            )}

          </div>



          <div className="mt-6">

            <h3 className="text-sm font-bold text-slate-800">Sandbox contracts</h3>

            {relatedCatalog.contracts.length ? (

              <ul className="mt-2 space-y-2 text-sm text-slate-700">

                {relatedCatalog.contracts.map((c) => {

                  const prod = getProductByKey(c.product_key);

                  return (

                    <li key={c.contract_key} className="rounded-lg border border-slate-200 bg-white/90 px-3 py-2">

                      <div className="font-semibold text-slate-900">{c.title}</div>

                      <div className="font-mono text-xs text-slate-600">

                        {c.method} {c.route_preview}

                      </div>

                      <div className="mt-1 text-xs text-slate-500">

                        Product {prod?.title ?? c.product_key} · env {c.environment} · review{" "}

                        {c.review_required ? "required" : "optional"}

                      </div>

                    </li>

                  );

                })}

              </ul>

            ) : (

              <p className="mt-2 text-sm text-slate-600">No seeded contracts list this capability.</p>

            )}

          </div>



          <p className="mt-4 text-sm text-slate-600">

            Full tables live on{" "}

            <Link href="/dev-console/product-catalog" className="font-semibold text-tropicash-green-hover underline">

              Product Catalog

            </Link>

            ; simulated usage previews in{" "}

            <Link href="/dev-console/sandbox-analytics" className="font-semibold text-tropicash-green-hover underline">

              Sandbox Analytics

            </Link>

            .

          </p>

        </>

      )}

    </section>

  );

}



function SandboxNotice() {

  return (

    <div

      role="note"

      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"

    >

      <strong className="font-semibold">Sandbox restrictions.</strong> Capability keys reference the

      internal catalog for planning only — no enforcement, API keys, webhooks, or live API traffic.

      Admins assign capabilities after review; you cannot self-assign.

    </div>

  );

}



function PastRequestsTable({ items }) {

  return (

    <div className="mt-2 overflow-x-auto">

      <table className="w-full min-w-[520px] text-left text-sm">

        <thead>

          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">

            <th className="pb-2 pr-3 font-semibold">Capability</th>

            <th className="pb-2 pr-3 font-semibold">Status</th>

            <th className="pb-2 font-semibold">Reviewed</th>

          </tr>

        </thead>

        <tbody>

          {items.map((r) => (

            <tr key={r.id} className="border-b border-slate-100 last:border-0">

              <td className="py-2 pr-3 text-slate-800 break-words max-w-[min(100%,20rem)]">{catalogLabel(r.capability_key)}</td>

              <td className="py-2 pr-3">{statusBadge(r.status)}</td>

              <td className="py-2 text-slate-500">{formatWhen(r.reviewed_at || r.created_at)}</td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  );

}



function RequestReasonField({ requestReason, setRequestReason, labelClass, inputClass }) {

  return (

    <div>

      <label className={labelClass} htmlFor="request-reason">

        Reason (optional)

      </label>

      <textarea

        id="request-reason"

        className={inputClass}

        rows={3}

        value={requestReason}

        onChange={(ev) => setRequestReason(ev.target.value)}

        placeholder="Why does your app need this capability in sandbox?"

      />

    </div>

  );

}


