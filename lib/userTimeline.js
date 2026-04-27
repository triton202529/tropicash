import { formatFraudEventTypeLabel, summarizeFraudEventData } from "./fraudEvents";

const EVENT_TITLE_MAP = {
  case_reviewed: "Case reviewed",
  case_escalated: "Case escalated",
  case_reopened: "Case reopened",
  fraud_note_saved: "Note updated",
  risk_state_recomputed: "Risk updated",
  account_control_updated: "Account status updated",
  fraud_log_created: "Fraud log created",
};

const MERGED_LIMIT = 50;

/**
 * @param {string} eventType
 */
function eventTitleForTimeline(eventType) {
  const key = String(eventType || "");
  if (EVENT_TITLE_MAP[key]) return EVENT_TITLE_MAP[key];
  return formatFraudEventTypeLabel(key);
}

/**
 * @param {string} eventType
 * @param {unknown} eventData
 */
function eventDescriptionForTimeline(eventType, eventData) {
  try {
    const s = summarizeFraudEventData(eventType, eventData);
    if (s && String(s).trim()) return String(s).trim();
  } catch (e) {
    console.error("eventDescriptionForTimeline:", e);
  }
  try {
    const raw = JSON.stringify(eventData ?? {});
    return raw.length > 140 ? `${raw.slice(0, 137)}…` : raw;
  } catch {
    return "—";
  }
}

/**
 * @param {string} eventType
 * @param {unknown} eventData
 * @returns {"high" | "medium" | "low" | "success"}
 */
function eventSeverityForTimeline(eventType, eventData) {
  const t = String(eventType || "");
  if (t === "case_escalated") return "high";
  if (t === "case_reviewed") return "success";
  const d = eventData && typeof eventData === "object" && !Array.isArray(eventData) ? eventData : {};
  const next = String(d.next_status ?? "").toLowerCase();
  if (next === "escalated") return "high";
  if (next === "reviewed") return "success";
  return "low";
}

/**
 * @param {unknown} riskLevel
 * @returns {"high" | "medium" | "low"}
 */
function logSeverityFromRiskLevel(riskLevel) {
  const k = String(riskLevel || "").toLowerCase();
  if (k === "high") return "high";
  if (k === "medium") return "medium";
  return "low";
}

/**
 * @param {Record<string, unknown>} log
 */
function mapFraudLogToTimelineItem(log) {
  const id = log?.id != null ? String(log.id) : "";
  const typ = String(log?.transaction_type || "—").replace(/_/g, " ");
  const score = log?.risk_score != null ? String(log.risk_score) : "—";
  const level = String(log?.risk_level || "—");
  const rl = log?.risk_level;
  return {
    id: `fraud_log:${id}`,
    type: "fraud_log",
    created_at: log?.created_at != null ? String(log.created_at) : "",
    title: "Fraud check triggered",
    description: `${typ} · score ${score} (${level})`,
    severity: logSeverityFromRiskLevel(rl),
    metadata: {
      fraud_log_id: id || null,
      status: log?.status != null ? String(log.status) : null,
    },
  };
}

/**
 * @param {Record<string, unknown>} ev
 */
function mapFraudEventToTimelineItem(ev) {
  const id = ev?.id != null ? String(ev.id) : "";
  const eventType = ev?.event_type != null ? String(ev.event_type) : "";
  const eventData = ev?.event_data;
  return {
    id: `event:${id}`,
    type: "event",
    created_at: ev?.created_at != null ? String(ev.created_at) : "",
    title: eventTitleForTimeline(eventType),
    description: eventDescriptionForTimeline(eventType, eventData),
    severity: eventSeverityForTimeline(eventType, eventData),
    metadata: {
      fraud_event_id: id || null,
      fraud_log_id: ev?.fraud_log_id != null ? String(ev.fraud_log_id) : null,
      actor_user_id: ev?.actor_user_id != null ? String(ev.actor_user_id) : null,
      event_type: eventType || null,
    },
  };
}

function parseTimeMs(iso) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Unified chronological timeline (fraud_logs + fraud_events) for a user.
 * @param {*} supabase
 * @param {string} userId
 * @returns {Promise<Array<{ id: string, type: string, created_at: string, title: string, description: string, severity: string, metadata: Record<string, unknown> }>>}
 */
export async function buildUserTimeline(supabase, userId) {
  const uid = String(userId || "").trim();
  if (!supabase || !uid) {
    return [];
  }

  try {
    const [logsRes, eventsRes] = await Promise.all([
      supabase
        .from("fraud_logs")
        .select("id, risk_score, risk_level, transaction_type, status, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("fraud_events")
        .select("id, fraud_log_id, event_type, event_data, actor_user_id, created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (logsRes.error) {
      console.error("buildUserTimeline fraud_logs:", logsRes.error);
    }
    if (eventsRes.error) {
      console.error("buildUserTimeline fraud_events:", eventsRes.error);
    }

    const logs = !logsRes.error && Array.isArray(logsRes.data) ? logsRes.data : [];
    const events = !eventsRes.error && Array.isArray(eventsRes.data) ? eventsRes.data : [];

    const logsMapped = logs.map((row) => mapFraudLogToTimelineItem(row));
    const eventsMapped = events.map((row) => mapFraudEventToTimelineItem(row));

    const timeline = [...logsMapped, ...eventsMapped].sort(
      (a, b) => parseTimeMs(b.created_at) - parseTimeMs(a.created_at)
    );

    return timeline.slice(0, MERGED_LIMIT);
  } catch (e) {
    console.error("buildUserTimeline:", e);
    return [];
  }
}
