/**
 * Phase 11N: Pre-launch admin command center aggregator (read-only).
 *
 * Combines Compliance Checklist, Production Audit, KYC/withdrawal/treasury/fraud/security
 * metrics into a single launch readiness score. No wallet mutations or money movement.
 */

import { fetchComplianceChecklist, CHECKLIST_STATUS } from "./complianceChecklist";
import { fetchProductionAudit, AUDIT_STATUS } from "./productionAudit";
import { fetchTreasuryEvents, buildTreasuryEventSummary } from "./treasuryEventCenter";
import { fetchRiskCaseAnalytics } from "./riskReviewCases";
import { fetchAdminSecuritySignalCounts } from "./adminSecuritySignals";

import { supabase as defaultClient } from "./supabaseClient";

export const READINESS_CATEGORIES = Object.freeze([
  "environment",
  "kyc",
  "treasury",
  "security",
  "fraud",
  "legal",
  "deployment",
]);

export const READINESS_LABELS = Object.freeze({
  READY: "Ready",
  ALMOST_READY: "Almost Ready",
  NEEDS_ATTENTION: "Needs Attention",
  NOT_READY: "Not Ready",
});

const LEGAL_DOCS = [
  { id: "terms", label: "Terms of Service", path: "/legal/terms" },
  { id: "privacy", label: "Privacy Policy", path: "/legal/privacy" },
  { id: "aml", label: "AML Policy", path: "/legal/aml-policy" },
  { id: "kyc_policy", label: "KYC Policy", path: "/legal/kyc-policy" },
  { id: "risk_disclosure", label: "Risk Disclosure", path: "/legal/risk-disclosure" },
];

function truncate(text, max = 180) {
  const s = String(text == null ? "" : text);
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function startOfLocalDayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function scoreFromStatuses(statuses, { ready = 100, partial = 55, missing = 0 } = {}) {
  const list = Array.isArray(statuses) ? statuses.filter(Boolean) : [];
  if (list.length === 0) return 50;
  let sum = 0;
  for (const st of list) {
    const key = String(st).toLowerCase();
    if (key === CHECKLIST_STATUS.READY || key === AUDIT_STATUS.READY) sum += ready;
    else if (key === CHECKLIST_STATUS.PARTIAL || key === AUDIT_STATUS.PARTIAL) sum += partial;
    else sum += missing;
  }
  return Math.round(sum / list.length);
}

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}

/**
 * @param {number} score
 */
export function getReadinessLabel(score) {
  const n = clampScore(score);
  if (n >= 85) return READINESS_LABELS.READY;
  if (n >= 70) return READINESS_LABELS.ALMOST_READY;
  if (n >= 50) return READINESS_LABELS.NEEDS_ATTENTION;
  return READINESS_LABELS.NOT_READY;
}

function checklistSectionItems(checklist, sectionId) {
  const section = checklist?.sections?.find((s) => s.id === sectionId);
  return section?.items || [];
}

function auditSectionItems(audit, sectionId) {
  const section = audit?.sections?.find((s) => s.id === sectionId);
  return section?.items || [];
}

async function countTable(supabase, table, filters = []) {
  try {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    for (const f of filters) {
      if (f.op === "eq") q = q.eq(f.col, f.val);
      if (f.op === "gte") q = q.gte(f.col, f.val);
      if (f.op === "in") q = q.in(f.col, f.val);
    }
    const { count, error } = await q;
    if (error) return { count: null, error: truncate(error.message) };
    return { count: typeof count === "number" ? count : 0, error: null };
  } catch (err) {
    return { count: null, error: truncate(err?.message || "Count failed.") };
  }
}

async function fetchKycMetrics(supabase) {
  const statuses = ["submitted", "under_review", "approved", "rejected", "needs_more_info"];
  const dayStart = startOfLocalDayIso();
  const [totalRes, ...statusRes] = await Promise.all([
    countTable(supabase, "kyc_profiles"),
    ...statuses.map((status) => countTable(supabase, "kyc_profiles", [{ op: "eq", col: "status", val: status }])),
  ]);

  const byStatus = {};
  statuses.forEach((status, i) => {
    byStatus[status] = statusRes[i]?.count;
  });

  return {
    totalProfiles: totalRes.count,
    submitted: byStatus.submitted,
    underReview: byStatus.under_review,
    approved: byStatus.approved,
    rejected: byStatus.rejected,
    needsMoreInfo: byStatus.needs_more_info,
    error: totalRes.error || statusRes.find((r) => r.error)?.error || null,
    asOf: dayStart,
  };
}

async function fetchWithdrawalMetrics(supabase) {
  const dayStart = startOfLocalDayIso();
  const since7d = new Date(Date.now() - 7 * 86400000).toISOString();

  const [pending, processing, paidToday, kycBlocked, overLimitAttempts] = await Promise.all([
    countTable(supabase, "withdrawal_requests", [{ op: "eq", col: "status", val: "pending" }]),
    countTable(supabase, "withdrawal_requests", [{ op: "eq", col: "status", val: "processing" }]),
    countTable(supabase, "withdrawal_requests", [
      { op: "eq", col: "status", val: "paid" },
      { op: "gte", col: "updated_at", val: dayStart },
    ]),
    countTable(supabase, "admin_audit_logs", [{ op: "eq", col: "action", val: "kyc_withdrawal_server_blocked" }]),
    countTable(supabase, "admin_audit_logs", [
      { op: "eq", col: "action", val: "kyc_withdrawal_server_blocked" },
      { op: "gte", col: "created_at", val: since7d },
    ]),
  ]);

  return {
    pending: pending.count,
    processing: processing.count,
    paidToday: paidToday.count,
    blockedByKyc: kycBlocked.count,
    overLimitAttempts7d: overLimitAttempts.count,
    error:
      pending.error ||
      processing.error ||
      paidToday.error ||
      kycBlocked.error ||
      overLimitAttempts.error ||
      null,
  };
}

async function fetchFraudMetrics(supabase) {
  const [openInvestigations, escalated, highRiskLogs, openSmartAlerts] = await Promise.all([
    countTable(supabase, "fraud_logs", [{ op: "eq", col: "status", val: "open" }]),
    countTable(supabase, "fraud_logs", [{ op: "eq", col: "status", val: "escalated" }]),
    countTable(supabase, "fraud_logs", [
      { op: "in", col: "risk_level", val: ["high", "critical"] },
      { op: "in", col: "status", val: ["open", "escalated"] },
    ]),
    countTable(supabase, "smart_alerts", [{ op: "eq", col: "status", val: "open" }]),
  ]);

  return {
    openInvestigations: openInvestigations.count,
    escalatedInvestigations: escalated.count,
    highRiskAlerts: highRiskLogs.count,
    openSmartAlerts: openSmartAlerts.count,
    error: openInvestigations.error || escalated.error || highRiskLogs.error || openSmartAlerts.error || null,
  };
}

async function fetchSecurityMetrics(supabase) {
  const since7d = new Date(Date.now() - 7 * 86400000).toISOString();
  const signals = await fetchAdminSecuritySignalCounts(supabase);
  const recent = await countTable(supabase, "security_events", [{ op: "gte", col: "created_at", val: since7d }]);

  return {
    recentSecurityEvents7d: recent.count,
    highSeverityEvents: signals.highSeverityEvents,
    suspiciousLogins7d: signals.suspiciousLoginsLast7d,
    unresolvedEstimate:
      typeof signals.highSeverityEvents === "number" ? signals.highSeverityEvents : recent.count,
    error: signals.error || recent.error || null,
  };
}

async function fetchLegalDocStatuses() {
  const results = await Promise.all(
    LEGAL_DOCS.map(async (doc) => {
      try {
        const res = await fetch(doc.path, { credentials: "same-origin" });
        if (!res.ok) {
          return { ...doc, status: "Missing", detail: `HTTP ${res.status}` };
        }
        return { ...doc, status: "Draft", detail: "Page reachable — draft pending legal review." };
      } catch (err) {
        return { ...doc, status: "Missing", detail: truncate(err?.message || "Fetch failed.") };
      }
    }),
  );
  return results;
}

function buildProductionChecks(audit) {
  const find = (id) => {
    for (const section of audit?.sections || []) {
      const item = section.items?.find((i) => i.id === id);
      if (item) return item;
    }
    return null;
  };

  const group = (ids) => ids.map(find).filter(Boolean);

  return {
    supabase: group(["env_supabase_url", "env_supabase_anon_key", "supabase_client_init"]),
    paypal: group(["env_paypal_client_id", "env_paypal_mode", "paypal_client_id_configured", "paypal_mode_configured"]),
    pwa: group(["pwa_manifest", "pwa_service_worker"]),
    storage: group(["kyc_documents_bucket"]),
    deployment: group(["admin_health_page", "compliance_checklist_page", "production_audit_page", "node_env"]),
  };
}

function computeCategoryScores({ checklist, audit, kyc, withdrawals, treasurySummary, riskCases, security, fraud }) {
  const kycChecklist = checklistSectionItems(checklist, "kyc").map((i) => i.status);
  let kycScore = scoreFromStatuses(kycChecklist);
  const reviewBacklog = (kyc.underReview ?? 0) + (kyc.submitted ?? 0);
  if (reviewBacklog > 20) kycScore = clampScore(kycScore - 15);
  else if (reviewBacklog > 5) kycScore = clampScore(kycScore - 8);

  const envAudit = [
    ...auditSectionItems(audit, "environment_variables"),
    ...auditSectionItems(audit, "supabase_configuration"),
    ...auditSectionItems(audit, "paypal_configuration"),
  ].map((i) => i.status);
  const environmentScore = scoreFromStatuses(envAudit);

  const treasuryChecklist = checklistSectionItems(checklist, "treasury").map((i) => i.status);
  let treasuryScore = scoreFromStatuses(treasuryChecklist);
  const critical = treasurySummary?.criticalEvents ?? 0;
  const warnings = treasurySummary?.warningEvents ?? 0;
  treasuryScore = clampScore(treasuryScore - critical * 12 - Math.min(warnings, 10) * 2);
  if ((riskCases?.escalated ?? 0) > 0) treasuryScore = clampScore(treasuryScore - riskCases.escalated * 5);
  if ((riskCases?.open ?? 0) > 3) treasuryScore = clampScore(treasuryScore - 8);

  const securityChecklist = checklistSectionItems(checklist, "security").map((i) => i.status);
  let securityScore = scoreFromStatuses(securityChecklist);
  if ((security.highSeverityEvents ?? 0) > 0) {
    securityScore = clampScore(securityScore - Math.min(security.highSeverityEvents * 5, 25));
  }

  const fraudChecklist = checklistSectionItems(checklist, "fraud_risk").map((i) => i.status);
  let fraudScore = scoreFromStatuses(fraudChecklist);
  const openFraud = (fraud.openInvestigations ?? 0) + (fraud.escalatedInvestigations ?? 0);
  fraudScore = clampScore(fraudScore - Math.min(openFraud * 4, 30) - Math.min(fraud.highRiskAlerts ?? 0, 5) * 3);

  const legalChecklist = checklistSectionItems(checklist, "legal").map((i) => i.status);
  const legalScore = scoreFromStatuses(legalChecklist, { ready: 100, partial: 48, missing: 0 });

  const deploymentAudit = [
    ...auditSectionItems(audit, "pwa_readiness"),
    ...auditSectionItems(audit, "kyc_storage"),
    ...auditSectionItems(audit, "deployment_readiness"),
    ...checklistSectionItems(checklist, "production"),
  ].map((i) => i.status);
  const deploymentScore = scoreFromStatuses(deploymentAudit);

  return {
    environment: environmentScore,
    kyc: kycScore,
    treasury: treasuryScore,
    security: securityScore,
    fraud: fraudScore,
    legal: legalScore,
    deployment: deploymentScore,
  };
}

/**
 * @param {{ supabase?: import('@supabase/supabase-js').SupabaseClient }} opts
 */
export async function fetchLaunchReadiness({ supabase } = {}) {
  const client = supabase || defaultClient;

  const [checklist, audit, kyc, withdrawals, treasuryBundle, riskCases, security, fraud, legalDocs] =
    await Promise.all([
      fetchComplianceChecklist({ supabase: client }),
      fetchProductionAudit({ supabase: client }),
      fetchKycMetrics(client),
      fetchWithdrawalMetrics(client),
      fetchTreasuryEvents(client, { limit: 120, perSourceLimit: 30 }),
      fetchRiskCaseAnalytics(client),
      fetchSecurityMetrics(client),
      fetchFraudMetrics(client),
      fetchLegalDocStatuses(),
    ]);

  const treasurySummary = buildTreasuryEventSummary(treasuryBundle.events || []);
  const productionChecks = buildProductionChecks(audit);

  const categoryScores = computeCategoryScores({
    checklist,
    audit,
    kyc,
    withdrawals,
    treasurySummary,
    riskCases,
    security,
    fraud,
  });

  const categoryEntries = READINESS_CATEGORIES.map((id) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    score: categoryScores[id],
    labelStatus: getReadinessLabel(categoryScores[id]),
  }));

  const overallScore = clampScore(
    categoryEntries.reduce((acc, c) => acc + c.score, 0) / Math.max(categoryEntries.length, 1),
  );

  return {
    generatedAt: new Date().toISOString(),
    readOnly: true,
    overallScore,
    overallLabel: getReadinessLabel(overallScore),
    scoringMethod:
      "Each category scores 0–100 from checklist/audit item status (ready=100, partial=55, missing=0) with operational penalties for critical treasury events, fraud backlog, and security signals. Overall score is the unweighted average of all seven categories.",
    categoryScores: categoryEntries,
    checklistSummary: checklist.summary,
    auditSummary: audit.summary,
    sections: {
      kyc: {
        title: "KYC",
        metrics: kyc,
        href: "/admin/kyc",
      },
      withdrawals: {
        title: "Withdrawals",
        metrics: withdrawals,
        href: "/admin/withdrawals",
      },
      treasury: {
        title: "Treasury",
        metrics: {
          openCases: riskCases.open ?? null,
          escalatedCases: riskCases.escalated ?? null,
          criticalEvents: treasurySummary.criticalEvents,
          warnings: treasurySummary.warningEvents,
          totalEvents: treasurySummary.totalEvents,
        },
        summary: treasurySummary.summary,
        href: "/admin/treasury-intelligence",
      },
      security: {
        title: "Security",
        metrics: security,
        href: "/admin/security",
      },
      fraud: {
        title: "Fraud",
        metrics: fraud,
        href: "/admin/fraud-queue",
      },
      legal: {
        title: "Legal",
        documents: legalDocs,
        href: "/legal",
      },
      production: {
        title: "Production",
        checks: productionChecks,
        href: "/admin/production-audit",
      },
    },
    links: {
      complianceChecklist: "/admin/compliance-checklist",
      productionAudit: "/admin/production-audit",
      treasuryEventCenter: "/admin/treasury-intelligence",
    },
  };
}

export function readinessLabelColor(label) {
  const key = String(label || "");
  if (key === READINESS_LABELS.READY) return { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" };
  if (key === READINESS_LABELS.ALMOST_READY) return { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" };
  if (key === READINESS_LABELS.NEEDS_ATTENTION) return { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" };
  return { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" };
}
