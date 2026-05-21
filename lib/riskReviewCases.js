/**
 * Risk review case queue — human admin review only; no automatic enforcement.
 */

import { supabase as defaultClient } from "./supabaseClient";
import { sanitizeOperationalMetadata } from "./operationalLogger";
import {
  RISK_CASE_AUDIT_ACTIONS,
  auditSeverityFromCasePriority,
  logAdminAuditEvent,
} from "./adminAudit";

const LOG_NS = "[risk-review-cases]";

const ACTIVE_STATUSES = ["open", "reviewing", "escalated"];

const CASE_SELECT =
  "id, user_id, risk_score, confidence_score, trust_score, risk_level, recommended_action, status, priority, title, summary, reasons, source_snapshot, decay_snapshot, assigned_to, created_by, resolved_by, resolved_at, updated_at, created_at";

const NOTE_SELECT = "id, case_id, author_user_id, note, note_type, metadata, created_at";

const TIMELINE_SELECT =
  "id, case_id, actor_user_id, event_type, title, description, metadata, created_at";

const PRIORITY_SORT_ORDER = { critical: 0, high: 1, normal: 2, low: 3 };

const TIMELINE_EVENT_TYPES = new Set([
  "case_created",
  "case_assigned",
  "case_status_changed",
  "note_added",
  "recommendation_generated",
  "resolution",
  "repeat_risk_detected",
  "score_changed",
]);

function warn(payload) {
  try {
    console.warn(LOG_NS, payload);
  } catch {
    /* ignore */
  }
}

function isMissingTable(error, tableName) {
  if (!error) return false;
  const code = String(error.code || "");
  const msg = String(error.message || "").toLowerCase();
  if (code === "42P01" || code === "PGRST205" || code === "PGRST204") return true;
  return msg.includes(tableName) && (msg.includes("does not exist") || msg.includes("not found"));
}

function isMissingTimelineTable(error) {
  return isMissingTable(error, "risk_review_case_timeline");
}

/**
 * @param {Array<{ priority?: string; updated_at?: string }>} rows
 */
function sortCasesByQueuePriority(rows) {
  return [...(rows || [])].sort((a, b) => {
    const pa = PRIORITY_SORT_ORDER[String(a.priority || "normal").toLowerCase()] ?? 2;
    const pb = PRIORITY_SORT_ORDER[String(b.priority || "normal").toLowerCase()] ?? 2;
    if (pa !== pb) return pa - pb;
    const ta = new Date(a.updated_at || 0).getTime();
    const tb = new Date(b.updated_at || 0).getTime();
    return tb - ta;
  });
}

/**
 * @param {unknown} reasons
 */
function reasonCodesFromCase(reasons) {
  const list = Array.isArray(reasons) ? reasons : [];
  return list.map((r) => String(r?.code || "").toLowerCase()).filter(Boolean);
}

/**
 * @param {unknown} reasons
 * @param {string[]} needles
 */
function hasReasonMatch(reasons, needles) {
  const codes = reasonCodesFromCase(reasons);
  return needles.some((n) =>
    codes.some((c) => c === n || c.includes(n) || n.includes(c)),
  );
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
function caseRowForRecommendation(row) {
  if (!row) return null;
  return {
    risk_level: row.risk_level ?? row.riskLevel,
    recommended_action: row.recommended_action ?? row.recommendedAction,
    risk_score: row.risk_score ?? row.riskScore,
    trust_score: row.trust_score ?? row.trustScore,
    confidence_score: row.confidence_score ?? row.confidenceScore,
    reasons: row.reasons || [],
    source_snapshot: row.source_snapshot ?? row.sourceSnapshot ?? {},
    decay_snapshot: row.decay_snapshot ?? row.decaySnapshot ?? {},
    user_id: row.user_id ?? row.userId,
    id: row.id,
    priority: row.priority,
  };
}

/**
 * Guidance-only recommendation from case snapshot (no enforcement).
 * @param {Record<string, unknown> | null | undefined} caseRow
 * @param {{ repeatRiskSubject?: boolean; priorCaseCount?: number }} [repeatInfo]
 */
export function generateRiskCaseRecommendation(caseRow, repeatInfo = {}) {
  const row = caseRowForRecommendation(caseRow);
  const repeatRiskSubject = Boolean(repeatInfo.repeatRiskSubject);
  const priorCaseCount = Number(repeatInfo.priorCaseCount) || 0;

  const riskLevel = String(row?.risk_level || "low").toLowerCase();
  const recommendedAction = String(row?.recommended_action || "allow").toLowerCase();
  const trustScore = Number(row?.trust_score) || 0;
  const riskScore = Number(row?.risk_score) || 0;
  const reasons = row?.reasons || [];

  const indicators = [];
  if (riskLevel) indicators.push(`Risk level: ${riskLevel}`);
  if (riskScore > 0) indicators.push(`Risk score: ${riskScore}`);
  if (recommendedAction && recommendedAction !== "allow") {
    indicators.push(`Engine action: ${recommendedAction.replace(/_/g, " ")}`);
  }
  if (trustScore !== 0) {
    indicators.push(`Trust score: ${trustScore > 0 ? "+" : ""}${trustScore}`);
  }

  const topCodes = reasonCodesFromCase(reasons).slice(0, 6);
  for (const code of topCodes) {
    const reason = reasons.find((r) => String(r?.code || "").toLowerCase() === code);
    const label = reason?.label || code.replace(/_/g, " ");
    const pts = Number(reason?.points);
    indicators.push(
      pts ? `${label} (${pts >= 0 ? "+" : ""}${pts})` : label,
    );
  }

  const hasSuspiciousLogin = hasReasonMatch(reasons, [
    "suspicious_login",
    "suspicious_login_decayed",
  ]);
  const hasRapidCashOut = hasReasonMatch(reasons, [
    "rapid_cash_out",
    "rapid_cash_out_pattern",
  ]);

  if (hasSuspiciousLogin) indicators.push("Suspicious login signal present");
  if (hasRapidCashOut) indicators.push("Rapid cash-out pattern detected");
  if (repeatRiskSubject) {
    indicators.push(`Repeat risk subject (${priorCaseCount} prior case${priorCaseCount === 1 ? "" : "s"})`);
  }

  let suggestedAction = "review";
  let severity = "info";
  const rationaleParts = [];

  if (riskLevel === "critical" || recommendedAction === "freeze_candidate") {
    suggestedAction = "recommend_freeze";
    severity = "critical";
    rationaleParts.push("Critical risk level or freeze-candidate engine action.");
    rationaleParts.push("Guidance label only — human must decide; no automatic freeze.");
  } else if (
    riskLevel === "high" &&
    hasSuspiciousLogin &&
    hasRapidCashOut
  ) {
    suggestedAction = "recommend_restrict";
    severity = "high";
    rationaleParts.push("High risk with suspicious login and rapid cash-out signals.");
    rationaleParts.push("Consider enhanced monitoring or manual restriction review.");
  } else if (repeatRiskSubject && priorCaseCount >= 2) {
    suggestedAction = "recommend_watch";
    severity = "high";
    rationaleParts.push(`User has ${priorCaseCount} prior review case(s).`);
    rationaleParts.push("Repeat risk subject — prioritize human review.");
  } else if (riskLevel === "high" || recommendedAction === "restrict" || recommendedAction === "review") {
    suggestedAction = "recommend_watch";
    severity = "high";
    rationaleParts.push("Elevated risk signals warrant closer admin watch.");
  } else if (riskLevel === "medium" && trustScore > 20) {
    suggestedAction = "monitor";
    severity = "warning";
    rationaleParts.push("Medium risk offset by positive trust score.");
    rationaleParts.push("Continue periodic monitoring; no escalation suggested.");
  } else if (riskLevel === "medium") {
    suggestedAction = "review";
    severity = "warning";
    rationaleParts.push("Medium risk — standard human review recommended.");
  } else if (riskLevel === "low" && trustScore >= 30) {
    suggestedAction = "recommend_false_positive";
    severity = "info";
    rationaleParts.push("Low risk with strong trust indicators.");
    rationaleParts.push("Candidate for false-positive resolution if investigation confirms.");
  } else if (riskLevel === "low") {
    suggestedAction = "monitor";
    severity = "info";
    rationaleParts.push("Low risk — light monitoring sufficient.");
  } else {
    suggestedAction = "review";
    severity = "info";
    rationaleParts.push("Default review path for unmatched signal profile.");
  }

  return {
    suggestedAction,
    severity,
    rationale: `${rationaleParts.join(" ")} Human review only; recommendations are guidance labels, not enforcement.`,
    indicators,
    repeatRiskSubject,
    priorCaseCount,
  };
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeMetadata(input) {
  return sanitizeOperationalMetadata(input);
}

/**
 * @param {Record<string, unknown>} row
 */
function normalizeRiskScoreRow(row) {
  if (!row || typeof row !== "object") return null;
  const userId = row.user_id ?? row.userId;
  if (!userId) return null;
  return {
    user_id: String(userId),
    risk_score: Number(row.risk_score ?? row.riskScore) || 0,
    confidence_score: Number(row.confidence_score ?? row.confidenceScore) ?? 50,
    trust_score: Number(row.trust_score ?? row.trustScore) || 0,
    risk_level: String((row.risk_level ?? row.riskLevel) || "low").toLowerCase(),
    recommended_action: String((row.recommended_action ?? row.recommendedAction) || "allow").toLowerCase(),
    reasons: Array.isArray(row.reasons) ? row.reasons : [],
    source_snapshot:
      row.source_snapshot && typeof row.source_snapshot === "object"
        ? row.source_snapshot
        : row.sourceSnapshot && typeof row.sourceSnapshot === "object"
          ? row.sourceSnapshot
          : {},
    decay_snapshot:
      row.decay_snapshot && typeof row.decay_snapshot === "object"
        ? row.decay_snapshot
        : row.decaySnapshot && typeof row.decaySnapshot === "object"
          ? row.decaySnapshot
          : {},
  };
}

/**
 * @param {string} riskLevel
 * @param {string} recommendedAction
 */
export function priorityForRiskReviewCase(riskLevel, recommendedAction) {
  const level = String(riskLevel || "").toLowerCase();
  const action = String(recommendedAction || "").toLowerCase();
  if (level === "critical" || action === "freeze_candidate") return "critical";
  if (level === "high" || action === "restrict" || action === "review") return "high";
  if (level === "medium") return "normal";
  return "low";
}

/**
 * @param {string} riskLevel
 */
export function titleForRiskReviewCase(riskLevel) {
  const level = String(riskLevel || "").toLowerCase();
  if (level === "critical") return "Critical risk review";
  if (level === "high") return "High risk review";
  if (level === "medium") return "Medium risk monitoring";
  return "Low risk monitoring";
}

/**
 * @param {Record<string, unknown>} normalized
 */
function buildCaseSummary(normalized) {
  const score = normalized.risk_score;
  const level = normalized.risk_level;
  const action = String(normalized.recommended_action || "").replace(/_/g, " ");
  return `Risk score ${score} (${level}) — recommended: ${action}. Human review only; no automatic enforcement.`;
}

/**
 * @param {{
 *   actorUserId?: string | null;
 *   targetUserId?: string | null;
 *   action: string;
 *   priority?: string;
 *   metadata?: Record<string, unknown>;
 *   description?: string;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} p
 */
async function auditRiskCase(p) {
  const meta = sanitizeMetadata({
    case_id: p.metadata?.case_id ?? null,
    user_id: p.metadata?.user_id ?? p.targetUserId ?? null,
    status: p.metadata?.status ?? null,
    priority: p.metadata?.priority ?? null,
    risk_score: p.metadata?.risk_score ?? null,
    recommended_action: p.metadata?.recommended_action ?? null,
    ...p.metadata,
  });
  try {
    await logAdminAuditEvent({
      actorUserId: p.actorUserId ?? null,
      targetUserId: p.targetUserId ?? null,
      action: p.action,
      category: "security",
      severity: auditSeverityFromCasePriority(p.priority),
      description: p.description || "",
      metadata: meta,
      supabaseClient: p.supabaseClient,
    });
  } catch (e) {
    warn({ op: "auditRiskCase", err: e?.message || String(e) });
  }
}

/**
 * Best-effort timeline insert; never throws.
 * @param {{
 *   caseId: string;
 *   actorUserId?: string | null;
 *   eventType: string;
 *   title: string;
 *   description?: string;
 *   metadata?: Record<string, unknown>;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function addRiskCaseTimelineEntry({
  caseId,
  actorUserId = null,
  eventType,
  title,
  description = "",
  metadata = {},
  supabaseClient,
} = {}) {
  const client = supabaseClient || defaultClient;
  const id = String(caseId || "").trim();
  const type = String(eventType || "").trim().toLowerCase();
  const titleText = String(title || "").trim();

  if (!client || !id || !type || !titleText) {
    return { success: false, error: "invalid_timeline_entry" };
  }
  if (!TIMELINE_EVENT_TYPES.has(type)) {
    return { success: false, error: "invalid_event_type" };
  }

  try {
    const row = {
      case_id: id,
      actor_user_id: actorUserId || null,
      event_type: type,
      title: titleText.slice(0, 500),
      description: String(description || "").trim().slice(0, 4000) || null,
      metadata: sanitizeMetadata(metadata),
    };

    const { data, error } = await client
      .from("risk_review_case_timeline")
      .insert([row])
      .select(TIMELINE_SELECT)
      .single();

    if (error) {
      if (isMissingTimelineTable(error)) {
        return { success: false, error: "table_missing", tableMissing: true };
      }
      warn({ op: "addRiskCaseTimelineEntry", err: error.message });
      return { success: false, error: error.message };
    }

    return { success: true, entry: data };
  } catch (e) {
    warn({ op: "addRiskCaseTimelineEntry_throw", err: e?.message || String(e) });
    return { success: false, error: e?.message || String(e) };
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} caseId
 */
async function timelineHasEvent(client, caseId, eventType) {
  try {
    const { data, error } = await client
      .from("risk_review_case_timeline")
      .select("id")
      .eq("case_id", caseId)
      .eq("event_type", eventType)
      .limit(1);
    if (error) {
      if (isMissingTimelineTable(error)) return false;
      return false;
    }
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

/**
 * @param {{
 *   userId: string;
 *   excludeCaseId?: string | null;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 *   caseId?: string | null;
 *   actorUserId?: string | null;
 *   emitTimeline?: boolean;
 * }} args
 */
export async function detectRepeatRiskSubject({
  userId,
  excludeCaseId = null,
  supabaseClient,
  caseId = null,
  actorUserId = null,
  emitTimeline = false,
} = {}) {
  const client = supabaseClient || defaultClient;
  const uid = String(userId || "").trim();
  const empty = { repeatRiskSubject: false, priorCaseCount: 0, priorCriticalCount: 0 };

  if (!client || !uid) return empty;

  try {
    const { data, error } = await client
      .from("risk_review_cases")
      .select("id, priority, status")
      .eq("user_id", uid);

    if (error) {
      if (isMissingTable(error, "risk_review_cases")) return empty;
      warn({ op: "detectRepeatRiskSubject", err: error.message });
      return empty;
    }

    const rows = (data || []).filter((r) => {
      if (!excludeCaseId) return true;
      return String(r.id) !== String(excludeCaseId);
    });

    const priorCaseCount = rows.length;
    const priorCriticalCount = rows.filter(
      (r) => String(r.priority || "").toLowerCase() === "critical",
    ).length;
    const repeatRiskSubject = priorCaseCount >= 2;

    if (emitTimeline && repeatRiskSubject && caseId) {
      const alreadyLogged = await timelineHasEvent(client, caseId, "repeat_risk_detected");
      if (!alreadyLogged) {
        await addRiskCaseTimelineEntry({
          caseId,
          actorUserId,
          eventType: "repeat_risk_detected",
          title: "Repeat risk subject detected",
          description: `User has ${priorCaseCount} prior review case(s) (${priorCriticalCount} critical).`,
          metadata: { prior_case_count: priorCaseCount, prior_critical_count: priorCriticalCount },
          supabaseClient: client,
        });

        const caseRes = await client
          .from("risk_review_cases")
          .select("priority")
          .eq("id", caseId)
          .maybeSingle();

        await auditRiskCase({
          actorUserId,
          targetUserId: uid,
          action: RISK_CASE_AUDIT_ACTIONS.repeatSubjectDetected,
          priority: caseRes.data?.priority,
          description: "Repeat risk subject detected for review case user.",
          metadata: {
            case_id: caseId,
            user_id: uid,
            prior_case_count: priorCaseCount,
            prior_critical_count: priorCriticalCount,
          },
          supabaseClient: client,
        });
      }
    }

    return { repeatRiskSubject, priorCaseCount, priorCriticalCount };
  } catch (e) {
    warn({ op: "detectRepeatRiskSubject_throw", err: e?.message || String(e) });
    return empty;
  }
}

/**
 * @param {string} caseId
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient]
 */
export async function fetchRiskCaseTimeline(caseId, supabaseClient) {
  const client = supabaseClient || defaultClient;
  const id = String(caseId || "").trim();
  if (!client) return { success: false, error: "no_client", timeline: [] };
  if (!id) return { success: false, error: "missing_case_id", timeline: [] };

  try {
    const { data, error } = await client
      .from("risk_review_case_timeline")
      .select(TIMELINE_SELECT)
      .eq("case_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      if (isMissingTimelineTable(error)) {
        return { success: false, error: "table_missing", tableMissing: true, timeline: [] };
      }
      warn({ op: "fetchRiskCaseTimeline", err: error.message });
      return { success: false, error: error.message, timeline: [] };
    }

    return { success: true, timeline: data || [], error: null };
  } catch (e) {
    warn({ op: "fetchRiskCaseTimeline_throw", err: e?.message || String(e) });
    return { success: false, error: e?.message || String(e), timeline: [] };
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient]
 */
export async function fetchRiskCaseAnalytics(supabaseClient) {
  const client = supabaseClient || defaultClient;
  const empty = {
    success: false,
    total: 0,
    open: 0,
    reviewing: 0,
    escalated: 0,
    resolved: 0,
    falsePositive: 0,
    avgResolutionHours: null,
    repeatRiskSubjects: 0,
    recommendationDistribution: {},
  };

  if (!client) return { ...empty, error: "no_client" };

  try {
    const { data, error } = await client.from("risk_review_cases").select(CASE_SELECT);
    if (error) {
      if (isMissingTable(error, "risk_review_cases")) {
        return { ...empty, error: "table_missing", tableMissing: true };
      }
      return { ...empty, error: error.message };
    }

    const cases = data || [];
    const statusCounts = { open: 0, reviewing: 0, escalated: 0, resolved: 0, false_positive: 0 };
    const resolutionDurations = [];
    const userCaseCounts = new Map();
    const recommendationDistribution = {};

    for (const c of cases) {
      const st = String(c.status || "").toLowerCase();
      if (statusCounts[st] != null) statusCounts[st] += 1;

      const uid = String(c.user_id || "");
      if (uid) userCaseCounts.set(uid, (userCaseCounts.get(uid) || 0) + 1);

      if ((st === "resolved" || st === "false_positive") && c.resolved_at && c.created_at) {
        const ms =
          new Date(c.resolved_at).getTime() - new Date(c.created_at).getTime();
        if (ms > 0) resolutionDurations.push(ms);
      }
    }

    for (const c of cases) {
      const uid = String(c.user_id || "");
      const userTotal = userCaseCounts.get(uid) || 0;
      const repeatInfo = {
        repeatRiskSubject: userTotal >= 2,
        priorCaseCount: Math.max(0, userTotal - 1),
      };
      const rec = generateRiskCaseRecommendation(c, repeatInfo);
      const key = rec.suggestedAction || "review";
      recommendationDistribution[key] = (recommendationDistribution[key] || 0) + 1;
    }

    let repeatRiskSubjects = 0;
    for (const count of userCaseCounts.values()) {
      if (count >= 2) repeatRiskSubjects += 1;
    }

    const avgResolutionHours =
      resolutionDurations.length > 0
        ? Math.round(
            resolutionDurations.reduce((a, b) => a + b, 0) /
              resolutionDurations.length /
              (1000 * 60 * 60) *
              10,
          ) / 10
        : null;

    return {
      success: true,
      total: cases.length,
      open: statusCounts.open,
      reviewing: statusCounts.reviewing,
      escalated: statusCounts.escalated,
      resolved: statusCounts.resolved,
      falsePositive: statusCounts.false_positive,
      avgResolutionHours,
      repeatRiskSubjects,
      recommendationDistribution,
      error: null,
    };
  } catch (e) {
    warn({ op: "fetchRiskCaseAnalytics_throw", err: e?.message || String(e) });
    return { ...empty, error: e?.message || String(e) };
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} userId
 */
async function findActiveCaseForUser(client, userId) {
  const { data, error } = await client
    .from("risk_review_cases")
    .select("id, status, priority, risk_score, recommended_action")
    .eq("user_id", userId)
    .in("status", ACTIVE_STATUSES)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error, "risk_review_cases")) {
      return { caseRow: null, tableMissing: true, error: null };
    }
    return { caseRow: null, tableMissing: false, error: error.message };
  }
  return { caseRow: data, tableMissing: false, error: null };
}

/**
 * @param {{
 *   userId: string;
 *   riskScoreRow: Record<string, unknown>;
 *   adminUserId?: string | null;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function createRiskReviewCaseFromScore({
  userId,
  riskScoreRow,
  adminUserId = null,
  supabaseClient,
} = {}) {
  const client = supabaseClient || defaultClient;
  if (!client) {
    return { success: false, error: "no_client" };
  }

  const uid = String(userId || "").trim();
  if (!uid) {
    return { success: false, error: "missing_user_id" };
  }

  const normalized = normalizeRiskScoreRow(riskScoreRow);
  if (!normalized) {
    return { success: false, error: "invalid_risk_score_row" };
  }

  try {
    const existing = await findActiveCaseForUser(client, uid);
    if (existing.tableMissing) {
      return { success: false, error: "table_missing", tableMissing: true };
    }
    if (existing.error) {
      return { success: false, error: existing.error };
    }

    if (existing.caseRow?.id) {
      const caseId = existing.caseRow.id;
      const noteText =
        "Duplicate review case request: an active review case already exists for this user. Latest risk score snapshot noted.";
      const noteRes = await addRiskReviewCaseNote({
        caseId,
        authorUserId: adminUserId,
        note: noteText,
        noteType: "system_event",
        metadata: {
          risk_score: normalized.risk_score,
          risk_level: normalized.risk_level,
          recommended_action: normalized.recommended_action,
        },
        supabaseClient: client,
        skipAudit: true,
      });
      if (!noteRes.success) {
        return { success: false, error: noteRes.error || "could_not_add_duplicate_note" };
      }

      await auditRiskCase({
        actorUserId: adminUserId,
        targetUserId: uid,
        action: RISK_CASE_AUDIT_ACTIONS.duplicateNoteAdded,
        priority: existing.caseRow.priority,
        description: "System note added to existing active risk review case.",
        metadata: {
          case_id: caseId,
          user_id: uid,
          status: existing.caseRow.status,
          priority: existing.caseRow.priority,
          risk_score: normalized.risk_score,
          recommended_action: normalized.recommended_action,
        },
        supabaseClient: client,
      });

      return {
        success: true,
        duplicate: true,
        caseId,
        message: "An active review case already exists. A system note was added.",
      };
    }

    const priority = priorityForRiskReviewCase(normalized.risk_level, normalized.recommended_action);
    const title = titleForRiskReviewCase(normalized.risk_level);
    const summary = buildCaseSummary(normalized);
    const now = nowIso();

    const row = {
      user_id: uid,
      risk_score: Math.min(100, Math.max(0, normalized.risk_score)),
      confidence_score: Math.min(100, Math.max(0, normalized.confidence_score)),
      trust_score: Math.min(100, Math.max(-100, normalized.trust_score)),
      risk_level: normalized.risk_level,
      recommended_action: normalized.recommended_action,
      status: "open",
      priority,
      title,
      summary,
      reasons: normalized.reasons,
      source_snapshot: normalized.source_snapshot,
      decay_snapshot: normalized.decay_snapshot,
      created_by: adminUserId || null,
      updated_at: now,
    };

    const { data, error } = await client.from("risk_review_cases").insert([row]).select(CASE_SELECT).single();

    if (error) {
      if (isMissingTable(error, "risk_review_cases")) {
        return { success: false, error: "table_missing", tableMissing: true };
      }
      warn({ op: "createRiskReviewCaseFromScore", err: error.message });
      return { success: false, error: error.message };
    }

    const caseId = data?.id;
    if (!caseId) {
      return { success: false, error: "no_case_id_returned" };
    }

    await addRiskReviewCaseNote({
      caseId,
      authorUserId: adminUserId,
      note: "Review case opened from stored risk score snapshot.",
      noteType: "system_event",
      metadata: { source: "createRiskReviewCaseFromScore" },
      supabaseClient: client,
      skipAudit: true,
    });

    await auditRiskCase({
      actorUserId: adminUserId,
      targetUserId: uid,
      action: RISK_CASE_AUDIT_ACTIONS.created,
      priority,
      description: `Risk review case opened: ${title}`,
      metadata: {
        case_id: caseId,
        user_id: uid,
        status: "open",
        priority,
        risk_score: row.risk_score,
        recommended_action: row.recommended_action,
      },
      supabaseClient: client,
    });

    await addRiskCaseTimelineEntry({
      caseId,
      actorUserId: adminUserId,
      eventType: "case_created",
      title: "Case created",
      description: summary,
      metadata: {
        risk_score: row.risk_score,
        risk_level: row.risk_level,
        priority,
      },
      supabaseClient: client,
    });

    const repeatInfo = await detectRepeatRiskSubject({
      userId: uid,
      excludeCaseId: caseId,
      caseId,
      actorUserId: adminUserId,
      emitTimeline: true,
      supabaseClient: client,
    });

    const recommendation = generateRiskCaseRecommendation(data, repeatInfo);
    await addRiskCaseTimelineEntry({
      caseId,
      actorUserId: adminUserId,
      eventType: "recommendation_generated",
      title: "Recommendation generated",
      description: recommendation.rationale,
      metadata: {
        suggested_action: recommendation.suggestedAction,
        severity: recommendation.severity,
        indicators: recommendation.indicators,
      },
      supabaseClient: client,
    });

    await auditRiskCase({
      actorUserId: adminUserId,
      targetUserId: uid,
      action: RISK_CASE_AUDIT_ACTIONS.recommendationGenerated,
      priority,
      description: `Guidance recommendation: ${recommendation.suggestedAction}`,
      metadata: {
        case_id: caseId,
        user_id: uid,
        suggested_action: recommendation.suggestedAction,
        severity: recommendation.severity,
      },
      supabaseClient: client,
    });

    return { success: true, duplicate: false, caseId, case: data, recommendation };
  } catch (e) {
    warn({ op: "createRiskReviewCaseFromScore_throw", err: e?.message || String(e) });
    return { success: false, error: e?.message || String(e) };
  }
}

/**
 * @param {{
 *   status?: string;
 *   priority?: string;
 *   riskLevel?: string;
 *   limit?: number;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} [args]
 */
export async function fetchRiskReviewCases({
  status = "",
  priority = "",
  riskLevel = "",
  limit = 100,
  supabaseClient,
} = {}) {
  const client = supabaseClient || defaultClient;
  if (!client) {
    return { success: false, error: "no_client", cases: [] };
  }

  const cap = Math.min(500, Math.max(1, Number(limit) || 100));

  try {
    let q = client.from("risk_review_cases").select(CASE_SELECT).order("updated_at", { ascending: false }).limit(cap);

    const st = String(status || "").trim().toLowerCase();
    if (st && ["open", "reviewing", "escalated", "resolved", "false_positive"].includes(st)) {
      q = q.eq("status", st);
    }

    const pr = String(priority || "").trim().toLowerCase();
    if (pr && ["low", "normal", "high", "critical"].includes(pr)) {
      q = q.eq("priority", pr);
    }

    const rl = String(riskLevel || "").trim().toLowerCase();
    if (rl && ["low", "medium", "high", "critical"].includes(rl)) {
      q = q.eq("risk_level", rl);
    }

    const { data, error } = await q;
    if (error) {
      if (isMissingTable(error, "risk_review_cases")) {
        return { success: false, error: "table_missing", tableMissing: true, cases: [] };
      }
      warn({ op: "fetchRiskReviewCases", err: error.message });
      return { success: false, error: error.message, cases: [] };
    }

    const sorted = sortCasesByQueuePriority(data || []);
    return { success: true, cases: sorted, error: null };
  } catch (e) {
    warn({ op: "fetchRiskReviewCases_throw", err: e?.message || String(e) });
    return { success: false, error: e?.message || String(e), cases: [] };
  }
}

/**
 * @param {string} caseId
 * @param {import('@supabase/supabase-js').SupabaseClient} [supabaseClient]
 */
export async function fetchRiskReviewCase(caseId, supabaseClient) {
  const client = supabaseClient || defaultClient;
  const id = String(caseId || "").trim();
  if (!client) {
    return { success: false, error: "no_client", case: null, notes: [], timeline: [], recommendation: null };
  }
  if (!id) {
    return { success: false, error: "missing_case_id", case: null, notes: [], timeline: [], recommendation: null };
  }

  try {
    const [caseRes, notesRes, timelineRes] = await Promise.all([
      client.from("risk_review_cases").select(CASE_SELECT).eq("id", id).maybeSingle(),
      client
        .from("risk_review_case_notes")
        .select(NOTE_SELECT)
        .eq("case_id", id)
        .order("created_at", { ascending: true }),
      client
        .from("risk_review_case_timeline")
        .select(TIMELINE_SELECT)
        .eq("case_id", id)
        .order("created_at", { ascending: false }),
    ]);

    if (caseRes.error) {
      if (isMissingTable(caseRes.error, "risk_review_cases")) {
        return {
          success: false,
          error: "table_missing",
          tableMissing: true,
          case: null,
          notes: [],
          timeline: [],
          recommendation: null,
        };
      }
      return { success: false, error: caseRes.error.message, case: null, notes: [], timeline: [], recommendation: null };
    }

    if (!caseRes.data) {
      return { success: false, error: "case_not_found", case: null, notes: [], timeline: [], recommendation: null };
    }

    let notes = [];
    if (notesRes.error) {
      if (!isMissingTable(notesRes.error, "risk_review_case_notes")) {
        warn({ op: "fetchRiskReviewCase_notes", err: notesRes.error.message });
      }
    } else {
      notes = notesRes.data || [];
    }

    let timeline = [];
    if (timelineRes.error) {
      if (!isMissingTimelineTable(timelineRes.error)) {
        warn({ op: "fetchRiskReviewCase_timeline", err: timelineRes.error.message });
      }
    } else {
      timeline = timelineRes.data || [];
    }

    const repeatInfo = await detectRepeatRiskSubject({
      userId: caseRes.data.user_id,
      excludeCaseId: id,
      caseId: id,
      emitTimeline: true,
      supabaseClient: client,
    });

    const recommendation = generateRiskCaseRecommendation(caseRes.data, repeatInfo);

    return {
      success: true,
      case: caseRes.data,
      notes,
      timeline,
      recommendation,
      repeatInfo,
      error: null,
    };
  } catch (e) {
    warn({ op: "fetchRiskReviewCase_throw", err: e?.message || String(e) });
    return { success: false, error: e?.message || String(e), case: null, notes: [], timeline: [], recommendation: null };
  }
}

/**
 * @param {{
 *   caseId: string;
 *   status: string;
 *   adminUserId?: string | null;
 *   note?: string;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function updateRiskReviewCaseStatus({
  caseId,
  status,
  adminUserId = null,
  note = "",
  supabaseClient,
} = {}) {
  const client = supabaseClient || defaultClient;
  const id = String(caseId || "").trim();
  const nextStatus = String(status || "").trim().toLowerCase();

  if (!client) return { success: false, error: "no_client" };
  if (!id) return { success: false, error: "missing_case_id" };

  const validStatuses = ["open", "reviewing", "escalated", "resolved", "false_positive"];
  if (!validStatuses.includes(nextStatus)) {
    return { success: false, error: "invalid_status" };
  }

  try {
    const current = await client
      .from("risk_review_cases")
      .select("id, user_id, status, priority, risk_score, recommended_action")
      .eq("id", id)
      .maybeSingle();

    if (current.error) {
      if (isMissingTable(current.error, "risk_review_cases")) {
        return { success: false, error: "table_missing", tableMissing: true };
      }
      return { success: false, error: current.error.message };
    }
    if (!current.data) {
      return { success: false, error: "case_not_found" };
    }

    const now = nowIso();
    const patch = {
      status: nextStatus,
      updated_at: now,
    };

    const terminal = nextStatus === "resolved" || nextStatus === "false_positive";
    if (terminal) {
      patch.resolved_at = now;
      patch.resolved_by = adminUserId || null;
    }

    const { data, error } = await client
      .from("risk_review_cases")
      .update(patch)
      .eq("id", id)
      .select(CASE_SELECT)
      .single();

    if (error) {
      warn({ op: "updateRiskReviewCaseStatus", err: error.message });
      return { success: false, error: error.message };
    }

    const statusNote =
      String(note || "").trim() ||
      `Status changed from ${current.data.status} to ${nextStatus}.`;
    await addRiskReviewCaseNote({
      caseId: id,
      authorUserId: adminUserId,
      note: statusNote,
      noteType: terminal ? "resolution" : "status_change",
      metadata: { from_status: current.data.status, to_status: nextStatus },
      supabaseClient: client,
      skipAudit: true,
      skipTimeline: true,
    });

    const timelineEventType = terminal ? "resolution" : "case_status_changed";
    const timelineTitle = terminal
      ? `Case resolved (${nextStatus.replace(/_/g, " ")})`
      : `Status changed to ${nextStatus.replace(/_/g, " ")}`;

    await addRiskCaseTimelineEntry({
      caseId: id,
      actorUserId: adminUserId,
      eventType: timelineEventType,
      title: timelineTitle,
      description: statusNote,
      metadata: {
        from_status: current.data.status,
        to_status: nextStatus,
      },
      supabaseClient: client,
    });

    await auditRiskCase({
      actorUserId: adminUserId,
      targetUserId: current.data.user_id,
      action: terminal ? RISK_CASE_AUDIT_ACTIONS.resolution : RISK_CASE_AUDIT_ACTIONS.statusChanged,
      priority: current.data.priority,
      description: terminal
        ? `Risk review case resolved: ${nextStatus}`
        : `Risk review case status: ${nextStatus}`,
      metadata: {
        case_id: id,
        user_id: current.data.user_id,
        status: nextStatus,
        priority: current.data.priority,
        risk_score: current.data.risk_score,
        recommended_action: current.data.recommended_action,
        from_status: current.data.status,
      },
      supabaseClient: client,
    });

    return { success: true, case: data };
  } catch (e) {
    warn({ op: "updateRiskReviewCaseStatus_throw", err: e?.message || String(e) });
    return { success: false, error: e?.message || String(e) };
  }
}

/**
 * @param {{
 *   caseId: string;
 *   assignedTo: string | null;
 *   adminUserId?: string | null;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 * }} args
 */
export async function assignRiskReviewCase({
  caseId,
  assignedTo,
  adminUserId = null,
  supabaseClient,
} = {}) {
  const client = supabaseClient || defaultClient;
  const id = String(caseId || "").trim();
  const assignee = assignedTo != null && String(assignedTo).trim() ? String(assignedTo).trim() : null;

  if (!client) return { success: false, error: "no_client" };
  if (!id) return { success: false, error: "missing_case_id" };

  try {
    const current = await client
      .from("risk_review_cases")
      .select("id, user_id, status, priority, risk_score, recommended_action, assigned_to")
      .eq("id", id)
      .maybeSingle();

    if (current.error) {
      if (isMissingTable(current.error, "risk_review_cases")) {
        return { success: false, error: "table_missing", tableMissing: true };
      }
      return { success: false, error: current.error.message };
    }
    if (!current.data) {
      return { success: false, error: "case_not_found" };
    }

    const { data, error } = await client
      .from("risk_review_cases")
      .update({ assigned_to: assignee, updated_at: nowIso() })
      .eq("id", id)
      .select(CASE_SELECT)
      .single();

    if (error) {
      warn({ op: "assignRiskReviewCase", err: error.message });
      return { success: false, error: error.message };
    }

    await addRiskReviewCaseNote({
      caseId: id,
      authorUserId: adminUserId,
      note: assignee
        ? `Case assigned to ${assignee}.`
        : "Case assignment cleared.",
      noteType: "status_change",
      metadata: {
        from_assigned_to: current.data.assigned_to,
        to_assigned_to: assignee,
      },
      supabaseClient: client,
      skipAudit: true,
      skipTimeline: true,
    });

    await addRiskCaseTimelineEntry({
      caseId: id,
      actorUserId: adminUserId,
      eventType: "case_assigned",
      title: "Case assigned",
      description: assignee
        ? `Assigned to ${assignee}.`
        : "Assignment cleared.",
      metadata: {
        from_assigned_to: current.data.assigned_to,
        assigned_to: assignee,
      },
      supabaseClient: client,
    });

    await auditRiskCase({
      actorUserId: adminUserId,
      targetUserId: current.data.user_id,
      action: RISK_CASE_AUDIT_ACTIONS.assignment,
      priority: current.data.priority,
      description: assignee ? "Risk review case assigned." : "Risk review case unassigned.",
      metadata: {
        case_id: id,
        user_id: current.data.user_id,
        status: current.data.status,
        priority: current.data.priority,
        risk_score: current.data.risk_score,
        recommended_action: current.data.recommended_action,
        assigned_to: assignee,
      },
      supabaseClient: client,
    });

    return { success: true, case: data };
  } catch (e) {
    warn({ op: "assignRiskReviewCase_throw", err: e?.message || String(e) });
    return { success: false, error: e?.message || String(e) };
  }
}

/**
 * @param {{
 *   caseId: string;
 *   authorUserId?: string | null;
 *   note: string;
 *   noteType?: string;
 *   metadata?: Record<string, unknown>;
 *   supabaseClient?: import('@supabase/supabase-js').SupabaseClient;
 *   skipAudit?: boolean;
 *   skipTimeline?: boolean;
 * }} args
 */
export async function addRiskReviewCaseNote({
  caseId,
  authorUserId = null,
  note,
  noteType = "admin_note",
  metadata = {},
  supabaseClient,
  skipAudit = false,
  skipTimeline = false,
} = {}) {
  const client = supabaseClient || defaultClient;
  const id = String(caseId || "").trim();
  const text = String(note || "").trim();

  if (!client) return { success: false, error: "no_client" };
  if (!id) return { success: false, error: "missing_case_id" };
  if (!text) return { success: false, error: "missing_note" };

  const type = String(noteType || "admin_note").toLowerCase();
  const validTypes = ["admin_note", "status_change", "system_event", "resolution"];
  const resolvedType = validTypes.includes(type) ? type : "admin_note";

  try {
    let caseMeta = null;
    if (!skipAudit) {
      const caseRes = await client
        .from("risk_review_cases")
        .select("user_id, status, priority, risk_score, recommended_action")
        .eq("id", id)
        .maybeSingle();
      if (caseRes.error && isMissingTable(caseRes.error, "risk_review_cases")) {
        return { success: false, error: "table_missing", tableMissing: true };
      }
      caseMeta = caseRes.data;
    }

    const row = {
      case_id: id,
      author_user_id: authorUserId || null,
      note: text.slice(0, 8000),
      note_type: resolvedType,
      metadata: sanitizeMetadata(metadata),
    };

    const { data, error } = await client.from("risk_review_case_notes").insert([row]).select(NOTE_SELECT).single();

    if (error) {
      if (isMissingTable(error, "risk_review_case_notes")) {
        return { success: false, error: "table_missing", tableMissing: true };
      }
      warn({ op: "addRiskReviewCaseNote", err: error.message });
      return { success: false, error: error.message };
    }

    if (!skipAudit && caseMeta) {
      await auditRiskCase({
        actorUserId: authorUserId,
        targetUserId: caseMeta.user_id,
        action: RISK_CASE_AUDIT_ACTIONS.noteAdded,
        priority: caseMeta.priority,
        description: "Note added to risk review case.",
        metadata: {
          case_id: id,
          user_id: caseMeta.user_id,
          status: caseMeta.status,
          priority: caseMeta.priority,
          risk_score: caseMeta.risk_score,
          recommended_action: caseMeta.recommended_action,
          note_type: resolvedType,
        },
        supabaseClient: client,
      });
    }

    if (!skipTimeline) {
      await addRiskCaseTimelineEntry({
        caseId: id,
        actorUserId: authorUserId,
        eventType: "note_added",
        title: "Note added",
        description: text.slice(0, 500),
        metadata: { note_type: resolvedType, note_id: data?.id },
        supabaseClient: client,
      });
    }

    return { success: true, note: data };
  } catch (e) {
    warn({ op: "addRiskReviewCaseNote_throw", err: e?.message || String(e) });
    return { success: false, error: e?.message || String(e) };
  }
}

/** Map DB case row to camelCase for UI. */
export function mapRiskReviewCaseRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    riskScore: row.risk_score,
    confidenceScore: row.confidence_score ?? 50,
    trustScore: row.trust_score ?? 0,
    riskLevel: row.risk_level,
    recommendedAction: row.recommended_action,
    status: row.status,
    priority: row.priority,
    title: row.title,
    summary: row.summary,
    reasons: row.reasons || [],
    sourceSnapshot: row.source_snapshot || {},
    decaySnapshot: row.decay_snapshot || {},
    assignedTo: row.assigned_to,
    createdBy: row.created_by,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

export function mapRiskReviewCaseNoteRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    caseId: row.case_id,
    authorUserId: row.author_user_id,
    note: row.note,
    noteType: row.note_type,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

export function mapRiskCaseTimelineRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    caseId: row.case_id,
    actorUserId: row.actor_user_id,
    eventType: row.event_type,
    title: row.title,
    description: row.description,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}
