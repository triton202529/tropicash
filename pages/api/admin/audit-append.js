import { requireAdminFromBearer, createSupabaseServiceClient } from "../../../lib/supabaseAdminApi";
import { appendAuditEventServer } from "../../../lib/auditTimeline";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const auth = await requireAdminFromBearer(req.headers.authorization);
  if (auth.error) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const admin = createSupabaseServiceClient();
  if (!admin) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }
  if (!body || typeof body !== "object") {
    return res.status(400).json({ error: "Invalid body" });
  }

  const actorUserId = auth.user?.id ?? null;
  await appendAuditEventServer({
    entityType: body.entityType,
    entityId: body.entityId,
    eventType: body.eventType,
    actorUserId,
    targetUserId: body.targetUserId,
    severity: body.severity,
    title: body.title,
    description: body.description,
    metadata: body.metadata,
    dedupeKey: body.dedupeKey,
    dedupeWindowMs: body.dedupeWindowMs,
  });

  return res.status(204).end();
}
