import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { fetchAuditTimeline, auditEntityAdminHref } from "../../lib/auditTimeline";

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
    padding: "0.12rem 0.4rem",
    borderRadius: "6px",
    fontSize: "0.62rem",
    fontWeight: 800,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    background: s.bg,
    color: s.color,
    border: `1px solid ${s.border}`,
  };
}

function shortId(id) {
  if (!id || typeof id !== "string") return "—";
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

export default function AuditTimelineEmbed({
  entityType,
  entityId,
  limit = 20,
  showViewAllHref = true,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const load = useCallback(async () => {
    if (!entityType || !entityId) return;
    setLoading(true);
    setErrorMsg(null);
    const { rows: r, error } = await fetchAuditTimeline({
      entityType,
      entityId,
      limit,
      supabaseClient: supabase,
    });
    if (error) {
      console.error("[AuditTimelineEmbed]", error);
      setErrorMsg(error.message || "Could not load audit timeline.");
      setRows([]);
    } else {
      setRows(Array.isArray(r) ? r : []);
    }
    setLoading(false);
  }, [entityType, entityId, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const viewAll =
    showViewAllHref && entityType && entityId
      ? `/admin/timeline?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`
      : null;

  return (
    <div
      style={{
        marginTop: "0.75rem",
        padding: "0.75rem 0.85rem",
        borderRadius: "10px",
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
        <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>
          Audit timeline
        </span>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          style={{
            padding: "0.22rem 0.45rem",
            fontSize: "0.65rem",
            borderRadius: "6px",
            border: "1px solid #cbd5e1",
            background: "#fff",
            cursor: loading ? "wait" : "pointer",
            fontWeight: 600,
          }}
        >
          {loading ? "…" : "Refresh"}
        </button>
        {viewAll ? (
          <Link href={viewAll} style={{ fontSize: "0.68rem", fontWeight: 600, color: "#0284c7" }}>
            Open in global timeline
          </Link>
        ) : null}
      </div>
      {errorMsg ? <p style={{ margin: 0, fontSize: "0.78rem", color: "#b91c1c" }}>{errorMsg}</p> : null}
      {!errorMsg && rows.length === 0 && !loading ? (
        <p style={{ margin: 0, fontSize: "0.78rem", color: "#64748b" }}>No audit events yet.</p>
      ) : null}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {rows.map((ev) => {
          const href = auditEntityAdminHref(ev.entity_type, ev.entity_id);
          return (
            <li
              key={ev.id}
              style={{
                padding: "0.45rem 0",
                borderBottom: "1px solid #e2e8f0",
                fontSize: "0.78rem",
                color: "#0f172a",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center", marginBottom: "0.2rem" }}>
                <span style={sevChipStyle(ev.severity)}>{String(ev.severity || "info")}</span>
                <span
                  style={{
                    display: "inline-block",
                    padding: "0.1rem 0.35rem",
                    borderRadius: "4px",
                    fontSize: "0.6rem",
                    fontWeight: 700,
                    background: "#e0f2fe",
                    color: "#0369a1",
                  }}
                >
                  {ev.entity_type}
                </span>
                <span style={{ color: "#64748b", fontSize: "0.68rem" }}>{formatWhen(ev.created_at)}</span>
              </div>
              <div style={{ fontWeight: 600 }}>{ev.title || ev.event_type || "Event"}</div>
              {ev.description ? (
                <div style={{ color: "#475569", marginTop: "0.15rem", lineHeight: 1.35 }}>{ev.description}</div>
              ) : null}
              <div style={{ marginTop: "0.25rem", fontSize: "0.65rem", color: "#94a3b8" }}>
                {ev.event_type}
                {ev.actor_user_id ? ` · actor ${shortId(ev.actor_user_id)}` : ""}
                {ev.target_user_id ? ` · target ${shortId(ev.target_user_id)}` : ""}
                {href ? (
                  <>
                    {" · "}
                    <Link href={href} style={{ color: "#0284c7", fontWeight: 600 }}>
                      Open record
                    </Link>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
