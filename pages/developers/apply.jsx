import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../../components/Navbar";
import {
  ALLOWED_SANDBOX_CAPABILITIES,
  fetchOwnSandboxApplications,
  submitDeveloperSandboxApplication,
} from "../../lib/developerSandboxApplications";
import { normalizeDeveloperEmail } from "../../lib/developerAccessGate";
import { useUser } from "../../lib/userContext";

const NOTICE =
  "Submitting an application does not guarantee access. Tropicash Sandbox remains a controlled testing environment.";

const SUCCESS_MESSAGE =
  "Application submitted. Status: Pending review. No credentials have been issued.";

const labelClass = "mb-1 block text-sm font-semibold text-slate-700";
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2";

const cardClass = "tropicash-surface rounded-2xl p-5 sm:p-6";

function statusBadge(status) {
  const key = String(status || "").toLowerCase();
  const map = {
    pending: "bg-amber-50 text-amber-900 border-amber-200",
    under_review: "bg-sky-50 text-sky-900 border-sky-200",
    approved: "bg-emerald-50 text-emerald-900 border-emerald-200",
    rejected: "bg-red-50 text-red-900 border-red-200",
  };
  return map[key] || "bg-slate-50 text-slate-700 border-slate-200";
}

export default function DeveloperSandboxApplyPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useUser();

  const [organizationName, setOrganizationName] = useState("");
  const [developerName, setDeveloperName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [country, setCountry] = useState("");
  const [useCase, setUseCase] = useState("");
  const [capabilities, setCapabilities] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");
  const [ownApplications, setOwnApplications] = useState([]);

  const loadOwn = useCallback(async () => {
    const { data } = await fetchOwnSandboxApplications();
    setOwnApplications(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent("/developers/apply")}`);
      return;
    }
    if (profile?.full_name?.trim()) {
      setDeveloperName((prev) => (prev.trim() ? prev : profile.full_name.trim()));
    }
    const sessionEmail = normalizeDeveloperEmail(user.email);
    if (sessionEmail) {
      setEmail((prev) => (prev.trim() ? prev : sessionEmail));
    }
    void loadOwn();
  }, [authLoading, user, profile, router, loadOwn]);

  function toggleCapability(id) {
    setCapabilities((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");

    if (!organizationName.trim()) {
      setFormError("Organization name is required.");
      return;
    }
    if (!developerName.trim()) {
      setFormError("Developer name is required.");
      return;
    }
    if (!email.trim()) {
      setFormError("Email is required.");
      return;
    }
    if (!country.trim()) {
      setFormError("Country is required.");
      return;
    }
    if (!useCase.trim()) {
      setFormError("Intended use case is required.");
      return;
    }
    if (!capabilities.length) {
      setFormError("Select at least one sandbox capability.");
      return;
    }

    setSubmitting(true);
    const { error } = await submitDeveloperSandboxApplication({
      user_id: user.id,
      organization_name: organizationName,
      developer_name: developerName,
      email,
      website,
      country,
      use_case: useCase,
      requested_capabilities: capabilities,
    });
    setSubmitting(false);

    if (error) {
      setFormError(error.message || "Failed to submit application.");
      return;
    }

    setSubmitted(true);
    await loadOwn();
  }

  if (authLoading || !user) {
    return (
      <>
        <Navbar />
        <div className="px-4 py-10">
          <p className="text-slate-600">Loading…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="px-4 py-8 pb-16 sm:px-6 sm:py-10">
        <main className="mx-auto w-full max-w-2xl">
          <Link
            href="/developers/get-started"
            className="text-sm font-semibold text-tropicash-green-hover underline"
          >
            ← Developer onboarding
          </Link>

          <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
            Apply for Sandbox Access
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Request controlled access to the Tropicash Developer Sandbox. Sandbox only — no
            production credentials or money movement.
          </p>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {NOTICE}
          </div>

          {submitted ? (
            <div className={`${cardClass} mt-6`}>
              <h2 className="text-lg font-semibold text-emerald-900">Application submitted</h2>
              <p className="mt-2 text-sm text-slate-700">{SUCCESS_MESSAGE}</p>
              <p className="mt-3 text-sm text-slate-600">
                Tropicash will review your application. Approval records authorization only —
                you must separately issue sandbox API credentials in the Developer Console.
              </p>
              <button
                type="button"
                className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800"
                onClick={() => setSubmitted(false)}
              >
                Submit another application
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className={`${cardClass} mt-6 space-y-4`}>
              <div>
                <label className={labelClass} htmlFor="org-name">
                  Organization name
                </label>
                <input
                  id="org-name"
                  className={inputClass}
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="dev-name">
                  Developer name
                </label>
                <input
                  id="dev-name"
                  className={inputClass}
                  value={developerName}
                  onChange={(e) => setDeveloperName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="website">
                  Website (optional)
                </label>
                <input
                  id="website"
                  type="url"
                  className={inputClass}
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="country">
                  Country
                </label>
                <input
                  id="country"
                  className={inputClass}
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="use-case">
                  Intended use case
                </label>
                <textarea
                  id="use-case"
                  className={`${inputClass} min-h-[100px]`}
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  required
                />
              </div>
              <fieldset>
                <legend className={labelClass}>Requested sandbox capabilities</legend>
                <ul className="mt-2 space-y-2">
                  {ALLOWED_SANDBOX_CAPABILITIES.map((cap) => (
                    <li key={cap.id}>
                      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={capabilities.includes(cap.id)}
                          onChange={() => toggleCapability(cap.id)}
                        />
                        <span>
                          <span className="font-semibold text-slate-900">{cap.label}</span>
                          <span className="mt-0.5 block text-slate-600">{cap.description}</span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>

              {formError ? (
                <p className="text-sm font-medium text-red-700" role="alert">
                  {formError}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-tropicash-green px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-tropicash-green-hover disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit application"}
              </button>
            </form>
          )}

          {ownApplications.length ? (
            <section className={`${cardClass} mt-6`}>
              <h2 className="text-lg font-bold text-slate-900">Your applications</h2>
              <ul className="mt-4 space-y-3">
                {ownApplications.map((app) => (
                  <li
                    key={app.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{app.organization_name}</span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${statusBadge(app.status)}`}
                      >
                        {app.status}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600">
                      Submitted {new Date(app.created_at).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </main>
      </div>
    </>
  );
}
