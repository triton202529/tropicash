import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Navbar from "../components/Navbar";
import { useUser } from "../lib/userContext";
import {
  fetchUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeUserNotifications,
} from "../lib/notificationService";

function formatListTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchUserNotifications(user.id);
    setItems(rows);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setLoading(false);
      return undefined;
    }

    load();

    const unsubscribe = subscribeUserNotifications(user.id, () => {
      load();
    });

    return () => unsubscribe();
  }, [user?.id, authLoading, load]);

  const handleRowClick = async (n) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setItems((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x))
      );
    }
    if (n.related_transaction_id) {
      router.push(`/transactions/${n.related_transaction_id}`);
    }
  };

  const handleMarkAll = async () => {
    if (!user?.id) return;
    await markAllNotificationsRead(user.id);
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
  };

  const hasUnread = items.some((n) => !n.is_read);

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div className="mx-auto max-w-lg p-6">
          <p className="text-slate-600">Loading…</p>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div className="p-6 max-w-lg mx-auto text-center">
          <p className="text-slate-600">Sign in to view notifications.</p>
          <Link
            href="/login"
            className="inline-block mt-4 text-sky-600 font-semibold hover:text-sky-700"
          >
            Go to login
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="p-6 max-w-lg mx-auto pb-16">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Notifications
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Wallet activity and transfers
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasUnread ? (
              <button
                type="button"
                onClick={handleMarkAll}
                className="text-sm font-semibold text-sky-600 hover:text-sky-700 px-2 py-1"
              >
                Mark all as read
              </button>
            ) : null}
            <Link
              href="/wallet"
              className="text-sm font-semibold text-slate-600 hover:text-slate-800 px-2 py-1"
            >
              Wallet
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-600">Loading…</p>
        ) : items.length === 0 ? (
          <div className="tropicash-surface rounded-xl border border-dashed border-slate-200/90 p-10 text-center">
            <p className="text-slate-700 font-medium">No notifications yet</p>
            <p className="text-sm text-slate-500 mt-2">
              When you send or receive money or fund your wallet, updates will
              appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => handleRowClick(n)}
                  className={`w-full rounded-xl border p-4 text-left shadow-sm transition hover:border-slate-300 hover:shadow ${
                    n.is_read
                      ? "tropicash-surface border-slate-200"
                      : "border-sky-200 bg-sky-50 ring-1 ring-sky-100"
                  }`}
                >
                  <div className="flex justify-between gap-2 items-start">
                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-semibold ${
                          n.is_read ? "text-slate-800" : "text-slate-900"
                        }`}
                      >
                        {n.title}
                      </p>
                      <p className="text-sm text-slate-600 mt-1 leading-snug">
                        {n.message}
                      </p>
                      <p className="text-xs text-slate-400 mt-2">
                        {formatListTime(n.created_at)}
                        {n.related_transaction_id ? (
                          <span className="text-sky-600"> · View details</span>
                        ) : null}
                      </p>
                    </div>
                    {!n.is_read ? (
                      <span
                        className="shrink-0 w-2 h-2 rounded-full bg-sky-500 mt-1.5"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
