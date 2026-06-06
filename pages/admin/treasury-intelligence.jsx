import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import TreasuryIntelligenceGroup from "../../components/admin/treasury/TreasuryIntelligenceGroup";
import TreasuryIntelligenceQuickNav from "../../components/admin/treasury/TreasuryIntelligenceQuickNav";
import TreasurySectionShell, {
  treasurySectionStatusMessage,
} from "../../components/admin/treasury/TreasurySectionShell";
import { treasuryFocusRingClass, cardBase, sectionHeading, treasuryBadgeStyle, treasurySectionStyle, treasuryExecutiveSectionStyle, treasurySectionIntroStyle, treasuryKpiGridStyle, treasuryKpiGridMediumStyle, treasuryKpiGridWideStyle, treasurySummaryTextStyle, treasurySummaryLabelStyle, treasurySummaryBlockStyle, treasuryPanelHighlightStyle, treasuryListStyle, treasuryListItemStyle, treasuryKpiLabelStyle, treasuryKpiCardStyle, treasuryInnerKpiTileStyle, treasuryCardPaddingStyle } from "../../components/admin/treasury/treasuryStyles";
import {
  deriveExecutiveGroupStatus,
  deriveForecastGroupStatus,
  deriveHealthGroupStatus,
  deriveReportsGroupStatus,
  deriveRiskGroupStatus,
} from "../../components/admin/treasury/groupStatus";

import {
  calculateTreasuryExplainability,
  buildTreasuryBoardTimeline,
  buildTreasuryCommandCenter,
  buildTreasuryExecutiveBriefing,
  buildTreasuryNarrative,
  buildTreasuryIntelligenceReport,
  buildTreasuryMonitoringDashboard,
  calculateTreasuryExecutiveSummary,
  calculateTreasuryHistoricalAnalytics,
  calculateTreasuryHealth,
  calculateTreasuryForecast,
  calculateTreasuryOperationalGuidance,
  calculateTreasuryReadiness,
  calculateTreasuryStability,
  calculateTreasuryScalingReadiness,
  calculateTreasuryIntegrity,
  calculateTreasuryGovernance,
  calculateTreasuryOperatingMode,
  calculateTreasuryReadinessIndex,
  calculateUnifiedTreasuryScore,
  detectTreasuryDrift,
  calculateTreasuryResilience,
  calculateTreasuryScenarios,
  calculateTreasuryTrends,
  classifyTreasuryAlerts,
  fetchTreasuryAlerts,
  fetchTreasuryHealthHistory,
  formatTreasuryReportAsText,
  formatTreasuryWarningTitle,
  saveTreasuryHealthSnapshot,
  simulateTreasuryDecision,
} from "../../lib/treasuryIntelligence";
import {
  assessTreasuryAlertReadiness,
  buildTreasuryAdminAlerts,
  buildTreasuryConfidenceExplainability,
  buildTreasuryConsistencyCheck,
  buildTreasuryDigestIntelligence,
  buildTreasuryDecisionSupport,
  buildTreasuryExecutiveEscalation,
  buildTreasuryInstitutionalMemory,
  buildTreasuryMonitoringSignals,
  buildTreasuryNotificationReadiness,
  buildTreasuryRiskNarrative,
  buildTreasuryOperationalPlaybook,
  buildTreasuryScenarioResponse,
  buildTreasuryOperatorTimeline,
  buildTreasuryAttentionPriority,
  buildTreasuryOperationalCoherence,
  buildTreasuryAdaptiveReviewCadence,
  buildTreasuryLeadershipReadiness,
  buildTreasuryMetaReasoning,
  buildTreasuryDecisionTrace,
  buildTreasuryRecommendationStability,
  buildTreasuryAdvisoryDrift,
  buildTreasuryRegimeDetection,
  buildTreasuryAdvisoryOutlook,
  emitTreasuryMonitoringEvents,
  fetchTreasuryOperationalEvents,
  logTreasuryOperationalEvent,
} from "../../lib/treasuryOperations";
import {
  TREASURY_EVENT_CATEGORIES,
  TREASURY_EVENT_SOURCES,
  TREASURY_EVENT_SEVERITIES,
  buildTreasuryEventHealth,
  buildTreasuryEventSummary,
  createTreasuryEventInvestigationNote,
  fetchTreasuryEventInvestigationNotes,
  fetchTreasuryEventResolution,
  fetchTreasuryEventResolutionsMap,
  fetchTreasuryEvents,
  sanitizeTreasuryEventMetadataForDisplay,
  TREASURY_EVENT_RESOLUTION_STATUSES,
  upsertTreasuryEventResolution,
} from "../../lib/treasuryEventCenter";

const pageWrap = {
  padding: "1.25rem 1rem 2.5rem",
  maxWidth: "1100px",
  width: "100%",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "transparent",
  boxSizing: "border-box",
  overflowX: "hidden",
};

const btnOption = {
  padding: "0.28rem 0.5rem",
  fontSize: "0.68rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  cursor: "pointer",
  fontWeight: 600,
  color: "#475569",
};

const btnOptionActive = {
  ...btnOption,
  border: "1px solid #0ea5e9",
  background: "#f0f9ff",
  color: "#0369a1",
};

const SIM_LIABILITY_MULT = [1, 1.5, 2];
const SIM_EXPOSURE_MULT = [1, 2, 3];
const SIM_FUNDING_SLOWDOWN = [0, 25, 50];
const SIM_RECON_ISSUES = [0, 1, 3, 5];
const SIM_WITHDRAWAL_SPIKE = [0, 25, 50, 100];

const btnSm = {
  padding: "0.32rem 0.55rem",
  fontSize: "0.68rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
  marginTop: "0.25rem",
};

function formatMoney(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return `$${safe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function humanize(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function treasuryEventSeverityLabel(severity) {
  const key = String(severity || "").toLowerCase();
  if (key === "critical") return "Critical";
  if (key === "warning") return "Warning";
  return "Informational";
}

function treasuryResolutionStatusBadge(status) {
  const key = String(status || "open").toLowerCase();
  const styles = {
    open: { bg: "#fef3c7", fg: "#92400e", border: "#fde68a" },
    reviewing: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    escalated: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    resolved: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
    dismissed: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.open;
  return treasuryBadgeStyle(pal);
}

function treasuryResolutionStatusLabel(status) {
  return humanize(status || "open");
}

function flattenMetadataEntries(metadata, prefix = "") {
  const entries = [];
  const obj = metadata && typeof metadata === "object" ? metadata : {};
  for (const [key, value] of Object.entries(obj)) {
    const label = prefix ? `${prefix}.${key}` : key;
    if (value != null && typeof value === "object" && !Array.isArray(value)) {
      entries.push(...flattenMetadataEntries(value, label));
    } else if (Array.isArray(value)) {
      entries.push([label, value.length ? JSON.stringify(value) : "[]"]);
    } else {
      entries.push([label, value == null ? "—" : String(value)]);
    }
  }
  return entries;
}

function withdrawalReviewHrefFromTreasuryEvent(event) {
  if (!event) return null;
  const source = String(event.source || "").toLowerCase();
  if (source !== "withdrawal_requests") return null;
  const rawId = String(event.id || "");
  const prefix = "withdrawal:";
  if (rawId.startsWith(prefix)) {
    const withdrawalId = rawId.slice(prefix.length).trim();
    if (withdrawalId) return `/admin/withdrawals?withdrawalId=${encodeURIComponent(withdrawalId)}`;
  }
  const metaId = event.metadata?.withdrawalRequestId || event.metadata?.withdrawal_request_id;
  if (metaId) return `/admin/withdrawals?withdrawalId=${encodeURIComponent(String(metaId))}`;
  return null;
}

function riskLevelBadge(level) {
  const key = String(level || "").toLowerCase();
  const styles = {
    critical: { bg: "#450a0a", fg: "#fecaca", border: "#7f1d1d" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    medium: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    low: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
  };
  const pal = styles[key] || styles.low;
  return treasuryBadgeStyle(pal);
}

function severityBadge(severity) {
  const key = String(severity || "").toLowerCase();
  const styles = {
    critical: { bg: "#450a0a", fg: "#fecaca", border: "#7f1d1d" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    medium: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    low: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.low;
  return treasuryBadgeStyle(pal);
}

function scoreColor(score) {
  const n = Number(score) || 0;
  if (n >= 80) return "#047857";
  if (n >= 60) return "#92400e";
  if (n >= 40) return "#b91c1c";
  return "#7f1d1d";
}

function trendStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    stable: "Stable",
    improving: "Improving",
    deteriorating: "Deteriorating",
    insufficient_data: "Insufficient data",
  };
  return labels[key] || "Unknown";
}

function trendStatusColor(status) {
  const key = String(status || "").toLowerCase();
  if (key === "improving") return "#047857";
  if (key === "deteriorating") return "#b91c1c";
  if (key === "stable") return "#0f172a";
  return "#64748b";
}

function historicalTrendLabel(direction) {
  const key = String(direction || "").toLowerCase();
  const labels = {
    improving: "Improving",
    deteriorating: "Deteriorating",
    weakening: "Weakening",
    stable: "Stable",
    growth: "Growth",
    decline: "Decline",
    escalating: "Escalating",
    de_escalating: "De-escalating",
    "de-escalating": "De-escalating",
    mixed: "Mixed",
    insufficient_data: "Insufficient data",
    unknown: "Unknown",
  };
  return labels[key] || trendStatusLabel(direction);
}

function historicalTrendColor(direction) {
  const key = String(direction || "").toLowerCase();
  if (key === "improving" || key === "growth" || key === "de_escalating" || key === "de-escalating") return "#047857";
  if (key === "deteriorating" || key === "decline" || key === "escalating" || key === "weakening") return "#b91c1c";
  if (key === "stable") return "#0f172a";
  if (key === "mixed") return "#92400e";
  return "#64748b";
}

function treasuryMomentumLabel(momentum) {
  const key = String(momentum || "").toLowerCase();
  const labels = {
    stable: "Stable",
    improving: "Improving",
    weakening: "Weakening",
    mixed: "Mixed",
  };
  return labels[key] || "Unknown";
}

function readinessLevelLabel(level) {
  const key = String(level || "").toLowerCase();
  const labels = {
    resilient: "Resilient",
    strong: "Strong",
    operational: "Operational",
    developing: "Developing",
    not_ready: "Not ready",
  };
  return labels[key] || "Unknown";
}

function readinessLevelColor(level) {
  const key = String(level || "").toLowerCase();
  if (key === "resilient" || key === "strong") return "#047857";
  if (key === "operational") return "#0f766e";
  if (key === "developing") return "#92400e";
  return "#64748b";
}

function readinessLevelBadge(level) {
  const key = String(level || "").toLowerCase();
  const styles = {
    resilient: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    strong: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    operational: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    developing: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    not_ready: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.not_ready;
  return treasuryBadgeStyle(pal);
}

function operatingPostureLabel(posture) {
  const key = String(posture || "").toLowerCase();
  const labels = {
    normal_monitoring: "Normal monitoring",
    increased_monitoring: "Increased monitoring",
    elevated_attention: "Elevated attention",
    active_review: "Active review",
  };
  return labels[key] || "Unknown";
}

function operatingPostureColor(posture) {
  const key = String(posture || "").toLowerCase();
  if (key === "normal_monitoring") return "#047857";
  if (key === "increased_monitoring") return "#0f766e";
  if (key === "elevated_attention") return "#92400e";
  return "#b45309";
}

function operatingPostureBadge(posture) {
  const key = String(posture || "").toLowerCase();
  const styles = {
    normal_monitoring: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    increased_monitoring: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    elevated_attention: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    active_review: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.increased_monitoring;
  return treasuryBadgeStyle(pal);
}

function treasuryJourneyLabel(journey) {
  const key = String(journey || "").toLowerCase();
  const labels = {
    stabilizing: "Stabilizing",
    stable: "Stable",
    strengthening: "Strengthening",
    mixed: "Mixed",
    weakening: "Weakening",
  };
  return labels[key] || "Unknown";
}

function treasuryJourneyBadge(journey) {
  const key = String(journey || "").toLowerCase();
  const styles = {
    strengthening: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    stabilizing: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    stable: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    mixed: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    weakening: { bg: "#fef2f2", fg: "#b91c1c", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.stable;
  return treasuryBadgeStyle(pal);
}

function boardMomentumLabel(momentum) {
  const key = String(momentum || "").toLowerCase();
  const labels = {
    improving: "Improving",
    stable: "Stable",
    variable: "Variable",
    deteriorating: "Deteriorating",
  };
  return labels[key] || "Unknown";
}

function boardMomentumBadge(momentum) {
  const key = String(momentum || "").toLowerCase();
  const styles = {
    improving: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    stable: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    variable: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    deteriorating: { bg: "#fef2f2", fg: "#b91c1c", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.stable;
  return treasuryBadgeStyle(pal);
}

function narrativeToneLabel(tone) {
  const key = String(tone || "").toLowerCase();
  const labels = {
    calm: "Calm",
    stable: "Stable",
    cautious: "Cautious",
    elevated_attention: "Elevated attention",
  };
  return labels[key] || "Unknown";
}

function narrativeToneBadge(tone) {
  const key = String(tone || "").toLowerCase();
  const styles = {
    calm: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    stable: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    cautious: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated_attention: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.stable;
  return treasuryBadgeStyle(pal);
}

function narrativeOutlookLabel(outlook) {
  const key = String(outlook || "").toLowerCase();
  const labels = {
    improving: "Improving",
    stable: "Stable",
    mixed: "Mixed",
    cautious: "Cautious",
  };
  return labels[key] || "Unknown";
}

function narrativeOutlookBadge(outlook) {
  const key = String(outlook || "").toLowerCase();
  const styles = {
    improving: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    stable: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    mixed: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    cautious: { bg: "#fef2f2", fg: "#b91c1c", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.stable;
  return treasuryBadgeStyle(pal);
}

function briefingExecutiveStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    healthy: "Healthy",
    stable: "Stable",
    monitored: "Monitored",
    elevated_attention: "Elevated attention",
  };
  return labels[key] || "Unknown";
}

function briefingExecutiveStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    healthy: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
    stable: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    monitored: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated_attention: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.stable;
  return treasuryBadgeStyle(pal);
}

function briefingExecutivePriorityLabel(priority) {
  const key = String(priority || "").toLowerCase();
  const labels = {
    maintain_monitoring: "Maintain monitoring",
    monitor_growth: "Monitor growth",
    review_risk_signals: "Review risk signals",
    elevated_review: "Elevated review",
  };
  return labels[key] || "Unknown";
}

function briefingExecutivePriorityBadge(priority) {
  const key = String(priority || "").toLowerCase();
  const styles = {
    maintain_monitoring: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    monitor_growth: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    review_risk_signals: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated_review: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.maintain_monitoring;
  return treasuryBadgeStyle(pal);
}

function briefingExecutiveOutlookLabel(outlook) {
  const key = String(outlook || "").toLowerCase();
  const labels = {
    improving: "Improving",
    stable: "Stable",
    mixed: "Mixed",
    cautious: "Cautious",
  };
  return labels[key] || "Unknown";
}

function briefingExecutiveOutlookBadge(outlook) {
  const key = String(outlook || "").toLowerCase();
  const styles = {
    improving: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    stable: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    mixed: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    cautious: { bg: "#fef2f2", fg: "#b91c1c", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.stable;
  return treasuryBadgeStyle(pal);
}

function readinessIndexLaunchSignalLabel(signal) {
  const key = String(signal || "").toLowerCase();
  const labels = {
    hold_position: "Hold position",
    soft_launch_ready: "Soft launch ready",
    monitored_growth_ready: "Monitored growth ready",
    elevated_monitoring: "Elevated monitoring",
  };
  return labels[key] || "Unknown";
}

function readinessIndexLaunchSignalBadge(signal) {
  const key = String(signal || "").toLowerCase();
  const styles = {
    hold_position: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    soft_launch_ready: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitored_growth_ready: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    elevated_monitoring: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
  };
  const pal = styles[key] || styles.hold_position;
  return treasuryBadgeStyle(pal);
}

function readinessIndexLaunchPostureLabel(posture) {
  const key = String(posture || "").toLowerCase();
  const labels = {
    continue_testing: "Continue testing",
    controlled_soft_launch: "Controlled soft launch",
    monitored_growth: "Monitored growth",
    elevated_review: "Elevated review",
  };
  return labels[key] || "Unknown";
}

function readinessIndexLaunchPostureBadge(posture) {
  const key = String(posture || "").toLowerCase();
  const styles = {
    continue_testing: { bg: "#f1f5f9", fg: "#475569", border: "#e2e8f0" },
    controlled_soft_launch: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitored_growth: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    elevated_review: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.continue_testing;
  return treasuryBadgeStyle(pal);
}

function readinessIndexDriverTypeLabel(type) {
  const key = String(type || "").toLowerCase();
  const labels = {
    health: "Health",
    governance: "Governance",
    stability: "Stability",
    integrity: "Integrity",
  };
  return labels[key] || "Signal";
}

function readinessIndexDriverTypeBadge(type) {
  const key = String(type || "").toLowerCase();
  const styles = {
    health: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    governance: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    stability: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    integrity: { bg: "#faf5ff", fg: "#7e22ce", border: "#e9d5ff" },
  };
  const pal = styles[key] || { bg: "#f1f5f9", fg: "#475569", border: "#e2e8f0" };
  return treasuryBadgeStyle(pal);
}

function commandCenterStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    stable: "Stable",
    monitored: "Monitored",
    elevated_attention: "Elevated attention",
    active_review: "Active review",
  };
  return labels[key] || "Unknown";
}

function commandCenterStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    stable: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
    monitored: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated_attention: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    active_review: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.monitored;
  return treasuryBadgeStyle(pal);
}

function commandCenterOperatingPictureLabel(picture) {
  const key = String(picture || "").toLowerCase();
  const labels = {
    stable_soft_launch: "Stable soft launch",
    monitored_growth: "Monitored growth",
    cautious_launch: "Cautious launch",
    elevated_monitoring: "Elevated monitoring",
  };
  return labels[key] || "Unknown";
}

function commandCenterOperatingPictureBadge(picture) {
  const key = String(picture || "").toLowerCase();
  const styles = {
    stable_soft_launch: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitored_growth: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    cautious_launch: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated_monitoring: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.cautious_launch;
  return treasuryBadgeStyle(pal);
}

function commandCenterPriorityLevelLabel(level) {
  const key = String(level || "").toLowerCase();
  const labels = {
    low: "Low",
    moderate: "Moderate",
    elevated: "Elevated",
    high: "High",
  };
  return labels[key] || "Unknown";
}

function commandCenterPriorityLevelBadge(level) {
  const key = String(level || "").toLowerCase();
  const styles = {
    low: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    moderate: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    elevated: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.moderate;
  return treasuryBadgeStyle(pal);
}

function commandCenterAttentionSignalLabel(signal) {
  const key = String(signal || "").toLowerCase();
  const labels = {
    routine_monitoring: "Routine monitoring",
    increased_review: "Increased review",
    elevated_attention: "Elevated attention",
    active_oversight: "Active oversight",
  };
  return labels[key] || "Unknown";
}

function commandCenterAttentionSignalBadge(signal) {
  const key = String(signal || "").toLowerCase();
  const styles = {
    routine_monitoring: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    increased_review: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    elevated_attention: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    active_oversight: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.increased_review;
  return treasuryBadgeStyle(pal);
}

function commandCenterHealthSignalLabel(signal) {
  const key = String(signal || "").toLowerCase();
  const labels = {
    watch: "Watch",
    stable: "Stable",
    healthy: "Healthy",
    resilient: "Resilient",
  };
  return labels[key] || "Unknown";
}

function commandCenterHealthSignalBadge(signal) {
  const key = String(signal || "").toLowerCase();
  const styles = {
    watch: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    stable: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    healthy: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    resilient: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
  };
  const pal = styles[key] || styles.watch;
  return treasuryBadgeStyle(pal);
}

function treasuryOperatingStateLabel(state) {
  const key = String(state || "").toLowerCase();
  const labels = {
    normal_monitoring: "Normal monitoring",
    elevated_monitoring: "Elevated monitoring",
    review_attention: "Review attention",
  };
  return labels[key] || "Unknown";
}

function treasuryOperatingStateBadge(state) {
  const key = String(state || "").toLowerCase();
  const styles = {
    normal_monitoring: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    elevated_monitoring: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    review_attention: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.normal_monitoring;
  return treasuryBadgeStyle(pal);
}

function treasuryAttentionLevelLabel(level) {
  const key = String(level || "").toLowerCase();
  const labels = {
    low: "Low",
    moderate: "Moderate",
    elevated: "Elevated",
    high: "High",
  };
  return labels[key] || "Unknown";
}

function treasuryAttentionLevelBadge(level) {
  const key = String(level || "").toLowerCase();
  const styles = {
    low: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
    moderate: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.moderate;
  return treasuryBadgeStyle(pal);
}

function treasuryEventSeverityBadge(severity) {
  const key = String(severity || "").toLowerCase();
  const styles = {
    info: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
    informational: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
    low: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
    moderate: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    warning: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    critical: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.info;
  return treasuryBadgeStyle(pal);
}

function alertReadinessStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    quiet: "Quiet",
    watch: "Watch",
    ready_to_alert: "Ready to alert",
    escalation_recommended: "Escalation recommended",
  };
  return labels[key] || "Unknown";
}

function alertReadinessStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    quiet: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    watch: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    ready_to_alert: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    escalation_recommended: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.quiet;
  return treasuryBadgeStyle(pal);
}

function alertReadinessPostureLabel(posture) {
  const key = String(posture || "").toLowerCase();
  const labels = {
    no_alert: "No alert",
    monitor_only: "Monitor only",
    prepare_admin_alert: "Prepare admin alert",
    prepare_escalation: "Prepare escalation",
  };
  return labels[key] || "Unknown";
}

function alertReadinessPostureBadge(posture) {
  const key = String(posture || "").toLowerCase();
  const styles = {
    no_alert: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
    monitor_only: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    prepare_admin_alert: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    prepare_escalation: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.no_alert;
  return treasuryBadgeStyle(pal);
}

function alertReadinessPriorityLabel(priority) {
  const key = String(priority || "").toLowerCase();
  const labels = { low: "Low", moderate: "Moderate", elevated: "Elevated", high: "High" };
  return labels[key] || "Unknown";
}

function alertReadinessPriorityBadge(priority) {
  const key = String(priority || "").toLowerCase();
  const styles = {
    low: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
    moderate: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.low;
  return treasuryBadgeStyle(pal);
}

function treasuryAdminAlertPostureLabel(posture) {
  const key = String(posture || "").toLowerCase();
  const labels = {
    quiet: "Quiet",
    monitoring: "Monitoring",
    elevated_attention: "Elevated attention",
    active_review: "Active review",
  };
  return labels[key] || "Unknown";
}

function treasuryAdminAlertPostureBadge(posture) {
  const key = String(posture || "").toLowerCase();
  const styles = {
    quiet: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitoring: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated_attention: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    active_review: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.quiet;
  return treasuryBadgeStyle(pal);
}

function treasuryAdminAlertStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    monitoring: "Monitoring",
    review: "Review",
    elevated_attention: "Elevated attention",
  };
  return labels[key] || "Monitoring";
}

function treasuryAdminAlertStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    monitoring: { bg: "#f1f5f9", fg: "#475569", border: "#e2e8f0" },
    review: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    elevated_attention: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.monitoring;
  return treasuryBadgeStyle(pal);
}

function recommendedAlertChannelLabel(channel) {
  const key = String(channel || "").toLowerCase();
  const labels = {
    none: "None",
    in_app_admin: "In-app admin",
    admin_digest: "Admin digest",
    future_email: "Future email (not sent)",
  };
  return labels[key] || "Unknown";
}

function recommendedAlertChannelBadge(channel) {
  const key = String(channel || "").toLowerCase();
  const styles = {
    none: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
    in_app_admin: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    admin_digest: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    future_email: { bg: "#fae8ff", fg: "#7e22ce", border: "#e9d5ff" },
  };
  const pal = styles[key] || styles.none;
  return treasuryBadgeStyle(pal);
}

function notificationReadinessStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    quiet: "Quiet",
    monitoring: "Monitoring",
    digest_ready: "Digest-ready",
    escalation_ready: "Escalation-ready",
  };
  return labels[key] || "Unknown";
}

function notificationReadinessStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    quiet: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitoring: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    digest_ready: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    escalation_ready: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.quiet;
  return treasuryBadgeStyle(pal);
}

function recommendedNotificationPostureLabel(posture) {
  const key = String(posture || "").toLowerCase();
  const labels = {
    none: "None",
    advisory_only: "Advisory only",
    prepare_digest: "Prepare digest",
    prepare_escalation: "Prepare escalation",
  };
  return labels[key] || "Unknown";
}

function recommendedNotificationPostureBadge(posture) {
  const key = String(posture || "").toLowerCase();
  const styles = {
    none: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
    advisory_only: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    prepare_digest: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    prepare_escalation: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.none;
  return treasuryBadgeStyle(pal);
}

function recommendedNotificationChannelLabel(channel) {
  const key = String(channel || "").toLowerCase();
  const labels = {
    none: "None (not sent)",
    admin_in_app: "Admin in-app (not sent)",
    executive_digest: "Executive digest (not sent)",
    future_email: "Future email (not sent)",
    future_sms: "Future SMS (not sent)",
  };
  return labels[key] || "Unknown (not sent)";
}

function recommendedNotificationChannelBadge(channel) {
  const key = String(channel || "").toLowerCase();
  const styles = {
    none: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
    admin_in_app: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    executive_digest: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    future_email: { bg: "#fae8ff", fg: "#7e22ce", border: "#e9d5ff" },
    future_sms: { bg: "#fff1f2", fg: "#9f1239", border: "#fecdd3" },
  };
  const pal = styles[key] || styles.none;
  return treasuryBadgeStyle(pal);
}

function notificationRoutingAudienceLabel(audience) {
  const key = String(audience || "").toLowerCase();
  const labels = {
    treasury_admin: "Treasury admin",
    operations_lead: "Operations lead",
    executive_leadership: "Executive leadership",
  };
  return labels[key] || audience || "Unknown";
}

function notificationRoutingUrgencyBadge(urgency) {
  const key = String(urgency || "").toLowerCase();
  const styles = {
    low: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
    moderate: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.moderate;
  return treasuryBadgeStyle(pal);
}

function notificationDigestCadenceLabel(cadence) {
  const key = String(cadence || "").toLowerCase();
  const labels = {
    daily: "Daily",
    weekly: "Weekly",
    on_change: "On change",
  };
  return labels[key] || "Unknown";
}

function digestReadinessStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    quiet: "Quiet",
    monitoring: "Monitoring",
    digest_ready: "Digest-ready",
    executive_digest_ready: "Executive digest-ready",
  };
  return labels[key] || "Unknown";
}

function digestReadinessStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    quiet: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitoring: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    digest_ready: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    executive_digest_ready: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.quiet;
  return treasuryBadgeStyle(pal);
}

function digestPriorityLabel(priority) {
  const key = String(priority || "").toLowerCase();
  const labels = { low: "Low", moderate: "Moderate", elevated: "Elevated", high: "High" };
  return labels[key] || "Unknown";
}

function digestPriorityBadge(priority) {
  const key = String(priority || "").toLowerCase();
  const styles = {
    low: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
    moderate: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.low;
  return treasuryBadgeStyle(pal);
}

function digestSuitabilityChannelLabel(channel, suitable) {
  const labels = { daily: "Daily", weekly: "Weekly", executive: "Executive" };
  const name = labels[channel] || channel;
  return suitable ? `${name} — suitable (not sent)` : `${name} — not suitable`;
}

function digestSuitabilityBadge(suitable) {
  return treasuryBadgeStyle(
    suitable
      ? { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" }
      : { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
  );
}

function executiveAttentionStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    quiet: "Quiet",
    observe: "Observe",
    leadership_attention: "Leadership attention",
    executive_review: "Executive review",
  };
  return labels[key] || "Unknown";
}

function executiveAttentionStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    quiet: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    observe: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    leadership_attention: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    executive_review: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.observe;
  return treasuryBadgeStyle(pal);
}

function escalationPriorityLabel(priority) {
  const key = String(priority || "").toLowerCase();
  const labels = { low: "Low", moderate: "Moderate", elevated: "Elevated", high: "High" };
  return labels[key] || "Unknown";
}

function escalationPriorityBadge(priority) {
  return digestPriorityBadge(priority);
}

function recommendedExecutiveCadenceLabel(cadence) {
  const key = String(cadence || "").toLowerCase();
  const labels = {
    none: "None",
    weekly: "Weekly",
    daily: "Daily",
    immediate_review: "Immediate review",
  };
  return labels[key] || "Unknown";
}

function recommendedExecutiveCadenceBadge(cadence) {
  const key = String(cadence || "").toLowerCase();
  const styles = {
    none: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    weekly: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    daily: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    immediate_review: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.weekly;
  return treasuryBadgeStyle(pal);
}

function decisionSupportStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    stable: "Stable",
    monitoring: "Monitoring",
    attention_recommended: "Attention recommended",
    leadership_review: "Leadership review",
  };
  return labels[key] || "Monitoring";
}

function decisionSupportStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    stable: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitoring: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    attention_recommended: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    leadership_review: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.monitoring;
  return treasuryBadgeStyle(pal);
}

function decisionSupportPriorityBadge(priority) {
  return digestPriorityBadge(priority);
}

function institutionalMemoryStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    minimal_history: "Minimal history",
    monitoring_patterns: "Monitoring patterns",
    stable_pattern: "Stable pattern",
    recurring_attention: "Recurring attention",
  };
  return labels[key] || "Minimal history";
}

function institutionalMemoryStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    minimal_history: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
    monitoring_patterns: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    stable_pattern: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    recurring_attention: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.minimal_history;
  return treasuryBadgeStyle(pal);
}

function historicalPostureLabel(posture) {
  const key = String(posture || "").toLowerCase();
  const labels = {
    stable: "Stable",
    observation: "Observation",
    elevated_attention: "Elevated attention",
    leadership_visibility: "Leadership visibility",
  };
  return labels[key] || "Observation";
}

function historicalPostureBadge(posture) {
  const key = String(posture || "").toLowerCase();
  const styles = {
    stable: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    observation: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated_attention: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    leadership_visibility: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.observation;
  return treasuryBadgeStyle(pal);
}

function confidenceLevelLabel(level) {
  const key = String(level || "").toLowerCase();
  const labels = {
    high: "High",
    moderate: "Moderate",
    low: "Low",
  };
  return labels[key] || "Low";
}

function confidenceLevelBadge(level) {
  const key = String(level || "").toLowerCase();
  const styles = {
    high: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    moderate: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    low: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.low;
  return treasuryBadgeStyle(pal);
}

function consistencyStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    aligned: "Aligned",
    minor_conflicts: "Minor conflicts",
    mixed_signals: "Mixed signals",
    contradictory: "Contradictory",
  };
  return labels[key] || "Aligned";
}

function consistencyStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    aligned: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    minor_conflicts: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    mixed_signals: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    contradictory: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.aligned;
  return treasuryBadgeStyle(pal);
}

function treasuryNarrativeStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    calm: "Calm",
    monitoring: "Monitoring",
    elevated_attention: "Elevated attention",
    leadership_visibility: "Leadership visibility",
  };
  return labels[key] || "Monitoring";
}

function treasuryNarrativeStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    calm: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitoring: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated_attention: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    leadership_visibility: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.monitoring;
  return treasuryBadgeStyle(pal);
}

function operatorPostureLabel(posture) {
  const key = String(posture || "").toLowerCase();
  const labels = {
    observe: "Observe",
    review: "Review",
    elevated_review: "Elevated review",
    leadership_visibility: "Leadership visibility",
  };
  return labels[key] || "Observe";
}

function operatorPostureBadge(posture) {
  const key = String(posture || "").toLowerCase();
  const styles = {
    observe: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    review: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated_review: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    leadership_visibility: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.observe;
  return treasuryBadgeStyle(pal);
}

function playbookStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    routine_operations: "Routine operations",
    monitoring_mode: "Monitoring mode",
    elevated_review: "Elevated review",
    leadership_visibility: "Leadership visibility",
  };
  return labels[key] || "Monitoring mode";
}

function playbookStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    routine_operations: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitoring_mode: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated_review: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    leadership_visibility: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.monitoring_mode;
  return treasuryBadgeStyle(pal);
}

function operatorCadenceLabel(cadence) {
  const key = String(cadence || "").toLowerCase();
  const labels = {
    routine: "Routine",
    weekly_review: "Weekly review",
    daily_review: "Daily review",
    immediate_visibility: "Immediate visibility",
  };
  return labels[key] || "Weekly review";
}

function operatorCadenceBadge(cadence) {
  const key = String(cadence || "").toLowerCase();
  const styles = {
    routine: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    weekly_review: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    daily_review: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    immediate_visibility: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.weekly_review;
  return treasuryBadgeStyle(pal);
}

function treasuryScenarioLabel(scenario) {
  const key = String(scenario || "").toLowerCase();
  const labels = {
    stable: "Stable",
    monitoring: "Monitoring",
    elevated_attention: "Elevated attention",
    leadership_visibility: "Leadership visibility",
  };
  return labels[key] || "Monitoring";
}

function treasuryScenarioBadge(scenario) {
  const key = String(scenario || "").toLowerCase();
  const styles = {
    stable: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitoring: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated_attention: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    leadership_visibility: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.monitoring;
  return treasuryBadgeStyle(pal);
}

function responseStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    stable_response: "Stable response",
    monitoring_response: "Monitoring response",
    elevated_response: "Elevated response",
    leadership_response: "Leadership response",
  };
  return labels[key] || "Monitoring response";
}

function responseStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    stable_response: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitoring_response: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated_response: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    leadership_response: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.monitoring_response;
  return treasuryBadgeStyle(pal);
}

function scenarioMonitoringCadenceLabel(cadence) {
  const key = String(cadence || "").toLowerCase();
  const labels = {
    routine: "Routine",
    weekly_review: "Weekly review",
    daily_review: "Daily review",
    immediate_visibility: "Immediate visibility",
  };
  return labels[key] || "Weekly review";
}

function scenarioMonitoringCadenceBadge(cadence) {
  const key = String(cadence || "").toLowerCase();
  const styles = {
    routine: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    weekly_review: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    daily_review: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    immediate_visibility: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.weekly_review;
  return treasuryBadgeStyle(pal);
}

function operatorTimelineStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    stable: "Stable",
    monitoring: "Monitoring",
    elevated_attention: "Elevated attention",
    leadership_visibility: "Leadership visibility",
  };
  return labels[key] || "Monitoring";
}

function operatorTimelineStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    stable: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitoring: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated_attention: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    leadership_visibility: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.monitoring;
  return treasuryBadgeStyle(pal);
}

function operatorTimelineCadenceLabel(cadence) {
  const key = String(cadence || "").toLowerCase();
  const labels = {
    routine: "Routine",
    weekly_review: "Weekly review",
    daily_review: "Daily review",
    immediate_visibility: "Immediate visibility",
  };
  return labels[key] || "Weekly review";
}

function operatorTimelineCadenceBadge(cadence) {
  const key = String(cadence || "").toLowerCase();
  const styles = {
    routine: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    weekly_review: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    daily_review: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    immediate_visibility: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.weekly_review;
  return treasuryBadgeStyle(pal);
}

function attentionPriorityStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    stable: "Stable",
    monitoring: "Monitoring",
    elevated_attention: "Elevated attention",
    leadership_visibility: "Leadership visibility",
  };
  return labels[key] || "Monitoring";
}

function attentionPriorityStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    stable: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitoring: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated_attention: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    leadership_visibility: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.monitoring;
  return treasuryBadgeStyle(pal);
}

function operationalCoherenceStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    aligned: "Aligned",
    monitoring: "Monitoring",
    mild_conflict: "Mild conflict",
    leadership_review: "Leadership review",
  };
  return labels[key] || "Monitoring";
}

function operationalCoherenceStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    aligned: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitoring: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    mild_conflict: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    leadership_review: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.monitoring;
  return treasuryBadgeStyle(pal);
}

function adaptiveReviewCadenceStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    stable: "Stable",
    monitoring: "Monitoring",
    elevated_attention: "Elevated attention",
    leadership_visibility: "Leadership visibility",
  };
  return labels[key] || "Monitoring";
}

function adaptiveReviewCadenceStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    stable: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitoring: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated_attention: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    leadership_visibility: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.monitoring;
  return treasuryBadgeStyle(pal);
}

function adaptiveReviewRecommendedCadenceLabel(cadence) {
  const key = String(cadence || "").toLowerCase();
  const labels = {
    weekly_review: "Weekly review",
    every_few_days: "Every few days",
    daily_review: "Daily review",
    immediate_visibility: "Immediate visibility",
  };
  return labels[key] || "Every few days";
}

function adaptiveReviewRecommendedCadenceBadge(cadence) {
  const key = String(cadence || "").toLowerCase();
  const styles = {
    weekly_review: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    every_few_days: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    daily_review: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    immediate_visibility: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.every_few_days;
  return treasuryBadgeStyle(pal);
}

function leadershipReadinessStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    operator_level: "Operator level",
    monitoring_visibility: "Monitoring visibility",
    leadership_visibility: "Leadership visibility",
    executive_attention: "Executive attention",
  };
  return labels[key] || "Monitoring visibility";
}

function leadershipReadinessStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    operator_level: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitoring_visibility: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    leadership_visibility: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    executive_attention: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.monitoring_visibility;
  return treasuryBadgeStyle(pal);
}

function metaReasoningTrustStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    high_alignment: "High alignment",
    moderate_alignment: "Moderate alignment",
    mixed_confidence: "Mixed confidence",
    soft_uncertainty: "Soft uncertainty",
  };
  return labels[key] || "Soft uncertainty";
}

function metaReasoningTrustStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    high_alignment: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    moderate_alignment: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    mixed_confidence: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    soft_uncertainty: { bg: "#f8fafc", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.soft_uncertainty;
  return treasuryBadgeStyle(pal);
}

function decisionTraceStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    fully_traceable: "Fully traceable",
    mostly_traceable: "Mostly traceable",
    partially_traceable: "Partially traceable",
    fragmented_trace: "Fragmented trace",
  };
  return labels[key] || "Fragmented trace";
}

function decisionTraceStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    fully_traceable: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    mostly_traceable: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    partially_traceable: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    fragmented_trace: { bg: "#f8fafc", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.fragmented_trace;
  return treasuryBadgeStyle(pal);
}

function recommendationStabilityStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    highly_stable: "Highly stable",
    stable: "Stable",
    moderate_variation: "Moderate variation",
    unstable: "Unstable",
    fragmented: "Fragmented",
  };
  return labels[key] || "Moderate variation";
}

function recommendationStabilityStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    highly_stable: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    stable: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    moderate_variation: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    unstable: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    fragmented: { bg: "#f8fafc", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.moderate_variation;
  return treasuryBadgeStyle(pal);
}

function oscillationRiskLabel(risk) {
  const key = String(risk || "").toLowerCase();
  const labels = {
    low: "Low",
    moderate: "Moderate",
    elevated: "Elevated",
    high: "High",
  };
  return labels[key] || "Low";
}

function oscillationRiskBadge(risk) {
  const key = String(risk || "").toLowerCase();
  const styles = {
    low: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    moderate: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    high: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.low;
  return treasuryBadgeStyle(pal);
}

function recommendationTrendLabel(trend) {
  const key = String(trend || "").toLowerCase();
  const labels = {
    converging: "Converging",
    steady: "Steady",
    shifting: "Shifting",
    diverging: "Diverging",
  };
  return labels[key] || "Steady";
}

function recommendationTrendBadge(trend) {
  const key = String(trend || "").toLowerCase();
  const styles = {
    converging: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    steady: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    shifting: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    diverging: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.steady;
  return treasuryBadgeStyle(pal);
}

function confidenceTrendLabel(trend) {
  const key = String(trend || "").toLowerCase();
  const labels = {
    strengthening: "Strengthening",
    stable: "Stable",
    weakening: "Weakening",
  };
  return labels[key] || "Stable";
}

function confidenceTrendBadge(trend) {
  const key = String(trend || "").toLowerCase();
  const styles = {
    strengthening: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    stable: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    weakening: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
  };
  const pal = styles[key] || styles.stable;
  return treasuryBadgeStyle(pal);
}

function advisoryDriftStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    improving: "Improving",
    stable: "Stable",
    soft_deterioration: "Soft deterioration",
    elevated_deterioration: "Elevated deterioration",
    recovery: "Recovery",
    volatile: "Volatile",
  };
  return labels[key] || "Stable";
}

function advisoryDriftStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    improving: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    stable: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    soft_deterioration: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated_deterioration: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    recovery: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    volatile: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.stable;
  return treasuryBadgeStyle(pal);
}

function driftDirectionLabel(direction) {
  const key = String(direction || "").toLowerCase();
  const labels = {
    strengthening: "Strengthening",
    neutral: "Neutral",
    weakening: "Weakening",
    oscillating: "Oscillating",
  };
  return labels[key] || "Neutral";
}

function driftDirectionBadge(direction) {
  const key = String(direction || "").toLowerCase();
  const styles = {
    strengthening: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    neutral: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    weakening: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    oscillating: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.neutral;
  return treasuryBadgeStyle(pal);
}

function driftMomentumLabel(momentum) {
  const key = String(momentum || "").toLowerCase();
  const labels = {
    low: "Low",
    moderate: "Moderate",
    high: "High",
  };
  return labels[key] || "Low";
}

function driftMomentumBadge(momentum) {
  const key = String(momentum || "").toLowerCase();
  const styles = {
    low: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    moderate: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    high: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.low;
  return treasuryBadgeStyle(pal);
}

function treasuryRegimeLabel(regime) {
  const key = String(regime || "").toLowerCase();
  const labels = {
    stable_operations: "Stable Operations",
    elevated_monitoring: "Elevated Monitoring",
    recovery_mode: "Recovery Mode",
    defensive_posture: "Defensive Posture",
    scaling_pressure: "Scaling Pressure",
    fragmented_advisory_state: "Fragmented Advisory State",
    volatile_conditions: "Volatile Conditions",
    confidence_rebuild: "Confidence Rebuild",
  };
  return labels[key] || "Elevated Monitoring";
}

function treasuryRegimeBadge(regime) {
  const key = String(regime || "").toLowerCase();
  const styles = {
    stable_operations: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    elevated_monitoring: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    recovery_mode: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    defensive_posture: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    scaling_pressure: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    fragmented_advisory_state: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    volatile_conditions: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    confidence_rebuild: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.elevated_monitoring;
  return treasuryBadgeStyle(pal);
}

function regimeTrendLabel(trend) {
  const key = String(trend || "").toLowerCase();
  const labels = {
    strengthening: "Strengthening",
    stable: "Stable",
    weakening: "Weakening",
    oscillating: "Oscillating",
  };
  return labels[key] || "Stable";
}

function regimeTrendBadge(trend) {
  const key = String(trend || "").toLowerCase();
  const styles = {
    strengthening: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    stable: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    weakening: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    oscillating: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.stable;
  return treasuryBadgeStyle(pal);
}

function regimeOperatorPostureLabel(posture) {
  const key = String(posture || "").toLowerCase();
  const labels = {
    observe: "Observe",
    monitor_closely: "Monitor closely",
    cautious_attention: "Cautious attention",
    elevated_attention: "Elevated attention",
    leadership_visibility: "Leadership visibility",
  };
  return labels[key] || "Observe";
}

function regimeOperatorPostureBadge(posture) {
  const key = String(posture || "").toLowerCase();
  const styles = {
    observe: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitor_closely: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    cautious_attention: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated_attention: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    leadership_visibility: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.observe;
  return treasuryBadgeStyle(pal);
}

function advisoryOutlookLabel(outlook) {
  const key = String(outlook || "").toLowerCase();
  const labels = {
    improving_outlook: "Improving",
    stabilizing_outlook: "Stabilizing",
    cautious_outlook: "Cautious",
    elevated_monitoring_outlook: "Elevated Monitoring",
    deteriorating_outlook: "Deteriorating",
    uncertain_outlook: "Uncertain",
    recovery_outlook: "Recovery",
  };
  return labels[key] || "Uncertain";
}

function advisoryOutlookBadge(outlook) {
  const key = String(outlook || "").toLowerCase();
  const styles = {
    improving_outlook: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    stabilizing_outlook: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    cautious_outlook: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated_monitoring_outlook: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    deteriorating_outlook: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    uncertain_outlook: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
    recovery_outlook: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
  };
  const pal = styles[key] || styles.uncertain_outlook;
  return treasuryBadgeStyle(pal);
}

function outlookDirectionLabel(direction) {
  const key = String(direction || "").toLowerCase();
  const labels = {
    strengthening: "Strengthening",
    stable: "Stable",
    weakening: "Weakening",
    oscillating: "Oscillating",
  };
  return labels[key] || "Stable";
}

function outlookDirectionBadge(direction) {
  const key = String(direction || "").toLowerCase();
  const styles = {
    strengthening: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    stable: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    weakening: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    oscillating: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.stable;
  return treasuryBadgeStyle(pal);
}

function outlookOperatorPostureLabel(posture) {
  return regimeOperatorPostureLabel(posture);
}

function outlookOperatorPostureBadge(posture) {
  return regimeOperatorPostureBadge(posture);
}

function visibilityTierLabel(tier) {
  const key = String(tier || "").toLowerCase();
  const labels = {
    routine: "Routine",
    informational: "Informational",
    leadership: "Leadership",
    executive: "Executive",
  };
  return labels[key] || "Informational";
}

function visibilityTierBadge(tier) {
  const key = String(tier || "").toLowerCase();
  const styles = {
    routine: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    informational: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    leadership: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    executive: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.informational;
  return treasuryBadgeStyle(pal);
}

function contradictionSeverityBadge(severity) {
  const key = String(severity || "").toLowerCase();
  const styles = {
    info: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
    low: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    moderate: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    elevated: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.info;
  return treasuryBadgeStyle(pal);
}

function treasuryConditionLabel(condition) {
  const key = String(condition || "").toLowerCase();
  const labels = {
    healthy: "Healthy",
    stable: "Stable",
    watch: "Watch",
    stressed: "Stressed",
  };
  return labels[key] || "Unknown";
}

function treasuryConditionColor(condition) {
  const key = String(condition || "").toLowerCase();
  if (key === "healthy") return "#047857";
  if (key === "stable") return "#0f172a";
  if (key === "watch") return "#92400e";
  return "#b45309";
}

function readinessDriverTypeStyle(type) {
  const key = String(type || "").toLowerCase();
  const styles = {
    positive: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    negative: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    context: { bg: "#f1f5f9", fg: "#475569", border: "#e2e8f0" },
  };
  return styles[key] || styles.context;
}

function driftStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    unchanged: "Unchanged",
    minor_shift: "Minor shift",
    moderate_shift: "Moderate shift",
    meaningful_shift: "Meaningful shift",
  };
  return labels[key] || "Unknown";
}

function driftStatusColor(status) {
  const key = String(status || "").toLowerCase();
  if (key === "unchanged") return "#047857";
  if (key === "minor_shift") return "#0f766e";
  if (key === "moderate_shift") return "#92400e";
  return "#b45309";
}

function driftStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    unchanged: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    minor_shift: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    moderate_shift: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    meaningful_shift: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.unchanged;
  return treasuryBadgeStyle(pal);
}

function stabilityAssessmentLabel(assessment) {
  const key = String(assessment || "").toLowerCase();
  const labels = {
    stable: "Stable",
    mostly_stable: "Mostly stable",
    changing: "Changing",
    unstable: "Unstable",
  };
  return labels[key] || "Unknown";
}

function stabilityAssessmentColor(assessment) {
  const key = String(assessment || "").toLowerCase();
  if (key === "stable") return "#047857";
  if (key === "mostly_stable") return "#0f766e";
  if (key === "changing") return "#92400e";
  return "#b45309";
}

function driftDriverTypeStyle(type) {
  const key = String(type || "").toLowerCase();
  const styles = {
    positive: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    negative: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    context: { bg: "#f1f5f9", fg: "#475569", border: "#e2e8f0" },
  };
  return styles[key] || styles.context;
}

function stabilityLevelLabel(level) {
  const key = String(level || "").toLowerCase();
  const labels = {
    highly_stable: "Highly stable",
    stable: "Stable",
    variable: "Variable",
    unstable: "Unstable",
  };
  return labels[key] || "Unknown";
}

function stabilityLevelBadge(level) {
  const key = String(level || "").toLowerCase();
  const styles = {
    highly_stable: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    stable: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    variable: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    unstable: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.unstable;
  return treasuryBadgeStyle(pal);
}

function operatingConfidenceLabel(confidence) {
  const key = String(confidence || "").toLowerCase();
  const labels = {
    high: "High",
    strong: "Strong",
    moderate: "Moderate",
    low: "Low",
  };
  return labels[key] || "Unknown";
}

function operatingConfidenceColor(confidence) {
  const key = String(confidence || "").toLowerCase();
  if (key === "high") return "#047857";
  if (key === "strong") return "#0f766e";
  if (key === "moderate") return "#92400e";
  return "#64748b";
}

function operatingConfidenceBadge(confidence) {
  const key = String(confidence || "").toLowerCase();
  const styles = {
    high: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    strong: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    moderate: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    low: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.low;
  return treasuryBadgeStyle(pal);
}

function treasuryConsistencyLabel(consistency) {
  const key = String(consistency || "").toLowerCase();
  const labels = {
    highly_consistent: "Highly consistent",
    consistent: "Consistent",
    mixed: "Mixed",
    inconsistent: "Inconsistent",
  };
  return labels[key] || "Unknown";
}

function treasuryConsistencyColor(consistency) {
  const key = String(consistency || "").toLowerCase();
  if (key === "highly_consistent") return "#047857";
  if (key === "consistent") return "#0f766e";
  if (key === "mixed") return "#92400e";
  return "#64748b";
}

function volatilityAssessmentLabel(assessment) {
  const key = String(assessment || "").toLowerCase();
  const labels = {
    highly_stable: "Highly stable",
    low_variance: "Low variance",
    moderate_variance: "Moderate variance",
    elevated_variance: "Elevated variance",
  };
  return labels[key] || "Unknown";
}

function volatilityAssessmentColor(assessment) {
  const key = String(assessment || "").toLowerCase();
  if (key === "highly_stable") return "#047857";
  if (key === "low_variance") return "#0f766e";
  if (key === "moderate_variance") return "#92400e";
  return "#b45309";
}

function stabilityDriverTypeStyle(type) {
  return readinessDriverTypeStyle(type);
}

function scalingReadinessLevelLabel(level) {
  const key = String(level || "").toLowerCase();
  const labels = {
    highly_ready: "Highly ready",
    strong: "Strong",
    moderate: "Moderate",
    limited: "Limited",
    not_ready: "Not ready",
  };
  return labels[key] || "Unknown";
}

function scalingReadinessLevelBadge(level) {
  const key = String(level || "").toLowerCase();
  const styles = {
    highly_ready: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    strong: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    moderate: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    limited: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    not_ready: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.not_ready;
  return treasuryBadgeStyle(pal);
}

function launchCapacityLabel(capacity) {
  const key = String(capacity || "").toLowerCase();
  const labels = {
    test_only: "Test only",
    limited_growth: "Limited growth",
    soft_launch_ready: "Soft-launch ready",
    moderate_scale_ready: "Moderate scale ready",
  };
  return labels[key] || "Unknown";
}

function launchCapacityColor(capacity) {
  const key = String(capacity || "").toLowerCase();
  if (key === "moderate_scale_ready" || key === "soft_launch_ready") return "#047857";
  if (key === "limited_growth") return "#0f766e";
  return "#64748b";
}

function operatingToleranceLabel(tolerance) {
  const key = String(tolerance || "").toLowerCase();
  const labels = {
    fragile: "Fragile",
    manageable: "Manageable",
    stable: "Stable",
    resilient: "Resilient",
  };
  return labels[key] || "Unknown";
}

function operatingToleranceBadge(tolerance) {
  const key = String(tolerance || "").toLowerCase();
  const styles = {
    resilient: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    stable: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    manageable: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    fragile: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.fragile;
  return treasuryBadgeStyle(pal);
}

function treasuryIntegrityLevelLabel(level) {
  const key = String(level || "").toLowerCase();
  const labels = {
    highly_trusted: "Highly trusted",
    strong: "Strong",
    trusted: "Trusted",
    developing: "Developing",
    weak: "Weak",
  };
  return labels[key] || "Unknown";
}

function treasuryIntegrityLevelBadge(level) {
  const key = String(level || "").toLowerCase();
  const styles = {
    highly_trusted: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    strong: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    trusted: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    developing: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    weak: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.weak;
  return treasuryBadgeStyle(pal);
}

function signalTrustLevelLabel(level) {
  const key = String(level || "").toLowerCase();
  const labels = {
    high: "High",
    strong: "Strong",
    moderate: "Moderate",
    low: "Low",
  };
  return labels[key] || "Unknown";
}

function signalTrustLevelBadge(level) {
  const key = String(level || "").toLowerCase();
  const styles = {
    high: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    strong: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    moderate: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    low: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.low;
  return treasuryBadgeStyle(pal);
}

function treasuryReliabilityLabel(reliability) {
  const key = String(reliability || "").toLowerCase();
  const labels = {
    highly_reliable: "Highly reliable",
    reliable: "Reliable",
    improving: "Improving",
    uncertain: "Uncertain",
  };
  return labels[key] || "Unknown";
}

function treasuryReliabilityColor(reliability) {
  const key = String(reliability || "").toLowerCase();
  if (key === "highly_reliable") return "#047857";
  if (key === "reliable") return "#0f766e";
  if (key === "improving") return "#92400e";
  return "#64748b";
}

function integrityConsistencyLabel(assessment) {
  return treasuryConsistencyLabel(assessment);
}

function governanceLevelLabel(level) {
  const key = String(level || "").toLowerCase();
  const labels = {
    institutional: "Institutional",
    strong: "Strong",
    controlled: "Controlled",
    developing: "Developing",
    reactive: "Reactive",
  };
  return labels[key] || "Unknown";
}

function governanceLevelBadge(level) {
  const key = String(level || "").toLowerCase();
  const styles = {
    institutional: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    strong: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    controlled: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    developing: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    reactive: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.developing;
  return treasuryBadgeStyle(pal);
}

function oversightPostureLabel(posture) {
  const key = String(posture || "").toLowerCase();
  const labels = {
    routine_monitoring: "Routine monitoring",
    increased_review: "Increased review",
    elevated_attention: "Elevated attention",
    active_oversight: "Active oversight",
  };
  return labels[key] || "Unknown";
}

function oversightPostureBadge(posture) {
  const key = String(posture || "").toLowerCase();
  const styles = {
    routine_monitoring: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    increased_review: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    elevated_attention: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    active_oversight: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.routine_monitoring;
  return treasuryBadgeStyle(pal);
}

function treasuryOversightLabel(oversight) {
  const key = String(oversight || "").toLowerCase();
  const labels = {
    light: "Light",
    moderate: "Moderate",
    structured: "Structured",
    strong: "Strong",
  };
  return labels[key] || "Unknown";
}

function treasuryOversightColor(oversight) {
  const key = String(oversight || "").toLowerCase();
  if (key === "light") return "#047857";
  if (key === "moderate") return "#0f766e";
  if (key === "structured") return "#0369a1";
  return "#b45309";
}

function monitoringCadenceLabel(cadence) {
  const key = String(cadence || "").toLowerCase();
  const labels = {
    routine: "Routine",
    increased: "Increased",
    elevated: "Elevated",
    active: "Active",
  };
  return labels[key] || "Unknown";
}

function monitoringCadenceColor(cadence) {
  const key = String(cadence || "").toLowerCase();
  if (key === "routine") return "#047857";
  if (key === "increased") return "#0f766e";
  if (key === "elevated") return "#92400e";
  return "#b45309";
}

function treasuryOperatingModeLabel(mode) {
  const key = String(mode || "").toLowerCase();
  const labels = {
    observation_mode: "Observation",
    soft_launch_mode: "Soft launch",
    controlled_growth_mode: "Controlled growth",
    elevated_monitoring_mode: "Elevated monitoring",
  };
  return labels[key] || "Unknown";
}

function treasuryOperatingModeBadge(mode) {
  const key = String(mode || "").toLowerCase();
  const styles = {
    observation_mode: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
    soft_launch_mode: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    controlled_growth_mode: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    elevated_monitoring_mode: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
  };
  const pal = styles[key] || styles.observation_mode;
  return treasuryBadgeStyle(pal);
}

function launchReadinessLevelLabel(level) {
  const key = String(level || "").toLowerCase();
  const labels = {
    testing_only: "Testing only",
    limited_soft_launch: "Limited soft launch",
    soft_launch_ready: "Soft launch ready",
    controlled_growth_ready: "Controlled growth ready",
  };
  return labels[key] || "Unknown";
}

function launchReadinessLevelBadge(level) {
  const key = String(level || "").toLowerCase();
  const styles = {
    testing_only: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
    limited_soft_launch: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    soft_launch_ready: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    controlled_growth_ready: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
  };
  const pal = styles[key] || styles.testing_only;
  return treasuryBadgeStyle(pal);
}

function treasuryPostureLabel(posture) {
  const key = String(posture || "").toLowerCase();
  const labels = {
    cautious: "Cautious",
    stable: "Stable",
    monitored_growth: "Monitored growth",
    elevated_attention: "Elevated attention",
  };
  return labels[key] || "Unknown";
}

function treasuryPostureBadge(posture) {
  const key = String(posture || "").toLowerCase();
  const styles = {
    cautious: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
    stable: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    monitored_growth: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    elevated_attention: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
  };
  const pal = styles[key] || styles.cautious;
  return treasuryBadgeStyle(pal);
}

function recommendedMonitoringLevelLabel(level) {
  return monitoringCadenceLabel(level);
}

function recommendedMonitoringLevelColor(level) {
  return monitoringCadenceColor(level);
}

function integrityConsistencyColor(assessment) {
  return treasuryConsistencyColor(assessment);
}

function treasuryMomentumBadgeStyle(momentum) {
  const key = String(momentum || "").toLowerCase();
  const styles = {
    improving: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    weakening: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    mixed: { bg: "#f5f3ff", fg: "#6d28d9", border: "#ddd6fe" },
    stable: { bg: "#f1f5f9", fg: "#334155", border: "#e2e8f0" },
  };
  const pal = styles[key] || styles.stable;
  return treasuryBadgeStyle(pal);
}

function HistorySparkline({ dataPoints, color = "#0ea5e9", height = 36, width = 120 }) {
  if (!dataPoints?.length) return null;
  const values = dataPoints.map((d) => Number(d.value) || 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = values.length === 1 ? width / 2 : (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Historical trend sparkline"
      style={{ display: "block", maxWidth: "100%" }}
    >
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  );
}

function forecastOutlookLabel(outlook) {
  const key = String(outlook || "").toLowerCase();
  const labels = {
    stable: "Stable",
    improving: "Improving",
    elevated_pressure: "Elevated pressure",
    deteriorating: "Deteriorating",
  };
  return labels[key] || "Unknown";
}

function forecastOutlookColor(outlook) {
  const key = String(outlook || "").toLowerCase();
  if (key === "improving") return "#047857";
  if (key === "deteriorating") return "#b91c1c";
  if (key === "elevated_pressure") return "#92400e";
  if (key === "stable") return "#0f172a";
  return "#64748b";
}

function projectedRiskLabel(risk) {
  const key = String(risk || "").toLowerCase();
  const labels = {
    low: "Low",
    medium: "Medium",
    elevated: "Elevated",
    high: "High",
  };
  return labels[key] || "Unknown";
}

function projectedRiskColor(risk) {
  const key = String(risk || "").toLowerCase();
  if (key === "low") return "#047857";
  if (key === "medium") return "#92400e";
  if (key === "elevated") return "#b45309";
  if (key === "high") return "#b91c1c";
  return "#64748b";
}

function treasuryPressureLabel(pressure) {
  const key = String(pressure || "").toLowerCase();
  const labels = {
    low: "Low",
    moderate: "Moderate",
    elevated: "Elevated",
    severe: "Severe",
  };
  return labels[key] || "Unknown";
}

function treasuryPressureColor(pressure) {
  const key = String(pressure || "").toLowerCase();
  if (key === "low") return "#047857";
  if (key === "moderate") return "#92400e";
  if (key === "elevated") return "#b91c1c";
  if (key === "severe") return "#991b1b";
  return "#64748b";
}

function scenarioSeverityLabel(severity) {
  const key = String(severity || "").toLowerCase();
  const labels = { low: "Low", medium: "Medium", high: "High" };
  return labels[key] || "Unknown";
}

function projectedDirectionLabel(direction) {
  const key = String(direction || "").toLowerCase();
  const labels = { stable: "Stable", rising: "Rising", declining: "Declining" };
  return labels[key] || "Unknown";
}

function resilienceLevelLabel(level) {
  const key = String(level || "").toLowerCase();
  const labels = {
    resilient: "Resilient",
    strong: "Strong",
    moderate: "Moderate",
    weak: "Weak",
  };
  return labels[key] || "Unknown";
}

function resilienceLevelColor(level) {
  const key = String(level || "").toLowerCase();
  if (key === "resilient") return "#047857";
  if (key === "strong") return "#0f766e";
  if (key === "moderate") return "#92400e";
  if (key === "weak") return "#b45309";
  return "#64748b";
}

function recoveryDifficultyLabel(difficulty) {
  const key = String(difficulty || "").toLowerCase();
  const labels = {
    easy: "Easy",
    manageable: "Manageable",
    difficult: "Difficult",
    severe: "Severe",
  };
  return labels[key] || "Unknown";
}

function recoveryDifficultyColor(difficulty) {
  const key = String(difficulty || "").toLowerCase();
  if (key === "easy") return "#047857";
  if (key === "manageable") return "#0f766e";
  if (key === "difficult") return "#92400e";
  if (key === "severe") return "#b45309";
  return "#64748b";
}

function treasuryToleranceLabel(tolerance) {
  const key = String(tolerance || "").toLowerCase();
  const labels = { low: "Low", moderate: "Moderate", high: "High" };
  return labels[key] || "Unknown";
}

function treasuryToleranceColor(tolerance) {
  const key = String(tolerance || "").toLowerCase();
  if (key === "high") return "#047857";
  if (key === "moderate") return "#92400e";
  if (key === "low") return "#b45309";
  return "#64748b";
}

function operationalStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    healthy: "Healthy",
    monitor: "Monitor",
    elevated_attention: "Elevated attention",
    high_attention: "High attention",
  };
  return labels[key] || "Unknown";
}

function operationalStatusColor(status) {
  const key = String(status || "").toLowerCase();
  if (key === "healthy") return "#047857";
  if (key === "monitor") return "#0f766e";
  if (key === "elevated_attention") return "#92400e";
  if (key === "high_attention") return "#b45309";
  return "#64748b";
}

function executiveStatusLabel(status) {
  const key = String(status || "").toLowerCase();
  const labels = {
    healthy: "Healthy",
    stable_monitoring: "Stable monitoring",
    elevated_watch: "Elevated watch",
    high_attention: "High attention",
  };
  return labels[key] || "Unknown";
}

function executiveStatusBadge(status) {
  const key = String(status || "").toLowerCase();
  const styles = {
    healthy: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
    stable_monitoring: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    elevated_watch: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    high_attention: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.stable_monitoring;
  return treasuryBadgeStyle(pal);
}

function monitoringPriorityLabel(priority) {
  const key = String(priority || "").toLowerCase();
  const labels = { low: "Low", medium: "Medium", elevated: "Elevated", high: "High" };
  return labels[key] || "Unknown";
}

function monitoringPriorityColor(priority) {
  const key = String(priority || "").toLowerCase();
  if (key === "low") return "#047857";
  if (key === "medium") return "#0f766e";
  if (key === "elevated") return "#92400e";
  if (key === "high") return "#b45309";
  return "#64748b";
}

function alertCategoryLabel(category) {
  const key = String(category || "").toLowerCase();
  const labels = {
    liquidity: "Liquidity",
    reconciliation: "Reconciliation",
    exposure: "Exposure",
    funding: "Funding",
    volatility: "Volatility",
    system: "System",
    informational: "Informational",
  };
  return labels[key] || "Unknown";
}

function suggestedReviewLabel(review) {
  const key = String(review || "").toLowerCase();
  const labels = {
    routine: "Routine",
    monitor: "Monitor",
    review_today: "Review today",
    urgent_review: "Urgent review",
  };
  return labels[key] || "Unknown";
}

function suggestedReviewColor(review) {
  const key = String(review || "").toLowerCase();
  if (key === "routine") return "#047857";
  if (key === "monitor") return "#0f766e";
  if (key === "review_today") return "#92400e";
  if (key === "urgent_review") return "#b45309";
  return "#64748b";
}

function alertPriorityBadge(priority) {
  const key = String(priority || "").toLowerCase();
  const styles = {
    low: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
    medium: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    elevated: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.low;
  return treasuryBadgeStyle(pal);
}

function runwayEstimateLabel(runway) {
  const key = String(runway || "").toLowerCase();
  const labels = {
    stable: "Stable",
    short_term_pressure: "Short-term pressure",
    medium_term_pressure: "Medium-term pressure",
    long_term_pressure: "Long-term pressure",
  };
  return labels[key] || "Unknown";
}

function runwayEstimateColor(runway) {
  const key = String(runway || "").toLowerCase();
  if (key === "stable") return "#047857";
  if (key === "short_term_pressure") return "#92400e";
  if (key === "medium_term_pressure") return "#b45309";
  if (key === "long_term_pressure") return "#b91c1c";
  return "#64748b";
}

function driverTypeBadge(type) {
  const key = String(type || "").toLowerCase();
  const styles = {
    positive: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0", label: "Positive" },
    warning: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d", label: "Warning" },
    negative: { bg: "#fef2f2", fg: "#991b1b", border: "#fecaca", label: "Negative" },
  };
  const pal = styles[key] || styles.warning;
  return treasuryBadgeStyle(pal);
}

function formatDelta(value, { prefix = "", suffix = "", invertColor = false } = {}) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  const sign = safe > 0 ? "+" : "";
  const color =
    safe === 0
      ? "#64748b"
      : invertColor
        ? safe > 0
          ? "#b91c1c"
          : "#047857"
        : safe > 0
          ? "#047857"
          : "#b91c1c";
  return { text: `${sign}${prefix}${safe.toLocaleString(undefined, { maximumFractionDigits: 2 })}${suffix}`, color };
}

function treasuryGradeColor(grade) {
  const key = String(grade || "").toUpperCase();
  if (key === "A+" || key === "A") return "#047857";
  if (key === "B") return "#0f766e";
  if (key === "C") return "#92400e";
  return "#b91c1c";
}

function treasuryGradeBadge(grade) {
  const key = String(grade || "").toUpperCase();
  const styles = {
    "A+": { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    A: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    B: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    C: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    D: { bg: "#fef2f2", fg: "#b91c1c", border: "#fca5a5" },
  };
  const pal = styles[key] || styles.D;
  return {
    display: "inline-block",
    padding: "0.22rem 0.7rem",
    borderRadius: "999px",
    fontSize: "0.95rem",
    fontWeight: 800,
    letterSpacing: "0.02em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
}

function unifiedConditionLabel(condition) {
  const key = String(condition || "").toLowerCase();
  const labels = {
    resilient: "Resilient",
    healthy: "Healthy",
    stable: "Stable",
    watch: "Watch",
  };
  return labels[key] || "Unknown";
}

function unifiedConditionColor(condition) {
  const key = String(condition || "").toLowerCase();
  if (key === "resilient") return "#047857";
  if (key === "healthy") return "#0f766e";
  if (key === "stable") return "#0f172a";
  return "#92400e";
}

function unifiedConditionBadge(condition) {
  const key = String(condition || "").toLowerCase();
  const styles = {
    resilient: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    healthy: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    stable: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    watch: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
  };
  const pal = styles[key] || styles.watch;
  return treasuryBadgeStyle(pal);
}

function operatingRecommendationLabel(recommendation) {
  const key = String(recommendation || "").toLowerCase();
  const labels = {
    continue_monitoring: "Continue Monitoring",
    soft_launch_ready: "Soft-Launch Ready",
    controlled_growth_ready: "Controlled Growth Ready",
    elevated_attention: "Elevated Attention",
  };
  return labels[key] || "Unknown";
}

function operatingRecommendationColor(recommendation) {
  const key = String(recommendation || "").toLowerCase();
  if (key === "controlled_growth_ready") return "#047857";
  if (key === "soft_launch_ready") return "#0f766e";
  if (key === "continue_monitoring") return "#0369a1";
  return "#b45309";
}

function operatingRecommendationBadge(recommendation) {
  const key = String(recommendation || "").toLowerCase();
  const styles = {
    controlled_growth_ready: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    soft_launch_ready: { bg: "#f0fdf4", fg: "#15803d", border: "#86efac" },
    continue_monitoring: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
    elevated_attention: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  };
  const pal = styles[key] || styles.continue_monitoring;
  return treasuryBadgeStyle(pal);
}

function KpiCard({ label, value, subtitle, valueColor }) {
  return (
    <div style={treasuryKpiCardStyle}>
      <p style={treasuryKpiLabelStyle}>{label}</p>
      <p
        style={{
          margin: 0,
          fontSize: "1.35rem",
          fontWeight: 800,
          color: valueColor || "#0f172a",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </p>
      {subtitle ? (
        <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b", lineHeight: 1.5 }}>{subtitle}</p>
      ) : null}
    </div>
  );
}

function BoardTimelineSparkline({ series }) {
  const points = (series || [])
    .map((p) => Number(p?.treasuryScore))
    .filter((v) => Number.isFinite(v));
  if (points.length < 2) return null;

  const width = 320;
  const height = 48;
  const pad = 4;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const stepX = (width - pad * 2) / (points.length - 1);

  const coords = points.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (v - min) / range);
    return { x, y };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Treasury score trend across snapshots"
      style={{ width: "100%", height: "48px", display: "block" }}
    >
      <polyline
        points={`${pad},${height - pad} ${coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ")} ${(width - pad).toFixed(1)},${height - pad}`}
        fill="#eff6ff"
        stroke="none"
      />
      <path d={path} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="3" fill="#2563eb" />
    </svg>
  );
}

function SkeletonKpi() {
  return (
    <div style={treasuryKpiCardStyle}>
      <div
        style={{
          height: "0.6rem",
          width: "40%",
          borderRadius: "6px",
          background: "#e2e8f0",
          marginBottom: "0.55rem",
        }}
      />
      <div style={{ height: "1.6rem", width: "55%", borderRadius: "6px", background: "#e2e8f0" }} />
    </div>
  );
}


export default function AdminTreasuryIntelligencePage() {
  const { user, profile, loading: authLoading } = useUser();
  const [health, setHealth] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [trends, setTrends] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [scenarios, setScenarios] = useState(null);
  const [resilience, setResilience] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveNote, setSaveNote] = useState(null);
  const [simLiabilityMult, setSimLiabilityMult] = useState(1);
  const [simExposureMult, setSimExposureMult] = useState(1);
  const [simFundingSlowdown, setSimFundingSlowdown] = useState(0);
  const [simReconIssues, setSimReconIssues] = useState(0);
  const [simWithdrawalSpike, setSimWithdrawalSpike] = useState(0);
  const [simulationResult, setSimulationResult] = useState(null);
  const [reportPreview, setReportPreview] = useState(null);
  const [reportCopyNote, setReportCopyNote] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState("executive-command-center");
  const [operationalEvents, setOperationalEvents] = useState([]);
  const [operationalEventsForMemory, setOperationalEventsForMemory] = useState([]);
  const [treasuryCenterEvents, setTreasuryCenterEvents] = useState([]);
  const [treasuryCenterSources, setTreasuryCenterSources] = useState({});
  const [treasuryCenterLoading, setTreasuryCenterLoading] = useState(false);
  const [treasuryCenterError, setTreasuryCenterError] = useState(null);
  const [eventCenterSeverityFilter, setEventCenterSeverityFilter] = useState("all");
  const [eventCenterCategoryFilter, setEventCenterCategoryFilter] = useState("all");
  const [eventCenterSourceFilter, setEventCenterSourceFilter] = useState("all");
  const [selectedTreasuryEvent, setSelectedTreasuryEvent] = useState(null);
  const [eventInvestigationNotes, setEventInvestigationNotes] = useState([]);
  const [eventNotesLoading, setEventNotesLoading] = useState(false);
  const [eventNotesError, setEventNotesError] = useState(null);
  const [eventNotesTableMissing, setEventNotesTableMissing] = useState(false);
  const [eventNoteDraft, setEventNoteDraft] = useState("");
  const [eventNoteSaving, setEventNoteSaving] = useState(false);
  const [eventResolutionsByEventId, setEventResolutionsByEventId] = useState({});
  const [eventResolutionTableMissing, setEventResolutionTableMissing] = useState(false);
  const [eventResolutionLoading, setEventResolutionLoading] = useState(false);
  const [eventResolutionError, setEventResolutionError] = useState(null);
  const [eventResolutionSaving, setEventResolutionSaving] = useState(false);
  const [currentEventResolution, setCurrentEventResolution] = useState(null);
  const [resolutionStatusDraft, setResolutionStatusDraft] = useState("open");
  const [resolutionSummaryDraft, setResolutionSummaryDraft] = useState("");
  const [resolutionAssignedToDraft, setResolutionAssignedToDraft] = useState("");
  const [eventsLoading, setEventsLoading] = useState(false);
  const [pendingSnapshotLog, setPendingSnapshotLog] = useState(false);
  const [monitoringEmissionSummary, setMonitoringEmissionSummary] = useState(null);
  const prevEmissionStateRef = useRef(null);
  const loadCycleRef = useRef(0);
  const lastEmissionKeyRef = useRef(null);
  const adminAlertFingerprintRef = useRef(null);

  const handleGroupActivate = useCallback((id) => {
    setActiveGroupId(id);
  }, []);

  const load = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setLoadError(null);
    setSaveNote(null);
    try {
      const [healthResult, alertResult, historyResult, trendsResult] = await Promise.all([
        calculateTreasuryHealth(supabase),
        fetchTreasuryAlerts(supabase),
        fetchTreasuryHealthHistory({ limit: 30 }, supabase),
        calculateTreasuryTrends({ days: 7 }, supabase),
      ]);
      const forecastResult = await calculateTreasuryForecast({ days: 7, trends: trendsResult }, supabase);
      const scenariosResult = await calculateTreasuryScenarios(
        { days: 7, trends: trendsResult, forecast: forecastResult, health: healthResult },
        supabase,
      );
      const resilienceResult = await calculateTreasuryResilience(
        {
          days: 30,
          trends: trendsResult,
          forecast: forecastResult,
          scenarios: scenariosResult,
          health: healthResult,
        },
        supabase,
      );

      setHealth(healthResult);
      setAlerts(alertResult.alerts || []);
      setTrends(trendsResult);
      setForecast(forecastResult);
      setScenarios(scenariosResult);
      setResilience(resilienceResult);

      if (historyResult.tableMissing) {
        setTableMissing(true);
        setHistory([]);
      } else {
        setTableMissing(false);
        setHistory(historyResult.rows || []);
        if (historyResult.error) {
          setLoadError(historyResult.error);
        }
      }

      const saveRes = await saveTreasuryHealthSnapshot(healthResult, supabase);
      if (saveRes.tableMissing) {
        setTableMissing(true);
        setSaveNote("Snapshot table not migrated — run supabase/sql/treasury_health_snapshots.sql");
      } else if (saveRes.ok) {
        setSaveNote("Snapshot saved.");
        setPendingSnapshotLog(true);
        const [refreshed, refreshedTrends] = await Promise.all([
          fetchTreasuryHealthHistory({ limit: 30 }, supabase),
          calculateTreasuryTrends({ days: 7 }, supabase),
        ]);
        if (!refreshed.tableMissing) {
          setHistory(refreshed.rows || []);
        }
        setTrends(refreshedTrends);
        const refreshedForecast = await calculateTreasuryForecast({ days: 7, trends: refreshedTrends }, supabase);
        setForecast(refreshedForecast);
        const refreshedScenarios = await calculateTreasuryScenarios(
          { days: 7, trends: refreshedTrends, forecast: refreshedForecast, health: healthResult },
          supabase,
        );
        setScenarios(refreshedScenarios);
        setResilience(
          await calculateTreasuryResilience(
            {
              days: 30,
              trends: refreshedTrends,
              forecast: refreshedForecast,
              scenarios: refreshedScenarios,
              health: healthResult,
            },
            supabase,
          ),
        );
      } else if (saveRes.error && saveRes.error !== "table_missing") {
        setSaveNote(`Snapshot not saved: ${saveRes.error}`);
      }
    } catch (e) {
      console.error("[admin/treasury-intelligence]", e);
      setLoadError(e?.message || "Failed to load treasury intelligence.");
      setHealth(null);
      setAlerts([]);
      setTrends(null);
      setForecast(null);
      setScenarios(null);
      setResilience(null);
    } finally {
      loadCycleRef.current += 1;
      setLoading(false);
    }
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void load();
  }, [authLoading, user, profile, load]);

  const metrics = health?.sourceSnapshot?.metrics || {};
  const topReasons = useMemo(() => (health?.reasons || []).slice(0, 5), [health]);

  const explainability = useMemo(() => {
    if (!health) return null;
    return calculateTreasuryExplainability({
      treasuryHealth: health,
      trends: trends || {},
      forecast: forecast || {},
      scenarios: scenarios || {},
      resilience: resilience || {},
    });
  }, [health, trends, forecast, scenarios, resilience]);

  const operationalGuidance = useMemo(() => {
    if (!health) return null;
    return calculateTreasuryOperationalGuidance({
      treasuryHealth: health,
      trends: trends || {},
      forecast: forecast || {},
      scenarios: scenarios || {},
      resilience: resilience || {},
      explainability: explainability || {},
      simulator: simulationResult || undefined,
    });
  }, [health, trends, forecast, scenarios, resilience, explainability, simulationResult]);

  const executiveSummary = useMemo(() => {
    if (!health || !operationalGuidance) return null;
    return calculateTreasuryExecutiveSummary({
      treasuryHealth: health,
      trends: trends || {},
      forecast: forecast || {},
      scenarios: scenarios || {},
      resilience: resilience || {},
      explainability: explainability || {},
      operationalGuidance,
    });
  }, [health, trends, forecast, scenarios, resilience, explainability, operationalGuidance]);

  const historicalAnalytics = useMemo(() => {
    if (!health) return null;
    return calculateTreasuryHistoricalAnalytics({
      treasury_health_snapshots: history,
      trends: trends || {},
      forecast: forecast || {},
      resilience: resilience || {},
      alerts,
    });
  }, [health, history, trends, forecast, resilience, alerts]);

  const alertClassification = useMemo(() => {
    if (!health) return null;
    return classifyTreasuryAlerts({
      alerts,
      trends: trends || {},
      forecast: forecast || {},
      scenarios: scenarios || {},
      resilience: resilience || {},
      operationalGuidance: operationalGuidance || {},
      historicalAnalytics: historicalAnalytics || {},
    });
  }, [health, alerts, trends, forecast, scenarios, resilience, operationalGuidance, historicalAnalytics]);

  const monitoringDashboard = useMemo(() => {
    if (!health) return null;
    return buildTreasuryMonitoringDashboard({
      treasury_health_snapshots: history,
      historicalAnalytics: historicalAnalytics || {},
      trends: trends || {},
      forecast: forecast || {},
      resilience: resilience || {},
      operationalGuidance: operationalGuidance || {},
      classifiedAlerts: alertClassification || {},
    });
  }, [health, history, historicalAnalytics, trends, forecast, resilience, operationalGuidance, alertClassification]);

  const treasuryReadiness = useMemo(() => {
    if (!health || !operationalGuidance) return null;
    return calculateTreasuryReadiness({
      treasuryHealth: health,
      trends: trends || {},
      forecast: forecast || {},
      scenarios: scenarios || {},
      resilience: resilience || {},
      operationalGuidance,
      executiveSummary: executiveSummary || {},
      historicalAnalytics: historicalAnalytics || {},
      monitoringDashboard: monitoringDashboard || {},
      classifiedAlerts: alertClassification || {},
      simulator: simulationResult || undefined,
    });
  }, [
    health,
    trends,
    forecast,
    scenarios,
    resilience,
    operationalGuidance,
    executiveSummary,
    historicalAnalytics,
    monitoringDashboard,
    alertClassification,
    simulationResult,
  ]);

  const treasuryDrift = useMemo(() => {
    if (!health || !treasuryReadiness) return null;
    return detectTreasuryDrift({
      treasury_health_snapshots: history,
      trends: trends || {},
      forecast: forecast || {},
      resilience: resilience || {},
      monitoringDashboard: monitoringDashboard || {},
      readiness: treasuryReadiness,
      classifiedAlerts: alertClassification || {},
    });
  }, [
    health,
    history,
    trends,
    forecast,
    resilience,
    monitoringDashboard,
    treasuryReadiness,
    alertClassification,
  ]);

  const treasuryStability = useMemo(() => {
    if (!health || !treasuryReadiness || !treasuryDrift) return null;
    return calculateTreasuryStability({
      trends: trends || {},
      forecast: forecast || {},
      resilience: resilience || {},
      readiness: treasuryReadiness,
      monitoringDashboard: monitoringDashboard || {},
      driftDetection: treasuryDrift,
      historicalAnalytics: historicalAnalytics || {},
      classifiedAlerts: alertClassification || {},
    });
  }, [
    health,
    trends,
    forecast,
    resilience,
    treasuryReadiness,
    monitoringDashboard,
    treasuryDrift,
    historicalAnalytics,
    alertClassification,
  ]);

  const treasuryScalingReadiness = useMemo(() => {
    if (!health || !treasuryReadiness || !treasuryDrift || !treasuryStability || !operationalGuidance) {
      return null;
    }
    return calculateTreasuryScalingReadiness({
      treasuryHealth: health,
      forecast: forecast || {},
      resilience: resilience || {},
      readiness: treasuryReadiness,
      driftDetection: treasuryDrift,
      stability: treasuryStability,
      historicalAnalytics: historicalAnalytics || {},
      monitoringDashboard: monitoringDashboard || {},
      classifiedAlerts: alertClassification || {},
      operationalGuidance,
    });
  }, [
    health,
    forecast,
    resilience,
    treasuryReadiness,
    treasuryDrift,
    treasuryStability,
    historicalAnalytics,
    monitoringDashboard,
    alertClassification,
    operationalGuidance,
  ]);

  const treasuryIntegrity = useMemo(() => {
    if (
      !health ||
      !treasuryReadiness ||
      !treasuryDrift ||
      !treasuryStability ||
      !treasuryScalingReadiness ||
      !operationalGuidance
    ) {
      return null;
    }
    return calculateTreasuryIntegrity({
      treasuryHealth: health,
      trends: trends || {},
      forecast: forecast || {},
      resilience: resilience || {},
      readiness: treasuryReadiness,
      driftDetection: treasuryDrift,
      stability: treasuryStability,
      scalingReadiness: treasuryScalingReadiness,
      historicalAnalytics: historicalAnalytics || {},
      monitoringDashboard: monitoringDashboard || {},
      classifiedAlerts: alertClassification || {},
      operationalGuidance,
    });
  }, [
    health,
    trends,
    forecast,
    resilience,
    treasuryReadiness,
    treasuryDrift,
    treasuryStability,
    treasuryScalingReadiness,
    historicalAnalytics,
    monitoringDashboard,
    alertClassification,
    operationalGuidance,
  ]);

  const treasuryGovernance = useMemo(() => {
    if (
      !health ||
      !treasuryReadiness ||
      !treasuryDrift ||
      !treasuryStability ||
      !treasuryScalingReadiness ||
      !treasuryIntegrity ||
      !operationalGuidance
    ) {
      return null;
    }
    return calculateTreasuryGovernance({
      treasuryHealth: health,
      trends: trends || {},
      forecast: forecast || {},
      resilience: resilience || {},
      readiness: treasuryReadiness,
      driftDetection: treasuryDrift,
      stability: treasuryStability,
      scalingReadiness: treasuryScalingReadiness,
      treasuryIntegrity,
      historicalAnalytics: historicalAnalytics || {},
      monitoringDashboard: monitoringDashboard || {},
      classifiedAlerts: alertClassification || {},
      operationalGuidance,
    });
  }, [
    health,
    trends,
    forecast,
    resilience,
    treasuryReadiness,
    treasuryDrift,
    treasuryStability,
    treasuryScalingReadiness,
    treasuryIntegrity,
    historicalAnalytics,
    monitoringDashboard,
    alertClassification,
    operationalGuidance,
  ]);

  const treasuryOperatingMode = useMemo(() => {
    if (
      !health ||
      !treasuryReadiness ||
      !treasuryDrift ||
      !treasuryStability ||
      !treasuryScalingReadiness ||
      !treasuryIntegrity ||
      !treasuryGovernance ||
      !operationalGuidance
    ) {
      return null;
    }
    return calculateTreasuryOperatingMode({
      treasuryHealth: health,
      trends: trends || {},
      forecast: forecast || {},
      resilience: resilience || {},
      readiness: treasuryReadiness,
      driftDetection: treasuryDrift,
      stability: treasuryStability,
      scalingReadiness: treasuryScalingReadiness,
      treasuryIntegrity,
      treasuryGovernance,
      historicalAnalytics: historicalAnalytics || {},
      monitoringDashboard: monitoringDashboard || {},
      classifiedAlerts: alertClassification || {},
      operationalGuidance,
    });
  }, [
    health,
    trends,
    forecast,
    resilience,
    treasuryReadiness,
    treasuryDrift,
    treasuryStability,
    treasuryScalingReadiness,
    treasuryIntegrity,
    treasuryGovernance,
    historicalAnalytics,
    monitoringDashboard,
    alertClassification,
    operationalGuidance,
  ]);

  const unifiedTreasuryScore = useMemo(() => {
    if (!health) return null;
    return calculateUnifiedTreasuryScore({
      treasuryHealth: health,
      trends: trends || {},
      forecast: forecast || {},
      resilience: resilience || {},
      readiness: treasuryReadiness || {},
      driftDetection: treasuryDrift || {},
      stability: treasuryStability || {},
      scalingReadiness: treasuryScalingReadiness || {},
      treasuryIntegrity: treasuryIntegrity || {},
      treasuryGovernance: treasuryGovernance || {},
      treasuryOperatingMode: treasuryOperatingMode || {},
      operationalGuidance: operationalGuidance || {},
      monitoringDashboard: monitoringDashboard || {},
      classifiedAlerts: alertClassification || {},
      historicalAnalytics: historicalAnalytics || {},
    });
  }, [
    health,
    trends,
    forecast,
    resilience,
    treasuryReadiness,
    treasuryDrift,
    treasuryStability,
    treasuryScalingReadiness,
    treasuryIntegrity,
    treasuryGovernance,
    treasuryOperatingMode,
    operationalGuidance,
    monitoringDashboard,
    alertClassification,
    historicalAnalytics,
  ]);

  const boardTimeline = useMemo(() => {
    if (!health) return null;
    return buildTreasuryBoardTimeline({
      treasury_health_snapshots: history,
      unifiedScore: unifiedTreasuryScore || {},
      executiveSummary: executiveSummary || {},
      readiness: treasuryReadiness || {},
      stability: treasuryStability || {},
      scalingReadiness: treasuryScalingReadiness || {},
      treasuryGovernance: treasuryGovernance || {},
      treasuryIntegrity: treasuryIntegrity || {},
      driftDetection: treasuryDrift || {},
      treasuryOperatingMode: treasuryOperatingMode || {},
      historicalAnalytics: historicalAnalytics || {},
    });
  }, [
    health,
    history,
    unifiedTreasuryScore,
    executiveSummary,
    treasuryReadiness,
    treasuryStability,
    treasuryScalingReadiness,
    treasuryGovernance,
    treasuryIntegrity,
    treasuryDrift,
    treasuryOperatingMode,
    historicalAnalytics,
  ]);

  const treasuryNarrative = useMemo(() => {
    if (!health || !unifiedTreasuryScore || !boardTimeline) return null;
    return buildTreasuryNarrative({
      treasuryHealth: health,
      unifiedScore: unifiedTreasuryScore || {},
      boardTimeline: boardTimeline || {},
      executiveSummary: executiveSummary || {},
      readiness: treasuryReadiness || {},
      stability: treasuryStability || {},
      scalingReadiness: treasuryScalingReadiness || {},
      treasuryGovernance: treasuryGovernance || {},
      treasuryIntegrity: treasuryIntegrity || {},
      treasuryOperatingMode: treasuryOperatingMode || {},
      operationalGuidance: operationalGuidance || {},
      driftDetection: treasuryDrift || {},
      historicalAnalytics: historicalAnalytics || {},
      monitoringDashboard: monitoringDashboard || {},
      classifiedAlerts: alertClassification || {},
    });
  }, [
    health,
    unifiedTreasuryScore,
    boardTimeline,
    executiveSummary,
    treasuryReadiness,
    treasuryStability,
    treasuryScalingReadiness,
    treasuryGovernance,
    treasuryIntegrity,
    treasuryOperatingMode,
    operationalGuidance,
    treasuryDrift,
    historicalAnalytics,
    monitoringDashboard,
    alertClassification,
  ]);

  const treasuryExecutiveBriefing = useMemo(() => {
    if (!health || !unifiedTreasuryScore || !treasuryNarrative || !boardTimeline) return null;
    return buildTreasuryExecutiveBriefing({
      unifiedScore: unifiedTreasuryScore || {},
      treasuryNarrative: treasuryNarrative || {},
      boardTimeline: boardTimeline || {},
      executiveSummary: executiveSummary || {},
      readiness: treasuryReadiness || {},
      stability: treasuryStability || {},
      scalingReadiness: treasuryScalingReadiness || {},
      treasuryGovernance: treasuryGovernance || {},
      treasuryIntegrity: treasuryIntegrity || {},
      treasuryOperatingMode: treasuryOperatingMode || {},
      operationalGuidance: operationalGuidance || {},
      driftDetection: treasuryDrift || {},
      historicalAnalytics: historicalAnalytics || {},
      monitoringDashboard: monitoringDashboard || {},
      classifiedAlerts: alertClassification || {},
      treasuryHealth: health,
    });
  }, [
    health,
    unifiedTreasuryScore,
    treasuryNarrative,
    boardTimeline,
    executiveSummary,
    treasuryReadiness,
    treasuryStability,
    treasuryScalingReadiness,
    treasuryGovernance,
    treasuryIntegrity,
    treasuryOperatingMode,
    operationalGuidance,
    treasuryDrift,
    historicalAnalytics,
    monitoringDashboard,
    alertClassification,
  ]);

  const treasuryReadinessIndexResult = useMemo(() => {
    if (!health || !unifiedTreasuryScore || !treasuryExecutiveBriefing || !treasuryNarrative || !boardTimeline) {
      return null;
    }
    return calculateTreasuryReadinessIndex({
      unifiedScore: unifiedTreasuryScore || {},
      treasuryExecutiveBriefing: treasuryExecutiveBriefing || {},
      treasuryNarrative: treasuryNarrative || {},
      boardTimeline: boardTimeline || {},
      readiness: treasuryReadiness || {},
      stability: treasuryStability || {},
      scalingReadiness: treasuryScalingReadiness || {},
      treasuryGovernance: treasuryGovernance || {},
      treasuryIntegrity: treasuryIntegrity || {},
      treasuryOperatingMode: treasuryOperatingMode || {},
      operationalGuidance: operationalGuidance || {},
      driftDetection: treasuryDrift || {},
      monitoringDashboard: monitoringDashboard || {},
      historicalAnalytics: historicalAnalytics || {},
      classifiedAlerts: alertClassification || {},
      treasuryHealth: health,
    });
  }, [
    health,
    unifiedTreasuryScore,
    treasuryExecutiveBriefing,
    treasuryNarrative,
    boardTimeline,
    treasuryReadiness,
    treasuryStability,
    treasuryScalingReadiness,
    treasuryGovernance,
    treasuryIntegrity,
    treasuryOperatingMode,
    operationalGuidance,
    treasuryDrift,
    monitoringDashboard,
    historicalAnalytics,
    alertClassification,
  ]);

  const treasuryCommandCenter = useMemo(() => {
    if (
      !health ||
      !unifiedTreasuryScore ||
      !boardTimeline ||
      !treasuryNarrative ||
      !treasuryExecutiveBriefing ||
      !treasuryReadinessIndexResult
    ) {
      return null;
    }
    return buildTreasuryCommandCenter({
      unifiedScore: unifiedTreasuryScore || {},
      boardTimeline: boardTimeline || {},
      treasuryNarrative: treasuryNarrative || {},
      treasuryExecutiveBriefing: treasuryExecutiveBriefing || {},
      treasuryReadinessIndex: treasuryReadinessIndexResult || {},
      readiness: treasuryReadiness || {},
      stability: treasuryStability || {},
      treasuryGovernance: treasuryGovernance || {},
      treasuryIntegrity: treasuryIntegrity || {},
      scalingReadiness: treasuryScalingReadiness || {},
      treasuryOperatingMode: treasuryOperatingMode || {},
      operationalGuidance: operationalGuidance || {},
      monitoringDashboard: monitoringDashboard || {},
      historicalAnalytics: historicalAnalytics || {},
      classifiedAlerts: alertClassification || {},
      driftDetection: treasuryDrift || {},
      treasuryHealth: health,
    });
  }, [
    health,
    unifiedTreasuryScore,
    boardTimeline,
    treasuryNarrative,
    treasuryExecutiveBriefing,
    treasuryReadinessIndexResult,
    treasuryReadiness,
    treasuryStability,
    treasuryGovernance,
    treasuryIntegrity,
    treasuryScalingReadiness,
    treasuryOperatingMode,
    operationalGuidance,
    monitoringDashboard,
    historicalAnalytics,
    alertClassification,
    treasuryDrift,
  ]);

  const treasuryMonitoringSignals = useMemo(() => {
    if (!health || !treasuryCommandCenter || !treasuryReadinessIndexResult) return null;
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryMonitoringSignals({
      treasuryCommandCenter,
      readinessIndex: treasuryReadinessIndexResult,
      operationalGuidance: operationalGuidance || {},
      driftDetection: treasuryDrift || {},
      stability: treasuryStability || {},
      monitoringDashboard: monitoringDashboard || {},
      alerts: alertClassification || {},
      smallDollarMetrics: {
        pendingWithdrawalExposure: metrics.pendingWithdrawalExposure,
        totalWalletLiabilities: metrics.totalWalletLiabilities,
      },
    });
  }, [
    health,
    treasuryCommandCenter,
    treasuryReadinessIndexResult,
    operationalGuidance,
    treasuryDrift,
    treasuryStability,
    monitoringDashboard,
    alertClassification,
  ]);

  const treasuryAlertReadiness = useMemo(() => {
    if (!health || !treasuryMonitoringSignals) return null;
    const metrics = health?.sourceSnapshot?.metrics || {};
    return assessTreasuryAlertReadiness({
      treasuryOperationsState: treasuryMonitoringSignals,
      emittedMonitoringSummary: monitoringEmissionSummary,
      treasuryCommandCenter: treasuryCommandCenter || {},
      readinessIndex: treasuryReadinessIndexResult || {},
      classifiedAlerts: alertClassification || {},
      operationalGuidance: operationalGuidance || {},
      driftDetection: treasuryDrift || {},
      stability: treasuryStability || {},
      scalingReadiness: treasuryScalingReadiness || {},
      governance: treasuryGovernance || {},
      operatingMode: treasuryOperatingMode || {},
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryMonitoringSignals,
    monitoringEmissionSummary,
    treasuryCommandCenter,
    treasuryReadinessIndexResult,
    alertClassification,
    operationalGuidance,
    treasuryDrift,
    treasuryStability,
    treasuryScalingReadiness,
    treasuryGovernance,
    treasuryOperatingMode,
  ]);

  const treasuryAdminAlertsResult = useMemo(() => {
    if (!health || !treasuryMonitoringSignals || !treasuryAlertReadiness) return null;
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryAdminAlerts({
      treasuryAlertReadiness,
      emittedMonitoringSummary: monitoringEmissionSummary,
      operationalGuidance: operationalGuidance || {},
      classifiedAlerts: alertClassification || {},
      treasuryOperationsState: treasuryMonitoringSignals,
      readinessIndex: treasuryReadinessIndexResult || {},
      treasuryCommandCenter: treasuryCommandCenter || {},
      driftDetection: treasuryDrift || {},
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
      previousAlertFingerprint: adminAlertFingerprintRef.current,
    });
  }, [
    health,
    treasuryMonitoringSignals,
    treasuryAlertReadiness,
    monitoringEmissionSummary,
    operationalGuidance,
    alertClassification,
    treasuryReadinessIndexResult,
    treasuryCommandCenter,
    treasuryDrift,
  ]);

  useEffect(() => {
    if (treasuryAdminAlertsResult?.fingerprint) {
      adminAlertFingerprintRef.current = treasuryAdminAlertsResult.fingerprint;
    }
  }, [treasuryAdminAlertsResult?.fingerprint]);

  const treasuryNotificationReadiness = useMemo(() => {
    if (!health || !treasuryAlertReadiness || !treasuryAdminAlertsResult) return null;
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryNotificationReadiness({
      treasuryAdminAlerts: treasuryAdminAlertsResult,
      alertReadiness: treasuryAlertReadiness,
      monitoringSummary: monitoringEmissionSummary,
      treasuryCommandCenter: treasuryCommandCenter || {},
      readinessIndex: treasuryReadinessIndexResult || {},
      governance: treasuryGovernance || {},
      scalingReadiness: treasuryScalingReadiness || {},
      operatingMode: treasuryOperatingMode || {},
      operationalGuidance: operationalGuidance || {},
      treasuryOperationsState: treasuryMonitoringSignals || {},
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryAlertReadiness,
    treasuryAdminAlertsResult,
    monitoringEmissionSummary,
    treasuryCommandCenter,
    treasuryReadinessIndexResult,
    treasuryGovernance,
    treasuryScalingReadiness,
    treasuryOperatingMode,
    operationalGuidance,
    treasuryMonitoringSignals,
  ]);

  const treasuryDigestIntelligence = useMemo(() => {
    if (
      !health ||
      !treasuryCommandCenter ||
      !treasuryMonitoringSignals ||
      !treasuryAlertReadiness ||
      !treasuryAdminAlertsResult ||
      !treasuryNotificationReadiness
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryDigestIntelligence({
      treasuryCommandCenter,
      readinessIndex: treasuryReadinessIndexResult || {},
      executiveBriefing: treasuryExecutiveBriefing || {},
      historicalAnalytics: historicalAnalytics || {},
      monitoringDashboard: monitoringDashboard || {},
      operationalGuidance: operationalGuidance || {},
      treasuryAdminAlerts: treasuryAdminAlertsResult,
      notificationReadiness: treasuryNotificationReadiness,
      alertReadiness: treasuryAlertReadiness,
      treasuryOperationsState: treasuryMonitoringSignals,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryCommandCenter,
    treasuryReadinessIndexResult,
    treasuryExecutiveBriefing,
    historicalAnalytics,
    monitoringDashboard,
    operationalGuidance,
    treasuryAdminAlertsResult,
    treasuryNotificationReadiness,
    treasuryAlertReadiness,
    treasuryMonitoringSignals,
  ]);

  const treasuryExecutiveEscalation = useMemo(() => {
    if (
      !health ||
      !treasuryCommandCenter ||
      !treasuryMonitoringSignals ||
      !treasuryAlertReadiness ||
      !treasuryAdminAlertsResult ||
      !treasuryNotificationReadiness ||
      !treasuryDigestIntelligence
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryExecutiveEscalation({
      treasuryCommandCenter,
      readinessIndex: treasuryReadinessIndexResult || {},
      executiveBriefing: treasuryExecutiveBriefing || {},
      digestIntelligence: treasuryDigestIntelligence,
      alertReadiness: treasuryAlertReadiness,
      notificationReadiness: treasuryNotificationReadiness,
      treasuryAdminAlerts: treasuryAdminAlertsResult,
      operationalGuidance: operationalGuidance || {},
      monitoringDashboard: monitoringDashboard || {},
      governance: treasuryGovernance || {},
      scalingReadiness: treasuryScalingReadiness || {},
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryCommandCenter,
    treasuryReadinessIndexResult,
    treasuryExecutiveBriefing,
    treasuryDigestIntelligence,
    treasuryAlertReadiness,
    treasuryNotificationReadiness,
    treasuryAdminAlertsResult,
    operationalGuidance,
    monitoringDashboard,
    treasuryGovernance,
    treasuryScalingReadiness,
    treasuryMonitoringSignals,
  ]);

  const treasuryDecisionSupport = useMemo(() => {
    if (
      !health ||
      !treasuryCommandCenter ||
      !treasuryMonitoringSignals ||
      !treasuryAlertReadiness ||
      !treasuryAdminAlertsResult ||
      !treasuryNotificationReadiness ||
      !treasuryDigestIntelligence ||
      !treasuryExecutiveEscalation
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryDecisionSupport({
      treasuryCommandCenter,
      operationalGuidance: operationalGuidance || {},
      readinessIndex: treasuryReadinessIndexResult || {},
      monitoringDashboard: monitoringDashboard || {},
      treasuryAdminAlerts: treasuryAdminAlertsResult,
      alertReadiness: treasuryAlertReadiness,
      notificationReadiness: treasuryNotificationReadiness,
      digestIntelligence: treasuryDigestIntelligence,
      executiveEscalation: treasuryExecutiveEscalation,
      treasuryOperatingMode: treasuryOperatingMode || {},
      governance: treasuryGovernance || {},
      scalingReadiness: treasuryScalingReadiness || {},
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryCommandCenter,
    treasuryReadinessIndexResult,
    operationalGuidance,
    monitoringDashboard,
    treasuryAdminAlertsResult,
    treasuryAlertReadiness,
    treasuryNotificationReadiness,
    treasuryDigestIntelligence,
    treasuryExecutiveEscalation,
    treasuryOperatingMode,
    treasuryGovernance,
    treasuryScalingReadiness,
    treasuryMonitoringSignals,
  ]);

  const treasuryInstitutionalMemory = useMemo(() => {
    if (
      !health ||
      !treasuryMonitoringSignals ||
      !treasuryAlertReadiness ||
      !treasuryAdminAlertsResult ||
      !treasuryDecisionSupport
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryInstitutionalMemory({
      treasuryOperationalEvents: operationalEventsForMemory,
      treasuryAdminAlerts: treasuryAdminAlertsResult,
      digestIntelligence: treasuryDigestIntelligence || {},
      executiveEscalation: treasuryExecutiveEscalation || {},
      decisionSupport: treasuryDecisionSupport,
      monitoringSummary: monitoringEmissionSummary,
      alertReadiness: treasuryAlertReadiness,
      treasuryCommandCenter: treasuryCommandCenter || {},
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryMonitoringSignals,
    treasuryAlertReadiness,
    treasuryAdminAlertsResult,
    treasuryDecisionSupport,
    operationalEventsForMemory,
    treasuryDigestIntelligence,
    treasuryExecutiveEscalation,
    monitoringEmissionSummary,
    treasuryCommandCenter,
  ]);

  const treasuryConfidenceExplainability = useMemo(() => {
    if (
      !health ||
      !treasuryMonitoringSignals ||
      !treasuryCommandCenter ||
      !treasuryReadinessIndexResult ||
      !treasuryAlertReadiness ||
      !treasuryNotificationReadiness ||
      !treasuryDigestIntelligence ||
      !treasuryExecutiveEscalation ||
      !treasuryDecisionSupport ||
      !treasuryInstitutionalMemory
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryConfidenceExplainability({
      monitoringDashboard: monitoringDashboard || {},
      treasuryAdminAlerts: treasuryAdminAlertsResult || {},
      alertReadiness: treasuryAlertReadiness,
      notificationReadiness: treasuryNotificationReadiness,
      digestIntelligence: treasuryDigestIntelligence,
      executiveEscalation: treasuryExecutiveEscalation,
      decisionSupport: treasuryDecisionSupport,
      institutionalMemory: treasuryInstitutionalMemory,
      operationalGuidance: operationalGuidance || {},
      readinessIndex: treasuryReadinessIndexResult,
      treasuryCommandCenter,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryMonitoringSignals,
    treasuryCommandCenter,
    treasuryReadinessIndexResult,
    treasuryAlertReadiness,
    treasuryNotificationReadiness,
    treasuryDigestIntelligence,
    treasuryExecutiveEscalation,
    treasuryDecisionSupport,
    treasuryInstitutionalMemory,
    treasuryAdminAlertsResult,
    monitoringDashboard,
    operationalGuidance,
  ]);

  const treasuryConsistencyCheck = useMemo(() => {
    if (
      !health ||
      !treasuryAlertReadiness ||
      !treasuryNotificationReadiness ||
      !treasuryDigestIntelligence ||
      !treasuryExecutiveEscalation ||
      !treasuryDecisionSupport ||
      !treasuryInstitutionalMemory ||
      !treasuryConfidenceExplainability
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryConsistencyCheck({
      executiveEscalation: treasuryExecutiveEscalation,
      decisionSupport: treasuryDecisionSupport,
      institutionalMemory: treasuryInstitutionalMemory,
      confidenceExplainability: treasuryConfidenceExplainability,
      digestIntelligence: treasuryDigestIntelligence,
      operationalGuidance: operationalGuidance || {},
      alertReadiness: treasuryAlertReadiness,
      notificationReadiness: treasuryNotificationReadiness,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryAlertReadiness,
    treasuryNotificationReadiness,
    treasuryDigestIntelligence,
    treasuryExecutiveEscalation,
    treasuryDecisionSupport,
    treasuryInstitutionalMemory,
    treasuryConfidenceExplainability,
    operationalGuidance,
  ]);

  const treasuryRiskNarrative = useMemo(() => {
    if (
      !health ||
      !treasuryCommandCenter ||
      !treasuryDigestIntelligence ||
      !treasuryExecutiveEscalation ||
      !treasuryDecisionSupport ||
      !treasuryInstitutionalMemory ||
      !treasuryConfidenceExplainability ||
      !treasuryConsistencyCheck
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryRiskNarrative({
      treasuryCommandCenter,
      executiveBriefing: treasuryExecutiveBriefing || {},
      digestIntelligence: treasuryDigestIntelligence,
      executiveEscalation: treasuryExecutiveEscalation,
      decisionSupport: treasuryDecisionSupport,
      institutionalMemory: treasuryInstitutionalMemory,
      confidenceExplainability: treasuryConfidenceExplainability,
      consistencyCheck: treasuryConsistencyCheck,
      readinessIndex: treasuryReadinessIndexResult || {},
      operationalGuidance: operationalGuidance || {},
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryCommandCenter,
    treasuryExecutiveBriefing,
    treasuryDigestIntelligence,
    treasuryExecutiveEscalation,
    treasuryDecisionSupport,
    treasuryInstitutionalMemory,
    treasuryConfidenceExplainability,
    treasuryConsistencyCheck,
    treasuryReadinessIndexResult,
    operationalGuidance,
  ]);

  const treasuryOperationalPlaybook = useMemo(() => {
    if (
      !health ||
      !treasuryRiskNarrative ||
      !treasuryExecutiveEscalation ||
      !treasuryDecisionSupport ||
      !treasuryInstitutionalMemory ||
      !treasuryConfidenceExplainability ||
      !treasuryConsistencyCheck ||
      !treasuryCommandCenter
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryOperationalPlaybook({
      treasuryRiskNarrative,
      decisionSupport: treasuryDecisionSupport,
      executiveEscalation: treasuryExecutiveEscalation,
      institutionalMemory: treasuryInstitutionalMemory,
      consistencyCheck: treasuryConsistencyCheck,
      confidenceExplainability: treasuryConfidenceExplainability,
      treasuryCommandCenter,
      readinessIndex: treasuryReadinessIndexResult || {},
      treasuryOperatingMode: treasuryOperatingMode || {},
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryRiskNarrative,
    treasuryExecutiveEscalation,
    treasuryDecisionSupport,
    treasuryInstitutionalMemory,
    treasuryConfidenceExplainability,
    treasuryConsistencyCheck,
    treasuryCommandCenter,
    treasuryReadinessIndexResult,
    treasuryOperatingMode,
  ]);

  const treasuryScenarioResponse = useMemo(() => {
    if (
      !health ||
      !treasuryRiskNarrative ||
      !treasuryOperationalPlaybook ||
      !treasuryExecutiveEscalation ||
      !treasuryDecisionSupport ||
      !treasuryConfidenceExplainability ||
      !treasuryConsistencyCheck ||
      !treasuryCommandCenter
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryScenarioResponse({
      treasuryRiskNarrative,
      operationalPlaybook: treasuryOperationalPlaybook,
      executiveEscalation: treasuryExecutiveEscalation,
      decisionSupport: treasuryDecisionSupport,
      confidenceExplainability: treasuryConfidenceExplainability,
      consistencyCheck: treasuryConsistencyCheck,
      treasuryCommandCenter,
      treasuryOperatingMode: treasuryOperatingMode || {},
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryRiskNarrative,
    treasuryOperationalPlaybook,
    treasuryExecutiveEscalation,
    treasuryDecisionSupport,
    treasuryConfidenceExplainability,
    treasuryConsistencyCheck,
    treasuryCommandCenter,
    treasuryOperatingMode,
  ]);

  const treasuryOperatorTimeline = useMemo(() => {
    if (
      !health ||
      !treasuryScenarioResponse ||
      !treasuryOperationalPlaybook ||
      !treasuryRiskNarrative ||
      !treasuryExecutiveEscalation ||
      !treasuryDecisionSupport ||
      !treasuryInstitutionalMemory ||
      !treasuryConfidenceExplainability ||
      !treasuryConsistencyCheck
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryOperatorTimeline({
      scenarioResponse: treasuryScenarioResponse,
      operationalPlaybook: treasuryOperationalPlaybook,
      treasuryRiskNarrative,
      decisionSupport: treasuryDecisionSupport,
      executiveEscalation: treasuryExecutiveEscalation,
      consistencyCheck: treasuryConsistencyCheck,
      confidenceExplainability: treasuryConfidenceExplainability,
      institutionalMemory: treasuryInstitutionalMemory,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryScenarioResponse,
    treasuryOperationalPlaybook,
    treasuryRiskNarrative,
    treasuryExecutiveEscalation,
    treasuryDecisionSupport,
    treasuryInstitutionalMemory,
    treasuryConfidenceExplainability,
    treasuryConsistencyCheck,
  ]);

  const treasuryAttentionPriority = useMemo(() => {
    if (
      !health ||
      !treasuryOperatorTimeline ||
      !treasuryScenarioResponse ||
      !treasuryOperationalPlaybook ||
      !treasuryRiskNarrative ||
      !treasuryExecutiveEscalation ||
      !treasuryDecisionSupport ||
      !treasuryInstitutionalMemory ||
      !treasuryConfidenceExplainability ||
      !treasuryConsistencyCheck
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryAttentionPriority({
      operatorTimeline: treasuryOperatorTimeline,
      treasuryRiskNarrative,
      scenarioResponse: treasuryScenarioResponse,
      decisionSupport: treasuryDecisionSupport,
      operationalPlaybook: treasuryOperationalPlaybook,
      executiveEscalation: treasuryExecutiveEscalation,
      confidenceExplainability: treasuryConfidenceExplainability,
      consistencyCheck: treasuryConsistencyCheck,
      institutionalMemory: treasuryInstitutionalMemory,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryOperatorTimeline,
    treasuryScenarioResponse,
    treasuryOperationalPlaybook,
    treasuryRiskNarrative,
    treasuryExecutiveEscalation,
    treasuryDecisionSupport,
    treasuryInstitutionalMemory,
    treasuryConfidenceExplainability,
    treasuryConsistencyCheck,
  ]);

  const treasuryOperationalCoherence = useMemo(() => {
    if (
      !health ||
      !treasuryRiskNarrative ||
      !treasuryOperationalPlaybook ||
      !treasuryScenarioResponse ||
      !treasuryOperatorTimeline ||
      !treasuryAttentionPriority ||
      !treasuryExecutiveEscalation ||
      !treasuryDecisionSupport ||
      !treasuryInstitutionalMemory ||
      !treasuryConfidenceExplainability ||
      !treasuryConsistencyCheck
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryOperationalCoherence({
      consistencyCheck: treasuryConsistencyCheck,
      confidenceExplainability: treasuryConfidenceExplainability,
      treasuryRiskNarrative,
      operationalPlaybook: treasuryOperationalPlaybook,
      scenarioResponse: treasuryScenarioResponse,
      operatorTimeline: treasuryOperatorTimeline,
      attentionPriority: treasuryAttentionPriority,
      executiveEscalation: treasuryExecutiveEscalation,
      decisionSupport: treasuryDecisionSupport,
      institutionalMemory: treasuryInstitutionalMemory,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryRiskNarrative,
    treasuryOperationalPlaybook,
    treasuryScenarioResponse,
    treasuryOperatorTimeline,
    treasuryAttentionPriority,
    treasuryExecutiveEscalation,
    treasuryDecisionSupport,
    treasuryInstitutionalMemory,
    treasuryConfidenceExplainability,
    treasuryConsistencyCheck,
  ]);

  const treasuryAdaptiveReviewCadence = useMemo(() => {
    if (
      !treasuryOperationalCoherence ||
      !treasuryOperatorTimeline ||
      !treasuryAttentionPriority ||
      !treasuryExecutiveEscalation ||
      !treasuryOperationalPlaybook ||
      !treasuryDecisionSupport ||
      !treasuryRiskNarrative ||
      !treasuryConfidenceExplainability
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryAdaptiveReviewCadence({
      operationalCoherence: treasuryOperationalCoherence,
      operatorTimeline: treasuryOperatorTimeline,
      attentionPriority: treasuryAttentionPriority,
      executiveEscalation: treasuryExecutiveEscalation,
      operationalPlaybook: treasuryOperationalPlaybook,
      decisionSupport: treasuryDecisionSupport,
      treasuryRiskNarrative,
      confidenceExplainability: treasuryConfidenceExplainability,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryOperationalCoherence,
    treasuryOperatorTimeline,
    treasuryAttentionPriority,
    treasuryExecutiveEscalation,
    treasuryOperationalPlaybook,
    treasuryDecisionSupport,
    treasuryRiskNarrative,
    treasuryConfidenceExplainability,
  ]);

  const treasuryLeadershipReadiness = useMemo(() => {
    if (
      !treasuryAdaptiveReviewCadence ||
      !treasuryOperationalCoherence ||
      !treasuryAttentionPriority ||
      !treasuryExecutiveEscalation ||
      !treasuryRiskNarrative ||
      !treasuryOperatorTimeline ||
      !treasuryOperationalPlaybook ||
      !treasuryInstitutionalMemory ||
      !treasuryConfidenceExplainability ||
      !treasuryDecisionSupport
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryLeadershipReadiness({
      adaptiveReviewCadence: treasuryAdaptiveReviewCadence,
      operationalCoherence: treasuryOperationalCoherence,
      attentionPriority: treasuryAttentionPriority,
      executiveEscalation: treasuryExecutiveEscalation,
      treasuryRiskNarrative,
      operatorTimeline: treasuryOperatorTimeline,
      operationalPlaybook: treasuryOperationalPlaybook,
      institutionalMemory: treasuryInstitutionalMemory,
      confidenceExplainability: treasuryConfidenceExplainability,
      decisionSupport: treasuryDecisionSupport,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryAdaptiveReviewCadence,
    treasuryOperationalCoherence,
    treasuryAttentionPriority,
    treasuryExecutiveEscalation,
    treasuryRiskNarrative,
    treasuryOperatorTimeline,
    treasuryOperationalPlaybook,
    treasuryInstitutionalMemory,
    treasuryConfidenceExplainability,
    treasuryDecisionSupport,
  ]);

  const treasuryMetaReasoning = useMemo(() => {
    if (
      !treasuryConfidenceExplainability ||
      !treasuryOperationalCoherence ||
      !treasuryLeadershipReadiness ||
      !treasuryAdaptiveReviewCadence ||
      !treasuryDecisionSupport ||
      !treasuryInstitutionalMemory ||
      !treasuryRiskNarrative ||
      !treasuryAttentionPriority ||
      !treasuryConsistencyCheck ||
      !treasuryOperatorTimeline
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryMetaReasoning({
      confidenceExplainability: treasuryConfidenceExplainability,
      operationalCoherence: treasuryOperationalCoherence,
      leadershipReadiness: treasuryLeadershipReadiness,
      adaptiveReviewCadence: treasuryAdaptiveReviewCadence,
      decisionSupport: treasuryDecisionSupport,
      institutionalMemory: treasuryInstitutionalMemory,
      treasuryRiskNarrative,
      attentionPriority: treasuryAttentionPriority,
      consistencyCheck: treasuryConsistencyCheck,
      operatorTimeline: treasuryOperatorTimeline,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryConfidenceExplainability,
    treasuryOperationalCoherence,
    treasuryLeadershipReadiness,
    treasuryAdaptiveReviewCadence,
    treasuryDecisionSupport,
    treasuryInstitutionalMemory,
    treasuryRiskNarrative,
    treasuryAttentionPriority,
    treasuryConsistencyCheck,
    treasuryOperatorTimeline,
  ]);

  const treasuryDecisionTrace = useMemo(() => {
    if (
      !treasuryMonitoringSignals ||
      !treasuryAlertReadiness ||
      !treasuryAdminAlertsResult ||
      !treasuryDigestIntelligence ||
      !treasuryExecutiveEscalation ||
      !treasuryDecisionSupport ||
      !treasuryInstitutionalMemory ||
      !treasuryConfidenceExplainability ||
      !treasuryOperationalCoherence ||
      !treasuryAdaptiveReviewCadence ||
      !treasuryLeadershipReadiness ||
      !treasuryMetaReasoning
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryDecisionTrace({
      monitoringIntelligence: treasuryMonitoringSignals,
      alertReadiness: treasuryAlertReadiness,
      treasuryAdminAlerts: treasuryAdminAlertsResult,
      digestIntelligence: treasuryDigestIntelligence,
      executiveEscalation: treasuryExecutiveEscalation,
      decisionSupport: treasuryDecisionSupport,
      institutionalMemory: treasuryInstitutionalMemory,
      confidenceExplainability: treasuryConfidenceExplainability,
      operationalCoherence: treasuryOperationalCoherence,
      adaptiveReviewCadence: treasuryAdaptiveReviewCadence,
      leadershipReadiness: treasuryLeadershipReadiness,
      metaReasoning: treasuryMetaReasoning,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryMonitoringSignals,
    treasuryAlertReadiness,
    treasuryAdminAlertsResult,
    treasuryDigestIntelligence,
    treasuryExecutiveEscalation,
    treasuryDecisionSupport,
    treasuryInstitutionalMemory,
    treasuryConfidenceExplainability,
    treasuryOperationalCoherence,
    treasuryAdaptiveReviewCadence,
    treasuryLeadershipReadiness,
    treasuryMetaReasoning,
  ]);

  const treasuryRecommendationStability = useMemo(() => {
    if (
      !treasuryDecisionSupport ||
      !treasuryAttentionPriority ||
      !treasuryOperationalCoherence ||
      !treasuryLeadershipReadiness ||
      !treasuryAdaptiveReviewCadence ||
      !treasuryMetaReasoning ||
      !treasuryDecisionTrace ||
      !treasuryConfidenceExplainability ||
      !treasuryInstitutionalMemory
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryRecommendationStability({
      treasuryOperationalEvents: operationalEventsForMemory,
      decisionSupport: treasuryDecisionSupport,
      attentionPriority: treasuryAttentionPriority,
      operationalCoherence: treasuryOperationalCoherence,
      leadershipReadiness: treasuryLeadershipReadiness,
      adaptiveReviewCadence: treasuryAdaptiveReviewCadence,
      metaReasoning: treasuryMetaReasoning,
      decisionTrace: treasuryDecisionTrace,
      confidenceExplainability: treasuryConfidenceExplainability,
      institutionalMemory: treasuryInstitutionalMemory,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    operationalEventsForMemory,
    treasuryDecisionSupport,
    treasuryAttentionPriority,
    treasuryOperationalCoherence,
    treasuryLeadershipReadiness,
    treasuryAdaptiveReviewCadence,
    treasuryMetaReasoning,
    treasuryDecisionTrace,
    treasuryConfidenceExplainability,
    treasuryInstitutionalMemory,
  ]);

  const treasuryAdvisoryDrift = useMemo(() => {
    if (
      !treasuryDecisionSupport ||
      !treasuryAttentionPriority ||
      !treasuryOperationalCoherence ||
      !treasuryLeadershipReadiness ||
      !treasuryAdaptiveReviewCadence ||
      !treasuryMetaReasoning ||
      !treasuryDecisionTrace ||
      !treasuryConfidenceExplainability ||
      !treasuryInstitutionalMemory ||
      !treasuryRecommendationStability
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryAdvisoryDrift({
      treasuryOperationalEvents: operationalEventsForMemory,
      recommendationStability: treasuryRecommendationStability,
      operationalCoherence: treasuryOperationalCoherence,
      leadershipReadiness: treasuryLeadershipReadiness,
      decisionSupport: treasuryDecisionSupport,
      attentionPriority: treasuryAttentionPriority,
      confidenceExplainability: treasuryConfidenceExplainability,
      metaReasoning: treasuryMetaReasoning,
      adaptiveReviewCadence: treasuryAdaptiveReviewCadence,
      institutionalMemory: treasuryInstitutionalMemory,
      decisionTrace: treasuryDecisionTrace,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    operationalEventsForMemory,
    treasuryRecommendationStability,
    treasuryDecisionSupport,
    treasuryAttentionPriority,
    treasuryOperationalCoherence,
    treasuryLeadershipReadiness,
    treasuryAdaptiveReviewCadence,
    treasuryMetaReasoning,
    treasuryDecisionTrace,
    treasuryConfidenceExplainability,
    treasuryInstitutionalMemory,
  ]);

  const treasuryRegimeDetection = useMemo(() => {
    if (
      !treasuryDecisionSupport ||
      !treasuryAttentionPriority ||
      !treasuryOperationalCoherence ||
      !treasuryLeadershipReadiness ||
      !treasuryAdaptiveReviewCadence ||
      !treasuryMetaReasoning ||
      !treasuryDecisionTrace ||
      !treasuryConfidenceExplainability ||
      !treasuryInstitutionalMemory ||
      !treasuryRecommendationStability ||
      !treasuryAdvisoryDrift ||
      !treasuryScenarioResponse
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryRegimeDetection({
      operationalCoherence: treasuryOperationalCoherence,
      recommendationStability: treasuryRecommendationStability,
      advisoryDrift: treasuryAdvisoryDrift,
      confidenceExplainability: treasuryConfidenceExplainability,
      leadershipReadiness: treasuryLeadershipReadiness,
      attentionPriority: treasuryAttentionPriority,
      adaptiveReviewCadence: treasuryAdaptiveReviewCadence,
      scenarioResponse: treasuryScenarioResponse,
      metaReasoning: treasuryMetaReasoning,
      decisionSupport: treasuryDecisionSupport,
      decisionTrace: treasuryDecisionTrace,
      institutionalMemory: treasuryInstitutionalMemory,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryOperationalCoherence,
    treasuryRecommendationStability,
    treasuryAdvisoryDrift,
    treasuryConfidenceExplainability,
    treasuryLeadershipReadiness,
    treasuryAttentionPriority,
    treasuryAdaptiveReviewCadence,
    treasuryScenarioResponse,
    treasuryMetaReasoning,
    treasuryDecisionSupport,
    treasuryDecisionTrace,
    treasuryInstitutionalMemory,
  ]);

  const treasuryAdvisoryOutlook = useMemo(() => {
    if (
      !treasuryRegimeDetection ||
      !treasuryAdvisoryDrift ||
      !treasuryRecommendationStability ||
      !treasuryOperationalCoherence ||
      !treasuryConfidenceExplainability ||
      !treasuryLeadershipReadiness ||
      !treasuryAdaptiveReviewCadence ||
      !treasuryDecisionSupport ||
      !treasuryDecisionTrace ||
      !treasuryMetaReasoning ||
      !treasuryInstitutionalMemory ||
      !treasuryScenarioResponse ||
      !treasuryAttentionPriority
    ) {
      return null;
    }
    const metrics = health?.sourceSnapshot?.metrics || {};
    return buildTreasuryAdvisoryOutlook({
      advisoryRegimeDetection: treasuryRegimeDetection,
      advisoryDrift: treasuryAdvisoryDrift,
      recommendationStability: treasuryRecommendationStability,
      operationalCoherence: treasuryOperationalCoherence,
      confidenceExplainability: treasuryConfidenceExplainability,
      leadershipReadiness: treasuryLeadershipReadiness,
      adaptiveReviewCadence: treasuryAdaptiveReviewCadence,
      attentionPriority: treasuryAttentionPriority,
      decisionSupport: treasuryDecisionSupport,
      decisionTrace: treasuryDecisionTrace,
      metaReasoning: treasuryMetaReasoning,
      institutionalMemory: treasuryInstitutionalMemory,
      scenarioResponse: treasuryScenarioResponse,
      smallDollarEnvironment: undefined,
      liabilities: metrics.totalWalletLiabilities,
      exposure: metrics.pendingWithdrawalExposure,
    });
  }, [
    health,
    treasuryRegimeDetection,
    treasuryAdvisoryDrift,
    treasuryRecommendationStability,
    treasuryOperationalCoherence,
    treasuryConfidenceExplainability,
    treasuryLeadershipReadiness,
    treasuryAdaptiveReviewCadence,
    treasuryAttentionPriority,
    treasuryDecisionSupport,
    treasuryDecisionTrace,
    treasuryMetaReasoning,
    treasuryInstitutionalMemory,
    treasuryScenarioResponse,
  ]);

  const loadOperationalEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const rows = await fetchTreasuryOperationalEvents(supabase, { limit: 50 });
      setOperationalEventsForMemory(rows);
      setOperationalEvents(rows.slice(0, 10));
    } catch {
      setOperationalEventsForMemory([]);
      setOperationalEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const loadTreasuryCenterEvents = useCallback(async () => {
    setTreasuryCenterLoading(true);
    setTreasuryCenterError(null);
    try {
      const res = await fetchTreasuryEvents(supabase, { perSourceLimit: 40, limit: 200 });
      const events = res.events || [];
      setTreasuryCenterEvents(events);
      setTreasuryCenterSources(res.sources || {});

      const resolutionRes = await fetchTreasuryEventResolutionsMap(
        supabase,
        events.map((e) => e.id),
      );
      setEventResolutionsByEventId(resolutionRes.resolutionsByEventId || {});
      setEventResolutionTableMissing(Boolean(resolutionRes.tableMissing));
    } catch (err) {
      setTreasuryCenterEvents([]);
      setTreasuryCenterSources({});
      setEventResolutionsByEventId({});
      setTreasuryCenterError(err?.message || "Failed to load treasury events.");
    } finally {
      setTreasuryCenterLoading(false);
    }
  }, []);

  const treasuryEventSummary = useMemo(
    () => buildTreasuryEventSummary(treasuryCenterEvents),
    [treasuryCenterEvents],
  );

  const treasuryEventHealth = useMemo(
    () => buildTreasuryEventHealth(treasuryCenterEvents),
    [treasuryCenterEvents],
  );

  const filteredTreasuryCenterEvents = useMemo(() => {
    return treasuryCenterEvents.filter((evt) => {
      if (eventCenterSeverityFilter !== "all" && evt.severity !== eventCenterSeverityFilter) return false;
      if (eventCenterCategoryFilter !== "all" && evt.category !== eventCenterCategoryFilter) return false;
      if (eventCenterSourceFilter !== "all" && evt.source !== eventCenterSourceFilter) return false;
      return true;
    });
  }, [
    treasuryCenterEvents,
    eventCenterSeverityFilter,
    eventCenterCategoryFilter,
    eventCenterSourceFilter,
  ]);

  const loadEventInvestigationNotes = useCallback(async (eventId) => {
    if (!eventId) {
      setEventInvestigationNotes([]);
      return;
    }
    setEventNotesLoading(true);
    setEventNotesError(null);
    setEventNotesTableMissing(false);
    try {
      const res = await fetchTreasuryEventInvestigationNotes(supabase, eventId);
      setEventInvestigationNotes(res.notes || []);
      setEventNotesTableMissing(Boolean(res.tableMissing));
      if (res.error) setEventNotesError(res.error);
    } catch (err) {
      setEventInvestigationNotes([]);
      setEventNotesError(err?.message || "Failed to load investigation notes.");
    } finally {
      setEventNotesLoading(false);
    }
  }, []);

  const loadEventResolution = useCallback(async (eventId) => {
    if (!eventId) {
      setCurrentEventResolution(null);
      setResolutionStatusDraft("open");
      setResolutionSummaryDraft("");
      setResolutionAssignedToDraft("");
      return;
    }
    setEventResolutionLoading(true);
    setEventResolutionError(null);
    try {
      const res = await fetchTreasuryEventResolution(supabase, eventId);
      setEventResolutionTableMissing(Boolean(res.tableMissing));
      if (res.error) setEventResolutionError(res.error);
      const resolution = res.resolution;
      setCurrentEventResolution(resolution);
      setResolutionStatusDraft(resolution?.status || "open");
      setResolutionSummaryDraft(resolution?.resolutionSummary || "");
      setResolutionAssignedToDraft(resolution?.assignedTo || "");
    } catch (err) {
      setCurrentEventResolution(null);
      setEventResolutionError(err?.message || "Failed to load resolution.");
    } finally {
      setEventResolutionLoading(false);
    }
  }, []);

  const openTreasuryEventDrawer = useCallback(
    (evt) => {
      setSelectedTreasuryEvent(evt);
      setEventNoteDraft("");
      setEventNotesError(null);
      setEventResolutionError(null);
      void loadEventInvestigationNotes(evt?.id);
      void loadEventResolution(evt?.id);
    },
    [loadEventInvestigationNotes, loadEventResolution],
  );

  const closeTreasuryEventDrawer = useCallback(() => {
    setSelectedTreasuryEvent(null);
    setEventInvestigationNotes([]);
    setEventNoteDraft("");
    setEventNotesError(null);
    setEventNotesTableMissing(false);
    setCurrentEventResolution(null);
    setResolutionStatusDraft("open");
    setResolutionSummaryDraft("");
    setResolutionAssignedToDraft("");
    setEventResolutionError(null);
  }, []);

  const handleSaveEventResolution = useCallback(async () => {
    if (!selectedTreasuryEvent?.id) return;
    setEventResolutionSaving(true);
    setEventResolutionError(null);
    try {
      const res = await upsertTreasuryEventResolution(supabase, {
        eventId: selectedTreasuryEvent.id,
        eventSource: selectedTreasuryEvent.source,
        eventCategory: selectedTreasuryEvent.category,
        status: resolutionStatusDraft,
        resolutionSummary: resolutionSummaryDraft,
        assignedTo: resolutionAssignedToDraft.trim() || null,
        actorUserId: user?.id || null,
      });
      if (!res.ok) {
        setEventResolutionError(
          res.tableMissing
            ? "Resolution table is not installed. Run supabase/sql/phase_5c_treasury_event_resolutions.sql."
            : res.error || "Failed to save resolution.",
        );
        return;
      }
      if (res.resolution) {
        setCurrentEventResolution(res.resolution);
        setEventResolutionsByEventId((prev) => ({
          ...prev,
          [selectedTreasuryEvent.id]: res.resolution,
        }));
      }
      await loadEventResolution(selectedTreasuryEvent.id);
    } catch (err) {
      setEventResolutionError(err?.message || "Failed to save resolution.");
    } finally {
      setEventResolutionSaving(false);
    }
  }, [
    selectedTreasuryEvent,
    resolutionStatusDraft,
    resolutionSummaryDraft,
    resolutionAssignedToDraft,
    user?.id,
    loadEventResolution,
  ]);

  const handleSaveEventInvestigationNote = useCallback(async () => {
    if (!selectedTreasuryEvent?.id || !eventNoteDraft.trim()) return;
    setEventNoteSaving(true);
    setEventNotesError(null);
    try {
      const res = await createTreasuryEventInvestigationNote(supabase, {
        eventId: selectedTreasuryEvent.id,
        eventSource: selectedTreasuryEvent.source,
        eventCategory: selectedTreasuryEvent.category,
        note: eventNoteDraft,
        createdBy: user?.id || null,
      });
      if (!res.ok) {
        setEventNotesError(
          res.tableMissing
            ? "Investigation notes table is not installed. Run supabase/sql/phase_5b_treasury_event_investigation_notes.sql."
            : res.error || "Failed to save note.",
        );
        return;
      }
      setEventNoteDraft("");
      await loadEventInvestigationNotes(selectedTreasuryEvent.id);
    } catch (err) {
      setEventNotesError(err?.message || "Failed to save note.");
    } finally {
      setEventNoteSaving(false);
    }
  }, [selectedTreasuryEvent, eventNoteDraft, user?.id, loadEventInvestigationNotes]);

  const selectedEventDisplayMetadata = useMemo(() => {
    if (!selectedTreasuryEvent?.metadata) return [];
    return flattenMetadataEntries(sanitizeTreasuryEventMetadataForDisplay(selectedTreasuryEvent.metadata));
  }, [selectedTreasuryEvent]);

  const selectedEventWithdrawalReviewHref = useMemo(() => {
    return withdrawalReviewHrefFromTreasuryEvent(selectedTreasuryEvent);
  }, [selectedTreasuryEvent]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void loadOperationalEvents();
    void loadTreasuryCenterEvents();
  }, [authLoading, user, profile, loadOperationalEvents, loadTreasuryCenterEvents]);

  useEffect(() => {
    if (!pendingSnapshotLog || !treasuryMonitoringSignals || !health) return;

    const metrics = health?.sourceSnapshot?.metrics || {};
    void logTreasuryOperationalEvent(supabase, {
      event_type: "treasury_snapshot_saved",
      severity: treasuryMonitoringSignals.treasuryAttentionLevel === "high"
        ? "high"
        : treasuryMonitoringSignals.treasuryAttentionLevel === "elevated"
          ? "elevated"
          : treasuryMonitoringSignals.treasuryAttentionLevel === "moderate"
            ? "moderate"
            : "info",
      title: "Treasury health snapshot saved",
      description: `Advisory snapshot recorded — operating state ${treasuryMonitoringSignals.operatingState.replace(/_/g, " ")}.`,
      metadata: {
        operatingState: treasuryMonitoringSignals.operatingState,
        treasuryAttentionLevel: treasuryMonitoringSignals.treasuryAttentionLevel,
        confidence: treasuryMonitoringSignals.confidence,
        healthScore: health.healthScore,
        treasuryRiskLevel: health.treasuryRiskLevel,
        pendingWithdrawalExposure: metrics.pendingWithdrawalExposure,
        totalWalletLiabilities: metrics.totalWalletLiabilities,
      },
    }).then(() => {
      void loadOperationalEvents();
    });

    setPendingSnapshotLog(false);
  }, [pendingSnapshotLog, treasuryMonitoringSignals, health, loadOperationalEvents]);

  useEffect(() => {
    if (
      loading ||
      !health ||
      !treasuryMonitoringSignals ||
      !treasuryCommandCenter ||
      !treasuryReadinessIndexResult
    ) {
      return;
    }

    const emissionKey = [
      loadCycleRef.current,
      treasuryMonitoringSignals.operatingState,
      treasuryMonitoringSignals.treasuryAttentionLevel,
      treasuryReadinessIndexResult.treasuryLaunchSignal || "",
      treasuryDrift?.driftStatus || "",
      alertClassification?.alertPriority || "",
    ].join("::");
    if (lastEmissionKeyRef.current === emissionKey) return;
    lastEmissionKeyRef.current = emissionKey;

    const metrics = health?.sourceSnapshot?.metrics || {};
    const liabilities = metrics.totalWalletLiabilities;
    const exposure = metrics.pendingWithdrawalExposure;

    void (async () => {
      const result = await emitTreasuryMonitoringEvents(supabase, {
        treasuryCommandCenter,
        readinessIndex: treasuryReadinessIndexResult,
        operationalGuidance: operationalGuidance || {},
        driftDetection: treasuryDrift || {},
        stability: treasuryStability || {},
        monitoringDashboard: monitoringDashboard || {},
        classifiedAlerts: alertClassification || {},
        treasuryOperationsState: treasuryMonitoringSignals,
        previousState: prevEmissionStateRef.current,
        liabilities,
        exposure,
      });

      setMonitoringEmissionSummary(result.monitoringSummary);
      if (result.nextState) {
        prevEmissionStateRef.current = result.nextState;
      }
      if (result.emittedEvents.length > 0) {
        void loadOperationalEvents();
      }
    })();
  }, [
    loading,
    health,
    treasuryMonitoringSignals,
    treasuryCommandCenter,
    treasuryReadinessIndexResult,
    operationalGuidance,
    treasuryDrift,
    treasuryStability,
    monitoringDashboard,
    alertClassification,
    loadOperationalEvents,
  ]);

  const generateReportPreview = useCallback(() => {
    if (!health) return;
    const report = buildTreasuryIntelligenceReport({
      executiveSummary: executiveSummary || undefined,
      treasuryHealth: health,
      trends: trends || {},
      forecast: forecast || {},
      scenarios: scenarios || {},
      resilience: resilience || {},
      explainability: explainability || {},
      simulator: simulationResult || undefined,
      operationalGuidance: operationalGuidance || {},
      alerts,
      snapshotHistory: history,
    });
    setReportPreview(report);
    setReportCopyNote(null);
  }, [
    health,
    executiveSummary,
    trends,
    forecast,
    scenarios,
    resilience,
    explainability,
    simulationResult,
    operationalGuidance,
    alerts,
    history,
  ]);

  const copyReportJson = useCallback(async () => {
    if (!reportPreview) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(reportPreview, null, 2));
      setReportCopyNote("Report JSON copied to clipboard.");
    } catch {
      setReportCopyNote("Could not copy report JSON — check browser clipboard permissions.");
    }
  }, [reportPreview]);

  const copyReportText = useCallback(async () => {
    if (!reportPreview) return;
    try {
      await navigator.clipboard.writeText(formatTreasuryReportAsText(reportPreview));
      setReportCopyNote("Report text summary copied to clipboard.");
    } catch {
      setReportCopyNote("Could not copy report text — check browser clipboard permissions.");
    }
  }, [reportPreview]);

  const runSimulation = useCallback(() => {
    if (!health) return;
    const result = simulateTreasuryDecision({
      liabilityMultiplier: simLiabilityMult,
      exposureMultiplier: simExposureMult,
      fundingSlowdownPercent: simFundingSlowdown,
      reconciliationIssueCount: simReconIssues,
      withdrawalSpikePercent: simWithdrawalSpike,
      treasuryHealth: health,
      trends: trends || {},
      forecast: forecast || {},
      scenarios: scenarios || {},
      resilience: resilience || {},
    });
    setSimulationResult(result);
  }, [
    health,
    trends,
    forecast,
    scenarios,
    resilience,
    simLiabilityMult,
    simExposureMult,
    simFundingSlowdown,
    simReconIssues,
    simWithdrawalSpike,
  ]);

  const executiveGroupStatus = useMemo(
    () => deriveExecutiveGroupStatus(treasuryCommandCenter, unifiedTreasuryScore),
    [treasuryCommandCenter, unifiedTreasuryScore],
  );
  const healthGroupStatus = useMemo(
    () => deriveHealthGroupStatus(treasuryStability, treasuryDrift, trends),
    [treasuryStability, treasuryDrift, trends],
  );
  const riskGroupStatus = useMemo(
    () => deriveRiskGroupStatus(alertClassification, alerts),
    [alertClassification, alerts],
  );
  const forecastGroupStatus = useMemo(() => deriveForecastGroupStatus(), []);
  const reportsGroupStatus = useMemo(() => deriveReportsGroupStatus(), []);

  const kpiCards = useMemo(() => {
    if (!health) return null;
    return [
      {
        key: "healthScore",
        label: "Health score",
        value: String(health.healthScore),
        subtitle: "0–100 composite",
        valueColor: scoreColor(health.healthScore),
      },
      {
        key: "riskLevel",
        label: "Treasury risk level",
        value: String(health.treasuryRiskLevel || "—").toUpperCase(),
        subtitle: "Derived from health score",
        valueColor: scoreColor(health.healthScore),
      },
      {
        key: "confidence",
        label: "Confidence",
        value: `${health.confidenceScore}%`,
        subtitle: "Data availability signal",
        valueColor: health.confidenceScore >= 70 ? "#047857" : health.confidenceScore >= 40 ? "#92400e" : "#b91c1c",
      },
      {
        key: "liabilities",
        label: "Wallet liabilities",
        value: formatMoney(metrics.totalWalletLiabilities),
        subtitle: "Sum of wallet balances",
      },
      {
        key: "exposure",
        label: "Pending withdrawal exposure",
        value: formatMoney(metrics.pendingWithdrawalExposure),
        subtitle: "Pending + processing payouts",
      },
      {
        key: "reconciliation",
        label: "Reconciliation score",
        value: String(health.reconciliationScore),
        subtitle: `${metrics.reconciliationMismatchCount || 0} mismatch signals`,
        valueColor: scoreColor(health.reconciliationScore),
      },
    ];
  }, [health, metrics]);

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading…</p>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Sign in to view this page.</p>
          <Link href="/login" style={{ display: "inline-block", marginTop: "1rem", fontWeight: 600, color: "#0ea5e9" }}>
            Go to login
          </Link>
        </div>
      </>
    );
  }

  if (!isAdminUser(user, profile)) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Not authorized</h2>
        <p>This area is restricted to admin users.</p>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap} className="max-w-full sm:px-5 sm:pb-12 md:px-6 md:pb-14">
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href="/admin" style={{ color: "#38bdf8", fontWeight: 600, fontSize: "0.9rem" }}>
            ← Admin home
          </Link>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.65rem",
            marginBottom: "1rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                fontSize: "clamp(1.25rem, 4vw, 1.55rem)",
                fontWeight: 700,
                color: "#0f172a",
                margin: "0 0 0.4rem",
                letterSpacing: "-0.02em",
              }}
            >
              Treasury Intelligence
            </h1>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5, maxWidth: "44rem" }}>
              Read-only monitoring of operational treasury health — liabilities, payout pressure, reconciliation signals,
              and activity anomalies. No wallet or payout mutations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-busy={loading || undefined}
            className={`min-h-[44px] px-3 py-2 sm:px-3.5 ${treasuryFocusRingClass}`}
            style={{
              ...btnSm,
              marginTop: 0,
              minHeight: "44px",
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Refreshing…" : "Refresh & save snapshot"}
          </button>
        </div>

        {tableMissing ? (
          <div
            style={{
              ...cardBase,
              padding: "0.85rem 1rem",
              marginBottom: "1rem",
              background: "#fffbeb",
              borderColor: "#fcd34d",
            }}
          >
            <p style={{ margin: 0, color: "#92400e", fontSize: "0.85rem" }}>
              Run migration <code style={{ fontSize: "0.78rem" }}>supabase/sql/treasury_health_snapshots.sql</code> to
              enable snapshot history persistence.
            </p>
          </div>
        ) : null}

        {loadError ? (
          <div
            style={{
              ...cardBase,
              padding: "0.85rem 1rem",
              marginBottom: "1rem",
              background: "#fef2f2",
              borderColor: "#fecaca",
            }}
          >
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.85rem" }}>{loadError}</p>
          </div>
        ) : null}

        {saveNote ? (
          <p style={{ margin: "0 0 1rem", fontSize: "0.78rem", color: "#64748b" }}>{saveNote}</p>
        ) : null}

        <TreasuryIntelligenceQuickNav activeId={activeGroupId} onNavigate={handleGroupActivate} />

        <TreasuryIntelligenceGroup
          id="executive-command-center"
          title="Executive Command Center"
          description="What leadership should see first — unified score, briefing, and readiness at a glance."
          priorityLabel="Start here"
          recommendedFirst
          sectionCount={5}
          statusLabel={executiveGroupStatus.label}
          statusVariant={executiveGroupStatus.variant}
          defaultOpen
          onActivate={handleGroupActivate}
        >
        {() => (
        <>
        <section style={treasuryExecutiveSectionStyle}>
          <h3 style={sectionHeading}>Treasury Command Center</h3>
          <p style={treasurySectionIntroStyle}>
            The executive one-page treasury operating view — synthesizing unified score, board timeline, daily
            narrative, executive briefing, and readiness index into a single leadership-ready command picture. Read-only
            and advisory only. No automation or financial mutations.
          </p>
          {!treasuryCommandCenter ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading treasury command center…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  marginBottom: "1rem",
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                }}
              >
                <p
                  style={{
                    margin: "0 0 0.35rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Leadership view
                </p>
                <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", lineHeight: 1.35 }}>
                  {treasuryCommandCenter.treasuryLeadershipView}
                </p>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Command status
                  </p>
                  <span style={commandCenterStatusBadge(treasuryCommandCenter.treasuryCommandStatus)}>
                    {commandCenterStatusLabel(treasuryCommandCenter.treasuryCommandStatus)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Operating picture
                  </p>
                  <span style={commandCenterOperatingPictureBadge(treasuryCommandCenter.treasuryOperatingPicture)}>
                    {commandCenterOperatingPictureLabel(treasuryCommandCenter.treasuryOperatingPicture)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Priority level
                  </p>
                  <span style={commandCenterPriorityLevelBadge(treasuryCommandCenter.treasuryPriorityLevel)}>
                    {commandCenterPriorityLevelLabel(treasuryCommandCenter.treasuryPriorityLevel)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Attention signal
                  </p>
                  <span style={commandCenterAttentionSignalBadge(treasuryCommandCenter.treasuryAttentionSignal)}>
                    {commandCenterAttentionSignalLabel(treasuryCommandCenter.treasuryAttentionSignal)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Health signal
                  </p>
                  <span style={commandCenterHealthSignalBadge(treasuryCommandCenter.treasuryHealthSignal)}>
                    {commandCenterHealthSignalLabel(treasuryCommandCenter.treasuryHealthSignal)}
                  </span>
                </div>
                <KpiCard
                  label="Confidence"
                  value={`${treasuryCommandCenter.confidence}/100`}
                  subtitle="Command center signal availability"
                  valueColor={scoreColor(treasuryCommandCenter.confidence)}
                />
              </div>

              {treasuryCommandCenter.executiveActions.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Executive actions
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryCommandCenter.executiveActions.map((item, idx) => (
                      <li
                        key={`command-center-action-${idx}`}
                        style={treasuryListItemStyle}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {treasuryCommandCenter.watchAreas.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Watch areas
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryCommandCenter.watchAreas.map((item, idx) => (
                      <li
                        key={`command-center-watch-${idx}`}
                        style={treasuryListItemStyle}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {treasuryCommandCenter.strengths.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Strengths
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryCommandCenter.strengths.map((item, idx) => (
                      <li
                        key={`command-center-strength-${idx}`}
                        style={treasuryListItemStyle}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {treasuryCommandCenter.concerns.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Concerns
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryCommandCenter.concerns.map((item, idx) => (
                      <li
                        key={`command-center-concern-${idx}`}
                        style={treasuryListItemStyle}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <p
                  style={{
                    margin: "0 0 0.4rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Summary
                </p>
                <p style={treasurySummaryTextStyle}>
                  {treasuryCommandCenter.summary}
                </p>
              </div>
            </div>
          )}
        </section>

        <section style={treasuryExecutiveSectionStyle}>
          <h3 style={sectionHeading}>Treasury Operations</h3>
          <p style={treasurySectionIntroStyle}>
            Operational monitoring synthesis — operating state, attention level, watch flags, and recommended monitoring
            derived from treasury intelligence signals. Append-only event log for leadership visibility. Read-only and
            advisory only. No automation or financial mutations.
          </p>
          {!treasuryMonitoringSignals ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading treasury operations…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>Operating state</p>
                  <span style={treasuryOperatingStateBadge(treasuryMonitoringSignals.operatingState)}>
                    {treasuryOperatingStateLabel(treasuryMonitoringSignals.operatingState)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>Attention level</p>
                  <span style={treasuryAttentionLevelBadge(treasuryMonitoringSignals.treasuryAttentionLevel)}>
                    {treasuryAttentionLevelLabel(treasuryMonitoringSignals.treasuryAttentionLevel)}
                  </span>
                </div>
                <KpiCard
                  label="Monitoring confidence"
                  value={`${treasuryMonitoringSignals.confidence}/100`}
                  subtitle="Signal availability across operational inputs"
                  valueColor={scoreColor(treasuryMonitoringSignals.confidence)}
                />
              </div>

              {treasuryMonitoringSignals.treasuryMonitoringSignals.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Monitoring signals
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryMonitoringSignals.treasuryMonitoringSignals.map((item, idx) => (
                      <li key={`treasury-ops-signal-${idx}`} style={treasuryListItemStyle}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {treasuryMonitoringSignals.treasuryWatchFlags.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Watch flags
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryMonitoringSignals.treasuryWatchFlags.map((item, idx) => (
                      <li key={`treasury-ops-watch-${idx}`} style={treasuryListItemStyle}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {treasuryMonitoringSignals.recommendedMonitoring.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Recommended monitoring
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryMonitoringSignals.recommendedMonitoring.map((item, idx) => (
                      <li key={`treasury-ops-rec-${idx}`} style={treasuryListItemStyle}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {treasuryAlertReadiness ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Alert Readiness
                  </p>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0 0 0.85rem", fontSize: "0.78rem" }}>
                    Advisory only — no notifications sent. Assesses whether treasury signals warrant preparing
                    admin alerts; nothing is dispatched outside this dashboard.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                      gap: "0.75rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Alert readiness status</p>
                      <span style={alertReadinessStatusBadge(treasuryAlertReadiness.alertReadinessStatus)}>
                        {alertReadinessStatusLabel(treasuryAlertReadiness.alertReadinessStatus)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Alert posture</p>
                      <span style={alertReadinessPostureBadge(treasuryAlertReadiness.alertPosture)}>
                        {alertReadinessPostureLabel(treasuryAlertReadiness.alertPosture)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Alert priority</p>
                      <span style={alertReadinessPriorityBadge(treasuryAlertReadiness.alertPriority)}>
                        {alertReadinessPriorityLabel(treasuryAlertReadiness.alertPriority)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Recommended channel</p>
                      <span style={recommendedAlertChannelBadge(treasuryAlertReadiness.recommendedAlertChannel)}>
                        {recommendedAlertChannelLabel(treasuryAlertReadiness.recommendedAlertChannel)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryAlertReadiness.confidence}/100`}
                      subtitle="Alert readiness signal availability"
                      valueColor={scoreColor(treasuryAlertReadiness.confidence)}
                    />
                  </div>

                  {treasuryAlertReadiness.alertWorthySignals.length > 0 ? (
                    <div style={{ marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Alert-worthy signals</p>
                      <ul style={{ ...treasuryListStyle, margin: 0 }}>
                        {treasuryAlertReadiness.alertWorthySignals.map((item, idx) => (
                          <li
                            key={`alert-worthy-${idx}`}
                            style={{
                              ...treasuryListItemStyle,
                              padding: "0.55rem 0",
                              borderBottom: idx < treasuryAlertReadiness.alertWorthySignals.length - 1 ? "1px solid #f1f5f9" : "none",
                            }}
                          >
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem", marginBottom: "0.25rem" }}>
                              <span style={treasuryEventSeverityBadge(item.severity)}>{item.severity}</span>
                              <span style={{ fontSize: "0.68rem", color: "#94a3b8", fontWeight: 600 }}>
                                {recommendedAlertChannelLabel(item.suggestedChannel)}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.85rem" }}>{item.title}</p>
                            <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>{item.reason}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                        No alert-worthy signals at this time.
                      </p>
                    </div>
                  )}

                  {treasuryAlertReadiness.suppressedSignals.length > 0 ? (
                    <div style={{ marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Suppressed signals</p>
                      <ul style={{ ...treasuryListStyle, margin: 0 }}>
                        {treasuryAlertReadiness.suppressedSignals.map((item, idx) => (
                          <li key={`suppressed-${idx}`} style={treasuryListItemStyle}>
                            <p style={{ margin: 0, fontWeight: 600, color: "#475569", fontSize: "0.8125rem" }}>{item.title}</p>
                            <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.4 }}>{item.reason}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryAlertReadiness.escalationReasons.length > 0 ? (
                    <div style={{ marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Escalation reasons</p>
                      <ul style={treasuryListStyle}>
                        {treasuryAlertReadiness.escalationReasons.map((reason, idx) => (
                          <li key={`escalation-${idx}`} style={treasuryListItemStyle}>
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryAlertReadiness.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryAdminAlertsResult ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Admin Alerts
                  </p>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0 0 0.85rem", fontSize: "0.78rem" }}>
                    In-app advisory alerts synthesized from treasury readiness and monitoring signals.{" "}
                    <strong style={{ fontWeight: 700, color: "#64748b" }}>Advisory only</strong> — no emails, push,
                    SMS, or external notifications.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                      gap: "0.75rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Alert posture</p>
                      <span style={treasuryAdminAlertPostureBadge(treasuryAdminAlertsResult.alertPosture)}>
                        {treasuryAdminAlertPostureLabel(treasuryAdminAlertsResult.alertPosture)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Total advisories</p>
                      <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
                        {treasuryAdminAlertsResult.alertCounts.total}
                      </p>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Elevated + high</p>
                      <p style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "#0f172a" }}>
                        {(treasuryAdminAlertsResult.alertCounts.bySeverity.elevated || 0) +
                          (treasuryAdminAlertsResult.alertCounts.bySeverity.high || 0)}
                      </p>
                    </div>
                  </div>
                  <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Alert summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryAdminAlertsResult.alertSummary}</p>
                  </div>
                  {treasuryAdminAlertsResult.treasuryAdminAlerts.length > 0 ? (
                    <ul style={{ ...treasuryListStyle, margin: 0, listStyle: "none", paddingLeft: 0 }}>
                      {treasuryAdminAlertsResult.treasuryAdminAlerts.map((alert) => (
                        <li
                          key={alert.id}
                          style={{
                            ...treasuryListItemStyle,
                            padding: "0.85rem 1rem",
                            marginBottom: "0.65rem",
                            borderRadius: "10px",
                            border: "1px solid #e2e8f0",
                            background: "#ffffff",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.35rem",
                              marginBottom: "0.4rem",
                            }}
                          >
                            <span style={treasuryEventSeverityBadge(alert.severity)}>{alert.severity}</span>
                            <span style={treasuryAdminAlertStatusBadge(alert.status)}>
                              {treasuryAdminAlertStatusLabel(alert.status)}
                            </span>
                            <span
                              style={{
                                ...treasuryBadgeStyle({ bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" }),
                                fontSize: "0.65rem",
                              }}
                            >
                              Advisory only
                            </span>
                          </div>
                          <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>
                            {alert.title}
                          </p>
                          <p style={{ margin: "0.35rem 0 0", fontSize: "0.8125rem", color: "#475569", lineHeight: 1.5 }}>
                            {alert.summary}
                          </p>
                          {alert.recommendation ? (
                            <p
                              style={{
                                margin: "0.45rem 0 0",
                                fontSize: "0.78rem",
                                color: "#64748b",
                                lineHeight: 1.45,
                                fontStyle: "italic",
                              }}
                            >
                              {alert.recommendation}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={treasurySummaryBlockStyle}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                        No treasury admin advisories at this time — routine monitoring recommended.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              {treasuryNotificationReadiness ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Notification Readiness
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory only — no notifications sent or scheduled
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Prepares recommended notification posture and channel labels from alert readiness and admin alerts.
                    Nothing is dispatched — classification and routing recommendations only.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                      gap: "0.75rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Readiness status</p>
                      <span style={notificationReadinessStatusBadge(treasuryNotificationReadiness.notificationReadinessStatus)}>
                        {notificationReadinessStatusLabel(treasuryNotificationReadiness.notificationReadinessStatus)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Recommended posture</p>
                      <span
                        style={recommendedNotificationPostureBadge(
                          treasuryNotificationReadiness.recommendedNotificationPosture,
                        )}
                      >
                        {recommendedNotificationPostureLabel(treasuryNotificationReadiness.recommendedNotificationPosture)}
                      </span>
                    </div>
                    <KpiCard
                      label="Notification confidence"
                      value={`${treasuryNotificationReadiness.notificationConfidence}/100`}
                      subtitle="Blend of alert readiness, admin alerts, and monitoring"
                      valueColor={scoreColor(treasuryNotificationReadiness.notificationConfidence)}
                    />
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Recommended channels</p>
                    <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.4 }}>
                      Preparation labels only — not sent
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {treasuryNotificationReadiness.recommendedChannels.map((channel) => (
                        <span key={`notif-channel-${channel}`} style={recommendedNotificationChannelBadge(channel)}>
                          {recommendedNotificationChannelLabel(channel)}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Escalation routing (advisory)</p>
                    {treasuryNotificationReadiness.escalationRouting.length > 0 ? (
                      <ul style={{ ...treasuryListStyle, margin: 0, listStyle: "none", paddingLeft: 0 }}>
                        {treasuryNotificationReadiness.escalationRouting.map((route, idx) => (
                          <li
                            key={`notif-route-${idx}`}
                            style={{
                              ...treasuryListItemStyle,
                              padding: "0.65rem 0.75rem",
                              marginBottom: "0.45rem",
                              borderRadius: "10px",
                              border: "1px solid #e2e8f0",
                              background: "#f8fafc",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: "0.35rem",
                                marginBottom: "0.25rem",
                              }}
                            >
                              <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.8125rem" }}>
                                {notificationRoutingAudienceLabel(route.audience)}
                              </span>
                              <span style={notificationRoutingUrgencyBadge(route.urgency)}>{route.urgency}</span>
                            </div>
                            <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                              {route.reason}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div style={treasurySummaryBlockStyle}>
                        <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                          No escalation routing recommended — quiet treasury posture.
                        </p>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Digest suitability</p>
                    <div style={treasurySummaryBlockStyle}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem", marginBottom: "0.45rem" }}>
                        <span
                          style={treasuryBadgeStyle(
                            treasuryNotificationReadiness.digestSuitability.suitable
                              ? { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" }
                              : { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
                          )}
                        >
                          {treasuryNotificationReadiness.digestSuitability.suitable ? "Suitable" : "Not suitable"}
                        </span>
                        <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "#475569" }}>
                          Cadence: {notificationDigestCadenceLabel(treasuryNotificationReadiness.digestSuitability.cadence)}
                        </span>
                      </div>
                      {treasuryNotificationReadiness.digestSuitability.reasons.length > 0 ? (
                        <ul style={{ ...treasuryListStyle, margin: 0 }}>
                          {treasuryNotificationReadiness.digestSuitability.reasons.map((reason, idx) => (
                            <li key={`digest-reason-${idx}`} style={treasuryListItemStyle}>
                              {reason}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>

                  {treasuryNotificationReadiness.suppressedNotifications.length > 0 ? (
                    <div style={{ marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Suppressed notifications</p>
                      <ul style={{ ...treasuryListStyle, margin: 0 }}>
                        {treasuryNotificationReadiness.suppressedNotifications.map((item, idx) => (
                          <li key={`suppressed-notif-${idx}`} style={treasuryListItemStyle}>
                            <p style={{ margin: 0, fontWeight: 600, color: "#475569", fontSize: "0.8125rem" }}>
                              {item.title}
                            </p>
                            <p style={{ margin: "0.15rem 0 0", fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.4 }}>
                              {item.reason}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryNotificationReadiness.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryDigestIntelligence ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Digest Intelligence
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Preview only — no digests sent or scheduled
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Synthesizes daily and weekly leadership digest previews from command center, monitoring, alert, and
                    notification readiness outputs. Advisory preparation only — nothing is delivered.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                      gap: "0.75rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Digest readiness</p>
                      <span style={digestReadinessStatusBadge(treasuryDigestIntelligence.digestReadiness)}>
                        {digestReadinessStatusLabel(treasuryDigestIntelligence.digestReadiness)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Digest priority</p>
                      <span style={digestPriorityBadge(treasuryDigestIntelligence.digestPriority)}>
                        {digestPriorityLabel(treasuryDigestIntelligence.digestPriority)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryDigestIntelligence.confidence}/100`}
                      subtitle="Blend of notification, alert, and monitoring inputs"
                      valueColor={scoreColor(treasuryDigestIntelligence.confidence)}
                    />
                  </div>

                  <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Daily digest preview</p>
                    <p style={{ margin: "0 0 0.5rem", fontWeight: 700, color: "#0f172a", fontSize: "0.9rem", lineHeight: 1.45 }}>
                      {treasuryDigestIntelligence.dailyDigest.headline}
                    </p>
                    <p style={{ ...treasurySummaryTextStyle, marginBottom: "0.75rem" }}>
                      {treasuryDigestIntelligence.dailyDigest.summary}
                    </p>
                    {treasuryDigestIntelligence.dailyDigest.keySignals.length > 0 ? (
                      <>
                        <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.65rem" }}>Key signals</p>
                        <ul style={treasuryListStyle}>
                          {treasuryDigestIntelligence.dailyDigest.keySignals.map((item, idx) => (
                            <li key={`digest-daily-signal-${idx}`} style={treasuryListItemStyle}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {treasuryDigestIntelligence.dailyDigest.watchItems.length > 0 ? (
                      <>
                        <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.65rem" }}>Watch items</p>
                        <ul style={treasuryListStyle}>
                          {treasuryDigestIntelligence.dailyDigest.watchItems.map((item, idx) => (
                            <li key={`digest-daily-watch-${idx}`} style={treasuryListItemStyle}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {treasuryDigestIntelligence.dailyDigest.recommendations.length > 0 ? (
                      <>
                        <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.65rem" }}>Recommendations</p>
                        <ul style={treasuryListStyle}>
                          {treasuryDigestIntelligence.dailyDigest.recommendations.map((item, idx) => (
                            <li key={`digest-daily-rec-${idx}`} style={treasuryListItemStyle}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>

                  <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Weekly digest preview</p>
                    <p style={{ margin: "0 0 0.5rem", fontWeight: 700, color: "#0f172a", fontSize: "0.9rem", lineHeight: 1.45 }}>
                      {treasuryDigestIntelligence.weeklyDigest.headline}
                    </p>
                    <p style={{ ...treasurySummaryTextStyle, marginBottom: "0.75rem" }}>
                      {treasuryDigestIntelligence.weeklyDigest.summary}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem", marginBottom: "0.65rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Treasury trajectory
                      </span>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#475569" }}>
                        {treasuryDigestIntelligence.weeklyDigest.treasuryTrajectory}
                      </span>
                    </div>
                    {treasuryDigestIntelligence.weeklyDigest.majorChanges.length > 0 ? (
                      <>
                        <p style={treasurySummaryLabelStyle}>Major changes</p>
                        <ul style={treasuryListStyle}>
                          {treasuryDigestIntelligence.weeklyDigest.majorChanges.map((item, idx) => (
                            <li key={`digest-weekly-change-${idx}`} style={treasuryListItemStyle}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                    {treasuryDigestIntelligence.weeklyDigest.recommendations.length > 0 ? (
                      <>
                        <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.65rem" }}>Recommendations</p>
                        <ul style={treasuryListStyle}>
                          {treasuryDigestIntelligence.weeklyDigest.recommendations.map((item, idx) => (
                            <li key={`digest-weekly-rec-${idx}`} style={treasuryListItemStyle}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>

                  {treasuryDigestIntelligence.digestHighlights.length > 0 ? (
                    <div style={{ marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Digest highlights</p>
                      <ul style={{ ...treasuryListStyle, margin: 0, listStyle: "none", paddingLeft: 0 }}>
                        {treasuryDigestIntelligence.digestHighlights.map((item, idx) => (
                          <li
                            key={`digest-highlight-${idx}`}
                            style={{
                              ...treasuryListItemStyle,
                              padding: "0.75rem 0.85rem",
                              marginBottom: "0.45rem",
                              borderRadius: "10px",
                              border: "1px solid #e2e8f0",
                              background: "#ffffff",
                            }}
                          >
                            <span style={treasuryEventSeverityBadge(item.severity)}>{item.severity}</span>
                            <p style={{ margin: "0.35rem 0 0", fontWeight: 700, color: "#0f172a", fontSize: "0.85rem" }}>
                              {item.title}
                            </p>
                            <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                              {item.summary}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                        No digest highlights at this time — routine monitoring recommended.
                      </p>
                    </div>
                  )}

                  <div style={{ marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Digest suitability</p>
                    <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", color: "#94a3b8", lineHeight: 1.4 }}>
                      Channel preparation flags only — not sent
                    </p>
                    <div style={{ display: "grid", gap: "0.45rem" }}>
                      {(["daily", "weekly", "executive"]).map((channel) => (
                        <div
                          key={`digest-suitability-${channel}`}
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: "0.4rem",
                            padding: "0.55rem 0.65rem",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                            background: "#f8fafc",
                          }}
                        >
                          <span style={digestSuitabilityBadge(treasuryDigestIntelligence.digestSuitability[channel])}>
                            {treasuryDigestIntelligence.digestSuitability[channel] ? "Yes" : "No"}
                          </span>
                          <span style={{ fontSize: "0.8125rem", color: "#475569", lineHeight: 1.45 }}>
                            {digestSuitabilityChannelLabel(channel, treasuryDigestIntelligence.digestSuitability[channel])}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryDigestIntelligence.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryExecutiveEscalation ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Executive Escalation
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory only — no executive notifications sent or scheduled
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Synthesizes executive leadership escalation posture from command center, alert, notification, and
                    digest intelligence outputs. Assess and prepare only — nothing is delivered or scheduled.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                      gap: "0.75rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Attention status</p>
                      <span style={executiveAttentionStatusBadge(treasuryExecutiveEscalation.executiveAttentionStatus)}>
                        {executiveAttentionStatusLabel(treasuryExecutiveEscalation.executiveAttentionStatus)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Escalation priority</p>
                      <span style={escalationPriorityBadge(treasuryExecutiveEscalation.escalationPriority)}>
                        {escalationPriorityLabel(treasuryExecutiveEscalation.escalationPriority)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Recommended cadence</p>
                      <span style={recommendedExecutiveCadenceBadge(treasuryExecutiveEscalation.recommendedExecutiveCadence)}>
                        {recommendedExecutiveCadenceLabel(treasuryExecutiveEscalation.recommendedExecutiveCadence)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryExecutiveEscalation.escalationConfidence}/100`}
                      subtitle="Blend of digest, notification, and alert inputs"
                      valueColor={scoreColor(treasuryExecutiveEscalation.escalationConfidence)}
                    />
                  </div>

                  {treasuryExecutiveEscalation.executiveAttentionReasons.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Executive attention reasons</p>
                      <ul style={treasuryListStyle}>
                        {treasuryExecutiveEscalation.executiveAttentionReasons.map((item, idx) => (
                          <li key={`exec-attention-reason-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryExecutiveEscalation.escalationSignals.length > 0 ? (
                    <div style={{ marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Escalation signals</p>
                      <ul style={{ ...treasuryListStyle, margin: 0, listStyle: "none", paddingLeft: 0 }}>
                        {treasuryExecutiveEscalation.escalationSignals.map((item, idx) => (
                          <li
                            key={`exec-escalation-signal-${idx}`}
                            style={{
                              ...treasuryListItemStyle,
                              padding: "0.75rem 0.85rem",
                              marginBottom: "0.45rem",
                              borderRadius: "10px",
                              border: "1px solid #e2e8f0",
                              background: "#ffffff",
                            }}
                          >
                            <span style={treasuryEventSeverityBadge(item.severity)}>{item.severity}</span>
                            <p style={{ margin: "0.35rem 0 0", fontWeight: 700, color: "#0f172a", fontSize: "0.85rem" }}>
                              {item.title}
                            </p>
                            <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                              {item.summary}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                        No escalation signals at this time — routine leadership observation recommended.
                      </p>
                    </div>
                  )}

                  <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Leadership summary</p>
                    <p style={{ margin: "0 0 0.5rem", fontWeight: 700, color: "#0f172a", fontSize: "0.9rem", lineHeight: 1.45 }}>
                      {treasuryExecutiveEscalation.leadershipSummary.headline}
                    </p>
                    <p style={{ ...treasurySummaryTextStyle, marginBottom: "0.75rem" }}>
                      {treasuryExecutiveEscalation.leadershipSummary.summary}
                    </p>
                    {treasuryExecutiveEscalation.leadershipSummary.recommendations.length > 0 ? (
                      <>
                        <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.65rem" }}>Recommendations</p>
                        <ul style={treasuryListStyle}>
                          {treasuryExecutiveEscalation.leadershipSummary.recommendations.map((item, idx) => (
                            <li key={`exec-leadership-rec-${idx}`} style={treasuryListItemStyle}>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </>
                    ) : null}
                  </div>

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryExecutiveEscalation.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryDecisionSupport ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Decision Support
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory only — no actions executed or scheduled
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Synthesizes treasury decision support from command center, operational guidance, alert,
                    notification, digest, and executive escalation outputs. Recommend and prepare only — nothing is
                    executed, automated, or scheduled.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                      gap: "0.75rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Decision support status</p>
                      <span style={decisionSupportStatusBadge(treasuryDecisionSupport.decisionSupportStatus)}>
                        {decisionSupportStatusLabel(treasuryDecisionSupport.decisionSupportStatus)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryDecisionSupport.confidence}/100`}
                      subtitle="Blend of escalation, digest, alert, and guidance inputs"
                      valueColor={scoreColor(treasuryDecisionSupport.confidence)}
                    />
                  </div>

                  {treasuryDecisionSupport.treasuryRecommendations.length > 0 ? (
                    <div style={{ marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Treasury recommendations</p>
                      <ul style={{ ...treasuryListStyle, margin: 0, listStyle: "none", paddingLeft: 0 }}>
                        {treasuryDecisionSupport.treasuryRecommendations.map((item, idx) => (
                          <li
                            key={`decision-support-rec-${idx}`}
                            style={{
                              ...treasuryListItemStyle,
                              padding: "0.75rem 0.85rem",
                              marginBottom: "0.45rem",
                              borderRadius: "10px",
                              border: "1px solid #e2e8f0",
                              background: "#ffffff",
                            }}
                          >
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem", marginBottom: "0.35rem" }}>
                              <span style={decisionSupportPriorityBadge(item.priority)}>
                                {escalationPriorityLabel(item.priority)}
                              </span>
                              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b" }}>
                                {item.confidence}/100 confidence
                              </span>
                            </div>
                            <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.85rem", lineHeight: 1.45 }}>
                              {item.recommendation}
                            </p>
                            <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                              {item.reason}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryDecisionSupport.priorityActions.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Priority actions</p>
                      <ul style={treasuryListStyle}>
                        {treasuryDecisionSupport.priorityActions.map((item, idx) => (
                          <li key={`decision-priority-action-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryDecisionSupport.deferredActions.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Deferred actions</p>
                      <ul style={treasuryListStyle}>
                        {treasuryDecisionSupport.deferredActions.map((item, idx) => (
                          <li key={`decision-deferred-action-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryDecisionSupport.monitoringRecommendations.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Monitoring recommendations</p>
                      <ul style={treasuryListStyle}>
                        {treasuryDecisionSupport.monitoringRecommendations.map((item, idx) => (
                          <li key={`decision-monitoring-rec-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryDecisionSupport.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryInstitutionalMemory ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Institutional Memory
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory only — no learning models or automated adaptation
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Observes operational event history and recognizes recurring monitoring patterns. Recommends
                    continuity cadence only — no training, automation, or treasury mutations.
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                      gap: "0.75rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Institutional memory status</p>
                      <span style={institutionalMemoryStatusBadge(treasuryInstitutionalMemory.institutionalMemoryStatus)}>
                        {institutionalMemoryStatusLabel(treasuryInstitutionalMemory.institutionalMemoryStatus)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Historical posture</p>
                      <span style={historicalPostureBadge(treasuryInstitutionalMemory.historicalPosture)}>
                        {historicalPostureLabel(treasuryInstitutionalMemory.historicalPosture)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryInstitutionalMemory.confidence}/100`}
                      subtitle="Scales with recorded operational history"
                      valueColor={scoreColor(treasuryInstitutionalMemory.confidence)}
                    />
                  </div>

                  {treasuryInstitutionalMemory.recurringPatterns.length > 0 ? (
                    <div style={{ marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Recurring patterns</p>
                      <ul style={{ ...treasuryListStyle, margin: 0, listStyle: "none", paddingLeft: 0 }}>
                        {treasuryInstitutionalMemory.recurringPatterns.map((item, idx) => (
                          <li
                            key={`institutional-pattern-${idx}`}
                            style={{
                              ...treasuryListItemStyle,
                              padding: "0.75rem 0.85rem",
                              marginBottom: "0.45rem",
                              borderRadius: "10px",
                              border: "1px solid #e2e8f0",
                              background: "#ffffff",
                            }}
                          >
                            <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.85rem", lineHeight: 1.45 }}>
                              {item.pattern.replace(/_/g, " ")} · {item.frequency}×
                            </p>
                            <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                              {item.summary}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                        No recurring patterns detected yet — history will inform continuity as events accumulate.
                      </p>
                    </div>
                  )}

                  {treasuryInstitutionalMemory.recurringRecommendations.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Recurring recommendations</p>
                      <ul style={treasuryListStyle}>
                        {treasuryInstitutionalMemory.recurringRecommendations.map((item, idx) => (
                          <li key={`institutional-rec-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryInstitutionalMemory.recurringSignals.length > 0 ? (
                    <div style={{ marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Recurring signals</p>
                      <ul style={{ ...treasuryListStyle, margin: 0, listStyle: "none", paddingLeft: 0 }}>
                        {treasuryInstitutionalMemory.recurringSignals.map((item, idx) => (
                          <li
                            key={`institutional-signal-${idx}`}
                            style={{
                              ...treasuryListItemStyle,
                              padding: "0.75rem 0.85rem",
                              marginBottom: "0.45rem",
                              borderRadius: "10px",
                              border: "1px solid #e2e8f0",
                              background: "#ffffff",
                            }}
                          >
                            <span style={treasuryEventSeverityBadge(item.severity)}>{item.severity}</span>
                            <p style={{ margin: "0.35rem 0 0", fontWeight: 700, color: "#0f172a", fontSize: "0.85rem" }}>
                              {item.title}
                            </p>
                            <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                              {item.summary}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                        No recurring signals at this time — titles will surface when they repeat in recent history.
                      </p>
                    </div>
                  )}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryInstitutionalMemory.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryConfidenceExplainability ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Confidence &amp; Explainability
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory explainability only — no automated actions
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Synthesizes Phase 3 operational confidence from upstream monitoring, readiness, alerts, and
                    institutional memory — explain and clarify only.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Confidence level</p>
                      <span style={confidenceLevelBadge(treasuryConfidenceExplainability.confidenceLevel)}>
                        {confidenceLevelLabel(treasuryConfidenceExplainability.confidenceLevel)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence score"
                      value={`${treasuryConfidenceExplainability.confidenceScore}/100`}
                      subtitle="Weighted synthesis from Phase 3 upstream confidences"
                      valueColor={scoreColor(treasuryConfidenceExplainability.confidenceScore)}
                    />
                  </div>

                  {treasuryConfidenceExplainability.explanationDrivers.length > 0 ? (
                    <div style={{ marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Explanation drivers</p>
                      <ul style={{ ...treasuryListStyle, margin: 0, listStyle: "none", paddingLeft: 0 }}>
                        {treasuryConfidenceExplainability.explanationDrivers.map((item, idx) => (
                          <li
                            key={`confidence-driver-${idx}`}
                            style={{
                              ...treasuryListItemStyle,
                              padding: "0.75rem 0.85rem",
                              marginBottom: "0.45rem",
                              borderRadius: "10px",
                              border: "1px solid #e2e8f0",
                              background: "#ffffff",
                            }}
                          >
                            <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.85rem", lineHeight: 1.45 }}>
                              {item.title} · {item.weight}%
                            </p>
                            <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                              {item.explanation}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryConfidenceExplainability.supportingSignals.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Supporting signals</p>
                      <ul style={treasuryListStyle}>
                        {treasuryConfidenceExplainability.supportingSignals.map((item, idx) => (
                          <li key={`confidence-support-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                        No aligned supporting signals surfaced — upstream postures remain mixed or limited.
                      </p>
                    </div>
                  )}

                  {treasuryConfidenceExplainability.softeningFactors.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Softening factors</p>
                      <ul style={treasuryListStyle}>
                        {treasuryConfidenceExplainability.softeningFactors.map((item, idx) => (
                          <li key={`confidence-soften-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryConfidenceExplainability.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryConsistencyCheck ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Consistency &amp; Alignment
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory consistency check only — no outputs overridden
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Compares Phase 3 recommendation layers for alignment and contradiction — observe, explain, and
                    reconcile only.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Consistency status</p>
                      <span style={consistencyStatusBadge(treasuryConsistencyCheck.consistencyStatus)}>
                        {consistencyStatusLabel(treasuryConsistencyCheck.consistencyStatus)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryConsistencyCheck.confidence}/100`}
                      subtitle="Blended with explainability score; capped at soft-launch levels"
                      valueColor={scoreColor(treasuryConsistencyCheck.confidence)}
                    />
                  </div>

                  {treasuryConsistencyCheck.contradictionSignals.length > 0 ? (
                    <div style={{ marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Contradiction signals</p>
                      <ul style={{ ...treasuryListStyle, margin: 0, listStyle: "none", paddingLeft: 0 }}>
                        {treasuryConsistencyCheck.contradictionSignals.map((item, idx) => (
                          <li
                            key={`consistency-contradiction-${idx}`}
                            style={{
                              ...treasuryListItemStyle,
                              padding: "0.75rem 0.85rem",
                              marginBottom: "0.45rem",
                              borderRadius: "10px",
                              border: "1px solid #e2e8f0",
                              background: "#ffffff",
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: "0.45rem",
                                marginBottom: "0.25rem",
                              }}
                            >
                              <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.85rem", lineHeight: 1.45 }}>
                                {item.title}
                              </p>
                              <span style={contradictionSeverityBadge(item.severity)}>{item.severity}</span>
                            </div>
                            <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                              {item.explanation}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                        No contradiction signals detected — recommendation layers are harmonized at current posture.
                      </p>
                    </div>
                  )}

                  {treasuryConsistencyCheck.alignedSignals.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Aligned signals</p>
                      <ul style={treasuryListStyle}>
                        {treasuryConsistencyCheck.alignedSignals.map((item, idx) => (
                          <li key={`consistency-aligned-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                        No explicit aligned signals surfaced — review reconciliation suggestions below.
                      </p>
                    </div>
                  )}

                  {treasuryConsistencyCheck.reconciliationSuggestions.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Reconciliation suggestions</p>
                      <ul style={treasuryListStyle}>
                        {treasuryConsistencyCheck.reconciliationSuggestions.map((item, idx) => (
                          <li key={`consistency-reconcile-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryConsistencyCheck.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryRiskNarrative ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Risk Narrative
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory narrative only — no actions executed
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Operator context layer synthesizing Phase 3 operational intelligence — explain and guide only,
                    distinct from the daily treasury narrative.
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "0.5rem",
                      marginBottom: "0.85rem",
                    }}
                  >
                    <span style={treasuryNarrativeStatusBadge(treasuryRiskNarrative.treasuryNarrativeStatus)}>
                      {treasuryNarrativeStatusLabel(treasuryRiskNarrative.treasuryNarrativeStatus)}
                    </span>
                  </div>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Operator posture</p>
                      <span style={operatorPostureBadge(treasuryRiskNarrative.operatorPosture)}>
                        {operatorPostureLabel(treasuryRiskNarrative.operatorPosture)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryRiskNarrative.confidence}/100`}
                      subtitle="Blended explainability, consistency, and decision support"
                      valueColor={scoreColor(treasuryRiskNarrative.confidence)}
                    />
                  </div>

                  <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Operator summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryRiskNarrative.operatorSummary}</p>
                  </div>

                  <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Leadership context</p>
                    <p style={treasurySummaryTextStyle}>{treasuryRiskNarrative.leadershipContext}</p>
                  </div>

                  {treasuryRiskNarrative.watchItems.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Watch items</p>
                      <ul style={treasuryListStyle}>
                        {treasuryRiskNarrative.watchItems.map((item, idx) => (
                          <li key={`risk-narrative-watch-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                        No watch items surfaced — routine observation recommended.
                      </p>
                    </div>
                  )}

                  {treasuryRiskNarrative.operatorRecommendations.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Operator recommendations</p>
                      <ul style={treasuryListStyle}>
                        {treasuryRiskNarrative.operatorRecommendations.map((item, idx) => (
                          <li key={`risk-narrative-rec-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Narrative summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryRiskNarrative.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryOperationalPlaybook ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Operational Playbook
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory playbook only — no actions executed
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Institutional operating guidance synthesized from Phase 3 operational intelligence — observe,
                    check, and consider escalation paths only; no automation or execution.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Playbook status</p>
                      <span style={playbookStatusBadge(treasuryOperationalPlaybook.playbookStatus)}>
                        {playbookStatusLabel(treasuryOperationalPlaybook.playbookStatus)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Operator cadence</p>
                      <span style={operatorCadenceBadge(treasuryOperationalPlaybook.operatorCadence)}>
                        {operatorCadenceLabel(treasuryOperationalPlaybook.operatorCadence)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryOperationalPlaybook.confidence}/100`}
                      subtitle="Blended narrative, decision support, explainability, and consistency"
                      valueColor={scoreColor(treasuryOperationalPlaybook.confidence)}
                    />
                  </div>

                  {treasuryOperationalPlaybook.recommendedPlaybook.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Recommended playbook</p>
                      <ul style={treasuryListStyle}>
                        {treasuryOperationalPlaybook.recommendedPlaybook.map((item, idx) => (
                          <li key={`playbook-rec-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryOperationalPlaybook.watchChecklist.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Watch checklist</p>
                      <ul style={treasuryListStyle}>
                        {treasuryOperationalPlaybook.watchChecklist.map((item, idx) => (
                          <li key={`playbook-watch-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                        No watch checklist items surfaced — routine observation recommended.
                      </p>
                    </div>
                  )}

                  {treasuryOperationalPlaybook.escalationGuidance.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Escalation guidance</p>
                      <ul style={treasuryListStyle}>
                        {treasuryOperationalPlaybook.escalationGuidance.map((item, idx) => (
                          <li key={`playbook-escalation-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryOperationalPlaybook.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryScenarioResponse ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Scenario Response
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory response guidance only — no actions executed
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Operational response guidance synthesized from risk narrative and institutional playbook — observe,
                    contextualize, and consider escalation paths only; no automation or execution.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Treasury scenario</p>
                      <span style={treasuryScenarioBadge(treasuryScenarioResponse.treasuryScenario)}>
                        {treasuryScenarioLabel(treasuryScenarioResponse.treasuryScenario)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Response status</p>
                      <span style={responseStatusBadge(treasuryScenarioResponse.responseStatus)}>
                        {responseStatusLabel(treasuryScenarioResponse.responseStatus)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Monitoring cadence</p>
                      <span style={scenarioMonitoringCadenceBadge(treasuryScenarioResponse.monitoringCadence)}>
                        {scenarioMonitoringCadenceLabel(treasuryScenarioResponse.monitoringCadence)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryScenarioResponse.confidence}/100`}
                      subtitle="Blended playbook, narrative, explainability, and consistency"
                      valueColor={scoreColor(treasuryScenarioResponse.confidence)}
                    />
                  </div>

                  {treasuryScenarioResponse.responseGuidance.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Response guidance</p>
                      <ul style={treasuryListStyle}>
                        {treasuryScenarioResponse.responseGuidance.map((item, idx) => (
                          <li key={`scenario-response-guidance-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryScenarioResponse.escalationGuidance.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Escalation guidance</p>
                      <ul style={treasuryListStyle}>
                        {treasuryScenarioResponse.escalationGuidance.map((item, idx) => (
                          <li key={`scenario-escalation-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryScenarioResponse.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryOperatorTimeline ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Operator Timeline
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory timeline guidance only — no actions executed or scheduled
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Time-sequenced operator focus synthesized from scenario response, playbook, risk narrative,
                    decision support, and institutional memory — observe and contextualize only.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Timeline status</p>
                      <span style={operatorTimelineStatusBadge(treasuryOperatorTimeline.timelineStatus)}>
                        {operatorTimelineStatusLabel(treasuryOperatorTimeline.timelineStatus)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Review cadence</p>
                      <span style={operatorTimelineCadenceBadge(treasuryOperatorTimeline.cadence)}>
                        {operatorTimelineCadenceLabel(treasuryOperatorTimeline.cadence)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryOperatorTimeline.confidence}/100`}
                      subtitle="Blended scenario, playbook, explainability, and institutional memory"
                      valueColor={scoreColor(treasuryOperatorTimeline.confidence)}
                    />
                  </div>

                  {treasuryOperatorTimeline.currentFocus.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Current focus — now / this session</p>
                      <ul style={treasuryListStyle}>
                        {treasuryOperatorTimeline.currentFocus.map((item, idx) => (
                          <li key={`operator-timeline-current-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryOperatorTimeline.nearTermFocus.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Near-term focus — next review period</p>
                      <ul style={treasuryListStyle}>
                        {treasuryOperatorTimeline.nearTermFocus.map((item, idx) => (
                          <li key={`operator-timeline-near-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryOperatorTimeline.futureFocus.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Future focus — longer horizon</p>
                      <ul style={treasuryListStyle}>
                        {treasuryOperatorTimeline.futureFocus.map((item, idx) => (
                          <li key={`operator-timeline-future-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryOperatorTimeline.timelineRecommendations.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Timeline recommendations</p>
                      <ul style={treasuryListStyle}>
                        {treasuryOperatorTimeline.timelineRecommendations.map((item, idx) => (
                          <li key={`operator-timeline-rec-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryOperatorTimeline.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryAttentionPriority ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Attention Priorities
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory prioritization only — no actions executed
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Ranked review focus synthesized from operator timeline, decision support, risk narrative,
                    scenario response, and institutional memory — observe and prioritize only.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Priority status</p>
                      <span style={attentionPriorityStatusBadge(treasuryAttentionPriority.priorityStatus)}>
                        {attentionPriorityStatusLabel(treasuryAttentionPriority.priorityStatus)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryAttentionPriority.confidence}/100`}
                      subtitle="Blended timeline, scenario, decision support, and explainability"
                      valueColor={scoreColor(treasuryAttentionPriority.confidence)}
                    />
                  </div>

                  {treasuryAttentionPriority.immediateAttention.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Immediate attention — review now</p>
                      <ul style={treasuryListStyle}>
                        {treasuryAttentionPriority.immediateAttention.map((item, idx) => (
                          <li key={`attention-immediate-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryAttentionPriority.nearTermAttention.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Near-term attention — next review period</p>
                      <ul style={treasuryListStyle}>
                        {treasuryAttentionPriority.nearTermAttention.map((item, idx) => (
                          <li key={`attention-near-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryAttentionPriority.routineAttention.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Routine attention — ongoing observation</p>
                      <ul style={treasuryListStyle}>
                        {treasuryAttentionPriority.routineAttention.map((item, idx) => (
                          <li key={`attention-routine-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryAttentionPriority.priorityReasons.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Priority reasons</p>
                      <ul style={treasuryListStyle}>
                        {treasuryAttentionPriority.priorityReasons.map((item, idx) => (
                          <li key={`attention-reason-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryAttentionPriority.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryOperationalCoherence ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Operational Coherence
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory coherence check only — no outputs overridden
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Cross-layer operational story alignment across playbook, scenario response, timeline, attention
                    priorities, risk narrative, escalation, and institutional memory — explain and reconcile only.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Coherence status</p>
                      <span style={operationalCoherenceStatusBadge(treasuryOperationalCoherence.coherenceStatus)}>
                        {operationalCoherenceStatusLabel(treasuryOperationalCoherence.coherenceStatus)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryOperationalCoherence.confidence}/100`}
                      subtitle="Blended explainability with cross-layer alignment signals"
                      valueColor={scoreColor(treasuryOperationalCoherence.confidence)}
                    />
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Operator posture</p>
                      <p
                        style={{
                          margin: "0.35rem 0 0",
                          fontSize: "0.88rem",
                          fontWeight: 600,
                          color: "#0f172a",
                          lineHeight: 1.45,
                        }}
                      >
                        {treasuryOperationalCoherence.operatorPosture}
                      </p>
                    </div>
                  </div>

                  {treasuryOperationalCoherence.alignedSignals.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Aligned signals</p>
                      <ul style={treasuryListStyle}>
                        {treasuryOperationalCoherence.alignedSignals.map((item, idx) => (
                          <li key={`coherence-aligned-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                        No aligned signals summarized yet — layers may still be synthesizing.
                      </p>
                    </div>
                  )}

                  {treasuryOperationalCoherence.contradictions.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Contradictions</p>
                      <ul style={treasuryListStyle}>
                        {treasuryOperationalCoherence.contradictions.map((item, idx) => (
                          <li key={`coherence-contradiction-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={{ margin: 0, fontSize: "0.8125rem", color: "#64748b" }}>
                        No cross-layer contradictions detected — operational guidance tells a coherent story.
                      </p>
                    </div>
                  )}

                  {treasuryOperationalCoherence.recommendations.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Recommendations</p>
                      <ul style={treasuryListStyle}>
                        {treasuryOperationalCoherence.recommendations.map((item, idx) => (
                          <li key={`coherence-rec-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryOperationalCoherence.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryAdaptiveReviewCadence ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Adaptive Review Cadence
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory cadence recommendation only — nothing scheduled or sent
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Synthesizes coherence, timeline, attention, narrative, and escalation layers into a suggested
                    observational review frequency — recommend only, never schedule or notify.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Cadence status</p>
                      <span style={adaptiveReviewCadenceStatusBadge(treasuryAdaptiveReviewCadence.cadenceStatus)}>
                        {adaptiveReviewCadenceStatusLabel(treasuryAdaptiveReviewCadence.cadenceStatus)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Recommended cadence</p>
                      <span
                        style={adaptiveReviewRecommendedCadenceBadge(
                          treasuryAdaptiveReviewCadence.recommendedCadence,
                        )}
                      >
                        {adaptiveReviewRecommendedCadenceLabel(treasuryAdaptiveReviewCadence.recommendedCadence)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryAdaptiveReviewCadence.confidence}/100`}
                      subtitle="Blended coherence, timeline, attention, and explainability"
                      valueColor={scoreColor(treasuryAdaptiveReviewCadence.confidence)}
                    />
                  </div>

                  {treasuryAdaptiveReviewCadence.reviewReasoning.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Review reasoning</p>
                      <ul style={treasuryListStyle}>
                        {treasuryAdaptiveReviewCadence.reviewReasoning.map((item, idx) => (
                          <li key={`adaptive-cadence-reason-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryAdaptiveReviewCadence.reviewChecklist.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Review checklist</p>
                      <ul style={treasuryListStyle}>
                        {treasuryAdaptiveReviewCadence.reviewChecklist.map((item, idx) => (
                          <li key={`adaptive-cadence-check-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryAdaptiveReviewCadence.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryLeadershipReadiness ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Leadership Readiness
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory visibility guidance only — no leadership notifications sent
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Synthesizes Phase 3 guidance layers into operator-level vs leadership-visible readiness posture —
                    advisory visibility tier only, never notify, escalate, or deliver.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Readiness status</p>
                      <span style={leadershipReadinessStatusBadge(treasuryLeadershipReadiness.readinessStatus)}>
                        {leadershipReadinessStatusLabel(treasuryLeadershipReadiness.readinessStatus)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Visibility tier</p>
                      <span style={visibilityTierBadge(treasuryLeadershipReadiness.visibilityTier)}>
                        {visibilityTierLabel(treasuryLeadershipReadiness.visibilityTier)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryLeadershipReadiness.confidence}/100`}
                      subtitle="Blended cadence, coherence, attention, and explainability"
                      valueColor={scoreColor(treasuryLeadershipReadiness.confidence)}
                    />
                  </div>

                  {treasuryLeadershipReadiness.leadershipSignals.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Leadership signals</p>
                      <ul style={treasuryListStyle}>
                        {treasuryLeadershipReadiness.leadershipSignals.map((item, idx) => (
                          <li key={`leadership-readiness-lead-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryLeadershipReadiness.operatorSignals.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Operator signals</p>
                      <ul style={treasuryListStyle}>
                        {treasuryLeadershipReadiness.operatorSignals.map((item, idx) => (
                          <li key={`leadership-readiness-op-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryLeadershipReadiness.reasoning.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Reasoning</p>
                      <ul style={treasuryListStyle}>
                        {treasuryLeadershipReadiness.reasoning.map((item, idx) => (
                          <li key={`leadership-readiness-reason-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryLeadershipReadiness.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryMetaReasoning ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Meta-Reasoning
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory meta-reasoning only — no outputs overridden
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Synthesizes trust across all advisory layers — explains why Treasury believes its guidance,
                    reusing confidence explainability as input without duplicating Phase 3K UI.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Trust status</p>
                      <span style={metaReasoningTrustStatusBadge(treasuryMetaReasoning.trustStatus)}>
                        {metaReasoningTrustStatusLabel(treasuryMetaReasoning.trustStatus)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Reasoning strength</p>
                      <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", fontWeight: 600, color: "#334155", lineHeight: 1.45 }}>
                        {treasuryMetaReasoning.reasoningStrength}
                      </p>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryMetaReasoning.confidence}/100`}
                      subtitle="Blended explainability, coherence, cadence, and leadership readiness"
                      valueColor={scoreColor(treasuryMetaReasoning.confidence)}
                    />
                  </div>

                  {treasuryMetaReasoning.confidenceDrivers.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Confidence drivers</p>
                      <ul style={treasuryListStyle}>
                        {treasuryMetaReasoning.confidenceDrivers.map((item, idx) => (
                          <li key={`meta-reasoning-conf-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryMetaReasoning.uncertaintyDrivers.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Uncertainty drivers</p>
                      <ul style={treasuryListStyle}>
                        {treasuryMetaReasoning.uncertaintyDrivers.map((item, idx) => (
                          <li key={`meta-reasoning-unc-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryMetaReasoning.evidenceSignals.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Evidence signals</p>
                      <ul style={treasuryListStyle}>
                        {treasuryMetaReasoning.evidenceSignals.map((item, idx) => (
                          <li key={`meta-reasoning-evidence-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {treasuryMetaReasoning.recommendations.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Recommendations</p>
                      <ul style={treasuryListStyle}>
                        {treasuryMetaReasoning.recommendations.map((item, idx) => (
                          <li key={`meta-reasoning-rec-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryMetaReasoning.summary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryDecisionTrace ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Decision Trace
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory decision trace only — no outputs overridden or executed
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Traces the causal chain from monitoring through meta-reasoning — explains how advisory layers
                    inform one another without executing treasury actions.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Trace status</p>
                      <span style={decisionTraceStatusBadge(treasuryDecisionTrace.traceStatus)}>
                        {decisionTraceStatusLabel(treasuryDecisionTrace.traceStatus)}
                      </span>
                    </div>
                    <KpiCard
                      label="Confidence"
                      value={`${treasuryDecisionTrace.confidence}/100`}
                      subtitle="Blended meta-reasoning, step count, and trace completeness"
                      valueColor={scoreColor(treasuryDecisionTrace.confidence)}
                    />
                    <KpiCard
                      label="Trace steps"
                      value={String(treasuryDecisionTrace.traceSteps.length)}
                      subtitle="Ordered causal steps in advisory chain"
                      valueColor="#334155"
                    />
                  </div>

                  {treasuryDecisionTrace.traceSteps.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Trace timeline</p>
                      <ul style={{ ...treasuryListStyle, margin: 0 }}>
                        {treasuryDecisionTrace.traceSteps.map((item, idx) => (
                          <li
                            key={`decision-trace-step-${idx}`}
                            style={{
                              ...treasuryListItemStyle,
                              padding: "0.55rem 0",
                              borderBottom:
                                idx < treasuryDecisionTrace.traceSteps.length - 1 ? "1px solid #f1f5f9" : "none",
                            }}
                          >
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem", marginBottom: "0.25rem" }}>
                              <span style={treasuryBadgeStyle({ bg: "#f1f5f9", fg: "#475569", border: "#e2e8f0" })}>
                                {item.source}
                              </span>
                            </div>
                            <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.85rem" }}>{item.step}</p>
                            <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                              Effect: {item.effect}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Operator narrative</p>
                    <p style={treasurySummaryTextStyle}>{treasuryDecisionTrace.operatorNarrative}</p>
                  </div>

                  {treasuryDecisionTrace.recommendations.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Recommendations</p>
                      <ul style={treasuryListStyle}>
                        {treasuryDecisionTrace.recommendations.map((item, idx) => (
                          <li key={`decision-trace-rec-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={treasurySummaryBlockStyle}>
                    <p style={treasurySummaryLabelStyle}>Trace summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryDecisionTrace.traceSummary}</p>
                  </div>
                </div>
              ) : null}

              {treasuryRecommendationStability ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Recommendation Stability
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory stability assessment only — no automatic correction
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Observes recommendation continuity across operational event history and current advisory layers —
                    converging, steady, shifting, or diverging posture without executing changes.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Stability status</p>
                      <span style={recommendationStabilityStatusBadge(treasuryRecommendationStability.stabilityStatus)}>
                        {recommendationStabilityStatusLabel(treasuryRecommendationStability.stabilityStatus)}
                      </span>
                    </div>
                    <KpiCard
                      label="Continuity score"
                      value={`${treasuryRecommendationStability.continuityScore}/100`}
                      subtitle="Composite continuity from event history and current layers"
                      valueColor={scoreColor(treasuryRecommendationStability.continuityScore)}
                    />
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Oscillation risk</p>
                      <span style={oscillationRiskBadge(treasuryRecommendationStability.oscillationRisk)}>
                        {oscillationRiskLabel(treasuryRecommendationStability.oscillationRisk)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Recommendation trend</p>
                      <span style={recommendationTrendBadge(treasuryRecommendationStability.recommendationTrend)}>
                        {recommendationTrendLabel(treasuryRecommendationStability.recommendationTrend)}
                      </span>
                    </div>
                  </div>

                  {treasuryRecommendationStability.recommendationHistory.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Recommendation history</p>
                      <ul style={treasuryListStyle}>
                        {treasuryRecommendationStability.recommendationHistory.map((item, idx) => (
                          <li key={`rec-stability-history-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Confidence trend</p>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                      <span style={confidenceTrendBadge(treasuryRecommendationStability.confidenceTrend)}>
                        {confidenceTrendLabel(treasuryRecommendationStability.confidenceTrend)}
                      </span>
                    </div>
                    <p style={treasurySummaryTextStyle}>
                      {treasuryRecommendationStability.confidenceTrend === "strengthening"
                        ? "Recorded confidence scores are trending upward across recent operational cycles."
                        : treasuryRecommendationStability.confidenceTrend === "weakening"
                          ? "Recorded confidence scores are trending downward — interpret cadence guidance cautiously."
                          : "Recorded confidence scores remain relatively flat across recent operational cycles."}
                    </p>
                  </div>

                  <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Operator summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryRecommendationStability.operatorSummary}</p>
                  </div>

                  {treasuryRecommendationStability.recommendations.length > 0 ? (
                    <div style={treasurySummaryBlockStyle}>
                      <p style={treasurySummaryLabelStyle}>Recommendations</p>
                      <ul style={treasuryListStyle}>
                        {treasuryRecommendationStability.recommendations.map((item, idx) => (
                          <li key={`rec-stability-rec-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {treasuryAdvisoryDrift ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Advisory Drift
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory drift analysis only — no automatic correction
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Observes directional advisory posture movement across operational event metadata over time —
                    strengthening, stable, deteriorating, recovery, or volatile patterns without executing changes.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Drift status</p>
                      <span style={advisoryDriftStatusBadge(treasuryAdvisoryDrift.driftStatus)}>
                        {advisoryDriftStatusLabel(treasuryAdvisoryDrift.driftStatus)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Drift direction</p>
                      <span style={driftDirectionBadge(treasuryAdvisoryDrift.driftDirection)}>
                        {driftDirectionLabel(treasuryAdvisoryDrift.driftDirection)}
                      </span>
                    </div>
                    <KpiCard
                      label="Drift confidence"
                      value={`${treasuryAdvisoryDrift.driftConfidence}/100`}
                      subtitle="Composite confidence from event history and stability layers"
                      valueColor={scoreColor(treasuryAdvisoryDrift.driftConfidence)}
                    />
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Momentum</p>
                      <span style={driftMomentumBadge(treasuryAdvisoryDrift.momentum)}>
                        {driftMomentumLabel(treasuryAdvisoryDrift.momentum)}
                      </span>
                    </div>
                  </div>

                  {treasuryAdvisoryDrift.trajectory.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Trajectory history</p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                        {treasuryAdvisoryDrift.trajectory.map((item, idx) => (
                          <span
                            key={`advisory-drift-trajectory-${idx}`}
                            style={{
                              ...treasuryBadgeStyle({ bg: "#f8fafc", fg: "#475569", border: "#e2e8f0" }),
                              textTransform: "none",
                              letterSpacing: "0.01em",
                              whiteSpace: "normal",
                              maxWidth: "100%",
                            }}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Operator narrative</p>
                    <p style={treasurySummaryTextStyle}>{treasuryAdvisoryDrift.operatorNarrative}</p>
                  </div>

                  <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Drift summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryAdvisoryDrift.driftSummary}</p>
                  </div>

                  {treasuryAdvisoryDrift.recommendations.length > 0 ? (
                    <div style={treasurySummaryBlockStyle}>
                      <p style={treasurySummaryLabelStyle}>Recommendations</p>
                      <ul style={treasuryListStyle}>
                        {treasuryAdvisoryDrift.recommendations.map((item, idx) => (
                          <li key={`advisory-drift-rec-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {treasuryRegimeDetection ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Advisory Regime
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Advisory regime classification only — no actions executed
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Synthesizes Phase 3 advisory layers into a single regime posture — stable operations, elevated
                    monitoring, recovery, defensive, scaling pressure, fragmented, volatile, or confidence rebuild —
                    advisory interpretation only.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Regime</p>
                      <span style={treasuryRegimeBadge(treasuryRegimeDetection.regime)}>
                        {treasuryRegimeLabel(treasuryRegimeDetection.regime)}
                      </span>
                    </div>
                    <KpiCard
                      label="Regime confidence"
                      value={`${treasuryRegimeDetection.regimeConfidence}/100`}
                      subtitle="Composite confidence from upstream advisory layers"
                      valueColor={scoreColor(treasuryRegimeDetection.regimeConfidence)}
                    />
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Regime trend</p>
                      <span style={regimeTrendBadge(treasuryRegimeDetection.regimeTrend)}>
                        {regimeTrendLabel(treasuryRegimeDetection.regimeTrend)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Operator posture</p>
                      <span style={regimeOperatorPostureBadge(treasuryRegimeDetection.operatorPosture)}>
                        {regimeOperatorPostureLabel(treasuryRegimeDetection.operatorPosture)}
                      </span>
                    </div>
                  </div>

                  {treasuryRegimeDetection.signals.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Contributing signals</p>
                      <ul style={treasuryListStyle}>
                        {treasuryRegimeDetection.signals.map((item, idx) => (
                          <li key={`regime-signal-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryRegimeDetection.summary}</p>
                  </div>

                  {treasuryRegimeDetection.recommendations.length > 0 ? (
                    <div style={treasurySummaryBlockStyle}>
                      <p style={treasurySummaryLabelStyle}>Recommendations</p>
                      <ul style={treasuryListStyle}>
                        {treasuryRegimeDetection.recommendations.map((item, idx) => (
                          <li key={`regime-rec-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {treasuryAdvisoryOutlook ? (
                <div style={{ marginBottom: "1.25rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.35rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury Advisory Outlook
                  </p>
                  <div style={treasuryPanelHighlightStyle}>
                    <p style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "#0369a1", lineHeight: 1.5 }}>
                      Near-term advisory outlook only — not a forecast or prediction
                    </p>
                  </div>
                  <p style={{ ...treasurySectionIntroStyle, margin: "0.85rem 0", fontSize: "0.78rem" }}>
                    Synthesizes Phase 3 advisory layers into a forward-leaning near-term outlook — improving,
                    stabilizing, cautious, elevated monitoring, recovery, deteriorating, or uncertain — advisory
                    interpretation only.
                  </p>
                  <div style={treasuryKpiGridStyle}>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Outlook</p>
                      <span style={advisoryOutlookBadge(treasuryAdvisoryOutlook.outlook)}>
                        {advisoryOutlookLabel(treasuryAdvisoryOutlook.outlook)}
                      </span>
                    </div>
                    <KpiCard
                      label="Outlook confidence"
                      value={`${treasuryAdvisoryOutlook.outlookConfidence}/100`}
                      subtitle="Composite confidence from Phase 3 advisory layers"
                      valueColor={scoreColor(treasuryAdvisoryOutlook.outlookConfidence)}
                    />
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Outlook direction</p>
                      <span style={outlookDirectionBadge(treasuryAdvisoryOutlook.outlookDirection)}>
                        {outlookDirectionLabel(treasuryAdvisoryOutlook.outlookDirection)}
                      </span>
                    </div>
                    <div style={treasuryInnerKpiTileStyle}>
                      <p style={treasuryKpiLabelStyle}>Operator posture</p>
                      <span style={outlookOperatorPostureBadge(treasuryAdvisoryOutlook.operatorPosture)}>
                        {outlookOperatorPostureLabel(treasuryAdvisoryOutlook.operatorPosture)}
                      </span>
                    </div>
                  </div>

                  {treasuryAdvisoryOutlook.signals.length > 0 ? (
                    <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                      <p style={treasurySummaryLabelStyle}>Contributing signals</p>
                      <ul style={treasuryListStyle}>
                        {treasuryAdvisoryOutlook.signals.map((item, idx) => (
                          <li key={`outlook-signal-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div style={{ ...treasurySummaryBlockStyle, marginBottom: "1rem" }}>
                    <p style={treasurySummaryLabelStyle}>Outlook summary</p>
                    <p style={treasurySummaryTextStyle}>{treasuryAdvisoryOutlook.outlookSummary}</p>
                  </div>

                  {treasuryAdvisoryOutlook.recommendations.length > 0 ? (
                    <div style={treasurySummaryBlockStyle}>
                      <p style={treasurySummaryLabelStyle}>Recommendations</p>
                      <ul style={treasuryListStyle}>
                        {treasuryAdvisoryOutlook.recommendations.map((item, idx) => (
                          <li key={`outlook-rec-${idx}`} style={treasuryListItemStyle}>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "#f0f9ff",
                  border: "1px solid #bae6fd",
                  marginBottom: "1rem",
                }}
              >
                <p
                  style={{
                    margin: "0 0 0.65rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#0369a1",
                  }}
                >
                  Latest emitted monitoring summary
                </p>
                {monitoringEmissionSummary ? (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 120px), 1fr))",
                      gap: "0.65rem",
                    }}
                  >
                    <div>
                      <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
                        Emitted
                      </p>
                      <p style={{ margin: "0.25rem 0 0", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                        {monitoringEmissionSummary.emittedCount}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
                        Skipped
                      </p>
                      <p style={{ margin: "0.25rem 0 0", fontSize: "1.05rem", fontWeight: 800, color: "#0f172a" }}>
                        {monitoringEmissionSummary.skippedCount}
                      </p>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <p style={{ margin: 0, fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
                        Monitoring posture
                      </p>
                      <p style={{ margin: "0.25rem 0 0", fontSize: "0.88rem", fontWeight: 600, color: "#0369a1", lineHeight: 1.4 }}>
                        {monitoringEmissionSummary.posturePhrase}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                    Monitoring emission runs after each load cycle when treasury signals stabilize.
                  </p>
                )}
              </div>

              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <p
                  style={{
                    margin: "0 0 0.65rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Recent treasury events
                </p>
                {eventsLoading && operationalEvents.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>Loading events…</p>
                ) : operationalEvents.length === 0 ? (
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
                    No operational events recorded yet. Events appear after snapshots save or when monitoring signals
                    materially change.
                  </p>
                ) : (
                  <ul style={{ ...treasuryListStyle, margin: 0 }}>
                    {operationalEvents.map((evt) => (
                      <li
                        key={evt.id}
                        style={{
                          ...treasuryListItemStyle,
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: "0.5rem",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: "1 1 12rem" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem", marginBottom: "0.25rem" }}>
                            <span style={treasuryEventSeverityBadge(evt.severity)}>{evt.severity}</span>
                            <span style={{ fontSize: "0.68rem", color: "#94a3b8", textTransform: "uppercase", fontWeight: 700 }}>
                              {evt.eventType?.replace(/_/g, " ")}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.88rem" }}>{evt.title}</p>
                          {evt.description ? (
                            <p style={{ margin: "0.25rem 0 0", fontSize: "0.8rem", color: "#475569", lineHeight: 1.4 }}>
                              {evt.description}
                            </p>
                          ) : null}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "#94a3b8", whiteSpace: "nowrap" }}>
                          {formatWhen(evt.createdAt)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        <section style={treasuryExecutiveSectionStyle}>
          <h3 style={sectionHeading}>Unified treasury score</h3>
          <p style={treasurySectionIntroStyle}>
            A single executive synthesis of all treasury intelligence — answering how healthy and operationally ready
            treasury is overall, and what the single treasury story is right now. Read-only and advisory only. No
            automation or financial mutations.
          </p>
          {!unifiedTreasuryScore ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading unified treasury score…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <KpiCard
                  label="Unified treasury score"
                  value={`${unifiedTreasuryScore.unifiedTreasuryScore}/100`}
                  subtitle="Executive treasury rating"
                  valueColor={scoreColor(unifiedTreasuryScore.unifiedTreasuryScore)}
                />
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Treasury grade
                  </p>
                  <span style={treasuryGradeBadge(unifiedTreasuryScore.treasuryGrade)}>
                    {unifiedTreasuryScore.treasuryGrade}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Treasury story
                  </p>
                  <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.3 }}>
                    {unifiedTreasuryScore.treasuryStory}
                  </span>
                </div>
                <KpiCard
                  label="Treasury confidence"
                  value={operatingConfidenceLabel(unifiedTreasuryScore.treasuryConfidence)}
                  subtitle={`${unifiedTreasuryScore.confidence}% signal availability`}
                  valueColor={operatingConfidenceColor(unifiedTreasuryScore.treasuryConfidence)}
                />
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Treasury condition
                  </p>
                  <span style={unifiedConditionBadge(unifiedTreasuryScore.treasuryCondition)}>
                    {unifiedConditionLabel(unifiedTreasuryScore.treasuryCondition)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Operating recommendation
                  </p>
                  <span style={operatingRecommendationBadge(unifiedTreasuryScore.operatingRecommendation)}>
                    {operatingRecommendationLabel(unifiedTreasuryScore.operatingRecommendation)}
                  </span>
                </div>
              </div>

              {unifiedTreasuryScore.strengths.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Strengths
                  </p>
                  <ul style={treasuryListStyle}>
                    {unifiedTreasuryScore.strengths.map((item, idx) => (
                      <li key={`unified-strength-${idx}`} style={treasuryListItemStyle}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {unifiedTreasuryScore.concernAreas.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Concern areas
                  </p>
                  <ul style={treasuryListStyle}>
                    {unifiedTreasuryScore.concernAreas.map((item, idx) => (
                      <li key={`unified-concern-${idx}`} style={treasuryListItemStyle}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {unifiedTreasuryScore.recommendations.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Recommendations
                  </p>
                  <ul style={treasuryListStyle}>
                    {unifiedTreasuryScore.recommendations.map((item, idx) => (
                      <li key={`unified-rec-${idx}`} style={treasuryListItemStyle}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <p
                  style={{
                    margin: "0 0 0.4rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Board summary
                </p>
                <p style={treasurySummaryTextStyle}>
                  {unifiedTreasuryScore.boardSummary}
                </p>
              </div>
            </div>
          )}
        </section>

        <section style={treasuryExecutiveSectionStyle}>
          <h3 style={sectionHeading}>Treasury executive briefing</h3>
          <p style={treasurySectionIntroStyle}>
            A sixty-second leadership digest compressing unified score, narrative, timeline, and monitoring signals into
            what treasury leadership should know now. Read-only and advisory only. No automation or financial mutations.
          </p>
          {!treasuryExecutiveBriefing ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading treasury executive briefing…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "0.65rem",
                  marginBottom: "0.85rem",
                }}
              >
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      lineHeight: 1.4,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {treasuryExecutiveBriefing.executiveHeadline}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    <span style={briefingExecutiveStatusBadge(treasuryExecutiveBriefing.executiveStatus)}>
                      {briefingExecutiveStatusLabel(treasuryExecutiveBriefing.executiveStatus)}
                    </span>
                    <span style={briefingExecutivePriorityBadge(treasuryExecutiveBriefing.executivePriority)}>
                      {briefingExecutivePriorityLabel(treasuryExecutiveBriefing.executivePriority)}
                    </span>
                    <span style={briefingExecutiveOutlookBadge(treasuryExecutiveBriefing.executiveOutlook)}>
                      {briefingExecutiveOutlookLabel(treasuryExecutiveBriefing.executiveOutlook)}
                    </span>
                  </div>
                </div>
                <div style={{ flex: "0 0 auto", textAlign: "right" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Confidence
                  </p>
                  <p
                    style={{
                      margin: "0.15rem 0 0",
                      fontSize: "1.15rem",
                      fontWeight: 800,
                      color: scoreColor(treasuryExecutiveBriefing.confidence),
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {treasuryExecutiveBriefing.confidence}/100
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Executive status
                  </p>
                  <span style={briefingExecutiveStatusBadge(treasuryExecutiveBriefing.executiveStatus)}>
                    {briefingExecutiveStatusLabel(treasuryExecutiveBriefing.executiveStatus)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Executive priority
                  </p>
                  <span style={briefingExecutivePriorityBadge(treasuryExecutiveBriefing.executivePriority)}>
                    {briefingExecutivePriorityLabel(treasuryExecutiveBriefing.executivePriority)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Executive outlook
                  </p>
                  <span style={briefingExecutiveOutlookBadge(treasuryExecutiveBriefing.executiveOutlook)}>
                    {briefingExecutiveOutlookLabel(treasuryExecutiveBriefing.executiveOutlook)}
                  </span>
                </div>
              </div>

              {treasuryExecutiveBriefing.keyLeadershipPoints.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Key leadership points
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryExecutiveBriefing.keyLeadershipPoints.map((item, idx) => (
                      <li
                        key={`briefing-leadership-${idx}`}
                        style={treasuryListItemStyle}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {treasuryExecutiveBriefing.actionFocus.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Action focus
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryExecutiveBriefing.actionFocus.map((item, idx) => (
                      <li key={`briefing-action-${idx}`} style={treasuryListItemStyle}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <p
                  style={{
                    margin: "0 0 0.4rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Briefing summary
                </p>
                <p style={treasurySummaryTextStyle}>
                  {treasuryExecutiveBriefing.briefingSummary}
                </p>
              </div>
            </div>
          )}
        </section>

        <section style={treasuryExecutiveSectionStyle}>
          <h3 style={sectionHeading}>Treasury Readiness Index</h3>
          <p style={treasurySectionIntroStyle}>
            A launch-facing treasury readiness signal answering whether treasury is ready for current launch
            conditions and what launch posture leadership should use today. Read-only and advisory only. No automation
            or financial mutations.
          </p>
          {!treasuryReadinessIndexResult ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading treasury readiness index…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <KpiCard
                  label="Treasury Readiness Index"
                  value={`${treasuryReadinessIndexResult.treasuryReadinessIndex}/100`}
                  subtitle="Launch readiness rating"
                  valueColor={scoreColor(treasuryReadinessIndexResult.treasuryReadinessIndex)}
                />
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Treasury Launch Signal
                  </p>
                  <span style={readinessIndexLaunchSignalBadge(treasuryReadinessIndexResult.treasuryLaunchSignal)}>
                    {readinessIndexLaunchSignalLabel(treasuryReadinessIndexResult.treasuryLaunchSignal)}
                  </span>
                </div>
                <KpiCard
                  label="Launch Confidence"
                  value={operatingConfidenceLabel(treasuryReadinessIndexResult.launchConfidence)}
                  subtitle={`${treasuryReadinessIndexResult.confidence}% signal availability`}
                  valueColor={operatingConfidenceColor(treasuryReadinessIndexResult.launchConfidence)}
                />
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Treasury Launch Condition
                  </p>
                  <span style={unifiedConditionBadge(treasuryReadinessIndexResult.treasuryLaunchCondition)}>
                    {unifiedConditionLabel(treasuryReadinessIndexResult.treasuryLaunchCondition)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Recommended Launch Posture
                  </p>
                  <span
                    style={readinessIndexLaunchPostureBadge(treasuryReadinessIndexResult.recommendedLaunchPosture)}
                  >
                    {readinessIndexLaunchPostureLabel(treasuryReadinessIndexResult.recommendedLaunchPosture)}
                  </span>
                </div>
                <KpiCard
                  label="Confidence"
                  value={`${treasuryReadinessIndexResult.confidence}/100`}
                  subtitle="Assessment certainty"
                  valueColor={scoreColor(treasuryReadinessIndexResult.confidence)}
                />
              </div>

              {treasuryReadinessIndexResult.readinessDrivers.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Readiness Drivers
                  </p>
                  <div style={{ display: "grid", gap: "0.55rem" }}>
                    {treasuryReadinessIndexResult.readinessDrivers.map((driver, idx) => (
                      <div
                        key={`readiness-index-driver-${idx}`}
                        style={{
                          padding: "0.65rem 0.75rem",
                          borderRadius: "10px",
                          background: "#f8fafc",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                          <span style={readinessIndexDriverTypeBadge(driver.type)}>
                            {readinessIndexDriverTypeLabel(driver.type)}
                          </span>
                          <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0f172a" }}>{driver.title}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                          {driver.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {treasuryReadinessIndexResult.watchAreas.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Watch Areas
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryReadinessIndexResult.watchAreas.map((item, idx) => (
                      <li
                        key={`readiness-index-watch-${idx}`}
                        style={treasuryListItemStyle}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {treasuryReadinessIndexResult.recommendations.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Recommendations
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryReadinessIndexResult.recommendations.map((item, idx) => (
                      <li
                        key={`readiness-index-rec-${idx}`}
                        style={treasuryListItemStyle}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <p
                  style={{
                    margin: "0 0 0.4rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Summary
                </p>
                <p style={treasurySummaryTextStyle}>
                  {treasuryReadinessIndexResult.summary}
                </p>
              </div>
            </div>
          )}
        </section>
        </>
        )}
        </TreasuryIntelligenceGroup>

        <TreasuryIntelligenceGroup
          id="treasury-health-monitoring"
          title="Treasury Health & Monitoring"
          description="Operational snapshots, drift, stability, narrative, and alert history."
          priorityLabel="Review after command center"
          sectionCount={11}
          statusLabel={healthGroupStatus.label}
          statusVariant={healthGroupStatus.variant}
          onActivate={handleGroupActivate}
        >
        {() => (
        <>
        <section id="treasury-event-center" style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury Event Center</h3>
          <p style={treasurySectionIntroStyle}>
            Centralized read-only ingestion of real operational events across Tropicash — fraud, security,
            withdrawals, admin audit, notifications, and treasury operational signals. Observation only; no event
            mutations, execution, or financial automation.
          </p>
          {treasuryCenterLoading && treasuryCenterEvents.length === 0 ? (
            <TreasurySectionShell loading={treasuryCenterLoading} loadingLabel="Loading treasury events…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <p style={{ ...treasurySummaryTextStyle, margin: 0, flex: "1 1 280px" }}>
                  {treasuryEventSummary.summary}
                </p>
                <button
                  type="button"
                  className={treasuryFocusRingClass}
                  style={{
                    padding: "0.45rem 0.85rem",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#fff",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: treasuryCenterLoading ? "wait" : "pointer",
                    opacity: treasuryCenterLoading ? 0.7 : 1,
                  }}
                  onClick={() => void loadTreasuryCenterEvents()}
                  disabled={treasuryCenterLoading}
                >
                  {treasuryCenterLoading ? "Refreshing…" : "Refresh events"}
                </button>
              </div>

              {treasuryCenterError ? (
                <p style={{ margin: "0 0 0.85rem", fontSize: "0.85rem", color: "#b91c1c" }}>{treasuryCenterError}</p>
              ) : null}

              <div style={treasuryKpiGridStyle}>
                {[
                  { label: "Total events", value: treasuryEventSummary.totalEvents },
                  { label: "Critical", value: treasuryEventSummary.criticalEvents },
                  { label: "Warning", value: treasuryEventSummary.warningEvents },
                  { label: "Informational", value: treasuryEventSummary.informationalEvents },
                ].map(({ label, value }) => (
                  <div key={label} style={treasuryKpiCardStyle}>
                    <p style={treasuryKpiLabelStyle}>{label}</p>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "1rem" }}>
                <p style={{ ...treasurySummaryLabelStyle, margin: "0 0 0.5rem" }}>Category breakdown</p>
                <div style={treasuryKpiGridWideStyle}>
                  {TREASURY_EVENT_CATEGORIES.map((cat) => (
                    <div key={cat} style={treasuryInnerKpiTileStyle}>
                      <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                        {cat}
                      </p>
                      <p style={{ margin: "0.2rem 0 0", fontSize: "1.05rem", fontWeight: 700, color: "#334155" }}>
                        {treasuryEventSummary.categories[cat] ?? 0}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  ...treasuryPanelHighlightStyle,
                  marginTop: "1rem",
                  borderColor: treasuryEventHealth.attentionRequired ? "#fcd34d" : "#e2e8f0",
                  background: treasuryEventHealth.attentionRequired ? "#fffbeb" : "#f8fafc",
                }}
              >
                <p style={{ ...treasurySummaryLabelStyle, margin: 0 }}>Event health</p>
                <p style={{ ...treasurySummaryTextStyle, marginTop: "0.45rem", fontWeight: 600 }}>
                  {humanize(treasuryEventHealth.healthStatus)} — risk {humanize(treasuryEventHealth.riskLevel)}
                  {treasuryEventHealth.attentionRequired ? " · attention recommended" : ""}
                </p>
                {treasuryEventHealth.recommendations?.length > 0 ? (
                  <ul style={{ ...treasuryListStyle, marginTop: "0.65rem", marginBottom: 0 }}>
                    {treasuryEventHealth.recommendations.map((rec) => (
                      <li key={rec} style={treasuryListItemStyle}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.75rem",
                  marginTop: "1.15rem",
                  alignItems: "flex-end",
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem" }}>
                  <span style={{ fontWeight: 700, color: "#64748b" }}>Severity</span>
                  <select
                    className={treasuryFocusRingClass}
                    value={eventCenterSeverityFilter}
                    onChange={(e) => setEventCenterSeverityFilter(e.target.value)}
                    style={{ padding: "0.4rem 0.55rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="all">All</option>
                    {TREASURY_EVENT_SEVERITIES.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem" }}>
                  <span style={{ fontWeight: 700, color: "#64748b" }}>Category</span>
                  <select
                    className={treasuryFocusRingClass}
                    value={eventCenterCategoryFilter}
                    onChange={(e) => setEventCenterCategoryFilter(e.target.value)}
                    style={{ padding: "0.4rem 0.55rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="all">All</option>
                    {TREASURY_EVENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.78rem" }}>
                  <span style={{ fontWeight: 700, color: "#64748b" }}>Source</span>
                  <select
                    className={treasuryFocusRingClass}
                    value={eventCenterSourceFilter}
                    onChange={(e) => setEventCenterSourceFilter(e.target.value)}
                    style={{ padding: "0.4rem 0.55rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="all">All</option>
                    {TREASURY_EVENT_SOURCES.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "1rem" }}>
                Recent events ({filteredTreasuryCenterEvents.length})
              </p>
              {filteredTreasuryCenterEvents.length === 0 ? (
                <p style={{ ...treasurySummaryTextStyle, marginTop: "0.35rem" }}>
                  No events match the current filters.
                </p>
              ) : (
                <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem", minWidth: "640px" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e2e8f0", textAlign: "left" }}>
                        {["Time", "Source", "Category", "Severity", "Title", "Actions"].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "0.5rem 0.65rem",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              color: "#94a3b8",
                              textTransform: "uppercase",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTreasuryCenterEvents.slice(0, 50).map((evt) => (
                        <tr key={evt.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "0.55rem 0.65rem", whiteSpace: "nowrap", color: "#64748b" }}>
                            {formatWhen(evt.created_at)}
                          </td>
                          <td style={{ padding: "0.55rem 0.65rem", color: "#475569" }}>
                            {evt.source.replace(/_/g, " ")}
                          </td>
                          <td style={{ padding: "0.55rem 0.65rem", color: "#475569" }}>{evt.category}</td>
                          <td style={{ padding: "0.55rem 0.65rem" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                              <span style={treasuryEventSeverityBadge(evt.severity)}>{evt.severity}</span>
                              {(() => {
                                const resolution = eventResolutionsByEventId[evt.id];
                                const status = resolution?.status || "open";
                                const isUntracked = !resolution;
                                return (
                                  <span
                                    style={treasuryResolutionStatusBadge(status)}
                                    title={isUntracked ? "No resolution record yet — treated as open" : undefined}
                                  >
                                    {isUntracked ? "Open (untracked)" : treasuryResolutionStatusLabel(status)}
                                  </span>
                                );
                              })()}
                            </div>
                          </td>
                          <td style={{ padding: "0.55rem 0.65rem", color: "#0f172a", fontWeight: 600 }}>
                            {evt.title}
                            {evt.description ? (
                              <span style={{ display: "block", fontWeight: 400, fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                                {evt.description}
                              </span>
                            ) : null}
                          </td>
                          <td style={{ padding: "0.55rem 0.65rem", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              className={treasuryFocusRingClass}
                              style={{
                                padding: "0.35rem 0.65rem",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                background: "#fff",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                color: "#0369a1",
                                cursor: "pointer",
                              }}
                              onClick={() => openTreasuryEventDrawer(evt)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <p style={{ margin: "0.85rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
                Source counts:{" "}
                {Object.entries(treasuryCenterSources)
                  .map(([k, v]) => `${k.replace(/_/g, " ")} ${v}`)
                  .join(" · ") || "none"}
              </p>
            </div>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury monitoring dashboard</h3>
          <p style={treasurySectionIntroStyle}>
            Operational snapshot-to-snapshot visibility — read-only and advisory only. No automation or financial
            mutations.
          </p>
          {!monitoringDashboard ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading monitoring dashboard…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  marginBottom: "0.85rem",
                }}
              >
                <p style={{ ...treasurySummaryTextStyle, flex: "1 1 280px" }}>
                  {monitoringDashboard.dashboardSummary}
                </p>
                <div style={{ flex: "0 0 auto", display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "flex-start" }}>
                  <div style={{ textAlign: "right" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                      }}
                    >
                      Treasury momentum
                    </p>
                    <p style={{ margin: "0.25rem 0 0" }}>
                      <span style={treasuryMomentumBadgeStyle(monitoringDashboard.treasuryMomentum)}>
                        {treasuryMomentumLabel(monitoringDashboard.treasuryMomentum)}
                      </span>
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                      }}
                    >
                      Confidence
                    </p>
                    <p
                      style={{
                        margin: "0.15rem 0 0",
                        fontSize: "1.15rem",
                        fontWeight: 800,
                        color:
                          monitoringDashboard.confidence >= 80
                            ? "#047857"
                            : monitoringDashboard.confidence >= 50
                              ? "#92400e"
                              : "#64748b",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {monitoringDashboard.confidence}%
                    </p>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 220px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                {[
                  {
                    key: "healthTimeline",
                    label: "Health timeline",
                    timeline: monitoringDashboard.healthTimeline,
                    sparkColor: "#0ea5e9",
                  },
                  {
                    key: "pressureTimeline",
                    label: "Pressure timeline",
                    timeline: monitoringDashboard.pressureTimeline,
                    sparkColor: "#8b5cf6",
                  },
                  {
                    key: "riskTimeline",
                    label: "Risk timeline",
                    timeline: monitoringDashboard.riskTimeline,
                    sparkColor: "#f59e0b",
                  },
                ].map(({ key, label, timeline, sparkColor }) => (
                  <div
                    key={key}
                    style={{
                      padding: "0.75rem 0.85rem",
                      borderRadius: "10px",
                      background: "#f8fafc",
                      border: "1px solid #f1f5f9",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.45rem",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.64rem",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                      }}
                    >
                      {label}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        color: historicalTrendColor(timeline?.direction),
                        textTransform: "capitalize",
                      }}
                    >
                      {historicalTrendLabel(timeline?.direction)}
                    </p>
                    {timeline?.dataPoints?.length > 1 ? (
                      <HistorySparkline dataPoints={timeline.dataPoints} color={sparkColor} />
                    ) : null}
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", lineHeight: 1.4 }}>
                      {timeline?.summary}
                    </p>
                  </div>
                ))}
              </div>

              {monitoringDashboard.stabilitySignals.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Stability signals
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
                    {monitoringDashboard.stabilitySignals.map((signal, idx) => (
                      <li
                        key={`stability-${idx}`}
                        style={{
                          padding: "0.6rem 0.75rem",
                          borderRadius: "8px",
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          fontSize: "0.78rem",
                          color: "#64748b",
                          lineHeight: 1.45,
                        }}
                      >
                        {signal}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {monitoringDashboard.recentMovements.length > 0 ? (
                <div>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Recent movements
                  </p>
                  <ul style={treasuryListStyle}>
                    {monitoringDashboard.recentMovements.map((movement, idx) => (
                      <li key={`movement-${idx}`} style={treasuryListItemStyle}>
                        {movement}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury historical analytics</h3>
          <p style={treasurySectionIntroStyle}>
            Historical trend visibility from snapshot history — read-only and advisory only. No automation or financial
            mutations.
          </p>
          {!historicalAnalytics ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading historical analytics…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "0.65rem",
                  marginBottom: "0.85rem",
                }}
              >
                <p style={{ ...treasurySummaryTextStyle, flex: "1 1 280px" }}>
                  {historicalAnalytics.analyticsSummary}
                </p>
                <div style={{ flex: "0 0 auto", textAlign: "right" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Confidence
                  </p>
                  <p
                    style={{
                      margin: "0.15rem 0 0",
                      fontSize: "1.15rem",
                      fontWeight: 800,
                      color:
                        historicalAnalytics.confidence >= 80
                          ? "#047857"
                          : historicalAnalytics.confidence >= 50
                            ? "#92400e"
                            : "#64748b",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {historicalAnalytics.confidence}%
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                {[
                  {
                    key: "health",
                    label: "Health trend",
                    trend: historicalAnalytics.historicalHealthTrend,
                    sparkColor: "#0ea5e9",
                  },
                  {
                    key: "risk",
                    label: "Risk trend",
                    trend: historicalAnalytics.historicalRiskTrend,
                    sparkColor: "#f59e0b",
                  },
                  {
                    key: "exposure",
                    label: "Exposure trend",
                    trend: historicalAnalytics.exposureTrend,
                    sparkColor: "#8b5cf6",
                  },
                  {
                    key: "liability",
                    label: "Liability trend",
                    trend: historicalAnalytics.liabilityTrend,
                    sparkColor: "#6366f1",
                  },
                  {
                    key: "resilience",
                    label: "Resilience trend",
                    trend: historicalAnalytics.resilienceTrend,
                    sparkColor: "#10b981",
                  },
                ].map(({ key, label, trend, sparkColor }) => (
                  <div
                    key={key}
                    style={{
                      padding: "0.75rem 0.85rem",
                      borderRadius: "10px",
                      background: "#f8fafc",
                      border: "1px solid #f1f5f9",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.45rem",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.64rem",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                      }}
                    >
                      {label}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "0.95rem",
                        fontWeight: 700,
                        color: historicalTrendColor(trend?.direction),
                        textTransform: "capitalize",
                      }}
                    >
                      {historicalTrendLabel(trend?.direction)}
                    </p>
                    {trend?.dataPoints?.length > 1 ? (
                      <HistorySparkline dataPoints={trend.dataPoints} color={sparkColor} />
                    ) : null}
                    <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", lineHeight: 1.4 }}>{trend?.summary}</p>
                  </div>
                ))}
              </div>

              {historicalAnalytics.volatilityIndicators.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Volatility indicators
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
                    {historicalAnalytics.volatilityIndicators.map((indicator, idx) => (
                      <li
                        key={`${indicator.label}-${idx}`}
                        style={{
                          padding: "0.6rem 0.75rem",
                          borderRadius: "8px",
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                        }}
                      >
                        <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#0f172a" }}>
                          {indicator.label}
                        </p>
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                          {indicator.description}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {historicalAnalytics.notableChanges.length > 0 ? (
                <div>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Notable changes
                  </p>
                  <ul style={treasuryListStyle}>
                    {historicalAnalytics.notableChanges.map((note, idx) => (
                      <li key={idx} style={treasuryListItemStyle}>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury drift detection</h3>
          <p style={treasurySectionIntroStyle}>
            Snapshot-to-snapshot change awareness — what changed and whether treasury meaningfully drifted from prior
            operating conditions. Read-only and advisory only.
          </p>
          {!treasuryDrift ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading treasury drift assessment…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Drift status
                  </p>
                  <span style={driftStatusBadge(treasuryDrift.driftStatus)}>
                    {driftStatusLabel(treasuryDrift.driftStatus)}
                  </span>
                </div>
                <KpiCard
                  label="Drift magnitude"
                  value={String(treasuryDrift.driftMagnitude)}
                  subtitle="0–100 movement index"
                  valueColor={driftStatusColor(treasuryDrift.driftStatus)}
                />
                <KpiCard
                  label="Stability assessment"
                  value={stabilityAssessmentLabel(treasuryDrift.stabilityAssessment)}
                  subtitle="Operating condition stability"
                  valueColor={stabilityAssessmentColor(treasuryDrift.stabilityAssessment)}
                />
                <KpiCard
                  label="Confidence"
                  value={`${treasuryDrift.confidence}%`}
                  subtitle="Drift signal availability"
                  valueColor={
                    treasuryDrift.confidence >= 80
                      ? "#047857"
                      : treasuryDrift.confidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
              </div>

              {treasuryDrift.driftDrivers.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Drift drivers
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
                    {treasuryDrift.driftDrivers.map((driver, idx) => {
                      const pal = driftDriverTypeStyle(driver.type);
                      return (
                        <li
                          key={`drift-driver-${idx}`}
                          style={{
                            padding: "0.65rem 0.75rem",
                            borderRadius: "8px",
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.45rem",
                              marginBottom: "0.3rem",
                            }}
                          >
                            <span style={treasuryBadgeStyle(pal)}>
                              {driver.type}
                            </span>
                            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0f172a" }}>
                              {driver.title}
                            </span>
                            {driver.impact ? (
                              <span style={{ fontSize: "0.68rem", color: "#94a3b8", textTransform: "uppercase" }}>
                                Impact: {driver.impact}
                              </span>
                            ) : null}
                          </div>
                          <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                            {driver.explanation}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {treasuryDrift.meaningfulChanges.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Meaningful changes
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryDrift.meaningfulChanges.map((change, idx) => (
                      <li key={`drift-change-${idx}`} style={treasuryListItemStyle}>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p style={treasurySummaryTextStyle}>{treasuryDrift.summary}</p>
            </div>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury stability</h3>
          <p style={treasurySectionIntroStyle}>
            Stability score and operating confidence synthesize trends, readiness, drift, monitoring, and historical
            signals — read-only and advisory only. No automation or financial mutations.
          </p>
          {!treasuryStability ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading treasury stability assessment…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <KpiCard
                  label="Stability score"
                  value={String(treasuryStability.stabilityScore)}
                  subtitle="0–100 composite"
                  valueColor={scoreColor(treasuryStability.stabilityScore)}
                />
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Stability level
                  </p>
                  <span style={stabilityLevelBadge(treasuryStability.stabilityLevel)}>
                    {stabilityLevelLabel(treasuryStability.stabilityLevel)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Operating confidence
                  </p>
                  <span style={operatingConfidenceBadge(treasuryStability.operatingConfidence)}>
                    {operatingConfidenceLabel(treasuryStability.operatingConfidence)}
                  </span>
                </div>
                <KpiCard
                  label="Treasury consistency"
                  value={treasuryConsistencyLabel(treasuryStability.treasuryConsistency)}
                  subtitle="Signal alignment"
                  valueColor={treasuryConsistencyColor(treasuryStability.treasuryConsistency)}
                />
                <KpiCard
                  label="Volatility assessment"
                  value={volatilityAssessmentLabel(treasuryStability.volatilityAssessment)}
                  subtitle="Historical variance"
                  valueColor={volatilityAssessmentColor(treasuryStability.volatilityAssessment)}
                />
                <KpiCard
                  label="Confidence"
                  value={`${treasuryStability.confidence}%`}
                  subtitle="Stability signal availability"
                  valueColor={
                    treasuryStability.confidence >= 80
                      ? "#047857"
                      : treasuryStability.confidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
              </div>

              {treasuryStability.stabilityDrivers.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Stability drivers
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
                    {treasuryStability.stabilityDrivers.map((driver, idx) => {
                      const pal = stabilityDriverTypeStyle(driver.type);
                      return (
                        <li
                          key={`stability-driver-${idx}`}
                          style={{
                            padding: "0.65rem 0.75rem",
                            borderRadius: "8px",
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.45rem",
                              marginBottom: "0.3rem",
                            }}
                          >
                            <span style={treasuryBadgeStyle(pal)}>
                              {driver.type}
                            </span>
                            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0f172a" }}>
                              {driver.title}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                            {driver.explanation}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {treasuryStability.cautionAreas.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Caution areas
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryStability.cautionAreas.map((area, idx) => (
                      <li key={`stability-caution-${idx}`} style={treasuryListItemStyle}>
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p style={treasurySummaryTextStyle}>
                {treasuryStability.summary}
              </p>
            </div>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury daily narrative</h3>
          <p style={treasurySectionIntroStyle}>
            A single, leadership-ready treasury story — what treasury leadership would say happened today, in a calm
            institutional voice. Read-only and advisory only. No automation or financial mutations.
          </p>
          {!treasuryNarrative ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading treasury daily narrative…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "0.65rem",
                  marginBottom: "0.85rem",
                }}
              >
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      lineHeight: 1.4,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {treasuryNarrative.treasuryHeadline}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    <span style={narrativeToneBadge(treasuryNarrative.treasuryTone)}>
                      {narrativeToneLabel(treasuryNarrative.treasuryTone)}
                    </span>
                    <span style={narrativeOutlookBadge(treasuryNarrative.treasuryOutlook)}>
                      {narrativeOutlookLabel(treasuryNarrative.treasuryOutlook)}
                    </span>
                  </div>
                </div>
                <div style={{ flex: "0 0 auto", textAlign: "right" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Confidence
                  </p>
                  <p
                    style={{
                      margin: "0.15rem 0 0",
                      fontSize: "1.15rem",
                      fontWeight: 800,
                      color: scoreColor(treasuryNarrative.confidence),
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {treasuryNarrative.confidence}/100
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Treasury tone
                  </p>
                  <span style={narrativeToneBadge(treasuryNarrative.treasuryTone)}>
                    {narrativeToneLabel(treasuryNarrative.treasuryTone)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Treasury outlook
                  </p>
                  <span style={narrativeOutlookBadge(treasuryNarrative.treasuryOutlook)}>
                    {narrativeOutlookLabel(treasuryNarrative.treasuryOutlook)}
                  </span>
                </div>
              </div>

              {treasuryNarrative.keyTakeaways.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Key takeaways
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryNarrative.keyTakeaways.map((item, idx) => (
                      <li key={`narrative-takeaway-${idx}`} style={treasuryListItemStyle}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {treasuryNarrative.operationalNarrative.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Operational narrative
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryNarrative.operationalNarrative.map((item, idx) => (
                      <li key={`narrative-operational-${idx}`} style={treasuryListItemStyle}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  marginBottom: "0.85rem",
                }}
              >
                <p
                  style={{
                    margin: "0 0 0.4rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Daily treasury story
                </p>
                <p style={treasurySummaryTextStyle}>
                  {treasuryNarrative.dailyTreasuryStory}
                </p>
              </div>

              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <p
                  style={{
                    margin: "0 0 0.4rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Summary
                </p>
                <p style={treasurySummaryTextStyle}>
                  {treasuryNarrative.summary}
                </p>
              </div>
            </div>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury board timeline</h3>
          <p style={treasurySectionIntroStyle}>
            The story of treasury across snapshots — how it has evolved from an executive perspective and what leadership
            would remember. Read-only and advisory only. No automation or financial mutations.
          </p>
          {!boardTimeline ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading treasury board timeline…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Treasury journey
                  </p>
                  <span style={treasuryJourneyBadge(boardTimeline.treasuryJourney)}>
                    {treasuryJourneyLabel(boardTimeline.treasuryJourney)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Momentum
                  </p>
                  <span style={boardMomentumBadge(boardTimeline.treasuryMomentum)}>
                    {boardMomentumLabel(boardTimeline.treasuryMomentum)}
                  </span>
                </div>
                <KpiCard
                  label="Timeline confidence"
                  value={`${boardTimeline.confidence}/100`}
                  subtitle={`${boardTimeline.boardTimeline.length} snapshot${boardTimeline.boardTimeline.length === 1 ? "" : "s"} observed`}
                  valueColor={scoreColor(boardTimeline.confidence)}
                />
              </div>

              {boardTimeline.boardTimeline.length > 1 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Treasury score trend
                  </p>
                  <BoardTimelineSparkline series={boardTimeline.boardTimeline} />
                </div>
              ) : null}

              {boardTimeline.executiveMilestones.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Executive milestones
                  </p>
                  <ul style={treasuryListStyle}>
                    {boardTimeline.executiveMilestones.map((item, idx) => (
                      <li key={`board-milestone-${idx}`} style={treasuryListItemStyle}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {boardTimeline.notablePeriods.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Notable periods
                  </p>
                  <ul style={treasuryListStyle}>
                    {boardTimeline.notablePeriods.map((item, idx) => (
                      <li key={`board-notable-${idx}`} style={treasuryListItemStyle}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {boardTimeline.boardTimeline.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Timeline
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 240px), 1fr))",
                      gap: "0.65rem",
                    }}
                  >
                    {boardTimeline.boardTimeline.map((period, idx) => (
                      <div
                        key={`board-period-${idx}`}
                        style={{
                          padding: "0.85rem 0.9rem",
                          borderRadius: "12px",
                          background: "#f8fafc",
                          border: "1px solid #f1f5f9",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.45rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                          }}
                        >
                          <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b" }}>
                            {formatWhen(period.date)}
                          </span>
                          <span style={{ fontSize: "0.95rem", fontWeight: 800, color: scoreColor(period.treasuryScore) }}>
                            {period.treasuryScore}/100
                          </span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          <span style={unifiedConditionBadge(period.treasuryCondition)}>
                            {unifiedConditionLabel(period.treasuryCondition)}
                          </span>
                          <span style={operatingPostureBadge(period.operatingPosture)}>
                            {operatingPostureLabel(period.operatingPosture)}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.8rem", color: "#475569", lineHeight: 1.45 }}>
                          {period.narrative}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "10px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                }}
              >
                <p
                  style={{
                    margin: "0 0 0.4rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Summary
                </p>
                <p style={treasurySummaryTextStyle}>
                  {boardTimeline.summary}
                </p>
              </div>
            </div>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury readiness</h3>
          <p style={treasurySectionIntroStyle}>
            High-level operational readiness and posture — read-only and advisory only. No automation or financial
            mutations.
          </p>
          {!treasuryReadiness ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading treasury readiness…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <KpiCard
                  label="Readiness score"
                  value={String(treasuryReadiness.readinessScore)}
                  subtitle="0–100 composite"
                  valueColor={scoreColor(treasuryReadiness.readinessScore)}
                />
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Readiness level
                  </p>
                  <span style={readinessLevelBadge(treasuryReadiness.readinessLevel)}>
                    {readinessLevelLabel(treasuryReadiness.readinessLevel)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Operating posture
                  </p>
                  <span style={operatingPostureBadge(treasuryReadiness.operatingPosture)}>
                    {operatingPostureLabel(treasuryReadiness.operatingPosture)}
                  </span>
                </div>
                <KpiCard
                  label="Treasury condition"
                  value={treasuryConditionLabel(treasuryReadiness.treasuryCondition)}
                  subtitle="Current advisory state"
                  valueColor={treasuryConditionColor(treasuryReadiness.treasuryCondition)}
                />
                <KpiCard
                  label="Confidence"
                  value={`${treasuryReadiness.confidence}%`}
                  subtitle="Signal availability"
                  valueColor={
                    treasuryReadiness.confidence >= 80
                      ? "#047857"
                      : treasuryReadiness.confidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
              </div>

              <p style={{ ...treasurySummaryTextStyle, margin: "0 0 1rem" }}>
                {treasuryReadiness.summary}
              </p>

              {treasuryReadiness.readinessDrivers.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Readiness drivers
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
                    {treasuryReadiness.readinessDrivers.map((driver, idx) => {
                      const pal = readinessDriverTypeStyle(driver.type);
                      return (
                        <li
                          key={`driver-${idx}`}
                          style={{
                            padding: "0.65rem 0.75rem",
                            borderRadius: "8px",
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.45rem", marginBottom: "0.3rem" }}>
                            <span style={treasuryBadgeStyle(pal)}>
                              {driver.type}
                            </span>
                            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0f172a" }}>{driver.title}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                            {driver.explanation}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))",
                  gap: "1rem",
                }}
              >
                {treasuryReadiness.watchAreas.length > 0 ? (
                  <div>
                    <p
                      style={{
                        margin: "0 0 0.45rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                      }}
                    >
                      Watch areas
                    </p>
                    <ul style={treasuryListStyle}>
                      {treasuryReadiness.watchAreas.map((area, idx) => (
                        <li key={idx} style={treasuryListItemStyle}>
                          {area}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {treasuryReadiness.recommendations.length > 0 ? (
                  <div>
                    <p
                      style={{
                        margin: "0 0 0.45rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                      }}
                    >
                      Recommendations
                    </p>
                    <ul style={treasuryListStyle}>
                      {treasuryReadiness.recommendations.map((rec, idx) => (
                        <li key={idx} style={treasuryListItemStyle}>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Key indicators</h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 200px), 1fr))",
              gap: "0.85rem",
            }}
          >
            {kpiCards
              ? kpiCards.map((c) => (
                  <KpiCard key={c.key} label={c.label} value={c.value} subtitle={c.subtitle} valueColor={c.valueColor} />
                ))
              : Array.from({ length: 6 }).map((_, i) => <SkeletonKpi key={i} />)}
          </div>
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury alerts</h3>
          {!health ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading alerts…" />
          ) : alerts.length === 0 ? (
            <div style={{ ...cardBase, padding: "1.25rem", textAlign: "center" }}>
              <p style={{ margin: 0, color: "#047857", fontWeight: 600, fontSize: "0.9rem" }}>
                No active treasury alerts
              </p>
              <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.82rem" }}>
                Health signals are within normal thresholds.
              </p>
            </div>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.65rem" }}>
              {alerts.map((a) => (
                <li key={a.code} style={{ ...cardBase, padding: "0.85rem 1rem" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                    <span style={severityBadge(a.severity)}>{a.severity}</span>
                    <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>{a.title}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>{a.message}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Snapshot history</h3>
          <p style={{ margin: "0 0 0.65rem", fontSize: "0.78rem", color: "#64748b" }}>
            Newest first — read-only observability records.
          </p>
          {!health && history.length === 0 ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading history…" />
          ) : history.length === 0 ? (
            <div style={{ ...cardBase, padding: "1.25rem", textAlign: "center" }}>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>No snapshots yet.</p>
            </div>
          ) : (
            <div style={{ ...cardBase, overflowX: "auto", WebkitOverflowScrolling: "touch", maxWidth: "100%" }}>
              <table style={{ width: "100%", minWidth: "640px", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[
                      { key: "created", label: "Created", align: "left" },
                      { key: "score", label: "Score", align: "right" },
                      { key: "risk", label: "Risk", align: "left" },
                      { key: "liab", label: "Liabilities", align: "right" },
                      { key: "exp", label: "Exposure", align: "right" },
                      { key: "reasons", label: "Reasons", align: "right" },
                    ].map((h) => (
                      <th
                        key={h.key}
                        style={{
                          textAlign: h.align,
                          padding: "0.55rem 0.65rem",
                          fontSize: "0.66rem",
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "#94a3b8",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => {
                    const reasonCount = (row.reasons || []).length;
                    return (
                      <tr key={row.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.55rem 0.65rem", color: "#475569", whiteSpace: "nowrap" }}>
                          <span style={{ display: "block", fontWeight: 600, color: "#0f172a" }}>
                            {formatWhen(row.createdAt)}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "0.55rem 0.65rem",
                            textAlign: "right",
                            fontWeight: 700,
                            color: scoreColor(row.healthScore),
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {row.healthScore}
                        </td>
                        <td style={{ padding: "0.55rem 0.65rem" }}>
                          <span style={riskLevelBadge(row.treasuryRiskLevel)}>{row.treasuryRiskLevel}</span>
                        </td>
                        <td
                          style={{
                            padding: "0.55rem 0.65rem",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: "#0f172a",
                          }}
                        >
                          {formatMoney(row.totalWalletLiabilities)}
                        </td>
                        <td
                          style={{
                            padding: "0.55rem 0.65rem",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: "#0f172a",
                          }}
                        >
                          {formatMoney(row.pendingWithdrawalExposure)}
                        </td>
                        <td
                          style={{
                            padding: "0.55rem 0.65rem",
                            textAlign: "right",
                            fontVariantNumeric: "tabular-nums",
                            color: reasonCount > 0 ? "#92400e" : "#64748b",
                            fontWeight: reasonCount > 0 ? 700 : 400,
                          }}
                          title={reasonCount > 0 ? `${reasonCount} penalty reason(s)` : "No penalty reasons"}
                        >
                          {reasonCount}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        </>
        )}
        </TreasuryIntelligenceGroup>

        <TreasuryIntelligenceGroup
          id="treasury-risk-governance"
          title="Treasury Risk & Governance"
          description="Alert classification, governance oversight, integrity signals, and operational guidance."
          sectionCount={4}
          statusLabel={riskGroupStatus.label}
          statusVariant={riskGroupStatus.variant}
          onActivate={handleGroupActivate}
        >
        {() => (
        <>
        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury alert classification</h3>
          <p style={treasurySectionIntroStyle}>
            Read-only advisory classification of treasury alerts by category, priority, and suggested review cadence.
            No wallet, payout, withdrawal, or database mutations.
          </p>
          {!alertClassification ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading alert classification…" />
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "0.85rem",
                }}
              >
                <KpiCard
                  label="Alert priority"
                  value={monitoringPriorityLabel(alertClassification.alertPriority)}
                  subtitle="Overall classified priority"
                  valueColor={monitoringPriorityColor(alertClassification.alertPriority)}
                />
                <KpiCard
                  label="Classified alerts"
                  value={String(alertClassification.classifiedAlerts?.length || 0)}
                  subtitle="Category-tagged items"
                  valueColor="#0f172a"
                />
                <KpiCard
                  label="Confidence"
                  value={
                    alertClassification.confidence >= 80
                      ? `High (${alertClassification.confidence}%)`
                      : alertClassification.confidence >= 50
                        ? `Moderate (${alertClassification.confidence}%)`
                        : `${alertClassification.confidence}%`
                  }
                  subtitle="Signal agreement & data depth"
                  valueColor={
                    alertClassification.confidence >= 80
                      ? "#047857"
                      : alertClassification.confidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
              </div>

              <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "0.85rem" }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.45rem",
                  }}
                >
                  <span style={alertPriorityBadge(alertClassification.alertPriority)}>
                    {monitoringPriorityLabel(alertClassification.alertPriority)} priority
                  </span>
                </div>
                <p
                  style={{
                    margin: "0 0 0.35rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Summary
                </p>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#0f172a", lineHeight: 1.5, fontWeight: 500 }}>
                  {alertClassification.alertSummary}
                </p>
              </div>

              {alertClassification.classifiedAlerts?.length > 0 ? (
                <div style={{ ...cardBase, overflowX: "auto", WebkitOverflowScrolling: "touch", marginBottom: "0.85rem", maxWidth: "100%" }}>
                  <table style={{ width: "100%", minWidth: "720px", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {[
                          { key: "priority", label: "Priority", align: "left" },
                          { key: "category", label: "Category", align: "left" },
                          { key: "title", label: "Alert", align: "left" },
                          { key: "review", label: "Suggested review", align: "left" },
                          { key: "reason", label: "Reason", align: "left" },
                        ].map((h) => (
                          <th
                            key={h.key}
                            style={{
                              textAlign: h.align,
                              padding: "0.55rem 0.65rem",
                              fontSize: "0.66rem",
                              fontWeight: 700,
                              letterSpacing: "0.05em",
                              textTransform: "uppercase",
                              color: "#94a3b8",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {alertClassification.classifiedAlerts.map((item, idx) => (
                        <tr key={`${item.title}-${idx}`} style={{ borderTop: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "0.55rem 0.65rem", whiteSpace: "nowrap" }}>
                            <span style={alertPriorityBadge(item.priority)}>{monitoringPriorityLabel(item.priority)}</span>
                          </td>
                          <td style={{ padding: "0.55rem 0.65rem", color: "#475569", whiteSpace: "nowrap" }}>
                            {alertCategoryLabel(item.category)}
                          </td>
                          <td style={{ padding: "0.55rem 0.65rem", color: "#0f172a", minWidth: "160px" }}>
                            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem" }}>
                              {item.severity ? <span style={severityBadge(item.severity)}>{item.severity}</span> : null}
                              <span style={{ fontWeight: 600 }}>{item.title}</span>
                            </div>
                            {item.message ? (
                              <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.4 }}>
                                {item.message}
                              </p>
                            ) : null}
                          </td>
                          <td
                            style={{
                              padding: "0.55rem 0.65rem",
                              color: suggestedReviewColor(item.suggestedReview),
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {suggestedReviewLabel(item.suggestedReview)}
                          </td>
                          <td style={{ padding: "0.55rem 0.65rem", color: "#475569", lineHeight: 1.4, minWidth: "180px" }}>
                            {item.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {alertClassification.routingSuggestions?.length > 0 ? (
                <div style={{ ...cardBase, padding: "1rem 1.1rem", background: "#f8fafc" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Routing suggestions
                  </p>
                  <ul style={{ margin: 0, padding: "0 0 0 1.1rem", color: "#475569", fontSize: "0.82rem", lineHeight: 1.5 }}>
                    {alertClassification.routingSuggestions.map((suggestion, idx) => (
                      <li key={`route-${idx}`} style={{ marginBottom: "0.35rem" }}>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury governance &amp; oversight</h3>
          <p style={treasurySectionIntroStyle}>
            Treasury governance and oversight answer what level of treasury oversight operations should maintain —
            read-only and advisory only. No automation or financial mutations.
          </p>
          {!treasuryGovernance ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading treasury governance assessment…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <KpiCard
                  label="Governance score"
                  value={String(treasuryGovernance.governanceScore)}
                  subtitle="0–100 composite"
                  valueColor={scoreColor(treasuryGovernance.governanceScore)}
                />
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Governance level
                  </p>
                  <span style={governanceLevelBadge(treasuryGovernance.governanceLevel)}>
                    {governanceLevelLabel(treasuryGovernance.governanceLevel)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Oversight posture
                  </p>
                  <span style={oversightPostureBadge(treasuryGovernance.oversightPosture)}>
                    {oversightPostureLabel(treasuryGovernance.oversightPosture)}
                  </span>
                </div>
                <KpiCard
                  label="Treasury oversight"
                  value={treasuryOversightLabel(treasuryGovernance.treasuryOversight)}
                  subtitle="Advisory oversight band"
                  valueColor={treasuryOversightColor(treasuryGovernance.treasuryOversight)}
                />
                <KpiCard
                  label="Monitoring cadence"
                  value={monitoringCadenceLabel(treasuryGovernance.monitoringCadence)}
                  subtitle="Suggested review rhythm"
                  valueColor={monitoringCadenceColor(treasuryGovernance.monitoringCadence)}
                />
                <KpiCard
                  label="Confidence"
                  value={`${treasuryGovernance.confidence}%`}
                  subtitle="Signal availability"
                  valueColor={
                    treasuryGovernance.confidence >= 80
                      ? "#047857"
                      : treasuryGovernance.confidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
              </div>

              {treasuryGovernance.governanceDrivers.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Governance drivers
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
                    {treasuryGovernance.governanceDrivers.map((driver, idx) => {
                      const pal = stabilityDriverTypeStyle(driver.type);
                      return (
                        <li
                          key={`governance-driver-${idx}`}
                          style={{
                            padding: "0.65rem 0.75rem",
                            borderRadius: "8px",
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.45rem",
                              marginBottom: "0.3rem",
                            }}
                          >
                            <span style={treasuryBadgeStyle(pal)}>
                              {driver.type}
                            </span>
                            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0f172a" }}>
                              {driver.title}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                            {driver.explanation}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {treasuryGovernance.watchAreas.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Watch areas
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryGovernance.watchAreas.map((area, idx) => (
                      <li key={`governance-watch-${idx}`} style={treasuryListItemStyle}>
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {treasuryGovernance.governanceRecommendations.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Governance recommendations
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryGovernance.governanceRecommendations.map((rec, idx) => (
                      <li key={`governance-rec-${idx}`} style={treasuryListItemStyle}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p style={treasurySummaryTextStyle}>
                {treasuryGovernance.summary}
              </p>
            </div>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury integrity &amp; trust</h3>
          <p style={treasurySectionIntroStyle}>
            Treasury integrity and trust synthesize stability, readiness, drift, historical analytics, and monitoring
            signals — read-only and advisory only. No automation or financial mutations.
          </p>
          {!treasuryIntegrity ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading treasury integrity assessment…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <KpiCard
                  label="Treasury integrity score"
                  value={String(treasuryIntegrity.treasuryIntegrityScore)}
                  subtitle="0–100 composite"
                  valueColor={scoreColor(treasuryIntegrity.treasuryIntegrityScore)}
                />
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Treasury integrity level
                  </p>
                  <span style={treasuryIntegrityLevelBadge(treasuryIntegrity.treasuryIntegrityLevel)}>
                    {treasuryIntegrityLevelLabel(treasuryIntegrity.treasuryIntegrityLevel)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Signal trust level
                  </p>
                  <span style={signalTrustLevelBadge(treasuryIntegrity.signalTrustLevel)}>
                    {signalTrustLevelLabel(treasuryIntegrity.signalTrustLevel)}
                  </span>
                </div>
                <KpiCard
                  label="Treasury reliability"
                  value={treasuryReliabilityLabel(treasuryIntegrity.treasuryReliability)}
                  subtitle="Advisory reliability"
                  valueColor={treasuryReliabilityColor(treasuryIntegrity.treasuryReliability)}
                />
                <KpiCard
                  label="Consistency assessment"
                  value={integrityConsistencyLabel(treasuryIntegrity.consistencyAssessment)}
                  subtitle="Signal consistency"
                  valueColor={integrityConsistencyColor(treasuryIntegrity.consistencyAssessment)}
                />
                <KpiCard
                  label="Confidence"
                  value={`${treasuryIntegrity.confidence}%`}
                  subtitle="Signal availability"
                  valueColor={
                    treasuryIntegrity.confidence >= 80
                      ? "#047857"
                      : treasuryIntegrity.confidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
              </div>

              {treasuryIntegrity.integrityDrivers.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Integrity drivers
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
                    {treasuryIntegrity.integrityDrivers.map((driver, idx) => {
                      const pal = stabilityDriverTypeStyle(driver.type);
                      return (
                        <li
                          key={`integrity-driver-${idx}`}
                          style={{
                            padding: "0.65rem 0.75rem",
                            borderRadius: "8px",
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.45rem",
                              marginBottom: "0.3rem",
                            }}
                          >
                            <span style={treasuryBadgeStyle(pal)}>
                              {driver.type}
                            </span>
                            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0f172a" }}>
                              {driver.title}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                            {driver.explanation}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {treasuryIntegrity.concernAreas.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Concern areas
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryIntegrity.concernAreas.map((area, idx) => (
                      <li key={`integrity-concern-${idx}`} style={treasuryListItemStyle}>
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {treasuryIntegrity.recommendations.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Recommendations
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryIntegrity.recommendations.map((rec, idx) => (
                      <li key={`integrity-rec-${idx}`} style={treasuryListItemStyle}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p style={treasurySummaryTextStyle}>
                {treasuryIntegrity.summary}
              </p>
            </div>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury operational guidance</h3>
          <p style={treasurySectionIntroStyle}>
            Read-only operational prioritization from health, trends, forecast, resilience, and simulator signals.
            Advisory only — no wallet, payout, withdrawal, or database mutations.
          </p>
          {!operationalGuidance ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading operational guidance…" />
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "0.85rem",
                }}
              >
                <KpiCard
                  label="Operational status"
                  value={operationalStatusLabel(operationalGuidance.operationalStatus)}
                  subtitle="Current treasury posture"
                  valueColor={operationalStatusColor(operationalGuidance.operationalStatus)}
                />
                <KpiCard
                  label="Monitoring priority"
                  value={monitoringPriorityLabel(operationalGuidance.monitoringPriority)}
                  subtitle="Suggested review cadence"
                  valueColor={monitoringPriorityColor(operationalGuidance.monitoringPriority)}
                />
                <KpiCard
                  label="Confidence"
                  value={
                    operationalGuidance.confidence >= 80
                      ? `High (${operationalGuidance.confidence}%)`
                      : operationalGuidance.confidence >= 50
                        ? `Moderate (${operationalGuidance.confidence}%)`
                        : `${operationalGuidance.confidence}%`
                  }
                  subtitle="Signal agreement & data depth"
                  valueColor={
                    operationalGuidance.confidence >= 80
                      ? "#047857"
                      : operationalGuidance.confidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
              </div>

              <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "0.85rem" }}>
                <p
                  style={{
                    margin: "0 0 0.35rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Summary
                </p>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#0f172a", lineHeight: 1.5, fontWeight: 500 }}>
                  {operationalGuidance.summary}
                </p>
              </div>

              {operationalGuidance.priorities.length > 0 ? (
                <div style={{ marginBottom: "0.85rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Monitoring priorities
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
                    {operationalGuidance.priorities.map((item, idx) => (
                      <li key={`${item.title}-${idx}`} style={{ ...cardBase, padding: "0.75rem 1rem" }}>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            alignItems: "center",
                            gap: "0.45rem",
                            marginBottom: "0.3rem",
                          }}
                        >
                          <span style={severityBadge(item.severity)}>{item.severity}</span>
                          <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.88rem" }}>{item.title}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                          {item.explanation}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {operationalGuidance.recommendedChecks.length > 0 ? (
                <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "0.85rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Recommended checks
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "1.15rem", display: "grid", gap: "0.4rem" }}>
                    {operationalGuidance.recommendedChecks.map((check, idx) => (
                      <li key={idx} style={treasuryListItemStyle}>
                        {check}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {operationalGuidance.watchItems.length > 0 ? (
                <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "0.85rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Watch items
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "1.15rem", display: "grid", gap: "0.4rem" }}>
                    {operationalGuidance.watchItems.map((item, idx) => (
                      <li key={idx} style={treasuryListItemStyle}>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {operationalGuidance.observations.length > 0 ? (
                <div style={{ ...cardBase, padding: "1rem 1.1rem", background: "#f8fafc" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Observations
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "1.15rem", display: "grid", gap: "0.4rem" }}>
                    {operationalGuidance.observations.map((obs, idx) => (
                      <li key={idx} style={treasuryListItemStyle}>
                        {obs}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </section>
        </>
        )}
        </TreasuryIntelligenceGroup>

        <TreasuryIntelligenceGroup
          id="treasury-forecasting-scenarios"
          title="Treasury Forecasting & Scenarios"
          description="Trends, forecasts, scenarios, simulator, scaling posture, and resilience."
          sectionCount={7}
          statusLabel={forecastGroupStatus.label}
          statusVariant={forecastGroupStatus.variant}
          onActivate={handleGroupActivate}
        >
        {() => (
        <>
        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury trends</h3>
          <p style={treasurySectionIntroStyle}>
            Early warning signals from snapshot history over the last 7 days. Monitor closely — not an automatic action.
          </p>
          {!trends ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading trends…" />
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "0.85rem",
                }}
              >
                <KpiCard
                  label="Trend status"
                  value={trendStatusLabel(trends.trendStatus)}
                  subtitle={`${trends.historyCount} snapshot${trends.historyCount === 1 ? "" : "s"} in window`}
                  valueColor={trendStatusColor(trends.trendStatus)}
                />
                <KpiCard
                  label="Health score change"
                  value={formatDelta(trends.healthScoreChange, { suffix: " pts", invertColor: true }).text}
                  subtitle="Newest vs oldest in window"
                  valueColor={formatDelta(trends.healthScoreChange, { invertColor: true }).color}
                />
                <KpiCard
                  label="Liability change"
                  value={formatDelta(trends.liabilityChange, { prefix: "$", invertColor: true }).text}
                  subtitle="Wallet liabilities delta"
                  valueColor={formatDelta(trends.liabilityChange, { invertColor: true }).color}
                />
                <KpiCard
                  label="Exposure change"
                  value={formatDelta(trends.exposureChange, { prefix: "$", invertColor: true }).text}
                  subtitle="Pending withdrawal delta"
                  valueColor={formatDelta(trends.exposureChange, { invertColor: true }).color}
                />
                <KpiCard
                  label="Confidence"
                  value={`${trends.confidence}%`}
                  subtitle="Trend data quality"
                  valueColor={trends.confidence >= 70 ? "#047857" : trends.confidence >= 40 ? "#92400e" : "#64748b"}
                />
                <KpiCard
                  label="History count"
                  value={String(trends.historyCount)}
                  subtitle={
                    trends.riskLevelChange !== "unchanged"
                      ? `Risk: ${String(trends.riskLevelChange).replace(/_/g, " → ")}`
                      : "Risk level unchanged"
                  }
                />
              </div>

              {trends.warningSignals.length === 0 ? (
                <div style={{ ...cardBase, padding: "1rem 1.1rem" }}>
                  <p style={{ margin: 0, color: "#047857", fontWeight: 600, fontSize: "0.88rem" }}>
                    No early warning signals in the trend window
                  </p>
                  <p style={{ margin: "0.35rem 0 0", color: "#64748b", fontSize: "0.82rem" }}>
                    Snapshot trends appear stable. Continue routine monitoring.
                  </p>
                </div>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.65rem" }}>
                  {trends.warningSignals.map((signal, idx) => (
                    <li key={`${signal.code}-${idx}`} style={{ ...cardBase, padding: "0.85rem 1rem" }}>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.35rem",
                        }}
                      >
                        <span style={severityBadge(signal.severity)}>{signal.severity}</span>
                        <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.9rem" }}>
                          {formatTreasuryWarningTitle(signal)}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {signal.message}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury forecast</h3>
          <p style={treasurySectionIntroStyle}>
            Conservative 7-day operational outlook from snapshot trends — not a financial prediction. Advisory only;
            no automated treasury actions.
          </p>
          {!forecast ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading forecast…" />
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "0.85rem",
                }}
              >
                <KpiCard
                  label="7-day outlook"
                  value={forecastOutlookLabel(forecast.outlook)}
                  subtitle={`Liabilities ${projectedDirectionLabel(forecast.projectedLiabilities).toLowerCase()} · Exposure ${projectedDirectionLabel(forecast.projectedExposure).toLowerCase()}`}
                  valueColor={forecastOutlookColor(forecast.outlook)}
                />
                <KpiCard
                  label="Projected treasury risk"
                  value={projectedRiskLabel(forecast.projectedRisk)}
                  subtitle="Operational pressure band"
                  valueColor={projectedRiskColor(forecast.projectedRisk)}
                />
                <KpiCard
                  label="Treasury pressure"
                  value={treasuryPressureLabel(forecast.treasuryPressure)}
                  subtitle="Withdrawal & obligation stress"
                  valueColor={treasuryPressureColor(forecast.treasuryPressure)}
                />
                <KpiCard
                  label="Forecast confidence"
                  value={
                    forecast.confidence >= 80
                      ? `High (${forecast.confidence}%)`
                      : forecast.confidence >= 50
                        ? `Moderate (${forecast.confidence}%)`
                        : `${forecast.confidence}%`
                  }
                  subtitle="Based on snapshot depth & trend agreement"
                  valueColor={
                    forecast.confidence >= 80
                      ? "#047857"
                      : forecast.confidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
              </div>

              <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: forecast.warnings?.length ? "0.75rem" : 0 }}>
                <p style={{ margin: "0 0 0.35rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8" }}>
                  Forecast summary
                </p>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#0f172a", lineHeight: 1.5, fontWeight: 500 }}>
                  {forecast.summary}
                </p>
              </div>

              {forecast.warnings?.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
                  {forecast.warnings.map((w, idx) => (
                    <li key={`${w.code}-${idx}`} style={{ ...cardBase, padding: "0.75rem 1rem", background: "#f8fafc" }}>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {w.message}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury scenarios</h3>
          <p style={treasurySectionIntroStyle}>
            What-if analysis from current baseline, trends, and forecast — advisory only. No wallet, payout, or
            funding mutations.
          </p>
          {!scenarios ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading scenarios…" />
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "0.85rem",
                }}
              >
                <KpiCard
                  label="Scenario confidence"
                  value={
                    scenarios.scenarioConfidence >= 80
                      ? `High (${scenarios.scenarioConfidence}%)`
                      : scenarios.scenarioConfidence >= 50
                        ? `Moderate (${scenarios.scenarioConfidence}%)`
                        : `${scenarios.scenarioConfidence}%`
                  }
                  subtitle="Data depth & trend agreement"
                  valueColor={
                    scenarios.scenarioConfidence >= 80
                      ? "#047857"
                      : scenarios.scenarioConfidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
                <KpiCard
                  label="Baseline health"
                  value={String(scenarios.baseline?.healthScore ?? "—")}
                  subtitle={`Risk: ${String(scenarios.baseline?.treasuryRiskLevel || "—").toUpperCase()}`}
                  valueColor={scoreColor(scenarios.baseline?.healthScore)}
                />
                <KpiCard
                  label="Baseline liabilities"
                  value={formatMoney(scenarios.baseline?.walletLiabilities)}
                  subtitle={`Exposure ${formatMoney(scenarios.baseline?.pendingWithdrawalExposure)}`}
                />
                <KpiCard
                  label="Liquidity / reconciliation"
                  value={`${scenarios.baseline?.liquidityScore ?? "—"} / ${scenarios.baseline?.reconciliationScore ?? "—"}`}
                  subtitle="Component scores at baseline"
                  valueColor={scoreColor(Math.min(scenarios.baseline?.liquidityScore ?? 100, scenarios.baseline?.reconciliationScore ?? 100))}
                />
              </div>

              <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "0.85rem" }}>
                <p style={{ margin: "0 0 0.35rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8" }}>
                  Scenario summary
                </p>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#0f172a", lineHeight: 1.5, fontWeight: 500 }}>
                  {scenarios.summary}
                </p>
              </div>

              <div style={{ ...cardBase, overflowX: "auto", WebkitOverflowScrolling: "touch", maxWidth: "100%" }}>
                <table style={{ width: "100%", minWidth: "720px", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc" }}>
                      {[
                        { key: "label", label: "Scenario", align: "left" },
                        { key: "score", label: "Proj. health", align: "right" },
                        { key: "risk", label: "Proj. risk", align: "left" },
                        { key: "pressure", label: "Pressure", align: "left" },
                        { key: "severity", label: "Severity", align: "left" },
                        { key: "summary", label: "Summary", align: "left" },
                      ].map((h) => (
                        <th
                          key={h.key}
                          style={{
                            textAlign: h.align,
                            padding: "0.55rem 0.65rem",
                            fontSize: "0.66rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: "#94a3b8",
                            whiteSpace: h.key === "summary" ? "normal" : "nowrap",
                          }}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(scenarios.scenarios || []).map((s) => (
                      <tr key={s.key} style={{ borderTop: "1px solid #f1f5f9", verticalAlign: "top" }}>
                        <td style={{ padding: "0.65rem", minWidth: "140px" }}>
                          <span style={{ display: "block", fontWeight: 700, color: "#0f172a" }}>{s.label}</span>
                          {s.assumptions?.length > 0 ? (
                            <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1rem", color: "#64748b", fontSize: "0.72rem", lineHeight: 1.4 }}>
                              {s.assumptions.map((a, i) => (
                                <li key={i}>{a}</li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                        <td
                          style={{
                            padding: "0.65rem",
                            textAlign: "right",
                            fontWeight: 700,
                            color: scoreColor(s.projectedHealthScore),
                            fontVariantNumeric: "tabular-nums",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {s.projectedHealthScore}
                        </td>
                        <td style={{ padding: "0.65rem", whiteSpace: "nowrap" }}>
                          <span style={riskLevelBadge(s.projectedRiskLevel)}>{s.projectedRiskLevel}</span>
                        </td>
                        <td style={{ padding: "0.65rem", whiteSpace: "nowrap" }}>
                          <span style={{ fontWeight: 600, color: treasuryPressureColor(s.projectedPressure) }}>
                            {treasuryPressureLabel(s.projectedPressure)}
                          </span>
                        </td>
                        <td style={{ padding: "0.65rem", whiteSpace: "nowrap" }}>
                          <span style={severityBadge(s.severity)}>{scenarioSeverityLabel(s.severity)}</span>
                        </td>
                        <td style={{ padding: "0.65rem", color: "#475569", lineHeight: 1.45, minWidth: "200px" }}>
                          <p style={{ margin: 0 }}>{s.summary}</p>
                          {s.warnings?.length > 0 ? (
                            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1rem", fontSize: "0.72rem", color: "#64748b" }}>
                              {s.warnings.map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury decision simulator</h3>
          <p style={treasurySectionIntroStyle}>
            Read-only what-if analysis from current treasury baseline — adjust inputs and run a simulation. No wallet,
            payout, withdrawal, or database mutations.
          </p>
          {!health ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading simulator baseline…" />
          ) : (
            <>
              <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "0.85rem" }}>
                {[
                  {
                    key: "liability",
                    label: "Liability multiplier",
                    value: simLiabilityMult,
                    options: SIM_LIABILITY_MULT,
                    format: (v) => `${v}x`,
                    onChange: setSimLiabilityMult,
                  },
                  {
                    key: "exposure",
                    label: "Payout exposure multiplier",
                    value: simExposureMult,
                    options: SIM_EXPOSURE_MULT,
                    format: (v) => `${v}x`,
                    onChange: setSimExposureMult,
                  },
                  {
                    key: "funding",
                    label: "Funding slowdown",
                    value: simFundingSlowdown,
                    options: SIM_FUNDING_SLOWDOWN,
                    format: (v) => `${v}%`,
                    onChange: setSimFundingSlowdown,
                  },
                  {
                    key: "recon",
                    label: "Reconciliation issues",
                    value: simReconIssues,
                    options: SIM_RECON_ISSUES,
                    format: (v) => String(v),
                    onChange: setSimReconIssues,
                  },
                  {
                    key: "withdrawal",
                    label: "Withdrawal spike",
                    value: simWithdrawalSpike,
                    options: SIM_WITHDRAWAL_SPIKE,
                    format: (v) => `${v}%`,
                    onChange: setSimWithdrawalSpike,
                  },
                ].map((control) => (
                  <div key={control.key} style={{ marginBottom: "0.75rem" }}>
                    <p
                      style={{
                        margin: "0 0 0.35rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                      }}
                    >
                      {control.label}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                      {control.options.map((opt) => (
                        <button
                          key={`${control.key}-${opt}`}
                          type="button"
                          onClick={() => control.onChange(opt)}
                          style={control.value === opt ? btnOptionActive : btnOption}
                        >
                          {control.format(opt)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={runSimulation}
                  style={{
                    ...btnSm,
                    marginTop: "0.35rem",
                    padding: "0.45rem 0.85rem",
                    fontSize: "0.75rem",
                  }}
                >
                  Run Simulation
                </button>
              </div>

              {simulationResult ? (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                      gap: "0.75rem",
                      marginBottom: "0.85rem",
                    }}
                  >
                    <KpiCard
                      label="Simulated health score"
                      value={String(simulationResult.simulatedHealthScore)}
                      subtitle={`Baseline ${health.healthScore}`}
                      valueColor={scoreColor(simulationResult.simulatedHealthScore)}
                    />
                    <KpiCard
                      label="Simulated risk level"
                      value={String(simulationResult.simulatedRiskLevel || "—").toUpperCase()}
                      subtitle="Derived from simulated score"
                      valueColor={scoreColor(simulationResult.simulatedHealthScore)}
                    />
                    <KpiCard
                      label="Simulated pressure"
                      value={treasuryPressureLabel(simulationResult.simulatedPressure)}
                      subtitle="Withdrawal & obligation stress"
                      valueColor={treasuryPressureColor(simulationResult.simulatedPressure)}
                    />
                    <KpiCard
                      label="Simulated resilience"
                      value={resilienceLevelLabel(simulationResult.simulatedResilience)}
                      subtitle="Under modeled conditions"
                      valueColor={resilienceLevelColor(simulationResult.simulatedResilience)}
                    />
                    <KpiCard
                      label="Confidence"
                      value={
                        simulationResult.confidence >= 80
                          ? `High (${simulationResult.confidence}%)`
                          : simulationResult.confidence >= 50
                            ? `Moderate (${simulationResult.confidence}%)`
                            : `${simulationResult.confidence}%`
                      }
                      subtitle="Simulation data quality"
                      valueColor={
                        simulationResult.confidence >= 80
                          ? "#047857"
                          : simulationResult.confidence >= 50
                            ? "#92400e"
                            : "#64748b"
                      }
                    />
                  </div>

                  <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "0.85rem" }}>
                    <p
                      style={{
                        margin: "0 0 0.35rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                      }}
                    >
                      Summary
                    </p>
                    <p style={{ margin: 0, fontSize: "0.88rem", color: "#0f172a", lineHeight: 1.5, fontWeight: 500 }}>
                      {simulationResult.summary}
                    </p>
                  </div>

                  {simulationResult.warnings?.length > 0 ? (
                    <ul style={{ margin: "0 0 0.85rem", padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
                      {simulationResult.warnings.map((w, idx) => (
                        <li key={`${w.code}-${idx}`} style={{ ...cardBase, padding: "0.75rem 1rem", background: "#f8fafc" }}>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.45rem",
                              marginBottom: "0.3rem",
                            }}
                          >
                            {w.severity ? <span style={severityBadge(w.severity)}>{w.severity}</span> : null}
                            <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.88rem" }}>
                              {formatTreasuryWarningTitle(w)}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                            {w.message}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {simulationResult.decisionTrace?.length > 0 ? (
                    <div style={{ ...cardBase, padding: "1rem 1.1rem" }}>
                      <p
                        style={{
                          margin: "0 0 0.55rem",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#94a3b8",
                        }}
                      >
                        Decision trace
                      </p>
                      <ol style={{ margin: 0, paddingLeft: "1.25rem", display: "grid", gap: "0.35rem" }}>
                        {simulationResult.decisionTrace.map((step, idx) => (
                          <li key={idx} style={treasuryListItemStyle}>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </>
              ) : (
                <div style={{ ...cardBase, padding: "1rem 1.1rem", background: "#f8fafc" }}>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.45 }}>
                    Adjust simulation inputs above and click Run Simulation to preview advisory what-if outcomes.
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury scaling readiness</h3>
          <p style={treasurySectionIntroStyle}>
            Soft-launch capacity and scaling readiness synthesize health, readiness, stability, drift, and monitoring
            signals — read-only and advisory only. No automation or financial mutations.
          </p>
          {!treasuryScalingReadiness ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading treasury scaling readiness assessment…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <KpiCard
                  label="Scaling readiness score"
                  value={String(treasuryScalingReadiness.scalingReadinessScore)}
                  subtitle="0–100 composite"
                  valueColor={scoreColor(treasuryScalingReadiness.scalingReadinessScore)}
                />
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Scaling readiness level
                  </p>
                  <span style={scalingReadinessLevelBadge(treasuryScalingReadiness.scalingReadinessLevel)}>
                    {scalingReadinessLevelLabel(treasuryScalingReadiness.scalingReadinessLevel)}
                  </span>
                </div>
                <KpiCard
                  label="Launch capacity"
                  value={launchCapacityLabel(treasuryScalingReadiness.launchCapacity)}
                  subtitle="Soft-launch advisory scope"
                  valueColor={launchCapacityColor(treasuryScalingReadiness.launchCapacity)}
                />
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Operating tolerance
                  </p>
                  <span style={operatingToleranceBadge(treasuryScalingReadiness.operatingTolerance)}>
                    {operatingToleranceLabel(treasuryScalingReadiness.operatingTolerance)}
                  </span>
                </div>
                <KpiCard
                  label="Scaling confidence"
                  value={`${treasuryScalingReadiness.scalingConfidence}%`}
                  subtitle="Signal availability"
                  valueColor={
                    treasuryScalingReadiness.scalingConfidence >= 80
                      ? "#047857"
                      : treasuryScalingReadiness.scalingConfidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
              </div>

              {treasuryScalingReadiness.readinessDrivers.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Readiness drivers
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
                    {treasuryScalingReadiness.readinessDrivers.map((driver, idx) => {
                      const pal = stabilityDriverTypeStyle(driver.type);
                      return (
                        <li
                          key={`scaling-driver-${idx}`}
                          style={{
                            padding: "0.65rem 0.75rem",
                            borderRadius: "8px",
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.45rem",
                              marginBottom: "0.3rem",
                            }}
                          >
                            <span style={treasuryBadgeStyle(pal)}>
                              {driver.type}
                            </span>
                            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0f172a" }}>
                              {driver.title}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                            {driver.explanation}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {treasuryScalingReadiness.watchAreas.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Watch areas
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryScalingReadiness.watchAreas.map((area, idx) => (
                      <li key={`scaling-watch-${idx}`} style={treasuryListItemStyle}>
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {treasuryScalingReadiness.recommendations.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Recommendations
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryScalingReadiness.recommendations.map((rec, idx) => (
                      <li key={`scaling-rec-${idx}`} style={treasuryListItemStyle}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p style={treasurySummaryTextStyle}>
                {treasuryScalingReadiness.summary}
              </p>
            </div>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury operating mode</h3>
          <p style={treasurySectionIntroStyle}>
            Treasury operating mode answers what operating mode treasury should be in — read-only and
            advisory only. No automation or financial mutations.
          </p>
          {!treasuryOperatingMode ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading treasury operating mode assessment…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Operating mode
                  </p>
                  <span style={treasuryOperatingModeBadge(treasuryOperatingMode.treasuryOperatingMode)}>
                    {treasuryOperatingModeLabel(treasuryOperatingMode.treasuryOperatingMode)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Launch readiness level
                  </p>
                  <span style={launchReadinessLevelBadge(treasuryOperatingMode.launchReadinessLevel)}>
                    {launchReadinessLevelLabel(treasuryOperatingMode.launchReadinessLevel)}
                  </span>
                </div>
                <div style={treasuryInnerKpiTileStyle}>
                  <p style={treasuryKpiLabelStyle}>
                    Treasury posture
                  </p>
                  <span style={treasuryPostureBadge(treasuryOperatingMode.treasuryPosture)}>
                    {treasuryPostureLabel(treasuryOperatingMode.treasuryPosture)}
                  </span>
                </div>
                <KpiCard
                  label="Operating confidence"
                  value={operatingConfidenceLabel(treasuryOperatingMode.operatingConfidence)}
                  subtitle="Advisory confidence band"
                  valueColor={operatingConfidenceColor(treasuryOperatingMode.operatingConfidence)}
                />
                <KpiCard
                  label="Monitoring level"
                  value={recommendedMonitoringLevelLabel(treasuryOperatingMode.recommendedMonitoringLevel)}
                  subtitle="Suggested review rhythm"
                  valueColor={recommendedMonitoringLevelColor(treasuryOperatingMode.recommendedMonitoringLevel)}
                />
                <KpiCard
                  label="Confidence"
                  value={`${treasuryOperatingMode.confidence}%`}
                  subtitle="Signal availability"
                  valueColor={
                    treasuryOperatingMode.confidence >= 80
                      ? "#047857"
                      : treasuryOperatingMode.confidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
              </div>

              {treasuryOperatingMode.postureDrivers.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Posture drivers
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
                    {treasuryOperatingMode.postureDrivers.map((driver, idx) => {
                      const pal = stabilityDriverTypeStyle(driver.type);
                      return (
                        <li
                          key={`operating-driver-${idx}`}
                          style={{
                            padding: "0.65rem 0.75rem",
                            borderRadius: "8px",
                            background: "#ffffff",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.45rem",
                              marginBottom: "0.3rem",
                            }}
                          >
                            <span style={treasuryBadgeStyle(pal)}>
                              {driver.type}
                            </span>
                            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0f172a" }}>
                              {driver.title}
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
                            {driver.explanation}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {treasuryOperatingMode.watchAreas.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Watch areas
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryOperatingMode.watchAreas.map((area, idx) => (
                      <li key={`operating-watch-${idx}`} style={treasuryListItemStyle}>
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {treasuryOperatingMode.recommendations.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Recommendations
                  </p>
                  <ul style={treasuryListStyle}>
                    {treasuryOperatingMode.recommendations.map((rec, idx) => (
                      <li key={`operating-rec-${idx}`} style={treasuryListItemStyle}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p style={treasurySummaryTextStyle}>
                {treasuryOperatingMode.summary}
              </p>
            </div>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury resilience</h3>
          <p style={treasurySectionIntroStyle}>
            Stress and resilience assessment from health, trends, forecast, and scenarios — advisory only. No wallet,
            payout, or funding mutations.
          </p>
          {!resilience ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading resilience…" />
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "0.85rem",
                }}
              >
                <KpiCard
                  label="Resilience score"
                  value={String(resilience.resilienceScore)}
                  subtitle="0–100 composite under sustained pressure"
                  valueColor={scoreColor(resilience.resilienceScore)}
                />
                <KpiCard
                  label="Resilience level"
                  value={resilienceLevelLabel(resilience.resilienceLevel)}
                  subtitle="Weak · moderate · strong · resilient"
                  valueColor={resilienceLevelColor(resilience.resilienceLevel)}
                />
                <KpiCard
                  label="Survivability"
                  value={String(resilience.survivabilityScore)}
                  subtitle={`Recovery: ${recoveryDifficultyLabel(resilience.recoveryDifficulty).toLowerCase()}`}
                  valueColor={scoreColor(resilience.survivabilityScore)}
                />
                <KpiCard
                  label="Treasury tolerance"
                  value={treasuryToleranceLabel(resilience.treasuryTolerance)}
                  subtitle="Capacity for sustained pressure"
                  valueColor={treasuryToleranceColor(resilience.treasuryTolerance)}
                />
                <KpiCard
                  label="Resilience confidence"
                  value={
                    resilience.confidence >= 80
                      ? `High (${resilience.confidence}%)`
                      : resilience.confidence >= 50
                        ? `Moderate (${resilience.confidence}%)`
                        : `${resilience.confidence}%`
                  }
                  subtitle="Data depth & signal agreement"
                  valueColor={
                    resilience.confidence >= 80
                      ? "#047857"
                      : resilience.confidence >= 50
                        ? "#92400e"
                        : "#64748b"
                  }
                />
                <KpiCard
                  label="Runway estimate"
                  value={runwayEstimateLabel(resilience.runwayEstimate)}
                  subtitle={`Liquidity buffer ${resilience.liquidityBufferScore}`}
                  valueColor={runwayEstimateColor(resilience.runwayEstimate)}
                />
              </div>

              <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: resilience.warnings?.length ? "0.75rem" : 0 }}>
                <p style={{ margin: "0 0 0.35rem", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8" }}>
                  Resilience summary
                </p>
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#0f172a", lineHeight: 1.5, fontWeight: 500 }}>
                  {resilience.summary}
                </p>
              </div>

              {resilience.warnings?.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
                  {resilience.warnings.map((w, idx) => (
                    <li key={`${w.code}-${idx}`} style={{ ...cardBase, padding: "0.75rem 1rem", background: "#f8fafc" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.45rem", marginBottom: w.severity ? "0.3rem" : 0 }}>
                        {w.severity ? <span style={severityBadge(w.severity)}>{w.severity}</span> : null}
                      </div>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {w.message}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </section>
        </>
        )}
        </TreasuryIntelligenceGroup>

        <TreasuryIntelligenceGroup
          id="reports-explainability"
          title="Reports & Explainability"
          description="Explainability, report preparation, executive summaries, and score rationale."
          sectionCount={4}
          statusLabel={reportsGroupStatus.label}
          statusVariant={reportsGroupStatus.variant}
          onActivate={handleGroupActivate}
        >
        {() => (
        <>
        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury explainability</h3>
          <p style={treasurySectionIntroStyle}>
            Human-readable reasoning for treasury health, risk, and confidence — strictly read-only and advisory. No
            wallet, payout, or funding mutations.
          </p>
          {!explainability ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading explainability…" />
          ) : (
            <>
              <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "0.85rem" }}>
                <p
                  style={{
                    margin: "0 0 0.35rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Treasury summary
                </p>
                <p style={{ margin: "0 0 0.65rem", fontSize: "0.88rem", color: "#0f172a", lineHeight: 1.5, fontWeight: 500 }}>
                  {explainability.summary}
                </p>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.82rem",
                    color: "#475569",
                    lineHeight: 1.45,
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: "0.65rem",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>Risk: </span>
                  {explainability.riskExplanation}
                </p>
              </div>

              {explainability.topDrivers.length > 0 ? (
                <div style={{ marginBottom: "0.85rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Top drivers
                  </p>
                  <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
                    {explainability.topDrivers.map((driver, idx) => {
                      const badge = driverTypeBadge(driver.type);
                      return (
                        <li key={`${driver.title}-${idx}`} style={{ ...cardBase, padding: "0.75rem 1rem" }}>
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              alignItems: "center",
                              gap: "0.45rem",
                              marginBottom: "0.3rem",
                            }}
                          >
                            <span style={badge}>{badge.label}</span>
                            <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.88rem" }}>{driver.title}</span>
                          </div>
                          <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                            {driver.impact}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {explainability.recommendations.length > 0 ? (
                <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "0.85rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Recommendations
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "1.15rem", display: "grid", gap: "0.4rem" }}>
                    {explainability.recommendations.map((rec, idx) => (
                      <li key={idx} style={treasuryListItemStyle}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {explainability.decisionTrace.length > 0 ? (
                <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "0.85rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Decision trace
                  </p>
                  <ol style={{ margin: 0, paddingLeft: "1.25rem", display: "grid", gap: "0.35rem" }}>
                    {explainability.decisionTrace.map((step, idx) => (
                      <li key={idx} style={treasuryListItemStyle}>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              <div style={{ ...cardBase, padding: "1rem 1.1rem", background: "#f8fafc" }}>
                <p
                  style={{
                    margin: "0 0 0.35rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    color: "#94a3b8",
                  }}
                >
                  Confidence explanation
                </p>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                  {explainability.confidenceExplanation}
                </p>
              </div>
            </>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Treasury report prep</h3>
          <p style={treasurySectionIntroStyle}>
            Generate a read-only advisory report from current treasury intelligence outputs for leadership review or
            documentation. No file export, PDF generation, or automated actions.
          </p>
          {!health || !executiveSummary || !operationalGuidance ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading report inputs…" />
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.85rem",
                }}
              >
                <button
                  type="button"
                  onClick={generateReportPreview}
                  style={{
                    ...btnSm,
                    marginTop: 0,
                    padding: "0.45rem 0.85rem",
                    fontSize: "0.75rem",
                  }}
                >
                  Generate report preview
                </button>
                {reportPreview ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void copyReportJson()}
                      style={{ ...btnSm, marginTop: 0, padding: "0.45rem 0.85rem", fontSize: "0.75rem" }}
                    >
                      Copy report JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyReportText()}
                      style={{ ...btnSm, marginTop: 0, padding: "0.45rem 0.85rem", fontSize: "0.75rem" }}
                    >
                      Copy text summary
                    </button>
                  </>
                ) : null}
              </div>

              {reportCopyNote ? (
                <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#047857" }}>{reportCopyNote}</p>
              ) : null}

              {reportPreview ? (
                <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "0.65rem",
                      marginBottom: "0.85rem",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          margin: "0 0 0.35rem",
                          fontSize: "1rem",
                          fontWeight: 700,
                          color: "#0f172a",
                          lineHeight: 1.4,
                        }}
                      >
                        {reportPreview.reportTitle}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b" }}>
                        Generated {formatWhen(reportPreview.generatedAt)}
                      </p>
                    </div>
                    {reportPreview.executiveSummary ? (
                      <span style={executiveStatusBadge(reportPreview.executiveSummary.executiveStatus)}>
                        {executiveStatusLabel(reportPreview.executiveSummary.executiveStatus)}
                      </span>
                    ) : null}
                  </div>

                  <div
                    style={{
                      ...cardBase,
                      padding: "0.75rem 0.85rem",
                      marginBottom: "0.85rem",
                      background: "#fffbeb",
                      borderColor: "#fcd34d",
                    }}
                  >
                    <p style={{ margin: 0, fontSize: "0.78rem", color: "#92400e", lineHeight: 1.5 }}>
                      {reportPreview.safetyNotice}
                    </p>
                  </div>

                  {reportPreview.executiveSummary ? (
                    <div style={{ marginBottom: "0.85rem" }}>
                      <p
                        style={{
                          margin: "0 0 0.35rem",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#94a3b8",
                        }}
                      >
                        Executive summary
                      </p>
                      <p style={{ margin: "0 0 0.35rem", fontSize: "0.9rem", fontWeight: 600, color: "#0f172a" }}>
                        {reportPreview.executiveSummary.headline}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {reportPreview.executiveSummary.summary}
                      </p>
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                      gap: "0.55rem",
                      marginBottom: "0.85rem",
                    }}
                  >
                    {reportPreview.healthOverview ? (
                      <div
                        style={{
                          padding: "0.55rem 0.65rem",
                          borderRadius: "10px",
                          background: "#f8fafc",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.64rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: "#94a3b8",
                          }}
                        >
                          Health score
                        </p>
                        <p
                          style={{
                            margin: "0.2rem 0 0",
                            fontSize: "0.88rem",
                            fontWeight: 700,
                            color: scoreColor(reportPreview.healthOverview.healthScore),
                          }}
                        >
                          {reportPreview.healthOverview.healthScore}
                        </p>
                      </div>
                    ) : null}
                    {reportPreview.trendSummary ? (
                      <div
                        style={{
                          padding: "0.55rem 0.65rem",
                          borderRadius: "10px",
                          background: "#f8fafc",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.64rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: "#94a3b8",
                          }}
                        >
                          Trend status
                        </p>
                        <p
                          style={{
                            margin: "0.2rem 0 0",
                            fontSize: "0.88rem",
                            fontWeight: 700,
                            color: trendStatusColor(reportPreview.trendSummary.trendStatus),
                          }}
                        >
                          {trendStatusLabel(reportPreview.trendSummary.trendStatus)}
                        </p>
                      </div>
                    ) : null}
                    {reportPreview.forecastSummary ? (
                      <div
                        style={{
                          padding: "0.55rem 0.65rem",
                          borderRadius: "10px",
                          background: "#f8fafc",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.64rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: "#94a3b8",
                          }}
                        >
                          Forecast outlook
                        </p>
                        <p
                          style={{
                            margin: "0.2rem 0 0",
                            fontSize: "0.88rem",
                            fontWeight: 700,
                            color: forecastOutlookColor(reportPreview.forecastSummary.outlook),
                          }}
                        >
                          {forecastOutlookLabel(reportPreview.forecastSummary.outlook)}
                        </p>
                      </div>
                    ) : null}
                    {reportPreview.resilienceSummary ? (
                      <div
                        style={{
                          padding: "0.55rem 0.65rem",
                          borderRadius: "10px",
                          background: "#f8fafc",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.64rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: "#94a3b8",
                          }}
                        >
                          Resilience
                        </p>
                        <p
                          style={{
                            margin: "0.2rem 0 0",
                            fontSize: "0.88rem",
                            fontWeight: 700,
                            color: resilienceLevelColor(reportPreview.resilienceSummary.resilienceLevel),
                          }}
                        >
                          {resilienceLevelLabel(reportPreview.resilienceSummary.resilienceLevel)}
                        </p>
                      </div>
                    ) : null}
                    {reportPreview.operationalGuidance ? (
                      <div
                        style={{
                          padding: "0.55rem 0.65rem",
                          borderRadius: "10px",
                          background: "#f8fafc",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.64rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: "#94a3b8",
                          }}
                        >
                          Operational status
                        </p>
                        <p
                          style={{
                            margin: "0.2rem 0 0",
                            fontSize: "0.88rem",
                            fontWeight: 700,
                            color: operationalStatusColor(reportPreview.operationalGuidance.operationalStatus),
                          }}
                        >
                          {operationalStatusLabel(reportPreview.operationalGuidance.operationalStatus)}
                        </p>
                      </div>
                    ) : null}
                    <div
                      style={{
                        padding: "0.55rem 0.65rem",
                        borderRadius: "10px",
                        background: "#f8fafc",
                        border: "1px solid #f1f5f9",
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: "0.64rem",
                          fontWeight: 700,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "#94a3b8",
                        }}
                      >
                        Active alerts
                      </p>
                      <p
                        style={{
                          margin: "0.2rem 0 0",
                          fontSize: "0.88rem",
                          fontWeight: 700,
                          color: reportPreview.alerts?.length ? "#92400e" : "#047857",
                        }}
                      >
                        {reportPreview.alerts?.length || 0}
                      </p>
                    </div>
                    {reportPreview.snapshotSummary ? (
                      <div
                        style={{
                          padding: "0.55rem 0.65rem",
                          borderRadius: "10px",
                          background: "#f8fafc",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.64rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: "#94a3b8",
                          }}
                        >
                          Snapshots
                        </p>
                        <p style={{ margin: "0.2rem 0 0", fontSize: "0.88rem", fontWeight: 700, color: "#0f172a" }}>
                          {reportPreview.snapshotSummary.count}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {reportPreview.operationalGuidance?.summary ? (
                    <div style={{ marginBottom: "0.85rem" }}>
                      <p
                        style={{
                          margin: "0 0 0.35rem",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#94a3b8",
                        }}
                      >
                        Operational guidance
                      </p>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {reportPreview.operationalGuidance.summary}
                      </p>
                    </div>
                  ) : null}

                  {reportPreview.operationalGuidance?.simulator ? (
                    <div style={{ marginBottom: "0.85rem" }}>
                      <p
                        style={{
                          margin: "0 0 0.35rem",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#94a3b8",
                        }}
                      >
                        Simulator (what-if)
                      </p>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {reportPreview.operationalGuidance.simulator.summary}
                      </p>
                    </div>
                  ) : null}

                  {reportPreview.scenarioSummary?.summary ? (
                    <div style={{ marginBottom: "0.85rem" }}>
                      <p
                        style={{
                          margin: "0 0 0.35rem",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#94a3b8",
                        }}
                      >
                        Scenario summary
                      </p>
                      <p style={{ margin: 0, fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {reportPreview.scenarioSummary.summary}
                      </p>
                    </div>
                  ) : null}

                  <div style={{ ...cardBase, padding: "0.85rem 1rem", background: "#f8fafc" }}>
                    <p
                      style={{
                        margin: "0 0 0.45rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                      }}
                    >
                      Text preview
                    </p>
                    <pre
                      style={{
                        margin: 0,
                        fontSize: "0.72rem",
                        color: "#475569",
                        lineHeight: 1.45,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        maxHeight: "16rem",
                        overflowY: "auto",
                      }}
                    >
                      {formatTreasuryReportAsText(reportPreview)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div style={{ ...cardBase, padding: "1rem 1.1rem", background: "#f8fafc" }}>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.45 }}>
                    Click Generate report preview to assemble a leadership-friendly advisory report from the current
                    treasury intelligence outputs. Use copy buttons to export JSON or plain text — no files are written.
                  </p>
                </div>
              )}
            </>
          )}
        </section>

        <section style={treasurySectionStyle}>
          <h3 style={sectionHeading}>Executive summary</h3>
          <p style={treasurySectionIntroStyle}>
            Leadership-friendly synthesis of treasury health, trends, forecast, and operational guidance — read-only and
            advisory only.
          </p>
          {!executiveSummary ? (
            <TreasurySectionShell loading={loading} loadingLabel="Loading executive summary…" />
          ) : (
            <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "0.65rem",
                  marginBottom: "0.85rem",
                }}
              >
                <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                  <p
                    style={{
                      margin: "0 0 0.45rem",
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      color: "#0f172a",
                      lineHeight: 1.4,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {executiveSummary.headline}
                  </p>
                  <span style={executiveStatusBadge(executiveSummary.executiveStatus)}>
                    {executiveStatusLabel(executiveSummary.executiveStatus)}
                  </span>
                </div>
                <div style={{ flex: "0 0 auto", textAlign: "right" }}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Confidence
                  </p>
                  <p
                    style={{
                      margin: "0.15rem 0 0",
                      fontSize: "1.15rem",
                      fontWeight: 800,
                      color:
                        executiveSummary.confidence >= 80
                          ? "#047857"
                          : executiveSummary.confidence >= 50
                            ? "#92400e"
                            : "#64748b",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {executiveSummary.confidence}%
                  </p>
                </div>
              </div>

              <p style={{ ...treasurySummaryTextStyle, margin: "0 0 1rem" }}>
                {executiveSummary.summary}
              </p>

              {executiveSummary.keyMetrics.length > 0 ? (
                <div style={{ marginBottom: "1rem" }}>
                  <p
                    style={{
                      margin: "0 0 0.55rem",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#94a3b8",
                    }}
                  >
                    Key metrics
                  </p>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 130px), 1fr))",
                      gap: "0.55rem",
                    }}
                  >
                    {executiveSummary.keyMetrics.map((m) => (
                      <div
                        key={m.label}
                        style={{
                          padding: "0.55rem 0.65rem",
                          borderRadius: "10px",
                          background: "#f8fafc",
                          border: "1px solid #f1f5f9",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.64rem",
                            fontWeight: 700,
                            letterSpacing: "0.05em",
                            textTransform: "uppercase",
                            color: "#94a3b8",
                          }}
                        >
                          {m.label}
                        </p>
                        <p
                          style={{
                            margin: "0.2rem 0 0",
                            fontSize: "0.88rem",
                            fontWeight: 700,
                            color: "#0f172a",
                            fontVariantNumeric: "tabular-nums",
                            textTransform: "capitalize",
                          }}
                        >
                          {m.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
                  gap: "0.85rem",
                }}
              >
                {executiveSummary.keyRisks.length > 0 ? (
                  <div>
                    <p
                      style={{
                        margin: "0 0 0.45rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                      }}
                    >
                      Key risks
                    </p>
                    <ul style={treasuryListStyle}>
                      {executiveSummary.keyRisks.map((risk, idx) => (
                        <li key={idx} style={treasuryListItemStyle}>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {executiveSummary.keyStrengths.length > 0 ? (
                  <div>
                    <p
                      style={{
                        margin: "0 0 0.45rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                      }}
                    >
                      Key strengths
                    </p>
                    <ul style={treasuryListStyle}>
                      {executiveSummary.keyStrengths.map((strength, idx) => (
                        <li key={idx} style={treasuryListItemStyle}>
                          {strength}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {executiveSummary.nextFocus.length > 0 ? (
                  <div>
                    <p
                      style={{
                        margin: "0 0 0.45rem",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "#94a3b8",
                      }}
                    >
                      Next focus
                    </p>
                    <ul style={treasuryListStyle}>
                      {executiveSummary.nextFocus.map((item, idx) => (
                        <li key={idx} style={treasuryListItemStyle}>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1rem" }}>
          <h3 style={sectionHeading}>Score explanation</h3>
          <div style={{ ...cardBase, padding: "1rem 1.1rem" }}>
            {!health ? (
              <p style={{ margin: 0, color: "#64748b", lineHeight: 1.5, fontSize: "0.85rem" }}>
                {treasurySectionStatusMessage(loading)}
              </p>
            ) : (
              <>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5 }}>
              Health starts at 100 and subtracts for payout pressure, reconciliation issues, funding failures, negative
              balances, and volume anomalies. Risk level: 80–100 low, 60–79 medium, 40–59 high, 0–39 critical.
            </p>
            {topReasons.length === 0 ? (
              <p style={{ margin: 0, color: "#047857", fontWeight: 600, fontSize: "0.88rem" }}>
                No penalty reasons — treasury signals look healthy.
              </p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.55rem" }}>
                {topReasons.map((r) => (
                  <li
                    key={r.code}
                    style={{
                      border: "1px solid #f1f5f9",
                      borderRadius: "10px",
                      padding: "0.65rem 0.75rem",
                      background: "#f8fafc",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "0.35rem" }}>
                      <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.88rem" }}>{r.label}</span>
                      <span style={{ fontWeight: 700, color: "#b91c1c", fontVariantNumeric: "tabular-nums" }}>
                        {r.impact}
                      </span>
                    </div>
                    {r.details && Object.keys(r.details).length > 0 ? (
                      <p style={{ margin: "0.3rem 0 0", fontSize: "0.75rem", color: "#64748b", wordBreak: "break-word" }}>
                        {JSON.stringify(r.details)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p style={{ margin: "0.85rem 0 0", fontSize: "0.82rem" }}>
              <Link href="/admin/treasury" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                Open Treasury &amp; Reconciliation →
              </Link>
            </p>
              </>
            )}
          </div>
        </section>
        </>
        )}
        </TreasuryIntelligenceGroup>
      </div>

      {selectedTreasuryEvent ? (
        <>
          <button
            type="button"
            aria-label="Close event detail"
            onClick={closeTreasuryEventDrawer}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 60,
              border: "none",
              background: "rgba(15, 23, 42, 0.45)",
              cursor: "pointer",
            }}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="treasury-event-drawer-title"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              zIndex: 70,
              width: "min(100%, 480px)",
              height: "100%",
              background: "#ffffff",
              boxShadow: "-8px 0 32px rgba(15, 23, 42, 0.12)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "1rem 1.15rem",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: "0.75rem",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                  Treasury event detail
                </p>
                <h2 id="treasury-event-drawer-title" style={{ margin: "0.35rem 0 0", fontSize: "1.05rem", color: "#0f172a", lineHeight: 1.35 }}>
                  {selectedTreasuryEvent.title}
                </h2>
              </div>
              <button
                type="button"
                className={treasuryFocusRingClass}
                onClick={closeTreasuryEventDrawer}
                style={{
                  flexShrink: 0,
                  padding: "0.35rem 0.65rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.15rem 1.25rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginBottom: "1rem" }}>
                <span style={treasuryEventSeverityBadge(selectedTreasuryEvent.severity)}>
                  {treasuryEventSeverityLabel(selectedTreasuryEvent.severity)}
                </span>
                <span style={treasuryBadgeStyle({ bg: "#f1f5f9", fg: "#475569", border: "#e2e8f0" })}>
                  {selectedTreasuryEvent.category}
                </span>
                <span style={treasuryBadgeStyle({ bg: "#eff6ff", fg: "#0369a1", border: "#bfdbfe" })}>
                  {selectedTreasuryEvent.source.replace(/_/g, " ")}
                </span>
              </div>

              <p style={{ ...treasurySummaryLabelStyle, margin: "0 0 0.35rem" }}>Created</p>
              <p style={{ ...treasurySummaryTextStyle, marginTop: 0 }}>{formatWhen(selectedTreasuryEvent.created_at)}</p>

              {selectedTreasuryEvent.description ? (
                <>
                  <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Description</p>
                  <p style={{ ...treasurySummaryTextStyle, marginTop: 0 }}>{selectedTreasuryEvent.description}</p>
                </>
              ) : null}

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Event ID</p>
              <p style={{ ...treasurySummaryTextStyle, marginTop: 0, fontFamily: "monospace", fontSize: "0.78rem", wordBreak: "break-all" }}>
                {selectedTreasuryEvent.id}
              </p>

              {selectedEventWithdrawalReviewHref ? (
                <>
                  <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Withdrawal review</p>
                  <Link
                    href={selectedEventWithdrawalReviewHref}
                    style={{ ...treasurySummaryTextStyle, marginTop: 0, display: "inline-block", fontWeight: 600, color: "#0369a1" }}
                  >
                    Open admin withdrawal review queue →
                  </Link>
                </>
              ) : null}

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Metadata</p>
              {selectedEventDisplayMetadata.length === 0 ? (
                <p style={{ ...treasurySummaryTextStyle, marginTop: "0.35rem" }}>No metadata available.</p>
              ) : (
                <div
                  style={{
                    marginTop: "0.35rem",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    overflow: "hidden",
                  }}
                >
                  {selectedEventDisplayMetadata.map(([key, value]) => (
                    <div
                      key={key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 38%) minmax(0, 1fr)",
                        gap: "0.65rem",
                        padding: "0.5rem 0.65rem",
                        borderBottom: "1px solid #f1f5f9",
                        fontSize: "0.78rem",
                      }}
                    >
                      <span style={{ color: "#64748b", fontWeight: 600, wordBreak: "break-word" }}>{key}</span>
                      <span style={{ color: "#0f172a", wordBreak: "break-word" }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}

              <div
                style={{
                  marginTop: "1.25rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <p style={{ ...treasurySummaryLabelStyle, margin: 0 }}>Resolution</p>
                <p style={{ ...treasurySummaryTextStyle, marginTop: "0.35rem", fontSize: "0.78rem" }}>
                  Operational resolution tracking only — does not modify source events or trigger financial actions.
                </p>

                {eventResolutionTableMissing ? (
                  <p style={{ margin: "0.65rem 0 0", fontSize: "0.82rem", color: "#b45309" }}>
                    Resolution table not installed. Run{" "}
                    <code style={{ fontSize: "0.75rem" }}>supabase/sql/phase_5c_treasury_event_resolutions.sql</code>.
                  </p>
                ) : null}

                {eventResolutionError ? (
                  <p style={{ margin: "0.65rem 0 0", fontSize: "0.82rem", color: "#b91c1c" }}>{eventResolutionError}</p>
                ) : null}

                {eventResolutionLoading ? (
                  <p style={{ ...treasurySummaryTextStyle, marginTop: "0.65rem" }}>Loading resolution…</p>
                ) : (
                  <>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginTop: "0.65rem", marginBottom: "0.75rem" }}>
                      <span style={treasuryResolutionStatusBadge(currentEventResolution?.status || resolutionStatusDraft)}>
                        {treasuryResolutionStatusLabel(currentEventResolution?.status || resolutionStatusDraft)}
                      </span>
                      {currentEventResolution?.resolvedAt ? (
                        <span style={{ fontSize: "0.75rem", color: "#64748b", alignSelf: "center" }}>
                          Resolved {formatWhen(currentEventResolution.resolvedAt)}
                        </span>
                      ) : null}
                    </div>

                    <label style={{ display: "block", marginBottom: "0.65rem" }}>
                      <span style={{ ...treasurySummaryLabelStyle, display: "block", marginBottom: "0.35rem" }}>Status</span>
                      <select
                        className={treasuryFocusRingClass}
                        value={resolutionStatusDraft}
                        onChange={(e) => setResolutionStatusDraft(e.target.value)}
                        disabled={eventResolutionSaving || eventResolutionTableMissing}
                        style={{ width: "100%", padding: "0.45rem 0.55rem", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                      >
                        {TREASURY_EVENT_RESOLUTION_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {treasuryResolutionStatusLabel(s)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: "block", marginBottom: "0.65rem" }}>
                      <span style={{ ...treasurySummaryLabelStyle, display: "block", marginBottom: "0.35rem" }}>
                        Resolution summary
                      </span>
                      <textarea
                        className={treasuryFocusRingClass}
                        value={resolutionSummaryDraft}
                        onChange={(e) => setResolutionSummaryDraft(e.target.value)}
                        rows={3}
                        placeholder="Document review outcome, escalation rationale, or resolution notes…"
                        disabled={eventResolutionSaving || eventResolutionTableMissing}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "0.65rem 0.75rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.85rem",
                          lineHeight: 1.45,
                          resize: "vertical",
                        }}
                      />
                    </label>

                    <label style={{ display: "block", marginBottom: "0.65rem" }}>
                      <span style={{ ...treasurySummaryLabelStyle, display: "block", marginBottom: "0.35rem" }}>
                        Assigned to (UUID)
                      </span>
                      <input
                        type="text"
                        className={treasuryFocusRingClass}
                        value={resolutionAssignedToDraft}
                        onChange={(e) => setResolutionAssignedToDraft(e.target.value)}
                        placeholder="Optional operator user UUID"
                        disabled={eventResolutionSaving || eventResolutionTableMissing}
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          padding: "0.5rem 0.65rem",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "0.85rem",
                        }}
                      />
                    </label>

                    <button
                      type="button"
                      className={treasuryFocusRingClass}
                      onClick={() => void handleSaveEventResolution()}
                      disabled={eventResolutionSaving || eventResolutionTableMissing}
                      style={{
                        padding: "0.45rem 0.85rem",
                        borderRadius: "8px",
                        border: "none",
                        background: "#0369a1",
                        color: "#fff",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        cursor: eventResolutionSaving || eventResolutionTableMissing ? "not-allowed" : "pointer",
                        opacity: eventResolutionSaving || eventResolutionTableMissing ? 0.65 : 1,
                      }}
                    >
                      {eventResolutionSaving ? "Saving…" : "Save resolution"}
                    </button>
                  </>
                )}
              </div>

              <div
                style={{
                  marginTop: "1.25rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <p style={{ ...treasurySummaryLabelStyle, margin: 0 }}>Investigation notes</p>
                <p style={{ ...treasurySummaryTextStyle, marginTop: "0.35rem", fontSize: "0.78rem" }}>
                  Append-only admin notes. Does not modify source events or trigger financial actions.
                </p>

                {eventNotesTableMissing ? (
                  <p style={{ margin: "0.65rem 0 0", fontSize: "0.82rem", color: "#b45309" }}>
                    Investigation notes table not installed. Run{" "}
                    <code style={{ fontSize: "0.75rem" }}>supabase/sql/phase_5b_treasury_event_investigation_notes.sql</code>.
                  </p>
                ) : null}

                {eventNotesError ? (
                  <p style={{ margin: "0.65rem 0 0", fontSize: "0.82rem", color: "#b91c1c" }}>{eventNotesError}</p>
                ) : null}

                {eventNotesLoading ? (
                  <p style={{ ...treasurySummaryTextStyle, marginTop: "0.65rem" }}>Loading notes…</p>
                ) : eventInvestigationNotes.length === 0 ? (
                  <p style={{ ...treasurySummaryTextStyle, marginTop: "0.65rem" }}>No investigation notes yet.</p>
                ) : (
                  <ul style={{ ...treasuryListStyle, marginTop: "0.65rem" }}>
                    {eventInvestigationNotes.map((note) => (
                      <li key={note.id} style={{ ...treasuryListItemStyle, marginBottom: "0.65rem" }}>
                        <p style={{ margin: 0, fontSize: "0.85rem", color: "#0f172a", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
                          {note.note}
                        </p>
                        <p style={{ margin: "0.35rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
                          {formatWhen(note.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                <label style={{ display: "block", marginTop: "0.85rem" }}>
                  <span style={{ ...treasurySummaryLabelStyle, display: "block", marginBottom: "0.35rem" }}>Add note</span>
                  <textarea
                    className={treasuryFocusRingClass}
                    value={eventNoteDraft}
                    onChange={(e) => setEventNoteDraft(e.target.value)}
                    rows={4}
                    placeholder="Record investigation observations…"
                    disabled={eventNoteSaving || eventNotesTableMissing}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "0.65rem 0.75rem",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "0.85rem",
                      lineHeight: 1.45,
                      resize: "vertical",
                    }}
                  />
                </label>
                <button
                  type="button"
                  className={treasuryFocusRingClass}
                  onClick={() => void handleSaveEventInvestigationNote()}
                  disabled={eventNoteSaving || eventNotesTableMissing || !eventNoteDraft.trim()}
                  style={{
                    marginTop: "0.65rem",
                    padding: "0.45rem 0.85rem",
                    borderRadius: "8px",
                    border: "none",
                    background: "#0ea5e9",
                    color: "#fff",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: eventNoteSaving || eventNotesTableMissing || !eventNoteDraft.trim() ? "not-allowed" : "pointer",
                    opacity: eventNoteSaving || eventNotesTableMissing || !eventNoteDraft.trim() ? 0.65 : 1,
                  }}
                >
                  {eventNoteSaving ? "Saving…" : "Save note"}
                </button>
              </div>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
