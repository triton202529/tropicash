import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  getUnreadNotificationCount,
  markAllNotificationsRead,
  subscribeUserNotifications,
} from "../lib/notificationService";

const FETCH_LIMIT = 15;

const formatNotification = (n) => {
  const amountText = n.amount ? `$${Number(n.amount).toFixed(2)}` : "";
  const type = String(n?.type || "").toLowerCase();

  if (n.message && String(n.message).trim()) return String(n.message).trim();

  if (type === "send_money") return `You sent ${amountText}`;
  if (type === "receive_money") return `You received ${amountText}`;
  if (type === "fund_wallet") return `Wallet funded ${amountText}`;
  if (type === "withdraw_wallet") return `Withdrawal ${amountText}`;
  if (type === "fraud_flag") return "Suspicious activity detected";

  if (type === "money_sent") return `You sent ${amountText}`;
  if (type === "money_received") return `You received ${amountText}`;
  if (type === "wallet_funded") return `Wallet funded ${amountText}`;

  return "Notification";
};

function normalizeRows(rows) {
  return (rows || []).map((row) => ({
    id: row.id,
    is_read: !!row.is_read,
    created_at: row.created_at,
    title: row.title && String(row.title).trim() ? String(row.title).trim() : "Tropicash",
    message: formatNotification(row),
    type: String(row.type || "").toLowerCase(),
    related_transaction_id: row.related_transaction_id ?? null,
    raw: row,
  }));
}

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    const [listRes, unreadTotal] = await Promise.all([
      supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(FETCH_LIMIT),
      getUnreadNotificationCount(userId),
    ]);

    if (listRes.error) {
      console.error("[notifications] fetch failed:", listRes.error);
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    const list = listRes.data || [];
    setNotifications(normalizeRows(list));
    setUnreadCount(unreadTotal);
    setLoading(false);
  }, [userId]);

  const markAsRead = useCallback(async (notificationId) => {
    if (!notificationId) return false;

    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) {
      console.error("[useNotifications] markAsRead failed:", error);
      return false;
    }

    setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n)));
    setUnreadCount((prev) => (prev > 0 ? prev - 1 : 0));
    return true;
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return false;
    const ok = await markAllNotificationsRead(userId);
    if (ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
    return ok;
  }, [userId]);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!userId) return undefined;
    const unsub = subscribeUserNotifications(userId, () => {
      void fetchNotifications();
    });
    return unsub;
  }, [userId, fetchNotifications]);

  const refresh = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    refresh,
  };
}
