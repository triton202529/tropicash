import { supabase } from "./supabaseClient";

export const NOTIFICATION_TYPES = {
  MONEY_SENT: "money_sent",
  MONEY_RECEIVED: "money_received",
  WALLET_FUNDED: "wallet_funded",
};

export async function getUnreadNotificationCount(userId) {
  if (!userId) return 0;
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("getUnreadNotificationCount:", error);
    return 0;
  }
  return count ?? 0;
}

export async function fetchUserNotifications(userId, limit = 100) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fetchUserNotifications:", error);
    return [];
  }
  return data || [];
}

export async function markNotificationRead(notificationId) {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) {
    console.error("markNotificationRead:", error);
    return false;
  }
  return true;
}

export async function markAllNotificationsRead(userId) {
  if (!userId) return false;
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) {
    console.error("markAllNotificationsRead:", error);
    return false;
  }
  return true;
}

export async function createTransferNotifications({
  transactionId,
  senderId,
  recipientId,
  amountFormatted,
  senderDisplayName,
  recipientDisplayName,
}) {
  if (!transactionId || !senderId || !recipientId) return;

  const senderLabel = (senderDisplayName || "").trim() || "Someone";
  const recipientLabel = (recipientDisplayName || "").trim() || "Recipient";

  const rows = [
    {
      user_id: senderId,
      type: NOTIFICATION_TYPES.MONEY_SENT,
      title: "Money sent",
      message: `You sent $${amountFormatted} to ${recipientLabel}.`,
      is_read: false,
      related_transaction_id: transactionId,
    },
    {
      user_id: recipientId,
      type: NOTIFICATION_TYPES.MONEY_RECEIVED,
      title: "Money received",
      message: `${senderLabel} sent you $${amountFormatted}.`,
      is_read: false,
      related_transaction_id: transactionId,
    },
  ];

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) console.error("createTransferNotifications:", error);
}

export async function createWalletFundedNotification({
  userId,
  transactionId,
  amountFormatted,
}) {
  if (!userId || !transactionId) return;

  const { error } = await supabase.from("notifications").insert([
    {
      user_id: userId,
      type: NOTIFICATION_TYPES.WALLET_FUNDED,
      title: "Wallet funded",
      message: `$${amountFormatted} was added to your wallet.`,
      is_read: false,
      related_transaction_id: transactionId,
    },
  ]);

  if (error) console.error("createWalletFundedNotification:", error);
}

/**
 * Refetch-driven updates: call onChange() on any INSERT/UPDATE for this user's rows.
 * @returns {() => void} cleanup (remove channel)
 */
export function subscribeUserNotifications(userId, onChange) {
  if (!userId || typeof onChange !== "function") return () => {};

  const channel = supabase
    .channel(`notifications-user-${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      () => {
        onChange();
      }
    )
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("notifications realtime:", status);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}
