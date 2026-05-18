/**
 * Server-side account security gates for financial actions (service role).
 * Fail-open on missing table / read errors; logs structured warnings via operational_logs.
 */

import { auditSeverityFromRiskLevel, logAdminAuditEvent } from "./adminAudit";
import { createSupabaseServiceClient } from "./supabaseAdminApi";
import { logOperationalEvent } from "./operationalLogger";
import {
  canPerformFinancialAction,
  getAccountSecurityStatus,
  FINANCIAL_BLOCK_BASE_MESSAGE,
  DEFAULT_ACCOUNT_SECURITY_STATUS,
} from "./accountSecurityStatus";

const BLOCKED_EVENT_DESCRIPTION = "Blocked financial action due to account security status";

function severityForRisk(riskLevel) {
  const r = String(riskLevel || "low").toLowerCase();
  if (r === "critical") return "critical";
  if (r === "high") return "high";
  if (r === "medium") return "warning";
  return "info";
}

function warnFailOpen(category, message, userId, metadata = {}) {
  void logOperationalEvent({
    level: "warn",
    category,
    message,
    userId: typeof userId === "string" ? userId : null,
    route: null,
    metadata,
  });
}

/**
 * @param {string} userId
 */
export async function getServerAccountSecurityStatus(userId) {
  const admin = createSupabaseServiceClient();
  if (!admin) {
    warnFailOpen("server_account_security.no_client", "Service client unavailable; allowing action", userId);
    return { ...DEFAULT_ACCOUNT_SECURITY_STATUS, exists: false, tableMissing: true };
  }
  const row = await getAccountSecurityStatus(userId, { supabaseClient: admin });
  if (row.tableMissing) {
    warnFailOpen(
      "server_account_security.table_missing",
      "account_security_status table missing; allowing action",
      userId,
    );
  } else if (row.error) {
    warnFailOpen("server_account_security.read_failed", "account_security_status read failed; allowing action", userId, {
      err: String(row.error).slice(0, 200),
    });
  }
  return row;
}

/**
 * @param {{ userId: string; action: string }} args
 */
export async function canServerPerformFinancialAction({ userId, action }) {
  const allow = {
    allowed: true,
    status: "normal",
    riskLevel: "low",
    reason: null,
    message: "",
  };
  const admin = createSupabaseServiceClient();
  if (!admin) {
    warnFailOpen("server_account_security.no_client", "Service client unavailable; allowing financial action", userId, {
      action: String(action || ""),
    });
    return allow;
  }

  const row = await getAccountSecurityStatus(userId, { supabaseClient: admin });
  if (row.tableMissing) {
    warnFailOpen(
      "server_account_security.table_missing",
      "account_security_status missing; allowing financial action",
      userId,
      { action: String(action || "") },
    );
    return allow;
  }
  if (row.error) {
    warnFailOpen(
      "server_account_security.read_failed",
      "account_security_status read failed; allowing financial action",
      userId,
      { action: String(action || ""), err: String(row.error).slice(0, 200) },
    );
    return allow;
  }

  return canPerformFinancialAction({ userId, action, supabaseClient: admin });
}

/**
 * @param {{
 *   userId: string;
 *   action: string;
 *   status: string;
 *   riskLevel?: string;
 *   reason?: string | null;
 *   source?: string;
 * }} args
 */
export async function logServerBlockedFinancialAction({
  userId,
  action,
  status,
  riskLevel,
  reason,
  source = "server",
}) {
  const uid = typeof userId === "string" ? userId.trim() : "";
  const act = typeof action === "string" ? action.trim() : "";
  if (!uid || !act) return { ok: false };

  const admin = createSupabaseServiceClient();
  if (!admin) {
    warnFailOpen("server_account_security.log_no_client", "Could not log blocked financial action", uid, {
      action: act,
      source,
    });
    return { ok: false };
  }

  try {
    const { error } = await admin.from("security_events").insert([
      {
        user_id: uid,
        type: "security_alert",
        severity: severityForRisk(riskLevel),
        description: BLOCKED_EVENT_DESCRIPTION,
        metadata: {
          action: act,
          status: String(status || "normal").toLowerCase(),
          risk_level: String(riskLevel || "low").toLowerCase(),
          reason: reason != null ? String(reason).slice(0, 500) : null,
          source: String(source || "server").slice(0, 32),
        },
      },
    ]);
    if (error) {
      warnFailOpen("server_account_security.log_failed", "security_events insert failed", uid, {
        action: act,
        code: error.code || null,
        source,
      });
      return { ok: false };
    }

    void logAdminAuditEvent({
      actorUserId: null,
      targetUserId: uid,
      action: "server_financial_action_blocked",
      category: "security",
      severity: auditSeverityFromRiskLevel(riskLevel),
      description: "Server blocked financial action due to account security status",
      metadata: {
        financial_action: act,
        status: String(status || "normal").toLowerCase(),
        risk_level: String(riskLevel || "low").toLowerCase(),
        reason: reason != null ? String(reason).slice(0, 500) : null,
        source: String(source || "server").slice(0, 32),
      },
      supabaseClient: admin,
    });

    return { ok: true };
  } catch (e) {
    warnFailOpen("server_account_security.log_throw", e?.message || "log throw", uid, { action: act, source });
    return { ok: false };
  }
}

/**
 * @param {{ allowed?: boolean; message?: string }} gate
 */
export function accountRestrictedHttpBody(gate) {
  return {
    success: false,
    error: "account_restricted",
    message: gate?.message || FINANCIAL_BLOCK_BASE_MESSAGE,
  };
}
