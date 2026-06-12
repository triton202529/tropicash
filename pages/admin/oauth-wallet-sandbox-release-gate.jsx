import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import {
  evaluateFinalSandboxRelease,
  getSandboxReleaseRequirements,
  getSandboxReleaseSummary,
  SANDBOX_RELEASE_STATUSES,
} from "../../lib/oauthWalletCertificationGate";

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

function releaseStatusStyle(status) {
  const tone = SANDBOX_RELEASE_STATUSES[status]?.tone || "blocked";
  if (tone === "released" || tone === "ready") {
    return {
      display: "inline-block",
      padding: "0.3rem 0.75rem",
      borderRadius: "999px",
      fontSize: "0.8rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: tone === "released" ? "#ede9fe" : "#ecfdf5",
      color: tone === "released" ? "#5b21b6" : "#047857",
      border: tone === "released" ? "1px solid #c4b5fd" : "1px solid #6ee7b7",
    };
  }
  return {
    display: "inline-block",
    padding: "0.3rem 0.75rem",
    borderRadius: "999px",
    fontSize: "0.8rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fca5a5",
  };
}

function itemIcon(passed) {
  return passed ? "✓" : "✗";
}

const RELATED_LINKS = [
  { href: "/dev-console/oauth-wallet-test", label: "Test Harness" },
  { href: "/admin/oauth-wallet-test-evidence", label: "Evidence Reports" },
  { href: "/admin/oauth-wallet-certification", label: "Certification" },
  { href: "/admin/oauth-wallet-certification-gate", label: "Certification Gate" },
  { href: "/admin/oauth-wallet-sandbox-checklist", label: "Operator Checklist" },
];

export default function OAuthWalletSandboxReleaseGatePage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const isAdmin = isAdminUser(user, profile);

  const [latestCert, setLatestCert] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("oauth_wallet_test_certifications")
      .select(
        "id, run_id, user_id, status, leak_detected, summary, certified_at",
      )
      .eq("status", "certified")
      .order("certified_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setLatestCert(data || null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/");
      return;
    }
    void load();
  }, [user, userLoading, isAdmin, router, load]);

  const releaseEval = useMemo(
    () =>
      evaluateFinalSandboxRelease({
        certificationRow: latestCert,
      }),
    [latestCert],
  );

  const summary = useMemo(() => getSandboxReleaseSummary(releaseEval), [releaseEval]);
  const requirementGroups = useMemo(() => getSandboxReleaseRequirements(), []);

  const groupResults = useMemo(
    () => [
      { title: "Technical Certification", data: releaseEval.technicalCertification },
      { title: "Operational Readiness", data: releaseEval.operationalReadiness },
      { title: "Security Controls", data: releaseEval.securityControls },
      { title: "Wallet Exposure Controls", data: releaseEval.walletExposureControls },
      { title: "Environment Controls", data: releaseEval.environmentControls },
    ],
    [releaseEval],
  );

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
            borderColor: "#c4b5fd",
            background: "#f5f3ff",
          }}
        >
          <strong style={{ color: "#5b21b6" }}>Permanent notice</strong>
          <p style={{ margin: "0.5rem 0 0", color: "#4c1d95", fontSize: "0.9rem", lineHeight: 1.5 }}>
            Approval of sandbox release does not enable production access or money movement.
          </p>
        </div>

        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.65rem", color: "#0f172a" }}>
          OAuth Wallet Sandbox Release Gate
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "#64748b", maxWidth: "820px", lineHeight: 1.5 }}>
          Final executive/governance release decision for external developer sandbox access.
          Defaults to BLOCKED — no automatic promotion. Read-only evaluation.
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
              Release status
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <span style={releaseStatusStyle(releaseEval.releaseStatus)}>
                {releaseEval.releaseStatus}
              </span>
            </div>
          </div>
          <div style={{ ...cardBase, padding: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Readiness
            </div>
            <div style={{ marginTop: "0.35rem", fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>
              {summary.readinessPercent}%
            </div>
          </div>
          <div style={{ ...cardBase, padding: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Passed
            </div>
            <div style={{ marginTop: "0.35rem", fontSize: "1.5rem", fontWeight: 700, color: "#047857" }}>
              {summary.passedCount}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>of {summary.totalCount}</div>
          </div>
          <div style={{ ...cardBase, padding: "1rem" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
              Groups
            </div>
            <div style={{ marginTop: "0.35rem", fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>
              {summary.groupsPassed}/{summary.groupsTotal}
            </div>
          </div>
        </div>

        {releaseEval.blockers.length ? (
          <div
            style={{
              ...cardBase,
              padding: "1.25rem",
              marginBottom: "1.25rem",
              borderColor: "#fecaca",
              background: "#fef2f2",
            }}
          >
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem", color: "#991b1b" }}>Blockers</h2>
            <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", color: "#7f1d1d" }}>
              {releaseEval.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <div style={{ ...cardBase, padding: "1.25rem", marginBottom: "1.25rem" }}>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "#0f172a" }}>Related tools</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {RELATED_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  padding: "0.4rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  color: "#0ea5e9",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  textDecoration: "none",
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {loading ? (
          <p style={{ color: "#64748b" }}>Loading latest certification context…</p>
        ) : null}

        {groupResults.map((group) => (
          <div key={group.title} style={{ ...cardBase, padding: "1.25rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", color: "#0f172a" }}>{group.title}</h2>
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  color: group.data.passed ? "#047857" : "#991b1b",
                }}
              >
                {group.data.passed ? "PASSED" : "FAILED"}
              </span>
            </div>
            <ul style={{ margin: "0.75rem 0 0", padding: 0, listStyle: "none" }}>
              {group.data.items.map((item) => (
                <li
                  key={item.id}
                  style={{
                    display: "flex",
                    gap: "0.65rem",
                    padding: "0.4rem 0",
                    borderBottom: "1px solid #f1f5f9",
                    fontSize: "0.88rem",
                    color: item.passed ? "#334155" : "#991b1b",
                  }}
                >
                  <span style={{ fontWeight: 700, color: item.passed ? "#047857" : "#991b1b" }}>
                    {itemIcon(item.passed)}
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div style={{ ...cardBase, padding: "1.25rem", marginBottom: "1rem", background: "#f8fafc" }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem", color: "#0f172a" }}>
            Environment restrictions
          </h2>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", color: "#475569", lineHeight: 1.6 }}>
            {requirementGroups
              .find((g) => g.id === "environment_controls")
              ?.requirements.map((r) => (
                <li key={r.id}>{r.label}</li>
              ))}
          </ul>
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.82rem", color: "#64748b" }}>
            Sandbox only · Production separated · No live credentials · No production tokens
          </p>
        </div>

        <p style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
          Docs:{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            docs/developer/OAUTH_WALLET_SANDBOX_RELEASE_GATE.md
          </code>
        </p>
      </div>
    </>
  );
}
