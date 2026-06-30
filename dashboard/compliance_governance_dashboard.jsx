"use client";

import { useMemo } from "react";

/**
 * TLP-005 Compliance & Governance Dashboard
 * Read-only aggregate view — does not mutate production data.
 */

const DEFAULT_STATS = {
  kyc_queue_pending: 0,
  aml_screening_pending: 0,
  aml_cases_active: 0,
  aml_cases_escalated: 0,
  restricted_accounts: 0,
  frozen_accounts: 0,
  high_risk_users: 0,
  open_incidents: 0,
};

function StatCard({ label, value, tone = "default" }) {
  const tones = {
    default: { bg: "#f8fafc", border: "#e2e8f0", fg: "#0f172a" },
    warn: { bg: "#fffbeb", border: "#fde68a", fg: "#92400e" },
    danger: { bg: "#fef2f2", border: "#fecaca", fg: "#991b1b" },
    ok: { bg: "#ecfdf5", border: "#a7f3d0", fg: "#047857" },
  };
  const pal = tones[tone] || tones.default;
  return (
    <div
      style={{
        background: pal.bg,
        border: `1px solid ${pal.border}`,
        borderRadius: "12px",
        padding: "1rem 1.1rem",
        minWidth: "140px",
        flex: "1 1 140px",
      }}
    >
      <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.75rem", fontWeight: 800, color: pal.fg, marginTop: "0.35rem" }}>
        {value == null ? "—" : value}
      </div>
    </div>
  );
}

export default function ComplianceGovernanceDashboard({ stats = DEFAULT_STATS, readiness = null }) {
  const s = { ...DEFAULT_STATS, ...stats };

  const complianceScore = readiness?.compliance_readiness_score ?? null;
  const governanceScore = readiness?.governance_readiness_score ?? null;
  const classification = readiness?.classification ?? null;

  const statCards = useMemo(
    () => [
      { label: "KYC queue", value: s.kyc_queue_pending, tone: s.kyc_queue_pending > 0 ? "warn" : "ok" },
      { label: "Screening pending", value: s.aml_screening_pending, tone: s.aml_screening_pending > 0 ? "warn" : "ok" },
      { label: "Active AML cases", value: s.aml_cases_active, tone: s.aml_cases_active > 5 ? "warn" : "default" },
      { label: "Escalated AML", value: s.aml_cases_escalated, tone: s.aml_cases_escalated > 0 ? "danger" : "ok" },
      { label: "Restricted", value: s.restricted_accounts, tone: "warn" },
      { label: "Frozen", value: s.frozen_accounts, tone: s.frozen_accounts > 0 ? "danger" : "ok" },
      { label: "High-risk users", value: s.high_risk_users, tone: "warn" },
      { label: "Open incidents", value: s.open_incidents, tone: s.open_incidents > 0 ? "danger" : "ok" },
    ],
    [s],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {classification ? (
        <div
          style={{
            borderRadius: "12px",
            border: "1px solid #bfdbfe",
            background: "#eff6ff",
            padding: "1rem 1.15rem",
          }}
        >
          <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#1d4ed8" }}>
            TLP-005 readiness
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", marginTop: "0.5rem", alignItems: "baseline" }}>
            <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>{classification}</span>
            {complianceScore != null ? (
              <span style={{ fontSize: "0.9rem", color: "#475569" }}>
                Compliance: <strong>{complianceScore}%</strong>
              </span>
            ) : null}
            {governanceScore != null ? (
              <span style={{ fontSize: "0.9rem", color: "#475569" }}>
                Governance: <strong>{governanceScore}%</strong>
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>{statCards.map((c) => <StatCard key={c.label} {...c} />)}</div>

      <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b" }}>
        Read-only dashboard. Operator actions require admin authorization via Compliance API and are audit-logged.
      </p>
    </div>
  );
}
