import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DevConsoleLayout from "../../components/devconsole/DevConsoleLayout";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import { supabase } from "../../lib/supabaseClient";
import {
  fetchDeveloperAccessRequests,
  updateDeveloperAccessRequestStatus,
} from "../../lib/developerAccessRequests";
import { DEVELOPER_ACCESS_USE_CASES } from "../../lib/developerCenterConfig";
import {
  approveCapabilityRequest,
  fetchPendingCapabilityRequestsForAdmin,
  needsChangesCapabilityRequest,
  rejectCapabilityRequest,
} from "../../lib/developerCapabilities";
import {
  fetchAllLifecycleEventsForAdmin,
  fetchAllPendingReviewsForAdmin,
  fetchAllReviewsForAdmin,
  fetchAppsForGovernance,
  updateDeveloperReviewStatus,
} from "../../lib/developerGovernance";
import { INTERNAL_CAPABILITY_SEEDS } from "../../lib/internalCapabilityConfig";

const labelClass = "mb-1 block text-sm font-semibold text-slate-700";
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2";
const btnPrimary =
  "rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:opacity-60";
const btnSecondary =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60";

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
    reviewed: "border-sky-200 bg-sky-50 text-sky-900",
    archived: "border-slate-200 bg-slate-100 text-slate-700",
    needs_changes: "border-sky-200 bg-sky-50 text-sky-900",
    cancelled: "border-slate-200 bg-slate-100 text-slate-700",
    draft: "border-slate-200 bg-slate-50 text-slate-700",
    sandbox_active: "border-emerald-200 bg-emerald-50 text-emerald-900",
    live_pending: "border-violet-200 bg-violet-50 text-violet-900",
    live_active: "border-emerald-300 bg-emerald-100 text-emerald-950",
    suspended: "border-red-200 bg-red-50 text-red-900",
  };
  const cls = map[s] || "border-slate-200 bg-slate-50 text-slate-700";
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status || "—"}
    </span>
  );
}

export default function DevConsoleAppGovernancePage() {
  const { user, profile, loading: authLoading } = useUser();
  const admin = isAdminUser(user, profile);

  const [pendingReviews, setPendingReviews] = useState([]);
  const [allReviews, setAllReviews] = useState([]);
  const [apps, setApps] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [lifecycle, setLifecycle] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedReviewId, setSelectedReviewId] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [actionMessage, setActionMessage] = useState({ type: "", text: "" });
  const [acting, setActing] = useState(false);
  const [capabilityRequests, setCapabilityRequests] = useState([]);
  const [selectedCapRequestId, setSelectedCapRequestId] = useState("");
  const [capDecisionNotes, setCapDecisionNotes] = useState("");
  const [capActionMessage, setCapActionMessage] = useState({ type: "", text: "" });
  const [capActing, setCapActing] = useState(false);
  const [accessRequests, setAccessRequests] = useState([]);
  const [selectedAccessRequestId, setSelectedAccessRequestId] = useState("");
  const [accessReviewNotes, setAccessReviewNotes] = useState("");
  const [accessActionMessage, setAccessActionMessage] = useState({ type: "", text: "" });
  const [accessActing, setAccessActing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const [pRes, rRes, aRes, lRes, oRes, capRes, accessRes] = await Promise.all([
      fetchAllPendingReviewsForAdmin(),
      fetchAllReviewsForAdmin(),
      fetchAppsForGovernance(),
      fetchAllLifecycleEventsForAdmin(),
      supabase.from("developer_organizations").select("id, organization_name").limit(500),
      fetchPendingCapabilityRequestsForAdmin(),
      fetchDeveloperAccessRequests(),
    ]);
    const parts = [];
    if (pRes.error) parts.push(pRes.error.message || "Could not load pending reviews.");
    if (rRes.error) parts.push(rRes.error.message || "Could not load reviews.");
    if (aRes.error) parts.push(aRes.error.message || "Could not load apps.");
    if (lRes.error) parts.push(lRes.error.message || "Could not load lifecycle events.");
    if (capRes.error) parts.push(capRes.error.message || "Could not load capability requests.");
    if (accessRes.error) {
      parts.push(accessRes.error.message || "Could not load public access requests.");
    }
    let pending = pRes.data || [];
    if (!pRes.error && !pending.length && (rRes.data || []).length) {
      const fromHistory = (rRes.data || []).filter((r) => r.status === "pending");
      if (fromHistory.length) {
        pending = fromHistory;
        console.log("[governance-debug] pending reviews recovered from review history", {
          count: fromHistory.length,
        });
      }
    }
    console.log("[governance-debug] app-governance load", {
      admin,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      pendingReviews: pending.length,
      capabilityRequests: (capRes.data || []).length,
      accessRequests: (accessRes.data || []).length,
      allReviews: (rRes.data || []).length,
      apps: (aRes.data || []).length,
      loadErrors: parts,
    });
    setLoadError(parts.join(" "));
    setPendingReviews(pending);
    setAllReviews(rRes.data || []);
    setApps(aRes.data || []);
    setLifecycle(lRes.data || []);
    setOrgs(oRes.error ? [] : oRes.data || []);
    setCapabilityRequests(capRes.data || []);
    setAccessRequests(accessRes.data || []);
    setLoading(false);
  }, [admin, user?.email, user?.id]);

  useEffect(() => {
    if (authLoading || !admin || !user?.id) return;
    void load();
  }, [authLoading, admin, user?.id, load]);

  const appById = useMemo(
    () => Object.fromEntries((apps || []).map((a) => [a.id, a])),
    [apps],
  );
  const orgById = useMemo(
    () => Object.fromEntries((orgs || []).map((o) => [o.id, o.organization_name])),
    [orgs],
  );

  const orgNameFromApps = useMemo(() => {
    const map = { ...orgById };
    for (const a of apps || []) {
      if (a.organization_id && !map[a.organization_id]) {
        map[a.organization_id] = a.organization_id.slice(0, 8);
      }
    }
    return map;
  }, [orgById, apps]);

  const selectedReview = useMemo(
    () => (pendingReviews || []).find((r) => r.id === selectedReviewId) || null,
    [pendingReviews, selectedReviewId],
  );

  const selectedCapRequest = useMemo(
    () => (capabilityRequests || []).find((r) => r.id === selectedCapRequestId) || null,
    [capabilityRequests, selectedCapRequestId],
  );

  const capabilityLabel = (key) => {
    const seed = INTERNAL_CAPABILITY_SEEDS.find((c) => c.capabilityKey === key);
    return seed ? seed.capabilityLabel : key;
  };

  const useCaseLabel = (value) => {
    const opt = DEVELOPER_ACCESS_USE_CASES.find((u) => u.value === value);
    return opt ? opt.label : value || "—";
  };

  const selectedAccessRequest = useMemo(
    () => (accessRequests || []).find((r) => r.id === selectedAccessRequestId) || null,
    [accessRequests, selectedAccessRequestId],
  );

  useEffect(() => {
    if (!selectedReviewId && pendingReviews.length) {
      setSelectedReviewId(pendingReviews[0].id);
    }
  }, [pendingReviews, selectedReviewId]);

  useEffect(() => {
    if (!selectedCapRequestId && capabilityRequests.length) {
      setSelectedCapRequestId(capabilityRequests[0].id);
    }
  }, [capabilityRequests, selectedCapRequestId]);

  useEffect(() => {
    if (!selectedAccessRequestId && accessRequests.length) {
      setSelectedAccessRequestId(accessRequests[0].id);
    }
  }, [accessRequests, selectedAccessRequestId]);

  const handleAccessRequestStatus = async (status) => {
    setAccessActionMessage({ type: "", text: "" });
    if (!user?.id || !selectedAccessRequestId) {
      setAccessActionMessage({ type: "error", text: "Select a public access request first." });
      return;
    }
    setAccessActing(true);
    const { data, error } = await updateDeveloperAccessRequestStatus({
      id: selectedAccessRequestId,
      status,
      reviewed_by_user_id: user.id,
      review_notes: accessReviewNotes.trim() || null,
    });
    setAccessActing(false);
    if (error) {
      setAccessActionMessage({
        type: "error",
        text: error.message || "Could not update access request.",
      });
      return;
    }
    setAccessActionMessage({
      type: "success",
      text:
        status === "approved"
          ? `Access request approved. The submitter can sign in to the Developer Console (shell entry only). No organizations, apps, or API keys were created.`
          : `Access request marked ${data?.status || status}. No org or app records were created.`,
    });
    setAccessReviewNotes("");
    void load();
  };

  const handleDecision = async (status) => {
    setActionMessage({ type: "", text: "" });
    if (!user?.id || !selectedReviewId) {
      setActionMessage({ type: "error", text: "Select a pending review first." });
      return;
    }
    setActing(true);
    const { data, error } = await updateDeveloperReviewStatus({
      review_id: selectedReviewId,
      status,
      reviewer_user_id: user.id,
      decision_notes: decisionNotes.trim() || null,
    });
    setActing(false);
    if (error) {
      setActionMessage({
        type: "error",
        text: error.message || "Could not update review.",
      });
      return;
    }
    const appStatus = data?.app?.status;
    setActionMessage({
      type: "success",
      text: appStatus
        ? `Review marked ${status}. App status is now ${appStatus}.`
        : `Review marked ${status}.`,
    });
    setDecisionNotes("");
    setSelectedReviewId("");
    void load();
  };

  const handleCapabilityDecision = async (action) => {
    setCapActionMessage({ type: "", text: "" });
    if (!user?.id || !selectedCapRequestId) {
      setCapActionMessage({ type: "error", text: "Select a capability request first." });
      return;
    }
    setCapActing(true);
    const notes = capDecisionNotes.trim() || null;
    let result;
    if (action === "approved") {
      result = await approveCapabilityRequest(selectedCapRequestId, user.id, notes);
    } else if (action === "rejected") {
      result = await rejectCapabilityRequest(selectedCapRequestId, user.id, notes);
    } else {
      result = await needsChangesCapabilityRequest(selectedCapRequestId, user.id, notes);
    }
    setCapActing(false);
    if (result.error) {
      setCapActionMessage({
        type: "error",
        text: result.error.message || "Could not update capability request.",
      });
      return;
    }
    const capKey = result.data?.request?.capability_key;
    setCapActionMessage({
      type: "success",
      text:
        action === "approved" && capKey
          ? `Capability request approved. ${capKey} assigned in sandbox.`
          : `Capability request marked ${action.replace("_", " ")}.`,
    });
    setCapDecisionNotes("");
    setSelectedCapRequestId("");
    void load();
  };

  if (authLoading) {
    return (
      <DevConsoleLayout title="Developer Governance" subtitle="Loading…">
        <p className="text-sm text-slate-600">Checking your session…</p>
      </DevConsoleLayout>
    );
  }

  if (!user) {
    return (
      <DevConsoleLayout title="Developer Governance" subtitle="Sign in required.">
        <p className="text-sm text-slate-600">
          <Link href="/login" className="font-semibold text-tropicash-green-hover underline">
            Go to login
          </Link>
        </p>
      </DevConsoleLayout>
    );
  }

  if (!admin) {
    return (
      <DevConsoleLayout
        title="Developer Governance"
        subtitle="Admin operators only."
      >
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">
          <strong className="font-semibold">Not authorized.</strong> App governance and review
          decisions are limited to admin accounts. Developers can track their apps on{" "}
          <Link href="/dev-console/my-apps" className="font-semibold underline">
            My Apps
          </Link>
          . Planning references:{" "}
          <Link href="/dev-console/product-catalog" className="font-semibold underline">
            Product Catalog
          </Link>
          ,{" "}
          <Link href="/dev-console/sandbox-analytics" className="font-semibold underline">
            Sandbox Analytics
          </Link>
          ,{" "}
          <Link href="/dev-console/workspace" className="font-semibold underline">
            Workspace
          </Link>
          .
        </div>
      </DevConsoleLayout>
    );
  }

  return (
    <DevConsoleLayout
      title="Developer Governance"
      subtitle="Review sandbox activation and environment upgrade requests. Metadata and status transitions only — no API keys, secrets, or live API execution."
    >
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
        <strong className="font-semibold">Phase 7A Workspace:</strong> developers see static identity, onboarding, and
        readiness on{" "}
        <Link href="/dev-console/workspace" className="font-semibold underline">
          Workspace
        </Link>
        — seed counts may differ from live queue rows below.
      </div>
      <section
        className="tropicash-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="public-access-heading"
      >
        <h2 id="public-access-heading" className="text-lg font-bold text-slate-900">
          Public developer access requests
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Intake from{" "}
          <Link href="/developers/request-access" className="font-semibold text-tropicash-green-hover underline">
            /developers/request-access
          </Link>
          . Approving grants signed-in access to the Developer Console shell only — it does not
          create organizations, apps, or API keys.
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading…</p>
        ) : accessRequests.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">Name</th>
                  <th className="pb-2 pr-3 font-semibold">Company</th>
                  <th className="pb-2 pr-3 font-semibold">Email</th>
                  <th className="pb-2 pr-3 font-semibold">Use case</th>
                  <th className="pb-2 pr-3 font-semibold">Message</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {accessRequests.map((r) => (
                  <tr
                    key={r.id}
                    className={`cursor-pointer border-b border-slate-100 last:border-0 ${
                      selectedAccessRequestId === r.id ? "bg-slate-50" : ""
                    }`}
                    onClick={() => setSelectedAccessRequestId(r.id)}
                  >
                    <td className="py-2 pr-3 font-medium text-slate-900">{r.full_name}</td>
                    <td className="py-2 pr-3 text-slate-600">{r.company_name || "—"}</td>
                    <td className="py-2 pr-3 text-slate-600">{r.email}</td>
                    <td className="py-2 pr-3 text-slate-600">{useCaseLabel(r.use_case)}</td>
                    <td className="py-2 pr-3 max-w-[200px] truncate text-slate-600">
                      {r.message || "—"}
                    </td>
                    <td className="py-2 pr-3">{statusBadge(r.status)}</td>
                    <td className="py-2 text-slate-500">{formatWhen(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No public access requests yet.</p>
        )}

        {selectedAccessRequest ? (
          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">Selected:</span>{" "}
              {selectedAccessRequest.full_name} · {selectedAccessRequest.email}
            </p>
            {selectedAccessRequest.message ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-semibold">Message:</span> {selectedAccessRequest.message}
              </p>
            ) : null}
            <div>
              <label className={labelClass} htmlFor="access-review-notes">
                Review notes
              </label>
              <textarea
                id="access-review-notes"
                className={inputClass}
                rows={3}
                value={accessReviewNotes}
                onChange={(ev) => setAccessReviewNotes(ev.target.value)}
                placeholder="Optional notes stored on the request row."
              />
            </div>
            {accessActionMessage.text ? (
              <p
                role={accessActionMessage.type === "error" ? "alert" : "status"}
                className={
                  accessActionMessage.type === "error" ? "text-red-700" : "text-emerald-800"
                }
              >
                {accessActionMessage.text}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnSecondary}
                disabled={accessActing}
                onClick={() => void handleAccessRequestStatus("reviewed")}
              >
                Mark reviewed
              </button>
              <button
                type="button"
                className={btnPrimary}
                disabled={accessActing}
                onClick={() => void handleAccessRequestStatus("approved")}
              >
                Approve
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={accessActing}
                onClick={() => void handleAccessRequestStatus("rejected")}
              >
                Reject
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={accessActing}
                onClick={() => void handleAccessRequestStatus("archived")}
              >
                Archive
              </button>
            </div>
          </div>
        ) : accessRequests.length ? (
          <p className="mt-3 text-sm text-slate-600">
            Select a request above to update status.
          </p>
        ) : null}
      </section>

      <div
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
      >
        <strong className="font-semibold">Governance safety.</strong> Approvals update app status
        rows only. Sandbox activation sets <code className="text-xs">sandbox_active</code>; live
        access approval sets <code className="text-xs">live_pending</code> (not{" "}
        <code className="text-xs">live_active</code>) until a future phase. No credentials are
        issued and no payment or wallet surfaces are touched.
      </div>

      <div
        role="note"
        className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950"
      >
        <strong className="font-semibold">Phase 9A + 9B — Product Access.</strong> Sandbox product entitlement previews
        and metadata-only product governance (visibility rules, review outcomes, revocation models) live in{" "}
        <Link href="/dev-console/product-access" className="font-semibold text-teal-900 underline">
          Product Access
        </Link>
        . App review outcomes here inform product entitlement history seeds — no endpoints, execution, or live access.
      </div>

      <section
        className="tropicash-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="credential-arch-readiness-heading"
      >
        <h2 id="credential-arch-readiness-heading" className="text-lg font-bold text-slate-900">
          Credential architecture readiness
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Before any future API key or signing material is issued, Phase 5A defines Supabase metadata
          tables (no secret columns), lifecycle vocabulary, and vault blueprint slices. Review the
          static console walkthrough so governance decisions stay aligned with issuance constraints.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/dev-console/credential-architecture"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🔐 Credential Architecture (Phase 5A)
          </Link>
          <Link
            href="/dev-console/credential-lifecycle"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🪪 Credential Lifecycle (8A + 8B)
          </Link>
          <Link
            href="/dev-console/workspace"
            className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm hover:bg-emerald-100"
          >
            🏠 Workspace (Phase 7A + 7B)
          </Link>
          <Link
            href="/dev-console/product-access"
            className="inline-flex rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm hover:bg-slate-50"
          >
            🎫 Product Access (9A + 9B)
          </Link>
          <Link
            href="/dev-console/request-simulator"
            className="inline-flex rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-950 shadow-sm hover:bg-amber-100"
          >
            📨 Request Simulator (10A + 10B)
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Modeling only — no credentials are created from that page, and owners cannot self-issue rows
          under the planned RLS split.
        </p>
        <p className="mt-4 text-sm text-slate-600">
          <strong className="font-semibold text-slate-800">Phase 5B — request verification simulation.</strong> After
          credentials are modeled, the{" "}
          <Link href="/dev-console/auth-simulator" className="font-semibold text-tropicash-green-hover underline">
            Auth Simulator
          </Link>{" "}
          explains how a future edge would walk transport, lifecycle, environment, and capability checks before any
          execution simulator runs — still configuration-only.
        </p>
      </section>

      <p className="text-sm text-slate-600">
        Capability approvals can be cross-checked against the static{" "}
        <Link href="/dev-console/product-catalog" className="font-semibold text-tropicash-green-hover underline">
          Product Catalog
        </Link>{" "}
        (Phase 4D — illustrative contracts only) and{" "}
        <Link href="/dev-console/sandbox-analytics" className="font-semibold text-tropicash-green-hover underline">
          Sandbox Analytics
        </Link>{" "}
        (Phase 4E — simulated usage narratives only).
      </p>

      {loadError ? (
        <p className="text-sm text-red-700" role="alert">
          {loadError}{" "}
          <span className="text-slate-600">
            Apply{" "}
            <code className="rounded bg-slate-100 px-1">
              supabase/sql/developer_access_requests.sql
            </code>
            ,{" "}
            <code className="rounded bg-slate-100 px-1">
              supabase/sql/developer_app_governance_phase4b.sql
            </code>{" "}
            and{" "}
            <code className="rounded bg-slate-100 px-1">
              supabase/sql/developer_app_capabilities_phase4c.sql
            </code>{" "}
            if tables are missing.
          </span>
        </p>
      ) : null}

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="pending-heading">
        <h2 id="pending-heading" className="text-lg font-bold text-slate-900">
          Pending reviews
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {loading ? "Loading…" : `${pendingReviews.length} pending request(s).`}
        </p>
        {loading ? null : pendingReviews.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">App</th>
                  <th className="pb-2 pr-3 font-semibold">Type</th>
                  <th className="pb-2 pr-3 font-semibold">Env</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Requested</th>
                </tr>
              </thead>
              <tbody>
                {pendingReviews.map((r) => {
                  const app = appById[r.app_id];
                  return (
                    <tr
                      key={r.id}
                      className={`cursor-pointer border-b border-slate-100 last:border-0 ${
                        selectedReviewId === r.id ? "bg-slate-50" : ""
                      }`}
                      onClick={() => setSelectedReviewId(r.id)}
                    >
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {app?.app_name || r.app_id.slice(0, 8)}
                        <div className="text-xs font-normal text-slate-500">
                          {orgNameFromApps[r.organization_id] || "—"}
                        </div>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{r.review_type}</td>
                      <td className="py-2 pr-3 text-slate-600">{r.requested_environment}</td>
                      <td className="py-2 pr-3">{statusBadge(r.status)}</td>
                      <td className="py-2 text-slate-500">{formatWhen(r.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No pending reviews.</p>
        )}
      </section>

      <section
        className="tropicash-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="cap-requests-heading"
      >
        <h2 id="cap-requests-heading" className="text-lg font-bold text-slate-900">
          Capability requests
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {loading
            ? "Loading…"
            : `${capabilityRequests.length} pending sandbox capability request(s).`}
        </p>
        {loading ? null : capabilityRequests.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">App</th>
                  <th className="pb-2 pr-3 font-semibold">Org</th>
                  <th className="pb-2 pr-3 font-semibold">Capability</th>
                  <th className="pb-2 pr-3 font-semibold">Env</th>
                  <th className="pb-2 pr-3 font-semibold">Reason</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Requested</th>
                </tr>
              </thead>
              <tbody>
                {capabilityRequests.map((r) => {
                  const app = appById[r.app_id];
                  return (
                    <tr
                      key={r.id}
                      className={`cursor-pointer border-b border-slate-100 last:border-0 ${
                        selectedCapRequestId === r.id ? "bg-slate-50" : ""
                      }`}
                      onClick={() => setSelectedCapRequestId(r.id)}
                    >
                      <td className="py-2 pr-3 font-medium text-slate-900">
                        {app?.app_name || r.app_id.slice(0, 8)}
                      </td>
                      <td className="py-2 pr-3 text-slate-600">
                        {orgNameFromApps[r.organization_id] || "—"}
                      </td>
                      <td className="py-2 pr-3 text-slate-800">
                        {capabilityLabel(r.capability_key)}
                        <div className="text-xs text-slate-500">{r.capability_key}</div>
                      </td>
                      <td className="py-2 pr-3 text-slate-600">{r.requested_environment}</td>
                      <td className="py-2 pr-3 max-w-[200px] truncate text-slate-600">
                        {r.request_reason || "—"}
                      </td>
                      <td className="py-2 pr-3">{statusBadge(r.status)}</td>
                      <td className="py-2 text-slate-500">{formatWhen(r.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No pending capability requests.</p>
        )}

        {selectedCapRequest ? (
          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">Selected:</span>{" "}
              {capabilityLabel(selectedCapRequest.capability_key)} for app{" "}
              <code className="text-xs">{selectedCapRequest.app_id.slice(0, 8)}…</code> ·{" "}
              {selectedCapRequest.requested_environment}
            </p>
            {selectedCapRequest.request_reason ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-semibold">Reason:</span> {selectedCapRequest.request_reason}
              </p>
            ) : null}
            <div>
              <label className={labelClass} htmlFor="cap-decision-notes">
                Decision notes
              </label>
              <textarea
                id="cap-decision-notes"
                className={inputClass}
                rows={3}
                value={capDecisionNotes}
                onChange={(ev) => setCapDecisionNotes(ev.target.value)}
                placeholder="Optional notes recorded on the request and lifecycle event."
              />
            </div>
            {capActionMessage.text ? (
              <p
                role={capActionMessage.type === "error" ? "alert" : "status"}
                className={
                  capActionMessage.type === "error" ? "text-red-700" : "text-emerald-800"
                }
              >
                {capActionMessage.text}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                disabled={capActing}
                onClick={() => void handleCapabilityDecision("approved")}
              >
                Approve
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={capActing}
                onClick={() => void handleCapabilityDecision("rejected")}
              >
                Reject
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={capActing}
                onClick={() => void handleCapabilityDecision("needs_changes")}
              >
                Needs changes
              </button>
            </div>
          </div>
        ) : capabilityRequests.length ? (
          <p className="mt-3 text-sm text-slate-600">
            Select a capability request above to approve or reject.
          </p>
        ) : null}
      </section>

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="text-lg font-bold text-slate-900">
          Review actions
        </h2>
        {selectedReview ? (
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-semibold text-slate-900">Selected:</span>{" "}
              {selectedReview.review_type} for app{" "}
              <code className="text-xs">{selectedReview.app_id.slice(0, 8)}…</code>
            </p>
            {selectedReview.review_notes ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="font-semibold">Requester notes:</span> {selectedReview.review_notes}
              </p>
            ) : null}
            <div>
              <label className={labelClass} htmlFor="decision-notes">
                Decision notes
              </label>
              <textarea
                id="decision-notes"
                className={inputClass}
                rows={3}
                value={decisionNotes}
                onChange={(ev) => setDecisionNotes(ev.target.value)}
                placeholder="Optional notes recorded on the review and lifecycle event."
              />
            </div>
            {actionMessage.text ? (
              <p
                role={actionMessage.type === "error" ? "alert" : "status"}
                className={
                  actionMessage.type === "error" ? "text-red-700" : "text-emerald-800"
                }
              >
                {actionMessage.text}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                disabled={acting}
                onClick={() => void handleDecision("approved")}
              >
                Approve
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={acting}
                onClick={() => void handleDecision("rejected")}
              >
                Reject
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={acting}
                onClick={() => void handleDecision("needs_changes")}
              >
                Needs changes
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">Select a pending review above to decide.</p>
        )}
      </section>

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="apps-heading">
        <h2 id="apps-heading" className="text-lg font-bold text-slate-900">
          App lifecycle overview
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading…</p>
        ) : apps.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">App</th>
                  <th className="pb-2 pr-3 font-semibold">Slug</th>
                  <th className="pb-2 pr-3 font-semibold">Env</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 font-medium text-slate-900">{a.app_name}</td>
                    <td className="py-2 pr-3">
                      <code className="text-xs">{a.app_slug}</code>
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{a.environment}</td>
                    <td className="py-2 pr-3">{statusBadge(a.status)}</td>
                    <td className="py-2 text-slate-500">{formatWhen(a.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No developer apps registered yet.</p>
        )}
      </section>

      <section
        className="tropicash-surface rounded-2xl p-5 sm:p-6"
        aria-labelledby="lifecycle-heading"
      >
        <h2 id="lifecycle-heading" className="text-lg font-bold text-slate-900">
          Lifecycle event feed
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-600">Loading…</p>
        ) : lifecycle.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">When</th>
                  <th className="pb-2 pr-3 font-semibold">Event</th>
                  <th className="pb-2 pr-3 font-semibold">Transition</th>
                  <th className="pb-2 pr-3 font-semibold">Actor</th>
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
                    <td className="py-2 pr-3 text-slate-600">{ev.actor_type}</td>
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

      <section className="tropicash-surface rounded-2xl p-5 sm:p-6" aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-lg font-bold text-slate-900">
          Recent review history
        </h2>
        {allReviews.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 pr-3 font-semibold">Type</th>
                  <th className="pb-2 pr-3 font-semibold">Status</th>
                  <th className="pb-2 pr-3 font-semibold">Reviewed</th>
                  <th className="pb-2 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody>
                {allReviews.slice(0, 40).map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3 text-slate-800">{r.review_type}</td>
                    <td className="py-2 pr-3">{statusBadge(r.status)}</td>
                    <td className="py-2 pr-3 text-slate-500">{formatWhen(r.reviewed_at)}</td>
                    <td className="py-2 text-slate-500">{formatWhen(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600">No reviews recorded.</p>
        )}
      </section>
    </DevConsoleLayout>
  );
}
