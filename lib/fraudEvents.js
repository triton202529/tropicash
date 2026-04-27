/**
 * Best-effort fraud audit events (fraud_events). Does not throw on insert failure.
 */

function safeEventData(data) {
  if (data && typeof data === "object" && !Array.isArray(data)) return data;
  return {};
}

/**
 * @param {*} supabase
 * @param {{
 *   fraudLogId?: string | null,
 *   userId?: string | null,
 *   actorUserId?: string | null,
 *   eventType: string,
 *   eventData?: Record<string, unknown>,
 * }} payload
 * @returns {Promise<{ ok: boolean, error?: unknown }>}
 */
export async function createFraudEvent(supabase, payload) {
  if (!supabase) {
    console.error("createFraudEvent: missing supabase");
    return { ok: false, error: new Error("missing supabase") };
  }
  const eventType = String(payload?.eventType || "").trim();
  if (!eventType) {
    console.error("createFraudEvent: missing eventType");
    return { ok: false, error: new Error("missing eventType") };
  }

  try {
    const row = {
      fraud_log_id: payload.fraudLogId ?? null,
      user_id: payload.userId ?? null,
      actor_user_id: payload.actorUserId ?? null,
      event_type: eventType,
      event_data: safeEventData(payload.eventData),
    };

    const { error } = await supabase.from("fraud_events").insert([row]);

    if (error) {
      console.error("createFraudEvent:", error);
      return { ok: false, error };
    }
    return { ok: true };
  } catch (e) {
    console.error("createFraudEvent:", e);
    return { ok: false, error: e };
  }
}

function statusToEventType(nextStatus) {
  const s = String(nextStatus || "").toLowerCase();
  if (s === "reviewed") return "case_reviewed";
  if (s === "escalated") return "case_escalated";
  if (s === "open") return "case_reopened";
  return "fraud_status_changed";
}

/**
 * @param {*} supabase
 * @param {{
 *   fraudLogId: string,
 *   userId?: string | null,
 *   actorUserId: string,
 *   previousStatus: string,
 *   nextStatus: string,
 *   reviewedAt: string,
 * }} p
 */
export function logFraudStatusChanged(supabase, p) {
  const eventType = statusToEventType(p.nextStatus);
  return createFraudEvent(supabase, {
    fraudLogId: p.fraudLogId,
    userId: p.userId ?? null,
    actorUserId: p.actorUserId,
    eventType,
    eventData: {
      previous_status: String(p.previousStatus || "").toLowerCase(),
      next_status: String(p.nextStatus || "").toLowerCase(),
      reviewed_at: p.reviewedAt,
    },
  });
}

/**
 * @param {*} supabase
 * @param {{
 *   fraudLogId: string,
 *   userId?: string | null,
 *   actorUserId: string,
 *   note: string,
 * }} p
 */
export function logFraudNoteSaved(supabase, p) {
  const trimmed = String(p.note ?? "").trim();
  return createFraudEvent(supabase, {
    fraudLogId: p.fraudLogId,
    userId: p.userId ?? null,
    actorUserId: p.actorUserId,
    eventType: "fraud_note_saved",
    eventData: {
      note_present: trimmed.length > 0,
      note_length: trimmed.length,
    },
  });
}

/**
 * @param {*} supabase
 * @param {{
 *   userId: string,
 *   actorUserId: string,
 *   fraudLogId?: string | null,
 *   derived: { riskLevel: string, riskFlags: string[], riskScoreSnapshot: number | null },
 *   stats: {
 *     total_logs: number,
 *     high_count: number,
 *     medium_count: number,
 *     low_count: number,
 *     open_count: number,
 *     escalated_count: number,
 *   },
 * }} p
 */
export function logRiskStateRecomputed(supabase, p) {
  const { derived, stats } = p;
  return createFraudEvent(supabase, {
    fraudLogId: p.fraudLogId ?? null,
    userId: p.userId,
    actorUserId: p.actorUserId,
    eventType: "risk_state_recomputed",
    eventData: {
      risk_level: derived?.riskLevel,
      risk_flags: derived?.riskFlags ?? [],
      risk_score_snapshot: derived?.riskScoreSnapshot ?? null,
      total_logs: stats?.total_logs ?? 0,
      high_count: stats?.high_count ?? 0,
      medium_count: stats?.medium_count ?? 0,
      low_count: stats?.low_count ?? 0,
      open_count: stats?.open_count ?? 0,
      escalated_count: stats?.escalated_count ?? 0,
    },
  });
}

/**
 * @param {*} supabase
 * @param {{
 *   fraudLogId: string,
 *   userId: string,
 *   actorUserId: string,
 *   transactionType: string,
 *   riskScore: number,
 *   riskLevel: string,
 *   flagsCount: number,
 * }} p
 */
export function logFraudLogCreated(supabase, p) {
  void createFraudEvent(supabase, {
    fraudLogId: p.fraudLogId,
    userId: p.userId,
    actorUserId: p.actorUserId ?? p.userId,
    eventType: "fraud_log_created",
    eventData: {
      transaction_type: p.transactionType,
      risk_score: p.riskScore,
      risk_level: p.riskLevel,
      flags_count: p.flagsCount,
    },
  }).catch((e) => {
    console.error("logFraudLogCreated:", e);
  });
}

/**
 * @param {*} supabase
 * @param {{
 *   userId: string,
 *   actorUserId: string,
 *   fraudLogId?: string | null,
 *   previousAccountStatus: string,
 *   nextAccountStatus: string,
 *   accountFlags: string[],
 *   source: "manual" | "recomputed",
 * }} p
 */
export function logAccountControlUpdated(supabase, p) {
  return createFraudEvent(supabase, {
    fraudLogId: p.fraudLogId ?? null,
    userId: p.userId,
    actorUserId: p.actorUserId,
    eventType: "account_control_updated",
    eventData: {
      previous_account_status: String(p.previousAccountStatus || ""),
      next_account_status: String(p.nextAccountStatus || ""),
      account_flags: Array.isArray(p.accountFlags) ? p.accountFlags : [],
      source: p.source === "manual" ? "manual" : "recomputed",
    },
  });
}

const EVENT_LABELS = {
  fraud_log_created: "Fraud log created",
  fraud_status_changed: "Status changed",
  fraud_note_saved: "Review note saved",
  risk_state_recomputed: "Risk state recomputed",
  case_escalated: "Case escalated",
  case_reopened: "Case reopened",
  case_reviewed: "Case reviewed",
  account_control_updated: "Account control updated",
  smart_alert_created: "Smart alert created",
  smart_alert_status_updated: "Smart alert updated",
  fraud_case_created: "Fraud case created",
  fraud_case_status_updated: "Fraud case status updated",
  fraud_case_note_added: "Fraud case note added",
  fraud_case_assigned: "Fraud case assigned",
};

export function formatFraudEventTypeLabel(eventType) {
  const key = String(eventType || "");
  if (EVENT_LABELS[key]) return EVENT_LABELS[key];
  return key.replace(/_/g, " ") || "Event";
}

/**
 * One-line summary for timeline rows (no sensitive note text).
 * @param {string} eventType
 * @param {unknown} eventData
 */
export function summarizeFraudEventData(eventType, eventData) {
  const d = eventData && typeof eventData === "object" && !Array.isArray(eventData) ? eventData : {};
  const t = String(eventType || "");

  if (t === "case_reviewed" || t === "case_escalated" || t === "case_reopened" || t === "fraud_status_changed") {
    const prev = d.previous_status != null ? String(d.previous_status) : "";
    const next = d.next_status != null ? String(d.next_status) : "";
    if (prev && next) return `${prev} → ${next}`;
    if (next) return `→ ${next}`;
  }
  if (t === "fraud_note_saved") {
    return d.note_present ? `Note saved (${Number(d.note_length) || 0} chars)` : "Note cleared";
  }
  if (t === "risk_state_recomputed") {
    const lvl = d.risk_level != null ? String(d.risk_level) : "—";
    const fc = Array.isArray(d.risk_flags) ? d.risk_flags.length : 0;
    return `${lvl} · ${fc} account flags · ${Number(d.total_logs) || 0} logs`;
  }
  if (t === "fraud_log_created") {
    return `${String(d.transaction_type || "txn")} · score ${d.risk_score ?? "—"} (${String(d.risk_level || "")})`;
  }
  if (t === "account_control_updated") {
    const prev = d.previous_account_status != null ? String(d.previous_account_status) : "";
    const next = d.next_account_status != null ? String(d.next_account_status) : "";
    const src = d.source != null ? String(d.source) : "";
    const fc = Array.isArray(d.account_flags) ? d.account_flags.length : 0;
    return `${prev} → ${next} · ${fc} flags · ${src}`;
  }
  if (t === "smart_alert_created") {
    const at = d.alert_type != null ? String(d.alert_type) : "";
    const sev = d.severity != null ? String(d.severity) : "";
    const tl = d.title != null ? String(d.title) : "";
    return [at, sev, tl].filter(Boolean).join(" · ") || "Smart alert";
  }
  if (t === "smart_alert_status_updated") {
    const st = d.status != null ? String(d.status) : "";
    const at = d.alert_type != null ? String(d.alert_type) : "";
    return [at, st].filter(Boolean).join(" · ") || "Status updated";
  }
  if (t === "fraud_case_created") {
    const tl = d.title != null ? String(d.title) : "";
    const pr = d.priority != null ? String(d.priority) : "";
    return [tl, pr].filter(Boolean).join(" · ") || "Case opened";
  }
  if (t === "fraud_case_status_updated") {
    const prev = d.previous_status != null ? String(d.previous_status) : "";
    const next = d.next_status != null ? String(d.next_status) : "";
    if (prev && next) return `${prev} → ${next}`;
    return next || "—";
  }
  if (t === "fraud_case_note_added") {
    return `Note (${Number(d.note_length) || 0} chars)`;
  }
  if (t === "fraud_case_assigned") {
    const aid = d.assigned_to != null ? String(d.assigned_to) : "";
    return aid ? `Assignee ${aid.slice(0, 8)}…` : "Assignment updated";
  }

  try {
    const s = JSON.stringify(d);
    return s.length > 96 ? `${s.slice(0, 93)}…` : s;
  } catch {
    return "—";
  }
}
