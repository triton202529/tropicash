import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import AuditTimelineEmbed from "../../components/admin/AuditTimelineEmbed";
import { recomputeAndPersistUserRiskState } from "../../lib/riskFlags";
import { logFraudNoteSaved, logFraudStatusChanged } from "../../lib/fraudEvents";

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

function metadataPreview(meta) {
  if (meta == null) return "—";
  if (typeof meta === "object" && !Array.isArray(meta) && Object.keys(meta).length === 0) return "—";
  try {
    const s = JSON.stringify(meta);
    if (s.length <= 220) return s;
    return `${s.slice(0, 217)}…`;
  } catch {
    return "—";
  }
}

function userLabel(profile, userId) {
  if (profile?.full_name?.trim()) return profile.full_name.trim();
  if (profile?.email?.trim()) return profile.email.trim();
  return userId || "—";
}

/** Human-readable Supabase / PostgREST error for admin debugging. */
function formatSupabaseError(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  const parts = [];
  if (err.message) parts.push(String(err.message));
  if (err.code) parts.push(`code ${err.code}`);
  if (err.details) parts.push(String(err.details));
  if (err.hint) parts.push(`hint: ${err.hint}`);
  return parts.length ? parts.join(" — ") : String(err);
}

function chunkIds(ids, size) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** Normalize fraud log status for UI + filters (legacy rows without column → open). */
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

const selectBase = {
  ...inputBase,
  cursor: "pointer",
};

const noteTextareaStyle = {
  ...inputBase,
  fontSize: "0.75rem",
  minHeight: "2.5rem",
  resize: "vertical",
  padding: "0.45rem 0.55rem",
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
  marginRight: "0.3rem",
  marginBottom: "0.25rem",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.06)",
};

const adminFocusCss = `
  .tc-admin-in:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .tc-admin-in::placeholder { color: #94a3b8; }
`;

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

export default function AdminFraudDashboardPage() {
  const { user, profile, loading: authLoading } = useUser();

  const [logs, setLogs] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [dataLoading, setDataLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [profileFetchWarning, setProfileFetchWarning] = useState(null);

  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [noteBusyId, setNoteBusyId] = useState(null);
  const [statusBusyId, setStatusBusyId] = useState(null);
  const [noteDraftById, setNoteDraftById] = useState({});
  const [auditRowExpandId, setAuditRowExpandId] = useState(null);

  const fetchLogs = useCallback(async () => {
    if (!user?.id) return;
    setDataLoading(true);
    setFetchError(null);
    setProfileFetchWarning(null);

    let rows = [];
    try {
      const { data, error } = await supabase
        .from("fraud_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("[admin/fraud] fraud_logs:", error);
        setFetchError(formatSupabaseError(error));
        setLogs([]);
        setProfilesMap({});
        setDataLoading(false);
        return;
      }

      rows = data || [];
      setLogs(rows);
      setNoteDraftById({});
    } catch (e) {
      console.error("[admin/fraud] fraud_logs fetch threw:", e);
      setFetchError(
        e?.name === "TypeError" && String(e?.message || "").includes("fetch")
          ? "Network error loading fraud_logs (request may have been blocked or failed). Check browser network tab and Supabase URL."
          : formatSupabaseError(e),
      );
      setLogs([]);
      setProfilesMap({});
      setDataLoading(false);
      return;
    }

    const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    if (ids.length === 0) {
      setProfilesMap({});
      setDataLoading(false);
      return;
    }

    const PROFILE_SELECT = "id, full_name, email, phone";
    const merged = {};
    const chunkSize = 30;
    const warnings = [];

    for (const chunk of chunkIds(ids, chunkSize)) {
      try {
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select(PROFILE_SELECT)
          .in("id", chunk);

        if (pErr) {
          console.error("[admin/fraud] profiles chunk:", pErr);
          warnings.push(formatSupabaseError(pErr));
        } else {
          for (const p of profs || []) {
            merged[p.id] = p;
          }
        }
      } catch (e) {
        console.error("[admin/fraud] profiles chunk threw:", e);
        warnings.push(formatSupabaseError(e));
      }
    }

    setProfilesMap(merged);
    if (warnings.length) {
      setProfileFetchWarning(
        `Some profile rows could not be loaded (${warnings.length} batch(es)). ${warnings[0]}`,
      );
    }

    setDataLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, profile)) return;
    fetchLogs();
  }, [authLoading, user?.id, user, profile, fetchLogs]);

  const mergeLogRow = useCallback((logId, patch) => {
    setLogs((prev) =>
      prev.map((row) => (row.id === logId ? { ...row, ...patch } : row))
    );
  }, []);

  async function updateFraudStatus(id, nextStatus) {
    if (!user?.id) {
      console.error("updateFraudStatus: missing current user id");
      return { ok: false, error: new Error("Not signed in") };
    }

    const prevRow = logs.find((r) => r.id === id);
    const previousStatus = prevRow ? normalizeStatus(prevRow.status) : "open";
    const subjectUserId = prevRow?.user_id ?? null;

    setStatusBusyId(id);
    try {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from("fraud_logs")
        .update({
          status: nextStatus,
          reviewed_by: user.id,
          reviewed_at: now,
        })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) {
        console.error("updateFraudStatus:", error);
        return { ok: false, error };
      }

      if (data) {
        mergeLogRow(id, data);
        await logFraudStatusChanged(supabase, {
          fraudLogId: id,
          userId: data.user_id ?? subjectUserId,
          actorUserId: user.id,
          previousStatus,
          nextStatus,
          reviewedAt: now,
        });
        const uid = data.user_id ?? subjectUserId;
        if (uid) {
          void recomputeAndPersistUserRiskState(supabase, uid, {
            actorUserId: user.id,
            fraudLogId: id,
          })
            .then(async (rec) => {
              if (!rec.ok) return;
              if (!rec.patch) return;
              setProfilesMap((prev) => ({
                ...prev,
                [uid]: { ...(prev[uid] || {}), ...rec.patch },
              }));
            })
            .catch((e) => console.error(e));
        }
      } else {
        await fetchLogs();
      }

      return { ok: true, data };
    } finally {
      setStatusBusyId(null);
    }
  }

  async function saveReviewNote(id, note) {
    if (!user?.id) {
      console.error("saveReviewNote: missing current user id");
      return { ok: false, error: new Error("Not signed in") };
    }

    setNoteBusyId(id);
    try {
      const trimmed = note.trim() === "" ? null : note.trim();

      const { data, error } = await supabase
        .from("fraud_logs")
        .update({ review_note: trimmed })
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) {
        console.error("saveReviewNote:", error);
        return { ok: false, error };
      }

      if (data) {
        mergeLogRow(id, data);
        await logFraudNoteSaved(supabase, {
          fraudLogId: id,
          userId: data.user_id,
          actorUserId: user.id,
          note,
        });
        setNoteDraftById((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      } else {
        await fetchLogs();
      }

      return { ok: true, data };
    } finally {
      setNoteBusyId(null);
    }
  }

  const summary = useMemo(() => {
    const total = logs.length;
    let high = 0;
    let medium = 0;
    let low = 0;
    let sumScore = 0;
    let openReviews = 0;
    let escalated = 0;

    for (const r of logs) {
      const lv = String(r.risk_level || "").toLowerCase();
      if (lv === "high") high += 1;
      else if (lv === "medium") medium += 1;
      else if (lv === "low") low += 1;
      const s = Number(r.risk_score);
      sumScore += Number.isFinite(s) ? s : 0;

      const st = normalizeStatus(r.status);
      if (st === "open") openReviews += 1;
      if (st === "escalated") escalated += 1;
    }

    const avgScore = total > 0 ? sumScore / total : 0;
    return { total, high, medium, low, avgScore, openReviews, escalated };
  }, [logs]);

  const topFlags = useMemo(() => {
    const counts = {};
    for (const r of logs) {
      for (const f of normalizeFlags(r.flags)) {
        if (!f) continue;
        counts[f] = (counts[f] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [logs]);

  const topRiskyUsers = useMemo(() => {
    const counts = {};
    for (const r of logs) {
      const uid = r.user_id;
      if (!uid) continue;
      counts[uid] = (counts[uid] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([uid, count]) => ({
        userId: uid,
        count,
        label: userLabel(profilesMap[uid], uid),
      }));
  }, [logs, profilesMap]);

  const filteredLogs = useMemo(() => {
    let rows = logs;

    if (riskFilter !== "all") {
      rows = rows.filter(
        (r) => String(r.risk_level || "").toLowerCase() === riskFilter
      );
    }
    if (typeFilter !== "all") {
      rows = rows.filter(
        (r) => String(r.transaction_type || "").toLowerCase() === typeFilter
      );
    }
    if (statusFilter !== "all") {
      rows = rows.filter(
        (r) => normalizeStatus(r.status) === statusFilter
      );
    }

    const q = search.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((r) => {
      const p = profilesMap[r.user_id];
      const name = (p?.full_name || "").toLowerCase();
      const email = (p?.email || "").toLowerCase();
      const uid = String(r.user_id || "").toLowerCase();
      const rel = String(r.related_transaction_id || "").toLowerCase();
      const typ = String(r.transaction_type || "").toLowerCase();
      const flagList = normalizeFlags(r.flags).map((f) => f.toLowerCase());
      const flagsJoined = flagList.join(" ");
      const st = normalizeStatus(r.status);
      const note = String(r.review_note || "").toLowerCase();
      const eventType = String(r.event_type || "").toLowerCase();
      const desc = String(r.description || "").toLowerCase();
      let metaStr = "";
      try {
        metaStr = JSON.stringify(r.metadata ?? {}).toLowerCase();
      } catch {
        metaStr = "";
      }

      return (
        uid.includes(q) ||
        name.includes(q) ||
        email.includes(q) ||
        rel.includes(q) ||
        typ.includes(q) ||
        flagsJoined.includes(q) ||
        flagList.some((f) => f.includes(q)) ||
        st.includes(q) ||
        note.includes(q) ||
        eventType.includes(q) ||
        desc.includes(q) ||
        (metaStr && metaStr.includes(q))
      );
    });
  }, [logs, riskFilter, typeFilter, statusFilter, search, profilesMap]);

  if (authLoading) {
    return (
      <>
        <Navbar />
        <div style={pageWrap}>
          <h1
            style={{
              fontSize: "1.55rem",
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: "1rem",
              letterSpacing: "-0.02em",
            }}
          >
            Fraud dashboard
          </h1>
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
          <h1
            style={{
              fontSize: "1.55rem",
              fontWeight: 700,
              color: "#0f172a",
              marginBottom: "0.75rem",
              letterSpacing: "-0.02em",
            }}
          >
            Fraud dashboard
          </h1>
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
      <div style={{ padding: "2rem" }}>
        <h2>Not authorized</h2>
        <p>This area is restricted to admin users.</p>
      </div>
    );
  }

  const summaryCards = [
    { label: "Total logs", value: String(summary.total) },
    { label: "High risk", value: String(summary.high) },
    { label: "Medium risk", value: String(summary.medium) },
    { label: "Low risk", value: String(summary.low) },
    {
      label: "Avg risk score",
      value: summary.total > 0 ? summary.avgScore.toFixed(1) : "—",
    },
    { label: "Open reviews", value: String(summary.openReviews) },
    { label: "Escalated", value: String(summary.escalated) },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: adminFocusCss }} />
      <Navbar />
      <div style={pageWrap}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <h1
              style={{
                fontSize: "1.55rem",
                fontWeight: 700,
                color: "#0f172a",
                margin: 0,
                letterSpacing: "-0.02em",
              }}
            >
              Fraud dashboard
            </h1>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
              Latest {logs.length} entries from <code style={{ fontSize: "0.8rem" }}>fraud_logs</code>
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchLogs()}
            disabled={dataLoading}
            style={{
              padding: "0.65rem 1.15rem",
              borderRadius: "10px",
              border: "1px solid #1e293b",
              background: dataLoading ? "#e2e8f0" : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
              color: dataLoading ? "#64748b" : "#fff",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: dataLoading ? "not-allowed" : "pointer",
              boxShadow: dataLoading ? "none" : "0 2px 8px rgba(15, 23, 42, 0.2)",
            }}
          >
            Refresh
          </button>
        </div>

        {fetchError ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem 1.15rem",
              marginBottom: "1.25rem",
              background: "#fef2f2",
              borderColor: "#fecaca",
              color: "#b91c1c",
              fontSize: "0.9rem",
            }}
          >
            {fetchError}
          </div>
        ) : null}

        {profileFetchWarning ? (
          <div
            style={{
              ...cardBase,
              padding: "1rem 1.15rem",
              marginBottom: "1.25rem",
              background: "#fffbeb",
              borderColor: "#fcd34d",
              color: "#9a3412",
              fontSize: "0.88rem",
            }}
          >
            {profileFetchWarning} User IDs still appear on each row.
          </div>
        ) : null}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          {summaryCards.map((c) => (
            <div key={c.label} style={{ ...cardBase, padding: "1rem 1.1rem" }}>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#94a3b8",
                }}
              >
                {c.label}
              </p>
              <p
                style={{
                  margin: "0.4rem 0 0",
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "#0f172a",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {c.value}
              </p>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ ...cardBase, padding: "1.1rem 1.15rem" }}>
            <h2
              style={{
                margin: "0 0 0.75rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              Top flags
            </h2>
            {topFlags.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>No flag data yet.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {topFlags.map(([flag, n]) => (
                  <li
                    key={flag}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      fontSize: "0.875rem",
                      padding: "0.35rem 0",
                      borderBottom: "1px solid #f1f5f9",
                      color: "#0f172a",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{flag}</span>
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>{n}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div style={{ ...cardBase, padding: "1.1rem 1.15rem" }}>
            <h2
              style={{
                margin: "0 0 0.75rem",
                fontSize: "0.8rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              Top risky users
            </h2>
            {topRiskyUsers.length === 0 ? (
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>No users yet.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {topRiskyUsers.map((row) => (
                  <li
                    key={row.userId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                      fontSize: "0.875rem",
                      padding: "0.35rem 0",
                      borderBottom: "1px solid #f1f5f9",
                      color: "#0f172a",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{row.label}</span>
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>{row.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div
          style={{
            ...cardBase,
            padding: "0.85rem 1rem",
            marginBottom: "1.25rem",
            background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.8rem", color: "#475569", lineHeight: 1.5 }}>
            <strong style={{ color: "#0f172a" }}>Quick actions:</strong> Use the review note field and{" "}
            <strong>Save note</strong>, then <strong>Mark reviewed</strong> or <strong>Escalate</strong> per row.{" "}
            <strong>Reopen</strong> returns a log to open. Automated risk scoring is unchanged.
          </p>
        </div>

        <div style={{ ...cardBase, padding: "1.1rem 1.15rem", marginBottom: "1.25rem" }}>
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
            Filters
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "0.75rem",
              alignItems: "end",
            }}
          >
            <div>
              <label
                htmlFor="fraud-search"
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginBottom: "0.35rem",
                }}
              >
                Search
              </label>
              <input
                id="fraud-search"
                className="tc-admin-in"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="User, email, event type, description, flags, status…"
                style={inputBase}
              />
            </div>
            <div>
              <label
                htmlFor="fraud-risk"
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginBottom: "0.35rem",
                }}
              >
                Risk level
              </label>
              <select
                id="fraud-risk"
                className="tc-admin-in"
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                style={selectBase}
              >
                <option value="all">All</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="fraud-type"
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginBottom: "0.35rem",
                }}
              >
                Transaction type
              </label>
              <select
                id="fraud-type"
                className="tc-admin-in"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={selectBase}
              >
                <option value="all">All</option>
                <option value="send">Send</option>
                <option value="fund">Fund</option>
                <option value="withdraw">Withdraw</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="fraud-status"
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                  marginBottom: "0.35rem",
                }}
              >
                Review status
              </label>
              <select
                id="fraud-status"
                className="tc-admin-in"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={selectBase}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="reviewed">Reviewed</option>
                <option value="escalated">Escalated</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
          {dataLoading && logs.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, color: "#64748b" }}>Loading fraud logs…</p>
          ) : !fetchError && logs.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, color: "#64748b" }}>
              No fraud logs yet. Successful sends, funds, and withdrawals will appear here when scoring runs.
            </p>
          ) : filteredLogs.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, color: "#64748b" }}>
              No rows match your filters. Try clearing search or filters.
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
                    {[
                      "User",
                      "Type",
                      "Event",
                      "Amount",
                      "Score",
                      "Level",
                      "Flags",
                      "Description",
                      "Metadata",
                      "Related txn",
                      "Created",
                      "Status",
                      "Review note",
                      "Actions",
                    ].map((h) => (
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
                  {filteredLogs.map((r) => {
                    const p = profilesMap[r.user_id];
                    const flags = normalizeFlags(r.flags);
                    const busy = noteBusyId === r.id || statusBusyId === r.id;
                    const noteBusy = noteBusyId === r.id;
                    const noteValue =
                      noteDraftById[r.id] !== undefined
                        ? noteDraftById[r.id]
                        : r.review_note || "";

                    return (
                      <Fragment key={r.id}>
                      <tr
                        style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}
                      >
                        <td style={{ padding: "0.65rem 0.75rem", color: "#0f172a", minWidth: "140px" }}>
                          <div style={{ fontWeight: 600 }}>{userLabel(p, r.user_id)}</div>
                          <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.2rem" }}>
                            {r.user_id}
                          </div>
                          {r.user_id ? (
                            <div style={{ marginTop: "0.35rem" }}>
                              <Link
                                href={`/admin/risk-users/${encodeURIComponent(r.user_id)}`}
                                style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.72rem" }}
                              >
                                User risk profile
                              </Link>
                            </div>
                          ) : null}
                          {p?.phone ? (
                            <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.15rem" }}>
                              {p.phone}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", textTransform: "lowercase", color: "#0f172a" }}>
                          {r.transaction_type || "—"}
                        </td>
                        <td
                          style={{
                            padding: "0.65rem 0.75rem",
                            maxWidth: "140px",
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            fontSize: "0.72rem",
                            fontWeight: 600,
                            color: "#334155",
                            wordBreak: "break-word",
                          }}
                        >
                          {r.event_type || "—"}
                        </td>
                        <td
                          style={{
                            padding: "0.65rem 0.75rem",
                            fontVariantNumeric: "tabular-nums",
                            fontWeight: 600,
                            color: "#0f172a",
                          }}
                        >
                          ${formatMoney(r.amount)}
                        </td>
                        <td
                          style={{
                            padding: "0.65rem 0.75rem",
                            fontVariantNumeric: "tabular-nums",
                            color: "#0f172a",
                          }}
                        >
                          {r.risk_score ?? "—"}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={riskBadgeStyle(r.risk_level)}>{r.risk_level || "—"}</span>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", maxWidth: "180px" }}>
                          {flags.length === 0 ? (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          ) : (
                            flags.map((f, i) => (
                              <span key={`${r.id}-${i}-${f}`} style={chipStyle()}>
                                {f}
                              </span>
                            ))
                          )}
                        </td>
                        <td
                          style={{
                            padding: "0.65rem 0.75rem",
                            maxWidth: "200px",
                            fontSize: "0.78rem",
                            color: "#475569",
                            lineHeight: 1.35,
                            wordBreak: "break-word",
                          }}
                        >
                          {r.description || "—"}
                        </td>
                        <td
                          style={{
                            padding: "0.65rem 0.75rem",
                            maxWidth: "200px",
                            fontSize: "0.72rem",
                            color: "#64748b",
                            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                            lineHeight: 1.35,
                            wordBreak: "break-word",
                            whiteSpace: "pre-wrap",
                          }}
                          title={metadataPreview(r.metadata)}
                        >
                          {metadataPreview(r.metadata)}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", maxWidth: "120px" }}>
                          {r.related_transaction_id ? (
                            <Link
                              href={`/transactions/${r.related_transaction_id}`}
                              style={{ color: "#0ea5e9", fontWeight: 600, wordBreak: "break-all", fontSize: "0.72rem" }}
                            >
                              {r.related_transaction_id}
                            </Link>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>
                          {formatWhen(r.created_at)}
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={statusBadgeStyle(r.status)}>
                            {normalizeStatus(r.status)}
                          </span>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", minWidth: "160px", maxWidth: "220px" }}>
                          <textarea
                            className="tc-admin-in"
                            value={noteValue}
                            disabled={busy}
                            onChange={(e) =>
                              setNoteDraftById((prev) => ({
                                ...prev,
                                [r.id]: e.target.value,
                              }))
                            }
                            rows={2}
                            style={{
                              ...noteTextareaStyle,
                              opacity: busy ? 0.65 : 1,
                              cursor: busy ? "not-allowed" : "text",
                            }}
                            placeholder="Add a note…"
                          />
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => saveReviewNote(r.id, noteValue)}
                            style={{
                              ...btnSm,
                              marginTop: "0.35rem",
                              marginRight: 0,
                              background: "#f8fafc",
                              opacity: busy ? 0.65 : 1,
                              cursor: busy ? "not-allowed" : "pointer",
                            }}
                          >
                            {noteBusy ? "Saving…" : "Save note"}
                          </button>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", minWidth: "200px" }}>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.15rem", alignItems: "center" }}>
                            <Link
                              href={`/admin/fraud/${r.id}`}
                              style={{
                                fontWeight: 600,
                                color: "#0ea5e9",
                                fontSize: "0.78rem",
                                marginRight: "0.35rem",
                                marginBottom: "0.25rem",
                              }}
                            >
                              View
                            </Link>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                setAuditRowExpandId((cur) => (cur === r.id ? null : r.id))
                              }
                              style={{
                                ...btnSm,
                                marginRight: "0.35rem",
                                marginBottom: "0.25rem",
                                opacity: busy ? 0.65 : 1,
                                cursor: busy ? "not-allowed" : "pointer",
                              }}
                            >
                              {auditRowExpandId === r.id ? "Hide audit" : "Audit"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => updateFraudStatus(r.id, "reviewed")}
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
                              onClick={() => updateFraudStatus(r.id, "escalated")}
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
                              onClick={() => updateFraudStatus(r.id, "open")}
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
                        </td>
                      </tr>
                      {auditRowExpandId === r.id ? (
                        <tr>
                          <td colSpan={15} style={{ padding: 0, background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                            <div style={{ padding: "0.5rem 0.75rem" }}>
                              <AuditTimelineEmbed entityType="fraud_case" entityId={r.id} limit={15} />
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
