import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import AuditTimelineEmbed from "../../components/admin/AuditTimelineEmbed";
import {
  TRITON_TRANSFER_DIRECTIONS,
  TRITON_TRANSFER_STATUSES,
  fetchAdminTritonTransferRequests,
  notifyTritonTransferStatus,
  tritonTransferStatusBadgeStyle,
  updateTritonTransferStatus,
} from "../../lib/tritonTransfers";
import { emitAdminEvent } from "../../lib/eventBus";

function severityForTritonStatus(status) {
  const v = String(status || "").toLowerCase();
  if (v === "completed") return "success";
  if (v === "rejected") return "warning";
  if (v === "cancelled") return "info";
  return "info";
}

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1200px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "transparent",
  boxSizing: "border-box",
  overflowX: "hidden",
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
  marginRight: "0.35rem",
  marginTop: "0.25rem",
};

const labelChip = {
  display: "block",
  fontSize: "0.62rem",
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#94a3b8",
  marginBottom: "0.25rem",
};

const inputStyle = {
  display: "block",
  width: "100%",
  padding: "0.45rem 0.55rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: "0.82rem",
  boxSizing: "border-box",
};

const textareaStyle = {
  ...inputStyle,
  minHeight: "2.5rem",
  resize: "vertical",
  fontFamily: "inherit",
};

const TRANSITIONS = Object.freeze({
  pending: new Set(["processing", "rejected", "cancelled"]),
  processing: new Set(["completed", "rejected"]),
  completed: new Set(),
  rejected: new Set(),
  cancelled: new Set(),
});

function canTransition(current, next) {
  const c = String(current || "").toLowerCase();
  const allowed = TRANSITIONS[c];
  return allowed instanceof Set && allowed.has(next);
}

function formatMoney(value) {
  const n = Number(value);
  return Number(Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function directionLabel(direction) {
  if (direction === "to_triton") return "→ Triton";
  if (direction === "from_triton") return "← Triton";
  return direction || "—";
}

function userLabel(profile, userId) {
  const name = profile?.full_name != null ? String(profile.full_name).trim() : "";
  if (name) return name;
  const email = profile?.email != null ? String(profile.email).trim() : "";
  if (email) return email;
  if (typeof userId === "string" && userId.length >= 8) return `${userId.slice(0, 8)}…`;
  return userId || "—";
}

export default function AdminTritonTransfersPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useUser();
  const [rows, setRows] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [directionFilter, setDirectionFilter] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [rowState, setRowState] = useState({});
  const [tritonAuditOpenId, setTritonAuditOpenId] = useState(null);

  useEffect(() => {
    if (!router.isReady) return;
    const rid = router.query.requestId;
    if (typeof rid === "string" && rid.trim()) setTritonAuditOpenId(rid.trim());
  }, [router.isReady, router.query.requestId]);

  const load = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setErrorMsg("");
    const { rows: list, error } = await fetchAdminTritonTransferRequests({
      status: statusFilter || null,
      direction: directionFilter || null,
      limit: 200,
    });
    if (error) {
      setErrorMsg(error.message || "Could not load the transfer queue.");
      setRows([]);
      setProfilesMap({});
      setLoading(false);
      return;
    }
    setRows(list);
    const ids = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
    if (ids.length === 0) {
      setProfilesMap({});
      setLoading(false);
      return;
    }
    const { data: profs, error: pErr } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    if (pErr) {
      console.error("[admin/triton-transfers] profiles", pErr);
      setProfilesMap({});
    } else {
      setProfilesMap(Object.fromEntries((profs || []).map((p) => [p.id, p])));
    }
    setLoading(false);
  }, [user?.id, user, profile, statusFilter, directionFilter]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void load();
  }, [authLoading, user, profile, load]);

  const updateRowField = (id, field, value) => {
    setRowState((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [field]: value },
    }));
  };

  const handleAction = useCallback(
    async (row, nextStatus) => {
      if (!row?.id) return;
      if (!canTransition(row.status, nextStatus)) return;
      setBusyId(row.id);
      setErrorMsg("");
      const draft = rowState[row.id] || {};
      const adminNote = draft.adminNote != null ? draft.adminNote : row.admin_note;
      const tritonReference = draft.tritonReference != null ? draft.tritonReference : row.triton_reference;

      const { error } = await updateTritonTransferStatus({
        id: row.id,
        status: nextStatus,
        adminNote,
        tritonReference,
        processedByUserId: user?.id ?? null,
        previousStatusForAudit: row.status,
      });
      if (error) {
        setErrorMsg(error.message || "Update failed.");
        setBusyId(null);
        return;
      }

      if (nextStatus !== "cancelled") {
        try {
          await notifyTritonTransferStatus(supabase, {
            transferId: row.id,
            userId: row.user_id,
            status: nextStatus,
          });
        } catch (notifyErr) {
          console.error("[admin/triton-transfers] notify failed", notifyErr);
        }
      }

      void emitAdminEvent({
        eventType: `triton.${nextStatus}`,
        category: "triton",
        severity: severityForTritonStatus(nextStatus),
        title: `Triton transfer ${nextStatus}`,
        message: `Transfer ${row.id} moved to ${nextStatus} by admin.`,
        actorUserId: user?.id ?? null,
        metadata: { transferId: row.id, userId: row.user_id, direction: row.direction, status: nextStatus },
      });

      await load();
      setBusyId(null);
    },
    [load, rowState, user?.id],
  );

  const headerCounts = useMemo(() => {
    const counts = { pending: 0, processing: 0, completed: 0, rejected: 0, cancelled: 0 };
    for (const r of rows) {
      const s = String(r?.status || "").toLowerCase();
      if (counts[s] != null) counts[s] += 1;
    }
    return counts;
  }, [rows]);

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
          <Link
            href="/login"
            style={{ display: "inline-block", marginTop: "1rem", fontWeight: 600, color: "#0ea5e9" }}
          >
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
      <style jsx global>{`
        @media (max-width: 760px) {
          .tc-tt-desktop {
            display: none !important;
          }
          .tc-tt-mobile {
            display: grid !important;
          }
        }
        @media (min-width: 761px) {
          .tc-tt-desktop {
            display: block !important;
          }
          .tc-tt-mobile {
            display: none !important;
          }
        }
      `}</style>
      <div style={pageWrap}>
        <div style={{ marginBottom: "1rem" }}>
          <Link href="/admin" style={{ color: "#38bdf8", fontWeight: 600, fontSize: "0.9rem" }}>
            ← Admin home
          </Link>
        </div>
        <h1
          style={{
            fontSize: "clamp(1.3rem, 4vw, 1.55rem)",
            fontWeight: 700,
            color: "#0f172a",
            margin: "0 0 0.4rem",
            letterSpacing: "-0.02em",
          }}
        >
          Triton transfers
        </h1>
        <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5, maxWidth: "44rem" }}>
          Read-only review queue. Request infrastructure only — no wallet movement yet.
        </p>

        <div
          style={{
            ...cardBase,
            padding: "0.9rem 1.05rem",
            marginBottom: "1rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: "1 1 12rem", minWidth: "10rem" }}>
            <label style={labelChip}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All</option>
              {TRITON_TRANSFER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div style={{ flex: "1 1 12rem", minWidth: "10rem" }}>
            <label style={labelChip}>Direction</label>
            <select
              value={directionFilter}
              onChange={(e) => setDirectionFilter(e.target.value)}
              style={inputStyle}
            >
              <option value="">All</option>
              {TRITON_TRANSFER_DIRECTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              style={{ ...btnSm, marginTop: 0, opacity: loading ? 0.6 : 1 }}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <p style={{ margin: "0 0 0.75rem", fontSize: "0.78rem", color: "#64748b" }}>
          Showing {rows.length} request{rows.length === 1 ? "" : "s"} ({headerCounts.pending} pending,{" "}
          {headerCounts.processing} processing).
        </p>

        {errorMsg ? (
          <div
            style={{
              ...cardBase,
              padding: "0.85rem 1rem",
              marginBottom: "1rem",
              background: "#fef2f2",
              borderColor: "#fecaca",
            }}
          >
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.85rem" }}>{errorMsg}</p>
          </div>
        ) : null}

        {loading && rows.length === 0 ? (
          <p style={{ margin: 0, color: "#64748b" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <div style={{ ...cardBase, padding: "1.75rem", textAlign: "center" }}>
            <p style={{ margin: 0, color: "#64748b" }}>No transfer requests match these filters.</p>
          </div>
        ) : (
          <>
            <div className="tc-tt-desktop" style={{ ...cardBase, overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2.1fr)",
                  gap: "0.65rem",
                  padding: "0.55rem 0.85rem",
                  fontSize: "0.66rem",
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "#94a3b8",
                  background: "#f8fafc",
                }}
              >
                <div>User</div>
                <div>Direction</div>
                <div>Amount</div>
                <div>Status</div>
                <div>Created</div>
                <div>Triton ref</div>
                <div>Actions</div>
              </div>
              {rows.map((row) => {
                const prof = profilesMap[row.user_id];
                const draft = rowState[row.id] || {};
                const status = String(row.status || "").toLowerCase();
                const busy = busyId === row.id;
                return (
                  <Fragment key={row.id}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(0, 1.2fr) minmax(0, 0.8fr) minmax(0, 0.8fr) minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 2.1fr)",
                      gap: "0.65rem",
                      alignItems: "flex-start",
                      padding: "0.75rem 0.85rem",
                      borderTop: "1px solid #f1f5f9",
                      fontSize: "0.82rem",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {userLabel(prof, row.user_id)}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#94a3b8", wordBreak: "break-all" }}>
                        {row.user_id}
                      </div>
                    </div>
                    <div style={{ color: "#0f172a", fontWeight: 600 }}>{directionLabel(row.direction)}</div>
                    <div style={{ color: "#0f172a", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      ${formatMoney(row.amount)}
                    </div>
                    <div>
                      <span style={tritonTransferStatusBadgeStyle(row.status)}>{status || "—"}</span>
                    </div>
                    <div style={{ color: "#475569", fontSize: "0.78rem" }}>{formatWhen(row.created_at)}</div>
                    <div style={{ color: "#0f172a", fontSize: "0.78rem", wordBreak: "break-word" }}>
                      {row.triton_reference || <span style={{ color: "#94a3b8" }}>—</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      <div>
                        <label style={labelChip}>Triton reference</label>
                        <input
                          type="text"
                          maxLength={120}
                          placeholder="Optional reference"
                          value={draft.tritonReference != null ? draft.tritonReference : row.triton_reference || ""}
                          onChange={(e) => updateRowField(row.id, "tritonReference", e.target.value)}
                          disabled={busy}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelChip}>Admin note</label>
                        <textarea
                          rows={2}
                          maxLength={1000}
                          placeholder="Internal note (optional)"
                          value={draft.adminNote != null ? draft.adminNote : row.admin_note || ""}
                          onChange={(e) => updateRowField(row.id, "adminNote", e.target.value)}
                          disabled={busy}
                          style={textareaStyle}
                        />
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          style={{ ...btnSm, marginRight: "0.35rem" }}
                          onClick={() => setTritonAuditOpenId((cur) => (cur === row.id ? null : row.id))}
                        >
                          {tritonAuditOpenId === row.id ? "Hide audit" : "Audit"}
                        </button>
                        <button
                          type="button"
                          disabled={busy || !canTransition(status, "processing")}
                          onClick={() => void handleAction(row, "processing")}
                          style={{
                            ...btnSm,
                            opacity: busy || !canTransition(status, "processing") ? 0.5 : 1,
                            cursor: busy || !canTransition(status, "processing") ? "not-allowed" : "pointer",
                          }}
                        >
                          Mark processing
                        </button>
                        <button
                          type="button"
                          disabled={busy || !canTransition(status, "completed")}
                          onClick={() => void handleAction(row, "completed")}
                          style={{
                            ...btnSm,
                            opacity: busy || !canTransition(status, "completed") ? 0.5 : 1,
                            cursor: busy || !canTransition(status, "completed") ? "not-allowed" : "pointer",
                          }}
                        >
                          Mark completed
                        </button>
                        <button
                          type="button"
                          disabled={busy || !canTransition(status, "rejected")}
                          onClick={() => void handleAction(row, "rejected")}
                          style={{
                            ...btnSm,
                            marginRight: 0,
                            opacity: busy || !canTransition(status, "rejected") ? 0.5 : 1,
                            cursor: busy || !canTransition(status, "rejected") ? "not-allowed" : "pointer",
                          }}
                        >
                          Reject
                        </button>
                      </div>
                      {row.admin_note && !draft.adminNote ? (
                        <p style={{ margin: 0, fontSize: "0.72rem", color: "#64748b", lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                          Saved note: {row.admin_note}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {tritonAuditOpenId === row.id ? (
                    <div style={{ padding: "0 0.85rem 0.75rem", background: "#fafafa", borderTop: "1px solid #f1f5f9" }}>
                      <AuditTimelineEmbed entityType="triton_transfer" entityId={row.id} limit={15} />
                    </div>
                  ) : null}
                  </Fragment>
                );
              })}
            </div>

            <div
              className="tc-tt-mobile"
              style={{ display: "none", gridTemplateColumns: "1fr", gap: "0.75rem" }}
            >
              {rows.map((row) => {
                const prof = profilesMap[row.user_id];
                const draft = rowState[row.id] || {};
                const status = String(row.status || "").toLowerCase();
                const busy = busyId === row.id;
                return (
                  <Fragment key={row.id}>
                  <div style={{ ...cardBase, padding: "0.95rem 1.05rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>
                          {userLabel(prof, row.user_id)}
                        </p>
                        <p style={{ margin: "0.2rem 0 0", fontSize: "0.7rem", color: "#94a3b8", wordBreak: "break-all" }}>
                          {row.user_id}
                        </p>
                      </div>
                      <span style={tritonTransferStatusBadgeStyle(row.status)}>{status || "—"}</span>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: "0.5rem",
                        marginBottom: "0.6rem",
                      }}
                    >
                      <div>
                        <p style={labelChip}>Direction</p>
                        <p style={{ margin: 0, fontWeight: 600, color: "#0f172a", fontSize: "0.85rem" }}>
                          {directionLabel(row.direction)}
                        </p>
                      </div>
                      <div>
                        <p style={labelChip}>Amount</p>
                        <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                          ${formatMoney(row.amount)}
                        </p>
                      </div>
                      <div>
                        <p style={labelChip}>Created</p>
                        <p style={{ margin: 0, fontSize: "0.78rem", color: "#475569" }}>{formatWhen(row.created_at)}</p>
                      </div>
                      <div>
                        <p style={labelChip}>Triton ref</p>
                        <p style={{ margin: 0, fontSize: "0.78rem", color: "#0f172a", wordBreak: "break-word" }}>
                          {row.triton_reference || "—"}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "0.5rem" }}>
                      <div>
                        <label style={labelChip}>Triton reference</label>
                        <input
                          type="text"
                          maxLength={120}
                          placeholder="Optional reference"
                          value={draft.tritonReference != null ? draft.tritonReference : row.triton_reference || ""}
                          onChange={(e) => updateRowField(row.id, "tritonReference", e.target.value)}
                          disabled={busy}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label style={labelChip}>Admin note</label>
                        <textarea
                          rows={2}
                          maxLength={1000}
                          placeholder="Internal note (optional)"
                          value={draft.adminNote != null ? draft.adminNote : row.admin_note || ""}
                          onChange={(e) => updateRowField(row.id, "adminNote", e.target.value)}
                          disabled={busy}
                          style={textareaStyle}
                        />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={{ ...btnSm, marginRight: "0.35rem" }}
                        onClick={() => setTritonAuditOpenId((cur) => (cur === row.id ? null : row.id))}
                      >
                        {tritonAuditOpenId === row.id ? "Hide audit" : "Audit"}
                      </button>
                      <button
                        type="button"
                        disabled={busy || !canTransition(status, "processing")}
                        onClick={() => void handleAction(row, "processing")}
                        style={{
                          ...btnSm,
                          opacity: busy || !canTransition(status, "processing") ? 0.5 : 1,
                          cursor: busy || !canTransition(status, "processing") ? "not-allowed" : "pointer",
                        }}
                      >
                        Mark processing
                      </button>
                      <button
                        type="button"
                        disabled={busy || !canTransition(status, "completed")}
                        onClick={() => void handleAction(row, "completed")}
                        style={{
                          ...btnSm,
                          opacity: busy || !canTransition(status, "completed") ? 0.5 : 1,
                          cursor: busy || !canTransition(status, "completed") ? "not-allowed" : "pointer",
                        }}
                      >
                        Mark completed
                      </button>
                      <button
                        type="button"
                        disabled={busy || !canTransition(status, "rejected")}
                        onClick={() => void handleAction(row, "rejected")}
                        style={{
                          ...btnSm,
                          marginRight: 0,
                          opacity: busy || !canTransition(status, "rejected") ? 0.5 : 1,
                          cursor: busy || !canTransition(status, "rejected") ? "not-allowed" : "pointer",
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                  {tritonAuditOpenId === row.id ? (
                    <div style={{ marginTop: "0.5rem" }}>
                      <AuditTimelineEmbed entityType="triton_transfer" entityId={row.id} limit={15} />
                    </div>
                  ) : null}
                  </Fragment>
                );
              })}
            </div>
          </>
        )}

        <section style={{ marginTop: "1.5rem" }}>
          <div style={{ ...cardBase, padding: "0.85rem 1rem" }}>
            <ul
              style={{
                margin: 0,
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.85rem",
                fontSize: "0.85rem",
              }}
            >
              <li>
                <Link href="/admin/treasury" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                  Treasury
                </Link>
              </li>
              <li>
                <Link href="/admin/logs" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                  Operational logs
                </Link>
              </li>
              <li>
                <Link href="/admin/timeline" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                  Audit timeline
                </Link>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}
