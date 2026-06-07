import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import {
  fetchLaunchReadiness,
  readinessLabelColor,
  READINESS_LABELS,
} from "../../lib/launchReadiness";
import { auditStatusLabel } from "../../lib/productionAudit";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1180px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "transparent",
  boxSizing: "border-box",
};

const cardBase = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
};

const btnSm = {
  padding: "0.45rem 0.75rem",
  fontSize: "0.78rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
};

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function fmtCount(value) {
  if (value == null) return "—";
  return Number(value).toLocaleString();
}

function MetricTile({ label, value, accent }) {
  return (
    <div style={{ ...cardBase, padding: "0.85rem 1rem", background: "#fafbfc" }}>
      <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
        {label}
      </p>
      <p style={{ margin: "0.35rem 0 0", fontSize: "1.35rem", fontWeight: 800, color: accent || "#0f172a" }}>{value}</p>
    </div>
  );
}

function SectionCard({ title, href, children }) {
  return (
    <section style={{ ...cardBase, padding: "1.1rem 1.15rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", marginBottom: "0.85rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>{title}</h2>
        {href ? (
          <Link href={href} style={{ fontSize: "0.78rem", fontWeight: 600, color: "#0ea5e9", textDecoration: "none" }}>
            Open →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function LegalStatusPill({ status }) {
  const key = String(status || "").toLowerCase();
  const pal =
    key === "reviewed"
      ? { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" }
      : key === "draft"
        ? { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" }
        : { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.12rem 0.45rem",
        borderRadius: "999px",
        fontSize: "0.65rem",
        fontWeight: 800,
        textTransform: "uppercase",
        background: pal.bg,
        color: pal.fg,
        border: `1px solid ${pal.border}`,
      }}
    >
      {status}
    </span>
  );
}

function CheckRow({ item }) {
  if (!item) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem 0.75rem", alignItems: "center", fontSize: "0.82rem", padding: "0.35rem 0" }}>
      <span style={{ fontFamily: "monospace", color: "#334155" }}>{item.label}</span>
      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b" }}>{auditStatusLabel(item.status)}</span>
    </div>
  );
}

export default function AdminLaunchReadinessPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLaunchReadiness({ supabase });
      setData(result);
    } catch (err) {
      console.error("[admin/launch-readiness]", err);
      setError(err?.message || "Failed to load launch readiness.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void load();
  }, [authLoading, user, profile, load]);

  const overallPal = data ? readinessLabelColor(data.overallLabel) : null;

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
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a" }}>Launch Readiness</h1>
          <p style={{ color: "#64748b" }}>Sign in to view this page.</p>
          <Link href="/login" style={{ fontWeight: 600, color: "#0ea5e9" }}>
            Go to login
          </Link>
        </div>
      </>
    );
  }

  if (!isAdminUser(user, profile)) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a" }}>Not authorized</h1>
          <p style={{ color: "#64748b" }}>This area is restricted to admin users.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href="/admin" style={{ fontSize: "0.85rem", fontWeight: 600, color: "#0ea5e9", textDecoration: "none" }}>
            ← Admin home
          </Link>
        </div>

        <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.35rem" }}>
          Launch Readiness
        </h1>
        <p style={{ margin: "0 0 1rem", fontSize: "0.92rem", color: "#64748b", lineHeight: 1.5, maxWidth: "54rem" }}>
          Unified operational go-live dashboard — aggregates compliance checklist, production audit, KYC, withdrawals,
          treasury, fraud, security, and legal readiness. Read-only; no money movement.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem", alignItems: "center" }}>
          <button type="button" style={btnSm} onClick={() => void load()} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh dashboard"}
          </button>
          {data?.generatedAt ? (
            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Updated: {formatWhen(data.generatedAt)}</span>
          ) : null}
          <Link href="/admin/compliance-checklist" style={{ ...btnSm, textDecoration: "none", display: "inline-block" }}>
            Compliance Checklist
          </Link>
          <Link href="/admin/production-audit" style={{ ...btnSm, textDecoration: "none", display: "inline-block" }}>
            Production Audit
          </Link>
        </div>

        {error ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1.25rem", border: "1px solid #fecaca", background: "#fef2f2" }}>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#b91c1c" }}>{error}</p>
          </div>
        ) : null}

        {data && overallPal ? (
          <>
            <div
              style={{
                ...cardBase,
                padding: "1.25rem 1.35rem",
                marginBottom: "1.25rem",
                border: `1px solid ${overallPal.border}`,
                background: overallPal.bg,
              }}
            >
              <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: overallPal.fg }}>
                Launch readiness score
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0.75rem 1.25rem", marginTop: "0.35rem" }}>
                <p style={{ margin: 0, fontSize: "2.5rem", fontWeight: 900, color: overallPal.fg, lineHeight: 1 }}>
                  {data.overallScore}
                  <span style={{ fontSize: "1rem", fontWeight: 600, opacity: 0.75 }}>/100</span>
                </p>
                <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: overallPal.fg }}>{data.overallLabel}</p>
              </div>
              <p style={{ margin: "0.65rem 0 0", fontSize: "0.78rem", color: "#475569", lineHeight: 1.45, maxWidth: "52rem" }}>
                {data.scoringMethod}
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                gap: "0.65rem",
                marginBottom: "1.5rem",
              }}
            >
              {data.categoryScores.map((cat) => {
                const pal = readinessLabelColor(cat.labelStatus);
                return (
                  <div key={cat.id} style={{ ...cardBase, padding: "0.85rem 1rem" }}>
                    <p style={{ margin: 0, fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
                      {cat.label}
                    </p>
                    <p style={{ margin: "0.25rem 0 0", fontSize: "1.4rem", fontWeight: 800, color: pal.fg }}>{cat.score}</p>
                    <p style={{ margin: "0.15rem 0 0", fontSize: "0.68rem", fontWeight: 600, color: pal.fg }}>{cat.labelStatus}</p>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.15rem" }}>
              <SectionCard title="KYC" href={data.sections.kyc.href}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.65rem" }}>
                  <MetricTile label="Total profiles" value={fmtCount(data.sections.kyc.metrics.totalProfiles)} />
                  <MetricTile label="Submitted" value={fmtCount(data.sections.kyc.metrics.submitted)} accent="#1d4ed8" />
                  <MetricTile label="Under review" value={fmtCount(data.sections.kyc.metrics.underReview)} accent="#1d4ed8" />
                  <MetricTile label="Approved" value={fmtCount(data.sections.kyc.metrics.approved)} accent="#047857" />
                  <MetricTile label="Rejected" value={fmtCount(data.sections.kyc.metrics.rejected)} accent="#b91c1c" />
                  <MetricTile label="Needs more info" value={fmtCount(data.sections.kyc.metrics.needsMoreInfo)} accent="#b45309" />
                </div>
              </SectionCard>

              <SectionCard title="Withdrawals" href={data.sections.withdrawals.href}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.65rem" }}>
                  <MetricTile label="Pending" value={fmtCount(data.sections.withdrawals.metrics.pending)} accent="#b45309" />
                  <MetricTile label="Processing" value={fmtCount(data.sections.withdrawals.metrics.processing)} accent="#1d4ed8" />
                  <MetricTile label="Paid today" value={fmtCount(data.sections.withdrawals.metrics.paidToday)} accent="#047857" />
                  <MetricTile label="Blocked by KYC (all time)" value={fmtCount(data.sections.withdrawals.metrics.blockedByKyc)} accent="#b91c1c" />
                  <MetricTile label="Over-limit attempts (7d)" value={fmtCount(data.sections.withdrawals.metrics.overLimitAttempts7d)} accent="#b45309" />
                </div>
              </SectionCard>

              <SectionCard title="Treasury" href={data.sections.treasury.href}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.65rem", marginBottom: "0.75rem" }}>
                  <MetricTile label="Open cases" value={fmtCount(data.sections.treasury.metrics.openCases)} />
                  <MetricTile label="Escalated cases" value={fmtCount(data.sections.treasury.metrics.escalatedCases)} accent="#b45309" />
                  <MetricTile label="Critical events" value={fmtCount(data.sections.treasury.metrics.criticalEvents)} accent="#b91c1c" />
                  <MetricTile label="Warnings" value={fmtCount(data.sections.treasury.metrics.warnings)} accent="#b45309" />
                </div>
                <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", lineHeight: 1.45 }}>{data.sections.treasury.summary}</p>
              </SectionCard>

              <SectionCard title="Security" href={data.sections.security.href}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.65rem" }}>
                  <MetricTile label="Events (7d)" value={fmtCount(data.sections.security.metrics.recentSecurityEvents7d)} />
                  <MetricTile label="High severity" value={fmtCount(data.sections.security.metrics.highSeverityEvents)} accent="#b91c1c" />
                  <MetricTile label="Suspicious logins (7d)" value={fmtCount(data.sections.security.metrics.suspiciousLogins7d)} accent="#b45309" />
                  <MetricTile label="Unresolved (est.)" value={fmtCount(data.sections.security.metrics.unresolvedEstimate)} accent="#b45309" />
                </div>
              </SectionCard>

              <SectionCard title="Fraud" href={data.sections.fraud.href}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.65rem" }}>
                  <MetricTile label="Open investigations" value={fmtCount(data.sections.fraud.metrics.openInvestigations)} accent="#b45309" />
                  <MetricTile label="Escalated" value={fmtCount(data.sections.fraud.metrics.escalatedInvestigations)} accent="#b91c1c" />
                  <MetricTile label="High-risk alerts" value={fmtCount(data.sections.fraud.metrics.highRiskAlerts)} accent="#b91c1c" />
                  <MetricTile label="Open smart alerts" value={fmtCount(data.sections.fraud.metrics.openSmartAlerts)} />
                </div>
              </SectionCard>

              <SectionCard title="Legal" href={data.sections.legal.href}>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {data.sections.legal.documents.map((doc) => (
                    <li
                      key={doc.id}
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: "0.5rem 0.75rem",
                        padding: "0.55rem 0.65rem",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        background: "#fafbfc",
                      }}
                    >
                      <Link href={doc.path} style={{ fontWeight: 600, color: "#0f172a", textDecoration: "none", fontSize: "0.88rem" }}>
                        {doc.label}
                      </Link>
                      <LegalStatusPill status={doc.status} />
                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>{doc.detail}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>

              <SectionCard title="Production" href={data.sections.production.href}>
                {[
                  ["Supabase", data.sections.production.checks.supabase],
                  ["PayPal", data.sections.production.checks.paypal],
                  ["PWA", data.sections.production.checks.pwa],
                  ["Storage", data.sections.production.checks.storage],
                  ["Deployment", data.sections.production.checks.deployment],
                ].map(([groupLabel, items]) => (
                  <div key={groupLabel} style={{ marginBottom: "0.65rem" }}>
                    <p style={{ margin: "0 0 0.25rem", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
                      {groupLabel}
                    </p>
                    {items.map((item) => (
                      <CheckRow key={item.id} item={item} />
                    ))}
                  </div>
                ))}
              </SectionCard>
            </div>

            <p style={{ marginTop: "1.25rem", fontSize: "0.78rem", color: "#94a3b8", lineHeight: 1.45 }}>
              Read-only dashboard. Labels: {READINESS_LABELS.READY} (85+), {READINESS_LABELS.ALMOST_READY} (70–84),{" "}
              {READINESS_LABELS.NEEDS_ATTENTION} (50–69), {READINESS_LABELS.NOT_READY} (&lt;50).
            </p>
          </>
        ) : loading ? (
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Loading launch readiness…</p>
        ) : null}
      </div>
    </>
  );
}
