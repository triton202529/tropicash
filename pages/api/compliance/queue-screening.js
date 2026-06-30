import { requireUserFromRequest } from "../../../lib/apiAuth";
import { createSupabaseServiceClient } from "../../../lib/supabaseAdminApi";
import { queueComplianceScreening } from "../../../lib/complianceScreening";

/** Queue sanctions + PEP screening for authenticated user (KYC hook). */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireUserFromRequest(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }

  const subjectName =
    typeof body?.subject_name === "string" ? body.subject_name.trim() : null;
  const admin = createSupabaseServiceClient();
  if (!admin) return res.status(500).json({ error: "Server configuration error" });

  const userId = auth.user.id;
  const subjectData = { source: "kyc_submission", queued_at: new Date().toISOString() };

  const [sanctions, pep] = await Promise.all([
    queueComplianceScreening({
      userId,
      screeningType: "sanctions",
      subjectName,
      subjectData,
      supabaseClient: admin,
    }),
    queueComplianceScreening({
      userId,
      screeningType: "pep",
      subjectName,
      subjectData,
      supabaseClient: admin,
    }),
  ]);

  return res.status(200).json({
    success: true,
    sanctions: sanctions.ok,
    pep: pep.ok,
    table_missing: sanctions.tableMissing || pep.tableMissing || false,
  });
}
