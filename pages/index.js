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
      className={`${geistSans.className} ${geistMono.className} grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 bg-gradient-to-br from-green-100 to-blue-100`}
    >
      <main className="flex flex-col gap-8 row-start-2 items-center text-center">
        <Image
          src="/logo.png" // Replace this with your Tropicash logo
          alt="Tropicash Logo"
          width={120}
          height={120}
          className="rounded-full"
        />
        <h1 className="text-3xl font-bold text-gray-800">
          Welcome to <span className="text-green-600">Tropicash</span>
        </h1>
        <p className="text-gray-600 max-w-md">
          Send and receive money across the Caribbean. Fund your Triton trading account. Manage it all from one place.
        </p>

        <div className="flex gap-4 flex-wrap justify-center">
          <Link href="/auth">
            <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded">
              Sign In / Sign Up
            </button>
          </Link>
          <Link href="/wallet">
            <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded">
              Go to Wallet
            </button>
          </Link>
        </div>
      </main>

      <footer className="row-start-3 text-sm text-gray-500">
        © {new Date().getFullYear()} Tropicash · Powered by Next.js & Supabase
      </footer>
    </div>
  );
}

