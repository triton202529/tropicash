/**
 * Treasury Event Center — read-only operational event ingestion for Treasury Intelligence.
 * Observe → Normalize → Summarize — NOT Act. Fail-open; never throws to callers.
 */

import { supabase as defaultClient } from "./supabaseClient";
import { fetchAdminAuditLogs } from "./adminAudit";
import { fetchRecentSecurityEvents } from "./adminSecurity";
import { fetchTreasuryOperationalEvents } from "./treasuryOperations";
import { sanitizeOperationalMetadata } from "./operationalLogger";
import { buildKycRiskProfileFromStatus, fetchKycStatusMapForUsers, fetchKycLimitPolicies, summarizeKycLimitPolicy, evaluateWithdrawalEnforcementFromPolicy } from "./kycRisk";

const LOG_NS = "[treasury-event-center]";

export const TREASURY_EVENT_SOURCES = Object.freeze([
  "fraud_logs",
  "security_events",
  "withdrawal_requests",
  "admin_audit_logs",
  "notifications",
  "treasury_operational_events",
]);

export const TREASURY_EVENT_CATEGORIES = Object.freeze([
  "Fraud",
  "Security",
  "Withdrawals",
  "Treasury",
  "Admin",
  "Notifications",
]);

export const TREASURY_EVENT_SEVERITIES = Object.freeze(["critical", "warning", "informational"]);

export const TREASURY_EVENT_RESOLUTION_STATUSES = Object.freeze([
  "open",
  "reviewing",
  "escalated",
  "resolved",
  "dismissed",
]);

function warn(payload) {
  try {
    console.warn(LOG_NS, payload);
  } catch {
    /* ignore */
  }
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function isMissingTableError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204") return true;
  return msg.includes("does not exist") || msg.includes("not found");
}

function isMissingInvestigationNotesTable(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204") return true;
  return msg.includes("treasury_event_investigation_notes") && (msg.includes("does not exist") || msg.includes("not found"));
}

function isMissingResolutionsTable(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204") return true;
  return msg.includes("treasury_event_resolutions") && (msg.includes("does not exist") || msg.includes("not found"));
}

function normalizeResolutionStatus(status) {
  const key = String(status || "open").toLowerCase().trim();
  return TREASURY_EVENT_RESOLUTION_STATUSES.includes(key) ? key : "open";
}

const DISPLAY_REDACT_URL_KEYS = ["url", "uri", "document", "file", "path", "signed", "presigned"];

function keyLooksLikePrivateUrl(key) {
  const lower = String(key || "").toLowerCase();
  return DISPLAY_REDACT_URL_KEYS.some((s) => lower.includes(s));
}

function redactDisplayValue(key, value) {
  if (value == null) return value;
  if (keyLooksLikePrivateUrl(key) && typeof value === "string") {
    if (/^https?:\/\//i.test(value) || value.includes("storage/v1/object")) {
      return "[redacted url]";
    }
  }
  return value;
}

/**
 * Sanitize event metadata for admin display — redacts secrets and private document URLs.
 * @param {Record<string, unknown>} metadata
 */
export function sanitizeTreasuryEventMetadataForDisplay(metadata) {
  const base = sanitizeOperationalMetadata(safeMetadata(metadata));
  const out = {};
  for (const [k, v] of Object.entries(base)) {
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      out[k] = sanitizeTreasuryEventMetadataForDisplay(v);
    } else if (Array.isArray(v)) {
      out[k] = v.map((item) =>
        item != null && typeof item === "object" && !Array.isArray(item)
          ? sanitizeTreasuryEventMetadataForDisplay(item)
          : redactDisplayValue(k, item),
      );
    } else {
      out[k] = redactDisplayValue(k, v);
    }
  }
  return out;
}

function mapInvestigationNoteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    eventSource: row.event_source || null,
    eventCategory: row.event_category || null,
    note: row.note || "",
    createdBy: row.created_by || null,
    createdAt: row.created_at,
  };
}

function mapResolutionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    eventSource: row.event_source || null,
    eventCategory: row.event_category || null,
    status: normalizeResolutionStatus(row.status),
    resolutionSummary: row.resolution_summary || "",
    assignedTo: row.assigned_to || null,
    resolvedBy: row.resolved_by || null,
    resolvedAt: row.resolved_at || null,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toIso(value) {
  if (!value) return new Date(0).toISOString();
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date(0).toISOString();
}

function safeMetadata(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function humanizeToken(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Map heterogeneous severity tokens to canonical: critical | warning | informational.
 * @param {string} raw
 * @returns {'critical'|'warning'|'informational'}
 */
export function mapTreasuryEventSeverity(raw) {
  const key = String(raw || "informational").toLowerCase().trim();
  if (["critical", "high", "severe"].includes(key)) return "critical";
  if (["warning", "warn", "moderate", "medium", "elevated"].includes(key)) return "warning";
  if (["low", "info", "informational", "success", "minor"].includes(key)) return "informational";
  return "informational";
}

function mapFraudRiskToSeverity(riskLevel, status) {
  const risk = String(riskLevel || "").toLowerCase();
  if (risk === "high" || risk === "critical") return "critical";
  if (risk === "medium" || risk === "moderate") return "warning";
  if (String(status || "").toLowerCase() === "escalated") return "warning";
  return "informational";
}

function mapWithdrawalStatusToSeverity(status) {
  const s = String(status || "").toLowerCase();
  if (s === "failed" || s === "rejected") return "warning";
  if (s === "pending" || s === "processing") return "warning";
  return "informational";
}

function mapTreasuryOperationalSeverity(severity) {
  const s = String(severity || "info").toLowerCase();
  if (s === "high") return "critical";
  if (s === "elevated" || s === "moderate") return "warning";
  return "informational";
}

/**
 * Convert a raw row from any connected source into the normalized treasury event shape.
 * @param {Record<string, unknown>} event
 * @param {{ source?: string }} [opts]
 * @returns {object|null}
 */
export function normalizeTreasuryEvent(event, opts = {}) {
  if (!event || typeof event !== "object") return null;

  if (event.source && event.category && event.severity && event.title && event.created_at) {
    return {
      id: String(event.id || ""),
      source: String(event.source),
      category: String(event.category),
      severity: mapTreasuryEventSeverity(event.severity),
      title: String(event.title || "Treasury event"),
      description: String(event.description || ""),
      created_at: toIso(event.created_at),
      metadata: safeMetadata(event.metadata),
    };
  }

  const source = String(opts.source || event._source || "").trim();

  if (source === "fraud_logs") {
    const title =
      event.description ||
      `${humanizeToken(event.event_type || event.transaction_type || "fraud")} signal`;
    return {
      id: `fraud:${event.id}`,
      source: "fraud_logs",
      category: "Fraud",
      severity: mapFraudRiskToSeverity(event.risk_level, event.status),
      title: String(title).slice(0, 500),
      description: [
        event.event_type ? `Event: ${humanizeToken(event.event_type)}` : null,
        event.transaction_type ? `Type: ${humanizeToken(event.transaction_type)}` : null,
        event.status ? `Status: ${humanizeToken(event.status)}` : null,
        event.risk_level ? `Risk: ${String(event.risk_level).toUpperCase()}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      created_at: toIso(event.created_at),
      metadata: safeMetadata({
        userId: event.user_id,
        riskScore: event.risk_score,
        riskLevel: event.risk_level,
        transactionType: event.transaction_type,
        eventType: event.event_type,
        status: event.status,
        relatedTransactionId: event.related_transaction_id,
        raw: event.metadata,
      }),
    };
  }

  if (source === "security_events") {
    return {
      id: `security:${event.id}`,
      source: "security_events",
      category: "Security",
      severity: mapTreasuryEventSeverity(event.severity),
      title: humanizeToken(event.type || "Security event"),
      description: String(event.description || ""),
      created_at: toIso(event.created_at),
      metadata: safeMetadata({ userId: event.user_id, type: event.type, raw: event.metadata }),
    };
  }

  if (source === "withdrawal_requests") {
    const amount = Number(event.amount);
    const amountLabel = Number.isFinite(amount) ? `$${amount.toFixed(2)}` : "—";
    return {
      id: `withdrawal:${event.id}`,
      source: "withdrawal_requests",
      category: "Withdrawals",
      severity: mapWithdrawalStatusToSeverity(event.status),
      title: `Withdrawal ${humanizeToken(event.status || "update")} — ${amountLabel}`,
      description: [
        event.payout_label ? `Payout: ${event.payout_label}` : null,
        event.processor ? `Processor: ${event.processor}` : null,
        event.failure_reason ? `Reason: ${event.failure_reason}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      created_at: toIso(event.updated_at || event.created_at),
      metadata: safeMetadata({
        userId: event.user_id,
        amount: event.amount,
        status: event.status,
        payoutMethodId: event.payout_method_id,
        processorStatus: event.processor_status,
      }),
    };
  }

  if (source === "admin_audit_logs") {
    return {
      id: `audit:${event.id}`,
      source: "admin_audit_logs",
      category: "Admin",
      severity: mapTreasuryEventSeverity(event.severity),
      title: humanizeToken(event.action || "Admin action"),
      description: String(event.description || ""),
      created_at: toIso(event.created_at),
      metadata: safeMetadata({
        actorUserId: event.actor_user_id,
        targetUserId: event.target_user_id,
        category: event.category,
        action: event.action,
        raw: event.metadata,
      }),
    };
  }

  if (source === "notifications") {
    const categoryRaw = String(event.category || "").toLowerCase();
    let category = "Notifications";
    if (categoryRaw === "fraud") category = "Fraud";
    else if (categoryRaw === "security") category = "Security";
    else if (categoryRaw === "payments" || categoryRaw === "treasury") category = "Treasury";
    else if (categoryRaw === "admin") category = "Admin";

    return {
      id: `notification:${event.id}`,
      source: "notifications",
      category,
      severity: mapTreasuryEventSeverity(event.severity || "info"),
      title: String(event.title || event.message || "Notification"),
      description: String(event.message || event.title || ""),
      created_at: toIso(event.created_at),
      metadata: safeMetadata({
        userId: event.user_id,
        eventType: event.event_type,
        type: event.type,
        category: event.category,
        isRead: event.is_read,
        raw: event.metadata,
      }),
    };
  }

  if (source === "treasury_operational_events") {
    return {
      id: `treasury:${event.id}`,
      source: "treasury_operational_events",
      category: "Treasury",
      severity: mapTreasuryOperationalSeverity(event.severity || event.eventType),
      title: String(event.title || humanizeToken(event.eventType || event.event_type || "Treasury event")),
      description: String(event.description || ""),
      created_at: toIso(event.createdAt || event.created_at),
      metadata: safeMetadata({
        eventType: event.eventType || event.event_type,
        raw: event.metadata,
      }),
    };
  }

  return null;
}

async function fetchFraudLogEvents(supabase, limit) {
  try {
    const { data, error } = await supabase
      .from("fraud_logs")
      .select("id, user_id, event_type, description, risk_level, risk_score, transaction_type, status, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (!isMissingTableError(error)) warn({ op: "fetchFraudLogEvents", err: error.message });
      return [];
    }
    return (data || []).map((row) => normalizeTreasuryEvent(row, { source: "fraud_logs" })).filter(Boolean);
  } catch (err) {
    warn({ op: "fetchFraudLogEvents_throw", err: err?.message || String(err) });
    return [];
  }
}

async function fetchWithdrawalEvents(supabase, limit) {
  try {
    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select(
        "id, user_id, amount, status, payout_label, processor, processor_status, failure_reason, created_at, updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (!isMissingTableError(error)) warn({ op: "fetchWithdrawalEvents", err: error.message });
      return [];
    }
    const rows = data || [];
    const userIds = rows.map((row) => row.user_id).filter(Boolean);
    const [kycStatusMap, policiesResult] = await Promise.all([
      fetchKycStatusMapForUsers(userIds),
      fetchKycLimitPolicies(),
    ]);
    const policyByStatus = Object.fromEntries(
      (policiesResult?.data || []).map((p) => [p.kyc_status, p]),
    );
    return rows
      .map((row) => {
        const normalized = normalizeTreasuryEvent(row, { source: "withdrawal_requests" });
        if (!normalized) return null;
        const kycStatus = kycStatusMap[row.user_id] || "missing";
        const kycRisk = buildKycRiskProfileFromStatus(kycStatus);
        const policy = summarizeKycLimitPolicy(policyByStatus[kycStatus] || kycStatus);
        const enforcement = evaluateWithdrawalEnforcementFromPolicy({
          kycStatus,
          amount: row.amount,
          policy: policyByStatus[kycStatus],
        });
        normalized.metadata = safeMetadata({
          ...normalized.metadata,
          kycStatus,
          kycVerificationTier: kycRisk.verificationTier,
          kycRiskLevel: kycRisk.riskLevel,
          kycEnforcementMode: policy.enforcementMode,
          kycWithdrawalDailyLimit: policy.withdrawalDaily,
          kycEnforcementAllowed: enforcement.allowed,
          kycEnforcementWouldBlock: !enforcement.allowed,
          kycEnforcementExceedsLimit: enforcement.exceedsLimit,
          adminWithdrawalReviewHint: row.id
            ? `Review in admin withdrawal queue (/admin/withdrawals?withdrawalId=${row.id})`
            : null,
        });
        return normalized;
      })
      .filter(Boolean);
  } catch (err) {
    warn({ op: "fetchWithdrawalEvents_throw", err: err?.message || String(err) });
    return [];
  }
}

async function fetchNotificationEvents(supabase, limit) {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("id, user_id, type, title, message, category, severity, event_type, is_read, metadata, created_at")
      .in("category", ["treasury", "payments", "fraud", "security", "admin", "system"])
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (!isMissingTableError(error)) warn({ op: "fetchNotificationEvents", err: error.message });
      return [];
    }
    return (data || []).map((row) => normalizeTreasuryEvent(row, { source: "notifications" })).filter(Boolean);
  } catch (err) {
    warn({ op: "fetchNotificationEvents_throw", err: err?.message || String(err) });
    return [];
  }
}

/**
 * Load and merge normalized treasury events from all connected operational sources.
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabase]
 * @param {{ limit?: number, perSourceLimit?: number }} [opts]
 * @returns {Promise<{ events: object[], sources: Record<string, number>, fetchedAt: string }>}
 */
export async function fetchTreasuryEvents(supabase, opts = {}) {
  const client = supabase || defaultClient;
  const perSourceLimit = clamp(Math.round(Number(opts.perSourceLimit ?? opts.limit) || 40), 5, 100);
  const mergedCap = clamp(Math.round(Number(opts.limit) || 200), 20, 400);

  const empty = { events: [], sources: {}, fetchedAt: new Date().toISOString() };
  if (!client) {
    warn({ op: "fetchTreasuryEvents", reason: "no_client" });
    return empty;
  }

  const [fraud, securityRes, withdrawals, auditRes, notifications, treasuryOps] = await Promise.all([
    fetchFraudLogEvents(client, perSourceLimit),
    fetchRecentSecurityEvents(client, { limit: perSourceLimit }),
    fetchWithdrawalEvents(client, perSourceLimit),
    fetchAdminAuditLogs({ limit: perSourceLimit, supabaseClient: client }),
    fetchNotificationEvents(client, perSourceLimit),
    fetchTreasuryOperationalEvents(client, { limit: perSourceLimit }),
  ]);

  const security = (securityRes?.rows || [])
    .map((row) => normalizeTreasuryEvent(row, { source: "security_events" }))
    .filter(Boolean);
  const audit = (auditRes?.rows || [])
    .map((row) => normalizeTreasuryEvent(row, { source: "admin_audit_logs" }))
    .filter(Boolean);
  const treasury = (treasuryOps || [])
    .map((row) => normalizeTreasuryEvent(row, { source: "treasury_operational_events" }))
    .filter(Boolean);

  const sources = {
    fraud_logs: fraud.length,
    security_events: security.length,
    withdrawal_requests: withdrawals.length,
    admin_audit_logs: audit.length,
    notifications: notifications.length,
    treasury_operational_events: treasury.length,
  };

  const events = [...fraud, ...security, ...withdrawals, ...audit, ...notifications, ...treasury]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, mergedCap);

  return { events, sources, fetchedAt: new Date().toISOString() };
}

/**
 * @param {object[]} events
 */
export function buildTreasuryEventSummary(events) {
  const list = Array.isArray(events) ? events : [];
  const categories = {};
  for (const cat of TREASURY_EVENT_CATEGORIES) {
    categories[cat] = 0;
  }

  let criticalEvents = 0;
  let warningEvents = 0;
  let informationalEvents = 0;

  for (const evt of list) {
    if (evt.category && categories[evt.category] != null) {
      categories[evt.category] += 1;
    }
    if (evt.severity === "critical") criticalEvents += 1;
    else if (evt.severity === "warning") warningEvents += 1;
    else informationalEvents += 1;
  }

  const summary =
    list.length === 0
      ? "No operational events ingested in the current window. Treasury Event Center remains read-only and advisory."
      : `Treasury Event Center ingested ${list.length} normalized operational events — ${criticalEvents} critical, ${warningEvents} warning, ${informationalEvents} informational. Observation only; no treasury execution implied.`;

  return {
    totalEvents: list.length,
    criticalEvents,
    warningEvents,
    informationalEvents,
    categories,
    summary,
  };
}

/**
 * @param {object[]} events
 */
export function buildTreasuryEventHealth(events) {
  const list = Array.isArray(events) ? events : [];
  const summary = buildTreasuryEventSummary(list);
  const { criticalEvents, warningEvents, totalEvents } = summary;

  let healthStatus = "stable";
  let riskLevel = "low";
  let attentionRequired = false;
  const recommendations = [];

  if (criticalEvents >= 3) {
    healthStatus = "critical";
    riskLevel = "high";
    attentionRequired = true;
    recommendations.push(
      "Multiple critical operational events detected — prioritize read-only review of fraud, security, and withdrawal panels before advisory synthesis.",
    );
  } else if (criticalEvents >= 1) {
    healthStatus = "attention_required";
    riskLevel = "elevated";
    attentionRequired = true;
    recommendations.push(
      "Critical event present — confirm treasury posture through Event Center review; remain observational with no automated execution.",
    );
  } else if (warningEvents >= 5) {
    healthStatus = "elevated";
    riskLevel = "moderate";
    attentionRequired = true;
    recommendations.push(
      "Elevated warning density suggests heightened interpretive load — tighten monitoring cadence in advisory mode only.",
    );
  } else if (warningEvents >= 1) {
    healthStatus = "stable";
    riskLevel = "moderate";
    recommendations.push(
      "Warning-level events present within normal monitoring tolerance — continue institutional observation.",
    );
  } else {
    recommendations.push(
      "Operational event stream is calm — maintain periodic Event Center review as part of treasury intelligence cadence.",
    );
  }

  if (totalEvents === 0) {
    healthStatus = "stable";
    riskLevel = "low";
    attentionRequired = false;
    recommendations.length = 0;
    recommendations.push(
      "Event ingestion returned no rows — verify connected sources or expand the observation window on next refresh.",
    );
  }

  const fraudCount = summary.categories?.Fraud || 0;
  const withdrawalCount = summary.categories?.Withdrawals || 0;
  if (fraudCount >= 3 && criticalEvents === 0) {
    recommendations.push("Fraud category activity elevated — cross-reference with treasury risk narrative before leadership visibility.");
  }
  if (withdrawalCount >= 5 && warningEvents >= 2) {
    recommendations.push("Withdrawal queue activity elevated — review pending and processing items in read-only admin workflows.");
  }

  return {
    healthStatus,
    riskLevel,
    attentionRequired,
    recommendations: recommendations.slice(0, 4),
  };
}

/**
 * Fetch investigation notes for a treasury event (admin-only append-only table).
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabase]
 * @param {string} eventId
 * @returns {Promise<{ notes: object[], error: string|null, tableMissing?: boolean }>}
 */
export async function fetchTreasuryEventInvestigationNotes(supabase, eventId) {
  const client = supabase || defaultClient;
  const id = String(eventId || "").trim();
  if (!client || !id) {
    return { notes: [], error: !client ? "no_client" : "missing_event_id" };
  }

  try {
    const { data, error } = await client
      .from("treasury_event_investigation_notes")
      .select("id, event_id, event_source, event_category, note, created_by, created_at")
      .eq("event_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      if (isMissingInvestigationNotesTable(error)) {
        warn({ op: "fetchTreasuryEventInvestigationNotes", tableMissing: true });
        return { notes: [], error: null, tableMissing: true };
      }
      warn({ op: "fetchTreasuryEventInvestigationNotes", err: error.message });
      return { notes: [], error: error.message };
    }

    return {
      notes: (data || []).map(mapInvestigationNoteRow).filter(Boolean),
      error: null,
    };
  } catch (err) {
    warn({ op: "fetchTreasuryEventInvestigationNotes_throw", err: err?.message || String(err) });
    return { notes: [], error: err?.message || "fetch_failed" };
  }
}

/**
 * Append an investigation note for a treasury event. Does not mutate source event tables.
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabase]
 * @param {{ eventId: string, eventSource?: string, eventCategory?: string, note: string, createdBy?: string }} params
 * @returns {Promise<{ ok: boolean, note?: object, error?: string, tableMissing?: boolean }>}
 */
export async function createTreasuryEventInvestigationNote(
  supabase,
  { eventId, eventSource, eventCategory, note, createdBy } = {},
) {
  const client = supabase || defaultClient;
  const id = String(eventId || "").trim();
  const text = String(note || "").trim().slice(0, 4000);

  if (!client) return { ok: false, error: "no_client" };
  if (!id) return { ok: false, error: "missing_event_id" };
  if (!text) return { ok: false, error: "empty_note" };

  try {
    const row = {
      event_id: id,
      event_source: eventSource ? String(eventSource).slice(0, 120) : null,
      event_category: eventCategory ? String(eventCategory).slice(0, 80) : null,
      note: text,
      created_by: createdBy || null,
    };

    const { data, error } = await client
      .from("treasury_event_investigation_notes")
      .insert([row])
      .select("id, event_id, event_source, event_category, note, created_by, created_at")
      .maybeSingle();

    if (error) {
      if (isMissingInvestigationNotesTable(error)) {
        warn({ op: "createTreasuryEventInvestigationNote", tableMissing: true });
        return { ok: false, error: "investigation_notes_table_missing", tableMissing: true };
      }
      warn({ op: "createTreasuryEventInvestigationNote", err: error.message });
      return { ok: false, error: error.message };
    }

    return { ok: true, note: mapInvestigationNoteRow(data) };
  } catch (err) {
    warn({ op: "createTreasuryEventInvestigationNote_throw", err: err?.message || String(err) });
    return { ok: false, error: err?.message || "insert_failed" };
  }
}

/**
 * Fetch resolution record for a treasury event (operational tracking only).
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabase]
 * @param {string} eventId
 * @returns {Promise<{ resolution: object|null, error: string|null, tableMissing?: boolean }>}
 */
export async function fetchTreasuryEventResolution(supabase, eventId) {
  const client = supabase || defaultClient;
  const id = String(eventId || "").trim();
  if (!client || !id) {
    return { resolution: null, error: !client ? "no_client" : "missing_event_id" };
  }

  try {
    const { data, error } = await client
      .from("treasury_event_resolutions")
      .select(
        "id, event_id, event_source, event_category, status, resolution_summary, assigned_to, resolved_by, resolved_at, created_by, created_at, updated_at",
      )
      .eq("event_id", id)
      .maybeSingle();

    if (error) {
      if (isMissingResolutionsTable(error)) {
        warn({ op: "fetchTreasuryEventResolution", tableMissing: true });
        return { resolution: null, error: null, tableMissing: true };
      }
      warn({ op: "fetchTreasuryEventResolution", err: error.message });
      return { resolution: null, error: error.message };
    }

    return { resolution: mapResolutionRow(data), error: null };
  } catch (err) {
    warn({ op: "fetchTreasuryEventResolution_throw", err: err?.message || String(err) });
    return { resolution: null, error: err?.message || "fetch_failed" };
  }
}

/**
 * Fetch resolutions for multiple event ids — returns map keyed by event_id.
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabase]
 * @param {string[]} eventIds
 */
export async function fetchTreasuryEventResolutionsMap(supabase, eventIds) {
  const client = supabase || defaultClient;
  const ids = (eventIds || []).map((id) => String(id || "").trim()).filter(Boolean);
  if (!client || ids.length === 0) {
    return { resolutionsByEventId: {}, error: null };
  }

  try {
    const { data, error } = await client
      .from("treasury_event_resolutions")
      .select(
        "id, event_id, event_source, event_category, status, resolution_summary, assigned_to, resolved_by, resolved_at, created_by, created_at, updated_at",
      )
      .in("event_id", ids.slice(0, 200));

    if (error) {
      if (isMissingResolutionsTable(error)) {
        return { resolutionsByEventId: {}, error: null, tableMissing: true };
      }
      warn({ op: "fetchTreasuryEventResolutionsMap", err: error.message });
      return { resolutionsByEventId: {}, error: error.message };
    }

    const resolutionsByEventId = {};
    for (const row of data || []) {
      const mapped = mapResolutionRow(row);
      if (mapped?.eventId) resolutionsByEventId[mapped.eventId] = mapped;
    }
    return { resolutionsByEventId, error: null };
  } catch (err) {
    warn({ op: "fetchTreasuryEventResolutionsMap_throw", err: err?.message || String(err) });
    return { resolutionsByEventId: {}, error: err?.message || "fetch_failed" };
  }
}

/**
 * Count open and escalated resolution cases for admin chip (fail-open if table missing).
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabase]
 */
export async function fetchTreasuryResolutionChipCounts(supabase) {
  const client = supabase || defaultClient;
  if (!client) {
    return { openCases: 0, escalatedCases: 0, tableMissing: false, error: "no_client" };
  }

  try {
    const [openRes, escalatedRes] = await Promise.all([
      client
        .from("treasury_event_resolutions")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "reviewing"]),
      client
        .from("treasury_event_resolutions")
        .select("id", { count: "exact", head: true })
        .eq("status", "escalated"),
    ]);

    if (openRes.error) {
      if (isMissingResolutionsTable(openRes.error)) {
        return { openCases: 0, escalatedCases: 0, tableMissing: true, error: null };
      }
      warn({ op: "fetchTreasuryResolutionChipCounts", err: openRes.error.message });
      return { openCases: 0, escalatedCases: 0, tableMissing: false, error: openRes.error.message };
    }

    if (escalatedRes.error && !isMissingResolutionsTable(escalatedRes.error)) {
      warn({ op: "fetchTreasuryResolutionChipCounts_escalated", err: escalatedRes.error.message });
    }

    return {
      openCases: openRes.count ?? 0,
      escalatedCases: escalatedRes.error ? 0 : escalatedRes.count ?? 0,
      tableMissing: false,
      error: null,
    };
  } catch (err) {
    warn({ op: "fetchTreasuryResolutionChipCounts_throw", err: err?.message || String(err) });
    return { openCases: 0, escalatedCases: 0, tableMissing: false, error: err?.message || "fetch_failed" };
  }
}

/**
 * Upsert operational resolution for a treasury event. Never mutates source event tables.
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabase]
 * @param {{
 *   eventId: string,
 *   eventSource?: string,
 *   eventCategory?: string,
 *   status?: string,
 *   resolutionSummary?: string,
 *   assignedTo?: string|null,
 *   actorUserId?: string|null,
 * }} params
 */
export async function upsertTreasuryEventResolution(
  supabase,
  { eventId, eventSource, eventCategory, status, resolutionSummary, assignedTo, actorUserId } = {},
) {
  const client = supabase || defaultClient;
  const id = String(eventId || "").trim();
  const nextStatus = normalizeResolutionStatus(status);
  const summary = resolutionSummary != null ? String(resolutionSummary).trim().slice(0, 4000) : null;
  const assigned = assignedTo ? String(assignedTo).trim() : null;

  if (!client) return { ok: false, error: "no_client" };
  if (!id) return { ok: false, error: "missing_event_id" };

  const isTerminal = nextStatus === "resolved" || nextStatus === "dismissed";
  const nowIso = new Date().toISOString();

  try {
    const existing = await fetchTreasuryEventResolution(client, id);
    if (existing.tableMissing) {
      return { ok: false, error: "resolutions_table_missing", tableMissing: true };
    }

    const baseRow = {
      event_id: id,
      event_source: eventSource ? String(eventSource).slice(0, 120) : null,
      event_category: eventCategory ? String(eventCategory).slice(0, 80) : null,
      status: nextStatus,
      resolution_summary: summary || null,
      assigned_to: assigned || null,
    };

    if (existing.resolution) {
      const patch = {
        ...baseRow,
        resolved_by: isTerminal ? actorUserId || existing.resolution.resolvedBy || null : null,
        resolved_at: isTerminal ? nowIso : null,
      };

      const { data, error } = await client
        .from("treasury_event_resolutions")
        .update(patch)
        .eq("event_id", id)
        .select(
          "id, event_id, event_source, event_category, status, resolution_summary, assigned_to, resolved_by, resolved_at, created_by, created_at, updated_at",
        )
        .maybeSingle();

      if (error) {
        if (isMissingResolutionsTable(error)) {
          return { ok: false, error: "resolutions_table_missing", tableMissing: true };
        }
        warn({ op: "upsertTreasuryEventResolution_update", err: error.message });
        return { ok: false, error: error.message };
      }

      return { ok: true, resolution: mapResolutionRow(data) };
    }

    const insertRow = {
      ...baseRow,
      created_by: actorUserId || null,
      resolved_by: isTerminal ? actorUserId || null : null,
      resolved_at: isTerminal ? nowIso : null,
    };

    const { data, error } = await client
      .from("treasury_event_resolutions")
      .insert([insertRow])
      .select(
        "id, event_id, event_source, event_category, status, resolution_summary, assigned_to, resolved_by, resolved_at, created_by, created_at, updated_at",
      )
      .maybeSingle();

    if (error) {
      if (isMissingResolutionsTable(error)) {
        return { ok: false, error: "resolutions_table_missing", tableMissing: true };
      }
      warn({ op: "upsertTreasuryEventResolution_insert", err: error.message });
      return { ok: false, error: error.message };
    }

    return { ok: true, resolution: mapResolutionRow(data) };
  } catch (err) {
    warn({ op: "upsertTreasuryEventResolution_throw", err: err?.message || String(err) });
    return { ok: false, error: err?.message || "upsert_failed" };
  }
}

/**
 * Admin home chip summary — read-only counts from recent events.
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabase]
 */
export async function fetchTreasuryEventChipSummary(supabase) {
  const fallback = {
    label: "Treasury Events: —",
    subtitle: null,
    criticalCount: 0,
    warningCount: 0,
    openCases: null,
    escalatedCases: null,
    href: "/admin/treasury-intelligence#treasury-event-center",
    updatedAt: null,
  };

  try {
    const [{ events }, resolutionCounts] = await Promise.all([
      fetchTreasuryEvents(supabase, { perSourceLimit: 25, limit: 120 }),
      fetchTreasuryResolutionChipCounts(supabase),
    ]);
    const summary = buildTreasuryEventSummary(events);
    const elevated = summary.criticalEvents > 0 || summary.warningEvents > 0;

    const subtitle = elevated
      ? "Latest treasury events require review"
      : "No elevated treasury events";

    return {
      label: `Treasury Events: Critical ${summary.criticalEvents} | Warning ${summary.warningEvents}`,
      subtitle,
      criticalCount: summary.criticalEvents,
      warningCount: summary.warningEvents,
      openCases: resolutionCounts.tableMissing ? null : resolutionCounts.openCases,
      escalatedCases: resolutionCounts.tableMissing ? null : resolutionCounts.escalatedCases,
      href: "/admin/treasury-intelligence#treasury-event-center",
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    warn({ op: "fetchTreasuryEventChipSummary", err: err?.message || String(err) });
    return fallback;
  }
}
