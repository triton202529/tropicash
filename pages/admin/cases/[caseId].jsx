import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { supabase } from "../../../lib/supabaseClient";
import { useUser } from "../../../lib/userContext";
import { isAdminUser } from "../../../lib/adminAccess";
import Navbar from "../../../components/Navbar";
import { addFraudCaseNote, fetchFraudCaseWithNotes, updateFraudCase } from "../../../lib/caseManagement";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "1200px",
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
  marginRight: "0.35rem",
  marginBottom: "0.35rem",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
};

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatMoney(value) {
  const n = Number(value);
  return Number(Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function userLabel(p) {
  if (p?.full_name?.trim()) return p.full_name.trim();
  if (p?.email?.trim()) return p.email.trim();
  return null;
}

function caseStatusBadgeStyle(status) {
  const key = String(status || "").toLowerCase();
  if (key === "resolved") {
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
  if (key === "escalated") {
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
  if (key === "in_review") {
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

function casePriorityBadgeStyle(priority) {
  const key = String(priority || "").toLowerCase();
  if (key === "critical") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fca5a5",
    };
  }
  if (key === "high") {
    return {
      display: "inline-block",
      padding: "0.2rem 0.55rem",
      borderRadius: "999px",
      fontSize: "0.72rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fff7ed",
      color: "#c2410c",
      border: "1px solid #fdba74",
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
      background: "#fffbeb",
      color: "#9a3412",
      border: "1px solid #fcd34d",
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
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fca5a5",
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
      background: "#fffbeb",
      color: "#9a3412",
      border: "1px solid #fcd34d",
    };
  }
  return {
    display: "inline-block",
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #6ee7b7",
  };
}

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
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fca5a5",
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
      background: "#fffbeb",
      color: "#9a3412",
      border: "1px solid #fcd34d",
    };
  }
  return {
    display: "inline-block",
    padding: "0.2rem 0.55rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #6ee7b7",
  };
}

const labelMuted = {
  fontSize: "0.72rem",
  fontWeight: 600,
  color: "#94a3b8",
  marginBottom: "0.25rem",
};

const valueRow = { marginBottom: "0.65rem" };

export default function AdminCaseDetailPage() {
  const router = useRouter();
  const rawId = router.query?.caseId;
  const caseId =
    typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] : null;

  const { user, profile: sessionProfile, loading: authLoading } = useUser();

  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [fraudCase, setFraudCase] = useState(null);
  const [notes, setNotes] = useState([]);
  const [subjectProfile, setSubjectProfile] = useState(null);
  const [fraudLog, setFraudLog] = useState(null);
  const [extraProfiles, setExtraProfiles] = useState({});

  const [noteDraft, setNoteDraft] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    if (!caseId || !user?.id || !isAdminUser(user, sessionProfile)) return;
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetchFraudCaseWithNotes(supabase, caseId);
      if (!res.ok) {
        if (res.error?.message === "not_found" || String(res.error) === "not_found") {
          setFraudCase(null);
          setFetchError(null);
        } else {
          console.error(res.error);
          setFetchError(res.error?.message || "Failed to load case.");
          setFraudCase(null);
        }
        setLoading(false);
        return;
      }
      const bundle = res.data;
      if (!bundle?.fraudCase) {
        setFraudCase(null);
        setLoading(false);
        return;
      }
      setFraudCase(bundle.fraudCase);
      setNotes(bundle.notes || []);
      setSubjectProfile(bundle.profile || null);
      setFraudLog(bundle.fraudLog || null);

      const fc = bundle.fraudCase;
      const ids = [fc.opened_by, fc.resolved_by, fc.assigned_to, ...(bundle.notes || []).map((n) => n.author_user_id)].filter(
        Boolean
      );
      const unique = [...new Set(ids)];
      if (unique.length === 0) {
        setExtraProfiles({});
      } else {
        const { data: profs, error: pe } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", unique);
        if (pe) {
          console.error(pe);
          setExtraProfiles({});
        } else {
          setExtraProfiles(Object.fromEntries((profs || []).map((p) => [p.id, p])));
        }
      }
    } catch (e) {
      console.error(e);
      setFetchError(e?.message || "Failed to load case.");
      setFraudCase(null);
    } finally {
      setLoading(false);
    }
  }, [caseId, user?.id, user, sessionProfile]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id || !isAdminUser(user, sessionProfile)) return;
    if (!router.isReady || !caseId) return;
    void load();
  }, [authLoading, user?.id, user, sessionProfile, router.isReady, caseId, load]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, sessionProfile)) return;
    if (!router.isReady || !caseId) return;

    const ch1 = supabase
      .channel(`case-detail-row-${caseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "fraud_cases",
          filter: `id=eq.${caseId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") console.error("fraud_cases realtime:", err);
      });

    const ch2 = supabase
      .channel(`case-detail-notes-${caseId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "fraud_case_notes",
          filter: `case_id=eq.${caseId}`,
        },
        () => {
          void load();
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") console.error("fraud_case_notes realtime:", err);
      });

    return () => {
      void supabase.removeChannel(ch1);
      void supabase.removeChannel(ch2);
    };
  }, [authLoading, user?.id, user, sessionProfile, router.isReady, caseId, load]);

  const actorLabel = useCallback(
    (uid) => {
      if (!uid) return "—";
      const p = extraProfiles[uid];
      return userLabel(p) || `${String(uid).slice(0, 8)}…`;
    },
    [extraProfiles]
  );

  async function setStatus(next) {
    if (!fraudCase || !user?.id) return;
    setActionBusy(true);
    try {
      const prev = String(fraudCase.status || "");
      const res = await updateFraudCase(supabase, {
        caseId: fraudCase.id,
        userId: fraudCase.user_id,
        fraudLogId: fraudCase.primary_fraud_log_id,
        actorUserId: user.id,
        previousStatus: prev,
        patch: { status: next },
      });
      if (!res.ok) console.error(res.error);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setActionBusy(false);
    }
  }

  async function assignToMe() {
    if (!fraudCase || !user?.id) return;
    setActionBusy(true);
    try {
      const res = await updateFraudCase(supabase, {
        caseId: fraudCase.id,
        userId: fraudCase.user_id,
        fraudLogId: fraudCase.primary_fraud_log_id,
        actorUserId: user.id,
        previousStatus: String(fraudCase.status || ""),
        patch: { assigned_to: user.id },
      });
      if (!res.ok) console.error(res.error);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setActionBusy(false);
    }
  }

  async function saveNote() {
    if (!fraudCase || !user?.id) return;
    const t = noteDraft.trim();
    if (!t) return;
    setNoteBusy(true);
    try {
      const res = await addFraudCaseNote(supabase, {
        caseId: fraudCase.id,
        note: t,
        authorUserId: user.id,
        auditUserId: user.id,
        subjectUserId: fraudCase.user_id,
        fraudLogId: fraudCase.primary_fraud_log_id,
      });
      if (!res.ok) console.error(res.error);
      else setNoteDraft("");
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setNoteBusy(false);
    }
  }

  const subjectName = useMemo(() => userLabel(subjectProfile) || fraudCase?.user_id || "—", [subjectProfile, fraudCase]);

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

  if (!authLoading && user && !isAdminUser(user, sessionProfile)) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Not authorized</h2>
        <p>This area is restricted to admin users.</p>
      </div>
    );
  }

  if (!router.isReady || !caseId) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading…</p>
        </div>
      </>
    );
  }

  if (loading && !fraudCase && !fetchError) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <p style={{ color: "#64748b" }}>Loading case…</p>
        </div>
      </>
    );
  }

  if (fetchError) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <Link href="/admin/cases" style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.9rem" }}>
            ← Back to cases
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

  if (!fraudCase) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <Link href="/admin/cases" style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.9rem" }}>
            ← Back to cases
          </Link>
          <div style={{ ...cardBase, marginTop: "1rem", padding: "1.25rem" }}>
            <p style={{ margin: 0, color: "#64748b" }}>Case not found.</p>
          </div>
        </div>
      </>
    );
  }

  const busy = noteBusy || actionBusy;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: adminFocusCss }} />
      <Navbar />
      <div style={pageWrap}>
        <Link href="/admin/cases" style={{ display: "inline-block", marginBottom: "1rem", fontWeight: 600, color: "#0ea5e9", fontSize: "0.9rem" }}>
          ← Back to cases
        </Link>

        <div style={{ ...cardBase, padding: "1.1rem 1.25rem", marginBottom: "1rem" }}>
          <p style={{ margin: 0, fontSize: "0.72rem", fontWeight: 700, color: "#94a3b8" }}>CASE</p>
          <h1 style={{ margin: "0.35rem 0 0", fontSize: "1.35rem", fontWeight: 700, color: "#0f172a" }}>{fraudCase.title}</h1>
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "#64748b", wordBreak: "break-all" }}>{fraudCase.id}</p>
          {fraudCase.summary ? (
            <p style={{ margin: "0.75rem 0 0", fontSize: "0.9rem", color: "#475569", lineHeight: 1.45 }}>{fraudCase.summary}</p>
          ) : null}
          <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <span style={caseStatusBadgeStyle(fraudCase.status)}>{String(fraudCase.status || "").replace(/_/g, " ")}</span>
            <span style={casePriorityBadgeStyle(fraudCase.priority)}>{String(fraudCase.priority || "").toLowerCase()}</span>
          </div>
        </div>

        <div style={{ ...cardBase, padding: "1.1rem 1.25rem", marginBottom: "1rem" }}>
          <h2
            style={{
              margin: "0 0 0.85rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Case details
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.65rem 1rem" }}>
            <div style={valueRow}>
              <div style={labelMuted}>User</div>
              <div style={{ fontWeight: 600, color: "#0f172a" }}>{subjectName}</div>
              <div style={{ fontSize: "0.75rem", color: "#64748b", wordBreak: "break-all" }}>{fraudCase.user_id}</div>
              <div style={{ marginTop: "0.35rem" }}>
                <Link href={`/admin/risk-users/${encodeURIComponent(fraudCase.user_id)}`} style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.8rem" }}>
                  User risk
                </Link>
                {" · "}
                <Link href={`/admin/users/${encodeURIComponent(fraudCase.user_id)}/timeline`} style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.8rem" }}>
                  Timeline
                </Link>
              </div>
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Primary fraud log</div>
              {fraudCase.primary_fraud_log_id ? (
                <Link
                  href={`/admin/fraud/${encodeURIComponent(fraudCase.primary_fraud_log_id)}`}
                  style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.85rem", wordBreak: "break-all" }}
                >
                  {fraudCase.primary_fraud_log_id}
                </Link>
              ) : (
                <span style={{ color: "#94a3b8" }}>—</span>
              )}
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Assigned to</div>
              <div style={{ fontSize: "0.875rem", color: "#0f172a" }}>{actorLabel(fraudCase.assigned_to)}</div>
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Opened by</div>
              <div style={{ fontSize: "0.875rem", color: "#0f172a" }}>{actorLabel(fraudCase.opened_by)}</div>
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Resolved by</div>
              <div style={{ fontSize: "0.875rem", color: "#0f172a" }}>{actorLabel(fraudCase.resolved_by)}</div>
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Opened at</div>
              <div style={{ fontSize: "0.875rem" }}>{formatWhen(fraudCase.opened_at)}</div>
            </div>
            <div style={valueRow}>
              <div style={labelMuted}>Updated at</div>
              <div style={{ fontSize: "0.875rem" }}>{formatWhen(fraudCase.updated_at)}</div>
            </div>
            <div style={{ marginBottom: 0 }}>
              <div style={labelMuted}>Resolved at</div>
              <div style={{ fontSize: "0.875rem" }}>{formatWhen(fraudCase.resolved_at)}</div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1rem",
            marginBottom: "1rem",
          }}
        >
          <div style={{ ...cardBase, padding: "1.1rem 1.25rem" }}>
            <h2
              style={{
                margin: "0 0 0.85rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              User profile
            </h2>
            {!subjectProfile ? (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>No profile row (or could not load).</p>
            ) : (
              <>
                <div style={valueRow}>
                  <div style={labelMuted}>Full name</div>
                  <div style={{ fontWeight: 600 }}>{subjectProfile.full_name?.trim() || "—"}</div>
                </div>
                <div style={valueRow}>
                  <div style={labelMuted}>Email</div>
                  <div style={{ fontSize: "0.875rem", wordBreak: "break-all" }}>{subjectProfile.email?.trim() || "—"}</div>
                </div>
                <div style={valueRow}>
                  <div style={labelMuted}>Phone</div>
                  <div style={{ fontSize: "0.875rem" }}>{subjectProfile.phone || "—"}</div>
                </div>
                <div style={valueRow}>
                  <div style={labelMuted}>Risk level</div>
                  <span style={riskBadgeStyle(subjectProfile.risk_level)}>{String(subjectProfile.risk_level || "—").toLowerCase()}</span>
                </div>
                <div style={{ marginBottom: 0 }}>
                  <div style={labelMuted}>Account status</div>
                  <span style={accountStatusBadgeStyle(subjectProfile.account_status || "active")}>
                    {String(subjectProfile.account_status || "active").replace(/_/g, " ")}
                  </span>
                </div>
              </>
            )}
          </div>

          <div style={{ ...cardBase, padding: "1.1rem 1.25rem" }}>
            <h2
              style={{
                margin: "0 0 0.85rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              Primary fraud log
            </h2>
            {!fraudCase.primary_fraud_log_id ? (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>No primary fraud log linked.</p>
            ) : !fraudLog ? (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#94a3b8" }}>Fraud log not found or unavailable.</p>
            ) : (
              <>
                <div style={valueRow}>
                  <div style={labelMuted}>Risk score / level</div>
                  <div>
                    <strong style={{ fontVariantNumeric: "tabular-nums" }}>{fraudLog.risk_score ?? "—"}</strong>
                    {" "}
                    <span style={riskBadgeStyle(fraudLog.risk_level)}>{fraudLog.risk_level || "—"}</span>
                  </div>
                </div>
                <div style={valueRow}>
                  <div style={labelMuted}>Transaction type</div>
                  <div style={{ textTransform: "lowercase" }}>{fraudLog.transaction_type || "—"}</div>
                </div>
                <div style={valueRow}>
                  <div style={labelMuted}>Amount</div>
                  <div style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>${formatMoney(fraudLog.amount)}</div>
                </div>
                <div style={valueRow}>
                  <div style={labelMuted}>Status</div>
                  <div>{String(fraudLog.status || "—").toLowerCase()}</div>
                </div>
                <div style={{ marginBottom: 0 }}>
                  <div style={labelMuted}>Related transaction</div>
                  {fraudLog.related_transaction_id ? (
                    <Link href={`/transactions/${fraudLog.related_transaction_id}`} style={{ color: "#0ea5e9", fontWeight: 600, fontSize: "0.85rem", wordBreak: "break-all" }}>
                      {fraudLog.related_transaction_id}
                    </Link>
                  ) : (
                    <span style={{ color: "#94a3b8" }}>—</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ ...cardBase, padding: "1.1rem 1.25rem", marginBottom: "1rem" }}>
          <h2
            style={{
              margin: "0 0 0.85rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Actions
          </h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.15rem" }}>
            <button type="button" disabled={busy} onClick={() => setStatus("open")} style={{ ...btnSm, opacity: busy ? 0.65 : 1 }}>
              Set open
            </button>
            <button type="button" disabled={busy} onClick={() => setStatus("in_review")} style={{ ...btnSm, opacity: busy ? 0.65 : 1 }}>
              Set in review
            </button>
            <button type="button" disabled={busy} onClick={() => setStatus("escalated")} style={{ ...btnSm, opacity: busy ? 0.65 : 1 }}>
              Escalate
            </button>
            <button type="button" disabled={busy} onClick={() => setStatus("resolved")} style={{ ...btnSm, opacity: busy ? 0.65 : 1 }}>
              Resolve
            </button>
            <button type="button" disabled={busy} onClick={() => assignToMe()} style={{ ...btnSm, marginRight: 0, opacity: busy ? 0.65 : 1 }}>
              Assign to me
            </button>
          </div>
        </div>

        <div style={{ ...cardBase, padding: "1.1rem 1.25rem" }}>
          <h2
            style={{
              margin: "0 0 0.85rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Case notes
          </h2>
          <label htmlFor="case-note" style={{ ...labelMuted, display: "block" }}>
            Add note
          </label>
          <textarea
            id="case-note"
            className="tc-admin-in"
            value={noteDraft}
            disabled={busy}
            onChange={(e) => setNoteDraft(e.target.value)}
            style={{ ...noteTextareaStyle, opacity: busy ? 0.65 : 1 }}
            placeholder="Internal note…"
          />
          <button
            type="button"
            disabled={busy || !noteDraft.trim()}
            onClick={() => void saveNote()}
            style={{ ...btnSm, marginTop: "0.5rem", marginRight: 0 }}
          >
            {noteBusy ? "Saving…" : "Save note"}
          </button>

          <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #f1f5f9" }}>
            {notes.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>No notes yet.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {notes.map((n) => (
                  <li
                    key={n.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      padding: "0.65rem 0",
                      fontSize: "0.8125rem",
                    }}
                  >
                    <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                      {formatWhen(n.created_at)}
                      {n.author_user_id ? (
                        <span style={{ marginLeft: "0.5rem", color: "#94a3b8" }}>· {actorLabel(n.author_user_id)}</span>
                      ) : null}
                    </div>
                    <div style={{ marginTop: "0.25rem", color: "#0f172a", whiteSpace: "pre-wrap" }}>{n.note}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
