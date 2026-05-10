import Link from "next/link";
import Navbar from "../components/Navbar";

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 py-8 pb-16 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Terms of use</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">Last updated {new Date().getFullYear()}</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700 sm:text-base">
          <p>
            Tropicash is a digital wallet and remittance-style platform in <strong>controlled testing</strong>. By
            using the service during this phase, you agree to these simple terms. This is not a substitute for a full
            legal agreement; we may publish more detailed terms later.
          </p>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Testing &amp; availability</h2>
            <p>
              Features, limits, and availability may change without notice. Funding, transfers, or withdrawals may
              require manual review. We may pause or restrict access to protect users or the platform.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Funds &amp; payouts</h2>
            <p>
              Wallet balances and transaction records are shown in the app. Movement of funds to external accounts or
              payment methods may depend on verification, fraud checks, and operational processing—including manual
              steps during testing. You are responsible for accurate payout details.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Acceptable use</h2>
            <p>
              Do not use Tropicash for unlawful activity, abuse, or to harass others. We may investigate suspicious
              activity and cooperate with authorities when required.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Disclaimer</h2>
            <p>
              The service is provided &quot;as is&quot; during testing. To the extent permitted by law, Tropicash is not
              liable for indirect or consequential damages arising from your use of the beta.
            </p>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Contact</h2>
            <p>
              Questions? Visit{" "}
              <Link href="/support" className="font-semibold text-blue-700 hover:underline">
                Support
              </Link>
              .
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
