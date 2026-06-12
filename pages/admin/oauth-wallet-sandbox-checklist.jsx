import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import {
  ALLOWED_WALLET_FIELDS,
  BLOCKED_WALLET_FIELDS,
  CHECKLIST_STATUSES,
  evaluateOAuthWalletChecklist,
  getChecklistReadinessSummary,
} from "../../lib/oauthWalletSandboxOperatorChecklist";
import { evaluateOperationalReadiness } from "../../lib/oauthWalletCertificationGate";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1200px",
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

function statusStyle(status) {
  const tone = CHECKLIST_STATUSES[status]?.tone || "info";
  if (tone === "ready") {
    return {
      display: "inline-block",
      padding: "0.25rem 0.65rem",
      borderRadius: "999px",
      fontSize: "0.75rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#ecfdf5",
      color: "#047857",
      border: "1px solid #6ee7b7",
    };
  }
  if (tone === "blocked") {
    return {
      display: "inline-block",
      padding: "0.25rem 0.65rem",
      borderRadius: "999px",
      fontSize: "0.75rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fca5a5",
    };
  }
  if (tone === "warn") {
    return {
      display: "inline-block",
      padding: "0.25rem 0.65rem",
      borderRadius: "999px",
      fontSize: "0.75rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fffbeb",
      color: "#9a3412",
      border: "1px solid #fcd34d",
    };
  }
  return {
    display: "inline-block",
    padding: "0.25rem 0.65rem",
    borderRadius: "999px",
    fontSize: "0.75rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: "#f0f9ff",
    color: "#0369a1",
    border: "1px solid #7dd3fc",
  };
}

function itemIcon(state) {
  if (state === "complete") return "✓";
  if (state === "failed") return "✗";
  return "○";
}

const RELATED_LINKS = [
  {
    href: "/dev-console/oauth-wallet-test",
    label: "OAuth Wallet Test Harness",
    description: "Interactive E2E sandbox harness",
  },
  {
    href: "/admin/oauth-wallet-test-evidence",
    label: "OAuth Evidence Reports",
    description: "Sanitized harness evidence viewer",
  },
  {
    href: "/admin/oauth-wallet-certification",
    label: "OAuth Certification",
    description: "Evaluate evidence and certify runs",
  },
  {
    href: "/admin/oauth-wallet-certification-gate",
    label: "OAuth Certification Gate",
    description: "Certification gate progression view",
  },
];

export default function OAuthWalletSandboxChecklistPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const isAdmin = isAdminUser(user, profile);

  const evaluation = useMemo(() => evaluateOAuthWalletChecklist(), []);
  const summary = useMemo(() => getChecklistReadinessSummary(evaluation), [evaluation]);
  const operational = useMemo(
    () =>
      evaluateOperationalReadiness({
        certificationGate: { gateStatus: "NOT_EVALUATED", allowsProgression: false },
        checklistEvaluation: evaluation,
      }),
    [evaluation],
  );

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/");
    }
  }, [user, userLoading, isAdmin, router]);

  if (userLoading || !user || !isAdmin) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href="/admin" style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.9rem" }}>
            ← Admin
          </Link>
        </div>

        <div
          style={{
            ...cardBase,
            padding: "1rem 1.25rem",
            marginBottom: "1.25rem",
            borderColor: "#fcd34d",
            background: "#fffbeb",
          }}
        >
          <strong style={{ color: "#92400e" }}>Sandbox only — operational governance</strong>
          <p style={{ margin: "0.5rem 0 0", color: "#78350f", fontSize: "0.9rem", lineHeight: 1.5 }}>
            This checklist governs OAuth wallet sandbox certification runs. It does not enable
            production access, modify wallets, or expose new wallet data. No approve button — follow
            the sequence, capture evidence, and evaluate certification separately.
          </p>
        </div>

        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.65rem", color: "#0f172a" }}>
          OAuth Wallet Sandbox Operator Checklist
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "#64748b", maxWidth: "760px", lineHeight: 1.5 }}>
          Formal operator procedures for consistent sandbox certification runs. Informational reference
          only — track completion externally or via harness evidence and certification tools.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          <div style={{ ...cardBase, padding: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Overall status
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <span style={statusStyle(evaluation.status)}>{evaluation.status}</span>
            </div>
          </div>
          <div style={{ ...cardBase, padding: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Progress
            </div>
            <div style={{ marginTop: "0.35rem", fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>
              {summary.percentComplete}%
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
              {summary.completedItems} / {summary.totalItems} items
            </div>
          </div>
          <div style={{ ...cardBase, padding: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Categories
            </div>
            <div style={{ marginTop: "0.35rem", fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>
              {summary.categoriesComplete} / {summary.categoriesTotal}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>complete</div>
          </div>
          <div style={{ ...cardBase, padding: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Pass / fail
            </div>
            <div style={{ marginTop: "0.35rem", fontSize: "0.95rem", color: "#475569" }}>
              <span style={{ color: "#047857", fontWeight: 700 }}>{summary.completedItems} pass</span>
              {" · "}
              <span style={{ color: "#991b1b", fontWeight: 700 }}>{summary.failedItems} fail</span>
              {" · "}
              <span style={{ color: "#64748b", fontWeight: 700 }}>{summary.pendingItems} pending</span>
            </div>
          </div>
        </div>

        <div style={{ ...cardBase, padding: "1.25rem", marginBottom: "1.25rem", background: "#f8fafc" }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem", color: "#0f172a" }}>
            Operational readiness (Phase 13D + 13E)
          </h2>
          <p style={{ margin: "0 0 0.75rem", fontSize: "0.85rem", color: "#475569", lineHeight: 1.5 }}>
            Sandbox wallet is operationally ready only when certification gate ={" "}
            <strong>CERTIFIED</strong> and operator checklist = <strong>READY_FOR_CERTIFICATION</strong>.
            Checklist does not override a failed certification.
          </p>
          <div style={{ fontSize: "0.85rem", color: "#334155" }}>
            <div>
              Operationally ready:{" "}
              <strong style={{ color: operational.operationallyReady ? "#047857" : "#991b1b" }}>
                {operational.operationallyReady ? "Yes" : "No"}
              </strong>
            </div>
            {operational.reasons.length ? (
              <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.25rem", color: "#64748b" }}>
                {operational.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <div style={{ ...cardBase, padding: "1.25rem", marginBottom: "1.25rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "#0f172a" }}>Related tools</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {RELATED_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  display: "block",
                  padding: "0.75rem 1rem",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  textDecoration: "none",
                }}
              >
                <div style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.9rem" }}>{link.label}</div>
                <div style={{ marginTop: "0.25rem", fontSize: "0.78rem", color: "#64748b" }}>
                  {link.description}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {evaluation.categories.map((category) => (
          <div key={category.id} style={{ ...cardBase, padding: "1.25rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", color: "#0f172a" }}>{category.title}</h2>
              <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                {category.completed}/{category.total} ({category.percentComplete}%)
              </span>
            </div>
            <p style={{ margin: "0.5rem 0 1rem", fontSize: "0.85rem", color: "#64748b" }}>{category.summary}</p>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {category.items.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: "0.65rem",
                    alignItems: "flex-start",
                    padding: "0.45rem 0",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: "0.88rem",
                    color: item.state === "failed" ? "#991b1b" : "#334155",
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: "1.25rem",
                      textAlign: "center",
                      fontWeight: 700,
                      color:
                        item.state === "complete"
                          ? "#047857"
                          : item.state === "failed"
                            ? "#991b1b"
                            : "#94a3b8",
                    }}
                  >
                    {itemIcon(item.state)}
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div style={{ ...cardBase, padding: "1.25rem", marginBottom: "1rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "#0f172a" }}>
            Wallet field reference
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
            <div>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "#047857" }}>Allowed fields</h3>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", color: "#475569" }}>
                {ALLOWED_WALLET_FIELDS.map((f) => (
                  <li key={f}>
                    <code>{f}</code>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "#991b1b" }}>Blocked fields</h3>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", color: "#475569" }}>
                {BLOCKED_WALLET_FIELDS.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
          Docs:{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            docs/developer/OAUTH_WALLET_SANDBOX_OPERATOR_CHECKLIST.md
          </code>
        </p>
      </div>
    </>
  );
}
