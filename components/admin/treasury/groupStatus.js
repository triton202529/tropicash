import { treasuryBadgeStyle } from "./treasuryStyles";

const GROUP_STATUS_BADGE_STYLES = {
  healthy: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
  success: { bg: "#ecfdf5", fg: "#166534", border: "#bbf7d0" },
  monitored: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
  watch: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
  variable: { bg: "#fffbeb", fg: "#92400e", border: "#fcd34d" },
  elevated: { bg: "#fef3c7", fg: "#b45309", border: "#fde68a" },
  neutral: { bg: "#f0f9ff", fg: "#0369a1", border: "#bae6fd" },
  advisory: { bg: "#f8fafc", fg: "#475569", border: "#e2e8f0" },
  reference: { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" },
};

export function groupStatusBadgeStyle(variant) {
  const key = String(variant || "neutral").toLowerCase();
  const pal = GROUP_STATUS_BADGE_STYLES[key] || GROUP_STATUS_BADGE_STYLES.neutral;
  return treasuryBadgeStyle(pal);
}

const RECOMMENDED_FIRST_BADGE_STYLE = {
  ...treasuryBadgeStyle({ bg: "#e0f2fe", fg: "#0369a1", border: "#7dd3fc" }),
};

export function recommendedFirstBadgeStyle() {
  return RECOMMENDED_FIRST_BADGE_STYLE;
}

export function deriveExecutiveGroupStatus(treasuryCommandCenter, unifiedTreasuryScore) {
  const status = String(treasuryCommandCenter?.treasuryCommandStatus || "").toLowerCase();
  if (status === "stable") return { label: "Healthy", variant: "healthy" };
  if (status === "monitored") return { label: "Monitored", variant: "monitored" };
  if (status === "elevated_attention" || status === "active_review") {
    return { label: "Elevated", variant: "elevated" };
  }
  const condition = String(unifiedTreasuryScore?.treasuryCondition || "").toLowerCase();
  if (condition === "resilient" || condition === "healthy") return { label: "Healthy", variant: "healthy" };
  if (condition === "stable") return { label: "Monitored", variant: "monitored" };
  if (condition === "watch") return { label: "Elevated", variant: "elevated" };
  return { label: "Monitored", variant: "neutral" };
}

export function deriveHealthGroupStatus(treasuryStability, treasuryDrift, trends) {
  const level = String(treasuryStability?.stabilityLevel || "").toLowerCase();
  if (level === "highly_stable" || level === "stable") return { label: "Stable", variant: "healthy" };
  if (level === "variable") return { label: "Variable", variant: "variable" };
  if (level === "unstable") return { label: "Watch", variant: "watch" };
  const drift = String(treasuryDrift?.driftStatus || "").toLowerCase();
  if (drift === "significant_drift" || drift === "drifting") return { label: "Watch", variant: "watch" };
  const momentum = String(trends?.treasuryMomentum || "").toLowerCase();
  if (momentum === "weakening" || momentum === "mixed") return { label: "Variable", variant: "variable" };
  return { label: "Stable", variant: "neutral" };
}

export function deriveRiskGroupStatus(alertClassification, alerts) {
  const priority = String(alertClassification?.alertPriority || "").toLowerCase();
  if (priority === "elevated" || priority === "high") return { label: "Elevated", variant: "elevated" };
  if ((alerts?.length || 0) > 3) return { label: "Elevated", variant: "elevated" };
  return { label: "Routine", variant: "healthy" };
}

export function deriveForecastGroupStatus() {
  return { label: "Advisory", variant: "advisory" };
}

export function deriveReportsGroupStatus() {
  return { label: "Reference", variant: "reference" };
}
