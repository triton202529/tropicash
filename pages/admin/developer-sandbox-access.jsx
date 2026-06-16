import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { fetchAllSandboxApplications } from "../../lib/developerSandboxApplications";
import { fetchAllSandboxAgreements } from "../../lib/developerSandboxAgreements";
import {
  activateSandboxAccess,
  createSandboxAccessRecord,
  expireSandboxAccess,
  fetchAllSandboxAccessRecords,
  revokeSandboxAccess,
  suspendSandboxAccess,
} from "../../lib/developerSandboxAccessLifecycle";

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
  background: "#f8fafc",
  color: "#0f172a",
};

const btnSm = {
  padding: "0.32rem 0.55rem",
  fontSize: "0.72rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
  marginRight: "0.35rem",
  marginBottom: "0.35rem",
};

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function lifecycleStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === "active") {
    return { background: "#ecfdf5", color: "#047857", border: "1px solid #6ee7b7" };
  }
  if (key === "suspended") {
    return { background: "#fffbeb", color: "#9a3412", border: "1px solid #fcd34d" };
  }
  if (key === "expired") {
    return { background: "#f8fafc", color: "#475569", border: "1px solid #cbd5e1" };
  }
  if (key === "revoked") {
    return { background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5" };
  }
  return { background: "#f0f9ff", color: "#0369a1", border: "1px solid #7dd3fc" };
}

function effectiveStatus(record) {
  if (!record) return "pending_activation";
  const status = String(record.status || "pending_activation");
  if (status === "active" && record.expires_at) {
    const exp = new Date(record.expires_at);
    if (!Number.isNaN(exp.getTime()) && exp.getTime() <= Date.now()) {
      return "expired";
    }
  }
  return status;
}

export default function DeveloperSandboxAccessAdminPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const isAdmin = isAdminUser(user, profile);
  const adminId = user?.id ?? null;

  const [applications, setApplications] = useState([]);
  const [agreements, setAgreements] = useState([]);
  const [accessRecords, setAccessRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actingId, setActingId] = useState(null);
  const [reasonMap, setReasonMap] = useState({});
  const [expiresMap, setExpiresMap] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [appsRes, agreementsRes, accessRes] = await Promise.all([
      fetchAllSandboxApplications(),
      fetchAllSandboxAgreements(),
      fetchAllSandboxAccessRecords(),
    ]);
    const parts = [];
    if (appsRes.error) parts.push(appsRes.error.message || "Failed to load applications.");
    if (agreementsRes.error) parts.push(agreementsRes.error.message || "Failed to load agreements.");
    if (accessRes.error) parts.push(accessRes.error.message || "Failed to load access records.");
    setError(parts.join(" "));
    setApplications(Array.isArray(appsRes.data) ? appsRes.data : []);
    setAgreements(Array.isArray(agreementsRes.data) ? agreementsRes.data : []);
    setAccessRecords(Array.isArray(accessRes.data) ? accessRes.data : []);
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

  const accessByUserId = useMemo(
    () => Object.fromEntries(accessRecords.map((r) => [r.user_id, r])),
    [accessRecords],
  );

  const agreementByUserId = useMemo(() => {
    const map = {};
    for (const row of agreements) {
      if (!map[row.user_id]) map[row.user_id] = row;
    }
    return map;
  }, [agreements]);

  const approvedDevelopers = useMemo(
    () => applications.filter((a) => a.status === "approved"),
    [applications],
  );

  const summary = useMemo(() => {
    const counts = {
      pending_activation: 0,
      active: 0,
      suspended: 0,
      expired: 0,
      revoked: 0,
    };
    for (const app of approvedDevelopers) {
      const record = accessByUserId[app.user_id];
      const status = effectiveStatus(record);
      if (counts[status] !== undefined) counts[status] += 1;
      else counts.pending_activation += 1;
    }
    return {
      total: approvedDevelopers.length,
      ...counts,
    };
  }, [approvedDevelopers, accessByUserId]);

  async function runAction(action, app, record) {
    setActionMessage("");
    if (!adminId) return;
    const key = app.user_id;
    const reason = String(reasonMap[key] || "").trim();
    if (!reason) {
      setActionMessage("All lifecycle actions require a reason.");
      return;
    }

    setActingId(key);
    let result;

    if (action === "create") {
      result = await createSandboxAccessRecord({
        user_id: app.user_id,
        application_id: app.id,
        action_by: adminId,
        action_reason: reason,
      });
    } else if (!record) {
      setActionMessage("Create an access record before other lifecycle actions.");
      setActingId(null);
      return;
    } else if (action === "activate") {
      result = await activateSandboxAccess({
        access_id: record.id,
        action_by: adminId,
        action_reason: reason,
        expires_at: expiresMap[key] || null,
      });
    } else if (action === "suspend") {
      result = await suspendSandboxAccess({
        access_id: record.id,
        action_by: adminId,
        action_reason: reason,
      });
    } else if (action === "expire") {
      result = await expireSandboxAccess({
        access_id: record.id,
        action_by: adminId,
        action_reason: reason,
      });
    } else if (action === "revoke") {
      result = await revokeSandboxAccess({
        access_id: record.id,
        action_by: adminId,
        action_reason: reason,
      });
    }

    setActingId(null);
    if (result?.error) {
      setActionMessage(result.error.message || "Lifecycle action failed.");
      return;
    }
    setActionMessage(`Action "${action}" completed successfully.`);
    setReasonMap((prev) => ({ ...prev, [key]: "" }));
    void load();
  }

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
            Applications
          </Link>
        </div>

        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.65rem", color: "#0f172a" }}>
          Developer Sandbox Access
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "#64748b", maxWidth: "820px", lineHeight: 1.5 }}>
          Lifecycle management for approved developers. Activation is explicit — approval and agreement
          alone do not enable sandbox resource creation.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          {[
            { label: "Total approved", value: summary.total },
            { label: "Active", value: summary.active },
            { label: "Pending", value: summary.pending_activation },
            { label: "Suspended", value: summary.suspended },
            { label: "Expired", value: summary.expired },
            { label: "Revoked", value: summary.revoked },
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

        {actionMessage ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", fontSize: "0.9rem" }}>
            {actionMessage}
          </div>
        ) : null}

        <div style={{ ...cardBase, overflow: "hidden" }}>
          {loading ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>Loading…</p>
          ) : approvedDevelopers.length === 0 ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>No approved developers yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Organization</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Developer</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Agreement</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Activated</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Expires</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedDevelopers.map((app) => {
                    const record = accessByUserId[app.user_id];
                    const status = effectiveStatus(record);
                    const agreement = agreementByUserId[app.user_id];
                    const busy = actingId === app.user_id;
                    const key = app.user_id;

                    return (
                      <tr key={app.id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                        <td style={{ padding: "0.75rem 1rem" }}>{app.organization_name}</td>
                        <td style={{ padding: "0.75rem 1rem" }}>
                          <div>{app.developer_name}</div>
                          <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{app.email}</div>
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
                              ...lifecycleStyle(status),
                            }}
                          >
                            {status.replace("_", " ")}
                          </span>
                          <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                            Approved {formatWhen(app.reviewed_at)}
                          </div>
                        </td>
                        <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem" }}>
                          {agreement ? (
                            <>
                              ✓ {agreement.agreement_version}
                              <div style={{ color: "#64748b" }}>{formatWhen(agreement.accepted_at)}</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                          {formatWhen(record?.activated_at)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                          {formatWhen(record?.expires_at)}
                        </td>
                        <td style={{ padding: "0.75rem 1rem", minWidth: "260px" }}>
                          <input
                            type="text"
                            placeholder="Action reason (required)"
                            value={reasonMap[key] || ""}
                            onChange={(e) =>
                              setReasonMap((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            style={{ ...inputBase, marginBottom: "0.5rem" }}
                          />
                          {!record ? (
                            <button
                              type="button"
                              disabled={busy}
                              style={btnSm}
                              onClick={() => void runAction("create", app, null)}
                            >
                              Create record
                            </button>
                          ) : null}
                          {record && status !== "active" && status !== "revoked" ? (
                            <>
                              <input
                                type="date"
                                value={expiresMap[key] || ""}
                                onChange={(e) =>
                                  setExpiresMap((prev) => ({ ...prev, [key]: e.target.value }))
                                }
                                style={{ ...inputBase, marginBottom: "0.5rem", maxWidth: "160px" }}
                                title="Optional expiration date for activation"
                              />
                              <button
                                type="button"
                                disabled={busy || !agreement}
                                style={btnSm}
                                onClick={() => void runAction("activate", app, record)}
                              >
                                Activate
                              </button>
                            </>
                          ) : null}
                          {record && status === "active" ? (
                            <button
                              type="button"
                              disabled={busy}
                              style={btnSm}
                              onClick={() => void runAction("suspend", app, record)}
                            >
                              Suspend
                            </button>
                          ) : null}
                          {record && status !== "revoked" && status !== "expired" ? (
                            <button
                              type="button"
                              disabled={busy}
                              style={btnSm}
                              onClick={() => void runAction("expire", app, record)}
                            >
                              Expire
                            </button>
                          ) : null}
                          {record && status !== "revoked" ? (
                            <button
                              type="button"
                              disabled={busy}
                              style={{ ...btnSm, borderColor: "#fca5a5", color: "#991b1b" }}
                              onClick={() => void runAction("revoke", app, record)}
                            >
                              Revoke
                            </button>
                          ) : null}
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
            supabase/sql/developer_sandbox_access_lifecycle_phase14e.sql
          </code>{" "}
          if lifecycle tables are missing.
        </p>
      </div>
    </>
  );
}
