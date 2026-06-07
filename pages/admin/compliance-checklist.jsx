import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import {
  CHECKLIST_STATUS,
  complianceStatusLabel,
  fetchComplianceChecklist,
} from "../../lib/complianceChecklist";

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
  if (key === CHECKLIST_STATUS.READY) {
    return { bg: "#ecfdf5", fg: "#047857", border: "#a7f3d0" };
  }
  if (key === CHECKLIST_STATUS.PARTIAL) {
    return { bg: "#fffbeb", fg: "#b45309", border: "#fde68a" };
  }
  if (key === CHECKLIST_STATUS.MISSING) {
    return { bg: "#fef2f2", fg: "#b91c1c", border: "#fecaca" };
  }
  return { bg: "#f1f5f9", fg: "#64748b", border: "#e2e8f0" };
}

function ChecklistItemRow({ item }) {
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
          {complianceStatusLabel(item.status)}
        </span>
      </div>
      <p style={{ margin: "0 0 0.35rem", fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Owner: {item.owner}
      </p>
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

export default function AdminComplianceChecklistPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadChecklist = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchComplianceChecklist({ supabase });
      setChecklist(data);
    } catch (err) {
      console.error("[admin/compliance-checklist]", err);
      setError(err?.message || "Failed to load checklist.");
      setChecklist(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void loadChecklist();
  }, [authLoading, user, profile, loadChecklist]);

  const sectionSummaries = useMemo(() => {
    if (!checklist?.sections) return [];
    return checklist.sections.map((section) => {
      let ready = 0;
      let partial = 0;
      let missing = 0;
      for (const item of section.items) {
        if (item.status === CHECKLIST_STATUS.READY) ready += 1;
        else if (item.status === CHECKLIST_STATUS.PARTIAL) partial += 1;
        else missing += 1;
      }
      return { ...section, ready, partial, missing };
    });
  }, [checklist]);

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
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a" }}>Compliance Checklist</h1>
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

  const summary = checklist?.summary;

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "1rem" }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: "0 0 0.35rem", fontSize: "0.78rem", fontWeight: 600, color: "#64748b" }}>
              <Link href="/admin" style={{ color: "#0ea5e9", textDecoration: "none" }}>
                ← Admin
              </Link>
            </p>
            <h1 style={{ margin: 0, fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", letterSpacing: "-0.02em" }}>
              Compliance Checklist
            </h1>
            <p style={{ margin: "0.45rem 0 0", fontSize: "0.9rem", color: "#64748b", lineHeight: 1.45, maxWidth: "42rem" }}>
              Release readiness, KYC, treasury, risk, legal, and production controls. Read-only — no configuration changes
              from this page.
            </p>
          </div>
          <button type="button" style={btnSm} disabled={loading} onClick={() => void loadChecklist()}>
            {loading ? "Refreshing…" : "Refresh checks"}
          </button>
        </div>

        {error ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", borderColor: "#fecaca", background: "#fef2f2" }}>
            <p style={{ margin: 0, color: "#991b1b", fontSize: "0.9rem" }}>{error}</p>
          </div>
        ) : null}

        {summary ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem 1.1rem",
              marginBottom: "1.25rem",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 130px), 1fr))",
              gap: "0.75rem",
            }}
          >
            {[
              { label: "Ready", value: summary.ready, pal: statusBadgeStyle(CHECKLIST_STATUS.READY) },
              { label: "Partial", value: summary.partial, pal: statusBadgeStyle(CHECKLIST_STATUS.PARTIAL) },
              { label: "Missing", value: summary.missing, pal: statusBadgeStyle(CHECKLIST_STATUS.MISSING) },
              { label: "Total items", value: summary.total, pal: statusBadgeStyle("") },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  border: `1px solid ${row.pal.border}`,
                  background: row.pal.bg,
                  borderRadius: "10px",
                  padding: "0.75rem 0.85rem",
                }}
              >
                <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, color: row.pal.fg, textTransform: "uppercase" }}>
                  {row.label}
                </p>
                <p style={{ margin: "0.35rem 0 0", fontSize: "1.35rem", fontWeight: 800, color: "#0f172a" }}>{row.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        {checklist?.generatedAt ? (
          <p style={{ margin: "0 0 1.25rem", fontSize: "0.78rem", color: "#94a3b8" }}>
            Last evaluated {formatWhen(checklist.generatedAt)}
          </p>
        ) : null}

        {loading && !checklist ? (
          <p style={{ color: "#64748b" }}>Running compliance probes…</p>
        ) : (
          <div style={{ display: "grid", gap: "1.25rem" }}>
            {sectionSummaries.map((section) => (
              <section key={section.id} style={{ ...cardBase, padding: "1.1rem 1.15rem" }}>
                <div style={{ marginBottom: "0.85rem" }}>
                  <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>{section.title}</h2>
                  <p style={{ margin: "0.35rem 0 0", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.45 }}>{section.description}</p>
                  <p style={{ margin: "0.5rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
                    {section.ready} ready · {section.partial} partial · {section.missing} missing
                  </p>
                </div>
                <div style={{ display: "grid", gap: "0.65rem" }}>
                  {section.items.map((item) => (
                    <ChecklistItemRow key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
