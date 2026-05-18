import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useUser } from "../../lib/userContext";
import { isAdminUser } from "../../lib/adminAccess";
import Navbar from "../../components/Navbar";
import {
  ENTITY_TYPES,
  fetchAuditTimeline,
  fetchGlobalAuditTimeline,
  auditEntityAdminHref,
} from "../../lib/auditTimeline";
import { sanitizeOperationalMetadata } from "../../lib/operationalLogger";

const pageWrap = {
  padding: "2rem 1.25rem 3rem",
  maxWidth: "960px",
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
};

function formatWhen(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function sevChipStyle(sev) {
  const v = String(sev || "").toLowerCase();
  const map = {
    critical: { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
    warning: { bg: "#fffbeb", color: "#92400e", border: "#fcd34d" },
    success: { bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
    info: { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" },
  };
  const s = map[v] || map.info;
  return {
    display: "inline-block",
    padding: "0.15rem 0.45rem",
    borderRadius: "6px",
    fontSize: "0.68rem",
    fontWeight: 700,
    textTransform: "uppercase",
    background: s.bg,
    color: s.color,
    border: `1px solid ${s.border}`,
  };
}

function shortId(id) {
  if (!id || typeof id !== "string") return "—";
  return id.length > 14 ? `${id.slice(0, 10)}…` : id;
}

function matchesSearch(row, q) {
  if (!q) return true;
  const t = q.toLowerCase();
  const parts = [row?.title, row?.description, row?.event_type, row?.entity_id, row?.entity_type].map((x) =>
    String(x || "").toLowerCase(),
  );
  return parts.some((p) => p.includes(t));
}

export default function AdminAuditTimelinePage() {
  const router = useRouter();
  const { user, profile, loading: authLoading } = useUser();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState(() => new Set());
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const qEntityType = typeof router.query.entityType === "string" ? router.query.entityType.trim() : "";
  const qEntityId = typeof router.query.entityId === "string" ? router.query.entityId.trim() : "";
  const entityScoped = !!(qEntityType && qEntityId);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (router.isReady && qEntityType && qEntityId) {
      setEntityTypeFilter(qEntityType);
    }
  }, [router.isReady, qEntityType, qEntityId]);

  const severityList = useMemo(() => {
    const s = [...severityFilter].filter(Boolean);
    return s.length ? s : null;
  }, [severityFilter]);

  const loadInitial = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    setLoading(true);
    setErrorMsg(null);
    setRows([]);

    if (entityScoped) {
      const { rows: r, error } = await fetchAuditTimeline({
        entityType: qEntityType,
        entityId: qEntityId,
        limit: 50,
        severity: severityList,
        supabaseClient: supabase,
      });
      if (error) {
        console.error("[admin/timeline]", error);
        setErrorMsg(error.message || "Could not load timeline.");
        setRows([]);
      } else {
        setRows(Array.isArray(r) ? r : []);
      }
      setLoading(false);
      return;
    }

    const et = entityTypeFilter && ENTITY_TYPES.includes(entityTypeFilter) ? entityTypeFilter : null;
    const { rows: r, error } = await fetchGlobalAuditTimeline({
      limit: 50,
      entityType: et,
      severity: severityList,
      supabaseClient: supabase,
    });
    if (error) {
      console.error("[admin/timeline]", error);
      setErrorMsg(error.message || "Could not load timeline.");
      setRows([]);
    } else {
      setRows(Array.isArray(r) ? r : []);
    }
    setLoading(false);
  }, [user?.id, user, profile, entityScoped, qEntityType, qEntityId, entityTypeFilter, severityList]);

  useEffect(() => {
    if (authLoading || !user || !isAdminUser(user, profile) || !router.isReady) return;
    void loadInitial();
  }, [authLoading, user, profile, loadInitial, router.isReady]);

  const loadMore = useCallback(async () => {
    if (!user?.id || !isAdminUser(user, profile)) return;
    const last = rows[rows.length - 1];
    if (!last?.created_at) return;
    setLoadingMore(true);
    const beforeIso = last.created_at;

    if (entityScoped) {
      const { rows: more, error } = await fetchAuditTimeline({
        entityType: qEntityType,
        entityId: qEntityId,
        beforeIso,
        limit: 40,
        severity: severityList,
        supabaseClient: supabase,
      });
      if (!error && Array.isArray(more) && more.length) {
        setRows((prev) => [...prev, ...more]);
      }
    } else {
      const et = entityTypeFilter && ENTITY_TYPES.includes(entityTypeFilter) ? entityTypeFilter : null;
      const { rows: more, error } = await fetchGlobalAuditTimeline({
        beforeIso,
        limit: 40,
        entityType: et,
        severity: severityList,
        supabaseClient: supabase,
      });
      if (!error && Array.isArray(more) && more.length) {
        setRows((prev) => [...prev, ...more]);
      }
    }
    setLoadingMore(false);
  }, [
    user?.id,
    user,
    profile,
    rows,
    entityScoped,
    qEntityType,
    qEntityId,
    entityTypeFilter,
    severityList,
  ]);

  const visibleRows = useMemo(
    () => rows.filter((r) => matchesSearch(r, debouncedSearch)),
    [rows, debouncedSearch],
  );

  const [expandedMeta, setExpandedMeta] = useState(() => new Set());
  const toggleMeta = (id) => {
    setExpandedMeta((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const profileIds = useMemo(() => {
    const ids = new Set();
    for (const r of visibleRows) {
      if (r.actor_user_id) ids.add(r.actor_user_id);
      if (r.target_user_id) ids.add(r.target_user_id);
    }
    return [...ids];
  }, [visibleRows]);

  const [profilesMap, setProfilesMap] = useState({});

  useEffect(() => {
    if (!profileIds.length) {
      setProfilesMap({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").in("id", profileIds);
      if (cancelled) return;
      if (error) {
        console.error("[admin/timeline] profiles", error);
        setProfilesMap({});
        return;
      }
      setProfilesMap(Object.fromEntries((data || []).map((p) => [p.id, p])));
    })();
    return () => {
      cancelled = true;
    };
  }, [profileIds.join(",")]);

  const userLabel = (uid) => {
    const p = profilesMap[uid];
    if (p?.full_name?.trim()) return p.full_name.trim();
    if (p?.email?.trim()) return p.email.trim();
    return shortId(uid);
  };

  const toggleSeverity = (sev) => {
    setSeverityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
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
        <h1 style={{ fontSize: "1.55rem", fontWeight: 700, color: "#0f172a", marginBottom: "0.5rem" }}>Audit timeline</h1>
        <p style={{ color: "#64748b", marginBottom: "1.25rem", fontSize: "0.9rem" }}>
          Cross-cutting audit feed. Search filters the events already loaded below (use filters + Load more for depth).
        </p>

        <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: "0.75rem",
              alignItems: "end",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.72rem", fontWeight: 600, color: "#64748b" }}>
              Entity type
              <select
                className="tc-admin-in"
                value={entityScoped ? qEntityType : entityTypeFilter}
                onChange={(e) => {
                  const v = e.target.value;
                  if (entityScoped) {
                    void router.replace(
                      { pathname: "/admin/timeline", query: { entityType: v, entityId: qEntityId } },
                      undefined,
                      { shallow: true },
                    );
                  } else {
                    setEntityTypeFilter(v);
                  }
                }}
                disabled={entityScoped}
                style={{
                  padding: "0.45rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  background: entityScoped ? "#f1f5f9" : "#fff",
                }}
              >
                <option value="">All types</option>
                {ENTITY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.72rem", fontWeight: 600, color: "#64748b" }}>
              Search (loaded rows)
              <input
                className="tc-admin-in"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Title, description, event, id…"
                style={{
                  padding: "0.45rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                }}
              />
            </label>
          </div>
          <div style={{ marginTop: "0.75rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#64748b", marginRight: "0.5rem" }}>Severity</span>
            {["info", "success", "warning", "critical"].map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => toggleSeverity(sev)}
                style={{
                  ...btnSm,
                  marginRight: "0.35rem",
                  marginTop: "0.35rem",
                  opacity: severityFilter.size === 0 || severityFilter.has(sev) ? 1 : 0.45,
                  borderColor: severityFilter.has(sev) ? "#0ea5e9" : "#cbd5e1",
                }}
              >
                {sev}
              </button>
            ))}
          </div>
          <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button type="button" style={btnSm} onClick={() => void loadInitial()} disabled={loading}>
              {loading ? "Loading…" : "Apply filters"}
            </button>
            {entityScoped ? (
              <Link href="/admin/timeline" style={{ ...btnSm, textDecoration: "none", display: "inline-block" }}>
                Clear entity scope
              </Link>
            ) : null}
          </div>
        </div>

        {errorMsg ? (
          <div style={{ ...cardBase, padding: "1rem", marginBottom: "1rem", borderColor: "#fecaca", background: "#fef2f2" }}>
            <p style={{ margin: 0, color: "#991b1b" }}>{errorMsg}</p>
          </div>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {visibleRows.length === 0 && !loading ? (
            <div style={{ ...cardBase, padding: "2rem", textAlign: "center", color: "#64748b" }}>No events match.</div>
          ) : null}
          {visibleRows.map((ev) => {
            const href = auditEntityAdminHref(ev.entity_type, ev.entity_id);
            const metaOpen = expandedMeta.has(ev.id);
            return (
              <div key={ev.id} style={{ ...cardBase, padding: "1rem 1.1rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", alignItems: "center", marginBottom: "0.35rem" }}>
                  <span style={sevChipStyle(ev.severity)}>{ev.severity}</span>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "0.12rem 0.4rem",
                      borderRadius: "6px",
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      background: "#e0f2fe",
                      color: "#0369a1",
                    }}
                  >
                    {ev.entity_type}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "#64748b" }}>{formatWhen(ev.created_at)}</span>
                </div>
                <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "0.95rem" }}>{ev.title || ev.event_type}</div>
                {ev.description ? (
                  <p style={{ margin: "0.35rem 0 0", color: "#475569", fontSize: "0.85rem", lineHeight: 1.45 }}>{ev.description}</p>
                ) : null}
                <div style={{ marginTop: "0.45rem", fontSize: "0.72rem", color: "#94a3b8" }}>
                  <span style={{ wordBreak: "break-all" }}>{ev.event_type}</span>
                  {ev.entity_id ? <span style={{ wordBreak: "break-all" }}> · {ev.entity_id}</span> : null}
                </div>
                <div style={{ marginTop: "0.35rem", fontSize: "0.72rem", color: "#64748b" }}>
                  {ev.actor_user_id ? (
                    <span>
                      Actor: <strong style={{ color: "#0f172a" }}>{userLabel(ev.actor_user_id)}</strong>
                    </span>
                  ) : (
                    <span>Actor: —</span>
                  )}
                  {ev.target_user_id ? (
                    <span style={{ marginLeft: "0.65rem" }}>
                      Target: <strong style={{ color: "#0f172a" }}>{userLabel(ev.target_user_id)}</strong>
                    </span>
                  ) : null}
                  {href ? (
                    <span style={{ marginLeft: "0.65rem" }}>
                      <Link href={href} style={{ color: "#0284c7", fontWeight: 600 }}>
                        Jump to record
                      </Link>
                    </span>
                  ) : null}
                </div>
                <button type="button" style={{ ...btnSm, marginTop: "0.5rem" }} onClick={() => toggleMeta(ev.id)}>
                  {metaOpen ? "Hide metadata" : "Show metadata"}
                </button>
                {metaOpen ? (
                  <pre
                    style={{
                      marginTop: "0.5rem",
                      padding: "0.65rem",
                      borderRadius: "8px",
                      background: "#0f172a",
                      color: "#e2e8f0",
                      fontSize: "0.68rem",
                      overflow: "auto",
                      maxHeight: "220px",
                    }}
                  >
                    {JSON.stringify(sanitizeOperationalMetadata(ev.metadata), null, 2)}
                  </pre>
                ) : null}
              </div>
            );
          })}
        </div>

        {visibleRows.length > 0 ? (
          <div style={{ marginTop: "1rem", textAlign: "center" }}>
            <button type="button" style={btnSm} onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
      <style jsx global>{`
        .tc-admin-in:focus {
          outline: none;
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
        }
      `}</style>
    </>
  );
}
