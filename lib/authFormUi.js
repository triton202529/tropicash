/** Shared layout + styling for auth pages (UI only). */

export const authPageShellClass =
  "flex min-h-[calc(100vh-4.5rem)] w-full flex-col items-center justify-center bg-transparent px-4 py-8 sm:px-6";

export const authTopRowClass = "mb-4 flex w-full max-w-[28rem] flex-wrap items-center gap-x-4 gap-y-2";

export const authCardClass =
  "w-full max-w-[28rem] rounded-2xl border border-[#e2e8f0] bg-[rgba(255,255,255,0.94)] p-6 shadow-[0_20px_50px_rgba(15,23,42,0.08)] backdrop-blur-[8px]";

export const authTitleClass = "text-xl font-semibold tracking-tight text-[#0f172a] sm:text-2xl";

export const authSubtitleClass = "mt-2 text-sm leading-relaxed text-[#64748b]";

export const authLabelClass = "block text-sm font-semibold text-[#334155]";

export const authInputClass =
  "w-full box-border rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 text-base text-[#0f172a] outline-none transition-[border-color,box-shadow] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)]";

export const authPrimaryBtnClass =
  "w-full rounded-xl border-0 bg-[#10b981] py-3 text-center text-base font-semibold text-white shadow-sm transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(0,0,0,0.1)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-sm";

export const authLinkClass = "text-sm font-semibold text-[#2563eb] no-underline hover:underline";

export const authFormStackClass = "mt-6 flex w-full flex-col gap-4";

export const authErrorBoxClass =
  "rounded-xl border border-red-100 bg-red-50/90 px-3 py-2 text-sm text-[#dc2626]";

export const authSuccessBoxClass =
  "rounded-xl border border-emerald-100 bg-emerald-50/90 px-3 py-2 text-sm text-[#16a34a]";

export const authFooterMutedClass = "mt-6 text-center text-sm text-[#64748b]";

export const authInlineToggleClass =
  "border-0 bg-transparent p-0 text-sm font-semibold text-[#2563eb] underline-offset-2 hover:underline";
