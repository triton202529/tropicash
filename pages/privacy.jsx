import Link from "next/link";
import Navbar from "../components/Navbar";

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 py-8 pb-16 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Privacy</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">Last updated {new Date().getFullYear()}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700 sm:text-base">
          <p>
            Tropicash is a digital wallet and remittance-style platform in <strong>controlled testing</strong>. This page
            summarizes how we handle information at this stage. It is not a full legal agreement; we may update this
            summary as the product matures.
          </p>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Information we use</h2>
            <p>
              We use account, profile, and transaction data to operate the service: processing payments and transfers,
              showing balances and history, providing customer support, securing accounts, and helping detect fraud or
              abuse. Some activity may be reviewed manually during testing.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Security and fraud prevention</h2>
            <p>
              We may analyze patterns, device or session signals, and transaction metadata to protect users and
              Tropicash. Suspicious activity may be flagged for review. We do not sell your personal data to third
              parties for their marketing.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Your responsibility</h2>
            <p>
              You are responsible for keeping login credentials secure and for providing accurate payout and contact
              details. Incorrect payout information can delay or prevent successful transfers.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Questions</h2>
            <p>
              Contact us through{" "}
              <Link href="/support" className="font-semibold text-blue-700 hover:underline">
                Support
              </Link>{" "}
              if you have privacy-related questions during testing.
            </p>
          </section>
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          <Link href="/" className="font-semibold text-blue-700 hover:underline">
            ← Home
          </Link>
        </p>
      </div>
    </>
  );
}
