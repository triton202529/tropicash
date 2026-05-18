import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useUser } from "../lib/userContext";
import {
  fetchUnreadCount,
  fetchUserNotifications,
  markAllRead,
  markNotificationRead,
  subscribeToUserNotifications,
} from "../lib/notifications";

const PREVIEW_LIMIT = 5;
const PANEL_FETCH_LIMIT = 20;

const SEVERITY_DOT = {
  info: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  critical: "#ef4444",
};

const CATEGORY_LABELS = {
  system: "System",
  security: "Security",
  payments: "Payments",
  treasury: "Treasury",
  fraud: "Fraud",
  triton: "Triton",
  admin: "Admin",
  account: "Account",
};

const LEGACY_TYPE_FALLBACK = {
  fund_wallet: { category: "payments", severity: "success" },
  wallet_funded: { category: "payments", severity: "success" },
  receive_money: { category: "payments", severity: "success" },
  money_received: { category: "payments", severity: "success" },
  send_money: { category: "payments", severity: "info" },
  money_sent: { category: "payments", severity: "info" },
  withdraw_wallet: { category: "payments", severity: "info" },
  withdrawal_processing: { category: "payments", severity: "info" },
  withdrawal_paid: { category: "payments", severity: "success" },
  withdrawal_rejected: { category: "payments", severity: "warning" },
  admin_withdrawal_request: { category: "admin", severity: "info" },
  triton_transfer_update: { category: "triton", severity: "info" },
  security_suspicious_login: { category: "security", severity: "warning" },
  security_session_revoked: { category: "security", severity: "warning" },
  security_account_activity: { category: "security", severity: "info" },
};

function presentationFor(row) {
  const cat = String(row?.category || "").toLowerCase();
  const sev = String(row?.severity || "").toLowerCase();
  if (cat && sev) {
    return { category: cat, severity: sev };
  }
  const fallback = LEGACY_TYPE_FALLBACK[String(row?.type || "").toLowerCase()];
  return {
    category: cat || fallback?.category || "system",
    severity: sev || fallback?.severity || "info",
  };
}

function isUnread(row) {
  if (!row) return false;
  if (row.read_at) return false;
  if (row.is_read === true) return false;
  return true;
}

function formatRelative(iso) {
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

function categoryLabel(cat) {
  return CATEGORY_LABELS[cat] || (cat ? cat[0].toUpperCase() + cat.slice(1) : "Update");
}

function routeForRow(row) {
  const cat = String(row?.category || "").toLowerCase();
  const t = String(row?.type || "").toLowerCase();
  if (cat === "security") return "/security";
  if (cat === "fraud") return "/support";
  if (cat === "payments") {
    if (t.includes("withdraw") || t === "withdraw_wallet") return "/withdraw-wallet";
    return "/transactions";
  }
  if (cat === "triton") return "/triton-transfer";
  if (cat === "treasury" || cat === "admin") return "/admin/treasury";
  if (t.includes("fraud")) return "/support";
  if (t === "withdraw_wallet" || t.startsWith("withdrawal_") || t === "admin_withdrawal_request") {
    return "/withdraw-wallet";
  }
  return "/transactions";
}

export default function NotificationBell() {
  const { user } = useUser();
  const router = useRouter();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);
  const recentRef = useRef([]);
  recentRef.current = recent;

  const refreshUnread = useCallback(async () => {
    if (!user?.id) return;
    const c = await fetchUnreadCount({ userId: user.id });
    setUnreadCount(c);
  }, [user?.id]);

  const loadPanel = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { rows } = await fetchUserNotifications({
      userId: user.id,
      limit: PANEL_FETCH_LIMIT,
    });
    setRecent(rows);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      setRecent([]);
      return undefined;
    }
    void refreshUnread();
    return undefined;
  }, [user?.id, refreshUnread]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const unsub = subscribeToUserNotifications(
      user.id,
      (newRow) => {
        if (!newRow?.id) return;
        if (isUnread(newRow)) setUnreadCount((prev) => prev + 1);
        if (recentRef.current.length > 0) {
          setRecent((prev) => {
            if (prev.some((r) => r.id === newRow.id)) return prev;
            return [newRow, ...prev].slice(0, PANEL_FETCH_LIMIT);
          });
        }
      },
      (newRow, oldRow) => {
        if (!newRow?.id) return;
        const wasUnread = !oldRow?.read_at && oldRow?.is_read !== true;
        const nowUnread = !newRow?.read_at && newRow?.is_read !== true;
        if (wasUnread && !nowUnread) setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));
        if (!wasUnread && nowUnread) setUnreadCount((prev) => prev + 1);
        setRecent((prev) =>
          prev.map((r) =>
            r.id === newRow.id
              ? { ...r, ...newRow, read_at: newRow.read_at ?? r.read_at }
              : r,
          ),
        );
      },
    );
    return () => unsub();
  }, [user?.id]);

  useEffect(() => {
    if (!open || !user?.id) return undefined;
    void loadPanel();
    return undefined;
  }, [open, user?.id, loadPanel]);

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

  const handleRowClick = useCallback(
    async (row) => {
      if (!row?.id) return;
      if (isUnread(row)) {
        setRecent((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, read_at: new Date().toISOString(), is_read: true } : r,
          ),
        );
        setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));
        const { ok } = await markNotificationRead(row.id);
        if (!ok) {
          await refreshUnread();
        }
      }
      setOpen(false);
      await router.push(routeForRow(row));
    },
    [refreshUnread, router],
  );

  const handleMarkAll = useCallback(async () => {
    if (!user?.id) return;
    const nowIso = new Date().toISOString();
    setRecent((prev) => prev.map((r) => ({ ...r, read_at: r.read_at || nowIso, is_read: true })));
    setUnreadCount(0);
    const { ok } = await markAllRead(user.id);
    if (!ok) {
      await refreshUnread();
    }
  }, [user?.id, refreshUnread]);

  if (!user) return null;

  const unreadPreviews = recent.filter(isUnread).slice(0, PREVIEW_LIMIT);
  const previewList = unreadPreviews.length > 0 ? unreadPreviews : recent.slice(0, PREVIEW_LIMIT);

  const dropdownSurfaceStyle = {
    background: "rgba(255, 255, 255, 0.96)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    border: "1px solid #e2e8f0",
    borderRadius: "16px",
    boxShadow: "0 20px 50px rgba(15, 23, 42, 0.18)",
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
            className="absolute -right-0.5 -top-0.5 flex h-[1.05rem] min-w-[1.05rem] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[0.58rem] font-bold leading-none text-white shadow-sm ring-1 ring-red-600/40"
            title={`${unreadCount} unread`}
            aria-label={`${unreadCount} unread notifications`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className={[
            "notification-dropdown-panel flex max-h-[min(70vh,30rem)] flex-col overflow-hidden text-slate-900",
            "fixed left-3 right-3 top-[72px] z-[10000] w-auto max-w-[calc(100vw-1.5rem)]",
            "sm:left-auto sm:right-4 sm:w-[23rem] sm:max-w-[min(23rem,calc(100vw-2rem))]",
          ].join(" ")}
          style={dropdownSurfaceStyle}
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] bg-transparent px-3.5 py-2.5">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <div className="flex items-center gap-2">
              {unreadCount > 0 ? (
                <>
                  <span className="text-[0.7rem] font-semibold text-slate-500">{unreadCount} unread</span>
                  <button
                    type="button"
                    onClick={() => void handleMarkAll()}
                    className="rounded-md bg-sky-50 px-2 py-1 text-[0.7rem] font-semibold text-sky-800 hover:bg-sky-100"
                  >
                    Mark all read
                  </button>
                </>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-transparent">
            {loading ? (
              <p className="px-3 py-4 text-center text-sm text-slate-500">Loading…</p>
            ) : previewList.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-slate-500">
                You&apos;re all caught up
              </p>
            ) : (
              previewList.map((item) => {
                const { category, severity } = presentationFor(item);
                const dotColor = SEVERITY_DOT[severity] || SEVERITY_DOT.info;
                const unread = isUnread(item);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full gap-2 border-b border-slate-100/90 bg-transparent px-3.5 py-2.5 text-left transition hover:bg-[#f1f5f9]"
                    onClick={() => void handleRowClick(item)}
                  >
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: dotColor }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className="rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide"
                          style={{ color: dotColor, background: "rgba(15, 23, 42, 0.04)" }}
                        >
                          {categoryLabel(category)}
                        </span>
                        {unread ? (
                          <span
                            className="ml-auto inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                            aria-label="Unread"
                          />
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-sm font-semibold leading-snug text-slate-900">
                        {item.title || "Tropicash"}
                      </p>
                      <p className="mt-0.5 line-clamp-2 break-words text-xs leading-snug text-slate-600">
                        {item.message}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-slate-400">{formatRelative(item.created_at)}</p>
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
              See all in inbox
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
