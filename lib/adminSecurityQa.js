/**
 * Admin-only Security QA scenarios — inserts test security/audit rows only.
 * Never moves money, changes balances, or calls payment APIs.
 */

import { logAdminAuditEvent } from "./adminAudit";
import { sanitizeOperationalMetadata } from "./operationalLogger";
import { supabase as defaultClient } from "./supabaseClient";
import {
  notifySecurityAccountActivity,
  notifySessionRevoked,
  notifySuspiciousLogin,
} from "./securityNotifications";

const LOG_NS = "[admin-security-qa]";

export const SECURITY_QA_SCENARIOS = Object.freeze([
  { value: "suspicious_login_event", label: "Suspicious login event" },
  { value: "session_revoked_event", label: "Session revoked event" },
  { value: "account_security_alert", label: "Account security alert" },
  { value: "blocked_financial_action_log", label: "Blocked financial action log" },
  { value: "audit_log_test", label: "Admin audit log test" },
]);

const SCENARIO_SET = new Set(SECURITY_QA_SCENARIOS.map((s) => s.value));

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function warn(payload) {
  try {
    console.warn(LOG_NS, payload);
  } catch {
    /* ignore */
  }
}

function qaMeta(scenario) {
  return sanitizeOperationalMetadata({ source: "admin_security_qa", scenario });
}

function isUuid(value) {
  return UUID_RE.test(String(value || "").trim());
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} targetUserId
 */
async function validateTargetUser(client, targetUserId) {
  const { data, error } = await client.from("profiles").select("id").eq("id", targetUserId).maybeSingle();
  if (error) {
    warn({ op: "validateTargetUser", err: error.message, targetUserId });
    return { ok: false, error: error.message || "Could not verify target user." };
  }
  if (!data?.id) {
    return { ok: false, error: "Target user not found. Check the user ID in profiles." };
  }
  return { ok: true };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {{
 *   userId: string;
 *   type: string;
 *   severity: string;
 *   description: string;
 *   metadata: Record<string, unknown>;
 * }} row
 */
async function insertSecurityEventRow(client, row) {
  const { error } = await client.from("security_events").insert([
    {
      user_id: row.userId,
      type: row.type,
      severity: row.severity,
      description: row.description,
      metadata: sanitizeOperationalMetadata(row.metadata),
    },
  ]);
  if (error) {
    warn({ op: "insertSecurityEventRow", err: error.message, type: row.type });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * @param {{
 *   adminUserId: string;
 *   targetUserId: string;
 *   scenario: string;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 * @returns {Promise<{ success: boolean; message?: string; error?: string; notificationsEmitted?: boolean }>}
 */
export async function runSecurityQaScenario({
  adminUserId,
  targetUserId,
  scenario,
  supabaseClient,
} = {}) {
  const adminId = typeof adminUserId === "string" ? adminUserId.trim() : "";
  const targetId = typeof targetUserId === "string" ? targetUserId.trim() : "";
  const scen = typeof scenario === "string" ? scenario.trim() : "";

  if (!adminId) {
    return { success: false, error: "Admin user is required." };
  }
  if (!targetId) {
    return { success: false, error: "Target user ID is required." };
  }
  if (!isUuid(targetId)) {
    return { success: false, error: "Target user ID must be a valid UUID." };
  }
  if (!SCENARIO_SET.has(scen)) {
    return { success: false, error: "Unknown QA scenario." };
  }

  const client = supabaseClient || defaultClient;
  if (!client) {
    return { success: false, error: "Database client unavailable." };
  }

  const targetCheck = await validateTargetUser(client, targetId);
  if (!targetCheck.ok) {
    return { success: false, error: targetCheck.error || "Invalid target user." };
  }

  try {
    if (scen === "audit_log_test") {
      const audit = await logAdminAuditEvent({
        actorUserId: adminId,
        targetUserId: targetId,
        action: "qa_audit_log_test",
        category: "security",
        severity: "info",
        description: "QA test: simulated admin audit log",
        metadata: qaMeta(scen),
        supabaseClient: client,
      });
      if (!audit.ok) {
        const err = audit.tableMissing
          ? "Admin audit logs table is not available. Run supabase/sql/admin_audit_logs.sql."
          : audit.error || "Could not insert admin audit log.";
        return { success: false, error: err };
      }
      return {
        success: true,
        message: "QA admin audit log inserted. Check Admin Audit Trail at /admin/audit.",
        notificationsEmitted: false,
      };
    }

    if (scen === "suspicious_login_event") {
      const ins = await insertSecurityEventRow(client, {
        userId: targetId,
        type: "suspicious_login",
        severity: "warning",
        description: "QA test: simulated suspicious login",
        metadata: qaMeta(scen),
      });
      if (!ins.ok) return { success: false, error: ins.error || "Insert failed." };
      void notifySuspiciousLogin({
        userId: targetId,
        severity: "warning",
        metadata: { source: "admin_security_qa", scenario: scen },
      });
      return {
        success: true,
        message: "QA suspicious login security event created. In-app notification sent if enabled for the user.",
        notificationsEmitted: true,
      };
    }

    if (scen === "session_revoked_event") {
      const ins = await insertSecurityEventRow(client, {
        userId: targetId,
        type: "session_revoked",
        severity: "warning",
        description: "QA test: simulated session revocation",
        metadata: qaMeta(scen),
      });
      if (!ins.ok) return { success: false, error: ins.error || "Insert failed." };
      void notifySessionRevoked({
        userId: targetId,
        metadata: { source: "admin_security_qa", scenario: scen },
      });
      return {
        success: true,
        message: "QA session revoked security event created. In-app notification sent if enabled for the user.",
        notificationsEmitted: true,
      };
    }

    if (scen === "account_security_alert") {
      const ins = await insertSecurityEventRow(client, {
        userId: targetId,
        type: "security_alert",
        severity: "high",
        description: "QA test: simulated account security alert",
        metadata: qaMeta(scen),
      });
      if (!ins.ok) return { success: false, error: ins.error || "Insert failed." };
      void notifySecurityAccountActivity({
        userId: targetId,
        title: "Account security update (QA test)",
        message:
          "This is a QA test alert from Tropicash admin tools. No account changes were made. Review Security Center if unexpected.",
        metadata: { source: "admin_security_qa", scenario: scen, hint: "qa_test" },
      });
      return {
        success: true,
        message: "QA account security alert created. In-app notification sent if enabled for the user.",
        notificationsEmitted: true,
      };
    }

    if (scen === "blocked_financial_action_log") {
      const ins = await insertSecurityEventRow(client, {
        userId: targetId,
        type: "security_alert",
        severity: "high",
        description: "Blocked financial action due to account security status",
        metadata: sanitizeOperationalMetadata({
          source: "admin_security_qa",
          scenario: scen,
          action: "send_money",
          status: "frozen",
          risk_level: "high",
          reason: "QA simulated block",
        }),
      });
      if (!ins.ok) return { success: false, error: ins.error || "Insert failed." };
      return {
        success: true,
        message: "QA blocked financial action security event created (log only — no restriction applied).",
        notificationsEmitted: false,
      };
    }

    return { success: false, error: "Unknown QA scenario." };
  } catch (e) {
    warn({ op: "runSecurityQaScenario_throw", err: e?.message || String(e), scenario: scen });
    return { success: false, error: e?.message || String(e) };
  }
}
