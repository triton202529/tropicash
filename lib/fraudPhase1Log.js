/**
 * Insert Phase 1 fraud_events into fraud_logs (log-only; never throws to callers).
 * Requires columns: event_type, description, metadata (see fraud_logs_phase1_columns.sql).
 */

/** @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient */

function severityToRiskScore(sev) {
  const s = String(sev || "").toLowerCase();
  if (s === "high") return 82;
  if (s === "medium") return 55;
  return 28;
}

/**
 * @param {SupabaseClient} supabase
 * @param {object} payload
 * @param {string} payload.userId
 * @param {'fund'|'withdraw'|'send'} payload.transactionType
 * @param {string} payload.eventType
 * @param {string} payload.description
 * @param {'low'|'medium'|'high'} payload.severity
 * @param {number} [payload.amount]
 * @param {Record<string, unknown>} [payload.metadata]
 * @param {string|null} [payload.relatedTransactionId]
 */
export async function insertPhase1FraudLog(supabase, payload) {
  if (!supabase || !payload?.userId || !payload?.eventType) return;

  const amount = Number(payload.amount);
  const safeAmount = Number.isFinite(amount) && amount >= 0 ? amount : 0;
  const meta =
    payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
      ? payload.metadata
      : {};

  const row = {
    user_id: payload.userId,
    transaction_type: payload.transactionType,
    amount: safeAmount,
    risk_score: severityToRiskScore(payload.severity),
    risk_level: payload.severity,
    flags: ["phase1", payload.eventType],
    status: "open",
    event_type: payload.eventType,
    description: String(payload.description || payload.eventType).slice(0, 2000),
    metadata: meta,
    related_transaction_id: payload.relatedTransactionId ?? null,
  };

  try {
    const { error } = await supabase.from("fraud_logs").insert(row);
    if (error) {
      console.error("[fraudPhase1Log] insert failed:", error.message || error);
    }
  } catch (e) {
    console.error("[fraudPhase1Log] insert threw:", e?.message || e);
  }
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabase
 * @param {Array<object>} events
 */
export async function insertPhase1FraudLogs(supabase, events) {
  if (!supabase || !Array.isArray(events) || events.length === 0) return;
  for (const ev of events) {
    await insertPhase1FraudLog(supabase, ev);
  }
}
