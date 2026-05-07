export const FUNDING_PROVIDER_PAYPAL = "paypal";

export function paypalCaptureIdFromResult(result) {
  return result?.purchase_units?.[0]?.payments?.captures?.[0]?.id ?? null;
}

/**
 * Claim a processing slot for funding (insert, or handle unique violation).
 * @param {import("@supabase/supabase-js").SupabaseClient} supabaseAdmin
 * @param {{ provider: string; providerOrderId: string; userId: string; amount: number }} args
 */
export async function claimFundingProcessingSlot(supabaseAdmin, args) {
  const { provider, providerOrderId, userId, amount } = args;
  const now = new Date().toISOString();
  const insertPayload = {
    provider,
    provider_order_id: providerOrderId,
    user_id: userId,
    amount,
    status: "processing",
    updated_at: now,
  };

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from("funding_idempotency_keys")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (!insertErr && inserted?.id) {
    return { kind: "claimed", rowId: inserted.id };
  }

  if (insertErr?.code !== "23505") {
    return { kind: "error", error: insertErr };
  }

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from("funding_idempotency_keys")
    .select("id,status,user_id")
    .eq("provider", provider)
    .eq("provider_order_id", providerOrderId)
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
    if (existing.user_id != null && existing.user_id !== userId) {
      return { kind: "retry_forbidden", row: existing };
    }
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("funding_idempotency_keys")
      .update({
        status: "processing",
        user_id: userId,
        amount,
        updated_at: now,
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
    error: new Error(`unexpected funding idempotency status: ${existing.status}`),
  };
}

export async function patchFundingIdempotencyRow(supabaseAdmin, rowId, fields) {
  const { error } = await supabaseAdmin
    .from("funding_idempotency_keys")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", rowId);
  return error;
}

export function serializeSupabaseError(err) {
  if (!err || typeof err !== "object") {
    return { message: String(err) };
  }
  return {
    message: err.message,
    code: err.code,
    details: err.details,
    hint: err.hint,
  };
}
