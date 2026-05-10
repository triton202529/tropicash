import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";
import { isAdminUser } from "../lib/adminAccess";
import { getSoftEnforcementState } from "../lib/softEnforcement";
import Image from "next/image";
import NotificationBell from "./NotificationBell";

const navShellStyle = {
  background: "linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)",
  boxShadow: "0 8px 24px rgba(37, 99, 235, 0.22)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.18)",
};

const dropdownPanelClass =
  "absolute right-0 z-10 mt-2 w-52 overflow-hidden rounded-2xl border border-[#e2e8f0] bg-[rgba(255,255,255,0.96)] py-1 text-[#0f172a] shadow-[0_12px_30px_rgba(15,23,42,0.12)]";

const dropdownItemClass =
  "block w-full cursor-pointer rounded-lg px-4 py-2.5 text-left text-sm font-medium text-[#0f172a] transition hover:bg-[#f1f5f9]";

export default function Navbar() {
  const { user, profile, loading, logout } = useUser();
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);

  const handleLogout = async () => {
    setShowDropdown(false);
    if (typeof logout === "function") {
      await logout();
    } else {
      await supabase.auth.signOut();
    }
    await router.replace("/");
  };

  const displayName = profile?.full_name?.split(" ")[0] || "User";

  let accountNoticeDot = false;
  try {
    const st = profile ? getSoftEnforcementState(profile) : null;
    accountNoticeDot = !!(st && st.accountStatus !== "active");
  } catch (e) {
    console.error(e);
  }

  return (
    <>
      <nav
        className="fixed left-0 right-0 top-0 z-50 flex min-h-[4rem] items-center justify-between gap-2 px-3 py-2.5 text-white sm:min-h-[4.5rem] sm:gap-3 sm:px-4 sm:py-3"
        style={navShellStyle}
      >
        <div
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 sm:gap-2.5"
          onClick={() => router.push(user ? "/wallet" : "/")}
        >
          <Image
            src="/tropicash-logo-light.png"
            alt="Tropicash"
            width={120}
            height={36}
            className="h-9 w-auto max-w-[44px] shrink-0 rounded-md object-contain object-left sm:h-10 sm:max-w-[52px]"
            priority
          />
          <span className="hidden truncate text-lg font-bold leading-none tracking-tight text-white sm:inline sm:text-xl">
            Tropicash
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
          <button
            type="button"
            onClick={() => router.push("/support")}
            className="rounded-full bg-white/12 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            Help
          </button>
          <div className="hidden items-center gap-2 border-l border-white/20 pl-2.5 text-[0.7rem] font-semibold text-white/90 sm:flex sm:text-xs">
            <Link href="/privacy" className="whitespace-nowrap hover:underline">
              Privacy
            </Link>
            <span className="text-white/35" aria-hidden>
              ·
            </span>
            <Link href="/terms" className="whitespace-nowrap hover:underline">
              Terms
            </Link>
          </div>
          {loading ? (
            <span className="text-xs font-medium text-white/85 sm:text-sm">Loading...</span>
          ) : user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <NotificationBell />
              <div className="relative z-10">
                <button
                  type="button"
                  onClick={() => setShowDropdown((prev) => !prev)}
                  className="flex items-center gap-2 rounded-xl bg-white/14 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/22"
                >
                  <span className="flex max-w-[7.5rem] items-center gap-1.5 truncate sm:max-w-[11rem]">
                    {displayName}
                    {accountNoticeDot ? (
                      <span
                        className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400"
                        title="Account notice"
                        aria-label="Account notice"
                      />
                    ) : null}
                  </span>
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showDropdown && (
                  <div className={dropdownPanelClass}>
                    <button type="button" onClick={() => router.push("/profile")} className={dropdownItemClass}>
                      View Profile
                    </button>
                    <button type="button" onClick={() => router.push("/support")} className={dropdownItemClass}>
                      Support
                    </button>
                    <button type="button" onClick={() => router.push("/privacy")} className={dropdownItemClass}>
                      Privacy
                    </button>
                    <button type="button" onClick={() => router.push("/terms")} className={dropdownItemClass}>
                      Terms
                    </button>
                    {isAdminUser(user, profile) ? (
                      <>
                        <button type="button" onClick={() => router.push("/admin")} className={dropdownItemClass}>
                          Admin
                        </button>
                        <button type="button" onClick={() => router.push("/admin/alerts")} className={dropdownItemClass}>
                          Alert center
                        </button>
                        <button type="button" onClick={() => router.push("/admin/cases")} className={dropdownItemClass}>
                          Cases
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push("/admin/withdrawals")}
                          className={dropdownItemClass}
                        >
                          Withdrawals
                        </button>
                        <button type="button" onClick={() => router.push("/admin/feedback")} className={dropdownItemClass}>
                          Tester feedback
                        </button>
                      </>
                    ) : null}
                    <button type="button" onClick={handleLogout} className={dropdownItemClass}>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </nav>
      <div className="min-h-[4rem] sm:min-h-[4.5rem]" aria-hidden="true" />
    </>
  );
}
