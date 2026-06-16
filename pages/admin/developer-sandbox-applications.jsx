import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import {
  fetchAllSandboxApplications,
  getCapabilityLabel,
  updateSandboxApplicationStatus,
} from "../../lib/developerSandboxApplications";

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

export default function DeveloperSandboxApplicationsAdminPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const isAdmin = isAdminUser(user, profile);

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [notesMap, setNotesMap] = useState({});
  const [actingId, setActingId] = useState(null);

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

  const filtered = useMemo(() => {
    if (statusFilter === "all") return applications;
    return applications.filter((a) => a.status === statusFilter);
  }, [applications, statusFilter]);

  async function handleStatusUpdate(appId, status) {
    if (!user?.id) return;
    setActingId(appId);
    setError("");
    const { error: updateError } = await updateSandboxApplicationStatus({
      id: appId,
      status,
      reviewed_by: user.id,
      review_notes: notesMap[appId] || null,
    });
    setActingId(null);
    if (updateError) {
      setError(updateError.message || "Failed to update application.");
      return;
    }
    await load();
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
        </div>

        <h1 style={{ margin: "0 0 0.35rem", fontSize: "1.65rem", color: "#0f172a" }}>
          Developer Sandbox Applications
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "#64748b", maxWidth: "760px", lineHeight: 1.5 }}>
          Review external developer sandbox access requests. Approval is governance only — no
          automatic API credentials, OAuth clients, or wallet access.
        </p>

        <div
          style={{
            ...cardBase,
            padding: "1rem",
            marginBottom: "1.25rem",
            borderColor: "#c4b5fd",
            background: "#f5f3ff",
          }}
        >
          <strong style={{ color: "#5b21b6" }}>Sandbox governance only</strong>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "#4c1d95" }}>
            Approving an application records authorization. Developers must separately create
            sandbox credentials in the Developer Console.
          </p>
        </div>

        <div style={{ ...cardBase, padding: "1rem", marginBottom: "1.25rem" }}>
          <label className="text-xs font-semibold uppercase text-slate-500">Status filter</label>
          <select
            className="tc-admin-in mt-1"
            style={selectBase}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="under_review">Under review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
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
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>Loading applications…</p>
          ) : filtered.length === 0 ? (
            <p style={{ padding: "1.25rem", color: "#64748b", margin: 0 }}>No applications match.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Applicant</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Organization</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Country</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Capabilities</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Submitted</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Status</th>
                    <th style={{ textAlign: "left", padding: "0.75rem 1rem" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                      <td style={{ padding: "0.75rem 1rem" }}>
                        <div style={{ fontWeight: 600 }}>{row.developer_name}</div>
                        <div style={{ fontSize: "0.78rem", color: "#64748b" }}>{row.email}</div>
                      </td>
                      <td style={{ padding: "0.75rem 1rem" }}>{row.organization_name}</td>
                      <td style={{ padding: "0.75rem 1rem" }}>{row.country}</td>
                      <td style={{ padding: "0.75rem 1rem", fontSize: "0.78rem" }}>
                        {(row.requested_capabilities || []).map((c) => (
                          <div key={c}>{getCapabilityLabel(c)}</div>
                        ))}
                      </td>
                      <td style={{ padding: "0.75rem 1rem", color: "#475569" }}>
                        {formatWhen(row.created_at)}
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
                      <td style={{ padding: "0.75rem 1rem", minWidth: "220px" }}>
                        <textarea
                          className="tc-admin-in"
                          placeholder="Review notes (optional)"
                          rows={2}
                          style={{
                            width: "100%",
                            marginBottom: "0.5rem",
                            fontSize: "0.78rem",
                            padding: "0.4rem",
                            borderRadius: "8px",
                            border: "1px solid #e2e8f0",
                          }}
                          value={notesMap[row.id] ?? row.review_notes ?? ""}
                          onChange={(e) =>
                            setNotesMap((m) => ({ ...m, [row.id]: e.target.value }))
                          }
                        />
                        <div>
                          <button
                            type="button"
                            style={btnSm}
                            disabled={actingId === row.id}
                            onClick={() => void handleStatusUpdate(row.id, "under_review")}
                          >
                            Under review
                          </button>
                          <button
                            type="button"
                            style={{ ...btnSm, color: "#047857" }}
                            disabled={actingId === row.id}
                            onClick={() => void handleStatusUpdate(row.id, "approved")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            style={{ ...btnSm, color: "#991b1b" }}
                            disabled={actingId === row.id}
                            onClick={() => void handleStatusUpdate(row.id, "rejected")}
                          >
                            Reject
                          </button>
                        </div>
                        {row.reviewed_at ? (
                          <p style={{ margin: "0.5rem 0 0", fontSize: "0.72rem", color: "#94a3b8" }}>
                            Reviewed {formatWhen(row.reviewed_at)}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "#94a3b8" }}>
          Docs:{" "}
          <code className="rounded bg-slate-100 px-1 text-xs">
            docs/developer/DEVELOPER_SANDBOX_APPROVAL_WORKFLOW.md
          </code>
        </p>
      </div>
    </>
  );
}
