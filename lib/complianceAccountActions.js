/**
 * Compliance account control actions — audited admin enforcement (TLP-005).
 * Wraps account_security_status without modifying financial RPCs.
 */

import { supabase as defaultClient } from "./supabaseClient";
import { adminSetAccountSecurityStatus } from "./accountSecurityStatus";
import { logAdminAuditEvent } from "./adminAudit";
import { sanitizeOperationalMetadata } from "./operationalLogger";

export const ACCOUNT_ACTIONS_TABLE = "compliance_account_actions";

export const COMPLIANCE_ACCOUNT_ACTIONS = Object.freeze([
  "restrict",
  "freeze",
  "unfreeze",
  "suspend_transactions",
  "restore_access",
  "watch",
]);

/** Maps compliance action → account_security_status value */
const ACTION_TO_STATUS = Object.freeze({
  restrict: "restricted",
  freeze: "frozen",
  suspend_transactions: "restricted",
  unfreeze: "normal",
  restore_access: "normal",
  watch: "watch",
});

/**
 * @param {{
 *   userId: string;
 *   actionType: string;
 *   reason: string;
 *   adminUserId: string;
 *   riskLevel?: string;
 *   notes?: string | null;
 *   amlCaseId?: string | null;
 *   metadata?: Record<string, unknown>;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function performComplianceAccountAction({
  userId,
  actionType,
  reason,
  adminUserId,
  riskLevel = "high",
  notes = null,
  amlCaseId = null,
  metadata = {},
  supabaseClient,
} = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  const adminId = typeof adminUserId === "string" ? adminUserId.trim() : "";
  const action = String(actionType || "").toLowerCase();
  const reasonText = typeof reason === "string" ? reason.trim() : "";

  if (!uid || !adminId || !reasonText || !COMPLIANCE_ACCOUNT_ACTIONS.includes(action)) {
    return { ok: false, error: "invalid_input" };
  }

  const client = supabaseClient || defaultClient;
  const nextStatus = ACTION_TO_STATUS[action];
  if (!nextStatus) return { ok: false, error: "unknown_action" };

  const prev = await client
    .from("account_security_status")
    .select("status")
    .eq("user_id", uid)
    .maybeSingle();

  const statusResult = await adminSetAccountSecurityStatus({
    userId: uid,
    status: nextStatus,
    riskLevel: action === "restore_access" || action === "unfreeze" ? "low" : riskLevel,
    reason: reasonText,
    notes,
    adminUserId: adminId,
    supabaseClient: client,
  });

  if (!statusResult.ok) {
    return { ok: false, error: statusResult.error || "status_update_failed", tableMissing: statusResult.tableMissing };
  }

  const auditRow = {
    user_id: uid,
    admin_user_id: adminId,
    action_type: action,
    previous_status: prev.data?.status ?? "normal",
    new_status: nextStatus,
    reason: reasonText.slice(0, 500),
    aml_case_id: amlCaseId?.trim() || null,
    metadata: sanitizeOperationalMetadata(metadata),
  };

  const { data: actionRow, error: auditError } = await client
    .from(ACCOUNT_ACTIONS_TABLE)
    .insert(auditRow)
    .select("id, created_at")
    .maybeSingle();

  if (auditError) {
    console.warn("[compliance-account-actions] audit insert failed", auditError.message);
  }

  void logAdminAuditEvent({
    actorUserId: adminId,
    action: `compliance_account_${action}`,
    category: "security",
    severity: ["freeze", "restrict", "suspend_transactions"].includes(action) ? "high" : "info",
    targetUserId: uid,
    metadata: {
      action_type: action,
      reason: reasonText,
      aml_case_id: amlCaseId,
      compliance_action_id: actionRow?.id ?? null,
    },
    supabaseClient: client,
  });

  return { ok: true, newStatus: nextStatus, actionId: actionRow?.id ?? null };
}

/**
 * @param {{ userId?: string; limit?: number; supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} [opts]
 */
export async function fetchComplianceAccountActions(opts = {}) {
  const client = opts.supabaseClient || defaultClient;
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  let q = client
    .from(ACCOUNT_ACTIONS_TABLE)
    .select("id, user_id, admin_user_id, action_type, previous_status, new_status, reason, aml_case_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (opts.userId?.trim()) q = q.eq("user_id", opts.userId.trim());
  const { data, error } = await q;
  if (error) return { rows: [], error: error.message };
  return { rows: data || [] };
}
