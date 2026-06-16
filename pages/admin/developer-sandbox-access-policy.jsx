import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { fetchAllSandboxApplications, getCapabilityLabel } from "../../lib/developerSandboxApplications";
import { HARD_BLOCKED_CAPABILITIES } from "../../lib/developerSandboxAccessPolicy";

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

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === "approved") {
    return { background: "#ecfdf5", color: "#047857", border: "1px solid #6ee7b7" };
  }
  if (key === "rejected") {
    return { background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5" };
  }
  if (key === "under_review") {
    return { background: "#f0f9ff", color: "#0369a1", border: "1px solid #7dd3fc" };
  }
  return { background: "#fffbeb", color: "#9a3412", border: "1px solid #fcd34d" };
}

export default function DeveloperSandboxAccessPolicyAdminPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const isAdmin = isAdminUser(user, profile);

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: fetchError } = await fetchAllSandboxApplications();
    if (fetchError) {
      setError(fetchError.message || "Failed to load applications.");
      setApplications([]);
    } else {
      setApplications(Array.isArray(data) ? data : []);
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

  const summary = useMemo(() => {
    const counts = { pending: 0, under_review: 0, approved: 0, rejected: 0 };
    const capabilityCounts = {};
    for (const app of applications) {
      const s = String(app.status || "").toLowerCase();
      if (counts[s] !== undefined) counts[s] += 1;
      if (s === "approved" && Array.isArray(app.requested_capabilities)) {
        for (const cap of app.requested_capabilities) {
          capabilityCounts[cap] = (capabilityCounts[cap] || 0) + 1;
        }
      }
    }
    return {
      total: applications.length,
      ...counts,
      approvedDevelopers: counts.approved,
      capabilityCounts,
    };
  }, [applications]);

  const sortedApplications = useMemo(
    () =>
      [...applications].sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      }),
    [applications],
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
          {" · "}
          <Link
            href="/admin/developer-sandbox-applications"
            style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.9rem" }}
          >
            Review applications
          </Link>
        </div>

        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.65rem", color: "#0f172a" }}>
          Developer Sandbox Access Policy
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "#64748b", maxWidth: "820px", lineHeight: 1.5 }}>
          Read-only visibility into sandbox approval distribution and capability enforcement.
          Approval actions are performed on the applications review page.
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
            { label: "Total", value: summary.total },
            { label: "Approved", value: summary.approved },
            { label: "Pending", value: summary.pending },
            { label: "Under review", value: summary.under_review },
            { label: "Rejected", value: summary.rejected },
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
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1rem", color: "#0f172a" }}>
            Capability distribution (approved)
          </h2>
          {Object.keys(summary.capabilityCounts).length ? (
            <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.85rem", color: "#475569" }}>
              {Object.entries(summary.capabilityCounts).map(([cap, count]) => (
                <li key={cap}>
                  {getCapabilityLabel(cap)} — {count}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>No approved capabilities yet.</p>
          )}
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.8rem", color: "#94a3b8" }}>
            Hard-blocked (never issued): {HARD_BLOCKED_CAPABILITIES.join(", ")}
          </p>
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
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid #e2e8f0" }}>
            <h2 style={{ margin: 0, fontSize: "1rem", color: "#0f172a" }}>Developers</h2>
          </div>
          {loading ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>Loading…</p>
          ) : sortedApplications.length === 0 ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>No sandbox applications yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Organization</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Developer</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Capabilities</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Approved at</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedApplications.map((row) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.75rem 1rem" }}>{row.organization_name}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div>{row.developer_name}</div>
                        <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{row.email}</div>
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.2rem 0.55rem",
                            borderRadius: "999px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            ...statusStyle(row.status),
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem" }}>
                        {row.status === "approved"
                          ? (row.requested_capabilities || []).map((c) => (
                              <div key={c}>{getCapabilityLabel(c)}</div>
                            ))
                          : "—"}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                        {row.status === "approved" ? formatWhen(row.reviewed_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#94a3b8" }}>
          Enforcement module:{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">lib/developerSandboxAccessPolicy.js</code>
        </p>
      </div>
    </>
  );
}
