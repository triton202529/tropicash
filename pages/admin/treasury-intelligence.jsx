import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
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

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1100px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "transparent",
  boxSizing: "border-box",
  overflowX: "hidden",
};

const cardBase = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
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

const sectionHeading = {
  margin: "0 0 0.65rem",
  fontSize: "0.8rem",
  fontWeight: 700,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "#94a3b8",
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

function riskLevelBadge(level) {
  const key = String(level || "").toLowerCase();
  const styles = {
    critical: { bg: "#450a0a", fg: "#fecaca", border: "#7f1d1d" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    medium: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
    low: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
  };
  const pal = styles[key] || styles.low;
  return {
    display: "inline-block",
    padding: "0.18rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.12rem 0.45rem",
    borderRadius: "999px",
    fontSize: "0.62rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
    whiteSpace: "nowrap",
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.18rem 0.5rem",
    borderRadius: "999px",
    fontSize: "0.64rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
    whiteSpace: "nowrap",
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
    whiteSpace: "nowrap",
  };
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
  return {
    display: "inline-block",
    padding: "0.12rem 0.45rem",
    borderRadius: "999px",
    fontSize: "0.62rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
    whiteSpace: "nowrap",
    label: pal.label,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
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
  return {
    display: "inline-block",
    padding: "0.22rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: pal.bg,
    color: pal.fg,
    border: `1px solid ${pal.border}`,
  };
}

function KpiCard({ label, value, subtitle, valueColor }) {
  return (
    <div style={{ ...cardBase, padding: "1rem 1.1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <p
        style={{
          margin: 0,
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "#94a3b8",
        }}
      >
        {label}
      </p>
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
        <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b", lineHeight: 1.4 }}>{subtitle}</p>
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
    <div style={{ ...cardBase, padding: "1rem 1.1rem" }}>
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
      <div style={pageWrap}>
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
            style={{
              ...btnSm,
              marginTop: 0,
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

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury Command Center</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            The executive one-page treasury operating view — synthesizing unified score, board timeline, daily
            narrative, executive briefing, and readiness index into a single leadership-ready command picture. Read-only
            and advisory only. No automation or financial mutations.
          </p>
          {!treasuryCommandCenter ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading treasury command center…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Command status
                  </p>
                  <span style={commandCenterStatusBadge(treasuryCommandCenter.treasuryCommandStatus)}>
                    {commandCenterStatusLabel(treasuryCommandCenter.treasuryCommandStatus)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Operating picture
                  </p>
                  <span style={commandCenterOperatingPictureBadge(treasuryCommandCenter.treasuryOperatingPicture)}>
                    {commandCenterOperatingPictureLabel(treasuryCommandCenter.treasuryOperatingPicture)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Priority level
                  </p>
                  <span style={commandCenterPriorityLevelBadge(treasuryCommandCenter.treasuryPriorityLevel)}>
                    {commandCenterPriorityLevelLabel(treasuryCommandCenter.treasuryPriorityLevel)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Attention signal
                  </p>
                  <span style={commandCenterAttentionSignalBadge(treasuryCommandCenter.treasuryAttentionSignal)}>
                    {commandCenterAttentionSignalLabel(treasuryCommandCenter.treasuryAttentionSignal)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryCommandCenter.executiveActions.map((item, idx) => (
                      <li
                        key={`command-center-action-${idx}`}
                        style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryCommandCenter.watchAreas.map((item, idx) => (
                      <li
                        key={`command-center-watch-${idx}`}
                        style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryCommandCenter.strengths.map((item, idx) => (
                      <li
                        key={`command-center-strength-${idx}`}
                        style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryCommandCenter.concerns.map((item, idx) => (
                      <li
                        key={`command-center-concern-${idx}`}
                        style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}
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
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
                  {treasuryCommandCenter.summary}
                </p>
              </div>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Unified treasury score</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            A single executive synthesis of all treasury intelligence — answering how healthy and operationally ready
            treasury is overall, and what the single treasury story is right now. Read-only and advisory only. No
            automation or financial mutations.
          </p>
          {!unifiedTreasuryScore ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading unified treasury score…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Treasury grade
                  </p>
                  <span style={treasuryGradeBadge(unifiedTreasuryScore.treasuryGrade)}>
                    {unifiedTreasuryScore.treasuryGrade}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Treasury condition
                  </p>
                  <span style={unifiedConditionBadge(unifiedTreasuryScore.treasuryCondition)}>
                    {unifiedConditionLabel(unifiedTreasuryScore.treasuryCondition)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {unifiedTreasuryScore.strengths.map((item, idx) => (
                      <li key={`unified-strength-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {unifiedTreasuryScore.concernAreas.map((item, idx) => (
                      <li key={`unified-concern-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {unifiedTreasuryScore.recommendations.map((item, idx) => (
                      <li key={`unified-rec-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
                  {unifiedTreasuryScore.boardSummary}
                </p>
              </div>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury board timeline</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            The story of treasury across snapshots — how it has evolved from an executive perspective and what leadership
            would remember. Read-only and advisory only. No automation or financial mutations.
          </p>
          {!boardTimeline ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading treasury board timeline…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 160px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Treasury journey
                  </p>
                  <span style={treasuryJourneyBadge(boardTimeline.treasuryJourney)}>
                    {treasuryJourneyLabel(boardTimeline.treasuryJourney)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {boardTimeline.executiveMilestones.map((item, idx) => (
                      <li key={`board-milestone-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {boardTimeline.notablePeriods.map((item, idx) => (
                      <li key={`board-notable-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
                  {boardTimeline.summary}
                </p>
              </div>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury daily narrative</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            A single, leadership-ready treasury story — what treasury leadership would say happened today, in a calm
            institutional voice. Read-only and advisory only. No automation or financial mutations.
          </p>
          {!treasuryNarrative ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading treasury daily narrative…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Treasury tone
                  </p>
                  <span style={narrativeToneBadge(treasuryNarrative.treasuryTone)}>
                    {narrativeToneLabel(treasuryNarrative.treasuryTone)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryNarrative.keyTakeaways.map((item, idx) => (
                      <li key={`narrative-takeaway-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryNarrative.operationalNarrative.map((item, idx) => (
                      <li key={`narrative-operational-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
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
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
                  {treasuryNarrative.summary}
                </p>
              </div>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury executive briefing</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            A sixty-second leadership digest compressing unified score, narrative, timeline, and monitoring signals into
            what treasury leadership should know now. Read-only and advisory only. No automation or financial mutations.
          </p>
          {!treasuryExecutiveBriefing ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading treasury executive briefing…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Executive status
                  </p>
                  <span style={briefingExecutiveStatusBadge(treasuryExecutiveBriefing.executiveStatus)}>
                    {briefingExecutiveStatusLabel(treasuryExecutiveBriefing.executiveStatus)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Executive priority
                  </p>
                  <span style={briefingExecutivePriorityBadge(treasuryExecutiveBriefing.executivePriority)}>
                    {briefingExecutivePriorityLabel(treasuryExecutiveBriefing.executivePriority)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryExecutiveBriefing.keyLeadershipPoints.map((item, idx) => (
                      <li
                        key={`briefing-leadership-${idx}`}
                        style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryExecutiveBriefing.actionFocus.map((item, idx) => (
                      <li key={`briefing-action-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
                  {treasuryExecutiveBriefing.briefingSummary}
                </p>
              </div>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury Readiness Index</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            A launch-facing treasury readiness signal answering whether treasury is ready for current launch
            conditions and what launch posture leadership should use today. Read-only and advisory only. No automation
            or financial mutations.
          </p>
          {!treasuryReadinessIndexResult ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading treasury readiness index…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Treasury Launch Condition
                  </p>
                  <span style={unifiedConditionBadge(treasuryReadinessIndexResult.treasuryLaunchCondition)}>
                    {unifiedConditionLabel(treasuryReadinessIndexResult.treasuryLaunchCondition)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryReadinessIndexResult.watchAreas.map((item, idx) => (
                      <li
                        key={`readiness-index-watch-${idx}`}
                        style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryReadinessIndexResult.recommendations.map((item, idx) => (
                      <li
                        key={`readiness-index-rec-${idx}`}
                        style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}
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
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
                  {treasuryReadinessIndexResult.summary}
                </p>
              </div>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Executive summary</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Leadership-friendly synthesis of treasury health, trends, forecast, and operational guidance — read-only and
            advisory only.
          </p>
          {!executiveSummary ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading executive summary…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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

              <p style={{ margin: "0 0 1rem", fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
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
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                      {executiveSummary.keyRisks.map((risk, idx) => (
                        <li key={idx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                      {executiveSummary.keyStrengths.map((strength, idx) => (
                        <li key={idx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                      {executiveSummary.nextFocus.map((item, idx) => (
                        <li key={idx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury historical analytics</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Historical trend visibility from snapshot history — read-only and advisory only. No automation or financial
            mutations.
          </p>
          {!historicalAnalytics ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading historical analytics…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55, flex: "1 1 280px" }}>
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {historicalAnalytics.notableChanges.map((note, idx) => (
                      <li key={idx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury monitoring dashboard</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Operational snapshot-to-snapshot visibility — read-only and advisory only. No automation or financial
            mutations.
          </p>
          {!monitoringDashboard ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading monitoring dashboard…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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
                <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55, flex: "1 1 280px" }}>
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {monitoringDashboard.recentMovements.map((movement, idx) => (
                      <li key={`movement-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {movement}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury readiness</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            High-level operational readiness and posture — read-only and advisory only. No automation or financial
            mutations.
          </p>
          {!treasuryReadiness ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading treasury readiness…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Readiness level
                  </p>
                  <span style={readinessLevelBadge(treasuryReadiness.readinessLevel)}>
                    {readinessLevelLabel(treasuryReadiness.readinessLevel)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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

              <p style={{ margin: "0 0 1rem", fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
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
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "999px",
                                fontSize: "0.58rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background: pal.bg,
                                color: pal.fg,
                                border: `1px solid ${pal.border}`,
                              }}
                            >
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
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                      {treasuryReadiness.watchAreas.map((area, idx) => (
                        <li key={idx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                    <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                      {treasuryReadiness.recommendations.map((rec, idx) => (
                        <li key={idx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury drift detection</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Snapshot-to-snapshot change awareness — what changed and whether treasury meaningfully drifted from prior
            operating conditions. Read-only and advisory only.
          </p>
          {!treasuryDrift ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading treasury drift assessment…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "999px",
                                fontSize: "0.58rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background: pal.bg,
                                color: pal.fg,
                                border: `1px solid ${pal.border}`,
                              }}
                            >
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryDrift.meaningfulChanges.map((change, idx) => (
                      <li key={`drift-change-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>{treasuryDrift.summary}</p>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury stability</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Stability score and operating confidence synthesize trends, readiness, drift, monitoring, and historical
            signals — read-only and advisory only. No automation or financial mutations.
          </p>
          {!treasuryStability ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading treasury stability assessment…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Stability level
                  </p>
                  <span style={stabilityLevelBadge(treasuryStability.stabilityLevel)}>
                    {stabilityLevelLabel(treasuryStability.stabilityLevel)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "999px",
                                fontSize: "0.58rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background: pal.bg,
                                color: pal.fg,
                                border: `1px solid ${pal.border}`,
                              }}
                            >
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryStability.cautionAreas.map((area, idx) => (
                      <li key={`stability-caution-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
                {treasuryStability.summary}
              </p>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury scaling readiness</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Soft-launch capacity and scaling readiness synthesize health, readiness, stability, drift, and monitoring
            signals — read-only and advisory only. No automation or financial mutations.
          </p>
          {!treasuryScalingReadiness ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading treasury scaling readiness assessment…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "999px",
                                fontSize: "0.58rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background: pal.bg,
                                color: pal.fg,
                                border: `1px solid ${pal.border}`,
                              }}
                            >
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryScalingReadiness.watchAreas.map((area, idx) => (
                      <li key={`scaling-watch-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryScalingReadiness.recommendations.map((rec, idx) => (
                      <li key={`scaling-rec-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
                {treasuryScalingReadiness.summary}
              </p>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury integrity &amp; trust</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Treasury integrity and trust synthesize stability, readiness, drift, historical analytics, and monitoring
            signals — read-only and advisory only. No automation or financial mutations.
          </p>
          {!treasuryIntegrity ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading treasury integrity assessment…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Treasury integrity level
                  </p>
                  <span style={treasuryIntegrityLevelBadge(treasuryIntegrity.treasuryIntegrityLevel)}>
                    {treasuryIntegrityLevelLabel(treasuryIntegrity.treasuryIntegrityLevel)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "999px",
                                fontSize: "0.58rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background: pal.bg,
                                color: pal.fg,
                                border: `1px solid ${pal.border}`,
                              }}
                            >
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryIntegrity.concernAreas.map((area, idx) => (
                      <li key={`integrity-concern-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryIntegrity.recommendations.map((rec, idx) => (
                      <li key={`integrity-rec-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
                {treasuryIntegrity.summary}
              </p>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury governance &amp; oversight</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Treasury governance and oversight answer what level of treasury oversight operations should maintain —
            read-only and advisory only. No automation or financial mutations.
          </p>
          {!treasuryGovernance ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading treasury governance assessment…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Governance level
                  </p>
                  <span style={governanceLevelBadge(treasuryGovernance.governanceLevel)}>
                    {governanceLevelLabel(treasuryGovernance.governanceLevel)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "999px",
                                fontSize: "0.58rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background: pal.bg,
                                color: pal.fg,
                                border: `1px solid ${pal.border}`,
                              }}
                            >
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryGovernance.watchAreas.map((area, idx) => (
                      <li key={`governance-watch-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryGovernance.governanceRecommendations.map((rec, idx) => (
                      <li key={`governance-rec-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
                {treasuryGovernance.summary}
              </p>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury operating mode</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Treasury operating mode answers what operating mode treasury should be in — read-only and
            advisory only. No automation or financial mutations.
          </p>
          {!treasuryOperatingMode ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading treasury operating mode assessment…</p>
            </div>
          ) : (
            <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 140px), 1fr))",
                  gap: "0.75rem",
                  marginBottom: "1rem",
                }}
              >
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Operating mode
                  </p>
                  <span style={treasuryOperatingModeBadge(treasuryOperatingMode.treasuryOperatingMode)}>
                    {treasuryOperatingModeLabel(treasuryOperatingMode.treasuryOperatingMode)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                    Launch readiness level
                  </p>
                  <span style={launchReadinessLevelBadge(treasuryOperatingMode.launchReadinessLevel)}>
                    {launchReadinessLevelLabel(treasuryOperatingMode.launchReadinessLevel)}
                  </span>
                </div>
                <div
                  style={{
                    padding: "0.75rem 0.85rem",
                    borderRadius: "12px",
                    background: "#f8fafc",
                    border: "1px solid #f1f5f9",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    gap: "0.35rem",
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
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "999px",
                                fontSize: "0.58rem",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                background: pal.bg,
                                color: pal.fg,
                                border: `1px solid ${pal.border}`,
                              }}
                            >
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryOperatingMode.watchAreas.map((area, idx) => (
                      <li key={`operating-watch-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                  <ul style={{ margin: 0, paddingLeft: "1.1rem", display: "grid", gap: "0.35rem" }}>
                    {treasuryOperatingMode.recommendations.map((rec, idx) => (
                      <li key={`operating-rec-${idx}`} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <p style={{ margin: 0, fontSize: "0.88rem", color: "#475569", lineHeight: 1.55 }}>
                {treasuryOperatingMode.summary}
              </p>
            </div>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Key indicators</h2>
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

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury trends</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Early warning signals from snapshot history over the last 7 days. Monitor closely — not an automatic action.
          </p>
          {!trends ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading trends…</p>
            </div>
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

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury forecast</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Conservative 7-day operational outlook from snapshot trends — not a financial prediction. Advisory only;
            no automated treasury actions.
          </p>
          {!forecast ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading forecast…</p>
            </div>
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

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury scenarios</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            What-if analysis from current baseline, trends, and forecast — advisory only. No wallet, payout, or
            funding mutations.
          </p>
          {!scenarios ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading scenarios…</p>
            </div>
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

              <div style={{ ...cardBase, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
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

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury resilience</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Stress and resilience assessment from health, trends, forecast, and scenarios — advisory only. No wallet,
            payout, or funding mutations.
          </p>
          {!resilience ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading resilience…</p>
            </div>
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

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury explainability</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Human-readable reasoning for treasury health, risk, and confidence — strictly read-only and advisory. No
            wallet, payout, or funding mutations.
          </p>
          {!explainability ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading explainability…</p>
            </div>
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
                      <li key={idx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                      <li key={idx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury decision simulator</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Read-only what-if analysis from current treasury baseline — adjust inputs and run a simulation. No wallet,
            payout, withdrawal, or database mutations.
          </p>
          {!health ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading simulator baseline…</p>
            </div>
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
                          <li key={idx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury operational guidance</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Read-only operational prioritization from health, trends, forecast, resilience, and simulator signals.
            Advisory only — no wallet, payout, withdrawal, or database mutations.
          </p>
          {!operationalGuidance ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading operational guidance…</p>
            </div>
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
                      <li key={idx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                      <li key={idx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
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
                      <li key={idx} style={{ fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>
                        {obs}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury report prep</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Generate a read-only advisory report from current treasury intelligence outputs for leadership review or
            documentation. No file export, PDF generation, or automated actions.
          </p>
          {!health || !executiveSummary || !operationalGuidance ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading report inputs…</p>
            </div>
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
                <div style={{ ...cardBase, padding: "1.15rem 1.25rem" }}>
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

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury alert classification</h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.45 }}>
            Read-only advisory classification of treasury alerts by category, priority, and suggested review cadence.
            No wallet, payout, withdrawal, or database mutations.
          </p>
          {!alertClassification ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading alert classification…</p>
            </div>
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
                <div style={{ ...cardBase, overflowX: "auto", WebkitOverflowScrolling: "touch", marginBottom: "0.85rem" }}>
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

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Treasury alerts</h2>
          {!health ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading alerts…</p>
            </div>
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

        <section style={{ marginBottom: "1.5rem" }}>
          <h2 style={sectionHeading}>Snapshot history</h2>
          <p style={{ margin: "0 0 0.65rem", fontSize: "0.78rem", color: "#64748b" }}>
            Newest first — read-only observability records.
          </p>
          {!health && history.length === 0 ? (
            <div style={{ ...cardBase, padding: "1rem" }}>
              <p style={{ margin: 0, color: "#64748b" }}>Loading history…</p>
            </div>
          ) : history.length === 0 ? (
            <div style={{ ...cardBase, padding: "1.25rem", textAlign: "center" }}>
              <p style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}>No snapshots yet.</p>
            </div>
          ) : (
            <div style={{ ...cardBase, overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
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

        <section style={{ marginBottom: "1rem" }}>
          <h2 style={sectionHeading}>Score explanation</h2>
          <div style={{ ...cardBase, padding: "1rem 1.1rem" }}>
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
          </div>
        </section>
      </div>
    </>
  );
}
