"use client";

import { useMemo } from "react";

/**
 * TLP-001 Launch Readiness Dashboard
 * Standalone React component — import into any page or Storybook.
 * Data sourced from data/launch/launch_readiness.json (embedded snapshot).
 */

const AUDIT_DATA = {
  audit_id: "TLP-001",
  generated_at: "2026-06-28T00:00:00.000Z",
  launch_stage: "Internal Alpha",
  overall_readiness_score: 54,
  modules: [
    { id: "authentication", name: "Authentication", score: 75, classification: "READY_WITH_MINOR_WORK" },
    { id: "authorization", name: "Authorization", score: 45, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "user_onboarding", name: "User Onboarding", score: 62, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "wallet", name: "Wallet", score: 65, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "ledger", name: "Ledger", score: 25, classification: "PROTOTYPE" },
    { id: "transactions", name: "Transactions", score: 72, classification: "READY_WITH_MINOR_WORK" },
    { id: "funding", name: "Funding", score: 50, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "withdrawals", name: "Withdrawals", score: 78, classification: "READY_WITH_MINOR_WORK" },
    { id: "merchant_platform", name: "Merchant Platform", score: 10, classification: "SIMULATION_ONLY" },
    { id: "qr_payments", name: "QR Payments", score: 0, classification: "NOT_STARTED" },
    { id: "payment_links", name: "Payment Links", score: 0, classification: "NOT_STARTED" },
    { id: "notifications", name: "Notifications", score: 58, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "security", name: "Security", score: 68, classification: "READY_WITH_MINOR_WORK" },
    { id: "fraud_controls", name: "Fraud Controls", score: 55, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "kyc", name: "KYC", score: 58, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "aml_controls", name: "AML Controls", score: 22, classification: "PROTOTYPE" },
    { id: "treasury", name: "Treasury", score: 62, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "admin_console", name: "Admin Console", score: 82, classification: "READY_WITH_MINOR_WORK" },
    { id: "reporting", name: "Reporting", score: 75, classification: "READY_WITH_MINOR_WORK" },
    { id: "developer_apis", name: "Developer APIs", score: 48, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "oauth", name: "OAuth", score: 55, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "sdk", name: "SDK Readiness", score: 32, classification: "PROTOTYPE" },
    { id: "webhooks", name: "Webhooks", score: 38, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "mobile_responsiveness", name: "Mobile Responsiveness", score: 70, classification: "READY_WITH_MINOR_WORK" },
    { id: "pwa", name: "PWA", score: 68, classification: "READY_WITH_MINOR_WORK" },
    { id: "environment_configuration", name: "Environment Config", score: 48, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "secrets_management", name: "Secrets Management", score: 70, classification: "READY_WITH_MINOR_WORK" },
    { id: "error_handling", name: "Error Handling", score: 58, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "logging", name: "Logging", score: 60, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "monitoring", name: "Monitoring", score: 50, classification: "PARTIALLY_IMPLEMENTED" },
    { id: "production_configuration", name: "Production Config", score: 45, classification: "PARTIALLY_IMPLEMENTED" },
  ],
  top_blockers: [
    { id: "BLK-001", title: "fund_wallet RPC missing from migrations", severity: "CRITICAL", module: "funding" },
    { id: "BLK-002", title: "balance vs wallet_balance column split", severity: "CRITICAL", module: "wallet" },
    { id: "BLK-003", title: "KYC enforcement advisory-only", severity: "CRITICAL", module: "kyc" },
    { id: "BLK-004", title: "No sanctions/PEP screening", severity: "CRITICAL", module: "aml_controls" },
    { id: "BLK-005", title: "fraud_logs RLS wide open", severity: "CRITICAL", module: "security" },
    { id: "BLK-006", title: "Single hardcoded admin RBAC", severity: "CRITICAL", module: "authorization" },
    { id: "BLK-007", title: "Legal documents are drafts", severity: "CRITICAL", module: "production_configuration" },
    { id: "BLK-008", title: "Send money bypasses server gates", severity: "CRITICAL", module: "fraud_controls" },
    { id: "BLK-009", title: "PayPal defaults to sandbox", severity: "HIGH", module: "environment_configuration" },
    { id: "BLK-010", title: "No .env.example", severity: "HIGH", module: "environment_configuration" },
  ],
};

const CLASSIFICATION_COLORS = {
  PRODUCTION_READY: { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" },
  READY_WITH_MINOR_WORK: { bg: "#eff6ff", fg: "#1d4ed8", border: "#bfdbfe" },
  PARTIALLY_IMPLEMENTED: { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" },
  PROTOTYPE: { bg: "#fef3c7", fg: "#92400e", border: "#fcd34d" },
  SIMULATION_ONLY: { bg: "#f3e8ff", fg: "#7c3aed", border: "#ddd6fe" },
  NOT_STARTED: { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" },
};

const SEVERITY_COLORS = {
  CRITICAL: { bg: "#fef2f2", fg: "#b91c1c" },
  HIGH: { bg: "#fff7ed", fg: "#c2410c" },
  MEDIUM: { bg: "#fffbeb", fg: "#b45309" },
  LOW: { bg: "#f8fafc", fg: "#64748b" },
};

function scoreBar(score, width = 20) {
  const filled = Math.round((score / 100) * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

function ScoreBarVisual({ score, label }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.35rem" }}>
      <span style={{ width: "180px", fontSize: "0.82rem", fontWeight: 600, color: "#334155", flexShrink: 0 }}>
        {label}
      </span>
      <div style={{ flex: 1, height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: pct >= 75 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444",
            borderRadius: "4px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <span style={{ width: "36px", fontSize: "0.78rem", fontWeight: 700, color: "#64748b", textAlign: "right" }}>
        {pct}%
      </span>
    </div>
  );
}

function ClassificationPill({ classification }) {
  const colors = CLASSIFICATION_COLORS[classification] || CLASSIFICATION_COLORS.PARTIALLY_IMPLEMENTED;
  const label = classification.replace(/_/g, " ");
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.15rem 0.5rem",
        fontSize: "0.68rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        borderRadius: "6px",
        background: colors.bg,
        color: colors.fg,
        border: `1px solid ${colors.border}`,
      }}
    >
      {label}
    </span>
  );
}

export default function LaunchReadinessDashboard({ data = AUDIT_DATA }) {
  const sortedModules = useMemo(
    () => [...data.modules].sort((a, b) => b.score - a.score),
    [data.modules],
  );

  const criticalCount = data.top_blockers.filter((b) => b.severity === "CRITICAL").length;

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        maxWidth: "960px",
        margin: "0 auto",
        padding: "2rem 1.25rem",
        color: "#0f172a",
      }}
    >
      <header style={{ marginBottom: "2rem" }}>
        <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
          {data.audit_id} — Production Readiness Audit
        </p>
        <h1 style={{ margin: "0.35rem 0 0", fontSize: "1.75rem", fontWeight: 800 }}>Tropicash Launch Readiness</h1>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.9rem", color: "#64748b" }}>
          Generated {new Date(data.generated_at).toLocaleDateString(undefined, { dateStyle: "long" })}
        </p>
      </header>

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "1.5rem",
          marginBottom: "1.5rem",
          boxShadow: "0 4px 16px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center" }}>
          <div>
            <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
              Launch Stage
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "1.25rem", fontWeight: 800, color: "#0ea5e9" }}>
              {data.launch_stage}
            </p>
          </div>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
              Overall Readiness
            </p>
            <p style={{ margin: "0.25rem 0 0", fontFamily: "monospace", fontSize: "0.85rem", color: "#334155" }}>
              {scoreBar(data.overall_readiness_score)} {data.overall_readiness_score}%
            </p>
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
              Critical Blockers
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "1.25rem", fontWeight: 800, color: "#b91c1c" }}>
              {criticalCount}
            </p>
          </div>
        </div>
      </section>

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 700 }}>Module Readiness Scores</h2>
        {sortedModules.map((mod) => (
          <ScoreBarVisual key={mod.id} label={mod.name} score={mod.score} />
        ))}
      </section>

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "1.5rem",
          marginBottom: "1.5rem",
        }}
      >
        <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 700 }}>Module Classifications</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "0.65rem" }}>
          {data.modules.map((mod) => (
            <div
              key={mod.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.5rem 0.75rem",
                background: "#f8fafc",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
              }}
            >
              <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>{mod.name}</span>
              <ClassificationPill classification={mod.classification} />
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "14px",
          padding: "1.5rem",
        }}
      >
        <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", fontWeight: 700 }}>Top 10 Launch Blockers</h2>
        <ol style={{ margin: 0, paddingLeft: "1.25rem" }}>
          {data.top_blockers.map((blocker) => {
            const sev = SEVERITY_COLORS[blocker.severity] || SEVERITY_COLORS.MEDIUM;
            return (
              <li key={blocker.id} style={{ marginBottom: "0.65rem", fontSize: "0.88rem" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.1rem 0.4rem",
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    borderRadius: "4px",
                    background: sev.bg,
                    color: sev.fg,
                    marginRight: "0.5rem",
                    verticalAlign: "middle",
                  }}
                >
                  {blocker.severity}
                </span>
                <strong>{blocker.id}</strong> — {blocker.title}
                <span style={{ color: "#64748b", fontSize: "0.78rem" }}> ({blocker.module})</span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

export { AUDIT_DATA, scoreBar, ClassificationPill, ScoreBarVisual };
