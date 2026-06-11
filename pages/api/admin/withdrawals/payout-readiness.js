import { requireAdminFromBearer } from "../../../../lib/supabaseAdminApi";
import { getServerPayPalPayoutReadiness } from "../../../../lib/paypalPayoutReadiness";

/**
 * Admin-only: PayPal Payout env presence (never returns secret values).
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdminFromBearer(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  return res.status(200).json(getServerPayPalPayoutReadiness());
}
