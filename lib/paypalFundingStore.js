import { CAPTURE_IN_PROGRESS_STALE_MS } from "./paypalFundingIntegrity.mjs";

const ORDER_COLUMNS =
  "id, provider, provider_order_id, user_id, amount, currency, status, provider_capture_id, transaction_id, updated_at";

function mapCreditError(error) {
  const message = String(error?.message || "");
  if (message.includes("funding_owner_mismatch")) return "ORDER_OWNER_MISMATCH";
  if (message.includes("funding_terms_mismatch")) return "AMOUNT_MISMATCH";
  if (message.includes("funding_capture_identity_mismatch")) return "ORDER_IDENTITY_MISMATCH";
  if (message.includes("funding_not_captured")) return "CAPTURE_INCOMPLETE";
  if (message.includes("not_authorized")) return "not_authorized";
  return "credit_failed";
}

/**
 * Service-role access to paypal_funding_orders and the one-credit RPC.
 * @param {import("@supabase/supabase-js").SupabaseClient} admin
 */
export function createPaypalFundingStore(admin) {
  return {
    async load(orderId) {
      const { data, error } = await admin
        .from("paypal_funding_orders")
        .select(ORDER_COLUMNS)
        .eq("provider", "paypal")
        .eq("provider_order_id", orderId)
        .maybeSingle();
      if (error) {
        const err = new Error(error.message || "funding order lookup failed");
        err.code = "FUNDING_ORDER_LOOKUP_FAILED";
        throw err;
      }
      return data;
    },

    async loadCompletedCredit(orderId) {
      const { data, error } = await admin
        .from("funding_idempotency_keys")
        .select("status, user_id, amount, transaction_id")
        .eq("provider", "paypal")
        .eq("provider_order_id", orderId)
        .maybeSingle();
      if (error) {
        const err = new Error(error.message || "funding credit lookup failed");
        err.code = "FUNDING_CREDIT_LOOKUP_FAILED";
        throw err;
      }
      if (!data || data.status !== "completed") return null;
      return data;
    },

    async claimCapture({ orderId, userId }) {
      const now = new Date().toISOString();
      const first = await admin
        .from("paypal_funding_orders")
        .update({ status: "capture_in_progress", updated_at: now })
        .eq("provider", "paypal")
        .eq("provider_order_id", orderId)
        .eq("user_id", userId)
        .in("status", ["created", "capture_failed"])
        .select("id")
        .maybeSingle();
      if (first.error) {
        const err = new Error(first.error.message || "capture claim failed");
        err.code = "CAPTURE_CLAIM_FAILED";
        throw err;
      }
      if (first.data?.id) return { claimed: true };

      const staleBefore = new Date(Date.now() - CAPTURE_IN_PROGRESS_STALE_MS).toISOString();
      const second = await admin
        .from("paypal_funding_orders")
        .update({ updated_at: now })
        .eq("provider", "paypal")
        .eq("provider_order_id", orderId)
        .eq("user_id", userId)
        .eq("status", "capture_in_progress")
        .lt("updated_at", staleBefore)
        .select("id")
        .maybeSingle();
      if (second.error) {
        const err = new Error(second.error.message || "capture reclaim failed");
        err.code = "CAPTURE_CLAIM_FAILED";
        throw err;
      }
      return { claimed: Boolean(second.data?.id) };
    },

    async markCaptured({ orderId, userId, captureId }) {
      const now = new Date().toISOString();
      const { data, error } = await admin
        .from("paypal_funding_orders")
        .update({
          status: "captured",
          provider_capture_id: captureId,
          provider_status: "COMPLETED",
          captured_at: now,
          updated_at: now,
          last_error: null,
        })
        .eq("provider", "paypal")
        .eq("provider_order_id", orderId)
        .eq("user_id", userId)
        .eq("status", "capture_in_progress")
        .select("id")
        .maybeSingle();
      if (error) {
        const err = new Error(error.message || "mark captured failed");
        err.code = "MARK_CAPTURED_FAILED";
        throw err;
      }
      return { updated: Boolean(data?.id) };
    },

    async markCaptureFailed({ orderId, userId, reason }) {
      const { error } = await admin
        .from("paypal_funding_orders")
        .update({
          status: "capture_failed",
          last_error: String(reason || "capture_failed").slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("provider", "paypal")
        .eq("provider_order_id", orderId)
        .eq("user_id", userId)
        .eq("status", "capture_in_progress");
      if (error) {
        const err = new Error(error.message || "mark capture failed");
        err.code = "MARK_CAPTURE_FAILED";
        throw err;
      }
      return { updated: true };
    },

    async credit({ orderId, userId, amount, currency, captureId }) {
      const { data, error } = await admin.rpc("credit_paypal_funding_order", {
        p_provider_order_id: orderId,
        p_user_id: userId,
        p_amount: Number(amount),
        p_currency: currency,
        p_provider_capture_id: captureId,
      });
      if (error) {
        return { ok: false, code: mapCreditError(error) };
      }
      return data;
    },
  };
}
