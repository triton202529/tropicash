import { createSupabaseServiceClient } from "../../../lib/supabaseAdminApi";
import { handlePayPalWebhookEvent } from "../../../lib/payouts/payPalWebhookProcessor";
import { paypalApiFetch } from "../../../lib/paypal";
import { logOperationalError } from "../../../lib/operationalLogger";

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

function pickHeader(req, name) {
  const v = req.headers[name];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return null;
}

/**
 * Verify the PayPal webhook signature via the REST API.
 * Returns the verification_status string (e.g. "SUCCESS" / "FAILURE") or null on error.
 *
 * @param {object} args
 * @param {string} args.webhookId
 * @param {object} args.webhookEvent - The parsed JSON body PayPal posted.
 * @param {string|null} args.authAlgo
 * @param {string|null} args.certUrl
 * @param {string|null} args.transmissionId
 * @param {string|null} args.transmissionSig
 * @param {string|null} args.transmissionTime
 */
async function verifyPayPalWebhookSignature({
  webhookId,
  webhookEvent,
  authAlgo,
  certUrl,
  transmissionId,
  transmissionSig,
  transmissionTime,
}) {
  const body = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: webhookId,
    webhook_event: webhookEvent,
  };
  const { ok, status, json } = await paypalApiFetch(
    "/v1/notifications/verify-webhook-signature",
    { method: "POST", body },
  );
  if (!ok) {
    return { status: "ERROR", httpStatus: status };
  }
  const verification = json && typeof json === "object" ? String(json.verification_status || "") : "";
  return { status: verification || "UNKNOWN", httpStatus: status };
}

/**
 * PayPal webhooks (Payouts). Always respond 200 for unrecognized or duplicate events
 * so PayPal does not retry indefinitely. Signature verification failures return 401.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    console.error("[webhooks/paypal] missing PAYPAL_WEBHOOK_ID");
    void logOperationalError({
      category: "env.config",
      message: "Missing required env: PAYPAL_WEBHOOK_ID",
      userId: null,
      route: "/api/webhooks/paypal",
      metadata: { missing: ["PAYPAL_WEBHOOK_ID"] },
    });
    return res.status(500).json({ error: "Server configuration error" });
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

  const authAlgo = pickHeader(req, "paypal-auth-algo");
  const certUrl = pickHeader(req, "paypal-cert-url");
  const transmissionId = pickHeader(req, "paypal-transmission-id");
  const transmissionSig = pickHeader(req, "paypal-transmission-sig");
  const transmissionTime = pickHeader(req, "paypal-transmission-time");

  let verification = null;
  let verifyHttpStatus = null;
  let verifyThrew = false;
  try {
    const result = await verifyPayPalWebhookSignature({
      webhookId,
      webhookEvent: parsed,
      authAlgo,
      certUrl,
      transmissionId,
      transmissionSig,
      transmissionTime,
    });
    verification = result.status;
    verifyHttpStatus = result.httpStatus;
  } catch (err) {
    verifyThrew = true;
    console.error("[webhooks/paypal] signature verify threw:", err?.message || err);
  }

  if (verifyThrew || verification !== "SUCCESS") {
    void logOperationalError({
      supabaseClient: supabaseAdmin,
      category: "paypal.webhook_verify",
      message: verifyThrew
        ? "PayPal webhook signature verification threw"
        : `PayPal webhook signature verification status: ${verification || "UNKNOWN"}`,
      userId: null,
      route: "/api/webhooks/paypal",
      metadata: {
        eventId,
        eventType: eventType || null,
        verificationStatus: verification,
        verifyHttpStatus,
      },
    });
    return res.status(401).json({ error: "Invalid webhook signature" });
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
