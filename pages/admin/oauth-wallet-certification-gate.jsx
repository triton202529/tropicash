import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import {
  CERTIFICATION_GATE_STATUSES,
  getCertificationGateSummary,
  summarizeCertificationGateRows,
} from "../../lib/oauthWalletCertificationGate";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1400px",
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

const selectBase = {
  padding: "0.65rem 0.8rem",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "220px",
  background: "#f4f6f9",
  color: "#0f172a",
  cursor: "pointer",
};

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortId(id) {
  if (!id) return "—";
  const s = String(id);
  return s.length > 14 ? `${s.slice(0, 10)}…` : s;
}

function gateStatusStyle(gateStatus) {
  const tone = CERTIFICATION_GATE_STATUSES[gateStatus]?.tone || "info";
  if (tone === "ready") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
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
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
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
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fffbeb",
      color: "#9a3412",
      border: "1px solid #fcd34d",
    };
  }
  return {
    display: "inline-block",
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: "#f0f9ff",
    color: "#0369a1",
    border: "1px solid #7dd3fc",
  };
}

function certStatusStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === "certified") {
    return { color: "#047857", fontWeight: 600 };
  }
  if (key === "failed") {
    return { color: "#991b1b", fontWeight: 600 };
  }
  if (key === "incomplete") {
    return { color: "#9a3412", fontWeight: 600 };
  }
  return { color: "#64748b", fontWeight: 600 };
}

export default function OAuthWalletCertificationGateAdminPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const isAdmin = isAdminUser(user, profile);

  const [certifications, setCertifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gateFilter, setGateFilter] = useState("all");

  const [profileMap, setProfileMap] = useState({});
  const [clientMap, setClientMap] = useState({});
  const [appMap, setAppMap] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: fetchError } = await supabase
      .from("oauth_wallet_test_certifications")
      .select(
        "id, run_id, user_id, status, passed_count, failed_count, skipped_count, leak_detected, summary, certified_at",
      )
      .order("certified_at", { ascending: false })
      .limit(100);

    if (fetchError) {
      setError(fetchError.message || "Failed to load certifications.");
      setCertifications([]);
      setLoading(false);
      return;
    }

    const list = Array.isArray(data) ? data : [];
    setCertifications(list);

    const userIds = [...new Set(list.map((c) => c.user_id).filter(Boolean))];
    const clientIds = [
      ...new Set(
        list
          .map((c) => c.summary?.oauth_client_id)
          .filter(Boolean),
      ),
    ];
    const appIds = [
      ...new Set(
        list
          .map((c) => c.summary?.developer_app_id)
          .filter(Boolean),
      ),
    ];

    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const map = {};
      for (const p of profiles || []) map[p.id] = p;
      setProfileMap(map);
    } else {
      setProfileMap({});
    }

    if (clientIds.length) {
      const { data: clients } = await supabase
        .from("oauth_clients")
        .select("id, client_id, client_name")
        .in("id", clientIds);
      const map = {};
      for (const c of clients || []) map[c.id] = c;
      setClientMap(map);
    } else {
      setClientMap({});
    }

    if (appIds.length) {
      const { data: apps } = await supabase
        .from("developer_apps")
        .select("id, app_name")
        .in("id", appIds);
      const map = {};
      for (const a of apps || []) map[a.id] = a;
      setAppMap(map);
    } else {
      setAppMap({});
    }

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

  const gateRows = useMemo(() => summarizeCertificationGateRows(certifications), [certifications]);

  const filteredRows = useMemo(() => {
    if (gateFilter === "all") return gateRows;
    return gateRows.filter((r) => r.gateStatus === gateFilter);
  }, [gateRows, gateFilter]);

  const summary = useMemo(() => getCertificationGateSummary(certifications), [certifications]);

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
          {" · "}
          <Link
            href="/admin/oauth-wallet-test-evidence"
            style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.9rem" }}
          >
            Evidence
          </Link>
          {" · "}
          <Link
            href="/admin/oauth-wallet-certification"
            style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.9rem" }}
          >
            Certification
          </Link>
        </div>

        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.65rem", color: "#0f172a" }}>
          OAuth Wallet Certification Gate
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "#64748b", maxWidth: "820px", lineHeight: 1.5 }}>
          Read-only gate view mapping Phase 13C certification outcomes to developer wallet-read
          sandbox progression. Does not grant production approval, mutate wallets, or expose tokens
          or balances.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          {[
            { label: "Runs", value: summary.totalRuns, color: "#0f172a" },
            { label: "Certified", value: summary.certified, color: "#047857" },
            { label: "Failed", value: summary.failed, color: "#991b1b" },
            { label: "Incomplete", value: summary.incomplete, color: "#9a3412" },
            { label: "Clients tracked", value: summary.latestPerClient, color: "#0369a1" },
          ].map((item) => (
            <div key={item.label} style={{ ...cardBase, padding: "1rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                {item.label}
              </div>
              <div style={{ marginTop: "0.35rem", fontSize: "1.5rem", fontWeight: 700, color: item.color }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...cardBase, padding: "1rem", marginBottom: "1.25rem" }}>
          <label className="text-xs font-semibold uppercase text-slate-500">Gate status filter</label>
          <select
            className="tc-admin-in mt-1"
            style={selectBase}
            value={gateFilter}
            onChange={(e) => setGateFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="CERTIFIED">Certified</option>
            <option value="FAILED">Failed</option>
            <option value="INCOMPLETE">Incomplete</option>
            <option value="NOT_EVALUATED">Not evaluated</option>
          </select>
        </div>

        <div style={{ ...cardBase, padding: "1rem", marginBottom: "1.25rem", background: "#f8fafc" }}>
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem", color: "#0f172a" }}>
            Progression rules
          </h2>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", color: "#475569", lineHeight: 1.6 }}>
            <li>
              <strong>CERTIFIED</strong> — latest certification status = <code>certified</code>
            </li>
            <li>
              <strong>FAILED</strong> — latest certification status = <code>failed</code>
            </li>
            <li>
              <strong>INCOMPLETE</strong> — latest certification status = <code>incomplete</code>
            </li>
            <li>
              <strong>NOT_EVALUATED</strong> — no certification record exists
            </li>
          </ul>
        </div>

        {error ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem",
              marginBottom: "1rem",
              borderColor: "#fecaca",
              background: "#fef2f2",
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ ...cardBase, overflow: "hidden" }}>
          {loading ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>Loading gate data…</p>
          ) : filteredRows.length === 0 ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>
              No certification results match this filter.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Run ID</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>App</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Client</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Cert status</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Gate</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Progression</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Certified at</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Links</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const client = clientMap[row.oauth_client_id];
                    const app = appMap[row.developer_app_id];
                    return (
                      <tr key={row.id || row.run_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem" }}>
                          {shortId(row.run_id)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          {app?.app_name || shortId(row.developer_app_id)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          {client?.client_id || client?.client_name || shortId(row.oauth_client_id)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={certStatusStyle(row.certificationStatus)}>
                            {row.certificationStatus || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={gateStatusStyle(row.gateStatus)}>{row.gateStatus}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: row.allowsProgression ? "#047857" : "#64748b" }}>
                          {row.allowsProgression ? "Allowed" : "Blocked"}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                          {formatWhen(row.certified_at)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                          <Link
                            href={`/admin/oauth-wallet-test-evidence?run_id=${encodeURIComponent(row.run_id || "")}`}
                            style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.78rem", marginRight: "0.5rem" }}
                          >
                            Evidence
                          </Link>
                          <Link
                            href={`/admin/oauth-wallet-certification?run_id=${encodeURIComponent(row.run_id || "")}`}
                            style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.78rem" }}
                          >
                            Certification
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#94a3b8" }}>
          Gate module: <code className="rounded bg-slate-100 px-1 text-xs">lib/oauthWalletCertificationGate.js</code>
          {" · "}
          SQL views: <code className="rounded bg-slate-100 px-1 text-xs">oauth_wallet_certification_gate_phase13d.sql</code>
        </p>
      </div>
    </>
  );
}
