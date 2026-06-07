import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import {
  AUDIT_STATUS,
  auditStatusLabel,
  fetchProductionAudit,
} from "../../lib/productionAudit";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1100px",
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

function statusBadgeStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === AUDIT_STATUS.READY) {
    return { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" };
  }
  if (key === AUDIT_STATUS.PARTIAL) {
    return { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" };
  }
  if (key === AUDIT_STATUS.MISSING) {
    return { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" };
  }
  return { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" };
}

function overallBannerStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === AUDIT_STATUS.READY) {
    return { bg: "#ecfdf5", border: "#a7f3d0", fg: "#047857", label: "Ready for review" };
  }
  if (key === AUDIT_STATUS.PARTIAL) {
    return { bg: "#fffbeb", border: "#fde68a", fg: "#b45309", label: "Partial readiness" };
  }
  return { bg: "#fef2f2", border: "#fecaca", fg: "#b91c1c", label: "Gaps detected" };
}

function AuditItemRow({ item }) {
  const pal = statusBadgeStyle(item.status);
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "0.85rem 0.95rem",
        background: "#fafbfc",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "0.5rem 0.75rem",
          marginBottom: "0.5rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "#0f172a", lineHeight: 1.35 }}>
          {item.label}
        </h3>
        <span
          style={{
            display: "inline-block",
            padding: "0.15rem 0.5rem",
            borderRadius: "999px",
            fontSize: "0.68rem",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            background: pal.bg,
            color: pal.fg,
            border: `1px solid ${pal.border}`,
            whiteSpace: "nowrap",
          }}
        >
          {auditStatusLabel(item.status)}
        </span>
      </div>
      {item.notes ? (
        <p style={{ margin: "0 0 0.45rem", fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>{item.notes}</p>
      ) : null}
      {item.detail ? (
        <p style={{ margin: "0 0 0.45rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.4, fontFamily: "monospace" }}>
          {item.detail}
        </p>
      ) : null}
      {item.recommendedAction ? (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#0369a1", lineHeight: 1.45 }}>
          <strong style={{ color: "#0f172a" }}>Next:</strong> {item.recommendedAction}
        </p>
      ) : null}
    </div>
  );
}

export default function AdminProductionAuditPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadAudit = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProductionAudit({ supabase });
      setAudit(data);
    } catch (err) {
      console.error("[admin/production-audit]", err);
      setError(err?.message || "Failed to load production audit.");
      setAudit(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void loadAudit();
  }, [authLoading, user, profile, loadAudit]);

  const sectionSummaries = useMemo(() => {
    if (!audit?.sections) return [];
    return audit.sections.map((section) => {
      let ready = 0;
      let partial = 0;
      let missing = 0;
      for (const item of section.items) {
        if (item.status === AUDIT_STATUS.READY) ready += 1;
        else if (item.status === AUDIT_STATUS.PARTIAL) partial += 1;
        else missing += 1;
      }
      return { ...section, ready, partial, missing };
    });
  }, [audit]);

  const overall = audit ? overallBannerStyle(audit.overallStatus) : null;

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
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a" }}>Production Audit</h1>
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
          Production Environment Audit
        </h1>
        <p style={{ margin: "0 0 1rem", fontSize: "0.92rem", color: "#64748b", lineHeight: 1.5, maxWidth: "52rem" }}>
          Read-only deployment, Supabase, PayPal, PWA, storage, security, and legal readiness checks. Secret values
          are never displayed. No write operations are performed.
        </p>

        <div
          style={{
            ...cardBase,
            padding: "0.85rem 1rem",
            marginBottom: "1.25rem",
            border: "1px solid #fde68a",
            background: "#fffbeb",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.82rem", color: "#92400e", lineHeight: 1.45 }}>
            <strong>Safety:</strong> This page reports env var <em>presence</em> only — not contents. Server-side
            secrets (PayPal client secret, service role keys) are not probed or shown.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem", alignItems: "center" }}>
          <button type="button" style={btnSm} onClick={() => void loadAudit()} disabled={loading}>
            {loading ? "Running checks…" : "Re-run audit"}
          </button>
          {audit?.generatedAt ? (
            <span style={{ fontSize: "0.78rem", color: "#64748b" }}>Last run: {formatWhen(audit.generatedAt)}</span>
          ) : null}
          <Link href="/admin/compliance-checklist" style={{ ...btnSm, textDecoration: "none", display: "inline-block" }}>
            Compliance Checklist
          </Link>
          <Link href="/admin/health" style={{ ...btnSm, textDecoration: "none", display: "inline-block" }}>
            Health check
          </Link>
        </div>

        {error ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem",
              marginBottom: "1.25rem",
              border: "1px solid #fecaca",
              background: "#fef2f2",
            }}
          >
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#b91c1c" }}>{error}</p>
          </div>
        ) : null}

        {audit && overall ? (
          <>
            <div
              style={{
                ...cardBase,
                padding: "1.1rem 1.15rem",
                marginBottom: "1.25rem",
                border: `1px solid ${overall.border}`,
                background: overall.bg,
              }}
            >
              <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: overall.fg }}>
                Overall readiness
              </p>
              <p style={{ margin: "0.35rem 0 0", fontSize: "1.35rem", fontWeight: 800, color: overall.fg }}>
                {overall.label}
              </p>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#475569" }}>
                {audit.summary.ready} ready · {audit.summary.partial} partial · {audit.summary.missing} missing ·{" "}
                {audit.summary.total} total checks
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: "0.75rem",
                marginBottom: "1.5rem",
              }}
            >
              {[
                { label: "Ready", value: audit.summary.ready, color: "#047857" },
                { label: "Partial", value: audit.summary.partial, color: "#b45309" },
                { label: "Missing", value: audit.summary.missing, color: "#b91c1c" },
              ].map((chip) => (
                <div key={chip.label} style={{ ...cardBase, padding: "0.85rem 1rem", textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
                    {chip.label}
                  </p>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "1.5rem", fontWeight: 800, color: chip.color }}>{chip.value}</p>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {sectionSummaries.map((section) => (
                <section key={section.id} style={{ ...cardBase, padding: "1.1rem 1.15rem" }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <div>
                      <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>{section.title}</h2>
                      {section.description ? (
                        <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.45 }}>
                          {section.description}
                        </p>
                      ) : null}
                    </div>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", whiteSpace: "nowrap" }}>
                      {section.ready} ready · {section.partial} partial · {section.missing} missing
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                    {section.items.map((item) => (
                      <AuditItemRow key={item.id} item={item} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        ) : loading ? (
          <p style={{ color: "#64748b", fontSize: "0.9rem" }}>Running production audit checks…</p>
        ) : null}
      </div>
    </>
  );
}
