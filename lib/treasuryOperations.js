/**
 * Treasury operational layer — monitoring signals, event logging, and advisory synthesis.
 * Observe → Monitor → Log → Recommend — NOT Act. Fail-open; never throws to callers.
 */

import { supabase as defaultClient } from "./supabaseClient";
import { sanitizeOperationalMetadata } from "./operationalLogger";

const LOG_NS = "[treasury-operations]";

const SEVERITIES = new Set(["info", "low", "moderate", "elevated", "high"]);

const MATERIALITY_EXPOSURE_MAX = 10;
const MATERIALITY_LIABILITY_MAX = 25;

const EMPTY_MONITORING_SIGNALS = Object.freeze({
  operatingState: "normal_monitoring",
  treasuryAttentionLevel: "low",
  treasuryMonitoringSignals: [],
  treasuryWatchFlags: [],
  recommendedMonitoring: [],
  confidence: 0,
});

function warn(payload) {
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
  return (
    msg.includes("treasury_operational_events") &&
    (msg.includes("does not exist") || msg.includes("not found"))
  );
}

function normalizeSeverity(severity) {
  const key = String(severity || "info").toLowerCase();
  return SEVERITIES.has(key) ? key : "info";
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function isSmallDollarEnvironment(exposure, liabilities) {
  return (
    toFiniteNumber(exposure) < MATERIALITY_EXPOSURE_MAX &&
    toFiniteNumber(liabilities) < MATERIALITY_LIABILITY_MAX
  );
}

function isLevelIn(value, levels) {
  return levels.includes(String(value || "").toLowerCase());
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function softenText(text, isSmallDollar) {
  if (!isSmallDollar || !text) return text;
  const t = String(text);
  if (t.toLowerCase().includes("soft-launch") || t.toLowerCase().includes("soft launch")) return t;
  return `${t.replace(/\.$/, "")} — interpret cautiously at soft-launch dollar levels.`;
}

function uniqueStrings(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const s = String(item || "").trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function mapEventRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventType: row.event_type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    createdAt: row.created_at,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{
 *   event_type: string;
 *   severity?: string;
 *   title: string;
 *   description?: string;
 *   metadata?: Record<string, unknown>;
 * }} args
 */
export async function logTreasuryOperationalEvent(
  supabase,
  { event_type, severity, title, description, metadata } = {},
) {
  const client = supabase || defaultClient;
  const eventType = typeof event_type === "string" ? event_type.trim().slice(0, 120) : "";
  const eventTitle = typeof title === "string" ? title.trim().slice(0, 500) : "";

  if (!client || !eventType || !eventTitle) {
    warn({ op: "logTreasuryOperationalEvent", reason: "missing_client_type_or_title" });
    return { ok: false };
  }

  const row = {
    event_type: eventType,
    severity: normalizeSeverity(severity),
    title: eventTitle,
    description: description ? String(description).trim().slice(0, 2000) : null,
    metadata: sanitizeOperationalMetadata(metadata),
  };

  try {
    const { error } = await client.from("treasury_operational_events").insert([row]);
    if (error) {
      if (isMissingTableError(error)) {
        warn({ op: "logTreasuryOperationalEvent", tableMissing: true, event_type: eventType });
        return { ok: false, tableMissing: true };
      }
      warn({ op: "logTreasuryOperationalEvent", err: error.message, event_type: eventType });
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    warn({ op: "logTreasuryOperationalEvent", err: err?.message || String(err), event_type: eventType });
    return { ok: false };
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ limit?: number; severity?: string; event_type?: string }} [opts]
 */
export async function fetchTreasuryOperationalEvents(supabase, { limit = 50, severity, event_type } = {}) {
  const client = supabase || defaultClient;
  if (!client) {
    warn({ op: "fetchTreasuryOperationalEvents", reason: "no_client" });
    return [];
  }

  const cap = clamp(Math.round(Number(limit) || 50), 1, 200);

  try {
    let q = client
      .from("treasury_operational_events")
      .select("id, event_type, severity, title, description, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(cap);

    const sev = typeof severity === "string" ? severity.trim() : "";
    if (sev) {
      q = q.eq("severity", normalizeSeverity(sev));
    }

    const evt = typeof event_type === "string" ? event_type.trim() : "";
    if (evt) q = q.eq("event_type", evt);

    const { data, error } = await q;
    if (error) {
      if (isMissingTableError(error)) {
        warn({ op: "fetchTreasuryOperationalEvents", tableMissing: true });
        return [];
      }
      warn({ op: "fetchTreasuryOperationalEvents", err: error.message });
      return [];
    }

    return (data || []).map(mapEventRow).filter(Boolean);
  } catch (err) {
    warn({ op: "fetchTreasuryOperationalEvents", err: err?.message || String(err) });
    return [];
  }
}

function deriveOperatingState({
  commandStatus,
  alertPriority,
  driftStatus,
  operationalStatus,
  launchCondition,
}) {
  if (
    commandStatus === "active_review" ||
    isLevelIn(alertPriority, ["high"]) ||
    isLevelIn(driftStatus, ["meaningful_shift"]) ||
    operationalStatus === "high_attention" ||
    isLevelIn(launchCondition, ["critical", "not_ready"])
  ) {
    return "review_attention";
  }

  if (
    commandStatus === "elevated_attention" ||
    isLevelIn(alertPriority, ["elevated"]) ||
    isLevelIn(driftStatus, ["moderate_shift"]) ||
    operationalStatus === "elevated_attention" ||
    isLevelIn(launchCondition, ["watch", "caution"])
  ) {
    return "elevated_monitoring";
  }

  return "normal_monitoring";
}

function deriveAttentionLevel({ commandStatus, priorityLevel, attentionSignal, alertPriority }) {
  if (
    commandStatus === "active_review" ||
    priorityLevel === "high" ||
    isLevelIn(alertPriority, ["high"])
  ) {
    return "high";
  }

  if (
    commandStatus === "elevated_attention" ||
    priorityLevel === "elevated" ||
    attentionSignal === "immediate_attention" ||
    isLevelIn(alertPriority, ["elevated"])
  ) {
    return "elevated";
  }

  if (
    commandStatus === "monitored" ||
    priorityLevel === "moderate" ||
    attentionSignal === "increased_review"
  ) {
    return "moderate";
  }

  return "low";
}

function deriveMonitoringConfidence({
  commandCenter,
  readinessIndex,
  operationalGuidance,
  driftDetection,
  stability,
  monitoringDashboard,
  alerts,
}) {
  const inputs = [
    commandCenter?.confidence,
    readinessIndex?.confidence,
    operationalGuidance?.confidence,
    driftDetection?.confidence,
    stability?.confidence,
    monitoringDashboard?.confidence,
    alerts?.confidence,
  ];
  const present = inputs.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
  if (present.length === 0) return 0;
  const avg = present.reduce((a, b) => a + b, 0) / present.length;
  const coverage = present.length / inputs.length;
  return clamp(Math.round(avg * (0.65 + 0.35 * coverage)), 0, 100);
}

/**
 * Pure advisory synthesis from existing treasury intelligence outputs.
 * @param {object} args
 */
export function buildTreasuryMonitoringSignals({
  treasuryCommandCenter = {},
  readinessIndex = {},
  operationalGuidance = {},
  driftDetection = {},
  stability = {},
  monitoringDashboard = {},
  alerts = {},
  smallDollarMetrics,
} = {}) {
  try {
    const commandStatus = String(treasuryCommandCenter.treasuryCommandStatus || "monitored").toLowerCase();
    const priorityLevel = String(treasuryCommandCenter.treasuryPriorityLevel || "moderate").toLowerCase();
    const attentionSignal = String(treasuryCommandCenter.treasuryAttentionSignal || "").toLowerCase();
    const alertPriority = String(alerts.alertPriority || "low").toLowerCase();
    const driftStatus = String(driftDetection.driftStatus || "unchanged").toLowerCase();
    const operationalStatus = String(operationalGuidance.operationalStatus || "monitor").toLowerCase();
    const launchCondition = String(readinessIndex.treasuryLaunchCondition || "").toLowerCase();
    const launchSignal = String(readinessIndex.treasuryLaunchSignal || "").toLowerCase();
    const stabilityLevel = String(stability.stabilityLevel || "").toLowerCase();
    const momentum = String(monitoringDashboard.treasuryMomentum || "stable").toLowerCase();

    const metrics = smallDollarMetrics || {};
    const exposure = toFiniteNumber(metrics.pendingWithdrawalExposure);
    const liabilities = toFiniteNumber(metrics.totalWalletLiabilities);
    const isSmallDollar =
      metrics.isSmallDollar === true ||
      (liabilities > 0 || exposure > 0 ? isSmallDollarEnvironment(exposure, liabilities) : false);

    const operatingState = deriveOperatingState({
      commandStatus,
      alertPriority,
      driftStatus,
      operationalStatus,
      launchCondition,
    });

    const treasuryAttentionLevel = deriveAttentionLevel({
      commandStatus,
      priorityLevel,
      attentionSignal,
      alertPriority,
    });

    const signals = [];
    const watchFlags = [];
    const recommended = [];

    if (commandStatus === "stable") {
      signals.push(
        isSmallDollar
          ? "Treasury command center reports stable posture at soft-launch scale."
          : "Treasury command center reports stable operating posture.",
      );
    } else if (commandStatus === "monitored") {
      signals.push("Treasury command center indicates active monitoring posture.");
    } else if (commandStatus === "elevated_attention") {
      signals.push("Treasury command center elevated attention — leadership review recommended.");
    } else if (commandStatus === "active_review") {
      signals.push("Treasury command center active review — prioritize advisory leadership check-in.");
    }

    if (launchSignal) {
      signals.push(`Readiness launch signal: ${launchSignal.replace(/_/g, " ")}.`);
    }

    if (momentum && momentum !== "stable" && momentum !== "insufficient_data") {
      signals.push(`Treasury momentum signal: ${momentum.replace(/_/g, " ")}.`);
    }

    if (driftStatus !== "unchanged" && driftStatus !== "insufficient_data") {
      signals.push(`Drift detection: ${driftStatus.replace(/_/g, " ")} since prior snapshot.`);
    }

    if (alertPriority !== "low") {
      signals.push(`Classified alert priority: ${alertPriority}.`);
    }

    if (operationalStatus && operationalStatus !== "healthy") {
      signals.push(`Operational guidance posture: ${operationalStatus.replace(/_/g, " ")}.`);
    }

    for (const item of treasuryCommandCenter.concerns || []) {
      watchFlags.push(String(item));
    }
    for (const item of treasuryCommandCenter.watchAreas || []) {
      watchFlags.push(String(item));
    }
    for (const item of readinessIndex.watchAreas || []) {
      watchFlags.push(String(item));
    }
    for (const driver of driftDetection.driftDrivers || []) {
      if (driver?.title) watchFlags.push(String(driver.title));
    }
    if (isLevelIn(stabilityLevel, ["weakening", "unstable"])) {
      watchFlags.push(`Stability level: ${stabilityLevel.replace(/_/g, " ")}`);
    }
    for (const alert of alerts.classifiedAlerts || []) {
      if (alert?.title) watchFlags.push(String(alert.title));
    }

    for (const action of treasuryCommandCenter.executiveActions || []) {
      recommended.push(`Review: ${action}`);
    }
    for (const rec of readinessIndex.recommendations || []) {
      recommended.push(String(rec));
    }
    for (const check of operationalGuidance.recommendedChecks || []) {
      recommended.push(String(check));
    }
    for (const route of alerts.routingSuggestions || []) {
      recommended.push(String(route));
    }

    if (operatingState === "normal_monitoring") {
      recommended.push(
        isSmallDollar
          ? "Continue routine snapshot cadence and soft-launch monitoring."
          : "Continue routine snapshot cadence and treasury intelligence review.",
      );
    } else if (operatingState === "elevated_monitoring") {
      recommended.push("Increase leadership visibility on treasury watch flags — advisory review only.");
    } else {
      recommended.push("Schedule leadership treasury review — observational; no automated treasury actions.");
    }

    const confidence = deriveMonitoringConfidence({
      commandCenter: treasuryCommandCenter,
      readinessIndex,
      operationalGuidance,
      driftDetection,
      stability,
      monitoringDashboard,
      alerts,
    });

    return {
      operatingState,
      treasuryAttentionLevel,
      treasuryMonitoringSignals: uniqueStrings(signals.map((s) => softenText(s, isSmallDollar))).slice(0, 12),
      treasuryWatchFlags: uniqueStrings(watchFlags.map((s) => softenText(s, isSmallDollar))).slice(0, 15),
      recommendedMonitoring: uniqueStrings(recommended.map((s) => softenText(s, isSmallDollar))).slice(0, 12),
      confidence: isSmallDollar ? Math.min(confidence, 85) : confidence,
    };
  } catch (err) {
    warn({ op: "buildTreasuryMonitoringSignals", err: err?.message || String(err) });
    return { ...EMPTY_MONITORING_SIGNALS };
  }
}

const DEDUP_WINDOW_MS = 20 * 60 * 1000;
const SEVERITY_RANK = Object.freeze({
  info: 0,
  low: 1,
  moderate: 2,
  elevated: 3,
  high: 4,
});

/** @type {Map<string, { emittedAt: number; fingerprint: string }>} */
const emissionDedupCache = new Map();

const DRIFT_MATERIAL = new Set(["moderate_shift", "meaningful_shift"]);
const MOMENTUM_MATERIAL = new Set(["weakening", "pressure", "elevating_risk", "critical"]);

function rankSeverity(severity) {
  return SEVERITY_RANK[normalizeSeverity(severity)] ?? 0;
}

function downgradeSeverityOneNotch(severity) {
  const order = ["info", "low", "moderate", "elevated", "high"];
  const idx = order.indexOf(normalizeSeverity(severity));
  return idx <= 0 ? "info" : order[idx - 1];
}

function buildStableFingerprint({
  operatingState,
  attentionLevel,
  launchSignal,
  driftStatus,
  alertPriority,
  stabilityLevel,
  momentum,
  watchFlags,
}) {
  const flags = uniqueStrings((watchFlags || []).map(String)).sort().join("|");
  return [
    operatingState || "",
    attentionLevel || "",
    launchSignal || "",
    driftStatus || "",
    alertPriority || "",
    stabilityLevel || "",
    momentum || "",
    flags,
  ].join("::");
}

function buildMonitoringPosturePhrase(operatingState, attentionLevel) {
  const state = String(operatingState || "normal_monitoring").replace(/_/g, " ");
  const attention = String(attentionLevel || "low");
  return `${state} · ${attention} attention`;
}

function extractComparableState({
  treasuryOperationsState = {},
  readinessIndex = {},
  driftDetection = {},
  stability = {},
  monitoringDashboard = {},
  classifiedAlerts = {},
} = {}) {
  const watchFlags = treasuryOperationsState.treasuryWatchFlags || [];
  return {
    operatingState: String(treasuryOperationsState.operatingState || "normal_monitoring").toLowerCase(),
    attentionLevel: String(treasuryOperationsState.treasuryAttentionLevel || "low").toLowerCase(),
    launchSignal: String(readinessIndex.treasuryLaunchSignal || "").toLowerCase(),
    launchCondition: String(readinessIndex.treasuryLaunchCondition || "").toLowerCase(),
    driftStatus: String(driftDetection.driftStatus || "unchanged").toLowerCase(),
    alertPriority: String(classifiedAlerts.alertPriority || "low").toLowerCase(),
    stabilityLevel: String(stability.stabilityLevel || "").toLowerCase(),
    momentum: String(monitoringDashboard.treasuryMomentum || "stable").toLowerCase(),
    operationalStatus: String(
      (typeof treasuryOperationsState === "object" && treasuryOperationsState.operationalStatus) || "",
    ).toLowerCase(),
    watchFlags: uniqueStrings(watchFlags.map(String)),
    watchFlagCount: uniqueStrings(watchFlags.map(String)).length,
  };
}

function resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure }) {
  if (smallDollarEnvironment === true) return true;
  if (smallDollarEnvironment === false) return false;
  return isSmallDollarEnvironment(exposure, liabilities);
}

function severityForMonitoringContext({ operatingState, attentionLevel, watchFlagCount, isSmallDollar }) {
  let severity = "info";
  if (attentionLevel === "high" || operatingState === "review_attention") {
    severity = "high";
  } else if (attentionLevel === "elevated" || operatingState === "elevated_monitoring") {
    severity = "elevated";
  } else if (attentionLevel === "moderate") {
    severity = "moderate";
  } else if (operatingState === "elevated_monitoring") {
    severity = "moderate";
  } else {
    severity = "low";
  }

  if (watchFlagCount >= 3 && rankSeverity(severity) < rankSeverity("high")) {
    severity = "elevated";
  }
  if (watchFlagCount >= 5 && rankSeverity(severity) < rankSeverity("high")) {
    severity = "high";
  }

  if (isSmallDollar) {
    severity = downgradeSeverityOneNotch(severity);
  }
  return normalizeSeverity(severity);
}

function formatSoftLaunchTitle(title, isSmallDollar) {
  if (!isSmallDollar) return title;
  const t = String(title || "");
  if (t.toLowerCase().includes("soft-launch")) return t;
  return t.replace(/^Treasury /i, "Soft-launch treasury ");
}

function formatSoftLaunchDescription(description, isSmallDollar) {
  if (!isSmallDollar) return description;
  const base = String(description || "").trim();
  if (!base) {
    return "Soft-launch treasury monitoring detected; elevated observation recommended.";
  }
  return softenText(base, true);
}

function shouldSkipDedup(eventType, fingerprint, title) {
  const key = `${eventType}:${fingerprint || title}`;
  const entry = emissionDedupCache.get(key);
  const now = Date.now();
  if (!entry) return { skip: false, key };
  if (entry.fingerprint === fingerprint && now - entry.emittedAt < DEDUP_WINDOW_MS) {
    return { skip: true, key, reason: "duplicate_within_window" };
  }
  if (entry.fingerprint === fingerprint) {
    return { skip: true, key, reason: "unchanged_fingerprint" };
  }
  return { skip: false, key };
}

function recordDedupEmission(key, fingerprint) {
  emissionDedupCache.set(key, { emittedAt: Date.now(), fingerprint });
}

/** Reset in-memory emission dedup cache (tests / manual refresh). */
export function resetTreasuryEmissionDedupCache() {
  emissionDedupCache.clear();
}

/** @returns {Array<{ key: string; emittedAt: number; fingerprint: string }>} */
export function readTreasuryEmissionDedupCache() {
  return [...emissionDedupCache.entries()].map(([key, v]) => ({
    key,
    emittedAt: v.emittedAt,
    fingerprint: v.fingerprint,
  }));
}

const OPERATING_STATE_RANK = Object.freeze({
  normal_monitoring: 0,
  elevated_monitoring: 1,
  review_attention: 2,
});

const ATTENTION_RANK = Object.freeze({
  low: 0,
  moderate: 1,
  elevated: 2,
  high: 3,
});

/**
 * Advisory monitoring event emission — observe, detect, log only.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function emitTreasuryMonitoringEvents(
  supabase,
  {
    treasuryCommandCenter = {},
    readinessIndex = {},
    operationalGuidance = {},
    driftDetection = {},
    stability = {},
    monitoringDashboard = {},
    classifiedAlerts = {},
    treasuryOperationsState = {},
    previousState = null,
    smallDollarEnvironment,
    liabilities,
    exposure,
  } = {},
) {
  const emittedEvents = [];
  const skippedEvents = [];

  try {
    const curr = extractComparableState({
      treasuryOperationsState,
      readinessIndex,
      driftDetection,
      stability,
      monitoringDashboard,
      classifiedAlerts,
    });
    const prev = previousState
      ? {
          operatingState: String(previousState.operatingState || "normal_monitoring").toLowerCase(),
          attentionLevel: String(
            previousState.attentionLevel || previousState.treasuryAttentionLevel || "low",
          ).toLowerCase(),
          launchSignal: String(
            previousState.launchSignal || previousState.treasuryLaunchSignal || "",
          ).toLowerCase(),
          driftStatus: String(previousState.driftStatus || "unchanged").toLowerCase(),
          alertPriority: String(previousState.alertPriority || "low").toLowerCase(),
          stabilityLevel: String(previousState.stabilityLevel || "").toLowerCase(),
          momentum: String(previousState.momentum || "stable").toLowerCase(),
          watchFlags: uniqueStrings(
            (previousState.watchFlags || previousState.treasuryWatchFlags || []).map(String),
          ),
          watchFlagCount: uniqueStrings(
            (previousState.watchFlags || previousState.treasuryWatchFlags || []).map(String),
          ).length,
        }
      : null;

    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const fingerprint = buildStableFingerprint(curr);
    const baseSeverity = severityForMonitoringContext({
      operatingState: curr.operatingState,
      attentionLevel: curr.attentionLevel,
      watchFlagCount: curr.watchFlagCount,
      isSmallDollar,
    });

    const baseMetadata = {
      operatingState: curr.operatingState,
      treasuryAttentionLevel: curr.attentionLevel,
      launchSignal: curr.launchSignal || null,
      driftStatus: curr.driftStatus,
      alertPriority: curr.alertPriority,
      stabilityLevel: curr.stabilityLevel || null,
      momentum: curr.momentum,
      watchFlagCount: curr.watchFlagCount,
      commandStatus: String(treasuryCommandCenter.treasuryCommandStatus || "").toLowerCase() || null,
      operationalStatus: String(operationalGuidance.operationalStatus || "").toLowerCase() || null,
      isSmallDollar,
      fingerprint,
      advisoryOnly: true,
    };

    const alertReadiness = assessTreasuryAlertReadiness({
      treasuryOperationsState,
      emittedMonitoringSummary: null,
      treasuryCommandCenter,
      readinessIndex,
      classifiedAlerts,
      operationalGuidance,
      driftDetection,
      stability,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.alertReadinessStatus = alertReadiness.alertReadinessStatus;
    baseMetadata.alertPosture = alertReadiness.alertPosture;
    baseMetadata.recommendedAlertChannel = alertReadiness.recommendedAlertChannel;

    const adminAlertsForNotification = buildTreasuryAdminAlerts({
      treasuryAlertReadiness: alertReadiness,
      emittedMonitoringSummary: null,
      operationalGuidance,
      classifiedAlerts,
      treasuryOperationsState,
      readinessIndex,
      treasuryCommandCenter,
      driftDetection,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    const notificationReadiness = buildTreasuryNotificationReadiness({
      treasuryAdminAlerts: adminAlertsForNotification,
      alertReadiness,
      monitoringSummary: null,
      treasuryCommandCenter,
      readinessIndex,
      operationalGuidance,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.notificationReadinessStatus = notificationReadiness.notificationReadinessStatus;
    baseMetadata.recommendedNotificationPosture = notificationReadiness.recommendedNotificationPosture;

    let digestReadinessMeta = mapNotificationStatusToDigestReadiness(
      notificationReadiness.notificationReadinessStatus,
    );
    if (isSmallDollar) {
      digestReadinessMeta = downgradeDigestReadinessOneNotch(digestReadinessMeta);
    }
    baseMetadata.digestReadiness = digestReadinessMeta;

    const digestIntelligenceForEscalation = buildTreasuryDigestIntelligence({
      treasuryCommandCenter,
      readinessIndex,
      executiveBriefing: {},
      historicalAnalytics: {},
      monitoringDashboard,
      operationalGuidance,
      treasuryAdminAlerts: adminAlertsForNotification,
      notificationReadiness,
      alertReadiness,
      treasuryOperationsState,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    const executiveEscalationMeta = buildTreasuryExecutiveEscalation({
      treasuryCommandCenter,
      readinessIndex,
      executiveBriefing: {},
      digestIntelligence: digestIntelligenceForEscalation,
      alertReadiness,
      notificationReadiness,
      treasuryAdminAlerts: adminAlertsForNotification,
      operationalGuidance,
      monitoringDashboard,
      governance: {},
      scalingReadiness: {},
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.executiveAttentionStatus = executiveEscalationMeta.executiveAttentionStatus;
    baseMetadata.escalationPriority = executiveEscalationMeta.escalationPriority;

    const decisionSupportMeta = buildTreasuryDecisionSupport({
      treasuryCommandCenter,
      operationalGuidance,
      readinessIndex,
      monitoringDashboard,
      treasuryAdminAlerts: adminAlertsForNotification,
      alertReadiness,
      notificationReadiness,
      digestIntelligence: digestIntelligenceForEscalation,
      executiveEscalation: executiveEscalationMeta,
      treasuryOperatingMode: {},
      governance: {},
      scalingReadiness: {},
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.decisionSupportStatus = decisionSupportMeta.decisionSupportStatus;

    let institutionalMemoryMeta = { institutionalMemoryStatus: "minimal_history" };
    let historyEvents = [];
    try {
      historyEvents = await fetchTreasuryOperationalEvents(supabase, { limit: 50 });
      institutionalMemoryMeta = buildTreasuryInstitutionalMemory({
        treasuryOperationalEvents: historyEvents,
        treasuryAdminAlerts: adminAlertsForNotification,
        digestIntelligence: digestIntelligenceForEscalation,
        executiveEscalation: executiveEscalationMeta,
        decisionSupport: decisionSupportMeta,
        monitoringSummary: null,
        alertReadiness,
        treasuryCommandCenter,
        smallDollarEnvironment: isSmallDollar,
        liabilities,
        exposure,
      });
    } catch {
      institutionalMemoryMeta = { institutionalMemoryStatus: "minimal_history" };
    }
    baseMetadata.institutionalMemoryStatus = institutionalMemoryMeta.institutionalMemoryStatus;

    const confidenceExplainabilityMeta = buildTreasuryConfidenceExplainability({
      monitoringDashboard,
      treasuryAdminAlerts: adminAlertsForNotification,
      alertReadiness,
      notificationReadiness,
      digestIntelligence: digestIntelligenceForEscalation,
      executiveEscalation: executiveEscalationMeta,
      decisionSupport: decisionSupportMeta,
      institutionalMemory: institutionalMemoryMeta,
      operationalGuidance,
      readinessIndex,
      treasuryCommandCenter,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.confidenceLevel = confidenceExplainabilityMeta.confidenceLevel;
    baseMetadata.confidenceScore = confidenceExplainabilityMeta.confidenceScore;

    const consistencyMeta = buildTreasuryConsistencyCheck({
      executiveEscalation: executiveEscalationMeta,
      decisionSupport: decisionSupportMeta,
      institutionalMemory: institutionalMemoryMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      digestIntelligence: digestIntelligenceForEscalation,
      operationalGuidance,
      alertReadiness,
      notificationReadiness,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.consistencyStatus = consistencyMeta.consistencyStatus;

    const riskNarrativeMeta = buildTreasuryRiskNarrative({
      treasuryCommandCenter,
      executiveBriefing: {},
      digestIntelligence: digestIntelligenceForEscalation,
      executiveEscalation: executiveEscalationMeta,
      decisionSupport: decisionSupportMeta,
      institutionalMemory: institutionalMemoryMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      consistencyCheck: consistencyMeta,
      readinessIndex,
      operationalGuidance,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.treasuryNarrativeStatus = riskNarrativeMeta.treasuryNarrativeStatus;

    const operationalPlaybookMeta = buildTreasuryOperationalPlaybook({
      treasuryRiskNarrative: riskNarrativeMeta,
      decisionSupport: decisionSupportMeta,
      executiveEscalation: executiveEscalationMeta,
      institutionalMemory: institutionalMemoryMeta,
      consistencyCheck: consistencyMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      treasuryCommandCenter,
      readinessIndex,
      treasuryOperatingMode: {},
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.playbookStatus = operationalPlaybookMeta.playbookStatus;

    const scenarioResponseMeta = buildTreasuryScenarioResponse({
      treasuryRiskNarrative: riskNarrativeMeta,
      operationalPlaybook: operationalPlaybookMeta,
      executiveEscalation: executiveEscalationMeta,
      decisionSupport: decisionSupportMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      consistencyCheck: consistencyMeta,
      treasuryCommandCenter,
      treasuryOperatingMode: {},
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.responseStatus = scenarioResponseMeta.responseStatus;
    baseMetadata.treasuryScenario = scenarioResponseMeta.treasuryScenario;

    const operatorTimelineMeta = buildTreasuryOperatorTimeline({
      scenarioResponse: scenarioResponseMeta,
      operationalPlaybook: operationalPlaybookMeta,
      treasuryRiskNarrative: riskNarrativeMeta,
      decisionSupport: decisionSupportMeta,
      executiveEscalation: executiveEscalationMeta,
      consistencyCheck: consistencyMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      institutionalMemory: institutionalMemoryMeta,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.timelineStatus = operatorTimelineMeta.timelineStatus;

    const attentionPriorityMeta = buildTreasuryAttentionPriority({
      operatorTimeline: operatorTimelineMeta,
      treasuryRiskNarrative: riskNarrativeMeta,
      scenarioResponse: scenarioResponseMeta,
      decisionSupport: decisionSupportMeta,
      operationalPlaybook: operationalPlaybookMeta,
      executiveEscalation: executiveEscalationMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      consistencyCheck: consistencyMeta,
      institutionalMemory: institutionalMemoryMeta,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.priorityStatus = attentionPriorityMeta.priorityStatus;

    const operationalCoherenceMeta = buildTreasuryOperationalCoherence({
      consistencyCheck: consistencyMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      treasuryRiskNarrative: riskNarrativeMeta,
      operationalPlaybook: operationalPlaybookMeta,
      scenarioResponse: scenarioResponseMeta,
      operatorTimeline: operatorTimelineMeta,
      attentionPriority: attentionPriorityMeta,
      executiveEscalation: executiveEscalationMeta,
      decisionSupport: decisionSupportMeta,
      institutionalMemory: institutionalMemoryMeta,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.coherenceStatus = operationalCoherenceMeta.coherenceStatus;

    const adaptiveReviewCadenceMeta = buildTreasuryAdaptiveReviewCadence({
      operationalCoherence: operationalCoherenceMeta,
      operatorTimeline: operatorTimelineMeta,
      attentionPriority: attentionPriorityMeta,
      executiveEscalation: executiveEscalationMeta,
      operationalPlaybook: operationalPlaybookMeta,
      decisionSupport: decisionSupportMeta,
      treasuryRiskNarrative: riskNarrativeMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.cadenceStatus = adaptiveReviewCadenceMeta.cadenceStatus;
    baseMetadata.recommendedCadence = adaptiveReviewCadenceMeta.recommendedCadence;

    const leadershipReadinessMeta = buildTreasuryLeadershipReadiness({
      adaptiveReviewCadence: adaptiveReviewCadenceMeta,
      operationalCoherence: operationalCoherenceMeta,
      attentionPriority: attentionPriorityMeta,
      executiveEscalation: executiveEscalationMeta,
      treasuryRiskNarrative: riskNarrativeMeta,
      operatorTimeline: operatorTimelineMeta,
      operationalPlaybook: operationalPlaybookMeta,
      institutionalMemory: institutionalMemoryMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      decisionSupport: decisionSupportMeta,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.readinessStatus = leadershipReadinessMeta.readinessStatus;
    baseMetadata.visibilityTier = leadershipReadinessMeta.visibilityTier;

    const metaReasoningMeta = buildTreasuryMetaReasoning({
      confidenceExplainability: confidenceExplainabilityMeta,
      operationalCoherence: operationalCoherenceMeta,
      leadershipReadiness: leadershipReadinessMeta,
      adaptiveReviewCadence: adaptiveReviewCadenceMeta,
      decisionSupport: decisionSupportMeta,
      institutionalMemory: institutionalMemoryMeta,
      treasuryRiskNarrative: riskNarrativeMeta,
      attentionPriority: attentionPriorityMeta,
      consistencyCheck: consistencyMeta,
      operatorTimeline: operatorTimelineMeta,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.trustStatus = metaReasoningMeta.trustStatus;

    const decisionTraceMeta = buildTreasuryDecisionTrace({
      monitoringIntelligence: {
        operatingState: curr.operatingState,
        treasuryAttentionLevel: curr.attentionLevel,
        treasuryMonitoringSignals: treasuryOperationsState.treasuryMonitoringSignals || [],
        treasuryWatchFlags: treasuryOperationsState.treasuryWatchFlags || [],
        confidence: treasuryOperationsState.confidence,
      },
      alertReadiness,
      treasuryAdminAlerts: adminAlertsForNotification,
      digestIntelligence: digestIntelligenceForEscalation,
      executiveEscalation: executiveEscalationMeta,
      decisionSupport: decisionSupportMeta,
      institutionalMemory: institutionalMemoryMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      operationalCoherence: operationalCoherenceMeta,
      adaptiveReviewCadence: adaptiveReviewCadenceMeta,
      leadershipReadiness: leadershipReadinessMeta,
      metaReasoning: metaReasoningMeta,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.traceStatus = decisionTraceMeta.traceStatus;

    const recommendationStabilityMeta = buildTreasuryRecommendationStability({
      treasuryOperationalEvents: historyEvents,
      decisionSupport: decisionSupportMeta,
      attentionPriority: attentionPriorityMeta,
      operationalCoherence: operationalCoherenceMeta,
      leadershipReadiness: leadershipReadinessMeta,
      adaptiveReviewCadence: adaptiveReviewCadenceMeta,
      metaReasoning: metaReasoningMeta,
      decisionTrace: decisionTraceMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      institutionalMemory: institutionalMemoryMeta,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.stabilityStatus = recommendationStabilityMeta.stabilityStatus;

    const advisoryDriftMeta = buildTreasuryAdvisoryDrift({
      treasuryOperationalEvents: historyEvents,
      recommendationStability: recommendationStabilityMeta,
      operationalCoherence: operationalCoherenceMeta,
      leadershipReadiness: leadershipReadinessMeta,
      decisionSupport: decisionSupportMeta,
      attentionPriority: attentionPriorityMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      metaReasoning: metaReasoningMeta,
      adaptiveReviewCadence: adaptiveReviewCadenceMeta,
      institutionalMemory: institutionalMemoryMeta,
      decisionTrace: decisionTraceMeta,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.advisoryDriftStatus = advisoryDriftMeta.driftStatus;

    const regimeDetectionMeta = buildTreasuryRegimeDetection({
      operationalCoherence: operationalCoherenceMeta,
      recommendationStability: recommendationStabilityMeta,
      advisoryDrift: advisoryDriftMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      leadershipReadiness: leadershipReadinessMeta,
      attentionPriority: attentionPriorityMeta,
      adaptiveReviewCadence: adaptiveReviewCadenceMeta,
      scenarioResponse: scenarioResponseMeta,
      metaReasoning: metaReasoningMeta,
      decisionSupport: decisionSupportMeta,
      decisionTrace: decisionTraceMeta,
      institutionalMemory: institutionalMemoryMeta,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.regime = regimeDetectionMeta.regime;

    const advisoryOutlookMeta = buildTreasuryAdvisoryOutlook({
      advisoryRegimeDetection: regimeDetectionMeta,
      advisoryDrift: advisoryDriftMeta,
      recommendationStability: recommendationStabilityMeta,
      operationalCoherence: operationalCoherenceMeta,
      confidenceExplainability: confidenceExplainabilityMeta,
      leadershipReadiness: leadershipReadinessMeta,
      adaptiveReviewCadence: adaptiveReviewCadenceMeta,
      attentionPriority: attentionPriorityMeta,
      decisionSupport: decisionSupportMeta,
      decisionTrace: decisionTraceMeta,
      metaReasoning: metaReasoningMeta,
      institutionalMemory: institutionalMemoryMeta,
      scenarioResponse: scenarioResponseMeta,
      smallDollarEnvironment: isSmallDollar,
      liabilities,
      exposure,
    });
    baseMetadata.outlook = advisoryOutlookMeta.outlook;

    /** @type {Array<{ event_type: string; severity: string; title: string; description?: string; metadata?: object; fp: string; skipIf?: () => { skip: boolean; reason?: string } }>} */
    const candidates = [];

    if (prev?.launchSignal && curr.launchSignal && prev.launchSignal !== curr.launchSignal) {
      candidates.push({
        event_type: "treasury_readiness_changed",
        severity: baseSeverity,
        title: formatSoftLaunchTitle("Treasury readiness signal changed", isSmallDollar),
        description: formatSoftLaunchDescription(
          `Launch signal moved from ${prev.launchSignal.replace(/_/g, " ")} to ${curr.launchSignal.replace(/_/g, " ")}.`,
          isSmallDollar,
        ),
        metadata: {
          ...baseMetadata,
          previousLaunchSignal: prev.launchSignal,
          currentLaunchSignal: curr.launchSignal,
        },
        fp: `readiness:${prev.launchSignal}->${curr.launchSignal}`,
      });
    }

    if (prev && prev.attentionLevel !== curr.attentionLevel) {
      candidates.push({
        event_type: "treasury_attention_changed",
        severity: baseSeverity,
        title: formatSoftLaunchTitle("Treasury attention level changed", isSmallDollar),
        description: formatSoftLaunchDescription(
          `Attention moved from ${prev.attentionLevel} to ${curr.attentionLevel} — advisory monitoring only.`,
          isSmallDollar,
        ),
        metadata: {
          ...baseMetadata,
          previousAttentionLevel: prev.attentionLevel,
          currentAttentionLevel: curr.attentionLevel,
        },
        fp: `attention:${prev.attentionLevel}->${curr.attentionLevel}`,
      });
    }

    if (prev && prev.operatingState !== curr.operatingState) {
      candidates.push({
        event_type: "treasury_operating_state_changed",
        severity: baseSeverity,
        title: formatSoftLaunchTitle("Treasury operating state changed", isSmallDollar),
        description: formatSoftLaunchDescription(
          `Operating state moved from ${prev.operatingState.replace(/_/g, " ")} to ${curr.operatingState.replace(/_/g, " ")}.`,
          isSmallDollar,
        ),
        metadata: {
          ...baseMetadata,
          previousOperatingState: prev.operatingState,
          currentOperatingState: curr.operatingState,
        },
        fp: `operating:${prev.operatingState}->${curr.operatingState}`,
      });
    }

    if (
      DRIFT_MATERIAL.has(curr.driftStatus) &&
      (!prev || prev.driftStatus !== curr.driftStatus)
    ) {
      candidates.push({
        event_type: "treasury_drift_detected",
        severity: curr.driftStatus === "meaningful_shift" ? (isSmallDollar ? "moderate" : "elevated") : baseSeverity,
        title: formatSoftLaunchTitle("Treasury drift detected", isSmallDollar),
        description: formatSoftLaunchDescription(
          `Drift status: ${curr.driftStatus.replace(/_/g, " ")} since prior observation.`,
          isSmallDollar,
        ),
        metadata: { ...baseMetadata, previousDriftStatus: prev?.driftStatus || null },
        fp: `drift:${curr.driftStatus}`,
      });
    }

    if (prev?.momentum && curr.momentum && prev.momentum !== curr.momentum && MOMENTUM_MATERIAL.has(curr.momentum)) {
      candidates.push({
        event_type: "treasury_resilience_shift",
        severity: baseSeverity,
        title: formatSoftLaunchTitle("Treasury momentum / resilience shift", isSmallDollar),
        description: formatSoftLaunchDescription(
          `Treasury momentum moved from ${prev.momentum.replace(/_/g, " ")} to ${curr.momentum.replace(/_/g, " ")}.`,
          isSmallDollar,
        ),
        metadata: { ...baseMetadata, previousMomentum: prev.momentum, currentMomentum: curr.momentum },
        fp: `momentum:${prev.momentum}->${curr.momentum}`,
      });
    }

    if (
      prev &&
      (OPERATING_STATE_RANK[curr.operatingState] ?? 0) > (OPERATING_STATE_RANK[prev.operatingState] ?? 0)
    ) {
      candidates.push({
        event_type: "treasury_monitoring_escalated",
        severity: baseSeverity,
        title: formatSoftLaunchTitle("Treasury monitoring escalated", isSmallDollar),
        description: formatSoftLaunchDescription(
          `Monitoring posture escalated to ${curr.operatingState.replace(/_/g, " ")}.`,
          isSmallDollar,
        ),
        metadata: {
          ...baseMetadata,
          previousOperatingState: prev.operatingState,
          escalation: true,
        },
        fp: `escalated:${prev.operatingState}->${curr.operatingState}`,
      });
    } else if (
      prev &&
      (ATTENTION_RANK[curr.attentionLevel] ?? 0) > (ATTENTION_RANK[prev.attentionLevel] ?? 0) &&
      !candidates.some((c) => c.event_type === "treasury_monitoring_escalated")
    ) {
      candidates.push({
        event_type: "treasury_monitoring_escalated",
        severity: baseSeverity,
        title: formatSoftLaunchTitle("Treasury monitoring escalated", isSmallDollar),
        description: formatSoftLaunchDescription(
          `Attention escalated from ${prev.attentionLevel} to ${curr.attentionLevel}.`,
          isSmallDollar,
        ),
        metadata: {
          ...baseMetadata,
          previousAttentionLevel: prev.attentionLevel,
          escalation: true,
        },
        fp: `escalated-attn:${prev.attentionLevel}->${curr.attentionLevel}`,
      });
    }

    if (prev?.stabilityLevel && curr.stabilityLevel && prev.stabilityLevel !== curr.stabilityLevel) {
      candidates.push({
        event_type: "treasury_stability_shift",
        severity: baseSeverity,
        title: formatSoftLaunchTitle("Treasury stability shift", isSmallDollar),
        description: formatSoftLaunchDescription(
          `Stability level moved from ${prev.stabilityLevel.replace(/_/g, " ")} to ${curr.stabilityLevel.replace(/_/g, " ")}.`,
          isSmallDollar,
        ),
        metadata: { ...baseMetadata, previousStabilityLevel: prev.stabilityLevel },
        fp: `stability:${prev.stabilityLevel}->${curr.stabilityLevel}`,
      });
    }

    const prevFlags = new Set((prev?.watchFlags || []).map(String));
    const newFlags = curr.watchFlags.filter((f) => !prevFlags.has(f));
    if (newFlags.length > 0) {
      const flagKey = newFlags.slice(0, 3).join("|").slice(0, 120);
      candidates.push({
        event_type: "treasury_watch_flag_detected",
        severity: newFlags.length >= 2 ? baseSeverity : isSmallDollar ? "low" : "moderate",
        title: formatSoftLaunchTitle("Treasury watch flag detected", isSmallDollar),
        description: formatSoftLaunchDescription(
          newFlags.length === 1
            ? `New watch flag: ${newFlags[0]}.`
            : `${newFlags.length} new watch flags — ${newFlags.slice(0, 2).join("; ")}${newFlags.length > 2 ? "…" : ""}.`,
          isSmallDollar,
        ),
        metadata: { ...baseMetadata, newWatchFlags: newFlags.slice(0, 8) },
        fp: `watch:${flagKey}`,
      });
    }

    if (prev && prev.alertPriority !== curr.alertPriority && curr.alertPriority !== "low") {
      candidates.push({
        event_type: "treasury_alert_pattern_changed",
        severity: curr.alertPriority === "high" ? (isSmallDollar ? "elevated" : "high") : baseSeverity,
        title: formatSoftLaunchTitle("Treasury alert pattern changed", isSmallDollar),
        description: formatSoftLaunchDescription(
          `Classified alert priority moved from ${prev.alertPriority} to ${curr.alertPriority}.`,
          isSmallDollar,
        ),
        metadata: { ...baseMetadata, previousAlertPriority: prev.alertPriority },
        fp: `alerts:${prev.alertPriority}->${curr.alertPriority}`,
      });
    }

    if (!prev && isSmallDollar && curr.operatingState !== "normal_monitoring") {
      candidates.push({
        event_type: "treasury_operational_note",
        severity: "info",
        title: "Soft-launch treasury monitoring active",
        description:
          "Soft-launch treasury monitoring detected; elevated observation recommended. No automated treasury actions.",
        metadata: baseMetadata,
        fp: `note:soft-launch:${fingerprint}`,
      });
    }

    if (!prev && candidates.length === 0) {
      skippedEvents.push({
        reason: "initial_baseline",
        event_type: "treasury_operational_note",
        title: "Monitoring baseline recorded",
      });
    }

    for (const candidate of candidates) {
      const dedup = shouldSkipDedup(candidate.event_type, candidate.fp, candidate.title);
      if (dedup.skip) {
        skippedEvents.push({
          reason: dedup.reason || "duplicate",
          event_type: candidate.event_type,
          title: candidate.title,
        });
        continue;
      }

      const payload = {
        event_type: candidate.event_type,
        severity: normalizeSeverity(candidate.severity),
        title: candidate.title,
        description: candidate.description,
        metadata: candidate.metadata,
      };

      await logTreasuryOperationalEvent(supabase, payload);
      recordDedupEmission(dedup.key, candidate.fp);
      emittedEvents.push(payload);
    }

    if (prev && fingerprint === buildStableFingerprint(prev) && emittedEvents.length === 0) {
      skippedEvents.push({
        reason: "unchanged",
        event_type: "treasury_operational_note",
        title: "No material monitoring transition",
      });
    }

    const monitoringSummary = {
      operatingState: curr.operatingState,
      attentionLevel: curr.attentionLevel,
      emittedCount: emittedEvents.length,
      skippedCount: skippedEvents.length,
      posturePhrase: buildMonitoringPosturePhrase(curr.operatingState, curr.attentionLevel),
      fingerprint,
      alertReadinessStatus: alertReadiness.alertReadinessStatus,
      alertPosture: alertReadiness.alertPosture,
      recommendedAlertChannel: alertReadiness.recommendedAlertChannel,
      notificationReadinessStatus: notificationReadiness.notificationReadinessStatus,
      recommendedNotificationPosture: notificationReadiness.recommendedNotificationPosture,
      digestReadiness: digestReadinessMeta,
    };

    return {
      emittedEvents,
      skippedEvents,
      monitoringSummary,
      nextState: {
        ...curr,
        fingerprint,
        treasuryWatchFlags: curr.watchFlags,
      },
    };
  } catch (err) {
    warn({ op: "emitTreasuryMonitoringEvents", err: err?.message || String(err) });
    return {
      emittedEvents: [],
      skippedEvents: [{ reason: "error", event_type: "treasury_operational_note", title: "Emission failed safely" }],
      monitoringSummary: {
        operatingState: "normal_monitoring",
        attentionLevel: "low",
        emittedCount: 0,
        skippedCount: 1,
        posturePhrase: "Monitoring unavailable",
      },
      nextState: previousState || null,
    };
  }
}

const EMPTY_ALERT_READINESS = Object.freeze({
  alertReadinessStatus: "quiet",
  alertPosture: "no_alert",
  alertPriority: "low",
  alertWorthySignals: [],
  suppressedSignals: [],
  escalationReasons: [],
  recommendedAlertChannel: "none",
  confidence: 0,
  summary: "Treasury alert readiness unavailable — advisory monitoring only.",
});

const ALERT_PRIORITY_ORDER = Object.freeze(["low", "moderate", "elevated", "high"]);

function downgradeAlertPriorityOneNotch(priority) {
  const idx = ALERT_PRIORITY_ORDER.indexOf(String(priority || "low").toLowerCase());
  return idx <= 0 ? "low" : ALERT_PRIORITY_ORDER[idx - 1];
}

function channelForSeverity(severity, isSmallDollar) {
  const sev = normalizeSeverity(severity);
  if (sev === "high" || sev === "elevated") {
    return isSmallDollar ? "in_app_admin" : "admin_digest";
  }
  if (sev === "moderate") return "in_app_admin";
  return "none";
}

function mapReadinessToPosture(status) {
  const key = String(status || "quiet").toLowerCase();
  if (key === "escalation_recommended") return "prepare_escalation";
  if (key === "ready_to_alert") return "prepare_admin_alert";
  if (key === "watch") return "monitor_only";
  return "no_alert";
}

function deriveRecommendedChannel({ alertReadinessStatus, alertWorthyCount, isSmallDollar }) {
  const status = String(alertReadinessStatus || "quiet").toLowerCase();
  if (status === "escalation_recommended") return "future_email";
  if (status === "ready_to_alert") {
    if (alertWorthyCount >= 2) return "admin_digest";
    return "in_app_admin";
  }
  if (status === "watch") return "in_app_admin";
  if (isSmallDollar && alertWorthyCount === 0) return "none";
  return "none";
}

function buildAlertReadinessSummary({
  alertReadinessStatus,
  alertPosture,
  recommendedAlertChannel,
  alertWorthyCount,
  suppressedCount,
  isSmallDollar,
  operatingState,
  attentionLevel,
}) {
  const statusPhrase = {
    quiet: "Treasury conditions are stable with no alert-worthy signals requiring admin notification.",
    watch: "Treasury remains under routine observation with moderate watch items — continue advisory monitoring.",
    ready_to_alert: "Multiple treasury signals suggest preparing an in-app admin alert for leadership visibility.",
    escalation_recommended:
      "Elevated treasury posture warrants preparing an escalation path — future email channel only; no notifications sent.",
  };
  let base =
    statusPhrase[String(alertReadinessStatus || "quiet").toLowerCase()] ||
    statusPhrase.quiet;
  if (alertWorthyCount > 0) {
    base += ` ${alertWorthyCount} alert-worthy signal${alertWorthyCount === 1 ? "" : "s"} identified.`;
  }
  if (suppressedCount > 0) {
    base += ` ${suppressedCount} signal${suppressedCount === 1 ? " was" : "s were"} suppressed as low-materiality noise.`;
  }
  const channelNote = {
    none: "No alert channel recommended at this time.",
    in_app_admin: "Recommended preparation: in-app admin visibility only.",
    admin_digest: "Recommended preparation: admin digest grouping for multiple signals.",
    future_email: "Recommended preparation: future email escalation path (not implemented — advisory label only).",
  };
  base += ` ${channelNote[String(recommendedAlertChannel || "none").toLowerCase()] || channelNote.none}`;
  if (isSmallDollar) {
    base +=
      " Soft-launch treasury environment detected; alert readiness remains advisory.";
  }
  base += ` Current posture: ${String(operatingState || "normal_monitoring").replace(/_/g, " ")} with ${attentionLevel || "low"} attention.`;
  if (String(alertPosture || "").includes("prepare")) {
    base += " No notifications have been sent.";
  }
  return base.trim();
}

/**
 * Pure advisory synthesis — assess alert readiness from existing treasury signals.
 * READ-ONLY: no notifications, no DB writes, no financial mutations.
 * @param {object} args
 */
export function assessTreasuryAlertReadiness({
  treasuryOperationsState = {},
  emittedMonitoringSummary = null,
  treasuryCommandCenter = {},
  readinessIndex = {},
  classifiedAlerts = {},
  operationalGuidance = {},
  driftDetection = {},
  stability = {},
  scalingReadiness = {},
  governance = {},
  operatingMode = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const ops = treasuryOperationsState || {};
    const operatingState = String(ops.operatingState || "normal_monitoring").toLowerCase();
    const attentionLevel = String(ops.treasuryAttentionLevel || "low").toLowerCase();
    const watchFlags = uniqueStrings((ops.treasuryWatchFlags || []).map(String));
    const monitoringSignals = uniqueStrings((ops.treasuryMonitoringSignals || []).map(String));

    const commandStatus = String(treasuryCommandCenter.treasuryCommandStatus || "monitored").toLowerCase();
    const alertPriorityRaw = String(classifiedAlerts.alertPriority || "low").toLowerCase();
    const driftStatus = String(driftDetection.driftStatus || "unchanged").toLowerCase();
    const operationalStatus = String(operationalGuidance.operationalStatus || "monitor").toLowerCase();
    const launchCondition = String(readinessIndex.treasuryLaunchCondition || "").toLowerCase();
    const launchSignal = String(readinessIndex.treasuryLaunchSignal || "").toLowerCase();
    const stabilityLevel = String(stability.stabilityLevel || "").toLowerCase();
    const operatingModeLevel = String(
      operatingMode.operatingMode || operatingMode.mode || operatingMode.treasuryOperatingMode || "",
    ).toLowerCase();
    const scalingLevel = String(
      scalingReadiness.scalingReadiness || scalingReadiness.readinessLevel || "",
    ).toLowerCase();

    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const emissionSkippedUnchanged =
      emittedMonitoringSummary?.skippedCount > 0 &&
      emittedMonitoringSummary?.emittedCount === 0 &&
      String(emittedMonitoringSummary?.posturePhrase || "").toLowerCase().includes("monitoring");

    const alertWorthySignals = [];
    const suppressedSignals = [];
    const escalationReasons = [];

    for (const concern of treasuryCommandCenter.concerns || []) {
      const title = String(concern || "").trim();
      if (!title) continue;
      if (isSmallDollar && title.toLowerCase().includes("soft-launch")) {
        suppressedSignals.push({
          title,
          reason: "Small-dollar advisory signal — suppressed at soft-launch materiality.",
        });
        continue;
      }
      alertWorthySignals.push({
        severity: commandStatus === "active_review" ? "elevated" : "moderate",
        title,
        reason: "Command center concern requiring leadership visibility.",
        suggestedChannel: "in_app_admin",
      });
    }

    for (const area of treasuryCommandCenter.watchAreas || []) {
      const title = String(area || "").trim();
      if (!title) continue;
      alertWorthySignals.push({
        severity: "moderate",
        title,
        reason: "Command center watch area under active observation.",
        suggestedChannel: "in_app_admin",
      });
    }

    for (const flag of watchFlags) {
      if (isSmallDollar && /soft-launch|interpret cautiously/i.test(flag)) {
        suppressedSignals.push({
          title: flag,
          reason: "Small-dollar advisory watch flag — downgraded at soft-launch scale.",
        });
        continue;
      }
      alertWorthySignals.push({
        severity: attentionLevel === "high" ? "elevated" : "moderate",
        title: flag,
        reason: "Operational watch flag from treasury monitoring synthesis.",
        suggestedChannel: "in_app_admin",
      });
    }

    if (driftStatus === "meaningful_shift") {
      alertWorthySignals.push({
        severity: isSmallDollar ? "moderate" : "elevated",
        title: "Meaningful treasury drift detected",
        reason: "Drift detection reports a meaningful shift since prior snapshot.",
        suggestedChannel: isSmallDollar ? "in_app_admin" : "admin_digest",
      });
    } else if (driftStatus === "moderate_shift") {
      alertWorthySignals.push({
        severity: "moderate",
        title: "Moderate treasury drift detected",
        reason: "Drift detection reports a moderate shift — continue observation.",
        suggestedChannel: "in_app_admin",
      });
    }

    for (const alert of classifiedAlerts.classifiedAlerts || []) {
      if (!alert?.title) continue;
      const pri = String(alert.priority || alert.severity || alertPriorityRaw).toLowerCase();
      if (pri === "info" || pri === "low") {
        suppressedSignals.push({
          title: alert.title,
          reason: "Low-materiality classified alert — informational only.",
        });
        continue;
      }
      alertWorthySignals.push({
        severity: pri === "high" ? "high" : pri === "elevated" ? "elevated" : "moderate",
        title: alert.title,
        reason: alert.reason || alert.description || "Classified treasury alert pattern.",
        suggestedChannel: channelForSeverity(pri, isSmallDollar),
      });
    }

    if (
      launchCondition &&
      isLevelIn(launchCondition, ["watch", "caution", "critical", "not_ready"])
    ) {
      alertWorthySignals.push({
        severity: launchCondition === "critical" || launchCondition === "not_ready" ? "elevated" : "moderate",
        title: `Readiness launch condition: ${launchCondition.replace(/_/g, " ")}`,
        reason: launchSignal
          ? `Launch signal: ${launchSignal.replace(/_/g, " ")}.`
          : "Treasury readiness index indicates degraded launch posture.",
        suggestedChannel: "in_app_admin",
      });
    }

    if (isLevelIn(stabilityLevel, ["weakening", "unstable"])) {
      alertWorthySignals.push({
        severity: stabilityLevel === "unstable" ? "elevated" : "moderate",
        title: `Treasury stability: ${stabilityLevel.replace(/_/g, " ")}`,
        reason: "Stability assessment indicates weakening treasury resilience.",
        suggestedChannel: "in_app_admin",
      });
    }

    if (operatingModeLevel && isLevelIn(operatingModeLevel, ["elevated", "restricted", "critical"])) {
      alertWorthySignals.push({
        severity: operatingModeLevel === "critical" ? "high" : "elevated",
        title: `Operating mode: ${operatingModeLevel.replace(/_/g, " ")}`,
        reason: "Treasury operating mode suggests elevated administrative attention.",
        suggestedChannel: "admin_digest",
      });
    }

    if (emittedMonitoringSummary?.emittedCount > 0) {
      alertWorthySignals.push({
        severity: baseSeverityFromContext({ operatingState, attentionLevel, watchFlagCount: watchFlags.length }),
        title: "New treasury monitoring events emitted",
        reason: `${emittedMonitoringSummary.emittedCount} monitoring event${emittedMonitoringSummary.emittedCount === 1 ? "" : "s"} logged this cycle — ${emittedMonitoringSummary.posturePhrase || "posture updated"}.`,
        suggestedChannel: "in_app_admin",
      });
    }

    if (emissionSkippedUnchanged) {
      suppressedSignals.push({
        title: "Unchanged monitoring posture",
        reason: "Duplicate or unchanged monitoring fingerprint — no new material transition.",
      });
    }

    if (commandStatus === "stable" && alertPriorityRaw === "low" && driftStatus === "unchanged") {
      for (const sig of monitoringSignals) {
        if (/stable posture/i.test(sig)) {
          suppressedSignals.push({
            title: sig.slice(0, 120),
            reason: "Repeated stable alert with no worsening — informational only.",
          });
        }
      }
    }

    if (operationalStatus === "healthy" || operationalStatus === "monitor") {
      for (const sig of monitoringSignals.filter((s) => /routine|stable/i.test(s))) {
        const already = suppressedSignals.some((x) => x.title === sig.slice(0, 120));
        if (!already && alertWorthySignals.length === 0) {
          suppressedSignals.push({
            title: sig.slice(0, 120),
            reason: "Low-materiality informational monitoring signal.",
          });
        }
      }
    }

    const dedupedWorthy = [];
    const seenWorthy = new Set();
    for (const item of alertWorthySignals) {
      const key = `${item.title}::${item.severity}`;
      if (seenWorthy.has(key)) continue;
      seenWorthy.add(key);
      dedupedWorthy.push(item);
    }

    let alertPriority = alertPriorityRaw;
    if (dedupedWorthy.some((s) => s.severity === "high")) alertPriority = "high";
    else if (dedupedWorthy.some((s) => s.severity === "elevated") || alertPriorityRaw === "elevated") {
      alertPriority = "elevated";
    } else if (dedupedWorthy.length >= 2 || attentionLevel === "moderate") alertPriority = "moderate";
    else if (alertPriority === "low" && dedupedWorthy.length === 1) alertPriority = "moderate";

    let alertReadinessStatus = "quiet";
    const elevatedSignalCount = dedupedWorthy.filter((s) =>
      isLevelIn(s.severity, ["elevated", "high"]),
    ).length;

    if (
      alertPriority === "high" ||
      commandStatus === "active_review" ||
      attentionLevel === "high" ||
      operatingState === "review_attention" ||
      (elevatedSignalCount >= 2 && attentionLevel === "elevated")
    ) {
      alertReadinessStatus = "escalation_recommended";
      if (commandStatus === "active_review") {
        escalationReasons.push("Treasury command center in active review posture.");
      }
      if (alertPriority === "high") {
        escalationReasons.push("Classified alert priority is high.");
      }
      if (attentionLevel === "high") {
        escalationReasons.push("Treasury attention level is high.");
      }
      if (elevatedSignalCount >= 2) {
        escalationReasons.push(`${elevatedSignalCount} elevated alert-worthy signals present.`);
      }
    } else if (
      operatingState === "elevated_monitoring" ||
      attentionLevel === "elevated" ||
      driftStatus === "meaningful_shift" ||
      alertPriority === "elevated" ||
      isLevelIn(operatingModeLevel, ["elevated", "restricted"]) ||
      isLevelIn(launchCondition, ["watch", "caution", "critical", "not_ready"]) ||
      dedupedWorthy.length >= 2
    ) {
      alertReadinessStatus = "ready_to_alert";
    } else if (
      watchFlags.length >= 2 ||
      attentionLevel === "moderate" ||
      alertPriority === "moderate" ||
      driftStatus === "moderate_shift" ||
      dedupedWorthy.length === 1 ||
      commandStatus === "monitored"
    ) {
      alertReadinessStatus = "watch";
    }

    if (isSmallDollar) {
      alertPriority = downgradeAlertPriorityOneNotch(alertPriority);
      if (alertReadinessStatus === "escalation_recommended" && elevatedSignalCount < 2) {
        alertReadinessStatus = "ready_to_alert";
      }
      if (alertReadinessStatus === "ready_to_alert" && elevatedSignalCount === 0 && dedupedWorthy.length <= 1) {
        alertReadinessStatus = "watch";
      }
      if (alertReadinessStatus === "watch" && dedupedWorthy.length === 0 && watchFlags.length <= 1) {
        alertReadinessStatus = "quiet";
      }
    }

    const alertPosture = mapReadinessToPosture(alertReadinessStatus);
    const recommendedAlertChannel = deriveRecommendedChannel({
      alertReadinessStatus,
      alertWorthyCount: dedupedWorthy.length,
      isSmallDollar,
    });

    const confidence = clamp(
      Math.round(
        (ops.confidence || 0) * 0.55 +
          (Number(treasuryCommandCenter.confidence) || 0) * 0.15 +
          (Number(classifiedAlerts.confidence) || 0) * 0.15 +
          (Number(driftDetection.confidence) || 0) * 0.15,
      ),
      0,
      100,
    );

    const summary = buildAlertReadinessSummary({
      alertReadinessStatus,
      alertPosture,
      recommendedAlertChannel,
      alertWorthyCount: dedupedWorthy.length,
      suppressedCount: suppressedSignals.length,
      isSmallDollar,
      operatingState,
      attentionLevel,
    });

    return {
      alertReadinessStatus,
      alertPosture,
      alertPriority,
      alertWorthySignals: dedupedWorthy.slice(0, 12),
      suppressedSignals: suppressedSignals.slice(0, 12),
      escalationReasons: uniqueStrings(escalationReasons).slice(0, 8),
      recommendedAlertChannel,
      confidence: isSmallDollar ? Math.min(confidence, 85) : confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "assessTreasuryAlertReadiness", err: err?.message || String(err) });
    return { ...EMPTY_ALERT_READINESS };
  }
}

function baseSeverityFromContext({ operatingState, attentionLevel, watchFlagCount }) {
  return severityForMonitoringContext({
    operatingState,
    attentionLevel,
    watchFlagCount,
    isSmallDollar: false,
  });
}

export function formatAlertReadinessChipLabel(assessment) {
  const status = String(assessment?.alertReadinessStatus || "quiet").toLowerCase();
  const labels = {
    quiet: "Treasury alerts: Quiet",
    watch: "Treasury alerts: Watch",
    ready_to_alert: "Treasury alerts: Ready to alert",
    escalation_recommended: "Treasury alerts: Escalation recommended",
  };
  return labels[status] || labels.quiet;
}

export function formatTreasuryMonitoringChipLabel({ operatingState, treasuryAttentionLevel } = {}) {
  const attention = String(treasuryAttentionLevel || "low").toLowerCase();
  const state = String(operatingState || "normal_monitoring").toLowerCase();

  if (state === "review_attention" || attention === "high") {
    return "Treasury: Review attention";
  }
  if (state === "elevated_monitoring" || attention === "elevated") {
    return "Treasury: Elevated attention";
  }
  if (attention === "moderate") {
    return "Treasury: Active monitoring";
  }
  return "Treasury: Stable monitoring";
}

/**
 * Lightweight admin home chip — reads latest operational event metadata (fail-open).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
/** @type {Map<string, { emittedAt: number; fingerprint: string }>} */
const adminAlertDedupCache = new Map();

const ADMIN_ALERT_STATUSES = new Set(["monitoring", "review", "elevated_attention"]);
const ADMIN_ALERT_POSTURES = new Set(["quiet", "monitoring", "elevated_attention", "active_review"]);

function slugifyAlertId(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function mapReadinessStatusToAdminPosture(status) {
  const key = String(status || "quiet").toLowerCase();
  if (key === "escalation_recommended") return "active_review";
  if (key === "ready_to_alert") return "elevated_attention";
  if (key === "watch") return "monitoring";
  return "quiet";
}

function deriveAdminAlertStatus(severity, readinessStatus) {
  const sev = normalizeSeverity(severity);
  const readiness = String(readinessStatus || "quiet").toLowerCase();
  if (readiness === "escalation_recommended" || sev === "high") return "review";
  if (readiness === "ready_to_alert" || sev === "elevated") return "elevated_attention";
  return "monitoring";
}

function softenAdminAlertFields({ title, summary, recommendation, isSmallDollar }) {
  let t = String(title || "").trim();
  let s = String(summary || "").trim();
  let r = String(recommendation || "").trim();
  if (isSmallDollar) {
    t = formatSoftLaunchTitle(t, true);
    s = softenText(s, true);
    r = softenText(r, true);
  }
  return { title: t, summary: s, recommendation: r };
}

function shouldSkipAdminAlertDedup(alertId, fingerprint) {
  const key = alertId || fingerprint;
  if (!key) return { skip: false, key: "" };
  const entry = adminAlertDedupCache.get(key);
  const now = Date.now();
  if (!entry) return { skip: false, key };
  if (entry.fingerprint === fingerprint && now - entry.emittedAt < DEDUP_WINDOW_MS) {
    return { skip: true, key, reason: "duplicate_within_window" };
  }
  if (entry.fingerprint === fingerprint) {
    return { skip: true, key, reason: "unchanged_fingerprint" };
  }
  return { skip: false, key };
}

function recordAdminAlertDedup(key, fingerprint) {
  if (!key) return;
  adminAlertDedupCache.set(key, { emittedAt: Date.now(), fingerprint });
}

/** Reset in-memory admin alert dedup cache (tests / manual refresh). */
export function resetTreasuryAdminAlertDedupCache() {
  adminAlertDedupCache.clear();
}

/** @returns {Array<{ key: string; emittedAt: number; fingerprint: string }>} */
export function readTreasuryAdminAlertDedupCache() {
  return [...adminAlertDedupCache.entries()].map(([key, v]) => ({
    key,
    emittedAt: v.emittedAt,
    fingerprint: v.fingerprint,
  }));
}

/**
 * Stable fingerprint for admin alert set dedup (page useRef storage).
 * @param {Array<{ id?: string; severity?: string; status?: string }>} alerts
 */
export function buildTreasuryAdminAlertFingerprint(alerts) {
  const parts = (alerts || [])
    .map((a) => `${a.id || ""}:${normalizeSeverity(a.severity)}:${a.status || ""}`)
    .sort();
  return parts.join("|");
}

function emptyAlertCounts() {
  return {
    total: 0,
    bySeverity: { info: 0, low: 0, moderate: 0, elevated: 0, high: 0 },
    byStatus: { monitoring: 0, review: 0, elevated_attention: 0 },
  };
}

function computeAlertCounts(alerts) {
  const counts = emptyAlertCounts();
  for (const alert of alerts || []) {
    counts.total += 1;
    const sev = normalizeSeverity(alert.severity);
    if (counts.bySeverity[sev] != null) counts.bySeverity[sev] += 1;
    const st = String(alert.status || "monitoring").toLowerCase();
    if (counts.byStatus[st] != null) counts.byStatus[st] += 1;
  }
  return counts;
}

function buildAdminAlertSummary(alertPosture, alerts, isSmallDollar) {
  const total = (alerts || []).length;
  const elevatedCount = (alerts || []).filter((a) =>
    isLevelIn(a.severity, ["elevated", "high"]),
  ).length;

  if (total === 0 || alertPosture === "quiet") {
    return isSmallDollar
      ? "Treasury advisory posture is quiet at soft-launch scale — routine monitoring recommended."
      : "Treasury advisory posture is quiet — routine monitoring recommended.";
  }

  const posturePhrases = {
    monitoring: "Treasury remains under advisory monitoring.",
    elevated_attention: "Treasury readiness suggests elevated administrative attention.",
    active_review: "Treasury signals warrant active leadership review — advisory only.",
  };
  let base = posturePhrases[alertPosture] || posturePhrases.monitoring;
  base += ` ${total} advisory alert${total === 1 ? "" : "s"} surfaced`;
  if (elevatedCount > 0) {
    base += ` (${elevatedCount} elevated)`;
  }
  base += ".";
  if (isSmallDollar) {
    base += " Interpret cautiously at soft-launch dollar levels.";
  }
  return base;
}

function finalizeAdminAlerts(alerts, { alertPosture, isSmallDollar, previousAlertFingerprint }) {
  const sorted = [...alerts].sort(
    (a, b) => rankSeverity(b.severity) - rankSeverity(a.severity) || a.title.localeCompare(b.title),
  );

  const seen = new Set();
  const unique = [];
  for (const alert of sorted) {
    const key = alert.id || `${alert.title}:${alert.severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(alert);
  }

  const fingerprint = buildTreasuryAdminAlertFingerprint(unique);
  const unchanged = Boolean(previousAlertFingerprint && previousAlertFingerprint === fingerprint);

  for (const alert of unique) {
    const fp = `${alert.id}:${alert.severity}:${alert.status}`;
    const dedup = shouldSkipAdminAlertDedup(alert.id, fp);
    if (!dedup.skip) {
      recordAdminAlertDedup(dedup.key, fp);
    }
  }

  const posture = ADMIN_ALERT_POSTURES.has(alertPosture) ? alertPosture : "monitoring";

  return {
    treasuryAdminAlerts: unique,
    alertSummary: buildAdminAlertSummary(posture, unique, isSmallDollar),
    alertCounts: computeAlertCounts(unique),
    alertPosture: posture,
    fingerprint,
    unchanged,
  };
}

function makeAdminAlert({
  idBase,
  severity,
  title,
  summary,
  recommendation,
  status,
  readinessStatus,
  isSmallDollar,
}) {
  const sev = isSmallDollar ? downgradeSeverityOneNotch(severity) : normalizeSeverity(severity);
  const st = status || deriveAdminAlertStatus(sev, readinessStatus);
  const normalizedStatus = ADMIN_ALERT_STATUSES.has(st) ? st : "monitoring";
  const softened = softenAdminAlertFields({ title, summary, recommendation, isSmallDollar });
  const fp = slugifyAlertId(idBase || softened.title);
  return {
    id: `treasury-${fp}-${sev}`,
    severity: sev,
    title: softened.title,
    summary: softened.summary,
    recommendation: softened.recommendation,
    status: normalizedStatus,
    createdAt: new Date().toISOString(),
    advisoryOnly: true,
  };
}

/**
 * Lightweight reconstruction from latest operational event metadata (admin home).
 * @param {Record<string, unknown>} metadata
 */
export function buildTreasuryAdminAlertsFromMetadata(metadata = {}) {
  try {
    const meta = metadata && typeof metadata === "object" ? metadata : {};
    const isSmallDollar = meta.isSmallDollar === true;
    const readinessStatus = String(meta.alertReadinessStatus || "quiet").toLowerCase();
    let alertPosture = mapReadinessStatusToAdminPosture(readinessStatus);
    const commandStatus = String(meta.commandStatus || "").toLowerCase();
    const driftStatus = String(meta.driftStatus || "unchanged").toLowerCase();
    const watchFlagCount = toFiniteNumber(meta.watchFlagCount);
    const attentionLevel = String(meta.treasuryAttentionLevel || "low").toLowerCase();
    const operatingState = String(meta.operatingState || "normal_monitoring").toLowerCase();

    if (commandStatus === "active_review") alertPosture = "active_review";
    else if (commandStatus === "elevated_attention" && alertPosture === "quiet") {
      alertPosture = "monitoring";
    }

    const alerts = [];
    const now = new Date().toISOString();

    if (readinessStatus === "escalation_recommended") {
      alerts.push(
        makeAdminAlert({
          idBase: "readiness-escalation",
          severity: isSmallDollar ? "elevated" : "high",
          title: "Treasury escalation review recommended",
          summary:
            "Multiple treasury signals suggest preparing leadership review — advisory in-app visibility only.",
          recommendation: "Schedule a treasury leadership check-in. No automated actions or notifications.",
          status: "review",
          readinessStatus,
          isSmallDollar,
        }),
      );
    } else if (readinessStatus === "ready_to_alert") {
      alerts.push(
        makeAdminAlert({
          idBase: "readiness-elevated",
          severity: "elevated",
          title: "Treasury readiness warrants admin attention",
          summary: "Treasury readiness softened under elevated monitoring posture.",
          recommendation: "Review treasury intelligence dashboard for consolidated signals.",
          status: "elevated_attention",
          readinessStatus,
          isSmallDollar,
        }),
      );
    }

    if (commandStatus === "elevated_attention" || commandStatus === "active_review") {
      alerts.push(
        makeAdminAlert({
          idBase: `command-${commandStatus}`,
          severity: commandStatus === "active_review" ? "elevated" : "moderate",
          title:
            commandStatus === "active_review"
              ? "Treasury command center active review"
              : "Treasury command center elevated attention",
          summary: `Command center posture is ${commandStatus.replace(/_/g, " ")} — observational advisory only.`,
          recommendation: "Review command center summary and watch flags on Treasury Intelligence.",
          status: commandStatus === "active_review" ? "review" : "elevated_attention",
          readinessStatus,
          isSmallDollar,
        }),
      );
    }

    if (DRIFT_MATERIAL.has(driftStatus)) {
      alerts.push(
        makeAdminAlert({
          idBase: `drift-${driftStatus}`,
          severity: driftStatus === "meaningful_shift" ? "elevated" : "moderate",
          title:
            driftStatus === "meaningful_shift"
              ? "Meaningful treasury drift observed"
              : "Moderate treasury drift observed",
          summary: `Drift detection reports ${driftStatus.replace(/_/g, " ")} since prior snapshot.`,
          recommendation: "Compare drift drivers and stability indicators — advisory monitoring only.",
          readinessStatus,
          isSmallDollar,
        }),
      );
    }

    if (watchFlagCount >= 3) {
      alerts.push(
        makeAdminAlert({
          idBase: "repeated-watch-flags",
          severity: watchFlagCount >= 5 ? "elevated" : "moderate",
          title: "Repeated treasury watch flags",
          summary: `${watchFlagCount} watch flags active across treasury monitoring synthesis.`,
          recommendation: "Review watch flag list for recurring themes — no automated treasury actions.",
          readinessStatus,
          isSmallDollar,
        }),
      );
    }

    if (
      attentionLevel === "high" ||
      operatingState === "review_attention" ||
      attentionLevel === "elevated"
    ) {
      alerts.push(
        makeAdminAlert({
          idBase: `attention-${attentionLevel}-${operatingState}`,
          severity: attentionLevel === "high" ? "elevated" : "moderate",
          title: "Treasury attention level elevated",
          summary: `Operating state ${operatingState.replace(/_/g, " ")} with ${attentionLevel} attention.`,
          recommendation: "Continue advisory monitoring and leadership visibility as appropriate.",
          readinessStatus,
          isSmallDollar,
        }),
      );
    }

    const seen = new Set();
    const unique = [];
    for (const a of alerts) {
      if (seen.has(a.id)) continue;
      seen.add(a.id);
      unique.push({ ...a, createdAt: now });
    }

    if (unique.length === 0 && alertPosture === "quiet") {
      return {
        treasuryAdminAlerts: [],
        alertSummary: buildAdminAlertSummary("quiet", [], isSmallDollar),
        alertCounts: emptyAlertCounts(),
        alertPosture: "quiet",
        fingerprint: "",
      };
    }

    return finalizeAdminAlerts(unique, { alertPosture, isSmallDollar, previousAlertFingerprint: null });
  } catch (err) {
    warn({ op: "buildTreasuryAdminAlertsFromMetadata", err: err?.message || String(err) });
    return {
      treasuryAdminAlerts: [],
      alertSummary: "Treasury admin alerts unavailable — advisory monitoring only.",
      alertCounts: emptyAlertCounts(),
      alertPosture: "quiet",
      fingerprint: "",
    };
  }
}

/**
 * Pure advisory admin alert synthesis — in-app display only.
 * READ-ONLY: no notifications, no DB writes, no financial mutations.
 * @param {object} args
 */
export function buildTreasuryAdminAlerts({
  treasuryAlertReadiness = {},
  emittedMonitoringSummary = null,
  operationalGuidance = {},
  classifiedAlerts = {},
  treasuryOperationsState = {},
  readinessIndex = {},
  treasuryCommandCenter = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
  driftDetection = {},
  previousAlertFingerprint = null,
} = {}) {
  try {
    const readiness = treasuryAlertReadiness || EMPTY_ALERT_READINESS;
    const readinessStatus = String(readiness.alertReadinessStatus || "quiet").toLowerCase();
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const commandStatus = String(treasuryCommandCenter.treasuryCommandStatus || "monitored").toLowerCase();
    const driftStatus = String(driftDetection.driftStatus || "unchanged").toLowerCase();
    const watchFlags = uniqueStrings((treasuryOperationsState.treasuryWatchFlags || []).map(String));
    const launchSignal = String(readinessIndex.treasuryLaunchSignal || "").toLowerCase();
    const launchCondition = String(readinessIndex.treasuryLaunchCondition || "").toLowerCase();
    const operatingState = String(treasuryOperationsState.operatingState || "normal_monitoring").toLowerCase();
    const attentionLevel = String(treasuryOperationsState.treasuryAttentionLevel || "low").toLowerCase();

    let alertPosture = mapReadinessStatusToAdminPosture(readinessStatus);
    if (commandStatus === "active_review") alertPosture = "active_review";
    else if (commandStatus === "elevated_attention") {
      if (alertPosture === "quiet") alertPosture = "monitoring";
      if (readinessStatus === "ready_to_alert") alertPosture = "elevated_attention";
    }

    const alerts = [];

    if (readiness.escalationReasons?.length > 0 && readinessStatus === "escalation_recommended") {
      alerts.push(
        makeAdminAlert({
          idBase: "escalation-reasons",
          severity: isSmallDollar ? "elevated" : "high",
          title: "Treasury escalation review recommended",
          summary: readiness.escalationReasons.slice(0, 2).join(" "),
          recommendation:
            "Prepare leadership treasury review — advisory in-app visibility only. No notifications sent.",
          status: "review",
          readinessStatus,
          isSmallDollar,
        }),
      );
    }

    for (const signal of readiness.alertWorthySignals || []) {
      const title = String(signal.title || "").trim();
      if (!title) continue;
      if (isSmallDollar && /soft-launch|interpret cautiously|stable posture/i.test(title)) continue;

      alerts.push(
        makeAdminAlert({
          idBase: slugifyAlertId(title),
          severity: signal.severity || "moderate",
          title,
          summary: String(signal.reason || "Treasury signal warrants administrative visibility."),
          recommendation: "Review on Treasury Intelligence — observational advisory only.",
          readinessStatus,
          isSmallDollar,
        }),
      );
    }

    if (
      launchCondition &&
      isLevelIn(launchCondition, ["watch", "caution", "critical", "not_ready"]) &&
      !alerts.some((a) => a.title.toLowerCase().includes("launch condition"))
    ) {
      alerts.push(
        makeAdminAlert({
          idBase: `launch-${launchCondition}`,
          severity:
            launchCondition === "critical" || launchCondition === "not_ready" ? "elevated" : "moderate",
          title: `Treasury readiness launch condition: ${launchCondition.replace(/_/g, " ")}`,
          summary: launchSignal
            ? `Launch signal: ${launchSignal.replace(/_/g, " ")}.`
            : "Readiness index indicates degraded launch posture under monitoring.",
          recommendation: "Review readiness index recommendations — no automated treasury actions.",
          readinessStatus,
          isSmallDollar,
        }),
      );
    }

    if (DRIFT_MATERIAL.has(driftStatus) && !alerts.some((a) => a.title.toLowerCase().includes("drift"))) {
      alerts.push(
        makeAdminAlert({
          idBase: `drift-${driftStatus}`,
          severity: driftStatus === "meaningful_shift" ? "elevated" : "moderate",
          title:
            driftStatus === "meaningful_shift"
              ? "Meaningful treasury drift detected"
              : "Moderate treasury drift detected",
          summary: "Drift detection reports a material shift since prior treasury snapshot.",
          recommendation: "Compare drift drivers on Treasury Intelligence — advisory monitoring only.",
          readinessStatus,
          isSmallDollar,
        }),
      );
    }

    if (watchFlags.length >= 3 && !alerts.some((a) => a.id.includes("repeated-watch"))) {
      alerts.push(
        makeAdminAlert({
          idBase: "repeated-watch-flags",
          severity: watchFlags.length >= 5 ? "elevated" : "moderate",
          title: "Repeated treasury watch flags",
          summary: `${watchFlags.length} watch flags active: ${watchFlags.slice(0, 2).join("; ")}${watchFlags.length > 2 ? "…" : ""}.`,
          recommendation: "Review recurring watch themes — routine monitoring recommended unless posture worsens.",
          readinessStatus,
          isSmallDollar,
        }),
      );
    }

    if (
      (commandStatus === "elevated_attention" || commandStatus === "active_review") &&
      !alerts.some((a) => a.id.includes("command-"))
    ) {
      alerts.push(
        makeAdminAlert({
          idBase: `command-${commandStatus}`,
          severity: commandStatus === "active_review" ? "elevated" : "moderate",
          title:
            commandStatus === "active_review"
              ? "Treasury command center active review"
              : "Treasury command center elevated attention",
          summary: treasuryCommandCenter.summary
            ? String(treasuryCommandCenter.summary).slice(0, 240)
            : `Command center posture is ${commandStatus.replace(/_/g, " ")}.`,
          recommendation: "Review command center executive actions and concerns — advisory only.",
          status: commandStatus === "active_review" ? "review" : "elevated_attention",
          readinessStatus,
          isSmallDollar,
        }),
      );
    }

    if (
      emittedMonitoringSummary?.emittedCount > 0 &&
      !isSmallDollar &&
      readinessStatus !== "quiet"
    ) {
      alerts.push(
        makeAdminAlert({
          idBase: `emission-${emittedMonitoringSummary.fingerprint || emittedMonitoringSummary.emittedCount}`,
          severity: severityForMonitoringContext({
            operatingState,
            attentionLevel,
            watchFlagCount: watchFlags.length,
            isSmallDollar,
          }),
          title: "New treasury monitoring events logged",
          summary: `${emittedMonitoringSummary.emittedCount} monitoring event${emittedMonitoringSummary.emittedCount === 1 ? "" : "s"} this cycle — ${emittedMonitoringSummary.posturePhrase || "posture updated"}.`,
          recommendation: "Review recent treasury operational events — append-only advisory log.",
          readinessStatus,
          isSmallDollar,
        }),
      );
    }

    if (
      readinessStatus === "quiet" &&
      alerts.length === 0 &&
      operatingState === "normal_monitoring" &&
      attentionLevel === "low"
    ) {
      return finalizeAdminAlerts([], {
        alertPosture: "quiet",
        isSmallDollar,
        previousAlertFingerprint,
      });
    }

    if (isSmallDollar && alerts.length === 0 && readinessStatus === "watch") {
      alerts.push(
        makeAdminAlert({
          idBase: "soft-launch-watch",
          severity: "info",
          title: "Soft-launch treasury monitoring active",
          summary: "Treasury remains under routine observation at soft-launch dollar levels.",
          recommendation: "Continue routine snapshot cadence — interpret signals cautiously.",
          status: "monitoring",
          readinessStatus,
          isSmallDollar,
        }),
      );
      if (alertPosture === "quiet") alertPosture = "monitoring";
    }

    const seen = new Set();
    const unique = [];
    for (const a of alerts) {
      const key = `${a.id}:${a.severity}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(a);
    }

    const posture = ADMIN_ALERT_POSTURES.has(alertPosture) ? alertPosture : "monitoring";
    return finalizeAdminAlerts(unique, {
      alertPosture: posture,
      isSmallDollar,
      previousAlertFingerprint,
    });
  } catch (err) {
    warn({ op: "buildTreasuryAdminAlerts", err: err?.message || String(err) });
    return {
      treasuryAdminAlerts: [],
      alertSummary: "Treasury admin alerts unavailable — advisory monitoring only.",
      alertCounts: emptyAlertCounts(),
      alertPosture: "quiet",
      fingerprint: "",
    };
  }
}

const EMPTY_NOTIFICATION_READINESS = Object.freeze({
  notificationReadinessStatus: "quiet",
  recommendedNotificationPosture: "none",
  recommendedChannels: ["none"],
  escalationRouting: [],
  digestSuitability: { suitable: false, cadence: "weekly", reasons: [] },
  suppressedNotifications: [],
  notificationConfidence: 0,
  summary: "Treasury notification readiness unavailable — advisory monitoring only.",
});

const NOTIFICATION_STATUS_ORDER = Object.freeze(["quiet", "monitoring", "digest_ready", "escalation_ready"]);

function downgradeNotificationStatusOneNotch(status) {
  const key = String(status || "quiet").toLowerCase();
  const idx = NOTIFICATION_STATUS_ORDER.indexOf(key);
  return idx <= 0 ? "quiet" : NOTIFICATION_STATUS_ORDER[idx - 1];
}

function mapNotificationPostureFromStatus(status) {
  const key = String(status || "quiet").toLowerCase();
  if (key === "escalation_ready") return "prepare_escalation";
  if (key === "digest_ready") return "prepare_digest";
  if (key === "monitoring") return "advisory_only";
  return "none";
}

function mapAlertReadinessToNotificationStatus(alertReadinessStatus, adminAlertResult, treasuryCommandCenter) {
  const alertStatus = String(alertReadinessStatus || "quiet").toLowerCase();
  const adminAlerts = adminAlertResult?.treasuryAdminAlerts || [];
  const adminCount = adminAlerts.length;
  const alertPosture = String(adminAlertResult?.alertPosture || "quiet").toLowerCase();
  const commandStatus = String(treasuryCommandCenter?.treasuryCommandStatus || "monitored").toLowerCase();
  const moderateAdminCount = adminAlerts.filter((a) =>
    isLevelIn(a.severity, ["moderate", "elevated", "high"]),
  ).length;

  if (
    alertStatus === "escalation_recommended" ||
    alertPosture === "active_review" ||
    commandStatus === "active_review"
  ) {
    return "escalation_ready";
  }

  if (
    alertStatus === "ready_to_alert" ||
    adminCount >= 2 ||
    (moderateAdminCount >= 2 && alertStatus === "watch")
  ) {
    return "digest_ready";
  }

  if (
    alertStatus === "watch" ||
    adminCount >= 1 ||
    alertPosture === "monitoring" ||
    commandStatus === "monitored"
  ) {
    return "monitoring";
  }

  if (alertStatus === "quiet" && adminCount === 0 && alertPosture === "quiet") {
    return "quiet";
  }

  return adminCount > 0 ? "monitoring" : "quiet";
}

function deriveRecommendedNotificationChannels({
  notificationReadinessStatus,
  alertReadiness,
  adminAlertResult,
  isSmallDollar,
}) {
  const status = String(notificationReadinessStatus || "quiet").toLowerCase();
  const adminAlerts = adminAlertResult?.treasuryAdminAlerts || [];
  const elevatedCount = adminAlerts.filter((a) => isLevelIn(a.severity, ["elevated", "high"])).length;
  const alertPriority = String(alertReadiness?.alertPriority || "low").toLowerCase();

  if (status === "quiet") {
    return adminAlerts.length > 0 ? ["admin_in_app"] : ["none"];
  }

  if (status === "monitoring") {
    return ["admin_in_app"];
  }

  if (status === "digest_ready") {
    return ["admin_in_app", "executive_digest"];
  }

  if (status === "escalation_ready") {
    const channels = ["admin_in_app", "executive_digest"];
    const allowEmail =
      !isSmallDollar ||
      (elevatedCount >= 2 && alertReadiness?.alertReadinessStatus === "escalation_recommended");
    if (allowEmail) {
      channels.push("future_email");
    }
    if (!isSmallDollar && alertPriority === "high") {
      channels.push("future_sms");
    }
    return uniqueStrings(channels);
  }

  return ["none"];
}

function buildEscalationRouting({
  notificationReadinessStatus,
  alertReadiness,
  adminAlertResult,
  treasuryCommandCenter,
  isSmallDollar,
}) {
  const routes = [];
  const status = String(notificationReadinessStatus || "quiet").toLowerCase();
  const adminCount = (adminAlertResult?.treasuryAdminAlerts || []).length;
  const commandStatus = String(treasuryCommandCenter?.treasuryCommandStatus || "monitored").toLowerCase();

  if (status === "monitoring" || status === "digest_ready" || status === "escalation_ready") {
    routes.push({
      audience: "treasury_admin",
      reason:
        adminCount > 0
          ? `${adminCount} advisory treasury alert${adminCount === 1 ? "" : "s"} warrant in-app admin visibility.`
          : "Routine treasury monitoring posture — in-app admin visibility recommended.",
      urgency: status === "digest_ready" ? "moderate" : "low",
    });
  }

  if (status === "digest_ready") {
    routes.push({
      audience: "operations_lead",
      reason: "Multiple moderate treasury signals suggest preparing a consolidated digest for operations review.",
      urgency: "moderate",
    });
  }

  if (status === "escalation_ready") {
    const urgency =
      alertReadiness?.alertPriority === "high" && !isSmallDollar
        ? "high"
        : alertReadiness?.alertPriority === "elevated"
          ? "elevated"
          : "moderate";
    routes.push({
      audience: "executive_leadership",
      reason:
        commandStatus === "active_review"
          ? "Treasury command center active review — prepare executive leadership visibility (advisory only)."
          : (alertReadiness?.escalationReasons || []).slice(0, 2).join(" ") ||
            "Elevated treasury posture warrants executive leadership review preparation.",
      urgency,
    });
  }

  return routes.slice(0, 6);
}

function buildDigestSuitability({
  notificationReadinessStatus,
  adminAlertResult,
  alertReadiness,
  monitoringSummary,
}) {
  const status = String(notificationReadinessStatus || "quiet").toLowerCase();
  const adminAlerts = adminAlertResult?.treasuryAdminAlerts || [];
  const moderateCount = adminAlerts.filter((a) =>
    isLevelIn(a.severity, ["moderate", "elevated", "high"]),
  ).length;
  const reasons = [];

  const suitable = status === "digest_ready" || moderateCount >= 2;

  if (suitable) {
    reasons.push(`${moderateCount || adminAlerts.length} moderate-or-higher advisory alert(s) present.`);
  }
  if (status === "digest_ready") {
    reasons.push("Notification readiness posture indicates digest preparation is appropriate.");
  }
  if (alertReadiness?.alertReadinessStatus === "ready_to_alert") {
    reasons.push("Alert readiness is ready_to_alert — grouping signals into a digest reduces noise.");
  }
  if (monitoringSummary?.emittedCount > 0) {
    reasons.push(
      `${monitoringSummary.emittedCount} monitoring event${monitoringSummary.emittedCount === 1 ? "" : "s"} logged this cycle.`,
    );
  }
  if (!suitable) {
    reasons.push("Insufficient materiality for digest grouping — continue in-app monitoring.");
  }

  let cadence = "weekly";
  if (status === "escalation_ready") cadence = "on_change";
  else if (status === "digest_ready" || moderateCount >= 3) cadence = "daily";
  else if (status === "monitoring") cadence = "weekly";

  return {
    suitable,
    cadence,
    reasons: uniqueStrings(reasons).slice(0, 6),
  };
}

function buildSuppressedNotifications({
  alertReadiness,
  notificationReadinessStatus,
  recommendedChannels,
  isSmallDollar,
  adminAlertResult,
}) {
  const suppressed = [];

  for (const item of alertReadiness?.suppressedSignals || []) {
    suppressed.push({
      title: String(item.title || "Suppressed signal"),
      reason: String(item.reason || "Low-materiality advisory signal."),
    });
  }

  if (isSmallDollar) {
    if (!recommendedChannels.includes("future_email")) {
      suppressed.push({
        title: "Future email channel",
        reason: "Soft-launch treasury environment — external email preparation suppressed unless multiple elevated signals.",
      });
    }
    suppressed.push({
      title: "Future SMS channel",
      reason: "Soft-launch treasury environment — SMS preparation never recommended at low dollar levels.",
    });
  }

  if (!recommendedChannels.includes("future_email") && !isSmallDollar) {
    suppressed.push({
      title: "Future email channel",
      reason: "Advisory-only phase — external email channel not recommended until escalation_ready posture.",
    });
  }

  if (!recommendedChannels.includes("future_sms")) {
    const alreadySms = suppressed.some((s) => /sms/i.test(s.title));
    if (!alreadySms) {
      suppressed.push({
        title: "Future SMS channel",
        reason:
          notificationReadinessStatus !== "escalation_ready" || isSmallDollar
            ? "SMS preparation reserved for high-priority non-soft-launch escalation only."
            : "Alert priority below high — SMS preparation suppressed.",
      });
    }
  }

  if ((adminAlertResult?.treasuryAdminAlerts || []).length === 0 && alertReadiness?.alertReadinessStatus === "quiet") {
    suppressed.push({
      title: "External notification channels",
      reason: "No meaningful admin alerts — all external channels remain suppressed.",
    });
  }

  suppressed.push({
    title: "All notification delivery",
    reason: "Phase 3F advisory-only — no notifications sent, scheduled, or queued.",
  });

  const seen = new Set();
  const unique = [];
  for (const item of suppressed) {
    const key = `${item.title}::${item.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return unique.slice(0, 12);
}

function deriveNotificationConfidence({
  alertReadiness,
  adminAlertResult,
  monitoringSummary,
  treasuryOperationsState,
  isSmallDollar,
}) {
  const alertConf = Number(alertReadiness?.confidence) || 0;
  const monitoringConf = Number(treasuryOperationsState?.confidence) || 0;
  const adminCount = (adminAlertResult?.treasuryAdminAlerts || []).length;
  const emissionBoost = monitoringSummary?.emittedCount > 0 ? 5 : 0;
  const alertCountBoost = Math.min(adminCount * 3, 12);

  let confidence = Math.round(alertConf * 0.45 + monitoringConf * 0.35 + alertCountBoost + emissionBoost);
  confidence = clamp(confidence, 0, 100);
  if (isSmallDollar) confidence = Math.min(confidence, 82);
  return confidence;
}

function buildNotificationReadinessSummary({
  notificationReadinessStatus,
  recommendedNotificationPosture,
  recommendedChannels,
  adminAlertResult,
  alertReadiness,
  isSmallDollar,
  digestSuitability,
  suppressedCount,
}) {
  const status = String(notificationReadinessStatus || "quiet").toLowerCase();
  const adminCount = (adminAlertResult?.treasuryAdminAlerts || []).length;

  const statusPhrases = {
    quiet:
      "Treasury notification readiness is quiet — stable conditions with no meaningful admin alerts requiring notification preparation.",
    monitoring:
      "Treasury notification readiness is monitoring — routine watch posture with in-app admin visibility as the recommended future channel.",
    digest_ready:
      "Treasury notification readiness is digest-ready — multiple moderate signals suggest preparing a consolidated executive digest (not sent).",
    escalation_ready:
      "Treasury notification readiness is escalation-ready — elevated posture warrants preparing executive routing paths (advisory labels only; nothing dispatched).",
  };

  let base = statusPhrases[status] || statusPhrases.quiet;
  base += ` Recommended posture: ${String(recommendedNotificationPosture || "none").replace(/_/g, " ")}.`;
  if (adminCount > 0) {
    base += ` ${adminCount} advisory admin alert${adminCount === 1 ? "" : "s"} inform channel preparation.`;
  }
  if (recommendedChannels.length > 0 && !(recommendedChannels.length === 1 && recommendedChannels[0] === "none")) {
    base += ` Prepared channels (not sent): ${recommendedChannels.map((c) => c.replace(/_/g, " ")).join(", ")}.`;
  }
  if (digestSuitability?.suitable) {
    base += ` Digest suitability: ${digestSuitability.cadence.replace(/_/g, " ")} cadence recommended.`;
  }
  if (suppressedCount > 0) {
    base += ` ${suppressedCount} notification path${suppressedCount === 1 ? "" : "s"} suppressed pending materiality or advisory-only phase.`;
  }
  if (isSmallDollar) {
    base +=
      " Soft-launch treasury environment detected — notification readiness remains advisory; external channels suppressed unless multiple elevated signals warrant preparation.";
  }
  base += " No notifications have been sent or scheduled.";
  if (alertReadiness?.summary) {
    base += ` Alert readiness context: ${String(alertReadiness.summary).slice(0, 180)}${alertReadiness.summary.length > 180 ? "…" : ""}`;
  }
  return base.trim();
}

/**
 * Pure advisory synthesis — notification readiness from 3C/3D outputs.
 * READ-ONLY: no notifications, no DB writes, no financial mutations.
 * @param {object} args
 */
export function buildTreasuryNotificationReadiness({
  treasuryAdminAlerts = {},
  alertReadiness = {},
  monitoringSummary = null,
  treasuryCommandCenter = {},
  readinessIndex = {},
  governance = {},
  scalingReadiness = {},
  operatingMode = {},
  operationalGuidance = {},
  treasuryOperationsState = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const readiness = alertReadiness || EMPTY_ALERT_READINESS;
    const adminResult = treasuryAdminAlerts || {};
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });

    let notificationReadinessStatus = mapAlertReadinessToNotificationStatus(
      readiness.alertReadinessStatus,
      adminResult,
      treasuryCommandCenter,
    );

    if (isSmallDollar) {
      notificationReadinessStatus = downgradeNotificationStatusOneNotch(notificationReadinessStatus);
    }

    const recommendedNotificationPosture = mapNotificationPostureFromStatus(notificationReadinessStatus);

    const recommendedChannels = deriveRecommendedNotificationChannels({
      notificationReadinessStatus,
      alertReadiness: readiness,
      adminAlertResult: adminResult,
      isSmallDollar,
    });

    const escalationRouting = buildEscalationRouting({
      notificationReadinessStatus,
      alertReadiness: readiness,
      adminAlertResult: adminResult,
      treasuryCommandCenter,
      isSmallDollar,
    });

    const digestSuitability = buildDigestSuitability({
      notificationReadinessStatus,
      adminAlertResult: adminResult,
      alertReadiness: readiness,
      monitoringSummary,
    });

    const suppressedNotifications = buildSuppressedNotifications({
      alertReadiness: readiness,
      notificationReadinessStatus,
      recommendedChannels,
      isSmallDollar,
      adminAlertResult: adminResult,
    });

    const notificationConfidence = deriveNotificationConfidence({
      alertReadiness: readiness,
      adminAlertResult: adminResult,
      monitoringSummary,
      treasuryOperationsState,
      isSmallDollar,
    });

    const summary = buildNotificationReadinessSummary({
      notificationReadinessStatus,
      recommendedNotificationPosture,
      recommendedChannels,
      adminAlertResult: adminResult,
      alertReadiness: readiness,
      isSmallDollar,
      digestSuitability,
      suppressedCount: suppressedNotifications.length,
    });

    void readinessIndex;
    void governance;
    void scalingReadiness;
    void operatingMode;
    void operationalGuidance;

    return {
      notificationReadinessStatus,
      recommendedNotificationPosture,
      recommendedChannels,
      escalationRouting,
      digestSuitability,
      suppressedNotifications,
      notificationConfidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryNotificationReadiness", err: err?.message || String(err) });
    return { ...EMPTY_NOTIFICATION_READINESS };
  }
}

export function formatNotificationReadinessChipLabel(readiness) {
  const status = String(readiness?.notificationReadinessStatus || "quiet").toLowerCase();
  const labels = {
    quiet: "Treasury notifications: Quiet",
    monitoring: "Treasury notifications: Monitoring",
    digest_ready: "Treasury notifications: Digest-ready",
    escalation_ready: "Treasury notifications: Escalation-ready",
  };
  return labels[status] || labels.quiet;
}

const EMPTY_DIGEST_INTELLIGENCE = Object.freeze({
  digestReadiness: "quiet",
  dailyDigest: {
    headline: "Treasury digest preview unavailable",
    summary: "Treasury digest intelligence unavailable — advisory monitoring only.",
    keySignals: [],
    watchItems: [],
    recommendations: [],
  },
  weeklyDigest: {
    headline: "Weekly treasury digest preview unavailable",
    summary: "Weekly digest synthesis requires treasury intelligence inputs.",
    majorChanges: [],
    treasuryTrajectory: "stable",
    recommendations: [],
  },
  digestHighlights: [],
  digestPriority: "low",
  digestSuitability: { daily: false, weekly: false, executive: false },
  confidence: 0,
  summary: "Treasury digest intelligence unavailable — advisory monitoring only.",
});

const DIGEST_READINESS_ORDER = Object.freeze(["quiet", "monitoring", "digest_ready", "executive_digest_ready"]);

function downgradeDigestReadinessOneNotch(readiness) {
  const idx = DIGEST_READINESS_ORDER.indexOf(String(readiness || "quiet").toLowerCase());
  return idx <= 0 ? "quiet" : DIGEST_READINESS_ORDER[idx - 1];
}

function mapNotificationStatusToDigestReadiness(notificationReadinessStatus) {
  const key = String(notificationReadinessStatus || "quiet").toLowerCase();
  if (key === "escalation_ready") return "executive_digest_ready";
  if (key === "digest_ready") return "digest_ready";
  if (key === "monitoring") return "monitoring";
  return "quiet";
}

function severityToDigestPriority(severity) {
  const sev = normalizeSeverity(severity);
  if (sev === "high") return "high";
  if (sev === "elevated") return "elevated";
  if (sev === "moderate") return "moderate";
  return "low";
}

function maxDigestPriority(...priorities) {
  let maxIdx = 0;
  for (const pri of priorities) {
    const idx = ALERT_PRIORITY_ORDER.indexOf(String(pri || "low").toLowerCase());
    if (idx > maxIdx) maxIdx = idx;
  }
  return ALERT_PRIORITY_ORDER[maxIdx] || "low";
}

function deriveDigestPriority({
  alertPriority,
  commandPriority,
  adminAlerts,
}) {
  const severities = (adminAlerts || []).map((a) => severityToDigestPriority(a.severity));
  const fromAlerts = severities.length > 0 ? maxDigestPriority(...severities) : "low";
  return maxDigestPriority(alertPriority, commandPriority, fromAlerts);
}

function deriveDigestReadiness({
  commandStatus,
  alertReadinessStatus,
  notificationReadinessStatus,
  adminAlertCount,
  highlightCount,
  moderateSignalCount,
  executiveStatus,
  digestPriority,
}) {
  if (
    notificationReadinessStatus === "escalation_ready" ||
    alertReadinessStatus === "escalation_recommended" ||
    isLevelIn(executiveStatus, ["elevated_attention", "active_review", "high_attention", "elevated_watch"]) ||
    digestPriority === "high"
  ) {
    return "executive_digest_ready";
  }

  if (
    notificationReadinessStatus === "digest_ready" ||
    highlightCount >= 2 ||
    moderateSignalCount >= 2
  ) {
    return "digest_ready";
  }

  if (
    notificationReadinessStatus === "monitoring" ||
    alertReadinessStatus === "watch" ||
    commandStatus === "monitored" ||
    adminAlertCount >= 1
  ) {
    return "monitoring";
  }

  if (
    commandStatus === "stable" &&
    alertReadinessStatus === "quiet" &&
    notificationReadinessStatus === "quiet" &&
    adminAlertCount === 0
  ) {
    return "quiet";
  }

  return adminAlertCount > 0 ? "monitoring" : "quiet";
}

function mapHealthDirectionToTrajectory(direction) {
  const key = String(direction || "").toLowerCase();
  if (key === "improving" || key === "growth") return "strengthening";
  if (key === "deteriorating" || key === "decline" || key === "weakening") return "weakening";
  if (key === "mixed" || key === "variable") return "mixed";
  if (key === "stable") return "stable";
  if (key === "insufficient_data" || !key) return "stable";
  return "stabilizing";
}

function buildDigestHighlights({ adminAlerts, alertWorthySignals, limit = 6 }) {
  const highlights = [];

  for (const alert of adminAlerts || []) {
    highlights.push({
      severity: normalizeSeverity(alert.severity),
      title: String(alert.title || "Treasury advisory"),
      summary: String(alert.summary || alert.recommendation || "Advisory treasury signal."),
    });
  }

  for (const signal of alertWorthySignals || []) {
    highlights.push({
      severity: normalizeSeverity(signal.severity),
      title: String(signal.title || "Treasury signal"),
      summary: String(signal.reason || "Alert-worthy treasury signal."),
    });
  }

  const seen = new Set();
  const unique = [];
  for (const item of highlights) {
    const key = `${item.title}::${item.severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique
    .sort((a, b) => rankSeverity(b.severity) - rankSeverity(a.severity))
    .slice(0, limit);
}

function buildDailyDigestHeadline({ commandStatus, digestReadiness, isSmallDollar, executiveBriefing }) {
  if (executiveBriefing?.executiveHeadline) {
    const headline = String(executiveBriefing.executiveHeadline);
    if (isSmallDollar && !headline.toLowerCase().includes("soft-launch")) {
      return softenText(headline, true);
    }
    return headline;
  }
  if (digestReadiness === "executive_digest_ready") {
    return isSmallDollar
      ? "Soft-launch treasury warrants elevated leadership visibility"
      : "Treasury warrants elevated leadership visibility";
  }
  if (commandStatus === "stable") {
    return isSmallDollar
      ? "Treasury operating within soft-launch expectations"
      : "Treasury operating within institutional expectations";
  }
  if (commandStatus === "monitored") {
    return isSmallDollar
      ? "Treasury under routine soft-launch monitoring"
      : "Treasury under routine institutional monitoring";
  }
  return isSmallDollar
    ? "Treasury leadership snapshot — soft-launch advisory"
    : "Treasury leadership snapshot — advisory monitoring";
}

function buildDailyDigestSummary({
  commandCenter,
  alertReadiness,
  notificationReadiness,
  treasuryOperationsState,
  isSmallDollar,
  adminAlertCount,
}) {
  const commandSummary = String(commandCenter?.summary || "").trim();
  const alertStatus = String(alertReadiness?.alertReadinessStatus || "quiet").replace(/_/g, " ");
  const notifStatus = String(notificationReadiness?.notificationReadinessStatus || "quiet").replace(/_/g, " ");
  const posture = String(treasuryOperationsState?.operatingState || "normal_monitoring").replace(/_/g, " ");
  const attention = String(treasuryOperationsState?.treasuryAttentionLevel || "low");

  let base = commandSummary
    ? `${commandSummary.slice(0, 220)}${commandSummary.length > 220 ? "…" : ""}`
    : `Treasury posture is ${posture} with ${attention} attention. Alert readiness: ${alertStatus}; notification readiness: ${notifStatus}.`;

  if (adminAlertCount > 0) {
    base += ` ${adminAlertCount} advisory admin alert${adminAlertCount === 1 ? "" : "s"} inform today's leadership snapshot.`;
  } else {
    base += " No admin advisories require grouping at this time.";
  }

  base += " Preview only — no digest sent or scheduled.";
  return isSmallDollar ? softenText(base, true) : base;
}

function buildWeeklyDigestHeadline({ treasuryTrajectory, digestReadiness, isSmallDollar }) {
  const trajectoryPhrase = treasuryJourneyPhrase(treasuryTrajectory);
  if (digestReadiness === "executive_digest_ready") {
    return isSmallDollar
      ? `Weekly treasury arc — ${trajectoryPhrase} with elevated soft-launch review`
      : `Weekly treasury arc — ${trajectoryPhrase} with elevated leadership review`;
  }
  return isSmallDollar
    ? `Weekly treasury arc — ${trajectoryPhrase} at soft-launch scale`
    : `Weekly treasury arc — ${trajectoryPhrase}`;
}

function treasuryJourneyPhrase(journey) {
  const key = String(journey || "stable").toLowerCase();
  const phrases = {
    strengthening: "strengthening trajectory",
    stabilizing: "stabilizing trajectory",
    stable: "stable trajectory",
    mixed: "mixed trajectory",
    weakening: "weakening trajectory",
  };
  return phrases[key] || "monitoring trajectory";
}

function buildWeeklyDigestSummary({
  historicalAnalytics,
  boardTimeline,
  digestReadiness,
  isSmallDollar,
}) {
  const analyticsSummary = String(historicalAnalytics?.analyticsSummary || "").trim();
  const boardSummary = String(boardTimeline?.summary || "").trim();
  let base =
    boardSummary ||
    analyticsSummary ||
    "Weekly treasury synthesis draws on historical analytics and board timeline signals.";

  base = base.slice(0, 280) + (base.length > 280 ? "…" : "");
  if (digestReadiness === "digest_ready" || digestReadiness === "executive_digest_ready") {
    base += " Multiple moderate signals suggest a consolidated weekly digest would aid leadership review.";
  } else {
    base += " Routine weekly digest preparation remains optional at current materiality.";
  }
  base += " Advisory preview only — nothing dispatched.";
  return isSmallDollar ? softenText(base, true) : base;
}

function buildMajorChanges({ historicalAnalytics, boardTimeline, driftDetection, isSmallDollar }) {
  const changes = [];

  const healthTrend = historicalAnalytics?.historicalHealthTrend;
  if (healthTrend?.summary) {
    changes.push(String(healthTrend.summary));
  }
  const riskTrend = historicalAnalytics?.historicalRiskTrend;
  if (riskTrend?.summary && riskTrend.direction !== "insufficient_data") {
    changes.push(String(riskTrend.summary));
  }
  const resilienceTrend = historicalAnalytics?.resilienceTrend;
  if (resilienceTrend?.summary && resilienceTrend.direction !== "unknown") {
    changes.push(String(resilienceTrend.summary));
  }

  if (boardTimeline?.keyMilestones?.length) {
    for (const milestone of boardTimeline.keyMilestones.slice(0, 3)) {
      changes.push(String(milestone));
    }
  } else if (boardTimeline?.treasuryJourney) {
    changes.push(
      `Board timeline journey: ${String(boardTimeline.treasuryJourney).replace(/_/g, " ")}.`,
    );
  }

  const driftStatus = String(driftDetection?.driftStatus || "unchanged").toLowerCase();
  if (driftStatus !== "unchanged" && driftStatus !== "insufficient_data") {
    changes.push(`Drift detection: ${driftStatus.replace(/_/g, " ")} since prior snapshot.`);
  }

  if (changes.length === 0) {
    changes.push(
      isSmallDollar
        ? "Limited historical movement at soft-launch scale — continue snapshot cadence."
        : "No material weekly changes detected — treasury arc remains within recent baseline.",
    );
  }

  return uniqueStrings(changes.map((c) => (isSmallDollar ? softenText(c, true) : c))).slice(0, 6);
}

function buildDigestRecommendations({
  digestReadiness,
  commandCenter,
  treasuryOperationsState,
  notificationReadiness,
  operationalGuidance,
  isSmallDollar,
  weekly = false,
}) {
  const recs = [];

  if (weekly) {
    for (const item of notificationReadiness?.escalationRouting || []) {
      if (item?.reason) recs.push(String(item.reason));
    }
    if (digestReadiness === "executive_digest_ready") {
      recs.push("Prepare executive leadership weekly review — advisory routing only; no digest sent.");
    } else if (digestReadiness === "digest_ready") {
      recs.push("Consider grouping moderate treasury signals into a weekly operations digest (preview only).");
    } else {
      recs.push("Continue weekly snapshot cadence and historical analytics review.");
    }
  } else {
    for (const action of commandCenter?.executiveActions || []) {
      recs.push(String(action));
    }
    for (const rec of treasuryOperationsState?.recommendedMonitoring || []) {
      recs.push(String(rec));
    }
    for (const check of operationalGuidance?.recommendedChecks || []) {
      recs.push(String(check));
    }
    if (recs.length === 0) {
      recs.push(
        isSmallDollar
          ? "Continue routine soft-launch monitoring — no digest delivery recommended."
          : "Continue routine treasury intelligence review — no digest delivery recommended.",
      );
    }
  }

  return uniqueStrings(recs.map((r) => (isSmallDollar ? softenText(r, true) : r))).slice(0, weekly ? 5 : 6);
}

function buildDigestSuitabilityFlags({
  digestReadiness,
  historicalAnalytics,
  isSmallDollar,
  adminAlerts,
  alertReadiness,
}) {
  const elevatedCount = (adminAlerts || []).filter((a) =>
    isLevelIn(a.severity, ["elevated", "high"]),
  ).length;
  const hasHistory =
    String(historicalAnalytics?.historicalHealthTrend?.direction || "").toLowerCase() !==
      "insufficient_data" &&
    (historicalAnalytics?.historicalHealthTrend?.dataPoints?.length || 0) >= 2;

  const daily =
    digestReadiness === "monitoring" ||
    digestReadiness === "digest_ready" ||
    digestReadiness === "executive_digest_ready";

  const weekly =
    digestReadiness === "digest_ready" ||
    digestReadiness === "executive_digest_ready" ||
    (digestReadiness === "monitoring" && hasHistory);

  let executive = digestReadiness === "executive_digest_ready";
  if (isSmallDollar && executive && elevatedCount < 2) {
    executive = false;
  }
  if (
    isSmallDollar &&
    executive &&
    alertReadiness?.alertReadinessStatus !== "escalation_recommended" &&
    elevatedCount < 2
  ) {
    executive = false;
  }

  return { daily, weekly, executive };
}

function deriveDigestConfidence({
  notificationReadiness,
  alertReadiness,
  treasuryOperationsState,
  commandCenter,
  isSmallDollar,
}) {
  let confidence = Math.round(
    (Number(notificationReadiness?.notificationConfidence) || 0) * 0.35 +
      (Number(alertReadiness?.confidence) || 0) * 0.25 +
      (Number(treasuryOperationsState?.confidence) || 0) * 0.25 +
      (Number(commandCenter?.confidence) || 0) * 0.15,
  );
  confidence = clamp(confidence, 0, 100);
  if (isSmallDollar) confidence = Math.min(confidence, 82);
  return confidence;
}

function buildDigestIntelligenceSummary({
  digestReadiness,
  digestPriority,
  digestSuitability,
  highlightCount,
  isSmallDollar,
  confidence,
}) {
  const readinessPhrases = {
    quiet:
      "Treasury digest readiness is quiet — stable command center with no meaningful grouping required.",
    monitoring:
      "Treasury digest readiness is monitoring — routine watch posture; daily leadership snapshot preparation is appropriate (not sent).",
    digest_ready:
      "Treasury digest readiness is digest-ready — multiple moderate signals suggest preparing consolidated daily and weekly digests (preview only).",
    executive_digest_ready:
      "Treasury digest readiness is executive digest-ready — elevated posture warrants preparing executive leadership digest paths (advisory labels only; nothing dispatched).",
  };

  let base =
    readinessPhrases[String(digestReadiness || "quiet").toLowerCase()] || readinessPhrases.quiet;
  base += ` Digest priority: ${digestPriority}.`;
  if (highlightCount > 0) {
    base += ` ${highlightCount} highlight${highlightCount === 1 ? "" : "s"} inform digest synthesis.`;
  }
  const channels = [];
  if (digestSuitability.daily) channels.push("daily");
  if (digestSuitability.weekly) channels.push("weekly");
  if (digestSuitability.executive) channels.push("executive");
  if (channels.length > 0) {
    base += ` Suitable for ${channels.join(", ")} digest preview (not sent).`;
  } else {
    base += " No digest channel suitability at current materiality.";
  }
  base += ` Confidence: ${confidence}/100.`;
  if (isSmallDollar) {
    base += " Soft-launch treasury environment — digest readiness remains advisory.";
  }
  base += " No digests have been sent or scheduled.";
  return base.trim();
}

/**
 * Pure advisory synthesis — treasury digest intelligence from 3A–3F outputs.
 * READ-ONLY: no digests sent, scheduled, or delivered.
 * @param {object} args
 */
export function buildTreasuryDigestIntelligence({
  treasuryCommandCenter = {},
  readinessIndex = {},
  executiveBriefing = {},
  historicalAnalytics = {},
  monitoringDashboard = {},
  operationalGuidance = {},
  treasuryAdminAlerts = {},
  notificationReadiness = {},
  alertReadiness = {},
  treasuryOperationsState = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const adminResult = treasuryAdminAlerts || {};
    const adminAlerts = adminResult.treasuryAdminAlerts || [];
    const adminAlertCount = adminAlerts.length;
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });

    const commandStatus = String(treasuryCommandCenter.treasuryCommandStatus || "monitored").toLowerCase();
    const commandPriority = String(treasuryCommandCenter.treasuryPriorityLevel || "moderate").toLowerCase();
    const alertReadinessStatus = String(alertReadiness?.alertReadinessStatus || "quiet").toLowerCase();
    const notificationReadinessStatus = String(
      notificationReadiness?.notificationReadinessStatus || "quiet",
    ).toLowerCase();
    const executiveStatus = String(executiveBriefing?.executiveStatus || "stable").toLowerCase();

    const moderateSignalCount = (alertReadiness?.alertWorthySignals || []).filter((s) =>
      isLevelIn(s.severity, ["moderate", "elevated", "high"]),
    ).length;

    const digestHighlights = buildDigestHighlights({
      adminAlerts,
      alertWorthySignals: alertReadiness?.alertWorthySignals,
    }).map((item) => ({
      ...item,
      title: isSmallDollar ? formatSoftLaunchTitle(item.title, true) : item.title,
      summary: isSmallDollar ? softenText(item.summary, true) : item.summary,
    }));

    const digestPriorityRaw = deriveDigestPriority({
      alertPriority: alertReadiness?.alertPriority,
      commandPriority,
      adminAlerts,
    });
    let digestPriority = isSmallDollar
      ? downgradeAlertPriorityOneNotch(digestPriorityRaw)
      : digestPriorityRaw;

    let digestReadiness = deriveDigestReadiness({
      commandStatus,
      alertReadinessStatus,
      notificationReadinessStatus,
      adminAlertCount,
      highlightCount: digestHighlights.length,
      moderateSignalCount,
      executiveStatus,
      digestPriority,
    });

    if (isSmallDollar) {
      digestReadiness = downgradeDigestReadinessOneNotch(digestReadiness);
    }

    const treasuryTrajectory = boardTimelineJourneyFromInputs({
      executiveBriefing,
      historicalAnalytics,
      monitoringDashboard,
    });

    const digestSuitability = buildDigestSuitabilityFlags({
      digestReadiness,
      historicalAnalytics,
      isSmallDollar,
      adminAlerts,
      alertReadiness,
    });

    const keySignals = uniqueStrings([
      ...(treasuryOperationsState?.treasuryMonitoringSignals || []).slice(0, 4),
      ...(treasuryCommandCenter?.strengths || []).slice(0, 2),
    ]).map((s) => (isSmallDollar ? softenText(String(s), true) : String(s)));

    const watchItems = uniqueStrings([
      ...(treasuryOperationsState?.treasuryWatchFlags || []),
      ...(treasuryCommandCenter?.concerns || []),
      ...adminAlerts.map((a) => a.title),
    ]).map((s) => (isSmallDollar ? softenText(String(s), true) : String(s)));

    const dailyDigest = {
      headline: buildDailyDigestHeadline({
        commandStatus,
        digestReadiness,
        isSmallDollar,
        executiveBriefing,
      }),
      summary: buildDailyDigestSummary({
        commandCenter: treasuryCommandCenter,
        alertReadiness,
        notificationReadiness,
        treasuryOperationsState,
        isSmallDollar,
        adminAlertCount,
      }),
      keySignals: keySignals.slice(0, 5),
      watchItems: watchItems.slice(0, 6),
      recommendations: buildDigestRecommendations({
        digestReadiness,
        commandCenter: treasuryCommandCenter,
        treasuryOperationsState,
        notificationReadiness,
        operationalGuidance,
        isSmallDollar,
        weekly: false,
      }),
    };

    const weeklyDigest = {
      headline: buildWeeklyDigestHeadline({ treasuryTrajectory, digestReadiness, isSmallDollar }),
      summary: buildWeeklyDigestSummary({
        historicalAnalytics,
        boardTimeline: {
          summary: executiveBriefing?.briefingSummary || readinessIndex?.summary,
          treasuryJourney: treasuryTrajectory,
        },
        digestReadiness,
        isSmallDollar,
      }),
      majorChanges: buildMajorChanges({
        historicalAnalytics,
        boardTimeline: { treasuryJourney: treasuryTrajectory },
        driftDetection: {},
        isSmallDollar,
      }),
      treasuryTrajectory: treasuryJourneyPhrase(treasuryTrajectory),
      recommendations: buildDigestRecommendations({
        digestReadiness,
        commandCenter: treasuryCommandCenter,
        treasuryOperationsState,
        notificationReadiness,
        operationalGuidance,
        isSmallDollar,
        weekly: true,
      }),
    };

    const confidence = deriveDigestConfidence({
      notificationReadiness,
      alertReadiness,
      treasuryOperationsState,
      commandCenter: treasuryCommandCenter,
      isSmallDollar,
    });

    const summary = buildDigestIntelligenceSummary({
      digestReadiness,
      digestPriority,
      digestSuitability,
      highlightCount: digestHighlights.length,
      isSmallDollar,
      confidence,
    });

    void monitoringDashboard;

    return {
      digestReadiness,
      dailyDigest,
      weeklyDigest,
      digestHighlights,
      digestPriority,
      digestSuitability,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryDigestIntelligence", err: err?.message || String(err) });
    return { ...EMPTY_DIGEST_INTELLIGENCE };
  }
}

function boardTimelineJourneyFromInputs({ executiveBriefing, historicalAnalytics, monitoringDashboard }) {
  const healthDir = mapHealthDirectionToTrajectory(historicalAnalytics?.historicalHealthTrend?.direction);
  const momentum = String(monitoringDashboard?.treasuryMomentum || "").toLowerCase();
  if (momentum === "weakening" || healthDir === "weakening") return "weakening";
  if (momentum === "improving" || healthDir === "strengthening") return "strengthening";
  if (healthDir === "mixed") return "mixed";
  if (healthDir === "stabilizing") return "stabilizing";
  if (isLevelIn(String(executiveBriefing?.executiveOutlook || "").toLowerCase(), ["improving"])) {
    return "strengthening";
  }
  return healthDir || "stable";
}

export function formatTreasuryDigestChipLabel(digest) {
  const status = String(digest?.digestReadiness || "quiet").toLowerCase();
  const labels = {
    quiet: "Treasury digest: Quiet",
    monitoring: "Treasury digest: Monitoring",
    digest_ready: "Treasury digest: Digest-ready",
    executive_digest_ready: "Treasury digest: Executive-ready",
  };
  return labels[status] || labels.quiet;
}

const EMPTY_EXECUTIVE_ESCALATION = Object.freeze({
  executiveAttentionStatus: "observe",
  escalationPriority: "low",
  executiveAttentionReasons: [
    "Treasury executive escalation intelligence unavailable — advisory monitoring only.",
  ],
  escalationSignals: [],
  leadershipSummary: {
    headline: "Treasury executive posture unavailable",
    summary: "Executive escalation synthesis requires treasury intelligence inputs.",
    recommendations: ["Open Treasury Intelligence for current advisory posture."],
  },
  recommendedExecutiveCadence: "weekly",
  escalationConfidence: 0,
  summary: "Treasury executive escalation intelligence unavailable — advisory monitoring only.",
});

function countElevatedEscalationSignals(signals) {
  return (signals || []).filter((s) => isLevelIn(s.severity, ["elevated", "high"])).length;
}

function buildExecutiveEscalationSignals({
  adminAlerts,
  alertWorthySignals,
  commandCenter,
  digestHighlights,
  isSmallDollar,
  limit = 8,
}) {
  const signals = [];

  for (const alert of adminAlerts || []) {
    signals.push({
      severity: normalizeSeverity(alert.severity),
      title: isSmallDollar ? formatSoftLaunchTitle(String(alert.title || "Treasury advisory"), true) : String(alert.title || "Treasury advisory"),
      summary: isSmallDollar
        ? softenText(String(alert.summary || alert.recommendation || "Advisory treasury signal."), true)
        : String(alert.summary || alert.recommendation || "Advisory treasury signal."),
    });
  }

  for (const signal of alertWorthySignals || []) {
    signals.push({
      severity: normalizeSeverity(signal.severity),
      title: isSmallDollar ? formatSoftLaunchTitle(String(signal.title || "Treasury signal"), true) : String(signal.title || "Treasury signal"),
      summary: isSmallDollar
        ? softenText(String(signal.reason || "Alert-worthy treasury signal."), true)
        : String(signal.reason || "Alert-worthy treasury signal."),
    });
  }

  for (const concern of commandCenter?.concerns || []) {
    const title = String(concern || "").trim();
    if (!title) continue;
    signals.push({
      severity: String(commandCenter?.treasuryCommandStatus || "").toLowerCase() === "active_review" ? "elevated" : "moderate",
      title: isSmallDollar ? formatSoftLaunchTitle(title, true) : title,
      summary: isSmallDollar
        ? softenText("Command center concern under leadership visibility.", true)
        : "Command center concern under leadership visibility.",
    });
  }

  for (const item of digestHighlights || []) {
    signals.push({
      severity: normalizeSeverity(item.severity),
      title: isSmallDollar ? formatSoftLaunchTitle(String(item.title || "Digest highlight"), true) : String(item.title || "Digest highlight"),
      summary: isSmallDollar
        ? softenText(String(item.summary || "Digest highlight signal."), true)
        : String(item.summary || "Digest highlight signal."),
    });
  }

  const seen = new Set();
  const unique = [];
  for (const item of signals) {
    const key = `${item.title}::${item.severity}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique.sort((a, b) => rankSeverity(b.severity) - rankSeverity(a.severity)).slice(0, limit);
}

function deriveExecutiveEscalationPriority({
  commandPriority,
  alertPriority,
  executiveStatus,
  executivePriority,
  adminAlerts,
  digestPriority,
  isSmallDollar,
}) {
  const fromAlerts = (adminAlerts || []).map((a) => severityToDigestPriority(a.severity));
  const fromAlertsMax = fromAlerts.length > 0 ? maxDigestPriority(...fromAlerts) : "low";
  let priority = maxDigestPriority(commandPriority, alertPriority, fromAlertsMax, digestPriority);

  if (
    isLevelIn(executiveStatus, ["high_attention", "active_review", "elevated_attention"]) ||
    executivePriority === "elevated_review"
  ) {
    priority = maxDigestPriority(priority, "elevated");
  }

  if (isSmallDollar) {
    priority = downgradeAlertPriorityOneNotch(priority);
  }

  return priority;
}

function deriveExecutiveAttentionStatus({
  commandStatus,
  alertReadinessStatus,
  notificationReadinessStatus,
  digestReadiness,
  digestPriority,
  executiveStatus,
  escalationSignalCount,
  elevatedSignalCount,
  isSmallDollar,
}) {
  const canExecutiveReview =
    !isSmallDollar || (elevatedSignalCount >= 2 && escalationSignalCount >= 3);

  if (
    canExecutiveReview &&
    (alertReadinessStatus === "escalation_recommended" ||
      commandStatus === "active_review" ||
      isLevelIn(executiveStatus, ["high_attention", "active_review", "elevated_attention"]) ||
      (digestReadiness === "executive_digest_ready" &&
        isLevelIn(digestPriority, ["elevated", "high"])))
  ) {
    return "executive_review";
  }

  const canLeadershipAttention = !isSmallDollar || elevatedSignalCount >= 1 || escalationSignalCount >= 2;

  if (
    canLeadershipAttention &&
    (alertReadinessStatus === "ready_to_alert" ||
      notificationReadinessStatus === "digest_ready" ||
      digestReadiness === "digest_ready" ||
      isLevelIn(digestPriority, ["elevated", "high"]) ||
      escalationSignalCount >= 2 ||
      elevatedSignalCount >= 1)
  ) {
    return "leadership_attention";
  }

  if (
    commandStatus === "stable" &&
    alertReadinessStatus === "quiet" &&
    notificationReadinessStatus === "quiet" &&
    digestReadiness === "quiet" &&
    escalationSignalCount === 0 &&
    elevatedSignalCount === 0
  ) {
    return "quiet";
  }

  return "observe";
}

function applySoftLaunchExecutiveAttentionCap(status, elevatedSignalCount, escalationSignalCount) {
  const key = String(status || "observe").toLowerCase();
  if (key === "executive_review" && elevatedSignalCount < 2) {
    return escalationSignalCount >= 2 ? "leadership_attention" : "observe";
  }
  if (key === "leadership_attention" && elevatedSignalCount === 0 && escalationSignalCount < 2) {
    return "observe";
  }
  return key;
}

function deriveRecommendedExecutiveCadence({
  executiveAttentionStatus,
  escalationPriority,
  isSmallDollar,
  elevatedSignalCount,
}) {
  const status = String(executiveAttentionStatus || "observe").toLowerCase();
  const priority = String(escalationPriority || "low").toLowerCase();

  if (status === "quiet") return "none";

  if (status === "executive_review") {
    if (priority === "high" && (!isSmallDollar || elevatedSignalCount >= 2)) {
      return "immediate_review";
    }
    return isSmallDollar ? "weekly" : "daily";
  }

  if (status === "leadership_attention") {
    return isSmallDollar ? "weekly" : "daily";
  }

  return "weekly";
}

function buildExecutiveAttentionReasons({
  executiveAttentionStatus,
  commandStatus,
  alertReadinessStatus,
  notificationReadinessStatus,
  digestReadiness,
  escalationPriority,
  adminAlertCount,
  escalationSignalCount,
  elevatedSignalCount,
  isSmallDollar,
  executiveBriefing,
}) {
  const reasons = [];

  if (executiveAttentionStatus === "quiet") {
    reasons.push("Treasury command center reports stable posture with quiet alert, notification, and digest readiness.");
    reasons.push("No elevated admin advisories or leadership-visible escalation signals are grouped at this time.");
  } else if (executiveAttentionStatus === "observe") {
    reasons.push("Treasury remains under routine leadership visibility with monitoring-grade advisory outputs.");
    if (isSmallDollar) {
      reasons.push("Soft-launch dollar levels favor weekly observation rather than elevated executive cadence.");
    }
    if (commandStatus === "monitored") {
      reasons.push("Command center is in monitored posture — institutional watch without escalation preparation.");
    }
  } else if (executiveAttentionStatus === "leadership_attention") {
    reasons.push("Moderate treasury posture or digest-ready signals suggest leadership should review advisory summaries.");
    if (alertReadinessStatus === "ready_to_alert") {
      reasons.push("Alert readiness is ready-to-alert — leadership visibility recommended (no notifications sent).");
    }
    if (digestReadiness === "digest_ready") {
      reasons.push("Digest intelligence is digest-ready — consolidated leadership preview is appropriate (not delivered).");
    }
    if (escalationSignalCount >= 2) {
      reasons.push(`${escalationSignalCount} escalation signals inform leadership attention posture.`);
    }
  } else if (executiveAttentionStatus === "executive_review") {
    reasons.push("Elevated treasury posture warrants executive leadership review of advisory synthesis.");
    if (alertReadinessStatus === "escalation_recommended") {
      reasons.push("Alert readiness recommends escalation review — advisory preparation only, nothing dispatched.");
    }
    if (digestReadiness === "executive_digest_ready") {
      reasons.push("Digest intelligence is executive digest-ready — leadership digest paths may be prepared (not sent).");
    }
  }

  if (adminAlertCount > 0) {
    reasons.push(`${adminAlertCount} in-app admin advisory alert${adminAlertCount === 1 ? "" : "s"} inform current posture.`);
  }

  if (elevatedSignalCount > 0) {
    reasons.push(`${elevatedSignalCount} elevated escalation signal${elevatedSignalCount === 1 ? "" : "s"} contribute to ${escalationPriority} priority.`);
  }

  if (executiveBriefing?.actionFocus?.length > 0) {
    reasons.push("Executive briefing action focus items align with current leadership visibility posture.");
  }

  if (isSmallDollar) {
    reasons.push("Soft-launch environment — executive escalation remains advisory and materially softened.");
  }

  return uniqueStrings(reasons).slice(0, 6);
}

function buildExecutiveLeadershipSummary({
  executiveAttentionStatus,
  executiveBriefing,
  digestIntelligence,
  treasuryCommandCenter,
  alertReadiness,
  notificationReadiness,
  isSmallDollar,
}) {
  const headlines = {
    quiet: "Treasury operating within leadership visibility thresholds",
    observe: isSmallDollar
      ? "Treasury under routine soft-launch leadership observation"
      : "Treasury under routine institutional leadership observation",
    leadership_attention: isSmallDollar
      ? "Treasury warrants moderated leadership attention at soft-launch scale"
      : "Treasury warrants moderated leadership attention",
    executive_review: isSmallDollar
      ? "Treasury advisory synthesis suggests executive leadership review"
      : "Treasury advisory synthesis suggests executive leadership review",
  };

  const headline =
    String(executiveBriefing?.executiveHeadline || "").trim() ||
    headlines[String(executiveAttentionStatus || "observe").toLowerCase()] ||
    headlines.observe;

  const commandSummary = String(treasuryCommandCenter?.summary || "").trim();
  const alertPhrase = String(alertReadiness?.alertReadinessStatus || "quiet").replace(/_/g, " ");
  const notifPhrase = String(notificationReadiness?.notificationReadinessStatus || "quiet").replace(/_/g, " ");
  const digestPhrase = String(digestIntelligence?.digestReadiness || "quiet").replace(/_/g, " ");

  let summary = commandSummary
    ? `${commandSummary.slice(0, 180)}${commandSummary.length > 180 ? "…" : ""} `
    : "";
  summary += `Alert readiness is ${alertPhrase}; notification readiness is ${notifPhrase}; digest readiness is ${digestPhrase}. `;
  summary += "This synthesis is advisory only — no executive notifications sent or scheduled.";
  if (isSmallDollar) {
    summary = softenText(summary, true);
  }

  const recommendations = uniqueStrings([
    ...(executiveBriefing?.actionFocus || []).map(String),
    ...(digestIntelligence?.dailyDigest?.recommendations || []).slice(0, 2),
    ...(digestIntelligence?.weeklyDigest?.recommendations || []).slice(0, 1),
    executiveAttentionStatus === "quiet" || executiveAttentionStatus === "observe"
      ? "Maintain weekly leadership observation cadence — no escalation preparation required."
      : null,
    executiveAttentionStatus === "leadership_attention"
      ? "Review treasury advisory summaries and digest previews during next leadership touchpoint."
      : null,
    executiveAttentionStatus === "executive_review"
      ? "Schedule executive leadership review of treasury advisory synthesis — preparation only, no delivery."
      : null,
  ]).slice(0, 5);

  if (recommendations.length === 0) {
    recommendations.push("Continue routine treasury intelligence monitoring — advisory posture only.");
  }

  return { headline, summary: summary.trim(), recommendations };
}

function deriveExecutiveEscalationConfidence({
  alertReadiness,
  notificationReadiness,
  digestIntelligence,
  treasuryCommandCenter,
  treasuryOperationsState,
  isSmallDollar,
}) {
  let confidence = Math.round(
    (Number(digestIntelligence?.confidence) || 0) * 0.3 +
      (Number(notificationReadiness?.notificationConfidence) || 0) * 0.25 +
      (Number(alertReadiness?.confidence) || 0) * 0.25 +
      (Number(treasuryOperationsState?.confidence) || 0) * 0.1 +
      (Number(treasuryCommandCenter?.confidence) || 0) * 0.1,
  );
  confidence = clamp(confidence, 0, 100);
  if (isSmallDollar) confidence = Math.min(confidence, 82);
  return confidence;
}

function buildExecutiveEscalationSummary({
  executiveAttentionStatus,
  escalationPriority,
  recommendedExecutiveCadence,
  escalationSignalCount,
  isSmallDollar,
  escalationConfidence,
}) {
  const statusPhrases = {
    quiet: "Executive attention status is quiet — stable treasury posture within leadership visibility thresholds.",
    observe:
      "Executive attention status is observe — routine leadership visibility with monitoring-grade advisory outputs.",
    leadership_attention:
      "Executive attention status is leadership attention — moderated treasury posture warrants leadership review of advisory synthesis.",
    executive_review:
      "Executive attention status is executive review — elevated advisory posture suggests preparing executive leadership review paths.",
  };

  let base =
    statusPhrases[String(executiveAttentionStatus || "observe").toLowerCase()] || statusPhrases.observe;
  base += ` Escalation priority: ${escalationPriority}.`;
  base += ` Recommended executive cadence: ${String(recommendedExecutiveCadence || "weekly").replace(/_/g, " ")}.`;
  if (escalationSignalCount > 0) {
    base += ` ${escalationSignalCount} escalation signal${escalationSignalCount === 1 ? "" : "s"} inform synthesis.`;
  }
  base += ` Confidence: ${escalationConfidence}/100.`;
  if (isSmallDollar) {
    base += " Soft-launch treasury environment — executive escalation remains advisory and softened.";
  }
  base += " No executive notifications sent or scheduled.";
  return base.trim();
}

/**
 * Pure advisory synthesis — treasury executive escalation intelligence from 3A–3G outputs.
 * READ-ONLY: no executive notifications, scheduling, or delivery.
 * @param {object} args
 */
export function buildTreasuryExecutiveEscalation({
  treasuryCommandCenter = {},
  readinessIndex = {},
  executiveBriefing = {},
  digestIntelligence = {},
  alertReadiness = {},
  notificationReadiness = {},
  treasuryAdminAlerts = {},
  operationalGuidance = {},
  monitoringDashboard = {},
  governance = {},
  scalingReadiness = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const adminResult = treasuryAdminAlerts || {};
    const adminAlerts = adminResult.treasuryAdminAlerts || [];
    const adminAlertCount = adminAlerts.length;
    const readiness = alertReadiness || EMPTY_ALERT_READINESS;
    const digest = digestIntelligence || EMPTY_DIGEST_INTELLIGENCE;
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });

    const commandStatus = String(treasuryCommandCenter.treasuryCommandStatus || "monitored").toLowerCase();
    const commandPriority = String(treasuryCommandCenter.treasuryPriorityLevel || "moderate").toLowerCase();
    const alertReadinessStatus = String(readiness.alertReadinessStatus || "quiet").toLowerCase();
    const notificationReadinessStatus = String(
      notificationReadiness?.notificationReadinessStatus || "quiet",
    ).toLowerCase();
    const digestReadiness = String(digest.digestReadiness || "quiet").toLowerCase();
    const digestPriority = String(digest.digestPriority || "low").toLowerCase();
    const executiveStatus = String(executiveBriefing?.executiveStatus || "stable").toLowerCase();
    const executivePriority = String(executiveBriefing?.executivePriority || "maintain_monitoring").toLowerCase();
    const alertPriority = String(readiness.alertPriority || "low").toLowerCase();

    const escalationSignals = buildExecutiveEscalationSignals({
      adminAlerts,
      alertWorthySignals: readiness.alertWorthySignals,
      commandCenter: treasuryCommandCenter,
      digestHighlights: digest.digestHighlights,
      isSmallDollar,
    });

    const escalationSignalCount = escalationSignals.length;
    const elevatedSignalCount = countElevatedEscalationSignals(escalationSignals);

    let escalationPriority = deriveExecutiveEscalationPriority({
      commandPriority,
      alertPriority,
      executiveStatus,
      executivePriority,
      adminAlerts,
      digestPriority,
      isSmallDollar,
    });

    let executiveAttentionStatus = deriveExecutiveAttentionStatus({
      commandStatus,
      alertReadinessStatus,
      notificationReadinessStatus,
      digestReadiness,
      digestPriority,
      executiveStatus,
      escalationSignalCount,
      elevatedSignalCount,
      isSmallDollar,
    });

    if (isSmallDollar) {
      executiveAttentionStatus = applySoftLaunchExecutiveAttentionCap(
        executiveAttentionStatus,
        elevatedSignalCount,
        escalationSignalCount,
      );
      if (executiveAttentionStatus === "executive_review" && elevatedSignalCount < 2) {
        escalationPriority = downgradeAlertPriorityOneNotch(escalationPriority);
      }
    }

    const recommendedExecutiveCadence = deriveRecommendedExecutiveCadence({
      executiveAttentionStatus,
      escalationPriority,
      isSmallDollar,
      elevatedSignalCount,
    });

    const executiveAttentionReasons = buildExecutiveAttentionReasons({
      executiveAttentionStatus,
      commandStatus,
      alertReadinessStatus,
      notificationReadinessStatus,
      digestReadiness,
      escalationPriority,
      adminAlertCount,
      escalationSignalCount,
      elevatedSignalCount,
      isSmallDollar,
      executiveBriefing,
    });

    const leadershipSummary = buildExecutiveLeadershipSummary({
      executiveAttentionStatus,
      executiveBriefing,
      digestIntelligence: digest,
      treasuryCommandCenter,
      alertReadiness: readiness,
      notificationReadiness,
      isSmallDollar,
    });

    const escalationConfidence = deriveExecutiveEscalationConfidence({
      alertReadiness: readiness,
      notificationReadiness,
      digestIntelligence: digest,
      treasuryCommandCenter,
      treasuryOperationsState: {},
      isSmallDollar,
    });

    const summary = buildExecutiveEscalationSummary({
      executiveAttentionStatus,
      escalationPriority,
      recommendedExecutiveCadence,
      escalationSignalCount,
      isSmallDollar,
      escalationConfidence,
    });

    void readinessIndex;
    void operationalGuidance;
    void monitoringDashboard;
    void governance;
    void scalingReadiness;

    return {
      executiveAttentionStatus,
      escalationPriority,
      executiveAttentionReasons,
      escalationSignals,
      leadershipSummary,
      recommendedExecutiveCadence,
      escalationConfidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryExecutiveEscalation", err: err?.message || String(err) });
    return { ...EMPTY_EXECUTIVE_ESCALATION };
  }
}

export function formatExecutiveEscalationChipLabel(result) {
  const status = String(result?.executiveAttentionStatus || "observe").toLowerCase();
  const labels = {
    quiet: "Treasury executive posture: Quiet",
    observe: "Treasury executive posture: Observe",
    leadership_attention: "Treasury executive posture: Leadership attention",
    executive_review: "Treasury executive posture: Executive review",
  };
  return labels[status] || labels.observe;
}

const EMPTY_DECISION_SUPPORT = Object.freeze({
  decisionSupportStatus: "monitoring",
  treasuryRecommendations: [
    {
      priority: "low",
      recommendation: "Continue routine treasury observation — advisory monitoring only.",
      reason: "Decision support synthesis unavailable.",
      confidence: 0,
    },
  ],
  priorityActions: ["Continue routine treasury observation"],
  deferredActions: ["Review scaling readiness when treasury posture stabilizes"],
  monitoringRecommendations: ["Continue routine treasury observation"],
  confidence: 0,
  summary: "Treasury decision support intelligence unavailable — advisory monitoring only.",
});

const FORBIDDEN_DECISION_PHRASES = Object.freeze([
  "freeze treasury",
  "block payouts",
  "trigger intervention",
  "move money",
]);

function isForbiddenAdvisoryText(text) {
  const lower = String(text || "").toLowerCase();
  return FORBIDDEN_DECISION_PHRASES.some((phrase) => lower.includes(phrase));
}

function sanitizeAdvisoryText(text, isSmallDollar) {
  const t = String(text || "").trim();
  if (!t || isForbiddenAdvisoryText(t)) return "";
  return isSmallDollar ? softenText(t, true) : t;
}

function maxDecisionPriority(...priorities) {
  let maxIdx = 0;
  for (const pri of priorities) {
    const idx = ALERT_PRIORITY_ORDER.indexOf(String(pri || "low").toLowerCase());
    if (idx > maxIdx) maxIdx = idx;
  }
  return ALERT_PRIORITY_ORDER[maxIdx] || "low";
}

function addTreasuryRecommendation(items, { priority, recommendation, reason, confidence, isSmallDollar }) {
  const rec = sanitizeAdvisoryText(recommendation, isSmallDollar);
  if (!rec) return;
  const rsn =
    sanitizeAdvisoryText(reason, isSmallDollar) || "Synthesized from treasury intelligence outputs.";
  items.push({
    priority: String(priority || "low").toLowerCase(),
    recommendation: rec,
    reason: rsn,
    confidence: clamp(Math.round(Number(confidence) || 0), 0, 100),
  });
}

function deriveDecisionSupportStatus({
  commandStatus,
  alertReadinessStatus,
  notificationReadinessStatus,
  executiveAttentionStatus,
  recommendedExecutiveCadence,
  adminAlertCount,
  isSmallDollar,
}) {
  const cadence = String(recommendedExecutiveCadence || "weekly").toLowerCase();
  const execStatus = String(executiveAttentionStatus || "observe").toLowerCase();
  const alertStatus = String(alertReadinessStatus || "quiet").toLowerCase();
  const notifStatus = String(notificationReadinessStatus || "quiet").toLowerCase();
  const cmdStatus = String(commandStatus || "monitored").toLowerCase();

  const canLeadershipReview =
    !isSmallDollar ||
    execStatus === "executive_review" ||
    alertStatus === "escalation_recommended";

  if (
    canLeadershipReview &&
    (execStatus === "executive_review" ||
      alertStatus === "escalation_recommended" ||
      cadence === "immediate_review" ||
      (cadence === "daily" && !isSmallDollar))
  ) {
    return "leadership_review";
  }

  const canAttentionRecommended =
    !isSmallDollar || execStatus === "leadership_attention" || alertStatus === "ready_to_alert";

  if (
    canAttentionRecommended &&
    (execStatus === "leadership_attention" ||
      alertStatus === "ready_to_alert" ||
      cmdStatus === "active_review")
  ) {
    return "attention_recommended";
  }

  if (
    cmdStatus === "stable" &&
    alertStatus === "quiet" &&
    notifStatus === "quiet" &&
    (execStatus === "quiet" || execStatus === "observe") &&
    adminAlertCount === 0
  ) {
    return "stable";
  }

  return "monitoring";
}

function applySoftLaunchDecisionSupportCap(status, executiveAttentionStatus, alertReadinessStatus) {
  const key = String(status || "monitoring").toLowerCase();
  const execStatus = String(executiveAttentionStatus || "observe").toLowerCase();
  const alertStatus = String(alertReadinessStatus || "quiet").toLowerCase();

  if (key === "leadership_review" && execStatus !== "executive_review" && alertStatus !== "escalation_recommended") {
    return "attention_recommended";
  }
  if (key === "attention_recommended" && execStatus === "observe" && alertStatus === "watch") {
    return "monitoring";
  }
  return key;
}

function buildDecisionSupportRecommendations({
  treasuryCommandCenter,
  operationalGuidance,
  readinessIndex,
  alertReadiness,
  executiveEscalation,
  digestIntelligence,
  governance,
  treasuryOperatingMode,
  scalingReadiness,
  isSmallDollar,
  baseConfidence,
}) {
  const items = [];
  const commandPriority = String(treasuryCommandCenter?.treasuryPriorityLevel || "moderate").toLowerCase();
  const alertPriority = String(alertReadiness?.alertPriority || "low").toLowerCase();
  const escalationPriority = String(executiveEscalation?.escalationPriority || "low").toLowerCase();
  const itemConfidence = (weight = 1) =>
    clamp(Math.round(baseConfidence * weight), 0, isSmallDollar ? 82 : 100);

  for (const action of treasuryCommandCenter?.executiveActions || []) {
    addTreasuryRecommendation(items, {
      priority: maxDecisionPriority(commandPriority, alertPriority),
      recommendation: String(action),
      reason: "Command center executive action under current treasury posture.",
      confidence: itemConfidence(0.85),
      isSmallDollar,
    });
  }

  for (const check of operationalGuidance?.recommendedChecks || []) {
    addTreasuryRecommendation(items, {
      priority: "moderate",
      recommendation: String(check),
      reason: "Operational guidance recommended check.",
      confidence: itemConfidence(0.8),
      isSmallDollar,
    });
  }

  for (const rec of readinessIndex?.recommendations || []) {
    addTreasuryRecommendation(items, {
      priority: maxDecisionPriority(alertPriority, "moderate"),
      recommendation: String(rec),
      reason: "Readiness index advisory recommendation.",
      confidence: itemConfidence(0.75),
      isSmallDollar,
    });
  }

  for (const reason of alertReadiness?.escalationReasons || []) {
    addTreasuryRecommendation(items, {
      priority: maxDecisionPriority(alertPriority, escalationPriority),
      recommendation: "Review alert readiness posture and routing options — preparation only.",
      reason: String(reason),
      confidence: itemConfidence(0.82),
      isSmallDollar,
    });
  }

  for (const rec of executiveEscalation?.leadershipSummary?.recommendations || []) {
    addTreasuryRecommendation(items, {
      priority: escalationPriority,
      recommendation: String(rec),
      reason: "Executive escalation leadership summary.",
      confidence: itemConfidence(0.88),
      isSmallDollar,
    });
  }

  for (const rec of digestIntelligence?.dailyDigest?.recommendations || []) {
    addTreasuryRecommendation(items, {
      priority: String(digestIntelligence?.digestPriority || "moderate").toLowerCase(),
      recommendation: String(rec),
      reason: "Daily digest intelligence synthesis.",
      confidence: itemConfidence(0.78),
      isSmallDollar,
    });
  }

  for (const rec of digestIntelligence?.weeklyDigest?.recommendations || []) {
    addTreasuryRecommendation(items, {
      priority: "moderate",
      recommendation: String(rec),
      reason: "Weekly digest intelligence synthesis.",
      confidence: itemConfidence(0.72),
      isSmallDollar,
    });
  }

  for (const rec of governance?.governanceRecommendations || []) {
    addTreasuryRecommendation(items, {
      priority: "moderate",
      recommendation: String(rec),
      reason: "Treasury governance advisory guidance.",
      confidence: itemConfidence(0.7),
      isSmallDollar,
    });
  }

  for (const rec of treasuryOperatingMode?.recommendations || []) {
    addTreasuryRecommendation(items, {
      priority: "moderate",
      recommendation: String(rec),
      reason: "Treasury operating mode advisory guidance.",
      confidence: itemConfidence(0.7),
      isSmallDollar,
    });
  }

  for (const rec of scalingReadiness?.recommendations || []) {
    addTreasuryRecommendation(items, {
      priority: "low",
      recommendation: String(rec),
      reason: "Scaling readiness advisory — lower urgency when posture is stable.",
      confidence: itemConfidence(0.65),
      isSmallDollar,
    });
  }

  if (items.length === 0) {
    addTreasuryRecommendation(items, {
      priority: "low",
      recommendation: isSmallDollar
        ? "Continue routine soft-launch treasury observation."
        : "Continue routine treasury observation.",
      reason: "Stable command center with no elevated synthesis signals.",
      confidence: itemConfidence(0.6),
      isSmallDollar,
    });
  }

  const seen = new Set();
  const unique = [];
  for (const item of items.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority))) {
    const key = item.recommendation.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return unique.slice(0, 8);
}

function priorityRank(priority) {
  return ALERT_PRIORITY_ORDER.indexOf(String(priority || "low").toLowerCase());
}

function buildDecisionSupportPriorityActions({
  decisionSupportStatus,
  alertReadiness,
  executiveEscalation,
  operationalGuidance,
  treasuryCommandCenter,
  notificationReadiness,
  isSmallDollar,
}) {
  const actions = [];
  const status = String(decisionSupportStatus || "monitoring").toLowerCase();
  const alertStatus = String(alertReadiness?.alertReadinessStatus || "quiet").toLowerCase();

  if (status === "leadership_review") {
    actions.push("Prepare leadership briefing materials from treasury advisory synthesis — no delivery scheduled.");
    actions.push("Review executive escalation signals and digest previews for leadership visibility.");
  }

  if (status === "attention_recommended" || alertStatus === "ready_to_alert") {
    actions.push("Review alert routing readiness and in-app advisory posture — no notifications sent.");
  }

  if (alertStatus === "escalation_recommended" || alertStatus === "ready_to_alert") {
    actions.push("Confirm alert readiness escalation reasons remain within advisory tolerances.");
  }

  for (const check of (operationalGuidance?.recommendedChecks || []).slice(0, 2)) {
    const sanitized = sanitizeAdvisoryText(check, isSmallDollar);
    if (sanitized) actions.push(sanitized);
  }

  if ((treasuryCommandCenter?.concerns || []).length > 0) {
    actions.push("Review command center concern areas and treasury watch flags — observation only.");
  }

  if ((notificationReadiness?.suppressedNotifications || []).length > 0) {
    actions.push("Review suppressed notification context to confirm advisory routing remains appropriate.");
  }

  if (executiveEscalation?.recommendedExecutiveCadence === "immediate_review") {
    actions.push("Consider scheduling immediate leadership treasury review — preparation only.");
  }

  if (actions.length === 0) {
    actions.push(
      isSmallDollar
        ? "Continue routine soft-launch treasury observation."
        : "Continue routine treasury observation.",
    );
  }

  return uniqueStrings(actions.map((a) => sanitizeAdvisoryText(a, isSmallDollar))).slice(0, 5);
}

function buildDecisionSupportDeferredActions({
  decisionSupportStatus,
  digestIntelligence,
  scalingReadiness,
  governance,
  treasuryOperatingMode,
  isSmallDollar,
}) {
  const actions = [];
  const status = String(decisionSupportStatus || "monitoring").toLowerCase();
  const digestReadiness = String(digestIntelligence?.digestReadiness || "quiet").toLowerCase();

  if (status === "stable" || status === "monitoring") {
    for (const rec of (scalingReadiness?.recommendations || []).slice(0, 2)) {
      const sanitized = sanitizeAdvisoryText(rec, isSmallDollar);
      if (sanitized) actions.push(sanitized);
    }
    actions.push("Review scaling readiness when treasury posture remains stable.");
  }

  if (digestReadiness === "quiet" || digestReadiness === "monitoring") {
    actions.push("Defer digest preparation until additional moderate signals accumulate.");
  } else {
    actions.push("Prepare digest preview content when convenient — nothing sent or scheduled.");
  }

  for (const rec of (governance?.governanceRecommendations || []).slice(0, 1)) {
    const sanitized = sanitizeAdvisoryText(rec, isSmallDollar);
    if (sanitized) actions.push(sanitized);
  }

  for (const rec of (treasuryOperatingMode?.recommendations || []).slice(0, 1)) {
    const sanitized = sanitizeAdvisoryText(rec, isSmallDollar);
    if (sanitized) actions.push(sanitized);
  }

  if (actions.length === 0) {
    actions.push("Review historical analytics and snapshot cadence on the normal weekly schedule.");
  }

  return uniqueStrings(actions).slice(0, 5);
}

function buildDecisionSupportMonitoringRecommendations({
  treasuryCommandCenter,
  operationalGuidance,
  notificationReadiness,
  monitoringDashboard,
  isSmallDollar,
}) {
  const recs = [];

  for (const item of treasuryCommandCenter?.watchAreas || []) {
    const sanitized = sanitizeAdvisoryText(`Observe: ${item}`, isSmallDollar);
    if (sanitized) recs.push(sanitized);
  }

  for (const obs of operationalGuidance?.observations || []) {
    const sanitized = sanitizeAdvisoryText(String(obs), isSmallDollar);
    if (sanitized) recs.push(sanitized);
  }

  for (const check of operationalGuidance?.recommendedChecks || []) {
    const sanitized = sanitizeAdvisoryText(check, isSmallDollar);
    if (sanitized) recs.push(sanitized);
  }

  if ((notificationReadiness?.suppressedNotifications || []).length > 0) {
    recs.push(
      "Review suppressed notification items for observation context — no external delivery.",
    );
  }

  const momentum = String(monitoringDashboard?.treasuryMomentum || "").toLowerCase();
  if (momentum === "weakening" || momentum === "pressure") {
    recs.push("Monitor withdrawal concentration and treasury drift — observation only.");
  } else {
    recs.push("Monitor withdrawal concentration during routine treasury reviews.");
  }

  recs.push(
    isSmallDollar
      ? "Continue routine soft-launch treasury observation."
      : "Continue routine treasury observation.",
  );
  recs.push("Review treasury posture weekly.");

  return uniqueStrings(recs.map((r) => sanitizeAdvisoryText(r, isSmallDollar))).slice(0, 6);
}

function deriveDecisionSupportConfidence({
  alertReadiness,
  notificationReadiness,
  executiveEscalation,
  digestIntelligence,
  treasuryCommandCenter,
  readinessIndex,
  operationalGuidance,
  isSmallDollar,
}) {
  let confidence = Math.round(
    (Number(executiveEscalation?.escalationConfidence) || 0) * 0.25 +
      (Number(digestIntelligence?.confidence) || 0) * 0.2 +
      (Number(notificationReadiness?.notificationConfidence) || 0) * 0.2 +
      (Number(alertReadiness?.confidence) || 0) * 0.15 +
      (Number(treasuryCommandCenter?.confidence) || 0) * 0.1 +
      (Number(readinessIndex?.confidence) || 0) * 0.05 +
      (Number(operationalGuidance?.confidence) || 0) * 0.05,
  );
  confidence = clamp(confidence, 0, 100);
  if (isSmallDollar) confidence = Math.min(confidence, 82);
  return confidence;
}

function buildDecisionSupportSummary({
  decisionSupportStatus,
  treasuryRecommendations,
  priorityActions,
  isSmallDollar,
  confidence,
}) {
  const statusPhrases = {
    stable:
      "Treasury decision support indicates a stable advisory posture — continued observation is appropriate with no elevated human review required.",
    monitoring:
      "Treasury decision support recommends routine monitoring cadence — observe treasury posture weekly and reconcile advisory signals.",
    attention_recommended:
      "Treasury decision support suggests operator and leadership attention — review advisory recommendations and alert readiness without executing treasury changes.",
    leadership_review:
      "Treasury decision support warrants leadership review preparation — consolidate advisory synthesis for executive visibility; no actions executed or scheduled.",
  };

  let base =
    statusPhrases[String(decisionSupportStatus || "monitoring").toLowerCase()] || statusPhrases.monitoring;
  if (treasuryRecommendations.length > 0) {
    base += ` ${treasuryRecommendations.length} structured recommendation${treasuryRecommendations.length === 1 ? "" : "s"} inform advisory guidance.`;
  }
  if (priorityActions.length > 0) {
    base += ` ${priorityActions.length} priority consideration${priorityActions.length === 1 ? "" : "s"} merit near-term human review.`;
  }
  base += ` Confidence: ${confidence}/100.`;
  if (isSmallDollar) {
    base += " Soft-launch treasury environment — recommendations remain conservative and observational.";
  }
  base += " Advisory only — no actions executed or scheduled.";
  return base.trim();
}

/**
 * Pure advisory synthesis — treasury decision support intelligence from 3A–3H outputs.
 * READ-ONLY: no automation, delivery, financial mutations, or treasury actions.
 * @param {object} args
 */
export function buildTreasuryDecisionSupport({
  treasuryCommandCenter = {},
  operationalGuidance = {},
  readinessIndex = {},
  monitoringDashboard = {},
  treasuryAdminAlerts = {},
  alertReadiness = {},
  notificationReadiness = {},
  digestIntelligence = {},
  executiveEscalation = {},
  treasuryOperatingMode = {},
  governance = {},
  scalingReadiness = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const adminResult = treasuryAdminAlerts || {};
    const adminAlerts = adminResult.treasuryAdminAlerts || [];
    const adminAlertCount = adminAlerts.length;
    const readiness = alertReadiness || EMPTY_ALERT_READINESS;
    const escalation = executiveEscalation || EMPTY_EXECUTIVE_ESCALATION;
    const digest = digestIntelligence || EMPTY_DIGEST_INTELLIGENCE;
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });

    const commandStatus = String(treasuryCommandCenter.treasuryCommandStatus || "monitored").toLowerCase();
    const alertReadinessStatus = String(readiness.alertReadinessStatus || "quiet").toLowerCase();
    const notificationReadinessStatus = String(
      notificationReadiness?.notificationReadinessStatus || "quiet",
    ).toLowerCase();

    let decisionSupportStatus = deriveDecisionSupportStatus({
      commandStatus,
      alertReadinessStatus,
      notificationReadinessStatus,
      executiveAttentionStatus: escalation.executiveAttentionStatus,
      recommendedExecutiveCadence: escalation.recommendedExecutiveCadence,
      adminAlertCount,
      isSmallDollar,
    });

    if (isSmallDollar) {
      decisionSupportStatus = applySoftLaunchDecisionSupportCap(
        decisionSupportStatus,
        escalation.executiveAttentionStatus,
        alertReadinessStatus,
      );
    }

    const confidence = deriveDecisionSupportConfidence({
      alertReadiness: readiness,
      notificationReadiness,
      executiveEscalation: escalation,
      digestIntelligence: digest,
      treasuryCommandCenter,
      readinessIndex,
      operationalGuidance,
      isSmallDollar,
    });

    const treasuryRecommendations = buildDecisionSupportRecommendations({
      treasuryCommandCenter,
      operationalGuidance,
      readinessIndex,
      alertReadiness: readiness,
      executiveEscalation: escalation,
      digestIntelligence: digest,
      governance,
      treasuryOperatingMode,
      scalingReadiness,
      isSmallDollar,
      baseConfidence: confidence,
    });

    if (isSmallDollar) {
      for (const item of treasuryRecommendations) {
        if (item.priority === "high") item.priority = "elevated";
        else if (item.priority === "elevated") item.priority = "moderate";
        item.confidence = Math.min(item.confidence, 82);
      }
    }

    const priorityActions = buildDecisionSupportPriorityActions({
      decisionSupportStatus,
      alertReadiness: readiness,
      executiveEscalation: escalation,
      operationalGuidance,
      treasuryCommandCenter,
      notificationReadiness,
      isSmallDollar,
    });

    const deferredActions = buildDecisionSupportDeferredActions({
      decisionSupportStatus,
      digestIntelligence: digest,
      scalingReadiness,
      governance,
      treasuryOperatingMode,
      isSmallDollar,
    });

    const monitoringRecommendations = buildDecisionSupportMonitoringRecommendations({
      treasuryCommandCenter,
      operationalGuidance,
      notificationReadiness,
      monitoringDashboard,
      isSmallDollar,
    });

    const summary = buildDecisionSupportSummary({
      decisionSupportStatus,
      treasuryRecommendations,
      priorityActions,
      isSmallDollar,
      confidence,
    });

    void adminAlerts;

    return {
      decisionSupportStatus,
      treasuryRecommendations,
      priorityActions,
      deferredActions,
      monitoringRecommendations,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryDecisionSupport", err: err?.message || String(err) });
    return { ...EMPTY_DECISION_SUPPORT };
  }
}

export function formatDecisionSupportChipLabel(result) {
  const status = String(result?.decisionSupportStatus || "monitoring").toLowerCase();
  const labels = {
    stable: "Treasury decision support: Stable",
    monitoring: "Treasury decision support: Monitoring",
    attention_recommended: "Treasury decision support: Attention recommended",
    leadership_review: "Treasury decision support: Leadership review",
  };
  return labels[status] || labels.monitoring;
}

const EMPTY_INSTITUTIONAL_MEMORY = Object.freeze({
  institutionalMemoryStatus: "minimal_history",
  recurringPatterns: [],
  recurringRecommendations: [],
  historicalPosture: "observation",
  recurringSignals: [],
  confidence: 0,
  summary:
    "Treasury institutional memory is limited — continue routine observation as operational events accumulate. Advisory only.",
});

const STABLE_OPERATING_STATES = new Set([
  "normal_monitoring",
  "stable",
  "quiet",
]);

const STABLE_STATUS_VALUES = new Set([
  "quiet",
  "stable",
  "observe",
  "monitoring",
  "normal_monitoring",
]);

const LOW_MODERATE_SEVERITIES = new Set(["info", "low", "moderate"]);

const INSTITUTIONAL_MEMORY_RECENT_COUNT = 20;
const INSTITUTIONAL_MEMORY_RECENT_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function normalizeOperationalEvent(evt) {
  if (!evt) return null;
  if (evt.eventType) return evt;
  return mapEventRow(evt);
}

function eventMetadataFingerprint(meta = {}) {
  const m = meta && typeof meta === "object" ? meta : {};
  return [
    String(m.operatingState || "").toLowerCase(),
    String(m.treasuryAttentionLevel || "").toLowerCase(),
    String(m.alertReadinessStatus || "").toLowerCase(),
    String(m.executiveAttentionStatus || "").toLowerCase(),
    String(m.decisionSupportStatus || "").toLowerCase(),
  ].join("|");
}

function eventAttentionPostureKey(meta = {}) {
  const m = meta && typeof meta === "object" ? meta : {};
  return [
    String(m.treasuryAttentionLevel || "").toLowerCase(),
    String(m.executiveAttentionStatus || "").toLowerCase(),
    String(m.alertReadinessStatus || "").toLowerCase(),
    String(m.decisionSupportStatus || "").toLowerCase(),
  ].join("|");
}

function deriveEventHistoricalPosture(meta = {}) {
  const m = meta && typeof meta === "object" ? meta : {};
  const operatingState = String(m.operatingState || "normal_monitoring").toLowerCase();
  const attention = String(m.treasuryAttentionLevel || "low").toLowerCase();
  const alertStatus = String(m.alertReadinessStatus || "quiet").toLowerCase();
  const execStatus = String(m.executiveAttentionStatus || "observe").toLowerCase();
  const decisionStatus = String(m.decisionSupportStatus || "monitoring").toLowerCase();

  if (
    execStatus === "executive_review" ||
    execStatus === "leadership_attention" ||
    decisionStatus === "leadership_review" ||
    operatingState === "review_attention" ||
    attention === "high"
  ) {
    return "leadership_visibility";
  }

  if (
    operatingState === "elevated_monitoring" ||
    attention === "elevated" ||
    attention === "moderate" ||
    alertStatus === "ready_to_alert" ||
    alertStatus === "escalation_recommended" ||
    decisionStatus === "attention_recommended"
  ) {
    return "elevated_attention";
  }

  if (
    STABLE_OPERATING_STATES.has(operatingState) &&
    STABLE_STATUS_VALUES.has(alertStatus) &&
    (execStatus === "quiet" || execStatus === "observe") &&
    (decisionStatus === "stable" || decisionStatus === "monitoring")
  ) {
    return "stable";
  }

  return "observation";
}

/**
 * Groups operational events by event type and metadata posture fingerprint.
 * @param {Array<object>} events
 */
export function groupEventsByPattern(events = []) {
  const groups = new Map();
  for (const raw of events) {
    const evt = normalizeOperationalEvent(raw);
    if (!evt) continue;
    const eventType = String(evt.eventType || "unknown").toLowerCase();
    const fp = eventMetadataFingerprint(evt.metadata);
    const key = `${eventType}::${fp}`;
    const existing = groups.get(key);
    if (existing) {
      existing.frequency += 1;
      existing.events.push(evt);
    } else {
      groups.set(key, {
        pattern: eventType,
        fingerprint: fp,
        frequency: 1,
        events: [evt],
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.frequency - a.frequency);
}

/**
 * Aggregates mode historical posture across event metadata.
 * @param {Array<object>} events
 */
export function computeHistoricalPosture(events = []) {
  const counts = {
    stable: 0,
    observation: 0,
    elevated_attention: 0,
    leadership_visibility: 0,
  };

  for (const raw of events) {
    const evt = normalizeOperationalEvent(raw);
    if (!evt) continue;
    const posture = deriveEventHistoricalPosture(evt.metadata);
    counts[posture] = (counts[posture] || 0) + 1;
  }

  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (total === 0) return "observation";

  let best = "observation";
  let bestCount = -1;
  for (const [key, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Detects recurring attention/escalation posture in recent event window.
 * @param {Array<object>} events
 */
export function detectRecurringAttention(events = []) {
  const now = Date.now();
  const recent = [];
  for (const raw of events) {
    const evt = normalizeOperationalEvent(raw);
    if (!evt) continue;
    if (recent.length >= INSTITUTIONAL_MEMORY_RECENT_COUNT) break;
    const created = evt.createdAt ? new Date(evt.createdAt).getTime() : NaN;
    if (Number.isFinite(created) && now - created > INSTITUTIONAL_MEMORY_RECENT_DAYS_MS) continue;
    recent.push(evt);
  }

  const postureCounts = new Map();
  for (const evt of recent) {
    const key = eventAttentionPostureKey(evt.metadata);
    if (!key.replace(/\|/g, "").trim()) continue;
    postureCounts.set(key, (postureCounts.get(key) || 0) + 1);
  }

  for (const count of postureCounts.values()) {
    if (count >= 2) return true;
  }
  return false;
}

function summarizeRecurringPattern(pattern, frequency, isSmallDollar) {
  const type = String(pattern || "operational").replace(/_/g, " ");
  const n = Number(frequency) || 0;
  if (n <= 1) {
    return isSmallDollar
      ? `A single ${type} observation recorded during soft-launch monitoring.`
      : `A single ${type} observation recorded during recent monitoring cycles.`;
  }
  const phrase = isSmallDollar
    ? `${type} appeared on ${n} occasions during recent soft-launch monitoring — interpret cautiously.`
    : `${type} appeared on ${n} occasions during recent monitoring cycles.`;
  return softenText(
    phrase.charAt(0).toUpperCase() + phrase.slice(1),
    isSmallDollar,
  );
}

function eventShowsStableMonitoring(meta = {}) {
  const m = meta && typeof meta === "object" ? meta : {};
  const operatingState = String(m.operatingState || "").toLowerCase();
  const alertStatus = String(m.alertReadinessStatus || "quiet").toLowerCase();
  const decisionStatus = String(m.decisionSupportStatus || "").toLowerCase();
  return (
    STABLE_OPERATING_STATES.has(operatingState) ||
    STABLE_STATUS_VALUES.has(alertStatus) ||
    decisionStatus === "stable"
  );
}

function hasMonitoringPatternSignals(events = []) {
  const typeCounts = new Map();
  let lowModerateRepeats = 0;

  for (const raw of events) {
    const evt = normalizeOperationalEvent(raw);
    if (!evt) continue;
    const eventType = String(evt.eventType || "").toLowerCase();
    if (eventType) typeCounts.set(eventType, (typeCounts.get(eventType) || 0) + 1);
    const sev = String(evt.severity || "info").toLowerCase();
    if (LOW_MODERATE_SEVERITIES.has(sev)) lowModerateRepeats += 1;
  }

  for (const count of typeCounts.values()) {
    if (count >= 2) return true;
  }
  return lowModerateRepeats >= 3 && events.length >= 3;
}

function majorityStablePattern(events = []) {
  if (events.length === 0) return false;
  let stableCount = 0;
  for (const raw of events) {
    const evt = normalizeOperationalEvent(raw);
    if (!evt) continue;
    if (eventShowsStableMonitoring(evt.metadata)) stableCount += 1;
  }
  return stableCount / events.length >= 0.55;
}

function deriveInstitutionalMemoryStatus({
  eventCount,
  isSmallDollar,
  recurringAttention,
  stableMajority,
  monitoringPatterns,
}) {
  if (eventCount < 3 || (isSmallDollar && eventCount < 5)) return "minimal_history";
  if (recurringAttention) return "recurring_attention";
  if (stableMajority) return "stable_pattern";
  if (monitoringPatterns) return "monitoring_patterns";
  if (eventCount < 5) return "minimal_history";
  return "monitoring_patterns";
}

function buildRecurringSignalsFromHistory(events = [], treasuryAdminAlerts = {}) {
  const titleCounts = new Map();

  for (const raw of events) {
    const evt = normalizeOperationalEvent(raw);
    if (!evt) continue;
    const title = String(evt.title || "").trim();
    if (!title) continue;
    const key = title.toLowerCase();
    const existing = titleCounts.get(key);
    if (existing) {
      existing.frequency += 1;
    } else {
      titleCounts.set(key, {
        severity: String(evt.severity || "info").toLowerCase(),
        title,
        summary: String(evt.description || evt.title || "").trim() || title,
        frequency: 1,
      });
    }
  }

  const adminAlerts = treasuryAdminAlerts?.treasuryAdminAlerts || treasuryAdminAlerts || [];
  for (const alert of adminAlerts) {
    const title = String(alert?.title || alert?.headline || "").trim();
    if (!title) continue;
    const key = `alert:${title.toLowerCase()}`;
    const existing = titleCounts.get(key);
    if (existing) {
      existing.frequency += 1;
    } else {
      titleCounts.set(key, {
        severity: String(alert?.severity || alert?.priority || "moderate").toLowerCase(),
        title,
        summary: String(alert?.summary || alert?.reason || title).trim(),
        frequency: 1,
      });
    }
  }

  return [...titleCounts.values()]
    .filter((item) => item.frequency >= 2)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 6)
    .map(({ severity, title, summary }) => ({ severity, title, summary }));
}

function buildInstitutionalMemoryRecommendations({
  decisionSupport,
  recurringPatterns,
  historicalPosture,
  isSmallDollar,
}) {
  const recs = [];
  const ds = decisionSupport || {};

  for (const item of (ds.monitoringRecommendations || []).slice(0, 2)) {
    const text = sanitizeAdvisoryText(item, isSmallDollar);
    if (text) recs.push(text);
  }

  if (historicalPosture === "stable" || historicalPosture === "observation") {
    recs.push(
      isSmallDollar
        ? "Continue established weekly observation cadence during soft-launch."
        : "Continue established weekly observation cadence.",
    );
  }

  if (recurringPatterns.some((p) => p.frequency >= 2)) {
    recs.push(
      isSmallDollar
        ? "Treasury has repeatedly returned to stable monitoring after brief elevation — maintain calm continuity."
        : "Treasury has repeatedly returned to stable monitoring after brief elevation.",
    );
  }

  for (const item of (ds.priorityActions || []).slice(0, 1)) {
    const text = sanitizeAdvisoryText(item, isSmallDollar);
    if (text) recs.push(text);
  }

  if (recs.length === 0) {
    recs.push(
      isSmallDollar
        ? "Continue routine soft-launch treasury observation as events accumulate."
        : "Continue routine treasury observation as operational history develops.",
    );
  }

  return uniqueStrings(recs).slice(0, 5);
}

function deriveInstitutionalMemoryConfidence({
  eventCount,
  institutionalMemoryStatus,
  isSmallDollar,
  alertReadiness,
  decisionSupport,
}) {
  let confidence = clamp(Math.round(eventCount * 4 + 18), 0, 100);
  if (eventCount >= 10) confidence += 12;
  if (eventCount >= 25) confidence += 8;
  confidence += Math.round((Number(alertReadiness?.confidence) || 0) * 0.08);
  confidence += Math.round((Number(decisionSupport?.confidence) || 0) * 0.07);

  if (institutionalMemoryStatus === "minimal_history") confidence = Math.min(confidence, 48);
  if (institutionalMemoryStatus === "monitoring_patterns") confidence = Math.min(confidence, 72);
  if (isSmallDollar) confidence = Math.min(confidence, 82);
  if (institutionalMemoryStatus === "minimal_history" && isSmallDollar) {
    confidence = Math.min(confidence, 42);
  }

  return clamp(confidence, 0, 100);
}

function buildInstitutionalMemorySummary({
  institutionalMemoryStatus,
  historicalPosture,
  recurringPatterns,
  recurringRecommendations,
  eventCount,
  isSmallDollar,
  confidence,
}) {
  const statusPhrases = {
    minimal_history:
      "Treasury institutional memory is still forming — limited operational history suggests continued observation rather than pattern conclusions.",
    monitoring_patterns:
      "Treasury institutional memory recognizes repeating monitoring patterns — continuity favors steady observation cadence without escalation.",
    stable_pattern:
      "Treasury institutional memory reflects a predominantly stable monitoring pattern — recent events align with routine institutional expectations.",
    recurring_attention:
      "Treasury institutional memory notes recurring attention postures — leadership visibility may be helpful while posture remains advisory only.",
  };

  const posturePhrases = {
    stable: "Historical posture aggregates toward stable monitoring.",
    observation: "Historical posture remains observational across recent cycles.",
    elevated_attention: "Historical posture includes elevated attention intervals that merit human review.",
    leadership_visibility: "Historical posture includes leadership visibility themes — preparation only.",
  };

  let base =
    statusPhrases[String(institutionalMemoryStatus || "minimal_history").toLowerCase()] ||
    statusPhrases.minimal_history;
  base += ` ${posturePhrases[String(historicalPosture || "observation").toLowerCase()] || posturePhrases.observation}`;
  if (recurringPatterns.length > 0) {
    base += ` ${recurringPatterns.length} recurring pattern${recurringPatterns.length === 1 ? "" : "s"} inform continuity guidance.`;
  }
  if (recurringRecommendations.length > 0) {
    base += ` ${recurringRecommendations.length} continuity recommendation${recurringRecommendations.length === 1 ? "" : "s"} support established cadence.`;
  }
  base += ` Based on ${eventCount} recorded event${eventCount === 1 ? "" : "s"}; confidence ${confidence}/100.`;
  if (isSmallDollar) {
    base += " Soft-launch environment — memory interpretations remain intentionally conservative.";
  }
  base += " Advisory only — no learning models or automated adaptation.";
  return base.trim();
}

/**
 * Pure advisory synthesis — treasury institutional memory from operational event history.
 * READ-ONLY: observe history, recognize patterns, recommend continuity — no ML or mutations.
 * @param {object} args
 */
export function buildTreasuryInstitutionalMemory({
  treasuryOperationalEvents = [],
  treasuryAdminAlerts = {},
  digestIntelligence = {},
  executiveEscalation = {},
  decisionSupport = {},
  monitoringSummary = null,
  alertReadiness = {},
  treasuryCommandCenter = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const events = (treasuryOperationalEvents || [])
      .map(normalizeOperationalEvent)
      .filter(Boolean);
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const eventCount = events.length;

    const recurringAttention = detectRecurringAttention(events);
    const stableMajority = majorityStablePattern(events);
    const monitoringPatterns = hasMonitoringPatternSignals(events);

    const institutionalMemoryStatus = deriveInstitutionalMemoryStatus({
      eventCount,
      isSmallDollar,
      recurringAttention,
      stableMajority,
      monitoringPatterns,
    });

    const historicalPosture = computeHistoricalPosture(events);

    const recurringPatterns = groupEventsByPattern(events)
      .filter((g) => g.frequency >= 2)
      .slice(0, 6)
      .map((g) => ({
        pattern: g.pattern,
        frequency: g.frequency,
        summary: summarizeRecurringPattern(g.pattern, g.frequency, isSmallDollar),
      }));

    const recurringRecommendations = buildInstitutionalMemoryRecommendations({
      decisionSupport,
      recurringPatterns,
      historicalPosture,
      isSmallDollar,
    });

    const recurringSignals = buildRecurringSignalsFromHistory(events, treasuryAdminAlerts);

    const confidence = deriveInstitutionalMemoryConfidence({
      eventCount,
      institutionalMemoryStatus,
      isSmallDollar,
      alertReadiness,
      decisionSupport,
    });

    const summary = buildInstitutionalMemorySummary({
      institutionalMemoryStatus,
      historicalPosture,
      recurringPatterns,
      recurringRecommendations,
      eventCount,
      isSmallDollar,
      confidence,
    });

    void digestIntelligence;
    void executiveEscalation;
    void monitoringSummary;
    void treasuryCommandCenter;

    return {
      institutionalMemoryStatus,
      recurringPatterns,
      recurringRecommendations,
      historicalPosture,
      recurringSignals,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryInstitutionalMemory", err: err?.message || String(err) });
    return { ...EMPTY_INSTITUTIONAL_MEMORY };
  }
}

export function formatInstitutionalMemoryChipLabel(result) {
  const status = String(result?.institutionalMemoryStatus || "minimal_history").toLowerCase();
  const labels = {
    minimal_history: "Treasury memory: Minimal history",
    monitoring_patterns: "Treasury memory: Monitoring patterns",
    stable_pattern: "Treasury memory: Stable pattern",
    recurring_attention: "Treasury memory: Recurring attention",
  };
  return labels[status] || labels.minimal_history;
}

const EMPTY_CONFIDENCE_EXPLAINABILITY = Object.freeze({
  confidenceLevel: "low",
  confidenceScore: 0,
  explanationDrivers: [],
  supportingSignals: [],
  softeningFactors: [],
  summary:
    "Treasury operational confidence is limited — continue advisory observation as upstream signals accumulate. Advisory only.",
});

const QUIET_ALERT_READINESS = new Set(["quiet", "watch"]);
const STABLE_COMMAND_STATUSES = new Set(["stable", "monitored", "quiet", "normal"]);
const ELEVATED_ALERT_READINESS = new Set(["ready_to_alert", "escalation_recommended"]);
const ELEVATED_EXEC_ATTENTION = new Set(["leadership_attention", "executive_review"]);

function humanizeTreasuryToken(value) {
  return String(value || "unknown").replace(/_/g, " ");
}

function collectUpstreamConfidenceInputs({
  treasuryCommandCenter,
  readinessIndex,
  alertReadiness,
  notificationReadiness,
  digestIntelligence,
  executiveEscalation,
  decisionSupport,
  institutionalMemory,
  monitoringDashboard,
  operationalGuidance,
}) {
  const entries = [];
  const add = (value, weight) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    entries.push({ value: clamp(n, 0, 100), weight });
  };

  add(treasuryCommandCenter?.confidence, 0.15);
  add(readinessIndex?.confidence, 0.12);
  add(alertReadiness?.confidence, 0.14);
  add(notificationReadiness?.notificationConfidence, 0.1);
  add(digestIntelligence?.confidence, 0.12);
  add(executiveEscalation?.escalationConfidence, 0.12);
  add(decisionSupport?.confidence, 0.1);
  add(institutionalMemory?.confidence, 0.08);
  add(monitoringDashboard?.confidence, 0.04);
  add(operationalGuidance?.confidence, 0.03);

  return entries;
}

function deriveTreasuryAggregateConfidenceScore(inputs, adjustments) {
  const totalWeight = inputs.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;

  let score = inputs.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
  score += adjustments.increase - adjustments.decrease;
  return clamp(Math.round(score), 0, 100);
}

function assessTreasuryConfidenceAlignment({
  treasuryCommandCenter,
  readinessIndex,
  alertReadiness,
  executiveEscalation,
  decisionSupport,
  institutionalMemory,
}) {
  const commandStatus = String(treasuryCommandCenter?.treasuryCommandStatus || "monitored").toLowerCase();
  const alertStatus = String(alertReadiness?.alertReadinessStatus || "quiet").toLowerCase();
  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "minimal_history").toLowerCase();
  const execStatus = String(executiveEscalation?.executiveAttentionStatus || "observe").toLowerCase();
  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "monitoring").toLowerCase();
  const launchSignal = String(readinessIndex?.treasuryLaunchSignal || "").toLowerCase();

  let increase = 0;
  let decrease = 0;
  const supportingSignals = [];
  const softeningFactors = [];

  if (memoryStatus === "stable_pattern" && QUIET_ALERT_READINESS.has(alertStatus)) {
    increase += 6;
    supportingSignals.push("Confidence increased due to repeated stable treasury posture.");
  }
  if (QUIET_ALERT_READINESS.has(alertStatus) && STABLE_COMMAND_STATUSES.has(commandStatus)) {
    increase += 5;
    supportingSignals.push("Alert readiness remains quiet while command center posture stays stable.");
  }
  if (
    STABLE_COMMAND_STATUSES.has(commandStatus) &&
    (launchSignal === "stable" || launchSignal === "monitoring" || launchSignal === "ready")
  ) {
    increase += 4;
    supportingSignals.push("Readiness index and command center signals align on steady monitoring.");
  }
  if (decisionStatus === "stable" && (execStatus === "quiet" || execStatus === "observe")) {
    increase += 4;
    supportingSignals.push("Decision support and executive attention both indicate calm advisory posture.");
  }
  if (memoryStatus === "stable_pattern" && decisionStatus === "stable") {
    increase += 3;
  }

  if (ELEVATED_ALERT_READINESS.has(alertStatus) && STABLE_COMMAND_STATUSES.has(commandStatus)) {
    decrease += 10;
    softeningFactors.push("Mixed signals between alert readiness and command center posture.");
  }
  if (memoryStatus === "minimal_history") {
    decrease += 8;
    softeningFactors.push("Confidence reduced due to limited historical treasury patterns.");
  }
  if (ELEVATED_EXEC_ATTENTION.has(execStatus) && QUIET_ALERT_READINESS.has(alertStatus)) {
    decrease += 7;
    softeningFactors.push("Executive escalation posture diverges from quiet alert readiness.");
  }
  if (ELEVATED_ALERT_READINESS.has(alertStatus) && (execStatus === "quiet" || execStatus === "observe")) {
    decrease += 5;
  }
  if (memoryStatus === "recurring_attention" && QUIET_ALERT_READINESS.has(alertStatus)) {
    decrease += 4;
    softeningFactors.push("Institutional memory shows recurring attention despite current quiet alert readiness.");
  }

  const aligned =
    increase >= 8 &&
    decrease <= 4 &&
    QUIET_ALERT_READINESS.has(alertStatus) &&
    STABLE_COMMAND_STATUSES.has(commandStatus);

  return {
    increase,
    decrease,
    supportingSignals: uniqueStrings(supportingSignals),
    softeningFactors: uniqueStrings(softeningFactors),
    aligned,
  };
}

function deriveTreasuryConfidenceLevel(score, isSmallDollar) {
  let level = "low";
  if (score >= 75) level = "high";
  else if (score >= 45) level = "moderate";

  if (isSmallDollar && level === "high") {
    level = "moderate";
  }

  return level;
}

function buildConfidenceExplanationDrivers({
  treasuryCommandCenter,
  readinessIndex,
  alertReadiness,
  notificationReadiness,
  digestIntelligence,
  executiveEscalation,
  decisionSupport,
  institutionalMemory,
  operationalGuidance,
  monitoringDashboard,
}) {
  const commandStatus = String(treasuryCommandCenter?.treasuryCommandStatus || "monitored").toLowerCase();
  const alertStatus = String(alertReadiness?.alertReadinessStatus || "quiet").toLowerCase();
  const notificationStatus = String(
    notificationReadiness?.notificationReadinessStatus || "quiet",
  ).toLowerCase();
  const digestReadiness = String(digestIntelligence?.digestReadiness || "not_ready").toLowerCase();
  const execStatus = String(executiveEscalation?.executiveAttentionStatus || "observe").toLowerCase();
  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "monitoring").toLowerCase();
  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "minimal_history").toLowerCase();
  const operationalStatus = String(operationalGuidance?.operationalStatus || "monitoring").toLowerCase();
  const launchSignal = String(readinessIndex?.treasuryLaunchSignal || "monitoring").toLowerCase();

  const rawDrivers = [
    {
      title: "Command center posture",
      explanation: `Treasury command status indicates ${humanizeTreasuryToken(commandStatus)} monitoring with ${humanizeTreasuryToken(treasuryCommandCenter?.treasuryAttentionLevel || "low")} priority.`,
      weight: 22,
    },
    {
      title: "Alert readiness status",
      explanation: `Alert readiness is ${humanizeTreasuryToken(alertStatus)} — ${humanizeTreasuryToken(alertReadiness?.alertPosture || "quiet")} advisory posture.`,
      weight: 18,
    },
    {
      title: "Notification posture",
      explanation: `Notification readiness is ${humanizeTreasuryToken(notificationStatus)} with ${humanizeTreasuryToken(notificationReadiness?.recommendedNotificationPosture || "observe")} recommended posture.`,
      weight: 12,
    },
    {
      title: "Digest readiness",
      explanation: `Digest intelligence readiness is ${humanizeTreasuryToken(digestReadiness)} for advisory reporting cadence.`,
      weight: 12,
    },
    {
      title: "Executive attention",
      explanation: `Executive escalation posture is ${humanizeTreasuryToken(execStatus)} with ${humanizeTreasuryToken(executiveEscalation?.escalationPriority || "routine")} priority.`,
      weight: 14,
    },
    {
      title: "Decision support status",
      explanation: `Decision support status is ${humanizeTreasuryToken(decisionStatus)} — human review guidance only.`,
      weight: 12,
    },
    {
      title: "Institutional memory",
      explanation: `Institutional memory status is ${humanizeTreasuryToken(memoryStatus)} with ${humanizeTreasuryToken(institutionalMemory?.historicalPosture || "observation")} historical posture.`,
      weight: 10,
    },
    {
      title: "Readiness and guidance",
      explanation: `Launch signal ${humanizeTreasuryToken(launchSignal)} aligns with ${humanizeTreasuryToken(operationalStatus)} operational guidance and ${humanizeTreasuryToken(monitoringDashboard?.treasuryMomentum || "stable")} monitoring momentum.`,
      weight: 10,
    },
  ];

  const totalRaw = rawDrivers.reduce((sum, item) => sum + item.weight, 0);
  return rawDrivers.slice(0, 8).map((item) => ({
    title: item.title,
    explanation: item.explanation,
    weight: totalRaw > 0 ? Math.round((item.weight / totalRaw) * 100) : item.weight,
  }));
}

function normalizeDriverWeights(drivers) {
  if (!drivers.length) return drivers;
  const sum = drivers.reduce((total, item) => total + (Number(item.weight) || 0), 0);
  if (sum === 100 || sum <= 0) return drivers;
  const scaled = drivers.map((item) => ({
    ...item,
    weight: Math.round(((Number(item.weight) || 0) / sum) * 100),
  }));
  const drift = 100 - scaled.reduce((total, item) => total + item.weight, 0);
  if (drift !== 0) scaled[0].weight = clamp(scaled[0].weight + drift, 0, 100);
  return scaled;
}

function buildTreasuryConfidenceSummary({
  confidenceLevel,
  confidenceScore,
  explanationDrivers,
  softeningFactors,
  isSmallDollar,
}) {
  const levelPhrase = {
    high: "high",
    moderate: "moderate",
    low: "low",
  };
  const level = levelPhrase[String(confidenceLevel || "low").toLowerCase()] || "low";
  const topDrivers = (explanationDrivers || []).slice(0, 3).map((item) => item.title.toLowerCase());
  let base = `Treasury assesses operational conclusions with ${level} confidence (${confidenceScore}/100) because ${topDrivers.join(", ") || "upstream monitoring signals"} shape the current advisory posture.`;
  if (softeningFactors.length > 0) {
    base += ` ${softeningFactors[0]}`;
  } else if (isSmallDollar) {
    base += " Soft-launch testing environment detected; certainty intentionally softened.";
  }
  base += " Advisory explainability only — no automated actions.";
  return base.trim();
}

/**
 * Pure advisory synthesis — treasury confidence and explainability from Phase 3C–3J outputs.
 * READ-ONLY: explain and clarify operational conclusions — no automation or treasury actions.
 * @param {object} args
 */
export function buildTreasuryConfidenceExplainability({
  monitoringDashboard = {},
  treasuryAdminAlerts = {},
  alertReadiness = {},
  notificationReadiness = {},
  digestIntelligence = {},
  executiveEscalation = {},
  decisionSupport = {},
  institutionalMemory = {},
  operationalGuidance = {},
  readinessIndex = {},
  treasuryCommandCenter = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const inputs = collectUpstreamConfidenceInputs({
      treasuryCommandCenter,
      readinessIndex,
      alertReadiness,
      notificationReadiness,
      digestIntelligence,
      executiveEscalation,
      decisionSupport,
      institutionalMemory,
      monitoringDashboard,
      operationalGuidance,
    });
    const alignment = assessTreasuryConfidenceAlignment({
      treasuryCommandCenter,
      readinessIndex,
      alertReadiness,
      executiveEscalation,
      decisionSupport,
      institutionalMemory,
    });

    let confidenceScore = deriveTreasuryAggregateConfidenceScore(inputs, alignment);
    if (isSmallDollar) confidenceScore = Math.min(confidenceScore, 82);

    const confidenceLevel = deriveTreasuryConfidenceLevel(confidenceScore, isSmallDollar);
    const explanationDrivers = normalizeDriverWeights(
      buildConfidenceExplanationDrivers({
        treasuryCommandCenter,
        readinessIndex,
        alertReadiness,
        notificationReadiness,
        digestIntelligence,
        executiveEscalation,
        decisionSupport,
        institutionalMemory,
        operationalGuidance,
        monitoringDashboard,
      }),
    );

    const supportingSignals = [...alignment.supportingSignals];
    if (STABLE_COMMAND_STATUSES.has(String(treasuryCommandCenter?.treasuryCommandStatus || "").toLowerCase())) {
      supportingSignals.push("Command center strengths indicate stable advisory monitoring.");
    }
    if (QUIET_ALERT_READINESS.has(String(alertReadiness?.alertReadinessStatus || "").toLowerCase())) {
      supportingSignals.push("Low alert readiness reduces urgency in current operational conclusions.");
    }

    const softeningFactors = [...alignment.softeningFactors];
    if (isSmallDollar) {
      softeningFactors.push("Soft-launch testing environment detected; certainty intentionally softened.");
    }

    const summary = buildTreasuryConfidenceSummary({
      confidenceLevel,
      confidenceScore,
      explanationDrivers,
      softeningFactors: uniqueStrings(softeningFactors),
      isSmallDollar,
    });

    void treasuryAdminAlerts;
    void monitoringDashboard?.treasuryWatchFlags;

    return {
      confidenceLevel,
      confidenceScore,
      explanationDrivers,
      supportingSignals: uniqueStrings(supportingSignals).slice(0, 8),
      softeningFactors: uniqueStrings(softeningFactors).slice(0, 6),
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryConfidenceExplainability", err: err?.message || String(err) });
    return { ...EMPTY_CONFIDENCE_EXPLAINABILITY };
  }
}

export function formatTreasuryConfidenceChipLabel(result) {
  const level = String(result?.confidenceLevel || "low").toLowerCase();
  const labels = {
    high: "Treasury confidence: High",
    moderate: "Treasury confidence: Moderate",
    low: "Treasury confidence: Low",
  };
  return labels[level] || labels.low;
}

const EMPTY_CONSISTENCY_CHECK = Object.freeze({
  consistencyStatus: "aligned",
  contradictionSignals: [],
  alignedSignals: [],
  reconciliationSuggestions: [],
  confidence: 0,
  summary:
    "Treasury recommendation layers are not yet available — continue advisory observation. Consistency check only; no outputs overridden.",
});

const ALERT_READINESS_RANK = Object.freeze({
  quiet: 0,
  watch: 1,
  ready_to_alert: 2,
  escalation_recommended: 3,
});

const EXECUTIVE_ATTENTION_RANK = Object.freeze({
  quiet: 0,
  observe: 1,
  leadership_attention: 2,
  executive_review: 3,
});

const NOTIFICATION_READINESS_RANK = Object.freeze({
  quiet: 0,
  monitoring: 1,
  digest_ready: 2,
  escalation_ready: 3,
});

const DIGEST_READINESS_RANK = Object.freeze({
  quiet: 0,
  monitoring: 1,
  digest_ready: 2,
  executive_digest_ready: 3,
});

const DECISION_SUPPORT_RANK = Object.freeze({
  stable: 0,
  monitoring: 1,
  attention_recommended: 2,
  leadership_review: 3,
});

const HISTORICAL_POSTURE_RANK = Object.freeze({
  stable: 0,
  observation: 1,
  elevated_attention: 2,
  leadership_visibility: 3,
});

const EXECUTIVE_CADENCE_RANK = Object.freeze({
  none: 0,
  weekly: 1,
  daily: 2,
  immediate_review: 3,
});

const OPERATIONAL_STATUS_RANK = Object.freeze({
  healthy: 0,
  monitor: 1,
  monitoring: 1,
  elevated_attention: 2,
  high_attention: 3,
});

function layerStatusRank(map, value, fallback = 0) {
  const key = String(value || "").toLowerCase();
  return map[key] ?? fallback;
}

function downgradeConsistencyStatusOneNotch(status) {
  const key = String(status || "aligned").toLowerCase();
  if (key === "contradictory") return "mixed_signals";
  if (key === "mixed_signals") return "minor_conflicts";
  if (key === "minor_conflicts") return "aligned";
  return "aligned";
}

function digestToneScore(text) {
  const t = String(text || "").toLowerCase();
  let score = 0;
  if (
    /elevated|escalat|leadership review|executive|urgent|attention recommended|digest-ready|prepare/.test(
      t,
    )
  ) {
    score += 2;
  }
  if (/monitor|watch|moderate/.test(t)) score += 1;
  if (/routine|optional|stable|baseline|quiet|no material/.test(t)) score -= 2;
  return score;
}

function assessDigestCadenceToneMismatch(digestIntelligence) {
  const daily = digestIntelligence?.dailyDigest;
  const weekly = digestIntelligence?.weeklyDigest;
  if (!daily || !weekly) return null;

  const dailyText = [daily.headline, daily.summary, ...(daily.recommendations || [])].join(" ");
  const weeklyText = [weekly.headline, weekly.summary, ...(weekly.recommendations || [])].join(" ");
  const dailyScore = digestToneScore(dailyText);
  const weeklyScore = digestToneScore(weeklyText);
  const gap = Math.abs(dailyScore - weeklyScore);

  if (gap < 3) return null;

  const dailyUrgent = dailyScore >= 2 && weeklyScore <= 0;
  const weeklyUrgent = weeklyScore >= 2 && dailyScore <= 0;
  if (!dailyUrgent && !weeklyUrgent) {
    if (gap < 4) return null;
  }

  const severity = gap >= 4 || dailyUrgent || weeklyUrgent ? "moderate" : "low";
  return {
    severity,
    title: "Daily and weekly digest tone differ",
    explanation:
      dailyUrgent
        ? "Daily digest framing suggests closer review while weekly synthesis remains routine — compare cadence before leadership routing."
        : weeklyUrgent
          ? "Weekly digest framing suggests elevated review while daily snapshot remains calm — align digest previews before escalation."
          : "Daily and weekly digest previews emphasize different urgency — review both cadences together.",
  };
}

function buildTreasuryConsistencyAlignedSignals({
  alertReadiness,
  notificationReadiness,
  executiveEscalation,
  decisionSupport,
  institutionalMemory,
  digestIntelligence,
  operationalGuidance,
}) {
  const aligned = [];
  const alertStatus = String(alertReadiness?.alertReadinessStatus || "quiet").toLowerCase();
  const notifStatus = String(notificationReadiness?.notificationReadinessStatus || "quiet").toLowerCase();
  const execStatus = String(executiveEscalation?.executiveAttentionStatus || "observe").toLowerCase();
  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "monitoring").toLowerCase();
  const digestReadiness = String(digestIntelligence?.digestReadiness || "quiet").toLowerCase();
  const historicalPosture = String(institutionalMemory?.historicalPosture || "observation").toLowerCase();
  const operationalStatus = String(operationalGuidance?.operationalStatus || "monitor").toLowerCase();

  if (
    QUIET_ALERT_READINESS.has(alertStatus) &&
    (notifStatus === "quiet" || notifStatus === "monitoring")
  ) {
    aligned.push("Alert readiness and notification readiness both indicate routine monitoring.");
  }

  if (
    (execStatus === "quiet" || execStatus === "observe") &&
    (decisionStatus === "stable" || decisionStatus === "monitoring")
  ) {
    aligned.push("Decision support and executive escalation both indicate calm advisory posture.");
  }

  if (
    Math.abs(
      layerStatusRank(NOTIFICATION_READINESS_RANK, notifStatus) -
        layerStatusRank(DIGEST_READINESS_RANK, digestReadiness),
    ) <= 1
  ) {
    aligned.push("Notification readiness and digest readiness suggest a similar reporting cadence.");
  }

  if (
    historicalPosture === "stable" &&
    (decisionStatus === "stable" || decisionStatus === "monitoring") &&
    QUIET_ALERT_READINESS.has(alertStatus)
  ) {
    aligned.push("Institutional memory stable pattern aligns with current quiet monitoring posture.");
  }

  if (
    layerStatusRank(OPERATIONAL_STATUS_RANK, operationalStatus) <= 1 &&
    QUIET_ALERT_READINESS.has(alertStatus)
  ) {
    aligned.push("Operational guidance posture aligns with current alert readiness level.");
  }

  if (
    (digestReadiness === "quiet" || digestReadiness === "monitoring") &&
    (execStatus === "quiet" || execStatus === "observe")
  ) {
    aligned.push("Digest readiness and executive attention both favor observation over escalation.");
  }

  return uniqueStrings(aligned).slice(0, 6);
}

function buildTreasuryReconciliationSuggestions({
  contradictionSignals,
  consistencyStatus,
  isSmallDollar,
}) {
  const suggestions = [];
  const titles = new Set((contradictionSignals || []).map((s) => s.title));

  if (titles.has("Alert readiness vs executive attention")) {
    suggestions.push(
      "Review alert readiness suppressed signals before escalating executive cadence.",
    );
  }
  if (
    titles.has("Decision support vs executive attention") ||
    titles.has("Institutional memory vs executive cadence")
  ) {
    suggestions.push(
      "Consider weighting executive escalation context against institutional memory stable pattern.",
    );
  }
  if (
    consistencyStatus === "mixed_signals" ||
    consistencyStatus === "contradictory" ||
    titles.has("High confidence with mixed layer postures")
  ) {
    suggestions.push(
      "Some treasury recommendations suggest closer review while other signals remain stable.",
    );
  }
  if (titles.has("Notification readiness vs digest readiness")) {
    suggestions.push(
      "Compare notification routing posture with digest preview cadence before preparing leadership summaries.",
    );
  }
  if (titles.has("Operational guidance vs alert readiness")) {
    suggestions.push(
      "Reconcile operational guidance attention level with alert readiness before changing monitoring cadence.",
    );
  }
  if (titles.has("Daily and weekly digest tone differ")) {
    suggestions.push(
      "Review daily and weekly digest previews together so leadership cadence matches operational tone.",
    );
  }

  if (suggestions.length === 0 && consistencyStatus === "minor_conflicts") {
    suggestions.push(
      "Minor advisory wording differences across layers — no treasury action implied; continue human review.",
    );
  }

  if (suggestions.length === 0 && consistencyStatus === "aligned") {
    suggestions.push("Treasury recommendation layers are broadly aligned — continue routine advisory observation.");
  }

  return uniqueStrings(
    suggestions.map((s) => (isSmallDollar ? softenText(s, true) : s)),
  ).slice(0, 5);
}

function deriveTreasuryConsistencyConfidence({
  consistencyStatus,
  confidenceExplainability,
  contradictionCount,
  alignedCount,
  isSmallDollar,
}) {
  const base = Number(confidenceExplainability?.confidenceScore);
  let score = Number.isFinite(base) ? base : 50;

  if (consistencyStatus === "aligned") score += 8;
  else if (consistencyStatus === "minor_conflicts") score -= 4;
  else if (consistencyStatus === "mixed_signals") score -= 14;
  else if (consistencyStatus === "contradictory") score -= 22;

  score += Math.min(alignedCount * 3, 9);
  score -= Math.min(contradictionCount * 5, 20);

  if (isSmallDollar) score = Math.min(score, 82);

  return clamp(Math.round(score), 0, 100);
}

function buildTreasuryConsistencySummary({
  consistencyStatus,
  contradictionSignals,
  alignedSignals,
  isSmallDollar,
}) {
  const statusPhrase = {
    aligned: "broadly aligned",
    minor_conflicts: "showing minor advisory conflicts",
    mixed_signals: "presenting mixed signals across layers",
    contradictory: "showing notable contradictions across recommendation layers",
  };
  const phrase = statusPhrase[String(consistencyStatus || "aligned").toLowerCase()] || statusPhrase.aligned;
  const conflictCount = (contradictionSignals || []).length;
  const alignCount = (alignedSignals || []).length;

  let base = `Treasury recommendation consistency check: layers are ${phrase}`;
  if (alignCount > 0) {
    base += ` with ${alignCount} aligned signal${alignCount === 1 ? "" : "s"}`;
  }
  if (conflictCount > 0) {
    base += ` and ${conflictCount} contradiction signal${conflictCount === 1 ? "" : "s"} to review`;
  }
  base += ". Advisory consistency only — no outputs overridden.";
  if (isSmallDollar) {
    base = softenText(base, true);
  }
  return base.trim();
}

function aggregateTreasuryConsistencyStatus(contradictionSignals, isSmallDollar) {
  const signals = contradictionSignals || [];
  const highCount = signals.filter((s) => s.severity === "high" || s.severity === "elevated").length;
  const moderateCount = signals.filter((s) => s.severity === "moderate").length;

  let status = "aligned";
  if (signals.length === 0) {
    status = "aligned";
  } else if (highCount >= 1 || signals.length >= 3) {
    status = "contradictory";
  } else if (moderateCount >= 2 || (moderateCount >= 1 && signals.length >= 2)) {
    status = "mixed_signals";
  } else {
    status = "minor_conflicts";
  }

  if (isSmallDollar && status !== "aligned") {
    status = downgradeConsistencyStatusOneNotch(status);
  }

  return status;
}

function collectTreasuryContradictionSignals({
  executiveEscalation,
  decisionSupport,
  institutionalMemory,
  confidenceExplainability,
  digestIntelligence,
  operationalGuidance,
  alertReadiness,
  notificationReadiness,
}) {
  const signals = [];
  const push = (severity, title, explanation) => {
    signals.push({
      severity: normalizeSeverity(severity),
      title: String(title || "Consistency signal"),
      explanation: String(explanation || "").trim(),
    });
  };

  const alertStatus = String(alertReadiness?.alertReadinessStatus || "quiet").toLowerCase();
  const execStatus = String(executiveEscalation?.executiveAttentionStatus || "observe").toLowerCase();
  const notifStatus = String(notificationReadiness?.notificationReadinessStatus || "quiet").toLowerCase();
  const digestReadiness = String(digestIntelligence?.digestReadiness || "quiet").toLowerCase();
  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "monitoring").toLowerCase();
  const historicalPosture = String(institutionalMemory?.historicalPosture || "observation").toLowerCase();
  const execCadence = String(executiveEscalation?.recommendedExecutiveCadence || "weekly").toLowerCase();
  const operationalStatus = String(operationalGuidance?.operationalStatus || "monitor").toLowerCase();
  const confidenceLevel = String(confidenceExplainability?.confidenceLevel || "low").toLowerCase();

  const alertExecGap = Math.abs(
    layerStatusRank(ALERT_READINESS_RANK, alertStatus) -
      layerStatusRank(EXECUTIVE_ATTENTION_RANK, execStatus),
  );
  if (QUIET_ALERT_READINESS.has(alertStatus) && execStatus === "executive_review") {
    push(
      "high",
      "Alert readiness vs executive attention",
      "Alert readiness remains quiet while executive escalation recommends executive review — weigh suppressed alert signals before leadership routing.",
    );
  } else if (alertExecGap >= 2) {
    push(
      alertExecGap >= 3 ? "elevated" : "moderate",
      "Alert readiness vs executive attention",
      `Alert readiness (${humanizeTreasuryToken(alertStatus)}) and executive attention (${humanizeTreasuryToken(execStatus)}) diverge — compare layers before changing cadence.`,
    );
  } else if (alertExecGap === 1 && ELEVATED_EXEC_ATTENTION.has(execStatus) && QUIET_ALERT_READINESS.has(alertStatus)) {
    push(
      "low",
      "Alert readiness vs executive attention",
      "Executive attention is slightly elevated relative to quiet alert readiness — interpret as advisory mixed signal at soft-launch scale.",
    );
  }

  const notifDigestGap = Math.abs(
    layerStatusRank(NOTIFICATION_READINESS_RANK, notifStatus) -
      layerStatusRank(DIGEST_READINESS_RANK, digestReadiness),
  );
  if (notifDigestGap >= 2) {
    push(
      notifDigestGap >= 3 ? "moderate" : "low",
      "Notification readiness vs digest readiness",
      `Notification readiness (${humanizeTreasuryToken(notifStatus)}) and digest readiness (${humanizeTreasuryToken(digestReadiness)}) suggest different reporting urgency.`,
    );
  }

  const decisionExecGap = Math.abs(
    layerStatusRank(DECISION_SUPPORT_RANK, decisionStatus) -
      layerStatusRank(EXECUTIVE_ATTENTION_RANK, execStatus),
  );
  if (decisionStatus === "stable" && ELEVATED_EXEC_ATTENTION.has(execStatus)) {
    push(
      "elevated",
      "Decision support vs executive attention",
      "Decision support remains stable while executive escalation suggests leadership review — reconcile before prioritizing actions.",
    );
  } else if (decisionStatus === "stable" && execStatus === "leadership_attention") {
    push(
      "moderate",
      "Decision support vs executive attention",
      "Decision support is stable while executive attention recommends leadership visibility.",
    );
  } else if (decisionExecGap >= 2 && decisionStatus !== "monitoring") {
    push(
      "moderate",
      "Decision support vs executive attention",
      `Decision support (${humanizeTreasuryToken(decisionStatus)}) and executive attention (${humanizeTreasuryToken(execStatus)}) are not harmonized.`,
    );
  }

  const postureCadenceGap = Math.abs(
    layerStatusRank(HISTORICAL_POSTURE_RANK, historicalPosture) -
      layerStatusRank(EXECUTIVE_CADENCE_RANK, execCadence),
  );
  if (historicalPosture === "stable" && execCadence === "immediate_review") {
    push(
      "elevated",
      "Institutional memory vs executive cadence",
      "Historical posture is stable while executive cadence recommends immediate review — weight institutional memory against escalation context.",
    );
  } else if (historicalPosture === "stable" && execCadence === "daily" && postureCadenceGap >= 2) {
    push(
      "moderate",
      "Institutional memory vs executive cadence",
      "Stable historical pattern contrasts with a daily executive cadence recommendation.",
    );
  } else if (postureCadenceGap >= 3) {
    push(
      "low",
      "Institutional memory vs executive cadence",
      `Historical posture (${humanizeTreasuryToken(historicalPosture)}) and executive cadence (${humanizeTreasuryToken(execCadence)}) differ in urgency.`,
    );
  }

  const opAlertGap = Math.abs(
    layerStatusRank(OPERATIONAL_STATUS_RANK, operationalStatus) -
      layerStatusRank(ALERT_READINESS_RANK, alertStatus),
  );
  if (
    layerStatusRank(OPERATIONAL_STATUS_RANK, operationalStatus) >= 2 &&
    QUIET_ALERT_READINESS.has(alertStatus)
  ) {
    push(
      opAlertGap >= 3 ? "moderate" : "low",
      "Operational guidance vs alert readiness",
      `Operational guidance (${humanizeTreasuryToken(operationalStatus)}) suggests elevated attention while alert readiness remains ${humanizeTreasuryToken(alertStatus)}.`,
    );
  }

  const elevatedLayerCount = [
    ELEVATED_ALERT_READINESS.has(alertStatus),
    ELEVATED_EXEC_ATTENTION.has(execStatus),
    layerStatusRank(DECISION_SUPPORT_RANK, decisionStatus) >= 2,
    layerStatusRank(DIGEST_READINESS_RANK, digestReadiness) >= 2,
  ].filter(Boolean).length;

  if (
    confidenceLevel === "high" &&
    elevatedLayerCount >= 1 &&
    QUIET_ALERT_READINESS.has(alertStatus)
  ) {
    push(
      "moderate",
      "High confidence with mixed layer postures",
      "Confidence explainability is high while alert readiness remains quiet and other layers show elevated posture — treat confidence as directional, not definitive.",
    );
  } else if (confidenceLevel === "high" && elevatedLayerCount >= 2) {
    push(
      "low",
      "High confidence with mixed layer postures",
      "High aggregate confidence coexists with divergent layer statuses — review explanation drivers alongside this check.",
    );
  }

  const digestMismatch = assessDigestCadenceToneMismatch(digestIntelligence);
  if (digestMismatch) {
    push(digestMismatch.severity, digestMismatch.title, digestMismatch.explanation);
  }

  return signals.slice(0, 8);
}

/**
 * Pure advisory synthesis — cross-layer treasury recommendation consistency.
 * READ-ONLY: observe, explain, reconcile — no overrides, automation, or treasury mutations.
 * @param {object} args
 */
export function buildTreasuryConsistencyCheck({
  executiveEscalation = {},
  decisionSupport = {},
  institutionalMemory = {},
  confidenceExplainability = {},
  digestIntelligence = {},
  operationalGuidance = {},
  alertReadiness = {},
  notificationReadiness = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });

    const contradictionSignals = collectTreasuryContradictionSignals({
      executiveEscalation,
      decisionSupport,
      institutionalMemory,
      confidenceExplainability,
      digestIntelligence,
      operationalGuidance,
      alertReadiness,
      notificationReadiness,
    });

    let consistencyStatus = aggregateTreasuryConsistencyStatus(contradictionSignals, isSmallDollar);

    const alignedSignals = buildTreasuryConsistencyAlignedSignals({
      alertReadiness,
      notificationReadiness,
      executiveEscalation,
      decisionSupport,
      institutionalMemory,
      digestIntelligence,
      operationalGuidance,
    });

    const reconciliationSuggestions = buildTreasuryReconciliationSuggestions({
      contradictionSignals,
      consistencyStatus,
      isSmallDollar,
    });

    const confidence = deriveTreasuryConsistencyConfidence({
      consistencyStatus,
      confidenceExplainability,
      contradictionCount: contradictionSignals.length,
      alignedCount: alignedSignals.length,
      isSmallDollar,
    });

    const summary = buildTreasuryConsistencySummary({
      consistencyStatus,
      contradictionSignals,
      alignedSignals,
      isSmallDollar,
    });

    void liabilities;
    void exposure;

    return {
      consistencyStatus,
      contradictionSignals,
      alignedSignals,
      reconciliationSuggestions,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryConsistencyCheck", err: err?.message || String(err) });
    return { ...EMPTY_CONSISTENCY_CHECK };
  }
}

export function formatTreasuryConsistencyChipLabel(result) {
  const status = String(result?.consistencyStatus || "aligned").toLowerCase();
  const labels = {
    aligned: "Treasury consistency: Aligned",
    minor_conflicts: "Treasury consistency: Minor conflicts",
    mixed_signals: "Treasury consistency: Mixed signals",
    contradictory: "Treasury consistency: Contradictory",
  };
  return labels[status] || labels.aligned;
}

/**
 * Admin home treasury attention summary — latest event metadata (fail-open).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function fetchTreasuryAdminAttentionSummary(supabase) {
  const client = supabase || defaultClient;
  const fallback = {
    treasuryAdminAlerts: [],
    alertSummary: "Treasury advisory posture unavailable — open Treasury Intelligence.",
    alertCounts: emptyAlertCounts(),
    alertPosture: "quiet",
    href: "/admin/treasury-intelligence",
  };

  if (!client) {
    return { ...fallback, error: "no_client" };
  }

  try {
    const { data, error } = await client
      .from("treasury_operational_events")
      .select("metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) {
        return { ...fallback, tableMissing: true };
      }
      warn({ op: "fetchTreasuryAdminAttentionSummary", err: error.message });
      return fallback;
    }

    const meta = data?.metadata && typeof data.metadata === "object" ? data.metadata : {};
    const built = buildTreasuryAdminAlertsFromMetadata(meta);
    return {
      ...built,
      href: "/admin/treasury-intelligence",
      updatedAt: data?.created_at || null,
      advisoryOnly: true,
    };
  } catch (err) {
    warn({ op: "fetchTreasuryAdminAttentionSummary", err: err?.message || String(err) });
    return fallback;
  }
}

export async function fetchTreasuryMonitoringChipSummary(supabase) {
  const client = supabase || defaultClient;
  if (!client) {
    return { label: "Treasury: Monitoring", href: "/admin/treasury-intelligence", error: "no_client" };
  }

  try {
    const { data, error } = await client
      .from("treasury_operational_events")
      .select("metadata, severity, event_type, created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMissingTableError(error)) {
        return { label: "Treasury: Monitoring", href: "/admin/treasury-intelligence", tableMissing: true };
      }
      warn({ op: "fetchTreasuryMonitoringChipSummary", err: error.message });
      return { label: "Treasury: Monitoring", href: "/admin/treasury-intelligence" };
    }

    const meta = data?.metadata && typeof data.metadata === "object" ? data.metadata : {};
    const label = formatTreasuryMonitoringChipLabel({
      operatingState: meta.operatingState,
      treasuryAttentionLevel: meta.treasuryAttentionLevel,
    });
    const alertReadinessLabel = meta.alertReadinessStatus
      ? formatAlertReadinessChipLabel({ alertReadinessStatus: meta.alertReadinessStatus })
      : null;
    const notificationReadinessLabel = meta.notificationReadinessStatus
      ? formatNotificationReadinessChipLabel({ notificationReadinessStatus: meta.notificationReadinessStatus })
      : null;
    const digestReadinessLabel = meta.digestReadiness
      ? formatTreasuryDigestChipLabel({ digestReadiness: meta.digestReadiness })
      : null;
    const executiveEscalationLabel = meta.executiveAttentionStatus
      ? formatExecutiveEscalationChipLabel({ executiveAttentionStatus: meta.executiveAttentionStatus })
      : null;
    const decisionSupportLabel = meta.decisionSupportStatus
      ? formatDecisionSupportChipLabel({ decisionSupportStatus: meta.decisionSupportStatus })
      : null;
    const institutionalMemoryLabel = meta.institutionalMemoryStatus
      ? formatInstitutionalMemoryChipLabel({ institutionalMemoryStatus: meta.institutionalMemoryStatus })
      : null;
    const confidenceLabel = meta.confidenceLevel
      ? formatTreasuryConfidenceChipLabel({ confidenceLevel: meta.confidenceLevel })
      : null;
    const consistencyLabel = meta.consistencyStatus
      ? formatTreasuryConsistencyChipLabel({ consistencyStatus: meta.consistencyStatus })
      : null;
    const narrativeLabel = meta.treasuryNarrativeStatus
      ? formatTreasuryRiskNarrativeChipLabel({ treasuryNarrativeStatus: meta.treasuryNarrativeStatus })
      : null;
    const playbookLabel = meta.playbookStatus
      ? formatTreasuryOperationalPlaybookChipLabel({ playbookStatus: meta.playbookStatus })
      : null;
    const scenarioResponseLabel = meta.responseStatus
      ? formatTreasuryScenarioResponseChipLabel({ responseStatus: meta.responseStatus })
      : meta.treasuryScenario
        ? formatTreasuryScenarioResponseChipLabel({
            responseStatus: mapTreasuryScenarioToResponseStatus(meta.treasuryScenario),
          })
        : null;
    const timelineLabel = meta.timelineStatus
      ? formatTreasuryOperatorTimelineChipLabel({ timelineStatus: meta.timelineStatus })
      : null;
    const priorityLabel = meta.priorityStatus
      ? formatTreasuryAttentionPriorityChipLabel({ priorityStatus: meta.priorityStatus })
      : null;
    const coherenceLabel = meta.coherenceStatus
      ? formatTreasuryOperationalCoherenceChipLabel({ coherenceStatus: meta.coherenceStatus })
      : null;
    const adaptiveCadenceLabel =
      meta.recommendedCadence || meta.cadenceStatus
        ? formatTreasuryAdaptiveReviewCadenceChipLabel({
            recommendedCadence: meta.recommendedCadence,
            cadenceStatus: meta.cadenceStatus,
          })
        : null;
    const leadershipReadinessLabel = meta.readinessStatus
      ? formatTreasuryLeadershipReadinessChipLabel({ readinessStatus: meta.readinessStatus })
      : null;
    const metaReasoningLabel = meta.trustStatus
      ? formatTreasuryMetaReasoningChipLabel({ trustStatus: meta.trustStatus })
      : null;
    const decisionTraceLabel = meta.traceStatus
      ? formatTreasuryDecisionTraceChipLabel({ traceStatus: meta.traceStatus })
      : null;
    const recommendationStabilityLabel = meta.stabilityStatus
      ? formatTreasuryRecommendationStabilityChipLabel({ stabilityStatus: meta.stabilityStatus })
      : null;
    const advisoryDriftLabel = meta.advisoryDriftStatus
      ? formatTreasuryAdvisoryDriftChipLabel({ driftStatus: meta.advisoryDriftStatus })
      : null;
    const regimeLabel = meta.regime
      ? formatTreasuryRegimeDetectionChipLabel({ regime: meta.regime })
      : null;
    const outlookLabel = meta.outlook
      ? formatTreasuryAdvisoryOutlookChipLabel({ outlook: meta.outlook })
      : null;

    return {
      label,
      alertReadinessLabel,
      notificationReadinessLabel,
      digestReadinessLabel,
      executiveEscalationLabel,
      decisionSupportLabel,
      institutionalMemoryLabel,
      confidenceLabel,
      consistencyLabel,
      narrativeLabel,
      playbookLabel,
      scenarioResponseLabel,
      timelineLabel,
      priorityLabel,
      coherenceLabel,
      adaptiveCadenceLabel,
      leadershipReadinessLabel,
      metaReasoningLabel,
      decisionTraceLabel,
      recommendationStabilityLabel,
      advisoryDriftLabel,
      regimeLabel,
      outlookLabel,
      href: "/admin/treasury-intelligence",
      operatingState: meta.operatingState || null,
      treasuryAttentionLevel: meta.treasuryAttentionLevel || null,
      alertReadinessStatus: meta.alertReadinessStatus || null,
      notificationReadinessStatus: meta.notificationReadinessStatus || null,
      digestReadiness: meta.digestReadiness || null,
      executiveAttentionStatus: meta.executiveAttentionStatus || null,
      escalationPriority: meta.escalationPriority || null,
      decisionSupportStatus: meta.decisionSupportStatus || null,
      institutionalMemoryStatus: meta.institutionalMemoryStatus || null,
      confidenceLevel: meta.confidenceLevel || null,
      confidenceScore: meta.confidenceScore ?? null,
      consistencyStatus: meta.consistencyStatus || null,
      treasuryNarrativeStatus: meta.treasuryNarrativeStatus || null,
      playbookStatus: meta.playbookStatus || null,
      responseStatus: meta.responseStatus || null,
      treasuryScenario: meta.treasuryScenario || null,
      timelineStatus: meta.timelineStatus || null,
      priorityStatus: meta.priorityStatus || null,
      coherenceStatus: meta.coherenceStatus || null,
      cadenceStatus: meta.cadenceStatus || null,
      recommendedCadence: meta.recommendedCadence || null,
      readinessStatus: meta.readinessStatus || null,
      visibilityTier: meta.visibilityTier || null,
      trustStatus: meta.trustStatus || null,
      traceStatus: meta.traceStatus || null,
      stabilityStatus: meta.stabilityStatus || null,
      advisoryDriftStatus: meta.advisoryDriftStatus || null,
      regime: meta.regime || null,
      outlook: meta.outlook || null,
      updatedAt: data?.created_at || null,
    };
  } catch (err) {
    warn({ op: "fetchTreasuryMonitoringChipSummary", err: err?.message || String(err) });
    return { label: "Treasury: Monitoring", href: "/admin/treasury-intelligence" };
  }
}

const EMPTY_TREASURY_RISK_NARRATIVE = Object.freeze({
  treasuryNarrativeStatus: "monitoring",
  operatorPosture: "observe",
  operatorSummary:
    "Treasury operational narrative is unavailable — continue routine advisory observation until upstream signals stabilize.",
  leadershipContext:
    "Leadership context is limited while treasury operational layers synthesize — maintain calm institutional review cadence.",
  watchItems: [],
  operatorRecommendations: ["Continue routine treasury observation — advisory monitoring only."],
  confidence: 0,
  summary:
    "Treasury risk narrative unavailable — advisory monitoring only. No actions executed.",
});

const FORBIDDEN_NARRATIVE_PHRASES = Object.freeze([
  "in danger",
  "crisis",
  "emergency",
  "broken",
  "freeze",
  "block payouts",
  ...FORBIDDEN_DECISION_PHRASES,
]);

const CALM_INSTITUTIONAL_MEMORY = new Set(["stable_pattern", "minimal_history"]);
const STABLE_COMMAND_FOR_NARRATIVE = new Set(["stable", "healthy", "monitored", "quiet", "normal"]);

function isForbiddenNarrativeText(text) {
  const lower = String(text || "").toLowerCase();
  return FORBIDDEN_NARRATIVE_PHRASES.some((phrase) => lower.includes(phrase));
}

function sanitizeNarrativeText(text, isSmallDollar) {
  const t = String(text || "").trim();
  if (!t || isForbiddenNarrativeText(t)) return "";
  return isSmallDollar ? softenText(t, true) : t;
}

function downgradeTreasuryNarrativeStatusOneNotch(status) {
  const key = String(status || "monitoring").toLowerCase();
  if (key === "leadership_visibility") return "elevated_attention";
  if (key === "elevated_attention") return "monitoring";
  if (key === "monitoring") return "calm";
  return "calm";
}

function hasElevatedEscalationAlerts(executiveEscalation) {
  const signals = executiveEscalation?.escalationSignals || [];
  return signals.some((s) => isLevelIn(String(s?.severity || "").toLowerCase(), ["elevated", "high"]));
}

function deriveTreasuryNarrativeStatus({
  treasuryCommandCenter,
  executiveEscalation,
  decisionSupport,
  institutionalMemory,
  consistencyCheck,
  isSmallDollar,
}) {
  const commandStatus = String(treasuryCommandCenter?.treasuryCommandStatus || "monitored").toLowerCase();
  const execStatus = String(executiveEscalation?.executiveAttentionStatus || "observe").toLowerCase();
  const execCadence = String(executiveEscalation?.recommendedExecutiveCadence || "weekly").toLowerCase();
  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "monitoring").toLowerCase();
  const consistencyStatus = String(consistencyCheck?.consistencyStatus || "aligned").toLowerCase();
  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "minimal_history").toLowerCase();

  if (
    execStatus === "executive_review" ||
    decisionStatus === "leadership_review" ||
    execCadence === "immediate_review"
  ) {
    return "leadership_visibility";
  }

  if (
    execStatus === "leadership_attention" ||
    decisionStatus === "attention_recommended" ||
    hasElevatedEscalationAlerts(executiveEscalation)
  ) {
    return "elevated_attention";
  }

  if (
    execStatus === "observe" ||
    decisionStatus === "monitoring" ||
    consistencyStatus === "minor_conflicts" ||
    memoryStatus === "monitoring_patterns"
  ) {
    return "monitoring";
  }

  if (
    STABLE_COMMAND_FOR_NARRATIVE.has(commandStatus) &&
    decisionStatus === "stable" &&
    consistencyStatus === "aligned" &&
    CALM_INSTITUTIONAL_MEMORY.has(memoryStatus)
  ) {
    return "calm";
  }

  if (consistencyStatus === "mixed_signals" || consistencyStatus === "contradictory") {
    return "monitoring";
  }

  return decisionStatus === "stable" ? "calm" : "monitoring";
}

function deriveOperatorPosture({
  treasuryNarrativeStatus,
  executiveEscalation,
  decisionSupport,
  consistencyCheck,
}) {
  const narrativeStatus = String(treasuryNarrativeStatus || "monitoring").toLowerCase();
  const execStatus = String(executiveEscalation?.executiveAttentionStatus || "observe").toLowerCase();
  const execCadence = String(executiveEscalation?.recommendedExecutiveCadence || "weekly").toLowerCase();
  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "monitoring").toLowerCase();
  const consistencyStatus = String(consistencyCheck?.consistencyStatus || "aligned").toLowerCase();

  if (
    narrativeStatus === "leadership_visibility" ||
    execStatus === "executive_review" ||
    decisionStatus === "leadership_review" ||
    execCadence === "immediate_review"
  ) {
    return "leadership_visibility";
  }

  if (
    decisionStatus === "attention_recommended" ||
    execStatus === "leadership_attention" ||
    hasElevatedEscalationAlerts(executiveEscalation)
  ) {
    return "elevated_review";
  }

  if (
    narrativeStatus === "elevated_attention" ||
    consistencyStatus === "mixed_signals" ||
    consistencyStatus === "contradictory"
  ) {
    return "review";
  }

  return "observe";
}

function buildRiskNarrativeOperatorSummary({
  treasuryCommandCenter,
  decisionSupport,
  consistencyCheck,
  operationalGuidance,
  treasuryNarrativeStatus,
  operatorPosture,
  isSmallDollar,
}) {
  const parts = [];
  const commandSummary = sanitizeNarrativeText(treasuryCommandCenter?.summary, isSmallDollar);
  const decisionSummary = sanitizeNarrativeText(decisionSupport?.summary, isSmallDollar);
  const consistencySummary = sanitizeNarrativeText(consistencyCheck?.summary, isSmallDollar);

  if (commandSummary) {
    parts.push(commandSummary);
  } else {
    const cmdStatus = humanizeTreasuryToken(treasuryCommandCenter?.treasuryCommandStatus || "monitored");
    parts.push(`Treasury command center posture remains ${cmdStatus} under advisory observation.`);
  }

  if (decisionSummary) {
    parts.push(decisionSummary);
  } else {
    parts.push(
      `Decision support suggests ${humanizeTreasuryToken(decisionSupport?.decisionSupportStatus || "monitoring")} — review recommendations without executing changes.`,
    );
  }

  if (consistencySummary && String(consistencyCheck?.consistencyStatus || "") !== "aligned") {
    parts.push(consistencySummary);
  } else if (operatorPosture === "observe") {
    parts.push("Cross-layer consistency is broadly aligned — continue calm observation.");
  }

  const watchFlags = uniqueStrings([
    ...(treasuryCommandCenter?.watchAreas || []),
    ...(operationalGuidance?.watchItems || []),
  ]).slice(0, 2);
  if (watchFlags.length > 0 && treasuryNarrativeStatus !== "calm") {
    parts.push(
      `Monitoring signals include ${watchFlags.map((w) => sanitizeNarrativeText(w, isSmallDollar)).filter(Boolean).join("; ")} — treat as watch areas, not alarms.`,
    );
  }

  return uniqueStrings(parts.map((p) => sanitizeNarrativeText(p, isSmallDollar)))
    .slice(0, 4)
    .join(" ");
}

function buildRiskNarrativeLeadershipContext({
  executiveBriefing,
  executiveEscalation,
  digestIntelligence,
  isSmallDollar,
}) {
  const parts = [];
  const briefingSummary = sanitizeNarrativeText(
    executiveBriefing?.briefingSummary || executiveBriefing?.summary,
    isSmallDollar,
  );
  const leadershipSummary = sanitizeNarrativeText(executiveEscalation?.leadershipSummary, isSmallDollar);
  const weeklyHeadline = sanitizeNarrativeText(digestIntelligence?.weeklyDigest?.headline, isSmallDollar);
  const weeklySummary = sanitizeNarrativeText(digestIntelligence?.weeklyDigest?.summary, isSmallDollar);

  if (briefingSummary) parts.push(briefingSummary);
  if (leadershipSummary) parts.push(leadershipSummary);
  if (weeklyHeadline) parts.push(weeklyHeadline);
  if (weeklySummary) parts.push(weeklySummary);

  if (parts.length === 0) {
    const execStatus = humanizeTreasuryToken(executiveEscalation?.executiveAttentionStatus || "observe");
    parts.push(
      `Executive escalation posture is ${execStatus} — leadership visibility remains advisory and observational.`,
    );
  }

  return uniqueStrings(parts).slice(0, 3).join(" ");
}

function collectRiskNarrativeWatchItems({
  treasuryCommandCenter,
  decisionSupport,
  institutionalMemory,
  consistencyCheck,
  isSmallDollar,
}) {
  const items = [];

  for (const area of treasuryCommandCenter?.watchAreas || []) {
    const text = sanitizeNarrativeText(area, isSmallDollar);
    if (text) items.push(text);
  }

  for (const rec of decisionSupport?.monitoringRecommendations || []) {
    const text = sanitizeNarrativeText(rec, isSmallDollar);
    if (text) items.push(text);
  }

  for (const signal of institutionalMemory?.recurringSignals || []) {
    const title = sanitizeNarrativeText(signal?.title, isSmallDollar);
    if (title) items.push(title);
  }

  for (const contradiction of consistencyCheck?.contradictionSignals || []) {
    const title = sanitizeNarrativeText(contradiction?.title, isSmallDollar);
    if (title) items.push(`Watch — ${title}`);
  }

  return uniqueStrings(items).slice(0, 10);
}

function collectRiskNarrativeOperatorRecommendations({
  decisionSupport,
  consistencyCheck,
  isSmallDollar,
}) {
  const items = [];

  for (const action of decisionSupport?.priorityActions || []) {
    const text = sanitizeNarrativeText(action, isSmallDollar);
    if (text) items.push(text);
  }

  for (const rec of decisionSupport?.monitoringRecommendations || []) {
    const text = sanitizeNarrativeText(rec, isSmallDollar);
    if (text) items.push(text);
  }

  for (const suggestion of consistencyCheck?.reconciliationSuggestions || []) {
    const text = sanitizeNarrativeText(suggestion, isSmallDollar);
    if (text) items.push(text);
  }

  const out = uniqueStrings(items).slice(0, 8);
  if (out.length === 0) {
    out.push(
      isSmallDollar
        ? "Continue routine treasury observation at soft-launch scale — advisory only."
        : "Continue routine treasury observation — advisory only.",
    );
  }
  return out;
}

function deriveRiskNarrativeConfidence({
  confidenceExplainability,
  consistencyCheck,
  decisionSupport,
  isSmallDollar,
}) {
  const explainScore = Number(confidenceExplainability?.confidenceScore);
  const consistencyScore = Number(consistencyCheck?.confidence);
  const decisionScore = Number(decisionSupport?.confidence);

  const weights = [];
  if (Number.isFinite(explainScore)) weights.push({ value: explainScore, weight: 0.4 });
  if (Number.isFinite(consistencyScore)) weights.push({ value: consistencyScore, weight: 0.35 });
  if (Number.isFinite(decisionScore)) weights.push({ value: decisionScore, weight: 0.25 });

  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;

  let score = weights.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
  score = clamp(Math.round(score), 0, isSmallDollar ? 82 : 100);
  return score;
}

function buildRiskNarrativeSummaryParagraph({
  treasuryNarrativeStatus,
  operatorPosture,
  confidence,
  isSmallDollar,
}) {
  const statusPhrase = humanizeTreasuryToken(treasuryNarrativeStatus);
  const posturePhrase = humanizeTreasuryToken(operatorPosture);
  let base = `Treasury risk narrative: ${statusPhrase} posture with operator stance ${posturePhrase} (confidence ${confidence}/100).`;
  base += " Advisory narrative only — no treasury actions executed.";
  if (isSmallDollar) {
    base = `Soft-launch advisory: ${base}`;
  }
  return sanitizeNarrativeText(base, false) || base;
}

/**
 * Pure advisory synthesis — treasury risk narrative and operator context from Phase 3A–3L outputs.
 * READ-ONLY: explain, contextualize, guide — no automation, delivery, or financial mutations.
 * @param {object} args
 */
export function buildTreasuryRiskNarrative({
  treasuryCommandCenter = {},
  executiveBriefing = {},
  digestIntelligence = {},
  executiveEscalation = {},
  decisionSupport = {},
  institutionalMemory = {},
  confidenceExplainability = {},
  consistencyCheck = {},
  readinessIndex = {},
  operationalGuidance = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });

    let treasuryNarrativeStatus = deriveTreasuryNarrativeStatus({
      treasuryCommandCenter,
      executiveEscalation,
      decisionSupport,
      institutionalMemory,
      consistencyCheck,
      isSmallDollar,
    });

    if (isSmallDollar) {
      treasuryNarrativeStatus = downgradeTreasuryNarrativeStatusOneNotch(treasuryNarrativeStatus);
    }

    const operatorPosture = deriveOperatorPosture({
      treasuryNarrativeStatus,
      executiveEscalation,
      decisionSupport,
      consistencyCheck,
    });

    const confidence = deriveRiskNarrativeConfidence({
      confidenceExplainability,
      consistencyCheck,
      decisionSupport,
      isSmallDollar,
    });

    const operatorSummary = buildRiskNarrativeOperatorSummary({
      treasuryCommandCenter,
      decisionSupport,
      consistencyCheck,
      operationalGuidance,
      treasuryNarrativeStatus,
      operatorPosture,
      isSmallDollar,
    });

    const leadershipContext = buildRiskNarrativeLeadershipContext({
      executiveBriefing,
      executiveEscalation,
      digestIntelligence,
      isSmallDollar,
    });

    const watchItems = collectRiskNarrativeWatchItems({
      treasuryCommandCenter,
      decisionSupport,
      institutionalMemory,
      consistencyCheck,
      isSmallDollar,
    });

    const operatorRecommendations = collectRiskNarrativeOperatorRecommendations({
      decisionSupport,
      consistencyCheck,
      isSmallDollar,
    });

    let summary = buildRiskNarrativeSummaryParagraph({
      treasuryNarrativeStatus,
      operatorPosture,
      confidence,
      isSmallDollar,
    });

    void readinessIndex;

    return {
      treasuryNarrativeStatus,
      operatorPosture,
      operatorSummary,
      leadershipContext,
      watchItems,
      operatorRecommendations,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryRiskNarrative", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_RISK_NARRATIVE };
  }
}

export function formatTreasuryRiskNarrativeChipLabel(result) {
  const status = String(result?.treasuryNarrativeStatus || "monitoring").toLowerCase();
  const labels = {
    calm: "Treasury narrative: Calm",
    monitoring: "Treasury narrative: Monitoring",
    elevated_attention: "Treasury narrative: Elevated attention",
    leadership_visibility: "Treasury narrative: Leadership visibility",
  };
  return labels[status] || labels.monitoring;
}

const EMPTY_TREASURY_OPERATIONAL_PLAYBOOK = Object.freeze({
  playbookStatus: "monitoring_mode",
  operatorCadence: "weekly_review",
  recommendedPlaybook: ["Continue treasury observation and monitor signal clustering."],
  watchChecklist: [],
  escalationGuidance: [
    "Review consistency reconciliation suggestions before escalating cadence.",
  ],
  confidence: 0,
  summary:
    "Treasury operational playbook unavailable — continue advisory monitoring only. No actions executed.",
});

const FORBIDDEN_PLAYBOOK_PHRASES = Object.freeze([
  "emergency treasury intervention",
  "freeze",
  "block payouts",
  "trigger intervention",
  ...FORBIDDEN_DECISION_PHRASES,
]);

function isForbiddenPlaybookText(text) {
  const lower = String(text || "").toLowerCase();
  return FORBIDDEN_PLAYBOOK_PHRASES.some((phrase) => lower.includes(phrase));
}

function sanitizePlaybookText(text, isSmallDollar) {
  const t = String(text || "").trim();
  if (!t || isForbiddenPlaybookText(t)) return "";
  return isSmallDollar ? softenText(t, true) : t;
}

function derivePlaybookStatus({
  treasuryRiskNarrative,
  decisionSupport,
  executiveEscalation,
  treasuryCommandCenter,
  consistencyCheck,
}) {
  const narrativeStatus = String(treasuryRiskNarrative?.treasuryNarrativeStatus || "monitoring").toLowerCase();
  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "monitoring").toLowerCase();
  const execStatus = String(executiveEscalation?.executiveAttentionStatus || "observe").toLowerCase();
  const execCadence = String(executiveEscalation?.recommendedExecutiveCadence || "weekly").toLowerCase();
  const commandStatus = String(treasuryCommandCenter?.treasuryCommandStatus || "monitored").toLowerCase();
  const consistencyStatus = String(consistencyCheck?.consistencyStatus || "aligned").toLowerCase();
  const operatorPosture = String(treasuryRiskNarrative?.operatorPosture || "observe").toLowerCase();

  if (
    narrativeStatus === "leadership_visibility" ||
    execStatus === "executive_review" ||
    execCadence === "immediate_review" ||
    execCadence === "daily"
  ) {
    return "leadership_visibility";
  }

  if (
    narrativeStatus === "elevated_attention" ||
    decisionStatus === "attention_recommended" ||
    operatorPosture === "review" ||
    operatorPosture === "elevated_review"
  ) {
    return "elevated_review";
  }

  if (
    narrativeStatus === "monitoring" ||
    decisionStatus === "monitoring" ||
    execStatus === "observe" ||
    execCadence === "weekly"
  ) {
    return "monitoring_mode";
  }

  if (
    narrativeStatus === "calm" &&
    decisionStatus === "stable" &&
    STABLE_COMMAND_FOR_NARRATIVE.has(commandStatus) &&
    consistencyStatus === "aligned"
  ) {
    return "routine_operations";
  }

  return decisionStatus === "stable" ? "routine_operations" : "monitoring_mode";
}

function downgradePlaybookStatusOneNotch(status) {
  const key = String(status || "monitoring_mode").toLowerCase();
  if (key === "leadership_visibility") return "elevated_review";
  if (key === "elevated_review") return "monitoring_mode";
  if (key === "monitoring_mode") return "routine_operations";
  return "routine_operations";
}

function deriveOperatorCadenceFromPlaybook(playbookStatus, executiveEscalation) {
  const execCadence = String(executiveEscalation?.recommendedExecutiveCadence || "weekly").toLowerCase();
  const status = String(playbookStatus || "monitoring_mode").toLowerCase();

  let cadence = "weekly_review";
  if (status === "routine_operations") cadence = "routine";
  else if (status === "monitoring_mode") cadence = "weekly_review";
  else if (status === "elevated_review") cadence = "daily_review";
  else if (status === "leadership_visibility") cadence = "immediate_visibility";

  if (execCadence === "immediate_review") {
    cadence = "immediate_visibility";
  } else if (execCadence === "daily" && cadence === "weekly_review") {
    cadence = "daily_review";
  } else if (execCadence === "weekly" && cadence === "immediate_visibility") {
    cadence = "weekly_review";
  } else if (execCadence === "none" && status === "routine_operations") {
    cadence = "routine";
  }

  return cadence;
}

function downgradeOperatorCadenceOneNotch(cadence) {
  const key = String(cadence || "weekly_review").toLowerCase();
  if (key === "immediate_visibility") return "daily_review";
  if (key === "daily_review") return "weekly_review";
  if (key === "weekly_review") return "routine";
  return "routine";
}

function applySoftLaunchPlaybookCaps({
  playbookStatus,
  operatorCadence,
  elevatedSignalCount,
}) {
  let status = downgradePlaybookStatusOneNotch(playbookStatus);
  let cadence = downgradeOperatorCadenceOneNotch(operatorCadence);

  if (cadence === "immediate_visibility" && elevatedSignalCount < 2) {
    cadence = "weekly_review";
  }
  if (status === "leadership_visibility" && elevatedSignalCount < 2) {
    status = "elevated_review";
  }

  if (cadence === "daily_review" && elevatedSignalCount < 2) {
    cadence = "weekly_review";
  }

  return { playbookStatus: status, operatorCadence: cadence };
}

function buildPlaybookRecommendations(playbookStatus, isSmallDollar) {
  const status = String(playbookStatus || "monitoring_mode").toLowerCase();
  const base = [];

  if (status === "routine_operations") {
    base.push(
      "Maintain routine treasury review cadence.",
      "Continue standard reconciliation observation.",
      "Review readiness index on established snapshot rhythm.",
    );
  } else if (status === "monitoring_mode") {
    base.push(
      "Continue treasury observation and monitor signal clustering.",
      "Review treasury posture on weekly cadence.",
      "Track institutional memory patterns without changing operating procedures.",
    );
  } else if (status === "elevated_review") {
    base.push(
      "Conduct closer treasury monitoring review.",
      "Cross-check alert readiness with command center posture.",
      "Compare decision support recommendations against consistency reconciliation notes.",
    );
  } else if (status === "leadership_visibility") {
    base.push(
      "Prepare leadership visibility summary from digest intelligence.",
      "Review executive escalation reasons before cadence change.",
      "Document aligned and conflicting signals for human leadership review.",
    );
  } else {
    base.push("Continue treasury observation and monitor signal clustering.");
  }

  base.push("Advisory playbook only — no treasury actions executed.");

  const out = uniqueStrings(
    base.map((item) => sanitizePlaybookText(item, isSmallDollar)).filter(Boolean),
  ).slice(0, 8);

  while (out.length < 4) {
    const filler = sanitizePlaybookText(
      "Continue advisory treasury observation aligned with current institutional posture.",
      isSmallDollar,
    );
    if (filler && !out.includes(filler)) out.push(filler);
    else break;
  }

  return out.slice(0, 8);
}

function collectPlaybookWatchChecklist({
  treasuryRiskNarrative,
  decisionSupport,
  readinessIndex,
  treasuryOperatingMode,
  isSmallDollar,
}) {
  const items = [];

  for (const item of treasuryRiskNarrative?.watchItems || []) {
    const text = sanitizePlaybookText(item, isSmallDollar);
    if (text) items.push(text);
  }

  for (const rec of decisionSupport?.monitoringRecommendations || []) {
    const text = sanitizePlaybookText(rec, isSmallDollar);
    if (text) items.push(text);
  }

  for (const area of readinessIndex?.watchAreas || []) {
    const text = sanitizePlaybookText(area, isSmallDollar);
    if (text) items.push(text);
  }

  for (const area of treasuryOperatingMode?.watchAreas || []) {
    const text = sanitizePlaybookText(area, isSmallDollar);
    if (text) items.push(text);
  }

  for (const rec of (treasuryOperatingMode?.recommendations || []).slice(0, 2)) {
    const text = sanitizePlaybookText(rec, isSmallDollar);
    if (text) items.push(text);
  }

  return uniqueStrings(items).slice(0, 10);
}

function buildPlaybookEscalationGuidance({
  playbookStatus,
  consistencyCheck,
  executiveEscalation,
  isSmallDollar,
}) {
  const items = [
    "Consider leadership visibility if elevated signals persist across two monitoring cycles.",
    "Review consistency reconciliation suggestions before escalating cadence.",
    "Escalation remains a human decision — this playbook does not automate cadence changes.",
  ];

  for (const suggestion of consistencyCheck?.reconciliationSuggestions || []) {
    const text = sanitizePlaybookText(suggestion, isSmallDollar);
    if (text) items.push(`Before escalating cadence: ${text}`);
  }

  if (String(playbookStatus || "").toLowerCase() === "elevated_review") {
    items.push(
      "If elevated review persists, consider preparing a leadership visibility briefing — advisory preparation only.",
    );
  }

  if (String(executiveEscalation?.executiveAttentionStatus || "").toLowerCase() === "executive_review") {
    items.push(
      "Executive escalation recommends leadership review — confirm reasons align with observed treasury signals.",
    );
  }

  return uniqueStrings(items.map((item) => sanitizePlaybookText(item, isSmallDollar)).filter(Boolean)).slice(
    0,
    6,
  );
}

function derivePlaybookConfidence({
  treasuryRiskNarrative,
  decisionSupport,
  confidenceExplainability,
  consistencyCheck,
  isSmallDollar,
}) {
  const weights = [];
  const narrativeScore = Number(treasuryRiskNarrative?.confidence);
  const decisionScore = Number(decisionSupport?.confidence);
  const explainScore = Number(confidenceExplainability?.confidenceScore);
  const consistencyScore = Number(consistencyCheck?.confidence);

  if (Number.isFinite(narrativeScore)) weights.push({ value: narrativeScore, weight: 0.3 });
  if (Number.isFinite(decisionScore)) weights.push({ value: decisionScore, weight: 0.25 });
  if (Number.isFinite(explainScore)) weights.push({ value: explainScore, weight: 0.25 });
  if (Number.isFinite(consistencyScore)) weights.push({ value: consistencyScore, weight: 0.2 });

  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;

  let score = weights.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
  score = clamp(Math.round(score), 0, isSmallDollar ? 82 : 100);
  return score;
}

function buildPlaybookSummaryParagraph({
  playbookStatus,
  operatorCadence,
  confidence,
  isSmallDollar,
}) {
  const statusPhrase = humanizeTreasuryToken(playbookStatus);
  const cadencePhrase = humanizeTreasuryToken(operatorCadence);
  let base = `Treasury operational playbook: ${statusPhrase} with ${cadencePhrase} operator cadence (confidence ${confidence}/100).`;
  base += " Advisory playbook only — no actions executed.";
  if (isSmallDollar) {
    base = `Soft-launch advisory: ${base}`;
  }
  return sanitizePlaybookText(base, false) || base;
}

/**
 * Pure advisory synthesis — institutional operating playbook from Phase 3A–3M outputs.
 * READ-ONLY: guide, recommend, contextualize — no automation, execution, or financial mutations.
 * @param {object} args
 */
export function buildTreasuryOperationalPlaybook({
  treasuryRiskNarrative = {},
  decisionSupport = {},
  executiveEscalation = {},
  institutionalMemory = {},
  consistencyCheck = {},
  confidenceExplainability = {},
  treasuryCommandCenter = {},
  readinessIndex = {},
  treasuryOperatingMode = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const elevatedSignalCount = countElevatedEscalationSignals(executiveEscalation?.escalationSignals);

    let playbookStatus = derivePlaybookStatus({
      treasuryRiskNarrative,
      decisionSupport,
      executiveEscalation,
      treasuryCommandCenter,
      consistencyCheck,
    });

    let operatorCadence = deriveOperatorCadenceFromPlaybook(playbookStatus, executiveEscalation);

    if (isSmallDollar) {
      ({ playbookStatus, operatorCadence } = applySoftLaunchPlaybookCaps({
        playbookStatus,
        operatorCadence,
        elevatedSignalCount,
      }));
    }

    const recommendedPlaybook = buildPlaybookRecommendations(playbookStatus, isSmallDollar);

    const watchChecklist = collectPlaybookWatchChecklist({
      treasuryRiskNarrative,
      decisionSupport,
      readinessIndex,
      treasuryOperatingMode,
      isSmallDollar,
    });

    const escalationGuidance = buildPlaybookEscalationGuidance({
      playbookStatus,
      consistencyCheck,
      executiveEscalation,
      isSmallDollar,
    });

    const confidence = derivePlaybookConfidence({
      treasuryRiskNarrative,
      decisionSupport,
      confidenceExplainability,
      consistencyCheck,
      isSmallDollar,
    });

    const summary = buildPlaybookSummaryParagraph({
      playbookStatus,
      operatorCadence,
      confidence,
      isSmallDollar,
    });

    void institutionalMemory;

    return {
      playbookStatus,
      operatorCadence,
      recommendedPlaybook,
      watchChecklist,
      escalationGuidance,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryOperationalPlaybook", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_OPERATIONAL_PLAYBOOK };
  }
}

export function formatTreasuryOperationalPlaybookChipLabel(result) {
  const status = String(result?.playbookStatus || "monitoring_mode").toLowerCase();
  const labels = {
    routine_operations: "Treasury playbook: Routine operations",
    monitoring_mode: "Treasury playbook: Monitoring mode",
    elevated_review: "Treasury playbook: Elevated review",
    leadership_visibility: "Treasury playbook: Leadership visibility",
  };
  return labels[status] || labels.monitoring_mode;
}

const EMPTY_TREASURY_SCENARIO_RESPONSE = Object.freeze({
  responseStatus: "monitoring_response",
  treasuryScenario: "monitoring",
  responseGuidance: ["Continue treasury observation and monitor recurring signals."],
  monitoringCadence: "weekly_review",
  escalationGuidance: [
    "Consider leadership visibility if elevated signals persist across two monitoring cycles.",
  ],
  confidence: 0,
  summary:
    "Treasury scenario response unavailable — continue advisory monitoring only. No actions executed.",
});

const FORBIDDEN_SCENARIO_PHRASES = Object.freeze([
  "emergency treasury intervention",
  "freeze",
  "block payouts",
  "trigger intervention",
  ...FORBIDDEN_DECISION_PHRASES,
]);

const SCENARIO_TIER_ORDER = Object.freeze({
  stable: 1,
  monitoring: 2,
  elevated_attention: 3,
  leadership_visibility: 4,
});

function isForbiddenScenarioText(text) {
  const lower = String(text || "").toLowerCase();
  return FORBIDDEN_SCENARIO_PHRASES.some((phrase) => lower.includes(phrase));
}

function sanitizeScenarioText(text, isSmallDollar) {
  const t = String(text || "").trim();
  if (!t || isForbiddenScenarioText(t)) return "";
  return isSmallDollar ? softenText(t, true) : t;
}

function mapNarrativeStatusToScenarioTier(narrativeStatus) {
  const key = String(narrativeStatus || "monitoring").toLowerCase();
  if (key === "calm") return "stable";
  if (key === "monitoring") return "monitoring";
  if (key === "elevated_attention") return "elevated_attention";
  if (key === "leadership_visibility") return "leadership_visibility";
  return "monitoring";
}

function mapPlaybookStatusToScenarioTier(playbookStatus) {
  const key = String(playbookStatus || "monitoring_mode").toLowerCase();
  if (key === "routine_operations") return "stable";
  if (key === "monitoring_mode") return "monitoring";
  if (key === "elevated_review") return "elevated_attention";
  if (key === "leadership_visibility") return "leadership_visibility";
  return "monitoring";
}

function deriveTreasuryScenarioFromSignals(treasuryRiskNarrative, operationalPlaybook) {
  const narrativeTier = mapNarrativeStatusToScenarioTier(treasuryRiskNarrative?.treasuryNarrativeStatus);
  const playbookTier = mapPlaybookStatusToScenarioTier(operationalPlaybook?.playbookStatus);
  const narrativeRank = SCENARIO_TIER_ORDER[narrativeTier] || 2;
  const playbookRank = SCENARIO_TIER_ORDER[playbookTier] || 2;
  const maxRank = Math.max(narrativeRank, playbookRank);

  if (maxRank <= 1) return "stable";
  if (maxRank === 2) return "monitoring";
  if (maxRank === 3) return "elevated_attention";
  return "leadership_visibility";
}

export function mapTreasuryScenarioToResponseStatus(treasuryScenario) {
  const key = String(treasuryScenario || "monitoring").toLowerCase();
  const map = {
    stable: "stable_response",
    monitoring: "monitoring_response",
    elevated_attention: "elevated_response",
    leadership_visibility: "leadership_response",
  };
  return map[key] || "monitoring_response";
}

function downgradeTreasuryScenarioOneNotch(scenario) {
  const key = String(scenario || "monitoring").toLowerCase();
  if (key === "leadership_visibility") return "elevated_attention";
  if (key === "elevated_attention") return "monitoring";
  if (key === "monitoring") return "stable";
  return "stable";
}

function applySoftLaunchScenarioCaps({ treasuryScenario, monitoringCadence, elevatedSignalCount }) {
  let scenario = downgradeTreasuryScenarioOneNotch(treasuryScenario);
  let cadence = downgradeOperatorCadenceOneNotch(monitoringCadence);

  if (cadence === "immediate_visibility" && elevatedSignalCount < 2) {
    cadence = "weekly_review";
  }
  if (scenario === "leadership_visibility" && elevatedSignalCount < 2) {
    scenario = "elevated_attention";
  }
  if (cadence === "daily_review" && elevatedSignalCount < 2) {
    cadence = "weekly_review";
  }

  return { treasuryScenario: scenario, monitoringCadence: cadence };
}

function deriveScenarioMonitoringCadence(operationalPlaybook, executiveEscalation) {
  const playbookCadence = String(operationalPlaybook?.operatorCadence || "").toLowerCase();
  if (playbookCadence) {
    return playbookCadence;
  }

  const execCadence = String(executiveEscalation?.recommendedExecutiveCadence || "weekly").toLowerCase();
  if (execCadence === "immediate_review") return "immediate_visibility";
  if (execCadence === "daily") return "daily_review";
  if (execCadence === "weekly") return "weekly_review";
  if (execCadence === "none") return "routine";
  return "weekly_review";
}

function buildScenarioTransitionGuidance(narrativeTier, playbookTier, isSmallDollar) {
  const items = [];
  const narrativeRank = SCENARIO_TIER_ORDER[narrativeTier] || 2;
  const playbookRank = SCENARIO_TIER_ORDER[playbookTier] || 2;

  if (narrativeRank !== playbookRank) {
    items.push(
      sanitizeScenarioText(
        `Narrative (${humanizeTreasuryToken(narrativeTier)}) and playbook (${humanizeTreasuryToken(playbookTier)}) differ — reconcile signals before changing operator cadence.`,
        isSmallDollar,
      ),
    );
  }

  items.push(
    sanitizeScenarioText(
      "If treasury posture shifts from stable to monitoring, increase review cadence to weekly observation.",
      isSmallDollar,
    ),
    sanitizeScenarioText(
      "If treasury posture shifts from monitoring to elevated attention, conduct closer cross-layer review before cadence change.",
      isSmallDollar,
    ),
    sanitizeScenarioText(
      "If treasury posture shifts to leadership visibility, prepare a human-reviewed summary — advisory preparation only.",
      isSmallDollar,
    ),
  );

  return uniqueStrings(items.filter(Boolean));
}

function buildScenarioResponseGuidance(treasuryScenario, narrativeTier, playbookTier, isSmallDollar) {
  const scenario = String(treasuryScenario || "monitoring").toLowerCase();
  const base = [];

  if (scenario === "stable") {
    base.push(
      "Maintain routine treasury observation.",
      "Continue standard reconciliation monitoring.",
      "Review readiness index on established snapshot rhythm.",
    );
  } else if (scenario === "monitoring") {
    base.push(
      "Continue treasury observation and monitor recurring signals.",
      "Review consistency alignment on weekly cadence.",
      "Track institutional memory patterns without changing operating procedures.",
    );
  } else if (scenario === "elevated_attention") {
    base.push(
      "Conduct closer treasury monitoring review.",
      "Cross-reference alert readiness with command center before cadence change.",
      "Compare decision support recommendations against consistency reconciliation notes.",
    );
  } else if (scenario === "leadership_visibility") {
    base.push(
      "Prepare leadership visibility summary from available digest intelligence.",
      "Review executive escalation reasons with human decision-makers.",
      "Document aligned and conflicting signals for leadership review — advisory only.",
    );
  } else {
    base.push("Continue treasury observation and monitor recurring signals.");
  }

  base.push("Advisory response guidance only — no treasury actions executed.");

  const transitions = buildScenarioTransitionGuidance(narrativeTier, playbookTier, isSmallDollar);
  const out = uniqueStrings(
    [...base, ...transitions].map((item) => sanitizeScenarioText(item, isSmallDollar)).filter(Boolean),
  ).slice(0, 8);

  while (out.length < 4) {
    const filler = sanitizeScenarioText(
      "Continue advisory treasury observation aligned with current institutional posture.",
      isSmallDollar,
    );
    if (filler && !out.includes(filler)) out.push(filler);
    else break;
  }

  return out.slice(0, 8);
}

function buildScenarioEscalationGuidance({
  treasuryScenario,
  operationalPlaybook,
  consistencyCheck,
  executiveEscalation,
  isSmallDollar,
}) {
  const items = [
    "Consider leadership visibility if elevated signals persist across two monitoring cycles.",
    "Review consistency reconciliation suggestions before escalating cadence.",
    "Escalation remains a human decision — this response layer does not automate cadence changes.",
  ];

  for (const suggestion of consistencyCheck?.reconciliationSuggestions || []) {
    const text = sanitizeScenarioText(suggestion, isSmallDollar);
    if (text) items.push(`Before escalating cadence: ${text}`);
  }

  for (const item of operationalPlaybook?.escalationGuidance || []) {
    const text = sanitizeScenarioText(item, isSmallDollar);
    if (text) items.push(text);
  }

  if (String(treasuryScenario || "").toLowerCase() === "elevated_attention") {
    items.push(
      "If elevated attention persists, consider preparing a leadership visibility briefing — advisory preparation only.",
    );
  }

  if (String(executiveEscalation?.executiveAttentionStatus || "").toLowerCase() === "executive_review") {
    items.push(
      "Executive escalation recommends leadership review — confirm reasons align with observed treasury signals.",
    );
  }

  return uniqueStrings(items.map((item) => sanitizeScenarioText(item, isSmallDollar)).filter(Boolean)).slice(
    0,
    6,
  );
}

function deriveScenarioResponseConfidence({
  operationalPlaybook,
  treasuryRiskNarrative,
  confidenceExplainability,
  consistencyCheck,
  isSmallDollar,
}) {
  const weights = [];
  const playbookScore = Number(operationalPlaybook?.confidence);
  const narrativeScore = Number(treasuryRiskNarrative?.confidence);
  const explainScore = Number(confidenceExplainability?.confidenceScore);
  const consistencyScore = Number(consistencyCheck?.confidence);

  if (Number.isFinite(playbookScore)) weights.push({ value: playbookScore, weight: 0.3 });
  if (Number.isFinite(narrativeScore)) weights.push({ value: narrativeScore, weight: 0.3 });
  if (Number.isFinite(explainScore)) weights.push({ value: explainScore, weight: 0.2 });
  if (Number.isFinite(consistencyScore)) weights.push({ value: consistencyScore, weight: 0.2 });

  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;

  let score = weights.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
  score = clamp(Math.round(score), 0, isSmallDollar ? 82 : 100);
  return score;
}

function buildScenarioResponseSummaryParagraph({
  treasuryScenario,
  responseStatus,
  monitoringCadence,
  confidence,
  isSmallDollar,
}) {
  const scenarioPhrase = humanizeTreasuryToken(treasuryScenario);
  const responsePhrase = humanizeTreasuryToken(responseStatus);
  const cadencePhrase = humanizeTreasuryToken(monitoringCadence);
  let base = `Treasury scenario response: ${scenarioPhrase} scenario with ${responsePhrase} posture and ${cadencePhrase} monitoring cadence (confidence ${confidence}/100).`;
  base += " Advisory response guidance only — no actions executed.";
  if (isSmallDollar) {
    base = `Soft-launch advisory: ${base}`;
  }
  return sanitizeScenarioText(base, false) || base;
}

/**
 * Pure advisory synthesis — treasury scenario response guidance from Phase 3M–3N outputs.
 * READ-ONLY: guide, recommend, contextualize — no automation, execution, or financial mutations.
 * @param {object} args
 */
export function buildTreasuryScenarioResponse({
  treasuryRiskNarrative = {},
  operationalPlaybook = {},
  executiveEscalation = {},
  decisionSupport = {},
  confidenceExplainability = {},
  consistencyCheck = {},
  treasuryCommandCenter = {},
  treasuryOperatingMode = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const elevatedSignalCount = countElevatedEscalationSignals(executiveEscalation?.escalationSignals);

    const narrativeTier = mapNarrativeStatusToScenarioTier(treasuryRiskNarrative?.treasuryNarrativeStatus);
    const playbookTier = mapPlaybookStatusToScenarioTier(operationalPlaybook?.playbookStatus);

    let treasuryScenario = deriveTreasuryScenarioFromSignals(treasuryRiskNarrative, operationalPlaybook);
    let monitoringCadence = deriveScenarioMonitoringCadence(operationalPlaybook, executiveEscalation);

    if (isSmallDollar) {
      ({ treasuryScenario, monitoringCadence } = applySoftLaunchScenarioCaps({
        treasuryScenario,
        monitoringCadence,
        elevatedSignalCount,
      }));
    }

    const responseStatus = mapTreasuryScenarioToResponseStatus(treasuryScenario);

    const responseGuidance = buildScenarioResponseGuidance(
      treasuryScenario,
      narrativeTier,
      playbookTier,
      isSmallDollar,
    );

    const escalationGuidance = buildScenarioEscalationGuidance({
      treasuryScenario,
      operationalPlaybook,
      consistencyCheck,
      executiveEscalation,
      isSmallDollar,
    });

    const confidence = deriveScenarioResponseConfidence({
      operationalPlaybook,
      treasuryRiskNarrative,
      confidenceExplainability,
      consistencyCheck,
      isSmallDollar,
    });

    const summary = buildScenarioResponseSummaryParagraph({
      treasuryScenario,
      responseStatus,
      monitoringCadence,
      confidence,
      isSmallDollar,
    });

    void decisionSupport;
    void treasuryCommandCenter;
    void treasuryOperatingMode;

    return {
      responseStatus,
      treasuryScenario,
      responseGuidance,
      monitoringCadence,
      escalationGuidance,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryScenarioResponse", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_SCENARIO_RESPONSE };
  }
}

export function formatTreasuryScenarioResponseChipLabel(result) {
  const status = String(result?.responseStatus || "monitoring_response").toLowerCase();
  const labels = {
    stable_response: "Treasury response: Stable response",
    monitoring_response: "Treasury response: Monitoring response",
    elevated_response: "Treasury response: Elevated response",
    leadership_response: "Treasury response: Leadership response",
  };
  return labels[status] || labels.monitoring_response;
}

const EMPTY_TREASURY_OPERATOR_TIMELINE = Object.freeze({
  timelineStatus: "monitoring",
  currentFocus: ["Continue routine treasury observation — advisory monitoring only."],
  nearTermFocus: ["Review monitoring signals during the next weekly review period."],
  futureFocus: ["Track institutional memory patterns as operational events accumulate."],
  timelineRecommendations: [
    "Continue treasury observation and revisit monitoring signals during the next review period.",
    "Conduct weekly treasury posture review aligned with operational playbook cadence.",
    "Advisory timeline guidance only — no actions executed or scheduled.",
  ],
  cadence: "weekly_review",
  confidence: 0,
  summary:
    "Treasury operator timeline unavailable — continue advisory monitoring only. No actions executed or scheduled.",
});

const FORBIDDEN_TIMELINE_PHRASES = Object.freeze([
  "immediate intervention required",
  "emergency",
  "emergency treasury intervention",
  ...FORBIDDEN_SCENARIO_PHRASES,
]);

function isForbiddenTimelineText(text) {
  const lower = String(text || "").toLowerCase();
  return FORBIDDEN_TIMELINE_PHRASES.some((phrase) => lower.includes(phrase));
}

function sanitizeTimelineText(text, isSmallDollar) {
  const t = String(text || "").trim();
  if (!t || isForbiddenTimelineText(t)) return "";
  return isSmallDollar ? softenText(t, true) : t;
}

function mapResponseStatusToTimelineStatus(responseStatus) {
  const key = String(responseStatus || "").toLowerCase();
  const map = {
    stable_response: "stable",
    monitoring_response: "monitoring",
    elevated_response: "elevated_attention",
    leadership_response: "leadership_visibility",
  };
  return map[key] || null;
}

function mapSourceStatusToTimelineStatus(value, source) {
  const key = String(value || "").toLowerCase();
  if (source === "playbook") {
    if (key === "routine_operations") return "stable";
    if (key === "monitoring_mode") return "monitoring";
    if (key === "elevated_review") return "elevated_attention";
    if (key === "leadership_visibility") return "leadership_visibility";
    return "monitoring";
  }
  if (key === "calm") return "stable";
  if (key === "monitoring") return "monitoring";
  if (key === "elevated_attention") return "elevated_attention";
  if (key === "leadership_visibility") return "leadership_visibility";
  return "monitoring";
}

function deriveOperatorTimelineStatus({ scenarioResponse, treasuryRiskNarrative, operationalPlaybook }) {
  const candidates = [
    mapResponseStatusToTimelineStatus(scenarioResponse?.responseStatus),
    String(scenarioResponse?.treasuryScenario || "").toLowerCase() || null,
    mapSourceStatusToTimelineStatus(treasuryRiskNarrative?.treasuryNarrativeStatus, "narrative"),
    mapSourceStatusToTimelineStatus(operationalPlaybook?.playbookStatus, "playbook"),
  ].filter(Boolean);

  let maxRank = 0;
  let result = "monitoring";
  for (const tier of candidates) {
    const rank = SCENARIO_TIER_ORDER[tier] || 2;
    if (rank > maxRank) {
      maxRank = rank;
      result = tier;
    }
  }
  return result;
}

function deriveOperatorTimelineCadence(scenarioResponse, operationalPlaybook) {
  const scenarioCadence = String(scenarioResponse?.monitoringCadence || "").toLowerCase();
  if (scenarioCadence) return scenarioCadence;
  const playbookCadence = String(operationalPlaybook?.operatorCadence || "").toLowerCase();
  if (playbookCadence) return playbookCadence;
  return "weekly_review";
}

function downgradeTimelineStatusOneNotch(status) {
  const key = String(status || "monitoring").toLowerCase();
  if (key === "leadership_visibility") return "elevated_attention";
  if (key === "elevated_attention") return "monitoring";
  if (key === "monitoring") return "stable";
  return "stable";
}

function applySoftLaunchTimelineCaps({ timelineStatus, cadence, elevatedSignalCount }) {
  let status = downgradeTimelineStatusOneNotch(timelineStatus);
  let nextCadence = downgradeOperatorCadenceOneNotch(cadence);

  if (nextCadence === "immediate_visibility" && elevatedSignalCount < 2) {
    nextCadence = "weekly_review";
  }
  if (status === "leadership_visibility" && elevatedSignalCount < 2) {
    status = "elevated_attention";
  }
  if (nextCadence === "daily_review" && elevatedSignalCount < 2) {
    nextCadence = "weekly_review";
  }
  if (nextCadence === "routine" && status !== "stable") {
    nextCadence = "weekly_review";
  }

  return { timelineStatus: status, cadence: nextCadence };
}

function collectOperatorTimelineCurrentFocus({
  decisionSupport,
  treasuryRiskNarrative,
  operationalPlaybook,
  scenarioResponse,
  isSmallDollar,
}) {
  const items = [];

  for (const action of (decisionSupport?.priorityActions || []).slice(0, 3)) {
    const text = sanitizeTimelineText(action, isSmallDollar);
    if (text) items.push(text);
  }

  for (const watch of (treasuryRiskNarrative?.watchItems || []).slice(0, 3)) {
    const text = sanitizeTimelineText(watch, isSmallDollar);
    if (text) items.push(text);
  }

  for (const check of (operationalPlaybook?.watchChecklist || []).slice(0, 3)) {
    const text = sanitizeTimelineText(check, isSmallDollar);
    if (text) items.push(text);
  }

  for (const guidance of (scenarioResponse?.responseGuidance || []).slice(0, 2)) {
    const text = sanitizeTimelineText(guidance, isSmallDollar);
    if (text) items.push(text);
  }

  if (items.length === 0) {
    items.push(
      sanitizeTimelineText(
        isSmallDollar
          ? "Continue routine soft-launch treasury observation."
          : "Continue routine treasury observation.",
        isSmallDollar,
      ),
    );
  }

  return uniqueStrings(items.filter(Boolean)).slice(0, 10);
}

function collectOperatorTimelineNearTermFocus({
  decisionSupport,
  institutionalMemory,
  consistencyCheck,
  executiveEscalation,
  isSmallDollar,
}) {
  const items = [];

  for (const action of decisionSupport?.deferredActions || []) {
    const text = sanitizeTimelineText(action, isSmallDollar);
    if (text) items.push(text);
  }

  for (const rec of decisionSupport?.monitoringRecommendations || []) {
    const text = sanitizeTimelineText(rec, isSmallDollar);
    if (text) items.push(text);
  }

  for (const rec of institutionalMemory?.recurringRecommendations || []) {
    const text = sanitizeTimelineText(rec, isSmallDollar);
    if (text) items.push(text);
  }

  for (const suggestion of consistencyCheck?.reconciliationSuggestions || []) {
    const text = sanitizeTimelineText(suggestion, isSmallDollar);
    if (text) items.push(text);
  }

  const execCadence = String(executiveEscalation?.recommendedExecutiveCadence || "weekly").toLowerCase();
  if (execCadence === "weekly" || execCadence === "daily" || execCadence === "immediate_review") {
    for (const reason of executiveEscalation?.executiveAttentionReasons || []) {
      const text = sanitizeTimelineText(reason, isSmallDollar);
      if (text) items.push(text);
    }

    const leadershipSummary = sanitizeTimelineText(executiveEscalation?.leadershipSummary, isSmallDollar);
    if (leadershipSummary && (execCadence === "daily" || execCadence === "immediate_review")) {
      items.push(leadershipSummary);
    }
  }

  if (items.length === 0) {
    items.push(
      sanitizeTimelineText(
        "Review monitoring signals during the next weekly review period.",
        isSmallDollar,
      ),
    );
  }

  return uniqueStrings(items.filter(Boolean)).slice(0, 12);
}

function collectOperatorTimelineFutureFocus({
  institutionalMemory,
  treasuryRiskNarrative,
  decisionSupport,
  isSmallDollar,
}) {
  const items = [];

  for (const pattern of institutionalMemory?.recurringPatterns || []) {
    const text = sanitizeTimelineText(pattern?.summary, isSmallDollar);
    if (text) items.push(text);
  }

  const leadershipContext = sanitizeTimelineText(treasuryRiskNarrative?.leadershipContext, isSmallDollar);
  if (leadershipContext) items.push(leadershipContext);

  for (const action of decisionSupport?.deferredActions || []) {
    const lower = String(action || "").toLowerCase();
    if (lower.includes("scaling") || lower.includes("governance")) {
      const text = sanitizeTimelineText(action, isSmallDollar);
      if (text) items.push(text);
    }
  }

  if (items.length === 0) {
    items.push(
      sanitizeTimelineText(
        "Track institutional memory patterns as operational events accumulate.",
        isSmallDollar,
      ),
    );
  }

  return uniqueStrings(items.filter(Boolean)).slice(0, 8);
}

function buildOperatorTimelineRecommendations({ timelineStatus, cadence, isSmallDollar }) {
  const status = String(timelineStatus || "monitoring").toLowerCase();
  const nextCadence = String(cadence || "weekly_review").toLowerCase();
  const items = [
    "Continue treasury observation and revisit monitoring signals during the next review period.",
  ];

  if (nextCadence === "weekly_review" || nextCadence === "routine") {
    items.push("Conduct weekly treasury posture review aligned with operational playbook cadence.");
  } else if (nextCadence === "daily_review") {
    items.push(
      "Maintain daily treasury posture review until signals stabilize — observation only.",
    );
  } else if (nextCadence === "immediate_visibility") {
    items.push(
      "Prepare leadership visibility materials for human review — advisory preparation only.",
    );
  }

  if (status === "monitoring" || status === "elevated_attention") {
    items.push(
      "If near-term watch items persist, consider elevated review in the following period.",
    );
  }

  if (status === "stable") {
    items.push("Retain routine snapshot cadence and defer scaling reviews until posture remains stable.");
  } else if (status === "leadership_visibility") {
    items.push(
      "Document trajectory themes for leadership context during the next institutional review cycle.",
    );
  }

  items.push("Advisory timeline guidance only — no actions executed or scheduled.");

  const out = uniqueStrings(
    items.map((item) => sanitizeTimelineText(item, isSmallDollar)).filter(Boolean),
  ).slice(0, 6);

  while (out.length < 4) {
    const filler = sanitizeTimelineText(
      "Continue advisory treasury observation aligned with current institutional posture.",
      isSmallDollar,
    );
    if (filler && !out.includes(filler)) out.push(filler);
    else break;
  }

  return out.slice(0, 6);
}

function deriveOperatorTimelineConfidence({
  scenarioResponse,
  operationalPlaybook,
  confidenceExplainability,
  institutionalMemory,
  isSmallDollar,
}) {
  const weights = [];
  const scenarioScore = Number(scenarioResponse?.confidence);
  const playbookScore = Number(operationalPlaybook?.confidence);
  const explainScore = Number(confidenceExplainability?.confidenceScore);
  const memoryScore = Number(institutionalMemory?.confidence);
  const patternCount = (institutionalMemory?.recurringPatterns || []).length;

  if (Number.isFinite(scenarioScore)) weights.push({ value: scenarioScore, weight: 0.25 });
  if (Number.isFinite(playbookScore)) weights.push({ value: playbookScore, weight: 0.25 });
  if (Number.isFinite(explainScore)) weights.push({ value: explainScore, weight: 0.2 });
  if (Number.isFinite(memoryScore)) {
    weights.push({ value: memoryScore, weight: patternCount >= 2 ? 0.35 : 0.3 });
  }

  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;

  let score = weights.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
  if (patternCount >= 2) score += 3;
  score = clamp(Math.round(score), 0, isSmallDollar ? 82 : 100);
  return score;
}

function buildOperatorTimelineSummaryParagraph({
  timelineStatus,
  cadence,
  confidence,
  isSmallDollar,
}) {
  const statusPhrase = humanizeTreasuryToken(timelineStatus);
  const cadencePhrase = humanizeTreasuryToken(cadence);
  let base = `Treasury operator timeline: ${statusPhrase} posture with ${cadencePhrase} review cadence (confidence ${confidence}/100).`;
  base += " Advisory timeline guidance only — no actions executed or scheduled.";
  if (isSmallDollar) {
    base = `Soft-launch advisory: ${base}`;
  }
  return sanitizeTimelineText(base, false) || base;
}

/**
 * Pure advisory synthesis — treasury operator timeline intelligence from Phase 3J–3O outputs.
 * READ-ONLY: guide, sequence, contextualize — no automation, execution, or financial mutations.
 * @param {object} args
 */
export function buildTreasuryOperatorTimeline({
  scenarioResponse = {},
  operationalPlaybook = {},
  treasuryRiskNarrative = {},
  decisionSupport = {},
  executiveEscalation = {},
  consistencyCheck = {},
  confidenceExplainability = {},
  institutionalMemory = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const elevatedSignalCount = countElevatedEscalationSignals(executiveEscalation?.escalationSignals);

    let timelineStatus = deriveOperatorTimelineStatus({
      scenarioResponse,
      treasuryRiskNarrative,
      operationalPlaybook,
    });
    let cadence = deriveOperatorTimelineCadence(scenarioResponse, operationalPlaybook);

    if (isSmallDollar) {
      ({ timelineStatus, cadence } = applySoftLaunchTimelineCaps({
        timelineStatus,
        cadence,
        elevatedSignalCount,
      }));
    }

    const currentFocus = collectOperatorTimelineCurrentFocus({
      decisionSupport,
      treasuryRiskNarrative,
      operationalPlaybook,
      scenarioResponse,
      isSmallDollar,
    });

    const nearTermFocus = collectOperatorTimelineNearTermFocus({
      decisionSupport,
      institutionalMemory,
      consistencyCheck,
      executiveEscalation,
      isSmallDollar,
    });

    const futureFocus = collectOperatorTimelineFutureFocus({
      institutionalMemory,
      treasuryRiskNarrative,
      decisionSupport,
      isSmallDollar,
    });

    const timelineRecommendations = buildOperatorTimelineRecommendations({
      timelineStatus,
      cadence,
      isSmallDollar,
    });

    const confidence = deriveOperatorTimelineConfidence({
      scenarioResponse,
      operationalPlaybook,
      confidenceExplainability,
      institutionalMemory,
      isSmallDollar,
    });

    const summary = buildOperatorTimelineSummaryParagraph({
      timelineStatus,
      cadence,
      confidence,
      isSmallDollar,
    });

    return {
      timelineStatus,
      currentFocus,
      nearTermFocus,
      futureFocus,
      timelineRecommendations,
      cadence,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryOperatorTimeline", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_OPERATOR_TIMELINE };
  }
}

export function formatTreasuryOperatorTimelineChipLabel(result) {
  const status = String(result?.timelineStatus || "monitoring").toLowerCase();
  const labels = {
    stable: "Treasury timeline: Stable",
    monitoring: "Treasury timeline: Monitoring",
    elevated_attention: "Treasury timeline: Elevated attention",
    leadership_visibility: "Treasury timeline: Leadership visibility",
  };
  return labels[status] || labels.monitoring;
}

const EMPTY_TREASURY_ATTENTION_PRIORITY = Object.freeze({
  priorityStatus: "monitoring",
  immediateAttention: ["Continue routine treasury observation — advisory prioritization only."],
  nearTermAttention: ["Review monitoring signals during the next review period."],
  routineAttention: ["Track institutional memory patterns as operational events accumulate."],
  priorityReasons: [
    "Treasury attention prioritization synthesized from advisory layers — no actions executed.",
  ],
  confidence: 0,
  summary:
    "Treasury attention priorities unavailable — continue advisory monitoring only. No actions executed.",
});

const FORBIDDEN_ATTENTION_PHRASES = Object.freeze([
  "immediate intervention required",
  "emergency",
  "crisis",
  "in danger",
  ...FORBIDDEN_TIMELINE_PHRASES,
]);

function isForbiddenAttentionText(text) {
  const lower = String(text || "").toLowerCase();
  return FORBIDDEN_ATTENTION_PHRASES.some((phrase) => lower.includes(phrase));
}

function sanitizeAttentionText(text, isSmallDollar) {
  const t = String(text || "").trim();
  if (!t || isForbiddenAttentionText(t)) return "";
  return isSmallDollar ? softenText(t, true) : t;
}

function isElevatedPlusAttentionStatus(status) {
  const key = String(status || "").toLowerCase();
  return key === "elevated_attention" || key === "leadership_visibility";
}

function contradictionSeverityRank(severity) {
  const map = { info: 0, low: 1, moderate: 2, elevated: 3, high: 4 };
  return map[String(severity || "info").toLowerCase()] ?? 0;
}

function isModeratePlusContradictionSeverity(severity) {
  return contradictionSeverityRank(severity) >= 2;
}

function deriveAttentionPriorityStatus({
  operatorTimeline,
  scenarioResponse,
  treasuryRiskNarrative,
  operationalPlaybook,
}) {
  const candidates = [
    String(operatorTimeline?.timelineStatus || "").toLowerCase() || null,
    mapResponseStatusToTimelineStatus(scenarioResponse?.responseStatus),
    String(scenarioResponse?.treasuryScenario || "").toLowerCase() || null,
    mapSourceStatusToTimelineStatus(treasuryRiskNarrative?.treasuryNarrativeStatus, "narrative"),
    mapSourceStatusToTimelineStatus(operationalPlaybook?.playbookStatus, "playbook"),
  ].filter(Boolean);

  let maxRank = 0;
  let result = "monitoring";
  for (const tier of candidates) {
    const rank = SCENARIO_TIER_ORDER[tier] || 2;
    if (rank > maxRank) {
      maxRank = rank;
      result = tier;
    }
  }
  return result;
}

function applySoftLaunchAttentionPriorityCaps({ priorityStatus, immediateAttention, elevatedSignalCount }) {
  let status = downgradeTimelineStatusOneNotch(priorityStatus);
  if (status === "leadership_visibility" && elevatedSignalCount < 2) {
    status = "elevated_attention";
  }
  const maxImmediate = status === "leadership_visibility" ? 5 : 4;
  return {
    priorityStatus: status,
    immediateAttention: immediateAttention.slice(0, maxImmediate),
  };
}

function rankAttentionItem(text, weight) {
  return { text, weight: Number(weight) || 0 };
}

function collectAttentionImmediateItems({
  operatorTimeline,
  decisionSupport,
  treasuryRiskNarrative,
  scenarioResponse,
  consistencyCheck,
  priorityStatus,
  isSmallDollar,
}) {
  const ranked = [];
  const elevatedPlus = isElevatedPlusAttentionStatus(priorityStatus);

  for (const item of operatorTimeline?.currentFocus || []) {
    const text = sanitizeAttentionText(item, isSmallDollar);
    if (text) ranked.push(rankAttentionItem(text, 4));
  }

  for (const action of decisionSupport?.priorityActions || []) {
    const text = sanitizeAttentionText(action, isSmallDollar);
    if (text) ranked.push(rankAttentionItem(text, 5));
  }

  if (elevatedPlus) {
    for (const watch of treasuryRiskNarrative?.watchItems || []) {
      const text = sanitizeAttentionText(watch, isSmallDollar);
      if (text) ranked.push(rankAttentionItem(text, 3));
    }
  }

  if (elevatedPlus) {
    for (const guidance of scenarioResponse?.responseGuidance || []) {
      const text = sanitizeAttentionText(guidance, isSmallDollar);
      if (text) ranked.push(rankAttentionItem(text, 4));
    }
  }

  for (const signal of consistencyCheck?.contradictionSignals || []) {
    if (!isModeratePlusContradictionSeverity(signal?.severity)) continue;
    const title = sanitizeAttentionText(signal?.title, isSmallDollar);
    if (!title) continue;
    const weight = 2 + contradictionSeverityRank(signal?.severity);
    ranked.push(rankAttentionItem(title, weight));
  }

  ranked.sort((a, b) => b.weight - a.weight);

  const seen = new Set();
  const out = [];
  for (const { text } of ranked) {
    if (seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= 6) break;
  }

  if (out.length === 0) {
    out.push(
      sanitizeAttentionText(
        isSmallDollar
          ? "Continue routine soft-launch treasury observation — advisory prioritization only."
          : "Continue routine treasury observation — advisory prioritization only.",
        isSmallDollar,
      ) || "Continue routine treasury observation — advisory prioritization only.",
    );
  }

  return out;
}

function excludeFromAttentionBucket(items, excludeSet, isSmallDollar) {
  const out = [];
  for (const item of items) {
    const text = sanitizeAttentionText(item, isSmallDollar);
    if (!text || excludeSet.has(text)) continue;
    excludeSet.add(text);
    out.push(text);
  }
  return out;
}

function collectAttentionNearTermItems({
  operatorTimeline,
  decisionSupport,
  operationalPlaybook,
  institutionalMemory,
  immediateSet,
  isSmallDollar,
}) {
  const seen = new Set(immediateSet);
  const sources = [
    ...(operatorTimeline?.nearTermFocus || []),
    ...(decisionSupport?.deferredActions || []),
    ...(decisionSupport?.monitoringRecommendations || []),
    ...(operationalPlaybook?.watchChecklist || []),
    ...(institutionalMemory?.recurringRecommendations || []),
  ];

  const out = excludeFromAttentionBucket(sources, seen, isSmallDollar);

  if (out.length === 0) {
    out.push(
      sanitizeAttentionText(
        "Review monitoring signals during the next weekly review period.",
        isSmallDollar,
      ) || "Review monitoring signals during the next weekly review period.",
    );
  }

  return out.slice(0, 12);
}

function collectAttentionRoutineItems({
  operatorTimeline,
  operationalPlaybook,
  institutionalMemory,
  decisionSupport,
  priorityStatus,
  immediateSet,
  nearTermSet,
  isSmallDollar,
}) {
  const seen = new Set([...immediateSet, ...nearTermSet]);
  const out = [];
  const isStable = String(priorityStatus || "").toLowerCase() === "stable";

  for (const item of operatorTimeline?.futureFocus || []) {
    const text = sanitizeAttentionText(item, isSmallDollar);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
  }

  if (isStable) {
    for (const item of operationalPlaybook?.recommendedPlaybook || []) {
      const text = sanitizeAttentionText(item, isSmallDollar);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
  }

  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "").toLowerCase();
  if (memoryStatus === "stable_pattern" || isStable) {
    for (const pattern of institutionalMemory?.recurringPatterns || []) {
      const text = sanitizeAttentionText(pattern?.summary, isSmallDollar);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
    for (const signal of institutionalMemory?.recurringSignals || []) {
      const text = sanitizeAttentionText(signal?.title, isSmallDollar);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
  }

  if (isStable) {
    for (const rec of decisionSupport?.treasuryRecommendations || []) {
      const text = sanitizeAttentionText(rec?.recommendation, isSmallDollar);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
    for (const rec of decisionSupport?.monitoringRecommendations || []) {
      const text = sanitizeAttentionText(rec, isSmallDollar);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
  }

  if (out.length === 0) {
    out.push(
      sanitizeAttentionText(
        "Track institutional memory patterns as operational events accumulate.",
        isSmallDollar,
      ) || "Track institutional memory patterns as operational events accumulate.",
    );
  }

  return out.slice(0, 10);
}

function buildAttentionPriorityReasons({
  immediateAttention,
  executiveEscalation,
  consistencyCheck,
  institutionalMemory,
  priorityStatus,
  isSmallDollar,
}) {
  const reasons = [];
  const immediateCount = (immediateAttention || []).length;
  const contradictionCount = (consistencyCheck?.contradictionSignals || []).length;
  const execCadence = String(executiveEscalation?.recommendedExecutiveCadence || "weekly").toLowerCase();
  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "").toLowerCase();

  if (immediateCount >= 3) {
    reasons.push("Consider prioritizing review of repeated monitoring signals.");
  }

  if (
    execCadence === "daily" ||
    execCadence === "immediate_review" ||
    isElevatedPlusAttentionStatus(priorityStatus)
  ) {
    reasons.push(
      "Executive escalation cadence suggests nearer-term leadership visibility review.",
    );
  }

  if (contradictionCount > 0) {
    reasons.push(
      "Consistency check identified mixed signals warranting near-term reconciliation.",
    );
  }

  if (memoryStatus === "stable_pattern") {
    reasons.push("Institutional memory shows stable recurring patterns supporting routine cadence.");
  } else if (memoryStatus === "minimal_history") {
    reasons.push("Limited operational history tempers prioritization confidence — interpret cautiously.");
  }

  if (reasons.length === 0) {
    reasons.push(
      "Attention buckets synthesized from operator timeline, decision support, and playbook layers.",
    );
  }

  const out = [];
  for (const reason of reasons) {
    const text = sanitizeAttentionText(reason, isSmallDollar);
    if (text) out.push(text);
    if (out.length >= 5) break;
  }

  return out.slice(0, 5);
}

function deriveAttentionPriorityConfidence({
  operatorTimeline,
  scenarioResponse,
  decisionSupport,
  confidenceExplainability,
  institutionalMemory,
  consistencyCheck,
  isSmallDollar,
}) {
  const weights = [];
  const timelineScore = Number(operatorTimeline?.confidence);
  const scenarioScore = Number(scenarioResponse?.confidence);
  const decisionScore = Number(decisionSupport?.confidence);
  const explainScore = Number(confidenceExplainability?.confidenceScore);

  if (Number.isFinite(timelineScore)) weights.push({ value: timelineScore, weight: 0.3 });
  if (Number.isFinite(scenarioScore)) weights.push({ value: scenarioScore, weight: 0.25 });
  if (Number.isFinite(decisionScore)) weights.push({ value: decisionScore, weight: 0.25 });
  if (Number.isFinite(explainScore)) weights.push({ value: explainScore, weight: 0.2 });

  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;

  let score = weights.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;

  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "").toLowerCase();
  if (memoryStatus === "stable_pattern") score += 5;
  if (memoryStatus === "minimal_history") score -= 8;

  const consistencyStatus = String(consistencyCheck?.consistencyStatus || "").toLowerCase();
  if (consistencyStatus === "contradictory") score -= 10;
  else if (consistencyStatus === "mixed_signals") score -= 6;
  else if ((consistencyCheck?.contradictionSignals || []).length > 0) score -= 4;

  score = clamp(Math.round(score), 0, isSmallDollar ? 82 : 100);
  return score;
}

function buildAttentionPrioritySummaryParagraph({
  priorityStatus,
  immediateAttention,
  confidence,
  isSmallDollar,
}) {
  const statusPhrase = humanizeTreasuryToken(priorityStatus);
  const immediateCount = (immediateAttention || []).length;
  let base = `Treasury attention priorities: ${statusPhrase} posture with ${immediateCount} item${immediateCount === 1 ? "" : "s"} for current-session review (confidence ${confidence}/100).`;
  base += " Advisory prioritization only — no actions executed.";
  if (isSmallDollar) {
    base = `Soft-launch advisory: ${base}`;
  }
  return sanitizeAttentionText(base, false) || base;
}

/**
 * Pure advisory synthesis — treasury attention prioritization from Phase 3M–3P outputs.
 * READ-ONLY: prioritize review focus — no automation, execution, or financial mutations.
 * @param {object} args
 */
export function buildTreasuryAttentionPriority({
  operatorTimeline = {},
  treasuryRiskNarrative = {},
  scenarioResponse = {},
  decisionSupport = {},
  operationalPlaybook = {},
  executiveEscalation = {},
  confidenceExplainability = {},
  consistencyCheck = {},
  institutionalMemory = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const elevatedSignalCount = countElevatedEscalationSignals(executiveEscalation?.escalationSignals);

    let priorityStatus = deriveAttentionPriorityStatus({
      operatorTimeline,
      scenarioResponse,
      treasuryRiskNarrative,
      operationalPlaybook,
    });

    let immediateAttention = collectAttentionImmediateItems({
      operatorTimeline,
      decisionSupport,
      treasuryRiskNarrative,
      scenarioResponse,
      consistencyCheck,
      priorityStatus,
      isSmallDollar,
    });

    if (isSmallDollar) {
      ({ priorityStatus, immediateAttention } = applySoftLaunchAttentionPriorityCaps({
        priorityStatus,
        immediateAttention,
        elevatedSignalCount,
      }));
    } else {
      immediateAttention = immediateAttention.slice(0, 6);
    }

    const immediateSet = new Set(immediateAttention);
    const nearTermAttention = collectAttentionNearTermItems({
      operatorTimeline,
      decisionSupport,
      operationalPlaybook,
      institutionalMemory,
      immediateSet,
      isSmallDollar,
    });
    const nearTermSet = new Set(nearTermAttention);

    const routineAttention = collectAttentionRoutineItems({
      operatorTimeline,
      operationalPlaybook,
      institutionalMemory,
      decisionSupport,
      priorityStatus,
      immediateSet,
      nearTermSet,
      isSmallDollar,
    });

    const priorityReasons = buildAttentionPriorityReasons({
      immediateAttention,
      executiveEscalation,
      consistencyCheck,
      institutionalMemory,
      priorityStatus,
      isSmallDollar,
    });

    const confidence = deriveAttentionPriorityConfidence({
      operatorTimeline,
      scenarioResponse,
      decisionSupport,
      confidenceExplainability,
      institutionalMemory,
      consistencyCheck,
      isSmallDollar,
    });

    const summary = buildAttentionPrioritySummaryParagraph({
      priorityStatus,
      immediateAttention,
      confidence,
      isSmallDollar,
    });

    return {
      priorityStatus,
      immediateAttention,
      nearTermAttention,
      routineAttention,
      priorityReasons,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryAttentionPriority", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_ATTENTION_PRIORITY };
  }
}

export function formatTreasuryAttentionPriorityChipLabel(result) {
  const status = String(result?.priorityStatus || "monitoring").toLowerCase();
  const labels = {
    stable: "Treasury priorities: Stable",
    monitoring: "Treasury priorities: Monitoring",
    elevated_attention: "Treasury priorities: Elevated attention",
    leadership_visibility: "Treasury priorities: Leadership visibility",
  };
  return labels[status] || labels.monitoring;
}

const EMPTY_TREASURY_OPERATIONAL_COHERENCE = Object.freeze({
  coherenceStatus: "monitoring",
  contradictions: [],
  alignedSignals: [],
  operatorPosture: "Routine monitoring with aligned operational guidance",
  confidence: 0,
  summary:
    "Treasury operational coherence is not yet available — continue advisory observation. Coherence check only; no outputs overridden.",
  recommendations: ["Continue routine treasury observation — advisory monitoring only."],
});

const NARRATIVE_COHERENCE_TIER = Object.freeze({
  calm: 1,
  monitoring: 2,
  elevated_attention: 3,
  leadership_visibility: 4,
});

const OPERATOR_POSTURE_COHERENCE_TIER = Object.freeze({
  observe: 1,
  review: 2,
  elevated_review: 3,
  leadership_visibility: 4,
});

const PLAYBOOK_COHERENCE_TIER = Object.freeze({
  routine_operations: 1,
  monitoring_mode: 2,
  elevated_review: 3,
  leadership_visibility: 4,
});

const SCENARIO_COHERENCE_TIER = Object.freeze({
  stable: 1,
  monitoring: 2,
  elevated_attention: 3,
  leadership_visibility: 4,
});

const RESPONSE_COHERENCE_TIER = Object.freeze({
  stable_response: 1,
  monitoring_response: 2,
  elevated_response: 3,
  leadership_response: 4,
});

const TIMELINE_COHERENCE_TIER = Object.freeze({
  stable: 1,
  monitoring: 2,
  elevated_attention: 3,
  leadership_visibility: 4,
});

const PRIORITY_COHERENCE_TIER = Object.freeze({
  stable: 1,
  monitoring: 2,
  elevated_attention: 3,
  leadership_visibility: 4,
});

const CONSISTENCY_COHERENCE_TIER = Object.freeze({
  aligned: 1,
  minor_conflicts: 2,
  mixed_signals: 3,
  contradictory: 4,
});

const EXECUTIVE_COHERENCE_TIER = Object.freeze({
  quiet: 1,
  observe: 2,
  leadership_attention: 3,
  executive_review: 4,
});

function mapOperationalCoherenceTier(layerKey, value) {
  const key = String(value || "").toLowerCase();
  switch (layerKey) {
    case "narrative":
      return layerStatusRank(NARRATIVE_COHERENCE_TIER, key, 2);
    case "narrative_posture":
      return layerStatusRank(OPERATOR_POSTURE_COHERENCE_TIER, key, 2);
    case "playbook":
      return layerStatusRank(PLAYBOOK_COHERENCE_TIER, key, 2);
    case "scenario":
      return layerStatusRank(SCENARIO_COHERENCE_TIER, key, 2);
    case "response":
      return layerStatusRank(RESPONSE_COHERENCE_TIER, key, 2);
    case "timeline":
      return layerStatusRank(TIMELINE_COHERENCE_TIER, key, 2);
    case "priority":
      return layerStatusRank(PRIORITY_COHERENCE_TIER, key, 2);
    case "decision":
      return layerStatusRank(DECISION_SUPPORT_RANK, key, 1) + 1;
    case "executive":
      return layerStatusRank(EXECUTIVE_COHERENCE_TIER, key, 2);
    case "memory":
      return layerStatusRank(HISTORICAL_POSTURE_RANK, key, 1) + 1;
    case "consistency":
      return layerStatusRank(CONSISTENCY_COHERENCE_TIER, key, 1);
    default:
      return 2;
  }
}

function collectOperationalCoherenceLayerEntries({
  treasuryRiskNarrative,
  operationalPlaybook,
  scenarioResponse,
  operatorTimeline,
  attentionPriority,
  decisionSupport,
  executiveEscalation,
  institutionalMemory,
  consistencyCheck,
}) {
  const entries = [];
  const push = (layerKey, label, value) => {
    const raw = String(value || "").toLowerCase();
    if (!raw) return;
    entries.push({
      layerKey,
      label,
      value: raw,
      tier: mapOperationalCoherenceTier(layerKey, raw),
    });
  };

  push("narrative", "Risk narrative", treasuryRiskNarrative?.treasuryNarrativeStatus);
  push("narrative_posture", "Operator posture", treasuryRiskNarrative?.operatorPosture);
  push("playbook", "Operational playbook", operationalPlaybook?.playbookStatus);
  push("scenario", "Treasury scenario", scenarioResponse?.treasuryScenario);
  push("response", "Scenario response", scenarioResponse?.responseStatus);
  push("timeline", "Operator timeline", operatorTimeline?.timelineStatus);
  push("priority", "Attention priorities", attentionPriority?.priorityStatus);
  push("decision", "Decision support", decisionSupport?.decisionSupportStatus);
  push("executive", "Executive escalation", executiveEscalation?.executiveAttentionStatus);
  push("memory", "Institutional memory", institutionalMemory?.historicalPosture);
  push("consistency", "Recommendation consistency", consistencyCheck?.consistencyStatus);

  return entries;
}

function sanitizeCoherenceText(text, isSmallDollar) {
  const t = String(text || "").trim();
  if (!t || isForbiddenNarrativeText(t)) return "";
  if (/system inconsistency detected/i.test(t)) return "";
  return isSmallDollar ? softenText(t, true) : t;
}

function collectOperationalCoherenceContradictions({
  layerEntries,
  treasuryRiskNarrative,
  operationalPlaybook,
  scenarioResponse,
  operatorTimeline,
  attentionPriority,
  executiveEscalation,
  institutionalMemory,
  consistencyCheck,
  isSmallDollar,
}) {
  const contradictions = [];
  const tierOf = (layerKey) =>
    layerEntries.find((e) => e.layerKey === layerKey)?.tier ?? null;

  const narrativeTier = tierOf("narrative") ?? tierOf("narrative_posture");
  const playbookTier = tierOf("playbook");
  const scenarioTier = Math.max(tierOf("scenario") ?? 0, tierOf("response") ?? 0) || null;
  const timelineTier = tierOf("timeline");
  const priorityTier = tierOf("priority");
  const executiveTier = tierOf("executive");
  const memoryTier = tierOf("memory");
  const immediateCount = (attentionPriority?.immediateAttention || []).length;

  if (narrativeTier != null && priorityTier != null && narrativeTier <= 1 && priorityTier >= 4) {
    contradictions.push(
      "Risk narrative remains calm while attention priorities call for leadership visibility — reconcile the operator story before changing review cadence.",
    );
  }

  if (playbookTier != null && scenarioTier != null && playbookTier <= 1 && scenarioTier >= 3) {
    contradictions.push(
      `Operational playbook (${humanizeTreasuryToken(operationalPlaybook?.playbookStatus)}) and scenario response (${humanizeTreasuryToken(scenarioResponse?.treasuryScenario || scenarioResponse?.responseStatus)}) emphasize different urgency — compare playbook and scenario layers together.`,
    );
  }

  if (timelineTier != null && executiveTier != null && timelineTier <= 1 && executiveTier >= 4) {
    contradictions.push(
      "Operator timeline remains stable while executive escalation recommends executive review — weigh timeline sequencing against escalation context.",
    );
  }

  if (memoryTier != null && memoryTier <= 1 && immediateCount >= 3) {
    contradictions.push(
      "Institutional memory suggests a stable historical pattern while immediate attention items dominate the current session — interpret priorities cautiously against memory context.",
    );
  }

  for (let i = 0; i < layerEntries.length; i += 1) {
    for (let j = i + 1; j < layerEntries.length; j += 1) {
      const a = layerEntries[i];
      const b = layerEntries[j];
      const gap = Math.abs(a.tier - b.tier);
      if (gap < 2) continue;
      if (
        (a.layerKey === "consistency" || b.layerKey === "consistency") &&
        gap === 2 &&
        (a.tier === 2 || b.tier === 2)
      ) {
        continue;
      }
      contradictions.push(
        `${a.label} (${humanizeTreasuryToken(a.value)}) and ${b.label} (${humanizeTreasuryToken(b.value)}) tell different urgency in the operational story — review both layers before adjusting cadence.`,
      );
    }
  }

  for (const signal of consistencyCheck?.contradictionSignals || []) {
    const explanation = sanitizeCoherenceText(signal?.explanation, isSmallDollar);
    if (explanation) contradictions.push(explanation);
  }

  return uniqueStrings(contradictions).slice(0, 10);
}

function buildOperationalCoherenceAlignedSignals({ layerEntries, isSmallDollar }) {
  const aligned = [];
  const byTier = new Map();
  for (const entry of layerEntries) {
    if (!byTier.has(entry.tier)) byTier.set(entry.tier, []);
    byTier.get(entry.tier).push(entry);
  }

  const dominantTier = [...byTier.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  if (dominantTier && dominantTier[1].length >= 3) {
    const names = dominantTier[1].map((e) => e.label).slice(0, 4);
    const postureWord =
      dominantTier[0] <= 1
        ? "routine"
        : dominantTier[0] === 2
          ? "monitoring"
          : dominantTier[0] === 3
            ? "elevated attention"
            : "leadership visibility";
    aligned.push(
      `${names.join(", ")} and related guidance layers indicate a ${postureWord} posture in the operational story.`,
    );
  }

  const playbook = layerEntries.find((e) => e.layerKey === "playbook");
  const scenario = layerEntries.find((e) => e.layerKey === "scenario" || e.layerKey === "response");
  const timeline = layerEntries.find((e) => e.layerKey === "timeline");
  if (
    playbook &&
    scenario &&
    timeline &&
    Math.abs(playbook.tier - scenario.tier) <= 1 &&
    Math.abs(scenario.tier - timeline.tier) <= 1
  ) {
    aligned.push(
      "Playbook, scenario response, and operator timeline all indicate a similar monitoring posture.",
    );
  }

  const narrative = layerEntries.find((e) => e.layerKey === "narrative");
  const decision = layerEntries.find((e) => e.layerKey === "decision");
  const executive = layerEntries.find((e) => e.layerKey === "executive");
  if (
    narrative &&
    decision &&
    executive &&
    Math.abs(narrative.tier - decision.tier) <= 1 &&
    Math.abs(decision.tier - executive.tier) <= 1
  ) {
    aligned.push(
      "Risk narrative, decision support, and executive escalation describe a harmonized operator story.",
    );
  }

  const consistency = layerEntries.find((e) => e.layerKey === "consistency");
  if (consistency && consistency.tier <= 2 && dominantTier && dominantTier[0] <= 2) {
    aligned.push(
      "Recommendation consistency check aligns with the broader operational guidance posture.",
    );
  }

  return uniqueStrings(
    aligned.map((s) => (isSmallDollar ? softenText(s, true) : s)),
  ).slice(0, 6);
}

function computeOperationalCoherenceSpread(layerEntries) {
  if (!layerEntries.length) return 0;
  const tiers = layerEntries.map((e) => e.tier);
  return Math.max(...tiers) - Math.min(...tiers);
}

function hasLeadershipStableSpread(layerEntries) {
  const tiers = layerEntries.map((e) => e.tier);
  return tiers.some((t) => t >= 4) && tiers.some((t) => t <= 1);
}

function aggregateOperationalCoherenceStatus({
  spread,
  contradictions,
  consistencyStatus,
  layerEntries,
}) {
  const consistencyKey = String(consistencyStatus || "aligned").toLowerCase();
  const contradictionCount = (contradictions || []).length;

  if (
    spread >= 3 &&
    hasLeadershipStableSpread(layerEntries) &&
    contradictionCount >= 1
  ) {
    return "leadership_review";
  }
  if (consistencyKey === "contradictory" && contradictionCount >= 2) {
    return "leadership_review";
  }
  if (spread >= 2 || contradictionCount >= 3 || consistencyKey === "mixed_signals") {
    return "mild_conflict";
  }
  if (contradictionCount >= 1 || spread === 1 || consistencyKey === "minor_conflicts") {
    return "monitoring";
  }
  if (spread <= 1 && (consistencyKey === "aligned" || consistencyKey === "minor_conflicts")) {
    return "aligned";
  }
  return "monitoring";
}

function downgradeOperationalCoherenceStatusOneNotch(status) {
  const key = String(status || "monitoring").toLowerCase();
  if (key === "leadership_review") return "mild_conflict";
  if (key === "mild_conflict") return "monitoring";
  if (key === "monitoring") return "aligned";
  return "aligned";
}

function applySoftLaunchOperationalCoherenceCaps({
  coherenceStatus,
  contradictions,
  isSmallDollar,
}) {
  if (!isSmallDollar) return { coherenceStatus, contradictions };
  let status = coherenceStatus;
  if (status !== "aligned") {
    status = downgradeOperationalCoherenceStatusOneNotch(status);
  }
  if (
    coherenceStatus === "leadership_review" &&
    (contradictions || []).length < 2
  ) {
    status = "mild_conflict";
  }
  return { coherenceStatus: status, contradictions };
}

function synthesizeOperationalCoherencePosture({
  layerEntries,
  treasuryRiskNarrative,
  coherenceStatus,
}) {
  const tiers = layerEntries.map((e) => e.tier);
  const dominant =
    tiers.length > 0
      ? Math.round(tiers.reduce((sum, t) => sum + t, 0) / tiers.length)
      : 2;
  const narrativePosture = String(treasuryRiskNarrative?.operatorPosture || "").toLowerCase();

  const tierPhrases = {
    1: "Routine monitoring with aligned operational guidance",
    2: "Steady observation with harmonized operational guidance",
    3: "Elevated review focus across operational guidance layers",
    4: "Leadership visibility review across operational guidance layers",
  };

  let phrase = tierPhrases[clamp(dominant, 1, 4)] || tierPhrases[2];

  if (narrativePosture === "observe" && dominant <= 2) {
    phrase = "Routine monitoring with aligned operational guidance";
  } else if (narrativePosture === "leadership_visibility" || coherenceStatus === "leadership_review") {
    phrase = "Leadership visibility warranted — reconcile operational story layers before changing cadence";
  } else if (narrativePosture === "elevated_review" && dominant >= 3) {
    phrase = "Elevated review focus with narrative and guidance layers in closer alignment";
  }

  return phrase;
}

function buildOperationalCoherenceRecommendations({
  coherenceStatus,
  contradictions,
  attentionPriority,
  operatorTimeline,
  institutionalMemory,
  consistencyCheck,
  isSmallDollar,
}) {
  const recommendations = [];
  const status = String(coherenceStatus || "monitoring").toLowerCase();

  if (status === "aligned" || status === "monitoring") {
    recommendations.push("Guidance layers generally align around monitoring posture.");
  }

  if (
    contradictions.some((c) => /institutional memory|historical/i.test(c)) ||
    String(institutionalMemory?.historicalPosture || "").toLowerCase() === "stable"
  ) {
    if ((attentionPriority?.immediateAttention || []).length >= 2) {
      recommendations.push(
        "Consider reconciling elevated attention priorities with stable institutional memory before changing cadence.",
      );
    }
  }

  for (const suggestion of consistencyCheck?.reconciliationSuggestions || []) {
    const text = sanitizeCoherenceText(suggestion, isSmallDollar);
    if (text) recommendations.push(text);
  }

  if ((operatorTimeline?.timelineRecommendations || []).length > 0 && status !== "aligned") {
    recommendations.push(
      "Review operator timeline sequencing alongside attention priorities to keep the operational story coherent.",
    );
  }

  for (const reason of attentionPriority?.priorityReasons || []) {
    const text = sanitizeCoherenceText(reason, isSmallDollar);
    if (text && recommendations.length < 5) recommendations.push(text);
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Continue routine treasury observation — operational coherence is advisory only.",
    );
  }

  return uniqueStrings(recommendations).slice(0, 5);
}

function deriveOperationalCoherenceConfidence({
  coherenceStatus,
  confidenceExplainability,
  contradictionCount,
  alignedCount,
  isSmallDollar,
}) {
  const base = Number(confidenceExplainability?.confidenceScore);
  let score = Number.isFinite(base) ? base : 50;

  const status = String(coherenceStatus || "monitoring").toLowerCase();
  if (status === "aligned") score += 10;
  else if (status === "monitoring") score += 2;
  else if (status === "mild_conflict") score -= 10;
  else if (status === "leadership_review") score -= 18;

  score += Math.min(alignedCount * 3, 9);
  score -= Math.min(contradictionCount * 4, 20);

  score = clamp(Math.round(score), 0, isSmallDollar ? 82 : 100);
  return score;
}

function buildOperationalCoherenceSummary({
  coherenceStatus,
  contradictions,
  alignedSignals,
  spread,
  isSmallDollar,
}) {
  const statusPhrase = {
    aligned: "broadly aligned",
    monitoring: "in routine monitoring with minor story differences to note",
    mild_conflict: "showing mild conflicts across operational guidance layers",
    leadership_review: "warranting leadership review of the operational story",
  };
  const phrase =
    statusPhrase[String(coherenceStatus || "monitoring").toLowerCase()] || statusPhrase.monitoring;
  const conflictCount = (contradictions || []).length;
  const alignCount = (alignedSignals || []).length;

  let base = `Treasury operational coherence check: guidance layers are ${phrase} (tier spread ${spread})`;
  if (alignCount > 0) {
    base += ` with ${alignCount} aligned signal${alignCount === 1 ? "" : "s"}`;
  }
  if (conflictCount > 0) {
    base += ` and ${conflictCount} contradiction${conflictCount === 1 ? "" : "s"} to reconcile`;
  }
  base += ". Advisory coherence only — no outputs overridden.";
  if (isSmallDollar) {
    base = softenText(base, true);
  }
  return base.trim();
}

/**
 * Pure advisory synthesis — cross-layer operational story coherence (Phase 3R).
 * READ-ONLY: explain alignment across playbook, timeline, attention, narrative, escalation — no overrides.
 * @param {object} args
 */
export function buildTreasuryOperationalCoherence({
  consistencyCheck = {},
  confidenceExplainability = {},
  treasuryRiskNarrative = {},
  operationalPlaybook = {},
  scenarioResponse = {},
  operatorTimeline = {},
  attentionPriority = {},
  executiveEscalation = {},
  decisionSupport = {},
  institutionalMemory = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });

    const layerEntries = collectOperationalCoherenceLayerEntries({
      treasuryRiskNarrative,
      operationalPlaybook,
      scenarioResponse,
      operatorTimeline,
      attentionPriority,
      decisionSupport,
      executiveEscalation,
      institutionalMemory,
      consistencyCheck,
    });

    const spread = computeOperationalCoherenceSpread(layerEntries);

    let contradictions = collectOperationalCoherenceContradictions({
      layerEntries,
      treasuryRiskNarrative,
      operationalPlaybook,
      scenarioResponse,
      operatorTimeline,
      attentionPriority,
      executiveEscalation,
      institutionalMemory,
      consistencyCheck,
      isSmallDollar,
    });

    const alignedSignals = buildOperationalCoherenceAlignedSignals({
      layerEntries,
      isSmallDollar,
    });

    let coherenceStatus = aggregateOperationalCoherenceStatus({
      spread,
      contradictions,
      consistencyStatus: consistencyCheck?.consistencyStatus,
      layerEntries,
    });

    ({ coherenceStatus, contradictions } = applySoftLaunchOperationalCoherenceCaps({
      coherenceStatus,
      contradictions,
      isSmallDollar,
    }));

    const operatorPosture = synthesizeOperationalCoherencePosture({
      layerEntries,
      treasuryRiskNarrative,
      coherenceStatus,
    });

    const recommendations = buildOperationalCoherenceRecommendations({
      coherenceStatus,
      contradictions,
      attentionPriority,
      operatorTimeline,
      institutionalMemory,
      consistencyCheck,
      isSmallDollar,
    });

    const confidence = deriveOperationalCoherenceConfidence({
      coherenceStatus,
      confidenceExplainability,
      contradictionCount: contradictions.length,
      alignedCount: alignedSignals.length,
      isSmallDollar,
    });

    const summary = buildOperationalCoherenceSummary({
      coherenceStatus,
      contradictions,
      alignedSignals,
      spread,
      isSmallDollar,
    });

    void liabilities;
    void exposure;

    return {
      coherenceStatus,
      contradictions,
      alignedSignals,
      operatorPosture,
      confidence,
      summary,
      recommendations,
    };
  } catch (err) {
    warn({ op: "buildTreasuryOperationalCoherence", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_OPERATIONAL_COHERENCE };
  }
}

export function formatTreasuryOperationalCoherenceChipLabel(result) {
  const status = String(result?.coherenceStatus || "monitoring").toLowerCase();
  const labels = {
    aligned: "Treasury coherence: Aligned",
    monitoring: "Treasury coherence: Monitoring",
    mild_conflict: "Treasury coherence: Mild conflict",
    leadership_review: "Treasury coherence: Leadership review",
  };
  return labels[status] || labels.monitoring;
}

const EMPTY_TREASURY_ADAPTIVE_REVIEW_CADENCE = Object.freeze({
  cadenceStatus: "monitoring",
  recommendedCadence: "every_few_days",
  reviewReasoning: [
    "Treasury adaptive review cadence is not yet available — continue routine advisory observation.",
  ],
  reviewChecklist: ["Continue routine treasury observation — advisory cadence only."],
  confidence: 0,
  summary:
    "Treasury adaptive review cadence unavailable — advisory recommendation only. Nothing scheduled or sent.",
});

const CADENCE_STATUS_RANK = Object.freeze({
  stable: 1,
  monitoring: 2,
  elevated_attention: 3,
  leadership_visibility: 4,
});

const RECOMMENDED_CADENCE_RANK = Object.freeze({
  weekly_review: 1,
  every_few_days: 2,
  daily_review: 3,
  immediate_visibility: 4,
});

const FORBIDDEN_CADENCE_PHRASES = Object.freeze([
  "review immediately",
  "urgent",
  "emergency",
  "critical",
  ...FORBIDDEN_TIMELINE_PHRASES,
]);

function isForbiddenCadenceText(text) {
  const lower = String(text || "").toLowerCase();
  return FORBIDDEN_CADENCE_PHRASES.some((phrase) => lower.includes(phrase));
}

function sanitizeCadenceText(text, isSmallDollar) {
  const t = String(text || "").trim();
  if (!t || isForbiddenCadenceText(t)) return "";
  return isSmallDollar ? softenText(t, true) : t;
}

function mapCoherenceStatusToCadenceStatus(coherenceStatus) {
  const key = String(coherenceStatus || "monitoring").toLowerCase();
  if (key === "aligned") return "stable";
  if (key === "monitoring") return "monitoring";
  if (key === "mild_conflict") return "elevated_attention";
  if (key === "leadership_review") return "leadership_visibility";
  return "monitoring";
}

function mapNarrativeStatusToCadenceStatus(narrativeStatus) {
  const key = String(narrativeStatus || "monitoring").toLowerCase();
  if (key === "calm") return "stable";
  if (key === "monitoring") return "monitoring";
  if (key === "elevated_attention") return "elevated_attention";
  if (key === "leadership_visibility") return "leadership_visibility";
  return "monitoring";
}

function mapExecutiveAttentionToCadenceStatus(executiveAttentionStatus) {
  const key = String(executiveAttentionStatus || "observe").toLowerCase();
  if (key === "quiet") return "stable";
  if (key === "observe") return "monitoring";
  if (key === "leadership_attention") return "elevated_attention";
  if (key === "executive_review") return "leadership_visibility";
  return "monitoring";
}

function aggregateAdaptiveReviewCadenceStatus({
  operationalCoherence,
  attentionPriority,
  operatorTimeline,
  treasuryRiskNarrative,
  executiveEscalation,
}) {
  const candidates = [
    mapCoherenceStatusToCadenceStatus(operationalCoherence?.coherenceStatus),
    String(attentionPriority?.priorityStatus || "").toLowerCase() || null,
    String(operatorTimeline?.timelineStatus || "").toLowerCase() || null,
    mapNarrativeStatusToCadenceStatus(treasuryRiskNarrative?.treasuryNarrativeStatus),
    mapExecutiveAttentionToCadenceStatus(executiveEscalation?.executiveAttentionStatus),
  ].filter(Boolean);

  let maxRank = 0;
  let result = "monitoring";
  for (const status of candidates) {
    const rank = CADENCE_STATUS_RANK[status] || 2;
    if (rank > maxRank) {
      maxRank = rank;
      result = status;
    }
  }
  return result;
}

function mapCadenceStatusToRecommendedCadence(cadenceStatus) {
  const key = String(cadenceStatus || "monitoring").toLowerCase();
  if (key === "stable") return "weekly_review";
  if (key === "monitoring") return "every_few_days";
  if (key === "elevated_attention") return "daily_review";
  if (key === "leadership_visibility") return "immediate_visibility";
  return "every_few_days";
}

function mapUpstreamOperatorCadenceToRecommended(cadence) {
  const key = String(cadence || "").toLowerCase();
  if (key === "immediate_visibility") return "immediate_visibility";
  if (key === "daily_review") return "daily_review";
  if (key === "every_few_days") return "every_few_days";
  if (key === "routine" || key === "weekly_review" || key === "weekly") return "weekly_review";
  return null;
}

function mapExecutiveCadenceToRecommended(cadence) {
  const key = String(cadence || "").toLowerCase();
  if (key === "immediate_review") return "immediate_visibility";
  if (key === "daily") return "daily_review";
  if (key === "weekly" || key === "none") return "weekly_review";
  return null;
}

function maxRecommendedCadenceRank(cadences) {
  let maxRank = 0;
  let result = null;
  for (const cadence of cadences) {
    if (!cadence) continue;
    const rank = RECOMMENDED_CADENCE_RANK[cadence] || 0;
    if (rank > maxRank) {
      maxRank = rank;
      result = cadence;
    }
  }
  return result;
}

function reconcileAdaptiveRecommendedCadence({
  cadenceStatus,
  statusBasedCadence,
  operationalPlaybook,
  operatorTimeline,
  executiveEscalation,
  operationalCoherence,
}) {
  const upstreamCadences = [
    mapUpstreamOperatorCadenceToRecommended(operationalPlaybook?.operatorCadence),
    mapUpstreamOperatorCadenceToRecommended(operatorTimeline?.cadence),
    mapExecutiveCadenceToRecommended(executiveEscalation?.recommendedExecutiveCadence),
  ].filter(Boolean);

  const upstreamMax = maxRecommendedCadenceRank(upstreamCadences);
  let result = statusBasedCadence;

  const coherenceKey = String(operationalCoherence?.coherenceStatus || "aligned").toLowerCase();
  const coherenceConflict =
    coherenceKey === "mild_conflict" || coherenceKey === "leadership_review";

  const statusRank = RECOMMENDED_CADENCE_RANK[statusBasedCadence] || 2;
  const upstreamRank = upstreamMax ? RECOMMENDED_CADENCE_RANK[upstreamMax] || 1 : 0;

  if (upstreamRank > statusRank && coherenceConflict && upstreamMax) {
    result = upstreamMax;
  } else if (
    String(cadenceStatus || "").toLowerCase() === "stable" &&
    (!upstreamMax || upstreamMax === "weekly_review")
  ) {
    result = "weekly_review";
  }

  return result;
}

function downgradeAdaptiveCadenceStatusOneNotch(status) {
  const key = String(status || "monitoring").toLowerCase();
  if (key === "leadership_visibility") return "elevated_attention";
  if (key === "elevated_attention") return "monitoring";
  if (key === "monitoring") return "stable";
  return "stable";
}

function capRecommendedCadenceAtEveryFewDays(cadence) {
  const key = String(cadence || "every_few_days").toLowerCase();
  const rank = RECOMMENDED_CADENCE_RANK[key] || 2;
  if (rank > RECOMMENDED_CADENCE_RANK.every_few_days) {
    return "every_few_days";
  }
  return key;
}

function applySoftLaunchAdaptiveReviewCadenceCaps({
  cadenceStatus,
  recommendedCadence,
  elevatedSignalCount,
  isSmallDollar,
}) {
  if (!isSmallDollar) return { cadenceStatus, recommendedCadence };

  let status = downgradeAdaptiveCadenceStatusOneNotch(cadenceStatus);
  let cadence = recommendedCadence;

  const allowImmediate =
    String(status || "").toLowerCase() === "leadership_visibility" && elevatedSignalCount >= 2;

  if (!allowImmediate) {
    cadence = capRecommendedCadenceAtEveryFewDays(cadence);
    if (String(status || "").toLowerCase() === "leadership_visibility") {
      status = "elevated_attention";
    }
  }

  return { cadenceStatus: status, recommendedCadence: cadence };
}

function buildAdaptiveReviewReasoning({
  cadenceStatus,
  recommendedCadence,
  operationalCoherence,
  attentionPriority,
  operatorTimeline,
  treasuryRiskNarrative,
  executiveEscalation,
  operationalPlaybook,
  isSmallDollar,
}) {
  const reasons = [];
  const status = String(cadenceStatus || "monitoring").toLowerCase();
  const cadence = String(recommendedCadence || "every_few_days").toLowerCase();
  const coherenceKey = String(operationalCoherence?.coherenceStatus || "monitoring").toLowerCase();

  if (status === "stable" || cadence === "weekly_review") {
    reasons.push(
      "Guidance layers generally align around a stable monitoring posture, supporting weekly treasury review.",
    );
  }

  if (status === "monitoring" || cadence === "every_few_days") {
    reasons.push(
      "Guidance layers generally align around monitoring posture, supporting review every few days.",
    );
  }

  if (status === "elevated_attention" || cadence === "daily_review") {
    reasons.push(
      "Elevated attention priorities and scenario response suggest daily review consideration.",
    );
  }

  if (coherenceKey === "mild_conflict") {
    reasons.push(
      "Operational coherence indicates mild conflict; nearer-term review may help reconcile guidance.",
    );
  }

  if (coherenceKey === "leadership_review" || status === "leadership_visibility") {
    reasons.push(
      "Cross-layer guidance warrants leadership visibility — consider reconciling the operational story during review.",
    );
  }

  const timelineStatus = String(operatorTimeline?.timelineStatus || "").toLowerCase();
  if (timelineStatus === "elevated_attention" || timelineStatus === "leadership_visibility") {
    reasons.push(
      "Operator timeline sequencing suggests closer attention to near-term focus items during each review session.",
    );
  }

  const narrativeStatus = String(treasuryRiskNarrative?.treasuryNarrativeStatus || "").toLowerCase();
  if (narrativeStatus === "elevated_attention" || narrativeStatus === "leadership_visibility") {
    reasons.push(
      "Treasury risk narrative posture supports a nearer-term review cadence for observational reconciliation.",
    );
  }

  const execStatus = String(executiveEscalation?.executiveAttentionStatus || "").toLowerCase();
  if (execStatus === "leadership_attention" || execStatus === "executive_review") {
    reasons.push(
      "Executive escalation context suggests leadership should see treasury signals during the next review period.",
    );
  }

  const playbookStatus = String(operationalPlaybook?.playbookStatus || "").toLowerCase();
  if (playbookStatus === "elevated_review" || playbookStatus === "leadership_visibility") {
    reasons.push(
      "Operational playbook posture aligns with elevated observational review — advisory cadence only.",
    );
  }

  for (const reason of attentionPriority?.priorityReasons || []) {
    const text = sanitizeCadenceText(reason, isSmallDollar);
    if (text && reasons.length < 5) reasons.push(text);
  }

  if (reasons.length === 0) {
    reasons.push(
      "Continue routine treasury observation — adaptive review cadence is advisory only.",
    );
  }

  return uniqueStrings(reasons.map((r) => sanitizeCadenceText(r, isSmallDollar)).filter(Boolean)).slice(0, 5);
}

function buildAdaptiveReviewChecklist({
  attentionPriority,
  operationalPlaybook,
  decisionSupport,
  operationalCoherence,
  isSmallDollar,
}) {
  const items = [];

  for (const item of [
    ...(attentionPriority?.immediateAttention || []),
    ...(attentionPriority?.nearTermAttention || []),
  ]) {
    const text = sanitizeCadenceText(item, isSmallDollar);
    if (text) items.push(text);
    if (items.length >= 4) break;
  }

  for (const item of (operationalPlaybook?.watchChecklist || []).slice(0, 3)) {
    const text = sanitizeCadenceText(item, isSmallDollar);
    if (text) items.push(text);
  }

  for (const item of (decisionSupport?.monitoringRecommendations || []).slice(0, 3)) {
    const text = sanitizeCadenceText(item, isSmallDollar);
    if (text) items.push(text);
  }

  for (const item of (operationalCoherence?.recommendations || []).slice(0, 2)) {
    const text = sanitizeCadenceText(item, isSmallDollar);
    if (text) items.push(text);
  }

  if (items.length === 0) {
    items.push("Continue routine treasury observation during the next review period — advisory only.");
  }

  return uniqueStrings(items).slice(0, 12);
}

function deriveAdaptiveReviewConfidence({
  operationalCoherence,
  operatorTimeline,
  attentionPriority,
  confidenceExplainability,
  isSmallDollar,
}) {
  const parts = [
    operationalCoherence?.confidence,
    operatorTimeline?.confidence,
    attentionPriority?.confidence,
    confidenceExplainability?.confidenceScore,
  ].map((v) => Number(v));

  const finite = parts.filter((n) => Number.isFinite(n));
  let score = finite.length > 0 ? Math.round(finite.reduce((a, b) => a + b, 0) / finite.length) : 50;

  const coherenceKey = String(operationalCoherence?.coherenceStatus || "monitoring").toLowerCase();
  if (coherenceKey === "mild_conflict") score -= 12;
  else if (coherenceKey === "leadership_review") score -= 18;

  return clamp(Math.round(score), 0, isSmallDollar ? 82 : 100);
}

function humanizeAdaptiveRecommendedCadence(cadence) {
  const key = String(cadence || "weekly_review").toLowerCase();
  const labels = {
    weekly_review: "weekly review",
    every_few_days: "review every few days",
    daily_review: "daily review",
    immediate_visibility: "immediate leadership visibility during review",
  };
  return labels[key] || labels.weekly_review;
}

function buildAdaptiveReviewSummary({
  cadenceStatus,
  recommendedCadence,
  confidence,
  isSmallDollar,
}) {
  const statusPhrase = humanizeTreasuryToken(cadenceStatus);
  const cadencePhrase = humanizeAdaptiveRecommendedCadence(recommendedCadence);
  const cadenceKey = String(recommendedCadence || "").toLowerCase();

  let cadenceGuidance =
    "Consider revisiting treasury signals during the next routine review period.";
  if (cadenceKey === "every_few_days") {
    cadenceGuidance = "Consider revisiting treasury signals every few days during this monitoring posture.";
  } else if (cadenceKey === "daily_review") {
    cadenceGuidance =
      "Consider revisiting treasury signals on a daily observational cadence — advisory only, nothing scheduled.";
  } else if (cadenceKey === "immediate_visibility") {
    cadenceGuidance =
      "Consider revisiting treasury signals during the next routine review period with leadership visibility in mind.";
  }

  let base = `Treasury adaptive review cadence: ${statusPhrase} posture suggests ${cadencePhrase} (confidence ${confidence}/100). ${cadenceGuidance} Advisory cadence recommendation only — nothing scheduled or sent.`;
  if (isSmallDollar) {
    base = softenText(base, true);
  }
  return base.trim();
}

/**
 * Pure advisory synthesis — treasury adaptive review cadence (Phase 3S).
 * READ-ONLY: recommends review frequency — no scheduling, notifications, or execution.
 * @param {object} args
 */
export function buildTreasuryAdaptiveReviewCadence({
  operationalCoherence = {},
  operatorTimeline = {},
  attentionPriority = {},
  executiveEscalation = {},
  operationalPlaybook = {},
  decisionSupport = {},
  treasuryRiskNarrative = {},
  confidenceExplainability = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const elevatedSignalCount = countElevatedEscalationSignals(executiveEscalation?.escalationSignals);

    let cadenceStatus = aggregateAdaptiveReviewCadenceStatus({
      operationalCoherence,
      attentionPriority,
      operatorTimeline,
      treasuryRiskNarrative,
      executiveEscalation,
    });

    const statusBasedCadence = mapCadenceStatusToRecommendedCadence(cadenceStatus);
    let recommendedCadence = reconcileAdaptiveRecommendedCadence({
      cadenceStatus,
      statusBasedCadence,
      operationalPlaybook,
      operatorTimeline,
      executiveEscalation,
      operationalCoherence,
    });

    if (isSmallDollar) {
      ({ cadenceStatus, recommendedCadence } = applySoftLaunchAdaptiveReviewCadenceCaps({
        cadenceStatus,
        recommendedCadence,
        elevatedSignalCount,
        isSmallDollar,
      }));
    }

    const reviewReasoning = buildAdaptiveReviewReasoning({
      cadenceStatus,
      recommendedCadence,
      operationalCoherence,
      attentionPriority,
      operatorTimeline,
      treasuryRiskNarrative,
      executiveEscalation,
      operationalPlaybook,
      isSmallDollar,
    });

    const reviewChecklist = buildAdaptiveReviewChecklist({
      attentionPriority,
      operationalPlaybook,
      decisionSupport,
      operationalCoherence,
      isSmallDollar,
    });

    const confidence = deriveAdaptiveReviewConfidence({
      operationalCoherence,
      operatorTimeline,
      attentionPriority,
      confidenceExplainability,
      isSmallDollar,
    });

    const summary = buildAdaptiveReviewSummary({
      cadenceStatus,
      recommendedCadence,
      confidence,
      isSmallDollar,
    });

    void liabilities;
    void exposure;

    return {
      cadenceStatus,
      recommendedCadence,
      reviewReasoning,
      reviewChecklist,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryAdaptiveReviewCadence", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_ADAPTIVE_REVIEW_CADENCE };
  }
}

export function formatTreasuryAdaptiveReviewCadenceChipLabel(result) {
  const cadence = String(result?.recommendedCadence || "").toLowerCase();
  const labels = {
    weekly_review: "Treasury cadence: Weekly review",
    every_few_days: "Treasury cadence: Every few days",
    daily_review: "Treasury cadence: Daily review",
    immediate_visibility: "Treasury cadence: Immediate visibility",
  };
  if (labels[cadence]) return labels[cadence];
  const status = String(result?.cadenceStatus || "monitoring").toLowerCase();
  const fallback = mapCadenceStatusToRecommendedCadence(status);
  return labels[fallback] || labels.every_few_days;
}

const EMPTY_TREASURY_LEADERSHIP_READINESS = Object.freeze({
  readinessStatus: "monitoring_visibility",
  visibilityTier: "informational",
  leadershipSignals: [],
  operatorSignals: [],
  reasoning: [
    "Treasury leadership readiness synthesis is not yet available — continue routine operator-level observation.",
  ],
  confidence: 0,
  summary:
    "Treasury leadership readiness unavailable — advisory visibility guidance only. No leadership notifications sent.",
});

const LEADERSHIP_READINESS_STATUS_RANK = Object.freeze({
  operator_level: 1,
  monitoring_visibility: 2,
  leadership_visibility: 3,
  executive_attention: 4,
});

const VISIBILITY_TIER_BY_READINESS_STATUS = Object.freeze({
  operator_level: "routine",
  monitoring_visibility: "informational",
  leadership_visibility: "leadership",
  executive_attention: "executive",
});

const FORBIDDEN_LEADERSHIP_READINESS_PHRASES = Object.freeze([
  "escalate immediately",
  "urgent",
  "emergency",
  "critical",
  "crisis",
  ...FORBIDDEN_CADENCE_PHRASES,
]);

function isForbiddenLeadershipReadinessText(text) {
  const lower = String(text || "").toLowerCase();
  return FORBIDDEN_LEADERSHIP_READINESS_PHRASES.some((phrase) => lower.includes(phrase));
}

function sanitizeLeadershipReadinessText(text, isSmallDollar) {
  const t = String(text || "").trim();
  if (!t || isForbiddenLeadershipReadinessText(t)) return "";
  return isSmallDollar ? softenText(t, true) : t;
}

function truncateLeadershipSignal(text, maxLen = 140) {
  const t = String(text || "").trim();
  if (!t) return "";
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1).trim()}…`;
}

function isElevatedPlusAttentionPriorityStatus(priorityStatus) {
  const key = String(priorityStatus || "").toLowerCase();
  return key === "elevated_attention" || key === "leadership_visibility";
}

function collectLeadershipReadinessStatusCandidates({
  adaptiveReviewCadence,
  operationalCoherence,
  attentionPriority,
  executiveEscalation,
  treasuryRiskNarrative,
  institutionalMemory,
  decisionSupport,
}) {
  const candidates = [];
  const cadenceStatus = String(adaptiveReviewCadence?.cadenceStatus || "monitoring").toLowerCase();
  const recommendedCadence = String(adaptiveReviewCadence?.recommendedCadence || "every_few_days").toLowerCase();
  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "monitoring").toLowerCase();
  const priorityStatus = String(attentionPriority?.priorityStatus || "monitoring").toLowerCase();
  const execStatus = String(executiveEscalation?.executiveAttentionStatus || "observe").toLowerCase();
  const narrativeStatus = String(treasuryRiskNarrative?.treasuryNarrativeStatus || "monitoring").toLowerCase();
  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "monitoring").toLowerCase();
  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "minimal_history").toLowerCase();
  const leadershipContext = String(treasuryRiskNarrative?.leadershipContext || "").trim();

  if (execStatus === "executive_review") candidates.push("executive_attention");
  if (decisionStatus === "leadership_review") candidates.push("executive_attention");
  if (recommendedCadence === "immediate_visibility") candidates.push("executive_attention");
  if (coherenceStatus === "leadership_review") candidates.push("executive_attention");

  if (execStatus === "leadership_attention") candidates.push("leadership_visibility");
  if (isElevatedPlusAttentionPriorityStatus(priorityStatus)) candidates.push("leadership_visibility");
  if (narrativeStatus === "leadership_visibility" || narrativeStatus === "elevated_attention") {
    candidates.push("leadership_visibility");
  }
  if (recommendedCadence === "daily_review") candidates.push("leadership_visibility");
  if (
    coherenceStatus === "mild_conflict" &&
    (execStatus === "leadership_attention" || priorityStatus === "leadership_visibility")
  ) {
    candidates.push("leadership_visibility");
  }

  if (recommendedCadence === "every_few_days" || cadenceStatus === "monitoring") {
    candidates.push("monitoring_visibility");
  }
  if (memoryStatus === "monitoring_patterns") candidates.push("monitoring_visibility");
  if (leadershipContext && narrativeStatus !== "calm") candidates.push("monitoring_visibility");

  const operatorAligned =
    (cadenceStatus === "stable" || recommendedCadence === "weekly_review") &&
    coherenceStatus === "aligned" &&
    priorityStatus === "stable" &&
    (execStatus === "quiet" || execStatus === "observe") &&
    narrativeStatus === "calm" &&
    decisionStatus === "stable";
  if (operatorAligned) candidates.push("operator_level");

  if (cadenceStatus === "stable" || recommendedCadence === "weekly_review") candidates.push("operator_level");
  if (coherenceStatus === "aligned") candidates.push("operator_level");
  if (priorityStatus === "stable") candidates.push("operator_level");
  if (execStatus === "quiet" || execStatus === "observe") candidates.push("operator_level");
  if (narrativeStatus === "calm") candidates.push("operator_level");
  if (decisionStatus === "stable" || decisionStatus === "monitoring") candidates.push("operator_level");
  if (memoryStatus === "stable_pattern") candidates.push("operator_level");

  return candidates.length > 0 ? candidates : ["monitoring_visibility"];
}

function aggregateLeadershipReadinessStatus(candidates) {
  let maxRank = 0;
  let status = "monitoring_visibility";
  for (const candidate of candidates) {
    const rank = LEADERSHIP_READINESS_STATUS_RANK[candidate] || 0;
    if (rank > maxRank) {
      maxRank = rank;
      status = candidate;
    }
  }
  return status;
}

function mapReadinessStatusToVisibilityTier(readinessStatus) {
  const key = String(readinessStatus || "monitoring_visibility").toLowerCase();
  return VISIBILITY_TIER_BY_READINESS_STATUS[key] || "informational";
}

function collectLeadershipReadinessLeadershipSignals({
  executiveEscalation,
  treasuryRiskNarrative,
  attentionPriority,
  decisionSupport,
  isSmallDollar,
}) {
  const signals = [];

  for (const signal of executiveEscalation?.escalationSignals || []) {
    const text = sanitizeLeadershipReadinessText(
      typeof signal === "string" ? signal : signal?.summary || signal?.reason || signal?.signal,
      isSmallDollar,
    );
    if (text) signals.push(truncateLeadershipSignal(text));
  }

  const leadershipSummary = executiveEscalation?.leadershipSummary || {};
  const headline = sanitizeLeadershipReadinessText(leadershipSummary.headline, isSmallDollar);
  if (headline) {
    signals.push(
      truncateLeadershipSignal(
        "Conditions may be worth including in leadership visibility — " + headline,
      ),
    );
  }

  for (const rec of leadershipSummary.recommendations || []) {
    const text = sanitizeLeadershipReadinessText(rec, isSmallDollar);
    if (text) {
      signals.push(
        truncateLeadershipSignal(
          "Conditions may be worth including in leadership visibility — " + text,
        ),
      );
    }
  }

  const leadershipContext = sanitizeLeadershipReadinessText(
    treasuryRiskNarrative?.leadershipContext,
    isSmallDollar,
  );
  if (leadershipContext) {
    signals.push(truncateLeadershipSignal(leadershipContext));
  }

  if (isElevatedPlusAttentionPriorityStatus(attentionPriority?.priorityStatus)) {
    for (const item of (attentionPriority?.immediateAttention || []).slice(0, 4)) {
      const text = sanitizeLeadershipReadinessText(item, isSmallDollar);
      if (text) {
        signals.push(
          truncateLeadershipSignal(
            "Elevated attention priority — conditions may be worth leadership visibility review: " + text,
          ),
        );
      }
    }
  }

  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "").toLowerCase();
  if (decisionStatus === "leadership_review" || decisionStatus === "attention_recommended") {
    for (const action of (decisionSupport?.priorityActions || []).slice(0, 2)) {
      const text = sanitizeLeadershipReadinessText(action, isSmallDollar);
      if (text) {
        signals.push(truncateLeadershipSignal("Decision support theme: " + text));
      }
    }
  }

  return uniqueStrings(signals).slice(0, 8);
}

function collectLeadershipReadinessOperatorSignals({
  operationalPlaybook,
  operatorTimeline,
  decisionSupport,
  institutionalMemory,
  attentionPriority,
  isSmallDollar,
}) {
  const signals = [];
  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "monitoring").toLowerCase();

  for (const item of operationalPlaybook?.recommendedPlaybook || []) {
    const text = sanitizeLeadershipReadinessText(item, isSmallDollar);
    if (text) signals.push(truncateLeadershipSignal(text));
  }

  for (const item of (operatorTimeline?.currentFocus || []).slice(0, 4)) {
    const text = sanitizeLeadershipReadinessText(item, isSmallDollar);
    if (text) signals.push(truncateLeadershipSignal(text));
  }

  if (decisionStatus === "stable" || decisionStatus === "monitoring") {
    for (const rec of (decisionSupport?.monitoringRecommendations || []).slice(0, 3)) {
      const text = sanitizeLeadershipReadinessText(rec, isSmallDollar);
      if (text) signals.push(truncateLeadershipSignal(text));
    }
  }

  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "").toLowerCase();
  if (memoryStatus === "stable_pattern") {
    for (const pattern of (institutionalMemory?.recurringPatterns || []).slice(0, 2)) {
      const text = sanitizeLeadershipReadinessText(
        typeof pattern === "string" ? pattern : pattern?.summary || pattern?.pattern,
        isSmallDollar,
      );
      if (text) signals.push(truncateLeadershipSignal("Stable institutional pattern: " + text));
    }
    if (signals.length === 0) {
      signals.push("Institutional memory reflects stable recurring patterns supporting operator-level handling.");
    }
  }

  for (const item of (attentionPriority?.routineAttention || []).slice(0, 4)) {
    const text = sanitizeLeadershipReadinessText(item, isSmallDollar);
    if (text) signals.push(truncateLeadershipSignal(text));
  }

  const out = uniqueStrings(signals).slice(0, 8);
  if (out.length === 0) {
    out.push("Routine treasury observation remains appropriate at the operator level — advisory only.");
  }
  return out;
}

function buildLeadershipReadinessReasoning({
  readinessStatus,
  adaptiveReviewCadence,
  operationalCoherence,
  attentionPriority,
  executiveEscalation,
  treasuryRiskNarrative,
  decisionSupport,
  isSmallDollar,
}) {
  const reasons = [];
  const cadenceStatus = String(adaptiveReviewCadence?.cadenceStatus || "monitoring").toLowerCase();
  const recommendedCadence = String(adaptiveReviewCadence?.recommendedCadence || "every_few_days").toLowerCase();
  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "monitoring").toLowerCase();
  const priorityStatus = String(attentionPriority?.priorityStatus || "monitoring").toLowerCase();
  const execStatus = String(executiveEscalation?.executiveAttentionStatus || "observe").toLowerCase();
  const narrativeStatus = String(treasuryRiskNarrative?.treasuryNarrativeStatus || "monitoring").toLowerCase();
  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "monitoring").toLowerCase();
  const contradictionCount = (operationalCoherence?.contradictions || []).length;

  if (readinessStatus === "operator_level") {
    reasons.push(
      "Guidance layers align around stable posture; operator-level review remains appropriate.",
    );
  } else if (readinessStatus === "monitoring_visibility") {
    reasons.push(
      "Guidance layers align around monitoring posture; operator-level review remains appropriate with informational leadership context.",
    );
  } else if (readinessStatus === "leadership_visibility") {
    reasons.push(
      "Elevated attention priorities and executive cadence suggest leadership visibility may be worth considering.",
    );
  } else if (readinessStatus === "executive_attention") {
    reasons.push(
      "Multiple guidance layers converge on executive-tier visibility themes — advisory synthesis only, no delivery.",
    );
  }

  if (recommendedCadence === "every_few_days" || cadenceStatus === "monitoring") {
    reasons.push("Adaptive review cadence suggests monitoring-tier visibility rather than routine operator handling alone.");
  } else if (recommendedCadence === "daily_review" || recommendedCadence === "immediate_visibility") {
    reasons.push("Adaptive review cadence suggests nearer-term leadership visibility during observational review.");
  } else if (recommendedCadence === "weekly_review" || cadenceStatus === "stable") {
    reasons.push("Adaptive review cadence supports routine operator-level treasury review.");
  }

  if (coherenceStatus === "aligned") {
    reasons.push("Operational coherence is aligned across treasury guidance layers.");
  } else if (coherenceStatus === "mild_conflict") {
    reasons.push("Mild coherence tension is present — interpret leadership visibility guidance cautiously.");
  } else if (coherenceStatus === "leadership_review") {
    reasons.push("Coherence synthesis includes leadership-review themes worth noting in visibility planning.");
  }

  if (isElevatedPlusAttentionPriorityStatus(priorityStatus)) {
    reasons.push("Attention priority buckets include elevated items that may warrant leadership visibility context.");
  } else if (priorityStatus === "stable") {
    reasons.push("Attention priorities remain stable, supporting operator-level handling.");
  }

  if (execStatus === "leadership_attention" || execStatus === "executive_review") {
    reasons.push("Executive escalation posture includes leadership-tier advisory themes — visibility guidance only.");
  } else if (execStatus === "quiet" || execStatus === "observe") {
    reasons.push("Executive escalation posture is quiet, favoring operator-level visibility.");
  }

  if (narrativeStatus === "calm") {
    reasons.push("Treasury risk narrative remains calm from an operator perspective.");
  } else if (narrativeStatus === "leadership_visibility" || narrativeStatus === "elevated_attention") {
    reasons.push("Risk narrative includes leadership-context themes worth noting for visibility planning.");
  }

  if (decisionStatus === "stable" || decisionStatus === "monitoring") {
    reasons.push("Decision support remains in stable or monitoring posture.");
  } else if (decisionStatus === "leadership_review") {
    reasons.push("Decision support includes leadership-review themes in this synthesis.");
  }

  if (contradictionCount > 0) {
    reasons.push("Mixed coherence signals temper confidence in the visibility tier recommendation.");
  }

  const out = [];
  for (const reason of reasons) {
    const text = sanitizeLeadershipReadinessText(reason, isSmallDollar);
    if (text) out.push(text);
    if (out.length >= 5) break;
  }

  if (out.length < 3) {
    out.push(
      "Leadership readiness synthesizes Phase 3 guidance layers into advisory visibility posture — no notifications sent.",
    );
  }

  return out.slice(0, 5);
}

function deriveLeadershipReadinessConfidence({
  adaptiveReviewCadence,
  operationalCoherence,
  attentionPriority,
  confidenceExplainability,
  isSmallDollar,
}) {
  const parts = [
    adaptiveReviewCadence?.confidence,
    operationalCoherence?.confidence,
    attentionPriority?.confidence,
    confidenceExplainability?.confidenceScore,
  ].map((v) => Number(v));

  const finite = parts.filter((n) => Number.isFinite(n));
  let score = finite.length > 0 ? Math.round(finite.reduce((a, b) => a + b, 0) / finite.length) : 50;

  const coherenceKey = String(operationalCoherence?.coherenceStatus || "monitoring").toLowerCase();
  if (coherenceKey === "mild_conflict") score -= 10;
  else if (coherenceKey === "leadership_review") score -= 16;

  const contradictionCount = (operationalCoherence?.contradictions || []).length;
  if (contradictionCount > 0) score -= Math.min(12, contradictionCount * 4);

  return clamp(Math.round(score), 0, isSmallDollar ? 82 : 100);
}

function applySoftLaunchLeadershipReadinessCaps({
  readinessStatus,
  leadershipSignals,
  elevatedSignalCount,
  isSmallDollar,
}) {
  if (!isSmallDollar) return readinessStatus;

  const leadershipSignalCount = (leadershipSignals || []).length;
  const hasElevatedEscalation = elevatedSignalCount >= 1;
  const allowAboveMonitoring = leadershipSignalCount >= 2 && hasElevatedEscalation;

  if (!allowAboveMonitoring) {
    if (readinessStatus === "leadership_visibility" || readinessStatus === "executive_attention") {
      return "monitoring_visibility";
    }
    return readinessStatus;
  }

  if (readinessStatus === "executive_attention") {
    return "leadership_visibility";
  }

  return readinessStatus;
}

function humanizeLeadershipReadinessStatus(readinessStatus) {
  const key = String(readinessStatus || "monitoring_visibility").toLowerCase();
  const labels = {
    operator_level: "operator-level handling",
    monitoring_visibility: "monitoring visibility",
    leadership_visibility: "leadership visibility",
    executive_attention: "executive attention",
  };
  return labels[key] || labels.monitoring_visibility;
}

function buildLeadershipReadinessSummaryParagraph({
  readinessStatus,
  visibilityTier,
  confidence,
  leadershipSignalCount,
  operatorSignalCount,
  isSmallDollar,
}) {
  const statusPhrase = humanizeLeadershipReadinessStatus(readinessStatus);
  const tierPhrase = humanizeTreasuryToken(visibilityTier);
  let base = `Treasury leadership readiness: ${statusPhrase} (visibility tier ${tierPhrase}, confidence ${confidence}/100). `;
  base += `Synthesized from ${leadershipSignalCount} leadership-context signal${leadershipSignalCount === 1 ? "" : "s"} and ${operatorSignalCount} operator-support signal${operatorSignalCount === 1 ? "" : "s"}. `;
  base += "Advisory visibility guidance only — no leadership notifications sent, scheduled, or delivered.";
  if (isSmallDollar) {
    base = `Soft-launch advisory: ${base}`;
  }
  const sanitized = sanitizeLeadershipReadinessText(base, false);
  return sanitized || base;
}

/**
 * Pure advisory synthesis — operator-level vs leadership-visible readiness from Phase 3 layers.
 * READ-ONLY: advises visibility tier only — no notifications, escalations, delivery, or financial mutations.
 * @param {object} args
 */
export function buildTreasuryLeadershipReadiness({
  adaptiveReviewCadence = {},
  operationalCoherence = {},
  attentionPriority = {},
  executiveEscalation = {},
  treasuryRiskNarrative = {},
  operatorTimeline = {},
  operationalPlaybook = {},
  institutionalMemory = {},
  confidenceExplainability = {},
  decisionSupport = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const elevatedSignalCount = countElevatedEscalationSignals(executiveEscalation?.escalationSignals);

    const statusCandidates = collectLeadershipReadinessStatusCandidates({
      adaptiveReviewCadence,
      operationalCoherence,
      attentionPriority,
      executiveEscalation,
      treasuryRiskNarrative,
      institutionalMemory,
      decisionSupport,
    });

    let readinessStatus = aggregateLeadershipReadinessStatus(statusCandidates);

    const leadershipSignals = collectLeadershipReadinessLeadershipSignals({
      executiveEscalation,
      treasuryRiskNarrative,
      attentionPriority,
      decisionSupport,
      isSmallDollar,
    });

    const operatorSignals = collectLeadershipReadinessOperatorSignals({
      operationalPlaybook,
      operatorTimeline,
      decisionSupport,
      institutionalMemory,
      attentionPriority,
      isSmallDollar,
    });

    readinessStatus = applySoftLaunchLeadershipReadinessCaps({
      readinessStatus,
      leadershipSignals,
      elevatedSignalCount,
      isSmallDollar,
    });

    const visibilityTier = mapReadinessStatusToVisibilityTier(readinessStatus);

    const reasoning = buildLeadershipReadinessReasoning({
      readinessStatus,
      adaptiveReviewCadence,
      operationalCoherence,
      attentionPriority,
      executiveEscalation,
      treasuryRiskNarrative,
      decisionSupport,
      isSmallDollar,
    });

    const confidence = deriveLeadershipReadinessConfidence({
      adaptiveReviewCadence,
      operationalCoherence,
      attentionPriority,
      confidenceExplainability,
      isSmallDollar,
    });

    const summary = buildLeadershipReadinessSummaryParagraph({
      readinessStatus,
      visibilityTier,
      confidence,
      leadershipSignalCount: leadershipSignals.length,
      operatorSignalCount: operatorSignals.length,
      isSmallDollar,
    });

    void liabilities;
    void exposure;

    return {
      readinessStatus,
      visibilityTier,
      leadershipSignals,
      operatorSignals,
      reasoning,
      confidence,
      summary,
    };
  } catch (err) {
    warn({ op: "buildTreasuryLeadershipReadiness", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_LEADERSHIP_READINESS };
  }
}

export function formatTreasuryLeadershipReadinessChipLabel(result) {
  const status = String(result?.readinessStatus || "monitoring_visibility").toLowerCase();
  const labels = {
    operator_level: "Treasury leadership: Operator level",
    monitoring_visibility: "Treasury leadership: Monitoring visibility",
    leadership_visibility: "Treasury leadership: Leadership visibility",
    executive_attention: "Treasury leadership: Executive attention",
  };
  return labels[status] || labels.monitoring_visibility;
}

const EMPTY_TREASURY_META_REASONING = Object.freeze({
  trustStatus: "soft_uncertainty",
  confidenceDrivers: [
    "Treasury meta-reasoning synthesis is not yet available — continue routine advisory observation.",
  ],
  uncertaintyDrivers: [
    "Upstream advisory layers have not fully stabilized for trust synthesis.",
  ],
  evidenceSignals: [],
  reasoningStrength: "Advisory guidance offered with intentionally softened certainty",
  confidence: 0,
  summary:
    "Treasury meta-reasoning unavailable — advisory trust synthesis only. No outputs overridden, automated, or executed.",
  recommendations: [
    "Continue routine treasury observation until advisory layers stabilize.",
    "Treat all treasury guidance as advisory — human judgment remains primary.",
  ],
});

const TRUST_STATUS_REASONING_STRENGTH = Object.freeze({
  high_alignment: "Well supported by aligned operational and monitoring signals",
  moderate_alignment: "Moderately supported by largely consistent advisory layers",
  mixed_confidence: "Supported with notable mixed signals requiring human judgment",
  soft_uncertainty: "Advisory guidance offered with intentionally softened certainty",
});

const FORBIDDEN_META_REASONING_PHRASES = Object.freeze([
  "unreliable",
  "broken",
  "treasury confidence is weak",
  "confidence is weak",
  "do not trust",
  "cannot trust",
  "urgent",
  "emergency",
  "critical",
  ...FORBIDDEN_LEADERSHIP_READINESS_PHRASES,
]);

function isForbiddenMetaReasoningText(text) {
  const lower = String(text || "").toLowerCase();
  return FORBIDDEN_META_REASONING_PHRASES.some((phrase) => lower.includes(phrase));
}

function sanitizeMetaReasoningText(text, isSmallDollar) {
  const t = String(text || "").trim();
  if (!t || isForbiddenMetaReasoningText(t)) return "";
  return isSmallDollar ? softenText(t, true) : t;
}

function hasAttentionTimelineMemoryConflict({
  attentionPriority,
  operatorTimeline,
  institutionalMemory,
  treasuryRiskNarrative,
}) {
  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "").toLowerCase();
  const priorityStatus = String(attentionPriority?.priorityStatus || "").toLowerCase();
  const timelineStatus = String(operatorTimeline?.timelineStatus || "").toLowerCase();
  const narrativeStatus = String(treasuryRiskNarrative?.treasuryNarrativeStatus || "").toLowerCase();

  const elevatedAttention =
    priorityStatus === "elevated_attention" || priorityStatus === "leadership_visibility";
  const calmMemory = memoryStatus === "stable_pattern" || memoryStatus === "monitoring_patterns";
  const urgentTimeline =
    timelineStatus === "daily_review" || timelineStatus === "immediate_visibility";
  const calmTimeline = timelineStatus === "weekly_review" || timelineStatus === "every_few_days";
  const calmNarrative = narrativeStatus === "calm" || narrativeStatus === "monitoring";

  if (elevatedAttention && calmMemory) return true;
  if (urgentTimeline && memoryStatus === "minimal_history") return true;
  if (calmTimeline && elevatedAttention) return true;
  if (elevatedAttention && calmNarrative && memoryStatus === "stable_pattern") return true;
  return false;
}

function deriveTreasuryTrustStatus({
  operationalCoherence,
  consistencyCheck,
  confidenceExplainability,
  institutionalMemory,
  leadershipReadiness,
  adaptiveReviewCadence,
  attentionPriority,
  operatorTimeline,
  treasuryRiskNarrative,
  isSmallDollar,
}) {
  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "monitoring").toLowerCase();
  const consistencyStatus = String(consistencyCheck?.consistencyStatus || "aligned").toLowerCase();
  const confidenceLevel = String(confidenceExplainability?.confidenceLevel || "low").toLowerCase();
  const confidenceScore = toFiniteNumber(confidenceExplainability?.confidenceScore);
  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "minimal_history").toLowerCase();
  const readinessStatus = String(leadershipReadiness?.readinessStatus || "monitoring_visibility").toLowerCase();
  const softeningCount = (confidenceExplainability?.softeningFactors || []).length;
  const attentionMemoryConflict = hasAttentionTimelineMemoryConflict({
    attentionPriority,
    operatorTimeline,
    institutionalMemory,
    treasuryRiskNarrative,
  });

  const softUncertainty =
    memoryStatus === "minimal_history" ||
    (isSmallDollar && softeningCount >= 2) ||
    confidenceLevel === "low" ||
    consistencyStatus === "contradictory" ||
    softeningCount >= 3;

  const mixedConfidence =
    consistencyStatus === "mixed_signals" ||
    coherenceStatus === "mild_conflict" ||
    attentionMemoryConflict ||
    readinessStatus === "executive_attention";

  const highAlignment =
    coherenceStatus === "aligned" &&
    (consistencyStatus === "aligned" || consistencyStatus === "minor_conflicts") &&
    (confidenceLevel === "high" || (confidenceLevel === "moderate" && confidenceScore >= 55)) &&
    memoryStatus === "stable_pattern" &&
    !attentionMemoryConflict &&
    softeningCount <= 1;

  if (softUncertainty && !highAlignment) return "soft_uncertainty";
  if (mixedConfidence) return "mixed_confidence";
  if (highAlignment) return "high_alignment";
  return "moderate_alignment";
}

function collectMetaReasoningConfidenceDrivers({
  confidenceExplainability,
  operationalCoherence,
  institutionalMemory,
  attentionPriority,
  operatorTimeline,
  consistencyCheck,
  leadershipReadiness,
  isSmallDollar,
}) {
  const drivers = [];
  const supporting = confidenceExplainability?.supportingSignals || [];
  for (const signal of supporting.slice(0, 3)) {
    const sanitized = sanitizeMetaReasoningText(signal, isSmallDollar);
    if (sanitized) drivers.push(sanitized);
  }

  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "").toLowerCase();
  if (coherenceStatus === "aligned") {
    drivers.push("Treasury guidance appears supported by aligned monitoring signals.");
  }
  for (const signal of (operationalCoherence?.alignedSignals || []).slice(0, 2)) {
    const sanitized = sanitizeMetaReasoningText(signal, isSmallDollar);
    if (sanitized) drivers.push(sanitized);
  }

  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "").toLowerCase();
  if (memoryStatus === "stable_pattern") {
    drivers.push("Confidence increased due to repeated stable treasury posture in institutional memory.");
  } else if (memoryStatus === "monitoring_patterns") {
    drivers.push("Institutional memory shows emerging monitoring patterns that support current guidance.");
  }

  for (const signal of (consistencyCheck?.alignedSignals || []).slice(0, 2)) {
    const sanitized = sanitizeMetaReasoningText(signal, isSmallDollar);
    if (sanitized) drivers.push(sanitized);
  }

  const readinessStatus = String(leadershipReadiness?.readinessStatus || "").toLowerCase();
  if (readinessStatus === "operator_level" && coherenceStatus === "aligned") {
    drivers.push("Operator-level leadership readiness aligns with coherent advisory layers.");
  }

  const priorityStatus = String(attentionPriority?.priorityStatus || "").toLowerCase();
  const timelineStatus = String(operatorTimeline?.timelineStatus || "").toLowerCase();
  if (
    (priorityStatus === "stable" || priorityStatus === "monitoring") &&
    (timelineStatus === "weekly_review" || timelineStatus === "every_few_days")
  ) {
    drivers.push("Attention priority and operator timeline suggest consistent observational posture.");
  }

  if (drivers.length === 0) {
    drivers.push("Treasury guidance draws on routine advisory monitoring signals.");
  }

  return uniqueStrings(drivers).slice(0, 6);
}

function collectMetaReasoningUncertaintyDrivers({
  confidenceExplainability,
  operationalCoherence,
  institutionalMemory,
  consistencyCheck,
  leadershipReadiness,
  adaptiveReviewCadence,
  isSmallDollar,
}) {
  const drivers = [];
  for (const factor of (confidenceExplainability?.softeningFactors || []).slice(0, 3)) {
    const sanitized = sanitizeMetaReasoningText(factor, isSmallDollar);
    if (sanitized) drivers.push(sanitized);
  }

  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "").toLowerCase();
  if (memoryStatus === "minimal_history") {
    drivers.push("Confidence reduced due to limited historical treasury patterns.");
  }

  for (const contradiction of (operationalCoherence?.contradictions || []).slice(0, 2)) {
    const sanitized = sanitizeMetaReasoningText(contradiction, isSmallDollar);
    if (sanitized) drivers.push(sanitized);
  }

  for (const signal of (consistencyCheck?.contradictionSignals || []).slice(0, 2)) {
    const sanitized = sanitizeMetaReasoningText(signal, isSmallDollar);
    if (sanitized) drivers.push(sanitized);
  }

  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "").toLowerCase();
  if (coherenceStatus === "leadership_review") {
    drivers.push("Operational coherence suggests leadership review context — interpret guidance with additional human judgment.");
  } else if (coherenceStatus === "mild_conflict") {
    drivers.push("Mild coherence conflicts across advisory layers warrant cautious interpretation.");
  }

  const consistencyStatus = String(consistencyCheck?.consistencyStatus || "").toLowerCase();
  if (consistencyStatus === "mixed_signals") {
    drivers.push("Mixed consistency signals across treasury layers suggest tempered trust in any single conclusion.");
  } else if (consistencyStatus === "minor_conflicts") {
    drivers.push("Minor consistency conflicts present — guidance remains advisory with nuance.");
  }

  const readinessStatus = String(leadershipReadiness?.readinessStatus || "").toLowerCase();
  if (readinessStatus === "executive_attention") {
    drivers.push("Executive attention readiness introduces visibility complexity — not a trust override.");
  }

  const cadenceStatus = String(adaptiveReviewCadence?.cadenceStatus || "").toLowerCase();
  if (cadenceStatus === "leadership_visibility" || cadenceStatus === "elevated_attention") {
    drivers.push("Elevated review cadence posture suggests closer human review of advisory outputs.");
  }

  if (isSmallDollar) {
    drivers.push("Soft-launch environment intentionally softens meta-reasoning certainty.");
  }

  return uniqueStrings(drivers).slice(0, 6);
}

function collectMetaReasoningEvidenceSignals({
  confidenceExplainability,
  operationalCoherence,
  consistencyCheck,
  institutionalMemory,
  attentionPriority,
  operatorTimeline,
  treasuryRiskNarrative,
  adaptiveReviewCadence,
  isSmallDollar,
}) {
  const evidence = [];

  const confLevel = String(confidenceExplainability?.confidenceLevel || "").toLowerCase();
  const confScore = toFiniteNumber(confidenceExplainability?.confidenceScore);
  if (confLevel) {
    evidence.push(
      sanitizeMetaReasoningText(
        `Explainability confidence: ${confLevel}${confScore ? ` (${Math.round(confScore)}/100)` : ""}.`,
        isSmallDollar,
      ),
    );
  }

  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "").toLowerCase();
  if (coherenceStatus) {
    evidence.push(
      sanitizeMetaReasoningText(
        `Operational coherence status: ${coherenceStatus.replace(/_/g, " ")}.`,
        isSmallDollar,
      ),
    );
  }

  const consistencyStatus = String(consistencyCheck?.consistencyStatus || "").toLowerCase();
  if (consistencyStatus) {
    evidence.push(
      sanitizeMetaReasoningText(
        `Cross-layer consistency: ${consistencyStatus.replace(/_/g, " ")}.`,
        isSmallDollar,
      ),
    );
  }

  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "").toLowerCase();
  if (memoryStatus) {
    evidence.push(
      sanitizeMetaReasoningText(
        `Institutional memory posture: ${memoryStatus.replace(/_/g, " ")}.`,
        isSmallDollar,
      ),
    );
  }

  const priorityStatus = String(attentionPriority?.priorityStatus || "").toLowerCase();
  if (priorityStatus) {
    evidence.push(
      sanitizeMetaReasoningText(
        `Attention priority: ${priorityStatus.replace(/_/g, " ")}.`,
        isSmallDollar,
      ),
    );
  }

  const timelineStatus = String(operatorTimeline?.timelineStatus || "").toLowerCase();
  if (timelineStatus) {
    evidence.push(
      sanitizeMetaReasoningText(
        `Operator timeline cadence: ${timelineStatus.replace(/_/g, " ")}.`,
        isSmallDollar,
      ),
    );
  }

  const narrativeStatus = String(treasuryRiskNarrative?.treasuryNarrativeStatus || "").toLowerCase();
  if (narrativeStatus) {
    evidence.push(
      sanitizeMetaReasoningText(
        `Risk narrative posture: ${narrativeStatus.replace(/_/g, " ")}.`,
        isSmallDollar,
      ),
    );
  }

  const recommendedCadence = String(adaptiveReviewCadence?.recommendedCadence || "").toLowerCase();
  if (recommendedCadence) {
    evidence.push(
      sanitizeMetaReasoningText(
        `Recommended review cadence: ${recommendedCadence.replace(/_/g, " ")}.`,
        isSmallDollar,
      ),
    );
  }

  for (const signal of (consistencyCheck?.alignedSignals || []).slice(0, 2)) {
    const sanitized = sanitizeMetaReasoningText(signal, isSmallDollar);
    if (sanitized) evidence.push(sanitized);
  }

  return uniqueStrings(evidence.filter(Boolean)).slice(0, 6);
}

function buildMetaReasoningRecommendations({
  trustStatus,
  operationalCoherence,
  consistencyCheck,
  leadershipReadiness,
  institutionalMemory,
  isSmallDollar,
}) {
  const recommendations = [
    "Treat all treasury meta-reasoning as advisory interpretation — no outputs are overridden or executed.",
    "Weight operational coherence reconciliation suggestions when interpreting mixed signals.",
    "Treat leadership readiness as visibility preparation, not automatic escalation.",
  ];

  const consistencyStatus = String(consistencyCheck?.consistencyStatus || "").toLowerCase();
  if (consistencyStatus === "mixed_signals" || consistencyStatus === "contradictory") {
    recommendations.push(
      "When consistency is mixed, compare individual layer summaries rather than relying on a single headline.",
    );
  }

  for (const suggestion of (consistencyCheck?.reconciliationSuggestions || []).slice(0, 1)) {
    const sanitized = sanitizeMetaReasoningText(suggestion, isSmallDollar);
    if (sanitized) recommendations.push(sanitized);
  }

  for (const rec of (operationalCoherence?.recommendations || []).slice(0, 1)) {
    const sanitized = sanitizeMetaReasoningText(rec, isSmallDollar);
    if (sanitized) recommendations.push(sanitized);
  }

  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "").toLowerCase();
  if (memoryStatus === "minimal_history") {
    recommendations.push(
      "With limited institutional memory, favor recent operational signals and human context over historical pattern matching.",
    );
  }

  const readinessStatus = String(leadershipReadiness?.readinessStatus || "").toLowerCase();
  if (readinessStatus === "executive_attention" || readinessStatus === "leadership_visibility") {
    recommendations.push(
      "Leadership visibility tiers describe informational posture — they do not trigger notifications or actions.",
    );
  }

  if (trustStatus === "soft_uncertainty") {
    recommendations.push(
      "Soft uncertainty is intentional at current materiality levels — maintain calm observational review.",
    );
  }

  return uniqueStrings(recommendations).slice(0, 5);
}

function deriveMetaReasoningConfidence({
  confidenceExplainability,
  operationalCoherence,
  adaptiveReviewCadence,
  leadershipReadiness,
  isSmallDollar,
}) {
  const explainScore = toFiniteNumber(confidenceExplainability?.confidenceScore);
  const coherenceConf = toFiniteNumber(operationalCoherence?.confidence);
  const cadenceConf = toFiniteNumber(adaptiveReviewCadence?.confidence);
  const readinessConf = toFiniteNumber(leadershipReadiness?.confidence);

  const weights = [0.35, 0.25, 0.2, 0.2];
  const values = [explainScore, coherenceConf, cadenceConf, readinessConf];
  let blended = 0;
  let weightSum = 0;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] > 0) {
      blended += values[i] * weights[i];
      weightSum += weights[i];
    }
  }
  let confidence = weightSum > 0 ? Math.round(blended / weightSum) : 0;
  confidence = clamp(confidence, 0, 99);
  if (isSmallDollar) confidence = Math.min(confidence, 82);
  return confidence;
}

function buildMetaReasoningSummary({
  trustStatus,
  reasoningStrength,
  confidence,
  confidenceDrivers,
  uncertaintyDrivers,
  isSmallDollar,
}) {
  const statusPhrase = String(trustStatus || "soft_uncertainty").replace(/_/g, " ");
  const driverHint =
    confidenceDrivers.length > 0 ? confidenceDrivers[0].replace(/\.$/, "") : "routine advisory signals";
  const uncertaintyHint =
    uncertaintyDrivers.length > 0
      ? uncertaintyDrivers[0].replace(/\.$/, "")
      : "no major uncertainty factors identified";

  let base = `Treasury meta-reasoning trust posture: ${statusPhrase} (${confidence}/100). ${reasoningStrength}. Primary support: ${driverHint}. Consider: ${uncertaintyHint}. Advisory meta-reasoning only — no outputs overridden, automated, or executed.`;
  if (isSmallDollar) {
    base = softenText(base, true);
  }
  return base.trim();
}

/**
 * Pure advisory synthesis — treasury meta-reasoning trust across Phase 3 advisory layers (Phase 3U).
 * READ-ONLY: explains why Treasury believes/trusts its guidance — no overrides, automation, or execution.
 * @param {object} args
 */
export function buildTreasuryMetaReasoning({
  confidenceExplainability = {},
  operationalCoherence = {},
  leadershipReadiness = {},
  adaptiveReviewCadence = {},
  decisionSupport = {},
  institutionalMemory = {},
  treasuryRiskNarrative = {},
  attentionPriority = {},
  consistencyCheck = {},
  operatorTimeline = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });

    const trustStatus = deriveTreasuryTrustStatus({
      operationalCoherence,
      consistencyCheck,
      confidenceExplainability,
      institutionalMemory,
      leadershipReadiness,
      adaptiveReviewCadence,
      attentionPriority,
      operatorTimeline,
      treasuryRiskNarrative,
      isSmallDollar,
    });

    const reasoningStrength =
      TRUST_STATUS_REASONING_STRENGTH[trustStatus] ||
      TRUST_STATUS_REASONING_STRENGTH.soft_uncertainty;

    const confidenceDrivers = collectMetaReasoningConfidenceDrivers({
      confidenceExplainability,
      operationalCoherence,
      institutionalMemory,
      attentionPriority,
      operatorTimeline,
      consistencyCheck,
      leadershipReadiness,
      isSmallDollar,
    });

    const uncertaintyDrivers = collectMetaReasoningUncertaintyDrivers({
      confidenceExplainability,
      operationalCoherence,
      institutionalMemory,
      consistencyCheck,
      leadershipReadiness,
      adaptiveReviewCadence,
      isSmallDollar,
    });

    const evidenceSignals = collectMetaReasoningEvidenceSignals({
      confidenceExplainability,
      operationalCoherence,
      consistencyCheck,
      institutionalMemory,
      attentionPriority,
      operatorTimeline,
      treasuryRiskNarrative,
      adaptiveReviewCadence,
      isSmallDollar,
    });

    const recommendations = buildMetaReasoningRecommendations({
      trustStatus,
      operationalCoherence,
      consistencyCheck,
      leadershipReadiness,
      institutionalMemory,
      isSmallDollar,
    });

    const confidence = deriveMetaReasoningConfidence({
      confidenceExplainability,
      operationalCoherence,
      adaptiveReviewCadence,
      leadershipReadiness,
      isSmallDollar,
    });

    const summary = buildMetaReasoningSummary({
      trustStatus,
      reasoningStrength,
      confidence,
      confidenceDrivers,
      uncertaintyDrivers,
      isSmallDollar,
    });

    void decisionSupport;
    void liabilities;
    void exposure;

    return {
      trustStatus,
      confidenceDrivers,
      uncertaintyDrivers,
      evidenceSignals,
      reasoningStrength,
      confidence,
      summary,
      recommendations,
    };
  } catch (err) {
    warn({ op: "buildTreasuryMetaReasoning", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_META_REASONING };
  }
}

export function formatTreasuryMetaReasoningChipLabel(result) {
  const status = String(result?.trustStatus || "soft_uncertainty").toLowerCase();
  const labels = {
    high_alignment: "Treasury trust: High alignment",
    moderate_alignment: "Treasury trust: Moderate alignment",
    mixed_confidence: "Treasury trust: Mixed confidence",
    soft_uncertainty: "Treasury trust: Soft uncertainty",
  };
  return labels[status] || labels.soft_uncertainty;
}

const EMPTY_TREASURY_DECISION_TRACE = Object.freeze({
  traceStatus: "fragmented_trace",
  confidence: 0,
  traceSteps: [],
  traceSummary:
    "Treasury decision trace unavailable — advisory reasoning chain synthesis only. No outputs overridden, automated, or executed.",
  operatorNarrative:
    "Treasury decision trace is not yet available. Continue routine advisory observation until upstream layers stabilize.",
  recommendations: [
    "Continue routine treasury observation until advisory layers stabilize.",
    "Treat all treasury guidance as advisory — human judgment remains primary.",
  ],
});

const TRACE_STATUS_RANK = Object.freeze({
  fragmented_trace: 0,
  partially_traceable: 1,
  mostly_traceable: 2,
  fully_traceable: 3,
});

const TRUST_ALIGNMENT_RANK = Object.freeze({
  soft_uncertainty: 0,
  mixed_confidence: 1,
  moderate_alignment: 2,
  high_alignment: 3,
});

function humanizeTraceToken(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .trim();
}

function isMeaningfulTraceInput(key, value) {
  if (!value || typeof value !== "object") return false;
  switch (key) {
    case "monitoringIntelligence":
      return (
        String(value.operatingState || "normal_monitoring").toLowerCase() !== "normal_monitoring" ||
        String(value.treasuryAttentionLevel || "low").toLowerCase() !== "low" ||
        (value.treasuryMonitoringSignals || []).length > 0 ||
        (value.treasuryWatchFlags || []).length > 0
      );
    case "alertReadiness":
      return String(value.alertReadinessStatus || "quiet").toLowerCase() !== "quiet";
    case "treasuryAdminAlerts":
      return (value.treasuryAdminAlerts || []).length > 0 || String(value.alertPosture || "quiet").toLowerCase() !== "quiet";
    case "digestIntelligence":
      return String(value.digestReadiness || "quiet").toLowerCase() !== "quiet";
    case "executiveEscalation":
      return (
        String(value.executiveAttentionStatus || "observe").toLowerCase() !== "observe" &&
        String(value.executiveAttentionStatus || "observe").toLowerCase() !== "quiet"
      );
    case "decisionSupport":
      return String(value.decisionSupportStatus || "monitoring").toLowerCase() !== "monitoring";
    case "institutionalMemory":
      return String(value.institutionalMemoryStatus || "minimal_history").toLowerCase() !== "minimal_history";
    case "confidenceExplainability":
      return (
        String(value.confidenceLevel || "low").toLowerCase() !== "low" ||
        toFiniteNumber(value.confidenceScore) >= 40
      );
    case "operationalCoherence":
      return String(value.coherenceStatus || "monitoring").toLowerCase() !== "monitoring";
    case "adaptiveReviewCadence":
      return (
        String(value.cadenceStatus || "monitoring").toLowerCase() !== "monitoring" ||
        String(value.recommendedCadence || "every_few_days").toLowerCase() !== "every_few_days"
      );
    case "leadershipReadiness":
      return String(value.readinessStatus || "monitoring_visibility").toLowerCase() !== "monitoring_visibility";
    case "metaReasoning":
      return String(value.trustStatus || "soft_uncertainty").toLowerCase() !== "soft_uncertainty";
    default:
      return false;
  }
}

function countPopulatedTraceInputs(inputs) {
  return Object.entries(inputs).filter(([key, value]) => isMeaningfulTraceInput(key, value)).length;
}

function countMissingTraceInputs(inputs) {
  const keys = [
    "monitoringIntelligence",
    "alertReadiness",
    "treasuryAdminAlerts",
    "digestIntelligence",
    "executiveEscalation",
    "decisionSupport",
    "institutionalMemory",
    "confidenceExplainability",
    "operationalCoherence",
    "adaptiveReviewCadence",
    "leadershipReadiness",
    "metaReasoning",
  ];
  return keys.filter((key) => !isMeaningfulTraceInput(key, inputs[key])).length;
}

function buildDecisionTraceSteps({
  monitoringIntelligence,
  alertReadiness,
  treasuryAdminAlerts,
  digestIntelligence,
  executiveEscalation,
  decisionSupport,
  institutionalMemory,
  confidenceExplainability,
  operationalCoherence,
  adaptiveReviewCadence,
  leadershipReadiness,
  metaReasoning,
  isSmallDollar,
}) {
  /** @type {Array<{ step: string; source: string; effect: string; meaningful: boolean }>} */
  const raw = [];

  const operatingState = String(monitoringIntelligence?.operatingState || "normal_monitoring").toLowerCase();
  const attentionLevel = String(monitoringIntelligence?.treasuryAttentionLevel || "low").toLowerCase();
  const signalCount = (monitoringIntelligence?.treasuryMonitoringSignals || []).length;
  const watchCount = (monitoringIntelligence?.treasuryWatchFlags || []).length;

  raw.push({
    step: `Monitoring operating state ${humanizeTraceToken(operatingState)} with ${humanizeTraceToken(attentionLevel)} attention`,
    source: "monitoring intelligence",
    effect:
      attentionLevel === "high" || attentionLevel === "elevated"
        ? "attention priority elevated for downstream alert assessment"
        : "routine attention baseline established for alert readiness",
    meaningful: isMeaningfulTraceInput("monitoringIntelligence", monitoringIntelligence),
  });

  if (signalCount > 0) {
    raw.push({
      step: `${signalCount} monitoring signal${signalCount === 1 ? "" : "s"} synthesized from command and drift inputs`,
      source: "monitoring intelligence",
      effect: "feeds alert readiness and watch-flag assessment",
      meaningful: true,
    });
  }

  if (watchCount > 0) {
    raw.push({
      step: `${watchCount} operational watch flag${watchCount === 1 ? "" : "s"} under active observation`,
      source: "monitoring intelligence",
      effect: "informs alert-worthy signal collection",
      meaningful: true,
    });
  }

  const alertStatus = String(alertReadiness?.alertReadinessStatus || "quiet").toLowerCase();
  raw.push({
    step: `Alert readiness assessed as ${humanizeTraceToken(alertStatus)}`,
    source: "alert readiness",
    effect: "shapes admin alert generation and notification posture",
    meaningful: isMeaningfulTraceInput("alertReadiness", alertReadiness),
  });

  const alertCount = (treasuryAdminAlerts?.treasuryAdminAlerts || []).length;
  const alertPosture = String(treasuryAdminAlerts?.alertPosture || "quiet").toLowerCase();
  raw.push({
    step:
      alertCount > 0
        ? `${alertCount} admin attention item${alertCount === 1 ? "" : "s"} synthesized (${humanizeTraceToken(alertPosture)} posture)`
        : `Admin alert layer remains ${humanizeTraceToken(alertPosture)} — no material attention items`,
    source: "admin alerts",
    effect: "defines in-app advisory visibility for operators",
    meaningful: isMeaningfulTraceInput("treasuryAdminAlerts", treasuryAdminAlerts),
  });

  const digestReadiness = String(digestIntelligence?.digestReadiness || "quiet").toLowerCase();
  raw.push({
    step: `Digest readiness at ${humanizeTraceToken(digestReadiness)} following alert readiness posture`,
    source: "digest intelligence",
    effect: "informs notification and digest cadence recommendations",
    meaningful: isMeaningfulTraceInput("digestIntelligence", digestIntelligence),
  });

  const execStatus = String(executiveEscalation?.executiveAttentionStatus || "observe").toLowerCase();
  const escalationPriority = String(executiveEscalation?.escalationPriority || "low").toLowerCase();
  raw.push({
    step: `Executive escalation posture ${humanizeTraceToken(execStatus)} (${humanizeTraceToken(escalationPriority)} priority)`,
    source: "executive escalation",
    effect: "derived from briefing, command, and digest signals",
    meaningful: isMeaningfulTraceInput("executiveEscalation", executiveEscalation),
  });

  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "monitoring").toLowerCase();
  raw.push({
    step: `Decision support status ${humanizeTraceToken(decisionStatus)} informed by escalation and alert layers`,
    source: "decision support",
    effect: "frames advisory recommendations for operator review",
    meaningful: isMeaningfulTraceInput("decisionSupport", decisionSupport),
  });

  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "minimal_history").toLowerCase();
  raw.push({
    step: `Institutional memory ${humanizeTraceToken(memoryStatus)} informs confidence weighting`,
    source: "institutional memory",
    effect: "historical patterns shape explainability and trust synthesis",
    meaningful: isMeaningfulTraceInput("institutionalMemory", institutionalMemory),
  });

  const confidenceLevel = String(confidenceExplainability?.confidenceLevel || "low").toLowerCase();
  const confidenceScore = toFiniteNumber(confidenceExplainability?.confidenceScore);
  raw.push({
    step: `Confidence explainability at ${confidenceLevel} level (${confidenceScore}/100)`,
    source: "confidence explainability",
    effect: "clarifies advisory certainty across upstream layers",
    meaningful: isMeaningfulTraceInput("confidenceExplainability", confidenceExplainability),
  });

  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "monitoring").toLowerCase();
  raw.push({
    step: `Operational coherence ${humanizeTraceToken(coherenceStatus)} validates cross-layer alignment`,
    source: "operational coherence",
    effect: "surfaces contradictions and aligned signals for review",
    meaningful: isMeaningfulTraceInput("operationalCoherence", operationalCoherence),
  });

  const recommendedCadence = String(adaptiveReviewCadence?.recommendedCadence || "every_few_days").toLowerCase();
  const cadenceStatus = String(adaptiveReviewCadence?.cadenceStatus || "monitoring").toLowerCase();
  raw.push({
    step: `Adaptive review cadence recommends ${humanizeTraceToken(recommendedCadence)} (${humanizeTraceToken(cadenceStatus)} status)`,
    source: "adaptive review cadence",
    effect: "suggests operator review frequency based on coherence synthesis",
    meaningful: isMeaningfulTraceInput("adaptiveReviewCadence", adaptiveReviewCadence),
  });

  const readinessStatus = String(leadershipReadiness?.readinessStatus || "monitoring_visibility").toLowerCase();
  const visibilityTier = String(leadershipReadiness?.visibilityTier || "informational").toLowerCase();
  raw.push({
    step: `Leadership readiness at ${humanizeTraceToken(readinessStatus)} with ${humanizeTraceToken(visibilityTier)} visibility tier`,
    source: "leadership readiness",
    effect: "defines leadership visibility guidance without automated escalation",
    meaningful: isMeaningfulTraceInput("leadershipReadiness", leadershipReadiness),
  });

  const trustStatus = String(metaReasoning?.trustStatus || "soft_uncertainty").toLowerCase();
  raw.push({
    step: `Meta-reasoning trust status ${humanizeTraceToken(trustStatus)} synthesizes advisory chain`,
    source: "meta reasoning",
    effect: "final trust posture across all advisory layers — advisory only",
    meaningful: isMeaningfulTraceInput("metaReasoning", metaReasoning),
  });

  return raw.map(({ step, source, effect, meaningful }) => {
    const softenedStep = isSmallDollar ? softenText(step, true) : step;
    const softenedEffect = isSmallDollar ? softenText(effect, true) : effect;
    return {
      step: softenedStep,
      source,
      effect: softenedEffect,
      meaningful,
    };
  });
}

function deriveDecisionTraceStatus({
  meaningfulStepCount,
  trustStatus,
  coherenceStatus,
  memoryStatus,
  missingInputCount,
}) {
  const trustRank = TRUST_ALIGNMENT_RANK[String(trustStatus || "soft_uncertainty").toLowerCase()] ?? 0;
  const coherenceAligned =
    String(coherenceStatus || "monitoring").toLowerCase() === "aligned" ||
    String(coherenceStatus || "monitoring").toLowerCase() === "monitoring";
  const minimalHistory = String(memoryStatus || "minimal_history").toLowerCase() === "minimal_history";
  const softUncertainty = String(trustStatus || "soft_uncertainty").toLowerCase() === "soft_uncertainty";

  if (
    meaningfulStepCount >= 10 &&
    trustRank >= TRUST_ALIGNMENT_RANK.moderate_alignment &&
    coherenceAligned &&
    missingInputCount <= 3
  ) {
    return "fully_traceable";
  }
  if (meaningfulStepCount >= 7 && trustRank >= TRUST_ALIGNMENT_RANK.mixed_confidence) {
    return "mostly_traceable";
  }
  if (
    meaningfulStepCount >= 4 ||
    (meaningfulStepCount >= 3 && trustRank >= TRUST_ALIGNMENT_RANK.mixed_confidence)
  ) {
    return "partially_traceable";
  }
  if (meaningfulStepCount < 4 || (minimalHistory && softUncertainty && missingInputCount >= 6)) {
    return "fragmented_trace";
  }
  return "partially_traceable";
}

function deriveDecisionTraceConfidence({
  metaReasoning,
  meaningfulStepCount,
  traceStatus,
  isSmallDollar,
}) {
  const metaConf = toFiniteNumber(metaReasoning?.confidence);
  const statusRank = TRACE_STATUS_RANK[String(traceStatus || "fragmented_trace").toLowerCase()] ?? 0;
  const stepBonus = clamp(meaningfulStepCount * 2, 0, 24);

  let confidence = 0;
  if (metaConf > 0) {
    confidence = Math.round(metaConf * 0.55 + statusRank * 8 + stepBonus * 0.45);
  } else {
    confidence = Math.round(statusRank * 12 + stepBonus);
  }
  confidence = clamp(confidence, 0, 99);
  if (isSmallDollar) confidence = Math.min(confidence, 82);
  return confidence;
}

function buildDecisionTraceOperatorNarrative({
  monitoringIntelligence,
  alertReadiness,
  treasuryAdminAlerts,
  decisionSupport,
  operationalCoherence,
  adaptiveReviewCadence,
  leadershipReadiness,
  metaReasoning,
  isSmallDollar,
}) {
  const operatingState = humanizeTraceToken(monitoringIntelligence?.operatingState || "normal monitoring");
  const attentionLevel = humanizeTraceToken(monitoringIntelligence?.treasuryAttentionLevel || "low");
  const alertStatus = humanizeTraceToken(alertReadiness?.alertReadinessStatus || "quiet");
  const alertPosture = humanizeTraceToken(treasuryAdminAlerts?.alertPosture || "quiet");
  const decisionStatus = humanizeTraceToken(decisionSupport?.decisionSupportStatus || "monitoring");
  const coherenceStatus = humanizeTraceToken(operationalCoherence?.coherenceStatus || "monitoring");
  const cadence = humanizeTraceToken(adaptiveReviewCadence?.recommendedCadence || "every few days");
  const tier = humanizeTraceToken(leadershipReadiness?.visibilityTier || "informational");
  const trustStatus = humanizeTraceToken(metaReasoning?.trustStatus || "soft uncertainty");

  let narrative = `Treasury monitoring identified ${operatingState} with ${attentionLevel} attention, which informed alert readiness (${alertStatus}). This shaped admin attention items (${alertPosture} posture) and decision support (${decisionStatus}). Coherence review (${coherenceStatus}) and adaptive cadence (${cadence}) followed, with leadership readiness at ${tier} visibility. Meta-reasoning indicates ${trustStatus}. Advisory decision trace only — no outputs overridden or executed.`;

  if (isSmallDollar) {
    narrative = softenText(narrative, true);
  }
  return narrative;
}

function buildDecisionTraceSummaryParagraph({
  traceStatus,
  meaningfulStepCount,
  totalStepCount,
  confidence,
  isSmallDollar,
}) {
  const statusPhrase = humanizeTraceToken(traceStatus);
  let base = `Treasury decision trace is ${statusPhrase} with ${meaningfulStepCount} of ${totalStepCount} causal steps carrying meaningful advisory signal (${confidence}/100 trace confidence). The chain links monitoring through meta-reasoning without executing or overriding any treasury action. Use this trace to reconcile mixed signals before adjusting review cadence.`;
  if (isSmallDollar) {
    base = softenText(base, true);
  }
  return base.trim();
}

function buildDecisionTraceRecommendations({
  traceStatus,
  operationalCoherence,
  institutionalMemory,
  isSmallDollar,
}) {
  const recommendations = [
    "Use trace steps to reconcile mixed signals before changing review cadence.",
    "Treat downstream conclusions as advisory synthesis, not automated decisions.",
  ];

  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "monitoring").toLowerCase();
  if (coherenceStatus === "mild_conflict" || coherenceStatus === "leadership_review") {
    recommendations.push(
      "Review coherence contradictions alongside trace steps — human judgment remains primary.",
    );
  }

  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "minimal_history").toLowerCase();
  if (memoryStatus === "minimal_history") {
    recommendations.push(
      "Limited institutional history — interpret trace as directional guidance until events accumulate.",
    );
  }

  if (String(traceStatus || "").toLowerCase() === "fragmented_trace") {
    recommendations.push(
      "Fragmented trace — continue routine observation until more advisory layers populate.",
    );
  }

  return uniqueStrings(
    recommendations.map((item) => (isSmallDollar ? softenText(item, true) : item)),
  ).slice(0, 4);
}

/**
 * Pure advisory synthesis — treasury decision trace across Phase 3 advisory layers (Phase 3V).
 * READ-ONLY: explains reasoning chains only — no overrides, automation, or execution.
 * @param {object} args
 */
export function buildTreasuryDecisionTrace({
  monitoringIntelligence = {},
  alertReadiness = {},
  treasuryAdminAlerts = {},
  digestIntelligence = {},
  executiveEscalation = {},
  decisionSupport = {},
  institutionalMemory = {},
  confidenceExplainability = {},
  operationalCoherence = {},
  adaptiveReviewCadence = {},
  leadershipReadiness = {},
  metaReasoning = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });

    const traceStepsRaw = buildDecisionTraceSteps({
      monitoringIntelligence,
      alertReadiness,
      treasuryAdminAlerts,
      digestIntelligence,
      executiveEscalation,
      decisionSupport,
      institutionalMemory,
      confidenceExplainability,
      operationalCoherence,
      adaptiveReviewCadence,
      leadershipReadiness,
      metaReasoning,
      isSmallDollar,
    });

    const traceSteps = traceStepsRaw.map(({ step, source, effect }) => ({ step, source, effect }));
    const meaningfulStepCount = traceStepsRaw.filter((item) => item.meaningful).length;

    const inputMap = {
      monitoringIntelligence,
      alertReadiness,
      treasuryAdminAlerts,
      digestIntelligence,
      executiveEscalation,
      decisionSupport,
      institutionalMemory,
      confidenceExplainability,
      operationalCoherence,
      adaptiveReviewCadence,
      leadershipReadiness,
      metaReasoning,
    };
    const missingInputCount = countMissingTraceInputs(inputMap);

    const traceStatus = deriveDecisionTraceStatus({
      meaningfulStepCount,
      trustStatus: metaReasoning?.trustStatus,
      coherenceStatus: operationalCoherence?.coherenceStatus,
      memoryStatus: institutionalMemory?.institutionalMemoryStatus,
      missingInputCount,
    });

    const confidence = deriveDecisionTraceConfidence({
      metaReasoning,
      meaningfulStepCount,
      traceStatus,
      isSmallDollar,
    });

    const operatorNarrative = buildDecisionTraceOperatorNarrative({
      monitoringIntelligence,
      alertReadiness,
      treasuryAdminAlerts,
      decisionSupport,
      operationalCoherence,
      adaptiveReviewCadence,
      leadershipReadiness,
      metaReasoning,
      isSmallDollar,
    });

    const traceSummary = buildDecisionTraceSummaryParagraph({
      traceStatus,
      meaningfulStepCount,
      totalStepCount: traceSteps.length,
      confidence,
      isSmallDollar,
    });

    const recommendations = buildDecisionTraceRecommendations({
      traceStatus,
      operationalCoherence,
      institutionalMemory,
      isSmallDollar,
    });

    void countPopulatedTraceInputs(inputMap);
    void liabilities;
    void exposure;

    return {
      traceStatus,
      confidence,
      traceSteps,
      traceSummary,
      operatorNarrative,
      recommendations,
    };
  } catch (err) {
    warn({ op: "buildTreasuryDecisionTrace", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_DECISION_TRACE };
  }
}

export function formatTreasuryDecisionTraceChipLabel(result) {
  const status = String(result?.traceStatus || "fragmented_trace").toLowerCase();
  const labels = {
    fully_traceable: "Treasury trace: Fully traceable",
    mostly_traceable: "Treasury trace: Mostly traceable",
    partially_traceable: "Treasury trace: Partially traceable",
    fragmented_trace: "Treasury trace: Fragmented trace",
  };
  return labels[status] || labels.fragmented_trace;
}

const EMPTY_TREASURY_RECOMMENDATION_STABILITY = Object.freeze({
  stabilityStatus: "fragmented",
  continuityScore: 0,
  recommendationTrend: "diverging",
  oscillationRisk: "high",
  confidenceTrend: "stable",
  recommendationHistory: [
    "Current cycle: advisory stability synthesis unavailable — continue routine observation.",
  ],
  operatorSummary:
    "Treasury recommendation stability is not yet available. Continue calm advisory observation until operational events accumulate.",
  recommendations: [
    "Continue routine treasury observation until recommendation history stabilizes.",
    "Treat stability assessment as advisory — human judgment remains primary.",
  ],
});

const STABILITY_COHERENCE_RANK = Object.freeze({
  aligned: 0,
  monitoring: 1,
  mild_conflict: 2,
  leadership_review: 3,
});

const STABILITY_CONTRADICTION_STATUSES = new Set([
  "minor_conflicts",
  "mixed_signals",
  "contradictory",
]);

const STABILITY_OSCILLATION_FIELDS = Object.freeze([
  { key: "treasuryAttentionLevel", rank: ATTENTION_RANK },
  { key: "cadenceStatus", rank: CADENCE_STATUS_RANK },
  { key: "coherenceStatus", rank: STABILITY_COHERENCE_RANK },
  { key: "decisionSupportStatus", rank: DECISION_SUPPORT_RANK },
  { key: "priorityStatus", rank: SCENARIO_TIER_ORDER },
  { key: "readinessStatus", rank: LEADERSHIP_READINESS_STATUS_RANK },
]);

function extractStabilitySnapshotFromEvent(evt) {
  const meta = evt?.metadata && typeof evt.metadata === "object" ? evt.metadata : {};
  return {
    createdAt: evt?.createdAt || null,
    decisionSupportStatus: String(meta.decisionSupportStatus || "").toLowerCase(),
    coherenceStatus: String(meta.coherenceStatus || "").toLowerCase(),
    priorityStatus: String(meta.priorityStatus || "").toLowerCase(),
    readinessStatus: String(meta.readinessStatus || "").toLowerCase(),
    recommendedCadence: String(meta.recommendedCadence || "").toLowerCase(),
    trustStatus: String(meta.trustStatus || "").toLowerCase(),
    cadenceStatus: String(meta.cadenceStatus || "").toLowerCase(),
    traceStatus: String(meta.traceStatus || "").toLowerCase(),
    confidenceScore: Number(meta.confidenceScore),
    treasuryAttentionLevel: String(meta.treasuryAttentionLevel || "").toLowerCase(),
    operatingState: String(meta.operatingState || "").toLowerCase(),
    consistencyStatus: String(meta.consistencyStatus || "").toLowerCase(),
  };
}

function buildStabilityTimeSeries(events = [], limit = 30) {
  return (events || [])
    .map(normalizeOperationalEvent)
    .filter(Boolean)
    .slice(0, limit)
    .map(extractStabilitySnapshotFromEvent);
}

function buildCurrentStabilitySnapshot({
  decisionSupport,
  attentionPriority,
  operationalCoherence,
  leadershipReadiness,
  adaptiveReviewCadence,
  metaReasoning,
  decisionTrace,
  confidenceExplainability,
  monitoringAttentionLevel,
  monitoringOperatingState,
}) {
  return {
    createdAt: new Date().toISOString(),
    decisionSupportStatus: String(decisionSupport?.decisionSupportStatus || "").toLowerCase(),
    coherenceStatus: String(operationalCoherence?.coherenceStatus || "").toLowerCase(),
    priorityStatus: String(attentionPriority?.priorityStatus || "").toLowerCase(),
    readinessStatus: String(leadershipReadiness?.readinessStatus || "").toLowerCase(),
    recommendedCadence: String(adaptiveReviewCadence?.recommendedCadence || "").toLowerCase(),
    trustStatus: String(metaReasoning?.trustStatus || "").toLowerCase(),
    cadenceStatus: String(adaptiveReviewCadence?.cadenceStatus || "").toLowerCase(),
    traceStatus: String(decisionTrace?.traceStatus || "").toLowerCase(),
    confidenceScore: Number(confidenceExplainability?.confidenceScore),
    treasuryAttentionLevel: String(monitoringAttentionLevel || "").toLowerCase(),
    operatingState: String(monitoringOperatingState || "").toLowerCase(),
    consistencyStatus: "",
    isCurrent: true,
  };
}

function compositeStabilityTierRank(snapshot = {}) {
  const attention = layerStatusRank(ATTENTION_RANK, snapshot.treasuryAttentionLevel);
  const decision = layerStatusRank(DECISION_SUPPORT_RANK, snapshot.decisionSupportStatus);
  const coherence = layerStatusRank(STABILITY_COHERENCE_RANK, snapshot.coherenceStatus);
  return Math.max(attention, decision, coherence);
}

function countCompositeTierReversals(series = []) {
  if (series.length < 3) return 0;
  let reversals = 0;
  for (let i = 1; i < series.length - 1; i += 1) {
    const prev = compositeStabilityTierRank(series[i + 1]);
    const curr = compositeStabilityTierRank(series[i]);
    const next = compositeStabilityTierRank(series[i - 1]);
    if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
      reversals += 1;
    }
  }
  return reversals;
}

function countFieldReversals(series = [], fieldKey, rankMap) {
  if (series.length < 3) return 0;
  let reversals = 0;
  for (let i = 1; i < series.length - 1; i += 1) {
    const prev = layerStatusRank(rankMap, series[i + 1][fieldKey]);
    const curr = layerStatusRank(rankMap, series[i][fieldKey]);
    const next = layerStatusRank(rankMap, series[i - 1][fieldKey]);
    if (!series[i][fieldKey] || !series[i + 1][fieldKey] || !series[i - 1][fieldKey]) continue;
    if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
      reversals += 1;
    }
  }
  return reversals;
}

function countOscillationReversals(series = []) {
  let total = 0;
  for (const field of STABILITY_OSCILLATION_FIELDS) {
    total += countFieldReversals(series, field.key, field.rank);
  }
  return total;
}

function countContradictionEvents(series = []) {
  return series.filter((snap) => STABILITY_CONTRADICTION_STATUSES.has(snap.consistencyStatus)).length;
}

function deriveOscillationRiskLevel(reversalCount) {
  if (reversalCount <= 1) return "low";
  if (reversalCount === 2) return "moderate";
  if (reversalCount === 3) return "elevated";
  return "high";
}

function deriveConfidenceTrendFromSeries(series = []) {
  const scores = series
    .map((snap) => Number(snap.confidenceScore))
    .filter((n) => Number.isFinite(n));
  if (scores.length < 2) return "stable";
  const recent = scores.slice(0, Math.min(5, scores.length));
  const older = scores.slice(Math.min(5, scores.length));
  const recentAvg = recent.reduce((sum, n) => sum + n, 0) / recent.length;
  const olderAvg =
    older.length > 0 ? older.reduce((sum, n) => sum + n, 0) / older.length : recentAvg;
  const delta = recentAvg - olderAvg;
  if (delta >= 6) return "strengthening";
  if (delta <= -6) return "weakening";
  return "stable";
}

function computeTierVariance(series = []) {
  const ranks = series.map((snap) => compositeStabilityTierRank(snap));
  if (ranks.length < 2) return 0;
  const mean = ranks.reduce((sum, n) => sum + n, 0) / ranks.length;
  return ranks.reduce((sum, n) => sum + (n - mean) ** 2, 0) / ranks.length;
}

function dominantStatusKey(series = [], fieldKey) {
  const counts = new Map();
  for (const snap of series) {
    const key = String(snap[fieldKey] || "").toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = "";
  let bestCount = 0;
  for (const [key, count] of counts.entries()) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return { key: best, count: bestCount };
}

function isCoherenceImproving(series = []) {
  if (series.length < 4) return false;
  const half = Math.floor(series.length / 2);
  const recent = series.slice(0, half);
  const older = series.slice(half);
  const recentAvg =
    recent.reduce((sum, snap) => sum + layerStatusRank(STABILITY_COHERENCE_RANK, snap.coherenceStatus), 0) /
    Math.max(recent.length, 1);
  const olderAvg =
    older.reduce((sum, snap) => sum + layerStatusRank(STABILITY_COHERENCE_RANK, snap.coherenceStatus), 0) /
    Math.max(older.length, 1);
  return recentAvg < olderAvg;
}

function isGradualTierDrift(series = []) {
  if (series.length < 4) return false;
  const ranks = [...series].reverse().map((snap) => compositeStabilityTierRank(snap));
  let up = 0;
  let down = 0;
  for (let i = 1; i < ranks.length; i += 1) {
    if (ranks[i] > ranks[i - 1]) up += 1;
    else if (ranks[i] < ranks[i - 1]) down += 1;
  }
  const dominant = up >= down ? up : down;
  return dominant >= Math.max(2, ranks.length - 2) && up + down >= 2;
}

function deriveRecommendationTrend({
  series,
  oscillationReversals,
  contradictionCount,
}) {
  const recent = series.slice(0, Math.min(6, series.length));
  const older = series.slice(Math.min(6, series.length));
  const recentVariance = computeTierVariance(recent);
  const olderVariance = older.length > 0 ? computeTierVariance(older) : recentVariance;
  const dominant = dominantStatusKey(recent, "decisionSupportStatus");

  if (oscillationReversals >= 3 || contradictionCount >= 3) {
    return "diverging";
  }

  if (dominant.count >= 3 && dominant.key) {
    return "steady";
  }

  if (recentVariance < olderVariance - 0.25 && isCoherenceImproving(series)) {
    return "converging";
  }

  if (isGradualTierDrift(series)) {
    return "shifting";
  }

  if (oscillationReversals >= 2) {
    return "diverging";
  }

  if (dominant.count >= 2) {
    return "steady";
  }

  return "shifting";
}

function deriveStabilityStatusKey({
  continuityScore,
  recommendationTrend,
  oscillationRisk,
  eventCount,
}) {
  if (
    continuityScore < 30 ||
    (recommendationTrend === "diverging" && oscillationRisk === "high") ||
    (eventCount < 3 && continuityScore < 45)
  ) {
    return "fragmented";
  }
  if (continuityScore < 50 || oscillationRisk === "elevated" || oscillationRisk === "high") {
    return "unstable";
  }
  if (continuityScore < 70 || recommendationTrend === "shifting") {
    return "moderate_variation";
  }
  if (continuityScore >= 85 && (recommendationTrend === "steady" || recommendationTrend === "converging") && oscillationRisk === "low") {
    return "highly_stable";
  }
  if (continuityScore >= 70 && recommendationTrend === "steady") {
    return "stable";
  }
  return "moderate_variation";
}

function applySoftLaunchStabilityCaps({
  stabilityStatus,
  continuityScore,
  oscillationRisk,
  isSmallDollar,
}) {
  if (!isSmallDollar) {
    return { stabilityStatus, continuityScore, oscillationRisk };
  }
  let status = stabilityStatus;
  if (status === "unstable" || status === "fragmented") {
    status = "moderate_variation";
  }
  return {
    stabilityStatus: status,
    continuityScore: Math.min(continuityScore, 72),
    oscillationRisk: oscillationRisk === "high" ? "elevated" : oscillationRisk,
  };
}

function formatStabilityCycleDate(iso) {
  if (!iso) return "current";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "current";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function humanizeCadenceLabel(cadence) {
  const key = String(cadence || "every_few_days").toLowerCase();
  const labels = {
    weekly_review: "weekly review",
    every_few_days: "every-few-days review",
    daily_review: "daily review",
    immediate_visibility: "immediate visibility review",
  };
  return labels[key] || humanizeTreasuryToken(key);
}

function summarizeStabilityCycle(snapshot, isCurrent = false) {
  const dateLabel = isCurrent ? "Current" : `Cycle ${formatStabilityCycleDate(snapshot.createdAt)}`;
  const posture =
    String(snapshot.decisionSupportStatus || "monitoring").replace(/_/g, " ") || "monitoring";
  const cadence = humanizeCadenceLabel(snapshot.recommendedCadence || snapshot.cadenceStatus);
  const coherence = String(snapshot.coherenceStatus || "monitoring").replace(/_/g, " ");
  return `${dateLabel}: ${posture} posture with ${cadence} cadence (coherence ${coherence}).`;
}

function buildRecommendationHistoryEntries(eventSeries, currentSnapshot, isSmallDollar) {
  const entries = [];
  const sampled = eventSeries.slice(0, 7);
  for (let i = sampled.length - 1; i >= 0; i -= 1) {
    entries.push(summarizeStabilityCycle(sampled[i], false));
  }
  entries.push(summarizeStabilityCycle(currentSnapshot, true));
  const unique = uniqueStrings(entries);
  return unique.slice(Math.max(0, unique.length - 8)).slice(0, 8).map((item) =>
    isSmallDollar ? softenText(item, true) : item,
  );
}

function buildStabilityOperatorSummary({
  stabilityStatus,
  recommendationTrend,
  oscillationRisk,
  eventCount,
  isSmallDollar,
}) {
  const trendPhrase = {
    converging: "recommendations are converging toward a steadier advisory posture",
    steady: "monitoring cadence recommendations remained stable over recent cycles",
    shifting: "recommendations show gradual directional drift across recent cycles",
    diverging: "recommendation layers show mixed directional signals across recent cycles",
  };
  const statusPhrase = {
    highly_stable: "Highly stable",
    stable: "Stable",
    moderate_variation: "Moderately varying",
    unstable: "Variable",
    fragmented: "Fragmented",
  };
  const base = `${statusPhrase[String(stabilityStatus || "moderate_variation").toLowerCase()] || "Advisory"} treasury recommendation continuity — ${trendPhrase[String(recommendationTrend || "steady").toLowerCase()] || trendPhrase.steady}. Oscillation risk is ${String(oscillationRisk || "low").replace(/_/g, " ")} across ${eventCount} recorded cycle${eventCount === 1 ? "" : "s"}. Advisory assessment only.`;
  return isSmallDollar ? softenText(base, true) : base;
}

function buildStabilityAdvisoryRecommendations({
  stabilityStatus,
  recommendationTrend,
  oscillationRisk,
  confidenceTrend,
  institutionalMemory,
  decisionTrace,
  isSmallDollar,
}) {
  const recommendations = [
    "Use stability history to interpret advisory continuity — no automatic correction or override.",
    "When oscillation risk is elevated, reconcile mixed signals before changing review cadence.",
  ];

  if (recommendationTrend === "diverging" || recommendationTrend === "shifting") {
    recommendations.push(
      "Directional drift across cycles warrants human review before adjusting monitoring posture.",
    );
  }

  if (confidenceTrend === "weakening") {
    recommendations.push(
      "Confidence trend is weakening — treat cadence guidance cautiously until signals align.",
    );
  }

  if (String(decisionTrace?.traceStatus || "").toLowerCase() === "fragmented_trace") {
    recommendations.push(
      "Fragmented trace reduces continuity confidence — continue observation until layers populate.",
    );
  }

  if (String(institutionalMemory?.institutionalMemoryStatus || "") === "minimal_history") {
    recommendations.push(
      "Limited institutional history — interpret stability as directional guidance only.",
    );
  }

  if (stabilityStatus === "moderate_variation" || stabilityStatus === "highly_stable" || stabilityStatus === "stable") {
    recommendations.push(
      "Stable advisory cycles support consistent review cadence without operational changes.",
    );
  }

  return uniqueStrings(
    recommendations.map((item) => (isSmallDollar ? softenText(item, true) : item)),
  ).slice(0, 5);
}

function deriveContinuityScore({
  eventSeries,
  tierReversals,
  contradictionCount,
  decisionTrace,
  metaReasoning,
  institutionalMemory,
  operationalCoherence,
}) {
  let score = 100;
  score -= tierReversals * 8;
  if (contradictionCount > 0) {
    score -= Math.min(contradictionCount * 5, 25);
  }
  if (eventSeries.length < 5) {
    score = Math.min(score, 60);
  }
  if (String(decisionTrace?.traceStatus || "").toLowerCase() === "fragmented_trace") {
    score -= 10;
  }
  if (String(metaReasoning?.trustStatus || "").toLowerCase() === "mixed_confidence") {
    score -= 8;
  }
  if (String(institutionalMemory?.institutionalMemoryStatus || "").toLowerCase() === "minimal_history") {
    score -= 12;
  }
  if (String(institutionalMemory?.institutionalMemoryStatus || "").toLowerCase() === "stable_pattern") {
    score += 5;
  }
  if (String(operationalCoherence?.coherenceStatus || "").toLowerCase() === "aligned") {
    score += 5;
  }
  if (String(metaReasoning?.trustStatus || "").toLowerCase() === "high_alignment") {
    score += 5;
  }
  return clamp(Math.round(score), 0, 100);
}

/**
 * Pure advisory synthesis — treasury recommendation stability across event history (Phase 3W).
 * READ-ONLY: observes recommendation continuity only — no overrides, automation, or execution.
 * @param {object} args
 */
export function buildTreasuryRecommendationStability({
  treasuryOperationalEvents = [],
  decisionSupport = {},
  attentionPriority = {},
  operationalCoherence = {},
  leadershipReadiness = {},
  adaptiveReviewCadence = {},
  metaReasoning = {},
  decisionTrace = {},
  confidenceExplainability = {},
  institutionalMemory = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const eventSeries = buildStabilityTimeSeries(treasuryOperationalEvents, 30);
    const currentSnapshot = buildCurrentStabilitySnapshot({
      decisionSupport,
      attentionPriority,
      operationalCoherence,
      leadershipReadiness,
      adaptiveReviewCadence,
      metaReasoning,
      decisionTrace,
      confidenceExplainability,
      monitoringAttentionLevel: eventSeries[0]?.treasuryAttentionLevel,
      monitoringOperatingState: eventSeries[0]?.operatingState,
    });
    const combinedSeries = [currentSnapshot, ...eventSeries];

    const tierReversals = countCompositeTierReversals(combinedSeries);
    const oscillationReversals = countOscillationReversals(combinedSeries);
    const contradictionCount = countContradictionEvents(eventSeries);
    const oscillationRisk = deriveOscillationRiskLevel(oscillationReversals);
    const confidenceTrend = deriveConfidenceTrendFromSeries(combinedSeries);
    const recommendationTrend = deriveRecommendationTrend({
      series: combinedSeries,
      oscillationReversals,
      contradictionCount,
    });

    let continuityScore = deriveContinuityScore({
      eventSeries,
      tierReversals,
      contradictionCount,
      decisionTrace,
      metaReasoning,
      institutionalMemory,
      operationalCoherence,
    });

    let stabilityStatus = deriveStabilityStatusKey({
      continuityScore,
      recommendationTrend,
      oscillationRisk,
      eventCount: eventSeries.length,
    });

    ({ stabilityStatus, continuityScore, oscillationRisk } = applySoftLaunchStabilityCaps({
      stabilityStatus,
      continuityScore,
      oscillationRisk,
      isSmallDollar,
    }));

    const recommendationHistory = buildRecommendationHistoryEntries(
      eventSeries,
      currentSnapshot,
      isSmallDollar,
    );

    const operatorSummary = buildStabilityOperatorSummary({
      stabilityStatus,
      recommendationTrend,
      oscillationRisk,
      eventCount: eventSeries.length,
      isSmallDollar,
    });

    const recommendations = buildStabilityAdvisoryRecommendations({
      stabilityStatus,
      recommendationTrend,
      oscillationRisk,
      confidenceTrend,
      institutionalMemory,
      decisionTrace,
      isSmallDollar,
    });

    void leadershipReadiness;
    void liabilities;
    void exposure;

    return {
      stabilityStatus,
      continuityScore,
      recommendationTrend,
      oscillationRisk,
      confidenceTrend,
      recommendationHistory,
      operatorSummary,
      recommendations,
    };
  } catch (err) {
    warn({ op: "buildTreasuryRecommendationStability", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_RECOMMENDATION_STABILITY };
  }
}

export function formatTreasuryRecommendationStabilityChipLabel(result) {
  const status = String(result?.stabilityStatus || "moderate_variation").toLowerCase();
  const labels = {
    highly_stable: "Treasury stability: Highly stable",
    stable: "Treasury stability: Stable",
    moderate_variation: "Treasury stability: Moderate variation",
    unstable: "Treasury stability: Unstable",
    fragmented: "Treasury stability: Fragmented",
  };
  return labels[status] || labels.moderate_variation;
}

const EMPTY_TREASURY_ADVISORY_DRIFT = Object.freeze({
  driftStatus: "stable",
  driftDirection: "neutral",
  driftConfidence: 0,
  momentum: "low",
  trajectory: ["Current: monitoring posture — advisory drift synthesis unavailable."],
  driftSummary:
    "Treasury advisory drift is not yet available. Continue calm advisory observation until operational events accumulate.",
  operatorNarrative:
    "Advisory posture movement cannot be assessed without sufficient operational event history. Treat as directional guidance only.",
  recommendations: [
    "Continue routine treasury observation until advisory drift history stabilizes.",
    "Treat drift assessment as advisory — human judgment remains primary.",
  ],
});

const ADVISORY_DRIFT_DETERIORATION_STATUSES = new Set([
  "soft_deterioration",
  "elevated_deterioration",
  "volatile",
]);

function deriveAdvisoryPostureLabel(snapshot = {}, isSmallDollar = false) {
  const tier = compositeStabilityTierRank(snapshot);
  const cadenceRank = layerStatusRank(
    CADENCE_STATUS_RANK,
    snapshot.cadenceStatus || snapshot.recommendedCadence,
  );
  const readinessRank = layerStatusRank(LEADERSHIP_READINESS_STATUS_RANK, snapshot.readinessStatus);
  const attentionRank = layerStatusRank(ATTENTION_RANK, snapshot.treasuryAttentionLevel);

  if (isSmallDollar && tier <= 1 && attentionRank <= 1) {
    return "soft-launch advisory";
  }
  if (readinessRank >= 2 || cadenceRank >= 3 || attentionRank >= 3 || tier >= 3) {
    return "leadership visibility";
  }
  if (tier >= 2 || attentionRank >= 2) {
    return "elevated monitoring";
  }
  if (tier >= 1 || attentionRank >= 1) {
    return "monitoring";
  }
  return "stable";
}

function buildAdvisoryDriftTrajectoryPoints(eventSeries, currentSnapshot) {
  const sampled = eventSeries.slice(0, 10).slice().reverse();
  return [...sampled, currentSnapshot];
}

function buildAdvisoryDriftTrajectoryLabels(trajectoryPoints, isSmallDollar) {
  return trajectoryPoints.map((snap, idx) => {
    const isCurrent = idx === trajectoryPoints.length - 1 || snap.isCurrent;
    const dateLabel = isCurrent ? "Current" : formatStabilityCycleDate(snap.createdAt);
    const posture = deriveAdvisoryPostureLabel(snap, isSmallDollar);
    return `${dateLabel}: ${posture}`;
  });
}

function countTierChangesAcrossWindow(trajectoryPoints = []) {
  if (trajectoryPoints.length < 2) return 0;
  let changes = 0;
  for (let i = 1; i < trajectoryPoints.length; i += 1) {
    const prev = compositeStabilityTierRank(trajectoryPoints[i - 1]);
    const curr = compositeStabilityTierRank(trajectoryPoints[i]);
    if (prev !== curr) changes += 1;
  }
  return changes;
}

function deriveAdvisoryDriftDirection(trajectoryPoints, tierReversals) {
  if (trajectoryPoints.length < 2) return "neutral";
  if (tierReversals >= 2) return "oscillating";

  const oldest = compositeStabilityTierRank(trajectoryPoints[0]);
  const newest = compositeStabilityTierRank(trajectoryPoints[trajectoryPoints.length - 1]);
  const netDelta = newest - oldest;

  if (netDelta <= -1) return "strengthening";
  if (netDelta >= 1) return "weakening";
  return "neutral";
}

function deriveAdvisoryDriftMomentum(tierChanges, trajectoryPoints = []) {
  if (trajectoryPoints.length >= 3) {
    const recent = trajectoryPoints.slice(-3);
    const recentRanks = recent.map((snap) => compositeStabilityTierRank(snap));
    const recentDelta = Math.abs(recentRanks[recentRanks.length - 1] - recentRanks[0]);
    if (recentDelta >= 2) return "high";
  }
  if (tierChanges >= 3) return "high";
  if (tierChanges === 2) return "moderate";
  return "low";
}

function detectAdvisoryRecoveryPattern(trajectoryPoints = []) {
  if (trajectoryPoints.length < 5) return false;

  const ranks = trajectoryPoints.map((snap) => compositeStabilityTierRank(snap));
  const recent = ranks.slice(-3);
  const earlier = ranks.slice(0, Math.max(1, ranks.length - 3));

  const earlierPeak = Math.max(...earlier);
  const recentEnd = recent[recent.length - 1];
  const recentStart = recent[0];
  const wasElevated = earlierPeak >= 2;
  const recentImproving = recentEnd < recentStart && recentEnd <= earlierPeak - 1;

  return wasElevated && recentImproving;
}

function deriveAdvisoryDriftStatus({
  driftDirection,
  tierDelta,
  recommendationStability,
  coherenceImproving,
  isRecovery,
  tierReversals,
}) {
  const recommendationTrend = String(recommendationStability?.recommendationTrend || "steady").toLowerCase();
  const confidenceTrend = String(recommendationStability?.confidenceTrend || "stable").toLowerCase();
  const oscillationRisk = String(recommendationStability?.oscillationRisk || "low").toLowerCase();

  if (isRecovery) return "recovery";

  if (
    driftDirection === "oscillating" &&
    (oscillationRisk === "high" ||
      oscillationRisk === "elevated" ||
      recommendationTrend === "diverging" ||
      tierReversals >= 3)
  ) {
    return "volatile";
  }

  if (
    driftDirection === "strengthening" &&
    (confidenceTrend === "strengthening" || coherenceImproving)
  ) {
    return "improving";
  }

  if (
    driftDirection === "neutral" &&
    oscillationRisk === "low" &&
    (recommendationTrend === "steady" || recommendationTrend === "converging")
  ) {
    return "stable";
  }

  if (driftDirection === "weakening") {
    if (Math.abs(tierDelta) >= 2 || oscillationRisk === "elevated" || oscillationRisk === "high") {
      return "elevated_deterioration";
    }
    return "soft_deterioration";
  }

  if (driftDirection === "oscillating") {
    return oscillationRisk === "high" ? "volatile" : "stable";
  }

  if (driftDirection === "strengthening") {
    return "improving";
  }

  return "stable";
}

function applySoftLaunchAdvisoryDriftCaps({
  driftStatus,
  driftConfidence,
  tierDelta,
  oscillationRisk,
  tierReversals,
  isSmallDollar,
}) {
  if (!isSmallDollar) {
    return { driftStatus, driftConfidence };
  }

  let status = driftStatus;
  const strongDeterioration =
    Math.abs(tierDelta) >= 3 || (oscillationRisk === "high" && tierReversals >= 3);

  if (status === "elevated_deterioration" && !strongDeterioration) {
    status = "soft_deterioration";
  }
  if (status === "volatile" && !strongDeterioration) {
    status = "stable";
  }

  return {
    driftStatus: status,
    driftConfidence: Math.min(driftConfidence, 82),
  };
}

function deriveAdvisoryDriftConfidence({
  eventCount,
  recommendationStability,
  metaReasoning,
  isSmallDollar,
}) {
  let confidence = 38;
  confidence += Math.min(eventCount * 4, 28);
  confidence += Math.round((Number(recommendationStability?.continuityScore) || 0) * 0.22);

  const trustStatus = String(metaReasoning?.trustStatus || "").toLowerCase();
  if (trustStatus === "high_alignment") confidence += 8;
  if (trustStatus === "mixed_confidence") confidence -= 10;
  if (trustStatus === "soft_uncertainty") confidence -= 6;

  if (eventCount < 3) confidence = Math.min(confidence, 48);
  if (isSmallDollar) confidence = Math.min(confidence, 82);

  return clamp(Math.round(confidence), 0, 100);
}

function buildAdvisoryDriftSummary({
  driftStatus,
  driftDirection,
  momentum,
  recommendationStability,
  isSmallDollar,
}) {
  const recommendationTrend = String(recommendationStability?.recommendationTrend || "steady").toLowerCase();
  const phrases = {
    improving:
      "Advisory posture is gradually calming across recent cycles while recommendation continuity holds steady.",
    stable:
      "Advisory posture remained steady across recent operational cycles with low directional movement.",
    soft_deterioration:
      "Monitoring recommendations gradually intensified across recent cycles while coherence remained stable.",
    elevated_deterioration:
      "Advisory posture shifted toward elevated monitoring across multiple recent cycles — review before adjusting cadence.",
    recovery:
      "Earlier elevated advisory posture has eased in recent cycles — continue observation before changing review rhythm.",
    volatile:
      "Advisory posture oscillated across recent cycles with mixed directional signals — interpret cautiously.",
  };

  let summary =
    phrases[String(driftStatus || "stable").toLowerCase()] ||
    "Advisory posture movement is directional guidance only across recent operational cycles.";

  if (driftDirection === "weakening" && recommendationTrend === "shifting") {
    summary =
      "Monitoring recommendations gradually intensified across recent cycles while coherence remained stable.";
  }

  if (driftDirection === "strengthening" && driftStatus === "improving") {
    summary =
      "Advisory layers are trending calmer across recent cycles with strengthening continuity signals.";
  }

  void momentum;
  return isSmallDollar ? softenText(summary, true) : summary;
}

function buildAdvisoryDriftOperatorNarrative({
  driftStatus,
  driftDirection,
  momentum,
  trajectory,
  recommendationStability,
  isSmallDollar,
}) {
  const directionPhrase = {
    strengthening: "net advisory posture is calming",
    weakening: "net advisory posture is intensifying",
    oscillating: "advisory posture is oscillating without a clear net direction",
    neutral: "advisory posture is largely flat",
  };
  const statusPhrase = {
    improving: "Recent cycles suggest gradual improvement in advisory calm.",
    stable: "Recent cycles show steady advisory posture with limited tier movement.",
    soft_deterioration: "Recent cycles show gradual advisory intensification without high oscillation.",
    elevated_deterioration: "Recent cycles show meaningful advisory intensification across multiple layers.",
    recovery: "Earlier deterioration appears to be easing in the most recent observation points.",
    volatile: "Mixed reversals across recent cycles warrant cautious interpretation.",
  };
  const momentumPhrase = {
    low: "Tier movement has been limited",
    moderate: "Tier movement has been gradual",
    high: "Tier movement has been pronounced",
  };

  const recentPosture = trajectory.length > 0 ? trajectory[trajectory.length - 1] : "Current posture unavailable";
  const oscillationRisk = String(recommendationStability?.oscillationRisk || "low").replace(/_/g, " ");

  const base = `${directionPhrase[String(driftDirection || "neutral").toLowerCase()] || directionPhrase.neutral}. ${statusPhrase[String(driftStatus || "stable").toLowerCase()] || statusPhrase.stable} ${momentumPhrase[String(momentum || "low").toLowerCase()] || momentumPhrase.low} across ${trajectory.length} observation point${trajectory.length === 1 ? "" : "s"}. Latest: ${recentPosture.replace(/^Current:\s*/i, "")}. Oscillation risk from stability layer: ${oscillationRisk}. Advisory assessment only — no automatic correction.`;

  void recommendationStability;
  return isSmallDollar ? softenText(base, true) : base;
}

function buildAdvisoryDriftRecommendations({
  driftStatus,
  driftDirection,
  recommendationStability,
  decisionTrace,
  isSmallDollar,
}) {
  const recommendations = [
    "Advisory drift analysis only — no automatic correction or operational override.",
    "Use trajectory history to interpret directional advisory movement across recent cycles.",
  ];

  if (driftDirection === "weakening") {
    recommendations.push(
      "When drift direction is weakening, review decision trace steps before adjusting cadence.",
    );
  }

  if (ADVISORY_DRIFT_DETERIORATION_STATUSES.has(String(driftStatus || "").toLowerCase())) {
    recommendations.push(
      "Gradual advisory intensification warrants human review before changing monitoring posture.",
    );
  }

  if (driftStatus === "recovery") {
    recommendations.push(
      "Recovery patterns are observational only — maintain current review cadence until signals align.",
    );
  }

  if (String(recommendationStability?.recommendationTrend || "").toLowerCase() === "diverging") {
    recommendations.push(
      "Diverging recommendation stability suggests reconciling mixed signals before cadence changes.",
    );
  }

  if (String(decisionTrace?.traceStatus || "").toLowerCase() === "fragmented_trace") {
    recommendations.push(
      "Fragmented decision trace reduces drift confidence — continue observation until layers populate.",
    );
  }

  return uniqueStrings(
    recommendations.map((item) => (isSmallDollar ? softenText(item, true) : item)),
  ).slice(0, 5);
}

/**
 * Pure advisory synthesis — treasury advisory drift across operational event history (Phase 3X).
 * READ-ONLY: observes directional advisory movement only — no overrides, automation, or execution.
 * @param {object} args
 */
export function buildTreasuryAdvisoryDrift({
  treasuryOperationalEvents = [],
  recommendationStability = {},
  operationalCoherence = {},
  leadershipReadiness = {},
  decisionSupport = {},
  attentionPriority = {},
  confidenceExplainability = {},
  metaReasoning = {},
  adaptiveReviewCadence = {},
  institutionalMemory = {},
  decisionTrace = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const eventSeries = buildStabilityTimeSeries(treasuryOperationalEvents, 12);
    const currentSnapshot = buildCurrentStabilitySnapshot({
      decisionSupport,
      attentionPriority,
      operationalCoherence,
      leadershipReadiness,
      adaptiveReviewCadence,
      metaReasoning,
      decisionTrace,
      confidenceExplainability,
      monitoringAttentionLevel: eventSeries[0]?.treasuryAttentionLevel,
      monitoringOperatingState: eventSeries[0]?.operatingState,
    });

    const trajectoryPoints = buildAdvisoryDriftTrajectoryPoints(eventSeries, currentSnapshot);
    const combinedSeries = [currentSnapshot, ...eventSeries];
    const tierReversals = countCompositeTierReversals(combinedSeries);
    const trajectory = buildAdvisoryDriftTrajectoryLabels(trajectoryPoints, isSmallDollar);

    const oldestRank = compositeStabilityTierRank(trajectoryPoints[0] || currentSnapshot);
    const newestRank = compositeStabilityTierRank(
      trajectoryPoints[trajectoryPoints.length - 1] || currentSnapshot,
    );
    const tierDelta = newestRank - oldestRank;
    const tierChanges = countTierChangesAcrossWindow(trajectoryPoints);
    const coherenceImproving = isCoherenceImproving(combinedSeries);
    const isRecovery = detectAdvisoryRecoveryPattern(trajectoryPoints);

    let driftDirection = deriveAdvisoryDriftDirection(trajectoryPoints, tierReversals);
    let momentum = deriveAdvisoryDriftMomentum(tierChanges, trajectoryPoints);

    let driftStatus = deriveAdvisoryDriftStatus({
      driftDirection,
      tierDelta,
      recommendationStability,
      coherenceImproving,
      isRecovery,
      tierReversals,
    });

    let driftConfidence = deriveAdvisoryDriftConfidence({
      eventCount: eventSeries.length,
      recommendationStability,
      metaReasoning,
      isSmallDollar,
    });

    ({ driftStatus, driftConfidence } = applySoftLaunchAdvisoryDriftCaps({
      driftStatus,
      driftConfidence,
      tierDelta,
      oscillationRisk: recommendationStability?.oscillationRisk,
      tierReversals,
      isSmallDollar,
    }));

    const driftSummary = buildAdvisoryDriftSummary({
      driftStatus,
      driftDirection,
      momentum,
      recommendationStability,
      isSmallDollar,
    });

    const operatorNarrative = buildAdvisoryDriftOperatorNarrative({
      driftStatus,
      driftDirection,
      momentum,
      trajectory,
      recommendationStability,
      isSmallDollar,
    });

    const recommendations = buildAdvisoryDriftRecommendations({
      driftStatus,
      driftDirection,
      recommendationStability,
      decisionTrace,
      isSmallDollar,
    });

    void institutionalMemory;
    void liabilities;
    void exposure;
    void operationalCoherence;
    void leadershipReadiness;

    return {
      driftStatus,
      driftDirection,
      driftConfidence,
      momentum,
      trajectory,
      driftSummary,
      operatorNarrative,
      recommendations,
    };
  } catch (err) {
    warn({ op: "buildTreasuryAdvisoryDrift", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_ADVISORY_DRIFT };
  }
}

export function formatTreasuryAdvisoryDriftChipLabel(result) {
  const status = String(result?.driftStatus || "stable").toLowerCase();
  const labels = {
    improving: "Treasury drift: Improving",
    stable: "Treasury drift: Stable",
    soft_deterioration: "Treasury drift: Soft deterioration",
    elevated_deterioration: "Treasury drift: Elevated deterioration",
    recovery: "Treasury drift: Recovery",
    volatile: "Treasury drift: Volatile",
  };
  return labels[status] || labels.stable;
}

const EMPTY_TREASURY_REGIME_DETECTION = Object.freeze({
  regime: "elevated_monitoring",
  regimeConfidence: 0,
  regimeTrend: "stable",
  operatorPosture: "observe",
  summary:
    "Treasury advisory regime classification is not yet available. Continue calm advisory observation until operational layers accumulate.",
  signals: ["Advisory regime synthesis unavailable — upstream layers not yet populated."],
  recommendations: [
    "Continue routine treasury observation until regime classification stabilizes.",
    "Treat regime assessment as advisory — human judgment remains primary.",
  ],
});

const REGIME_HUMAN_LABELS = Object.freeze({
  stable_operations: "Stable Operations",
  elevated_monitoring: "Elevated Monitoring",
  recovery_mode: "Recovery Mode",
  defensive_posture: "Defensive Posture",
  scaling_pressure: "Scaling Pressure",
  fragmented_advisory_state: "Fragmented Advisory State",
  volatile_conditions: "Volatile Conditions",
  confidence_rebuild: "Confidence Rebuild",
});

function humanizeRegimeKey(key) {
  return REGIME_HUMAN_LABELS[String(key || "").toLowerCase()] || "Elevated Monitoring";
}

function detectScalingPressureSignals(decisionSupport = {}, scenarioResponse = {}) {
  const texts = [];
  for (const item of decisionSupport?.deferredActions || []) {
    texts.push(String(item || ""));
  }
  for (const item of decisionSupport?.treasuryRecommendations || []) {
    texts.push(String(item?.text || item?.recommendation || item || ""));
  }
  for (const item of decisionSupport?.priorityActions || []) {
    texts.push(String(item || ""));
  }
  for (const item of scenarioResponse?.responseGuidance || []) {
    texts.push(String(item || ""));
  }
  const combined = texts.join(" ").toLowerCase();
  return combined.includes("scaling");
}

function deriveRegimeTrend(advisoryDrift = {}, recommendationStability = {}) {
  const driftDirection = String(advisoryDrift?.driftDirection || "neutral").toLowerCase();
  const recommendationTrend = String(recommendationStability?.recommendationTrend || "steady").toLowerCase();

  if (driftDirection === "oscillating" || recommendationTrend === "diverging") {
    return "oscillating";
  }
  if (
    driftDirection === "strengthening" ||
    recommendationTrend === "converging" ||
    String(advisoryDrift?.driftStatus || "").toLowerCase() === "improving"
  ) {
    return "strengthening";
  }
  if (
    driftDirection === "weakening" ||
    recommendationTrend === "shifting" ||
    recommendationTrend === "diverging"
  ) {
    return "weakening";
  }
  return "stable";
}

function matchesFragmentedRegime({
  decisionTrace,
  recommendationStability,
  operationalCoherence,
  metaReasoning,
}) {
  const traceStatus = String(decisionTrace?.traceStatus || "").toLowerCase();
  const stabilityStatus = String(recommendationStability?.stabilityStatus || "").toLowerCase();
  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "").toLowerCase();
  const trustStatus = String(metaReasoning?.trustStatus || "").toLowerCase();

  if (traceStatus === "fragmented_trace") return true;
  if (stabilityStatus === "fragmented") return true;
  if (coherenceStatus === "leadership_review" || coherenceStatus === "mild_conflict") {
    if (trustStatus === "soft_uncertainty" || trustStatus === "mixed_confidence") return true;
  }
  if (trustStatus === "soft_uncertainty" && traceStatus === "partially_traceable" && stabilityStatus === "fragmented") {
    return true;
  }
  return false;
}

function matchesVolatileRegime({ advisoryDrift, regimeTrend, recommendationStability }) {
  const driftStatus = String(advisoryDrift?.driftStatus || "").toLowerCase();
  const oscillationRisk = String(recommendationStability?.oscillationRisk || "low").toLowerCase();
  if (driftStatus === "volatile") return true;
  if (regimeTrend === "oscillating" && (oscillationRisk === "high" || oscillationRisk === "elevated")) {
    return true;
  }
  if (oscillationRisk === "high" && driftStatus !== "stable" && driftStatus !== "improving") return true;
  return false;
}

function matchesConfidenceRebuildRegime({
  institutionalMemory,
  metaReasoning,
  decisionTrace,
  confidenceExplainability,
}) {
  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "").toLowerCase();
  const trustStatus = String(metaReasoning?.trustStatus || "").toLowerCase();
  const traceStatus = String(decisionTrace?.traceStatus || "").toLowerCase();
  const confidenceLevel = String(confidenceExplainability?.confidenceLevel || "low").toLowerCase();

  let matches = 0;
  if (memoryStatus === "minimal_history") matches += 1;
  if (trustStatus === "soft_uncertainty") matches += 1;
  if (traceStatus === "partially_traceable") matches += 1;
  if (confidenceLevel === "low") matches += 1;
  return matches >= 3;
}

function matchesRecoveryRegime({ advisoryDrift }) {
  const driftStatus = String(advisoryDrift?.driftStatus || "").toLowerCase();
  const driftDirection = String(advisoryDrift?.driftDirection || "").toLowerCase();
  return driftStatus === "recovery" || (driftDirection === "strengthening" && driftStatus === "improving");
}

function matchesDefensiveRegime({
  advisoryDrift,
  operationalCoherence,
  decisionSupport,
  recommendationStability,
}) {
  const driftStatus = String(advisoryDrift?.driftStatus || "").toLowerCase();
  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "").toLowerCase();
  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "").toLowerCase();
  const oscillationRisk = String(recommendationStability?.oscillationRisk || "low").toLowerCase();

  let matches = 0;
  if (driftStatus === "elevated_deterioration") matches += 1;
  if (coherenceStatus === "mild_conflict") matches += 1;
  if (decisionStatus === "attention_recommended") matches += 1;
  if (oscillationRisk === "elevated" || oscillationRisk === "high") matches += 1;
  return matches >= 2;
}

function matchesElevatedMonitoringRegime({
  adaptiveReviewCadence,
  scenarioResponse,
  recommendationStability,
  advisoryDrift,
  leadershipReadiness,
}) {
  const recommendedCadence = String(adaptiveReviewCadence?.recommendedCadence || "").toLowerCase();
  const cadenceStatus = String(adaptiveReviewCadence?.cadenceStatus || "").toLowerCase();
  const scenario = String(scenarioResponse?.treasuryScenario || "").toLowerCase();
  const stabilityStatus = String(recommendationStability?.stabilityStatus || "").toLowerCase();
  const driftStatus = String(advisoryDrift?.driftStatus || "").toLowerCase();
  const readinessStatus = String(leadershipReadiness?.readinessStatus || "").toLowerCase();

  let matches = 0;
  if (recommendedCadence === "every_few_days" || cadenceStatus === "monitoring") matches += 1;
  if (scenario === "monitoring" || scenario === "elevated_attention") matches += 1;
  if (stabilityStatus === "moderate_variation") matches += 1;
  if (driftStatus === "soft_deterioration") matches += 1;
  if (readinessStatus === "monitoring_visibility") matches += 1;
  return matches >= 2;
}

function matchesScalingPressureRegime({
  decisionSupport,
  scenarioResponse,
  leadershipReadiness,
  attentionPriority,
}) {
  if (!detectScalingPressureSignals(decisionSupport, scenarioResponse)) return false;

  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "").toLowerCase();
  const readinessStatus = String(leadershipReadiness?.readinessStatus || "").toLowerCase();
  const priorityStatus = String(attentionPriority?.priorityStatus || "").toLowerCase();
  const hasDeferredScaling = (decisionSupport?.deferredActions || []).some((item) =>
    String(item || "").toLowerCase().includes("scaling"),
  );

  if (!hasDeferredScaling && decisionStatus === "stable") return false;

  return (
    decisionStatus === "attention_recommended" ||
    decisionStatus === "monitoring" ||
    readinessStatus === "monitoring_visibility" ||
    priorityStatus === "elevated_attention" ||
    hasDeferredScaling
  );
}

function matchesStableOperationsRegime({
  operationalCoherence,
  recommendationStability,
  advisoryDrift,
  leadershipReadiness,
  decisionSupport,
}) {
  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "").toLowerCase();
  const stabilityStatus = String(recommendationStability?.stabilityStatus || "").toLowerCase();
  const driftStatus = String(advisoryDrift?.driftStatus || "").toLowerCase();
  const readinessStatus = String(leadershipReadiness?.readinessStatus || "").toLowerCase();
  const decisionStatus = String(decisionSupport?.decisionSupportStatus || "").toLowerCase();

  const coherenceAligned = coherenceStatus === "aligned" || coherenceStatus === "monitoring";
  const stabilityCalm = stabilityStatus === "stable" || stabilityStatus === "highly_stable";
  const driftCalm = driftStatus === "stable" || driftStatus === "improving";
  const operatorLeadership =
    readinessStatus === "operator_level" || readinessStatus === "monitoring_visibility";
  const decisionCalm = decisionStatus === "stable" || decisionStatus === "monitoring";

  return coherenceAligned && stabilityCalm && driftCalm && operatorLeadership && decisionCalm;
}

function classifyTreasuryRegime(inputs) {
  const regimeTrend = deriveRegimeTrend(inputs.advisoryDrift, inputs.recommendationStability);
  const context = { ...inputs, regimeTrend };

  if (matchesFragmentedRegime(context)) return "fragmented_advisory_state";
  if (matchesVolatileRegime(context)) return "volatile_conditions";
  if (matchesConfidenceRebuildRegime(context)) return "confidence_rebuild";
  if (matchesRecoveryRegime(context)) return "recovery_mode";
  if (matchesDefensiveRegime(context)) return "defensive_posture";
  if (matchesElevatedMonitoringRegime(context)) return "elevated_monitoring";
  if (matchesScalingPressureRegime(context)) return "scaling_pressure";
  if (matchesStableOperationsRegime(context)) return "stable_operations";
  return "elevated_monitoring";
}

function applySoftLaunchRegimeCaps({ regime, regimeConfidence, inputs }) {
  let nextRegime = regime;
  let confidence = regimeConfidence;
  const { isSmallDollar, advisoryDrift, recommendationStability, operationalCoherence } = inputs;

  if (!isSmallDollar) {
    return { regime: nextRegime, regimeConfidence: confidence };
  }

  confidence = Math.min(confidence, 82);

  const driftStatus = String(advisoryDrift?.driftStatus || "").toLowerCase();
  const oscillationRisk = String(recommendationStability?.oscillationRisk || "low").toLowerCase();
  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "").toLowerCase();
  const strongVolatile =
    driftStatus === "volatile" && (oscillationRisk === "high" || oscillationRisk === "elevated");
  const strongDefensive =
    driftStatus === "elevated_deterioration" &&
    (coherenceStatus === "mild_conflict" || coherenceStatus === "leadership_review");

  if (nextRegime === "volatile_conditions" && !strongVolatile) {
    nextRegime = "elevated_monitoring";
  }
  if (nextRegime === "defensive_posture" && !strongDefensive) {
    nextRegime = "elevated_monitoring";
  }

  return { regime: nextRegime, regimeConfidence: confidence };
}

function deriveRegimeOperatorPosture({
  regime,
  leadershipReadiness,
  adaptiveReviewCadence,
  operationalCoherence,
  attentionPriority,
}) {
  const readinessStatus = String(leadershipReadiness?.readinessStatus || "").toLowerCase();
  const visibilityTier = String(leadershipReadiness?.visibilityTier || "").toLowerCase();
  const recommendedCadence = String(adaptiveReviewCadence?.recommendedCadence || "").toLowerCase();
  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "").toLowerCase();
  const priorityStatus = String(attentionPriority?.priorityStatus || "").toLowerCase();

  if (
    readinessStatus === "leadership_visibility" ||
    readinessStatus === "executive_attention" ||
    visibilityTier === "leadership" ||
    visibilityTier === "executive"
  ) {
    return "leadership_visibility";
  }

  if (
    regime === "defensive_posture" ||
    coherenceStatus === "mild_conflict"
  ) {
    return "cautious_attention";
  }

  if (
    recommendedCadence === "daily_review" ||
    regime === "volatile_conditions" ||
    priorityStatus === "elevated_attention" ||
    readinessStatus === "executive_attention"
  ) {
    return "elevated_attention";
  }

  if (
    regime === "elevated_monitoring" ||
    regime === "scaling_pressure" ||
    recommendedCadence === "every_few_days"
  ) {
    return "monitor_closely";
  }

  if (regime === "stable_operations" || regime === "recovery_mode" || regime === "confidence_rebuild") {
    return "observe";
  }

  return "monitor_closely";
}

function deriveRegimeConfidence({
  regime,
  operationalCoherence,
  recommendationStability,
  advisoryDrift,
  metaReasoning,
  confidenceExplainability,
  decisionTrace,
  isSmallDollar,
}) {
  let confidence = 42;
  confidence += Math.round((Number(recommendationStability?.continuityScore) || 0) * 0.28);
  confidence += Math.round((Number(advisoryDrift?.driftConfidence) || 0) * 0.18);
  confidence += Math.round((Number(confidenceExplainability?.confidenceScore) || 0) * 0.12);

  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "").toLowerCase();
  if (coherenceStatus === "aligned") confidence += 8;
  if (coherenceStatus === "mild_conflict") confidence -= 8;

  const trustStatus = String(metaReasoning?.trustStatus || "").toLowerCase();
  if (trustStatus === "high_alignment") confidence += 6;
  if (trustStatus === "soft_uncertainty") confidence -= 8;

  const traceStatus = String(decisionTrace?.traceStatus || "").toLowerCase();
  if (traceStatus === "fully_traceable") confidence += 5;
  if (traceStatus === "fragmented_trace") confidence -= 10;

  if (regime === "fragmented_advisory_state" || regime === "volatile_conditions") {
    confidence = Math.min(confidence, 58);
  }
  if (regime === "stable_operations") {
    confidence += 6;
  }

  if (isSmallDollar) confidence = Math.min(confidence, 82);
  return clamp(Math.round(confidence), 0, 100);
}

function buildRegimeContributingSignals({
  operationalCoherence,
  recommendationStability,
  advisoryDrift,
  metaReasoning,
  leadershipReadiness,
  adaptiveReviewCadence,
  decisionSupport,
  decisionTrace,
  institutionalMemory,
  confidenceExplainability,
  scenarioResponse,
  attentionPriority,
}) {
  const signals = [];

  signals.push(
    `Operational coherence: ${humanizeTreasuryToken(operationalCoherence?.coherenceStatus || "monitoring")}`,
  );
  signals.push(
    `Recommendation stability: ${humanizeTreasuryToken(recommendationStability?.stabilityStatus || "moderate_variation")} (continuity ${Number(recommendationStability?.continuityScore) || 0})`,
  );
  signals.push(
    `Advisory drift: ${humanizeTreasuryToken(advisoryDrift?.driftStatus || "stable")}, direction ${humanizeTreasuryToken(advisoryDrift?.driftDirection || "neutral")}`,
  );
  signals.push(
    `Meta-reasoning trust: ${humanizeTreasuryToken(metaReasoning?.trustStatus || "soft_uncertainty")}`,
  );
  signals.push(
    `Leadership readiness: ${humanizeTreasuryToken(leadershipReadiness?.readinessStatus || "monitoring_visibility")}`,
  );
  signals.push(
    `Review cadence: ${humanizeTreasuryToken(adaptiveReviewCadence?.recommendedCadence || "every_few_days")}`,
  );
  signals.push(
    `Decision support: ${humanizeTreasuryToken(decisionSupport?.decisionSupportStatus || "monitoring")}`,
  );
  signals.push(
    `Decision trace: ${humanizeTreasuryToken(decisionTrace?.traceStatus || "partially_traceable")}`,
  );
  signals.push(
    `Institutional memory: ${humanizeTreasuryToken(institutionalMemory?.institutionalMemoryStatus || "minimal_history")}`,
  );
  signals.push(
    `Confidence explainability: ${humanizeTreasuryToken(confidenceExplainability?.confidenceLevel || "low")}`,
  );
  signals.push(
    `Scenario response: ${humanizeTreasuryToken(scenarioResponse?.treasuryScenario || scenarioResponse?.responseStatus || "monitoring")}`,
  );
  signals.push(
    `Attention priority: ${humanizeTreasuryToken(attentionPriority?.priorityStatus || "stable")}`,
  );

  return uniqueStrings(signals).slice(0, 8);
}

function buildRegimeSummaryParagraph({ regime, regimeTrend, operatorPosture, isSmallDollar }) {
  const regimeLabel = humanizeRegimeKey(regime);
  const trendPhrase = {
    strengthening: "with strengthening advisory continuity",
    stable: "with stable recommendation continuity",
    weakening: "with gradually weakening advisory continuity",
    oscillating: "with oscillating advisory signals across recent cycles",
  };
  const posturePhrase = {
    observe: "Operator posture remains observational",
    monitor_closely: "Operator posture favors close monitoring",
    cautious_attention: "Operator posture warrants cautious attention",
    elevated_attention: "Operator posture reflects elevated attention",
    leadership_visibility: "Leadership visibility is recommended for current advisory posture",
  };

  const summary = `Advisory layers remain ${trendPhrase[String(regimeTrend || "stable").toLowerCase()] || trendPhrase.stable}. ${posturePhrase[String(operatorPosture || "observe").toLowerCase()] || posturePhrase.observe}. Treasury currently reflects a ${regimeLabel.toLowerCase()} regime — classification only, no actions executed.`;

  return isSmallDollar ? softenText(summary, true) : summary;
}

function buildRegimeAdvisoryRecommendations({ regime, regimeTrend, operatorPosture, isSmallDollar }) {
  const recommendations = [
    "Advisory regime classification only — no automatic correction, override, or operational execution.",
    "Use regime posture to interpret treasury guidance layers — human judgment remains primary.",
  ];

  if (regime === "fragmented_advisory_state" || regime === "volatile_conditions") {
    recommendations.push(
      "Reconcile fragmented or oscillating advisory signals before adjusting review cadence.",
    );
  } else if (regime === "confidence_rebuild") {
    recommendations.push(
      "Limited institutional history suggests continuing observation until confidence layers populate.",
    );
  } else if (regime === "recovery_mode") {
    recommendations.push(
      "Recovery patterns are observational only — maintain current review cadence until signals align.",
    );
  } else if (regime === "defensive_posture") {
    recommendations.push(
      "Defensive advisory posture warrants human review of decision trace and coherence layers.",
    );
  } else if (regime === "scaling_pressure") {
    recommendations.push(
      "Scaling-related deferred guidance is advisory only — defer scaling reviews until posture stabilizes.",
    );
  } else if (regime === "elevated_monitoring") {
    recommendations.push(
      "Elevated monitoring regime supports closer advisory review without changing operational settings.",
    );
  } else if (regimeTrend === "weakening") {
    recommendations.push(
      "Weakening regime trend suggests reviewing upstream stability and drift layers during the next review.",
    );
  }

  return uniqueStrings(
    recommendations.map((item) => (isSmallDollar ? softenText(item, true) : item)),
  ).slice(0, 4);
}

/**
 * Pure advisory synthesis — treasury advisory regime detection (Phase 3Y).
 * READ-ONLY: classifies advisory posture only — no overrides, automation, or execution.
 * @param {object} args
 */
export function buildTreasuryRegimeDetection({
  operationalCoherence = {},
  recommendationStability = {},
  advisoryDrift = {},
  confidenceExplainability = {},
  leadershipReadiness = {},
  attentionPriority = {},
  adaptiveReviewCadence = {},
  scenarioResponse = {},
  metaReasoning = {},
  decisionSupport = {},
  decisionTrace = {},
  institutionalMemory = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });
    const inputs = {
      operationalCoherence,
      recommendationStability,
      advisoryDrift,
      confidenceExplainability,
      leadershipReadiness,
      attentionPriority,
      adaptiveReviewCadence,
      scenarioResponse,
      metaReasoning,
      decisionSupport,
      decisionTrace,
      institutionalMemory,
      isSmallDollar,
    };

    const regimeTrend = deriveRegimeTrend(advisoryDrift, recommendationStability);
    let regime = classifyTreasuryRegime({ ...inputs, regimeTrend });
    let regimeConfidence = deriveRegimeConfidence({
      regime,
      operationalCoherence,
      recommendationStability,
      advisoryDrift,
      metaReasoning,
      confidenceExplainability,
      decisionTrace,
      isSmallDollar,
    });

    ({ regime, regimeConfidence } = applySoftLaunchRegimeCaps({
      regime,
      regimeConfidence,
      inputs,
    }));

    const operatorPosture = deriveRegimeOperatorPosture({
      regime,
      leadershipReadiness,
      adaptiveReviewCadence,
      operationalCoherence,
      attentionPriority,
    });

    const signals = buildRegimeContributingSignals({
      operationalCoherence,
      recommendationStability,
      advisoryDrift,
      metaReasoning,
      leadershipReadiness,
      adaptiveReviewCadence,
      decisionSupport,
      decisionTrace,
      institutionalMemory,
      confidenceExplainability,
      scenarioResponse,
      attentionPriority,
    });

    const summary = buildRegimeSummaryParagraph({
      regime,
      regimeTrend,
      operatorPosture,
      isSmallDollar,
    });

    const recommendations = buildRegimeAdvisoryRecommendations({
      regime,
      regimeTrend,
      operatorPosture,
      isSmallDollar,
    });

    void liabilities;
    void exposure;

    return {
      regime,
      regimeConfidence,
      regimeTrend,
      operatorPosture,
      summary,
      signals,
      recommendations,
    };
  } catch (err) {
    warn({ op: "buildTreasuryRegimeDetection", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_REGIME_DETECTION };
  }
}

export function formatTreasuryRegimeDetectionChipLabel(result) {
  const regime = String(result?.regime || "elevated_monitoring").toLowerCase();
  return `Treasury regime: ${humanizeRegimeKey(regime)}`;
}

const EMPTY_TREASURY_ADVISORY_OUTLOOK = Object.freeze({
  outlook: "uncertain_outlook",
  outlookConfidence: 0,
  outlookDirection: "stable",
  operatorPosture: "observe",
  outlookSummary:
    "Treasury advisory outlook is not yet available. Continue calm advisory observation until Phase 3 operational layers accumulate — near-term outlook only, not a forecast.",
  signals: ["Advisory outlook synthesis unavailable — upstream layers not yet populated."],
  recommendations: [
    "Continue routine treasury observation until advisory outlook layers stabilize.",
    "Treat outlook assessment as near-term advisory interpretation — human judgment remains primary.",
  ],
});

const OUTLOOK_HUMAN_LABELS = Object.freeze({
  improving_outlook: "Improving",
  stabilizing_outlook: "Stabilizing",
  cautious_outlook: "Cautious",
  elevated_monitoring_outlook: "Elevated Monitoring",
  deteriorating_outlook: "Deteriorating",
  uncertain_outlook: "Uncertain",
  recovery_outlook: "Recovery",
});

function humanizeOutlookKey(key) {
  return OUTLOOK_HUMAN_LABELS[String(key || "").toLowerCase()] || "Uncertain";
}

function deriveOutlookDirection({ regimeTrend, driftDirection, confidenceTrend }) {
  const regime = String(regimeTrend || "stable").toLowerCase();
  const drift = String(driftDirection || "neutral").toLowerCase();
  const confidence = String(confidenceTrend || "stable").toLowerCase();

  const tokens = [regime, drift === "neutral" ? "stable" : drift, confidence];

  if (tokens.some((t) => t === "oscillating" || t === "diverging")) {
    return "oscillating";
  }

  const strengthening = new Set(["strengthening", "improving", "converging"]);
  const weakening = new Set(["weakening", "shifting"]);
  const stable = new Set(["stable", "steady", "neutral"]);

  const strCount = tokens.filter((t) => strengthening.has(t)).length;
  const weakCount = tokens.filter((t) => weakening.has(t)).length;
  const stableCount = tokens.filter((t) => stable.has(t)).length;

  if (strCount >= 2 || (strCount === 1 && weakCount === 0 && stableCount === 0)) {
    return "strengthening";
  }
  if (weakCount >= 2 || (weakCount === 1 && strCount === 0 && stableCount === 0)) {
    return "weakening";
  }
  if (strCount === 1 && weakCount === 1) {
    return "oscillating";
  }
  return "stable";
}

function hasStabilizingContinuity(recommendationStability = {}) {
  const stabilityStatus = String(recommendationStability?.stabilityStatus || "").toLowerCase();
  const recommendationTrend = String(recommendationStability?.recommendationTrend || "").toLowerCase();
  const oscillationRisk = String(recommendationStability?.oscillationRisk || "low").toLowerCase();
  const continuityScore = Number(recommendationStability?.continuityScore) || 0;

  const calmStability =
    stabilityStatus === "stable" ||
    stabilityStatus === "highly_stable" ||
    stabilityStatus === "moderate_variation";
  const calmTrend = recommendationTrend === "steady" || recommendationTrend === "converging";
  const calmOscillation = oscillationRisk === "low" || oscillationRisk === "moderate";

  return calmStability && (calmTrend || continuityScore >= 55) && calmOscillation;
}

function matchesRecoveryOutlook({ regime, advisoryDrift, recommendationStability }) {
  const regimeKey = String(regime?.regime || "").toLowerCase();
  const driftStatus = String(advisoryDrift?.driftStatus || "").toLowerCase();
  const driftDirection = String(advisoryDrift?.driftDirection || "").toLowerCase();

  if (regimeKey === "recovery_mode") return true;
  if (
    (driftStatus === "recovery" || driftStatus === "improving") &&
    hasStabilizingContinuity(recommendationStability)
  ) {
    return true;
  }
  if (driftDirection === "strengthening" && driftStatus === "improving" && hasStabilizingContinuity(recommendationStability)) {
    return true;
  }
  return false;
}

function matchesImprovingOutlook({ advisoryDrift, operationalCoherence, recommendationStability }) {
  const driftStatus = String(advisoryDrift?.driftStatus || "").toLowerCase();
  const driftDirection = String(advisoryDrift?.driftDirection || "").toLowerCase();
  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "").toLowerCase();
  const stabilityStatus = String(recommendationStability?.stabilityStatus || "").toLowerCase();

  const driftPositive = driftStatus === "improving" || driftDirection === "strengthening";
  const coherenceAligned = coherenceStatus === "aligned" || coherenceStatus === "monitoring";
  const stabilityCalm = stabilityStatus === "stable" || stabilityStatus === "highly_stable";

  return driftPositive && coherenceAligned && stabilityCalm;
}

function matchesStabilizingOutlook({
  regime,
  recommendationStability,
  operationalCoherence,
  advisoryDrift,
}) {
  const regimeKey = String(regime?.regime || "").toLowerCase();
  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "").toLowerCase();
  const driftStatus = String(advisoryDrift?.driftStatus || "").toLowerCase();
  const driftDirection = String(advisoryDrift?.driftDirection || "").toLowerCase();

  if (regimeKey !== "elevated_monitoring") return false;

  const coherenceAligned = coherenceStatus === "aligned" || coherenceStatus === "monitoring";
  const driftNeutral = driftStatus === "stable" || driftDirection === "neutral" || driftStatus === "improving";
  return hasStabilizingContinuity(recommendationStability) && coherenceAligned && driftNeutral;
}

function matchesElevatedMonitoringOutlook({
  regime,
  adaptiveReviewCadence,
  attentionPriority,
}) {
  const regimeKey = String(regime?.regime || "").toLowerCase();
  const recommendedCadence = String(adaptiveReviewCadence?.recommendedCadence || "").toLowerCase();
  const cadenceStatus = String(adaptiveReviewCadence?.cadenceStatus || "").toLowerCase();
  const priorityStatus = String(attentionPriority?.priorityStatus || "").toLowerCase();

  const elevatedRegime = regimeKey === "elevated_monitoring" || regimeKey === "defensive_posture";
  const monitoringCadence =
    recommendedCadence === "every_few_days" ||
    recommendedCadence === "daily" ||
    cadenceStatus === "monitoring" ||
    cadenceStatus === "elevated";
  const elevatedPriority =
    priorityStatus === "elevated_attention" ||
    priorityStatus === "leadership_visibility" ||
    priorityStatus === "monitoring";

  return elevatedRegime && monitoringCadence && elevatedPriority;
}

function matchesCautiousOutlook({ operationalCoherence, metaReasoning, recommendationStability }) {
  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "").toLowerCase();
  const trustStatus = String(metaReasoning?.trustStatus || "").toLowerCase();
  const stabilityStatus = String(recommendationStability?.stabilityStatus || "").toLowerCase();

  let matches = 0;
  if (coherenceStatus === "mild_conflict") matches += 1;
  if (trustStatus === "mixed_confidence") matches += 1;
  if (stabilityStatus === "moderate_variation") matches += 1;
  return matches >= 2;
}

function matchesDeterioratingOutlook({ advisoryDrift, outlookDirection }) {
  const driftStatus = String(advisoryDrift?.driftStatus || "").toLowerCase();
  const driftDirection = String(advisoryDrift?.driftDirection || "").toLowerCase();

  const deteriorationDrift =
    driftStatus === "soft_deterioration" || driftStatus === "elevated_deterioration";
  const weakening = outlookDirection === "weakening" || driftDirection === "weakening";

  return deteriorationDrift && weakening;
}

function countUncertainOutlookFactors({
  regime,
  metaReasoning,
  institutionalMemory,
  decisionTrace,
  outlookConfidence,
}) {
  const regimeKey = String(regime?.regime || "").toLowerCase();
  const trustStatus = String(metaReasoning?.trustStatus || "").toLowerCase();
  const memoryStatus = String(institutionalMemory?.institutionalMemoryStatus || "").toLowerCase();
  const traceStatus = String(decisionTrace?.traceStatus || "").toLowerCase();

  let factors = 0;
  if (regimeKey === "fragmented_advisory_state" || regimeKey === "volatile_conditions") factors += 1;
  if (trustStatus === "soft_uncertainty") factors += 1;
  if (memoryStatus === "minimal_history") factors += 1;
  if (traceStatus === "partially_traceable" || traceStatus === "fragmented_trace") factors += 1;
  if (outlookConfidence < 45) factors += 1;
  return factors;
}

function classifyTreasuryAdvisoryOutlook(context) {
  if (matchesRecoveryOutlook(context)) return "recovery_outlook";
  if (matchesImprovingOutlook(context)) return "improving_outlook";
  if (matchesStabilizingOutlook(context)) return "stabilizing_outlook";
  if (matchesElevatedMonitoringOutlook(context)) return "elevated_monitoring_outlook";
  if (matchesCautiousOutlook(context)) return "cautious_outlook";
  if (matchesDeterioratingOutlook(context)) return "deteriorating_outlook";
  if (countUncertainOutlookFactors(context) >= 2) return "uncertain_outlook";
  return "elevated_monitoring_outlook";
}

function deriveOutlookConfidence({
  regime,
  advisoryDrift,
  recommendationStability,
  confidenceExplainability,
  uncertainFactorCount,
  isSmallDollar,
}) {
  let confidence = Math.round(
    (Number(regime?.regimeConfidence) || 0) * 0.32 +
      (Number(advisoryDrift?.driftConfidence) || 0) * 0.22 +
      (Number(recommendationStability?.continuityScore) || 0) * 0.28 +
      (Number(confidenceExplainability?.confidenceScore) || 0) * 0.18,
  );

  if (uncertainFactorCount >= 2) {
    confidence = Math.round(confidence * 0.78);
  }
  if (uncertainFactorCount >= 3) {
    confidence = Math.min(confidence, 48);
  }

  confidence = clamp(confidence, 0, 100);
  if (isSmallDollar) {
    confidence = Math.min(confidence, 82);
  }
  return confidence;
}

function applySoftLaunchOutlookCaps({ outlook, outlookConfidence, isSmallDollar, uncertainFactorCount }) {
  let nextOutlook = outlook;
  let confidence = outlookConfidence;

  if (!isSmallDollar && uncertainFactorCount < 3) {
    return { outlook: nextOutlook, outlookConfidence: confidence };
  }

  confidence = Math.min(confidence, 82);

  if (nextOutlook === "deteriorating_outlook") {
    nextOutlook = "cautious_outlook";
  }

  if (uncertainFactorCount >= 2 && nextOutlook === "elevated_monitoring_outlook") {
    nextOutlook = "uncertain_outlook";
  }

  if (isSmallDollar && uncertainFactorCount >= 1 && nextOutlook === "deteriorating_outlook") {
    nextOutlook = "cautious_outlook";
  }

  return { outlook: nextOutlook, outlookConfidence: confidence };
}

function deriveOutlookOperatorPosture({ outlook, regime, leadershipReadiness }) {
  const regimePosture = String(regime?.operatorPosture || "").toLowerCase();
  if (regimePosture) {
    const outlookKey = String(outlook || "").toLowerCase();
    if (outlookKey === "deteriorating_outlook" && regimePosture === "observe") {
      return "monitor_closely";
    }
    if (outlookKey !== "uncertain_outlook" && outlookKey !== "cautious_outlook") {
      return regimePosture;
    }
  }

  const readinessStatus = String(leadershipReadiness?.readinessStatus || "").toLowerCase();
  const postureMap = {
    improving_outlook: "observe",
    stabilizing_outlook: "monitor_closely",
    cautious_outlook: "cautious_attention",
    elevated_monitoring_outlook: "elevated_attention",
    deteriorating_outlook: "elevated_attention",
    uncertain_outlook: "cautious_attention",
    recovery_outlook: "monitor_closely",
  };

  const mapped = postureMap[String(outlook || "").toLowerCase()];
  if (mapped) return mapped;
  if (readinessStatus === "leadership_visibility") return "leadership_visibility";
  return regimePosture || "observe";
}

function buildOutlookContributingSignals({
  regime,
  advisoryDrift,
  recommendationStability,
  operationalCoherence,
  adaptiveReviewCadence,
  metaReasoning,
  outlookDirection,
}) {
  const signals = [];

  if (regime?.regime) {
    signals.push(`Advisory regime classified as ${humanizeRegimeKey(regime.regime).toLowerCase()}.`);
  }
  if (regime?.regimeTrend) {
    signals.push(`Regime trend is ${String(regime.regimeTrend).replace(/_/g, " ")}.`);
  }
  if (advisoryDrift?.driftStatus) {
    signals.push(`Advisory drift status: ${String(advisoryDrift.driftStatus).replace(/_/g, " ")}.`);
  }
  if (advisoryDrift?.driftDirection) {
    signals.push(`Drift direction: ${String(advisoryDrift.driftDirection).replace(/_/g, " ")}.`);
  }
  if (recommendationStability?.stabilityStatus) {
    signals.push(
      `Recommendation stability: ${String(recommendationStability.stabilityStatus).replace(/_/g, " ")} (continuity ${Number(recommendationStability.continuityScore) || 0}/100).`,
    );
  }
  if (recommendationStability?.confidenceTrend) {
    signals.push(`Confidence trend: ${String(recommendationStability.confidenceTrend).replace(/_/g, " ")}.`);
  }
  if (operationalCoherence?.coherenceStatus) {
    signals.push(`Operational coherence: ${String(operationalCoherence.coherenceStatus).replace(/_/g, " ")}.`);
  }
  if (adaptiveReviewCadence?.recommendedCadence) {
    signals.push(
      `Review cadence recommendation: ${String(adaptiveReviewCadence.recommendedCadence).replace(/_/g, " ")}.`,
    );
  }
  if (metaReasoning?.trustStatus) {
    signals.push(`Meta-reasoning trust posture: ${String(metaReasoning.trustStatus).replace(/_/g, " ")}.`);
  }
  if (outlookDirection) {
    signals.push(`Near-term outlook direction: ${String(outlookDirection).replace(/_/g, " ")}.`);
  }

  return uniqueStrings(signals).slice(0, 8);
}

function buildOutlookSummaryParagraph({
  outlook,
  outlookDirection,
  regime,
  recommendationStability,
  operationalCoherence,
  advisoryDrift,
  isSmallDollar,
}) {
  const outlookLabel = humanizeOutlookKey(outlook).toLowerCase();
  const regimeLabel = humanizeRegimeKey(regime?.regime).toLowerCase();
  const coherenceStatus = String(operationalCoherence?.coherenceStatus || "monitoring").replace(/_/g, " ");
  const stabilityStatus = String(recommendationStability?.stabilityStatus || "moderate variation").replace(/_/g, " ");
  const driftStatus = String(advisoryDrift?.driftStatus || "stable").replace(/_/g, " ");
  const directionPhrase = String(outlookDirection || "stable").replace(/_/g, " ");

  let summary = "";

  if (outlook === "stabilizing_outlook") {
    summary = `Treasury remains in an ${regimeLabel} regime while recommendation continuity stays ${stabilityStatus} and coherence remains ${coherenceStatus}, implying a ${outlookLabel} near-term advisory outlook with ${directionPhrase} direction — advisory interpretation only, not a forecast.`;
  } else if (outlook === "improving_outlook") {
    summary = `Advisory drift is ${driftStatus} with ${stabilityStatus} recommendation continuity and ${coherenceStatus} coherence, suggesting an ${outlookLabel} near-term advisory outlook — forward-leaning guidance from current state, not a prediction.`;
  } else if (outlook === "recovery_outlook") {
    summary = `Recovery-oriented advisory signals are present alongside ${stabilityStatus} continuity, indicating a ${outlookLabel} near-term outlook — observational only, not an execution trigger.`;
  } else if (outlook === "elevated_monitoring_outlook") {
    summary = `Treasury reflects an ${regimeLabel} posture with monitoring-oriented cadence and elevated attention priorities, supporting an ${outlookLabel} near-term advisory outlook — interpret alongside human review, not as automated action.`;
  } else if (outlook === "cautious_outlook") {
    summary = `Mixed advisory signals — ${coherenceStatus} coherence and ${stabilityStatus} stability — warrant a ${outlookLabel} near-term outlook with ${directionPhrase} direction. Advisory framing only; no operational changes implied.`;
  } else if (outlook === "deteriorating_outlook") {
    summary = `Soft advisory deterioration (${driftStatus}) with ${directionPhrase} direction suggests a ${outlookLabel} near-term outlook — calm institutional review recommended; this is not an alarm or automated escalation.`;
  } else if (outlook === "uncertain_outlook") {
    summary = `Fragmented or limited-history advisory layers produce a ${outlookLabel} near-term outlook — continue observation until upstream signals align; not a forecast of future conditions.`;
  } else {
    summary = `Treasury advisory layers currently imply a ${outlookLabel} near-term outlook with ${directionPhrase} direction — near-term advisory interpretation only, not predictive certainty.`;
  }

  return isSmallDollar ? softenText(summary, true) : summary;
}

function buildOutlookAdvisoryRecommendations({ outlook, outlookDirection, operatorPosture, isSmallDollar }) {
  const recommendations = [
    "Near-term advisory outlook only — not a forecast, prediction, or execution directive.",
    "Use outlook posture to interpret Phase 3 treasury layers — human judgment remains primary.",
  ];

  if (outlook === "uncertain_outlook") {
    recommendations.push(
      "Limited traceability or institutional history suggests deferring outlook-driven cadence changes until signals converge.",
    );
  } else if (outlook === "stabilizing_outlook" || outlook === "improving_outlook") {
    recommendations.push(
      "Stable or improving outlook supports maintaining current advisory review rhythm without operational changes.",
    );
  } else if (outlook === "elevated_monitoring_outlook") {
    recommendations.push(
      "Elevated monitoring outlook supports closer advisory review during the next scheduled treasury check-in.",
    );
  } else if (outlook === "cautious_outlook" || outlook === "deteriorating_outlook") {
    recommendations.push(
      "Review coherence, drift, and stability panels together before adjusting internal review cadence.",
    );
  } else if (outlook === "recovery_outlook") {
    recommendations.push(
      "Recovery outlook is observational — maintain current posture until regime and drift layers align consistently.",
    );
  }

  if (outlookDirection === "oscillating") {
    recommendations.push(
      "Oscillating direction suggests prioritizing continuity metrics over single-cycle shifts when interpreting outlook.",
    );
  }

  if (operatorPosture === "leadership_visibility") {
    recommendations.push(
      "Leadership visibility posture is advisory context only — no automatic escalation or treasury execution.",
    );
  }

  return uniqueStrings(
    recommendations.map((item) => (isSmallDollar ? softenText(item, true) : item)),
  ).slice(0, 4);
}

/**
 * Pure advisory synthesis — treasury advisory outlook (Phase 3Z).
 * READ-ONLY: near-term advisory outlook from Phase 3 layers only — not forecasting or execution.
 * @param {object} args
 */
export function buildTreasuryAdvisoryOutlook({
  advisoryRegimeDetection,
  regimeDetection,
  advisoryDrift = {},
  recommendationStability = {},
  operationalCoherence = {},
  confidenceExplainability = {},
  leadershipReadiness = {},
  adaptiveReviewCadence = {},
  decisionSupport = {},
  decisionTrace = {},
  metaReasoning = {},
  institutionalMemory = {},
  scenarioResponse = {},
  attentionPriority = {},
  smallDollarEnvironment,
  liabilities,
  exposure,
} = {}) {
  try {
    const regime = advisoryRegimeDetection || regimeDetection || {};
    const isSmallDollar = resolveSmallDollar({ smallDollarEnvironment, liabilities, exposure });

    const outlookDirection = deriveOutlookDirection({
      regimeTrend: regime?.regimeTrend,
      driftDirection: advisoryDrift?.driftDirection,
      confidenceTrend: recommendationStability?.confidenceTrend,
    });

    const classificationContext = {
      regime,
      advisoryDrift,
      recommendationStability,
      operationalCoherence,
      adaptiveReviewCadence,
      attentionPriority,
      metaReasoning,
      institutionalMemory,
      decisionTrace,
      outlookDirection,
      outlookConfidence: 0,
    };

    let outlook = classifyTreasuryAdvisoryOutlook(classificationContext);

    const uncertainFactorCount = countUncertainOutlookFactors({
      regime,
      metaReasoning,
      institutionalMemory,
      decisionTrace,
      outlookConfidence: deriveOutlookConfidence({
        regime,
        advisoryDrift,
        recommendationStability,
        confidenceExplainability,
        uncertainFactorCount: countUncertainOutlookFactors({
          regime,
          metaReasoning,
          institutionalMemory,
          decisionTrace,
          outlookConfidence: 50,
        }),
        isSmallDollar,
      }),
    });

    let outlookConfidence = deriveOutlookConfidence({
      regime,
      advisoryDrift,
      recommendationStability,
      confidenceExplainability,
      uncertainFactorCount,
      isSmallDollar,
    });

    ({ outlook, outlookConfidence } = applySoftLaunchOutlookCaps({
      outlook,
      outlookConfidence,
      isSmallDollar,
      uncertainFactorCount,
    }));

    const operatorPosture = deriveOutlookOperatorPosture({
      outlook,
      regime,
      leadershipReadiness,
    });

    const signals = buildOutlookContributingSignals({
      regime,
      advisoryDrift,
      recommendationStability,
      operationalCoherence,
      adaptiveReviewCadence,
      metaReasoning,
      outlookDirection,
    });

    const outlookSummary = buildOutlookSummaryParagraph({
      outlook,
      outlookDirection,
      regime,
      recommendationStability,
      operationalCoherence,
      advisoryDrift,
      isSmallDollar,
    });

    const recommendations = buildOutlookAdvisoryRecommendations({
      outlook,
      outlookDirection,
      operatorPosture,
      isSmallDollar,
    });

    void decisionSupport;
    void scenarioResponse;
    void liabilities;
    void exposure;

    return {
      outlook,
      outlookConfidence,
      outlookDirection,
      operatorPosture,
      outlookSummary,
      signals,
      recommendations,
    };
  } catch (err) {
    warn({ op: "buildTreasuryAdvisoryOutlook", err: err?.message || String(err) });
    return { ...EMPTY_TREASURY_ADVISORY_OUTLOOK };
  }
}

export function formatTreasuryAdvisoryOutlookChipLabel(result) {
  const outlook = String(result?.outlook || "uncertain_outlook").toLowerCase();
  return `Treasury outlook: ${humanizeOutlookKey(outlook)}`;
}
