import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { submitDeveloperAccessRequest } from "../../lib/developerAccessRequests";
import { normalizeDeveloperEmail } from "../../lib/developerAccessGate";
import { DEVELOPER_ACCESS_USE_CASES } from "../../lib/developerCenterConfig";
import { useUser } from "../../lib/userContext";

const SUCCESS_MESSAGE =
  "Developer access request received. Tropicash will review your request before you can sign in to the Developer Console. Approval grants console entry only — not organizations, apps, or API keys.";

const labelClass = "mb-1 block text-sm font-semibold text-slate-700";
const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2";

export default function RequestAccessPage() {
  const { user, loading: authLoading } = useUser();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [useCase, setUseCase] = useState("");
  const [message, setMessage] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (authLoading || !user?.email) return;
    const sessionEmail = normalizeDeveloperEmail(user.email);
    if (sessionEmail) {
      setEmail((prev) => (prev.trim() ? prev : sessionEmail));
    }
  }, [authLoading, user?.email]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim();
    const trimmedCompany = companyName.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName) {
      setFormError("Please enter your full name.");
      return;
    }
    if (!trimmedEmail) {
      setFormError("Please enter your email so we can follow up.");
      return;
    }
    // Basic email shape check; full validation happens server-side later.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError("That email doesn't look right. Please double-check it.");
      return;
    }
    if (!useCase) {
      setFormError("Please choose a use case so we can route your request.");
      return;
    }

    setSubmitting(true);

    const { error } = await submitDeveloperAccessRequest({
      full_name: trimmedName,
      company_name: trimmedCompany || null,
      email: trimmedEmail,
      use_case: useCase,
      message: trimmedMessage || null,
    });

    setSubmitting(false);

    if (error) {
      setFormError(
        error.message ||
          "We could not save your request. Please try again in a moment.",
      );
      return;
    }

    setSubmitted(true);
    setFullName("");
    setCompanyName("");
    setEmail("");
    setUseCase("");
    setMessage("");
  };

  return (
    <>
      <Navbar />
      <div className="px-4 py-8 pb-16 sm:px-6 sm:py-10">
        <main className="mx-auto flex w-full max-w-2xl flex-col">
          <header className="mb-6 sm:mb-8">
            <p className="text-xs font-semibold uppercase tracking-wide text-tropicash-green-hover">
              Developer Center
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Request Developer Access
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
              Tell us a little about you and what you're building. Tropicash will review
              every request before API access is enabled. There are no API keys generated
              today — this is the foundation for the developer program.
            </p>
          </header>

          {submitted ? (
            <div
              role="status"
              className="tropicash-surface rounded-2xl p-6 sm:p-8"
            >
              <div className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-tropicash-green-tint text-tropicash-green-hover"
                  aria-hidden
                >
                  ✓
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                    Request received
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
                    {SUCCESS_MESSAGE}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                    In the meantime, you can review the{" "}
                    <Link
                      href="/developers/roadmap"
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      API Roadmap
                    </Link>{" "}
                    or head back to the{" "}
                    <Link
                      href="/developers"
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      Developer Center
                    </Link>
                    .
                  </p>
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => setSubmitted(false)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                    >
                      Submit another request
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="tropicash-surface space-y-4 rounded-2xl p-5 sm:p-6"
              noValidate
            >
              {formError ? (
                <p
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900"
                >
                  {formError}
                </p>
              ) : null}

              <div>
                <label htmlFor="dev-fullname" className={labelClass}>
                  Full name
                </label>
                <input
                  id="dev-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                  autoComplete="name"
                  required
                />
              </div>

              <div>
                <label htmlFor="dev-company" className={labelClass}>
                  Company / project name{" "}
                  <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  id="dev-company"
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className={inputClass}
                  autoComplete="organization"
                />
              </div>

              <div>
                <label htmlFor="dev-email" className={labelClass}>
                  Email
                </label>
                <input
                  id="dev-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  autoComplete="email"
                  required
                />
              </div>

              <div>
                <label htmlFor="dev-usecase" className={labelClass}>
                  Use case
                </label>
                <select
                  id="dev-usecase"
                  value={useCase}
                  onChange={(e) => setUseCase(e.target.value)}
                  className={inputClass}
                  required
                >
                  <option value="">Select a use case…</option>
                  {DEVELOPER_ACCESS_USE_CASES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="dev-message" className={labelClass}>
                  Message{" "}
                  <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <textarea
                  id="dev-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className={`${inputClass} resize-y`}
                  placeholder="Tell us about your product, the volumes you expect, and which Tropicash or Blue Atlantic surfaces you'd integrate with."
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-tropicash-green py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-tropicash-green-hover disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
              >
                {submitting ? "Submitting…" : "Submit request"}
              </button>

              <p className="text-xs leading-relaxed text-slate-500">
                By submitting, you agree to Tropicash reviewing this request. We do not
                generate API keys at this stage and we will not share your contact
                details with third parties.
              </p>
            </form>
          )}

          <p className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm text-slate-500">
            <Link
              href="/developers"
              className="font-semibold text-blue-700 hover:underline"
            >
              ← Developer Center
            </Link>
            <span className="text-slate-300" aria-hidden>
              |
            </span>
            <Link
              href="/developers/roadmap"
              className="font-semibold text-blue-700 hover:underline"
            >
              API Roadmap
            </Link>
          </p>
        </main>
      </div>
    </>
  );
}
