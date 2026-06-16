import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { fetchAllSandboxApplications } from "../../lib/developerSandboxApplications";
import {
  fetchAllSandboxActivity,
  fetchAllSandboxRiskCases,
  getSandboxMonitoringOverview,
  SANDBOX_ACTIVITY_TYPES,
  SANDBOX_RISK_SEVERITIES,
} from "../../lib/developerSandboxMonitoring";

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

const inputBase = {
  padding: "0.55rem 0.75rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "0.85rem",
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "200px",
  background: "#f8fafc",
  color: "#0f172a",
};

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function severityStyle(severity) {
  const key = String(severity || "").toUpperCase();
  if (key === "CRITICAL") return { background: "#450a0a", color: "#fecaca", border: "1px solid #991b1b" };
  if (key === "HIGH") return { background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5" };
  if (key === "MEDIUM") return { background: "#fffbeb", color: "#9a3412", border: "1px solid #fcd34d" };
  return { background: "#f0f9ff", color: "#0369a1", border: "1px solid #7dd3fc" };
}

function activityLabel(type) {
  return String(type || "").replace(/_/g, " ");
}

export default function DeveloperSandboxMonitoringAdminPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const isAdmin = isAdminUser(user, profile);

  const [overview, setOverview] = useState(null);
  const [activities, setActivities] = useState([]);
  const [riskCases, setRiskCases] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [developerQuery, setDeveloperQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const since = dateFrom ? `${dateFrom}T00:00:00.000Z` : undefined;
    const until = dateTo ? `${dateTo}T23:59:59.999Z` : undefined;

    const [overviewData, activityRes, riskRes, appsRes] = await Promise.all([
      getSandboxMonitoringOverview(),
      fetchAllSandboxActivity({
        since,
        until,
        activity_type: activityFilter !== "all" ? activityFilter : undefined,
        limit: 500,
      }),
      fetchAllSandboxRiskCases({
        severity: severityFilter !== "all" ? severityFilter : undefined,
        limit: 200,
      }),
      fetchAllSandboxApplications(),
    ]);

    const parts = [];
    if (activityRes.error) parts.push(activityRes.error.message || "Failed to load activity.");
    if (riskRes.error) parts.push(riskRes.error.message || "Failed to load risk cases.");
    setError(parts.join(" "));
    setOverview(overviewData);
    setActivities(Array.isArray(activityRes.data) ? activityRes.data : []);
    setRiskCases(Array.isArray(riskRes.data) ? riskRes.data : []);
    setApplications(Array.isArray(appsRes.data) ? appsRes.data : []);
    setLoading(false);
  }, [dateFrom, dateTo, activityFilter, severityFilter]);

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

  const appById = useMemo(
    () => Object.fromEntries(applications.map((a) => [a.id, a])),
    [applications],
  );

  const devByUserId = useMemo(() => {
    const map = {};
    for (const app of applications) {
      if (!map[app.user_id]) map[app.user_id] = app;
    }
    return map;
  }, [applications]);

  const filteredActivity = useMemo(() => {
    const q = developerQuery.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter((row) => {
      const app = row.developer_app_id ? appById[row.developer_app_id] : null;
      const dev = devByUserId[row.user_id];
      const haystack = [
        dev?.developer_name,
        dev?.organization_name,
        dev?.email,
        app?.app_name,
        row.user_id,
        row.activity_type,
        row.resource,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [activities, developerQuery, appById, devByUserId]);

  const filteredRisk = useMemo(() => {
    const q = developerQuery.trim().toLowerCase();
    if (!q) return riskCases;
    return riskCases.filter((row) => {
      const dev = devByUserId[row.user_id];
      const haystack = [dev?.developer_name, dev?.organization_name, dev?.email, row.reason, row.severity]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [riskCases, developerQuery, devByUserId]);

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
            href="/admin/developer-sandbox-access"
            style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.9rem" }}
          >
            Sandbox access
          </Link>
        </div>

        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.65rem", color: "#0f172a" }}>
          Developer Sandbox Monitoring
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "#64748b", maxWidth: "820px", lineHeight: 1.5 }}>
          Operational visibility into sandbox usage and risk review cases. Read-only — no enforcement
          actions in this phase.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          {[
            { label: "Active developers", value: overview?.activeDevelopers ?? "—" },
            { label: "Tracked developers", value: overview?.trackedDevelopers ?? "—" },
            { label: "Sandbox apps", value: overview?.sandboxApplications ?? "—" },
            { label: "Activity events", value: overview?.totalActivityEvents ?? "—" },
            { label: "OAuth activity", value: overview?.oauthActivityEvents ?? "—" },
            { label: "API activity", value: overview?.apiActivityEvents ?? "—" },
            { label: "Open risk cases", value: overview?.openRiskCases ?? "—" },
          ].map((item) => (
            <div key={item.label} style={{ ...cardBase, padding: "1rem" }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                {item.label}
              </div>
              <div style={{ marginTop: "0.35rem", fontSize: "1.5rem", fontWeight: 700, color: "#0f172a" }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...cardBase, padding: "1.25rem", marginBottom: "1.25rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: "0.75rem",
              alignItems: "end",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>
                From date
              </label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={{ ...inputBase, marginTop: "0.35rem" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>
                To date
              </label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={{ ...inputBase, marginTop: "0.35rem" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>
                Activity type
              </label>
              <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} style={{ ...inputBase, marginTop: "0.35rem", cursor: "pointer" }}>
                <option value="all">All types</option>
                {SANDBOX_ACTIVITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {activityLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>
                Severity
              </label>
              <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={{ ...inputBase, marginTop: "0.35rem", cursor: "pointer" }}>
                <option value="all">All severities</option>
                {SANDBOX_RISK_SEVERITIES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#64748b" }}>
                Developer search
              </label>
              <input
                type="search"
                value={developerQuery}
                onChange={(e) => setDeveloperQuery(e.target.value)}
                placeholder="Name, org, email…"
                style={{ ...inputBase, marginTop: "0.35rem", maxWidth: "240px" }}
              />
            </div>
          </div>
        </div>

        {error ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", borderColor: "#fecaca", background: "#fef2f2", color: "#991b1b" }}>
            {error}
          </div>
        ) : null}

        <div style={{ ...cardBase, overflow: "hidden", marginBottom: "1.25rem" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e2e8f0" }}>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>Risk queue</h2>
          </div>
          {loading ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>Loading…</p>
          ) : filteredRisk.length === 0 ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>No risk cases match filters.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Severity</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Reason</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Developer</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRisk.map((row) => {
                    const dev = devByUserId[row.user_id];
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "0.2rem 0.55rem",
                              borderRadius: "999px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              ...severityStyle(row.severity),
                            }}
                          >
                            {row.severity}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>{row.reason}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <div>{dev?.developer_name || "—"}</div>
                          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{dev?.organization_name || row.user_id}</div>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>{row.status}</td>
                        <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{formatWhen(row.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ ...cardBase, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e2e8f0" }}>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>Activity feed</h2>
          </div>
          {loading ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>Loading…</p>
          ) : filteredActivity.length === 0 ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>No activity matches filters.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Timestamp</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Developer</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Application</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Event</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Resource</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivity.map((row) => {
                    const dev = devByUserId[row.user_id];
                    const app = row.developer_app_id ? appById[row.developer_app_id] : null;
                    return (
                      <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>{formatWhen(row.created_at)}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <div>{dev?.developer_name || "—"}</div>
                          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{dev?.email || row.user_id}</div>
                        </td>
                        <td style={{ padding: "0.75rem 1rem" }}>{app?.organization_name || app?.app_name || "—"}</td>
                        <td style={{ padding: "0.75rem 1rem", fontFamily: "monospace", fontSize: "0.78rem" }}>
                          {row.activity_type}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem", color: "#64748b" }}>
                          {row.resource || "—"}
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
          Run{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            supabase/sql/developer_sandbox_monitoring_phase14f.sql
          </code>{" "}
          if monitoring tables are missing.
        </p>
      </div>
    </>
  );
}
