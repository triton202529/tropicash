import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabaseClient";
import { useUser } from "../lib/userContext";
import {
  CATEGORIES,
  fetchUnreadCount,
  fetchUserNotifications,
  markAllRead,
  markNotificationRead,
  subscribeToUserNotifications,
} from "../lib/notifications";

const PAGE_SIZE = 30;

const pageWrap = {
  padding: "1.75rem 1.25rem 3.5rem",
  maxWidth: "780px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  boxSizing: "border-box",
};

const cardBase = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
};

const inputStyle = {
  display: "block",
  width: "100%",
  padding: "0.55rem 0.7rem",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: "0.88rem",
  boxSizing: "border-box",
  outline: "none",
};

const SEVERITY_STYLE = {
  info: { border: "#3b82f6", chipBg: "#eff6ff", chipFg: "#1d4ed8" },
  success: { border: "#10b981", chipBg: "#ecfdf5", chipFg: "#047857" },
  warning: { border: "#f59e0b", chipBg: "#fffbeb", chipFg: "#92400e" },
  critical: { border: "#ef4444", chipBg: "#fef2f2", chipFg: "#b91c1c" },
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

const SECURITY_NOTIFICATION_KIND_LABELS = {
  security_suspicious_login: "Security alert",
  security_session_revoked: "Security update",
  security_account_activity: "Account security",
};

function securityKindLabel(row) {
  const t = String(row?.type || "").toLowerCase();
  if (SECURITY_NOTIFICATION_KIND_LABELS[t]) return SECURITY_NOTIFICATION_KIND_LABELS[t];
  const et = String(row?.event_type || "").toLowerCase();
  if (et === "security.suspicious_login") return SECURITY_NOTIFICATION_KIND_LABELS.security_suspicious_login;
  if (et === "security.session_revoked") return SECURITY_NOTIFICATION_KIND_LABELS.security_session_revoked;
  if (et === "security.account_activity") return SECURITY_NOTIFICATION_KIND_LABELS.security_account_activity;
  return "";
}

function severityPresentation(raw) {
  const key = String(raw || "").toLowerCase();
  return SEVERITY_STYLE[key] || SEVERITY_STYLE.info;
}

function categoryLabel(raw) {
  const key = String(raw || "").toLowerCase();
  return CATEGORY_LABELS[key] || (key ? key[0].toUpperCase() + key.slice(1) : "Update");
}

function isUnread(row) {
  if (!row) return false;
  if (row.read_at) return false;
  if (row.is_read === true) return false;
  return true;
}

function dayKeyFor(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yest)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function formatRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 45) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function actorShortLabel(profile, actorId) {
  if (!profile && !actorId) return "";
  if (profile?.full_name && String(profile.full_name).trim()) return String(profile.full_name).trim();
  if (profile?.email && String(profile.email).trim()) return String(profile.email).trim();
  if (typeof actorId === "string" && actorId.length >= 8) return `${actorId.slice(0, 8)}…`;
  return actorId || "";
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useUser();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [filterCategory, setFilterCategory] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [unreadCount, setUnreadCount] = useState(0);
  const [actorProfiles, setActorProfiles] = useState({});

  const itemsRef = useRef([]);
  itemsRef.current = items;

  const fetchActorProfiles = useCallback(async (rows) => {
    const ids = [
      ...new Set(
        (rows || [])
          .map((r) => r?.actor_user_id)
          .filter((v) => typeof v === "string" && v.trim()),
      ),
    ];
    if (ids.length === 0) return;
    const missing = ids.filter((id) => !(id in actorProfiles));
    if (missing.length === 0) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", missing);
      if (error || !Array.isArray(data)) return;
      setActorProfiles((prev) => {
        const next = { ...prev };
        for (const p of data) {
          if (p?.id) next[p.id] = p;
        }
        return next;
      });
    } catch (e) {
      console.error("[notifications] actor profiles", e?.message || e);
    }
  }, [actorProfiles]);

  const refreshUnread = useCallback(async () => {
    if (!user?.id) return;
    const c = await fetchUnreadCount({ userId: user.id });
    setUnreadCount(c);
  }, [user?.id]);

  const initialLoad = useCallback(async () => {
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      setHasMore(false);
      return;
    }
    setLoading(true);
    setErrorMessage("");
    const [{ rows, error, hasMore: more }] = await Promise.all([
      fetchUserNotifications({
        userId: user.id,
        limit: PAGE_SIZE,
        category: filterCategory,
        search,
      }),
      refreshUnread(),
    ]);
    if (error) {
      setErrorMessage("We couldn't load your notifications. Please try again in a moment.");
      setItems([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    setItems(rows);
    setHasMore(more);
    setLoading(false);
    void fetchActorProfiles(rows);
  }, [user?.id, filterCategory, search, refreshUnread, fetchActorProfiles]);

  const loadMore = useCallback(async () => {
    if (!user?.id || loadingMore || !hasMore) return;
    const oldest = itemsRef.current[itemsRef.current.length - 1];
    if (!oldest?.created_at) return;
    setLoadingMore(true);
    const { rows, error, hasMore: more } = await fetchUserNotifications({
      userId: user.id,
      limit: PAGE_SIZE,
      beforeIso: oldest.created_at,
      category: filterCategory,
      search,
    });
    if (error) {
      setErrorMessage("We couldn't load more notifications. Please try again.");
      setLoadingMore(false);
      return;
    }
    setItems((prev) => [...prev, ...rows]);
    setHasMore(more);
    setLoadingMore(false);
    void fetchActorProfiles(rows);
  }, [user?.id, hasMore, loadingMore, filterCategory, search, fetchActorProfiles]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setItems([]);
      setLoading(false);
      return undefined;
    }
    void initialLoad();
    return undefined;
  }, [authLoading, user?.id, initialLoad]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const unsub = subscribeToUserNotifications(
      user.id,
      (newRow) => {
        if (!newRow?.id) return;
        const matchesCategory =
          filterCategory === "all" || String(newRow.category || "").toLowerCase() === filterCategory;
        if (!matchesCategory) return;
        const current = itemsRef.current;
        if (current.some((r) => r.id === newRow.id)) return;
        const newest = current[0]?.created_at;
        if (newest && new Date(newRow.created_at).getTime() <= new Date(newest).getTime()) {
          setItems((prev) => [newRow, ...prev]);
        } else {
          setItems((prev) => [newRow, ...prev]);
        }
        if (isUnread(newRow)) setUnreadCount((prev) => prev + 1);
        if (newRow.actor_user_id) void fetchActorProfiles([newRow]);
      },
      (newRow) => {
        if (!newRow?.id) return;
        setItems((prev) =>
          prev.map((r) =>
            r.id === newRow.id
              ? {
                  ...r,
                  ...newRow,
                  read_at: newRow.read_at ?? r.read_at,
                }
              : r,
          ),
        );
        if (newRow.read_at) void refreshUnread();
      },
    );
    return () => unsub();
  }, [user?.id, filterCategory, fetchActorProfiles, refreshUnread]);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const grouped = useMemo(() => {
    const out = [];
    let lastKey = null;
    for (const row of items) {
      const key = dayKeyFor(row.created_at);
      if (key !== lastKey) {
        out.push({ heading: key, rows: [] });
        lastKey = key;
      }
      out[out.length - 1].rows.push(row);
    }
    return out;
  }, [items]);

  const handleMarkOne = useCallback(
    async (row) => {
      if (!row?.id || !isUnread(row)) return;
      const before = itemsRef.current;
      setItems((prev) =>
        prev.map((r) =>
          r.id === row.id ? { ...r, read_at: new Date().toISOString(), is_read: true } : r,
        ),
      );
      setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));
      const { ok } = await markNotificationRead(row.id);
      if (!ok) {
        setItems(before);
        await refreshUnread();
        void logOperationalEventSafe("notification.mark_read_revert");
      }
    },
    [refreshUnread],
  );

  const handleMarkAll = useCallback(async () => {
    if (!user?.id) return;
    const before = itemsRef.current;
    const nowIso = new Date().toISOString();
    setItems((prev) => prev.map((r) => ({ ...r, read_at: r.read_at || nowIso, is_read: true })));
    setUnreadCount(0);
    const { ok } = await markAllRead(user.id);
    if (!ok) {
      setItems(before);
      await refreshUnread();
    }
  }, [user?.id, refreshUnread]);

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading…</p>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <div style={{ ...cardBase, padding: "1.75rem", textAlign: "center" }}>
            <p style={{ margin: 0, color: "#334155", fontWeight: 600 }}>Sign in to view notifications.</p>
            <Link
              href="/login"
              style={{
                display: "inline-block",
                marginTop: "0.85rem",
                color: "#2563eb",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Go to login →
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <header
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: "1.25rem",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(1.4rem, 4vw, 1.75rem)",
                fontWeight: 700,
                color: "#0f172a",
                letterSpacing: "-0.02em",
              }}
            >
              Notifications
            </h1>
            <p
              style={{
                margin: "0.35rem 0 0",
                color: "#64748b",
                fontSize: "0.9rem",
              }}
            >
              {unreadCount > 0
                ? `${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`
                : "You're all caught up."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={unreadCount === 0}
            style={{
              padding: "0.55rem 0.95rem",
              borderRadius: "10px",
              border: "1px solid #2563eb",
              background: unreadCount === 0 ? "#e2e8f0" : "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
              color: unreadCount === 0 ? "#94a3b8" : "#ffffff",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: unreadCount === 0 ? "not-allowed" : "pointer",
              boxShadow: unreadCount === 0 ? "none" : "0 6px 14px rgba(37, 99, 235, 0.25)",
              transition: "transform 0.15s ease",
            }}
          >
            Mark all read
          </button>
        </header>

        <div
          style={{
            ...cardBase,
            padding: "0.85rem",
            marginBottom: "1rem",
            display: "grid",
            gap: "0.65rem",
            gridTemplateColumns: "minmax(0, 1fr)",
          }}
        >
          <div style={{ display: "grid", gap: "0.65rem", gridTemplateColumns: "minmax(0, 12rem) minmax(0, 1fr)" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#94a3b8",
                  marginBottom: "0.3rem",
                }}
              >
                Category
              </label>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={inputStyle}
              >
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#94a3b8",
                  marginBottom: "0.3rem",
                }}
              >
                Search
              </label>
              <input
                type="search"
                placeholder="Search title, message, or event type…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div
            style={{
              ...cardBase,
              padding: "0.85rem 1rem",
              marginBottom: "1rem",
              background: "#fef2f2",
              borderColor: "#fecaca",
            }}
          >
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.85rem" }}>{errorMessage}</p>
          </div>
        ) : null}

        {loading ? (
          <div style={{ ...cardBase, padding: "1.5rem", textAlign: "center" }}>
            <p style={{ margin: 0, color: "#64748b" }}>Loading notifications…</p>
          </div>
        ) : items.length === 0 ? (
          <div style={{ ...cardBase, padding: "2.5rem 1.25rem", textAlign: "center" }}>
            <p style={{ margin: 0, color: "#0f172a", fontWeight: 600 }}>You&apos;re all caught up</p>
            <p style={{ margin: "0.4rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>
              We&apos;ll show wallet, payment, and security updates here as they happen.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {grouped.map((group) => (
              <section key={group.heading}>
                <h2
                  style={{
                    margin: "0 0 0.55rem 0.2rem",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  {group.heading}
                </h2>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {group.rows.map((row) => {
                    const unread = isUnread(row);
                    const sev = severityPresentation(row.severity);
                    const kindLabel = securityKindLabel(row);
                    const securityAccent = kindLabel.length > 0;
                    const actorProfile = row.actor_user_id ? actorProfiles[row.actor_user_id] : null;
                    const actorLabel = row.actor_user_id ? actorShortLabel(actorProfile, row.actor_user_id) : "";
                    const showActor = !!row.actor_user_id && row.actor_user_id !== row.user_id;
                    const leftAccent = securityAccent ? "#d97706" : sev.border;
                    const unreadBg = securityAccent ? "#fffbeb" : "#f8fbff";
                    const readBg = securityAccent ? "#fffdf7" : "#ffffff";
                    return (
                      <li key={row.id}>
                        <article
                          style={{
                            ...cardBase,
                            borderLeft: `4px solid ${leftAccent}`,
                            background: unread ? unreadBg : readBg,
                            padding: "0.95rem 1.05rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.55rem",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "0.65rem", alignItems: "flex-start" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "0.18rem 0.55rem",
                                  borderRadius: "999px",
                                  fontSize: "0.66rem",
                                  fontWeight: 700,
                                  letterSpacing: "0.04em",
                                  textTransform: "uppercase",
                                  background: sev.chipBg,
                                  color: sev.chipFg,
                                  border: `1px solid ${sev.chipBg}`,
                                }}
                              >
                                {categoryLabel(row.category)}
                              </span>
                              {kindLabel ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    padding: "0.18rem 0.55rem",
                                    borderRadius: "999px",
                                    fontSize: "0.66rem",
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                    textTransform: "uppercase",
                                    background: "#fef3c7",
                                    color: "#92400e",
                                    border: "1px solid #fde68a",
                                  }}
                                >
                                  {kindLabel}
                                </span>
                              ) : null}
                              {unread ? (
                                <span
                                  aria-label="Unread"
                                  style={{
                                    display: "inline-block",
                                    width: "0.55rem",
                                    height: "0.55rem",
                                    borderRadius: "999px",
                                    background: leftAccent,
                                  }}
                                />
                              ) : null}
                            </div>
                            <span style={{ color: "#94a3b8", fontSize: "0.72rem", whiteSpace: "nowrap" }}>
                              {formatRelative(row.created_at)}
                            </span>
                          </div>

                          <div>
                            <p
                              style={{
                                margin: 0,
                                fontWeight: 700,
                                color: "#0f172a",
                                fontSize: "0.96rem",
                                lineHeight: 1.3,
                              }}
                            >
                              {row.title || "Tropicash"}
                            </p>
                            <p style={{ margin: "0.25rem 0 0", color: "#334155", fontSize: "0.88rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                              {row.message}
                            </p>
                            {showActor && actorLabel ? (
                              <p style={{ margin: "0.4rem 0 0", color: "#64748b", fontSize: "0.74rem" }}>
                                via {actorLabel}
                              </p>
                            ) : null}
                          </div>

                          {unread ? (
                            <div style={{ display: "flex", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                onClick={() => handleMarkOne(row)}
                                style={{
                                  padding: "0.35rem 0.7rem",
                                  borderRadius: "8px",
                                  border: "1px solid #cbd5e1",
                                  background: "#f8fafc",
                                  color: "#1d4ed8",
                                  fontWeight: 600,
                                  fontSize: "0.78rem",
                                  cursor: "pointer",
                                }}
                              >
                                Mark read
                              </button>
                            </div>
                          ) : null}
                        </article>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}

            {hasMore ? (
              <div style={{ display: "flex", justifyContent: "center", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  style={{
                    padding: "0.6rem 1.1rem",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    background: loadingMore ? "#e2e8f0" : "#ffffff",
                    color: "#0f172a",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: loadingMore ? "not-allowed" : "pointer",
                  }}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}

function logOperationalEventSafe(category) {
  if (typeof window === "undefined") return;
  import("../lib/operationalLogger")
    .then((mod) => {
      void mod.logOperationalEvent({
        level: "warn",
        category,
        message: "user-facing mark-read failed; reverted client state",
        userId: null,
        route: "/notifications",
        metadata: {},
      });
    })
    .catch(() => {});
}
