import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "../components/Navbar";

const ISSUE_TYPES = [
  { value: "", label: "Select issue type…" },
  { value: "funding", label: "Wallet funding issues" },
  { value: "sending", label: "Sending money issues" },
  { value: "withdrawal", label: "Withdrawal delays" },
  { value: "account", label: "Account / security issues" },
  { value: "fraud", label: "Fraud or suspicious activity" },
  { value: "other", label: "Other" },
];

const sectionCard =
  "rounded-xl border border-slate-200 bg-white/95 p-4 shadow-sm sm:p-5";

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [issueType, setIssueType] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <>
      <Navbar />
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
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
          </div>

          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:text-base">
            <strong className="font-semibold">Important:</strong> Tropicash will never ask for your password or
            verification codes. If someone claims to be support and asks for these, do not share them—contact us only
            through official channels.
          </div>

          <div className="mb-8 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Common topics</h2>
            <div className={sectionCard}>
              <h3 className="mb-1 font-semibold text-slate-900">Wallet funding issues</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Problems adding money with PayPal, delays seeing funds, or receipt mismatches. Include approximate time
                and amount in your message.
              </p>
            </div>
            <div className={sectionCard}>
              <h3 className="mb-1 font-semibold text-slate-900">Sending money issues</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Transfers that did not complete, wrong recipient details, or errors when sending from your wallet.
              </p>
            </div>
            <div className={sectionCard}>
              <h3 className="mb-1 font-semibold text-slate-900">Withdrawal delays</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Manual withdrawals during beta can take time. Share your request date and payout method if applicable.
              </p>
            </div>
            <div className={sectionCard}>
              <h3 className="mb-1 font-semibold text-slate-900">Account / security issues</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Login problems, profile updates, device access, or concerns about your account safety.
              </p>
            </div>
            <div className={sectionCard}>
              <h3 className="mb-1 font-semibold text-slate-900">Fraud or suspicious activity</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Report scams, unauthorized transactions, or messages impersonating Tropicash. We take these reports
                seriously.
              </p>
            </div>
          </div>

          <div className={`${sectionCard} mb-8`}>
            <h2 className="mb-4 text-lg font-bold text-slate-800">Contact form</h2>
            {submitted ? (
              <div
                role="status"
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 sm:text-base"
              >
                Thank you—your message has been noted. In production, this will be sent to our team. For now, please
                also email{" "}
                <a href="mailto:support@tropicash.com" className="font-semibold underline">
                  support@tropicash.com
                </a>{" "}
                if you need a quick response.
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
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

          <p className="text-center text-sm text-slate-500">
            <Link href="/" className="font-semibold text-blue-700 hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
