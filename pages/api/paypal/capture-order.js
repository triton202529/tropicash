import { capturePayPalOrder } from "../../../lib/paypal";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body || "{}");
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  }

  const orderID = body?.orderID;
  if (!orderID || typeof orderID !== "string") {
    return res.status(400).json({ error: "orderID is required" });
  }

  try {
    const result = await capturePayPalOrder(orderID);
    return res.status(200).json(result);
  } catch (err) {
    console.error("[paypal/capture-order]", err);
    return res.status(502).json({
      error: err?.message || "Could not capture PayPal order",
    });
  }
}
