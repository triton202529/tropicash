/**
 * Tropicash Unified Notification & Event Center — Phase 1 client helpers.
 *
 * Read / mark-read / realtime / preferences helpers used by:
 *   pages/notifications.jsx
 *   components/Navbar.jsx (and NotificationBell.jsx)
 *   pages/profile.jsx (preferences section)
 *
 * Realtime subscriptions are ALWAYS scoped to user_id=eq.<id> per Supabase realtime
 * filter syntax. Never subscribe without a filter.
 *
 * Allowed CATEGORIES / SEVERITIES live in lib/eventBus.js; re-exported here for the
 * UI so component code doesn't import the bus directly.
 */

import { supabase as defaultClient } from "./supabaseClient";
import { CATEGORIES, SEVERITIES } from "./eventBus";
import { logOperationalEvent } from "./operationalLogger";

export { CATEGORIES, SEVERITIES };

export const DEFAULT_PREFERENCES = Object.freeze({
  email_enabled: true,
  push_enabled: false,
  security_alerts: true,
});

const PAGE_LIMIT_DEFAULT = 30;

function isoOrNull(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return null;
}

function clampLimit(n, fallback = PAGE_LIMIT_DEFAULT) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return fallback;
  return Math.min(Math.floor(v), 100);
}

function escapeForIlike(value) {
  return String(value || "").replace(/([%_])/g, "\\$1");
}

/**
 * Fetch a page of notifications for a user, ordered created_at desc. Uses cursor
 * pagination (caller supplies the `created_at` of the oldest row currently visible).
 *
 * @param {object} args
 * @param {import('@supabase/supabase-js').SupabaseClient} [args.supabaseClient]
 * @param {string} args.userId
 * @param {string|Date|null} [args.beforeIso] — exclusive `created_at` cursor.
 * @param {number} [args.limit]
 * @param {string|null} [args.category]
 * @param {string|null} [args.search]
 */
export async function fetchUserNotifications({
  supabaseClient,
  userId,
  beforeIso = null,
  limit = PAGE_LIMIT_DEFAULT,
  category = null,
  search = null,
} = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) return { rows: [], error: null, hasMore: false };
  const client = supabaseClient || defaultClient;
  const pageSize = clampLimit(limit);

  let query = client
    .from("notifications")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(pageSize + 1);

  const before = isoOrNull(beforeIso);
  if (before) query = query.lt("created_at", before);

  if (category && typeof category === "string" && category.trim() && category.trim() !== "all") {
    query = query.eq("category", category.trim());
  }

  if (search && typeof search === "string" && search.trim()) {
    const term = `%${escapeForIlike(search.trim())}%`;
    query = query.or(`title.ilike.${term},message.ilike.${term},event_type.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) {
    void logOperationalEvent({
      level: "warn",
      category: "notification.fetch_failed",
      message: error.message || "notifications fetch failed",
      userId: uid,
      route: null,
      metadata: { code: error.code || null },
    });
    return { rows: [], error, hasMore: false };
  }
  const list = Array.isArray(data) ? data : [];
  const hasMore = list.length > pageSize;
  return { rows: hasMore ? list.slice(0, pageSize) : list, error: null, hasMore };
}

/**
 * Count unread notifications for a user. Relies on the partial unread index.
 *
 * @returns {Promise<number>}
 */
export async function fetchUnreadCount({ supabaseClient, userId } = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) return 0;
  const client = supabaseClient || defaultClient;
  const { count, error } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .is("read_at", null);
  if (error) {
    void logOperationalEvent({
      level: "warn",
      category: "notification.unread_count_failed",
      message: error.message || "unread count failed",
      userId: uid,
      route: null,
      metadata: { code: error.code || null },
    });
    return 0;
  }
  return typeof count === "number" ? count : 0;
}

/**
 * Mark one notification as read. RLS-protected: server only updates the row when
 * auth.uid() = user_id. Also writes the legacy is_read flag so any code still
 * reading the boolean continues to work.
 */
export async function markNotificationRead(notificationId, { supabaseClient } = {}) {
  const id = typeof notificationId === "string" ? notificationId.trim() : "";
  if (!id) return { ok: false, error: new Error("missing id") };
  const client = supabaseClient || defaultClient;
  const nowIso = new Date().toISOString();
  const { error } = await client
    .from("notifications")
    .update({ read_at: nowIso, is_read: true })
    .eq("id", id)
    .is("read_at", null);
  if (error) {
    void logOperationalEvent({
      level: "warn",
      category: "notification.mark_read_failed",
      message: error.message || "mark read failed",
      route: null,
      metadata: { code: error.code || null },
    });
    return { ok: false, error };
  }
  return { ok: true };
}

/**
 * Bulk mark-all-read for the signed-in user. Caller is responsible for passing the
 * correct userId — RLS still enforces the auth.uid() match server-side.
 */
export async function markAllRead(userId, { supabaseClient } = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) return { ok: false, error: new Error("missing userId") };
  const client = supabaseClient || defaultClient;
  const nowIso = new Date().toISOString();
  const { error } = await client
    .from("notifications")
    .update({ read_at: nowIso, is_read: true })
    .eq("user_id", uid)
    .is("read_at", null);
  if (error) {
    void logOperationalEvent({
      level: "warn",
      category: "notification.mark_all_read_failed",
      message: error.message || "mark all read failed",
      userId: uid,
      route: null,
      metadata: { code: error.code || null },
    });
    return { ok: false, error };
  }
  return { ok: true };
}

/**
 * Subscribe to a single user's notification rows over Supabase realtime. The filter
 * is hard-pinned to `user_id=eq.<id>` so this can never leak other users' rows.
 *
 * @param {string} userId
 * @param {(row: any) => void} onInsert
 * @param {(row: any, oldRow?: any) => void} onUpdate
 * @param {{ supabaseClient?: any }} [opts]
 * @returns {() => void} unsubscribe
 */
export function subscribeToUserNotifications(userId, onInsert, onUpdate, opts = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) return () => {};
  const client = opts.supabaseClient || defaultClient;

  const channelName = `notifications-user-${uid}`;
  const channel = client.channel(channelName);

  channel.on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "notifications",
      filter: `user_id=eq.${uid}`,
    },
    (payload) => {
      try {
        if (typeof onInsert === "function") onInsert(payload?.new || null);
      } catch (e) {
        console.error("[notifications subscribe onInsert]", e?.message || e);
      }
    },
  );
  channel.on(
    "postgres_changes",
    {
      event: "UPDATE",
      schema: "public",
      table: "notifications",
      filter: `user_id=eq.${uid}`,
    },
    (payload) => {
      try {
        if (typeof onUpdate === "function") onUpdate(payload?.new || null, payload?.old || null);
      } catch (e) {
        console.error("[notifications subscribe onUpdate]", e?.message || e);
      }
    },
  );

  channel.subscribe((status) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.error("[notifications subscribe]", status);
    }
  });

  return () => {
    try {
      client.removeChannel(channel);
    } catch (e) {
      console.error("[notifications unsubscribe]", e?.message || e);
    }
  };
}

/**
 * Read the signed-in user's notification preferences row. Falls back to DEFAULT_PREFERENCES
 * if the row hasn't been created yet (first time the UI loads the panel).
 */
export async function fetchNotificationPreferences(userId, { supabaseClient } = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) return { ...DEFAULT_PREFERENCES };
  const client = supabaseClient || defaultClient;
  const { data, error } = await client
    .from("notification_preferences")
    .select("email_enabled, push_enabled, security_alerts")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) {
    void logOperationalEvent({
      level: "warn",
      category: "notification.prefs_fetch_failed",
      message: error.message || "preferences fetch failed",
      userId: uid,
      route: null,
      metadata: { code: error.code || null },
    });
    return { ...DEFAULT_PREFERENCES };
  }
  if (!data) return { ...DEFAULT_PREFERENCES };
  return {
    email_enabled: data.email_enabled !== false,
    push_enabled: data.push_enabled === true,
    security_alerts: data.security_alerts !== false,
  };
}

/**
 * Upsert preferences for the signed-in user. RLS guarantees user_id = auth.uid().
 */
export async function upsertNotificationPreferences(userId, partial, { supabaseClient } = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) return { ok: false, error: new Error("missing userId") };
  const client = supabaseClient || defaultClient;
  const incoming = partial && typeof partial === "object" && !Array.isArray(partial) ? partial : {};
  const row = {
    user_id: uid,
    email_enabled: incoming.email_enabled !== false,
    push_enabled: incoming.push_enabled === true,
    security_alerts: incoming.security_alerts !== false,
    updated_at: new Date().toISOString(),
  };
  const { error } = await client.from("notification_preferences").upsert(row, { onConflict: "user_id" });
  if (error) {
    void logOperationalEvent({
      level: "warn",
      category: "notification.prefs_upsert_failed",
      message: error.message || "preferences upsert failed",
      userId: uid,
      route: null,
      metadata: { code: error.code || null },
    });
    return { ok: false, error };
  }
  return { ok: true };
}
