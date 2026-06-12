import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { summarizeEvidenceRun } from "../../lib/oauthWalletTestEvidence";

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
  maxWidth: "100%",
  background: "#f4f6f9",
  color: "#0f172a",
  cursor: "pointer",
};

const inputBase = {
  ...selectBase,
  cursor: "text",
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

function statusBadgeStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === "passed") {
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
  if (key === "failed") {
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
  return {
    display: "inline-block",
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: "#f8fafc",
    color: "#64748b",
    border: "1px solid #e2e8f0",
  };
}

function userLabel(profile, userId) {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  if (profile?.email?.trim()) return profile.email.trim();
  return shortId(userId);
}

export default function OAuthWalletTestEvidenceAdminPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const isAdmin = isAdminUser(user, profile);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [runFilter, setRunFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [stepFilter, setStepFilter] = useState("all");

  const [profileMap, setProfileMap] = useState({});
  const [clientMap, setClientMap] = useState({});
  const [appMap, setAppMap] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    let query = supabase
      .from("oauth_wallet_test_evidence")
      .select(
        "id, user_id, developer_app_id, oauth_client_id, run_id, step_key, step_label, status, http_status, sanitized_result, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    if (runFilter.trim()) {
      query = query.ilike("run_id", `%${runFilter.trim()}%`);
    }
    if (stepFilter !== "all") {
      query = query.eq("step_key", stepFilter);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError.message || "Failed to load evidence.");
      setRows([]);
      setLoading(false);
      return;
    }

    let list = Array.isArray(data) ? data : [];

    if (userFilter.trim()) {
      const needle = userFilter.trim().toLowerCase();
      list = list.filter((r) => String(r.user_id || "").toLowerCase().includes(needle));
    }

    setRows(list);

    const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
    const clientIds = [...new Set(list.map((r) => r.oauth_client_id).filter(Boolean))];
    const appIds = [...new Set(list.map((r) => r.developer_app_id).filter(Boolean))];

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
  }, [statusFilter, runFilter, userFilter, stepFilter]);

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

  const runSummaries = useMemo(() => {
    const byRun = new Map();
    for (const row of rows) {
      const key = row.run_id || "—";
      if (!byRun.has(key)) byRun.set(key, []);
      byRun.get(key).push(row);
    }
    return Array.from(byRun.entries())
      .map(([runId, runRows]) => ({
        runId,
        summary: summarizeEvidenceRun(runRows),
        latest: runRows[0]?.created_at,
        userId: runRows[0]?.user_id,
      }))
      .slice(0, 20);
  }, [rows]);

  const stepOptions = useMemo(() => {
    const keys = new Set(rows.map((r) => r.step_key).filter(Boolean));
    return Array.from(keys).sort();
  }, [rows]);

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
            href="/admin/oauth-wallet-certification"
            style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.9rem" }}
          >
            Certification
          </Link>
        </div>

        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.65rem", color: "#0f172a" }}>
          OAuth Wallet Test Evidence
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "#64748b", maxWidth: "760px", lineHeight: 1.5 }}>
          Read-only view of sanitized OAuth wallet sandbox harness results. Secrets, tokens,
          authorization codes, and wallet balances are never stored or displayed.
        </p>

        <div style={{ ...cardBase, padding: "1.25rem", marginBottom: "1.25rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
            }}
          >
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Status</label>
              <select
                className="tc-admin-in mt-1"
                style={selectBase}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="skipped">Skipped</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Run ID</label>
              <input
                className="tc-admin-in mt-1"
                style={inputBase}
                value={runFilter}
                onChange={(e) => setRunFilter(e.target.value)}
                placeholder="owt_…"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">User ID</label>
              <input
                className="tc-admin-in mt-1"
                style={inputBase}
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="uuid prefix"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-slate-500">Step</label>
              <select
                className="tc-admin-in mt-1"
                style={selectBase}
                value={stepFilter}
                onChange={(e) => setStepFilter(e.target.value)}
              >
                <option value="all">All</option>
                {stepOptions.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {runSummaries.length ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1.25rem" }}>
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "#0f172a" }}>
              Recent test runs
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {runSummaries.map((r) => (
                <span
                  key={r.runId}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    padding: "0.35rem 0.65rem",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    fontSize: "0.75rem",
                    color: "#334155",
                  }}
                >
                  <span>
                    <strong>{shortId(r.runId)}</strong> — {r.summary.passed}P / {r.summary.failed}F /{" "}
                    {r.summary.skipped}S
                  </span>
                  <Link
                    href={`/admin/oauth-wallet-certification?run_id=${encodeURIComponent(r.runId)}`}
                    style={{
                      color: "#0ea5e9",
                      fontWeight: 600,
                      fontSize: "0.72rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Evaluate run
                  </Link>
                </span>
              ))}
            </div>
          </div>
        ) : null}

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
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>Loading evidence…</p>
          ) : rows.length === 0 ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>No evidence rows match.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Run ID</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>User</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>App</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Client</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Step</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>HTTP</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Created</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const client = clientMap[row.oauth_client_id];
                    const app = appMap[row.developer_app_id];
                    const uProfile = profileMap[row.user_id];
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.75rem" }}>
                          {shortId(row.run_id)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          {userLabel(uProfile, row.user_id)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          {app?.app_name || shortId(row.developer_app_id)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          {client?.client_id || shortId(row.oauth_client_id)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <div style={{ fontWeight: 600 }}>{row.step_label}</div>
                          <div style={{ fontSize: "0.72rem", color: "#94a3b8" }}>{row.step_key}</div>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span style={statusBadgeStyle(row.status)}>{row.status}</span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>{row.http_status ?? "—"}</td>
                        <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                          {formatWhen(row.created_at)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <Link
                            href={`/admin/oauth-wallet-certification?run_id=${encodeURIComponent(row.run_id)}`}
                            style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.8rem" }}
                          >
                            Evaluate run
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
          Sanitized result payloads are stored server-side and are not expanded here to avoid
          accidental display of sensitive fields. Admin view is read-only.
        </p>
      </div>
    </>
  );
}
