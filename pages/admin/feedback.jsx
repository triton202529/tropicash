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

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function statusPill(status) {
  const v = String(status || "").toLowerCase();
  const open = v === "open";
  const reviewed = v === "reviewed";
  return {
    display: "inline-block",
    padding: "0.15rem 0.45rem",
    borderRadius: "6px",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: open ? "#eff6ff" : reviewed ? "#ecfdf5" : "#f1f5f9",
    color: open ? "#1d4ed8" : reviewed ? "#047857" : "#64748b",
    border: `1px solid ${open ? "#bfdbfe" : reviewed ? "#a7f3d0" : "#e2e8f0"}`,
  };
}

export default function AdminTesterFeedbackPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [rows, setRows] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase.from("tester_feedback").select("*").order("created_at", { ascending: false }).limit(200);
    if (error) {
      console.error("[admin/feedback]", error);
      setErrorMsg(error.message || "Could not load feedback.");
      setRows([]);
      setProfilesMap({});
      setLoading(false);
      return;
    }
    const list = Array.isArray(data) ? data : [];
    setRows(list);
    const ids = [...new Set(list.map((r) => r.user_id).filter(Boolean))];
    if (ids.length === 0) {
      setProfilesMap({});
      setLoading(false);
      return;
    }
    const { data: profs, error: pErr } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
    if (pErr) {
      console.error("[admin/feedback] profiles", pErr);
      setProfilesMap({});
    } else {
      setProfilesMap(Object.fromEntries((profs || []).map((p) => [p.id, p])));
    }
    setLoading(false);
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile)) return;
    void load();
  }, [authLoading, user, profile, load]);

  const setStatus = async (row, nextStatus) => {
    if (!row?.id) return;
    setBusyId(row.id);
    setErrorMsg(null);
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("tester_feedback")
      .update({ status: nextStatus, updated_at: now })
      .eq("id", row.id);
    if (error) {
      console.error("[admin/feedback] update", error);
      setErrorMsg(error.message || "Update failed.");
    }
    await load();
    setBusyId(null);
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
        <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", margin: "0 0 0.5rem", letterSpacing: "-0.02em" }}>
          Tester feedback
        </h1>
        <p style={{ margin: "0 0 1rem", fontSize: "0.875rem", color: "#64748b", maxWidth: "40rem", lineHeight: 1.55 }}>
          Submissions from the Support page (signed-in users). Newest first.
        </p>

        <div style={{ ...cardBase, padding: "0.75rem 1rem", marginBottom: "1rem" }}>
          <button type="button" onClick={() => void load()} disabled={loading} style={{ ...btnSm, marginTop: 0 }}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {errorMsg ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", background: "#fef2f2", borderColor: "#fecaca" }}>
            <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.9rem" }}>{errorMsg}</p>
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {loading && rows.length === 0 ? (
            <p style={{ color: "#64748b" }}>Loading…</p>
          ) : rows.length === 0 ? (
            <div style={{ ...cardBase, padding: "2rem", textAlign: "center" }}>
              <p style={{ margin: 0, color: "#64748b" }}>No feedback yet.</p>
            </div>
          ) : (
            rows.map((r) => {
              const p = profilesMap[r.user_id];
              const email = p?.email?.trim() || "—";
              const name = p?.full_name?.trim() || "";
              const busy = busyId === r.id;
              return (
                <div key={r.id} style={{ ...cardBase, padding: "1rem 1.1rem" }}>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "0.65rem",
                      marginBottom: "0.65rem",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <span style={statusPill(r.status)}>{String(r.status || "").toLowerCase()}</span>
                      <span
                        style={{
                          display: "inline-block",
                          marginLeft: "0.5rem",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          color: "#64748b",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {r.issue_type}
                      </span>
                      {r.rating != null ? (
                        <span style={{ marginLeft: "0.5rem", fontSize: "0.85rem", fontWeight: 600, color: "#0f172a" }}>
                          Rating: {r.rating}/5
                        </span>
                      ) : null}
                    </div>
                    <span style={{ fontSize: "0.78rem", color: "#94a3b8", whiteSpace: "nowrap" }}>{formatWhen(r.created_at)}</span>
                  </div>
                  <p style={{ margin: "0 0 0.65rem", fontSize: "0.88rem", color: "#0f172a", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {r.message}
                  </p>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.78rem", color: "#64748b" }}>
                    <strong style={{ color: "#475569" }}>User</strong>{" "}
                    {name ? <span>{name} · </span> : null}
                    <span style={{ wordBreak: "break-all" }}>{email}</span>
                    <span style={{ color: "#94a3b8" }}> · {String(r.user_id).slice(0, 8)}…</span>
                  </p>
                  <div style={{ marginTop: "0.5rem" }}>
                    <button
                      type="button"
                      disabled={busy || String(r.status).toLowerCase() !== "open"}
                      onClick={() => void setStatus(r, "reviewed")}
                      style={{ ...btnSm, opacity: busy || String(r.status).toLowerCase() !== "open" ? 0.5 : 1 }}
                    >
                      Mark reviewed
                    </button>
                    <button
                      type="button"
                      disabled={busy || String(r.status).toLowerCase() === "closed"}
                      onClick={() => void setStatus(r, "closed")}
                      style={{ ...btnSm, marginRight: 0, opacity: busy || String(r.status).toLowerCase() === "closed" ? 0.5 : 1 }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
