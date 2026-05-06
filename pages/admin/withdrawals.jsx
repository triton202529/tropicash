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
      background: "#f1f5f9",
      color: "#475569",
      border: "1px solid #cbd5e1",
    };
  }
  if (v === "failed") {
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
  .tc-withdrawal-detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem 1.25rem;
  }
  @media (max-width: 560px) {
    .tc-withdrawal-detail-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  .tc-withdrawal-actions-primary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }
  .tc-withdrawal-actions-secondary {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-top: 0.5rem;
    padding-top: 0.65rem;
    border-top: 1px solid #f1f5f9;
  }
`;

function payoutLabelCell(r) {
  const t = r?.payout_label != null ? String(r.payout_label).trim() : "";
  return t || "No payout label";
}

const PAID_VIA_OPTIONS = ["PayPal", "Bank transfer", "Cash", "Other"];

function WithdrawalDetail({ label, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: "0.68rem",
          fontWeight: 600,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: "0.25rem",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "0.875rem", color: "#0f172a", wordBreak: "break-word", lineHeight: 1.45 }}>{children}</div>
    </div>
  );
}

const preErrorBox = {
  margin: "0.5rem 0 0",
  padding: "0.65rem 0.75rem",
  borderRadius: "8px",
  background: "#fff",
  border: "1px solid #fecaca",
  fontSize: "0.75rem",
  lineHeight: 1.45,
  overflowX: "auto",
  maxWidth: "100%",
  boxSizing: "border-box",
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

function PayPalPayoutErrorView({ error }) {
  if (!error || typeof error !== "object") return null;
  const name = error.name != null ? String(error.name) : null;
  const message = error.message != null ? String(error.message) : null;
  const details = error.details;
  const fullBody =
    error.fullResponseBody && typeof error.fullResponseBody === "object" ? error.fullResponseBody : null;
  const httpStatus = error.httpStatus != null ? error.httpStatus : null;
  const phase = error.phase != null ? String(error.phase) : null;

  let detailsStr = null;
  if (details !== undefined && details !== null) {
    try {
      detailsStr = typeof details === "string" ? details : JSON.stringify(details, null, 2);
    } catch {
      detailsStr = String(details);
    }
  }

  let fullStr = null;
  if (fullBody && Object.keys(fullBody).length > 0) {
    try {
      fullStr = JSON.stringify(fullBody, null, 2);
    } catch {
      fullStr = null;
    }
  }

  return (
    <div style={{ fontSize: "0.84rem", color: "#7f1d1d", lineHeight: 1.5 }}>
      {(httpStatus != null || phase) && (
        <p style={{ margin: "0 0 0.35rem", fontSize: "0.78rem", color: "#991b1b" }}>
          {httpStatus != null ? `HTTP ${httpStatus}` : ""}
          {httpStatus != null && phase ? " · " : ""}
          {phase || ""}
        </p>
      )}
      {name ? (
        <p style={{ margin: "0 0 0.35rem", fontWeight: 800, fontFamily: preErrorBox.fontFamily, color: "#450a0a" }}>{name}</p>
      ) : null}
      {message ? <p style={{ margin: "0 0 0.5rem", fontWeight: 600 }}>{message}</p> : null}
      {detailsStr ? (
        <div>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#991b1b", marginBottom: "0.2rem" }}>Details</div>
          <pre style={preErrorBox}>{detailsStr}</pre>
        </div>
      ) : null}
      {fullStr ? (
        <div style={{ marginTop: detailsStr ? "0.65rem" : 0 }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#991b1b", marginBottom: "0.2rem" }}>Full PayPal response</div>
          <pre style={preErrorBox}>{fullStr}</pre>
        </div>
      ) : null}
    </div>
  );
}

function parseFailureReasonString(failureReason) {
  if (failureReason == null) return null;
  const s = String(failureReason).trim();
  if (!s) return null;
  if (s.startsWith("{")) {
    try {
      const o = JSON.parse(s);
      if (o && typeof o === "object" && !Array.isArray(o)) {
        const looksPayPal =
          "fullResponseBody" in o ||
          "details" in o ||
          (o.name != null && String(o.name).length > 0) ||
          (o.message != null && String(o.message).length > 0);
        if (looksPayPal) return { kind: "paypal", payload: o };
      }
    } catch {
      return { kind: "text", text: s };
    }
  }
  return { kind: "text", text: s };
}

function WithdrawalFailurePanel({ failureReason }) {
  const parsed = parseFailureReasonString(failureReason);
  if (!parsed) return null;

  return (
    <div
      style={{
        marginBottom: "1rem",
        padding: "1rem 1.05rem",
        borderRadius: "12px",
        border: "1px solid #fecaca",
        background: "linear-gradient(180deg, #fef2f2 0%, #fff5f5 100%)",
        boxSizing: "border-box",
        maxWidth: "100%",
      }}
    >
      <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.65rem" }}>
        Payout error
      </div>
      {parsed.kind === "paypal" ? (
        <PayPalPayoutErrorView error={parsed.payload} />
      ) : (
        <p style={{ margin: 0, fontSize: "0.875rem", color: "#7f1d1d", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{parsed.text}</p>
      )}
    </div>
  );
}

export default function AdminWithdrawalsPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [rows, setRows] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [dataLoading, setDataLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [fetchErrorDetails, setFetchErrorDetails] = useState(null);
  const [payoutSuccessMessage, setPayoutSuccessMessage] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [payoutRetryLoadingId, setPayoutRetryLoadingId] = useState(null);
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
      setDataLoading(false);
      return;
    }

    const list = Array.isArray(data) ? data : [];
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

  const handleRecordManualPayout = (r) => {
    const ok = window.confirm(
      "Record a manual payout only after payment was completed outside Tropicash. Continue?",
    );
    if (!ok) return;
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
    const rawRef = window.prompt("External reference (required for audit trail)", "");
    if (rawRef === null) return;
    const externalRefTrim = String(rawRef || "").trim();
    if (!externalRefTrim) {
      window.alert("External reference is required for manual payout recording.");
      return;
    }
    void runUpdate(
      r,
      {
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_via: paidVia,
        external_reference: externalRefTrim,
        processor: "manual",
        processor_status: "recorded_manual",
      },
      "paid",
    );
  };

  const postAdminPayout = async (id, { retry }) => {
    const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
    if (sessErr || !sessionData?.session?.access_token) {
      setFetchError("Could not read your session. Sign in again.");
      setFetchErrorDetails(null);
      return false;
    }
    const res = await fetch(`/api/admin/withdrawals/${encodeURIComponent(id)}/payout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ retry }),
    });
    const responseJson = await res.json().catch(() => ({}));
    await fetchRows();
    if (!res.ok) {
      if (retry) {
        console.error("[WITHDRAWAL_RETRY_PAYOUT_ERROR]", responseJson);
      }
      setFetchError(responseJson?.error || `Payout failed (${res.status})`);
      if (responseJson?.details && typeof responseJson.details === "object") {
        setFetchErrorDetails({ source: "paypal", payload: responseJson.details });
      } else if (responseJson && typeof responseJson === "object" && Object.keys(responseJson).length > 0) {
        setFetchErrorDetails({ source: "api", payload: responseJson });
      } else {
        setFetchErrorDetails(null);
      }
      return false;
    }
    setFetchError(null);
    setFetchErrorDetails(null);
    return true;
  };

  const handleSendPayout = async (r) => {
    const id = r?.id;
    if (!id) return;
    const ok = window.confirm(
      "This will attempt to send money using the connected payout processor (PayPal Payouts). Continue?",
    );
    if (!ok) return;
    setActionBusyId(id);
    setFetchError(null);
    setFetchErrorDetails(null);
    setPayoutSuccessMessage(null);
    try {
      const succeeded = await postAdminPayout(id, { retry: false });
      if (succeeded) {
        setPayoutSuccessMessage("Payout completed. The list has been refreshed.");
      }
    } catch (err) {
      console.error("[admin/withdrawals] payout fetch failed:", err);
      setFetchError(err?.message || "Payout request failed.");
      setFetchErrorDetails(null);
    }
    setActionBusyId(null);
  };

  const handleRetryPayout = async (r) => {
    const id = r?.id;
    if (!id) return;
    const ok = window.confirm(
      "Submit a new PayPal batch for this failed withdrawal? Use only if the previous attempt will not complete.",
    );
    if (!ok) return;
    setPayoutRetryLoadingId(id);
    setActionBusyId(id);
    setFetchError(null);
    setFetchErrorDetails(null);
    setPayoutSuccessMessage(null);
    try {
      const succeeded = await postAdminPayout(id, { retry: true });
      if (succeeded) {
        setPayoutSuccessMessage("Retry payout completed. The list has been refreshed.");
      }
    } catch (err) {
      console.error("[admin/withdrawals] retry payout failed:", err);
      setFetchError(err?.message || "Retry payout failed.");
      setFetchErrorDetails(null);
    } finally {
      setPayoutRetryLoadingId(null);
      setActionBusyId(null);
    }
  };

  const handleCheckPayoutStatus = async (r) => {
    const id = r?.id;
    if (!id) return;
    setActionBusyId(id);
    setFetchError(null);
    setFetchErrorDetails(null);
    try {
      const { data: sessionData, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !sessionData?.session?.access_token) {
        setFetchError("Could not read your session. Sign in again.");
        setActionBusyId(null);
        return;
      }
      const res = await fetch(`/api/admin/withdrawals/${encodeURIComponent(id)}/reconcile`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFetchError(body?.error || `Reconcile failed (${res.status})`);
        setActionBusyId(null);
        return;
      }
      await fetchRows();
    } catch (err) {
      console.error("[admin/withdrawals] reconcile failed:", err);
      setFetchError(err?.message || "Could not check payout status.");
    }
    setActionBusyId(null);
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
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", marginBottom: "1rem" }}>Withdrawals</h1>
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
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.75rem" }}>Withdrawals</h1>
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
          <h2 style={{ color: "#0f172a", marginTop: 0 }}>Admin access required.</h2>
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

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "1rem", marginBottom: "0.75rem" }}>
          <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
            Withdrawal requests
          </h1>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#94a3b8" }}>
            Pending: <strong style={{ color: "#0f172a" }}>{pendingCount}</strong>
          </p>
        </div>

        <p style={{ margin: "0 0 1.25rem", fontSize: "0.875rem", color: "#64748b", lineHeight: 1.55, maxWidth: "42rem" }}>
          Pending withdrawals must be sent using the payout system before they are marked as paid.
        </p>

        <div style={{ ...cardBase, padding: "0.85rem 1rem", marginBottom: "1.25rem" }}>
          <button type="button" onClick={() => void fetchRows()} disabled={dataLoading} style={{ ...btnSm, marginTop: 0 }}>
            {dataLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {payoutSuccessMessage ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem",
              marginBottom: "1rem",
              borderColor: "#6ee7b7",
              background: "#ecfdf5",
            }}
          >
            <p style={{ margin: 0, color: "#047857", fontSize: "0.9rem", fontWeight: 600 }}>{payoutSuccessMessage}</p>
          </div>
        ) : null}

        {fetchError ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", borderColor: "#fecaca", background: "#fef2f2" }}>
            <p style={{ margin: "0 0 0.5rem", color: "#991b1b", fontSize: "0.9rem", fontWeight: 700 }}>{fetchError}</p>
            {fetchErrorDetails?.source === "paypal" ? (
              <PayPalPayoutErrorView error={fetchErrorDetails.payload} />
            ) : fetchErrorDetails?.source === "api" ? (
              <pre style={{ ...preErrorBox, marginTop: "0.35rem" }}>
                {JSON.stringify(fetchErrorDetails.payload, null, 2)}
              </pre>
            ) : fetchErrorDetails ? (
              <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "#7f1d1d", fontSize: "0.82rem", lineHeight: 1.5 }}>
                <li>code: {fetchErrorDetails.code != null ? String(fetchErrorDetails.code) : "—"}</li>
                <li>details: {fetchErrorDetails.details != null ? String(fetchErrorDetails.details) : "—"}</li>
                <li>hint: {fetchErrorDetails.hint != null ? String(fetchErrorDetails.hint) : "—"}</li>
                <li>message: {fetchErrorDetails.message != null ? String(fetchErrorDetails.message) : "—"}</li>
              </ul>
            ) : null}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            width: "100%",
            maxWidth: "100%",
            boxSizing: "border-box",
          }}
        >
          {dataLoading && rows.length === 0 ? (
            <p style={{ color: "#64748b", margin: 0 }}>Loading requests…</p>
          ) : sortedRows.length === 0 ? (
            <div style={{ ...cardBase, padding: "2.5rem 1.5rem", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: "0.95rem", color: "#64748b" }}>No withdrawal requests yet.</p>
            </div>
          ) : (
            sortedRows.map((r) => {
              const st = String(r?.status || "").toLowerCase();
              const busy = actionBusyId === r.id;
              const hasBatch = !!(r?.processor_batch_id && String(r.processor_batch_id).trim());
              const payoutEmail = String(r?.payout_email || r?.payout_destination || "").trim();
              const hasPayoutEmail = payoutEmail.length > 0;
              const canSendPayout = st === "pending" && hasPayoutEmail && !hasBatch;
              const canCheckStatus = st === "processing" && hasBatch;
              const canRetryPayout = st === "failed";
              const canRecordManual = st !== "paid" && st !== "rejected";
              const canMarkProcessing = st === "pending";
              const p = profilesMap[r.user_id];
              const failureReasonRaw = r?.failure_reason != null ? String(r.failure_reason) : "";
              const proc = r?.processor != null ? String(r.processor).trim() : "";
              const procStatus = r?.processor_status != null ? String(r.processor_status).trim() : "";
              const paidVia = r?.paid_via != null ? String(r.paid_via).trim() : "";
              const extRef = r?.external_reference != null ? String(r.external_reference).trim() : "";
              const paidAt = r?.paid_at;
              const showPrimaryActions = st === "pending" || st === "processing" || st === "failed" || canRecordManual;
              const showSecondaryActions = canMarkProcessing || canRecordManual;

              const btnBase = {
                padding: "0.5rem 0.9rem",
                fontSize: "0.8rem",
                borderRadius: "10px",
                fontWeight: 700,
                cursor: "pointer",
                boxSizing: "border-box",
              };
              const disabledStyle = busy ? { opacity: 0.55, cursor: "not-allowed" } : {};

              return (
                <div
                  key={r.id}
                  style={{
                    ...cardBase,
                    padding: "1.15rem 1.2rem",
                    width: "100%",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem 1rem",
                      marginBottom: "1rem",
                      paddingBottom: "1rem",
                      borderBottom: "1px solid #f1f5f9",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.05rem",
                        fontWeight: 700,
                        color: "#0f172a",
                        lineHeight: 1.3,
                        minWidth: 0,
                        flex: "1 1 12rem",
                      }}
                    >
                      {userLabel(p, r.user_id)}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "0.65rem 0.85rem",
                        marginLeft: "auto",
                      }}
                    >
                      <span style={{ fontSize: "1.05rem", fontWeight: 800, color: "#0f172a", whiteSpace: "nowrap" }}>
                        ${formatMoney(r?.amount)}
                      </span>
                      <span style={statusBadgeStyle(r?.status)}>{st || "—"}</span>
                    </div>
                  </div>

                  <div className="tc-withdrawal-detail-grid" style={{ marginBottom: "1.1rem" }}>
                    <WithdrawalDetail label="Request ID">{shortUuid(r.id)}</WithdrawalDetail>
                    <WithdrawalDetail label="User ID">{shortUuid(r.user_id)}</WithdrawalDetail>
                    <WithdrawalDetail label="Payout method">{payoutLabelCell(r)}</WithdrawalDetail>
                    {payoutEmail ? <WithdrawalDetail label="Payout email / destination">{payoutEmail}</WithdrawalDetail> : null}
                    {proc ? <WithdrawalDetail label="Processor">{proc}</WithdrawalDetail> : null}
                    {procStatus ? <WithdrawalDetail label="Processor status">{procStatus}</WithdrawalDetail> : null}
                    {hasBatch ? (
                      <WithdrawalDetail label="Batch ID">{shortUuid(String(r.processor_batch_id))}</WithdrawalDetail>
                    ) : null}
                    <WithdrawalDetail label="Created date">{formatWhen(r?.created_at)}</WithdrawalDetail>
                    {paidAt ? <WithdrawalDetail label="Paid date">{formatWhen(paidAt)}</WithdrawalDetail> : null}
                    {paidVia ? <WithdrawalDetail label="Paid via">{paidVia}</WithdrawalDetail> : null}
                    {extRef ? <WithdrawalDetail label="Reference">{extRef}</WithdrawalDetail> : null}
                  </div>

                  {failureReasonRaw.trim() ? <WithdrawalFailurePanel failureReason={failureReasonRaw} /> : null}

                  <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#64748b", marginBottom: "0.35rem" }}>
                    Admin note
                  </label>
                  <textarea
                    className="tc-admin-in"
                    rows={2}
                    value={adminNotesDraft[r.id] ?? ""}
                    onChange={(e) => setNoteDraft(r.id, e.target.value)}
                    placeholder="Internal note (required to reject)"
                    style={{ ...inputBase, resize: "vertical", minHeight: "52px", marginBottom: "1rem" }}
                    disabled={busy || st === "paid" || st === "rejected"}
                  />

                  {showPrimaryActions || showSecondaryActions ? (
                    <div
                      style={{
                        marginTop: "0.25rem",
                        paddingTop: "1rem",
                        borderTop: "1px solid #e2e8f0",
                      }}
                    >
                      {showPrimaryActions ? (
                        <div className="tc-withdrawal-actions-primary">
                          {st === "pending" ? (
                            <button
                              type="button"
                              style={{
                                ...btnBase,
                                border: "1px solid #15803d",
                                background: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)",
                                color: "#ffffff",
                                boxShadow: "0 2px 8px rgba(22, 163, 74, 0.25)",
                                ...disabledStyle,
                              }}
                              disabled={busy || !canSendPayout}
                              onClick={() => void handleSendPayout(r)}
                              title={!hasPayoutEmail ? "Missing payout email on withdrawal request." : undefined}
                            >
                              Send payout
                            </button>
                          ) : null}
                          {st === "processing" ? (
                            <button
                              type="button"
                              style={{
                                ...btnBase,
                                border: "1px solid #2563eb",
                                background: "linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)",
                                color: "#ffffff",
                                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.22)",
                                ...disabledStyle,
                              }}
                              disabled={busy || !canCheckStatus}
                              onClick={() => void handleCheckPayoutStatus(r)}
                            >
                              Check status
                            </button>
                          ) : null}
                          {st === "failed" ? (
                            <button
                              type="button"
                              style={{
                                ...btnBase,
                                border: "1px solid #d97706",
                                background: "linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)",
                                color: "#422006",
                                boxShadow: "0 2px 8px rgba(245, 158, 11, 0.25)",
                                ...disabledStyle,
                              }}
                              disabled={busy || !canRetryPayout}
                              onClick={() => void handleRetryPayout(r)}
                              title="Submits a new PayPal payout with retry: true (fresh idempotency key when needed)."
                            >
                              {payoutRetryLoadingId === r.id ? "Retrying..." : "Retry payout"}
                            </button>
                          ) : null}
                          {canRecordManual ? (
                            <button
                              type="button"
                              style={{
                                ...btnBase,
                                border: "1px solid #94a3b8",
                                background: "#ffffff",
                                color: "#475569",
                                fontWeight: 600,
                                ...disabledStyle,
                              }}
                              disabled={busy}
                              onClick={() => handleRecordManualPayout(r)}
                            >
                              Record manual payout
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {showSecondaryActions ? (
                        <div className="tc-withdrawal-actions-secondary">
                          {canMarkProcessing ? (
                            <button
                              type="button"
                              style={{
                                ...btnBase,
                                border: "1px solid #cbd5e1",
                                background: "#f8fafc",
                                color: "#334155",
                                fontWeight: 600,
                                ...disabledStyle,
                              }}
                              disabled={busy}
                              onClick={() => handleMarkProcessing(r)}
                            >
                              Mark processing
                            </button>
                          ) : null}
                          {canRecordManual ? (
                            <button
                              type="button"
                              style={{
                                ...btnBase,
                                border: "1px solid #fecaca",
                                background: "#fef2f2",
                                color: "#b91c1c",
                                fontWeight: 600,
                                ...disabledStyle,
                              }}
                              disabled={busy}
                              onClick={() => handleReject(r)}
                            >
                              Reject
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
