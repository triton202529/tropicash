"use client";

import { useMemo } from "react";

/**
 * TLP-006 Production Operations Dashboard
 * Read-only operational readiness snapshot.
 */

const DEFAULT = {
  overall_score: 0,
  classification: "NOT READY",
  scores: {},
  remaining_blockers: [],
  static_tests: { passed: 0, failed: 0, total: 0 },
  live_staging_executed: false,
};

function ScoreBar({ score }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const filled = Math.round(s / 5);
  return (
    <span style={{ fontFamily: "monospace", fontSize: "0.75rem", color: "#475569" }}>
      {"█".repeat(filled)}
      {"░".repeat(20 - filled)} {s}%
    </span>
  );
}

function toneForClassification(c) {
  if (c === "READY FOR PRIVATE ALPHA") return { bg: "#ecfdf5", border: "#a7f3d0", fg: "#047857" };
  if (c === "READY FOR LIVE CUTOVER") return { bg: "#eff6ff", border: "#bfdbfe", fg: "#1d4ed8" };
  return { bg: "#fef2f2", border: "#fecaca", fg: "#991b1b" };
}

export default function ProductionOperationsDashboard({ data = DEFAULT }) {
  const d = { ...DEFAULT, ...data };
  const pal = toneForClassification(d.classification);

  const scoreEntries = useMemo(
    () =>
      Object.entries(d.scores || {}).map(([key, val]) => ({
        key: key.replace(/_/g, " "),
        val,
      })),
    [d.scores],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ borderRadius: "12px", border: `1px solid ${pal.border}`, background: pal.bg, padding: "1rem 1.15rem" }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: pal.fg }}>TLP-006 certification</div>
        <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0f172a", marginTop: "0.35rem" }}>{d.classification}</div>
        <div style={{ marginTop: "0.35rem", fontSize: "0.9rem", color: "#475569" }}>
          Overall score: <strong>{d.overall_score}%</strong> · Static tests: {d.static_tests?.passed}/{d.static_tests?.total} passed
        </div>
        {!d.live_staging_executed ? (
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "#92400e" }}>
            Live staging E2E pending — see STAGING_EXECUTION_REPORT.md
          </p>
        ) : null}
      </div>

      <div style={{ display: "grid", gap: "0.5rem" }}>
        {scoreEntries.map(({ key, val }) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "#334155", textTransform: "capitalize" }}>{key}</span>
            <ScoreBar score={val} />
          </div>
        ))}
      </div>

      {(d.remaining_blockers || []).length > 0 ? (
        <div style={{ borderRadius: "10px", border: "1px solid #fde68a", background: "#fffbeb", padding: "0.85rem 1rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#92400e", marginBottom: "0.35rem" }}>
            Remaining blockers
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", color: "#78350f" }}>
            {d.remaining_blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
