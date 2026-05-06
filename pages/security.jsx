import Image from "next/image";
import Link from "next/link";
import Navbar from "../components/Navbar";

const sectionCard = "tropicash-surface rounded-xl p-4 sm:p-5";

const warnBox =
  "rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 sm:text-base";

export default function SecurityCenterPage() {
  return (
    <>
      <Navbar />
      <div className="min-h-[calc(100vh-4rem)] px-4 py-8 sm:px-6 sm:py-10">
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Security Center</h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
              Learn how we help protect your wallet, your account, and every transaction—so you can use Tropicash with
              confidence as we grow.
            </p>
          </div>

          <div className={`${warnBox} mb-8 space-y-2`}>
            <p className="font-bold text-red-900">Never share with anyone claiming to be Tropicash:</p>
            <ul className="list-inside list-disc space-y-1 text-left font-medium">
              <li>Tropicash will never ask for your password.</li>
              <li>Tropicash will never ask for verification codes.</li>
              <li>Tropicash will never ask you to send money to &quot;unlock&quot; your account.</li>
            </ul>
          </div>

          <div className="mb-8 space-y-4">
            <h2 className="text-lg font-bold text-slate-800 sm:text-xl">Guidance</h2>

            <div className={sectionCard}>
              <h3 className="mb-2 font-semibold text-slate-900">Protect your account</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Use a strong, unique password and sign out on shared devices. Review your profile and notification
                settings regularly. If something looks wrong, change your password and contact us.
              </p>
            </div>

            <div className={sectionCard}>
              <h3 className="mb-2 font-semibold text-slate-900">Recognize scams</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Scammers may impersonate support, offer fake refunds, or pressure you to act fast. Legitimate Tropicash
                communication will not ask for sensitive credentials or unsolicited payments to random accounts.
              </p>
            </div>

            <div className={sectionCard}>
              <h3 className="mb-2 font-semibold text-slate-900">Safe wallet practices</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                Double-check recipient details before sending money. Keep records of funding and withdrawals. Only use
                official Tropicash links and the in-app flows you trust.
              </p>
            </div>

            <div className={sectionCard}>
              <h3 className="mb-2 font-semibold text-slate-900">Reporting suspicious activity</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                If you notice unauthorized access, strange messages, or transactions you did not make, reach out through
                our support channel as soon as you can. Early reporting helps protect you and the community.
              </p>
            </div>

            <div className={sectionCard}>
              <h3 className="mb-2 font-semibold text-slate-900">What Tropicash will never ask for</h3>
              <p className="text-sm leading-relaxed text-slate-600">
                We will not ask for your full card number by email, SMS codes to &quot;verify&quot; your login, remote
                access to your device, or payments to personal wallets to restore service. When in doubt, open the app
                or website yourself and use Help → Support.
              </p>
            </div>
          </div>

          <div className="tropicash-surface flex flex-col items-center gap-3 rounded-xl px-4 py-6 text-center sm:px-6">
            <p className="text-sm font-medium text-slate-700 sm:text-base">Need help or want to report an issue?</p>
            <Link
              href="/support"
              className="inline-flex w-full max-w-xs items-center justify-center rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 sm:text-base"
            >
              Go to Support
            </Link>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            <Link href="/" className="font-semibold text-blue-700 hover:underline">
              ← Back to home
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
