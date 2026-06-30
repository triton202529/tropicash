/**
 * Compliance operational incidents (TLP-005).
 */

import { supabase as defaultClient } from "./supabaseClient";
import { logAdminAuditEvent } from "./adminAudit";
import { sanitizeOperationalMetadata } from "./operationalLogger";

export const INCIDENTS_TABLE = "compliance_incidents";
export const INCIDENT_NOTES_TABLE = "compliance_incident_notes";

export const INCIDENT_SEVERITIES = Object.freeze(["low", "medium", "high", "critical"]);
export const INCIDENT_STATUSES = Object.freeze(["open", "investigating", "mitigated", "resolved", "closed"]);

const SELECT_COLS =
  "id, incident_type, classification, severity, status, title, description, affected_user_id, assigned_to, created_by, resolved_by, resolved_at, resolution_summary, post_incident_review, metadata, created_at, updated_at";

function isMissingTable(error) {
  if (!error) return false;
  const code = String(error.code || "");
  return code === "42P01" || code === "PGRST205";
}

/**
 * @param {{
 *   incidentType: string;
 *   title: string;
 *   description?: string;
 *   severity?: string;
 *   classification?: string;
 *   affectedUserId?: string | null;
 *   createdBy: string;
 *   metadata?: Record<string, unknown>;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function createComplianceIncident({
  incidentType,
  title,
  description = null,
  severity = "medium",
  classification = null,
  affectedUserId = null,
  createdBy,
  metadata = {},
  supabaseClient,
} = {}) {
  const adminId = typeof createdBy === "string" ? createdBy.trim() : "";
  const incidentTitle = typeof title === "string" ? title.trim() : "";
  if (!adminId || !incidentTitle || !incidentType?.trim()) {
    return { ok: false, error: "invalid_input" };
  }

  const client = supabaseClient || defaultClient;
  const row = {
    incident_type: incidentType.trim().slice(0, 100),
    classification: classification?.trim()?.slice(0, 100) || null,
    severity: INCIDENT_SEVERITIES.includes(severity) ? severity : "medium",
    status: "open",
    title: incidentTitle.slice(0, 500),
    description: description?.trim()?.slice(0, 8000) || null,
    affected_user_id: affectedUserId?.trim() || null,
    created_by: adminId,
    metadata: sanitizeOperationalMetadata(metadata),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from(INCIDENTS_TABLE).insert(row).select(SELECT_COLS).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { ok: false, tableMissing: true, error: error.message };
    return { ok: false, error: error.message };
  }

  void logAdminAuditEvent({
    actorUserId: adminId,
    action: "compliance_incident_created",
    category: "security",
    severity: row.severity === "critical" ? "critical" : "warning",
    targetUserId: row.affected_user_id,
    metadata: { incident_id: data?.id, incident_type: row.incident_type },
    supabaseClient: client,
  });

  return { ok: true, incident: data };
}

/**
 * @param {{ supabaseClient?: import('@supabase/supabase-js').SupabaseClient; status?: string; limit?: number }} [opts]
 */
export async function fetchComplianceIncidents(opts = {}) {
  const client = opts.supabaseClient || defaultClient;
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  let q = client.from(INCIDENTS_TABLE).select(SELECT_COLS).order("created_at", { ascending: false }).limit(limit);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) return { rows: [], tableMissing: true };
    return { rows: [], error: error.message };
  }
  return { rows: data || [] };
}

/**
 * @param {{
 *   incidentId: string;
 *   status: string;
 *   adminUserId: string;
 *   resolutionSummary?: string | null;
 *   postIncidentReview?: string | null;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function updateComplianceIncident({
  incidentId,
  status,
  adminUserId,
  resolutionSummary = null,
  postIncidentReview = null,
  supabaseClient,
} = {}) {
  const id = typeof incidentId === "string" ? incidentId.trim() : "";
  const adminId = typeof adminUserId === "string" ? adminUserId.trim() : "";
  const nextStatus = String(status || "").toLowerCase();
  if (!id || !adminId || !INCIDENT_STATUSES.includes(nextStatus)) {
    return { ok: false, error: "invalid_input" };
  }

  const client = supabaseClient || defaultClient;
  const now = new Date().toISOString();
  /** @type {Record<string, unknown>} */
  const patch = { status: nextStatus, updated_at: now };
  if (resolutionSummary?.trim()) patch.resolution_summary = resolutionSummary.trim().slice(0, 4000);
  if (postIncidentReview?.trim()) patch.post_incident_review = postIncidentReview.trim().slice(0, 8000);
  if (["resolved", "closed"].includes(nextStatus)) {
    patch.resolved_at = now;
    patch.resolved_by = adminId;
  }

  const { data, error } = await client.from(INCIDENTS_TABLE).update(patch).eq("id", id).select(SELECT_COLS).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { ok: false, tableMissing: true };
    return { ok: false, error: error.message };
  }

  void logAdminAuditEvent({
    actorUserId: adminId,
    action: "compliance_incident_updated",
    category: "security",
    severity: "info",
    metadata: { incident_id: id, status: nextStatus },
    supabaseClient: client,
  });

  return { ok: true, incident: data };
}

/**
 * @param {{ incidentId: string; note: string; authorUserId: string; noteType?: string; supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} args
 */
export async function addComplianceIncidentNote({ incidentId, note, authorUserId, noteType = "investigation", supabaseClient } = {}) {
  const iid = typeof incidentId === "string" ? incidentId.trim() : "";
  const text = typeof note === "string" ? note.trim() : "";
  const author = typeof authorUserId === "string" ? authorUserId.trim() : "";
  if (!iid || !text || !author) return { ok: false, error: "invalid_input" };

  const client = supabaseClient || defaultClient;
  const { data, error } = await client
    .from(INCIDENT_NOTES_TABLE)
    .insert({ incident_id: iid, author_user_id: author, note: text.slice(0, 8000), note_type: noteType })
    .select("id, incident_id, note, created_at")
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) return { ok: false, tableMissing: true };
    return { ok: false, error: error.message };
  }
  return { ok: true, note: data };
}
