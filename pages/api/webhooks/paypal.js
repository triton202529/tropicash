import { createSupabaseServiceClient } from "../../../lib/supabaseAdminApi";
import { handlePayPalWebhookEvent } from "../../../lib/payouts/payPalWebhookProcessor";

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_BODY = 512 * 1024;

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let len = 0;
    req.on("data", (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      len += buf.length;
      if (len > MAX_BODY) {
        reject(new Error("payload too large"));
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * PayPal webhooks (Payouts). Always respond 200 for unrecognized or duplicate events
 * so PayPal does not retry indefinitely.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let rawBuf;
  try {
    rawBuf = await readRawBody(req);
  } catch (e) {
    console.error("[webhooks/paypal] read body:", e);
    return res.status(200).json({ ok: false, note: "body_read_error" });
  }

  const rawText = rawBuf.toString("utf8");
  /** @type {Record<string, unknown>} */
  let parsed;
  try {
    parsed = JSON.parse(rawText || "{}");
  } catch (e) {
    console.warn("[webhooks/paypal] invalid json");
    return res.status(200).json({ ok: false, note: "invalid_json" });
  }

  const eventId = typeof parsed.id === "string" ? parsed.id : null;
  const eventType = typeof parsed.event_type === "string" ? parsed.event_type : "";
  const resource = parsed.resource && typeof parsed.resource === "object" ? parsed.resource : {};

  if (!eventId) {
    console.warn("[webhooks/paypal] missing event id");
    return res.status(200).json({ ok: true, note: "no_event_id" });
  }

  const supabaseAdmin = createSupabaseServiceClient();
  if (!supabaseAdmin) {
    console.error("[webhooks/paypal] missing service role");
    return res.status(200).json({ ok: false, note: "server_config" });
  }

  const { data: insertedRows, error: insErr } = await supabaseAdmin
    .from("payout_webhook_events")
    .insert({
      provider: "paypal",
      event_id: eventId,
      event_type: eventType || null,
      resource,
      raw_event: parsed,
    })
    .select("id");

  if (insErr) {
    if (insErr.code === "23505") {
      return res.status(200).json({ ok: true, duplicate: true });
    }
    console.error("[webhooks/paypal] insert log:", insErr);
    return res.status(200).json({ ok: false, note: "log_insert_failed" });
  }

  const logId = Array.isArray(insertedRows) && insertedRows[0]?.id ? insertedRows[0].id : null;
  let processingError = null;
  let matchedWithdrawalId = null;

  try {
    const result = await handlePayPalWebhookEvent(supabaseAdmin, {
      eventId,
      eventType,
      resource,
      rawEvent: parsed,
    });
    matchedWithdrawalId = result.matchedWithdrawalId ?? null;
    if (result.skipped === "unhandled_event") {
      console.info("[webhooks/paypal] unhandled event type (ok):", eventType);
    }
  } catch (e) {
    processingError = e?.message || String(e);
    console.error("[webhooks/paypal] handler error:", e);
  }

  if (logId) {
    await supabaseAdmin
      .from("payout_webhook_events")
      .update({
        matched_withdrawal_id: matchedWithdrawalId,
        processed: !processingError,
        processing_error: processingError,
      })
      .eq("id", logId);
  }

  return res.status(200).json({ ok: true, eventId, matchedWithdrawalId });
}
