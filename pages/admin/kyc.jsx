import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isAdminUser } from "../../lib/adminAccess";
import {
  createAdminKycDocumentSignedUrl,
  fetchAdminKycProfiles,
  fetchKycReviewEvents,
  updateKycReviewStatus,
} from "../../lib/kyc";
import { buildKycRiskProfileFromStatus, fetchKycLimitPolicyForStatus, summarizeKycLimitPolicy } from "../../lib/kycRisk";
import { useUser } from "../../lib/userContext";
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

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "needs_more_info", label: "Needs more info" },
];

const REVIEW_ACTIONS = [
  { value: "under_review", label: "Mark Under Review", requiresNotes: false },
  { value: "approved", label: "Approve", requiresNotes: false },
  { value: "rejected", label: "Reject", requiresNotes: true },
  { value: "needs_more_info", label: "Request More Info", requiresNotes: true },
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

function formatDateOnly(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString(undefined, { dateStyle: "medium" });
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

function formatAddress(row) {
  if (!row) return "—";
  const parts = [
    row.address_line1,
    row.address_line2,
    [row.city, row.state_region].filter(Boolean).join(", "),
    row.postal_code,
  ].filter((p) => String(p || "").trim());
  return parts.length ? parts.join(" · ") : "—";
}

function DetailRow({ label, value, mono }) {
  return (
    <div style={{ marginBottom: "0.55rem" }}>
      <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>{label}</div>
      <div
        style={{
          fontSize: "0.82rem",
          color: "#0f172a",
          marginTop: "0.15rem",
          wordBreak: "break-word",
          fontFamily: mono ? "monospace" : "inherit",
        }}
      >
        {value || "—"}
      </div>
    </div>
  );
}

export default function AdminKycPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [docViewBusy, setDocViewBusy] = useState(null);
  const [docViewError, setDocViewError] = useState(null);
  const [reviewHistory, setReviewHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [auditUnavailable, setAuditUnavailable] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState(null);

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId],
  );

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => String(r.status || "").toLowerCase() === statusFilter);
  }, [rows, statusFilter]);

  const load = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await fetchAdminKycProfiles();
    if (error) {
      console.error("[admin/kyc]", error);
      setErrorMsg(error.message || "Could not load KYC profiles.");
      setRows([]);
      setLoading(false);
      return;
    }
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [user?.id, user, profile]);

  const loadReviewHistory = useCallback(async (kycProfileId) => {
    if (!kycProfileId) {
      setReviewHistory([]);
      return;
    }
    setHistoryLoading(true);
    const { data, error, auditUnavailable: unavailable } = await fetchKycReviewEvents(kycProfileId);
    if (error) {
      console.error("[admin/kyc] history", error);
      setReviewHistory([]);
    } else {
      setReviewHistory(data);
    }
    setAuditUnavailable(!!unavailable);
    setHistoryLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void load();
  }, [authLoading, user, profile, load]);

  useEffect(() => {
    if (!selectedRow?.status) {
      setSelectedPolicy(null);
      return;
    }
    void fetchKycLimitPolicyForStatus(selectedRow.status).then(({ data }) => setSelectedPolicy(data || null));
  }, [selectedRow?.status]);

  useEffect(() => {
    if (!selectedRow) {
      setNotesDraft("");
      setReviewHistory([]);
      return;
    }
    setNotesDraft(selectedRow.review_notes || "");
    void loadReviewHistory(selectedRow.id);
  }, [selectedRow, loadReviewHistory]);

  const openDocument = async (rowId, storagePath, label) => {
    if (!storagePath) return;
    const busyKey = `${rowId}:${label}`;
    setDocViewBusy(busyKey);
    setDocViewError(null);
    const { signedUrl, error } = await createAdminKycDocumentSignedUrl(storagePath);
    if (error || !signedUrl) {
      console.error("[admin/kyc] signed url", error);
      setDocViewError(error?.message || `Could not open ${label}.`);
      setDocViewBusy(null);
      return;
    }
    window.open(signedUrl, "_blank", "noopener,noreferrer");
    setDocViewBusy(null);
  };

  const applyStatus = async (nextStatus, requiresNotes) => {
    if (!selectedRow?.id || !user?.id) return;
    const trimmedNotes = String(notesDraft || "").trim();
    if (requiresNotes && !trimmedNotes) {
      setErrorMsg("Review notes are required for this action.");
      return;
    }
    setReviewBusy(true);
    setErrorMsg(null);
    const { error, auditUnavailable: unavailable } = await updateKycReviewStatus({
      kycProfileId: selectedRow.id,
      userId: selectedRow.user_id,
      status: nextStatus,
      reviewNotes: trimmedNotes,
      reviewedBy: user.id,
      previousStatus: selectedRow.status,
    });
    if (error) {
      console.error("[admin/kyc] update", error);
      setErrorMsg(error.message || "Update failed.");
      setReviewBusy(false);
      return;
    }
    if (unavailable) {
      setAuditUnavailable(true);
    }
    await load();
    await loadReviewHistory(selectedRow.id);
    setReviewBusy(false);
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
          Review identity verification submissions. Status changes are recorded in an append-only audit log. Documents
          open via short-lived signed URLs only.
        </p>

        <div
          style={{
            ...cardBase,
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <button type="button" onClick={() => void load()} disabled={loading} style={btnSm}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginLeft: "0.25rem" }}>Filter:</span>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                style={{
                  ...btnSm,
                  background: active ? "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)" : btnSm.background,
                  borderColor: active ? "#93c5fd" : btnSm.border,
                  color: active ? "#1d4ed8" : btnSm.color,
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {docViewError ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", background: "#fef2f2", borderColor: "#fecaca" }}>
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>{docViewError}</p>
          </div>
        ) : null}

        {errorMsg ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", background: "#fef2f2", borderColor: "#fecaca" }}>
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>{errorMsg}</p>
          </div>
        ) : null}

        <div style={{ ...cardBase, overflowX: "auto" }}>
          {loading && rows.length === 0 ? (
            <p style={{ padding: "1.5rem", color: "#64748b" }}>Loading…</p>
          ) : filteredRows.length === 0 ? (
            <p style={{ padding: "1.5rem", color: "#64748b", margin: 0 }}>
              {rows.length === 0 ? "No submissions yet." : "No profiles match this filter."}
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  {["User ID", "Legal name", "Country", "Document", "Status", "Submitted", "Reviewed", ""].map((h) => (
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
                {filteredRows.map((r) => {
                  const pill = statusPill(r.status);
                  const label = STATUS_COPY[String(r.status || "").toLowerCase()] || r.status;
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
                        <button type="button" style={btnSm} onClick={() => setSelectedId(r.id)}>
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedRow ? (
        <>
          <button
            type="button"
            aria-label="Close review panel"
            onClick={() => setSelectedId(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(15, 23, 42, 0.35)",
              border: "none",
              cursor: "pointer",
              zIndex: 40,
            }}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="kyc-review-drawer-title"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              width: "min(420px, 100vw)",
              height: "100vh",
              background: "#fff",
              borderLeft: "1px solid #e2e8f0",
              boxShadow: "-8px 0 30px rgba(15, 23, 42, 0.12)",
              zIndex: 41,
              overflowY: "auto",
              padding: "1.25rem 1.1rem 2rem",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
              <div>
                <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                  KYC profile
                </p>
                <h2 id="kyc-review-drawer-title" style={{ margin: "0.35rem 0 0", fontSize: "1.05rem", color: "#0f172a" }}>
                  {selectedRow.full_legal_name?.trim() || "Unnamed submission"}
                </h2>
              </div>
              <button type="button" style={btnSm} onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <span
                style={{
                  display: "inline-block",
                  padding: "0.2rem 0.5rem",
                  borderRadius: "6px",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  ...statusPill(selectedRow.status),
                }}
              >
                {STATUS_COPY[String(selectedRow.status || "").toLowerCase()] || selectedRow.status}
              </span>
            </div>

            {(() => {
              const risk = buildKycRiskProfileFromStatus(selectedRow.status);
              const policy = summarizeKycLimitPolicy(selectedPolicy || selectedRow.status);
              return (
                <div
                  style={{
                    marginTop: "0.85rem",
                    padding: "0.75rem",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    fontSize: "0.78rem",
                  }}
                >
                  <p style={{ margin: "0 0 0.45rem", fontWeight: 700, color: "#334155" }}>KYC limit policy (informational)</p>
                  <p style={{ margin: "0 0 0.25rem", color: "#64748b" }}>
                    Tier: <strong style={{ color: "#0f172a" }}>{risk.verificationTier}</strong> · Risk:{" "}
                    <strong style={{ color: "#0f172a" }}>{risk.riskLevel}</strong> · Mode:{" "}
                    <strong style={{ color: "#0f172a" }}>{policy.enforcementMode}</strong>
                  </p>
                  <p style={{ margin: "0 0 0.25rem", color: "#64748b" }}>
                    Policy daily limits — fund ${policy.fundingDaily.toLocaleString()}, send $
                    {policy.sendDaily.toLocaleString()}, withdraw ${policy.withdrawalDaily.toLocaleString()}
                  </p>
                  {risk.warnings.length ? (
                    <p style={{ margin: "0.35rem 0 0", color: "#92400e", lineHeight: 1.45 }}>{risk.warnings[0]}</p>
                  ) : null}
                  <p style={{ margin: "0.35rem 0 0", fontSize: "0.68rem", color: "#94a3b8" }}>
                    Advisory only until Phase 11F.{" "}
                    <Link href="/admin/kyc-limits" style={{ color: "#2563eb", fontWeight: 600 }}>
                      Edit policies
                    </Link>
                  </p>
                </div>
              );
            })()}

            <div style={{ marginTop: "1rem", padding: "0.85rem", borderRadius: "10px", background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <DetailRow label="User ID" value={selectedRow.user_id} mono />
              <DetailRow label="Legal name" value={selectedRow.full_legal_name} />
              <DetailRow label="Date of birth" value={formatDateOnly(selectedRow.date_of_birth)} />
              <DetailRow label="Country" value={selectedRow.country} />
              <DetailRow label="Address" value={formatAddress(selectedRow)} />
              <DetailRow label="Document type" value={selectedRow.document_type} />
              <DetailRow
                label="Document last 4"
                value={selectedRow.document_number_last4 ? `•••• ${selectedRow.document_number_last4}` : "—"}
              />
              <DetailRow label="Submitted" value={formatWhen(selectedRow.created_at)} />
              <DetailRow label="Last reviewed" value={formatWhen(selectedRow.reviewed_at)} />
            </div>

            <div style={{ marginTop: "1rem" }}>
              <p style={{ margin: "0 0 0.45rem", fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Documents
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                {selectedRow.document_front_url ? (
                  <button
                    type="button"
                    style={btnSm}
                    disabled={!!docViewBusy}
                    onClick={() => void openDocument(selectedRow.id, selectedRow.document_front_url, "ID front")}
                  >
                    {docViewBusy === `${selectedRow.id}:ID front` ? "Opening…" : "View ID Front"}
                  </button>
                ) : (
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>ID front not uploaded</span>
                )}
                {selectedRow.document_back_url ? (
                  <button
                    type="button"
                    style={btnSm}
                    disabled={!!docViewBusy}
                    onClick={() => void openDocument(selectedRow.id, selectedRow.document_back_url, "ID back")}
                  >
                    {docViewBusy === `${selectedRow.id}:ID back` ? "Opening…" : "View ID Back"}
                  </button>
                ) : null}
                {selectedRow.selfie_url ? (
                  <button
                    type="button"
                    style={btnSm}
                    disabled={!!docViewBusy}
                    onClick={() => void openDocument(selectedRow.id, selectedRow.selfie_url, "Selfie")}
                  >
                    {docViewBusy === `${selectedRow.id}:Selfie` ? "Opening…" : "View Selfie"}
                  </button>
                ) : (
                  !selectedRow.document_front_url ? null : (
                    <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>Selfie not uploaded</span>
                  )
                )}
              </div>
            </div>

            <div style={{ marginTop: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Review notes
              </label>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={4}
                disabled={reviewBusy}
                placeholder="Required for reject and request-more-info actions"
                style={{
                  width: "100%",
                  marginTop: "0.35rem",
                  padding: "0.5rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.82rem",
                  boxSizing: "border-box",
                  resize: "vertical",
                }}
              />
            </div>

            <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {REVIEW_ACTIONS.map((action) => (
                <button
                  key={action.value}
                  type="button"
                  disabled={reviewBusy}
                  style={btnSm}
                  onClick={() => void applyStatus(action.value, action.requiresNotes)}
                >
                  {action.label}
                </button>
              ))}
            </div>

            <div style={{ marginTop: "1.25rem" }}>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
                Review history
              </p>
              {auditUnavailable ? (
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#92400e" }}>
                  Audit log unavailable — run phase_11c_kyc_review_audit.sql to enable review history.
                </p>
              ) : historyLoading ? (
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b" }}>Loading history…</p>
              ) : reviewHistory.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b" }}>No review events recorded yet.</p>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: "0.5rem" }}>
                  {reviewHistory.map((ev) => (
                    <li
                      key={ev.id}
                      style={{
                        padding: "0.55rem 0.65rem",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        background: "#fff",
                        fontSize: "0.78rem",
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>
                        {STATUS_COPY[String(ev.previous_status || "").toLowerCase()] || ev.previous_status || "—"}
                        {" → "}
                        {STATUS_COPY[String(ev.new_status || "").toLowerCase()] || ev.new_status}
                      </div>
                      <div style={{ color: "#64748b", marginTop: "0.2rem" }}>{formatWhen(ev.created_at)}</div>
                      {ev.review_notes ? (
                        <p style={{ margin: "0.35rem 0 0", color: "#475569", lineHeight: 1.45 }}>{ev.review_notes}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
