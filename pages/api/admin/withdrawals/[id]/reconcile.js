import { logOperationalError } from "../../../../../lib/operationalLogger";
import { createSupabaseServiceClient, requireAdminFromBearer } from "../../../../../lib/supabaseAdminApi";
import { reconcileWithdrawalPayout } from "../../../../../lib/payouts/payoutService";

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
    return res.status(502).json({ error: msg });
  }
}
