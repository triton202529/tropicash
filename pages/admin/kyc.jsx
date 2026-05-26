import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1200px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "transparent",
  boxSizing: "border-box",
  overflowX: "auto",
};

const cardBase = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
};

const btnSm = {
  padding: "0.32rem 0.55rem",
  fontSize: "0.68rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
};

const ADMIN_STATUSES = [
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "needs_more_info", label: "Needs more info" },
];

const STATUS_COPY = {
  not_started: "Verification not started",
  submitted: "Submitted for review",
  under_review: "Under review",
  approved: "Verified",
  rejected: "Rejected",
  needs_more_info: "More information needed",
};

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusPill(status) {
  const key = String(status || "").toLowerCase();
  if (key === "approved") {
    return { background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0" };
  }
  if (key === "rejected") {
    return { background: "#fef2f2", color: "#991b1b", border: "1px solid #fca5a5" };
  }
  if (key === "needs_more_info") {
    return { background: "#fffbeb", color: "#92400e", border: "1px solid #fcd34d" };
  }
  if (key === "under_review" || key === "submitted") {
    return { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" };
  }
  return { background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0" };
}

export default function AdminKycPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [notesDraft, setNotesDraft] = useState({});

  const load = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase
      .from("kyc_profiles")
      .select(
        "id, user_id, full_legal_name, country, document_type, status, created_at, reviewed_at, review_notes, document_front_url, document_back_url, selfie_url",
      )
      .neq("status", "not_started")
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) {
      console.error("[admin/kyc]", error);
      setErrorMsg(error.message || "Could not load KYC profiles.");
      setRows([]);
      setLoading(false);
      return;
    }
    const list = Array.isArray(data) ? data : [];
    setRows(list);
    setNotesDraft(
      Object.fromEntries(list.map((r) => [r.id, r.review_notes || ""])),
    );
    setLoading(false);
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void load();
  }, [authLoading, user, profile, load]);

  const applyStatus = async (row, nextStatus) => {
    if (!row?.id || !user?.id) return;
    setBusyId(row.id);
    setErrorMsg(null);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("kyc_profiles")
      .update({
        status: nextStatus,
        review_notes: String(notesDraft[row.id] || "").trim() || null,
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq("id", row.id);
    if (error) {
      console.error("[admin/kyc] update", error);
      setErrorMsg(error.message || "Update failed.");
    }
    await load();
    setBusyId(null);
    setExpandedId(null);
  };

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
          <p style={{ color: "#64748b" }}>Sign in to view this page.</p>
          <Link href="/login" style={{ display: "inline-block", marginTop: "1rem", fontWeight: 600, color: "#0ea5e9" }}>
            Go to login
          </Link>
        </div>
      </>
    );
  }

  if (!isAdminUser(user, profile)) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Not authorized</h2>
        <p>This area is restricted to admin users.</p>
      </div>
    );
  }

  return (
    <>
      <Navbar />
      <div style={pageWrap}>
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href="/admin" style={{ color: "#38bdf8", fontWeight: 600, fontSize: "0.9rem" }}>
            ← Admin home
          </Link>
        </div>
        <h1
          style={{
            fontSize: "1.55rem",
            fontWeight: 700,
            color: "#0f172a",
            margin: "0 0 0.5rem",
            letterSpacing: "-0.02em",
          }}
        >
          KYC Review
        </h1>
        <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#64748b", maxWidth: "42rem", lineHeight: 1.55 }}>
          Review identity verification submissions. Document preview is not enabled until storage paths are populated.
        </p>

        <div style={{ ...cardBase, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <button type="button" onClick={() => void load()} disabled={loading} style={btnSm}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {errorMsg ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", background: "#fef2f2", borderColor: "#fecaca" }}>
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>{errorMsg}</p>
          </div>
        ) : null}

        <div style={{ ...cardBase, overflowX: "auto" }}>
          {loading && rows.length === 0 ? (
            <p style={{ padding: "1.5rem", color: "#64748b" }}>Loading…</p>
          ) : rows.length === 0 ? (
            <p style={{ padding: "1.5rem", color: "#64748b", margin: 0 }}>No submissions yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  {["User ID", "Legal name", "Country", "Document", "Status", "Created", "Reviewed", ""].map((h) => (
                    <th
                      key={h || "actions"}
                      style={{
                        padding: "0.65rem 0.75rem",
                        borderBottom: "1px solid #e2e8f0",
                        color: "#475569",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const busy = busyId === r.id;
                  const pill = statusPill(r.status);
                  const label = STATUS_COPY[String(r.status || "").toLowerCase()] || r.status;
                  const hasDocUrls =
                    !!(r.document_front_url || r.document_back_url || r.selfie_url);
                  const expanded = expandedId === r.id;
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.6rem 0.75rem", fontFamily: "monospace", fontSize: "0.72rem" }}>
                        {r.user_id ? `${String(r.user_id).slice(0, 8)}…` : "—"}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>{r.full_legal_name?.trim() || "—"}</td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>{r.country?.trim() || "—"}</td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>{r.document_type?.trim() || "—"}</td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "0.15rem 0.45rem",
                            borderRadius: "6px",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            ...pill,
                          }}
                        >
                          {label}
                        </span>
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }}>{formatWhen(r.created_at)}</td>
                      <td style={{ padding: "0.6rem 0.75rem", whiteSpace: "nowrap" }}>{formatWhen(r.reviewed_at)}</td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        <button
                          type="button"
                          style={btnSm}
                          disabled={busy}
                          onClick={() => setExpandedId(expanded ? null : r.id)}
                        >
                          {expanded ? "Close" : "Review"}
                        </button>
                        {hasDocUrls ? (
                          <span style={{ display: "block", marginTop: "0.25rem", fontSize: "0.68rem", color: "#94a3b8" }}>
                            Docs on file (preview N/A)
                          </span>
                        ) : null}
                        {expanded ? (
                          <div style={{ marginTop: "0.5rem", minWidth: "220px" }}>
                            <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 600, color: "#64748b" }}>
                              Review notes
                            </label>
                            <textarea
                              value={notesDraft[r.id] ?? ""}
                              onChange={(e) =>
                                setNotesDraft((prev) => ({ ...prev, [r.id]: e.target.value }))
                              }
                              rows={3}
                              style={{
                                width: "100%",
                                marginTop: "0.25rem",
                                padding: "0.4rem",
                                borderRadius: "6px",
                                border: "1px solid #cbd5e1",
                                fontSize: "0.78rem",
                                boxSizing: "border-box",
                              }}
                            />
                            <div style={{ marginTop: "0.35rem", display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                              {ADMIN_STATUSES.map((st) => (
                                <button
                                  key={st.value}
                                  type="button"
                                  disabled={busy}
                                  style={{ ...btnSm, marginTop: 0 }}
                                  onClick={() => void applyStatus(r, st.value)}
                                >
                                  {st.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
