import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";
import { useUser } from "../../../lib/userContext";
import { isAdminUser } from "../../../lib/adminAccess";
import Navbar from "../../../components/Navbar";

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

const selectBase = { ...inputBase, cursor: "pointer" };

const adminFocusCss = `
  .tc-admin-in:focus { outline: none; border-color: #3b82f6 !important; box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
  .tc-admin-in::placeholder { color: #94a3b8; }
`;

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
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
      padding: "0.15rem 0.45rem",
      borderRadius: "6px",
      fontSize: "0.68rem",
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
      padding: "0.15rem 0.45rem",
      borderRadius: "6px",
      fontSize: "0.68rem",
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
      padding: "0.15rem 0.45rem",
      borderRadius: "6px",
      fontSize: "0.68rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fffbeb",
      color: "#9a3412",
      border: "1px solid #fcd34d",
    };
  }
  return {
    display: "inline-block",
    padding: "0.15rem 0.45rem",
    borderRadius: "6px",
    fontSize: "0.68rem",
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
      padding: "0.15rem 0.45rem",
      borderRadius: "6px",
      fontSize: "0.68rem",
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
      padding: "0.15rem 0.45rem",
      borderRadius: "6px",
      fontSize: "0.68rem",
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
      padding: "0.15rem 0.45rem",
      borderRadius: "6px",
      fontSize: "0.68rem",
      fontWeight: 700,
      textTransform: "uppercase",
      background: "#fffbeb",
      color: "#9a3412",
      border: "1px solid #fcd34d",
    };
  }
  return {
    display: "inline-block",
    padding: "0.15rem 0.45rem",
    borderRadius: "6px",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: "#f1f5f9",
    color: "#64748b",
    border: "1px solid #e2e8f0",
  };
}

export default function AdminCasesPage() {
  const { user, profile, loading: authLoading } = useUser();
  const [cases, setCases] = useState([]);
  const [profilesMap, setProfilesMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assignedToMe, setAssignedToMe] = useState(false);

  const fetchCases = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: qErr } = await supabase
        .from("fraud_cases")
        .select("*")
        .order("opened_at", { ascending: false })
        .limit(500);
      if (qErr) {
        console.error(qErr);
        setError(qErr.message || "Failed to load cases.");
        setCases([]);
        setProfilesMap({});
        return;
      }
      const rows = data || [];
      setCases(rows);

      const ids = [
        ...new Set(
          rows.flatMap((r) => [r.user_id, r.assigned_to, r.opened_by, r.resolved_by].filter(Boolean))
        ),
      ];
      if (ids.length === 0) {
        setProfilesMap({});
        return;
      }
      const { data: profs, error: pe } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (pe) {
        console.error(pe);
        setProfilesMap({});
      } else {
        setProfilesMap(Object.fromEntries((profs || []).map((p) => [p.id, p])));
      }
    } catch (e) {
      console.error(e);
      setError(e?.message || "Failed to load cases.");
      setCases([]);
      setProfilesMap({});
    } finally {
      setLoading(false);
    }
  }, [user?.id, user, profile]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, profile)) return;
    void fetchCases();
  }, [authLoading, user?.id, user, profile, fetchCases]);

  useEffect(() => {
    if (authLoading || !user?.id || !isAdminUser(user, profile)) return;
    const channel = supabase
      .channel(`fraud-cases-list-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fraud_cases" },
        () => {
          void fetchCases();
        }
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") console.error("fraud_cases realtime:", err);
      });
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id, user, profile, fetchCases]);

  const summary = useMemo(() => {
    let open = 0;
    let inReview = 0;
    let esc = 0;
    let res = 0;
    for (const c of cases) {
      const s = String(c.status || "").toLowerCase();
      if (s === "open") open += 1;
      else if (s === "in_review") inReview += 1;
      else if (s === "escalated") esc += 1;
      else if (s === "resolved") res += 1;
    }
    return { open, inReview, esc, res };
  }, [cases]);

  const filtered = useMemo(() => {
    let rows = cases;
    if (statusFilter !== "all") {
      rows = rows.filter((c) => String(c.status || "").toLowerCase() === statusFilter);
    }
    if (priorityFilter !== "all") {
      rows = rows.filter((c) => String(c.priority || "").toLowerCase() === priorityFilter);
    }
    if (assignedToMe && user?.id) {
      rows = rows.filter((c) => c.assigned_to === user.id);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((c) => {
        const title = String(c.title || "").toLowerCase();
        const sum = String(c.summary || "").toLowerCase();
        const uid = String(c.user_id || "").toLowerCase();
        const cid = String(c.id || "").toLowerCase();
        return title.includes(q) || sum.includes(q) || uid.includes(q) || cid.includes(q);
      });
    }
    return rows;
  }, [cases, statusFilter, priorityFilter, assignedToMe, user?.id, search]);

  const summaryCards = [
    { label: "Open", value: String(summary.open) },
    { label: "In review", value: String(summary.inReview) },
    { label: "Escalated", value: String(summary.esc) },
    { label: "Resolved", value: String(summary.res) },
  ];

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

  if (!authLoading && user && !isAdminUser(user, profile)) {
    return (
      <div style={{ padding: "2rem" }}>
        <h2>Not authorized</h2>
        <p>This area is restricted to admin users.</p>
      </div>
    );
  }

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
              Case management
            </h1>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
              Structured investigations and follow-up
            </p>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>
              <Link href="/admin" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                ← Admin home
              </Link>
              {" · "}
              <Link href="/admin/fraud-queue" style={{ fontWeight: 600, color: "#0ea5e9" }}>
                Fraud queue
              </Link>
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchCases()}
            disabled={loading}
            style={{
              padding: "0.65rem 1.15rem",
              borderRadius: "10px",
              border: "1px solid #1e293b",
              background: loading ? "#e2e8f0" : "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
              color: loading ? "#64748b" : "#fff",
              fontWeight: 600,
              fontSize: "0.9rem",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Refresh
          </button>
        </div>

        {error ? (
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
            {error}
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
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "0.75rem",
              alignItems: "end",
            }}
          >
            <div>
              <label
                htmlFor="cases-search"
                style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}
              >
                Search
              </label>
              <input
                id="cases-search"
                className="tc-admin-in"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title, summary, user id, case id…"
                style={inputBase}
              />
            </div>
            <div>
              <label
                htmlFor="cases-status"
                style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}
              >
                Status
              </label>
              <select
                id="cases-status"
                className="tc-admin-in"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={selectBase}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="in_review">In review</option>
                <option value="escalated">Escalated</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div>
              <label
                htmlFor="cases-priority"
                style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#94a3b8", marginBottom: "0.35rem" }}
              >
                Priority
              </label>
              <select
                id="cases-priority"
                className="tc-admin-in"
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                style={selectBase}
              >
                <option value="all">All</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", paddingBottom: "0.35rem" }}>
              <label style={{ fontSize: "0.8rem", color: "#0f172a", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                <input type="checkbox" checked={assignedToMe} onChange={(e) => setAssignedToMe(e.target.checked)} />
                Assigned to me
              </label>
            </div>
          </div>
        </div>

        <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
          {loading && cases.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, color: "#64748b" }}>Loading cases…</p>
          ) : filtered.length === 0 ? (
            <p style={{ padding: "1.25rem", margin: 0, color: "#64748b" }}>
              {cases.length === 0 ? "No cases yet. Open a case from a fraud log, alert, or user risk page." : "No cases match your filters."}
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
                <thead>
                  <tr
                    style={{
                      background: "linear-gradient(180deg, #f1f5f9 0%, #e8eef5 100%)",
                      borderBottom: "1px solid #cbd5e1",
                    }}
                  >
                    {["Opened at", "Title", "User", "Priority", "Status", "Assigned to", "View"].map((h) => (
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
                  {filtered.map((r) => {
                    const up = profilesMap[r.user_id];
                    const ap = r.assigned_to ? profilesMap[r.assigned_to] : null;
                    const uname = userLabel(up) || String(r.user_id || "").slice(0, 10) + "…";
                    const aname = r.assigned_to
                      ? userLabel(ap) || `${String(r.assigned_to).slice(0, 8)}…`
                      : "—";
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9", verticalAlign: "top" }}>
                        <td style={{ padding: "0.65rem 0.75rem", color: "#64748b", whiteSpace: "nowrap" }}>{formatWhen(r.opened_at)}</td>
                        <td style={{ padding: "0.65rem 0.75rem", fontWeight: 600, color: "#0f172a", maxWidth: "240px" }}>{r.title}</td>
                        <td style={{ padding: "0.65rem 0.75rem", minWidth: "120px" }}>
                          <div style={{ fontWeight: 600 }}>{uname}</div>
                          <div style={{ fontSize: "0.7rem", color: "#64748b", wordBreak: "break-all" }}>{r.user_id}</div>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={casePriorityBadgeStyle(r.priority)}>{String(r.priority || "—").toLowerCase()}</span>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <span style={caseStatusBadgeStyle(r.status)}>{String(r.status || "—").replace(/_/g, " ")}</span>
                        </td>
                        <td style={{ padding: "0.65rem 0.75rem", fontSize: "0.8rem", color: "#0f172a" }}>{aname}</td>
                        <td style={{ padding: "0.65rem 0.75rem" }}>
                          <Link
                            href={`/admin/cases/${encodeURIComponent(r.id)}`}
                            style={{ fontWeight: 600, color: "#0ea5e9", fontSize: "0.85rem" }}
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
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
