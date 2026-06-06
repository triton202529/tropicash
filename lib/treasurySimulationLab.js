/**
 * Treasury Simulation Lab — read-only, synthetic advisory scenarios.
 * No database, wallet, payout, withdrawal, or operational event side effects.
 */

export const TREASURY_SIMULATION_SCENARIOS = [
  {
    id: "stable_soft_launch",
    name: "Stable Soft Launch",
    category: "stable",
    description:
      "Low-dollar liabilities and exposure with calm coherence. Validates baseline advisory posture during soft launch.",
    syntheticInputs: {
      liabilitiesUsd: 420,
      exposureUsd: 85,
      softLaunch: true,
      attentionLevel: "quiet",
      driftStatus: "unchanged",
      coherenceScore: 88,
      alertPriority: "low",
      readinessSignal: "hold_position",
      withdrawalSpikePct: 0,
      payoutDelayHours: 0,
      fraudClusterCount: 0,
      confidenceScore: 82,
      contradictorySignals: false,
      leadershipVisibility: false,
      scalingPressureIndex: 12,
    },
  },
  {
    id: "moderate_withdrawal_spike",
    name: "Moderate Withdrawal Spike",
    category: "withdrawal_spike",
    description:
      "Synthetic withdrawal velocity uptick at small-dollar scale. Exercises elevated monitoring without payout disruption.",
    syntheticInputs: {
      liabilitiesUsd: 1250,
      exposureUsd: 620,
      softLaunch: true,
      attentionLevel: "monitoring",
      driftStatus: "shifting",
      coherenceScore: 72,
      alertPriority: "moderate",
      readinessSignal: "tighten_observation",
      withdrawalSpikePct: 35,
      payoutDelayHours: 0,
      fraudClusterCount: 0,
      confidenceScore: 68,
      contradictorySignals: false,
      leadershipVisibility: false,
      scalingPressureIndex: 28,
    },
  },
  {
    id: "high_withdrawal_spike",
    name: "High Withdrawal Spike",
    category: "withdrawal_spike",
    description:
      "Strong synthetic withdrawal pressure relative to liabilities. Stress-tests command center and regime escalation paths.",
    syntheticInputs: {
      liabilitiesUsd: 4800,
      exposureUsd: 3100,
      softLaunch: false,
      attentionLevel: "elevated",
      driftStatus: "deteriorating",
      coherenceScore: 58,
      alertPriority: "high",
      readinessSignal: "defer_expansion",
      withdrawalSpikePct: 78,
      payoutDelayHours: 2,
      fraudClusterCount: 0,
      confidenceScore: 52,
      contradictorySignals: false,
      leadershipVisibility: false,
      scalingPressureIndex: 45,
    },
  },
  {
    id: "payout_delay_pressure",
    name: "Payout Delay Pressure",
    category: "payout_pressure",
    description:
      "Synthetic payout queue latency without wallet mutation. Advisory should emphasize payout observability and calm escalation.",
    syntheticInputs: {
      liabilitiesUsd: 2200,
      exposureUsd: 1400,
      softLaunch: false,
      attentionLevel: "elevated",
      driftStatus: "shifting",
      coherenceScore: 64,
      alertPriority: "elevated",
      readinessSignal: "tighten_observation",
      withdrawalSpikePct: 18,
      payoutDelayHours: 36,
      fraudClusterCount: 0,
      confidenceScore: 61,
      contradictorySignals: false,
      leadershipVisibility: false,
      scalingPressureIndex: 38,
    },
  },
  {
    id: "fraud_signal_cluster",
    name: "Fraud Signal Cluster",
    category: "fraud_cluster",
    description:
      "Clustered fraud-adjacent signals at modest scale. Validates fraud-aware monitoring and trace narrative without operational logging.",
    syntheticInputs: {
      liabilitiesUsd: 3100,
      exposureUsd: 980,
      softLaunch: false,
      attentionLevel: "active_review",
      driftStatus: "deteriorating",
      coherenceScore: 55,
      alertPriority: "high",
      readinessSignal: "defer_expansion",
      withdrawalSpikePct: 22,
      payoutDelayHours: 4,
      fraudClusterCount: 6,
      confidenceScore: 48,
      contradictorySignals: false,
      leadershipVisibility: true,
      scalingPressureIndex: 32,
    },
  },
  {
    id: "contradictory_guidance",
    name: "Contradictory Guidance",
    category: "contradictory_signals",
    description:
      "Mixed coherence, drift, and readiness signals. Exercises meta-reasoning and trace fragmentation handling in paper mode.",
    syntheticInputs: {
      liabilitiesUsd: 1800,
      exposureUsd: 900,
      softLaunch: true,
      attentionLevel: "monitoring",
      driftStatus: "oscillating",
      coherenceScore: 48,
      alertPriority: "moderate",
      readinessSignal: "hold_position",
      withdrawalSpikePct: 15,
      payoutDelayHours: 8,
      fraudClusterCount: 1,
      confidenceScore: 44,
      contradictorySignals: true,
      leadershipVisibility: false,
      scalingPressureIndex: 40,
    },
  },
  {
    id: "recovery_after_pressure",
    name: "Recovery After Pressure",
    category: "recovery",
    description:
      "Post-pressure normalization with improving drift and stabilizing recommendations. Near-term recovery outlook only.",
    syntheticInputs: {
      liabilitiesUsd: 2600,
      exposureUsd: 1100,
      softLaunch: false,
      attentionLevel: "monitoring",
      driftStatus: "improving",
      coherenceScore: 76,
      alertPriority: "low",
      readinessSignal: "continue_testing",
      withdrawalSpikePct: 8,
      payoutDelayHours: 6,
      fraudClusterCount: 0,
      confidenceScore: 71,
      contradictorySignals: false,
      leadershipVisibility: false,
      scalingPressureIndex: 22,
    },
  },
  {
    id: "confidence_collapse",
    name: "Confidence Collapse",
    category: "confidence_stress",
    description:
      "Low explainability confidence with elevated attention. Stress-tests confidence caps and advisory humility language.",
    syntheticInputs: {
      liabilitiesUsd: 5400,
      exposureUsd: 2200,
      softLaunch: false,
      attentionLevel: "elevated",
      driftStatus: "deteriorating",
      coherenceScore: 42,
      alertPriority: "elevated",
      readinessSignal: "defer_expansion",
      withdrawalSpikePct: 40,
      payoutDelayHours: 12,
      fraudClusterCount: 2,
      confidenceScore: 22,
      contradictorySignals: false,
      leadershipVisibility: false,
      scalingPressureIndex: 55,
    },
  },
  {
    id: "scaling_pressure",
    name: "Scaling Pressure",
    category: "scaling_pressure",
    description:
      "Rising liabilities with readiness tension. Validates scaling-readiness advisory without triggering real treasury operations.",
    syntheticInputs: {
      liabilitiesUsd: 18500,
      exposureUsd: 7200,
      softLaunch: false,
      attentionLevel: "elevated",
      driftStatus: "shifting",
      coherenceScore: 62,
      alertPriority: "moderate",
      readinessSignal: "defer_expansion",
      withdrawalSpikePct: 28,
      payoutDelayHours: 10,
      fraudClusterCount: 0,
      confidenceScore: 58,
      contradictorySignals: false,
      leadershipVisibility: false,
      scalingPressureIndex: 82,
    },
  },
  {
    id: "leadership_visibility_case",
    name: "Leadership Visibility Case",
    category: "leadership_visibility",
    description:
      "Executive-ready advisory framing with elevated but controlled posture. Simulation-only leadership digest cues.",
    syntheticInputs: {
      liabilitiesUsd: 6200,
      exposureUsd: 2800,
      softLaunch: false,
      attentionLevel: "active_review",
      driftStatus: "shifting",
      coherenceScore: 67,
      alertPriority: "elevated",
      readinessSignal: "leadership_briefing",
      withdrawalSpikePct: 32,
      payoutDelayHours: 14,
      fraudClusterCount: 1,
      confidenceScore: 65,
      contradictorySignals: false,
      leadershipVisibility: true,
      scalingPressureIndex: 48,
    },
  },
];

const SCENARIO_BY_ID = Object.fromEntries(TREASURY_SIMULATION_SCENARIOS.map((s) => [s.id, s]));

/** @returns {typeof TREASURY_SIMULATION_SCENARIOS[number] | null} */
export function getTreasurySimulationScenario(scenarioId) {
  if (!scenarioId) return null;
  return SCENARIO_BY_ID[String(scenarioId)] || null;
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function humanizeToken(key) {
  return String(key || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function deriveCommandStatus(inputs) {
  const attention = String(inputs.attentionLevel || "quiet").toLowerCase();
  if (attention === "active_review") return "active_review";
  if (attention === "elevated") return "elevated_attention";
  if (attention === "monitoring") return "monitored";
  if (inputs.withdrawalSpikePct >= 60 || inputs.fraudClusterCount >= 4) return "elevated_attention";
  if (inputs.withdrawalSpikePct >= 25 || inputs.payoutDelayHours >= 24) return "monitored";
  return "stable";
}

function derivePriorityLevel(commandStatus, inputs) {
  if (commandStatus === "active_review" || inputs.alertPriority === "high") return "high";
  if (commandStatus === "elevated_attention" || inputs.alertPriority === "elevated") return "elevated";
  if (inputs.alertPriority === "moderate" || commandStatus === "monitored") return "moderate";
  return "low";
}

function deriveOperatingState(commandStatus, inputs) {
  if (commandStatus === "active_review") return "active_review";
  if (commandStatus === "elevated_attention") return "elevated_monitoring";
  if (inputs.withdrawalSpikePct >= 50) return "withdrawal_watch";
  if (inputs.payoutDelayHours >= 20) return "payout_watch";
  if (commandStatus === "monitored") return "routine_monitoring";
  return "stable_operations";
}

function deriveRegimeKey(inputs, commandStatus) {
  if (inputs.contradictorySignals) return "contradictory_regime";
  if (inputs.driftStatus === "improving" && inputs.coherenceScore >= 70) return "recovery_mode";
  if (inputs.fraudClusterCount >= 4) return "integrity_stress";
  if (inputs.withdrawalSpikePct >= 60) return "liquidity_stress";
  if (inputs.payoutDelayHours >= 24) return "payout_pressure";
  if (inputs.scalingPressureIndex >= 75) return "scaling_tension";
  if (inputs.confidenceScore < 35) return "low_confidence_regime";
  if (commandStatus === "stable") return "calm_operations";
  if (commandStatus === "monitored") return "elevated_monitoring";
  return "active_advisory_review";
}

function deriveOutlookKey(regime, inputs) {
  if (inputs.driftStatus === "improving") return "recovery_outlook";
  if (inputs.contradictorySignals) return "uncertain_outlook";
  if (inputs.confidenceScore < 35) return "deteriorating_outlook";
  if (regime === "calm_operations") return "stabilizing_outlook";
  if (regime === "recovery_mode") return "improving_outlook";
  if (regime === "scaling_tension") return "cautious_outlook";
  if (inputs.leadershipVisibility) return "elevated_monitoring_outlook";
  return "cautious_outlook";
}

function buildSimulatedCommandCenter(inputs) {
  const commandStatus = deriveCommandStatus(inputs);
  const priorityLevel = derivePriorityLevel(commandStatus, inputs);
  const attentionSignal =
    commandStatus === "stable"
      ? "routine_calm"
      : commandStatus === "monitored"
        ? "heightened_observation"
        : commandStatus === "elevated_attention"
          ? "elevated_synthetic_attention"
          : "active_synthetic_review";

  const healthSignal =
    inputs.coherenceScore >= 75
      ? "healthy_advisory"
      : inputs.coherenceScore >= 55
        ? "watch_advisory"
        : "stressed_advisory";

  const operatingPicture = inputs.softLaunch
    ? "Soft-launch treasury paper mode — small-dollar synthetic book, calm institutional framing."
    : "Standard synthetic treasury book — advisory simulation only, no production ledger coupling.";

  const concerns = [];
  if (inputs.withdrawalSpikePct >= 25) {
    concerns.push(`Synthetic withdrawal spike at ${inputs.withdrawalSpikePct}% of baseline velocity.`);
  }
  if (inputs.payoutDelayHours >= 12) {
    concerns.push(`Synthetic payout delay pressure (~${inputs.payoutDelayHours}h queue latency).`);
  }
  if (inputs.fraudClusterCount > 0) {
    concerns.push(`${inputs.fraudClusterCount} clustered fraud-adjacent signals (simulation).`);
  }
  if (inputs.contradictorySignals) {
    concerns.push("Contradictory upstream guidance tokens detected in synthetic inputs.");
  }

  const summary =
    commandStatus === "stable"
      ? "Command center simulation: stable posture with routine monitoring cadence. No production treasury actions implied."
      : commandStatus === "monitored"
        ? "Command center simulation: monitored posture — maintain calm observational review of synthetic signals."
        : commandStatus === "elevated_attention"
          ? "Command center simulation: elevated attention — leadership should review advisory panels before any operational change."
          : "Command center simulation: active review — prioritize human judgment; simulation remains read-only.";

  return {
    commandStatus,
    operatingPicture,
    priorityLevel,
    attentionSignal,
    healthSignal,
    summary,
    concerns,
    watchAreas: concerns.slice(0, 3),
    softLaunch: Boolean(inputs.softLaunch),
    liabilitiesUsd: inputs.liabilitiesUsd,
    exposureUsd: inputs.exposureUsd,
  };
}

function buildSimulatedOperations(inputs, commandCenter) {
  const operatingState = deriveOperatingState(commandCenter.commandStatus, inputs);
  const attentionLevel = String(inputs.attentionLevel || "quiet").toLowerCase();

  const monitoringSignals = [
    `Synthetic liabilities: $${inputs.liabilitiesUsd.toLocaleString()} (paper mode).`,
    `Synthetic exposure: $${inputs.exposureUsd.toLocaleString()} (paper mode).`,
    `Coherence score: ${inputs.coherenceScore}/100 (simulated).`,
    `Drift status: ${humanizeToken(inputs.driftStatus)}.`,
  ];

  const watchFlags = [];
  if (inputs.withdrawalSpikePct > 0) {
    watchFlags.push(`Withdrawal spike factor: ${inputs.withdrawalSpikePct}%`);
  }
  if (inputs.payoutDelayHours > 0) {
    watchFlags.push(`Payout delay indicator: ${inputs.payoutDelayHours}h`);
  }
  if (inputs.fraudClusterCount > 0) {
    watchFlags.push(`Fraud cluster count: ${inputs.fraudClusterCount}`);
  }
  if (inputs.scalingPressureIndex >= 70) {
    watchFlags.push(`Scaling pressure index: ${inputs.scalingPressureIndex}`);
  }

  const recommendedMonitoring = [
    "Maintain treasury paper mode — no wallet, payout, or withdrawal mutations.",
    "Re-run simulation after adjusting scenario inputs to compare advisory shapes.",
  ];
  if (commandCenter.commandStatus !== "stable") {
    recommendedMonitoring.push("Schedule calm leadership readout if posture persists in production mirrors.");
  }
  if (inputs.leadershipVisibility) {
    recommendedMonitoring.push("Prepare executive-visible digest from simulation panels only.");
  }

  return {
    operatingState,
    attentionLevel,
    monitoringSignals,
    watchFlags,
    recommendedMonitoring,
  };
}

function buildSimulatedRegime(inputs, commandCenter) {
  const regime = deriveRegimeKey(inputs, commandCenter.commandStatus);
  const regimeTrend =
    inputs.driftStatus === "improving"
      ? "strengthening"
      : inputs.driftStatus === "deteriorating"
        ? "weakening"
        : inputs.driftStatus === "oscillating"
          ? "oscillating"
          : "stable";

  const regimeConfidence = clamp(
    Math.round(
      inputs.coherenceScore * 0.45 +
        inputs.confidenceScore * 0.35 +
        (commandCenter.commandStatus === "stable" ? 18 : commandCenter.commandStatus === "monitored" ? 10 : 4),
    ),
    12,
    92,
  );

  const operatorPosture =
    regime === "calm_operations"
      ? "observe"
      : regime === "recovery_mode"
        ? "stabilize"
        : inputs.leadershipVisibility
          ? "brief_leadership"
          : regime === "low_confidence_regime" || inputs.contradictorySignals
            ? "verify_before_action"
            : "elevated_review";

  const signals = [
    `Regime classified from synthetic scenario inputs (${humanizeToken(regime)}).`,
    `Coherence ${inputs.coherenceScore}, confidence ${inputs.confidenceScore} (simulated).`,
    `Alert priority token: ${inputs.alertPriority}.`,
  ];

  const summary = `Simulated regime: ${humanizeToken(regime)} with ${regimeTrend} trend. Operator posture: ${humanizeToken(operatorPosture)}. Institutional advisory only.`;

  return {
    regime,
    regimeConfidence,
    regimeTrend,
    operatorPosture,
    summary,
    signals,
  };
}

function buildSimulatedOutlook(inputs, regimeResult) {
  const outlook = deriveOutlookKey(regimeResult.regime, inputs);
  const outlookDirection =
    inputs.driftStatus === "improving"
      ? "strengthening"
      : inputs.driftStatus === "deteriorating"
        ? "weakening"
        : inputs.driftStatus === "oscillating"
          ? "oscillating"
          : "stable";

  const outlookConfidence = clamp(
    Math.round(regimeResult.regimeConfidence * 0.85 + (inputs.confidenceScore >= 50 ? 8 : -6)),
    10,
    90,
  );

  const operatorPosture =
    outlook === "recovery_outlook" || outlook === "improving_outlook"
      ? "stabilize"
      : outlook === "uncertain_outlook"
        ? "verify_before_action"
        : inputs.leadershipVisibility
          ? "brief_leadership"
          : "observe";

  const signals = [
    `Outlook derived from regime ${humanizeToken(regimeResult.regime)} (simulation).`,
    `Near-term direction: ${humanizeToken(outlookDirection)} — not a financial forecast.`,
  ];

  const outlookSummary = `Simulated near-term outlook: ${humanizeToken(outlook)}. ${inputs.softLaunch ? "Soft-launch caps apply in narrative." : "Standard scale synthetic book."} Human judgment remains primary.`;

  return {
    outlook,
    outlookConfidence,
    outlookDirection,
    operatorPosture,
    outlookSummary,
    signals,
  };
}

function buildSimulatedDecisionTrace(inputs, commandCenter, regimeResult) {
  const steps = [
    {
      step: "Ingest synthetic scenario inputs",
      source: "treasury_simulation_lab",
      effect: "Bound deterministic paper-mode advisory path",
    },
    {
      step: "Evaluate command center posture",
      source: "simulated_command_center",
      effect: `Command status → ${commandCenter.commandStatus}`,
    },
    {
      step: "Classify treasury regime",
      source: "simulated_regime",
      effect: `Regime → ${regimeResult.regime}`,
    },
  ];

  if (inputs.contradictorySignals) {
    steps.push({
      step: "Detect contradictory guidance tokens",
      source: "synthetic_coherence_check",
      effect: "Trace marked partially fragmented — reconcile before operational mirroring",
    });
  }
  if (inputs.fraudClusterCount > 0) {
    steps.push({
      step: "Apply fraud-cluster weighting",
      source: "synthetic_fraud_signals",
      effect: `Elevated integrity watch (${inputs.fraudClusterCount} signals)`,
    });
  }
  if (inputs.leadershipVisibility) {
    steps.push({
      step: "Flag leadership visibility",
      source: "synthetic_executive_cadence",
      effect: "Executive briefing framing recommended (simulation only)",
    });
  }

  const traceStatus = inputs.contradictorySignals
    ? "partially_traceable"
    : inputs.confidenceScore < 40
      ? "fragmented_trace"
      : steps.length >= 5
        ? "fully_traceable"
        : "mostly_traceable";

  const confidence = clamp(
    Math.round(inputs.confidenceScore * 0.7 + inputs.coherenceScore * 0.2 + (traceStatus === "fully_traceable" ? 10 : 0)),
    8,
    88,
  );

  const traceSummary =
    traceStatus === "fully_traceable"
      ? "Decision trace simulation: fully traceable path across synthetic layers."
      : traceStatus === "mostly_traceable"
        ? "Decision trace simulation: mostly traceable — minor gaps acceptable in paper mode."
        : traceStatus === "partially_traceable"
          ? "Decision trace simulation: partially traceable — contradictory inputs require human reconciliation."
          : "Decision trace simulation: fragmented trace — low confidence; defer operational mirroring.";

  return { traceStatus, confidence, traceSteps: steps, traceSummary };
}

function buildSimulatedRecommendations(inputs, commandCenter, regimeResult, outlookResult) {
  const recs = [
    "Treasury Simulation Lab — advisory outputs only; no production treasury mutations.",
    `Maintain paper-mode review cadence while posture is ${humanizeToken(commandCenter.commandStatus)}.`,
  ];

  if (inputs.softLaunch) {
    recs.push("Preserve soft-launch humility: treat small-dollar synthetic metrics as directional only.");
  }
  if (inputs.withdrawalSpikePct >= 40) {
    recs.push("Monitor withdrawal velocity mirrors calmly — simulation does not enqueue real withdrawals.");
  }
  if (inputs.payoutDelayHours >= 20) {
    recs.push("Review payout queue observability in production separately; simulation does not delay payouts.");
  }
  if (inputs.fraudClusterCount >= 3) {
    recs.push("Route fraud-cluster signals to human fraud review — no automated enforcement from simulation.");
  }
  if (inputs.contradictorySignals) {
    recs.push("Reconcile contradictory guidance layers before aligning production advisory posture.");
  }
  if (inputs.confidenceScore < 40) {
    recs.push("Lower confidence — widen human verification before any treasury operational change.");
  }
  if (inputs.leadershipVisibility) {
    recs.push("Prepare leadership-visible summary from simulation panels; label as synthetic drill.");
  }
  if (regimeResult.regime === "scaling_tension") {
    recs.push("Assess scaling readiness checkpoints — simulation scaling index is synthetic.");
  }
  if (outlookResult.outlook === "recovery_outlook") {
    recs.push("Recovery outlook is near-term advisory only — continue observation before declaring normalization.");
  }

  return recs.slice(0, 8);
}

function buildSimulationSummary(scenario, confidence, commandCenter) {
  return [
    `Simulation complete: ${scenario.name} (${humanizeToken(scenario.category)}).`,
    `Overall confidence ${confidence}/100.`,
    `Command posture ${humanizeToken(commandCenter.commandStatus)} — ${commandCenter.summary}`,
  ].join(" ");
}

/**
 * Run simulation pipeline for a scenario with explicit synthetic inputs (paper mode).
 * @param {typeof TREASURY_SIMULATION_SCENARIOS[number]} scenario
 * @param {object} inputs
 * @returns {object}
 */
function runTreasurySimulationForInputs(scenario, inputs) {
  const simulatedCommandCenter = buildSimulatedCommandCenter(inputs);
  const simulatedOperations = buildSimulatedOperations(inputs, simulatedCommandCenter);
  const simulatedRegime = buildSimulatedRegime(inputs, simulatedCommandCenter);
  const simulatedOutlook = buildSimulatedOutlook(inputs, simulatedRegime);
  const simulatedDecisionTrace = buildSimulatedDecisionTrace(inputs, simulatedCommandCenter, simulatedRegime);
  const simulatedRecommendations = buildSimulatedRecommendations(
    inputs,
    simulatedCommandCenter,
    simulatedRegime,
    simulatedOutlook,
  );

  const confidence = clamp(
    Math.round(
      inputs.confidenceScore * 0.35 +
        inputs.coherenceScore * 0.25 +
        simulatedRegime.regimeConfidence * 0.2 +
        simulatedDecisionTrace.confidence * 0.2,
    ),
    5,
    95,
  );

  const summary = buildSimulationSummary(scenario, confidence, simulatedCommandCenter);

  return {
    scenario: { ...scenario, syntheticInputs: inputs },
    simulatedCommandCenter,
    simulatedOperations,
    simulatedRegime,
    simulatedOutlook,
    simulatedDecisionTrace,
    simulatedRecommendations,
    confidence,
    summary,
  };
}

/**
 * Run a deterministic treasury advisory simulation for a scenario id.
 * @param {string} scenarioId
 * @returns {null | object}
 */
export function runTreasurySimulation(scenarioId) {
  const scenario = getTreasurySimulationScenario(scenarioId);
  if (!scenario) return null;

  return runTreasurySimulationForInputs(scenario, { ...scenario.syntheticInputs });
}

/**
 * Run simulation with perturbed synthetic inputs overlay (read-only, deterministic).
 * @param {string} scenarioId
 * @param {(inputs: object) => object} applyPerturbation
 * @returns {null | object}
 */
export function runTreasurySimulationWithPerturbations(scenarioId, applyPerturbation) {
  const scenario = getTreasurySimulationScenario(scenarioId);
  if (!scenario || typeof applyPerturbation !== "function") return null;

  const baseInputs = { ...scenario.syntheticInputs };
  const perturbedInputs = applyPerturbation(baseInputs);
  if (!perturbedInputs || typeof perturbedInputs !== "object") return null;

  return runTreasurySimulationForInputs(scenario, perturbedInputs);
}

const EMPTY_COMPARISON = {
  simulations: [],
  comparisonSummary: "",
  comparisonRows: [],
  highestRiskScenario: null,
  mostStableScenario: null,
  recommendationDifferences: [],
  confidenceSpread: { min: 0, max: 0, spread: 0 },
  summary: "",
};

const ATTENTION_ORDINAL = {
  quiet: 0,
  monitoring: 1,
  elevated: 2,
  active_review: 3,
};

const COMMAND_STATUS_ORDINAL = {
  stable: 0,
  monitored: 1,
  elevated_attention: 2,
  active_review: 3,
};

const PRIORITY_ORDINAL = {
  low: 0,
  moderate: 1,
  elevated: 2,
  high: 3,
};

const REGIME_SEVERITY_ORDINAL = {
  calm_operations: 0,
  recovery_mode: 1,
  elevated_monitoring: 2,
  active_advisory_review: 3,
  scaling_tension: 4,
  payout_pressure: 5,
  low_confidence_regime: 6,
  liquidity_stress: 7,
  integrity_stress: 8,
  contradictory_regime: 9,
};

function riskScoreForSimulation(simulation) {
  const cc = simulation.simulatedCommandCenter;
  const ops = simulation.simulatedOperations;
  const regime = simulation.simulatedRegime;
  const inputs = simulation.scenario?.syntheticInputs || {};

  const attentionKey = String(ops.attentionLevel || cc.attentionSignal || "quiet").toLowerCase();
  const attentionScore = ATTENTION_ORDINAL[attentionKey] ?? ATTENTION_ORDINAL.monitoring;

  const commandScore = COMMAND_STATUS_ORDINAL[cc.commandStatus] ?? 0;
  const priorityScore = PRIORITY_ORDINAL[cc.priorityLevel] ?? 0;
  const regimeScore = REGIME_SEVERITY_ORDINAL[regime.regime] ?? 3;
  const leadershipBonus = inputs.leadershipVisibility ? 4 : 0;
  const confidencePenalty = Math.round((100 - simulation.confidence) / 25);

  return (
    attentionScore * 10 +
    commandScore * 12 +
    priorityScore * 8 +
    regimeScore * 6 +
    leadershipBonus +
    confidencePenalty
  );
}

function stabilityScoreForSimulation(simulation) {
  const risk = riskScoreForSimulation(simulation);
  const softLaunchBonus = simulation.scenario?.id === "stable_soft_launch" ? 25 : 0;
  const calmRegimeBonus = simulation.simulatedRegime.regime === "calm_operations" ? 15 : 0;
  const stableCommandBonus = simulation.simulatedCommandCenter.commandStatus === "stable" ? 10 : 0;
  return softLaunchBonus + calmRegimeBonus + stableCommandBonus - risk;
}

function buildComparisonRow(simulation) {
  const cc = simulation.simulatedCommandCenter;
  const ops = simulation.simulatedOperations;
  const attentionLevel =
    ops.attentionLevel || cc.attentionSignal || cc.commandStatus || "unknown";

  return {
    scenarioName: simulation.scenario.name,
    commandStatus: cc.commandStatus,
    regime: simulation.simulatedRegime.regime,
    outlook: simulation.simulatedOutlook.outlook,
    confidence: simulation.confidence,
    attentionLevel,
    recommendationCount: simulation.simulatedRecommendations.length,
    traceStepCount: simulation.simulatedDecisionTrace.traceSteps.length,
  };
}

function buildRecommendationDifferences(simulations) {
  const diffs = [];
  const recSets = simulations.map((s) => ({
    id: s.scenario.id,
    name: s.scenario.name,
    recs: new Set(s.simulatedRecommendations),
  }));

  const allRecs = new Set();
  recSets.forEach(({ recs }) => recs.forEach((r) => allRecs.add(r)));

  allRecs.forEach((rec) => {
    const presentIn = recSets.filter(({ recs }) => recs.has(rec)).map(({ name }) => name);
    if (presentIn.length > 0 && presentIn.length < simulations.length) {
      diffs.push(`"${rec}" appears in ${presentIn.join(", ")} only.`);
    }
  });

  const regimeValues = [...new Set(simulations.map((s) => s.simulatedRegime.regime))];
  if (regimeValues.length > 1) {
    diffs.push(
      `Regime divergence: ${simulations
        .map((s) => `${s.scenario.name} → ${humanizeToken(s.simulatedRegime.regime)}`)
        .join("; ")}.`,
    );
  }

  const outlookValues = [...new Set(simulations.map((s) => s.simulatedOutlook.outlook))];
  if (outlookValues.length > 1) {
    diffs.push(
      `Outlook divergence: ${simulations
        .map((s) => `${s.scenario.name} → ${humanizeToken(s.simulatedOutlook.outlook)}`)
        .join("; ")}.`,
    );
  }

  const confidences = simulations.map((s) => s.confidence);
  const minC = Math.min(...confidences);
  const maxC = Math.max(...confidences);
  if (maxC - minC >= 8) {
    diffs.push(
      `Confidence spread of ${maxC - minC} points (${minC}–${maxC}) across selected scenarios.`,
    );
  }

  if (diffs.length === 0) {
    diffs.push("Selected scenarios produce aligned recommendations, regime, and outlook posture.");
  }

  return diffs.slice(0, 10);
}

function pickExtremeScenario(simulations, pickHighestRisk) {
  const scored = simulations.map((sim) => ({
    sim,
    risk: riskScoreForSimulation(sim),
    stability: stabilityScoreForSimulation(sim),
  }));

  scored.sort((a, b) => {
    if (pickHighestRisk) {
      if (b.risk !== a.risk) return b.risk - a.risk;
      return a.sim.confidence - b.sim.confidence;
    }
    if (b.stability !== a.stability) return b.stability - a.stability;
    return b.sim.confidence - a.sim.confidence;
  });

  const winner = scored[0]?.sim;
  if (!winner) return null;

  const cc = winner.simulatedCommandCenter;
  const regime = winner.simulatedRegime;

  if (pickHighestRisk) {
    const reasonParts = [
      `Attention ${humanizeToken(winner.simulatedOperations.attentionLevel)}`,
      `command ${humanizeToken(cc.commandStatus)}`,
      `priority ${humanizeToken(cc.priorityLevel)}`,
      `regime ${humanizeToken(regime.regime)}`,
    ];
    if (winner.scenario.syntheticInputs.leadershipVisibility) {
      reasonParts.push("leadership visibility flagged");
    }
    return {
      id: winner.scenario.id,
      name: winner.scenario.name,
      reason: `Highest synthetic risk posture — ${reasonParts.join(", ")}.`,
    };
  }

  return {
    id: winner.scenario.id,
    name: winner.scenario.name,
    reason:
      winner.scenario.id === "stable_soft_launch"
        ? "Most stable posture — stable soft launch baseline with calm command center and recovery-friendly outlook."
        : `Most stable among selection — ${humanizeToken(cc.commandStatus)} command, ${humanizeToken(regime.regime)} regime, confidence ${winner.confidence}/100.`,
  };
}

function buildComparisonSummaryText(simulations, highestRisk, mostStable, confidenceSpread) {
  const names = simulations.map((s) => s.scenario.name);
  const stableName = mostStable?.name || names[0];
  const riskName = highestRisk?.name || names[names.length - 1];

  if (names.length === 2) {
    return `Comparing ${names[0]} vs ${names[1]}: ${stableName} presents the calmest advisory posture while ${riskName} warrants the most elevated synthetic attention. Confidence spans ${confidenceSpread.min}–${confidenceSpread.max}.`;
  }

  return `Three-scenario comparison (${names.join(", ")}): ${mostStable?.name || names[0]} is the most stable anchor; ${highestRisk?.name || names[names.length - 1]} carries the highest synthetic risk signals. Confidence spread ${confidenceSpread.spread} points.`;
}

function buildComparisonParagraph(simulations, highestRisk, mostStable, confidenceSpread, truncatedWarning) {
  const postureLines = simulations
    .map(
      (s) =>
        `${s.scenario.name}: ${humanizeToken(s.simulatedCommandCenter.commandStatus)} command, ${humanizeToken(s.simulatedRegime.regime)} regime, ${s.confidence}/100 confidence`,
    )
    .join(". ");

  const lead = truncatedWarning
    ? `${truncatedWarning} `
    : "";

  return `${lead}Institutional comparison across ${simulations.length} synthetic treasury scenarios (paper mode only). ${postureLines}. Highest synthetic risk: ${highestRisk?.name || "n/a"}. Most stable anchor: ${mostStable?.name || "n/a"}. Confidence band ${confidenceSpread.min}–${confidenceSpread.max} (spread ${confidenceSpread.spread}). No production treasury data is changed.`;
}

/**
 * Compare 2–3 treasury simulation scenarios deterministically (read-only, advisory).
 * @param {string[]} scenarioIds
 * @returns {typeof EMPTY_COMPARISON}
 */
export function compareTreasurySimulations(scenarioIds) {
  if (!Array.isArray(scenarioIds) || scenarioIds.length < 2) {
    return { ...EMPTY_COMPARISON };
  }

  let ids = scenarioIds.map((id) => String(id)).filter(Boolean);
  let truncatedWarning = "";

  if (ids.length > 3) {
    truncatedWarning = `More than three scenarios supplied — only the first three were compared.`;
    ids = ids.slice(0, 3);
  }

  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length < 2) {
    return { ...EMPTY_COMPARISON };
  }

  const simulations = uniqueIds
    .map((id) => runTreasurySimulation(id))
    .filter(Boolean);

  if (simulations.length < 2) {
    return { ...EMPTY_COMPARISON };
  }

  const comparisonRows = simulations.map(buildComparisonRow);
  const confidences = simulations.map((s) => s.confidence);
  const min = Math.min(...confidences);
  const max = Math.max(...confidences);
  const confidenceSpread = { min, max, spread: max - min };

  const highestRiskScenario = pickExtremeScenario(simulations, true);
  const mostStableScenario = pickExtremeScenario(simulations, false);
  const recommendationDifferences = buildRecommendationDifferences(simulations);
  const comparisonSummary = buildComparisonSummaryText(
    simulations,
    highestRiskScenario,
    mostStableScenario,
    confidenceSpread,
  );
  const summary = buildComparisonParagraph(
    simulations,
    highestRiskScenario,
    mostStableScenario,
    confidenceSpread,
    truncatedWarning,
  );

  return {
    simulations,
    comparisonSummary,
    comparisonRows,
    highestRiskScenario,
    mostStableScenario,
    recommendationDifferences,
    confidenceSpread,
    summary,
  };
}

export const TREASURY_SIMULATION_TIMELINES = [
  {
    id: "calm_to_pressure",
    name: "Calm to Pressure",
    description:
      "Progressive escalation from stable soft-launch posture through moderate to high synthetic withdrawal pressure.",
    steps: ["stable_soft_launch", "moderate_withdrawal_spike", "high_withdrawal_spike"],
  },
  {
    id: "pressure_to_recovery",
    name: "Pressure to Recovery",
    description:
      "Stress peak followed by payout delay pressure and normalization advisory — recovery outlook path only.",
    steps: ["high_withdrawal_spike", "payout_delay_pressure", "recovery_after_pressure"],
  },
  {
    id: "fraud_cluster_escalation",
    name: "Fraud Cluster Escalation",
    description:
      "Gradual integrity stress from calm baseline through withdrawal uptick, fraud clustering, and leadership visibility.",
    steps: [
      "stable_soft_launch",
      "moderate_withdrawal_spike",
      "fraud_signal_cluster",
      "leadership_visibility_case",
    ],
  },
  {
    id: "scaling_stress_path",
    name: "Scaling Stress Path",
    description:
      "Scaling readiness tension emerging from soft launch through elevated liabilities and contradictory guidance.",
    steps: ["stable_soft_launch", "scaling_pressure", "contradictory_guidance"],
  },
  {
    id: "confidence_breakdown_path",
    name: "Confidence Breakdown Path",
    description:
      "Advisory confidence erosion from stable baseline through contradictory signals to low-confidence regime.",
    steps: ["stable_soft_launch", "contradictory_guidance", "confidence_collapse"],
  },
];

const TIMELINE_BY_ID = Object.fromEntries(TREASURY_SIMULATION_TIMELINES.map((t) => [t.id, t]));

const EMPTY_TIMELINE_RESULT = {
  timeline: null,
  steps: [],
  timelineSummary: "",
  postureProgression: [],
  confidenceProgression: [],
  regimeProgression: [],
  outlookProgression: [],
  recommendations: [],
  summary: "",
};

/** @returns {typeof TREASURY_SIMULATION_TIMELINES[number] | null} */
export function getTreasurySimulationTimeline(timelineId) {
  if (!timelineId) return null;
  return TIMELINE_BY_ID[String(timelineId)] || null;
}

function deriveStepPosture(simulatedResult) {
  const cc = simulatedResult.simulatedCommandCenter;
  if (cc?.commandStatus) return humanizeToken(cc.commandStatus);
  const regimePosture = simulatedResult.simulatedRegime?.operatorPosture;
  if (regimePosture) return humanizeToken(regimePosture);
  return "Unknown";
}

function buildStepNarrative(scenario, simulatedResult, priorStep) {
  const posture = deriveStepPosture(simulatedResult);
  const regime = humanizeToken(simulatedResult.simulatedRegime.regime);
  const outlook = humanizeToken(simulatedResult.simulatedOutlook.outlook);
  const confidence = simulatedResult.confidence;

  if (!priorStep) {
    return `Timeline opens at ${scenario.name}: simulated posture ${posture}, ${regime} regime, ${outlook} outlook, confidence ${confidence}/100.`;
  }

  const priorPosture = priorStep.posture;
  const priorConfidence = priorStep.confidence;
  const confDelta = confidence - priorConfidence;
  const confPhrase =
    confDelta > 5
      ? "confidence rises"
      : confDelta < -5
        ? "confidence declines"
        : "confidence holds near prior level";

  return `Advancing to ${scenario.name}: posture shifts from ${priorPosture} to ${posture}; ${confPhrase} (${priorConfidence} → ${confidence}/100). Regime ${humanizeToken(simulatedResult.simulatedRegime.regime)}, outlook ${outlook} — advisory simulation only.`;
}

function buildTimelineSummaryText(timeline, steps) {
  if (steps.length === 0) return "";

  const first = steps[0];
  const last = steps[steps.length - 1];
  const firstPosture = first.posture;
  const lastPosture = last.posture;
  const lastOutlook = last.outlook;

  return `Simulated progression (${timeline.name}): from ${first.scenario.name} (${firstPosture}) through ${steps.length} advisory steps to ${last.scenario.name} (${lastPosture}), closing with ${lastOutlook} outlook.`;
}

function mergeTimelineRecommendations(steps, timeline) {
  const seen = new Set();
  const merged = [];

  steps.forEach((step) => {
    const recs = step.simulatedResult?.simulatedRecommendations || [];
    recs.forEach((rec) => {
      if (!seen.has(rec)) {
        seen.add(rec);
        merged.push(rec);
      }
    });
  });

  const timelineNotes = [
    `Timeline drill (${timeline.name}): review posture progression before mirroring any production advisory change.`,
    `End-state posture ${steps[steps.length - 1]?.posture || "unknown"} — maintain treasury paper mode; no operational execution from simulation.`,
  ];

  timelineNotes.forEach((note) => {
    if (!seen.has(note)) {
      seen.add(note);
      merged.push(note);
    }
  });

  return merged.slice(0, 10);
}

function buildTimelineParagraph(timeline, steps, timelineSummary) {
  const progressionLine = steps
    .map((s, i) => `Step ${i + 1} ${s.scenario.name}: ${s.posture}, ${s.confidence}/100`)
    .join("; ");

  return `${timelineSummary} Institutional stress timeline (${timeline.id}) across ${steps.length} synthetic scenarios. ${progressionLine}. Final regime ${steps[steps.length - 1]?.regime || "n/a"}, outlook ${steps[steps.length - 1]?.outlook || "n/a"}. Read-only advisory — no production treasury data is changed.`;
}

/**
 * Run a deterministic multi-step treasury simulation timeline (read-only, advisory).
 * @param {string} timelineId
 * @returns {typeof EMPTY_TIMELINE_RESULT}
 */
export function runTreasurySimulationTimeline(timelineId) {
  const timeline = getTreasurySimulationTimeline(timelineId);
  if (!timeline) return { ...EMPTY_TIMELINE_RESULT };

  const stepIds = timeline.steps || [];
  const invalid = stepIds.filter((id) => !getTreasurySimulationScenario(id));
  if (invalid.length > 0 || stepIds.length === 0) {
    return { ...EMPTY_TIMELINE_RESULT };
  }

  const steps = [];
  let priorStep = null;

  for (const scenarioId of stepIds) {
    const simulatedResult = runTreasurySimulation(scenarioId);
    if (!simulatedResult) continue;

    const posture = deriveStepPosture(simulatedResult);
    const confidence = simulatedResult.confidence;
    const regime = humanizeToken(simulatedResult.simulatedRegime.regime);
    const outlook = humanizeToken(simulatedResult.simulatedOutlook.outlook);
    const stepNarrative = buildStepNarrative(simulatedResult.scenario, simulatedResult, priorStep);

    const step = {
      scenario: simulatedResult.scenario,
      simulatedResult,
      stepNarrative,
      posture,
      confidence,
      regime,
      outlook,
    };

    steps.push(step);
    priorStep = step;
  }

  if (steps.length === 0) {
    return { ...EMPTY_TIMELINE_RESULT };
  }

  const postureProgression = steps.map((s) => s.posture);
  const confidenceProgression = steps.map((s) => s.confidence);
  const regimeProgression = steps.map((s) => s.regime);
  const outlookProgression = steps.map((s) => s.outlook);
  const timelineSummary = buildTimelineSummaryText(timeline, steps);
  const recommendations = mergeTimelineRecommendations(steps, timeline);
  const summary = buildTimelineParagraph(timeline, steps, timelineSummary);

  return {
    timeline,
    steps,
    timelineSummary,
    postureProgression,
    confidenceProgression,
    regimeProgression,
    outlookProgression,
    recommendations,
    summary,
  };
}

export const TREASURY_FAILURE_SIMULATION_MODES = [
  {
    id: "contradiction_test",
    name: "Contradiction Test",
    description:
      "Compare contradictory guidance against stable baseline to surface regime, outlook, and command posture mismatches.",
  },
  {
    id: "confidence_breakdown",
    name: "Confidence Breakdown",
    description:
      "Stress-test confidence erosion across advisory layers using the confidence collapse scenario.",
  },
  {
    id: "regime_conflict",
    name: "Regime Conflict",
    description:
      "Synthesize calm outlook tokens against severe escalation signals to detect regime classification tension.",
  },
  {
    id: "escalation_conflict",
    name: "Escalation Conflict",
    description:
      "Compare leadership visibility case against stable soft launch to expose escalation ambiguity.",
  },
  {
    id: "recommendation_instability",
    name: "Recommendation Instability",
    description:
      "Run the confidence breakdown timeline path to observe shifting recommendations across steps.",
  },
  {
    id: "coherence_failure",
    name: "Coherence Failure",
    description:
      "Exercise contradictory guidance with elevated contradiction density to degrade simulated coherence.",
  },
  {
    id: "drift_disagreement",
    name: "Drift Disagreement",
    description:
      "Compare recovery-after-pressure vs high-withdrawal-spike drift direction to detect advisory disagreement.",
  },
];

const FAILURE_MODE_BY_ID = Object.fromEntries(
  TREASURY_FAILURE_SIMULATION_MODES.map((m) => [m.id, m]),
);

const EMPTY_FAILURE_RESULT = {
  mode: null,
  findings: [],
  contradictions: [],
  confidenceImpact: { before: 0, after: 0, delta: 0, narrative: "" },
  coherenceImpact: "",
  advisoryStability: "stable",
  operatorRisk: "",
  recommendations: [],
  summary: "",
};

function deriveAdvisoryStability(contradictionCount, confidenceSpread) {
  const spread = confidenceSpread ?? 0;
  if (contradictionCount >= 6 || spread >= 35) return "fragmented";
  if (contradictionCount >= 4 || spread >= 22) return "unstable";
  if (contradictionCount >= 2 || spread >= 10) return "moderate_variation";
  return "stable";
}

function deriveOperatorRisk(advisoryStability, contradictionCount) {
  if (advisoryStability === "fragmented" || contradictionCount >= 6) {
    return "elevated interpretive caution";
  }
  if (advisoryStability === "unstable" || contradictionCount >= 4) {
    return "heightened advisory verification";
  }
  if (advisoryStability === "moderate_variation" || contradictionCount >= 2) {
    return "routine interpretive review";
  }
  return "calm observational posture";
}

function buildConfidenceImpact(before, after, narrative) {
  const delta = after - before;
  return {
    before,
    after,
    delta,
    narrative:
      narrative ||
      `Simulated confidence moved from ${before}/100 to ${after}/100 (Δ ${delta >= 0 ? "+" : ""}${delta}). Advisory humility language should scale with this spread.`,
  };
}

function buildCoherenceLabel(score, traceStatus) {
  if (score >= 75 && traceStatus !== "partially_traceable" && traceStatus !== "fragmented_trace") {
    return "aligned";
  }
  if (score >= 55) return "mild_conflict";
  if (score >= 40) return "moderate_conflict";
  return "severe_conflict";
}

function collectPostureMismatches(primary, baseline, labelPrimary, labelBaseline) {
  const mismatches = [];
  const fields = [
    ["commandStatus", "Command posture"],
    ["regime", "Regime"],
    ["outlook", "Outlook"],
  ];

  fields.forEach(([key, label]) => {
    const primaryVal =
      key === "commandStatus"
        ? primary.simulatedCommandCenter?.commandStatus
        : key === "regime"
          ? primary.simulatedRegime?.regime
          : primary.simulatedOutlook?.outlook;
    const baselineVal =
      key === "commandStatus"
        ? baseline.simulatedCommandCenter?.commandStatus
        : key === "regime"
          ? baseline.simulatedRegime?.regime
          : baseline.simulatedOutlook?.outlook;

    if (primaryVal && baselineVal && primaryVal !== baselineVal) {
      mismatches.push(
        `${label} mismatch: ${labelPrimary} → ${humanizeToken(primaryVal)} vs ${labelBaseline} → ${humanizeToken(baselineVal)}.`,
      );
    }
  });

  return mismatches;
}

function runContradictionTest() {
  const contradictory = runTreasurySimulation("contradictory_guidance");
  const stable = runTreasurySimulation("stable_soft_launch");
  const comparison = compareTreasurySimulations(["contradictory_guidance", "stable_soft_launch"]);

  const findings = [
    "Advisory contradiction detected in simulated posture between contradictory guidance and stable baseline.",
    `Contradictory scenario trace status: ${humanizeToken(contradictory.simulatedDecisionTrace.traceStatus)}.`,
    `Stable baseline confidence ${stable.confidence}/100 vs contradictory ${contradictory.confidence}/100.`,
  ];

  const contradictions = [
    ...collectPostureMismatches(contradictory, stable, "Contradictory Guidance", "Stable Soft Launch"),
    ...(comparison.recommendationDifferences || []).filter(
      (d) => !d.includes("aligned recommendations"),
    ),
  ];

  if (contradictory.scenario.syntheticInputs.contradictorySignals) {
    contradictions.push(
      "Synthetic contradictory guidance tokens active — regime classified as contradictory while readiness signal suggests hold position.",
    );
  }

  const beforeCoherence = buildCoherenceLabel(
    stable.scenario.syntheticInputs.coherenceScore,
    stable.simulatedDecisionTrace.traceStatus,
  );
  const afterCoherence = buildCoherenceLabel(
    contradictory.scenario.syntheticInputs.coherenceScore,
    contradictory.simulatedDecisionTrace.traceStatus,
  );

  const confidenceImpact = buildConfidenceImpact(
    stable.confidence,
    contradictory.confidence,
    `Baseline stable confidence ${stable.confidence}/100 erodes to ${contradictory.confidence}/100 under contradictory guidance — layered advisory should defer operational mirroring.`,
  );

  const advisoryStability = deriveAdvisoryStability(
    contradictions.length,
    comparison.confidenceSpread?.spread,
  );

  return {
    findings,
    contradictions,
    confidenceImpact,
    coherenceImpact: `Simulated coherence degraded from ${beforeCoherence} to ${afterCoherence}.`,
    advisoryStability,
    operatorRisk: deriveOperatorRisk(advisoryStability, contradictions.length),
    recommendations: [
      "Reconcile contradictory guidance layers before aligning production advisory posture.",
      "Treat regime and outlook divergence as simulation-only — verify against live mirrors separately.",
      "Maintain treasury paper mode; no wallet, payout, or withdrawal actions from this stress test.",
    ],
    summary:
      "Contradiction test complete: contradictory guidance produces measurable posture divergence from stable soft launch. Advisory contradiction detected in simulated posture — human reconciliation recommended before operational mirroring.",
  };
}

function runConfidenceBreakdown() {
  const collapse = runTreasurySimulation("confidence_collapse");
  const stable = runTreasurySimulation("stable_soft_launch");
  const timeline = runTreasurySimulationTimeline("confidence_breakdown_path");

  const layerConfidences = {
    overall: collapse.confidence,
    regime: collapse.simulatedRegime.regimeConfidence,
    outlook: collapse.simulatedOutlook.outlookConfidence,
    trace: collapse.simulatedDecisionTrace.confidence,
    input: collapse.scenario.syntheticInputs.confidenceScore,
  };

  const findings = [
    "Confidence breakdown stress test: advisory confidence collapses across simulated layers.",
    `Input confidence score ${layerConfidences.input}/100 drives low-confidence regime classification.`,
    `Trace status ${humanizeToken(collapse.simulatedDecisionTrace.traceStatus)} — explainability degraded in paper mode.`,
  ];

  if (timeline.steps?.length >= 2) {
    const first = timeline.steps[0].confidence;
    const last = timeline.steps[timeline.steps.length - 1].confidence;
    findings.push(
      `Timeline path confidence progression: ${first} → ${last}/100 across ${timeline.steps.length} steps.`,
    );
  }

  const contradictions = [
    `Regime confidence (${layerConfidences.regime}%) diverges from overall advisory confidence (${layerConfidences.overall}/100).`,
    `Outlook projects ${humanizeToken(collapse.simulatedOutlook.outlookDirection)} direction while confidence remains below institutional threshold.`,
    `Command posture ${humanizeToken(collapse.simulatedCommandCenter.commandStatus)} paired with confidence ${layerConfidences.overall}/100 — interpretive tension detected.`,
  ];

  const confidenceImpact = buildConfidenceImpact(
    stable.confidence,
    collapse.confidence,
    `Confidence collapse scenario erodes advisory confidence from stable baseline ${stable.confidence}/100 to ${collapse.confidence}/100. Regime layer at ${layerConfidences.regime}%, trace at ${layerConfidences.trace}%.`,
  );

  const advisoryStability = deriveAdvisoryStability(
    contradictions.length,
    stable.confidence - collapse.confidence,
  );

  return {
    findings,
    contradictions,
    confidenceImpact,
    coherenceImpact: `Simulated coherence degraded from ${buildCoherenceLabel(stable.scenario.syntheticInputs.coherenceScore, stable.simulatedDecisionTrace.traceStatus)} to ${buildCoherenceLabel(collapse.scenario.syntheticInputs.coherenceScore, collapse.simulatedDecisionTrace.traceStatus)} under confidence collapse.`,
    advisoryStability,
    operatorRisk: deriveOperatorRisk(advisoryStability, contradictions.length),
    recommendations: [
      "Lower confidence — widen human verification before any treasury operational change.",
      "Review confidence breakdown timeline progression before declaring advisory normalization.",
      "Label all outputs as simulation-only; no production treasury mutations implied.",
    ],
    summary:
      "Confidence breakdown validation complete: layered confidence erosion detected across regime, outlook, trace, and overall advisory scores. Institutional humility language should prevail until human verification.",
  };
}

function runRegimeConflict() {
  const leadership = runTreasurySimulation("leadership_visibility_case");
  const stable = runTreasurySimulation("stable_soft_launch");

  const syntheticCalmOutlook = {
    ...stable.scenario.syntheticInputs,
    driftStatus: "improving",
    coherenceScore: 82,
    attentionLevel: "quiet",
    contradictorySignals: false,
    leadershipVisibility: false,
  };

  const syntheticSevereEscalation = {
    ...leadership.scenario.syntheticInputs,
    attentionLevel: "active_review",
    withdrawalSpikePct: 78,
    alertPriority: "high",
    fraudClusterCount: 4,
  };

  const calmCommand = buildSimulatedCommandCenter(syntheticCalmOutlook);
  const severeCommand = buildSimulatedCommandCenter(syntheticSevereEscalation);
  const calmRegime = buildSimulatedRegime(syntheticCalmOutlook, calmCommand);
  const severeRegime = buildSimulatedRegime(syntheticSevereEscalation, severeCommand);
  const calmOutlook = buildSimulatedOutlook(syntheticCalmOutlook, calmRegime);

  const findings = [
    "Regime conflict stress test: calm outlook tokens synthesized against severe escalation signals.",
    `Calm synthetic outlook: ${humanizeToken(calmOutlook.outlook)} with ${humanizeToken(calmOutlook.outlookDirection)} direction.`,
    `Severe escalation command: ${humanizeToken(severeCommand.commandStatus)} with regime ${humanizeToken(severeRegime.regime)}.`,
    `Production scenario comparison — stable ${humanizeToken(stable.simulatedRegime.regime)} vs leadership ${humanizeToken(leadership.simulatedRegime.regime)}.`,
  ];

  const contradictions = [
    `Outlook calm (${humanizeToken(calmOutlook.outlook)}) conflicts with severe command posture (${humanizeToken(severeCommand.commandStatus)}).`,
    `Regime divergence: calm classification ${humanizeToken(calmRegime.regime)} vs escalation classification ${humanizeToken(severeRegime.regime)}.`,
    `Attention level tension: quiet outlook inputs vs active_review escalation inputs.`,
    ...collectPostureMismatches(leadership, stable, "Leadership Visibility", "Stable Soft Launch"),
  ];

  const confidenceImpact = buildConfidenceImpact(
    stable.confidence,
    leadership.confidence,
    `Regime conflict injects calm-to-severe spread: stable ${stable.confidence}/100 vs leadership visibility ${leadership.confidence}/100 — classification ambiguity increases interpretive burden.`,
  );

  const advisoryStability = deriveAdvisoryStability(
    contradictions.length,
    Math.abs(stable.confidence - leadership.confidence),
  );

  return {
    findings,
    contradictions,
    confidenceImpact,
    coherenceImpact: `Simulated coherence degraded from aligned to mild_conflict — calm outlook and severe escalation cannot be reconciled without human judgment.`,
    advisoryStability,
    operatorRisk: deriveOperatorRisk(advisoryStability, contradictions.length),
    recommendations: [
      "Do not auto-resolve regime conflict — classify advisory outputs by source layer before mirroring.",
      "Verify whether calm outlook or escalation signals reflect current production mirrors independently.",
      "Prepare leadership briefing only after reconciling regime classification tension (simulation drill).",
    ],
    summary:
      "Regime conflict validation complete: calm outlook synthesized against severe escalation produces irreconcilable regime tokens in paper mode. Advisory contradiction detected in simulated posture.",
  };
}

function runEscalationConflict() {
  const leadership = runTreasurySimulation("leadership_visibility_case");
  const stable = runTreasurySimulation("stable_soft_launch");
  const comparison = compareTreasurySimulations(["leadership_visibility_case", "stable_soft_launch"]);

  const findings = [
    "Escalation conflict stress test: leadership visibility case compared against stable soft launch baseline.",
    `Escalation ambiguity — command ${humanizeToken(leadership.simulatedCommandCenter.commandStatus)} vs stable ${humanizeToken(stable.simulatedCommandCenter.commandStatus)}.`,
    `Leadership visibility flagged: ${leadership.scenario.syntheticInputs.leadershipVisibility ? "yes" : "no"} (simulation).`,
    `Priority spread: ${humanizeToken(stable.simulatedCommandCenter.priorityLevel)} → ${humanizeToken(leadership.simulatedCommandCenter.priorityLevel)}.`,
  ];

  const contradictions = [
    ...collectPostureMismatches(leadership, stable, "Leadership Visibility", "Stable Soft Launch"),
    `Readiness signal tension: stable ${humanizeToken(stable.scenario.syntheticInputs.readinessSignal)} vs leadership ${humanizeToken(leadership.scenario.syntheticInputs.readinessSignal)}.`,
    `Escalation cadence ambiguous — ${humanizeToken(leadership.simulatedOperations.attentionLevel)} attention with ${humanizeToken(leadership.simulatedOutlook.outlook)} outlook.`,
  ];

  if (comparison.highestRiskScenario) {
    contradictions.push(
      `Highest synthetic risk assigned to ${comparison.highestRiskScenario.name} — escalation path unclear from stable baseline alone.`,
    );
  }

  const confidenceImpact = buildConfidenceImpact(
    stable.confidence,
    leadership.confidence,
    `Escalation conflict confidence band: stable ${stable.confidence}/100 to leadership ${leadership.confidence}/100. Spread ${comparison.confidenceSpread?.spread ?? Math.abs(stable.confidence - leadership.confidence)} points.`,
  );

  const advisoryStability = deriveAdvisoryStability(
    contradictions.length,
    comparison.confidenceSpread?.spread,
  );

  return {
    findings,
    contradictions,
    confidenceImpact,
    coherenceImpact: `Simulated coherence shifted from ${buildCoherenceLabel(stable.scenario.syntheticInputs.coherenceScore, stable.simulatedDecisionTrace.traceStatus)} to ${buildCoherenceLabel(leadership.scenario.syntheticInputs.coherenceScore, leadership.simulatedDecisionTrace.traceStatus)} under escalation conflict.`,
    advisoryStability,
    operatorRisk: deriveOperatorRisk(advisoryStability, contradictions.length),
    recommendations: [
      "Schedule calm leadership readout if escalation posture persists in production mirrors.",
      "Prepare executive-visible digest from simulation panels only — label as synthetic drill.",
      "Defer operational escalation until escalation ambiguity is reconciled by human review.",
    ],
    summary:
      "Escalation conflict validation complete: leadership visibility case introduces escalation ambiguity relative to stable baseline. Operators should apply elevated interpretive caution before mirroring advisory posture.",
  };
}

function runRecommendationInstability() {
  const timeline = runTreasurySimulationTimeline("confidence_breakdown_path");

  const findings = [
    "Recommendation instability stress test: confidence breakdown timeline executed for shifting advisory outputs.",
    `Timeline ${timeline.timeline?.name}: ${timeline.steps?.length || 0} steps with recommendation drift observed.`,
  ];

  const contradictions = [];
  const recSets = (timeline.steps || []).map((step) => ({
    name: step.scenario.name,
    recs: step.simulatedResult?.simulatedRecommendations || [],
  }));

  const allRecs = new Set();
  recSets.forEach(({ recs }) => recs.forEach((r) => allRecs.add(r)));

  allRecs.forEach((rec) => {
    const presentIn = recSets.filter(({ recs }) => recs.includes(rec)).map(({ name }) => name);
    if (presentIn.length > 0 && presentIn.length < recSets.length) {
      contradictions.push(
        `Recommendation instability: "${rec}" present in ${presentIn.join(", ")} only — absent from other timeline steps.`,
      );
    }
  });

  if (timeline.regimeProgression?.length > 1) {
    const uniqueRegimes = new Set(timeline.regimeProgression);
    if (uniqueRegimes.size > 1) {
      contradictions.push(
        `Regime progression instability: ${timeline.regimeProgression.join(" → ")}.`,
      );
    }
  }

  if (timeline.postureProgression?.length > 1) {
    contradictions.push(
      `Posture shifts across timeline: ${timeline.postureProgression.join(" → ")} — recommendations may conflict step-to-step.`,
    );
  }

  const firstConf = timeline.confidenceProgression?.[0] ?? 0;
  const lastConf = timeline.confidenceProgression?.[timeline.confidenceProgression.length - 1] ?? 0;

  const confidenceImpact = buildConfidenceImpact(
    firstConf,
    lastConf,
    `Timeline confidence breakdown path: ${firstConf}/100 → ${lastConf}/100. Recommendation set evolves with each step — operators should not cherry-pick end-state guidance alone.`,
  );

  const advisoryStability = deriveAdvisoryStability(
    contradictions.length,
    Math.abs(firstConf - lastConf),
  );

  return {
    findings,
    contradictions,
    confidenceImpact,
    coherenceImpact: `Simulated coherence degraded from aligned to moderate_conflict — recommendation instability across ${timeline.steps?.length || 0} timeline steps.`,
    advisoryStability,
    operatorRisk: deriveOperatorRisk(advisoryStability, contradictions.length),
    recommendations: [
      ...(timeline.recommendations || []).slice(0, 4),
      "Review full timeline progression before adopting any single-step recommendation.",
      "Treat shifting recommendations as simulation-only validation — no production treasury mutations.",
    ],
    summary:
      "Recommendation instability validation complete: confidence breakdown timeline produces shifting advisory recommendations across steps. Reasoning stability signal indicates whether operators should apply fragmented or moderate interpretive review.",
  };
}

function runCoherenceFailure() {
  const contradictory = runTreasurySimulation("contradictory_guidance");
  const comparison = compareTreasurySimulations([
    "contradictory_guidance",
    "stable_soft_launch",
    "confidence_collapse",
  ]);

  const findings = [
    "Coherence failure stress test: contradictory guidance exercised with multi-scenario contradiction density.",
    `Coherence score ${contradictory.scenario.syntheticInputs.coherenceScore}/100 with contradictory signals active.`,
    `Trace status ${humanizeToken(contradictory.simulatedDecisionTrace.traceStatus)} — partially fragmented advisory path.`,
    `Comparison across three scenarios yields ${comparison.recommendationDifferences?.length || 0} divergence observations.`,
  ];

  const contradictions = [
    ...(comparison.recommendationDifferences || []),
    "Contradictory guidance tokens prevent fully traceable decision path.",
    `Coherence score ${contradictory.scenario.syntheticInputs.coherenceScore}/100 below institutional alignment threshold (75).`,
    `Oscillating drift status paired with hold_position readiness — simulated coherence failure pattern.`,
  ];

  if (contradictory.simulatedCommandCenter.concerns?.length) {
    contradictions.push(
      ...contradictory.simulatedCommandCenter.concerns.map(
        (c) => `Command center concern: ${c}`,
      ),
    );
  }

  const stableConf = comparison.simulations?.find((s) => s.scenario.id === "stable_soft_launch")?.confidence ?? 80;

  const confidenceImpact = buildConfidenceImpact(
    stableConf,
    contradictory.confidence,
    `Coherence failure drives confidence from stable ${stableConf}/100 to contradictory ${contradictory.confidence}/100. High contradiction count (${contradictions.length}) amplifies interpretive fragmentation.`,
  );

  const advisoryStability = deriveAdvisoryStability(
    contradictions.length,
    comparison.confidenceSpread?.spread,
  );

  return {
    findings,
    contradictions,
    confidenceImpact,
    coherenceImpact: `Simulated coherence degraded from aligned to severe_conflict — ${contradictions.length} contradictions detected in paper mode.`,
    advisoryStability,
    operatorRisk: deriveOperatorRisk(advisoryStability, contradictions.length),
    recommendations: [
      "Reconcile contradictory guidance layers before aligning production advisory posture.",
      "Do not mirror fragmented trace outputs to operational systems without human sign-off.",
      "Re-run simulation after adjusting scenario inputs to compare advisory shapes.",
      "Maintain treasury paper mode — coherence failure is a validation signal only.",
    ],
    summary:
      "Coherence failure validation complete: high contradiction density under contradictory guidance degrades simulated coherence to severe conflict. Advisory contradiction detected — defer operational mirroring until human reconciliation.",
  };
}

function runDriftDisagreement() {
  const recovery = runTreasurySimulation("recovery_after_pressure");
  const spike = runTreasurySimulation("high_withdrawal_spike");
  const comparison = compareTreasurySimulations(["recovery_after_pressure", "high_withdrawal_spike"]);

  const recoveryDrift = recovery.scenario.syntheticInputs.driftStatus;
  const spikeDrift = spike.scenario.syntheticInputs.driftStatus;

  const findings = [
    "Drift disagreement stress test: recovery-after-pressure vs high-withdrawal-spike compared for drift direction conflict.",
    `Recovery drift status: ${humanizeToken(recoveryDrift)} (${humanizeToken(recovery.simulatedOutlook.outlookDirection)} outlook direction).`,
    `Spike drift status: ${humanizeToken(spikeDrift)} (${humanizeToken(spike.simulatedOutlook.outlookDirection)} outlook direction).`,
    `Regime comparison: ${humanizeToken(recovery.simulatedRegime.regime)} vs ${humanizeToken(spike.simulatedRegime.regime)}.`,
  ];

  const contradictions = [
    `Drift direction disagreement: recovery ${humanizeToken(recoveryDrift)} vs spike ${humanizeToken(spikeDrift)} — advisory layers cannot agree on near-term trajectory.`,
    ...collectPostureMismatches(recovery, spike, "Recovery After Pressure", "High Withdrawal Spike"),
    ...(comparison.recommendationDifferences || []).filter(
      (d) => !d.includes("aligned recommendations"),
    ),
  ];

  if (recoveryDrift === "improving" && spikeDrift === "deteriorating") {
    contradictions.push(
      "Canonical drift disagreement: improving recovery outlook conflicts with deteriorating spike outlook — operators must not blend these signals without context.",
    );
  }

  const confidenceImpact = buildConfidenceImpact(
    recovery.confidence,
    spike.confidence,
    `Drift disagreement confidence spread: recovery ${recovery.confidence}/100 vs spike ${spike.confidence}/100 (Δ ${spike.confidence - recovery.confidence}). Directional advisory conflict increases interpretive caution.`,
  );

  const advisoryStability = deriveAdvisoryStability(
    contradictions.length,
    comparison.confidenceSpread?.spread,
  );

  return {
    findings,
    contradictions,
    confidenceImpact,
    coherenceImpact: `Simulated coherence varies from ${buildCoherenceLabel(recovery.scenario.syntheticInputs.coherenceScore, recovery.simulatedDecisionTrace.traceStatus)} (recovery) to ${buildCoherenceLabel(spike.scenario.syntheticInputs.coherenceScore, spike.simulatedDecisionTrace.traceStatus)} (spike) — drift disagreement prevents unified posture.`,
    advisoryStability,
    operatorRisk: deriveOperatorRisk(advisoryStability, contradictions.length),
    recommendations: [
      "Recovery outlook is near-term advisory only — continue observation before declaring normalization.",
      "Monitor withdrawal velocity mirrors calmly — simulation does not enqueue real withdrawals.",
      "Do not merge drift signals from recovery and spike scenarios — treat as opposing paper-mode anchors.",
      "Verify production drift status independently before aligning advisory posture.",
    ],
    summary:
      "Drift disagreement validation complete: recovery and high-withdrawal-spike scenarios produce opposing drift directions in paper mode. Advisory contradiction detected in simulated posture — institutional review recommended.",
  };
}

const FAILURE_RUNNERS = {
  contradiction_test: runContradictionTest,
  confidence_breakdown: runConfidenceBreakdown,
  regime_conflict: runRegimeConflict,
  escalation_conflict: runEscalationConflict,
  recommendation_instability: runRecommendationInstability,
  coherence_failure: runCoherenceFailure,
  drift_disagreement: runDriftDisagreement,
};

/**
 * Run a deterministic treasury failure / contradiction stress test (read-only, advisory).
 * @param {string} modeId
 * @returns {typeof EMPTY_FAILURE_RESULT}
 */
export function runTreasuryFailureSimulation(modeId) {
  const mode = FAILURE_MODE_BY_ID[String(modeId || "")];
  if (!mode) {
    return {
      ...EMPTY_FAILURE_RESULT,
      mode: { id: String(modeId || ""), name: "Unknown mode" },
      summary:
        "Invalid failure simulation mode — select a valid stress test from the Contradiction & Failure Testing panel. No production treasury data is changed.",
      recommendations: [
        "Select a valid failure mode from TREASURY_FAILURE_SIMULATION_MODES.",
        "Treasury paper mode only — no database writes or financial mutations.",
      ],
    };
  }

  const runner = FAILURE_RUNNERS[mode.id];
  if (!runner) {
    return {
      ...EMPTY_FAILURE_RESULT,
      mode: { id: mode.id, name: mode.name },
      summary: `Failure mode "${mode.name}" is registered but not yet implemented. No production treasury data is changed.`,
    };
  }

  const result = runner();

  return {
    mode: { id: mode.id, name: mode.name },
    findings: result.findings || [],
    contradictions: result.contradictions || [],
    confidenceImpact: result.confidenceImpact || EMPTY_FAILURE_RESULT.confidenceImpact,
    coherenceImpact: result.coherenceImpact || "",
    advisoryStability: result.advisoryStability || "stable",
    operatorRisk: result.operatorRisk || "calm observational posture",
    recommendations: result.recommendations || [],
    summary: result.summary || "",
  };
}

const ALARMIST_PHRASES = [
  "crisis",
  "emergency",
  "system failure",
  "block payouts",
  "freeze",
];

const EXECUTION_PHRASES = [
  "execute",
  "block payouts",
  "freeze",
  "enqueue",
  "mutation",
  "mutate",
  "trigger payout",
  "initiate withdrawal",
  "force payout",
  "halt payouts",
  "suspend wallet",
];

const CATEGORY_EXPECTED_REGIMES = {
  stable: ["calm_operations", "elevated_monitoring"],
  withdrawal_spike: ["elevated_monitoring", "active_advisory_review", "liquidity_stress"],
  payout_pressure: ["payout_pressure", "elevated_monitoring", "active_advisory_review"],
  fraud_cluster: ["integrity_stress", "active_advisory_review"],
  contradictory_signals: ["contradictory_regime"],
  recovery: ["recovery_mode", "calm_operations", "elevated_monitoring"],
  confidence_stress: ["low_confidence_regime", "active_advisory_review"],
  scaling_pressure: ["scaling_tension", "active_advisory_review"],
  leadership_visibility: ["active_advisory_review", "elevated_monitoring", "scaling_tension"],
};

const CATEGORY_EXPECTED_OUTLOOKS = {
  stable: ["stabilizing_outlook", "cautious_outlook"],
  withdrawal_spike: ["cautious_outlook", "elevated_monitoring_outlook"],
  payout_pressure: ["cautious_outlook", "elevated_monitoring_outlook"],
  fraud_cluster: ["cautious_outlook", "elevated_monitoring_outlook", "deteriorating_outlook"],
  contradictory_signals: ["uncertain_outlook"],
  recovery: ["recovery_outlook", "improving_outlook", "stabilizing_outlook"],
  confidence_stress: ["deteriorating_outlook", "cautious_outlook"],
  scaling_pressure: ["cautious_outlook"],
  leadership_visibility: ["elevated_monitoring_outlook", "cautious_outlook"],
};

const ADVISORY_MARKERS = [
  "simulation",
  "advisory",
  "paper mode",
  "human",
  "verify",
  "observe",
  "monitor",
  "review",
  "reconcile",
  "no production",
  "no wallet",
  "no payout",
  "no withdrawal",
];

function isFailureTestResult(result) {
  return Boolean(
    result &&
      (result.findings || result.contradictions || result.advisoryStability) &&
      result.mode &&
      !result.scenario,
  );
}

function isSimulationResult(result) {
  return Boolean(result && result.scenario && result.simulatedRegime);
}

function collectTextFieldsFromSimulation(result) {
  const texts = [result.summary || ""];
  if (result.simulatedCommandCenter?.summary) texts.push(result.simulatedCommandCenter.summary);
  if (result.simulatedRegime?.summary) texts.push(result.simulatedRegime.summary);
  if (result.simulatedOutlook?.outlookSummary) texts.push(result.simulatedOutlook.outlookSummary);
  if (result.simulatedDecisionTrace?.traceSummary) texts.push(result.simulatedDecisionTrace.traceSummary);
  (result.simulatedRecommendations || []).forEach((r) => texts.push(r));
  (result.simulatedCommandCenter?.concerns || []).forEach((c) => texts.push(c));
  return texts.join(" ").toLowerCase();
}

function collectTextFieldsFromFailure(result) {
  const texts = [result.summary || "", result.coherenceImpact || "", result.operatorRisk || ""];
  (result.findings || []).forEach((f) => texts.push(f));
  (result.contradictions || []).forEach((c) => texts.push(c));
  (result.recommendations || []).forEach((r) => texts.push(r));
  if (result.confidenceImpact?.narrative) texts.push(result.confidenceImpact.narrative);
  return texts.join(" ").toLowerCase();
}

function countPhraseHits(text, phrases) {
  let hits = 0;
  phrases.forEach((phrase) => {
    if (text.includes(phrase.toLowerCase())) hits += 1;
  });
  return hits;
}

function deriveGrade(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

function deriveQualityLabel(issueCount, traceSteps, hasStrengths) {
  if (issueCount === 0 && traceSteps >= 4 && hasStrengths) return "strong";
  if (issueCount <= 1 && traceSteps >= 3) return "adequate";
  if (issueCount <= 3) return "mixed";
  return "weak";
}

function deriveConfidenceQuality(simConfidence, inputConfidence) {
  const delta = Math.abs(simConfidence - inputConfidence);
  if (delta <= 12) return "aligned";
  if (delta <= 22) return "moderate";
  if (delta <= 35) return "misaligned";
  return "degraded";
}

function computeSafetyScore(text, isFailure = false) {
  let safety = 100;
  const alarmistHits = countPhraseHits(text, ALARMIST_PHRASES);
  const executionHits = countPhraseHits(text, EXECUTION_PHRASES);
  safety -= alarmistHits * 12;
  safety -= executionHits * 18;
  if (isFailure && alarmistHits === 0 && executionHits === 0) {
    safety = Math.min(100, safety + 5);
  }
  return clamp(safety, 0, 100);
}

function scoreSimulationResult(result) {
  const scenario = result.scenario;
  const inputs = scenario?.syntheticInputs || {};
  const category = scenario?.category || "";
  const regime = result.simulatedRegime?.regime || "";
  const outlook = result.simulatedOutlook?.outlook || "";
  const traceSteps = result.simulatedDecisionTrace?.traceSteps?.length || 0;
  const recommendations = result.simulatedRecommendations || [];
  const allText = collectTextFieldsFromSimulation(result);

  let validationScore = 70;
  const issuesDetected = [];
  const strengths = [];

  const expectedRegimes = CATEGORY_EXPECTED_REGIMES[category] || [];
  const expectedOutlooks = CATEGORY_EXPECTED_OUTLOOKS[category] || [];

  if (expectedRegimes.includes(regime)) {
    validationScore += 8;
    strengths.push(`Regime ${humanizeToken(regime)} aligns with ${humanizeToken(category)} scenario category.`);
  } else if (expectedRegimes.length > 0) {
    validationScore -= 10;
    issuesDetected.push(
      `Regime/outlook mismatch: expected one of ${expectedRegimes.map(humanizeToken).join(", ")} for ${humanizeToken(category)} scenario, got ${humanizeToken(regime)}.`,
    );
  }

  if (expectedOutlooks.includes(outlook)) {
    validationScore += 6;
    strengths.push(`Outlook ${humanizeToken(outlook)} appropriate for scenario severity.`);
  } else if (expectedOutlooks.length > 0) {
    validationScore -= 8;
    issuesDetected.push(
      `Outlook mismatch: expected ${expectedOutlooks.map(humanizeToken).join(" or ")} for ${humanizeToken(category)}, got ${humanizeToken(outlook)}.`,
    );
  }

  const confidenceQuality = deriveConfidenceQuality(result.confidence ?? 0, inputs.confidenceScore ?? 0);
  if (confidenceQuality === "aligned") {
    validationScore += 6;
    strengths.push("Simulated confidence aligned with synthetic input confidence score.");
  } else if (confidenceQuality === "moderate") {
    validationScore += 2;
  } else if (confidenceQuality === "misaligned") {
    validationScore -= 8;
    issuesDetected.push(
      `Confidence misaligned: simulation ${result.confidence}/100 vs input ${inputs.confidenceScore}/100.`,
    );
  } else {
    validationScore -= 14;
    issuesDetected.push(
      `Confidence wildly misaligned: simulation ${result.confidence}/100 vs input ${inputs.confidenceScore}/100.`,
    );
  }

  if (traceSteps >= 4) {
    validationScore += 6;
    strengths.push(`Decision trace contains ${traceSteps} clear steps — fully traceable advisory path.`);
  } else if (traceSteps >= 3) {
    validationScore += 2;
  } else if (traceSteps === 0) {
    validationScore -= 15;
    issuesDetected.push("Empty decision trace — no advisory reasoning steps recorded.");
  } else {
    validationScore -= 5;
    issuesDetected.push(`Decision trace has only ${traceSteps} steps — below institutional clarity threshold.`);
  }

  if (recommendations.length === 0) {
    validationScore -= 12;
    issuesDetected.push("No recommendations generated — advisory output incomplete.");
  } else {
    const advisoryCount = recommendations.filter((r) =>
      ADVISORY_MARKERS.some((m) => r.toLowerCase().includes(m)),
    ).length;
    if (advisoryCount >= Math.ceil(recommendations.length * 0.6)) {
      validationScore += 5;
      strengths.push("Recommendations use institutional, advisory-only language.");
    } else {
      validationScore -= 4;
      issuesDetected.push("Recommendations lack sufficient advisory-only institutional framing.");
    }
  }

  const alarmistHits = countPhraseHits(allText, ALARMIST_PHRASES);
  if (alarmistHits === 0) {
    validationScore += 4;
    strengths.push("No alarmist language detected in summary or recommendations.");
  } else {
    validationScore -= alarmistHits * 10;
    issuesDetected.push(`Alarmist phrasing detected (${alarmistHits} hit${alarmistHits > 1 ? "s" : ""}) — tone should remain calm and institutional.`);
  }

  const executionHits = countPhraseHits(allText, EXECUTION_PHRASES);
  if (executionHits > 0) {
    validationScore -= executionHits * 12;
    issuesDetected.push(
      `Execution or mutation language detected (${executionHits} hit${executionHits > 1 ? "s" : ""}) — simulation must remain read-only.`,
    );
  }

  let coherenceScore = clamp(
    Math.round(
      (inputs.coherenceScore ?? 50) * 0.35 +
        (result.simulatedDecisionTrace?.confidence ?? 50) * 0.25 +
        (traceSteps >= 4 ? 20 : traceSteps >= 3 ? 12 : 5),
    ),
    0,
    100,
  );

  if (category === "contradictory_signals" || inputs.contradictorySignals) {
    const traceStatus = result.simulatedDecisionTrace?.traceStatus || "";
    const hasContradictionAck =
      traceStatus === "partially_traceable" ||
      allText.includes("contradict") ||
      allText.includes("reconcile") ||
      allText.includes("fragmented");
    if (hasContradictionAck) {
      validationScore += 5;
      coherenceScore = Math.min(100, coherenceScore + 8);
      strengths.push("Contradictory guidance scenario handled with appropriate coherence notes and reconciliation cues.");
    } else {
      validationScore -= 8;
      coherenceScore = Math.max(0, coherenceScore - 15);
      issuesDetected.push("Contradictory guidance scenario lacks explicit coherence or reconciliation acknowledgment.");
    }
  }

  const safetyScore = computeSafetyScore(allText, false);
  if (safetyScore < 70) {
    validationScore -= Math.round((100 - safetyScore) / 5);
  }

  validationScore = clamp(Math.round(validationScore), 0, 100);
  const validationGrade = deriveGrade(validationScore);
  const reasoningQuality = deriveQualityLabel(issuesDetected.length, traceSteps, strengths.length > 0);
  const recommendationQuality = deriveQualityLabel(
    issuesDetected.filter((i) => i.includes("Recommendation") || i.includes("mutation") || i.includes("alarmist")).length,
    recommendations.length,
    strengths.some((s) => s.includes("Recommendations")),
  );

  const validationSummary = [
    `Validation score ${validationScore}/100 (grade ${validationGrade}).`,
    reasoningQuality === "strong"
      ? "Reasoning quality is strong with clear trace and aligned posture."
      : reasoningQuality === "adequate"
        ? "Reasoning quality is adequate — minor gaps may exist in trace or alignment."
        : reasoningQuality === "mixed"
          ? "Reasoning quality is mixed — review issues before mirroring advisory posture."
          : "Reasoning quality is weak — significant validation concerns detected.",
    `Safety score ${safetyScore}/100; confidence quality ${confidenceQuality}.`,
    issuesDetected.length === 0
      ? "No critical validation issues detected."
      : `${issuesDetected.length} issue${issuesDetected.length > 1 ? "s" : ""} detected — see issues list.`,
  ].join(" ");

  return {
    validationScore,
    validationGrade,
    reasoningQuality,
    coherenceScore,
    confidenceQuality,
    safetyScore,
    recommendationQuality,
    issuesDetected,
    strengths,
    validationSummary,
  };
}

function scoreFailureTestResult(result) {
  const allText = collectTextFieldsFromFailure(result);
  const contradictionCount = (result.contradictions || []).length;
  const findingsCount = (result.findings || []).length;
  const recommendations = result.recommendations || [];

  let validationScore = 65;
  const issuesDetected = [];
  const strengths = [];

  if (contradictionCount >= 2) {
    validationScore += 12;
    strengths.push(`${contradictionCount} contradictions detected — stress test successfully surfaced advisory tension.`);
  } else if (contradictionCount === 1) {
    validationScore += 6;
    strengths.push("One contradiction detected — partial stress test coverage.");
  } else {
    validationScore -= 8;
    issuesDetected.push("No contradictions detected — failure test may not have exercised expected conflict patterns.");
  }

  if (findingsCount >= 2) {
    validationScore += 5;
    strengths.push(`${findingsCount} findings documented with institutional framing.`);
  } else if (findingsCount === 0) {
    validationScore -= 10;
    issuesDetected.push("No findings recorded — failure test output incomplete.");
  }

  const stability = result.advisoryStability || "stable";
  if (stability === "fragmented" || stability === "unstable") {
    validationScore += 4;
    strengths.push(`Advisory stability correctly labeled as ${humanizeToken(stability)} under stress.`);
  } else if (contradictionCount >= 4 && stability === "stable") {
    validationScore -= 10;
    issuesDetected.push("High contradiction count but advisory stability labeled stable — possible under-reporting.");
  }

  const operatorRisk = String(result.operatorRisk || "").toLowerCase();
  if (
    operatorRisk.includes("caution") ||
    operatorRisk.includes("verification") ||
    operatorRisk.includes("review") ||
    operatorRisk.includes("calm")
  ) {
    validationScore += 5;
    strengths.push("Operator risk posture remains calm and institutional under stress.");
  }

  const alarmistHits = countPhraseHits(allText, ALARMIST_PHRASES);
  if (alarmistHits === 0) {
    validationScore += 8;
    strengths.push("Advisory remained calm — no alarmist language under failure conditions.");
  } else {
    validationScore -= alarmistHits * 12;
    issuesDetected.push(`Alarmist language detected in failure test output (${alarmistHits} hit${alarmistHits > 1 ? "s" : ""}).`);
  }

  const executionHits = countPhraseHits(allText, EXECUTION_PHRASES);
  if (executionHits > 0) {
    validationScore -= executionHits * 15;
    issuesDetected.push("Execution or mutation language in failure test recommendations — safety violation.");
  } else {
    validationScore += 4;
    strengths.push("No execution or mutation language — read-only advisory maintained.");
  }

  if (recommendations.length >= 2) {
    const advisoryCount = recommendations.filter((r) =>
      ADVISORY_MARKERS.some((m) => r.toLowerCase().includes(m)),
    ).length;
    if (advisoryCount >= 1) {
      validationScore += 4;
      strengths.push("Failure test recommendations remain advisory-only.");
    }
  }

  const safetyScore = computeSafetyScore(allText, true);
  if (safetyScore >= 85) {
    validationScore += 3;
  } else {
    validationScore -= Math.round((85 - safetyScore) / 4);
  }

  let coherenceScore = 70;
  const coherenceImpact = String(result.coherenceImpact || "").toLowerCase();
  if (coherenceImpact.includes("severe") || coherenceImpact.includes("moderate")) {
    coherenceScore = coherenceImpact.includes("severe") ? 35 : 55;
    if (contradictionCount >= 3) {
      coherenceScore += 10;
      strengths.push("Coherence degradation appropriately reflected given contradiction density.");
    }
  } else if (coherenceImpact.includes("aligned") || coherenceImpact.includes("mild")) {
    coherenceScore = 78;
  }

  validationScore = clamp(Math.round(validationScore), 0, 100);
  const validationGrade = deriveGrade(validationScore);
  const reasoningQuality = deriveQualityLabel(issuesDetected.length, findingsCount + contradictionCount, strengths.length > 0);
  const recommendationQuality = deriveQualityLabel(
    issuesDetected.filter((i) => i.includes("Execution") || i.includes("alarmist")).length,
    recommendations.length,
    strengths.some((s) => s.includes("recommendations")),
  );

  const confidenceQuality =
    Math.abs(result.confidenceImpact?.delta ?? 0) <= 15
      ? "aligned"
      : Math.abs(result.confidenceImpact?.delta ?? 0) <= 30
        ? "moderate"
        : "misaligned";

  const validationSummary = [
    `Failure test validation score ${validationScore}/100 (grade ${validationGrade}).`,
    contradictionCount > 0
      ? `${contradictionCount} contradiction${contradictionCount > 1 ? "s" : ""} surfaced; advisory ${alarmistHits === 0 && executionHits === 0 ? "remained calm and safe" : "showed safety concerns"}.`
      : "No contradictions surfaced — review test coverage.",
    `Reasoning integrity under stress: ${reasoningQuality}. Safety score ${safetyScore}/100.`,
  ].join(" ");

  return {
    validationScore,
    validationGrade,
    reasoningQuality,
    coherenceScore: clamp(coherenceScore, 0, 100),
    confidenceQuality,
    safetyScore,
    recommendationQuality,
    issuesDetected,
    strengths,
    validationSummary,
  };
}

/**
 * Score a treasury simulation or failure test result (deterministic, rule-based).
 * @param {object} simulationResult — runTreasurySimulation output or failure test result
 * @returns {object}
 */
export function scoreTreasurySimulationResult(simulationResult) {
  if (!simulationResult) {
    return {
      validationScore: 0,
      validationGrade: "F",
      reasoningQuality: "weak",
      coherenceScore: 0,
      confidenceQuality: "degraded",
      safetyScore: 0,
      recommendationQuality: "weak",
      issuesDetected: ["No simulation result provided."],
      strengths: [],
      validationSummary: "Validation failed — no result to score.",
    };
  }

  if (isFailureTestResult(simulationResult)) {
    return scoreFailureTestResult(simulationResult);
  }

  if (isSimulationResult(simulationResult)) {
    return scoreSimulationResult(simulationResult);
  }

  return {
    validationScore: 0,
    validationGrade: "F",
    reasoningQuality: "weak",
    coherenceScore: 0,
    confidenceQuality: "degraded",
    safetyScore: 0,
    recommendationQuality: "weak",
    issuesDetected: ["Unrecognized result shape — cannot score."],
    strengths: [],
    validationSummary: "Validation failed — unrecognized result format.",
  };
}

function formatReportSection(title, lines) {
  const body = Array.isArray(lines) ? lines.filter(Boolean).join("\n") : String(lines || "");
  return `${title}\n${"=".repeat(title.length)}\n${body}`;
}

function buildSimulationValidationReport(result, score) {
  const scenarioName = result.scenario?.name || "Unknown scenario";
  const reportTitle = `Treasury Simulation Validation Report — ${scenarioName}`;
  const executiveSummary = [
    score.validationSummary,
    result.summary || "",
  ].filter(Boolean).join("\n\n");

  const safetyNotes = [
    "SIMULATION ONLY — read-only, advisory-only. No database writes or financial mutations.",
    score.safetyScore >= 85
      ? "Safety scan: no execution or alarmist language detected."
      : score.safetyScore >= 70
        ? "Safety scan: minor tone concerns — review recommendations for institutional framing."
        : "Safety scan: execution or alarmist language detected — do not mirror to production.",
    "No wallets, payouts, withdrawals, PayPal, or operational events were invoked.",
  ];

  const reportText = [
    reportTitle,
    `Generated: Treasury Simulation Lab (paper mode)`,
    "",
    formatReportSection("Executive Summary", executiveSummary),
    "",
    formatReportSection("Validation Metrics", [
      `Validation Score: ${score.validationScore}/100 (Grade ${score.validationGrade})`,
      `Reasoning Quality: ${score.reasoningQuality}`,
      `Coherence Score: ${score.coherenceScore}/100`,
      `Confidence Quality: ${score.confidenceQuality}`,
      `Safety Score: ${score.safetyScore}/100`,
      `Recommendation Quality: ${score.recommendationQuality}`,
      `Overall Confidence: ${result.confidence}/100`,
    ]),
    "",
    formatReportSection("Strengths", score.strengths.length ? score.strengths.map((s) => `• ${s}`).join("\n") : "None identified."),
    "",
    formatReportSection("Issues Detected", score.issuesDetected.length ? score.issuesDetected.map((i) => `• ${i}`).join("\n") : "None identified."),
    "",
    formatReportSection("Advisory Recommendations", (result.simulatedRecommendations || []).map((r) => `• ${r}`).join("\n") || "None."),
    "",
    formatReportSection("Safety Notes", safetyNotes.map((n) => `• ${n}`).join("\n")),
    "",
    "---",
    "End of validation report. Simulation only — no production treasury data changed.",
  ].join("\n");

  return {
    reportTitle,
    scenarioName,
    validationScore: score.validationScore,
    validationGrade: score.validationGrade,
    executiveSummary,
    strengths: score.strengths,
    issuesDetected: score.issuesDetected,
    recommendations: result.simulatedRecommendations || [],
    safetyNotes,
    reportText,
  };
}

function buildFailureValidationReport(result, score) {
  const scenarioName = result.mode?.name || "Unknown failure mode";
  const reportTitle = `Treasury Failure Test Validation Report — ${scenarioName}`;
  const executiveSummary = [
    score.validationSummary,
    result.summary || "",
  ].filter(Boolean).join("\n\n");

  const safetyNotes = [
    "STRESS TEST ONLY — read-only validation of advisory reasoning integrity.",
    score.safetyScore >= 85
      ? "Advisory remained calm under synthetic contradiction stress."
      : "Review failure test output for tone or execution language before operational mirroring.",
    `Operator risk posture: ${result.operatorRisk || "n/a"}.`,
    "No database writes, wallets, payouts, withdrawals, or operational events.",
  ];

  const reportText = [
    reportTitle,
    `Generated: Treasury Simulation Lab — Failure Testing (paper mode)`,
    "",
    formatReportSection("Executive Summary", executiveSummary),
    "",
    formatReportSection("Validation Metrics", [
      `Validation Score: ${score.validationScore}/100 (Grade ${score.validationGrade})`,
      `Reasoning Quality: ${score.reasoningQuality}`,
      `Coherence Score: ${score.coherenceScore}/100`,
      `Confidence Quality: ${score.confidenceQuality}`,
      `Safety Score: ${score.safetyScore}/100`,
      `Recommendation Quality: ${score.recommendationQuality}`,
      `Advisory Stability: ${humanizeToken(result.advisoryStability || "stable")}`,
      `Contradictions Detected: ${(result.contradictions || []).length}`,
    ]),
    "",
    formatReportSection("Strengths", score.strengths.length ? score.strengths.map((s) => `• ${s}`).join("\n") : "None identified."),
    "",
    formatReportSection("Issues Detected", score.issuesDetected.length ? score.issuesDetected.map((i) => `• ${i}`).join("\n") : "None identified."),
    "",
    formatReportSection("Contradictions Surfaced", (result.contradictions || []).length
      ? result.contradictions.map((c) => `• ${c}`).join("\n")
      : "None."),
    "",
    formatReportSection("Operator Recommendations", (result.recommendations || []).map((r) => `• ${r}`).join("\n") || "None."),
    "",
    formatReportSection("Safety Notes", safetyNotes.map((n) => `• ${n}`).join("\n")),
    "",
    "---",
    "End of failure test validation report. Stress test only — no production treasury data changed.",
  ].join("\n");

  return {
    reportTitle,
    scenarioName,
    validationScore: score.validationScore,
    validationGrade: score.validationGrade,
    executiveSummary,
    strengths: score.strengths,
    issuesDetected: score.issuesDetected,
    recommendations: result.recommendations || [],
    safetyNotes,
    reportText,
  };
}

/**
 * Build a plain-text validation report from simulation or failure test output.
 * @param {object} result — runTreasurySimulation or failure test output; optional pre-computed score via result._validationScore
 * @returns {object}
 */
export function buildTreasurySimulationValidationReport(result) {
  if (!result) {
    return {
      reportTitle: "Treasury Simulation Validation Report",
      scenarioName: "Unknown",
      validationScore: 0,
      validationGrade: "F",
      executiveSummary: "No result provided.",
      strengths: [],
      issuesDetected: ["No result to report."],
      recommendations: [],
      safetyNotes: ["Simulation only — no production data changed."],
      reportText: "Treasury Simulation Validation Report\n\nNo result provided.",
    };
  }

  const score = result._validationScore || scoreTreasurySimulationResult(result);

  if (isFailureTestResult(result)) {
    return buildFailureValidationReport(result, score);
  }

  if (isSimulationResult(result)) {
    return buildSimulationValidationReport(result, score);
  }

  return {
    reportTitle: "Treasury Simulation Validation Report",
    scenarioName: "Unknown",
    validationScore: score.validationScore,
    validationGrade: score.validationGrade,
    executiveSummary: score.validationSummary,
    strengths: score.strengths,
    issuesDetected: score.issuesDetected,
    recommendations: [],
    safetyNotes: ["Simulation only — no production data changed."],
    reportText: `Treasury Simulation Validation Report\n\n${score.validationSummary}`,
  };
}

const GRADE_ORDER = ["A", "B", "C", "D", "F"];

function downgradeGrade(grade, steps = 1) {
  const idx = GRADE_ORDER.indexOf(grade);
  if (idx < 0) return "F";
  return GRADE_ORDER[Math.min(GRADE_ORDER.length - 1, idx + steps)];
}

function capGradeAt(grade, maxGrade) {
  const idx = GRADE_ORDER.indexOf(grade);
  const maxIdx = GRADE_ORDER.indexOf(maxGrade);
  if (idx < 0 || maxIdx < 0) return grade;
  return idx < maxIdx ? maxGrade : grade;
}

function normalizeForDedupe(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeSimilarStrings(items) {
  const seen = new Set();
  const result = [];
  items.forEach((item) => {
    const key = normalizeForDedupe(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
}

function pickExtremeScenarioEntry(entries, pickWeakest) {
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => {
    const diff = a.score.validationScore - b.score.validationScore;
    if (diff !== 0) return pickWeakest ? diff : -diff;
    const nameDiff = String(a.scenarioName || "").localeCompare(String(b.scenarioName || ""));
    return pickWeakest ? nameDiff : -nameDiff;
  });
  const winner = sorted[0];
  return {
    scenarioId: winner.scenarioId,
    scenarioName: winner.scenarioName,
    validationScore: winner.score.validationScore,
    validationGrade: winner.score.validationGrade,
  };
}

function pickWeakestFailureEntry(entries) {
  if (!entries.length) return null;
  const sorted = [...entries].sort((a, b) => {
    const diff = a.score.validationScore - b.score.validationScore;
    if (diff !== 0) return diff;
    return String(a.modeName || "").localeCompare(String(b.modeName || ""));
  });
  const winner = sorted[0];
  return {
    mode: winner.mode,
    modeName: winner.modeName,
    validationScore: winner.score.validationScore,
    validationGrade: winner.score.validationGrade,
  };
}

function buildRegressionRecommendations(weakestScenario, weakestFailureMode, averageValidationScore, averageSafetyScore) {
  const recs = [];

  if (weakestScenario && weakestScenario.validationScore < 80) {
    recs.push(
      `Review validation gaps in "${weakestScenario.scenarioName}" (score ${weakestScenario.validationScore}/100) — reconcile regime, outlook, and trace alignment before mirroring advisory posture.`,
    );
  }

  if (weakestFailureMode && weakestFailureMode.validationScore < 80) {
    recs.push(
      `Strengthen failure test coverage for "${weakestFailureMode.modeName}" (score ${weakestFailureMode.validationScore}/100) — ensure contradictions surface with calm, read-only institutional framing.`,
    );
  }

  if (averageSafetyScore < 80) {
    recs.push(
      "Audit simulation copy for execution or mutation language — treasury paper mode must remain advisory-only across all scenarios and failure tests.",
    );
  }

  if (averageValidationScore < 85) {
    recs.push(
      "Schedule periodic regression suite runs after scenario or scoring rule changes to maintain institutional advisory quality baselines.",
    );
  }

  if (recs.length === 0) {
    recs.push(
      "Regression suite posture is stable — continue periodic paper-mode validation drills to preserve advisory quality.",
    );
    recs.push(
      "Maintain treasury simulation lab as read-only — no production treasury mutations implied by regression results.",
    );
  }

  return recs.slice(0, 4);
}

function buildRegressionSummary(regressionGrade, averageValidationScore, averageSafetyScore, scenarioCount, failureCount) {
  const totalRuns = scenarioCount + failureCount;
  const base = `Regression suite completed across ${totalRuns} synthetic runs (${scenarioCount} scenarios, ${failureCount} failure modes).`;

  if (regressionGrade === "A") {
    return `${base} Stable advisory safety posture with strong validation alignment (avg validation ${averageValidationScore}/100, safety ${averageSafetyScore}/100).`;
  }
  if (regressionGrade === "B") {
    return `${base} Generally stable advisory posture with minor validation gaps to monitor (avg validation ${averageValidationScore}/100, safety ${averageSafetyScore}/100).`;
  }
  if (regressionGrade === "C") {
    return `${base} Mixed validation results — review weakest scenarios and failure modes before operational mirroring (avg validation ${averageValidationScore}/100, safety ${averageSafetyScore}/100).`;
  }
  if (regressionGrade === "D") {
    return `${base} Elevated validation concerns detected — prioritize human review of low-scoring runs (avg validation ${averageValidationScore}/100, safety ${averageSafetyScore}/100).`;
  }
  return `${base} Significant validation gaps across the regression suite — defer advisory mirroring until issues are reconciled (avg validation ${averageValidationScore}/100, safety ${averageSafetyScore}/100).`;
}

/**
 * Run the full treasury simulation regression suite (read-only, advisory, deterministic).
 * Executes every scenario and failure mode, scores each result, and aggregates suite-level metrics.
 * @returns {object}
 */
export function runTreasurySimulationRegressionSuite() {
  const scenarioResults = TREASURY_SIMULATION_SCENARIOS.map((scenario) => {
    const result = runTreasurySimulation(scenario.id);
    const score = scoreTreasurySimulationResult(result);
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      result,
      score,
    };
  });

  const failureResults = TREASURY_FAILURE_SIMULATION_MODES.map((mode) => {
    const result = runTreasuryFailureSimulation(mode.id);
    const score = scoreTreasurySimulationResult(result);
    return {
      mode: mode.id,
      modeName: mode.name,
      result,
      score,
    };
  });

  const allScores = [...scenarioResults, ...failureResults].map((entry) => entry.score);
  const validationScores = allScores.map((s) => s.validationScore);
  const safetyScores = allScores.map((s) => s.safetyScore);

  const averageValidationScore =
    validationScores.length > 0
      ? Math.round(validationScores.reduce((sum, v) => sum + v, 0) / validationScores.length)
      : 0;
  const averageSafetyScore =
    safetyScores.length > 0
      ? Math.round(safetyScores.reduce((sum, v) => sum + v, 0) / safetyScores.length)
      : 0;

  const weakestScenario = pickExtremeScenarioEntry(scenarioResults, true);
  const strongestScenario = pickExtremeScenarioEntry(scenarioResults, false);
  const weakestFailureMode = pickWeakestFailureEntry(failureResults);

  let regressionGrade = deriveGrade(averageValidationScore);

  if (averageSafetyScore < 75) {
    regressionGrade = downgradeGrade(regressionGrade, 1);
  }

  const hasVeryLowSafety = allScores.some((s) => s.safetyScore < 60);
  if (hasVeryLowSafety) {
    regressionGrade = capGradeAt(regressionGrade, "C");
  }

  const issuesDetected = [];
  const strengths = [];

  [...scenarioResults, ...failureResults].forEach((entry) => {
    const label = entry.scenarioName || entry.modeName || "Unknown run";
    const { score } = entry;

    if (score.validationScore < 75 || score.safetyScore < 80) {
      if (score.validationScore < 75) {
        issuesDetected.push(
          `${label}: validation score ${score.validationScore}/100 (grade ${score.validationGrade}) — below institutional threshold.`,
        );
      }
      if (score.safetyScore < 80) {
        issuesDetected.push(
          `${label}: safety score ${score.safetyScore}/100 — review advisory tone and read-only framing.`,
        );
      }
      if (score.safetyScore < 60) {
        issuesDetected.push(
          `${label}: safety score ${score.safetyScore}/100 suggests possible execution or mutation language — simulation must remain read-only.`,
        );
      }
    }

    if (score.validationScore >= 85) {
      strengths.push(
        `${label}: validation score ${score.validationScore}/100 (grade ${score.validationGrade}) — strong advisory alignment.`,
      );
    }

    (score.issuesDetected || []).forEach((issue) => {
      issuesDetected.push(`${label}: ${issue}`);
    });

    if (score.validationScore >= 85) {
      (score.strengths || []).forEach((strength) => {
        strengths.push(`${label}: ${strength}`);
      });
    }
  });

  if (averageValidationScore >= 90) {
    strengths.push(
      `Suite average validation score ${averageValidationScore}/100 — regression baseline meets institutional quality threshold.`,
    );
  }

  if (averageSafetyScore >= 85 && !hasVeryLowSafety) {
    strengths.push(
      `Suite average safety score ${averageSafetyScore}/100 — advisory language remains calm and read-only across all runs.`,
    );
  }

  if (scenarioResults.length > 0 && failureResults.length > 0) {
    strengths.push(
      `Full coverage: ${scenarioResults.length} scenarios and ${failureResults.length} failure modes exercised deterministically in paper mode.`,
    );
  }

  const dedupedIssues = dedupeSimilarStrings(issuesDetected);
  const dedupedStrengths = dedupeSimilarStrings(strengths);

  const recommendations = buildRegressionRecommendations(
    weakestScenario,
    weakestFailureMode,
    averageValidationScore,
    averageSafetyScore,
  );

  const summary = buildRegressionSummary(
    regressionGrade,
    averageValidationScore,
    averageSafetyScore,
    scenarioResults.length,
    failureResults.length,
  );

  return {
    scenarioResults,
    failureResults,
    averageValidationScore,
    averageSafetyScore,
    weakestScenario,
    strongestScenario,
    weakestFailureMode,
    regressionGrade,
    issuesDetected: dedupedIssues,
    strengths: dedupedStrengths,
    recommendations,
    summary,
  };
}

const SENSITIVITY_PERTURBATION_DELTAS = {
  low: {
    readinessPct: 0.05,
    liquidityPressure: 5,
    operationalConfidence: 5,
    coherenceWeakening: 3,
    advisoryDrift: 3,
    leadershipReadiness: 4,
    metaReasoningTrust: 4,
  },
  moderate: {
    readinessPct: 0.1,
    liquidityPressure: 10,
    operationalConfidence: 10,
    coherenceWeakening: 7,
    advisoryDrift: 8,
    leadershipReadiness: 8,
    metaReasoningTrust: 9,
  },
  high: {
    readinessPct: 0.15,
    liquidityPressure: 20,
    operationalConfidence: 15,
    coherenceWeakening: 12,
    advisoryDrift: 15,
    leadershipReadiness: 14,
    metaReasoningTrust: 16,
  },
};

const DRIFT_STATUS_ORDINAL = {
  improving: 0,
  unchanged: 1,
  shifting: 2,
  oscillating: 3,
  deteriorating: 4,
};

function worsenDriftStatus(current, steps) {
  const order = ["improving", "unchanged", "shifting", "oscillating", "deteriorating"];
  const idx = order.indexOf(String(current || "unchanged"));
  const base = idx >= 0 ? idx : 1;
  return order[Math.min(order.length - 1, base + steps)];
}

function applyReadinessStress(inputs, deltas) {
  const next = { ...inputs };
  const shift = Math.round((next.scalingPressureIndex || 0) * deltas.readinessPct);
  next.scalingPressureIndex = clamp((next.scalingPressureIndex || 0) + shift, 0, 100);
  if (next.readinessSignal === "hold_position") next.readinessSignal = "tighten_observation";
  else if (next.readinessSignal === "continue_testing") next.readinessSignal = "tighten_observation";
  else if (next.readinessSignal === "tighten_observation") next.readinessSignal = "defer_expansion";
  return next;
}

function applyLiquidityPressure(inputs, deltas) {
  const next = { ...inputs };
  next.withdrawalSpikePct = clamp((next.withdrawalSpikePct || 0) + deltas.liquidityPressure, 0, 100);
  next.exposureUsd = Math.round((next.exposureUsd || 0) * (1 + deltas.liquidityPressure / 200));
  if (next.attentionLevel === "quiet") next.attentionLevel = "monitoring";
  else if (next.attentionLevel === "monitoring") next.attentionLevel = "elevated";
  return next;
}

function applyConfidenceStress(inputs, deltas) {
  const next = { ...inputs };
  next.confidenceScore = clamp((next.confidenceScore || 0) - deltas.operationalConfidence, 5, 95);
  return next;
}

function applyCoherenceStress(inputs, deltas) {
  const next = { ...inputs };
  next.coherenceScore = clamp((next.coherenceScore || 0) - deltas.coherenceWeakening, 5, 95);
  return next;
}

function applyAdvisoryDriftStress(inputs, deltas) {
  const next = { ...inputs };
  const driftSteps = deltas.advisoryDrift >= 12 ? 2 : deltas.advisoryDrift >= 7 ? 1 : 1;
  next.driftStatus = worsenDriftStatus(next.driftStatus, driftSteps);
  next.scalingPressureIndex = clamp((next.scalingPressureIndex || 0) + Math.round(deltas.advisoryDrift / 2), 0, 100);
  return next;
}

function applyLeadershipReadinessStress(inputs, deltas) {
  const next = { ...inputs };
  next.confidenceScore = clamp((next.confidenceScore || 0) - Math.round(deltas.leadershipReadiness * 0.6), 5, 95);
  if (next.leadershipVisibility && next.readinessSignal === "leadership_briefing") {
    next.readinessSignal = "tighten_observation";
  }
  return next;
}

function applyMetaReasoningTrustStress(inputs, deltas) {
  const next = { ...inputs };
  next.confidenceScore = clamp((next.confidenceScore || 0) - Math.round(deltas.metaReasoningTrust * 0.5), 5, 95);
  next.coherenceScore = clamp((next.coherenceScore || 0) - Math.round(deltas.metaReasoningTrust * 0.35), 5, 95);
  if (next.contradictorySignals) {
    next.driftStatus = worsenDriftStatus(next.driftStatus, 1);
  }
  return next;
}

function applyCombinedModerateStress(inputs, deltas) {
  let next = applyReadinessStress(inputs, deltas);
  next = applyLiquidityPressure(next, {
    ...deltas,
    liquidityPressure: Math.round(deltas.liquidityPressure * 0.6),
  });
  next = applyConfidenceStress(next, {
    ...deltas,
    operationalConfidence: Math.round(deltas.operationalConfidence * 0.7),
  });
  next = applyCoherenceStress(next, {
    ...deltas,
    coherenceWeakening: Math.round(deltas.coherenceWeakening * 0.7),
  });
  next = applyAdvisoryDriftStress(next, {
    ...deltas,
    advisoryDrift: Math.round(deltas.advisoryDrift * 0.6),
  });
  return next;
}

function buildSensitivityVariationSpecs(level) {
  const deltas = SENSITIVITY_PERTURBATION_DELTAS[level];
  return [
    {
      variationLabel: "Readiness stress (down)",
      perturbationApplied: `Scaling readiness −${Math.round(deltas.readinessPct * 100)}% (synthetic scaling pressure +${Math.round(deltas.readinessPct * 100)}%)`,
      apply: (inputs) => applyReadinessStress(inputs, deltas),
    },
    {
      variationLabel: "Liquidity pressure (up)",
      perturbationApplied: `Liquidity pressure +${deltas.liquidityPressure} (withdrawal spike & exposure synthetic uplift)`,
      apply: (inputs) => applyLiquidityPressure(inputs, deltas),
    },
    {
      variationLabel: "Operational confidence (down)",
      perturbationApplied: `Operational confidence −${deltas.operationalConfidence}`,
      apply: (inputs) => applyConfidenceStress(inputs, deltas),
    },
    {
      variationLabel: "Coherence weakening",
      perturbationApplied: `Coherence score −${deltas.coherenceWeakening}`,
      apply: (inputs) => applyCoherenceStress(inputs, deltas),
    },
    {
      variationLabel: "Combined moderate stress",
      perturbationApplied: `Readiness, liquidity, confidence, coherence, and drift overlays at ${level} perturbation`,
      apply: (inputs) => applyCombinedModerateStress(inputs, deltas),
    },
  ];
}

function countRecommendationChanges(baselineRecs, variationRecs) {
  const baseSet = new Set(baselineRecs || []);
  const varSet = new Set(variationRecs || []);
  let changed = 0;
  varSet.forEach((r) => {
    if (!baseSet.has(r)) changed += 1;
  });
  baseSet.forEach((r) => {
    if (!varSet.has(r)) changed += 1;
  });
  return changed;
}

function deriveCoherenceProxy(result) {
  const inputs = result.scenario?.syntheticInputs || {};
  const traceConf = result.simulatedDecisionTrace?.confidence ?? 0;
  return clamp(Math.round((inputs.coherenceScore ?? 50) * 0.55 + traceConf * 0.45), 0, 100);
}

function deriveAdvisoryDriftProxy(result) {
  const inputs = result.scenario?.syntheticInputs || {};
  const driftOrd = DRIFT_STATUS_ORDINAL[String(inputs.driftStatus || "unchanged")] ?? 1;
  const scaling = inputs.scalingPressureIndex ?? 0;
  return driftOrd * 18 + scaling * 0.35;
}

function deriveTrustProxy(result) {
  const inputs = result.scenario?.syntheticInputs || {};
  const traceConf = result.simulatedDecisionTrace?.confidence ?? 0;
  return clamp(
    Math.round(
      (inputs.confidenceScore ?? 50) * 0.4 +
        (inputs.coherenceScore ?? 50) * 0.3 +
        traceConf * 0.3,
    ),
    0,
    100,
  );
}

function deriveRecommendationShiftLevel(avgRecChange, maxRecChange, regimeChanges, commandEscalations) {
  if (maxRecChange >= 6 || regimeChanges >= 3 || commandEscalations >= 2) return "severe";
  if (avgRecChange >= 3 || regimeChanges >= 2 || commandEscalations >= 1) return "significant";
  if (avgRecChange >= 1.5 || regimeChanges >= 1) return "moderate";
  return "minimal";
}

function buildSensitivityRecommendations({
  robustnessGrade,
  recommendationShift,
  perturbationLevel,
  hasExecutionLanguage,
  stabilityScore,
}) {
  const recs = [
    "Treasury sensitivity testing is simulation-only — no production treasury mutations or operational execution.",
    `Perturbation level ${perturbationLevel} applied to synthetic inputs only; re-run at alternate levels to compare robustness bands.`,
  ];

  if (robustnessGrade === "A" || robustnessGrade === "B") {
    recs.push("Advisory posture remained institutionally stable under synthetic perturbation — suitable for continued paper-mode validation.");
  } else if (robustnessGrade === "C") {
    recs.push("Moderate sensitivity detected — schedule calm human review before mirroring advisory posture to production monitors.");
  } else {
    recs.push("Elevated sensitivity under perturbation — defer operational mirroring until advisory layers are reconciled in paper mode.");
  }

  if (recommendationShift === "severe" || recommendationShift === "significant") {
    recs.push("Recommendation text shifted materially under stress — treat outputs as directional until baseline alignment is restored.");
  }

  if (hasExecutionLanguage) {
    recs.push("Execution or mutation phrasing surfaced in a variation — verify copy remains read-only before any institutional sharing.");
  }

  if (stabilityScore < 70) {
    recs.push("Stability score below institutional comfort band — expand trace review and meta-reasoning checks in simulation lab.");
  }

  return recs.slice(0, 6);
}

function buildSensitivitySummary({
  robustnessGrade,
  recommendationShift,
  perturbationLevel,
  stabilityScore,
  baseScenarioName,
}) {
  const gradeNarrative = {
    A: "Advisory posture remained stable under perturbation.",
    B: "Advisory posture remained largely stable with minor synthetic variation.",
    C: "Moderate sensitivity observed — advisory outputs shifted under controlled perturbation.",
    D: "Unstable advisory response — material shifts detected across synthetic stress variations.",
    F: "Highly unstable advisory response — significant recommendation and confidence drift under perturbation.",
  };

  return [
    `Sensitivity test for ${baseScenarioName} at ${perturbationLevel} perturbation: stability ${stabilityScore}/100 (grade ${robustnessGrade}).`,
    gradeNarrative[robustnessGrade] || gradeNarrative.C,
    `Recommendation shift classified as ${recommendationShift} — institutional review in paper mode only.`,
  ].join(" ");
}

/**
 * Run treasury sensitivity simulation — deterministic perturbation overlay vs baseline (read-only).
 * @param {{ baseScenario: string, perturbationLevel: 'low' | 'moderate' | 'high' }} params
 * @returns {null | object}
 */
export function runTreasurySensitivitySimulation({ baseScenario, perturbationLevel }) {
  const scenarioId = String(baseScenario || "");
  const level = String(perturbationLevel || "").toLowerCase();

  if (!scenarioId || !SENSITIVITY_PERTURBATION_DELTAS[level]) {
    return null;
  }

  const scenarioMeta = getTreasurySimulationScenario(scenarioId);
  if (!scenarioMeta) return null;

  const baseline = runTreasurySimulation(scenarioId);
  if (!baseline) return null;

  const baselineCoherence = deriveCoherenceProxy(baseline);
  const baselineDrift = deriveAdvisoryDriftProxy(baseline);
  const baselineTrust = deriveTrustProxy(baseline);
  const baselineRegime = baseline.simulatedRegime?.regime;
  const baselineCommand = baseline.simulatedCommandCenter?.commandStatus;

  const specs = buildSensitivityVariationSpecs(level);
  const resultRows = [];
  let totalConfDelta = 0;
  let totalCoherenceDelta = 0;
  let totalDriftDelta = 0;
  let totalTrustDelta = 0;
  let totalRecChange = 0;
  let maxRecChange = 0;
  let regimeChanges = 0;
  let commandEscalations = 0;
  let hasExecutionLanguage = false;
  let stabilityPenalty = 0;

  specs.forEach((spec) => {
    const variation = runTreasurySimulationWithPerturbations(scenarioId, spec.apply);
    if (!variation) return;

    const confidenceDelta = Math.abs((variation.confidence ?? 0) - (baseline.confidence ?? 0));
    const coherenceDelta = Math.abs(deriveCoherenceProxy(variation) - baselineCoherence);
    const driftDelta = Math.abs(deriveAdvisoryDriftProxy(variation) - baselineDrift);
    const trustDelta = Math.abs(deriveTrustProxy(variation) - baselineTrust);
    const recChanged = countRecommendationChanges(
      baseline.simulatedRecommendations,
      variation.simulatedRecommendations,
    );
    const validationScore = scoreTreasurySimulationResult(variation);

    totalConfDelta += confidenceDelta;
    totalCoherenceDelta += coherenceDelta;
    totalDriftDelta += driftDelta;
    totalTrustDelta += trustDelta;
    totalRecChange += recChanged;
    maxRecChange = Math.max(maxRecChange, recChanged);

    if (variation.simulatedRegime?.regime !== baselineRegime) regimeChanges += 1;
    const cmdOrd = COMMAND_STATUS_ORDINAL[variation.simulatedCommandCenter?.commandStatus] ?? 0;
    const baseCmdOrd = COMMAND_STATUS_ORDINAL[baselineCommand] ?? 0;
    if (cmdOrd > baseCmdOrd) commandEscalations += 1;

    if (countPhraseHits(collectTextFieldsFromSimulation(variation), EXECUTION_PHRASES) > 0) {
      hasExecutionLanguage = true;
      stabilityPenalty += 12;
    }

    stabilityPenalty +=
      confidenceDelta * 0.9 + recChanged * 4 + (variation.simulatedRegime?.regime !== baselineRegime ? 8 : 0);

    const notes = [];
    if (recChanged === 0) notes.push("Recommendations unchanged vs baseline.");
    else notes.push(`${recChanged} recommendation line(s) shifted vs baseline.`);
    if (confidenceDelta >= 8) notes.push(`Confidence moved ${confidenceDelta} points under perturbation.`);
    if (variation.simulatedRegime?.regime !== baselineRegime) {
      notes.push(
        `Regime shifted ${humanizeToken(baselineRegime)} → ${humanizeToken(variation.simulatedRegime.regime)}.`,
      );
    }

    resultRows.push({
      variationLabel: spec.variationLabel,
      perturbationApplied: spec.perturbationApplied,
      validationScore: validationScore?.validationScore,
      confidenceDelta,
      recommendationChanged: recChanged > 0,
      notes: notes.join(" "),
    });
  });

  const variationCount = Math.max(resultRows.length, 1);
  const confidenceShift = Math.round((totalConfDelta / variationCount) * 10) / 10;
  const coherenceShift = Math.round((totalCoherenceDelta / variationCount) * 10) / 10;
  const advisoryDriftChange = Math.round((totalDriftDelta / variationCount) * 10) / 10;
  const trustShift = Math.round((totalTrustDelta / variationCount) * 10) / 10;
  const avgRecChange = totalRecChange / variationCount;

  const recommendationShift = deriveRecommendationShiftLevel(
    avgRecChange,
    maxRecChange,
    regimeChanges,
    commandEscalations,
  );

  let stabilityScore = clamp(100 - Math.round(stabilityPenalty / variationCount), 0, 100);
  if (hasExecutionLanguage) {
    stabilityScore = Math.min(stabilityScore, 72);
  }

  let robustnessGrade = deriveGrade(stabilityScore);

  if (recommendationShift === "severe") {
    robustnessGrade = capGradeAt(robustnessGrade, "D");
  }

  if (level === "high" && confidenceShift > 20) {
    robustnessGrade = downgradeGrade(robustnessGrade, 1);
  }

  if (hasExecutionLanguage) {
    robustnessGrade = capGradeAt(robustnessGrade, "C");
  }

  const sensitivitySummary = buildSensitivitySummary({
    robustnessGrade,
    recommendationShift,
    perturbationLevel: level,
    stabilityScore,
    baseScenarioName: scenarioMeta.name,
  });

  const recommendations = buildSensitivityRecommendations({
    robustnessGrade,
    recommendationShift,
    perturbationLevel: level,
    hasExecutionLanguage,
    stabilityScore,
  });

  return {
    baseScenarioId: scenarioMeta.id,
    baseScenarioName: scenarioMeta.name,
    perturbationLevel: level,
    stabilityScore,
    recommendationShift,
    confidenceShift,
    coherenceShift,
    advisoryDriftChange,
    trustShift,
    robustnessGrade,
    sensitivitySummary,
    recommendations,
    resultRows,
  };
}

/** Allowed Monte Carlo iteration counts for advisory stability testing. */
export const TREASURY_MONTE_CARLO_ITERATIONS = [50, 100, 250, 500];

function hashSeedString(str) {
  let h = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function mulberryRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomIntInRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

function randomFloatInRange(rng, min, max) {
  return min + rng() * (max - min);
}

function normalizeMonteCarloIterations(iterations) {
  const n = Number(iterations);
  if (TREASURY_MONTE_CARLO_ITERATIONS.includes(n)) return n;
  if (!Number.isFinite(n) || n <= 0) return 100;
  let nearest = 100;
  let minDist = Infinity;
  TREASURY_MONTE_CARLO_ITERATIONS.forEach((allowed) => {
    const dist = Math.abs(n - allowed);
    if (dist < minDist) {
      minDist = dist;
      nearest = allowed;
    }
  });
  return nearest;
}

function buildMonteCarloPerturbation(baseScenarioId, iterationIndex) {
  const seed = hashSeedString(`${baseScenarioId}:${iterationIndex}`);
  const rng = mulberry32(seed);

  const readinessPct = randomFloatInRange(rng, 0.05, 0.15);
  const coherenceWeakening = randomIntInRange(rng, 2, 12);
  const advisoryDrift = randomIntInRange(rng, 2, 18);
  const operationalConfidence = randomIntInRange(rng, 3, 18);
  const leadershipReadiness = randomIntInRange(rng, 3, 14);
  const metaReasoningTrust = randomIntInRange(rng, 3, 16);
  const liquidityPressure = randomIntInRange(rng, 3, 20);
  const withdrawalSpikeExtra = randomIntInRange(rng, 0, 15);
  const timelineDisruption = rng() > 0.65;
  const instabilitySteps = randomIntInRange(rng, 0, 1);

  const deltas = {
    readinessPct,
    liquidityPressure,
    operationalConfidence,
    coherenceWeakening,
    advisoryDrift,
    leadershipReadiness,
    metaReasoningTrust,
  };

  const summaryParts = [
    `readiness −${Math.round(readinessPct * 100)}%`,
    `coherence −${coherenceWeakening}`,
    `drift +${advisoryDrift}`,
    `confidence −${operationalConfidence}`,
    `leadership −${leadershipReadiness}`,
    `trust −${metaReasoningTrust}`,
    `liquidity +${liquidityPressure}`,
  ];
  if (withdrawalSpikeExtra > 0) {
    summaryParts.push(`withdrawal spike +${withdrawalSpikeExtra}`);
  }
  if (timelineDisruption) {
    summaryParts.push("timeline stress overlay");
  }
  if (instabilitySteps > 0) {
    summaryParts.push("recommendation instability proxy");
  }

  return {
    perturbationSummary: summaryParts.join("; "),
    apply: (inputs) => {
      let next = applyReadinessStress(inputs, deltas);
      next = applyLiquidityPressure(next, {
        ...deltas,
        liquidityPressure: deltas.liquidityPressure + withdrawalSpikeExtra,
      });
      next = applyConfidenceStress(next, deltas);
      next = applyCoherenceStress(next, deltas);
      next = applyAdvisoryDriftStress(next, deltas);
      next = applyLeadershipReadinessStress(next, deltas);
      next = applyMetaReasoningTrustStress(next, deltas);
      if (instabilitySteps > 0) {
        next.driftStatus = worsenDriftStatus(next.driftStatus, instabilitySteps);
      }
      if (timelineDisruption) {
        next.payoutDelayHours = clamp((next.payoutDelayHours || 0) + randomIntInRange(rng, 4, 16), 0, 48);
        next.scalingPressureIndex = clamp((next.scalingPressureIndex || 0) + randomIntInRange(rng, 5, 15), 0, 100);
      }
      return next;
    },
  };
}

function computeMonteCarloIterationStabilityScore(baseline, variation, baselineCoherence, baselineTrust) {
  const confidenceDelta = Math.abs((variation.confidence ?? 0) - (baseline.confidence ?? 0));
  const recChanged = countRecommendationChanges(
    baseline.simulatedRecommendations,
    variation.simulatedRecommendations,
  );

  let penalty =
    confidenceDelta * 0.9 +
    recChanged * 4 +
    Math.abs(deriveCoherenceProxy(variation) - baselineCoherence) * 0.35 +
    Math.abs(deriveTrustProxy(variation) - baselineTrust) * 0.25;

  if (variation.simulatedRegime?.regime !== baseline.simulatedRegime?.regime) {
    penalty += 8;
  }

  const cmdOrd = COMMAND_STATUS_ORDINAL[variation.simulatedCommandCenter?.commandStatus] ?? 0;
  const baseCmdOrd = COMMAND_STATUS_ORDINAL[baseline.simulatedCommandCenter?.commandStatus] ?? 0;
  if (cmdOrd > baseCmdOrd) {
    penalty += 6;
  }

  if (countPhraseHits(collectTextFieldsFromSimulation(variation), EXECUTION_PHRASES) > 0) {
    penalty += 12;
  }

  return clamp(100 - Math.round(penalty), 0, 100);
}

function deriveMonteCarloRecommendationVolatility(changePct) {
  if (changePct >= 50) return "severe";
  if (changePct >= 30) return "high";
  if (changePct >= 15) return "moderate";
  return "low";
}

function bucketMonteCarloStabilityScore(score) {
  if (score >= 90) return "excellent";
  if (score >= 80) return "stable";
  if (score >= 70) return "moderate";
  if (score >= 60) return "weak";
  return "unstable";
}

function computeStdDev(values) {
  if (!values.length) return 0;
  if (values.length === 1) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function buildMonteCarloIterationNotes(baseline, variation, stabilityScore, recChanged) {
  const notes = [];
  if (recChanged === 0) {
    notes.push("Recommendations aligned with baseline.");
  } else {
    notes.push(`${recChanged} recommendation line(s) shifted vs baseline.`);
  }
  const confDelta = Math.abs((variation.confidence ?? 0) - (baseline.confidence ?? 0));
  if (confDelta >= 8) {
    notes.push(`Confidence moved ${confDelta} points under synthetic perturbation.`);
  }
  if (variation.simulatedRegime?.regime !== baseline.simulatedRegime?.regime) {
    notes.push(
      `Regime shifted ${humanizeToken(baseline.simulatedRegime?.regime)} → ${humanizeToken(variation.simulatedRegime?.regime)}.`,
    );
  }
  if (stabilityScore >= 90) {
    notes.push("Iteration remained institutionally stable.");
  } else if (stabilityScore < 60) {
    notes.push("Iteration showed elevated advisory instability.");
  }
  return notes.join(" ");
}

function buildMonteCarloFindings({
  averageStabilityScore,
  recommendationVolatility,
  iterationsRun,
  recChangePct,
  hasExecutionLanguage,
  stabilityStdDev,
  stabilityDistribution,
}) {
  const findings = [
    `Monte Carlo advisory stability test completed across ${iterationsRun} synthetic perturbation environments (paper mode only).`,
    `Average stability score ${averageStabilityScore}/100 with standard deviation ${Math.round(stabilityStdDev * 10) / 10}.`,
    `Recommendation volatility classified as ${recommendationVolatility} (${Math.round(recChangePct)}% of iterations shifted recommendation text).`,
  ];

  if (stabilityDistribution.excellent + stabilityDistribution.stable >= iterationsRun * 0.75) {
    findings.push("Majority of iterations remained in stable or excellent stability bands.");
  } else if (stabilityDistribution.unstable + stabilityDistribution.weak >= iterationsRun * 0.35) {
    findings.push("Material share of iterations fell into weak or unstable stability bands.");
  }

  if (stabilityStdDev > 15) {
    findings.push("High stability score variance across iterations — advisory posture sensitivity is uneven under synthetic stress.");
  }

  if (hasExecutionLanguage) {
    findings.push("Execution or mutation phrasing surfaced in at least one iteration — verify copy remains read-only.");
  }

  return findings.slice(0, 6);
}

function buildMonteCarloRecommendations({
  robustnessGrade,
  recommendationVolatility,
  averageStabilityScore,
  hasExecutionLanguage,
}) {
  const recs = [
    "Treasury Monte Carlo stability testing is simulation-only — no production treasury mutations or operational execution.",
    "Re-run at alternate iteration counts to compare robustness bands; results remain in session state only.",
  ];

  if (robustnessGrade === "A" || robustnessGrade === "B") {
    recs.push(
      "Treasury guidance remained institutionally stable across synthetic advisory environments — suitable for continued paper-mode validation.",
    );
  } else if (robustnessGrade === "C") {
    recs.push("Moderate instability detected — schedule calm human review before mirroring advisory posture to production monitors.");
  } else {
    recs.push("Elevated instability under Monte Carlo stress — defer operational mirroring until advisory layers are reconciled in paper mode.");
  }

  if (recommendationVolatility === "severe" || recommendationVolatility === "high") {
    recs.push("Recommendation text shifted materially across iterations — treat outputs as directional until baseline alignment is restored.");
  }

  if (hasExecutionLanguage) {
    recs.push("Execution or mutation phrasing surfaced in a variation — verify copy remains read-only before any institutional sharing.");
  }

  if (averageStabilityScore < 70) {
    recs.push("Average stability below institutional comfort band — expand trace review and meta-reasoning checks in simulation lab.");
  }

  return recs.slice(0, 6);
}

function buildMonteCarloSummary({
  robustnessGrade,
  averageStabilityScore,
  iterationsRun,
  baseScenarioName,
  recommendationVolatility,
}) {
  const gradeNarrative = {
    A: `Treasury guidance remained stable across ${iterationsRun} synthetic advisory environments.`,
    B: `Treasury guidance remained largely stable across ${iterationsRun} synthetic advisory environments with minor variation.`,
    C: `Moderate advisory instability observed across ${iterationsRun} synthetic environments — review recommended in paper mode.`,
    D: `Unstable advisory response detected across ${iterationsRun} synthetic environments — material shifts under Monte Carlo stress.`,
    F: `Highly unstable advisory response across ${iterationsRun} synthetic environments — significant recommendation and confidence drift.`,
  };

  return [
    `Monte Carlo stability test for ${baseScenarioName}: average stability ${averageStabilityScore}/100 (grade ${robustnessGrade}).`,
    gradeNarrative[robustnessGrade] || gradeNarrative.C,
    `Recommendation volatility ${recommendationVolatility} — institutional review in paper mode only.`,
  ].join(" ");
}

/**
 * Run treasury Monte Carlo advisory stability simulation — seeded random perturbations vs baseline (read-only).
 * @param {{ baseScenario: string, iterations?: number }} params
 * @returns {null | object}
 */
export function runTreasuryMonteCarloSimulation({ baseScenario, iterations = 100 }) {
  const scenarioId = String(baseScenario || "");
  const scenarioMeta = getTreasurySimulationScenario(scenarioId);
  if (!scenarioMeta) return null;

  const iterationsRun = normalizeMonteCarloIterations(iterations);
  const baseline = runTreasurySimulation(scenarioId);
  if (!baseline) return null;

  const baselineCoherence = deriveCoherenceProxy(baseline);
  const baselineTrust = deriveTrustProxy(baseline);

  const resultRows = [];
  const stabilityScores = [];
  let totalConfidence = 0;
  let totalCoherence = 0;
  let totalTrust = 0;
  let recChangeCount = 0;
  let hasExecutionLanguage = false;

  const stabilityDistribution = {
    excellent: 0,
    stable: 0,
    moderate: 0,
    weak: 0,
    unstable: 0,
  };

  for (let i = 1; i <= iterationsRun; i += 1) {
    const perturbation = buildMonteCarloPerturbation(scenarioId, i);
    const variation = runTreasurySimulationWithPerturbations(scenarioId, perturbation.apply);
    if (!variation) continue;

    const stabilityScore = computeMonteCarloIterationStabilityScore(
      baseline,
      variation,
      baselineCoherence,
      baselineTrust,
    );
    const confidence = variation.confidence ?? 0;
    const coherence = deriveCoherenceProxy(variation);
    const trust = deriveTrustProxy(variation);
    const recChanged =
      countRecommendationChanges(
        baseline.simulatedRecommendations,
        variation.simulatedRecommendations,
      ) > 0;

    if (recChanged) recChangeCount += 1;

    if (countPhraseHits(collectTextFieldsFromSimulation(variation), EXECUTION_PHRASES) > 0) {
      hasExecutionLanguage = true;
    }

    stabilityScores.push(stabilityScore);
    totalConfidence += confidence;
    totalCoherence += coherence;
    totalTrust += trust;
    stabilityDistribution[bucketMonteCarloStabilityScore(stabilityScore)] += 1;

    const recChangeLines = countRecommendationChanges(
      baseline.simulatedRecommendations,
      variation.simulatedRecommendations,
    );

    resultRows.push({
      iteration: i,
      stabilityScore,
      confidence,
      coherence,
      trust,
      recommendationChanged: recChanged,
      perturbationSummary: perturbation.perturbationSummary,
      notes: buildMonteCarloIterationNotes(baseline, variation, stabilityScore, recChangeLines),
    });
  }

  const effectiveCount = Math.max(resultRows.length, 1);
  const averageStabilityScore = Math.round(
    stabilityScores.reduce((sum, v) => sum + v, 0) / effectiveCount,
  );
  const averageConfidence = Math.round((totalConfidence / effectiveCount) * 10) / 10;
  const averageCoherence = Math.round((totalCoherence / effectiveCount) * 10) / 10;
  const averageTrust = Math.round((totalTrust / effectiveCount) * 10) / 10;
  const recChangePct = (recChangeCount / effectiveCount) * 100;
  const recommendationVolatility = deriveMonteCarloRecommendationVolatility(recChangePct);
  const stabilityStdDev = computeStdDev(stabilityScores);

  let robustnessGrade = deriveGrade(averageStabilityScore);

  if (recommendationVolatility === "severe") {
    robustnessGrade = capGradeAt(robustnessGrade, "D");
  } else if (recommendationVolatility === "high") {
    robustnessGrade = downgradeGrade(robustnessGrade, 1);
  }

  if (hasExecutionLanguage) {
    robustnessGrade = capGradeAt(robustnessGrade, "C");
  }

  if (stabilityStdDev > 15) {
    robustnessGrade = downgradeGrade(robustnessGrade, 1);
  }

  const sortedByStability = [...resultRows].sort((a, b) => a.stabilityScore - b.stabilityScore);
  const weakestRow = sortedByStability[0] || null;
  const strongestRow = sortedByStability[sortedByStability.length - 1] || null;

  const weakestIteration = weakestRow
    ? {
        iteration: weakestRow.iteration,
        stabilityScore: weakestRow.stabilityScore,
        perturbationSummary: weakestRow.perturbationSummary,
        notes: weakestRow.notes,
      }
    : null;

  const strongestIteration = strongestRow
    ? {
        iteration: strongestRow.iteration,
        stabilityScore: strongestRow.stabilityScore,
        perturbationSummary: strongestRow.perturbationSummary,
        notes: strongestRow.notes,
      }
    : null;

  const findings = buildMonteCarloFindings({
    averageStabilityScore,
    recommendationVolatility,
    iterationsRun: resultRows.length,
    recChangePct,
    hasExecutionLanguage,
    stabilityStdDev,
    stabilityDistribution,
  });

  const recommendations = buildMonteCarloRecommendations({
    robustnessGrade,
    recommendationVolatility,
    averageStabilityScore,
    hasExecutionLanguage,
  });

  const summary = buildMonteCarloSummary({
    robustnessGrade,
    averageStabilityScore,
    iterationsRun: resultRows.length,
    baseScenarioName: scenarioMeta.name,
    recommendationVolatility,
  });

  return {
    baseScenarioId: scenarioMeta.id,
    baseScenarioName: scenarioMeta.name,
    iterationsRun: resultRows.length,
    averageStabilityScore,
    averageConfidence,
    averageCoherence,
    averageTrust,
    recommendationVolatility,
    stabilityDistribution,
    robustnessGrade,
    weakestIteration,
    strongestIteration,
    findings,
    recommendations,
    summary,
    resultRows,
  };
}

/** Allowed level tokens for custom scenario builder dropdowns. */
export const TREASURY_SCENARIO_LEVELS = ["low", "moderate", "high"];

/** Deterministic numeric mapping for custom scenario dimensions. */
export const TREASURY_SCENARIO_LEVEL_VALUES = {
  liquidityPressure: { low: 5, moderate: 15, high: 30 },
  confidence: { low: 45, moderate: 65, high: 85 },
  coherence: { low: 40, moderate: 62, high: 82 },
  trust: { low: 42, moderate: 64, high: 84 },
  operationalLoad: { low: 3, moderate: 8, high: 16 },
  leadershipReadiness: { low: 38, moderate: 60, high: 80 },
  advisoryDrift: { low: 3, moderate: 10, high: 22 },
  recommendationStability: { low: 35, moderate: 58, high: 80 },
};

/** Default custom scenario builder inputs — all moderate. */
export const DEFAULT_CUSTOM_SCENARIO_INPUTS = {
  liquidityPressure: "moderate",
  confidence: "moderate",
  coherence: "moderate",
  trust: "moderate",
  operationalLoad: "moderate",
  leadershipReadiness: "moderate",
  advisoryDrift: "moderate",
  recommendationStability: "moderate",
};

const CUSTOM_SCENARIO_DIMENSION_LABELS = {
  liquidityPressure: "Liquidity Pressure",
  confidence: "Confidence",
  coherence: "Coherence",
  trust: "Trust",
  operationalLoad: "Operational Load",
  leadershipReadiness: "Leadership Readiness",
  advisoryDrift: "Advisory Drift",
  recommendationStability: "Recommendation Stability",
};

/**
 * Map a level token to its numeric synthetic value for a given dimension.
 * @param {'low'|'moderate'|'high'} level
 * @param {keyof typeof TREASURY_SCENARIO_LEVEL_VALUES} dimension
 * @returns {number}
 */
export function mapTreasuryScenarioLevel(level, dimension) {
  const key = String(level || "moderate").toLowerCase();
  const normalized = TREASURY_SCENARIO_LEVELS.includes(key) ? key : "moderate";
  return TREASURY_SCENARIO_LEVEL_VALUES[dimension]?.[normalized] ?? TREASURY_SCENARIO_LEVEL_VALUES[dimension].moderate;
}

function normalizeCustomScenarioLevel(level) {
  const key = String(level || "moderate").toLowerCase();
  return TREASURY_SCENARIO_LEVELS.includes(key) ? key : "moderate";
}

function humanizeScenarioLevel(level) {
  const key = normalizeCustomScenarioLevel(level);
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function mapNumericCustomInputsToSyntheticInputs(numeric) {
  const {
    liquidityPressure,
    confidence,
    coherence,
    trust,
    operationalLoad,
    leadershipReadiness,
    advisoryDrift,
    recommendationStability,
  } = numeric;

  const withdrawalSpikePct = liquidityPressure;
  const liabilitiesUsd = Math.round(800 + liquidityPressure * 140 + operationalLoad * 45);
  const exposureUsd = Math.round(liabilitiesUsd * (0.28 + liquidityPressure / 180));

  let driftStatus = "unchanged";
  if (advisoryDrift >= 18) driftStatus = "deteriorating";
  else if (advisoryDrift >= 12) driftStatus = "oscillating";
  else if (advisoryDrift >= 6) driftStatus = "shifting";
  else if (recommendationStability >= 70 && advisoryDrift <= 5) driftStatus = "improving";

  let attentionLevel = "quiet";
  if (operationalLoad >= 14 || liquidityPressure >= 25) attentionLevel = "elevated";
  else if (operationalLoad >= 7 || liquidityPressure >= 12) attentionLevel = "monitoring";
  else if (operationalLoad >= 4 || liquidityPressure >= 8) attentionLevel = "monitoring";

  let alertPriority = "low";
  if (operationalLoad >= 14 || liquidityPressure >= 25 || advisoryDrift >= 18) alertPriority = "high";
  else if (operationalLoad >= 7 || liquidityPressure >= 12 || advisoryDrift >= 10) alertPriority = "moderate";
  else if (operationalLoad >= 4 || liquidityPressure >= 8) alertPriority = "moderate";

  let readinessSignal = "hold_position";
  if (leadershipReadiness >= 75) readinessSignal = "continue_testing";
  else if (leadershipReadiness >= 58) readinessSignal = "hold_position";
  else if (leadershipReadiness >= 48) readinessSignal = "tighten_observation";
  else readinessSignal = "defer_expansion";

  const leadershipVisibility = leadershipReadiness >= 68;
  const contradictorySignals = recommendationStability < 48 || (advisoryDrift >= 16 && recommendationStability < 55);
  const fraudClusterCount = operationalLoad >= 14 ? 5 : operationalLoad >= 10 ? 3 : operationalLoad >= 6 ? 1 : 0;
  const payoutDelayHours = operationalLoad >= 14 ? 28 : operationalLoad >= 10 ? 14 : operationalLoad >= 6 ? 4 : 0;
  const scalingPressureIndex = clamp(Math.round(advisoryDrift * 2.2 + operationalLoad * 1.8), 8, 95);
  const softLaunch = liquidityPressure <= 8 && operationalLoad <= 4 && advisoryDrift <= 6;

  const confidenceScore = clamp(Math.round(confidence * 0.7 + trust * 0.3), 5, 95);
  const coherenceScore = clamp(Math.round(coherence * 0.75 + recommendationStability * 0.25), 5, 95);

  return {
    liabilitiesUsd,
    exposureUsd,
    softLaunch,
    attentionLevel,
    driftStatus,
    coherenceScore,
    alertPriority,
    readinessSignal,
    withdrawalSpikePct,
    payoutDelayHours,
    fraudClusterCount,
    confidenceScore,
    contradictorySignals,
    leadershipVisibility,
    scalingPressureIndex,
    liquidityPressure,
    confidence,
    coherence,
    trust,
    operationalLoad,
    leadershipReadiness,
    advisoryDrift,
    recommendationStability,
  };
}

function buildCustomScenarioName(levelInputs) {
  const highlights = Object.entries(CUSTOM_SCENARIO_DIMENSION_LABELS)
    .filter(([key]) => normalizeCustomScenarioLevel(levelInputs[key]) !== "moderate")
    .map(([key, label]) => `${humanizeScenarioLevel(levelInputs[key])} ${label}`);

  if (highlights.length === 0) {
    return "Custom: Balanced Moderate Profile";
  }

  return `Custom: ${highlights.slice(0, 4).join(" / ")}`;
}

function buildCustomProfileSummary(levelInputs, numeric) {
  const stressCount = Object.values(levelInputs).filter((v) => normalizeCustomScenarioLevel(v) === "high").length;
  const calmCount = Object.values(levelInputs).filter((v) => normalizeCustomScenarioLevel(v) === "low").length;

  const stressNote =
    stressCount >= 4
      ? "Elevated synthetic stress across multiple advisory dimensions."
      : stressCount >= 2
        ? "Moderate synthetic stress profile with selective pressure points."
        : stressCount === 1
          ? "Single elevated stress dimension — useful for targeted advisory validation."
          : "Calm synthetic profile suitable for baseline advisory posture testing.";

  const stabilityNote =
    numeric.recommendationStability >= 70
      ? "Recommendation stability is institutionally adequate for paper-mode review."
      : numeric.recommendationStability >= 50
        ? "Recommendation stability is mixed — expect moderate advisory variation under perturbation."
        : "Recommendation stability is low — advisory outputs may fragment under synthetic stress.";

  return [
    `Custom scenario builder profile: ${stressNote}`,
    stabilityNote,
    `Synthetic liquidity pressure ${numeric.liquidityPressure}, confidence ${numeric.confidence}, coherence ${numeric.coherence}, trust ${numeric.trust}.`,
    calmCount >= 3
      ? `${calmCount} dimension(s) at low stress — balanced against ${stressCount} elevated signal(s).`
      : "All dimensions mapped deterministically to paper-mode synthetic inputs.",
    "Simulation only — no production treasury data, wallets, or operational events affected.",
  ].join(" ");
}

function countCustomStressDimensions(levelInputs) {
  return Object.values(levelInputs).filter((v) => normalizeCustomScenarioLevel(v) === "high").length;
}

function buildCustomRobustnessAssessment(validationScore, levelInputs, numeric) {
  const stressCount = countCustomStressDimensions(levelInputs);
  const validation = validationScore?.validationScore ?? 0;
  const grade = validationScore?.validationGrade ?? "F";
  const sensitiveProfile =
    normalizeCustomScenarioLevel(levelInputs.advisoryDrift) === "high" &&
    normalizeCustomScenarioLevel(levelInputs.recommendationStability) === "low";

  let assessment;
  if (stressCount >= 3 && validation >= 75) {
    assessment = "Advisory posture held under elevated synthetic pressure — validation supports continued paper-mode testing.";
  } else if (stressCount >= 3 && validation >= 60) {
    assessment = "Advisory posture remained readable under elevated synthetic pressure, with moderate validation gaps worth human review.";
  } else if (stressCount >= 3) {
    assessment = "Elevated synthetic stress produced validation concerns — defer operational mirroring until advisory layers reconcile in paper mode.";
  } else if (stressCount >= 1 && validation >= 70) {
    assessment = "Targeted synthetic stress exercised advisory reasoning without material validation degradation.";
  } else if (validation >= 80) {
    assessment = "Custom profile produced stable advisory outputs suitable for institutional simulation review.";
  } else {
    assessment = "Custom profile surfaced validation gaps — schedule calm trace review before sharing advisory outputs.";
  }

  if (sensitiveProfile) {
    assessment += " Profile likely sensitive to perturbation (high advisory drift with low recommendation stability) — consider sensitivity testing for confirmation.";
  }

  assessment += ` Validation grade ${grade} at ${validation}/100.`;

  return assessment;
}

function buildCustomScenarioSummary(scenarioName, simulationResult, validationScore, levelInputs) {
  const regime = humanizeToken(simulationResult.simulatedRegime?.regime || "unknown");
  const outlook = humanizeToken(simulationResult.simulatedOutlook?.outlook || "unknown");
  const command = humanizeToken(simulationResult.simulatedCommandCenter?.commandStatus || "unknown");
  const stressCount = countCustomStressDimensions(levelInputs);

  return [
    `${scenarioName} completed in paper mode.`,
    `Command posture ${command}, regime ${regime}, outlook ${outlook}.`,
    `Overall confidence ${simulationResult.confidence}/100; validation ${validationScore.validationScore}/100 (grade ${validationScore.validationGrade}).`,
    stressCount > 0
      ? `${stressCount} dimension(s) at high synthetic stress — advisory outputs remain read-only and non-operational.`
      : "Balanced moderate synthetic profile — suitable for baseline advisory shape comparison.",
  ].join(" ");
}

function buildCustomScenarioRecommendations(validationScore, levelInputs, simulationResult) {
  const recs = [
    "Custom scenario builder output is simulation-only — no production treasury mutations, database writes, or financial flows.",
    "Re-run with adjusted dimension levels to compare advisory posture bands before any operational mirroring.",
  ];

  const stressCount = countCustomStressDimensions(levelInputs);
  const validation = validationScore?.validationScore ?? 0;

  if (validation >= 80) {
    recs.push("Validation score meets institutional comfort band — suitable for continued paper-mode advisory review.");
  } else if (validation >= 65) {
    recs.push("Validation score is adequate — review trace and recommendation language before institutional sharing.");
  } else {
    recs.push("Validation score below comfort band — expand human trace review and reconcile advisory gaps in simulation lab.");
  }

  if (stressCount >= 3) {
    recs.push("Multiple high-stress dimensions active — treat outputs as directional stress-test results, not production guidance.");
  }

  if (normalizeCustomScenarioLevel(levelInputs.advisoryDrift) === "high") {
    recs.push("High advisory drift configured — verify regime and outlook narratives remain institutionally calm under synthetic oscillation.");
  }

  if (normalizeCustomScenarioLevel(levelInputs.recommendationStability) === "low") {
    recs.push("Low recommendation stability — expect advisory text variation; confirm copy remains read-only before sharing.");
  }

  if (simulationResult.simulatedCommandCenter?.commandStatus !== "stable") {
    recs.push("Non-stable command posture detected — schedule calm leadership readout if similar signals appear in production mirrors.");
  }

  return recs.slice(0, 4);
}

/**
 * Build a custom treasury scenario from level-based builder inputs (paper mode).
 * @param {typeof DEFAULT_CUSTOM_SCENARIO_INPUTS} inputs
 * @returns {object}
 */
export function buildCustomTreasuryScenario(inputs) {
  const normalized = { ...DEFAULT_CUSTOM_SCENARIO_INPUTS, ...inputs };
  Object.keys(CUSTOM_SCENARIO_DIMENSION_LABELS).forEach((key) => {
    normalized[key] = normalizeCustomScenarioLevel(normalized[key]);
  });

  const numeric = {};
  Object.keys(CUSTOM_SCENARIO_DIMENSION_LABELS).forEach((key) => {
    numeric[key] = mapTreasuryScenarioLevel(normalized[key], key);
  });

  const syntheticInputs = mapNumericCustomInputsToSyntheticInputs(numeric);
  const scenarioName = buildCustomScenarioName(normalized);
  const profileSummary = buildCustomProfileSummary(normalized, numeric);

  return {
    scenarioId: "custom-built",
    scenarioName,
    category: "custom",
    syntheticInputs,
    generatedProfile: {
      liquidityPressure: normalized.liquidityPressure,
      confidence: normalized.confidence,
      coherence: normalized.coherence,
      trust: normalized.trust,
      operationalLoad: normalized.operationalLoad,
      leadershipReadiness: normalized.leadershipReadiness,
      advisoryDrift: normalized.advisoryDrift,
      recommendationStability: normalized.recommendationStability,
      profileSummary,
    },
  };
}

/**
 * Run a custom-built treasury scenario through the simulation pipeline (read-only).
 * @param {typeof DEFAULT_CUSTOM_SCENARIO_INPUTS} inputs
 * @returns {object}
 */
export function runCustomTreasurySimulation(inputs) {
  const scenario = buildCustomTreasuryScenario(inputs);
  const simulationResult = runTreasurySimulationForInputs(
    {
      id: scenario.scenarioId,
      name: scenario.scenarioName,
      category: scenario.category,
      description: scenario.generatedProfile.profileSummary,
    },
    { ...scenario.syntheticInputs },
  );
  const validationScore = scoreTreasurySimulationResult(simulationResult);
  const robustnessAssessment = buildCustomRobustnessAssessment(
    validationScore,
    { ...DEFAULT_CUSTOM_SCENARIO_INPUTS, ...inputs },
    scenario.syntheticInputs,
  );
  const summary = buildCustomScenarioSummary(
    scenario.scenarioName,
    simulationResult,
    validationScore,
    { ...DEFAULT_CUSTOM_SCENARIO_INPUTS, ...inputs },
  );
  const recommendations = buildCustomScenarioRecommendations(
    validationScore,
    { ...DEFAULT_CUSTOM_SCENARIO_INPUTS, ...inputs },
    simulationResult,
  );

  return {
    scenarioName: scenario.scenarioName,
    generatedProfile: scenario.generatedProfile,
    simulationResult,
    validationScore: validationScore.validationScore,
    validationGrade: validationScore.validationGrade,
    robustnessAssessment,
    summary,
    recommendations,
  };
}

/** Category tags for treasury scenario library filtering (paper mode). */
export const TREASURY_SCENARIO_CATEGORIES = [
  "Stress",
  "Recovery",
  "Leadership",
  "Operations",
  "Stability",
];

/**
 * Curated preset profiles for the custom scenario builder (read-only, no persistence).
 * Each preset maps to builder dimension levels; simulation runs only when the operator invokes run.
 */
export const TREASURY_SCENARIO_LIBRARY = [
  {
    id: "liquidity-crunch",
    name: "Liquidity Crunch",
    description:
      "Synthetic liquidity pressure rises while advisory confidence thins. Validates calm escalation and read-only monitoring posture under constrained paper-mode liquidity.",
    riskLevel: "high",
    expectedBehavior:
      "Elevate liquidity monitoring signals, tighten observation readiness, and keep recommendations institutionally calm without operational mirroring.",
    category: "Stress",
    inputs: {
      liquidityPressure: "high",
      confidence: "low",
      coherence: "moderate",
      trust: "moderate",
      operationalLoad: "moderate",
      leadershipReadiness: "moderate",
      advisoryDrift: "moderate",
      recommendationStability: "moderate",
    },
  },
  {
    id: "treasury-recovery",
    name: "Treasury Recovery",
    description:
      "Gradual improvement across confidence, coherence, and recommendation stability after a synthetic stress interval. Suitable for validating advisory normalization narratives.",
    riskLevel: "low",
    expectedBehavior:
      "Favor improving drift posture, stable command center language, and measured readiness to continue paper-mode testing.",
    category: "Recovery",
    inputs: {
      liquidityPressure: "low",
      confidence: "high",
      coherence: "high",
      trust: "high",
      operationalLoad: "low",
      leadershipReadiness: "high",
      advisoryDrift: "low",
      recommendationStability: "high",
    },
  },
  {
    id: "operational-breakdown",
    name: "Operational Breakdown",
    description:
      "Operational load overwhelms advisory coherence. Exercises fragmented trace handling and elevated monitoring copy without production coupling.",
    riskLevel: "elevated",
    expectedBehavior:
      "Surface operational watch flags, defer expansion readiness, and emphasize observability over decisive operational guidance.",
    category: "Operations",
    inputs: {
      liquidityPressure: "moderate",
      confidence: "moderate",
      coherence: "low",
      trust: "moderate",
      operationalLoad: "high",
      leadershipReadiness: "moderate",
      advisoryDrift: "moderate",
      recommendationStability: "low",
    },
  },
  {
    id: "leadership-visibility-gap",
    name: "Leadership Visibility Gap",
    description:
      "Leadership readiness lags while institutional trust remains moderate. Tests advisory framing for executive visibility gaps in paper mode.",
    riskLevel: "moderate",
    expectedBehavior:
      "Recommend calm leadership readouts, hold-position readiness, and trace steps that clarify visibility without triggering operational events.",
    category: "Leadership",
    inputs: {
      liquidityPressure: "moderate",
      confidence: "moderate",
      coherence: "moderate",
      trust: "moderate",
      operationalLoad: "low",
      leadershipReadiness: "low",
      advisoryDrift: "low",
      recommendationStability: "moderate",
    },
  },
  {
    id: "confidence-collapse",
    name: "Confidence Collapse",
    description:
      "Advisory confidence and institutional trust fall together under synthetic stress. Validates degradation handling while preserving read-only safety boundaries.",
    riskLevel: "critical",
    expectedBehavior:
      "Lower confidence bands in outputs, flag validation review, and maintain non-operational advisory language throughout the run.",
    category: "Stress",
    inputs: {
      liquidityPressure: "moderate",
      confidence: "low",
      coherence: "moderate",
      trust: "low",
      operationalLoad: "moderate",
      leadershipReadiness: "moderate",
      advisoryDrift: "high",
      recommendationStability: "low",
    },
  },
  {
    id: "advisory-drift-event",
    name: "Advisory Drift Event",
    description:
      "Elevated advisory drift with unstable recommendations. Stress-tests regime oscillation and outlook variation under controlled paper-mode perturbation.",
    riskLevel: "high",
    expectedBehavior:
      "Highlight drift deterioration, expect recommendation text variation, and recommend sensitivity confirmation before institutional sharing.",
    category: "Stress",
    inputs: {
      liquidityPressure: "moderate",
      confidence: "moderate",
      coherence: "moderate",
      trust: "moderate",
      operationalLoad: "low",
      leadershipReadiness: "moderate",
      advisoryDrift: "high",
      recommendationStability: "low",
    },
  },
  {
    id: "monitoring-overload",
    name: "Monitoring Overload",
    description:
      "High operational load with broadly elevated secondary stress dimensions. Simulates monitoring queue saturation without wallet or payout mutation.",
    riskLevel: "elevated",
    expectedBehavior:
      "Elevate attention and alert priority, expand recommended monitoring lists, and keep command posture readable under synthetic load.",
    category: "Operations",
    inputs: {
      liquidityPressure: "moderate",
      confidence: "moderate",
      coherence: "moderate",
      trust: "moderate",
      operationalLoad: "high",
      leadershipReadiness: "moderate",
      advisoryDrift: "moderate",
      recommendationStability: "moderate",
    },
  },
  {
    id: "stable-treasury-state",
    name: "Stable Treasury State",
    description:
      "Balanced high-trust profile with low drift and adequate stability. Baseline institutional posture for comparative validation against stress presets.",
    riskLevel: "low",
    expectedBehavior:
      "Produce stable command center and regime narratives suitable for baseline advisory shape comparison in the simulation lab.",
    category: "Stability",
    inputs: {
      liquidityPressure: "low",
      confidence: "high",
      coherence: "high",
      trust: "high",
      operationalLoad: "low",
      leadershipReadiness: "high",
      advisoryDrift: "low",
      recommendationStability: "high",
    },
  },
  {
    id: "escalation-storm",
    name: "Escalation Storm",
    description:
      "Multiple dimensions at high synthetic stress simultaneously. Exercises worst-case advisory readability while remaining strictly paper-mode and non-operational.",
    riskLevel: "critical",
    expectedBehavior:
      "Escalate command and regime attention signals, treat outputs as directional stress-test results, and defer any operational mirroring.",
    category: "Stress",
    inputs: {
      liquidityPressure: "high",
      confidence: "low",
      coherence: "low",
      trust: "low",
      operationalLoad: "high",
      leadershipReadiness: "low",
      advisoryDrift: "high",
      recommendationStability: "low",
    },
  },
  {
    id: "long-term-degradation",
    name: "Long-Term Degradation",
    description:
      "Gradual weakening across confidence, coherence, and trust with persistent high advisory drift. Models slow institutional erosion rather than acute shock.",
    riskLevel: "elevated",
    expectedBehavior:
      "Signal shifting drift and mixed stability, encourage trace review over time, and keep recommendations calm despite creeping validation gaps.",
    category: "Stress",
    inputs: {
      liquidityPressure: "moderate",
      confidence: "low",
      coherence: "low",
      trust: "low",
      operationalLoad: "moderate",
      leadershipReadiness: "low",
      advisoryDrift: "high",
      recommendationStability: "moderate",
    },
  },
];

/**
 * @returns {typeof TREASURY_SCENARIO_LIBRARY}
 */
export function getTreasuryScenarioLibrary() {
  return TREASURY_SCENARIO_LIBRARY;
}

/**
 * Load a library preset into custom-builder shape (does not run simulation).
 * @param {string} presetId
 * @returns {{
 *   preset: (typeof TREASURY_SCENARIO_LIBRARY)[number],
 *   profile: ReturnType<typeof buildCustomTreasuryScenario>['generatedProfile'],
 *   description: string,
 *   riskLevel: string,
 *   expectedBehavior: string,
 * } | null}
 */
export function loadTreasuryScenarioPreset(presetId) {
  const preset = TREASURY_SCENARIO_LIBRARY.find((p) => p.id === presetId);
  if (!preset) {
    return null;
  }

  const built = buildCustomTreasuryScenario(preset.inputs);

  return {
    preset,
    profile: built.generatedProfile,
    description: preset.description,
    riskLevel: preset.riskLevel,
    expectedBehavior: preset.expectedBehavior,
  };
}

/**
 * Self-guided treasury operator training modules (paper mode only).
 * No answer storage, grading persistence, or production side effects.
 */
export const TREASURY_TRAINING_MODULES = [
  {
    id: "liquidity-stress-response",
    title: "Liquidity Stress Response",
    difficulty: "Beginner",
    category: "Stress Response",
    certificationLevel: "Beginner",
    scenarioRef: { type: "preset", id: "liquidity-crunch" },
    briefing:
      "You are reviewing a synthetic liquidity crunch profile in paper mode. The advisory engine has produced read-only posture signals under elevated liquidity pressure. Your task is to interpret monitoring cues and readiness language without mirroring any operational action.",
    expectedInterpretation:
      "Liquidity stress should read as elevated monitoring with calm, non-operational recommendations. Confidence may be thin while command posture remains institutionally readable.",
    keyObservations: [
      "Liquidity pressure maps to synthetic withdrawal spike and exposure uplift in the profile.",
      "Command center should favor observation and tightened readiness over expansion language.",
      "Recommendations remain advisory — no payout, wallet, or withdrawal mutations are implied.",
      "Validation scoring may flag lower confidence bands without indicating production risk.",
    ],
    expectedFindings: [
      "Elevated liquidity monitoring signals in simulated operations output.",
      "Readiness posture tightened toward observation or defer-expansion language.",
      "Confidence band below stable baseline but with coherent trace narrative.",
      "Recommendations emphasize observability rather than operational intervention.",
    ],
    operatorQuestions: [
      "Which advisory panels would you review first under this liquidity profile?",
      "How would you distinguish simulation stress from a production liquidity event?",
      "What leadership-visible summary would you prepare, if any, before sharing outputs?",
      "Which recommendation language signals read-only posture versus operational urgency?",
    ],
    scoringGuide: [
      "You identified elevated monitoring without assuming wallet or payout action.",
      "You connected liquidity pressure to confidence thinning in a calm institutional frame.",
      "You articulated at least one trace or regime signal that supports your interpretation.",
      "You confirmed the exercise remained paper-mode with no persistence or grading.",
    ],
  },
  {
    id: "operational-breakdown-review",
    title: "Operational Breakdown Review",
    difficulty: "Intermediate",
    category: "Operations",
    certificationLevel: "Intermediate",
    scenarioRef: { type: "preset", id: "operational-breakdown" },
    briefing:
      "This exercise presents a synthetic operational breakdown where load overwhelms advisory coherence. Review fragmented trace handling and elevated monitoring copy. All outputs are simulation-only and require interpretive caution before any institutional sharing.",
    expectedInterpretation:
      "Operational breakdown profiles surface watch flags and defer-expansion readiness while keeping recommendations observability-first. Coherence may be low without implying production outage.",
    keyObservations: [
      "High operational load elevates attention and alert priority in synthetic outputs.",
      "Low coherence may produce fragmented or shorter trace steps — this is expected in paper mode.",
      "Command posture should remain readable despite operational saturation signals.",
      "Recommendation stability may be weak; treat outputs as directional stress-test results.",
    ],
    expectedFindings: [
      "Operational watch flags and expanded recommended monitoring lists.",
      "Defer-expansion or tighten-observation readiness signals in the profile.",
      "Coherence degradation visible in decision trace or validation scoring.",
      "Calm institutional language preserved despite elevated operational load.",
    ],
    operatorQuestions: [
      "Which operational signals would you escalate to leadership versus hold for trace review?",
      "How does low coherence change your confidence in individual recommendations?",
      "What monitoring cadence would you suggest for a similar production mirror?",
      "Where do you see tension between attention level and recommendation stability?",
    ],
    scoringGuide: [
      "You distinguished operational load signals from liquidity or fraud stress.",
      "You noted coherence impact without treating simulation as production failure.",
      "You identified defer-expansion or observation readiness appropriately.",
      "You maintained read-only advisory framing throughout your review.",
    ],
  },
  {
    id: "leadership-escalation-assessment",
    title: "Leadership Escalation Assessment",
    difficulty: "Intermediate",
    category: "Leadership",
    certificationLevel: "Intermediate",
    scenarioRef: { type: "preset", id: "leadership-visibility-gap" },
    briefing:
      "Leadership readiness lags institutional trust in this synthetic visibility-gap profile. Practice interpreting executive-facing advisory framing and escalation cadence without triggering operational events or persistence.",
    expectedInterpretation:
      "A visibility gap should produce hold-position readiness with leadership readout recommendations. Trust may remain moderate while executive briefing signals are absent or delayed.",
    keyObservations: [
      "Low leadership readiness does not automatically imply severe regime classification.",
      "Trace steps may flag leadership visibility without operational mirroring.",
      "Outlook and regime may diverge — interpretive caution is appropriate.",
      "Paper-mode outputs should be labeled synthetic before any leadership sharing.",
    ],
    expectedFindings: [
      "Leadership readiness dimension below trust and confidence bands.",
      "Recommendations referencing calm leadership readouts or briefing preparation.",
      "Hold-position or tighten-observation readiness rather than expansion language.",
      "Trace narrative clarifying visibility gap without escalation to operational action.",
    ],
    operatorQuestions: [
      "When would you schedule a leadership readout for this profile versus continued observation?",
      "How do you reconcile moderate trust with low leadership readiness?",
      "What trace steps best support an executive summary in paper mode?",
      "Which signals would you exclude from a leadership digest to avoid over-escalation?",
    ],
    scoringGuide: [
      "You identified the leadership visibility gap without assuming executive escalation.",
      "You connected readiness signals to institutional calm briefing language.",
      "You distinguished simulation drill outputs from production leadership workflows.",
      "You articulated escalation cadence ambiguity where regime and outlook diverge.",
    ],
  },
  {
    id: "advisory-drift-detection",
    title: "Advisory Drift Detection",
    difficulty: "Advanced",
    category: "Stress Response",
    certificationLevel: "Advanced",
    scenarioRef: { type: "preset", id: "advisory-drift-event" },
    briefing:
      "Advisory drift is elevated with unstable recommendations in this synthetic event profile. Advanced operators should detect regime oscillation and outlook variation under controlled perturbation. No sensitivity reruns or persistence are required for certification.",
    expectedInterpretation:
      "Drift events produce shifting recommendation text and deteriorating drift posture. Regime and outlook may oscillate — sensitivity confirmation is advisory-only before institutional sharing.",
    keyObservations: [
      "High advisory drift correlates with recommendation instability in validation scoring.",
      "Regime confidence may lag outlook direction during drift events.",
      "Operators should compare trace steps across panels for internal consistency.",
      "Drift detection is interpretive — no automated grading or answer capture occurs.",
    ],
    expectedFindings: [
      "Elevated advisory drift dimension in the generated profile.",
      "Recommendation text variation or low recommendation stability signals.",
      "Regime or outlook oscillation visible across simulation outputs.",
      "Validation notes encouraging sensitivity confirmation in paper mode.",
    ],
    operatorQuestions: [
      "Which panels show the strongest drift deterioration signals?",
      "How would you describe drift to a non-technical leadership audience?",
      "What additional lab exercise would you run to confirm drift direction?",
      "When does drift disagreement warrant holding recommendations versus sharing?",
    ],
    scoringGuide: [
      "You identified drift deterioration across at least two advisory dimensions.",
      "You noted recommendation instability without treating it as production advisory failure.",
      "You recommended sensitivity or comparison follow-up in paper mode only.",
      "You maintained institutional calm language when describing drift risk.",
    ],
  },
  {
    id: "confidence-explainability-review",
    title: "Confidence & Explainability Review",
    difficulty: "Intermediate",
    category: "Stability",
    certificationLevel: "Intermediate",
    scenarioRef: { type: "preset", id: "confidence-collapse" },
    briefing:
      "Confidence and institutional trust fall together under synthetic stress in this collapse profile. Review degradation handling, validation review flags, and explainability limits while preserving read-only safety boundaries throughout.",
    expectedInterpretation:
      "Confidence collapse should lower confidence bands and flag validation review while maintaining non-operational advisory language. Explainability may be limited — operators should apply elevated interpretive humility.",
    keyObservations: [
      "Low confidence and low trust dimensions compound in validation scoring.",
      "Decision trace confidence may diverge from overall confidence cap.",
      "Recommendations should avoid decisive operational guidance under collapse.",
      "Explainability gaps are expected — document uncertainty rather than infer causation.",
    ],
    expectedFindings: [
      "Confidence band materially below moderate baseline in simulation outputs.",
      "Validation scoring flags review or degraded recommendation quality.",
      "Trace steps may be shorter or lower-confidence than stable profiles.",
      "Advisory language preserves read-only posture despite stress signals.",
    ],
    operatorQuestions: [
      "Which explainability gaps would you disclose in an institutional summary?",
      "How does low trust change your weighting of regime versus outlook signals?",
      "What validation issues would you note before sharing collapsed-confidence outputs?",
      "When would you defer recommendation mirroring entirely under this profile?",
    ],
    scoringGuide: [
      "You identified confidence and trust degradation jointly.",
      "You applied interpretive humility without dismissing all advisory outputs.",
      "You noted validation review flags appropriate to collapse profiles.",
      "You confirmed no operational mirroring was implied by low confidence.",
    ],
  },
  {
    id: "scenario-comparison-exercise",
    title: "Scenario Comparison Exercise",
    difficulty: "Advanced",
    category: "Operations",
    certificationLevel: "Advanced",
    scenarioRef: {
      type: "comparison",
      ids: ["stable_soft_launch", "confidence_collapse"],
    },
    briefing:
      "Compare a stable soft-launch baseline against a confidence-collapse escalation profile side by side. Advanced operators should interpret confidence spread, recommendation differences, and highest-risk classification in paper mode only.",
    expectedInterpretation:
      "Stable baseline anchors low attention and high coherence; collapse profile introduces severe confidence erosion. Comparison should highlight spread and recommendation divergence without ranking production scenarios.",
    keyObservations: [
      "Confidence spread between stable and collapse profiles is typically wide.",
      "Command posture and regime classification should diverge meaningfully.",
      "Recommendation differences summarize institutional interpretive burden.",
      "Comparison is deterministic and session-local — no persistence occurs.",
    ],
    expectedFindings: [
      "Clear confidence spread between stable and escalation stress scenarios.",
      "Highest-risk scenario identified with institutional reason text.",
      "Most stable anchor scenario with supporting rationale.",
      "Recommendation differences listing advisory text variation across profiles.",
    ],
    operatorQuestions: [
      "Which comparison row best captures escalation risk for your audience?",
      "How would you narrate confidence spread without implying production ranking?",
      "What recommendation difference most affects your interpretive caution?",
      "When would you run a third scenario to triangulate comparison results?",
    ],
    scoringGuide: [
      "You interpreted comparison summary and confidence spread accurately.",
      "You identified highest-risk and most-stable anchors with supporting reasons.",
      "You reviewed recommendation differences without operational mirroring.",
      "You treated comparison as paper-mode advisory validation only.",
    ],
  },
  {
    id: "failure-mode-investigation",
    title: "Failure Mode Investigation",
    difficulty: "Advanced",
    category: "Stress Response",
    certificationLevel: "Advanced",
    scenarioRef: { type: "failure", id: "coherence_failure" },
    briefing:
      "Investigate a synthetic coherence failure stress test where contradictory guidance degrades simulated coherence. Review contradictions detected, confidence impact, and operator risk posture. Failure testing validates reasoning integrity — not production treasury state.",
    expectedInterpretation:
      "Coherence failure should surface contradictions while advisory stability remains institutionally calm. Operators assess whether conflicting signals were detected and how confidence spread changed.",
    keyObservations: [
      "Failure modes run deterministic contradiction and mismatch detection.",
      "Contradictions list is synthetic — use for training interpretation only.",
      "Advisory stability label indicates whether reasoning remained calm under stress.",
      "No failure test results are persisted or graded automatically.",
    ],
    expectedFindings: [
      "Contradictions detected between guidance layers or scenario baselines.",
      "Confidence impact narrative showing before/after spread.",
      "Coherence impact description aligned with failure mode intent.",
      "Operator recommendations for interpreting conflicting simulated advisory.",
    ],
    operatorQuestions: [
      "Which contradictions are most material for operator interpretive burden?",
      "How does advisory stability labeling change your review cadence?",
      "What production mirror checks would you suggest after this failure test?",
      "When would you escalate failure test findings versus archive as lab-only?",
    ],
    scoringGuide: [
      "You reviewed contradictions without treating them as live production alerts.",
      "You interpreted confidence and coherence impact narratives accurately.",
      "You identified operator risk posture and advisory stability signals.",
      "You confirmed failure testing remained read-only with no persistence.",
    ],
  },
  {
    id: "treasury-recovery-evaluation",
    title: "Treasury Recovery Evaluation",
    difficulty: "Beginner",
    category: "Recovery",
    certificationLevel: "Intermediate",
    scenarioRef: { type: "preset", id: "treasury-recovery" },
    briefing:
      "Evaluate a synthetic recovery profile where confidence, coherence, and recommendation stability improve after stress. Beginner operators learn to recognize normalization narratives and measured readiness to continue paper-mode testing.",
    expectedInterpretation:
      "Recovery profiles favor improving drift posture, stable command center language, and continue-testing readiness. Outputs should read as normalization — not authorization for operational expansion.",
    keyObservations: [
      "High confidence, coherence, and trust dimensions typify recovery presets.",
      "Low advisory drift supports stable regime and outlook narratives.",
      "Recommendations emphasize continued testing rather than production go-live.",
      "Recovery evaluation is self-guided — no scoring persistence applies.",
    ],
    expectedFindings: [
      "Improving or stable drift posture in generated profile dimensions.",
      "Command center and regime narratives aligned toward stable or monitored posture.",
      "Continue-testing or hold-position readiness rather than defer-expansion.",
      "Validation scoring in adequate or strong bands relative to stress presets.",
    ],
    operatorQuestions: [
      "Which signals confirm recovery versus temporary stabilization?",
      "How would you contrast this profile with a liquidity crunch exercise?",
      "What readiness language indicates continued paper-mode testing only?",
      "Which panels would you monitor if production mirrors showed similar improvement?",
    ],
    scoringGuide: [
      "You identified recovery normalization across confidence and coherence.",
      "You distinguished recovery narrative from operational authorization.",
      "You noted stable command and regime alignment appropriately.",
      "You maintained institutional calm when describing improved posture.",
    ],
  },
];

const TRAINING_MODULE_BY_ID = Object.fromEntries(
  TREASURY_TRAINING_MODULES.map((m) => [m.id, m]),
);

/**
 * @returns {typeof TREASURY_TRAINING_MODULES}
 */
export function getTreasuryTrainingModules() {
  return TREASURY_TRAINING_MODULES;
}

/**
 * Resolve scenarioRef into simulation context for a training exercise (read-only).
 * @param {{ type: string, id?: string, ids?: string[], inputs?: object }} scenarioRef
 * @returns {object | null}
 */
function resolveTrainingScenarioContext(scenarioRef) {
  if (!scenarioRef?.type) return null;

  switch (scenarioRef.type) {
    case "preset": {
      const loaded = loadTreasuryScenarioPreset(scenarioRef.id);
      if (!loaded) return null;
      const customResult = runCustomTreasurySimulation(loaded.preset.inputs);
      return {
        type: "preset",
        name: loaded.preset.name,
        description: loaded.description,
        riskLevel: loaded.riskLevel,
        profile: loaded.profile,
        preset: loaded.preset,
        simulationResult: customResult?.simulationResult || null,
        customResult,
      };
    }
    case "scenario": {
      const simulationResult = runTreasurySimulation(scenarioRef.id);
      if (!simulationResult) return null;
      return {
        type: "scenario",
        name: simulationResult.scenario.name,
        description: simulationResult.scenario.description,
        profile: null,
        simulationResult,
      };
    }
    case "failure": {
      const failureResult = runTreasuryFailureSimulation(scenarioRef.id);
      if (!failureResult?.mode?.id) return null;
      return {
        type: "failure",
        name: failureResult.mode.name,
        description: failureResult.mode.description,
        profile: null,
        simulationResult: failureResult,
        failureResult,
      };
    }
    case "comparison": {
      const ids = scenarioRef.ids || [scenarioRef.id1, scenarioRef.id2].filter(Boolean);
      const comparisonResult = compareTreasurySimulations(ids);
      if (!comparisonResult.simulations?.length) return null;
      const names = comparisonResult.simulations.map((s) => s.scenario.name).join(" vs ");
      return {
        type: "comparison",
        name: names,
        description: comparisonResult.comparisonSummary,
        profile: null,
        simulationResult: comparisonResult.simulations[0] || null,
        comparisonResult,
      };
    }
    case "custom": {
      const inputs = scenarioRef.inputs || { ...DEFAULT_CUSTOM_SCENARIO_INPUTS };
      const customResult = runCustomTreasurySimulation(inputs);
      return {
        type: "custom",
        name: customResult.scenarioName,
        description: customResult.generatedProfile?.profileSummary || "",
        profile: customResult.generatedProfile,
        simulationResult: customResult.simulationResult || null,
        customResult,
      };
    }
    default:
      return null;
  }
}

/**
 * Run a self-guided treasury training exercise (paper mode, no persistence).
 * @param {string} moduleId
 * @returns {object | null}
 */
export function runTreasuryTrainingExercise(moduleId) {
  const trainingModule = TRAINING_MODULE_BY_ID[moduleId];
  if (!trainingModule) return null;

  const scenario = resolveTrainingScenarioContext(trainingModule.scenarioRef);

  const summary = [
    `Training exercise: ${trainingModule.title} (${trainingModule.certificationLevel} certification track).`,
    scenario?.name
      ? `Synthetic context: ${scenario.name} — paper mode, read-only, advisory-only.`
      : "Synthetic context could not be resolved — review module briefing and retry with a valid scenario reference.",
    "Self-guided interpretation only. No answers stored, no grades persisted, no production treasury data changed.",
  ].join(" ");

  return {
    module: trainingModule,
    scenario,
    briefing: trainingModule.briefing,
    expectedFindings: trainingModule.expectedFindings,
    operatorQuestions: trainingModule.operatorQuestions,
    scoringGuide: trainingModule.scoringGuide,
    certificationLevel: trainingModule.certificationLevel,
    summary,
  };
}

/** @typedef {{ type: string, id?: string, ids?: string[], label: string }} TreasuryCertScenarioRef */

export const TREASURY_CERTIFICATION_EXAMS = [
  {
    id: "foundation",
    level: "Foundation",
    difficulty: "Beginner",
    durationMinutes: 45,
    scenarioRefs: [
      { type: "preset", id: "liquidity-crunch", label: "Scenario A — Liquidity Crunch" },
      { type: "preset", id: "treasury-recovery", label: "Scenario B — Treasury Recovery" },
    ],
    questionTemplates: [
      "How does the liquidity crunch profile signal elevated monitoring without implying operational payout action?",
      "Which advisory panels would you review first under synthetic liquidity pressure in paper mode?",
      "What distinguishes a recovery profile from a stress profile in confidence and coherence dimensions?",
      "How would you summarize readiness posture for a leadership audience without mirroring production workflows?",
      "What safeguards confirm this assessment remains read-only with no persistence or grading?",
    ],
    expectedFindingsTemplates: [
      "Elevated liquidity monitoring with calm, non-operational recommendation language.",
      "Recovery profile shows improving confidence, coherence, and stable command center narratives.",
      "Clear distinction between stress escalation signals and normalization posture.",
      "Readiness language favors observation or continue-testing rather than expansion authorization.",
      "Exercise completed in paper mode with self-assessment only — no answers stored.",
    ],
    scoringRubric: [
      { criterion: "Liquidity interpretation", points: 25, description: "Correctly identifies elevated monitoring without operational mirroring." },
      { criterion: "Recovery recognition", points: 25, description: "Distinguishes normalization signals from stress escalation." },
      { criterion: "Institutional framing", points: 20, description: "Uses calm, advisory language appropriate for paper-mode review." },
      { criterion: "Safety boundaries", points: 20, description: "Confirms read-only posture and no persistence throughout." },
      { criterion: "Trace coherence", points: 10, description: "References at least one trace or regime signal supporting interpretation." },
    ],
    passingScore: 70,
    summary:
      "Foundation certification assesses beginner operators on interpreting liquidity stress and recovery profiles in paper mode. Self-guided only — not live credentialing.",
  },
  {
    id: "operator",
    level: "Operator",
    difficulty: "Intermediate",
    durationMinutes: 60,
    scenarioRefs: [
      { type: "preset", id: "operational-breakdown", label: "Scenario A — Operational Breakdown" },
      { type: "scenario", id: "stable_soft_launch", label: "Scenario B — Stable Soft Launch" },
      { type: "scenario", id: "moderate_withdrawal_spike", label: "Scenario C — Moderate Withdrawal Spike" },
    ],
    questionTemplates: [
      "How does operational breakdown degrade coherence while preserving institutional calm in advisory outputs?",
      "What baseline posture anchors the stable soft launch scenario for comparison?",
      "How does a moderate withdrawal spike change monitoring cadence without payout disruption?",
      "Which signals would you escalate to leadership versus hold for trace review?",
      "How do you reconcile low coherence with defer-expansion readiness language?",
      "What production mirror checks would you suggest after this paper-mode assessment?",
    ],
    expectedFindingsTemplates: [
      "Operational watch flags and defer-expansion readiness under elevated load.",
      "Stable baseline with low attention, high coherence, and hold-position readiness.",
      "Withdrawal spike elevates monitoring while remaining within soft-launch advisory bounds.",
      "Leadership escalation limited to interpretive burden — not operational urgency.",
      "Coherence degradation noted without treating simulation as production failure.",
      "Paper-mode follow-up exercises recommended before any institutional sharing.",
    ],
    scoringRubric: [
      { criterion: "Operational breakdown review", points: 20, description: "Identifies load-driven coherence impact and watch flags." },
      { criterion: "Baseline anchoring", points: 15, description: "Correctly characterizes stable soft launch posture." },
      { criterion: "Withdrawal spike interpretation", points: 15, description: "Distinguishes monitoring uplift from payout action." },
      { criterion: "Escalation judgment", points: 20, description: "Applies appropriate leadership versus trace review cadence." },
      { criterion: "Safety boundaries", points: 15, description: "Maintains read-only advisory framing throughout." },
      { criterion: "Follow-up planning", points: 15, description: "Recommends paper-mode confirmation before sharing." },
    ],
    passingScore: 75,
    summary:
      "Operator certification validates intermediate interpretation across operational breakdown, stable baseline, and withdrawal spike scenarios. Advisory-only self-assessment.",
  },
  {
    id: "senior-operator",
    level: "Senior Operator",
    difficulty: "Advanced",
    durationMinutes: 75,
    scenarioRefs: [
      { type: "preset", id: "advisory-drift-event", label: "Scenario A — Advisory Drift Event" },
      {
        type: "comparison",
        ids: ["stable_soft_launch", "confidence_collapse"],
        label: "Scenario B — Stable vs Confidence Collapse",
      },
      { type: "failure", id: "coherence_failure", label: "Scenario C — Coherence Failure Test" },
    ],
    questionTemplates: [
      "Which panels show the strongest advisory drift deterioration in the drift event profile?",
      "How would you narrate confidence spread between stable and collapse scenarios without production ranking?",
      "What contradictions are most material in the coherence failure stress test?",
      "When does drift disagreement warrant holding recommendations versus sharing?",
      "How does advisory stability labeling change your review cadence under failure testing?",
      "What sensitivity or comparison follow-up would you run in paper mode only?",
      "How do regime and outlook oscillation affect interpretive caution during drift events?",
    ],
    expectedFindingsTemplates: [
      "Elevated advisory drift with recommendation instability and regime oscillation.",
      "Wide confidence spread between stable anchor and collapse escalation profile.",
      "Contradictions detected with confidence and coherence impact narratives.",
      "Hold recommendations when drift and failure signals compound interpretive burden.",
      "Advisory stability label guides calm review cadence under synthetic stress.",
      "Sensitivity confirmation recommended before institutional sharing.",
      "Regime-outlook divergence requires elevated interpretive humility.",
    ],
    scoringRubric: [
      { criterion: "Drift detection", points: 20, description: "Identifies drift across multiple advisory dimensions." },
      { criterion: "Comparison analysis", points: 15, description: "Interprets confidence spread and anchor scenarios accurately." },
      { criterion: "Failure test review", points: 20, description: "Assesses contradictions without treating as live alerts." },
      { criterion: "Recommendation judgment", points: 15, description: "Applies hold-versus-share criteria under compound stress." },
      { criterion: "Institutional calm", points: 15, description: "Preserves advisory stability framing throughout." },
      { criterion: "Follow-up exercises", points: 10, description: "Recommends paper-mode sensitivity or comparison follow-up." },
      { criterion: "Safety boundaries", points: 5, description: "Confirms no persistence or operational mirroring." },
    ],
    passingScore: 80,
    summary:
      "Senior Operator certification exercises advanced drift detection, scenario comparison, and failure-mode investigation. Self-guided certification prep — simulation only.",
  },
  {
    id: "treasury-manager",
    level: "Treasury Manager",
    difficulty: "Advanced",
    durationMinutes: 90,
    scenarioRefs: [
      { type: "preset", id: "leadership-visibility-gap", label: "Scenario A — Leadership Visibility Gap" },
      { type: "preset", id: "confidence-collapse", label: "Scenario B — Confidence Collapse" },
      { type: "failure", id: "regime_conflict", label: "Scenario C — Regime Conflict Test" },
      {
        type: "comparison",
        ids: ["stable_soft_launch", "high_withdrawal_spike"],
        label: "Scenario D — Stable vs High Withdrawal Spike",
      },
    ],
    questionTemplates: [
      "How do you reconcile moderate trust with low leadership readiness in the visibility gap profile?",
      "Which explainability gaps would you disclose under confidence collapse?",
      "What regime classification tension does the regime conflict failure test surface?",
      "How does the stable versus high withdrawal comparison inform interpretive caution?",
      "When would you schedule a leadership readout versus continued observation?",
      "What validation review flags are appropriate under collapsed confidence?",
      "How do recommendation differences across comparison scenarios affect advisory burden?",
      "What executive summary would you prepare in paper mode without operational mirroring?",
    ],
    expectedFindingsTemplates: [
      "Leadership readiness lags trust — hold-position readiness with briefing preparation signals.",
      "Confidence and trust collapse jointly with validation review flags.",
      "Regime conflict exposes classification tension between calm outlook and severe escalation.",
      "Comparison highlights confidence spread and withdrawal-driven monitoring uplift.",
      "Leadership readout cadence tied to visibility gap — not automatic escalation.",
      "Validation review deferred until paper-mode confirmation completes.",
      "Recommendation differences summarize institutional interpretive burden.",
      "Executive summary labeled synthetic with read-only posture preserved.",
    ],
    scoringRubric: [
      { criterion: "Leadership visibility", points: 15, description: "Interprets visibility gap without over-escalation." },
      { criterion: "Confidence collapse", points: 15, description: "Applies interpretive humility under degraded confidence." },
      { criterion: "Regime conflict", points: 15, description: "Identifies classification tension from failure test." },
      { criterion: "Comparison synthesis", points: 15, description: "Integrates comparison spread into advisory judgment." },
      { criterion: "Executive framing", points: 15, description: "Prepares calm leadership-visible summary in paper mode." },
      { criterion: "Validation awareness", points: 10, description: "Notes validation review flags appropriately." },
      { criterion: "Recommendation burden", points: 10, description: "Weighs recommendation differences across scenarios." },
      { criterion: "Safety boundaries", points: 5, description: "Confirms no persistence or financial mutation." },
    ],
    passingScore: 85,
    summary:
      "Treasury Manager certification assesses leadership visibility, confidence collapse, regime conflict, and multi-scenario comparison at advanced depth. Advisory self-assessment only.",
  },
  {
    id: "executive-review",
    level: "Executive Review",
    difficulty: "Expert",
    durationMinutes: 120,
    scenarioRefs: [
      { type: "preset", id: "escalation-storm", label: "Scenario A — Escalation Storm" },
      { type: "preset", id: "long-term-degradation", label: "Scenario B — Long-Term Degradation" },
      { type: "failure", id: "drift_disagreement", label: "Scenario C — Drift Disagreement Test" },
      {
        type: "comparison",
        ids: ["confidence_collapse", "leadership_visibility_case"],
        label: "Scenario D — Collapse vs Leadership Visibility",
      },
    ],
    questionTemplates: [
      "How does the escalation storm profile compound multiple stress dimensions simultaneously?",
      "What long-term degradation signals require sustained observability rather than reactive intervention?",
      "How does drift disagreement between recovery and withdrawal profiles affect advisory coherence?",
      "What institutional narrative connects collapse and leadership visibility comparison rows?",
      "When would you recommend holding all advisory mirroring under compound expert-level stress?",
      "How do you balance executive briefing needs with simulation-only safety boundaries?",
      "What triangulation exercise would you run to confirm comparison findings in paper mode?",
      "How would you certify readiness for institutional sharing without implying live credentialing?",
    ],
    expectedFindingsTemplates: [
      "Escalation storm compounds liquidity, drift, and operational load with severe advisory burden.",
      "Long-term degradation favors sustained monitoring over expansion authorization.",
      "Drift disagreement exposes directional conflict between recovery and spike profiles.",
      "Comparison links confidence collapse to leadership visibility gap with clear spread narrative.",
      "Compound stress warrants holding advisory mirroring until paper-mode triangulation completes.",
      "Executive briefing labeled synthetic with explicit read-only and non-credentialing disclaimers.",
      "Third-scenario triangulation recommended before institutional sharing.",
      "Self-certification confirms interpretive readiness — not live treasury credentialing.",
    ],
    scoringRubric: [
      { criterion: "Compound stress synthesis", points: 15, description: "Integrates multi-dimensional escalation storm signals." },
      { criterion: "Degradation narrative", points: 15, description: "Characterizes long-term degradation with observability focus." },
      { criterion: "Drift disagreement", points: 15, description: "Interprets directional conflict from failure test accurately." },
      { criterion: "Executive comparison", points: 15, description: "Synthesizes collapse versus visibility comparison for leadership." },
      { criterion: "Advisory hold judgment", points: 10, description: "Applies hold criteria under compound expert stress." },
      { criterion: "Executive communication", points: 10, description: "Frames briefing with simulation-only disclaimers." },
      { criterion: "Triangulation planning", points: 10, description: "Recommends paper-mode confirmation exercises." },
      { criterion: "Self-certification integrity", points: 10, description: "Distinguishes prep assessment from live credentialing." },
    ],
    passingScore: 90,
    summary:
      "Executive Review certification represents expert-level synthesis across compound stress, degradation, drift disagreement, and leadership-facing comparison. Paper-mode self-assessment — not live credentialing.",
  },
];

const CERTIFICATION_EXAM_BY_ID = Object.fromEntries(
  TREASURY_CERTIFICATION_EXAMS.map((e) => [e.id, e]),
);

/**
 * @returns {typeof TREASURY_CERTIFICATION_EXAMS}
 */
export function getTreasuryCertificationExams() {
  return TREASURY_CERTIFICATION_EXAMS;
}

/**
 * Build briefing text for a resolved certification scenario (read-only).
 * @param {TreasuryCertScenarioRef} scenarioRef
 * @param {object | null} resolved
 * @returns {string}
 */
function buildCertificationScenarioBriefing(scenarioRef, resolved) {
  if (!resolved) {
    return `${scenarioRef.label}: Synthetic context could not be resolved — review scenario reference and retry in paper mode.`;
  }

  const parts = [
    `${scenarioRef.label} — ${resolved.name}.`,
    resolved.description ? String(resolved.description).trim() : "",
  ];

  if (resolved.type === "preset" && resolved.preset?.expectedBehavior) {
    parts.push(`Expected advisory behavior: ${resolved.preset.expectedBehavior}`);
  }

  if (resolved.type === "comparison" && resolved.comparisonResult?.comparisonSummary) {
    parts.push(resolved.comparisonResult.comparisonSummary);
  }

  if (resolved.type === "failure" && resolved.failureResult?.mode?.description) {
    parts.push(`Failure test intent: ${resolved.failureResult.mode.description}`);
  }

  parts.push("Paper mode, read-only, advisory-only — no operational mirroring implied.");

  return parts.filter(Boolean).join(" ");
}

/**
 * Extract key outputs from resolved scenario context for exam display.
 * @param {object | null} resolved
 * @returns {Record<string, string> | null}
 */
function extractCertificationKeyOutputs(resolved) {
  if (!resolved) return null;

  if (resolved.comparisonResult) {
    const cr = resolved.comparisonResult;
    return {
      "Confidence spread": `${cr.confidenceSpread?.min ?? "—"} – ${cr.confidenceSpread?.max ?? "—"} (Δ ${cr.confidenceSpread?.spread ?? "—"})`,
      "Highest risk": cr.highestRiskScenario?.name || "—",
      "Most stable": cr.mostStableScenario?.name || "—",
    };
  }

  if (resolved.failureResult?.mode?.id) {
    const fr = resolved.failureResult;
    return {
      "Advisory stability": fr.advisoryStability || "—",
      "Confidence before": `${fr.confidenceImpact?.before ?? "—"}/100`,
      "Confidence after": `${fr.confidenceImpact?.after ?? "—"}/100`,
      "Operator risk": fr.operatorRisk || "—",
    };
  }

  const sim = resolved.simulationResult;
  if (sim?.simulatedRegime) {
    return {
      Regime: sim.simulatedRegime.regime || "—",
      Outlook: sim.simulatedOutlook?.outlook || "—",
      Confidence: `${sim.confidence ?? "—"}/100`,
      Command: sim.simulatedCommandCenter?.commandStatus || "—",
    };
  }

  if (resolved.profile) {
    return {
      "Risk level": resolved.riskLevel || resolved.profile.riskLevel || "—",
      Confidence: resolved.profile.confidence || "—",
      Coherence: resolved.profile.coherence || "—",
      "Advisory drift": resolved.profile.advisoryDrift || "—",
    };
  }

  if (sim?.summary) {
    return { Summary: sim.summary };
  }

  return null;
}

/**
 * Convert scenarioRef to resolveTrainingScenarioContext input shape.
 * @param {TreasuryCertScenarioRef} scenarioRef
 * @returns {object}
 */
function certificationRefToScenarioRef(scenarioRef) {
  if (scenarioRef.type === "comparison") {
    return { type: "comparison", ids: scenarioRef.ids };
  }
  return { type: scenarioRef.type, id: scenarioRef.id };
}

/**
 * Build a full treasury certification exam (paper mode, no persistence).
 * @param {string} examId
 * @returns {object | null}
 */
export function buildTreasuryCertificationExam(examId) {
  const exam = CERTIFICATION_EXAM_BY_ID[examId];
  if (!exam) return null;

  const scenarios = exam.scenarioRefs.map((scenarioRef) => {
    const resolved = resolveTrainingScenarioContext(certificationRefToScenarioRef(scenarioRef));
    const keyOutputs = extractCertificationKeyOutputs(resolved);

    return {
      label: scenarioRef.label,
      name: resolved?.name || scenarioRef.label,
      briefing: buildCertificationScenarioBriefing(scenarioRef, resolved),
      simulationContext: resolved
        ? {
            type: resolved.type,
            name: resolved.name,
            description: resolved.description || null,
            riskLevel: resolved.riskLevel || resolved.preset?.riskLevel || null,
          }
        : null,
      keyOutputs,
    };
  });

  const durationLabel =
    exam.durationMinutes === 1
      ? "1 minute"
      : `${exam.durationMinutes} minutes`;

  return {
    title: `Treasury ${exam.level} Certification Exam`,
    level: exam.level,
    difficulty: exam.difficulty,
    duration: durationLabel,
    scenarios,
    questions: [...exam.questionTemplates],
    expectedFindings: [...exam.expectedFindingsTemplates],
    scoringRubric: exam.scoringRubric.map((row) => ({ ...row })),
    passingScore: exam.passingScore,
    summary: exam.summary,
  };
}

/**
 * Format key outputs as plain-text lines.
 * @param {Record<string, string> | null} keyOutputs
 * @returns {string}
 */
function formatKeyOutputsText(keyOutputs) {
  if (!keyOutputs || !Object.keys(keyOutputs).length) return "";
  return Object.entries(keyOutputs)
    .map(([key, value]) => `  ${key}: ${value}`)
    .join("\n");
}

/**
 * Generate a printable plain-text assessment pack (read-only, no submission).
 * @param {string} examId
 * @returns {object | null}
 */
export function generateTreasuryAssessmentPack(examId) {
  const exam = buildTreasuryCertificationExam(examId);
  if (!exam) return null;

  const meta = CERTIFICATION_EXAM_BY_ID[examId];

  const coverPage = [
    "═══════════════════════════════════════════════════════════════",
    exam.title.toUpperCase(),
    "═══════════════════════════════════════════════════════════════",
    "",
    `Level: ${exam.level}`,
    `Difficulty: ${exam.difficulty}`,
    `Duration: ${exam.duration}`,
    `Scenarios: ${exam.scenarios.length}`,
    `Questions: ${exam.questions.length}`,
    `Passing score: ${exam.passingScore}/100 (self-grade)`,
    "",
    "TREASURY SIMULATION LAB — ASSESSMENT PACK",
    "Simulation only · Read-only · Advisory · Paper mode",
    "Not live credentialing — self-guided certification prep",
    "",
  ].join("\n");

  const instructions = [
    "INSTRUCTIONS",
    "─────────────",
    "",
    "1. Review each scenario briefing and key outputs below.",
    "2. Answer each question in writing on separate paper or a local document.",
    "3. Compare your responses to the Answer Guide after completion.",
    "4. Self-grade using the Grading Guide and scoring rubric.",
    "5. Do not submit answers — no storage, tracking, or grading occurs in this lab.",
    "",
    "This assessment pack is generated on demand. No database writes, no score",
    "persistence, and no financial flows are touched.",
    "",
  ].join("\n");

  const scenariosText = exam.scenarios
    .map((scenario, index) => {
      const keyLines = formatKeyOutputsText(scenario.keyOutputs);
      return [
        `SCENARIO ${index + 1}: ${scenario.label}`,
        "─".repeat(Math.min(60, scenario.label.length + 12)),
        scenario.briefing,
        keyLines ? `\nKey outputs:\n${keyLines}` : "",
        "",
      ]
        .filter((line) => line !== "")
        .join("\n");
    })
    .join("\n");

  const questionsText = [
    "QUESTIONS",
    "─────────",
    "",
    ...exam.questions.map((q, i) => `${i + 1}. ${q}`),
    "",
  ].join("\n");

  const answerGuide = [
    "ANSWER GUIDE (Expected Findings)",
    "────────────────────────────────",
    "",
    ...exam.expectedFindings.map((finding, i) => `${i + 1}. ${finding}`),
    "",
    "Use these expected findings to self-check your responses.",
    "Partial credit is acceptable — focus on institutional accuracy and safety boundaries.",
    "",
  ].join("\n");

  const gradingGuide = [
    "GRADING GUIDE",
    "─────────────",
    "",
    `Passing score: ${exam.passingScore}/100 (self-assessment threshold)`,
    "",
    "Scoring rubric:",
    ...exam.scoringRubric.map(
      (row) =>
        `  • ${row.criterion} (${row.points} pts): ${row.description}`,
    ),
    "",
    `Total available points: ${exam.scoringRubric.reduce((sum, row) => sum + row.points, 0)}`,
    "",
    exam.summary,
    "",
  ].join("\n");

  const packText = [
    coverPage,
    instructions,
    scenariosText,
    questionsText,
    answerGuide,
    gradingGuide,
    "— End of assessment pack —",
    `Generated for ${meta?.level || exam.level} certification prep · Treasury Simulation Lab`,
  ].join("\n\n");

  return {
    coverPage,
    instructions,
    scenarios: scenariosText,
    questions: questionsText,
    answerGuide,
    gradingGuide,
    packText,
  };
}

// ——— Phase 4N: Treasury Operations Manual Generator (paper mode, read-only) ———

/**
 * Synthetic advisory manual sections for operator learning via the simulation lab.
 * No production treasury operations, persistence, or external calls.
 */
export const TREASURY_MANUAL_SECTIONS = [
  {
    id: "treasury-overview",
    title: "Treasury Overview",
    summary:
      "Establishes the read-only advisory posture of treasury intelligence in paper mode and how operators orient to synthetic outputs.",
    content:
      "Treasury oversight in the simulation lab mirrors institutional calm: operators observe synthetic posture, synthesize narratives, and advise stakeholders without executing financial mutations. The lab exercises command center framing, regime classification, and outlook language using deterministic inputs only.\n\nProduction treasury systems remain outside this manual. Treat every panel, trace step, and recommendation as advisory reference material for interpretive training. When sharing outputs institutionally, label them explicitly as simulation-derived before any leadership readout.\n\nThe operating principle is observe → synthesize → advise. Operators build judgment on monitoring cadence, escalation visibility, and explainability limits rather than on operational triggers embedded in live systems.",
    operatorGuidance: [
      "Open with command posture and confidence band before drilling into trace detail.",
      "Label all lab outputs as synthetic before institutional sharing.",
      "Never infer wallet, payout, or withdrawal actions from simulation recommendations.",
      "Use overview framing to set calm expectations for downstream panel review.",
    ],
    reviewCadence: "Daily during active monitoring exercises",
  },
  {
    id: "operational-monitoring",
    title: "Operational Monitoring",
    summary:
      "Describes how operators read simulated monitoring signals, watch flags, and recommended monitoring lists under varying attention levels.",
    content:
      "Operational monitoring in the lab surfaces attention level, operating state, and recommended monitoring copy derived from synthetic load and coherence inputs. Elevated attention does not imply production intervention — it signals where interpretive focus should concentrate during a drill.\n\nWatch flags indicate directional stress (liquidity, payout latency, fraud clusters) without operational mirroring. Operators compare monitoring signals across scenarios to build pattern recognition for calm escalation language.\n\nRecommended monitoring lists are advisory checklists. They guide review sequencing — command center first, then operations, regime, and trace — rather than triggering automated workflows.",
    operatorGuidance: [
      "Map attention level to review depth, not to operational urgency.",
      "Cross-check watch flags against regime and outlook for internal consistency.",
      "Document which monitoring signals drove your interpretive conclusion.",
      "Re-run comparison exercises when monitoring lists diverge sharply between scenarios.",
    ],
    reviewCadence: "Daily during elevated attention drills",
  },
  {
    id: "alert-readiness",
    title: "Alert Readiness",
    summary:
      "Covers synthetic alert priority interpretation and readiness to surface calm institutional alerts without notification side effects.",
    content:
      "Alert readiness in paper mode trains operators to distinguish priority bands (low, moderate, elevated, high) from production alerting pipelines. Simulation outputs describe what an alert narrative might emphasize — attention, drift, or coherence — without creating notifications or records.\n\nOperators practice staging alert language: what would be observed first, what context would accompany an advisory alert, and what explicit non-action boundaries apply. High priority in simulation means elevated interpretive scrutiny, not automated escalation to financial systems.\n\nAlert readiness pairs with notification readiness conceptually but remains analytically separate. Review both sections when exercises include contradictory attention and alert signals.",
    operatorGuidance: [
      "Treat alert priority as interpretive weight, not as a trigger to act.",
      "Draft alert copy mentally; do not send or persist lab outputs as alerts.",
      "Pair alert review with command center summary for coherent messaging.",
      "When priorities oscillate, favor observation language over urgency framing.",
    ],
    reviewCadence: "Daily during alert-focused scenario runs",
  },
  {
    id: "notification-readiness",
    title: "Notification Readiness",
    summary:
      "Explains how operators prepare advisory notification framing in simulation without dispatching messages or touching notification infrastructure.",
    content:
      "Notification readiness exercises focus on what institutional stakeholders need to know — and what they do not — before any hypothetical notification. The lab never invokes notification services; operators rehearse audience, cadence, and calm tone only.\n\nDigest-oriented summaries and executive escalations inform notification readiness. Operators should ask whether a given synthetic profile warrants a broad operational digest versus a narrow leadership readout, always preserving read-only boundaries.\n\nWhen simulation confidence is low, notification readiness defaults to hold-and-observe language. Defer expansion recommendations in outputs signal that broader notification would be premature even in a production mirror discussion.",
    operatorGuidance: [
      "Rehearse notification copy offline; never dispatch from the lab.",
      "Scope audience narrowly when confidence or coherence is degraded.",
      "Include explicit non-operational disclaimers in drafted messaging.",
      "Align notification tone with digest intelligence section guidance.",
    ],
    reviewCadence: "Weekly, or when digest exercises are scheduled",
  },
  {
    id: "digest-intelligence",
    title: "Digest Intelligence",
    summary:
      "Guides synthesis of periodic advisory digests from simulated panels for institutional awareness without persistence.",
    content:
      "Digest intelligence is the practice of compressing multi-panel simulation outputs into calm, scannable summaries suitable for operational standups or leadership briefings. Digests emphasize posture movement, confidence bands, and top three observability themes — never execution steps.\n\nOperators select digest depth based on scenario category: stable baselines warrant shorter digests; compound stress or drift events warrant explicit trace and regime mentions. All digest content remains synthetic and advisory.\n\nDigest cadence in training typically aligns with daily monitoring during active drills and weekly consolidation during certification prep. Event-driven digests apply after failure-mode or timeline exercises when posture progression needs narrative continuity.",
    operatorGuidance: [
      "Lead digests with command status and confidence, then regime and outlook.",
      "Cap digest length; defer trace detail to appendix-style offline notes.",
      "State simulation-only provenance in the opening sentence.",
      "Avoid imperative verbs that imply payout, wallet, or withdrawal action.",
    ],
    reviewCadence: "Daily during multi-scenario review weeks",
  },
  {
    id: "executive-escalation",
    title: "Executive Escalation",
    summary:
      "Defines visibility escalation for leadership readouts in advisory terms — never operational execution.",
    content:
      "Executive escalation in the lab means increasing leadership visibility of interpretive findings, not elevating financial authority or approval chains. Synthetic leadership visibility flags indicate when exercises expect operators to practice executive-summary framing.\n\nEscalation follows observe → advise → escalate visibility. Operators document what leadership should understand, what remains under observation, and what explicit boundaries prevent operational mirroring. Regime conflict or confidence collapse scenarios are common escalation rehearsal profiles.\n\nLeadership readiness dimensions in custom builder exercises complement this section. Low leadership readiness with moderate trust signals a visibility gap — interpretive caution before any institutional sharing.",
    operatorGuidance: [
      "Escalate visibility of findings, not authority to execute changes.",
      "Prepare one-page calm summaries with confidence and coherence stated plainly.",
      "Exclude trace minutiae unless leadership requests drill-down detail.",
      "When leadership visibility is false in inputs, default to operational hold.",
    ],
    reviewCadence: "Event-driven, before leadership briefing exercises",
  },
  {
    id: "decision-support",
    title: "Decision Support",
    summary:
      "Frames how simulated recommendations support operator judgment without substituting for live decision systems.",
    content:
      "Decision support outputs in the simulation lab are directional advisory statements — tighten observation, hold position, defer expansion — derived deterministically from synthetic inputs. They inform judgment; they do not authorize action.\n\nOperators evaluate recommendation stability alongside decision support language. Unstable recommendations under drift stress indicate that decision support should be treated as provisional until comparison or sensitivity exercises confirm direction.\n\nPair decision support review with decision trace and meta reasoning sections when exercises include contradictory signals. Institutional calm requires acknowledging uncertainty rather than forcing single-path narratives.",
    operatorGuidance: [
      "Read recommendations as hypotheses, not instructions.",
      "Note recommendation count and thematic consistency across panels.",
      "When recommendations conflict, favor observation over synthesis urgency.",
      "Cross-reference decision trace steps before endorsing a single recommendation theme.",
    ],
    reviewCadence: "Daily during active scenario interpretation",
  },
  {
    id: "institutional-memory",
    title: "Institutional Memory",
    summary:
      "Describes how operators build durable interpretive memory from lab exercises without persisting answers or scores to production stores.",
    content:
      "Institutional memory in training is the accumulated pattern library operators carry — which scenario profiles produce fragmented traces, which regimes accompany recovery outlooks, and how validation grades correlate with coherence stress. The lab does not write this memory to databases; operators maintain offline notes or personal runbooks.\n\nCertification and training modules reinforce memory through repeated exposure to liquidity stress, operational breakdown, and drift event archetypes. Comparison and timeline exercises accelerate memory formation by showing posture progression explicitly.\n\nWhen institutional memory conflicts with fresh simulation outputs, favor re-running the scenario or a comparison drill rather than assuming production state matches prior exercises.",
    operatorGuidance: [
      "Maintain personal pattern notes outside production systems.",
      "Compare new runs against remembered archetypes, not against live treasury state.",
      "Refresh memory after regression suite or Monte Carlo exercises.",
      "Share interpretive patterns with peers verbally; do not persist lab scores as credentials.",
    ],
    reviewCadence: "Weekly consolidation after training modules",
  },
  {
    id: "explainability",
    title: "Explainability",
    summary:
      "Covers confidence bands, trace narrative quality, and humility language when explainability limits surface in simulation.",
    content:
      "Explainability requires that operators articulate why advisory outputs read a certain way — which synthetic inputs drove attention elevation, which trace steps support regime classification, and where confidence thins. The lab's decision trace panel is the primary explainability artifact.\n\nConfidence collapse exercises train humility: when explainability is weak, recommendations should be quoted with explicit uncertainty and validation review flags should be cited. Explainability is not about technical model internals; it is about institutional readability of advisory reasoning.\n\nOperators practicing certification at intermediate levels should connect explainability limits to leadership-facing language — what can be said confidently versus what requires further observation.",
    operatorGuidance: [
      "Anchor explanations in trace steps and validation scoring, not speculation.",
      "State confidence numerically and narratively when briefing others.",
      "When trace is fragmented, describe limits before summarizing posture.",
      "Use humility phrases when confidence falls below stable training baselines.",
    ],
    reviewCadence: "Daily during confidence-stress scenarios",
  },
  {
    id: "consistency-checks",
    title: "Consistency Checks",
    summary:
      "Defines cross-panel coherence review to detect contradictory advisory signals in paper mode.",
    content:
      "Consistency checks compare command center posture, operations attention, regime classification, outlook direction, and trace narrative for internal alignment. Contradictory guidance scenarios exist specifically to exercise this discipline.\n\nOperators document mismatches — for example, elevated alert priority with hold-position readiness — and interpret them as stress-test artifacts rather than production defects. Validation scoring and failure simulations provide secondary consistency signals.\n\nConsistency does not require forced agreement across panels; it requires explicit acknowledgment of tension and calm framing of which signals dominate for the current interpretive task.",
    operatorGuidance: [
      "Run a five-panel consistency pass before drafting digests.",
      "Log contradictions explicitly when failure-mode exercises are active.",
      "Prefer regime-outlook pairing checks during drift events.",
      "Do not resolve contradictions by assuming operational intervention.",
    ],
    reviewCadence: "Daily during contradictory-signal scenarios",
  },
  {
    id: "risk-narrative",
    title: "Risk Narrative",
    summary:
      "Guides construction of calm institutional risk stories from synthetic stress without implying live financial exposure.",
    content:
      "Risk narrative synthesis translates scattered simulation signals into a coherent story: what is under pressure, what is stable, and what near-term outlook the advisory engine suggests. Narratives remain observational — liquidity pressure reads as monitoring elevation, not as balance sheet fact.\n\nOperator risk posture labels from failure simulations inform narrative tone. When operator risk reads elevated, narratives should emphasize interpretive caution and defer expansion themes present in outputs.\n\nRisk narratives for leadership should be shorter than operational narratives. Lead with posture and confidence, follow with two risk themes, close with explicit read-only boundaries.",
    operatorGuidance: [
      "Use institutional calm tone; avoid alarmist or imperative phrasing.",
      "Separate synthetic stress from production exposure in the opening clause.",
      "Limit narratives to three themes unless timeline exercises require progression detail.",
      "Close with observation cadence, not action items.",
    ],
    reviewCadence: "Weekly, or event-driven after stress drills",
  },
  {
    id: "playbooks",
    title: "Playbooks",
    summary:
      "Introduces advisory playbooks as structured interpretive paths aligned with lab procedures — not live runbooks with execution steps.",
    content:
      "Playbooks in the simulation lab are mental models linking scenario categories to review sequences: liquidity stress begins with monitoring and alert readiness; operational breakdown emphasizes coherence and trace fragmentation; drift events pair regime detection with recommendation stability review.\n\nStandard procedures in this manual extend playbook thinking into step-by-step advisory actions. Operators should treat playbooks as training scaffolds — reusable interpretive paths — rather than as authority to change production configuration.\n\nPlaybook selection should match scenario library presets and training module categories for coherent certification prep.",
    operatorGuidance: [
      "Select playbooks by scenario category, not by production incident type alone.",
      "Follow observe → synthesize → advise sequencing within each playbook.",
      "Cross-link playbook steps to manual sections for depth.",
      "Rehearse playbooks in timeline exercises to practice progression.",
    ],
    reviewCadence: "Weekly during certification prep",
  },
  {
    id: "scenario-response",
    title: "Scenario Response",
    summary:
      "Describes how operators respond interpretively to individual scenarios, comparisons, and custom builder profiles.",
    content:
      "Scenario response begins with identifying the scenario archetype — stable baseline, withdrawal spike, payout pressure, fraud cluster, recovery, confidence collapse, or compound stress. Each archetype implies a default panel review order and expected validation grade band.\n\nComparison mode supports response discipline across two or three scenarios simultaneously. Custom builder exercises extend response practice to composed profiles with explicit dimension sliders.\n\nResponse never includes rerunning production jobs or mutating synthetic inputs mid-interpretation to achieve preferred outputs. Inputs are fixed for the run; interpretive integrity matters more than posture optimization.",
    operatorGuidance: [
      "Name the archetype aloud or in notes before deep panel review.",
      "Use comparison mode when recommendations feel unstable in isolation.",
      "Record expected versus actual validation themes after each run.",
      "Treat custom builder outputs as composed stress, not live telemetry.",
    ],
    reviewCadence: "Daily during scenario library exercises",
  },
  {
    id: "operator-timeline",
    title: "Operator Timeline",
    summary:
      "Explains multi-step timeline drills and how operators narrate posture progression across synthetic steps.",
    content:
      "Operator timeline exercises chain scenarios in institutional order — escalation, pressure, recovery, or drift progression — producing step narratives, posture chips, and confidence/regime/outlook tracks. Timelines teach temporal reasoning without touching production chronologies.\n\nOperators should narrate each step's transition: what changed from prior posture, whether confidence moved directionally, and whether recommendations stabilized or fragmented. Timeline recommendations at the conclusion synthesize the full arc in advisory language.\n\nTimelines complement institutional memory by showing progression explicitly rather than relying on recalled single-run postures.",
    operatorGuidance: [
      "Read step narratives before interpreting aggregate timeline recommendations.",
      "Track confidence progression as a first-class timeline artifact.",
      "Note regime-outlook divergence at individual steps, not only at the end.",
      "Label timeline output as sequential simulation, not production history.",
    ],
    reviewCadence: "Event-driven, when timeline modules are scheduled",
  },
  {
    id: "attention-priorities",
    title: "Attention Priorities",
    summary:
      "Prioritizes interpretive focus under quiet, monitoring, elevated, and active review attention bands.",
    content:
      "Attention priorities guide how deeply operators drill into panels when synthetic attention levels shift. Quiet attention favors baseline validation and certification prep; elevated attention demands trace and consistency checks; active review pairs with fraud or breakdown archetypes.\n\nAttention must not be conflated with alert priority or command status — three distinct dimensions that may diverge in stress exercises. Priority rules: resolve command posture first, then attention-driven depth, then alert framing.\n\nWhen attention elevates while confidence collapses, reduce digest scope and increase explainability documentation before any leadership visibility escalation.",
    operatorGuidance: [
      "Map attention level to panel depth before starting review.",
      "Do not treat active review as authorization to operate financially.",
      "Re-prioritize when contradictory guidance scenarios are in use.",
      "Document which attention band drove your escalation visibility decision.",
    ],
    reviewCadence: "Daily during elevated and active review drills",
  },
  {
    id: "operational-coherence",
    title: "Operational Coherence",
    summary:
      "Addresses coherence scores and operational alignment between simulated operations and command center framing.",
    content:
      "Operational coherence measures how well operations monitoring signals align with command center operating picture language. Low coherence in simulation indicates interpretive difficulty — fragmented traces, unstable recommendations — not necessarily production dysfunction.\n\nCoherence impact from failure simulations quantifies degradation narratives for training. Operators describe coherence movement in institutional terms: tightening observation, deferring expansion language, or requesting comparison confirmation.\n\nCoherence pairs with consistency checks; coherence is the holistic score, consistency is the per-panel mismatch hunt.",
    operatorGuidance: [
      "Quote coherence scores when summarizing operational breakdown exercises.",
      "When coherence is low, shorten leadership digests and widen trace citation.",
      "Use failure-mode coherence impact panels for degradation language practice.",
      "Avoid treating coherence as a production SLA; it is a synthetic interpretive metric.",
    ],
    reviewCadence: "Daily during breakdown and contradictory scenarios",
  },
  {
    id: "review-cadence",
    title: "Review Cadence",
    summary:
      "Consolidates daily, weekly, monthly, and event-driven review rhythms for treasury advisory interpretation in the lab.",
    content:
      "Review cadence structures operator learning without imposing production calendar integrations. Daily cadence applies during active monitoring and scenario interpretation weeks. Weekly cadence supports digest consolidation, institutional memory refresh, and certification module completion.\n\nMonthly cadence is appropriate for regression suite review, Monte Carlo robustness reflection, and senior certification prep. Event-driven cadence triggers around timeline drills, failure-mode investigations, leadership escalation rehearsals, and advisory drift assessments.\n\nCadence is advisory discipline — it does not create tickets, reminders, or database schedules in the simulation lab.",
    operatorGuidance: [
      "Match daily reviews to attention elevation in current exercises.",
      "Schedule weekly comparison or library preset rotation for breadth.",
      "Reserve monthly sessions for regression and robustness reflection.",
      "Use event-driven cadence after compound stress or drift disagreement runs.",
    ],
    reviewCadence: "Monthly meta-review of personal cadence adherence",
  },
  {
    id: "leadership-readiness",
    title: "Leadership Readiness",
    summary:
      "Covers leadership readiness dimensions, visibility gaps, and calm briefing preparation from synthetic outputs.",
    content:
      "Leadership readiness in custom builder and scenario inputs signals whether operators should practice executive-facing synthesis. Low readiness with moderate trust describes visibility gaps — institutional trust in advisory mechanics may exceed preparedness to brief leadership.\n\nOperators rehearse leadership readouts: posture headline, confidence statement, two risk themes, explicit non-operational boundary. Leadership readiness does not trigger automated executive notifications in the lab.\n\nPair this section with executive escalation and digest intelligence when certification exams include leadership visibility scenarios.",
    operatorGuidance: [
      "Assess leadership readiness before drafting executive summaries.",
      "Hold briefings when readiness lags trust unless regime demands visibility.",
      "Practice visibility-gap language without implying executive approval to act.",
      "Keep leadership slides simulation-labeled throughout.",
    ],
    reviewCadence: "Event-driven, before leadership certification modules",
  },
  {
    id: "meta-reasoning",
    title: "Meta Reasoning",
    summary:
      "Addresses reasoning about reasoning — how operators evaluate advisory quality, validation grades, and contradictory stress tests.",
    content:
      "Meta reasoning asks whether the advisory stack behaved plausibly for the synthetic inputs provided. Validation scoring, failure simulations, and regression suites are meta-reasoning tools — they judge interpretive machinery, not production treasury health.\n\nContradictory guidance and compound stress scenarios require meta reasoning explicitly: which panel should dominate, whether fragmentation is expected, and whether operators are forcing false coherence. Advanced certification expects articulate meta reasoning under drift and regime conflict.\n\nMeta reasoning conclusions remain advisory. They inform whether to rerun exercises, not whether to alter live configuration.",
    operatorGuidance: [
      "Ask whether outputs are plausible for inputs before accepting narratives.",
      "Use validation grades as meta signals, not as production health scores.",
      "When contradictions appear, meta-reason about expected versus anomalous fragmentation.",
      "Document meta conclusions in offline certification notes only.",
    ],
    reviewCadence: "Weekly during advanced certification prep",
  },
  {
    id: "decision-trace",
    title: "Decision Trace",
    summary:
      "Explains trace status, step sequencing, and source-effect literacy for simulated decision traces.",
    content:
      "Decision trace panels list ordered steps with sources and effects — the primary artifact for explainability and consistency checks. Trace status and trace confidence indicate whether the narrative is complete, fragmented, or degraded under stress.\n\nOperators read traces sequentially, noting where effects contradict prior steps or where sources cluster under single input dimensions. Trace step count appears in comparison tables for cross-scenario review.\n\nTraces do not represent immutable audit logs in the lab; they are synthetic narratives for training. Cite trace steps when building risk narratives and digests, not as legal evidence of production decisions.",
    operatorGuidance: [
      "Read trace steps in order before summarizing command posture.",
      "When trace confidence is low, lead external messaging with trace limits.",
      "Compare trace step counts in comparison mode for stability assessment.",
      "Never treat trace as authorization for financial workflow changes.",
    ],
    reviewCadence: "Daily during trace-heavy and breakdown scenarios",
  },
  {
    id: "recommendation-stability",
    title: "Recommendation Stability",
    summary:
      "Guides assessment of recommendation variation across runs, sensitivity exercises, and Monte Carlo iterations.",
    content:
      "Recommendation stability measures whether advisory text remains directionally consistent under perturbation. Sensitivity and Monte Carlo lab modes quantify volatility for training — operators learn when to treat recommendations as provisional.\n\nLow stability alongside high advisory drift indicates interpretive environments where decision support should be quoted with explicit caveats. Comparison exercises across scenarios reveal stability differences by archetype.\n\nStability assessment is read-only. Operators do not tune inputs to maximize stability scores; they document volatility for institutional honesty.",
    operatorGuidance: [
      "Run sensitivity or Monte Carlo when single-run recommendations feel unstable.",
      "Describe stability in plain language for leadership audiences.",
      "Pair stability review with advisory drift section findings.",
      "Avoid presenting unstable recommendations as definitive guidance.",
    ],
    reviewCadence: "Weekly during sensitivity and Monte Carlo modules",
  },
  {
    id: "advisory-drift",
    title: "Advisory Drift",
    summary:
      "Covers drift status interpretation, regime oscillation, and calm language when advisory direction shifts in simulation.",
    content:
      "Advisory drift describes directional movement in recommendations, regime, or outlook between exercises or timeline steps. Drift status inputs (unchanged, shifting, deteriorating, improving, oscillating) set expectations for panel behavior.\n\nDrift events are advanced training profiles. Operators detect drift through recommendation text changes, validation notes, and custom builder drift dimensions. Drift disagreement — where operators and outputs seem misaligned — warrants holding visibility escalation until comparison exercises complete.\n\nDrift never triggers automated course correction in production from the lab. Assessment procedures in this manual provide structured drift review paths.",
    operatorGuidance: [
      "Name drift direction before recommending institutional sharing.",
      "Use scenario comparison to confirm drift versus single-run noise.",
      "Prefer observation language when drift is oscillating.",
      "Complete advisory drift assessment procedure for formal drift reviews.",
    ],
    reviewCadence: "Event-driven, when drift scenarios or presets are active",
  },
  {
    id: "regime-detection",
    title: "Regime Detection",
    summary:
      "Explains regime classification, confidence, trend, and operator posture signals in simulated regime panels.",
    content:
      "Regime detection literacy enables operators to interpret regime labels, regime confidence percentages, trend direction, and operator posture recommendations as cohesive advisory signals. Regime may diverge from outlook — interpretive caution applies.\n\nRegime conflict scenarios in certification stress-test classification under compound inputs. Operators practice explaining regime to non-technical audiences without overstating certainty.\n\nRegime detection pairs with regime progression tracks in timeline exercises. Document regime transitions as narrative anchors when building operator timelines for institutional review.",
    operatorGuidance: [
      "Read regime confidence alongside regime label, not in isolation.",
      "When regime and outlook diverge, state both plainly in digests.",
      "Use regime trend for directional language, not for operational triggers.",
      "Re-run timeline exercises to practice regime progression narration.",
    ],
    reviewCadence: "Daily during regime-focused scenario runs",
  },
  {
    id: "advisory-outlook",
    title: "Advisory Outlook",
    summary:
      "Describes near-term outlook panels, direction, confidence, and operator posture for forward-looking advisory framing.",
    content:
      "Advisory outlook synthesizes near-term directional signals from synthetic inputs — recovery, pressure continuation, or oscillation. Outlook confidence and outlook direction should be read with regime detection findings for coherent forward narratives.\n\nOutlook is explicitly near-term and advisory. It does not forecast production financial results. Recovery-after-pressure scenarios train improving outlook interpretation without implying operational release gates.\n\nOutlook progression in timelines teaches operators to close drills with forward language that matches institutional calm: continued observation, staged readiness, or defer expansion as appropriate.",
    operatorGuidance: [
      "Pair outlook review with regime section before executive summaries.",
      "Qualify outlook statements when outlook confidence is below regime confidence.",
      "Use recovery scenarios to practice improving outlook narration.",
      "Avoid presenting outlook as operational approval to scale activity.",
    ],
    reviewCadence: "Daily during outlook- and recovery-oriented scenarios",
  },
];

/** Standard advisory procedures for paper-mode procedure guides. */
export const TREASURY_PROCEDURES = [
  {
    id: "liquidity-stress-review",
    name: "Liquidity Stress Review",
    purpose:
      "Structured interpretive review of synthetic liquidity pressure profiles without operational liquidity actions.",
    relatedSections: [
      "treasury-overview",
      "operational-monitoring",
      "alert-readiness",
      "risk-narrative",
      "scenario-response",
    ],
    triggers: [
      "Synthetic liquidity pressure or withdrawal spike scenarios selected",
      "Elevated monitoring with liquidity-themed watch flags",
      "Validation scoring flags confidence thinning under liquidity archetypes",
    ],
    stepByStepActions: [
      "Confirm exercise is paper mode and label outputs synthetic.",
      "Review command center posture and confidence band first.",
      "Read operational monitoring signals and alert priority for liquidity themes.",
      "Inspect regime and outlook for directional consistency with liquidity stress.",
      "Walk decision trace steps citing sources affecting liquidity interpretation.",
      "Draft a calm risk narrative emphasizing observation, not intervention.",
      "Record interpretive findings offline; do not persist to production stores.",
    ],
    escalationPath:
      "If confidence falls below training baseline or coherence degrades, escalate visibility to leadership with hold-position framing only — never execute liquidity actions from the lab.",
    expectedOutcome:
      "A documented advisory interpretation of liquidity stress with explicit read-only boundaries and recommended observation cadence.",
  },
  {
    id: "operational-breakdown-response",
    name: "Operational Breakdown Response",
    purpose:
      "Advisory response path for high operational load and coherence degradation in simulation.",
    relatedSections: [
      "operational-monitoring",
      "operational-coherence",
      "consistency-checks",
      "decision-trace",
      "playbooks",
    ],
    triggers: [
      "Operational breakdown preset or high operational load in custom builder",
      "Fragmented or shortened decision trace in simulation output",
      "Failure-mode exercise surfacing coherence impact narratives",
    ],
    stepByStepActions: [
      "Identify operational breakdown archetype and expected coherence band.",
      "Review watch flags and recommended monitoring lists for saturation signals.",
      "Run consistency checks across command, operations, regime, and trace panels.",
      "Quote coherence scores and describe degradation in institutional language.",
      "Assess recommendation stability; treat unstable text as provisional.",
      "Prepare digest intelligence summary scoped to operational themes only.",
      "Confirm no operational events, notifications, or DB writes occurred.",
    ],
    escalationPath:
      "Escalate leadership visibility only when leadership readiness and regime warrant briefing; maintain defer-expansion and observation language throughout.",
    expectedOutcome:
      "Coherent operational breakdown narrative with trace-backed explainability and explicit non-operational posture.",
  },
  {
    id: "leadership-escalation-review",
    name: "Leadership Escalation Review",
    purpose:
      "Rehearse executive-facing advisory synthesis and visibility escalation without executive operational authority.",
    relatedSections: [
      "executive-escalation",
      "leadership-readiness",
      "digest-intelligence",
      "notification-readiness",
      "risk-narrative",
    ],
    triggers: [
      "Leadership visibility flag true in synthetic inputs",
      "Visibility-gap or leadership certification scenarios active",
      "Low leadership readiness with moderate trust in custom profiles",
    ],
    stepByStepActions: [
      "Assess leadership readiness dimension against trust and confidence.",
      "Draft one-page calm executive summary with simulation provenance stated first.",
      "Select two risk themes and one stability theme from panel outputs.",
      "Exclude trace minutiae unless briefing format requires drill-down appendix.",
      "Rehearse notification and digest tone; do not dispatch messages.",
      "Document visibility escalation decision and hold conditions offline.",
      "Verify no financial mutations or persistence accompanied the review.",
    ],
    escalationPath:
      "Observe → advise → escalate visibility: leadership receives interpretive context only; operational authority remains outside simulation scope.",
    expectedOutcome:
      "Executive-ready advisory summary labeled synthetic, with clear observation cadence and no implied approvals.",
  },
  {
    id: "advisory-drift-assessment",
    name: "Advisory Drift Assessment",
    purpose:
      "Formal assessment of recommendation and regime drift under synthetic drift event profiles.",
    relatedSections: [
      "advisory-drift",
      "recommendation-stability",
      "regime-detection",
      "advisory-outlook",
      "meta-reasoning",
    ],
    triggers: [
      "Advisory drift event preset or high drift dimension in custom builder",
      "Oscillating drift status with unstable recommendation text",
      "Sensitivity or comparison exercises showing directional disagreement",
    ],
    stepByStepActions: [
      "Capture baseline recommendation themes from initial scenario run.",
      "Run scenario comparison or sensitivity exercise to confirm drift direction.",
      "Document regime and outlook oscillation separately from recommendation text changes.",
      "Apply meta reasoning: is fragmentation expected for this input profile?",
      "Draft drift narrative for institutional audiences in calm language.",
      "Hold leadership visibility if drift disagreement persists across comparisons.",
      "Archive offline notes; no automated drift remediation in production.",
    ],
    escalationPath:
      "Escalate visibility when drift is confirmed directional and coherence remains adequate; otherwise hold and continue observation exercises.",
    expectedOutcome:
      "Confirmed drift assessment with comparison-backed direction and provisional recommendation framing.",
  },
  {
    id: "confidence-degradation-review",
    name: "Confidence Degradation Review",
    purpose:
      "Review explainability and confidence collapse profiles with humility and validation cross-checks.",
    relatedSections: [
      "explainability",
      "decision-support",
      "consistency-checks",
      "meta-reasoning",
      "attention-priorities",
    ],
    triggers: [
      "Confidence collapse scenario or low confidence in custom builder",
      "Validation scoring flags weak confidence quality",
      "Trace confidence degraded alongside fragmented steps",
    ],
    stepByStepActions: [
      "Record confidence and trace confidence numerically at review start.",
      "Read validation report safety notes and issues detected sections.",
      "Apply explainability discipline: cite trace limits before summarizing posture.",
      "Narrow digest and notification scope per attention priorities guidance.",
      "Quote decision support recommendations as provisional hypotheses.",
      "Perform meta reasoning on whether outputs are plausible for inputs.",
      "Document humility language for any institutional sharing.",
    ],
    escalationPath:
      "Defer leadership visibility escalation until confidence stabilizes in follow-up exercises or comparison confirms recovery direction.",
    expectedOutcome:
      "Confidence degradation narrative with explicit explainability limits and observation-first recommendations.",
  },
  {
    id: "scenario-comparison-protocol",
    name: "Scenario Comparison Protocol",
    purpose:
      "Standard protocol for side-by-side interpretive comparison of two or three synthetic scenarios.",
    relatedSections: [
      "scenario-response",
      "recommendation-stability",
      "consistency-checks",
      "institutional-memory",
      "operator-timeline",
    ],
    triggers: [
      "Operator selects two or three scenarios for comparison mode",
      "Single-run recommendations appear unstable or contradictory",
      "Certification exams require multi-scenario interpretive answers",
    ],
    stepByStepActions: [
      "Select two or three archetypes with deliberate diversity (e.g., stable vs spike).",
      "Run comparison and record confidence spread and highest-risk row.",
      "Review recommendation differences list before drafting synthesis.",
      "Compare trace step counts and regime-outlook pairings per row.",
      "Identify most stable scenario for institutional anchor narrative.",
      "Synthesize comparison summary in advisory-only language.",
      "Store findings in offline notes; session state only in the lab UI.",
    ],
    escalationPath:
      "If highest-risk scenario confidence spread exceeds training thresholds, escalate visibility with comparison table excerpts — never operational action.",
    expectedOutcome:
      "Side-by-side interpretive synthesis with documented recommendation differences and stability anchor.",
  },
  {
    id: "failure-mode-investigation",
    name: "Failure Mode Investigation",
    purpose:
      "Investigate contradictory and failure-mode stress tests for advisory reasoning integrity.",
    relatedSections: [
      "consistency-checks",
      "meta-reasoning",
      "operational-coherence",
      "explainability",
      "risk-narrative",
    ],
    triggers: [
      "Failure simulation mode producing contradictions list",
      "Contradictory guidance scenario active",
      "Failure validation scoring surfaces issues detected",
    ],
    stepByStepActions: [
      "Run designated failure-mode or contradictory scenario in paper mode.",
      "List contradictions detected without attempting to resolve via operational means.",
      "Review confidence and coherence impact panels for degradation narrative.",
      "Read operator risk posture and operator recommendations sections fully.",
      "Complete failure validation scoring review when available.",
      "Meta-reason about expected versus anomalous contradiction patterns.",
      "Produce failure investigation summary for offline institutional learning.",
    ],
    escalationPath:
      "Escalate visibility only to report advisory reasoning stress-test results; emphasize calm institutional risk posture labels from simulation.",
    expectedOutcome:
      "Failure investigation report confirming advisory remained read-only with documented contradictions and meta conclusions.",
  },
  {
    id: "recovery-validation",
    name: "Recovery Validation",
    purpose:
      "Validate improving drift, outlook, and recommendation themes after synthetic pressure recovery profiles.",
    relatedSections: [
      "advisory-outlook",
      "advisory-drift",
      "recommendation-stability",
      "operator-timeline",
      "review-cadence",
    ],
    triggers: [
      "Recovery-after-pressure scenario or improving drift status",
      "Timeline exercise ending in recovery-oriented outlook progression",
      "Comparison showing confidence spread narrowing toward stable archetype",
    ],
    stepByStepActions: [
      "Confirm recovery archetype inputs (improving drift, elevated-to-monitoring attention).",
      "Compare recovery run against prior pressure run via comparison or timeline.",
      "Validate outlook direction and regime trend align with recovery narrative.",
      "Assess recommendation stability for directional consistency with recovery.",
      "Check validation grades for improved coherence and safety scores.",
      "Draft near-term advisory outlook statement with continued observation caveats.",
      "Schedule follow-up observation cadence per review cadence section — no operational release.",
    ],
    escalationPath:
      "Leadership visibility may increase to share recovery outlook as advisory near-term signal — not as approval to expand operational scope.",
    expectedOutcome:
      "Recovery validation confirming directional improvement in synthetic outputs with sustained read-only posture.",
  },
];

const TREASURY_ESCALATION_RULES = [
  "Level 1 — Observe: Review synthetic panels, traces, and validation outputs without institutional sharing.",
  "Level 2 — Synthesize: Draft digests, risk narratives, and consistency notes offline with simulation labeling.",
  "Level 3 — Advise: Share calm advisory interpretations with peers or mentors in training context only.",
  "Level 4 — Escalate visibility: Provide leadership readouts of interpretive findings without operational authority.",
  "Explicit boundary: No level authorizes wallet, payout, withdrawal, PayPal, notification dispatch, or database writes.",
  "Explicit boundary: Escalation increases awareness, not execution — observe → synthesize → advise → escalate visibility.",
  "When confidence, coherence, or drift disagreement persists, hold at Level 1–2 until comparison or recovery validation completes.",
];

/**
 * @returns {typeof TREASURY_MANUAL_SECTIONS}
 */
export function getTreasuryManualSections() {
  return TREASURY_MANUAL_SECTIONS;
}

/**
 * @returns {typeof TREASURY_PROCEDURES}
 */
export function getTreasuryProcedures() {
  return TREASURY_PROCEDURES;
}

function aggregateReviewCadenceFromSections(sections) {
  const daily = [];
  const weekly = [];
  const monthly = [];
  const eventDriven = [];

  for (const section of sections) {
    const cadence = String(section.reviewCadence || "").toLowerCase();
    if (cadence.includes("event-driven")) {
      eventDriven.push(section.title);
    } else if (cadence.includes("monthly")) {
      monthly.push(section.title);
    } else if (cadence.includes("weekly")) {
      weekly.push(section.title);
    } else {
      daily.push(section.title);
    }
  }

  return {
    daily: daily.length ? `Daily focus areas include ${daily.slice(0, 6).join(", ")}${daily.length > 6 ? ", and related monitoring sections" : ""}.` : "Daily interpretive review during active lab exercises.",
    weekly: weekly.length ? `Weekly consolidation covers ${weekly.slice(0, 5).join(", ")}${weekly.length > 5 ? ", and additional training sections" : ""}.` : "Weekly digest and memory consolidation.",
    monthly: monthly.length ? `Monthly rhythm emphasizes ${monthly.join(", ")}.` : "Monthly regression and robustness reflection.",
    eventDriven: eventDriven.length
      ? `Event-driven reviews apply to ${eventDriven.join(", ")}.`
      : "Event-driven reviews after timelines, failure modes, and drift assessments.",
    summary:
      "Operators maintain daily panel review during active drills, weekly synthesis for digests and certification, monthly robustness reflection, and event-driven reviews after compound stress exercises.",
  };
}

function consolidateOperatorGuidance(sections, limit = 12) {
  const seen = new Set();
  const out = [];
  for (const section of sections) {
    for (const item of section.operatorGuidance || []) {
      if (!seen.has(item)) {
        seen.add(item);
        out.push(item);
      }
      if (out.length >= limit) break;
    }
    if (out.length >= limit) break;
  }
  return out;
}

function buildManualPreviewText(manual, highlightSectionId) {
  const lines = [
    manual.title,
    "═".repeat(Math.min(manual.title.length, 72)),
    "",
    `Generated: ${manual.generatedAt}`,
    "SIMULATION ONLY · READ-ONLY · ADVISORY — No database writes, financial mutations, or operational execution.",
    "",
    "EXECUTIVE SUMMARY",
    "────────────────",
    manual.executiveSummary,
    "",
    "OPERATOR GUIDANCE (CONSOLIDATED)",
    "──────────────────────────────",
    ...manual.operatorGuidance.map((g, i) => `${i + 1}. ${g}`),
    "",
    "REVIEW CADENCE",
    "──────────────",
    typeof manual.reviewCadence === "string"
      ? manual.reviewCadence
      : [
          `Daily: ${manual.reviewCadence.daily}`,
          `Weekly: ${manual.reviewCadence.weekly}`,
          `Monthly: ${manual.reviewCadence.monthly}`,
          `Event-driven: ${manual.reviewCadence.eventDriven}`,
          "",
          manual.reviewCadence.summary,
        ].join("\n"),
    "",
    "ESCALATION RULES (ADVISORY LADDER)",
    "────────────────────────────────",
    ...manual.escalationRules.map((r, i) => `${i + 1}. ${r}`),
    "",
    "STANDARD PROCEDURES",
    "───────────────────",
    ...manual.procedures.map((p) => `• ${p.name} — ${p.purpose}`),
    "",
    "MANUAL SECTIONS",
    "───────────────",
  ];

  for (const section of manual.sections) {
    const highlight =
      highlightSectionId && section.id === highlightSectionId ? " ★ FOCUS SECTION ★" : "";
    lines.push(
      "",
      `## ${section.title}${highlight}`,
      section.summary,
      "",
      section.content,
      "",
      "Operator guidance:",
      ...section.operatorGuidance.map((g) => `  - ${g}`),
      `Review cadence: ${section.reviewCadence}`,
    );
  }

  lines.push("", "— End of Treasury Operations Manual — Simulation Lab Reference");
  return lines.join("\n");
}

function buildProcedurePreviewText(guide) {
  return [
    guide.procedureName,
    "─".repeat(Math.min(guide.procedureName.length, 64)),
    "",
    "SIMULATION ONLY · READ-ONLY · ADVISORY",
    "",
    `Purpose: ${guide.purpose}`,
    "",
    "Triggers:",
    ...guide.triggers.map((t, i) => `${i + 1}. ${t}`),
    "",
    "Step-by-step actions (advisory only):",
    ...guide.stepByStepActions.map((s, i) => `${i + 1}. ${s}`),
    "",
    `Escalation path: ${guide.escalationPath}`,
    "",
    `Expected outcome: ${guide.expectedOutcome}`,
    "",
    "— End of procedure guide —",
  ].join("\n");
}

/**
 * Build full treasury operations manual (paper mode, in-memory only).
 * @param {{ sectionId?: string }} [options] — sectionId highlights a section in preview; full manual always returned
 */
export function buildTreasuryOperationsManual(options = {}) {
  const { sectionId } = options;
  const generatedAt = new Date().toISOString();
  const sections = TREASURY_MANUAL_SECTIONS.map((s) => ({ ...s }));

  const procedures = TREASURY_PROCEDURES.map((p) => ({
    name: p.name,
    purpose: p.purpose,
    relatedSections: p.relatedSections,
  }));

  const reviewCadence = aggregateReviewCadenceFromSections(sections);
  const operatorGuidance = consolidateOperatorGuidance(sections);

  const executiveSummary =
    "This Treasury Operations Manual is a synthetic, advisory reference for operators learning through the Treasury Simulation Lab. " +
    "It describes how to observe simulated posture, synthesize calm institutional narratives, and advise stakeholders while escalating visibility — never execution. " +
    "All content is deterministic, generated in memory, and disconnected from production treasury systems, databases, wallets, payouts, withdrawals, and notifications. " +
    (sectionId
      ? `Section focus: ${sections.find((s) => s.id === sectionId)?.title || sectionId}. The full manual is included below with the focused section marked.`
      : "Twenty-four sections and eight standard procedures support interpretive training across monitoring, escalation, explainability, drift, and outlook domains.");

  const manualCore = {
    title: "Treasury Operations Manual — Simulation Lab Reference",
    generatedAt,
    sections,
    procedures,
    escalationRules: [...TREASURY_ESCALATION_RULES],
    reviewCadence,
    operatorGuidance,
    executiveSummary,
  };

  const manualPreviewText = buildManualPreviewText(manualCore, sectionId || undefined);

  return {
    ...manualCore,
    manualPreviewText,
    focusSectionId: sectionId || null,
  };
}

/**
 * Build procedure guide for a standard advisory procedure (paper mode).
 * @param {string} procedureId
 */
export function buildTreasuryProcedureGuide(procedureId) {
  const procedure = TREASURY_PROCEDURES.find((p) => p.id === procedureId);
  if (!procedure) {
    return null;
  }

  const guide = {
    procedureName: procedure.name,
    purpose: procedure.purpose,
    triggers: [...procedure.triggers],
    stepByStepActions: [...procedure.stepByStepActions],
    escalationPath: procedure.escalationPath,
    expectedOutcome: procedure.expectedOutcome,
    relatedSections: [...procedure.relatedSections],
  };

  return {
    ...guide,
    procedurePreviewText: buildProcedurePreviewText(guide),
  };
}

// ─── Phase 4M: Treasury Audit & Review Packs (read-only, advisory, in-memory) ───

function formatAuditPeriodLabel(date = new Date()) {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function resolveAuditScenarioId(scope) {
  const scoped = scope?.scenarioId ? String(scope.scenarioId) : "";
  if (scoped && getTreasurySimulationScenario(scoped)) return scoped;
  return TREASURY_SIMULATION_SCENARIOS[0]?.id || "";
}

function deriveAuditGradeFromMetrics({ averageScore, issueCount, safetyIssueCount, lowScoreCount }) {
  let grade = deriveGrade(averageScore);

  if (safetyIssueCount > 0) {
    grade = downgradeGrade(grade, Math.min(2, safetyIssueCount));
  }

  if (issueCount >= 8) {
    grade = downgradeGrade(grade, 2);
  } else if (issueCount >= 4) {
    grade = downgradeGrade(grade, 1);
  }

  if (lowScoreCount >= 3) {
    grade = capGradeAt(grade, "C");
  }

  if (averageScore < 60) {
    grade = capGradeAt(grade, "D");
  }

  return grade;
}

function buildAuditExecutiveSummary(auditTypeName, auditGrade, scenariosReviewedCount, avgScore) {
  if (auditGrade === "A" || auditGrade === "B") {
    return `Advisory posture reviewed across ${scenariosReviewedCount} synthetic ${scenariosReviewedCount === 1 ? "entry" : "entries"} in the ${auditTypeName.toLowerCase()} with stable safety alignment (aggregate score ${avgScore}/100, grade ${auditGrade}). Paper-mode findings remain advisory-only with no operational mirroring implied.`;
  }
  if (auditGrade === "C") {
    return `Mixed validation signals observed across ${scenariosReviewedCount} synthetic ${scenariosReviewedCount === 1 ? "entry" : "entries"} in the ${auditTypeName.toLowerCase()} (aggregate score ${avgScore}/100, grade ${auditGrade}). Recommend targeted paper-mode follow-up before institutional sharing.`;
  }
  return `Elevated interpretive burden identified in the ${auditTypeName.toLowerCase()} across ${scenariosReviewedCount} synthetic ${scenariosReviewedCount === 1 ? "entry" : "entries"} (aggregate score ${avgScore}/100, grade ${auditGrade}). Hold advisory mirroring until gaps are reconciled in paper mode.`;
}

function buildAuditPreviewText(pack) {
  const lines = [
    pack.title,
    `Generated: ${pack.generatedAt}`,
    "Treasury Simulation Lab — Audit Pack (paper mode)",
    "",
    formatReportSection("Executive Summary", pack.executiveSummary),
    "",
    formatReportSection("Audit Grade", `Grade ${pack.auditGrade}`),
    "",
    formatReportSection(
      "Scenarios Reviewed",
      pack.scenariosReviewed.length
        ? pack.scenariosReviewed
            .map(
              (row) =>
                `• ${row.name} (${row.type})${row.validationScore != null ? ` — score ${row.validationScore}/100` : ""}${row.grade ? `, grade ${row.grade}` : ""}${row.notes ? `: ${row.notes}` : ""}`,
            )
            .join("\n")
        : "None reviewed.",
    ),
    "",
    formatReportSection("Findings", pack.findings.map((f) => `• ${f}`).join("\n") || "None identified."),
    "",
    formatReportSection("Strengths", pack.strengths.map((s) => `• ${s}`).join("\n") || "None identified."),
    "",
    formatReportSection("Weaknesses", pack.weaknesses.map((w) => `• ${w}`).join("\n") || "None identified."),
    "",
    formatReportSection("Recommendations", pack.recommendations.map((r) => `• ${r}`).join("\n") || "None."),
    "",
    "---",
    "SIMULATION ONLY — read-only, advisory-only. No database writes, persistence, alerts, or financial mutations.",
  ];
  return lines.join("\n");
}

const TREASURY_AUDIT_REVIEW_TYPE_MAP = {
  "scenario-audit": "Scenario Coverage Review",
  "failure-mode-audit": "Failure Mode Resilience Review",
  "regression-audit": "Regression Posture Review",
  "sensitivity-audit": "Sensitivity Robustness Review",
  "monte-carlo-audit": "Monte Carlo Stability Review",
  "certification-audit": "Certification Readiness Review",
  "full-lab-audit": "Comprehensive Lab Review",
};

export const TREASURY_AUDIT_TYPES = [
  {
    id: "scenario-audit",
    name: "Scenario Audit",
    description:
      "Runs and scores synthetic treasury scenarios to validate advisory posture across the scenario library or a scoped subset.",
    defaultScope: { scenarioId: null },
  },
  {
    id: "failure-mode-audit",
    name: "Failure Mode Audit",
    description:
      "Exercises all failure simulation modes to assess advisory reasoning integrity under synthetic contradiction stress.",
    defaultScope: {},
  },
  {
    id: "regression-audit",
    name: "Regression Audit",
    description:
      "Aggregates the full regression suite across scenarios and failure modes for institutional baseline validation.",
    defaultScope: {},
  },
  {
    id: "sensitivity-audit",
    name: "Sensitivity Audit",
    description:
      "Runs controlled perturbation overlay against a base scenario to measure advisory robustness under synthetic stress.",
    defaultScope: { scenarioId: null, perturbationLevel: "moderate" },
  },
  {
    id: "monte-carlo-audit",
    name: "Monte Carlo Audit",
    description:
      "Runs seeded Monte Carlo stability sweep against a base scenario to assess recommendation volatility in paper mode.",
    defaultScope: { scenarioId: null, iterations: 100 },
  },
  {
    id: "certification-audit",
    name: "Certification Audit",
    description:
      "Summarizes certification exam definitions and builds a sample exam pack for advisory readiness review.",
    defaultScope: { examId: null },
  },
  {
    id: "full-lab-audit",
    name: "Full Lab Audit",
    description:
      "Combines regression, sample sensitivity, sample Monte Carlo, and certification overview into a comprehensive lab audit.",
    defaultScope: { scenarioId: null, perturbationLevel: "moderate", iterations: 100 },
  },
];

/**
 * @returns {typeof TREASURY_AUDIT_TYPES}
 */
export function getTreasuryAuditTypes() {
  return TREASURY_AUDIT_TYPES;
}

function runScenarioAudit(scope) {
  const scopedId = scope?.scenarioId ? String(scope.scenarioId) : "";
  const scenarios = scopedId
    ? TREASURY_SIMULATION_SCENARIOS.filter((s) => s.id === scopedId)
    : TREASURY_SIMULATION_SCENARIOS;

  const scenariosReviewed = [];
  const findings = [];
  const strengths = [];
  const weaknesses = [];
  const recommendations = [];
  const scores = [];
  let safetyIssueCount = 0;
  let lowScoreCount = 0;

  scenarios.forEach((scenario) => {
    const result = runTreasurySimulation(scenario.id);
    const score = scoreTreasurySimulationResult(result);
    scores.push(score.validationScore);

    const notes = score.validationSummary || result.summary || "";
    scenariosReviewed.push({
      name: scenario.name,
      type: "scenario",
      validationScore: score.validationScore,
      grade: score.validationGrade,
      notes: notes.slice(0, 120),
    });

    if (score.validationScore < 75) {
      lowScoreCount += 1;
      weaknesses.push(
        `${scenario.name}: validation score ${score.validationScore}/100 — reconcile regime, outlook, and trace alignment.`,
      );
    } else if (score.validationScore >= 85) {
      strengths.push(
        `${scenario.name}: validation score ${score.validationScore}/100 — strong advisory alignment under synthetic inputs.`,
      );
    }

    if (score.safetyScore < 80) {
      safetyIssueCount += 1;
      findings.push(
        `${scenario.name}: safety score ${score.safetyScore}/100 — review advisory tone for read-only institutional framing.`,
      );
    }

    (score.issuesDetected || []).forEach((issue) => {
      findings.push(`${scenario.name}: ${issue}`);
    });
  });

  if (scenarios.length >= 3 && lowScoreCount === 0) {
    strengths.push(
      `Full scenario coverage (${scenarios.length}) exercised deterministically with no runs below institutional threshold.`,
    );
  }

  if (lowScoreCount > 0) {
    recommendations.push(
      "Schedule paper-mode reconciliation for low-scoring scenarios before mirroring advisory posture institutionally.",
    );
  }

  if (safetyIssueCount > 0) {
    recommendations.push(
      "Audit simulation copy for execution or mutation language — treasury paper mode must remain advisory-only.",
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Scenario audit posture is stable — continue periodic paper-mode validation drills to preserve advisory quality.",
    );
  }

  const averageScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, v) => sum + v, 0) / scores.length) : 0;

  findings.unshift(
    `Scenario audit completed across ${scenarios.length} synthetic ${scenarios.length === 1 ? "scenario" : "scenarios"} with average validation score ${averageScore}/100.`,
  );

  return {
    scenariosReviewed,
    findings: dedupeSimilarStrings(findings),
    strengths: dedupeSimilarStrings(strengths),
    weaknesses: dedupeSimilarStrings(weaknesses),
    recommendations: dedupeSimilarStrings(recommendations).slice(0, 5),
    averageScore,
    safetyIssueCount,
    lowScoreCount,
    issueCount: findings.length,
  };
}

function runFailureModeAudit() {
  const scenariosReviewed = [];
  const findings = [];
  const strengths = [];
  const weaknesses = [];
  const recommendations = [];
  const scores = [];
  let safetyIssueCount = 0;
  let lowScoreCount = 0;

  TREASURY_FAILURE_SIMULATION_MODES.forEach((mode) => {
    const result = runTreasuryFailureSimulation(mode.id);
    const score = scoreTreasurySimulationResult(result);
    scores.push(score.validationScore);

    scenariosReviewed.push({
      name: mode.name,
      type: "failure-mode",
      validationScore: score.validationScore,
      grade: score.validationGrade,
      notes: result.summary ? String(result.summary).slice(0, 120) : mode.description?.slice(0, 120),
    });

    if (score.validationScore < 75) {
      lowScoreCount += 1;
      weaknesses.push(
        `${mode.name}: validation score ${score.validationScore}/100 — strengthen contradiction surfacing with calm institutional framing.`,
      );
    } else if (score.validationScore >= 85) {
      strengths.push(
        `${mode.name}: advisory remained coherent under synthetic stress (score ${score.validationScore}/100).`,
      );
    }

    if (score.safetyScore < 80) {
      safetyIssueCount += 1;
      findings.push(`${mode.name}: safety score ${score.safetyScore}/100 under failure test conditions.`);
    }

    if ((result.contradictions || []).length > 0) {
      findings.push(
        `${mode.name}: ${result.contradictions.length} contradiction(s) surfaced — advisory stability ${result.advisoryStability || "stable"}.`,
      );
    }
  });

  if (lowScoreCount === 0) {
    strengths.push(
      `All ${TREASURY_FAILURE_SIMULATION_MODES.length} failure modes completed with validation scores at or above institutional threshold.`,
    );
  }

  if (lowScoreCount > 0) {
    recommendations.push(
      "Review weakest failure modes for tone and contradiction handling before operational mirroring.",
    );
  }

  recommendations.push(
    "Maintain failure testing as read-only stress validation — no alerts, notifications, or production coupling.",
  );

  const averageScore =
    scores.length > 0 ? Math.round(scores.reduce((sum, v) => sum + v, 0) / scores.length) : 0;

  findings.unshift(
    `Failure mode audit completed across ${TREASURY_FAILURE_SIMULATION_MODES.length} synthetic failure tests with average validation score ${averageScore}/100.`,
  );

  return {
    scenariosReviewed,
    findings: dedupeSimilarStrings(findings),
    strengths: dedupeSimilarStrings(strengths),
    weaknesses: dedupeSimilarStrings(weaknesses),
    recommendations: dedupeSimilarStrings(recommendations).slice(0, 5),
    averageScore,
    safetyIssueCount,
    lowScoreCount,
    issueCount: findings.length,
  };
}

function runRegressionAudit() {
  const suite = runTreasurySimulationRegressionSuite();
  const scenariosReviewed = [];

  suite.scenarioResults.forEach((row) => {
    scenariosReviewed.push({
      name: row.scenarioName,
      type: "scenario",
      validationScore: row.score.validationScore,
      grade: row.score.validationGrade,
      notes: row.score.validationSummary?.slice(0, 120),
    });
  });

  suite.failureResults.forEach((row) => {
    scenariosReviewed.push({
      name: row.modeName,
      type: "failure-mode",
      validationScore: row.score.validationScore,
      grade: row.score.validationGrade,
      notes: row.score.validationSummary?.slice(0, 120),
    });
  });

  const findings = [
    suite.summary,
    ...suite.issuesDetected.slice(0, 8),
  ];

  return {
    scenariosReviewed,
    findings: dedupeSimilarStrings(findings),
    strengths: suite.strengths.slice(0, 8),
    weaknesses: suite.issuesDetected.slice(0, 6),
    recommendations: suite.recommendations,
    averageScore: suite.averageValidationScore,
    safetyIssueCount: suite.averageSafetyScore < 75 ? 1 : 0,
    lowScoreCount: scenariosReviewed.filter((r) => (r.validationScore ?? 100) < 75).length,
    issueCount: suite.issuesDetected.length,
    auditGradeOverride: suite.regressionGrade,
  };
}

function runSensitivityAudit(scope) {
  const scenarioId = resolveAuditScenarioId(scope);
  const level = scope?.perturbationLevel || "moderate";
  const sensitivity = runTreasurySensitivitySimulation({
    baseScenario: scenarioId,
    perturbationLevel: level,
  });

  if (!sensitivity) {
    return {
      scenariosReviewed: [],
      findings: ["Sensitivity audit could not be completed — invalid base scenario or perturbation level."],
      strengths: [],
      weaknesses: ["Sensitivity simulation returned no result."],
      recommendations: ["Select a valid scenario and perturbation level, then regenerate the audit."],
      averageScore: 0,
      safetyIssueCount: 0,
      lowScoreCount: 1,
      issueCount: 1,
    };
  }

  const scenariosReviewed = [
    {
      name: sensitivity.baseScenarioName,
      type: "sensitivity",
      validationScore: sensitivity.stabilityScore,
      grade: sensitivity.robustnessGrade,
      notes: sensitivity.sensitivitySummary?.slice(0, 120),
    },
    ...sensitivity.resultRows.map((row) => ({
      name: row.variationLabel,
      type: "sensitivity-variation",
      validationScore: row.validationScore,
      grade: deriveGrade(row.validationScore ?? 0),
      notes: row.notes?.slice(0, 120),
    })),
  ];

  const findings = [
    sensitivity.sensitivitySummary,
    `Stability score ${sensitivity.stabilityScore}/100 under ${level} perturbation.`,
    `Recommendation shift level: ${humanizeToken(sensitivity.recommendationShift)}.`,
  ];

  const strengths = [];
  const weaknesses = [];

  if (sensitivity.robustnessGrade === "A" || sensitivity.robustnessGrade === "B") {
    strengths.push(
      `${sensitivity.baseScenarioName} maintained advisory stability under ${level} synthetic perturbation (grade ${sensitivity.robustnessGrade}).`,
    );
  } else {
    weaknesses.push(
      `${sensitivity.baseScenarioName} showed elevated recommendation shift under ${level} perturbation (grade ${sensitivity.robustnessGrade}).`,
    );
  }

  return {
    scenariosReviewed,
    findings,
    strengths,
    weaknesses,
    recommendations: sensitivity.recommendations,
    averageScore: sensitivity.stabilityScore,
    safetyIssueCount: sensitivity.stabilityScore < 72 ? 1 : 0,
    lowScoreCount: sensitivity.robustnessGrade === "D" || sensitivity.robustnessGrade === "F" ? 1 : 0,
    issueCount: weaknesses.length + findings.length,
    auditGradeOverride: sensitivity.robustnessGrade,
  };
}

function runMonteCarloAudit(scope) {
  const scenarioId = resolveAuditScenarioId(scope);
  const iterations = scope?.iterations ?? 100;
  const monteCarlo = runTreasuryMonteCarloSimulation({
    baseScenario: scenarioId,
    iterations,
  });

  if (!monteCarlo) {
    return {
      scenariosReviewed: [],
      findings: ["Monte Carlo audit could not be completed — invalid base scenario or iteration count."],
      strengths: [],
      weaknesses: ["Monte Carlo simulation returned no result."],
      recommendations: ["Select a valid scenario and iteration count, then regenerate the audit."],
      averageScore: 0,
      safetyIssueCount: 0,
      lowScoreCount: 1,
      issueCount: 1,
    };
  }

  const scenariosReviewed = [
    {
      name: monteCarlo.baseScenarioName,
      type: "monte-carlo",
      validationScore: monteCarlo.averageStabilityScore,
      grade: monteCarlo.robustnessGrade,
      notes: monteCarlo.summary?.slice(0, 120),
    },
  ];

  if (monteCarlo.weakestIteration) {
    scenariosReviewed.push({
      name: `Weakest iteration #${monteCarlo.weakestIteration.iteration}`,
      type: "monte-carlo-iteration",
      validationScore: monteCarlo.weakestIteration.stabilityScore,
      grade: deriveGrade(monteCarlo.weakestIteration.stabilityScore),
      notes: monteCarlo.weakestIteration.notes?.slice(0, 120),
    });
  }

  if (monteCarlo.strongestIteration) {
    scenariosReviewed.push({
      name: `Strongest iteration #${monteCarlo.strongestIteration.iteration}`,
      type: "monte-carlo-iteration",
      validationScore: monteCarlo.strongestIteration.stabilityScore,
      grade: deriveGrade(monteCarlo.strongestIteration.stabilityScore),
      notes: monteCarlo.strongestIteration.notes?.slice(0, 120),
    });
  }

  const findings = [monteCarlo.summary, ...monteCarlo.findings.slice(0, 6)];
  const strengths = [];
  const weaknesses = [];

  if (monteCarlo.robustnessGrade === "A" || monteCarlo.robustnessGrade === "B") {
    strengths.push(
      `Monte Carlo sweep (${monteCarlo.iterationsRun} iterations) shows stable advisory posture for ${monteCarlo.baseScenarioName}.`,
    );
  } else {
    weaknesses.push(
      `Recommendation volatility ${humanizeToken(monteCarlo.recommendationVolatility)} observed across ${monteCarlo.iterationsRun} iterations.`,
    );
  }

  return {
    scenariosReviewed,
    findings,
    strengths,
    weaknesses,
    recommendations: monteCarlo.recommendations,
    averageScore: monteCarlo.averageStabilityScore,
    safetyIssueCount: monteCarlo.averageStabilityScore < 72 ? 1 : 0,
    lowScoreCount: monteCarlo.robustnessGrade === "D" || monteCarlo.robustnessGrade === "F" ? 1 : 0,
    issueCount: findings.length,
    auditGradeOverride: monteCarlo.robustnessGrade,
  };
}

function runCertificationAudit(scope) {
  const examId = scope?.examId ? String(scope.examId) : TREASURY_CERTIFICATION_EXAMS[0]?.id;
  const scenariosReviewed = TREASURY_CERTIFICATION_EXAMS.map((exam) => ({
    name: exam.level,
    type: "certification-exam",
    validationScore: exam.passingScore,
    grade: deriveGrade(exam.passingScore),
    notes: exam.summary?.slice(0, 120),
  }));

  const sampleExam = buildTreasuryCertificationExam(examId);
  const findings = [
    `${TREASURY_CERTIFICATION_EXAMS.length} certification exam definitions reviewed in paper mode.`,
    sampleExam
      ? `Sample exam built: ${sampleExam.title} (${sampleExam.scenarios.length} scenarios, ${sampleExam.questions.length} questions).`
      : "Sample exam could not be built for the selected level.",
  ];

  TREASURY_CERTIFICATION_EXAMS.forEach((exam) => {
    findings.push(
      `${exam.level} (${exam.difficulty}): ${exam.scenarioRefs.length} scenario refs, passing score ${exam.passingScore}/100.`,
    );
  });

  const strengths = [
    "Certification framework remains self-guided with no persistence or live credentialing.",
    "All exam levels include explicit read-only and advisory-only safety boundaries in rubrics.",
  ];

  const weaknesses = [];
  if (!sampleExam) {
    weaknesses.push("Selected certification exam could not be resolved — verify exam identifier.");
  }

  const recommendations = [
    "Use certification audits for operator readiness review only — not as live treasury credentialing.",
    "Generate assessment packs on demand for offline self-study; no submission or score storage occurs.",
  ];

  if (sampleExam) {
    recommendations.push(
      `Review sample ${sampleExam.level} exam scenarios and expected findings before institutional sharing.`,
    );
  }

  const averageScore =
    TREASURY_CERTIFICATION_EXAMS.length > 0
      ? Math.round(
          TREASURY_CERTIFICATION_EXAMS.reduce((sum, e) => sum + e.passingScore, 0) /
            TREASURY_CERTIFICATION_EXAMS.length,
        )
      : 0;

  return {
    scenariosReviewed,
    findings,
    strengths,
    weaknesses,
    recommendations: dedupeSimilarStrings(recommendations).slice(0, 5),
    averageScore,
    safetyIssueCount: 0,
    lowScoreCount: sampleExam ? 0 : 1,
    issueCount: weaknesses.length,
    auditGradeOverride: deriveGrade(averageScore),
  };
}

function runFullLabAudit(scope) {
  const regression = runRegressionAudit();
  const sensitivity = runSensitivityAudit(scope);
  const monteCarlo = runMonteCarloAudit(scope);
  const certification = runCertificationAudit(scope);

  const scenariosReviewed = [
    ...regression.scenariosReviewed.slice(0, 4).map((r) => ({ ...r, notes: `[Regression] ${r.notes || ""}`.trim() })),
    ...sensitivity.scenariosReviewed.slice(0, 3).map((r) => ({ ...r, notes: `[Sensitivity] ${r.notes || ""}`.trim() })),
    ...monteCarlo.scenariosReviewed.slice(0, 3).map((r) => ({ ...r, notes: `[Monte Carlo] ${r.notes || ""}`.trim() })),
    ...certification.scenariosReviewed.map((r) => ({ ...r, notes: `[Certification] ${r.notes || ""}`.trim() })),
  ];

  const findings = dedupeSimilarStrings([
    "Full lab audit combines regression, sensitivity, Monte Carlo, and certification overview.",
    regression.findings[0],
    sensitivity.findings[0],
    monteCarlo.findings[0],
    certification.findings[0],
    ...regression.findings.slice(1, 3),
    ...monteCarlo.findings.slice(1, 3),
  ]);

  const strengths = dedupeSimilarStrings([
    ...regression.strengths.slice(0, 3),
    ...sensitivity.strengths,
    ...monteCarlo.strengths,
    ...certification.strengths,
  ]).slice(0, 8);

  const weaknesses = dedupeSimilarStrings([
    ...regression.weaknesses.slice(0, 3),
    ...sensitivity.weaknesses,
    ...monteCarlo.weaknesses,
    ...certification.weaknesses,
  ]).slice(0, 6);

  const recommendations = dedupeSimilarStrings([
    ...regression.recommendations,
    ...sensitivity.recommendations.slice(0, 2),
    ...monteCarlo.recommendations.slice(0, 2),
    ...certification.recommendations.slice(0, 2),
    "Maintain treasury simulation lab as read-only — no production treasury mutations implied by full lab audit.",
  ]).slice(0, 6);

  const averageScore = Math.round(
    (regression.averageScore + sensitivity.averageScore + monteCarlo.averageScore + certification.averageScore) / 4,
  );

  const safetyIssueCount =
    regression.safetyIssueCount + sensitivity.safetyIssueCount + monteCarlo.safetyIssueCount;
  const lowScoreCount = regression.lowScoreCount + sensitivity.lowScoreCount + monteCarlo.lowScoreCount;
  const issueCount = findings.length + weaknesses.length;

  return {
    scenariosReviewed,
    findings,
    strengths,
    weaknesses,
    recommendations,
    averageScore,
    safetyIssueCount,
    lowScoreCount,
    issueCount,
  };
}

/**
 * Build a treasury audit pack (paper mode, in-memory, no persistence).
 * @param {{ auditType: string, scope?: { scenarioId?: string, perturbationLevel?: string, iterations?: number, examId?: string } }} params
 * @returns {object | null}
 */
export function buildTreasuryAuditPack({ auditType, scope = {} }) {
  const typeDef = TREASURY_AUDIT_TYPES.find((t) => t.id === auditType);
  if (!typeDef) return null;

  const mergedScope = { ...typeDef.defaultScope, ...scope };
  let auditData;

  switch (auditType) {
    case "scenario-audit":
      auditData = runScenarioAudit(mergedScope);
      break;
    case "failure-mode-audit":
      auditData = runFailureModeAudit();
      break;
    case "regression-audit":
      auditData = runRegressionAudit();
      break;
    case "sensitivity-audit":
      auditData = runSensitivityAudit(mergedScope);
      break;
    case "monte-carlo-audit":
      auditData = runMonteCarloAudit(mergedScope);
      break;
    case "certification-audit":
      auditData = runCertificationAudit(mergedScope);
      break;
    case "full-lab-audit":
      auditData = runFullLabAudit(mergedScope);
      break;
    default:
      return null;
  }

  const auditGrade =
    auditData.auditGradeOverride ||
    deriveAuditGradeFromMetrics({
      averageScore: auditData.averageScore,
      issueCount: auditData.issueCount,
      safetyIssueCount: auditData.safetyIssueCount,
      lowScoreCount: auditData.lowScoreCount,
    });

  const periodLabel = formatAuditPeriodLabel();
  const title = `Treasury ${typeDef.name} — ${periodLabel}`;
  const generatedAt = new Date().toISOString();

  const executiveSummary = buildAuditExecutiveSummary(
    typeDef.name,
    auditGrade,
    auditData.scenariosReviewed.length,
    auditData.averageScore,
  );

  const pack = {
    title,
    generatedAt,
    auditType,
    scenariosReviewed: auditData.scenariosReviewed,
    findings: auditData.findings,
    strengths: auditData.strengths,
    weaknesses: auditData.weaknesses,
    recommendations: auditData.recommendations,
    auditGrade,
    executiveSummary,
    auditPreviewText: "",
  };

  pack.auditPreviewText = buildAuditPreviewText(pack);
  return pack;
}

function buildReviewPreviewText(review) {
  return [
    `${review.reviewType}`,
    "Treasury Simulation Lab — Review Pack (paper mode)",
    "",
    formatReportSection("Summary", review.summary),
    "",
    formatReportSection("Observations", review.observations.map((o) => `• ${o}`).join("\n") || "None."),
    "",
    formatReportSection("Recurring Patterns", review.recurringPatterns.map((p) => `• ${p}`).join("\n") || "None."),
    "",
    formatReportSection("Risk Themes", review.riskThemes.map((r) => `• ${r}`).join("\n") || "None."),
    "",
    formatReportSection("Improvement Areas", review.improvementAreas.map((i) => `• ${i}`).join("\n") || "None."),
    "",
    "---",
    "Advisory review only — no database writes, persistence, or financial mutations.",
  ].join("\n");
}

/**
 * Build a treasury review pack from an audit pack or lighter standalone analysis (paper mode, in-memory).
 * @param {{ auditType: string, scope?: object, auditPack?: object }} params
 * @returns {object | null}
 */
export function buildTreasuryReviewPack({ auditType, scope = {}, auditPack = null }) {
  const typeDef = TREASURY_AUDIT_TYPES.find((t) => t.id === auditType);
  if (!typeDef) return null;

  const pack = auditPack || buildTreasuryAuditPack({ auditType, scope });
  if (!pack) return null;

  const reviewType = TREASURY_AUDIT_REVIEW_TYPE_MAP[auditType] || "Operational Review";

  const observations = [
    pack.executiveSummary,
    ...pack.findings.slice(0, 4),
  ];

  const recurringPatterns = [];
  if (pack.weaknesses.some((w) => /safety score/i.test(w))) {
    recurringPatterns.push("Safety framing gaps recur across reviewed entries — institutional tone review warranted.");
  }
  if (pack.weaknesses.some((w) => /validation score/i.test(w) && /below|reconcile|elevated/i.test(w))) {
    recurringPatterns.push("Validation score dispersion suggests inconsistent advisory alignment under synthetic stress.");
  }
  if (pack.strengths.some((s) => /strong advisory|stable|coherent/i.test(s))) {
    recurringPatterns.push("Baseline scenarios and failure tests generally preserve calm, read-only advisory posture.");
  }
  if (pack.scenariosReviewed.filter((r) => r.type === "failure-mode").length >= 2) {
    recurringPatterns.push("Failure mode coverage exercises contradiction surfacing without production coupling.");
  }
  if (recurringPatterns.length === 0) {
    recurringPatterns.push("No dominant cross-cutting patterns identified — advisory posture appears consistent within audit scope.");
  }

  const riskThemes = [];
  if (pack.auditGrade === "D" || pack.auditGrade === "F") {
    riskThemes.push("Aggregate audit grade indicates elevated interpretive burden before institutional sharing.");
  }
  if (pack.weaknesses.length >= 3) {
    riskThemes.push("Multiple weakness signals suggest compound advisory alignment gaps under synthetic stress.");
  }
  pack.weaknesses.slice(0, 3).forEach((w) => {
    if (/volatility|shift|perturbation|monte carlo/i.test(w)) {
      riskThemes.push("Recommendation volatility under perturbation may increase operator interpretive burden.");
    }
    if (/failure|contradiction|stress/i.test(w)) {
      riskThemes.push("Failure-mode stress surfaces contradiction handling as a recurring review theme.");
    }
  });
  if (riskThemes.length === 0) {
    riskThemes.push("No material risk themes beyond routine paper-mode monitoring cadence.");
  }

  const improvementAreas = [
    ...pack.recommendations.slice(0, 3),
    ...pack.weaknesses.slice(0, 2).map((w) => `Address: ${w}`),
  ];
  if (improvementAreas.length === 0) {
    improvementAreas.push("Continue periodic audit and review pack generation to maintain institutional advisory baselines.");
  }

  const summary = `The ${reviewType.toLowerCase()} assessed ${pack.scenariosReviewed.length} synthetic ${pack.scenariosReviewed.length === 1 ? "entry" : "entries"} with audit grade ${pack.auditGrade}. Findings remain advisory-only and do not imply operational action, persistence, or financial mutation.`;

  const review = {
    reviewType,
    observations: dedupeSimilarStrings(observations).slice(0, 6),
    recurringPatterns: dedupeSimilarStrings(recurringPatterns).slice(0, 5),
    riskThemes: dedupeSimilarStrings(riskThemes).slice(0, 5),
    improvementAreas: dedupeSimilarStrings(improvementAreas).slice(0, 5),
    summary,
    reviewPreviewText: "",
  };

  review.reviewPreviewText = buildReviewPreviewText(review);
  return review;
}

// ─── Phase 4O: Treasury Crisis War Room Simulator (read-only, advisory, in-memory) ───

export const TREASURY_CRISIS_LEVELS = [
  {
    level: 1,
    id: "minor",
    label: "Level 1 — Minor",
    intensityMultiplier: 0.85,
    severityTone: "routine",
    paceFactor: 1.0,
  },
  {
    level: 2,
    id: "elevated",
    label: "Level 2 — Elevated",
    intensityMultiplier: 1.0,
    severityTone: "elevated",
    paceFactor: 0.92,
  },
  {
    level: 3,
    id: "significant",
    label: "Level 3 — Significant",
    intensityMultiplier: 1.15,
    severityTone: "significant",
    paceFactor: 0.85,
  },
  {
    level: 4,
    id: "severe",
    label: "Level 4 — Severe",
    intensityMultiplier: 1.3,
    severityTone: "severe",
    paceFactor: 0.78,
  },
  {
    level: 5,
    id: "critical",
    label: "Level 5 — Critical",
    intensityMultiplier: 1.45,
    severityTone: "critical",
    paceFactor: 0.72,
  },
];

const WAR_ROOM_EVENT_SEVERITIES = ["info", "watch", "elevated", "advisory"];

export const TREASURY_WAR_ROOM_SCENARIOS = [
  {
    id: "liquidity-crunch",
    name: "Liquidity Crunch",
    description:
      "Synthetic liquidity pressure tightens advisory confidence while institutional posture remains paper-mode. Rehearses calm liquidity observation and visibility escalation without operational mirroring.",
    baseScenarioRef: { type: "preset", id: "liquidity-crunch" },
    defaultCrisisLevel: 3,
    eventTemplates: [
      { timeOffset: "T+0", phase: "detection", eventType: "liquidity_signal", description: "Synthetic liquidity pressure registers across treasury advisory panels.", advisoryNote: "Observe liquidity coherence; confirm paper-mode boundaries before leadership readout." },
      { timeOffset: "T+12m", phase: "assessment", eventType: "confidence_review", description: "Advisory confidence band narrows under constrained synthetic liquidity profile.", advisoryNote: "Synthesize confidence narrative — no payout or wallet action implied." },
      { timeOffset: "T+28m", phase: "coordination", eventType: "regime_alignment", description: "Regime classification shifts toward elevated monitoring under liquidity stress tokens.", advisoryNote: "Compare regime and outlook panels before escalating visibility." },
      { timeOffset: "T+45m", phase: "visibility", eventType: "leadership_readout", description: "Leadership visibility checkpoint recommended for institutional liquidity posture summary.", advisoryNote: "Prepare calm executive framing — advisory rehearsal only." },
      { timeOffset: "T+1h", phase: "stabilization", eventType: "observation_hold", description: "Command center posture holds tightened observation with stable escalation language.", advisoryNote: "Maintain read-only monitoring cadence; defer production mirroring." },
      { timeOffset: "T+1h15m", phase: "synthesis", eventType: "advisory_synthesis", description: "Operator synthesis window opens for cross-panel liquidity narrative consolidation.", advisoryNote: "Session notes only — no persistence or alerting." },
      { timeOffset: "T+1h30m", phase: "review", eventType: "posture_review", description: "End-of-rehearsal posture review compares opening versus current simulated confidence.", advisoryNote: "Confirm rehearsal remained simulation-only." },
      { timeOffset: "T+1h45m", phase: "closure", eventType: "rehearsal_close", description: "War room rehearsal closes with institutional calm summary and lessons learned capture.", advisoryNote: "Outputs are not stored or transmitted." },
    ],
    operatorObjectives: ["Establish baseline synthetic liquidity posture from underlying simulation context.", "Track confidence and regime progression without treating signals as live alerts.", "Synthesize a calm leadership-ready liquidity narrative for paper-mode review.", "Confirm all responses remain observe-and-advise with visibility escalation only.", "Capture lessons learned for future institutional rehearsal cadence."],
    recommendedResponses: ["Observe liquidity panels and reconcile advisory coherence across simulated outputs.", "Synthesize institutional summary language suitable for leadership visibility review.", "Advise continued paper-mode monitoring with tightened observation readiness.", "Escalate visibility to leadership channels when interpretive burden rises — no operational action.", "Document rehearsal findings in operator session notes without persistence or alerting."],
    escalationPoints: ["Simulated confidence falls below institutional comfort band for liquidity narratives.", "Regime and outlook tokens diverge under liquidity stress — visibility review warranted.", "Contradictory panel signals increase operator interpretive burden beyond paper-mode baseline.", "Leadership visibility gap detected while liquidity pressure remains elevated in simulation."],
    lessonsLearned: ["Liquidity crunch rehearsals benefit from early regime-outlook alignment checks.", "Calm escalation language preserves institutional trust during synthetic pressure events.", "Paper-mode boundaries should be restated at each visibility checkpoint."],
  },
  {
    id: "withdrawal-surge",
    name: "Withdrawal Surge",
    description:
      "Synthetic withdrawal velocity stress against liabilities exercises command center and regime escalation paths. Validates observational posture under velocity uptick without payout disruption language.",
    baseScenarioRef: { type: "scenario", id: "high_withdrawal_spike" },
    defaultCrisisLevel: 4,
    eventTemplates: [
      { timeOffset: "T+0", phase: "detection", eventType: "velocity_signal", description: "Synthetic withdrawal velocity uptick registers relative to liability baseline.", advisoryNote: "Observe velocity panels — do not initiate withdrawal action." },
      { timeOffset: "T+10m", phase: "assessment", eventType: "liability_context", description: "Liability exposure context reviewed against simulated spike magnitude.", advisoryNote: "Synthesize liability narrative for interpretive burden assessment." },
      { timeOffset: "T+25m", phase: "coordination", eventType: "command_posture", description: "Command center attention signal elevates under synthetic velocity pressure.", advisoryNote: "Compare command status with regime classification." },
      { timeOffset: "T+40m", phase: "visibility", eventType: "trace_review", description: "Decision trace steps highlight velocity-driven advisory shifts in paper mode.", advisoryNote: "Review trace fragmentation calmly — no operational logging." },
      { timeOffset: "T+55m", phase: "stabilization", eventType: "monitoring_cadence", description: "Recommended monitoring list expands under sustained velocity rehearsal.", advisoryNote: "Advise expanded observational cadence only." },
      { timeOffset: "T+1h10m", phase: "synthesis", eventType: "outlook_check", description: "Near-term outlook tokens reviewed for consistency with velocity stress narrative.", advisoryNote: "Escalate visibility if outlook and regime diverge materially." },
      { timeOffset: "T+1h25m", phase: "review", eventType: "posture_review", description: "Operator compares opening versus current simulated posture under velocity surge.", advisoryNote: "Confirm stable advisory escalation posture at closure." },
      { timeOffset: "T+1h40m", phase: "closure", eventType: "rehearsal_close", description: "Withdrawal surge rehearsal closes with measured institutional summary.", advisoryNote: "No production coupling." },
    ],
    operatorObjectives: ["Characterize synthetic withdrawal velocity against liability baseline in paper mode.", "Monitor command center and regime alignment under velocity stress tokens.", "Maintain institutional calm when describing elevated attention signals.", "Prepare visibility-ready summary without payout or withdrawal execution language.", "Validate trace interpretability under velocity-driven advisory shifts."],
    recommendedResponses: ["Observe withdrawal velocity and liability panels for synthetic coherence.", "Synthesize command-regime-outlook alignment narrative for operator review.", "Advise tightened observational cadence with defer-expansion readiness language.", "Escalate leadership visibility when interpretive burden exceeds rehearsal baseline.", "Reconcile trace steps with panel outputs before closing rehearsal."],
    escalationPoints: ["Simulated command status and regime classification diverge under velocity stress.", "Confidence spread exceeds institutional threshold for velocity narratives.", "Trace fragmentation increases operator review time beyond rehearsal plan.", "Outlook tokens suggest deteriorating posture while command language remains calm."],
    lessonsLearned: ["Velocity surge rehearsals should pair liability context with command posture early.", "Trace review prevents over-indexing on single-panel velocity signals.", "Visibility escalation framing works best when separated from operational verbs."],
  },
  {
    id: "fraud-spike",
    name: "Fraud Spike",
    description:
      "Clustered fraud-adjacent synthetic signals at modest scale. Rehearses integrity stress observability and fraud-aware monitoring copy without operational logging.",
    baseScenarioRef: { type: "scenario", id: "fraud_signal_cluster" },
    defaultCrisisLevel: 3,
    eventTemplates: [
      { timeOffset: "T+0", phase: "detection", eventType: "integrity_signal", description: "Synthetic fraud cluster count elevates integrity stress indicators.", advisoryNote: "Observe integrity panels — no fraud queue mutation or alert dispatch." },
      { timeOffset: "T+15m", phase: "assessment", eventType: "coherence_check", description: "Advisory coherence reviewed under integrity stress classification.", advisoryNote: "Synthesize integrity narrative without alarmist production coupling." },
      { timeOffset: "T+30m", phase: "coordination", eventType: "regime_shift", description: "Regime tokens shift toward integrity stress with active advisory review posture.", advisoryNote: "Compare regime signals with command center concerns list." },
      { timeOffset: "T+50m", phase: "visibility", eventType: "leadership_readout", description: "Leadership visibility checkpoint for integrity stress rehearsal summary.", advisoryNote: "Frame as synthetic integrity observation — not live fraud incident." },
      { timeOffset: "T+1h5m", phase: "stabilization", eventType: "monitoring_hold", description: "Watch flags emphasize fraud-adjacent observability in paper mode.", advisoryNote: "Advise observational hold — no case creation or enforcement action." },
      { timeOffset: "T+1h20m", phase: "synthesis", eventType: "recommendation_review", description: "Simulated recommendations scanned for institutional tone and safety boundaries.", advisoryNote: "Reject any execution language before institutional sharing." },
      { timeOffset: "T+1h35m", phase: "closure", eventType: "rehearsal_close", description: "Fraud spike rehearsal closes with integrity-focused lessons learned.", advisoryNote: "Confirm no operational fraud workflows were invoked." },
    ],
    operatorObjectives: ["Map synthetic fraud cluster signals to integrity stress regime narrative.", "Preserve calm institutional language when describing clustered signals.", "Coordinate command center concerns with regime and outlook panels.", "Prepare integrity stress visibility summary for leadership rehearsal.", "Verify recommendations remain observational and non-operational."],
    recommendedResponses: ["Observe integrity and fraud-adjacent panels for synthetic signal clustering.", "Synthesize integrity stress narrative with explicit paper-mode framing.", "Advise active advisory review posture without case or enforcement verbs.", "Escalate visibility when leadership readiness gaps appear in simulation.", "Review recommendation text for safety scan compliance before closure."],
    escalationPoints: ["Integrity stress regime conflicts with calm command center language.", "Coherence score degrades under clustered synthetic fraud signals.", "Leadership visibility flag active while interpretive confidence remains low.", "Recommendation text approaches execution boundary — safety review required."],
    lessonsLearned: ["Fraud spike rehearsals require explicit paper-mode framing at opening.", "Integrity stress regimes benefit from early command-concerns alignment.", "Safety scan of recommendation text should precede visibility escalation."],
  },
  {
    id: "treasury-signal-contradiction",
    name: "Treasury Signal Contradiction",
    description:
      "Mixed coherence, drift, and readiness signals exercise meta-reasoning under contradiction density. Rehearses advisory synthesis when panels disagree in simulation.",
    baseScenarioRef: { type: "failure", id: "contradiction_test" },
    defaultCrisisLevel: 3,
    eventTemplates: [
      { timeOffset: "T+0", phase: "detection", eventType: "contradiction_surface", description: "Failure test surfaces contradictions between guidance layers and baselines.", advisoryNote: "Treat contradictions as interpretive burden — not production alerts." },
      { timeOffset: "T+18m", phase: "assessment", eventType: "confidence_impact", description: "Confidence impact narrative compared across contradictory simulated layers.", advisoryNote: "Synthesize before/after confidence spread for operator review." },
      { timeOffset: "T+35m", phase: "coordination", eventType: "coherence_review", description: "Coherence impact description aligned with contradiction test intent.", advisoryNote: "Reconcile coherence language with regime and outlook tokens." },
      { timeOffset: "T+52m", phase: "visibility", eventType: "stability_label", description: "Advisory stability labeling reviewed for institutional sharing readiness.", advisoryNote: "Escalate visibility if stability label implies operational urgency." },
      { timeOffset: "T+1h8m", phase: "stabilization", eventType: "operator_risk", description: "Operator risk posture assessed under contradictory advisory simulation.", advisoryNote: "Maintain calm observational posture in all synthesis outputs." },
      { timeOffset: "T+1h22m", phase: "synthesis", eventType: "contradiction_matrix", description: "Contradiction matrix synthesized for leadership rehearsal readout.", advisoryNote: "Matrix exists for session interpretive exercise only." },
      { timeOffset: "T+1h38m", phase: "closure", eventType: "rehearsal_close", description: "Contradiction rehearsal closes with meta-reasoning lessons learned.", advisoryNote: "No database writes." },
    ],
    operatorObjectives: ["Inventory contradictions surfaced by failure test without treating as live alerts.", "Interpret confidence and coherence impact narratives accurately.", "Assess advisory stability labeling for institutional tone.", "Synthesize contradiction matrix for visibility rehearsal.", "Confirm failure test remained read-only with no persistence."],
    recommendedResponses: ["Observe contradictory guidance layers and document interpretive deltas.", "Synthesize confidence impact narrative for leadership visibility review.", "Advise hold-position readiness when contradictions remain unresolved in paper mode.", "Escalate visibility when contradiction density exceeds rehearsal comfort band.", "Recommend human reconciliation before any production advisory mirror."],
    escalationPoints: ["Contradiction count exceeds rehearsal baseline for operator interpretive burden.", "Advisory stability degrades from stable to shifting under contradiction density.", "Confidence impact spread widens beyond institutional narrative comfort.", "Coherence impact language conflicts with regime classification tokens."],
    lessonsLearned: ["Contradiction rehearsals benefit from explicit stability labeling review.", "Meta-reasoning quality improves when confidence impact is narrated early.", "Production mirror checks should remain separate from war room synthesis."],
  },
  {
    id: "alert-storm",
    name: "Alert Storm",
    description:
      "High operational load with elevated secondary stress dimensions simulates monitoring queue saturation. Rehearses signal triage without wallet or payout mutation.",
    baseScenarioRef: { type: "preset", id: "monitoring-overload" },
    defaultCrisisLevel: 4,
    eventTemplates: [
      { timeOffset: "T+0", phase: "detection", eventType: "alert_density", description: "Synthetic alert priority elevation registers across monitoring panels.", advisoryNote: "Observe alert density — no alert dispatch, scheduling, or notification." },
      { timeOffset: "T+8m", phase: "assessment", eventType: "queue_saturation", description: "Operational load tokens suggest monitoring queue saturation in paper mode.", advisoryNote: "Synthesize triage narrative without implying ticket creation." },
      { timeOffset: "T+22m", phase: "coordination", eventType: "attention_signal", description: "Attention signal elevates while command posture remains institutionally readable.", advisoryNote: "Prioritize panel triage order for operator cognitive load management." },
      { timeOffset: "T+38m", phase: "visibility", eventType: "leadership_summary", description: "Leadership summary checkpoint for alert storm rehearsal posture.", advisoryNote: "Frame as synthetic monitoring saturation — not live incident." },
      { timeOffset: "T+54m", phase: "stabilization", eventType: "cadence_reset", description: "Recommended monitoring cadence reviewed for sustainable observational pacing.", advisoryNote: "Advise observational pacing only — no automation or scheduling." },
      { timeOffset: "T+1h12m", phase: "synthesis", eventType: "priority_triage", description: "Priority triage matrix synthesized from simulated panel outputs.", advisoryNote: "Triage matrix is rehearsal artifact — not persisted." },
      { timeOffset: "T+1h28m", phase: "review", eventType: "posture_review", description: "Operator reviews alert storm opening versus closing simulated posture.", advisoryNote: "Confirm stable advisory escalation posture at closure." },
      { timeOffset: "T+1h42m", phase: "closure", eventType: "rehearsal_close", description: "Alert storm rehearsal closes with triage discipline lessons learned.", advisoryNote: "No notifications were sent during this simulation." },
    ],
    operatorObjectives: ["Triage synthetic alert density without dispatch or scheduling verbs.", "Maintain readable command posture narrative under monitoring saturation.", "Prioritize panel review order to manage interpretive load.", "Prepare leadership summary for alert storm visibility rehearsal.", "Validate sustainable observational cadence recommendations."],
    recommendedResponses: ["Observe alert priority and attention panels for synthetic density patterns.", "Synthesize triage matrix ranking panels by interpretive materiality.", "Advise expanded monitoring list with calm institutional pacing language.", "Escalate visibility when leadership readiness lags alert density in simulation.", "Recommend session breaks between high-density rehearsals — no operational action."],
    escalationPoints: ["Alert priority tokens exceed rehearsal triage capacity.", "Command readability degrades under simultaneous elevated signals.", "Operational load remains high while confidence band narrows.", "Monitoring recommendations approach execution boundary in text scan."],
    lessonsLearned: ["Alert storm rehearsals require explicit triage ordering discipline.", "Sustainable cadence language prevents operator fatigue during dense simulations.", "Leadership summaries should separate density metrics from operational urgency."],
  },
  {
    id: "escalation-breakdown",
    name: "Escalation Breakdown",
    description:
      "Escalation ambiguity between leadership visibility and stable baseline. Rehearses calm escalation path clarity without triggering operational events.",
    baseScenarioRef: { type: "failure", id: "escalation_conflict" },
    defaultCrisisLevel: 3,
    eventTemplates: [
      { timeOffset: "T+0", phase: "detection", eventType: "escalation_ambiguity", description: "Failure test exposes escalation ambiguity between compared baselines.", advisoryNote: "Document ambiguity — not authorization for operational escalation." },
      { timeOffset: "T+20m", phase: "assessment", eventType: "visibility_compare", description: "Leadership visibility case compared against stable soft launch baseline.", advisoryNote: "Synthesize visibility delta for institutional review." },
      { timeOffset: "T+38m", phase: "coordination", eventType: "posture_compare", description: "Command posture mismatch reviewed across compared simulations.", advisoryNote: "Reconcile posture language before visibility escalation." },
      { timeOffset: "T+55m", phase: "visibility", eventType: "escalation_path", description: "Escalation path clarity checkpoint for operator rehearsal.", advisoryNote: "Visibility escalation only — no workflow or alert triggers." },
      { timeOffset: "T+1h12m", phase: "stabilization", eventType: "advisory_hold", description: "Advisory hold recommended until escalation path is narratively clear.", advisoryNote: "Hold-position readiness — not production freeze language." },
      { timeOffset: "T+1h28m", phase: "closure", eventType: "rehearsal_close", description: "Escalation breakdown rehearsal closes with path-clarity lessons learned.", advisoryNote: "Confirm no escalation workflows were invoked." },
    ],
    operatorObjectives: ["Identify escalation ambiguity surfaced by failure comparison test.", "Contrast leadership visibility against stable baseline narratives.", "Clarify visibility escalation path without operational verbs.", "Assess command posture alignment across compared simulations.", "Document path-clarity findings for future rehearsal reference."],
    recommendedResponses: ["Observe escalation tokens across compared simulation baselines.", "Synthesize visibility delta narrative for leadership rehearsal.", "Advise hold-position readiness until escalation path is institutionally clear.", "Escalate visibility to leadership channels when ambiguity persists in paper mode.", "Recommend separate human review before mirroring escalation language to production."],
    escalationPoints: ["Escalation ambiguity persists beyond second visibility checkpoint.", "Command posture mismatch widens between compared baselines.", "Leadership visibility gap coincides with elevated attention signals.", "Operator risk posture shifts from calm to elevated interpretive burden."],
    lessonsLearned: ["Escalation rehearsals should name visibility paths explicitly at T+0.", "Baseline comparison prevents false confidence in escalation clarity.", "Hold-position language must remain distinct from operational freeze terms."],
  },
  {
    id: "leadership-visibility-failure",
    name: "Leadership Visibility Failure",
    description:
      "Leadership readiness lags while institutional trust remains moderate. Rehearses executive visibility gap framing in strict paper mode.",
    baseScenarioRef: { type: "preset", id: "leadership-visibility-gap" },
    defaultCrisisLevel: 2,
    eventTemplates: [
      { timeOffset: "T+0", phase: "detection", eventType: "visibility_gap", description: "Synthetic leadership readiness lag detected against moderate trust baseline.", advisoryNote: "Frame as visibility rehearsal — not executive escalation trigger." },
      { timeOffset: "T+25m", phase: "assessment", eventType: "trust_context", description: "Institutional trust tokens reviewed alongside leadership readiness gap.", advisoryNote: "Synthesize trust-readiness narrative for calm leadership readout." },
      { timeOffset: "T+48m", phase: "coordination", eventType: "trace_clarity", description: "Trace steps reviewed for executive-readable visibility language.", advisoryNote: "Prefer trace clarity over density in visibility summaries." },
      { timeOffset: "T+1h5m", phase: "visibility", eventType: "executive_readout", description: "Executive readout draft checkpoint for visibility failure rehearsal.", advisoryNote: "Draft for session review only — no distribution or alerting." },
      { timeOffset: "T+1h22m", phase: "stabilization", eventType: "readiness_hold", description: "Hold-position readiness affirmed while visibility gap remains in simulation.", advisoryNote: "Continue paper-mode testing — no go-live authorization implied." },
      { timeOffset: "T+1h38m", phase: "closure", eventType: "rehearsal_close", description: "Visibility failure rehearsal closes with executive framing lessons learned.", advisoryNote: "No leadership notifications sent." },
    ],
    operatorObjectives: ["Characterize leadership readiness lag against trust baseline in simulation.", "Draft calm executive-readable visibility summary for rehearsal.", "Align trace language with leadership audience expectations.", "Maintain hold-position readiness without operational authorization language.", "Confirm visibility rehearsal remained advisory-only."],
    recommendedResponses: ["Observe leadership readiness and trust panels for synthetic gap patterns.", "Synthesize executive readout draft with institutional calm tone.", "Advise continued paper-mode testing while visibility gap is narrated.", "Escalate visibility rehearsal to leadership review channel when draft is ready.", "Recommend trace simplification before institutional sharing."],
    escalationPoints: ["Leadership readiness remains low while operational load elevates in simulation.", "Trust tokens moderate but coherence degrades — interpretive burden rises.", "Trace language too dense for executive audience without synthesis pass.", "Visibility gap persists beyond planned rehearsal window."],
    lessonsLearned: ["Visibility rehearsals benefit from trust-readiness pairing at opening.", "Executive readouts should prioritize clarity over panel density.", "Hold-position language protects against mistaken go-live inference."],
  },
  {
    id: "advisory-drift-event",
    name: "Advisory Drift Event",
    description:
      "Elevated advisory drift with unstable recommendations. Rehearses regime oscillation handling and sensitivity confirmation before institutional sharing.",
    baseScenarioRef: { type: "preset", id: "advisory-drift-event" },
    defaultCrisisLevel: 3,
    eventTemplates: [
      { timeOffset: "T+0", phase: "detection", eventType: "drift_signal", description: "Synthetic advisory drift elevation registers with unstable recommendation tokens.", advisoryNote: "Observe drift — no persistence or recommendation deployment." },
      { timeOffset: "T+16m", phase: "assessment", eventType: "stability_check", description: "Recommendation stability dimension reviewed under drift deterioration.", advisoryNote: "Synthesize stability narrative before regime-outlook reconciliation." },
      { timeOffset: "T+33m", phase: "coordination", eventType: "regime_oscillation", description: "Regime oscillation tokens observed under controlled paper-mode perturbation.", advisoryNote: "Compare oscillation against opening regime classification." },
      { timeOffset: "T+50m", phase: "visibility", eventType: "sensitivity_note", description: "Sensitivity confirmation recommended before institutional sharing of drift narrative.", advisoryNote: "Run sensitivity simulation separately if needed — not auto-triggered here." },
      { timeOffset: "T+1h6m", phase: "stabilization", eventType: "outlook_variation", description: "Outlook variation reviewed for consistency with drift rehearsal storyline.", advisoryNote: "Advise observational hold on sharing until synthesis complete." },
      { timeOffset: "T+1h24m", phase: "closure", eventType: "rehearsal_close", description: "Advisory drift rehearsal closes with stability discipline lessons learned.", advisoryNote: "Drift outputs are not written to any store." },
    ],
    operatorObjectives: ["Track advisory drift elevation and recommendation stability in paper mode.", "Reconcile regime oscillation with outlook variation tokens.", "Plan sensitivity confirmation before institutional sharing.", "Maintain calm language when describing unstable recommendation text.", "Document drift rehearsal findings without persistence."],
    recommendedResponses: ["Observe drift and stability panels for synthetic deterioration patterns.", "Synthesize drift narrative with explicit paper-mode and non-operational framing.", "Advise sensitivity confirmation before any institutional sharing of outputs.", "Escalate visibility when drift coincides with low confidence in simulation.", "Recommend trace review over time for creeping drift patterns."],
    escalationPoints: ["Recommendation stability falls to low while drift remains high.", "Regime oscillation conflicts with outlook direction tokens.", "Confidence band narrows under drift without coherent recovery narrative.", "Operator interpretive burden exceeds rehearsal plan for drift events."],
    lessonsLearned: ["Drift rehearsals should pair stability checks with regime review early.", "Sensitivity confirmation prevents premature institutional sharing.", "Oscillation tokens require explicit comparison to opening classification."],
  },
  {
    id: "multi-system-stress",
    name: "Multi-System Stress Event",
    description:
      "Operational breakdown profile with fragmented coherence exercises cross-system observability. Rehearses synthetic load without production coupling.",
    baseScenarioRef: { type: "preset", id: "operational-breakdown" },
    defaultCrisisLevel: 4,
    eventTemplates: [
      { timeOffset: "T+0", phase: "detection", eventType: "load_signal", description: "Operational load overwhelms synthetic advisory coherence in paper mode.", advisoryNote: "Observe load signals — no system changes or queue mutation." },
      { timeOffset: "T+14m", phase: "assessment", eventType: "coherence_fragment", description: "Coherence fragmentation noted across command, regime, and trace panels.", advisoryNote: "Synthesize fragmentation map for operator triage." },
      { timeOffset: "T+30m", phase: "coordination", eventType: "cross_panel", description: "Cross-panel reconciliation attempted under multi-system stress rehearsal.", advisoryNote: "Prioritize material panels — avoid exhaustive simultaneous review." },
      { timeOffset: "T+47m", phase: "visibility", eventType: "operational_watch", description: "Operational watch flags summarized for leadership visibility checkpoint.", advisoryNote: "Watch flags are synthetic — not production watch list entries." },
      { timeOffset: "T+1h3m", phase: "stabilization", eventType: "defer_expansion", description: "Defer-expansion readiness affirmed under multi-system stress tokens.", advisoryNote: "Defer expansion is advisory readiness — not operational halt." },
      { timeOffset: "T+1h18m", phase: "synthesis", eventType: "fragmentation_map", description: "Fragmentation map synthesized for end-of-rehearsal institutional review.", advisoryNote: "Map remains in session — no export or persistence." },
      { timeOffset: "T+1h34m", phase: "closure", eventType: "rehearsal_close", description: "Multi-system stress rehearsal closes with cross-panel discipline lessons.", advisoryNote: "No production systems were contacted." },
    ],
    operatorObjectives: ["Map operational load impact on advisory coherence across panels.", "Triage cross-panel fragmentation without production coupling language.", "Summarize operational watch flags for visibility rehearsal.", "Maintain defer-expansion readiness as advisory-only posture.", "Synthesize fragmentation map for institutional review."],
    recommendedResponses: ["Observe operational load and coherence panels for stress patterns.", "Synthesize cross-panel fragmentation map with calm institutional tone.", "Advise defer-expansion readiness and expanded observability language only.", "Escalate visibility when fragmentation exceeds rehearsal triage plan.", "Recommend phased panel review to reduce interpretive overload."],
    escalationPoints: ["Coherence remains low while operational load stays high across checkpoints.", "Command readability degrades under simultaneous watch flag elevation.", "Trace fragmentation prevents concise leadership synthesis.", "Defer-expansion readiness conflicts with optimistic outlook tokens."],
    lessonsLearned: ["Multi-system rehearsals require phased panel review discipline.", "Fragmentation maps help leadership audiences without operational verbs.", "Defer-expansion language must stay advisory, not authoritative halt."],
  },
  {
    id: "compound-treasury-crisis",
    name: "Compound Treasury Crisis",
    description:
      "Layered stress across liquidity, integrity, and confidence dimensions. Rehearses compound interpretive burden with strict paper-mode boundaries.",
    baseScenarioRef: { type: "comparison", ids: ["high_withdrawal_spike", "fraud_signal_cluster", "confidence_collapse"] },
    defaultCrisisLevel: 5,
    eventTemplates: [
      { timeOffset: "T+0", phase: "detection", eventType: "compound_open", description: "Compound crisis rehearsal opens with layered synthetic stress baselines.", advisoryNote: "Establish paper-mode boundaries before interpreting layered signals." },
      { timeOffset: "T+10m", phase: "assessment", eventType: "liquidity_layer", description: "Liquidity stress layer reviewed from high withdrawal spike baseline.", advisoryNote: "Layer one — observe only, no operational mirroring." },
      { timeOffset: "T+24m", phase: "assessment", eventType: "integrity_layer", description: "Integrity stress layer reviewed from fraud signal cluster baseline.", advisoryNote: "Layer two — maintain institutional calm across integrity tokens." },
      { timeOffset: "T+40m", phase: "coordination", eventType: "confidence_layer", description: "Confidence collapse layer reviewed for explainability degradation.", advisoryNote: "Layer three — emphasize advisory humility in synthesis language." },
      { timeOffset: "T+58m", phase: "visibility", eventType: "compound_summary", description: "Compound summary checkpoint for leadership visibility rehearsal.", advisoryNote: "Synthesize layers — visibility escalation only, no execution." },
      { timeOffset: "T+1h15m", phase: "stabilization", eventType: "posture_hold", description: "Command posture holds elevated attention with stable escalation language.", advisoryNote: "Confirm compound rehearsal did not trigger alerts or persistence." },
      { timeOffset: "T+1h32m", phase: "synthesis", eventType: "lessons_capture", description: "Lessons learned capture window for compound crisis interpretive model.", advisoryNote: "Capture in local session notes — not lab persistence." },
      { timeOffset: "T+1h48m", phase: "closure", eventType: "rehearsal_close", description: "Compound treasury crisis rehearsal closes with full-layer institutional summary.", advisoryNote: "Crisis rehearsal completed — simulation only, no financial mutations." },
    ],
    operatorObjectives: ["Sequence layered stress interpretation without collapsing panels into alarm.", "Synthesize compound narrative across liquidity, integrity, and confidence layers.", "Maintain advisory humility when confidence explainability is low.", "Prepare leadership compound summary for visibility rehearsal only.", "Validate paper-mode boundaries held across entire compound rehearsal."],
    recommendedResponses: ["Observe each stress layer sequentially before compound synthesis.", "Synthesize compound institutional summary with explicit simulation framing.", "Advise elevated monitoring and visibility escalation without operational verbs.", "Escalate leadership visibility when compound interpretive burden exceeds plan.", "Recommend full lab audit in separate session if institutional baseline needed."],
    escalationPoints: ["Any stress layer shows safety scan failure in recommendation text.", "Compound confidence spread exceeds institutional narrative capacity.", "Layered regime tokens contradict across comparison baselines.", "Operator cannot complete synthesis within rehearsal window — visibility required."],
    lessonsLearned: ["Compound crises require sequential layer review before synthesis.", "Advisory humility language is essential when confidence collapse is in the stack.", "Paper-mode restatement at each layer prevents operational inference."],
  },
];

const WAR_ROOM_BY_ID = Object.fromEntries(TREASURY_WAR_ROOM_SCENARIOS.map((s) => [s.id, s]));

const CRISIS_LEVEL_BY_NUM = Object.fromEntries(TREASURY_CRISIS_LEVELS.map((l) => [l.level, l]));

/**
 * @returns {typeof TREASURY_WAR_ROOM_SCENARIOS}
 */
export function getTreasuryWarRoomScenarios() {
  return TREASURY_WAR_ROOM_SCENARIOS;
}

function normalizeWarRoomCrisisLevel(crisisLevel, defaultLevel = 3) {
  const n = Number(crisisLevel);
  if (!Number.isFinite(n)) return Math.min(5, Math.max(1, defaultLevel));
  return Math.min(5, Math.max(1, Math.round(n)));
}

function extractWarRoomSimulationContext(resolvedContext) {
  if (!resolvedContext) {
    return { regime: "Unknown", outlook: "Unknown", confidence: 0, contextName: "Unresolved context", contextType: "none" };
  }
  const sim = resolvedContext.simulationResult;
  if (resolvedContext.type === "failure" && sim) {
    const before = sim.confidenceImpact?.before ?? 0;
    const after = sim.confidenceImpact?.after ?? before;
    return {
      regime: humanizeToken(sim.advisoryStability || "shifting"),
      outlook: humanizeToken(sim.operatorRisk || "elevated_monitoring"),
      confidence: after,
      contextName: resolvedContext.name,
      contextType: "failure",
    };
  }
  if (resolvedContext.type === "comparison" && resolvedContext.comparisonResult) {
    const comp = resolvedContext.comparisonResult;
    const conf = comp.confidenceSpread || { min: 0, max: 0, spread: 0 };
    const primary = comp.simulations?.[0];
    return {
      regime: primary ? humanizeToken(primary.simulatedRegime?.regime) : "Mixed",
      outlook: primary ? humanizeToken(primary.simulatedOutlook?.outlook) : "Mixed",
      confidence: Math.round((conf.min + conf.max) / 2),
      contextName: resolvedContext.name,
      contextType: "comparison",
    };
  }
  if (sim?.simulatedRegime) {
    return {
      regime: humanizeToken(sim.simulatedRegime.regime),
      outlook: humanizeToken(sim.simulatedOutlook?.outlook),
      confidence: sim.confidence ?? 0,
      contextName: resolvedContext.name,
      contextType: resolvedContext.type,
    };
  }
  return {
    regime: "Unknown",
    outlook: "Unknown",
    confidence: 0,
    contextName: resolvedContext.name,
    contextType: resolvedContext.type,
  };
}

function warRoomEventCountForLevel(crisisLevel) {
  return Math.min(8, Math.max(5, 4 + crisisLevel));
}

function selectWarRoomEventTemplates(templates, eventCount) {
  const list = templates || [];
  if (list.length === 0) return [];
  if (list.length <= eventCount) return list.slice(0, eventCount);
  const selected = [];
  const step = (list.length - 1) / Math.max(1, eventCount - 1);
  for (let i = 0; i < eventCount; i += 1) {
    const idx = Math.min(list.length - 1, Math.round(i * step));
    if (!selected.includes(list[idx])) selected.push(list[idx]);
  }
  let cursor = 0;
  while (selected.length < eventCount && cursor < list.length) {
    if (!selected.includes(list[cursor])) selected.push(list[cursor]);
    cursor += 1;
  }
  return selected.slice(0, eventCount);
}

function intensifyWarRoomText(text, crisisDef) {
  const tone = crisisDef?.severityTone || "significant";
  const prefix =
    tone === "routine" ? "" : tone === "elevated" ? "Elevated rehearsal: " : tone === "significant" ? "Significant rehearsal: " : tone === "severe" ? "Severe rehearsal: " : "Critical rehearsal: ";
  return prefix ? `${prefix}${text}` : text;
}

function buildWarRoomTimeline(scenario, crisisLevel, crisisDef, simulationContext) {
  const eventCount = warRoomEventCountForLevel(crisisLevel);
  const templates = selectWarRoomEventTemplates(scenario.eventTemplates, eventCount);
  return templates.map((tpl, index) => ({
    timeOffset: tpl.timeOffset,
    phase: tpl.phase,
    eventType: tpl.eventType,
    description: intensifyWarRoomText(
      `${tpl.description.replace(/\.$/, "")} (synthetic ${simulationContext.regime} regime, ${simulationContext.outlook} outlook).`,
      crisisDef,
    ),
    advisoryNote: tpl.advisoryNote,
    sequence: index + 1,
  }));
}

function parseTimeOffsetMinutes(timeOffset) {
  const raw = String(timeOffset || "T+0");
  const match = raw.match(/T\+(\d+)(m|h)?/i);
  if (!match) return 0;
  const value = Number(match[1]) || 0;
  const unit = (match[2] || "m").toLowerCase();
  return unit === "h" ? value * 60 : value;
}

function formatWarRoomTimestamp(minutesFromStart) {
  const h = Math.floor(minutesFromStart / 60);
  const m = minutesFromStart % 60;
  return `T+${h}:${String(m).padStart(2, "0")}`;
}

function eventStreamSeverity(index, total, crisisLevel) {
  const ratio = total <= 1 ? 1 : index / (total - 1);
  const base = ratio < 0.35 ? 0 : ratio < 0.65 ? 1 : ratio < 0.85 ? 2 : 3;
  const bump = crisisLevel >= 4 ? 1 : crisisLevel >= 2 ? 0 : -1;
  return WAR_ROOM_EVENT_SEVERITIES[Math.min(WAR_ROOM_EVENT_SEVERITIES.length - 1, Math.max(0, base + bump))];
}

function buildWarRoomEventStream(timeline, crisisLevel, crisisDef) {
  return timeline.map((entry, index) => ({
    timestamp: formatWarRoomTimestamp(parseTimeOffsetMinutes(entry.timeOffset)),
    severity: eventStreamSeverity(index, timeline.length, crisisLevel),
    title: `${humanizeToken(entry.phase)} — ${humanizeToken(entry.eventType)}`,
    detail: intensifyWarRoomText(entry.description, crisisDef),
    operatorAction:
      index === timeline.length - 1
        ? "Close rehearsal with lessons learned capture — session only, no persistence."
        : entry.advisoryNote,
  }));
}

function scaleWarRoomGuidanceList(items, crisisLevel, baseVisible = 2) {
  const list = items || [];
  const count = Math.min(list.length, baseVisible + (crisisLevel - 1));
  const selected = list.slice(0, count);
  if (crisisLevel >= 4 && list[count]) {
    selected.push(`At ${CRISIS_LEVEL_BY_NUM[crisisLevel]?.label || `level ${crisisLevel}`}: ${list[Math.min(list.length - 1, count)]}`);
  }
  return dedupeSimilarStrings(selected);
}

function buildWarRoomSummary(scenario, crisisDef, simulationContext) {
  return [
    `Crisis rehearsal completed for ${scenario.name} at ${crisisDef.label} with stable advisory escalation posture.`,
    `Synthetic context (${simulationContext.contextName}): ${simulationContext.regime} regime, ${simulationContext.outlook} outlook, confidence ${simulationContext.confidence}/100.`,
    `War room exercise remained simulation-only — observe, synthesize, advise, and escalate visibility only; no database writes, alerts, scheduling, or financial mutations.`,
  ].join(" ");
}

/**
 * Run a treasury crisis war room scenario (read-only, advisory, in-memory).
 * @param {{ scenarioId: string, crisisLevel?: number }} params
 * @returns {object | null}
 */
export function runTreasuryWarRoomScenario({ scenarioId, crisisLevel }) {
  const scenario = WAR_ROOM_BY_ID[String(scenarioId || "")];
  if (!scenario) return null;

  const effectiveLevel = normalizeWarRoomCrisisLevel(crisisLevel, scenario.defaultCrisisLevel);
  const crisisDef = CRISIS_LEVEL_BY_NUM[effectiveLevel] || TREASURY_CRISIS_LEVELS[2];
  const resolvedContext = resolveTrainingScenarioContext(scenario.baseScenarioRef);
  const simulationContext = extractWarRoomSimulationContext(resolvedContext);

  const timeline = buildWarRoomTimeline(scenario, effectiveLevel, crisisDef, simulationContext);
  const eventStream = buildWarRoomEventStream(timeline, effectiveLevel, crisisDef);

  return {
    scenarioId: scenario.id,
    scenarioName: scenario.name,
    crisisLevel: effectiveLevel,
    crisisLevelLabel: crisisDef.label,
    timeline,
    eventStream,
    operatorObjectives: scaleWarRoomGuidanceList(scenario.operatorObjectives, effectiveLevel, 2),
    recommendedResponses: scaleWarRoomGuidanceList(scenario.recommendedResponses, effectiveLevel, 2),
    escalationPoints: scaleWarRoomGuidanceList(scenario.escalationPoints, effectiveLevel, 1),
    lessonsLearned: [...(scenario.lessonsLearned || [])],
    simulationContext,
    summary: buildWarRoomSummary(scenario, crisisDef, simulationContext),
  };
}

function buildWarRoomFinalAssessment(warRoomResult) {
  const events = warRoomResult.eventStream?.length || 0;
  const objectives = warRoomResult.operatorObjectives?.length || 0;
  if (warRoomResult.crisisLevel >= 4) {
    return `Self-rehearsal assessment: operator navigated ${events} synthetic events at ${warRoomResult.crisisLevelLabel} with ${objectives} active objectives. Expectations met for severe-tier visibility synthesis and calm escalation framing — advisory rehearsal only, not a performance grade.`;
  }
  if (warRoomResult.crisisLevel >= 2) {
    return `Self-rehearsal assessment: operator completed ${events} chronological events with stable interpretive posture. Objectives aligned with ${warRoomResult.crisisLevelLabel} rehearsal band — continue periodic war room drills in paper mode.`;
  }
  return `Self-rehearsal assessment: minor-tier rehearsal completed with measured observational cadence. Suitable as baseline familiarity exercise before elevated crisis levels.`;
}

/**
 * Build final war room assessment report (paper mode, in-memory).
 * @param {ReturnType<typeof runTreasuryWarRoomScenario>} warRoomResult
 * @returns {object | null}
 */
export function buildTreasuryWarRoomReport(warRoomResult) {
  if (!warRoomResult?.scenarioId) return null;

  const generatedAt = new Date().toISOString();
  const reportTitle = `Treasury Crisis War Room Report — ${warRoomResult.scenarioName}`;
  const executiveSummary = [
    warRoomResult.summary,
    `Crisis level: ${warRoomResult.crisisLevelLabel}.`,
    `Simulation context: ${warRoomResult.simulationContext?.contextName || "n/a"} (${warRoomResult.simulationContext?.regime || "unknown"} regime, ${warRoomResult.simulationContext?.outlook || "unknown"} outlook, confidence ${warRoomResult.simulationContext?.confidence ?? 0}/100).`,
  ].join("\n\n");

  const timelineSummary = (warRoomResult.timeline || []).map((e) => `${e.timeOffset} [${humanizeToken(e.phase)}] ${e.description}`).join("\n");
  const eventSummary = (warRoomResult.eventStream || []).map((e) => `${e.timestamp} [${e.severity}] ${e.title}: ${e.detail}`).join("\n");
  const finalAssessment = buildWarRoomFinalAssessment(warRoomResult);

  const reportText = [
    reportTitle,
    `Generated: ${generatedAt}`,
    "Treasury Simulation Lab — Crisis War Room (paper mode, read-only, advisory)",
    "",
    formatReportSection("Executive Summary", executiveSummary),
    "",
    formatReportSection("Timeline Summary", timelineSummary || "No timeline events."),
    "",
    formatReportSection("Event Stream", eventSummary || "No events."),
    "",
    formatReportSection("Operator Objectives", (warRoomResult.operatorObjectives || []).map((o) => `• ${o}`).join("\n") || "None."),
    "",
    formatReportSection("Recommended Responses (advisory only)", (warRoomResult.recommendedResponses || []).map((r) => `• ${r}`).join("\n") || "None."),
    "",
    formatReportSection("Escalation Points (visibility only)", (warRoomResult.escalationPoints || []).map((p) => `• ${p}`).join("\n") || "None."),
    "",
    formatReportSection("Lessons Learned", (warRoomResult.lessonsLearned || []).map((l) => `• ${l}`).join("\n") || "None."),
    "",
    formatReportSection("Final Assessment (self-rehearsal)", finalAssessment),
    "",
    "---",
    "SIMULATION ONLY — no database writes, persistence, alerts, scheduling, execution, notifications, or financial mutations.",
  ].join("\n");

  return {
    reportTitle,
    scenarioName: warRoomResult.scenarioName,
    crisisLevel: warRoomResult.crisisLevel,
    generatedAt,
    executiveSummary,
    timelineSummary,
    eventSummary,
    operatorObjectives: warRoomResult.operatorObjectives,
    recommendedResponses: warRoomResult.recommendedResponses,
    escalationPoints: warRoomResult.escalationPoints,
    lessonsLearned: warRoomResult.lessonsLearned,
    finalAssessment,
    reportText,
  };
}

// ─── Phase 4P: Treasury Command Center (read-only aggregate dashboard) ───
// Deterministic paper-mode sampling — NOT the full regression suite on every refresh.
// Samples 3 scenarios + 2 failure modes for validation/simulation health (5 runs vs 17 full-suite runs).

const COMMAND_CENTER_SAMPLE_SCENARIO_IDS = [
  "stable_soft_launch",
  "moderate_withdrawal_spike",
  "confidence_collapse",
];

const COMMAND_CENTER_SAMPLE_FAILURE_IDS = ["contradiction_test", "confidence_breakdown"];

const COMMAND_CENTER_SAMPLE_AUDIT_SCENARIO_ID = "stable_soft_launch";

function gradeToMidScore(grade) {
  const map = { A: 95, B: 85, C: 75, D: 65, F: 45 };
  return map[grade] || 50;
}

function deriveHealthLabel(score, grade) {
  if (grade === "A" || score >= 90) return "Healthy";
  if (grade === "B" || score >= 80) return "Stable";
  if (grade === "C" || score >= 70) return "Adequate";
  return "Needs Review";
}

function deriveReadinessCompositeLabel(score, grade) {
  if (grade === "A" && score >= 88) return "Lab Ready";
  if ((grade === "A" || grade === "B") && score >= 80) return "Operational Ready";
  return "Review Recommended";
}

function averageRounded(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function buildCommandCenterSampleValidation() {
  const scenarioSamples = COMMAND_CENTER_SAMPLE_SCENARIO_IDS.map((scenarioId) => {
    const result = runTreasurySimulation(scenarioId);
    const score = scoreTreasurySimulationResult(result);
    return { scenarioId, scenarioName: result?.scenario?.name || scenarioId, score };
  });

  const failureSamples = COMMAND_CENTER_SAMPLE_FAILURE_IDS.map((modeId) => {
    const result = runTreasuryFailureSimulation(modeId);
    const score = scoreTreasurySimulationResult(result);
    return { modeId, modeName: result?.mode?.name || modeId, score };
  });

  const allScores = [...scenarioSamples, ...failureSamples].map((e) => e.score);
  const validationScores = allScores.map((s) => s.validationScore);
  const safetyScores = allScores.map((s) => s.safetyScore);
  const avgValidation = averageRounded(validationScores);
  const avgSafety = averageRounded(safetyScores);

  let grade = deriveGrade(avgValidation);
  if (avgSafety < 75) {
    grade = downgradeGrade(grade, 1);
  }

  const weakest = [...scenarioSamples, ...failureSamples]
    .map((entry) => ({
      name: entry.scenarioName || entry.modeName,
      validationScore: entry.score.validationScore,
      validationGrade: entry.score.validationGrade,
    }))
    .sort((a, b) => a.validationScore - b.validationScore)[0];

  return {
    avgValidation,
    avgSafety,
    grade,
    scenarioSamples,
    failureSamples,
    weakest,
    sampleCount: allScores.length,
  };
}

function buildCommandCenterCoverageReadinessScore() {
  const scenarioCoverage = Math.min(100, Math.round((TREASURY_SIMULATION_SCENARIOS.length / 10) * 100));
  const failureCoverage = Math.min(100, Math.round((TREASURY_FAILURE_SIMULATION_MODES.length / 7) * 100));
  const presetCoverage = Math.min(100, Math.round((TREASURY_SCENARIO_LIBRARY.length / 10) * 100));
  const customBuilderReady = DEFAULT_CUSTOM_SCENARIO_INPUTS ? 100 : 0;
  return averageRounded([scenarioCoverage, failureCoverage, presetCoverage, customBuilderReady]);
}

function buildCommandCenterTrainingReadiness() {
  const moduleCount = TREASURY_TRAINING_MODULES.length;
  const sampleModule = TREASURY_TRAINING_MODULES[0];
  const exercise = sampleModule ? runTreasuryTrainingExercise(sampleModule.id) : null;
  const coverageScore = Math.min(100, moduleCount * 12);
  const exerciseReady = exercise ? 100 : 60;
  const score = averageRounded([coverageScore, exerciseReady]);
  const grade = deriveGrade(score);
  return {
    grade,
    score,
    label: deriveHealthLabel(score, grade),
    modulesAvailable: moduleCount,
    sampleModuleTitle: sampleModule?.title || null,
    exerciseResolved: Boolean(exercise?.scenario),
    summary: `${moduleCount} training modules available with self-guided paper-mode exercises. Sample module "${sampleModule?.title || "n/a"}" ${exercise ? "resolves synthetic context deterministically" : "awaiting resolution"} — no answer storage or grading persistence.`,
  };
}

function buildCommandCenterCertificationReadiness() {
  const exams = TREASURY_CERTIFICATION_EXAMS;
  const levels = [...new Set(exams.map((e) => e.level))];
  const avgPassing = averageRounded(exams.map((e) => e.passingScore));
  const coverageScore = Math.min(100, exams.length * 18);
  const score = averageRounded([coverageScore, avgPassing]);
  const grade = deriveGrade(score);
  return {
    grade,
    score,
    label: deriveHealthLabel(score, grade),
    examsAvailable: exams.length,
    levels,
    summary: `${exams.length} certification exams span ${levels.join(", ")} tracks. Paper-mode self-assessment only — not live credentialing.`,
  };
}

function buildCommandCenterWarRoomReadiness() {
  const scenariosAvailable = TREASURY_WAR_ROOM_SCENARIOS.length;
  const crisisLevelsAvailable = TREASURY_CRISIS_LEVELS.map((c) => c.label);
  const sampleScenarioId = TREASURY_WAR_ROOM_SCENARIOS[0]?.id;
  let sampleScore = Math.min(100, scenariosAvailable * 18 + TREASURY_CRISIS_LEVELS.length * 4);

  if (sampleScenarioId) {
    const rehearsal = runTreasuryWarRoomScenario({ scenarioId: sampleScenarioId, crisisLevel: 3 });
    if (rehearsal?.simulationContext?.confidence != null) {
      sampleScore = averageRounded([
        sampleScore,
        Math.min(100, rehearsal.simulationContext.confidence + 15),
      ]);
    }
  }

  const grade = deriveGrade(sampleScore);
  return {
    grade,
    score: sampleScore,
    label: deriveHealthLabel(sampleScore, grade),
    scenariosAvailable,
    crisisLevelsAvailable,
    pending: false,
    summary: `${scenariosAvailable} war room scenarios across ${TREASURY_CRISIS_LEVELS.length} crisis levels — paper-mode advisory drills only. Sample rehearsal uses "${sampleScenarioId || "n/a"}" at level 3.`,
  };
}

function buildCommandCenterRecommendations({
  validation,
  simulationHealthScore,
  auditGrade,
  training,
  certification,
  warRoom,
  readinessScore,
}) {
  const recs = [];

  if (validation.weakest && validation.weakest.validationScore < 80) {
    recs.push(
      `Review sampled validation in "${validation.weakest.name}" (score ${validation.weakest.validationScore}/100) — reconcile regime, outlook, and trace alignment in paper mode.`,
    );
  }

  if (validation.avgSafety < 80) {
    recs.push(
      "Audit sampled advisory copy for execution or mutation language — treasury paper mode must remain read-only across scenarios and failure tests.",
    );
  }

  if (simulationHealthScore < 85) {
    recs.push(
      "Expand scenario library and preset coverage drills — custom builder and curated presets strengthen institutional interpretive baselines.",
    );
  }

  if (auditGrade === "D" || auditGrade === "F") {
    recs.push(
      "Schedule a scoped scenario audit follow-up before institutional sharing — sample audit grade indicates elevated interpretive burden.",
    );
  }

  if (training.score < 80) {
    recs.push(
      `Complete training modules across certification tracks (${training.modulesAvailable} modules available) to reinforce paper-mode interpretation discipline.`,
    );
  }

  if (certification.examsAvailable < 5) {
    recs.push("Review certification exam coverage — ensure all operator levels have accessible self-assessment paths.");
  }

  if (warRoom.pending) {
    recs.push(
      "War room scenarios (Phase 4O) pending — continue regression and audit drills until crisis tabletop exercises are available.",
    );
  }

  if (readinessScore < 80) {
    recs.push(
      "Review operations manual sections and standard procedures — manual coverage supports calm advisory escalation paths.",
    );
  }

  if (recs.length === 0) {
    recs.push(
      "Command center posture is stable — continue periodic paper-mode validation, audit pack generation, and training drills.",
    );
    recs.push(
      "Maintain treasury simulation lab as read-only — no production treasury mutations implied by command center aggregates.",
    );
  }

  return dedupeSimilarStrings(recs).slice(0, 5);
}

/**
 * Build the Treasury Command Center aggregate dashboard (read-only, advisory, in-memory).
 * Uses deterministic sampling (3 scenarios + 2 failure modes) rather than the full regression suite.
 * @returns {object}
 */
export function buildTreasuryCommandCenter() {
  const generatedAt = new Date().toISOString();
  const validation = buildCommandCenterSampleValidation();

  const simulationHealthScore = averageRounded([
    validation.avgValidation,
    validation.avgSafety,
    buildCommandCenterCoverageReadinessScore(),
  ]);
  const simulationGrade = deriveGrade(simulationHealthScore);

  const sampleAudit = buildTreasuryAuditPack({
    auditType: "scenario-audit",
    scope: { scenarioId: COMMAND_CENTER_SAMPLE_AUDIT_SCENARIO_ID },
  });
  const lastAuditGrade = sampleAudit?.auditGrade || "C";
  const auditScore = gradeToMidScore(lastAuditGrade);
  const auditGrade = lastAuditGrade;
  const auditLabel = deriveHealthLabel(auditScore, auditGrade);

  const training = buildCommandCenterTrainingReadiness();
  const certification = buildCommandCenterCertificationReadiness();
  const warRoom = buildCommandCenterWarRoomReadiness();

  const manualSections = TREASURY_MANUAL_SECTIONS.length;
  const procedures = TREASURY_PROCEDURES.length;
  const manualCoverageScore = Math.min(
    100,
    averageRounded([
      Math.min(100, manualSections * 4),
      Math.min(100, procedures * 12),
    ]),
  );
  const readinessScore = averageRounded([
    simulationHealthScore,
    auditScore,
    training.score,
    certification.score,
    warRoom.pending ? 70 : warRoom.score,
    manualCoverageScore,
  ]);
  const overallGrade = deriveGrade(readinessScore);
  const overallLabel = deriveReadinessCompositeLabel(readinessScore, overallGrade);

  const coverageMetrics = {
    totalScenarios: TREASURY_SIMULATION_SCENARIOS.length,
    totalFailureModes: TREASURY_FAILURE_SIMULATION_MODES.length,
    totalPresets: TREASURY_SCENARIO_LIBRARY.length,
    totalTrainingModules: TREASURY_TRAINING_MODULES.length,
    totalCertificationExams: TREASURY_CERTIFICATION_EXAMS.length,
    totalAuditTypes: TREASURY_AUDIT_TYPES.length,
    totalWarRoomScenarios: TREASURY_WAR_ROOM_SCENARIOS.length,
    totalManualSections: manualSections,
    totalProcedures: procedures,
  };

  const validationOverview = {
    sampleMethod: "3 scenarios + 2 failure modes (deterministic)",
    averageValidationScore: validation.avgValidation,
    averageSafetyScore: validation.avgSafety,
    validationGrade: validation.grade,
    samplesRun: validation.sampleCount,
    weakestSample: validation.weakest,
    scenarioIds: COMMAND_CENTER_SAMPLE_SCENARIO_IDS,
    failureModeIds: COMMAND_CENTER_SAMPLE_FAILURE_IDS,
    summary: `Sampled ${validation.sampleCount} synthetic runs (${COMMAND_CENTER_SAMPLE_SCENARIO_IDS.length} scenarios, ${COMMAND_CENTER_SAMPLE_FAILURE_IDS.length} failure modes) with average validation ${validation.avgValidation}/100 and safety ${validation.avgSafety}/100 (grade ${validation.grade}). Full regression suite available on demand — not executed on every command center refresh.`,
  };

  const simulationHealth = {
    scenariosAvailable: coverageMetrics.totalScenarios,
    failureModesAvailable: coverageMetrics.totalFailureModes,
    presetsAvailable: coverageMetrics.totalPresets,
    customBuilderStatus: "available",
    sampledValidationGrade: validation.grade,
    summary: `${coverageMetrics.totalScenarios} scenarios, ${coverageMetrics.totalFailureModes} failure modes, and ${coverageMetrics.totalPresets} curated presets with custom builder ${DEFAULT_CUSTOM_SCENARIO_INPUTS ? "enabled" : "unavailable"}. Sampled health grade ${simulationGrade} (${simulationHealthScore}/100).`,
  };

  const auditReadiness = {
    auditTypesAvailable: coverageMetrics.totalAuditTypes,
    sampleAuditType: "scenario-audit",
    sampleAuditScenarioId: COMMAND_CENTER_SAMPLE_AUDIT_SCENARIO_ID,
    lastAuditGrade,
    summary: `${coverageMetrics.totalAuditTypes} audit types configured. Sample scenario audit for "${COMMAND_CENTER_SAMPLE_AUDIT_SCENARIO_ID}" returned grade ${lastAuditGrade} — advisory-only, in-memory, no persistence.`,
  };

  const trainingReadiness = {
    modulesAvailable: training.modulesAvailable,
    sampleModuleTitle: training.sampleModuleTitle,
    exerciseResolved: training.exerciseResolved,
    summary: training.summary,
  };

  const certificationReadiness = {
    examsAvailable: certification.examsAvailable,
    levels: certification.levels,
    summary: certification.summary,
  };

  const warRoomReadiness = {
    scenariosAvailable: warRoom.scenariosAvailable,
    crisisLevelsAvailable: warRoom.crisisLevelsAvailable,
    status: warRoom.pending ? "pending" : "available",
    summary: warRoom.summary,
  };

  const manualCoverage = {
    manualSections,
    procedures,
    summary: `${manualSections} manual sections and ${procedures} standard procedures available for paper-mode operator reference — no production operations manual sync.`,
  };

  const executiveSummary = [
    "Simulation Lab operating with stable advisory coverage across validation, training, and audit readiness.",
    `Aggregate readiness grade ${overallGrade} (${readinessScore}/100) — ${overallLabel}.`,
    validation.avgValidation >= 85
      ? "Sampled validation scores indicate strong institutional alignment under synthetic stress."
      : "Sampled validation scores suggest targeted paper-mode review before mirroring advisory posture.",
    warRoom.pending
      ? "War room tabletop exercises are pending (Phase 4O); regression, audit, and training paths remain fully available."
      : `War room coverage includes ${warRoom.scenariosAvailable} crisis scenarios.`,
    "Command center is read-only — no database writes, persistence, alerts, or financial mutations.",
  ].join(" ");

  const summary =
    "Treasury Command Center aggregate reflects paper-mode lab health across simulation, audit, training, certification, and manual coverage. All metrics are advisory-only and recomputed in memory on each refresh.";

  const recommendations = buildCommandCenterRecommendations({
    validation,
    simulationHealthScore,
    auditGrade,
    training,
    certification,
    warRoom,
    readinessScore,
  });

  return {
    generatedAt,
    simulationStatus: {
      grade: simulationGrade,
      score: simulationHealthScore,
      label: deriveHealthLabel(simulationHealthScore, simulationGrade),
      scenariosAvailable: coverageMetrics.totalScenarios,
      failureModesAvailable: coverageMetrics.totalFailureModes,
      presetsAvailable: coverageMetrics.totalPresets,
      summary: simulationHealth.summary,
    },
    auditStatus: {
      grade: auditGrade,
      score: auditScore,
      label: auditLabel,
      auditTypesAvailable: coverageMetrics.totalAuditTypes,
      lastAuditGrade,
      summary: auditReadiness.summary,
    },
    trainingStatus: {
      grade: training.grade,
      score: training.score,
      label: training.label,
      modulesAvailable: training.modulesAvailable,
      summary: training.summary,
    },
    certificationStatus: {
      grade: certification.grade,
      score: certification.score,
      label: certification.label,
      examsAvailable: certification.examsAvailable,
      levels: certification.levels,
      summary: certification.summary,
    },
    warRoomStatus: {
      grade: warRoom.grade,
      score: warRoom.score,
      label: warRoom.label,
      scenariosAvailable: warRoom.scenariosAvailable,
      crisisLevelsAvailable: warRoom.crisisLevelsAvailable,
      summary: warRoom.summary,
    },
    readinessStatus: {
      grade: overallGrade,
      score: readinessScore,
      overallGrade,
      overallScore: readinessScore,
      label: overallLabel,
      manualSections,
      procedures,
      summary: `Composite readiness ${overallLabel} (grade ${overallGrade}, ${readinessScore}/100) across ${manualSections} manual sections and ${procedures} procedures.`,
    },
    sections: {
      validationOverview,
      simulationHealth,
      auditReadiness,
      trainingReadiness,
      certificationReadiness,
      warRoomReadiness,
      manualCoverage,
      executiveSummary,
    },
    coverageMetrics,
    summary,
    recommendations,
  };
}
