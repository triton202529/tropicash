import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { useUser } from "../../../lib/userContext";
import { isAdminUser } from "../../../lib/adminAccess";
import Navbar from "../../../components/Navbar";
import { normalizeRiskFlagsArray, recomputeAndPersistUserRiskState } from "../../../lib/riskFlags";
import { normalizeAccountFlags } from "../../../lib/accountControls";
import {
  formatFraudEventTypeLabel,
  logFraudNoteSaved,
  logFraudStatusChanged,
  summarizeFraudEventData,
} from "../../../lib/fraudEvents";
import { buildDefaultCaseTitleForFraudLog, createFraudCase, suggestPriorityForFraudLog } from "../../../lib/caseManagement";

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

function normalizeFlags(flags) {
  if (Array.isArray(flags)) return flags.map((f) => String(f));
  if (flags && typeof flags === "object") return Object.values(flags).map(String);
  return [];
}

function normalizeStatus(raw) {
  const v = String(raw || "").toLowerCase();
  if (v === "reviewed" || v === "escalated") return v;
  return "open";
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
  padding: "0.65rem 0.8rem",
  borderRadius: "10px",
  border: "1px solid #cbd5e1",
  fontSize: "0.95rem",
  boxSizing: "border-box",
  width: "100%",
  maxWidth: "100%",
  background: "#f4f6f9",
  color: "#0f172a",
};

const adminFocusCss = `
  .tc-admin-in:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .tc-admin-in::placeholder { color: #94a3b8; }
`;

const noteTextareaStyle = {
  ...inputBase,
  fontSize: "0.875rem",
  minHeight: "5rem",
  resize: "vertical",
};

const btnSm = {
  padding: "0.38rem 0.7rem",
  fontSize: "0.75rem",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  background: "linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)",
  cursor: "pointer",
  fontWeight: 600,
  color: "#0f172a",
  marginRight: "0.4rem",
  marginBottom: "0.35rem",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
};

function accountStatusBadgeStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === "restricted") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fca5a5",
      boxShadow: "0 1px 2px rgba(185, 28, 28, 0.12)",
    };
  }
  if (key === "under_review") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#fffbeb",
      color: "#9a3412",
      border: "1px solid #fcd34d",
      boxShadow: "0 1px 2px rgba(180, 83, 9, 0.1)",
    };
  }
  return {
    display: "inline-block",
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #6ee7b7",
    boxShadow: "0 1px 2px rgba(4, 120, 87, 0.1)",
  };
}

function riskBadgeStyle(level) {
  const key = String(level || "").toLowerCase();
  if (key === "high") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fca5a5",
      boxShadow: "0 1px 2px rgba(185, 28, 28, 0.12)",
    };
  }
  if (key === "medium") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#fffbeb",
      color: "#9a3412",
      border: "1px solid #fcd34d",
      boxShadow: "0 1px 2px rgba(180, 83, 9, 0.1)",
    };
  }
  return {
    display: "inline-block",
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #6ee7b7",
    boxShadow: "0 1px 2px rgba(4, 120, 87, 0.1)",
  };
}

function statusBadgeStyle(status) {
  const key = normalizeStatus(status);
  if (key === "reviewed") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      background: "#ecfdf5",
      color: "#047857",
      border: "1px solid #a7f3d0",
    };
  }
  if (key === "escalated") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
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
    letterSpacing: "0.04em",
    background: "#f1f5f9",
    color: "#64748b",
    border: "1px solid #e2e8f0",
  };
}

function chipStyle() {
  return {
    display: "inline-block",
    padding: "0.15rem 0.45rem",
    marginRight: "0.35rem",
    marginBottom: "0.25rem",
    borderRadius: "6px",
    fontSize: "0.7rem",
    fontWeight: 600,
    background: "#f1f5f9",
    color: "#0f172a",
    border: "1px solid #e2e8f0",
  };
}

const labelMuted = {
  fontSize: "0.72rem",
  fontWeight: 600,
  color: "#94a3b8",
  marginBottom: "0.25rem",
};

const valueRow = { marginBottom: "0.65rem" };

export default function AdminFraudDetailPage() {
  const router = useRouter();
  const { id: routeId } = router.query;
  const id = typeof routeId === "string" ? routeId : Array.isArray(routeId) ? routeId[0] : null;

  const { user, profile: sessionProfile, loading: authLoading } = useUser();

  const [pageLoading, setPageLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  const [log, setLog] = useState(null);
  const [profile, setProfile] = useState(null);
  const [relatedTx, setRelatedTx] = useState(null);
  const [relatedTxChecked, setRelatedTxChecked] = useState(false);
  const [otherLogs, setOtherLogs] = useState([]);

  const [noteDraft, setNoteDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [caseOpening, setCaseOpening] = useState(false);

  const reloadFraudEvents = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("fraud_events")
      .select("id, created_at, event_type, actor_user_id, event_data")
      .eq("fraud_log_id", id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) {
      console.error(error);
      setTimelineEvents([]);
      return;
    }
    setTimelineEvents(data || []);
  }, [id]);

  const loadDetail = useCallback(async () => {
    if (!id || !user?.id || !isAdminUser(user, sessionProfile)) return;

    setPageLoading(true);
    setFetchError(null);
    setNotFound(false);
    setLog(null);
    setProfile(null);
    setRelatedTx(null);
    setRelatedTxChecked(false);
    setOtherLogs([]);
    setTimelineEvents([]);

    const fraudSelect =
      "id, user_id, transaction_type, amount, risk_score, risk_level, flags, related_transaction_id, created_at, status, review_note, reviewed_by, reviewed_at";

    const { data: row, error: logErr } = await supabase
      .from("fraud_logs")
      .select(fraudSelect)
      .eq("id", id)
      .maybeSingle();

    if (logErr) {
      console.error(logErr);
      setFetchError(logErr.message || "Failed to load fraud log.");
      setPageLoading(false);
      return;
    }

    if (!row) {
      setNotFound(true);
      setPageLoading(false);
      return;
    }

    setLog(row);
    setNoteDraft(row.review_note ?? "");

    const userId = row.user_id;
    const relId = row.related_transaction_id;

    const profilePromise =
      userId
        ? supabase
            .from("profiles")
            .select(
              "id, full_name, email, phone, risk_level, risk_flags, risk_score_snapshot, risk_last_evaluated_at, account_status, account_flags, account_last_reviewed_at"
            )
            .eq("id", userId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

    const txPromise =
      relId
        ? supabase
            .from("transactions")
            .select(
              "id, sender_id, recipient_id, amount, type, created_at, status, source, description, note"
            )
            .eq("id", relId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

    const othersPromise =
      userId
        ? supabase
            .from("fraud_logs")
            .select(
              "id, created_at, transaction_type, amount, risk_score, risk_level, status"
            )
            .eq("user_id", userId)
            .neq("id", id)
            .order("created_at", { ascending: false })
            .limit(10)
        : Promise.resolve({ data: [], error: null });

    const [profRes, txRes, othersRes] = await Promise.all([
      profilePromise,
      txPromise,
      othersPromise,
    ]);

    if (profRes.error) {
      console.error(profRes.error);
      setProfile(null);
    } else {
      setProfile(profRes.data || null);
    }

    if (relId) {
      setRelatedTxChecked(true);
      if (txRes.error) {
        console.error(txRes.error);
        setRelatedTx(null);
      } else {
        setRelatedTx(txRes.data || null);
      }
    } else {
      setRelatedTxChecked(true);
      setRelatedTx(null);
    }

    if (othersRes.error) {
      console.error(othersRes.error);
      setOtherLogs([]);
    } else {
      setOtherLogs(othersRes.data || []);
    }

    await reloadFraudEvents();

    setPageLoading(false);
  }, [id, user?.id, user, sessionProfile, reloadFraudEvents]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id || !isAdminUser(user, sessionProfile)) {
      setPageLoading(false);
      return;
    }
    if (!router.isReady || !id) return;
    loadDetail();
  }, [authLoading, user?.id, user, sessionProfile, router.isReady, id, loadDetail]);

  async function updateFraudStatus(logId, nextStatus) {
    if (!user?.id) {
      console.error("updateFraudStatus: missing current user id");
      return { ok: false, error: new Error("Not signed in") };
    }

    const previousStatus = log ? normalizeStatus(log.status) : "open";

    setStatusBusy(true);
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("fraud_logs")
        .update({
          status: nextStatus,
          reviewed_by: user.id,
          reviewed_at: now,
        })
        .eq("id", logId)
        .select(
          "id, user_id, transaction_type, amount, risk_score, risk_level, flags, related_transaction_id, created_at, status, review_note, reviewed_by, reviewed_at"
        )
        .maybeSingle();

      if (error) {
        console.error("updateFraudStatus:", error);
        return { ok: false, error };
      }

      if (data) {
        setLog(data);
        await logFraudStatusChanged(supabase, {
          fraudLogId: logId,
          userId: data.user_id,
          actorUserId: user.id,
          previousStatus,
          nextStatus,
          reviewedAt: now,
        });
        const uid = data.user_id;
        if (uid) {
          try {
            const rec = await recomputeAndPersistUserRiskState(supabase, uid, {
              actorUserId: user.id,
              fraudLogId: logId,
            });
            if (rec.ok) {
              const { data: p2, error: p2e } = await supabase
                .from("profiles")
                .select(
                  "id, full_name, email, phone, risk_level, risk_flags, risk_score_snapshot, risk_last_evaluated_at, account_status, account_flags, account_last_reviewed_at"
                )
                .eq("id", uid)
                .maybeSingle();
              if (!p2e && p2) setProfile(p2);
            }
          } catch (e) {
            console.error(e);
          }
        }
        await reloadFraudEvents();
      }

      return { ok: true, data };
    } finally {
      setStatusBusy(false);
    }
  }

  async function saveReviewNote(logId, note) {
    if (!user?.id) {
      console.error("saveReviewNote: missing current user id");
      return { ok: false, error: new Error("Not signed in") };
    }

    setNoteBusy(true);
    try {
      const trimmed = note.trim() === "" ? null : note.trim();

      const { data, error } = await supabase
        .from("fraud_logs")
        .update({ review_note: trimmed })
        .eq("id", logId)
        .select(
          "id, user_id, transaction_type, amount, risk_score, risk_level, flags, related_transaction_id, created_at, status, review_note, reviewed_by, reviewed_at"
        )
        .maybeSingle();

      if (error) {
        console.error("saveReviewNote:", error);
        return { ok: false, error };
      }

      if (data) {
        setLog(data);
        setNoteDraft(data.review_note ?? "");
        await logFraudNoteSaved(supabase, {
          fraudLogId: logId,
          userId: data.user_id,
          actorUserId: user.id,
          note,
        });
        await reloadFraudEvents();
      }

      return { ok: true, data };
    } finally {
      setNoteBusy(false);
    }
  }

  async function handleOpenCase() {
    if (!user?.id || !log?.user_id || !log?.id) return;
    setCaseOpening(true);
    try {
      const res = await createFraudCase(supabase, {
        userId: log.user_id,
        primaryFraudLogId: log.id,
        title: buildDefaultCaseTitleForFraudLog(log),
        summary: null,
        priority: suggestPriorityForFraudLog(log, profile),
        status: "open",
        openedBy: user.id,
      });
      if (res.ok && res.caseId) {
        await router.push(`/admin/cases/${encodeURIComponent(res.caseId)}`);
      } else if (!res.ok) {
        console.error(res.error);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCaseOpening(false);
    }
  }

  const busy = noteBusy || statusBusy || caseOpening;

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

  if (!authLoading && user && !isAdminUser(user, sessionProfile)) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Not authorized</h2>
        <p>This area is restricted to admin users.</p>
      </div>
    );
  }

  if (!router.isReady || !id) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading…</p>
        </div>
      </>
    );
  }

  if (pageLoading && !fetchError && !notFound) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading fraud log…</p>
        </div>
      </>
    );
  }

  if (fetchError) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <Link
            href="/admin/fraud"
            style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.9rem" }}
          >
            ← Back to fraud dashboard
          </Link>
          <div
            style={{
              ...cardBase,
              marginTop: "1rem",
              padding: "1rem 1.15rem",
              background: "#fef2f2",
              borderColor: "#fecaca",
              color: "#b91c1c",
              fontSize: "0.9rem",
            }}
          >
            {fetchError}
          </div>
        </div>
      </>
    );
  }

  if (notFound || !log) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <Link
            href="/admin/fraud"
            style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.9rem" }}
          >
            ← Back to fraud dashboard
          </Link>
          <div style={{ ...cardBase, marginTop: "1rem", padding: "1.25rem" }}>
            <p style={{ margin: 0, color: "#64748b" }}>Fraud log not found.</p>
          </div>
        </div>
      </>
    );
  }

  const flags = normalizeFlags(log.flags);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: adminFocusCss }} />
      <Navbar />
      <div style={pageWrap}>
        <Link
          href="/admin/fraud"
          style={{
            display: "inline-block",
            marginBottom: "1rem",
            fontWeight: 600,
            color: "#0ea5e9",
            fontSize: "0.9rem",
          }}
        >
          ← Back to fraud dashboard
        </Link>

        {/* Section A — Header */}
        <div
          style={{
            ...cardBase,
            padding: "1.1rem 1.25rem",
            marginBottom: "1rem",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.75rem 1rem",
          }}
        >
          <div style={{ flex: "1 1 200px" }}>
            <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8" }}>
              FRAUD LOG ID
            </p>
            <p
              style={{
                margin: "0.35rem 0 0",
                fontSize: "0.85rem",
                fontWeight: 600,
                color: "#0f172a",
                wordBreak: "break-all",
              }}
            >
              {log.id}
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
            <span style={statusBadgeStyle(log.status)}>{normalizeStatus(log.status)}</span>
            <span style={riskBadgeStyle(log.risk_level)}>{log.risk_level || "—"}</span>
            <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
              Score:{" "}
              <strong style={{ fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
                {log.risk_score ?? "—"}
              </strong>
            </span>
            <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
              {formatWhen(log.created_at)}
            </span>
          </div>
          <div style={{ marginLeft: "auto", flex: "0 0 auto" }}>
            <button
              type="button"
              disabled={busy}
              onClick={handleOpenCase}
              style={{
                ...btnSm,
                marginRight: 0,
                marginBottom: 0,
                background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
                borderColor: "#93c5fd",
                color: "#1e40af",
                fontWeight: 700,
                opacity: busy ? 0.65 : 1,
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {caseOpening ? "Opening…" : "Open Case"}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          {/* Section B — Fraud Summary */}
          <div style={{ ...cardBase, padding: "1.1rem 1.25rem" }}>
            <h2
              style={{
                margin: "0 0 0.85rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#64748b",
              }}
            >
              Fraud summary
            </h2>
            <div style={valueRow}>
              <div style={labelMuted}>Transaction type</div>
              <div style={{ fontWeight: 600, textTransform: "lowercase" }}>
                {log.transaction_type || "—"}
              </div>
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Amount</div>
              <div style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                ${formatMoney(log.amount)}
              </div>
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Flags</div>
              {flags.length === 0 ? (
                <span style={{ color: "#94a3b8" }}>—</span>
              ) : (
                <div>
                  {flags.map((f, i) => (
                    <span key={`${log.id}-f-${i}`} style={chipStyle()}>
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Related transaction</div>
              {log.related_transaction_id ? (
                <Link
                  href={`/transactions/${log.related_transaction_id}`}
                  style={{ color: "#0ea5e9", fontWeight: 600, wordBreak: "break-all", fontSize: "0.85rem" }}
                >
                  {log.related_transaction_id}
                </Link>
              ) : (
                <span style={{ color: "#94a3b8" }}>—</span>
              )}
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Reviewed by</div>
              <div style={{ fontSize: "0.875rem", wordBreak: "break-all" }}>{log.reviewed_by || "—"}</div>
            </div>
            <div style={{ marginBottom: 0 }}>
              <div style={labelMuted}>Reviewed at</div>
              <div style={{ fontSize: "0.875rem" }}>{formatWhen(log.reviewed_at)}</div>
            </div>
          </div>

          {/* Section C — User profile */}
          <div style={{ ...cardBase, padding: "1.1rem 1.25rem" }}>
            <h2
              style={{
                margin: "0 0 0.85rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#64748b",
              }}
            >
              User profile
            </h2>
            <div style={valueRow}>
              <div style={labelMuted}>Full name</div>
              <div style={{ fontWeight: 600 }}>{profile?.full_name?.trim() || "—"}</div>
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Email</div>
              <div style={{ fontSize: "0.875rem", wordBreak: "break-all" }}>
                {profile?.email?.trim() || "—"}
              </div>
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Phone</div>
              <div style={{ fontSize: "0.875rem" }}>{profile?.phone || "—"}</div>
            </div>
            {log.user_id ? (
              <div style={valueRow}>
                <div style={labelMuted}>Stored account risk</div>
                {!profile ? (
                  <span style={{ fontSize: "0.875rem", color: "#94a3b8" }}>No profile row for this user.</span>
                ) : (
                  <>
                    <div style={{ marginBottom: "0.35rem" }}>
                      <span style={riskBadgeStyle(profile.risk_level || "low")}>{profile.risk_level || "—"}</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.35rem" }}>
                      Score snapshot:{" "}
                      <strong style={{ fontVariantNumeric: "tabular-nums", color: "#0f172a" }}>
                        {profile.risk_score_snapshot != null
                          ? Number(profile.risk_score_snapshot).toFixed(1)
                          : "—"}
                      </strong>
                      {" · "}
                      Updated {formatWhen(profile.risk_last_evaluated_at)}
                    </div>
                    <div>
                      {normalizeRiskFlagsArray(profile.risk_flags).length === 0 ? (
                        <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>No flags stored yet.</span>
                      ) : (
                        normalizeRiskFlagsArray(profile.risk_flags).map((f, i) => (
                          <span key={`pfr-${i}-${f}`} style={chipStyle()}>
                            {f}
                          </span>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : null}
            {log.user_id && profile ? (
              <div style={valueRow}>
                <div style={labelMuted}>Account control</div>
                <div style={{ marginBottom: "0.35rem" }}>
                  <span style={accountStatusBadgeStyle(profile.account_status || "active")}>
                    {String(profile.account_status || "active").replace(/_/g, " ")}
                  </span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "#64748b", marginBottom: "0.35rem" }}>
                  Last reviewed {formatWhen(profile.account_last_reviewed_at)}
                </div>
                <div>
                  {normalizeAccountFlags(profile.account_flags).length === 0 ? (
                    <span style={{ color: "#94a3b8", fontSize: "0.875rem" }}>No control flags.</span>
                  ) : (
                    normalizeAccountFlags(profile.account_flags).map((f, i) => (
                      <span key={`acf-${i}-${f}`} style={chipStyle()}>
                        {f}
                      </span>
                    ))
                  )}
                </div>
              </div>
            ) : null}
            <div style={{ marginBottom: 0 }}>
              <div style={labelMuted}>User ID</div>
              <div style={{ fontSize: "0.8rem", wordBreak: "break-all", color: "#0f172a" }}>
                {log.user_id || "—"}
              </div>
              {log.user_id ? (
                <div style={{ marginTop: "0.5rem", display: "flex", flexWrap: "wrap", gap: "0.65rem", alignItems: "center" }}>
                  <Link
                    href={`/admin/risk-users/${encodeURIComponent(log.user_id)}`}
                    style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.8rem" }}
                  >
                    User risk profile →
                  </Link>
                  <Link
                    href={`/admin/users/${encodeURIComponent(log.user_id)}/timeline`}
                    style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.8rem" }}
                  >
                    Investigation timeline →
                  </Link>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Section D — Related transaction */}
        <div style={{ ...cardBase, padding: "1.1rem 1.25rem", marginBottom: "1rem" }}>
          <h2
            style={{
              margin: "0 0 0.85rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Related transaction
          </h2>
          {!log.related_transaction_id ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#94a3b8" }}>
              No related transaction linked to this log.
            </p>
          ) : !relatedTxChecked ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>Loading…</p>
          ) : !relatedTx ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#94a3b8" }}>
              No transaction row found for this ID (it may have been removed or is inaccessible).
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "0.65rem 1rem",
                fontSize: "0.875rem",
              }}
            >
              {[
                ["Transaction ID", relatedTx.id],
                ["Sender ID", relatedTx.sender_id],
                ["Recipient ID", relatedTx.recipient_id],
                ["Amount", `$${formatMoney(relatedTx.amount)}`],
                ["Type", relatedTx.type],
                ["Status", relatedTx.status],
                ["Source", relatedTx.source],
                ["Description", relatedTx.description],
                ["Note", relatedTx.note],
                ["Created", formatWhen(relatedTx.created_at)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={labelMuted}>{k}</div>
                  <div style={{ wordBreak: "break-all", color: "#0f172a" }}>
                    {v === null || v === undefined || v === "" ? "—" : String(v)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section E — Review workflow */}
        <div style={{ ...cardBase, padding: "1.1rem 1.25rem", marginBottom: "1rem" }}>
          <h2
            style={{
              margin: "0 0 0.85rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Review
          </h2>
          <label htmlFor="fraud-detail-note" style={{ ...labelMuted, display: "block" }}>
            Review note
          </label>
          <textarea
            id="fraud-detail-note"
            className="tc-admin-in"
            value={noteDraft}
            disabled={busy}
            onChange={(e) => setNoteDraft(e.target.value)}
            style={{
              ...noteTextareaStyle,
              opacity: busy ? 0.65 : 1,
              cursor: busy ? "not-allowed" : "text",
            }}
            placeholder="Add investigation notes…"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => saveReviewNote(log.id, noteDraft)}
            style={{
              ...btnSm,
              marginTop: "0.5rem",
              background: "#f8fafc",
            }}
          >
            {noteBusy ? "Saving…" : "Save note"}
          </button>
          <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #f1f5f9" }}>
            <div style={{ ...labelMuted, marginBottom: "0.5rem" }}>Status actions</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.15rem" }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => updateFraudStatus(log.id, "reviewed")}
                style={{
                  ...btnSm,
                  opacity: busy ? 0.65 : 1,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                Mark reviewed
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => updateFraudStatus(log.id, "escalated")}
                style={{
                  ...btnSm,
                  opacity: busy ? 0.65 : 1,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                Escalate
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => updateFraudStatus(log.id, "open")}
                style={{
                  ...btnSm,
                  marginRight: 0,
                  opacity: busy ? 0.65 : 1,
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                Reopen
              </button>
            </div>
            {statusBusy ? (
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>Updating status…</p>
            ) : null}
          </div>
        </div>

        {/* Fraud event timeline */}
        <div style={{ ...cardBase, padding: "1.1rem 1.25rem", marginBottom: "1rem" }}>
          <h2
            style={{
              margin: "0 0 0.75rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Fraud event timeline
          </h2>
          {timelineEvents.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>No events recorded yet.</p>
          ) : (
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {timelineEvents.map((ev) => (
                <li
                  key={ev.id}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    padding: "0.55rem 0",
                    fontSize: "0.8125rem",
                  }}
                >
                  <div style={{ color: "#64748b", fontSize: "0.72rem" }}>{formatWhen(ev.created_at)}</div>
                  <div style={{ fontWeight: 600, color: "#0f172a" }}>
                    {formatFraudEventTypeLabel(ev.event_type)}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                    Actor: {ev.actor_user_id ? String(ev.actor_user_id) : "—"}
                  </div>
                  <div style={{ marginTop: "0.2rem", color: "#475569" }}>
                    {summarizeFraudEventData(ev.event_type, ev.event_data)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Section F — Other fraud logs */}
        <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1.1rem 1.25rem", borderBottom: "1px solid #f1f5f9" }}>
            <h2
              style={{
                margin: 0,
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#64748b",
              }}
            >
              Other fraud logs for this user
            </h2>
          </div>
          {otherLogs.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, fontSize: "0.875rem", color: "#94a3b8" }}>
              No other fraud logs for this user.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.8125rem",
                }}
              >
                <thead>
                  <tr style={{ background: "linear-gradient(180deg, #f1f5f9 0%, #e8eef5 100%)", borderBottom: "1px solid #cbd5e1" }}>
                    {["Created", "Type", "Amount", "Score", "Level", "Status", "Detail"].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "0.65rem 0.75rem",
                          fontWeight: 700,
                          color: "#94a3b8",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {otherLogs.map((r) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "0.65rem 0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                        {formatWhen(r.created_at)}
                      </td>
                      <td style={{ padding: "0.65rem 0.75rem", textTransform: "lowercase" }}>
                        {r.transaction_type || "—"}
                      </td>
                      <td
                        style={{
                          padding: "0.65rem 0.75rem",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: 600,
                        }}
                      >
                        ${formatMoney(r.amount)}
                      </td>
                      <td style={{ padding: "0.65rem 0.75rem", fontVariantNumeric: "tabular-nums" }}>
                        {r.risk_score ?? "—"}
                      </td>
                      <td style={{ padding: "0.65rem 0.75rem" }}>
                        <span style={riskBadgeStyle(r.risk_level)}>{r.risk_level || "—"}</span>
                      </td>
                      <td style={{ padding: "0.65rem 0.75rem" }}>
                        <span style={statusBadgeStyle(r.status)}>{normalizeStatus(r.status)}</span>
                      </td>
                      <td style={{ padding: "0.65rem 0.75rem" }}>
                        <Link
                          href={`/admin/fraud/${r.id}`}
                          style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.8rem" }}
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
