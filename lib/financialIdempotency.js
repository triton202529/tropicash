const IDEMPOTENCY_KEY_MAX_LEN = 128;
const IDEMPOTENCY_KEY_PATTERN = /^[a-zA-Z0-9._-]+$/;

/**
 * Extract client idempotency key from header or JSON body.
 * @param {import("http").IncomingMessage} req
 * @param {Record<string, unknown> | null | undefined} body
 * @returns {string | null}
 */
export function extractIdempotencyKey(req, body) {
  const rawHeader = req.headers["idempotency-key"] ?? req.headers["Idempotency-Key"];
  if (typeof rawHeader === "string" && rawHeader.trim()) {
    return rawHeader.trim();
  }
  if (Array.isArray(rawHeader) && typeof rawHeader[0] === "string" && rawHeader[0].trim()) {
    return rawHeader[0].trim();
  }
  if (typeof body?.idempotency_key === "string" && body.idempotency_key.trim()) {
    return body.idempotency_key.trim();
  }
  return null;
}

/**
 * @param {string | null} key
 * @returns {{ valid: boolean; error?: string }}
 */
export function validateIdempotencyKey(key) {
  if (!key) {
    return { valid: false, error: "idempotency_key_required" };
  }
  if (key.length > IDEMPOTENCY_KEY_MAX_LEN) {
    return { valid: false, error: "idempotency_key_too_long" };
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    return { valid: false, error: "idempotency_key_invalid" };
  }
  return { valid: true };
}

/**
 * Claim a processing slot for a financial operation (insert or handle unique violation).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {{
 *   table: "transfer_idempotency_keys" | "withdrawal_idempotency_keys";
 *   userId: string;
 *   idempotencyKey: string;
 *   insertFields?: Record<string, unknown>;
 * }} args
 */
export async function claimFinancialIdempotencySlot(supabaseAdmin, args) {
  const { table, userId, idempotencyKey, insertFields = {} } = args;
  const now = new Date().toISOString();
  const insertPayload = {
    user_id: userId,
    idempotency_key: idempotencyKey,
    status: "processing",
    updated_at: now,
    ...insertFields,
  };

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from(table)
    .insert(insertPayload)
    .select("id, response_payload, transaction_id, request_id")
    .maybeSingle();

  if (!insertErr && inserted?.id) {
    return { kind: "claimed", rowId: inserted.id };
  }

  if (insertErr?.code !== "23505") {
    return { kind: "error", error: insertErr };
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from(table)
    .select("id, status, user_id, response_payload, transaction_id, request_id")
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (fetchErr || !existing) {
    return {
      kind: "error",
      error: fetchErr || new Error("missing idempotency row after unique violation"),
    };
  }

  if (existing.status === "completed") {
    return { kind: "duplicate_completed", row: existing };
  }
  if (existing.status === "processing") {
    return { kind: "already_processing", row: existing };
  }
  if (existing.status === "failed") {
    const { data: updated, error: updErr } = await supabaseAdmin
      .from(table)
      .update({
        status: "processing",
        updated_at: now,
        ...insertFields,
      })
      .eq("id", existing.id)
      .eq("status", "failed")
      .select("id")
      .maybeSingle();

    if (updErr) {
      return { kind: "error", error: updErr };
    }
    if (!updated?.id) {
      return { kind: "already_processing", row: existing };
    }
    return { kind: "claimed", rowId: updated.id };
  }

  return {
    kind: "error",
    error: new Error(`unexpected idempotency status: ${existing.status}`),
  };
}

/**
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {"transfer_idempotency_keys" | "withdrawal_idempotency_keys"} table
 * @param {string} rowId
 * @param {Record<string, unknown>} fields
 */
export async function patchFinancialIdempotencyRow(supabaseAdmin, table, rowId, fields) {
  const { error } = await supabaseAdmin
    .from(table)
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", rowId);
  return error;
}
