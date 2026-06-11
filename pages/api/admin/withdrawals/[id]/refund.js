import { requireAdminFromBearer, createSupabaseServiceClient } from "../../../../../lib/supabaseAdminApi";
import { refundWithdrawalRequest } from "../../../../../lib/withdrawalRefunds";
import { logOperationalError } from "../../../../../lib/operationalLogger";

/**
 * Admin-only: idempotent wallet refund for rejected/failed withdrawal requests.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const withdrawalId = req.query?.id;
  if (!withdrawalId || typeof withdrawalId !== "string") {
    return res.status(400).json({ error: "Withdrawal id is required" });
  }

  const auth = await requireAdminFromBearer(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const supabaseAdmin = createSupabaseServiceClient();
  if (!supabaseAdmin) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const reason =
    typeof body.reason === "string" && body.reason.trim()
      ? body.reason.trim().slice(0, 500)
      : null;

  try {
    const result = await refundWithdrawalRequest({
      withdrawalRequestId: withdrawalId,
      reason,
      adminUserId: auth.user.id,
      supabaseClient: supabaseAdmin,
    });

    if (result.outcome === "refunded") {
      return res.status(200).json({
        success: true,
        outcome: "refunded",
        withdrawalId,
        userId: result.userId ?? null,
        amount: result.amount ?? null,
        transactionId: result.transactionId ?? null,
        refundedAt: result.refundedAt ?? null,
      });
    }

    if (result.outcome === "already_refunded") {
      return res.status(200).json({
        success: true,
        outcome: "already_refunded",
        withdrawalId,
        transactionId: result.transactionId ?? null,
        refundedAt: result.refundedAt ?? null,
      });
    }

    if (result.outcome === "not_refundable") {
      return res.status(409).json({
        error: "Withdrawal is not eligible for refund",
        outcome: "not_refundable",
        status: result.status ?? null,
        message: result.message ?? null,
      });
    }

    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "withdrawal.refund",
      message: result.message || "refundWithdrawalRequest error",
      userId: auth.user.id,
      route: "/api/admin/withdrawals/[id]/refund",
      metadata: { withdrawalId, code: result.code ?? null },
    });

    return res.status(500).json({
      error: result.message || "Refund failed",
      outcome: "error",
    });
  } catch (err) {
    const msg = err?.message || String(err);
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "withdrawal.refund",
      message: msg,
      userId: auth.user.id,
      route: "/api/admin/withdrawals/[id]/refund",
      metadata: { withdrawalId },
    });
    return res.status(500).json({ error: "Refund request failed" });
  }
}
