import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import { notifyUserWithdrawalStatusChange } from "../../lib/withdrawalRequests";

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
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function shortUuid(id) {
  if (!id || typeof id !== "string") return "—";
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function userLabel(profile, userId) {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  if (profile?.email?.trim()) return profile.email.trim();
  return userId || "—";
}

function statusOrder(status) {
  const v = String(status || "").toLowerCase();
  if (v === "pending") return 0;
  if (v === "processing") return 1;
  if (v === "paid") return 2;
  if (v === "rejected") return 3;
  return 9;
}

function statusBadgeStyle(status) {
  const v = String(status || "").toLowerCase();
  if (v === "pending") {
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
  if (v === "processing") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#eff6ff",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
    };
  }
  if (v === "paid") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#ecfdf5",
      color: "#047857",
      border: "1px solid #a7f3d0",
    };
  }
  if (v === "rejected") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fef2f2",
      color: "#b91c1c",
      border: "1px solid #fecaca",
    };
  }
  return {
    display: "inline-block",
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: "#f1f5f9",
    color: "#64748b",
    border: "1px solid #e2e8f0",
  };
}

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1200px",
  margin: "0 auto",
  minHeight: "calc(100vh - 3.5rem)",
  background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
  boxSizing: "border-box",
};

const cardBase = {
  background: "#ffffff",
  borderRadius: "14px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 8px 25px rgba(15, 23, 42, 0.08)",
};

const inputBase = {
  padding: "0.55rem 0.65rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "0.85rem",
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  background: "#f4f6f9",
  color: "#0f172a",
};

const btnSm = {
  padding: "0.35rem 0.6rem",
  fontSize: "0.72rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
  marginRight: "0.35rem",
  marginTop: "0.35rem",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
};

const adminFocusCss = `
  .tc-admin-in:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .tc-admin-in::placeholder { color: #94a3b8; }
`;

function payoutLabelCell(r) {
  const t = r?.payout_label != null ? String(r.payout_label).trim() : "";
  return t || "No payout label";
}

function adminNoteDisplay(r) {
  if (r?.admin_note == null) return null;
  const s = String(r.admin_note).trim();
  return s || null;
}

const PAID_VIA_OPTIONS = ["PayPal", "Bank transfer", "Cash", "Other"];

function displayDash(value) {
  if (value == null) return "—";
  const s = String(value).trim();
  return s || "—";
}

export default function AdminWithdrawalsPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [rows, setRows] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [dataLoading, setDataLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [fetchErrorDetails, setFetchErrorDetails] = useState(null);
  const [lastFetchRowCount, setLastFetchRowCount] = useState(null);
  const [lastFetchHadError, setLastFetchHadError] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [adminNotesDraft, setAdminNotesDraft] = useState({});

  const fetchRows = useCallback(async () => {
    if (!user?.id) return;
    setDataLoading(true);
    setFetchError(null);
    setFetchErrorDetails(null);

    const { data, error } = await supabase
      .from("withdrawal_requests")
      .select("*")
      .order("created_at", { ascending: false });

    console.log("[ADMIN_WITHDRAWALS_FETCH]", { data, error });

    if (error) {
      console.error("[admin/withdrawals] fetch:", error);
      setFetchError(error.message || "Failed to load withdrawal requests.");
      setFetchErrorDetails({
        message: error.message ?? null,
        code: error.code ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      });
      setLastFetchHadError(true);
      setLastFetchRowCount(null);
      setDataLoading(false);
      return;
    }

    const list = Array.isArray(data) ? data : [];
    setLastFetchHadError(false);
    setLastFetchRowCount(list.length);
    setRows(list);

    const draft = {};
    list.forEach((r) => {
      if (r && r.id) {
        draft[r.id] = r.admin_note != null ? String(r.admin_note) : "";
      }
    });
    setAdminNotesDraft(draft);

    const ids = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
    if (ids.length === 0) {
      setProfilesMap({});
      setDataLoading(false);
      return;
    }

    const { data: profs, error: pErr } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);

    if (pErr) {
      console.error("[admin/withdrawals] profiles:", pErr);
      setProfilesMap({});
    } else {
      setProfilesMap(Object.fromEntries((profs || []).map((p) => [p.id, p])));
    }

    setDataLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, profile)) return;
    void fetchRows();
  }, [authLoading, user?.id, user, profile, fetchRows]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const ao = statusOrder(a?.status);
      const bo = statusOrder(b?.status);
      if (ao !== bo) return ao - bo;
      const tb = new Date(b?.created_at || 0).getTime();
      const ta = new Date(a?.created_at || 0).getTime();
      return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
    });
  }, [rows]);

  const pendingCount = useMemo(() => {
    return rows.filter((r) => String(r.status || "").toLowerCase() === "pending").length;
  }, [rows]);

  const setNoteDraft = (id, value) => {
    setAdminNotesDraft((prev) => ({ ...prev, [id]: value }));
  };

  /**
   * @param {{ id: string; user_id: string; amount?: unknown }} row
   * @param {Record<string, unknown>} patch
   * @param {'processing' | 'paid' | 'rejected' | null} notifyKind
   */
  const runUpdate = async (row, patch, notifyKind) => {
    const id = row?.id;
    if (!id) return;
    setActionBusyId(id);
    setFetchError(null);
    setFetchErrorDetails(null);
    const { error } = await supabase.from("withdrawal_requests").update(patch).eq("id", id);
    if (error) {
      console.error("[admin/withdrawals] update failed:", error);
      setFetchError(error.message || "Update failed.");
      setFetchErrorDetails({
        message: error.message ?? null,
        code: error.code ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      });
      setActionBusyId(null);
      return;
    }
    if (notifyKind && row?.user_id) {
      try {
        await notifyUserWithdrawalStatusChange({
          userId: row.user_id,
          amount: Number(row.amount),
          kind: notifyKind,
        });
      } catch (notifErr) {
        console.error("[admin/withdrawals] user notification failed (non-blocking):", notifErr);
      }
    }
    await fetchRows();
    setActionBusyId(null);
  };

  const handleMarkProcessing = (r) => {
    void runUpdate(r, { status: "processing" }, "processing");
  };

  const handleMarkPaid = (r) => {
    const rawVia = window.prompt(
      `Paid via? Enter exactly one of: ${PAID_VIA_OPTIONS.join(", ")}`,
      "PayPal",
    );
    if (rawVia === null) return;
    const paidVia = String(rawVia || "").trim();
    if (!PAID_VIA_OPTIONS.includes(paidVia)) {
      window.alert(`Invalid value. Use one of: ${PAID_VIA_OPTIONS.join(", ")}.`);
      return;
    }
    const rawRef = window.prompt("External reference (optional — leave empty if none)", "");
    if (rawRef === null) return;
    const externalRefTrim = String(rawRef || "").trim();
    const external_reference = externalRefTrim ? externalRefTrim : null;
    void runUpdate(
      r,
      {
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_via: paidVia,
        external_reference,
      },
      "paid",
    );
  };

  const handleReject = (r) => {
    const id = r?.id;
    if (!id) return;
    const note = String(adminNotesDraft[id] || "").trim();
    if (!note) {
      window.alert("Add an admin note before rejecting (reason for the user / internal record).");
      return;
    }
    void runUpdate(
      r,
      {
        status: "rejected",
        admin_note: note,
        paid_at: null,
        paid_via: null,
        external_reference: null,
      },
      "rejected",
    );
  };

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#f8fafc", marginBottom: "1rem" }}>Withdrawals</h1>
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
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#f8fafc", marginBottom: "0.75rem" }}>Withdrawals</h1>
          <p style={{ color: "#64748b" }}>Sign in to view this page.</p>
          <Link
            href="/login"
            style={{
              display: "inline-block",
              marginTop: "1rem",
              fontWeight: 600,
              color: "#0ea5e9",
            }}
          >
            Go to login
          </Link>
        </div>
      </>
    );
  }

  if (!authLoading && user && !isAdminUser(user, profile)) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <h2 style={{ color: "#f8fafc", marginTop: 0 }}>Admin access required.</h2>
          <p style={{ color: "#94a3b8" }}>This area is restricted to admin users.</p>
        </div>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: adminFocusCss }} />
      <Navbar />
      <div style={pageWrap}>
        <div style={{ marginBottom: "1.25rem" }}>
          <Link href="/admin" style={{ color: "#38bdf8", fontWeight: 600, fontSize: "0.9rem" }}>
            ← Admin home
          </Link>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", marginBottom: "1.25rem" }}>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#f8fafc", margin: 0, letterSpacing: "-0.02em" }}>
            Withdrawal requests
          </h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#94a3b8" }}>
            Pending: <strong style={{ color: "#f8fafc" }}>{pendingCount}</strong>
          </p>
        </div>

        {lastFetchRowCount !== null || lastFetchHadError === true ? (
          <div style={{ ...cardBase, padding: "0.75rem 1rem", marginBottom: "1rem", background: "#0f172a", borderColor: "#334155" }}>
            <p style={{ margin: 0, fontSize: "0.78rem", color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>
              Last fetch:{" "}
              {lastFetchHadError ? "error" : `${lastFetchRowCount ?? 0} row(s)`} — check browser console for
              [ADMIN_WITHDRAWALS_FETCH]
            </p>
          </div>
        ) : null}

        <div style={{ ...cardBase, padding: "1rem 1.15rem", marginBottom: "1.25rem", background: "#fffbeb", borderColor: "#fcd34d" }}>
          <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "#92400e", lineHeight: 1.5 }}>
            Rejected withdrawals may require manual wallet adjustment.
          </p>
        </div>

        <div style={{ ...cardBase, padding: "1rem 1.15rem", marginBottom: "1rem" }}>
          <button type="button" onClick={() => void fetchRows()} disabled={dataLoading} style={{ ...btnSm, marginTop: 0 }}>
            {dataLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {fetchError ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", borderColor: "#fecaca", background: "#fef2f2" }}>
            <p style={{ margin: "0 0 0.5rem", color: "#991b1b", fontSize: "0.9rem", fontWeight: 700 }}>{fetchError}</p>
            {fetchErrorDetails ? (
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#7f1d1d", fontSize: "0.82rem", lineHeight: 1.5 }}>
                <li>code: {fetchErrorDetails.code != null ? String(fetchErrorDetails.code) : "—"}</li>
                <li>details: {fetchErrorDetails.details != null ? String(fetchErrorDetails.details) : "—"}</li>
                <li>hint: {fetchErrorDetails.hint != null ? String(fetchErrorDetails.hint) : "—"}</li>
                <li>message: {fetchErrorDetails.message != null ? String(fetchErrorDetails.message) : "—"}</li>
              </ul>
            ) : null}
          </div>
        ) : null}

        {!fetchError && lastFetchHadError === false && lastFetchRowCount === 0 && !dataLoading ? (
          <div style={{ ...cardBase, padding: "1rem 1.15rem", marginBottom: "1rem", background: "#fffbeb", borderColor: "#fcd34d" }}>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#92400e", lineHeight: 1.55 }}>
              Query returned 0 rows. If rows exist in Supabase but not here, RLS is usually blocking: confirm{" "}
              <code style={{ fontSize: "0.8em" }}>withdrawal_requests_select_admin</code> allows your admin account and
              that <code style={{ fontSize: "0.8em" }}>tc_is_admin()</code> matches your auth email.
            </p>
          </div>
        ) : null}

        <div style={{ ...cardBase, padding: "1rem", overflowX: "auto" }}>
          {dataLoading && rows.length === 0 ? (
            <p style={{ color: "#64748b", margin: 0 }}>Loading requests…</p>
          ) : sortedRows.length === 0 ? (
            <p style={{ color: "#64748b", margin: 0 }}>No withdrawal requests yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "0.5rem 0.35rem", color: "#64748b", fontWeight: 700 }}>Request ID</th>
                  <th style={{ padding: "0.5rem 0.35rem", color: "#64748b", fontWeight: 700 }}>User ID</th>
                  <th style={{ padding: "0.5rem 0.35rem", color: "#64748b", fontWeight: 700 }}>User</th>
                  <th style={{ padding: "0.5rem 0.35rem", color: "#64748b", fontWeight: 700 }}>Amount</th>
                  <th style={{ padding: "0.5rem 0.35rem", color: "#64748b", fontWeight: 700 }}>Payout</th>
                  <th style={{ padding: "0.5rem 0.35rem", color: "#64748b", fontWeight: 700 }}>Status</th>
                  <th style={{ padding: "0.5rem 0.35rem", color: "#64748b", fontWeight: 700 }}>Paid via</th>
                  <th style={{ padding: "0.5rem 0.35rem", color: "#64748b", fontWeight: 700 }}>Reference</th>
                  <th style={{ padding: "0.5rem 0.35rem", color: "#64748b", fontWeight: 700 }}>Created</th>
                  <th style={{ padding: "0.5rem 0.35rem", color: "#64748b", fontWeight: 700, minWidth: "140px" }}>Admin note</th>
                  <th style={{ padding: "0.5rem 0.35rem", color: "#64748b", fontWeight: 700, minWidth: "220px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((r) => {
                  const st = String(r?.status || "").toLowerCase();
                  const busy = actionBusyId === r.id;
                  const canProcess = st === "pending" || st === "processing";
                  const p = profilesMap[r.user_id];
                  const savedNote = adminNoteDisplay(r);
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                      <td style={{ padding: "0.65rem 0.35rem", color: "#475569", fontFamily: "ui-monospace, monospace", fontSize: "0.72rem" }} title={r.id}>
                        {shortUuid(r.id)}
                      </td>
                      <td style={{ padding: "0.65rem 0.35rem", color: "#475569", fontFamily: "ui-monospace, monospace", fontSize: "0.72rem" }} title={r.user_id}>
                        {shortUuid(r.user_id)}
                      </td>
                      <td style={{ padding: "0.65rem 0.35rem", color: "#0f172a", fontWeight: 600 }}>{userLabel(p, r.user_id)}</td>
                      <td style={{ padding: "0.65rem 0.35rem", color: "#0f172a", fontWeight: 700 }}>${formatMoney(r?.amount)}</td>
                      <td style={{ padding: "0.65rem 0.35rem", color: "#334155", maxWidth: "200px" }}>{payoutLabelCell(r)}</td>
                      <td style={{ padding: "0.65rem 0.35rem" }}>
                        <span style={statusBadgeStyle(r?.status)}>{st || "—"}</span>
                        {r?.paid_at ? (
                          <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "0.25rem" }}>Paid {formatWhen(r.paid_at)}</div>
                        ) : null}
                      </td>
                      <td style={{ padding: "0.65rem 0.35rem", color: "#334155", fontSize: "0.78rem" }}>{displayDash(r?.paid_via)}</td>
                      <td style={{ padding: "0.65rem 0.35rem", color: "#334155", fontSize: "0.78rem", wordBreak: "break-word" }}>
                        {displayDash(r?.external_reference)}
                      </td>
                      <td style={{ padding: "0.65rem 0.35rem", color: "#64748b", whiteSpace: "nowrap" }}>{formatWhen(r?.created_at)}</td>
                      <td style={{ padding: "0.65rem 0.35rem", color: "#334155", fontSize: "0.78rem" }}>
                        {savedNote ? (
                          <span>{savedNote}</span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "0.65rem 0.35rem" }}>
                        <textarea
                          className="tc-admin-in"
                          rows={2}
                          value={adminNotesDraft[r.id] ?? ""}
                          onChange={(e) => setNoteDraft(r.id, e.target.value)}
                          placeholder="Internal note (required to reject)"
                          style={{ ...inputBase, resize: "vertical", minHeight: "48px" }}
                          disabled={busy || st === "paid" || st === "rejected"}
                        />
                        <button
                          type="button"
                          style={btnSm}
                          disabled={busy || !canProcess || st !== "pending"}
                          onClick={() => handleMarkProcessing(r)}
                        >
                          Mark processing
                        </button>
                        <button
                          type="button"
                          style={btnSm}
                          disabled={busy || !canProcess}
                          onClick={() => handleMarkPaid(r)}
                        >
                          Mark paid
                        </button>
                        <button
                          type="button"
                          style={{ ...btnSm, borderColor: "#fca5a5", color: "#b91c1c" }}
                          disabled={busy || !canProcess}
                          onClick={() => handleReject(r)}
                        >
                          Reject
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
    </>
  );
}
