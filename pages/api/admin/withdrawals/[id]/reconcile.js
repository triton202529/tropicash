import { logOperationalError } from "../../../../../lib/operationalLogger";
import { createSupabaseServiceClient, requireAdminFromBearer } from "../../../../../lib/supabaseAdminApi";
import { reconcileWithdrawalPayout } from "../../../../../lib/payouts/payoutService";
import { emitAdminEvent } from "../../../../../lib/eventBus";
import { appendAuditEventServer } from "../../../../../lib/auditTimeline";

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
    console.error("[admin/reconcile] Missing SUPABASE_SERVICE_ROLE_KEY");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const result = await reconcileWithdrawalPayout(supabaseAdmin, withdrawalId);
    const resolvedStatus = String(result?.status || "updated").toLowerCase();
    void emitAdminEvent({
      supabaseClient: supabaseAdmin,
      eventType: `withdrawal.reconciled.${resolvedStatus}`,
      category: "treasury",
      severity: resolvedStatus === "paid" ? "success" : "info",
      title: "Withdrawal reconciled",
      message: `Withdrawal ${withdrawalId} reconciled to ${resolvedStatus}.`,
      actorUserId: auth.user?.id ?? null,
      metadata: { withdrawalId, status: resolvedStatus },
    });
    void appendAuditEventServer({
      entityType: "withdrawal",
      entityId: withdrawalId,
      eventType: "admin.reconcile",
      actorUserId: auth.user?.id ?? null,
      severity: resolvedStatus === "paid" ? "success" : "info",
      title: "Withdrawal reconcile",
      description: `Withdrawal ${withdrawalId} reconciled to ${resolvedStatus}.`,
      metadata: { status: resolvedStatus },
      dedupeKey: `audit:withdrawal:${withdrawalId}:reconcile:${resolvedStatus}`,
      dedupeWindowMs: 8 * 60 * 1000,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    const msg = err?.message || String(err);
    console.error("[admin/reconcile] failed:", err);
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "admin.withdrawal_reconcile",
      message: msg,
      userId: auth.user?.id ?? null,
      route: "/api/admin/withdrawals/[id]/reconcile",
      metadata: { withdrawalId },
    });
    void emitAdminEvent({
      supabaseClient: supabaseAdmin,
      eventType: "withdrawal.reconcile_failed",
      category: "treasury",
      severity: "warning",
      title: "Withdrawal reconcile failed",
      message: `Reconcile failed for withdrawal ${withdrawalId}.`,
      actorUserId: auth.user?.id ?? null,
      metadata: { withdrawalId },
    });
    void appendAuditEventServer({
      entityType: "withdrawal",
      entityId: withdrawalId,
      eventType: "admin.reconcile_failed",
      actorUserId: auth.user?.id ?? null,
      severity: "warning",
      title: "Withdrawal reconcile failed",
      description: `Reconcile failed for withdrawal ${withdrawalId}.`,
      metadata: {},
      dedupeKey: `audit:withdrawal:${withdrawalId}:reconcile_failed`,
      dedupeWindowMs: 8 * 60 * 1000,
    });
    return res.status(502).json({ error: msg });
  }
}
