import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "../lib/userContext";
import {
  getUnreadNotificationCount,
  fetchUserNotifications,
  markNotificationRead,
  subscribeUserNotifications,
} from "../lib/notificationService";

const PREVIEW_LIMIT = 5;

function formatDropdownTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortMessage(text, maxLen = 88) {
  if (text == null) return "";
  const s = String(text).trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen).trimEnd()}…`;
}

export default function NotificationsBell() {
  const { user } = useUser();
  const router = useRouter();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(true);

  const refreshCount = useCallback(async () => {
    if (!user?.id) {
      setUnread(0);
      return;
    }
    const n = await getUnreadNotificationCount(user.id);
    setUnread(n);
  }, [user?.id]);

  const refreshList = useCallback(async (showSpinner) => {
    if (!user?.id) {
      setItems([]);
      setListLoading(false);
      return;
    }
    if (showSpinner) setListLoading(true);
    const rows = await fetchUserNotifications(user.id, PREVIEW_LIMIT);
    setItems(rows);
    setListLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setUnread(0);
      setItems([]);
      setListLoading(false);
      return undefined;
    }

    refreshCount();
    refreshList(true);

    const unsubscribe = subscribeUserNotifications(user.id, () => {
      refreshCount();
      refreshList(false);
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id, refreshCount, refreshList]);

  useEffect(() => {
    if (!open) return undefined;

    const onDocMouseDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };

    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const badge =
    unread > 0 ? (unread > 99 ? "99+" : String(unread)) : null;

  const toggleOpen = () => {
    setOpen((v) => !v);
  };

  const handleItemClick = async (n) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
      );
      refreshCount();
    }
    setOpen(false);
    if (n.related_transaction_id) {
      router.push(`/transactions/${n.related_transaction_id}`);
    }
  };

  return (
    <div ref={rootRef} className="relative z-[100]">
      <button
        type="button"
        onClick={toggleOpen}
        className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-blue-700 hover:bg-blue-800 text-white transition-colors shadow-sm"
        aria-label={`Notifications${badge ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {badge ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center rounded-full bg-amber-400 text-[0.65rem] font-bold text-blue-900 leading-none ring-2 ring-blue-700">
            {badge}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 mt-2 w-[min(calc(100vw-1.5rem),22rem)] origin-top-right"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="rounded-2xl border border-slate-200/90 bg-white text-slate-900 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.25),0_4px_16px_-4px_rgba(15,23,42,0.12)] overflow-hidden ring-1 ring-black/5">
            <div className="px-4 py-3 border-b border-slate-100 bg-gradient-to-b from-slate-50/90 to-white">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Notifications
                </h2>
                {badge ? (
                  <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full">
                    {unread} new
                  </span>
                ) : null}
              </div>
            </div>

            <div className="max-h-[min(22rem,55vh)] overflow-y-auto overscroll-contain">
              {listLoading ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                  Loading…
                </p>
              ) : items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500 leading-relaxed">
                  You&apos;re all caught up.
                  <span className="block mt-1 text-xs text-slate-400">
                    No notifications yet.
                  </span>
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => handleItemClick(n)}
                        className={`w-full text-left px-4 py-3 transition-colors hover:bg-slate-50/90 focus:outline-none focus-visible:bg-slate-50 ${
                          n.is_read
                            ? "bg-white"
                            : "bg-sky-50/70 border-l-[3px] border-l-sky-500"
                        }`}
                      >
                        <div className="flex gap-2 items-start">
                          {!n.is_read ? (
                            <span
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500"
                              aria-hidden
                            />
                          ) : (
                            <span className="mt-1.5 w-2 shrink-0" aria-hidden />
                          )}
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm leading-snug ${
                                n.is_read
                                  ? "font-medium text-slate-800"
                                  : "font-semibold text-slate-900"
                              }`}
                            >
                              {n.title}
                            </p>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed line-clamp-2">
                              {shortMessage(n.message)}
                            </p>
                            <p className="text-[0.65rem] text-slate-400 mt-2 tabular-nums">
                              {formatDropdownTime(n.created_at)}
                              {n.related_transaction_id ? (
                                <span className="text-sky-600 font-medium">
                                  {" "}
                                  · Tap to open
                                </span>
                              ) : null}
                            </p>
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-slate-100 bg-slate-50/80 px-3 py-2.5">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="flex items-center justify-center gap-1 w-full rounded-lg py-2 text-sm font-semibold text-sky-600 hover:text-sky-700 hover:bg-white/80 transition-colors"
              >
                View all notifications
                <span aria-hidden className="text-xs">
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
