import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import {
  buildPayPalPayoutReadiness,
  getPublicPayPalPayoutReadiness,
} from "../../lib/paypalPayoutReadiness";
import {
  checklistStatusLabel,
  checklistStatusStyle,
  fetchPayPalPayoutTestChecklist,
} from "../../lib/paypalPayoutTestChecklist";

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

function ChecklistItemRow({ row }) {
  const pal = checklistStatusStyle(row.status);
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "10px",
        padding: "0.85rem 0.95rem",
        background: "#fafbfc",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-start", marginBottom: "0.45rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#0f172a", flex: "1 1 12rem" }}>{row.label}</h3>
        <span
          style={{
            display: "inline-block",
            padding: "0.15rem 0.5rem",
            borderRadius: "999px",
            fontSize: "0.68rem",
            fontWeight: 800,
            textTransform: "uppercase",
            background: pal.bg,
            color: pal.fg,
            border: `1px solid ${pal.border}`,
          }}
        >
          {checklistStatusLabel(row.status)}
        </span>
      </div>
      {row.notes ? (
        <p style={{ margin: "0 0 0.4rem", fontSize: "0.82rem", color: "#475569", lineHeight: 1.45 }}>{row.notes}</p>
      ) : null}
      {row.nextAction ? (
        <p style={{ margin: 0, fontSize: "0.82rem", color: "#0369a1", lineHeight: 1.45 }}>
          <strong style={{ color: "#0f172a" }}>Next:</strong> {row.nextAction}
        </p>
      ) : null}
    </div>
  );
}

export default function AdminPayPalPayoutTestPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [checklist, setChecklist] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadChecklist = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setError(null);
    try {
      let serverPart = null;
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (!sessErr && sessionData?.session?.access_token) {
        const res = await fetch("/api/admin/withdrawals/payout-readiness", {
          headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        });
        serverPart = res.ok ? await res.json().catch(() => null) : null;
      }
      const data = await fetchPayPalPayoutTestChecklist({
        supabase,
        serverPayoutReadiness: serverPart,
      });
      setChecklist(data);
      const readiness = buildPayPalPayoutReadiness(getPublicPayPalPayoutReadiness(), serverPart);
      if (readiness.mode === "live") {
        setError("PayPal mode appears to be LIVE. This page is for sandbox testing only — do not proceed.");
      }
    } catch (err) {
      setError(err?.message || "Failed to load checklist.");
      setChecklist(null);
    } finally {
      setLoading(false);
    }
  }, [user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void loadChecklist();
  }, [authLoading, user, profile, loadChecklist]);

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
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a" }}>PayPal Payout Test</h1>
          <p style={{ color: "#64748b" }}>Sign in to view this page.</p>
          <Link href="/login" style={{ color: "#0ea5e9", fontWeight: 600 }}>
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
          <h2 style={{ color: "#0f172a" }}>Admin access required.</h2>
        </div>
      </>
    );
  }

  const summary = checklist?.summary;

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div>
            <Link href="/admin" style={{ color: "#38bdf8", fontWeight: 600, fontSize: "0.9rem" }}>
              ← Admin home
            </Link>
            <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", margin: "0.5rem 0 0", letterSpacing: "-0.02em" }}>
              PayPal Payout Sandbox Test
            </h1>
          </div>
          <button type="button" onClick={() => void loadChecklist()} disabled={loading} style={btnSm}>
            {loading ? "Refreshing…" : "Refresh checklist"}
          </button>
        </div>

        <div
          style={{
            ...cardBase,
            padding: "1rem 1.1rem",
            marginBottom: "1.25rem",
            borderColor: "#fcd34d",
            background: "#fffbeb",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#92400e" }}>
            Sandbox only — this page does not trigger payouts.
          </p>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.82rem", color: "#92400e", lineHeight: 1.5 }}>
            Read-only checklist and test runner guide. Withdrawals, PayPal batches, refunds, and status changes happen
            only when you manually perform them on other admin pages. No money movement is initiated from here.
          </p>
        </div>

        {error ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", borderColor: "#fecaca", background: "#fef2f2" }}>
            <p style={{ margin: 0, color: "#991b1b", fontSize: "0.9rem" }}>{error}</p>
          </div>
        ) : null}

        {summary ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(8rem, 1fr))",
              gap: "0.75rem",
              marginBottom: "1.25rem",
            }}
          >
            {[
              { label: "Ready", value: summary.ready, color: "#047857" },
              { label: "Partial", value: summary.partial, color: "#b45309" },
              { label: "Missing", value: summary.missing, color: "#b91c1c" },
              { label: "Manual steps", value: summary.manual, color: "#1d4ed8" },
            ].map((tile) => (
              <div key={tile.label} style={{ ...cardBase, padding: "0.85rem 1rem", background: "#fafbfc" }}>
                <p style={{ margin: 0, fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
                  {tile.label}
                </p>
                <p style={{ margin: "0.35rem 0 0", fontSize: "1.35rem", fontWeight: 800, color: tile.color }}>{tile.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "1.25rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Quick links</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem 1.25rem", fontSize: "0.85rem" }}>
            <Link href="/admin/withdrawals" style={{ color: "#0ea5e9", fontWeight: 600 }}>
              Withdrawals queue
            </Link>
            <Link href="/admin/withdrawal-reconciliation" style={{ color: "#0ea5e9", fontWeight: 600 }}>
              Withdrawal reconciliation
            </Link>
            <Link href="/admin/production-audit" style={{ color: "#0ea5e9", fontWeight: 600 }}>
              Production audit
            </Link>
            <Link href="/transactions" style={{ color: "#0ea5e9", fontWeight: 600 }}>
              Transaction history
            </Link>
          </div>
        </div>

        <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "1.25rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            Required environment variables
          </h2>
          <p style={{ margin: "0 0 0.65rem", fontSize: "0.82rem", color: "#64748b" }}>
            Presence only — values are never displayed on this page.
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.82rem", color: "#334155", lineHeight: 1.55 }}>
            {(checklist?.requiredEnvVars || []).map((name) => (
              <li key={name}>
                <code style={{ fontSize: "0.78rem" }}>{name}</code>
              </li>
            ))}
          </ul>
        </div>

        <div style={{ ...cardBase, padding: "1rem 1.1rem", marginBottom: "1.25rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>Test sequence</h2>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {(checklist?.testSequence || []).map((block) => (
              <li key={block.step}>
                <p style={{ margin: "0 0 0.35rem", fontSize: "0.9rem", fontWeight: 700, color: "#0f172a" }}>
                  {block.step}. {block.title}
                </p>
                <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.82rem", color: "#475569", lineHeight: 1.5 }}>
                  {block.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>

        {checklist?.generatedAt ? (
          <p style={{ margin: "0 0 1rem", fontSize: "0.78rem", color: "#94a3b8" }}>
            Checklist generated {formatWhen(checklist.generatedAt)}
            {checklist.payoutReadiness?.mode ? ` · PayPal mode: ${checklist.payoutReadiness.mode}` : ""}
          </p>
        ) : null}

        {loading && !checklist ? (
          <p style={{ color: "#64748b" }}>Loading checklist…</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {(checklist?.sections || []).map((section) => (
              <section key={section.id} style={{ ...cardBase, padding: "1.1rem 1.15rem" }}>
                <h2 style={{ margin: "0 0 0.35rem", fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>{section.title}</h2>
                {section.description ? (
                  <p style={{ margin: "0 0 0.85rem", fontSize: "0.82rem", color: "#64748b", lineHeight: 1.45 }}>{section.description}</p>
                ) : null}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                  {section.items.map((row) => (
                    <ChecklistItemRow key={row.id} row={row} />
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
