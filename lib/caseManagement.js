import { createFraudEvent } from "./fraudEvents";

function nowIso() {
  return new Date().toISOString();
}

export function formatShortUserId(uid) {
  const s = String(uid || "");
  if (s.length <= 8) return s || "unknown";
  return `${s.slice(0, 8)}…`;
}

/**
 * @param {Record<string, unknown>} log
 */
export function buildDefaultCaseTitleForFraudLog(log) {
  const uid = log?.user_id != null ? String(log.user_id) : "";
  const typ = String(log?.transaction_type || "activity").replace(/_/g, " ");
  return `Fraud review for ${formatShortUserId(uid)} — ${typ}`;
}

/**
 * Priority from fraud log + optional subject profile (deterministic, explainable).
 * @param {Record<string, unknown>} log
 * @param {Record<string, unknown> | null | undefined} [profile]
 */
export function suggestPriorityForFraudLog(log, profile) {
  const acct = String(profile?.account_status || "").toLowerCase();
  const userRisk = String(profile?.risk_level || "").toLowerCase();
  const logLevel = String(log?.risk_level || "").toLowerCase();
  const logStatus = String(log?.status || "").toLowerCase();
  const highSeverityLog = logLevel === "high";

  if (acct === "restricted" && highSeverityLog) return "critical";
  if (userRisk === "high" || logStatus === "escalated" || highSeverityLog) return "high";
  if (logLevel === "medium") return "medium";
  if (logLevel === "low") return "low";
  return "medium";
}

/**
 * @param {*} supabase
 * @param {string} type
 * @param {{ userId?: string | null, fraudLogId?: string | null, caseId?: string | null, actorUserId?: string | null, eventData?: Record<string, unknown> }} p
 */
async function logCaseAudit(supabase, type, p) {
  try {
    await createFraudEvent(supabase, {
      eventType: type,
      userId: p.userId ?? null,
      fraudLogId: p.fraudLogId ?? null,
      actorUserId: p.actorUserId ?? null,
      eventData: {
        case_id: p.caseId ?? null,
        ...(p.eventData && typeof p.eventData === "object" ? p.eventData : {}),
      },
    });
  } catch (e) {
    console.error("logCaseAudit:", e);
  }
}

/**
 * @param {*} supabase
 * @param {{
 *   userId: string,
 *   primaryFraudLogId?: string | null,
 *   title: string,
 *   summary?: string | null,
 *   priority?: string,
 *   status?: string,
 *   openedBy?: string | null,
 *   assignedTo?: string | null,
 * }} p
 * @returns {Promise<{ ok: boolean, caseId?: string, error?: unknown }>}
 */
export async function createFraudCase(supabase, p) {
  if (!supabase) {
    console.error("createFraudCase: missing supabase");
    return { ok: false, error: new Error("missing supabase") };
  }
  const userId = String(p?.userId || "").trim();
  if (!userId) {
    console.error("createFraudCase: missing userId");
    return { ok: false, error: new Error("missing userId") };
  }
  const title = String(p?.title || "").trim();
  if (!title) {
    console.error("createFraudCase: missing title");
    return { ok: false, error: new Error("missing title") };
  }

  const status = String(p?.status || "open").toLowerCase();
  const priority = String(p?.priority || "medium").toLowerCase();
  const row = {
    user_id: userId,
    primary_fraud_log_id: p.primaryFraudLogId != null ? p.primaryFraudLogId : null,
    title,
    summary: p.summary != null && String(p.summary).trim() !== "" ? String(p.summary).trim() : null,
    status: ["open", "in_review", "escalated", "resolved"].includes(status) ? status : "open",
    priority: ["low", "medium", "high", "critical"].includes(priority) ? priority : "medium",
    opened_by: p.openedBy ?? null,
    assigned_to: p.assignedTo ?? null,
    updated_at: nowIso(),
  };

  try {
    const { data, error } = await supabase.from("fraud_cases").insert([row]).select("id").single();
    if (error) {
      console.error("createFraudCase:", error);
      return { ok: false, error };
    }
    const caseId = data?.id;
    if (!caseId) {
      console.error("createFraudCase: no id returned");
      return { ok: false, error: new Error("no id returned") };
    }
    await logCaseAudit(supabase, "fraud_case_created", {
      userId,
      fraudLogId: row.primary_fraud_log_id,
      caseId,
      actorUserId: p.openedBy ?? null,
      eventData: {
        title,
        priority: row.priority,
        status: row.status,
      },
    });
    return { ok: true, caseId };
  } catch (e) {
    console.error("createFraudCase:", e);
    return { ok: false, error: e };
  }
}

/**
 * @param {*} supabase
 * @param {{ fraudLog: Record<string, unknown>, actorUserId?: string | null }} p
 * @returns {Promise<{ ok: boolean, skipped?: boolean, reason?: string, caseId?: string, error?: unknown }>}
 */
export async function maybeOpenCaseFromFraudLog(supabase, p) {
  const fraudLog = p?.fraudLog;
  const uid = fraudLog?.user_id != null ? String(fraudLog.user_id) : "";
  const logId = fraudLog?.id != null ? String(fraudLog.id) : "";
  if (!uid || !logId) {
    return { ok: true, skipped: true, reason: "missing_ids" };
  }

  try {
    const { data: profile, error: pe } = await supabase
      .from("profiles")
      .select("account_status, risk_level")
      .eq("id", uid)
      .maybeSingle();
    if (pe) console.error(pe);

    const restricted = String(profile?.account_status || "").toLowerCase() === "restricted";
    const highLog = String(fraudLog.risk_level || "").toLowerCase() === "high";
    const userHigh = String(profile?.risk_level || "").toLowerCase() === "high";

    if (!(restricted && highLog && userHigh)) {
      return { ok: true, skipped: true, reason: "conditions_not_met" };
    }

    const title = `Escalated investigation — ${formatShortUserId(uid)}`;
    const existing = await supabase
      .from("fraud_cases")
      .select("id")
      .eq("user_id", uid)
      .eq("primary_fraud_log_id", logId)
      .limit(1)
      .maybeSingle();
    if (existing.error) console.error(existing.error);
    if (existing.data?.id) {
      return { ok: true, skipped: true, reason: "case_exists", caseId: existing.data.id };
    }

    return createFraudCase(supabase, {
      userId: uid,
      primaryFraudLogId: logId,
      title,
      summary: "Auto-opened: restricted account + high-risk user + high-severity fraud log.",
      priority: "critical",
      status: "open",
      openedBy: p.actorUserId ?? null,
      assignedTo: null,
    });
  } catch (e) {
    console.error("maybeOpenCaseFromFraudLog:", e);
    return { ok: false, error: e };
  }
}

/**
 * @param {*} supabase
 * @param {{
 *   caseId: string,
 *   actorUserId?: string | null,
 *   userId?: string | null,
 *   fraudLogId?: string | null,
 *   patch: Record<string, unknown>,
 *   previousStatus?: string | null,
 * }} p
 */
export async function updateFraudCase(supabase, p) {
  const caseId = String(p?.caseId || "").trim();
  if (!supabase || !caseId) {
    console.error("updateFraudCase: missing input");
    return { ok: false, error: new Error("missing input") };
  }

  const rawPatch = { ...(p.patch || {}) };
  const hadStatus = Object.prototype.hasOwnProperty.call(rawPatch, "status");
  const hadAssign = Object.prototype.hasOwnProperty.call(rawPatch, "assigned_to");
  const patch = { ...rawPatch };
  const prevStatus = p.previousStatus != null ? String(p.previousStatus) : "";

  if (patch.status != null) {
    const st = String(patch.status).toLowerCase();
    patch.status = ["open", "in_review", "escalated", "resolved"].includes(st) ? st : "open";
    if (patch.status === "resolved") {
      patch.resolved_at = nowIso();
      patch.resolved_by = p.actorUserId ?? null;
    } else {
      patch.resolved_at = null;
      patch.resolved_by = null;
    }
  }

  if (patch.priority != null) {
    const pr = String(patch.priority).toLowerCase();
    patch.priority = ["low", "medium", "high", "critical"].includes(pr) ? pr : "medium";
  }

  patch.updated_at = nowIso();

  try {
    const { data, error } = await supabase.from("fraud_cases").update(patch).eq("id", caseId).select("*").maybeSingle();
    if (error) {
      console.error("updateFraudCase:", error);
      return { ok: false, error };
    }
    if (hadStatus && patch.status != null && patch.status !== prevStatus) {
      await logCaseAudit(supabase, "fraud_case_status_updated", {
        userId: p.userId ?? null,
        fraudLogId: p.fraudLogId ?? null,
        caseId,
        actorUserId: p.actorUserId ?? null,
        eventData: {
          previous_status: prevStatus,
          next_status: patch.status,
        },
      });
    }
    if (hadAssign && data) {
      await logCaseAudit(supabase, "fraud_case_assigned", {
        userId: p.userId ?? null,
        fraudLogId: p.fraudLogId ?? null,
        caseId,
        actorUserId: p.actorUserId ?? null,
        eventData: {
          assigned_to: patch.assigned_to,
        },
      });
    }
    return { ok: true, data };
  } catch (e) {
    console.error("updateFraudCase:", e);
    return { ok: false, error: e };
  }
}

/**
 * @param {*} supabase
 * @param {{ caseId: string, note: string, authorUserId?: string | null, auditUserId?: string | null, subjectUserId?: string | null, fraudLogId?: string | null }} p
 */
export async function addFraudCaseNote(supabase, p) {
  const caseId = String(p?.caseId || "").trim();
  const note = String(p?.note || "").trim();
  if (!supabase || !caseId || !note) {
    console.error("addFraudCaseNote: missing input");
    return { ok: false, error: new Error("missing input") };
  }

  try {
    const { data, error } = await supabase
      .from("fraud_case_notes")
      .insert([
        {
          case_id: caseId,
          author_user_id: p.authorUserId ?? null,
          note,
        },
      ])
      .select("id, created_at")
      .single();

    if (error) {
      console.error("addFraudCaseNote:", error);
      return { ok: false, error };
    }

    await supabase.from("fraud_cases").update({ updated_at: nowIso() }).eq("id", caseId);

    await logCaseAudit(supabase, "fraud_case_note_added", {
      userId: p.subjectUserId ?? null,
      fraudLogId: p.fraudLogId ?? null,
      caseId,
      actorUserId: p.auditUserId ?? p.authorUserId ?? null,
      eventData: {
        note_length: note.length,
      },
    });

    return { ok: true, data };
  } catch (e) {
    console.error("addFraudCaseNote:", e);
    return { ok: false, error: e };
  }
}

/**
 * @param {*} supabase
 * @param {string} caseId
 * @returns {Promise<{ ok: boolean, data?: object, error?: unknown }>}
 */
export async function fetchFraudCaseWithNotes(supabase, caseId) {
  const id = String(caseId || "").trim();
  if (!supabase || !id) {
    console.error("fetchFraudCaseWithNotes: missing id");
    return { ok: false, error: new Error("missing id") };
  }

  try {
    const { data: row, error: ce } = await supabase.from("fraud_cases").select("*").eq("id", id).maybeSingle();
    if (ce) {
      console.error(ce);
      return { ok: false, error: ce };
    }
    if (!row) {
      return { ok: false, error: new Error("not_found") };
    }

    const { data: notes, error: ne } = await supabase
      .from("fraud_case_notes")
      .select("id, author_user_id, note, created_at")
      .eq("case_id", id)
      .order("created_at", { ascending: false });

    if (ne) console.error(ne);

    let profile = null;
    try {
      const pr = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, risk_level, account_status")
        .eq("id", row.user_id)
        .maybeSingle();
      if (pr.error) console.error(pr.error);
      else profile = pr.data || null;
    } catch (e) {
      console.error(e);
    }

    let fraudLog = null;
    if (row.primary_fraud_log_id) {
      try {
        const fr = await supabase
          .from("fraud_logs")
          .select("id, risk_score, risk_level, transaction_type, status, related_transaction_id, amount")
          .eq("id", row.primary_fraud_log_id)
          .maybeSingle();
        if (fr.error) console.error(fr.error);
        else fraudLog = fr.data || null;
      } catch (e) {
        console.error(e);
      }
    }

    return {
      ok: true,
      data: {
        fraudCase: row,
        notes: ne ? [] : notes || [],
        profile,
        fraudLog,
      },
    };
  } catch (e) {
    console.error("fetchFraudCaseWithNotes:", e);
    return { ok: false, error: e };
  }
}
