export const TREASURY_INTELLIGENCE_FALLBACK =
  "Data is still being collected. Treasury intelligence remains advisory.";

export const TREASURY_GROUP_SECTION_COUNTS = {
  "executive-command-center": 5,
  "treasury-health-monitoring": 11,
  "treasury-risk-governance": 4,
  "treasury-forecasting-scenarios": 7,
  "reports-explainability": 4,
};

export const TREASURY_INTELLIGENCE_GROUPS = [
  {
    id: "executive-command-center",
    label: "Executive Command Center",
    title: "Executive Command Center",
    description: "What leadership should see first — unified score, briefing, and readiness at a glance.",
    sectionCount: 5,
    priorityLabel: "Start here",
    recommendedFirst: true,
    defaultOpen: true,
  },
  {
    id: "treasury-health-monitoring",
    label: "Treasury Health & Monitoring",
    title: "Treasury Health & Monitoring",
    description: "Operational snapshots, drift, stability, narrative, and alert history.",
    sectionCount: 11,
    priorityLabel: "Review after command center",
  },
  {
    id: "treasury-risk-governance",
    label: "Treasury Risk & Governance",
    title: "Treasury Risk & Governance",
    description: "Alert classification, governance oversight, integrity signals, and operational guidance.",
    sectionCount: 4,
  },
  {
    id: "treasury-forecasting-scenarios",
    label: "Treasury Forecasting & Scenarios",
    title: "Treasury Forecasting & Scenarios",
    description: "Trends, forecasts, scenarios, simulator, scaling posture, and resilience.",
    sectionCount: 7,
  },
  {
    id: "reports-explainability",
    label: "Reports & Explainability",
    title: "Reports & Explainability",
    description: "Explainability, report preparation, executive summaries, and score rationale.",
    sectionCount: 4,
  },
];

/** @deprecated Use TREASURY_INTELLIGENCE_GROUPS for nav metadata */
export const TREASURY_GROUP_NAV = TREASURY_INTELLIGENCE_GROUPS.map(({ id, label }) => ({ id, label }));
