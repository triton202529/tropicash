import Link from "next/link";
import Navbar from "../../components/Navbar";
import { LEGAL_DRAFT_BANNER } from "../../components/legal/LegalDocumentLayout";

export const LEGAL_DOCUMENTS = [
  {
    href: "/legal/terms",
    title: "Terms of Service",
    description: "Wallet usage, funding, sending, withdrawals, account suspension, and prohibited activity.",
  },
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    description: "Data collected, KYC documents, transaction records, security logs, storage, and user rights.",
  },
  {
    href: "/legal/kyc-policy",
    title: "KYC Policy",
    description: "Identity verification, document uploads, review statuses, limits, and resubmission.",
  },
  {
    href: "/legal/aml-policy",
    title: "AML Policy",
    description: "Suspicious activity monitoring, reporting readiness, transaction reviews, and sanctions screening.",
  },
  {
    href: "/legal/risk-disclosure",
    title: "Risk Disclosure",
    description: "Wallet and payment risks, delays, third-party providers, restrictions, and availability.",
  },
];

export default function LegalIndexPage() {
  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 py-8 pb-16 sm:px-6 sm:py-10">
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-amber-950">
          {LEGAL_DRAFT_BANNER}
        </p>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Legal &amp; compliance</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Foundational policy drafts for Tropicash operational testing. These documents are placeholders pending formal
          legal review. They do not constitute final legal advice or regulatory approval.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-1">
          {LEGAL_DOCUMENTS.map((doc) => (
            <Link
              key={doc.href}
              href={doc.href}
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-5"
            >
              <h2 className="text-lg font-semibold text-slate-900">{doc.title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{doc.description}</p>
              <span className="mt-3 inline-block text-sm font-semibold text-blue-700">Read draft →</span>
            </Link>
          ))}
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
