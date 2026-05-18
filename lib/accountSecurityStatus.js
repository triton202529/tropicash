/**
 * Account security status (freeze / restrict foundation).
 * Fail-open for reads; admin writes log events + optional in-app notification.
 */

import { supabase as defaultClient } from "./supabaseClient";
import { auditSeverityFromRiskLevel, logAdminAuditEvent } from "./adminAudit";
import { logSecurityEvent } from "./security";
import { notifySecurityAccountActivity } from "./securityNotifications";

const LOG_NS = "[account-security-status]";

export const ACCOUNT_STATUSES = Object.freeze(["normal", "watch", "restricted", "frozen"]);
export const RISK_LEVELS = Object.freeze(["low", "medium", "high", "critical"]);

const STATUS_SET = new Set(ACCOUNT_STATUSES);
const RISK_SET = new Set(RISK_LEVELS);
const RESTRICTIVE_STATUSES = new Set(["restricted", "frozen"]);

export const FINANCIAL_ACTIONS = Object.freeze([
  "fund_wallet",
  "send_money",
  "withdraw_wallet",
  "add_payout_method",
  "triton_transfer",
]);

const FINANCIAL_ACTION_SET = new Set(FINANCIAL_ACTIONS);

/** @type {Record<string, Set<string>>} */
const RESTRICTED_BLOCKED = {
  restricted: new Set(["send_money", "withdraw_wallet", "add_payout_method", "triton_transfer"]),
  frozen: new Set(FINANCIAL_ACTIONS),
};

export const FINANCIAL_BLOCK_BASE_MESSAGE =
  "Your Tropicash account has a security restriction. This action is temporarily unavailable while we review your account.";

const BLOCKED_EVENT_DESCRIPTION = "Blocked financial action due to account security status";

export const DEFAULT_ACCOUNT_SECURITY_STATUS = Object.freeze({
  status: "normal",
  risk_level: "low",
  reason: null,
  notes: null,
  frozen_at: null,
  frozen_by: null,
  unfrozen_at: null,
  unfrozen_by: null,
});

const SELECT_COLUMNS =
  "user_id, status, risk_level, reason, notes, frozen_at, frozen_by, unfrozen_at, unfrozen_by, updated_at, created_at";

function logWarn(payload) {
  try {
    console.warn(LOG_NS, payload);
  } catch {
    /* ignore */
  }
}

function isMissingTableError(error) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204") return true;
  if (msg.includes("account_security_status") && (msg.includes("does not exist") || msg.includes("not found"))) {
    return true;
  }
  return false;
}

function normalizeStatus(raw) {
  const v = String(raw || "normal").toLowerCase();
  return STATUS_SET.has(v) ? v : "normal";
}

function normalizeRisk(raw) {
  const v = String(raw || "low").toLowerCase();
  return RISK_SET.has(v) ? v : "low";
}

function severityForRisk(riskLevel) {
  const r = normalizeRisk(riskLevel);
  if (r === "critical") return "critical";
  if (r === "high") return "high";
  if (r === "medium") return "warning";
  return "info";
}

function normalizeRow(row) {
  if (!row || typeof row !== "object") {
    return { ...DEFAULT_ACCOUNT_SECURITY_STATUS, exists: false };
  }
  return {
    user_id: row.user_id,
    status: normalizeStatus(row.status),
    risk_level: normalizeRisk(row.risk_level),
    reason: row.reason != null ? String(row.reason) : null,
    notes: row.notes != null ? String(row.notes) : null,
    frozen_at: row.frozen_at ?? null,
    frozen_by: row.frozen_by ?? null,
    unfrozen_at: row.unfrozen_at ?? null,
    unfrozen_by: row.unfrozen_by ?? null,
    updated_at: row.updated_at ?? null,
    created_at: row.created_at ?? null,
    exists: true,
  };
}

/**
 * @param {string | { status?: string } | null | undefined} statusRow
 */
export function isAccountFrozenOrRestricted(statusRow) {
  const status =
    statusRow && typeof statusRow === "object"
      ? statusRow.status
      : statusRow;
  const s = normalizeStatus(status);
  return RESTRICTIVE_STATUSES.has(s);
}

/**
 * @param {string} userId
 * @param {{ supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} [opts]
 */
export async function getAccountSecurityStatus(userId, { supabaseClient } = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) {
    return { ...DEFAULT_ACCOUNT_SECURITY_STATUS, exists: false, tableMissing: false };
  }
  const client = supabaseClient || defaultClient;
  try {
    const { data, error } = await client
      .from("account_security_status")
      .select(SELECT_COLUMNS)
      .eq("user_id", uid)
      .maybeSingle();
    if (error) {
      if (isMissingTableError(error)) {
        return { ...DEFAULT_ACCOUNT_SECURITY_STATUS, exists: false, tableMissing: true };
      }
      logWarn({ op: "getAccountSecurityStatus", err: error.message, userId: uid });
      return { ...DEFAULT_ACCOUNT_SECURITY_STATUS, exists: false, tableMissing: false, error: error.message };
    }
    if (!data) {
      return { ...DEFAULT_ACCOUNT_SECURITY_STATUS, exists: false, tableMissing: false };
    }
    return { ...normalizeRow(data), tableMissing: false };
  } catch (e) {
    logWarn({ op: "getAccountSecurityStatus_throw", err: e?.message || String(e), userId: uid });
    return { ...DEFAULT_ACCOUNT_SECURITY_STATUS, exists: false, tableMissing: false };
  }
}

/**
 * @param {string} userId
 * @param {{ supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} [opts]
 */
export async function ensureAccountSecurityStatus(userId, { supabaseClient } = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  if (!uid) return { ok: false, error: "missing_user" };
  const client = supabaseClient || defaultClient;
  try {
    const { data, error } = await client.from("account_security_status").select("user_id").eq("user_id", uid).maybeSingle();
    if (error) {
      if (isMissingTableError(error)) return { ok: false, tableMissing: true, error: error.message };
      return { ok: false, error: error.message };
    }
    if (data?.user_id) return { ok: true, created: false };
    const row = {
      user_id: uid,
      status: "normal",
      risk_level: "low",
      updated_at: new Date().toISOString(),
    };
    const { error: insertError } = await client.from("account_security_status").insert([row]);
    if (insertError) {
      if (isMissingTableError(insertError)) return { ok: false, tableMissing: true, error: insertError.message };
      return { ok: false, error: insertError.message };
    }
    return { ok: true, created: true };
  } catch (e) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Admin upsert account status + audit event + user notification (best-effort).
 *
 * @param {{
 *   userId: string;
 *   status: string;
 *   riskLevel?: string;
 *   reason?: string | null;
 *   notes?: string | null;
 *   adminUserId: string;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function adminSetAccountSecurityStatus({
  userId,
  status,
  riskLevel = "low",
  reason = null,
  notes = null,
  adminUserId,
  supabaseClient,
} = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  const adminId = typeof adminUserId === "string" ? adminUserId.trim() : "";
  const nextStatus = normalizeStatus(status);
  const nextRisk = normalizeRisk(riskLevel);
  if (!uid || !adminId) return { ok: false, error: "missing_user_or_admin" };

  const client = supabaseClient || defaultClient;
  const now = new Date().toISOString();

  let prevStatus = "normal";
  try {
    const prev = await getAccountSecurityStatus(uid, { supabaseClient: client });
    if (prev?.exists) prevStatus = normalizeStatus(prev.status);
  } catch {
    /* ignore */
  }

  /** @type {Record<string, unknown>} */
  const patch = {
    user_id: uid,
    status: nextStatus,
    risk_level: nextRisk,
    reason: reason != null && String(reason).trim() ? String(reason).trim().slice(0, 500) : null,
    notes: notes != null && String(notes).trim() ? String(notes).trim().slice(0, 2000) : null,
    updated_at: now,
  };

  const wasRestrictive = RESTRICTIVE_STATUSES.has(prevStatus);
  const isRestrictive = RESTRICTIVE_STATUSES.has(nextStatus);

  if (nextStatus === "frozen") {
    patch.frozen_at = now;
    patch.frozen_by = adminId;
    patch.unfrozen_at = null;
    patch.unfrozen_by = null;
  } else if (wasRestrictive && !isRestrictive) {
    patch.unfrozen_at = now;
    patch.unfrozen_by = adminId;
  }

  try {
    const { error } = await client.from("account_security_status").upsert(patch, { onConflict: "user_id" });
    if (error) {
      if (isMissingTableError(error)) return { ok: false, tableMissing: true, error: error.message };
      logWarn({ op: "adminSetAccountSecurityStatus", err: error.message, userId: uid });
      return { ok: false, error: error.message };
    }
  } catch (e) {
    logWarn({ op: "adminSetAccountSecurityStatus_throw", err: e?.message || String(e), userId: uid });
    return { ok: false, error: e?.message || String(e) };
  }

  const meta = { status: nextStatus, risk_level: nextRisk, reason: patch.reason, previous_status: prevStatus };

  void logSecurityEvent({
    userId: uid,
    type: "security_alert",
    severity: severityForRisk(nextRisk),
    description: "Account security status changed",
    metadata: meta,
  });

  const statusLabel = nextStatus.charAt(0).toUpperCase() + nextStatus.slice(1);
  void notifySecurityAccountActivity({
    userId: uid,
    title: "Account security update",
    message: `Your Tropicash account status is now "${statusLabel}". Review your Security Center or contact support if you have questions.`,
    metadata: { status: nextStatus, risk_level: nextRisk, hint: "account_security_status" },
  });

  void logAdminAuditEvent({
    actorUserId: adminId,
    targetUserId: uid,
    action: "account_security_status_changed",
    category: "security",
    severity: auditSeverityFromRiskLevel(nextRisk),
    description: "Admin changed account security status",
    metadata: {
      status: nextStatus,
      risk_level: nextRisk,
      reason: patch.reason,
      previous_status: prevStatus,
    },
    supabaseClient: client,
  });

  return { ok: true, status: nextStatus, risk_level: nextRisk };
}

/**
 * User-facing copy for blocked financial actions (calm, non-accusatory).
 *
 * @param {{ message?: string; reason?: string | null }} gate
 */
export function formatFinancialBlockUserMessage(gate) {
  const reason = gate?.reason != null ? String(gate.reason).trim() : "";
  const lines = [
    gate?.message || FINANCIAL_BLOCK_BASE_MESSAGE,
    "Some actions may be limited while we review your account.",
  ];
  if (reason) lines.push(`Note: ${reason}`);
  return lines.join(" ");
}

/**
 * @param {{ userId: string; action: string; supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} args
 * @returns {Promise<{ allowed: boolean; status: string; riskLevel: string; reason: string | null; message: string }>}
 */
export async function canPerformFinancialAction({ userId, action, supabaseClient } = {}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  const act = typeof action === "string" ? action.trim() : "";
  const allow = {
    allowed: true,
    status: "normal",
    riskLevel: "low",
    reason: null,
    message: "",
  };
  if (!uid || !FINANCIAL_ACTION_SET.has(act)) {
    return allow;
  }

  const row = await getAccountSecurityStatus(uid, { supabaseClient });
  const status = normalizeStatus(row.status);
  const riskLevel = normalizeRisk(row.risk_level);
  const reason = row.reason != null ? String(row.reason) : null;

  if (status === "normal" || status === "watch") {
    return { ...allow, status, riskLevel, reason };
  }

  const blockedSet = RESTRICTED_BLOCKED[status];
  if (!blockedSet || !blockedSet.has(act)) {
    return { ...allow, status, riskLevel, reason };
  }

  return {
    allowed: false,
    status,
    riskLevel,
    reason,
    message: FINANCIAL_BLOCK_BASE_MESSAGE,
  };
}

/**
 * Check gate; if blocked, logs security_event (best-effort).
 *
 * @param {{ userId: string; action: string; supabaseClient?: import('@supabase/supabase-js').SupabaseClient }} args
 */
export async function assertFinancialActionAllowed(args) {
  const gate = await canPerformFinancialAction(args);
  if (!gate.allowed) {
    void logBlockedFinancialAction({
      userId: args.userId,
      action: args.action,
      status: gate.status,
      riskLevel: gate.riskLevel,
      reason: gate.reason,
    });
  }
  return gate;
}

/**
 * @param {{
 *   userId: string;
 *   action: string;
 *   status: string;
 *   riskLevel?: string;
 *   reason?: string | null;
 * }} args
 */
export async function logBlockedFinancialAction({ userId, action, status, riskLevel, reason }) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  const act = typeof action === "string" ? action.trim() : "";
  if (!uid || !act) return { ok: false };
  try {
    return await logSecurityEvent({
      userId: uid,
      type: "security_alert",
      severity: severityForRisk(riskLevel),
      description: BLOCKED_EVENT_DESCRIPTION,
      metadata: {
        action: act,
        status: normalizeStatus(status),
        risk_level: normalizeRisk(riskLevel),
        reason: reason != null ? String(reason).slice(0, 500) : null,
      },
    });
  } catch (e) {
    logWarn({ op: "logBlockedFinancialAction_throw", err: e?.message || String(e), userId: uid, action: act });
    return { ok: false };
  }
}
