import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useNotifications } from "../hooks/useNotifications";
import { useUser } from "../lib/userContext";

function formatWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationBell() {
  const { user } = useUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markAsRead, refresh } = useNotifications(user?.id);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  if (!user) return null;

  return (
    <div className="relative z-20">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-blue-700 hover:bg-blue-800 text-white"
        aria-label="Notifications"
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
          <span className="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-amber-400 text-blue-900 text-[0.65rem] font-bold leading-none flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 ? (
              <span className="text-[0.7rem] text-sky-700 font-semibold">{unreadCount} unread</span>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-4 text-sm text-slate-500">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500">No notifications yet.</p>
            ) : (
              notifications.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 border-b border-slate-100 hover:bg-slate-50 ${
                    item.is_read ? "bg-white" : "bg-sky-100"
                  }`}
                  onClick={async () => {
                    if (!item.is_read) await markAsRead(item.id);
                    setOpen(false);
                    router.push("/transactions");
                  }}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                        item.is_read ? "bg-slate-300" : "bg-sky-500"
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{item.message}</p>
                      <p className="text-[0.7rem] text-slate-500 mt-1">{formatWhen(item.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
