/**
 * Short, professional notice for controlled testing (wallet, funding, etc.).
 */
export default function SoftLaunchNotice({ className = "" }) {
  return (
    <div
      role="note"
      className={`rounded-xl border border-sky-200/90 bg-gradient-to-br from-sky-50 to-white px-3 py-2.5 text-left shadow-sm sm:px-4 sm:py-3 ${className}`}
    >
      <p className="m-0 text-xs leading-snug text-slate-800 sm:text-sm sm:leading-relaxed">
        <span className="font-semibold text-sky-950">Controlled testing.</span> Tropicash is currently in controlled
        testing. Some payout methods may be manually reviewed before completion.
      </p>
    </div>
  );
}
