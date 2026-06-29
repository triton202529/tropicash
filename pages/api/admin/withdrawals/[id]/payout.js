import { createClient } from "@supabase/supabase-js";
import { logOperationalError } from "../../../../../lib/operationalLogger";
import { executeWithdrawalPayout } from "../../../../../lib/payouts/payoutService";
import {
  createSupabaseServiceClient,
  requireAdminFromBearer,
} from "../../../../../lib/supabaseAdminApi";
import { emitAdminEvent } from "../../../../../lib/eventBus";
import { appendAuditEventServer } from "../../../../../lib/auditTimeline";
import { buildPayPalPayoutReadiness, getServerPayPalPayoutReadiness } from "../../../../../lib/paypalPayoutReadiness";

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
  const user = auth.user;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    void logOperationalError({
      category: "env.config",
      message: "Missing Supabase env on /api/admin/withdrawals/[id]/payout",
      userId: user.id,
      route: "/api/admin/withdrawals/[id]/payout",
      metadata: {},
    });
    return res.status(500).json({ error: "Server configuration error" });
  }

  const readiness = buildPayPalPayoutReadiness(
    {
      automationEnabled: process.env.NEXT_PUBLIC_WITHDRAWAL_AUTOMATED_PAYOUT === "true",
      automationFlagSet: typeof process.env.NEXT_PUBLIC_WITHDRAWAL_AUTOMATED_PAYOUT === "string",
      publicMode: null,
    },
    getServerPayPalPayoutReadiness(),
  );
  if (!readiness.payoutActionAvailable) {
    return res.status(503).json({
      error: "PayPal payout is not configured",
      summary: readiness.blockers[0] || "Feature flag or server credentials are missing.",
      blockers: readiness.blockers,
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const forceRetry =
    req.body &&
    typeof req.body === "object" &&
    (req.body.retry === true || req.body.forceRetry === true);

  try {
    const result = await executeWithdrawalPayout(supabaseAdmin, withdrawalId, { forceRetry });
    void emitAdminEvent({
      supabaseClient: supabaseAdmin,
      eventType: `withdrawal.${String(result.status || "updated").toLowerCase()}`,
      category: "treasury",
      severity: result.status === "paid" ? "success" : "info",
      title: `Withdrawal ${result.status || "updated"}`,
      message: `Withdrawal ${withdrawalId} marked ${result.status || "updated"}.`,
      actorUserId: user.id,
      metadata: {
        withdrawalId,
        status: result.status || null,
        processorStatus: result.processorStatus || null,
        batchId: result.batchId || null,
      },
    });
    void appendAuditEventServer({
      entityType: "withdrawal",
      entityId: withdrawalId,
      eventType: "admin.payout",
      actorUserId: user.id,
      severity: result.status === "paid" ? "success" : "info",
      title: "Admin automated payout",
      description: `Withdrawal ${withdrawalId} → ${String(result.status || "updated")}.`,
      metadata: {
        status: result.status || null,
        processor_status: result.processorStatus || null,
      },
      dedupeKey: `audit:withdrawal:${withdrawalId}:payout:${String(result.status || "")}:${String(result.processorStatus || "")}`.slice(0, 400),
      dedupeWindowMs: 8 * 60 * 1000,
    });
    return res.status(200).json({
      success: true,
      withdrawalId,
      status: result.status,
      processorStatus: result.processorStatus,
      batchId: result.batchId,
    });
  } catch (err) {
    const paypalError =
      err && typeof err === "object" && "paypalError" in err && err.paypalError && typeof err.paypalError === "object"
        ? err.paypalError
        : null;
    const rawMsg = err?.message || String(err);
    const lower = rawMsg.toLowerCase();
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "withdrawal.admin_payout",
      message: rawMsg || "executeWithdrawalPayout failed",
      userId: user.id,
      route: "/api/admin/withdrawals/[id]/payout",
      metadata: {
        withdrawalId,
        hasPayPalErrorDetails: !!paypalError,
        paypalErrorName: paypalError && typeof paypalError === "object" ? paypalError.name : undefined,
        paypalErrorMessage:
          paypalError && typeof paypalError === "object" && typeof paypalError.message === "string"
            ? paypalError.message
            : undefined,
      },
    });
    console.error("[admin/payout] executeWithdrawalPayout failed:", err);
    void emitAdminEvent({
      supabaseClient: supabaseAdmin,
      eventType: "withdrawal.payout_failed",
      category: "treasury",
      severity: "warning",
      title: "Withdrawal payout failed",
      message: `Payout for withdrawal ${withdrawalId} failed during processing.`,
      actorUserId: user.id,
      metadata: {
        withdrawalId,
        hasPayPalErrorDetails: !!paypalError,
      },
    });
    void appendAuditEventServer({
      entityType: "withdrawal",
      entityId: withdrawalId,
      eventType: "admin.payout_failed",
      actorUserId: user.id,
      severity: "warning",
      title: "Admin payout failed",
      description: `Payout processing failed for withdrawal ${withdrawalId}.`,
      metadata: {
        has_paypal_error_details: !!paypalError,
      },
      dedupeKey: `audit:withdrawal:${withdrawalId}:payout_failed`,
      dedupeWindowMs: 8 * 60 * 1000,
    });
    if (paypalError) {
      const summary =
        typeof paypalError.message === "string" && paypalError.message.trim()
          ? paypalError.message.trim().slice(0, 200)
          : "PayPal rejected the payout request.";
      return res.status(400).json({
        error: "PayPal payout failed",
        summary,
        details: paypalError,
      });
    }
    if (lower.includes("no payout destination")) {
      return res.status(400).json({
        error: "Withdrawal has no payout destination on file.",
      });
    }
    if (
      lower.includes("already") ||
      lower.includes("rejected") ||
      lower.includes("not allowed") ||
      lower.includes("cannot start")
    ) {
      return res.status(409).json({
        error: "Withdrawal cannot be paid out in its current state.",
      });
    }
    return res.status(502).json({
      error: "Could not process this payout. Check /admin/logs for details.",
    });
  }
}
