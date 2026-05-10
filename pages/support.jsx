import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../components/Navbar";
import SoftLaunchNotice from "../components/SoftLaunchNotice";

const ISSUE_TYPES = [
  { value: "", label: "What do you need help with?" },
  { value: "funding", label: "Funding issue" },
  { value: "sending", label: "Sending issue" },
  { value: "withdrawal", label: "Withdrawal issue" },
  { value: "account", label: "Account / security issue" },
  { value: "fraud", label: "Fraud / suspicious activity" },
  { value: "other", label: "Other" },
];

const sectionCard = "tropicash-surface rounded-xl p-4 sm:p-5";

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [issueType, setIssueType] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [formError, setFormError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    if (!issueType) {
      setFormError("Please choose an issue type so we can route your request.");
      return;
    }
    setSubmitted(true);
  };

  return (
    <>
      <Navbar />
      <div className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <SoftLaunchNotice />
          </div>
          <div className="mb-8 flex flex-col items-center text-center">
            <Image
              src="/tropicash-logo-dark.png"
              alt="Tropicash"
              width={200}
              height={60}
              className="mb-4 h-auto w-[min(200px,55vw)] object-contain"
              priority
            />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">How can we help?</h1>
            <p className="mt-2 max-w-md text-sm text-slate-600 sm:text-base">
              Email us at{" "}
              <a href="mailto:support@tropicash.com" className="font-semibold text-blue-700 hover:underline">
                support@tropicash.com
              </a>
            </p>
            <p className="mt-3 text-sm sm:text-base">
              <Link href="/security" className="font-semibold text-blue-700 hover:underline">
                Security Center →
              </Link>
            </p>
          </div>

          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:text-base">
            <strong className="font-semibold">Important:</strong> Tropicash will never ask for your password or
            verification codes. If someone claims to be support and asks for these, do not share them—contact us only
            through official channels.
          </div>

          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-800 sm:text-base">
            <strong className="font-semibold text-slate-900">If money is involved:</strong> If this issue involves
            missing funds, failed funding, or a withdrawal problem, please include the{" "}
            <strong className="font-semibold">transaction amount</strong>, <strong className="font-semibold">date</strong>
            , and <strong className="font-semibold">reference</strong> (for example order ID or transaction ID from your
            history) if you have one. That helps us find your activity quickly.
          </div>

          <div className="mb-8 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Common topics</h2>
            <div className={sectionCard}>
              <h3 className="mb-2 font-semibold text-slate-900">Quick guide</h3>
              <ul className="m-0 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">
                <li>
                  <strong className="text-slate-800">Funding:</strong> PayPal or card (via PayPal), delays, or wrong
                  amount credited.
                </li>
                <li>
                  <strong className="text-slate-800">Sending:</strong> Transfers that failed or wrong recipient.
                </li>
                <li>
                  <strong className="text-slate-800">Withdrawals:</strong> Payout requests are reviewed; status updates
                  appear in the app.
                </li>
                <li>
                  <strong className="text-slate-800">Account / fraud:</strong> Login, security, scams, or suspicious
                  messages.
                </li>
              </ul>
            </div>
          </div>

          <div className={`${sectionCard} mb-8`}>
            <h2 className="mb-4 text-lg font-bold text-slate-800">Contact form</h2>
            {submitted ? (
              <div
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 sm:text-base"
              >
                Thank you—your message has been recorded. Our team reviews support requests regularly. For the fastest
                help with urgent or money-related issues, also email{" "}
                <a href="mailto:support@tropicash.com" className="font-semibold underline">
                  support@tropicash.com
                </a>
                .
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError ? (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-900">
                    {formError}
                  </p>
                ) : null}
                <div>
                  <label htmlFor="support-name" className="mb-1 block text-sm font-semibold text-slate-700">
                    Name
                  </label>
                  <input
                    id="support-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2"
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label htmlFor="support-email" className="mb-1 block text-sm font-semibold text-slate-700">
                    Email
                  </label>
                  <input
                    id="support-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <label htmlFor="support-issue" className="mb-1 block text-sm font-semibold text-slate-700">
                    Issue type
                  </label>
                  <select
                    id="support-issue"
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2"
                  >
                    {ISSUE_TYPES.map((opt) => (
                      <option key={opt.value || "empty"} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="support-message" className="mb-1 block text-sm font-semibold text-slate-700">
                    Message
                  </label>
                  <textarea
                    id="support-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none ring-blue-500/20 focus:border-blue-500 focus:ring-2"
                    placeholder="Describe what happened and any relevant dates or amounts."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:text-base"
                >
                  Submit
                </button>
              </form>
            )}
          </div>

          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm text-slate-500">
            <Link href="/" className="font-semibold text-blue-700 hover:underline">
              ← Back to home
            </Link>
            <span className="hidden text-slate-300 sm:inline" aria-hidden>
              |
            </span>
            <Link href="/privacy" className="font-semibold text-blue-700 hover:underline">
              Privacy
            </Link>
            <span className="text-slate-300" aria-hidden>
              |
            </span>
            <Link href="/terms" className="font-semibold text-blue-700 hover:underline">
              Terms
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
