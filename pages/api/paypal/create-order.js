import { createPayPalOrder } from "../../../lib/paypal";

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

  const raw = body?.amount;
  const amount = typeof raw === "string" ? parseFloat(raw) : Number(raw);

  if (raw === undefined || raw === null || raw === "") {
    return res.status(400).json({ error: "amount is required" });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a number greater than 0" });
  }

  try {
    const order = await createPayPalOrder(amount);
    return res.status(200).json({ orderID: order.id });
  } catch (err) {
    console.error("[paypal/create-order]", err);
    return res.status(502).json({
      error: err?.message || "Could not create PayPal order",
    });
  }
}
