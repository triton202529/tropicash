import Image from "next/image";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function Home() {
  return (
    <div
      className={`${geistSans.className} ${geistMono.className} flex min-h-screen flex-col bg-gradient-to-br from-slate-100 via-sky-50 to-emerald-100 px-5 py-12 sm:px-10 sm:py-16`}
    >
      <main className="flex flex-1 flex-col items-center justify-center text-center">
        <div className="mb-2 flex justify-center">
          <Image
            src="/tropicash-logo-dark.png"
            alt="Tropicash"
            width={260}
            height={78}
            className="h-auto w-[min(72vw,260px)] object-contain"
            priority
          />
        </div>
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-slate-800 sm:text-3xl">
          Welcome to <span className="text-emerald-600">Tropicash</span>
        </h1>
        <p className="mb-8 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg">
          Send, receive, and manage money across the Caribbean. Fund your wallet, make transfers, request withdrawals, and
          track everything from one secure place.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/auth"
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 sm:text-base"
          >
            Sign In / Sign Up
          </Link>
          <Link
            href="/wallet"
            className="rounded-lg border border-slate-300 bg-white/80 px-6 py-2.5 text-sm font-semibold text-slate-800 shadow-sm backdrop-blur transition hover:bg-white sm:text-base"
          >
            Go to Wallet
          </Link>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-slate-500 sm:text-sm">
        © {new Date().getFullYear()} Tropicash · Powered by Next.js & Supabase
      </footer>
    </div>
  );
}
