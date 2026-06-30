/**
 * AML case management — suspicious activity review queue (TLP-005).
 */

import { supabase as defaultClient } from "./supabaseClient";
import { logAdminAuditEvent } from "./adminAudit";
import { sanitizeOperationalMetadata } from "./operationalLogger";

export const AML_CASES_TABLE = "compliance_aml_cases";
export const AML_CASE_NOTES_TABLE = "compliance_aml_case_notes";

export const AML_CASE_TYPES = Object.freeze([
  "suspicious_activity",
  "transaction_monitoring",
  "sanctions_escalation",
  "pep_escalation",
  "investigation",
]);

export const AML_CASE_STATUSES = Object.freeze([
  "open",
  "under_review",
  "escalated",
  "sar_draft",
  "sar_filed",
  "closed",
  "dismissed",
]);

export const AML_PRIORITIES = Object.freeze(["low", "normal", "high", "critical"]);

export const ACCOUNT_ACTION_RECOMMENDATIONS = Object.freeze([
  "none",
  "watch",
  "restrict",
  "freeze",
  "suspend_transactions",
]);

const CASE_SELECT =
  "id, user_id, case_type, status, priority, title, summary, suspicion_summary, related_transaction_ids, recommended_account_action, sar_filing_reference, assigned_to, created_by, resolved_by, resolved_at, escalated_at, metadata, created_at, updated_at";

function isMissingTable(error, name = AML_CASES_TABLE) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  return code === "42P01" || code === "PGRST205" || msg.includes(name);
}

/**
 * @param {{
 *   userId?: string | null;
 *   caseType?: string;
 *   title: string;
 *   summary?: string;
 *   suspicionSummary?: string;
 *   priority?: string;
 *   relatedTransactionIds?: string[];
 *   recommendedAccountAction?: string | null;
 *   createdBy: string;
 *   metadata?: Record<string, unknown>;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function createAmlCase({
  userId = null,
  caseType = "investigation",
  title,
  summary = null,
  suspicionSummary = null,
  priority = "normal",
  relatedTransactionIds = [],
  recommendedAccountAction = null,
  createdBy,
  metadata = {},
  supabaseClient,
} = {}) {
  const adminId = typeof createdBy === "string" ? createdBy.trim() : "";
  const caseTitle = typeof title === "string" ? title.trim() : "";
  if (!adminId || !caseTitle) return { ok: false, error: "missing_required_fields" };

  const client = supabaseClient || defaultClient;
  const row = {
    user_id: userId?.trim() || null,
    case_type: AML_CASE_TYPES.includes(caseType) ? caseType : "investigation",
    status: "open",
    priority: AML_PRIORITIES.includes(priority) ? priority : "normal",
    title: caseTitle.slice(0, 500),
    summary: summary?.trim()?.slice(0, 4000) || null,
    suspicion_summary: suspicionSummary?.trim()?.slice(0, 4000) || null,
    related_transaction_ids: Array.isArray(relatedTransactionIds) ? relatedTransactionIds : [],
    recommended_account_action:
      recommendedAccountAction && ACCOUNT_ACTION_RECOMMENDATIONS.includes(recommendedAccountAction)
        ? recommendedAccountAction
        : null,
    created_by: adminId,
    metadata: sanitizeOperationalMetadata(metadata),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from(AML_CASES_TABLE).insert(row).select(CASE_SELECT).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { ok: false, tableMissing: true, error: error.message };
    return { ok: false, error: error.message };
  }

  void logAdminAuditEvent({
    actorUserId: adminId,
    action: "aml_case_created",
    category: "security",
    severity: row.priority === "critical" ? "critical" : "warning",
    targetUserId: row.user_id,
    metadata: { case_id: data?.id, case_type: row.case_type, title: row.title },
    supabaseClient: client,
  });

  return { ok: true, case: data };
}

/**
 * @param {{ supabaseClient?: import('@supabase/supabase-js').SupabaseClient; status?: string; limit?: number }} [opts]
 */
export async function fetchAmlCases(opts = {}) {
  const client = opts.supabaseClient || defaultClient;
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  let q = client.from(AML_CASES_TABLE).select(CASE_SELECT).order("updated_at", { ascending: false }).limit(limit);
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
 *   caseId: string;
 *   status: string;
 *   adminUserId: string;
 *   sarFilingReference?: string | null;
 *   assignedTo?: string | null;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function updateAmlCaseStatus({
  caseId,
  status,
  adminUserId,
  sarFilingReference = null,
  assignedTo,
  supabaseClient,
} = {}) {
  const id = typeof caseId === "string" ? caseId.trim() : "";
  const adminId = typeof adminUserId === "string" ? adminUserId.trim() : "";
  const nextStatus = String(status || "").toLowerCase();
  if (!id || !adminId || !AML_CASE_STATUSES.includes(nextStatus)) {
    return { ok: false, error: "invalid_input" };
  }

  const client = supabaseClient || defaultClient;
  const now = new Date().toISOString();
  /** @type {Record<string, unknown>} */
  const patch = { status: nextStatus, updated_at: now };
  if (nextStatus === "escalated") patch.escalated_at = now;
  if (assignedTo !== undefined) patch.assigned_to = assignedTo?.trim() || null;
  if (sarFilingReference?.trim()) patch.sar_filing_reference = sarFilingReference.trim().slice(0, 200);
  if (["closed", "dismissed", "sar_filed"].includes(nextStatus)) {
    patch.resolved_at = now;
    patch.resolved_by = adminId;
  }

  const { data, error } = await client.from(AML_CASES_TABLE).update(patch).eq("id", id).select(CASE_SELECT).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { ok: false, tableMissing: true, error: error.message };
    return { ok: false, error: error.message };
  }

  void logAdminAuditEvent({
    actorUserId: adminId,
    action: "aml_case_status_changed",
    category: "security",
    severity: "warning",
    targetUserId: data?.user_id ?? null,
    metadata: { case_id: id, status: nextStatus },
    supabaseClient: client,
  });

  return { ok: true, case: data };
}

/**
 * @param {{ caseId: string; note: string; authorUserId: string; noteType?: string; supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} args
 */
export async function addAmlCaseNote({ caseId, note, authorUserId, noteType = "admin_note", supabaseClient } = {}) {
  const cid = typeof caseId === "string" ? caseId.trim() : "";
  const text = typeof note === "string" ? note.trim() : "";
  const author = typeof authorUserId === "string" ? authorUserId.trim() : "";
  if (!cid || !text || !author) return { ok: false, error: "invalid_input" };

  const client = supabaseClient || defaultClient;
  const { data, error } = await client
    .from(AML_CASE_NOTES_TABLE)
    .insert({ case_id: cid, author_user_id: author, note: text.slice(0, 8000), note_type: noteType })
    .select("id, case_id, note, note_type, created_at")
    .maybeSingle();

  if (error) {
    if (isMissingTable(error, AML_CASE_NOTES_TABLE)) return { ok: false, tableMissing: true };
    return { ok: false, error: error.message };
  }
  return { ok: true, note: data };
}

/**
 * Risk scoring hook — create monitoring case from fraud/risk signals (no auto-enforcement).
 * @param {{ userId: string; signals: Record<string, unknown>; createdBy: string; supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} args
 */
export async function createTransactionMonitoringCaseFromSignals({ userId, signals, createdBy, supabaseClient } = {}) {
  const score = Number(signals?.risk_score ?? signals?.riskScore ?? 0);
  const priority = score >= 80 ? "critical" : score >= 60 ? "high" : "normal";
  return createAmlCase({
    userId,
    caseType: "transaction_monitoring",
    title: `Transaction monitoring review — risk score ${score}`,
    summary: "Auto-queued from risk scoring hook (admin review required).",
    priority,
    recommendedAccountAction: score >= 80 ? "restrict" : score >= 60 ? "watch" : "none",
    createdBy,
    metadata: sanitizeOperationalMetadata(signals),
    supabaseClient,
  });
}
