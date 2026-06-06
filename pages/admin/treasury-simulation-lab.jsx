import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import {
  TREASURY_FAILURE_SIMULATION_MODES,
  TREASURY_SIMULATION_SCENARIOS,
  TREASURY_SIMULATION_TIMELINES,
  buildTreasurySimulationValidationReport,
  compareTreasurySimulations,
  runTreasuryFailureSimulation,
  runTreasurySimulation,
  runTreasurySimulationRegressionSuite,
  runTreasurySimulationTimeline,
  runTreasuryMonteCarloSimulation,
  runTreasurySensitivitySimulation,
  runCustomTreasurySimulation,
  scoreTreasurySimulationResult,
  TREASURY_MONTE_CARLO_ITERATIONS,
  TREASURY_SCENARIO_LEVELS,
  DEFAULT_CUSTOM_SCENARIO_INPUTS,
  getTreasuryScenarioLibrary,
  loadTreasuryScenarioPreset,
  TREASURY_TRAINING_MODULES,
  runTreasuryTrainingExercise,
  TREASURY_CERTIFICATION_EXAMS,
  buildTreasuryCertificationExam,
  generateTreasuryAssessmentPack,
  getTreasuryCertificationExams,
  TREASURY_AUDIT_TYPES,
  buildTreasuryAuditPack,
  buildTreasuryReviewPack,
  getTreasuryAuditTypes,
  buildTreasuryOperationsManual,
  buildTreasuryProcedureGuide,
  getTreasuryManualSections,
  getTreasuryProcedures,
  TREASURY_WAR_ROOM_SCENARIOS,
  TREASURY_CRISIS_LEVELS,
  runTreasuryWarRoomScenario,
  buildTreasuryWarRoomReport,
  getTreasuryWarRoomScenarios,
  buildTreasuryCommandCenter,
} from "../../lib/treasurySimulationLab";
import {
  cardBase,
  sectionHeading,
  treasuryBadgeStyle,
  treasuryCardPaddingStyle,
  treasuryFocusRingClass,
  treasuryKpiGridStyle,
  treasuryKpiLabelStyle,
  treasuryListItemStyle,
  treasuryListStyle,
  treasuryPanelHighlightStyle,
  treasurySectionIntroStyle,
  treasurySectionStyle,
  treasurySummaryBlockStyle,
  treasurySummaryLabelStyle,
  treasurySummaryTextStyle,
} from "../../components/admin/treasury/treasuryStyles";

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

const btnPrimary = {
  padding: "0.45rem 0.85rem",
  fontSize: "0.8rem",
  borderRadius: "8px",
  border: "1px solid #0284c7",
  background: "linear-gradient(180deg, #f0f9ff 0%, #e0f2fe 100%)",
  cursor: "pointer",
  fontWeight: 700,
  color: "#0369a1",
};

const btnSecondary = {
  ...btnPrimary,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#475569",
};

const checkboxListStyle = {
  display: "grid",
  gap: "0.45rem",
  marginTop: "0.65rem",
  maxHeight: "16rem",
  overflowY: "auto",
  padding: "0.65rem",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  background: "#f8fafc",
};

const tableWrapStyle = {
  marginTop: "0.85rem",
  overflowX: "auto",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "0.78rem",
  minWidth: "640px",
};

const thStyle = {
  textAlign: "left",
  padding: "0.55rem 0.65rem",
  background: "#f1f5f9",
  color: "#475569",
  fontWeight: 700,
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "0.55rem 0.65rem",
  borderBottom: "1px solid #f1f5f9",
  color: "#334155",
  verticalAlign: "top",
};

const selectStyle = {
  width: "100%",
  maxWidth: "28rem",
  padding: "0.45rem 0.55rem",
  fontSize: "0.85rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
};

const scenarioLibraryGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(17rem, 1fr))",
  gap: "0.85rem",
  marginTop: "0.75rem",
};

const scenarioLibraryCardStyle = {
  padding: "0.85rem",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  background: "#f8fafc",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const customBuilderGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))",
  gap: "0.85rem",
  marginTop: "0.75rem",
};

const customBuilderFieldStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

const levelBadgeStyle = (level) => {
  const key = String(level || "moderate").toLowerCase();
  const map = {
    low: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    moderate: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  return treasuryBadgeStyle(map[key] || map.moderate);
};

const crisisLevelBadgeStyle = (level) => {
  const n = Number(level) || 1;
  const map = {
    1: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    2: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    3: { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" },
    4: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    5: { bg: "#fdf2f8", fg: "#9d174d", border: "#fbcfe8" },
  };
  return treasuryBadgeStyle(map[n] || map[3]);
};

const eventSeverityBadgeStyle = (severity) => {
  const key = String(severity || "info").toLowerCase();
  const map = {
    info: { bg: "#f1f5f9", fg: "#475569", border: "#e2e8f0" },
    watch: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated: { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" },
    advisory: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  return treasuryBadgeStyle(map[key] || map.info);
};

const riskLevelBadgeStyle = (riskLevel) => {
  const key = String(riskLevel || "moderate").toLowerCase();
  const map = {
    low: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    moderate: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated: { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" },
    high: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    critical: { bg: "#fdf2f8", fg: "#9d174d", border: "#fbcfe8" },
  };
  return treasuryBadgeStyle(map[key] || map.moderate);
};

const categoryBadgeStyle = {
  ...treasuryBadgeStyle({ bg: "#f1f5f9", fg: "#475569", border: "#e2e8f0" }),
  fontSize: "0.7rem",
};

const difficultyBadgeStyle = (difficulty) => {
  const key = String(difficulty || "Intermediate").toLowerCase();
  const map = {
    beginner: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    intermediate: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    advanced: { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" },
    expert: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  return treasuryBadgeStyle(map[key] || map.intermediate);
};

const trainingModuleGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(18rem, 1fr))",
  gap: "0.85rem",
  marginTop: "0.75rem",
};

const trainingModuleCardStyle = {
  ...scenarioLibraryCardStyle,
  minHeight: "11rem",
};

const commandCenterGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(10.5rem, 1fr))",
  gap: "0.75rem",
  marginTop: "1rem",
};

const commandCenterCardStyle = {
  padding: "0.85rem",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  background: "#f8fafc",
};

const commandCenterDetailStyle = {
  marginTop: "0.65rem",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  background: "#fafafa",
};

const commandCenterSummaryStyle = {
  padding: "0.55rem 0.75rem",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: "0.82rem",
  color: "#334155",
  listStyle: "none",
};

const commandCenterDetailBodyStyle = {
  padding: "0 0.75rem 0.75rem",
  fontSize: "0.78rem",
  color: "#475569",
  lineHeight: 1.5,
};

function briefingExcerpt(text, maxLen = 120) {
  const s = String(text || "").trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen).trim()}…`;
}

const CUSTOM_BUILDER_FIELDS = [
  { key: "liquidityPressure", label: "Liquidity Pressure" },
  { key: "confidence", label: "Confidence" },
  { key: "coherence", label: "Coherence" },
  { key: "trust", label: "Trust" },
  { key: "operationalLoad", label: "Operational Load" },
  { key: "leadershipReadiness", label: "Leadership Readiness" },
  { key: "advisoryDrift", label: "Advisory Drift" },
  { key: "recommendationStability", label: "Recommendation Stability" },
];

const progressionChipsWrap = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.4rem",
  alignItems: "center",
  marginTop: "0.5rem",
};

const progressionArrowStyle = {
  fontSize: "0.75rem",
  color: "#94a3b8",
  fontWeight: 700,
};

const stepCardStyle = {
  marginTop: "0.75rem",
  padding: "0.85rem",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  background: "#f8fafc",
};

const stepCardHeaderStyle = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.5rem",
  marginBottom: "0.5rem",
};

const reportPreStyle = {
  margin: "0.65rem 0 0",
  padding: "0.75rem",
  fontSize: "0.72rem",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "8px",
  overflowX: "auto",
  color: "#334155",
  whiteSpace: "pre-wrap",
  lineHeight: 1.5,
  maxHeight: "20rem",
  overflowY: "auto",
};

function gradeBadgeStyle(grade) {
  const map = {
    A: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    B: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    C: { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" },
    D: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    F: { bg: "#fdf2f8", fg: "#9d174d", border: "#fbcfe8" },
  };
  return treasuryBadgeStyle(map[grade] || map.C);
}

function qualityBadgeStyle(quality) {
  const key = String(quality || "").toLowerCase();
  const map = {
    strong: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    adequate: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    mixed: { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" },
    weak: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    aligned: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    moderate: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    misaligned: { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" },
    degraded: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
  };
  return treasuryBadgeStyle(map[key] || { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" });
}

async function copyReportText(text) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    }
  } catch {
    // fail-open — no user-facing error required
  }
}

function humanize(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function postureBadgeStyle(status) {
  const key = String(status || "").toLowerCase();
  const map = {
    stable: { bg: "#ecfdf5", fg: "#047857", border: "#bbf7d0" },
    monitored: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
    elevated_attention: { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" },
    active_review: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    moderate_variation: { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" },
    unstable: { bg: "#fef2f2", fg: "#991b1b", border: "#fca5a5" },
    fragmented: { bg: "#fdf2f8", fg: "#9d174d", border: "#fbcfe8" },
  };
  return treasuryBadgeStyle(map[key] || { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" });
}

function KeyValueGrid({ entries }) {
  return (
    <div style={treasuryKpiGridStyle}>
      {entries.map(([label, value]) => (
        <div key={label} style={treasurySummaryBlockStyle}>
          <p style={treasuryKpiLabelStyle}>{label}</p>
          <p style={{ ...treasurySummaryTextStyle, fontWeight: 600, color: "#0f172a", marginTop: "0.35rem" }}>
            {value}
          </p>
        </div>
      ))}
    </div>
  );
}

function PanelSection({ title, intro, children }) {
  return (
    <section style={treasurySectionStyle}>
      <div style={{ ...cardBase, ...treasuryCardPaddingStyle }}>
        <h2 style={sectionHeading}>{title}</h2>
        {intro ? <p style={treasurySectionIntroStyle}>{intro}</p> : null}
        {children}
      </div>
    </section>
  );
}

function ReadinessGauge({ label, score, grade }) {
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div style={{ marginTop: "0.65rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <span style={treasurySummaryLabelStyle}>{label}</span>
        <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569" }}>
          {pct}/100{grade ? ` · ${grade}` : ""}
        </span>
      </div>
      <div
        style={{
          marginTop: "0.35rem",
          height: "0.5rem",
          borderRadius: "999px",
          background: "#e2e8f0",
          overflow: "hidden",
        }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "linear-gradient(90deg, #0ea5e9 0%, #0284c7 100%)",
            borderRadius: "999px",
            transition: "width 0.25s ease",
          }}
        />
      </div>
    </div>
  );
}

function CommandCenterStatusCard({ title, status }) {
  if (!status) return null;
  return (
    <div style={commandCenterCardStyle}>
      <p style={{ ...treasurySummaryLabelStyle, margin: 0 }}>{title}</p>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
        <span style={gradeBadgeStyle(status.grade)}>{status.grade}</span>
        <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#0f172a" }}>{status.score}/100</span>
      </div>
      <p style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", fontWeight: 600, color: "#64748b" }}>{status.label}</p>
    </div>
  );
}

function CommandCenterDetailBlock({ title, summary, children }) {
  return (
    <details style={commandCenterDetailStyle}>
      <summary style={commandCenterSummaryStyle}>{title}</summary>
      <div style={commandCenterDetailBodyStyle}>
        {summary ? <p style={{ margin: "0 0 0.5rem" }}>{summary}</p> : null}
        {children}
      </div>
    </details>
  );
}

export default function TreasurySimulationLabPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [selectedId, setSelectedId] = useState(TREASURY_SIMULATION_SCENARIOS[0]?.id || "");
  const [result, setResult] = useState(null);
  const [runError, setRunError] = useState(null);
  const [comparisonIds, setComparisonIds] = useState([]);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [comparisonError, setComparisonError] = useState(null);
  const [timelineId, setTimelineId] = useState(TREASURY_SIMULATION_TIMELINES[0]?.id || "");
  const [timelineResult, setTimelineResult] = useState(null);
  const [timelineError, setTimelineError] = useState(null);
  const [failureModeId, setFailureModeId] = useState(TREASURY_FAILURE_SIMULATION_MODES[0]?.id || "");
  const [failureResult, setFailureResult] = useState(null);
  const [failureError, setFailureError] = useState(null);
  const [validationScore, setValidationScore] = useState(null);
  const [validationReport, setValidationReport] = useState(null);
  const [failureValidationScore, setFailureValidationScore] = useState(null);
  const [failureValidationReport, setFailureValidationReport] = useState(null);
  const [regressionSuiteResult, setRegressionSuiteResult] = useState(null);
  const [regressionSuiteLoading, setRegressionSuiteLoading] = useState(false);
  const [sensitivityScenarioId, setSensitivityScenarioId] = useState(
    TREASURY_SIMULATION_SCENARIOS[0]?.id || "",
  );
  const [sensitivityLevel, setSensitivityLevel] = useState("moderate");
  const [sensitivityResult, setSensitivityResult] = useState(null);
  const [sensitivityError, setSensitivityError] = useState(null);
  const [sensitivityLoading, setSensitivityLoading] = useState(false);
  const [monteCarloScenarioId, setMonteCarloScenarioId] = useState(
    TREASURY_SIMULATION_SCENARIOS[0]?.id || "",
  );
  const [monteCarloIterations, setMonteCarloIterations] = useState(100);
  const [monteCarloResult, setMonteCarloResult] = useState(null);
  const [monteCarloError, setMonteCarloError] = useState(null);
  const [monteCarloLoading, setMonteCarloLoading] = useState(false);
  const [customInputs, setCustomInputs] = useState({ ...DEFAULT_CUSTOM_SCENARIO_INPUTS });
  const [customResult, setCustomResult] = useState(null);
  const [customError, setCustomError] = useState(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [loadedPresetName, setLoadedPresetName] = useState(null);
  const [activeTrainingModuleId, setActiveTrainingModuleId] = useState(null);
  const [trainingExercise, setTrainingExercise] = useState(null);
  const [trainingError, setTrainingError] = useState(null);
  const [activeCertExamId, setActiveCertExamId] = useState(null);
  const [certExam, setCertExam] = useState(null);
  const [certAssessmentPack, setCertAssessmentPack] = useState(null);
  const [certError, setCertError] = useState(null);
  const [certView, setCertView] = useState(null);
  const [auditTypeId, setAuditTypeId] = useState(TREASURY_AUDIT_TYPES[0]?.id || "scenario-audit");
  const [auditScenarioId, setAuditScenarioId] = useState("");
  const [auditPerturbationLevel, setAuditPerturbationLevel] = useState("moderate");
  const [auditIterations, setAuditIterations] = useState(100);
  const [auditExamId, setAuditExamId] = useState("");
  const [auditPack, setAuditPack] = useState(null);
  const [auditReviewPack, setAuditReviewPack] = useState(null);
  const [auditError, setAuditError] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [manualSectionId, setManualSectionId] = useState("");
  const [manualProcedureId, setManualProcedureId] = useState(
    () => getTreasuryProcedures()[0]?.id || "",
  );
  const [treasuryManual, setTreasuryManual] = useState(null);
  const [treasuryProcedureGuide, setTreasuryProcedureGuide] = useState(null);
  const [manualError, setManualError] = useState(null);
  const [warRoomScenarioId, setWarRoomScenarioId] = useState(
    TREASURY_WAR_ROOM_SCENARIOS[0]?.id || "",
  );
  const [warRoomCrisisLevel, setWarRoomCrisisLevel] = useState(3);
  const [warRoomResult, setWarRoomResult] = useState(null);
  const [warRoomReport, setWarRoomReport] = useState(null);
  const [warRoomError, setWarRoomError] = useState(null);
  const [warRoomLoading, setWarRoomLoading] = useState(false);
  const [commandCenter, setCommandCenter] = useState(null);
  const [commandCenterLoading, setCommandCenterLoading] = useState(false);
  const [commandCenterError, setCommandCenterError] = useState(null);

  const scenarioLibrary = useMemo(() => getTreasuryScenarioLibrary(), []);
  const warRoomScenarios = useMemo(() => getTreasuryWarRoomScenarios(), []);
  const certificationExams = useMemo(() => getTreasuryCertificationExams(), []);
  const auditTypes = useMemo(() => getTreasuryAuditTypes(), []);
  const manualSections = useMemo(() => getTreasuryManualSections(), []);
  const treasuryProcedures = useMemo(() => getTreasuryProcedures(), []);

  const selectedScenario = useMemo(
    () => TREASURY_SIMULATION_SCENARIOS.find((s) => s.id === selectedId) || null,
    [selectedId],
  );

  const handleRun = useCallback(() => {
    setRunError(null);
    const out = runTreasurySimulation(selectedId);
    if (!out) {
      setResult(null);
      setValidationScore(null);
      setValidationReport(null);
      setRunError("Unknown scenario — select a valid synthetic scenario.");
      return;
    }
    const score = scoreTreasurySimulationResult(out);
    const report = buildTreasurySimulationValidationReport(out);
    setResult(out);
    setValidationScore(score);
    setValidationReport(report);
  }, [selectedId]);

  const comparisonAtMax = comparisonIds.length >= 3;

  const handleComparisonToggle = useCallback((scenarioId) => {
    setComparisonError(null);
    setComparisonIds((prev) => {
      if (prev.includes(scenarioId)) {
        return prev.filter((id) => id !== scenarioId);
      }
      if (prev.length >= 3) return prev;
      return [...prev, scenarioId];
    });
  }, []);

  const handleCompare = useCallback(() => {
    setComparisonError(null);
    if (comparisonIds.length < 2) {
      setComparisonResult(null);
      setComparisonError("Select at least two scenarios to compare (maximum three).");
      return;
    }
    const out = compareTreasurySimulations(comparisonIds);
    if (!out.simulations?.length) {
      setComparisonResult(null);
      setComparisonError("Comparison could not be run — verify at least two valid scenarios are selected.");
      return;
    }
    setComparisonResult(out);
  }, [comparisonIds]);

  const handleClearComparison = useCallback(() => {
    setComparisonIds([]);
    setComparisonResult(null);
    setComparisonError(null);
  }, []);

  const selectedTimeline = useMemo(
    () => TREASURY_SIMULATION_TIMELINES.find((t) => t.id === timelineId) || null,
    [timelineId],
  );

  const handleRunTimeline = useCallback(() => {
    setTimelineError(null);
    const out = runTreasurySimulationTimeline(timelineId);
    if (!out.timeline || !out.steps?.length) {
      setTimelineResult(null);
      setTimelineError("Unknown timeline — select a valid stress timeline.");
      return;
    }
    setTimelineResult(out);
  }, [timelineId]);

  const selectedFailureMode = useMemo(
    () => TREASURY_FAILURE_SIMULATION_MODES.find((m) => m.id === failureModeId) || null,
    [failureModeId],
  );

  const handleRunFailureTest = useCallback(() => {
    setFailureError(null);
    const out = runTreasuryFailureSimulation(failureModeId);
    if (!out.mode?.id || !TREASURY_FAILURE_SIMULATION_MODES.some((m) => m.id === out.mode.id)) {
      setFailureResult(out);
      setFailureValidationScore(null);
      setFailureValidationReport(null);
      if (!failureModeId) {
        setFailureError("Select a valid failure mode to run the stress test.");
      }
      return;
    }
    const score = scoreTreasurySimulationResult(out);
    const report = buildTreasurySimulationValidationReport(out);
    setFailureResult(out);
    setFailureValidationScore(score);
    setFailureValidationReport(report);
  }, [failureModeId]);

  const handleRunRegressionSuite = useCallback(() => {
    setRegressionSuiteLoading(true);
    setRegressionSuiteResult(null);
    requestAnimationFrame(() => {
      const out = runTreasurySimulationRegressionSuite();
      setRegressionSuiteResult(out);
      setRegressionSuiteLoading(false);
    });
  }, []);

  const handleRunSensitivityTest = useCallback(() => {
    setSensitivityError(null);
    setSensitivityLoading(true);
    setSensitivityResult(null);
    requestAnimationFrame(() => {
      const out = runTreasurySensitivitySimulation({
        baseScenario: sensitivityScenarioId,
        perturbationLevel: sensitivityLevel,
      });
      if (!out) {
        setSensitivityResult(null);
        setSensitivityError("Sensitivity test could not be run — select a valid scenario and perturbation level.");
      } else {
        setSensitivityResult(out);
      }
      setSensitivityLoading(false);
    });
  }, [sensitivityScenarioId, sensitivityLevel]);

  const handleRunMonteCarloTest = useCallback(() => {
    setMonteCarloError(null);
    setMonteCarloLoading(true);
    setMonteCarloResult(null);
    requestAnimationFrame(() => {
      const out = runTreasuryMonteCarloSimulation({
        baseScenario: monteCarloScenarioId,
        iterations: monteCarloIterations,
      });
      if (!out) {
        setMonteCarloResult(null);
        setMonteCarloError("Monte Carlo test could not be run — select a valid scenario and iteration count.");
      } else {
        setMonteCarloResult(out);
      }
      setMonteCarloLoading(false);
    });
  }, [monteCarloScenarioId, monteCarloIterations]);

  const handleCustomInputChange = useCallback((key, value) => {
    setCustomInputs((prev) => ({ ...prev, [key]: value }));
    setLoadedPresetName(null);
  }, []);

  const handleLoadScenarioPreset = useCallback((presetId) => {
    const loaded = loadTreasuryScenarioPreset(presetId);
    if (!loaded?.preset?.inputs) {
      setLoadedPresetName(null);
      return;
    }
    setCustomInputs({ ...DEFAULT_CUSTOM_SCENARIO_INPUTS, ...loaded.preset.inputs });
    setLoadedPresetName(loaded.preset.name);
    setCustomError(null);
    if (typeof document !== "undefined") {
      document.getElementById("custom-scenario-builder")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const handleRunCustomScenario = useCallback(() => {
    setCustomError(null);
    setCustomLoading(true);
    setCustomResult(null);
    requestAnimationFrame(() => {
      try {
        const out = runCustomTreasurySimulation(customInputs);
        if (!out?.simulationResult) {
          setCustomResult(null);
          setCustomError("Custom scenario could not be run — verify all dimension levels are valid.");
        } else {
          setCustomResult(out);
        }
      } catch {
        setCustomResult(null);
        setCustomError("Custom scenario encountered an unexpected error during simulation.");
      }
      setCustomLoading(false);
    });
  }, [customInputs]);

  const handleStartTrainingExercise = useCallback((moduleId) => {
    setTrainingError(null);
    const out = runTreasuryTrainingExercise(moduleId);
    if (!out) {
      setTrainingExercise(null);
      setActiveTrainingModuleId(null);
      setTrainingError("Unknown training module — select a valid exercise.");
      return;
    }
    setActiveTrainingModuleId(moduleId);
    setTrainingExercise(out);
  }, []);

  const handleBackToTrainingModules = useCallback(() => {
    setActiveTrainingModuleId(null);
    setTrainingExercise(null);
    setTrainingError(null);
  }, []);

  const handleGenerateCertExam = useCallback((examId) => {
    setCertError(null);
    setCertAssessmentPack(null);
    const out = buildTreasuryCertificationExam(examId);
    if (!out) {
      setCertExam(null);
      setActiveCertExamId(null);
      setCertView(null);
      setCertError("Unknown certification exam — select a valid level.");
      return;
    }
    setActiveCertExamId(examId);
    setCertExam(out);
    setCertView("exam");
  }, []);

  const handleGenerateAssessmentPack = useCallback((examId) => {
    setCertError(null);
    setCertExam(null);
    const out = generateTreasuryAssessmentPack(examId);
    if (!out) {
      setCertAssessmentPack(null);
      setActiveCertExamId(null);
      setCertView(null);
      setCertError("Assessment pack could not be generated — select a valid certification level.");
      return;
    }
    setActiveCertExamId(examId);
    setCertAssessmentPack(out);
    setCertView("pack");
  }, []);

  const handleBackToCertExams = useCallback(() => {
    setActiveCertExamId(null);
    setCertExam(null);
    setCertAssessmentPack(null);
    setCertError(null);
    setCertView(null);
  }, []);

  const handleCopyAssessmentPack = useCallback(() => {
    if (certAssessmentPack?.packText) {
      copyReportText(certAssessmentPack.packText);
    }
  }, [certAssessmentPack]);

  const focusedManualSection = useMemo(() => {
    if (!manualSectionId || !treasuryManual?.sections) return null;
    return treasuryManual.sections.find((s) => s.id === manualSectionId) || null;
  }, [manualSectionId, treasuryManual]);

  const handleGenerateFullManual = useCallback(() => {
    setManualError(null);
    const out = buildTreasuryOperationsManual({
      sectionId: manualSectionId || undefined,
    });
    setTreasuryManual(out);
  }, [manualSectionId]);

  const handleGenerateProcedureGuide = useCallback(() => {
    setManualError(null);
    if (!manualProcedureId) {
      setTreasuryProcedureGuide(null);
      setManualError("Select a procedure to generate a procedure guide.");
      return;
    }
    const out = buildTreasuryProcedureGuide(manualProcedureId);
    if (!out) {
      setTreasuryProcedureGuide(null);
      setManualError("Unknown procedure — select a valid standard procedure.");
      return;
    }
    setTreasuryProcedureGuide(out);
  }, [manualProcedureId]);

  const handleCopyManual = useCallback(() => {
    if (treasuryManual?.manualPreviewText) {
      copyReportText(treasuryManual.manualPreviewText);
    }
  }, [treasuryManual]);

  const handleCopyProcedure = useCallback(() => {
    if (treasuryProcedureGuide?.procedurePreviewText) {
      copyReportText(treasuryProcedureGuide.procedurePreviewText);
    }
  }, [treasuryProcedureGuide]);

  const selectedAuditType = useMemo(
    () => auditTypes.find((t) => t.id === auditTypeId) || auditTypes[0] || null,
    [auditTypes, auditTypeId],
  );

  const handleGenerateAudit = useCallback(() => {
    setAuditError(null);
    setAuditLoading(true);
    setAuditPack(null);
    setAuditReviewPack(null);
    requestAnimationFrame(() => {
      const scope = {};
      if (auditScenarioId) scope.scenarioId = auditScenarioId;
      if (auditPerturbationLevel) scope.perturbationLevel = auditPerturbationLevel;
      if (auditIterations) scope.iterations = auditIterations;
      if (auditExamId) scope.examId = auditExamId;

      const pack = buildTreasuryAuditPack({ auditType: auditTypeId, scope });
      if (!pack) {
        setAuditError("Audit could not be generated — select a valid audit type and scope.");
        setAuditLoading(false);
        return;
      }

      const review = buildTreasuryReviewPack({ auditType: auditTypeId, scope, auditPack: pack });
      setAuditPack(pack);
      setAuditReviewPack(review);
      setAuditLoading(false);
    });
  }, [auditTypeId, auditScenarioId, auditPerturbationLevel, auditIterations, auditExamId]);

  const handleCopyAuditReport = useCallback(() => {
    if (auditPack?.auditPreviewText) {
      copyReportText(auditPack.auditPreviewText);
    }
  }, [auditPack]);

  const handleCopyReviewReport = useCallback(() => {
    if (auditReviewPack?.reviewPreviewText) {
      copyReportText(auditReviewPack.reviewPreviewText);
    }
  }, [auditReviewPack]);

  const selectedWarRoomScenario = useMemo(
    () => warRoomScenarios.find((s) => s.id === warRoomScenarioId) || null,
    [warRoomScenarios, warRoomScenarioId],
  );

  const handleRunWarRoom = useCallback(() => {
    setWarRoomError(null);
    setWarRoomLoading(true);
    setWarRoomResult(null);
    setWarRoomReport(null);
    requestAnimationFrame(() => {
      const out = runTreasuryWarRoomScenario({
        scenarioId: warRoomScenarioId,
        crisisLevel: warRoomCrisisLevel,
      });
      if (!out) {
        setWarRoomError("War room scenario could not be run — select a valid scenario.");
        setWarRoomLoading(false);
        return;
      }
      const report = buildTreasuryWarRoomReport(out);
      setWarRoomResult(out);
      setWarRoomReport(report);
      setWarRoomLoading(false);
    });
  }, [warRoomScenarioId, warRoomCrisisLevel]);

  const handleCopyWarRoomReport = useCallback(() => {
    if (warRoomReport?.reportText) {
      copyReportText(warRoomReport.reportText);
    }
  }, [warRoomReport]);

  const auditNeedsScenario =
    auditTypeId === "scenario-audit" ||
    auditTypeId === "sensitivity-audit" ||
    auditTypeId === "monte-carlo-audit" ||
    auditTypeId === "full-lab-audit";
  const auditNeedsPerturbation =
    auditTypeId === "sensitivity-audit" || auditTypeId === "full-lab-audit";
  const auditNeedsIterations =
    auditTypeId === "monte-carlo-audit" || auditTypeId === "full-lab-audit";
  const auditNeedsExam = auditTypeId === "certification-audit";

  const handleRefreshCommandCenter = useCallback(() => {
    setCommandCenterError(null);
    setCommandCenterLoading(true);
    requestAnimationFrame(() => {
      try {
        const out = buildTreasuryCommandCenter();
        setCommandCenter(out);
      } catch {
        setCommandCenter(null);
        setCommandCenterError("Command center could not be built — retry refresh.");
      } finally {
        setCommandCenterLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!authLoading && isAdminUser(user, profile)) {
      handleRefreshCommandCenter();
    }
  }, [authLoading, user, profile, handleRefreshCommandCenter]);

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.75rem" }}>
            Treasury Simulation Lab
          </h1>
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
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.75rem" }}>
            Treasury Simulation Lab
          </h1>
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
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.82rem" }}>
          <Link href="/admin" style={{ fontWeight: 600, color: "#0ea5e9" }}>
            ← Admin
          </Link>
          {" · "}
          <Link href="/admin/treasury-intelligence" style={{ fontWeight: 600, color: "#0ea5e9" }}>
            Treasury Intelligence
          </Link>
        </p>

        <h1
          style={{
            fontSize: "1.55rem",
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: "0.5rem",
            letterSpacing: "-0.02em",
          }}
        >
          Treasury Simulation Lab
        </h1>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "#64748b", lineHeight: 1.5, maxWidth: "52rem" }}>
          Run synthetic treasury scenarios to validate advisory intelligence. No real funds, wallets, payouts,
          withdrawals, or PayPal flows are affected.
        </p>

        <div style={{ ...treasuryPanelHighlightStyle, borderColor: "#86efac", background: "#ecfdf5" }}>
          <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#047857" }}>
            Simulation only. No production treasury data is changed.
          </p>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#166534", lineHeight: 1.45 }}>
            Treasury paper mode — read-only, advisory-only outputs. No database writes, operational events, or
            financial flows.
          </p>
        </div>

        <PanelSection
          title="Treasury Command Center"
          intro="Aggregate lab readiness dashboard — deterministic paper-mode sampling across validation, audit, training, certification, and manual coverage. Read-only, in-memory, no persistence."
        >
          <div style={{ ...treasuryPanelHighlightStyle, borderColor: "#bfdbfe", background: "#eff6ff" }}>
            <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#1d4ed8" }}>
              Command center — simulation only, advisory aggregate.
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#1e40af", lineHeight: 1.45 }}>
              Refreshes sample 3 scenarios and 2 failure modes (not the full regression suite). No database writes,
              alerts, notifications, or financial mutations.
            </p>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className={treasuryFocusRingClass}
              style={{
                ...btnPrimary,
                opacity: commandCenterLoading ? 0.7 : 1,
                cursor: commandCenterLoading ? "wait" : "pointer",
              }}
              onClick={handleRefreshCommandCenter}
              disabled={commandCenterLoading}
            >
              {commandCenterLoading ? "Building command center…" : "Refresh Command Center"}
            </button>
          </div>

          {commandCenterError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{commandCenterError}</p>
          ) : null}

          {commandCenterLoading && !commandCenter ? (
            <p style={{ ...treasurySummaryTextStyle, marginTop: "1rem" }}>Aggregating lab readiness metrics…</p>
          ) : null}

          {commandCenter ? (
            <>
              <p style={{ ...treasurySummaryTextStyle, marginTop: "1rem", fontSize: "0.75rem", color: "#94a3b8" }}>
                Generated {new Date(commandCenter.generatedAt).toLocaleString()} — session state only
              </p>

              <div style={commandCenterGridStyle}>
                <CommandCenterStatusCard title="Simulation" status={commandCenter.simulationStatus} />
                <CommandCenterStatusCard title="Audit" status={commandCenter.auditStatus} />
                <CommandCenterStatusCard title="Training" status={commandCenter.trainingStatus} />
                <CommandCenterStatusCard title="Certification" status={commandCenter.certificationStatus} />
                <CommandCenterStatusCard title="War Room" status={commandCenter.warRoomStatus} />
                <CommandCenterStatusCard title="Overall Readiness" status={commandCenter.readinessStatus} />
              </div>

              <div
                style={{
                  marginTop: "1.25rem",
                  padding: "0.85rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "8px",
                  background: "#ffffff",
                }}
              >
                <p style={{ ...treasurySummaryLabelStyle, margin: 0 }}>Readiness gauges</p>
                <ReadinessGauge
                  label="Overall readiness"
                  score={commandCenter.readinessStatus.overallScore}
                  grade={commandCenter.readinessStatus.overallGrade}
                />
                <ReadinessGauge label="Simulation" score={commandCenter.simulationStatus.score} grade={commandCenter.simulationStatus.grade} />
                <ReadinessGauge label="Audit" score={commandCenter.auditStatus.score} grade={commandCenter.auditStatus.grade} />
                <ReadinessGauge label="Training" score={commandCenter.trainingStatus.score} grade={commandCenter.trainingStatus.grade} />
                <ReadinessGauge
                  label="Certification"
                  score={commandCenter.certificationStatus.score}
                  grade={commandCenter.certificationStatus.grade}
                />
                <ReadinessGauge label="War room" score={commandCenter.warRoomStatus.score} grade={commandCenter.warRoomStatus.grade} />
              </div>

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "1.25rem" }}>Coverage metrics</p>
              <KeyValueGrid
                entries={[
                  ["Scenarios", String(commandCenter.coverageMetrics.totalScenarios)],
                  ["Failure modes", String(commandCenter.coverageMetrics.totalFailureModes)],
                  ["Presets", String(commandCenter.coverageMetrics.totalPresets)],
                  ["Training modules", String(commandCenter.coverageMetrics.totalTrainingModules)],
                  ["Certification exams", String(commandCenter.coverageMetrics.totalCertificationExams)],
                  ["Audit types", String(commandCenter.coverageMetrics.totalAuditTypes)],
                  ["War room scenarios", String(commandCenter.coverageMetrics.totalWarRoomScenarios)],
                  ["Manual sections", String(commandCenter.coverageMetrics.totalManualSections)],
                  ["Procedures", String(commandCenter.coverageMetrics.totalProcedures)],
                ]}
              />

              <div style={{ ...treasuryPanelHighlightStyle, marginTop: "1.25rem", borderColor: "#e2e8f0", background: "#f8fafc" }}>
                <p style={{ ...treasurySummaryLabelStyle, margin: 0 }}>Executive summary</p>
                <p style={{ ...treasurySummaryTextStyle, marginTop: "0.5rem", fontWeight: 600, color: "#334155" }}>
                  {commandCenter.sections.executiveSummary}
                </p>
                <p style={{ ...treasurySummaryTextStyle, marginTop: "0.65rem" }}>{commandCenter.summary}</p>
              </div>

              {commandCenter.recommendations?.length > 0 ? (
                <div style={{ marginTop: "1rem" }}>
                  <p style={treasurySummaryLabelStyle}>Top recommendations</p>
                  <ul style={treasuryListStyle}>
                    {commandCenter.recommendations.map((rec) => (
                      <li key={rec} style={treasuryListItemStyle}>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <CommandCenterDetailBlock
                title="Validation overview"
                summary={commandCenter.sections.validationOverview.summary}
              >
                <KeyValueGrid
                  entries={[
                    ["Sample method", commandCenter.sections.validationOverview.sampleMethod],
                    ["Avg validation", `${commandCenter.sections.validationOverview.averageValidationScore}/100`],
                    ["Avg safety", `${commandCenter.sections.validationOverview.averageSafetyScore}/100`],
                    ["Grade", commandCenter.sections.validationOverview.validationGrade],
                    ["Samples run", String(commandCenter.sections.validationOverview.samplesRun)],
                    [
                      "Weakest sample",
                      commandCenter.sections.validationOverview.weakestSample
                        ? `${commandCenter.sections.validationOverview.weakestSample.name} — ${commandCenter.sections.validationOverview.weakestSample.validationScore}/100`
                        : "n/a",
                    ],
                  ]}
                />
              </CommandCenterDetailBlock>

              <CommandCenterDetailBlock
                title="Simulation health"
                summary={commandCenter.sections.simulationHealth.summary}
              >
                <KeyValueGrid
                  entries={[
                    ["Scenarios", String(commandCenter.sections.simulationHealth.scenariosAvailable)],
                    ["Failure modes", String(commandCenter.sections.simulationHealth.failureModesAvailable)],
                    ["Presets", String(commandCenter.sections.simulationHealth.presetsAvailable)],
                    ["Custom builder", commandCenter.sections.simulationHealth.customBuilderStatus],
                    ["Sampled grade", commandCenter.sections.simulationHealth.sampledValidationGrade],
                  ]}
                />
              </CommandCenterDetailBlock>

              <CommandCenterDetailBlock title="Audit readiness" summary={commandCenter.sections.auditReadiness.summary}>
                <KeyValueGrid
                  entries={[
                    ["Audit types", String(commandCenter.sections.auditReadiness.auditTypesAvailable)],
                    ["Sample audit", commandCenter.sections.auditReadiness.sampleAuditType],
                    ["Sample scenario", commandCenter.sections.auditReadiness.sampleAuditScenarioId],
                    ["Last audit grade", commandCenter.sections.auditReadiness.lastAuditGrade],
                  ]}
                />
              </CommandCenterDetailBlock>

              <CommandCenterDetailBlock
                title="Training readiness"
                summary={commandCenter.sections.trainingReadiness.summary}
              >
                <KeyValueGrid
                  entries={[
                    ["Modules", String(commandCenter.sections.trainingReadiness.modulesAvailable)],
                    ["Sample module", commandCenter.sections.trainingReadiness.sampleModuleTitle || "n/a"],
                    [
                      "Exercise context",
                      commandCenter.sections.trainingReadiness.exerciseResolved ? "Resolved" : "Pending",
                    ],
                  ]}
                />
              </CommandCenterDetailBlock>

              <CommandCenterDetailBlock
                title="Certification readiness"
                summary={commandCenter.sections.certificationReadiness.summary}
              >
                <KeyValueGrid
                  entries={[
                    ["Exams", String(commandCenter.sections.certificationReadiness.examsAvailable)],
                    ["Levels", commandCenter.sections.certificationReadiness.levels.join(", ")],
                  ]}
                />
              </CommandCenterDetailBlock>

              <CommandCenterDetailBlock title="War room readiness" summary={commandCenter.sections.warRoomReadiness.summary}>
                <KeyValueGrid
                  entries={[
                    ["Status", commandCenter.sections.warRoomReadiness.status],
                    ["Scenarios", String(commandCenter.sections.warRoomReadiness.scenariosAvailable)],
                    ["Crisis levels", commandCenter.sections.warRoomReadiness.crisisLevelsAvailable.join(", ")],
                  ]}
                />
              </CommandCenterDetailBlock>

              <CommandCenterDetailBlock title="Manual coverage" summary={commandCenter.sections.manualCoverage.summary}>
                <KeyValueGrid
                  entries={[
                    ["Manual sections", String(commandCenter.sections.manualCoverage.manualSections)],
                    ["Procedures", String(commandCenter.sections.manualCoverage.procedures)],
                  ]}
                />
              </CommandCenterDetailBlock>
            </>
          ) : null}
        </PanelSection>

        <PanelSection
          title="Scenario controls"
          intro="Select a synthetic scenario and run the deterministic simulation engine on demand."
        >
          <label htmlFor="scenario-select" style={{ ...treasurySummaryLabelStyle, display: "block" }}>
            Scenario
          </label>
          <select
            id="scenario-select"
            className={treasuryFocusRingClass}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            style={selectStyle}
          >
            {TREASURY_SIMULATION_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({humanize(s.category)})
              </option>
            ))}
          </select>
          <div style={{ marginTop: "1rem" }}>
            <button type="button" className={treasuryFocusRingClass} style={btnPrimary} onClick={handleRun}>
              Run Simulation
            </button>
          </div>
          {runError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{runError}</p>
          ) : null}
        </PanelSection>

        <PanelSection
          title="Comparison mode"
          intro="Select two or three synthetic scenarios to compare advisory posture side by side. Maximum three scenarios per comparison."
        >
          <p style={{ ...treasurySummaryLabelStyle, margin: 0 }}>
            Selected: {comparisonIds.length}/3
            {comparisonAtMax ? " (maximum reached — uncheck a scenario to select another)" : ""}
          </p>
          <div style={checkboxListStyle}>
            {TREASURY_SIMULATION_SCENARIOS.map((s) => {
              const checked = comparisonIds.includes(s.id);
              const disabled = !checked && comparisonAtMax;
              return (
                <label
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.55 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    className={treasuryFocusRingClass}
                    checked={checked}
                    disabled={disabled}
                    onChange={() => handleComparisonToggle(s.id)}
                    style={{ marginTop: "0.15rem" }}
                  />
                  <span>
                    <strong style={{ color: "#0f172a", fontSize: "0.82rem" }}>{s.name}</strong>
                    <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b", marginTop: "0.1rem" }}>
                      {humanize(s.category)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
            <button type="button" className={treasuryFocusRingClass} style={btnPrimary} onClick={handleCompare}>
              Compare
            </button>
            <button type="button" className={treasuryFocusRingClass} style={btnSecondary} onClick={handleClearComparison}>
              Clear comparison
            </button>
          </div>
          {comparisonError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{comparisonError}</p>
          ) : null}
        </PanelSection>

        <PanelSection
          title="Timeline simulation"
          intro="Run a multi-step synthetic stress timeline to observe posture, confidence, regime, and outlook progression across ordered scenarios."
        >
          <label htmlFor="timeline-select" style={{ ...treasurySummaryLabelStyle, display: "block" }}>
            Stress timeline
          </label>
          <select
            id="timeline-select"
            className={treasuryFocusRingClass}
            value={timelineId}
            onChange={(e) => setTimelineId(e.target.value)}
            style={selectStyle}
          >
            {TREASURY_SIMULATION_TIMELINES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {selectedTimeline ? (
            <p style={{ ...treasurySummaryTextStyle, marginTop: "0.65rem" }}>{selectedTimeline.description}</p>
          ) : null}
          {selectedTimeline?.steps?.length > 0 ? (
            <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.5rem" }}>
              Steps:{" "}
              {selectedTimeline.steps
                .map((id) => TREASURY_SIMULATION_SCENARIOS.find((s) => s.id === id)?.name || id)
                .join(" → ")}
            </p>
          ) : null}
          <div style={{ marginTop: "1rem" }}>
            <button type="button" className={treasuryFocusRingClass} style={btnPrimary} onClick={handleRunTimeline}>
              Run timeline
            </button>
          </div>
          {timelineError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{timelineError}</p>
          ) : null}
        </PanelSection>

        <PanelSection
          title="Contradiction & Failure Testing"
          intro="Run deterministic stress tests to validate advisory reasoning integrity under synthetic contradictions. Stress test only — no production data changed."
        >
          <label htmlFor="failure-mode-select" style={{ ...treasurySummaryLabelStyle, display: "block" }}>
            Failure mode
          </label>
          <select
            id="failure-mode-select"
            className={treasuryFocusRingClass}
            value={failureModeId}
            onChange={(e) => setFailureModeId(e.target.value)}
            style={selectStyle}
          >
            {TREASURY_FAILURE_SIMULATION_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          {selectedFailureMode ? (
            <p style={{ ...treasurySummaryTextStyle, marginTop: "0.65rem" }}>{selectedFailureMode.description}</p>
          ) : null}
          <div style={{ marginTop: "1rem" }}>
            <button type="button" className={treasuryFocusRingClass} style={btnPrimary} onClick={handleRunFailureTest}>
              Run test
            </button>
          </div>
          {failureError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{failureError}</p>
          ) : null}
        </PanelSection>

        <PanelSection
          title="Treasury Sensitivity Testing"
          intro="Run controlled synthetic perturbations against a baseline scenario to measure advisory robustness. Deterministic paper mode — no persistence, no production coupling."
        >
          <label htmlFor="sensitivity-scenario-select" style={{ ...treasurySummaryLabelStyle, display: "block" }}>
            Base scenario
          </label>
          <select
            id="sensitivity-scenario-select"
            className={treasuryFocusRingClass}
            value={sensitivityScenarioId}
            onChange={(e) => setSensitivityScenarioId(e.target.value)}
            style={selectStyle}
          >
            {TREASURY_SIMULATION_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({humanize(s.category)})
              </option>
            ))}
          </select>
          <p style={{ ...treasurySummaryLabelStyle, marginTop: "1rem", marginBottom: "0.35rem" }}>
            Perturbation level
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {["low", "moderate", "high"].map((level) => (
              <label
                key={level}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  color: "#334155",
                }}
              >
                <input
                  type="radio"
                  name="sensitivity-level"
                  className={treasuryFocusRingClass}
                  value={level}
                  checked={sensitivityLevel === level}
                  onChange={() => setSensitivityLevel(level)}
                />
                {humanize(level)}
              </label>
            ))}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className={treasuryFocusRingClass}
              style={{
                ...btnPrimary,
                opacity: sensitivityLoading ? 0.7 : 1,
                cursor: sensitivityLoading ? "wait" : "pointer",
              }}
              onClick={handleRunSensitivityTest}
              disabled={sensitivityLoading}
            >
              {sensitivityLoading ? "Running sensitivity test…" : "Run Sensitivity Test"}
            </button>
          </div>
          {sensitivityError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{sensitivityError}</p>
          ) : null}
        </PanelSection>

        <PanelSection
          title="Treasury Monte Carlo Stability Testing"
          intro="Run seeded random perturbations across many synthetic advisory environments to measure treasury guidance robustness. Paper mode only — no persistence, no production coupling."
        >
          <label htmlFor="monte-carlo-scenario-select" style={{ ...treasurySummaryLabelStyle, display: "block" }}>
            Base scenario
          </label>
          <select
            id="monte-carlo-scenario-select"
            className={treasuryFocusRingClass}
            value={monteCarloScenarioId}
            onChange={(e) => setMonteCarloScenarioId(e.target.value)}
            style={selectStyle}
          >
            {TREASURY_SIMULATION_SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({humanize(s.category)})
              </option>
            ))}
          </select>
          <p style={{ ...treasurySummaryLabelStyle, marginTop: "1rem", marginBottom: "0.35rem" }}>
            Iteration count
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {TREASURY_MONTE_CARLO_ITERATIONS.map((count) => (
              <label
                key={count}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  color: "#334155",
                }}
              >
                <input
                  type="radio"
                  name="monte-carlo-iterations"
                  className={treasuryFocusRingClass}
                  value={count}
                  checked={monteCarloIterations === count}
                  onChange={() => setMonteCarloIterations(count)}
                />
                {count}
              </label>
            ))}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className={treasuryFocusRingClass}
              style={{
                ...btnPrimary,
                opacity: monteCarloLoading ? 0.7 : 1,
                cursor: monteCarloLoading ? "wait" : "pointer",
              }}
              onClick={handleRunMonteCarloTest}
              disabled={monteCarloLoading}
            >
              {monteCarloLoading ? "Running Monte Carlo test…" : "Run Monte Carlo Test"}
            </button>
          </div>
          {monteCarloError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{monteCarloError}</p>
          ) : null}
        </PanelSection>

        <PanelSection
          title="Scenario Library"
          intro="Load curated synthetic presets into the custom scenario builder. Presets populate dimension levels only — run simulation manually when ready. No persistence, no auto-run."
        >
          <div style={scenarioLibraryGridStyle}>
            {scenarioLibrary.map((preset) => (
              <div key={preset.id} style={scenarioLibraryCardStyle}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
                  <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>{preset.name}</strong>
                  <span style={riskLevelBadgeStyle(preset.riskLevel)}>{humanize(preset.riskLevel)} risk</span>
                  {preset.category ? <span style={categoryBadgeStyle}>{preset.category}</span> : null}
                </div>
                <p style={{ ...treasurySummaryTextStyle, margin: 0, fontSize: "0.78rem" }}>{preset.description}</p>
                <p style={{ ...treasurySummaryLabelStyle, margin: 0, fontSize: "0.72rem" }}>Expected behavior</p>
                <p style={{ ...treasurySummaryTextStyle, margin: 0, fontSize: "0.76rem" }}>{preset.expectedBehavior}</p>
                <button
                  type="button"
                  className={treasuryFocusRingClass}
                  style={{ ...btnSecondary, marginTop: "0.25rem", alignSelf: "flex-start" }}
                  onClick={() => handleLoadScenarioPreset(preset.id)}
                >
                  Load Scenario
                </button>
              </div>
            ))}
          </div>
          <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem", fontSize: "0.78rem", color: "#64748b" }}>
            {scenarioLibrary.length} institutional presets — session state only. Adjust levels after load, then use Run
            Custom Scenario.
          </p>
        </PanelSection>

        <PanelSection
          title="Custom Scenario Builder"
          intro="Compose a synthetic advisory profile from eight dimension levels and run it through the deterministic simulation engine. Paper mode only — no persistence, no production coupling."
        >
          <div id="custom-scenario-builder" style={{ scrollMarginTop: "5rem" }} />
          {loadedPresetName ? (
            <div
              style={{
                ...treasuryPanelHighlightStyle,
                marginBottom: "0.85rem",
                borderColor: "#bfdbfe",
                background: "#eff6ff",
              }}
            >
              <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#1d4ed8" }}>
                Loaded: {loadedPresetName}
              </p>
              <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#1e40af" }}>
                Builder inputs updated from scenario library. Click Run Custom Scenario when ready — simulation does not
                start automatically.
              </p>
            </div>
          ) : null}
          <div style={customBuilderGridStyle}>
            {CUSTOM_BUILDER_FIELDS.map(({ key, label }) => (
              <div key={key} style={customBuilderFieldStyle}>
                <label htmlFor={`custom-${key}`} style={{ ...treasurySummaryLabelStyle, margin: 0 }}>
                  {label}
                </label>
                <select
                  id={`custom-${key}`}
                  className={treasuryFocusRingClass}
                  value={customInputs[key] || "moderate"}
                  onChange={(e) => handleCustomInputChange(key, e.target.value)}
                  style={{ ...selectStyle, maxWidth: "100%" }}
                >
                  {TREASURY_SCENARIO_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {humanize(level)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className={treasuryFocusRingClass}
              style={{
                ...btnPrimary,
                opacity: customLoading ? 0.7 : 1,
                cursor: customLoading ? "wait" : "pointer",
              }}
              onClick={handleRunCustomScenario}
              disabled={customLoading}
            >
              {customLoading ? "Running custom scenario…" : "Run Custom Scenario"}
            </button>
          </div>
          {customError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{customError}</p>
          ) : null}
        </PanelSection>

        <PanelSection
          title="Regression Suite"
          intro="Run the full deterministic regression suite across all synthetic scenarios and failure modes. Scores and aggregates validation posture — read-only, advisory-only, no persistence."
        >
          <p style={{ ...treasurySummaryTextStyle, marginTop: 0 }}>
            Exercises {TREASURY_SIMULATION_SCENARIOS.length} scenarios and {TREASURY_FAILURE_SIMULATION_MODES.length}{" "}
            failure modes in paper mode. Results remain in session state only.
          </p>
          <div style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className={treasuryFocusRingClass}
              style={{
                ...btnPrimary,
                opacity: regressionSuiteLoading ? 0.7 : 1,
                cursor: regressionSuiteLoading ? "wait" : "pointer",
              }}
              onClick={handleRunRegressionSuite}
              disabled={regressionSuiteLoading}
            >
              {regressionSuiteLoading ? "Running regression suite…" : "Run Regression Suite"}
            </button>
          </div>
        </PanelSection>

        <PanelSection
          title="Treasury Audit Center"
          intro="Generate advisory audit and review packs from synthetic simulation outputs. Paper mode only — read-only, in-memory, no persistence or production coupling."
        >
          <div style={{ ...treasuryPanelHighlightStyle, borderColor: "#bfdbfe", background: "#eff6ff" }}>
            <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#1d4ed8" }}>
              Audit & review mode — simulation only, read-only, advisory.
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#1e40af", lineHeight: 1.45 }}>
              Audits run deterministic simulations in paper mode. Reports remain in session state only — no database
              writes, file downloads, localStorage, alerts, or financial mutations.
            </p>
          </div>

          <label htmlFor="audit-type-select" style={{ ...treasurySummaryLabelStyle, display: "block", marginTop: "1rem" }}>
            Audit type
          </label>
          <select
            id="audit-type-select"
            className={treasuryFocusRingClass}
            value={auditTypeId}
            onChange={(e) => setAuditTypeId(e.target.value)}
            style={selectStyle}
          >
            {auditTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {selectedAuditType ? (
            <p style={{ ...treasurySummaryTextStyle, marginTop: "0.65rem" }}>{selectedAuditType.description}</p>
          ) : null}

          {auditNeedsScenario ? (
            <>
              <label htmlFor="audit-scenario-select" style={{ ...treasurySummaryLabelStyle, display: "block", marginTop: "1rem" }}>
                {auditTypeId === "scenario-audit" ? "Scenario scope (optional — all if blank)" : "Base scenario"}
              </label>
              <select
                id="audit-scenario-select"
                className={treasuryFocusRingClass}
                value={auditScenarioId}
                onChange={(e) => setAuditScenarioId(e.target.value)}
                style={selectStyle}
              >
                {auditTypeId === "scenario-audit" ? (
                  <option value="">All scenarios</option>
                ) : null}
                {TREASURY_SIMULATION_SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({humanize(s.category)})
                  </option>
                ))}
              </select>
            </>
          ) : null}

          {auditNeedsPerturbation ? (
            <>
              <p style={{ ...treasurySummaryLabelStyle, marginTop: "1rem", marginBottom: "0.35rem" }}>
                Perturbation level
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                {["low", "moderate", "high"].map((level) => (
                  <label
                    key={level}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      color: "#334155",
                    }}
                  >
                    <input
                      type="radio"
                      name="audit-perturbation-level"
                      className={treasuryFocusRingClass}
                      value={level}
                      checked={auditPerturbationLevel === level}
                      onChange={() => setAuditPerturbationLevel(level)}
                    />
                    {humanize(level)}
                  </label>
                ))}
              </div>
            </>
          ) : null}

          {auditNeedsIterations ? (
            <>
              <label htmlFor="audit-iterations-select" style={{ ...treasurySummaryLabelStyle, display: "block", marginTop: "1rem" }}>
                Monte Carlo iterations
              </label>
              <select
                id="audit-iterations-select"
                className={treasuryFocusRingClass}
                value={auditIterations}
                onChange={(e) => setAuditIterations(Number(e.target.value))}
                style={selectStyle}
              >
                {TREASURY_MONTE_CARLO_ITERATIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} iterations
                  </option>
                ))}
              </select>
            </>
          ) : null}

          {auditNeedsExam ? (
            <>
              <label htmlFor="audit-exam-select" style={{ ...treasurySummaryLabelStyle, display: "block", marginTop: "1rem" }}>
                Certification exam level (optional — defaults to Foundation)
              </label>
              <select
                id="audit-exam-select"
                className={treasuryFocusRingClass}
                value={auditExamId}
                onChange={(e) => setAuditExamId(e.target.value)}
                style={selectStyle}
              >
                <option value="">Default (Foundation)</option>
                {certificationExams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.level} — {exam.difficulty}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          <div style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className={treasuryFocusRingClass}
              style={{
                ...btnPrimary,
                opacity: auditLoading ? 0.7 : 1,
                cursor: auditLoading ? "wait" : "pointer",
              }}
              onClick={handleGenerateAudit}
              disabled={auditLoading}
            >
              {auditLoading ? "Generating audit…" : "Generate Audit"}
            </button>
          </div>
          {auditError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{auditError}</p>
          ) : null}
        </PanelSection>

        <PanelSection
          title="Treasury Crisis War Room"
          intro="Crisis rehearsal simulator for synthetic treasury stress. Paper mode only — read-only, advisory, in-memory. Observe, synthesize, advise, and escalate visibility without operational execution."
        >
          <div style={{ ...treasuryPanelHighlightStyle, borderColor: "#bfdbfe", background: "#eff6ff" }}>
            <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#1d4ed8" }}>
              War room mode — simulation only, read-only, advisory.
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#1e40af", lineHeight: 1.45 }}>
              Crisis rehearsals run underlying synthetic simulations deterministically. Outputs remain in session state
              only — no database writes, persistence, alerts, scheduling, notifications, or financial mutations.
            </p>
          </div>

          <label htmlFor="war-room-scenario-select" style={{ ...treasurySummaryLabelStyle, display: "block", marginTop: "1rem" }}>
            War room scenario
          </label>
          <select
            id="war-room-scenario-select"
            className={treasuryFocusRingClass}
            value={warRoomScenarioId}
            onChange={(e) => setWarRoomScenarioId(e.target.value)}
            style={selectStyle}
          >
            {warRoomScenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          {selectedWarRoomScenario ? (
            <p style={{ ...treasurySummaryTextStyle, marginTop: "0.65rem" }}>{selectedWarRoomScenario.description}</p>
          ) : null}

          <p style={{ ...treasurySummaryLabelStyle, marginTop: "1rem", marginBottom: "0.35rem" }}>
            Crisis level
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {TREASURY_CRISIS_LEVELS.map((level) => (
              <label
                key={level.level}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  color: "#334155",
                }}
              >
                <input
                  type="radio"
                  name="war-room-crisis-level"
                  className={treasuryFocusRingClass}
                  value={level.level}
                  checked={warRoomCrisisLevel === level.level}
                  onChange={() => setWarRoomCrisisLevel(level.level)}
                />
                {level.label}
              </label>
            ))}
          </div>

          <div style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className={treasuryFocusRingClass}
              style={{
                ...btnPrimary,
                opacity: warRoomLoading ? 0.7 : 1,
                cursor: warRoomLoading ? "wait" : "pointer",
              }}
              onClick={handleRunWarRoom}
              disabled={warRoomLoading}
            >
              {warRoomLoading ? "Running war room…" : "Run War Room"}
            </button>
          </div>
          {warRoomError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{warRoomError}</p>
          ) : null}
        </PanelSection>

        <PanelSection
          title="Treasury Training & Certification"
          intro="Self-guided operator exercises for interpreting synthetic advisory outputs. Paper mode only — no answer storage, no grading persistence, no production coupling."
        >
          <div style={{ ...treasuryPanelHighlightStyle, borderColor: "#bfdbfe", background: "#eff6ff" }}>
            <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#1d4ed8" }}>
              Training & certification mode — simulation only, read-only, advisory.
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#1e40af", lineHeight: 1.45 }}>
              Exercises run live simulations for context display. Reflection questions are read-only prompts — responses
              are not stored, scored, or persisted.
            </p>
          </div>

          {trainingError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{trainingError}</p>
          ) : null}

          {trainingExercise && activeTrainingModuleId ? (
            <div style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
                <strong style={{ color: "#0f172a", fontSize: "1rem" }}>{trainingExercise.module.title}</strong>
                <span style={difficultyBadgeStyle(trainingExercise.module.difficulty)}>
                  {trainingExercise.module.difficulty}
                </span>
                <span style={categoryBadgeStyle}>{trainingExercise.module.category}</span>
                <span style={difficultyBadgeStyle(trainingExercise.certificationLevel)}>
                  Cert: {trainingExercise.certificationLevel}
                </span>
              </div>

              <button
                type="button"
                className={treasuryFocusRingClass}
                style={{ ...btnSecondary, marginBottom: "0.85rem" }}
                onClick={handleBackToTrainingModules}
              >
                Back to Modules
              </button>

              <p style={{ ...treasurySummaryLabelStyle, margin: "0 0 0.35rem" }}>Scenario briefing</p>
              <p style={{ ...treasurySummaryTextStyle, marginTop: 0 }}>{trainingExercise.briefing}</p>

              {trainingExercise.scenario ? (
                <>
                  <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Scenario context</p>
                  <div style={stepCardStyle}>
                    <p style={{ ...treasurySummaryTextStyle, fontWeight: 600, color: "#0f172a", marginTop: 0 }}>
                      {trainingExercise.scenario.name}
                    </p>
                    {trainingExercise.scenario.description ? (
                      <p style={{ ...treasurySummaryTextStyle, margin: "0.35rem 0 0", fontSize: "0.78rem" }}>
                        {trainingExercise.scenario.description}
                      </p>
                    ) : null}
                    {trainingExercise.scenario.simulationResult?.summary ? (
                      <p style={{ ...treasurySummaryTextStyle, margin: "0.5rem 0 0", fontSize: "0.78rem" }}>
                        {trainingExercise.scenario.simulationResult.summary}
                      </p>
                    ) : null}
                    {trainingExercise.scenario.comparisonResult ? (
                      <KeyValueGrid
                        entries={[
                          [
                            "Confidence spread",
                            `${trainingExercise.scenario.comparisonResult.confidenceSpread.min} – ${trainingExercise.scenario.comparisonResult.confidenceSpread.max} (Δ ${trainingExercise.scenario.comparisonResult.confidenceSpread.spread})`,
                          ],
                          [
                            "Highest risk",
                            trainingExercise.scenario.comparisonResult.highestRiskScenario?.name || "—",
                          ],
                          [
                            "Most stable",
                            trainingExercise.scenario.comparisonResult.mostStableScenario?.name || "—",
                          ],
                        ]}
                      />
                    ) : trainingExercise.scenario.simulationResult?.simulatedRegime ? (
                      <KeyValueGrid
                        entries={[
                          [
                            "Regime",
                            humanize(trainingExercise.scenario.simulationResult.simulatedRegime.regime),
                          ],
                          [
                            "Outlook",
                            humanize(trainingExercise.scenario.simulationResult.simulatedOutlook?.outlook),
                          ],
                          [
                            "Confidence",
                            `${trainingExercise.scenario.simulationResult.confidence ?? "—"}/100`,
                          ],
                          [
                            "Command",
                            humanize(
                              trainingExercise.scenario.simulationResult.simulatedCommandCenter?.commandStatus,
                            ),
                          ],
                        ]}
                      />
                    ) : trainingExercise.scenario.failureResult ? (
                      <KeyValueGrid
                        entries={[
                          ["Advisory stability", humanize(trainingExercise.scenario.failureResult.advisoryStability)],
                          [
                            "Confidence before",
                            `${trainingExercise.scenario.failureResult.confidenceImpact?.before ?? "—"}/100`,
                          ],
                          [
                            "Confidence after",
                            `${trainingExercise.scenario.failureResult.confidenceImpact?.after ?? "—"}/100`,
                          ],
                          ["Operator risk", trainingExercise.scenario.failureResult.operatorRisk || "—"],
                        ]}
                      />
                    ) : null}
                  </div>
                </>
              ) : null}

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Expected findings</p>
              <ul style={treasuryListStyle}>
                {trainingExercise.expectedFindings.map((finding) => (
                  <li key={finding} style={treasuryListItemStyle}>
                    {finding}
                  </li>
                ))}
              </ul>

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>
                Operator reflection prompts (read-only — not stored)
              </p>
              <ol style={{ margin: "0.35rem 0 0", paddingLeft: "1.25rem", display: "grid", gap: "0.45rem" }}>
                {trainingExercise.operatorQuestions.map((question) => (
                  <li key={question} style={{ ...treasuryListItemStyle, color: "#475569", fontStyle: "italic" }}>
                    {question}
                  </li>
                ))}
              </ol>

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Self-assessment scoring guide</p>
              <ul style={treasuryListStyle}>
                {trainingExercise.scoringGuide.map((item) => (
                  <li key={item} style={treasuryListItemStyle}>
                    {item}
                  </li>
                ))}
              </ul>

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Exercise summary</p>
              <p style={treasurySummaryTextStyle}>{trainingExercise.summary}</p>

              <div
                style={{
                  ...treasuryPanelHighlightStyle,
                  marginTop: "0.85rem",
                  borderColor: "#86efac",
                  background: "#ecfdf5",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#166534", lineHeight: 1.45 }}>
                  Self-guided training only. No answers saved, no grades persisted, no database writes, and no
                  financial flows touched.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div style={trainingModuleGridStyle}>
                {TREASURY_TRAINING_MODULES.map((mod) => (
                  <div key={mod.id} style={trainingModuleCardStyle}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
                      <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>{mod.title}</strong>
                      <span style={difficultyBadgeStyle(mod.difficulty)}>{mod.difficulty}</span>
                      <span style={categoryBadgeStyle}>{mod.category}</span>
                    </div>
                    <p style={{ ...treasurySummaryTextStyle, margin: 0, fontSize: "0.78rem", flex: 1 }}>
                      {briefingExcerpt(mod.briefing)}
                    </p>
                    <button
                      type="button"
                      className={treasuryFocusRingClass}
                      style={{ ...btnPrimary, marginTop: "0.25rem", alignSelf: "flex-start" }}
                      onClick={() => handleStartTrainingExercise(mod.id)}
                    >
                      Start Exercise
                    </button>
                  </div>
                ))}
              </div>
              <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem", fontSize: "0.78rem", color: "#64748b" }}>
                {TREASURY_TRAINING_MODULES.length} training modules — session state only. Select Start Exercise to run
                linked simulation context inline.
              </p>
            </>
          )}
        </PanelSection>

        <PanelSection
          title="Treasury Certification Exams"
          intro="Self-guided certification prep exams and printable assessment packs. Paper mode only — no answer storage, no score tracking, no live credentialing."
        >
          <div style={{ ...treasuryPanelHighlightStyle, borderColor: "#bfdbfe", background: "#eff6ff" }}>
            <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#1d4ed8" }}>
              Certification exam mode — simulation only, read-only, advisory.
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#1e40af", lineHeight: 1.45 }}>
              Exams and assessment packs are generated on demand. Complete responses offline and self-grade using the
              answer and grading guides. No input fields, no persistence, no financial mutations.
            </p>
          </div>

          {certError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{certError}</p>
          ) : null}

          {certView === "exam" && certExam && activeCertExamId ? (
            <div style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
                <strong style={{ color: "#0f172a", fontSize: "1rem" }}>{certExam.title}</strong>
                <span style={difficultyBadgeStyle(certExam.difficulty)}>{certExam.difficulty}</span>
                <span style={categoryBadgeStyle}>{certExam.level}</span>
                <span style={categoryBadgeStyle}>{certExam.duration}</span>
                <span style={postureBadgeStyle("monitored")}>Pass: {certExam.passingScore}/100</span>
              </div>

              <button
                type="button"
                className={treasuryFocusRingClass}
                style={{ ...btnSecondary, marginBottom: "0.85rem" }}
                onClick={handleBackToCertExams}
              >
                Back to Certification Exams
              </button>

              <p style={{ ...treasurySummaryLabelStyle, margin: "0 0 0.35rem" }}>Scenarios</p>
              {certExam.scenarios.map((scenario) => (
                <div key={scenario.label} style={{ ...stepCardStyle, marginTop: "0.5rem" }}>
                  <p style={{ ...treasurySummaryTextStyle, fontWeight: 600, color: "#0f172a", marginTop: 0 }}>
                    {scenario.label}
                  </p>
                  <p style={{ ...treasurySummaryTextStyle, margin: "0.35rem 0 0", fontSize: "0.78rem" }}>
                    {scenario.name}
                  </p>
                  <p style={{ ...treasurySummaryTextStyle, margin: "0.5rem 0 0", fontSize: "0.78rem" }}>
                    {scenario.briefing}
                  </p>
                  {scenario.keyOutputs ? (
                    <KeyValueGrid
                      entries={Object.entries(scenario.keyOutputs).map(([key, value]) => [key, value])}
                    />
                  ) : null}
                </div>
              ))}

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>
                Questions (read-only prompts — respond offline)
              </p>
              <ol style={{ margin: "0.35rem 0 0", paddingLeft: "1.25rem", display: "grid", gap: "0.45rem" }}>
                {certExam.questions.map((question) => (
                  <li key={question} style={{ ...treasuryListItemStyle, color: "#475569" }}>
                    {question}
                  </li>
                ))}
              </ol>

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Expected findings</p>
              <ul style={treasuryListStyle}>
                {certExam.expectedFindings.map((finding) => (
                  <li key={finding} style={treasuryListItemStyle}>
                    {finding}
                  </li>
                ))}
              </ul>

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Scoring rubric</p>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Criterion</th>
                      <th style={thStyle}>Points</th>
                      <th style={thStyle}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {certExam.scoringRubric.map((row) => (
                      <tr key={row.criterion}>
                        <td style={tdStyle}>{row.criterion}</td>
                        <td style={tdStyle}>{row.points}</td>
                        <td style={tdStyle}>{row.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Exam summary</p>
              <p style={treasurySummaryTextStyle}>{certExam.summary}</p>

              <div
                style={{
                  ...treasuryPanelHighlightStyle,
                  marginTop: "0.85rem",
                  borderColor: "#86efac",
                  background: "#ecfdf5",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#166534", lineHeight: 1.45 }}>
                  Self-guided certification prep only. No answers saved, no scores persisted, no database writes, and
                  no financial flows touched.
                </p>
              </div>
            </div>
          ) : certView === "pack" && certAssessmentPack && activeCertExamId ? (
            <div style={{ marginTop: "1rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
                <strong style={{ color: "#0f172a", fontSize: "1rem" }}>Assessment Pack</strong>
                <span style={categoryBadgeStyle}>
                  {TREASURY_CERTIFICATION_EXAMS.find((e) => e.id === activeCertExamId)?.level || activeCertExamId}
                </span>
              </div>

              <button
                type="button"
                className={treasuryFocusRingClass}
                style={{ ...btnSecondary, marginBottom: "0.5rem" }}
                onClick={handleBackToCertExams}
              >
                Back to Certification Exams
              </button>
              <button
                type="button"
                className={treasuryFocusRingClass}
                style={{ ...btnPrimary, marginBottom: "0.85rem", marginLeft: "0.5rem" }}
                onClick={handleCopyAssessmentPack}
              >
                Copy Assessment Pack
              </button>

              <p style={{ ...treasurySummaryLabelStyle, margin: "0 0 0.35rem" }}>Printable assessment pack preview</p>
              <pre style={reportPreStyle}>{certAssessmentPack.packText}</pre>

              <div
                style={{
                  ...treasuryPanelHighlightStyle,
                  marginTop: "0.85rem",
                  borderColor: "#86efac",
                  background: "#ecfdf5",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#166534", lineHeight: 1.45 }}>
                  Copy or print for offline completion. No submission endpoint — self-grade using the embedded answer
                  and grading guides.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div style={trainingModuleGridStyle}>
                {certificationExams.map((exam) => (
                  <div key={exam.id} style={trainingModuleCardStyle}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
                      <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>{exam.level}</strong>
                      <span style={difficultyBadgeStyle(exam.difficulty)}>{exam.difficulty}</span>
                    </div>
                    <p style={{ ...treasurySummaryTextStyle, margin: "0.35rem 0 0", fontSize: "0.78rem" }}>
                      {exam.durationMinutes} min · {exam.scenarioRefs.length} scenarios · {exam.questionTemplates.length}{" "}
                      questions · pass {exam.passingScore}/100
                    </p>
                    <p style={{ ...treasurySummaryTextStyle, margin: 0, fontSize: "0.78rem", flex: 1 }}>
                      {briefingExcerpt(exam.summary)}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.25rem" }}>
                      <button
                        type="button"
                        className={treasuryFocusRingClass}
                        style={{ ...btnPrimary }}
                        onClick={() => handleGenerateCertExam(exam.id)}
                      >
                        Generate Exam
                      </button>
                      <button
                        type="button"
                        className={treasuryFocusRingClass}
                        style={{ ...btnSecondary }}
                        onClick={() => handleGenerateAssessmentPack(exam.id)}
                      >
                        Generate Assessment Pack
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem", fontSize: "0.78rem", color: "#64748b" }}>
                {certificationExams.length} certification levels — session state only. Generate exams or printable packs
                for offline self-assessment.
              </p>
            </>
          )}
        </PanelSection>

        <PanelSection
          title="Treasury Manual Generator"
          intro="Generate synthetic treasury operations manuals and procedure guides for operator training. Paper mode only — read-only, advisory, in-memory."
        >
          <div style={{ ...treasuryPanelHighlightStyle, borderColor: "#bfdbfe", background: "#eff6ff" }}>
            <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 600, color: "#1d4ed8" }}>
              Manual generator — simulation only, read-only, advisory.
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#1e40af", lineHeight: 1.45 }}>
              Manuals and procedure guides are assembled from lab knowledge in memory. No database writes, file
              downloads, localStorage, notifications, alerts, or financial mutations.
            </p>
          </div>

          <label htmlFor="manual-section-select" style={{ ...treasurySummaryLabelStyle, display: "block", marginTop: "1rem" }}>
            Manual section focus
          </label>
          <select
            id="manual-section-select"
            className={treasuryFocusRingClass}
            value={manualSectionId}
            onChange={(e) => setManualSectionId(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Sections</option>
            {manualSections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>

          <label htmlFor="manual-procedure-select" style={{ ...treasurySummaryLabelStyle, display: "block", marginTop: "1rem" }}>
            Procedure
          </label>
          <select
            id="manual-procedure-select"
            className={treasuryFocusRingClass}
            value={manualProcedureId}
            onChange={(e) => setManualProcedureId(e.target.value)}
            style={selectStyle}
          >
            {treasuryProcedures.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1rem" }}>
            <button
              type="button"
              className={treasuryFocusRingClass}
              style={btnPrimary}
              onClick={handleGenerateFullManual}
            >
              Generate Full Manual
            </button>
            <button
              type="button"
              className={treasuryFocusRingClass}
              style={btnSecondary}
              onClick={handleGenerateProcedureGuide}
            >
              Generate Procedure Guide
            </button>
          </div>

          {manualError ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>{manualError}</p>
          ) : null}

          {treasuryManual ? (
            <div style={{ marginTop: "1.25rem" }}>
              <p style={{ ...treasurySummaryLabelStyle, margin: "0 0 0.35rem" }}>Executive Summary</p>
              <p style={treasurySummaryTextStyle}>{treasuryManual.executiveSummary}</p>

              {focusedManualSection ? (
                <div
                  style={{
                    ...treasuryPanelHighlightStyle,
                    marginTop: "0.85rem",
                    borderColor: "#fde68a",
                    background: "#fffbeb",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "0.82rem", fontWeight: 700, color: "#b45309" }}>
                    Focus section: {focusedManualSection.title}
                  </p>
                  <p style={{ ...treasurySummaryTextStyle, margin: "0.5rem 0 0" }}>{focusedManualSection.summary}</p>
                  <p style={{ ...treasurySummaryTextStyle, margin: "0.65rem 0 0", whiteSpace: "pre-wrap" }}>
                    {focusedManualSection.content}
                  </p>
                  <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.65rem" }}>Section operator guidance</p>
                  <ul style={treasuryListStyle}>
                    {focusedManualSection.operatorGuidance.map((g) => (
                      <li key={g} style={treasuryListItemStyle}>
                        {g}
                      </li>
                    ))}
                  </ul>
                  <p style={{ ...treasurySummaryTextStyle, marginTop: "0.5rem", fontSize: "0.78rem" }}>
                    Review cadence: {focusedManualSection.reviewCadence}
                  </p>
                </div>
              ) : null}

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Operator Guidance</p>
              <ul style={treasuryListStyle}>
                {treasuryManual.operatorGuidance.map((g) => (
                  <li key={g} style={treasuryListItemStyle}>
                    {g}
                  </li>
                ))}
              </ul>

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Review Cadence</p>
              {typeof treasuryManual.reviewCadence === "string" ? (
                <p style={treasurySummaryTextStyle}>{treasuryManual.reviewCadence}</p>
              ) : (
                <>
                  <p style={treasurySummaryTextStyle}>{treasuryManual.reviewCadence.daily}</p>
                  <p style={{ ...treasurySummaryTextStyle, marginTop: "0.5rem" }}>{treasuryManual.reviewCadence.weekly}</p>
                  <p style={{ ...treasurySummaryTextStyle, marginTop: "0.5rem" }}>{treasuryManual.reviewCadence.monthly}</p>
                  <p style={{ ...treasurySummaryTextStyle, marginTop: "0.5rem" }}>
                    {treasuryManual.reviewCadence.eventDriven}
                  </p>
                  <p style={{ ...treasurySummaryTextStyle, marginTop: "0.5rem", fontWeight: 600, color: "#334155" }}>
                    {treasuryManual.reviewCadence.summary}
                  </p>
                </>
              )}

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Escalation Rules</p>
              <ul style={treasuryListStyle}>
                {treasuryManual.escalationRules.map((rule) => (
                  <li key={rule} style={treasuryListItemStyle}>
                    {rule}
                  </li>
                ))}
              </ul>

              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Manual Preview</p>
              <button
                type="button"
                className={treasuryFocusRingClass}
                style={btnSecondary}
                onClick={handleCopyManual}
              >
                Copy Manual
              </button>
              <pre style={reportPreStyle}>{treasuryManual.manualPreviewText}</pre>
            </div>
          ) : null}

          {treasuryProcedureGuide ? (
            <div style={{ marginTop: treasuryManual ? "1.25rem" : "1.25rem" }}>
              <p style={{ ...treasurySummaryLabelStyle, margin: "0 0 0.35rem" }}>Procedure Preview</p>
              <p style={{ ...treasurySummaryTextStyle, fontWeight: 600, color: "#0f172a" }}>
                {treasuryProcedureGuide.procedureName}
              </p>
              <p style={{ ...treasurySummaryTextStyle, marginTop: "0.35rem" }}>{treasuryProcedureGuide.purpose}</p>
              <button
                type="button"
                className={treasuryFocusRingClass}
                style={{ ...btnSecondary, marginTop: "0.5rem" }}
                onClick={handleCopyProcedure}
              >
                Copy Procedure
              </button>
              <pre style={reportPreStyle}>{treasuryProcedureGuide.procedurePreviewText}</pre>
            </div>
          ) : null}

          <div
            style={{
              ...treasuryPanelHighlightStyle,
              marginTop: "0.85rem",
              borderColor: "#86efac",
              background: "#ecfdf5",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#166534", lineHeight: 1.45 }}>
              {manualSections.length} manual sections and {treasuryProcedures.length} standard procedures — session
              state only. Copy plain-text previews for offline reference; no persistence or production coupling.
            </p>
          </div>
        </PanelSection>

        {customResult ? (
          <>
            <PanelSection
              title="Custom scenario profile"
              intro={customResult.generatedProfile?.profileSummary}
            >
              <p style={{ ...treasurySummaryTextStyle, fontWeight: 600, color: "#0f172a", marginTop: 0 }}>
                {customResult.scenarioName}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginTop: "0.75rem" }}>
                {CUSTOM_BUILDER_FIELDS.map(({ key, label }) => (
                  <span key={key} style={levelBadgeStyle(customResult.generatedProfile?.[key])}>
                    {label}: {humanize(customResult.generatedProfile?.[key] || "moderate")}
                  </span>
                ))}
              </div>
            </PanelSection>

            <PanelSection title="Custom scenario validation" intro="Deterministic validation scoring for the composed synthetic profile.">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
                <span style={gradeBadgeStyle(customResult.validationGrade)}>
                  Grade {customResult.validationGrade}
                </span>
                <span style={postureBadgeStyle("monitored")}>
                  Validation {customResult.validationScore}/100
                </span>
              </div>
              <p style={{ ...treasurySummaryTextStyle, fontWeight: 600, color: "#334155" }}>
                {customResult.robustnessAssessment}
              </p>
              <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem" }}>{customResult.summary}</p>
            </PanelSection>

            <PanelSection title="Custom scenario recommendations" intro="Institutional advisory notes from the custom scenario run.">
              <ul style={treasuryListStyle}>
                {customResult.recommendations.map((rec) => (
                  <li key={rec} style={treasuryListItemStyle}>
                    {rec}
                  </li>
                ))}
              </ul>
            </PanelSection>

            {customResult.simulationResult ? (
              <PanelSection
                title="Custom scenario simulation outputs"
                intro="Compact advisory posture from the custom-built synthetic profile."
              >
                <KeyValueGrid
                  entries={[
                    ["Command status", humanize(customResult.simulationResult.simulatedCommandCenter?.commandStatus)],
                    ["Regime", humanize(customResult.simulationResult.simulatedRegime?.regime)],
                    ["Outlook", humanize(customResult.simulationResult.simulatedOutlook?.outlook)],
                    ["Confidence", `${customResult.simulationResult.confidence}/100`],
                  ]}
                />
                {customResult.simulationResult.simulatedRecommendations?.length > 0 ? (
                  <>
                    <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Top recommendations</p>
                    <ul style={treasuryListStyle}>
                      {customResult.simulationResult.simulatedRecommendations.slice(0, 4).map((rec) => (
                        <li key={rec} style={treasuryListItemStyle}>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </PanelSection>
            ) : null}

            <div style={{ ...treasuryPanelHighlightStyle, marginBottom: "1.25rem", borderColor: "#bfdbfe", background: "#eff6ff" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#1d4ed8" }}>
                Custom scenario builder only. No production treasury data is changed.
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#1e40af", lineHeight: 1.45 }}>
                Composed synthetic profile in paper mode — results held in session state only. No database writes,
                wallets, payouts, withdrawals, or operational events.
              </p>
            </div>
          </>
        ) : null}

        {monteCarloResult ? (
          <>
            <PanelSection
              title="Monte Carlo stability summary"
              intro={`Base scenario: ${monteCarloResult.baseScenarioName} — ${monteCarloResult.iterationsRun} iterations`}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
                <span style={gradeBadgeStyle(monteCarloResult.robustnessGrade)}>
                  Robustness grade {monteCarloResult.robustnessGrade}
                </span>
                <span style={postureBadgeStyle(monteCarloResult.recommendationVolatility)}>
                  Recommendation volatility: {humanize(monteCarloResult.recommendationVolatility)}
                </span>
              </div>
              <KeyValueGrid
                entries={[
                  ["Iterations run", String(monteCarloResult.iterationsRun)],
                  ["Average stability", `${monteCarloResult.averageStabilityScore}/100`],
                  ["Average confidence", String(monteCarloResult.averageConfidence)],
                  ["Average coherence", String(monteCarloResult.averageCoherence)],
                  ["Average trust", String(monteCarloResult.averageTrust)],
                  [
                    "Stability distribution",
                    `Excellent ${monteCarloResult.stabilityDistribution.excellent}, stable ${monteCarloResult.stabilityDistribution.stable}, moderate ${monteCarloResult.stabilityDistribution.moderate}, weak ${monteCarloResult.stabilityDistribution.weak}, unstable ${monteCarloResult.stabilityDistribution.unstable}`,
                  ],
                ]}
              />
              <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem", fontWeight: 600, color: "#334155" }}>
                {monteCarloResult.summary}
              </p>
            </PanelSection>

            <PanelSection title="Strongest & weakest iterations" intro="Extreme Monte Carlo runs by stability score.">
              <KeyValueGrid
                entries={[
                  [
                    "Strongest iteration",
                    monteCarloResult.strongestIteration
                      ? `#${monteCarloResult.strongestIteration.iteration} — ${monteCarloResult.strongestIteration.stabilityScore}/100`
                      : "—",
                  ],
                  [
                    "Weakest iteration",
                    monteCarloResult.weakestIteration
                      ? `#${monteCarloResult.weakestIteration.iteration} — ${monteCarloResult.weakestIteration.stabilityScore}/100`
                      : "—",
                  ],
                ]}
              />
              {monteCarloResult.strongestIteration ? (
                <>
                  <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Strongest perturbation</p>
                  <p style={treasurySummaryTextStyle}>{monteCarloResult.strongestIteration.perturbationSummary}</p>
                  <p style={{ ...treasurySummaryTextStyle, marginTop: "0.35rem" }}>
                    {monteCarloResult.strongestIteration.notes}
                  </p>
                </>
              ) : null}
              {monteCarloResult.weakestIteration ? (
                <>
                  <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Weakest perturbation</p>
                  <p style={treasurySummaryTextStyle}>{monteCarloResult.weakestIteration.perturbationSummary}</p>
                  <p style={{ ...treasurySummaryTextStyle, marginTop: "0.35rem" }}>
                    {monteCarloResult.weakestIteration.notes}
                  </p>
                </>
              ) : null}
            </PanelSection>

            {monteCarloResult.findings?.length > 0 ? (
              <PanelSection title="Monte Carlo findings" intro="Key observations from the advisory stability sweep.">
                <ul style={treasuryListStyle}>
                  {monteCarloResult.findings.map((finding) => (
                    <li key={finding} style={treasuryListItemStyle}>
                      {finding}
                    </li>
                  ))}
                </ul>
              </PanelSection>
            ) : null}

            <PanelSection title="Monte Carlo recommendations" intro="Advisory robustness notes from the stability sweep.">
              <ul style={treasuryListStyle}>
                {monteCarloResult.recommendations.map((rec) => (
                  <li key={rec} style={treasuryListItemStyle}>
                    {rec}
                  </li>
                ))}
              </ul>
            </PanelSection>

            <PanelSection title="Monte Carlo result table" intro="Per-iteration stability metrics against baseline advisory outputs.">
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Iteration</th>
                      <th style={thStyle}>Stability</th>
                      <th style={thStyle}>Confidence</th>
                      <th style={thStyle}>Coherence</th>
                      <th style={thStyle}>Trust</th>
                      <th style={thStyle}>Recs changed</th>
                      <th style={thStyle}>Perturbation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monteCarloResult.resultRows.map((row) => (
                      <tr key={row.iteration}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: "#0f172a" }}>{row.iteration}</td>
                        <td style={tdStyle}>{row.stabilityScore}/100</td>
                        <td style={tdStyle}>{row.confidence}</td>
                        <td style={tdStyle}>{row.coherence}</td>
                        <td style={tdStyle}>{row.trust}</td>
                        <td style={tdStyle}>{row.recommendationChanged ? "Yes" : "No"}</td>
                        <td style={tdStyle}>{row.perturbationSummary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PanelSection>

            <div style={{ ...treasuryPanelHighlightStyle, marginBottom: "1.25rem", borderColor: "#bfdbfe", background: "#eff6ff" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#1d4ed8" }}>
                Monte Carlo testing only. No production treasury data is changed.
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#1e40af", lineHeight: 1.45 }}>
                Seeded random perturbation overlay in paper mode — results held in session state only. No database writes,
                wallets, payouts, withdrawals, or operational events.
              </p>
            </div>
          </>
        ) : null}

        {sensitivityResult ? (
          <>
            <PanelSection
              title="Sensitivity test summary"
              intro={`Base scenario: ${sensitivityResult.baseScenarioName} — ${humanize(sensitivityResult.perturbationLevel)} perturbation`}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
                <span style={gradeBadgeStyle(sensitivityResult.robustnessGrade)}>
                  Robustness grade {sensitivityResult.robustnessGrade}
                </span>
                <span style={postureBadgeStyle(sensitivityResult.recommendationShift)}>
                  Recommendation shift: {humanize(sensitivityResult.recommendationShift)}
                </span>
              </div>
              <KeyValueGrid
                entries={[
                  ["Stability score", `${sensitivityResult.stabilityScore}/100`],
                  ["Confidence shift (avg)", String(sensitivityResult.confidenceShift)],
                  ["Coherence shift (avg)", String(sensitivityResult.coherenceShift)],
                  ["Advisory drift change (avg)", String(sensitivityResult.advisoryDriftChange)],
                  ["Trust shift (avg)", String(sensitivityResult.trustShift)],
                ]}
              />
              <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem", fontWeight: 600, color: "#334155" }}>
                {sensitivityResult.sensitivitySummary}
              </p>
            </PanelSection>

            <PanelSection title="Sensitivity recommendations" intro="Advisory notes on robustness under synthetic perturbation.">
              <ul style={treasuryListStyle}>
                {sensitivityResult.recommendations.map((rec) => (
                  <li key={rec} style={treasuryListItemStyle}>
                    {rec}
                  </li>
                ))}
              </ul>
            </PanelSection>

            <PanelSection title="Sensitivity result table" intro="Per-variation comparison against baseline advisory outputs.">
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Variation</th>
                      <th style={thStyle}>Perturbation applied</th>
                      <th style={thStyle}>Validation</th>
                      <th style={thStyle}>Confidence Δ</th>
                      <th style={thStyle}>Recs changed</th>
                      <th style={thStyle}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensitivityResult.resultRows.map((row) => (
                      <tr key={row.variationLabel}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: "#0f172a" }}>{row.variationLabel}</td>
                        <td style={tdStyle}>{row.perturbationApplied}</td>
                        <td style={tdStyle}>
                          {row.validationScore != null ? `${row.validationScore}/100` : "—"}
                        </td>
                        <td style={tdStyle}>{row.confidenceDelta}</td>
                        <td style={tdStyle}>{row.recommendationChanged ? "Yes" : "No"}</td>
                        <td style={tdStyle}>{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PanelSection>

            <div style={{ ...treasuryPanelHighlightStyle, marginBottom: "1.25rem", borderColor: "#bfdbfe", background: "#eff6ff" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#1d4ed8" }}>
                Sensitivity testing only. No production treasury data is changed.
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#1e40af", lineHeight: 1.45 }}>
                Controlled perturbation overlay in paper mode — results held in session state only. No database writes,
                wallets, payouts, withdrawals, or operational events.
              </p>
            </div>
          </>
        ) : null}

        {regressionSuiteResult ? (
          <>
            <PanelSection
              title="Regression suite summary"
              intro="Aggregated validation and safety posture across all synthetic runs."
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
                <span style={gradeBadgeStyle(regressionSuiteResult.regressionGrade)}>
                  Regression grade {regressionSuiteResult.regressionGrade}
                </span>
              </div>
              <KeyValueGrid
                entries={[
                  ["Average validation score", `${regressionSuiteResult.averageValidationScore}/100`],
                  ["Average safety score", `${regressionSuiteResult.averageSafetyScore}/100`],
                  [
                    "Weakest scenario",
                    regressionSuiteResult.weakestScenario
                      ? `${regressionSuiteResult.weakestScenario.scenarioName} — ${regressionSuiteResult.weakestScenario.validationScore}/100 (grade ${regressionSuiteResult.weakestScenario.validationGrade})`
                      : "—",
                  ],
                  [
                    "Strongest scenario",
                    regressionSuiteResult.strongestScenario
                      ? `${regressionSuiteResult.strongestScenario.scenarioName} — ${regressionSuiteResult.strongestScenario.validationScore}/100 (grade ${regressionSuiteResult.strongestScenario.validationGrade})`
                      : "—",
                  ],
                  [
                    "Weakest failure mode",
                    regressionSuiteResult.weakestFailureMode
                      ? `${regressionSuiteResult.weakestFailureMode.modeName} — ${regressionSuiteResult.weakestFailureMode.validationScore}/100 (grade ${regressionSuiteResult.weakestFailureMode.validationGrade})`
                      : "—",
                  ],
                ]}
              />
              <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem", fontWeight: 600, color: "#334155" }}>
                {regressionSuiteResult.summary}
              </p>
            </PanelSection>

            {regressionSuiteResult.issuesDetected?.length > 0 ? (
              <PanelSection title="Issues detected" intro="Validation or safety concerns surfaced during regression scoring.">
                <ul style={treasuryListStyle}>
                  {regressionSuiteResult.issuesDetected.map((issue) => (
                    <li key={issue} style={treasuryListItemStyle}>
                      {issue}
                    </li>
                  ))}
                </ul>
              </PanelSection>
            ) : null}

            {regressionSuiteResult.strengths?.length > 0 ? (
              <PanelSection title="Strengths" intro="High-scoring runs and suite-level advisory alignment signals.">
                <ul style={treasuryListStyle}>
                  {regressionSuiteResult.strengths.map((strength) => (
                    <li key={strength} style={treasuryListItemStyle}>
                      {strength}
                    </li>
                  ))}
                </ul>
              </PanelSection>
            ) : null}

            <PanelSection title="Recommendations" intro="Advisory guidance for maintaining lab health and validation quality.">
              <ul style={treasuryListStyle}>
                {regressionSuiteResult.recommendations.map((rec) => (
                  <li key={rec} style={treasuryListItemStyle}>
                    {rec}
                  </li>
                ))}
              </ul>
            </PanelSection>

            <PanelSection title="Regression result table" intro="Per-run validation and safety scores for all scenarios and failure modes.">
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Validation Score</th>
                      <th style={thStyle}>Grade</th>
                      <th style={thStyle}>Safety Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {regressionSuiteResult.scenarioResults.map((row) => (
                      <tr key={row.scenarioId}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: "#0f172a" }}>{row.scenarioName}</td>
                        <td style={tdStyle}>Scenario</td>
                        <td style={tdStyle}>{row.score.validationScore}/100</td>
                        <td style={tdStyle}>
                          <span style={gradeBadgeStyle(row.score.validationGrade)}>{row.score.validationGrade}</span>
                        </td>
                        <td style={tdStyle}>{row.score.safetyScore}/100</td>
                      </tr>
                    ))}
                    {regressionSuiteResult.failureResults.map((row) => (
                      <tr key={row.mode}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: "#0f172a" }}>{row.modeName}</td>
                        <td style={tdStyle}>Failure</td>
                        <td style={tdStyle}>{row.score.validationScore}/100</td>
                        <td style={tdStyle}>
                          <span style={gradeBadgeStyle(row.score.validationGrade)}>{row.score.validationGrade}</span>
                        </td>
                        <td style={tdStyle}>{row.score.safetyScore}/100</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PanelSection>

            <div style={{ ...treasuryPanelHighlightStyle, marginBottom: "1.25rem", borderColor: "#bfdbfe", background: "#eff6ff" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#1d4ed8" }}>
                Regression suite only. No production treasury data is changed.
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#1e40af", lineHeight: 1.45 }}>
                Full regression scoring in paper mode — results held in session state only. No database writes, wallets,
                payouts, withdrawals, or operational events.
              </p>
            </div>
          </>
        ) : null}

        {auditPack ? (
          <>
            <PanelSection
              title="Audit executive summary"
              intro={auditPack.title}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
                <span style={gradeBadgeStyle(auditPack.auditGrade)}>
                  Audit grade {auditPack.auditGrade}
                </span>
                {auditReviewPack ? (
                  <span style={qualityBadgeStyle("adequate")}>{auditReviewPack.reviewType}</span>
                ) : null}
              </div>
              <p style={{ ...treasurySummaryTextStyle, fontWeight: 600, color: "#334155" }}>
                {auditPack.executiveSummary}
              </p>
            </PanelSection>

            {auditPack.strengths?.length > 0 ? (
              <PanelSection title="Audit strengths" intro="Positive advisory alignment signals identified during the audit.">
                <ul style={treasuryListStyle}>
                  {auditPack.strengths.map((item) => (
                    <li key={item} style={treasuryListItemStyle}>
                      {item}
                    </li>
                  ))}
                </ul>
              </PanelSection>
            ) : null}

            {auditPack.weaknesses?.length > 0 ? (
              <PanelSection title="Audit weaknesses" intro="Areas requiring paper-mode reconciliation before institutional sharing.">
                <ul style={treasuryListStyle}>
                  {auditPack.weaknesses.map((item) => (
                    <li key={item} style={treasuryListItemStyle}>
                      {item}
                    </li>
                  ))}
                </ul>
              </PanelSection>
            ) : null}

            <PanelSection title="Audit recommendations" intro="Advisory guidance from the audit pack — no operational action implied.">
              <ul style={treasuryListStyle}>
                {auditPack.recommendations.map((rec) => (
                  <li key={rec} style={treasuryListItemStyle}>
                    {rec}
                  </li>
                ))}
              </ul>
            </PanelSection>

            {auditReviewPack?.riskThemes?.length > 0 ? (
              <PanelSection title="Risk themes" intro="Cross-cutting risk themes from the companion review pack.">
                <ul style={treasuryListStyle}>
                  {auditReviewPack.riskThemes.map((theme) => (
                    <li key={theme} style={treasuryListItemStyle}>
                      {theme}
                    </li>
                  ))}
                </ul>
              </PanelSection>
            ) : null}

            <PanelSection title="Scenarios reviewed" intro="Synthetic entries scored during the audit run.">
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Name</th>
                      <th style={thStyle}>Type</th>
                      <th style={thStyle}>Score</th>
                      <th style={thStyle}>Grade</th>
                      <th style={thStyle}>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditPack.scenariosReviewed.map((row) => (
                      <tr key={`${row.type}-${row.name}`}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: "#0f172a" }}>{row.name}</td>
                        <td style={tdStyle}>{humanize(row.type)}</td>
                        <td style={tdStyle}>
                          {row.validationScore != null ? `${row.validationScore}/100` : "—"}
                        </td>
                        <td style={tdStyle}>
                          {row.grade ? (
                            <span style={gradeBadgeStyle(row.grade)}>{row.grade}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={tdStyle}>{row.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PanelSection>

            <PanelSection title="Audit preview" intro="Plain-text audit report suitable for clipboard export.">
              <button
                type="button"
                className={treasuryFocusRingClass}
                style={{ ...btnSecondary, marginBottom: "0.65rem" }}
                onClick={handleCopyAuditReport}
              >
                Copy Audit Report
              </button>
              <pre style={reportPreStyle}>{auditPack.auditPreviewText}</pre>
            </PanelSection>

            {auditReviewPack ? (
              <PanelSection title="Review preview" intro="Plain-text review report suitable for clipboard export.">
                <button
                  type="button"
                  className={treasuryFocusRingClass}
                  style={{ ...btnSecondary, marginBottom: "0.65rem" }}
                  onClick={handleCopyReviewReport}
                >
                  Copy Review Report
                </button>
                <pre style={reportPreStyle}>{auditReviewPack.reviewPreviewText}</pre>
              </PanelSection>
            ) : null}

            <div style={{ ...treasuryPanelHighlightStyle, marginBottom: "1.25rem", borderColor: "#bfdbfe", background: "#eff6ff" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#1d4ed8" }}>
                Audit & review only. No production treasury data is changed.
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#1e40af", lineHeight: 1.45 }}>
                Paper-mode audit and review packs — results held in session state only. No database writes, file
                downloads, localStorage, wallets, payouts, withdrawals, or operational events.
              </p>
            </div>
          </>
        ) : null}

        {warRoomResult ? (
          <>
            <PanelSection
              title="War room summary"
              intro={`${warRoomResult.scenarioName} — crisis rehearsal (paper mode)`}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
                <span style={crisisLevelBadgeStyle(warRoomResult.crisisLevel)}>
                  {warRoomResult.crisisLevelLabel}
                </span>
                <span style={categoryBadgeStyle}>
                  {humanize(warRoomResult.simulationContext?.contextType || "context")}
                </span>
              </div>
              <p style={{ ...treasurySummaryTextStyle, fontWeight: 600, color: "#334155" }}>{warRoomResult.summary}</p>
              <KeyValueGrid
                entries={[
                  ["Synthetic context", warRoomResult.simulationContext?.contextName || "—"],
                  ["Regime", warRoomResult.simulationContext?.regime || "—"],
                  ["Outlook", warRoomResult.simulationContext?.outlook || "—"],
                  ["Confidence", `${warRoomResult.simulationContext?.confidence ?? 0}/100`],
                ]}
              />
            </PanelSection>

            <PanelSection title="Crisis timeline" intro="Deterministic rehearsal timeline — time offset, phase, and advisory notes.">
              <div style={tableWrapStyle}>
                <table style={{ ...tableStyle, minWidth: "520px" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Time</th>
                      <th style={thStyle}>Phase</th>
                      <th style={thStyle}>Description</th>
                      <th style={thStyle}>Advisory note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {warRoomResult.timeline.map((row) => (
                      <tr key={`${row.timeOffset}-${row.eventType}-${row.sequence}`}>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap", fontWeight: 600 }}>{row.timeOffset}</td>
                        <td style={tdStyle}>{humanize(row.phase)}</td>
                        <td style={tdStyle}>{row.description}</td>
                        <td style={{ ...tdStyle, fontSize: "0.75rem", color: "#64748b" }}>{row.advisoryNote}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PanelSection>

            <PanelSection title="Event stream" intro="Chronological events relative to T+0 with severity and operator guidance.">
              <ul style={treasuryListStyle}>
                {warRoomResult.eventStream.map((evt) => (
                  <li key={`${evt.timestamp}-${evt.title}`} style={{ ...treasuryListItemStyle, marginBottom: "0.65rem" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center", marginBottom: "0.35rem" }}>
                      <span style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.8rem" }}>{evt.timestamp}</span>
                      <span style={eventSeverityBadgeStyle(evt.severity)}>{humanize(evt.severity)}</span>
                    </div>
                    <p style={{ margin: 0, fontWeight: 600, color: "#334155", fontSize: "0.82rem" }}>{evt.title}</p>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "0.78rem", color: "#475569", lineHeight: 1.45 }}>
                      {evt.detail}
                    </p>
                    {evt.operatorAction ? (
                      <p style={{ margin: "0.35rem 0 0", fontSize: "0.75rem", color: "#64748b", fontStyle: "italic" }}>
                        Operator: {evt.operatorAction}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </PanelSection>

            <PanelSection title="Operator objectives" intro="Rehearsal objectives scaled to selected crisis level.">
              <ul style={treasuryListStyle}>
                {warRoomResult.operatorObjectives.map((obj) => (
                  <li key={obj} style={treasuryListItemStyle}>
                    {obj}
                  </li>
                ))}
              </ul>
            </PanelSection>

            <PanelSection
              title="Response guidance"
              intro="Recommended responses and escalation points — advisory only, visibility escalation without execution."
            >
              <p style={{ ...treasurySummaryLabelStyle, marginTop: 0 }}>Recommended responses</p>
              <ul style={treasuryListStyle}>
                {warRoomResult.recommendedResponses.map((r) => (
                  <li key={r} style={treasuryListItemStyle}>
                    {r}
                  </li>
                ))}
              </ul>
              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Escalation points</p>
              <ul style={treasuryListStyle}>
                {warRoomResult.escalationPoints.map((p) => (
                  <li key={p} style={treasuryListItemStyle}>
                    {p}
                  </li>
                ))}
              </ul>
            </PanelSection>

            {warRoomReport ? (
              <PanelSection
                title="War room report"
                intro="Final assessment and lessons learned from crisis rehearsal — self-rehearsal framing, not a persisted grade."
              >
                <p style={{ ...treasurySummaryTextStyle, fontWeight: 600, color: "#334155" }}>
                  {warRoomReport.finalAssessment}
                </p>
                <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Lessons learned</p>
                <ul style={treasuryListStyle}>
                  {warRoomReport.lessonsLearned.map((lesson) => (
                    <li key={lesson} style={treasuryListItemStyle}>
                      {lesson}
                    </li>
                  ))}
                </ul>
                <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Report preview</p>
                <button
                  type="button"
                  className={treasuryFocusRingClass}
                  style={{ ...btnSecondary, marginBottom: "0.65rem" }}
                  onClick={handleCopyWarRoomReport}
                >
                  Copy War Room Report
                </button>
                <pre style={reportPreStyle}>{warRoomReport.reportText}</pre>
              </PanelSection>
            ) : null}

            <div style={{ ...treasuryPanelHighlightStyle, marginBottom: "1.25rem", borderColor: "#bfdbfe", background: "#eff6ff" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#1d4ed8" }}>
                War room rehearsal only. No production treasury data is changed.
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#1e40af", lineHeight: 1.45 }}>
                Crisis war room outputs are held in session state only. No database writes, wallets, payouts,
                withdrawals, alerts, scheduling, or operational events.
              </p>
            </div>
          </>
        ) : null}

        {failureResult ? (
          <>
            <PanelSection title="Failure test summary" intro={`Mode: ${failureResult.mode?.name || "Unknown"}`}>
              <p style={{ ...treasurySummaryTextStyle, fontWeight: 600, color: "#334155" }}>{failureResult.summary}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center" }}>
                <span style={treasurySummaryLabelStyle}>Reasoning stability:</span>
                <span style={postureBadgeStyle(failureResult.advisoryStability)}>
                  {humanize(failureResult.advisoryStability)}
                </span>
              </div>
            </PanelSection>

            {failureResult.findings?.length > 0 ? (
              <PanelSection title="Findings" intro="Key observations from the simulated stress test.">
                <ul style={treasuryListStyle}>
                  {failureResult.findings.map((f) => (
                    <li key={f} style={treasuryListItemStyle}>
                      {f}
                    </li>
                  ))}
                </ul>
              </PanelSection>
            ) : null}

            <PanelSection title="Contradictions detected" intro="Synthetic advisory contradictions surfaced by the stress test engine.">
              {failureResult.contradictions?.length > 0 ? (
                <ul style={treasuryListStyle}>
                  {failureResult.contradictions.map((c) => (
                    <li key={c} style={treasuryListItemStyle}>
                      {c}
                    </li>
                  ))}
                </ul>
              ) : (
                <p style={treasurySummaryTextStyle}>No contradictions detected in this stress test run.</p>
              )}
            </PanelSection>

            <PanelSection title="Confidence impact" intro="Simulated confidence spread across the stress test.">
              <KeyValueGrid
                entries={[
                  ["Before", `${failureResult.confidenceImpact?.before ?? "—"}/100`],
                  ["After", `${failureResult.confidenceImpact?.after ?? "—"}/100`],
                  ["Delta", `${failureResult.confidenceImpact?.delta >= 0 ? "+" : ""}${failureResult.confidenceImpact?.delta ?? "—"}`],
                ]}
              />
              {failureResult.confidenceImpact?.narrative ? (
                <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem" }}>
                  {failureResult.confidenceImpact.narrative}
                </p>
              ) : null}
            </PanelSection>

            <PanelSection title="Coherence impact" intro="Simulated coherence degradation signal.">
              <p style={treasurySummaryTextStyle}>{failureResult.coherenceImpact || "—"}</p>
            </PanelSection>

            <PanelSection title="Operator risk posture" intro="Calm institutional risk posture label for operators interpreting conflicting advisory.">
              <p style={{ ...treasurySummaryTextStyle, fontWeight: 600, color: "#0f172a" }}>
                {failureResult.operatorRisk || "—"}
              </p>
            </PanelSection>

            <PanelSection title="Operator recommendations" intro="How operators should interpret conflicting simulated advisory.">
              <ul style={treasuryListStyle}>
                {(failureResult.recommendations || []).map((r) => (
                  <li key={r} style={treasuryListItemStyle}>
                    {r}
                  </li>
                ))}
              </ul>
            </PanelSection>

            {failureValidationScore && failureValidationReport ? (
              <>
                <PanelSection
                  title="Failure test validation"
                  intro="Scores whether contradictions were detected while advisory remained calm and read-only."
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
                    <span style={gradeBadgeStyle(failureValidationScore.validationGrade)}>
                      Grade {failureValidationScore.validationGrade}
                    </span>
                    <span style={qualityBadgeStyle(failureValidationScore.reasoningQuality)}>
                      Reasoning: {humanize(failureValidationScore.reasoningQuality)}
                    </span>
                    <span style={qualityBadgeStyle(failureValidationScore.confidenceQuality)}>
                      Confidence: {humanize(failureValidationScore.confidenceQuality)}
                    </span>
                  </div>
                  <KeyValueGrid
                    entries={[
                      ["Validation score", `${failureValidationScore.validationScore}/100`],
                      ["Coherence score", `${failureValidationScore.coherenceScore}/100`],
                      ["Safety score", `${failureValidationScore.safetyScore}/100`],
                      ["Recommendation quality", humanize(failureValidationScore.recommendationQuality)],
                    ]}
                  />
                  <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem", fontWeight: 600, color: "#334155" }}>
                    {failureValidationScore.validationSummary}
                  </p>
                </PanelSection>

                {failureValidationScore.issuesDetected?.length > 0 ? (
                  <PanelSection title="Validation issues" intro="Issues detected during failure test scoring.">
                    <ul style={treasuryListStyle}>
                      {failureValidationScore.issuesDetected.map((issue) => (
                        <li key={issue} style={treasuryListItemStyle}>
                          {issue}
                        </li>
                      ))}
                    </ul>
                  </PanelSection>
                ) : null}

                <PanelSection title="Safety notes" intro="Read-only advisory safety assessment for the failure test run.">
                  <ul style={treasuryListStyle}>
                    {(failureValidationReport.safetyNotes || []).map((note) => (
                      <li key={note} style={treasuryListItemStyle}>
                        {note}
                      </li>
                    ))}
                  </ul>
                </PanelSection>

                <PanelSection
                  title="Failure test validation report"
                  intro="Plain-text report suitable for clipboard export."
                >
                  <button
                    type="button"
                    className={treasuryFocusRingClass}
                    style={btnSecondary}
                    onClick={() => copyReportText(failureValidationReport.reportText)}
                  >
                    Copy report
                  </button>
                  <pre style={reportPreStyle}>{failureValidationReport.reportText}</pre>
                </PanelSection>
              </>
            ) : null}

            <div style={{ ...treasuryPanelHighlightStyle, marginBottom: "1.25rem", borderColor: "#fde68a", background: "#fffbeb" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#b45309" }}>
                Stress test only. No production treasury data is changed.
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#92400e", lineHeight: 1.45 }}>
                Contradiction and failure testing validates advisory reasoning integrity in paper mode — no database
                writes, wallets, payouts, withdrawals, or operational events.
              </p>
            </div>
          </>
        ) : null}

        {timelineResult ? (
          <>
            <PanelSection title="Timeline summary" intro={timelineResult.timelineSummary}>
              <p style={{ ...treasurySummaryTextStyle, fontWeight: 600, color: "#334155" }}>{timelineResult.summary}</p>
            </PanelSection>

            <PanelSection title="Step-by-step progression" intro="Ordered synthetic scenarios with institutional narratives per step.">
              {timelineResult.steps.map((step, idx) => (
                <div key={step.scenario.id} style={stepCardStyle}>
                  <div style={stepCardHeaderStyle}>
                    <span style={postureBadgeStyle(step.simulatedResult.simulatedCommandCenter.commandStatus)}>
                      Step {idx + 1}
                    </span>
                    <strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>{step.scenario.name}</strong>
                    <span style={postureBadgeStyle(step.simulatedResult.simulatedCommandCenter.commandStatus)}>
                      {step.posture}
                    </span>
                  </div>
                  <p style={{ ...treasurySummaryTextStyle, margin: "0 0 0.65rem" }}>{step.stepNarrative}</p>
                  <KeyValueGrid
                    entries={[
                      ["Posture", step.posture],
                      ["Confidence", `${step.confidence}/100`],
                      ["Regime", step.regime],
                      ["Outlook", step.outlook],
                    ]}
                  />
                </div>
              ))}
            </PanelSection>

            <PanelSection title="Progression tracks" intro="Posture, confidence, regime, and outlook across timeline steps.">
              <p style={treasurySummaryLabelStyle}>Posture progression</p>
              <div style={progressionChipsWrap}>
                {timelineResult.postureProgression.map((p, i) => (
                  <span key={`posture-${i}-${p}`}>
                    {i > 0 ? <span style={progressionArrowStyle}> → </span> : null}
                    <span style={postureBadgeStyle(p.toLowerCase().replace(/ /g, "_"))}>{p}</span>
                  </span>
                ))}
              </div>
              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Confidence progression</p>
              <p style={treasurySummaryTextStyle}>{timelineResult.confidenceProgression.join(" → ")}</p>
              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Regime progression</p>
              <div style={progressionChipsWrap}>
                {timelineResult.regimeProgression.map((r, i) => (
                  <span key={`regime-${i}-${r}`}>
                    {i > 0 ? <span style={progressionArrowStyle}> → </span> : null}
                    <span style={postureBadgeStyle("monitored")}>{r}</span>
                  </span>
                ))}
              </div>
              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Outlook progression</p>
              <div style={progressionChipsWrap}>
                {timelineResult.outlookProgression.map((o, i) => (
                  <span key={`outlook-${i}-${o}`}>
                    {i > 0 ? <span style={progressionArrowStyle}> → </span> : null}
                    <span style={postureBadgeStyle("stable")}>{o}</span>
                  </span>
                ))}
              </div>
            </PanelSection>

            <PanelSection title="Timeline recommendations">
              <ul style={treasuryListStyle}>
                {timelineResult.recommendations.map((r) => (
                  <li key={r} style={treasuryListItemStyle}>
                    {r}
                  </li>
                ))}
              </ul>
            </PanelSection>

            <div style={{ ...treasuryPanelHighlightStyle, marginBottom: "1.25rem" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#0369a1" }}>
                Timeline simulation only. No production treasury data is changed.
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#475569", lineHeight: 1.45 }}>
                Multi-step stress drill in paper mode — no database writes, wallets, payouts, withdrawals, or operational
                events.
              </p>
            </div>
          </>
        ) : null}

        {comparisonResult ? (
          <>
            <PanelSection title="Comparison summary" intro={comparisonResult.comparisonSummary}>
              <KeyValueGrid
                entries={[
                  [
                    "Highest risk",
                    comparisonResult.highestRiskScenario
                      ? `${comparisonResult.highestRiskScenario.name} — ${comparisonResult.highestRiskScenario.reason}`
                      : "—",
                  ],
                  [
                    "Most stable",
                    comparisonResult.mostStableScenario
                      ? `${comparisonResult.mostStableScenario.name} — ${comparisonResult.mostStableScenario.reason}`
                      : "—",
                  ],
                  [
                    "Confidence spread",
                    `${comparisonResult.confidenceSpread.min} – ${comparisonResult.confidenceSpread.max} (Δ ${comparisonResult.confidenceSpread.spread})`,
                  ],
                ]}
              />
              <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem", fontWeight: 600, color: "#334155" }}>
                {comparisonResult.summary}
              </p>
            </PanelSection>

            <PanelSection title="Comparison table" intro="Side-by-side synthetic posture metrics across selected scenarios.">
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Scenario</th>
                      <th style={thStyle}>Command</th>
                      <th style={thStyle}>Regime</th>
                      <th style={thStyle}>Outlook</th>
                      <th style={thStyle}>Confidence</th>
                      <th style={thStyle}>Attention</th>
                      <th style={thStyle}>Recs</th>
                      <th style={thStyle}>Trace steps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparisonResult.comparisonRows.map((row) => (
                      <tr key={row.scenarioName}>
                        <td style={{ ...tdStyle, fontWeight: 600, color: "#0f172a" }}>{row.scenarioName}</td>
                        <td style={tdStyle}>{humanize(row.commandStatus)}</td>
                        <td style={tdStyle}>{humanize(row.regime)}</td>
                        <td style={tdStyle}>{humanize(row.outlook)}</td>
                        <td style={tdStyle}>{row.confidence}/100</td>
                        <td style={tdStyle}>{humanize(row.attentionLevel)}</td>
                        <td style={tdStyle}>{row.recommendationCount}</td>
                        <td style={tdStyle}>{row.traceStepCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PanelSection>

            <PanelSection title="Recommendation differences">
              <ul style={treasuryListStyle}>
                {comparisonResult.recommendationDifferences.map((diff) => (
                  <li key={diff} style={treasuryListItemStyle}>
                    {diff}
                  </li>
                ))}
              </ul>
            </PanelSection>

            <div style={{ ...treasuryPanelHighlightStyle, marginBottom: "1.25rem" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#0369a1" }}>
                Comparison only. No production treasury data is changed.
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#475569", lineHeight: 1.45 }}>
                Side-by-side advisory comparison in paper mode — no database writes, wallets, payouts, withdrawals,
                or operational events.
              </p>
            </div>
          </>
        ) : null}

        {selectedScenario ? (
          <PanelSection title="Scenario details" intro={selectedScenario.description}>
            <KeyValueGrid
              entries={[
                ["ID", selectedScenario.id],
                ["Category", humanize(selectedScenario.category)],
                ["Soft launch", selectedScenario.syntheticInputs.softLaunch ? "Yes" : "No"],
                [
                  "Liabilities (synthetic)",
                  `$${Number(selectedScenario.syntheticInputs.liabilitiesUsd || 0).toLocaleString()}`,
                ],
                [
                  "Exposure (synthetic)",
                  `$${Number(selectedScenario.syntheticInputs.exposureUsd || 0).toLocaleString()}`,
                ],
              ]}
            />
            <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.85rem" }}>Synthetic inputs</p>
            <pre
              style={{
                margin: "0.45rem 0 0",
                padding: "0.75rem",
                fontSize: "0.72rem",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "8px",
                overflowX: "auto",
                color: "#334155",
              }}
            >
              {JSON.stringify(selectedScenario.syntheticInputs, null, 2)}
            </pre>
          </PanelSection>
        ) : null}

        {result ? (
          <>
            <PanelSection title="Simulation summary">
              <p style={{ ...treasurySummaryTextStyle, fontWeight: 600, color: "#334155" }}>{result.summary}</p>
              <p style={{ margin: "0.75rem 0 0", fontSize: "1.1rem", fontWeight: 800, color: "#0369a1" }}>
                Overall confidence: {result.confidence}/100
              </p>
            </PanelSection>

            <PanelSection title="Simulated command center" intro="Synthetic command posture — not connected to production command center.">
              <KeyValueGrid
                entries={[
                  ["Command status", humanize(result.simulatedCommandCenter.commandStatus)],
                  ["Priority", humanize(result.simulatedCommandCenter.priorityLevel)],
                  ["Attention signal", humanize(result.simulatedCommandCenter.attentionSignal)],
                  ["Health signal", humanize(result.simulatedCommandCenter.healthSignal)],
                ]}
              />
              <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem" }}>
                {result.simulatedCommandCenter.summary}
              </p>
              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.75rem" }}>Operating picture</p>
              <p style={treasurySummaryTextStyle}>{result.simulatedCommandCenter.operatingPicture}</p>
              {result.simulatedCommandCenter.concerns?.length > 0 ? (
                <>
                  <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.75rem" }}>Concerns</p>
                  <ul style={treasuryListStyle}>
                    {result.simulatedCommandCenter.concerns.map((c) => (
                      <li key={c} style={treasuryListItemStyle}>
                        {c}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </PanelSection>

            <PanelSection title="Simulated operations">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <span style={postureBadgeStyle(result.simulatedOperations.operatingState)}>
                  {humanize(result.simulatedOperations.operatingState)}
                </span>
                <span style={postureBadgeStyle(result.simulatedOperations.attentionLevel)}>
                  Attention: {humanize(result.simulatedOperations.attentionLevel)}
                </span>
              </div>
              <p style={treasurySummaryLabelStyle}>Monitoring signals</p>
              <ul style={treasuryListStyle}>
                {result.simulatedOperations.monitoringSignals.map((s) => (
                  <li key={s} style={treasuryListItemStyle}>
                    {s}
                  </li>
                ))}
              </ul>
              {result.simulatedOperations.watchFlags?.length > 0 ? (
                <>
                  <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.75rem" }}>Watch flags</p>
                  <ul style={treasuryListStyle}>
                    {result.simulatedOperations.watchFlags.map((f) => (
                      <li key={f} style={treasuryListItemStyle}>
                        {f}
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.75rem" }}>Recommended monitoring</p>
              <ul style={treasuryListStyle}>
                {result.simulatedOperations.recommendedMonitoring.map((r) => (
                  <li key={r} style={treasuryListItemStyle}>
                    {r}
                  </li>
                ))}
              </ul>
            </PanelSection>

            <PanelSection title="Simulated regime">
              <KeyValueGrid
                entries={[
                  ["Regime", humanize(result.simulatedRegime.regime)],
                  ["Confidence", `${result.simulatedRegime.regimeConfidence}%`],
                  ["Trend", humanize(result.simulatedRegime.regimeTrend)],
                  ["Operator posture", humanize(result.simulatedRegime.operatorPosture)],
                ]}
              />
              <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem" }}>{result.simulatedRegime.summary}</p>
              <ul style={{ ...treasuryListStyle, marginTop: "0.65rem" }}>
                {result.simulatedRegime.signals.map((s) => (
                  <li key={s} style={treasuryListItemStyle}>
                    {s}
                  </li>
                ))}
              </ul>
            </PanelSection>

            <PanelSection title="Simulated outlook">
              <KeyValueGrid
                entries={[
                  ["Outlook", humanize(result.simulatedOutlook.outlook)],
                  ["Confidence", `${result.simulatedOutlook.outlookConfidence}%`],
                  ["Direction", humanize(result.simulatedOutlook.outlookDirection)],
                  ["Operator posture", humanize(result.simulatedOutlook.operatorPosture)],
                ]}
              />
              <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem" }}>
                {result.simulatedOutlook.outlookSummary}
              </p>
            </PanelSection>

            <PanelSection title="Decision trace">
              <KeyValueGrid
                entries={[
                  ["Trace status", humanize(result.simulatedDecisionTrace.traceStatus)],
                  ["Trace confidence", `${result.simulatedDecisionTrace.confidence}%`],
                ]}
              />
              <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem" }}>
                {result.simulatedDecisionTrace.traceSummary}
              </p>
              <ol style={{ margin: "0.85rem 0 0", paddingLeft: "1.25rem", display: "grid", gap: "0.55rem" }}>
                {result.simulatedDecisionTrace.traceSteps.map((step, idx) => (
                  <li key={`${step.step}-${idx}`} style={treasuryListItemStyle}>
                    <strong style={{ color: "#0f172a" }}>{step.step}</strong>
                    <span style={{ color: "#64748b" }}>
                      {" "}
                      — {step.source}: {step.effect}
                    </span>
                  </li>
                ))}
              </ol>
            </PanelSection>

            <PanelSection title="Recommendations">
              <ul style={treasuryListStyle}>
                {result.simulatedRecommendations.map((r) => (
                  <li key={r} style={treasuryListItemStyle}>
                    {r}
                  </li>
                ))}
              </ul>
            </PanelSection>

            {validationScore && validationReport ? (
              <>
                <PanelSection
                  title="Validation scoring"
                  intro="Deterministic rule-based assessment of advisory quality, coherence, and safety."
                >
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem", alignItems: "center" }}>
                    <span style={gradeBadgeStyle(validationScore.validationGrade)}>
                      Grade {validationScore.validationGrade}
                    </span>
                    <span style={qualityBadgeStyle(validationScore.reasoningQuality)}>
                      Reasoning: {humanize(validationScore.reasoningQuality)}
                    </span>
                    <span style={qualityBadgeStyle(validationScore.confidenceQuality)}>
                      Confidence: {humanize(validationScore.confidenceQuality)}
                    </span>
                  </div>
                  <KeyValueGrid
                    entries={[
                      ["Validation score", `${validationScore.validationScore}/100`],
                      ["Coherence score", `${validationScore.coherenceScore}/100`],
                      ["Safety score", `${validationScore.safetyScore}/100`],
                      ["Recommendation quality", humanize(validationScore.recommendationQuality)],
                    ]}
                  />
                  <p style={{ ...treasurySummaryTextStyle, marginTop: "0.85rem", fontWeight: 600, color: "#334155" }}>
                    {validationScore.validationSummary}
                  </p>
                  {validationScore.strengths?.length > 0 ? (
                    <>
                      <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.75rem" }}>Strengths</p>
                      <ul style={treasuryListStyle}>
                        {validationScore.strengths.map((s) => (
                          <li key={s} style={treasuryListItemStyle}>
                            {s}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {validationScore.issuesDetected?.length > 0 ? (
                    <>
                      <p style={{ ...treasurySummaryLabelStyle, marginTop: "0.75rem" }}>Issues detected</p>
                      <ul style={treasuryListStyle}>
                        {validationScore.issuesDetected.map((issue) => (
                          <li key={issue} style={treasuryListItemStyle}>
                            {issue}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </PanelSection>

                <PanelSection
                  title="Validation report"
                  intro="Multi-section plain-text report for institutional review."
                >
                  <button
                    type="button"
                    className={treasuryFocusRingClass}
                    style={btnSecondary}
                    onClick={() => copyReportText(validationReport.reportText)}
                  >
                    Copy report
                  </button>
                  <pre style={reportPreStyle}>{validationReport.reportText}</pre>
                </PanelSection>
              </>
            ) : null}

            <div style={{ ...treasuryPanelHighlightStyle, marginBottom: "2rem" }}>
              <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#0369a1" }}>
                Safety notice
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "#475569", lineHeight: 1.45 }}>
                Simulation only. No production treasury data is changed. No wallets, payouts, withdrawals, PayPal, or
                operational event logging were invoked.
              </p>
            </div>
          </>
        ) : (
          <PanelSection
            title="Results"
            intro="Run a simulation to populate command center, operations, regime, outlook, trace, and recommendations panels."
          >
            <p style={treasurySummaryTextStyle}>No simulation results yet.</p>
          </PanelSection>
        )}
      </div>
    </>
  );
}
