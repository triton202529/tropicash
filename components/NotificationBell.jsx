import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useNotifications } from "../hooks/useNotifications";
import { useUser } from "../lib/userContext";

function formatRelativeTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 45) return "Just now";
  if (min < 60) return `${min} min ago`;
  if (hr < 24) return `${hr} hr ago`;
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Left accent + label + compact icon for notification type */
function typePresentation(typeRaw) {
  const t = String(typeRaw || "").toLowerCase();
  if (t.includes("fraud")) {
    return {
      bar: "bg-red-500",
      label: "Security",
      text: "text-red-800",
      icon: "shield",
    };
  }
  if (
    t === "withdraw_wallet" ||
    t.startsWith("withdrawal_") ||
    t === "admin_withdrawal_request"
  ) {
    return {
      bar: "bg-amber-500",
      label: "Withdrawal",
      text: "text-amber-900",
      icon: "withdraw",
    };
  }
  if (t === "fund_wallet" || t === "wallet_funded") {
    return {
      bar: "bg-emerald-500",
      label: "Funding",
      text: "text-emerald-900",
      icon: "wallet",
    };
  }
  if (t === "send_money" || t === "money_sent") {
    return { bar: "bg-sky-500", label: "Send", text: "text-sky-900", icon: "send" };
  }
  if (t === "receive_money" || t === "money_received") {
    return {
      bar: "bg-violet-500",
      label: "Receive",
      text: "text-violet-900",
      icon: "receive",
    };
  }
  return { bar: "bg-slate-400", label: "Update", text: "text-slate-800", icon: "bell" };
}

function TypeGlyph({ name, className }) {
  const cn = `h-3.5 w-3.5 shrink-0 ${className || ""}`;
  switch (name) {
    case "shield":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      );
    case "withdraw":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      );
    case "wallet":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      );
    case "send":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      );
    case "receive":
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      );
    default:
      return (
        <svg className={cn} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5" />
        </svg>
      );
  }
}

/** Spec: fraud → /support, withdrawals → /withdraw, transactions (and default) → /transactions */
function routeForNotification(n) {
  const t = String(n.type || "").toLowerCase();
  if (t.includes("fraud")) return "/support";
  if (
    t === "withdraw_wallet" ||
    t.startsWith("withdrawal_") ||
    t === "admin_withdrawal_request"
  ) {
    return "/withdraw";
  }
  return "/transactions";
}

export default function NotificationBell() {
  const { user } = useUser();
  const router = useRouter();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead, refresh } = useNotifications(user?.id);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const handleMarkAll = async () => {
    await markAllAsRead();
  };

  const handleRowClick = async (item) => {
    if (!item.is_read) await markAsRead(item.id);
    setOpen(false);
    const path = routeForNotification(item);
    await router.push(path);
  };

  if (!user) return null;

  const dropdownSurfaceStyle = {
    background: "rgba(255, 255, 255, 0.94)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "1px solid #e2e8f0",
    borderRadius: "20px",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.15)",
    transition: "all 0.2s ease",
    zIndex: 10000,
  };

  return (
    <div ref={rootRef} className="relative" style={{ zIndex: 9999 }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes notification-dropdown-enter {
              from { opacity: 0; transform: translateY(6px); }
              to { opacity: 1; transform: translateY(0); }
            }
            .notification-dropdown-panel {
              animation: notification-dropdown-enter 0.2s ease forwards;
            }
          `,
        }}
      />
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 text-white shadow-md shadow-black/10 transition hover:bg-white/20 sm:h-11 sm:w-11"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-[1.05rem] min-w-[1.05rem] items-center justify-center rounded-full border-2 border-white/90 bg-amber-400 px-0.5 text-[0.58rem] font-bold leading-none text-slate-900 shadow-sm ring-1 ring-amber-600/25"
            title="Unread notifications"
            aria-label="Unread notifications"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={[
            "notification-dropdown-panel flex max-h-[min(70vh,28rem)] flex-col overflow-hidden text-slate-900",
            "fixed left-3 right-3 top-[72px] z-[10000] w-auto max-w-[calc(100vw-1.5rem)]",
            "sm:left-auto sm:right-4 sm:w-[22rem] sm:max-w-[min(22rem,calc(100vw-2rem))]",
          ].join(" ")}
          style={dropdownSurfaceStyle}
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] bg-transparent px-3 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 ? (
                <>
                  <span className="text-[0.7rem] font-semibold text-sky-700">{unreadCount} unread</span>
                  <button
                    type="button"
                    onClick={handleMarkAll}
                    className="rounded-md bg-sky-50 px-2 py-1 text-[0.7rem] font-semibold text-sky-800 hover:bg-sky-100"
                  >
                    Mark all as read
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {!loading &&
          unreadCount > 0 &&
          notifications.length > 0 &&
          notifications.every((n) => n.is_read) ? (
            <div className="shrink-0 border-b border-amber-100/80 bg-amber-50/40 px-3 py-2 text-xs leading-snug text-amber-950">
              You have older unread notifications. Open your inbox to review them.
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-transparent">
            {loading ? (
              <p className="px-3 py-4 text-center text-sm text-slate-500">Loading…</p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">No notifications yet</p>
            ) : (
              notifications.map((item) => {
                const tp = typePresentation(item.type);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full gap-2 border-b border-slate-100/90 bg-transparent px-3 py-2.5 text-left transition hover:bg-[#f1f5f9]"
                    onClick={() => void handleRowClick(item)}
                  >
                    <span className={`mt-1 w-1 shrink-0 self-stretch rounded-full ${tp.bar}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <TypeGlyph name={tp.icon} className={tp.text} />
                        <span className={`rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase ${tp.text} bg-white/80`}>
                          {tp.label}
                        </span>
                        {!item.is_read ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" aria-label="Unread" />
                        ) : null}
                      </div>
                      <p className="mt-0.5 break-words text-sm font-semibold leading-snug text-slate-900">
                        {item.title}
                      </p>
                      <p className="mt-0.5 break-words text-xs leading-snug text-slate-600">{item.message}</p>
                      <p className="mt-1 text-[0.7rem] text-slate-400">{formatRelativeTime(item.created_at)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="shrink-0 border-t border-[#e2e8f0] bg-transparent px-3 py-2 text-center">
            <button
              type="button"
              className="text-xs font-semibold text-sky-700 hover:text-sky-800 hover:underline"
              onClick={() => {
                setOpen(false);
                router.push("/notifications");
              }}
            >
              View all in inbox
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
