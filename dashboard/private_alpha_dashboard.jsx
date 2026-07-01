"use client";

import { useMemo } from "react";

/**
 * TLP-007 Private Alpha Executive Dashboard
 * Read-only aggregate view — live probes + static program artifacts.
 */

function StatCard({ label, value, tone = "default", sub }) {
  const tones = {
    default: { bg: "#f8fafc", border: "#e2e8f0", fg: "#0f172a" },
    warn: { bg: "#fffbeb", border: "#fde68a", fg: "#92400e" },
    danger: { bg: "#fef2f2", border: "#fecaca", fg: "#991b1b" },
    ok: { bg: "#ecfdf5", border: "#a7f3d0", fg: "#047857" },
    info: { bg: "#eff6ff", border: "#bfdbfe", fg: "#1d4ed8" },
  };
  const pal = tones[tone] || tones.default;
  return (
    <div
      style={{
        background: pal.bg,
        border: `1px solid ${pal.border}`,
        borderRadius: "12px",
        padding: "1rem 1.1rem",
        minWidth: "130px",
        flex: "1 1 130px",
      }}
    >
      <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 800, color: pal.fg, marginTop: "0.3rem" }}>
        {value == null || value === "" ? "—" : value}
      </div>
      {sub ? <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.25rem" }}>{sub}</div> : null}
    </div>
  );
}

function Section({ title, children, tone = "default" }) {
  const borders = { default: "#e2e8f0", warn: "#fde68a", danger: "#fecaca", ok: "#a7f3d0" };
  return (
    <section
      style={{
        border: `1px solid ${borders[tone] || borders.default}`,
        borderRadius: "12px",
        padding: "1rem 1.15rem",
        background: "#fff",
      }}
    >
      <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>{title}</h2>
      {children}
    </section>
  );
}

function toneForClassification(c) {
  if (c === "READY FOR PUBLIC BETA") return "ok";
  if (c === "NOT READY") return "danger";
  return "warn";
}

function fmtUsd(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `$${Number(n).toFixed(2)}`;
}

export default function PrivateAlphaDashboard({
  dailyHealth = null,
  metrics = null,
  reconciliation = null,
  incidents = null,
  exitEval = null,
  launchResults = null,
}) {
  const certPass = dailyHealth?.daily_certification_pass;
  const classification = exitEval?.classification || launchResults?.classification || "EXTEND PRIVATE ALPHA";
  const palTone = toneForClassification(classification);

  const checks = dailyHealth?.checks || [];
  const failedChecks = checks.filter((c) => !c.pass);

  const openIncidents = useMemo(() => {
    const rows = incidents?.incidents || [];
    return rows.filter((i) => !["resolved", "closed"].includes(String(i.status || "").toLowerCase()));
  }, [incidents]);

  const criticalOpen = openIncidents.filter((i) => String(i.severity).toLowerCase() === "critical");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
      <div
        style={{
          borderRadius: "12px",
          border: `1px solid ${palTone === "ok" ? "#a7f3d0" : palTone === "danger" ? "#fecaca" : "#fde68a"}`,
          background: palTone === "ok" ? "#ecfdf5" : palTone === "danger" ? "#fef2f2" : "#fffbeb",
          padding: "1rem 1.15rem",
        }}
      >
        <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
          TLP-007 · Overall Alpha Health
        </div>
        <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f172a", marginTop: "0.35rem" }}>{classification}</div>
        <div style={{ fontSize: "0.85rem", color: "#475569", marginTop: "0.35rem" }}>
          Program status: {launchResults?.program_status || "active"} · PayPal: {metrics?.treasury?.paypal_mode || dailyHealth?.paypal_mode || "sandbox"}
        </div>
        {exitEval?.recommendation ? (
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#334155" }}>{exitEval.recommendation}</p>
        ) : null}
      </div>

      <Section title="Daily Certification" tone={certPass === true ? "ok" : certPass === false ? "danger" : "default"}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", marginBottom: "0.75rem" }}>
          <StatCard
            label="Certification"
            value={certPass == null ? "Pending" : certPass ? "PASS" : "FAIL"}
            tone={certPass === true ? "ok" : certPass === false ? "danger" : "default"}
            sub={
              dailyHealth
                ? `${dailyHealth.checks_passed}/${dailyHealth.checks_total} checks`
                : "Run daily checklist"
            }
          />
          <StatCard label="Failed checks" value={failedChecks.length} tone={failedChecks.length ? "danger" : "ok"} />
          <StatCard
            label="Recon critical"
            value={dailyHealth?.summary?.reconciliation_critical ?? reconciliation?.withdrawal_reconciliation?.critical_count}
            tone={(dailyHealth?.summary?.reconciliation_critical ?? 0) > 0 ? "danger" : "ok"}
          />
          <StatCard
            label="Open critical incidents"
            value={criticalOpen.length}
            tone={criticalOpen.length ? "danger" : "ok"}
          />
        </div>
        {checks.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.78rem", color: "#475569" }}>
            {checks.map((c) => (
              <li key={c.id} style={{ marginBottom: "0.2rem", color: c.pass ? "#047857" : "#991b1b" }}>
                {c.pass ? "✓" : "✗"} {c.label}
                {c.detail ? ` — ${c.detail}` : ""}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Load dashboard to run live health probes.</p>
        )}
      </Section>

      <Section title="System Health">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
          <StatCard label="Transactions today" value={metrics?.daily?.transaction_count ?? dailyHealth?.summary?.transactions_today} />
          <StatCard
            label="Funding failures (24h)"
            value={dailyHealth?.summary?.funding_failed_24h}
            tone={(dailyHealth?.summary?.funding_failed_24h ?? 0) > 0 ? "warn" : "ok"}
          />
          <StatCard label="Open fraud logs" value={metrics?.support?.open_fraud_logs} />
        </div>
      </Section>

      <Section title="Financial Health">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
          <StatCard label="Volume today" value={fmtUsd(metrics?.daily?.transaction_volume_usd)} />
          <StatCard label="Funded today" value={fmtUsd(metrics?.daily?.funded_usd)} tone="info" />
          <StatCard label="Sent today" value={fmtUsd(metrics?.daily?.sent_usd)} />
          <StatCard label="Withdrawn today" value={fmtUsd(metrics?.daily?.withdrawn_usd)} />
          <StatCard
            label="Wallet sum"
            value={fmtUsd(reconciliation?.wallet_balance_sum)}
            sub="Spot check — not authoritative audit"
          />
        </div>
      </Section>

      <Section title="Compliance Status">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
          <StatCard label="KYC pending" value={metrics?.compliance?.kyc_queue} tone={(metrics?.compliance?.kyc_queue ?? 0) > 0 ? "warn" : "ok"} />
          <StatCard label="Screening pending" value={metrics?.compliance?.aml_screening_pending} tone={(metrics?.compliance?.aml_screening_pending ?? 0) > 0 ? "warn" : "ok"} />
          <StatCard label="AML active" value={metrics?.compliance?.aml_investigations_active} />
          <StatCard label="Restrictions" value={metrics?.compliance?.account_restrictions} />
        </div>
      </Section>

      <Section title="Operational Status">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
          <StatCard label="Registered users" value={metrics?.cohort?.registered_users} sub={`Target ${metrics?.cohort?.target_size || "10–25"}`} />
          <StatCard label="KYC approved" value={metrics?.cohort?.kyc_approved} />
          <StatCard label="Static launch checks" value={launchResults ? `${launchResults.static_tests?.passed}/${launchResults.static_tests?.total}` : "—"} />
        </div>
      </Section>

      <Section title="Incident Status" tone={criticalOpen.length ? "danger" : openIncidents.length ? "warn" : "ok"}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem", marginBottom: "0.65rem" }}>
          <StatCard label="Open incidents" value={openIncidents.length} tone={openIncidents.length ? "warn" : "ok"} />
          <StatCard label="Critical open" value={criticalOpen.length} tone={criticalOpen.length ? "danger" : "ok"} />
        </div>
        {openIncidents.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.78rem", color: "#475569" }}>
            {openIncidents.slice(0, 8).map((i) => (
              <li key={i.id}>
                [{String(i.severity).toUpperCase()}] {i.title} — {i.status}
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#047857" }}>No open incidents in program log.</p>
        )}
      </Section>

      <Section title="User Activity">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
          <StatCard label="Tx count (7d)" value={metrics?.period_7d?.transaction_count} />
          <StatCard label="Funding completions" value={metrics?.period_7d?.funding_completions} />
          <StatCard label="Duplicate funding (24h)" value={metrics?.rates?.duplicate_funding_attempts_24h} />
        </div>
      </Section>

      <Section title="Treasury Activity">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
          <StatCard label="PayPal mode" value={metrics?.treasury?.paypal_mode || "sandbox"} tone="info" />
          <StatCard label="Pending withdrawals" value={metrics?.treasury?.pending_withdrawals} tone={(metrics?.treasury?.pending_withdrawals ?? 0) > 5 ? "warn" : "default"} />
          <StatCard label="Processing" value={metrics?.treasury?.processing_withdrawals} />
          <StatCard
            label="Reconciliation"
            value={reconciliation?.withdrawal_reconciliation?.clean ? "Clean" : "Issues"}
            tone={reconciliation?.withdrawal_reconciliation?.clean === false ? "danger" : "ok"}
            sub={
              reconciliation
                ? `${reconciliation.withdrawal_reconciliation?.critical_count ?? 0} critical / ${reconciliation.withdrawal_reconciliation?.warning_count ?? 0} warn`
                : null
            }
          />
        </div>
      </Section>

      <Section title="Support Activity">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
          <StatCard label="Open fraud logs" value={metrics?.support?.open_fraud_logs} />
          <StatCard label="Support tickets" value={metrics?.support?.support_tickets ?? "N/A"} sub="External tracker not integrated" />
        </div>
      </Section>
    </div>
  );
}
