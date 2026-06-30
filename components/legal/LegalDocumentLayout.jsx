import Link from "next/link";
import Navbar from "../Navbar";
import { LEGAL_PUBLISHED_NOTICE, LEGAL_DOC_VERSION, LEGAL_EFFECTIVE_DATE } from "../../lib/legalDocumentMeta";

/** @deprecated */
export const LEGAL_DRAFT_BANNER = LEGAL_PUBLISHED_NOTICE;

/**
 * Shared layout for /legal/* policy pages.
 * @param {{ title: string; children: React.ReactNode; relatedLinks?: Array<{ href: string; label: string }>; published?: boolean; version?: string; effectiveDate?: string }} props
 */
export default function LegalDocumentLayout({
  title,
  children,
  relatedLinks = [],
  published = true,
  version = LEGAL_DOC_VERSION,
  effectiveDate = LEGAL_EFFECTIVE_DATE,
}) {
  return (
    <>
      <Navbar />
      <div className="mx-auto max-w-2xl px-4 py-8 pb-16 sm:px-6 sm:py-10">
        {published ? (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-emerald-950">
            {LEGAL_PUBLISHED_NOTICE}
          </p>
        ) : (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-medium leading-relaxed text-amber-950">
            Draft — not yet published.
          </p>
        )}

        <nav className="mb-4 text-sm text-slate-500">
          <Link href="/legal" className="font-semibold text-blue-700 hover:underline">
            Legal &amp; compliance
          </Link>
          <span className="mx-1.5" aria-hidden>
            /
          </span>
          <span className="text-slate-700">{title}</span>
        </nav>

        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Version {version} · Effective {effectiveDate} · Not legal advice
        </p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-slate-700 sm:text-base">{children}</div>

        {relatedLinks.length > 0 ? (
          <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Related policies</p>
            <ul className="space-y-1">
              {relatedLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="font-semibold text-blue-700 hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-sm text-slate-500">
          <Link href="/legal" className="font-semibold text-blue-700 hover:underline">
            ← All legal documents
          </Link>
          <span className="hidden text-slate-300 sm:inline" aria-hidden>
            |
          </span>
          <Link href="/support" className="font-semibold text-blue-700 hover:underline">
            Support
          </Link>
        </p>
      </div>
    </>
  );
}
