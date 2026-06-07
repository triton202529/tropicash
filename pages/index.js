import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import SoftLaunchNotice from "@/components/SoftLaunchNotice";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const featureCardBaseClass =
  "group flex flex-col overflow-hidden rounded-2xl bg-[rgba(255,255,255,0.92)] text-left shadow-[0_10px_30px_rgba(0,0,0,0.06)] backdrop-blur-[6px] transition-all duration-200 ease-in-out hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] border border-[rgba(226,232,240,0.9)]";

const ctaPrimaryClass =
  "rounded-lg bg-tropicash-green px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-tropicash-green-hover hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

const ctaSecondaryClass =
  "rounded-lg border border-[rgba(226,232,240,0.9)] bg-[rgba(255,255,255,0.92)] px-6 py-2.5 text-sm font-semibold text-slate-800 shadow-md backdrop-blur-[6px] transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-white/95 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] sm:text-base";

const FEATURES = [
  {
    accent: "#2563eb",
    icon: "💸",
    title: "Send Money",
    text: "Instantly send money to anyone across the Caribbean.",
  },
  {
    accent: "#159669",
    icon: "💳",
    title: "Fund Wallet",
    text: "Add funds securely using your preferred payment method.",
  },
  {
    accent: "#f43f5e",
    icon: "🏦",
    title: "Withdraw Funds",
    text: "Easily withdraw your balance to your account.",
  },
];

export default function Home() {
  return (
    <div
      className={`${geistSans.className} ${geistMono.className} flex min-h-screen flex-col overflow-x-hidden bg-transparent px-5 py-8 sm:px-10 sm:py-10`}
    >
      <main className="flex w-full max-w-6xl flex-1 flex-col items-center self-center">
        {/* Hero */}
        <section className="flex w-full flex-col items-center pb-8 text-center sm:pb-10">
          <div className="mb-1.5 flex justify-center sm:mb-2">
            <Image
              src="/tropicash-logo-dark.png"
              alt="Tropicash"
              width={260}
              height={78}
              className="h-auto w-[min(72vw,260px)] object-contain"
              priority
            />
          </div>
          <h1 className="mb-4 max-w-xl text-[1.65rem] font-bold leading-[1.15] tracking-tight text-slate-800 sm:mb-5 sm:text-4xl sm:leading-[1.12]">
            Welcome to <span className="text-tropicash-green">Tropicash</span>
          </h1>
          <p className="mb-6 max-w-md text-base leading-relaxed text-slate-600 sm:mb-7 sm:text-lg">
            Send, receive, and manage money across the Caribbean. Fund your wallet, make transfers, request withdrawals,
            and track everything from one secure place.
          </p>

          <div className="mb-6 w-full max-w-md">
            <SoftLaunchNotice />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-5">
            <Link href="/auth" className={ctaPrimaryClass}>
              Sign In / Sign Up
            </Link>
            <Link href="/wallet" className={ctaSecondaryClass}>
              Go to Wallet
            </Link>
          </div>
          <p className="mt-6 max-w-md text-center text-sm leading-relaxed text-slate-600">
            Helping us test? Send structured feedback from{" "}
            <Link href="/support" className="font-semibold text-blue-700 hover:underline">
              Support
            </Link>{" "}
            after you sign in.
          </p>
        </section>

        {/* Features */}
        <section
          className="mt-12 w-full pb-12 pt-2 sm:mt-14 sm:pb-14 sm:pt-4"
          aria-labelledby="features-heading"
        >
          <h2 id="features-heading" className="sr-only">
            Product features
          </h2>
          <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            {FEATURES.map((f) => (
              <article key={f.title} className={featureCardBaseClass}>
                <div
                  className="h-1 w-full shrink-0 rounded-full"
                  style={{ height: 4, background: f.accent }}
                  aria-hidden
                />
                <div className="flex flex-col p-8 pt-7">
                  <span className="mb-3 text-2xl leading-none sm:text-[1.75rem]" aria-hidden>
                    {f.icon}
                  </span>
                  <h3 className="mb-2 text-lg font-bold text-slate-900 sm:text-xl">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600 sm:text-[0.9375rem]">{f.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Trust */}
        <section
          className="mt-12 w-full max-w-2xl pb-10 text-center sm:mt-14 sm:pb-12"
          aria-labelledby="trust-heading"
        >
          <h2 id="trust-heading" className="mb-3 text-xl font-bold tracking-tight text-slate-800 sm:mb-4 sm:text-2xl">
            Secure, fast, and reliable
          </h2>
          <p className="mb-8 text-base leading-relaxed text-slate-600 sm:text-lg">
            Built with modern infrastructure to ensure your money and data are protected at all times.
          </p>
          <ul className="mx-auto flex max-w-lg flex-col items-center gap-4 text-base text-slate-600 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-10 sm:gap-y-3 sm:text-[1.0625rem]">
            <li>• Real-time updates</li>
            <li>• Secure transactions</li>
            <li>• Fast transfers</li>
          </ul>
        </section>
      </main>

      <footer
        className="mt-10 flex w-full max-w-6xl flex-col items-center gap-2 self-center border-t border-slate-200/80 pt-8 text-center text-xs sm:mt-12 sm:text-sm"
        style={{ color: "#64748b" }}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/support" className="font-semibold text-blue-700 hover:underline">
            Help & support
          </Link>
          <Link href="/security" className="font-semibold text-blue-700 hover:underline">
            Security Center
          </Link>
          <Link href="/legal" className="font-semibold text-blue-700 hover:underline">
            Legal &amp; compliance
          </Link>
          <Link href="/legal/privacy" className="font-semibold text-blue-700 hover:underline">
            Privacy
          </Link>
          <Link href="/legal/terms" className="font-semibold text-blue-700 hover:underline">
            Terms
          </Link>
        </div>
        <span>© {new Date().getFullYear()} Tropicash · Powered by Next.js & Supabase</span>
      </footer>
    </div>
  );
}
