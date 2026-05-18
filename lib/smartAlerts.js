import { createFraudEvent } from "./fraudEvents";
import { recordEventOnce } from "./eventBus";

const DEFAULT_DEDUPE_HOURS = 24;

const SEVERITIES = new Set(["low", "medium", "high"]);
const STATUSES = new Set(["open", "acknowledged", "resolved"]);

function normalizeSeverity(raw) {
  const s = String(raw || "medium").toLowerCase();
  return SEVERITIES.has(s) ? s : "medium";
}

function safeMetadata(meta) {
  if (meta && typeof meta === "object" && !Array.isArray(meta)) return meta;
  return {};
}

function hoursAgoIso(hours) {
  const h = Number(hours);
  const n = Number.isFinite(h) && h > 0 ? h : DEFAULT_DEDUPE_HOURS;
  return new Date(Date.now() - n * 60 * 60 * 1000).toISOString();
}

/**
 * @param {*} supabase
 * @param {{
 *   userId?: string | null,
 *   alertType: string,
 *   hours?: number,
 * }} p
 * @returns {Promise<{ skip: boolean, error?: unknown }>}
 */
export async function dedupeRecentAlert(supabase, p) {
  if (!supabase) {
    console.error("dedupeRecentAlert: missing supabase");
    return { skip: false };
  }
  const alertType = String(p?.alertType || "").trim();
  if (!alertType) return { skip: false };

  const userId = p.userId ?? null;
  if (!userId) return { skip: false };

  try {
    const since = hoursAgoIso(p.hours);
    const { data, error } = await supabase
      .from("smart_alerts")
      .select("id")
      .eq("user_id", userId)
      .eq("alert_type", alertType)
      .eq("status", "open")
      .gte("created_at", since)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("dedupeRecentAlert:", error);
      return { skip: false, error };
    }
    return { skip: Boolean(data?.id) };
  } catch (e) {
    console.error("dedupeRecentAlert:", e);
    return { skip: false, error: e };
  }
}

/**
 * @param {*} supabase
 * @param {{
 *   userId?: string | null,
 *   fraudLogId?: string | null,
 *   alertType: string,
 *   severity?: string,
 *   title: string,
 *   message: string,
 *   metadata?: Record<string, unknown>,
 *   actorUserId?: string | null,
 * }} payload
 * @returns {Promise<{ ok: boolean, skipped?: boolean, id?: string, error?: unknown }>}
 */
export async function createSmartAlert(supabase, payload) {
  if (!supabase) {
    console.error("createSmartAlert: missing supabase");
    return { ok: false, error: new Error("missing supabase") };
  }

  const alertType = String(payload?.alertType || "").trim();
  const title = String(payload?.title || "").trim();
  const message = String(payload?.message || "").trim();

  if (!alertType || !title || !message) {
    console.error("createSmartAlert: missing alertType, title, or message");
    return { ok: false, error: new Error("missing required fields") };
  }

  try {
    const { skip } = await dedupeRecentAlert(supabase, {
      userId: payload.userId ?? null,
      alertType,
      hours: DEFAULT_DEDUPE_HOURS,
    });
    if (skip) return { ok: true, skipped: true };

    const row = {
      user_id: payload.userId ?? null,
      fraud_log_id: payload.fraudLogId ?? null,
      alert_type: alertType,
      severity: normalizeSeverity(payload.severity),
      status: "open",
      title,
      message,
      metadata: safeMetadata(payload.metadata),
    };

    const { data, error } = await supabase.from("smart_alerts").insert([row]).select("id").maybeSingle();

    if (error) {
      console.error("createSmartAlert:", error);
      return { ok: false, error };
    }

    const id = data?.id ? String(data.id) : undefined;

    void createFraudEvent(supabase, {
      fraudLogId: payload.fraudLogId ?? null,
      userId: payload.userId ?? null,
      actorUserId: payload.actorUserId ?? null,
      eventType: "smart_alert_created",
      eventData: {
        alert_type: alertType,
        severity: row.severity,
        title,
        smart_alert_id: id ?? null,
      },
    });

    if (row.severity === "high") {
      const txnType =
        payload.metadata && typeof payload.metadata === "object"
          ? String(payload.metadata.transaction_type || "unknown")
          : "unknown";
      void recordEventOnce({
        supabaseClient: supabase,
        adminTarget: true,
        eventType: "fraud.escalation",
        category: "fraud",
        severity: "critical",
        title: "Fraud signal escalated",
        message: `New high-severity smart alert: ${alertType}.`,
        actorUserId: payload.actorUserId ?? null,
        metadata: {
          alertType,
          smartAlertId: id ?? null,
          severity: row.severity,
          targetUserId: payload.userId ?? null,
        },
        dedupeKey: `fraud.escalation:${payload.userId || "anon"}:${alertType}:${txnType}`,
        windowMs: 10 * 60 * 1000,
      });
    }

    return { ok: true, id };
  } catch (e) {
    console.error("createSmartAlert:", e);
    return { ok: false, error: e };
  }
}

const REPEAT_HIGH_RISK_WINDOW_HOURS = 24;

/**
 * Phase-1 automatic alerts from a new fraud log + profile snapshot.
 * Best-effort: never throws; uses createSmartAlert (24h open dedupe per type).
 * @param {*} supabase
 * @param {{
 *   userId: string,
 *   fraudLog: Record<string, unknown>,
 *   riskProfile?: Record<string, unknown> | null,
 *   accountStatus?: string | null,
 * }} p
 */
export async function evaluateAndCreateAlerts(supabase, p) {
  if (!supabase) {
    console.error("evaluateAndCreateAlerts: missing supabase");
    return;
  }
  const userId = p?.userId != null ? String(p.userId).trim() : "";
  if (!userId) return;

  const fraudLog = p?.fraudLog && typeof p.fraudLog === "object" ? p.fraudLog : {};
  const fraudLogId = fraudLog.id != null ? String(fraudLog.id) : null;
  const riskProfile = p?.riskProfile && typeof p.riskProfile === "object" ? p.riskProfile : null;
  const accountStatus = String(p?.accountStatus ?? "").toLowerCase();

  const logRiskLevel = String(fraudLog.risk_level ?? "").toLowerCase();
  const logRiskScore = Number(fraudLog.risk_score);
  const txnType = String(fraudLog.transaction_type ?? "").toLowerCase();

  try {
    if (logRiskLevel === "high") {
      await createSmartAlert(supabase, {
        userId,
        fraudLogId,
        alertType: "high_risk_transaction",
        severity: "high",
        title: "High-risk transaction detected",
        message: "A transaction was scored as high risk on internal fraud review.",
        metadata: {
          fraud_log_id: fraudLogId,
          risk_level: logRiskLevel,
          risk_score: Number.isFinite(logRiskScore) ? logRiskScore : null,
          transaction_type: txnType || null,
        },
        actorUserId: null,
      });
    }

    if (Number.isFinite(logRiskScore) && logRiskScore >= 60) {
      await createSmartAlert(supabase, {
        userId,
        fraudLogId,
        alertType: "high_score",
        severity: "medium",
        title: "Elevated fraud risk score",
        message: `Fraud risk score reached ${logRiskScore} (threshold 60).`,
        metadata: {
          fraud_log_id: fraudLogId,
          risk_score: logRiskScore,
          transaction_type: txnType || null,
        },
        actorUserId: null,
      });
    }

    const sinceRepeat = new Date(Date.now() - REPEAT_HIGH_RISK_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    const { count: highCount, error: cntErr } = await supabase
      .from("fraud_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("risk_level", "high")
      .gte("created_at", sinceRepeat);

    if (cntErr) {
      console.error("evaluateAndCreateAlerts high_count:", cntErr);
    } else if ((highCount ?? 0) >= 2) {
      await createSmartAlert(supabase, {
        userId,
        fraudLogId,
        alertType: "repeat_high_risk",
        severity: "high",
        title: "Repeated high-risk activity",
        message: `At least two high-severity fraud logs in the last ${REPEAT_HIGH_RISK_WINDOW_HOURS} hours.`,
        metadata: {
          fraud_log_id: fraudLogId,
          high_risk_log_count: highCount ?? 0,
          window_hours: REPEAT_HIGH_RISK_WINDOW_HOURS,
        },
        actorUserId: null,
      });
    }

    if (accountStatus === "restricted") {
      await createSmartAlert(supabase, {
        userId,
        fraudLogId,
        alertType: "account_restricted",
        severity: "high",
        title: "Account restricted",
        message: "This user's account status is restricted.",
        metadata: {
          fraud_log_id: fraudLogId,
          account_status: accountStatus,
        },
        actorUserId: null,
      });
    }

    const profileRisk = String(riskProfile?.risk_level ?? "").toLowerCase();
    if (profileRisk === "high") {
      await createSmartAlert(supabase, {
        userId,
        fraudLogId,
        alertType: "high_risk_user",
        severity: "high",
        title: "High-risk user",
        message: "Stored profile risk level is high.",
        metadata: {
          fraud_log_id: fraudLogId,
          profile_risk_level: profileRisk,
        },
        actorUserId: null,
      });
    }
  } catch (e) {
    console.error("evaluateAndCreateAlerts:", e);
  }
}

/**
 * @param {*} supabase
 * @param {{
 *   userId: string,
 *   actorUserId?: string | null,
 *   fraudLogId?: string | null,
 *   previousRiskLevel?: string | null,
 *   nextRiskLevel: string,
 *   stats: {
 *     high_count?: number,
 *     escalated_count?: number,
 *   },
 * }} p
 */
export async function maybeCreateRiskAlerts(supabase, p) {
  if (!supabase || !p?.userId) return;

  const userId = String(p.userId);
  const actorUserId = p.actorUserId ?? null;
  const fraudLogId = p.fraudLogId ?? null;
  const prevRisk = String(p.previousRiskLevel || "").toLowerCase();
  const nextRisk = String(p.nextRiskLevel || "").toLowerCase();
  const st = p.stats && typeof p.stats === "object" ? p.stats : {};
  const highCount = Number(st.high_count) || 0;
  const escalatedCount = Number(st.escalated_count) || 0;

  try {
    if (prevRisk !== "high" && nextRisk === "high") {
      await createSmartAlert(supabase, {
        userId,
        fraudLogId,
        alertType: "high_risk_user_detected",
        severity: "high",
        title: "High risk user detected",
        message: "Account risk level moved to high based on fraud log aggregates.",
        metadata: { previous_risk_level: prevRisk || null, high_count: highCount, escalated_count: escalatedCount },
        actorUserId,
      });
    }

    if (highCount >= 2) {
      const sev = highCount >= 3 ? "high" : "medium";
      await createSmartAlert(supabase, {
        userId,
        fraudLogId,
        alertType: "repeated_high_risk_events",
        severity: sev,
        title: "Repeated high-risk fraud events",
        message: `This user has ${highCount} fraud log(s) scored as high risk.`,
        metadata: { high_count: highCount },
        actorUserId,
      });
    }

    if (escalatedCount >= 2) {
      await createSmartAlert(supabase, {
        userId,
        fraudLogId,
        alertType: "repeated_escalations",
        severity: "high",
        title: "Repeated escalations",
        message: `This user has ${escalatedCount} escalated fraud case(s).`,
        metadata: { escalated_count: escalatedCount },
        actorUserId,
      });
    }
  } catch (e) {
    console.error("maybeCreateRiskAlerts:", e);
  }
}

/**
 * @param {*} supabase
 * @param {{
 *   userId: string,
 *   actorUserId?: string | null,
 *   fraudLogId?: string | null,
 *   previousAccountStatus: string,
 *   nextAccountStatus: string,
 * }} p
 */
export async function maybeCreateAccountControlAlerts(supabase, p) {
  if (!supabase || !p?.userId) return;

  const userId = String(p.userId);
  const prev = String(p.previousAccountStatus || "").toLowerCase();
  const next = String(p.nextAccountStatus || "").toLowerCase();
  const actorUserId = p.actorUserId ?? null;
  const fraudLogId = p.fraudLogId ?? null;

  if (prev === "restricted" || next !== "restricted") return;

  try {
    await createSmartAlert(supabase, {
      userId,
      fraudLogId,
      alertType: "account_restricted",
      severity: "high",
      title: "Account restricted",
      message: "Account status was set to restricted (internal review signal; not a hard block).",
      metadata: { previous_account_status: prev, next_account_status: next },
      actorUserId,
    });
  } catch (e) {
    console.error("maybeCreateAccountControlAlerts:", e);
  }
}

/**
 * @param {*} supabase
 * @param {{
 *   alertId: string,
 *   status: string,
 *   actorUserId?: string | null,
 *   userId?: string | null,
 *   fraudLogId?: string | null,
 * }} p
 * @returns {Promise<{ ok: boolean, error?: unknown }>}
 */
export async function updateSmartAlertStatus(supabase, p) {
  if (!supabase) {
    console.error("updateSmartAlertStatus: missing supabase");
    return { ok: false, error: new Error("missing supabase") };
  }
  const alertId = String(p?.alertId || "").trim();
  const status = String(p?.status || "").toLowerCase();
  if (!alertId || !STATUSES.has(status)) {
    console.error("updateSmartAlertStatus: invalid alertId or status");
    return { ok: false, error: new Error("invalid alertId or status") };
  }

  try {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabase
      .from("smart_alerts")
      .update({ status, updated_at: nowIso })
      .eq("id", alertId)
      .select("id, user_id, fraud_log_id, alert_type, severity, title")
      .maybeSingle();

    if (error) {
      console.error("updateSmartAlertStatus:", error);
      return { ok: false, error };
    }

    const row = data && typeof data === "object" ? data : null;
    void createFraudEvent(supabase, {
      fraudLogId: p.fraudLogId ?? row?.fraud_log_id ?? null,
      userId: p.userId ?? row?.user_id ?? null,
      actorUserId: p.actorUserId ?? null,
      eventType: "smart_alert_status_updated",
      eventData: {
        smart_alert_id: alertId,
        status,
        alert_type: row?.alert_type ?? null,
        severity: row?.severity ?? null,
        title: row?.title ?? null,
      },
    });

    return { ok: true };
  } catch (e) {
    console.error("updateSmartAlertStatus:", e);
    return { ok: false, error: e };
  }
}
